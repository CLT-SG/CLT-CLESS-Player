var previewContainer
var videoJSPlayer = new Array() //videojs call function
var mediaTimeout = new Array()
var mediaCurIndex = new Array()
var medialoop = new Array()
var mediaEl = new Array()
var mediasrcList = new Array()
var mediafilenameList = new Array()
var videoIdIncrease = new Array()

/**
 * Sanitize media URLs for logging (truncate base64 data)
 * @param {string} url - The media URL (may contain base64 data)
 * @returns {string} Sanitized URL safe for logging
 */
function sanitizeMediaUrlForLog(url) {
    if (!url || typeof url !== 'string') return url;
    
    // Check if it's a data URL with base64
    if (url.startsWith('data:')) {
        const parts = url.split(',');
        if (parts.length === 2 && parts[0].includes('base64')) {
            // Return format: data:image/png;base64,[TRUNCATED-123-chars]
            const base64Data = parts[1];
            const truncated = base64Data.substring(0, 40) + '...[TRUNCATED-' + base64Data.length + '-chars]';
            return parts[0] + ',' + truncated;
        }
    }
    
    // If not base64 data URL, return as-is
    return url;
}

function generateRandomNumber() {
    const minDigits = 7;
    const randomNumber = Math.floor(Math.random() * Math.pow(10, minDigits - 1)) + Math.pow(10, minDigits - 1);
    return randomNumber;
}

function mediaFunc(slotitem, slotid, mediapath) {
    mediaCurIndex[slotid] = 1
    medialoop[slotid] = []
    var serverAdd = config.hostserver
    serverAdd = serverAdd.split('/')
    serverAdd = serverAdd[0] + '//' + serverAdd[2]
    if (mediapath.length != 0) {
        medialoop[slotid] = []
    }
    
    // Process all media items (potentially async)
    processMediaItems(slotitem, slotid, mediapath, serverAdd);
}

/**
 * Process media items asynchronously (supports mobile and desktop)
 */
