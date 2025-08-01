var socket = io()
var systemMonitoringInterval
var configData = {}

socket.emit('save id', 'Controlpanel:')

$(document).ready(function () {
    $('#remote-display').attr('src', window.location.origin + '/remote?hostname=' + window.location.hostname)
    getAPILayout()
    getAPIText()
    getAPIMedia()
    gettextslot()
    getmediaslot()
    getmediafiles()
    loadConfiguration()
    
    // Set up intervals for monitoring
    setInterval(function () {
        deviceinfo()
    }, 5000)
    
    startSystemMonitoring()
    
    // Set up event handlers for new features
    setupEventHandlers()
})

function setupEventHandlers() {
    // Original button handlers
    $('#shutdown').click(function () {
        shutdown()
    })

    $('#reboot').click(function () {
        reboot()
    })

    $('#refresh').click(function () {
        refresh()
    })

    $('#restartapp').click(function () {
        restartapp()
    })

    $('.btnUpdateLyt').click(function () {
        var lytid = $('#updateLytInput').val()
        updateLyt(lytid)
    })

    $('.btnReplaceText').click(function () {
        var layoutid = $('#replaceTextList').find(":selected").attr('class')
        var textname = $('#replaceTextList').find(":selected").val()
        var textReplace = $('#replaceTextInput').val()
        replacetextslot(layoutid, textname, textReplace)
    })

    $('.btnReplaceMedia').click(function () {
        var layoutid = $('#replaceMediaList').find(":selected").attr('class')
        var textname = $('#replaceMediaList').find(":selected").val()
        var textReplace = $('#mediaFilesList').find(":selected").val()
        replacemediaslot(layoutid, textname, textReplace)
    })

    // New enhanced handlers
    // Brightness control
    $('#brightnessSlider').on('input', function() {
        var value = $(this).val()
        $('#brightnessValue').text(value)
        setBrightness(value)
    })

    // Display power control
    $('#displayOn').click(function() {
        setDisplayPower('on')
    })

    $('#displayOff').click(function() {
        setDisplayPower('off')
    })

    // Configuration handlers
    $('#saveConfig').click(function() {
        saveConfiguration()
    })

    $('#loadConfig').click(function() {
        loadConfiguration()
    })

    // System monitoring
    $('#refreshMonitoring').click(function() {
        refreshSystemMonitoring()
    })
}

// Enhanced system information display
function deviceinfo() {
    $.ajax({
        type: 'get',
        url: '/api/system/full-info',
        success: function (data) {
            if (data.cpu) {
                $('#sManu').text(data.cpu.manufacturer || 'N/A')
                $('#sBrand').text(data.cpu.brand || 'N/A')
                $('#sSpeed').text((data.cpu.speed ? data.cpu.speed + ' GHz' : 'N/A'))
                $('#sCores').text(data.cpu.cores || 'N/A')
                $('#sPhysicalCores').text(data.cpu.physicalCores || 'N/A')
                $('#sFamily').text(data.cpu.family || 'N/A')
                $('#sModel').text(data.cpu.model || 'N/A')
            }

            if (data.memory) {
                $('#memTotal').text(formatBytes(data.memory.total))
                $('#memFree').text(formatBytes(data.memory.free))
                $('#memUsed').text(formatBytes(data.memory.used))
                $('#memAvailable').text(formatBytes(data.memory.available))
                $('#swapTotal').text(formatBytes(data.memory.swaptotal))
                $('#swapUsed').text(formatBytes(data.memory.swapused))
            }

            if (data.system) {
                $('#systemManu').text(data.system.manufacturer || 'N/A')
                $('#systemModel').text(data.system.model || 'N/A')
                if (data.system.os) {
                    $('#osInfo').text(`${data.system.os.distro} ${data.system.os.release}` || 'N/A')
                    $('#osPlatform').text(data.system.os.platform || 'N/A')
                    $('#osArch').text(data.system.os.arch || 'N/A')
                    $('#osHostname').text(data.system.os.hostname || 'N/A')
                }
            }

            if (data.network) {
                displayNetworkInterfaces(data.network)
            }

            if (data.display) {
                displayDisplayInfo(data.display)
            }

            if (data.disk) {
                displayDiskInfo(data.disk)
            }
        },
        error: function () {
            console.log('Error fetching device info')
        }
    })
}

function displayNetworkInterfaces(interfaces) {
    var html = ''
    interfaces.forEach(function(iface) {
        var statusClass = iface.operstate === 'up' ? 'status-online' : 'status-offline'
        html += `
            <div class="network-interface">
                <span class="status-indicator ${statusClass}"></span>
                <strong>${iface.ifaceName || iface.iface}</strong>
                <br>
                <small>
                    IP: ${iface.ip4 || 'N/A'}<br>
                    MAC: ${iface.mac || 'N/A'}<br>
                    Type: ${iface.type || 'N/A'}<br>
                    Speed: ${iface.speed ? iface.speed + ' Mbps' : 'N/A'}
                </small>
            </div>
        `
    })
    $('#networkInterfaces').html(html)
}

