/**
 * eCLESS Player Mobile - Media Import Manager
 * 
 * This module handles importing media files (images and videos) from device storage
 * to the app's media cache directory. It provides functionality to:
 * - Select media files using HTML5 file picker
 * - Copy files to ecless/media/cache/ directory (shared with MediaManager)
 * - Replace existing files if they exist
 * - Provide import progress feedback
 * - Notify MediaManager to reload cache index after successful imports
 * 
 * OPTIMIZATION (Updated):
 * - ALL media types (images + videos): Direct blob storage without base64 conversion
 * - Prevents memory crashes with large images (5MB+)
 * - Native file URI generation using convertFileSrc for instant playback
 * - Automatic URI caching in MediaManager for immediate access
 * - Proper cache invalidation when replacing existing files
 * - All files stored in ecless/media/cache directory
 * 
 * @module mobile-media-import
 */

console.log('=== MOBILE MEDIA IMPORT MANAGER: Initializing ===');

/**
 * Mobile Media Import Manager Class
 */
class MobileMediaImportManager {
    constructor() {
        // IMPORTANT: Use the same cache directory as MobileMediaManager
        this.mediaDir = 'ecless/media/cache';
        this.allowedTypes = {
            image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
            video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo']
        };
        this.maxFileSize = 500 * 1024 * 1024; // 500MB max file size
        this.importQueue = [];
        this.isImporting = false;
        this.initialized = false;
        
        // NEW: Chunk manager reference for large files
        this.chunkManager = null;
        this.useChunking = true; // Enable chunking by default
        
        // Statistics
        this.stats = {
            totalImports: 0,
            successfulImports: 0,
            failedImports: 0,
            replacedFiles: 0,
            chunkedImports: 0,
            directImports: 0
        };
    }

