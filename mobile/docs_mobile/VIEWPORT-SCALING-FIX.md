# Mobile Viewport Auto-Scaling Implementation

## Overview
This document describes the implementation of automatic viewport scaling for non-autoscale layouts on mobile devices. This fix ensures that layouts with `autoscale="N"` render correctly on mobile devices without requiring manual adjustment of the `maximum-scale` value.

## Problem Statement
When the CMS layout has `autoscale="N"`, slot items were not aligning and sizing properly on mobile devices, even when the device resolution matched the layout resolution (e.g., 1080x1920). The hardcoded `maximum-scale=0.381` value in the viewport meta tag worked for specific devices but was not universal.

## Solution Architecture

### 1. Dynamic Viewport Scale Calculation
The solution automatically calculates the optimal `maximum-scale` value based on:
- Device screen dimensions (`window.screen.width` x `window.screen.height`)
- Layout design dimensions (from XML: `resolution` attribute)

**Formula:**
```javascript
scaleX = deviceWidth / layoutWidth
scaleY = deviceHeight / layoutHeight
optimalScale = Math.min(scaleX, scaleY)
```

### 2. Components Modified

#### A. Mobile Layout Handler (`mobile-layout-handler.js`)
**New Methods:**
- `calculateViewportScale(layoutWidth, layoutHeight)`: Calculates optimal scale
- `updateViewportScale(scale)`: Dynamically updates viewport meta tag
- `resetViewportScale()`: Resets viewport to default for autoscale mode

**Modified Methods:**
- `setLayoutBounds()`: Integrates viewport scaling based on autoscale setting
- `applyDimensionsToContainer()`: Adds CSS class for fixed layout mode

#### B. Index HTML (`index.html`)
**Changes:**
- Updated initial viewport meta tag to use `maximum-scale=1.0` (will be dynamically updated)
- Added CSS support for fixed-layout mode
- Added comment explaining dynamic viewport behavior

#### C. Layout XML Handler (`layoutxml.js`)
**No changes required** - Already passes autoscale flag to mobile layout handler

### 3. Behavior Flow

#### When `autoscale="Y"` (Fullscreen Mode):
1. Viewport meta tag is reset to `maximum-scale=1.0`
2. Main container uses `width: 100%` and `height: 100%`
3. Content fills entire viewport
4. `.fixed-layout` class is removed

#### When `autoscale="N"` (Fixed Layout Mode):
1. Optimal scale is calculated based on device and layout dimensions
2. Viewport meta tag is updated with calculated `maximum-scale`
3. Main container uses layout dimensions (e.g., `1080px x 1920px`)
4. `.fixed-layout` class is added
5. Browser automatically scales content to fit viewport

### 4. Example Calculations

**Example 1: 1080x1920 Layout on 1080x1920 Device**
```
Device: 1080 x 1920
Layout: 1080 x 1920
ScaleX: 1080 / 1080 = 1.0
ScaleY: 1920 / 1920 = 1.0
Optimal Scale: min(1.0, 1.0) = 1.0
Result: No scaling needed (perfect match)
```

**Example 2: 1080x1920 Layout on 2560x1440 Device (Tablet)**
```
Device: 2560 x 1440
Layout: 1080 x 1920
ScaleX: 2560 / 1080 = 2.370
ScaleY: 1440 / 1920 = 0.750
Optimal Scale: min(2.370, 0.750) = 0.750
Result: Content scaled down to 75% to fit height
```

**Example 3: 1920x1080 Layout on 1080x1920 Device (Orientation Mismatch)**
```
Device: 1080 x 1920
Layout: 1920 x 1080
ScaleX: 1080 / 1920 = 0.563
ScaleY: 1920 / 1080 = 1.778
Optimal Scale: min(0.563, 1.778) = 0.563
Result: Content scaled down to 56.3% to fit width
```

## Testing Guide

