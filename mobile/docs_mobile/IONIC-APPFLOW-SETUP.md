# Ionic Appflow Integration Guide for eCLESS Player Mobile

## Overview

This guide explains how to integrate the eCLESS Player Mobile app with **Ionic Appflow** for automated cloud builds and deployments. Ionic Appflow is a CI/CD platform specifically designed for Capacitor and Ionic apps.

## Prerequisites

1. **Ionic Appflow Account**
   - Sign up at: https://ionic.io/appflow
   - Choose appropriate plan (Free tier available for testing)

2. **GitHub Repository Access**
   - Your repository must be accessible to Ionic Appflow
   - You'll need admin permissions to connect the repo

3. **Android/iOS Signing Credentials** (for release builds)
   - Android: Keystore file (.jks or .keystore)
   - iOS: Provisioning profiles and certificates

## Project Structure

The eCLESS Player Mobile uses **Capacitor** (not Ionic Framework) as the native bridge. This is fully compatible with Ionic Appflow since Appflow supports both Ionic and Capacitor projects.

```
mobile/
├── ionic.config.json           # ✅ Ionic project configuration
├── appflow.config.json         # ✅ Appflow build configuration
├── capacitor.config.json       # Capacitor configuration
├── package.json                # Dependencies and build scripts
├── www/                        # Web assets (Capacitor webDir)
│   ├── index.html              # CMS Player
│   ├── dashboard.html          # Control Panel
│   └── assets/                 # CSS, JS, media
└── android/                    # Android native project
```

## Configuration Files

### 1. ionic.config.json

This file tells Appflow that your project is a Capacitor app:

```json
{
  "name": "ecless-player-mobile",
  "integrations": {
    "capacitor": {}
  },
  "type": "custom",
  "id": "biz.closedloop.ecless.player"
}
```

**Key Points:**
- `type: "custom"` - Indicates this is not a standard Ionic Framework app
- `integrations.capacitor` - Enables Capacitor integration
- `id` - Must match your Capacitor appId

### 2. appflow.config.json

This file configures how Appflow builds your app:

```json
{
  "apps": [
    {
      "appId": "biz.closedloop.ecless.player",
      "name": "eCLESS Player",
      "integrations": {
        "capacitor": {
          "enabled": true
        }
      }
    }
  ],
  "build": {
    "android": {
      "release": {
        "script": "npm run build:mobile",
        "gradleBuildType": "release"
      },
      "debug": {
        "script": "npm run build:mobile",
        "gradleBuildType": "debug"
      }
    }
  }
}
```

**Key Points:**
- `script` - Command run before native build (builds Rollup bundles)
- `gradleBuildType` - Android build type (debug/release)
- The `build:mobile` script compiles Capacitor core, datetime, and image compression bundles

## Step-by-Step Setup

### Step 1: Connect Repository to Ionic Appflow

1. **Log in to Ionic Appflow**
   - Go to: https://dashboard.ionicframework.com/
   - Sign in with your Ionic account

2. **Create New App**
   - Click "New App" button
   - Select "Connect a Git repository"

3. **Connect GitHub Repository**
   - Choose "GitHub" as the Git provider
   - Authenticate with GitHub if needed
   - Select your repository: `CLT-SG/CLT-CLESS-Player`
   - Grant necessary permissions

4. **Configure App Settings**
   - **App Name**: eCLESS Player Mobile
   - **App ID**: `biz.closedloop.ecless.player` (auto-detected from capacitor.config.json)
   - **Note**: Your mobile code is in a subdirectory (`/mobile`)

5. **Configure Monorepo/Subdirectory Setup**
   
   Since your Capacitor project is in the `mobile/` subdirectory, you need to tell Appflow how to build it:
   
   **Option A: Create Root package.json (Recommended)**
   
   Create a file at `/package.json` (repository root) with:
   ```json
   {
     "name": "ecless-player-monorepo",
     "private": true,
     "version": "1.0.0",
     "scripts": {
       "build": "cd mobile && npm install && npm run build:mobile && npx cap sync android"
     }
   }
   ```
   
   Then commit and push this file. Appflow will automatically run `npm run build` from the root.
   
   **Option B: Custom Build Command in Appflow**
   
   In Appflow Dashboard:
   - Go to: App Settings → Build → Native Builds
   - Look for "Build Script" or "Pre-build Script" configuration
   - Configure the build to run from the mobile directory
   - Appflow's build process will need to navigate to the mobile folder

