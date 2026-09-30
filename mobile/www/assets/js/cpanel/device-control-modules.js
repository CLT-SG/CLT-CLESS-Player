/**
 * Device Status & Control — modular control center registry.
 *
 * Active modules reuse existing Control Panel APIs/handlers via preserved element IDs.
 * Future modules can be registered without redesigning the page.
 */
(function (window, document, $) {
    'use strict';

    var modules = [];
    var actionStates = {};

    function byId(id) {
        return document.getElementById(id);
    }

    function setText(id, value) {
        var el = byId(id);
        if (el) el.textContent = value == null || value === '' ? 'No data' : String(value);
    }

    function statusHtml(label, kind) {
        var cls = 'status-dot-neutral';
        if (kind === 'success') cls = 'status-dot-success';
        else if (kind === 'warning') cls = 'status-dot-warning';
        else if (kind === 'danger') cls = 'status-dot-danger';
        else if (kind === 'info') cls = 'status-dot-info';
        return '<span class="status-dot ' + cls + '"></span> ' + label;
    }

    function setActionState(moduleId, actionId, state, message) {
        var key = moduleId + ':' + actionId;
        actionStates[key] = { state: state || 'idle', message: message || '' };
        var btn = document.querySelector('[data-dc-action="' + key + '"]');
        if (!btn) return;
        btn.classList.remove('is-loading', 'is-success', 'is-error', 'is-unavailable');
        btn.disabled = state === 'loading' || state === 'unavailable';
        if (state === 'loading') btn.classList.add('is-loading', 'loading');
        else btn.classList.remove('loading');
        if (state === 'success') btn.classList.add('is-success');
        if (state === 'error') btn.classList.add('is-error');
        if (state === 'unavailable') btn.classList.add('is-unavailable');
        var statusEl = document.querySelector('[data-dc-action-status="' + key + '"]');
        if (statusEl) {
            statusEl.textContent = message || '';
            statusEl.hidden = !message;
        }
    }

    function confirmAction(options) {
        options = options || {};
        if (typeof window.clessOpenModal === 'function') {
            return window.clessOpenModal({
                title: options.title || 'Confirm',
                bodyHtml: '<p>' + String(options.message || '').replace(/</g, '&lt;') + '</p>',
                confirmLabel: options.confirmLabel || 'Confirm',
                cancelLabel: options.cancelLabel || 'Cancel',
                danger: !!options.danger
            });
        }
        // Fallback only if modal system unavailable
        return Promise.resolve(window.confirm(options.message || 'Continue?'));
    }

    function register(module) {
        if (!module || !module.id) return;
        var idx = modules.findIndex(function (m) { return m.id === module.id; });
        if (idx >= 0) modules[idx] = module;
        else modules.push(module);
        modules.sort(function (a, b) {
            return (a.order || 100) - (b.order || 100);
        });
    }

    function getModules() {
        return modules.slice();
    }

    function renderFutureHost(container) {
        if (!container) return;
        var future = modules.filter(function (m) { return m.category === 'future'; });
        if (!future.length) {
            container.innerHTML = '';
            return;
        }
        var html = '<div class="dc-module-grid">';
        future.forEach(function (mod) {
            html +=
                '<div class="dc-module-card is-future" data-dc-module="' + mod.id + '">' +
                '<div class="dc-module-header">' +
                '<div class="card-icon"><i class="bi ' + (mod.icon || 'bi-puzzle') + '"></i></div>' +
                '<div><h3 class="dc-module-title">' + mod.name + '</h3>' +
                '<p class="dc-module-desc">' + (mod.description || '') + '</p></div>' +
                '<span class="status-badge status-badge-neutral">Coming soon</span>' +
                '</div>' +
                '<div class="dc-module-status">' + statusHtml('Unavailable', 'neutral') + '</div>' +
                '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }

    function updateModuleStatuses() {
        modules.forEach(function (mod) {
            if (typeof mod.getStatus !== 'function') return;
            var status = mod.getStatus() || { label: 'No data', kind: 'neutral' };
            document.querySelectorAll('[data-dc-module-status="' + mod.id + '"]').forEach(function (el) {
                el.innerHTML = statusHtml(status.label, status.kind);
            });
        });
        updatePlaybackSummary();
        updateDiagnosticsSummary();
    }

    function updatePlaybackSummary() {
        var layoutEl = byId('dcPlaybackLayout');
        var slotsEl = byId('dcPlaybackSlots');
        var stateEl = byId('dcPlaybackState');
        var freezeEl = byId('dcPlaybackFreeze');
        if (!layoutEl) return;

        var dashLayout = byId('dashCurrentLayout');
        var dashSlots = byId('dashCurrentSlots');
        var devicePlay = byId('devicePlaybackStatus');
        var freezeHint = byId('freezeStateHint');

        layoutEl.textContent = (dashLayout && dashLayout.textContent) || 'No data';
        if (slotsEl) slotsEl.textContent = (dashSlots && dashSlots.textContent) || 'No data';
        if (stateEl) stateEl.innerHTML = (devicePlay && devicePlay.innerHTML) || statusHtml('No data', 'neutral');
        if (freezeEl) {
            var freezeText = (freezeHint && freezeHint.textContent) || 'Freeze: No data';
            var active = /active/i.test(freezeText) && !/inactive/i.test(freezeText);
            freezeEl.innerHTML = statusHtml(
                freezeText.replace(/^Freeze:\s*/i, '') || 'No data',
                active ? 'warning' : 'neutral'
            );
        }
    }

    function updateDiagnosticsSummary() {
        var list = byId('dcDiagnosticsList');
        var stamp = byId('dcDiagnosticsChecked');
        if (!list) return;

        var online = byId('deviceOnlineStatus');
        var playback = byId('devicePlaybackStatus');
        var license = byId('deviceLicenseStatus');
        var server = byId('dashServerStatus');
        var cpu = byId('deviceCpuUsage');
        var mem = byId('deviceMemUsage');
        var disk = byId('deviceDiskUsage');

        function row(label, sourceEl, fallbackKind) {
            var text = sourceEl ? sourceEl.textContent.replace(/\s+/g, ' ').trim() : 'No data';
            var kind = fallbackKind || 'neutral';
            if (/online|playing|active|connected|healthy/i.test(text)) kind = 'success';
            else if (/offline|invalid|error|fail|disconnected/i.test(text)) kind = 'danger';
            else if (/idle|checking|warn|inactive/i.test(text)) kind = 'warning';
            else if (/unavailable|no data|—/i.test(text)) kind = 'neutral';
            return '<div class="dc-diag-row"><span>' + label + '</span><span>' + statusHtml(text || 'No data', kind) + '</span></div>';
        }

        list.innerHTML =
            row('Player Process', online) +
            row('Server Connection', server) +
            row('Playback', playback) +
            row('License', license) +
            row('CPU', cpu) +
            row('Memory', mem) +
            row('Storage', disk);

        if (stamp && !stamp.hasAttribute('data-monitoring-updated')) {
            var now = new Date();
            stamp.textContent = 'Last checked: ' +
                now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    }

    function bindDestructiveConfirmations() {
        // Intercept destructive controls with modal confirmation before existing handlers run.
        function wrapConfirm(selector, options, proceedFn) {
            var el = document.querySelector(selector);
            if (!el || el.__dcConfirmBound) return;
            el.__dcConfirmBound = true;
            el.addEventListener('click', function (event) {
                if (el.dataset.dcConfirmed === '1') {
                    el.dataset.dcConfirmed = '';
                    return; // allow subsequent synthetic/default handlers
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                confirmAction(options).then(function (ok) {
                    if (!ok) return;
                    el.dataset.dcConfirmed = '1';
                    if (typeof proceedFn === 'function') {
                        proceedFn();
                    } else {
                        el.click();
                    }
                });
            }, true);
        }

        wrapConfirm('#restartapp', {
            title: 'Restart Player?',
            message: 'Current playback will be interrupted and the application will restart.',
            confirmLabel: 'Restart Player',
            danger: true
        }, function () {
            // Bypass inner confirm() in restartapp by temporarily stubbing
            var nativeConfirm = window.confirm;
            window.confirm = function () { return true; };
            try {
                if (typeof window.restartapp === 'function') window.restartapp();
                else byId('restartapp').click();
            } finally {
                window.confirm = nativeConfirm;
                byId('restartapp').dataset.dcConfirmed = '';
            }
        });

        wrapConfirm('#reboot', {
            title: 'Restart Device?',
            message: 'The Player device will restart and become temporarily unavailable.',
            confirmLabel: 'Restart Device',
            danger: true
        });

        wrapConfirm('#shutdown', {
            title: 'Shutdown Device?',
            message: 'The Player device will shut down and will not restart automatically.',
            confirmLabel: 'Shutdown Device',
            danger: true
        });
    }

    function bindModuleActions() {
        var runDiag = byId('dcRunDiagnostics');
        if (runDiag && !runDiag.__dcBound) {
            runDiag.__dcBound = true;
            runDiag.addEventListener('click', function () {
                setActionState('diagnostics', 'run', 'loading', 'Running diagnostics…');
                if (window.ClessMonitorUI) window.ClessMonitorUI.refreshDeviceStatus();
                $.get('/api/health').always(function () {
                    $.get('/api/airport-display/health').always(function () {
                        updateModuleStatuses();
                        setActionState('diagnostics', 'run', 'success', 'Diagnostics refreshed');
                        setTimeout(function () {
                            setActionState('diagnostics', 'run', 'idle', '');
                        }, 2500);
                    });
                });
            });
        }

        var refreshMonitors = byId('dcRefreshMonitors');
        if (refreshMonitors && !refreshMonitors.__dcBound) {
            refreshMonitors.__dcBound = true;
            refreshMonitors.addEventListener('click', function () {
                setActionState('display', 'refreshInfo', 'loading', 'Refreshing monitors…');
                if (typeof window.deviceinfo === 'function') window.deviceinfo();
                if (window.refreshDisplayOrientation) window.refreshDisplayOrientation();
                setTimeout(function () {
                    updateModuleStatuses();
                    setActionState('display', 'refreshInfo', 'success', 'Monitor information refreshed');
                    setTimeout(function () { setActionState('display', 'refreshInfo', 'idle', ''); }, 2000);
                }, 800);
            });
        }
    }

    function initBuiltInModules() {
        register({
            id: 'playback',
            name: 'Playback Control',
            icon: 'bi-play-circle',
            order: 10,
            category: 'active',
            description: 'Refresh content, resume layout loop, and manage audio playback.',
            getStatus: function () {
                var el = byId('devicePlaybackStatus');
                var text = el ? el.textContent.trim() : 'No data';
                if (/playing/i.test(text)) return { label: 'Playing', kind: 'success' };
                if (/idle/i.test(text)) return { label: 'Idle', kind: 'warning' };
                return { label: text || 'No data', kind: 'neutral' };
            }
        });

        register({
            id: 'display',
            name: 'Display Control',
            icon: 'bi-display',
            order: 20,
            category: 'active',
            description: 'Screen power and monitor information for the Player display.',
            getStatus: function () {
                var table = byId('displayInfoTable');
                if (!table) return { label: 'No data', kind: 'neutral' };
                if (/unavailable|no display/i.test(table.textContent)) return { label: 'Unavailable', kind: 'warning' };
                if (/loading/i.test(table.textContent)) return { label: 'Loading', kind: 'info' };
                return { label: 'Ready', kind: 'success' };
            }
        });

        register({
            id: 'application',
            name: 'Application Control',
            icon: 'bi-app-indicator',
            order: 30,
            category: 'active',
            description: 'Restart the Player application and check for updates.',
            getStatus: function () {
                var el = byId('deviceOnlineStatus');
                if (el && /online/i.test(el.textContent)) return { label: 'Running', kind: 'success' };
                if (el && /offline/i.test(el.textContent)) return { label: 'Offline', kind: 'danger' };
                return { label: 'Unknown', kind: 'neutral' };
            }
        });

        register({
            id: 'system',
            name: 'System Control',
            icon: 'bi-power',
            order: 40,
            category: 'active',
            description: 'Device reboot and shutdown. Requires confirmation.',
            getStatus: function () {
                return { label: 'Protected', kind: 'warning' };
            }
        });

        register({
            id: 'diagnostics',
            name: 'Diagnostics',
            icon: 'bi-heart-pulse',
            order: 50,
            category: 'active',
            description: 'Health checks for process, network, server, and playback.',
            getStatus: function () {
                var el = byId('deviceOnlineStatus');
                if (el && /online/i.test(el.textContent)) return { label: 'Healthy', kind: 'success' };
                if (el && /offline/i.test(el.textContent)) return { label: 'Degraded', kind: 'danger' };
                return { label: 'Unknown', kind: 'neutral' };
            }
        });

        register({
            id: 'layout',
            name: 'Layout Control',
            icon: 'bi-layout-text-window',
            order: 55,
            category: 'future',
            description: 'Scheduled and remote layout switching beyond the Layout page controls.'
        });

        register({
            id: 'content',
            name: 'Content Management',
            icon: 'bi-collection-play',
            order: 60,
            category: 'future',
            description: 'Current playlist, content cache status, and safe cache refresh.'
        });

        register({
            id: 'scheduling',
            name: 'Scheduling',
            icon: 'bi-calendar-event',
            order: 70,
            category: 'future',
            description: 'Scheduled playback, layout changes, restarts, and content updates.'
        });

        register({
            id: 'remoteLogs',
            name: 'Remote Diagnostics',
            icon: 'bi-journal-text',
            order: 80,
            category: 'future',
            description: 'Player logs, error history, and remote troubleshooting tools.'
        });

        register({
            id: 'deviceHealth',
            name: 'Device Health History',
            icon: 'bi-graph-up',
            order: 90,
            category: 'future',
            description: 'Historical CPU/memory/network stability and restart history.'
        });
    }

    function init() {
        initBuiltInModules();
        renderFutureHost(byId('deviceFutureModules'));
        bindDestructiveConfirmations();
        bindModuleActions();
        updateModuleStatuses();
        if (window.ClessMonitoringService && typeof window.ClessMonitoringService.subscribe === 'function') {
            window.ClessMonitoringService.subscribe(function (event) {
                if (event && (event.type === 'updated' || event.type === 'started')) {
                    updateModuleStatuses();
                }
            });
            // Lightweight UI sync while device section is active (no API)
            setInterval(function () {
                var active = document.querySelector('.spa-section.is-active');
                if (active && active.id === 'section-device') updateModuleStatuses();
            }, 4000);
        } else {
            setInterval(updateModuleStatuses, 3000);
        }
    }

    window.DeviceControlCenter = {
        register: register,
        getModules: getModules,
        setActionState: setActionState,
        confirmAction: confirmAction,
        updateModuleStatuses: updateModuleStatuses,
        renderFutureHost: renderFutureHost
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document, window.jQuery);
