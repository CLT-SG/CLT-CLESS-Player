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

## Network Architecture

The CLT-CLESS-Player synchronization uses a **centralized Socket.IO server architecture** where:

- **Master PC** runs both the eCLESS Player application AND the Socket.IO server
- **Slave PCs** connect to the master's Socket.IO server over the network
- All synchronization data flows through the central server on the master PC

### Network Topology

```
Master PC (192.168.1.10)          Slave PC 1 (192.168.1.11)
┌─────────────────────┐            ┌─────────────────────┐
│   Master App        │            │   Slave App         │
│ (isMaster: true)    │            │ (isMaster: false)   │
│                     │            │                     │
│ Socket.IO Server    │◄───────────┤ Socket.IO Client    │
│ Port: 9000          │            │ Connect to:         │
│ Broadcasts sync     │            │ 192.168.1.10:9000   │
│ data to all slaves  │            │                     │
└─────────────────────┘            └─────────────────────┘
                                              │
                                              │
                                   Slave PC 2 (192.168.1.12)
                                   ┌─────────────────────┐
                                   │   Slave App         │
                                   │ (isMaster: false)   │
                                   │                     │
                                   │ Socket.IO Client    │
                                   │ Connect to:         │
                                   │ 192.168.1.10:9000   │
                                   └─────────────────────┘
```

### How Slaves Find the Master

**Slaves do NOT automatically discover the master.** Instead:

1. **Manual Configuration**: Each slave must be manually configured with the master's IP address
2. **Central Server**: All devices connect to the same Socket.IO server (running on master)
3. **Network Requirements**: All devices must be on the same network or have network routes to the master
4. **No Peer-to-Peer**: No direct communication between slaves - all goes through master server

## Configuration

### Basic Setup

Add the following `syncSettings` section to your `config.json`:

