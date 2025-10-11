console.log('=== CONTROL PANEL: Starting initialization ===')
var socket = io()
var systemMonitoringInterval
var configData = {}

// Debug function for development-only logging  
const debug = localStorage.getItem('ecless-debug') === 'true' ? console.log.bind(console) : () => {}

console.log('=== CONTROL PANEL: Socket created, emitting save id ===')
socket.emit('save id', 'Controlpanel:')

// Socket connection event handlers for restart recovery
socket.on('connect', function() {
    console.log('=== CONTROL PANEL: Connected to socket server ===')
    
    // Update connection status indicator
    updateConnectionStatus(true)
    
    // Check if we're recovering from a restart
    const restartButtonState = localStorage.getItem('ecless-restart-button-state')
    if (restartButtonState === 'restarting') {
        console.log('=== CONTROL PANEL: Detected reconnection after restart ===')
        
        // Clear restart state
        localStorage.removeItem('ecless-restart-initiated')
        localStorage.removeItem('ecless-restart-button-state')
        
        // Restore button state and show success message
        setTimeout(() => {
            const restartBtn = $('#restartapp')
            if (restartBtn.length) {
                restartBtn.removeClass('loading').prop('disabled', false)
                restartBtn.html('<i class="bi bi-bootstrap-reboot"></i> Restart App')
                console.log('=== CONTROL PANEL: Restart button state restored after reconnection ===')
            }
            
            if (window.showToast) {
                showToast('Application restarted successfully! Connection restored.', 'success')
            }
        }, 1000)
    }
})

socket.on('disconnect', function() {
    console.log('=== CONTROL PANEL: Disconnected from socket server ===')
    
    // Update connection status indicator
    updateConnectionStatus(false)
    
    // If we're in the middle of a restart, show appropriate message
    const restartButtonState = localStorage.getItem('ecless-restart-button-state')
    if (restartButtonState === 'restarting') {
        console.log('=== CONTROL PANEL: Disconnect detected during restart - this is expected ===')
        if (window.showToast) {
            showToast('Connection lost - Application is restarting...', 'info')
        }
    } else {
        // Unexpected disconnection
        if (window.showToast) {
            showToast('Connection lost - Attempting to reconnect...', 'warning')
        }
    }
})

// Function to update connection status indicator
function updateConnectionStatus(connected) {
    // Find or create connection status indicator
    let statusIndicator = $('#connection-status')
    if (statusIndicator.length === 0) {
        // Create status indicator if it doesn't exist
        statusIndicator = $(`
            <div id="connection-status" style="
                position: fixed; top: 10px; left: 10px; z-index: 9999;
                padding: 5px 10px; border-radius: 4px; font-size: 12px;
                background: rgba(0,0,0,0.8); color: white;
                display: flex; align-items: center; gap: 5px;">
                <span class="status-dot" style="
                    width: 8px; height: 8px; border-radius: 50%;
                    background: #dc3545;"></span>
                <span class="status-text">Disconnected</span>
            </div>
        `)
        $('body').append(statusIndicator)
    }
    
    const statusDot = statusIndicator.find('.status-dot')
    const statusText = statusIndicator.find('.status-text')
    
    if (connected) {
        statusDot.css('background', '#28a745') // Green
        statusText.text('Connected')
        
        // Auto-hide after 3 seconds when connected
        setTimeout(() => {
            statusIndicator.fadeOut()
        }, 3000)
    } else {
        statusDot.css('background', '#dc3545') // Red
        statusText.text('Disconnected')
        statusIndicator.show()
    }
}

// Enhanced error handling for API calls
function handleAPIError(endpoint, error) {
    console.error(`API Error at ${endpoint}:`, error)
    
    // Show user-friendly error message
    if (window.showToast) {
        showToast(`Failed to load ${endpoint.replace('/api/', '')} data`, 'error')
    }
    
    // Log detailed error for debugging
    if (error.status === 0) {
        console.error('Network connection failed - server may be down')
    } else if (error.status === 404) {
        console.error('API endpoint not found:', endpoint)
    } else if (error.status >= 500) {
        console.error('Server error:', error.status, error.statusText)
    }
}

// Function to check for restart state and recover UI
function checkAndRecoverFromRestart() {
    const restartInitiated = localStorage.getItem('ecless-restart-initiated')
    const restartButtonState = localStorage.getItem('ecless-restart-button-state')
    
    if (restartInitiated && restartButtonState === 'restarting') {
        const restartTime = parseInt(restartInitiated)
        const currentTime = Date.now()
        const timeDiff = currentTime - restartTime
        
        // If restart was initiated within the last 2 minutes, assume successful restart
        if (timeDiff < 120000) { // 2 minutes
            console.log('=== RESTART RECOVERY: Detected successful restart ===')
            
            // Clear restart state
            localStorage.removeItem('ecless-restart-initiated')
            localStorage.removeItem('ecless-restart-button-state')
            
            // Show success message
            setTimeout(() => {
                if (window.showToast) {
                    showToast('Application restarted successfully!', 'success')
                } else {
                    // Fallback for early execution
                    setTimeout(() => {
                        if (window.showToast) {
                            showToast('Application restarted successfully!', 'success')
                        }
                    }, 2000)
                }
            }, 1000)
            
            // Ensure restart button is in normal state
            setTimeout(() => {
                const restartBtn = $('#restartapp')
                if (restartBtn.length) {
                    restartBtn.removeClass('loading').prop('disabled', false)
                    restartBtn.html('<i class="bi bi-bootstrap-reboot"></i> Restart App')
                    console.log('=== RESTART RECOVERY: Button state restored ===')
                }
            }, 500)
        } else {
            // Too much time has passed, assume restart failed
            console.warn('=== RESTART RECOVERY: Restart timeout detected, clearing state ===')
            localStorage.removeItem('ecless-restart-initiated')
            localStorage.removeItem('ecless-restart-button-state')
        }
    }
}

