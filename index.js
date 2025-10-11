const {
    app,
    dialog,
    BrowserWindow,
    globalShortcut,
    ipcMain,
    screen, // Import the screen module from the electron package
    Menu
} = require('electron')
require('@electron/remote/main').initialize()

// Core modules (always needed)
const path = require('path')
const fs = require('fs')
const os = require('os')
const { exec } = require('child_process')

// Initialize optimization modules
const lazyLoader = require('./LazyModuleLoader')
const createCpanelServer = require('./cpanel')
const performanceMonitor = require('./PerformanceMonitor')

const homedir = os.homedir()
const appdir = path.normalize(homedir + '/clessapp')
const logdir = path.normalize(homedir + '/clessapp/logs/')

// Lazy load heavy modules
let axios, AutoLaunch, macaddress, Crypto, ping, si, date, log, now

// Async initialization of heavy modules
const initializeModules = async () => {
    const moduleLoadStartTime = Date.now()
    
    try {
        console.log('Loading modules...')
        
        // Initialize performance monitor
        await performanceMonitor.initialize()
        
        // Load modules in parallel for faster startup
        const modulePromises = [
            lazyLoader.loadModule('axios'),
            lazyLoader.loadModule('auto-launch'),
            lazyLoader.loadModule('macaddress'),
            lazyLoader.loadModule('crypto'),
            lazyLoader.loadModule('ping'),
            lazyLoader.loadModule('systeminformation'),
            lazyLoader.loadModule('date-and-time'),
            lazyLoader.loadModule('electron-log')
        ]
        
        const [
            axiosModule,
            AutoLaunchModule,
            macaddressModule,
            CryptoModule,
            pingModule,
            siModule,
            dateModule,
            logModule
        ] = await Promise.all(modulePromises)
        
        // Assign loaded modules
        axios = axiosModule
        AutoLaunch = AutoLaunchModule
        macaddress = macaddressModule
        Crypto = CryptoModule
        ping = pingModule
        si = siModule
        date = dateModule
        log = logModule
        now = new Date()
        
        const moduleLoadTime = Date.now() - moduleLoadStartTime
        performanceMonitor.recordStartupMilestone('moduleLoadTime', moduleLoadTime)
        
        console.log(`Modules loaded successfully in ${moduleLoadTime}ms`)
        return true
        
    } catch (error) {
        console.error('Failed to load modules:', error)
        throw error
    }
}

// Safe logging functions that work before module initialization
const safeLog = {
    info: (...args) => log ? log.info(...args) : console.log('[INFO]', ...args),
    error: (...args) => log ? log.error(...args) : console.error('[ERROR]', ...args),
    warn: (...args) => log ? log.warn(...args) : console.warn('[WARN]', ...args),
    debug: (...args) => log ? log.debug(...args) : console.log('[DEBUG]', ...args)
}

// Optimize console logging
const debug = (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') 
    ? (...args) => safeLog.debug(...args) 
    : () => {} // Disable debug logs in production

// Windows audio control (only available on Windows)
let winAudio = null
try {
    if (process.platform === 'win32') {
        winAudio = require('win-audio')
    }
} catch (error) {
    debug('win-audio package not available (not on Windows or not installed)')
}

//One instance process check
let win = null
let win2 = null
let blackScreenWin = null
let isMuted = false
let previousVolume = 1.0

//disable security warning
delete process.env.ELECTRON_ENABLE_SECURITY_WARNINGS
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true

const gotTheLock = app.requestSingleInstanceLock()

// Version comparison utility
function compareVersions(version1, version2) {
    const v1parts = version1.split('.').map(Number)
    const v2parts = version2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
        const v1part = v1parts[i] || 0
        const v2part = v2parts[i] || 0
        
        if (v1part < v2part) return -1
        if (v1part > v2part) return 1
    }
    return 0
}

// Upgrade existing config.json to newer version
async function upgradeConfigVersion(existingConfig, configJsonPath) {
    try {
        safeLog.info('Starting config version upgrade process')
        
        // Create backup of current config
        const backupPath = configJsonPath + '.backup.' + Date.now()
        fs.copyFileSync(configJsonPath, backupPath)
        safeLog.info('Current config backed up to:', backupPath)
        
        // Merge existing config with new features based on version
        const upgradedConfig = await applyVersionUpgrades(existingConfig)
        
        // Write upgraded config
        fs.writeFileSync(configJsonPath, JSON.stringify(upgradedConfig, null, 2))
        safeLog.info('Config successfully upgraded to version:', upgradedConfig.version)
        
        // Update migration flag
        const migrationFlagPath = path.join(path.dirname(configJsonPath), '.migration-v2-complete')
        fs.writeFileSync(migrationFlagPath, JSON.stringify({
            completedAt: new Date().toISOString(),
            upgradedFrom: existingConfig.version || 'unknown',
            targetVersion: upgradedConfig.version,
            upgradeType: 'version-upgrade'
        }, null, 2))
        
        // Show upgrade notification if app is ready
        if (app.isReady()) {
            const options = {
                type: 'info',
                buttons: ['Ok'],
                defaultId: 0,
                title: 'Configuration Upgraded',
                message: 'Your configuration has been upgraded to the latest version.',
                detail: `Configuration upgraded from v${existingConfig.version || 'unknown'} to v${upgradedConfig.version}\n\n` +
                       `New features added:\n` +
                       `• Multi-screen synchronization system\n` +
                       `• Enhanced layout and video coordination\n` +
                       `• Network resilient architecture\n\n` +
                       `Your previous config has been backed up.\n\n` +
                       `Access the control panel at: https://localhost:9000`
            }
            dialog.showMessageBox(null, options)
        }
        
    } catch (error) {
        safeLog.error('Config version upgrade failed:', error)
        throw error
    }
}

// Apply version-specific upgrades to config
async function applyVersionUpgrades(existingConfig) {
    const currentVersion = existingConfig.version || '1.0.0'
    let upgradedConfig = { ...existingConfig }
    
    safeLog.info('Applying upgrades from version:', currentVersion)
    
    // Upgrade to 2.4.0: Add syncSettings if missing
    if (compareVersions(currentVersion, '2.4.0') < 0) {
        safeLog.info('Applying 2.4.0 upgrade: Adding syncSettings')
        
        if (!upgradedConfig.syncSettings) {
            upgradedConfig.syncSettings = {
                syncMode: 'disabled',
                isMaster: false,
                syncInterval: 5000,
                videoSyncThreshold: 0.5,
                layoutSyncEnabled: true,
                videoSyncEnabled: true,
                masterBroadcastInterval: 1000,
                networkTimeout: 10000
            }
            safeLog.info('Added syncSettings to configuration')
        } else {
            // Ensure all sync settings are present (in case of partial config)
            const defaultSyncSettings = {
                syncMode: 'disabled',
                isMaster: false,
                syncInterval: 5000,
                videoSyncThreshold: 0.5,
                layoutSyncEnabled: true,
                videoSyncEnabled: true,
                masterBroadcastInterval: 1000,
                networkTimeout: 10000
            }
            
            upgradedConfig.syncSettings = {
                ...defaultSyncSettings,
                ...upgradedConfig.syncSettings
            }
            safeLog.info('Updated syncSettings with any missing properties')
        }
        
        upgradedConfig.version = '2.4.0'
        upgradedConfig.timestamp = new Date().toISOString()
    }
    
    // Future version upgrades can be added here
    // Example:
    // if (compareVersions(currentVersion, '2.5.0') < 0) {
    //     // Add 2.5.0 specific upgrades
    // }
    
    return upgradedConfig
}

