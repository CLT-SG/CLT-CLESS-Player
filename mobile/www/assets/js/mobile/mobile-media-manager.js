/**
 * eCLESS Player Mobile - Media Manager
 * 
 * This module handles media file downloading, caching, and retrieval for mobile devices.
 * It replaces the Electron IPC-based media download system with Capacitor Filesystem API.
 * 
 * Features:
 * - Download media files (images, videos) from server
 * - Cache files persistently in device storage
 * - Convert local file paths to web-accessible URLs
 * - Track download progress and errors
 * - Manage media cache (check existence, clear cache, etc.)
 * 
 * MEDIA HANDLING STRATEGY (Updated):
 * 
 * IMAGES (jpg, jpeg, png, gif, webp, bmp, svg):
 * - Download as blob from server
 * - Write to filesystem using Capacitor Filesystem API
 * - Read back as base64 with encoding: 'base64'
 * - Return data URL format: data:image/{mime};base64,{base64data}
 * - Cache data URL in memory for instant access
 * - Compatible with <img> elements: <img src={dataUrl} />
 * 
 * VIDEOS (mp4, webm, mkv, mov, avi, m4v):
 * - Download as blob from server
 * - Write to filesystem as binary
 * - Get native file URI using getUri()
 * - Convert to web-accessible URI using convertFileSrc()
 * - Cache converted URI for instant playback
 * - Compatible with VideoJS and <video> elements
 * 
 * BENEFITS:
 * - Images: Base64 data URLs work reliably across all Android versions
 * - Videos: Native URIs enable efficient streaming without memory issues
 * - Prevents memory crashes with large media files
 * - All files stored in ecless/media/cache directory
 * - Persistent caching survives app restarts
 * 
 * @module mobile-media-manager
 */

console.log('=== MOBILE MEDIA MANAGER: Initializing ===');

/**
 * Mobile Media Manager Class
 */
class MobileMediaManager {
    constructor() {
        this.cacheDir = 'ecless/media/cache';
        this.downloadQueue = new Map();
        this.downloadProgress = new Map();
        this.cachedFiles = new Set();
        this.initialized = false;
        
        // NEW: In-memory URI cache for fast access (prevents repeated base64 conversions)
        this.uriCache = new Map(); // filename -> dataURI or converted URI
        this.fileUriMap = new Map(); // filename -> native file URI (from writeFile/getUri)
        this.preloadQueue = []; // Array of files to preload
        this.isPreloading = false;
        
        // Statistics
        this.stats = {
            totalDownloads: 0,
            successfulDownloads: 0,
            failedDownloads: 0,
            cacheHits: 0,
            cacheMisses: 0,
            uriCacheHits: 0,
            fallbackCount: 0
        };
    }

    /**
     * Initialize the media manager
     * Creates necessary directories and loads cache index
     */
    async initialize() {
        if (this.initialized) {
            console.log('MediaManager: Already initialized');
            return true;
        }

        try {
            console.log('MediaManager: Initializing...');
            
            // Wait for Capacitor API to be ready
            if (!window.capacitorAPI) {
                console.warn('MediaManager: Capacitor API not ready, waiting...');
                await this.waitForCapacitor();
            }

            // Create cache directory
            await this.ensureCacheDirectory();
            
            // Load cached files index
            await this.loadCacheIndex();
            
            this.initialized = true;
            console.log('MediaManager: Initialized successfully');
            console.log('MediaManager: Cache directory:', this.cacheDir);
            
            return true;
            
        } catch (error) {
            console.error('MediaManager: Initialization failed:', error);
            return false;
        }
    }

    /**
     * Wait for Capacitor API to be available
     */
    async waitForCapacitor() {
        return new Promise((resolve) => {
            if (window.capacitorAPI) {
                resolve();
                return;
            }

            const checkInterval = setInterval(() => {
                if (window.capacitorAPI) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                console.error('MediaManager: Capacitor API timeout');
                resolve(); // Resolve anyway to allow fallback
            }, 10000);
        });
    }

    /**
     * Ensure cache directory exists
     */
    async ensureCacheDirectory() {
        try {
            if (window.capacitorAPI && window.capacitorAPI.createDirectory) {
                await window.capacitorAPI.createDirectory(this.cacheDir);
                console.log('MediaManager: Cache directory created/verified');
            }
        } catch (error) {
            // Directory might already exist, which is fine
            console.log('MediaManager: Cache directory check:', error.message);
        }
    }

    /**
     * Load cache index from storage
     * Scans the cache directory to build an index of cached files
     */
    async loadCacheIndex() {
        try {
            if (!window.capacitorAPI || !window.capacitorAPI.readDirectory) {
                console.warn('MediaManager: Cannot load cache index - Capacitor API not available');
                return;
            }

            const files = await window.capacitorAPI.readDirectory(this.cacheDir);
            
            this.cachedFiles.clear();
            files.forEach(file => {
                if (file.name && !file.name.endsWith('.meta')) {
                    this.cachedFiles.add(file.name);
                }
            });
            
            console.log('MediaManager: Loaded cache index with', this.cachedFiles.size, 'files');
            
        } catch (error) {
            console.warn('MediaManager: Failed to load cache index:', error.message);
            // This is not critical - cache will be rebuilt as files are accessed
        }
    }

    /**
     * Get sanitized filename from URL or path
     */
    sanitizeFilename(url) {
        // Extract filename from URL
        let filename = url.split('/').pop();
        
        // Remove query parameters
        filename = filename.split('?')[0];
        
        // Replace unsafe characters
        filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        return filename;
    }

    /**
     * Get MIME type from file extension
     * @param {string} extension - File extension (e.g., 'jpg', 'png')
     * @returns {string} MIME type (e.g., 'image/jpeg')
     */
    getMimeTypeFromExtension(extension) {
        const ext = extension.toLowerCase();
        const mimeTypes = {
            // Images
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'bmp': 'image/bmp',
            'svg': 'image/svg+xml',
            // Videos (for reference, though not used with base64)
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'mkv': 'video/x-matroska',
            'mov': 'video/quicktime',
            'avi': 'video/x-msvideo',
            'm4v': 'video/x-m4v'
        };
        return mimeTypes[ext] || `application/octet-stream`;
    }

