Android Mobile App - System Navigation Bar Hiding Fix for Android 11+

This PR fixes the Android system navigation bar (bottom buttons) appearing during playback on Android 11 and newer devices, implementing proper immersive fullscreen mode.

## Summary of Key Issues Fixed

1. **Android System Navigation Bar Visible** - Bottom navigation bar with back/home/recent buttons appeared during CMS player display on Android 11+ devices
2. **Immersive Mode Not Working** - Native Android immersive mode was not implemented in MainActivity
3. **System UI Reappearing on Interaction** - Navigation bar would reappear after user touch/swipe interactions
4. **Theme Configuration Missing** - Android theme lacked fullscreen and transparent system bar attributes
5. **Insufficient CSS z-index** - Player content did not have proper z-index to render above system UI overlays
6. **Weak Immersive Maintenance** - JavaScript kiosk mode did not aggressively maintain immersive state

## Core Technical Improvements

1. **Native Android Immersive Mode Implementation**
   - Implemented WindowInsetsController for Android 11+ using modern API 30 approach
   - Added SYSTEM_UI_FLAG_IMMERSIVE_STICKY fallback for Android 10 and below
   - Configured BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE for sticky immersive behavior
   - Set FLAG_LAYOUT_NO_LIMITS for true edge-to-edge display

2. **Activity Lifecycle Integration**
   - Added onCreate hook to enable immersive mode on app launch
   - Added onResume hook to re-apply immersive mode when app resumes from background
   - Added onWindowFocusChanged hook to maintain immersive mode after user interactions
   - Configured display cutout mode for notch/punch-hole camera support

3. **Android Theme Configuration**
   - Set windowFullscreen to true for fullscreen display
   - Configured transparent statusBarColor and navigationBarColor
   - Added windowLayoutInDisplayCutoutMode for edge-to-edge on devices with cutouts
   - Disabled windowTranslucentStatus and windowTranslucentNavigation for app control
   - Set fitsSystemWindows to false to prevent UI shifting

4. **JavaScript Kiosk Mode Enhancement**
   - More aggressive immersive mode re-application every 2 seconds instead of 3
   - Added event listeners for visibilitychange, focus, touchstart, touchend, orientationchange, resize
   - Multi-trigger approach on orientation change with 3 sequential applications
   - Debounced event handlers to prevent performance issues while maintaining coverage

5. **CSS Layer Protection**
   - Increased main container z-index to 9999 for priority over system UI
   - Added z-index 10 to all main child elements
   - Implemented safe-area-inset support for devices with notches
   - Extended viewport boundaries to cover full screen including system bar areas

6. **Multi-Layer Defense Strategy**
   - Native layer (Java) provides primary enforcement via WindowInsetsController
   - JavaScript layer continuously monitors and re-applies immersive mode
   - CSS layer ensures visual coverage with proper z-index hierarchy
   - Defense-in-depth approach handles edge cases across Android versions

## Files Changed Summary

**Android Native Code**
- mobile/android/app/src/main/java/biz/closedloop/ecless/player/MainActivity.java - Added immersive mode implementation with lifecycle hooks
- mobile/android/app/src/main/res/values/styles.xml - Enhanced theme with fullscreen and transparent system bar configuration

**Mobile JavaScript**
- mobile/www/assets/js/mobile/mobile-kiosk.js - Enhanced immersive mode maintenance with aggressive re-application

**Mobile HTML/CSS**
- mobile/www/index.html - Added enhanced CSS for z-index priority and safe-area coverage

**Documentation**
- mobile/ANDROID-NAVIGATION-FIX.md - Complete technical documentation with testing procedures

## Compatibility

- Desktop Electron app unchanged
- Android 11 (API 30) and above with WindowInsetsController
- Android 10 (API 29) and below with SYSTEM_UI_FLAG fallback
- Minimum SDK 22 (Android 5.1)
- Target SDK 33 (Android 13)
- No breaking changes
- No server-side changes required
- Works with all existing layout configurations

## Testing Checklist

- Navigation bar hidden on app launch
- Navigation bar stays hidden during content playback
- Navigation bar remains hidden after screen touches
- Navigation bar auto-hides after orientation change
- Player content fills entire screen edge-to-edge
- Swipe-up gesture shows navigation briefly then auto-hides
- App resume from background maintains immersive mode
- Lock and unlock device keeps navigation bar hidden