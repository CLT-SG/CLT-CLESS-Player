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
        this.uriCache = new Map(); // filename -> dataURI
        this.preloadQueue = []; // Array of files to preload
        this.isPreloading = false;
        
        // Statistics
        this.stats = {
            totalDownloads: 0,
            successfulDownloads: 0,
            failedDownloads: 0,
            cacheHits: 0,
            cacheMisses: 0,
            uriCacheHits: 0
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
                
                responseData = response.data;
                
            } else {
                // Web platform or fallback - use fetch
                console.log('MediaManager: Using fetch for download');
                
                const response = await fetch(mediaURL);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                // Get blob data
                const blob = await response.blob();
                responseData = await this._blobToBase64(blob);
            }
            
            // Save to filesystem
            if (window.capacitorAPI && window.capacitorAPI.writeFile) {
                await window.capacitorAPI.writeFile(filePath, responseData);
                
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
            
            // Get URI from Capacitor
            let mediaUri;
            if (window.capacitorAPI && window.capacitorAPI.isNative) {
                // For native apps, we need to read the file and convert to data URI
                // because Capacitor filesystem URIs may not work in video/img elements
                mediaUri = await this._getFileAsDataUri(filePath);
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
            
            const data = await window.capacitorAPI.readFile(filePath);
            
            // Determine MIME type from extension
            const ext = filePath.split('.').pop().toLowerCase();
            const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'bmp': 'image/bmp',
                'webp': 'image/webp',
                'mp4': 'video/mp4',
                'webm': 'video/webm',
                'mkv': 'video/x-matroska'
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
                        results.loaded++;
                        results.details.push({ filename: item.filename, status: 'cached' });
                        return true;
                    }
                    
                    // Download if not cached
                    await this.downloadMedia(item.url, item.filename);
                    
                    // Preload URI into memory cache
                    await this.getMediaUri(item.filename);
                    
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
            return await this.getMediaUri(source);
        }
    }
    
    /**
     * NEW: Clear URI cache (useful when cache is cleared)
     */
    clearUriCache() {
        console.log('[MediaManager] Clearing URI cache...');
        this.uriCache.clear();
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
