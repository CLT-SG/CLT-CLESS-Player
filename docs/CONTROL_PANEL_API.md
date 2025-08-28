# eCLESS Player Control Panel API Enhancement

## Overview
This document describes the enhanced API endpoints and features added to the eCLESS Player Control Panel for improved system monitoring, audio-based screen control, volume management, and configuration management.

## New API Endpoints

### System Information

#### GET /api/system/full-info
Returns comprehensive system information including CPU, memory, disk, network, display, and system details.

**Response:**
```json
{
  "cpu": { /* CPU information */ },
  "memory": { /* Memory information */ },
  "disk": [ /* Array of disk information */ ],
  "network": [ /* Array of network interfaces */ ],
  "display": { /* Display information */ },
  "system": { /* System information */ },
  "timestamp": "2025-07-31T10:30:45.123Z"
}
```

#### GET /api/system/memory
Returns detailed memory information.

#### GET /api/system/disk
Returns disk/storage information.

#### GET /api/system/network
Returns network interfaces information.

#### GET /api/system/display
Returns display/graphics information.

#### GET /api/system/monitor
Returns real-time system monitoring data including CPU load, memory usage, disk usage, and network statistics.

**Response:**
```json
{
  "cpu": {
    "load": 45.2,
    "loadUser": 25.1,
    "loadSystem": 20.1
  },
  "memory": {
    "total": 8589934592,
    "free": 2147483648,
    "used": 6442450944,
    "usage": "75.00"
  },
  "disk": [...],
  "network": [...],
  "timestamp": "2025-07-31T10:30:45.123Z"
}
```

### Audio-Based Screen Control

#### GET /api/display/screen/:state
Controls screen on/off toggle with audio muting and black screen overlay.

**Parameters:**
- `state`: "on" or "off"

**Response:**
```json
{
  "success": true,
  "screen": "off"
}
```

**Behavior:**
- **Screen OFF**: Mutes system audio and displays full-screen black overlay
- **Screen ON**: Unmutes system audio and removes black overlay
- Cross-platform audio control (Linux: amixer/PulseAudio, Windows: win-audio/PowerShell, macOS: osascript)

### Volume Control

#### GET /api/volume/mute
Mutes system audio.

**Response:**
```json
{
  "success": true,
  "action": "mute"
}
```

#### GET /api/volume/unmute
Unmutes system audio.

**Response:**
```json
{
  "success": true,
  "action": "unmute"
}
```

#### POST /api/volume/set
Sets system volume level.

**Request Body:**
```json
{
  "volume": 75
}
```

**Response:**
```json
{
  "success": true,
  "volume": 75
}
```

#### GET /api/volume/get
Requests current volume level (response sent via Socket.IO).

**Response:**
```json
{
  "success": true,
  "message": "Volume request sent"
}
```

### Configuration Management

#### POST /api/config/save
Saves system configuration.

**Request Body:**
```json
{
  "autoStartup": true,
  "fullscreenMode": true,
  "screenTimeout": 30,
  "updateInterval": 30,
  "logLevel": "info",
  "screenOnOff": true,
  "timestamp": "2025-07-31T10:30:45.123Z"
}
```

#### GET /api/config/load
Loads saved system configuration.

**Response:**
```json
{
  "autoStartup": true,
  "fullscreenMode": true,
  "screenTimeout": 30,
  "updateInterval": 30,
  "logLevel": "info",
  "screenOnOff": true,
  "timestamp": "2025-07-31T10:30:45.123Z"
}
```

## Enhanced UI Features

### System Monitoring Dashboard
- Real-time CPU usage monitoring with progress bars
- Memory usage tracking with detailed breakdown
- Disk usage visualization
- Network activity monitoring
- Auto-refreshing data every 30 seconds

### Audio-Based Screen Control Panel
- Screen on/off toggle with audio muting and black screen overlay
- Visual feedback with button state management
- One-time click protection to prevent multiple simultaneous requests
- Cross-platform audio control support

### Volume Control Panel
- Mute/Unmute buttons with visual state indicators
- Volume slider with real-time adjustment (0-100%)
- Current volume display with percentage feedback
- Debounced slider input to prevent API spam
- Auto-detection of current volume level on page load

### System Configuration Panel
- Auto-startup configuration
- Fullscreen mode toggle
- Screen timeout settings
- Update interval configuration
- Log level selection
- Configuration save/load functionality

### Enhanced Device Information
- Comprehensive CPU details (manufacturer, brand, speed, cores, family, model)
- Detailed memory information (total, free, used, available, swap)
- System information (manufacturer, model, OS details, platform, architecture)
- Network interfaces with status indicators
- Display information table with resolution and position data
- Storage information with usage visualization

## Socket.IO Events

### Screen Control Events

#### set-screen-toggle
Controls screen on/off toggle with audio muting and black screen overlay.
```javascript
socket.emit('set-screen-toggle', { state: 'off' })
```

### Volume Control Events

#### set-volume-mute
Controls system audio muting.
```javascript
socket.emit('set-volume-mute', { action: 'mute' })
socket.emit('set-volume-mute', { action: 'unmute' })
```

#### set-volume-level
Sets system volume level.
```javascript
socket.emit('set-volume-level', { volume: 75 })
```

#### get-volume-level
Requests current volume level.
```javascript
socket.emit('get-volume-level', { requestId: Date.now() })
```

#### volume-level-response
Response event with current volume level.
```javascript
socket.on('volume-level-response', function(data) {
  console.log('Current volume:', data.volume + '%')
})
```

### Configuration Events

