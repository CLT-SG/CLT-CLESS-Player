# Mobile setBounds Fix - Deployment Checklist

## Pre-Deployment Verification ✅

- [x] All files created and modified correctly
- [x] No syntax errors detected
- [x] Android sync completed successfully
- [x] Documentation created (3 docs)
- [x] All 6 todo items completed

## Files to Verify Before Committing

### New Files (1)
- [ ] `/mobile/www/assets/js/mobile/mobile-layout-handler.js` exists

### Modified Files (5)
- [ ] `/mobile/www/assets/js/mobile/mobile-electron-shim.js` updated
- [ ] `/mobile/www/assets/js/layoutxml.js` updated
- [ ] `/mobile/www/assets/js/looplayout.js` updated  
- [ ] `/mobile/www/assets/js/activate.js` updated
- [ ] `/mobile/www/index.html` updated

### Documentation Files (3)
- [ ] `/mobile/docs_mobile/MOBILE-SETBOUNDS-FIX.md` created
- [ ] `/mobile/docs_mobile/MOBILE-SETBOUNDS-QUICKREF.md` created
- [ ] `/mobile/docs_mobile/IMPLEMENTATION-SUMMARY.md` created

## Build & Deploy Steps

### Step 1: Commit Changes
```bash
cd /home/clt-dev/app/ecless-player-electron
git add .
git commit -m "fix: implement mobile-compatible setBounds() for layout rendering

- Add setBounds(), getBounds(), center() methods to mobile-electron-shim
- Create mobile-layout-handler for intelligent dimension management
- Update layoutxml.js with mobile environment detection
- Add defensive checks for remote API calls in multiple files
- Enhance index.html with mobile viewport optimizations
- Add comprehensive documentation

Fixes: remote.getCurrentWindow().setBounds is not a function error
Resolves: #[issue-number]"
```

### Step 2: Build Android App
```bash
cd mobile
npm run sync:android
npm run build:android
```

### Step 3: Deploy to Test Device
```bash
# Option A: Development build with live reload
npx cap run android

# Option B: Production APK
npx cap build android
# Then install APK on device
```

### Step 4: Verify Deployment
- [ ] App launches successfully
- [ ] Navigate to CMS player section
- [ ] Layouts load without errors
- [ ] Check debug console (no setBounds errors)
- [ ] Test autoscale layout
- [ ] Test fixed dimension layout
- [ ] Test layout loop functionality
- [ ] Test orientation changes (rotate device)
- [ ] Verify fullscreen rendering

### Step 5: Monitor Logs
```bash
# Connect device and run
adb logcat | grep -E "setBounds|MobileLayoutHandler|LayoutXML|Capacitor/Console"
```

Expected logs:
```
✅ [Mobile] setBounds called with: {...}
✅ [MobileLayoutHandler] Initialized
✅ [LayoutXML] Mobile detected, using mobile layout handler
❌ No "setBounds is not a function" errors
```

## Testing Checklist

### Functional Testing
- [ ] **Layout Rendering**
  - [ ] Autoscale layouts render fullscreen
  - [ ] Fixed dimension layouts scale proportionally
  - [ ] Layouts are centered properly
  - [ ] Background colors/images display correctly

- [ ] **Layout Loops**
  - [ ] Multiple layouts transition smoothly
  - [ ] No errors during transitions
  - [ ] Timeouts work correctly
  - [ ] Loop continues indefinitely

- [ ] **Orientation Changes**
  - [ ] Portrait mode renders correctly
  - [ ] Landscape mode renders correctly
  - [ ] Transition is smooth (no flickering)
  - [ ] Dimensions recalculate properly

- [ ] **Navigation**
  - [ ] Settings button works
  - [ ] Dashboard button works
  - [ ] Diagnostics button works
  - [ ] Debug panel button works

### Regression Testing (Desktop)
- [ ] Desktop Electron app still works
- [ ] Desktop layouts render normally
- [ ] Desktop window resizing works
- [ ] No errors on desktop

### Performance Testing
- [ ] App startup time acceptable (< 5 seconds)
- [ ] Layout transitions smooth (< 500ms)
- [ ] No memory leaks (run for 30 minutes)
- [ ] Battery usage normal

## Rollback Procedure (If Needed)

### If Critical Issues Found
```bash
# Stop deployment
adb uninstall biz.closedloop.ecless.player

# Rollback code
cd /home/clt-dev/app/ecless-player-electron
git revert HEAD

# Rebuild with previous version
cd mobile
npm run sync:android
npm run build:android
```

### If Minor Issues Found
- Document issues in GitHub issues
- Fix in follow-up PR
- Continue with deployment

## Post-Deployment

### Step 1: UAT (User Acceptance Testing)
- [ ] Provide test device to QA team
- [ ] QA performs full test suite
- [ ] Collect feedback
- [ ] Document any issues

### Step 2: Production Deployment
- [ ] Merge to main branch
- [ ] Tag release version
- [ ] Build production APK
- [ ] Upload to internal distribution
- [ ] Notify users of update

### Step 3: Monitoring
- [ ] Monitor crash reports (first 24 hours)
- [ ] Monitor user feedback
- [ ] Check analytics for usage patterns
- [ ] Verify no increase in error rates

## Support Information

### Debug Commands
```bash
# View app logs
adb logcat | grep "biz.closedloop.ecless.player"

# View Capacitor-specific logs
adb logcat | grep "Capacitor"

# View JavaScript console logs
adb logcat | grep "Capacitor/Console"

# Clear app data (if needed)
adb shell pm clear biz.closedloop.ecless.player
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| App crashes on launch | Clear app data, reinstall |
| Layouts not loading | Check network connectivity |
| Still seeing setBounds error | Verify mobile-layout-handler.js is loaded |
| Layout wrong size | Check autoscale setting in CMS |

### Contact Information
- **Technical Issues:** [development-team@example.com]
- **Documentation:** See `/mobile/docs_mobile/`
- **Emergency Rollback:** Contact DevOps team

## Sign-Off

### Developer
- [ ] Code reviewed and tested
- [ ] Documentation complete
- [ ] Build successful
- **Signature:** _________________ **Date:** _______

### QA Team
- [ ] All test cases passed
- [ ] No critical bugs found
- [ ] Ready for production
- **Signature:** _________________ **Date:** _______

### Product Owner
- [ ] Functionality meets requirements
- [ ] Approved for deployment
- [ ] Go-live authorization
- **Signature:** _________________ **Date:** _______

---

**Checklist Version:** 1.0  
**Last Updated:** December 10, 2025  
**Status:** Ready for Deployment ✅
