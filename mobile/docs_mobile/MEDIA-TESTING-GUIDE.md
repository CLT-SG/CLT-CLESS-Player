# Mobile Media Playback - Quick Testing Guide

## Prerequisites

1. Build the mobile app:
   ```bash
   cd mobile
   npm run build
   npm run sync:android
   ```

2. Open in Android Studio:
   ```bash
   npm run open:android
   ```

3. Connect Android device or start emulator

## Testing Checklist

### ✅ 1. Media Manager Initialization

**Test**: Open app and check console
```javascript
// In Chrome DevTools (chrome://inspect)
window.mediaManager.initialized
// Expected: true

window.mediaManager.getStats()
// Expected: { totalDownloads: 0, successfulDownloads: 0, ... }
```

**Pass Criteria**: Media manager initializes without errors

---

### ✅ 2. Image Download and Display

**Test**: Load layout with image media

**Expected Behavior**:
1. Console shows: `[mediaFunc] Mobile mode: Using media manager for image.jpg`
2. Console shows: `MediaManager: Downloading https://server.com/.../image.jpg`
3. Console shows: `MediaManager: Successfully downloaded and saved: image.jpg`
4. Image displays in slot

**Verification**:
```javascript
// Check if image was cached
await window.mediaManager.checkMediaExists('image.jpg')
// Expected: true

// Get cached files
await window.mediaManager.getCachedFiles()
// Expected: [{ name: 'image.jpg', size: 12345, ... }]
```

**Pass Criteria**: Images download, cache, and display correctly

---

### ✅ 3. Video Download and Playback

**Test**: Load layout with MP4/WebM video

**Expected Behavior**:
1. Video downloads to cache (check console logs)
2. VideoJS player initializes with data URI
3. Video plays automatically
4. Video controls work (if enabled)

**Verification**:
```javascript
// Check video in cache
await window.mediaManager.checkMediaExists('video.mp4')
// Expected: true

// Check VideoJS player
Object.keys(videoJSPlayer)
// Expected: [array of player IDs]
```

**Common Issues**:
- Video shows black screen → Check codec (use H.264)
- Video won't play → Check data URI size limit
- Video downloads but doesn't display → Check console for errors

**Pass Criteria**: Videos download, cache, and play smoothly

---

### ✅ 4. Streaming Content (M3U8/HLS)

**Test**: Load layout with streaming URL

**Expected Behavior**:
1. Stream URL is NOT cached (streams directly)
2. VideoJS player loads HLS stream
3. Stream plays continuously

**Verification**:
```javascript
// Streaming URLs should NOT be in cache
await window.mediaManager.checkMediaExists('stream.m3u8')
// Expected: false (streaming files are not cached)
```

**Pass Criteria**: Streaming content plays without caching

---

### ✅ 5. Cache Persistence

**Test**: Close and reopen app

**Steps**:
1. Load layout with media (images/videos download)
2. Close app completely
3. Disconnect internet
4. Reopen app
5. Load same layout

**Expected Behavior**:
- Media displays immediately without downloading
- Console shows: `[mediaFunc] Media cached: image.jpg`
- No network requests for cached media

**Pass Criteria**: Cached media persists and loads offline

---

### ✅ 6. Dashboard Media Manager

**Test**: Open Dashboard → Media Cache Manager

**Expected Display**:
- Cached Files count (e.g., "5")
- Cache Size (e.g., "12.5 MB")
- Cache Hits (increments on repeated loads)
- Downloads count
- Table of cached files with names and sizes

**Actions to Test**:
1. Click **Refresh** → Stats update
2. Click **Delete** on a file → File removed, stats update
3. Click **Clear Cache** → All files removed, counts reset to 0

**Pass Criteria**: Dashboard shows accurate cache information and actions work

---

### ✅ 7. Error Handling

**Test**: Simulate download failures

**Scenarios**:

**A. Invalid URL**
- Use non-existent media file in XML
- Expected: Error notification appears
- Expected: App continues, doesn't crash
- Expected: Fallback to server URL (streaming)

**B. Network Offline**
- Turn off WiFi/mobile data during download
- Expected: Download fails gracefully
- Expected: Error notification shows
- Expected: Cached media still works

**C. Large File Timeout**
- Use very large video file (>100MB)
- Expected: Download may timeout (60s)
- Expected: Error shown, can retry

**Pass Criteria**: Errors are caught, notifications shown, app remains stable

---

### ✅ 8. Media Rotation/Looping

**Test**: Layout with multiple media files in one slot