// Configuration Migration Function
async function performConfigMigration() {
    const configJsPath = path.join(appdir, 'config.js')
    const configJsonPath = path.join(appdir, 'config.json')
    const migrationFlagPath = path.join(appdir, '.migration-v2-complete')

    try {
        // Check if migration has already been completed AND config.json actually exists
        if (fs.existsSync(migrationFlagPath) && fs.existsSync(configJsonPath)) {
            // Check if we need to update an existing config.json to newer version
            try {
                const existingConfig = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'))
                const currentVersion = existingConfig.version || '1.0.0'
                const targetVersion = '2.4.0'
                
                if (compareVersions(currentVersion, targetVersion) < 0) {
                    safeLog.info(`Config version upgrade needed: ${currentVersion} -> ${targetVersion}`)
                    await upgradeConfigVersion(existingConfig, configJsonPath)
                    return
                } else {
                    safeLog.info('Configuration is already up to date, version:', currentVersion)
                    return
                }
            } catch (error) {
                safeLog.warn('Failed to check config version, will proceed with normal migration check:', error)
            }
        }

        // If migration flag exists but config.json is missing, we need to recreate it
        if (fs.existsSync(migrationFlagPath) && !fs.existsSync(configJsonPath)) {
            log.warn('Migration flag exists but config.json is missing - recreating config.json')
            // Remove the incomplete migration flag so we can retry
            fs.unlinkSync(migrationFlagPath)
        }

        // Check if old config.js exists
        if (!fs.existsSync(configJsPath)) {
            safeLog.info('No existing config.js found, creating new config.json')
            await createDefaultConfigJson()
            fs.writeFileSync(migrationFlagPath, JSON.stringify({
                completedAt: new Date().toISOString(),
                migratedFrom: 'default',
                version: '2.4.0'
            }, null, 2))
            return
        }

        safeLog.info('Starting configuration migration from config.js to config.json')

        // Ensure appdir exists before proceeding
        if (!fs.existsSync(appdir)) {
            safeLog.info('Creating clessapp directory')
            fs.mkdirSync(appdir, { recursive: true })
        }

        // Load existing config.js
        delete require.cache[require.resolve(configJsPath)] // Clear cache
        const oldConfig = require(configJsPath)

        // Create new enhanced config.json based on existing settings
        const newConfig = {
            // Legacy settings from config.js
            hostserver: oldConfig.hostserver || 'https://cless4.closed-loop.biz/demo',
            id: oldConfig.id || '10',
            mode: oldConfig.mode || 'online',
            corsproxy: oldConfig.corsproxy || 'N',
            serialkey: oldConfig.serialkey || '1d74f3eda4dd9d1065a6216c84c27d67301779b76996dc867f4403d48f9ad91e',
            timeout: oldConfig.timeout || 10000,

            // New enhanced settings with defaults
            autoStartup: oldConfig.autostartup === 'Y' ? true : false,
            fullscreenMode: true,
            screenTimeout: 0,
            updateInterval: 30,
            logLevel: 'info',
            screenOnOff: true,

            // Display settings
            displaySettings: {
                resolution: 'auto',
                orientation: 'landscape',
                colorProfile: 'default',
                powerManagement: true
            },

            // Network settings
            networkSettings: {
                autoConnect: true,
                preferredInterface: 'auto',
                retryAttempts: 3,
                retryDelay: 5000
            },

            // Media settings
            mediaSettings: {
                defaultVolume: 50,
                autoPlay: true,
                loopMedia: true,
                hardwareAcceleration: true
            },

            // System settings
            systemSettings: {
                enableRemoteControl: true,
                allowShutdown: true,
                enableSystemInfo: true,
                enableVNC: true,
                vncPort: 5900,
                cpanelPort: 9000
            },

            // Synchronization settings (new feature)
            syncSettings: {
                syncMode: 'disabled',
                isMaster: false,
                syncInterval: 5000,
                videoSyncThreshold: 0.5,
                layoutSyncEnabled: true,
                videoSyncEnabled: true,
                masterBroadcastInterval: 1000,
                networkTimeout: 10000
            },

            // Migration metadata
            version: '2.4.0',
            migrationInfo: {
                migratedFrom: 'config.js',
                migrationDate: new Date().toISOString(),
                originalConfigBackup: path.join(appdir, 'config.js.backup')
            }
        }

        // Backup original config.js
        fs.copyFileSync(configJsPath, path.join(appdir, 'config.js.backup'))
        safeLog.info('Original config.js backed up to config.js.backup')

        // Write new config.json
        fs.writeFileSync(configJsonPath, JSON.stringify(newConfig, null, 2))
        safeLog.info('New config.json created successfully')

        // Create migration completion flag
        fs.writeFileSync(migrationFlagPath, JSON.stringify({
            completedAt: new Date().toISOString(),
            migratedFrom: 'config.js',
            version: '2.4.0'
        }, null, 2))

        // Delete original config.js after successful migration
        try {
            fs.unlinkSync(configJsPath)
            safeLog.info('Original config.js deleted after successful migration')
        } catch (deleteError) {
            log.warn('Failed to delete original config.js:', deleteError.message)
            // Don't fail the migration if deletion fails - backup exists
        }

        safeLog.info('Configuration migration completed successfully')

        // Show migration success dialog
        const options = {
            type: 'info',
            buttons: ['Ok'],
            defaultId: 0,
            title: 'Configuration Migration',
            message: 'Configuration has been successfully migrated to the new format.',
            detail: `Your settings have been migrated from config.js to config.json with enhanced features.\n\n` +
                   `Original config.js has been backed up as config.js.backup and the original file has been removed.\n\n` +
                   `New features available:\n` +
                   `• Enhanced system monitoring\n` +
                   `• Screen on/off toggle with sound control\n` +
                   `• Advanced configuration management\n` +
                   `• Real-time system information\n` +
                   `• Multi-screen synchronization system\n\n` +
                   `Access the enhanced control panel at: https://localhost:9000\n\n` +
                   `Copyright © 2000-${new Date().getFullYear()} by Closed-loop Technology Pte Ltd.`
        }

        if (app.isReady()) {
            dialog.showMessageBox(null, options)
        }

    } catch (error) {
        safeLog.error('Configuration migration failed:', error)
        
        // If migration fails, ensure we have a working config
        if (!fs.existsSync(configJsonPath)) {
            await createDefaultConfigJson()
        }
    }
}

// Create default config.json
async function createDefaultConfigJson() {
    try {
        // Ensure appdir exists
        if (!fs.existsSync(appdir)) {
            safeLog.info('Creating clessapp directory for default config')
            fs.mkdirSync(appdir, { recursive: true })
        }

        const defaultConfig = {
            hostserver: 'https://cless4.closed-loop.biz/demo',
            id: '10',
            mode: 'online',
            corsproxy: 'N',
            serialkey: '1d74f3eda4dd9d1065a6216c84c27d67301779b76996dc867f4403d48f9ad91e',
            timeout: 10000,
            autoStartup: true,
            fullscreenMode: true,
            screenTimeout: 0,
            updateInterval: 30,
            logLevel: 'info',
            screenOnOff: true,
            displaySettings: {
                resolution: 'auto',
                orientation: 'landscape',
                colorProfile: 'default',
                powerManagement: true
            },
            networkSettings: {
                autoConnect: true,
                preferredInterface: 'auto',
                retryAttempts: 3,
                retryDelay: 5000
            },
            mediaSettings: {
                defaultVolume: 50,
                autoPlay: true,
                loopMedia: true,
                hardwareAcceleration: true
            },
            systemSettings: {
                enableRemoteControl: true,
                allowShutdown: true,
                enableSystemInfo: true,
                enableVNC: true,
                vncPort: 5900,
                cpanelPort: 9000
            },
            syncSettings: {
                syncMode: 'disabled',
                isMaster: false,
                syncInterval: 5000,
                videoSyncThreshold: 0.5,
                layoutSyncEnabled: true,
                videoSyncEnabled: true,
                masterBroadcastInterval: 1000,
                networkTimeout: 10000
            },
            timestamp: new Date().toISOString(),
            version: '2.4.0'
        }

        const configJsonPath = path.join(appdir, 'config.json')
        fs.writeFileSync(configJsonPath, JSON.stringify(defaultConfig, null, 2))
        safeLog.info('Default config.json created successfully at: ' + configJsonPath)
        
        // Verify the file was created
        if (fs.existsSync(configJsonPath)) {
            safeLog.info('Verified: config.json file exists and is readable')
        } else {
            throw new Error('Failed to create config.json - file does not exist after write operation')
        }
    } catch (error) {
        log.error('Error creating default config.json:', error)
        throw error
    }
}