### Step 2: Configure Build Environment

1. **Environment Variables** (if needed)
   - Go to: App Settings → Environments
   - Add any required environment variables
   - Example variables:
     ```
     NODE_VERSION=18
     ANDROID_SDK_VERSION=34
     ```

2. **Node.js Version**
   - Appflow uses Node.js 16 by default
   - Your project is compatible with Node 16-18
   - To change: Settings → Build → Node Version

### Step 3: Configure Android Build

#### Option A: Debug Build (Quick Testing)

1. **Create Debug Build**
   - Go to: Builds → New Build
   - Select Platform: **Android**
   - Select Build Type: **Debug**
   - Select Branch: `feat/mobile-chunked-file-handling` (or your branch)
   - Click "Build"

2. **Download APK**
   - Wait for build to complete (usually 5-10 minutes)
   - Download the `.apk` file
   - Install on Android device for testing

#### Option B: Release Build (Production)

1. **Upload Signing Credentials**
   - Go to: App Settings → Signing Certificates → Android
   - Upload your keystore file (`.jks` or `.keystore`)
   - Enter:
     - **Keystore Password**: Your keystore password
     - **Key Alias**: Your key alias (from `keystore.properties`)
     - **Key Password**: Your key password

2. **Create Release Build**
   - Go to: Builds → New Build
   - Select Platform: **Android**
   - Select Build Type: **Release**
   - Select Signing Certificate: (choose the one you uploaded)
   - Select Branch: `main` or your production branch
   - Click "Build"

3. **Download Signed APK/AAB**
   - Wait for build to complete
   - Download the signed `.apk` or `.aab` file
   - Ready for Google Play Store upload

### Step 4: Automate Builds with Git Automation

1. **Enable Git Automation**
   - Go to: Automations → New Automation
   - Select Event: "Push to branch"
   - Select Branch: `feat/mobile-chunked-file-handling`
   - Select Platform: Android
   - Select Build Type: Debug or Release

2. **Automation Rules**
   - **Development Branch** → Debug builds
   - **Main/Master Branch** → Release builds
   - **Pull Requests** → Debug builds

## Build Scripts Explained

The Appflow build process runs these scripts in order:

### 1. npm install
```bash
cd mobile
npm install
```
Installs all dependencies from `package.json`

### 2. Build Script (from appflow.config.json)
```bash
npm run build:mobile
```

This script runs:
```bash
npm run build:capacitor    # Builds Capacitor core bundle
npm run build:datetime     # Builds date-and-time library bundle
npm run build:imagecompression  # Builds image compression bundle
```

Each command uses Rollup to bundle npm packages into browser-compatible files.

### 3. Capacitor Sync (Automatic)
```bash
npx cap sync android
```
Appflow automatically runs this to sync web assets to native project.

### 4. Gradle Build (Automatic)
```bash
cd android
./gradlew assembleRelease  # or assembleDebug
```
Builds the native Android app.

## Troubleshooting Common Issues

### Issue 1: "No ionic.config.json found"

**Cause**: Appflow can't find the Capacitor project in subdirectory.

**Solution**:
- Ensure `ionic.config.json` exists in `/mobile` directory
- Create root `package.json` with build script (see setup instructions above)
- Appflow should auto-detect `ionic.config.json` in subdirectories
- If using Option B, ensure build commands navigate to `mobile/` directory

### Issue 2: "Build failed: npm install"

**Cause**: Missing or incompatible dependencies.

**Solution**:
- Check `package.json` for correct dependency versions
- Ensure `package-lock.json` is committed to Git
- Verify Node.js version compatibility

### Issue 3: "Rollup build failed"

**Cause**: Rollup configuration errors or missing source files.

