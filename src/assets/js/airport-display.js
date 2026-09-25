/**
 * Airport Display — normalized event handler for CLESS-Player.
 *
 * Consumes self-contained events from CLESS-Server:
 * {
 *   type: "airport_display",
 *   event: "zone_trigger",
 *   event_id: "...",
 *   zone: 1,
 *   zone_name: "Zone 1",
 *   text: "...",
 *   media: { type, url } | null,
 *   announcement: { enabled, text, language, audio_url? }
 * }
 *
 * Flow: update display → enqueue announcement audio (non-overlapping).
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
        if (recentEventSet[eventId]) return true; // duplicate
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
                'text-align:center'
            ].join(';');
            document.body.appendChild(overlayEl);
        }
        return overlayEl;
    }

    function updateDisplay(event) {
        var el = ensureOverlay();
        var zoneLabel = event.zone_name
            ? ('Zone ' + event.zone + ' — ' + event.zone_name)
            : ('Zone ' + (event.zone != null ? event.zone : ''));
        var text = event.text || '';
        var mediaHtml = '';
        if (event.media && event.media.url) {
            var mtype = (event.media.type || 'image').toLowerCase();
            if (mtype === 'video') {
                mediaHtml = '<video src="' + escapeAttr(event.media.url) +
                    '" autoplay muted playsinline style="max-width:90vw;max-height:45vh;margin-bottom:2vh;"></video>';
            } else {
                mediaHtml = '<img src="' + escapeAttr(event.media.url) +
                    '" alt="" style="max-width:90vw;max-height:45vh;object-fit:contain;margin-bottom:2vh;" />';
            }
        }
        el.innerHTML =
            '<div style="font-size:clamp(18px,2.5vw,36px);opacity:0.85;margin-bottom:2vh;letter-spacing:0.04em;">' +
            escapeHtml(zoneLabel) + '</div>' +
            mediaHtml +
            '<div style="font-size:clamp(28px,5vw,72px);font-weight:700;line-height:1.2;max-width:95vw;">' +
            escapeHtml(text) + '</div>';
        el.style.display = 'flex';
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
        // Fallback: ask local boarding-tts on the same PC
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
                    p.catch(function (err) {
                        console.error('Airport Display play() rejected:', err);
                        done();
                    });
                }
            } catch (err) {
                console.error('Airport Display playAudioUrl exception:', err);
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
                xhr.onerror = function () {
                    console.error('Local boarding-tts unreachable');
                    resolve();
                };
                xhr.ontimeout = function () { resolve(); };
                xhr.send(JSON.stringify({
                    text: text,
                    language: language || 'en',
                    play: true
                }));
            } catch (err) {
                console.error('Local boarding-tts call failed:', err);
                resolve();
            }
        });
    }

    /**
     * Handle a normalized Airport Display event.
     * @returns {{ status: string, message: string, event_id?: string }}
     */
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

        console.log('Airport Display handling event:', eventId, 'zone=', event.zone);

        // Coordinate: update display first, then queue audio
        try {
            updateDisplay(event);
        } catch (err) {
            console.error('Airport Display update failed:', err);
            return { status: 'error', message: 'Display update failed', event_id: eventId };
        }

        try {
            enqueueAnnouncement(event);
        } catch (err) {
            console.error('Airport Display announce enqueue failed:', err);
            return { status: 'error', message: 'Announcement queue failed', event_id: eventId };
        }

        // Report status back to cpanel if socket is available
        try {
            if (typeof socket !== 'undefined' && socket && socket.emit) {
                socket.emit('airport-display-status', {
                    event_id: eventId,
                    zone: event.zone,
                    status: 'accepted',
                    timestamp: new Date().toISOString()
                });
            }
        } catch (e) { /* ignore */ }

        return {
            status: 'success',
            message: 'Airport Display event accepted',
            event_id: eventId
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
