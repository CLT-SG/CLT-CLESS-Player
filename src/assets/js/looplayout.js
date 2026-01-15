// Global variables for layout management
var loopArr = []
var layoutURLList = []
var layoutIDList = []
var loopXMLCurIndex = 1
var loopTimeout = null

// Global variables for timeout management
var loopTimeoutStartTime = null
var loopTimeoutDuration = null
var loopTimeoutPaused = false

// Global timeout and interval arrays (initialized if not already defined)
var textTimeout = textTimeout || []
var mediaTimeout = mediaTimeout || []
var colImageTimeout = colImageTimeout || []
var colFaderTimeout = colFaderTimeout || []
var pageAutoInterval = pageAutoInterval || []

// Additional global variables (should be defined in main HTML files)
var currentlytID = currentlytID || ''
var dsid = dsid || ''
var isLoopLyt = isLoopLyt || false

// Additional global arrays used by layoutxml.js when isLoopLyt is true
var pagerow = pagerow || []
var videoJSPlayer = videoJSPlayer || []

// Global variables for layout loop transition effects
var loopTransitionStyle = 'none' // Options: none, fade, slide-right, slide-left, scroll-up, scroll-down
var loopTransitionSpeed = 1000 // Default transition duration in milliseconds
var loopTransitionDelay = 0 // Default start delay in milliseconds

// Function to pause loopTimeout during content updates
function pauseLoopTimeout(reason) {
  if (loopTimeout && !loopTimeoutPaused && isLoopLyt) {
    try {
      var currentTime = Date.now();
      var elapsedTime = currentTime - loopTimeoutStartTime;
      var remainingTime = loopTimeoutDuration - elapsedTime;
      
      console.log('=== LOOP TIMEOUT: Pausing for reason:', reason);
      console.log('=== LOOP TIMEOUT: Elapsed time:', elapsedTime, 'ms, Remaining time:', remainingTime, 'ms');
      
      clearTimeout(loopTimeout);
      loopTimeout = null;
      loopTimeoutPaused = true;
      
      // Store remaining time for resume (ensure minimum time remaining)
      loopTimeoutDuration = Math.max(remainingTime, 1000); // Minimum 1 second
      
      console.log('=== LOOP TIMEOUT: Successfully paused, stored remaining time:', loopTimeoutDuration, 'ms');
      return true;
    } catch (error) {
      console.warn('=== LOOP TIMEOUT: Failed to pause:', error);
      return false;
    }
  } else {
    // Log why pause was skipped
    if (!loopTimeout) {
      console.log('=== LOOP TIMEOUT: Pause skipped - no active timeout');
    } else if (loopTimeoutPaused) {
      console.log('=== LOOP TIMEOUT: Pause skipped - already paused');
    } else if (!isLoopLyt) {
      console.log('=== LOOP TIMEOUT: Pause skipped - not in loop mode');
    }
  }
  return false;
}

// Function to resume loopTimeout after content updates
function resumeLoopTimeout(reason) {
  if (loopTimeoutPaused && isLoopLyt) {
    try {
      console.log('=== LOOP TIMEOUT: Resuming for reason:', reason);
      console.log('=== LOOP TIMEOUT: Resuming with duration:', loopTimeoutDuration, 'ms');
      
      // Validate duration before resuming
      if (loopTimeoutDuration <= 0) {
        console.warn('=== LOOP TIMEOUT: Invalid duration for resume, using default 5000ms');
        loopTimeoutDuration = 5000;
      }
      
      loopTimeoutStartTime = Date.now();
      loopTimeout = setTimeout(loopNextLayout, loopTimeoutDuration);
      loopTimeoutPaused = false;
      
      console.log('=== LOOP TIMEOUT: Successfully resumed');
      return true;
    } catch (error) {
      console.warn('=== LOOP TIMEOUT: Failed to resume:', error);
      return false;
    }
  } else {
    // Log why resume was skipped
    if (!loopTimeoutPaused) {
      console.log('=== LOOP TIMEOUT: Resume skipped - not paused');
    } else if (!isLoopLyt) {
      console.log('=== LOOP TIMEOUT: Resume skipped - not in loop mode');
    }
  }
  return false;
}

