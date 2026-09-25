/**
 * Airport Display — normalized event handler for CLESS-Player.
 *
 * Supports slot-based events:
 * {
 *   type: "airport_display",
 *   event: "zone_trigger" | "manual_test" | "auto_trigger",
 *   event_id: "...",
 *   zone: 1,
 *   slots: [
 *     { slot_type: "text"|"media"|"fader"|"ticker"|..., slot_name: "...", value: "..." }
 *   ],
 *   announcement: { enabled, text, language, audio_url? }
 * }
 *
 * Flow: apply slot updates → enqueue announcement audio.
 * Duplicate event_ids are ignored (idempotency).
 */
(function (global) {
    'use strict';

    var RECENT_EVENT_LIMIT = 100;
    var recentEventIds = [];
    var recentEventSet = {};
    var announcementQueue = [];
    var isPlaying = false;
    var currentAudio = null;
    var overlayEl = null;
    var localTtsUrl = 'http://127.0.0.1:8080';

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

    function ensureOverlay() {
        if (overlayEl && document.body.contains(overlayEl)) {
            return overlayEl;
        }
        overlayEl = document.getElementById('airport-display-overlay');
        if (!overlayEl) {
            overlayEl = document.createElement('div');
            overlayEl.id = 'airport-display-overlay';
            overlayEl.style.cssText = [
                'position:fixed',
                'inset:0',
                'z-index:2147483000',
                'display:none',
                'flex-direction:column',
                'align-items:center',
                'justify-content:center',
                'background:rgba(0,20,40,0.92)',
                'color:#fff',
                'font-family:Arial,Helvetica,sans-serif',
                'padding:4vw',
                'box-sizing:border-box',
                'text-align:center',
                'pointer-events:none'
            ].join(';');
            document.body.appendChild(overlayEl);
        }
        return overlayEl;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeAttr(s) {
        return escapeHtml(s).replace(/'/g, '&#39;');
    }

    /**
     * Apply a single slot update using existing replace-text / replace-media paths
     * when possible; falls back to DOM heuristics for ticker/fader/text.
     */
    function applySlotUpdate(slot) {
        if (!slot || !slot.slot_name) return { ok: false, reason: 'missing_slot_name' };
        var slotType = (slot.slot_type || 'text').toLowerCase();
        var slotName = slot.slot_name;
        var value = slot.value == null ? '' : String(slot.value);

        // Prefer existing offline replace helpers when available
        try {
            if (typeof getCurrentLayoutID === 'function' && typeof slotnameList !== 'undefined') {
                var slotInfo = getCurrentLayoutID(slotName, slotnameList);
                var numericId = slotInfo && slotInfo.slotid
                    ? String(slotInfo.slotid).split('-').pop()
                    : null;
                var resolvedType = (slotInfo && slotInfo.slottype) || slotType;

                if (slotType === 'media' || resolvedType === 'media') {
                    if (typeof updateMediaSlotContent === 'function' && numericId) {
                        // Emit via the same path as replacemediaslot for consistency
                        if (typeof socket !== 'undefined' && socket && socket.emit) {
                            // Direct DOM/media update when helpers exist
                        }
                    }
                    // Trigger the same handler shape as cpanel replace-media
                    if (typeof socket !== 'undefined') {
                        // Apply locally: find media slot by name
                    }
                    return applyMediaSlot(slotName, value, numericId, slotInfo);
                }

                // text / ticker / fader / template_variable
                if (typeof updateTextSlotContent === 'function' && numericId) {
                    updateTextSlotContent(numericId, resolvedType || slotType, value, slotInfo.layoutid);
                    return { ok: true, via: 'updateTextSlotContent' };
                }
            }
        } catch (err) {
            console.warn('Airport Display slot helper path failed:', err);
        }

        // Fallback DOM update by slot name attribute / id patterns
        return applySlotDomFallback(slotType, slotName, value);
    }

    function applyMediaSlot(slotName, value, numericId, slotInfo) {
        try {
            var $slot = null;
            if (numericId) {
                $slot = $('#slot-' + numericId);
            }
            if ((!$slot || !$slot.length) && slotName) {
                $slot = $('[data-slotname="' + slotName + '"], .mslot-media').filter(function () {
                    return $(this).attr('data-slotname') === slotName || $(this).attr('id') === 'slot-' + slotName;
                });
            }
            if ($slot && $slot.length) {
                var lower = value.toLowerCase();
                var isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(lower);
                if (isVideo) {
                    $slot.html('<video src="' + escapeAttr(value) + '" autoplay muted loop playsinline style="width:100%;height:100%;object-fit:contain;"></video>');
                } else {
                    $slot.html('<img src="' + escapeAttr(value) + '" alt="" style="width:100%;height:100%;object-fit:contain;" />');
                }
                return { ok: true, via: 'dom-media' };
            }
        } catch (err) {
            console.warn('Airport Display media slot apply failed:', err);
        }
        return { ok: false, reason: 'media_slot_not_found' };
    }

    function applySlotDomFallback(slotType, slotName, value) {
        try {
            var $candidates = $('[data-slotname="' + slotName + '"]');
            if (!$candidates.length) {
                // Try matching known text containers by id patterns used in layouts
                $candidates = $('.text-slot, .ticker-slot, .fader-slot, .mslot-text, .mslot-ticker, .mslot-fader').filter(function () {
                    var id = $(this).attr('id') || '';
                    var name = $(this).attr('data-slotname') || $(this).attr('name') || '';
                    return name === slotName || id.indexOf(slotName) !== -1;
                });
            }
            if ($candidates.length) {
                if (slotType === 'media') {
                    return applyMediaSlot(slotName, value, null, null);
                }
                $candidates.html(value);
                return { ok: true, via: 'dom-fallback' };
            }
        } catch (err) {
            console.warn('Airport Display DOM fallback failed:', err);
        }
        return { ok: false, reason: 'slot_not_found' };
    }

    function updateOverlayFallback(event) {
        var slots = event.slots || [];
        var text = event.text || '';
        var mediaUrl = (event.media && event.media.url) || '';
        if (!text) {
            for (var i = 0; i < slots.length; i++) {
                if (slots[i].slot_type !== 'media' && slots[i].value) {
                    text = slots[i].value;
                    break;
                }
            }
        }
        if (!mediaUrl) {
            for (var j = 0; j < slots.length; j++) {
                if (slots[j].slot_type === 'media' && slots[j].value) {
                    mediaUrl = slots[j].value;
                    break;
                }
            }
        }
        if (!text && !mediaUrl && (event.zone == null)) {
            return; // nothing to show
        }
        var el = ensureOverlay();
        var zoneLabel = '';
        if (event.zone != null) {
            zoneLabel = event.zone_name
                ? ('Zone ' + event.zone + ' — ' + event.zone_name)
                : ('Zone ' + event.zone);
        } else {
            zoneLabel = 'Airport Display Test';
        }
        var mediaHtml = '';
        if (mediaUrl) {
            var isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(mediaUrl);
            if (isVideo) {
                mediaHtml = '<video src="' + escapeAttr(mediaUrl) +
                    '" autoplay muted playsinline style="max-width:90vw;max-height:45vh;margin-bottom:2vh;"></video>';
            } else {
                mediaHtml = '<img src="' + escapeAttr(mediaUrl) +
                    '" alt="" style="max-width:90vw;max-height:45vh;object-fit:contain;margin-bottom:2vh;" />';
            }
        }
        el.innerHTML =
            '<div style="font-size:clamp(18px,2.5vw,36px);opacity:0.85;margin-bottom:2vh;">' +
            escapeHtml(zoneLabel) + '</div>' + mediaHtml +
            '<div style="font-size:clamp(28px,5vw,72px);font-weight:700;line-height:1.2;max-width:95vw;">' +
            escapeHtml(text) + '</div>';
        el.style.display = 'flex';
    }

    function applySlots(event) {
        var slots = event.slots || [];
        var results = [];
        var anyOk = false;
        for (var i = 0; i < slots.length; i++) {
            var r = applySlotUpdate(slots[i]);
            results.push({ slot_name: slots[i].slot_name, result: r });
            if (r && r.ok) anyOk = true;
        }
        // If no named slots applied (or empty slots with legacy text), show overlay
        if (!anyOk) {
            updateOverlayFallback(event);
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
            audio_url: ann.audio_url || '',
            zone: event.zone
        });
        pumpQueue();
    }

    function pumpQueue() {
        if (isPlaying) return;
        var next = announcementQueue.shift();
        if (!next) return;
        isPlaying = true;
        playAnnouncement(next)
            .catch(function (err) {
                console.error('Airport Display announcement failed:', err);
            })
            .then(function () {
                isPlaying = false;
                pumpQueue();
            });
    }

    function playAnnouncement(item) {
        if (item.audio_url) {
            return playAudioUrl(item.audio_url);
        }
        return callLocalBoardingTts(item.text, item.language);
    }

    function playAudioUrl(url) {
        return new Promise(function (resolve) {
            try {
                if (currentAudio) {
                    try { currentAudio.pause(); } catch (e) { /* ignore */ }
                    currentAudio = null;
                }
                var audio = new Audio(url);
                currentAudio = audio;
                var done = function () {
                    if (currentAudio === audio) currentAudio = null;
                    resolve();
                };
                audio.addEventListener('ended', done);
                audio.addEventListener('error', function () {
                    console.error('Airport Display audio error for', url);
                    done();
                });
                var p = audio.play();
                if (p && typeof p.then === 'function') {
                    p.catch(function () { done(); });
                }
            } catch (err) {
                resolve();
            }
        });
    }

    function callLocalBoardingTts(text, language) {
        return new Promise(function (resolve) {
            try {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', localTtsUrl + '/announce', true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.timeout = 30000;
                xhr.onload = function () { resolve(); };
                xhr.onerror = function () { resolve(); };
                xhr.ontimeout = function () { resolve(); };
                xhr.send(JSON.stringify({
                    text: text,
                    language: language || 'en',
                    play: true
                }));
            } catch (err) {
                resolve();
            }
        });
    }

    function handleAirportDisplayEvent(event) {
        if (!event || typeof event !== 'object') {
            return { status: 'error', message: 'Invalid event payload' };
        }
        if (event.type && event.type !== 'airport_display') {
            return { status: 'error', message: 'Unsupported event type' };
        }

        var eventId = event.event_id || '';
        if (rememberEventId(eventId)) {
            console.log('Airport Display duplicate event ignored:', eventId);
            return {
                status: 'duplicate',
                message: 'Duplicate event ignored',
                event_id: eventId
            };
        }

        console.log(
            'Airport Display handling event:',
            eventId,
            'event=', event.event,
            'zone=', event.zone,
            'slots=', (event.slots || []).length
        );

        var slotResults;
        try {
            slotResults = applySlots(event);
        } catch (err) {
            console.error('Airport Display slot apply failed:', err);
            return { status: 'error', message: 'Slot update failed', event_id: eventId };
        }

        try {
            enqueueAnnouncement(event);
        } catch (err) {
            console.error('Airport Display announce enqueue failed:', err);
            return { status: 'error', message: 'Announcement queue failed', event_id: eventId };
        }

        try {
            if (typeof socket !== 'undefined' && socket && socket.emit) {
                socket.emit('airport-display-status', {
                    event_id: eventId,
                    zone: event.zone,
                    event: event.event,
                    status: 'accepted',
                    slots: slotResults,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (e) { /* ignore */ }

        return {
            status: 'success',
            message: 'Airport Display event accepted',
            event_id: eventId,
            slots: slotResults
        };
    }

    function clearOverlay() {
        if (overlayEl) {
            overlayEl.style.display = 'none';
            overlayEl.innerHTML = '';
        }
    }

    function setLocalTtsUrl(url) {
        if (url) localTtsUrl = String(url).replace(/\/$/, '');
    }

    global.AirportDisplayPlayer = {
        handle: handleAirportDisplayEvent,
        clearOverlay: clearOverlay,
        setLocalTtsUrl: setLocalTtsUrl,
        getQueueLength: function () { return announcementQueue.length + (isPlaying ? 1 : 0); }
    };
})(window);