$(document).ready(function () {
    $('#remote-display').attr('src', window.location.origin + '/remote?hostname=' + window.location.hostname)
    
    // Check for restart recovery first
    checkAndRecoverFromRestart()
    
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
    
    // Set up real-time layout details monitoring
    setupLayoutDetailsMonitoring()
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

// Real-time layout details monitoring system
var layoutDetailsInterval = null
var lastLayoutTimestamp = null
var layoutUpdateInProgress = false

function setupLayoutDetailsMonitoring() {
    debug('Setting up real-time layout details monitoring')
    
    // Initial load
    refreshLayoutDetails()
    
    // Set up periodic refresh (every 15 seconds)
    layoutDetailsInterval = setInterval(refreshLayoutDetails, 15000)
    
    // Listen for layout change events from socket if available
    if (typeof socket !== 'undefined' && socket) {
        socket.on('layout-changed', function(data) {
            debug('Layout change detected via socket:', data)
            setTimeout(refreshLayoutDetails, 500) // Small delay to allow data to settle
        })
        
        socket.on('updatelayout', function(data) {
            debug('Layout update detected via socket:', data)
            setTimeout(refreshLayoutDetails, 1000)
        })
        
        socket.on('replacetextslot', function(data) {
            debug('Text slot update detected via socket:', data)
            setTimeout(refreshLayoutDetails, 500)
        })
        
        socket.on('replacemediaslot', function(data) {
            debug('Media slot update detected via socket:', data)
            setTimeout(refreshLayoutDetails, 500)
        })
    }
}

function refreshLayoutDetails() {
    if (layoutUpdateInProgress) {
        debug('Layout update already in progress, skipping')
        return
    }
    
    layoutUpdateInProgress = true
    debug('Refreshing layout details...')
    
    $.get(window.location.origin + '/api/layout-details')
        .done(function (response) {
            try {
                if (response.success && response.data) {
                    // Validate response data structure
                    if (!validateLayoutResponseData(response.data)) {
                        console.error('Invalid layout response data structure:', response.data)
                        displayLayoutInfoError('Invalid layout data structure received')
                        return
                    }

                    // Check if data has actually changed
                    if (hasLayoutDataChanged(response.data)) {
                        debug('Layout data changed, updating display')
                        displayDetailedLayoutInfo(response.data)
                        lastLayoutTimestamp = response.data.timestamp
                        
                        // Show update indicator
                        showLayoutUpdateIndicator()
                    } else {
                        debug('Layout data unchanged, skipping update')
                    }
                } else {
                    console.warn('Layout details refresh failed:', response.error)
                    displayLayoutInfoError(response.error || 'Unknown error occurred')
                }
            } catch (processingError) {
                console.error('Error processing layout response:', processingError)
                displayLayoutInfoError('Error processing layout data: ' + processingError.message)
            }
        })
        .fail(function (xhr, status, error) {
            console.warn('Failed to refresh layout details:', {
                status: status,
                error: error,
                responseText: xhr.responseText
            })
            
            // Provide specific error messages based on status
            var errorMessage = 'Failed to refresh layout details'
            if (xhr.status === 503) {
                errorMessage = 'eCLESS renderer process not connected'
            } else if (xhr.status === 504) {
                errorMessage = 'Timeout waiting for layout details'
            } else if (xhr.status === 0) {
                errorMessage = 'Network connection error'
            } else if (xhr.status >= 500) {
                errorMessage = 'Server error occurred'
            } else if (xhr.status >= 400) {
                errorMessage = 'Client request error'
            }
            
            displayLayoutInfoError(errorMessage)
        })
        .always(function() {
            layoutUpdateInProgress = false
        })
}

// Function to validate layout response data structure
function validateLayoutResponseData(data) {
    try {
        // Check required properties
        if (typeof data !== 'object' || data === null) {
            console.error('Layout data validation failed: not an object')
            return false
        }

        // Check for required properties
        const requiredProps = ['layouts', 'isLoop', 'timestamp']
        for (const prop of requiredProps) {
            if (!(prop in data)) {
                console.error('Layout data validation failed: missing property', prop)
                return false
            }
        }

        // Validate layouts array
        if (!Array.isArray(data.layouts)) {
            console.error('Layout data validation failed: layouts is not an array')
            return false
        }

        // Validate individual layouts
        for (let i = 0; i < data.layouts.length; i++) {
            const layout = data.layouts[i]
            if (typeof layout !== 'object' || layout === null) {
                console.error('Layout data validation failed: layout', i, 'is not an object')
                return false
            }

            if (!layout.id || typeof layout.id !== 'string') {
                console.error('Layout data validation failed: layout', i, 'missing or invalid id')
                return false
            }

            if (!layout.name || typeof layout.name !== 'string') {
                console.error('Layout data validation failed: layout', i, 'missing or invalid name')
                return false
            }
        }

        return true

    } catch (error) {
        console.error('Error during layout data validation:', error)
        return false
    }
}

function hasLayoutDataChanged(newData) {
    if (!lastLayoutTimestamp || !newData.timestamp) {
        return true // First load or no timestamp available
    }
    
    return newData.timestamp !== lastLayoutTimestamp
}

function showLayoutUpdateIndicator() {
    const indicator = $(`
        <div class="layout-update-indicator" style="
            position: fixed;
            top: 80px;
            right: 20px;
            background: var(--success-color);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            font-weight: 500;
            box-shadow: var(--shadow-md);
            z-index: 1000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        ">
            <i class="bi bi-arrow-clockwise"></i>
            Layout Updated
        </div>
    `)
    
    $('body').append(indicator)
    
    setTimeout(() => {
        indicator.css({ opacity: 1, transform: 'translateX(0)' })
    }, 100)
    
    setTimeout(() => {
        indicator.css({ opacity: 0, transform: 'translateX(100%)' })
        setTimeout(() => indicator.remove(), 300)
    }, 2000)
}

// Cleanup function for layout monitoring
function stopLayoutDetailsMonitoring() {
    if (layoutDetailsInterval) {
        clearInterval(layoutDetailsInterval)
        layoutDetailsInterval = null
        debug('Layout details monitoring stopped')
    }
}

// Restart monitoring with different interval
function setLayoutMonitoringInterval(seconds) {
    stopLayoutDetailsMonitoring()
    if (seconds > 0) {
        layoutDetailsInterval = setInterval(refreshLayoutDetails, seconds * 1000)
        debug('Layout monitoring restarted with', seconds, 'second interval')
    }
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
            if (data && data.message && data.message.includes('No configuration file found')) {
                // No config file exists - load defaults
                debug('No configuration file found, loading defaults')
                $('#clessHostname').val('https://cless4.closed-loop.biz/demo')
                $('#corsOptions').val('N')
                $('#dsId').val('10')
                $('#serialKey').val('')
                $('#serialKey').attr('placeholder', 'Enter serial key')
                $('#autoStartup').prop('checked', false)
                $('#fullscreenMode').prop('checked', false)
                $('#screenTimeout').val(0)
                $('#updateInterval').val(30)
                $('#logLevel').val('info')
                showToast('No configuration file found - Default values loaded', 'info')
            } else if (data && Object.keys(data).length > 0 && !data.message) {
                // Valid configuration data found
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
                showToast('Configuration loaded successfully', 'success')
                debug('Configuration loaded:', {
                    hostserver: data.hostserver || data.hostaddress,
                    corsproxy: data.corsproxy,
                    dsid: data.id || data.dsid,
                    hasSerialKey: !!data.serialkey
                })
            } else {
                // Empty or invalid response - load defaults
                debug('Empty or invalid configuration response, loading defaults')
                $('#clessHostname').val('https://cless4.closed-loop.biz/demo')
                $('#corsOptions').val('N')
                $('#dsId').val('10')
                $('#serialKey').val('')
                $('#serialKey').attr('placeholder', 'Enter serial key')
                $('#autoStartup').prop('checked', false)
                $('#fullscreenMode').prop('checked', false)
                $('#screenTimeout').val(0)
                $('#updateInterval').val(30)
                $('#logLevel').val('info')
                showToast('Invalid configuration data - Default values loaded', 'warning')
            }
        },
        error: function (xhr, status, error) {
            debug('No configuration found or error loading:', error)
            // Load default values on error
            $('#clessHostname').val('https://cless4.closed-loop.biz/demo')
            $('#corsOptions').val('N')
            $('#dsId').val('10')
            $('#serialKey').val('')
            $('#serialKey').attr('placeholder', 'Enter serial key')
            
            // Show appropriate error message
            if (xhr.status === 404 || xhr.responseJSON?.message?.includes('No configuration file found')) {
                showToast('No configuration file found - Default values loaded', 'info')
            } else {
                showToast('Failed to load configuration - Default values loaded', 'warning')
            }
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
    const refreshBtn = $('#refresh')
    
    // Add loading state
    refreshBtn.addClass('loading').prop('disabled', true)
    const originalText = refreshBtn.html()
    refreshBtn.html('<i class="bi bi-arrow-clockwise"></i> Refreshing...')
    
    $.ajax({
        type: 'get',
        url: '/api/refresh',
        timeout: 15000, // 15 second timeout for refresh operations
        success: function (data) {
            showAlert('success', 'Display refreshed successfully')
            debug('Display refresh completed:', data)
            
            // Add a delay to show completion before re-enabling button
            setTimeout(() => {
                // Restore button state after delay
                refreshBtn.removeClass('loading').prop('disabled', false)
                refreshBtn.html(originalText)
            }, 2000) // 2 second delay as requested
        },
        error: function (xhr, status, error) {
            console.error('Display refresh failed:', {xhr, status, error})
            
            let errorMessage = 'Failed to refresh display'
            if (status === 'timeout') {
                errorMessage = 'Display refresh timed out - please try again'
            } else if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = `Failed to refresh display: ${xhr.responseJSON.message}`
            } else if (xhr.responseText) {
                errorMessage = `Failed to refresh display: ${xhr.responseText}`
            } else if (error) {
                errorMessage = `Failed to refresh display: ${error}`
            }
            
            showAlert('danger', errorMessage)
            
            // Restore button state immediately on error
            refreshBtn.removeClass('loading').prop('disabled', false)
            refreshBtn.html(originalText)
        }
    })
}

function restartapp() {
    const restartBtn = $('#restartapp')
    
    // Add confirmation dialog
    if (!confirm('Are you sure you want to restart the application? This will close the current session.')) {
        return
    }
    
    // Store restart state in localStorage for post-restart recovery
    localStorage.setItem('ecless-restart-initiated', Date.now().toString())
    localStorage.setItem('ecless-restart-button-state', 'restarting')
    
    // Add loading state
    restartBtn.addClass('loading').prop('disabled', true)
    const originalText = restartBtn.html()
    restartBtn.html('<i class="bi bi-bootstrap-reboot"></i> Restarting...')
    
    // Show immediate feedback
    showAlert('info', 'Restart initiated - Application will restart in 3 seconds...')
    
    $.ajax({
        type: 'get',
        url: '/api/restartapp',
        timeout: 15000, // 15 second timeout
        success: function (data) {
            debug('Application restart request sent:', data)
            
            // Show countdown feedback
            let countdown = 3
            const countdownInterval = setInterval(() => {
                if (countdown > 0) {
                    restartBtn.html(`<i class="bi bi-bootstrap-reboot"></i> Restarting in ${countdown}s...`)
                    showAlert('info', `Application restarting in ${countdown} seconds...`)
                    countdown--
                } else {
                    clearInterval(countdownInterval)
                    restartBtn.html('<i class="bi bi-bootstrap-reboot"></i> Restarting now...')
                    showAlert('warning', 'Application is restarting now. Please wait for reconnection...')
                }
            }, 1000)
        },
        error: function (xhr, status, error) {
            console.error('Application restart failed:', {xhr, status, error})
            
            // Clear restart state on error
            localStorage.removeItem('ecless-restart-initiated')
            localStorage.removeItem('ecless-restart-button-state')
            
            let errorMessage = 'Failed to restart application'
            if (status === 'timeout') {
                errorMessage = 'Application restart timed out - please try again'
            } else if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = `Failed to restart application: ${xhr.responseJSON.message}`
            } else if (xhr.responseText) {
                errorMessage = `Failed to restart application: ${xhr.responseText}`
            } else if (error) {
                errorMessage = `Failed to restart application: ${error}`
            }
            
            showAlert('danger', errorMessage)
            
            // Restore button state on error
            restartBtn.removeClass('loading').prop('disabled', false)
            restartBtn.html(originalText)
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
            debug('Basic layout data loaded:', data)
            
            // Now get detailed layout information
            getDetailedLayoutInfo()
        })
        .fail(function(xhr, status, error) {
            console.warn('Layout API failed, using fallback:', error)
            $element.removeClass('loading')
            const mockData = handleAPIError('/api/layoutdata', error)
            
            // Try to get detailed info anyway
            getDetailedLayoutInfo()
        })
}

// Enhanced function to get detailed layout information
function getDetailedLayoutInfo() {
    // Trigger immediate refresh
    refreshLayoutDetails()
}

// Function to display comprehensive layout information with enhanced loop support
function displayDetailedLayoutInfo(layoutData) {
    const $element = $('#apiLayout')
    
    debug('Displaying enhanced layout information:', layoutData)
    
    // Build the comprehensive layout information display
    let html = `
        <div class="layout-info-container">
            <div class="layout-status-header">
                <div class="status-indicator ${layoutData.currentLayout ? 'status-online' : 'status-offline'}">
                    <div class="status-dot"></div>
                    <span>Layout System ${layoutData.currentLayout ? 'Active' : 'Inactive'}</span>
                </div>
                <div class="layout-mode-badge ${layoutData.isLoop ? 'loop-mode' : 'single-mode'}">
                    <i class="bi ${layoutData.isLoop ? 'bi-arrow-repeat' : 'bi-file-earmark'}"></i>
                    ${layoutData.isLoop ? 'Loop Mode' : 'Single Mode'}
                    ${layoutData.layoutCount ? ` (${layoutData.layoutCount} layouts)` : ''}
                </div>
            </div>
    `
    
    // Current Layout Information (if available)
    if (layoutData.currentLayout) {
        html += `
            <div class="current-layout-info">
                <h4 class="layout-section-title">
                    <i class="bi bi-play-circle"></i>
                    Currently Active Layout
                </h4>
                <div class="current-layout-details">
                    <div class="layout-basic-info">
                        <strong>ID:</strong> ${layoutData.currentLayout.id} | 
                        <strong>Name:</strong> ${layoutData.currentLayout.name}
                        ${layoutData.currentLayout.duration ? ` | <strong>Duration:</strong> ${layoutData.currentLayout.duration}s` : ''}
                    </div>
                    ${layoutData.currentLayout.slotSummary ? createSlotSummaryDisplay(layoutData.currentLayout.slotSummary) : ''}
                </div>
            </div>
        `
    }
    
    // Layout Details Section
    if (layoutData.isLoop && layoutData.layouts && layoutData.layouts.length > 0) {
        html += createLoopLayoutsDisplay(layoutData.layouts)
    } else if (!layoutData.isLoop && layoutData.layouts && layoutData.layouts.length > 0) {
        html += createSingleLayoutDisplay(layoutData.layouts[0])
    }
    
    // Summary Statistics
    html += createSummaryStatistics(layoutData)
    
    html += `</div>`
    
    $element.html(html)
    debug('Enhanced detailed layout information displayed successfully')
}

// Function to create display for loop layouts with collapsible sections
function createLoopLayoutsDisplay(layouts) {
    let html = `
        <div class="loop-layouts-container">
            <h4 class="layout-section-title">
                <i class="bi bi-collection"></i>
                Loop Layouts (${layouts.length})
                <button class="btn btn-sm btn-outline-secondary ml-2 toggle-all-layouts" onclick="toggleAllLayoutDetails()">
                    <i class="bi bi-arrows-expand"></i> Expand All
                </button>
            </h4>
    `
    
    layouts.forEach((layout, index) => {
        const isExpanded = index === 0 // Expand first layout by default
        html += `
            <div class="layout-item-container">
                <div class="layout-item-header" onclick="toggleLayoutDetails('${layout.id}')">
                    <div class="layout-header-info">
                        <span class="layout-number">${index + 1}</span>
                        <span class="layout-name">${layout.name}</span>
                        <span class="layout-id">(ID: ${layout.id})</span>
                        ${layout.duration ? `<span class="layout-duration">${layout.duration}s</span>` : ''}
                        <span class="layout-slot-count">${layout.totalSlots || 0} slots</span>
                    </div>
                    <div class="layout-toggle-icon">
                        <i class="bi bi-chevron-${isExpanded ? 'up' : 'down'}"></i>
                    </div>
                </div>
                <div class="layout-item-details ${isExpanded ? 'expanded' : 'collapsed'}" id="layout-details-${layout.id}">
                    ${createLayoutDetailsContent(layout)}
                </div>
            </div>
        `
    })
    
    html += `</div>`
    return html
}

// Function to create display for single layout
function createSingleLayoutDisplay(layout) {
    return `
        <div class="single-layout-container">
            <h4 class="layout-section-title">
                <i class="bi bi-file-earmark"></i>
                Layout Details
            </h4>
            <div class="layout-item-details expanded">
                ${createLayoutDetailsContent(layout)}
            </div>
        </div>
    `
}

// Function to create detailed content for a single layout
function createLayoutDetailsContent(layout) {
    let html = `
        <div class="layout-details-content">
            <div class="layout-properties">
                <div class="property-group">
                    <h5>Layout Properties</h5>
                    <div class="property-item">
                        <span class="property-label">Dimensions:</span>
                        <span class="property-value">${layout.width || '1920'} × ${layout.height || '1080'}</span>
                    </div>
                    <div class="property-item">
                        <span class="property-label">Background:</span>
                        <span class="property-value">
                            ${layout.backgroundColor || '#000000'}
                            <div class="color-preview" style="background-color: ${layout.backgroundColor || '#000000'}"></div>
                        </span>
                    </div>
                    ${layout.duration ? `
                    <div class="property-item">
                        <span class="property-label">Duration:</span>
                        <span class="property-value">${layout.duration} seconds</span>
                    </div>
                    ` : ''}
                </div>
            </div>
    `

    // Slot Summary
    if (layout.slotSummary) {
        html += createSlotSummaryDisplay(layout.slotSummary, true)
    }

    // Detailed Slot Information
    if (layout.slots && layout.slots.length > 0) {
        html += createDetailedSlotsDisplay(layout.slots)
    }

    html += `</div>`
    return html
}

// Function to create slot summary display
function createSlotSummaryDisplay(slotSummary, detailed = false) {
    let html = `
        <div class="slot-summary ${detailed ? 'detailed' : 'compact'}">
            <h5>Slot Summary</h5>
            <div class="slot-summary-grid">
                <div class="slot-summary-item">
                    <span class="slot-count">${slotSummary.total || 0}</span>
                    <span class="slot-type">Total</span>
                </div>
                <div class="slot-summary-item">
                    <span class="slot-count">${slotSummary.text || 0}</span>
                    <span class="slot-type">Text</span>
                </div>
                <div class="slot-summary-item">
                    <span class="slot-count">${slotSummary.media || 0}</span>
                    <span class="slot-type">Media</span>
                </div>
    `

    if (detailed) {
        const specialTypes = ['ticker', 'scroller', 'fader', 'date', 'time', 'html', 'table']
        specialTypes.forEach(type => {
            if (slotSummary[type] && slotSummary[type] > 0) {
                html += `
                    <div class="slot-summary-item">
                        <span class="slot-count">${slotSummary[type]}</span>
                        <span class="slot-type">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    </div>
                `
            }
        })
    }

    html += `
            </div>
        </div>
    `
    return html
}

// Function to create detailed slots display
function createDetailedSlotsDisplay(slots) {
    let html = `
        <div class="detailed-slots-container">
            <h5>Slot Details</h5>
            <div class="slots-grid">
    `

    slots.forEach(slot => {
        const slotTypeClass = `slot-type-${slot.type}`
        html += `
            <div class="slot-item ${slotTypeClass}">
                <div class="slot-header">
                    <span class="slot-name">${slot.name}</span>
                    <span class="slot-type-badge">${slot.type}</span>
                </div>
                <div class="slot-details">
                    <div class="slot-detail-item">
                        <span class="detail-label">ID:</span>
                        <span class="detail-value">${slot.id}</span>
                    </div>
                    ${slot.content ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Content:</span>
                        <span class="detail-value slot-content">${slot.content}</span>
                    </div>
                    ` : ''}
                    ${slot.contentType && slot.contentType !== slot.type ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Content Type:</span>
                        <span class="detail-value">${slot.contentType}</span>
                    </div>
                    ` : ''}
                    ${slot.position && (slot.position.width || slot.position.height) ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Size:</span>
                        <span class="detail-value">${slot.position.width || '?'} × ${slot.position.height || '?'}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `
    })

    html += `
            </div>
        </div>
    `
    return html
}

// Function to create summary statistics
function createSummaryStatistics(layoutData) {
    return `
        <div class="layout-summary">
            <h4 class="layout-section-title">
                <i class="bi bi-bar-chart"></i>
                Summary Statistics
            </h4>
            <div class="summary-stats">
                <div class="summary-stat">
                    <div class="stat-value">${layoutData.layouts ? layoutData.layouts.length : (layoutData.currentLayout ? 1 : 0)}</div>
                    <div class="stat-label">Total Layouts</div>
                </div>
                <div class="summary-stat">
                    <div class="stat-value">${layoutData.totalSlots || 0}</div>
                    <div class="stat-label">Total Slots</div>
                </div>
                <div class="summary-stat">
                    <div class="stat-value">${layoutData.textSlots || 0}</div>
                    <div class="stat-label">Text Slots</div>
                </div>
                <div class="summary-stat">
                    <div class="stat-value">${layoutData.mediaSlots || 0}</div>
                    <div class="stat-label">Media Slots</div>
                </div>
                ${layoutData.isLoop ? `
                <div class="summary-stat">
                    <div class="stat-value">${layoutData.layoutCount || 0}</div>
                    <div class="stat-label">Loop Count</div>
                </div>
                ` : ''}
            </div>
        </div>
    `
}

// JavaScript functions for interactive elements
function toggleLayoutDetails(layoutId) {
    const detailsElement = document.getElementById(`layout-details-${layoutId}`)
    const toggleIcon = detailsElement.parentElement.querySelector('.layout-toggle-icon i')
    
    if (detailsElement.classList.contains('expanded')) {
        detailsElement.classList.remove('expanded')
        detailsElement.classList.add('collapsed')
        toggleIcon.className = 'bi bi-chevron-down'
    } else {
        detailsElement.classList.remove('collapsed')
        detailsElement.classList.add('expanded')
        toggleIcon.className = 'bi bi-chevron-up'
    }
}

function toggleAllLayoutDetails() {
    const allDetails = document.querySelectorAll('.layout-item-details')
    const toggleButton = document.querySelector('.toggle-all-layouts')
    const toggleIcon = toggleButton.querySelector('i')
    const toggleText = toggleButton.childNodes[1]
    
    const hasCollapsed = Array.from(allDetails).some(detail => detail.classList.contains('collapsed'))
    
    allDetails.forEach(detail => {
        const toggleIcon = detail.parentElement.querySelector('.layout-toggle-icon i')
        if (hasCollapsed) {
            detail.classList.remove('collapsed')
            detail.classList.add('expanded')
            toggleIcon.className = 'bi bi-chevron-up'
        } else {
            detail.classList.remove('expanded')
            detail.classList.add('collapsed')
            toggleIcon.className = 'bi bi-chevron-down'
        }
    })
    
    if (hasCollapsed) {
        toggleIcon.className = 'bi bi-arrows-collapse'
        toggleText.textContent = ' Collapse All'
    } else {
        toggleIcon.className = 'bi bi-arrows-expand'
        toggleText.textContent = ' Expand All'
    }
}

// Enhanced function to display layout information errors with detailed diagnostics
function displayLayoutInfoError(errorMessage, errorDetails = null) {
    const $element = $('#apiLayout')
    
    // Determine error type and appropriate icon/color
    let errorType = 'general'
    let errorIcon = 'exclamation-triangle'
    let errorClass = 'alert-danger'
    
    if (errorMessage.includes('not connected') || errorMessage.includes('connection')) {
        errorType = 'connection'
        errorIcon = 'wifi-off'
        errorClass = 'alert-warning'
    } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        errorType = 'timeout'
        errorIcon = 'clock'
        errorClass = 'alert-warning'
    } else if (errorMessage.includes('Invalid') || errorMessage.includes('validation')) {
        errorType = 'validation'
        errorIcon = 'shield-exclamation'
        errorClass = 'alert-danger'
    } else if (errorMessage.includes('Server error') || errorMessage.includes('500')) {
        errorType = 'server'
        errorIcon = 'server'
        errorClass = 'alert-danger'
    }
    
    let html = `
        <div class="layout-info-container">
            <div class="alert-modern ${errorClass}">
                <i class="bi bi-${errorIcon}"></i>
                <div class="error-content">
                    <strong>Layout Information Error (${errorType}):</strong><br>
                    ${errorMessage}
                </div>
            </div>
    `

    // Add detailed error information if available
    if (errorDetails) {
        html += `
            <div class="error-details-container">
                <details class="error-details">
                    <summary>Technical Details</summary>
                    <div class="error-details-content">
                        <pre>${JSON.stringify(errorDetails, null, 2)}</pre>
                    </div>
                </details>
            </div>
        `
    }

    // Add appropriate action buttons based on error type
    html += `
            <div class="layout-error-actions">
                <button type="button" class="modern-btn btn-secondary" onclick="getDetailedLayoutInfo()">
                    <i class="bi bi-arrow-clockwise"></i>
                    Retry
                </button>
    `

    if (errorType === 'connection') {
        html += `
                <button type="button" class="modern-btn btn-outline-primary" onclick="checkConnectionStatus()">
                    <i class="bi bi-wifi"></i>
                    Check Connection
                </button>
        `
    }

    if (errorType === 'validation' || errorType === 'server') {
        html += `
                <button type="button" class="modern-btn btn-outline-warning" onclick="clearLayoutCache()">
                    <i class="bi bi-trash"></i>
                    Clear Cache
                </button>
        `
    }

    html += `
                <button type="button" class="modern-btn btn-outline-info" onclick="showLayoutDiagnostics()">
                    <i class="bi bi-info-circle"></i>
                    Diagnostics
                </button>
            </div>
        </div>
    `
    
    $element.html(html)
    
    // Log error for debugging
    console.error('Layout Error Display:', {
        type: errorType,
        message: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString()
    })
}

