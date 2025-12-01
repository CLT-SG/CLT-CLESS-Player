# eCLESS Player Mobile App - Setup Guide

## Overview

This guide explains how to build Android and iOS mobile applications from the eCLESS Player Electron project. The mobile version uses **Capacitor** to wrap the existing web frontend, providing native mobile APIs while preserving all functionality.

## Architecture

```
ecless-player-electron/
├── src/                    # Original Electron frontend (untouched)
├── index.js                # Electron main process (untouched)
├── mobile/                 # NEW: Mobile app directory
│   ├── www/                # Built web assets for mobile
│   │   ├── index.html      # Main dashboard (from cpanel.html)
│   │   ├── configure.html  # Configuration page
│   │   ├── activate.html   # Activation page
│   │   └── assets/         # CSS, JS, images (copied from src/)
│   ├── android/            # Android project (generated)
│   ├── ios/                # iOS project (generated)
│   ├── resources/          # App icons and splash screens
│   ├── capacitor.config.json
│   ├── package.json
│   └── build-mobile.js     # Build script
```

## Prerequisites

### For Android Development

1. **Node.js** (v16 or later)
   ```bash
   node --version
   ```

2. **Android Studio** with Android SDK
   - Download from: https://developer.android.com/studio
   - Install Android SDK Platform 33 or later
   - Install Android SDK Build-Tools
   - Set ANDROID_HOME environment variable

3. **Java Development Kit (JDK 17)**
   ```bash
   java --version
   ```

### For iOS Development (macOS only)

1. **Xcode** (v14 or later)
   - Download from Mac App Store
   - Install Command Line Tools:
     ```bash
     xcode-select --install
     ```

2. **CocoaPods**
   ```bash
   sudo gem install cocoapods
   ```

## Installation Steps

### Step 1: Install Dependencies

Navigate to the mobile directory and install npm packages:

```bash
cd mobile
npm install
```

### Step 2: Build Web Assets

Run the build script to prepare web assets from the Electron frontend:

```bash
npm run build
```

This script will:
- Copy HTML files from `src/` to `mobile/www/`
- Copy all assets (CSS, JS, images)
- Remove Electron-specific code
- Add Capacitor plugins and mobile configuration

### Step 3: Add Mobile Platforms

#### For Android:
```bash
npm run add:android
```

This creates the `android/` directory with native Android project files.

#### For iOS (macOS only):
```bash
npm run add:ios
```

This creates the `ios/` directory with native iOS project files.

### Step 4: Build and Run

#### Android Development Build:

```bash
npm run build:android
```

This will:
1. Rebuild web assets
2. Sync assets to Android project
3. Open Android Studio

From Android Studio:
- Click "Run" or press `Shift + F10`
- Select a connected device or emulator
- App will install and launch

#### iOS Development Build (macOS only):

```bash
npm run build:ios
```

This will:
1. Rebuild web assets
2. Sync assets to iOS project
3. Open Xcode

From Xcode:
- Select a simulator or connected device
- Click "Run" or press `Cmd + R`
- App will install and launch

## Build Commands Reference

| Command | Description |
|---------|-------------|
| `npm run build` | Build web assets from Electron frontend |
| `npm run build:android` | Build and open Android project |
| `npm run build:ios` | Build and open iOS project |
| `npm run sync` | Sync web assets to all platforms |
| `npm run sync:android` | Sync web assets to Android only |
| `npm run sync:ios` | Sync web assets to iOS only |
| `npm run open:android` | Open Android Studio |
| `npm run open:ios` | Open Xcode |
| `npm run clean` | Clean all generated files |

## Production Release

### Android APK/AAB Release

