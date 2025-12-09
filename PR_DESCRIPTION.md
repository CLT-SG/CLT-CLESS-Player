Mobile CMS Player Architecture Migration

This PR restructures the mobile app to properly implement the CMS player as the main application, replacing the incorrect architecture where the dashboard was used as the primary interface.

Problem

The mobile app was incorrectly using cpanel.html (dashboard/control panel) as the main entry point instead of index.html (CMS content player). The dashboard is meant for remote control and monitoring, not as the primary application interface.

Before (Incorrect)
- index.html was the dashboard (cpanel.html)
- No CMS player functionality
- Missing layout rendering and media playback

After (Correct)
- index.html is the CMS Player (plays layouts and media)
- dashboard.html is the control panel (accessible via navigation)
- Proper dual-interface architecture matching desktop Electron app

Solution

Restructured the mobile app with comprehensive changes to build system, API compatibility layer, Socket.IO connection management, and navigation flow.

Key Changes

1. Build System Restructuring (build-mobile.js)
   - Changed src/index.html to mobile/www/index.html (CMS Player)
   - Changed src/cpanel.html to mobile/www/dashboard.html (Dashboard)
   - Added Socket.IO CDN injection (v4.5.4)
   - Injected mobile-specific scripts in correct order
   - Added navigation buttons between interfaces

2. Electron API Compatibility Layer (NEW: mobile-electron-shim.js)
   - Complete Electron API shims for mobile browsers
   - window.log, window.xmljs, window.datetime, window.path, window.os
   - window.fs, window.dns, window.isReachable, window.ipcRenderer, window.remote
   - 400 lines of compatibility code

3. Socket.IO Connection Management (NEW: mobile-socketio-manager.js)
   - Dynamic server address from configuration
   - Automatic reconnection with exponential backoff
   - App lifecycle handling (pause/resume)
   - Network change detection and recovery
   - 316 lines of connection management

4. Socket.IO Integration (NEW: mobile-socketio-adapter.js)
   - Bridges socketio-cpanel.js with managed socket
   - Prevents duplicate connections
   - 98 lines of adapter logic

5. Configuration Updates
   - Updated capacitor.config.json with proper entry point
   - Enhanced mobile-config.js for CMS compatibility
   - Added cleartext support for development

6. Navigation Implementation
   - CMS Player: "Dashboard" button (top-right, blue)
   - Dashboard: "Back to Player" button (top-left, green)
   - Responsive design with Bootstrap Icons

Modified Files
- mobile/build-mobile.js - Restructured file processing and script injection
- mobile/capacitor.config.json - Updated entry point to index.html
- mobile/README.md - Comprehensive architecture documentation
- mobile/QUICKSTART.md - Added architecture change notice

New Files
- mobile/www/assets/js/mobile-electron-shim.js (400 lines)
- mobile/www/assets/js/mobile-socketio-manager.js (316 lines)
- mobile/www/assets/js/mobile-socketio-adapter.js (98 lines)
- mobile/MIGRATION-SUMMARY.md - Complete technical summary

Generated Files (by build script)
- mobile/www/index.html - CMS Player from src/index.html
- mobile/www/dashboard.html - Dashboard from src/cpanel.html

Technical Architecture

Script Load Order (CMS Player)
1. Capacitor Core (Module)
2. Mobile Electron Shim (API compatibility)
3. Mobile Config (Configuration loader)
4. Socket.IO CDN (v4.5.4)
5. Mobile Socket.IO Manager (Connection manager)
6. Mobile Socket.IO Adapter (Bridge to socketio-cpanel.js)
7. socketio-cpanel.js (Socket.IO event handlers)
8. Layout and slot rendering scripts

Data Flow
App Launch > Load Config > Initialize Electron Shims > Connect Socket.IO > Load DS XML > Parse and Render > Play Media > Handle Updates

Key Features Implemented

CMS Player Features
- Layout XML parsing and rendering
- Media playback (video.js, HLS, FLV)
- Content slots (text, ticker, scroller, fader, datetime, table, HTML)
- Layout loops and scheduling
- Offline mode with localStorage caching
- Real-time updates via Socket.IO
- Navigation to dashboard

