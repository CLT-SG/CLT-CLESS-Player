# Icon Management for eCLESS Player Mobile

This document explains how custom icons from the Electron desktop app are integrated into the mobile app.

## Icon Sources

The mobile app uses the same icons as the desktop Electron app located in:
- **Source Icons**: `../build/icons/linux/` (from the main project root)

## Icon Resources Location

Mobile icon resources are stored in:
- `resources/icon-only.png` - Main app icon (512x512px)
- `resources/icon-foreground.png` - Adaptive icon foreground (512x512px)
- `resources/splash.png` - Splash screen icon (512x512px)

## Generated Assets

The `@capacitor/assets` tool automatically generates all required Android icon sizes:

### App Icons (mipmap directories)
- `ic_launcher.png` - Standard square icons (ldpi to xxxhdpi)
- `ic_launcher_round.png` - Round icons for devices that support them
- `ic_launcher_foreground.png` - Adaptive icon foreground layers
- Adaptive icon XML descriptors in `mipmap-anydpi-v26/`

### Splash Screens (drawable directories)
- Portrait and landscape splash screens for all densities (ldpi to xxxhdpi)

## How to Update Icons

### Method 1: Using the npm script (Recommended)

```bash
# Generate Android icons only
npm run generate:icons

# Generate icons for all platforms (Android & iOS)
npm run generate:icons:all
```

### Method 2: Manual Process

1. Replace the source icon files in the `resources/` directory:
   ```bash
   cp ../build/icons/linux/512x512.png resources/icon-only.png
   cp ../build/icons/linux/512x512.png resources/icon-foreground.png
   cp ../build/icons/linux/512x512.png resources/splash.png
   ```

2. Generate all icon sizes:
   ```bash
   npx @capacitor/assets generate --android
   ```

3. Sync with the Android project:
   ```bash
   npm run sync:android
   ```

## Icon Configuration

The icon generation is configured in `assets.config.json` (if present) or uses default settings.

### Key Configuration Points

- **App ID**: `sg.closedloop.ecless.player` (in `capacitor.config.json`)
- **App Name**: eCLESS Player
- **Background Color**: `#1e293b` (dark slate)

## Verifying Icon Updates

After generating icons:

1. Check that mipmap directories contain updated icons:
   ```bash
   ls -la android/app/src/main/res/mipmap-*/
   ```

2. Rebuild the Android app:
   ```bash
   npm run build:android
   ```

3. Install on device/emulator and verify:
   - App launcher icon displays correctly
   - Splash screen shows the custom icon
   - Icon appears in recent apps/task switcher

## Troubleshooting

### Icons not updating on device

1. Clean the Android build:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```

2. Regenerate icons:
   ```bash
   npm run generate:icons
   ```

3. Rebuild and reinstall:
   ```bash
   npm run build:android
   ```

### Icons appear blurry

Ensure the source icon is at least 512x512px with good quality. The tool will scale down for different densities.

### Adaptive icon issues

Check the `mipmap-anydpi-v26/` directory contains proper XML descriptors that reference both foreground and background layers.

## Dependencies

- `@capacitor/assets` - Icon and splash screen generation tool (installed as dev dependency)

## Notes

- The same 512x512px icon from the desktop app is used for mobile
- Android supports both square and round launcher icons
- Adaptive icons (Android 8.0+) use separate foreground and background layers
- All icon densities are automatically generated from the source file
- Changes to icons require rebuilding the Android app to take effect
