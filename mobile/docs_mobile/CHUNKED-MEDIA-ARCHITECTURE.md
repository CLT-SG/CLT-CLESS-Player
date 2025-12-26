# Chunked Media Architecture Design

## Overview
This document outlines the architecture for migrating from Capacitor Filesystem API to capacitor-file-chunk for handling large media files (images and videos) in the eCLESS Player mobile app.

## Problem Statement
Current implementation has critical issues with large files:
- **Memory crashes**: Loading 100MB+ videos and 5MB+ images into memory as blobs
- **Base64 overhead**: Image conversion doubles memory usage
- **Performance bottleneck**: Capacitor bridge limits throughput
- **No progress tracking**: Poor UX for large file downloads

## Solution: capacitor-file-chunk Integration

### Package Details
- **Version**: 2.0.0 (for Capacitor 6.x compatibility)
- **Performance**: 10-50x faster than Capacitor Filesystem
- **Capacity**: Handles 1GB+ files without crashes
- **Default chunk size**: 10MB (configurable)
- **Encryption**: Optional ChaCha20-Poly1305

## Architecture Design

### 1. File Size Thresholds
```javascript
const CHUNK_THRESHOLDS = {
  SMALL_FILE: 2 * 1024 * 1024,      // < 2MB: Use standard Capacitor Filesystem
  MEDIUM_FILE: 50 * 1024 * 1024,    // 2-50MB: Use chunking without encryption
  LARGE_FILE: 50 * 1024 * 1024      // > 50MB: Use chunking with encryption
};

const CHUNK_SIZES = {
  IMAGE: 5 * 1024 * 1024,   // 5MB chunks for images
  VIDEO: 10 * 1024 * 1024,  // 10MB chunks for videos
  DEFAULT: 10 * 1024 * 1024 // 10MB default
};
```

### 2. Hybrid Strategy
- **Small files (< 2MB)**: Direct Capacitor Filesystem (backward compatible, fast)
- **Medium files (2-50MB)**: Chunked reading/writing without encryption
- **Large files (> 50MB)**: Chunked with optional encryption for security

### 3. Component Architecture

#### A. MobileChunkManager (New)
Wrapper around FileChunkManager from capacitor-file-chunk demo.

**Responsibilities:**
- Start/stop local HTTP server
- Manage server lifecycle
- Handle chunk operations (read, write, append)
- Track progress for UI feedback
- Encryption key management

**Key Methods:**
```javascript
class MobileChunkManager {
  async initialize()
  async startServer(config)
  async stopServer()
  async createEmptyFile(path)
  async appendChunk(path, data, onProgress)
  async readChunk(path, offset, length)
  async getFileSize(path)
  async downloadFileChunked(url, destPath, onProgress)
  getServerInfo()
}
```

#### B. MobileMediaManager (Enhanced)
Enhanced with chunked download support.

**Changes:**
```javascript
class MobileMediaManager {
  constructor() {
    // ... existing properties
    this.chunkManager = null; // NEW: Reference to MobileChunkManager
    this.useChunking = true;  // NEW: Enable/disable chunking
  }

  // NEW: Smart download method selector
  async downloadMedia(url, filename) {
    const fileSize = await this._estimateFileSize(url);
    
    if (fileSize < CHUNK_THRESHOLDS.SMALL_FILE) {
      return await this._performStandardDownload(url, filename);
    } else {
      return await this._performChunkedDownload(url, filename, fileSize);
    }
  }

  // NEW: Chunked download implementation
  async _performChunkedDownload(url, filename, fileSize) {
    // Initialize chunk manager if not ready
    if (!this.chunkManager || !this.chunkManager.isReady()) {
      await this.chunkManager.startServer({ 
        encryption: fileSize > CHUNK_THRESHOLDS.LARGE_FILE,
        chunkSize: this._getOptimalChunkSize(filename)
      });
    }

    // Download file in chunks with progress tracking
    return await this.chunkManager.downloadFileChunked(
      url, 
      `${this.cacheDir}/${filename}`,
      (progress) => this._onDownloadProgress(filename, progress)
    );
  }

  // NEW: Get data URI from chunked file
  async _getDataUriChunked(filePath, mimeType) {
    const fileSize = await this.chunkManager.getFileSize(filePath);
    const chunks = [];
    let offset = 0;
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks for reading

    while (offset < fileSize) {
      const chunk = await this.chunkManager.readChunk(
        filePath, 
        offset, 
        Math.min(chunkSize, fileSize - offset)
      );
      chunks.push(chunk);
      offset += chunk.length;
    }

    // Combine chunks and convert to base64
    const blob = new Blob(chunks);
    const base64 = await this._blobToBase64(blob);
    return `data:${mimeType};base64,${base64}`;
  }
}
```