### Test Case 1: Standard Portrait Layout (1080x1920)
**Layout XML:**
```xml
<display resolution="1080x1920_portrait" autoscale="N">
```

**Expected Result:**
- Slots align perfectly with their specified coordinates
- No content clipping or overflow
- Text readable and proportional
- Media plays within slot boundaries

### Test Case 2: Landscape Layout (1920x1080)
**Layout XML:**
```xml
<display resolution="1920x1080_landscape" autoscale="N">
```

**Expected Result:**
- Layout rotates/scales appropriately
- All slots visible and positioned correctly

### Test Case 3: Autoscale Enabled
**Layout XML:**
```xml
<display resolution="1080x1920_portrait" autoscale="Y">
```

**Expected Result:**
- Content fills entire viewport (100% x 100%)
- Viewport scale = 1.0
- Full-screen behavior maintained

### Test Case 4: Different Device Resolutions
Test on multiple devices:
- Small phone: 720x1280
- Standard phone: 1080x1920
- Tablet: 1200x1920 or 2560x1600

**Expected Result:**
- Automatic scaling adapts to each device
- Layout maintains aspect ratio
- No manual viewport adjustment needed

## Console Debug Information

The implementation logs detailed information for debugging:

```javascript
[MobileLayoutHandler] Calculating viewport scale:
  Layout dimensions: 1080 x 1920
  Device dimensions: 1080 x 1920
  Scale X: 1.000
  Scale Y: 1.000
  Optimal scale: 1.0
[MobileLayoutHandler] Viewport updated: width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no
[MobileLayoutHandler] Fixed layout mode with viewport scale: 1.0
```

## Browser Developer Tools Testing

### How to Verify Viewport Scale:
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Check for `[MobileLayoutHandler]` log messages
4. Verify the calculated scale matches expected value
5. Inspect viewport meta tag:
   ```javascript
   document.querySelector('meta[name="viewport"]').content
   ```

## Compatibility

### Supported:
- ✅ Android (Capacitor)
- ✅ Chrome/Chromium-based browsers
- ✅ WebView components
- ✅ Portrait and landscape orientations

### Browser Requirements:
- Support for dynamic viewport meta tag updates
- CSS `position: fixed` support
- ES6 JavaScript support

## Performance Considerations

1. **Viewport calculation**: O(1) - simple arithmetic
2. **Meta tag update**: Minimal DOM operation
3. **No runtime overhead**: Calculation done once on layout load
4. **No transform/scale CSS**: Browser handles scaling natively

## Troubleshooting

### Issue: Slots still misaligned
**Check:**
- Console logs show correct scale calculation
- Viewport meta tag updated (inspect in DevTools)
- `#main` container has correct width/height
- Layout XML has correct resolution attribute

### Issue: Content too small/large
**Check:**
- Device screen dimensions (`window.screen.width/height`)
- Layout resolution in XML
- Verify no conflicting CSS transforms

### Issue: Autoscale not working
**Check:**
- `autoscale="Y"` in layout XML
- Console shows "Using autoscale/fullscreen mode"
- Viewport reset to `maximum-scale=1.0`
- `.fixed-layout` class removed from #main

## Future Enhancements

1. **Orientation lock**: Add support for layout orientation preferences
2. **Zoom controls**: Allow user zoom within safe bounds
3. **Multi-display**: Handle secondary displays with different resolutions
4. **Performance mode**: Option to use CSS transforms instead of viewport scaling
5. **Safe area support**: Handle device notches and rounded corners

## Related Files

- `/mobile/www/assets/js/mobile/mobile-layout-handler.js`
- `/mobile/www/index.html`
- `/mobile/www/assets/js/layoutxml.js`

## Changelog

**2025-12-11**: Initial implementation
- Dynamic viewport scale calculation
- Automatic meta tag updates
- Support for autoscale Y/N modes
- Comprehensive logging and debugging

---

**Author**: Development Team  
**Date**: December 11, 2025  
**Version**: 1.0.0
