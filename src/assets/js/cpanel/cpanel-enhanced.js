console.log('=== CONTROL PANEL: Starting initialization ===')
var socket = io()
var systemMonitoringInterval
var configData = {}

// Debug function for development-only logging  
const debug = localStorage.getItem('ecless-debug') === 'true' ? console.log.bind(console) : () => {}

console.log('=== CONTROL PANEL: Socket created, emitting save id ===')
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
    
    // Initialize volume controls
    getCurrentVolumeLevel()
    
    // Initialize enhanced configuration fields with default values
    initializeConfigurationFields()
    
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

    $('#refreshLayout').click(function () {
        refreshLayout()
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
    // Screen toggle control with one-time click protection
    $('#screenOn').click(function() {
        debug('Screen ON button clicked');
        // Check if button is already disabled to prevent multiple clicks
        if ($(this).prop('disabled')) {
            debug('Screen ON button is disabled, ignoring click');
            return;
        }
        // Disable both buttons immediately to prevent multiple clicks
        $('#screenOn').prop('disabled', true).addClass('btn-loading');
        $('#screenOff').prop('disabled', true);
        setScreenToggle('on');
    })

    $('#screenOff').click(function() {
        debug('Screen OFF button clicked');
        // Check if button is already disabled to prevent multiple clicks
        if ($(this).prop('disabled')) {
            debug('Screen OFF button is disabled, ignoring click');
            return;
        }
        // Disable both buttons immediately to prevent multiple clicks
        $('#screenOff').prop('disabled', true).addClass('btn-loading');
        $('#screenOn').prop('disabled', true);
        setScreenToggle('off');
    })

    // Volume control handlers
    $('#volumeMute').click(function() {
        debug('Volume MUTE button clicked');
        if ($(this).prop('disabled')) {
            debug('Volume MUTE button is disabled, ignoring click');
            return;
        }
        setVolumeMute();
    })

    $('#volumeUnmute').click(function() {
        debug('Volume UNMUTE button clicked');
        if ($(this).prop('disabled')) {
            debug('Volume UNMUTE button is disabled, ignoring click');
            return;
        }
        setVolumeUnmute();
    })

    // Volume slider handler with debouncing
    let volumeTimeout;
    $('#volumeSlider').on('input', function() {
        const volume = $(this).val();
        $('#volumeDisplay').text(volume + '%');
        
        // Clear previous timeout
        clearTimeout(volumeTimeout);
        
        // Set new timeout to avoid too many API calls
        volumeTimeout = setTimeout(() => {
            setVolumeLevel(volume);
        }, 300); // 300ms delay
    })

    // Configuration handlers
    $('#saveConfig').click(function() {
        saveConfiguration()
    })

    $('#loadConfig').click(function() {
        loadConfiguration()
    })

    // Enhanced configuration field validation
    $('#clessHostname').on('blur', function() {
        const hostname = $(this).val().trim()
        if (hostname) {
            try {
                new URL(hostname)
                $(this).removeClass('is-invalid').addClass('is-valid')
            } catch (e) {
                $(this).removeClass('is-valid').addClass('is-invalid')
                showAlert('warning', 'Please enter a valid URL format (e.g., https://example.com)')
            }
        } else {
            $(this).removeClass('is-valid is-invalid')
        }
    })

    $('#dsId').on('input', function() {
        const dsId = $(this).val().trim()
        const dsIdNum = parseInt(dsId)
        if (dsId && (!isNaN(dsIdNum) && dsIdNum >= 1 && dsIdNum <= 9999)) {
            $(this).removeClass('is-invalid').addClass('is-valid')
        } else if (dsId) {
            $(this).removeClass('is-valid').addClass('is-invalid')
        } else {
            $(this).removeClass('is-valid is-invalid')
        }
    })

    // Serial key field handling
    $('#serialKey').on('input', function() {
        const serialKey = $(this).val().trim()
        if (serialKey.length > 0) {
            $(this).addClass('is-valid')
            $(this).attr('title', 'Serial key will be updated when configuration is saved')
        } else {
            $(this).removeClass('is-valid')
            $(this).attr('title', 'Enter the license serial key for activation')
        }
    })

    // System monitoring
    $('#refreshMonitoring').click(function() {
        refreshSystemMonitoring()
    })
    
    // Data usage reset handlers
    $('#resetDailyUsage').click(function() {
        resetDataUsage('daily')
    })
    
    $('#resetMonthlyUsage').click(function() {
        resetDataUsage('monthly')
    })
    
    $('#resetTotalUsage').click(function() {
        resetDataUsage('all')
    })
}

// Initialize configuration fields with proper defaults
function initializeConfigurationFields() {
    // Set default values if fields are empty
    if (!$('#clessHostname').val()) {
        $('#clessHostname').val('https://cless4.closed-loop.biz/demo')
    }
    
    if (!$('#corsOptions').val()) {
        $('#corsOptions').val('N')
    }
    
    if (!$('#dsId').val()) {
        $('#dsId').val('10')
    }
    
    // Ensure serial key field is properly initialized
    if (!$('#serialKey').attr('placeholder')) {
        $('#serialKey').attr('placeholder', 'Enter serial key')
    }
    
    debug('Configuration fields initialized with default values')
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
            console.warn('Error fetching device info')
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
            
            // Data Usage Stats
            if (data.dataUsage) {
                updateDataUsageDisplay(data.dataUsage)
            }
        },
        error: function () {
            console.warn('Error fetching monitoring data')
        }
    })
}