1. **Generate Signing Key:**
   ```bash
   keytool -genkey -v -keystore ecless-release-key.keystore \
     -alias ecless-player -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Update capacitor.config.json:**
   ```json
   {
     "android": {
       "buildOptions": {
         "keystorePath": "path/to/ecless-release-key.keystore",
         "keystoreAlias": "ecless-player",
         "releaseType": "APK"
       }
     }
   }
   ```

3. **Build Release APK:**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
   
   Output: `android/app/build/outputs/apk/release/app-release.apk`

4. **Build Release AAB (Google Play):**
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
   
   Output: `android/app/build/outputs/bundle/release/app-release.aab`

### iOS App Store Release (macOS only)

1. **Configure Apple Developer Account** in Xcode
2. **Set up provisioning profiles** and signing certificates
3. **Archive the app:**
   - Open Xcode
   - Select "Any iOS Device" as target
   - Menu: Product → Archive
4. **Distribute to App Store** using Xcode Organizer

## Configuration

### Server Connection

Mobile apps connect to the eCLESS server using the configuration stored in:
- **Android**: Capacitor Preferences API
- **iOS**: Capacitor Preferences API

The default server URL can be modified in `mobile/www/assets/js/mobile-config.js`:

```javascript
const defaultConfig = {
    hostserver: 'https://your-ecless-server.com',
    id: 'your-display-id',
    mode: 'online',
    // ... other settings
};
```

### App Icons and Splash Screens

Place custom app icons and splash screens in:
- `mobile/resources/android/` - Android assets
- `mobile/resources/ios/` - iOS assets

Required sizes:
- **Android**: `mipmap-*/ic_launcher.png` (48dp to 512dp)
- **iOS**: `AppIcon.appiconset/` (various sizes)

## Differences from Electron Version

| Feature | Electron | Mobile (Capacitor) |
|---------|----------|-------------------|
| Window Management | Native OS windows | Single fullscreen app |
| File System | Full Node.js fs module | Capacitor Filesystem API |
| Configuration | Local config.json file | Preferences API + API sync |
| Serial Key | MAC address | Device ID |
| Auto-startup | OS startup scripts | N/A (mobile apps) |
| Screen Control | Display API | StatusBar API |
| Shutdown/Reboot | OS commands | App exit only |

## Troubleshooting

### Android Build Issues

**Problem**: `ANDROID_HOME not set`
```bash
# Linux/macOS
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools

# Add to ~/.bashrc or ~/.zshrc for persistence
```

**Problem**: Gradle build fails
```bash
cd android
./gradlew clean
cd ..
npm run sync:android
```

### iOS Build Issues

**Problem**: CocoaPods not installed
```bash
sudo gem install cocoapods
cd ios/App
pod install
```

**Problem**: Xcode signing errors
- Open `ios/App.xcworkspace` in Xcode
- Select the project in navigator
- Go to "Signing & Capabilities"
- Select your Apple Developer team

### Web Assets Not Updating

```bash
npm run clean
npm run build
npm run sync
```

## Testing on Physical Devices

### Android Device Testing

1. Enable Developer Options on Android device:
   - Settings → About Phone → Tap "Build number" 7 times
2. Enable USB Debugging:
   - Settings → Developer Options → USB Debugging
3. Connect device via USB
4. Run: `npm run build:android`
5. Select your device in Android Studio

### iOS Device Testing (macOS only)

1. Connect iOS device via USB
2. Trust the computer on device
3. Open Xcode project: `npm run open:ios`
4. Select your device in Xcode
5. Click "Run" (may require Apple Developer account)

## API Compatibility

The mobile version implements Electron-like APIs using Capacitor:

- `window.ipcRenderer` → HTTP API calls
- `window.config` → Preferences API + API sync
- `window.macaddress` → Device.getId()
- `window.fs` → Filesystem API (limited)
- `window.log` → Console logging

All existing frontend JavaScript code works without modification.

## Support

For issues or questions:
- Email: sales@closed-loop.biz
- Website: www.closed-loop.biz

## Version History

- **v2.8.0** - Initial mobile app support with Capacitor
  - Android and iOS app builds
  - Full dashboard and control panel
  - Configuration and activation pages
  - Native device APIs integration

---

© 2025 Closed-Loop Technology Pte. Ltd. All rights reserved.
