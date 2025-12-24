# Media Import Directory Fix

## Issue Description
The mobile media import feature was writing files to the wrong directory, causing imported media files to be inaccessible by the media manager.

### Problem
- **MediaImportManager** was writing files to: `assets/media/`
- **MediaManager** was reading files from: `ecless/media/cache/`
- This mismatch caused imported files to never be found when the player tried to display them

### Evidence from Logs
```
# Import writes to wrong location:
MediaImportManager: File written to assets/media/6E.png

# Manager looks in correct location:
Filesystem stat: {"path":"ecless/media/cache/SQ.png","directory":"DATA"}
```

## Solution Implemented

### Changes Made to `mobile-media-import.js`

1. **Updated Cache Directory** (Line 22)
   - **Before:** `this.mediaDir = 'assets/media';`
   - **After:** `this.mediaDir = 'ecless/media/cache';`
   - **Impact:** All imported files now go to the same directory as MediaManager expects

2. **Removed Unused Property** (Line 22)
   - **Removed:** `this.wwwMediaDir = 'www/assets/media';`
   - **Reason:** This property was never used and referenced the wrong path

3. **Updated Documentation** (Lines 1-12)
   - Updated module documentation to reflect correct cache directory path
   - Added note about MediaManager integration
   - Clarified that the directory is shared between both modules

4. **Updated Method Comments**
   - `ensureMediaDirectory()` now clarifies it's a "media cache directory (shared with MediaManager)"
   - Consistent use of "cache" terminology throughout

5. **Added Cache Synchronization** (Lines 252-260)
   - After successful imports, the MediaManager cache index is automatically reloaded
   - This ensures imported files are immediately available for use
   - Graceful error handling if MediaManager is not available

6. **Updated Log Messages**
   - Changed "Media directory" to "Cache directory" for consistency
   - Changed "File written to X" to "File written to cache: X"

## Benefits

1. **Immediate Availability**: Imported files are instantly available to the media player
2. **Consistency**: Both modules use the same directory structure
3. **Synchronization**: Cache index is automatically updated after imports
4. **Professional Architecture**: Clear separation of concerns with proper integration

## Testing Instructions

### Prerequisites
```bash
cd /home/clt-dev/app/ecless-player-electron/mobile
npm run open:android
```

### Test Case 1: Import Media Files
1. Open the mobile app
2. Tap the "Import Media" button (top-right corner)
3. Select multiple image/video files from device storage
4. Verify in logs:
   ```
   MediaImportManager: File written to cache: ecless/media/cache/filename.png
   MediaImportManager: Reloading MediaManager cache index...
   MediaManager: Loaded cache index with X files
   ```

### Test Case 2: Verify Media Accessibility
1. After importing files, check that files are in the correct directory:
   ```
   adb shell run-as biz.closedloop.ecless.player ls -la files/ecless/media/cache/
   ```
2. Create a layout in the CMS that references the imported media
3. Verify the media displays correctly in the player

### Test Case 3: Cache Synchronization
1. Import some media files
2. Open Chrome DevTools (chrome://inspect)
3. In console, run:
   ```javascript
   window.mediaManager.cachedFiles
   ```
4. Verify imported filenames are in the Set

### Test Case 4: Replace Existing Files
1. Import a file named `test.png`
2. Import another file with the same name
3. Verify the import result shows "X file(s) replaced"
4. Verify the new file overwrites the old one

## Expected Log Output

### Successful Import
```
MediaImportManager: 3 file(s) selected for import
MediaImportManager: Starting import of 3 file(s)
MediaImportManager: File written to cache: ecless/media/cache/image1.png
MediaImportManager: Successfully imported image1.png
MediaImportManager: File written to cache: ecless/media/cache/video1.mp4
MediaImportManager: Successfully imported video1.mp4
MediaImportManager: File written to cache: ecless/media/cache/image2.jpg
MediaImportManager: Successfully imported image2.jpg
MediaImportManager: Import completed: {success: 3, failed: 0, replaced: 0}
MediaImportManager: Reloading MediaManager cache index...
MediaManager: Loaded cache index with 3 files
MediaImportManager: MediaManager cache reloaded successfully
```

## Files Modified
- `/home/clt-dev/app/ecless-player-electron/mobile/www/assets/js/mobile/mobile-media-import.js`

## Verification Checklist
- [x] Directory mismatch fixed (both modules use `ecless/media/cache`)
- [x] Unused property removed (`wwwMediaDir`)
- [x] Documentation updated to reflect correct paths
- [x] Cache synchronization implemented
- [x] Log messages updated for consistency
- [x] No syntax errors in modified file
- [ ] Tested on Android device
- [ ] Tested media import functionality
- [ ] Verified imported media displays in player
- [ ] Verified cache synchronization works

## Related Files
- **Media Manager**: `/home/clt-dev/app/ecless-player-electron/mobile/www/assets/js/mobile/mobile-media-manager.js`
- **Main HTML**: `/home/clt-dev/app/ecless-player-electron/mobile/www/index.html` (import button on line 395)

## Next Steps
1. Build and deploy the updated app to your test device
2. Run through all test cases above
3. Monitor logs during import process
4. Verify media displays correctly in layouts
5. Update this document with test results

## Notes
- This fix aligns the mobile app's media handling with the architecture of the desktop Electron app
- The cache directory structure (`ecless/media/cache`) provides clear separation from the app's bundled assets
- Auto-reloading the cache index prevents the need for app restarts after imports