Dashboard Features
- Remote layout switching
- Text and media slot updates
- System monitoring
- Configuration management
- Device information
- Navigation back to player

Mobile Optimizations
- Touch-friendly navigation
- Responsive design
- Network resilience
- App lifecycle management
- Background/foreground handling
- Offline capability

Testing Status

Completed
- Build system execution
- File generation verification
- Socket.IO script injection
- Navigation button injection
- Configuration structure
- Documentation

Pending Device Testing
- Video playback on Android
- Layout rendering verification
- Offline mode testing
- Socket.IO connection testing
- Dashboard functionality
- End-to-end flow testing

Compatibility

- Desktop Electron application completely unchanged
- iOS and Android platforms supported
- No breaking changes to existing functionality
- Follows desktop app architecture pattern
- Same API endpoints and server communication

Files Changed

Modified
- mobile/build-mobile.js (restructured file processing)
- mobile/capacitor.config.json (entry point update)
- mobile/README.md (architecture documentation)
- mobile/QUICKSTART.md (migration notice)

New
- mobile/www/assets/js/mobile-electron-shim.js
- mobile/www/assets/js/mobile-socketio-manager.js
- mobile/www/assets/js/mobile-socketio-adapter.js
- mobile/MIGRATION-SUMMARY.md

Generated (by build script)
- mobile/www/index.html
- mobile/www/dashboard.html

Statistics

- 3 new JavaScript modules (812 lines total)
- 4 configuration and build files modified
- 80+ lines of documentation added
- Complete architecture restructuring
- Fully automated build system

Next Steps

1. Build Android APK: cd mobile && npm run build && npm run build:android
2. Deploy to test device
3. Verify CMS player launches correctly
4. Test layout rendering and media playback
5. Validate Socket.IO server connection
6. Test navigation between player and dashboard
7. Complete end-to-end flow testing

Recent Updates

Critical Android Startup Crash Fix (v2.9.1 - 2025-12-09)

Problem
- App crashed immediately on launch with NullPointerException
- Error: "Provided server url is invalid: no protocol: index.html"
- Capacitor failed to parse invalid server URL configuration

Root Causes Identified
1. Invalid server.url in capacitor.config.json without protocol
2. Script loading race condition - config loaded before Capacitor ready
3. 5-second timeout too short for Capacitor initialization
4. Missing error handling and user feedback

Fixes Implemented
1. Capacitor Configuration Fix
   - Removed invalid "url": "index.html" from server config
   - Capacitor now loads correctly from local webDir
   - Eliminated NullPointerException at startup

2. Script Loading Order Fix
   - Moved Capacitor scripts from start to end of head tag
   - Added defer attribute for non-blocking execution
   - Proper dependency chain: jQuery > Capacitor > Config > App

3. Enhanced Error Handling
   - Extended timeout from 5s to 10s
   - Added graceful fallback to web-only mode
   - Visual error messages with recovery options
   - Loading indicators with status updates

4. System Diagnostics Page
   - Real-time Capacitor initialization status
   - Device information and network status
   - Configuration validation
   - Plugin availability checker
   - System logs viewer with export
   - Accessible via new diagnostics button

Files Modified
- mobile/capacitor.config.json (removed invalid server.url)
- mobile/www/assets/js/mobile-config.js (enhanced error handling)
- mobile/www/index.html (added diagnostics button)
- mobile/build-mobile.js (fixed script injection order)

Files Created
- src/diagnostics.html (comprehensive debugging interface)
- mobile/BUGFIX-SUMMARY.md (technical documentation)

Testing Status
- App launches successfully without crashes
- All Capacitor plugins initialize correctly
- Configuration loads with proper fallback
- Diagnostics page shows green status indicators
- Navigation between all pages works correctly
- Build process completes without errors

Configuration Required

Before building, update server configuration in mobile/www/assets/js/mobile-config.js:

{
  "hostserver": "https://your-ecless-server.com",
  "masterServerAddress": "your-ecless-server.com",
  "masterServerPort": 9000,
  "id": "YOUR_DEVICE_ID"
}