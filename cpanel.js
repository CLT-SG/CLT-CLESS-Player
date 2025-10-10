module.exports = function(electronWindow = null) {
return (async function () {
    // Load core modules immediately
    const path = require("path")
    const os = require('os')
    const fs = require("fs")
    const { exec } = require('child_process')
    const homedir = os.homedir()
    const appdir = path.normalize(homedir + '/clessapp')
    
    // Load optimization modules
    const SystemInfoManager = require('./SystemInfoManager')
    const lazyLoader = require('./LazyModuleLoader')
    
    // Initialize system info manager with optimized settings
    const systemInfoManager = new SystemInfoManager({
        cacheTTL: 60000, // 1 minute cache
        updateInterval: 120000, // 2 minutes auto-update
        enableCaching: true,
        maxCacheSize: 20
    })
    
    // Lazy load heavy modules
    const express = await lazyLoader.loadModule('express')
    const https = await lazyLoader.loadModule('https')
    const cors = await lazyLoader.loadModule('cors')
    const bodyParser = await lazyLoader.loadModule('body-parser')
    const { expressCspHeader } = await lazyLoader.loadModule('express-csp-header')

    var options = {
        key: fs.readFileSync(path.join(__dirname, '..', 'cert/key.pem')),
        cert: fs.readFileSync(path.join(__dirname, '..', 'cert/key.crt'))
    }

    // Lazy load remaining modules
    const [ip, websockify, datetime, shutdown] = await Promise.all([
        lazyLoader.loadModule('ip'),
        lazyLoader.loadModule('node-websockify'),
        lazyLoader.loadModule('date-and-time'),
        lazyLoader.loadModule('electron-shutdown-command')
    ])
    
    const app = express()
    const server = https.createServer(options, app)
    
    // Load socket.io lazily and handle constructor properly
    const socketIO = await lazyLoader.loadModule('socket.io')
    // For socket.io v4, use the constructor function directly  
    const io = socketIO(server)
    
    var userID = []
    const port = 9000

    //log setup
    const now = new Date()
    const log = require('electron-log')
    const logdir = path.normalize(homedir + '/clessapp/logs/')
    const datelog = datetime.format(now, 'YYYY-MM-DD')
    log.transports.file.file = logdir + datelog + '.log'

    // Debug function for development-only logging
    const debug = process.env.NODE_ENV === 'development' ? log.debug : () => {}

    // Optimized system info storage with lazy loading
    var systemData = {
        cpu: null,
        memory: null,
        disk: null,
        network: null,
        display: null,
        system: null,
        lastUpdate: null
    }
    

    
    var dataUsageInfo = {
        daily: { download: 0, upload: 0, date: new Date().toDateString() },
        monthly: { download: 0, upload: 0, month: new Date().getMonth(), year: new Date().getFullYear() },
        total: { download: 0, upload: 0 },
        lastReset: new Date().toISOString(),
        interfaces: {}
    }

    //websoctify for novnc - lazy initialization
    const initializeWebsockify = async () => {
        try {
            const ipaddress = ip.address()
            await websockify({
                target: ipaddress + ':5900',
                source: '127.0.0.1:9001',
                key: path.join(__dirname, '..', 'cert/key.pem'),
                cert: path.join(__dirname, '..', 'cert/key.crt')
            })
            log.info('Websockify initialized successfully')
        } catch (e) {
            log.warn('Websockify initialization failed:', e.message)
        }
    }


    // point for static assets
    //disablewebsecurity
    app.use(expressCspHeader({
        policies: {
            'default-src': [expressCspHeader.NONE],
            'img-src': [expressCspHeader.SELF],
        }
    }));
    app.use(bodyParser.urlencoded({
        extended: false
    }))
    app.use(bodyParser.json())
    app.use(cors({
        credentials: true,
        origin: true
    }))

    //set socketio
    app.set('socketio', io)

    app.get('/favicon.ico', function (req, res) {
        res.status(204).end() // No content response for favicon
    })

    app.get('/', function (req, res) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
        res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
        res.setHeader("Expires", "0"); // Proxies.
        res.sendFile(__dirname + "/src//cpanel.html")
    })

    app.get('/remote', function (req, res) {
        res.sendFile(__dirname + "/novnc//remote.html")
    })

    app.get('/vnc', function (req, res) {
        res.sendFile(__dirname + "/novnc//vnc.html")
    })

    app.get('/api/replace-text', function (req, res) {
        var electronID = io.sockets.sockets.get(userID['eCLESS'])
        var slotname = req.query.slotname
        var slottext = req.query.text
        electronID.emit("replacetextslot", {
            "slotname": slotname,
            "slottext": slottext
        })
        res.end('sent')
    })

    app.get('/api/replace-media', function (req, res) {
        var electronID = io.sockets.sockets.get(userID['eCLESS'])
        var slotname = req.query.slotname
        var slotfilename = req.query.filename
        electronID.emit("replacemediaslot", {
            "slotname": slotname,
            "slottext": slotfilename,
            "resfolder": appdir + '/res',
        })
        res.end('sent')
    })

    app.get('/api/update-layout', function (req, res) {
        var electronID = io.sockets.sockets.get(userID['eCLESS'])
        var layoutid = req.query.id
        electronID.emit("updatelayout", {
            "id": layoutid
        })
        res.end('success')
    })

    app.get('/api/refresh', function (req, res) {
        var electronID = io.sockets.sockets.get(userID['eCLESS'])
        electronID.emit("refresh-ecless", 'refresh')
        res.end('refreshed')
    })

    app.get('/api/resume-layout', function (req, res) {
        try {
            var electronID = io.sockets.sockets.get(userID['eCLESS'])
            if (!electronID) {
                return res.status(404).json({
                    status: 'error',
                    message: 'eCLESS renderer process not connected'
                })
            }
            
            log.info('API: Resume layout requested')
            
            electronID.emit("resume-layout", {
                "action": "resume",
                "timestamp": new Date().toISOString()
            })
            
            res.json({
                status: 'success',
                message: 'Layout resume request sent to renderer process'
            })
        } catch (error) {
            log.error('API: Resume layout error:', error)
            res.status(500).json({
                status: 'error',
                message: 'Internal server error: ' + error.message
            })
        }
    })

    app.get('/api/restartapp', function (req, res) {
        var electronID = io.sockets.sockets.get(userID['eCLESS'])
        electronID.emit("restart-ecless", 'restart app')
        res.end('restarted')
    })

    app.get('/api/reboot', function (req, res) {
        res.end('rebooted')
        shutdown.reboot({
            force: true,
            timerseconds: 0,
            quitapp: true
        })
    })

    app.get('/api/shutdown', function (req, res) {
        res.end('shutdown')
        shutdown.shutdown({
            force: true,
            timerseconds: 0,
            quitapp: true
        })
    })

    // Data endpoints for dashboard
    app.get('/api/layoutdata', function (req, res) {
        // Return layout data - this would typically come from a database or file
        res.json({
            layouts: [
                { id: 'layout1', name: 'Main Layout', active: true },
                { id: 'layout2', name: 'Secondary Layout', active: false },
                { id: 'layout3', name: 'Tertiary Layout', active: false }
            ],
            currentLayout: 'layout1'
        })
    })

    // Enhanced layout details endpoint for comprehensive layout information
    app.get('/api/layout-details', function (req, res) {
        try {
            var electronID = io.sockets.sockets.get(userID['eCLESS'])
            
            if (!electronID) {
                return res.status(503).json({
                    success: false,
                    error: 'eCLESS renderer process not connected',
                    data: {
                        layouts: [],
                        currentLayout: null,
                        isLoop: false,
                        totalSlots: 0
                    }
                })
            }

            // Request layout details from renderer process
            electronID.emit('get-layout-details', { timestamp: Date.now() })
            
            // Set up one-time listener for response
            var responseTimeout = setTimeout(() => {
                res.status(504).json({
                    success: false,
                    error: 'Timeout waiting for layout details',
                    data: {
                        layouts: [],
                        currentLayout: null,
                        isLoop: false,
                        totalSlots: 0
                    }
                })
            }, 5000)

            electronID.once('layout-details-response', function(layoutInfo) {
                clearTimeout(responseTimeout)
                res.json({
                    success: true,
                    data: layoutInfo,
                    timestamp: Date.now()
                })
            })

        } catch (error) {
            log.error('Error in /api/layout-details endpoint:', error)
            res.status(500).json({
                success: false,
                error: 'Internal server error retrieving layout details',
                data: {
                    layouts: [],
                    currentLayout: null,
                    isLoop: false,
                    totalSlots: 0
                }
            })
        }
    })

    app.get('/api/textdata', function (req, res) {
        // Return text slot data
        res.json({
            textSlots: [
                { slotName: 'title', slotText: 'Welcome to eCLESS Player' },
                { slotName: 'subtitle', slotText: 'Digital Signage Solution' },
                { slotName: 'footer', slotText: 'Powered by eCLESS Technology' }
            ]
        })
    })

    app.get('/api/mediadata', function (req, res) {
        // Return media slot data and scan for media files
        var mediaSlots = [
            { slotName: 'video1', slotText: 'sample-video.mp4' },
            { slotName: 'image1', slotText: 'sample-image.jpg' },
            { slotName: 'audio1', slotText: 'sample-audio.mp3' }
        ]
        
        var mediaFiles = []
        try {
            const mediaDir = appdir + '/res'
            if (fs.existsSync(mediaDir)) {
                mediaFiles = fs.readdirSync(mediaDir).filter(file => {
                    // Filter common media file extensions
                    const ext = path.extname(file).toLowerCase()
                    return ['.mp4', '.avi', '.mov', '.jpg', '.jpeg', '.png', '.gif', '.mp3', '.wav', '.pdf'].includes(ext)
                })
            }
        } catch (error) {
            log.warn('Media files scan error: ' + error)
        }
        
        res.json({
            mediaSlots: mediaSlots,
            availableFiles: mediaFiles
        })
    })

    // Optimized device info endpoint with caching
    app.get('/api/deviceinfo', async function (req, res) {
        try {
            const deviceInfo = await systemInfoManager.getMultipleSystemInfo([
                'cpu', 'memory', 'disk', 'network', 'display', 'system'
            ])
            
            res.json({
                cpu: deviceInfo.cpu,
                memory: deviceInfo.memory,
                disk: deviceInfo.disk,
                network: deviceInfo.network,
                display: deviceInfo.display,
                system: deviceInfo.system,
                cached: true,
                timestamp: Date.now()
            })
        } catch (error) {
            log.error('Device info API error:', error.message)
            res.status(500).json({ error: 'Failed to get device info' })
        }
    })

    app.get('/api/system/memory', async function (req, res) {
        try {
            const memoryInfo = await systemInfoManager.getSystemInfo('memory')
            res.json(memoryInfo || {})
        } catch (error) {
            log.error('Memory info API error:', error.message)
            res.status(500).json({ error: 'Failed to get memory info' })
        }
    })

    app.get('/api/system/disk', async function (req, res) {
        try {
            const diskInfo = await systemInfoManager.getSystemInfo('disk')
            res.json(diskInfo || {})
        } catch (error) {
            log.error('Disk info API error:', error.message)
            res.status(500).json({ error: 'Failed to get disk info' })
        }
    })

    app.get('/api/system/network', async function (req, res) {
        try {
            const networkInfo = await systemInfoManager.getSystemInfo('network')
            res.json(networkInfo || {})
        } catch (error) {
            log.error('Network info API error:', error.message)
            res.status(500).json({ error: 'Failed to get network info' })
        }
    })

    app.get('/api/system/display', async function (req, res) {
        try {
            const displayInfo = await systemInfoManager.getSystemInfo('display')
            res.json(displayInfo || {})
        } catch (error) {
            log.error('Display info API error:', error.message)
            res.status(500).json({ error: 'Failed to get display info' })
        }
    })

    app.get('/api/system/full-info', async function (req, res) {
        try {
            const fullSystemInfo = await systemInfoManager.getMultipleSystemInfo([
                'cpu', 'memory', 'disk', 'network', 'display', 'system'
            ])
            
            res.json({
                cpu: fullSystemInfo.cpu,
                memory: fullSystemInfo.memory,
                disk: fullSystemInfo.disk,
                network: fullSystemInfo.network,
                display: fullSystemInfo.display,
                system: fullSystemInfo.system,
                timestamp: new Date().toISOString(),
                cached: true
            })
        } catch (error) {
            log.error('Full system info API error:', error.message)
            res.status(500).json({ error: 'Failed to get system info' })
        }
    })

    // Screenshot endpoint
    app.get('/api/screenshot', function (req, res) {
        log.info('Screenshot API endpoint called')
        
        try {
            if (!electronWindow) {
                log.warn('Screenshot failed: Electron window not available')
                return res.status(500).json({ 
                    error: 'Electron window not available',
                    success: false 
                })
            }

            // Capture screenshot of the main Electron window
            electronWindow.capturePage().then(nativeImage => {
                const dataURL = nativeImage.toDataURL()
                const base64Data = dataURL.split(',')[1] // Remove the data:image/png;base64, prefix
                
                log.info('Screenshot captured successfully')
                res.json({
                    success: true,
                    screenshot: base64Data,
                    format: 'png',
                    timestamp: new Date().toISOString()
                })
            }).catch(error => {
                log.error('Screenshot capture error:', error)
                res.status(500).json({ 
                    error: 'Failed to capture screenshot: ' + error.message,
                    success: false 
                })
            })
        } catch (error) {
            log.error('Screenshot API error:', error)
            res.status(500).json({ 
                error: 'Internal server error: ' + error.message,
                success: false 
            })
        }
    })

    // Display control endpoints
    app.get('/api/display/screen/:state', async function (req, res) {
        const state = req.params.state.toLowerCase()
        
        if (state === 'on' || state === 'off') {
            try {
                const result = await handleScreenToggle(state)
                res.json({ 
                    success: true, 
                    state: state,
                    screen: result.screen,
                    audio: result.audio,
                    message: `Screen ${state === 'off' ? 'disabled' : 'enabled'} successfully`
                })
            } catch (error) {
                log.error('API screen toggle error:', error)
                res.status(500).json({ 
                    success: false, 
                    error: error.message,
                    state: state
                })
            }
        } else {
            res.status(400).json({ 
                success: false,
                error: 'Screen state must be "on" or "off"',
                provided: state
            })
        }
    })

    // Volume control endpoints
    app.get('/api/volume/mute', async function (req, res) {
        try {
            const result = await muteSystemVolume()
            res.json({ 
                success: result.success, 
                action: 'mute',
                message: 'Volume muted successfully'
            })
        } catch (error) {
            log.error('API mute error:', error)
            res.status(500).json({ 
                success: false, 
                error: error.message 
            })
        }
    })

    app.get('/api/volume/unmute', async function (req, res) {
        try {
            const result = await unmuteSystemVolume()
            res.json({ 
                success: result.success, 
                action: 'unmute',
                message: 'Volume unmuted successfully'
            })
        } catch (error) {
            log.error('API unmute error:', error)
            res.status(500).json({ 
                success: false, 
                error: error.message 
            })
        }
    })

    app.post('/api/volume/set', async function (req, res) {
        const volume = req.body.volume
        if (volume >= 0 && volume <= 100) {
            try {
                const result = await setSystemVolumeLevel(volume)
                res.json({ 
                    success: result.success, 
                    volume: result.volume,
                    message: `Volume set to ${result.volume}%`
                })
            } catch (error) {
                log.error('API volume set error:', error)
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                })
            }
        } else {
            res.status(400).json({ error: 'Volume must be between 0 and 100' })
        }
    })

    app.get('/api/volume/get', async function (req, res) {
        try {
            const volume = await getCurrentVolumeLevel()
            res.json({ 
                success: true, 
                volume: volume,
                message: `Current volume: ${volume}%`
            })
        } catch (error) {
            log.error('API volume get error:', error)
            res.status(500).json({ 
                success: false, 
                error: error.message 
            })
        }
    })

    // Configuration endpoints
    app.get('/api/config', function (req, res) {
        try {
            const configPath = path.join(appdir, 'config.json')
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
                res.json(config)
            } else {
                // Return default configuration
                res.json({
                    autoStartup: false,
                    fullscreenMode: false,
                    screenTimeout: 0,
                    updateInterval: 30,
                    logLevel: 'info'
                })
            }
        } catch (error) {
            log.warn('Config load error: ' + error)
            res.status(500).json({ error: 'Failed to load configuration' })
        }
    })

    app.post('/api/config', function (req, res) {
        try {
            const config = req.body
            const configPath = path.join(appdir, 'config.json')
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
            
            var electronID = io.sockets.sockets.get(userID['eCLESS'])
            if (electronID) {
                electronID.emit("config-updated", config)
            }
            
            res.json({ success: true, message: 'Configuration saved' })
        } catch (error) {
            log.warn('Config save error: ' + error)
            res.status(500).json({ error: 'Failed to save configuration' })
        }
    })

    app.post('/api/config/save', function (req, res) {
        try {
            const newConfig = req.body
            const configPath = path.join(appdir, 'config.json')
            
            // Read existing configuration
            let existingConfig = {}
            if (fs.existsSync(configPath)) {
                const configFileContent = fs.readFileSync(configPath, 'utf8')
                existingConfig = JSON.parse(configFileContent)
            }
            
            // Merge new configuration with existing configuration
            const mergedConfig = { ...existingConfig, ...newConfig }
            
            // Update timestamp
            mergedConfig.timestamp = new Date().toISOString()
            
            // Write merged configuration back to file
            fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2))
            
            var electronID = io.sockets.sockets.get(userID['eCLESS'])
            if (electronID) {
                electronID.emit("config-updated", mergedConfig)
            }
            
            res.json({ success: true, message: 'Configuration saved', config: mergedConfig })
        } catch (error) {
            log.warn('Config save error: ' + error)
            res.status(500).json({ error: 'Failed to save configuration' })
        }
    })

    app.get('/api/config/load', function (req, res) {
        try {
            const configPath = path.join(appdir, 'config.json')
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
                res.json(config)
            } else {
                res.json({ message: 'No configuration file found' })
            }
        } catch (error) {
            log.warn('Config load error: ' + error)
            res.status(500).json({ error: 'Failed to load configuration' })
        }
    })

    // Optimized system monitoring endpoint with caching
    app.get('/api/system/monitor', async function (req, res) {
        try {
            // Get system info with caching
            const systemData = await systemInfoManager.getMultipleSystemInfo([
                'currentLoad', 'memory', 'disk', 'networkStats'
            ])
            
            // Update data usage tracking if network stats available
            if (systemData.networkStats) {
                updateDataUsage(systemData.networkStats)
            }
            
            const response = {
                cpu: systemData.currentLoad ? {
                    load: systemData.currentLoad.currentLoad,
                    loadUser: systemData.currentLoad.currentLoadUser,
                    loadSystem: systemData.currentLoad.currentLoadSystem
                } : null,
                memory: systemData.memory ? {
                    total: systemData.memory.total,
                    free: systemData.memory.free,
                    used: systemData.memory.used,
                    usage: ((systemData.memory.used / systemData.memory.total) * 100).toFixed(2)
                } : null,
                disk: systemData.disk ? systemData.disk.map(disk => ({
                    filesystem: disk.fs,
                    size: disk.size,
                    used: disk.used,
                    available: disk.available,
                    usage: disk.use
                })) : [],
                network: systemData.networkStats ? systemData.networkStats.map(net => ({
                    interface: net.iface,
                    rx_bytes: net.rx_bytes,
                    tx_bytes: net.tx_bytes,
                    rx_sec: net.rx_sec,
                    tx_sec: net.tx_sec
                })) : [],
                timestamp: Date.now(),
                cached: true
            }
            
            res.json(response)
            
        } catch (error) {
            log.error('System monitor API error:', error.message)
            res.status(500).json({ error: 'System monitoring error: ' + error.message })
        }
    })

    // Data usage management endpoint
    app.get('/api/system/data-usage', function (req, res) {
        res.json({
            daily: {
                download: dataUsageInfo.daily.download,
                upload: dataUsageInfo.daily.upload,
                total: dataUsageInfo.daily.download + dataUsageInfo.daily.upload,
                date: dataUsageInfo.daily.date
            },
            monthly: {
                download: dataUsageInfo.monthly.download,
                upload: dataUsageInfo.monthly.upload,
                total: dataUsageInfo.monthly.download + dataUsageInfo.monthly.upload,
                month: dataUsageInfo.monthly.month,
                year: dataUsageInfo.monthly.year
            },
            total: {
                download: dataUsageInfo.total.download,
                upload: dataUsageInfo.total.upload,
                total: dataUsageInfo.total.download + dataUsageInfo.total.upload,
                lastReset: dataUsageInfo.lastReset
            }
        })
    })

    // Data usage reset endpoint
    app.post('/api/system/data-usage/reset', function (req, res) {
        try {
            const { type } = req.body
            resetDataUsage(type)
            res.json({ success: true, message: `Data usage ${type || 'all'} has been reset` })
        } catch (error) {
            log.warn('Data usage reset error: ' + error)
            res.status(500).json({ error: 'Failed to reset data usage' })
        }
    })

    app.use(express.static(__dirname + '//src'))
    app.use(express.static(__dirname + '//novnc'))

    // ================================================
    // DIRECT VOLUME CONTROL FUNCTIONS
    // ================================================
    
    /**
     * Get current system volume level
     * Returns a Promise that resolves with volume percentage (0-100)
     */
    function getCurrentVolumeLevel() {
        return new Promise((resolve, reject) => {
            const platform = process.platform
            
            if (platform === 'win32') {
                // Windows: Use PowerShell to get volume
                const command = 'powershell "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Devices.Audio]::new().Info.MasterVolume"'
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error getting Windows volume:', error)
                        reject(error)
                        return
                    }
                    try {
                        const volume = Math.round(parseFloat(stdout.trim()) * 100)
                        resolve(volume)
                    } catch (parseError) {
                        log.error('Error parsing Windows volume:', parseError)
                        reject(parseError)
                    }
                })
            } else if (platform === 'linux') {
                // Linux: Use amixer
                exec('amixer get Master | grep -o "[0-9]*%" | head -1 | tr -d "%"', (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error getting Linux volume:', error)
                        reject(error)
                        return
                    }
                    try {
                        const volume = parseInt(stdout.trim()) || 0
                        resolve(volume)
                    } catch (parseError) {
                        log.error('Error parsing Linux volume:', parseError)
                        reject(parseError)
                    }
                })
            } else if (platform === 'darwin') {
                // macOS: Use osascript
                exec('osascript -e "output volume of (get volume settings)"', (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error getting macOS volume:', error)
                        reject(error)
                        return
                    }
                    try {
                        const volume = parseInt(stdout.trim()) || 0
                        resolve(volume)
                    } catch (parseError) {
                        log.error('Error parsing macOS volume:', parseError)
                        reject(parseError)
                    }
                })
            } else {
                reject(new Error('Unsupported platform for volume control'))
            }
        })
    }

    /**
     * Set system volume level
     * @param {number} volumePercent - Volume level (0-100)
     * @returns {Promise}
     */
    function setSystemVolumeLevel(volumePercent) {
        return new Promise((resolve, reject) => {
            const platform = process.platform
            const volume = Math.max(0, Math.min(100, volumePercent)) // Ensure 0-100 range
            
            log.info(`Setting system volume to ${volume}%`)
            
            if (platform === 'win32') {
                // Windows: Use PowerShell to set volume
                const command = `powershell "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Devices.Audio]::new().Volume = ${volume / 100}"`
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error setting Windows volume:', error)
                        reject(error)
                        return
                    }
                    log.info(`Windows volume set to ${volume}%`)
                    resolve({ success: true, volume: volume })
                })
            } else if (platform === 'linux') {
                // Linux: Use amixer
                exec(`amixer set Master ${volume}%`, (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error setting Linux volume:', error)
                        reject(error)
                        return
                    }
                    log.info(`Linux volume set to ${volume}%`)
                    resolve({ success: true, volume: volume })
                })
            } else if (platform === 'darwin') {
                // macOS: Use osascript
                exec(`osascript -e "set volume output volume ${volume}"`, (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error setting macOS volume:', error)
                        reject(error)
                        return
                    }
                    log.info(`macOS volume set to ${volume}%`)
                    resolve({ success: true, volume: volume })
                })
            } else {
                reject(new Error('Unsupported platform for volume control'))
            }
        })
    }

    /**
     * Mute system volume
     * @returns {Promise}
     */
    function muteSystemVolume() {
        return new Promise((resolve, reject) => {
            const platform = process.platform
            
            log.info('Muting system volume')
            
            if (platform === 'win32') {
                // Windows: Use nircmd or PowerShell
                exec('powershell "(New-Object -comObject WScript.Shell).SendKeys([char]173)"', (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error muting Windows volume:', error)
                        reject(error)
                        return
                    }
                    log.info('Windows volume muted')
                    resolve({ success: true, action: 'mute' })
                })
            } else if (platform === 'linux') {
                // Linux: Use amixer
                exec('amixer set Master mute', (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error muting Linux volume:', error)
                        reject(error)
                        return
                    }
                    log.info('Linux volume muted')
                    resolve({ success: true, action: 'mute' })
                })
            } else if (platform === 'darwin') {
                // macOS: Use osascript
                exec('osascript -e "set volume with output muted"', (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error muting macOS volume:', error)
                        reject(error)
                        return
                    }
                    log.info('macOS volume muted')
                    resolve({ success: true, action: 'mute' })
                })
            } else {
                reject(new Error('Unsupported platform for volume control'))
            }
        })
    }

    /**
     * Unmute system volume
     * @returns {Promise}
     */
    function unmuteSystemVolume() {
        return new Promise((resolve, reject) => {
            const platform = process.platform
            
            log.info('Unmuting system volume')
            
            if (platform === 'win32') {
                // Windows: Use PowerShell
                exec('powershell "(New-Object -comObject WScript.Shell).SendKeys([char]173)"', (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error unmuting Windows volume:', error)
                        reject(error)
                        return
                    }
                    log.info('Windows volume unmuted')
                    resolve({ success: true, action: 'unmute' })
                })
            } else if (platform === 'linux') {
                // Linux: Use amixer
                exec('amixer set Master unmute', (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error unmuting Linux volume:', error)
                        reject(error)
                        return
                    }
                    log.info('Linux volume unmuted')
                    resolve({ success: true, action: 'unmute' })
                })
            } else if (platform === 'darwin') {
                // macOS: Use osascript
                exec('osascript -e "set volume without output muted"', (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error unmuting macOS volume:', error)
                        reject(error)
                        return
                    }
                    log.info('macOS volume unmuted')
                    resolve({ success: true, action: 'unmute' })
                })
            } else {
                reject(new Error('Unsupported platform for volume control'))
            }
        })
    }

    // ================================================
    // DIRECT SCREEN CONTROL FUNCTIONS
    // ================================================
    
    /**
     * Turn screen/display off using system commands
     * @returns {Promise}
     */
    function turnScreenOff() {
        return new Promise((resolve, reject) => {
            const platform = process.platform
            
            log.info('Turning screen OFF')
            
            if (platform === 'win32') {
                // Windows: Turn off monitor using PowerShell
                exec('powershell "(Add-Type \'[DllImport(\\\"user32.dll\\\")]public static extern int SendMessage(int hWnd,int hMsg,int wParam,int lParam);\' -Name Win32; [Win32]::SendMessage(0xFFFF, 0x0112, 0xF170, 2))"', (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error turning off Windows screen:', error)
                        // Fallback: try alternative method
                        exec('powershell "Start-Process -FilePath \\"C:\\\\Windows\\\\System32\\\\scrnsave.scr\\" -ArgumentList \\"/s\\""', (fallbackError) => {
                            if (fallbackError) {
                                log.error('Fallback screen off method also failed:', fallbackError)
                                reject(fallbackError)
                            } else {
                                log.info('Windows screen turned off using fallback method')
                                resolve({ success: true, action: 'screen-off', method: 'screensaver' })
                            }
                        })
                    } else {
                        log.info('Windows screen turned off')
                        resolve({ success: true, action: 'screen-off', method: 'powershell' })
                    }
                })
            } else if (platform === 'linux') {
                // Linux: Turn off display using xset
                exec('export DISPLAY=:0 && xset dpms force off', (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error turning off Linux screen with xset:', error)
                        // Fallback: try alternative methods
                        exec('export DISPLAY=:0 && xrandr --output $(xrandr | grep " connected" | cut -f1 -d" " | head -1) --off', (fallbackError) => {
                            if (fallbackError) {
                                log.error('Fallback screen off method also failed:', fallbackError)
                                reject(fallbackError)
                            } else {
                                log.info('Linux screen turned off using xrandr')
                                resolve({ success: true, action: 'screen-off', method: 'xrandr' })
                            }
                        })
                    } else {
                        log.info('Linux screen turned off')
                        resolve({ success: true, action: 'screen-off', method: 'xset' })
                    }
                })
            } else if (platform === 'darwin') {
                // macOS: Turn off display
                exec('pmset displaysleepnow', (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error turning off macOS screen:', error)
                        reject(error)
                    } else {
                        log.info('macOS screen turned off')
                        resolve({ success: true, action: 'screen-off', method: 'pmset' })
                    }
                })
            } else {
                reject(new Error('Unsupported platform for screen control'))
            }
        })
    }

    /**
     * Turn screen/display on using system commands
     * @returns {Promise}
     */
    function turnScreenOn() {
        return new Promise((resolve, reject) => {
            const platform = process.platform
            
            log.info('Turning screen ON')
            
            if (platform === 'win32') {
                // Windows: Wake up monitor using mouse movement simulation
                exec('powershell "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(([System.Windows.Forms.Cursor]::Position.X + 1), [System.Windows.Forms.Cursor]::Position.Y); Start-Sleep -Milliseconds 50; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(([System.Windows.Forms.Cursor]::Position.X - 1), [System.Windows.Forms.Cursor]::Position.Y)"', (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error turning on Windows screen:', error)
                        reject(error)
                    } else {
                        log.info('Windows screen turned on')
                        resolve({ success: true, action: 'screen-on', method: 'mouse-movement' })
                    }
                })
            } else if (platform === 'linux') {
                // Linux: Turn on display using xset
                exec('export DISPLAY=:0 && xset dpms force on', (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error turning on Linux screen with xset:', error)
                        // Fallback: try to wake up display with xrandr
                        exec('export DISPLAY=:0 && xrandr --output $(xrandr | grep " disconnected" | cut -f1 -d" " | head -1) --auto || xset s reset', (fallbackError) => {
                            if (fallbackError) {
                                log.warn('Fallback screen on method had issues, but this is often normal:', fallbackError.message)
                                // For screen on, we'll consider it successful even if there are warnings
                                resolve({ success: true, action: 'screen-on', method: 'xset-fallback' })
                            } else {
                                log.info('Linux screen turned on using fallback method')
                                resolve({ success: true, action: 'screen-on', method: 'xrandr' })
                            }
                        })
                    } else {
                        log.info('Linux screen turned on')
                        resolve({ success: true, action: 'screen-on', method: 'xset' })
                    }
                })
            } else if (platform === 'darwin') {
                // macOS: Wake up display by moving mouse cursor
                exec('osascript -e "tell application \\"System Events\\" to key code 126"', (error, stdout, stderr) => {
                    if (error) {
                        log.error('Error turning on macOS screen:', error)
                        reject(error)
                    } else {
                        log.info('macOS screen turned on')
                        resolve({ success: true, action: 'screen-on', method: 'keypress' })
                    }
                })
            } else {
                reject(new Error('Unsupported platform for screen control'))
            }
        })
    }

    /**
     * Handle screen toggle with integrated volume control
     * @param {string} state - 'on' or 'off'
     * @returns {Promise}
     */
    async function handleScreenToggle(state) {
        try {
            log.info(`Screen toggle requested: ${state}`)
            
            if (state === 'off' || state === false) {
                // Screen off: turn off display and mute audio
                log.info('Turning screen OFF - disabling display and muting audio')
                
                // Execute both operations
                const screenResult = await turnScreenOff()
                const muteResult = await muteSystemVolume()
                
                log.info('Screen toggled OFF: display disabled and audio muted')
                return { 
                    success: true, 
                    screen: screenResult, 
                    audio: muteResult,
                    state: 'off'
                }
            } else {
                // Screen on: turn on display and unmute audio
                log.info('Turning screen ON - enabling display and unmuting audio')
                
                // Execute both operations
                const screenResult = await turnScreenOn()
                const unmuteResult = await unmuteSystemVolume()
                
                log.info('Screen toggled ON: display enabled and audio unmuted')
                return { 
                    success: true, 
                    screen: screenResult, 
                    audio: unmuteResult,
                    state: 'on'
                }
            }
        } catch (error) {
            log.error('Error in handleScreenToggle:', error)
            throw error
        }
    }

    //SOCkKET io 

    //Whenever someone connects this gets executed
    io.on('connection', function (socket) {
        var clientip = socket.conn.remoteAddress

        //save user id to specific pc
        socket.on('save id', (msg) => {
            var clientid = msg.substr(0, msg.indexOf(':'))
            console.log('=== CPANEL: save id received ===', msg)
            console.log('=== CPANEL: parsed clientid ===', clientid)
            debug('Received save id event:', msg)
            debug('Parsed clientid:', clientid)
            debug('Socket ID for this connection:', socket.id)
            if (clientid == 'eCLESS') {
                userID[clientid] = socket.id
                console.log('=== CPANEL: eCLESS client registered ===', socket.id)
                debug('Saved eCLESS socket mapping:', userID[clientid])
            } else {
                userID[clientip] = socket.id
                debug('Saved IP socket mapping for', clientip, ':', userID[clientip])
            }
        })

        //cpanel req for text slot
        socket.on('reqtextslot', (msg) => {
            console.log('=== CPANEL: reqtextslot received ===')
            try {
                var electronID = io.sockets.sockets.get(userID['eCLESS'])
                if (electronID) {
                    console.log('=== CPANEL: Forwarding gettextslot to eCLESS ===')
                    electronID.emit("gettextslot", "hi eCLESS")
                } else {
                    console.log('=== CPANEL: eCLESS client not connected ===')
                    log.warn('eCLESS client not connected for reqtextslot')
                }
            } catch (err) {
                console.log('=== CPANEL: Error in reqtextslot ===', err)
                log.warn('cpanel reqtextslot: ' + err)
                return err
            }
        })

        //cpanel req to replace text slot
        socket.on('replace-text', (msg) => {
            try {
                var electronID = io.sockets.sockets.get(userID['eCLESS'])
                if (electronID) {
                    var slotname = msg['slotname']
                    var slottext = msg['text']
                    electronID.emit("replacetextslot", {
                        "slotname": slotname,
                        "slottext": slottext
                    })
                } else {
                    log.warn('eCLESS client not connected for replace-text')
                }
            } catch (err) {
                log.warn('cpanel replace-text: ' + err)
                return err
            }
        })

        //cpanel req for media slot
        socket.on('reqmediaslot', (msg) => {
            console.log('=== CPANEL: reqmediaslot received ===')
            try {
                var electronID = io.sockets.sockets.get(userID['eCLESS'])
                if (electronID) {
                    console.log('=== CPANEL: Forwarding getmediaslot to eCLESS ===')
                    electronID.emit("getmediaslot", "hi eCLESS")
                } else {
                    console.log('=== CPANEL: eCLESS client not connected ===')
                    log.warn('eCLESS client not connected for reqmediaslot')
                }
            } catch (err) {
                console.log('=== CPANEL: Error in reqmediaslot ===', err)
                log.warn('cpanel reqmediaslot: ' + err)
                return err
            }
        })

        //cpanel req for mediafiles
        socket.on('reqmediafiles', (msg) => {
            try {
                var electronID = io.sockets.sockets.get(userID['eCLESS'])
                if (electronID) {
                    electronID.emit("getmediaslot", "hi eCLESS")
                }
                var mediafiles = []
                //passing directoryPath and callback function
                fs.readdir(appdir + '/res', function (err, files) {
                    //handling error
                    if (err) {
                        log.warn('Unable to scan directory: ' + err)
                        debug('Unable to scan directory: ' + err)
                        // Send empty array even if there's an error
                        socket.emit('cpanel-mediafiles', mediafiles)
                        return
                    }
                    
                    // If no files, send empty array immediately
                    if (files.length === 0) {
                        socket.emit('cpanel-mediafiles', mediafiles)
                        return
                    }
                    
                    //listing all files using forEach
                    files.forEach(function (file, index) {
                        mediafiles.push(file)
                        // Send response after processing the last file
                        if (index === files.length - 1) {
                            socket.emit('cpanel-mediafiles', mediafiles)
                        }
                    })
                })
            } catch (err) {
                log.warn('cpanel reqmediafiles: ' + err)
                return err
            }
        })

        //cpanel req to replace media slot
        socket.on('replace-media', (msg) => {
            try {
                var electronID = io.sockets.sockets.get(userID['eCLESS'])
                if (electronID) {
                    var slotname = msg['slotname']
                    var slotfilename = msg['filename']
                    electronID.emit("replacemediaslot", {
                        "slotname": slotname,
                        "slottext": slotfilename,
                        "resfolder": appdir + '/res',
                    })
                } else {
                    log.warn('eCLESS client not connected for replace-media')
                }
            } catch (err) {
                log.warn('cpanel replace-media: ' + err)
                return err
            }
        })

        //cpanel req to replace layout
        socket.on('replace-layout', (msg) => {
            try {
                var electronID = io.sockets.sockets.get(userID['eCLESS'])
                if (electronID) {
                    var layoutid = msg['id']
                    electronID.emit("updatelayout", {
                        "id": layoutid
                    })
                } else {
                    log.warn('eCLESS client not connected for replace-layout')
                }
            } catch (err) {
                log.warn('cpanel replace-layout : ' + err)
                return err
            }
        })

        //get text slot list
        socket.on('textslot-list', (msg) => {
            console.log('=== CPANEL: textslot-list received ===')
            console.log('Data:', msg ? (Array.isArray(msg) ? msg.length + ' slots' : 'single slot') : 'no data')
            try {
                io.emit('cpanel-textslot', msg)
                console.log('=== CPANEL: cpanel-textslot emitted to all clients ===')
            } catch (err) {
                console.log('=== CPANEL: Error in textslot-list ===', err)
                log.warn('cpanel textslot-list: ' + err)
                return err
            }
        })

        //get media slot list
        socket.on('mediaslot-list', (msg) => {
            console.log('=== CPANEL: mediaslot-list received ===')
            console.log('Data:', msg ? (Array.isArray(msg) ? msg.length + ' slots' : 'single slot') : 'no data')
            try {
                io.emit('cpanel-mediaslot', msg)
                console.log('=== CPANEL: cpanel-mediaslot emitted to all clients ===')
            } catch (err) {
                console.log('=== CPANEL: Error in mediaslot-list ===', err)
                log.warn('cpanel mediaslot-list: ' + err)
                return err
            }
        })

        //handle screen toggle control
        socket.on('set-screen-toggle', async (msg) => {
            try {
                const state = msg.state || msg
                const result = await handleScreenToggle(state)
                socket.emit('screen-toggle-response', { 
                    success: result.success, 
                    state: result.state,
                    screen: result.screen,
                    audio: result.audio,
                    message: `Screen ${state === 'off' ? 'disabled' : 'enabled'} successfully`
                })
            } catch (err) {
                log.warn('cpanel set-screen-toggle: ' + err)
                socket.emit('screen-toggle-response', { 
                    success: false, 
                    error: err.message,
                    state: msg.state || msg 
                })
            }
        })

        // Handle separate screen control events for compatibility
        socket.on('screen-on', async (msg) => {
            try {
                const result = await handleScreenToggle('on')
                socket.emit('screen-control-response', { 
                    action: 'screen-on', 
                    success: result.success,
                    screen: result.screen,
                    audio: result.audio
                })
            } catch (err) {
                log.warn('cpanel screen-on: ' + err)
                socket.emit('screen-control-response', { 
                    action: 'screen-on', 
                    success: false, 
                    error: err.message 
                })
            }
        })

        socket.on('screen-off', async (msg) => {
            try {
                const result = await handleScreenToggle('off')
                socket.emit('screen-control-response', { 
                    action: 'screen-off', 
                    success: result.success,
                    screen: result.screen,
                    audio: result.audio
                })
            } catch (err) {
                log.warn('cpanel screen-off: ' + err)
                socket.emit('screen-control-response', { 
                    action: 'screen-off', 
                    success: false, 
                    error: err.message 
                })
            }
        })

        //handle volume control
        socket.on('set-volume-mute', async (msg) => {
            try {
                const result = await muteSystemVolume()
                socket.emit('volume-control-response', { 
                    action: 'mute', 
                    success: result.success,
                    message: 'Volume muted successfully'
                })
            } catch (err) {
                log.warn('cpanel set-volume-mute: ' + err)
                socket.emit('volume-control-response', { 
                    action: 'mute', 
                    success: false, 
                    error: err.message 
                })
            }
        })

        socket.on('set-volume-unmute', async (msg) => {
            try {
                const result = await unmuteSystemVolume()
                socket.emit('volume-control-response', { 
                    action: 'unmute', 
                    success: result.success,
                    message: 'Volume unmuted successfully'
                })
            } catch (err) {
                log.warn('cpanel set-volume-unmute: ' + err)
                socket.emit('volume-control-response', { 
                    action: 'unmute', 
                    success: false, 
                    error: err.message 
                })
            }
        })

        socket.on('set-volume-level', async (msg) => {
            try {
                const volumeLevel = msg.volume || msg.level || msg
                const result = await setSystemVolumeLevel(volumeLevel)
                socket.emit('volume-control-response', { 
                    action: 'set-level', 
                    success: result.success,
                    volume: result.volume,
                    message: `Volume set to ${result.volume}%`
                })
            } catch (err) {
                log.warn('cpanel set-volume-level: ' + err)
                socket.emit('volume-control-response', { 
                    action: 'set-level', 
                    success: false, 
                    error: err.message 
                })
            }
        })

        socket.on('get-volume-level', async (msg) => {
            try {
                const volume = await getCurrentVolumeLevel()
                socket.emit('volume-level-response', { 
                    success: true, 
                    volume: volume,
                    message: `Current volume: ${volume}%`
                })
            } catch (err) {
                log.warn('cpanel get-volume-level: ' + err)
                socket.emit('volume-level-response', { 
                    success: false, 
                    error: err.message 
                })
            }
        })

        //handle configuration updates
        socket.on('update-config', (msg) => {
            try {
                var electronID = io.sockets.sockets.get(userID['eCLESS'])
                if (electronID) {
                    electronID.emit("update-config", msg)
                }
            } catch (err) {
                log.warn('cpanel update-config: ' + err)
                return err
            }
        })

        //restart pc


        //Whenever someone disconnects this piece of code executed
        socket.on('disconnect', function () {
        })
    })

    server.listen(port, '0.0.0.0', () => {
        log.info(`Express HTTPS server listening on all interfaces (0.0.0.0) port ${port}`)
        log.info(`Access the control panel at: https://localhost:${port} or https://{your-ip}:${port}`)
    })

    server.on('error', (error) => {
        log.error('Server error:', error)
        if (error.code === 'EADDRINUSE') {
            log.error(`Port ${port} is already in use. Please close other applications using this port.`)
        } else if (error.code === 'EACCES') {
            log.error(`Permission denied to bind to port ${port}. Try running as administrator or use a port > 1024.`)
        }
    })

    // Data usage tracking functions
    function updateDataUsage(networkStats) {
        try {
            const now = new Date()
            const currentDate = now.toDateString()
            const currentMonth = now.getMonth()
            const currentYear = now.getFullYear()

            // Reset daily usage if it's a new day
            if (dataUsageInfo.daily.date !== currentDate) {
                dataUsageInfo.daily = { download: 0, upload: 0, date: currentDate }
            }

            // Reset monthly usage if it's a new month
            if (dataUsageInfo.monthly.month !== currentMonth || dataUsageInfo.monthly.year !== currentYear) {
                dataUsageInfo.monthly = { download: 0, upload: 0, month: currentMonth, year: currentYear }
            }

            networkStats.forEach(stat => {
                const interfaceName = stat.iface
                
                // Initialize interface tracking if not exists
                if (!dataUsageInfo.interfaces[interfaceName]) {
                    dataUsageInfo.interfaces[interfaceName] = {
                        lastRx: stat.rx_bytes || 0,
                        lastTx: stat.tx_bytes || 0,
                        lastUpdate: now.toISOString()
                    }
                    return
                }

                const lastInterface = dataUsageInfo.interfaces[interfaceName]
                const rxDiff = (stat.rx_bytes || 0) - lastInterface.lastRx
                const txDiff = (stat.tx_bytes || 0) - lastInterface.lastTx

                // Only add positive differences (handles counter resets)
                if (rxDiff > 0 && txDiff > 0 && rxDiff < 1e12 && txDiff < 1e12) { // Sanity check
                    // Update daily usage
                    dataUsageInfo.daily.download += rxDiff
                    dataUsageInfo.daily.upload += txDiff

                    // Update monthly usage
                    dataUsageInfo.monthly.download += rxDiff
                    dataUsageInfo.monthly.upload += txDiff

                    // Update total usage
                    dataUsageInfo.total.download += rxDiff
                    dataUsageInfo.total.upload += txDiff
                }

                // Update last known values
                lastInterface.lastRx = stat.rx_bytes || 0
                lastInterface.lastTx = stat.tx_bytes || 0
                lastInterface.lastUpdate = now.toISOString()
            })

        } catch (error) {
            debug('Error updating data usage:', error)
        }
    }

    function resetDataUsage(type = 'all') {
        const now = new Date()
        
        switch (type) {
            case 'daily':
                dataUsageInfo.daily = { download: 0, upload: 0, date: now.toDateString() }
                break
            case 'monthly':
                dataUsageInfo.monthly = { download: 0, upload: 0, month: now.getMonth(), year: now.getFullYear() }
                break
            case 'total':
                dataUsageInfo.total = { download: 0, upload: 0 }
                dataUsageInfo.lastReset = now.toISOString()
                break
            case 'all':
            default:
                dataUsageInfo = {
                    daily: { download: 0, upload: 0, date: now.toDateString() },
                    monthly: { download: 0, upload: 0, month: now.getMonth(), year: now.getFullYear() },
                    total: { download: 0, upload: 0 },
                    lastReset: now.toISOString(),
                    interfaces: {}
                }
                break
        }
        
        log.info(`Data usage ${type} has been reset`)
    }

    // Optimized system information gathering using SystemInfoManager
    async function gatherSystemInfo() {
        try {
            // Get all system info using the optimized manager
            const systemData = await systemInfoManager.getMultipleSystemInfo([
                'cpu', 'memory', 'disk', 'network', 'display', 'system'
            ])

            log.info('System information updated successfully')

        } catch (error) {
            log.warn('System info gathering error: ' + error.message)
        }
    }

    // Initialize optimized system monitoring
    const initializeOptimizedMonitoring = async () => {
        try {
            // Initialize websockify
            await initializeWebsockify()
            
            // Start auto-update for essential system info only
            systemInfoManager.startAutoUpdate([
                'memory',    // Update memory info every 2 minutes
                'currentLoad' // Update CPU load every 2 minutes
            ], 120000) // 2 minutes
            
            // Start less frequent updates for disk and network
            systemInfoManager.startAutoUpdate([
                'disk',
                'networkStats'
            ], 300000) // 5 minutes
            
            log.info('Optimized system monitoring initialized')
        } catch (error) {
            log.error('System monitoring initialization error:', error.message)
        }
    }
    
    // Initialize data usage tracking with reduced frequency
    const initializeDataUsageTracking = async () => {
        try {
            const networkStats = await systemInfoManager.getSystemInfo('networkStats')
            if (networkStats) {
                updateDataUsage(networkStats)
            }
            log.info('Data usage tracking initialized')
        } catch (error) {
            log.warn('Data usage tracking initialization error:', error.message)
        }
    }
    
    // Initialize with delays to reduce startup load
    setTimeout(initializeOptimizedMonitoring, 2000)
    setTimeout(initializeDataUsageTracking, 5000)
    
    // Optimized data usage tracking - reduced frequency from 10s to 60s
    const dataUsageInterval = setInterval(async () => {
        try {
            const networkStats = await systemInfoManager.getSystemInfo('networkStats')
            if (networkStats) {
                updateDataUsage(networkStats)
            }
        } catch (error) {
            debug('Data usage tracking update error:', error.message)
        }
    }, 60000) // Update every 1 minute instead of 10 seconds
    
    // Cleanup function for proper resource management
    const cleanup = () => {
        log.info('Cleaning up cpanel resources...')
        
        // Stop system info manager
        if (systemInfoManager) {
            systemInfoManager.cleanup()
        }
        
        // Clear intervals
        clearInterval(dataUsageInterval)
        
        // Clear lazy loader
        if (lazyLoader) {
            lazyLoader.clearAll()
        }
        
        log.info('Cpanel cleanup completed')
    }
    
    // Setup cleanup handlers
    process.on('exit', cleanup)
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    return server

}());
}