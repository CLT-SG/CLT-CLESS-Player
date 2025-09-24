# CLT-CLESS-Player Synchronization System

## Overview

The CLT-CLESS-Player now supports synchronized layout and video playbook across multiple screens using a master-slave architecture. This feature ensures all screens display the same content at the same timestamp, with layout transitions happening simultaneously.

## Features

- **Master-Slave Architecture**: One screen controls timing, others follow
- **Layout Synchronization**: Synchronized layout transitions and timing
- **Video Synchronization**: Synchronized video playback position and play/pause states  
- **Network Resilience**: Graceful fallback to local timing during network issues
- **Real-time Sync**: Sub-second precision synchronization
- **Configurable**: Fine-tune sync behavior through configuration

## Configuration

### Basic Setup

Add the following `syncSettings` section to your `config.json`:

```json
{
  "syncSettings": {
    "syncMode": "enabled",
    "isMaster": false,
    "syncInterval": 5000,
    "videoSyncThreshold": 0.5,
    "layoutSyncEnabled": true,
    "videoSyncEnabled": true,
    "masterBroadcastInterval": 1000,
    "networkTimeout": 10000
  }
}
```

### Configuration Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `syncMode` | string | "disabled" | Enable/disable synchronization ("enabled" or "disabled") |
| `isMaster` | boolean | false | Set to true for master screen, false for slaves |
| `syncInterval` | number | 5000 | Slave sync check interval in milliseconds |
| `videoSyncThreshold` | number | 0.5 | Video time difference threshold for sync correction (seconds) |
| `layoutSyncEnabled` | boolean | true | Enable layout synchronization |
| `videoSyncEnabled` | boolean | true | Enable video synchronization |
| `masterBroadcastInterval` | number | 1000 | Master broadcast interval in milliseconds |
| `networkTimeout` | number | 10000 | Network timeout before fallback to local timing (milliseconds) |

### Example Configurations

#### Master Screen Configuration
```json
{
  "syncSettings": {
    "syncMode": "enabled",
    "isMaster": true,
    "layoutSyncEnabled": true,
    "videoSyncEnabled": true,
    "masterBroadcastInterval": 1000
  }
}
```

#### Slave Screen Configuration
```json
{
  "syncSettings": {
    "syncMode": "enabled",
    "isMaster": false,
    "syncInterval": 5000,
    "videoSyncThreshold": 0.3,
    "networkTimeout": 15000
  }
}
```

## How It Works

### Master Screen Behavior

1. **Broadcasts layout sync data** every second containing:
   - Current layout ID and index
   - Timestamp and remaining time
   - Loop status and total layouts

2. **Broadcasts video sync data** every second containing:
   - Current playback time for all videos
   - Play/pause state
   - Playback rate and duration

3. **Controls timing** for all layout transitions

### Slave Screen Behavior

1. **Receives sync data** from master via Socket.IO events
2. **Adjusts layout timing** to match master schedule
3. **Syncs video playback** when difference exceeds threshold
4. **Falls back to local timing** if network connection is lost
5. **Resumes sync** when network connection is restored

### Network Events

The system uses the following Socket.IO events:

- `layout-sync-broadcast`: Master → All screens (layout timing data)
- `layout-sync-receive`: Master → Slave screens (layout sync commands)
- `video-sync`: Master → All screens (video playback data)

## Implementation Details

### Files Modified

1. **`config-example.json`**: Added `syncSettings` configuration section
2. **`src/assets/js/socketio-cpanel.js`**: Added sync event handlers and broadcasting functions
3. **`src/assets/js/looplayout.js`**: Modified `loopNextLayout()` to broadcast sync data
4. **`src/assets/js/slot-media.js`**: Added VideoJS player synchronization support

### Key Functions

#### Master Functions
- `broadcastLayoutSync()`: Broadcast current layout state
- `broadcastVideoTime()`: Broadcast video playback states
- `startMasterSync()`: Initialize master broadcasting

#### Slave Functions
- `syncToMasterLayout()`: Switch to master's current layout
- `syncLayoutTiming()`: Adjust timing within current layout
- `syncVideoPlayer()`: Sync individual video player
- `checkSyncStatus()`: Monitor network connectivity

#### Shared Functions
- `initSyncSettings()`: Initialize sync configuration
- `fallbackToLocalTiming()`: Handle network disconnections

## Usage Instructions

### Setup Process

1. **Configure Master Screen**:
   - Set `syncMode: "enabled"` and `isMaster: true`
   - Deploy and start the application
   - Verify master is broadcasting sync data (check console logs)

2. **Configure Slave Screens**:
   - Set `syncMode: "enabled"` and `isMaster: false`
   - Ensure Socket.IO connection to same server (localhost:9000)
   - Deploy and start applications

3. **Verify Synchronization**:
   - All screens should show same layout at same time
   - Layout transitions should happen simultaneously
   - Video content should remain synchronized

### Troubleshooting

#### Common Issues

**Screens not synchronizing:**
- Check Socket.IO connection (should connect to localhost:9000)
- Verify `syncMode` is "enabled" on all screens
- Ensure only one screen has `isMaster: true`

**Video sync issues:**
- Adjust `videoSyncThreshold` (lower = more frequent corrections)
- Check that VideoJS players are loading correctly
- Verify network stability between screens

**Layout timing issues:**
- Check master broadcast interval settings
- Verify layout duration calculations
- Monitor network latency between screens

#### Debug Logs

Enable debug logging by checking console output for:
- `=== SYNC MASTER:` - Master broadcasting messages
- `=== SYNC SLAVE:` - Slave receiving/processing messages
- `=== VIDEO SYNC:` - Video synchronization events
- `=== LOOP SYNC:` - Layout loop synchronization

### Network Requirements

- **Stable network connection** between all screens
- **Low latency** for optimal synchronization (< 100ms recommended)
- **Socket.IO server** running on localhost:9000
- **Multicast/broadcast capability** for sync events

## Advanced Configuration

### Fine-tuning Sync Performance

```json
{
  "syncSettings": {
    "syncMode": "enabled",
    "masterBroadcastInterval": 500,
    "videoSyncThreshold": 0.2,
    "syncInterval": 2000,
    "networkTimeout": 5000
  }
}
```

### High-precision Setup
- Reduce `masterBroadcastInterval` to 500ms
- Lower `videoSyncThreshold` to 0.2 seconds
- Decrease `syncInterval` for faster slave checks

### Network-tolerant Setup
- Increase `networkTimeout` to 30000ms (30 seconds)
- Set higher `syncInterval` to reduce network load
- Enable more aggressive local fallback timing

## Monitoring and Maintenance

### Performance Monitoring
- Monitor console logs for sync events
- Check network latency between screens
- Observe CPU usage during sync operations

### Regular Maintenance
- Test network connectivity between screens
- Verify master screen stability
- Update configuration based on performance observations

## Compatibility

- **Electron**: Compatible with existing Electron app structure
- **VideoJS**: Works with current VideoJS implementation
- **Socket.IO**: Uses existing Socket.IO connection
- **Offline Mode**: Graceful degradation when network unavailable

## Future Enhancements

Potential improvements for future versions:

1. **Multi-master support**: Automatic failover between masters
2. **Advanced timing algorithms**: Machine learning for network latency compensation
3. **Web-based configuration**: GUI for sync settings management
4. **Health monitoring**: Dashboard for sync system status
5. **Cloud synchronization**: Cross-location sync support

---

For technical support or questions about synchronization implementation, please refer to the console logs and contact the development team.