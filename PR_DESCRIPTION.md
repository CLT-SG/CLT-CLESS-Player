## Fix: Mobile Table Column Images with Base64 Support

Addresses an issue where table column images on mobile failed to load properly. This change implements proper media manager integration with base64 encoding and batch preloading for table slot images, matching the optimization already present in media slots.

## Issues Fixed

1. Table column images attempted to use desktop file system methods (fs.existsSync) on mobile, causing "file not found" errors
2. Images were not cached or converted to base64 format, leading to display failures
3. Sequential image loading caused performance issues with multiple images per column
4. No support for external URLs (http/https) in table column images
5. Platform detection logic failed due to incorrect ipcRenderer check

## Technical Changes

1. Remove desktop-specific code from mobile slot-table.js (fs.existsSync, file path handling)
2. Implement media manager integration with getMediaUriSmart() for base64/cached image URIs
3. Add batch preloading system for table column images (parallel downloads up to 5 concurrent)
4. Add isExternalMediaUrl() helper function for detecting external http/https URLs
5. Implement proper async/await support by converting forEach loops to for...of loops
6. Add comprehensive error handling with server URL fallbacks
7. Support comma-separated image lists (image:pic1.jpg,pic2.jpg,http://example.com/pic3.jpg)
8. Add in-memory URI caching to prevent repeated base64 conversions

## Files Changed Summary

**Mobile App:**
- mobile/www/assets/js/slot-table.js - Remove desktop mode, add media manager integration, batch preloading, external URL support

## Testing

- Verified local images load correctly via media manager with base64 encoding
- Confirmed external URLs (http/https) display directly without caching
- Tested batch preloading improves loading performance for multiple images
- Ensured comma-separated image lists work with rotation/cycling
- Verified error handling falls back to server URLs when cache fails

