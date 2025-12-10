/**
 * Mobile Serial Key Validator for eCLESS Player
 * 
 * Adapts desktop SerialKeyValidator.js for mobile platforms.
 * Uses Capacitor Device API to get unique device identifiers since MAC addresses
 * are restricted on mobile (Android 6+ and iOS don't allow direct MAC access).
 * 
 * Validation Strategy for Mobile:
 * - Primary: Device UUID (persistent across app reinstalls on most devices)
 * - Secondary: Android ID (Android-specific, reset on factory reset)
 * - Fallback: Generate and store unique ID in localStorage
 * 
 * @module mobile-serial-validator
 * @version 1.0.0
 * @author Closed-Loop Technology Pte Ltd
 */

console.log('=== MOBILE SERIAL VALIDATOR: Initializing ===');

class MobileSerialKeyValidator {
    constructor(options = {}) {
        this.secret = options.secret || 'Clt@2022';
        this.debug = options.debug || false;
        this.log = options.logger || window.log || console;
        
        // Cache for device identifiers
        this.cachedDeviceId = null;
        this.cacheTimeout = options.cacheTimeout || 60000; // 60 seconds cache
        this.lastCacheTime = 0;
    }

    /**
     * Get unique device identifier for mobile devices
     * 
     * @returns {Promise<Object>} Device identifier information
     */
    async getDeviceIdentifier() {
        try {
            // Check cache first
            const now = Date.now();
            if (this.cachedDeviceId && (now - this.lastCacheTime) < this.cacheTimeout) {
                if (this.debug) {
                    this.log.debug('MobileSerialValidator: Using cached device identifier');
                }
                return this.cachedDeviceId;
            }

            let deviceInfo = {
                uuid: null,
                androidId: null,
                platform: 'unknown',
                model: 'unknown',
                manufacturer: 'unknown',
                isNative: false
            };

            // Try to get Capacitor Device info
            if (window.capacitorAPI && window.capacitorAPI.isNative) {
                try {
                    const info = await window.capacitorAPI.getDeviceInfo();
                    
                    deviceInfo = {
                        uuid: info.uuid || info.identifier || null,
                        androidId: info.androidId || null,
                        platform: info.platform || 'unknown',
                        model: info.model || 'unknown',
                        manufacturer: info.manufacturer || 'unknown',
                        isNative: true
                    };

                    if (this.debug) {
                        this.log.info('MobileSerialValidator: Retrieved native device info', deviceInfo);
                    }

                } catch (capacitorError) {
                    this.log.warn('MobileSerialValidator: Failed to get Capacitor device info', capacitorError);
                }
            }

            // Fallback: Generate persistent ID from localStorage
            if (!deviceInfo.uuid) {
                const storedUuid = localStorage.getItem('ecless-device-uuid');
                
                if (storedUuid) {
                    deviceInfo.uuid = storedUuid;
                    if (this.debug) {
                        this.log.debug('MobileSerialValidator: Using stored UUID from localStorage');
                    }
                } else {
                    // Generate new UUID
                    deviceInfo.uuid = this.generateUUID();
                    localStorage.setItem('ecless-device-uuid', deviceInfo.uuid);
                    if (this.debug) {
                        this.log.info('MobileSerialValidator: Generated new UUID and stored in localStorage');
                    }
                }
                
                deviceInfo.platform = 'web';
                deviceInfo.isNative = false;
            }

            // Update cache
            this.cachedDeviceId = deviceInfo;
            this.lastCacheTime = now;

            if (this.debug) {
                this.log.info('MobileSerialValidator: Device identifier retrieved successfully');
            }

            return deviceInfo;

        } catch (error) {
            this.log.error('MobileSerialValidator: Error getting device identifier', error);
            
            // Emergency fallback
            return {
                uuid: localStorage.getItem('ecless-device-uuid') || this.generateUUID(),
                androidId: null,
                platform: 'unknown',
                model: 'unknown',
                manufacturer: 'unknown',
                isNative: false
            };
        }
    }

    /**
     * Generate UUID v4 (RFC 4122 compliant)
     * 
     * @returns {string} UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Create unique device identifier string for hashing
     * Uses UUID only (matching desktop MAC address approach)
     * 
     * @param {Object} deviceInfo - Device information object
     * @returns {string} Device UUID string
     */
    createDeviceString(deviceInfo) {
        // Use UUID only, similar to desktop using MAC address
        return (deviceInfo.uuid || '').toLowerCase();
    }

    /**
     * Generate SHA-256 hash for device identifier
     * 
     * @param {string} deviceString - Device identifier string
     * @returns {Promise<string>} SHA-256 hash
     */
    async generateSerialKey(deviceString) {
        try {
            // Use Web Crypto API for SHA-256 hashing
            const encoder = new TextEncoder();
            const data = encoder.encode(deviceString);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            
            // Convert buffer to hex string
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            return hashHex;

        } catch (error) {
            this.log.error('MobileSerialValidator: Error generating serial key', error);
            
            // Fallback to simple hash if Web Crypto API fails
            return this.simpleHash(deviceString);
        }
    }

