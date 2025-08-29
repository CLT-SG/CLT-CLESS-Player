# eCLESS Player - Enhanced Digital Signage Solution

eCLESS Player is a powerful digital signage application built with ElectronJS, designed to provide comprehensive content management and system monitoring capabilities. This enhanced version includes advanced control panel features, real-time system monitoring, and remote management capabilities.

## Features

### Core Features
- Cross-platform support for Windows, Linux, and macOS
- Digital signage content management
- Real-time layout and media control
- Remote VNC access for system management
- ElectronJS-based desktop application

### Enhanced Control Panel Features ✨
- **Real-time System Monitoring**: CPU, memory, disk, and network usage
- **Display Control**: Brightness adjustment and power management
- **System Configuration**: Auto-startup, fullscreen mode, and timeout settings
- **Comprehensive Device Information**: Hardware details, network interfaces, and display information
- **Configuration Management**: Save/load system configurations
- **Advanced Notifications**: Real-time alerts and status updates
- **Multi-monitor Support**: Display information for multiple screens

### API Enhancements
- RESTful API for system control and monitoring
- Socket.IO for real-time communication
- Configuration management endpoints
- Display control APIs
- Comprehensive system information endpoints

## Requirements
- [Node.js](https://nodejs.org/) (v16.x or later)
- [Electron](https://www.electronjs.org/) (v22.x)
- VNC server (x11vnc) for remote display access
- Modern web browser for control panel access

## Installation

### Quick Setup

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

See [CONTROL_PANEL_API.md](CONTROL_PANEL_API.md) for complete API documentation.

## Building the Application

To build the application and compile it into an executable for different platforms, use the following commands.

### For Windows:
- **Windows x64:**
   ```bash
   npm run win64
   ```

- **Windows x86:**
   ```bash
   npm run win32
   ```

### For Ubuntu:
- **Ubuntu x64:**
   ```bash
   npm run ubuntu64
   ```

- **Ubuntu x86:**
   ```bash
   npm run ubuntu32
   ```

## Contributing
Contributions are welcome! If you find any issues or have suggestions for improvements, feel free to create a pull request or open an issue in this repository.

## License
This project is licensed under the [MIT License](LICENSE).

## Contact
For any inquiries, reach out to us at www.closed-loop.biz