async function processMediaItems(slotitem, slotid, mediapath, serverAdd) {
    // Ensure media manager is initialized (mobile only)
    if (window.mediaManager && !window.mediaManager.initialized) {
        console.log('[mediaFunc] Waiting for media manager initialization...');
        await window.mediaManager.initialize().catch(err => {
            console.error('[mediaFunc] Media manager init failed:', err);
        });
    }
    
    for (let mindex = 0; mindex < slotitem.length; mindex++) {
        const media = slotitem[mindex];
        
        // Enhanced defensive check for undefined elements
        if (!media) {
            console.error('[mediaFunc] Media element is null/undefined at index', mindex, 'for slot', slotid);
            continue; // Skip this iteration
        }
        
        // DEBUG: Always log the full media structure to understand the data format
        console.log('[mediaFunc] Media element at index', mindex, 'for slot', slotid, '- Full structure:', JSON.stringify(media));
        
        if (!media['elements']) {
            console.error('[mediaFunc] No elements property in media element at index', mindex, 'for slot', slotid);
            console.error('[mediaFunc] Media structure:', JSON.stringify(media));
            continue;
        }
        
        // Check if elements is empty or has no items (handle both array and object)
        var hasElements = false;
        if (Array.isArray(media['elements'])) {
            hasElements = media['elements'].length > 0 && media['elements'][0];
        } else if (typeof media['elements'] === 'object') {
            hasElements = media['elements']['0'] !== undefined;
        }
        
        if (!hasElements) {
            console.error('[mediaFunc] No elements[0] in media element at index', mindex, 'for slot', slotid);
            console.error('[mediaFunc] Elements type:', Array.isArray(media['elements']) ? 'array' : typeof media['elements']);
            console.error('[mediaFunc] Elements content:', JSON.stringify(media['elements']));
            
            // FALLBACK: Check if text is directly in media object or attributes
            var src = null;
            if (media['text']) {
                console.log('[mediaFunc] ✓ FALLBACK SUCCESS: Found text directly in media object:', media['text']);
                src = media['text'];
            } else if (media['attributes'] && media['attributes']['src']) {
                console.log('[mediaFunc] ✓ FALLBACK SUCCESS: Found src in attributes:', media['attributes']['src']);
                src = media['attributes']['src'];
            } else if (media['attributes'] && media['attributes']['file']) {
                console.log('[mediaFunc] ✓ FALLBACK SUCCESS: Found file in attributes:', media['attributes']['file']);
                src = media['attributes']['file'];
            } else if (media['attributes'] && media['attributes']['name']) {
                console.log('[mediaFunc] ✓ FALLBACK SUCCESS: Found name in attributes:', media['attributes']['name']);
                src = media['attributes']['name'];
            } else if (media['name']) {
                console.log('[mediaFunc] ✓ FALLBACK SUCCESS: Found name directly in media:', media['name']);
                src = media['name'];
            } else {
                console.error('[mediaFunc] ✗ FALLBACK FAILED: Cannot find media source anywhere');
                console.error('[mediaFunc] Available attributes:', media['attributes'] ? Object.keys(media['attributes']).join(', ') : 'none');
                console.error('[mediaFunc] Available properties:', Object.keys(media).join(', '));
                continue;
            }
            
            console.log('[mediaFunc] Using source from fallback:', src);
            src = src.replace('{', '').replace('}', '');
        } else {
            // Get first element (support both array and object notation)
            var firstElement = Array.isArray(media['elements']) ? media['elements'][0] : media['elements']['0'];
            
            if (!firstElement || !firstElement['text']) {
                console.error('[mediaFunc] No text property in elements[0] at index', mindex, 'for slot', slotid);
                console.error('[mediaFunc] First element:', JSON.stringify(firstElement));
                continue;
            }
            
            var src = firstElement['text'].replace('{', '').replace('}', '');
        }
        
        // Validate duration attribute
        if (!media['attributes'] || !media['attributes']['duration']) {
            console.warn('[mediaFunc] Missing duration attribute at index', mindex, 'for slot', slotid, '- using default 5s');
            var duration = 5;
        } else {
            var duration = media['attributes']['duration'];
        }
        // Skip "none" media items
        if (src === 'none' || src.trim() === '' || !src) {
            console.log('[mediaFunc] Skipping empty/none media at index', mindex, 'for slot', slotid);
            continue;
        }
        
        var n = src.lastIndexOf('.')
        var mediamode = src.substring(n + 1)
        var ytbe = src.split("/")
        //media file location
        var mediaLocalPath

        console.log('[mediaFunc] Processing media:', src, '- Mode:', mediamode, '- Slot:', slotid);
        
        //check media file if exist
        var mediaDownloadURL = serverAdd + mediapath + '/' + src
        if (['png', 'jpg', 'jpeg', 'bmp', 'gif', 'mp4', 'webm'].includes(mediamode)) { //image and video format
            if (src != 'none') {
                var mediaName = src.split('/')
                mediaName = mediaName[1]
                //add source to media list and insert to cpanel
                mediafilenameList.push(mediaName)
                
                // MOBILE vs DESKTOP PATH HANDLING
                if (window.mediaManager) {
                    // === MOBILE MODE: Use Capacitor Filesystem ===
                    console.log('[mediaFunc] Mobile mode: Using media manager for', mediaName);
                    
                    try {
                        // Check if file exists in cache
                        const exists = await window.mediaManager.checkMediaExists(mediaName);
                        
                        if (!exists) {
                            // Download to cache
                            console.log('[mediaFunc] Downloading media:', mediaDownloadURL);
                            await window.mediaManager.downloadMedia(mediaDownloadURL, mediaName);
                        } else {
                            console.log('[mediaFunc] Media cached:', mediaName);
                        }
                        
                        // Get web-accessible URI for the file
                        mediaLocalPath = await window.mediaManager.getMediaUri(mediaName);
                        
                        if (!mediaLocalPath) {
                            console.error('[mediaFunc] Failed to get media URI for:', mediaName);
                            // Fallback to direct URL
                            mediaLocalPath = mediaDownloadURL;
                        }
                        
                    } catch (error) {
                        console.error('[mediaFunc] Mobile media error:', error);
                        // Fallback to direct URL (streaming from server)
                        mediaLocalPath = mediaDownloadURL;
                    }
                    
                } else if (typeof ipcRenderer !== 'undefined') {
                    // === DESKTOP MODE: Use Electron IPC ===
                    mediaLocalPath = homedir + '/clessapp/res/' + mediaName;
                    if (!fs.existsSync(mediaLocalPath)) {
                        //using ipc to download media cause electron not allow to use axios
                        //https://stackoverflow.com/questions/65602941/axios-error-data-pipe-is-not-a-function
                        ipcRenderer.invoke('app-downloadmedia', {
                            mediaURL: mediaDownloadURL,
                            mediaPathSrc: mediaLocalPath
                        }).then((result) => {
                            log.info('Saved to ' + mediaLocalPath)
                        }).catch((error) => {
                            log.error('Download failed:', error);
                        });
                    }
                } else {
                    // === FALLBACK: Direct URL (no local caching) ===
                    console.warn('[mediaFunc] No media manager or IPC - using direct URL');
                    mediaLocalPath = mediaDownloadURL;
                }
            }
        }

        //add source to media list and insert to column image inside table slot
        console.log('[mediaFunc] Media local path for', src, ':', sanitizeMediaUrlForLog(mediaLocalPath));
        mediasrcList.push(mediaLocalPath)

        if (['png', 'jpg', 'jpeg', 'bmp', 'gif'].includes(mediamode)) { //image format
            console.log('[mediaFunc] Creating IMAGE content object');
            var contentObj = new Object()
            contentObj.contentUrl = mediaLocalPath
            contentObj.contentDuration = duration
            contentObj.contentType = "image/" + mediamode
            contentObj.mediaType = "IMAGE"
            medialoop[slotid].push(contentObj)
        } else if (ytbe[2] == 'youtu.be') {
            var contentObj = new Object()
            contentObj.contentUrl = ytbe[3]
            contentObj.contentDuration = duration
            contentObj.contentType = "youtube"
            contentObj.mediaType = "YTB"
            medialoop[slotid].push(contentObj)
        } else if (mediamode == 'm3u8' || mediamode == 'm3u') { //video m3u8 format
            var contentObj = new Object()
            contentObj.contentUrl = src
            contentObj.contentDuration = duration
            contentObj.contentType = "application/x-mpegURL"
            contentObj.mediaType = "STREAM"
            medialoop[slotid].push(contentObj)
        } else if (['mp4', 'webm', 'mkv'].includes(mediamode)) { //video mp4/webm format
            console.log('[mediaFunc] Creating VIDEO content object - URL:', sanitizeMediaUrlForLog(mediaLocalPath), '- Duration:', duration);
            var contentObj = new Object()
            contentObj.contentUrl = mediaLocalPath
            contentObj.contentDuration = duration
            contentObj.contentType = "video/mp4"
            contentObj.mediaType = "VIDEO"
            medialoop[slotid].push(contentObj)
            console.log('[mediaFunc] Added VIDEO to medialoop[' + slotid + '] - Total items:', medialoop[slotid].length);
        } else if (['flv'].includes(mediamode)) { //video flv format
            var contentObj = new Object()
            contentObj.contentUrl = src
            contentObj.contentDuration = duration
            contentObj.contentType = "video/x-flv"
            contentObj.mediaType = "CCTV"
            medialoop[slotid].push(contentObj)
        } else { //none 
        }
        
        // Check if this is the last media item
        if (mindex === slotitem.length - 1) {
            if (!medialoop[slotid][0]) {
                medialoop[slotid][0] = 10
            }
            appendMediaElement(medialoop[slotid][0], '#slot-' + slotid, slotid)
        }
    }
}

