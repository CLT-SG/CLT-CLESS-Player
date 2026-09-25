'use strict'

/**
 * GitHub Releases auto-update for CLESS-Player.
 *
 * Uses electron-updater against the project's GitHub Releases feed.
 * Failures never throw into the app startup path — digital signage
 * playback must continue when GitHub is unreachable.
 */

const path = require('path')
const { app } = require('electron')

const GITHUB_OWNER = 'CLT-SG'
const GITHUB_REPO = 'CLT-CLESS-Player'
const DEFAULT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours
const STARTUP_CHECK_DELAY_MS = 45 * 1000 // let playback settle first

class UpdateManager {
    constructor(options = {}) {
        this.log = options.log || console
        this.getConfig = typeof options.getConfig === 'function' ? options.getConfig : () => ({})
        this.onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {}

        this.autoUpdater = null
        this.checkTimer = null
        this.busy = false
        this.initialized = false
        this.allowQuitForInstall = false

        this.status = {
            state: 'idle',
            message: 'Update service idle.',
            currentVersion: app.getVersion(),
            latestVersion: null,
            progress: null,
            error: null,
            checkedAt: null,
            downloaded: false,
            packaged: app.isPackaged
        }
    }

    getStatus() {
        return {
            ...this.status,
            currentVersion: app.getVersion(),
            packaged: app.isPackaged,
            busy: this.busy,
            autoInstallUpdates: this._readAutoInstall(),
            autoCheckUpdates: this._readAutoCheck()
        }
    }

    _readSystemSettings() {
        try {
            const config = this.getConfig() || {}
            return config.systemSettings || {}
        } catch (error) {
            this.log.warn('UpdateManager: failed to read config:', error.message)
            return {}
        }
    }

    _readAutoCheck() {
        const settings = this._readSystemSettings()
        if (typeof settings.autoCheckUpdates === 'boolean') {
            return settings.autoCheckUpdates
        }
        return true
    }

    _readAutoInstall() {
        const settings = this._readSystemSettings()
        return settings.autoInstallUpdates === true
    }

    _readCheckIntervalMs() {
        const settings = this._readSystemSettings()
        const hours = Number(settings.updateCheckIntervalHours)
        if (Number.isFinite(hours) && hours >= 1 && hours <= 168) {
            return Math.floor(hours * 60 * 60 * 1000)
        }
        return DEFAULT_CHECK_INTERVAL_MS
    }

    _readGithubToken() {
        const settings = this._readSystemSettings()
        return (
            settings.githubToken ||
            process.env.GH_TOKEN ||
            process.env.GITHUB_TOKEN ||
            ''
        )
    }

    _setStatus(partial) {
        this.status = {
            ...this.status,
            ...partial,
            currentVersion: app.getVersion()
        }
        try {
            this.onStatus(this.getStatus())
        } catch (error) {
            this.log.warn('UpdateManager: status listener error:', error.message)
        }
    }

    initialize() {
        if (this.initialized) {
            return
        }
        this.initialized = true

        this.log.info('UpdateManager: initializing. Current version:', app.getVersion())

        if (!app.isPackaged) {
            this._setStatus({
                state: 'unsupported',
                message: 'Auto-update is available only in packaged installs.'
            })
            this.log.info('UpdateManager: skipped (not packaged).')
            return
        }

        try {
            const { autoUpdater } = require('electron-updater')
            this.autoUpdater = autoUpdater
            this.autoUpdater.logger = this.log
            this.autoUpdater.autoDownload = true
            this.autoUpdater.autoInstallOnAppQuit = true
            this.autoUpdater.allowDowngrade = false
            this.autoUpdater.allowPrerelease = false

            const token = this._readGithubToken()
            const feed = {
                provider: 'github',
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO
            }
            if (token) {
                feed.private = true
                feed.token = token
            }
            this.autoUpdater.setFeedURL(feed)
            this.log.info(
                `UpdateManager: feed github.com/${GITHUB_OWNER}/${GITHUB_REPO}` +
                    (token ? ' (private token configured)' : ' (public)')
            )

            this._bindEvents()
            this._schedulePeriodicChecks()

            if (this._readAutoCheck()) {
                setTimeout(() => {
                    this.checkForUpdates({ source: 'startup' }).catch(() => {})
                }, STARTUP_CHECK_DELAY_MS)
            }
        } catch (error) {
            this.log.error('UpdateManager: initialization failed:', error)
            this._setStatus({
                state: 'error',
                message: 'Update failed.',
                error: error.message
            })
        }
    }