    /**
     * Check if media file exists in cache
     */
    async checkMediaExists(filename) {
        try {
            // Sanitize filename
            const safeFilename = this.sanitizeFilename(filename);
            
            // Check in-memory cache first
            if (this.cachedFiles.has(safeFilename)) {
                this.stats.cacheHits++;
                return true;
            }
            
            this.stats.cacheMisses++;
            
            // Check filesystem
            if (window.capacitorAPI && window.capacitorAPI.fileExists) {
                const filePath = `${this.cacheDir}/${safeFilename}`;
                const exists = await window.capacitorAPI.fileExists(filePath);
                
                if (exists) {
                    // Update in-memory cache
                    this.cachedFiles.add(safeFilename);
                    return true;
                }
            }
            
            return false;
            
        } catch (error) {
            console.warn('MediaManager: Error checking file existence:', error);
            return false;
        }
    }

    /**
     * Download media file from server
     */
    async downloadMedia(mediaURL, filename) {
        try {
            const safeFilename = this.sanitizeFilename(filename);
            const filePath = `${this.cacheDir}/${safeFilename}`;
            
            console.log('MediaManager: Downloading', mediaURL, 'to', filePath);
            
            // Check if already downloading
            if (this.downloadQueue.has(safeFilename)) {
                console.log('MediaManager: Download already in progress for', safeFilename);
                return this.downloadQueue.get(safeFilename);
            }
            
            // Check if already cached
            const exists = await this.checkMediaExists(safeFilename);
            if (exists) {
                console.log('MediaManager: File already cached:', safeFilename);
                return { success: true, filePath, fromCache: true };
            }
            
            // Create download promise
            const downloadPromise = this._performDownload(mediaURL, safeFilename, filePath);
            
            // Add to queue
            this.downloadQueue.set(safeFilename, downloadPromise);
            
            // Wait for download to complete
            const result = await downloadPromise;
            
            // Remove from queue
            this.downloadQueue.delete(safeFilename);
            
            return result;
            
        } catch (error) {
            console.error('MediaManager: Download failed:', error);
            this.stats.failedDownloads++;
            throw error;
        }
    }

    /**
     * Perform the actual download
     * IMAGES: Download -> Write to filesystem -> Read as base64 -> Return data URL
     * VIDEOS: Download -> Write to filesystem -> Return native URI (no base64)
     */
    async _performDownload(mediaURL, safeFilename, filePath) {
        this.stats.totalDownloads++;
        
        // Determine extension for type handling
        const ext = (safeFilename || '').split('.').pop().toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
        const videoExts = ['mp4','webm','mkv','mov','avi','m4v'];
        const isImage = imageExts.includes(ext);
        const isVideo = videoExts.includes(ext);
        
        // Route images to base64 handling, videos to native URI handling
        if (isImage) {
            return await this._performImageDownload(mediaURL, safeFilename, filePath, ext);
        } else {
            return await this._performVideoDownload(mediaURL, safeFilename, filePath);
        }

    }