// Function to load configuration (supports both old and new formats)
function loadConfiguration() {
    const configJsonPath = path.join(appdir, 'config.json')
    const configJsPath = path.join(appdir, 'config.js')

    try {
        // Try to load config.json first (new format)
        if (fs.existsSync(configJsonPath)) {
            const configData = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'))
            
            // Check if config needs version upgrade
            const currentVersion = configData.version || '1.0.0'
            if (compareVersions(currentVersion, '2.4.0') < 0) {
                safeLog.info('Config version check: upgrade needed during load, version:', currentVersion)
                // Don't upgrade here, let the migration system handle it on next restart
                // For now, ensure syncSettings exist for immediate use
                if (!configData.syncSettings) {
                    configData.syncSettings = {
                        syncMode: 'disabled',
                        isMaster: false,
                        syncInterval: 5000,
                        videoSyncThreshold: 0.5,
                        layoutSyncEnabled: true,
                        videoSyncEnabled: true,
                        masterBroadcastInterval: 1000,
                        networkTimeout: 10000
                    }
                    safeLog.info('Added temporary syncSettings for immediate use')
                }
            }
            
            safeLog.info('Loaded configuration from config.json, version:', configData.version || 'unknown')
            return configData
        }

        // Fallback to config.js (legacy format)
        if (fs.existsSync(configJsPath)) {
            delete require.cache[require.resolve(configJsPath)]
            const oldConfig = require(configJsPath)
            safeLog.info('Loaded configuration from config.js (legacy mode)')
            
            // Convert to new format structure for compatibility
            return {
                hostserver: oldConfig.hostserver,
                id: oldConfig.id,
                mode: oldConfig.mode,
                corsproxy: oldConfig.corsproxy,
                serialkey: oldConfig.serialkey,
                timeout: oldConfig.timeout,
                autoStartup: oldConfig.autostartup === 'Y',
                fullscreenMode: true,
                screenTimeout: 0,
                updateInterval: 30,
                logLevel: 'info',
                screenOnOff: true,
                syncSettings: {
                    syncMode: 'disabled',
                    isMaster: false,
                    syncInterval: 5000,
                    videoSyncThreshold: 0.5,
                    layoutSyncEnabled: true,
                    videoSyncEnabled: true,
                    masterBroadcastInterval: 1000,
                    networkTimeout: 10000
                }
            }
        }

        throw new Error('No configuration file found')
    } catch (error) {
        safeLog.error('Error loading configuration:', error)
        return null
    }
}

// Screen toggle functionality
function createBlackScreenWindow() {
    debug('createBlackScreenWindow called')
    log.info('Creating black screen windows')
    const displays = screen.getAllDisplays()
    debug('Found displays:', displays.length)
    
    displays.forEach((display, index) => {
        debug(`Creating black screen for display ${index}:`, display.bounds)
        const blackWin = new BrowserWindow({
            width: display.bounds.width,
            height: display.bounds.height,
            x: display.bounds.x,
            y: display.bounds.y,
            fullscreen: true,
            frame: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        })

        blackWin.loadFile(path.join(__dirname, 'src', 'black-screen.html'))
        blackWin.setIgnoreMouseEvents(false)
        
        if (index === 0) {
            blackScreenWin = blackWin // Store reference to primary screen window
            debug('Set primary black screen window reference')
        }
        
        blackWin.on('closed', () => {
            if (blackWin === blackScreenWin) {
                blackScreenWin = null
            }
        })
        
        debug(`Black screen window ${index} created`)
    })
    
    log.info('Black screen windows created')
}

function closeBlackScreenWindow() {
    debug('closeBlackScreenWindow called, blackScreenWin:', !!blackScreenWin)
    log.info('Closing black screen windows')
    
    if (blackScreenWin) {
        blackScreenWin.close()
        blackScreenWin = null
        debug('Primary black screen window closed')
        
        // Close all black screen windows
        BrowserWindow.getAllWindows().forEach(window => {
            if (window.webContents.getURL().includes('black-screen.html')) {
                debug('Closing additional black screen window')
                window.close()
            }
        })
    }
    
    log.info('Black screen windows closed')
}

function getCurrentVolume() {
    return new Promise((resolve, reject) => {
        if (process.platform === 'win32') {
            if (winAudio) {
                try {
                    const currentVolume = winAudio.speaker.get()
                    resolve(currentVolume)
                } catch (error) {
                    log.warn('Failed to get current volume using win-audio:', error)
                    resolve(0.8) // Default fallback
                }
            } else {
                resolve(0.8) // Default fallback when win-audio not available
            }
        } else if (process.platform === 'linux') {
            exec('amixer get Master | grep -o "[0-9]*%" | head -n1', (error, stdout) => {
                if (error) {
                    log.warn('Failed to get current volume on Linux:', error)
                    resolve(0.8) // Default fallback
                } else {
                    const volumeMatch = stdout.trim().match(/(\d+)%/)
                    const volumePercent = volumeMatch ? parseInt(volumeMatch[1]) : 80
                    resolve(volumePercent / 100) // Convert to 0-1 range
                }
            })
        } else if (process.platform === 'darwin') {
            exec('osascript -e "output volume of (get volume settings)"', (error, stdout) => {
                if (error) {
                    log.warn('Failed to get current volume on macOS:', error)
                    resolve(0.8) // Default fallback
                } else {
                    const volume = parseInt(stdout.trim()) / 100 // Convert from 0-100 to 0-1
                    resolve(volume)
                }
            })
        } else {
            resolve(0.8) // Default fallback for unknown platforms
        }
    })
}

