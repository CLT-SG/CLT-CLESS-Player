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
const path = require('path')
const fs = require('fs')
const os = require('os')
var axios = require('axios').default;
const homedir = os.homedir()
const AutoLaunch = require('auto-launch')
const macaddress = require('macaddress')
const Crypto = require('crypto')
const ping = require('ping')
const si = require('systeminformation')
const {
    exec
} = require('child_process')

const server = require('./cpanel')
const appdir = path.normalize(homedir + '/clessapp')
const logdir = path.normalize(homedir + '/clessapp/logs/')
const now = new Date()
const date = require('date-and-time')
const datelog = date.format(now, 'YYYY-MM-DD')
var log = require('electron-log')
log.transports.file.file = logdir + datelog + '.log'

//One instance process check
let win = null
let win2 = null

//disable security warning
delete process.env.ELECTRON_ENABLE_SECURITY_WARNINGS
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true

const gotTheLock = app.requestSingleInstanceLock()

// Configuration Migration Function
async function performConfigMigration() {
    const configJsPath = path.join(appdir, 'config.js')
    const configJsonPath = path.join(appdir, 'config.json')
    const migrationFlagPath = path.join(appdir, '.migration-v2-complete')

    try {
        // Check if migration has already been completed
        if (fs.existsSync(migrationFlagPath)) {
            log.info('Configuration migration already completed')
            return
        }

        // Check if old config.js exists
        if (!fs.existsSync(configJsPath)) {
            log.info('No existing config.js found, creating new config.json')
            await createDefaultConfigJson()
            fs.writeFileSync(migrationFlagPath, new Date().toISOString())
            return
        }

        log.info('Starting configuration migration from config.js to config.json')

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
            brightness: 75,

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

            // Migration metadata
            version: '2.0.14',
            migrationInfo: {
                migratedFrom: 'config.js',
                migrationDate: new Date().toISOString(),
                originalConfigBackup: path.join(appdir, 'config.js.backup')
            }
        }

        // Backup original config.js
        fs.copyFileSync(configJsPath, path.join(appdir, 'config.js.backup'))
        log.info('Original config.js backed up to config.js.backup')

        // Write new config.json
        fs.writeFileSync(configJsonPath, JSON.stringify(newConfig, null, 2))
        log.info('New config.json created successfully')

        // Create migration completion flag
        fs.writeFileSync(migrationFlagPath, JSON.stringify({
            completedAt: new Date().toISOString(),
            migratedFrom: 'config.js',
            version: '2.0.14'
        }, null, 2))

        log.info('Configuration migration completed successfully')

        // Show migration success dialog
        const options = {
            type: 'info',
            buttons: ['Ok'],
            defaultId: 0,
            title: 'Configuration Migration',
            message: 'Configuration has been successfully migrated to the new format.',
            detail: `Your settings have been migrated from config.js to config.json with enhanced features.\n\n` +
                   `Original config.js has been backed up as config.js.backup\n\n` +
                   `New features available:\n` +
                   `• Enhanced system monitoring\n` +
                   `• Display brightness control\n` +
                   `• Advanced configuration management\n` +
                   `• Real-time system information\n\n` +
                   `Access the enhanced control panel at: https://localhost:9000\n\n` +
                   `Copyright © 2000-${date.format(now, 'YYYY')} by Closed-loop Technology Pte Ltd.`
        }

        if (app.isReady()) {
            dialog.showMessageBox(null, options)
        }

    } catch (error) {
        log.error('Configuration migration failed:', error)
        
        // If migration fails, ensure we have a working config
        if (!fs.existsSync(configJsonPath)) {
            await createDefaultConfigJson()
        }
    }
}

// Create default config.json
async function createDefaultConfigJson() {
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
        brightness: 75,
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
        timestamp: new Date().toISOString(),
        version: '2.0.14'
    }

    const configJsonPath = path.join(appdir, 'config.json')
    fs.writeFileSync(configJsonPath, JSON.stringify(defaultConfig, null, 2))
    log.info('Default config.json created')
}