// Function to check connection status
function checkConnectionStatus() {
    if (window.showToast) {
        window.showToast('Checking connection status...', 'info')
    }
    
    $.get(window.location.origin + '/api/deviceinfo')
        .done(function() {
            if (window.showToast) {
                window.showToast('Connection is working correctly', 'success')
            }
            // Try to refresh layout details again
            setTimeout(getDetailedLayoutInfo, 1000)
        })
        .fail(function() {
            if (window.showToast) {
                window.showToast('Connection test failed - please check network', 'error')
            }
        })
}

// Function to clear layout cache (localStorage cleanup)
function clearLayoutCache() {
    try {
        // Clear layout-related localStorage items
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && (key.startsWith('layout-') || key.match(/^\d+$/))) {
                keysToRemove.push(key)
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key))
        
        if (window.showToast) {
            window.showToast(`Cleared ${keysToRemove.length} cached layout items`, 'success')
        }
        
        // Try to refresh layout details after clearing cache
        setTimeout(getDetailedLayoutInfo, 1000)
        
    } catch (error) {
        console.error('Error clearing layout cache:', error)
        if (window.showToast) {
            window.showToast('Failed to clear cache: ' + error.message, 'error')
        }
    }
}

// Function to show layout diagnostics
function showLayoutDiagnostics() {
    try {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            dsid: typeof dsid !== 'undefined' ? dsid : 'undefined',
            localStorage: {
                available: typeof localStorage !== 'undefined',
                itemCount: localStorage ? localStorage.length : 0,
                layoutItems: []
            },
            socket: {
                connected: typeof socket !== 'undefined' && socket ? socket.connected : false,
                available: typeof socket !== 'undefined'
            },
            layout: {
                monitoringActive: layoutDetailsInterval !== null,
                updateInProgress: layoutUpdateInProgress,
                lastTimestamp: lastLayoutTimestamp
            }
        }

        // Get layout items from localStorage
        if (localStorage) {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && (key.startsWith('layout-') || key.match(/^\d+$/))) {
                    try {
                        const size = localStorage.getItem(key).length
                        diagnostics.localStorage.layoutItems.push({
                            key: key,
                            size: size,
                            hasData: size > 0
                        })
                    } catch (e) {
                        diagnostics.localStorage.layoutItems.push({
                            key: key,
                            error: e.message
                        })
                    }
                }
            }
        }

        // Display diagnostics in a modal or detailed view
        const diagnosticsWindow = window.open('', 'Layout Diagnostics', 'width=800,height=600,scrollbars=yes')
        diagnosticsWindow.document.write(`
            <html>
                <head>
                    <title>Layout Diagnostics</title>
                    <style>
                        body { font-family: monospace; margin: 20px; }
                        pre { background: #f5f5f5; padding: 15px; border-radius: 5px; }
                        .section { margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 15px; }
                    </style>
                </head>
                <body>
                    <h1>eCLESS Layout System Diagnostics</h1>
                    <div class="section">
                        <h2>System Information</h2>
                        <pre>${JSON.stringify(diagnostics, null, 2)}</pre>
                    </div>
                    <div class="section">
                        <h2>Actions</h2>
                        <button onclick="window.close()">Close</button>
                    </div>
                </body>
            </html>
        `)
        diagnosticsWindow.document.close()

    } catch (error) {
        console.error('Error generating diagnostics:', error)
        if (window.showToast) {
            window.showToast('Failed to generate diagnostics: ' + error.message, 'error')
        }
    }
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