function muteSystem() {
    // Store current volume before muting
    getCurrentVolume().then(currentVolume => {
        if (currentVolume > 0) {
            previousVolume = currentVolume
            log.info(`Stored current volume: ${previousVolume}`)
        }
    }).catch(error => {
        log.warn('Failed to get current volume:', error)
    })
    
    if (process.platform === 'win32') {
        // Windows mute using win-audio package
        if (winAudio) {
            try {
                winAudio.speaker.set(0) // Set volume to 0 (mute)
                isMuted = true
                debug('System audio muted on Windows using win-audio package')
            } catch (error) {
                log.warn('Failed to mute system audio on Windows using win-audio package:', error.message)
                // Fallback to PowerShell command
                exec('powershell "Set-AudioDevice -PlaybackMute 1"', (error) => {
                    if (error) {
                        log.warn('Failed to mute system audio on Windows (PowerShell fallback):', error.message)
                        // Alternative PowerShell approach
                        exec('powershell "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"', (error) => {
                            if (error) {
                                log.warn('Failed to mute system audio on Windows (alternative):', error.message)
                            } else {
                                isMuted = true
                                debug('System audio muted on Windows (alternative method)')
                            }
                        })
                    } else {
                        isMuted = true
                        debug('System audio muted on Windows (PowerShell fallback)')
                    }
                })
            }
        } else {
            // win-audio not available, use PowerShell fallback
            exec('powershell "Set-AudioDevice -PlaybackMute 1"', (error) => {
                if (error) {
                    log.warn('Failed to mute system audio on Windows (PowerShell):', error)
                    // Alternative PowerShell approach using SendKeys to simulate mute key
                    exec('powershell "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"', (error) => {
                        if (error) {
                            log.warn('Failed to mute system audio on Windows (alternative):', error)
                        } else {
                            isMuted = true
                            log.info('System audio muted on Windows (alternative method)')
                        }
                    })
                } else {
                    isMuted = true
                    log.info('System audio muted on Windows (PowerShell)')
                }
            })
        }
    } else if (process.platform === 'linux') {
        // Linux mute command using alsamixer
        exec('amixer sset Master mute', (error) => {
            if (error) {
                log.warn('Failed to mute system audio on Linux using amixer:', error.message)
                // Fallback for PulseAudio
                exec('pactl set-sink-mute @DEFAULT_SINK@ 1', (error) => {
                    if (error) {
                        log.warn('Failed to mute system audio on Linux (fallback):', error.message)
                    } else {
                        isMuted = true
                        debug('System audio muted on Linux (PulseAudio fallback)')
                    }
                })
            } else {
                isMuted = true
                debug('System audio muted on Linux using amixer')
            }
        })
    } else if (process.platform === 'darwin') {
        // macOS mute command
        exec('osascript -e "set volume output muted true"', (error) => {
            if (error) {
                log.warn('Failed to mute system audio on macOS:', error)
            } else {
                isMuted = true
                log.info('System audio muted on macOS')
            }
        })
    }
}

function unmuteSystem() {
    if (process.platform === 'win32') {
        // Windows unmute using win-audio package
        if (winAudio) {
            try {
                // Restore previous volume or set to a reasonable default
                const restoreVolume = previousVolume > 0 ? previousVolume : 0.8
                winAudio.speaker.set(restoreVolume)
                isMuted = false
                log.info(`System audio unmuted on Windows using win-audio package (volume: ${restoreVolume})`)
            } catch (error) {
                log.warn('Failed to unmute system audio on Windows using win-audio package:', error)
                // Fallback to PowerShell command
                exec('powershell "Set-AudioDevice -PlaybackMute 0"', (error) => {
                    if (error) {
                        log.warn('Failed to unmute system audio on Windows (PowerShell fallback):', error)
                        // Alternative PowerShell approach
                        exec('powershell "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"', (error) => {
                            if (error) {
                                log.warn('Failed to unmute system audio on Windows (alternative):', error)
                            } else {
                                isMuted = false
                                log.info('System audio unmuted on Windows (alternative method)')
                            }
                        })
                    } else {
                        isMuted = false
                        log.info('System audio unmuted on Windows (PowerShell fallback)')
                    }
                })
            }
        } else {
            // win-audio not available, use PowerShell fallback
            exec('powershell "Set-AudioDevice -PlaybackMute 0"', (error) => {
                if (error) {
                    log.warn('Failed to unmute system audio on Windows (PowerShell):', error)
                    // Alternative PowerShell approach using SendKeys to simulate mute key toggle
                    exec('powershell "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"', (error) => {
                        if (error) {
                            log.warn('Failed to unmute system audio on Windows (alternative):', error)
                        } else {
                            isMuted = false
                            log.info('System audio unmuted on Windows (alternative method)')
                        }
                    })
                } else {
                    isMuted = false
                    log.info('System audio unmuted on Windows (PowerShell)')
                }
            })
        }
    } else if (process.platform === 'linux') {
        // Linux unmute command using alsamixer
        exec('amixer sset Master unmute', (error) => {
            if (error) {
                log.warn('Failed to unmute system audio on Linux using amixer:', error)
                // Fallback for PulseAudio
                exec('pactl set-sink-mute @DEFAULT_SINK@ 0', (error) => {
                    if (error) {
                        log.warn('Failed to unmute system audio on Linux (fallback):', error)
                    } else {
                        isMuted = false
                        log.info('System audio unmuted on Linux (PulseAudio fallback)')
                    }
                })
            } else {
                isMuted = false
                log.info('System audio unmuted on Linux using amixer')
            }
        })
    } else if (process.platform === 'darwin') {
        // macOS unmute command
        exec('osascript -e "set volume output muted false"', (error) => {
            if (error) {
                log.warn('Failed to unmute system audio on macOS:', error)
            } else {
                isMuted = false
                log.info('System audio unmuted on macOS')
            }
        })
    }
}

function setSystemVolume(volumePercent) {
    const volume = volumePercent / 100 // Convert to 0-1 range
    log.info(`Setting system volume to ${volumePercent}%`)
    
    if (process.platform === 'win32') {
        // Windows volume control using win-audio package
        if (winAudio) {
            try {
                winAudio.speaker.set(volume)
                previousVolume = volume
                debug(`System volume set to ${volumePercent}% on Windows using win-audio`)
            } catch (error) {
                log.warn('Failed to set system volume on Windows using win-audio:', error.message)
                // Fallback to PowerShell
                exec(`powershell "Set-AudioDevice -PlaybackVolume ${volumePercent}"`, (error) => {
                    if (error) {
                        log.warn('Failed to set system volume on Windows (PowerShell fallback):', error.message)
                        // Alternative method using VBScript
                        exec(`powershell "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]175)"`, (error) => {
                            if (error) {
                                log.warn('Failed to set system volume on Windows (alternative):', error.message)
                            } else {
                                debug(`System volume adjusted on Windows (alternative method)`)
                            }
                        })
                    } else {
                        previousVolume = volume
                        debug(`System volume set to ${volumePercent}% on Windows (PowerShell)`)
                    }
                })
            }
        } else {
            // win-audio not available, use PowerShell fallback
            exec(`powershell "Set-AudioDevice -PlaybackVolume ${volumePercent}"`, (error) => {
                if (error) {
                    log.warn('Failed to set system volume on Windows (PowerShell):', error.message)
                } else {
                    previousVolume = volume
                    debug(`System volume set to ${volumePercent}% on Windows (PowerShell)`)
                }
            })
        }
    } else if (process.platform === 'linux') {
        // Linux volume control using amixer
        exec(`amixer sset Master ${volumePercent}%`, (error) => {
            if (error) {
                log.warn('Failed to set system volume on Linux using amixer:', error.message)
                // Fallback for PulseAudio
                exec(`pactl set-sink-volume @DEFAULT_SINK@ ${volumePercent}%`, (error) => {
                    if (error) {
                        log.warn('Failed to set system volume on Linux (PulseAudio fallback):', error.message)
                    } else {
                        previousVolume = volume
                        debug(`System volume set to ${volumePercent}% on Linux (PulseAudio)`)
                    }
                })
            } else {
                previousVolume = volume
                debug(`System volume set to ${volumePercent}% on Linux using amixer`)
            }
        })
    } else if (process.platform === 'darwin') {
        // macOS volume control
        exec(`osascript -e "set volume output volume ${volumePercent}"`, (error) => {
            if (error) {
                log.warn('Failed to set system volume on macOS:', error.message)
            } else {
                previousVolume = volume
                debug(`System volume set to ${volumePercent}% on macOS`)
            }
        })
    }
}

function handleScreenToggle(state) {
    debug('handleScreenToggle called with state:', state)
    log.info('Screen toggle requested:', state)
    
    if (state === 'off' || state === false) {
        // Screen off: show black overlay and mute sound
        debug('Turning screen OFF - creating black overlay and muting audio')
        createBlackScreenWindow()
        muteSystem()
        log.info('Screen toggled OFF: black overlay displayed and audio muted')
    } else {
        // Screen on: close black overlay and unmute sound
        debug('Turning screen ON - removing black overlay and unmuting audio')
        closeBlackScreenWindow()
        if (isMuted) {
            unmuteSystem()
        }
        log.info('Screen toggled ON: black overlay removed and audio unmuted')
    }
}

