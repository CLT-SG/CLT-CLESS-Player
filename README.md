# eCLESS Player - Enhanced Digital Signage Solution

eCLESS Player is a powerful digital signage application built with ElectronJS, designed to provide comprehensive content management and system monitoring capabilities. This enhanced version includes advanced control panel features, real-time system monitoring, and remote management capabilities.

## Features

### Core Features
- Cross-platform support for Windows, Linux, macOS, **Android, and iOS**
- Digital signage content management
- Real-time layout and media control
- Remote VNC access for system management
- ElectronJS-based desktop application
- **Native mobile apps** for Android and iOS devices

### Multi-Screen Synchronization System
- **Master-Slave Architecture**: Coordinate multiple screens with one controlling timing
- **Real-time Layout Sync**: All screens show identical layouts at the same timestamp
- **Video Synchronization**: Synchronized video playback across screens with drift correction
- **Network Resilient**: Graceful fallback to local timing during connectivity issues
- **Sub-second Precision**: Professional-grade synchronization accuracy
- **Easy Configuration**: Simple setup via config.json settings
- **Backward Compatible**: Works seamlessly with existing offline/online modes

### Enhanced Control Panel Features
- **Real-time System Monitoring**: CPU, memory, disk, and network usage
- **Display Control**: Brightness adjustment and power management
- **System Configuration**: Auto-startup, fullscreen mode, and timeout settings
- **Comprehensive Device Information**: Hardware details, network interfaces, and display information
- **Configuration Management**: Save/load system configurations
- **Advanced Notifications**: Real-time alerts and status updates
- **Multi-monitor Support**: Display information for multiple screens

### API Enhancements
- RESTful API for system control and monitoring
- Socket.IO for real-time communication and multi-screen synchronization
- Configuration management endpoints
- Display control APIs
- Comprehensive system information endpoints
- Synchronization broadcasting and event handling

## Requirements
- [Node.js](https://nodejs.org/) (v16.x or later)
- [Electron](https://www.electronjs.org/) (v22.x)
- VNC server (x11vnc) for remote display access
- Modern web browser for control panel access

## Installation

### Desktop Application (Windows, Linux, macOS)

1. Install Electron globally:
   ```bash
   npm install -g electron
   ```

2. Install project dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

### Mobile Applications (Android, iOS)

Build native mobile apps from the same codebase:

```bash
cd mobile
npm install
npm run build           # Build web assets
npm run add:android     # Add Android platform (first time)
npm run build:android   # Build and open Android Studio
```

See [mobile/README.md](./mobile/README.md) for complete mobile setup guide.

**Mobile App Features:**
- Full control panel dashboard on mobile devices
- Touch-optimized interface for smartphones and tablets
- Real-time system monitoring and remote control
- Configuration and activation pages
- Native Android and iOS apps via Capacitor

## Multi-Screen Synchronization

eCLESS Player supports synchronized content playback across multiple screens using a master-slave architecture.

### Quick Setup

1. **Configure Master Screen:**
   ```json
   {
     "syncSettings": {
       "syncMode": "enabled",
       "isMaster": true,
       "layoutSyncEnabled": true,
       "videoSyncEnabled": true
     }
   }
   ```

2. **Configure Slave Screens:**
   ```json
   {
     "syncSettings": {
       "syncMode": "enabled",
       "isMaster": false,
       "syncInterval": 5000,
       "videoSyncThreshold": 0.5
     }
   }
   ```

3. **Start Applications:**
   - All screens will automatically synchronize via Socket.IO
   - Layout transitions happen simultaneously
   - Video content stays synchronized across screens

### Features
- **Real-time Sync**: Sub-second precision layout and video synchronization
- **Network Resilient**: Graceful fallback during connectivity issues  
- **Configurable**: Fine-tune sync behavior per deployment
- **Professional Grade**: Suitable for large-scale digital signage installations

For detailed configuration and troubleshooting, see [SYNCHRONIZATION.md](docs/SYNCHRONIZATION.md).

## Usage

### Accessing the Control Panel

1. Start the eCLESS Player application
2. Open a web browser and navigate to: `https://localhost:9000`
3. Use the enhanced control panel to:
   - Monitor system performance in real-time
   - Control display settings (display, content)
   - Manage content layouts and media
   - Configure system settings
   - Access remote desktop via VNC

### Control Panel Sections

#### Remote Control
- Refresh display content
- Restart application
- System reboot/shutdown
- VNC remote desktop access (885x500px window)

#### Display Control
- Real-time brightness adjustment (0-100%)
- Display power on/off control
- Multi-monitor display information

#### System Configuration
- Auto-startup on boot settings
- Fullscreen mode toggle
- Screen timeout configuration
- Update interval settings
- Log level selection
- Save/load configuration profiles

#### System Monitoring
- Real-time CPU usage with progress bars
- Memory usage tracking
- Disk usage visualization
- Network activity monitoring
- Auto-refreshing data every 30 seconds

#### Enhanced Device Information
- Comprehensive CPU details
- Memory and swap information
- System manufacturer and model
- Operating system details
- Network interface status
- Display resolution and position
- Storage usage with visual indicators

### API Usage

The enhanced control panel provides a comprehensive REST API:

```bash
# Get comprehensive system information
curl https://localhost:9000/api/system/full-info

# Set display brightness
curl https://localhost:9000/api/display/brightness/75

# Get real-time monitoring data
curl https://localhost:9000/api/system/monitor

# Save configuration
curl -X POST https://localhost:9000/api/config/save \
     -H "Content-Type: application/json" \
     -d '{"autoStartup": true, "brightness": 75}'
```

See [CONTROL_PANEL_API.md](docs/CONTROL_PANEL_API.md) for complete API documentation.
See [SYNCHRONIZATION.md](docs/SYNCHRONIZATION.md) for multi-screen sync setup and configuration.
See [MOBILE-APP.md](docs/MOBILE-APP.md) for mobile app development and deployment.
See [WIDGET-SLOTS.md](docs/WIDGET-SLOTS.md) for rendering server widgets in layout widget slots.
See [AUTO-UPDATE.md](docs/AUTO-UPDATE.md) for GitHub Releases auto-update and how to publish a new Player release.

## Building the Application

### Desktop Application Builds

To build the desktop application and compile it into an executable for different platforms, use the following commands.

**For Windows:**
- **Windows x64:**
   ```bash
   npm run win64
   ```

- **Windows x86:**
   ```bash
   npm run win32
   ```

**For Ubuntu:**
- **Ubuntu x64:**
   ```bash
   npm run ubuntu64
   ```

- **Ubuntu x86:**
   ```bash
   npm run ubuntu32
   ```

### Mobile Application Builds

Build native mobile apps for Android and iOS:

```bash
cd mobile
npm install
npm run build

# Android
npm run add:android      # First time only
npm run build:android    # Opens Android Studio

# iOS (macOS only)
npm run add:ios          # First time only
npm run build:ios        # Opens Xcode
```

**Release Builds:**
- **Android APK**: `cd mobile/android && ./gradlew assembleRelease`
- **Android AAB**: `cd mobile/android && ./gradlew bundleRelease`
- **iOS**: Use Xcode Archive and submit to App Store

See [mobile/README.md](./mobile/README.md) for detailed build instructions.

## Contributing
Contributions are welcome! If you find any issues or have suggestions for improvements, feel free to create a pull request or open an issue in this repository.

## License
This project is licensed under the [MIT License](LICENSE).

## Contact
For any inquiries, reach out to us at www.closed-loop.biz
