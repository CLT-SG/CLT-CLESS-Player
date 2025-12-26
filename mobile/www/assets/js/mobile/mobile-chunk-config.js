/**
 * eCLESS Player Mobile - Chunked Media Configuration
 * 
 * Configuration for chunked file operations using capacitor-file-chunk.
 * This optimizes handling of large media files (images, videos) for offline playback.
 * 
 * @module mobile-chunk-config
 */

const CHUNK_CONFIG = {
    // Master switch to enable/disable chunked file operations
    enabled: true,

    // File size thresholds (in bytes)
    thresholds: {
        // Files < 2MB: Use standard Capacitor Filesystem (fast, no overhead)
        smallFile: 2 * 1024 * 1024,

        // Files 2-50MB: Use chunked operations without encryption
        mediumFile: 50 * 1024 * 1024,

        // Files > 50MB: Use chunked operations (with optional encryption)
        largeFile: 50 * 1024 * 1024
    },

    // Chunk sizes for different media types (in bytes)
    chunkSizes: {
        // Images: 5MB chunks (good balance for image files)
        image: 5 * 1024 * 1024,

        // Videos: 10MB chunks (optimal for video streaming)
        video: 10 * 1024 * 1024,

        // Default: 10MB chunks for unknown types
        default: 10 * 1024 * 1024
    },

    // Local HTTP server configuration
    server: {
        // Enable encryption for sensitive files (requires libsodium-wrappers)
        encryption: false,

        // Fixed port number (null = auto-select)
        port: null,

        // Port range for auto-selection
        portMin: 8080,
        portMax: 8100,

        // Number of retry attempts to find available port
        retries: 5,

        // Auto-stop server after inactivity (ms, 0 = never stop)
        autoStopTimeout: 60000  // 1 minute
    },

    // Performance and reliability settings
    performance: {
        // Maximum number of concurrent chunk downloads
        maxConcurrentDownloads: 3,

        // How often to update progress callbacks (ms)
        progressUpdateInterval: 500,

        // Number of retry attempts for failed chunk operations
        retryAttempts: 3,

        // Delay between retry attempts (ms)
        retryDelay: 2000,

        // Enable lazy loading for table images
        lazyLoadTableImages: true,

        // Intersection Observer margin for lazy loading
        lazyLoadMargin: '200px'
    },

    // Cache management
    cache: {
        // Maximum cache size in bytes (500MB default)
        maxCacheSize: 500 * 1024 * 1024,

        // Enable automatic cache cleanup when limit reached
        autoCleanup: true,

        // Cache cleanup strategy ('lru' = least recently used, 'size' = largest files first)
        cleanupStrategy: 'lru'
    },

    // Feature flags
    features: {
        // Use chunking for image downloads
        chunkImages: true,

        // Use chunking for video downloads
        chunkVideos: true,

        // Use chunking for imports from device storage
        chunkImports: true,

        // Enable progress tracking UI
        showProgress: true,

        // Enable debug logging
        debugLogging: false
    }
};

// File type mappings
const FILE_TYPE_MAPPING = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
    video: ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'flv'],
    streaming: ['m3u8', 'mpd']
};

/**
 * Get file type from extension
 * @param {string} filename - File name or path
 * @returns {string} File type ('image', 'video', 'streaming', 'unknown')
 */
function getFileType(filename) {
    if (!filename) return 'unknown';

    const ext = filename.split('.').pop().toLowerCase();

    for (const [type, extensions] of Object.entries(FILE_TYPE_MAPPING)) {
        if (extensions.includes(ext)) {
            return type;
        }
    }

    return 'unknown';
}

/**
 * Get optimal chunk size for a file
 * @param {string} filename - File name or path
 * @returns {number} Chunk size in bytes
 */
function getOptimalChunkSize(filename) {
    const fileType = getFileType(filename);

    switch (fileType) {
        case 'image':
            return CHUNK_CONFIG.chunkSizes.image;
        case 'video':
        case 'streaming':
            return CHUNK_CONFIG.chunkSizes.video;
        default:
            return CHUNK_CONFIG.chunkSizes.default;
    }
}

/**
 * Determine if file should use chunked operations
 * @param {number} fileSize - File size in bytes
 * @param {string} filename - File name (optional, for type-specific rules)
 * @returns {boolean} True if should use chunking
 */
function shouldUseChunking(fileSize, filename = null) {
    if (!CHUNK_CONFIG.enabled) {
        return false;
    }

    // Small files: no chunking
    if (fileSize < CHUNK_CONFIG.thresholds.smallFile) {
        return false;
    }

    // Check feature flags for specific file types
    if (filename) {
        const fileType = getFileType(filename);

        if (fileType === 'image' && !CHUNK_CONFIG.features.chunkImages) {
            return false;
        }

        if ((fileType === 'video' || fileType === 'streaming') && !CHUNK_CONFIG.features.chunkVideos) {
            return false;
        }
    }

    // Medium and large files: use chunking
    return true;
}

/**
 * Determine if file should use encryption
 * @param {number} fileSize - File size in bytes
 * @returns {boolean} True if should use encryption
 */
function shouldUseEncryption(fileSize) {
    if (!CHUNK_CONFIG.server.encryption) {
        return false;
    }

    // Only encrypt large files (if encryption is enabled)
    return fileSize >= CHUNK_CONFIG.thresholds.largeFile;
}

/**
 * Get server configuration for chunk manager
 * @param {number} fileSize - File size in bytes (optional)
 * @param {string} filename - File name (optional)
 * @returns {Object} Server configuration
 */
function getServerConfig(fileSize = 0, filename = null) {
    return {
        encryption: shouldUseEncryption(fileSize),
        port: CHUNK_CONFIG.server.port,
        portMin: CHUNK_CONFIG.server.portMin,
        portMax: CHUNK_CONFIG.server.portMax,
        retries: CHUNK_CONFIG.server.retries,
        chunkSize: filename ? getOptimalChunkSize(filename) : CHUNK_CONFIG.chunkSizes.default
    };
}

// Export configuration and helpers
window.CHUNK_CONFIG = CHUNK_CONFIG;
window.chunkConfigHelpers = {
    getFileType,
    getOptimalChunkSize,
    shouldUseChunking,
    shouldUseEncryption,
    getServerConfig
};

console.log('=== CHUNK CONFIG: Configuration loaded ===');
console.log('[ChunkConfig] Chunking enabled:', CHUNK_CONFIG.enabled);
console.log('[ChunkConfig] Thresholds:', {
    small: `${(CHUNK_CONFIG.thresholds.smallFile / 1024 / 1024).toFixed(1)} MB`,
    medium: `${(CHUNK_CONFIG.thresholds.mediumFile / 1024 / 1024).toFixed(1)} MB`,
    large: `${(CHUNK_CONFIG.thresholds.largeFile / 1024 / 1024).toFixed(1)} MB`
});
