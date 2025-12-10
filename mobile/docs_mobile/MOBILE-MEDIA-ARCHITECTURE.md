# Mobile Media Management Architecture

## Overview

The eCLESS Player mobile app uses a local media caching system to download, store, and play media files (images and videos) efficiently on Android and iOS devices. This document explains the architecture, implementation, and troubleshooting steps.

## Architecture Components

### 1. Mobile Media Manager (`mobile-media-manager.js`)

**Purpose**: Central module for handling all media file operations on mobile devices.

**Key Features**:
- Downloads media files from the server using CapacitorHttp or Fetch API
- Stores files persistently using Capacitor Filesystem API
- Converts stored files to web-accessible URLs (data URIs)
- Manages cache index and statistics
- Provides cache management functions (clear, delete, list)

**API Methods**:
```javascript
// Initialize the media manager
await window.mediaManager.initialize();

// Check if media exists in cache
const exists = await window.mediaManager.checkMediaExists('image.jpg');

// Download media from server
const result = await window.mediaManager.downloadMedia(url, filename);

// Get web-accessible URI for cached media
const uri = await window.mediaManager.getMediaUri('video.mp4');

// Get cache statistics
const stats = window.mediaManager.getStats();

// Clear entire cache
await window.mediaManager.clearCache();
```

**Storage Location**:
- Files are stored in: `ecless/media/cache/`
- Uses Capacitor's `Directory.Documents` by default
- On Android: `/storage/emulated/0/Documents/ecless/media/cache/`
- On iOS: App's Documents directory

### 2. Slot Media Handler (`slot-media.js`)

**Purpose**: Renders media slots from XML layout data.

**Mobile vs Desktop Handling**:
```javascript
if (window.mediaManager) {
    // MOBILE MODE: Use media manager
    const exists = await window.mediaManager.checkMediaExists(filename);
    if (!exists) {
        await window.mediaManager.downloadMedia(url, filename);
    }
    const uri = await window.mediaManager.getMediaUri(filename);
    
} else if (typeof ipcRenderer !== 'undefined') {
    // DESKTOP MODE: Use Electron IPC
    ipcRenderer.invoke('app-downloadmedia', { mediaURL, mediaPathSrc });
    
} else {
    // FALLBACK: Stream directly from server
    const uri = serverURL;
}
```

**Supported Media Types**:
- Images: PNG, JPG, JPEG, BMP, GIF, WEBP
- Videos: MP4, WEBM, MKV
- Streaming: M3U8, M3U (HLS streams)
- CCTV: FLV streams
- YouTube: Embedded player

### 3. Enhanced Filesystem Shim (`mobile-electron-shim.js`)

**Purpose**: Provides Node.js fs-like API using Capacitor underneath.

**Important Changes**:
- All synchronous methods (e.g., `fs.existsSync`) are deprecated
- New async methods provided: `fs.existsAsync()`, `fs.readFileAsync()`, etc.
- Synchronous methods return stubs with warnings

**Migration Example**:
```javascript
// OLD (Desktop/Electron)
if (fs.existsSync(path)) {
    const data = fs.readFileSync(path, 'utf8');
}

// NEW (Mobile)
if (await fs.existsAsync(path)) {
    const data = await fs.readFileAsync(path, 'utf8');
}
```

### 4. Dashboard Media Cache UI (`dashboard.html`)

**Purpose**: Visual management interface for media cache.

**Features**:
- View cache statistics (file count, size, hits, downloads)
- List all cached files with sizes
- Delete individual files
- Clear entire cache
- Real-time refresh

**Access**: Open Dashboard → Media Cache Manager section (mobile only)

## How Media Playback Works

### 1. XML Layout Parsing

When the player receives XML from the server:
```xml
<media duration="10">
    <![CDATA[{media/video.mp4}]]>
</media>
```

### 2. Media Download Process

```
1. Extract filename: "video.mp4"
2. Build server URL: "https://server.com/20/media/video.mp4"
3. Check if cached: await mediaManager.checkMediaExists("video.mp4")
4. If not cached:
   a. Download using CapacitorHttp/fetch
   b. Convert to base64 (for native apps)
   c. Save to filesystem: ecless/media/cache/video.mp4
   d. Add to cache index
5. Get web-accessible URI: await mediaManager.getMediaUri("video.mp4")
6. Returns data URI: "data:video/mp4;base64,..."
```

### 3. Media Display

The URI is injected into HTML:
```html
<!-- Image -->
<img src="data:image/jpeg;base64,/9j/4AAQ..." />

<!-- Video -->
<video>
    <source src="data:video/mp4;base64,AAAAGG..." type="video/mp4" />
</video>
```

### 4. Caching Benefits

- **Offline Playback**: Media plays without internet connection
- **Faster Loading**: No network latency for cached files
- **Reduced Bandwidth**: Files downloaded once, reused many times
- **Better Performance**: Local files load instantly

## Troubleshooting

### Problem: Media Not Displaying

**Symptoms**: Empty slots, broken images, black video screens

**Solutions**:
1. Check if media manager is initialized:
   ```javascript
   console.log(window.mediaManager?.initialized);
   ```

2. Check cache contents in Dashboard → Media Cache Manager

3. Check browser console for download errors:
   ```
   MediaManager: Download error: HTTP 404
   MediaManager: Filesystem API not available
   ```

4. Verify server URL in config:
   ```javascript
   console.log(config.hostserver);
   ```