// DUPLICATE FUNCTION REMOVED - loadConfiguration() 
// The comprehensive loadConfiguration() function is already defined above at line 1109
// This duplicate was overriding the comprehensive version and causing the Load Configuration bug
// The comprehensive version properly loads all fields including CLESS hostname, DS ID, serial key, etc.

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
    // Cleanup layout monitoring
    stopLayoutDetailsMonitoring()
})

// ================================================
// TESTING AND VALIDATION FUNCTIONS
// ================================================

// Comprehensive test function for the enhanced layout system
function testEnhancedLayoutSystem() {
    console.log('=== TESTING: Starting comprehensive layout system tests ===')
    
    const testResults = {
        timestamp: new Date().toISOString(),
        tests: [],
        summary: {
            passed: 0,
            failed: 0,
            total: 0
        }
    }

    // Test 1: API Endpoint Availability
    addTest(testResults, 'API Endpoint Availability', function() {
        return new Promise((resolve) => {
            $.get(window.location.origin + '/api/layout-details')
                .done(function(response) {
                    if (response && typeof response === 'object') {
                        resolve({ success: true, message: 'API endpoint responding correctly' })
                    } else {
                        resolve({ success: false, message: 'Invalid response format' })
                    }
                })
                .fail(function(xhr) {
                    resolve({ success: false, message: `API request failed: ${xhr.status} ${xhr.statusText}` })
                })
        })
    })

    // Test 2: Layout Data Structure Validation
    addTest(testResults, 'Layout Data Structure Validation', function() {
        return new Promise((resolve) => {
            $.get(window.location.origin + '/api/layout-details')
                .done(function(response) {
                    if (response.success && validateLayoutResponseData(response.data)) {
                        resolve({ success: true, message: 'Layout data structure is valid' })
                    } else {
                        resolve({ success: false, message: 'Invalid layout data structure' })
                    }
                })
                .fail(function() {
                    resolve({ success: false, message: 'Could not retrieve data for validation' })
                })
        })
    })

    // Test 3: UI Component Rendering
    addTest(testResults, 'UI Component Rendering', function() {
        return new Promise((resolve) => {
            const testData = createMockLayoutData()
            try {
                displayDetailedLayoutInfo(testData)
                const layoutContainer = document.querySelector('.layout-info-container')
                if (layoutContainer) {
                    resolve({ success: true, message: 'UI components rendered successfully' })
                } else {
                    resolve({ success: false, message: 'Layout container not found in DOM' })
                }
            } catch (error) {
                resolve({ success: false, message: `UI rendering error: ${error.message}` })
            }
        })
    })

    // Test 4: Loop Layout Detection
    addTest(testResults, 'Loop Layout Detection', function() {
        return new Promise((resolve) => {
            const singleLayoutData = createMockLayoutData(false)
            const loopLayoutData = createMockLayoutData(true)
            
            try {
                displayDetailedLayoutInfo(singleLayoutData)
                const singleModeBadge = document.querySelector('.single-mode')
                
                displayDetailedLayoutInfo(loopLayoutData)
                const loopModeBadge = document.querySelector('.loop-mode')
                
                if (singleModeBadge && loopModeBadge) {
                    resolve({ success: true, message: 'Loop and single layout modes detected correctly' })
                } else {
                    resolve({ success: false, message: 'Layout mode detection failed' })
                }
            } catch (error) {
                resolve({ success: false, message: `Layout detection error: ${error.message}` })
            }
        })
    })

    // Test 5: Collapsible UI Functionality
    addTest(testResults, 'Collapsible UI Functionality', function() {
        return new Promise((resolve) => {
            const loopLayoutData = createMockLayoutData(true)
            
            try {
                displayDetailedLayoutInfo(loopLayoutData)
                
                // Check if collapsible elements exist
                const layoutDetails = document.querySelectorAll('.layout-item-details')
                const toggleButtons = document.querySelectorAll('.layout-item-header')
                
                if (layoutDetails.length > 0 && toggleButtons.length > 0) {
                    resolve({ success: true, message: 'Collapsible UI elements created successfully' })
                } else {
                    resolve({ success: false, message: 'Collapsible UI elements not found' })
                }
            } catch (error) {
                resolve({ success: false, message: `Collapsible UI error: ${error.message}` })
            }
        })
    })

    // Test 6: Error Handling
    addTest(testResults, 'Error Handling', function() {
        return new Promise((resolve) => {
            try {
                displayLayoutInfoError('Test error message', { testData: true })
                const errorContainer = document.querySelector('.alert-modern')
                if (errorContainer) {
                    resolve({ success: true, message: 'Error handling and display working correctly' })
                } else {
                    resolve({ success: false, message: 'Error display not rendered' })
                }
            } catch (error) {
                resolve({ success: false, message: `Error handling test failed: ${error.message}` })
            }
        })
    })

    // Execute all tests
    executeTests(testResults)
        .then(function(finalResults) {
            displayTestResults(finalResults)
        })
        .catch(function(error) {
            console.error('Test execution failed:', error)
        })
}