try {
    // Ensure all required directories exist
    console.log('[INFO] Creating required directories...')
    const directories = [
        path.normalize(os.homedir() + '/clessapp'),
        path.normalize(os.homedir() + '/clessapp/res'),
        path.normalize(os.homedir() + '/clessapp/logs/')
    ]
    console.log('[DEBUG] Directories array:', directories)
    console.log('[DEBUG] Type of directories:', typeof directories)
    console.log('[DEBUG] Is array:', Array.isArray(directories))
    if (Array.isArray(directories)) {
        directories.forEach(dir => {
            if (!fs.existsSync(dir)) {
                try {
                    fs.mkdirSync(dir, { recursive: true })
                    console.log(`[INFO] Created directory: ${dir}`)
                } catch (error) {
                    console.error(`[ERROR] Failed to create directory ${dir}:`, error)
                }
            }
        })
    } else {
        console.error('[ERROR] Directories is not an array!')
    }

    //create config.json migration and update system
    (async () => {
        try {
            await performConfigMigration()
        } catch (error) {
            safeLog.error('Config migration error:', error)
        }
    })()

    //update config-app.js to current update (legacy support)
    fs.stat(appdir + '/config.js', async function (err, stats) {
        if (err) {
            safeLog.error(appdir + '/config.js', err)
        } else {
            try {
                // Ensure date module is loaded before using it
                if (!date) {
                    date = await lazyLoader.loadModule('date-and-time')
                }
                
                const config = require(appdir + '/config')
                var hostserver_update = "var hostserver = 'https://cless4.closed-loop.biz/demo'; // cless server url\r\n"
                var dsid_update = "var id = '10'; // ds id\r\n"
                var mode_update = "var mode = 'online'; // offline or online\r\n"
                var corsproxy_update = "var corsproxy = 'N'; // If the CORS blocked by Antivirus or Firewall then set to Y\r\n"
                var autostartup_update = "var autostartup = 'Y'; // Y or N\r\n"
                var serialkey_update = "var serialkey = '1d74f3eda4dd9d1065a6216c84c27d67301779b76996dc867f4403d48f9ad91e'; // insert serial key\r\n\r\n\r\n"
                var mtime = stats.mtime
                mtime = date.format(mtime, 'YYYY-MM-DD')
                var updateDate = date.parse('2025-07-31', 'YYYY-MM-DD') // Updated to current date for new migration
                updateDate = date.format(updateDate, 'YYYY-MM-DD')
                const readConfig = () => {
                    return new Promise((resolve, reject) => {
                        fs.readFile(appdir + '/config.js', async function (err, data) {
                            if (err) { safeLog.error(err); throw err }
                            safeLog.info('Config file check successfully')
                            //any configure variable is founded or updated before this
                            if (data.includes('var hostserver')) hostserver_update = "var hostserver = '" + config.hostserver + "'; // cless server url\r\n"
                            if (data.includes('var id')) dsid_update = "var id = '" + config.id + "'; // ds id\r\n"
                            if (data.includes('var mode')) mode_update = "var mode = '" + config.mode + "'; // offline or online\r\n"
                            if (data.includes('var corsproxy')) corsproxy_update = "var corsproxy = '" + config.corsproxy + "'; // If the CORS blocked by Antivirus or Firewall then set to Y\r\n"
                            if (data.includes('var autostartup')) autostartup_update = "var autostartup = '" + config.autostartup + "'; // Y or N\r\n"
                            if (data.includes('var serialkey')) serialkey_update = "var serialkey = '" + config.serialkey + "'; // insert serial key\r\n\r\n\r\n"
                            resolve()
                        })
                    })
                }
                if (mtime < updateDate) {
                    await readConfig().then(() => {
                        safeLog.info(hostserver_update, dsid_update, mode_update, corsproxy_update, autostartup_update, serialkey_update)
                        fs.writeFile(appdir + '/config.js',
                            hostserver_update +
                            dsid_update +
                            mode_update +
                            corsproxy_update +
                            autostartup_update +
                            serialkey_update +
                            "/*\r\n" +
                            "DON'T CHANGE ANYTHING BELOW HERE\r\n" +
                            "*/\r\n" +
                            "module.exports.hostserver = hostserver;\r\n" +
                            "module.exports.id = id;\r\n" +
                            "module.exports.mode = mode;\r\n" +
                            "module.exports.corsproxy = corsproxy;\r\n" +
                            "module.exports.autostartup = autostartup;\r\n" +
                            "module.exports.timeout = 10000;\r\n" +
                            "module.exports.serialkey = serialkey;\r\n",
                            function (err, data) {
                                if (err) {
                                    safeLog.warn(err)
                                }
                                const options = {
                                    type: 'info',
                                    buttons: ['Ok'],
                                    defaultId: 2,
                                    title: 'Setup and configuration',
                                    message: 'Config file has been updated.',
                                    detail: 'Copyright © 2000-' + date.format(now, 'YYYY') + ' by Closed-loop Technology Pte Ltd. All rights reserved \r\n' +
                                        ' www.closed-loop.biz'
                                }
                                dialog.showMessageBox(null, options).then((data) => {
                                    if (data.response == 0) {
                                        setTimeout(() => {
                                            safeLog.info('Config file updated successfully')
                                            app.exit()
                                            app.relaunch()
                                        }, 2000)
                                    }
                                })
                            })
                    })
                }
            } catch (error) {
                safeLog.error('Error in config.js stat callback:', error)
            }
        }
    })
} catch (err) {
    safeLog.error('Error in main process initialization:', err)
}

