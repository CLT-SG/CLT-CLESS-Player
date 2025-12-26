/**
 * eCLESS Player Mobile - Image Compression Module
 * 
 * This module provides image compression capabilities using browser-image-compression.
 * Compresses images before caching to reduce storage size and improve loading performance.
 * 
 * Features:
 * - Automatic compression for large images
 * - Configurable quality and size limits
 * - Preserves image aspect ratio
 * - Maintains EXIF orientation
 * - Fallback to original if compression fails
 * 
 * @module mobile-image-compression
 */

console.log('=== MOBILE IMAGE COMPRESSION: Initializing ===');

// Import browser-image-compression library (will be bundled)
// Note: This is loaded via script tag in index.html, so we use the global imageCompression

/**
 * Image Compression Manager Class
 */
class ImageCompressionManager {
    constructor() {
        this.initialized = false;
        this.compressionEnabled = true; // Can be toggled via config
        
        // Default compression options
        this.defaultOptions = {
            maxSizeMB: 2,              // Max file size in MB (compress if larger)
            maxWidthOrHeight: 1920,    // Max dimension (scale down if larger)
            useWebWorker: true,        // Use web worker for better performance
            fileType: 'image/jpeg',    // Output type (default to JPEG for better compression)
            quality: 0.85,             // Quality (0.0 - 1.0, higher = better quality)
            initialQuality: 0.9,       // Initial quality before stepping down
            alwaysKeepResolution: false // Maintain resolution if possible
        };
        
        // Statistics
        this.stats = {
            totalCompressed: 0,
            totalBytesSaved: 0,
            compressionErrors: 0
        };
    }

    /**
     * Initialize the compression manager
     */
    async initialize() {
        try {
            console.log('[ImageCompression] Initializing image compression manager');
            
            // Check if browser-image-compression is available
            if (typeof imageCompression === 'undefined') {
                console.warn('[ImageCompression] browser-image-compression library not found - compression disabled');
                this.compressionEnabled = false;
                return false;
            }
            
            this.initialized = true;
            console.log('[ImageCompression] ✓ Image compression manager initialized');
            return true;
            
        } catch (error) {
            console.error('[ImageCompression] Initialization error:', error);
            this.compressionEnabled = false;
            return false;
        }
    }

    /**
     * Check if an image needs compression
     * @param {File|Blob} blob - Image blob to check
     * @returns {boolean} True if compression is recommended
     */
    shouldCompress(blob) {
        if (!this.compressionEnabled) return false;
        if (!blob) return false;
        
        // Compress if larger than 1MB
        const sizeMB = blob.size / (1024 * 1024);
        return sizeMB > 1.0;
    }