// Helper function to add a test to the test suite
function addTest(testResults, name, testFunction) {
    testResults.tests.push({
        name: name,
        function: testFunction,
        result: null,
        duration: 0
    })
    testResults.summary.total++
}

// Execute all tests sequentially
async function executeTests(testResults) {
    for (let i = 0; i < testResults.tests.length; i++) {
        const test = testResults.tests[i]
        const startTime = Date.now()
        
        console.log(`Running test ${i + 1}/${testResults.tests.length}: ${test.name}`)
        
        try {
            test.result = await test.function()
            test.duration = Date.now() - startTime
            
            if (test.result.success) {
                testResults.summary.passed++
                console.log(`✓ ${test.name}: ${test.result.message}`)
            } else {
                testResults.summary.failed++
                console.log(`✗ ${test.name}: ${test.result.message}`)
            }
        } catch (error) {
            test.result = { success: false, message: error.message }
            test.duration = Date.now() - startTime
            testResults.summary.failed++
            console.log(`✗ ${test.name}: ${error.message}`)
        }
    }
    
    return testResults
}

// Create mock layout data for testing
function createMockLayoutData(isLoop = false) {
    if (isLoop) {
        return {
            layouts: [
                {
                    id: 'test-layout-1',
                    name: 'Test Layout 1',
                    type: 'loop',
                    hasData: true,
                    duration: 10,
                    slots: [
                        { id: 'slot-1', name: 'test-text-slot', type: 'text', content: 'Test text content' },
                        { id: 'slot-2', name: 'test-media-slot', type: 'media', content: 'test-video.mp4' }
                    ],
                    slotSummary: { total: 2, text: 1, media: 1 },
                    totalSlots: 2
                },
                {
                    id: 'test-layout-2',
                    name: 'Test Layout 2',
                    type: 'loop',
                    hasData: true,
                    duration: 15,
                    slots: [
                        { id: 'slot-3', name: 'test-text-slot-2', type: 'text', content: 'Second layout text' }
                    ],
                    slotSummary: { total: 1, text: 1, media: 0 },
                    totalSlots: 1
                }
            ],
            currentLayout: {
                id: 'test-layout-1',
                name: 'Test Layout 1'
            },
            isLoop: true,
            layoutCount: 2,
            totalSlots: 3,
            textSlots: 2,
            mediaSlots: 1,
            timestamp: Date.now()
        }
    } else {
        return {
            layouts: [
                {
                    id: 'test-single-layout',
                    name: 'Test Single Layout',
                    type: 'single',
                    hasData: true,
                    slots: [
                        { id: 'slot-1', name: 'single-text-slot', type: 'text', content: 'Single layout text' }
                    ],
                    slotSummary: { total: 1, text: 1, media: 0 },
                    totalSlots: 1
                }
            ],
            currentLayout: {
                id: 'test-single-layout',
                name: 'Test Single Layout'
            },
            isLoop: false,
            layoutCount: 1,
            totalSlots: 1,
            textSlots: 1,
            mediaSlots: 0,
            timestamp: Date.now()
        }
    }
}

