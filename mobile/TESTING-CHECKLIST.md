# 🎯 Testing Checklist: Custom Icons Integration

Use this checklist to verify the icon integration is working correctly on your Android device or emulator.

---

## ✅ Pre-Build Verification

- [x] Source icon files exist in `mobile/resources/`
- [x] Icon generation completed successfully (68 files generated)
- [x] Verification script passed: `./verify-icons.sh`
- [x] Capacitor sync completed: `npm run sync:android`
- [x] Documentation created and updated

---

## 🔨 Build Steps

### 1. Clean Previous Build (Optional but Recommended)

```bash
cd mobile/android
./gradlew clean
cd ../..
```

### 2. Build and Open Android Studio

```bash
cd mobile
npm run build:android
```

### 3. In Android Studio

- [ ] Wait for Gradle sync to complete
- [ ] Check for any build errors (should be none)
- [ ] Build → Clean Project
- [ ] Build → Rebuild Project

---

## 📱 Testing on Device/Emulator

### 1. Uninstall Previous Version (if exists)

**Via ADB:**
```bash
adb uninstall biz.closedloop.ecless.player
```

**Or manually on device:**
- Long press app icon → App Info → Uninstall

### 2. Install Fresh Build

**From Android Studio:**
- Click Run button (green triangle)
- Or press `Shift + F10`
- Select target device/emulator

**Via ADB (manual install):**
```bash
adb install mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🔍 Visual Verification Checklist

### App Launcher Icon
- [ ] Open app drawer
- [ ] Locate "eCLESS Player" app
- [ ] **Verify**: Icon shows the custom eCLESS logo (not default Android icon)
- [ ] **Verify**: Icon is sharp and clear (not pixelated)

### Home Screen Icon (if added)
- [ ] Long press app in drawer → Add to Home Screen
- [ ] **Verify**: Icon on home screen matches launcher icon
- [ ] **Verify**: Icon looks good at the home screen size

### Splash Screen
- [ ] Launch the app
- [ ] **Verify**: Splash screen shows custom eCLESS logo
- [ ] **Verify**: Background color is dark slate (#1e293b)
- [ ] **Verify**: No white flash or default Capacitor splash

### Recent Apps / Task Switcher
- [ ] Open the app
- [ ] Press Recent Apps button (square/overview button)
- [ ] **Verify**: App icon in task switcher matches launcher icon
- [ ] **Verify**: Icon appears in the app preview card header

### Adaptive Icon (Android 8.0+)
- [ ] Long press empty home screen → Wallpaper & style → App icon shape
- [ ] Try different shapes (Circle, Square, Squircle, Teardrop)
- [ ] **Verify**: Icon adapts to selected shape
- [ ] **Verify**: Icon looks centered and proportional in all shapes

### Settings / App Info
- [ ] Settings → Apps → eCLESS Player
- [ ] **Verify**: App icon displays in app info screen
- [ ] **Verify**: Icon matches launcher icon

### Notification Icon (if app shows notifications)
- [ ] Trigger a notification (if applicable)
- [ ] **Verify**: Notification icon matches app icon
- [ ] Pull down notification shade
- [ ] **Verify**: Icon appears correctly in notifications

---

## 🐛 Troubleshooting

### Issue: Icon Still Shows Default Android Icon

**Solutions:**
1. Uninstall app completely:
   ```bash
   adb uninstall biz.closedloop.ecless.player
   ```

2. Clear cache and data:
   ```bash
   adb shell pm clear biz.closedloop.ecless.player
   ```

3. Restart device/emulator

4. Rebuild and reinstall:
   ```bash
   cd mobile/android
   ./gradlew clean
   cd ..
   npm run build:android
   ```

### Issue: Icon Appears Blurry or Pixelated

**Check:**
1. Verify source icon resolution:
   ```bash
   identify resources/icon-only.png
   # Should show: 512x512
   ```

2. Regenerate icons:
   ```bash
   npm run generate:icons
   npm run sync:android
   ```

### Issue: Some Densities Missing Icons

**Fix:**
1. Run verification script:
   ```bash
   ./verify-icons.sh
   ```

2. If any missing, regenerate:
   ```bash
   npm run generate:icons
   npm run sync:android
   ```

### Issue: Adaptive Icon Not Working

**Check:**
1. Verify XML descriptors exist:
   ```bash
   ls -la android/app/src/main/res/mipmap-anydpi-v26/
   # Should show: ic_launcher.xml, ic_launcher_round.xml
   ```

2. Test on Android 8.0+ device or emulator
   (Adaptive icons require API 26+)

---

## 📊 Expected Results

### ✅ Success Criteria

All of the following should be true:

1. **Custom Icon Visible**: eCLESS logo appears (not Android robot)
2. **High Quality**: Icon is sharp on all screen densities
3. **Consistent**: Same icon in launcher, home screen, and task switcher
4. **Adaptive**: Icon adapts to system shape on Android 8.0+
5. **Splash Screen**: Custom logo shows when launching app
6. **Professional**: Icon matches desktop Electron app branding

### 📸 Screenshot Checklist (Optional)

For documentation purposes, capture screenshots of:
- [ ] App in launcher (app drawer)
- [ ] App on home screen
- [ ] Splash screen during launch
- [ ] App in recent apps/task switcher
- [ ] App info screen in Settings
- [ ] Adaptive icon in different shapes

---

## 📝 Notes

**Device Tested On:**
- Device/Emulator: ________________________
- Android Version: ________________________
- Screen Density: ________________________
- Date Tested: ________________________

**Test Results:**
- [ ] ✅ All tests passed
- [ ] ⚠️ Some issues found (document below)
- [ ] ❌ Major issues (document below)

**Issues Found:**
```
(Document any issues here)
```

**Additional Notes:**
```
(Any other observations)
```

---

## 🎉 Completion

Once all checks pass:

1. Mark all checklist items as complete
2. Take screenshots if needed for documentation
3. Note any issues or observations
4. Icon integration is ready for production build

---

**Testing Date:** _______________  
**Tested By:** _______________  
**Status:** ⬜ Passed | ⬜ Failed | ⬜ Needs Review