    /**
     * Compress an image blob
     * @param {File|Blob} imageBlob - Original image blob
     * @param {Object} options - Compression options (optional)
     * @returns {Promise<Blob>} Compressed image blob (or original if compression fails/not needed)
     */
    async compressImage(imageBlob, options = {}) {
        // Return original if compression disabled
        if (!this.compressionEnabled || !this.initialized) {
            console.log('[ImageCompression] Compression disabled, returning original');
            return imageBlob;
        }

        // Validate input
        if (!imageBlob || !(imageBlob instanceof Blob)) {
            console.error('[ImageCompression] Invalid input - not a Blob');
            return imageBlob;
        }

        // Get file info
        const originalSizeKB = (imageBlob.size / 1024).toFixed(2);
        const mimeType = imageBlob.type || 'image/jpeg';
        
        console.log(`[ImageCompression] Processing image: ${originalSizeKB} KB | Type: ${mimeType}`);

        // Skip compression for very small images
        if (!this.shouldCompress(imageBlob)) {
            console.log('[ImageCompression] Image is small enough, skipping compression');
            return imageBlob;
        }

        try {
            // Merge default options with provided options
            const compressionOptions = {
                ...this.defaultOptions,
                ...options,
                fileType: mimeType // Preserve original MIME type if possible
            };

            // Special handling for PNG (preserve transparency)
            if (mimeType === 'image/png') {
                compressionOptions.fileType = 'image/png';
                compressionOptions.maxSizeMB = Math.max(compressionOptions.maxSizeMB, 1.5); // Be less aggressive with PNG
            }

            console.log(`[ImageCompression] Compressing with options:`, {
                maxSizeMB: compressionOptions.maxSizeMB,
                maxWidthOrHeight: compressionOptions.maxWidthOrHeight,
                quality: compressionOptions.quality,
                fileType: compressionOptions.fileType
            });

            // Perform compression (browser-image-compression automatically handles File/Blob)
            const compressedBlob = await imageCompression(imageBlob, compressionOptions);

            // Calculate compression results
            const compressedSizeKB = (compressedBlob.size / 1024).toFixed(2);
            const compressionRatio = ((1 - compressedBlob.size / imageBlob.size) * 100).toFixed(1);
            const bytesSaved = imageBlob.size - compressedBlob.size;

            console.log(`[ImageCompression] ✓ Compression successful:`);
            console.log(`  Original: ${originalSizeKB} KB`);
            console.log(`  Compressed: ${compressedSizeKB} KB`);
            console.log(`  Saved: ${compressionRatio}% (${(bytesSaved / 1024).toFixed(2)} KB)`);

            // Update statistics
            this.stats.totalCompressed++;
            this.stats.totalBytesSaved += bytesSaved;

            // Only use compressed version if it's actually smaller
            if (compressedBlob.size < imageBlob.size) {
                return compressedBlob;
            } else {
                console.warn('[ImageCompression] Compressed file is larger than original, using original');
                return imageBlob;
            }

        } catch (error) {
            console.error('[ImageCompression] Compression failed:', error.message);
            this.stats.compressionErrors++;
            
            // Fallback to original image on error
            console.log('[ImageCompression] Using original image as fallback');
            return imageBlob;
        }
    }

    /**
     * Compress image with custom quality settings
     * @param {File|Blob} imageBlob - Original image blob
     * @param {number} quality - Quality level (0.0 - 1.0)
     * @returns {Promise<Blob>} Compressed image blob
     */
    async compressWithQuality(imageBlob, quality = 0.85) {
        return this.compressImage(imageBlob, { quality });
    }

    /**
     * Compress image to target size
     * @param {File|Blob} imageBlob - Original image blob
     * @param {number} maxSizeMB - Maximum size in MB
     * @returns {Promise<Blob>} Compressed image blob
     */
    async compressToSize(imageBlob, maxSizeMB = 1) {
        return this.compressImage(imageBlob, { maxSizeMB });
    }

    /**
     * Get compression statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            totalBytesSavedMB: (this.stats.totalBytesSaved / (1024 * 1024)).toFixed(2),
            averageSavingsKB: this.stats.totalCompressed > 0 
                ? ((this.stats.totalBytesSaved / this.stats.totalCompressed) / 1024).toFixed(2)
                : 0
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalCompressed: 0,
            totalBytesSaved: 0,
            compressionErrors: 0
        };
    }

    /**
     * Enable compression
     */
    enable() {
        this.compressionEnabled = true;
        console.log('[ImageCompression] Compression enabled');
    }

    /**
     * Disable compression
     */
    disable() {
        this.compressionEnabled = false;
        console.log('[ImageCompression] Compression disabled');
    }

    /**
     * Check if compression is enabled
     * @returns {boolean}
     */
    isEnabled() {
        return this.compressionEnabled && this.initialized;
    }
}

// Create global instance
window.imageCompression = window.imageCompression || {}; // Keep library reference
window.imageCompressionManager = new ImageCompressionManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.imageCompressionManager && !window.imageCompressionManager.initialized) {
            window.imageCompressionManager.initialize();
        }
    });
} else {
    // DOM already loaded
    if (window.imageCompressionManager && !window.imageCompressionManager.initialized) {
        window.imageCompressionManager.initialize();
    }
}

console.log('=== MOBILE IMAGE COMPRESSION: Module loaded ===');
