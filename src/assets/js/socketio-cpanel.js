// ========================================
// OFFLINE-FIRST ARCHITECTURE IMPROVEMENTS SUMMARY
// ========================================
//
// This file has been professionally refactored to eliminate all AJAX dependencies
// and implement a comprehensive offline-first architecture for the eCLESS Player.
//
// PERFORMANCE OPTIMIZATIONS ADDED:
// - Timer management to prevent memory leaks
// - Debounced event handling
// - Optimized localStorage operations
// - Reduced synchronization frequency
// - Async/await patterns for better performance
//
// ========================================

// Initialize socket connection with configurable server address
var socket = null;

function initializeSocketConnection() {
    try {
        // Get sync configuration from config
        let syncConfig = {};
        if (typeof config !== 'undefined' && config.syncSettings) {
            syncConfig = config.syncSettings;
        }
        
        // Determine server address and port
        const serverAddress = syncConfig.masterServerAddress || 'localhost';
        const serverPort = syncConfig.masterServerPort || 9000;
        const socketUrl = `https://${serverAddress}:${serverPort}`;
        
        console.log('=== SOCKET: Connecting to:', socketUrl);
        socket = io(socketUrl);
        
        console.log('=== RENDERER PROCESS: Socket created, registering ===');
        socket.emit('save id', 'eCLESS:renderer-process');
        
        return socket;
    } catch (error) {
        console.error('=== SOCKET: Failed to initialize connection:', error);
        // Fallback to localhost
        console.log('=== SOCKET: Falling back to localhost:9000');
        socket = io('https://localhost:9000');
        socket.emit('save id', 'eCLESS:renderer-process');
        return socket;
    }
}

// Initialize socket connection
if (!socket) {
    socket = initializeSocketConnection();
}

console.log('=== RENDERER PROCESS: Socket initialized ===');

// Debounced socket handlers to reduce CPU usage
const debouncedHandlers = new Map()

function createDebouncedHandler(name, handler, delay = 100) {
    return function(...args) {
        if (debouncedHandlers.has(name)) {
            clearTimeout(debouncedHandlers.get(name))
        }
        
        const timeoutId = setTimeout(() => {
            handler.apply(this, args)
            debouncedHandlers.delete(name)
        }, delay)
        
        debouncedHandlers.set(name, timeoutId)
    }
}

socket.on('connect', function () {
    console.log('=== RENDERER PROCESS: Connected to socket server ===')
    
    // Request initial display configuration when connected
    socket.emit('request-display-config', { timestamp: new Date().toISOString() })
})

socket.on('disconnect', function () {
    console.log('=== RENDERER PROCESS: Disconnected from socket server ===')
})

// Enhanced multi-display event handlers
socket.on('display-change', function (changeEvent) {
    console.log('=== RENDERER PROCESS: Display configuration change detected ===')
    console.log('Event type:', changeEvent.eventType)
    console.log('New configuration:', changeEvent.newConfig)
    
    try {
        // Update global display data
        if (window.currentDisplayData) {
            window.currentDisplayData = changeEvent.newConfig
        }
        
        // Trigger display orientation manager update if available
        if (window.displayOrientationManager) {
            window.displayOrientationManager.detectDisplayOrientation()
        }
        
        // Update any UI elements that show display information
        if (typeof updateDisplayInfo === 'function') {
            updateDisplayInfo(changeEvent.newConfig)
        }
        
        // Show notification to user about display change
        if (window.showToast) {
            const message = changeEvent.newConfig.hasMultipleDisplays ? 
                `Multi-display configuration updated: ${changeEvent.newConfig.combinedResolution} (${changeEvent.newConfig.arrangement})` :
                `Display configuration updated: ${changeEvent.newConfig.combinedResolution}`
            
            showToast(message, 'info', 5000)
        }
        
        console.log('=== RENDERER PROCESS: Display change handling completed ===')
        
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error handling display change ===', error)
    }
})

socket.on('display-configuration-updated', function (updateEvent) {
    console.log('=== RENDERER PROCESS: Display configuration updated ===')
    console.log('Update type:', updateEvent.type)
    console.log('Updated data:', updateEvent.data)
    
    try {
        // Store the updated configuration
        window.currentDisplayData = updateEvent.data
        
        // Trigger orientation manager refresh
        if (window.displayOrientationManager) {
            window.displayOrientationManager.multiDisplayConfig = {
                hasMultipleDisplays: updateEvent.data.hasMultipleDisplays,
                combinedResolution: updateEvent.data.combinedResolution,
                arrangement: updateEvent.data.arrangement,
                displayCount: updateEvent.data.displayCount
            }
            window.displayOrientationManager.detectDisplayOrientation()
        }
        
        console.log('=== RENDERER PROCESS: Display configuration update applied ===')
        
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error applying display configuration update ===', error)
    }
})

socket.on('display-config-response', function (response) {
    console.log('=== RENDERER PROCESS: Display config response received ===')
    
    if (response.success) {
        console.log('Display configuration:', response.data)
        
        // Store the display configuration globally
        window.currentDisplayData = response.data
        
        // Update display orientation manager if available
        if (window.displayOrientationManager && response.data.multiDisplaySummary) {
            window.displayOrientationManager.multiDisplayConfig = {
                hasMultipleDisplays: response.data.multiDisplaySummary.hasMultipleDisplays,
                combinedResolution: {
                    width: response.data.multiDisplaySummary.combinedWidth,
                    height: response.data.multiDisplaySummary.combinedHeight,
                    formatted: response.data.multiDisplaySummary.combinedResolution
                },
                arrangement: response.data.multiDisplaySummary.arrangement,
                displayCount: response.data.multiDisplaySummary.totalDisplays
            }
            window.displayOrientationManager.detectDisplayOrientation()
        }
    } else {
        console.error('Failed to get display configuration:', response.error)
    }
})

socket.on('system-info-update', function (updateData) {
    if (updateData.type === 'display') {
        console.log('=== RENDERER PROCESS: Display system info update received ===')
        
        // Handle display-specific system info updates
        window.currentDisplayData = updateData.data
        
        if (window.displayOrientationManager) {
            window.displayOrientationManager.detectDisplayOrientation()
        }
    }
})

//refresh ecless
socket.on('refresh-ecless', function (msg) {
    appname = ipcRenderer.send('app-refresh')
})

//restart ecless
socket.on('restart-ecless', function (msg) {
    appname = ipcRenderer.send('app-reload')
})

//resume layout functionality
socket.on('resume-layout', function (msg) {
    console.log('=== RENDERER PROCESS: resume-layout REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);
    console.log('=== RENDERER PROCESS: isLoopLyt status:', isLoopLyt);

    try {
        // Validate message structure
        if (!msg || typeof msg !== 'object') {
            console.error('=== RENDERER PROCESS: Invalid resume-layout message format ===');
            return;
        }

        var action = msg.action;
        var timestamp = msg.timestamp;
        console.log('=== RENDERER PROCESS: Resume layout action:', action, 'timestamp:', timestamp);

        // Validate required global variables and functions are available
        if (typeof isLoopLyt === 'undefined') {
            console.error('=== RENDERER PROCESS: isLoopLyt variable not defined ===');
            return;
        }

        if (isLoopLyt) {
            // Validate loop-specific functions and variables
            if (typeof pauseLoopTimeout !== 'function') {
                console.error('=== RENDERER PROCESS: pauseLoopTimeout function not available for loop layout ===');
                return;
            }

            if (typeof loopTimeout === 'undefined') {
                console.warn('=== RENDERER PROCESS: loopTimeout variable not defined ===');
            }

            // For loop layouts, pause current timeout first
            console.log('=== RENDERER PROCESS: Pausing loop timeout for resume operation ===');
            var paused = pauseLoopTimeout('resume layout operation');
            console.log('=== RENDERER PROCESS: Loop timeout paused successfully:', paused);

            // Refresh current layout and continue
            refreshAndResumeLayout();
        } else {
            // For single layouts, validate getxml function
            if (typeof getxml !== 'function') {
                console.error('=== RENDERER PROCESS: getxml function not available for single layout ===');
                return;
            }

            // For single layouts, just refresh the layout
            console.log('=== RENDERER PROCESS: Refreshing single layout ===');
            refreshAndResumeLayout();
        }

        console.log('=== RENDERER PROCESS: Resume layout request processed successfully ===');
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error processing resume layout request:', error);
        console.error('=== RENDERER PROCESS: Error stack:', error.stack);

        // Emergency cleanup: if we're in an inconsistent state, try to recover
        if (isLoopLyt && typeof resetLoopTimeoutState === 'function') {
            console.log('=== RENDERER PROCESS: Emergency cleanup - resetting loop timeout state ===');
            resetLoopTimeoutState();
        }
    }
})

var allSlotlist

// Helper function to refresh current layout and resume playback
function refreshAndResumeLayout() {
    try {
        console.log('=== RENDERER PROCESS: Starting layout refresh and resume process ===');

        if (isLoopLyt) {
            // For loop layouts, update XML and continue with current layout
            console.log('=== RENDERER PROCESS: Refreshing loop layout XML ===');
            if (typeof layoutLoopUpdateXML === 'function') {
                layoutLoopUpdateXML().then(() => {
                    console.log('=== RENDERER PROCESS: Loop layout XML updated, continuing with current layout ===');

                    // Get current layout data and continue playing
                    if (typeof currentlytID !== 'undefined' && currentlytID && loopArr.length > 0) {
                        // Find current layout in loopArr
                        var currentLayoutData = null;
                        for (var i = 0; i < loopArr.length; i++) {
                            var layoutURL = loopArr[i]['attributes']['url'];
                            var layoutID = layoutURL.split("layout/")[1].slice(0, layoutURL.split("layout/")[1].lastIndexOf('/'));
                            if (layoutID === currentlytID) {
                                currentLayoutData = loopArr[i];
                                break;
                            }
                        }

                        if (currentLayoutData && typeof playcurrentLayout === 'function') {
                            console.log('=== RENDERER PROCESS: Continuing with current layout ID:', currentlytID);
                            playcurrentLayout(currentLayoutData);
                        } else {
                            console.warn('=== RENDERER PROCESS: Current layout data not found, resuming from current position ===');
                            if (typeof resumeLoopTimeout === 'function') {
                                resumeLoopTimeout('layout refresh completed');
                            }
                        }
                    } else {
                        console.warn('=== RENDERER PROCESS: No current layout ID or loop array, resuming timeout ===');
                        if (typeof resumeLoopTimeout === 'function') {
                            resumeLoopTimeout('layout refresh completed');
                        }
                    }
                }).catch((error) => {
                    console.error('=== RENDERER PROCESS: Loop layout XML update failed during resume:', error);
                    // Fallback: resume timeout anyway
                    if (typeof resumeLoopTimeout === 'function') {
                        resumeLoopTimeout('layout refresh failed - fallback resume');
                    }
                });
            } else {
                console.warn('=== RENDERER PROCESS: layoutLoopUpdateXML function not available ===');
                // Fallback: resume timeout
                if (typeof resumeLoopTimeout === 'function') {
                    resumeLoopTimeout('layoutLoopUpdateXML not available');
                }
            }
        } else {
            // For single layouts, refresh XML data
            console.log('=== RENDERER PROCESS: Refreshing single layout XML ===');
            if (typeof getxml === 'function') {
                getxml();
                console.log('=== RENDERER PROCESS: Single layout XML refresh triggered ===');
            } else {
                console.warn('=== RENDERER PROCESS: getxml function not available ===');
            }
        }

        console.log('=== RENDERER PROCESS: Layout refresh and resume process completed ===');
        return true;
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error in layout refresh and resume process:', error);

        // Emergency fallback: if we're in loop mode and paused, try to resume
        if (isLoopLyt && typeof resumeLoopTimeout === 'function') {
            console.log('=== RENDERER PROCESS: Emergency fallback - resuming loop timeout ===');
            resumeLoopTimeout('emergency fallback after error');
        }

        return false;
    }
}

//change ds layout - OFFLINE VERSION
socket.on('updatelayout', function (msg) {
    console.log('=== RENDERER PROCESS: updatelayout REQUEST RECEIVED (OFFLINE MODE) ===');
    console.log('=== RENDERER PROCESS: Message:', msg);
    console.log('=== RENDERER PROCESS: isLoopLyt status:', isLoopLyt);

    var layoutid = msg['id'];
    console.log('=== RENDERER PROCESS: Layout ID:', layoutid);

    // Check if layout exists in localStorage before proceeding
    if (!isLayoutAvailableOffline(layoutid)) {
        console.error('=== RENDERER PROCESS: Layout not available offline:', layoutid);
        console.log('=== RENDERER PROCESS: Available layouts:', getAvailableLayoutsFromDS());

        // Try to find an alternative layout or fallback
        var availableLayouts = getAvailableLayoutsFromDS();
        if (availableLayouts.length > 0) {
            console.warn('=== RENDERER PROCESS: Using first available layout as fallback:', availableLayouts[0].id);
            layoutid = availableLayouts[0].id;
        } else {
            console.error('=== RENDERER PROCESS: No layouts available offline, update failed');
            return;
        }
    }

    // Use offline layout switching
    switchToLayoutOffline(layoutid, function (success, message) {
        if (success) {
            console.log('=== RENDERER PROCESS: updatelayout completed successfully (offline):', message);
        } else {
            console.error('=== RENDERER PROCESS: updatelayout failed (offline):', message);

            // Try emergency fallback to current playing layout if available
            if (currentPlayLayoutID && currentPlayLayoutID !== layoutid && isLayoutAvailableOffline(currentPlayLayoutID)) {
                console.log('=== RENDERER PROCESS: Attempting emergency fallback to current layout:', currentPlayLayoutID);
                switchToLayoutOffline(currentPlayLayoutID, function (fallbackSuccess, fallbackMessage) {
                    if (fallbackSuccess) {
                        console.log('=== RENDERER PROCESS: Emergency fallback successful:', fallbackMessage);
                    } else {
                        console.error('=== RENDERER PROCESS: Emergency fallback also failed:', fallbackMessage);
                    }
                });
            }
        }
    });
})

console.log('=== SOCKETIO-CPANEL.JS FILE START ===')
console.log('Current URL:', window.location.href)
console.log('Socket.io available:', typeof io)

// Global variables - ensure dsid is available from index.html
var dsid = dsid || ''
console.log('=== RENDERER PROCESS: dsid variable:', dsid);

// Global variable for tracking current playing layout ID
var currentPlayLayoutID = null
console.log('=== RENDERER PROCESS: currentPlayLayoutID initialized:', currentPlayLayoutID);

// Initialize currentPlayLayoutID from localStorage on startup
try {
    var storedLayoutID = localStorage.getItem('currentPlayLayoutID');
    if (storedLayoutID) {
        currentPlayLayoutID = storedLayoutID;
        console.log('=== RENDERER PROCESS: currentPlayLayoutID loaded from localStorage:', currentPlayLayoutID);
    }
} catch (error) {
    console.warn('=== RENDERER PROCESS: Failed to load currentPlayLayoutID from localStorage:', error);
}

// Helper function to sync currentPlayLayoutID with layout changes
function syncCurrentPlayLayoutID(layoutID) {
    if (layoutID) {
        try {
            localStorage.setItem('currentPlayLayoutID', layoutID);
            // Update global variable
            currentPlayLayoutID = layoutID;
            console.log('=== RENDERER PROCESS: Synced currentPlayLayoutID to localStorage and global variable:', layoutID);
        } catch (error) {
            console.warn('=== RENDERER PROCESS: Failed to sync currentPlayLayoutID to localStorage:', error);
        }
    }
}

// Helper function to get current layout ID and slot information from DS XML data and slotnameList
function getCurrentLayoutID(slotname, slotnameList) {
    try {
        console.log('=== RENDERER PROCESS: getCurrentLayoutID called with slotname:', slotname);
        console.log('=== RENDERER PROCESS: slotnameList length:', slotnameList ? slotnameList.length : 0);

        // Initialize result object
        var result = {
            layoutid: null,
            slotid: 'slot-1',
            slottype: 'text',
            filterID: null
        };

        // First, try to get slot information from slotnameList if provided
        if (slotnameList && Array.isArray(slotnameList) && slotname) {
            var filterID = slotnameList.filter((e) => e.slotname == slotname);
            console.log('=== RENDERER PROCESS: Filtered slot from slotnameList:', filterID);

            if (filterID && filterID.length > 0) {
                result.filterID = filterID;
                result.layoutid = filterID[0]['layoutid'] || '2';
                result.slotid = filterID[0]['slotid'] || 'slot-1';
                result.slottype = filterID[0]['slottype'] || 'text';
                console.log('=== RENDERER PROCESS: Found slot info from slotnameList:', result);
                return result;
            }
        }

        // If not found in slotnameList, try DS XML approach
        if (typeof dsid !== 'undefined' && dsid) {
            dsxml = JSON.parse(localStorage.getItem(dsid));
            console.log('=== RENDERER PROCESS: DSID XML:', dsxml);
        }

        if (!dsxml || !dsxml.elements || !dsxml.elements[0] || !dsxml.elements[0].elements) {
            console.log('=== RENDERER PROCESS: No valid DS XML found ===');
            return result; // Return with default values
        }

        if (dsxml.elements[0].elements[0].name === 'loop') {
            // Loop layout mode - search through all layouts to find the one containing the slotname
            console.log('=== RENDERER PROCESS: Loop layout detected, searching for slotname across layouts ===');

            if (!slotname) {
                // If no slotname provided, fall back to current layout approach
                if (isLoopLyt && typeof currentlytID !== 'undefined' && currentlytID) {
                    console.log('=== RENDERER PROCESS: No slotname provided, using currentlytID:', currentlytID);
                    result.layoutid = currentlytID;
                    return result;
                }
                // Or use loopArr
                if (typeof loopXMLCurIndex !== 'undefined' && typeof loopArr !== 'undefined' && loopArr.length > 0) {
                    var currentIndex = loopXMLCurIndex > 0 ? loopXMLCurIndex - 1 : 0;
                    if (loopArr[currentIndex] && loopArr[currentIndex].attributes && loopArr[currentIndex].attributes.url) {
                        var layoutURL = loopArr[currentIndex].attributes.url;
                        var layoutID = layoutURL.split("layout/");
                        layoutID = layoutID[1].slice(0, layoutID[1].lastIndexOf('/'));
                        console.log('=== RENDERER PROCESS: Using current layout from loopArr:', layoutID);
                        result.layoutid = layoutID;
                        return result;
                    }
                }
                return result;
            }

            // Get all layout IDs from the loop structure
            var loopElements = dsxml.elements[0].elements[0].elements;
            console.log('=== RENDERER PROCESS: Found', loopElements.length, 'layouts in loop ===');

            // Search through each layout to find the one containing the slotname
            for (var i = 0; i < loopElements.length; i++) {
                var layoutElement = loopElements[i];
                if (layoutElement.attributes && layoutElement.attributes.url) {
                    var layoutURL = layoutElement.attributes.url;
                    var layoutID = layoutURL.split("layout/");
                    layoutID = layoutID[1].slice(0, layoutID[1].lastIndexOf('/'));

                    console.log('=== RENDERER PROCESS: Checking layout:', layoutID, 'for slotname:', slotname);

                    // Try to get layout XML from localStorage
                    var layoutKey = 'layout-offline-' + layoutID;
                    var layoutXML = localStorage.getItem(layoutKey);

                    if (!layoutXML) {
                        layoutKey = 'layout-' + layoutID;
                        layoutXML = localStorage.getItem(layoutKey);
                    }

                    if (layoutXML) {
                        try {
                            var layoutData = JSON.parse(layoutXML);
                            if (layoutData && layoutData.elements && layoutData.elements[0] &&
                                layoutData.elements[0].elements && layoutData.elements[0].elements[0] &&
                                layoutData.elements[0].elements[0].elements && layoutData.elements[0].elements[0].elements[0] &&
                                layoutData.elements[0].elements[0].elements[0].elements) {

                                var slots = layoutData.elements[0].elements[0].elements[0].elements;
                                console.log('=== RENDERER PROCESS: Layout', layoutID, 'has', slots.length, 'slots ===');

                                // Search through slots in this layout
                                for (var j = 0; j < slots.length; j++) {
                                    var slot = slots[j];
                                    if (slot.attributes && slot.attributes.name === slotname) {
                                        console.log('=== RENDERER PROCESS: Found slotname', slotname, 'in layout:', layoutID);
                                        result.layoutid = layoutID;
                                        // Try to extract slot information from XML if available
                                        if (slot.attributes.id) {
                                            result.slotid = 'slot-' + slot.attributes.id;
                                        }
                                        if (slot.name) {
                                            result.slottype = slot.name;
                                        }
                                        return result;
                                    }
                                }
                            }
                        } catch (parseError) {
                            console.warn('=== RENDERER PROCESS: Error parsing layout XML for', layoutID, ':', parseError);
                        }
                    } else {
                        console.warn('=== RENDERER PROCESS: No layout XML found for', layoutID);
                    }
                }
            }

            console.log('=== RENDERER PROCESS: Slotname', slotname, 'not found in any layout ===');
            return result; // Return with default values

        } else {
            // Single layout - get layout ID directly from DS XML
            if (dsxml.elements[0].attributes && dsxml.elements[0].attributes.id) {
                var layoutID = dsxml.elements[0].attributes.id;
                console.log('=== RENDERER PROCESS: Single layout mode, Layout ID:', layoutID);
                result.layoutid = layoutID;
                return result;
            }
        }

        console.log('=== RENDERER PROCESS: Could not extract Layout ID from DS XML ===');
        return result; // Return with default values
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting current layout ID:', error);
        return {
            layoutid: null,
            slotid: 'slot-1',
            slottype: 'text',
            filterID: null
        };
    }
}

// ========================================
// OFFLINE-FIRST LAYOUT MANAGEMENT SYSTEM
// ========================================

// Helper function to get layout data from localStorage without AJAX
function getLayoutFromStorage(layoutId) {
    try {
        console.log('=== OFFLINE LAYOUT: Getting layout from storage:', layoutId);
        console.log('=== OFFLINE LAYOUT: Checking for cached layout data in localStorage');

        // Try to get layout data from localStorage
        var layoutKey = 'layout-' + layoutId;
        var layoutData = localStorage.getItem(layoutKey);

        if (!layoutData) {
            console.log('=== OFFLINE LAYOUT: Primary key not found, trying offline variant');
            // Try offline variant
            layoutKey = 'layout-offline-' + layoutId;
            layoutData = localStorage.getItem(layoutKey);
        }

        if (layoutData) {
            var parsedLayout = JSON.parse(layoutData);
            console.log('=== OFFLINE LAYOUT: Successfully retrieved layout:', layoutId, 'from key:', layoutKey);
            console.log('=== OFFLINE LAYOUT: Layout data size:', layoutData.length, 'bytes');
            return parsedLayout;
        } else {
            console.warn('=== OFFLINE LAYOUT: Layout not found in storage:', layoutId);
            console.warn('=== OFFLINE LAYOUT: Tried keys:', 'layout-' + layoutId, 'and layout-offline-' + layoutId);
            // Log available layouts for debugging
            var availableKeys = [];
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key.startsWith('layout-')) {
                    availableKeys.push(key);
                }
            }
            console.warn('=== OFFLINE LAYOUT: Available layout keys in localStorage:', availableKeys);
            return null;
        }
    } catch (error) {
        console.error('=== OFFLINE LAYOUT: Error retrieving layout from storage:', error);
        return null;
    }
}

