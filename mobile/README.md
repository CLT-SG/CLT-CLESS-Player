# eCLESS Player Mobile App - Setup Guide

## Overview

This guide explains how to build Android and iOS mobile applications from the eCLESS Player Electron project. The mobile version uses **Capacitor** to wrap the existing web frontend, providing native mobile APIs while preserving all functionality.

## 🚀 Quick Links

- **[Ionic Appflow Cloud Build Setup](docs_mobile/IONIC-APPFLOW-SETUP.md)** - CI/CD setup for automated builds
- **[Local Development Setup](#prerequisites)** - Build locally on your machine
- **[Build Instructions](#installation-steps)** - Step-by-step local build guide

## Architecture

The mobile app provides **TWO main interfaces**:

1. **CMS Player** (index.html) - The main content player that displays layouts, media, and content
2. **Dashboard** (dashboard.html) - Remote control panel for managing the player

```
ecless-player-electron/
├── src/                    # Original Electron frontend (untouched)
│   ├── index.html          # CMS Player (source)
│   ├── cpanel.html         # Dashboard (source)
│   └── assets/             # Shared assets
├── index.js                # Electron main process (untouched)
├── mobile/                 # Mobile app directory
│   ├── www/                # Built web assets for mobile
│   │   ├── index.html      # ✨ CMS Player (Main App - plays layouts/media)
│   │   ├── dashboard.html  # 🎛️ Control Panel (remote management)
│   │   ├── configure.html  # ⚙️ Configuration page
│   │   ├── activate.html   # 🔑 Activation page
│   │   └── assets/         # CSS, JS, images
│   │       └── js/
│   │           ├── mobile-electron-shim.js      # Electron API compatibility
│   │           ├── mobile-config.js             # Configuration loader
│   │           ├── mobile-socketio-manager.js   # Socket.IO connection manager
│   │           └── mobile-socketio-adapter.js   # Socket.IO adapter
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
   - Install Android SDK Platform 34 (or the version specified in `android/variables.gradle`)
   - Install Android SDK Build-Tools (version 34.0.0 or later)
   - **Configure Android SDK Location** (CRITICAL):
     
     **Option 1: Set Environment Variables (Recommended)**
     Add to your `~/.bashrc` or `~/.zshrc`:
     ```bash
     export ANDROID_HOME=$HOME/Android/Sdk
     export ANDROID_SDK_ROOT=$HOME/Android/Sdk
     export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools
     ```
     Then reload your shell:
     ```bash
     source ~/.bashrc  # or source ~/.zshrc
     ```
     
     **Option 2: Create local.properties File**
     Create `mobile/android/local.properties` (auto-generated after first Android Studio sync):
     ```properties
     sdk.dir=/home/YOUR_USERNAME/Android/Sdk
     ```
     **Note**: Replace `/home/YOUR_USERNAME` with your actual home directory path.
     
     **Important**: The `local.properties` file contains machine-specific paths and should NOT be committed to version control. It's already included in `.gitignore`.

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
- Copy `src/index.html` → `mobile/www/index.html` (CMS Player)
- Copy `src/cpanel.html` → `mobile/www/dashboard.html` (Control Panel)
- Copy configuration and activation pages
- Copy all assets (CSS, JS, images, excluding .gz files)
- Remove Electron-specific code (preload.js references)
- Inject Capacitor Core and mobile-specific scripts
- Add Electron API shims for mobile compatibility
- Configure Socket.IO with dynamic server connection
- Add navigation buttons between player and dashboard

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

## Mobile App Architecture

### Dual-Interface Design

The mobile app provides two distinct interfaces:

#### 1. **CMS Player** (`index.html`)
- **Purpose**: Primary content display application
- **Features**:
  - Plays layout XML from eCLESS server
  - Displays media (images, videos, HLS/FLV streams)
  - Renders content slots (text, ticker, scroller, fader, datetime, tables, HTML)
  - Handles layout loops and scheduling
  - Offline mode with localStorage caching
  - Real-time content updates via Socket.IO
- **Entry Point**: App launches to this screen by default
- **Navigation**: "Dashboard" button in top-right corner

#### 2. **Dashboard** (`dashboard.html`)
- **Purpose**: Remote control and monitoring interface
- **Features**:
  - View current layout and content
  - Switch layouts remotely
  - Update text and media slots
  - System monitoring (CPU, memory, network)
  - Configuration management
  - Device information display
- **Access**: Via "Dashboard" button from CMS Player
- **Navigation**: "Back to Player" button returns to CMS Player

### Mobile-Specific Adaptations

#### Socket.IO Connection Management
- **Dynamic Server Configuration**: Reads server address from config.json
- **Automatic Reconnection**: Handles network changes and app lifecycle
- **Background/Foreground Support**: Reconnects when app resumes
- **Fallback Handling**: Graceful degradation when server unreachable

#### Electron API Compatibility Layer
The app includes a comprehensive shim (`mobile-electron-shim.js`) that provides:
- `window.log` - Console-based logging (replaces electron-log)
- `window.xmljs` - XML to JSON conversion (browser-based parser)
- `window.datetime` - Date formatting utilities
- `window.path` - Path manipulation (browser-compatible)
- `window.os` - Operating system info (mobile-adapted)
- `window.fs` - File system stubs (localStorage fallback)
- `window.dns` - DNS lookup stubs
- `window.isReachable` - Network reachability checks (fetch-based)
- `window.ipcRenderer` - IPC events (browser event system)
- `window.remote` - Remote module (app lifecycle methods)

#### Configuration Management
- **Storage**: Uses Capacitor Filesystem API or localStorage
- **Location**: `Documents/ecless/config.json` on device
- **Format**: JSON with same structure as Electron version
- **Auto-loading**: Config loaded before app initialization
- **Hot Reload**: Configuration changes dispatch update events

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
| `npm run generate:icons` | Generate Android icons from source |
| `npm run generate:icons:all` | Generate icons for all platforms |

## App Icon and Splash Screen Management

### Overview

The mobile app uses the same icons as the desktop Electron app, automatically generating all required sizes for Android and iOS. Icons are sourced from `../build/icons/linux/512x512.png`.

### Icon Resources

Icon source files are located in `mobile/resources/`:
- `icon-only.png` - Main app icon (512x512px)
- `icon-foreground.png` - Adaptive icon foreground layer (512x512px)
- `splash.png` - Splash screen image (512x512px)

### Quick Start: Update Icons

To update the app icon, simply run:

```bash
npm run generate:icons
```

This will automatically:
1. Use the source icon from `resources/`
2. Generate all Android icon sizes (ldpi, mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
3. Create adaptive icons for Android 8.0+ devices
4. Generate splash screens for all orientations and densities

### Manual Icon Update Process

If you need to change the source icon:

```bash
# 1. Copy new icon (must be 512x512px PNG)
cp ../build/icons/linux/512x512.png resources/icon-only.png
cp ../build/icons/linux/512x512.png resources/icon-foreground.png
cp ../build/icons/linux/512x512.png resources/splash.png

# 2. Generate all icon sizes
npm run generate:icons

# 3. Sync with Android project
npm run sync:android

# 4. Rebuild the app
npm run build:android
```

### Verify Icon Installation

Run the verification script to confirm all icons are properly installed:

```bash
./verify-icons.sh
```

Expected output:
```
✅ All icons verified successfully!
  ✓ Source icons in resources/
  ✓ Generated icons in all mipmap densities (ldpi to xxxhdpi)
  ✓ Adaptive icon XML descriptors
  ✓ Splash screens for all orientations
```

### Generated Icon Assets

The icon generation tool automatically creates:

**App Icons** (in `android/app/src/main/res/mipmap-*/`):
- `ic_launcher.png` - Standard square launcher icons
- `ic_launcher_round.png` - Round launcher icons
- `ic_launcher_foreground.png` - Adaptive icon foreground layers
- Adaptive icon XML descriptors (Android 8.0+)

**Splash Screens** (in `android/app/src/main/res/drawable-*/`):
- Portrait splash screens (all densities)
- Landscape splash screens (all densities)

### Icon Specifications

| Density | Icon Size | Example Device |
|---------|-----------|----------------|
| ldpi | 36x36 | Low-density screens |
| mdpi | 48x48 | Medium-density screens |
| hdpi | 72x72 | High-density screens |
| xhdpi | 96x96 | Extra-high-density screens |
| xxhdpi | 144x144 | Extra-extra-high-density |
| xxxhdpi | 192x192 | Extra-extra-extra-high-density |

### Troubleshooting Icons

**Icons not updating on device?**

1. Clean the Android build:
   ```bash
   cd android && ./gradlew clean && cd ..
   ```

2. Regenerate icons:
   ```bash
   npm run generate:icons
   ```

3. Reinstall the app:
   ```bash
   npm run build:android
   ```

**Icon appears blurry?**
- Ensure source icon is at least 512x512px
- Use PNG format with transparent background
- Verify icon quality with `identify resources/icon-only.png`

For detailed icon management documentation, see [ICONS-README.md](./ICONS-README.md).

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

   Test and debug the apk file first
   ```bash
   adb devices
   adb -s device-id install app/build/outputs/apk/release/app-release.apk
   ```

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

The default server URL can be modified in `mobile/www/assets/js/mobile/mobile-config.js`:

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

#### **Problem**: SDK location not found / Gradle dependency resolution error

**Error Message**:
```
Could not determine the dependencies of task ':app:compileDebugJavaWithJavac'.
SDK location not found. Define a valid SDK location with an ANDROID_HOME 
environment variable or by setting the sdk.dir path in your project's 
local properties file at '.../mobile/android/local.properties'.
```

**Root Cause**: Gradle cannot locate the Android SDK, which is required for compiling the Android app. This happens when neither `ANDROID_HOME` environment variable is set nor `local.properties` file exists.

**Solution 1 - Set Environment Variables (Recommended - Permanent Fix)**:
```bash
# Add to ~/.bashrc or ~/.zshrc
echo 'export ANDROID_HOME=$HOME/Android/Sdk' >> ~/.bashrc
echo 'export ANDROID_SDK_ROOT=$HOME/Android/Sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools' >> ~/.bashrc

# Reload shell configuration
source ~/.bashrc  # or source ~/.zshrc for zsh
```

**Solution 2 - Create local.properties File (Quick Fix)**:
```bash
# Navigate to Android project directory
cd mobile/android

# Create local.properties with your SDK path
echo "sdk.dir=$HOME/Android/Sdk" > local.properties

# Verify the file was created
cat local.properties
```

**Verification Steps**:
```bash
# 1. Check environment variables
echo $ANDROID_HOME
# Should output: /home/YOUR_USERNAME/Android/Sdk

# 2. Check if local.properties exists
cat mobile/android/local.properties
# Should show: sdk.dir=/home/YOUR_USERNAME/Android/Sdk

# 3. Test Gradle build
cd mobile/android
./gradlew tasks --no-daemon
# Should list available Gradle tasks without errors

# 4. Build the app
./gradlew assembleDebug --no-daemon
# Should complete with "BUILD SUCCESSFUL"
```

**Common SDK Locations**:
- Linux: `$HOME/Android/Sdk` or `/usr/lib/android-sdk`
- macOS: `$HOME/Library/Android/sdk`
- Windows: `C:\Users\<username>\AppData\Local\Android\Sdk`

**Finding Your SDK Location**:
```bash
# Check if Android SDK is installed
ls -la ~/Android/Sdk

# Or check Android Studio settings:
# Android Studio → Settings → Appearance & Behavior → System Settings → Android SDK
```

**Important Notes**:
- ⚠️ **DO NOT commit** `local.properties` to version control (it's in `.gitignore`)
- The file contains machine-specific paths that vary between development environments
- Each developer needs to create their own `local.properties` file

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