**Solution**:
- Test build locally: `npm run build:mobile`
- Check rollup config files: `rollup.config.js`, `rollup.datetime.config.js`, `rollup.imagecompression.config.js`
- Ensure all source files exist in `node_modules`

### Issue 4: "Gradle build failed: SDK not found"

**Cause**: Android SDK version mismatch.

**Solution**:
- Check `android/variables.gradle`:
  ```gradle
  compileSdkVersion = 34
  targetSdkVersion = 34
  ```
- Appflow uses Android SDK 34 by default (compatible)

### Issue 5: "Capacitor sync failed"

**Cause**: Web assets not built before sync.

**Solution**:
- Ensure `www/` directory exists and contains built assets
- Verify `build:mobile` script runs successfully
- Check `capacitor.config.json` → `webDir: "www"`

### Issue 6: "Signing failed: Invalid keystore"

**Cause**: Incorrect signing credentials.

**Solution**:
- Verify keystore password is correct
- Check key alias matches your keystore
- Ensure keystore file is not corrupted
- Test keystore locally:
  ```bash
  keytool -list -v -keystore your-keystore.jks
  ```

## Local Testing Before Appflow

Always test your build locally before pushing to Appflow:

```bash
# 1. Clean previous builds
cd mobile
npm run clean

# 2. Install dependencies
npm install

# 3. Build web assets
npm run build:mobile

# 4. Sync to Android
npx cap sync android

# 5. Build Android app
cd android
./gradlew assembleRelease  # or assembleDebug

# 6. Find APK
# Located at: android/app/build/outputs/apk/release/
```

If this works locally, it should work on Appflow.

## Advanced Configuration

### Custom Build Hooks

You can add pre/post build hooks in `appflow.config.json`:

```json
{
  "build": {
    "android": {
      "release": {
        "script": "npm run build:mobile",
        "hooks": {
          "pre": "echo 'Starting build...'",
          "post": "echo 'Build complete!'"
        }
      }
    }
  }
}
```

### Environment-Specific Builds

Create different configurations for dev/staging/prod:

```json
{
  "environments": {
    "development": {
      "name": "Development",
      "variables": {
        "API_URL": "http://dev-api.closed-loop.biz"
      }
    },
    "production": {
      "name": "Production",
      "variables": {
        "API_URL": "https://api.closed-loop.biz"
      }
    }
  }
}
```

Access in build scripts:
```javascript
const apiUrl = process.env.API_URL;
```

## Build Status Badges

Add build status to your README:

```markdown
[![Appflow Build Status](https://dashboard.ionicframework.com/api/v1/apps/YOUR_APP_ID/builds/badge)](https://dashboard.ionicframework.com/app/YOUR_APP_ID)
```

## Resources

- **Ionic Appflow Docs**: https://ionic.io/docs/appflow
- **Capacitor Docs**: https://capacitorjs.com/docs
- **Android Signing**: https://developer.android.com/studio/publish/app-signing
- **Support**: support@ionic.io

## FAQ

### Q: Do I need to install Ionic Framework?
**A**: No. Your app uses Capacitor without Ionic Framework. Appflow supports both.

### Q: Can I build iOS apps on Appflow?
**A**: Yes, but you need a macOS machine for initial setup and valid Apple Developer credentials.

### Q: How much does Appflow cost?
**A**: Free tier available (limited builds). Paid plans start at $25/month. See: https://ionic.io/pricing

### Q: Can I use GitHub Actions instead?
**A**: Yes, but Appflow is optimized for Capacitor apps with pre-configured Android/iOS build environments.

### Q: What if my build times out?
**A**: Free tier has 30-minute timeout. Optimize by reducing dependencies or upgrade to paid plan.

## Next Steps

1. ✅ Connect repository to Appflow
2. ✅ Configure build settings
3. ✅ Upload signing credentials
4. ✅ Create first test build
5. ✅ Set up Git automation
6. ✅ Monitor build status
7. ✅ Download and test APK

For additional help, contact Ionic support or refer to the Appflow documentation.

---

**Document Version**: 1.0  
**Last Updated**: December 27, 2025  
**Maintainer**: Closed-Loop Technology Pte. Ltd
