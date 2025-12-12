Android Mobile App - Date and Time Formatting Fix

This PR fixes the date and time slot rendering issue in the mobile CMS player where format tokens were not properly interpreted, causing dates to display as "12 12M 2025" instead of "12 Dec 2025" and times to show as "hh:20 A" instead of "03:20 PM".

## Summary of Key Issues Fixed

1. **Date Format Tokens Not Working** - Date slots displayed "12 12M 2025" instead of "12 Dec 2025" due to incomplete datetime implementation
2. **Time Format Tokens Not Working** - Time slots showed "hh:20 A" instead of "03:20 PM" with 12-hour format not supported
3. **Month Names Not Rendering** - MMM and MMMM tokens displayed as literal "12M" instead of month abbreviations/names
4. **12-Hour Time Format Broken** - hh and A tokens for 12-hour format and AM/PM meridiem not functional
5. **Android WebView Syntax Error** - ES6+ JavaScript syntax in bundle caused "Unexpected token '='" error in older Android WebViews
6. **Deprecated Plugin Calls** - date-and-time v3.x plugin system calls failing in v4.x implementation

## Core Technical Improvements

1. **date-and-time Library Integration**
   - Integrated proper date-and-time v4.x library to replace basic shim implementation
   - Created Rollup bundle configuration to package library for mobile WebView
   - Library supports all format tokens: DD, MMM, MMMM, ddd, dddd, hh, A, etc.
   - Matches date/time functionality of Electron desktop app

2. **ES5 Transpilation with Babel**
   - Added @rollup/plugin-babel for JavaScript transpilation
   - Configured @babel/preset-env targeting Android 5.0+ (Chrome 55+)
   - Converts ES6+ syntax (arrow functions, const, let) to ES5-compatible code
   - Fixes "Unexpected token '='" syntax error in older Android WebViews

3. **Mobile Electron Shim Enhancement**
   - Replaced basic datetime implementation with proper library reference
   - Added fallback mechanism if bundle fails to load
   - Removed v3.x plugin system stubs (meridiem, ordinal) now built-in to v4.x
   - Added console logging for debugging datetime library initialization

4. **Script Loading Order Fix**
   - Added datetime.bundle.js script tag before mobile-electron-shim.js
   - Ensures date-and-time library loads before shim initialization
   - Prevents "datetime is not defined" errors during app startup
   - Proper dependency chain for mobile module loading

5. **Deprecated Plugin System Removal**
   - Removed datetime.plugin(meridiem) and datetime.plugin(ordinal) calls from index.html
   - date-and-time v4.x has these features built-in, no plugin system needed
   - Fixes "datetime.plugin is not a function" TypeError
   - Updated initialization code to match v4.x API

6. **Build Pipeline Integration**
   - Added build:datetime npm script to package.json
   - Integrated datetime bundle building into sync:android and sync:ios commands
   - Ensures bundle is always rebuilt before syncing to mobile platforms
   - Automated build process prevents stale bundle issues

## Files Changed Summary

**Library Bundle Configuration**
- mobile/www/assets/js/mobile/datetime-imports.js - Created import wrapper for date-and-time v4.x
- mobile/rollup.datetime.config.js - Created Rollup configuration with Babel transpilation to ES5
- mobile/www/assets/js/mobile/datetime.bundle.js - Generated ES5-compatible bundle (38KB)

**Mobile JavaScript Shim**
- mobile/www/assets/js/mobile/mobile-electron-shim.js - Replaced basic datetime with proper library reference

**Mobile HTML**
- mobile/www/index.html - Added datetime.bundle.js script tag and removed deprecated plugin calls

**Build Configuration**
- mobile/package.json - Added build:datetime script and integrated into sync commands, added Babel dependencies

**Slot Rendering**
- mobile/www/assets/js/slot-datetime.js - Already compatible with date-and-time v4.x format tokens (no changes needed)

**Documentation**
- mobile/DATE_TIME_FIX_SUMMARY.md - Comprehensive fix documentation with technical details
- mobile/DATE_TIME_DEBUGGING.md - Debugging guide for date/time issues

## Compatibility

- Desktop Electron app: 100% unchanged, unaffected
- Mobile app: Date and time formatting now matches desktop app
- Android 5.0+ (API 21+): ES5-transpiled JavaScript for compatibility
- Android 11+ tested and verified
- Minimum SDK: 22 (Android 5.1 Lollipop)
- Target SDK: 33 (Android 13 Tiramisu)
- No breaking changes
- No server-side changes required
- Works with all existing layout configurations

## Testing Checklist

- Date slot displays "12 Dec 2025" instead of "12 12M 2025"
- Time slot shows "03:20 PM" instead of "hh:20 A"
- Date format "dd mmm yyyy" renders with proper month abbreviation
- Time format "HH:nn AM/PM" displays with correct 12-hour format and meridiem
- No "Unexpected token '='" JavaScript syntax errors in Android logcat
- Console shows "Using date-and-time v4.x library from bundle" message
- No "datetime.plugin is not a function" errors
- All date format tokens work: DD, MM, MMM, MMMM, YY, YYYY, ddd, dddd
- All time format tokens work: HH, hh, mm, ss, A (AM/PM)
- Date/time updates every second without errors
- Works on Android 5.1+ devices and emulators
- datetime.bundle.js loads without errors in WebView
- Transpiled ES5 code compatible with older Android WebViews