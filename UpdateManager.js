'use strict'

/**
 * GitHub Releases auto-update for CLESS-Player.
 *
 * Uses electron-updater against the project's GitHub Releases feed.
 * Automatic startup/background checks run only for installed/production
 * (packaged) builds. Development/source launches never contact the update
 * server automatically. Failures never throw into the app startup path —
 * digital signage playback must continue when GitHub is unreachable.
 */

const { app } = require('electron')
const { isProductionInstall } = require('./update-runtime')

const GITHUB_OWNER = 'CLT-SG'
const GITHUB_REPO = 'CLT-CLESS-Player'
const DEFAULT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours
const STARTUP_CHECK_DELAY_MS = 12 * 1000 // let playback settle, then check promptly
const DEV_UNSUPPORTED_MESSAGE =
    'Development mode detected — automatic update disabled. Manual checks are unavailable until the app is packaged/installed.'

class UpdateManager {
    constructor(options = {}) {
        this.log = options.log || console
        this.getConfig = typeof options.getConfig === 'function' ? options.getConfig : () => ({})
        this.onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {}
        // Optional override for tests; defaults to Electron app
        this._app = options.app || app

        this.autoUpdater = null
        this.checkTimer = null
        this.startupCheckTimer = null
        this.busy = false
        this.initialized = false
        this.allowQuitForInstall = false
        this.startupCheckScheduled = false

        const production = this.isProduction()
        this.status = {
            state: 'idle',
            message: 'Update service idle.',
            currentVersion: this._app.getVersion(),
            latestVersion: null,
            progress: null,
            error: null,
            checkedAt: null,
            downloaded: false,
            packaged: production,
            production: production,
            developmentMode: !production
        }
    }

    isProduction() {
        return isProductionInstall(this._app)
    }

    getStatus() {
        const production = this.isProduction()
        return {
            ...this.status,
            currentVersion: this._app.getVersion(),
            packaged: production,
            production: production,
            developmentMode: !production,
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
        const production = this.isProduction()
        this.status = {
            ...this.status,
            ...partial,
            currentVersion: this._app.getVersion(),
            packaged: production,
            production: production,
            developmentMode: !production
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

        this.log.info('UpdateManager: initializing. Current version:', this._app.getVersion())

        // Development / source / unpackaged Electron — never auto-check or schedule.
        if (!this.isProduction()) {
            this._setStatus({
                state: 'unsupported',
                message: DEV_UNSUPPORTED_MESSAGE
            })
            this.log.info(
                'UpdateManager: Development mode detected - automatic update disabled'
            )
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
            this._scheduleStartupCheck()
        } catch (error) {
            this.log.error('UpdateManager: initialization failed:', error)
            this._setStatus({
                state: 'error',
                message: 'Update failed.',
                error: error.message
            })
        }
    }

    _scheduleStartupCheck() {
        if (!this.isProduction()) {
            return
        }
        if (this.startupCheckScheduled) {
            return
        }
        if (!this._readAutoCheck()) {
            this.log.info('UpdateManager: startup update check disabled by Auto Update setting.')
            return
        }
        this.startupCheckScheduled = true
        this.startupCheckTimer = setTimeout(() => {
            this.startupCheckTimer = null
            if (!this.isProduction() || !this._readAutoCheck()) {
                return
            }
            this.checkForUpdates({ source: 'startup' }).catch(() => {})
        }, STARTUP_CHECK_DELAY_MS)
        if (typeof this.startupCheckTimer.unref === 'function') {
            this.startupCheckTimer.unref()
        }
        this.log.info(
            `UpdateManager: startup update check scheduled in ${Math.round(STARTUP_CHECK_DELAY_MS / 1000)}s`
        )
    }

    _bindEvents() {
        const updater = this.autoUpdater

        updater.on('checking-for-update', () => {
            this.log.info('UpdateManager: update check started. Current version:', this._app.getVersion())
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
            const latest = info && info.version ? info.version : this._app.getVersion()
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
                message: 'Update check failed. Unable to reach update server. The Player will continue running normally.',
                error: message,
                progress: null
            })
        })
    }

    _clearPeriodicChecks() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer)
            this.checkTimer = null
        }
    }

    _schedulePeriodicChecks() {
        this._clearPeriodicChecks()

        // Never create background timers outside packaged/production installs.
        if (!this.isProduction() || !this.autoUpdater) {
            this.log.info(
                'UpdateManager: periodic update checks skipped (not a production/installed app).'
            )
            return
        }
        if (!this._readAutoCheck()) {
            this.log.info('UpdateManager: periodic update checks disabled by Auto Update setting.')
            return
        }
        const interval = this._readCheckIntervalMs()
        this.log.info(`UpdateManager: periodic check interval ${Math.round(interval / 3600000)}h`)
        this.checkTimer = setInterval(() => {
            if (!this.isProduction() || !this._readAutoCheck()) {
                return
            }
            this.checkForUpdates({ source: 'periodic' }).catch(() => {})
        }, interval)
        if (typeof this.checkTimer.unref === 'function') {
            this.checkTimer.unref()
        }
    }

    reloadSettings() {
        // Re-evaluate scheduler from current config; still production-only.
        this._schedulePeriodicChecks()
        const token = this._readGithubToken()
        if (this.autoUpdater && this.isProduction()) {
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
        this._setStatus({
            autoCheckUpdates: this._readAutoCheck(),
            autoInstallUpdates: this._readAutoInstall()
        })
    }

    async checkForUpdates(options = {}) {
        const source = options.source || 'manual'
        if (!this.isProduction() || !this.autoUpdater) {
            this.log.info(
                `UpdateManager: check skipped (${source}) — development/unpackaged mode; no update server contact.`
            )
            this._setStatus({
                state: 'unsupported',
                message: DEV_UNSUPPORTED_MESSAGE
            })
            return this.getStatus()
        }
        if (this.busy) {
            this.log.info('UpdateManager: check skipped, update process already running.')
            return this.getStatus()
        }

        this.busy = true
        this.log.info(`UpdateManager: check requested (${source}). Current version:`, this._app.getVersion())
        try {
            await this.autoUpdater.checkForUpdates()
            return this.getStatus()
        } catch (error) {
            const message = error && error.message ? error.message : String(error)
            this.log.error('UpdateManager: check failed (continuing playback):', message)
            this.busy = false
            this._setStatus({
                state: 'error',
                message: 'Update check failed. Unable to reach update server. The Player will continue running normally.',
                error: message
            })
            return this.getStatus()
        }
    }

    async quitAndInstall(options = {}) {
        const source = options.source || 'manual'
        if (!this.isProduction() || !this.autoUpdater || !this.status.downloaded) {
            throw new Error(
                this.isProduction()
                    ? 'No downloaded update is ready to install.'
                    : 'Update installation is available only in packaged installs.'
            )
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

    /**
     * Clear startup/periodic timers. Safe to call multiple times.
     */
    dispose() {
        if (this.startupCheckTimer) {
            clearTimeout(this.startupCheckTimer)
            this.startupCheckTimer = null
        }
        this._clearPeriodicChecks()
        this.busy = false
        this.log.info('UpdateManager: disposed (timers cleared).')
    }
}

module.exports = UpdateManager
module.exports.GITHUB_OWNER = GITHUB_OWNER
module.exports.GITHUB_REPO = GITHUB_REPO
module.exports.STARTUP_CHECK_DELAY_MS = STARTUP_CHECK_DELAY_MS
module.exports.DEV_UNSUPPORTED_MESSAGE = DEV_UNSUPPORTED_MESSAGE
module.exports.isProductionInstall = isProductionInstall
