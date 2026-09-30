/**
 * CLESS Player Control Panel — SPA shell, theme, navigation, modals.
 * Preserves existing cpanel-enhanced.js / DisplayOrientationManager behavior.
 */
(function (window, document, $) {
    'use strict';

    var THEME_KEY = 'cless-cpanel-theme';
    var SIDEBAR_KEY = 'cless-cpanel-sidebar-collapsed';
    var sectionMeta = {
        dashboard: { title: 'Dashboard', subtitle: 'Overview and system health' },
        device: { title: 'Device Status & Control', subtitle: 'Monitoring, playback, and device operations' },
        layout: { title: 'Layout', subtitle: 'Layout information, switching, and freeze' },
        slots: { title: 'Slots', subtitle: 'Text, ticker, scroller, fader, and datetime slots' },
        media: { title: 'Media', subtitle: 'Media slot replacement' },
        airport: { title: 'Airport Display', subtitle: 'Freeze status, layouts, and triggers' },
        tts: { title: 'TTS', subtitle: 'Announcement repeat and language playback' },
        api: { title: 'API', subtitle: 'REST endpoints and integration notes' },
        preview: { title: 'Preview', subtitle: 'Adaptive noVNC live display' },
        settings: { title: 'Settings', subtitle: 'Player configuration and updates' }
    };

    var currentSection = 'dashboard';
    var modalResolver = null;

    function safeStorageGet(key, fallback) {
        try {
            var value = window.localStorage.getItem(key);
            return value == null ? fallback : value;
        } catch (err) {
            return fallback;
        }
    }

    function safeStorageSet(key, value) {
        try {
            window.localStorage.setItem(key, value);
            return true;
        } catch (err) {
            return false;
        }
    }

    function applyTheme(theme) {
        var next = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        safeStorageSet(THEME_KEY, next);
        return next;
    }

    function toggleTheme() {
        var current = document.documentElement.getAttribute('data-theme') || 'light';
        applyTheme(current === 'dark' ? 'light' : 'dark');
    }

    function setSidebarCollapsed(collapsed) {
        document.querySelector('.app-shell').classList.toggle('sidebar-collapsed', !!collapsed);
        safeStorageSet(SIDEBAR_KEY, collapsed ? '1' : '0');
    }

    function openMobileSidebar() {
        document.querySelector('.app-shell').classList.add('sidebar-open');
        var backdrop = document.getElementById('sidebarBackdrop');
        if (backdrop) backdrop.hidden = false;
    }

    function closeMobileSidebar() {
        document.querySelector('.app-shell').classList.remove('sidebar-open');
        var backdrop = document.getElementById('sidebarBackdrop');
        if (backdrop) backdrop.hidden = true;
    }

    function navigateTo(sectionId, options) {
        options = options || {};
        if (!sectionMeta[sectionId]) sectionId = 'dashboard';
        currentSection = sectionId;

        document.querySelectorAll('.spa-section').forEach(function (section) {
            var active = section.id === 'section-' + sectionId;
            section.classList.toggle('is-active', active);
            if (active) {
                section.removeAttribute('hidden');
            } else {
                section.setAttribute('hidden', '');
            }
        });

        document.querySelectorAll('.nav-item').forEach(function (item) {
            var active = item.getAttribute('data-nav') === sectionId;
            item.classList.toggle('is-active', active);
            item.setAttribute('aria-current', active ? 'page' : 'false');
        });

        var meta = sectionMeta[sectionId];
        var titleEl = document.getElementById('sectionTitle');
        var subtitleEl = document.getElementById('sectionSubtitle');
        if (titleEl) titleEl.textContent = meta.title;
        if (subtitleEl) subtitleEl.textContent = meta.subtitle;

        if (!options.skipHash) {
            try {
                history.replaceState(null, '', '#' + sectionId);
            } catch (err) { /* ignore */ }
        }

        closeMobileSidebar();

        if (sectionId === 'preview' && window.displayOrientationManager) {
            setTimeout(function () {
                window.displayOrientationManager.refreshDisplayInfo();
            }, 120);
        }

        if (sectionId === 'airport' && typeof window.refreshAirportPanel === 'function') {
            window.refreshAirportPanel();
        }

        if (window.ClessMonitoringService && typeof window.ClessMonitoringService.setActiveSection === 'function') {
            window.ClessMonitoringService.setActiveSection(sectionId);
        }

        if (sectionId === 'device' || sectionId === 'dashboard') {
            if (window.ClessMonitoringService) {
                window.ClessMonitoringService.refreshNow(['playback', 'system', 'deviceinfo']);
            } else if (sectionId === 'device' && window.ClessMonitorUI && typeof window.ClessMonitorUI.refreshDeviceStatus === 'function') {
                try {
                    window.ClessMonitorUI.refreshDeviceStatus();
                } catch (err) {
                    console.warn('Device status refresh failed:', err);
                }
            }
        }

        if (sectionId === 'layout') {
            if (window.ClessMonitoringService) {
                window.ClessMonitoringService.refreshNow(['playback']);
            } else if (typeof window.getDetailedLayoutInfo === 'function') {
                try { window.getDetailedLayoutInfo(); } catch (err) { /* ignore */ }
            }
        }
    }

    function parseHashSection() {
        var hash = (window.location.hash || '').replace(/^#/, '');
        return sectionMeta[hash] ? hash : 'dashboard';
    }

    function closeModal() {
        var modal = document.getElementById('appModal');
        if (!modal) return;
        modal.hidden = true;
        if (typeof modalResolver === 'function') {
            var resolve = modalResolver;
            modalResolver = null;
            resolve(false);
        }
    }

    function openModal(config) {
        config = config || {};
        var modal = document.getElementById('appModal');
        if (!modal) return Promise.resolve(false);

        document.getElementById('appModalTitle').textContent = config.title || 'Confirm';
        document.getElementById('appModalBody').innerHTML = config.bodyHtml || '<p></p>';

        var footer = document.getElementById('appModalFooter');
        footer.innerHTML = '';

        return new Promise(function (resolve) {
            modalResolver = resolve;

            if (config.showCancel !== false) {
                var cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'modern-btn btn-secondary';
                cancelBtn.textContent = config.cancelLabel || 'Cancel';
                cancelBtn.addEventListener('click', function () {
                    modalResolver = null;
                    modal.hidden = true;
                    resolve(false);
                });
                footer.appendChild(cancelBtn);
            }

            var okBtn = document.createElement('button');
            okBtn.type = 'button';
            okBtn.className = 'modern-btn' + (config.danger ? ' btn-danger' : '');
            okBtn.textContent = config.confirmLabel || 'Confirm';
            okBtn.addEventListener('click', function () {
                modalResolver = null;
                modal.hidden = true;
                resolve(true);
            });
            footer.appendChild(okBtn);

            modal.hidden = false;
            okBtn.focus();
        });
    }

    function confirmAction(message, options) {
        options = options || {};
        return openModal({
            title: options.title || 'Confirm action',
            bodyHtml: '<p>' + String(message || '').replace(/</g, '&lt;') + '</p>',
            confirmLabel: options.confirmLabel || 'Confirm',
            cancelLabel: options.cancelLabel || 'Cancel',
            danger: !!options.danger
        });
    }

    function syncDashboardMetrics() {
        var cpu = document.getElementById('cpuUsage');
        var mem = document.getElementById('memoryUsage');
        var dashCpu = document.getElementById('dashCpuUsage');
        var dashMem = document.getElementById('dashMemUsage');
        if (cpu && dashCpu) dashCpu.textContent = cpu.textContent || '—';
        if (mem && dashMem) dashMem.textContent = mem.textContent || '—';
    }

    function syncFreezeStatusDisplays(text) {
        var label = text || 'Freeze: inactive';
        var active = /active/i.test(label) && !/inactive/i.test(label);
        var html = '<span class="status-dot ' + (active ? 'status-dot-warning' : 'status-dot-neutral') + '"></span> ' +
            label.replace(/^Freeze:\s*/i, '');

        ['dashboardFreezeStatus', 'airportFreezeStatus', 'layoutStatusFreeze'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.innerHTML = html;
        });
        var freezeField = document.querySelector('[data-layout-field="freezeState"]');
        if (freezeField) freezeField.textContent = label.replace(/^Freeze:\s*/i, '') || 'No data';
    }

    function patchFreezeHintObserver() {
        var hint = document.getElementById('freezeStateHint');
        if (!hint || typeof MutationObserver === 'undefined') return;
        var observer = new MutationObserver(function () {
            syncFreezeStatusDisplays(hint.textContent || '');
        });
        observer.observe(hint, { childList: true, characterData: true, subtree: true });
        syncFreezeStatusDisplays(hint.textContent || '');
    }

    function updateConnectionChrome(connected) {
        var sidebar = document.getElementById('sidebarPlayerStatus');
        var dash = document.getElementById('dashboardConnectionStatus');
        var device = document.getElementById('deviceOnlineStatus');
        var html = connected
            ? '<span class="status-dot status-dot-success"></span><span class="status-text">Online</span>'
            : '<span class="status-dot status-dot-danger"></span><span class="status-text">Offline</span>';
        if (sidebar) sidebar.innerHTML = html;
        if (dash) dash.innerHTML = html.replace('status-text', '');
        if (device) device.innerHTML = html.replace('status-text', '');
    }

    function relocateConnectionStatus() {
        var slot = document.getElementById('connection-status-slot');
        var status = document.getElementById('connection-status');
        if (slot && status && status.parentElement !== slot) {
            slot.appendChild(status);
        }
    }

    function refreshAirportPanel() {
        var healthEl = document.getElementById('airportHealthStatus');
        var layoutsEl = document.getElementById('airportLayoutsList');

        if (healthEl) {
            healthEl.innerHTML = '<span class="status-dot status-dot-neutral"></span> Checking…';
            $.get('/api/health')
                .done(function (data) {
                    var ok = data && (data.status === 'ok' || data.status === 'success' || data.ok === true || data.healthy === true);
                    // health endpoint may return various shapes
                    if (typeof data === 'object' && data.status) {
                        ok = String(data.status).toLowerCase() === 'ok' ||
                            String(data.status).toLowerCase() === 'healthy' ||
                            String(data.status).toLowerCase() === 'success';
                    }
                    healthEl.innerHTML = ok
                        ? '<span class="status-dot status-dot-success"></span> Healthy'
                        : '<span class="status-dot status-dot-warning"></span> ' + (data && data.status ? data.status : 'Unavailable');
                })
                .fail(function () {
                    // try airport-display health
                    $.get('/api/airport-display/health')
                        .done(function (data) {
                            healthEl.innerHTML = '<span class="status-dot status-dot-success"></span> ' +
                                ((data && data.status) || 'Reachable');
                        })
                        .fail(function () {
                            healthEl.innerHTML = '<span class="status-dot status-dot-danger"></span> Unreachable';
                        });
                });
        }

        if (layoutsEl) {
            layoutsEl.classList.add('loading');
            layoutsEl.textContent = 'Loading airport layouts…';
            $.get('/api/airport-display/layouts')
                .done(function (data) {
                    layoutsEl.classList.remove('loading');
                    var layouts = (data && data.layouts) || [];
                    if (!layouts.length) {
                        layoutsEl.innerHTML = '<p class="text-secondary">No layouts discovered (player may be offline).</p>';
                        return;
                    }
                    var html = '<div class="table-responsive"><table class="info-table"><thead><tr><th>Layout</th><th>ID</th><th>Slots</th></tr></thead><tbody>';
                    layouts.forEach(function (layout) {
                        var slots = layout.slots || [];
                        html += '<tr><td>' + (layout.name || layout.layout_name || '—') +
                            '</td><td><code>' + (layout.id || layout.layout_id || '—') +
                            '</code></td><td>' + slots.length + '</td></tr>';
                    });
                    html += '</tbody></table></div>';
                    layoutsEl.innerHTML = html;
                })
                .fail(function (xhr) {
                    layoutsEl.classList.remove('loading');
                    var msg = (xhr.responseJSON && (xhr.responseJSON.error || xhr.responseJSON.message)) ||
                        'Unable to load layouts';
                    layoutsEl.innerHTML = '<p class="text-secondary">' + msg + '</p>';
                });
        }

        if (typeof window.refreshFreezeStateHint === 'function') {
            window.refreshFreezeStateHint();
        }
    }

    function openTtsTriggerModal() {
        openModal({
            title: 'Send Test Announcement',
            confirmLabel: 'Send',
            bodyHtml:
                '<div class="form-group"><label class="form-label" for="ttsRepeatInput">Repeat (1–9)</label>' +
                '<input id="ttsRepeatInput" class="form-control" type="number" min="1" max="9" value="1"></div>' +
                '<div class="form-group"><label class="form-label" for="ttsTextInput">Announcement text</label>' +
                '<input id="ttsTextInput" class="form-control" type="text" placeholder="Boarding announcement"></div>' +
                '<div class="form-group"><label class="form-label" for="ttsAudioInput">Audio URL (optional)</label>' +
                '<input id="ttsAudioInput" class="form-control" type="url" placeholder="https://..."></div>' +
                '<p class="text-secondary">Sends <code>POST /api/airport-display</code> with announcement enabled. Layout/slot updates are omitted.</p>'
        }).then(function (confirmed) {
            if (!confirmed) return;
            var repeat = parseInt(($('#ttsRepeatInput').val() || '1'), 10);
            if (!isFinite(repeat) || repeat < 1) repeat = 1;
            if (repeat > 9) repeat = 9;
            var text = ($('#ttsTextInput').val() || '').trim();
            var audio = ($('#ttsAudioInput').val() || '').trim();
            var payload = {
                type: 'airport_display',
                event: 'manual_test',
                event_id: 'cpanel-tts-' + Date.now(),
                slots: [],
                announcement: {
                    enabled: true,
                    repeat: repeat,
                    text: text,
                    audio_url: audio || undefined,
                    languages: text || audio ? [{
                        language: 'en',
                        order: 1,
                        text: text,
                        audio_url: audio || ''
                    }] : []
                }
            };

            var responseEl = document.getElementById('ttsLastResponse');
            if (responseEl) {
                responseEl.textContent = 'Sending…';
                responseEl.classList.add('loading');
            }

            $.ajax({
                url: '/api/airport-display',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(payload),
                timeout: 15000
            }).done(function (data) {
                if (responseEl) {
                    responseEl.classList.remove('loading');
                    responseEl.textContent = 'Success: ' + JSON.stringify(data);
                }
                if (window.showToast) window.showToast('TTS announcement request sent', 'success');
            }).fail(function (xhr) {
                var message = (xhr.responseJSON && xhr.responseJSON.message) || xhr.statusText || 'Request failed';
                if (responseEl) {
                    responseEl.classList.remove('loading');
                    responseEl.textContent = 'Error: ' + message;
                }
                if (window.showToast) window.showToast(message, 'error');
            });
        });
    }

    function bindProxyClicks() {
        document.addEventListener('click', function (event) {
            var proxy = event.target.closest('[data-proxy-click]');
            if (!proxy) return;
            var selector = proxy.getAttribute('data-proxy-click');
            var target = selector ? document.querySelector(selector) : null;
            if (target) target.click();
        });
    }

    function bindNav() {
        document.querySelectorAll('[data-nav]').forEach(function (item) {
            item.addEventListener('click', function () {
                navigateTo(item.getAttribute('data-nav'));
            });
        });

        document.addEventListener('click', function (event) {
            var jump = event.target.closest('[data-nav-jump]');
            if (!jump) return;
            navigateTo(jump.getAttribute('data-nav-jump'));
        });

        window.addEventListener('hashchange', function () {
            navigateTo(parseHashSection(), { skipHash: true });
        });
    }

    function bindChrome() {
        var themeBtn = document.getElementById('themeToggle');
        var themeBtnMobile = document.getElementById('themeToggleMobile');
        if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
        if (themeBtnMobile) themeBtnMobile.addEventListener('click', toggleTheme);

        var collapseBtn = document.getElementById('sidebarCollapseBtn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', function () {
                var shell = document.querySelector('.app-shell');
                setSidebarCollapsed(!shell.classList.contains('sidebar-collapsed'));
            });
        }

        var openBtn = document.getElementById('sidebarOpenBtn');
        var backdrop = document.getElementById('sidebarBackdrop');
        if (openBtn) openBtn.addEventListener('click', openMobileSidebar);
        if (backdrop) backdrop.addEventListener('click', closeMobileSidebar);

        document.querySelectorAll('[data-modal-close]').forEach(function (el) {
            el.addEventListener('click', closeModal);
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                var modal = document.getElementById('appModal');
                if (modal && !modal.hidden) {
                    closeModal();
                } else {
                    closeMobileSidebar();
                }
            }
        });

        var refreshAirport = document.getElementById('refreshAirportStatus');
        if (refreshAirport) {
            refreshAirport.addEventListener('click', refreshAirportPanel);
        }

        var ttsBtn = document.getElementById('openTtsTriggerModal');
        if (ttsBtn) ttsBtn.addEventListener('click', openTtsTriggerModal);
    }

    function patchNativeConfirm() {
        // Prefer custom modal for known dangerous actions when confirm() is used from enhanced JS.
        var nativeConfirm = window.confirm.bind(window);
        window.__nativeConfirm = nativeConfirm;
        window.clessConfirm = confirmAction;

        // Keep native confirm as fallback; enhanced JS still calls confirm().
        // Optionally override for better UX in browsers that allow it.
        window.confirm = function (message) {
            // Synchronous confirm cannot await a modal; keep native for compatibility
            // with existing cpanel-enhanced.js control flow.
            return nativeConfirm(message);
        };
    }

    function init() {
        var savedTheme = safeStorageGet(THEME_KEY, null);
        if (!savedTheme) {
            savedTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light';
        }
        applyTheme(savedTheme);

        if (safeStorageGet(SIDEBAR_KEY, '0') === '1' && window.innerWidth >= 992) {
            setSidebarCollapsed(true);
        }

        // Expose modal/theme APIs before navigation side-effects so destructive
        // confirms remain available even if monitoring refresh throws.
        window.refreshAirportPanel = refreshAirportPanel;
        window.clessNavigate = navigateTo;
        window.clessOpenModal = openModal;
        window.clessApplyTheme = applyTheme;

        bindNav();
        bindChrome();
        bindProxyClicks();
        patchNativeConfirm();
        patchFreezeHintObserver();
        relocateConnectionStatus();

        try {
            navigateTo(parseHashSection(), { skipHash: true });
        } catch (err) {
            console.warn('Initial navigation failed:', err);
        }

        // Periodic dashboard sync
        setInterval(syncDashboardMetrics, 2000);
        setInterval(relocateConnectionStatus, 3000);

        // Hook connection status updates if enhanced JS exposes them
        var originalUpdateConnectionStatus = window.updateConnectionStatus;
        if (typeof originalUpdateConnectionStatus === 'function') {
            window.updateConnectionStatus = function (connected) {
                originalUpdateConnectionStatus(connected);
                updateConnectionChrome(!!connected);
                relocateConnectionStatus();
            };
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document, window.jQuery);
