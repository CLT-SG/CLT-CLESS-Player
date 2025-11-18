# Multi-NIC Serial Key System

## Overview

The eCLESS Player now features a professional multi-network interface (multi-NIC) serial key validation system. This enhancement allows the application to detect and validate activation licenses across multiple physical network adapters, providing greater flexibility and reliability for hardware-bound licensing.

## Key Features

### 1. **Multi-Network Interface Detection**
- Automatically detects all physical network interfaces (Ethernet, WiFi, USB Network adapters, etc.)
- Filters out virtual interfaces (Docker, VMware, VirtualBox, etc.)
- Identifies interface types (Ethernet, WiFi, USB Network, Bluetooth, Other)
- Displays detailed information for each detected interface

### 2. **Flexible License Validation**
- License keys can be generated for **any** detected physical network interface
- Validation succeeds if the serial key matches **any** physical network interface
- Backward compatible with existing single-MAC serial keys
- No need to regenerate keys when hardware configuration changes (as long as one licensed interface remains)

### 3. **Enhanced User Experience**
- **Activation Screen**: Shows all detected network interfaces with their MAC addresses
- **Control Panel**: Displays license status and which interface is validated
- **WhatsApp QR Code**: Automatically includes all MAC addresses in license requests
- Visual indicators showing which interfaces are licensed

## Technical Architecture

### Core Component: SerialKeyValidator

Located in: `/SerialKeyValidator.js`

**Key Methods:**
- `getAllNetworkMACs()`: Retrieves all physical network interface MAC addresses
- `generateSerialKey(mac)`: Generates SHA-256 hash for a MAC address
- `validateSerialKey(key)`: Validates a key against all detected interfaces
- `getValidationReport(key)`: Provides detailed validation diagnostics

**Virtual Interface Filtering:**
The system automatically excludes:
- Docker virtual ethernet (veth, docker, br-)
- VMware virtual adapters (vmnet)
- VirtualBox interfaces (vbox)
- Tunnel/TAP interfaces (tun, tap)
- Windows Subsystem for Linux (wsl)
- Hyper-V virtual adapters
- Loopback interfaces (lo)

### Integration Points

#### 1. Application Startup (`index.js`)
```javascript
const SerialKeyValidator = require('./SerialKeyValidator')

const validator = new SerialKeyValidator({
    secret: 'Clt@2022',
    debug: process.env.NODE_ENV === 'development',
    logger: log
})

const validationResult = validator.validateSerialKey(config.serialkey)
```

#### 2. Activation Screen (`activate.html` / `activate.js`)
- Displays all detected network interfaces
- Shows MAC addresses for each interface
- Generates WhatsApp QR codes with all MACs
- Provides copy-to-clipboard functionality

#### 3. Control Panel (`cpanel.html` / `cpanel-enhanced.js`)
- Real-time license validation status
- Network interface list with license indicators
- Visual badges showing which interface is licensed
- API endpoint: `/api/network-license-status`

## Serial Key Generation Process

### For License Administrators

**Step 1: Customer Requests License**
- Customer provides MAC address(es) via WhatsApp QR code or email
- Multiple MAC addresses may be provided for systems with multiple NICs

**Step 2: Generate Serial Key**
- Use any of the provided MAC addresses
- Apply SHA-256 hashing algorithm with secret key 'Clt@2022'
- Formula: `SHA-256(MAC_ADDRESS)`

**Example:**
```javascript
const crypto = require('crypto')
const macAddress = 'aa:bb:cc:dd:ee:ff'
const serialKey = crypto.createHash('sha256').update(macAddress).digest('hex')
```

**Step 3: Provide Serial Key to Customer**
- Customer enters the key in the Control Panel (System Configuration > Serial Key)
- Application validates against all physical network interfaces
- License is activated if key matches any physical interface

## Usage Guide

### For End Users

#### Activating a License

1. **Launch Application**
   - If no valid license detected, activation screen appears automatically

2. **View Network Interfaces**
   - All physical network interfaces are displayed
   - Each shows: Interface name, Type (Ethernet/WiFi/etc.), MAC address

3. **Request License Key**
   - **Option A**: Scan WhatsApp QR code (includes all MAC addresses)
   - **Option B**: Email sales@closed-loop.biz with MAC address
   - **Option C**: Copy any MAC address and send to support

4. **Enter License Key**
   - **Method 1**: On activation screen, enter key and click "Activate License"
   - **Method 2**: Access control panel at `https://[IP]:9000`
     - Navigate to System Configuration
     - Enter serial key
     - Click "Save Configuration"
   - Application will restart and validate the license

5. **Verification**
   - Check Control Panel → System Configuration → Network Interfaces & License Status
   - Green badge indicates licensed interface
   - Red badge indicates unlicensed interface

### Troubleshooting

#### "License Invalid" Error

**Common Causes:**
1. Serial key doesn't match any detected MAC address
2. Network interface changed (USB adapter removed, etc.)
3. Virtual machine or docker environment detected

