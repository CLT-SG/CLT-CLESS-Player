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

                console.log('[parseStreamingUrl] ✓ Detected streaming format:', potentialProtocol, '→', sanitizeMediaUrlForLog(finalUrl));

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
                // Use new streaming parser instead of simple strip
                const rawSrc = firstElement['text'];
                const parsed = parseStreamingUrl(rawSrc);
                src = parsed.url;

                // Store parsed info for later use
                if (parsed.isStreaming) {
                    media._parsedStreaming = parsed;
                }
            }
        } else {
            // Fallback paths
            let rawSrc = null;
            if (media['text']) {
                rawSrc = media['text'];
            } else if (media['attributes'] && media['attributes']['src']) {
                rawSrc = media['attributes']['src'];
            } else if (media['attributes'] && media['attributes']['file']) {
                rawSrc = media['attributes']['file'];
            }

            if (rawSrc) {
                const parsed = parseStreamingUrl(rawSrc);
                src = parsed.url;

                // Store parsed info for later use
                if (parsed.isStreaming) {
                    media._parsedStreaming = parsed;
                }
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

        // Check if this was parsed as a streaming format
        const parsedStreaming = media._parsedStreaming || null;

        mediaItems.push({
            src,
            duration,
            mediamode,
            ytbe,
            isExternal,
            mindex,
            parsedStreaming
        });
    }

    console.log('[mediaFunc] Parsed', mediaItems.length, 'valid media items');

    // Phase 2: Process based on type
    for (const item of mediaItems) {
        const { src, duration, mediamode, ytbe, isExternal, parsedStreaming } = item;

        // Double-check for "none" values (safety check)
        if (!src || src.toLowerCase() === 'none' || src.trim() === '') {
            console.log('[mediaFunc] ✓ Skipping "none" value in processing phase');
            continue;
        }

        console.log('[mediaFunc] Processing:', sanitizeMediaUrlForLog(src), '- Mode:', mediamode, '- External:', isExternal, '- Streaming:', parsedStreaming?.protocol || 'none');

        // === PRIORITY 1: Handle Streaming Protocols (from new {protocol:url} format) ===
        if (parsedStreaming && parsedStreaming.isStreaming) {
            const protocol = parsedStreaming.protocol;

            // Handle M3U8/HLS streaming
            if (protocol === 'm3u8') {
                console.log('[mediaFunc] → Adding M3U8/HLS stream:', sanitizeMediaUrlForLog(src));
                medialoop[slotid].push({
                    contentUrl: src,
                    contentDuration: duration,
                    contentType: "application/x-mpegURL",
                    mediaType: "STREAM",
                    streamProtocol: "m3u8"
                });
                continue;
            }

            // Handle RTSP streaming
            if (protocol === 'rtsp') {
                console.log('[mediaFunc] → Adding RTSP stream:', sanitizeMediaUrlForLog(src));
                medialoop[slotid].push({
                    contentUrl: src,
                    contentDuration: duration,
                    contentType: "application/x-rtsp",
                    mediaType: "RTSP_STREAM",
                    streamProtocol: "rtsp"
                });

                // Show warning about RTSP browser compatibility
                if (window.errorNotification) {
                    window.errorNotification.show(
                        'RTSP streams require server-side transcoding (WebRTC/HLS) for browser playback',
                        'info',
                        5000
                    );
                }
                continue;
            }

            // Handle RTMP streaming
            if (protocol === 'rtmp') {
                console.log('[mediaFunc] → Adding RTMP stream:', sanitizeMediaUrlForLog(src));
                medialoop[slotid].push({
                    contentUrl: src,
                    contentDuration: duration,
                    contentType: "video/x-flv",
                    mediaType: "RTMP_STREAM",
                    streamProtocol: "rtmp"
                });
                continue;
            }

            // Handle HTTP/HTTPS external video URLs
            if (protocol === 'http' || protocol === 'https') {
                console.log('[mediaFunc] → Adding external HTTP/HTTPS video:', sanitizeMediaUrlForLog(src));

                // Determine if it's a stream or regular video based on URL
                const lowerSrc = src.toLowerCase();
                if (lowerSrc.includes('.m3u8') || lowerSrc.includes('.m3u')) {
                    // It's an M3U8 stream
                    medialoop[slotid].push({
                        contentUrl: src,
                        contentDuration: duration,
                        contentType: "application/x-mpegURL",
                        mediaType: "STREAM",
                        streamProtocol: "m3u8"
                    });
                } else if (lowerSrc.includes('.flv')) {
                    // It's an FLV stream
                    medialoop[slotid].push({
                        contentUrl: src,
                        contentDuration: duration,
                        contentType: "video/x-flv",
                        mediaType: "CCTV",
                        streamProtocol: "flv"
                    });
                } else {
                    // Treat as regular video
                    medialoop[slotid].push({
                        contentUrl: src,
                        contentDuration: duration,
                        contentType: "video/mp4",
                        mediaType: "VIDEO",
                        streamProtocol: null
                    });
                }
                continue;
            }
        }

        // === PRIORITY 2: Handle YouTube (legacy detection) ===
        // === PRIORITY 2: Handle YouTube (legacy detection) ===
        if (ytbe[2] === 'youtu.be' || src.includes('youtube.com')) {
            const videoId = ytbe[3] || extractYouTubeId(src);
            console.log('[mediaFunc] → Adding YouTube video:', videoId);
            medialoop[slotid].push({
                contentUrl: videoId,
                contentDuration: duration,
                contentType: "youtube",
                mediaType: "YTB"
            });
            continue;
        }

        // === PRIORITY 3: Handle M3U8 streams (legacy extension-based detection) ===
        if (mediamode === 'm3u8' || mediamode === 'm3u') {
            console.log('[mediaFunc] → Adding M3U8 stream (extension-based):', sanitizeMediaUrlForLog(src));
            medialoop[slotid].push({
                contentUrl: src, // Use URL directly (external or relative)
                contentDuration: duration,
                contentType: "application/x-mpegURL",
                mediaType: "STREAM",
                streamProtocol: "m3u8"
            });
            continue;
        }

        // === PRIORITY 4: Handle FLV streams (legacy) ===
        if (mediamode === 'flv') {
            console.log('[mediaFunc] → Adding FLV stream:', sanitizeMediaUrlForLog(src));
            medialoop[slotid].push({
                contentUrl: src,
                contentDuration: duration,
                contentType: "video/x-flv",
                mediaType: "CCTV",
                streamProtocol: "flv"
            });
            continue;
        }

        // === PRIORITY 5: Handle Images ===
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
                // Use smart URI resolver which will return converted file URIs for native videos
                const mediaUri = await window.mediaManager.getMediaUriSmart(item.filename, false);

                if (mediaUri) {
                    console.log('[mediaFunc] Preloaded', item.filename, '->', sanitizeMediaUrlForLog(mediaUri));
                    medialoop[slotid].push({
                        contentUrl: mediaUri,
                        contentDuration: item.duration,
                        contentType: item.contentType,
                        mediaType: item.type,
                        filename: item.filename,
                        originalUrl: item.url // Keep original remote URL for fallback
                    });
                } else {
                    console.warn('[mediaFunc] Failed to get URI for:', item.filename, '— falling back to remote URL', item.url);
                    medialoop[slotid].push({
                        contentUrl: item.url,
                        contentDuration: item.duration,
                        contentType: item.contentType,
                        mediaType: item.type,
                        filename: item.filename,
                        originalUrl: item.url,
                        fallbackRemote: true
                    });
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

                    // Use smart URI resolver
                    const mediaUri = await window.mediaManager.getMediaUriSmart(item.filename, false);
                    if (mediaUri) {
                        medialoop[slotid].push({
                            contentUrl: mediaUri,
                            contentDuration: item.duration,
                            contentType: item.contentType,
                            mediaType: item.type,
                            filename: item.filename,
                            originalUrl: item.url
                        });
                    } else {
                        console.warn('[mediaFunc] getMediaUriSmart failed for', item.filename, '- falling back to remote URL');
                        medialoop[slotid].push({
                            contentUrl: item.url,
                            contentDuration: item.duration,
                            contentType: item.contentType,
                            mediaType: item.type,
                            filename: item.filename,
                            originalUrl: item.url,
                            fallbackRemote: true
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
    console.log('[mediaFunc] Change media, Advancing to next media in slot:', slotid);
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

//render every media slot with IMPROVED VIDEO INITIALIZATION and LOADING STATES
async function appendMediaElement(asset, previewele, slotid) {
    videoIdIncrease[slotid] = generateRandomNumber()
    var videojsid = parseInt(slotid) + videoIdIncrease[slotid]
    if (mediaTimeout[slotid]) { //clear mediaTimeout to reset
        clearTimeout(mediaTimeout[slotid])
    }
    var duration = parseInt(asset.contentDuration * 1000)
    const loaderId = `media-${slotid}-${Date.now()}`;

    if (asset.mediaType == "IMAGE") { //image player
        // Show skeleton loader while image loads
        if (window.mediaLoadingStates) {
            const loader = window.mediaLoadingStates.createImageLoader($(previewele)[0], loaderId);
            $(previewele).html(loader);
        }

        //object-fit to fit image inside the image elements //fill : image stretched on slot
        const img = new Image();
        img.id = "lp-preview-image";
        img.className = "media-slot";
        img.style.objectFit = "fill";
        
        img.onload = function() {
            console.log('Image loaded successfully');
            // Remove loader and show image with fade-in
            if (window.mediaLoadingStates) {
                window.mediaLoadingStates.removeLoader(loaderId, img);
            }
            mediaEl[slotid] = img.outerHTML;
            $(previewele).html(img);
            
            // image: go to the next media after specific seconds
            if (medialoop[slotid].length > 1) {
                mediaTimeout[slotid] = setTimeout(function () {
                    changeMedia(slotid)
                }, duration)
            }
        };
        
        img.onerror = function() {
            console.error('Image load error');
            if (window.mediaLoadingStates) {
                window.mediaLoadingStates.showError(loaderId, 'Image failed to load');
                setTimeout(() => {
                    window.mediaLoadingStates.removeLoader(loaderId);
                    // Try next media on error
                    if (medialoop[slotid].length > 1) {
                        changeMedia(slotid);
                    }
                }, 2000);
            }
        };
        
        img.src = asset.contentUrl;

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
            '<video id="video-' + videojsid + '" class="video-js vjs-default-skin vjs-fill media-slot" autoplay playsinline preload="auto">'
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
        }, function () {
            console.log('[VideoJS] Player ready for stream');
        })

        videoJSPlayer[videojsid].controls(false)

        // Add synchronization support to VideoJS player
        //if (videoJSPlayer[videojsid]) {
        //    setupVideoSync(videoJSPlayer[videojsid], videojsid);
        //}

        // IMPROVED: Add playback verification for streams
        var streamStarted = false;
        var streamTimeout = null;

        videoJSPlayer[videojsid].on('playing', function () {
            streamStarted = true;
            console.log('[VideoJS] Stream playing successfully');
            if (streamTimeout) {
                clearTimeout(streamTimeout);
                streamTimeout = null;
            }
        });

        //check if not duration 0 or single video then play with duration
        if (medialoop[slotid].length > 1) {
            if (duration > 0) {
                console.log('[VideoJS] Setting stream duration timeout:', duration, 'ms');
                console.log('[VideoJS] Total media items in slot:', medialoop[slotid].length);
                setTimeout(function () {
                    if (streamTimeout) clearTimeout(streamTimeout);
                    if (videoJSPlayer[videojsid]) {
                        videoJSPlayer[videojsid].dispose()
                        changeMedia(slotid)
                    }
                }, duration)
            } else {
                console.log('[VideoJS] Stream will play full duration (no timeout set)');
            }
        } else {
            console.log('[VideoJS] Single stream item - will play full duration');
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
                if (videoJSPlayer[videojsid]) {
                    videoJSPlayer[videojsid].dispose()
                }
            } catch (e) {
                console.warn('[VideoJS] Error disposing failed stream:', e);
            }

            changeMedia(slotid)
        })
    } else if (asset.mediaType == "VIDEO") { //basic video player
        // Show spinner loader while video initializes
        if (window.mediaLoadingStates) {
            const loader = window.mediaLoadingStates.createVideoLoader($(previewele)[0], loaderId, 'Loading video...');
            $(previewele).html(loader);
        }

        mediaEl[slotid] =
            '<video id="video-' + videojsid + '" class="video-js vjs-default-skin vjs-fill media-slot" autoplay playsinline preload="auto">'
        mediaEl[slotid] += "<source src='" + asset.contentUrl + "' type='" + asset.contentType + "'>"
        mediaEl[slotid] += "</video>"
        
        // Append video element (it will be under the loader initially)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = mediaEl[slotid];
        const videoElement = tempDiv.firstChild;
        $(previewele).append(videoElement);

        videoJSPlayer[videojsid] = videojs('video-' + videojsid, {}, function () {
            console.log('[VideoJS] Video normal type (mp4/mov/webm) player ready,  src:', asset.contentUrl);
            console.log('[VideoJS] Asset details:', asset);
        })

        videoJSPlayer[videojsid].controls(false)

        // Add synchronization support to VideoJS player
        //if (videoJSPlayer[videojsid]) {
        //    setupVideoSync(videoJSPlayer[videojsid], videojsid);
        //}

        // IMPROVED: Add canplaythrough check to verify video can actually play
        var playbackStarted = false;
        var errorTimeout = null;

        videoJSPlayer[videojsid].on('loadeddata', function () {
            console.log('[VideoJS] Video data loaded');
            if (window.mediaLoadingStates) {
                window.mediaLoadingStates.updateProgress(loaderId, 50);
            }
        });

        videoJSPlayer[videojsid].on('canplay', function () {
            console.log('[VideoJS] Video can play');
            if (window.mediaLoadingStates) {
                window.mediaLoadingStates.updateProgress(loaderId, 80);
            }
        });

        videoJSPlayer[videojsid].on('canplaythrough', function () {
            playbackStarted = true;
            console.log('[VideoJS] Video can play through');
            if (errorTimeout) {
                clearTimeout(errorTimeout);
                errorTimeout = null;
            }
            // Remove loader and show video with fade-in
            if (window.mediaLoadingStates) {
                window.mediaLoadingStates.removeLoader(loaderId, videoElement);
            }
        });

        // IMPROVED: Skip to next if video doesn't start within 5 seconds
        errorTimeout = setTimeout(function () {
            if (!playbackStarted && videoJSPlayer[videojsid]) {
                console.warn('[VideoJS] Video failed to start playing within 5s - skipping');
                if (window.mediaLoadingStates) {
                    window.mediaLoadingStates.showError(loaderId, 'Video timeout');
                }
                setTimeout(() => {
                    try {
                        if (videoJSPlayer[videojsid]) {
                            videoJSPlayer[videojsid].dispose();
                        }
                    } catch (e) {
                        console.warn('[VideoJS] Error disposing stuck player:', e);
                    }
                    changeMedia(slotid);
                }, 2000);
            }
        }, 5000);

        //check if duration 0 then play full duration
        if (duration == 0) {
            videoJSPlayer[videojsid].on("timeupdate", function (event) { //chrome fix
                if (videoJSPlayer[videojsid] && videoJSPlayer[videojsid].currentTime() == videoJSPlayer[videojsid].duration()) {
                    if (errorTimeout) clearTimeout(errorTimeout);
                    if (videoJSPlayer[videojsid]) {
                        videoJSPlayer[videojsid].dispose()
                        changeMedia(slotid)
                    }
                }
            })
            // if not play with duration 
        } else {
            videoJSPlayer[videojsid].on('timeupdate', function () {
                if (videoJSPlayer[videojsid]) {
                    var currTime = videoJSPlayer[videojsid].currentTime()
                    currTime = parseInt(currTime) * 1000
                    if (currTime >= duration) {
                        if (errorTimeout) clearTimeout(errorTimeout);
                        if (videoJSPlayer[videojsid]) {
                            videoJSPlayer[videojsid].dispose()
                            changeMedia(slotid)
                        }
                    }
                }
            })
        }

        // Add a flag to avoid retry loops
        var _triedFallbackSrc = false;

        // IMPROVED: Better error handling with codec error detection and fallback to original URL
        videoJSPlayer[videojsid].on('error', function () {
            if (errorTimeout) clearTimeout(errorTimeout);

            var error = videoJSPlayer[videojsid].error()
            var errorCode = error ? error.code : 0;
            var errorMsg = error ? error.message : 'Unknown';

            console.error('[VideoJS] Video error:', errorCode + ' - ' + errorMsg, 'for src:', sanitizeMediaUrlForLog(asset.contentUrl));

            try {
                console.error('[VideoJS] Diagnostic: currentSrc:', videoJSPlayer[videojsid].currentSrc ? videoJSPlayer[videojsid].currentSrc() : null, 'player.src():', videoJSPlayer[videojsid].src ? videoJSPlayer[videojsid].src() : null);
            } catch (d) { console.warn('[VideoJS] Diagnostic read failed:', d); }

            if (window.mediaManager) {
                try {
                    console.log('[VideoJS] mediaManager.getUriCache():', window.mediaManager.getUriCache());
                    console.log('[VideoJS] mediaManager.getFileUriMap():', window.mediaManager.getFileUriMap());
                    window.mediaManager.debugResolveUri(asset.filename || asset.contentUrl).then(r => {
                        console.log('[VideoJS] debugResolveUri result:', r);
                    }).catch(e => {
                        console.warn('[VideoJS] debugResolveUri failed:', e);
                    });
                } catch (e) {
                    console.warn('[VideoJS] mediaManager diagnostics failed:', e);
                }
            }

            // First attempt fallback to the original remote URL (if available and not tried yet)
            if (!_triedFallbackSrc && asset.originalUrl && asset.originalUrl !== asset.contentUrl) {
                _triedFallbackSrc = true;
                console.log('[VideoJS] Attempting fallback to original remote URL:', sanitizeMediaUrlForLog(asset.originalUrl));

                try {
                    videoJSPlayer[videojsid].src({ src: asset.originalUrl, type: asset.contentType || 'video/mp4' });
                    videoJSPlayer[videojsid].play().then(() => {
                        console.log('[VideoJS] Fallback to original URL started playback');
                    }).catch((playErr) => {
                        console.warn('[VideoJS] Fallback play failed:', playErr);
                        try {
                            videoJSPlayer[videojsid].dispose();
                        } catch (e) { console.warn('[VideoJS] Dispose failed after fallback play failure:', e); }
                        changeMedia(slotid);
                    });
                    return; // wait for fallback result
                } catch (e) {
                    console.warn('[VideoJS] Fallback attempt threw:', e);
                    // proceed to normal error handling below
                }
            }

            // MEDIA_ERR_DECODE (3) = codec not supported or corrupted
            if (errorCode === 3) {
                console.error('[VideoJS] Codec error - video format not supported by device');

                const details = {
                    filename: asset.filename || asset.contentUrl,
                    src: asset.contentUrl,
                    originalUrl: asset.originalUrl || null,
                    contentType: asset.contentType || null,
                    error: errorMsg
                };

                if (window.errorNotification && window.errorNotification.codecError) {
                    // Show the codec error overlay but AUTOMATICALLY try to play the remote URL once, without requiring user interaction.
                    const overlayId = window.errorNotification.codecError({
                        title: 'Video Codec Error',
                        message: 'This video cannot be decoded on this device. Attempting an automatic remote fallback...',
                        details: details,
                        timeout: 8000
                    });

                    // Automatic fallback behavior
                    const remote = details.originalUrl || details.src;
                    if (!_triedFallbackSrc && remote) {
                        _triedFallbackSrc = true;

                        console.log('[VideoJS] Automatic Play Remote fallback for', remote);

                        try {
                            // Attempt to play remote fallback and wait for playing event
                            let fallbackStarted = false;
                            const onPlaying = function () {
                                fallbackStarted = true;
                                console.log('[VideoJS] Remote fallback playing successfully');
                                // Remove overlay if present
                                try { const el = document.getElementById(overlayId); if (el) el.remove(); } catch (e) {}
                                // clean up listener
                                try { videoJSPlayer[videojsid].off('playing', onPlaying); } catch (e) {}
                            };

                            videoJSPlayer[videojsid].on('playing', onPlaying);

                            // Set src and try to play
                            videoJSPlayer[videojsid].src({ src: remote, type: details.contentType || 'video/mp4' });
                            const playPromise = videoJSPlayer[videojsid].play();

                            // Fallback timeout: if not started within 3s, skip
                            const fallbackTimeout = setTimeout(function () {
                                if (!fallbackStarted) {
                                    console.warn('[VideoJS] Remote fallback did not start within 3s - skipping');
                                    try { videoJSPlayer[videojsid].dispose(); } catch (e) {}
                                    try { const el = document.getElementById(overlayId); if (el) el.remove(); } catch (e) {}
                                    changeMedia(slotid);
                                }
                            }, 3000);

                            if (playPromise && typeof playPromise.then === 'function') {
                                playPromise.then(() => {
                                    // Play promise resolved; actual playing will trigger 'playing' listener
                                    console.log('[VideoJS] play() resolved for remote fallback');
                                }).catch(async (playErr) => {
                                    clearTimeout(fallbackTimeout);
                                    console.warn('[VideoJS] Remote fallback play failed:', playErr);

                                    // Try to probe the remote URL to determine if failure is due to CORS or unsupported codec
                                    try {
                                        const probe = await probeRemoteUrl(remote);
                                        console.log('[VideoJS] Remote probe result:', probe);

                                        // If probe indicates remote is reachable but likely unsupported codec, request server transcode
                                        if (probe.ok && probe.contentType && probe.contentType.includes('video')) {
                                            try {
                                                await requestServerTranscode({ filename: details.filename, src: details.src, originalUrl: details.originalUrl || details.src, contentType: details.contentType || '' });
                                                if (window.errorNotification) window.errorNotification.info('Transcode Requested', 'Requested server transcode for this video', 4000);
                                            } catch (e) {
                                                console.warn('[VideoJS] requestServerTranscode failed:', e);
                                            }
                                        } else {
                                            // If probe failed (CORS or unreachable), still try to request transcode
                                            try {
                                                await requestServerTranscode({ filename: details.filename, src: details.src, originalUrl: details.originalUrl || details.src, contentType: details.contentType || '' });
                                                if (window.errorNotification) window.errorNotification.info('Transcode Requested', 'Requested server transcode for this video', 4000);
                                            } catch (e) {
                                                console.warn('[VideoJS] requestServerTranscode failed:', e);
                                            }
                                        }
                                    } catch (e) {
                                        console.warn('[VideoJS] Remote probe failed:', e);
                                    }
                                });
                            }
                            // Return to let the fallback run
                            return;

                        } catch (e) {
                            console.warn('[VideoJS] Remote fallback attempt threw:', e);
                            try { if (videoJSPlayer[videojsid]) videoJSPlayer[videojsid].dispose(); } catch (e) {}
                            try { const el = document.getElementById(overlayId); if (el) el.remove(); } catch (e) {}
                            changeMedia(slotid);
                            return;
                        }
                    }

                    // If no remote available or already tried, auto-skip after showing info
                    setTimeout(async function () {
                        try { if (videoJSPlayer[videojsid]) videoJSPlayer[videojsid].dispose(); } catch (e) {}
                        try { const el = document.getElementById(overlayId); if (el) el.remove(); } catch (e) {}

                        // Attempt to request server transcode before skipping (best-effort)
                        try {
                            await requestServerTranscode({ filename: details.filename, src: details.src, originalUrl: details.originalUrl || details.src, contentType: details.contentType || '' });
                            if (window.errorNotification) window.errorNotification.info('Transcode Requested', 'Requested server transcode for this video', 4000);
                        } catch (e) {
                            console.warn('[VideoJS] requestServerTranscode (final) failed:', e);
                        }

                        changeMedia(slotid);
                    }, 3000);

                    return;
                } else {
                    if (window.errorNotification) {
                        window.errorNotification.warning(
                            'Video Codec Error',
                            'Video format not supported - skipping to next',
                            3000
                        );
                    }
                }
            }

            try {
                if (videoJSPlayer[videojsid]) {
                    videoJSPlayer[videojsid].dispose()
                }
            } catch (e) {
                console.warn('[VideoJS] Error disposing failed player:', e);
            }

            // IMPROVED: Skip to next media immediately on error
            changeMedia(slotid)
        })
    } else if (asset.mediaType == "CCTV") { //cctv video player (FLV)
        mediaEl[slotid] =
            '<video id="video-' + videojsid + '" class="video-js vjs-default-skin vjs-fill media-slot" autoplay playsinline preload="auto">'
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
        }, function () {
            console.log('[VideoJS] CCTV player ready');
        })

        videoJSPlayer[videojsid].controls(false)

        //check if duration 0 then play full duration
        if (duration == 0) {
            videoJSPlayer[videojsid].on('ended', function () {
                if (videoJSPlayer[videojsid]) {
                    if (videoJSPlayer[videojsid]) {
                        videoJSPlayer[videojsid].dispose()
                        changeMedia(slotid)
                    }
                }
            })
            // if not play with duration 
        } else {
            setTimeout(function () {
                if (videoJSPlayer[videojsid]) {
                    if (videoJSPlayer[videojsid]) {
                        videoJSPlayer[videojsid].dispose()
                        changeMedia(slotid)
                    }
                }
            }, duration)
        }

        videoJSPlayer[videojsid].on('error', function () {
            var error = videoJSPlayer[videojsid].error()
            console.error('[VideoJS] CCTV error:', error ? error.code + ' - ' + error.message : 'Unknown');
            if (videoJSPlayer[videojsid]) {
                videoJSPlayer[videojsid].dispose()
                changeMedia(slotid)
            }
        })
    } else if (asset.mediaType == "RTSP_STREAM") { //RTSP streaming player
        console.log('[appendMediaElement] RTSP stream detected:', sanitizeMediaUrlForLog(asset.contentUrl));

        // RTSP cannot be played directly in browsers
        // It requires server-side transcoding to HLS/WebRTC

        // Check if the URL is already transcoded (contains .m3u8)
        if (asset.contentUrl.includes('.m3u8')) {
            console.log('[appendMediaElement] RTSP URL appears to be transcoded - treating as HLS');

            // Play as HLS stream
            mediaEl[slotid] = '<video id="video-' + videojsid + '" class="video-js vjs-default-skin vjs-fill media-slot" autoplay playsinline preload="auto">'
            mediaEl[slotid] += "<source src='" + asset.contentUrl + "' type='application/x-mpegURL'>"
            mediaEl[slotid] += "</video>"
            $(previewele).html(mediaEl[slotid])

            videoJSPlayer[videojsid] = videojs('video-' + videojsid, {
                html5: {
                    vhs: {
                        withCredentials: false,
                        overrideNative: true
                    }
                },
                liveui: true
            })

            videoJSPlayer[videojsid].controls(false)

            // Handle playback duration
            if (duration == 0) {
                videoJSPlayer[videojsid].on('ended', function () {
                    if (videoJSPlayer[videojsid]) {
                        videoJSPlayer[videojsid].dispose()
                        changeMedia(slotid)
                    }
                })
            } else {
                setTimeout(function () {
                    if (videoJSPlayer[videojsid]) {
                        videoJSPlayer[videojsid].dispose()
                        changeMedia(slotid)
                    }
                }, duration)
            }

            videoJSPlayer[videojsid].on('error', function () {
                var error = videoJSPlayer[videojsid].error()
                console.error('[VideoJS] Transcoded RTSP error:', error ? error.code + ' - ' + error.message : 'Unknown');
                if (videoJSPlayer[videojsid]) {
                    videoJSPlayer[videojsid].dispose()
                    changeMedia(slotid)
                }
            })
        } else {
            // Pure RTSP - cannot be played in browser
            console.error('[appendMediaElement] ⚠ RTSP streams require server-side transcoding');

            if (window.errorNotification) {
                window.errorNotification.error(
                    'RTSP Not Supported',
                    'RTSP streams require server-side transcoding to HLS or WebRTC for browser playback',
                    5000
                );
            }

            // Show error message on screen
            mediaEl[slotid] = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #1a1a1a; color: #ff6b6b; font-size: 14px; padding: 20px; text-align: center;">';
            mediaEl[slotid] += '<div><strong>RTSP Stream Error</strong><br/>Requires server-side transcoding to HLS/WebRTC<br/><small>' + sanitizeMediaUrlForLog(asset.contentUrl) + '</small></div>';
            mediaEl[slotid] += '</div>';
            $(previewele).html(mediaEl[slotid])

            // Skip to next media after 5 seconds
            setTimeout(function () {
                changeMedia(slotid)
            }, 5000)
        }
    } else if (asset.mediaType == "RTMP_STREAM") { //RTMP streaming player
        console.log('[appendMediaElement] RTMP stream detected:', sanitizeMediaUrlForLog(asset.contentUrl));

        // RTMP requires Flash or server-side transcoding
        // Modern browsers don't support RTMP natively
        // Try using flvjs tech as fallback (if RTMP is converted to FLV on server)

        mediaEl[slotid] = '<video id="video-' + videojsid + '" class="video-js vjs-default-skin vjs-fill media-slot" autoplay playsinline preload="auto">'
        mediaEl[slotid] += "<source src='" + asset.contentUrl + "' type='video/x-flv'>"
        mediaEl[slotid] += "</video>"
        $(previewele).html(mediaEl[slotid])

        // Try using flv.js for RTMP playback
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
        }, function () {
            console.log('[VideoJS] RTMP player initialized');
        })

        videoJSPlayer[videojsid].controls(false)

        // Check if player started successfully
        var rtmpStarted = false;
        var rtmpTimeout = setTimeout(function () {
            if (!rtmpStarted) {
                console.warn('[appendMediaElement] RTMP stream failed to start - likely not supported');

                if (window.errorNotification) {
                    window.errorNotification.warning(
                        'RTMP Stream Error',
                        'RTMP streams may require server-side transcoding to HLS',
                        4000
                    );
                }

                try {
                    if (videoJSPlayer[videojsid]) {
                        videoJSPlayer[videojsid].dispose();
                    }
                } catch (e) {
                    console.warn('[VideoJS] Error disposing RTMP player:', e);
                }
                changeMedia(slotid);
            }
        }, 5000);

        videoJSPlayer[videojsid].on('playing', function () {
            rtmpStarted = true;
            clearTimeout(rtmpTimeout);
            console.log('[VideoJS] RTMP stream playing');
        });

        // Handle duration
        if (duration == 0) {
            videoJSPlayer[videojsid].on('ended', function () {
                clearTimeout(rtmpTimeout);
                if (videoJSPlayer[videojsid]) {
                    videoJSPlayer[videojsid].dispose()
                    changeMedia(slotid)
                }
            })
        } else {
            setTimeout(function () {
                clearTimeout(rtmpTimeout);
                if (videoJSPlayer[videojsid]) {
                    videoJSPlayer[videojsid].dispose()
                    changeMedia(slotid)
                }
            }, duration)
        }

        videoJSPlayer[videojsid].on('error', function () {
            clearTimeout(rtmpTimeout);
            var error = videoJSPlayer[videojsid].error()
            console.error('[VideoJS] RTMP error:', error ? error.code + ' - ' + error.message : 'Unknown');

            if (window.errorNotification) {
                window.errorNotification.error(
                    'RTMP Playback Failed',
                    'Unable to play RTMP stream - may need HLS transcoding',
                    4000
                );
            }

            if (videoJSPlayer[videojsid]) {
                videoJSPlayer[videojsid].dispose()
                changeMedia(slotid)
            }
        })
    }
}

