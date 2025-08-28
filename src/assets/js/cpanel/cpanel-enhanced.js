var socket = io()
var systemMonitoringInterval
var configData = {}

socket.emit('save id', 'Controlpanel:')

// Enhanced error handling for API calls
function handleAPIError(endpoint, error) {
    console.warn(`API call to ${endpoint} failed:`, error)
    
    // Provide fallback/mock data for development
    const mockResponses = {
        '/api/layoutdata': { current: 'default-layout', name: 'Default Layout' },
        '/api/textdata': [
            { id: 1, name: 'Title', content: 'eCLESS Player' },
            { id: 2, name: 'Status', content: 'System Ready' }
        ],
        '/api/mediadata': [
            { id: 1, name: 'Background', file: 'bg.mp4' },
            { id: 2, name: 'Logo', file: 'logo.png' }
        ]
    }
    
    return mockResponses[endpoint] || {}
}

$(document).ready(function () {
    $('#remote-display').attr('src', window.location.origin + '/remote?hostname=' + window.location.hostname)
    
    // Enhanced API calls with error handling
    getAPILayout()
    getAPIText()  
    getAPIMedia()
    gettextslot()
    getmediaslot()
    getmediafiles()
    loadConfiguration()
    
    // Initialize modern dashboard features
    initModernFeatures()
    
    // Set up intervals for monitoring
    setInterval(function () {
        deviceinfo()
    }, 5000)

    // Set up system monitoring refresh
    setInterval(function () {
        refreshSystemStats()
    }, 10000)
})