//play next media after current media has finished
function changeMedia(slotid) {
    if (mediaCurIndex[slotid] >= medialoop[slotid].length) {
        // modified this so it would display the first image/video when looping
        mediaCurIndex[slotid] = 0
    }
    //check if got more media inside slot
    if (medialoop[slotid].length != 1) {
        appendMediaElement(medialoop[slotid][mediaCurIndex[slotid]], '#slot-' + slotid, slotid)
        mediaCurIndex[slotid]++
    }
}

//render every media slot
async function appendMediaElement(asset, previewele, slotid) {
    videoIdIncrease[slotid] = generateRandomNumber()
    var videojsid = parseInt(slotid) + videoIdIncrease[slotid]
    if (mediaTimeout[slotid]) { //clear mediaTimeout to reset
        clearTimeout(mediaTimeout[slotid])
    }
    var duration = parseInt(asset.contentDuration * 1000)
    if (asset.mediaType == "IMAGE") { //image player
        //object-fit to fit image inside the image elements //fill : image stretched on slot
        mediaEl[slotid] = '<img id="lp-preview-image" class="media-slot" style="object-fit: fill;" src="' + asset.contentUrl + '">'
        $(previewele).html(mediaEl[slotid])
        // image: go to the next media after specific seconds
        if (medialoop[slotid].length > 1) {
            mediaTimeout[slotid] = setTimeout(function () {
                changeMedia(slotid)
            }, duration)
        }

    } else if (asset.mediaType == "YTB") {
        mediaEl[slotid] = '<iframe src="https://www.youtube.com/embed/' + asset.contentUrl + '?autoplay=1&controls=0" frameborder="0" allow="accelerometer;" ></iframe>'
        $(previewele).html(mediaEl[slotid])
        // image: go to the next media after specific seconds
        mediaTimeout[slotid] = setTimeout(function () {
            changeMedia(slotid)
        }, duration)
    } else if (asset.mediaType == "STREAM") { //streaming player
        mediaEl[slotid] = ""
        mediaEl[slotid] =
            '<video id="video-' + videojsid + '" poster="http://dummyimage.com/320x240/ffffff/fff" class="video-js vjs-default-skin vjs-fill" class="media-slot" autoplay controls preload="metadata" data-setup="{}">'
        mediaEl[slotid] += "<source src='" + asset.contentUrl + "' type='" + asset.contentType + "'>"
        mediaEl[slotid] += "</video>"
        $(previewele).html(mediaEl[slotid])
        videoJSPlayer[videojsid] = videojs('video-' + videojsid, {}, function () {})
        videoJSPlayer[videojsid].controls(false)

        // Add synchronization support to VideoJS player
        if (videoJSPlayer[videojsid]) {
            setupVideoSync(videoJSPlayer[videojsid], videojsid);
        }

        //check if duration 0 then play full duration
        if (duration == 0) {
            videoJSPlayer[videojsid].on('ended', function () {
                videoJSPlayer[videojsid].dispose()
                changeMedia(slotid)
            })

            // if not play with duration 
        } else {
            setTimeout(function () {
                const frame = captureVideoFrame('video-' + slotid, 'png')
                videoJSPlayer[videojsid].poster(frame.dataUri)
                videoJSPlayer[videojsid].dispose()
                changeMedia(slotid)
            }, duration)
        }
        videoJSPlayer[videojsid].on('error', function () {
            videoJSPlayer[videojsid].dispose()
            changeMedia(slotid)
            var error = videoJSPlayer[videojsid].error()
            log.warn('VIDEOJS ERROR : ', error.code, error.type, error.message)
            console.log('VIDEOJS ERROR : ', error.code, error.type, error.message)
        })
    } else if (asset.mediaType == "VIDEO") { //basic video player
        console.log('[appendMediaElement] Creating VIDEO player - SlotID:', slotid, 'VideoJSID:', videojsid);
        console.log('[appendMediaElement] Video URL:', sanitizeMediaUrlForLog(asset.contentUrl));
        console.log('[appendMediaElement] Video Duration:', asset.contentDuration, 'Type:', asset.contentType);
        
        mediaEl[slotid] =
            '<video id="video-' + videojsid + '" poster="http://dummyimage.com/320x240/ffffff/fff" class="video-js vjs-default-skin vjs-fill" class="media-slot" autoplay controls preload="metadata" data-setup="{}">'
        mediaEl[slotid] += "<source src='" + asset.contentUrl + "' type='" + asset.contentType + "'>"
        mediaEl[slotid] += "</video>"
        
        console.log('[appendMediaElement] Video HTML created, inserting into DOM');
        $(previewele).html(mediaEl[slotid])
        
        console.log('[appendMediaElement] Initializing VideoJS player');
        try {
            videoJSPlayer[videojsid] = videojs('video-' + videojsid, {}, function () {
                console.log('[appendMediaElement] VideoJS player initialized successfully for', videojsid);
            })
            
            if (!videoJSPlayer[videojsid]) {
                console.error('[appendMediaElement] VideoJS player is null/undefined after initialization!');
                return;
            }
            
            videoJSPlayer[videojsid].controls(false)
            console.log('[appendMediaElement] VideoJS controls disabled');
        } catch (error) {
            console.error('[appendMediaElement] Error initializing VideoJS:', error.message, error.stack);
            return;
        }
        
        // Add synchronization support to VideoJS player
        if (videoJSPlayer[videojsid]) {
            setupVideoSync(videoJSPlayer[videojsid], videojsid);
        }
        
        //check if duration 0 then play full duration

        if (duration == 0) {
            console.log('[appendMediaElement] Setting up duration=0 (play full video) for', videojsid);
            videoJSPlayer[videojsid].on("timeupdate", function (event) { //chrome fix
                try {
                    if (!videoJSPlayer[videojsid]) {
                        console.error('[appendMediaElement] VideoJS player undefined in timeupdate');
                        return;
                    }
                    if (videoJSPlayer[videojsid].currentTime() == videoJSPlayer[videojsid].duration()) {
                        videoJSPlayer[videojsid].dispose()
                        changeMedia(slotid)
                    }
                } catch (error) {
                    console.error('[appendMediaElement] Error in timeupdate (duration=0):', error.message);
                }
            })
            // if not play with duration 
        } else {
            console.log('[appendMediaElement] Setting up timed duration:', duration, 'ms for', videojsid);
            videoJSPlayer[videojsid].on('timeupdate', function () {
                try {
                    if (!videoJSPlayer[videojsid]) {
                        console.error('[appendMediaElement] VideoJS player undefined in timeupdate');
                        return;
                    }
                    var currTime = videoJSPlayer[videojsid].currentTime()
                    currTime = parseInt(currTime) * 1000
                    if (currTime == duration) {
                        videoJSPlayer[videojsid].dispose()
                        changeMedia(slotid)
                    }
                } catch (error) {
                    console.error('[appendMediaElement] Error in timeupdate:', error.message);
                }
            })
        }
        videoJSPlayer[videojsid].on('error', function () {
            try {
                console.error('[appendMediaElement] VideoJS error event triggered for', videojsid);
                if (videoJSPlayer[videojsid]) {
                    var error = videoJSPlayer[videojsid].error()
                    if (error) {
                        log.warn('VIDEOJS ERROR : ', error.code, error.type, error.message)
                        console.error('VIDEOJS ERROR : Code:', error.code, 'Type:', error.type, 'Message:', error.message)
                    } else {
                        console.error('VIDEOJS ERROR : No error object available');
                    }
                    videoJSPlayer[videojsid].dispose()
                }
                changeMedia(slotid)
            } catch (err) {
                console.error('[appendMediaElement] Error handling VideoJS error:', err.message);
                changeMedia(slotid)
            }
        })
    } else if (asset.mediaType == "CCTV") { //cctv video player
        mediaEl[slotid] =
            '<video id="video-' + videojsid + '" poster="http://dummyimage.com/320x240/ffffff/fff" class="video-js vjs-default-skin vjs-fill" class="media-slot" autoplay controls preload="metadata" data-setup="{}">'
        mediaEl[slotid] += "<source src='" + asset.contentUrl + "' type='" + asset.contentType + "'>"
        mediaEl[slotid] += "</video>"
        $(previewele).html(mediaEl[slotid])
        videoJSPlayer[videojsid] = videojs('video-' + videojsid, {
            techOrder: ['html5', 'flvjs'],
            flvjs: {
                mediaDataSource: {
                    isLive: true,
                    cors: true,
                    withCredentials: false,
                }
            },
        }, function () {})
        videoJSPlayer[videojsid].controls(false)
        //check if duration 0 then play full duration
        if (duration == 0) {
            videoJSPlayer[videojsid].on('ended', function () {
                videoJSPlayer[videojsid].dispose()
                changeMedia(slotid)
            })
            // if not play with duration 
        } else {
            setTimeout(function () {
                videoJSPlayer[videojsid].dispose()
                changeMedia(slotid)
            }, duration)
        }
        videoJSPlayer[videojsid].on('error', function () {
            videoJSPlayer[videojsid].dispose()
            changeMedia(slotid)
            var error = videoJSPlayer[videojsid].error()
            log.warn('VIDEOJS ERROR : ', error.code, error.type, error.message)
            console.log('VIDEOJS ERROR : ', error.code, error.type, error.message)
        })
    }
}

