# CORS Issue Fix for eCLESS Player Mobile App

## Issue Description
The mobile app was unable to load XML layouts from `https://cless4.closed-loop.biz/demo/206/ds.xml` due to CORS policy blocking fetch requests from the native WebView (`https://app.ecless.local`). Error: "No 'Access-Control-Allow-Origin' header is present on the requested resource."

## Root Cause Analysis
1. The app was attempting to use `window.Capacitor.Plugins.Http` which didn't exist
2. Missing import of `CapacitorHttp` from `@capacitor/core` (in Capacitor 6, it's built-in, not a separate plugin)
3. Fallback to browser `fetch()` API which respects CORS policies
4. Android network security configuration not allowing cleartext traffic

## Changes Implemented

### 1. Capacitor HTTP Plugin Integration
**File: `mobile/www/assets/js/mobile/capacitor-core.js`**
- ✅ Imported `CapacitorHttp` from `@capacitor/core`
- ✅ Added `CapacitorHttp` to the plugins object
- ✅ Exported properly for use in other modules

### 2. Mobile HTTP Module Fix
**File: `mobile/www/assets/js/mobile/mobile-http.js`**
- ✅ Updated to use `window.Capacitor.Plugins.CapacitorHttp` (correct API)
- ✅ Enhanced native platform detection with fallback logic
- ✅ Added comprehensive logging for debugging
- ✅ Fixed XML parsing to handle response.data correctly
- ✅ Added JSON parsing support

**Key changes:**
```javascript
// OLD (incorrect)
const { Http } = window.Capacitor.Plugins;

// NEW (correct)
const { CapacitorHttp } = window.Capacitor.Plugins;
```

### 3. Android Manifest Updates
**File: `mobile/android/app/src/main/AndroidManifest.xml`**
- ✅ Added `android:usesCleartextTraffic="true"` for HTTP support
- ✅ Referenced network security config

**File: `mobile/android/app/src/main/res/xml/network_security_config.xml` (NEW)**
- ✅ Created network security configuration
- ✅ Allowed cleartext traffic for all domains
- ✅ Added specific domain configurations for eCLESS servers:
  - `closed-loop.biz` (with subdomains)
  - `cless4.closed-loop.biz`
  - `localhost` and local network ranges

### 4. Build Process
- ✅ Rollup configuration already correct (bundles all @capacitor imports)
- ✅ Build script includes Capacitor bundling step
- ✅ Successfully rebuilt with `npm run build`
- ✅ Synced to Android with `npm run sync:android`

## Technical Details

### Capacitor 6 HTTP Plugin
In Capacitor 6, `CapacitorHttp` is built into `@capacitor/core` and does NOT require a separate package. It provides:
- Native HTTP requests that bypass CORS
- Support for GET, POST, PUT, DELETE methods
- Timeout configuration
- Header support
- Automatic content type handling

### How It Works
1. **Native Mode**: Uses `CapacitorHttp.request()` which makes native platform HTTP requests (bypasses browser CORS)
2. **Web Mode**: Falls back to `fetch()` API for development/testing in browsers

### Detection Logic
```javascript
this.isNative = (window.capacitorAPI && window.capacitorAPI.isNative) || 
               (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
```

## Files Modified

1. ✅ `mobile/package.json` - Dependencies (no changes needed)
2. ✅ `mobile/www/assets/js/mobile/capacitor-core.js` - Import and export CapacitorHttp
3. ✅ `mobile/www/assets/js/mobile/mobile-http.js` - Use correct API and enhance logging
4. ✅ `mobile/android/app/src/main/AndroidManifest.xml` - Network permissions
5. ✅ `mobile/android/app/src/main/res/xml/network_security_config.xml` - Network security config (NEW)

## Testing Instructions

### 1. Rebuild the App
```bash
cd /home/clt-dev/app/ecless-player-electron/mobile
npm run build
npm run sync:android
npm run open:android
```

### 2. Test in Android Studio
1. Open the project in Android Studio
2. Run the app on emulator or physical device
3. Check logcat for these messages:

**Expected Success Logs:**
```
MobileHTTP: Running in native mode
MobileHTTP: Using native Capacitor HTTP
MobileHTTP: CapacitorHttp plugin found, making native request...
MobileHTTP: Native request successful, status: 200
```

### 3. Verify XML Loading
- Navigate to the main player screen (`index.html`)
- Ensure the app connects to `https://cless4.closed-loop.biz/demo/206/ds.xml`
- Verify layouts and media content load successfully
- Check for NO CORS errors in logcat

### 4. Debug Panel
- Tap the "🐛 Debug" button in the top-right corner
- View real-time logs and connection status
- Verify HTTP requests are using native mode

## Troubleshooting

### Issue: Still seeing CORS errors
**Solution:**
1. Verify `window.Capacitor.isNativePlatform()` returns `true`
2. Check that `capacitor-core.bundle.js` was rebuilt and synced
3. Ensure app is running in native Android (not browser)
4. Clear app cache and rebuild

### Issue: HTTP requests timeout
**Solution:**
1. Check network connectivity
2. Verify server URL is accessible
3. Check Android network permissions
4. Review network security config

### Issue: CapacitorHttp not found
**Solution:**
1. Run `npm install` in mobile directory
2. Run `npm run build` to rebuild bundles
3. Run `npm run sync:android` to sync to Android project
4. Clean and rebuild in Android Studio

## Performance Considerations

### Native HTTP Advantages
- ✅ No CORS restrictions
- ✅ Better performance (native networking stack)
- ✅ Support for all HTTP methods
- ✅ Proper timeout handling
- ✅ Better error handling

### Fallback to Fetch
- For web development/testing only
- Subject to CORS policies
- Use CORS proxy if needed (`config.corsproxy = 'Y'`)

## Security Notes

1. **Cleartext Traffic**: Enabled for development. For production:
   - Use HTTPS endpoints only
   - Remove cleartext traffic permission if possible
   - Use certificate pinning for sensitive data

2. **Network Security Config**: 
   - Currently allows all traffic
   - Should be restricted to known eCLESS server domains in production
   - Update domain list as needed

## Next Steps

1. ✅ **COMPLETED**: All code changes implemented
2. ✅ **COMPLETED**: Build and sync to Android
3. ⏳ **PENDING**: Test in Android Studio emulator
4. ⏳ **PENDING**: Verify XML loading works without CORS errors
5. ⏳ **PENDING**: Test on physical Android device
6. ⏳ **PENDING**: Performance testing with various network conditions

## Success Criteria

- [ ] App loads without CORS errors in logcat
- [ ] XML layouts fetch successfully from remote server
- [ ] Media content displays correctly
- [ ] No fallback to fetch API (uses native HTTP)
- [ ] Debug logs show "Using native Capacitor HTTP"

## Additional Notes

### Capacitor Version
- Current: Capacitor 6.1.2
- CapacitorHttp is built into @capacitor/core
- No separate @capacitor/http package needed

### Compatibility
- ✅ Android 5.0+ (API 21+)
- ✅ iOS 13+ (when iOS support is added)
- ✅ Web fallback for development

### Documentation References
- Capacitor HTTP Plugin: https://capacitorjs.com/docs/apis/http
- Network Security Config: https://developer.android.com/training/articles/security-config

---

**Created:** December 9, 2025
**Status:** Implementation Complete - Ready for Testing
**Next Action:** Test in Android Studio emulator