**Solutions:**
1. Verify the serial key was generated for one of your physical MAC addresses
2. Check Control Panel to see all detected interfaces
3. Request new license if hardware changed
4. Ensure physical (not virtual) network adapters are being used

#### No Network Interfaces Detected

**Possible Causes:**
1. All interfaces are virtual (VM environment)
2. Network drivers not installed
3. System permissions issue

**Solutions:**
1. Install physical network adapter
2. Update network drivers
3. Run application with appropriate permissions
4. Contact support with system logs

## API Reference

### Endpoint: `/api/network-license-status`

**Method:** GET

**Response:**
```json
{
  "interfaces": [
    {
      "interface": "eth0",
      "mac": "aa:bb:cc:dd:ee:ff",
      "type": "Ethernet",
      "family": "IPv4",
      "address": "192.168.1.100"
    }
  ],
  "licenseValid": true,
  "matchedInterface": {
    "interface": "eth0",
    "mac": "aa:bb:cc:dd:ee:ff",
    "type": "Ethernet"
  },
  "validationReason": "Serial key valid",
  "timestamp": "2025-11-18T10:30:00.000Z"
}
```

## Logging and Diagnostics

### Log Locations
- Application logs: `~/clessapp/logs/[date].log`
- Network interface detection: Tagged with `SerialKeyValidator:`
- License validation: Tagged with `SerialKeyValidator:`

### Important Log Messages

**Successful Validation:**
```
SerialKeyValidator: Detected 2 network interface(s)
SerialKeyValidator: Valid serial key matched for eth0 (aa:bb:cc:dd:ee:ff) - Type: Ethernet
SerialKeyValidator: Serial key validation SUCCESS
```

**Failed Validation:**
```
SerialKeyValidator: Serial key validation FAILED
SerialKeyValidator: Reason: Serial key does not match any network interface
SerialKeyValidator: Detected 2 network interface(s)
```

### Debug Mode

Enable detailed logging:
```bash
# Linux/Mac
export NODE_ENV=development

# Windows
set NODE_ENV=development
```

## Migration from Single-NIC System

### Backward Compatibility

✅ **Existing licenses remain valid** - No re-activation required

The new multi-NIC system is fully backward compatible:
- Old serial keys generated for a single MAC continue to work
- No database migration needed
- No configuration changes required
- Automatic detection of existing keys

### Benefits of Multi-NIC System

1. **Hardware Flexibility**: License works if user switches between Ethernet and WiFi
2. **USB Adapter Support**: License works with USB network adapters
3. **Redundancy**: Multiple interfaces mean more reliable activation
4. **Better Diagnostics**: Clear visibility of all network interfaces
5. **Easier Support**: Support team can see all available MAC addresses

## Security Considerations

### SHA-256 Hashing
- Uses industry-standard SHA-256 cryptographic hash
- Secret key: 'Clt@2022'
- MAC address normalization ensures consistency

### Best Practices
1. Keep serial keys confidential
2. Generate unique keys for each customer
3. Do not share serial keys publicly
4. Regenerate keys if compromised

## Testing Scenarios

### Test Cases Covered
- ✅ Single network interface (Ethernet only)
- ✅ Multiple interfaces (Ethernet + WiFi)
- ✅ USB network adapters (hot-pluggable)
- ✅ Virtual interface filtering (Docker, VMware)
- ✅ Interface type detection
- ✅ Backward compatibility with old licenses
- ✅ License persistence across restarts
- ✅ Offline mode operation

## Support and Troubleshooting

### Contact Information
- **Email**: sales@closed-loop.biz
- **WhatsApp**: +65 88995538
- **Control Panel URL**: `https://[device-ip]:9000`

### Common Support Requests

**1. Multiple MAC addresses - which one to use?**
- Any physical MAC address will work
- Primary interface (usually Ethernet) is recommended
- All are displayed in activation screen

**2. License stops working after hardware change**
- Request new license for new MAC address
- Keep backup of original network adapter if possible
- Document MAC addresses for reference

**3. Unable to activate in virtual machine**
- Virtual interfaces are filtered out
- Use physical network adapter
- Contact support for VM-specific licensing options

## Changelog

### Version 2.7.0 (Current)
- ✨ **NEW**: Multi-NIC serial key validation system
- ✨ **NEW**: SerialKeyValidator professional module
- ✨ **NEW**: Enhanced activation screen with all MAC addresses
- ✨ **NEW**: Control panel license status display
- ✨ **NEW**: WhatsApp QR code with multiple MAC addresses
- ✨ **NEW**: Virtual interface filtering
- ✨ **NEW**: Interface type detection (Ethernet, WiFi, USB, etc.)
- ✨ **NEW**: Comprehensive logging and diagnostics
- ✅ **IMPROVED**: Backward compatibility maintained
- ✅ **IMPROVED**: Better error messages and troubleshooting
- ✅ **IMPROVED**: Enhanced user experience

---

**Documentation Version**: 1.0.0  
**Last Updated**: November 18, 2025  
**Author**: Closed-Loop Technology Pte Ltd
