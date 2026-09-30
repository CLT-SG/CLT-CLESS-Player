/**
 * Centralized monitoring / auto-refresh service for the Control Panel.
 *
 * Single scheduler with fast / medium / slow tiers, section awareness,
 * and reduced polling when the browser tab is hidden.
 */
(function (window, document) {
    'use strict';

    window.__CLESS_USE_MONITORING_SERVICE = true;

    var TICK_MS = 1000;
    var HIDDEN_MULTIPLIER = 4;

    var jobs = {};
    var lastUpdated = {};
    var inFlight = {};
    var subscribers = [];
    var activeSection = 'dashboard';
    var tickTimer = null;
    var started = false;
    var lastUiStamp = 0;

    function now() {
        return Date.now();
    }

    function getActiveSection() {
        var el = document.querySelector('.spa-section.is-active');
        if (!el || !el.id) return activeSection;
        return String(el.id).replace(/^section-/, '') || activeSection;
    }

    function sectionMatches(job) {
        var sections = job.sections || ['*'];
        if (sections.indexOf('*') >= 0) return true;
        var current = getActiveSection();
        return sections.indexOf(current) >= 0;
    }

    function effectiveInterval(job) {
        var base = job.intervalMs || 10000;
        if (document.hidden) {
            return job.hiddenIntervalMs || Math.max(base * HIDDEN_MULTIPLIER, base + 15000);
        }
        return base;
    }

    function safeRun(jobId, job, reason) {
        if (!job || typeof job.run !== 'function') return;
        if (inFlight[jobId]) return;
        if (!sectionMatches(job) && reason !== 'manual' && reason !== 'bootstrap') return;

        inFlight[jobId] = true;
        job.lastStarted = now();
        try {
            var result = job.run(reason || 'auto');
            if (result && typeof result.then === 'function') {
                result.then(function () {
                    markSuccess(jobId);
                }).catch(function () {
                    markDone(jobId, false);
                });
            } else {
                markSuccess(jobId);
            }
        } catch (err) {
            console.warn('[MonitoringService] job failed:', jobId, err);
            markDone(jobId, false);
        }
    }

    function markSuccess(jobId) {
        lastUpdated[jobId] = now();
        lastUpdated._any = lastUpdated[jobId];
        markDone(jobId, true);
        notify({ type: 'updated', jobId: jobId, at: lastUpdated[jobId] });
        updateLastUpdatedUi();
    }

    function markDone(jobId, ok) {
        inFlight[jobId] = false;
        var job = jobs[jobId];
        if (job) {
            job.lastFinished = now();
            job.lastOk = !!ok;
            // Keep existing data visible; schedule next poll without forcing UI clears
            job.nextDue = now() + effectiveInterval(job);
        }
    }

    // Patch monitor AJAX success to bump last-updated even when jobs finish early
    function patchAjaxTimestamp() {
        if (!window.jQuery || window.jQuery.__clessMonitoringPatched) return;
        window.jQuery.__clessMonitoringPatched = true;
        window.jQuery(document).ajaxSuccess(function (_e, _xhr, settings) {
            var url = (settings && settings.url) || '';
            if (/\/api\/(system\/monitor|deviceinfo|layout-details|airport-display\/freeze)/.test(url) ||
                /\/api\/.*license|network/i.test(url)) {
                lastUpdated._any = now();
                updateLastUpdatedUi();
            }
        });
    }

    function notify(event) {
        subscribers.forEach(function (cb) {
            try { cb(event); } catch (err) { /* ignore */ }
        });
    }

    function formatAgo(ts) {
        if (!ts) return 'Never';
        var sec = Math.max(0, Math.round((now() - ts) / 1000));
        if (sec < 3) return 'Just now';
        if (sec < 60) return sec + 's ago';
        var min = Math.floor(sec / 60);
        if (min < 60) return min + 'm ago';
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function formatClock(ts) {
        if (!ts) return '—';
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function updateLastUpdatedUi() {
        // Throttle DOM writes
        var t = now();
        if (t - lastUiStamp < 400) return;
        lastUiStamp = t;

        var stamp = lastUpdated._any;
        var ago = formatAgo(stamp);
        var clock = formatClock(stamp);
        var nodes = document.querySelectorAll('[data-monitoring-updated]');
        nodes.forEach(function (el) {
            var mode = el.getAttribute('data-monitoring-updated') || 'ago';
            if (mode === 'clock') el.textContent = 'Last Updated: ' + clock;
            else if (mode === 'both') el.textContent = 'Last Updated: ' + clock + ' (' + ago + ')';
            else el.textContent = 'Updated ' + ago;
        });

        var live = document.getElementById('monitoringLiveBadge');
        if (live) {
            if (document.hidden) {
                live.textContent = 'Paused (tab hidden)';
                live.className = 'monitoring-live-badge is-paused';
            } else {
                live.textContent = 'Auto-refresh on';
                live.className = 'monitoring-live-badge is-live';
            }
        }
    }

    function register(job) {
        if (!job || !job.id) return;
        var existing = jobs[job.id] || {};
        jobs[job.id] = Object.assign({}, existing, job, {
            nextDue: existing.nextDue || 0,
            lastStarted: existing.lastStarted || 0,
            lastFinished: existing.lastFinished || 0
        });
    }

    function callIfFn(name) {
        var fn = window[name];
        if (typeof fn === 'function') {
            fn();
            return true;
        }
        return false;
    }

    function registerBuiltIns() {
        register({
            id: 'playback',
            tier: 'fast',
            intervalMs: 5000,
            hiddenIntervalMs: 30000,
            sections: ['dashboard', 'device', 'layout', 'airport'],
            run: function () {
                if (typeof window.refreshLayoutDetails === 'function') window.refreshLayoutDetails();
                else if (typeof window.getDetailedLayoutInfo === 'function') window.getDetailedLayoutInfo();
                if (typeof window.refreshFreezeStateHint === 'function') window.refreshFreezeStateHint();
            }
        });

        register({
            id: 'system',
            tier: 'medium',
            intervalMs: 5000,
            hiddenIntervalMs: 30000,
            sections: ['dashboard', 'device'],
            run: function () {
                callIfFn('refreshSystemMonitoring');
                callIfFn('refreshSystemStats');
            }
        });

        register({
            id: 'deviceinfo',
            tier: 'medium',
            intervalMs: 10000,
            hiddenIntervalMs: 45000,
            sections: ['dashboard', 'device'],
            run: function () {
                callIfFn('deviceinfo');
            }
        });

        register({
            id: 'networkLicense',
            tier: 'slow',
            intervalMs: 30000,
            hiddenIntervalMs: 120000,
            sections: ['dashboard', 'device', 'settings'],
            run: function () {
                callIfFn('loadNetworkLicenseStatus');
            }
        });

        register({
            id: 'diagnostics',
            tier: 'medium',
            intervalMs: 15000,
            hiddenIntervalMs: 60000,
            sections: ['device'],
            run: function () {
                if (window.DeviceControlCenter && typeof window.DeviceControlCenter.updateModuleStatuses === 'function') {
                    window.DeviceControlCenter.updateModuleStatuses();
                }
            }
        });
    }

    function tick() {
        if (!started) return;
        var t = now();
        Object.keys(jobs).forEach(function (id) {
            var job = jobs[id];
            if (!job.nextDue) job.nextDue = t;
            if (t >= job.nextDue) {
                safeRun(id, job, 'auto');
            }
        });
        updateLastUpdatedUi();
    }

    function refreshNow(which) {
        var ids;
        if (!which || which === 'all') {
            ids = Object.keys(jobs).filter(function (id) {
                return sectionMatches(jobs[id]);
            });
            // Always include core monitoring jobs on manual refresh
            ['playback', 'system', 'deviceinfo', 'networkLicense'].forEach(function (id) {
                if (jobs[id] && ids.indexOf(id) < 0) ids.push(id);
            });
        } else {
            ids = Array.isArray(which) ? which : [which];
        }
        ids.forEach(function (id) {
            if (jobs[id]) {
                // Allow manual refresh to bypass in-flight wait by clearing flag for stale calls
                if (inFlight[id] && jobs[id].lastStarted && (now() - jobs[id].lastStarted > 20000)) {
                    inFlight[id] = false;
                }
                if (!inFlight[id]) safeRun(id, jobs[id], 'manual');
            }
        });
        updateLastUpdatedUi();
    }

    function setActiveSection(sectionId) {
        activeSection = sectionId || getActiveSection();
        // Soft kick: refresh fast/medium jobs for the newly visible section soon
        Object.keys(jobs).forEach(function (id) {
            var job = jobs[id];
            if (sectionMatches(job) && (job.tier === 'fast' || job.tier === 'medium')) {
                job.nextDue = Math.min(job.nextDue || 0, now() + 250);
            }
        });
    }

    function start() {
        if (started) return;
        started = true;
        registerBuiltIns();
        patchAjaxTimestamp();
        activeSection = getActiveSection();

        // Bootstrap immediately (non-blocking staggered)
        setTimeout(function () { safeRun('playback', jobs.playback, 'bootstrap'); }, 200);
        setTimeout(function () { safeRun('system', jobs.system, 'bootstrap'); }, 400);
        setTimeout(function () { safeRun('deviceinfo', jobs.deviceinfo, 'bootstrap'); }, 700);
        setTimeout(function () { safeRun('networkLicense', jobs.networkLicense, 'bootstrap'); }, 1100);

        tickTimer = setInterval(tick, TICK_MS);

        document.addEventListener('visibilitychange', function () {
            updateLastUpdatedUi();
            if (!document.hidden) {
                // Resume promptly when tab becomes visible again
                Object.keys(jobs).forEach(function (id) {
                    var job = jobs[id];
                    if (sectionMatches(job)) job.nextDue = Math.min(job.nextDue || 0, now() + 200);
                });
            }
        });

        window.addEventListener('resize', function () {
            // No API traffic — just keep last-updated UI fresh after layout shifts
            updateLastUpdatedUi();
        });

        notify({ type: 'started' });
        updateLastUpdatedUi();
    }

    function stop() {
        started = false;
        if (tickTimer) {
            clearInterval(tickTimer);
            tickTimer = null;
        }
    }

    function subscribe(cb) {
        if (typeof cb !== 'function') return function () {};
        subscribers.push(cb);
        return function () {
            subscribers = subscribers.filter(function (fn) { return fn !== cb; });
        };
    }

    window.ClessMonitoringService = {
        register: register,
        start: start,
        stop: stop,
        refreshNow: refreshNow,
        setActiveSection: setActiveSection,
        getLastUpdated: function (jobId) {
            return jobId ? lastUpdated[jobId] : lastUpdated._any;
        },
        formatAgo: formatAgo,
        subscribe: subscribe,
        updateLastUpdatedUi: updateLastUpdatedUi,
        getActiveSection: getActiveSection
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})(window, document);
