/**
 * eCLESS Player - Optimized Media Slot Handler
 * 
 * Optimizations:
 * - Batch preloading of media files
 * - In-memory URI caching
 * - External URL support (http/https)
 * - Parallel processing
 * - Better error handling
 * - M3U8/HLS stream support
 */

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

// Helper function to extract YouTube video ID
function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

/**
 * Check if a URL is external (http/https)
 */
function isExternalMediaUrl(url) {
    return url && (url.startsWith('http://') || url.startsWith('https://'));
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
    processMediaItemsOptimized(slotitem, slotid, mediapath, serverAdd);
}

/**
 * OPTIMIZED: Process media items with batch preloading and external URL support
 */
async function processMediaItemsOptimized(slotitem, slotid, mediapath, serverAdd) {
    console.log('[mediaFunc] Starting optimized processing for slot:', slotid, 'with', slotitem.length, 'items');
    
    // Ensure media manager is initialized (mobile only)
    if (window.mediaManager && !window.mediaManager.initialized) {
        console.log('[mediaFunc] Waiting for media manager initialization...');
        await window.mediaManager.initialize().catch(err => {
            console.error('[mediaFunc] Media manager init failed:', err);
        });
    }
    
    // Phase 1: Parse and categorize all media
    const mediaItems = [];
    const localMediaToPreload = [];
    
    for (let mindex = 0; mindex < slotitem.length; mindex++) {
        const media = slotitem[mindex];
        
        // Defensive checks
        if (!media) {
            console.error('[mediaFunc] Media element is null/undefined at index', mindex);
            continue;
        }
        
        if (!media['elements']) {
            console.error('[mediaFunc] No elements property at index', mindex);
            continue;
        }
        
        // Extract source
        let src = null;
        var hasElements = false;
        
        if (Array.isArray(media['elements'])) {
            hasElements = media['elements'].length > 0 && media['elements'][0];
        } else if (typeof media['elements'] === 'object') {
            hasElements = media['elements']['0'] !== undefined;
        }
        
        if (hasElements) {
            // Normal path
            var firstElement = Array.isArray(media['elements']) ? media['elements'][0] : media['elements']['0'];
            if (firstElement && firstElement['text']) {
                src = firstElement['text'].replace('{', '').replace('}', '').trim();
            }
        } else {
            // Fallback paths
            if (media['text']) {
                src = media['text'];
            } else if (media['attributes'] && media['attributes']['src']) {
                src = media['attributes']['src'];
            } else if (media['attributes'] && media['attributes']['file']) {
                src = media['attributes']['file'];
            }
            
            if (src) {
                src = src.replace('{', '').replace('}', '').trim();
            }
        }
        
        // Skip invalid, empty, or "none" media sources
        if (!src || src === 'none' || src === 'None' || src === 'NONE' || src.trim() === '' || src.toLowerCase() === 'none') {
            console.log('[mediaFunc] ✓ Skipping "none" media at index', mindex);
            continue;
        }
        
        // Get duration
        const duration = (media['attributes'] && media['attributes']['duration']) ? media['attributes']['duration'] : 5;
        
        // Determine media type
        const n = src.lastIndexOf('.');
        const mediamode = src.substring(n + 1);
        const ytbe = src.split("/");
        
        // Categorize media
        const isExternal = isExternalMediaUrl(src);
        
        mediaItems.push({
            src,
            duration,
            mediamode,
            ytbe,
            isExternal,
            mindex
        });
    }
    
    console.log('[mediaFunc] Parsed', mediaItems.length, 'valid media items');
    
    // Phase 2: Process based on type
    for (const item of mediaItems) {
        const { src, duration, mediamode, ytbe, isExternal } = item;
        
        // Double-check for "none" values (safety check)
        if (!src || src.toLowerCase() === 'none' || src.trim() === '') {
            console.log('[mediaFunc] ✓ Skipping "none" value in processing phase');
            continue;
        }
        
        console.log('[mediaFunc] Processing:', src, '- Mode:', mediamode, '- External:', isExternal);
        
        // Handle YouTube
        if (ytbe[2] === 'youtu.be' || src.includes('youtube.com')) {
            const videoId = ytbe[3] || extractYouTubeId(src);
            medialoop[slotid].push({
                contentUrl: videoId,
                contentDuration: duration,
                contentType: "youtube",
                mediaType: "YTB"
            });
            continue;
        }
        
        // Handle M3U8 streams
        if (mediamode === 'm3u8' || mediamode === 'm3u') {
            medialoop[slotid].push({
                contentUrl: src, // Use URL directly (external or relative)
                contentDuration: duration,
                contentType: "application/x-mpegURL",
                mediaType: "STREAM"
            });
            continue;
        }
        
        // Handle FLV streams
        if (mediamode === 'flv') {
            medialoop[slotid].push({
                contentUrl: src,
                contentDuration: duration,
                contentType: "video/x-flv",
                mediaType: "CCTV"
            });
            continue;
        }
        
        // Handle images
        if (['png', 'jpg', 'jpeg', 'bmp', 'gif'].includes(mediamode)) {
            if (isExternal) {
                // External image - use directly
                medialoop[slotid].push({
                    contentUrl: src,
                    contentDuration: duration,
                    contentType: "image/" + mediamode,
                    mediaType: "IMAGE"
                });
            } else {
                // Local image - queue for preload
                const mediaName = src.split('/').pop();
                const downloadURL = serverAdd + mediapath + '/' + src;
                localMediaToPreload.push({
                    url: downloadURL,
                    filename: mediaName,
                    duration: duration,
                    type: "IMAGE",
                    contentType: "image/" + mediamode
                });
            }
            continue;
        }
        
        // Handle videos
        if (['mp4', 'webm', 'mkv'].includes(mediamode)) {
            if (isExternal) {
                // External video - use directly
                medialoop[slotid].push({
                    contentUrl: src,
                    contentDuration: duration,
                    contentType: "video/mp4",
                    mediaType: "VIDEO"
                });
            } else {
                // Local video - queue for preload
                const mediaName = src.split('/').pop();
                const downloadURL = serverAdd + mediapath + '/' + src;
                localMediaToPreload.push({
                    url: downloadURL,
                    filename: mediaName,
                    duration: duration,
                    type: "VIDEO",
                    contentType: "video/mp4"
                });
            }
            continue;
        }
    }
    
    // Phase 3: Batch preload local media
    if (localMediaToPreload.length > 0 && window.mediaManager) {
        console.log('[mediaFunc] Batch preloading', localMediaToPreload.length, 'local files...');
        
        try {
            const preloadResult = await window.mediaManager.preloadMediaBatch(localMediaToPreload);
            console.log('[mediaFunc] Preload complete:', preloadResult.loaded, 'loaded,', preloadResult.failed, 'failed');
            
            // Add preloaded media to playback loop
            for (const item of localMediaToPreload) {
                const mediaUri = await window.mediaManager.getMediaUri(item.filename);
                
                if (mediaUri) {
                    medialoop[slotid].push({
                        contentUrl: mediaUri,
                        contentDuration: item.duration,
                        contentType: item.contentType,
                        mediaType: item.type
                    });
                } else {
                    console.warn('[mediaFunc] Failed to get URI for:', item.filename);
                }
            }
        } catch (error) {
            console.error('[mediaFunc] Batch preload error:', error);
            
            // Fallback: sequential loading
            for (const item of localMediaToPreload) {
                try {
                    const exists = await window.mediaManager.checkMediaExists(item.filename);
                    if (!exists) {
                        await window.mediaManager.downloadMedia(item.url, item.filename);
                    }
                    const mediaUri = await window.mediaManager.getMediaUri(item.filename);
                    if (mediaUri) {
                        medialoop[slotid].push({
                            contentUrl: mediaUri,
                            contentDuration: item.duration,
                            contentType: item.contentType,
                            mediaType: item.type
                        });
                    }
                } catch (err) {
                    console.error('[mediaFunc] Failed to load:', item.filename, err);
                }
            }
        }
    } else if (localMediaToPreload.length > 0 && typeof ipcRenderer !== 'undefined') {
        // Desktop Electron mode - use IPC
        for (const item of localMediaToPreload) {
            const mediaLocalPath = homedir + '/clessapp/res/' + item.filename;
            
            if (!fs.existsSync(mediaLocalPath)) {
                ipcRenderer.invoke('app-downloadmedia', {
                    mediaURL: item.url,
                    mediaPathSrc: mediaLocalPath
                }).catch(err => console.error('Download failed:', err));
            }
            
            medialoop[slotid].push({
                contentUrl: mediaLocalPath,
                contentDuration: item.duration,
                contentType: item.contentType,
                mediaType: item.type
            });
        }
    }
    
    // Phase 4: Start playback
    if (medialoop[slotid].length > 0) {
        console.log('[mediaFunc] Starting playback with', medialoop[slotid].length, 'media items');
        appendMediaElement(medialoop[slotid][0], '#slot-' + slotid, slotid);
    } else {
        console.warn('[mediaFunc] ⚠ No valid media loaded for slot', slotid, '- all items were "none" or invalid');
        
        // Show user notification if no media to play
        if (window.errorNotification) {
            window.errorNotification.warning(
                'No Media to Play',
                'All media items in this slot are empty or set to "none"',
                5000
            );
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

//render every media slot with IMPROVED VIDEO INITIALIZATION
async function appendMediaElement(asset, previewele, slotid) {
    videoIdIncrease[slotid] = generateRandomNumber()
    var videojsid = parseInt(slotid) + videoIdIncrease[slotid]
    if (mediaTimeout[slotid]) { //clear mediaTimeout to reset
        clearTimeout(mediaTimeout[slotid])
    }
    var duration = parseInt(asset.contentDuration * 1000)
    
    if (asset.mediaType == "IMAGE") { //image player
        //object-fit to fit image inside the image elements //fill : image stretched on slot
        mediaEl[slotid] = '<img id="lp-preview-image" class="media-slot" style="object-fit: fill;" src="' + asset.contentUrl + '" onload="console.log(\'Image loaded successfully\')" onerror="console.error(\'Image load error\')">'
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
    } else if (asset.mediaType == "STREAM") { //streaming player (M3U8/HLS)
        mediaEl[slotid] = ""
        mediaEl[slotid] =
            '<video id="video-' + videojsid + '" class="video-js vjs-default-skin vjs-fill media-slot" autoplay muted playsinline preload="auto">'
        mediaEl[slotid] += "<source src='" + asset.contentUrl + "' type='" + asset.contentType + "'>"
        mediaEl[slotid] += "</video>"
        $(previewele).html(mediaEl[slotid])
        
        // Initialize VideoJS with HLS support
        videoJSPlayer[videojsid] = videojs('video-' + videojsid, {
            html5: {
                vhs: {
                    withCredentials: false,
                    overrideNative: true
                },
                nativeAudioTracks: false,
                nativeVideoTracks: false
            },
            liveui: true
        }, function() {
            console.log('[VideoJS] Player ready for stream');
        })
        
        videoJSPlayer[videojsid].controls(false)

        // Add synchronization support to VideoJS player
        if (videoJSPlayer[videojsid]) {
            setupVideoSync(videoJSPlayer[videojsid], videojsid);
        }

        // IMPROVED: Add playback verification for streams
        var streamStarted = false;
        var streamTimeout = null;
        
        videoJSPlayer[videojsid].on('playing', function() {
            streamStarted = true;
            console.log('[VideoJS] Stream playing successfully');
            if (streamTimeout) {
                clearTimeout(streamTimeout);
                streamTimeout = null;
            }
        });
        
        // IMPROVED: Skip if stream doesn't start within 5 seconds
        streamTimeout = setTimeout(function() {
            if (!streamStarted && videoJSPlayer[videojsid]) {
                console.warn('[VideoJS] Stream failed to start within 5s - skipping');
                if (window.errorNotification) {
                    window.errorNotification.warning(
                        'Stream Error',
                        'Unable to connect to stream - skipping',
                        3000
                    );
                }
                try {
                    videoJSPlayer[videojsid].dispose();
                } catch (e) {
                    console.warn('[VideoJS] Error disposing stuck stream:', e);
                }
                changeMedia(slotid);
            }
        }, 5000);

        //check if duration 0 then play full duration
        if (duration == 0) {
            videoJSPlayer[videojsid].on('ended', function () {
                if (streamTimeout) clearTimeout(streamTimeout);
                videoJSPlayer[videojsid].dispose()
                changeMedia(slotid)
            })

            // if not play with duration 
        } else {
            setTimeout(function () {
                if (streamTimeout) clearTimeout(streamTimeout);
                try {
                    const frame = captureVideoFrame('video-' + videojsid, 'png')
                    if (frame) {
                        videoJSPlayer[videojsid].poster(frame.dataUri)
                    }
                } catch (e) {
                    console.warn('[VideoJS] Frame capture failed:', e);
                }
                videoJSPlayer[videojsid].dispose()
                changeMedia(slotid)
            }, duration)
        }
        
        // IMPROVED: Better stream error handling
        videoJSPlayer[videojsid].on('error', function () {
            if (streamTimeout) clearTimeout(streamTimeout);
            
            var error = videoJSPlayer[videojsid].error()
            var errorCode = error ? error.code : 0;
            var errorMsg = error ? error.message : 'Unknown';
            
            console.error('[VideoJS] Stream error:', errorCode + ' - ' + errorMsg);
            
            // Show user-friendly error
            if (window.errorNotification) {
                window.errorNotification.error(
                    'Stream Playback Error',
                    'Unable to play stream: ' + errorMsg,
                    4000
                );
            }
            
            try {
                videoJSPlayer[videojsid].dispose()
            } catch (e) {
                console.warn('[VideoJS] Error disposing failed stream:', e);
            }
            
            changeMedia(slotid)
        })
    } else if (asset.mediaType == "VIDEO") { //basic video player
        mediaEl[slotid] =
            '<video id="video-' + videojsid + '" class="video-js vjs-default-skin vjs-fill media-slot" autoplay muted playsinline preload="auto">'
        mediaEl[slotid] += "<source src='" + asset.contentUrl + "' type='" + asset.contentType + "'>"
        mediaEl[slotid] += "</video>"
        $(previewele).html(mediaEl[slotid])
        
        videoJSPlayer[videojsid] = videojs('video-' + videojsid, {
            preload: 'auto',
            autoplay: true,
            muted: true,
            techOrder: ['html5'],
            html5: {
                nativeAudioTracks: false,
                nativeVideoTracks: false,
                nativeTextTracks: false
            }
        }, function() {
            console.log('[VideoJS] Video player ready');
        })
        
        videoJSPlayer[videojsid].controls(false)
        
        // Add synchronization support to VideoJS player
        if (videoJSPlayer[videojsid]) {
            setupVideoSync(videoJSPlayer[videojsid], videojsid);
        }
        
        // IMPROVED: Add canplaythrough check to verify video can actually play
        var playbackStarted = false;
        var errorTimeout = null;
        
        videoJSPlayer[videojsid].on('canplaythrough', function() {
            playbackStarted = true;
            console.log('[VideoJS] Video can play through');
            if (errorTimeout) {
                clearTimeout(errorTimeout);
                errorTimeout = null;
            }
        });
        
        // IMPROVED: Skip to next if video doesn't start within 3 seconds
        errorTimeout = setTimeout(function() {
            if (!playbackStarted && videoJSPlayer[videojsid]) {
                console.warn('[VideoJS] Video failed to start playing within 3s - skipping');
                try {
                    videoJSPlayer[videojsid].dispose();
                } catch (e) {
                    console.warn('[VideoJS] Error disposing stuck player:', e);
                }
                changeMedia(slotid);
            }
        }, 3000);
        
        //check if duration 0 then play full duration
        if (duration == 0) {
            videoJSPlayer[videojsid].on("timeupdate", function (event) { //chrome fix
                if (videoJSPlayer[videojsid].currentTime() == videoJSPlayer[videojsid].duration()) {
                    if (errorTimeout) clearTimeout(errorTimeout);
                    videoJSPlayer[videojsid].dispose()
                    changeMedia(slotid)
                }
            })
            // if not play with duration 
        } else {
            videoJSPlayer[videojsid].on('timeupdate', function () {
                var currTime = videoJSPlayer[videojsid].currentTime()
                currTime = parseInt(currTime) * 1000
                if (currTime >= duration) {
                    if (errorTimeout) clearTimeout(errorTimeout);
                    videoJSPlayer[videojsid].dispose()
                    changeMedia(slotid)
                }
            })
        }
        
        // IMPROVED: Better error handling with codec error detection
        videoJSPlayer[videojsid].on('error', function () {
            if (errorTimeout) clearTimeout(errorTimeout);
            
            var error = videoJSPlayer[videojsid].error()
            var errorCode = error ? error.code : 0;
            var errorMsg = error ? error.message : 'Unknown';
            
            console.error('[VideoJS] Video error:', errorCode + ' - ' + errorMsg);
            
            // MEDIA_ERR_DECODE (3) = codec not supported or corrupted
            if (errorCode === 3) {
                console.error('[VideoJS] Codec error - video format not supported by device');
                if (window.errorNotification) {
                    window.errorNotification.warning(
                        'Video Codec Error',
                        'Video format not supported - skipping to next',
                        3000
                    );
                }
            }
            
            try {
                videoJSPlayer[videojsid].dispose()
            } catch (e) {
                console.warn('[VideoJS] Error disposing failed player:', e);
            }
            
            // IMPROVED: Skip to next media immediately on error
            changeMedia(slotid)
        })
    } else if (asset.mediaType == "CCTV") { //cctv video player (FLV)
        mediaEl[slotid] =
            '<video id="video-' + videojsid + '" class="video-js vjs-default-skin vjs-fill media-slot" autoplay muted playsinline preload="auto">'
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
        }, function() {
            console.log('[VideoJS] CCTV player ready');
        })
        
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
            var error = videoJSPlayer[videojsid].error()
            console.error('[VideoJS] CCTV error:', error ? error.code + ' - ' + error.message : 'Unknown');
            videoJSPlayer[videojsid].dispose()
            changeMedia(slotid)
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
            console.log('=== VIDEO SYNC: Player', playerIndex, 'seeked');
            if (typeof broadcastVideoTime === 'function') {
                setTimeout(() => broadcastVideoTime(), 100);
            }
        });
        
        // Periodic sync check for smooth synchronization
        var syncInterval = setInterval(function() {
            if (videoJSPlayer[playerIndex]) {
                checkVideoSyncDrift(videoJSPlayer[playerIndex], playerIndex);
            } else {
                clearInterval(syncInterval);
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
            player.currentTime(targetTime);
            console.log('=== VIDEO SYNC: Adjusted player', playerIndex, 'time to', targetTime);
        }
        
        // Sync play/pause state
        var isCurrentlyPaused = player.paused();
        if (isPaused && !isCurrentlyPaused) {
            player.pause();
            console.log('=== VIDEO SYNC: Paused player', playerIndex);
        } else if (!isPaused && isCurrentlyPaused) {
            player.play().catch(function(error) {
                console.warn('=== VIDEO SYNC: Failed to play player', playerIndex, error);
            });
            console.log('=== VIDEO SYNC: Resumed player', playerIndex);
        }
        
        // Update sync tracking
        if (videoSyncLastUpdate[playerIndex]) {
            videoSyncLastUpdate[playerIndex].lastSyncTime = Date.now();
            videoSyncLastUpdate[playerIndex].lastCurrentTime = targetTime;
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
            for (var i = 0; i < videoJSPlayer.length; i++) {
                if (videoJSPlayer[i] && typeof videoJSPlayer[i].currentTime === 'function') {
                    playersData.push({
                        index: i,
                        currentTime: videoJSPlayer[i].currentTime(),
                        isPaused: videoJSPlayer[i].paused(),
                        duration: videoJSPlayer[i].duration()
                    });
                }
            }
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
            videoSyncConfig = {
                enabled: false,
                tolerance: 0.5
            };
            console.log('=== VIDEO SYNC: Using default config');
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
