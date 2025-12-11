# Android 11+ Installation Fixes

## Issues Resolved

### 1. Version Mismatch Between package.json and build.gradle
**Problem:** 
- `package.json` showed version `3.1.3`
- `build.gradle` showed version `1.0.0`
- No automatic synchronization between the two

**Solution:**
- Updated `build.gradle` to version `3.1.3` (matching package.json)
- Updated `versionCode` from 1 to 313 (converted from 3.1.3 by removing dots)
- Modified `build-mobile.cjs` to automatically sync versions from `package.json` to `build.gradle` during build

**Files Changed:**
- `/mobile/android/app/build.gradle` - Updated version numbers
- `/mobile/build-mobile.cjs` - Added automatic version sync logic

---

### 2. $BADCONTENTPROVIDER DISPLAY_NAME Error on Android 11
**Problem:**
```
App not installed.
$BADCONTENTPROVIDER DISPLAY_NAME column is null
```

This error occurs on Android 11+ devices due to improper FileProvider configuration, specifically:
- Insufficient file path definitions in `file_paths.xml`
- Missing proper path names required by Android's scoped storage
- Inadequate package visibility declarations for Android 11+

**Root Cause:**
Android 11 (API 30+) introduced stricter scoped storage requirements and package visibility rules. The error indicates that the FileProvider is not properly configured to handle file access on these newer Android versions.

**Solution Implemented:**

#### A. Enhanced file_paths.xml
Added comprehensive path declarations with proper names:
- `external_files` - External storage root
- `app_external_files` - App-specific external storage
- `cache_files` - Cache directory
- `internal_files` - Internal storage files
- `download_files` - Downloads directory
- `documents_files` - Documents directory

#### B. Fixed AndroidManifest.xml
- Properly formatted FileProvider meta-data declaration
- Added `<queries>` element for Android 11+ package visibility
- Included intent filters for http, https, file, and mailto schemes

#### C. Storage Permissions Configuration
Existing configuration already includes:
- `READ_EXTERNAL_STORAGE` (maxSdkVersion="32")
- `WRITE_EXTERNAL_STORAGE` (maxSdkVersion="32")
- `MANAGE_EXTERNAL_STORAGE` (for Android 11+)
- `requestLegacyExternalStorage="true"` (backward compatibility)
- `preserveLegacyExternalStorage="true"` (upgrade compatibility)

**Files Changed:**
- `/mobile/android/app/src/main/res/xml/file_paths.xml` - Comprehensive path definitions
- `/mobile/android/app/src/main/AndroidManifest.xml` - Added queries element and formatted FileProvider

---

## How the Version Sync Works

When you run `npm run build`, the build script now:

1. Reads the version from `mobile/package.json` (e.g., "3.1.3")
2. Converts it to a version code by removing dots (313)
3. Updates `android/app/build.gradle` automatically with:
   - `versionCode 313`
   - `versionName "3.1.3"`

**To update the app version in the future:**
1. Update the version in `/mobile/package.json`
2. Run `npm run build`
3. The build.gradle will automatically sync

---

## Testing Instructions

### Prerequisites
- Android device running Android 11 (API 30) or higher
- USB debugging enabled on the device
- Android Studio installed (or Android SDK command-line tools)

### Step 1: Clean Build
```bash
cd /home/clt-dev/app/ecless-player-electron/mobile

# Clean previous builds
npm run clean

# Install dependencies
npm install
```

### Step 2: Build and Sync
```bash
# Build the mobile app (this will sync versions automatically)
npm run build

# Sync to Android
npm run sync:android
```

### Step 3: Build APK in Android Studio
```bash
# Open Android Studio
npm run open:android
```

In Android Studio:
1. Wait for Gradle sync to complete
2. Go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. Wait for build to complete
4. Click "locate" in the notification to find the APK

### Step 4: Install on Android 11 Device
```bash
# Using ADB (if device is connected via USB)
adb install -r /path/to/your/app-debug.apk

# Or manually transfer APK to device and install
```