// Data usage display function
function updateDataUsageDisplay(dataUsage) {
    // Update metric cards
    $('#dataUsageDaily').html(formatBytes(dataUsage.daily.total))
    $('#dataUsageMonthly').html(formatBytes(dataUsage.monthly.total))
    $('#dataUsageTotal').html(formatBytes(dataUsage.total.total))
    
    // Update detailed breakdown
    $('#dailyDownload').text(formatBytes(dataUsage.daily.download))
    $('#dailyUpload').text(formatBytes(dataUsage.daily.upload))
    $('#monthlyTotal').text(formatBytes(dataUsage.monthly.total))
    $('#totalUsage').text(formatBytes(dataUsage.total.total))
}

// Data usage reset function
function resetDataUsage(type) {
    if (!confirm(`Are you sure you want to reset ${type} data usage? This action cannot be undone.`)) {
        return
    }
    
    $.ajax({
        type: 'POST',
        url: '/api/system/data-usage/reset',
        data: JSON.stringify({ type: type }),
        contentType: 'application/json',
        success: function (data) {
            if (data.success) {
                if (window.showToast) {
                    showToast(data.message, 'success')
                }
                // Refresh monitoring to show updated values
                refreshSystemMonitoring()
            } else {
                if (window.showToast) {
                    showToast('Failed to reset data usage', 'error')
                }
            }
        },
        error: function () {
            if (window.showToast) {
                showToast('Error resetting data usage', 'error')
            }
        }
    })
}

// Screen control functions