```json
{
  "syncSettings": {
    "syncMode": "enabled",
    "isMaster": false,
    "masterServerAddress": "192.168.1.10",
    "masterServerPort": 9000,
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
| `masterServerAddress` | string | "localhost" | IP address or hostname of the master server |
| `masterServerPort` | number | 9000 | Port number of the master server |
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
    "masterServerAddress": "192.168.1.10",
    "masterServerPort": 9000,
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
    "masterServerAddress": "192.168.1.10",
    "masterServerPort": 9000,
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

## Network Setup Scenarios

### Scenario 1: Simple Local Network Setup

**Environment**: Office with router and local WiFi/Ethernet
**Master PC**: 192.168.1.10 (connected via Ethernet)
**Slave PCs**: 192.168.1.11, 192.168.1.12 (connected via WiFi)

**Configuration Steps**:

1. **Master PC (192.168.1.10) - config.json**:
```json
{
  "syncSettings": {
    "syncMode": "enabled",
    "isMaster": true,
    "masterServerAddress": "192.168.1.10",
    "masterServerPort": 9000,
    "layoutSyncEnabled": true,
    "videoSyncEnabled": true,
    "masterBroadcastInterval": 1000
  }
}
```

2. **Slave PC 1 (192.168.1.11) - config.json**:
```json
{
  "syncSettings": {
    "syncMode": "enabled",
    "isMaster": false,
    "masterServerAddress": "192.168.1.10",
    "masterServerPort": 9000,
    "syncInterval": 3000,
    "videoSyncThreshold": 0.3,
    "networkTimeout": 15000
  }
}
```

3. **Slave PC 2 (192.168.1.12) - config.json**:
```json
{
  "syncSettings": {
    "syncMode": "enabled",
    "isMaster": false,
    "masterServerAddress": "192.168.1.10",
    "masterServerPort": 9000,
    "syncInterval": 3000,
    "videoSyncThreshold": 0.3,
    "networkTimeout": 15000
  }
}
```

**Network Requirements**:
- Ensure Windows Firewall allows port 9000 on master PC
- All devices on same subnet (192.168.1.x)
- Stable network connection with <100ms latency

### Scenario 2: Multiple Network Segments

**Environment**: Large facility with multiple subnets
**Master PC**: 10.1.1.100 (Management VLAN)
**Slave PCs**: 10.2.1.50, 10.2.1.51 (Display VLAN)

**Configuration Steps**:

1. **Network Configuration**:
   - Configure routing between VLANs (10.1.1.0/24 ↔ 10.2.1.0/24)
   - Open firewall rules for port 9000 TCP from 10.2.1.0/24 to 10.1.1.100
   - Test connectivity: `ping 10.1.1.100` from slave PCs

2. **Master PC (10.1.1.100) - config.json**:
```json
{
  "syncSettings": {
    "syncMode": "enabled",
    "isMaster": true,
    "masterServerAddress": "10.1.1.100",
    "masterServerPort": 9000,
    "layoutSyncEnabled": true,
    "videoSyncEnabled": true,
    "masterBroadcastInterval": 2000
  }
}
```

3. **Slave PCs (10.2.1.50, 10.2.1.51) - config.json**:
```json
{
  "syncSettings": {
    "syncMode": "enabled",
    "isMaster": false,
    "masterServerAddress": "10.1.1.100",
    "masterServerPort": 9000,
    "syncInterval": 5000,
    "videoSyncThreshold": 0.5,
    "networkTimeout": 20000
  }
}
```

### Scenario 3: High-Precision Synchronization

**Environment**: Mission-critical display system
**Master PC**: 172.16.0.10 (Dedicated sync server)
**Slave PCs**: 172.16.0.11-20 (10 display units)

**Configuration for Ultra-Precise Sync**:

1. **Master PC - config.json**:
```json
{
  "syncSettings": {
    "syncMode": "enabled",
    "isMaster": true,
    "masterServerAddress": "172.16.0.10",
    "masterServerPort": 9000,
    "layoutSyncEnabled": true,
    "videoSyncEnabled": true,
    "masterBroadcastInterval": 500
  }
}
```

2. **All Slave PCs - config.json**:
```json
{
  "syncSettings": {
    "syncMode": "enabled",
    "isMaster": false,
    "masterServerAddress": "172.16.0.10",
    "masterServerPort": 9000,
    "syncInterval": 1000,
    "videoSyncThreshold": 0.1,
    "networkTimeout": 5000
  }
}
```

**Optimizations**:
- Use Gigabit Ethernet connections
- Dedicated network switch for sync traffic
- QoS prioritization for port 9000
- Network monitoring for latency tracking

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
   - Set `masterServerAddress` to the master PC's IP address (e.g., "192.168.1.10")
   - Deploy and start the application
   - Verify master is broadcasting sync data (check console logs)

2. **Configure Slave Screens**:
   - Set `syncMode: "enabled"` and `isMaster: false`
   - Set `masterServerAddress` to the master PC's IP address (e.g., "192.168.1.10")
   - Ensure Socket.IO connection to master server (e.g., https://192.168.1.10:9000)
   - Deploy and start applications

3. **Verify Synchronization**:
   - All screens should show same layout at same time
   - Layout transitions should happen simultaneously
   - Video content should remain synchronized

### Troubleshooting

#### Common Issues

**Screens not synchronizing:**
- Check Socket.IO connection to master server IP address
- Verify `syncMode` is "enabled" on all screens
- Ensure only one screen has `isMaster: true`
- Confirm `masterServerAddress` points to correct master IP
- Check network connectivity between master and slave PCs

**Network connectivity issues:**
- Test basic connectivity: `ping [master-ip]` from slave PCs
- Verify port 9000 is open: `telnet [master-ip] 9000`
- Check firewall rules on both master and slave systems
- Ensure no proxy/NAT blocking WebSocket connections
- Verify DNS resolution if using hostnames instead of IP addresses

**Connection timeout errors:**
- Increase `networkTimeout` value in slave configurations
- Check for network congestion or high latency
- Verify network infrastructure stability
- Consider dedicated network for sync traffic

**Video sync issues:**
- Adjust `videoSyncThreshold` (lower = more frequent corrections)
- Check that VideoJS players are loading correctly
- Verify network stability between screens
- Monitor bandwidth usage for video streaming

**Layout timing issues:**
- Check master broadcast interval settings
- Verify layout duration calculations
- Monitor network latency between screens
- Ensure master PC has sufficient processing power

**Cross-subnet/VLAN issues:**
- Verify routing tables between network segments
- Check inter-VLAN firewall rules
- Test end-to-end connectivity with traceroute
- Ensure no network address translation (NAT) conflicts

#### Network Testing Commands

**Basic Connectivity Test** (run from slave PCs):
```bash
# Test basic network connectivity
ping [master-ip-address]

# Test specific port connectivity
telnet [master-ip-address] 9000

# Test with timeout
timeout 5 bash -c "</dev/tcp/[master-ip]/9000" && echo "Port is open"
```

**Windows Firewall Configuration** (master PC):
```cmd
# Allow incoming connections on port 9000
netsh advfirewall firewall add rule name="eCLESS Sync" dir=in action=allow protocol=TCP localport=9000

# Check if port is listening
netstat -an | findstr :9000
```

**Linux Firewall Configuration** (master PC):
```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 9000/tcp

# iptables (general Linux)
sudo iptables -A INPUT -p tcp --dport 9000 -j ACCEPT

# Check if port is listening
ss -tlnp | grep :9000
```

#### Debug Logs

Enable debug logging by checking console output for:
- `=== SYNC MASTER:` - Master broadcasting messages
- `=== SYNC SLAVE:` - Slave receiving/processing messages
- `=== VIDEO SYNC:` - Video synchronization events
- `=== LOOP SYNC:` - Layout loop synchronization

### Network Requirements

- **Network connectivity** between master and all slave PCs
- **Low latency** for optimal synchronization (< 100ms recommended)
- **Socket.IO server** running on master PC (default port 9000)
- **Firewall configuration** allowing connections on port 9000
- **Same network segment** or routable network between master and slaves

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