# eCLESS Player Mobile - Build & Install Guide

## Prerequisites

### Required Software
- **Node.js** (v16 or higher): `node --version`
- **npm**: `npm --version`
- **Java JDK** (v11 or v17): `java -version`
- **Android SDK**: Android Studio or command-line tools
- **Gradle**: Usually bundled with Android project

### Android SDK Setup
```bash
# Set ANDROID_HOME environment variable
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

---

## Quick Build & Install (Using Debug Keystore)

This is the **fastest way** to build and test your APK:

### Step 1: Install Dependencies
```bash
cd /home/clt-dev/app/ecless-player-electron/mobile
npm install
```

### Step 2: Build Web Assets
```bash
npm run build
```

This will:
- Copy files from `src/` to `mobile/www/`
- Remove Electron-specific code
- Add Capacitor mobile initialization
- Bundle Capacitor modules
- Update version numbers

### Step 3: Sync with Capacitor
```bash
npx cap sync android
```

This copies web assets to the Android project.

### Step 4: Build Signed APK
```bash
cd android
./gradlew assembleRelease
```

The APK will be built with the **debug keystore** (fallback signing) and will be located at:
```
android/app/build/outputs/apk/release/ecless-player_v3.1.6.apk
```

### Step 5: Install APK
```bash
# List connected devices
adb devices

# Install APK (replace emulator-5554 with your device ID)
adb -s emulator-5554 install app/build/outputs/apk/release/ecless-player_v3.1.6.apk

# Or use simple install command if only one device is connected
adb install app/build/outputs/apk/release/ecless-player_v3.1.6.apk
```

✅ **The APK should now install successfully!**

---

## Production Build (Using Release Keystore)

For **production releases** or **Google Play Store** publishing, create a proper release keystore.

See **[KEYSTORE-SETUP.md](./KEYSTORE-SETUP.md)** for detailed instructions.

### Quick Steps:
1. Generate keystore:
```bash
cd /home/clt-dev/app/ecless-player-electron/mobile/android
keytool -genkeypair -v -keystore ecless-player-release.keystore -alias ecless-player-key -keyalg RSA -keysize 2048 -validity 10000
```

2. Create `keystore.properties`:
```bash
cp keystore.properties.example keystore.properties
# Edit keystore.properties with your credentials
```

3. Build APK:
```bash
cd /home/clt-dev/app/ecless-player-electron/mobile
npm run build
cd android
./gradlew assembleRelease
```

---

## NPM Scripts Reference

```bash
# Build web assets from src/ to www/
npm run build

# Build and open Android Studio
npm run build:android

# Build and open Xcode (iOS)
npm run build:ios

# Sync web assets to native platforms
npm run sync

# Sync to Android only
npm run sync:android

# Sync to iOS only
npm run sync:ios

# Open Android Studio
npm run open:android

# Open Xcode
npm run open:ios

# Generate app icons
npm run generate:icons

# Clean build artifacts
npm run clean
```

---

## Gradle Build Commands

```bash
cd mobile/android

# Build debug APK (auto-signed with debug keystore)
./gradlew assembleDebug

# Build release APK (signed with keystore.properties or debug fallback)
./gradlew assembleRelease

# Build and install debug APK on connected device
./gradlew installDebug

# Build and install release APK on connected device
./gradlew installRelease

# Clean build artifacts
./gradlew clean

# Build Android App Bundle (AAB) for Play Store
./gradlew bundleRelease
```

---

## Common Issues & Solutions

### Issue 1: "INSTALL_PARSE_FAILED_NO_CERTIFICATES"
**Cause:** APK is not signed
**Solution:** 
- Build.gradle now has automatic debug keystore fallback
- Simply rebuild: `./gradlew assembleRelease`
- For production, create keystore.properties (see [KEYSTORE-SETUP.md](./KEYSTORE-SETUP.md))

### Issue 2: "App not installed"
**Cause:** Different signing key or version conflict
**Solution:**
```bash
# Uninstall existing app first
adb uninstall biz.closedloop.ecless.player

# Then reinstall
adb install app/build/outputs/apk/release/ecless-player_v3.1.6.apk
```

### Issue 3: "Failed to install app. Could not find or parse package"
**Cause:** APK file path is incorrect
**Solution:** Verify the APK path:
```bash
ls -lh app/build/outputs/apk/release/
# Should show: ecless-player_v3.1.6.apk
```

### Issue 4: "Gradle daemon disappeared unexpectedly"
**Cause:** Insufficient memory
**Solution:**
```bash
# Increase Gradle memory in gradle.properties
echo "org.gradle.jvmargs=-Xmx2048m" >> android/gradle.properties