// ========================================
// VIDEO SYNCHRONIZATION FUNCTIONS
// ========================================

// Global variables for video synchronization
var videoSyncConfig = null;
var videoSyncLastUpdate = {};

// Setup video synchronization for a VideoJS player
function setupVideoSync(player, playerIndex) {
    if (!player || typeof player.on !== 'function') return;
    
    try {
        // Initialize sync tracking for this player
        videoSyncLastUpdate[playerIndex] = {
            lastSyncTime: 0,
            lastCurrentTime: 0,
            syncEnabled: true
        };
        
        console.log('=== VIDEO SYNC: Setup sync for player:', playerIndex);
        
        // Add event listeners for sync broadcasting (if master)
        player.on('play', function() {
            console.log('=== VIDEO SYNC: Player', playerIndex, 'started playing');
            if (typeof broadcastVideoTime === 'function') {
                setTimeout(() => broadcastVideoTime(), 100);
            }
        });
        
        player.on('pause', function() {
            console.log('=== VIDEO SYNC: Player', playerIndex, 'paused');
            if (typeof broadcastVideoTime === 'function') {
                setTimeout(() => broadcastVideoTime(), 100);
            }
        });
        
        player.on('seeked', function() {
            console.log('=== VIDEO SYNC: Player', playerIndex, 'seeked to:', player.currentTime());
            if (typeof broadcastVideoTime === 'function') {
                setTimeout(() => broadcastVideoTime(), 100);
            }
        });
        
        // Periodic sync check for smooth synchronization
        var syncInterval = setInterval(function() {
            if (player && !player.isDisposed()) {
                checkVideoSyncDrift(player, playerIndex);
            } else {
                clearInterval(syncInterval);
                delete videoSyncLastUpdate[playerIndex];
            }
        }, 1000); // Check every second
        
    } catch (error) {
        console.warn('=== VIDEO SYNC: Failed to setup sync for player:', playerIndex, error);
    }
}

