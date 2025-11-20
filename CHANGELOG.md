# Change Log

## [2.7.5] - 2025-11-20

### Fixed
- **Offline Mode Black Screen Issue** - Resolved critical offline mode functionality blocking error
  - Fixed "getxml is not defined" error in looplayout.js that caused black screen in offline mode
  - Resolved issue where layoutLoopUpdateXML() attempted to call undefined getxml() function
  - Fixed application crash when network requests failed in offline mode without proper fallback
  - Corrected error handler to gracefully use cached data instead of calling unavailable functions
  - Fixed "Cannot read properties of undefined (reading 'attributes')" error in loop layout playback
  - Resolved issue where loopArr was empty causing playcurrentLayout() to fail on second loop iteration
  - Fixed missing loop array population (loopArr, layoutURLList, layoutIDList) in offline mode

### Enhanced
- **Offline Mode Data Loading** - Improved offline mode reliability and error handling
  - Added offline mode detection at start of layoutLoopUpdateXML() to bypass network requests
  - Implemented comprehensive error handler with intelligent fallback to cached localStorage data
  - Enhanced cache verification system checking both layout-* and layout-offline-* storage keys
  - Added safety check to only call getxml() if function exists AND not in offline mode
  - Improved error recovery allowing playback to continue with available cached layouts
  - Implemented loop array population system to ensure continuous loop playback in offline mode
  - Added automatic extraction of layout URLs and IDs from cached DS data for loop management

- **Offline Mode Debugging** - Comprehensive logging for offline mode troubleshooting
  - Added detailed logging for offline mode detection and cache usage
  - Implemented structured log messages for successful cache operations
  - Enhanced error logging with clear warnings for missing cached layouts
  - Added cache verification logging showing available layout data
  - Improved debugging visibility for offline mode operations

### Technical Improvements
- **Loop Layout Error Handling** - Professional offline mode implementation in looplayout.js
  - Refactored layoutLoopUpdateXML() with early offline mode detection and exit
  - Enhanced AJAX error handler with comprehensive try-catch blocks and cache fallback
  - Implemented proper Promise resolution for both online and offline data loading
  - Added intelligent layout cache verification with graceful degradation
  - Enhanced error messaging with actionable information for troubleshooting
  - Implemented loop array population in both offline mode detection and error handler sections
  - Added forEach iteration to extract and populate layout metadata from cached DS elements
  - Ensured loopNextLayout() can access valid layout data for all subsequent loop iterations
  - Added comprehensive logging to confirm array population for debugging and verification

### Compatibility
- Maintains full backward compatibility with existing online mode functionality
- Online mode network operations unchanged and continue normal operation
- All existing layout caching mechanisms preserved and enhanced
- Offline mode now works as originally intended without network dependency

## [2.7.3] - 2025-11-18

### Added
- **Activation Page Application Restart** - Automatic application restart after license activation
  - Implemented IPC communication pattern matching configure.html save button behavior
  - Added config-save-response event listener for activation page
  - Automatic application restart after successful license key activation
  - Success dialog with 5-second auto-dismiss before restart
  - Comprehensive error handling with user-friendly error messages

### Enhanced
- **License Activation Workflow** - Improved reliability and user experience
  - Replaced fetch API calls with Electron IPC for more reliable communication
  - Configuration preservation system ensures all settings maintained during activation
  - Enhanced error feedback with detailed error messages
  - Fallback to fetch API for edge cases where IPC is unavailable
  - Consistent behavior with configuration save functionality

### Fixed
- **Manual Restart Required** - Resolved issue where activation required manual application restart
  - Fixed activation page not restarting application after license key save
  - Ensured proper IPC message flow from renderer to main process
  - Corrected configuration object structure to match main process expectations
  - Eliminated need for manual application restart after activation

### Technical Improvements
- **IPC Architecture** - Professional inter-process communication implementation
  - Modified activate() function to use ipcRenderer.send('app-configsave')
  - Added IPC listener in onDOMContentLoaded() for config-save-response
  - Proper configuration object construction preserving all settings
  - Maintained backward compatibility with fetch API fallback
  - Comprehensive logging for debugging and troubleshooting

### User Experience
- Seamless activation workflow with automatic restart
- Clear success feedback before application restart
- No manual intervention required after activation
- Consistent behavior across configuration and activation pages
- Professional error handling with actionable error messages

## [2.7.2] - 2025-11-18

### Added
- **Custom Dialog System** - Professional in-window modal dialogs for alwaysOnTop compatibility
  - Created `custom-dialog.js` utility replacing native alert() and confirm() calls
  - Implemented auto-dismiss feature with 5-second timeout for informational alerts
  - Added keyboard navigation support (Enter to confirm, Escape to cancel)
  - Professional styling with smooth animations (fadeIn, slideIn effects)
  - Multiple dialog types with appropriate icons and themes: info, success, warning, error, question
  - Promise-based API for clean async/await usage
  - Countdown timer display showing remaining seconds before auto-close
  - Responsive design working across all screen sizes

- **AlwaysOnTop State Management** - Intelligent window state control for dialog visibility
  - Automatic alwaysOnTop disabling when loading configure.html or activate.html
  - Automatic alwaysOnTop restoration when returning to main player (index.html)
  - Event-driven architecture using did-finish-load for seamless state transitions
  - Enhanced keyboard shortcut (Ctrl+1) to disable alwaysOnTop before opening configure page
  - Comprehensive logging for window state changes and debugging

- **IPC-Based Configuration Dialogs** - Non-blocking configuration save workflow
  - Replaced Electron's blocking dialog.showMessageBox with IPC response system
  - Renderer process handles dialog display using custom modal system
  - config-save-response event for communication between main and renderer processes
  - Enhanced error handling with user-friendly error messages
  - Automatic application restart after successful configuration save

