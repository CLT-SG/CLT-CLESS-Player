# Mobile Kiosk Mode Implementation

## Overview

The mobile version of eCLESS Player now includes full-screen kiosk mode functionality, matching the desktop Electron app's behavior. This implementation enables the mobile app to run as a dedicated digital signage display with:

- **Full-screen immersive mode** (no status bar, no navigation bar)
- **Screen wake lock** (prevents device from sleeping)
- **Auto-hide navigation** (UI controls hidden during playback)
- **Orientation lock** (landscape mode for displays)
- **Hardware acceleration** (smooth video playback)

## Key Features

### 1. Android Immersive Mode
- Hides Android status bar and navigation bar
- Maintains immersive state even after user interaction
- Re-applies immersive mode automatically when needed
- Uses Capacitor StatusBar plugin for native control

### 2. Screen Wake Lock
- Prevents device screen from turning off during playback
- Uses modern Wake Lock API when available
- Fallback support for older Android versions
- Automatically managed based on kiosk mode state

### 3. Full-Screen CSS
- Custom CSS ensures 100% viewport coverage
- Prevents scrolling, zooming, and pull-to-refresh
- Hides scrollbars completely
- Forces hardware acceleration for smooth performance

### 4. Navigation Management
- Auto-hides navigation buttons on player page (index.html)
- Shows navigation on configuration pages (configure.html, dashboard.html)
- Intelligent detection of current page context

### 5. Orientation Lock
- Locks device to landscape mode for horizontal displays
- Can be configured in settings if needed
- Uses Screen Orientation API

## Files Modified/Created

### New Files
- `/mobile/www/assets/js/mobile/mobile-kiosk.js` - Core kiosk mode manager

### Modified Files
- `/mobile/www/index.html` - Added kiosk module, enhanced CSS
- `/mobile/www/assets/js/mobile/mobile-config.js` - Added kiosk settings
- `/mobile/www/assets/js/mobile/capacitor-core.js` - Added kiosk APIs

## Configuration

Kiosk mode settings are in the mobile configuration:

```javascript
{
  "displaySettings": {
    "orientation": "landscape",
    "fullscreen": true,
    "hideStatusBar": true,
    "kioskMode": true,
    "preventSleep": true
  }
}
```

## Usage

### Automatic Activation
Kiosk mode automatically enables when:
1. App loads on the player page (index.html)
2. Configuration has `kioskMode: true`
3. Device capabilities support required features

### Manual Control
Access kiosk manager via console:

```javascript
// Enable kiosk mode
await window.mobileKiosk.enableKioskMode();

// Disable kiosk mode
await window.mobileKiosk.disableKioskMode();

// Toggle kiosk mode
await window.mobileKiosk.toggleKioskMode();

// Get current status
const status = window.mobileKiosk.getStatus();
console.log(status);
// {
//   isKioskMode: true,
//   isPlayerPage: true,
//   hasWakeLock: true,
//   isFullscreen: true
// }
```

## How It Works

### Initialization Flow

```
1. Page loads → Capacitor initializes
2. Mobile config loads → Kiosk settings read
3. Page detects if it's player (index.html)
4. appReady event fires
5. Kiosk manager auto-enables (1 sec delay)
6. Immersive mode applied
7. Status bar hidden
8. Wake lock requested
9. Fullscreen entered
10. Navigation hidden (on player page)
11. Kiosk CSS applied
12. Maintenance loop starts (re-applies immersive every 3s)
```

### Maintenance Loop

Android can exit immersive mode on user interaction. The kiosk manager:
- Re-applies immersive mode every 3 seconds
- Listens for visibility changes (app backgrounded/foregrounded)
- Responds to touch/click events with debounced re-application
- Ensures consistent kiosk experience

### CSS Architecture

The kiosk CSS uses the `.kiosk-mode` class on `<html>`:

```css
html.kiosk-mode, html.kiosk-mode body {
  width: 100vw !important;
  height: 100vh !important;
  position: fixed !important;
  overflow: hidden !important;
}
```

This ensures:
- No scrolling
- No viewport resizing
- No address bar appearance
- Full coverage of device screen

## Browser/Device Compatibility

### Supported Features by Platform

| Feature | Android | iOS | Web |
|---------|---------|-----|-----|
| Status Bar Hide | ✅ | ✅ | ❌ |
| Immersive Mode | ✅ | ⚠️ | ❌ |
| Wake Lock | ✅ | ✅* | ✅* |
| Fullscreen API | ✅ | ⚠️ | ✅ |
| Orientation Lock | ✅ | ✅ | ⚠️ |

