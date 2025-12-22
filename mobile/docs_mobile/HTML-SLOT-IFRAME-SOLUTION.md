# HTML Slot Implementation - Mobile iframe Solution

## Overview

The mobile version of eCLESS Player now uses standard HTML **iframes** to render HTML content slots, replacing Electron's webview while maintaining proper positioning and dimensions.

## Solution

### Approach: HTML iframe

We use standard HTML iframes because they:
- ✅ Work natively on all platforms (no plugin required)
- ✅ Respect CSS positioning and dimensions from layout XML
- ✅ Can be embedded inline within slots
- ✅ Support same attributes as webview (allowfullscreen, etc.)
- ✅ No additional dependencies needed

## Implementation

### slot-html.js

The function detects the platform and renders accordingly:

**Mobile (Capacitor):**
```javascript
<iframe id="html-{index}"
    src="{url}"
    class="html-slot mobile-html-iframe"
    style="width: 100%; height: 100%; border: none; display: block;"
    frameborder="0"
    allowfullscreen
    allow="geolocation; microphone; camera; midi; encrypted-media; autoplay; fullscreen">
</iframe>
```

**Desktop (Electron):**
```javascript
<webview id="html-{index}"
    src="{url}"
    class="html-slot">
</webview>
```

### Platform Detection

```javascript
const isMobile = !!(window.capacitorAPI || window.mobileAPI);
```

## Positioning & Dimensions

The iframe inherits positioning from its slot container:

1. **layoutxml.js** applies CSS to `#slot-{id}`:
   ```javascript
   $('#slot-' + slotid).css({
       "position": "absolute",
       "top": "...",
       "left": "...",
       "width": "...",
       "height": "...",
       "z-index": "..."
   });
   ```

2. **iframe** fills the slot:
   ```css
   width: 100%;
   height: 100%;
   ```

3. **Result**: iframe positioned and sized exactly as defined in layout XML

### Autoscale Support

When `autoscale="Y"` in layout:
- layoutxml.js calculates scaled dimensions
- Applies scaled CSS to slot container
- iframe inherits scaled dimensions automatically

## Features

### iframe Attributes

- `allowfullscreen` - Full-screen support
- `allow="..."` - Permissions for:
  - Geolocation
  - Microphone
  - Camera
  - MIDI
  - Encrypted media
  - Autoplay
  - Fullscreen

### Error Handling

```javascript
// Load event
$('#html-' + index).on('load', function() {
    console.log('iframe loaded successfully');
});

// Error event  
$('#html-' + index).on('error', function(e) {
    console.error('iframe failed to load', e);
});
```

## Files Modified

1. **mobile/www/assets/js/slot-html.js**
   - Added platform detection
   - iframe for mobile, webview for desktop
   - Defensive coding with null checks
   - Load/error event handlers

2. **src/assets/js/slot-html.js**
   - Added defensive coding
   - Maintains webview for desktop

## Comparison: iframe vs InAppBrowser

| Feature | iframe | InAppBrowser |
|---------|--------|--------------|
| **Embedding** | Inline in DOM ✅ | Full-screen overlay ❌ |
| **Positioning** | CSS controllable ✅ | Fixed full-screen ❌ |
| **Dimensions** | Inherits from parent ✅ | Always full-screen ❌ |
| **Dependencies** | None (native) ✅ | Plugin required ❌ |
| **Slot integration** | Perfect ✅ | Breaks layout ❌ |

## Testing

### Verify iframe Rendering
1. Open mobile app
2. Load layout with HTML slot
3. Check that content appears in correct position
4. Verify dimensions match layout XML
5. Test with autoscale enabled/disabled

### Verify Desktop Compatibility
1. Open desktop Electron app
2. Load same layout with HTML slot
3. Verify webview still works
4. No changes to desktop behavior

## Browser Compatibility

### Mobile
- ✅ Android 5.0+ (WebView)
- ✅ iOS 11+ (WKWebView via Capacitor)

### Desktop
- ✅ Electron webview (all versions)

## Security Considerations

### iframe Sandbox

By default, iframes have some restrictions. For full functionality:
- No `sandbox` attribute (allows scripts, forms, etc.)
- `allow` attribute grants specific permissions
- Content Security Policy respected

### Same-Origin Policy

- Cross-origin content may have restrictions
- Use CORS headers on target server if needed
- `X-Frame-Options` may block embedding

## Troubleshooting

### Content not displaying
1. Check browser console for errors
2. Verify URL is accessible
3. Check `X-Frame-Options` header
4. Test URL in browser directly

### Wrong position/size
1. Inspect slot container CSS
2. Verify layout XML values
3. Check autoscale calculations
4. Ensure iframe has `width: 100%; height: 100%`

### Mixed content warnings
1. Use HTTPS for all URLs
2. Check Capacitor config `allowMixedContent`
3. Update content source to HTTPS

## Example Layout XML

```xml
<slot id="1" name="html" enabled="Y" 
      top="100" left="100" 
      width="800" height="600"
      bgcolor="#000000">
    <text>https://example.com</text>
</slot>
```

Result:
- Slot positioned at (100, 100)
- Dimensions: 800x600px
- iframe fills slot completely
- Content from example.com displayed

---

**Implementation Date**: December 22, 2025  
**Version**: 3.3.2  
**Status**: ✅ Complete & Production Ready