    /**
     * Initialize the media import manager
     */
    async initialize() {
        if (this.initialized) {
            console.log('MediaImportManager: Already initialized');
            return true;
        }

        try {
            console.log('MediaImportManager: Initializing...');
            
            // Wait for Capacitor API to be ready
            if (!window.capacitorAPI) {
                console.warn('MediaImportManager: Capacitor API not ready, waiting...');
                await this.waitForCapacitor();
            }

            // Ensure media directory exists
            await this.ensureMediaDirectory();
            
            // Initialize chunk manager for large file imports
            if (this.useChunking && window.chunkManager) {
                this.chunkManager = window.chunkManager;
                console.log('MediaImportManager: Chunk manager available for large file imports');
            } else {
                console.warn('MediaImportManager: Chunk manager not available, large imports may cause issues');
            }
            
            this.initialized = true;
            console.log('MediaImportManager: Initialized successfully');
            console.log('MediaImportManager: Cache directory:', this.mediaDir);
            console.log('MediaImportManager: Chunking enabled:', this.useChunking);
            
            return true;
            
        } catch (error) {
            console.error('MediaImportManager: Initialization failed:', error);
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
                console.error('MediaImportManager: Capacitor API timeout');
                resolve(); // Resolve anyway to allow fallback
            }, 10000);
        });
    }

    /**
     * Ensure media cache directory exists (shared with MediaManager)
     */
    async ensureMediaDirectory() {
        try {
            if (window.capacitorAPI && window.capacitorAPI.createDirectory) {
                // Create cache directory in Data directory (same as MediaManager)
                await window.capacitorAPI.createDirectory(this.mediaDir);
                console.log('MediaImportManager: Cache directory created/verified:', this.mediaDir);
            }
        } catch (error) {
            // Directory might already exist, which is fine
            console.log('MediaImportManager: Cache directory check:', error.message);
        }
    }

    /**
     * Open file picker and import selected media files
     * @param {string} acceptTypes - 'image', 'video', or 'all'
     * @returns {Promise<Object>} - Import result with success/failure counts
     */
    async openFilePicker(acceptTypes = 'all') {
        return new Promise((resolve, reject) => {
            try {
                // Create file input element
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.multiple = true;
                
                // Set accepted file types
                if (acceptTypes === 'image') {
                    fileInput.accept = 'image/*';
                } else if (acceptTypes === 'video') {
                    fileInput.accept = 'video/*';
                } else {
                    fileInput.accept = 'image/*,video/*';
                }
                
                fileInput.style.display = 'none';
                document.body.appendChild(fileInput);
                
                // Handle file selection
                fileInput.addEventListener('change', async (event) => {
                    const files = Array.from(event.target.files);
                    
                    if (files.length === 0) {
                        document.body.removeChild(fileInput);
                        resolve({ success: 0, failed: 0, replaced: 0, message: 'No files selected' });
                        return;
                    }
                    
                    console.log(`MediaImportManager: ${files.length} file(s) selected for import`);
                    
                    try {
                        // Import the selected files
                        const result = await this.importFiles(files);
                        document.body.removeChild(fileInput);
                        resolve(result);
                    } catch (error) {
                        document.body.removeChild(fileInput);
                        reject(error);
                    }
                });
                
                // Handle cancellation
                fileInput.addEventListener('cancel', () => {
                    document.body.removeChild(fileInput);
                    resolve({ success: 0, failed: 0, replaced: 0, message: 'Import cancelled' });
                });
                
                // Trigger file picker
                fileInput.click();
                
            } catch (error) {
                console.error('MediaImportManager: Failed to open file picker:', error);
                reject(error);
            }
        });
    }

    /**
     * Import multiple media files
     * @param {File[]} files - Array of File objects to import
     * @returns {Promise<Object>} - Import result
     */
    async importFiles(files) {
        if (this.isImporting) {
            throw new Error('Import already in progress');
        }

        this.isImporting = true;
        const results = {
            success: 0,
            failed: 0,
            replaced: 0,
            errors: []
        };

        try {
            console.log(`MediaImportManager: Starting import of ${files.length} file(s)`);
            
            // Show progress notification
            this.showImportProgress(0, files.length);

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                try {
                    // Validate file
                    const validation = this.validateFile(file);
                    if (!validation.valid) {
                        console.warn(`MediaImportManager: File validation failed for ${file.name}:`, validation.error);
                        results.failed++;
                        results.errors.push({ file: file.name, error: validation.error });
                        continue;
                    }

                    // Check if file exists (will be replaced)
                    const fileExists = await this.checkFileExists(file.name);
                    
                    // CRITICAL: If replacing, clear old URI from MediaManager cache
                    if (fileExists && window.mediaManager) {
                        window.mediaManager.uriCache.delete(file.name);
                        window.mediaManager.fileUriMap.delete(file.name);
                        console.log(`MediaImportManager: Cleared old cache entries for ${file.name}`);
                    }
                    
                    // Import the file (this will update MediaManager caches)
                    const importResult = await this.importSingleFile(file);
                    
                    results.success++;
                    if (fileExists) {
                        results.replaced++;
                    }
                    
                    this.stats.totalImports++;
                    this.stats.successfulImports++;
                    if (fileExists) {
                        this.stats.replacedFiles++;
                    }
                    
                    console.log(`MediaImportManager: Successfully imported ${file.name}${fileExists ? ' (replaced)' : ''} | Web URI cached: ${importResult.hasWebUri}`);
                    
                } catch (error) {
                    console.error(`MediaImportManager: Failed to import ${file.name}:`, error);
                    results.failed++;
                    results.errors.push({ file: file.name, error: error.message });
                    this.stats.failedImports++;
                }
                
                // Update progress
                this.showImportProgress(i + 1, files.length);
            }

            // Hide progress notification
            this.hideImportProgress();

            console.log('MediaImportManager: Import completed:', results);
            
            // CRITICAL: Reload MediaManager cache index to ensure all imports are recognized
            if (results.success > 0 && window.mediaManager) {
                try {
                    console.log('MediaImportManager: Reloading MediaManager cache index...');
                    await window.mediaManager.loadCacheIndex();
                    console.log(`MediaImportManager: MediaManager cache reloaded successfully - ${window.mediaManager.cachedFiles.size} files indexed`);
                } catch (error) {
                    console.warn('MediaImportManager: Failed to reload MediaManager cache:', error);
                }
            }
            
            // Show result notification
            this.showImportResult(results);
            
            return results;
            
        } catch (error) {
            this.hideImportProgress();
            console.error('MediaImportManager: Import process failed:', error);
            throw error;
        } finally {
            this.isImporting = false;
        }
    }

    /**
     * Import a single media file
     * ENHANCED: Smart routing between chunked (large files) and direct (small files) import
     * @param {File} file - File object to import
     * @returns {Promise<Object>} Import result with URI info
     */
    async importSingleFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        const videoExts = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v'];
        const isVideo = videoExts.includes(ext);
        const filePath = `${this.mediaDir}/${file.name}`;
        
        try {
            console.log(`[MediaImportManager] Importing ${isVideo ? 'video' : 'image'}: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            
            // NEW: Choose import strategy based on file size
            if (this.useChunking && this.chunkManager && window.chunkConfigHelpers) {
                const shouldChunk = window.chunkConfigHelpers.shouldUseChunking(file.size, file.name);
                
                if (shouldChunk) {
                    console.log(`[MediaImportManager] Using CHUNKED import for large file: ${file.name}`);
                    this.stats.chunkedImports++;
                    return await this._importFileChunked(file, filePath);
                } else {
                    console.log(`[MediaImportManager] Using DIRECT import for small file: ${file.name}`);
                    this.stats.directImports++;
                    return await this._importFileDirect(file, filePath);
                }
            } else {
                // Chunking disabled or not available, use direct import
                console.log(`[MediaImportManager] Using DIRECT import (chunking disabled): ${file.name}`);
                this.stats.directImports++;
                return await this._importFileDirect(file, filePath);
            }
            
        } catch (error) {
            console.error(`[MediaImportManager] Failed to import ${file.name}:`, error);
            throw error;
        }
    }
    
    /**
     * NEW: Import file directly using standard Capacitor Filesystem (for small files)
     * @private
     * @param {File} file - File object to import
     * @param {string} filePath - Destination file path
     * @returns {Promise<Object>} Import result
     */
    async _importFileDirect(file, filePath) {
        try {
            // Write file using Capacitor API (auto-converts Blob to base64 internally)
            if (window.capacitorAPI && window.capacitorAPI.writeFile) {
                // writeFile now returns {success, path, uri, directory}
                const writeResult = await window.capacitorAPI.writeFile(filePath, file);
                
                if (!writeResult || !writeResult.success) {
                    throw new Error('writeFile returned unsuccessful result');
                }
                
                const nativeUri = writeResult.uri;
                
                if (nativeUri) {
                    console.log(`[MediaImportManager] Native URI obtained: ${nativeUri.substring(0, 50)}...`);
                    
                    // Register native URI with MediaManager
                    if (window.mediaManager) {
                        window.mediaManager.fileUriMap.set(file.name, nativeUri);
                    }
                    
                    // Convert to web-accessible URI and cache
                    if (window.capacitorAPI.convertFileSrc) {
                        try {
                            const convertedUri = window.capacitorAPI.convertFileSrc(nativeUri);
                            if (convertedUri && window.mediaManager) {
                                window.mediaManager.uriCache.set(file.name, convertedUri);
                                console.log(`[MediaImportManager] ✓ Cached web URI for: ${file.name}`);
                            }
                        } catch (err) {
                            console.warn(`[MediaImportManager] convertFileSrc failed:`, err.message);
                        }
                    }
                } else {
                    console.warn(`[MediaImportManager] No native URI returned for: ${file.name}`);
                }
                
                // Update MediaManager's cached files index
                if (window.mediaManager) {
                    window.mediaManager.cachedFiles.add(file.name);
                }
                
                console.log(`[MediaImportManager] ✓ Successfully imported (direct): ${file.name}`);
                
                return { 
                    success: true, 
                    filePath, 
                    hasWebUri: window.mediaManager && window.mediaManager.uriCache.has(file.name),
                    chunked: false
                };
                
            } else {
                throw new Error('Capacitor API not available');
            }
            
        } catch (error) {
            console.error(`[MediaImportManager] Direct import failed for ${file.name}:`, error);
            throw error;
        }
    }
    
    /**
     * NEW: Import large file using chunked operations
     * @private
     * @param {File} file - File object to import
     * @param {string} filePath - Destination file path
     * @returns {Promise<Object>} Import result
     */
    async _importFileChunked(file, filePath) {
        console.log(`[MediaImportManager] ✓ CHUNKED IMPORT: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        
        try {
            // Ensure chunk manager is ready
            if (!this.chunkManager) {
                throw new Error('Chunk manager not available');
            }
            
            // Get optimal chunk configuration
            const serverConfig = window.chunkConfigHelpers 
                ? window.chunkConfigHelpers.getServerConfig(file.size, file.name)
                : { encryption: false, chunkSize: 10 * 1024 * 1024 };
            
            console.log('[MediaImportManager] Chunk config:', serverConfig);
            
            // Ensure server is started
            await this.chunkManager.ensureServerReady(serverConfig);
            
            // Create empty file
            const fileUri = await this.chunkManager.createEmptyFile(filePath);
            console.log('[MediaImportManager] Empty file created:', fileUri);
            
            // Read file in chunks and write
            const chunkSize = serverConfig.chunkSize || (10 * 1024 * 1024); // 10MB default
            let offset = 0;
            let totalWritten = 0;
            
            while (offset < file.size) {
                // Read chunk from File object
                const chunkEnd = Math.min(offset + chunkSize, file.size);
                const chunk = file.slice(offset, chunkEnd);
                const arrayBuffer = await chunk.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                // Write chunk
                const success = await this.chunkManager.appendChunk(fileUri, uint8Array);
                
                if (!success) {
                    throw new Error(`Failed to write chunk at offset ${offset}`);
                }
                
                totalWritten += uint8Array.length;
                offset = chunkEnd;
                
                // Update progress
                const progress = Math.round((totalWritten / file.size) * 100);
                this.showImportProgress(totalWritten, file.size);
                
                // Log every 20%
                if (progress % 20 === 0) {
                    console.log(`[MediaImportManager] Import progress: ${file.name} ${progress}%`);
                }
            }
            
            console.log(`[MediaImportManager] ✓ Chunked import completed: ${file.name}`);
            
            // Get native URI and cache it
            const nativeUri = 'file://' + fileUri;
            
            // Register with MediaManager
            if (window.mediaManager) {
                window.mediaManager.fileUriMap.set(file.name, nativeUri);
                window.mediaManager.cachedFiles.add(file.name);
                
                // Convert to web-accessible URI
                if (window.capacitorAPI?.convertFileSrc) {
                    try {
                        const convertedUri = window.capacitorAPI.convertFileSrc(nativeUri);
                        if (convertedUri) {
                            window.mediaManager.uriCache.set(file.name, convertedUri);
                            console.log(`[MediaImportManager] ✓ Cached web URI for: ${file.name}`);
                        }
                    } catch (err) {
                        console.warn(`[MediaImportManager] convertFileSrc failed:`, err.message);
                    }
                }
            }
            
            // Show success notification
            if (window.errorNotification) {
                window.errorNotification.success(
                    'Large File Imported',
                    `${file.name} ready for use`,
                    3000
                );
            }
            
            return {
                success: true,
                filePath: fileUri,
                hasWebUri: window.mediaManager && window.mediaManager.uriCache.has(file.name),
                chunked: true,
                fileSize: file.size
            };
            
        } catch (error) {
            console.error('[MediaImportManager] Chunked import failed:', error);
            
            // Show error notification
            if (window.errorNotification) {
                window.errorNotification.error(
                    'Import Failed',
                    `Failed to import ${file.name}: ${error.message}`,
                    5000
                );
            }
            
            // Try fallback to direct import for medium-sized files
            if (file.size < 20 * 1024 * 1024) { // < 20MB
                console.warn('[MediaImportManager] Falling back to direct import...');
                return await this._importFileDirect(file, filePath);
            }
            
            throw error;
        }
    }
    
    /**
     * Convert File to Base64 string
     * @deprecated This method is kept for backward compatibility but should NOT be used.
     * All media (images + videos) now use direct blob storage without base64 conversion.
     * WARNING: Converting large files (5MB+) to base64 can cause memory crashes.
     * @param {File} file - File object to convert
     * @returns {Promise<string>} Base64 encoded string (without data URL prefix)
     */
    _fileToBase64(file) {
        console.warn('[MediaImportManager] WARNING: Using deprecated _fileToBase64 method. Use blob storage instead.');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                // Remove data URL prefix (e.g., "data:image/png;base64,")
                const base64Data = event.target.result.split(',')[1];
                resolve(base64Data);
            };
            
            reader.onerror = (error) => {
                reject(new Error(`Failed to read file: ${error}`));
            };
            
            // Read file as base64
            reader.readAsDataURL(file);
        });
    }

    /**
     * Validate media file
     * @param {File} file - File to validate
     * @returns {Object} - Validation result { valid: boolean, error: string }
     */
    validateFile(file) {
        // Check if file exists
        if (!file || !file.name) {
            return { valid: false, error: 'Invalid file object' };
        }

        // Check file size
        if (file.size > this.maxFileSize) {
            return { 
                valid: false, 
                error: `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(this.maxFileSize)})` 
            };
        }

        // Check file type
        const isImage = this.allowedTypes.image.includes(file.type);
        const isVideo = this.allowedTypes.video.includes(file.type);
        
        if (!isImage && !isVideo) {
            return { 
                valid: false, 
                error: `File type '${file.type}' is not supported. Allowed: images and videos` 
            };
        }

        // Check file extension
        const extension = file.name.split('.').pop().toLowerCase();
        const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'mp4', 'webm', 'ogg', 'mov', 'avi'];
        
        if (!validExtensions.includes(extension)) {
            return { 
                valid: false, 
                error: `File extension '.${extension}' is not supported` 
            };
        }

        return { valid: true };
    }

    /**
     * Check if file exists in media directory
     * @param {string} filename - Name of the file to check
     * @returns {Promise<boolean>}
     */
    async checkFileExists(filename) {
        try {
            if (window.capacitorAPI && window.capacitorAPI.fileExists) {
                const filePath = `${this.mediaDir}/${filename}`;
                return await window.capacitorAPI.fileExists(filePath, window.CapacitorDirectory.Data);
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Fallback: Save file to browser storage (IndexedDB or localStorage)
     * Note: This has size limitations and is not persistent
     */
    saveToBrowserStorage(filename, base64Data) {
        try {
            const key = `media_${filename}`;
            localStorage.setItem(key, base64Data);
            console.log(`MediaImportManager: File saved to browser storage: ${filename}`);
        } catch (error) {
            console.error('MediaImportManager: Failed to save to browser storage:', error);
            throw error;
        }
    }

    /**
     * Show import progress notification
     */
    showImportProgress(current, total) {
        const percentage = Math.round((current / total) * 100);
        
        // Remove existing progress notification
        this.hideImportProgress();
        
        // Create progress notification
        const progressDiv = document.createElement('div');
        progressDiv.id = 'media-import-progress';
        progressDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 99999;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 40px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-width: 300px;
        `;
        
        progressDiv.innerHTML = `
            <div style="font-size: 1.2em; font-weight: 500; margin-bottom: 15px;">
                Importing Media Files
            </div>
            <div style="font-size: 2em; font-weight: 700; margin-bottom: 10px;">
                ${percentage}%
            </div>
            <div style="font-size: 0.9em; opacity: 0.9;">
                ${current} of ${total} files
            </div>
            <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.3); border-radius: 4px; margin-top: 15px; overflow: hidden;">
                <div style="width: ${percentage}%; height: 100%; background: white; transition: width 0.3s ease;"></div>
            </div>
        `;
        
        document.body.appendChild(progressDiv);
    }

    /**
     * Hide import progress notification
     */
    hideImportProgress() {
        const progressDiv = document.getElementById('media-import-progress');
        if (progressDiv) {
            progressDiv.remove();
        }
    }

    /**
     * Show import result notification
     */
    showImportResult(results) {
        const totalFiles = results.success + results.failed;
        const isSuccess = results.failed === 0;
        
        const resultDiv = document.createElement('div');
        resultDiv.id = 'media-import-result';
        resultDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 99999;
            background: ${isSuccess ? '#10b981' : '#f59e0b'};
            color: white;
            padding: 20px 30px;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 400px;
            animation: slideInRight 0.3s ease;
        `;
        
        let message = `<div style="font-size: 1.1em; font-weight: 600; margin-bottom: 10px;">
            ${isSuccess ? '✓' : '⚠'} Import ${isSuccess ? 'Complete' : 'Completed with Warnings'}
        </div>`;
        
        message += `<div style="font-size: 0.95em; opacity: 0.95;">`;
        message += `${results.success} of ${totalFiles} file(s) imported successfully`;
        
        if (results.replaced > 0) {
            message += `<br>${results.replaced} file(s) replaced`;
        }
        
        if (results.failed > 0) {
            message += `<br>${results.failed} file(s) failed`;
        }
        
        message += `</div>`;
        
        resultDiv.innerHTML = message;
        
        // Add CSS animation
        if (!document.getElementById('media-import-animations')) {
            const style = document.createElement('style');
            style.id = 'media-import-animations';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(resultDiv);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            resultDiv.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            resultDiv.style.opacity = '0';
            resultDiv.style.transform = 'translateX(100%)';
            
            setTimeout(() => {
                resultDiv.remove();
            }, 300);
        }, 5000);
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Get import statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset import statistics
     */
    resetStats() {
        this.stats = {
            totalImports: 0,
            successfulImports: 0,
            failedImports: 0,
            replacedFiles: 0
        };
    }
}

// Initialize and expose global media import manager
const mediaImportManager = new MobileMediaImportManager();

// Make it globally accessible
window.mediaImportManager = mediaImportManager;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        mediaImportManager.initialize();
    });
} else {
    mediaImportManager.initialize();
}

console.log('=== MOBILE MEDIA IMPORT MANAGER: Module loaded ===');