// Check for video synchronization drift
function checkVideoSyncDrift(player, playerIndex) {
    if (!player || typeof player.currentTime !== 'function') return;
    
    try {
        var currentTime = player.currentTime();
        var now = Date.now();
        var syncData = videoSyncLastUpdate[playerIndex];
        
        if (!syncData) return;
        
        // Update tracking data
        syncData.lastCurrentTime = currentTime;
        syncData.lastSyncTime = now;
        
        // Additional drift checking could be added here if needed
        
    } catch (error) {
        console.warn('=== VIDEO SYNC: Failed to check drift for player:', playerIndex, error);
    }
}

// Synchronize video player to target time and state (Slave function)
function syncVideoPlayer(player, playerIndex, targetTime, isPaused, tolerance) {
    if (!player || typeof player.currentTime !== 'function') return false;
    
    tolerance = tolerance || 0.5; // Default tolerance of 0.5 seconds
    
    try {
        var currentTime = player.currentTime();
        var timeDifference = Math.abs(currentTime - targetTime);
        
        console.log('=== VIDEO SYNC: Player', playerIndex, 'current:', currentTime, 'target:', targetTime, 'diff:', timeDifference);
        
        // Sync time if difference exceeds tolerance
        if (timeDifference > tolerance) {
            console.log('=== VIDEO SYNC: Correcting time drift for player:', playerIndex, 'by', timeDifference, 'seconds');
            player.currentTime(targetTime);
        }
        
        // Sync play/pause state
        var isCurrentlyPaused = player.paused();
        if (isPaused && !isCurrentlyPaused) {
            console.log('=== VIDEO SYNC: Pausing player:', playerIndex);
            player.pause();
        } else if (!isPaused && isCurrentlyPaused) {
            console.log('=== VIDEO SYNC: Playing player:', playerIndex);
            player.play().catch(function(error) {
                console.warn('=== VIDEO SYNC: Failed to play player:', playerIndex, error);
            });
        }
        
        // Update sync tracking
        if (videoSyncLastUpdate[playerIndex]) {
            videoSyncLastUpdate[playerIndex].lastCurrentTime = targetTime;
            videoSyncLastUpdate[playerIndex].lastSyncTime = Date.now();
        }
        
        return true;
        
    } catch (error) {
        console.warn('=== VIDEO SYNC: Failed to sync player:', playerIndex, error);
        return false;
    }
}

