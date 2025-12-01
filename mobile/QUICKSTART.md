# eCLESS Player Mobile - Quick Start

Get the eCLESS Player running on Android/iOS in 5 minutes.

## Prerequisites

- Node.js 16+
- Android Studio (for Android)
- Xcode (for iOS, macOS only)

## Quick Build - Android

```bash
# 1. Navigate to mobile directory
cd mobile

# 2. Install dependencies
npm install

# 3. Build web assets
npm run build

# 4. Add Android platform (first time only)
npm run add:android

# 5. Open in Android Studio and run
npm run build:android
```

From Android Studio: Click **Run** button or press `Shift + F10`

## Quick Build - iOS (macOS only)

```bash
# 1. Navigate to mobile directory
cd mobile

# 2. Install dependencies
npm install

# 3. Build web assets
npm run build

# 4. Add iOS platform (first time only)
npm run add:ios

# 5. Open in Xcode and run
npm run build:ios
```

From Xcode: Click **Run** button or press `Cmd + R`

## Build Release APK

```bash
cd mobile/android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

## Common Commands

```bash
npm run build          # Rebuild web assets
npm run sync          # Sync to all platforms
npm run clean         # Clean generated files
```

## Configuration

Edit `mobile/www/assets/js/mobile-config.js` to set default server:

```javascript
const defaultConfig = {
    hostserver: 'https://your-server.com',
    id: 'your-display-id'
};
```

## Need Help?

See full documentation: [mobile/README.md](./README.md)

Email: sales@closed-loop.biz