// Function to load configuration (supports both old and new formats)
function loadConfiguration() {
    const configJsonPath = path.join(appdir, 'config.json')
    const configJsPath = path.join(appdir, 'config.js')

    try {
        // Try to load config.json first (new format)
        if (fs.existsSync(configJsonPath)) {
            const configData = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'))
            log.info('Loaded configuration from config.json')
            return configData
        }

        // Fallback to config.js (legacy format)
        if (fs.existsSync(configJsPath)) {
            delete require.cache[require.resolve(configJsPath)]
            const oldConfig = require(configJsPath)
            log.info('Loaded configuration from config.js (legacy mode)')
            
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
                brightness: 75
            }
        }

        throw new Error('No configuration file found')
    } catch (error) {
        log.error('Error loading configuration:', error)
        return null
    }
}

try {
    //create logs folder
    if (!fs.existsSync(logdir)) {
        log.info(logdir + ' not exist')
        fs.mkdir(logdir, 0o755, (err) => {
            if (err) {
                log.error(logdir + ' not exist ', err)
            }
        })
    }

    //create res folder
    if (!fs.existsSync(appdir + '/res')) {
        log.info(appdir + ' not exist')
        fs.mkdir(appdir + '/res', 0o755, (err) => {
            if (err) {
                log.error(appdir + ' not exist', err)
            }
        })
    }

    //create config.json migration and update system
    ;(async () => {
        await performConfigMigration()
    })()

    //update config-app.js to current update (legacy support)
    fs.stat(appdir + '/config.js', async function (err, stats) {
        if (err) {
            log.error(appdir + '/config.js', err)
        } else {
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
                        if (err) { log.error(err); throw err }
                        log.info('Config file check successfully')
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
                    log.info(hostserver_update, dsid_update, mode_update, corsproxy_update, autostartup_update, serialkey_update)
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
                                log.warn(err)
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
                                        log.info('Config file updated successfully')
                                        app.exit()
                                        app.relaunch()
                                    }, 2000)
                                }
                            })
                        })
                })

            }
        }
    })
} catch (err) {
    console.log(err)
    log.error(err)
}