// Helper function to validate layout data structure
function validateLayoutData(layoutData) {
    if (!layoutData || !layoutData.elements) {
        return false;
    }

    if (!layoutData.elements[0] || !layoutData.elements[0].elements) {
        return false;
    }

    return true;
}

// Helper function to switch to a layout using only localStorage data
function switchToLayoutOffline(layoutId, callback, isTemporarySwitch) {
    try {
        console.log('=== OFFLINE LAYOUT: ========================================');
        console.log('=== OFFLINE LAYOUT: Switching to layout offline:', layoutId);
        console.log('=== OFFLINE LAYOUT: Temporary switch:', !!isTemporarySwitch);
        console.log('=== OFFLINE LAYOUT: Current loop mode (isLoopLyt):', isLoopLyt);
        console.log('=== OFFLINE LAYOUT: ========================================');

        // Clear current layout state
        if (!isLoopLyt) {
            clearTimeout(refreshTimeout);
            console.log('=== OFFLINE LAYOUT: Cleared refreshTimeout (not in loop layout) ===');
        } else {
            console.log('=== OFFLINE LAYOUT: In loop layout mode, skipping refreshTimeout clear ===');
        }

        // Only clear loopArr if this is NOT a temporary switch during loop mode
        if (!isTemporarySwitch || !isLoopLyt) {
            loopArr = [];
            console.log('=== OFFLINE LAYOUT: Cleared loopArr (permanent switch or not in loop mode) ===');
        } else {
            console.log('=== OFFLINE LAYOUT: Preserving loopArr for temporary switch in loop mode ===');
        }

        $('#main').html('');
        console.log('=== OFFLINE LAYOUT: Cleared main content ===');

        // Get layout data from localStorage
        var layoutData = getLayoutFromStorage(layoutId);

        if (!layoutData) {
            console.error('=== OFFLINE LAYOUT: Layout data not found for ID:', layoutId);
            if (callback) callback(false, 'Layout data not found in localStorage');
            return false;
        }

        if (!validateLayoutData(layoutData)) {
            console.error('=== OFFLINE LAYOUT: Invalid layout data structure for ID:', layoutId);
            if (callback) callback(false, 'Invalid layout data structure');
            return false;
        }

        // Store the layout data (ensure it's in the correct format)
        localStorage.setItem('layout-' + layoutId, JSON.stringify(layoutData));
        console.log('=== OFFLINE LAYOUT: Stored layout XML in localStorage: layout-' + layoutId + ' ===');

        // Get the layout data and render it
        var layoutxml = JSON.parse(localStorage.getItem('layout-' + layoutId));
        console.log('=== OFFLINE LAYOUT: Calling getLayoutXML with layout data ===');
        getLayoutXML(layoutxml);
        console.log('=== OFFLINE LAYOUT: Layout switch completed successfully ===');

        if (callback) callback(true, 'Layout switched successfully');
        return true;

    } catch (error) {
        console.error('=== OFFLINE LAYOUT: Error switching to layout:', error);
        if (callback) callback(false, 'Error: ' + error.message);
        return false;
    }
}

// Helper function to temporarily switch layout for content updates in loop mode
function switchToLayoutTemporarilyInLoop(targetLayoutId, callback) {
    try {
        console.log('=== LOOP TEMP SWITCH: Starting temporary layout switch for content update ===');

        // Store current loop state
        var originalLayoutId = currentPlayLayoutID;
        var originalLoopState = isLoopLyt;
        var originalLoopArr = loopArr ? loopArr.slice() : []; // Copy array

        console.log('=== LOOP TEMP SWITCH: Stored original state - Layout:', originalLayoutId, 'Loop:', originalLoopState);

        // Pause the loop timeout
        var loopWasPaused = false;
        if (typeof pauseLoopTimeout === 'function' && isLoopLyt) {
            loopWasPaused = pauseLoopTimeout('temporary layout switch for content update');
            console.log('=== LOOP TEMP SWITCH: Paused loop timeout, success:', loopWasPaused);
        }

        // Temporarily switch to target layout
        switchToLayoutOffline(targetLayoutId, function (switchSuccess, switchMessage) {

            if (switchSuccess) {
                console.log('=== LOOP TEMP SWITCH: Layout switch successful, executing content update ===');

                // Small delay to ensure content update completes
                setTimeout(function () {
                    console.log('=== LOOP TEMP SWITCH: Content update completed, preparing to restore loop state ===');

                    // Restore loop state
                    isLoopLyt = originalLoopState;
                    loopArr = originalLoopArr;

                    console.log('=== LOOP TEMP SWITCH: Restored loop state - Loop mode:', isLoopLyt, 'LoopArr length:', loopArr.length);

                    if (callback) callback(true, 'Temporary layout switch and content update completed successfully');

                }, 2000); // 500ms delay for content update completion

            } else {
                console.error('=== LOOP TEMP SWITCH: Layout switch failed:', switchMessage);

                if (callback) callback(false, 'Layout switch failed: ' + switchMessage);
            }
        }, false); // Pass true to indicate temporary switch

    } catch (error) {
        console.error('=== LOOP TEMP SWITCH: Error during temporary switch:', error);

        // Resume the loop timeout if it was paused
        if (loopWasPaused && typeof resumeLoopTimeout === 'function') {
            resumeLoopTimeout('temporary layout switch error');
        }

        if (callback) callback(false, 'Error: ' + error.message);
    }
}

// Helper function to detect layout mode (loop vs single)
function detectLayoutMode() {
    try {
        console.log('=== LAYOUT MODE: Detecting layout mode ===');
        
        var resultOffline = JSON.parse(localStorage.getItem(dsid));
        if (!resultOffline || !resultOffline.elements || !resultOffline.elements[0] ||
            !resultOffline.elements[0].elements || !resultOffline.elements[0].elements[0]) {
            console.warn('=== LAYOUT MODE: Invalid or missing DS data structure');
            return { isLoop: false, layoutCount: 0 };
        }

        var layoutType = resultOffline['elements'][0]['elements'][0]['name'];
        var isLoop = layoutType === 'loop';
        var layoutCount = 1;

        if (isLoop) {
            var loopElements = resultOffline['elements'][0]['elements'][0]['elements'];
            layoutCount = loopElements ? loopElements.length : 0;
        }

        console.log('=== LAYOUT MODE: Detected mode:', {
            isLoop: isLoop,
            layoutType: layoutType,
            layoutCount: layoutCount
        });

        return {
            isLoop: isLoop,
            layoutType: layoutType,
            layoutCount: layoutCount
        };

    } catch (error) {
        console.error('=== LAYOUT MODE: Error detecting layout mode:', error);
        return { isLoop: false, layoutCount: 0 };
    }
}

// Enhanced helper function to get available layouts from DS data with comprehensive details
function getAvailableLayoutsFromDS() {
    try {
        console.log('=== OFFLINE LAYOUT: Getting available layouts from DS data ===');

        var resultOffline = JSON.parse(localStorage.getItem(dsid));

        if (!resultOffline) {
            console.warn('=== OFFLINE LAYOUT: No DS data found in localStorage for DSID:', dsid);
            return [];
        }

        var availableLayouts = [];

        // Enhanced validation of data structure
        if (!resultOffline.elements || !Array.isArray(resultOffline.elements) || resultOffline.elements.length === 0) {
            console.error('=== OFFLINE LAYOUT: Invalid DS data structure - missing or empty elements array');
            return [];
        }

        if (!resultOffline.elements[0] || !resultOffline.elements[0].elements || 
            !Array.isArray(resultOffline.elements[0].elements) || resultOffline.elements[0].elements.length === 0) {
            console.error('=== OFFLINE LAYOUT: Invalid DS data structure - missing nested elements');
            return [];
        }

        if (!resultOffline.elements[0].elements[0]) {
            console.error('=== OFFLINE LAYOUT: Invalid DS data structure - missing layout definition');
            return [];
        }

        // Determine layout type (loop vs single) with error handling
        var layoutType = resultOffline['elements'][0]['elements'][0]['name'];
        if (!layoutType) {
            console.error('=== OFFLINE LAYOUT: Cannot determine layout type - missing name attribute');
            return [];
        }

        console.log('=== OFFLINE LAYOUT: Layout type detected:', layoutType);

        if (layoutType == 'loop') {
            // Loop layout - get all layout IDs with enhanced details and validation
            var loopElements = resultOffline['elements'][0]['elements'][0]['elements'];
            
            if (!loopElements || !Array.isArray(loopElements)) {
                console.error('=== OFFLINE LAYOUT: Invalid loop structure - missing or invalid loop elements');
                return [];
            }

            console.log('=== OFFLINE LAYOUT: Found', loopElements.length, 'layouts in loop ===');

            loopElements.forEach(function (layoutElement, index) {
                try {
                    if (!layoutElement || !layoutElement.attributes) {
                        console.warn('=== OFFLINE LAYOUT: Skipping invalid loop element at index', index, '- missing attributes');
                        return;
                    }

                    if (!layoutElement.attributes.url) {
                        console.warn('=== OFFLINE LAYOUT: Skipping loop element at index', index, '- missing URL attribute');
                        return;
                    }

                    var layoutURL = layoutElement.attributes.url;
                    var urlParts = layoutURL.split("layout/");
                    
                    if (urlParts.length < 2) {
                        console.warn('=== OFFLINE LAYOUT: Invalid layout URL format at index', index, ':', layoutURL);
                        return;
                    }

                    var layoutID = urlParts[1].slice(0, urlParts[1].lastIndexOf('/'));
                    
                    if (!layoutID) {
                        console.warn('=== OFFLINE LAYOUT: Could not extract layout ID from URL at index', index, ':', layoutURL);
                        return;
                    }
                    
                    // Extract additional attributes for loop layouts with validation
                    var layoutInfo = {
                        id: layoutID,
                        url: layoutURL,
                        type: 'loop',
                        index: index,
                        name: layoutElement.attributes.name || 'Layout ' + (index + 1),
                        duration: layoutElement.attributes.duration || null,
                        isLoop: true,
                        parentLayoutType: 'loop',
                        hasValidData: true,
                        errors: []
                    };

                    // Validate duration if present
                    if (layoutInfo.duration && isNaN(parseInt(layoutInfo.duration))) {
                        layoutInfo.errors.push('Invalid duration value: ' + layoutInfo.duration);
                        layoutInfo.duration = null;
                    }

                    // Try to get more details from stored layout data with error handling
                    try {
                        var storedLayoutData = getLayoutFromStorage(layoutID);
                        if (storedLayoutData) {
                            layoutInfo.hasStoredData = true;
                            layoutInfo.slotCount = extractSlotCountFromLayout(storedLayoutData);
                        } else {
                            layoutInfo.hasStoredData = false;
                            layoutInfo.slotCount = 0;
                            layoutInfo.errors.push('No stored layout data found');
                        }
                    } catch (storageError) {
                        console.warn('=== OFFLINE LAYOUT: Error accessing stored data for layout', layoutID, ':', storageError);
                        layoutInfo.hasStoredData = false;
                        layoutInfo.slotCount = 0;
                        layoutInfo.errors.push('Error accessing stored data: ' + storageError.message);
                    }

                    availableLayouts.push(layoutInfo);

                } catch (elementError) {
                    console.error('=== OFFLINE LAYOUT: Error processing loop element at index', index, ':', elementError);
                }
            });
        } else {
            // Single layout - get layout ID directly with enhanced details and validation
            try {
                if (!resultOffline.elements[0].attributes) {
                    console.error('=== OFFLINE LAYOUT: Single layout missing attributes');
                    return [];
                }

                var layoutID = resultOffline.elements[0].attributes.id;
                if (!layoutID) {
                    console.error('=== OFFLINE LAYOUT: Single layout missing ID attribute');
                    return [];
                }

                var layoutInfo = {
                    id: layoutID,
                    type: 'single',
                    index: 0,
                    name: resultOffline.elements[0].attributes.name || 'Single Layout',
                    duration: resultOffline.elements[0].attributes.duration || null,
                    isLoop: false,
                    parentLayoutType: 'single',
                    hasValidData: true,
                    errors: []
                };

                // Validate duration if present
                if (layoutInfo.duration && isNaN(parseInt(layoutInfo.duration))) {
                    layoutInfo.errors.push('Invalid duration value: ' + layoutInfo.duration);
                    layoutInfo.duration = null;
                }

                // Try to get more details from stored layout data with error handling
                try {
                    var storedLayoutData = getLayoutFromStorage(layoutID);
                    if (storedLayoutData) {
                        layoutInfo.hasStoredData = true;
                        layoutInfo.slotCount = extractSlotCountFromLayout(storedLayoutData);
                    } else {
                        layoutInfo.hasStoredData = false;
                        layoutInfo.slotCount = 0;
                        layoutInfo.errors.push('No stored layout data found');
                    }
                } catch (storageError) {
                    console.warn('=== OFFLINE LAYOUT: Error accessing stored data for single layout', layoutID, ':', storageError);
                    layoutInfo.hasStoredData = false;
                    layoutInfo.slotCount = 0;
                    layoutInfo.errors.push('Error accessing stored data: ' + storageError.message);
                }

                availableLayouts.push(layoutInfo);

            } catch (singleLayoutError) {
                console.error('=== OFFLINE LAYOUT: Error processing single layout:', singleLayoutError);
                return [];
            }
        }

        console.log('=== OFFLINE LAYOUT: Available layouts with details:', availableLayouts);
        return availableLayouts;

    } catch (error) {
        console.error('=== OFFLINE LAYOUT: Fatal error getting available layouts:', error);
        console.error('=== OFFLINE LAYOUT: Error stack:', error.stack);
        return [];
    }
}

// Helper function to extract slot count from layout data
function extractSlotCountFromLayout(layoutData) {
    try {
        if (!layoutData || !layoutData.elements) {
            return 0;
        }

        var totalSlots = 0;
        var elements = layoutData.elements;

        // Function to recursively count slots in layout structure
        function countSlotsRecursively(element) {
            if (!element) return 0;
            
            var count = 0;
            
            // Check if this element is a slot (has slot-related attributes)
            if (element.attributes && (
                element.attributes.slotname || 
                element.attributes.slottype || 
                element.name === 'text' || 
                element.name === 'media'
            )) {
                count++;
            }
            
            // Recursively check child elements
            if (element.elements && Array.isArray(element.elements)) {
                element.elements.forEach(function(child) {
                    count += countSlotsRecursively(child);
                });
            } else if (element.elements && typeof element.elements === 'object') {
                Object.keys(element.elements).forEach(function(key) {
                    count += countSlotsRecursively(element.elements[key]);
                });
            }
            
            return count;
        }

        // Start counting from the layout elements
        if (Array.isArray(elements)) {
            elements.forEach(function(element) {
                totalSlots += countSlotsRecursively(element);
            });
        } else if (typeof elements === 'object') {
            Object.keys(elements).forEach(function(key) {
                totalSlots += countSlotsRecursively(elements[key]);
            });
        }

        return totalSlots;

    } catch (error) {
        console.warn('=== SLOT COUNT: Error extracting slot count:', error);
        return 0;
    }
}

