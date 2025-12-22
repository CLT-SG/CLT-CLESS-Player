## Fix: Mobile HTML Slot Positioning with iframe Implementation

Addresses an issue where HTML slots on mobile displayed in full-screen mode instead of respecting the position and dimensions defined in the layout XML. This change replaces the InAppBrowser approach with standard HTML iframes that properly embed content within slot boundaries.

## Issues Fixed

1. HTML slots opened in full-screen overlay ignoring layout XML positioning (top, left) and dimensions (width, height)
2. InAppBrowser plugin dependency added unnecessary complexity and did not support inline embedding
3. Multiple HTML slots could not display simultaneously as each opened in full-screen mode
4. Desktop webview behavior was inconsistent with mobile full-screen approach

## Technical Changes

1. Replace InAppBrowser with standard HTML iframe element for mobile HTML slots
2. iframe inherits positioning and dimensions from slot container CSS applied by layoutxml.js
3. Add platform detection to use iframe on mobile and webview on desktop Electron app
4. Remove InAppBrowser plugin imports and dependencies from capacitor-core.js and package.json
5. Add defensive coding with null checks and error handling to both mobile and desktop slot-html.js
6. Configure iframe with appropriate permissions (allowfullscreen, geolocation, camera, etc.)

## Files Changed Summary

**Mobile App:**
- mobile/www/assets/js/slot-html.js - Replace InAppBrowser with iframe, add platform detection and error handling
- mobile/www/assets/js/mobile/capacitor-core.js - Remove InAppBrowser imports and exports
- mobile/www/index.html - Remove mobile-html-manager.js script reference
- mobile/package.json - Remove @capgo/inappbrowser dependency

**Desktop App:**
- src/assets/js/slot-html.js - Add defensive coding and error handling while maintaining webview

**Documentation:**
- mobile/docs_mobile/HTML-SLOT-IFRAME-SOLUTION.md - Complete implementation guide with positioning details

## Testing

- Verified iframe respects slot positioning (top, left) and dimensions (width, height) from layout XML
- Confirmed autoscale calculations apply correctly to iframe containers
- Tested multiple HTML slots displaying simultaneously in different positions
- Ensured desktop webview functionality remains unchanged