function displayDisplayInfo(displayData) {
    var html = '<table class="table table-striped"><thead><tr><th>Display</th><th>Resolution</th><th>Position</th><th>Connection</th></tr></thead><tbody>'
    
    displayData.displays.forEach(function(display, index) {
        html += `
            <tr>
                <td>${display.model || `Display ${index + 1}`} ${display.main ? '(Primary)' : ''}</td>
                <td>${display.currentResX || display.resolutionx}x${display.currentResY || display.resolutiony}</td>
                <td>${display.positionX || 0}, ${display.positionY || 0}</td>
                <td>${display.connection || 'N/A'}</td>
            </tr>
        `
    })
    
    html += '</tbody></table>'
    $('#displayInfoTable').html(html)
}

function displayDiskInfo(diskData) {
    var html = '<table class="table table-striped"><thead><tr><th>Filesystem</th><th>Type</th><th>Size</th><th>Used</th><th>Available</th><th>Usage</th></tr></thead><tbody>'
    
    diskData.forEach(function(disk) {
        var usagePercent = disk.usage || 0
        var progressBarClass = usagePercent > 90 ? 'bg-danger' : usagePercent > 70 ? 'bg-warning' : 'bg-success'
        
        html += `
            <tr>
                <td>${disk.filesystem}</td>
                <td>${disk.type || 'N/A'}</td>
                <td>${formatBytes(disk.size)}</td>
                <td>${formatBytes(disk.used)}</td>
                <td>${formatBytes(disk.available)}</td>
                <td>
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar ${progressBarClass}" role="progressbar" style="width: ${usagePercent}%">
                            ${usagePercent.toFixed(1)}%
                        </div>
                    </div>
                </td>
            </tr>
        `
    })
    
    html += '</tbody></table>'
    $('#diskInfoTable').html(html)
}

// System monitoring functions
function startSystemMonitoring() {
    systemMonitoringInterval = setInterval(refreshSystemMonitoring, 30000)
    refreshSystemMonitoring() // Initial load
}

function refreshSystemMonitoring() {
    $.ajax({
        type: 'get',
        url: '/api/system/monitor',
        success: function (data) {
            // CPU Usage
            $('#cpuUsage').html(`<span class="metric-value">${data.cpu.load.toFixed(1)}%</span>`)
            $('#cpuProgressBar').css('width', data.cpu.load.toFixed(1) + '%')
            
            // Memory Usage
            $('#memoryUsage').html(`<span class="metric-value">${data.memory.usage}%</span><br><small>${formatBytes(data.memory.used)} / ${formatBytes(data.memory.total)}</small>`)
            $('#memoryProgressBar').css('width', data.memory.usage + '%')
            
            // Disk Usage
            var diskHtml = ''
            data.disk.forEach(function(disk, index) {
                if (index < 2) { // Show only first 2 disks
                    diskHtml += `<small>${disk.filesystem}: ${disk.usage.toFixed(1)}%</small><br>`
                }
            })
            $('#diskUsage').html(diskHtml)
            
            // Network Stats
            var networkHtml = ''
            data.network.forEach(function(net, index) {
                if (index < 1 && net.rx_sec > 0) { // Show only first active interface
                    networkHtml += `<small>↓ ${formatBytes(net.rx_sec)}/s<br>↑ ${formatBytes(net.tx_sec)}/s</small>`
                }
            })
            $('#networkStats').html(networkHtml || '<small>No active traffic</small>')
        },
        error: function () {
            console.log('Error fetching monitoring data')
        }
    })
}

// Display control functions
function setBrightness(level) {
    $.ajax({
        type: 'get',
        url: `/api/display/brightness/${level}`,
        success: function (data) {
            if (data.success) {
                showAlert('success', `Brightness set to ${level}%`)
            }
        },
        error: function () {
            showAlert('danger', 'Failed to set brightness')
        }
    })
}

function setDisplayPower(state) {
    $.ajax({
        type: 'get',
        url: `/api/display/power/${state}`,
        success: function (data) {
            if (data.success) {
                showAlert('success', `Display ${state === 'on' ? 'turned on' : 'turned off'}`)
            }
        },
        error: function () {
            showAlert('danger', `Failed to turn display ${state}`)
        }
    })
}

// Configuration management
function saveConfiguration() {
    configData = {
        autoStartup: $('#autoStartup').is(':checked'),
        fullscreenMode: $('#fullscreenMode').is(':checked'),
        screenTimeout: parseInt($('#screenTimeout').val()) || 0,
        updateInterval: parseInt($('#updateInterval').val()) || 30,
        logLevel: $('#logLevel').val(),
        brightness: parseInt($('#brightnessSlider').val()) || 50,
        timestamp: new Date().toISOString()
    }

    $.ajax({
        type: 'post',
        url: '/api/config/save',
        contentType: 'application/json',
        data: JSON.stringify(configData),
        success: function (data) {
            if (data.success) {
                showAlert('success', 'Configuration saved successfully')
            }
        },
        error: function () {
            showAlert('danger', 'Failed to save configuration')
        }
    })
}