// Function to get comprehensive details for individual layouts within a loop
function getDetailedLayoutInfo(layoutId, layoutInfo) {
    try {
        console.log('=== DETAILED LAYOUT: Getting details for layout:', layoutId);
        
        var layoutData = getLayoutFromStorage(layoutId);
        if (!layoutData) {
            console.warn('=== DETAILED LAYOUT: No layout data found for:', layoutId);
            return {
                id: layoutId,
                name: layoutInfo ? layoutInfo.name : 'Unknown Layout',
                type: layoutInfo ? layoutInfo.type : 'unknown',
                hasData: false,
                error: 'No layout data available',
                slots: [],
                textSlots: [],
                mediaSlots: [],
                totalSlots: 0
            };
        }

        // Extract comprehensive slot information using enhanced function
        var slotData = extractComprehensiveSlotData(layoutData, layoutId);

        // Extract layout attributes
        var layoutAttributes = {};
        if (layoutData.elements && layoutData.elements.layout && layoutData.elements.layout.attributes) {
            layoutAttributes = layoutData.elements.layout.attributes;
        } else if (slotData.layoutInfo && slotData.layoutInfo.attributes) {
            layoutAttributes = slotData.layoutInfo.attributes;
        }

        var detailedInfo = {
            id: layoutId,
            name: layoutInfo ? layoutInfo.name : (slotData.layoutInfo.name || ('Layout ' + layoutId)),
            type: layoutInfo ? layoutInfo.type : 'unknown',
            hasData: true,
            
            // Layout properties
            duration: layoutInfo ? layoutInfo.duration : null,
            index: layoutInfo ? layoutInfo.index : null,
            isLoop: layoutInfo ? layoutInfo.isLoop : false,
            parentLayoutType: layoutInfo ? layoutInfo.parentLayoutType : 'unknown',
            
            // Layout attributes (dimensions, colors, etc.)
            attributes: layoutAttributes,
            width: layoutAttributes.width || '1920',
            height: layoutAttributes.height || '1080',
            backgroundColor: layoutAttributes.bgcolor || layoutAttributes.backgroundColor || '#000000',
            
            // Enhanced slot information from comprehensive extraction
            slots: slotData.allSlots,
            textSlots: slotData.textSlots,
            mediaSlots: slotData.mediaSlots,
            specialSlots: slotData.specialSlots,
            slotSummary: slotData.slotSummary,
            
            // Backward compatibility
            totalSlots: slotData.slotSummary.total,
            textSlotCount: slotData.slotSummary.text,
            mediaSlotCount: slotData.slotSummary.media,
            
            // Additional metadata
            lastUpdated: new Date().toISOString(),
            dataSource: 'localStorage',
            layoutInfo: slotData.layoutInfo
        };

        console.log('=== DETAILED LAYOUT: Enhanced details extracted for', layoutId, ':', {
            totalSlots: detailedInfo.totalSlots,
            textSlots: detailedInfo.textSlotCount,
            mediaSlots: detailedInfo.mediaSlotCount,
            specialSlots: detailedInfo.specialSlots.length
        });

        return detailedInfo;

    } catch (error) {
        console.error('=== DETAILED LAYOUT: Error getting detailed info for', layoutId, ':', error);
        return {
            id: layoutId,
            name: layoutInfo ? layoutInfo.name : 'Error Layout',
            type: layoutInfo ? layoutInfo.type : 'error',
            hasData: false,
            error: error.message || 'Unknown error',
            slots: [],
            textSlots: [],
            mediaSlots: [],
            totalSlots: 0
        };
    }
}

// Function to get all layouts in a loop with their detailed information
function getAllLoopLayoutDetails() {
    try {
        console.log('=== LOOP LAYOUTS: Getting all loop layout details ===');
        
        var layoutMode = detectLayoutMode();
        var availableLayouts = getAvailableLayoutsFromDS();
        
        if (!layoutMode.isLoop) {
            console.log('=== LOOP LAYOUTS: Not in loop mode, returning single layout details ===');
            if (availableLayouts.length > 0) {
                return [getDetailedLayoutInfo(availableLayouts[0].id, availableLayouts[0])];
            }
            return [];
        }

        var loopLayoutDetails = [];
        availableLayouts.forEach(function(layoutInfo) {
            var detailedInfo = getDetailedLayoutInfo(layoutInfo.id, layoutInfo);
            loopLayoutDetails.push(detailedInfo);
        });

        console.log('=== LOOP LAYOUTS: Retrieved details for', loopLayoutDetails.length, 'layouts in loop ===');
        return loopLayoutDetails;

    } catch (error) {
        console.error('=== LOOP LAYOUTS: Error getting all loop layout details:', error);
        return [];
    }
}

// Helper function to check if layout exists in localStorage
function isLayoutAvailableOffline(layoutId) {
    try {
        var layoutData = getLayoutFromStorage(layoutId);
        return layoutData !== null;
    } catch (error) {
        console.error('=== OFFLINE LAYOUT: Error checking layout availability:', error);
        return false;
    }
}

// Enhanced error handling and recovery functions for offline mode
// Enhanced error recovery for corrupted layout data
function handleCorruptedLayoutData(layoutId, corruptedData) {
    console.warn('=== RENDERER PROCESS: Attempting to recover from corrupted layout data:', layoutId);

    try {
        // Try to repair common data structure issues
        if (corruptedData && typeof corruptedData === 'object') {
            // Check if it's missing root elements but has some structure
            if (!corruptedData.elements && corruptedData.layout) {
                console.log('=== RENDERER PROCESS: Attempting data structure repair');
                return corruptedData.layout;
            }

            // If it has basic structure, try to use it anyway
            if (corruptedData.elements || corruptedData.region) {
                console.warn('=== RENDERER PROCESS: Using potentially incomplete layout data');
                return corruptedData;
            }
        }

        // If repair fails, try fallback layout
        return recoverFromLayoutError(layoutId);
    } catch (error) {
        console.error('=== RENDERER PROCESS: Layout repair failed:', error);
        return recoverFromLayoutError(layoutId);
    }
}

// Critical error recovery function
function recoverFromLayoutError(targetLayoutId) {
    console.error('=== RENDERER PROCESS: Entering critical layout recovery mode for:', targetLayoutId);

    try {
        // Try to find any working layout in localStorage
        var availableLayouts = getAvailableLayoutsFromDS();

        for (var i = 0; i < availableLayouts.length; i++) {
            var layoutId = availableLayouts[i].id;
            if (layoutId !== targetLayoutId) { // Don't retry the same failed layout
                try {
                    var layoutData = localStorage.getItem('layout-' + layoutId);
                    if (layoutData) {
                        var parsedData = JSON.parse(layoutData);
                        if (validateLayoutData(parsedData)) {
                            console.warn('=== RENDERER PROCESS: Emergency fallback to working layout:', layoutId);
                            return parsedData;
                        }
                    }
                } catch (innerError) {
                    console.warn('=== RENDERER PROCESS: Fallback layout also failed:', layoutId, innerError);
                }
            }
        }

        // If all layouts fail, create minimal emergency layout
        console.error('=== RENDERER PROCESS: All layouts failed, creating emergency layout');
        return createEmergencyLayout();

    } catch (error) {
        console.error('=== RENDERER PROCESS: Critical recovery failed:', error);
        return createEmergencyLayout();
    }
}

// Create minimal emergency layout for worst-case scenarios
function createEmergencyLayout() {
    console.warn('=== RENDERER PROCESS: Creating emergency minimal layout');

    return {
        elements: {
            layout: {
                attributes: {
                    width: '1920',
                    height: '1080',
                    bgcolor: '#000000'
                },
                elements: {
                    region: {
                        attributes: {
                            id: 'emergency-region',
                            width: '1920',
                            height: '1080',
                            top: '0',
                            left: '0'
                        },
                        elements: {
                            media: {
                                attributes: {
                                    id: 'emergency-media',
                                    type: 'text',
                                    duration: '10'
                                },
                                text: 'System is operating in emergency mode. Please check your layouts.'
                            }
                        }
                    }
                }
            }
        }
    };
}

// Helper function to capitalize first letter

socket.on('error', function (error) {
    console.log('=== SOCKET ERROR ===', error)
})

// ========================================
// SYNCHRONIZATION EVENT HANDLERS
// ========================================

// Global synchronization variables
var syncConfig = null;
var syncMasterInterval = null;
var syncCheckInterval = null;
var lastSyncTimestamp = 0;
var networkConnected = true;

// Initialize synchronization settings from config
function initSyncSettings() {
    try {
        if (config && config.syncSettings) {
            syncConfig = config.syncSettings;
            console.log('=== SYNC: Initialized with settings:', syncConfig);

            if (syncConfig.syncMode === 'enabled') {
                if (syncConfig.isMaster) {
                    startMasterSync();
                    console.log('=== SYNC: Started as MASTER ===');
                } else {
                    startSlaveSync();
                    console.log('=== SYNC: Started as SLAVE ===');
                }
            }
        }
    } catch (error) {
        console.warn('=== SYNC: Failed to initialize sync settings:', error);
        syncConfig = null;
    }
}

// Optimized master synchronization functions with reduced frequency
function startMasterSync() {
    if (!syncConfig || !syncConfig.isMaster) return;

    // Stop existing intervals
    if (syncMasterInterval) clearInterval(syncMasterInterval);

    // Use debounced broadcasting to reduce CPU usage
    const debouncedBroadcast = createDebouncedHandler('masterSync', () => {
        if (syncConfig.layoutSyncEnabled) {
            broadcastLayoutSync();
        }
        if (syncConfig.videoSyncEnabled) {
            broadcastVideoTime();
        }
    }, 50); // 50ms debounce

    // Reduce default frequency from 1000ms to 2000ms for better performance
    const broadcastInterval = Math.max(syncConfig.masterBroadcastInterval || 2000, 1000);
    
    syncMasterInterval = setInterval(debouncedBroadcast, broadcastInterval);
    console.log('=== SYNC MASTER: Started with optimized interval:', broadcastInterval + 'ms');
}

// Optimized slave synchronization functions
function startSlaveSync() {
    if (!syncConfig || syncConfig.isMaster) return;

    // Stop existing intervals
    if (syncCheckInterval) clearInterval(syncCheckInterval);

    // Use debounced sync checking
    const debouncedSyncCheck = createDebouncedHandler('slaveSync', () => {
        checkSyncStatus();
    }, 100); // 100ms debounce

    // Reduce default frequency from 5000ms to 10000ms for better performance
    const syncInterval = Math.max(syncConfig.syncInterval || 10000, 5000);
    
    syncCheckInterval = setInterval(debouncedSyncCheck, syncInterval);
    console.log('=== SYNC SLAVE: Started with optimized interval:', syncInterval + 'ms');
}

// Optimized broadcast function with throttling
let lastBroadcastTime = 0
const MIN_BROADCAST_INTERVAL = 500 // Minimum 500ms between broadcasts

function broadcastLayoutSync() {
    if (!syncConfig || !syncConfig.isMaster || !networkConnected) return;

    const currentTime = Date.now()
    if (currentTime - lastBroadcastTime < MIN_BROADCAST_INTERVAL) {
        return // Throttle broadcasts to prevent spam
    }
    lastBroadcastTime = currentTime

    try {
        if (typeof isLoopLyt !== 'undefined' && isLoopLyt && typeof loopXMLCurIndex !== 'undefined' && typeof loopArr !== 'undefined') {
            var remainingTime = 0;

            // Calculate remaining time if loop timeout is active
            if (typeof loopTimeoutStartTime !== 'undefined' && typeof loopTimeoutDuration !== 'undefined' && loopTimeoutStartTime && loopTimeoutDuration) {
                var elapsed = currentTime - loopTimeoutStartTime;
                remainingTime = Math.max(loopTimeoutDuration - elapsed, 0);
            }

            var syncData = {
                timestamp: currentTime,
                layoutIndex: loopXMLCurIndex,
                currentLayoutID: currentlytID || '',
                remainingTime: remainingTime,
                totalLayouts: loopArr.length,
                isLoopLayout: true,
                masterBroadcast: true
            };

            console.log('=== SYNC MASTER: Broadcasting layout sync:', syncData);
            socket.emit('layout-sync-broadcast', syncData);
        }
    } catch (error) {
        console.warn('=== SYNC MASTER: Failed to broadcast layout sync:', error);
    }
}

// Broadcast current video synchronization data (Master only)
function broadcastVideoTime() {
    if (!syncConfig || !syncConfig.isMaster || !networkConnected) return;

    try {
        if (typeof videoJSPlayer !== 'undefined' && videoJSPlayer.length > 0) {
            var videoSyncData = [];

            videoJSPlayer.forEach((player, index) => {
                if (player && typeof player.currentTime === 'function' && typeof player.paused === 'function') {
                    videoSyncData.push({
                        playerIndex: index,
                        currentTime: player.currentTime(),
                        paused: player.paused(),
                        duration: player.duration() || 0,
                        playbackRate: player.playbackRate() || 1
                    });
                }
            });

            if (videoSyncData.length > 0) {
                var syncData = {
                    timestamp: Date.now(),
                    videoPlayers: videoSyncData,
                    masterBroadcast: true
                };

                console.log('=== SYNC MASTER: Broadcasting video sync:', syncData);
                socket.emit('video-sync', syncData);
            }
        }
    } catch (error) {
        console.warn('=== SYNC MASTER: Failed to broadcast video sync:', error);
    }
}

// Handle layout synchronization received from master (Slave only)
socket.on('layout-sync-receive', function (syncData) {
    if (!syncConfig || syncConfig.isMaster || !syncData) return;

    console.log('=== SYNC SLAVE: Received layout sync:', syncData);

    try {
        if (syncData.masterBroadcast && typeof isLoopLyt !== 'undefined') {
            lastSyncTimestamp = Date.now();

            // Check if we need to sync layout
            var currentLayoutIndex = loopXMLCurIndex || 0;
            var targetLayoutIndex = syncData.layoutIndex || 0;

            if (Math.abs(currentLayoutIndex - targetLayoutIndex) > 0 ||
                (syncData.currentLayoutID && currentlytID !== syncData.currentLayoutID)) {

                console.log('=== SYNC SLAVE: Layout desync detected, syncing to layout:', targetLayoutIndex);
                syncToMasterLayout(syncData);
            } else {
                // Sync timing within current layout
                syncLayoutTiming(syncData);
            }
        }
    } catch (error) {
        console.warn('=== SYNC SLAVE: Failed to process layout sync:', error);
    }
});

// Handle video synchronization received from master (Slave only)
socket.on('video-sync', function (syncData) {
    if (!syncConfig || syncConfig.isMaster || !syncData || !syncConfig.videoSyncEnabled) return;

    console.log('=== SYNC SLAVE: Received video sync:', syncData);

    try {
        if (syncData.masterBroadcast && syncData.videoPlayers && typeof videoJSPlayer !== 'undefined') {
            lastSyncTimestamp = Date.now();

            syncData.videoPlayers.forEach(videoData => {
                var player = videoJSPlayer[videoData.playerIndex];
                if (player && typeof player.currentTime === 'function') {
                    var timeDiff = Math.abs(player.currentTime() - videoData.currentTime);
                    var threshold = syncConfig.videoSyncThreshold || 0.5;

                    if (timeDiff > threshold) {
                        console.log('=== SYNC SLAVE: Video desync detected, adjusting time for player:', videoData.playerIndex, 'diff:', timeDiff);
                        player.currentTime(videoData.currentTime);
                    }

                    // Sync play/pause state
                    if (videoData.paused && !player.paused()) {
                        player.pause();
                    } else if (!videoData.paused && player.paused()) {
                        player.play();
                    }
                }
            });
        }
    } catch (error) {
        console.warn('=== SYNC SLAVE: Failed to process video sync:', error);
    }
});

// Sync to master layout (Slave helper function)
function syncToMasterLayout(syncData) {
    try {
        if (typeof loopArr !== 'undefined' && typeof loopNextLayout === 'function' && typeof playcurrentLayout === 'function') {
            // Update our loop index to match master
            if (syncData.layoutIndex < loopArr.length) {
                loopXMLCurIndex = syncData.layoutIndex;

                // Play the target layout immediately
                var targetLayout = loopArr[syncData.layoutIndex];
                if (targetLayout) {
                    console.log('=== SYNC SLAVE: Switching to master layout:', syncData.layoutIndex);
                    playcurrentLayout(targetLayout);

                    // Set up timeout for remaining time
                    if (syncData.remainingTime > 0) {
                        setTimeout(() => {
                            loopNextLayout();
                        }, syncData.remainingTime);
                    }
                }
            }
        }
    } catch (error) {
        console.warn('=== SYNC SLAVE: Failed to sync to master layout:', error);
    }
}

// Sync layout timing (Slave helper function)
function syncLayoutTiming(syncData) {
    try {
        if (typeof loopTimeout !== 'undefined' && syncData.remainingTime > 0) {
            // Clear current timeout and set new one based on master timing
            if (isLoopLyt && typeof resetLoopTimeoutState === 'function') {
                console.log('=== RENDERER PROCESS: Emergency cleanup - resetting loop timeout state ===');
                resetLoopTimeoutState();
            }

            console.log('=== SYNC SLAVE: Adjusting layout timing, remaining time:', syncData.remainingTime);
            loopTimeout = setTimeout(() => {
                if (typeof loopNextLayout === 'function') {
                    loopNextLayout();
                }
            }, syncData.remainingTime);
        }
    } catch (error) {
        console.warn('=== SYNC SLAVE: Failed to sync layout timing:', error);
    }
}

// Check synchronization status (Slave function)
function checkSyncStatus() {
    if (!syncConfig || syncConfig.isMaster) return;

    var currentTime = Date.now();
    var timeSinceLastSync = currentTime - lastSyncTimestamp;

    if (timeSinceLastSync > (syncConfig.networkTimeout || 10000)) {
        if (networkConnected) {
            console.warn('=== SYNC SLAVE: Network timeout detected, falling back to local timing');
            networkConnected = false;
            fallbackToLocalTiming();
        }
    } else {
        if (!networkConnected) {
            console.log('=== SYNC SLAVE: Network recovered, resuming sync');
            networkConnected = true;
        }
    }
}

