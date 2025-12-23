# Quick Start: Media Import Feature

## For Users

### How to Import Media Files

1. **Open the app** and wait for it to load
2. **Swipe down** from the top edge if navigation is hidden
3. **Tap "Import Media"** button (purple button)
4. **Select files** from your device (images or videos)
5. **Wait** for import to complete
6. **Check notification** for results

### Supported Formats

**Images**: JPG, PNG, GIF, WebP, BMP  
**Videos**: MP4, WebM, OGG, MOV, AVI  
**Max Size**: 500 MB per file

---

## For Developers

### Quick Test Commands

```bash
# Navigate to mobile directory
cd /home/clt-dev/app/ecless-player-electron/mobile

# Sync changes to Android
npm run sync:android

# Open Android Studio to test
npm run open:android

# Build release APK
cd android && ./gradlew assembleRelease
```

### Testing Checklist

- [ ] Import single image file
- [ ] Import multiple image files
- [ ] Import video file
- [ ] Import mixed files (images + videos)
- [ ] Replace existing file (same filename)
- [ ] Try importing invalid file type (should fail)
- [ ] Try importing oversized file (should fail)
- [ ] Check progress dialog displays correctly
- [ ] Check success notification displays
- [ ] Verify files accessible in app
- [ ] Test with airplane mode (offline)

### Key Files Modified

```
✅ mobile/www/assets/js/mobile/mobile-media-import.js (NEW)
✅ mobile/www/index.html (button added + script included)
✅ src/assets/js/mobile/mobile-media-import.js (NEW - source copy)
✅ mobile/docs_mobile/MEDIA-IMPORT-FEATURE.md (NEW - documentation)
```

### Global API

```javascript
// Available globally after DOM loads
window.mediaImportManager

// Open file picker
await window.mediaImportManager.openFilePicker('all');
// or: 'image', 'video'

// Check stats
const stats = window.mediaImportManager.getStats();
console.log(stats);
// Output: { totalImports: 0, successfulImports: 0, failedImports: 0, replacedFiles: 0 }
```

### Debug in Browser Console

```javascript
// Initialize manually if needed
await window.mediaImportManager.initialize();

// Test import
await window.mediaImportManager.openFilePicker('image');

// Check if specific file exists
const exists = await window.mediaImportManager.checkFileExists('logo.png');
console.log('File exists:', exists);

// Get statistics
console.log(window.mediaImportManager.getStats());
```

### Console Logs to Monitor

```
=== MOBILE MEDIA IMPORT MANAGER: Initializing ===
MediaImportManager: Initializing...
MediaImportManager: Initialized successfully
MediaImportManager: 5 file(s) selected for import
MediaImportManager: Starting import of 5 file(s)
MediaImportManager: Successfully imported file.jpg
MediaImportManager: Successfully imported video.mp4 (replaced)
MediaImportManager: Import completed: { success: 5, failed: 0, ... }
```

### Common Issues

**Issue**: Button not visible  
**Fix**: Swipe down from top edge or check `#mobile-nav` in DevTools

**Issue**: Import fails silently  
**Fix**: Check browser console for errors, verify Capacitor API is loaded

**Issue**: Files not accessible after import  
**Fix**: Check Capacitor Filesystem permissions in AndroidManifest.xml

---

## Build and Deploy

### Development Build

```bash
cd /home/clt-dev/app/ecless-player-electron/mobile
npm run build:android
```

### Release Build

```bash
cd /home/clt-dev/app/ecless-player-electron/mobile/android
./gradlew assembleRelease
```

**Output**: `android/app/build/outputs/apk/release/app-release.apk`

### Install on Device

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## Feature Status

✅ **Completed**
- File picker integration
- Multi-file selection
- File validation (type, size)
- Progress feedback
- Success/error notifications
- File replacement detection
- Statistics tracking
- Documentation

🔄 **Future Enhancements**
- Media library browser
- File preview
- Cloud sync
- Batch operations
- Thumbnail generation

---

**Last Updated**: 2025-12-23
