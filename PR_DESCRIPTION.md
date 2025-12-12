Android Mobile App - App Icon Display Fix

This PR fixes the Android app icon not displaying correctly in the app launcher and during splash screen, replacing the default Android robot icon with the custom eCLESS Player logo.

## Summary of Key Issues Fixed

1. **Default Android Robot Icon Displayed** - App showed generic Android robot icon instead of custom eCLESS Player logo in app launcher and settings
2. **Icon Not Fitting Properly** - App icon was cropped or not properly fitted within the icon safe zone on Android 11+
3. **Splash Screen Icon Sizing** - Launch splash screen displayed improperly scaled icon
4. **Low Resolution Icon Assets** - Icon source files were only 256x256px causing quality issues
5. **Adaptive Icon Configuration Error** - XML referenced wrong drawable resources (mipmap instead of drawable for background)
6. **Missing Adaptive Icon Insets** - Foreground layer lacked proper safe zone insets for different device shapes

## Core Technical Improvements

1. **High Resolution Icon Assets**
   - Upgraded icon source files from 256x256px to 512x512px for crisp display quality
   - Copied proper resolution icons from Electron desktop app (build/icons/linux/512x512.png)
   - Regenerated all Android icon densities (ldpi, mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
   - Ensures sharp icon display across all device screen densities

2. **Adaptive Icon Configuration Fix**
   - Fixed adaptive icon XML to reference @drawable/ic_launcher_background instead of @mipmap
   - Corrected foreground reference to use @mipmap/ic_launcher_foreground
   - Created clean vector drawable background with app theme color (#1e293b)
   - Removed malformed XML content that caused build errors

3. **Adaptive Icon Safe Zone Insets**
   - Added 20% inset to adaptive icon foreground layer
   - Ensures icon content stays within safe zone on all device shapes (circle, squircle, rounded square)
   - Prevents logo cropping on devices with different launcher icon masks
   - Maintains visual consistency across Android OEM implementations

4. **Assets Configuration Update**
   - Updated assets.config.json to use correct icon source paths
   - Changed from resources/android/icon.png to resources/icon-only.png
   - Set proper foreground source to resources/icon-foreground.png
   - Updated background color from white to dark slate theme (#1e293b)

5. **Icon Background Simplification**
   - Replaced complex grid-pattern background with solid color fill
   - Simple vector drawable with single path element for clean rendering
   - Theme-consistent dark slate background color matching app design
   - Optimized XML structure prevents parsing errors

6. **Splash Screen Asset Regeneration**
   - Regenerated splash screens for all orientations (portrait and landscape)
   - Created splash screens for all density buckets (ldpi through xxxhdpi)
   - Updated splash screen background color to match app theme
   - High-resolution source ensures crisp display during app launch

## Files Changed Summary

**Icon Assets Configuration**
- mobile/assets.config.json - Updated icon source paths and background color to app theme
- mobile/resources/icon-only.png - Upgraded from 256x256 to 512x512 resolution
- mobile/resources/icon-foreground.png - Upgraded to 512x512 for adaptive icon foreground
- mobile/resources/splash.png - Upgraded to 512x512 for splash screen quality

**Android Icon Resources**
- mobile/android/app/src/main/res/drawable/ic_launcher_background.xml - Simplified to clean vector drawable with theme color
- mobile/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml - Fixed drawable references and added 20% foreground inset
- mobile/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml - Fixed drawable references and added 20% foreground inset
- mobile/android/app/src/main/res/mipmap-*/ic_launcher.png - Regenerated all densities from high-res source
- mobile/android/app/src/main/res/mipmap-*/ic_launcher_round.png - Regenerated all densities
- mobile/android/app/src/main/res/mipmap-*/ic_launcher_foreground.png - Regenerated all densities
- mobile/android/app/src/main/res/drawable-*/splash.png - Regenerated all orientations and densities

**Documentation**
- mobile/d5.1 (API 22) and above
- Android 11+ with adaptive icon support tested
- Minimum SDK 22 (Android 5.1)
- Target SDK 33 (Android 13)
- No breaking changes
- No server-side changes required
- Works with all existing configurations

## Testing Checklist

- Custom eCLESS Player icon appears in app launcher instead of Android robot
- Icon displays properly fitted within icon area (not cropped)
- Icon appears correctly in Settings app list
- Icon displays in recent apps task switcher
- Splash screen shows properly scaled icon during launch
- Icon quality is crisp and sharp on high-DPI devices
- Adaptive icon renders correctly on circle, squircle, and rounded square launchers
- Icon background matches app theme (dark slate)
- Navigation bar auto-hides after orientation change
- Player content fills entire screen edge-to-edge
- Swipe-up gesture shows navigation briefly then auto-hides
- App resume from background maintains immersive mode
- Lock and unlock device keeps navigation bar hidden