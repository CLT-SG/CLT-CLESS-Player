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
            console.log('MediaManager: Cached files count:', this.cachedFiles.size);
            
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
     */
    async _performDownload(mediaURL, safeFilename, filePath) {
        this.stats.totalDownloads++;
        
        // Determine extension for type handling
        const ext = (safeFilename || '').split('.').pop().toLowerCase();
        const videoExts = ['mp4','webm','mkv','mov','avi','m4v'];

        try {
            // Use Capacitor HTTP for native apps, fetch for web
            let responseData;
            
            if (window.capacitorAPI && window.capacitorAPI.isNative && window.capacitorAPI.plugins.CapacitorHttp) {
                // Native platform - use CapacitorHttp
                console.log('MediaManager: Using CapacitorHttp for native download');
                
                const response = await window.capacitorAPI.plugins.CapacitorHttp.get({
                    url: mediaURL,
                    responseType: 'blob',
                    connectTimeout: 30000,
                    readTimeout: 60000
                });
                
                if (response.status !== 200) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText || 'Download failed'}`);
                }

                // Prefer Blob for video files so we don't convert to base64
                if (videoExts.includes(ext) && response.data instanceof Blob) {
                    responseData = response.data;
                } else if (typeof response.data === 'string') {
                    // Sometimes Capacitor may return base64 string; keep as-is for non-video or convert if needed
                    responseData = response.data;
                } else if (response.data && response.data.blob) {
                    responseData = response.data.blob;
                } else {
                    responseData = response.data;
                }
                
            } else {
                // Web platform or fallback - use fetch
                console.log('MediaManager: Using fetch for download');
                
                const response = await fetch(mediaURL);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                // Get blob data
                const blob = await response.blob();

                // For video files, keep the Blob and write it directly (avoids base64 conversion)
                if (videoExts.includes(ext)) {
                    responseData = blob;
                } else {
                    responseData = await this._blobToBase64(blob);
                }
            }
            
            // Save to filesystem
            if (window.capacitorAPI && window.capacitorAPI.writeFile) {
                // Write file and capture result (some implementations return an object with uri/path)
                let writeResult = await window.capacitorAPI.writeFile(filePath, responseData);

                // If writeResult is string, normalize it
                if (typeof writeResult === 'string') {
                    writeResult = { path: writeResult };
                }

                // If native URI/path returned, record mapping for later convertFileSrc
                let nativeUri = (writeResult && (writeResult.uri || writeResult.path || writeResult.result)) ? (writeResult.uri || writeResult.path || writeResult.result) : null;
                if (nativeUri) {
                    console.log('MediaManager: writeFile returned native URI:', nativeUri);
                    this.fileUriMap.set(safeFilename, nativeUri);

                    // Try to convert to web-friendly URI right away
                    try {
                        if (window.capacitorAPI && window.capacitorAPI.convertFileSrc) {
                            const converted = window.capacitorAPI.convertFileSrc(nativeUri);
                            if (converted) {
                                this.uriCache.set(safeFilename, converted);
                                console.log('[MediaManager] Cached converted URI for:', safeFilename, converted);
                            }
                        }
                    } catch (err) {
                        console.warn('MediaManager: convertFileSrc(nativeUri) failed:', err && err.message ? err.message : err);
                    }
                } else {
                    // If writeFile did not return a native URI, attempt to call getUri(filePath) (some Capacitor platforms provide getUri)
                    try {
                        if (window.capacitorAPI && window.capacitorAPI.getUri) {
                            const uriRes = await window.capacitorAPI.getUri(filePath).catch(err => { throw err; });
                            const resolved = (uriRes && uriRes.uri) ? uriRes.uri : uriRes;
                            if (resolved) {
                                nativeUri = resolved;
                                console.log('MediaManager: getUri returned native URI:', nativeUri);
                                this.fileUriMap.set(safeFilename, nativeUri);

                                try {
                                    if (window.capacitorAPI && window.capacitorAPI.convertFileSrc) {
                                        const converted = window.capacitorAPI.convertFileSrc(nativeUri);
                                        if (converted) {
                                            this.uriCache.set(safeFilename, converted);
                                            console.log('[MediaManager] Cached converted URI (from getUri) for:', safeFilename, converted);
                                        }
                                    }
                                } catch (err) {
                                    console.warn('MediaManager: convertFileSrc(nativeUri-from-getUri) failed:', err && err.message ? err.message : err);
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('MediaManager: getUri(filePath) attempt failed:', err && err.message ? err.message : err);
                    }
                }

                // Update cache
                this.cachedFiles.add(safeFilename);
                
                console.log('MediaManager: Successfully downloaded and saved:', safeFilename);
                
                this.stats.successfulDownloads++;
                
                // Show success notification (optional)
                if (window.errorNotification && this.stats.successfulDownloads % 5 === 0) {
                    window.errorNotification.success(
                        'Media Downloaded',
                        `Successfully cached ${this.stats.successfulDownloads} media files`,
                        3000
                    );
                }
                
                return { success: true, filePath, fromCache: false };
                
            } else {
                throw new Error('Filesystem API not available');
            }
            
        } catch (error) {
            console.error('MediaManager: Download error for', mediaURL, ':', error);
            this.stats.failedDownloads++;
            
            // Show error notification
            if (window.errorNotification) {
                window.errorNotification.error(
                    'Media Download Failed',
                    `Failed to download ${safeFilename}: ${error.message}`,
                    5000
                );
            }
            
            throw error;
        }
    }

    /**
     * Convert Blob to Base64 string
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
     * This converts the filesystem path to a usable URL for img/video elements
     * OPTIMIZED: Uses in-memory cache to avoid repeated base64 conversions
     */
    async getMediaUri(filename) {
        try {
            const safeFilename = this.sanitizeFilename(filename);
            console.log('[MediaManager] getMediaUri called for:', safeFilename, 'original filename:', filename);
            
            // Check in-memory URI cache first (FAST PATH)
            if (this.uriCache.has(safeFilename)) {
                this.stats.uriCacheHits++;
                console.log('[MediaManager] URI cache hit for:', safeFilename);
                return this.uriCache.get(safeFilename);
            }
            
            const filePath = `${this.cacheDir}/${safeFilename}`;
            
            // Check if file exists
            const exists = await this.checkMediaExists(safeFilename);
            if (!exists) {
                console.warn('MediaManager: File not found in cache:', safeFilename);
                return null;
            }

            // Determine extension for handling
            const ext = safeFilename.split('.').pop().toLowerCase();
            const videoExts = ['mp4','webm','mkv','mov','avi','m4v'];

            // Prefer using Capacitor's native URI conversion for video files on device
            if (videoExts.includes(ext) && window.capacitorAPI && window.capacitorAPI.isNative) {
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
                    console.warn('MediaManager: getUri/convertFileSrc failed, will fallback to data URI:', err && err.message ? err.message : err);
                }

                // If still not resolved and convertFileSrc is available, try convertFileSrc directly
                if (!mediaUri && window.capacitorAPI && window.capacitorAPI.convertFileSrc) {
                    try {
                        mediaUri = window.capacitorAPI.convertFileSrc(filePath);
                    } catch (err) {
                        console.warn('MediaManager: convertFileSrc(filePath) failed:', err && err.message ? err.message : err);
                    }
                }

                if (mediaUri) {
                    this.uriCache.set(safeFilename, mediaUri);
                    console.log('[MediaManager] Returning native URI for video:', safeFilename, mediaUri);
                    return mediaUri;
                }

                // If conversion failed for some reason, try recorded native URI from writeFile
                const recordedNative = this.fileUriMap.get(safeFilename);
                if (recordedNative && window.capacitorAPI && window.capacitorAPI.convertFileSrc) {
                    try {
                        const converted = window.capacitorAPI.convertFileSrc(recordedNative);
                        if (converted) {
                            this.uriCache.set(safeFilename, converted);
                            console.log('[MediaManager] Returning converted recorded native URI for video:', safeFilename, converted);
                            return converted;
                        }
                    } catch (err) {
                        console.warn('MediaManager: convertFileSrc(recordedNative) failed:', err && err.message ? err.message : err);
                    }
                }

                console.warn('[MediaManager] Native file URI unavailable for video, will not convert to data URI (unsafe):', safeFilename);

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
                                        return converted;
                                    }
                                } catch (err) {
                                    console.warn('MediaManager: convertFileSrc(getUri) failed:', err && err.message ? err.message : err);
                                }
                            } else {
                                console.warn('[MediaManager] convertFileSrc not available; returning native URI directly:', nativeFromGetUri);
                                this.uriCache.set(safeFilename, nativeFromGetUri);
                                return nativeFromGetUri;
                            }
                        }
                    }
                } catch (err) {
                    console.warn('MediaManager: getUri(filePath) final attempt failed:', err && err.message ? err.message : err);
                }
            }

            // Otherwise: images or web fallback
            let mediaUri = null;
            if (window.capacitorAPI && window.capacitorAPI.isNative) {
                // For native apps, we will not convert videos to data URIs; for images only
                try {
                    mediaUri = await this._getFileAsDataUri(filePath);
                } catch (err) {
                    console.warn('MediaManager: data URI conversion failed (as expected) for:', safeFilename, err && err.message ? err.message : err);
                    // Record fallback event
                    try { this.stats.fallbackCount = (this.stats.fallbackCount || 0) + 1; } catch (e) {}
                    // Do not throw further - return null so caller can fallback to remote URL
                    return null;
                }
            } else {
                // For web, return the path directly
                mediaUri = filePath;
            }

            // Store in URI cache for fast subsequent access
            if (mediaUri) {
                this.uriCache.set(safeFilename, mediaUri);
                console.log('[MediaManager] Cached URI for:', safeFilename);
            }

            return mediaUri;
            
        } catch (error) {
            console.error('MediaManager: Error getting media URI:', error);
            return null;
        }
    }

    /**
     * Read file and convert to data URI
     */
    async _getFileAsDataUri(filePath) {
        try {
            if (!window.capacitorAPI || !window.capacitorAPI.readFile) {
                throw new Error('Filesystem API not available');
            }

            // Determine MIME type from extension
            const ext = filePath.split('.').pop().toLowerCase();
            const videoExts = ['mp4','webm','mkv','mov','avi','m4v'];

            // Safety: refuse to convert video files into data URIs because they are large and will crash playback.
            if (videoExts.includes(ext)) {
                throw new Error('Refusing to convert video file to data URI; use convertFileSrc/getUri instead');
            }

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
            console.error('MediaManager: Error reading file as data URI:', error);
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
     * @returns {Promise<string>} Media URI
     */
    async getMediaUriSmart(source, isExternal = null) {
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
            // Local file - use cached version
            const uri = await this.getMediaUri(source);
            console.log('[MediaManager] getMediaUriSmart resolved URI for', source, ':', uri);
            return uri;
        }
    }
    
    /**
     * NEW: Clear URI cache (useful when cache is cleared)
     */
    clearUriCache() {
        console.log('[MediaManager] Clearing URI cache...');
        this.uriCache.clear();
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