try {
    // Load configuration using migration-aware function
    const config = loadConfiguration()
    
    if (!config) {
        throw new Error('Failed to load configuration')
    }

    if (!gotTheLock) {
        safeLog.info('User trying to run multiple app. One instance only')
        app.exit()
    } else {

        //RUN WINDOWS AT STARTUP
        if (app.isPackaged) {
            // Handle both old ('Y'/'N') and new (true/false) config formats
            const shouldAutoStart = config.autoStartup === true || config.autostartup === 'Y'
            if (shouldAutoStart) {
                safeLog.info('Enabled ecless-player auto startup')
                app.setLoginItemSettings({
                    openAtLogin: true,
                })
            } else {
                safeLog.info('Disabled ecless-player auto startup')
                app.setLoginItemSettings({
                    openAtLogin: false,
                })
            }
        }

        app.on('second-instance', (event, commandLine, workingDirectory) => {
            // Someone tried to run a second instance, we should focus our window.
            if (win) {
                if (win.isMinimized()) {
                    safeLog.info("Restore process.")
                    win.show()
                }
                app.focus({
                    steal: true
                })
            }
        })

        //PREVENT HTTPS TO CHCEK CERTIFICED
        //app.disableHardwareAcceleration()

        app.commandLine.appendSwitch('ignore-certificate-errors', 'true')
        app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
            safeLog.error('certificate-error : ', error)
            event.preventDefault()
            callback(true)
        })
        //APP CRASH REPORT TO LOG
        app.on('uncaughtException', (err) => {
            safeLog.error('uncaughtException : ', err)
        })

        //Enabled Plugin
        //Pepper Flash
        // Specify flash path, supposing it is placed in the same directory with main.js.
        let pluginName
        switch (process.platform) {
            case 'win32':
                pluginName = 'pepflashplayer32_32_0_0_238.dll'
                break
            case 'darwin':
                pluginName = 'PepperFlashPlayer.plugin'
                break
            case 'linux':
                pluginName = 'libpepflashplayer.so'
                break
        }
        app.commandLine.appendSwitch('ppapi-flash-path', path.join(__dirname, pluginName))
        // Optional: Specify flash version, for example, v17.0.0.169
        app.commandLine.appendSwitch('ppapi-flash-version', '32.0.0.238')

        //disabled cache
        //app.commandLine.appendSwitch("disable-http-cache")

        //APP START UP CONFIG
        app.on('ready', async () => {
            try {
                // Ensure all required modules are loaded before proceeding
                await initializeModules()
                
                const primaryDisplay = screen.getPrimaryDisplay() // Retrieve the primary display using the getPrimaryDisplay() method
            const bounds = primaryDisplay.bounds // Get the bounds of the primary display
            var mainPosX = bounds.x // Get the x-coordinate of the top-left corner of the primary display
            var mainPosY = bounds.y // Get the y-coordinate of the top-left corner of the primary display
            const mainWidth = primaryDisplay.workAreaSize.width // Get the width of the work area using the workAreaSize property
            const mainHeight = primaryDisplay.workAreaSize.height // Get the height of the work area using the workAreaSize property
            var screenX = 0 // POS X of the window
            var screenY = 0 // POS Y of the window
            var screenWidth = 0 // Total of the width every monitor after calculation
            var screenHeight = 0 // Total of the height every  monitor after calculation
            var retryUntilGetAllScreens = true // when true open the window

            if (process.platform === 'win32') {
                await si.graphics().then(screens => {
                    screens.displays.forEach((sItem, i) => {
                        /*if (sItem.positionX > mainPosX || sItem.positionY > mainPosY) { // if secondary pos stacked on main screen
                            screenX = sItem.positionX
                            screenY = sItem.positionY
                        } else {
                            screenX = mainPosX
                            screenY = mainPosY
                        }*/

                        if (i >= 0 && sItem.positionX > mainPosX) { // check if this secondary monitor is on stacked bottom of the primary screen
                            screenWidth = Math.max(screenWidth, sItem.currentResX) // set the maximum of the screen width size
                            screenHeight += sItem.currentResY
                        } else {
                            screenWidth += sItem.currentResX
                            screenHeight = Math.max(screenHeight, sItem.currentResY) // if stacked right then just get the maximum of the height size
                        }

                        if (i == screens.displays.length - 1) {
                            log.info(`Checking all screen sizing. Y: ${mainPosX}, X : ${mainPosY}, W: ${screenWidth}, H: ${screenHeight}`)
                            retryUntilGetAllScreens = false
                        }
                    })
                })
            } else if (process.platform === 'linux') {
                // Linux-specific logic using systeminformation library
                try {
                    await getTotalResolution()
                        .then(resolution => {
                            screenWidth = resolution.width
                            screenHeight = resolution.height
                            retryUntilGetAllScreens = false
                        })
                        .catch(error => log.error(error));
                } catch (error) {
                    log.error('Error getting display information:', error);
                }
            }

            win = new BrowserWindow({
                x: 0,
                y: -10000,
                width: 0,
                height: 0,
                backgroundColor: '#000000',
                alwaysOnTop: true,
                autoHideMenuBar: true,
                fullscreenable: false,
                resizable: false,
                moveable: false,
                closable: false,
                transparent: true,
                frame: false,
                zoomFactor: 1,
                webPreferences: {
                    webviewTag: true,
                    plugins: true,
                    webSecurity: false,
                    enableRemoteModule: true,
                    devTools: true, //enable or disable dev tools
                    nodeIntegration: true,
                    contextIsolation: false,
                    preload: path.join(__dirname, 'preload.js')
                }
            })

            win2 = new BrowserWindow({
                x: 0,
                y: -10000,
                width: 0,
                height: 900,
                backgroundColor: '#302d2d',
                //alwaysOnTop: true,
                //autoHideMenuBar: true,
                fullscreenable: false,
                resizable: false,
                moveable: false,
                closable: true,
                transparent: true,
                frame: false,
                center: true,
                zoomFactor: 1,
                webPreferences: {
                    webviewTag: true,
                    plugins: true,
                    webSecurity: false,
                    enableRemoteModule: true,
                    devTools: true, //enable or disable dev tools
                    nodeIntegration: true,
                    contextIsolation: false,
                    preload: path.join(__dirname, 'preload.js')
                }
            })
            //enable remote webContents
            require('@electron/remote/main').enable(win.webContents)
            require('@electron/remote/main').enable(win2.webContents)

            var clessAutoLaunch = new AutoLaunch({
                name: 'Cless Player',
                path: '/Applications/Minecraft.app',
            })

            if (config.autostartup == 'Y') {
                safeLog.info('Enabled auto-startup')
                clessAutoLaunch.enable()
            } else {
                safeLog.info('Disabled auto-startup')
                clessAutoLaunch.disable()
            }

            win.on('closed', () => {
                safeLog.info('Closing window 1')
                win = null
            })

            win2.on('closed', () => {
                safeLog.info('Closing window 2')
                win2 = null
            })

            //APPS FAIL TO LOAD (WHITE SCREEN)
            win.webContents.on("window1-did-fail-load", function (evt, errcode, errname) {
                safeLog.error("did-fail-load : " + errcode + "/ ", errname)
                if (errcode != -3 || errcode != -27) {
                    safeLog.info('CLESS Player relaunch success.')
                    app.exit()
                    app.relaunch()
                }
            })

            //APPS FAIL TO LOAD (WHITE SCREEN)
            win2.webContents.on("window2-did-fail-load", function (evt, errcode, errname) {
                safeLog.error("did-fail-load : " + errcode + "/ ", errname)
                if (errcode != -3 || errcode != -27) {
                    safeLog.info('CLESS Player relaunch success.')
                    app.exit()
                    app.relaunch()
                }
            })

            //hide menu bar
            win.setSkipTaskbar(true)
            win.setAlwaysOnTop(true)
            win2.setSkipTaskbar(true)
            //win2.setAlwaysOnTop(true)
            win.setMenuBarVisibility(false)
            win2.setMenuBarVisibility(false)
            Menu.setApplicationMenu(null)
            win.setMenu(null)
            win2.setMenu(null)

            //APPS CRASH
            win.webContents.on('crashed', (e, killed) => {
                log.error("window1-crashed : " + e + " / Killed : " + killed)
                log.info('CLESS Player relaunch success.')
                app.exit()
                app.relaunch()
            })
            win2.webContents.on('crashed', (e, killed) => {
                log.error("window2-crashed : " + e + " / Killed : " + killed)
                log.info('CLESS Player relaunch success.')
                app.exit()
                app.relaunch()
            })
            //CLEAR CACHE AND COOKIE EVERY STARTUP
            var ses = win.webContents.session
            //ses.clearStorageData()
            //ses.clearCache(() => {
            //     log.info("Cache cleared!")
            //})

            win.webContents.on('did-finish-load', () => {
                win.webContents.setVisualZoomLevelLimits(1, 1)
            })

            win2.webContents.on('did-finish-load', () => {
                win2.webContents.setVisualZoomLevelLimits(1, 1)
            })

            //SHORTCUT KEY
            globalShortcut.register('CommandOrControl+X', () => {
                app.exit()
                log.warn('Application exit')
            })

            globalShortcut.register('F5', () => {
                ses.clearCache(() => {
                    log.info("Cache cleared!")
                })

                if (win) win.webContents.reloadIgnoringCache()
            })

            //open dev tools
            globalShortcut.register('CommandOrControl+D', () => {
                log.info('Dev tools opened')
                if (win) win.openDevTools()
                if (win2) win2.openDevTools()
            })

            //open configure page
            globalShortcut.register('CommandOrControl+1', () => {
                log.info('Open CLESS config.')
                if (win2) {
                    win2.setAlwaysOnTop(false)
                    if (checkScreens) clearInterval(checkScreens)
                }
                if (win) {
                    win.show()
                    win.setBounds({
                        x: mainPosX,
                        y: mainPosY,
                        width: mainWidth,
                        height: mainHeight
                    })
                    app.focus({
                        steal: true
                    })
                    win.loadURL("file://" + __dirname + "/src/configure.html")
                }
            })

            //From Screen slot (webview)
            ipcMain.once('appname-check', (event, args) => {
                var appName = app.getName()
                event.returnValue = appName
            })

            //Exit app button (clever web)
            ipcMain.once('app-exit', (event, args) => {
                log.info('CLESS Player closed.')
                app.quit()
            })

            //Exit app button (clever web)
            ipcMain.once('app-savelog', (event, logs) => {
                var logtype = logs[0]
                var logtext = logs[1]
                debug(`${logtype} :  ${logtext}`)
                if (logtype == 'warn') {
                    log.warn(logtext)
                } else {
                    log.info(logtext)
                }
            })

            //reload app
            ipcMain.on('app-reload', (event, logs) => {
                safeLog.info('CLESS Player restart requested via API Panel.')
                
                // Important: Call relaunch() before exit() to ensure the restart happens
                app.relaunch()
                app.exit()
            })

            //refresh app
            //reload app
            ipcMain.on('app-refresh', (event, logs) => {
                safeLog.info('CLESS Player refresh requested.')
                if (win) {
                    win.reload()
                    safeLog.info('CLESS Player window reloaded successfully.')
                } else {
                    safeLog.warn('CLESS Player window not available for refresh.')
                }
            })

            //reload main
            ipcMain.once('openwindow', async (event, logs) => {
                log.info('Screen size captured.')
                win2.setBounds({
                    x: mainPosX,
                    y: mainPosY,
                    width: screenWidth,
                    height: screenHeight
                })
                win2.setAlwaysOnTop(false)
                app.focus({
                    steal: true
                })
                win2.blur()
                win.show()
                win.focus()
                var networkStat = await si.networkInterfaces('default')
                log.info("Network state : " + networkStat.operstate) // Get the OS version
                const windowsVersion = os.release()
                if (networkStat.operstate == 'down' && config.mode == 'online' && !windowsVersion.startsWith('6.1')) {
                    log.warn('Network state : network failed | ', windowsVersion, networkStat)
                    win.loadURL("file://" + __dirname + "/src/offline.html")
                } else {
                    macaddress.one(function (err, mac) {
                        if (err) {
                            log.error('MAC error:', err)
                            win.loadURL("file://" + __dirname + "/src/offline.html")
                            return
                        }

                        log.info('MAC detected:', mac)
                        const secret = 'Clt@2022'
                        const hash = Crypto.createHash('sha256').update(mac).digest('hex')

                        if (config.serialkey === hash) {
                            log.info('ecless player startup')
                            win.loadURL("file://" + __dirname + "/src/index.html")
                        } else {
                            win.setSkipTaskbar(false)
                            win.setAlwaysOnTop(false)
                            win.setMenuBarVisibility(true)
                            win.loadURL("file://" + __dirname + "/src/activate.html")
                        }
                    })
                }
            })

            //reset main and preview
            ipcMain.once('app-resetdefault', (event, logs) => {
                log.info('CLESS player storage reset.')
                ses.clearStorageData()
            })

            //Get configuration for renderer process
            ipcMain.handle('get-configuration', async (event) => {
                try {
                    const config = loadConfiguration()
                    if (config) {
                        log.info('Providing configuration to renderer process')
                        return config
                    } else {
                        log.warn('No configuration available for renderer process')
                        return null
                    }
                } catch (error) {
                    log.error('Error providing configuration to renderer:', error)
                    return null
                }
            })

            //download image file
            ipcMain.handle('app-downloadmedia', async (event, args) => {
                log.info('player : download media')
                const result = await downloadMedia(args['mediaURL'], args['mediaPathSrc'])
                return result
            })

            //Save configuration app button (ecless-player)
            ipcMain.on('app-configsave', (event, args) => {
                // Save to both old format (for compatibility) and new JSON format
                const legacyConfigJs = 
                    "var hostserver = '" + args['hostaddress'] + "'; // cless server url\r\n" +
                    "var id = '" + args['dsid'] + "'; // ds id\r\n" +
                    "var mode = '" + args['mode'] + "'; // offline or online\r\n" +
                    "var corsproxy = '" + args['corsproxy'] + "'; // If the CORS blocked by Antivirus or Firewall then set to Y\r\n" +
                    "var autostartup = '" + args['autostartup'] + "'; // Y or N\r\n" +
                    "var serialkey = '" + args['serialkey'] + "'; // insert serial key\r\n\r\n\r\n" +
                    "/*\r\n" +
                    "DON'T CHANGE ANYTHING BELOW HERE\r\n" +
                    "*/\r\n" +
                    "module.exports.hostserver = hostserver;\r\n" +
                    "module.exports.id = id;\r\n" +
                    "module.exports.mode = mode;\r\n" +
                    "module.exports.corsproxy = corsproxy;\r\n" +
                    "module.exports.autostartup = autostartup;\r\n" +
                    "module.exports.timeout = 10000;\r\n" +
                    "module.exports.serialkey = serialkey;\r\n"

                // Enhanced JSON config
                const enhancedConfig = {
                    hostserver: args['hostaddress'],
                    id: args['dsid'],
                    mode: args['mode'],
                    corsproxy: args['corsproxy'],
                    serialkey: args['serialkey'],
                    timeout: 10000,
                    autoStartup: args['autostartup'] === 'Y',
                    fullscreenMode: args['fullscreenMode'] || true,
                    screenTimeout: args['screenTimeout'] || 0,
                    updateInterval: args['updateInterval'] || 30,
                    logLevel: args['logLevel'] || 'info',
                    screenOnOff: args['screenOnOff'] !== undefined ? args['screenOnOff'] : true,
                    displaySettings: args['displaySettings'] || {
                        resolution: 'auto',
                        orientation: 'landscape',
                        colorProfile: 'default',
                        powerManagement: true
                    },
                    networkSettings: args['networkSettings'] || {
                        autoConnect: true,
                        preferredInterface: 'auto'
                    },
                    mediaSettings: args['mediaSettings'] || {
                        defaultVolume: 50,
                        autoPlay: true,
                        loopMedia: true
                    },
                    systemSettings: args['systemSettings'] || {
                        enableRemoteControl: true,
                        allowShutdown: true,
                        enableSystemInfo: true
                    },
                    timestamp: new Date().toISOString(),
                    version: '2.0.14'
                }

                // Write legacy config.js
                fs.writeFile(appdir + '/config.js', legacyConfigJs, function (err, data) {
                    if (err) {
                        log.warn(err)
                    }
                    log.info('Legacy config.js updated.')
                })

                // Write enhanced config.json
                fs.writeFile(appdir + '/config.json', JSON.stringify(enhancedConfig, null, 2), function (err, data) {
                    if (err) {
                        log.warn('Error saving config.json:', err)
                    } else {
                        log.info('Enhanced config.json updated.')
                    }

                    const options = {
                        type: 'info',
                        buttons: ['Ok'],
                        defaultId: 1,
                        title: 'Setup and configuration',
                        message: 'Configuration has been updated successfully.',
                        detail: 'Update successful for both config.js and config.json\n' +
                            'Enhanced features are now available in the control panel.\n\n' +
                            'Copyright © 2000-' + date.format(now, 'YYYY') + ' by Closed-loop Technology Pte Ltd. All rights reserved \n' +
                            'www.closed-loop.biz'
                    }
                    dialog.showMessageBox(null, options).then((data) => {
                        log.info('Dialog show message: ', data)
                        if (data.response == 0) {
                            log.info('CLESS Player relaunch success.')
                            app.exit()
                            app.relaunch()
                        }
                    })
                })
            })

            // Enhanced IPC handlers for new control panel features
            
            // Handle screen on/off toggle with sound control
            // NOTE: This IPC handler is deprecated - screen control is now handled directly in cpanel.js
            // Keeping for backward compatibility with any legacy renderer processes
            ipcMain.on('set-screen-toggle', (event, args) => {
                log.warn('Screen toggle request via IPC (deprecated, use cpanel.js direct control):', args.state)
                debug('Legacy screen toggle request received:', args)
                handleScreenToggle(args.state)
            })
            
            // Handle configuration updates from control panel
            ipcMain.on('update-config', (event, args) => {
                log.info('Configuration update request:', args)
                try {
                    const configPath = path.join(appdir, 'config.json')
                    const currentConfig = loadConfiguration() || {}
                    const updatedConfig = { ...currentConfig, ...args, timestamp: new Date().toISOString() }
                    
                    fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2))
                    log.info('Configuration updated successfully')
                    
                    // Notify control panel of successful update
                    event.reply('config-updated', { success: true })
                } catch (error) {
                    log.warn('Configuration update error:', error)
                    event.reply('config-updated', { success: false, error: error.message })
                }
            })

            // Handle system information requests
            ipcMain.handle('get-system-info', async (event, args) => {
                try {
                    const [cpu, memory, disks, network, graphics, system, osInfo] = await Promise.all([
                        si.cpu(),
                        si.mem(),
                        si.fsSize(),
                        si.networkInterfaces(),
                        si.graphics(),
                        si.system(),
                        si.osInfo()
                    ])

                    return {
                        cpu,
                        memory,
                        disks,
                        network,
                        graphics,
                        system,
                        osInfo,
                        timestamp: new Date().toISOString()
                    }
                } catch (error) {
                    log.warn('System info error:', error)
                    return { error: error.message }
                }
            })

            //load window and focus
            if (win2) {
                var checkScreens = setInterval(() => {
                    log.info(`Checking all screen sizing. Y: ${screenY}, X : ${screenX}, W: ${screenWidth}, H: ${screenHeight}`)
                    if (!retryUntilGetAllScreens) {
                        win2.setBounds({
                            x: mainPosX,
                            y: mainPosY,
                            width: screenWidth,
                            height: screenHeight
                        })
                        win2.loadURL("file://" + __dirname + "/src/second.html")
                        win2.show()
                        app.focus({
                            steal: true
                        })
                        clearInterval(checkScreens)
                    }
                }, 1000)
            }

            // Initialize cpanel server with window reference
            try {
                const server = await createCpanelServer(win)
                log.info('Cpanel server initialized with window reference')
            } catch (error) {
                log.error('Failed to initialize cpanel server:', error)
            }
            } catch (error) {
                safeLog.error('Error in app ready callback:', error)
            }
        })

        app.on('render-process-gone', (event, webContents, details) => {
            safeLog.error(' render-process-gone : ', details)
            if (details.reason == "oom") {
                safeLog.info('CLESS Player relaunch success.')
                app.exit()
                app.relaunch()
            }
        })

        app.on('render-process-crashed', (event, webContents, killed) => {
            safeLog.error(' render-process-gone : ', killed)
            safeLog.info('CLESS Player relaunch success.')
            app.exit()
            app.relaunch()
        })
    }
} catch (ex) {
    safeLog.error(ex)
    // Ensure directories exist in case of errors
    console.log('[INFO] Creating required directories (error recovery)...')
    const directories = [
        path.normalize(os.homedir() + '/clessapp'),
        path.normalize(os.homedir() + '/clessapp/res'),
        path.normalize(os.homedir() + '/clessapp/logs/')
    ]
    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true })
                console.log(`[INFO] Created directory: ${dir}`)
            } catch (error) {
                console.error(`[ERROR] Failed to create directory ${dir}:`, error)
            }
        }
    })
    
    fs.writeFile(appdir + '/config.js',
        "var hostserver = 'https://cless4.closed-loop.biz/demo'; // cless server url\r\n" +
        "var id = '10'; // ds id\r\n" +
        "var mode = 'online'; // offline or online\r\n" +
        "var corsproxy = 'N'; // If the CORS blocked by Antivirus or Firewall then set to Y\r\n" +
        "var autostartup = 'Y'; // Y or N\r\n" +
        "var serialkey = '1d74f3eda4dd9d1065a6216c84c27d67301779b76996dc867f4403d48f9ad91e'; // insert serial key\r\n\r\n\r\n" +
        "/*\r\n" +
        "DON'T CHANGE ANYTHING BELOW HERE\r\n" +
        "*/\r\n" +
        "module.exports.hostserver = hostserver;\r\n" +
        "module.exports.id = id;\r\n" +
        "module.exports.mode = mode;\r\n" +
        "module.exports.corsproxy = corsproxy;\r\n" +
        "module.exports.autostartup = autostartup;\r\n" +
        "module.exports.timeout = 10000;\r\n" +
        "module.exports.serialkey = serialkey;\r\n",
        function (err, data) {
            if (err) {
                safeLog.error(err)
            }
            log.info('Config file created.')
            const options = {
                type: 'info',
                buttons: ['Ok'],
                defaultId: 1,
                title: 'Setup and configuration',
                message: 'Config file has been created.',
                detail: 'Press CTRL + 1 to setup configuration.' +
                    '\r\n\r\n' +
                    'Copyright © 2000-' + date.format(now, 'YYYY') + ' by Closed-loop Technology Pte Ltd. All rights reserved \r\n' +
                    ' www.closed-loop.biz'
            }
            dialog.showMessageBox(null, options).then((data) => {
                if (data.response == 0) {
                    log.info('CLESS Player relaunch success.')
                    app.exit()
                    app.relaunch()
                }
            })
        })
}