    /**
     * Simple hash fallback (not cryptographically secure, but functional)
     * 
     * @param {string} str - String to hash
     * @returns {string} Hash string
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(16, '0');
    }

    /**
     * Generate serial key for current device
     * 
     * @returns {Promise<Object>} Serial key information
     */
    async generateDeviceSerialKey() {
        try {
            const deviceInfo = await this.getDeviceIdentifier();
            const deviceString = this.createDeviceString(deviceInfo);
            const serialKey = await this.generateSerialKey(deviceString);

            return {
                serialKey: serialKey,
                deviceInfo: deviceInfo,
                deviceString: deviceString
            };

        } catch (error) {
            this.log.error('MobileSerialValidator: Error generating device serial key', error);
            throw error;
        }
    }

    /**
     * Validate a serial key against current device
     * 
     * @param {string} providedSerialKey - Serial key to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateSerialKey(providedSerialKey) {
        try {
            if (!providedSerialKey || providedSerialKey.trim() === '') {
                return {
                    valid: false,
                    reason: 'No serial key provided',
                    deviceInfo: null
                };
            }

            // Generate serial key for current device
            const deviceKeyInfo = await this.generateDeviceSerialKey();

            // Compare provided key with generated key
            const isValid = providedSerialKey.toLowerCase() === deviceKeyInfo.serialKey.toLowerCase();

            if (isValid) {
                if (this.debug) {
                    this.log.info('MobileSerialValidator: Serial key validation SUCCESS');
                    this.log.info(`MobileSerialValidator: Device UUID: ${deviceKeyInfo.deviceInfo.uuid}`);
                }

                return {
                    valid: true,
                    reason: 'Serial key matches device identifier',
                    deviceInfo: deviceKeyInfo.deviceInfo,
                    serialKey: deviceKeyInfo.serialKey
                };
            } else {
                if (this.debug) {
                    this.log.warn('MobileSerialValidator: Serial key validation FAILED');
                    this.log.warn(`MobileSerialValidator: Expected: ${deviceKeyInfo.serialKey.substring(0, 8)}...`);
                    this.log.warn(`MobileSerialValidator: Provided: ${providedSerialKey.substring(0, 8)}...`);
                }

                return {
                    valid: false,
                    reason: 'Serial key does not match device identifier',
                    deviceInfo: deviceKeyInfo.deviceInfo,
                    expectedKey: deviceKeyInfo.serialKey,
                    providedKey: providedSerialKey
                };
            }

        } catch (error) {
            this.log.error('MobileSerialValidator: Error validating serial key', error);
            return {
                valid: false,
                reason: 'Validation error: ' + error.message,
                deviceInfo: null,
                error: error
            };
        }
    }

    /**
     * Get validation report for debugging
     * 
     * @param {string} providedSerialKey - Serial key to validate
     * @returns {Promise<Object>} Detailed validation report
     */
    async getValidationReport(providedSerialKey) {
        const validationResult = await this.validateSerialKey(providedSerialKey);
        const deviceKeyInfo = await this.generateDeviceSerialKey();

        return {
            timestamp: new Date().toISOString(),
            providedSerialKey: providedSerialKey ? providedSerialKey.substring(0, 8) + '...' : 'Not provided',
            validationResult: validationResult,
            deviceIdentifier: {
                uuid: deviceKeyInfo.deviceInfo.uuid,
                platform: deviceKeyInfo.deviceInfo.platform,
                isNative: deviceKeyInfo.deviceInfo.isNative
            },
            generatedSerialKey: deviceKeyInfo.serialKey.substring(0, 8) + '...',
            deviceString: deviceKeyInfo.deviceString
        };
    }

    /**
     * Clear cache (useful after device changes)
     */
    clearCache() {
        this.cachedDeviceId = null;
        this.lastCacheTime = 0;
        if (this.debug) {
            this.log.debug('MobileSerialValidator: Cache cleared');
        }
    }

    /**
     * Get display-friendly device info for UI
     * Returns UUID only (matching desktop MAC address display)
     * 
     * @returns {Promise<Object>} Device info formatted for display
     */
    async getDisplayInfo() {
        try {
            const deviceInfo = await this.getDeviceIdentifier();
            const deviceKeyInfo = await this.generateDeviceSerialKey();

            return {
                uuid: deviceInfo.uuid || 'Not Available',
                serialKey: deviceKeyInfo.serialKey,
                isNative: deviceInfo.isNative
            };

        } catch (error) {
            this.log.error('MobileSerialValidator: Error getting display info', error);
            return {
                uuid: 'Error',
                serialKey: 'error',
                isNative: false
            };
        }
    }
}

// Export for use in other modules
window.MobileSerialKeyValidator = MobileSerialKeyValidator;

console.log('=== MOBILE SERIAL VALIDATOR: Loaded successfully ===');