// ========================================
// Helper: Probe remote URL and request transcode
// ========================================

// Probe remote URL with HEAD to get content-type and detect CORS issues
async function probeRemoteUrl(url) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, { method: 'HEAD', mode: 'cors', signal: controller.signal });
        clearTimeout(timeout);
        const contentType = res.headers.get('content-type') || '';
        return { ok: res.ok, status: res.status, contentType };
    } catch (error) {
        return { ok: false, status: 0, contentType: null, error: error.message || String(error) };
    }
}

// Best-effort: send request to server to request a transcode; tries a few common endpoints
async function requestServerTranscode(payload) {
    try {
        const urlCandidates = [];
        // If originalUrl has an origin, try typical endpoints on that origin
        try {
            const origin = (payload.originalUrl) ? new URL(payload.originalUrl).origin : null;
            if (origin) {
                urlCandidates.push(origin + '/api/request-transcode');
                urlCandidates.push(origin + '/api/media/request-transcode');
                urlCandidates.push(origin + '/api/media/transcode-request');
                urlCandidates.push(origin + '/api/transcode');
            }
        } catch (e) {}

        // Also try config.hostserver if available
        try {
            if (window.config && window.config.hostserver) {
                const host = window.config.hostserver.replace(/\/$/, '');
                urlCandidates.push(host + '/api/request-transcode');
                urlCandidates.push(host + '/api/media/request-transcode');
            }
        } catch (e) {}

        const tried = [];
        for (const endpoint of urlCandidates) {
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    mode: 'cors'
                });

                tried.push({ endpoint, status: res.status });

                if (res.ok) {
                    console.log('[MediaManager] Transcode request accepted by:', endpoint);
                    return { success: true, endpoint };
                }
            } catch (err) {
                tried.push({ endpoint, error: err && err.message ? err.message : String(err) });
            }
        }

        console.warn('[MediaManager] No transcode endpoint accepted request:', tried);
        throw new Error('No transcode endpoint accepted request');
    } catch (error) {
        console.warn('[MediaManager] requestServerTranscode failed:', error && error.message ? error.message : error);
        throw error;
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
        player.on('play', function () {
            console.log('=== VIDEO SYNC: Player', playerIndex, 'started playing');
            if (typeof broadcastVideoTime === 'function') {
                setTimeout(() => broadcastVideoTime(), 100);
            }
        });

        player.on('pause', function () {
            console.log('=== VIDEO SYNC: Player', playerIndex, 'paused');
            if (typeof broadcastVideoTime === 'function') {
                setTimeout(() => broadcastVideoTime(), 100);
            }
        });

        player.on('seeked', function () {
            console.log('=== VIDEO SYNC: Player', playerIndex, 'seeked');
            if (typeof broadcastVideoTime === 'function') {
                setTimeout(() => broadcastVideoTime(), 100);
            }
        });

        // Periodic sync check for smooth synchronization
        /*var syncInterval = setInterval(function() {
            if (videoJSPlayer[playerIndex]) {
                checkVideoSyncDrift(videoJSPlayer[playerIndex], playerIndex);
            } else {
                clearInterval(syncInterval);
            }
        }, 1000); // Check every second*/

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
            player.play().catch(function (error) {
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
    window.addEventListener('load', function () {
        //setTimeout(initVideoSyncSettings, 1000);
    });
}

// ========================================
// END VIDEO SYNCHRONIZATION FUNCTIONS  
// ========================================
