# eCLESS Player - Mobile App Support

## Mobile Apps Now Available

eCLESS Player now supports Android and iOS mobile applications built from the same codebase as the desktop Electron app. Access your display control dashboard on any mobile device.

## Features

- Full control panel dashboard on mobile
- Configuration and activation pages
- Real-time system monitoring
- Layout and content management
- Remote display viewing
- Network-based synchronization

## Quick Start

Navigate to the `mobile/` directory and follow the setup guide:

```bash
cd mobile
npm install
npm run build
npm run add:android    # For Android
npm run build:android  # Opens Android Studio
```

See [mobile/README.md](./mobile/README.md) for complete documentation.

## Documentation

- **[README.md](./mobile/README.md)** - Complete setup and build guide
- **[QUICKSTART.md](./mobile/QUICKSTART.md)** - 5-minute quick start guide
- **[DEVELOPMENT.md](./mobile/DEVELOPMENT.md)** - Architecture and development notes

## Platform Support

| Platform | Minimum Version | Status |
|----------|----------------|--------|
| Android | 8.0 (API 26) | ✅ Supported |
| iOS | 12.0+ | ✅ Supported |

## Architecture

Built with **Capacitor** - a modern cross-platform app runtime that wraps web applications with native mobile APIs. The mobile version:

- Reuses existing HTML/CSS/JavaScript frontend
- No modification to Electron desktop app
- Provides Electron-like APIs using Capacitor plugins
- Maintains configuration compatibility

## Key Differences

| Feature | Desktop (Electron) | Mobile (Capacitor) |
|---------|-------------------|-------------------|
| Platform | Windows, Linux, macOS | Android, iOS |
| Configuration | Local file system | Preferences API + Server sync |
| Device ID | MAC address | Device UUID |
| Window Management | Multi-window | Single fullscreen app |
| Installation | Installer (EXE, DEB) | App Store, APK |

## Build Process

```
src/ (Electron frontend)
    ↓ (build-mobile.js)
mobile/www/ (Mobile web assets)
    ↓ (Capacitor)
mobile/android/ (Native Android project)
mobile/ios/ (Native iOS project)
```

## Distribution

### Android
- **APK**: Direct installation on devices
- **AAB**: Google Play Store distribution

### iOS
- **IPA**: TestFlight or enterprise distribution
- **App Store**: Public App Store distribution

## Requirements

- Node.js 16+
- Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)

## Support

For mobile app questions:
- Email: sales@closed-loop.biz
- Documentation: See `mobile/` directory

---

© 2025 Closed-Loop Technology Pte. Ltd