// Function to reset loopTimeout state (safety mechanism)
function resetLoopTimeoutState() {
  try {
    console.log('=== LOOP TIMEOUT: Resetting timeout state');
    if (loopTimeout) {
      clearTimeout(loopTimeout);
      loopTimeout = null;
    }
    loopTimeoutPaused = false;
    loopTimeoutStartTime = null;
    loopTimeoutDuration = null;
    console.log('=== LOOP TIMEOUT: State reset completed');
    return true;
  } catch (error) {
    console.warn('=== LOOP TIMEOUT: Failed to reset state:', error);
    return false;
  }
}

// Function to get current loopTimeout status (for debugging)
function getLoopTimeoutStatus() {
  return {
    hasTimeout: !!loopTimeout,
    isPaused: loopTimeoutPaused,
    startTime: loopTimeoutStartTime,
    duration: loopTimeoutDuration,
    isLoopMode: isLoopLyt,
    currentIndex: loopXMLCurIndex,
    totalLayouts: loopArr.length
  };
}

function loopNextLayout() {
  if (loopXMLCurIndex >= loopArr.length) {
    // if this is last loop layout then reset counter of current loop timeout
    loopXMLCurIndex = 0
  }
  layoutLoopUpdateXML() // keep updating ds xml to get updated each loop
  playcurrentLayout(loopArr[loopXMLCurIndex])
  
  // Broadcast sync data if this is a master screen
  if (typeof broadcastLayoutSync === 'function') {
    try {
      // Small delay to ensure layout is loaded before broadcasting
      setTimeout(() => {
        broadcastLayoutSync();
      }, 100);
    } catch (error) {
      console.warn('=== LOOP SYNC: Failed to broadcast layout sync:', error);
    }
  }
  
  loopXMLCurIndex++
}

/**
 * Apply CSS-based transition effect to main container
 * Supports: none, fade, slide-right, slide-left, scroll-up, scroll-down
 */
function applyLayoutTransition(callback) {
  var mainElement = document.getElementById('main');
  if (!mainElement) {
    log.warn('Layout Transition: Main element not found, skipping transition');
    if (callback) callback();
    return;
  }
  
  // Skip transition if style is 'none'
  if (loopTransitionStyle === 'none') {
    log.info('Layout Transition: Style is "none", applying changes immediately');
    if (callback) callback();
    return;
  }
  
  log.info('Layout Transition: Applying', loopTransitionStyle, 'with speed', loopTransitionSpeed, 'ms and delay', loopTransitionDelay, 'ms');
  
  // Apply transition delay if specified
  setTimeout(function() {
    // Add transition-out class based on style
    var transitionOutClass = 'loop-transition-out-' + loopTransitionStyle;
    mainElement.style.transition = 'all ' + (loopTransitionSpeed / 1000) + 's ease-in-out';
    mainElement.classList.add('loop-transition-container');
    mainElement.classList.add(transitionOutClass);
    
    // Wait for transition-out to complete, then execute callback
    setTimeout(function() {
      // Execute the callback to change content
      if (callback) callback();
      
      // Remove transition-out class and add transition-in class
      mainElement.classList.remove(transitionOutClass);
      var transitionInClass = 'loop-transition-in-' + loopTransitionStyle;
      mainElement.classList.add(transitionInClass);
      
      // Remove transition-in class after animation completes
      setTimeout(function() {
        mainElement.classList.remove(transitionInClass);
        mainElement.classList.remove('loop-transition-container');
        mainElement.style.transition = '';
        log.info('Layout Transition: Completed');
      }, loopTransitionSpeed);
      
    }, loopTransitionSpeed);
  }, loopTransitionDelay);
}

/**
 * Inject CSS styles for layout transitions
 * Called once on initialization
 */