try {
    // Load configuration using migration-aware function
    const config = loadConfiguration()
    
    if (!config) {
        throw new Error('Failed to load configuration')
    }

    if (!gotTheLock) {
        log.info('User trying to run multiple app. One instance only')
        app.exit()
    } else {

        //RUN WINDOWS AT STARTUP
        if (app.isPackaged) {
            // Handle both old ('Y'/'N') and new (true/false) config formats
            const shouldAutoStart = config.autoStartup === true || config.autostartup === 'Y'
            if (shouldAutoStart) {
                log.info('Enabled ecless-player auto startup')
                app.setLoginItemSettings({
                    openAtLogin: true,
                })
            } else {
                log.info('Disabled ecless-player auto startup')
                app.setLoginItemSettings({
                    openAtLogin: false,
                })
            }
        }

        app.on('second-instance', (event, commandLine, workingDirectory) => {
            // Someone tried to run a second instance, we should focus our window.
            if (win) {
                if (win.isMinimized()) {
                    log.info("Restore process.")
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
            log.error('certificate-error : ', error)
            event.preventDefault()
            callback(true)
        })
        //APP CRASH REPORT TO LOG
        app.on('uncaughtException', (err) => {
            log.error('uncaughtException : ', err)
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
                alwaysOnTop: true,
                autoHideMenuBar: true,
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
                log.info('Enabled auto-startup')
                clessAutoLaunch.enable()
            } else {
                log.info('Disabled auto-startup')
                clessAutoLaunch.disable()
            }

            win.on('closed', () => {
                log.info('Closing window 1')
                win = null
            })

            win2.on('closed', () => {
                log.info('Closing window 2')
                win2 = null
            })

            //APPS FAIL TO LOAD (WHITE SCREEN)
            win.webContents.on("window1-did-fail-load", function (evt, errcode, errname) {
                log.error("did-fail-load : " + errcode + "/ ", errname)
                if (errcode != -3 || errcode != -27) {
                    log.info('CLESS Player relaunch success.')
                    app.exit()
                    app.relaunch()
                }
            })

            //APPS FAIL TO LOAD (WHITE SCREEN)
            win2.webContents.on("window2-did-fail-load", function (evt, errcode, errname) {
                log.error("did-fail-load : " + errcode + "/ ", errname)
                if (errcode != -3 || errcode != -27) {
                    log.info('CLESS Player relaunch success.')
                    app.exit()
                    app.relaunch()
                }
            })

            //hide menu bar
            win.setSkipTaskbar(true)
            win.setAlwaysOnTop(true)
            win2.setSkipTaskbar(true)
            win2.setAlwaysOnTop(true)
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
                console.log(`${logtype} :  ${logtext}`)
                if (logtype == 'warn') {
                    log.warn(logtext)
                } else {
                    log.info(logtext)
                }
            })

            //reload app
            ipcMain.once('app-reload', (event, logs) => {
                log.info('CLESS Player relaunch via API Panel.')
                app.exit()
                app.relaunch()
            })

            //refresh app
            //reload app
            ipcMain.once('app-refresh', (event, logs) => {
                log.info('CLESS Player reset.')
                if (win) win.reload()
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
                    brightness: args['brightness'] || 75,
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
            
            // Handle brightness control from control panel
            ipcMain.on('set-brightness', (event, args) => {
                log.info('Brightness control request:', args)
                // You can add platform-specific brightness control here
                // For now, we'll just log and acknowledge
                if (process.platform === 'win32') {
                    // Windows brightness control could be implemented here
                } else if (process.platform === 'linux') {
                    // Linux brightness control using xrandr
                    exec(`xrandr --output HDMI-1 --brightness ${args.level / 100}`, (error, stdout, stderr) => {
                        if (error) {
                            log.warn('Brightness control error:', error)
                        } else {
                            log.info('Brightness set to:', args.level)
                        }
                    })
                }
            })

            // Handle display power control
            ipcMain.on('set-display-power', (event, args) => {
                log.info('Display power control request:', args)
                if (process.platform === 'linux') {
                    const command = args.state === 'on' ? 'xset dpms force on' : 'xset dpms force off'
                    exec(command, (error, stdout, stderr) => {
                        if (error) {
                            log.warn('Display power control error:', error)
                        } else {
                            log.info('Display power set to:', args.state)
                        }
                    })
                }
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
        })

        app.on('render-process-gone', (event, webContents, details) => {
            log.error(' render-process-gone : ', details)
            if (details.reason == "oom") {
                log.info('CLESS Player relaunch success.')
                app.exit()
                app.relaunch()
            }
        })

        app.on('render-process-crashed', (event, webContents, killed) => {
            log.error(' render-process-gone : ', killed)
            log.info('CLESS Player relaunch success.')
            app.exit()
            app.relaunch()
        })
    }
} catch (ex) {
    log.error(ex)
    if (!fs.existsSync(appdir)) {
        log.info(appdir + ' not exist')
        fs.mkdir(appdir, 0o755, (err) => {
            if (err) {
                log.warn(err)
            }
        })
    }
    if (!fs.existsSync(appdir + '/res')) {
        log.info(appdir + ' not exist')
        fs.mkdir(appdir, 0o755, (err) => {
            if (err) {
                log.warn(err)
            }
        })
    }
    if (!fs.existsSync(logdir)) {
        log.info(logdir + ' not exist')
        fs.mkdir(logdir, 0o755, (err) => {
            if (err) {
                log.warn(err)
            }
        })
    }
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
                log.error(err)
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