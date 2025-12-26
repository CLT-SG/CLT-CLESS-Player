# Image Display Fix - Base64 Data URL Issue

## Issue Summary
Images downloaded and cached in the mobile app were not displaying correctly. The base64 data URLs generated from cached files were corrupted, causing image load errors in both slot-media.js and slot-table.js.

## Root Cause
The Capacitor Filesystem API was not correctly encoding/decoding base64 data because:
1. **Missing encoding parameter in writeFile**: When writing base64 data to filesystem, the `encoding: Encoding.Base64` parameter was not specified
2. **No validation**: Base64 data was not validated after read/write operations
3. **Poor error logging**: When images failed to load, there was insufficient diagnostic information

## Files Modified

### 1. `/mobile/www/assets/js/mobile/capacitor-core.js`
**Changes:**
- **writeFile method (lines ~203-221)**: Added proper encoding parameter when writing base64 data
  ```javascript
  // CRITICAL: Specify encoding when writing base64 data
  if (dataType === 'base64') {
      writeParams.encoding = Encoding.Base64;
      console.log(`[CapacitorAPI] Writing with Base64 encoding: ${path}`);
  }
  ```

- **readFile method (lines ~134-152)**: Added base64 validation after reading
  ```javascript
  // Validate base64 data if encoding was requested
  if (encoding === 'base64' && result.data) {
      const isValid = this._validateBase64(result.data);
      if (!isValid) {
          console.warn(`[CapacitorAPI] Warning: Base64 data may be corrupted for ${path}`);
      }
  }
  ```

- **New method _validateBase64** (lines ~274-284): Added helper to validate base64 format
  ```javascript
  _validateBase64(base64) {
      if (!base64 || typeof base64 !== 'string') return false;
      const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
      return base64Pattern.test(base64) && base64.length % 4 === 0;
  }
  ```

### 2. `/mobile/www/assets/js/mobile/mobile-media-manager.js`
**Changes:**
- **_performImageDownload method (lines ~376-400)**: Added comprehensive base64 validation
  ```javascript
  // Validate base64 data
  const base64Data = readResult.data;
  if (!this._validateImageBase64(base64Data, ext)) {
      console.error('[MediaManager] Base64 validation failed for:', safeFilename);
      throw new Error('Invalid base64 data - possible corruption during write/read');
  }
  
  // Additional validation: Check data URL format
  if (!dataUrl.startsWith('data:image/')) {
      throw new Error(`Invalid data URL format. MIME: ${mimeType}`);
  }
  ```

- **New method _validateImageBase64** (lines ~1125-1215): Added robust validation checking file format headers
  - Validates PNG header: `0x89504E47` (‰PNG)
  - Validates JPEG header: `0xFFD8FF`
  - Validates GIF header: `GIF87a` or `GIF89a`
  - Validates WEBP header: `RIFF...WEBP`
  - Provides detailed error messages when validation fails

### 3. `/mobile/www/assets/js/slot-media.js`
**Changes:**
- **appendMediaElement - img.onerror handler (lines ~664-695)**: Added comprehensive base64 diagnostics
  ```javascript
  // Enhanced diagnostics for base64 data URLs
  if (asset.contentUrl && asset.contentUrl.startsWith('data:')) {
      const parts = asset.contentUrl.split(',');
      const header = parts[0];
      const base64Data = parts[1] || '';
      
      console.error('[appendMediaElement] Data URL header:', header);
      console.error('[appendMediaElement] Base64 length:', base64Data.length, 'chars');
      console.error('[appendMediaElement] Base64 preview (first 100):', base64Data.substring(0, 100));
      
      // Check for common issues and log file header bytes
      try {
          const decoded = atob(base64Data.substring(0, 24));
          const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
          console.error('[appendMediaElement] First 8 bytes (hex):', 
              Array.from(bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      } catch (e) {
          console.error('[appendMediaElement] ERROR: Failed to decode base64:', e.message);
      }
  }
  ```

### 4. `/mobile/www/assets/js/slot-table.js`
**Changes:**
- **appendColumnImage - img.onerror handler (lines ~602-622)**: Added similar base64 diagnostics for table images
  ```javascript
  // Enhanced diagnostics for base64 data URLs
  if (img.src && img.src.startsWith('data:')) {
      const parts = img.src.split(',');
      const header = parts[0];
      const base64Data = parts[1] || '';
      
      console.error('[appendColumnImage] Data URL header:', header);
      console.error('[appendColumnImage] Base64 length:', base64Data.length, 'chars');
      console.error('[appendColumnImage] Base64 preview (first 100):', base64Data.substring(0, 100));
  }
  ```

## Technical Details

### Base64 Encoding in Capacitor Filesystem API
The Capacitor Filesystem API requires explicit encoding specification:
- **Writing binary data**: Must set `encoding: Encoding.Base64` when writing base64 strings
- **Reading binary data**: Must set `encoding: Encoding.Base64` when reading as base64
- **Without encoding parameter**: Data may be corrupted or double-encoded

### Image Format Validation
Images are validated by checking file format "magic bytes" (file signatures):
- **PNG**: Starts with `89 50 4E 47` (decimal: 137, 80, 78, 71)
- **JPEG**: Starts with `FF D8 FF`
- **GIF**: Starts with "GIF87a" or "GIF89a"
- **WEBP**: Contains "RIFF" at start and "WEBP" at byte 8

## Testing Steps

1. **Clear existing cache**:
   ```javascript
   await window.mediaManager.clearCache();
   ```

2. **Reload layout with images**: The app should download and cache images with proper base64 encoding

3. **Check logs**: Should see:
   ```
   [CapacitorAPI] Writing with Base64 encoding: ecless/media/cache/Departure_Icon.png
   [CapacitorAPI] ✓ File written successfully: ecless/media/cache/Departure_Icon.png | Data Type: base64
   [MediaManager] ✓ Valid PNG header detected
   [MediaManager] ✓ Image successfully cached as base64: Departure_Icon.png | MIME: image/png
   ```

4. **Verify image display**: Images should load without errors in:
   - Media slots (slot-media.js)
   - Table cells (slot-table.js)

## Expected Behavior After Fix

✅ Images download correctly from server
✅ Base64 data is written with proper encoding
✅ Base64 data is read back correctly
✅ Image format headers are validated
✅ Data URLs are created with proper MIME types
✅ Images display correctly in media slots
✅ Images display correctly in table cells
✅ Comprehensive error logging for troubleshooting

## Error Diagnostics

If image still fails to load, check the logs for:
1. **Invalid base64 characters**: `ERROR: Invalid base64 characters detected`
2. **Wrong file format**: `✗ Invalid PNG header. Expected: 89504E47, Got: ...`
3. **Empty data**: `ERROR: Empty base64 data!`
4. **Decoding failure**: `ERROR: Failed to decode base64: ...`

## Build and Deploy

After applying these fixes:
```bash
cd /home/clt-dev/app/ecless-player-electron/mobile
npm run sync:android
```

Then open Android Studio and run/debug the app to test the fixes.

## Related Documentation
- [BLOB-STORAGE-OPTIMIZATION.md](./BLOB-STORAGE-OPTIMIZATION.md) - Original blob storage implementation
- [IMAGE-BASE64-IMPLEMENTATION.md](./IMAGE-BASE64-IMPLEMENTATION.md) - Base64 image strategy
- [MEDIA-IMPORT-FIX.md](./MEDIA-IMPORT-FIX.md) - Media import system

## Date
2025-12-26

## Author
GitHub Copilot (Claude Sonnet 4.5)
