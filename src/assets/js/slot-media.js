var previewContainer
var videoJSPlayer = new Array() //videojs call function
var mediaTimeout = new Array()
var mediaCurIndex = new Array()
var medialoop = new Array()
var mediaEl = new Array()
var mediasrcList = new Array()
var mediafilenameList = new Array()
var videoIdIncrease = new Array()

function generateRandomNumber() {
    const minDigits = 7;
    const randomNumber = Math.floor(Math.random() * Math.pow(10, minDigits - 1)) + Math.pow(10, minDigits - 1);
    return randomNumber;
}

/**
 * Parse streaming URL format from server
 * Supports new format: {protocol:url}
 * Examples:
 *   {m3u8:http://server/playlist.m3u8}
 *   {rtsp://server/stream}
 *   {rtmp://server/stream}
 *   {http://server/video.mp4}
 *   {https://server/video.mp4}
 * 
 * @param {string} rawSrc - Raw source from server (may contain {protocol:url} format)
 * @returns {Object} Parsed streaming info: { protocol, url, isStreaming, originalSrc }
 */
function parseStreamingUrl(rawSrc) {
    if (!rawSrc || typeof rawSrc !== 'string') {
        return {
            protocol: null,
            url: rawSrc,
            isStreaming: false,
            originalSrc: rawSrc
        };
    }
    
    const trimmed = rawSrc.trim();
    
    // Check if it's in {protocol:url} format
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        // Remove curly braces
        const content = trimmed.slice(1, -1);
        
        // Check for protocol prefix (e.g., "m3u8:", "rtsp:", etc.)
        const colonIndex = content.indexOf(':');
        
        if (colonIndex > 0) {
            const potentialProtocol = content.substring(0, colonIndex).toLowerCase();
            const remainingUrl = content.substring(colonIndex + 1);
            
            // List of supported streaming protocols
            const streamingProtocols = ['m3u8', 'rtsp', 'rtmp', 'http', 'https'];
            
            // Check if it's a known streaming protocol
            if (streamingProtocols.includes(potentialProtocol)) {
                // For http/https, the URL will be "http://..." or "https://...", so reconstruct
                let finalUrl;
                if (potentialProtocol === 'http' || potentialProtocol === 'https') {
                    finalUrl = potentialProtocol + ':' + remainingUrl;
                } else if (potentialProtocol === 'm3u8') {
                    // M3U8 format: {m3u8:http://...} - the remaining URL should be complete
                    finalUrl = remainingUrl;
                } else {
                    // RTSP/RTMP format: {rtsp://...} or {rtmp://...}
                    // The protocol is part of the URL already
                    finalUrl = potentialProtocol + ':' + remainingUrl;
                }
                
                console.log('[parseStreamingUrl] ✓ Detected streaming format:', potentialProtocol, '→', finalUrl);
                
                return {
                    protocol: potentialProtocol,
                    url: finalUrl,
                    isStreaming: true,
                    originalSrc: rawSrc
                };
            }
        }
        
        // If no protocol prefix found, just strip the braces (backward compatibility)
        console.log('[parseStreamingUrl] No protocol prefix, stripping braces:', content);
        return {
            protocol: null,
            url: content,
            isStreaming: false,
            originalSrc: rawSrc
        };
    }
    
    // Not in curly brace format - return as-is
    return {
        protocol: null,
        url: trimmed,
        isStreaming: false,
        originalSrc: rawSrc
    };
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
    slotitem.forEach(function (media, mindex) {
        // Parse source with new streaming parser
        const rawSrc = media['elements']['0']['text'];
        const parsed = parseStreamingUrl(rawSrc);
        var src = parsed.url;
        
        // Skip "none" media items
        if (!src || src === 'none' || src === 'None' || src === 'NONE' || src.toLowerCase() === 'none') {
            console.log('[mediaFunc] Skipping "none" media at index', mindex)
            return // Continue to next iteration
        }
        
        var duration = media['attributes']['duration']
        var n = src.lastIndexOf('.')
        var mediamode = src.substring(n + 1)
        var ytbe = src.split("/")
        //media file location
        var mediaLocalPath

        //check media file if exist
        var mediaDownloadURL = serverAdd + mediapath + '/' + src
        
        // === Handle Streaming Formats (from new {protocol:url} format) ===
        if (parsed.isStreaming && parsed.protocol) {
            console.log('[mediaFunc] Streaming format detected:', parsed.protocol, '→', src);
            
            // M3U8/HLS streaming
            if (parsed.protocol === 'm3u8') {
                var contentObj = new Object()
                contentObj.contentUrl = src
                contentObj.contentDuration = duration
                contentObj.contentType = "application/x-mpegURL"
                contentObj.mediaType = "STREAM"
                contentObj.streamProtocol = "m3u8"
                medialoop[slotid].push(contentObj)
                
                if (mindex === slotitem.length - 1 && medialoop[slotid][0]) {
                    appendMediaElement(medialoop[slotid][0], '#slot-' + slotid, slotid)
                }
                return
            }
            
            // RTSP streaming
            if (parsed.protocol === 'rtsp') {
                console.warn('[mediaFunc] RTSP requires transcoding - check if URL is pre-transcoded');
                var contentObj = new Object()
                contentObj.contentUrl = src
                contentObj.contentDuration = duration
                contentObj.contentType = "application/x-rtsp"
                contentObj.mediaType = "RTSP_STREAM"
                contentObj.streamProtocol = "rtsp"
                medialoop[slotid].push(contentObj)
                
                if (mindex === slotitem.length - 1 && medialoop[slotid][0]) {
                    appendMediaElement(medialoop[slotid][0], '#slot-' + slotid, slotid)
                }
                return
            }
            
            // RTMP streaming
            if (parsed.protocol === 'rtmp') {
                var contentObj = new Object()
                contentObj.contentUrl = src
                contentObj.contentDuration = duration
                contentObj.contentType = "video/x-flv"
                contentObj.mediaType = "RTMP_STREAM"
                contentObj.streamProtocol = "rtmp"
                medialoop[slotid].push(contentObj)
                
                if (mindex === slotitem.length - 1 && medialoop[slotid][0]) {
                    appendMediaElement(medialoop[slotid][0], '#slot-' + slotid, slotid)
                }
                return
            }
            
            // HTTP/HTTPS external URLs
            if (parsed.protocol === 'http' || parsed.protocol === 'https') {
                // Detect if it's a streaming URL or regular video
                if (src.toLowerCase().includes('.m3u8') || src.toLowerCase().includes('.m3u')) {
                    var contentObj = new Object()
                    contentObj.contentUrl = src
                    contentObj.contentDuration = duration
                    contentObj.contentType = "application/x-mpegURL"
                    contentObj.mediaType = "STREAM"
                    contentObj.streamProtocol = "m3u8"
                    medialoop[slotid].push(contentObj)
                } else if (src.toLowerCase().includes('.flv')) {
                    var contentObj = new Object()
                    contentObj.contentUrl = src
                    contentObj.contentDuration = duration
                    contentObj.contentType = "video/x-flv"
                    contentObj.mediaType = "CCTV"
                    contentObj.streamProtocol = "flv"
                    medialoop[slotid].push(contentObj)
                } else {
                    // Regular external video
                    var contentObj = new Object()
                    contentObj.contentUrl = src
                    contentObj.contentDuration = duration
                    contentObj.contentType = "video/mp4"
                    contentObj.mediaType = "VIDEO"
                    medialoop[slotid].push(contentObj)
                }
                
                if (mindex === slotitem.length - 1 && medialoop[slotid][0]) {
                    appendMediaElement(medialoop[slotid][0], '#slot-' + slotid, slotid)
                }
                return
            }
        }
        
        // === Handle Legacy Formats (backward compatibility) ===
        if (['png', 'jpg', 'jpeg', 'bmp', 'gif', 'mp4', 'webm'].includes(mediamode)) { //image and video format
            if (src != 'none') {
                var mediaName = src.split('/')
                mediaName = mediaName[1]
                //add source to media list and isnert to cpanel
                mediafilenameList.push(mediaName)
                mediaLocalPath = homedir + '/clessapp/res/' + mediaName
                if (!fs.existsSync(mediaLocalPath)) {
                    //using ipc to download media cause electron not allow to use axios
                    //https://stackoverflow.com/questions/65602941/axios-error-data-pipe-is-not-a-function
                    ipcRenderer.invoke('app-downloadmedia', {
                        mediaURL: mediaDownloadURL,
                        mediaPathSrc: mediaLocalPath
                    }).then((result) => {
                        log.info('Saved to ' + mediaLocalPath)
                    })
                }
            }
        }

        //add source to media list and isnert to column image inside table slot
        mediasrcList.push(mediaLocalPath)

        if (['png', 'jpg', 'jpeg', 'bmp', 'gif'].includes(mediamode)) { //image format
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
            var contentObj = new Object()
            contentObj.contentUrl = mediaLocalPath
            contentObj.contentDuration = duration
            contentObj.contentType = "video/mp4"
            contentObj.mediaType = "VIDEO"
            medialoop[slotid].push(contentObj)
        } else if (['flv'].includes(mediamode)) { //video flv format
            var contentObj = new Object()
            contentObj.contentUrl = src
            contentObj.contentDuration = duration
            contentObj.contentType = "video/x-flv"
            contentObj.mediaType = "CCTV"
            medialoop[slotid].push(contentObj)
        } else { //none 
        }
        if (mindex === slotitem.length - 1) {
            if (!medialoop[slotid][0]) {
                medialoop[slotid][0] = 10
            }
            appendMediaElement(medialoop[slotid][0], '#slot-' + slotid, slotid)
        }
    })
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
            videoJSPlayer[videojsid].on("timeupdate", function (event) { //chrome fix
                if (videoJSPlayer[videojsid].currentTime() == videoJSPlayer[videojsid].duration()) {
                    videoJSPlayer[videojsid].dispose()
                    changeMedia(slotid)
                }
            })
            // if not play with duration 
        } else {
            videoJSPlayer[videojsid].on('timeupdate', function () {
                var currTime = videoJSPlayer[videojsid].currentTime()
                currTime = parseInt(currTime) * 1000
                if (currTime == duration) {
                    videoJSPlayer[videojsid].dispose()
                    changeMedia(slotid)
                }
            })
        }
        videoJSPlayer[videojsid].on('error', function () {
            videoJSPlayer[videojsid].dispose()
            changeMedia(slotid)
            var error = videoJSPlayer[videojsid].error()
            log.warn('VIDEOJS ERROR : ', error.code, error.type, error.message)
            console.log('VIDEOJS ERROR : ', error.code, error.type, error.message)
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
    } else if (asset.mediaType == "RTSP_STREAM") { //RTSP streaming player
        console.log('[appendMediaElement] RTSP stream detected:', asset.contentUrl);
        
        // RTSP cannot be played directly in Electron/browsers
        // Check if URL is transcoded (contains .m3u8)
        if (asset.contentUrl.includes('.m3u8')) {
            console.log('[appendMediaElement] RTSP appears transcoded - treating as HLS');
            
            mediaEl[slotid] = '<video id="video-' + videojsid + '" poster="http://dummyimage.com/320x240/ffffff/fff" class="video-js vjs-default-skin vjs-fill" class="media-slot" autoplay controls preload="metadata" data-setup="{}">'
            mediaEl[slotid] += "<source src='" + asset.contentUrl + "' type='application/x-mpegURL'>"
            mediaEl[slotid] += "</video>"
            $(previewele).html(mediaEl[slotid])
            videoJSPlayer[videojsid] = videojs('video-' + videojsid, {}, function () {})
            videoJSPlayer[videojsid].controls(false)
            
            if (duration == 0) {
                videoJSPlayer[videojsid].on('ended', function () {
                    videoJSPlayer[videojsid].dispose()
                    changeMedia(slotid)
                })
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
                log.warn('VIDEOJS RTSP ERROR : ', error.code, error.type, error.message)
            })
        } else {
            // Pure RTSP - show error
            console.error('[appendMediaElement] RTSP requires transcoding');
            log.warn('RTSP streams require server-side transcoding to HLS');
            
            mediaEl[slotid] = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #1a1a1a; color: #ff6b6b; font-size: 14px; padding: 20px; text-align: center;">';
            mediaEl[slotid] += '<div><strong>RTSP Stream Error</strong><br/>Requires server-side transcoding to HLS<br/><small>' + asset.contentUrl + '</small></div>';
            mediaEl[slotid] += '</div>';
            $(previewele).html(mediaEl[slotid])
            
            setTimeout(function () {
                changeMedia(slotid)
            }, 5000)
        }
    } else if (asset.mediaType == "RTMP_STREAM") { //RTMP streaming player
        console.log('[appendMediaElement] RTMP stream detected:', asset.contentUrl);
        
        mediaEl[slotid] = '<video id="video-' + videojsid + '" poster="http://dummyimage.com/320x240/ffffff/fff" class="video-js vjs-default-skin vjs-fill" class="media-slot" autoplay controls preload="metadata" data-setup="{}">'
        mediaEl[slotid] += "<source src='" + asset.contentUrl + "' type='video/x-flv'>"
        mediaEl[slotid] += "</video>"
        $(previewele).html(mediaEl[slotid])
        videoJSPlayer[videojsid] = videojs('video-' + videojsid, {
            techOrder: ['html5', 'flvjs'],
            flvjs: {
                mediaDataSource: {
                    type: 'flv',
                    isLive: true,
                    cors: true,
                    withCredentials: false,
                    url: asset.contentUrl
                }
            },
        }, function () {})
        videoJSPlayer[videojsid].controls(false)
        
        if (duration == 0) {
            videoJSPlayer[videojsid].on('ended', function () {
                videoJSPlayer[videojsid].dispose()
                changeMedia(slotid)
            })
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
            log.warn('VIDEOJS RTMP ERROR : ', error.code, error.type, error.message)
            console.log('VIDEOJS RTMP ERROR : ', error.code, error.type, error.message)
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