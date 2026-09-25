console.log('=== CONTROL PANEL: Starting initialization ===')
var socket = io()
var systemMonitoringInterval
var configData = {}

// Debug function for development-only logging  
const debug = localStorage.getItem('ecless-debug') === 'true' ? console.log.bind(console) : () => {}

console.log('=== CONTROL PANEL: Socket created, emitting save id ===')
socket.emit('save id', 'Controlpanel:')

// --- App update status (GitHub Releases / electron-updater) ---
function renderAppUpdateStatus(status) {
    const el = $('#appUpdateStatus')
    const installBtn = $('#installUpdateBtn')
    if (!el.length) {
        return
    }
    const message = (status && status.message) || 'Update status unavailable.'
    const state = (status && status.state) || 'idle'
    const version = (status && status.currentVersion) || '—'
    $('#appVersionLabel').text('Player version: v' + version)

    let alertClass = 'alert-secondary'
    if (state === 'uptodate') alertClass = 'alert-success'
    else if (state === 'available' || state === 'downloading' || state === 'downloaded' || state === 'installing') alertClass = 'alert-info'
    else if (state === 'error') alertClass = 'alert-danger'
    else if (state === 'checking') alertClass = 'alert-warning'

    el.removeClass('alert-secondary alert-success alert-info alert-danger alert-warning')
        .addClass(alertClass)
        .text(message)

    const canInstall = status && status.downloaded && state === 'downloaded'
    installBtn.prop('disabled', !canInstall)
}

function refreshAppUpdateStatus() {
    $.ajax({
        type: 'get',
        url: '/api/updates/status',
        timeout: 10000,
        success: function (data) {
            renderAppUpdateStatus(data || {})
        },
        error: function () {
            renderAppUpdateStatus({
                state: 'error',
                message: 'Update failed.',
                currentVersion: '—'
            })
        }
    })
}

function checkForAppUpdates() {
    showToast('Checking for updates...', 'info')
    renderAppUpdateStatus({
        state: 'checking',
        message: 'Checking for updates...',
        currentVersion: ($('#appVersionLabel').text().replace(/^Player version:\s*v?/i, '') || '—')
    })
    $.ajax({
        type: 'post',
        url: '/api/updates/check',
        timeout: 120000,
        success: function (data) {
            renderAppUpdateStatus((data && data.update) || {})
            if (data && data.update && data.update.message) {
                showToast(data.update.message, data.update.state === 'error' ? 'error' : 'info')
            }
        },
        error: function (xhr) {
            const message = (xhr.responseJSON && xhr.responseJSON.message) || 'Update failed.'
            renderAppUpdateStatus({ state: 'error', message: message })
            showToast(message, 'error')
        }
    })
}

function installDownloadedAppUpdate() {
    if (!confirm('Install the downloaded update and restart CLESS-Player now?')) {
        return
    }
    showToast('Installing update. The player will restart shortly.', 'warning')
    $.ajax({
        type: 'post',
        url: '/api/updates/install',
        timeout: 15000,
        success: function (data) {
            renderAppUpdateStatus({
                state: 'installing',
                message: (data && data.message) || 'Installing update and restarting...'
            })
        },
        error: function (xhr) {
            const message = (xhr.responseJSON && xhr.responseJSON.message) || 'Update failed.'
            renderAppUpdateStatus({ state: 'error', message: message })
            showToast(message, 'error')
        }
    })
}

socket.on('app-update-status', function (status) {
    renderAppUpdateStatus(status || {})
})


