/**
 * Airport Display — normalized event handler for CLESS-Player.
 *
 * Event shape:
 * {
 *   type: "airport_display",
 *   event: "zone_trigger" | "manual_test" | "auto_trigger",
 *   event_id: "...",
 *   slots: [{
 *     layout_id, layout_name, slot_id, slot_name, slot_type, value,
 *     media_mode?: "selected" | "loop" | "manual",
 *     media_items?: [{ filename, order, id?, type?, duration? }],
 *     temporary?: true
 *   }],
 *   announcement: {
 *     enabled, text,                    // primary language (first in order)
 *     language?, voice?, audio_url?,   // single-language (legacy)
 *     languages?: [{ language, voice, order, text, audio_url }]
 *   }
 *
 * languages[] is the playback queue. Each entry has its own text and audio
 * file. Playback follows `order` (the operator's language order). A failure
 * for one language is reported and the next language still plays.
 * }
 *
 * Media triggers update runtime medialoop / DOM only — they do NOT persist
 * layout JSON (permanent playlist remains intact and is restored on re-render).
 */
(function (global) {
    'use strict';

    var RECENT_EVENT_LIMIT = 200;
    var recentEventIds = [];
    var recentEventSet = {};
    var announcementQueue = [];
    var isPlaying = false;
    var currentAudio = null;
    var mediaRestoreTimers = {};

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

    function basename(pathOrName) {
        var s = String(pathOrName || '');
        var n = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        return n === -1 ? s : s.substring(n + 1);
    }

    function guessMediaType(filename) {
        var ext = String(filename || '').split('.').pop().toLowerCase();
        if (['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv'].indexOf(ext) !== -1) return 'video';
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].indexOf(ext) !== -1) return 'image';
        if (['mp3', 'wav', 'aac', 'flac'].indexOf(ext) !== -1) return 'audio';
        return 'unknown';
    }

    /**
     * Find a DOM / layout slot matching layout_id + slot_id (preferred) or slot_name.
     */
    function resolveSlotTarget(slot) {
        var layoutId = slot.layout_id != null ? String(slot.layout_id) : '';
        var slotId = slot.slot_id != null ? String(slot.slot_id) : '';
        var slotName = slot.slot_name || '';
        var slotType = (slot.slot_type || 'text').toLowerCase();

        if (typeof getCurrentLayoutID === 'function' && typeof slotnameList !== 'undefined' && slotName) {
            try {
                var info = getCurrentLayoutID(slotName, slotnameList);
                if (info && info.slotid) {
                    if (layoutId && info.layoutid && String(info.layoutid) !== layoutId) {
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

        if (slotId && typeof $ !== 'undefined') {
            var $byId = $('#slot-' + slotId);
            if ($byId.length) {
                return { ok: true, numericId: slotId, resolvedType: slotType, layoutId: layoutId, via: 'dom-id' };
            }
        }

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

    function resolveMediaSource(itemOrFilename) {
        var item = itemOrFilename;
        if (typeof itemOrFilename === 'string') {
            item = { filename: itemOrFilename, path: itemOrFilename };
        }
        item = item || {};
        var filename = basename(item.filename || item.value || item.name || item.path || '');
        var path = String(item.path || item.file_path || item.url || item.contentUrl || '').trim();
        if (!filename && path) {
            filename = basename(path);
        }
        if (!filename && !path) {
            return null;
        }
        var resfolder = '';
        try {
            if (typeof config !== 'undefined' && config && config.resfolder) {
                resfolder = String(config.resfolder);
            }
        } catch (e) { /* ignore */ }

        var mediaLocalPath = '';
        if (path) {
            if (/^(https?:|file:|data:)/i.test(path) || path.indexOf('/') === 0 || path.indexOf('\\') === 0) {
                mediaLocalPath = path;
            } else if (path.indexOf('/') !== -1 || path.indexOf('\\') !== -1) {
                mediaLocalPath = path;
            } else if (resfolder) {
                mediaLocalPath = resfolder + '/' + basename(path);
            } else {
                mediaLocalPath = path;
            }
        } else if (resfolder && filename) {
            mediaLocalPath = resfolder + '/' + filename;
        } else {
            mediaLocalPath = filename;
        }
        return {
            filename: filename || basename(mediaLocalPath),
            mediaLocalPath: mediaLocalPath,
            duration: item.duration != null && item.duration !== '' ? Number(item.duration) : 0,
            type: item.type || item.content_type || ''
        };
    }

    function buildMediaContentObj(itemOrFilename) {
        var source = resolveMediaSource(itemOrFilename);
        if (!source) return null;
        var src = source.filename;
        var ext = src.split('.').pop().toLowerCase();
        var mediaLocalPath = source.mediaLocalPath;
        var duration = isFinite(source.duration) ? source.duration : 0;
        if (typeof createMediaObject === 'function') {
            try {
                var created = createMediaObject(src, ext, mediaLocalPath, duration, String(mediaLocalPath).split('/'));
                if (created && created.mediaType && created.mediaType !== 'UNKNOWN') {
                    created.filename = src;
                    if (!created.contentUrl) created.contentUrl = mediaLocalPath;
                    return created;
                }
                if (created === null) {
                    console.warn('Airport Display createMediaObject rejected format:', ext, src);
                }
            } catch (err) {
                console.warn('Airport Display createMediaObject failed:', err);
            }
        }
        var mediaType = guessMediaType(src);
        if (mediaType === 'unknown') {
            return null;
        }
        return {
            contentUrl: mediaLocalPath,
            contentDuration: mediaType === 'image' ? 9999999 : duration,
            contentType: mediaType === 'video' ? 'video/mp4' : ('image/' + ext),
            mediaType: mediaType === 'video' ? 'VIDEO' : 'IMAGE',
            filename: src
        };
    }

    function collectMediaTriggerItems(slot) {
        var mode = String(slot.media_mode || 'selected').toLowerCase();
        var items = Array.isArray(slot.media_items) ? slot.media_items.slice() : [];
        items.sort(function (a, b) {
            return (Number(a.order) || 0) - (Number(b.order) || 0);
        });
        var selected = [];
        if (mode === 'loop' || mode === 'play_all' || mode === 'all') {
            selected = items;
        } else if (items.length) {
            items.forEach(function (it) {
                if (it && it.selected === false) return;
                selected.push(it);
            });
            if (!selected.length && items[0]) selected = [items[0]];
        }
        if (!selected.length && slot.value) {
            selected = [{ filename: basename(slot.value), path: String(slot.value), selected: true, order: 1 }];
        }
        return selected;
    }

    function snapshotMediaSlot(numericId, $slot) {
        var previousHtml = ($slot && $slot.length) ? $slot.html() : null;
        var previousLoop = null;
        var previousIndex = null;
        try {
            if (typeof medialoop !== 'undefined' && medialoop[numericId]) {
                previousLoop = medialoop[numericId].slice();
            }
            if (typeof mediaCurIndex !== 'undefined') {
                previousIndex = mediaCurIndex[numericId];
            }
        } catch (e) { /* ignore */ }
        return { previousHtml: previousHtml, previousLoop: previousLoop, previousIndex: previousIndex };
    }

    function restoreMediaSlot(numericId, $slot, snapshot) {
        if (!snapshot) return;
        try {
            if (typeof medialoop !== 'undefined') {
                if (snapshot.previousLoop) {
                    medialoop[numericId] = snapshot.previousLoop.slice();
                }
            }
            if (typeof mediaCurIndex !== 'undefined' && snapshot.previousIndex != null) {
                mediaCurIndex[numericId] = snapshot.previousIndex;
            }
            if ($slot && $slot.length && snapshot.previousHtml != null) {
                $slot.html(snapshot.previousHtml);
            }
            if (snapshot.previousLoop && snapshot.previousLoop.length &&
                typeof appendMediaElement === 'function') {
                try {
                    appendMediaElement(snapshot.previousLoop[0], '#slot-' + numericId, numericId);
                } catch (e) {
                    console.warn('Airport Display restore appendMediaElement failed:', e);
                }
            }
        } catch (err) {
            console.warn('Airport Display failed to restore previous media:', err);
        }
    }

    /**
     * Temporary media trigger: rewrite runtime medialoop only.
     * Does NOT write localStorage layout / permanent playlist configuration.
     * Existing content is kept when the replacement cannot be validated.
     */
    function applyTemporaryMedia(slot, target) {
        var numericId = String(target.numericId);
        var mode = String(slot.media_mode || 'selected').toLowerCase();
        var selectedItems = collectMediaTriggerItems(slot);
        if (!selectedItems.length) {
            console.warn('Airport Display media trigger rejected: no media items', slot);
            reportStatus({
                status: 'failed',
                phase: 'media',
                slot_id: numericId,
                error_code: 'MEDIA_VALUE_MISSING',
                message: 'No media filename selected for trigger'
            });
            return { ok: false, error_code: 'MEDIA_VALUE_MISSING', message: 'No media filename selected for trigger' };
        }

        var contentObjs = [];
        var filenames = [];
        selectedItems.forEach(function (it) {
            var obj = buildMediaContentObj(it);
            if (obj && obj.contentUrl && obj.mediaType && obj.mediaType !== 'UNKNOWN') {
                contentObjs.push(obj);
                filenames.push(obj.filename || basename(obj.contentUrl));
            } else {
                console.warn('Airport Display skipped invalid media item:', it);
            }
        });
        if (!contentObjs.length) {
            console.warn('Airport Display media trigger rejected: unable to build content', selectedItems);
            reportStatus({
                status: 'failed',
                phase: 'media',
                slot_id: numericId,
                error_code: 'MEDIA_BUILD_FAILED',
                message: 'Unable to build media content objects from payload'
            });
            return { ok: false, error_code: 'MEDIA_BUILD_FAILED', message: 'Unable to build media content objects' };
        }

        var $slot = target.$el || (typeof $ !== 'undefined' ? $('#slot-' + numericId) : null);
        var snapshot = snapshotMediaSlot(numericId, $slot);

        // Prefer medialoop runtime path used by the player (temporary; not persisted)
        if (typeof medialoop !== 'undefined' && typeof appendMediaElement === 'function') {
            try {
                if (typeof mediaCurIndex !== 'undefined') {
                    mediaCurIndex[numericId] = 1;
                }
                medialoop[numericId] = contentObjs.slice();
                if ($slot && $slot.length) {
                    $slot.html('');
                }
                appendMediaElement(medialoop[numericId][0], '#slot-' + numericId, numericId);
                console.log('Airport Display media trigger applied', {
                    slot_id: numericId,
                    mode: mode,
                    filenames: filenames,
                    contentUrl: contentObjs[0].contentUrl
                });
                reportStatus({
                    status: 'media_trigger',
                    phase: 'media',
                    slot_id: numericId,
                    media_mode: mode,
                    filenames: filenames,
                    content_url: contentObjs[0].contentUrl,
                    temporary: true,
                    message: 'Temporary media trigger applied (permanent playlist unchanged)'
                });
                return {
                    ok: true,
                    via: 'medialoop-temporary',
                    layout_id: target.layoutId,
                    slot_id: numericId,
                    media_mode: mode,
                    filenames: filenames,
                    temporary: true
                };
            } catch (err) {
                console.warn('Airport Display medialoop media trigger failed; restoring previous media:', err);
                restoreMediaSlot(numericId, $slot, snapshot);
                reportStatus({
                    status: 'failed',
                    phase: 'media',
                    slot_id: numericId,
                    error_code: 'MEDIA_RENDER_FAILED',
                    message: String(err && err.message || err)
                });
                return {
                    ok: false,
                    error_code: 'MEDIA_RENDER_FAILED',
                    message: 'Media render failed; previous content preserved'
                };
            }
        }

        // DOM fallback (also non-persistent)
        if ($slot && $slot.length) {
            try {
                var first = contentObjs[0];
                var value = first.contentUrl || first.filename;
                var isVideo = first.mediaType === 'VIDEO' || guessMediaType(first.filename) === 'video';
                if (isVideo) {
                    $slot.html('<video src="' + escapeAttr(value) + '" autoplay muted ' +
                        (mode === 'loop' || mode === 'play_all' || mode === 'all' ? 'loop ' : '') +
                        'playsinline style="width:100%;height:100%;object-fit:contain;"></video>');
                } else {
                    $slot.html('<img src="' + escapeAttr(value) + '" alt="" style="width:100%;height:100%;object-fit:contain;" />');
                }
                return {
                    ok: true,
                    via: 'media-dom-temporary',
                    layout_id: target.layoutId,
                    slot_id: numericId,
                    media_mode: mode,
                    filenames: filenames,
                    temporary: true
                };
            } catch (domErr) {
                restoreMediaSlot(numericId, $slot, snapshot);
                return {
                    ok: false,
                    error_code: 'MEDIA_RENDER_FAILED',
                    message: 'DOM media render failed; previous content preserved'
                };
            }
        }
        return { ok: false, error_code: 'SLOT_NOT_FOUND', message: 'Media slot element not found' };
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

        if (slot.slot_type && target.resolvedType &&
            slot.slot_type !== target.resolvedType &&
            !(slotType === 'template_variable' && target.resolvedType === 'text')) {
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
                return applyTemporaryMedia(slot, target);
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
                via: r && r.via || null,
                media_mode: r && r.media_mode || null,
                temporary: !!(r && r.temporary)
            });
        }
        return results;
    }

    /**
     * Build ordered language playback list. First entry always plays first.
     * Does not alphabetically sort — preserves explicit order.
     */
    function normalizeAnnouncementLanguages(ann) {
        var list = [];
        if (ann && Array.isArray(ann.languages) && ann.languages.length) {
            ann.languages.forEach(function (entry, idx) {
                if (!entry) return;
                list.push({
                    language: entry.language || entry.lang || 'en',
                    voice: entry.voice || '',
                    order: entry.order != null ? Number(entry.order) : (idx + 1),
                    audio_url: entry.audio_url || entry.audio || '',
                    text: entry.text || ann.text || ''
                });
            });
            list.sort(function (a, b) { return a.order - b.order; });
            // Re-number to 1..N after sort to keep reporting clean, but keep relative order
            list.forEach(function (item, i) { item.order = i + 1; });
            return list;
        }
        if (ann && (ann.audio_url || ann.text)) {
            return [{
                language: ann.language || 'en',
                voice: ann.voice || '',
                order: 1,
                audio_url: ann.audio_url || '',
                text: ann.text || ''
            }];
        }
        return [];
    }

    function enqueueAnnouncement(event) {
        var ann = event.announcement || {};
        if (!ann.enabled) return;
        var languages = normalizeAnnouncementLanguages(ann);
        if (!languages.length) return;
        var playable = languages.filter(function (l) { return !!l.audio_url; });
        if (!playable.length) {
            reportStatus({
                event_id: event.event_id,
                status: 'failed',
                phase: 'announcement',
                error_code: 'AUDIO_URL_MISSING',
                message: 'Announcement enabled but no audio_url was provided',
                languages: languages.map(function (l) {
                    return { language: l.language, order: l.order, ok: false, error_code: 'AUDIO_URL_MISSING' };
                })
            });
            return;
        }
        // Keep languages that have no audio so they are reported in order,
        // while the playable languages still play around them.
        announcementQueue.push({
            event_id: event.event_id,
            text: ann.text || '',
            languages: languages
        });
        reportStatus({
            event_id: event.event_id,
            status: 'queued',
            phase: 'announcement',
            languages: languages.map(function (l) {
                return { language: l.language, order: l.order, text: l.text || '' };
            })
        });
        pumpQueue();
    }

    function pumpQueue() {
        if (isPlaying) return;
        var next = announcementQueue.shift();
        if (!next) return;
        isPlaying = true;
        playLanguageSequence(next)
            .then(function (summary) {
                reportStatus({
                    event_id: next.event_id,
                    status: summary.failed ? (summary.played ? 'partial' : 'failed') : 'completed',
                    phase: 'announcement',
                    played: summary.played,
                    failed: summary.failed,
                    languages: summary.results
                });
            })
            .catch(function (err) {
                reportStatus({
                    event_id: next.event_id,
                    status: 'failed',
                    phase: 'announcement',
                    error_code: 'AUDIO_PLAYBACK_FAILED',
                    message: String(err && err.message || err)
                });
            })
            .then(function () {
                isPlaying = false;
                pumpQueue();
            });
    }

    function playLanguageSequence(job) {
        var results = [];
        var chain = Promise.resolve();
        (job.languages || []).forEach(function (lang) {
            chain = chain.then(function () {
                if (!lang.audio_url) {
                    results.push({
                        language: lang.language,
                        order: lang.order,
                        ok: false,
                        error_code: 'AUDIO_URL_MISSING'
                    });
                    reportStatus({
                        event_id: job.event_id,
                        status: 'language_failed',
                        phase: 'announcement',
                        language: lang.language,
                        order: lang.order,
                        error_code: 'AUDIO_URL_MISSING',
                        message: 'No audio for ' + lang.language
                    });
                    return false;
                }
                reportStatus({
                    event_id: job.event_id,
                    status: 'playing',
                    phase: 'announcement',
                    language: lang.language,
                    order: lang.order,
                    message: 'Playing ' + lang.language
                });
                return playAudioUrl(lang.audio_url).then(function (ok) {
                    results.push({
                        language: lang.language,
                        order: lang.order,
                        ok: !!ok,
                        error_code: ok ? null : 'AUDIO_PLAYBACK_FAILED'
                    });
                    reportStatus({
                        event_id: job.event_id,
                        status: ok ? 'language_completed' : 'language_failed',
                        phase: 'announcement',
                        language: lang.language,
                        order: lang.order,
                        error_code: ok ? null : 'AUDIO_PLAYBACK_FAILED'
                    });
                    // Continue to the next language even if this one fails.
                    return ok;
                });
            });
        });
        return chain.then(function () {
            var played = results.filter(function (r) { return r.ok; }).length;
            var failed = results.length - played;
            return { played: played, failed: failed, results: results };
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
        getQueueLength: function () { return announcementQueue.length + (isPlaying ? 1 : 0); },
        _normalizeAnnouncementLanguages: normalizeAnnouncementLanguages,
        _playLanguageSequence: playLanguageSequence,
        _guessMediaType: guessMediaType,
        _buildMediaContentObj: buildMediaContentObj,
        _collectMediaTriggerItems: collectMediaTriggerItems,
        _applyTemporaryMedia: applyTemporaryMedia
    };
})(window);