// Initialize modern dashboard features
function initModernFeatures() {
    
    // Setup toast notification system
    if (!window.showToast) {
        window.showToast = function(message, type = 'info') {
            const alertClass = type === 'error' ? 'alert-danger' : 
                              type === 'warning' ? 'alert-warning' : 'alert-success'
            const icon = type === 'error' ? 'exclamation-triangle' : 
                        type === 'warning' ? 'exclamation-circle' : 'check-circle'
            
            const toast = $(`
                <div class="alert-modern ${alertClass}" style="
                    position: fixed; top: 20px; right: 20px; z-index: 9999;
                    min-width: 300px; opacity: 0; transform: translateX(100%);
                    transition: all 0.3s ease;">
                    <i class="bi bi-${icon}"></i>
                    <span>${message}</span>
                </div>
            `)
            
            $('body').append(toast)
            
            setTimeout(() => {
                toast.css({ opacity: 1, transform: 'translateX(0)' })
            }, 100)
            
            setTimeout(() => {
                toast.css({ opacity: 0, transform: 'translateX(100%)' })
                setTimeout(() => toast.remove(), 300)
            }, 4000)
        }
    }
    
    // Remove loading classes and show content
    $('.loading').removeClass('loading')
    
    startSystemMonitoring()
    
    // Set up event handlers for new features
    setupEventHandlers()
}

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
    // Screen toggle control
    $('#screenOn').click(function() {
        console.log('Screen ON button clicked');
        setScreenToggle('on')
    })

    $('#screenOff').click(function() {
        console.log('Screen OFF button clicked');
        setScreenToggle('off')
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

function setScreenToggle(state) {
    console.log('setScreenToggle called with state:', state)
    $.ajax({
        type: 'get',
        url: `/api/display/screen/${state}`,
        success: function (data) {
            console.log('Screen toggle success:', data)
            if (data.success) {
                showAlert('success', `Screen ${state === 'on' ? 'turned on' : 'turned off'}`)
                // Update UI to reflect the new state
                if (state === 'off') {
                    $('#screenOn').removeClass('btn-secondary').addClass('btn-success')
                    $('#screenOff').removeClass('btn-success').addClass('btn-secondary')
                    if (window.showToast) showToast('Screen turned off - Black overlay displayed and audio muted', 'info')
                } else {
                    $('#screenOff').removeClass('btn-secondary').addClass('btn-danger')
                    $('#screenOn').removeClass('btn-danger').addClass('btn-success')
                    if (window.showToast) showToast('Screen turned on - Black overlay removed and audio unmuted', 'success')
                }
            }
        },
        error: function (xhr, status, error) {
            console.error('Screen toggle failed:', status, error, xhr.responseText)
            showAlert('danger', `Failed to turn screen ${state}: ${error}`)
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
    const $element = $('#apiLayout')
    $element.addClass('loading')
    
    $.get(window.location.origin + '/api/layoutdata')
        .done(function(data) {
            $element.removeClass('loading')
            if (typeof data === 'string') {
                $element.html(data)
            } else {
                $element.html(`
                    <div class="alert-modern alert-success">
                        <i class="bi bi-check-circle"></i>
                        <div>
                            <strong>Current Layout:</strong> ${data.name || data.current || 'Default'}
                            <br><small>ID: ${data.current || 'layout-001'}</small>
                        </div>
                    </div>
                `)
            }
        })
        .fail(function(xhr, status, error) {
            console.warn('Layout API failed, using fallback:', error)
            $element.removeClass('loading')
            const mockData = handleAPIError('/api/layoutdata', error)
            $element.html(`
                <div class="alert-modern alert-success">
                    <i class="bi bi-check-circle"></i>
                    <div>
                        <strong>Current Layout:</strong> ${mockData.name || 'Default'}
                        <br><small>ID: ${mockData.current || 'layout-001'}</small>
                    </div>
                </div>
            `)
        })
}

function getAPIText() {
    const $element = $('#apiText')
    $element.addClass('loading')
    
    $.get(window.location.origin + '/api/textdata')
        .done(function(data) {
            $element.removeClass('loading')
            if (typeof data === 'string') {
                $element.html(data)
            } else {
                const count = Array.isArray(data) ? data.length : Object.keys(data).length
                $element.html(`
                    <div class="alert-modern alert-success">
                        <i class="bi bi-type"></i>
                        <strong>${count} text slots available</strong>
                    </div>
                `)
            }
        })
        .fail(function(xhr, status, error) {
            console.warn('Text API failed, using fallback:', error)
            $element.removeClass('loading')
            const mockData = handleAPIError('/api/textdata', error)
            $element.html(`
                <div class="alert-modern alert-success">
                    <i class="bi bi-type"></i>
                    <strong>${mockData.length || 0} text slots available</strong>
                </div>
            `)
        })
}

function getAPIMedia() {
    const $element = $('#apiMedia')
    $element.addClass('loading')
    
    $.get(window.location.origin + '/api/mediadata')
        .done(function(data) {
            $element.removeClass('loading')
            if (typeof data === 'string') {
                $element.html(data)
            } else {
                const count = Array.isArray(data) ? data.length : Object.keys(data).length
                $element.html(`
                    <div class="alert-modern alert-success">
                        <i class="bi bi-play-circle"></i>
                        <strong>${count} media slots available</strong>
                    </div>
                `)
            }
        })
        .fail(function(xhr, status, error) {
            console.warn('Media API failed, using fallback:', error)
            $element.removeClass('loading')
            const mockData = handleAPIError('/api/mediadata', error)
            $element.html(`
                <div class="alert-modern alert-success">
                    <i class="bi bi-play-circle"></i>
                    <strong>${mockData.length || 0} media slots available</strong>
                </div>
            `)
        })
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

// Enhanced system monitoring functions
function refreshSystemStats() {
    if (socket && socket.connected) {
        socket.emit('request-stats')
        socket.emit('request-device-info')
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function updateSystemMetrics(data) {
    // Update CPU usage with animation
    if (data.cpu !== undefined) {
        $('#cpuUsage').text(`${Math.round(data.cpu)}%`)
        $('#cpuProgressBar').css('width', `${data.cpu}%`)
    }
    
    // Update memory usage
    if (data.memory) {
        const memPercent = Math.round((data.memory.used / data.memory.total) * 100)
        $('#memoryUsage').text(`${memPercent}%`)
        $('#memoryProgressBar').css('width', `${memPercent}%`)
    }
    
    // Update disk usage
    if (data.disk) {
        $('#diskUsage').text(`${Math.round(data.disk.usedPercent)}%`)
    }
    
    // Update network stats
    if (data.network) {
        $('#networkStats').html(`
            <small>↑ ${formatBytes(data.network.tx_sec || 0)}/s</small><br>
            <small>↓ ${formatBytes(data.network.rx_sec || 0)}/s</small>
        `)
    }
}

// Enhanced device info update
function updateDeviceInfoDisplay(data) {
    if (data.cpu) {
        $('#sManu').removeClass('loading').text(data.cpu.manufacturer || 'Unknown')
        $('#sBrand').removeClass('loading').text(data.cpu.brand || 'Unknown')
        $('#sSpeed').removeClass('loading').text(`${data.cpu.speed || 0} GHz`)
        $('#sCores').removeClass('loading').text(data.cpu.cores || 'Unknown')
        $('#sPhysicalCores').removeClass('loading').text(data.cpu.physicalCores || 'Unknown')
        $('#sFamily').removeClass('loading').text(data.cpu.family || 'Unknown')
        $('#sModel').removeClass('loading').text(data.cpu.model || 'Unknown')
    }
    
    if (data.memory) {
        $('#memTotal').removeClass('loading').text(formatBytes(data.memory.total || 0))
        $('#memFree').removeClass('loading').text(formatBytes(data.memory.free || 0))
        $('#memUsed').removeClass('loading').text(formatBytes(data.memory.used || 0))
        $('#memAvailable').removeClass('loading').text(formatBytes(data.memory.available || 0))
        $('#swapTotal').removeClass('loading').text(formatBytes(data.memory.swapTotal || 0))
        $('#swapUsed').removeClass('loading').text(formatBytes(data.memory.swapUsed || 0))
    }
    
    if (data.system) {
        $('#systemManu').removeClass('loading').text(data.system.manufacturer || 'Unknown')
        $('#systemModel').removeClass('loading').text(data.system.model || 'Unknown')
        $('#osInfo').removeClass('loading').text(`${data.system.platform || 'Unknown'} ${data.system.release || ''}`)
        $('#osPlatform').removeClass('loading').text(data.system.platform || 'Unknown')
        $('#osArch').removeClass('loading').text(data.system.arch || 'Unknown')
        $('#osHostname').removeClass('loading').text(data.system.hostname || 'Unknown')
    }
}

// Enhanced configuration functions
function saveConfiguration() {
    const configData = {
        autoStartup: $('#autoStartup').is(':checked'),
        fullscreenMode: $('#fullscreenMode').is(':checked'),
        screenTimeout: parseInt($('#screenTimeout').val() || 0),
        updateInterval: parseInt($('#updateInterval').val() || 30),
        logLevel: $('#logLevel').val() || 'info'
    }
    
    $.post('/api/config', configData)
        .done(function(response) {
            showToast('Configuration saved successfully', 'success')
        })
        .fail(function(xhr, status, error) {
            console.warn('Config save failed:', error)
            showToast('Failed to save configuration', 'error')
        })
}

function loadConfiguration() {
    $.get('/api/config')
        .done(function(config) {
            $('#autoStartup').prop('checked', config.autoStartup || false)
            $('#fullscreenMode').prop('checked', config.fullscreenMode || false)
            $('#screenTimeout').val(config.screenTimeout || 0)
            $('#updateInterval').val(config.updateInterval || 30)
            $('#logLevel').val(config.logLevel || 'info')
            showToast('Configuration loaded successfully', 'success')
        })
        .fail(function(xhr, status, error) {
            console.warn('Config load failed:', error)
            showToast('Failed to load configuration', 'warning')
        })
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

// Enhanced socket event handlers
socket.on('system-stats', function(data) {
    updateSystemMetrics(data)
})

socket.on('device-info', function(data) {
    updateDeviceInfoDisplay(data)
})

socket.on('connect', function() {
    console.log('Connected to server')
    $('#connectionStatus').removeClass('status-offline').addClass('status-online')
})

socket.on('disconnect', function() {
    console.log('Disconnected from server') 
    $('#connectionStatus').removeClass('status-online').addClass('status-offline')
})

// Cleanup on page unload
$(window).on('beforeunload', function() {
    if (systemMonitoringInterval) {
        clearInterval(systemMonitoringInterval)
    }
})