var downloadMedia = async (fileUrl, downloadFolder) => {

    // The path of the downloaded file on our machine
    const localFilePath = path.resolve(__dirname, downloadFolder)
    try {
        const response = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream',
        })
        const w = response.data.pipe(fs.createWriteStream(localFilePath))
        w.on('finish', () => {
            log.info('Successfully downloaded file to ' + localFilePath)
        })
    } catch (err) {
        throw new Error(err)
    }
}

function getTotalResolution() {
    return new Promise((resolve, reject) => {
        exec('xrandr | grep -w connected', (error, stdout, stderr) => {
            if (error) {
                reject(`Error executing xrandr: ${stderr}`);
                return;
            }

            const lines = stdout.trim().split('\n');
            const resolutions = lines.map(line => {
                const match = line.match(/\b(\d+x\d+)\b/);
                return match ? match[1] : null;
            });

            const filteredResolutions = resolutions.filter(resolution => resolution !== null);

            if (filteredResolutions.length > 0) {
                let totalResolution = {
                    width: 0,
                    height: 0
                };

                filteredResolutions.forEach(resolution => {
                    const [width, height] = resolution.split('x').map(Number);

                    // Check if the secondary monitor is on the right or bottom of the primary screen
                    if (totalResolution.width > 0 && width > height) {
                        totalResolution.height = Math.max(totalResolution.height, height);
                        totalResolution.width += width;
                    } else {
                        totalResolution.width = Math.max(totalResolution.width, width);
                        totalResolution.height += height;
                    }
                });

                resolve(totalResolution);
            } else {
                reject('Unable to determine total resolution');
            }
        });
    });
}