// Get all active video players sync data (Master function)
function getAllVideoPlayersData() {
    var playersData = [];
    
    try {
        if (typeof videoJSPlayer !== 'undefined' && Array.isArray(videoJSPlayer)) {
            videoJSPlayer.forEach((player, index) => {
                if (player && !player.isDisposed() && typeof player.currentTime === 'function') {
                    playersData.push({
                        playerIndex: index,
                        currentTime: player.currentTime(),
                        paused: player.paused(),
                        duration: player.duration() || 0,
                        playbackRate: player.playbackRate() || 1,
                        volume: player.volume() || 1,
                        muted: player.muted() || false
                    });
                }
            });
        }
    } catch (error) {
        console.warn('=== VIDEO SYNC: Failed to get players data:', error);
    }
    
    return playersData;
}

// Initialize video synchronization settings
function initVideoSyncSettings() {
    try {
        if (typeof config !== 'undefined' && config && config.syncSettings) {
            videoSyncConfig = config.syncSettings;
            console.log('=== VIDEO SYNC: Initialized with config:', videoSyncConfig);
        } else {
            console.log('=== VIDEO SYNC: No sync config found, using defaults');
            videoSyncConfig = {
                videoSyncEnabled: true,
                videoSyncThreshold: 0.5,
                masterBroadcastInterval: 1000
            };
        }
    } catch (error) {
        console.warn('=== VIDEO SYNC: Failed to initialize sync settings:', error);
        videoSyncConfig = null;
    }
}

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    window.addEventListener('load', function() {
        setTimeout(initVideoSyncSettings, 1000);
    });
}

// ========================================
// END VIDEO SYNCHRONIZATION FUNCTIONS  
// ========================================