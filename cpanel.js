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

    app.get('/api/deviceinfo', function (req, res) {
        res.end(cpuInfo)
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

        //restart pc


        //Whenever someone disconnects this piece of code executed
        socket.on('disconnect', function () {
        })
    })

    server.listen(port, () => {
        log.info(`Express server listening on port ${port}`)
        console.log(`Express server listening on port ${port}`)
    })

    si.cpu()
        .then(data => {
            cpuInfo = JSON.stringify(data)
            log.info('cpu : ' + cpuInfo)
        })
        .catch(error => {
            cpuInfo = error
            log.warn('cpu error: ' + cpuInfo)
        })
    setInterval(function () {
        si.cpu()
            .then(data =>
                cpuInfo = JSON.stringify(data)
            )
            .catch(error =>
                cpuInfo = error
            )
    }, 10000)

    module.exports = server

}())