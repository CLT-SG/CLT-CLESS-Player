/**
 * Serial Key Validator Module for eCLESS Player
 * 
 * Professional multi-NIC MAC address validation system
 * Supports hardware identification across multiple network interfaces
 * 
 * @module SerialKeyValidator
 * @version 2.7.0
 * @author Closed-Loop Technology Pte Ltd
 */

const crypto = require('crypto')
const os = require('os')

/**
 * SerialKeyValidator Class
 * Handles multi-network interface MAC address detection and serial key validation
 */
class SerialKeyValidator {
    constructor(options = {}) {
        this.secret = options.secret || 'Clt@2022'
        this.debug = options.debug || false
        this.log = options.logger || console
        
        // Cache for network interfaces to reduce repeated system calls
        this.cachedNetworkMACs = null
        this.cacheTimeout = options.cacheTimeout || 5000 // 5 seconds cache
        this.lastCacheTime = 0
    }

    /**
     * Get all physical network interface MAC addresses
     * Filters out virtual, loopback, and invalid interfaces
     * 
     * @returns {Array<Object>} Array of network interface objects with MAC addresses
     */
    getAllNetworkMACs() {
        try {
            // Check cache first
            const now = Date.now()
            if (this.cachedNetworkMACs && (now - this.lastCacheTime) < this.cacheTimeout) {
                if (this.debug) this.log.debug('SerialKeyValidator: Using cached network MACs')
                return this.cachedNetworkMACs
            }

            const networkInterfaces = os.networkInterfaces()
            const validMACs = []

            if (this.debug) {
                this.log.debug('SerialKeyValidator: Scanning network interfaces...')
            }

            // Iterate through all network interfaces
            for (const [interfaceName, interfaces] of Object.entries(networkInterfaces)) {
                if (!interfaces || interfaces.length === 0) continue

                for (const iface of interfaces) {
                    // Filter criteria for valid physical network interfaces
                    const isValid = this.isValidNetworkInterface(interfaceName, iface)

                    if (isValid) {
                        const macInfo = {
                            interface: interfaceName,
                            mac: iface.mac,
                            family: iface.family,
                            address: iface.address,
                            internal: iface.internal,
                            type: this.detectInterfaceType(interfaceName)
                        }

                        validMACs.push(macInfo)

                        if (this.debug) {
                            this.log.debug(`SerialKeyValidator: Valid interface found - ${interfaceName}: ${iface.mac} (${macInfo.type})`)
                        }
                    }
                }
            }

            // Remove duplicates based on MAC address
            const uniqueMACs = this.removeDuplicateMACs(validMACs)

            if (this.debug) {
                this.log.info(`SerialKeyValidator: Detected ${uniqueMACs.length} unique physical network interface(s)`)
            }

            // Update cache
            this.cachedNetworkMACs = uniqueMACs
            this.lastCacheTime = now

            return uniqueMACs

        } catch (error) {
            this.log.error('SerialKeyValidator: Error getting network MACs:', error)
            return []
        }
    }

    /**
     * Validate if a network interface should be considered for licensing
     * 
     * @param {string} interfaceName - Name of the network interface
     * @param {Object} iface - Interface details from os.networkInterfaces()
     * @returns {boolean} True if interface is valid for licensing
     */
    isValidNetworkInterface(interfaceName, iface) {
        // Must have a MAC address
        if (!iface.mac || iface.mac === '00:00:00:00:00:00') {
            return false
        }

        // Skip internal/loopback interfaces
        if (iface.internal) {
            return false
        }

        // Skip virtual interfaces (common virtual adapter patterns)
        const virtualPatterns = [
            /^veth/i,           // Docker virtual ethernet
            /^docker/i,         // Docker interfaces
            /^br-/i,            // Bridge interfaces
            /^virbr/i,          // Virtual bridge
            /^vmnet/i,          // VMware virtual
            /^vbox/i,           // VirtualBox
            /^tun/i,            // Tunnel interfaces
            /^tap/i,            // TAP interfaces
            /^lo/i,             // Loopback
            /^dummy/i,          // Dummy interfaces
            /virtual/i,         // Generic virtual
            /loopback/i,        // Loopback variants
            /^wsl/i,            // Windows Subsystem for Linux
            /^hyper-v/i         // Hyper-V virtual adapters
        ]

        for (const pattern of virtualPatterns) {
            if (pattern.test(interfaceName)) {
                if (this.debug) {
                    this.log.debug(`SerialKeyValidator: Skipping virtual interface: ${interfaceName}`)
                }
                return false
            }
        }

        return true
    }

    /**
     * Detect the type of network interface (Ethernet, WiFi, etc.)
     * 
     * @param {string} interfaceName - Name of the network interface
     * @returns {string} Interface type
     */
    detectInterfaceType(interfaceName) {
        const name = interfaceName.toLowerCase()

        if (name.includes('eth') || name.includes('en') && !name.includes('wl')) {
            return 'Ethernet'
        } else if (name.includes('wlan') || name.includes('wl') || name.includes('wi-fi') || name.includes('wifi')) {
            return 'WiFi'
        } else if (name.includes('usb')) {
            return 'USB Network'
        } else if (name.includes('bluetooth') || name.includes('bt')) {
            return 'Bluetooth'
        } else {
            return 'Other'
        }
    }

    /**
     * Remove duplicate MAC addresses from the list
     * 
     * @param {Array<Object>} macList - List of MAC info objects
     * @returns {Array<Object>} Deduplicated list
     */
    removeDuplicateMACs(macList) {
        const seen = new Set()
        const unique = []

        for (const macInfo of macList) {
            const normalizedMAC = this.normalizeMACAddress(macInfo.mac)
            if (!seen.has(normalizedMAC)) {
                seen.add(normalizedMAC)
                unique.push(macInfo)
            }
        }

        return unique
    }

