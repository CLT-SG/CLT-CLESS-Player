/**
 * Dashboard / Device Status presentation helpers.
 * Consumes existing API data; collects short-term client-side samples for sparklines.
 */
(function (window, document, $) {
    'use strict';

    var SAMPLE_LIMIT = 30;
    var cpuSamples = [];
    var memSamples = [];
    var lastMonitor = null;
    var lastDevice = null;
    var lastLicense = null;
    var lastLayout = null;

    function text(id, value, unavailable) {
        var el = document.getElementById(id);
        if (!el) return;
        if (value == null || value === '' || value === undefined) {
            el.textContent = unavailable || 'No data';
            return;
        }
        el.textContent = String(value);
    }

    function setStatus(id, label, kind) {
        var el = document.getElementById(id);
        if (!el) return;
        var cls = 'status-dot-neutral';
        if (kind === 'success') cls = 'status-dot-success';
        else if (kind === 'warning') cls = 'status-dot-warning';
        else if (kind === 'danger') cls = 'status-dot-danger';
        else if (kind === 'info') cls = 'status-dot-info';
        el.innerHTML = '<span class="status-dot ' + cls + '"></span> ' + label;
    }

    function setMeter(valueId, barId, percent, labelHtml) {
        var valueEl = document.getElementById(valueId);
        var barEl = document.getElementById(barId);
        if (percent == null || !isFinite(percent)) {
            if (valueEl) valueEl.textContent = '—';
            if (barEl) {
                barEl.style.width = '0%';
                barEl.classList.add('is-unavailable');
            }
            return;
        }
        var pct = Math.max(0, Math.min(100, Number(percent)));
        if (valueEl) valueEl.innerHTML = labelHtml != null ? labelHtml : (pct.toFixed(1) + '%');
        if (barEl) {
            barEl.style.width = pct + '%';
            barEl.classList.remove('is-unavailable');
            barEl.classList.toggle('is-warn', pct >= 70 && pct < 90);
            barEl.classList.toggle('is-danger', pct >= 90);
        }
    }

    function pushSample(arr, value) {
        if (value == null || !isFinite(value)) return;
        arr.push(Number(value));
        if (arr.length > SAMPLE_LIMIT) arr.shift();
    }

    function drawSparkline(svgId, samples) {
        var svg = document.getElementById(svgId);
        if (!svg) return;
        if (!samples.length) {
            svg.innerHTML = '';
            svg.classList.add('is-empty');
            return;
        }
        svg.classList.remove('is-empty');
        var w = 120;
        var h = 36;
        var min = Math.min.apply(null, samples);
        var max = Math.max.apply(null, samples);
        if (max === min) {
            max = min + 1;
        }
        var points = samples.map(function (v, i) {
            var x = samples.length === 1 ? w : (i / (samples.length - 1)) * w;
            var y = h - ((v - min) / (max - min)) * (h - 4) - 2;
            return x.toFixed(1) + ',' + y.toFixed(1);
        }).join(' ');
        svg.innerHTML =
            '<polyline fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="' +
            points + '"></polyline>';
    }

    function formatUptime(seconds) {
        if (seconds == null || !isFinite(seconds) || seconds < 0) return null;
        var s = Math.floor(seconds);
        var d = Math.floor(s / 86400);
        var h = Math.floor((s % 86400) / 3600);
        var m = Math.floor((s % 3600) / 60);
        if (d > 0) return d + 'd ' + h + 'h';
        if (h > 0) return h + 'h ' + m + 'm';
        return m + 'm';
    }

    function updatePlaybackFromLayout(layoutData) {
        lastLayout = layoutData || null;
        var layoutName = 'No data';
        var slots = 'No data';
        var mode = 'No data';
        var playing = false;

        if (layoutData && layoutData.currentLayout) {
            layoutName = layoutData.currentLayout.name || ('ID ' + layoutData.currentLayout.id);
            var summary = layoutData.currentLayout.slotSummary;
            if (summary && summary.total != null) {
                slots = summary.total + ' total';
                if (summary.media != null || summary.text != null) {
                    slots += ' · text ' + (summary.text || 0) + ' · media ' + (summary.media || 0);
                }
            } else if (layoutData.currentLayout.totalSlots != null) {
                slots = String(layoutData.currentLayout.totalSlots);
            }
            playing = true;
        } else if (layoutData && layoutData.layouts && layoutData.layouts.length) {
            layoutName = layoutData.layouts[0].name || 'Available';
        }

        if (layoutData) {
            mode = layoutData.isLoop ? 'Loop' : 'Single';
        }

        text('dashCurrentLayout', layoutName);
        text('dashCurrentSlots', slots);
        text('dashLayoutMode', mode);

        if (playing) {
            setStatus('dashPlaybackStatus', 'Playing', 'success');
            setStatus('devicePlaybackStatus', 'Playing', 'success');
        } else if (layoutData) {
            setStatus('dashPlaybackStatus', 'Idle', 'warning');
            setStatus('devicePlaybackStatus', 'Idle', 'warning');
        } else {
            setStatus('dashPlaybackStatus', 'No data', 'neutral');
            setStatus('devicePlaybackStatus', 'No data', 'neutral');
        }
    }

    function updateFromMonitor(data) {
        lastMonitor = data || null;
        var cpu = data && data.cpu && typeof data.cpu.load !== 'undefined' ? parseFloat(data.cpu.load) : null;
        var memPct = null;
        var memLabel = null;
        if (data && data.memory && data.memory.total) {
            memPct = (data.memory.used / data.memory.total) * 100;
            if (typeof formatBytes === 'function') {
                memLabel = memPct.toFixed(1) + '% <small class="meter-sub">' +
                    formatBytes(data.memory.used) + ' / ' + formatBytes(data.memory.total) + '</small>';
            } else {
                memLabel = memPct.toFixed(1) + '%';
            }
        }

        var diskPct = null;
        var diskDetail = 'No data';
        if (data && Array.isArray(data.disk) && data.disk.length) {
            var primary = data.disk[0];
            if (primary && typeof primary.usage !== 'undefined') {
                diskPct = parseFloat(primary.usage);
                diskDetail = (primary.filesystem || 'Disk') + (isFinite(diskPct) ? (': ' + diskPct.toFixed(1) + '%') : '');
            }
        }

        setMeter('cpuUsage', 'cpuProgressBar', cpu, cpu != null ? cpu.toFixed(1) + '%' : null);
        setMeter('memoryUsage', 'memoryProgressBar', memPct, memLabel);
        setMeter('diskUsage', 'diskProgressBar', diskPct, diskPct != null ? diskPct.toFixed(1) + '%' : null);
        text('diskUsageDetail', diskDetail);

        setMeter('deviceCpuUsage', 'deviceCpuProgressBar', cpu, cpu != null ? cpu.toFixed(1) + '%' : null);
        setMeter('deviceMemUsage', 'deviceMemProgressBar', memPct, memPct != null ? memPct.toFixed(1) + '%' : null);
        setMeter('deviceDiskUsage', 'deviceDiskProgressBar', diskPct, diskPct != null ? diskPct.toFixed(1) + '%' : null);
        text('deviceCpuDetail', cpu != null ? 'Current load' : 'Unavailable');
        text('deviceMemDetail', memPct != null ? 'Used / total' : 'Unavailable');
        text('deviceDiskDetail', diskDetail === 'No data' ? 'Unavailable' : diskDetail);

        pushSample(cpuSamples, cpu);
        pushSample(memSamples, memPct);
        drawSparkline('cpuSparkline', cpuSamples);
        drawSparkline('memSparkline', memSamples);

        // Keep legacy dash sync targets if present
        text('dashCpuUsage', cpu != null ? cpu.toFixed(1) + '%' : '—');
        text('dashMemUsage', memPct != null ? memPct.toFixed(1) + '%' : '—');
    }

    function updateFromDeviceInfo(data) {
        lastDevice = data || null;
        var hostname = data && data.system && data.system.os && data.system.os.hostname;
        if (!hostname && data && data.system && data.system.hostname) hostname = data.system.hostname;

        var ip = null;
        if (data && Array.isArray(data.network)) {
            var up = data.network.find(function (n) {
                return n && n.operstate === 'up' && n.ip4;
            }) || data.network.find(function (n) { return n && n.ip4; });
            if (up) ip = up.ip4;
        }

        var version = data && data.app && data.app.version ? ('v' + data.app.version) : null;
        var electron = data && data.app && data.app.electron ? data.app.electron : null;
        var metaParts = [];
        if (hostname) metaParts.push(hostname);
        if (ip) metaParts.push(ip);
        if (version) metaParts.push(version);

        text('dashPlayerName', (data && data.app && data.app.name) || 'CLESS Player');
        text('deviceHeroName', (data && data.app && data.app.name) || 'CLESS Player');
        text('dashPlayerMeta', metaParts.length ? metaParts.join(' · ') : 'Device details unavailable');
        text('deviceHeroMeta', metaParts.length ? metaParts.join(' · ') : 'Hostname and network details appear when available.');
        text('dashPlayerVersion', version || 'No data');
        text('deviceAppVersion', version || 'No data');
        text('deviceElectronVersion', electron || 'No data');

        // Uptime not provided by current APIs
        var uptime = null;
        if (data && data.system && data.system.uptime != null) uptime = data.system.uptime;
        if (data && data.app && data.app.uptime != null) uptime = data.app.uptime;
        text('deviceUptime', formatUptime(uptime) || 'Unavailable');

        if (data && data.app && data.app.version) {
            // Server / player process responding with device info
            setStatus('dashServerStatus', 'Connected', 'success');
        }
    }

    function updateLicenseSummary(data) {
        lastLicense = data || null;
        var details = document.getElementById('deviceLicenseDetails');
        if (!data) {
            setStatus('deviceLicenseStatus', 'No data', 'neutral');
            if (details) details.innerHTML = '<p class="text-secondary">License status unavailable.</p>';
            return;
        }
        if (data.licenseValid) {
            setStatus('deviceLicenseStatus', 'Active', 'success');
        } else if (data.interfaces && data.interfaces.length) {
            setStatus('deviceLicenseStatus', 'Invalid', 'danger');
        } else {
            setStatus('deviceLicenseStatus', 'Unavailable', 'warning');
        }

        if (!details) return;
        var matched = data.matchedInterface || {};
        details.innerHTML =
            '<div class="info-grid">' +
            '<div class="info-item"><div class="info-label">Status</div><div class="info-value">' +
            (data.licenseValid ? 'Active' : 'Invalid / Inactive') + '</div></div>' +
            '<div class="info-item"><div class="info-label">Matched Interface</div><div class="info-value">' +
            (matched.interface || 'None') + '</div></div>' +
            '<div class="info-item"><div class="info-label">Interface Type</div><div class="info-value">' +
            (matched.type || '—') + '</div></div>' +
            '<div class="info-item"><div class="info-label">Reason</div><div class="info-value">' +
            (data.validationReason || (data.licenseValid ? 'Serial key matched' : 'Not validated')) +
            '</div></div></div>';
    }

    function markMonitorUnavailable() {
        setMeter('cpuUsage', 'cpuProgressBar', null);
        setMeter('memoryUsage', 'memoryProgressBar', null);
        setMeter('diskUsage', 'diskProgressBar', null);
        setMeter('deviceCpuUsage', 'deviceCpuProgressBar', null);
        setMeter('deviceMemUsage', 'deviceMemProgressBar', null);
        setMeter('deviceDiskUsage', 'deviceDiskProgressBar', null);
        text('diskUsageDetail', 'Unavailable');
        text('deviceCpuDetail', 'Unavailable');
        text('deviceMemDetail', 'Unavailable');
        text('deviceDiskDetail', 'Unavailable');
        $('#networkStats').html('<span class="text-secondary">Unavailable</span>');
        $('#dataUsageTotal').html('<span class="text-secondary">Unavailable</span>');
    }

    // Hook into existing functions after they load
    function patchEnhanced() {
        if (typeof window.refreshSystemMonitoring === 'function' && !window.refreshSystemMonitoring.__monitorPatched) {
            var originalRefresh = window.refreshSystemMonitoring;
            window.refreshSystemMonitoring = function () {
                originalRefresh.apply(this, arguments);
            };
            // Intercept jQuery success by wrapping after a short delay via ajaxPrefilter alternative:
            // Monkey-patch by observing DOM updates is fragile; instead wrap the ajax in a new implementation tip.
            window.refreshSystemMonitoring.__monitorPatched = true;
        }

        if (typeof window.displayDetailedLayoutInfo === 'function' && !window.displayDetailedLayoutInfo.__monitorPatched) {
            var originalLayout = window.displayDetailedLayoutInfo;
            window.displayDetailedLayoutInfo = function (layoutData) {
                originalLayout.apply(this, arguments);
                try { updatePlaybackFromLayout(layoutData); } catch (e) { /* ignore */ }
            };
            window.displayDetailedLayoutInfo.__monitorPatched = true;
        }

        if (typeof window.displayNetworkLicenseStatus === 'function' && !window.displayNetworkLicenseStatus.__monitorPatched) {
            var originalLicense = window.displayNetworkLicenseStatus;
            window.displayNetworkLicenseStatus = function (data) {
                originalLicense.apply(this, arguments);
                try { updateLicenseSummary(data); } catch (e) { /* ignore */ }
            };
            window.displayNetworkLicenseStatus.__monitorPatched = true;
        }
    }

    // Provide a cleaner refresh wrapper used by Device Status button
    function refreshDeviceStatus() {
        function safeCall(fn) {
            try { fn(); } catch (err) { console.warn('Device status refresh step failed:', err); }
        }
        if (typeof window.deviceinfo === 'function') safeCall(window.deviceinfo);
        if (typeof window.refreshSystemMonitoring === 'function') safeCall(window.refreshSystemMonitoring);
        if (typeof window.loadNetworkLicenseStatus === 'function') safeCall(window.loadNetworkLicenseStatus);
        if (typeof window.refreshLayoutDetails === 'function') safeCall(window.refreshLayoutDetails);
        else if (typeof window.getDetailedLayoutInfo === 'function') safeCall(window.getDetailedLayoutInfo);
    }

    // Public API used by patched monitoring success handler
    window.ClessMonitorUI = {
        updateFromMonitor: updateFromMonitor,
        updateFromDeviceInfo: updateFromDeviceInfo,
        updatePlaybackFromLayout: updatePlaybackFromLayout,
        updateLicenseSummary: updateLicenseSummary,
        markMonitorUnavailable: markMonitorUnavailable,
        refreshDeviceStatus: refreshDeviceStatus,
        setStatus: setStatus
    };

    $(function () {
        patchEnhanced();
        setInterval(patchEnhanced, 2000);

        var btn = document.getElementById('refreshDeviceStatus');
        if (btn) {
            btn.addEventListener('click', function () {
                if (window.ClessMonitoringService) {
                    window.ClessMonitoringService.refreshNow();
                } else {
                    refreshDeviceStatus();
                }
            });
        }

        // When monitoring data arrives, keep Last Updated indicators fresh
        if (window.ClessMonitoringService && typeof window.ClessMonitoringService.subscribe === 'function') {
            window.ClessMonitoringService.subscribe(function (event) {
                if (event && event.type === 'updated') {
                    window.ClessMonitoringService.updateLastUpdatedUi();
                }
            });
        }
    });
})(window, document, window.jQuery);
