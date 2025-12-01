# Mobile App Development Notes

## Architecture Decisions

### Why Capacitor over Cordova?

1. **Modern Architecture**: Built on web standards, better TypeScript support
2. **Electron-like APIs**: Similar plugin architecture to Electron
3. **Native Projects**: Keep full Android Studio/Xcode projects for customization
4. **Active Development**: Strong community and regular updates
5. **Easy Migration**: Simple to add native code when needed

### Code Separation Strategy

The mobile implementation maintains complete separation from Electron:

```
Electron Code (Untouched)
├── src/              - Original HTML/CSS/JS
├── index.js          - Electron main process
├── preload.js        - Electron preload
└── package.json      - Electron dependencies

Mobile Code (New)
├── mobile/
│   ├── www/          - Built web assets
│   ├── android/      - Native Android project
│   ├── ios/          - Native iOS project
│   └── build-mobile.js  - Build script
```

No Electron files are modified - all mobile-specific changes happen during build.

## Implementation Details

### 1. API Compatibility Layer

`mobile/www/assets/js/mobile-config.js` provides:
- `window.ipcRenderer` → HTTP API wrapper
- `window.config` → Capacitor Preferences
- `window.macaddress` → Device ID
- `window.fs` → Stubs (limited filesystem)
- `window.log` → Console logging

### 2. Build Process

`mobile/build-mobile.js`:
1. Copies HTML files from `src/`
2. Removes Electron script tags
3. Injects Capacitor scripts
4. Copies assets directory
5. Replaces IPC references

### 3. Configuration Management

**Electron**: Reads `~/clessapp/config.json`
**Mobile**: Uses Capacitor Preferences API + server sync

Both maintain same configuration structure for compatibility.

### 4. Platform-Specific Features

| Feature | Implementation |
|---------|---------------|
| Network Detection | Capacitor Network API |
| Device Info | Capacitor Device API |
| Storage | Capacitor Preferences API |
| Status Bar | Capacitor StatusBar API |
| Back Button | Capacitor App API |
| App State | Capacitor App API listeners |

## Limitations

### Not Available on Mobile

1. **Window Management**: No multi-window support
2. **System Commands**: No shutdown/reboot
3. **Display Control**: No external display management
4. **Auto-startup**: Mobile apps don't auto-start on boot
5. **File System**: Limited access compared to Electron
6. **Serial Keys**: Uses device ID instead of MAC address

### Workarounds

- **Configuration**: Use in-app settings with API sync
- **Remote Control**: All layout/content control via API
- **Monitoring**: Dashboard shows system status
- **Updates**: Use app store updates or OTA web updates

## Testing Strategy

### Development Testing

1. **Browser Testing**: Test `www/` in Chrome DevTools
2. **Emulator Testing**: Android Studio emulator / iOS Simulator
3. **Device Testing**: Physical Android/iOS devices

### Production Testing

1. **Release Builds**: Test signed APK/IPA files
2. **API Compatibility**: Test with production eCLESS server
3. **Network Scenarios**: Test offline mode, poor connectivity
4. **Performance**: Monitor memory, battery usage

## Future Enhancements

### Potential Additions

1. **Offline Mode Improvements**
   - Better caching strategy
   - Service worker for offline assets
   - IndexedDB for layout storage

2. **Push Notifications**
   - Server → mobile notifications
   - Layout update alerts
   - System status alerts

3. **Background Sync**
   - Sync configuration changes
   - Update layouts in background
   - Health check pings

4. **Native Features**
   - QR code scanner for activation
   - Biometric authentication
   - Share screenshots

### Technical Debt

- Add automated testing (Jest, Playwright)
- CI/CD pipeline for mobile builds
- App signing automation
- Screenshot/icon generation automation

## Build Optimization

### APK Size Reduction

Current APK ~15-20MB. To reduce:

1. **Enable ProGuard** (minification):
   ```gradle
   buildTypes {
       release {
           minifyEnabled true
           shrinkResources true
       }
   }
   ```

2. **Remove unused assets**:
   - Compress images (WebP format)
   - Remove unused fonts
   - Tree-shake JavaScript

3. **App Bundles**: Use AAB instead of APK
   ```bash
   ./gradlew bundleRelease
   ```

### Performance Optimization

1. **Lazy Loading**: Load assets on-demand
2. **Image Optimization**: Use responsive images
3. **Code Splitting**: Split JavaScript bundles
4. **Caching**: Implement service worker caching

## Security Considerations

### Current Implementation

- HTTPS for all API calls
- Secure storage via Preferences API
- No sensitive data in localStorage
- SSL pinning possible via native code

### Recommendations

1. **API Authentication**: Implement JWT tokens
2. **Certificate Pinning**: Pin eCLESS server certificates
3. **Code Obfuscation**: Enable R8/ProGuard
4. **Root Detection**: Add root/jailbreak detection
5. **Secure Communication**: Encrypt sensitive preferences

## Maintenance

### Regular Updates

1. **Capacitor Updates**:
   ```bash
   npm update @capacitor/core @capacitor/cli
   npm run sync
   ```

2. **Android SDK Updates**: Update via Android Studio
3. **iOS SDK Updates**: Update via Xcode
4. **Dependencies**: Run `npm audit` regularly

### Version Management

- Electron version: Follows main project (currently 2.7.5)
- Mobile version: Separate versioning (currently 2.8.0)
- Capacitor version: Update quarterly

## Deployment Checklist

### Before Release

- [ ] Test on multiple Android versions (8.0+)
- [ ] Test on multiple iOS versions (12.0+)
- [ ] Test different screen sizes (phone, tablet)
- [ ] Test network conditions (WiFi, 4G, offline)
- [ ] Update app icons and splash screens
- [ ] Update privacy policy and terms
- [ ] Configure Google Play/App Store listings
- [ ] Generate release signing keys
- [ ] Test release builds on physical devices
- [ ] Document known issues

### App Store Submission

**Google Play:**
1. Create app listing
2. Upload AAB file
3. Add screenshots (2-8 per device type)
4. Complete content rating questionnaire
5. Set pricing and distribution

**Apple App Store:**
1. Create app in App Store Connect
2. Upload IPA via Xcode
3. Add screenshots (required for all device sizes)
4. Complete app information
5. Submit for review

---

Last Updated: December 2025
Author: Closed-Loop Technology Pte. Ltd