*Requires HTTPS or localhost

### Android Versions
- Android 5.0+ (API 21+): Full support
- Android 4.4 (API 19-20): Partial support, no immersive mode
- Android < 4.4: Minimal support

### iOS Limitations
iOS has stricter restrictions:
- Status bar control limited
- No true immersive mode
- Wake lock requires user gesture
- Fullscreen limited to videos

## Comparison with Desktop

### Desktop (Electron) Kiosk Mode
```javascript
// index.js
const win = new BrowserWindow({
  fullscreen: true,
  frame: false,
  alwaysOnTop: true,
  skipTaskbar: true
});
```

### Mobile (Capacitor) Kiosk Mode
```javascript
// mobile-kiosk.js
await capacitorAPI.hideStatusBar();
await navigator.wakeLock.request('screen');
await document.documentElement.requestFullscreen();
screen.orientation.lock('landscape');
```

Both achieve the same goal: uninterrupted full-screen display.

## Troubleshooting

### Kiosk Mode Not Enabling

**Check browser console:**
```javascript
window.mobileKiosk.getStatus()
```

**Common issues:**
1. Not on player page (index.html)
2. Capacitor not ready
3. Browser doesn't support features
4. User gesture required (for some APIs)

### Status Bar Still Visible

**Solution:**
```javascript
// Manually hide
await window.capacitorAPI.hideStatusBar();

// Force re-apply immersive
await window.mobileKiosk.enableImmersiveMode();
```

### Screen Turns Off

**Check wake lock:**
```javascript
const status = window.mobileKiosk.getStatus();
console.log('Has wake lock:', status.hasWakeLock);

// Re-request if needed
await window.mobileKiosk.requestWakeLock();
```

### Navigation Buttons Not Hiding

**Only hides on player page (index.html):**
- Configure page (configure.html) keeps navigation visible
- Dashboard page (dashboard.html) keeps navigation visible
- This is by design for user access to settings

## Testing

### Desktop Browser (Chrome)
1. Open DevTools
2. Enable device emulation
3. Select Android device
4. Load index.html
5. Check console for kiosk logs

### Android Device
1. Build APK: `cd mobile/android && ./gradlew assembleRelease`
2. Install on device
3. Open app
4. Verify full-screen display
5. Check no status bar visible
6. Confirm screen stays awake

### Testing Checklist
- [ ] Status bar hidden
- [ ] Navigation bar hidden (Android)
- [ ] Screen doesn't sleep
- [ ] Full viewport coverage
- [ ] No scrolling possible
- [ ] Navigation buttons hidden on player
- [ ] Navigation buttons visible on settings pages
- [ ] Immersive mode persists after interaction

## Performance Considerations

### CPU/Battery Impact
- Wake lock prevents sleep → increased battery usage
- Maintenance loop runs every 3 seconds → minimal CPU impact
- Hardware acceleration enabled → GPU handles rendering

### Memory Usage
- Kiosk manager: ~50KB
- CSS overhead: minimal
- Event listeners: lightweight
- Wake lock: native API, negligible

### Optimization Tips
1. Use hardware acceleration for videos
2. Limit maintenance loop frequency if needed
3. Release wake lock when app backgrounded
4. Remove event listeners on page unload

## Future Enhancements

### Planned Features
- [ ] Configurable kiosk mode timeout
- [ ] Remote kiosk mode control via API
- [ ] Multi-display support for Android
- [ ] Enhanced gesture blocking
- [ ] Custom kiosk mode UI overlay

### Potential Additions
- MDM (Mobile Device Management) integration
- Scheduled kiosk mode activation
- QR code configuration from kiosk mode
- Remote monitoring dashboard

## Related Documentation

- [Mobile Architecture](./MOBILE-MEDIA-ARCHITECTURE.md)
- [Build Instructions](./BUILD-INSTALL-GUIDE.md)
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API)

## Support

For issues or questions about mobile kiosk mode:
1. Check browser console logs
2. Verify device capabilities
3. Test on actual Android device (not emulator)
4. Review this documentation
5. Contact development team

---

**Implementation Date:** December 2025  
**Version:** 2.6.5  
**Platform:** Capacitor 6.x, Android 5.0+