    /**
     * Download IMAGE file and return base64 data URL
     * Flow: Download -> Write to filesystem -> Read as base64 -> Create data URL
     */
    async _performImageDownload(mediaURL, safeFilename, filePath, ext) {
        console.log('[MediaManager] Starting IMAGE download for:', safeFilename);
        
        try {
            // Step 1: Download the image as blob
            let blob;
            
            if (window.capacitorAPI && window.capacitorAPI.isNative && window.capacitorAPI.plugins.CapacitorHttp) {
                console.log('[MediaManager] Using CapacitorHttp for image download:', safeFilename);
                
                const response = await window.capacitorAPI.plugins.CapacitorHttp.get({
                    url: mediaURL,
                    responseType: 'blob',
                    connectTimeout: 30000,
                    readTimeout: 60000
                });
                
                if (response.status !== 200) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText || 'Download failed'}`);
                }
                
                blob = response.data instanceof Blob ? response.data : 
                       (response.data && response.data.blob instanceof Blob ? response.data.blob : new Blob([response.data]));
            } else {
                console.log('[MediaManager] Using fetch for image download:', safeFilename);
                const response = await fetch(mediaURL);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                blob = await response.blob();
            }
            
            // Step 1.5: Compress image if needed (NEW)
            if (window.imageCompressionManager && window.imageCompressionManager.isEnabled()) {
                const originalSize = blob.size;
                const shouldCompress = window.imageCompressionManager.shouldCompress(blob);
                
                if (shouldCompress) {
                    console.log('[MediaManager] Compressing image before caching:', safeFilename, 
                               `(${(originalSize / 1024).toFixed(2)} KB)`);
                    
                    try {
                        blob = await window.imageCompressionManager.compressImage(blob);
                        const newSize = blob.size;
                        const savedKB = ((originalSize - newSize) / 1024).toFixed(2);
                        const savedPercent = (((originalSize - newSize) / originalSize) * 100).toFixed(1);
                        
                        console.log(`[MediaManager] ✓ Image compressed: ${savedKB} KB saved (${savedPercent}%)`);
                    } catch (compressionError) {
                        console.warn('[MediaManager] Compression failed, using original:', compressionError.message);
                        // Continue with original blob
                    }
                } else {
                    console.log('[MediaManager] Image is small enough, skipping compression');
                }
            }
            
            // Step 2: Write blob to filesystem
            if (!window.capacitorAPI || !window.capacitorAPI.writeFile) {
                throw new Error('Capacitor Filesystem API not available');
            }
            
            console.log('[MediaManager] Writing image to filesystem:', safeFilename);
            const writeResult = await window.capacitorAPI.writeFile(filePath, blob);
            
            if (!writeResult || !writeResult.success) {
                throw new Error('Failed to write image to filesystem');
            }
            
            // Step 3: Read back as base64 (stored as UTF8 string to avoid double-encoding)
            console.log('[MediaManager] Reading image back as base64 string:', safeFilename);
            const readResult = await window.capacitorAPI.readFile(filePath, 'utf8');
            
            if (!readResult || !readResult.data) {
                throw new Error('Failed to read image as base64 string');
            }
            
            // Validate base64 data
            const base64Data = readResult.data;
            if (!this._validateImageBase64(base64Data, ext)) {
                console.error('[MediaManager] Base64 validation failed for:', safeFilename);
                console.error('[MediaManager] Base64 preview (first 100 chars):', base64Data.substring(0, 100));
                throw new Error('Invalid base64 data - possible corruption during write/read');
            }
            
            // Step 4: Create data URL with proper MIME type
            const mimeType = this.getMimeTypeFromExtension(ext);
            const dataUrl = `data:${mimeType};base64,${base64Data}`;
            
            // Additional validation: Check data URL format
            if (!dataUrl.startsWith('data:image/')) {
                throw new Error(`Invalid data URL format. MIME: ${mimeType}`);
            }
            
            console.log('[MediaManager] Base64 preview (first 50 chars):', base64Data.substring(0, 50));
            console.log('[MediaManager] Data URL length:', dataUrl.length, 'bytes');
            
            // Step 5: Cache the data URL for immediate access
            this.uriCache.set(safeFilename, dataUrl);
            this.cachedFiles.add(safeFilename);
            
            console.log('[MediaManager] ✓ Image successfully cached as base64:', safeFilename, '| MIME:', mimeType);
            
            this.stats.successfulDownloads++;
            
            // Show success notification
            if (window.errorNotification && this.stats.successfulDownloads % 5 === 0) {
                window.errorNotification.success(
                    'Media Cached',
                    `${this.stats.successfulDownloads} files ready for offline playback`,
                    2000
                );
            }
            
            return { success: true, filePath, fromCache: false, isBase64: true, dataUrl };
            
        } catch (error) {
            console.error('[MediaManager] Image download error for', mediaURL, ':', error);
            this.stats.failedDownloads++;
            
            if (window.errorNotification) {
                window.errorNotification.error(
                    'Image Download Failed',
                    `Failed to download ${safeFilename}: ${error.message}`,
                    5000
                );
            }
            
            throw error;
        }
    }

    /**
     * Download VIDEO file and return native URI
     * Flow: Download -> Write to filesystem -> Get native URI -> Convert to web URI
     */
    async _performVideoDownload(mediaURL, safeFilename, filePath) {
        console.log('[MediaManager] Starting VIDEO download for:', safeFilename);
        
        try {
            // Use Capacitor HTTP for native apps, fetch for web
            let blob;
            
            if (window.capacitorAPI && window.capacitorAPI.isNative && window.capacitorAPI.plugins.CapacitorHttp) {
                // Native platform - use CapacitorHttp
                console.log('[MediaManager] Using CapacitorHttp for video download:', safeFilename);
                
                const response = await window.capacitorAPI.plugins.CapacitorHttp.get({
                    url: mediaURL,
                    responseType: 'blob',
                    connectTimeout: 30000,
                    readTimeout: 60000
                });
                
                if (response.status !== 200) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText || 'Download failed'}`);
                }

