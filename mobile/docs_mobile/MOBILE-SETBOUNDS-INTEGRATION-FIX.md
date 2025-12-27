# Mobile setBounds() Integration Fix - December 2025

## Critical Issue Resolution

The mobile CMS player had layout rendering and viewport scaling issues that did not occur in the Electron desktop version. Root cause analysis revealed a **critical integration gap** between `mobile-electron-shim.js` and `mobile-layout-handler.js`.

## Root Cause

### The Problem

`remote.getCurrentWindow().setBounds()` in `mobile-electron-shim.js` only:
1. Stored dimensions in `window.layoutDimensions`
2. Dispatched a `layout-dimensions-changed` event
3. Set basic CSS on document/body

**It did NOT call `window.mobileLayoutHandler.setLayoutBounds()`** which is responsible for:
- Calculating optimal viewport scale for fixed layouts
- Updating viewport meta tag with correct `maximum-scale`
- Applying proper dimensions to `#main` container
- Locking layout to prevent touch-triggered zoom resets

### Call Flow Comparison

**Desktop (Working):**
```
layoutxml.js
  ↓
remote.getCurrentWindow().setBounds({ width, height })
  ↓
Electron native window resize
  ↓
Layout renders at specified dimensions
```

**Mobile BEFORE Fix (BROKEN):**
```
layoutxml.js
  ↓
remote.getCurrentWindow().setBounds({ width, height })
  ↓
mobile-electron-shim.js: Store dimensions only
  ↓
NO viewport scaling applied ❌
  ↓
Layout renders incorrectly (not scaled to fit device)
```

**Mobile AFTER Fix (WORKING):**
```
layoutxml.js
  ↓
remote.getCurrentWindow().setBounds({ width, height })
  ↓
mobile-electron-shim.js: Detect autoscale mode
  ↓
mobileLayoutHandler.setLayoutBounds(bounds, autoscale) ✅
  ↓
Calculate viewport scale + Update meta tag + Apply to container
  ↓
Layout renders correctly with proper scaling
```

## The Fix

### Changes to mobile-electron-shim.js

Updated `remote.getCurrentWindow().setBounds()` to:

1. **Detect Autoscale Mode:**
   - If bounds >= screen dimensions → autoscale mode (fullscreen)
   - If bounds < screen dimensions → fixed layout mode (requires viewport scaling)

2. **Call Layout Handler:**
   ```javascript
   if (window.mobileLayoutHandler) {
       window.mobileLayoutHandler.setLayoutBounds(bounds, isAutoscale);
   }
   ```

3. **Fallback Gracefully:**
   - If layout handler not available, fall back to basic dimension storage
   - Log warnings for debugging

## Testing

### Test Autoscale Mode

```bash
# In mobile app console:
window.mobileLayoutHandler.getLayoutDimensions()
# Should show fullscreen dimensions

window.mobileLayoutHandler.getScaleFactor()
# Should return: 1.0

document.querySelector('meta[name="viewport"]').content
# Should show: maximum-scale=1.0
```

### Test Fixed Layout Mode (e.g., 1280x720 on 1920x1080 device)

```bash
window.mobileLayoutHandler.getScaleFactor()
# Should return: 1.5 (calculated as 1920/1280 = 1.5)

document.querySelector('meta[name="viewport"]').content
# Should show: maximum-scale=1.5

document.getElementById('main').style.width
# Should show: "1280px"
```

## Impact

✅ CMS player preview works correctly on mobile  
✅ Layouts scale properly to fit device  
✅ Consistent with desktop app behavior  
✅ Supports both autoscale and fixed layout modes  
✅ Prevents touch-triggered zoom resets  

## Files Changed

- `mobile/www/assets/js/mobile/mobile-electron-shim.js` - Integrated with layout handler
- `mobile/docs_mobile/MOBILE-SETBOUNDS-INTEGRATION-FIX.md` - This documentation

## References

- Original Issue: `/mobile/docs_mobile/MOBILE-SETBOUNDS-FIX.md`
- Code Review: `/mobile/docs_mobile/MOBILE-ELECTRON-SHIM-REVIEW.md`
- Layout Handler: `/mobile/docs_mobile/MOBILE-LAYOUT-HANDLER-REVIEW.md`
