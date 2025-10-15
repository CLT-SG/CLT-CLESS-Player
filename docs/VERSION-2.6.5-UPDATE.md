# Version 2.6.5 Update Summary

## Changes Made

### 1. Version Updates
- **package.json**: Updated version from `2.6.3` to `2.6.5`
- **config-example.json**: Updated version from `2.4.0` to `2.6.5`

### 2. Configuration Migration System Updates

#### New Upgrade Path for 2.6.5
Added specific upgrade logic to handle migration from older versions to 2.6.5:

```javascript
// Upgrade to 2.6.5: Ensure masterServerAddress and masterServerPort are present
if (compareVersions(currentVersion, '2.6.5') < 0) {
    // Add network server configuration fields if missing
    if (!upgradedConfig.syncSettings.hasOwnProperty('masterServerAddress')) {
        upgradedConfig.syncSettings.masterServerAddress = 'localhost'
    }
    if (!upgradedConfig.syncSettings.hasOwnProperty('masterServerPort')) {
        upgradedConfig.syncSettings.masterServerPort = 9000
    }
    upgradedConfig.version = '2.6.5'
}
```

#### Updated Target Versions
- Changed migration target version from `2.4.0` to `2.6.5`
- Updated all config creation functions to use version `2.6.5`
- Updated migration flags to reference version `2.6.5`

### 3. New Configuration Fields

All configuration files now include:
```json
{
  "syncSettings": {
    "syncMode": "disabled",
    "isMaster": false,
    "masterServerAddress": "localhost",  // NEW in 2.6.5
    "masterServerPort": 9000,            // NEW in 2.6.5
    "syncInterval": 5000,
    "videoSyncThreshold": 0.5,
    "layoutSyncEnabled": true,
    "videoSyncEnabled": true,
    "masterBroadcastInterval": 1000,
    "networkTimeout": 10000
  },
  "version": "2.6.5"
}
```

### 4. Migration Behavior

#### For Existing Users
- Users with configs older than 2.6.5 will trigger automatic upgrade
- Backup of existing config is created before upgrade
- New network fields are added with safe defaults
- Migration completion dialog updated to mention new network features

#### For New Users
- Fresh installations create config.json with version 2.6.5
- All new network configuration fields included by default

### 5. Backward Compatibility

The migration system maintains backward compatibility:
- Configs from 1.0.0 → 2.4.0 → 2.6.5 migration path
- Existing `syncSettings` are preserved and enhanced
- Safe defaults for new fields prevent breaking changes

### 6. Features Added in 2.6.5

- **Multi-PC Network Synchronization**: Slaves can connect to master on different PCs
- **Configurable Master Server**: `masterServerAddress` allows specifying master IP
- **Custom Port Support**: `masterServerPort` allows non-default port configurations
- **Enhanced Network Setup**: Documentation and examples for multi-PC scenarios

## User Impact

### Immediate Changes
- Existing users will see upgrade notification on next app restart
- Config files automatically updated with new network fields
- No manual intervention required for basic operation

### New Capabilities
- Cross-PC synchronization now fully supported
- Network-based master-slave setups possible
- Enhanced configuration flexibility for complex deployments

## Next Steps for Users

1. **Review new network configuration options** in updated config.json
2. **Update `masterServerAddress`** if using multi-PC setup
3. **Configure firewalls** for port 9000 if needed
4. **Test network connectivity** between master and slave PCs
5. **Refer to NETWORK-SETUP-GUIDE.md** for detailed setup instructions

---

**Version 2.6.5 - Multi-PC Network Synchronization Support**  
*Added support for true multi-PC synchronization with configurable master server addressing*