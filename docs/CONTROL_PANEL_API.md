# eCLESS Player Control Panel API Enhancement

## Overview
This document describes the enhanced API endpoints and features added to the eCLESS Player Control Panel for improved system monitoring, display control, and configuration management.

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

### Display Control

#### GET /api/display/brightness/:level
Sets the display brightness level (0-100).

**Parameters:**
- `level`: Integer between 0 and 100

**Response:**
```json
{
  "success": true,
  "brightness": 75
}
```

#### GET /api/display/power/:state
Controls display power state.

**Parameters:**
- `state`: "on" or "off"

**Response:**
```json
{
  "success": true,
  "power": "on"
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
  "brightness": 75,
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
  "brightness": 75,
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

### Display Control Panel
- Brightness slider with real-time adjustment
- Display power on/off controls
- Display information showing resolution, position, and connection type
- Support for multiple monitors

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

### New Events

#### set-brightness
Controls display brightness.
```javascript
socket.emit('set-brightness', { level: 75 })
```

#### set-display-power
Controls display power state.
```javascript
socket.emit('set-display-power', { state: 'on' })
```

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

### New Functions

#### System Monitoring
- `startSystemMonitoring()`: Initializes real-time monitoring
- `refreshSystemMonitoring()`: Updates monitoring data
- `displayNetworkInterfaces()`: Renders network interface information
- `displayDisplayInfo()`: Renders display information
- `displayDiskInfo()`: Renders disk usage information

#### Display Control
- `setBrightness(level)`: Sets display brightness
- `setDisplayPower(state)`: Controls display power

#### Configuration Management
- `saveConfiguration()`: Saves current configuration
- `loadConfiguration()`: Loads saved configuration

#### Utility Functions
- `formatBytes(bytes)`: Formats byte values to human-readable format
- `showAlert(type, message)`: Shows user notifications

## Usage Examples

### Setting Display Brightness via API
```bash
curl -X GET "http://localhost:9000/api/display/brightness/75"
```

### Getting System Monitoring Data
```bash
curl -X GET "http://localhost:9000/api/system/monitor"
```

### Saving Configuration
```bash
curl -X POST "http://localhost:9000/api/config/save" \
  -H "Content-Type: application/json" \
  -d '{"autoStartup": true, "brightness": 75}'
```

## Installation and Setup

1. The enhanced control panel uses the existing dependencies
2. Replace the cpanel.html with the enhanced version
3. Update cpanel.js with the new API endpoints
4. Include the cpanel-enhanced.js file
5. Restart the application

## Browser Compatibility
- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## Security Considerations
- All API endpoints require access to the local network (port 9000)
- Configuration data is stored locally in JSON format
- Display control commands are sent via Socket.IO for real-time response

## Future Enhancements
- Remote desktop control integration
- Scheduled task management
- Log file viewer
- Performance graphs and historical data
- Mobile-responsive design
- Multi-language support
