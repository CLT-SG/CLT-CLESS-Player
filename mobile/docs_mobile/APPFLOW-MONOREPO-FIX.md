# Appflow Monorepo Configuration Fix

## Issue
Appflow build was failing because it tried to install dependencies from the root `package.json` which contains Electron-specific dependencies like `@wuild/electron-notification` that don't exist on npm registry.

## Root Cause
The repository is a monorepo with both Electron desktop app (root) and Capacitor mobile app (mobile/ subdirectory). Appflow was not detecting the correct build directory and attempted to install root dependencies.

## Solution

### 1. Root-Level Configuration Files

Created `/appflow.config.json` at repository root:
```json
{
  "build": {
    "buildDir": "mobile",
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

Created `/ionic.config.json` at repository root:
```json
{
  "name": "ecless-player-mobile",
  "integrations": {
    "capacitor": {
      "root": "mobile"
    }
  },
  "type": "custom",
  "id": "biz.closedloop.ecless.player"
}
```

### 2. Package Lock File

Generated `mobile/package-lock.json` for deterministic dependency installation:
- Enables `npm ci` for faster, reproducible builds
- 367KB lock file with 749 packages
- Resolves all dependency versions upfront

### 3. NPM Ignore File

Created `/.npmignore` to exclude Electron-specific files from mobile builds:
- Ignores node_modules, build artifacts, Electron source files
- Prevents accidental installation of root dependencies
- Keeps mobile build clean and focused

## How It Works

1. **Appflow Detection**: Root-level `ionic.config.json` tells Appflow this is a Capacitor project
2. **Build Directory**: `buildDir: "mobile"` in `appflow.config.json` instructs Appflow to:
   - Change to `mobile/` directory before running npm install
   - Use `mobile/package.json` and `mobile/package-lock.json`
   - Execute build scripts from mobile directory context
3. **Dependency Isolation**: 
   - Root Electron dependencies are never installed
   - Only mobile-specific Capacitor dependencies are installed
   - `.npmignore` provides additional protection

## Expected Build Flow

```
Appflow Build Start
  ↓
Read /ionic.config.json → Detect Capacitor project in mobile/
  ↓
Read /appflow.config.json → Set buildDir to mobile/
  ↓
cd mobile/
  ↓
npm ci (uses package-lock.json for fast install)
  ↓
npm run build:mobile (Rollup bundling)
  ↓
npx cap sync android
  ↓
Gradle build → APK
```

## Files Changed

**New Files:**
- `/appflow.config.json` - Build directory configuration
- `/ionic.config.json` - Capacitor project detection at root
- `/.npmignore` - Exclude Electron files from npm operations
- `/mobile/package-lock.json` - Deterministic dependency resolution

**Existing Files (Preserved):**
- `/mobile/ionic.config.json` - Mobile-specific Ionic config
- `/mobile/appflow.config.json` - Mobile-specific build scripts
- Both files still valid but root config takes precedence

## Verification

Test locally before pushing to Appflow:
```bash
# Simulate Appflow build process
cd /home/clt-dev/app/ecless-player-electron
cd mobile
npm ci
npm run build:mobile
npx cap sync android
```

## Compatibility

- Ionic Appflow CI/CD platform
- Capacitor 6.x projects
- Monorepo/subdirectory structure
- Node.js 16-22 compatible
- No breaking changes to local development workflow

## References

- Ionic Appflow Documentation: https://ionic.io/docs/appflow
- Capacitor Monorepo Setup: https://capacitorjs.com/docs/guides/monorepo
- NPM Package Lock: https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json