### Fixed
- **Dialog Visibility Issue** - Resolved critical UX problem with hidden message boxes
  - Fixed native dialogs appearing behind alwaysOnTop windows in activation page
  - Fixed configuration save dialogs being unclickable behind main window
  - Resolved issue where users couldn't dismiss dialogs due to window stacking
  - Fixed keyboard focus issues with native browser dialogs

### Enhanced
- **Activation Page (activate.html)** - Complete dialog system integration
  - Replaced all alert() calls with customAlert() featuring auto-dismiss
  - Replaced all confirm() calls with customConfirm() for better UX
  - Enhanced copy MAC address error handling with custom error dialogs
  - Improved license validation feedback with type-specific dialogs (warning, success, error)
  - Added async/await support for cleaner code flow
  - Professional toast notifications for copy operations

- **Configuration Page (configure.html)** - Enhanced save workflow
  - Integrated custom dialog system for configuration save confirmation
  - Added IPC listener for config-save-response events
  - Success dialog displays copyright information with 5-second auto-dismiss
  - Error dialog shows detailed failure messages with appropriate styling
  - Automatic application restart after user acknowledgment or timeout
  - Non-blocking save operation preserving application responsiveness

### Technical Improvements
- **Custom Dialog Architecture** - Professional modal system implementation
  - CustomDialog class with comprehensive dialog management
  - Support for multiple simultaneous dialog configurations
  - Automatic cleanup and memory leak prevention
  - Z-index management ensuring proper stacking (999999)
  - CSS animations with keyframe definitions
  - Accessible button focus management
  - Timeout management with proper cleanup

- **Window State Lifecycle** - Robust alwaysOnTop management
  - did-finish-load event listener for automatic state detection
  - URL-based window state determination (index.html vs configure.html vs activate.html)
  - Graceful state transitions without user intervention
  - Maintains proper taskbar visibility during configuration
  - Menu bar visibility control coordinated with alwaysOnTop state

- **Error Handling & Resilience** - Comprehensive error management
  - Try-catch blocks throughout dialog system
  - Graceful fallback mechanisms for missing DOM elements
  - Detailed error logging for debugging
  - User-friendly error messages with actionable guidance
  - Connection error recovery for IPC communication

### Documentation
- **Implementation Guide** - Complete technical documentation
  - Created `/docs/ALWAYSONTOP-DIALOG-FIX.md` with comprehensive system architecture
  - Detailed API reference for custom dialog functions
  - Testing checklist covering all scenarios
  - Visual verification guidelines for QA
  - Future enhancement suggestions
  - Created `/DIALOG-FIX-SUMMARY.md` as quick reference guide

### API Changes
- **Custom Dialog API** - New public functions available in renderer process
  - `customAlert(message, options)` - Show alert with optional timeout
  - `customConfirm(message, options)` - Show confirmation dialog
  - `window.customDialog` - Direct access to DialogManager instance
  - Options: type, timeout, title, buttonText, confirmText, cancelText

### Compatibility
- Full backward compatibility maintained with existing functionality
- No breaking changes to any existing APIs or workflows
- Works seamlessly with all existing IPC handlers
- Compatible with all supported platforms (Windows, Linux, macOS)
- Zero impact on main player functionality or performance

### Performance
- Minimal memory footprint for dialog system
- Efficient DOM manipulation with cleanup
- No performance impact on main application
- Optimized animation rendering
- Proper event listener cleanup preventing memory leaks

### Security
- XSS protection through proper text sanitization
- No inline JavaScript in dialog content
- Secure IPC communication patterns
- Proper event handler cleanup

### User Experience
- Dialogs always visible and clickable
- Auto-dismiss prevents user frustration
- Professional appearance matching eCLESS design
- Keyboard shortcuts improve accessibility
- Smooth animations enhance perceived performance
- Clear visual feedback for all user actions

## [2.7.1] - 2025-11-18

### Added
- **Multi-NIC Serial Key Validation** - Any detected network interface MAC address can be used for license activation
  - Serial key validation now checks against ALL detected physical network interfaces
  - License is valid if the key matches ANY physical network adapter (Ethernet, WiFi, USB Network, Bluetooth)
  - Flexible licensing system supports hardware changes and multiple network configurations
  - Users can switch between Ethernet and WiFi without requiring new license keys
  - USB network adapters and hot-pluggable interfaces fully supported
  - Backward compatible with existing single-MAC serial keys

- **All MAC Addresses Display** - Complete visibility of all network interfaces on activation screen
  - Activation page now displays all detected physical network interfaces in a scrollable list
  - Each interface shows: interface name, type, MAC address, and IP address
  - Primary network interface clearly marked with badge
  - Individual copy-to-clipboard buttons for each MAC address
  - WhatsApp QR code includes all detected MAC addresses for easier license requests
  - Real-time interface detection on page load

- **Control Panel License Monitor** - Live license status for all network interfaces
  - New "Network Interfaces & License Status" section in control panel
  - Displays real-time validation status for each detected interface
  - Visual badges show Licensed (green checkmark) or Not Licensed (gray) status
  - New API endpoint: GET /api/network-license-status for interface validation data
  - Auto-refresh every 30 seconds to monitor license status changes
  - Comprehensive interface details including type, MAC address, and IP