// Fallback to local timing when network is disconnected
function fallbackToLocalTiming() {
    try {
        console.log('=== SYNC: Falling back to local timing mode');
        // Continue with local loop timing
        if (typeof isLoopLyt !== 'undefined' && isLoopLyt && !loopTimeout) {
            // Restart local loop if needed
            if (typeof loopArr !== 'undefined' && loopArr.length > 0) {
                var currentLayout = loopArr[loopXMLCurIndex] || loopArr[0];
                if (currentLayout && typeof playcurrentLayout === 'function') {
                    playcurrentLayout(currentLayout);
                }
            }
        }
    } catch (error) {
        console.warn('=== SYNC: Failed to fallback to local timing:', error);
    }
}

// Initialize synchronization when socket connects
socket.on('connect', function () {
    console.log('=== RENDERER PROCESS: Connected to socket server ===')
    networkConnected = true;
    setTimeout(() => {
        initSyncSettings();
    }, 1000); // Delay to ensure config is loaded
})

// Handle disconnect for sync
socket.on('disconnect', function () {
    console.log('=== RENDERER PROCESS: Disconnected from socket server ===')
    networkConnected = false;

    // Clear sync intervals
    if (syncMasterInterval) {
        clearInterval(syncMasterInterval);
        syncMasterInterval = null;
    }
    if (syncCheckInterval) {
        clearInterval(syncCheckInterval);
        syncCheckInterval = null;
    }
})

// ========================================
// END SYNCHRONIZATION EVENT HANDLERS
// ========================================