    _bindEvents() {
        const updater = this.autoUpdater

        updater.on('checking-for-update', () => {
            this.log.info('UpdateManager: update check started. Current version:', app.getVersion())
            this._setStatus({
                state: 'checking',
                message: 'Checking for updates...',
                error: null,
                progress: null
            })
        })

        updater.on('update-available', (info) => {
            const latest = info && info.version ? info.version : null
            this.log.info('UpdateManager: update available. Latest version:', latest)
            this._setStatus({
                state: 'available',
                message: latest ? `New version available: v${latest}` : 'New version available.',
                latestVersion: latest,
                checkedAt: new Date().toISOString()
            })
        })

        updater.on('update-not-available', (info) => {
            const latest = info && info.version ? info.version : app.getVersion()
            this.log.info('UpdateManager: you are using the latest version.', latest)
            this.busy = false
            this._setStatus({
                state: 'uptodate',
                message: 'You are using the latest version.',
                latestVersion: latest,
                checkedAt: new Date().toISOString(),
                progress: null,
                downloaded: false
            })
        })

        updater.on('download-progress', (progress) => {
            const percent = progress && typeof progress.percent === 'number'
                ? Math.max(0, Math.min(100, Math.round(progress.percent)))
                : 0
            this.log.info(`UpdateManager: downloading update... ${percent}%`)
            this._setStatus({
                state: 'downloading',
                message: `Downloading update... ${percent}%`,
                progress: {
                    percent,
                    transferred: progress.transferred,
                    total: progress.total,
                    bytesPerSecond: progress.bytesPerSecond
                }
            })
        })

        updater.on('update-downloaded', (info) => {
            const latest = info && info.version ? info.version : this.status.latestVersion
            this.log.info('UpdateManager: download completed. Latest version:', latest)
            this.busy = false
            this._setStatus({
                state: 'downloaded',
                message: 'Update downloaded. Restart to apply.',
                latestVersion: latest,
                progress: { percent: 100 },
                downloaded: true
            })

            if (this._readAutoInstall()) {
                this.log.info('UpdateManager: auto-install enabled. Restart requested.')
                setTimeout(() => {
                    this.quitAndInstall({ source: 'auto' }).catch((error) => {
                        this.log.error('UpdateManager: auto-install failed:', error.message)
                    })
                }, 5000)
            }
        })

        updater.on('error', (error) => {
            const message = error && error.message ? error.message : String(error)
            this.log.error('UpdateManager: update failure reason:', message)
            this.busy = false
            this._setStatus({
                state: 'error',
                message: 'Update failed.',
                error: message,
                progress: null
            })
        })
    }

    _schedulePeriodicChecks() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer)
            this.checkTimer = null
        }
        if (!this._readAutoCheck()) {
            this.log.info('UpdateManager: periodic update checks disabled.')
            return
        }
        const interval = this._readCheckIntervalMs()
        this.log.info(`UpdateManager: periodic check interval ${Math.round(interval / 3600000)}h`)
        this.checkTimer = setInterval(() => {
            if (!this._readAutoCheck()) {
                return
            }
            this.checkForUpdates({ source: 'periodic' }).catch(() => {})
        }, interval)
        if (typeof this.checkTimer.unref === 'function') {
            this.checkTimer.unref()
        }
    }

    reloadSettings() {
        this._schedulePeriodicChecks()
        const token = this._readGithubToken()
        if (this.autoUpdater) {
            try {
                const feed = {
                    provider: 'github',
                    owner: GITHUB_OWNER,
                    repo: GITHUB_REPO
                }
                if (token) {
                    feed.private = true
                    feed.token = token
                }
                this.autoUpdater.setFeedURL(feed)
            } catch (error) {
                this.log.warn('UpdateManager: failed to refresh feed settings:', error.message)
            }
        }
    }

    async checkForUpdates(options = {}) {
        const source = options.source || 'manual'
        if (!app.isPackaged || !this.autoUpdater) {
            const status = this.getStatus()
            status.state = 'unsupported'
            status.message = 'Auto-update is available only in packaged installs.'
            return status
        }
        if (this.busy) {
            this.log.info('UpdateManager: check skipped, update process already running.')
            return this.getStatus()
        }

        this.busy = true
        this.log.info(`UpdateManager: check requested (${source}). Current version:`, app.getVersion())
        try {
            await this.autoUpdater.checkForUpdates()
            return this.getStatus()
        } catch (error) {
            const message = error && error.message ? error.message : String(error)
            this.log.error('UpdateManager: check failed (continuing playback):', message)
            this.busy = false
            this._setStatus({
                state: 'error',
                message: 'Update failed.',
                error: message
            })
            return this.getStatus()
        }
    }

    async quitAndInstall(options = {}) {
        const source = options.source || 'manual'
        if (!this.autoUpdater || !this.status.downloaded) {
            throw new Error('No downloaded update is ready to install.')
        }
        if (this.busy && source !== 'auto') {
            throw new Error('Another update process is already running.')
        }

        this.log.info(`UpdateManager: installation started (${source}).`)
        this.allowQuitForInstall = true
        this._setStatus({
            state: 'installing',
            message: 'Installing update and restarting...'
        })

        try {
            // isSilent=false so NSIS can run; isForceRunAfter=true restarts the app.
            this.autoUpdater.quitAndInstall(false, true)
            this.log.info('UpdateManager: restart requested.')
            return this.getStatus()
        } catch (error) {
            this.allowQuitForInstall = false
            this.log.error('UpdateManager: installation failed:', error.message)
            this._setStatus({
                state: 'error',
                message: 'Update failed.',
                error: error.message
            })
            throw error
        }
    }

    shouldAllowQuit() {
        return this.allowQuitForInstall === true
    }
}

module.exports = UpdateManager
module.exports.GITHUB_OWNER = GITHUB_OWNER
module.exports.GITHUB_REPO = GITHUB_REPO
