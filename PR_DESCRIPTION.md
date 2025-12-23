## Fix: Mobile PNG Image Transparency - Remove Black Background

Addresses issue where PNG images with transparency displayed a black background instead of being transparent in the mobile app.

## Issues Fixed

1. PNG images with transparent areas showed black background in mobile app
2. Main container initialized with black background before layout background color applied
3. Transparent slots displayed black background underneath transparent images
4. Mobile behavior inconsistent with desktop Electron app which had no black background
5. Layout background briefly flashed black during initialization

## Technical Changes

1. Changed main container initial background-color from black to transparent in layoutxml.js
2. Removed hardcoded black background initialization at line 131
3. Transparent background maintained until actual layout background color loads from server
4. Ensures PNG transparency renders correctly without black showing through
5. Matches desktop Electron app behavior for consistent cross-platform experience

## Root Cause

The mobile app's layoutxml.js set a temporary black background on the main container:
- Line 131: $('#main').css({ "background-color": "black" })
- This black background persisted behind transparent elements
- Later, line 196 applied actual layout background color from server
- Gap between initialization and server config caused black to show through transparent PNGs
- Desktop version never had this black background initialization

## Files Changed Summary

Mobile App:
- mobile/www/assets/js/layoutxml.js - Changed background-color from black to transparent on line 131

## Testing

- Verified PNG images with transparency render without black background
- Confirmed transparent slots show proper background
- Tested layout initialization with various background colors
- Ensured server background color still applies correctly at line 196
- Validated behavior matches desktop Electron app
- No visual artifacts or background color issues

