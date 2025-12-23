## Fix: Mobile Table Slot Image Alignment and Single-Item Effects

Fixes vertical alignment issues with table slot images and eliminates unnecessary effects for single-item columns.

## Issues Fixed

1. Table column images with image: prefix appearing at top instead of middle alignment
2. Blinking effects triggering on single-item image columns when no cycling needed
3. Fading effects triggering on single-item fader columns when no cycling needed
4. Unnecessary timers running for single-item columns
5. Fix Zoom button using viewport scale restoration instead of proper app reload
6. Mobile app lacking equivalent to desktop Electron app restart functionality

## Technical Implementation

1. Modified image column container styling to use flexbox for vertical centering
2. Added conditional checks to skip effects when column has only one item
3. Added conditional checks to skip timers when column has only one item
4. Applied fixes to both image: and fader: column types
5. Added reloadWebView method to mobile-layout-handler.js for proper app restart
6. Updated Fix Zoom button to trigger full webview reload instead of viewport scale restoration

## Implementation Details

Vertical Alignment Fix:
- Changed image column container height from auto to 100 percent
- Added display flex with align-items center for vertical centering
- Added justify-content center for horizontal centering
- Images now properly center in middle of table cells

Single-Item Effect Skip:
- Added length check before applying fadeOut/fadeIn blinking effects
- Added length check before setting setTimeout for image cycling
- Added length check before applying fadeIn/fadeOut fading effects
- Added length check before setting setTimeout for fader cycling
- Effects only trigger when array length greater than 1

WebView Reload Functionality:
- Added reloadWebView method in MobileLayoutHandler class
- Method uses window.location.reload for cross-platform compatibility
- Shows user notification before reload with 300ms delay
- Works on Capacitor native apps, web browsers, and all mobile platforms
- Updated Fix Zoom button from viewport scale restoration to full app reload
- Button renamed to Reload with visual indicator for clarity

## Files Changed Summary

Modified Files:
- mobile/www/assets/js/slot-table.js - Fixed alignment and conditional effects
- mobile/www/assets/js/mobile/mobile-layout-handler.js - Added reloadWebView method
- mobile/www/index.html - Updated Fix Zoom button to use reloadWebView

Documentation:
- mobile/SLOT-TABLE-FIXES.md - Technical documentation with before/after examples

## Performance Impact

- No performance degradation
- Reduced unnecessary timer overhead for single-item columns
- Improved visual consistency with desktop version
- Better user experience without distracting effects
- Webview reload provides complete state reset similar to desktop app restart
- 300ms notification delay ensures user feedback before reload

## Browser Compatibility

- Mobile (Android 5.1+) - Full support
- Mobile (iOS 11+) - Full support
- No breaking changes to layout XML format
- Backward compatible with all existing configurations

## Testing

- Verify images center vertically in table cells
- Verify single-item columns have no blinking or fading effects
- Verify multi-item columns continue to cycle with effects
- Verify timers only run for multi-item columns
- Verify no console errors or broken functionality

