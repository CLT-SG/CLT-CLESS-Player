(async function () {
    const express = require('express')
    var https = require('https')
    const shutdown = require('electron-shutdown-command')
    const path = require("path")
    const os = require('os')
    const fs = require("fs")
    const cors = require('cors')
    const bodyParser = require('body-parser')
    const {
        expressCspHeader,
        INLINE,
        NONE,
        SELF
    } = require('express-csp-header')
    const si = require('systeminformation')
    const homedir = os.homedir()
    const appdir = path.normalize(homedir + '/clessapp')

    var options = {
        key: fs.readFileSync(path.join(__dirname, '..', 'cert/key.pem')),
        cert: fs.readFileSync(path.join(__dirname, '..', 'cert/key.crt'))
    }

    const ip = require('ip')
    const websockify = require('node-websockify')
    const app = express()
    const server = https.createServer(options, app)
    const io = require('socket.io')(server)
    var userID = []
    const port = 9000

    //log setup
    const now = new Date()
    var datetime = require('date-and-time')
    const log = require('electron-log')
    const logdir = path.normalize(homedir + '/clessapp/logs/')
    const datelog = datetime.format(now, 'YYYY-MM-DD')
    log.transports.file.file = logdir + datelog + '.log'

    var cpuInfo
    var memoryInfo
    var diskInfo
    var networkInfo
    var displayInfo
    var systemInfo

    //websoctify for novnc
    var ipaddress = ip.address()
    try {
        websockify({
            target: ipaddress + ':5900',
            source: '127.0.0.1:9001',
            key: path.join(__dirname, '..', 'cert/key.pem'), //https://stackoverflow.com/questions/61599298/electron-builder-include-external-folder
            cert: path.join(__dirname, '..', 'cert/key.crt') //https://stackoverflow.com/questions/61599298/electron-builder-include-external-folder
        })
    } catch (e) {
        log.warn(e)
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

    app.get('/api/deviceinfo', function (req, res) {
        res.json({
            cpu: cpuInfo ? JSON.parse(cpuInfo) : null,
            memory: memoryInfo,
            disk: diskInfo,
            network: networkInfo,
            display: displayInfo,
            system: systemInfo
        })
    })

    app.get('/api/system/memory', function (req, res) {
        res.json(memoryInfo || {})
    })

    app.get('/api/system/disk', function (req, res) {
        res.json(diskInfo || {})
    })

    app.get('/api/system/network', function (req, res) {
        res.json(networkInfo || {})
    })

    app.get('/api/system/display', function (req, res) {
        res.json(displayInfo || {})
    })

    app.get('/api/system/full-info', function (req, res) {
        res.json({
            cpu: cpuInfo ? JSON.parse(cpuInfo) : null,
            memory: memoryInfo,
            disk: diskInfo,
            network: networkInfo,
            display: displayInfo,
            system: systemInfo,
            timestamp: new Date().toISOString()
        })
    })

    // Display control endpoints
    app.get('/api/display/screen/:state', function (req, res) {
        const state = req.params.state.toLowerCase()
        if (state === 'on' || state === 'off') {
            // For testing, let's execute the mute/unmute commands directly
            const { exec } = require('child_process')
            
            if (state === 'off') {
                // Mute audio
                exec('amixer set Master mute', (error, stdout, stderr) => {
                    if (error) {
                        console.warn('Failed to mute audio:', error)
                    } else {
                        console.log('Audio muted successfully')
                    }
                })
            } else {
                // Unmute audio
                exec('amixer set Master unmute', (error, stdout, stderr) => {
                    if (error) {
                        console.warn('Failed to unmute audio:', error)
                    } else {
                        console.log('Audio unmuted successfully')
                    }
                })
            }

            // Try to emit to Electron main process if connection exists
            var electronID = io.sockets.sockets.get(userID['eCLESS'])
            console.log('userID mapping:', userID)
            console.log('Looking for eCLESS socket ID:', userID['eCLESS'])
            console.log('Found electronID:', !!electronID)
            if (electronID) {
                electronID.emit("set-screen-toggle", { state: state })
                console.log('Sent screen toggle event to Electron main process')
            } else {
                console.log('No Electron socket connection found, only executed audio commands')
            }
            
            res.json({ success: true, screen: state })
        } else {
            res.status(400).json({ error: 'Screen state must be "on" or "off"' })
        }
    })

    app.get('/api/display/power/:state', function (req, res) {
        const state = req.params.state.toLowerCase()
        if (state === 'on' || state === 'off') {
            var electronID = io.sockets.sockets.get(userID['eCLESS'])
            if (electronID) {
                electronID.emit("set-display-power", { state: state })
                res.json({ success: true, power: state })
            } else {
                res.status(400).json({ error: 'eCLESS client not connected' })
            }
        } else {
            res.status(400).json({ error: 'Power state must be "on" or "off"' })
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

    // System monitoring endpoint
    app.get('/api/system/monitor', function (req, res) {
        si.currentLoad()
            .then(load => {
                si.mem()
                    .then(mem => {
                        si.fsSize()
                            .then(disks => {
                                si.networkStats()
                                    .then(network => {
                                        res.json({
                                            cpu: {
                                                load: load.currentLoad,
                                                loadUser: load.currentLoadUser,
                                                loadSystem: load.currentLoadSystem
                                            },
                                            memory: {
                                                total: mem.total,
                                                free: mem.free,
                                                used: mem.used,
                                                usage: ((mem.used / mem.total) * 100).toFixed(2)
                                            },
                                            disk: disks.map(disk => ({
                                                filesystem: disk.fs,
                                                size: disk.size,
                                                used: disk.used,
                                                available: disk.available,
                                                usage: disk.use
                                            })),
                                            network: network.map(net => ({
                                                interface: net.iface,
                                                rx_bytes: net.rx_bytes,
                                                tx_bytes: net.tx_bytes,
                                                rx_sec: net.rx_sec,
                                                tx_sec: net.tx_sec
                                            })),
                                            timestamp: new Date().toISOString()
                                        })
                                    })
                                    .catch(err => res.status(500).json({ error: 'Network stats error: ' + err }))
                            })
                            .catch(err => res.status(500).json({ error: 'Disk stats error: ' + err }))
                    })
                    .catch(err => res.status(500).json({ error: 'Memory stats error: ' + err }))
            })
            .catch(err => res.status(500).json({ error: 'CPU stats error: ' + err }))
    })

    app.use(express.static(__dirname + '//src'))
    app.use(express.static(__dirname + '//novnc'))

    //SOCkKET io 

    //Whenever someone connects this gets executed
    io.on('connection', function (socket) {
        var clientip = socket.conn.remoteAddress

        //save user id to specific pc
        socket.on('save id', (msg) => {
            var clientid = msg.substr(0, msg.indexOf(':'))
            if (clientid == 'eCLESS') {
                userID[clientid] = socket.id
            } else {
                userID[clientip] = socket.id
            }
        })

        //cpanel req for text slot
        socket.on('reqtextslot', (msg) => {
            try {
                var electronID = io.sockets.sockets.get(userID['eCLESS'])
                electronID.emit("gettextslot", "hi eCLESS")
            } catch (err) {
                log.warn('cpanel reqtextslot: ' + err)
                return err
            }
        })

        //cpanel req to replace text slot
        socket.on('replace-text', (msg) => {
            try {
                var electronID = io.sockets.sockets.get(userID['eCLESS'])
                var slotname = msg['slotname']
                var slottext = msg['text']
                electronID.emit("replacetextslot", {
                    "slotname": slotname,
                    "slottext": slottext
                })
            } catch (err) {
                log.warn('cpanel replace-text: ' + err)
                return err
            }
        })

        //cpanel req for text slot
        socket.on('reqmediaslot', (msg) => {
            try {
                var electronID = io.sockets.sockets.get(userID['eCLESS'])
                electronID.emit("getmediaslot", "hi eCLESS")
            } catch (err) {
                log.warn('cpanel reqmediaslot: ' + err)
                return err
            }
        })

        //cpanel req for mediafiles
        socket.on('reqmediafiles', (msg) => {
            try {
                var electronID = io.sockets.sockets.get(userID['eCLESS'])
                electronID.emit("getmediaslot", "hi eCLESS")
                var mediafiles = []
                //passsing directoryPath and callback function
                fs.readdir(appdir + '/res', function (err, files) {
                    //handling error
                    if (err) {
                        log.warn('Unable to scan directory: ' + err)
                        return console.log('Unable to scan directory: ' + err)
                    }
                    //listing all files using forEach
                    files.forEach(function (file, index) {
                        mediafiles.push(file)
                        // Do whatever you want to do with the file
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
                var slotname = msg['slotname']
                var slotfilename = msg['filename']
                electronID.emit("replacemediaslot", {
                    "slotname": slotname,
                    "slottext": slotfilename,
                    "resfolder": appdir + '/res',
                })
            } catch (err) {
                log.warn('cpanel replace-media: ' + err)
                return err
            }
        })

        //cpanel req to replace media slot
        socket.on('replace-layout', (msg) => {
            try {
                var electronID = io.sockets.sockets.get(userID['eCLESS'])
                var layoutid = msg['id']
                electronID.emit("updatelayout", {
                    "id": layoutid
                })
            } catch (err) {
                log.warn('cpanel replace-layout : ' + err)
                return err
            }
        })

        //get text slot list
        socket.on('textslot-list', (msg) => {
            try {
                socket.broadcast.emit('cpanel-textslot', msg)
            } catch (err) {
                log.warn('cpanel textslot-list: ' + err)
                return err
            }
        })

        //get text slot list
        socket.on('mediaslot-list', (msg) => {
            try {
                socket.broadcast.emit('cpanel-mediaslot', msg)
            } catch (err) {
                log.warn('cpanel mediaslot-list: ' + err)
                return err
            }
        })

        //handle screen toggle control
        socket.on('set-screen-toggle', (msg) => {
            try {
                var electronID = io.sockets.sockets.get(userID['eCLESS'])
                if (electronID) {
                    electronID.emit("set-screen-toggle", msg)
                }
            } catch (err) {
                log.warn('cpanel set-screen-toggle: ' + err)
                return err
            }
        })

        //handle display power control
        socket.on('set-display-power', (msg) => {
            try {
                var electronID = io.sockets.sockets.get(userID['eCLESS'])
                if (electronID) {
                    electronID.emit("set-display-power", msg)
                }
            } catch (err) {
                log.warn('cpanel set-display-power: ' + err)
                return err
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

    server.listen(port, () => {
        log.info(`Express server listening on port ${port}`)
        console.log(`Express server listening on port ${port}`)
    })

    // Initial system information gathering
    async function gatherSystemInfo() {
        try {
            // CPU Information
            const cpu = await si.cpu()
            cpuInfo = JSON.stringify(cpu)
            log.info('cpu : ' + cpuInfo)

            // Memory Information
            const memory = await si.mem()
            memoryInfo = {
                total: memory.total,
                free: memory.free,
                used: memory.used,
                active: memory.active,
                available: memory.available,
                swaptotal: memory.swaptotal,
                swapused: memory.swapused,
                swapfree: memory.swapfree
            }
            log.info('memory : ' + JSON.stringify(memoryInfo))

            // Disk Information
            const disks = await si.fsSize()
            diskInfo = disks.map(disk => ({
                filesystem: disk.fs,
                type: disk.type,
                size: disk.size,
                used: disk.used,
                available: disk.available,
                usage: disk.use,
                mount: disk.mount
            }))
            log.info('disk : ' + JSON.stringify(diskInfo))

            // Network Information
            const networkInterfaces = await si.networkInterfaces()
            networkInfo = networkInterfaces.map(net => ({
                iface: net.iface,
                ifaceName: net.ifaceName,
                ip4: net.ip4,
                ip6: net.ip6,
                mac: net.mac,
                internal: net.internal,
                virtual: net.virtual,
                operstate: net.operstate,
                type: net.type,
                duplex: net.duplex,
                mtu: net.mtu,
                speed: net.speed
            }))
            log.info('network : ' + JSON.stringify(networkInfo))

            // Display Information
            const graphics = await si.graphics()
            displayInfo = {
                controllers: graphics.controllers.map(ctrl => ({
                    vendor: ctrl.vendor,
                    model: ctrl.model,
                    bus: ctrl.bus,
                    vram: ctrl.vram,
                    vramDynamic: ctrl.vramDynamic
                })),
                displays: graphics.displays.map(display => ({
                    vendor: display.vendor,
                    model: display.model,
                    main: display.main,
                    builtin: display.builtin,
                    connection: display.connection,
                    sizex: display.sizex,
                    sizey: display.sizey,
                    pixeldepth: display.pixeldepth,
                    resolutionx: display.resolutionx,
                    resolutiony: display.resolutiony,
                    currentResX: display.currentResX,
                    currentResY: display.currentResY,
                    positionX: display.positionX,
                    positionY: display.positionY
                }))
            }
            log.info('display : ' + JSON.stringify(displayInfo))

            // System Information
            const system = await si.system()
            const osInfo = await si.osInfo()
            systemInfo = {
                manufacturer: system.manufacturer,
                model: system.model,
                version: system.version,
                serial: system.serial,
                uuid: system.uuid,
                sku: system.sku,
                os: {
                    platform: osInfo.platform,
                    distro: osInfo.distro,
                    release: osInfo.release,
                    codename: osInfo.codename,
                    kernel: osInfo.kernel,
                    arch: osInfo.arch,
                    hostname: osInfo.hostname,
                    fqdn: osInfo.fqdn,
                    codepage: osInfo.codepage,
                    logofile: osInfo.logofile,
                    serial: osInfo.serial,
                    build: osInfo.build,
                    servicepack: osInfo.servicepack,
                    uefi: osInfo.uefi
                }
            }
            log.info('system : ' + JSON.stringify(systemInfo))

        } catch (error) {
            log.warn('System info gathering error: ' + error)
        }
    }

    // Initial gather
    gatherSystemInfo()

    // Update system information periodically
    setInterval(function () {
        gatherSystemInfo()
    }, 30000) // Update every 30 seconds

    module.exports = server

}())