function setScreenToggle(state) {
    debug('setScreenToggle called with state:', state)
    
    const screenOnBtn = $('#screenOn')
    const screenOffBtn = $('#screenOff')
    
    // Show loading state on the clicked button
    const clickedBtn = state === 'on' ? screenOnBtn : screenOffBtn
    clickedBtn.addClass('loading')
    
    $.ajax({
        type: 'get',
        url: `/api/display/screen/${state}`,
        success: function (data) {
            debug('Screen toggle success:', data)
            if (data.success) {
                showAlert('success', `Screen ${state === 'on' ? 'turned on' : 'turned off'}`)
                
                // Update button states based on new screen state
                if (state === 'off') {
                    // Screen is now OFF - disable screen off button, enable screen on button
                    screenOffBtn.prop('disabled', true).removeClass('btn-danger loading').addClass('btn-secondary')
                    screenOnBtn.prop('disabled', false).removeClass('btn-secondary').addClass('btn-success')
                    if (window.showToast) showToast('Screen turned off - Black overlay displayed and audio muted', 'info')
                } else {
                    // Screen is now ON - disable screen on button, enable screen off button
                    screenOnBtn.prop('disabled', true).removeClass('btn-success loading').addClass('btn-secondary')
                    screenOffBtn.prop('disabled', false).removeClass('btn-secondary').addClass('btn-danger')
                    if (window.showToast) showToast('Screen turned on - Black overlay removed and audio unmuted', 'success')
                }
            } else {
                // Re-enable both buttons on failure
                screenOnBtn.prop('disabled', false).removeClass('loading')
                screenOffBtn.prop('disabled', false).removeClass('loading')
                showAlert('danger', `Failed to toggle screen: ${data.message || 'Unknown error'}`)
            }
        },
        error: function (xhr, status, error) {
            console.error('Screen toggle failed:', status, error, xhr.responseText)
            showAlert('danger', `Failed to turn screen ${state}: ${error}`)
            
            // Re-enable both buttons on error
            screenOnBtn.prop('disabled', false).removeClass('loading')
            screenOffBtn.prop('disabled', false).removeClass('loading')
        }
    })
}

// Volume control functions
function setVolumeMute() {
    const muteBtn = $('#volumeMute')
    const unmuteBtn = $('#volumeUnmute')
    
    muteBtn.addClass('loading').prop('disabled', true)
    
    $.ajax({
        type: 'get',
        url: '/api/volume/mute',
        success: function (data) {
            debug('Volume mute success:', data)
            if (data.success) {
                showAlert('success', 'Audio muted')
                muteBtn.removeClass('loading btn-warning').addClass('btn-secondary').prop('disabled', true)
                unmuteBtn.removeClass('btn-secondary').addClass('btn-info').prop('disabled', false)
                if (window.showToast) showToast('System audio muted', 'info')
            }
        },
        error: function (xhr, status, error) {
            console.error('Volume mute failed:', status, error)
            showAlert('danger', `Failed to mute audio: ${error}`)
            muteBtn.removeClass('loading').prop('disabled', false)
        }
    })
}

function setVolumeUnmute() {
    const muteBtn = $('#volumeMute')
    const unmuteBtn = $('#volumeUnmute')
    
    unmuteBtn.addClass('loading').prop('disabled', true)
    
    $.ajax({
        type: 'get',
        url: '/api/volume/unmute',
        success: function (data) {
            debug('Volume unmute success:', data)
            if (data.success) {
                showAlert('success', 'Audio unmuted')
                unmuteBtn.removeClass('loading btn-info').addClass('btn-secondary').prop('disabled', true)
                muteBtn.removeClass('btn-secondary').addClass('btn-warning').prop('disabled', false)
                if (window.showToast) showToast('System audio unmuted', 'success')
            }
        },
        error: function (xhr, status, error) {
            console.error('Volume unmute failed:', status, error)
            showAlert('danger', `Failed to unmute audio: ${error}`)
            unmuteBtn.removeClass('loading').prop('disabled', false)
        }
    })
}

function setVolumeLevel(volume) {
    $('#volumeDisplay').text(volume + '%')
    
    $.ajax({
        type: 'post',
        url: '/api/volume/set',
        contentType: 'application/json',
        data: JSON.stringify({ volume: volume }),
        success: function (data) {
            debug('Volume level set success:', data)
            if (data.success) {
                if (window.showToast) showToast(`Volume set to ${volume}%`, 'info')
            }
        },
        error: function (xhr, status, error) {
            console.error('Volume level set failed:', status, error)
            showAlert('danger', `Failed to set volume: ${error}`)
        }
    })
}

function getCurrentVolumeLevel() {
    $.ajax({
        type: 'get',
        url: '/api/volume/get',
        success: function (data) {
            debug('Get volume request sent:', data)
        },
        error: function (xhr, status, error) {
            console.error('Get volume failed:', status, error)
        }
    })
}