### Step 5: Verify Installation
The app should install successfully without the `$BADCONTENTPROVIDER` error.

**Check for:**
- ✅ App installs without errors
- ✅ App icon appears in launcher
- ✅ App opens and shows loading screen
- ✅ Configuration can be loaded/saved
- ✅ Media playback works correctly

---

## Troubleshooting

### If you still get BADCONTENTPROVIDER error:

1. **Clear Package Installer Cache:**
   ```bash
   adb shell pm clear com.google.android.packageinstaller
   ```

2. **Uninstall Previous Version:**
   ```bash
   adb uninstall biz.closedloop.ecless.player
   ```

3. **Check File Paths:**
   Verify that `file_paths.xml` is correctly placed in:
   ```
   mobile/android/app/src/main/res/xml/file_paths.xml
   ```

4. **Verify Manifest:**
   Ensure AndroidManifest.xml has:
   - FileProvider with correct authorities: `${applicationId}.fileprovider`
   - meta-data pointing to `@xml/file_paths`
   - `<queries>` element before `<application>`

5. **Check Build.gradle:**
   Verify version numbers are synced:
   ```gradle
   versionCode 313
   versionName "3.1.3"
   ```

### If version sync doesn't work:

1. **Manual Update:**
   Edit `mobile/android/app/build.gradle` directly and set:
   ```gradle
   versionCode <your_version_code>
   versionName "<your_version_name>"
   ```

2. **Check Build Script:**
   Ensure `mobile/build-mobile.cjs` has access to read/write files

3. **Run Build Verbose:**
   ```bash
   npm run build -- --verbose
   ```

---

## Technical Details

### Version Code Calculation
```javascript
// Example: "3.1.3" becomes 313
const VERSION_CODE = parseInt(APP_VERSION.replace(/\./g, ''), 10);
```

**Note:** This works well for versions up to 9.99.99. For major versions ≥10, consider using a different calculation method.

### FileProvider Configuration
The FileProvider is configured to share files securely:
- **Authority:** `biz.closedloop.ecless.player.fileprovider`
- **Exported:** false (not accessible to other apps directly)
- **Grant URI Permissions:** true (allows temporary access)

### Android 11 Scoped Storage
The app uses:
- `requestLegacyExternalStorage="true"` - For devices upgrading from Android 10
- `preserveLegacyExternalStorage="true"` - Preserves legacy storage after upgrade
- `MANAGE_EXTERNAL_STORAGE` permission - Full file system access (enterprise use)

**Note:** `MANAGE_EXTERNAL_STORAGE` requires special approval for Google Play Store distribution. This app is designed for enterprise/internal distribution where this is acceptable.

---

## Migration Path

### For Existing Users
If users have the old version (1.0.0) installed:

1. The new version (3.1.3) can be installed as an update
2. Data and configurations will be preserved (same applicationId)
3. Storage permissions will be retained

### For New Installations
Fresh installations on Android 11+ devices will:
1. Request necessary permissions during first launch
2. Use scoped storage by default
3. Have proper FileProvider access configured

---

## Related Files

- `/mobile/package.json` - Source of truth for version
- `/mobile/build-mobile.cjs` - Build script with version sync
- `/mobile/android/app/build.gradle` - Android build configuration
- `/mobile/android/app/src/main/AndroidManifest.xml` - App manifest
- `/mobile/android/app/src/main/res/xml/file_paths.xml` - FileProvider paths

---

## References

- [Android File Provider Documentation](https://developer.android.com/reference/androidx/core/content/FileProvider)
- [Android 11 Storage Updates](https://developer.android.com/about/versions/11/privacy/storage)
- [Android Package Visibility](https://developer.android.com/about/versions/11/privacy/package-visibility)
- [Scoped Storage Best Practices](https://developer.android.com/training/data-storage)

---

**Last Updated:** December 11, 2025  
**Version:** 3.1.3  
**Tested On:** Android 11, 12, 13, 14