// Display test results
function displayTestResults(testResults) {
    const resultsWindow = window.open('', 'Test Results', 'width=800,height=600,scrollbars=yes')
    
    let html = `
        <html>
            <head>
                <title>Enhanced Layout System Test Results</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                    .test-item { border: 1px solid #ddd; margin: 10px 0; border-radius: 5px; overflow: hidden; }
                    .test-header { padding: 10px 15px; background: #f8f9fa; font-weight: bold; }
                    .test-content { padding: 15px; }
                    .success { border-left: 4px solid #28a745; }
                    .failure { border-left: 4px solid #dc3545; }
                    .success .test-header { background: #d4edda; color: #155724; }
                    .failure .test-header { background: #f8d7da; color: #721c24; }
                </style>
            </head>
            <body>
                <h1>Enhanced Layout System Test Results</h1>
                <div class="summary">
                    <h2>Summary</h2>
                    <p><strong>Total Tests:</strong> ${testResults.summary.total}</p>
                    <p><strong>Passed:</strong> ${testResults.summary.passed}</p>
                    <p><strong>Failed:</strong> ${testResults.summary.failed}</p>
                    <p><strong>Success Rate:</strong> ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%</p>
                    <p><strong>Timestamp:</strong> ${testResults.timestamp}</p>
                </div>
                <h2>Test Details</h2>
    `
    
    testResults.tests.forEach(function(test, index) {
        const statusClass = test.result.success ? 'success' : 'failure'
        const statusIcon = test.result.success ? '✓' : '✗'
        
        html += `
            <div class="test-item ${statusClass}">
                <div class="test-header">
                    ${statusIcon} Test ${index + 1}: ${test.name}
                </div>
                <div class="test-content">
                    <p><strong>Result:</strong> ${test.result.message}</p>
                    <p><strong>Duration:</strong> ${test.duration}ms</p>
                </div>
            </div>
        `
    })
    
    html += `
                <div style="margin-top: 30px; text-align: center;">
                    <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px;">Close</button>
                </div>
            </body>
        </html>
    `
    
    resultsWindow.document.write(html)
    resultsWindow.document.close()
    
    console.log('=== TESTING: Test results displayed in new window ===')
}