**Expected Behavior**:
1. All media files download in sequence
2. First media displays
3. After duration, switches to next media
4. Loops back to first media after last one
5. No flashing or broken images during transitions

**Pass Criteria**: Media rotation works smoothly with cached files

---

### ✅ 9. Memory and Performance

**Test**: Load layout with many media slots

**Monitor**:
```javascript
// Check cache size
await window.mediaManager.getCacheSize()
// Expected: Reasonable size (< device storage)

// Check stats
window.mediaManager.getStats()
// Expected: successfulDownloads matches file count
// Expected: failedDownloads = 0 (ideally)

// Check active downloads
stats.activeDownloads
// Expected: 0 when idle, >0 during downloads
```

**Performance Checks**:
- App doesn't freeze during downloads
- UI remains responsive
- Media displays without lag
- Memory usage is stable (check Android Studio Profiler)

**Pass Criteria**: App performs well with multiple media files

---

### ✅ 10. Different Media Types

**Test Matrix**:

| Media Type | Format | Test Status | Notes |
|------------|--------|-------------|-------|
| Image | PNG | ⬜ | Should cache and display |
| Image | JPG | ⬜ | Should cache and display |
| Image | GIF | ⬜ | Should cache and animate |
| Video | MP4 (H.264) | ⬜ | Should cache and play |
| Video | WebM (VP8) | ⬜ | Should cache and play |
| Stream | M3U8 (HLS) | ⬜ | Should stream (no cache) |
| Stream | FLV | ⬜ | Should use FLV.js player |
| YouTube | Embed | ⬜ | Should embed iframe |

**Pass Criteria**: All supported formats work correctly

---

## Common Issues and Solutions

### Issue: "MediaManager not initialized"

**Solution**:
```javascript
// Manually initialize
await window.mediaManager.initialize();
```

### Issue: "Capacitor API not available"

**Solution**:
- Ensure running on device/emulator, not in browser
- Check `capacitor-core.bundle.js` is loaded
- Wait for `capacitorReady` event

### Issue: Images/videos don't display

**Debug Steps**:
```javascript
// 1. Check if media manager exists
console.log('Media Manager:', window.mediaManager);

// 2. Check if file was downloaded
await window.mediaManager.checkMediaExists('file.jpg');

// 3. Get URI
const uri = await window.mediaManager.getMediaUri('file.jpg');
console.log('URI:', uri);

// 4. Check stats for errors
console.log('Stats:', window.mediaManager.getStats());
```

### Issue: Downloads fail with CORS error

**Solution**:
- Server must allow CORS from `https://app.ecless.local`
- Add headers to server:
  ```
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET
  ```

### Issue: Cache size grows too large

**Solution**:
```javascript
// Clear cache via dashboard or programmatically
await window.mediaManager.clearCache();

// Or delete old files
const files = await window.mediaManager.getCachedFiles();
for (const file of files) {
    await window.mediaManager.deleteFile(file.name);
}
```

---

## Debugging Tools

### Chrome DevTools Remote Debugging

1. Connect Android device via USB
2. Enable USB debugging on device
3. Open Chrome: `chrome://inspect`
4. Click "Inspect" on your app
5. Use Console to run commands

### Debug Panel (In-App)

- Tap "🐛 Debug" button in top-right
- View console logs
- Check configuration
- Test media manager functions

### Logging

Enable verbose logging:
```javascript
// In browser console
localStorage.setItem('debug', 'true');
window.location.reload();
```

---

## Performance Benchmarks

**Target Metrics**:
- Image download: < 2s for < 1MB file
- Video download: < 10s for < 10MB file
- Cache check: < 50ms
- URI retrieval: < 100ms
- App startup: < 3s with cached media

**Monitor**:
```javascript
// Measure download time
const start = Date.now();
await window.mediaManager.downloadMedia(url, filename);
const elapsed = Date.now() - start;
console.log('Download took:', elapsed, 'ms');
```

---

## Success Criteria Summary

✅ All media types download successfully
✅ Files persist in cache across app restarts
✅ Cached media displays correctly
✅ Offline mode works with cached files
✅ Dashboard shows accurate cache info
✅ Error handling works gracefully
✅ No memory leaks or performance issues
✅ Media rotation/looping works smoothly

---

## Report Issues

If tests fail, gather:
1. Android/iOS version
2. Device model
3. Console logs (from Chrome DevTools)
4. Cache statistics (`window.mediaManager.getStats()`)
5. Server configuration (CORS, HTTPS, etc.)
6. Media file details (format, size, URL)

Contact: sales@closed-loop.biz

---

Last Updated: December 2024
