Android Mobile App - QR Code Generation Fix

This PR fixes QR code generation in the mobile activation page to display real scannable QR codes instead of placeholder graphics.

## Summary of Key Issues Fixed

### Version 3.1.9 - QR Code Generation Fix

1. **QR Code Not Scannable** - Mobile activation page showed placeholder graphics instead of real QR code
2. **Missing QR Code Library** - Mobile app lacked the qrcode npm package used by desktop app
3. **Poor User Experience** - Users could not scan QR code to request license keys via WhatsApp

## Core Technical Improvements

### Version 3.1.9 - QR Code Generation System

1. **QR Code Library Integration**
   - Added qrcode@1.5.0 npm package to mobile dependencies
   - Created mobile-qrcode.js module for mobile-optimized QR generation
   - Implemented multi-tier loading strategy with CDN fallback
   - Matches electron desktop app QR code functionality

2. **Professional QR Code Generator**
   - Uses QRCode.toCanvas() for real scannable QR codes
   - Dynamic CDN loading from jsdelivr if bundled version unavailable
   - WhatsApp integration with device UUID in message
   - Clickable QR codes as backup if scanning not available

3. **Graceful Fallback Strategy**
   - Primary: Bundled qrcode library from npm install
   - Secondary: CDN-loaded library from jsdelivr
   - Tertiary: Simple clickable placeholder with WhatsApp link
   - Comprehensive error handling and debug logging

4. **Mobile Activation Enhancement**
   - Replaced canvas drawing placeholder with real QR generation
   - Async initialization with proper error handling
   - User-friendly fallback messages if library fails
   - Professional appearance matching desktop app

## Files Changed Summary

### Version 3.1.9 - QR Code Generation Fix

**Dependencies**
- mobile/package.json - Added qrcode@1.5.0 dependency

**Mobile JavaScript APIs**
- mobile/www/assets/js/mobile/mobile-qrcode.js - New QR code generator module (281 lines)
- mobile/www/activate.html - Integrated proper QR code generation with mobile-qrcode.js

**Documentation**
- mobile/docs_mobile/QR-CODE-FIX-IMPLEMENTATION.md - Complete technical documentation
- mobile/docs_mobile/QR-CODE-FIX-QUICKREF.md - Quick reference guide

## Compatibility

- [X] Desktop Electron app unchanged
- [X] Works on Android 5.0 to 14+
- [X] No breaking changes
- [X] No server-side changes required

## Testing Checklist

### Build Verification
- [X] Clean build completes without errors
- [X] qrcode@1.5.0 package installed successfully
- [X] mobile-qrcode.js module created
- [X] activate.html updated with QR integration

## Version History

**v3.1.9** - QR code generation fix

Statistics
- 2 files modified (package.json, activate.html)
- 1 new file created (mobile-qrcode.js - 281 lines)
- 2 documentation files created
- QR code library added and integrated
- Real scannable QR codes replace placeholder graphics
- Multi-tier fallback strategy implemented
- Zero functional changes to other app features