### Enhanced
- **Serial Key Validation Architecture** - Professional multi-interface license validation system
  - Created SerialKeyValidator.js module with comprehensive MAC address management
  - getAllNetworkMACs() function detects all physical network adapters
  - validateSerialKey() checks license key against all detected interfaces
  - generateSerialKey() creates SHA-256 hash for any MAC address
  - Smart virtual interface filtering excludes Docker, VMware, VirtualBox, WSL, Hyper-V, loopback
  - Interface type detection categorizes adapters (Ethernet, WiFi, USB Network, Bluetooth, Other)
  - 5-second caching mechanism for performance optimization

- **Activation Page Enhancements** - Complete multi-NIC support in activation workflow
  - Updated activate.js with getAllMacAddresses() for comprehensive interface detection
  - displayAllMacAddresses() renders all interfaces with detailed information
  - Enhanced QR code generation includes all MAC addresses in WhatsApp message
  - Individual copy buttons for each detected MAC address with toast notifications
  - Professional card-based layout for network interface list
  - Primary interface badge highlights main network adapter

- **Application Licensing Logic** - Flexible multi-interface validation in main application
  - Updated index.js to validate serial key against all physical network interfaces
  - License valid if key matches ANY detected physical interface
  - Enhanced logging shows all detected interfaces and validation results
  - Graceful offline mode fallback when no interfaces detected
  - Maintains existing offline mode functionality
  - Comprehensive validation reports for diagnostics

- **Activation UI Improvements** - Refined user interface for better readability
  - Removed emoji icons from network interface list for cleaner text-based display
  - Network interface types now displayed as plain text (Ethernet, WiFi, USB Network, Bluetooth, Other)
  - Improved visual clarity by removing decorative icons while maintaining all functionality
  - Enhanced professional appearance with simplified interface type labels

- **Responsive Layout Optimization** - Comprehensive responsive design for activation page
  - Fixed page scrolling issues - viewport now locked to 100vh with no page scroll
  - Implemented flexbox-based layout with scrollable network interfaces section only
  - Added responsive breakpoints for tablets (768px), mobile (480px), and short screens (600px height)
  - Optimized spacing and font sizes across all screen sizes (title: 1.8em desktop, 1.5em tablet, 1.3em mobile)
  - QR code responsive sizing: 150px (desktop), 120px (tablet), 100px (mobile)
  - All non-scrollable sections use flex-shrink:0 to prevent overflow
  - Company name hidden on very short screens to maximize content space
  - Button layout remains horizontal on mobile for better usability
  - Ultra-compact spacing on small screens (margins reduced by 30-50%)

### Technical Improvements
- **SerialKeyValidator Module** - Professional utility class for multi-NIC management
  - Comprehensive MAC address detection across all physical network interfaces
  - Virtual interface filtering with 14 regex patterns (Docker, VMware, VirtualBox, WSL, etc.)
  - Interface type detection and categorization
  - SHA-256 hash generation for license keys with secret key 'Clt@2022'
  - Performance caching with 5-second TTL
  - Detailed validation reports for troubleshooting
  - getValidationReport() provides diagnostic information

- **Control Panel API** - New endpoints for network license management
  - GET /api/network-license-status returns all interfaces with validation status
  - Response includes interfaces array, licenseValid boolean, matchedInterface object
  - Integration with SerialKeyValidator for consistent validation logic
  - Real-time status updates via Socket.IO when configuration changes
  - Comprehensive error handling and graceful degradation

- **CSS Architecture** - Professional responsive design system
  - Fixed html/body to overflow:hidden preventing unwanted page scrolling
  - Container changed from min-height:100vh to fixed height:100vh
  - Main content area uses flexbox column layout with proper height constraints
  - Network interfaces section uses flex:1 with overflow-y:auto for isolated scrolling
  - Media queries cover all common device sizes and orientations
  - Maintains accessibility and usability across all screen sizes

### UI/UX Enhancements
- Better hardware flexibility - works seamlessly when switching between Ethernet and WiFi
- USB network adapter support for hot-pluggable scenarios
- Complete visibility of all network interfaces for easier license requests
- Cleaner, more professional network interface display without emoji clutter
- Better readability with text-only interface type labels
- Improved mobile experience with optimized touch targets and spacing
- No-scroll design ensures all critical elements remain visible
- Consistent visual hierarchy across all device sizes
- Toast notifications for copy actions provide better user feedback

### Documentation
- **Multi-NIC Implementation Guide** - Comprehensive technical documentation
  - Created docs/MULTI-NIC-SERIAL-KEY.md with complete system architecture
  - Detailed serial key generation process explanation
  - End-user activation guide with troubleshooting section
  - API reference documentation for developers
  - Testing scenarios covering all use cases
  - Migration guide for existing installations

### Security
- Maintained SHA-256 hashing algorithm for license key generation
- Secret key unchanged: 'Clt@2022' for backward compatibility
- Virtual interface filtering prevents VM-based license bypass attempts
- Secure validation logic with proper error handling

### Compatibility
- Full backward compatibility with existing single-MAC serial keys
- Existing licenses continue to work without any changes
- No configuration changes required for current installations
- Automatic detection and validation of all network interfaces
- Graceful degradation when no interfaces detected

### Key Benefits
1. Hardware flexibility - switch between Ethernet/WiFi without relicensing
2. USB adapter support - hot-pluggable network adapters work seamlessly
3. Better diagnostics - all interfaces visible for troubleshooting
4. Easier support - users can provide any MAC address for licensing
5. Reduced relicensing - hardware changes don't require new keys
6. Professional UI - clean, responsive activation experience

## [2.7.0] - 2025-11-18

### 🎉 Major Features - Multi-NIC Serial Key Validation System

