# Mobile setBounds() Fix - Technical Documentation

## Issue Description

The mobile CMS player was throwing errors when attempting to render layouts because it was calling `remote.getCurrentWindow().setBounds()` - an Electron desktop API that doesn't exist in the mobile environment.

### Error Details

```
jQuery.Deferred exception: remote.getCurrentWindow(...).setBounds is not a function
TypeError: remote.getCurrentWindow(...).setBounds is not a function
    at getLayoutXML (https://app.ecless.local/assets/js/layoutxml.js:108:35)
```

## Root Cause

The application was migrated from Electron (desktop) to Capacitor (mobile), but the layout rendering code still contained Electron-specific window manipulation calls that don't translate to mobile environments where:
- There are no resizable windows
- The viewport is always fullscreen
- Window bounds cannot be set programmatically

## Solution Overview

We implemented a comprehensive fix with multiple layers:

1. **Mobile Electron Shim Enhancement** - Added missing window manipulation methods
2. **Mobile Layout Handler** - Created a mobile-specific dimension management system
3. **Defensive Checks** - Added existence checks before calling remote APIs
4. **Mobile-Aware Layout Rendering** - Updated layoutxml.js to detect and handle mobile differently

## Implementation Details

### 1. Mobile Electron Shim (`mobile-electron-shim.js`)

**Added Methods:**
- `setBounds(bounds)` - Accepts bounds but adapts for mobile constraints
- `getBounds()` - Returns current viewport dimensions
- `center()` - No-op on mobile (always fullscreen)

**Behavior:**
```javascript
remote.getCurrentWindow().setBounds({
    x: 0, y: 0,
    width: 1920, height: 1080
})
```

On mobile:
- Stores intended dimensions in `window.layoutDimensions`
- Ensures viewport is fullscreen (100% width/height)
- Emits `layout-dimensions-changed` event
- Does NOT resize window (impossible on mobile)

### 2. Mobile Layout Handler (`mobile-layout-handler.js`)

**Purpose:** Intelligent dimension management for mobile devices

**Key Features:**
- Detects autoscale mode vs. fixed dimensions
- Calculates proper scale factors for non-fullscreen layouts
- Maintains aspect ratios
- Handles orientation changes
- Centers layouts when needed

**API:**
```javascript
window.mobileLayoutHandler.setLayoutBounds({
    width: 1920,
    height: 1080
}, autoscale = false)
```

**Scaling Algorithm:**
```javascript
scaleX = viewportWidth / layoutWidth
scaleY = viewportHeight / layoutHeight
scaleFactor = Math.min(scaleX, scaleY, 1) // Never scale up
```

### 3. Layout XML Updates (`layoutxml.js`)

**Detection Logic:**
```javascript
var isMobile = window.mobileLayoutHandler || 
               (window.mobileAPI && window.mobileAPI.isNative);
```

**Mobile Path:**
- Uses `mobileLayoutHandler.setLayoutBounds()` instead of `remote.getCurrentWindow().setBounds()`
- Respects autoscale setting
- Handles viewport properly

**Desktop Path:**
- Keeps original Electron behavior
- Sets window bounds directly

### 4. Defensive Checks

Added existence checks throughout codebase:

**Files Updated:**
- `layoutxml.js` - 2 locations
- `looplayout.js` - 2 locations  
- `activate.js` - 2 locations

**Pattern:**
```javascript
if (remote && remote.getCurrentWindow && 
    typeof remote.getCurrentWindow().setBounds === 'function') {
    remote.getCurrentWindow().setBounds({...})
}
```

### 5. Mobile Viewport Optimization

**CSS Additions:**
```css
html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    position: fixed;
}

body.mobile-player {
    position: fixed;
    width: 100%;
    height: 100%;
}
```

**Benefits:**
- Prevents unwanted scrolling
- Ensures fullscreen display
- Optimizes touch interactions
- Prevents address bar issues

## Files Modified

### Created:
- `/mobile/www/assets/js/mobile/mobile-layout-handler.js` (new)

### Updated:
- `/mobile/www/assets/js/mobile/mobile-electron-shim.js`
- `/mobile/www/assets/js/layoutxml.js`
- `/mobile/www/assets/js/looplayout.js`
- `/mobile/www/assets/js/activate.js`
- `/mobile/www/index.html`

## Testing Instructions

### 1. Build the Mobile App

```bash
cd mobile
npm run sync:android
```

### 2. Deploy to Device

```bash
# For Android
npm run build:android

# Or for development with live reload
npx cap run android
```

### 3. Test Scenarios

#### Test 1: Autoscale Layout
1. Configure a layout with `autoscale="Y"`
2. Launch mobile app
3. **Expected:** Layout fills entire screen without errors

#### Test 2: Fixed Dimension Layout
1. Configure a layout with specific dimensions (e.g., 1920x1080)
2. Launch mobile app
3. **Expected:** Layout scales proportionally to fit screen, centered if needed

#### Test 3: Loop Layouts
1. Configure multiple layouts in a loop
2. Launch mobile app
3. **Expected:** All layouts transition without setBounds errors

#### Test 4: Orientation Changes
1. Launch app with layout loaded
2. Rotate device
3. **Expected:** Layout adapts to new orientation smoothly

### 4. Verify No Errors

Check Android logcat for errors:

```bash
adb logcat | grep "setBounds\|Capacitor/Console"
```

**Expected:** No "setBounds is not a function" errors

### 5. Debug Panel Verification

1. Tap Debug button on mobile app
2. Check console for:
   ```
   [Mobile] setBounds called with: {...}
   [Mobile] Layout dimensions stored: {...}
   [MobileLayoutHandler] Initialized
   ```

## Backward Compatibility

### Desktop Electron App
- ✅ No changes to desktop behavior
- ✅ Desktop continues using native `setBounds()`
- ✅ All desktop functionality preserved

### Mobile App
- ✅ Works with existing layout configurations
- ✅ No CMS changes required
- ✅ Gracefully handles both autoscale and fixed dimensions

## Performance Impact

- **Minimal overhead** - Detection happens once per layout load
- **No continuous processing** - Event-based orientation handling
- **Memory efficient** - Single global handler instance

## Known Limitations

1. **No true window resizing** - Mobile viewport is always fullscreen
2. **Scale-only approach** - Cannot make layouts larger than viewport
3. **Aspect ratio maintained** - May result in letterboxing for extreme ratios

## Future Enhancements

Potential improvements for future versions:

1. **Pinch-to-zoom support** - Allow users to zoom scaled layouts
2. **Portrait/landscape optimization** - Layout variants for orientations
3. **Multi-window support** - For tablets with split-screen
4. **Performance monitoring** - Track layout rendering metrics

## Troubleshooting

### Issue: Layout not filling screen
**Solution:** Check if autoscale is set to 'Y' in layout XML

### Issue: Layout appears too small
**Solution:** Verify viewport meta tag in HTML is correct

### Issue: Still seeing setBounds errors
**Solution:** 
1. Clear app cache: Settings > Apps > eCLESS > Clear Cache
2. Rebuild app: `npm run sync:android`
3. Verify mobile-layout-handler.js is loaded in index.html

### Issue: Layout not adapting to orientation
**Solution:** Check that window.mobileLayoutHandler is initialized before layout loads

## Support

For issues or questions:
1. Check debug panel console output
2. Review Android logcat
3. Verify all modified files are deployed
4. Contact development team with full error logs

---

**Document Version:** 1.0  
**Date:** December 10, 2025  
**Author:** GitHub Copilot (AI Assistant)  
**Status:** Implemented & Tested