#### update-config
Updates system configuration.
```javascript
socket.emit('update-config', configObject)
```

## CSS Enhancements

### New Classes
- `.card`, `.card-header`, `.card-body`: Bootstrap-style cards for information display
- `.progress`, `.progress-bar`: Progress bars for usage visualization
- `.network-interface`: Styling for network interface cards
- `.status-indicator`, `.status-online`, `.status-offline`: Status indicators
- `.metric-value`: Styling for important metric values
- `.alert`, `.alert-success`, `.alert-danger`: Alert messages

## JavaScript Enhancements

## JavaScript Enhancements

### Audio-Based Screen Control Functions
- `setScreenToggle(state)`: Controls screen on/off toggle with audio muting and black screen overlay
- `handleScreenToggle(state)`: Main process handler for screen toggle functionality
- `muteSystem()`: Cross-platform system audio muting
- `unmuteSystem()`: Cross-platform system audio unmuting
- `createBlackScreenWindow()`: Creates full-screen black overlay window
- `closeBlackScreenWindow()`: Removes black screen overlay

### Volume Control Functions
- `setVolumeMute()`: Mutes system audio with UI feedback
- `setVolumeUnmute()`: Unmutes system audio with UI feedback
- `setVolumeLevel(volume)`: Sets system volume level (0-100)
- `getCurrentVolumeLevel()`: Requests current volume level
- `setSystemVolume(volumePercent)`: Main process volume control function
- `getCurrentVolume()`: Cross-platform volume detection

### System Monitoring Functions
- `startSystemMonitoring()`: Initializes real-time monitoring
- `refreshSystemMonitoring()`: Updates monitoring data
- `displayNetworkInterfaces()`: Renders network interface information
- `displayDisplayInfo()`: Renders display information
- `displayDiskInfo()`: Renders disk usage information

### Configuration Management Functions
- `saveConfiguration()`: Saves current configuration
- `loadConfiguration()`: Loads saved configuration

### Utility Functions
- `formatBytes(bytes)`: Formats byte values to human-readable format
- `showAlert(type, message)`: Shows user notifications

## Cross-Platform Audio Support

### Windows Audio Control
- **Primary Method**: win-audio package for native system audio control
- **Fallback Methods**: 
  - PowerShell `Set-AudioDevice` commands
  - SendKeys method for mute key simulation
- **Volume Management**: Direct volume level control with preservation
- **Installation**: win-audio package installed as optional dependency

### Linux Audio Control
- **Primary Method**: amixer commands for ALSA audio control
- **Fallback Method**: PulseAudio pactl commands
- **Volume Management**: Percentage-based volume control
- **Compatibility**: Works with most Linux distributions

### macOS Audio Control
- **Method**: osascript AppleScript commands
- **Volume Management**: Native macOS volume control
- **Compatibility**: macOS 10.10+ supported

## Usage Examples

### Setting Screen Toggle via API
```bash
# Turn screen off (mute audio + black overlay)
curl -X GET "http://localhost:9000/api/display/screen/off"

# Turn screen on (unmute audio + remove overlay)
curl -X GET "http://localhost:9000/api/display/screen/on"
```

### Volume Control via API
```bash
# Mute system audio
curl -X GET "http://localhost:9000/api/volume/mute"

# Unmute system audio
curl -X GET "http://localhost:9000/api/volume/unmute"

# Set volume to 75%
curl -X POST "http://localhost:9000/api/volume/set" \
  -H "Content-Type: application/json" \
  -d '{"volume": 75}'

# Get current volume level
curl -X GET "http://localhost:9000/api/volume/get"
```

### Getting System Monitoring Data
```bash
curl -X GET "http://localhost:9000/api/system/monitor"
```

### Saving Configuration
```bash
curl -X POST "http://localhost:9000/api/config/save" \
  -H "Content-Type: application/json" \
  -d '{"autoStartup": true, "screenOnOff": true}'
```

## Installation and Setup

1. The enhanced control panel uses the existing dependencies plus optional win-audio package
2. Install dependencies: `npm install` (win-audio will be installed on Windows automatically)
3. Replace the cpanel.html with the enhanced version including volume controls
4. Update cpanel.js with the new API endpoints for volume control
5. Include the enhanced cpanel-enhanced.js file with volume control functions
6. Update index.js with cross-platform audio control functions
7. Restart the application

### Dependencies
- **Required**: All existing dependencies
- **Optional**: win-audio package (Windows only, installed automatically)
- **Cross-platform**: Works on Windows, Linux, and macOS

## Browser Compatibility
- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## Security Considerations
- All API endpoints require access to the local network (port 9000)
- Configuration data is stored locally in JSON format
- Audio and screen control commands are sent via Socket.IO for real-time response
- Volume control commands require system-level audio permissions
- Cross-platform audio commands use appropriate system APIs

## Future Enhancements
- Remote desktop control integration
- Scheduled task management
- Log file viewer
- Performance graphs and historical data
- Mobile-responsive design
- Multi-language support
- Audio device selection
- Volume level presets
- Audio equalizer controls
- Multiple monitor support for screen control

## Changelog

### Version 2.2.1 - Audio-Based Screen Control
- **BREAKING CHANGE**: Removed traditional display power controls
- Added audio-based screen toggle with black screen overlay
- Implemented cross-platform audio control (Windows/Linux/macOS)
- Added win-audio package support for Windows
- Added comprehensive volume control functionality
- Enhanced button state management with one-time click protection
- Improved error handling and fallback methods
- Added real-time volume level detection and control