#### Professional Multi-Network Interface Detection
- **Comprehensive NIC detection** - Automatically detects all physical network adapters (Ethernet, WiFi, USB Network, Bluetooth)
- **Flexible license activation** - Serial key can be generated for ANY detected physical network interface
- **Smart virtual interface filtering** - Excludes Docker, VMware, VirtualBox, WSL, Hyper-V and other virtual adapters
- **Enhanced activation screen** - Displays all MAC addresses with copy-to-clipboard functionality
- **Control panel license monitor** - Real-time validation status for all network interfaces
- **Backward compatible** - Existing single-MAC serial keys continue to work seamlessly

### ✨ New Components

#### SerialKeyValidator Module (`SerialKeyValidator.js`)
- Professional utility class for multi-NIC MAC address management
- `getAllNetworkMACs()` - Retrieves all physical network interface MAC addresses
- `generateSerialKey(mac)` - Generates SHA-256 hash for license keys  
- `validateSerialKey(key)` - Validates against all detected interfaces
- `getValidationReport(key)` - Detailed diagnostics for troubleshooting
- Interface type detection: Ethernet, WiFi, USB Network, Bluetooth, Other
- 5-second caching mechanism for performance optimization

#### Enhanced Activation UI
- Multi-MAC address display with interface details (type, MAC, IP)
- Visual interface type icons (🔌 Ethernet, 📶 WiFi, 🔗 USB Network)
- Primary interface badge for main adapter
- Individual copy buttons for each MAC address
- WhatsApp QR code includes ALL detected MACs
- Toast notifications for copy actions
- Responsive card-based layout

#### Control Panel License Status
- New "Network Interfaces & License Status" section
- Real-time license validation display  
- Visual badges: ✓ Licensed (green) / Not Licensed (gray)
- Alert messages showing validation status
- Interface details: name, type, MAC address, IP
- API endpoint: `/api/network-license-status`
- Auto-refresh every 30 seconds

### 🔧 Technical Enhancements

#### License Validation (`index.js`)
- Replaced single MAC check with multi-NIC validation
- Validates serial key against ALL physical interfaces
- License valid if key matches ANY interface
- Enhanced logging with interface details
- Validation reports for diagnostics
- Graceful offline mode fallback

#### Logging & Diagnostics
- Comprehensive network interface operation logging
- Detailed validation results with success/failure reasons
- Interface discovery logs showing all adapters
- Debug mode with verbose output
- Structured log prefixes: `SerialKeyValidator:`

### 📚 Documentation

#### New Files
- **docs/MULTI-NIC-SERIAL-KEY.md** - Complete implementation guide
  - Technical architecture and design
  - Serial key generation process
  - End-user activation guide
  - Troubleshooting section
  - API reference documentation
  - Testing scenarios
  - Migration guide

#### Updated Documentation
- CHANGELOG.md - Comprehensive 2.7.0 release notes
- Enhanced code comments throughout

### 🎨 UI/UX Improvements
- Modern card-based layouts
- Color-coded status indicators
- Responsive design for all screens
- Professional CSS styling
- Improved visual hierarchy
- Better error messages

### 🐛 Bug Fixes
- Fixed MAC address fallback in activation
- Improved network interface error handling
- Enhanced clipboard functionality
- Fixed QR code with multiple MACs

### ⚡ Performance
- Network interface caching (5-sec TTL)
- Reduced redundant system calls
- Optimized validation algorithm
- Efficient duplicate removal

### 🔒 Security
- Maintained SHA-256 hashing
- Virtual interface filtering
- Secure validation logic
- Secret key unchanged: 'Clt@2022'

### 🧪 Testing Coverage
- ✅ Single NIC (Ethernet only)
- ✅ Multiple NICs (Ethernet + WiFi)
- ✅ USB network adapters
- ✅ Virtual interface filtering
- ✅ Backward compatibility
- ✅ Offline mode operation

### 🚀 Key Benefits
1. **Hardware Flexibility** - Works across Ethernet/WiFi switches
2. **USB Support** - Hot-pluggable adapters supported
3. **Redundancy** - Multiple interfaces for reliability
4. **Better Diagnostics** - Clear interface visibility
5. **Easier Support** - All MACs visible for licensing
6. **Improved UX** - Users see license status clearly

### 📝 API Changes

**New Endpoint:** `GET /api/network-license-status`

Response:
```json
{
  "interfaces": [...],
  "licenseValid": boolean,
  "matchedInterface": {...},
  "validationReason": "string",
  "timestamp": "ISO8601"
}
```

### 🔄 Migration
- ✅ No action required
- ✅ Existing licenses remain valid
- ✅ No configuration changes needed
- ✅ Automatic upgrade on restart

---

## [2.6.12] 18 / 11 / 2025

### Fixed
- **Offline Mode Network Dependency** - Resolved critical offline mode functionality blocking issue
  - Fixed network check logic to properly respect config.mode setting when set to 'offline'
  - Resolved issue where offline mode required network connectivity despite having cached layout data
  - Fixed application redirecting to offline.html error page when network disconnected in offline mode
  - Corrected network state validation to only apply when config.mode is 'online'
  - Fixed MAC address detection failure blocking offline mode startup

### Enhanced
- **Offline Mode Resilience** - Improved offline mode reliability and error handling
  - Enhanced network check logic to bypass connectivity validation in offline mode
  - Implemented graceful MAC address error handling that allows offline mode to proceed with cached data
  - Added intelligent loading logic that uses layout-offline data from localStorage when network unavailable
  - Improved error recovery by allowing offline mode to start even with MAC detection failures

- **Offline Mode Debugging** - Comprehensive logging for offline mode troubleshooting
  - Added detailed configuration mode logging showing current mode setting (online/offline)
  - Implemented cache availability logging in getLayoutFromStorage() function
  - Enhanced switchToLayoutOffline() with structured logging separators for better visibility
  - Added layout data size reporting for cache verification and debugging
  - Implemented cache key availability reporting showing all available layout-offline entries
  - Added confirmation logging when layouts are successfully cached for offline use in looplayout.js

