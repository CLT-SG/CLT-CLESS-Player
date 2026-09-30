/**
 * CLESS-Player Configure page — form bind/save + shared update client.
 */
(function (window, document, $) {
    'use strict'

    var THEME_KEY = 'cless-cpanel-theme'
    var SIDEBAR_KEY = 'cless-cpanel-sidebar-collapsed'
    var currentConfig = null
    var saving = false

    function safeStorageGet(key, fallback) {
        try {
            var value = window.localStorage.getItem(key)
            return value == null ? fallback : value
        } catch (err) {
            return fallback
        }
    }

    function safeStorageSet(key, value) {
        try {
            window.localStorage.setItem(key, value)
            return true
        } catch (err) {
            return false
        }
    }

    function applyTheme(theme) {
        var next = theme === 'dark' ? 'dark' : 'light'
        document.documentElement.setAttribute('data-theme', next)
        safeStorageSet(THEME_KEY, next)
        return next
    }

    function toggleTheme() {
        var current = document.documentElement.getAttribute('data-theme') || 'light'
        applyTheme(current === 'dark' ? 'light' : 'dark')
    }

    function setSidebarCollapsed(collapsed) {
        var shell = document.querySelector('.app-shell')
        if (!shell) return
        shell.classList.toggle('sidebar-collapsed', !!collapsed)
        safeStorageSet(SIDEBAR_KEY, collapsed ? '1' : '0')
    }

    function openMobileSidebar() {
        document.querySelector('.app-shell').classList.add('sidebar-open')
        var backdrop = document.getElementById('sidebarBackdrop')
        if (backdrop) backdrop.hidden = false
    }

    function closeMobileSidebar() {
        document.querySelector('.app-shell').classList.remove('sidebar-open')
        var backdrop = document.getElementById('sidebarBackdrop')
        if (backdrop) backdrop.hidden = true
    }

    function bindChrome() {
        var themeBtn = document.getElementById('themeToggle')
        var themeBtnMobile = document.getElementById('themeToggleMobile')
        if (themeBtn) themeBtn.addEventListener('click', toggleTheme)
        if (themeBtnMobile) themeBtnMobile.addEventListener('click', toggleTheme)

        var collapseBtn = document.getElementById('sidebarCollapseBtn')
        if (collapseBtn) {
            collapseBtn.addEventListener('click', function () {
                var shell = document.querySelector('.app-shell')
                setSidebarCollapsed(!shell.classList.contains('sidebar-collapsed'))
            })
        }

        var openBtn = document.getElementById('sidebarOpenBtn')
        var backdrop = document.getElementById('sidebarBackdrop')
        if (openBtn) openBtn.addEventListener('click', openMobileSidebar)
        if (backdrop) backdrop.addEventListener('click', closeMobileSidebar)

        document.querySelectorAll('[data-cpanel-nav]').forEach(function (el) {
            el.addEventListener('click', function () {
                var section = el.getAttribute('data-cpanel-nav')
                var url = 'http://127.0.0.1:9000/#' + (section || 'dashboard')
                window.open(url, '_blank')
            })
        })

        var advanced = document.getElementById('advancedConfigDetails')
        if (advanced) {
            advanced.addEventListener('toggle', function () {
                safeStorageSet('cless-configure-advanced-open', advanced.open ? '1' : '0')
            })
            if (safeStorageGet('cless-configure-advanced-open', '0') === '1') {
                advanced.open = true
            }
        }
    }

    function val(id) {
        return $('#' + id).val()
    }

    function checked(id) {
        return $('#' + id).is(':checked')
    }

    function setSelect(id, value) {
        var $el = $('#' + id)
        if (!$el.length) return
        if ($el.find('option[value="' + value + '"]').length) {
            $el.val(value)
        }
    }

    function populateForm(configData) {
        if (!configData) return
        currentConfig = configData

        $('#hostserver').val(configData.hostserver || '')
        $('#dsid').val(configData.id || '')
        setSelect('mode', configData.mode || 'online')
        setSelect('corsproxy', configData.corsproxy || 'N')
        $('#timeout').val(configData.timeout != null ? configData.timeout : 10000)
        $('#serialkey').val('')
        $('#serialkey').attr(
            'placeholder',
            configData.serialkey ? 'Current key is set (enter new key to update)' : 'Enter license serial key'
        )

        var autoStartup = configData.autoStartup
        if (autoStartup === undefined && configData.autostartup !== undefined) {
            autoStartup = configData.autostartup === 'Y' || configData.autostartup === true
        }
        $('#autoStartup').prop('checked', !!autoStartup)
        $('#fullscreenMode').prop('checked', configData.fullscreenMode !== false)
        $('#screenOnOff').prop('checked', configData.screenOnOff !== false)
        $('#screenTimeout').val(configData.screenTimeout != null ? configData.screenTimeout : 0)
        $('#updateInterval').val(configData.updateInterval != null ? configData.updateInterval : 30)
        setSelect('logLevel', configData.logLevel || 'info')

        var display = configData.displaySettings || {}
        setSelect('displayResolution', display.resolution || 'auto')
        setSelect('displayOrientation', display.orientation || 'landscape')
        setSelect('displayColorProfile', display.colorProfile || 'default')
        $('#displayPowerManagement').prop('checked', display.powerManagement !== false)

        var network = configData.networkSettings || {}
        $('#networkAutoConnect').prop('checked', network.autoConnect !== false)
        setSelect('networkPreferredInterface', network.preferredInterface || 'auto')
        $('#networkRetryAttempts').val(network.retryAttempts != null ? network.retryAttempts : 3)
        $('#networkRetryDelay').val(network.retryDelay != null ? network.retryDelay : 5000)

        var media = configData.mediaSettings || {}
        $('#mediaDefaultVolume').val(media.defaultVolume != null ? media.defaultVolume : 50)
        $('#mediaAutoPlay').prop('checked', media.autoPlay !== false)
        $('#mediaLoopMedia').prop('checked', media.loopMedia !== false)
        $('#mediaHardwareAcceleration').prop('checked', media.hardwareAcceleration !== false)

        var system = configData.systemSettings || {}
        $('#enableRemoteControl').prop('checked', system.enableRemoteControl !== false)
        $('#allowShutdown').prop('checked', system.allowShutdown !== false)
        $('#enableSystemInfo').prop('checked', system.enableSystemInfo !== false)
        $('#enableVNC').prop('checked', system.enableVNC !== false)
        $('#vncPort').val(system.vncPort != null ? system.vncPort : 5900)
        $('#cpanelPort').val(system.cpanelPort != null ? system.cpanelPort : 9000)
        $('#autoCheckUpdates').prop(
            'checked',
            typeof system.autoCheckUpdates === 'boolean' ? system.autoCheckUpdates : true
        )
        $('#autoInstallUpdates').prop('checked', !!system.autoInstallUpdates)
        $('#updateCheckIntervalHours').val(
            system.updateCheckIntervalHours != null ? system.updateCheckIntervalHours : 6
        )

        var sync = configData.syncSettings || {}
        setSelect('syncMode', sync.syncMode || 'disabled')
        $('#syncIsMaster').prop('checked', !!sync.isMaster)
        $('#syncMasterServerAddress').val(sync.masterServerAddress || 'localhost')
        $('#syncMasterServerPort').val(sync.masterServerPort != null ? sync.masterServerPort : 9000)
        $('#syncInterval').val(sync.syncInterval != null ? sync.syncInterval : 5000)
        $('#syncVideoThreshold').val(sync.videoSyncThreshold != null ? sync.videoSyncThreshold : 0.5)
        $('#syncLayoutEnabled').prop('checked', sync.layoutSyncEnabled !== false)
        $('#syncVideoEnabled').prop('checked', sync.videoSyncEnabled !== false)
        $('#syncMasterBroadcastInterval').val(
            sync.masterBroadcastInterval != null ? sync.masterBroadcastInterval : 1000
        )
        $('#syncNetworkTimeout').val(sync.networkTimeout != null ? sync.networkTimeout : 10000)

        $('#configVersionLabel').text(configData.version || '—')
        $('#configTimestampLabel').text(configData.timestamp || '—')
    }

    function gatherConfigArgs() {
        var serialInput = ($('#serialkey').val() || '').trim()
        var args = {
            hostaddress: ($('#hostserver').val() || '').trim(),
            dsid: ($('#dsid').val() || '').trim(),
            mode: val('mode') || 'online',
            corsproxy: val('corsproxy') || 'N',
            autostartup: checked('autoStartup') ? 'Y' : 'N',
            serialkey: serialInput,
            timeout: parseInt(val('timeout'), 10) || 10000,
            fullscreenMode: checked('fullscreenMode'),
            screenOnOff: checked('screenOnOff'),
            screenTimeout: parseInt(val('screenTimeout'), 10) || 0,
            updateInterval: parseInt(val('updateInterval'), 10) || 30,
            logLevel: val('logLevel') || 'info',
            displaySettings: {
                resolution: val('displayResolution') || 'auto',
                orientation: val('displayOrientation') || 'landscape',
                colorProfile: val('displayColorProfile') || 'default',
                powerManagement: checked('displayPowerManagement')
            },
            networkSettings: {
                autoConnect: checked('networkAutoConnect'),
                preferredInterface: val('networkPreferredInterface') || 'auto',
                retryAttempts: parseInt(val('networkRetryAttempts'), 10) || 3,
                retryDelay: parseInt(val('networkRetryDelay'), 10) || 5000
            },
            mediaSettings: {
                defaultVolume: Math.max(0, Math.min(100, parseInt(val('mediaDefaultVolume'), 10) || 50)),
                autoPlay: checked('mediaAutoPlay'),
                loopMedia: checked('mediaLoopMedia'),
                hardwareAcceleration: checked('mediaHardwareAcceleration')
            },
            systemSettings: {
                enableRemoteControl: checked('enableRemoteControl'),
                allowShutdown: checked('allowShutdown'),
                enableSystemInfo: checked('enableSystemInfo'),
                enableVNC: checked('enableVNC'),
                vncPort: parseInt(val('vncPort'), 10) || 5900,
                cpanelPort: parseInt(val('cpanelPort'), 10) || 9000,
                autoCheckUpdates: checked('autoCheckUpdates'),
                autoInstallUpdates: checked('autoInstallUpdates'),
                updateCheckIntervalHours: Math.max(
                    1,
                    Math.min(168, parseInt(val('updateCheckIntervalHours'), 10) || 6)
                )
            },
            syncSettings: {
                syncMode: val('syncMode') || 'disabled',
                isMaster: checked('syncIsMaster'),
                masterServerAddress: (val('syncMasterServerAddress') || 'localhost').trim(),
                masterServerPort: parseInt(val('syncMasterServerPort'), 10) || 9000,
                syncInterval: parseInt(val('syncInterval'), 10) || 5000,
                videoSyncThreshold: parseFloat(val('syncVideoThreshold')) || 0.5,
                layoutSyncEnabled: checked('syncLayoutEnabled'),
                videoSyncEnabled: checked('syncVideoEnabled'),
                masterBroadcastInterval: parseInt(val('syncMasterBroadcastInterval'), 10) || 1000,
                networkTimeout: parseInt(val('syncNetworkTimeout'), 10) || 10000
            }
        }
        return args
    }

    function validateArgs(args) {
        if (!args.hostaddress) {
            return 'Server URL is required.'
        }
        try {
            // Allow host without protocol for legacy installs; prefer URL when absolute
            if (/^https?:\/\//i.test(args.hostaddress)) {
                // eslint-disable-next-line no-new
                new URL(args.hostaddress)
            }
        } catch (e) {
            return 'Server URL must be a valid URL (e.g. https://server.example.com/demo).'
        }
        var dsidNum = parseInt(args.dsid, 10)
        if (!args.dsid || isNaN(dsidNum) || dsidNum < 1 || dsidNum > 9999) {
            return 'Device ID must be a number between 1 and 9999.'
        }
        return null
    }

    async function showAlert(message, options) {
        options = options || {}
        if (typeof window.customAlert === 'function') {
            return window.customAlert(message, options)
        }
        window.alert(message)
    }

    function saveConfiguration() {
        if (saving) return
        var args = gatherConfigArgs()
        var error = validateArgs(args)
        if (error) {
            showAlert(error, { type: 'error', title: 'Validation Error' })
            return
        }

        var ipcRenderer = window.ipcRenderer
        if (!ipcRenderer) {
            showAlert('Configuration save requires the CLESS-Player application.', {
                type: 'error',
                title: 'Unavailable'
            })
            return
        }

        saving = true
        $('#saveConfig').prop('disabled', true).addClass('loading')
        ipcRenderer.send('app-configsave', args)
    }

    function bindSaveResponse() {
        var ipcRenderer = window.ipcRenderer
        if (!ipcRenderer) return

        ipcRenderer.on('config-save-response', async function (event, response) {
            saving = false
            $('#saveConfig').prop('disabled', false).removeClass('loading')

            if (response && response.success) {
                if (response.config) {
                    populateForm(response.config)
                }
                await showAlert(response.detail || response.message || 'Configuration saved.', {
                    type: 'success',
                    title: 'Configuration Saved',
                    timeout: 5000,
                    buttonText: 'OK'
                })
                ipcRenderer.send('app-reload')
            } else {
                await showAlert(
                    (response && response.error) || 'Failed to save configuration. Please try again.',
                    { type: 'error', title: 'Configuration Error', timeout: 5000 }
                )
            }
        })
    }

    async function refreshUpdateStatus() {
        if (!window.ClessUpdateClient) return
        try {
            var status = await window.ClessUpdateClient.getStatus()
            window.ClessUpdateClient.renderStatus(status)
        } catch (err) {
            window.ClessUpdateClient.renderStatus({
                state: 'error',
                message: 'Update check failed. The Player will continue running normally.',
                currentVersion: '—'
            })
        }
    }

    async function checkUpdatesNow() {
        if (!window.ClessUpdateClient) return
        window.ClessUpdateClient.renderStatus({
            state: 'checking',
            message: 'Checking for updates...',
            currentVersion: ($('#appVersionLabel').text().replace(/^Current version:\s*v?/i, '') || '—')
        })
        try {
            var status = await window.ClessUpdateClient.checkForUpdates()
            window.ClessUpdateClient.renderStatus(status)
        } catch (err) {
            window.ClessUpdateClient.renderStatus({
                state: 'error',
                message: 'Update check failed. Unable to reach update server.',
                currentVersion: '—'
            })
        }
    }

    async function installUpdateNow() {
        if (!window.ClessUpdateClient) return
        var ok = window.confirm('Install the downloaded update and restart CLESS-Player now?')
        if (!ok) return
        try {
            var status = await window.ClessUpdateClient.installUpdate()
            window.ClessUpdateClient.renderStatus(status || {
                state: 'installing',
                message: 'Installing update and restarting...'
            })
        } catch (err) {
            window.ClessUpdateClient.renderStatus({
                state: 'error',
                message: 'Update download failed. The current version will continue running.'
            })
        }
    }

    function bindActions() {
        $('#saveConfig').on('click', saveConfiguration)
        $('#exitConfig').on('click', function () {
            if (window.ipcRenderer) {
                window.ipcRenderer.send('app-reload')
            }
        })
        $('#reloadConfig').on('click', function () {
            if (window.configLoader && typeof window.configLoader.loadConfig === 'function') {
                window.configLoader.loadConfig().then(function (cfg) {
                    populateForm(cfg || window.configLoader.getAll())
                })
            } else if (currentConfig) {
                populateForm(currentConfig)
            }
        })
        $('#checkForUpdatesSecondary, #checkForUpdates').on('click', checkUpdatesNow)
        $('#installUpdateBtn').on('click', installUpdateNow)
    }

    function tryPopulate() {
        if (window.configLoader && window.configLoader.config) {
            populateForm(window.configLoader.getAll())
            return true
        }
        if (window.config && window.config.hostserver) {
            populateForm(window.config)
            return true
        }
        return false
    }

    function init() {
        var savedTheme = safeStorageGet(THEME_KEY, null)
        if (!savedTheme) {
            savedTheme =
                window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
                    ? 'dark'
                    : 'light'
        }
        applyTheme(savedTheme)
        if (safeStorageGet(SIDEBAR_KEY, '0') === '1' && window.innerWidth >= 992) {
            setSidebarCollapsed(true)
        }

        bindChrome()
        bindActions()
        bindSaveResponse()

        window.addEventListener('configLoaded', function (event) {
            populateForm((event.detail && event.detail.config) || window.configLoader.getAll())
        })

        if (!tryPopulate()) {
            var attempts = 0
            var timer = setInterval(function () {
                attempts += 1
                if (tryPopulate() || attempts > 20) {
                    clearInterval(timer)
                }
            }, 250)
        }

        refreshUpdateStatus()
        if (window.ClessUpdateClient && typeof window.ClessUpdateClient.subscribe === 'function') {
            window.ClessUpdateClient.subscribe(function (status) {
                window.ClessUpdateClient.renderStatus(status)
            })
        }
        setInterval(refreshUpdateStatus, 30000)
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init)
    } else {
        init()
    }
})(window, document, window.jQuery)