// Configuration management
function saveConfiguration() {
    // Gather all configuration data
    const clessHostname = $('#clessHostname').val().trim()
    const corsOptions = $('#corsOptions').val()
    const dsId = $('#dsId').val().trim()
    const serialKey = $('#serialKey').val().trim()
    
    // Validate required fields
    if (!clessHostname) {
        showAlert('danger', 'CLESS Server Hostname is required')
        return
    }
    
    if (!dsId || isNaN(dsId) || parseInt(dsId) < 1 || parseInt(dsId) > 9999) {
        showAlert('danger', 'DS ID must be a number between 1 and 9999')
        return
    }
    
    // Validate hostname format
    try {
        new URL(clessHostname)
    } catch (e) {
        showAlert('danger', 'CLESS Server Hostname must be a valid URL (e.g., https://example.com)')
        return
    }
    
    configData = {
        // Existing configuration fields
        autoStartup: $('#autoStartup').is(':checked'),
        fullscreenMode: $('#fullscreenMode').is(':checked'),
        screenTimeout: parseInt($('#screenTimeout').val()) || 0,
        updateInterval: parseInt($('#updateInterval').val()) || 30,
        logLevel: $('#logLevel').val(),
        
        // Enhanced configuration fields
        hostserver: clessHostname,
        hostaddress: clessHostname, // for backward compatibility
        corsproxy: corsOptions,
        id: dsId,
        dsid: dsId, // for backward compatibility
        
        // Timestamp for tracking
        timestamp: new Date().toISOString()
    }
    
    // Only include serial key if provided (not empty)
    if (serialKey) {
        configData.serialkey = serialKey
    }

    debug('Saving configuration:', {
        hostserver: configData.hostserver,
        corsproxy: configData.corsproxy,
        dsid: configData.id,
        hasSerialKey: !!configData.serialkey,
        autoStartup: configData.autoStartup,
        logLevel: configData.logLevel
    })

    $.ajax({
        type: 'post',
        url: '/api/config/save',
        contentType: 'application/json',
        data: JSON.stringify(configData),
        success: function (data) {
            if (data.success) {
                showAlert('success', 'Configuration saved successfully')
                
                // Clear serial key field after successful save for security
                if (serialKey) {
                    $('#serialKey').val('')
                    $('#serialKey').attr('placeholder', 'Serial key updated (enter new key to update again)')
                }
                
                // Optionally reload configuration to verify
                setTimeout(() => {
                    loadConfiguration()
                }, 1000)
            } else {
                showAlert('danger', data.message || 'Failed to save configuration')
            }
        },
        error: function (xhr, status, error) {
            console.error('Configuration save error:', error)
            showAlert('danger', `Failed to save configuration: ${error}`)
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
                
                // Load existing configuration fields
                $('#autoStartup').prop('checked', data.autoStartup || false)
                $('#fullscreenMode').prop('checked', data.fullscreenMode || false)
                $('#screenTimeout').val(data.screenTimeout || 0)
                $('#updateInterval').val(data.updateInterval || 30)
                $('#logLevel').val(data.logLevel || 'info')
                
                // Load enhanced configuration fields
                $('#clessHostname').val(data.hostserver || data.hostaddress || '')
                $('#corsOptions').val(data.corsproxy || 'N')
                $('#dsId').val(data.id || data.dsid || '')
                
                // Note: Serial key is not populated for security reasons
                // Users must enter it manually when updating
                $('#serialKey').val('')
                $('#serialKey').attr('placeholder', data.serialkey ? 'Current key is set (enter new key to update)' : 'Enter serial key')
                
                if (data.brightness) {
                    // Handle brightness if needed
                }
                showAlert('success', 'Configuration loaded successfully')
                debug('Configuration loaded:', {
                    hostserver: data.hostserver || data.hostaddress,
                    corsproxy: data.corsproxy,
                    dsid: data.id || data.dsid,
                    hasSerialKey: !!data.serialkey
                })
            }
        },
        error: function () {
            debug('No configuration found or error loading')
            // Load default values on error
            $('#clessHostname').val('https://cless4.closed-loop.biz/demo')
            $('#corsOptions').val('N')
            $('#dsId').val('10')
            $('#serialKey').val('')
            $('#serialKey').attr('placeholder', 'Enter serial key')
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

// Refresh layout function - calls /api/refresh-layout endpoint
// Includes loading state management and error handling
function refreshLayout() {
    const refreshLayoutBtn = $('#refreshLayout')
    
    // Add loading state
    refreshLayoutBtn.addClass('loading').prop('disabled', true)
    const originalText = refreshLayoutBtn.html()
    refreshLayoutBtn.html('<i class="bi bi-arrow-clockwise"></i> Refreshing...')
    
    $.ajax({
        type: 'get',
        url: '/api/refresh-layout',
        timeout: 10000, // 10 second timeout
        success: function (data) {
            showAlert('success', 'Layout refreshed successfully')
            debug('Layout refresh completed:', data)
            
            // Optionally refresh the layout display or other UI elements
            if (typeof getAPILayout === 'function') {
                setTimeout(() => {
                    getAPILayout()
                }, 500)
            }
        },
        error: function (xhr, status, error) {
            console.error('Layout refresh failed:', {xhr, status, error})
            
            let errorMessage = 'Failed to refresh layout'
            if (status === 'timeout') {
                errorMessage = 'Layout refresh timed out - please try again'
            } else if (xhr.responseText) {
                errorMessage = `Failed to refresh layout: ${xhr.responseText}`
            } else if (error) {
                errorMessage = `Failed to refresh layout: ${error}`
            }
            
            showAlert('danger', errorMessage)
        },
        complete: function() {
            // Restore button state
            refreshLayoutBtn.removeClass('loading').prop('disabled', false)
            refreshLayoutBtn.html(originalText)
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
    console.log('=== CONTROL PANEL: Requesting text slots ===')
    socket.emit('reqtextslot', 'get text slot')
}

function getmediaslot() {
    console.log('=== CONTROL PANEL: Requesting media slots ===')
    socket.emit('reqmediaslot', 'get media slot')
}

function getmediafiles() {
    console.log('=== CONTROL PANEL: Requesting media files ===')
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
        text: 'Open this to select text slot. [Layout Name - ID] Slot Name (Type) | Slot Text'
    }))
    
    msg.forEach(function(slot) {
        $('#replaceTextList').append($('<option>', {
            value: slot.name,
            text: `[${slot.layout} - ${slot.layoutid}] ${slot.name} (${slot.slottype}) | ${slot.text}`,
            class: slot.layoutid
        }))
    })
})

socket.on('cpanel-mediaslot', function (msg) {
    $('#replaceMediaList').empty()
    $('#replaceMediaList').append($('<option>', {
        value: '',
        text: 'Open this to select media slot. [Layout Name - ID] Slot Name | Slot Text'
    }))
    
    msg.forEach(function(slot) {
        $('#replaceMediaList').append($('<option>', {
            value: slot.name,
            text: `[${slot.layout} - ${slot.layoutid}] ${slot.name} | ${slot.text}`,
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
    console.log('=== CONTROL PANEL: Connected to server ===')
    debug('Connected to server')
    $('#connectionStatus').removeClass('status-offline').addClass('status-online')
})

socket.on('disconnect', function() {
    console.log('=== CONTROL PANEL: Disconnected from server ===')
    debug('Disconnected from server') 
    $('#connectionStatus').removeClass('status-online').addClass('status-offline')
})

// Volume control socket handler
socket.on('volume-level-response', function(data) {
    debug('Received volume level response:', data)
    if (data.volume !== undefined) {
        $('#volumeSlider').val(data.volume)
        $('#volumeDisplay').text(data.volume + '%')
    }
})

// Cleanup on page unload
$(window).on('beforeunload', function() {
    if (systemMonitoringInterval) {
        clearInterval(systemMonitoringInterval)
    }
})