### Technical Improvements
- **Network Check Architecture** - Professional offline mode implementation
  - Refactored network state validation to be mode-aware with proper conditional logic
  - Separated online mode network requirements from offline mode cached data usage
  - Implemented proper error handling chain for MAC address detection in offline scenarios
  - Enhanced startup flow to prioritize cached data when operating in offline mode
  - Added comprehensive logging throughout offline mode code paths for debugging support

### Compatibility
- Maintains full backward compatibility with existing online mode functionality
- Online mode network validation remains unchanged and continues normal operation
- All existing layout caching mechanisms preserved and enhanced
- Offline mode now works as intended without network connectivity requirement

## [2.6.5] 15 / 10 / 2025

### Added
- **Multi-PC Network Synchronization Support** - Revolutionary cross-machine display synchronization
  - Added `masterServerAddress` configuration field for specifying master PC IP address
  - Added `masterServerPort` configuration field for custom synchronization port settings
  - Implemented dynamic Socket.IO client connection using configurable server addresses
  - Enhanced synchronization architecture to support distributed displays across multiple physical machines
  - Added comprehensive network setup documentation with step-by-step multi-PC configuration guides

- **Advanced Network Configuration System** - Enterprise-ready network deployment capabilities
  - Created `NETWORK-SETUP-GUIDE.md` with detailed setup instructions for various network scenarios
  - Added support for single subnet, multi-VLAN, and complex network topologies
  - Implemented firewall configuration examples for Windows and Linux systems
  - Added network connectivity testing commands and troubleshooting procedures
  - Enhanced configuration validation with network-specific error handling

- **Professional Documentation Suite** - Comprehensive guides for multi-PC deployment
  - Enhanced `SYNCHRONIZATION.md` with network architecture diagrams and topology examples
  - Added real-world deployment scenarios (office networks, corporate VLANs, dedicated display networks)
  - Created troubleshooting checklist with pre-flight checks and connectivity tests
  - Added performance tuning recommendations for high-precision and network-tolerant setups
  - Implemented configuration parameter explanations with detailed use case examples

### Enhanced
- **Configuration Migration System** - Robust version upgrade with backward compatibility
  - Implemented version 2.6.5 migration path with automatic network field addition
  - Added intelligent config upgrade system that preserves existing settings while adding new capabilities
  - Enhanced migration logging with detailed status reporting and backup creation
  - Implemented safe default values for network fields (localhost:9000) to maintain existing functionality
  - Added comprehensive error handling and rollback capabilities for failed migrations

- **Socket.IO Connection Management** - Dynamic server addressing with fallback support
  - Refactored Socket.IO client initialization to use configurable server addresses from config.json
  - Added graceful fallback to localhost when configuration is missing or invalid
  - Implemented connection error handling with automatic retry mechanisms
  - Enhanced debugging with detailed connection status logging and error reporting
  - Added support for custom ports and hostname resolution

- **Synchronization Architecture** - Scalable master-slave coordination across networks
  - Updated master broadcast system to support cross-network slave coordination
  - Enhanced slave discovery and connection management for multi-PC environments
  - Improved sync timing accuracy with network latency compensation
  - Added connection health monitoring and automatic reconnection capabilities
  - Implemented network-aware timeout and retry logic for unstable connections

### Fixed
- **Multi-PC Synchronization Limitations** - Resolved hardcoded localhost restrictions
  - Fixed Socket.IO client hardcoded to `localhost:9000` preventing cross-PC synchronization
  - Resolved network discovery issues that limited synchronization to single physical machines
  - Fixed configuration system to properly handle network addressing for distributed setups
  - Corrected slave connection logic to support master servers on different IP addresses
  - Eliminated single-point-of-failure issues in distributed display environments

- **Configuration Compatibility** - Seamless upgrade path for existing installations
  - Fixed potential config corruption during version upgrades with comprehensive backup system
  - Resolved missing configuration fields in partial or corrupted config files
  - Fixed version detection logic to properly handle configs from all previous versions
  - Corrected migration flag management to prevent duplicate or failed migrations
  - Enhanced error recovery for interrupted or failed configuration upgrades

### Technical Improvements
- **Network Infrastructure Support** - Enterprise-grade deployment capabilities
  - Version bump from 2.6.3 to 2.6.5 reflecting significant network enhancement features
  - Updated all configuration templates and examples to include new network fields
  - Enhanced version comparison logic for proper migration sequencing (v1.0.0 → v2.4.0 → v2.6.5)
  - Implemented comprehensive testing coverage for multi-PC scenarios and network configurations
  - Added support for firewall penetration and port forwarding configurations

- **Developer Experience** - Comprehensive documentation and debugging tools
  - Created detailed changelog documentation with migration impact analysis
  - Added network testing commands and connectivity verification procedures
  - Enhanced error messages with actionable troubleshooting steps and solution guidance
  - Implemented debug logging with network-specific status and error categorization
  - Added configuration validation tools and pre-deployment testing procedures

### Breaking Changes
- **None** - This release maintains full backward compatibility with existing installations

### Migration Notes
- Existing configurations are automatically upgraded to include network fields with safe defaults
- Single-PC setups continue to work without any configuration changes required
- Multi-PC capability is opt-in through configuration of `masterServerAddress` field
- All existing synchronization features remain unchanged and fully functional

## [2.6.4] 14 / 10 / 2025

