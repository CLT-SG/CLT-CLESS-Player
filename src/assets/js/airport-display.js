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
 *     languages?: [{ language, voice, order, text, audio_url }],
 *     repeat?: 1..9                     // total plays of the full language sequence (default 1)
 *   }
 *   freeze_timeout?: "forever" | seconds  // Layout + Slot freeze (not TTS)
 *
 * languages[] is the playback queue. Each entry has its own text and audio
 * file. Playback follows `order` (the operator's language order). A failure
 * for one language is reported and the next language still plays.
 * `repeat` replays the full language sequence that many times (reuse same URLs).
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
    var layoutTransitionQueue = Promise.resolve();
    var layoutTransitionBusy = false;

    /**
     * Authoritative layout freeze state after Airport Display / Control Panel
     * triggers. While active, the normal layout loop must not advance.
     */
    var layoutFreezeState = {
        active: false,
        freezeTimeout: 'forever',
        freezeStartedAt: null,
        freezeUntil: null,
        triggeredBy: '',
        eventId: '',
        layoutId: '',
        timerId: null,
        savedLoopIndex: null,
        generation: 0
    };

    var FREEZE_PRESETS = [0, 30, 60, 120, 300, 600];

    function normalizeFreezeTimeout(raw) {
        if (raw == null || raw === '') {
            return 'forever';
        }
        if (typeof raw === 'string') {
            var lowered = raw.trim().toLowerCase();
            if (!lowered || lowered === 'forever' || lowered === 'infinite' || lowered === 'inf') {
                return 'forever';
            }
            if (lowered === '0' || lowered === 'none') {
                return 0;
            }
            var asNum = Number(lowered);
            if (isFinite(asNum) && asNum >= 0) {
                return Math.floor(asNum);
            }
            console.warn('Airport Display invalid freeze_timeout; defaulting to forever:', raw);
            return 'forever';
        }
        if (typeof raw === 'number' && isFinite(raw) && raw >= 0) {
            return Math.floor(raw);
        }
        console.warn('Airport Display invalid freeze_timeout; defaulting to forever:', raw);
        return 'forever';
    }

    function clearFreezeTimer() {
        if (layoutFreezeState.timerId != null) {
            try { clearTimeout(layoutFreezeState.timerId); } catch (e) { /* ignore */ }
            layoutFreezeState.timerId = null;
        }
    }

    function getFreezeSnapshot() {
        return {
            active: !!layoutFreezeState.active,
            freeze_timeout: layoutFreezeState.freezeTimeout,
            freeze_started_at: layoutFreezeState.freezeStartedAt,
            freeze_until: layoutFreezeState.freezeUntil,
            triggered_by: layoutFreezeState.triggeredBy || '',
            event_id: layoutFreezeState.eventId || '',
            layout_id: layoutFreezeState.layoutId || '',
            generation: layoutFreezeState.generation,
            saved_loop_index: layoutFreezeState.savedLoopIndex
        };
    }

    function isLayoutFrozen() {
        return !!layoutFreezeState.active;
    }

    /**
     * Stop automatic layout-loop advancement while freeze is active.
     * Replaces any previous freeze timer (single authoritative freeze state).
     */
    function activateLayoutFreeze(options) {
        options = options || {};
        var timeout = normalizeFreezeTimeout(
            options.freeze_timeout != null ? options.freeze_timeout : options.freezeTimeout
        );
        var generation = layoutFreezeState.generation + 1;
        clearFreezeTimer();

        var savedIndex = null;
        try {
            if (typeof loopXMLCurIndex !== 'undefined') {
                savedIndex = loopXMLCurIndex;
            }
        } catch (e) { /* ignore */ }

        layoutFreezeState.active = true;
        layoutFreezeState.freezeTimeout = timeout;
        layoutFreezeState.freezeStartedAt = new Date().toISOString();
        layoutFreezeState.freezeUntil = null;
        layoutFreezeState.triggeredBy = String(options.triggered_by || options.source || 'airport_display');
        layoutFreezeState.eventId = String(options.event_id || '');
        layoutFreezeState.layoutId = String(options.layout_id || getActiveLayoutId() || '');
        layoutFreezeState.savedLoopIndex = savedIndex;
        layoutFreezeState.generation = generation;

        // Hard-stop the current loop timer so the previous layout cannot advance.
        try {
            if (typeof resetLoopTimeoutState === 'function') {
                resetLoopTimeoutState();
            } else if (typeof loopTimeout !== 'undefined' && loopTimeout) {
                clearTimeout(loopTimeout);
                loopTimeout = null;
            }
            if (typeof loopTimeoutPaused !== 'undefined') {
                loopTimeoutPaused = true;
            }
        } catch (err) {
            console.warn('Airport Display freeze: failed to clear loop timeout:', err);
        }

        console.log(
            'Airport Display Freeze Started\n' +
            'Layout: ' + (layoutFreezeState.layoutId || '') + '\n' +
            'Freeze timeout: ' + timeout + '\n' +
            'Triggered by: ' + layoutFreezeState.triggeredBy + '\n' +
            'Event ID: ' + layoutFreezeState.eventId + '\n' +
            'Generation: ' + generation
        );
        reportStatus({
            status: 'freeze_started',
            phase: 'freeze',
            freeze: getFreezeSnapshot(),
            message: timeout === 'forever'
                ? 'Layout loop frozen indefinitely (resume via /api/resume-layout)'
                : ('Layout loop frozen for ' + timeout + 's')
        });

        if (timeout === 'forever') {
            return getFreezeSnapshot();
        }
        if (timeout === 0) {
            // Immediate resume requested.
            resumeLayoutFreeze('freeze_timeout_0');
            return getFreezeSnapshot();
        }

        var untilMs = Date.now() + (timeout * 1000);
        layoutFreezeState.freezeUntil = new Date(untilMs).toISOString();
        layoutFreezeState.timerId = setTimeout(function () {
            if (layoutFreezeState.generation !== generation) {
                return; // superseded by a newer trigger
            }
            resumeLayoutFreeze('freeze_timeout_expired');
        }, timeout * 1000);

        return getFreezeSnapshot();
    }

    /**
     * Clear freeze and resume the normal layout loop using existing helpers.
     * When reason is resume-layout:*, skip restarting the loop timer — the
     * existing /api/resume-layout handler owns refresh + loop restart.
     */
    function resumeLayoutFreeze(reason, options) {
        options = options || {};
        if (!layoutFreezeState.active && layoutFreezeState.timerId == null) {
            return { ok: true, resumed: false, reason: reason || 'not_frozen' };
        }
        var snapshot = getFreezeSnapshot();
        clearFreezeTimer();
        layoutFreezeState.active = false;
        layoutFreezeState.freezeUntil = null;
        layoutFreezeState.freezeStartedAt = null;

        var reasonStr = String(reason || 'manual');
        var restartLoop = options.restartLoop !== false &&
            reasonStr.indexOf('resume-layout:') !== 0;

        console.log(
            'Airport Display Freeze Resumed\n' +
            'Reason: ' + reasonStr + '\n' +
            'Previous layout: ' + (snapshot.layout_id || '') + '\n' +
            'Previous timeout: ' + snapshot.freeze_timeout + '\n' +
            'Restart loop: ' + restartLoop
        );
        reportStatus({
            status: 'freeze_resumed',
            phase: 'freeze',
            reason: reasonStr,
            previous_freeze: snapshot,
            message: 'Layout loop resume requested'
        });

        if (restartLoop) {
            try {
                if (typeof loopTimeoutPaused !== 'undefined') {
                    loopTimeoutPaused = false;
                }
                if (typeof restartLoopTimeoutForCurrentLayout === 'function') {
                    restartLoopTimeoutForCurrentLayout('airport-display freeze resumed: ' + reasonStr);
                } else if (typeof resumeLoopTimeout === 'function') {
                    resumeLoopTimeout('airport-display freeze resumed');
                }
            } catch (err) {
                console.warn('Airport Display freeze resume failed to restart loop:', err);
            }
        }
        return { ok: true, resumed: true, reason: reasonStr, previous_freeze: snapshot };
    }

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
        // Strip query/hash from URL-like refs before taking the leaf name.
        var cleaned = s.split(/[?#]/)[0];
        var n = Math.max(cleaned.lastIndexOf('/'), cleaned.lastIndexOf('\\'));
        return n === -1 ? cleaned : cleaned.substring(n + 1);
    }

    function guessMediaType(filename) {
        var ext = String(filename || '').split('.').pop().toLowerCase();
        if (['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv'].indexOf(ext) !== -1) return 'video';
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].indexOf(ext) !== -1) return 'image';
        if (['mp3', 'wav', 'aac', 'flac'].indexOf(ext) !== -1) return 'audio';
        return 'unknown';
    }

    /**
     * Same resource folder the Control Panel injects into replace-media:
     * ~/clessapp/res
     */
    function getMediaResFolder() {
        try {
            if (typeof config !== 'undefined' && config && config.resfolder) {
                return String(config.resfolder).replace(/[/\\]+$/, '');
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof homedir !== 'undefined' && homedir) {
                return String(homedir).replace(/[/\\]+$/, '') + '/clessapp/res';
            }
        } catch (e2) { /* ignore */ }
        try {
            if (typeof os !== 'undefined' && os && typeof os.homedir === 'function') {
                return String(os.homedir()).replace(/[/\\]+$/, '') + '/clessapp/res';
            }
        } catch (e3) { /* ignore */ }
        try {
            if (typeof require === 'function') {
                return String(require('os').homedir()).replace(/[/\\]+$/, '') + '/clessapp/res';
            }
        } catch (e4) { /* ignore */ }
        return '';
    }

    function isRemoteOrStreamRef(path) {
        return /^(https?:|file:|data:|rtsp:|rtmp:|udp:)/i.test(String(path || ''));
    }

    function isWebMediaPath(path) {
        var p = String(path || '').trim().replace(/\\/g, '/');
        if (!p || isRemoteOrStreamRef(p)) return false;
        if (p.indexOf('/') !== 0) return false;
        // Windows drive paths are not web media paths.
        if (/^[a-zA-Z]:[\\/]/.test(p)) return false;
        var first = p.replace(/^\/+/, '').split('/')[0].toLowerCase();
        return first === 'media' || first === 'static' || first === 'uploads' || first === 'airport';
    }

    function isAbsoluteFilesystemPath(path) {
        var p = String(path || '');
        if (isWebMediaPath(p)) return false;
        return p.indexOf('/') === 0 || p.indexOf('\\') === 0 || /^[a-zA-Z]:[\\/]/.test(p);
    }

    /**
     * @returns {boolean|null} true/false when fs is available, otherwise null (unknown).
     */
    function mediaFileExists(localPath) {
        if (!localPath || isRemoteOrStreamRef(localPath) || isWebMediaPath(localPath)) return null;
        try {
            if (typeof fs !== 'undefined' && fs && typeof fs.existsSync === 'function') {
                return !!fs.existsSync(localPath);
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function getHostServerOrigin() {
        try {
            if (typeof config !== 'undefined' && config && config.hostserver) {
                var raw = String(config.hostserver);
                var parts = raw.split('/');
                if (parts.length >= 3) {
                    return parts[0] + '//' + parts[2];
                }
                return raw.replace(/\/+$/, '');
            }
        } catch (e) { /* ignore */ }
        return '';
    }

    function getLayoutMediaPath() {
        try {
            if (typeof mediapath !== 'undefined' && mediapath != null) {
                return String(mediapath);
            }
        } catch (e) { /* ignore */ }
        return '';
    }

    function joinUrl(base, rel) {
        var b = String(base || '').replace(/\/+$/, '');
        var r = String(rel || '').replace(/^\/+/, '');
        if (!b) return r ? ('/' + r) : '';
        if (!r) return b;
        return b + '/' + r;
    }

    /**
     * Build a download URL for a missing local cache file.
     * Preference: explicit asset_url → remote url → hostserver + layout_path → hostserver + mediapath/filename.
     * Only absolute http(s) URLs are returned so the Player can fetch them.
     */
    function resolveDownloadUrl(item, source) {
        item = item || {};
        source = source || {};
        var origin = getHostServerOrigin();
        var candidates = [
            item.asset_url,
            item.url,
            item.download_url,
            item.contentUrl
        ];
        var i;
        for (i = 0; i < candidates.length; i++) {
            var c = String(candidates[i] || '').trim();
            if (!c) continue;
            if (isRemoteOrStreamRef(c)) return c;
            if (isWebMediaPath(c) && origin) {
                return joinUrl(origin, c);
            }
        }

        var layoutPath = String(item.layout_path || '').trim();
        var filename = (source && source.filename) || basename(item.filename || item.path || '');
        if (!origin) return '';

        if (layoutPath && !isAbsoluteFilesystemPath(layoutPath) && !isRemoteOrStreamRef(layoutPath)) {
            // Layout XML sources are usually "media/file.ext" relative to host origin
            // or mediapath. Prefer host + layout_path when it already includes media/.
            if (layoutPath.indexOf('media/') === 0 || layoutPath.indexOf('/media/') === 0) {
                return joinUrl(origin, layoutPath);
            }
            var mp = getLayoutMediaPath();
            if (mp) {
                return joinUrl(origin, joinUrl(mp, layoutPath));
            }
            return joinUrl(origin, layoutPath);
        }

        if (filename) {
            var mediap = getLayoutMediaPath();
            if (mediap) {
                return joinUrl(origin, joinUrl(mediap, filename));
            }
            return joinUrl(origin, 'media/' + filename);
        }
        return '';
    }

    function downloadMediaToCache(downloadUrl, localPath) {
        return new Promise(function (resolve) {
            if (!downloadUrl || !localPath) {
                resolve({ ok: false, error_code: 'MEDIA_DOWNLOAD_INVALID' });
                return;
            }
            console.log(
                'Airport Display media download\n' +
                'Resolved URL: ' + downloadUrl + '\n' +
                'Cache path: ' + localPath
            );
            try {
                if (typeof ipcRenderer !== 'undefined' && ipcRenderer && typeof ipcRenderer.invoke === 'function') {
                    ipcRenderer.invoke('app-downloadmedia', {
                        mediaURL: downloadUrl,
                        mediaPathSrc: localPath
                    }).then(function () {
                        var exists = mediaFileExists(localPath);
                        if (exists === false) {
                            console.warn(
                                'Airport Display Trigger Failed\n' +
                                'Reason: MEDIA_DOWNLOAD_FAILED\n' +
                                'Resolved URL: ' + downloadUrl + '\n' +
                                'Cache path: ' + localPath
                            );
                            resolve({ ok: false, error_code: 'MEDIA_DOWNLOAD_FAILED', url: downloadUrl, path: localPath });
                            return;
                        }
                        console.log(
                            'Airport Display media download complete\n' +
                            'Resolved URL: ' + downloadUrl + '\n' +
                            'Cache path: ' + localPath
                        );
                        resolve({ ok: true, url: downloadUrl, path: localPath });
                    }).catch(function (err) {
                        console.warn('Airport Display media download error:', err);
                        resolve({
                            ok: false,
                            error_code: 'MEDIA_DOWNLOAD_FAILED',
                            url: downloadUrl,
                            path: localPath,
                            message: String(err && err.message || err)
                        });
                    });
                    return;
                }
            } catch (e) {
                console.warn('Airport Display media download invoke failed:', e);
            }
            resolve({ ok: false, error_code: 'MEDIA_DOWNLOAD_UNAVAILABLE', url: downloadUrl, path: localPath });
        });
    }

    /**
     * Find a DOM / layout slot matching layout_id + slot_id (preferred) or slot_name.
     * Call only AFTER the target layout is active.
     */
    function resolveSlotTarget(slot) {
        var layoutId = slot.layout_id != null ? String(slot.layout_id) : '';
        var slotId = slot.slot_id != null ? String(slot.slot_id) : '';
        var slotName = slot.slot_name || '';
        var slotType = (slot.slot_type || 'text').toLowerCase();
        var numericFromId = slotId ? String(slotId).replace(/^slot-/, '') : '';

        // Primary identity: layout_id + slot_id against the live DOM.
        if (numericFromId && typeof $ !== 'undefined') {
            var $byId = $('#slot-' + numericFromId);
            if ($byId.length) {
                return {
                    ok: true,
                    numericId: numericFromId,
                    resolvedType: slotType,
                    layoutId: layoutId || getActiveLayoutId(),
                    via: 'dom-id'
                };
            }
        }

        // Prefer slotnameList entries that match BOTH layout_id and slot_name.
        if (typeof slotnameList !== 'undefined' && Array.isArray(slotnameList) && slotName) {
            try {
                var matched = null;
                for (var i = 0; i < slotnameList.length; i++) {
                    var entry = slotnameList[i];
                    if (!entry || entry.slotname !== slotName) continue;
                    if (layoutId && entry.layoutid && String(entry.layoutid) !== layoutId) continue;
                    matched = entry;
                    break;
                }
                if (matched && matched.slotid) {
                    return {
                        ok: true,
                        numericId: String(matched.slotid).split('-').pop(),
                        resolvedType: matched.slottype || slotType,
                        layoutId: matched.layoutid || layoutId,
                        via: 'slotnameList'
                    };
                }
            } catch (err) {
                console.warn('Airport Display slotnameList lookup failed:', err);
            }
        }

        if (typeof getCurrentLayoutID === 'function' && typeof slotnameList !== 'undefined' && slotName) {
            try {
                var info = getCurrentLayoutID(slotName, slotnameList);
                if (info && info.slotid) {
                    if (layoutId && info.layoutid && String(info.layoutid) !== layoutId) {
                        // Name exists on another layout — do not use it.
                    } else {
                        return {
                            ok: true,
                            numericId: String(info.slotid).split('-').pop(),
                            resolvedType: info.slottype || slotType,
                            layoutId: info.layoutid || layoutId,
                            via: 'slotnameList'
                        };
                    }
                }
            } catch (err2) {
                console.warn('Airport Display getCurrentLayoutID failed:', err2);
            }
        }

        if (slotName && typeof $ !== 'undefined') {
            var $byName = $('[data-slotname="' + slotName + '"]');
            if ($byName.length) {
                var idAttr = $byName.attr('id') || '';
                var num = idAttr.indexOf('slot-') === 0 ? idAttr.slice(5) : numericFromId;
                return {
                    ok: true,
                    numericId: num,
                    resolvedType: slotType,
                    layoutId: layoutId || getActiveLayoutId(),
                    via: 'dom-name',
                    $el: $byName
                };
            }
        }

        return {
            ok: false,
            error_code: 'SLOT_NOT_FOUND',
            message: 'Slot not found' + (layoutId ? (' in layout ' + layoutId) : '') +
                (slotName ? (': ' + slotName) : (slotId ? (': #' + slotId) : ''))
        };
    }

    function getActiveLayoutId() {
        try {
            if (typeof currentPlayLayoutID !== 'undefined' && currentPlayLayoutID) {
                return String(currentPlayLayoutID);
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof currentlytID !== 'undefined' && currentlytID) {
                return String(currentlytID);
            }
        } catch (e2) { /* ignore */ }
        try {
            var stored = localStorage.getItem('currentPlayLayoutID');
            if (stored) return String(stored);
        } catch (e3) { /* ignore */ }
        return '';
    }

    function waitForSlotDom(slot, attemptsLeft) {
        return new Promise(function (resolve) {
            var left = attemptsLeft == null ? 20 : attemptsLeft;
            var target = resolveSlotTarget(slot);
            if (target.ok) {
                resolve(target);
                return;
            }
            if (left <= 0) {
                resolve(target);
                return;
            }
            setTimeout(function () {
                waitForSlotDom(slot, left - 1).then(resolve);
            }, 50);
        });
    }

    /**
     * Switch to the target layout using the same Control Panel helpers, then
     * wait until the layout is active before slot updates.
     *
     * Order is mandatory:
     *   Switch Layout → Confirm Active → Update Slot
     */
    function ensureLayoutActive(layoutId, meta) {
        meta = meta || {};
        var targetId = layoutId != null ? String(layoutId) : '';
        if (!targetId) {
            return Promise.resolve({
                ok: false,
                error_code: 'LAYOUT_ID_MISSING',
                message: 'layout_id is required for Airport Display triggers'
            });
        }

        var activeId = getActiveLayoutId();
        if (activeId && String(activeId) === targetId) {
            console.log(
                'Airport Display Layout\n' +
                'Target: ' + targetId + '\n' +
                'Status: ALREADY_ACTIVE\n' +
                'Slot: ' + (meta.slot_name || meta.slot_id || '')
            );
            return Promise.resolve({
                ok: true,
                switched: false,
                layout_id: targetId,
                via: 'already-active'
            });
        }

        console.log(
            'Airport Display Layout Switch\n' +
            'From: ' + (activeId || '(unknown)') + '\n' +
            'To: ' + targetId + '\n' +
            'Slot: ' + (meta.slot_name || meta.slot_id || '') + '\n' +
            'Loop: ' + !!(typeof isLoopLyt !== 'undefined' && isLoopLyt)
        );

        return new Promise(function (resolve) {
            var finished = false;
            var done = function (result) {
                if (finished) return;
                finished = true;
                resolve(result);
            };

            var onSwitched = function (success, message) {
                if (!success) {
                    console.warn(
                        'Airport Display Layout Switch Failed\n' +
                        'Layout: ' + targetId + '\n' +
                        'Reason: ' + (message || 'LAYOUT_SWITCH_FAILED')
                    );
                    done({
                        ok: false,
                        error_code: 'LAYOUT_SWITCH_FAILED',
                        message: String(message || 'Layout switch failed'),
                        layout_id: targetId
                    });
                    return;
                }
                // Confirm authoritative active layout id
                if (typeof syncCurrentPlayLayoutID === 'function') {
                    syncCurrentPlayLayoutID(targetId);
                }
                try { currentlytID = targetId; } catch (e) { /* ignore */ }

                // Brief settle so getLayoutXML can append slots before we update.
                setTimeout(function () {
                    var nowActive = getActiveLayoutId();
                    if (nowActive && String(nowActive) !== targetId) {
                        console.warn(
                            'Airport Display Layout Switch Failed\n' +
                            'Layout: ' + targetId + '\n' +
                            'Reason: LAYOUT_NOT_ACTIVE\n' +
                            'Active: ' + nowActive
                        );
                        done({
                            ok: false,
                            error_code: 'LAYOUT_NOT_ACTIVE',
                            message: 'Layout switch did not activate target layout',
                            layout_id: targetId,
                            active_layout_id: nowActive
                        });
                        return;
                    }
                    console.log(
                        'Airport Display Layout Switch\n' +
                        'Layout: ' + targetId + '\n' +
                        'Player Response: SUCCESS'
                    );
                    done({
                        ok: true,
                        switched: true,
                        layout_id: targetId,
                        via: (typeof isLoopLyt !== 'undefined' && isLoopLyt)
                            ? 'switchToLayoutTemporarilyInLoop'
                            : 'switchToLayoutOffline'
                    });
                }, 150);
            };

            try {
                if (typeof isLoopLyt !== 'undefined' && isLoopLyt &&
                    typeof switchToLayoutTemporarilyInLoop === 'function') {
                    switchToLayoutTemporarilyInLoop(targetId, onSwitched);
                    return;
                }
                if (typeof switchToLayoutOffline === 'function') {
                    switchToLayoutOffline(targetId, onSwitched, false);
                    return;
                }
                done({
                    ok: false,
                    error_code: 'LAYOUT_SWITCH_UNAVAILABLE',
                    message: 'No layout switch helper is available on the Player'
                });
            } catch (err) {
                done({
                    ok: false,
                    error_code: 'LAYOUT_SWITCH_FAILED',
                    message: String(err && err.message || err)
                });
            }
        });
    }

    function enqueueLayoutTransition(taskFn) {
        layoutTransitionQueue = layoutTransitionQueue.then(function () {
            layoutTransitionBusy = true;
            return Promise.resolve()
                .then(taskFn)
                .catch(function (err) {
                    console.warn('Airport Display layout transition task failed:', err);
                    return { ok: false, error_code: 'LAYOUT_TRANSITION_FAILED', message: String(err && err.message || err) };
                })
                .then(function (result) {
                    layoutTransitionBusy = false;
                    return result;
                });
        });
        return layoutTransitionQueue;
    }

    /**
     * Resolve media the same way as Control Panel replace-media:
     *   contentUrl = ~/clessapp/res/<basename>
     *
     * Layout discovery often returns relative paths like "media/Welcome.mp4".
     * Those must NOT be used as DOM src values — they are layout XML sources,
     * not filesystem URLs. Always map local relative refs to the res cache.
     * Remote asset_url values are download sources, not playback paths.
     */
    function resolveMediaSource(itemOrFilename) {
        var item = itemOrFilename;
        if (typeof itemOrFilename === 'string') {
            item = { filename: itemOrFilename, path: itemOrFilename };
        }
        item = item || {};
        var path = String(
            item.path || item.file_path || item.contentUrl || ''
        ).trim();
        // asset_url / url may be downloadable HTTP(S) or /media/... refs — only
        // use them as the playback path when they are true remote/stream refs.
        var assetUrl = String(item.asset_url || item.url || '').trim();
        if ((!path || path === item.filename) && assetUrl && isRemoteOrStreamRef(assetUrl)) {
            // Keep local basename playback when possible; remote-only media plays directly.
            if (!item.filename && !item.path) {
                path = assetUrl;
            }
        }
        if (!path) {
            path = String(item.layout_path || assetUrl || '').trim();
        }
        var filename = basename(item.filename || item.value || item.name || path || '');
        if (!filename && path) {
            filename = basename(path);
        }
        if (!filename && !path) {
            return null;
        }

        var resfolder = getMediaResFolder();
        var mediaLocalPath = '';
        var resolution = 'unresolved';

        if (path && isRemoteOrStreamRef(path)) {
            mediaLocalPath = path;
            resolution = 'remote';
        } else if (path && isWebMediaPath(path)) {
            // /media/foo.jpg is a server URL path, not a local file.
            if (resfolder && filename) {
                mediaLocalPath = resfolder + '/' + filename;
                resolution = 'webpath-resfolder';
            } else {
                mediaLocalPath = filename || path;
                resolution = 'webpath-basename';
            }
        } else if (path && isAbsoluteFilesystemPath(path)) {
            var absExists = mediaFileExists(path);
            if (absExists === false && resfolder && filename) {
                mediaLocalPath = resfolder + '/' + filename;
                resolution = 'absolute-fallback-resfolder';
            } else if (absExists == null && resfolder && filename && !isAbsoluteFilesystemPath(filename)) {
                // fs unavailable: prefer res cache over opaque absolute paths
                mediaLocalPath = resfolder + '/' + filename;
                resolution = 'absolute-unknown-resfolder';
            } else {
                mediaLocalPath = path;
                resolution = 'absolute';
            }
        } else if (resfolder && filename) {
            // Bare filename OR relative layout path (e.g. media/foo.jpg)
            mediaLocalPath = resfolder + '/' + filename;
            resolution = 'resfolder';
        } else if (filename) {
            mediaLocalPath = filename;
            resolution = 'basename-only';
        } else {
            mediaLocalPath = path;
            resolution = 'raw-path';
        }

        console.log('Airport Display media resolve', {
            filename: filename || basename(mediaLocalPath),
            input_path: path,
            asset_url: assetUrl || null,
            resolved_url: mediaLocalPath,
            resfolder: resfolder || null,
            resolution: resolution
        });

        return {
            filename: filename || basename(mediaLocalPath),
            mediaLocalPath: mediaLocalPath,
            duration: item.duration != null && item.duration !== '' ? Number(item.duration) : 0,
            type: item.type || item.content_type || '',
            resolution: resolution,
            resfolder: resfolder,
            assetUrl: assetUrl || null,
            layoutPath: item.layout_path || null
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

    function attachMediaLoadGuard(numericId, $slot, snapshot, contentObj, meta) {
        if (!$slot || !$slot.length || !contentObj) return;
        meta = meta || {};
        try {
            if (contentObj.mediaType === 'IMAGE') {
                var $img = $slot.find('img').first();
                if (!$img.length) return;
                $img.on('error.airportDisplayMedia', function () {
                    console.warn(
                        'Airport Display Trigger Failed\n' +
                        'Media ID: ' + (meta.media_id || '') + '\n' +
                        'Filename: ' + (contentObj.filename || '') + '\n' +
                        'Reason: MEDIA_LOAD_FAILED\n' +
                        'Resolved URL: ' + (contentObj.contentUrl || '') + '\n' +
                        'Keeping previous slot content.'
                    );
                    restoreMediaSlot(numericId, $slot, snapshot);
                    reportStatus({
                        status: 'failed',
                        phase: 'media',
                        slot_id: numericId,
                        error_code: 'MEDIA_LOAD_FAILED',
                        filenames: contentObj.filename ? [contentObj.filename] : [],
                        content_url: contentObj.contentUrl || '',
                        message: 'Image failed to load; previous content preserved'
                    });
                });
            } else if (contentObj.mediaType === 'VIDEO') {
                var $video = $slot.find('video').first();
                if (!$video.length) return;
                $video.on('error.airportDisplayMedia', function () {
                    console.warn(
                        'Airport Display Trigger Failed\n' +
                        'Filename: ' + (contentObj.filename || '') + '\n' +
                        'Reason: MEDIA_LOAD_FAILED\n' +
                        'Resolved URL: ' + (contentObj.contentUrl || '') + '\n' +
                        'Keeping previous slot content.'
                    );
                    restoreMediaSlot(numericId, $slot, snapshot);
                    reportStatus({
                        status: 'failed',
                        phase: 'media',
                        slot_id: numericId,
                        error_code: 'MEDIA_LOAD_FAILED',
                        filenames: contentObj.filename ? [contentObj.filename] : [],
                        content_url: contentObj.contentUrl || '',
                        message: 'Video failed to load; previous content preserved'
                    });
                });
            }
        } catch (err) {
            console.warn('Airport Display media load guard attach failed:', err);
        }
    }

    /**
     * Temporary media trigger: rewrite runtime medialoop only.
     * Does NOT write localStorage layout / permanent playlist configuration.
     * Existing content is kept when the replacement cannot be validated.
     * Missing cache files are downloaded from asset_url / hostserver when possible.
     */
    function applyTemporaryMedia(slot, target) {
        var numericId = String(target.numericId);
        var mode = String(slot.media_mode || 'selected').toLowerCase();
        var selectedItems = collectMediaTriggerItems(slot);
        if (!selectedItems.length) {
            console.warn(
                'Airport Display Trigger Failed\n' +
                'Slot: ' + (slot.slot_name || numericId) + '\n' +
                'Reason: MEDIA_VALUE_MISSING'
            );
            reportStatus({
                status: 'failed',
                phase: 'media',
                slot_id: numericId,
                error_code: 'MEDIA_VALUE_MISSING',
                message: 'No media filename selected for trigger'
            });
            return Promise.resolve({
                ok: false,
                error_code: 'MEDIA_VALUE_MISSING',
                message: 'No media filename selected for trigger'
            });
        }

        var prepareChain = Promise.resolve();
        var prepared = [];
        var missing = [];

        selectedItems.forEach(function (it) {
            prepareChain = prepareChain.then(function () {
                var obj = buildMediaContentObj(it);
                if (!obj || !obj.contentUrl || !obj.mediaType || obj.mediaType === 'UNKNOWN') {
                    console.warn('Airport Display skipped invalid media item:', it);
                    return;
                }
                if (isRemoteOrStreamRef(obj.contentUrl)) {
                    prepared.push({ obj: obj, item: it });
                    return;
                }
                var exists = mediaFileExists(obj.contentUrl);
                if (exists === false) {
                    var source = resolveMediaSource(it) || {};
                    var downloadUrl = resolveDownloadUrl(it, source);
                    if (!downloadUrl) {
                        missing.push({
                            filename: obj.filename || basename(obj.contentUrl),
                            content_url: obj.contentUrl,
                            media_id: it && it.id || '',
                            reason: 'MEDIA_NOT_FOUND'
                        });
                        console.warn(
                            'Airport Display Trigger Failed\n' +
                            'Media ID: ' + (it && it.id || '') + '\n' +
                            'Filename: ' + (obj.filename || '') + '\n' +
                            'Reason: MEDIA_NOT_FOUND\n' +
                            'Resolved URL: ' + obj.contentUrl
                        );
                        return;
                    }
                    return downloadMediaToCache(downloadUrl, obj.contentUrl).then(function (dl) {
                        if (!dl || !dl.ok) {
                            missing.push({
                                filename: obj.filename || basename(obj.contentUrl),
                                content_url: obj.contentUrl,
                                download_url: downloadUrl,
                                media_id: it && it.id || '',
                                reason: (dl && dl.error_code) || 'MEDIA_DOWNLOAD_FAILED'
                            });
                            console.warn(
                                'Airport Display Trigger Failed\n' +
                                'Media ID: ' + (it && it.id || '') + '\n' +
                                'Filename: ' + (obj.filename || '') + '\n' +
                                'Reason: ' + ((dl && dl.error_code) || 'MEDIA_DOWNLOAD_FAILED') + '\n' +
                                'Resolved URL: ' + downloadUrl
                            );
                            return;
                        }
                        prepared.push({ obj: obj, item: it, downloaded: true, download_url: downloadUrl });
                    });
                }
                prepared.push({ obj: obj, item: it });
            });
        });

        return prepareChain.then(function () {
            var contentObjs = prepared.map(function (row) { return row.obj; });
            var filenames = contentObjs.map(function (obj) {
                return obj.filename || basename(obj.contentUrl);
            });
            if (!contentObjs.length) {
                var reason = missing.length
                    ? (missing[0].reason || 'MEDIA_NOT_FOUND')
                    : 'MEDIA_BUILD_FAILED';
                console.warn(
                    'Airport Display Trigger Failed\n' +
                    'Slot: ' + (slot.slot_name || numericId) + '\n' +
                    'Reason: ' + reason + '\n' +
                    'Keeping previous slot content.'
                );
                reportStatus({
                    status: 'failed',
                    phase: 'media',
                    slot_id: numericId,
                    error_code: reason,
                    missing: missing,
                    message: reason === 'MEDIA_NOT_FOUND' || reason === 'MEDIA_DOWNLOAD_FAILED'
                        ? 'Media unavailable; previous content preserved'
                        : 'Unable to build media content objects from payload'
                });
                return {
                    ok: false,
                    error_code: reason,
                    message: 'Media update rejected; previous content preserved'
                };
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
                    attachMediaLoadGuard(numericId, $slot, snapshot, contentObjs[0], {
                        media_id: selectedItems[0] && selectedItems[0].id || ''
                    });
                    console.log(
                        'Airport Display Trigger\n' +
                        'Zone: ' + (slot.zone_name || '') + '\n' +
                        'Layout: ' + (slot.layout_name || target.layoutId || '') + '\n' +
                        'Slot: ' + (slot.slot_name || numericId) + '\n' +
                        'Media ID: ' + (selectedItems[0] && selectedItems[0].id || '') + '\n' +
                        'Filename: ' + (filenames[0] || '') + '\n' +
                        'Resolved URL: ' + (contentObjs[0].contentUrl || '') + '\n' +
                        'Downloaded: ' + !!(prepared[0] && prepared[0].downloaded) + '\n' +
                        'Player Response: SUCCESS'
                    );
                    reportStatus({
                        status: 'media_trigger',
                        phase: 'media',
                        slot_id: numericId,
                        media_mode: mode,
                        filenames: filenames,
                        content_url: contentObjs[0].contentUrl,
                        downloaded: !!(prepared[0] && prepared[0].downloaded),
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
                        content_url: contentObjs[0].contentUrl,
                        downloaded: !!(prepared[0] && prepared[0].downloaded),
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
                    attachMediaLoadGuard(numericId, $slot, snapshot, first, {
                        media_id: selectedItems[0] && selectedItems[0].id || ''
                    });
                    return {
                        ok: true,
                        via: 'media-dom-temporary',
                        layout_id: target.layoutId,
                        slot_id: numericId,
                        media_mode: mode,
                        filenames: filenames,
                        content_url: first.contentUrl,
                        downloaded: !!(prepared[0] && prepared[0].downloaded),
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
        });
    }

    function applySlotUpdate(slot) {
        if (!slot) {
            return Promise.resolve({ ok: false, error_code: 'INVALID_SLOT', message: 'Missing slot payload' });
        }
        var value = slot.value == null ? '' : String(slot.value);
        var slotType = (slot.slot_type || 'text').toLowerCase();
        var layoutId = slot.layout_id != null ? String(slot.layout_id) : '';

        if (!layoutId) {
            return Promise.resolve({
                ok: false,
                error_code: 'LAYOUT_ID_MISSING',
                message: 'layout_id is required; slot_name alone is not unique across layouts'
            });
        }

        return ensureLayoutActive(layoutId, {
            slot_id: slot.slot_id,
            slot_name: slot.slot_name
        }).then(function (layoutResult) {
            if (!layoutResult || !layoutResult.ok) {
                return layoutResult || {
                    ok: false,
                    error_code: 'LAYOUT_SWITCH_FAILED',
                    message: 'Unable to activate target layout'
                };
            }

            return waitForSlotDom(slot).then(function (target) {
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
                        return Promise.resolve(applyTemporaryMedia(slot, target)).then(function (r) {
                            if (r && typeof r === 'object') {
                                r.layout_switched = !!layoutResult.switched;
                                r.layout_id = layoutId;
                            }
                            return r;
                        });
                    }

                    if (typeof updateTextSlotContent === 'function' && target.numericId) {
                        updateTextSlotContent(
                            target.numericId,
                            target.resolvedType || slotType,
                            value,
                            layoutId
                        );
                        return {
                            ok: true,
                            via: 'updateTextSlotContent',
                            layout_id: layoutId,
                            slot_id: target.numericId,
                            layout_switched: !!layoutResult.switched
                        };
                    }

                    var $el = target.$el || (typeof $ !== 'undefined' ? $('#slot-' + target.numericId) : null);
                    if ($el && $el.length) {
                        $el.html(value);
                        return {
                            ok: true,
                            via: 'dom-html',
                            layout_id: layoutId,
                            slot_id: target.numericId,
                            layout_switched: !!layoutResult.switched
                        };
                    }
                } catch (err) {
                    return {
                        ok: false,
                        error_code: 'APPLY_FAILED',
                        message: String(err && err.message || err)
                    };
                }

                return {
                    ok: false,
                    error_code: 'UNSUPPORTED_SLOT_TYPE',
                    message: 'Unable to apply slot update'
                };
            });
        });
    }

    function groupSlotsByLayout(slots) {
        var groups = [];
        var indexByLayout = {};
        (slots || []).forEach(function (slot) {
            var key = slot && slot.layout_id != null ? String(slot.layout_id) : '';
            if (!Object.prototype.hasOwnProperty.call(indexByLayout, key)) {
                indexByLayout[key] = groups.length;
                groups.push({ layout_id: key, slots: [] });
            }
            groups[indexByLayout[key]].slots.push(slot);
        });
        return groups;
    }

    function applySlots(event) {
        var slots = event.slots || [];
        var results = [];
        var groups = groupSlotsByLayout(slots);

        return enqueueLayoutTransition(function () {
            var chain = Promise.resolve();
            groups.forEach(function (group) {
                chain = chain.then(function () {
                    var slotChain = Promise.resolve();
                    group.slots.forEach(function (slot) {
                        slotChain = slotChain.then(function () {
                            return applySlotUpdate(slot).then(function (r) {
                                results.push({
                                    layout_id: slot.layout_id || null,
                                    layout_name: slot.layout_name || '',
                                    slot_id: slot.slot_id || null,
                                    slot_name: slot.slot_name || '',
                                    slot_type: slot.slot_type || '',
                                    ok: !!(r && r.ok),
                                    error_code: r && r.error_code || null,
                                    message: r && r.message || (r && r.ok ? 'OK' : 'Failed'),
                                    via: r && r.via || null,
                                    media_mode: r && r.media_mode || null,
                                    temporary: !!(r && r.temporary),
                                    downloaded: !!(r && r.downloaded),
                                    layout_switched: !!(r && r.layout_switched)
                                });
                            });
                        });
                    });
                    return slotChain.then(function () {
                        // Do NOT restart the layout loop here — freeze activation
                        // (or an explicit resume) owns loop timer lifecycle.
                    });
                });
            });
            return chain.then(function () { return results; });
        });
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

    function normalizeAnnouncementRepeat(raw) {
        if (raw == null || raw === '') {
            return 1;
        }
        var n = Number(raw);
        if (!isFinite(n)) {
            console.warn('Airport Display invalid announcement.repeat; defaulting to 1:', raw);
            return 1;
        }
        n = Math.floor(n);
        if (n < 1) {
            return 1;
        }
        if (n > 9) {
            console.warn('Airport Display announcement.repeat capped at 9:', raw);
            return 9;
        }
        return n;
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
        var repeat = normalizeAnnouncementRepeat(ann.repeat);
        // Keep languages that have no audio so they are reported in order,
        // while the playable languages still play around them.
        announcementQueue.push({
            event_id: event.event_id,
            text: ann.text || '',
            languages: languages,
            repeat: repeat
        });
        console.log(
            'Airport Display Announcement Queued\n' +
            'Event ID: ' + (event.event_id || '') + '\n' +
            'Languages: ' + languages.length + '\n' +
            'Repeat (total plays): ' + repeat + '\n' +
            'Freeze timeout: ' + (event.freeze_timeout != null ? event.freeze_timeout : '(default)')
        );
        reportStatus({
            event_id: event.event_id,
            status: 'queued',
            phase: 'announcement',
            repeat: repeat,
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
        var totalRepeat = normalizeAnnouncementRepeat(job && job.repeat);
        var allResults = [];
        var chain = Promise.resolve();
        var passIndex = 0;

        function playOnePass(passNumber) {
            var results = [];
            var passChain = Promise.resolve();
            console.log(
                'Airport Display Announcement Repeat\n' +
                'Event ID: ' + (job.event_id || '') + '\n' +
                'Current repetition: ' + passNumber + '\n' +
                'Total repetitions: ' + totalRepeat
            );
            reportStatus({
                event_id: job.event_id,
                status: 'repeat_pass',
                phase: 'announcement',
                current_repetition: passNumber,
                total_repetitions: totalRepeat,
                message: 'Announcement pass ' + passNumber + ' of ' + totalRepeat
            });
            (job.languages || []).forEach(function (lang) {
                passChain = passChain.then(function () {
                    if (!lang.audio_url) {
                        results.push({
                            language: lang.language,
                            order: lang.order,
                            ok: false,
                            error_code: 'AUDIO_URL_MISSING',
                            repetition: passNumber
                        });
                        reportStatus({
                            event_id: job.event_id,
                            status: 'language_failed',
                            phase: 'announcement',
                            language: lang.language,
                            order: lang.order,
                            repetition: passNumber,
                            total_repetitions: totalRepeat,
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
                        repetition: passNumber,
                        total_repetitions: totalRepeat,
                        message: 'Playing ' + lang.language + ' (pass ' + passNumber + '/' + totalRepeat + ')'
                    });
                    // Reuse the same cached/generated audio_url for each repetition.
                    return playAudioUrl(lang.audio_url).then(function (ok) {
                        results.push({
                            language: lang.language,
                            order: lang.order,
                            ok: !!ok,
                            error_code: ok ? null : 'AUDIO_PLAYBACK_FAILED',
                            repetition: passNumber
                        });
                        reportStatus({
                            event_id: job.event_id,
                            status: ok ? 'language_completed' : 'language_failed',
                            phase: 'announcement',
                            language: lang.language,
                            order: lang.order,
                            repetition: passNumber,
                            total_repetitions: totalRepeat,
                            error_code: ok ? null : 'AUDIO_PLAYBACK_FAILED'
                        });
                        return ok;
                    });
                });
            });
            return passChain.then(function () {
                allResults = allResults.concat(results);
                return results;
            });
        }

        for (passIndex = 1; passIndex <= totalRepeat; passIndex++) {
            (function (n) {
                chain = chain.then(function () {
                    return playOnePass(n);
                });
            })(passIndex);
        }

        return chain.then(function () {
            var played = allResults.filter(function (r) { return r.ok; }).length;
            var failed = allResults.length - played;
            return {
                played: played,
                failed: failed,
                results: allResults,
                repeat: totalRepeat
            };
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

        return Promise.resolve()
            .then(function () {
                return applySlots(event);
            })
            .then(function (slotResults) {
                var failed = slotResults.filter(function (r) { return !r.ok; });
                var anyOk = slotResults.some(function (r) { return r.ok; });
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

                var freezeSnapshot = null;
                // Freeze only after at least one slot successfully updated on the
                // active layout (or when announcement-only with no slots).
                if (anyOk || (!slotResults.length && event.announcement && event.announcement.enabled)) {
                    var primaryLayout = '';
                    for (var i = 0; i < slotResults.length; i++) {
                        if (slotResults[i].ok && slotResults[i].layout_id) {
                            primaryLayout = String(slotResults[i].layout_id);
                            break;
                        }
                    }
                    if (!primaryLayout && event.slots && event.slots[0]) {
                        primaryLayout = String(event.slots[0].layout_id || '');
                    }
                    freezeSnapshot = activateLayoutFreeze({
                        freeze_timeout: event.freeze_timeout,
                        triggered_by: event.source || event.event || 'airport_display',
                        event_id: eventId,
                        layout_id: primaryLayout || getActiveLayoutId()
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
                    slots: slotResults,
                    freeze: freezeSnapshot
                };
            })
            .catch(function (err) {
                reportStatus({
                    event_id: eventId,
                    status: 'failed',
                    error_code: 'SLOT_APPLY_FAILED',
                    message: String(err && err.message || err)
                });
                return { status: 'error', error_code: 'SLOT_APPLY_FAILED', event_id: eventId };
            });
    }

    global.AirportDisplayPlayer = {
        handle: handleAirportDisplayEvent,
        getQueueLength: function () { return announcementQueue.length + (isPlaying ? 1 : 0); },
        isFrozen: isLayoutFrozen,
        getFreezeState: getFreezeSnapshot,
        activateFreeze: activateLayoutFreeze,
        resumeFreeze: resumeLayoutFreeze,
        normalizeFreezeTimeout: normalizeFreezeTimeout,
        normalizeAnnouncementRepeat: normalizeAnnouncementRepeat,
        FREEZE_PRESETS: FREEZE_PRESETS.slice(),
        _normalizeAnnouncementLanguages: normalizeAnnouncementLanguages,
        _playLanguageSequence: playLanguageSequence,
        _guessMediaType: guessMediaType,
        _resolveMediaSource: resolveMediaSource,
        _getMediaResFolder: getMediaResFolder,
        _buildMediaContentObj: buildMediaContentObj,
        _collectMediaTriggerItems: collectMediaTriggerItems,
        _applyTemporaryMedia: applyTemporaryMedia,
        _resolveDownloadUrl: resolveDownloadUrl,
        _isWebMediaPath: isWebMediaPath,
        _ensureLayoutActive: ensureLayoutActive,
        _getActiveLayoutId: getActiveLayoutId,
        _resolveSlotTarget: resolveSlotTarget,
        _groupSlotsByLayout: groupSlotsByLayout,
        _isLayoutTransitionBusy: function () { return !!layoutTransitionBusy; }
    };
})(window);
