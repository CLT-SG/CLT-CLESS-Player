# Mobile setBounds Fix - Quick Reference

## What Was Fixed

**Problem:** `remote.getCurrentWindow().setBounds is not a function` error on mobile

**Solution:** Added mobile-compatible window manipulation APIs and intelligent layout handling

## Quick Test

```bash
cd mobile
npm run sync:android
npx cap run android
```

Expected: No setBounds errors, layouts render correctly

## Key Changes Summary

| File | Change |
|------|--------|
| `mobile-electron-shim.js` | Added `setBounds()`, `getBounds()`, `center()` methods |
| `mobile-layout-handler.js` | NEW - Mobile dimension management system |
| `layoutxml.js` | Mobile detection + conditional rendering |
| `looplayout.js` | Defensive checks for remote API calls |
| `activate.js` | Defensive checks for remote API calls |
| `index.html` | Load mobile-layout-handler.js, add mobile CSS |

## How It Works

### Desktop (Electron)
```javascript
remote.getCurrentWindow().setBounds({ width: 1920, height: 1080 })
// Actually resizes window ✓
```

### Mobile (Capacitor)
```javascript
remote.getCurrentWindow().setBounds({ width: 1920, height: 1080 })
// Stores dimensions, uses fullscreen viewport ✓
// No error thrown ✓
```

## Mobile Layout Behavior

| Layout Setting | Mobile Behavior |
|----------------|-----------------|
| `autoscale="Y"` | Fullscreen (100% viewport) |
| Fixed dimensions | Scaled to fit, aspect ratio maintained |
| Orientation change | Auto-recalculates and re-renders |

## Debug Checks

### Check if Fix is Loaded
```javascript
// In mobile app debug console:
console.log(!!window.mobileLayoutHandler) // Should be true
console.log(typeof remote.getCurrentWindow().setBounds) // Should be "function"
```

### Monitor Layout Changes
```javascript
window.addEventListener('mobile-layout-bounds-set', (e) => {
    console.log('Layout dimensions:', e.detail)
})
```

## Common Issues

| Symptom | Solution |
|---------|----------|
| Still getting setBounds error | Clear app cache, rebuild |
| Layout too small | Check autoscale setting |
| Layout cut off | Verify viewport meta tag |
| Not adapting to rotation | Ensure mobileLayoutHandler is loaded |

## Rollback Instructions

If issues occur, revert these commits:
```bash
git revert HEAD~6..HEAD  # Reverts last 6 commits (all fixes)
```

Or manually remove:
- `mobile-layout-handler.js` (delete file)
- Mobile-specific code from layoutxml.js (check git diff)
- Script tag from index.html

## Verification Steps

1. ✓ App builds without errors
2. ✓ Layouts load on mobile device
3. ✓ No "setBounds is not a function" in logs
4. ✓ Layouts render correctly in both orientations
5. ✓ Desktop app still works (regression test)

## Files Checklist

- [x] mobile-electron-shim.js - setBounds implementation
- [x] mobile-layout-handler.js - Created
- [x] layoutxml.js - Mobile detection added
- [x] looplayout.js - Defensive checks added
- [x] activate.js - Defensive checks added
- [x] index.html - Script tag + CSS added
- [x] Documentation created

---

For detailed technical documentation, see: `MOBILE-SETBOUNDS-FIX.md`