#### C. MobileMediaImportManager (Enhanced)
Enhanced with chunked import for large user-uploaded files.

**Changes:**
```javascript
class MobileMediaImportManager {
  constructor() {
    // ... existing properties
    this.chunkManager = null; // NEW: Reference to MobileChunkManager
  }

  async importSingleFile(file) {
    const filePath = `${this.mediaDir}/${file.name}`;
    
    // Use chunked import for large files
    if (file.size > CHUNK_THRESHOLDS.SMALL_FILE) {
      return await this._importFileChunked(file, filePath);
    } else {
      return await this._importFileDirect(file, filePath);
    }
  }

  // NEW: Chunked file import
  async _importFileChunked(file, destPath) {
    // Initialize chunk manager
    if (!this.chunkManager || !this.chunkManager.isReady()) {
      await this.chunkManager.startServer({ 
        encryption: false,
        chunkSize: CHUNK_SIZES.DEFAULT
      });
    }

    // Create empty file
    await this.chunkManager.createEmptyFile(destPath);

    // Read file in chunks and write
    const chunkSize = CHUNK_SIZES.DEFAULT;
    let offset = 0;

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      const arrayBuffer = await chunk.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      await this.chunkManager.appendChunk(destPath, uint8Array);
      
      // Update progress
      this.showImportProgress(offset + chunk.size, file.size);
      
      offset += chunk.size;
    }

    return { success: true, filePath: destPath };
  }
}
```

#### D. slot-media.js (Enhanced)
Support for chunked media playback.

**Changes:**
- VideoJS players can use native file URIs (already supported)
- Images: Load via data URI (may use chunked reading for very large images)
- No major changes needed - chunking is transparent at download layer

#### E. slot-table.js (Enhanced)
Optimize table column images with lazy loading.

**Changes:**
```javascript
// NEW: Lazy load table images
async function loadTableImageLazy(imgElement, mediaUrl, filename) {
  // Show placeholder
  imgElement.src = 'assets/images/loading-placeholder.svg';
  
  // Check if in viewport
  const observer = new IntersectionObserver(async (entries) => {
    if (entries[0].isIntersecting) {
      // Load image
      const uri = await window.mediaManager.getMediaUri(filename, mediaUrl);
      imgElement.src = uri;
      observer.disconnect();
    }
  });
  
  observer.observe(imgElement);
}
```

### 4. Configuration File

Create `mobile/www/assets/js/mobile/mobile-chunk-config.js`:

```javascript
const CHUNK_CONFIG = {
  enabled: true,
  
  thresholds: {
    smallFile: 2 * 1024 * 1024,   // 2MB
    mediumFile: 50 * 1024 * 1024, // 50MB
    largeFile: 50 * 1024 * 1024   // 50MB
  },
  
  chunkSizes: {
    image: 5 * 1024 * 1024,   // 5MB
    video: 10 * 1024 * 1024,  // 10MB
    default: 10 * 1024 * 1024 // 10MB
  },
  
  server: {
    encryption: false,  // Enable for large files only
    port: null,         // Auto-select
    portMin: 8080,
    portMax: 8100,
    retries: 5
  },
  
  performance: {
    maxConcurrentDownloads: 3,
    progressUpdateInterval: 500, // ms
    retryAttempts: 3,
    retryDelay: 2000 // ms
  }
};
```

### 5. Migration Strategy

#### Phase 1: Install and Setup (Day 1)
1. Install capacitor-file-chunk v2.0.0
2. Configure AndroidManifest.xml (cleartext traffic)
3. Configure iOS Info.plist (localhost)
4. Copy FileChunkManager from demo project
5. Create MobileChunkManager wrapper

#### Phase 2: Core Implementation (Day 2-3)
1. Create mobile-chunk-manager.js
2. Create mobile-chunk-config.js
3. Enhance MobileMediaManager with chunked downloads
4. Enhance MobileMediaImportManager with chunked imports
5. Add progress tracking UI

#### Phase 3: Testing (Day 4)
1. Test small files (< 2MB) - should use standard path
2. Test medium files (2-50MB) - should use chunking
3. Test large files (> 50MB) - should use chunked + encryption
4. Test offline playback after download
5. Test cache persistence across app restarts