### Fixed
- **Bootstrap Tooltips & JavaScript Execution** - Resolved critical JavaScript blocking issues
  - Replaced Bootstrap tooltip initialization that required Popper.js with safe jQuery-based fallback system
  - Fixed "Bootstrap tooltips require Popper.js" JavaScript errors that prevented dashboard functionality
  - Implemented graceful tooltip degradation with native browser tooltips as final fallback
  - Added comprehensive try-catch blocks to prevent single failures from breaking entire application

- **System Monitoring Functionality** - Restored full system metrics display and data processing
  - Enhanced `refreshSystemMonitoring()` function with proper error handling and data validation
  - Fixed CPU, memory, disk, and network data fetching from `/api/system/monitor` endpoint
  - Added comprehensive logging and timeout handling for system monitoring API calls
  - Implemented proper DOM element validation and error state display in monitoring UI

- **Data Usage Management** - Corrected data usage calculation and display functionality
  - Fixed `updateDataUsageDisplay()` function to match correct HTML element IDs (`dailyDownload`, `dailyUpload`, `monthlyTotal`, `totalUsage`)
  - Enhanced `/api/system/monitor` endpoint to include comprehensive data usage information with proper totals calculation
  - Restored daily, monthly, and total data usage tracking with accurate byte calculations
  - Fixed data usage reset functionality and proper metric display synchronization

- **Device Information Display** - Restored complete system information functionality
  - Enhanced `deviceinfo()` function with improved error handling and 15-second timeout settings
  - Fixed data processing for CPU, memory, system, network, display, and storage information from `/api/system/full-info` endpoint
  - Added comprehensive validation and fallback handling for missing system data
  - Implemented proper error state management with user-friendly error notifications

### Enhanced
- **JavaScript Error Resilience** - Professional error handling throughout control panel
  - Added comprehensive try-catch blocks to `initModernFeatures()` function with independent component initialization
  - Implemented safe initialization patterns that continue execution even if individual features fail
  - Enhanced logging with detailed status reporting for each initialization phase
  - Separated critical and non-critical feature initialization to prevent cascade failures

- **API Response Processing** - Improved data validation and error handling
  - Added robust JSON response validation with proper null/undefined checks
  - Enhanced error messaging with detailed debugging information for API failures
  - Implemented timeout handling and connection error recovery mechanisms
  - Added user-friendly toast notifications for system monitoring and device information errors

### Technical Improvements
- **Control Panel Stability** - Eliminated JavaScript execution blocking that prevented dashboard functionality
- **System Monitoring Reliability** - Ensured consistent data fetching and display across all system metrics
- **Error Recovery** - Implemented comprehensive fallback mechanisms for all dashboard components
- **User Experience** - Restored full functionality without JavaScript console errors or broken features

## [2.6.3] 14 / 10 / 2025

### Added
- **Professional Multi-Display Resolution System** - Comprehensive multi-display support for accurate resolution calculation
  - Advanced DisplayCalculator class with cross-platform multi-display resolution detection
  - Real-time display configuration management with automatic arrangement detection (horizontal, vertical, diagonal)
  - Combined resolution calculation for multi-display setups (e.g., 3840x1080 for dual 1920x1080 horizontal displays)
  - Professional multi-display error handling with comprehensive fallback mechanisms and circuit breaker patterns
  - Extensive test suite (MultiDisplayTester) with 8 comprehensive test categories and scenario-based validation
  - Enhanced SystemInfoManager with multi-display metadata collection and vendor/model information
  - Cross-platform compatibility with Windows (systeminformation), Linux (xrandr), and macOS (Electron screen API)

- **Enhanced Display API Endpoints** - Professional API structure for multi-display configuration
  - `/api/system/display/resolution-summary` - Quick multi-display resolution overview endpoint
  - `/api/system/display/remote-display-config` - Optimized configuration for remoteDisplayContainer
  - Enhanced `/api/system/display` endpoint with comprehensive multi-display data and arrangement information
  - Real-time Socket.IO events for display configuration changes with automatic UI synchronization
  - Professional API response structure with detailed display metadata and performance metrics

- **Real-time Display Change Detection** - Dynamic multi-display configuration management
  - Electron screen event listeners (display-added, display-removed, display-metrics-changed)
  - Intelligent event debouncing (1-second) to prevent rapid-fire display change processing
  - Automatic cache invalidation and recalculation on display configuration changes
  - Broadcast notifications to all connected control panels via Socket.IO
  - Professional display change validation and error recovery mechanisms

### Enhanced
- **Control Panel Display Management** - Professional multi-display UI integration
  - Enhanced DisplayOrientationManager with multi-display aspect ratio calculation and ultra-wide detection
  - Real-time status indicators showing combined resolution and display arrangement information
  - Automatic UI updates on display configuration changes with professional user notifications
  - Multi-display scenario support in remoteDisplayContainer with dynamic scaling and orientation
  - Socket.IO client handlers for seamless display configuration synchronization

- **System Information Architecture** - Professional display data collection and caching
  - Enhanced display information collection with comprehensive metadata (vendor, model, connection type)
  - Performance-optimized caching system with configurable TTL (5-second default) and LRU management
  - Integration with DisplayCalculator for accurate multi-display workspace calculation
  - Professional error handling with graceful degradation to single-display mode
  - Cross-platform systeminformation library integration with platform-specific optimizations

- **Remote Display Serving** - Multi-display aware remote viewing capabilities
  - Enhanced `/remote` endpoint with automatic multi-display configuration injection
  - Intelligent scaling and orientation detection for multi-display remote viewing scenarios
  - Multi-display awareness in VNC/remote viewing with proper aspect ratio handling
  - Professional remote display configuration with combined resolution support

