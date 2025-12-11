# Android APK Signing Setup Guide

## Problem
The error `INSTALL_PARSE_FAILED_NO_CERTIFICATES` occurs when an APK is not properly signed. All Android apps must be cryptographically signed before installation.

## Solution

### Option 1: Quick Testing (Debug Keystore)
For **testing purposes only**, the build.gradle is configured to automatically use the Android debug keystore as a fallback.

**No action needed** - just rebuild the APK:
```bash
cd /home/clt-dev/app/ecless-player-electron/mobile
npm run build
cd android
./gradlew assembleRelease
```

The APK will be signed with the debug keystore and can be installed on devices.

⚠️ **WARNING:** Debug-signed APKs cannot be published to Google Play Store and should only be used for testing.

---

### Option 2: Production Release (Custom Keystore)
For **production releases** or **Google Play Store** publishing, create a proper release keystore.

#### Step 1: Generate a Release Keystore
```bash
cd /home/clt-dev/app/ecless-player-electron/mobile/android

keytool -genkeypair -v \
  -keystore app/ecless-player-release.keystore \
  -alias ecless-player-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_SECURE_PASSWORD \
  -keypass YOUR_SECURE_PASSWORD \
  -dname "CN=Closed-Loop Technology, OU=Development, O=Closed-Loop Technology Pte Ltd, L=Singapore, ST=Singapore, C=SG"
```

**Important:**
- Replace `YOUR_SECURE_PASSWORD` with a strong, unique password
- Store the password securely (password manager recommended)
- **NEVER commit the keystore file or passwords to Git**
- Keep a backup of the keystore in a secure location
- If you lose this keystore, you cannot update your app on Google Play Store

#### Step 2: Configure Signing Credentials
```bash
cd /home/clt-dev/app/ecless-player-electron/mobile/android
cp keystore.properties.example keystore.properties
```

Edit `keystore.properties` with your actual credentials:
```properties
storeFile=ecless-player-release.keystore
storePassword=YOUR_ACTUAL_PASSWORD
keyAlias=ecless-player-key
keyPassword=YOUR_ACTUAL_PASSWORD
```

#### Step 3: Add to .gitignore
Ensure these files are in `.gitignore`:
```
mobile/android/keystore.properties
mobile/android/*.keystore
mobile/android/*.jks
```

#### Step 4: Build Signed APK
```bash
cd /home/clt-dev/app/ecless-player-electron/mobile
npm run build
cd android
./gradlew assembleRelease
```

The signed APK will be at:
```
android/app/build/outputs/apk/release/ecless-player_v3.1.6.apk
```

#### Step 5: Install and Test
```bash
adb install android/app/build/outputs/apk/release/ecless-player_v3.1.6.apk
```

---

## Verification

### Check if APK is Signed
```bash
# Verify APK signature
jarsigner -verify -verbose -certs android/app/build/outputs/apk/release/ecless-player_v3.1.6.apk

# Should output: "jar verified."

# View detailed signature info
apksigner verify --verbose android/app/build/outputs/apk/release/ecless-player_v3.1.6.apk
```

### Expected Output
For debug-signed APK:
```
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
Signer #1 certificate DN: CN=Android Debug, ...
```

For release-signed APK:
```
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
Signer #1 certificate DN: CN=Closed-Loop Technology, ...
```

---

## Troubleshooting

### Error: "keystore.properties not found"
**Solution:** Either create keystore.properties (Option 2) or let the build use debug keystore (Option 1).

### Error: "Keystore file does not exist"
**Solution:** Check that the `storeFile` path in keystore.properties is correct and the keystore file exists.

### Error: "Failed to read key from keystore"
**Solution:** Verify that `storePassword`, `keyAlias`, and `keyPassword` in keystore.properties are correct.

### Error: "Cannot recover key"
**Solution:** The `keyPassword` in keystore.properties is incorrect.

---

## CI/CD Integration

For automated builds, use environment variables instead of keystore.properties:

```groovy
// Add to build.gradle signingConfigs.release:
storeFile file(System.getenv("KEYSTORE_FILE") ?: "debug.keystore")
storePassword System.getenv("KEYSTORE_PASSWORD") ?: "android"
keyAlias System.getenv("KEY_ALIAS") ?: "androiddebugkey"
keyPassword System.getenv("KEY_PASSWORD") ?: "android"
```

Then set environment variables in your CI/CD pipeline:
```bash
export KEYSTORE_FILE=/path/to/keystore
export KEYSTORE_PASSWORD=your_password
export KEY_ALIAS=your_alias
export KEY_PASSWORD=your_key_password
```

---

## Security Best Practices

1. ✅ **DO** use a strong password for your keystore (12+ characters, mixed case, numbers, symbols)
2. ✅ **DO** store the keystore in a secure backup location
3. ✅ **DO** use a password manager to store credentials
4. ✅ **DO** restrict keystore file permissions: `chmod 600 ecless-player-release.keystore`
5. ❌ **DON'T** commit keystore.properties or .keystore files to Git
6. ❌ **DON'T** share your keystore password via email or chat
7. ❌ **DON'T** use the debug keystore for production releases
8. ❌ **DON'T** lose your keystore - you cannot recover it or update published apps without it

---

## Quick Reference

| Build Type | Keystore | Use Case | Google Play? |
|------------|----------|----------|--------------|
| **Debug** | Android debug keystore | Development & testing | ❌ No |
| **Release (debug fallback)** | Android debug keystore | Quick testing | ❌ No |
| **Release (production)** | Custom release keystore | Production & distribution | ✅ Yes |

---

## Additional Resources

- [Android Developer Guide: Sign Your App](https://developer.android.com/studio/publish/app-signing)
- [keytool Documentation](https://docs.oracle.com/javase/8/docs/technotes/tools/unix/keytool.html)
- [Google Play Console: App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