#### Phase 4: Optimization (Day 5)
1. Benchmark performance vs old implementation
2. Optimize chunk sizes based on real-world testing
3. Add retry logic for failed chunks
4. Memory profiling with large files

### 6. Backward Compatibility

**Existing cached files:**
- Keep using standard Capacitor Filesystem reads
- New downloads use chunked approach
- Gradual migration: Clear old cache if issues arise

**Feature flags:**
```javascript
const FEATURES = {
  USE_CHUNKING: true,           // Master switch
  CHUNK_IMAGES: true,           // Chunk large images
  CHUNK_VIDEOS: true,           // Chunk videos
  USE_ENCRYPTION: false,        // Encryption for sensitive files
  LAZY_LOAD_TABLE_IMAGES: true  // Lazy load table images
};
```

### 7. Error Handling

**Chunked download failures:**
```javascript
async downloadWithRetry(url, filename, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this._performChunkedDownload(url, filename);
    } catch (error) {
      if (attempt === maxRetries) {
        // Fall back to standard download
        console.warn('Chunked download failed, falling back to standard');
        return await this._performStandardDownload(url, filename);
      }
      await this._delay(2000 * attempt); // Exponential backoff
    }
  }
}
```

**Server startup failures:**
```javascript
async ensureServerReady() {
  if (!this.chunkManager.isReady()) {
    try {
      await this.chunkManager.startServer(config);
    } catch (error) {
      console.error('Failed to start chunk server:', error);
      this.useChunking = false; // Disable chunking for this session
      throw new Error('Chunk server unavailable, using fallback mode');
    }
  }
}
```

### 8. Performance Expectations

Based on capacitor-file-chunk benchmarks:

**Android (Mid-range device):**
| File Size | Old Method | New Method | Improvement |
|-----------|-----------|-----------|-------------|
| 10 MB     | 1.2s      | 0.15s     | 8x faster   |
| 100 MB    | 9.8s      | 1.5s      | 6.5x faster |
| 250 MB    | 24.0s     | 3.9s      | 6.2x faster |
| 500 MB    | 48.0s     | 8.7s      | 5.5x faster |
| 1000 MB   | crash     | 18.0s     | ✓ No crash  |

**iOS (iPhone SE 2020):**
| File Size | Old Method | New Method | Improvement |
|-----------|-----------|-----------|-------------|
| 10 MB     | 0.25s     | 0.079s    | 3.2x faster |
| 100 MB    | 2.4s      | 0.30s     | 8x faster   |
| 250 MB    | 5.9s      | 0.82s     | 7.2x faster |
| 500 MB    | 12.0s     | 1.7s      | 7x faster   |
| 1000 MB   | 24.0s     | 4.5s      | 5.3x faster |

### 9. Testing Checklist

- [ ] Install capacitor-file-chunk v2.0.0
- [ ] Configure Android cleartext traffic
- [ ] Configure iOS localhost permissions
- [ ] Test server startup/shutdown
- [ ] Test chunked download (image < 10MB)
- [ ] Test chunked download (image 10-50MB)
- [ ] Test chunked download (video 50-500MB)
- [ ] Test chunked import from device storage
- [ ] Test offline playback after download
- [ ] Test cache persistence after app restart
- [ ] Test VideoJS playback with chunked videos
- [ ] Test table images with lazy loading
- [ ] Benchmark vs old implementation
- [ ] Memory profiling with 10 concurrent large files
- [ ] Test fallback when chunk server fails
- [ ] Test progress tracking UI

## Next Steps

1. ✅ Complete architecture design (this document)
2. 🔄 Install capacitor-file-chunk package
3. ⏳ Implement MobileChunkManager wrapper
4. ⏳ Enhance MobileMediaManager with chunking
5. ⏳ Enhance MobileMediaImportManager with chunking
6. ⏳ Update slot-media.js (minimal changes)
7. ⏳ Update slot-table.js with lazy loading
8. ⏳ Add configuration and error handling
9. ⏳ Comprehensive testing
10. ⏳ Performance optimization

## References

- [capacitor-file-chunk npm](https://www.npmjs.com/package/capacitor-file-chunk)
- [capacitor-file-chunk demo](https://github.com/qrclip/capacitor-file-chunk/tree/main/demo)
- [FileChunkManager source](https://github.com/qrclip/capacitor-file-chunk/tree/main/demo/src/file-chunk-manager)
