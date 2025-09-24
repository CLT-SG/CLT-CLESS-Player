# Changelog

All notable changes to the eCLESS Player project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  - Added `syncSettings` section to config.json
  - Master/slave configuration options
  - Configurable sync intervals and thresholds
  - Network timeout and resilience settings

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
- Robust network connectivity monitoring
- Intelligent fallback mechanisms for network interruptions
- Performance optimizations for real-time synchronization

### Documentation
- Created comprehensive `docs/SYNCHRONIZATION.md` implementation guide
- Configuration examples for master and slave setups
- Troubleshooting guide with common issues and solutions
- Performance tuning recommendations
- Monitoring and maintenance guidelines

### Compatibility
- Maintains full backward compatibility with existing functionality
- Works with current Electron app structure and VideoJS implementation
- Uses existing Socket.IO connection infrastructure
- Graceful degradation when sync features are disabled

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