# Or kill existing Gradle daemons
./gradlew --stop
```

### Issue 5: "SDK location not found"
**Cause:** ANDROID_HOME not set
**Solution:**
```bash
# Create local.properties
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
```

### Issue 6: Build fails with "Duplicate resources"
**Cause:** Both file.js and file.js.gz exist
**Solution:** Already fixed in build-mobile.cjs (skips .gz files)

---

## Version Management

The app version is managed in `mobile/package.json`:
```json
{
  "version": "3.1.6"
}
```

When you run `npm run build`, the version is automatically synced to:
- `android/app/build.gradle` (versionName and versionCode)
- APK filename (e.g., `ecless-player_v3.1.6.apk`)

To change the version:
```bash
cd /home/clt-dev/app/ecless-player-electron/mobile
npm version patch  # 3.1.6 → 3.1.7
npm version minor  # 3.1.7 → 3.2.0
npm version major  # 3.2.0 → 4.0.0
```

---

## Testing on Device/Emulator

### Test on Emulator
```bash
# List running emulators
adb devices

# Start an emulator (if none running)
emulator -list-avds
emulator -avd Pixel_4_API_30 &

# Install and launch
adb install app/build/outputs/apk/release/ecless-player_v3.1.6.apk
adb shell am start -n biz.closedloop.ecless.player/.MainActivity
```

### Test on Physical Device
```bash
# Enable USB debugging on your Android device
# Connect device via USB

# Verify device is detected
adb devices

# Install
adb install app/build/outputs/apk/release/ecless-player_v3.1.6.apk
```

### View Logs
```bash
# View all logs
adb logcat

# Filter by app package
adb logcat | grep "biz.closedloop.ecless"

# Clear logs
adb logcat -c
```

---

## Build Output Locations

```
mobile/android/app/build/outputs/
├── apk/
│   ├── debug/
│   │   └── ecless-player_v3.1.6-debug.apk
│   └── release/
│       └── ecless-player_v3.1.6.apk
└── bundle/
    └── release/
        └── ecless-player_v3.1.6.aab  (for Play Store)
```

---

## Complete Build Workflow

```bash
# 1. Navigate to mobile directory
cd /home/clt-dev/app/ecless-player-electron/mobile

# 2. Update version if needed
npm version patch

# 3. Install/update dependencies
npm install

# 4. Build web assets
npm run build

# 5. Sync to Android
npx cap sync android

# 6. Build signed APK
cd android
./gradlew clean assembleRelease

# 7. Verify APK is signed
jarsigner -verify -verbose -certs app/build/outputs/apk/release/ecless-player_v3.1.6.apk

# 8. Install on device
cd ..
adb install android/app/build/outputs/apk/release/ecless-player_v3.1.6.apk

# 9. Launch app
adb shell am start -n biz.closedloop.ecless.player/.MainActivity

# 10. Monitor logs
adb logcat | grep "eCLESS"
```

---

## Troubleshooting Checklist

Before reporting issues, check:

- [ ] Node.js and npm are installed (`node --version`, `npm --version`)
- [ ] Java JDK is installed (`java -version`)
- [ ] ANDROID_HOME is set (`echo $ANDROID_HOME`)
- [ ] Android SDK is installed
- [ ] Dependencies are installed (`npm install`)
- [ ] Web assets are built (`npm run build`)
- [ ] No Gradle daemons are stuck (`./gradlew --stop`)
- [ ] Device is connected and authorized (`adb devices`)
- [ ] APK file exists at expected location
- [ ] Previous app version is uninstalled (if testing with different signing)

---

## Next Steps

1. **Configure the app:** Open the app and go to Settings
2. **Set server address:** Configure your CMS server URL
3. **Activate license:** Enter your activation key
4. **Test playback:** Navigate to the player and verify media playback

For production deployment, see:
- **[KEYSTORE-SETUP.md](./KEYSTORE-SETUP.md)** - Release signing guide
- **[../docs/DEPLOYMENT-CHECKLIST.md](../docs/DEPLOYMENT-CHECKLIST.md)** - Full deployment checklist

---

## Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Build Documentation](https://developer.android.com/studio/build)
- [Gradle Build Tool](https://docs.gradle.org/)
- [ADB Commands Reference](https://developer.android.com/studio/command-line/adb)