                // Get blob from response
                if (response.data instanceof Blob) {
                    blob = response.data;
                } else if (response.data && response.data.blob instanceof Blob) {
                    blob = response.data.blob;
                } else {
                    // Fallback: convert to blob
                    console.warn('[MediaManager] Response data is not a Blob, attempting conversion');
                    blob = new Blob([response.data]);
                }
                
            } else {
                // Web platform or fallback - use fetch
                console.log('[MediaManager] Using fetch for video download:', safeFilename);
                
                const response = await fetch(mediaURL);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                blob = await response.blob();
            }
            
            // Write to filesystem (stores as blob/binary)
            if (window.capacitorAPI && window.capacitorAPI.writeFile) {
                console.log('[MediaManager] Saving video file:', safeFilename);
                
                // writeFile now returns {success, path, uri, directory}
                const writeResult = await window.capacitorAPI.writeFile(filePath, blob);
                
                if (!writeResult || !writeResult.success) {
                    throw new Error('writeFile returned unsuccessful result');
                }
                
                const nativeUri = writeResult.uri;
                
                if (nativeUri) {
                    console.log('[MediaManager] Native URI obtained:', nativeUri.substring(0, 50), '...');
                    this.fileUriMap.set(safeFilename, nativeUri);
                    
                    // Convert to web-accessible URI and cache
                    if (window.capacitorAPI.convertFileSrc) {
                        try {
                            const convertedUri = window.capacitorAPI.convertFileSrc(nativeUri);
                            if (convertedUri) {
                                this.uriCache.set(safeFilename, convertedUri);
                                console.log('[MediaManager] ✓ Cached web URI for:', safeFilename);
                            }
                        } catch (err) {
                            console.warn('[MediaManager] convertFileSrc failed:', err.message);
                        }
                    }
                } else {
                    console.warn('[MediaManager] No native URI returned for:', safeFilename);
                }

                // Update cache index
                this.cachedFiles.add(safeFilename);
                
                console.log('[MediaManager] ✓ Successfully downloaded and cached VIDEO:', safeFilename);
                
                this.stats.successfulDownloads++;
                
                // Show success notification (every 5 downloads)
                if (window.errorNotification && this.stats.successfulDownloads % 5 === 0) {
                    window.errorNotification.success(
                        'Media Cached',
                        `${this.stats.successfulDownloads} files ready for offline playback`,
                        2000
                    );
                }
                
                return { success: true, filePath, fromCache: false, hasWebUri: this.uriCache.has(safeFilename) };
                
            } else {
                throw new Error('Filesystem API not available');
            }
            
        } catch (error) {
            console.error('[MediaManager] Video download error for', mediaURL, ':', error);
            this.stats.failedDownloads++;
            
            // Show error notification
            if (window.errorNotification) {
                window.errorNotification.error(
                    'Video Download Failed',
                    `Failed to download ${safeFilename}: ${error.message}`,
                    5000
                );
            }
            
            throw error;
        }
    }

    /**
     * Convert Blob to Base64 string
     * @deprecated This method is kept for backward compatibility but is no longer used.
     * All media (images + videos) now use direct blob storage without base64 conversion.
     */
    _blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // Remove data URL prefix (e.g., "data:image/png;base64,")
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Get local file path for a media file
     */
    getLocalMediaPath(filename) {
        const safeFilename = this.sanitizeFilename(filename);
        return `${this.cacheDir}/${safeFilename}`;
    }

    /**
     * Get web-accessible URI for a cached media file
     * IMAGES: Returns base64 data URL (data:image/jpeg;base64,...)
     * VIDEOS: Returns native URI converted for web access
     * OPTIMIZED: Uses in-memory cache to avoid repeated file reads
     * FALLBACK: Returns object with both cached URI and original server URL for redundancy
     */
    async getMediaUri(filename, originalServerUrl = null) {
        try {
            const safeFilename = this.sanitizeFilename(filename);
            console.log('[MediaManager] getMediaUri called for:', safeFilename, 'original filename:', filename, 'with originalUrl:', originalServerUrl ? 'provided' : 'none');
            
            // Check in-memory URI cache first (FAST PATH)
            if (this.uriCache.has(safeFilename)) {
                this.stats.uriCacheHits++;
                console.log('[MediaManager] URI cache hit for:', safeFilename);
                const cachedUri = this.uriCache.get(safeFilename);
                
                // Return object with fallback support if originalUrl provided
                if (originalServerUrl) {
                    return {
                        uri: cachedUri,
                        fallbackUri: originalServerUrl,
                        isCached: true
                    };
                }
                return cachedUri;
            }
            
            const filePath = `${this.cacheDir}/${safeFilename}`;
            
            // Check if file exists
            const exists = await this.checkMediaExists(safeFilename);
            if (!exists) {
                console.warn('MediaManager: File not found in cache:', safeFilename);
                
                // If originalServerUrl provided, return it as fallback
                if (originalServerUrl) {
                    console.log('[MediaManager] Cache miss - returning server URL as fallback:', originalServerUrl);
                    return {
                        uri: null,
                        fallbackUri: originalServerUrl,
                        isCached: false,
                        useFallback: true
                    };
                }
                return null;
            }

            // Determine extension for handling
            const ext = safeFilename.split('.').pop().toLowerCase();
            const videoExts = ['mp4','webm','mkv','mov','avi','m4v'];
            const imageExts = ['jpg','jpeg','png','gif','webp','bmp','svg'];
            const isVideo = videoExts.includes(ext);
            const isImage = imageExts.includes(ext);

            // NEW FLOW: Images use base64 data URLs, Videos use native URIs
            if (isImage && window.capacitorAPI && window.capacitorAPI.readFile) {
                // IMAGE HANDLING: Read as base64 and return data URL
                console.log('[MediaManager] Loading IMAGE as base64:', safeFilename);
                
                try {
                    const readResult = await window.capacitorAPI.readFile(filePath, 'utf8');
                    
                    if (!readResult || !readResult.data) {
                        throw new Error('Failed to read image as base64');
                    }
                    
                    // Build data URL with correct MIME type
                    const mimeType = this.getMimeTypeFromExtension(ext);
                    const dataUrl = `data:${mimeType};base64,${readResult.data}`;
                    
                    // Cache for future access
                    this.uriCache.set(safeFilename, dataUrl);
                    
                    console.log(`[MediaManager] Returning base64 data URL for image:`, safeFilename, '| MIME:', mimeType);
                    
                    // Return object with fallback support if originalUrl provided
                    if (originalServerUrl) {
                        return {
                            uri: dataUrl,
                            fallbackUri: originalServerUrl,
                            isCached: true,
                            isBase64: true
                        };
                    }
                    return dataUrl;
                    
                } catch (error) {
                    console.error('[MediaManager] Failed to read image as base64:', safeFilename, error);
                    
                    // Fallback to server URL if available
                    if (originalServerUrl) {
                        return {
                            uri: null,
                            fallbackUri: originalServerUrl,
                            isCached: false,
                            useFallback: true,
                            error: error.message
                        };
                    }
                    return null;
                }
            }

            // VIDEO HANDLING: Use native URI for web access
            if (isVideo && window.capacitorAPI && window.capacitorAPI.isNative) {
                let mediaUri = null;

                try {
                    if (window.capacitorAPI.getUri) {
                        // Some Capacitor wrappers provide getUri(filePath) -> { uri: '...' } or string
                        const uriResult = await window.capacitorAPI.getUri(filePath).catch(err => { throw err; });
                        const nativeUri = (uriResult && uriResult.uri) ? uriResult.uri : uriResult;
                        if (nativeUri) {
                            if (window.capacitorAPI.convertFileSrc) {
                                mediaUri = window.capacitorAPI.convertFileSrc(nativeUri);
                            } else {
                                mediaUri = nativeUri;
                            }
                        }
                    }
                } catch (err) {
                    console.warn('[MediaManager] getUri/convertFileSrc failed, will try alternative methods:', err && err.message ? err.message : err);
                }

                // If still not resolved and convertFileSrc is available, try convertFileSrc directly
                if (!mediaUri && window.capacitorAPI && window.capacitorAPI.convertFileSrc) {
                    try {
                        mediaUri = window.capacitorAPI.convertFileSrc(filePath);
                    } catch (err) {
                        console.warn('[MediaManager] convertFileSrc(filePath) failed:', err && err.message ? err.message : err);
                    }
                }

                if (mediaUri) {
                    this.uriCache.set(safeFilename, mediaUri);
                    console.log(`[MediaManager] \u2713 Returning native URI for video:`, safeFilename);
                    
                    // Return object with fallback support if originalUrl provided
                    if (originalServerUrl) {
                        return {
                            uri: mediaUri,
                            fallbackUri: originalServerUrl,
                            isCached: true
                        };
                    }
                    return mediaUri;
                }

                // If conversion failed for some reason, try recorded native URI from writeFile
                const recordedNative = this.fileUriMap.get(safeFilename);
                if (recordedNative && window.capacitorAPI && window.capacitorAPI.convertFileSrc) {
                    try {
                        const converted = window.capacitorAPI.convertFileSrc(recordedNative);
                        if (converted) {
                            this.uriCache.set(safeFilename, converted);
                            console.log(`[MediaManager] Returning converted recorded native URI for ${isVideo ? 'video' : 'image'}:`, safeFilename, converted);
                            
                            // Return object with fallback support if originalUrl provided
                            if (originalServerUrl) {
                                return {
                                    uri: converted,
                                    fallbackUri: originalServerUrl,
                                    isCached: true
                                };
                            }
                            return converted;
                        }
                    } catch (err) {
                        console.warn('[MediaManager] convertFileSrc(recordedNative) failed:', err && err.message ? err.message : err);
                    }
                }

                console.warn('[MediaManager] Native file URI unavailable for media, will not convert to data URI:', safeFilename);

                // Diagnostic dump to aid debugging playback issues
                try {
                    console.log('[MediaManager] fileUriMap keys:', Array.from(this.fileUriMap.keys()));
                    console.log('[MediaManager] uriCache keys:', Array.from(this.uriCache.keys()));
                    console.log('[MediaManager] fileUriMap snapshot:', this.getFileUriMap());
                    console.log('[MediaManager] uriCache snapshot:', this.getUriCache());
                } catch (e) {
                    console.warn('[MediaManager] Diagnostics dump failed:', e);
                }

                // Final attempt: call getUri(filePath) to obtain platform-specific URI and convert it
                try {
                    if (window.capacitorAPI && window.capacitorAPI.getUri) {
                        const uriRes = await window.capacitorAPI.getUri(filePath).catch(err => { throw err; });
                        const nativeFromGetUri = (uriRes && uriRes.uri) ? uriRes.uri : uriRes;
                        if (nativeFromGetUri) {
                            console.log('[MediaManager] getUri(filePath) returned:', nativeFromGetUri);
                            this.fileUriMap.set(safeFilename, nativeFromGetUri);
                            if (window.capacitorAPI && window.capacitorAPI.convertFileSrc) {
                                try {
                                    const converted = window.capacitorAPI.convertFileSrc(nativeFromGetUri);
                                    if (converted) {
                                        this.uriCache.set(safeFilename, converted);
                                        console.log('[MediaManager] Cached converted URI from getUri for:', safeFilename, converted);
                                        
                                        // Return object with fallback support if originalUrl provided
                                        if (originalServerUrl) {
                                            return {
                                                uri: converted,
                                                fallbackUri: originalServerUrl,
                                                isCached: true
                                            };
                                        }
                                        return converted;
                                    }
                                } catch (err) {
                                    console.warn('[MediaManager] convertFileSrc(getUri) failed:', err && err.message ? err.message : err);
                                }
                            } else {
                                console.warn('[MediaManager] convertFileSrc not available; returning native URI directly:', nativeFromGetUri);
                                this.uriCache.set(safeFilename, nativeFromGetUri);
                                
                                // Return object with fallback support if originalUrl provided
                                if (originalServerUrl) {
                                    return {
                                        uri: nativeFromGetUri,
                                        fallbackUri: originalServerUrl,
                                        isCached: true
                                    };
                                }
                                return nativeFromGetUri;
                            }
                        }
                    }
                } catch (err) {
                    console.warn('[MediaManager] getUri(filePath) final attempt failed:', err && err.message ? err.message : err);
                }
                
                // Record fallback event
                this.stats.fallbackCount = (this.stats.fallbackCount || 0) + 1;
                console.warn('[MediaManager] All native URI methods exhausted for:', safeFilename);
                
                // If originalServerUrl provided, return it as fallback
                if (originalServerUrl) {
                    console.log('[MediaManager] Native URI failed - returning server URL as fallback:', originalServerUrl);
                    return {
                        uri: null,
                        fallbackUri: originalServerUrl,
                        isCached: false,
                        useFallback: true
                    };
                }
                return null;
            }

            // For web platform, return the path directly
            let mediaUri = filePath;

            // Store in URI cache for fast subsequent access
            if (mediaUri) {
                this.uriCache.set(safeFilename, mediaUri);
                console.log('[MediaManager] Cached URI for:', safeFilename);
                
                // Return object with fallback support if originalUrl provided
                if (originalServerUrl) {
                    return {
                        uri: mediaUri,
                        fallbackUri: originalServerUrl,
                        isCached: true
                    };
                }
            }

            return mediaUri;
            
        } catch (error) {
            console.error('[MediaManager] Error getting media URI:', error);
            return null;
        }
    }

    /**
     * Read file and convert to data URI
     * @deprecated This method should NOT be used for most cases. Native URIs are preferred.
     * WARNING: Converting large images (5MB+) to data URIs can cause memory crashes.
     * Only use for small images when native URIs are unavailable.
     */
    async _getFileAsDataUri(filePath) {
        try {
            if (!window.capacitorAPI || !window.capacitorAPI.readFile) {
                throw new Error('Filesystem API not available');
            }

            // Determine MIME type from extension
            const ext = filePath.split('.').pop().toLowerCase();
            const videoExts = ['mp4','webm','mkv','mov','avi','m4v'];

            // Safety: refuse to convert video files into data URIs because they are large and will crash playback
            if (videoExts.includes(ext)) {
                throw new Error('Refusing to convert video file to data URI; use convertFileSrc/getUri instead');
            }
            
            // Safety: warn about potential memory issues with large images
            console.warn('[MediaManager] Converting file to data URI (not recommended for large files):', filePath);

            const data = await window.capacitorAPI.readFile(filePath);

            const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'bmp': 'image/bmp',
                'webp': 'image/webp'
            };
            
            const mimeType = mimeTypes[ext] || 'application/octet-stream';

            // Return as data URI
            return `data:${mimeType};base64,${data}`;
            
        } catch (error) {
            console.error('[MediaManager] Error reading file as data URI:', error);
            throw error;
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            ...this.stats,
            cachedFilesCount: this.cachedFiles.size,
            activeDownloads: this.downloadQueue.size
        };
    }

    /**
     * Get list of all cached files
     */
    async getCachedFiles() {
        try {
            if (!window.capacitorAPI || !window.capacitorAPI.readDirectory) {
                return Array.from(this.cachedFiles);
            }
            
            const files = await window.capacitorAPI.readDirectory(this.cacheDir);
            
            return files.map(file => ({
                name: file.name,
                size: file.size || 0,
                type: file.type || 'file',
                mtime: file.mtime || null
            }));
            
        } catch (error) {
            console.error('MediaManager: Error getting cached files:', error);
            return [];
        }
    }

    /**
     * Clear all cached media files
     */
    async clearCache() {
        try {
            console.log('MediaManager: Clearing cache...');
            
            if (!window.capacitorAPI || !window.capacitorAPI.readDirectory || !window.capacitorAPI.deleteFile) {
                console.warn('MediaManager: Filesystem API not available for cache clearing');
                return false;
            }
            
            const files = await window.capacitorAPI.readDirectory(this.cacheDir);
            
            let deletedCount = 0;
            for (const file of files) {
                try {
                    const filePath = `${this.cacheDir}/${file.name}`;
                    await window.capacitorAPI.deleteFile(filePath);
                    deletedCount++;
                } catch (error) {
                    console.warn('MediaManager: Failed to delete file:', file.name, error);
                }
            }
            
            // Clear in-memory caches
            this.cachedFiles.clear();
            this.clearUriCache();
            
            console.log('MediaManager: Cleared', deletedCount, 'files from cache');
            
            return true;
            
        } catch (error) {
            console.error('MediaManager: Error clearing cache:', error);
            return false;
        }
    }

    /**
     * Delete specific file from cache
     */
    async deleteFile(filename) {
        try {
            const safeFilename = this.sanitizeFilename(filename);
            const filePath = `${this.cacheDir}/${safeFilename}`;
            
            if (window.capacitorAPI && window.capacitorAPI.deleteFile) {
                await window.capacitorAPI.deleteFile(filePath);
                this.cachedFiles.delete(safeFilename);
                console.log('MediaManager: Deleted file:', safeFilename);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('MediaManager: Error deleting file:', error);
            return false;
        }
    }

    /**
     * Get cache size in bytes
     */
    async getCacheSize() {
        try {
            const files = await this.getCachedFiles();
            return files.reduce((total, file) => total + (file.size || 0), 0);
        } catch (error) {
            console.error('MediaManager: Error calculating cache size:', error);
            return 0;
        }
    }
    
    /**
     * NEW: Preload multiple media files in parallel
     * @param {Array} mediaList - Array of {url, filename} objects
     * @returns {Promise} Resolves when all preloading is complete
     */
    async preloadMediaBatch(mediaList) {
        if (!mediaList || mediaList.length === 0) {
            return { success: true, loaded: 0, failed: 0 };
        }
        
        console.log('[MediaManager] Starting batch preload for', mediaList.length, 'files');
        
        const results = {
            success: true,
            loaded: 0,
            failed: 0,
            details: []
        };
        
        // Process downloads in parallel (limit concurrency to 5)
        const BATCH_SIZE = 5;
        for (let i = 0; i < mediaList.length; i += BATCH_SIZE) {
            const batch = mediaList.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (item) => {
                try {
                    // Check if already cached
                    const exists = await this.checkMediaExists(item.filename);
                    if (exists) {
                        // Preload URI into memory cache
                        await this.getMediaUri(item.filename);
                        try {
                            console.log('[MediaManager] Preload cached for', item.filename);
                        } catch (e) {/* ignore */}
                        results.loaded++;
                        results.details.push({ filename: item.filename, status: 'cached' });
                        return true;
                    }
                    
                    // Download if not cached
                    await this.downloadMedia(item.url, item.filename);
                    
                    // Preload URI into memory cache
                    await this.getMediaUri(item.filename);
                    try {
                        console.log('[MediaManager] Preload downloaded for', item.filename);
                    } catch (e) {/* ignore */}
                    results.loaded++;
                    results.details.push({ filename: item.filename, status: 'downloaded' });
                    return true;
                    
                } catch (error) {
                    console.error('[MediaManager] Preload failed for', item.filename, ':', error);
                    results.failed++;
                    results.details.push({ filename: item.filename, status: 'failed', error: error.message });
                    return false;
                }
            });
            
            await Promise.all(batchPromises);
        }
        
        console.log('[MediaManager] Batch preload complete:', results);
        return results;
    }
    
    /**
     * NEW: Check if a URL is an external URL (http/https)
     * @param {string} url - URL to check
     * @returns {boolean} True if external URL
     */
    isExternalUrl(url) {
        return url && (url.startsWith('http://') || url.startsWith('https://'));
    }
    
    /**
     * NEW: Get media URI with support for external URLs
     * @param {string} source - Can be a filename or external URL
     * @param {boolean} isExternal - Whether this is an external URL
     * @param {string} originalUrl - Original server URL for fallback
     * @returns {Promise<string|Object>} Media URI (string for simple case, object with fallback for complex)
     */
    async getMediaUriSmart(source, isExternal = null, originalUrl = null) {
        console.log('[MediaManager] getMediaUriSmart called with source:', source, 'isExternal:', isExternal);
        // Auto-detect if not specified
        if (isExternal === null) {
            isExternal = this.isExternalUrl(source);
        }
        
        if (isExternal) {
            // External URLs can be used directly
            console.log('[MediaManager] Using external URL:', source);
            return source;
        } else {
            // Local file - use cached version with fallback support
            const result = await this.getMediaUri(source, originalUrl);
            return result;
        }
    }
    
    /**
     * NEW: Clear URI cache (useful when cache is cleared)
     */
    clearUriCache() {
        console.log('[MediaManager] Clearing URI cache...');
        this.uriCache.clear();
    }
    
    /**
     * Validate base64 image data by checking file format headers
     * @private
     * @param {string} base64 - Base64 encoded image data
     * @param {string} ext - File extension (jpg, png, etc.)
     * @returns {boolean} True if base64 appears valid for the image type
     */
    _validateImageBase64(base64, ext) {
        if (!base64 || typeof base64 !== 'string' || base64.length < 10) {
            return false;
        }
        
        // Check for valid base64 characters
        const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Pattern.test(base64)) {
            console.error('[MediaManager] Invalid base64 characters detected');
            return false;
        }
        
        // Validate file format by checking magic bytes (decoded first few bytes)
        const firstBytes = base64.substring(0, 24); // First ~18 bytes when decoded
        
        try {
            // Decode first bytes to check file signature
            const decoded = atob(firstBytes);
            const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
            
            // PNG: starts with [137, 80, 78, 71] = 0x89504E47 = "‰PNG"
            if ((ext === 'png') && bytes.length >= 4) {
                if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
                    console.log('[MediaManager] ✓ Valid PNG header detected');
                    return true;
                } else {
                    console.error('[MediaManager] ✗ Invalid PNG header. Expected: 89504E47, Got:', 
                        Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(''));
                    return false;
                }
            }
            
            // JPEG: starts with [255, 216, 255] = 0xFFD8FF
            if ((ext === 'jpg' || ext === 'jpeg') && bytes.length >= 3) {
                if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
                    console.log('[MediaManager] ✓ Valid JPEG header detected');
                    return true;
                } else {
                    console.error('[MediaManager] ✗ Invalid JPEG header. Expected: FFD8FF, Got:', 
                        Array.from(bytes.slice(0, 3)).map(b => b.toString(16).padStart(2, '0')).join(''));
                    return false;
                }
            }
            
            // GIF: starts with "GIF87a" or "GIF89a"
            if ((ext === 'gif') && bytes.length >= 6) {
                const gifHeader = String.fromCharCode(...bytes.slice(0, 6));
                if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
                    console.log('[MediaManager] ✓ Valid GIF header detected');
                    return true;
                } else {
                    console.error('[MediaManager] ✗ Invalid GIF header. Got:', gifHeader);
                    return false;
                }
            }
            
            // WEBP: starts with "RIFF" at byte 0 and "WEBP" at byte 8
            if ((ext === 'webp') && bytes.length >= 12) {
                const riff = String.fromCharCode(...bytes.slice(0, 4));
                const webp = String.fromCharCode(...bytes.slice(8, 12));
                if (riff === 'RIFF' && webp === 'WEBP') {
                    console.log('[MediaManager] ✓ Valid WEBP header detected');
                    return true;
                } else {
                    console.error('[MediaManager] ✗ Invalid WEBP header');
                    return false;
                }
            }
            
            // For other formats, just verify base64 is valid
            console.log('[MediaManager] ⚠ Skipping header validation for extension:', ext);
            return true;
            
        } catch (error) {
            console.error('[MediaManager] Error validating base64 header:', error.message);
            return false;
        }
    }

    // DEBUG helper: return a plain object of recorded native URIs from writeFile
    getFileUriMap() {
        const obj = {};
        try {
            for (const [k, v] of this.fileUriMap.entries()) {
                obj[k] = v;
            }
        } catch (e) {
            // ignore
        }
        return obj;
    }

    // DEBUG helper: return uriCache entries (may include converted URIs or data URIs)
    getUriCache() {
        const obj = {};
        try {
            for (const [k, v] of this.uriCache.entries()) {
                obj[k] = v;
            }
        } catch (e) {}
        return obj;
    }

    // DEBUG helper: attempt to convert recorded native uri for a filename using convertFileSrc
    async convertRecordedUri(filename) {
        try {
            const safeFilename = this.sanitizeFilename(filename);
            const recorded = this.fileUriMap.get(safeFilename);
            if (!recorded) {
                return { success: false, message: 'No recorded native URI for ' + safeFilename };
            }
            if (!window.capacitorAPI || !window.capacitorAPI.convertFileSrc) {
                return { success: false, message: 'convertFileSrc not available on this platform' };
            }
            const converted = window.capacitorAPI.convertFileSrc(recorded);
            if (converted) {
                this.uriCache.set(safeFilename, converted);
                return { success: true, converted };
            }
            return { success: false, message: 'convertFileSrc returned falsy value' };
        } catch (error) {
            return { success: false, message: error && error.message ? error.message : String(error) };
        }
    }

    // DEBUG helper: try to resolve a playable URI for a filename (smart resolver)
    async debugResolveUri(filename) {
        try {
            const safeFilename = this.sanitizeFilename(filename);
            // try getMediaUriSmart first
            const uri = await this.getMediaUriSmart(filename, false);
            if (uri) return { success: true, uri, source: 'smart' };

            // try converting recorded native uri
            const recorded = this.fileUriMap.get(safeFilename);
            if (recorded && window.capacitorAPI && window.capacitorAPI.convertFileSrc) {
                try {
                    const converted = window.capacitorAPI.convertFileSrc(recorded);
                    if (converted) return { success: true, uri: converted, source: 'converted-recorded' };
                } catch (e) {}
            }

            return { success: false, message: 'No playable URI resolved' };
        } catch (e) {
            return { success: false, message: e && e.message ? e.message : String(e) };
        }
    }
    
    /**
     * NEW: Force refresh URI for a specific file (useful after import/replacement)
     * IMAGES: Re-read as base64 and create new data URL
     * VIDEOS: Regenerate native URI
     * @param {string} filename - Filename to refresh
     * @returns {Promise<string|null>} Refreshed web URI or null
     */
    async refreshMediaUri(filename) {
        const safeFilename = this.sanitizeFilename(filename);
        const filePath = this.getLocalMediaPath(safeFilename);
        
        console.log(`[MediaManager] Refreshing URI for: ${safeFilename}`);
        
        // Clear existing cache entries
        this.uriCache.delete(safeFilename);
        this.fileUriMap.delete(safeFilename);
        
        // Determine if image or video
        const ext = safeFilename.split('.').pop().toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
        const isImage = imageExts.includes(ext);
        
        // Try to regenerate URI based on type
        try {
            if (isImage && window.capacitorAPI && window.capacitorAPI.readFile) {
                // IMAGE: Read as base64 and create data URL
                console.log(`[MediaManager] Refreshing IMAGE URI: ${safeFilename}`);
                const readResult = await window.capacitorAPI.readFile(filePath, 'utf8');
                
                if (readResult && readResult.data) {
                    const mimeType = this.getMimeTypeFromExtension(ext);
                    const dataUrl = `data:${mimeType};base64,${readResult.data}`;
                    this.uriCache.set(safeFilename, dataUrl);
                    console.log(`[MediaManager] ✓ Refreshed image data URL for: ${safeFilename}`);
                    return dataUrl;
                }
            } else if (window.capacitorAPI && window.capacitorAPI.getUri) {
                // VIDEO: Regenerate native URI
                console.log(`[MediaManager] Refreshing VIDEO URI: ${safeFilename}`);
                const uriRes = await window.capacitorAPI.getUri(filePath);
                const nativeUri = (uriRes && uriRes.uri) ? uriRes.uri : uriRes;
                
                if (nativeUri) {
                    this.fileUriMap.set(safeFilename, nativeUri);
                    
                    // Convert to web URI
                    if (window.capacitorAPI.convertFileSrc) {
                        const webUri = window.capacitorAPI.convertFileSrc(nativeUri);
                        if (webUri) {
                            this.uriCache.set(safeFilename, webUri);
                            console.log(`[MediaManager] ✓ Refreshed video web URI for: ${safeFilename}`);
                            return webUri;
                        }
                    }
                }
            }
        } catch (error) {
            console.warn(`[MediaManager] Failed to refresh URI for ${safeFilename}:`, error);
        }
        
        return null;
    }
    
    /**
     * NEW: Validate if a URI is accessible (basic check)
     * @param {string} uri - URI to validate
     * @param {string} type - Media type ('image' or 'video')
     * @returns {Promise<boolean>} True if URI appears valid
     */
    async validateUri(uri, type = 'image') {
        if (!uri || typeof uri !== 'string') {
            console.warn('[MediaManager] validateUri: Invalid URI provided');
            return false;
        }
        
        console.log(`[MediaManager] Validating URI for ${type}:`, uri.substring(0, 100) + '...');
        
        return new Promise((resolve) => {
            try {
                if (type === 'image') {
                    const img = new Image();
                    const timeout = setTimeout(() => {
                        img.onload = null;
                        img.onerror = null;
                        console.warn('[MediaManager] URI validation timeout:', uri.substring(0, 50));
                        resolve(false);
                    }, 3000);
                    
                    img.onload = () => {
                        clearTimeout(timeout);
                        console.log('[MediaManager] ✓ URI validated successfully (image)');
                        resolve(true);
                    };
                    
                    img.onerror = () => {
                        clearTimeout(timeout);
                        console.warn('[MediaManager] URI validation failed (image)');
                        resolve(false);
                    };
                    
                    img.src = uri;
                } else if (type === 'video') {
                    const video = document.createElement('video');
                    const timeout = setTimeout(() => {
                        video.onloadeddata = null;
                        video.onerror = null;
                        console.warn('[MediaManager] URI validation timeout:', uri.substring(0, 50));
                        resolve(false);
                    }, 5000);
                    
                    video.onloadeddata = () => {
                        clearTimeout(timeout);
                        console.log('[MediaManager] ✓ URI validated successfully (video)');
                        resolve(true);
                    };
                    
                    video.onerror = () => {
                        clearTimeout(timeout);
                        console.warn('[MediaManager] URI validation failed (video)');
                        resolve(false);
                    };
                    
                    video.src = uri;
                    video.load();
                } else {
                    console.warn('[MediaManager] Unknown media type for validation:', type);
                    resolve(false);
                }
            } catch (error) {
                console.error('[MediaManager] URI validation error:', error);
                resolve(false);
            }
        });
    }
    
    /**
     * NEW: Log detailed diagnostics for media loading issues
     * @param {string} filename - Filename being diagnosed
     * @param {string} operation - Operation being performed
     * @param {Object} context - Additional context information
     */
    logMediaDiagnostics(filename, operation, context = {}) {
        const safeFilename = this.sanitizeFilename(filename);
        const diagnostics = {
            timestamp: new Date().toISOString(),
            operation: operation,
            filename: filename,
            safeFilename: safeFilename,
            fileInCache: this.cachedFiles.has(safeFilename),
            hasUriCache: this.uriCache.has(safeFilename),
            hasNativeUri: this.fileUriMap.has(safeFilename),
            stats: this.stats,
            context: context
        };
        
        if (this.uriCache.has(safeFilename)) {
            const uri = this.uriCache.get(safeFilename);
            diagnostics.cachedUri = uri ? uri.substring(0, 100) + '...' : null;
        }
        
        if (this.fileUriMap.has(safeFilename)) {
            const nativeUri = this.fileUriMap.get(safeFilename);
            diagnostics.nativeUri = nativeUri ? nativeUri.substring(0, 100) + '...' : null;
        }
        
        console.group(`[MediaManager] 📊 Diagnostics: ${operation}`);
        console.table(diagnostics);
        console.groupEnd();
        
        return diagnostics;
    }
}

// Create global instance
window.mediaManager = new MobileMediaManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('MediaManager: Auto-initializing on DOMContentLoaded');
        window.mediaManager.initialize().catch(error => {
            console.error('MediaManager: Auto-initialization failed:', error);
        });
    });
} else {
    // DOM already loaded
    console.log('MediaManager: Auto-initializing immediately');
    setTimeout(() => {
        window.mediaManager.initialize().catch(error => {
            console.error('MediaManager: Auto-initialization failed:', error);
        });
    }, 500);
}

console.log('=== MOBILE MEDIA MANAGER: Module loaded ===');