5. Check network connectivity:
   - Try opening server URL in mobile browser
   - Verify firewall/CORS settings on server

### Problem: Downloads Failing

**Symptoms**: "Download failed" errors, 0 cached files

**Common Causes**:
1. **CORS Issues**: Server must allow requests from `https://app.ecless.local`
   - Add CORS headers to server
   - Or use `capacitor.config.json` server settings

2. **Network Timeout**: Large files may timeout
   - Check `connectTimeout` (30s) and `readTimeout` (60s) in media manager
   - Increase if needed for slow connections

3. **Storage Permissions**: App needs storage permissions
   - Check Android manifest permissions
   - Request storage permissions at runtime

4. **Invalid URLs**: Malformed media URLs
   - Check XML data for correct media paths
   - Verify server path structure

### Problem: Cache Growing Too Large

**Solutions**:
1. Clear cache manually via Dashboard
2. Implement automatic cache cleanup:
   ```javascript
   // Clear cache older than 7 days
   const maxAge = 7 * 24 * 60 * 60 * 1000;
   // Implementation in media manager
   ```

3. Set cache size limits in media manager

### Problem: Videos Not Playing

**Symptoms**: Videos download but won't play

**Solutions**:
1. Check video codec compatibility:
   - H.264 (MP4) - ✅ Widely supported
   - VP8/VP9 (WebM) - ✅ Most devices
   - H.265 (HEVC) - ⚠️ Limited support

2. Verify data URI size limits:
   - Most browsers: ~50-100 MB
   - For large videos, use blob URLs instead

3. Check VideoJS initialization:
   ```javascript
   videoJSPlayer[id] = videojs('video-' + id);
   ```

## Performance Optimization

### 1. Preload Critical Media

Download commonly used media during app initialization:
```javascript
window.addEventListener('appReady', async () => {
    await mediaManager.downloadMedia(logoUrl, 'logo.png');
    await mediaManager.downloadMedia(splashUrl, 'splash.jpg');
});
```

### 2. Batch Downloads

Download multiple files in parallel:
```javascript
const downloads = files.map(file => 
    mediaManager.downloadMedia(file.url, file.name)
);
await Promise.all(downloads);
```

### 3. Progressive Loading

Show placeholders while media downloads:
```javascript
element.innerHTML = '<div class="loading">Loading media...</div>';
const uri = await mediaManager.getMediaUri(filename);
element.innerHTML = `<img src="${uri}" />`;
```

### 4. Compression

Use compressed formats:
- Images: JPEG with 80% quality, WebP
- Videos: H.264 with moderate bitrate (1-2 Mbps)

## API Reference

### MobileMediaManager Class

```javascript
class MobileMediaManager {
    // Initialize manager
    async initialize(): Promise<boolean>
    
    // Check if file exists in cache
    async checkMediaExists(filename: string): Promise<boolean>
    
    // Download media from URL
    async downloadMedia(url: string, filename: string): Promise<object>
    
    // Get web-accessible URI for cached file
    async getMediaUri(filename: string): Promise<string|null>
    
    // Get cache statistics
    getStats(): object
    
    // Get list of cached files
    async getCachedFiles(): Promise<array>
    
    // Clear entire cache
    async clearCache(): Promise<boolean>
    
    // Delete specific file
    async deleteFile(filename: string): Promise<boolean>
    
    // Get total cache size in bytes
    async getCacheSize(): Promise<number>
}
```

### Statistics Object

```javascript
{
    totalDownloads: number,        // Total download attempts
    successfulDownloads: number,   // Successful downloads
    failedDownloads: number,       // Failed downloads
    cacheHits: number,             // Cache hit count
    cacheMisses: number,           // Cache miss count
    cachedFilesCount: number,      // Current cached files
    activeDownloads: number        // Ongoing downloads
}
```

## Migration from Electron

### Code Changes Required

1. **Remove Electron Dependencies**:
   ```javascript
   // REMOVE
   const { ipcRenderer, remote } = require('electron');
   const fs = require('fs');
   const path = require('path');
   ```

2. **Use Media Manager Instead**:
   ```javascript
   // OLD
   ipcRenderer.invoke('app-downloadmedia', { mediaURL, mediaPathSrc });
   
   // NEW
   await window.mediaManager.downloadMedia(mediaURL, filename);
   ```

3. **Replace Sync FS Operations**:
   ```javascript
   // OLD
   if (fs.existsSync(path)) { ... }
   
   // NEW
   if (await window.mediaManager.checkMediaExists(filename)) { ... }
   ```

4. **Update File Paths**:
   ```javascript
   // OLD
   const localPath = homedir + '/clessapp/res/' + filename;
   
   // NEW
   const uri = await window.mediaManager.getMediaUri(filename);
   ```

## Future Enhancements

1. **Smart Caching**: LRU (Least Recently Used) cache eviction
2. **Background Sync**: Download media in background when on WiFi
3. **Compression**: On-the-fly image/video compression
4. **Thumbnail Generation**: Create thumbnails for faster preview
5. **Delta Updates**: Only download changed files
6. **CDN Integration**: Support multiple media servers

## Support

For issues or questions:
- Check mobile app logs in Debug Panel
- Review cache statistics in Dashboard
- Contact: sales@closed-loop.biz
- Documentation: /mobile/docs_mobile/

---

Last Updated: December 2024
Version: 2.8.0
