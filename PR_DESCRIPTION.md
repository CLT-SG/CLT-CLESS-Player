## Fix: Mobile Duplicate Initialization on Startup

Addresses issue where mobile app initialization ran twice on startup, causing duplicate notifications and potential race conditions.

## Issues Fixed

1. Connected notification appeared twice on mobile app startup
2. initializeWithConfig() called from two locations simultaneously
3. playcheckNetwork() executed twice due to duplicate initialization
4. Potential race conditions from concurrent app initialization flows
5. No guard mechanism to prevent duplicate initialization

## Technical Changes

1. Added isAppInitialized guard flag to prevent duplicate initialization
2. Modified initializeWithConfig() to check guard flag and return early if already initialized
3. Guard flag set to true on first successful initialization
4. Follows singleton pattern for app initialization lifecycle
5. Matches Electron desktop version's single initialization pattern

## Root Cause

The app had two initialization paths:
- configLoaded event listener at line 251 (when config loads asynchronously)
- Fallback check at line 1119 (checking if config already loaded)

Both paths called initializeWithConfig() leading to duplicate execution of:
- validateActivation()
- startApplication()
- playcheckNetwork()
- Success notification display

## Files Changed Summary

Mobile App:
- mobile/www/index.html - Added isAppInitialized guard flag and duplicate prevention logic in initializeWithConfig()

## Testing

- Verified Connected notification appears only once on startup
- Confirmed no duplicate playcheckNetwork() calls
- Tested both initialization paths (event listener and fallback)
- Ensured app starts correctly without race conditions
- Validated guard flag prevents duplicate initialization
- Console logs show single initialization sequence

