# Change Log

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