//retrive all text slot
socket.on('gettextslot', function (msg) {
    console.log('=== RENDERER PROCESS: gettextslot REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);

    try {
        var textSlots = extractTextSlotsFromLocalStorage();
        console.log('=== RENDERER PROCESS: Found', textSlots.length, 'text slots ===');

        // Send the text slots back to the control panel
        socket.emit('textslot-list', textSlots);
        console.log('=== RENDERER PROCESS: Sent text slots to control panel ===');
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting text slots ===', error);
        // Send empty array on error
        socket.emit('textslot-list', []);
    }
});

// Helper function to capitalize first letter
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Helper function to get current playing layout ID from localStorage
function getCurrentPlayLayoutID() {
    try {
        var currentLayoutID = localStorage.getItem('currentPlayLayoutID');
        console.log('=== RENDERER PROCESS: Retrieved currentPlayLayoutID from localStorage:', currentLayoutID);
        // Update global variable with retrieved value
        currentPlayLayoutID = currentLayoutID;
        return currentLayoutID;
    } catch (error) {
        console.warn('=== RENDERER PROCESS: Failed to retrieve currentPlayLayoutID from localStorage:', error);
        return null;
    }
}

// Function to extract text slots from localStorage
function extractTextSlotsFromLocalStorage() {
    console.log('=== EXTRACT TEXT SLOTS: Function started ===');
    console.log('=== EXTRACT TEXT SLOTS: DSID:', dsid);

    var textSlots = [];

    try {
        // Parse and retrieve data from local storage
        console.log('=== EXTRACT TEXT SLOTS: Retrieving data from localStorage with key:', dsid);
        var resultOffline = JSON.parse(localStorage.getItem(dsid));

        if (!resultOffline) {
            console.warn('=== EXTRACT TEXT SLOTS: No data found in localStorage for DSID:', dsid);
            return textSlots;
        }

        console.log('=== EXTRACT TEXT SLOTS: localStorage data retrieved successfully');
        console.log('=== EXTRACT TEXT SLOTS: Data structure check - elements array length:',
            resultOffline.elements ? resultOffline.elements.length : 'undefined');

        // Check if data structure is valid
        if (!resultOffline.elements || !resultOffline.elements[0] ||
            !resultOffline.elements[0].elements || !resultOffline.elements[0].elements[0]) {
            console.error('=== EXTRACT TEXT SLOTS: Invalid data structure in localStorage');
            return textSlots;
        }

        // Determine layout type (loop vs single)
        var layoutType = resultOffline['elements'][0]['elements'][0]['name'];
        console.log('=== EXTRACT TEXT SLOTS: Layout type detected:', layoutType);

        if (layoutType == 'loop') {
            // Check if it's a loop layout
            console.log('=== EXTRACT TEXT SLOTS: Processing LOOP layout');
            // Cpanel check if playing loop
            isLoopLyt = true // Set the loop layout flag to true
            console.log('=== EXTRACT TEXT SLOTS: Set isLoopLyt to true');

            resultOffline = resultOffline['elements'][0]['elements'][0]['elements'] // Access the elements of the loop layout
            console.log('=== EXTRACT TEXT SLOTS: Loop layout elements count:', resultOffline.length);

            $.when
                .apply(
                    $,
                    $.map(resultOffline, function (layoutxml, oindex) {

                        layoutURL = layoutxml['attributes']['url'] // Get the layout URL
                        layoutID = layoutURL.split('layout/') // Extract the layout ID from the URL
                        layoutID = layoutID[1].slice(0, layoutID[1].lastIndexOf('/')) // Extract the layout ID
                        layoutxml = JSON.parse(localStorage.getItem('layout-' + layoutID)) // Parse and retrieve layout data from local storage
                        console.log('=== EXTRACT TEXT SLOTS: Processing loop layout index:', layoutID);
                        var slotsFromLayout = extractTextSlotsFromLayoutData(layoutxml, layoutID);
                        console.log('=== EXTRACT TEXT SLOTS: Found', slotsFromLayout.length, 'text slots in layout', layoutID);
                        textSlots = textSlots.concat(slotsFromLayout);
                        return slotsFromLayout;
                    })
                )
        } else {
            // Single layout processing
            console.log('=== EXTRACT TEXT SLOTS: Processing SINGLE layout');
            try {
                var slotsFromLayout = extractTextSlotsFromLayoutData(resultOffline, 0);
                console.log('=== EXTRACT TEXT SLOTS: Found', slotsFromLayout.length, 'text slots in single layout');
                textSlots = textSlots.concat(slotsFromLayout);
            } catch (error) {
                console.error('=== EXTRACT TEXT SLOTS: Error parsing single layout data:', error);
            }
        }

    } catch (error) {
        console.error('=== EXTRACT TEXT SLOTS: Critical error in function:', error);
        console.error('=== EXTRACT TEXT SLOTS: Error stack:', error.stack);
    }

    console.log('=== EXTRACT TEXT SLOTS: Function completed ===');
    console.log('=== EXTRACT TEXT SLOTS: Total text slots extracted:', textSlots.length);
    console.log('=== EXTRACTED TEXT SLOTS ===', textSlots);

    return textSlots;
}

// Enhanced function to extract comprehensive slot data with detailed information
function extractComprehensiveSlotData(layoutData, layoutKey) {
    console.log('=== COMPREHENSIVE SLOT EXTRACTION: Processing layout:', layoutKey);
    
    var result = {
        allSlots: [],
        textSlots: [],
        mediaSlots: [],
        specialSlots: [],
        layoutInfo: {},
        slotSummary: {
            total: 0,
            text: 0,
            media: 0,
            ticker: 0,
            scroller: 0,
            fader: 0,
            date: 0,
            time: 0,
            datetime: 0,
            html: 0,
            table: 0,
            other: 0
        }
    };

    if (!layoutData || !layoutData.elements) {
        console.warn('=== COMPREHENSIVE SLOT EXTRACTION: Invalid layout data for:', layoutKey);
        return result;
    }

    try {
        var elements = layoutData.elements;
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        
        // Extract layout information
        result.layoutInfo = {
            id: layoutId,
            name: 'Layout ' + layoutId,
            key: layoutKey,
            attributes: {}
        };

        // Get layout attributes and name
        if (elements[0] && elements[0].attributes) {
            result.layoutInfo.attributes = elements[0].attributes;
            result.layoutInfo.name = elements[0].attributes.name || 
                                   elements[0].attributes.layout || 
                                   elements[0].attributes.title || 
                                   result.layoutInfo.name;
        }

        // Find slots container
        var slotsContainer = null;
        if (elements[0] &&
            elements[0].elements && elements[0].elements[0] &&
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
        }

        if (slotsContainer && Array.isArray(slotsContainer)) {
            console.log('=== COMPREHENSIVE SLOT EXTRACTION: Processing', slotsContainer.length, 'slots');

            slotsContainer.forEach(function (slot, index) {
                if (slot.attributes && slot.attributes.id) {
                    var slotInfo = extractDetailedSlotInfo(slot, layoutId, result.layoutInfo.name, index);
                    
                    if (slotInfo) {
                        result.allSlots.push(slotInfo);
                        result.slotSummary.total++;

                        // Categorize slots
                        switch (slotInfo.type) {
                            case 'text':
                                result.textSlots.push(slotInfo);
                                result.slotSummary.text++;
                                break;
                            case 'media':
                                result.mediaSlots.push(slotInfo);
                                result.slotSummary.media++;
                                break;
                            case 'ticker':
                                result.specialSlots.push(slotInfo);
                                result.slotSummary.ticker++;
                                break;
                            case 'scroller':
                                result.specialSlots.push(slotInfo);
                                result.slotSummary.scroller++;
                                break;
                            case 'fader':
                                result.specialSlots.push(slotInfo);
                                result.slotSummary.fader++;
                                break;
                            case 'date':
                                result.specialSlots.push(slotInfo);
                                result.slotSummary.date++;
                                break;
                            case 'time':
                                result.specialSlots.push(slotInfo);
                                result.slotSummary.time++;
                                break;
                            case 'datetime':
                                result.specialSlots.push(slotInfo);
                                result.slotSummary.datetime++;
                                break;
                            case 'html':
                                result.specialSlots.push(slotInfo);
                                result.slotSummary.html++;
                                break;
                            case 'table':
                                result.specialSlots.push(slotInfo);
                                result.slotSummary.table++;
                                break;
                            default:
                                result.specialSlots.push(slotInfo);
                                result.slotSummary.other++;
                        }
                    }
                }
            });
        }

        console.log('=== COMPREHENSIVE SLOT EXTRACTION: Completed for', layoutKey, '- Total slots:', result.slotSummary.total);
        return result;

    } catch (error) {
        console.error('=== COMPREHENSIVE SLOT EXTRACTION: Error for', layoutKey, ':', error);
        return result;
    }
}

// Function to extract detailed information for a single slot
function extractDetailedSlotInfo(slot, layoutId, layoutName, index) {
    try {
        var slotInfo = {
            id: slot.attributes.id,
            name: slot.attributes.name || (slot.name + '-' + slot.attributes.id),
            type: slot.name,
            layoutId: layoutId,
            layoutName: layoutName,
            index: index,
            enabled: slot.attributes.enabled || 'Y',
            attributes: slot.attributes,
            content: '',
            contentType: '',
            duration: null,
            position: {},
            styling: {},
            rawData: null
        };

        // Extract positioning information
        if (slot.attributes) {
            slotInfo.position = {
                x: slot.attributes.x || slot.attributes.left || 0,
                y: slot.attributes.y || slot.attributes.top || 0,
                width: slot.attributes.width || 0,
                height: slot.attributes.height || 0,
                zIndex: slot.attributes.zindex || slot.attributes.z || 0
            };

            // Extract styling information
            slotInfo.styling = {
                backgroundColor: slot.attributes.bgcolor || slot.attributes.backgroundColor,
                color: slot.attributes.color || slot.attributes.textColor,
                fontSize: slot.attributes.fontSize || slot.attributes.fontsize,
                fontFamily: slot.attributes.fontFamily || slot.attributes.font,
                textAlign: slot.attributes.textAlign || slot.attributes.align,
                opacity: slot.attributes.opacity || 1
            };

            // Extract duration if available
            slotInfo.duration = slot.attributes.duration || slot.attributes.timeout || null;
        }

        // Extract content based on slot type
        if (slot.elements && slot.elements[0]) {
            if (slot.elements[0].elements && slot.elements[0].elements[0]) {
                if (slot.elements[0].elements[0].text) {
                    slotInfo.content = slot.elements[0].elements[0].text;
                    slotInfo.rawData = slot.elements[0].elements[0];
                }
            } else if (slot.elements[0].text) {
                slotInfo.content = slot.elements[0].text;
                slotInfo.rawData = slot.elements[0];
            }
        }

        // Determine content type and extract type-specific information
        if (slot.name === 'media' && slotInfo.content) {
            var extension = slotInfo.content.split('.').pop().toLowerCase();
            var videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
            var imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'];
            var audioExtensions = ['mp3', 'wav', 'aac', 'flac', 'ogg'];

            if (videoExtensions.includes(extension)) {
                slotInfo.contentType = 'video';
            } else if (imageExtensions.includes(extension)) {
                slotInfo.contentType = 'image';
            } else if (audioExtensions.includes(extension)) {
                slotInfo.contentType = 'audio';
            } else {
                slotInfo.contentType = 'unknown';
            }

            // Extract filename from path
            var n = slotInfo.content.lastIndexOf('/');
            if (n !== -1) {
                slotInfo.fileName = slotInfo.content.substring(n + 1);
                slotInfo.filePath = slotInfo.content;
                slotInfo.content = slotInfo.fileName; // Display filename instead of full path
            } else {
                slotInfo.fileName = slotInfo.content;
            }
        } else if (slot.name === 'text') {
            slotInfo.contentType = 'text';
        } else if (slot.name === 'ticker') {
            slotInfo.contentType = 'ticker';
            // Extract ticker-specific attributes
            slotInfo.tickerSpeed = slot.attributes.speed || slot.attributes.scrollspeed || '';
            slotInfo.tickerDirection = slot.attributes.direction || 'left';
        } else if (slot.name === 'scroller') {
            slotInfo.contentType = 'scroller';
            // Extract scroller-specific attributes
            slotInfo.scrollSpeed = slot.attributes.speed || slot.attributes.scrollspeed || '';
            slotInfo.scrollDirection = slot.attributes.direction || 'up';
        } else if (slot.name === 'fader') {
            slotInfo.contentType = 'fader';
            // Extract fader-specific attributes
            slotInfo.fadeSpeed = slot.attributes.speed || slot.attributes.fadespeed || '';
            slotInfo.fadeDuration = slot.attributes.duration || slot.attributes.fadeduration || '';
        } else if (slot.name === 'date') {
            slotInfo.contentType = 'date';
            // Extract date-specific attributes
            slotInfo.dateFormat = slot.attributes.format || slot.attributes.dateformat || 'DD/MM/YYYY';
            slotInfo.timezone = slot.attributes.timezone || '';
        } else if (slot.name === 'time') {
            slotInfo.contentType = 'time';
            // Extract time-specific attributes
            slotInfo.timeFormat = slot.attributes.format || slot.attributes.timeformat || 'HH:MM:SS';
            slotInfo.timezone = slot.attributes.timezone || '';
            slotInfo.showSeconds = slot.attributes.showseconds || 'Y';
        } else if (slot.name === 'html') {
            slotInfo.contentType = 'html';
            // HTML content is used as-is
        } else if (slot.name === 'table') {
            slotInfo.contentType = 'table';
            // Extract table-specific attributes
            slotInfo.tableColumns = slot.attributes.columns || '';
            slotInfo.tableRows = slot.attributes.rows || '';
            slotInfo.dataSoource = slot.attributes.datasource || '';
            slotInfo.tableHeaders = slot.attributes.headers || 'Y';
        } else if (slot.name === 'datetime') {
            slotInfo.contentType = 'datetime';
            // Extract datetime-specific attributes
            slotInfo.dateTimeFormat = slot.attributes.format || slot.attributes.datetimeformat || 'YYYY-MM-DD HH:mm:ss';
            slotInfo.timezone = slot.attributes.timezone || '';
        } else {
            slotInfo.contentType = slot.name;
        }

        return slotInfo;

    } catch (error) {
        console.error('=== DETAILED SLOT INFO: Error extracting info for slot:', slot.attributes?.name, error);
        return null;
    }
}

// Function to extract ALL slot types from layout data structure (comprehensive)
function extractAllSlotsFromLayoutData(layoutData, layoutKey) {
    console.log('=== EXTRACT ALL SLOTS: Processing layout key:', layoutKey, layoutData);
    var allSlots = [];

    if (!layoutData || !layoutData.elements) {
        console.warn('=== EXTRACT ALL SLOTS: Invalid layout data or missing elements for key:', layoutKey);
        return allSlots;
    }

    console.log('=== EXTRACT ALL SLOTS: Layout data validation passed for key:', layoutKey);

    try {
        // Navigate through the layout structure to find slots
        var elements = layoutData.elements;
        console.log('=== EXTRACT ALL SLOTS: Elements array length:', elements.length);

        // Extract layout information
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;
        console.log('=== EXTRACT ALL SLOTS: Initial layout ID:', layoutId, 'layout name:', layoutName);

        // Try to get the actual layout name from XML attributes
        if (elements[0] && elements[0].attributes) {
            console.log('=== EXTRACT ALL SLOTS: Checking for layout name in attributes');
            if (elements[0].attributes.layout) {
                layoutName = elements[0].attributes.layout;
                console.log('=== EXTRACT ALL SLOTS: Found layout name from layout attribute:', layoutName);
            } else if (elements[0].attributes.name) {
                layoutName = elements[0].attributes.name;
                console.log('=== EXTRACT ALL SLOTS: Found layout name from name attribute:', layoutName);
            } else if (elements[0].attributes.title) {
                layoutName = elements[0].attributes.title;
                console.log('=== EXTRACT ALL SLOTS: Found layout name from title attribute:', layoutName);
            }
        }

        // Try to find the layout structure (may vary)
        var slotsContainer = null;
        console.log('=== EXTRACT ALL SLOTS: Searching for slots container');

        // Common pattern: elements[0].elements[0].elements[0].elements (slot list)
        if (elements[0] &&
            elements[0].elements && elements[0].elements[0] &&
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
            console.log('=== EXTRACT ALL SLOTS: Found slots container with', slotsContainer.length, 'slots');
        } else {
            console.warn('=== EXTRACT ALL SLOTS: Could not find slots container in expected structure');
        }

        if (slotsContainer && Array.isArray(slotsContainer)) {
            var slotCount = 0;
            console.log('=== EXTRACT ALL SLOTS: Processing', slotsContainer.length, 'slots');

            // All possible slot types from layoutxml.js
            var supportedSlotTypes = ['media', 'text', 'ticker', 'scroller', 'fader', 'date', 'time', 'datetime', 'html', 'table'];

            slotsContainer.forEach(function (slot, index) {
                console.log('=== EXTRACT ALL SLOTS: Processing slot', index, 'type:', slot.name);

                if (slot.attributes && slot.attributes.id) {
                    // Check if it's a supported slot type
                    if (supportedSlotTypes.includes(slot.name)) {
                        slotCount++;
                        console.log('=== EXTRACT ALL SLOTS: Found', slot.name, 'slot', slotCount, '- ID:', slot.attributes.id, 'Name:', slot.attributes.name);

                        var slotContent = '';

                        // Try to extract slot content based on type
                        if (slot.elements && slot.elements[0]) {
                            if (slot.elements[0].elements && slot.elements[0].elements[0] && slot.elements[0].elements[0].text) {
                                slotContent = slot.elements[0].elements[0].text;
                                console.log('=== EXTRACT ALL SLOTS: Extracted content for', slot.name, 'slot:', slotContent);

                                // For media slots, extract just the filename from path
                                if (slot.name === 'media' && slotContent) {
                                    var n = slotContent.lastIndexOf('/');
                                    if (n !== -1) {
                                        var originalContent = slotContent;
                                        slotContent = slotContent.substring(n + 1);
                                        console.log('=== EXTRACT ALL SLOTS: Extracted filename from path:', originalContent, '->', slotContent);
                                    }
                                }
                            } else if (slot.elements[0].text) {
                                slotContent = slot.elements[0].text;
                                console.log('=== EXTRACT ALL SLOTS: Extracted direct text content for', slot.name, 'slot:', slotContent);
                            }
                        }

                        // Handle special slot types with additional attributes
                        var additionalData = {};
                        if (slot.attributes) {
                            // For date/time slots, capture format attributes
                            if (slot.name === 'date' || slot.name === 'time') {
                                additionalData.format = slot.attributes.format || '';
                                additionalData.timezone = slot.attributes.timezone || '';
                            }
                            // For ticker/scroller/fader slots, capture animation attributes
                            else if (slot.name === 'ticker' || slot.name === 'scroller' || slot.name === 'fader') {
                                additionalData.speed = slot.attributes.speed || '';
                                additionalData.direction = slot.attributes.direction || '';
                                additionalData.duration = slot.attributes.duration || '';
                            }
                            // For table slots, capture table-specific attributes
                            else if (slot.name === 'table') {
                                additionalData.columns = slot.attributes.columns || '';
                                additionalData.rows = slot.attributes.rows || '';
                                additionalData.datasource = slot.attributes.datasource || '';
                            }
                            // For HTML slots, no special handling needed
                            else if (slot.name === 'html') {
                                // HTML content is extracted as-is
                            }
                        }

                        var slotObj = {
                            id: slot.attributes.id,
                            name: slot.attributes.name || (slot.name + '-' + slot.attributes.id),
                            type: slot.name,
                            content: slotContent || '',
                            layoutId: layoutId,
                            layoutName: layoutName,
                            enabled: slot.attributes.enabled || 'Y',
                            additionalData: additionalData
                        };

                        allSlots.push(slotObj);
                        console.log('=== EXTRACT ALL SLOTS: Added', slot.name, 'slot to collection:', slotObj.name);
                    } else {
                        console.log('=== EXTRACT ALL SLOTS: Skipping unsupported slot type:', slot.name);
                    }
                } else {
                    console.log('=== EXTRACT ALL SLOTS: Skipping slot due to missing attributes - ID:', slot.attributes?.id, 'Name:', slot.attributes?.name);
                }
            });

            console.log('=== EXTRACT ALL SLOTS: Total slots found in layout:', slotCount);
        } else {
            console.warn('=== EXTRACT ALL SLOTS: No valid slots container found');
        }

    } catch (error) {
        console.error('=== EXTRACT ALL SLOTS: Error extracting slots from layout:', layoutKey, error);
        console.error('=== EXTRACT ALL SLOTS: Error stack:', error.stack);
    }

    console.log('=== EXTRACT ALL SLOTS: Completed processing layout key:', layoutKey, '- returning', allSlots.length, 'slots');
    return allSlots;
}

// Function to extract text slots from layout data structure
function extractTextSlotsFromLayoutData(layoutData, layoutKey) {
    console.log('=== EXTRACT LAYOUT DATA: Processing layout key:', layoutKey, layoutData);
    var textSlots = [];

    if (!layoutData || !layoutData.elements) {
        console.warn('=== EXTRACT LAYOUT DATA: Invalid layout data or missing elements for key:', layoutKey);
        return textSlots;
    }

    console.log('=== EXTRACT LAYOUT DATA: Layout data validation passed for key:', layoutKey);

    try {
        // Navigate through the layout structure to find slots
        var elements = layoutData.elements;
        console.log('=== EXTRACT LAYOUT DATA: Elements array length:', elements.length);

        // Extract layout information
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;
        console.log('=== EXTRACT LAYOUT DATA: Initial layout ID:', layoutId, 'layout name:', layoutName);

        // Try to get the actual layout name from XML attributes
        if (elements[0] && elements[0].attributes) {
            console.log('=== EXTRACT LAYOUT DATA: Checking for layout name in attributes');
            if (elements[0].attributes.layout) {
                layoutName = elements[0].attributes.layout;
                console.log('=== EXTRACT LAYOUT DATA: Found layout name from layout attribute:', layoutName);
            } else if (elements[0].attributes.name) {
                layoutName = elements[0].attributes.name;
                console.log('=== EXTRACT LAYOUT DATA: Found layout name from name attribute:', layoutName);
            } else if (elements[0].attributes.title) {
                layoutName = elements[0].attributes.title;
                console.log('=== EXTRACT LAYOUT DATA: Found layout name from title attribute:', layoutName);
            }
        }

        // Try to find the layout structure (may vary)
        var slotsContainer = null;
        console.log('=== EXTRACT LAYOUT DATA: Searching for slots container');

        // Common pattern: elements[0].elements[0].elements[0].elements (slot list)
        if (elements[0] &&
            elements[0].elements && elements[0].elements[0] &&
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
            console.log('=== EXTRACT LAYOUT DATA: Found slots container with', slotsContainer.length, 'slots');
        } else {
            console.warn('=== EXTRACT LAYOUT DATA: Could not find slots container in expected structure');
        }

        if (slotsContainer && Array.isArray(slotsContainer)) {
            var textSlotCount = 0;
            console.log('=== EXTRACT LAYOUT DATA: Processing', slotsContainer.length, 'slots');

            slotsContainer.forEach(function (slot, index) {
                console.log('=== EXTRACT LAYOUT DATA: Processing slot', index, 'type:', slot.name);

                if (slot.attributes && slot.attributes.id) {
                    // Check if it's a text-type slot
                    if (slot.name === 'text' || slot.name === 'ticker' ||
                        slot.name === 'fader' || slot.name === 'scroller') {

                        textSlotCount++;
                        console.log('=== EXTRACT LAYOUT DATA: Found text slot', textSlotCount, '- ID:', slot.attributes.id, 'Name:', slot.attributes.name, 'Type:', slot.name);

                        var textContent = '';

                        // Try to extract text content
                        if (slot.elements && slot.elements[0] &&
                            slot.elements[0].elements && slot.elements[0].elements[0] &&
                            slot.elements[0].elements[0].text) {
                            textContent = slot.elements[0].elements[0].text;
                            console.log('=== EXTRACT LAYOUT DATA: Extracted text content (length:', textContent.length, 'chars)');
                        } else {
                            console.log('=== EXTRACT LAYOUT DATA: No text content found for slot');
                        }

                        var slotObj = {
                            myid: layoutId,
                            layout: layoutName,
                            layoutid: layoutId,
                            id: slot.attributes.id,
                            name: slot.attributes.name || (slot.name + '-' + slot.attributes.id),
                            slottype: capitalizeFirstLetter(slot.name),
                            text: textContent
                        };

                        textSlots.push(slotObj);
                        console.log('=== EXTRACT LAYOUT DATA: Added text slot to collection:', slotObj.name);
                    } else {
                        console.log('=== EXTRACT LAYOUT DATA: Skipping non-text slot type:', slot.name);
                    }
                } else {
                    console.log('=== EXTRACT LAYOUT DATA: Skipping slot due to missing attributes - ID:', slot.attributes?.id, 'Name:', slot.attributes?.name);
                }
            });

            console.log('=== EXTRACT LAYOUT DATA: Total text slots found in layout:', textSlotCount);
        } else {
            console.warn('=== EXTRACT LAYOUT DATA: No valid slots container found');
        }

    } catch (error) {
        console.error('=== EXTRACT LAYOUT DATA: Error extracting text slots from layout:', layoutKey, error);
        console.error('=== EXTRACT LAYOUT DATA: Error stack:', error.stack);
    }

    console.log('=== EXTRACT LAYOUT DATA: Completed processing layout key:', layoutKey, '- returning', textSlots.length, 'text slots');
    return textSlots;
}

//Replace text - OFFLINE VERSION
socket.on('replacetextslot', function (msg) {
    console.log('=== RENDERER PROCESS: replacetextslot REQUEST RECEIVED (OFFLINE MODE) ===');
    console.log('=== RENDERER PROCESS: Message:', msg);
    console.log('=== RENDERER PROCESS: isLoopLyt status:', isLoopLyt);
    console.log('=== RENDERER PROCESS: slotnameList length:', slotnameList.length);

    // Get layout ID and slot information using improved method with slotnameList
    var slotInfo = getCurrentLayoutID(msg['slotname'], slotnameList);
    console.log('=== RENDERER PROCESS: Slot info from getCurrentLayoutID:', slotInfo);

    var layoutid = slotInfo.layoutid;
    var id = slotInfo.slotid;
    var slottype = slotInfo.slottype;

    // Apply fallback values if needed
    if (!layoutid) {
        layoutid = '2'; // Default fallback
        console.log('=== RENDERER PROCESS: Using default Layout ID:', layoutid);
    }

    console.log('=== RENDERER PROCESS: Final Layout ID:', layoutid, 'Slot ID:', id, 'Slot Type:', slottype);

    // Extract numeric slot ID for timeout management
    var numericId = id.split('-')[1];
    var text = msg['slottext'];
    console.log('=== RENDERER PROCESS: Parsed numeric slot ID:', numericId, 'Text:', text);

    clearTimeout(textTimeout[numericId]);
    console.log('=== RENDERER PROCESS: Cleared textTimeout for slot:', numericId);

    // Check isLoopLyt - if content is for different layout, do layout update first
    if (isLoopLyt) {
        // Ensure currentPlayLayoutID is properly initialized
        if (currentPlayLayoutID === null) {
            getCurrentPlayLayoutID(); // This will update the global variable
        }

        console.log('=== RENDERER PROCESS: Is current layout and layout id same Current Layout: ', currentPlayLayoutID, ' Layout to Trigger: ', layoutid, ' ===');
        if (typeof currentPlayLayoutID !== 'undefined' && currentPlayLayoutID && layoutid === currentPlayLayoutID) {
            // Content is for current layout - skip layout switch, go straight to content update
            console.log('=== RENDERER PROCESS: Content for current layout - updating DOM directly ===');
            updateTextSlotContent(numericId, slottype, text, layoutid);
            return;
        }

        console.log('=== RENDERER PROCESS: Content for different layout ID (' + layoutid + ') - using temporary layout switch ===');

        // Check if target layout is available offline
        if (!isLayoutAvailableOffline(layoutid)) {
            console.error('=== RENDERER PROCESS: Target layout not available offline:', layoutid);
            console.log('=== RENDERER PROCESS: Available layouts:', getAvailableLayoutsFromDS());

            // Try to find an alternative layout or use current layout
            var availableLayouts = getAvailableLayoutsFromDS();
            var foundAlternative = false;

            for (var i = 0; i < availableLayouts.length; i++) {
                if (availableLayouts[i].id === layoutid) {
                    foundAlternative = true;
                    break;
                }
            }

            if (!foundAlternative) {
                console.warn('=== RENDERER PROCESS: Layout not found in available layouts, updating current layout content only ===');
                if (currentPlayLayoutID && isLayoutAvailableOffline(currentPlayLayoutID)) {
                    updateTextSlotContent(numericId, slottype, text, currentPlayLayoutID);
                } else {
                    console.error('=== RENDERER PROCESS: No suitable layout found for text update ===');
                }
                return;
            }
        }

        // Use temporary layout switching to preserve loop mode
        switchToLayoutTemporarilyInLoop(layoutid, function (success, message) {
            console.log('=== RENDERER PROCESS: replacetextslot temporary switch completed:', success, message);
            updateTextSlotContent(numericId, slottype, text, layoutid);
        });

        return; // Exit here for loop mode processing
    }

    // Non-loop layout mode - update content directly
    console.log('=== RENDERER PROCESS: Non-loop layout mode - updating DOM directly (offline) ===');
    updateTextSlotContent(numericId, slottype, text, layoutid);
});

// Helper function to update text slot content in DOM
function updateTextSlotContent(id, slottype, text, layoutIdToSave) {
    // Save current playing layout ID using sync function for consistent tracking
    if (layoutIdToSave) {
        syncCurrentPlayLayoutID(layoutIdToSave);
    }

    try {
        if (slottype == 'text') {
            console.log('=== RENDERER PROCESS: Updating text slot:', id);
            $('#slot-' + id).html('<div id="text-' + id + '" class="text-slot">' + text + '</div>')
        }
        if (slottype == 'ticker') {
            console.log('=== RENDERER PROCESS: Updating ticker slot:', id, 'Text length:', text.length);
            if (text.length <= 10) {
                text = text + ' ' + text + ' ' + text + ' ' + text + ' ' + text + ' ' + text + ' ' + text
            } else if (text.length > 10 && text.length <= 25) {
                text = text + ' ' + text + ' ' + text + ' ' + text + ' ' + text + ' ' + text
            } else if (text.length > 25 && text.length <= 40) {
                text = text + ' ' + text + ' ' + text + ' ' + text + ' ' + text + ' ' + text
            } else if (text.length > 40 && text.length <= 60) {
                text = text + ' ' + text + ' ' + text + ' ' + text + ' ' + text
            } else if (text.length > 60 && text.length <= 80) {
                text = text + ' ' + text + ' ' + text + ' ' + text
            } else if (text.length > 80 && text.length <= 110) {
                text = text + ' ' + text + ' ' + text
            } else if (text.length > 110 && text.length <= 130) {
                text = text + ' ' + text
            }
            console.log('=== RENDERER PROCESS: Ticker text processed, final length:', text.length);
            $('#slot-' + id).children().children().text(text)
        }
        if (slottype == 'fader') {
            console.log('=== RENDERER PROCESS: Updating fader slot:', id);
            $('#slot-' + id).children().text(text)
        }
        if (slottype == 'scroller') {
            console.log('=== RENDERER PROCESS: Updating scroller slot:', id);
            $('#slot-' + id).children().children().text(text)
        }

        console.log('=== RENDERER PROCESS: Text content update completed successfully');

        if (loopTimeout) {
            console.log('=== RENDERER PROCESS: Clearing existing loopTimeout to prevent conflicts ===');
            clearTimeout(loopTimeout);
            loopTimeout = null;
        }
        if (textTimeout[id]) { //clear textTimeout to reset
            console.log('=== RENDERER PROCESS: Clearing existing textTimeout for slotid:', id);
            clearTimeout(textTimeout[id])
        }
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error during text content update:', error);
    }
}

//retrive all media slot
socket.on('getmediaslot', function (msg) {
    console.log('=== RENDERER PROCESS: getmediaslot REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);

    try {
        var mediaSlots = extractMediaSlotsFromLocalStorage();
        console.log('=== RENDERER PROCESS: Found', mediaSlots.length, 'media slots ===');

        // Send the media slots back to the control panel
        socket.emit('mediaslot-list', mediaSlots);
        console.log('=== RENDERER PROCESS: Sent media slots to control panel ===');
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting media slots ===', error);
        // Send empty array on error
        socket.emit('mediaslot-list', []);
    }
});

//retrieve all ticker slots
socket.on('gettickerslot', function (msg) {
    console.log('=== RENDERER PROCESS: gettickerslot REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);

    try {
        var tickerSlots = extractTickerSlotsFromLocalStorage();
        console.log('=== RENDERER PROCESS: Found', tickerSlots.length, 'ticker slots ===');

        // Send the ticker slots back to the control panel
        socket.emit('tickerslot-list', tickerSlots);
        console.log('=== RENDERER PROCESS: Sent ticker slots to control panel ===');
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting ticker slots ===', error);
        // Send empty array on error
        socket.emit('tickerslot-list', []);
    }
});

//retrieve all scroller slots
socket.on('getscrollerslot', function (msg) {
    console.log('=== RENDERER PROCESS: getscrollerslot REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);

    try {
        var scrollerSlots = extractScrollerSlotsFromLocalStorage();
        console.log('=== RENDERER PROCESS: Found', scrollerSlots.length, 'scroller slots ===');

        // Send the scroller slots back to the control panel
        socket.emit('scrollerslot-list', scrollerSlots);
        console.log('=== RENDERER PROCESS: Sent scroller slots to control panel ===');
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting scroller slots ===', error);
        // Send empty array on error
        socket.emit('scrollerslot-list', []);
    }
});

//retrieve all fader slots
socket.on('getfaderslot', function (msg) {
    console.log('=== RENDERER PROCESS: getfaderslot REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);

    try {
        var faderSlots = extractFaderSlotsFromLocalStorage();
        console.log('=== RENDERER PROCESS: Found', faderSlots.length, 'fader slots ===');

        // Send the fader slots back to the control panel
        socket.emit('faderslot-list', faderSlots);
        console.log('=== RENDERER PROCESS: Sent fader slots to control panel ===');
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting fader slots ===', error);
        // Send empty array on error
        socket.emit('faderslot-list', []);
    }
});

//retrieve all date slots
socket.on('getdateslot', function (msg) {
    console.log('=== RENDERER PROCESS: getdateslot REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);

    try {
        var dateSlots = extractDateSlotsFromLocalStorage();
        console.log('=== RENDERER PROCESS: Found', dateSlots.length, 'date slots ===');

        // Send the date slots back to the control panel
        socket.emit('dateslot-list', dateSlots);
        console.log('=== RENDERER PROCESS: Sent date slots to control panel ===');
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting date slots ===', error);
        // Send empty array on error
        socket.emit('dateslot-list', []);
    }
});

//retrieve all time slots
socket.on('gettimeslot', function (msg) {
    console.log('=== RENDERER PROCESS: gettimeslot REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);

    try {
        var timeSlots = extractTimeSlotsFromLocalStorage();
        console.log('=== RENDERER PROCESS: Found', timeSlots.length, 'time slots ===');

        // Send the time slots back to the control panel
        socket.emit('timeslot-list', timeSlots);
        console.log('=== RENDERER PROCESS: Sent time slots to control panel ===');
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting time slots ===', error);
        // Send empty array on error
        socket.emit('timeslot-list', []);
    }
});

//retrieve all datetime slots
socket.on('getdatetimeslot', function (msg) {
    console.log('=== RENDERER PROCESS: getdatetimeslot REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);

    try {
        var datetimeSlots = extractDateTimeSlotsFromLocalStorage();
        console.log('=== RENDERER PROCESS: Found', datetimeSlots.length, 'datetime slots ===');

        // Send the datetime slots back to the control panel
        socket.emit('datetimeslot-list', datetimeSlots);
        console.log('=== RENDERER PROCESS: Sent datetime slots to control panel ===');
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting datetime slots ===', error);
        // Send empty array on error
        socket.emit('datetimeslot-list', []);
    }
});

//retrieve all html slots
socket.on('gethtmlslot', function (msg) {
    console.log('=== RENDERER PROCESS: gethtmlslot REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);

    try {
        var htmlSlots = extractHtmlSlotsFromLocalStorage();
        console.log('=== RENDERER PROCESS: Found', htmlSlots.length, 'html slots ===');

        // Send the html slots back to the control panel
        socket.emit('htmlslot-list', htmlSlots);
        console.log('=== RENDERER PROCESS: Sent html slots to control panel ===');
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting html slots ===', error);
        // Send empty array on error
        socket.emit('htmlslot-list', []);
    }
});

//retrieve all table slots
socket.on('gettableslot', function (msg) {
    console.log('=== RENDERER PROCESS: gettableslot REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);

    try {
        var tableSlots = extractTableSlotsFromLocalStorage();
        console.log('=== RENDERER PROCESS: Found', tableSlots.length, 'table slots ===');

        // Send the table slots back to the control panel
        socket.emit('tableslot-list', tableSlots);
        console.log('=== RENDERER PROCESS: Sent table slots to control panel ===');
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting table slots ===', error);
        // Send empty array on error
        socket.emit('tableslot-list', []);
    }
});

// Function to extract media slots from localStorage
function extractMediaSlotsFromLocalStorage() {
    console.log('=== EXTRACT MEDIA SLOTS: Function started ===');
    console.log('=== EXTRACT MEDIA SLOTS: DSID:', dsid);

    var mediaSlots = [];

    try {
        // Parse and retrieve data from local storage
        console.log('=== EXTRACT MEDIA SLOTS: Retrieving data from localStorage with key:', dsid);
        var resultOffline = JSON.parse(localStorage.getItem(dsid));

        if (!resultOffline) {
            console.warn('=== EXTRACT MEDIA SLOTS: No data found in localStorage for DSID:', dsid);
            return mediaSlots;
        }

        console.log('=== EXTRACT MEDIA SLOTS: localStorage data retrieved successfully');
        console.log('=== EXTRACT MEDIA SLOTS: Data structure check - elements array length:',
            resultOffline.elements ? resultOffline.elements.length : 'undefined');

        // Check if data structure is valid
        if (!resultOffline.elements || !resultOffline.elements[0] ||
            !resultOffline.elements[0].elements || !resultOffline.elements[0].elements[0]) {
            console.error('=== EXTRACT MEDIA SLOTS: Invalid data structure in localStorage');
            return mediaSlots;
        }

        // Determine layout type (loop vs single)
        var layoutType = resultOffline['elements'][0]['elements'][0]['name'];
        console.log('=== EXTRACT MEDIA SLOTS: Layout type detected:', layoutType);

        if (layoutType == 'loop') {
            // Check if it's a loop layout
            console.log('=== EXTRACT MEDIA SLOTS: Processing LOOP layout');
            // Cpanel check if playing loop
            isLoopLyt = true // Set the loop layout flag to true
            console.log('=== EXTRACT MEDIA SLOTS: Set isLoopLyt to true');

            resultOffline = resultOffline['elements'][0]['elements'][0]['elements'] // Access the elements of the loop layout
            console.log('=== EXTRACT MEDIA SLOTS: Loop layout elements count:', resultOffline.length);

            $.when
                .apply(
                    $,
                    $.map(resultOffline, function (layoutxml, oindex) {

                        layoutURL = layoutxml['attributes']['url'] // Get the layout URL
                        layoutID = layoutURL.split('layout/') // Extract the layout ID from the URL
                        layoutID = layoutID[1].slice(0, layoutID[1].lastIndexOf('/')) // Extract the layout ID
                        layoutxml = JSON.parse(localStorage.getItem('layout-' + layoutID)) // Parse and retrieve layout data from local storage
                        console.log('=== EXTRACT MEDIA SLOTS: Processing loop layout index:', layoutID);
                        var slotsFromLayout = extractMediaSlotsFromLayoutData(layoutxml, layoutID);
                        console.log('=== EXTRACT MEDIA SLOTS: Found', slotsFromLayout.length, 'media slots in layout', layoutID);
                        mediaSlots = mediaSlots.concat(slotsFromLayout);
                        return slotsFromLayout;
                    })
                )
        } else {
            // Single layout processing
            console.log('=== EXTRACT MEDIA SLOTS: Processing SINGLE layout');
            try {
                var slotsFromLayout = extractMediaSlotsFromLayoutData(resultOffline, 0);
                console.log('=== EXTRACT MEDIA SLOTS: Found', slotsFromLayout.length, 'media slots in single layout');
                mediaSlots = mediaSlots.concat(slotsFromLayout);
            } catch (error) {
                console.error('=== EXTRACT MEDIA SLOTS: Error parsing single layout data:', error);
            }
        }

    } catch (error) {
        console.error('=== EXTRACT MEDIA SLOTS: Critical error in function:', error);
        console.error('=== EXTRACT MEDIA SLOTS: Error stack:', error.stack);
    }

    console.log('=== EXTRACT MEDIA SLOTS: Function completed ===');
    console.log('=== EXTRACT MEDIA SLOTS: Total media slots extracted:', mediaSlots.length);
    console.log('=== EXTRACTED MEDIA SLOTS ===', mediaSlots);

    return mediaSlots;
}

// Function to extract ticker slots from localStorage
function extractTickerSlotsFromLocalStorage() {
    console.log('=== EXTRACT TICKER SLOTS: Function started ===');
    var tickerSlots = [];

    try {
        var resultOffline = JSON.parse(localStorage.getItem(dsid));
        if (!resultOffline) {
            console.warn('=== EXTRACT TICKER SLOTS: No data found in localStorage for DSID:', dsid);
            return tickerSlots;
        }

        var layoutType = resultOffline['elements'][0]['elements'][0]['name'];
        if (layoutType == 'loop') {
            resultOffline = resultOffline['elements'][0]['elements'][0]['elements'];
            $.when.apply($, $.map(resultOffline, function (layoutxml, oindex) {
                var layoutURL = layoutxml['attributes']['url'];
                var layoutID = layoutURL.split('layout/')[1].slice(0, layoutURL.split('layout/')[1].lastIndexOf('/'));
                var layoutData = JSON.parse(localStorage.getItem('layout-' + layoutID));
                var slotsFromLayout = extractTickerSlotsFromLayoutData(layoutData, layoutID);
                tickerSlots = tickerSlots.concat(slotsFromLayout);
            }));
        } else {
            var slotsFromLayout = extractTickerSlotsFromLayoutData(resultOffline, dsid);
            tickerSlots = tickerSlots.concat(slotsFromLayout);
        }
    } catch (error) {
        console.error('=== EXTRACT TICKER SLOTS: Error:', error);
    }

    return tickerSlots;
}

// Function to extract scroller slots from localStorage
function extractScrollerSlotsFromLocalStorage() {
    console.log('=== EXTRACT SCROLLER SLOTS: Function started ===');
    var scrollerSlots = [];

    try {
        var resultOffline = JSON.parse(localStorage.getItem(dsid));
        if (!resultOffline) {
            console.warn('=== EXTRACT SCROLLER SLOTS: No data found in localStorage for DSID:', dsid);
            return scrollerSlots;
        }

        var layoutType = resultOffline['elements'][0]['elements'][0]['name'];
        if (layoutType == 'loop') {
            resultOffline = resultOffline['elements'][0]['elements'][0]['elements'];
            $.when.apply($, $.map(resultOffline, function (layoutxml, oindex) {
                var layoutURL = layoutxml['attributes']['url'];
                var layoutID = layoutURL.split('layout/')[1].slice(0, layoutURL.split('layout/')[1].lastIndexOf('/'));
                var layoutData = JSON.parse(localStorage.getItem('layout-' + layoutID));
                var slotsFromLayout = extractScrollerSlotsFromLayoutData(layoutData, layoutID);
                scrollerSlots = scrollerSlots.concat(slotsFromLayout);
            }));
        } else {
            var slotsFromLayout = extractScrollerSlotsFromLayoutData(resultOffline, dsid);
            scrollerSlots = scrollerSlots.concat(slotsFromLayout);
        }
    } catch (error) {
        console.error('=== EXTRACT SCROLLER SLOTS: Error:', error);
    }

    return scrollerSlots;
}

// Function to extract fader slots from localStorage
function extractFaderSlotsFromLocalStorage() {
    console.log('=== EXTRACT FADER SLOTS: Function started ===');
    var faderSlots = [];

    try {
        var resultOffline = JSON.parse(localStorage.getItem(dsid));
        if (!resultOffline) {
            console.warn('=== EXTRACT FADER SLOTS: No data found in localStorage for DSID:', dsid);
            return faderSlots;
        }

        var layoutType = resultOffline['elements'][0]['elements'][0]['name'];
        if (layoutType == 'loop') {
            resultOffline = resultOffline['elements'][0]['elements'][0]['elements'];
            $.when.apply($, $.map(resultOffline, function (layoutxml, oindex) {
                var layoutURL = layoutxml['attributes']['url'];
                var layoutID = layoutURL.split('layout/')[1].slice(0, layoutURL.split('layout/')[1].lastIndexOf('/'));
                var layoutData = JSON.parse(localStorage.getItem('layout-' + layoutID));
                var slotsFromLayout = extractFaderSlotsFromLayoutData(layoutData, layoutID);
                faderSlots = faderSlots.concat(slotsFromLayout);
            }));
        } else {
            var slotsFromLayout = extractFaderSlotsFromLayoutData(resultOffline, dsid);
            faderSlots = faderSlots.concat(slotsFromLayout);
        }
    } catch (error) {
        console.error('=== EXTRACT FADER SLOTS: Error:', error);
    }

    return faderSlots;
}

// Function to extract date slots from localStorage
function extractDateSlotsFromLocalStorage() {
    console.log('=== EXTRACT DATE SLOTS: Function started ===');
    var dateSlots = [];

    try {
        var resultOffline = JSON.parse(localStorage.getItem(dsid));
        if (!resultOffline) {
            console.warn('=== EXTRACT DATE SLOTS: No data found in localStorage for DSID:', dsid);
            return dateSlots;
        }

        var layoutType = resultOffline['elements'][0]['elements'][0]['name'];
        if (layoutType == 'loop') {
            resultOffline = resultOffline['elements'][0]['elements'][0]['elements'];
            $.when.apply($, $.map(resultOffline, function (layoutxml, oindex) {
                var layoutURL = layoutxml['attributes']['url'];
                var layoutID = layoutURL.split('layout/')[1].slice(0, layoutURL.split('layout/')[1].lastIndexOf('/'));
                var layoutData = JSON.parse(localStorage.getItem('layout-' + layoutID));
                var slotsFromLayout = extractDateSlotsFromLayoutData(layoutData, layoutID);
                dateSlots = dateSlots.concat(slotsFromLayout);
            }));
        } else {
            var slotsFromLayout = extractDateSlotsFromLayoutData(resultOffline, dsid);
            dateSlots = dateSlots.concat(slotsFromLayout);
        }
    } catch (error) {
        console.error('=== EXTRACT DATE SLOTS: Error:', error);
    }

    return dateSlots;
}

// Function to extract time slots from localStorage
function extractTimeSlotsFromLocalStorage() {
    console.log('=== EXTRACT TIME SLOTS: Function started ===');
    var timeSlots = [];

    try {
        var resultOffline = JSON.parse(localStorage.getItem(dsid));
        if (!resultOffline) {
            console.warn('=== EXTRACT TIME SLOTS: No data found in localStorage for DSID:', dsid);
            return timeSlots;
        }

        var layoutType = resultOffline['elements'][0]['elements'][0]['name'];
        if (layoutType == 'loop') {
            resultOffline = resultOffline['elements'][0]['elements'][0]['elements'];
            $.when.apply($, $.map(resultOffline, function (layoutxml, oindex) {
                var layoutURL = layoutxml['attributes']['url'];
                var layoutID = layoutURL.split('layout/')[1].slice(0, layoutURL.split('layout/')[1].lastIndexOf('/'));
                var layoutData = JSON.parse(localStorage.getItem('layout-' + layoutID));
                var slotsFromLayout = extractTimeSlotsFromLayoutData(layoutData, layoutID);
                timeSlots = timeSlots.concat(slotsFromLayout);
            }));
        } else {
            var slotsFromLayout = extractTimeSlotsFromLayoutData(resultOffline, dsid);
            timeSlots = timeSlots.concat(slotsFromLayout);
        }
    } catch (error) {
        console.error('=== EXTRACT TIME SLOTS: Error:', error);
    }

    return timeSlots;
}

// Function to extract HTML slots from localStorage
function extractHtmlSlotsFromLocalStorage() {
    console.log('=== EXTRACT HTML SLOTS: Function started ===');
    var htmlSlots = [];

    try {
        var resultOffline = JSON.parse(localStorage.getItem(dsid));
        if (!resultOffline) {
            console.warn('=== EXTRACT HTML SLOTS: No data found in localStorage for DSID:', dsid);
            return htmlSlots;
        }

        var layoutType = resultOffline['elements'][0]['elements'][0]['name'];
        if (layoutType == 'loop') {
            resultOffline = resultOffline['elements'][0]['elements'][0]['elements'];
            $.when.apply($, $.map(resultOffline, function (layoutxml, oindex) {
                var layoutURL = layoutxml['attributes']['url'];
                var layoutID = layoutURL.split('layout/')[1].slice(0, layoutURL.split('layout/')[1].lastIndexOf('/'));
                var layoutData = JSON.parse(localStorage.getItem('layout-' + layoutID));
                var slotsFromLayout = extractHtmlSlotsFromLayoutData(layoutData, layoutID);
                htmlSlots = htmlSlots.concat(slotsFromLayout);
            }));
        } else {
            var slotsFromLayout = extractHtmlSlotsFromLayoutData(resultOffline, dsid);
            htmlSlots = htmlSlots.concat(slotsFromLayout);
        }
    } catch (error) {
        console.error('=== EXTRACT HTML SLOTS: Error:', error);
    }

    return htmlSlots;
}

// Function to extract table slots from localStorage
function extractTableSlotsFromLocalStorage() {
    console.log('=== EXTRACT TABLE SLOTS: Function started ===');
    var tableSlots = [];

    try {
        var resultOffline = JSON.parse(localStorage.getItem(dsid));
        if (!resultOffline) {
            console.warn('=== EXTRACT TABLE SLOTS: No data found in localStorage for DSID:', dsid);
            return tableSlots;
        }

        var layoutType = resultOffline['elements'][0]['elements'][0]['name'];
        if (layoutType == 'loop') {
            resultOffline = resultOffline['elements'][0]['elements'][0]['elements'];
            $.when.apply($, $.map(resultOffline, function (layoutxml, oindex) {
                var layoutURL = layoutxml['attributes']['url'];
                var layoutID = layoutURL.split('layout/')[1].slice(0, layoutURL.split('layout/')[1].lastIndexOf('/'));
                var layoutData = JSON.parse(localStorage.getItem('layout-' + layoutID));
                var slotsFromLayout = extractTableSlotsFromLayoutData(layoutData, layoutID);
                tableSlots = tableSlots.concat(slotsFromLayout);
            }));
        } else {
            var slotsFromLayout = extractTableSlotsFromLayoutData(resultOffline, dsid);
            tableSlots = tableSlots.concat(slotsFromLayout);
        }
    } catch (error) {
        console.error('=== EXTRACT TABLE SLOTS: Error:', error);
    }

    return tableSlots;
}

// Function to extract media slots from layout data structure
function extractMediaSlotsFromLayoutData(layoutData, layoutKey) {
    console.log('=== EXTRACT MEDIA LAYOUT DATA: Processing layout key:', layoutKey, layoutData);
    var mediaSlots = [];

    if (!layoutData || !layoutData.elements) {
        console.warn('=== EXTRACT MEDIA LAYOUT DATA: Invalid layout data or missing elements for key:', layoutKey);
        return mediaSlots;
    }

    console.log('=== EXTRACT MEDIA LAYOUT DATA: Layout data validation passed for key:', layoutKey);

    try {
        // Navigate through the layout structure to find slots
        var elements = layoutData.elements;
        console.log('=== EXTRACT MEDIA LAYOUT DATA: Elements array length:', elements.length);

        // Extract layout information
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;
        console.log('=== EXTRACT MEDIA LAYOUT DATA: Initial layout ID:', layoutId, 'layout name:', layoutName);

        // Try to get the actual layout name from XML attributes
        if (elements[0] && elements[0].attributes) {
            console.log('=== EXTRACT MEDIA LAYOUT DATA: Checking for layout name in attributes');
            if (elements[0].attributes.layout) {
                layoutName = elements[0].attributes.layout;
                console.log('=== EXTRACT MEDIA LAYOUT DATA: Found layout name from layout attribute:', layoutName);
            } else if (elements[0].attributes.name) {
                layoutName = elements[0].attributes.name;
                console.log('=== EXTRACT MEDIA LAYOUT DATA: Found layout name from name attribute:', layoutName);
            } else if (elements[0].attributes.title) {
                layoutName = elements[0].attributes.title;
                console.log('=== EXTRACT MEDIA LAYOUT DATA: Found layout name from title attribute:', layoutName);
            }
        }

        // Try to find the layout structure (may vary)
        var slotsContainer = null;
        console.log('=== EXTRACT MEDIA LAYOUT DATA: Searching for slots container');

        // Common pattern: elements[0].elements[0].elements[0].elements (slot list)
        if (elements[0] &&
            elements[0].elements && elements[0].elements[0] &&
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
            console.log('=== EXTRACT MEDIA LAYOUT DATA: Found slots container with', slotsContainer.length, 'slots');
        } else {
            console.warn('=== EXTRACT MEDIA LAYOUT DATA: Could not find slots container in expected structure');
        }

        if (slotsContainer && Array.isArray(slotsContainer)) {
            var mediaSlotCount = 0;
            console.log('=== EXTRACT MEDIA LAYOUT DATA: Processing', slotsContainer.length, 'slots');

            slotsContainer.forEach(function (slot, index) {
                console.log('=== EXTRACT MEDIA LAYOUT DATA: Processing slot', index, 'type:', slot.name);

                if (slot.attributes && slot.attributes.id) {
                    // Check if it's a media slot
                    if (slot.name === 'media') {

                        mediaSlotCount++;
                        console.log('=== EXTRACT MEDIA LAYOUT DATA: Found media slot', mediaSlotCount, '- ID:', slot.attributes.id, 'Name:', slot.attributes.name, 'Type:', slot.name);

                        var mediaContent = '';

                        // Try to extract media content (file path)
                        if (slot.elements && slot.elements[0] &&
                            slot.elements[0].elements && slot.elements[0].elements[0] &&
                            slot.elements[0].elements[0].text) {
                            mediaContent = slot.elements[0].elements[0].text;
                            console.log('=== EXTRACT MEDIA LAYOUT DATA: Extracted media content:', mediaContent);

                            // Extract just the filename from path
                            if (mediaContent) {
                                var n = mediaContent.lastIndexOf('/');
                                if (n !== -1) {
                                    var originalContent = mediaContent;
                                    mediaContent = mediaContent.substring(n + 1);
                                    console.log('=== EXTRACT MEDIA LAYOUT DATA: Extracted filename from path:', originalContent, '->', mediaContent);
                                }
                            }
                        } else {
                            console.log('=== EXTRACT MEDIA LAYOUT DATA: No media content found for slot');
                        }

                        var slotObj = {
                            myid: layoutId,
                            layout: layoutName,
                            layoutid: layoutId,
                            id: slot.attributes.id,
                            name: slot.attributes.name || ('media-' + slot.attributes.id),
                            slottype: capitalizeFirstLetter(slot.name),
                            text: mediaContent || 'not-found'
                        };

                        mediaSlots.push(slotObj);
                        console.log('=== EXTRACT MEDIA LAYOUT DATA: Added media slot to collection:', slotObj.name);
                    } else {
                        console.log('=== EXTRACT MEDIA LAYOUT DATA: Skipping non-media slot type:', slot.name);
                    }
                } else {
                    console.log('=== EXTRACT MEDIA LAYOUT DATA: Skipping slot due to missing attributes - ID:', slot.attributes?.id, 'Name:', slot.attributes?.name);
                }
            });

            console.log('=== EXTRACT MEDIA LAYOUT DATA: Total media slots found in layout:', mediaSlotCount);
        } else {
            console.warn('=== EXTRACT MEDIA LAYOUT DATA: No valid slots container found');
        }

    } catch (error) {
        console.error('=== EXTRACT MEDIA LAYOUT DATA: Error extracting media slots from layout:', layoutKey, error);
        console.error('=== EXTRACT MEDIA LAYOUT DATA: Error stack:', error.stack);
    }

    console.log('=== EXTRACT MEDIA LAYOUT DATA: Completed processing layout key:', layoutKey, '- returning', mediaSlots.length, 'media slots');
    return mediaSlots;
}

// Function to extract ticker slots from layout data structure
function extractTickerSlotsFromLayoutData(layoutData, layoutKey) {
    console.log('=== EXTRACT TICKER LAYOUT DATA: Processing layout key:', layoutKey, layoutData);
    var tickerSlots = [];

    if (!layoutData || !layoutData.elements) {
        console.warn('=== EXTRACT TICKER LAYOUT DATA: Invalid layout data or missing elements for key:', layoutKey);
        return tickerSlots;
    }

    try {
        var elements = layoutData.elements;
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;

        // Find slots container
        var slotsContainer = null;
        if (elements[0] && elements[0].elements && elements[0].elements[0] &&
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
        }

        if (slotsContainer && Array.isArray(slotsContainer)) {
            slotsContainer.forEach(function (slot, index) {
                if (slot.attributes && slot.attributes.id && slot.name === 'ticker') {
                    var tickerContent = '';
                    if (slot.elements && slot.elements[0] && slot.elements[0].elements && slot.elements[0].elements[0] &&
                        slot.elements[0].elements[0].text) {
                        tickerContent = slot.elements[0].elements[0].text;
                    }

                    var slotObj = {
                        myid: layoutId,
                        layout: layoutName,
                        layoutid: layoutId,
                        id: slot.attributes.id,
                        name: slot.attributes.name || ('ticker-' + slot.attributes.id),
                        slottype: 'Ticker',
                        text: tickerContent || 'no-content',
                        speed: slot.attributes.speed || slot.attributes.scrollspeed || '',
                        direction: slot.attributes.direction || 'left'
                    };

                    tickerSlots.push(slotObj);
                }
            });
        }
    } catch (error) {
        console.error('=== EXTRACT TICKER LAYOUT DATA: Error extracting ticker slots from layout:', layoutKey, error);
    }

    return tickerSlots;
}

// Function to extract scroller slots from layout data structure
function extractScrollerSlotsFromLayoutData(layoutData, layoutKey) {
    console.log('=== EXTRACT SCROLLER LAYOUT DATA: Processing layout key:', layoutKey, layoutData);
    var scrollerSlots = [];

    if (!layoutData || !layoutData.elements) {
        console.warn('=== EXTRACT SCROLLER LAYOUT DATA: Invalid layout data or missing elements for key:', layoutKey);
        return scrollerSlots;
    }

    try {
        var elements = layoutData.elements;
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;

        // Find slots container
        var slotsContainer = null;
        if (elements[0] && elements[0].elements && elements[0].elements[0] &&
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
        }

        if (slotsContainer && Array.isArray(slotsContainer)) {
            slotsContainer.forEach(function (slot, index) {
                if (slot.attributes && slot.attributes.id && slot.name === 'scroller') {
                    var scrollerContent = '';
                    if (slot.elements && slot.elements[0] && slot.elements[0].elements && slot.elements[0].elements[0] &&
                        slot.elements[0].elements[0].text) {
                        scrollerContent = slot.elements[0].elements[0].text;
                    }

                    var slotObj = {
                        myid: layoutId,
                        layout: layoutName,
                        layoutid: layoutId,
                        id: slot.attributes.id,
                        name: slot.attributes.name || ('scroller-' + slot.attributes.id),
                        slottype: 'Scroller',
                        text: scrollerContent || 'no-content',
                        speed: slot.attributes.speed || slot.attributes.scrollspeed || '',
                        direction: slot.attributes.direction || 'up'
                    };

                    scrollerSlots.push(slotObj);
                }
            });
        }
    } catch (error) {
        console.error('=== EXTRACT SCROLLER LAYOUT DATA: Error extracting scroller slots from layout:', layoutKey, error);
    }

    return scrollerSlots;
}

// Function to extract fader slots from layout data structure
function extractFaderSlotsFromLayoutData(layoutData, layoutKey) {
    console.log('=== EXTRACT FADER LAYOUT DATA: Processing layout key:', layoutKey, layoutData);
    var faderSlots = [];

    if (!layoutData || !layoutData.elements) {
        console.warn('=== EXTRACT FADER LAYOUT DATA: Invalid layout data or missing elements for key:', layoutKey);
        return faderSlots;
    }

    try {
        var elements = layoutData.elements;
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;

        // Find slots container
        var slotsContainer = null;
        if (elements[0] && elements[0].elements && elements[0].elements[0] &&
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
        }

        if (slotsContainer && Array.isArray(slotsContainer)) {
            slotsContainer.forEach(function (slot, index) {
                if (slot.attributes && slot.attributes.id && slot.name === 'fader') {
                    var faderContent = '';
                    if (slot.elements && slot.elements[0] && slot.elements[0].elements && slot.elements[0].elements[0] &&
                        slot.elements[0].elements[0].text) {
                        faderContent = slot.elements[0].elements[0].text;
                    }

                    var slotObj = {
                        myid: layoutId,
                        layout: layoutName,
                        layoutid: layoutId,
                        id: slot.attributes.id,
                        name: slot.attributes.name || ('fader-' + slot.attributes.id),
                        slottype: 'Fader',
                        text: faderContent || 'no-content',
                        speed: slot.attributes.speed || slot.attributes.fadespeed || '',
                        duration: slot.attributes.duration || slot.attributes.fadeduration || ''
                    };

                    faderSlots.push(slotObj);
                }
            });
        }
    } catch (error) {
        console.error('=== EXTRACT FADER LAYOUT DATA: Error extracting fader slots from layout:', layoutKey, error);
    }

    return faderSlots;
}

// Function to extract date slots from layout data structure
function extractDateSlotsFromLayoutData(layoutData, layoutKey) {
    console.log('=== EXTRACT DATE LAYOUT DATA: Processing layout key:', layoutKey, layoutData);
    var dateSlots = [];

    if (!layoutData || !layoutData.elements) {
        console.warn('=== EXTRACT DATE LAYOUT DATA: Invalid layout data or missing elements for key:', layoutKey);
        return dateSlots;
    }

    try {
        var elements = layoutData.elements;
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;

        // Find slots container
        var slotsContainer = null;
        if (elements[0] && elements[0].elements && elements[0].elements[0] &&
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
        }

        if (slotsContainer && Array.isArray(slotsContainer)) {
            slotsContainer.forEach(function (slot, index) {
                if (slot.attributes && slot.attributes.id && slot.name === 'date') {
                    var slotObj = {
                        myid: layoutId,
                        layout: layoutName,
                        layoutid: layoutId,
                        id: slot.attributes.id,
                        name: slot.attributes.name || ('date-' + slot.attributes.id),
                        slottype: 'Date',
                        text: 'Current Date',
                        format: slot.attributes.format || slot.attributes.dateformat || 'DD/MM/YYYY',
                        timezone: slot.attributes.timezone || ''
                    };

                    dateSlots.push(slotObj);
                }
            });
        }
    } catch (error) {
        console.error('=== EXTRACT DATE LAYOUT DATA: Error extracting date slots from layout:', layoutKey, error);
    }

    return dateSlots;
}

// Function to extract time slots from layout data structure
function extractTimeSlotsFromLayoutData(layoutData, layoutKey) {
    console.log('=== EXTRACT TIME LAYOUT DATA: Processing layout key:', layoutKey, layoutData);
    var timeSlots = [];

    if (!layoutData || !layoutData.elements) {
        console.warn('=== EXTRACT TIME LAYOUT DATA: Invalid layout data or missing elements for key:', layoutKey);
        return timeSlots;
    }

    try {
        var elements = layoutData.elements;
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;

        // Find slots container
        var slotsContainer = null;
        if (elements[0] && elements[0].elements && elements[0].elements[0] &&
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
        }

        if (slotsContainer && Array.isArray(slotsContainer)) {
            slotsContainer.forEach(function (slot, index) {
                if (slot.attributes && slot.attributes.id && slot.name === 'time') {
                    var slotObj = {
                        myid: layoutId,
                        layout: layoutName,
                        layoutid: layoutId,
                        id: slot.attributes.id,
                        name: slot.attributes.name || ('time-' + slot.attributes.id),
                        slottype: 'Time',
                        text: 'Current Time',
                        format: slot.attributes.format || slot.attributes.timeformat || 'HH:MM:SS',
                        timezone: slot.attributes.timezone || '',
                        showSeconds: slot.attributes.showseconds || 'Y'
                    };

                    timeSlots.push(slotObj);
                }
            });
        }
    } catch (error) {
        console.error('=== EXTRACT TIME LAYOUT DATA: Error extracting time slots from layout:', layoutKey, error);
    }

    return timeSlots;
}

// Function to extract datetime slots from localStorage
function extractDateTimeSlotsFromLocalStorage() {
    console.log('=== EXTRACT DATETIME SLOTS: Function started ===');
    var datetimeSlots = [];

    try {
        var resultOffline = JSON.parse(localStorage.getItem(dsid));
        if (!resultOffline) {
            console.warn('=== EXTRACT DATETIME SLOTS: No data found in localStorage for DSID:', dsid);
            return datetimeSlots;
        }

        var layoutType = resultOffline['elements'][0]['elements'][0]['name'];
        if (layoutType == 'loop') {
            resultOffline = resultOffline['elements'][0]['elements'][0]['elements'];
            $.when.apply($, $.map(resultOffline, function (layoutxml, oindex) {
                var layoutURL = layoutxml['attributes']['url'];
                var layoutID = layoutURL.split('layout/')[1].slice(0, layoutURL.split('layout/')[1].lastIndexOf('/'));
                var layoutData = JSON.parse(localStorage.getItem('layout-' + layoutID));
                var slotsFromLayout = extractDateTimeSlotsFromLayoutData(layoutData, layoutID);
                datetimeSlots = datetimeSlots.concat(slotsFromLayout);
            }));
        } else {
            var slotsFromLayout = extractDateTimeSlotsFromLayoutData(resultOffline, dsid);
            datetimeSlots = datetimeSlots.concat(slotsFromLayout);
        }
    } catch (error) {
        console.error('=== EXTRACT DATETIME SLOTS: Error:', error);
    }

    return datetimeSlots;
}

// Function to extract datetime slots from layout data structure
function extractDateTimeSlotsFromLayoutData(layoutData, layoutKey) {
    console.log('=== EXTRACT DATETIME LAYOUT DATA: Processing layout key:', layoutKey, layoutData);
    var datetimeSlots = [];

    if (!layoutData || !layoutData.elements) {
        console.warn('=== EXTRACT DATETIME LAYOUT DATA: Invalid layout data or missing elements for key:', layoutKey);
        return datetimeSlots;
    }

    try {
        var elements = layoutData.elements;
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;

        // Find slots container
        var slotsContainer = null;
        if (elements[0] && elements[0].elements && elements[0].elements[0] &&
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
        }

        if (slotsContainer && Array.isArray(slotsContainer)) {
            slotsContainer.forEach(function (slot, index) {
                if (slot.attributes && slot.attributes.id && slot.name === 'datetime') {
                    var slotObj = {
                        myid: layoutId,
                        layout: layoutName,
                        layoutid: layoutId,
                        id: slot.attributes.id,
                        name: slot.attributes.name || ('datetime-' + slot.attributes.id),
                        slottype: 'DateTime',
                        text: 'Current DateTime',
                        format: slot.attributes.format || 'YYYY-MM-DD HH:mm:ss',
                        timezone: slot.attributes.timezone || ''
                    };

                    datetimeSlots.push(slotObj);
                }
            });
        }
    } catch (error) {
        console.error('=== EXTRACT DATETIME LAYOUT DATA: Error extracting datetime slots from layout:', layoutKey, error);
    }

    return datetimeSlots;
}

// Function to extract HTML slots from layout data structure
function extractHtmlSlotsFromLayoutData(layoutData, layoutKey) {
    console.log('=== EXTRACT HTML LAYOUT DATA: Processing layout key:', layoutKey, layoutData);
    var htmlSlots = [];

    if (!layoutData || !layoutData.elements) {
        console.warn('=== EXTRACT HTML LAYOUT DATA: Invalid layout data or missing elements for key:', layoutKey);
        return htmlSlots;
    }

    try {
        var elements = layoutData.elements;
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;

        // Find slots container
        var slotsContainer = null;
        if (elements[0] && elements[0].elements && elements[0].elements[0] &&
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
        }

        if (slotsContainer && Array.isArray(slotsContainer)) {
            slotsContainer.forEach(function (slot, index) {
                if (slot.attributes && slot.attributes.id && slot.name === 'html') {
                    var htmlContent = '';
                    if (slot.elements && slot.elements[0] && slot.elements[0].elements && slot.elements[0].elements[0] &&
                        slot.elements[0].elements[0].text) {
                        htmlContent = slot.elements[0].elements[0].text;
                    }

                    var slotObj = {
                        myid: layoutId,
                        layout: layoutName,
                        layoutid: layoutId,
                        id: slot.attributes.id,
                        name: slot.attributes.name || ('html-' + slot.attributes.id),
                        slottype: 'HTML',
                        text: htmlContent || 'no-content'
                    };

                    htmlSlots.push(slotObj);
                }
            });
        }
    } catch (error) {
        console.error('=== EXTRACT HTML LAYOUT DATA: Error extracting HTML slots from layout:', layoutKey, error);
    }

    return htmlSlots;
}

// Function to extract table slots from layout data structure
function extractTableSlotsFromLayoutData(layoutData, layoutKey) {
    console.log('=== EXTRACT TABLE LAYOUT DATA: Processing layout key:', layoutKey, layoutData);
    var tableSlots = [];

    if (!layoutData || !layoutData.elements) {
        console.warn('=== EXTRACT TABLE LAYOUT DATA: Invalid layout data or missing elements for key:', layoutKey);
        return tableSlots;
    }

    try {
        var elements = layoutData.elements;
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;

        // Find slots container
        var slotsContainer = null;
        if (elements[0] && elements[0].elements && elements[0].elements[0] &&
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
        }

        if (slotsContainer && Array.isArray(slotsContainer)) {
            slotsContainer.forEach(function (slot, index) {
                if (slot.attributes && slot.attributes.id && slot.name === 'table') {
                    var slotObj = {
                        myid: layoutId,
                        layout: layoutName,
                        layoutid: layoutId,
                        id: slot.attributes.id,
                        name: slot.attributes.name || ('table-' + slot.attributes.id),
                        slottype: 'Table',
                        text: 'Table Data',
                        columns: slot.attributes.columns || '',
                        rows: slot.attributes.rows || '',
                        datasource: slot.attributes.datasource || '',
                        headers: slot.attributes.headers || 'Y'
                    };

                    tableSlots.push(slotObj);
                }
            });
        }
    } catch (error) {
        console.error('=== EXTRACT TABLE LAYOUT DATA: Error extracting table slots from layout:', layoutKey, error);
    }

    return tableSlots;
}

//replace media - OFFLINE VERSION
socket.on('replacemediaslot', function (msg) {
    console.log('=== RENDERER PROCESS: replacemediaslot REQUEST RECEIVED (OFFLINE MODE) ===');
    console.log('=== RENDERER PROCESS: Message:', msg);
    console.log('=== RENDERER PROCESS: isLoopLyt status:', isLoopLyt);
    console.log('=== RENDERER PROCESS: slotnameList length:', slotnameList.length);

    // Get layout ID and slot information using improved method with slotnameList
    var slotInfo = getCurrentLayoutID(msg['slotname'], slotnameList);
    console.log('=== RENDERER PROCESS: Slot info from getCurrentLayoutID:', slotInfo);

    var layoutid = slotInfo.layoutid;
    var id = slotInfo.slotid;

    // Apply fallback values if needed
    if (!layoutid) {
        layoutid = '2'; // Default fallback
        console.log('=== RENDERER PROCESS: Using default Layout ID:', layoutid);
    }

    console.log('=== RENDERER PROCESS: Final Layout ID:', layoutid, 'Slot ID:', id);

    // Extract numeric slot ID for media handling
    var numericId = id.split('-')[1];
    var src = msg['slottext'];
    var resfolder = msg['resfolder'];
    console.log('=== RENDERER PROCESS: Parsed numeric slot ID:', numericId, 'Source:', src, 'Resource folder:', resfolder);

    var n = src.lastIndexOf('.');
    var mediamode = src.substring(n + 1);
    var mediaLocalPath = resfolder + '/' + src;
    console.log('=== RENDERER PROCESS: Media mode:', mediamode, 'Local path:', mediaLocalPath);

    var duration = 0;
    var ytbe = src.split("/");

    // Create media object based on media type
    var contentObj = createMediaObject(src, mediamode, mediaLocalPath, duration, ytbe);

    // Helper function to update media content in DOM
    function updateMediaSlotContent(layoutIdToSave) {
        // Save current playing layout ID using sync function for consistent tracking
        if (layoutIdToSave) {
            syncCurrentPlayLayoutID(layoutIdToSave);
        }

        try {
            if (contentObj) {
                mediaCurIndex[numericId] = 1;
                medialoop[numericId] = [];
                medialoop[numericId].push(contentObj);
                $('#slot-' + numericId).html('');
                console.log('=== RENDERER PROCESS: Cleared slot content and initialized media arrays ===');
                appendMediaElement(medialoop[numericId][0], '#slot-' + numericId, numericId);
                console.log('=== RENDERER PROCESS: Called appendMediaElement ===');
            }

            console.log('=== RENDERER PROCESS: Media content update completed successfully');

            if (loopTimeout) {
                console.log('=== RENDERER PROCESS: Clearing existing loopTimeout to prevent conflicts ===');
                clearTimeout(loopTimeout);
                loopTimeout = null;
            }
            if (mediaTimeout[id]) { //clear mediaTimeout to reset
                console.log('=== RENDERER PROCESS: Clearing existing mediaTimeout for slotid:', id);
                clearTimeout(mediaTimeout[id])
            }
        } catch (error) {
            console.error('=== RENDERER PROCESS: Error during media content update:', error);
        }
    }

    // Check isLoopLyt - if content is for different layout, do layout update first
    if (isLoopLyt) {
        // Ensure currentPlayLayoutID is properly initialized
        if (currentPlayLayoutID === null) {
            getCurrentPlayLayoutID(); // This will update the global variable
        }

        if (typeof currentPlayLayoutID !== 'undefined' && currentPlayLayoutID && layoutid === currentPlayLayoutID) {
            // Content is for current layout - skip layout switch, go straight to content update
            console.log('=== RENDERER PROCESS: Content for current layout - updating DOM directly ===');
            updateMediaSlotContent(layoutid);
            return;
        }

        console.log('=== RENDERER PROCESS: Content for different layout ID (' + layoutid + ') - using temporary layout switch ===');

        // Check if target layout is available offline
        if (!isLayoutAvailableOffline(layoutid)) {
            console.error('=== RENDERER PROCESS: Target layout not available offline:', layoutid);
            console.log('=== RENDERER PROCESS: Available layouts:', getAvailableLayoutsFromDS());

            // Try to find an alternative layout or use current layout
            var availableLayouts = getAvailableLayoutsFromDS();
            var foundAlternative = false;

            for (var i = 0; i < availableLayouts.length; i++) {
                if (availableLayouts[i].id === layoutid) {
                    foundAlternative = true;
                    break;
                }
            }

            if (!foundAlternative) {
                console.warn('=== RENDERER PROCESS: Layout not found in available layouts, updating current layout content only ===');
                if (currentPlayLayoutID && isLayoutAvailableOffline(currentPlayLayoutID)) {
                    updateMediaSlotContent(currentPlayLayoutID);
                } else {
                    console.error('=== RENDERER PROCESS: No suitable layout found for media update ===');
                }
                return;
            }
        }

        // Use temporary layout switching to preserve loop mode
        switchToLayoutTemporarilyInLoop(layoutid, function (success, message) {
            console.log('=== RENDERER PROCESS: replacemediaslot temporary switch completed:', success, message);
            updateMediaSlotContent(layoutid);
        });

        return; // Exit here for loop mode processing
    }

    // Non-loop layout mode - update content directly
    console.log('=== RENDERER PROCESS: Non-loop layout mode - updating DOM directly (offline) ===');
    updateMediaSlotContent(layoutid);
})

// Helper function to create media object based on media type
function createMediaObject(src, mediamode, mediaLocalPath, duration, ytbe) {
    var contentObj = new Object();

    if (['png', 'jpg', 'jpeg', 'bmp', 'gif'].includes(mediamode)) { //image format
        console.log('=== RENDERER PROCESS: Processing image media ===');
        duration = 9999999
        contentObj.contentUrl = mediaLocalPath
        contentObj.contentDuration = duration
        contentObj.contentType = "image/" + mediamode
        contentObj.mediaType = "IMAGE"
    } else if (ytbe[2] == 'youtu.be') {
        console.log('=== RENDERER PROCESS: Processing YouTube media ===');
        contentObj.contentUrl = ytbe[3]
        contentObj.contentDuration = duration
        contentObj.contentType = "youtube"
        contentObj.mediaType = "YTB"
    } else if (mediamode == 'm3u8' || mediamode == 'm3u') { //video m3u8 format
        console.log('=== RENDERER PROCESS: Processing m3u8 stream media ===');
        contentObj.contentUrl = src
        contentObj.contentDuration = duration
        contentObj.contentType = "application/x-mpegURL"
        contentObj.mediaType = "STREAM"
    } else if (['mp4', 'webm', 'mkv'].includes(mediamode)) { //video mp4/webm format
        console.log('=== RENDERER PROCESS: Processing video media (mp4/webm/mkv) ===');
        contentObj.contentUrl = mediaLocalPath
        contentObj.contentDuration = duration
        contentObj.contentType = "video/mp4"
        contentObj.mediaType = "VIDEO"
    } else if (['flv'].includes(mediamode)) { //video flv format
        console.log('=== RENDERER PROCESS: Processing FLV stream media ===');
        contentObj.contentUrl = src
        contentObj.contentDuration = duration
        contentObj.contentType = "video/x-flv"
        contentObj.mediaType = "CCTV"
    } else { //none 
        console.log('=== RENDERER PROCESS: WARNING - Unknown media format:', mediamode, '===');
        return null;
    }

    return contentObj;
}

function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// ========================================
// ENHANCED LAYOUT DETAILS SYSTEM
// ========================================

// Socket handler for layout details request from control panel
socket.on('get-layout-details', function (request) {
    console.log('=== RENDERER PROCESS: Enhanced layout details request received ===');

    try {
        // Detect layout mode first
        var layoutMode = detectLayoutMode();
        console.log('=== RENDERER PROCESS: Layout mode detected:', layoutMode);

        var response = {
            layouts: [],
            currentLayout: null,
            isLoop: layoutMode.isLoop,
            layoutCount: layoutMode.layoutCount,
            totalSlots: 0,
            textSlots: 0,
            mediaSlots: 0,
            tickerSlots: 0,
            scrollerSlots: 0,
            faderSlots: 0,
            dateSlots: 0,
            timeSlots: 0,
            datetimeSlots: 0,
            htmlSlots: 0,
            tableSlots: 0,
            timestamp: Date.now(),
            mode: layoutMode.isLoop ? 'loop' : 'single'
        };

        if (layoutMode.isLoop) {
            // Loop mode - get all layouts with detailed information
            console.log('=== RENDERER PROCESS: Processing loop mode with', layoutMode.layoutCount, 'layouts ===');
            
            var loopLayouts = getAllLoopLayoutDetails();
            response.layouts = loopLayouts;

            // Calculate totals across all layouts in the loop
            loopLayouts.forEach(function(layout) {
                response.totalSlots += layout.totalSlots || 0;
                response.textSlots += layout.textSlotCount || 0;
                response.mediaSlots += layout.mediaSlotCount || 0;
                if (layout.slotSummary) {
                    response.tickerSlots += layout.slotSummary.ticker || 0;
                    response.scrollerSlots += layout.slotSummary.scroller || 0;
                    response.faderSlots += layout.slotSummary.fader || 0;
                    response.dateSlots += layout.slotSummary.date || 0;
                    response.timeSlots += layout.slotSummary.time || 0;
                    response.datetimeSlots += layout.slotSummary.datetime || 0;
                    response.htmlSlots += layout.slotSummary.html || 0;
                    response.tableSlots += layout.slotSummary.table || 0;
                }
            });

            // Identify current layout if available
            if (typeof currentPlayLayoutID !== 'undefined' && currentPlayLayoutID) {
                response.currentLayout = loopLayouts.find(function(layout) {
                    return layout.id === currentPlayLayoutID;
                }) || null;
            } else if (loopLayouts.length > 0) {
                response.currentLayout = loopLayouts[0]; // Default to first layout
            }

        } else {
            // Single mode - get single layout details
            console.log('=== RENDERER PROCESS: Processing single layout mode ===');
            
            var availableLayouts = getAvailableLayoutsFromDS();
            if (availableLayouts.length > 0) {
                var singleLayout = getDetailedLayoutInfo(availableLayouts[0].id, availableLayouts[0]);
                response.layouts = [singleLayout];
                response.currentLayout = singleLayout;
                response.totalSlots = singleLayout.totalSlots || 0;
                response.textSlots = singleLayout.textSlotCount || 0;
                response.mediaSlots = singleLayout.mediaSlotCount || 0;
                if (singleLayout.slotSummary) {
                    response.tickerSlots = singleLayout.slotSummary.ticker || 0;
                    response.scrollerSlots = singleLayout.slotSummary.scroller || 0;
                    response.faderSlots = singleLayout.slotSummary.fader || 0;
                    response.dateSlots = singleLayout.slotSummary.date || 0;
                    response.timeSlots = singleLayout.slotSummary.time || 0;
                    response.datetimeSlots = singleLayout.slotSummary.datetime || 0;
                    response.htmlSlots = singleLayout.slotSummary.html || 0;
                    response.tableSlots = singleLayout.slotSummary.table || 0;
                }
            }
        }

        console.log('=== RENDERER PROCESS: Layout details response prepared:', {
            layoutCount: response.layouts.length,
            isLoop: response.isLoop,
            totalSlots: response.totalSlots,
            currentLayoutId: response.currentLayout ? response.currentLayout.id : null
        });

        // Send comprehensive response
        socket.emit('layout-details-response', response);

    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting enhanced layout details:', error);

        // Send error response
        socket.emit('layout-details-response', {
            layouts: [],
            currentLayout: null,
            isLoop: false,
            layoutCount: 0,
            totalSlots: 0,
            textSlots: 0,
            mediaSlots: 0,
            tickerSlots: 0,
            scrollerSlots: 0,
            faderSlots: 0,
            dateSlots: 0,
            timeSlots: 0,
            datetimeSlots: 0,
            htmlSlots: 0,
            tableSlots: 0,
            timestamp: Date.now(),
            error: 'Failed to retrieve layout details: ' + error.message
        });
    }
});

// Comprehensive function to get all layout details
function getComprehensiveLayoutDetails() {
    console.log('=== LAYOUT DETAILS: Starting comprehensive layout analysis ===');

    var layoutDetails = {
        layouts: [],
        currentLayout: null,
        isLoop: false,
        totalSlots: 0,
        textSlots: 0,
        mediaSlots: 0,
        timestamp: Date.now()
    };

    try {
        // Check if dsid is available
        if (typeof dsid === 'undefined' || !dsid) {
            console.warn('=== LAYOUT DETAILS: No DSID available, returning empty data ===');
            return layoutDetails;
        }

        // Get available layouts from DS data
        var availableLayouts = getAvailableLayoutsFromDS();
        console.log('=== LAYOUT DETAILS: Found', availableLayouts.length, 'available layouts');

        // Determine if it's loop mode
        layoutDetails.isLoop = availableLayouts.length > 1 || (availableLayouts.length === 1 && availableLayouts[0].type === 'loop');

        // Process each available layout
        availableLayouts.forEach(function (layoutInfo) {
            try {
                var layoutData = getLayoutFromStorage(layoutInfo.id);

                if (layoutData) {
                    var processedLayout = processLayoutForDetails(layoutInfo.id, layoutData, layoutInfo);
                    layoutDetails.layouts.push(processedLayout);

                    // Update totals
                    layoutDetails.totalSlots += processedLayout.totalSlots || 0;
                    layoutDetails.textSlots += (processedLayout.textSlots && processedLayout.textSlots.length) || 0;
                    layoutDetails.mediaSlots += (processedLayout.mediaSlots && processedLayout.mediaSlots.length) || 0;

                    // Check if this is the current layout
                    if (typeof currentPlayLayoutID !== 'undefined' && currentPlayLayoutID && currentPlayLayoutID === layoutInfo.id) {
                        layoutDetails.currentLayout = processedLayout;
                    }
                } else {
                    console.warn('=== LAYOUT DETAILS: No layout data found for layout:', layoutInfo.id);
                }
            } catch (layoutError) {
                console.error('=== LAYOUT DETAILS: Error processing layout', layoutInfo.id, ':', layoutError);
            }
        });

        // If no current layout identified but we have layouts, use the first one
        if (!layoutDetails.currentLayout && layoutDetails.layouts.length > 0) {
            layoutDetails.currentLayout = layoutDetails.layouts[0];
            console.log('=== LAYOUT DETAILS: No current layout ID, using first available layout ===');
        }

        console.log('=== LAYOUT DETAILS: Analysis complete ===');
        console.log('=== LAYOUT DETAILS: Total layouts:', layoutDetails.layouts.length);
        console.log('=== LAYOUT DETAILS: Total slots:', layoutDetails.totalSlots);
        console.log('=== LAYOUT DETAILS: Loop mode:', layoutDetails.isLoop);

        // Ensure final data structure is completely serializable
        var safeLayoutDetails = {
            layouts: layoutDetails.layouts || [],
            currentLayout: layoutDetails.currentLayout || null,
            isLoop: Boolean(layoutDetails.isLoop),
            totalSlots: Number(layoutDetails.totalSlots) || 0,
            textSlots: Number(layoutDetails.textSlots) || 0,
            mediaSlots: Number(layoutDetails.mediaSlots) || 0,
            timestamp: Number(layoutDetails.timestamp) || Date.now()
        };

        return safeLayoutDetails;

    } catch (error) {
        console.error('=== LAYOUT DETAILS: Error in comprehensive analysis:', error);
        // Return safe empty data instead of throwing
        return {
            layouts: [],
            currentLayout: null,
            isLoop: false,
            totalSlots: 0,
            textSlots: 0,
            mediaSlots: 0,
            timestamp: Date.now(),
            error: 'Analysis failed: ' + error.message
        };
    }
}

// Function to process individual layout for detailed information
function processLayoutForDetails(layoutId, layoutData, layoutInfo) {
    console.log('=== LAYOUT DETAILS: Processing layout', layoutId);

    var processedLayout = {
        id: layoutId,
        name: 'Layout ' + layoutId,
        type: (layoutInfo && layoutInfo.type) || 'unknown',
        index: (layoutInfo && layoutInfo.index) || 0,
        textSlots: [],
        mediaSlots: [],
        allSlots: [], // New comprehensive slot list
        totalSlots: 0,
        isActive: (typeof currentPlayLayoutID !== 'undefined' && currentPlayLayoutID === layoutId)
    };

    try {
        // Extract ALL slots comprehensively
        try {
            var allSlots = extractAllSlotsFromLayoutData(layoutData, 'layout-' + layoutId);
            processedLayout.allSlots = Array.isArray(allSlots) ? allSlots : [];

            // Ensure all slot data is serializable - clean up any non-serializable properties
            processedLayout.allSlots = processedLayout.allSlots.map(function (slot) {
                return {
                    id: String(slot.id || ''),
                    name: String(slot.name || ''),
                    type: String(slot.type || 'unknown'),
                    content: String(slot.content || ''),
                    layoutId: String(slot.layoutId || layoutId),
                    layoutName: String(slot.layoutName || ''),
                    enabled: String(slot.enabled || 'Y')
                };
            });

            // Separate slots by type for backward compatibility
            processedLayout.textSlots = allSlots.filter(slot => slot.type === 'text').map(slot => ({
                slotid: String(slot.id || ''),
                slotname: String(slot.name || ''),
                slottype: 'text',
                content: String(slot.content || ''),
                layoutid: String(slot.layoutId || layoutId)
            }));

            processedLayout.mediaSlots = allSlots.filter(slot => slot.type === 'media').map(slot => ({
                slotid: String(slot.id || ''),
                slotname: String(slot.name || ''),
                slottype: 'media',
                filename: String(slot.content || ''),
                layoutid: String(slot.layoutId || layoutId)
            }));

        } catch (allSlotsError) {
            console.warn('=== LAYOUT DETAILS: Error extracting all slots for layout', layoutId, ':', allSlotsError);
            processedLayout.allSlots = [];

            // Fallback to individual extraction methods
            try {
                var textSlots = extractTextSlotsFromLayoutData(layoutData, layoutId);
                processedLayout.textSlots = Array.isArray(textSlots) ? textSlots.map(function (slot) {
                    return {
                        slotid: String(slot.slotid || ''),
                        slotname: String(slot.slotname || ''),
                        slottype: 'text',
                        content: String(slot.content || ''),
                        layoutid: String(slot.layoutid || layoutId)
                    };
                }) : [];
            } catch (textError) {
                console.warn('=== LAYOUT DETAILS: Error extracting text slots for layout', layoutId, ':', textError);
                processedLayout.textSlots = [];
            }

            try {
                var mediaSlots = extractMediaSlotsFromLayoutData(layoutData, layoutId);
                processedLayout.mediaSlots = Array.isArray(mediaSlots) ? mediaSlots.map(function (slot) {
                    return {
                        slotid: String(slot.slotid || ''),
                        slotname: String(slot.slotname || ''),
                        slottype: 'media',
                        filename: String(slot.filename || ''),
                        layoutid: String(slot.layoutid || layoutId)
                    };
                }) : [];
            } catch (mediaError) {
                console.warn('=== LAYOUT DETAILS: Error extracting media slots for layout', layoutId, ':', mediaError);
                processedLayout.mediaSlots = [];
            }
        }

        // Calculate total slots
        processedLayout.totalSlots = processedLayout.allSlots.length || (processedLayout.textSlots.length + processedLayout.mediaSlots.length);

        // Ensure all main properties are serializable
        processedLayout.id = String(processedLayout.id || '');
        processedLayout.name = String(processedLayout.name || '');
        processedLayout.type = String(processedLayout.type || 'unknown');
        processedLayout.totalSlots = Number(processedLayout.totalSlots) || 0;
        processedLayout.isActive = Boolean(processedLayout.isActive);

        console.log('=== LAYOUT DETAILS: Layout', layoutId, 'processed - Total slots:', processedLayout.totalSlots, ', All slots:', processedLayout.allSlots.length);

        return processedLayout;

    } catch (error) {
        console.error('=== LAYOUT DETAILS: Error processing layout', layoutId, ':', error);
        return processedLayout; // Return with empty slots
    }
}
// =============================================================================
// Airport Display — normalized zone_trigger events from CLESS-Server via cpanel
// =============================================================================
socket.on('airport-display', function (payload) {
    console.log('=== RENDERER PROCESS: airport-display event received ===', payload && payload.event_id);
    try {
        if (typeof AirportDisplayPlayer === 'undefined' || !AirportDisplayPlayer.handle) {
            console.error('AirportDisplayPlayer module not loaded');
            if (socket && socket.emit) {
                socket.emit('airport-display-status', {
                    event_id: payload && payload.event_id,
                    status: 'error',
                    message: 'AirportDisplayPlayer not loaded',
                    timestamp: new Date().toISOString()
                });
            }
            return;
        }
        var result = AirportDisplayPlayer.handle(payload || {});
        console.log('=== RENDERER PROCESS: airport-display result ===', result);
    } catch (err) {
        console.error('=== RENDERER PROCESS: airport-display handler error ===', err);
    }
});
