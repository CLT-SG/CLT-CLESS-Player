# eCLESS Player Configuration Migration Guide

## Overview

The eCLESS Player has been upgraded with an enhanced control panel that provides comprehensive system monitoring, display control, and configuration management features. To support these new features, the configuration system has been migrated from `config.js` to `config.json` format.

## Migration Process

### Automatic Migration

The migration process is **completely automatic** and happens when you first start the upgraded eCLESS Player:

1. **Detection**: The application checks for existing `config.js` in `~/clessapp/`
2. **Backup**: Creates `config.js.backup` to preserve your original settings
3. **Migration**: Converts your settings to the new `config.json` format
4. **Enhancement**: Adds new features with default values
5. **Completion**: Marks migration as complete to prevent re-running

### What Gets Migrated

Your existing configuration values are preserved:

| Old config.js | New config.json | Description |
|---------------|-----------------|-------------|
| `hostserver` | `hostserver` | CLESS server URL |
| `id` | `id` | Digital signage ID |
| `mode` | `mode` | Online/offline mode |
| `corsproxy` | `corsproxy` | CORS proxy setting |
| `autostartup` | `autoStartup` | Auto-startup setting |
| `serialkey` | `serialkey` | License serial key |
| `timeout` | `timeout` | Connection timeout |

### New Features Added

The enhanced configuration includes new features with sensible defaults:

```json
{
  "brightness": 80,
  "fullscreenMode": true,
  "updateInterval": 30000,
  "enableSystemMonitoring": true,
  "logLevel": "info",
  "version": "2.0",
  "lastModified": "2024-12-28T..."
}
```

## File Locations

- **Config Directory**: `~/clessapp/`
- **Old Config**: `~/clessapp/config.js` (backed up as `config.js.backup`)
- **New Config**: `~/clessapp/config.json`
- **Migration Flag**: `~/clessapp/.migration-v2-complete`

## Testing the Migration

Use the provided test script to validate the migration:

```bash
# Make the script executable (if not already)
chmod +x test-migration.sh

# Run the interactive test menu
./test-migration.sh

# Or run specific tests
./test-migration.sh 1  # Show status
./test-migration.sh 2  # Create test config
./test-migration.sh 4  # Test migration
```

### Test Script Features

1. **Status Check**: View current configuration state
2. **Test Creation**: Generate sample `config.js` for testing
3. **Migration Reset**: Clear migration state for re-testing
4. **Migration Test**: Run actual migration process
5. **Comparison**: Compare old vs new configurations
6. **Validation**: Verify migration completed successfully
7. **Cleanup**: Remove test files

## Backward Compatibility

The system maintains full backward compatibility:

- **Dual Support**: Both `config.js` and `config.json` are supported
- **Fallback**: If `config.json` is missing, falls back to `config.js`
- **No Breaking Changes**: Existing installations continue to work
- **Graceful Upgrade**: Migration only runs once per installation

## Enhanced Control Panel Features

After migration, you'll have access to:

### System Monitoring
- Real-time CPU, memory, disk usage
- Network statistics and connectivity
- Hardware information and temperatures
- Process monitoring and management

### Display Control
- Brightness adjustment (0-100%)
- Display power management
- Resolution and refresh rate info
- Multi-monitor support detection

### Configuration Management
- Live configuration editing
- Settings validation
- Backup and restore
- Version tracking

### Remote Management
- HTTPS control panel on port 9000
- Real-time WebSocket updates
- Secure certificate-based access
- Mobile-responsive interface

## Troubleshooting

### Migration Not Starting

1. **Check File Permissions**:
   ```bash
   ls -la ~/clessapp/config.js
   chmod 644 ~/clessapp/config.js
   ```

2. **Verify Config Format**:
   ```bash
   node -e "console.log(require('~/clessapp/config.js'))"
   ```

3. **Reset Migration State**:
   ```bash
   rm ~/clessapp/.migration-v2-complete
   ```

### Migration Failed

1. **Check Error Logs**: Look for error dialogs during startup
2. **Manual Backup**: Copy your `config.js` to a safe location
3. **Reset and Retry**: Use the test script to reset and retry
4. **Manual Migration**: Create `config.json` manually if needed

### Config.json Issues

1. **Validate JSON**:
   ```bash
   python3 -m json.tool ~/clessapp/config.json
   ```

2. **Restore Backup**:
   ```bash
   cp ~/clessapp/config.js.backup ~/clessapp/config.js
   rm ~/clessapp/config.json
   rm ~/clessapp/.migration-v2-complete
   ```

## Manual Migration (If Needed)

If automatic migration fails, you can manually create the new configuration:

```json
{
  "hostserver": "http://your-server.com",
  "id": "your-id",
  "mode": "online",
  "corsproxy": "N",
  "autoStartup": "Y",
  "timeout": 10000,
  "serialkey": "your-serial-key",
  "brightness": 80,
  "fullscreenMode": true,
  "updateInterval": 30000,
  "enableSystemMonitoring": true,
  "logLevel": "info",
  "version": "2.0",
  "lastModified": "2024-12-28T00:00:00.000Z"
}
```

Save this as `~/clessapp/config.json` and create the completion flag:

```bash
echo "Manual migration completed at $(date)" > ~/clessapp/.migration-v2-complete
```

## Post-Migration

After successful migration:

1. **Test Functionality**: Verify the application starts correctly
2. **Access Control Panel**: Navigate to `https://localhost:9000`
3. **Explore Features**: Try the new system monitoring and display controls
4. **Update Settings**: Use the web interface to modify configuration
5. **Backup Config**: Keep a backup of your new `config.json`

## Support

If you encounter any issues with the migration:

1. Run the test script for diagnostics
2. Check the application logs for error messages
3. Ensure all file permissions are correct
4. Verify Node.js and npm are properly installed
5. Contact support with migration test results

The migration system is designed to be safe and reversible - your original configuration is always preserved in the backup file.
