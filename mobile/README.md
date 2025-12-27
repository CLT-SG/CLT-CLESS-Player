# eCLESS Player Mobile Application

## Overview

This document provides comprehensive instructions for building and deploying Android and iOS mobile applications from the eCLESS Player Electron project. The mobile version utilizes Capacitor to wrap the existing web frontend, providing native mobile APIs while maintaining full feature parity with the desktop application.

## Quick Navigation

- [Ionic Appflow Cloud Build Setup](docs_mobile/IONIC-APPFLOW-SETUP.md)
- [Prerequisites](#prerequisites)
- [Installation Steps](#installation-steps)
- [Build Commands](#build-commands-reference)

## Application Architecture

The mobile application provides dual interfaces:

### 1. CMS Player (index.html)
Primary content display interface featuring layout XML rendering, media playback (images, videos, HLS/FLV streams), content slot management (text, ticker, datetime, tables, HTML), offline mode with localStorage caching, and real-time updates via Socket.IO.

### 2. Dashboard (dashboard.html)
Remote control and monitoring interface with layout switching, content management, system monitoring (CPU, memory, network), and device configuration capabilities.

### Project Structure

```
ecless-player-electron/
├── src/                    # Electron frontend source
│   ├── index.html          # CMS Player source
│   ├── cpanel.html         # Dashboard source
│   └── assets/             # Shared assets
├── mobile/                 # Mobile application directory
│   ├── www/                # Compiled web assets
│   │   ├── index.html      # CMS Player (generated)
│   │   ├── dashboard.html  # Dashboard (generated)
│   │   └── assets/js/mobile/
│   │       ├── mobile-electron-shim.js      # Electron API compatibility
│   │       ├── mobile-config.js             # Configuration loader
│   │       ├── mobile-socketio-manager.js   # Socket.IO manager
│   │       └── mobile-layout-handler.js     # Viewport management
│   ├── android/            # Android project (generated)
│   ├── ios/                # iOS project (generated)
│   └── resources/          # App icons and splash screens
```

## Prerequisites

### Android Development

1. Node.js v16 or later
2. Android Studio with Android SDK
   - Android SDK Platform 34
   - Android SDK Build-Tools 34.0.0+
   - Configure SDK location:
     ```bash
     export ANDROID_HOME=$HOME/Android/Sdk
     export PATH=$PATH:$ANDROID_HOME/platform-tools
     ```
3. Java Development Kit (JDK 17)

### iOS Development (macOS only)

1. Xcode v14 or later with Command Line Tools
2. CocoaPods: `sudo gem install cocoapods`

## Installation Steps

### Step 1: Install Dependencies

```bash
cd mobile
npm install
```

### Step 2: Build Web Assets

```bash
npm run build
```

This command copies source files from `src/` to `mobile/www/`, removes Electron-specific code, injects Capacitor Core and mobile-specific scripts, and configures Socket.IO with dynamic server connection.

### Step 3: Add Mobile Platforms

```bash
# Android
npm run add:android

# iOS (macOS only)
npm run add:ios
```

### Step 4: Build and Run

**Android:**
```bash
npm run build:android
```
Opens Android Studio. Select a device/emulator and click "Run" (Shift + F10).

**iOS (macOS only):**
```bash
npm run build:ios
```
Opens Xcode. Select a simulator/device and click "Run" (Cmd + R).

## Build Commands Reference

| Command | Description |
|---------|-------------|
| `npm run build` | Build web assets from Electron source |
| `npm run build:android` | Build and open Android project |
| `npm run build:ios` | Build and open iOS project |
| `npm run sync` | Sync web assets to all platforms |
| `npm run open:android` | Open Android Studio |
| `npm run open:ios` | Open Xcode |
| `npm run clean` | Clean generated files |
| `npm run generate:icons` | Generate app icons |

## Production Release

### Android Release Build

1. Generate signing key:
   ```bash
   keytool -genkey -v -keystore ecless-release-key.keystore \
     -alias ecless-player -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Build release APK:
   ```bash
   cd android && ./gradlew assembleRelease
   ```
   Output: `android/app/build/outputs/apk/release/app-release.apk`

3. Build release AAB for Google Play:
   ```bash
   cd android && ./gradlew bundleRelease
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`

### iOS Release Build (macOS only)

1. Configure Apple Developer Account in Xcode
2. Set up provisioning profiles and signing certificates
3. Archive: Product → Archive in Xcode
4. Distribute via Xcode Organizer

## Configuration

### Server Connection
Configure server URL in `mobile/www/assets/js/mobile/mobile-config.js`:
```javascript
const defaultConfig = {
    hostserver: 'https://your-ecless-server.com',
    id: 'your-display-id',
    mode: 'online'
};
```

### App Icons and Splash Screens
Place assets in `mobile/resources/android/` and `mobile/resources/ios/`. Run `npm run generate:icons` to create all required sizes automatically.

## Troubleshooting

### Android Build Issues

**SDK location not found:**
```bash
export ANDROID_HOME=$HOME/Android/Sdk
echo "sdk.dir=$ANDROID_HOME" > mobile/android/local.properties
```

**Gradle build fails:**
```bash
cd android && ./gradlew clean && cd ..
npm run sync:android
```

### iOS Build Issues

**CocoaPods not installed:**
```bash
sudo gem install cocoapods
cd ios/App && pod install
```

**Xcode signing errors:**
Open `ios/App.xcworkspace` in Xcode, select project, go to "Signing & Capabilities", and select your Apple Developer team.

### Web Assets Not Updating
```bash
npm run clean
npm run build
npm run sync
```

## Platform Differences

| Feature | Electron | Mobile (Capacitor) |
|---------|----------|-------------------|
| Window Management | Native OS windows | Single fullscreen app |
| File System | Full Node.js fs module | Capacitor Filesystem API |
| Configuration | Local config.json file | Preferences API + API sync |
| Serial Key | MAC address | Device ID |
| Auto-startup | OS startup scripts | N/A |

## Technical Details

### Mobile-Specific Adaptations

**Electron API Compatibility Layer** (`mobile-electron-shim.js`):
- `window.log` - Console logging (replaces electron-log)
- `window.xmljs` - XML to JSON conversion
- `window.datetime` - Date formatting utilities
- `window.path` - Path manipulation
- `window.os` - Operating system info
- `window.fs` - File system stubs (localStorage fallback)
- `window.ipcRenderer` - IPC events (browser event system)
- `window.remote` - Remote module (app lifecycle methods)

**Socket.IO Connection Management**:
- Dynamic server configuration from config.json
- Automatic reconnection on network changes
- Background/foreground lifecycle support
- Graceful degradation when server unreachable

**Viewport Management** (`mobile-layout-handler.js`):
- Automatic scale calculation for fixed layouts
- Dynamic viewport meta tag updates
- Orientation change handling
- Maintains aspect ratios across devices

## Testing on Physical Devices

### Android Device Testing
1. Enable Developer Options: Settings → About Phone → Tap "Build number" 7 times
2. Enable USB Debugging: Settings → Developer Options → USB Debugging
3. Connect device via USB
4. Run `npm run build:android` and select device in Android Studio

### iOS Device Testing (macOS only)
1. Connect device via USB and trust computer
2. Open project: `npm run open:ios`
3. Select device in Xcode and click "Run"
4. May require Apple Developer account for device deployment

## Support

- Email: sales@closed-loop.biz / fahmi@closed-loop.biz
- Website: www.closed-loop.biz

## Version History

- **v2.8.0** - Initial mobile app support with Capacitor
  - Android and iOS builds
  - Full dashboard and control panel
  - Native device APIs integration
  - Electron API compatibility layer

---

Copyright 2025 Closed-Loop Technology Pte. Ltd. All rights reserved.