### Technical Improvements
- **Code Architecture** - Professional multi-display system implementation
  - Modular DisplayCalculator class with comprehensive resolution calculation algorithms
  - MultiDisplayErrorHandler with circuit breaker patterns, retry logic, and graceful degradation
  - Professional caching system with memory management and automatic expiration
  - Comprehensive logging and debugging capabilities for multi-display troubleshooting
  - Clean separation of concerns with maintainable, testable code structure

- **Performance Optimizations** - Efficient multi-display processing
  - Intelligent caching with 5-second TTL to minimize expensive display detection calls
  - Event debouncing to prevent performance degradation from rapid display changes
  - Lazy loading of display configuration data with on-demand calculation
  - Memory-efficient LRU cache implementation with configurable size limits
  - Platform-specific optimizations for Windows, Linux, and macOS display detection

- **Error Handling & Reliability** - Robust multi-display operation
  - Comprehensive fallback chain: DisplayCalculator → systeminformation → Electron screen API → safe defaults
  - Automatic retry mechanisms with exponential backoff for transient failures
  - Circuit breaker patterns for repeated failure scenarios with automatic recovery
  - User-friendly error notifications with clear guidance for display configuration issues
  - Professional logging system with detailed error reporting and performance metrics

## [2.5.11] 11 / 10 / 2025

### Added
- **Comprehensive API Documentation System** - Professional API reference for eCLESS Player Control Panel
  - Complete documentation coverage for all available REST API endpoints
  - Organized API categories: Layout Control, Content Management, System Control, Volume Control, Display Control, Application Control
  - New documented endpoints: `/api/shutdown`, `/api/reboot`, `/api/restartapp`, `/api/volume/*`, `/api/display/screen/*`, `/api/refresh`, `/api/screenshot`
  - Professional dark theme styling consistent with eCLESS Player interface
  - Copy-to-clipboard functionality for all API examples
  - Clear, concise descriptions without technical jargon
  - Single practical example per endpoint for improved usability

### Enhanced
- **API Documentation Interface**
  - Simplified user experience by removing complex URL Builder tool
  - Streamlined from multiple examples to single clear example per endpoint
  - Improved organization with logical API grouping and visual hierarchy
  - Enhanced readability with professional styling and consistent formatting
  - Better developer experience with comprehensive endpoint coverage

### Removed
- **URL Builder Tool** - Simplified interface by removing complex parameter configuration tool
  - Replaced with direct copy-paste examples for better user experience
  - Maintained all functionality through simplified approach
  - Improved documentation clarity and reduced complexity

### Technical Improvements
- **Code Organization**
  - Updated `src/cpanel.html` with comprehensive API documentation structure
  - Simplified JavaScript functions in `src/assets/js/cpanel/cpanel-enhanced.js`
  - Maintained backward compatibility for all existing API functionality
  - Professional error handling and user feedback for simplified interface

## [2.5.10] 11 / 10 / 2025

### Added
- **Configuration Auto-Relaunch System** - Automatic application restart after configuration save
  - Smart restart validation that only triggers when configuration changes require it
  - Critical change detection for server URL, DS ID, and serial key modifications
  - User confirmation dialogs with clear explanations for restart necessity
  - Professional restart overlay with visual feedback during application restart
  - Comprehensive error handling with fallback mechanisms and manual restart instructions

### Fixed
- **Application Restart Issue** - Fixed app.relaunch() and app.exit() execution order
  - Corrected IPC handler to call app.relaunch() before app.exit() for proper restart
  - Enhanced restart endpoint debugging and error reporting
  - Improved socket connection verification before restart operations

### Enhanced
- **Configuration Management**
  - Intelligent restart decision logic based on configuration field changes
  - Configuration change tracking and comparison system
  - Enhanced user experience with cancellable countdown timers
  - Professional error recovery with detailed user guidance
  - Improved debugging and logging for configuration operations

## [2.5.9] 11 / 10 / 2025

### Added
- **Enhanced Slot Extraction System** - Professional slot management system supporting all 9 slot types
  - Comprehensive slot type support: media, text, ticker, scroller, fader, date, time, html, table
  - Individual extraction functions for each slot type with specialized content handling
  - Enhanced slot data structure with detailed metadata and content information
  - Professional socket.io handlers for all slot types with consistent API patterns
  - Robust error handling and validation for all slot extraction operations
  - Backward compatibility maintained for existing text and media slot functionality