    /**
     * Normalize MAC address to consistent format (lowercase, with colons)
     * 
     * @param {string} mac - MAC address in any format
     * @returns {string} Normalized MAC address
     */
    normalizeMACAddress(mac) {
        return mac.toLowerCase().replace(/[:-]/g, ':')
    }

    /**
     * Generate SHA-256 hash for a MAC address with secret
     * 
     * @param {string} mac - MAC address
     * @returns {string} SHA-256 hash
     */
    generateSerialKey(mac) {
        try {
            const normalizedMAC = this.normalizeMACAddress(mac)
            const hash = crypto.createHash('sha256')
                .update(normalizedMAC)
                .digest('hex')
            return hash
        } catch (error) {
            this.log.error('SerialKeyValidator: Error generating serial key:', error)
            return null
        }
    }

    /**
     * Generate serial keys for all detected network interfaces
     * 
     * @returns {Array<Object>} Array of objects with interface info and serial keys
     */
    generateAllSerialKeys() {
        const networkMACs = this.getAllNetworkMACs()
        const serialKeys = []

        for (const macInfo of networkMACs) {
            const serialKey = this.generateSerialKey(macInfo.mac)
            if (serialKey) {
                serialKeys.push({
                    ...macInfo,
                    serialKey: serialKey
                })
            }
        }

        return serialKeys
    }

    /**
     * Validate a serial key against all detected network interfaces
     * Returns true if the key matches ANY physical network interface
     * 
     * @param {string} providedSerialKey - Serial key to validate
     * @returns {Object} Validation result with details
     */
    validateSerialKey(providedSerialKey) {
        try {
            if (!providedSerialKey) {
                return {
                    valid: false,
                    reason: 'No serial key provided',
                    matchedInterface: null
                }
            }

            const networkMACs = this.getAllNetworkMACs()

            if (networkMACs.length === 0) {
                return {
                    valid: false,
                    reason: 'No network interfaces detected',
                    matchedInterface: null,
                    detectedInterfaces: 0
                }
            }

            // Check against each network interface
            for (const macInfo of networkMACs) {
                const generatedKey = this.generateSerialKey(macInfo.mac)
                
                if (generatedKey === providedSerialKey) {
                    if (this.debug || true) {
                        this.log.info(`SerialKeyValidator: Valid serial key matched for ${macInfo.interface} (${macInfo.mac}) - Type: ${macInfo.type}`)
                    }
                    
                    return {
                        valid: true,
                        reason: 'Serial key valid',
                        matchedInterface: macInfo,
                        detectedInterfaces: networkMACs.length,
                        allInterfaces: networkMACs
                    }
                }
            }

            // No match found
            if (this.debug) {
                this.log.warn('SerialKeyValidator: Serial key does not match any detected network interface')
                this.log.debug('SerialKeyValidator: Detected interfaces:', 
                    networkMACs.map(m => `${m.interface} (${m.mac})`).join(', '))
            }

            return {
                valid: false,
                reason: 'Serial key does not match any network interface',
                matchedInterface: null,
                detectedInterfaces: networkMACs.length,
                allInterfaces: networkMACs
            }

        } catch (error) {
            this.log.error('SerialKeyValidator: Error validating serial key:', error)
            return {
                valid: false,
                reason: 'Validation error: ' + error.message,
                matchedInterface: null,
                error: error
            }
        }
    }

    /**
     * Get primary network interface MAC address
     * Attempts to identify the most likely "primary" interface
     * Priority: Ethernet > WiFi > Other
     * 
     * @returns {Object|null} Primary interface info or null
     */
    getPrimaryNetworkMAC() {
        const networkMACs = this.getAllNetworkMACs()

        if (networkMACs.length === 0) {
            return null
        }

        // Priority order: Ethernet > WiFi > Other
        const ethernet = networkMACs.find(m => m.type === 'Ethernet')
        if (ethernet) return ethernet

        const wifi = networkMACs.find(m => m.type === 'WiFi')
        if (wifi) return wifi

        // Return first available
        return networkMACs[0]
    }

    /**
     * Get detailed validation report
     * Useful for debugging and support purposes
     * 
     * @param {string} providedSerialKey - Serial key to validate
     * @returns {Object} Detailed validation report
     */
    getValidationReport(providedSerialKey) {
        const validationResult = this.validateSerialKey(providedSerialKey)
        const allSerialKeys = this.generateAllSerialKeys()

        return {
            timestamp: new Date().toISOString(),
            providedSerialKey: providedSerialKey ? providedSerialKey.substring(0, 8) + '...' : 'Not provided',
            validationResult: validationResult,
            detectedInterfaces: allSerialKeys.map(sk => ({
                interface: sk.interface,
                mac: sk.mac,
                type: sk.type,
                address: sk.address,
                serialKeyPreview: sk.serialKey.substring(0, 8) + '...'
            })),
            systemInfo: {
                platform: os.platform(),
                hostname: os.hostname(),
                arch: os.arch()
            }
        }
    }

    /**
     * Clear cache (useful for testing or after network changes)
     */
    clearCache() {
        this.cachedNetworkMACs = null
        this.lastCacheTime = 0
        if (this.debug) {
            this.log.debug('SerialKeyValidator: Cache cleared')
        }
    }
}

// Export the class
module.exports = SerialKeyValidator