function injectLayoutTransitionStyles() {
  // Check if styles already injected
  if (document.getElementById('loop-transition-styles')) {
    return;
  }
  
  var styleElement = document.createElement('style');
  styleElement.id = 'loop-transition-styles';
  styleElement.textContent = `
    /* Loop Layout Transition Styles */
    .loop-transition-container {
      position: relative;
    }
    
    /* Fade transition */
    .loop-transition-out-fade {
      opacity: 0;
    }
    .loop-transition-in-fade {
      opacity: 0;
      animation: fadeIn var(--transition-speed, 1s) ease-in-out forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    /* Slide Right transition */
    .loop-transition-out-slide-right {
      transform: translateX(100%);
      opacity: 0;
    }
    .loop-transition-in-slide-right {
      transform: translateX(-100%);
      opacity: 0;
      animation: slideInFromLeft var(--transition-speed, 1s) ease-in-out forwards;
    }
    @keyframes slideInFromLeft {
      from { transform: translateX(-100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    /* Slide Left transition */
    .loop-transition-out-slide-left {
      transform: translateX(-100%);
      opacity: 0;
    }
    .loop-transition-in-slide-left {
      transform: translateX(100%);
      opacity: 0;
      animation: slideInFromRight var(--transition-speed, 1s) ease-in-out forwards;
    }
    @keyframes slideInFromRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    /* Scroll Up transition */
    .loop-transition-out-scroll-up {
      transform: translateY(-100%);
      opacity: 0;
    }
    .loop-transition-in-scroll-up {
      transform: translateY(100%);
      opacity: 0;
      animation: scrollInFromBottom var(--transition-speed, 1s) ease-in-out forwards;
    }
    @keyframes scrollInFromBottom {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    
    /* Scroll Down transition */
    .loop-transition-out-scroll-down {
      transform: translateY(100%);
      opacity: 0;
    }
    .loop-transition-in-scroll-down {
      transform: translateY(-100%);
      opacity: 0;
      animation: scrollInFromTop var(--transition-speed, 1s) ease-in-out forwards;
    }
    @keyframes scrollInFromTop {
      from { transform: translateY(-100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(styleElement);
  log.info('Layout Transition: Styles injected successfully');
}

// Inject transition styles when script loads
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectLayoutTransitionStyles);
  } else {
    injectLayoutTransitionStyles();
  }
}

function playcurrentLayout(xmlData) {
  // Set loop layout flag since we're in loop mode
  isLoopLyt = true
  
  //clear textTimeout slot-text.js
  for (var i = 0; i < textTimeout.length; i++) {
    clearTimeout(textTimeout[i]);
  }
  //clear mediaTimeout slot-media.js
  for (var i = 0; i < mediaTimeout.length; i++) {
    clearTimeout(mediaTimeout[i]);
  }
  //clear colImageTimeout slot-table.js
  for (var i = 0; i < colImageTimeout.length; i++) {
    clearTimeout(colImageTimeout[i]);
  }
  //clear colFaderTimeout slot-table.js
  for (var i = 0; i < colFaderTimeout.length; i++) {
    clearTimeout(colFaderTimeout[i]);
  }
  //clear interval if running slot-table.js
  for (var i = 0; i < pageAutoInterval.length; i++) {
    clearInterval(pageAutoInterval[i]);
  }
  
  if (loopTimeout) { //clear loopTimeout to reset
    clearTimeout(loopTimeout)
    loopTimeout = null
  }
  
  // Reset timeout state when starting new layout
  resetLoopTimeoutState();
  
  var layoutURL = xmlData['attributes']['url']
  currentlytID = layoutURL.split("layout/")
  currentlytID = currentlytID[1].slice(0, currentlytID[1].lastIndexOf('/'))
  
  // Sync with currentPlayLayoutID for socket communication
  if (typeof syncCurrentPlayLayoutID === 'function') {
    syncCurrentPlayLayoutID(currentlytID);
  } else if (typeof window !== 'undefined' && window.currentPlayLayoutID !== undefined) {
    window.currentPlayLayoutID = currentlytID;
  }
  
  var layoutDuration = parseInt(xmlData['attributes']['duration']) * 1000
  var layoutxml = JSON.parse(localStorage.getItem('layout-' + currentlytID))
  log.info('play loop xml : ok : layout-' + currentlytID)
  
  // Apply transition effect when switching layouts
  applyLayoutTransition(function() {
    // Clear and load new layout content during transition
    $('#main').html(''); // Reset whole page html
    getLayoutXML(layoutxml);
    layoutLoopUpdateXML();
  });
  
  // Setup timeout tracking for pause/resume functionality
  loopTimeoutStartTime = Date.now();
  loopTimeoutDuration = layoutDuration;
  loopTimeoutPaused = false;
  
  //time of layout play
  loopTimeout = setTimeout(loopNextLayout, layoutDuration)
  console.log('=== LOOP TIMEOUT: Started new layout timeout for', layoutDuration, 'ms');
  
  // Broadcast initial sync data if this is a master screen
  if (typeof broadcastLayoutSync === 'function') {
    try {
      // Small delay to ensure layout is fully loaded
      setTimeout(() => {
        broadcastLayoutSync();
      }, 200);
    } catch (error) {
      console.warn('=== LOOP SYNC: Failed to broadcast initial layout sync:', error);
    }
  }
}

// Promise to track config loading for mobile compatibility
var configLoadPromise = new Promise(function(resolve) {
  if (typeof config !== 'undefined' && config) {
    resolve(config);
  } else {
    window.addEventListener('configLoaded', function() {
      resolve(config);
    });
  }
});

async function layoutLoopUpdateXML() {
  // Wait for config to be loaded (important for mobile app initialization)
  await configLoadPromise;
  
  // Return a new Promise
  return new Promise((resolve, reject) => {

    // Check if in offline mode - use cached data instead of fetching
    if (config && config.mode === 'offline') {
      log.info('Layout Loop Update: Offline mode detected, using cached data only');
      try {
        var cachedDsData = JSON.parse(localStorage.getItem(dsid));
        if (cachedDsData && cachedDsData.elements && cachedDsData.elements[0]) {
          log.info('Layout Loop Update: Successfully loaded cached DS data');
          var result2 = cachedDsData;
          
          if (result2['elements'][0]['elements'][0]['name'] == 'loop') {
            log.info('Layout Loop Update: Offline mode - Loop layout detected');
            
            // Extract transition attributes from loop configuration
            var loopAttributes = result2['elements'][0]['elements'][0]['attributes'] || {};
            loopTransitionStyle = loopAttributes['transition_style'] || 'none';
            loopTransitionSpeed = parseInt(loopAttributes['transition_speed']) || 1000;
            loopTransitionDelay = parseInt(loopAttributes['transition_delay']) || 0;
            log.info('Layout Loop Update: Transition settings - Style:', loopTransitionStyle, 'Speed:', loopTransitionSpeed, 'ms, Delay:', loopTransitionDelay, 'ms');
            
            // Populate loopArr, layoutURLList, and layoutIDList for offline mode
            result2 = result2['elements'][0]['elements'][0]['elements'];
            result2.forEach(function (layoutxml, oindex) {
              var layoutURL = layoutxml['attributes']['url'];
              var layoutID = layoutURL.split("layout/");
              layoutID = layoutID[1].slice(0, layoutID[1].lastIndexOf('/'));
              
              layoutURLList[oindex] = layoutURL;
              layoutIDList[oindex] = layoutID;
              loopArr[oindex] = layoutxml;
              
              log.info('Layout Loop Update: Populated loop index ' + oindex + ' - layout-' + layoutID);
            });
            
            log.info('Layout Loop Update: Loop array populated with ' + loopArr.length + ' layouts');
            resolve('loop');
          } else {
            log.info('Layout Loop Update: Offline mode - Single layout detected');
            resolve('single');
          }
        } else {
          log.error('Layout Loop Update: No cached data available in offline mode');
          reject('No cached data available for offline mode');
        }
      } catch (error) {
        log.error('Layout Loop Update: Error loading cached data in offline mode:', error);
        reject('Failed to load cached data: ' + error.message);
      }
      return; // Exit early in offline mode
    }

    // Validate config before accessing properties
    if (!config || !config.hostserver) {
      log.error('Layout Loop Update: Config or hostserver not available');
      reject('Configuration not loaded or hostserver missing');
      return;
    }

    var serverAdd = config.hostserver; // Get the server address from the configuration
    log.info('Layout Loop: Updating xml..'); // Log the online mode

    // Set up proxy if enabled
    var urlServer = serverAdd + '/' + dsid + '/ds.xml'; // Create the URL for fetching XML data
    if (config.corsproxy == 'Y') {
      urlServer = 'https://corsproxy.io/?url=' + encodeURIComponent(serverAdd + '/' + dsid + '/ds.xml'); // Use CORS proxy if enabled
    }

    $.ajax({
      url: urlServer, // Specify the URL for the AJAX request
      type: 'GET', // Use the GET method
      timeout: 5000, // Set a timeout of 5 seconds for the request
      success: function (dsData) {
        log.info('GET XML: OK'); // Log a successful XML retrieval
        if (typeof dsData === 'string') {
          log.warn('get xml : unable to read or data was string format : ' + data, urlServer)
          location.href = 'offline.html'; // Redirect to offline.html if dsData is a string
          remote.getCurrentWindow().focus(); // Focus on the current window
          reject('Data is in string format, redirected to offline.html'); // Reject the promise with an error message
        } else {
          // Read DS XML
          var xmlText = new XMLSerializer().serializeToString(dsData); // Serialize XML dsData to text
          var xml = '<?xml version="1.0" encoding="utf-8"?>' + xmlText; // Create a well-formed XML string
          var result2 = convert.xml2json(xml, {
            compact: false,
            spaces: 4,
            trim: false
          }); // Convert XML to JSON
          result2 = JSON.parse(result2); // Parse the JSON result
          localStorage.setItem(dsid, JSON.stringify(result2)); // Store the dsData in local storage

          if (result2['elements'][0]['elements'][0]['name'] == 'loop') { // Check if it's a loop layout
            // Extract transition attributes from loop configuration
            var loopAttributes = result2['elements'][0]['elements'][0]['attributes'] || {};
            loopTransitionStyle = loopAttributes['transition_style'] || 'none';
            loopTransitionSpeed = parseInt(loopAttributes['transition_speed']) || 1000;
            loopTransitionDelay = parseInt(loopAttributes['transition_delay']) || 0;
            log.info('Layout Loop Update: Transition settings - Style:', loopTransitionStyle, 'Speed:', loopTransitionSpeed, 'ms, Delay:', loopTransitionDelay, 'ms');
            
            result2 = result2['elements'][0]['elements'][0]['elements']; // Access the elements of the loop layout

            // Process each layout in the loop
            $.when.apply($, $.map(result2, function (layoutxml, oindex) {
              var layoutURL = layoutxml['attributes']['url']; // Get the layout URL
              var layoutID = layoutURL.split("layout/"); // Extract the layout ID from the URL
              layoutID = layoutID[1].slice(0, layoutID[1].lastIndexOf('/')); // Extract the layout ID
              layoutURLList[oindex] = layoutURL
              layoutIDList[oindex] = layoutID
              loopArr[oindex] = layoutxml

              // Use proxy if enabled
              if (config.corsproxy == 'Y') {
                layoutURL = 'https://corsproxy.io/?url=' + encodeURIComponent(layoutURL); // Use CORS proxy if enabled
              }

              // Return a new AJAX request for each layout URL
              return $.ajax({
                url: layoutURL, // Specify the URL for the AJAX request
                type: 'GET', // Use the GET method
                success: function (data) {
                  log.info('GET Loop XML: OK'); // Log a successful loop XML retrieval
                  // Read DS XML
                  var xmlText = new XMLSerializer().serializeToString(data); // Serialize XML data to text
                  var xml = '<?xml version="1.0" encoding="utf-8"?>' + xmlText; // Create a well-formed XML string
                  var xmlJSON = convert.xml2json(xml, {
                    compact: false,
                    spaces: 4
                  }); // Convert XML to JSON
                  xmlJSON = JSON.parse(xmlJSON); // Parse the JSON result
                  localStorage.setItem('layout-' + layoutID, JSON.stringify(xmlJSON)); // Store the layout data in local storage
                  localStorage.setItem('layout-offline-' + layoutID, JSON.stringify(xmlJSON)); // Store the offline layout data in local storage
                  log.info(`${layoutURL} XML updated.`); // Log a successful loop XML retrieval
                  log.info(`Layout cached for offline mode: layout-offline-${layoutID}`); // Enhanced logging for offline mode
                },
                error: function (xhr, textStatus, errorThrown) {
                  log.warn('GET Loop XML: Failed: URL: ' + layoutURL + ', ' + xhr.responseText); // Log a failed loop XML retrieval
                  reject('Failed to get loop XML: ' + xhr.responseText); // Reject the promise with an error message
                }
              });
            })).then(function () {
              // All layout XML has been stored, and then start to play the first layout
              log.info('Online mode: All layout loop XML has been updated.'); // Log the storage of all loop XML
              resolve('loop'); // Resolve the promise indicating completion
            });
          } else { // If it's a single layout
            getLayoutXML(result2); // Get the layout XML
            resolve('single'); // Resolve the promise indicating completion
          }
        }
      },
      error: function (xhr, textStatus, errorThrown) {
        log.warn('GET XML: Failed: ' + textStatus); // Log a failed XML retrieval
        log.info('Layout Loop Update: Attempting to use cached offline data'); // Log offline mode fallback
        
        // Try to use cached offline data instead of retrying
        try {
          var cachedDsData = JSON.parse(localStorage.getItem(dsid)); // Get cached DS data
          if (cachedDsData && cachedDsData.elements && cachedDsData.elements[0]) {
            log.info('Layout Loop Update: Using cached DS data from localStorage'); // Log cache usage
            var result2 = cachedDsData; // Use cached data
            
            if (result2['elements'][0]['elements'][0]['name'] == 'loop') { // Check if it's a loop layout
              // Extract transition attributes from cached loop configuration
              var loopAttributes = result2['elements'][0]['elements'][0]['attributes'] || {};
              loopTransitionStyle = loopAttributes['transition_style'] || 'none';
              loopTransitionSpeed = parseInt(loopAttributes['transition_speed']) || 1000;
              loopTransitionDelay = parseInt(loopAttributes['transition_delay']) || 0;
              log.info('Layout Loop Update: Cached transition settings - Style:', loopTransitionStyle, 'Speed:', loopTransitionSpeed, 'ms, Delay:', loopTransitionDelay, 'ms');
              
              result2 = result2['elements'][0]['elements'][0]['elements']; // Access the elements of the loop layout
              
              // Populate loopArr, layoutURLList, and layoutIDList for error recovery
              result2.forEach(function (layoutxml, oindex) {
                var layoutURL = layoutxml['attributes']['url'];
                var layoutID = layoutURL.split("layout/");
                layoutID = layoutID[1].slice(0, layoutID[1].lastIndexOf('/'));
                
                layoutURLList[oindex] = layoutURL;
                layoutIDList[oindex] = layoutID;
                loopArr[oindex] = layoutxml;
                
                log.info('Layout Loop Update: Populated loop index ' + oindex + ' - layout-' + layoutID);
              });
              
              // Process each layout in the loop using cached data
              $.when.apply($, $.map(result2, function (layoutxml, oindex) {
                var layoutURL = layoutxml['attributes']['url'];
                var layoutID = layoutURL.split("layout/");
                layoutID = layoutID[1].slice(0, layoutID[1].lastIndexOf('/'));
                
                // Try to load cached layout data
                var cachedLayout = localStorage.getItem('layout-' + layoutID);
                if (!cachedLayout) {
                  cachedLayout = localStorage.getItem('layout-offline-' + layoutID);
                }
                
                if (cachedLayout) {
                  log.info('Layout Loop Update: Using cached layout-' + layoutID);
                  return $.Deferred().resolve(); // Layout already cached
                } else {
                  log.warn('Layout Loop Update: Layout not cached: layout-' + layoutID);
                  return $.Deferred().reject(); // Layout not cached
                }
              })).then(function () {
                log.info('Layout Loop Update: All cached layouts verified');
                log.info('Layout Loop Update: Loop array populated with ' + loopArr.length + ' layouts');
                resolve('loop'); // Resolve with cached data
              }).fail(function() {
                log.warn('Layout Loop Update: Some layouts not cached, continuing with available data');
                log.info('Layout Loop Update: Loop array populated with ' + loopArr.length + ' layouts');
                resolve('loop'); // Resolve anyway to continue playing
              });
            } else { // If it's a single layout
              log.info('Layout Loop Update: Single layout mode with cached data');
              resolve('single'); // Resolve indicating completion
            }
          } else {
            log.error('Layout Loop Update: No cached data available, cannot update in offline mode');
            reject('No cached data available for offline mode'); // Reject if no cache
          }
        } catch (cacheError) {
          log.error('Layout Loop Update: Error accessing cached data:', cacheError);
          reject('Failed to access cached data: ' + cacheError.message);
        }
        
        // Only retry with getxml if function is available and we're in online mode
        if (typeof getxml === 'function' && config && config.mode !== 'offline') {
          log.info('GET XML: Recheck network again in 5 seconds: ' + textStatus);
          setTimeout(getxml, 5000); // Retry fetching XML data after 5 seconds
        }
      }
    });
  });
}

// Usage example:
layoutLoopUpdateXML().then(() => {
  console.log('XML Update completed'); // Log a message when XML update is completed
}).catch((error) => {
  console.error('An error occurred:', error); // Log an error message if the promise is rejected
});