- **Advanced Layout Management Interface** - Professional dark theme for layout components
  - Dark theme implementation for all layout-related interface components
  - Consistent dark color scheme using CSS custom properties (--dark-color: #1e293b)
  - Enhanced visual hierarchy with proper contrast ratios for accessibility
  - Professional styling for layout information panel, status headers, and navigation
  - Responsive design patterns maintaining usability across different screen sizes
  - Cohesive theming system supporting future interface enhancements

### Enhanced
- **Slot Extraction Architecture**
  - `extractAllSlotsFromLayoutData()` - Enhanced to support all 9 slot types with comprehensive detection
  - `extractComprehensiveSlotData()` - Advanced slot analysis with detailed metadata extraction
  - Specialized extraction functions: `extractTickerSlotsFromLayoutData()`, `extractScrollerSlotsFromLayoutData()`, etc.
  - Socket handlers: 'req-ticker-slot', 'req-scroller-slot', 'req-fader-slot', 'req-date-slot', etc.
  - Professional error handling with graceful fallbacks for malformed slot data

- **Control Panel Interface**
  - Layout information panel with professional dark theme styling
  - Enhanced current layout display with improved readability
  - Professional layout status headers with consistent visual hierarchy
  - Dark-themed layout summary components with proper contrast
  - Cohesive styling across all layout management components

### Technical Improvements
- **Code Architecture**
  - Modular slot extraction system with type-specific handlers
  - Consistent API patterns across all slot type operations
  - Professional error handling and logging throughout slot management
  - Maintainable code structure supporting future slot type additions
  - Comprehensive documentation and code comments for development clarity

## [2.4.5] 24 / 09 / 2025

### Added
- **Multi-Screen Synchronization System** - Revolutionary synchronized layout and video playback across multiple screens
  - Master-slave architecture for coordinated screen control
  - Real-time layout synchronization with sub-second precision
  - VideoJS player synchronization with configurable drift correction
  - Network resilience with graceful fallback to local timing
  - Comprehensive sync configuration options in config.json
  - Socket.IO based broadcasting for layout and video sync data
  - Automatic drift correction and smooth video adjustments
  - Network connectivity monitoring with intelligent fallback
  - Detailed synchronization documentation and troubleshooting guide

- **Automatic Configuration Migration System** - Seamless upgrade path for all users
  - Version-aware configuration upgrade system (v2.4.0)
  - Automatic detection and upgrade of existing config.json files
  - Smart migration from legacy config.js to enhanced config.json
  - Safe upgrade process with automatic timestamped backups
  - Version comparison utility for semantic versioning
  - Future-proof upgrade framework for easy feature additions
  - Graceful fallback configurations for immediate functionality
  - Professional upgrade notifications and user guidanceable changes to the eCLESS Player project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.1] 24 / 09 / 2025

### Added
- **Multi-Screen Synchronization System** - Revolutionary synchronized layout and video playback across multiple screens
  - Master-slave architecture for coordinated screen control
  - Real-time layout synchronization with sub-second precision
  - VideoJS player synchronization with configurable drift correction
  - Network resilience with graceful fallback to local timing
  - Comprehensive sync configuration options in config.json
  - Socket.IO based broadcasting for layout and video sync data
  - Automatic drift correction and smooth video adjustments
  - Network connectivity monitoring with intelligent fallback
  - Detailed synchronization documentation and troubleshooting guide

### Enhanced
- **Configuration System**
  - Added `syncSettings` section to config.json with comprehensive sync options
  - Master/slave configuration with intelligent defaults
  - Configurable sync intervals, thresholds, and network timeout settings
  - Version-based configuration upgrade system
  - Automatic migration from config.js to config.json format
  - Safe upgrade process preserving all existing settings
  - Timestamped backup creation during all migrations
  - Support for incremental version upgrades (e.g., v2.0.14 → v2.4.0)

- **Socket.IO Event System**
  - New sync event handlers: `layout-sync-broadcast`, `layout-sync-receive`, `video-sync`
  - Master broadcasting functions for real-time coordination
  - Slave receiving functions with intelligent sync correction
  - Network disconnection handling with graceful degradation

- **Layout Management**
  - Modified `looplayout.js` for synchronized layout transitions
  - Enhanced `playcurrentLayout()` with sync broadcasting
  - Preserved existing pause/resume timeout functionality
  - Backward compatibility with offline/online modes

- **Video System**
  - Extended VideoJS players with synchronization capabilities
  - Real-time playback position coordination
  - Play/pause state synchronization across screens
  - Configurable sync threshold for optimal performance
  - Automatic drift detection and correction

### Technical Improvements
- Comprehensive error handling and logging throughout sync system
- Professional debugging output with categorized log messages
- Robust network connectivity monitoring and intelligent recovery
- Intelligent fallback mechanisms for network interruptions
- Performance optimizations for real-time synchronization
- Version comparison utility for semantic versioning support
- Automatic backup system with timestamped file creation
- Configuration validation and corruption recovery mechanisms
- Memory leak prevention during network state changes
- Graceful degradation when sync features are unavailable

### Documentation
- Created comprehensive `docs/SYNCHRONIZATION.md` implementation guide
- Configuration examples for master and slave setups
- Troubleshooting guide with common issues and solutions
- Performance tuning recommendations
- Monitoring and maintenance guidelines

### Migration & Upgrade System
- **Seamless Version Upgrades**: Automatic detection and upgrade of configuration versions
- **Safe Migration Process**: Every upgrade creates timestamped backups before making changes
- **Multi-Path Support**: Handles both config.js → config.json and config.json version upgrades
- **User Communication**: Professional upgrade notifications explaining new features
- **Rollback Support**: Easy rollback using automatic backup files
- **Future-Proof Framework**: Extensible system for future version migrations
- **Zero Downtime**: Configuration upgrades happen without service interruption
- **Validation & Recovery**: Corruption detection and recovery mechanisms

### Compatibility
- Maintains full backward compatibility with existing functionality
- Works with current Electron app structure and VideoJS implementation
- Uses existing Socket.IO connection infrastructure
- Graceful degradation when sync features are disabled
- Automatic configuration migration preserves all existing settings
- Zero breaking changes for existing installations
- Safe upgrade path from any previous version to v2.4.0
- Support for mixed version environments during gradual rollout

## [2.3.5] - Previous Release
- Enhanced control panel features
- Real-time system monitoring
- Display control and power management
- Comprehensive device information
- Configuration management improvements

## [2.3.1] - Previous Release
- Bug fixes and stability improvements
- Enhanced API endpoints
- Improved error handling

## [2.2.1] - Previous Release
- Initial enhanced control panel features
- Socket.IO integration
- VNC server integration
- Multi-platform support

---

For detailed information about the synchronization system, see [SYNCHRONIZATION.md](docs/SYNCHRONIZATION.md).
For API documentation, see [CONTROL_PANEL_API.md](docs/CONTROL_PANEL_API.md).