// Socket connection event handlers for restart recovery
socket.on('connect', function() {
    console.log('=== CONTROL PANEL: Connected to socket server ===')
    
    // Update connection status indicator
    updateConnectionStatus(true)
    
    // Check if we're recovering from a restart
    const restartButtonState = localStorage.getItem('ecless-restart-button-state')
    const restartReason = localStorage.getItem('ecless-restart-reason')
    
    if (restartButtonState === 'restarting') {
        console.log('=== CONTROL PANEL: Detected reconnection after restart ===')
        console.log('=== CONTROL PANEL: Restart reason:', restartReason)
        
        // Clear restart state
        localStorage.removeItem('ecless-restart-initiated')
        localStorage.removeItem('ecless-restart-button-state')
        localStorage.removeItem('ecless-restart-reason')
        
        // Restore appropriate button state based on restart reason
        setTimeout(() => {
            if (restartReason === 'configuration-save') {
                // Configuration save restart recovery
                const saveBtn = $('#saveConfig')
                if (saveBtn.length) {
                    saveBtn.removeClass('loading').prop('disabled', false)
                    saveBtn.html('<i class="bi bi-check-circle"></i> Save Configuration')
                    console.log('=== CONTROL PANEL: Save Configuration button state restored after restart ===')
                }
                
                if (window.showToast) {
                    showToast('Configuration applied successfully! Application restarted with new settings.', 'success')
                }
            } else {
                // Regular restart recovery
                const restartBtn = $('#restartapp')
                if (restartBtn.length) {
                    restartBtn.removeClass('loading').prop('disabled', false)
                    restartBtn.html('<i class="bi bi-bootstrap-reboot"></i> Restart App')
                    console.log('=== CONTROL PANEL: Restart button state restored after reconnection ===')
                }
                
                if (window.showToast) {
                    showToast('Application restarted successfully! Connection restored.', 'success')
                }
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

// Enhanced multi-display event handlers for control panel
socket.on('display-change', function(changeEvent) {
    console.log('=== CONTROL PANEL: Display configuration change detected ===')
    console.log('Event details:', changeEvent)
    
    try {
        // Update stored configuration data
        if (changeEvent.newConfig) {
            window.latestDisplayConfig = changeEvent.newConfig
            
            // Update display information in UI if elements exist  
            updateDisplayInfoUI(changeEvent.newConfig)
            
            // Show user notification about the change
            const displayCount = changeEvent.newConfig.displayCount
            const resolution = changeEvent.newConfig.combinedResolution
            const arrangement = changeEvent.newConfig.arrangement
            
            let message = ''
            if (changeEvent.eventType === 'display-added') {
                message = `Display added! Now using ${displayCount} displays (${resolution})`
            } else if (changeEvent.eventType === 'display-removed') {
                message = `Display removed! Now using ${displayCount} displays (${resolution})`
            } else {
                message = `Display configuration changed: ${resolution} (${arrangement})`
            }
            
            if (window.showToast) {
                showToast(message, 'info', 6000)
            }
            
            // Trigger refresh of remote display container if available
            if (window.displayOrientationManager) {
                setTimeout(() => {
                    window.displayOrientationManager.refreshDisplayInfo()
                }, 500)
            }
        }
        
    } catch (error) {
        console.error('=== CONTROL PANEL: Error handling display change ===', error)
    }
})

socket.on('display-configuration-updated', function(updateEvent) {
    console.log('=== CONTROL PANEL: Display configuration updated ===')
    console.log('Update details:', updateEvent)
    
    try {
        if (updateEvent.data) {
            window.latestDisplayConfig = updateEvent.data
            updateDisplayInfoUI(updateEvent.data)
            
            // Show appropriate message based on update type
            if (updateEvent.type === 'forced-refresh') {
                if (window.showToast) {
                    showToast('Display configuration refreshed successfully', 'success', 3000)
                }
            }
            
            // Update remote display orientation
            if (window.displayOrientationManager) {
                window.displayOrientationManager.detectDisplayOrientation()
            }
        }
        
    } catch (error) {
        console.error('=== CONTROL PANEL: Error handling display configuration update ===', error)
    }
})

// Function to update display information in the control panel UI
function updateDisplayInfoUI(displayConfig) {
    try {
        // Update display count indicator if it exists
        const displayCountElement = document.getElementById('display-count')
        if (displayCountElement) {
            displayCountElement.textContent = displayConfig.displayCount || 1
        }
        
        // Update combined resolution indicator if it exists
        const resolutionElement = document.getElementById('combined-resolution')
        if (resolutionElement) {
            resolutionElement.textContent = displayConfig.combinedResolution || '1920x1080'
        }
        
        // Update arrangement indicator if it exists
        const arrangementElement = document.getElementById('display-arrangement')
        if (arrangementElement) {
            arrangementElement.textContent = displayConfig.arrangement || 'single'
        }
        
        // Update multi-display status badge if it exists
        const multiDisplayBadge = document.getElementById('multi-display-badge')
        if (multiDisplayBadge) {
            if (displayConfig.hasMultipleDisplays) {
                multiDisplayBadge.className = 'badge badge-success'
                multiDisplayBadge.textContent = 'Multi-Display'
            } else {
                multiDisplayBadge.className = 'badge badge-secondary'
                multiDisplayBadge.textContent = 'Single Display'
            }
        }
        
        // Update individual displays list if container exists
        const displaysListElement = document.getElementById('displays-list')
        if (displaysListElement && displayConfig.displays) {
            let displaysHTML = ''
            displayConfig.displays.forEach((display, index) => {
                const isPrimary = display.isPrimary ? ' (Primary)' : ''
                displaysHTML += `
                    <div class="display-item">
                        <strong>${display.name}${isPrimary}</strong><br>
                        Resolution: ${display.resolution}<br>
                        Position: ${display.position}
                    </div>
                `
            })
            displaysListElement.innerHTML = displaysHTML
        }
        
        console.log('=== CONTROL PANEL: Display UI updated successfully ===')
        
    } catch (error) {
        console.error('=== CONTROL PANEL: Error updating display UI ===', error)
    }
}

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
    getAPITicker()
    getAPIScroller()
    getAPIFader()
    getAPIDate()
    getAPITime()
    getAPIDateTime()
    gettextslot()
    getmediaslot()
    getmediafiles()
    gettickerslot()
    getscrollerslot()
    getfaderslot()
    getdateslot()
    gettimeslot()
    getdatetimeslot()
    loadConfiguration()
    refreshAppUpdateStatus()
    setInterval(refreshAppUpdateStatus, 30000)
    
    // Initialize modern dashboard features
    initModernFeatures()
    
    // Initialize volume controls
    getCurrentVolumeLevel()
    
    // Initialize enhanced configuration fields with default values
    initializeConfigurationFields()
    
    // Load network interfaces and license status
    loadNetworkLicenseStatus()
    
    // Set up intervals for monitoring
    setInterval(function () {
        deviceinfo()
    }, 5000)
    
    // Refresh network license status every 30 seconds
    setInterval(function () {
        loadNetworkLicenseStatus()
    }, 30000)

    // Set up system monitoring refresh
    setInterval(function () {
        refreshSystemStats()
    }, 10000)
    
    // Set up real-time layout details monitoring
    setupLayoutDetailsMonitoring()
})

// Initialize modern dashboard features
function initModernFeatures() {
    console.log('=== CONTROL PANEL: Initializing modern features ===')
    
    try {
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
        console.log('Toast notification system initialized')
    } catch (error) {
        console.warn('Failed to initialize toast system:', error)
    }
    
    try {
        // Remove loading classes and show content
        $('.loading').removeClass('loading')
        console.log('Loading classes removed')
    } catch (error) {
        console.warn('Failed to remove loading classes:', error)
    }
    
    try {
        // Start system monitoring (critical feature)
        startSystemMonitoring()
        console.log('System monitoring started')
    } catch (error) {
        console.error('Failed to start system monitoring:', error)
    }
    
    try {
        // Set up event handlers for new features
        setupEventHandlers()
        console.log('Event handlers initialized')
    } catch (error) {
        console.warn('Failed to setup event handlers:', error)
    }
    
    try {
        // Initialize API documentation
        initializeApiDocumentation()
        console.log('API documentation initialized')
    } catch (error) {
        console.warn('Failed to initialize API documentation:', error)
    }
    
    try {
        // Initialize Bootstrap tooltips (non-critical, safe implementation)
        initializeTooltips()
        console.log('Tooltips initialized')
    } catch (error) {
        console.warn('Failed to initialize tooltips (non-critical):', error)
    }
    
    console.log('=== CONTROL PANEL: Modern features initialization completed ===')
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

// ================================================
// REQUEST THROTTLE MANAGER
// Prevents ERR_HTTP_HEADERS_SENT by ensuring only one request
// per endpoint is in-flight at a time, and debounces rapid clicks.
// ================================================
var _pendingRequests = {}

/**
 * Wraps an action so that rapid repeated calls are ignored while
 * a previous call for the same key is still in progress.
 * @param {string} key   - A unique identifier for the action (e.g. 'refresh')
 * @param {Function} fn  - The function to execute (should return void)
 * @param {number} [cooldownMs=1000] - Minimum ms between consecutive calls
 * @returns {boolean} true if the action was executed, false if throttled
 */
function throttledAction(key, fn, cooldownMs) {
    cooldownMs = cooldownMs || 1000
    var now = Date.now()
    var state = _pendingRequests[key]

    // If a request is still in progress or within cooldown, ignore
    if (state && (state.inProgress || (now - state.lastCompleted) < cooldownMs)) {
        debug('Throttled action blocked for key:', key)
        return false
    }

    // Mark as in-progress
    _pendingRequests[key] = { inProgress: true, lastCompleted: state ? state.lastCompleted : 0 }

    // Execute action
    try {
        fn()
    } catch (err) {
        console.error('throttledAction error for', key, err)
    }

    return true
}

/**
 * Marks a throttled action as completed so future calls are allowed.
 * Should be called from the AJAX success/error/complete callback.
 * @param {string} key - The unique identifier used in throttledAction
 */
function completeThrottledAction(key) {
    if (_pendingRequests[key]) {
        _pendingRequests[key].inProgress = false
        _pendingRequests[key].lastCompleted = Date.now()
    }
}

function setupEventHandlers() {
    // Original button handlers with request throttling to prevent ERR_HTTP_HEADERS_SENT
    $('#shutdown').click(function () {
        throttledAction('shutdown', function () { shutdown() }, 3000)
    })

    $('#reboot').click(function () {
        throttledAction('reboot', function () { reboot() }, 3000)
    })

    $('#refresh').click(function () {
        throttledAction('refresh', function () { refresh() }, 2000)
    })

    $('#restartapp').click(function () {
        throttledAction('restartapp', function () { restartapp() }, 5000)
    })

    $('#checkForUpdates, #checkForUpdatesSecondary').click(function () {
        throttledAction('checkForUpdates', function () { checkForAppUpdates() }, 5000)
    })

    $('#installUpdateBtn').click(function () {
        throttledAction('installUpdate', function () { installDownloadedAppUpdate() }, 5000)
    })

    $('#refreshLayout').click(function () {
        throttledAction('refreshLayout', function () { refreshLayout() }, 2000)
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

    $('.btnReplaceTicker').click(function () {
        var layoutid = $('#replaceTickerList').find(":selected").attr('class')
        var textname = $('#replaceTickerList').find(":selected").val()
        var textReplace = $('#replaceTickerInput').val()
        replacetextslot(layoutid, textname, textReplace)
    })

    $('.btnReplaceScroller').click(function () {
        var layoutid = $('#replaceScrollerList').find(":selected").attr('class')
        var textname = $('#replaceScrollerList').find(":selected").val()
        var textReplace = $('#replaceScrollerInput').val()
        replacetextslot(layoutid, textname, textReplace)
    })

    $('.btnReplaceFader').click(function () {
        var layoutid = $('#replaceFaderList').find(":selected").attr('class')
        var textname = $('#replaceFaderList').find(":selected").val()
        var textReplace = $('#replaceFaderInput').val()
        replacetextslot(layoutid, textname, textReplace)
    })

    // New enhanced handlers
    // Screen toggle control with one-time click protection and throttling
    $('#screenOn').click(function() {
        debug('Screen ON button clicked');
        // Check if button is already disabled to prevent multiple clicks
        if ($(this).prop('disabled')) {
            debug('Screen ON button is disabled, ignoring click');
            return;
        }
        if (!throttledAction('screenToggle', function () {
            // Disable both buttons immediately to prevent multiple clicks
            $('#screenOn').prop('disabled', true).addClass('btn-loading');
            $('#screenOff').prop('disabled', true);
            setScreenToggle('on');
        }, 2000)) return;
    })

    $('#screenOff').click(function() {
        debug('Screen OFF button clicked');
        // Check if button is already disabled to prevent multiple clicks
        if ($(this).prop('disabled')) {
            debug('Screen OFF button is disabled, ignoring click');
            return;
        }
        if (!throttledAction('screenToggle', function () {
            // Disable both buttons immediately to prevent multiple clicks
            $('#screenOff').prop('disabled', true).addClass('btn-loading');
            $('#screenOn').prop('disabled', true);
            setScreenToggle('off');
        }, 2000)) return;
    })

    // Volume control handlers - Unified Mute/Unmute toggle
    window._isMuted = false; // Track mute state
    
    $('#volumeToggleMute').click(function() {
        if ($(this).prop('disabled')) return;
        
        if (window._isMuted) {
            debug('Volume UNMUTE toggle clicked');
            throttledAction('volumeToggleMute', function () { setVolumeUnmute() }, 1500);
        } else {
            debug('Volume MUTE toggle clicked');
            throttledAction('volumeToggleMute', function () { setVolumeMute() }, 1500);
        }
    })

    // Volume slider handler with debouncing
    let volumeTimeout;
    $('#volumeSlider').on('input', function() {
        const volume = parseInt($(this).val());
        $('#volumeDisplay').text(volume + '%');
        updateVolumeSliderFill(volume);
        
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

// Load network interfaces and license status
function loadNetworkLicenseStatus() {
    $.ajax({
        type: 'get',
        url: '/api/network-license-status',
        success: function (data) {
            displayNetworkLicenseStatus(data)
        },
        error: function (xhr, status, error) {
            console.error('Failed to load network license status:', error)
            $('#networkLicenseStatus').html(
                '<div class="alert alert-warning">' +
                '<i class="bi bi-exclamation-triangle"></i> Failed to load network interface information' +
                '</div>'
            )
        }
    })
}

// Display network interfaces and license validation status
function displayNetworkLicenseStatus(data) {
    const container = $('#networkLicenseStatus')
    
    if (!data || !data.interfaces || data.interfaces.length === 0) {
        container.html(
            '<div class="alert alert-warning">' +
            '<i class="bi bi-exclamation-circle"></i> No network interfaces detected' +
            '</div>'
        )
        return
    }
    
    let html = '<div class="network-license-status-container">'
    
    // License validation status
    if (data.licenseValid) {
        html += `
            <div class="alert alert-success mb-3">
                <i class="bi bi-check-circle-fill"></i> 
                <strong>License Valid</strong> - Matched interface: <code>${data.matchedInterface.interface}</code> (${data.matchedInterface.type})
            </div>
        `
    } else {
        html += `
            <div class="alert alert-danger mb-3">
                <i class="bi bi-x-circle-fill"></i> 
                <strong>License Invalid</strong> - ${data.validationReason || 'Serial key does not match any network interface'}
            </div>
        `
    }
    
    // Network interfaces list
    html += '<h6 class="mb-3">Detected Network Interfaces:</h6>'
    
    data.interfaces.forEach((iface, index) => {
        const isMatched = data.licenseValid && 
                         data.matchedInterface && 
                         iface.mac === data.matchedInterface.mac
        const cardClass = isMatched ? 'border-success' : 'border-secondary'
        const badgeClass = isMatched ? 'bg-success' : 'bg-secondary'
        const badgeText = isMatched ? '✓ Licensed' : 'Not Licensed'
        
        html += `
            <div class="card mb-2 ${cardClass}">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${iface.interface}</strong>
                            <span class="badge ${badgeClass} ms-2">${badgeText}</span>
                            <br>
                            <small class="text-muted">${iface.type}</small>
                        </div>
                        <div class="text-end">
                            <code class="text-primary">${iface.mac}</code>
                            <br>
                            <small class="text-muted">${iface.address || 'No IP'}</small>
                        </div>
                    </div>
                </div>
            </div>
        `
    })
    
    html += '</div>'
    container.html(html)
}

// Enhanced system information display
function deviceinfo() {
    console.log('=== CONTROL PANEL: Fetching device information ===')
    
    $.ajax({
        type: 'GET',
        url: '/api/system/full-info',
        timeout: 15000, // 15 second timeout
        success: function (data) {
            console.log('Device info data received:', data)
            
            try {
                // CPU Information
                if (data.cpu) {
                    $('#sManu').text(data.cpu.manufacturer || 'N/A')
                    $('#sBrand').text(data.cpu.brand || 'N/A')
                    $('#sSpeed').text((data.cpu.speed ? data.cpu.speed + ' GHz' : 'N/A'))
                    $('#sCores').text(data.cpu.cores || 'N/A')
                    $('#sPhysicalCores').text(data.cpu.physicalCores || 'N/A')
                    $('#sFamily').text(data.cpu.family || 'N/A')
                    $('#sModel').text(data.cpu.model || 'N/A')
                    console.log('CPU information updated')
                } else {
                    console.warn('CPU data not available')
                    $('#sManu, #sBrand, #sSpeed, #sCores, #sPhysicalCores, #sFamily, #sModel').text('N/A')
                }

                // Memory Information
                if (data.memory) {
                    $('#memTotal').text(formatBytes(data.memory.total))
                    $('#memFree').text(formatBytes(data.memory.free))
                    $('#memUsed').text(formatBytes(data.memory.used))
                    $('#memAvailable').text(formatBytes(data.memory.available))
                    $('#swapTotal').text(formatBytes(data.memory.swaptotal || 0))
                    $('#swapUsed').text(formatBytes(data.memory.swapused || 0))
                    console.log('Memory information updated')
                } else {
                    console.warn('Memory data not available')
                    $('#memTotal, #memFree, #memUsed, #memAvailable, #swapTotal, #swapUsed').text('N/A')
                }

                // System Information
                if (data.system) {
                    $('#systemManu').text(data.system.manufacturer || 'N/A')
                    $('#systemModel').text(data.system.model || 'N/A')
                    if (data.system.os) {
                        $('#osInfo').text(`${data.system.os.distro || ''} ${data.system.os.release || ''}`.trim() || 'N/A')
                        $('#osPlatform').text(data.system.os.platform || 'N/A')
                        $('#osArch').text(data.system.os.arch || 'N/A')
                        $('#osHostname').text(data.system.os.hostname || 'N/A')
                    } else {
                        $('#osInfo, #osPlatform, #osArch, #osHostname').text('N/A')
                    }
                    console.log('System information updated')
                } else {
                    console.warn('System data not available')
                    $('#systemManu, #systemModel, #osInfo, #osPlatform, #osArch, #osHostname').text('N/A')
                }

                // Network Information
                if (data.network && Array.isArray(data.network)) {
                    displayNetworkInterfaces(data.network)
                    console.log('Network information updated')
                } else {
                    console.warn('Network data not available')
                    // Clear network display
                    $('#networkInfo').html('<div class="text-muted">No network data available</div>')
                }

                // Display Information
                if (data.display) {
                    displayDisplayInfo(data.display)
                    console.log('Display information updated')
                } else {
                    console.warn('Display data not available')
                    // Clear display info
                    $('#displayInfo').html('<div class="text-muted">No display data available</div>')
                }

                // Storage/Disk Information
                if (data.disk && Array.isArray(data.disk)) {
                    displayDiskInfo(data.disk)
                    console.log('Disk information updated')
                } else {
                    console.warn('Disk data not available')
                    // Clear disk info
                    $('#diskInfo').html('<div class="text-muted">No storage data available</div>')
                }
                
                console.log('=== CONTROL PANEL: Device information update completed ===')
                
            } catch (error) {
                console.error('Error processing device info data:', error)
                // Show error in UI
                if (window.showToast) {
                    window.showToast('Error processing device information', 'error')
                }
            }
        },
        error: function (xhr, status, error) {
            console.error('Error fetching device info:', {
                status: status,
                error: error,
                responseText: xhr.responseText
            })
            
            // Show error state in UI
            $('.device-info-field').text('Error')
            
            if (window.showToast) {
                window.showToast('Failed to fetch device information. Please check connection.', 'error')
            }
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
    console.log('=== CONTROL PANEL: Refreshing system monitoring data ===')
    
    $.ajax({
        type: 'GET',
        url: '/api/system/monitor',
        timeout: 10000, // 10 second timeout
        success: function (data) {
            console.log('System monitoring data received:', data)
            
            try {
                // CPU Usage
                if (data.cpu && typeof data.cpu.load !== 'undefined') {
                    const cpuLoad = parseFloat(data.cpu.load).toFixed(1)
                    $('#cpuUsage').html(`<span class="metric-value">${cpuLoad}%</span>`)
                    $('#cpuProgressBar').css('width', cpuLoad + '%')
                    console.log('CPU data updated:', cpuLoad + '%')
                } else {
                    $('#cpuUsage').html('<span class="metric-value">N/A</span>')
                    console.warn('CPU data not available in response')
                }
                
                // Memory Usage
                if (data.memory && data.memory.used && data.memory.total) {
                    const memoryUsage = ((data.memory.used / data.memory.total) * 100).toFixed(1)
                    $('#memoryUsage').html(`<span class="metric-value">${memoryUsage}%</span><br><small>${formatBytes(data.memory.used)} / ${formatBytes(data.memory.total)}</small>`)
                    $('#memoryProgressBar').css('width', memoryUsage + '%')
                    console.log('Memory data updated:', memoryUsage + '%')
                } else {
                    $('#memoryUsage').html('<span class="metric-value">N/A</span>')
                    console.warn('Memory data not available in response')
                }
                
                // Disk Usage
                if (data.disk && Array.isArray(data.disk)) {
                    var diskHtml = ''
                    data.disk.forEach(function(disk, index) {
                        if (index < 2 && disk.filesystem && typeof disk.usage !== 'undefined') {
                            diskHtml += `<small>${disk.filesystem}: ${parseFloat(disk.usage).toFixed(1)}%</small><br>`
                        }
                    })
                    $('#diskUsage').html(diskHtml || '<small>No disk data</small>')
                    console.log('Disk data updated')
                } else {
                    $('#diskUsage').html('<small>No disk data</small>')
                    console.warn('Disk data not available in response')
                }
                
                // Network Stats
                if (data.network && Array.isArray(data.network)) {
                    var networkHtml = ''
                    data.network.forEach(function(net, index) {
                        if (index < 1 && net.rx_sec > 0) {
                            networkHtml += `<small>↓ ${formatBytes(net.rx_sec)}/s<br>↑ ${formatBytes(net.tx_sec)}/s</small>`
                        }
                    })
                    $('#networkStats').html(networkHtml || '<small>No active traffic</small>')
                    console.log('Network data updated')
                } else {
                    $('#networkStats').html('<small>No network data</small>')
                    console.warn('Network data not available in response')
                }
                
                // Data Usage Stats
                if (data.dataUsage) {
                    updateDataUsageDisplay(data.dataUsage)
                    console.log('Data usage updated')
                } else {
                    console.warn('Data usage not available in response')
                }
                
            } catch (error) {
                console.error('Error processing system monitoring data:', error)
                $('#cpuUsage, #memoryUsage, #diskUsage, #networkStats').html('<span class="text-danger">Error</span>')
            }
        },
        error: function (xhr, status, error) {
            console.error('Error fetching monitoring data:', {
                status: status,
                error: error,
                responseText: xhr.responseText
            })
            
            // Show error state in UI
            $('#cpuUsage').html('<span class="text-danger">Error</span>')
            $('#memoryUsage').html('<span class="text-danger">Error</span>')
            $('#diskUsage').html('<small class="text-danger">Connection Error</small>')
            $('#networkStats').html('<small class="text-danger">Connection Error</small>')
            
            // Try to show user-friendly error message
            if (window.showToast) {
                window.showToast('Failed to fetch system monitoring data. Please check connection.', 'error')
            }
        }
    })
}

// Data usage display function
function updateDataUsageDisplay(dataUsage) {
    console.log('Updating data usage display:', dataUsage)
    
    try {
        // Update main metric card (only dataUsageTotal exists in HTML)
        if (dataUsage.total && typeof dataUsage.total.total !== 'undefined') {
            $('#dataUsageTotal').html(formatBytes(dataUsage.total.total))
        } else if (dataUsage.total && typeof dataUsage.total.download !== 'undefined' && typeof dataUsage.total.upload !== 'undefined') {
            const totalBytes = dataUsage.total.download + dataUsage.total.upload
            $('#dataUsageTotal').html(formatBytes(totalBytes))
        } else {
            $('#dataUsageTotal').html('N/A')
        }
        
        // Update detailed breakdown in the Data Usage Management section
        if (dataUsage.daily) {
            $('#dailyDownload').text(formatBytes(dataUsage.daily.download || 0))
            $('#dailyUpload').text(formatBytes(dataUsage.daily.upload || 0))
        }
        
        if (dataUsage.monthly) {
            // Calculate monthly total if not provided
            const monthlyTotal = dataUsage.monthly.total || 
                                (dataUsage.monthly.download + dataUsage.monthly.upload) || 0
            $('#monthlyTotal').text(formatBytes(monthlyTotal))
        }
        
        if (dataUsage.total) {
            // Calculate total usage if not provided
            const totalUsage = dataUsage.total.total || 
                              (dataUsage.total.download + dataUsage.total.upload) || 0
            $('#totalUsage').text(formatBytes(totalUsage))
        }
        
        console.log('Data usage display updated successfully')
    } catch (error) {
        console.error('Error updating data usage display:', error)
        $('#dataUsageTotal').html('Error')
        $('#dailyDownload, #dailyUpload, #monthlyTotal, #totalUsage').text('Error')
    }
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
        },
        complete: function () {
            completeThrottledAction('screenToggle')
        }
    })
}

// Volume control functions
function setVolumeMute() {
    const toggleBtn = $('#volumeToggleMute')
    const statusBadge = $('#volumeStatusBadge')
    
    toggleBtn.addClass('loading').prop('disabled', true)
    
    $.ajax({
        type: 'get',
        url: '/api/volume/mute',
        timeout: 20000,
        success: function (data) {
            debug('Volume mute success:', data)
            if (data.success) {
                showAlert('success', 'Audio muted')
                window._isMuted = true
                updateMuteToggleUI(true)
                if (window.showToast) showToast('System audio muted', 'info')
                // Refresh volume status to confirm actual system state
                setTimeout(function() { getCurrentVolumeLevel() }, 500)
            }
        },
        error: function (xhr, status, error) {
            console.error('Volume mute failed:', status, error)
            var errorMsg = 'Failed to mute audio'
            if (status === 'timeout') {
                errorMsg = 'Mute request timed out - please try again'
            } else if (xhr.responseJSON && xhr.responseJSON.error) {
                errorMsg = 'Mute failed: ' + xhr.responseJSON.error
            }
            showAlert('danger', errorMsg)
        },
        complete: function () {
            toggleBtn.removeClass('loading').prop('disabled', false)
            completeThrottledAction('volumeToggleMute')
        }
    })
}

function setVolumeUnmute() {
    const toggleBtn = $('#volumeToggleMute')
    
    toggleBtn.addClass('loading').prop('disabled', true)
    
    $.ajax({
        type: 'get',
        url: '/api/volume/unmute',
        timeout: 20000,
        success: function (data) {
            debug('Volume unmute success:', data)
            if (data.success) {
                showAlert('success', 'Audio unmuted')
                window._isMuted = false
                updateMuteToggleUI(false)
                if (window.showToast) showToast('System audio unmuted', 'success')
                // Refresh volume status to confirm actual system state
                setTimeout(function() { getCurrentVolumeLevel() }, 500)
            }
        },
        error: function (xhr, status, error) {
            console.error('Volume unmute failed:', status, error)
            var errorMsg = 'Failed to unmute audio'
            if (status === 'timeout') {
                errorMsg = 'Unmute request timed out - please try again'
            } else if (xhr.responseJSON && xhr.responseJSON.error) {
                errorMsg = 'Unmute failed: ' + xhr.responseJSON.error
            }
            showAlert('danger', errorMsg)
        },
        complete: function () {
            toggleBtn.removeClass('loading').prop('disabled', false)
            completeThrottledAction('volumeToggleMute')
        }
    })
}

/**
 * Updates the mute toggle button and status badge UI
 * Button shows the ACTION (what clicking will do), badge shows CURRENT STATE
 * @param {boolean} isMuted - Whether audio is currently muted
 */
function updateMuteToggleUI(isMuted) {
    const toggleBtn = $('#volumeToggleMute')
    const statusBadge = $('#volumeStatusBadge')
    const slider = $('#volumeSlider')
    const volumeDisplay = $('#volumeDisplay')
    
    // Remove loading state from badge
    statusBadge.removeClass('loading')
    
    if (isMuted) {
        // Current state: MUTED → Button action: "Unmute"
        toggleBtn.removeClass('unmuted').addClass('muted')
        toggleBtn.find('i').attr('class', 'bi bi-volume-up-fill')
        toggleBtn.find('.toggle-label').text('Unmute')
        statusBadge.removeClass('unmuted').addClass('muted')
        statusBadge.html('<i class="bi bi-x-circle-fill"></i> Audio Muted')
        slider.addClass('muted')
        volumeDisplay.addClass('muted')
    } else {
        // Current state: UNMUTED → Button action: "Mute"
        toggleBtn.removeClass('muted').addClass('unmuted')
        toggleBtn.find('i').attr('class', 'bi bi-volume-mute-fill')
        toggleBtn.find('.toggle-label').text('Mute')
        statusBadge.removeClass('muted').addClass('unmuted')
        statusBadge.html('<i class="bi bi-check-circle-fill"></i> Audio Active')
        slider.removeClass('muted')
        volumeDisplay.removeClass('muted')
    }
}

/**
 * Updates the volume slider fill color based on current value
 * Blue gradient when volume > 0, gray when 0
 * @param {number} volume - Volume level 0-100
 */
function updateVolumeSliderFill(volume) {
    const slider = $('#volumeSlider')[0]
    if (!slider) return
    
    const percentage = volume
    const $slider = $(slider)
    
    if (volume === 0) {
        $slider.addClass('volume-zero')
        slider.style.background = '#e2e8f0'
    } else {
        $slider.removeClass('volume-zero')
        slider.style.background = `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`
    }
}

function setVolumeLevel(volume) {
    $('#volumeDisplay').text(volume + '%')
    updateVolumeSliderFill(volume)
    
    // If volume is set to 0 from slider, update mute UI accordingly
    if (parseInt(volume) === 0 && !window._isMuted) {
        window._isMuted = true
        updateMuteToggleUI(true)
    } else if (parseInt(volume) > 0 && window._isMuted) {
        window._isMuted = false
        updateMuteToggleUI(false)
    }
    
    $.ajax({
        type: 'post',
        url: '/api/volume/set',
        contentType: 'application/json',
        data: JSON.stringify({ volume: volume }),
        timeout: 20000,
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

/**
 * Fetches actual volume level and mute status from the system and updates the UI accordingly
 * Includes retry logic for reliability (PowerShell COM init may take time on first call)
 * @param {number} [retryCount=0] - Current retry attempt (internal use)
 */
function getCurrentVolumeLevel(retryCount) {
    retryCount = retryCount || 0
    var maxRetries = 2
    
    $.ajax({
        type: 'get',
        url: '/api/volume/get',
        timeout: 20000,
        success: function (data) {
            debug('Get volume status:', data)
            if (data.success) {
                // Update volume slider and display
                const volume = parseInt(data.volume) || 0
                $('#volumeSlider').val(volume)
                $('#volumeDisplay').text(volume + '%')
                updateVolumeSliderFill(volume)
                
                // Update mute state from actual system status
                const isMuted = data.muted === true
                window._isMuted = isMuted
                updateMuteToggleUI(isMuted)
                
                debug('Volume status synced: ' + volume + '% ' + (isMuted ? '(muted)' : '(active)'))
            } else if (retryCount < maxRetries) {
                debug('Volume status response not successful, retrying (' + (retryCount + 1) + '/' + maxRetries + ')...')
                setTimeout(function() { getCurrentVolumeLevel(retryCount + 1) }, 3000 * (retryCount + 1))
            }
        },
        error: function (xhr, status, error) {
            console.error('Get volume failed:', status, error)
            if (retryCount < maxRetries) {
                debug('Volume status fetch failed, retrying in ' + (3 * (retryCount + 1)) + ' seconds...')
                setTimeout(function() { getCurrentVolumeLevel(retryCount + 1) }, 3000 * (retryCount + 1))
            } else {
                // Final attempt failed, show error state
                $('#volumeStatusBadge').removeClass('loading').addClass('unmuted')
                    .html('<i class="bi bi-exclamation-circle-fill"></i> Status Unavailable')
                console.warn('Volume status unavailable after ' + maxRetries + ' retries')
            }
        }
    })
}

// Initialize volume controls on page load
$(function() {
    // Fetch actual system volume and mute status
    getCurrentVolumeLevel()
})

// Configuration management
function saveConfiguration() {
    // Gather all configuration data
    const clessHostname = $('#clessHostname').val().trim()
    const corsOptions = $('#corsOptions').val()
    const dsId = $('#dsId').val().trim()
    const serialKey = $('#serialKey').val().trim()
    
    // Validate required fields
    if (!clessHostname) {
        showToast('CLESS Server Hostname is required', 'error')
        return
    }
    
    if (!dsId || isNaN(dsId) || parseInt(dsId) < 1 || parseInt(dsId) > 9999) {
        showToast('DS ID must be a number between 1 and 9999', 'error')
        return
    }
    
    // Validate hostname format
    try {
        new URL(clessHostname)
    } catch (e) {
        showToast('CLESS Server Hostname must be a valid URL (e.g., https://example.com)', 'error')
        return
    }
    
    configData = {
        // Only update user-editable fields - preserve existing config structure
        autoStartup: $('#autoStartup').is(':checked'),
        fullscreenMode: $('#fullscreenMode').is(':checked'),
        screenTimeout: parseInt($('#screenTimeout').val()) || 0,
        updateInterval: parseInt($('#updateInterval').val()) || 30,
        logLevel: $('#logLevel').val(),
        
        // Enhanced configuration fields (user-editable)
        hostserver: clessHostname,
        corsproxy: corsOptions,
        id: parseInt(dsId), // Ensure numeric type for DS ID

        systemSettings: {
            ...((configData && configData.systemSettings) || {}),
            autoCheckUpdates: $('#autoCheckUpdates').is(':checked'),
            autoInstallUpdates: $('#autoInstallUpdates').is(':checked')
        },
        
        // Update timestamp
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
                showToast('Configuration saved successfully', 'success')
                
                // Clear serial key field after successful save for security
                if (serialKey) {
                    $('#serialKey').val('')
                    $('#serialKey').attr('placeholder', 'Serial key updated (enter new key to update again)')
                }
                
                // Validate configuration changes and determine if restart is needed
                if (validateConfigurationForRestart(configData)) {
                    // Auto-relaunch application after configuration save
                    triggerAutoRelaunchAfterConfigSave()
                } else {
                    showToast('Configuration saved. No restart required for these changes.', 'success')
                }
            } else {
                showToast(data.message || 'Failed to save configuration', 'error')
            }
        },
        error: function (xhr, status, error) {
            console.error('Configuration save error:', error)
            showToast(`Failed to save configuration: ${error}`, 'error')
        }
    })
}

// Validate configuration changes and determine if restart is needed
function validateConfigurationForRestart(newConfig) {
    console.log('=== CONTROL PANEL: Validating configuration for restart necessity ===')
    
    // Get current configuration to compare changes
    let currentConfig = {}
    try {
        const storedConfig = localStorage.getItem('ecless-current-config')
        if (storedConfig) {
            currentConfig = JSON.parse(storedConfig)
        }
    } catch (error) {
        console.warn('Could not load current config for comparison, assuming restart needed')
        return true // Assume restart needed if we can't compare
    }
    
    // Configuration fields that require restart when changed
    const restartRequiredFields = [
        'hostserver',    // Server URL change requires reconnection
        'id',           // DS ID change requires server re-registration
        'serialkey',    // Serial key change may affect licensing
        'corsproxy',    // CORS proxy setting affects network requests
        'autoStartup'   // Auto-startup setting requires system-level changes
    ]
    
    // Configuration fields that are critical and always require user confirmation
    const criticalFields = [
        'hostserver',   // Changing server could disconnect from current content
        'id',          // Changing DS ID could change displayed content
        'serialkey'    // Serial key affects licensing and features
    ]
    
    let restartNeeded = false
    let criticalChanges = []
    let minorChanges = []
    
    // Check each field for changes
    restartRequiredFields.forEach(field => {
        const oldValue = currentConfig[field]
        const newValue = newConfig[field]
        
        // Handle different data types and undefined values
        const normalizedOldValue = oldValue === undefined ? '' : String(oldValue)
        const normalizedNewValue = newValue === undefined ? '' : String(newValue)
        
        if (normalizedOldValue !== normalizedNewValue) {
            restartNeeded = true
            
            if (criticalFields.includes(field)) {
                criticalChanges.push({
                    field: field,
                    oldValue: normalizedOldValue,
                    newValue: normalizedNewValue
                })
            } else {
                minorChanges.push({
                    field: field,
                    oldValue: normalizedOldValue,
                    newValue: normalizedNewValue
                })
            }
        }
    })
    
    // Log configuration changes for debugging
    if (criticalChanges.length > 0) {
        console.log('=== CONTROL PANEL: Critical configuration changes detected ===', criticalChanges)
    }
    if (minorChanges.length > 0) {
        console.log('=== CONTROL PANEL: Minor configuration changes detected ===', minorChanges)
    }
    
    // Store new configuration for future comparisons
    localStorage.setItem('ecless-current-config', JSON.stringify(newConfig))
    
    // Show user confirmation for critical changes
    if (criticalChanges.length > 0) {
        const criticalChangesList = criticalChanges.map(change => {
            const fieldName = change.field === 'hostserver' ? 'Server URL' :
                             change.field === 'id' ? 'DS ID' :
                             change.field === 'serialkey' ? 'Serial Key' :
                             change.field
            
            return `• ${fieldName}: "${change.oldValue}" → "${change.newValue}"`
        }).join('\n')
        
        const confirmCriticalChanges = confirm(
            'WARNING: Critical configuration changes detected!\n\n' +
            'The following changes may affect your display content and connection:\n\n' +
            criticalChangesList + '\n\n' +
            'These changes require an application restart to take effect.\n\n' +
            'Do you want to proceed with the restart?\n\n' +
            'Click OK to restart and apply changes, or Cancel to save without restarting.'
        )
        
        if (!confirmCriticalChanges) {
            showToast('Configuration saved without restart. Changes will be applied on next manual restart.', 'warning')
            return false
        }
    }
    
    // If restart is needed, show summary of all changes
    if (restartNeeded) {
        const allChanges = [...criticalChanges, ...minorChanges]
        if (allChanges.length > 0) {
            const changesSummary = allChanges.map(change => {
                const fieldName = change.field === 'hostserver' ? 'Server URL' :
                                 change.field === 'id' ? 'DS ID' :
                                 change.field === 'serialkey' ? 'Serial Key' :
                                 change.field === 'corsproxy' ? 'CORS Proxy' :
                                 change.field === 'autoStartup' ? 'Auto Startup' :
                                 change.field
                
                return `${fieldName}: ${change.oldValue || '(empty)'} → ${change.newValue || '(empty)'}`
            }).join(', ')
            
            console.log('=== CONTROL PANEL: Configuration changes requiring restart ===', changesSummary)
        }
    }
    
    return restartNeeded
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
                $('#autoCheckUpdates').prop(
                    'checked',
                    data.systemSettings && typeof data.systemSettings.autoCheckUpdates === 'boolean'
                        ? data.systemSettings.autoCheckUpdates
                        : true
                )
                $('#autoInstallUpdates').prop(
                    'checked',
                    !!(data.systemSettings && data.systemSettings.autoInstallUpdates)
                )
                
                // Load enhanced configuration fields
                $('#clessHostname').val(data.hostserver || '')
                $('#corsOptions').val(data.corsproxy || 'N')
                $('#dsId').val(data.id || '')
                
                // Note: Serial key is not populated for security reasons
                // Users must enter it manually when updating
                $('#serialKey').val('')
                $('#serialKey').attr('placeholder', data.serialkey ? 'Current key is set (enter new key to update)' : 'Enter serial key')
                
                if (data.brightness) {
                    // Handle brightness if needed
                }
                
                // Store current configuration for change comparison
                localStorage.setItem('ecless-current-config', JSON.stringify(data))
                
                showToast('Configuration loaded successfully', 'success')
                debug('Configuration loaded:', {
                    hostserver: data.hostserver,
                    corsproxy: data.corsproxy,
                    dsid: data.id,
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
        },
        complete: function () {
            completeThrottledAction('shutdown')
        }
    })
}

function reboot() {
    $.ajax({
        type: 'get',
        url: '/api/reboot',
        success: function (data) {
            showAlert('success', 'System reboot initiated')
        },
        complete: function () {
            completeThrottledAction('reboot')
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
        },
        complete: function () {
            completeThrottledAction('refresh')
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
        },
        complete: function () {
            completeThrottledAction('restartapp')
        }
    })
}

// Auto-relaunch function for configuration save with user confirmation
function triggerAutoRelaunchAfterConfigSave() {
    // Show immediate confirmation with countdown
    showToast('Configuration saved! Application will restart automatically to apply changes...', 'success')
    
    // Show confirmation dialog with clear explanation
    const shouldRestart = confirm(
        'Configuration has been saved successfully!\n\n' +
        'The application will restart automatically in 5 seconds to apply the new settings.\n\n' +
        'Click OK to restart immediately, or Cancel to restart manually later.\n\n' +
        'Note: If you cancel, some settings may not take effect until you restart manually.'
    )
    
    if (shouldRestart) {
        // User confirmed - restart immediately
        showToast('Restarting application to apply configuration changes...', 'info')
        executeConfigurationRelaunch()
    } else {
        // User cancelled - show persistent reminder
        showToast('Configuration saved. Please restart the application manually to apply all changes.', 'warning')
        
        // Still offer auto-restart countdown for convenience
        let countdown = 5
        let countdownActive = true
        
        const countdownToast = setInterval(() => {
            if (!countdownActive) {
                clearInterval(countdownToast)
                return
            }
            
            if (countdown > 0) {
                showToast(`Auto-restart in ${countdown}s (click anywhere to cancel)`, 'info')
                countdown--
            } else {
                clearInterval(countdownToast)
                countdownActive = false
                if (document.hasFocus()) {
                    showToast('Initiating automatic restart to apply configuration changes...', 'warning')
                    executeConfigurationRelaunch()
                } else {
                    showToast('Auto-restart cancelled (window not in focus). Please restart manually.', 'info')
                }
            }
        }, 1000)
        
        // Allow user to cancel by clicking anywhere or pressing a key
        const cancelCountdown = () => {
            if (countdownActive) {
                countdownActive = false
                clearInterval(countdownToast)
                showToast('Auto-restart cancelled. Please restart manually to apply configuration changes.', 'info')
                $(document).off('click keydown', cancelCountdown)
            }
        }
        
        $(document).one('click keydown', cancelCountdown)
    }
}

// Execute the actual configuration relaunch
function executeConfigurationRelaunch() {
    console.log('=== CONTROL PANEL: Executing configuration-triggered relaunch ===')
    
    // Store restart state for post-restart tracking
    localStorage.setItem('ecless-restart-initiated', Date.now().toString())
    localStorage.setItem('ecless-restart-button-state', 'restarting')
    localStorage.setItem('ecless-restart-reason', 'configuration-save')
    
    // Disable Save Configuration button to prevent double-clicks
    const saveBtn = $('#saveConfig')
    if (saveBtn.length) {
        saveBtn.addClass('loading').prop('disabled', true)
        saveBtn.html('<i class="bi bi-bootstrap-reboot"></i> Applying Changes...')
    }
    
    // Show countdown feedback with enhanced messaging
    showToast('Applying configuration changes - Application restarting in 3 seconds...', 'warning')
    
    // Check connection status before making the restart request
    if (!socket || !socket.connected) {
        console.warn('Socket connection not available, attempting direct restart')
        showToast('Connection issue detected. Attempting alternative restart method...', 'warning')
    }
    
    $.ajax({
        type: 'get',
        url: '/api/restartapp',
        timeout: 15000, // Increased timeout for restart operations
        beforeSend: function() {
            console.log('=== CONTROL PANEL: Sending restart request ===')
        },
        success: function (data) {
            console.log('=== CONTROL PANEL: Restart request successful ===', data)
            
            if (data.status === 'success') {
                showToast('Configuration applied successfully! Application is restarting...', 'success')
                
                // Show visual feedback that restart is happening
                $('body').append(`
                    <div id="restart-overlay" style="
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.8);
                        color: white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 9999;
                        font-size: 1.5rem;
                        text-align: center;
                    ">
                        <div>
                            <i class="bi bi-bootstrap-reboot" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                            <br>
                            Configuration Applied Successfully
                            <br>
                            <small style="font-size: 1rem; opacity: 0.8;">Application restarting...</small>
                        </div>
                    </div>
                `)
                
                // Set up a fallback timeout in case restart doesn't work as expected
                setTimeout(() => {
                    if (document.getElementById('restart-overlay')) {
                        $('#restart-overlay').remove()
                        showToast('Restart may have failed. Please check if the application restarted or restart manually.', 'warning')
                        
                        // Re-enable save button
                        if (saveBtn.length) {
                            saveBtn.removeClass('loading').prop('disabled', false)
                            saveBtn.html('<i class="bi bi-check-circle"></i> Save Configuration')
                        }
                        
                        // Clear restart state
                        localStorage.removeItem('ecless-restart-initiated')
                        localStorage.removeItem('ecless-restart-button-state')
                        localStorage.removeItem('ecless-restart-reason')
                    }
                }, 10000) // 10 second fallback
            } else {
                throw new Error(data.message || 'Restart request failed')
            }
        },
        error: function (xhr, status, error) {
            console.error('=== CONTROL PANEL: Configuration restart failed ===', status, error)
            
            // Re-enable save button
            if (saveBtn.length) {
                saveBtn.removeClass('loading').prop('disabled', false)
                saveBtn.html('<i class="bi bi-check-circle"></i> Save Configuration')
            }
            
            // Clear restart state on error
            localStorage.removeItem('ecless-restart-initiated')
            localStorage.removeItem('ecless-restart-button-state')
            localStorage.removeItem('ecless-restart-reason')
            
            let errorMessage = 'Failed to restart application after configuration save'
            
            if (status === 'timeout') {
                errorMessage = 'Application restart request timed out. Configuration has been saved, but please restart manually to apply all changes.'
            } else if (xhr.status === 404) {
                errorMessage = 'Restart service not available. Configuration saved, but please restart the application manually.'
            } else if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = `Configuration restart failed: ${xhr.responseJSON.message}. Please restart manually to apply changes.`
            } else if (error) {
                errorMessage = `Configuration restart error: ${error}. Please restart manually to apply changes.`
            }
            
            showToast(errorMessage, 'error')
            
            // Offer manual restart instructions
            const manualRestartHelp = confirm(
                'Configuration has been saved successfully, but automatic restart failed.\n\n' +
                'To apply all changes, please:\n' +
                '1. Close the eCLESS Player application\n' +
                '2. Restart the application manually\n\n' +
                'Click OK to see the control panel again, or Cancel to continue.'
            )
            
            if (manualRestartHelp) {
                // Just acknowledge, configuration is already saved
                showToast('Configuration saved. Remember to restart the application manually.', 'info')
            }
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
            completeThrottledAction('refreshLayout')
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

    const specialTypes = ['ticker', 'scroller', 'fader', 'date', 'time', 'datetime', 'html', 'table']
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
                    ${slot.type === 'ticker' ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Speed:</span>
                        <span class="detail-value">${slot.tickerSpeed || 'Default'}</span>
                    </div>
                    <div class="slot-detail-item">
                        <span class="detail-label">Direction:</span>
                        <span class="detail-value">${slot.tickerDirection || 'left'}</span>
                    </div>
                    ` : ''}
                    ${slot.type === 'scroller' ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Speed:</span>
                        <span class="detail-value">${slot.scrollSpeed || 'Default'}</span>
                    </div>
                    <div class="slot-detail-item">
                        <span class="detail-label">Direction:</span>
                        <span class="detail-value">${slot.scrollDirection || 'up'}</span>
                    </div>
                    ` : ''}
                    ${slot.type === 'fader' ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Speed:</span>
                        <span class="detail-value">${slot.fadeSpeed || 'Default'}</span>
                    </div>
                    <div class="slot-detail-item">
                        <span class="detail-label">Duration:</span>
                        <span class="detail-value">${slot.fadeDuration || 'Default'}</span>
                    </div>
                    ` : ''}
                    ${slot.type === 'date' ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Format:</span>
                        <span class="detail-value">${slot.dateFormat || 'DD/MM/YYYY'}</span>
                    </div>
                    ${slot.timezone ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Timezone:</span>
                        <span class="detail-value">${slot.timezone}</span>
                    </div>
                    ` : ''}
                    ` : ''}
                    ${slot.type === 'time' ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Format:</span>
                        <span class="detail-value">${slot.timeFormat || 'HH:MM:SS'}</span>
                    </div>
                    ${slot.timezone ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Timezone:</span>
                        <span class="detail-value">${slot.timezone}</span>
                    </div>
                    ` : ''}
                    ` : ''}
                    ${slot.type === 'datetime' ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Format:</span>
                        <span class="detail-value">${slot.dateTimeFormat || 'YYYY-MM-DD HH:mm:ss'}</span>
                    </div>
                    ${slot.timezone ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Timezone:</span>
                        <span class="detail-value">${slot.timezone}</span>
                    </div>
                    ` : ''}
                    ` : ''}
                    ${slot.type === 'html' ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Type:</span>
                        <span class="detail-value">HTML Content</span>
                    </div>
                    ` : ''}
                    ${slot.type === 'table' ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Columns:</span>
                        <span class="detail-value">${slot.tableColumns || 'N/A'}</span>
                    </div>
                    <div class="slot-detail-item">
                        <span class="detail-label">Rows:</span>
                        <span class="detail-value">${slot.tableRows || 'N/A'}</span>
                    </div>
                    ${slot.dataSoource ? `
                    <div class="slot-detail-item">
                        <span class="detail-label">Data Source:</span>
                        <span class="detail-value">${slot.dataSoource}</span>
                    </div>
                    ` : ''}
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
                ${layoutData.tickerSlots ? `
                <div class="summary-stat">
                    <div class="stat-value">${layoutData.tickerSlots}</div>
                    <div class="stat-label">Ticker Slots</div>
                </div>
                ` : ''}
                ${layoutData.scrollerSlots ? `
                <div class="summary-stat">
                    <div class="stat-value">${layoutData.scrollerSlots}</div>
                    <div class="stat-label">Scroller Slots</div>
                </div>
                ` : ''}
                ${layoutData.faderSlots ? `
                <div class="summary-stat">
                    <div class="stat-value">${layoutData.faderSlots}</div>
                    <div class="stat-label">Fader Slots</div>
                </div>
                ` : ''}
                ${layoutData.dateSlots ? `
                <div class="summary-stat">
                    <div class="stat-value">${layoutData.dateSlots}</div>
                    <div class="stat-label">Date Slots</div>
                </div>
                ` : ''}
                ${layoutData.timeSlots ? `
                <div class="summary-stat">
                    <div class="stat-value">${layoutData.timeSlots}</div>
                    <div class="stat-label">Time Slots</div>
                </div>
                ` : ''}
                ${layoutData.datetimeSlots ? `
                <div class="summary-stat">
                    <div class="stat-value">${layoutData.datetimeSlots}</div>
                    <div class="stat-label">DateTime Slots</div>
                </div>
                ` : ''}
                ${layoutData.htmlSlots ? `
                <div class="summary-stat">
                    <div class="stat-value">${layoutData.htmlSlots}</div>
                    <div class="stat-label">HTML Slots</div>
                </div>
                ` : ''}
                ${layoutData.tableSlots ? `
                <div class="summary-stat">
                    <div class="stat-value">${layoutData.tableSlots}</div>
                    <div class="stat-label">Table Slots</div>
                </div>
                ` : ''}
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

function getAPITicker() {
    const $element = $('#apiTicker')
    $element.addClass('loading')
    $element.html(`
        <div class="alert-modern alert-info">
            <i class="bi bi-text-left"></i>
            <strong>Ticker slots will load from layout data</strong>
        </div>
    `)
    $element.removeClass('loading')
}

function getAPIScroller() {
    const $element = $('#apiScroller')
    $element.addClass('loading')
    $element.html(`
        <div class="alert-modern alert-info">
            <i class="bi bi-text-paragraph"></i>
            <strong>Scroller slots will load from layout data</strong>
        </div>
    `)
    $element.removeClass('loading')
}

function getAPIFader() {
    const $element = $('#apiFader')
    $element.addClass('loading')
    $element.html(`
        <div class="alert-modern alert-info">
            <i class="bi bi-brightness-alt-high"></i>
            <strong>Fader slots will load from layout data</strong>
        </div>
    `)
    $element.removeClass('loading')
}

function getAPIDate() {
    const $element = $('#apiDate')
    $element.addClass('loading')
    $element.html(`
        <div class="alert-modern alert-info">
            <i class="bi bi-calendar-date"></i>
            <strong>Date slots will load from layout data</strong>
        </div>
    `)
    $element.removeClass('loading')
}

function getAPITime() {
    const $element = $('#apiTime')
    $element.addClass('loading')
    $element.html(`
        <div class="alert-modern alert-info">
            <i class="bi bi-clock"></i>
            <strong>Time slots will load from layout data</strong>
        </div>
    `)
    $element.removeClass('loading')
}

function getAPIDateTime() {
    const $element = $('#apiDateTime')
    $element.addClass('loading')
    $element.html(`
        <div class="alert-modern alert-info">
            <i class="bi bi-calendar-event"></i>
            <strong>DateTime slots will load from layout data</strong>
        </div>
    `)
    $element.removeClass('loading')
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

function gettickerslot() {
    console.log('=== CONTROL PANEL: Requesting ticker slots ===')
    socket.emit('reqtickerslot', 'get ticker slot')
}

function getscrollerslot() {
    console.log('=== CONTROL PANEL: Requesting scroller slots ===')
    socket.emit('reqscrollerslot', 'get scroller slot')
}

function getfaderslot() {
    console.log('=== CONTROL PANEL: Requesting fader slots ===')
    socket.emit('reqfaderslot', 'get fader slot')
}

function getdateslot() {
    console.log('=== CONTROL PANEL: Requesting date slots ===')
    socket.emit('reqdateslot', 'get date slot')
}

function gettimeslot() {
    console.log('=== CONTROL PANEL: Requesting time slots ===')
    socket.emit('reqtimeslot', 'get time slot')
}

function getdatetimeslot() {
    console.log('=== CONTROL PANEL: Requesting datetime slots ===')
    socket.emit('reqdatetimeslot', 'get datetime slot')
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

// Enhanced configuration functions - DUPLICATE FUNCTION REMOVED
// The comprehensive saveConfiguration() function is already defined above at line 1021
// This duplicate was overriding the comprehensive version and causing the Save Configuration bug
// The comprehensive version properly merges with existing config.json and preserves all fields

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

// Ticker slot event handler
socket.on('cpanel-tickerslot', function (msg) {
    $('#replaceTickerList').empty()
    $('#replaceTickerList').append($('<option>', {
        value: '',
        text: 'Open this to select ticker slot. [Layout Name - ID] Slot Name (Ticker) | Slot Text'
    }))
    
    if (msg && Array.isArray(msg)) {
        msg.forEach(function(slot) {
            $('#replaceTickerList').append($('<option>', {
                value: slot.name,
                text: `[${slot.layout} - ${slot.layoutid}] ${slot.name} (${slot.slottype}) | ${slot.text}`,
                class: slot.layoutid
            }))
        })
        
        var count = msg.length
        $('#apiTicker').html(`
            <div class="alert-modern alert-success">
                <i class="bi bi-text-left"></i>
                <strong>${count} ticker slot${count !== 1 ? 's' : ''} available</strong>
            </div>
        `)
    }
})

// Scroller slot event handler
socket.on('cpanel-scrollerslot', function (msg) {
    $('#replaceScrollerList').empty()
    $('#replaceScrollerList').append($('<option>', {
        value: '',
        text: 'Open this to select scroller slot. [Layout Name - ID] Slot Name (Scroller) | Slot Text'
    }))
    
    if (msg && Array.isArray(msg)) {
        msg.forEach(function(slot) {
            $('#replaceScrollerList').append($('<option>', {
                value: slot.name,
                text: `[${slot.layout} - ${slot.layoutid}] ${slot.name} (${slot.slottype}) | ${slot.text}`,
                class: slot.layoutid
            }))
        })
        
        var count = msg.length
        $('#apiScroller').html(`
            <div class="alert-modern alert-success">
                <i class="bi bi-text-paragraph"></i>
                <strong>${count} scroller slot${count !== 1 ? 's' : ''} available</strong>
            </div>
        `)
    }
})

// Fader slot event handler
socket.on('cpanel-faderslot', function (msg) {
    $('#replaceFaderList').empty()
    $('#replaceFaderList').append($('<option>', {
        value: '',
        text: 'Open this to select fader slot. [Layout Name - ID] Slot Name (Fader) | Slot Text'
    }))
    
    if (msg && Array.isArray(msg)) {
        msg.forEach(function(slot) {
            $('#replaceFaderList').append($('<option>', {
                value: slot.name,
                text: `[${slot.layout} - ${slot.layoutid}] ${slot.name} (${slot.slottype}) | ${slot.text}`,
                class: slot.layoutid
            }))
        })
        
        var count = msg.length
        $('#apiFader').html(`
            <div class="alert-modern alert-success">
                <i class="bi bi-brightness-alt-high"></i>
                <strong>${count} fader slot${count !== 1 ? 's' : ''} available</strong>
            </div>
        `)
    }
})

// Date slot event handler
socket.on('cpanel-dateslot', function (msg) {
    $('#dateSlotList').empty()
    $('#dateSlotList').append($('<option>', {
        value: '',
        text: 'Open this to view date slots. [Layout Name - ID] Slot Name | Format'
    }))
    
    if (msg && Array.isArray(msg)) {
        msg.forEach(function(slot) {
            $('#dateSlotList').append($('<option>', {
                value: slot.name,
                text: `[${slot.layout} - ${slot.layoutid}] ${slot.name} (${slot.slottype}) | Format: ${slot.format}`,
                class: slot.layoutid
            }))
        })
        
        var count = msg.length
        $('#apiDate').html(`
            <div class="alert-modern alert-success">
                <i class="bi bi-calendar-date"></i>
                <strong>${count} date slot${count !== 1 ? 's' : ''} available</strong>
            </div>
        `)
    }
})

// Time slot event handler
socket.on('cpanel-timeslot', function (msg) {
    $('#timeSlotList').empty()
    $('#timeSlotList').append($('<option>', {
        value: '',
        text: 'Open this to view time slots. [Layout Name - ID] Slot Name | Format'
    }))
    
    if (msg && Array.isArray(msg)) {
        msg.forEach(function(slot) {
            $('#timeSlotList').append($('<option>', {
                value: slot.name,
                text: `[${slot.layout} - ${slot.layoutid}] ${slot.name} (${slot.slottype}) | Format: ${slot.format}`,
                class: slot.layoutid
            }))
        })
        
        var count = msg.length
        $('#apiTime').html(`
            <div class="alert-modern alert-success">
                <i class="bi bi-clock"></i>
                <strong>${count} time slot${count !== 1 ? 's' : ''} available</strong>
            </div>
        `)
    }
})

// DateTime slot event handler
socket.on('cpanel-datetimeslot', function (msg) {
    $('#datetimeSlotList').empty()
    $('#datetimeSlotList').append($('<option>', {
        value: '',
        text: 'Open this to view datetime slots. [Layout Name - ID] Slot Name | Format'
    }))
    
    if (msg && Array.isArray(msg)) {
        msg.forEach(function(slot) {
            $('#datetimeSlotList').append($('<option>', {
                value: slot.name,
                text: `[${slot.layout} - ${slot.layoutid}] ${slot.name} (${slot.slottype}) | Format: ${slot.format}`,
                class: slot.layoutid
            }))
        })
        
        var count = msg.length
        $('#apiDateTime').html(`
            <div class="alert-modern alert-success">
                <i class="bi bi-calendar-event"></i>
                <strong>${count} datetime slot${count !== 1 ? 's' : ''} available</strong>
            </div>
        `)
    }
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

// ================================================
// API DOCUMENTATION FUNCTIONS
// ================================================

/**
 * Toggle API documentation visibility
 */
function toggleApiDocumentation() {
    const content = document.getElementById('apiDocumentationContent')
    const icon = document.getElementById('apiDocToggleIcon')
    const text = document.getElementById('apiDocToggleText')
    
    if (content.style.display === 'none') {
        content.style.display = 'block'
        icon.classList.add('rotated')
        text.textContent = 'Hide'
    } else {
        content.style.display = 'none'
        icon.classList.remove('rotated')
        text.textContent = 'Show'
    }
}

/**
 * Copy text to clipboard with user feedback
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function() {
        // Show success feedback
        if (window.showToast) {
            window.showToast('URL copied to clipboard!', 'success')
        } else {
            // Fallback alert if toast system not available
            const originalText = event.target.textContent
            event.target.textContent = 'Copied!'
            event.target.style.background = '#10b981'
            
            setTimeout(() => {
                event.target.textContent = originalText
                event.target.style.background = ''
            }, 2000)
        }
    }).catch(function(err) {
        console.error('Failed to copy text: ', err)
        if (window.showToast) {
            window.showToast('Failed to copy URL', 'error')
        }
    })
}

/**
 * Copy generated URL from the URL builder (simplified)
 */
function copyGeneratedUrl() {
    // URL Builder functionality removed for simplification
    console.log('URL Builder functionality has been removed')
    if (window.showToast) {
        window.showToast('URL Builder functionality has been simplified. Use the copy buttons in the API examples.', 'info')
    }
}

/**
 * Test the generated URL by making an actual API call (simplified)
 */
function testGeneratedUrl() {
    // URL Builder functionality removed for simplification
    console.log('URL Builder functionality has been removed')
    if (window.showToast) {
        window.showToast('URL Builder functionality has been simplified. Use the API examples to test endpoints.', 'info')
    }
}

/**
 * Update URL builder based on selected endpoint (simplified)
 */
function updateUrlBuilder() {
    // URL Builder functionality removed for simplification
    console.log('URL Builder functionality has been removed')
}

/**
 * Generate API URL based on current parameters (simplified)
 */
function generateApiUrl() {
    // URL Builder functionality removed for simplification
    console.log('URL Builder functionality has been removed')
}

/**
 * Initialize API documentation event handlers (simplified)
 */
function initializeApiDocumentation() {
    // Simplified - no URL builder functionality
    debug('API documentation initialized (simplified version)')
}

/**
 * Toggle help panels for individual sections
 */
function toggleLayoutHelp() {
    const helpPanel = document.getElementById('layoutSwitchingHelp')
    if (helpPanel.style.display === 'none') {
        helpPanel.style.display = 'block'
    } else {
        helpPanel.style.display = 'none'
    }
}

function toggleTextHelp() {
    const helpPanel = document.getElementById('textManagementHelp')
    if (helpPanel.style.display === 'none') {
        helpPanel.style.display = 'block'
    } else {
        helpPanel.style.display = 'none'
    }
}

function toggleMediaHelp() {
    const helpPanel = document.getElementById('mediaManagementHelp')
    if (helpPanel.style.display === 'none') {
        helpPanel.style.display = 'block'
    } else {
        helpPanel.style.display = 'none'
    }
}

function toggleTickerHelp() {
    const helpPanel = document.getElementById('tickerManagementHelp')
    if (helpPanel.style.display === 'none') {
        helpPanel.style.display = 'block'
    } else {
        helpPanel.style.display = 'none'
    }
}

function toggleScrollerHelp() {
    const helpPanel = document.getElementById('scrollerManagementHelp')
    if (helpPanel.style.display === 'none') {
        helpPanel.style.display = 'block'
    } else {
        helpPanel.style.display = 'none'
    }
}

function toggleFaderHelp() {
    const helpPanel = document.getElementById('faderManagementHelp')
    if (helpPanel.style.display === 'none') {
        helpPanel.style.display = 'block'
    } else {
        helpPanel.style.display = 'none'
    }
}

/**
 * Initialize Bootstrap tooltips for enhanced user guidance (Safe Implementation)
 */
function initializeTooltips() {
    try {
        // Check if jQuery and Bootstrap are available
        if (typeof $ !== 'undefined' && typeof $.fn.tooltip === 'function') {
            // Use jQuery tooltip as fallback (doesn't require Popper.js)
            $('[data-bs-toggle="tooltip"], [data-toggle="tooltip"], [title]').each(function() {
                try {
                    $(this).tooltip({
                        delay: { "show": 500, "hide": 100 },
                        trigger: 'hover focus',
                        placement: 'auto'
                    });
                } catch (tooltipError) {
                    // Individual tooltip failure shouldn't break the loop
                    console.warn('Failed to initialize tooltip for element:', this, tooltipError);
                }
            });
            debug('jQuery-based tooltips initialized successfully');
        } else {
            // Fallback: Use native title attributes and simple hover effects
            const elementsWithTooltips = document.querySelectorAll('[data-bs-toggle="tooltip"], [data-toggle="tooltip"], [title]');
            elementsWithTooltips.forEach(function(element) {
                // Ensure title attribute exists for native tooltip
                const tooltipText = element.getAttribute('data-bs-title') || 
                                   element.getAttribute('title') || 
                                   element.getAttribute('data-original-title');
                if (tooltipText && !element.getAttribute('title')) {
                    element.setAttribute('title', tooltipText);
                }
            });
            debug('Native tooltips initialized:', elementsWithTooltips.length);
        }
    } catch (error) {
        console.warn('Tooltip initialization failed, using native fallback:', error);
        // Even if everything fails, ensure we don't break the application
        debug('Using native browser tooltips as final fallback');
    }
}