function loadConfiguration() {
    $.ajax({
        type: 'get',
        url: '/api/config/load',
        success: function (data) {
            if (data && Object.keys(data).length > 0) {
                configData = data
                $('#autoStartup').prop('checked', data.autoStartup || false)
                $('#fullscreenMode').prop('checked', data.fullscreenMode || false)
                $('#screenTimeout').val(data.screenTimeout || 0)
                $('#updateInterval').val(data.updateInterval || 30)
                $('#logLevel').val(data.logLevel || 'info')
                if (data.brightness) {
                    $('#brightnessSlider').val(data.brightness)
                    $('#brightnessValue').text(data.brightness)
                }
                showAlert('success', 'Configuration loaded successfully')
            }
        },
        error: function () {
            console.log('No configuration found or error loading')
        }
    })
}

// Utility functions
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function showAlert(type, message) {
    var alertHtml = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
                        ${message}
                        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>`
    
    // Remove existing alerts
    $('.alert').remove()
    
    // Add new alert at the top of the form
    $('.register-form').prepend(alertHtml)
    
    // Auto dismiss after 5 seconds
    setTimeout(function() {
        $('.alert').fadeOut()
    }, 5000)
}

// Original functions (maintaining compatibility)
function shutdown() {
    $.ajax({
        type: 'get',
        url: '/api/shutdown',
        success: function (data) {
            showAlert('success', 'System shutdown initiated')
        }
    })
}

function reboot() {
    $.ajax({
        type: 'get',
        url: '/api/reboot',
        success: function (data) {
            showAlert('success', 'System reboot initiated')
        }
    })
}

function refresh() {
    $.ajax({
        type: 'get',
        url: '/api/refresh',
        success: function (data) {
            showAlert('success', 'Display refreshed')
        }
    })
}

function restartapp() {
    $.ajax({
        type: 'get',
        url: '/api/restartapp',
        success: function (data) {
            showAlert('success', 'Application restarted')
        }
    })
}

function updateLyt(layoutid) {
    socket.emit('replace-layout', {"id": layoutid})
    showAlert('success', `Layout updated to ${layoutid}`)
}

function replacetextslot(layoutid, slotname, slottext) {
    socket.emit('replace-text', {
        "slotname": slotname,
        "text": slottext
    })
    showAlert('success', `Text slot "${slotname}" updated`)
}

function replacemediaslot(layoutid, slotname, slottext) {
    socket.emit('replace-media', {
        "slotname": slotname,
        "filename": slottext
    })
    showAlert('success', `Media slot "${slotname}" updated`)
}

function getAPILayout() {
    $('#apiLayout').load(window.location.origin + '/api/layoutdata')
}

function getAPIText() {
    $('#apiText').load(window.location.origin + '/api/textdata')
}

function getAPIMedia() {
    $('#apiMedia').load(window.location.origin + '/api/mediadata')
}

function gettextslot() {
    socket.emit('reqtextslot', 'get text slot')
}

function getmediaslot() {
    socket.emit('reqmediaslot', 'get media slot')
}

function getmediafiles() {
    socket.emit('reqmediafiles', 'get media files')
}

// Socket event handlers
socket.on('cpanel-textslot', function (msg) {
    $('#replaceTextList').empty()
    $('#replaceTextList').append($('<option>', {
        value: '',
        text: 'Open this to select text slot. Slot Name | Slot Text'
    }))
    
    msg.forEach(function(slot) {
        $('#replaceTextList').append($('<option>', {
            value: slot.name,
            text: `${slot.name} | ${slot.text}`,
            class: slot.layoutid
        }))
    })
})

socket.on('cpanel-mediaslot', function (msg) {
    $('#replaceMediaList').empty()
    $('#replaceMediaList').append($('<option>', {
        value: '',
        text: 'Open this to select media slot. Slot Name | Slot Text'
    }))
    
    msg.forEach(function(slot) {
        $('#replaceMediaList').append($('<option>', {
            value: slot.name,
            text: `${slot.name} | ${slot.text}`,
            class: slot.layoutid
        }))
    })
})

socket.on('cpanel-mediafiles', function (msg) {
    $('#mediaFilesList').empty()
    $('#mediaFilesList').append($('<option>', {
        value: '',
        text: 'Open this to select media filename'
    }))
    
    msg.forEach(function(file) {
        $('#mediaFilesList').append($('<option>', {
            value: file,
            text: file
        }))
    })
})

// Cleanup on page unload
$(window).on('beforeunload', function() {
    if (systemMonitoringInterval) {
        clearInterval(systemMonitoringInterval)
    }
})
