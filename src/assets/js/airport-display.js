/**
 * Airport Display — normalized event handler for CLESS-Player.
 *
 * Event shape:
 * {
 *   type: "airport_display",
 *   event: "zone_trigger" | "manual_test" | "auto_trigger",
 *   event_id: "...",
 *   slots: [{
 *     layout_id, layout_name, slot_id, slot_name, slot_type, value
 *   }],
 *   announcement: { enabled, text, language, audio_url?, voice? }
 * }
 */
(function (global) {
    'use strict';

    var RECENT_EVENT_LIMIT = 200;
    var recentEventIds = [];
    var recentEventSet = {};
    var announcementQueue = [];
    var isPlaying = false;
    var currentAudio = null;

    function rememberEventId(eventId) {
        if (!eventId) return false;
        if (recentEventSet[eventId]) return true;
        recentEventSet[eventId] = true;
        recentEventIds.push(eventId);
        if (recentEventIds.length > RECENT_EVENT_LIMIT) {
            var old = recentEventIds.shift();
            delete recentEventSet[old];
        }
        return false;
    }

    function reportStatus(payload) {
        try {
            if (typeof socket !== 'undefined' && socket && socket.emit) {
                socket.emit('airport-display-status', Object.assign({
                    timestamp: new Date().toISOString()
                }, payload || {}));
            }
        } catch (e) { /* ignore */ }
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://localhost:9000/api/airport-display/status', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(payload || {}));
        } catch (e2) { /* ignore */ }
    }

    function escapeAttr(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Find a DOM / layout slot matching layout_id + slot_id (preferred) or slot_name.
     */
    function resolveSlotTarget(slot) {
        var layoutId = slot.layout_id != null ? String(slot.layout_id) : '';
        var slotId = slot.slot_id != null ? String(slot.slot_id) : '';
        var slotName = slot.slot_name || '';
        var slotType = (slot.slot_type || 'text').toLowerCase();

        // Prefer existing helpers
        if (typeof getCurrentLayoutID === 'function' && typeof slotnameList !== 'undefined' && slotName) {
            try {
                var info = getCurrentLayoutID(slotName, slotnameList);
                if (info && info.slotid) {
                    // If layout_id specified, ensure it matches when possible
                    if (layoutId && info.layoutid && String(info.layoutid) !== layoutId) {
                        // Still allow if current layout matches requested
                        if (typeof currentPlayLayoutID !== 'undefined' &&
                            currentPlayLayoutID &&
                            String(currentPlayLayoutID) !== layoutId) {
                            return {
                                ok: false,
                                error_code: 'LAYOUT_NOT_FOUND',
                                message: 'Layout ' + layoutId + ' is not active/available for slot ' + slotName
                            };
                        }
                    }
                    return {
                        ok: true,
                        numericId: String(info.slotid).split('-').pop(),
                        resolvedType: info.slottype || slotType,
                        layoutId: info.layoutid || layoutId,
                        via: 'slotnameList'
                    };
                }
            } catch (err) {
                console.warn('Airport Display getCurrentLayoutID failed:', err);
            }
        }

        // DOM by slot id
        if (slotId && typeof $ !== 'undefined') {
            var $byId = $('#slot-' + slotId);
            if ($byId.length) {
                return { ok: true, numericId: slotId, resolvedType: slotType, layoutId: layoutId, via: 'dom-id' };
            }
        }

        // DOM by data-slotname
        if (slotName && typeof $ !== 'undefined') {
            var $byName = $('[data-slotname="' + slotName + '"]');
            if ($byName.length) {
                var idAttr = $byName.attr('id') || '';
                var num = idAttr.indexOf('slot-') === 0 ? idAttr.slice(5) : slotId;
                return { ok: true, numericId: num, resolvedType: slotType, layoutId: layoutId, via: 'dom-name', $el: $byName };
            }
        }

        return {
            ok: false,
            error_code: 'SLOT_NOT_FOUND',
            message: 'Slot not found' + (layoutId ? (' in layout ' + layoutId) : '') +
                (slotName ? (': ' + slotName) : (slotId ? (': #' + slotId) : ''))
        };
    }

    function applySlotUpdate(slot) {
        if (!slot) {
            return { ok: false, error_code: 'INVALID_SLOT', message: 'Missing slot payload' };
        }
        var value = slot.value == null ? '' : String(slot.value);
        var slotType = (slot.slot_type || 'text').toLowerCase();

        var target = resolveSlotTarget(slot);
        if (!target.ok) {
            return target;
        }

        // Type mismatch warning (non-fatal if still writable)
        if (slot.slot_type && target.resolvedType &&
            slot.slot_type !== target.resolvedType &&
            !(slotType === 'template_variable' && target.resolvedType === 'text')) {
            // Allow text-like updates into ticker/fader
            var textLike = ['text', 'ticker', 'fader', 'scroller', 'template_variable'];
            if (!(textLike.indexOf(slotType) !== -1 && textLike.indexOf(target.resolvedType) !== -1) &&
                !(slotType === 'media' && target.resolvedType === 'media')) {
                return {
                    ok: false,
                    error_code: 'SLOT_TYPE_MISMATCH',
                    message: 'Expected ' + slot.slot_type + ' but found ' + target.resolvedType
                };
            }
        }

        try {
            if (slotType === 'media' || target.resolvedType === 'media') {
                var $slot = target.$el || (typeof $ !== 'undefined' ? $('#slot-' + target.numericId) : null);
                if ($slot && $slot.length) {
                    var isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(value);
                    if (isVideo) {
                        $slot.html('<video src="' + escapeAttr(value) + '" autoplay muted loop playsinline style="width:100%;height:100%;object-fit:contain;"></video>');
                    } else {
                        $slot.html('<img src="' + escapeAttr(value) + '" alt="" style="width:100%;height:100%;object-fit:contain;" />');
                    }
                    return { ok: true, via: 'media-dom', layout_id: target.layoutId, slot_id: target.numericId };
                }
                return { ok: false, error_code: 'SLOT_NOT_FOUND', message: 'Media slot element not found' };
            }

            if (typeof updateTextSlotContent === 'function' && target.numericId) {
                updateTextSlotContent(
                    target.numericId,
                    target.resolvedType || slotType,
                    value,
                    target.layoutId || slot.layout_id
                );
                return { ok: true, via: 'updateTextSlotContent', layout_id: target.layoutId, slot_id: target.numericId };
            }

            var $el = target.$el || (typeof $ !== 'undefined' ? $('#slot-' + target.numericId) : null);
            if ($el && $el.length) {
                $el.html(value);
                return { ok: true, via: 'dom-html', layout_id: target.layoutId, slot_id: target.numericId };
            }
        } catch (err) {
            return { ok: false, error_code: 'APPLY_FAILED', message: String(err && err.message || err) };
        }

        return { ok: false, error_code: 'UNSUPPORTED_SLOT_TYPE', message: 'Unable to apply slot update' };
    }

    function applySlots(event) {
        var slots = event.slots || [];
        var results = [];
        for (var i = 0; i < slots.length; i++) {
            var r = applySlotUpdate(slots[i]);
            results.push({
                layout_id: slots[i].layout_id || null,
                layout_name: slots[i].layout_name || '',
                slot_id: slots[i].slot_id || null,
                slot_name: slots[i].slot_name || '',
                slot_type: slots[i].slot_type || '',
                ok: !!(r && r.ok),
                error_code: r && r.error_code || null,
                message: r && r.message || (r && r.ok ? 'OK' : 'Failed'),
                via: r && r.via || null
            });
        }
        return results;
    }

    function enqueueAnnouncement(event) {
        var ann = event.announcement || {};
        if (!ann.enabled) return;
        if (!ann.audio_url && !ann.text) return;
        announcementQueue.push({
            event_id: event.event_id,
            text: ann.text || '',
            language: ann.language || 'en',
            audio_url: ann.audio_url || ''
        });
        pumpQueue();
    }

    function pumpQueue() {
        if (isPlaying) return;
        var next = announcementQueue.shift();
        if (!next) return;
        isPlaying = true;
        reportStatus({ event_id: next.event_id, status: 'playing', phase: 'announcement' });
        playAudioUrl(next.audio_url)
            .then(function (ok) {
                reportStatus({
                    event_id: next.event_id,
                    status: ok ? 'completed' : 'failed',
                    phase: 'announcement',
                    error_code: ok ? null : 'AUDIO_PLAYBACK_FAILED'
                });
            })
            .catch(function () {
                reportStatus({
                    event_id: next.event_id,
                    status: 'failed',
                    phase: 'announcement',
                    error_code: 'AUDIO_PLAYBACK_FAILED'
                });
            })
            .then(function () {
                isPlaying = false;
                pumpQueue();
            });
    }

    function playAudioUrl(url) {
        return new Promise(function (resolve) {
            if (!url) {
                resolve(false);
                return;
            }
            try {
                if (currentAudio) {
                    try { currentAudio.pause(); } catch (e) { /* ignore */ }
                    currentAudio = null;
                }
                var audio = new Audio(url);
                currentAudio = audio;
                var settled = false;
                var done = function (ok) {
                    if (settled) return;
                    settled = true;
                    if (currentAudio === audio) currentAudio = null;
                    resolve(!!ok);
                };
                audio.addEventListener('ended', function () { done(true); });
                audio.addEventListener('error', function () { done(false); });
                var p = audio.play();
                if (p && typeof p.then === 'function') {
                    p.catch(function () { done(false); });
                }
            } catch (err) {
                resolve(false);
            }
        });
    }

    function handleAirportDisplayEvent(event) {
        if (!event || typeof event !== 'object') {
            return { status: 'error', error_code: 'INVALID_PAYLOAD', message: 'Invalid event payload' };
        }
        if (event.type && event.type !== 'airport_display') {
            return { status: 'error', error_code: 'UNSUPPORTED_EVENT_TYPE', message: 'Unsupported event type' };
        }

        var eventId = event.event_id || '';
        if (rememberEventId(eventId)) {
            reportStatus({ event_id: eventId, status: 'duplicate' });
            return { status: 'duplicate', message: 'Duplicate event ignored', event_id: eventId };
        }

        reportStatus({ event_id: eventId, status: 'received', event: event.event, zone: event.zone });

        var slotResults = [];
        try {
            slotResults = applySlots(event);
        } catch (err) {
            reportStatus({
                event_id: eventId,
                status: 'failed',
                error_code: 'SLOT_APPLY_FAILED',
                message: String(err && err.message || err)
            });
            return { status: 'error', error_code: 'SLOT_APPLY_FAILED', event_id: eventId };
        }

        var failed = slotResults.filter(function (r) { return !r.ok; });
        if (failed.length && failed.length === slotResults.length && slotResults.length > 0) {
            reportStatus({
                event_id: eventId,
                status: 'failed',
                error_code: 'ALL_SLOTS_FAILED',
                slots: slotResults
            });
            // Still attempt announcement only if some content intent remains? Spec: don't silently
            // apply missing slots — but announcement may still be independent.
        } else {
            reportStatus({
                event_id: eventId,
                status: failed.length ? 'partial' : 'applied',
                slots: slotResults
            });
        }

        try {
            enqueueAnnouncement(event);
        } catch (err) {
            reportStatus({
                event_id: eventId,
                status: 'failed',
                phase: 'announcement',
                error_code: 'ANNOUNCE_QUEUE_FAILED'
            });
        }

        return {
            status: failed.length && failed.length === slotResults.length && slotResults.length
                ? 'error'
                : 'success',
            message: 'Airport Display event processed',
            event_id: eventId,
            slots: slotResults
        };
    }

    global.AirportDisplayPlayer = {
        handle: handleAirportDisplayEvent,
        getQueueLength: function () { return announcementQueue.length + (isPlaying ? 1 : 0); }
    };
})(window);
