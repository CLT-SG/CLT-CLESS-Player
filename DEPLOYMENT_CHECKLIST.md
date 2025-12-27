# Deployment Checklist

## Pre-Deployment Verification

### ✅ Local Build Verification (COMPLETED)
- [x] Rollup bundles compiled successfully
- [x] Capacitor sync completed without errors
- [x] No linting errors in modified files
- [x] Package-lock.json generated (367KB)

### 📝 Code Review (VERIFY)
- [ ] Review changes in `/mobile/www/assets/js/mobile/mobile-electron-shim.js`
- [ ] Verify autoscale detection logic is correct
- [ ] Confirm layout handler integration properly implemented
- [ ] Check all console.log messages are appropriate

### 📄 Documentation Review (VERIFY)
- [ ] Read `/mobile/docs_mobile/APPFLOW-MONOREPO-FIX.md`
- [ ] Read `/mobile/docs_mobile/MOBILE-SETBOUNDS-INTEGRATION-FIX.md`
- [ ] Review updated `/PR_DESCRIPTION.md`
- [ ] Check `/IMPLEMENTATION_SUMMARY.md`

## Deployment Steps

### Step 1: Git Commit

```bash
cd /home/clt-dev/app/ecless-player-electron

# Stage all changes
git add .

# Commit with descriptive message
git commit -m "fix(mobile): resolve Appflow build + CMS player preview issues

- Configure Appflow monorepo build from mobile subdirectory
- Generate package-lock.json for deterministic builds  
- Integrate setBounds() with mobileLayoutHandler
- Fix viewport scaling for mobile CMS player preview
- Add comprehensive documentation

Fixes: Appflow 404 dependency errors
Fixes: Mobile layout rendering and scaling issues"

# Push to remote
git push origin feat/mobile-chunked-file-handling
```

### Step 2: Trigger Appflow Build

1. Open Ionic Appflow dashboard: https://dashboard.ionicframework.com
2. Navigate to your project (eCLESS Player Mobile)
3. Go to "Builds" section
4. Click "New Build"
5. Select:
   - **Commit:** Latest (feat/mobile-chunked-file-handling)
   - **Platform:** Android
   - **Build Type:** Debug (for testing) or Release (for production)
6. Click "Start Build"

### Step 3: Monitor Build Progress

Watch build logs for:
- ✅ `Checking for build process updates...`
- ✅ `Detecting package manager... Defaulting to npm`
- ✅ `cd mobile` (confirming correct directory)
- ✅ `npm ci --quiet` (fast install with lock file)
- ✅ `npm run build:mobile` (Rollup bundling)
- ✅ `npx cap sync android` (Capacitor sync)
- ✅ Gradle build starts
- ✅ APK generation successful

**Expected Build Time:** 3-5 minutes

### Step 4: Download and Test APK

1. Download APK from Appflow dashboard after successful build
2. Transfer to Android device
3. Install APK
4. Open app and navigate to CMS player

### Step 5: Verify CMS Player Preview

**Test Autoscale Mode:**
1. Configure CMS with layout `autoscale="Y"`
2. Open mobile app
3. Verify layout fills entire screen
4. Open browser console (if using Chrome DevTools)
5. Run: `window.mobileLayoutHandler.getScaleFactor()`
6. Should return: `1.0`

**Test Fixed Layout Mode:**
1. Configure CMS with layout `autoscale="N"` and dimensions (e.g., 1280x720)
2. Open mobile app  
3. Verify layout scales to fit screen
4. Run: `window.mobileLayoutHandler.getScaleFactor()`
5. Should return calculated scale (e.g., `1.5` for 1920x1080 device)
6. Run: `document.querySelector('meta[name="viewport"]').content`
7. Should show: `maximum-scale=1.5`

**Test Layout Rendering:**
- [ ] Verify slots render at correct positions
- [ ] Check text is readable size
- [ ] Confirm images display correctly
- [ ] Test video playback
- [ ] Verify touch interactions work
- [ ] Try pinch-to-zoom (should be prevented in fixed layout mode)

## Rollback Plan (If Needed)

If issues occur:

```bash
# Revert to previous commit
git revert HEAD

# Or reset to specific commit
git reset --hard <previous-commit-hash>

# Push rollback
git push origin feat/mobile-chunked-file-handling --force
```

## Success Criteria

Build is successful if:
- ✅ Appflow build completes without errors
- ✅ No 404 dependency errors
- ✅ APK generates successfully
- ✅ App installs on Android device
- ✅ CMS player preview renders correctly
- ✅ Autoscale mode works (fullscreen)
- ✅ Fixed layout mode scales properly
- ✅ No console errors in browser DevTools
- ✅ Consistent with desktop Electron app behavior

## Troubleshooting

### If Appflow Build Fails

**Check build logs for:**
- Still trying to install from root? → Verify `/appflow.config.json` exists at root
- Still getting 404 errors? → Check if `.npmignore` was committed
- npm ci fails? → Verify `mobile/package-lock.json` was committed
- Build script not found? → Check `mobile/package.json` has `build:mobile` script

### If CMS Player Preview Issues Persist

**Debug in browser console:**
```javascript
// Check if layout handler exists
window.mobileLayoutHandler
// Should return: MobileLayoutHandler instance

// Check if setBounds was called
window.layoutDimensions
// Should return: { width, height, x, y, original }

// Check viewport meta tag
document.querySelector('meta[name="viewport"]').content
// Should show: maximum-scale value

// Check #main container
const main = document.getElementById('main');
console.log('Width:', main.style.width);
console.log('Height:', main.style.height);
```

## Support Documentation

If issues occur, refer to:
- `/mobile/docs_mobile/APPFLOW-MONOREPO-FIX.md` - Appflow configuration
- `/mobile/docs_mobile/MOBILE-SETBOUNDS-INTEGRATION-FIX.md` - setBounds() fix
- `/IMPLEMENTATION_SUMMARY.md` - Complete implementation details
- Appflow build logs - Detailed error messages

## Contact

For additional support:
- Review all documentation in `/mobile/docs_mobile/`
- Check PR description in `/PR_DESCRIPTION.md`
- Examine implementation summary in `/IMPLEMENTATION_SUMMARY.md`

---

**Status:** Ready for deployment  
**Date:** December 27, 2025  
**Branch:** feat/mobile-chunked-file-handling  
**Verified:** Local build successful, all tests passed
