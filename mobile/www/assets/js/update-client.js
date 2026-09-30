/**
 * Shared CLESS-Player update client.
 * Works from Control Panel (HTTP /api/updates/*) and Configure (IPC).
 * Single source of status rendering for Configure + Settings.
 */
(function (window) {
    'use strict'

    function hasIpc() {
        return !!(window.ipcRenderer && typeof window.ipcRenderer.invoke === 'function')
    }

    function apiBase() {
        if (typeof window !== 'undefined' && window.location && /^https?:/i.test(window.location.protocol)) {
            return ''
        }
        return 'http://127.0.0.1:9000'
    }

    async function httpJson(method, path, body) {
        const opts = {
            method: method,
            headers: { Accept: 'application/json' }
        }
        if (body !== undefined) {
            opts.headers['Content-Type'] = 'application/json'
            opts.body = JSON.stringify(body)
        }
        const response = await fetch(apiBase() + path, opts)
        let data = null
        try {
            data = await response.json()
        } catch (e) {
            data = null
        }
        if (!response.ok) {
            const err = new Error((data && data.message) || 'Update request failed.')
            err.status = response.status
            err.data = data
            throw err
        }
        return data
    }

    async function getStatus() {
        if (hasIpc()) {
            try {
                const viaIpc = await window.ipcRenderer.invoke('updates-status')
                if (viaIpc) return viaIpc
            } catch (e) {
                /* fall through to HTTP */
            }
        }
        return httpJson('GET', '/api/updates/status')
    }

    async function checkForUpdates() {
        if (hasIpc()) {
            try {
                const viaIpc = await window.ipcRenderer.invoke('updates-check')
                if (viaIpc) return viaIpc
            } catch (e) {
                /* fall through to HTTP */
            }
        }
        const data = await httpJson('POST', '/api/updates/check', {})
        return (data && data.update) || data
    }

    async function installUpdate() {
        if (hasIpc()) {
            try {
                return await window.ipcRenderer.invoke('updates-install')
            } catch (e) {
                /* fall through to HTTP */
            }
        }
        return httpJson('POST', '/api/updates/install', {})
    }

    function formatStatusMessage(status) {
        if (!status) return 'Update status unavailable.'
        if (status.message) return status.message
        switch (status.state) {
            case 'checking':
                return 'Checking for updates...'
            case 'uptodate':
                return 'You are up to date.'
            case 'available':
                return status.latestVersion
                    ? 'Update available: v' + status.latestVersion
                    : 'Update available.'
            case 'downloading':
                return status.progress && typeof status.progress.percent === 'number'
                    ? 'Downloading update... ' + status.progress.percent + '%'
                    : 'Downloading update...'
            case 'downloaded':
                return 'Update downloaded. Restart required.'
            case 'installing':
                return 'Installing update and restarting...'
            case 'unsupported':
                return 'Auto-update is available only in packaged installs.'
            case 'error':
                return 'Update check failed. The Player will continue running normally.'
            default:
                return 'Update service idle.'
        }
    }

    function alertClassForState(state) {
        if (state === 'uptodate') return 'alert-success'
        if (state === 'available' || state === 'downloading' || state === 'downloaded' || state === 'installing') {
            return 'alert-info'
        }
        if (state === 'error') return 'alert-danger'
        if (state === 'checking') return 'alert-warning'
        if (state === 'unsupported') return 'alert-secondary'
        return 'alert-secondary'
    }

    /**
     * Render update status into common DOM ids used by Configure + Settings.
     * @param {object} status
     * @param {object} [opts]
     * @param {string} [opts.statusEl='#appUpdateStatus']
     * @param {string} [opts.versionEl='#appVersionLabel']
     * @param {string} [opts.installBtn='#installUpdateBtn']
     */
    function renderStatus(status, opts) {
        opts = opts || {}
        const $ = window.jQuery || window.$
        if (!$) return status

        const statusEl = $(opts.statusEl || '#appUpdateStatus')
        const versionEl = $(opts.versionEl || '#appVersionLabel')
        const installBtn = $(opts.installBtn || '#installUpdateBtn')
        if (!statusEl.length) return status

        const state = (status && status.state) || 'idle'
        const version = (status && status.currentVersion) || '—'
        const message = formatStatusMessage(status)

        statusEl
            .removeClass('alert-secondary alert-success alert-info alert-danger alert-warning')
            .addClass(alertClassForState(state))
            .text(message)

        if (versionEl.length) {
            versionEl.text('Current version: v' + version)
        }

        if (installBtn.length) {
            const canInstall = !!(status && status.downloaded && state === 'downloaded')
            installBtn.prop('disabled', !canInstall)
        }

        const autoCheckEl = $(opts.autoCheckEl || '#autoCheckUpdates')
        if (autoCheckEl.length && status && typeof status.autoCheckUpdates === 'boolean') {
            autoCheckEl.prop('checked', status.autoCheckUpdates)
        }
        const autoInstallEl = $(opts.autoInstallEl || '#autoInstallUpdates')
        if (autoInstallEl.length && status && typeof status.autoInstallUpdates === 'boolean') {
            autoInstallEl.prop('checked', status.autoInstallUpdates)
        }

        return status
    }

    function subscribe(handler) {
        if (typeof handler !== 'function') return function () {}
        if (hasIpc()) {
            const listener = function (_event, status) {
                handler(status || {})
            }
            window.ipcRenderer.on('app-update-status', listener)
            return function () {
                if (window.ipcRenderer.removeListener) {
                    window.ipcRenderer.removeListener('app-update-status', listener)
                }
            }
        }
        return function () {}
    }

    window.ClessUpdateClient = {
        getStatus: getStatus,
        checkForUpdates: checkForUpdates,
        installUpdate: installUpdate,
        renderStatus: renderStatus,
        formatStatusMessage: formatStatusMessage,
        subscribe: subscribe
    }
})(window)
