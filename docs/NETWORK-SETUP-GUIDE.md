# eCLESS Player Multi-PC Synchronization Setup Guide

## Quick Start Network Configuration

### Step 1: Identify Your Network Setup

Before configuring synchronization, determine your network topology:

1. **Check Master PC IP Address**:
   - Windows: `ipconfig`
   - Linux/macOS: `ifconfig` or `ip addr`
   - Note the IP address (e.g., 192.168.1.10)

2. **Verify Network Connectivity**:
   ```bash
   # From each slave PC, test connectivity to master
   ping [master-ip-address]
   
   # Example:
   ping 192.168.1.10
   ```

### Step 2: Configure Master PC

**File**: `~/clessapp/config.json` (Windows: `%USERPROFILE%\clessapp\config.json`)

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

**Important**: Replace `192.168.1.10` with your actual master PC IP address.

### Step 3: Configure Slave PCs

**File**: `~/clessapp/config.json` on each slave PC

```json
{
  "syncSettings": {
    "syncMode": "enabled",
    "isMaster": false,
    "masterServerAddress": "192.168.1.10",
    "masterServerPort": 9000,
    "syncInterval": 5000,
    "videoSyncThreshold": 0.5,
    "networkTimeout": 10000
  }
}
```

**Important**: Use the SAME IP address as configured on the master PC.

### Step 4: Configure Firewalls

**Windows Master PC**:
```cmd
# Open Windows Firewall for port 9000
netsh advfirewall firewall add rule name="eCLESS Sync Port" dir=in action=allow protocol=TCP localport=9000
```

**Linux Master PC**:
```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 9000/tcp

# OR iptables (general Linux)
sudo iptables -A INPUT -p tcp --dport 9000 -j ACCEPT
sudo iptables-save
```

### Step 5: Test Configuration

1. **Start Master PC first**
2. **Start Slave PCs**
3. **Check logs** in console for sync messages:
   - Master: Look for `=== SYNC MASTER: Broadcasting...`
   - Slaves: Look for `=== SYNC SLAVE: Received...`

## Common Network Scenarios

### Home/Small Office (Single Router)
- **Network**: 192.168.1.x or 192.168.0.x
- **Setup**: All devices connect to same router
- **Configuration**: Use router-assigned IP addresses

### Corporate Network (Multiple VLANs)
- **Network**: Various subnets (e.g., 10.x.x.x, 172.16.x.x)
- **Setup**: Ensure routing between VLANs
- **Configuration**: May require IT support for firewall rules

### Dedicated Display Network
- **Network**: Isolated subnet for displays
- **Setup**: Separate switch/VLAN for sync traffic
- **Configuration**: Highest performance, minimal interference

## Troubleshooting Checklist

### ✅ Pre-Flight Checks

- [ ] Master PC IP address is correct in all configurations
- [ ] Port 9000 is open on master PC firewall
- [ ] All PCs can ping the master PC
- [ ] Only ONE PC has `"isMaster": true`
- [ ] All slave PCs have `"isMaster": false`
- [ ] All PCs have `"syncMode": "enabled"`

### ✅ Connectivity Tests

```bash
# Test from slave PC to master PC
ping [master-ip]                    # Should respond
telnet [master-ip] 9000             # Should connect
nslookup [master-ip]                # If using hostname
```

### ✅ Log Verification

**Master PC Logs Should Show**:
```
=== SYNC MASTER: Started with optimized interval: 1000ms
=== SYNC MASTER: Broadcasting layout sync: {...}
=== SYNC MASTER: Broadcasting video sync: {...}
```

**Slave PC Logs Should Show**:
```
=== RENDERER PROCESS: Connected to socket server ===
=== SYNC SLAVE: Received layout sync: {...}
=== SYNC SLAVE: Received video sync: {...}
```

## Configuration Parameters Explained

| Parameter | Master | Slave | Description |
|-----------|--------|-------|-------------|
| `syncMode` | "enabled" | "enabled" | Turns sync on/off |
| `isMaster` | true | false | Defines role in sync |
| `masterServerAddress` | master-ip | master-ip | IP where server runs |
| `masterServerPort` | 9000 | 9000 | Network port for sync |
| `masterBroadcastInterval` | 1000 | N/A | How often master sends data (ms) |
| `syncInterval` | N/A | 5000 | How often slave checks sync (ms) |
| `videoSyncThreshold` | N/A | 0.5 | Video time difference trigger (sec) |
| `networkTimeout` | N/A | 10000 | Max wait for master response (ms) |

## Performance Tuning

### High-Precision Setup
- `masterBroadcastInterval`: 500ms
- `syncInterval`: 2000ms  
- `videoSyncThreshold`: 0.2s
- `networkTimeout`: 5000ms

### Network-Tolerant Setup
- `masterBroadcastInterval`: 2000ms
- `syncInterval`: 10000ms
- `videoSyncThreshold`: 1.0s
- `networkTimeout`: 30000ms

## Support

For technical support, check:
1. Console logs in browser developer tools
2. Network connectivity between PCs
3. Firewall configurations
4. eCLESS Player control panel at https://localhost:9000

---

**Need Help?** Contact Closed-Loop Technology support with your network configuration details and console logs.