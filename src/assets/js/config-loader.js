/**
 * eCLESS Player Configuration Loader
 * Supports both legacy config.js and enhanced config.json formats
 * Provides seamless migration and backward compatibility
 */

class ConfigLoader {
    constructor() {
        this.config = null;
        this.configPath = null;
        this.isNewFormat = false;
    }

    /**
     * Load configuration from either config.json or config.js
     * Prioritizes config.json (new format) over config.js (legacy)
     * Uses IPC to get configuration from main process when available
     */
    async loadConfig() {
        try {
            // First try to get configuration from main process via IPC (preferred method in Electron)
            if (typeof require !== 'undefined' && window.ipcRenderer) {
                try {
                    console.log('eCLESS: Requesting configuration from main process via IPC...')
                    const config = await window.ipcRenderer.invoke('get-configuration')
                    if (config) {
                        this.config = config
                        this.isNewFormat = true
                        console.log('eCLESS: Successfully loaded configuration from main process')
                        return this.config
                    }
                } catch (error) {
                    console.warn('eCLESS: Failed to get config from main process, falling back to file system:', error)
                }
            }

            // Fallback to direct file system access
            const os = require('os');
            const path = require('path');
            const fs = require('fs');
            
            const homedir = os.homedir();
            const configDir = path.join(homedir, 'clessapp');
            const configJsonPath = path.join(configDir, 'config.json');
            const configJsPath = path.join(configDir, 'config.js');

            // Try to load config.json first (new enhanced format)
            if (fs.existsSync(configJsonPath)) {
                const configData = fs.readFileSync(configJsonPath, 'utf8');
                this.config = JSON.parse(configData);
                this.configPath = configJsonPath;
                this.isNewFormat = true;
                console.log('eCLESS: Loaded enhanced configuration from config.json');
                return this.config;
            }

            // Fallback to config.js (legacy format)
            if (fs.existsSync(configJsPath)) {
                // Clear require cache to ensure fresh load
                delete require.cache[require.resolve(configJsPath)];
                const oldConfig = require(configJsPath);
                
                // Convert to new format structure for compatibility
                this.config = {
                    // Legacy settings
                    hostserver: oldConfig.hostserver || 'https://cless4.closed-loop.biz/demo',
                    id: oldConfig.id || '10',
                    mode: oldConfig.mode || 'online',
                    corsproxy: oldConfig.corsproxy || 'N',
                    serialkey: oldConfig.serialkey || '',
                    timeout: oldConfig.timeout || 10000,
                    
                    // Handle autostartup conversion
                    autostartup: oldConfig.autostartup, // Keep original for legacy compatibility
                    autoStartup: oldConfig.autostartup === 'Y', // New boolean format
                    
                    // Default values for new features
                    fullscreenMode: true,
                    screenTimeout: 0,
                    updateInterval: 30,
                    logLevel: 'info',
                    brightness: 75,
                    
                    // Metadata
                    _legacy: true,
                    _source: 'config.js'
                };
                
                this.configPath = configJsPath;
                this.isNewFormat = false;
                console.log('eCLESS: Loaded legacy configuration from config.js');
                return this.config;
            }

            throw new Error('No configuration file found (config.json or config.js)');
            
        } catch (error) {
            console.error('eCLESS: Error loading configuration:', error);
            
            // Return default configuration if both files fail
            this.config = this.getDefaultConfig();
            this.isNewFormat = false;
            console.warn('eCLESS: Using default configuration');
            return this.config;
        }
    }

    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            hostserver: 'https://cless4.closed-loop.biz/demo',
            id: '10',
            mode: 'online',
            corsproxy: 'N',
            autostartup: 'Y',
            autoStartup: true,
            serialkey: '1d74f3eda4dd9d1065a6216c84c27d67301779b76996dc867f4403d48f9ad91e',
            timeout: 10000,
            fullscreenMode: true,
            screenTimeout: 0,
            updateInterval: 30,
            logLevel: 'info',
            brightness: 75,
            _default: true
        };
    }

    /**
     * Get configuration value with fallback
     */
    get(key, defaultValue = null) {
        if (!this.config) {
            console.warn('eCLESS: Configuration not loaded, returning default value for:', key);
            return defaultValue;
        }
        
        return this.config[key] !== undefined ? this.config[key] : defaultValue;
    }

    /**
     * Check if using new enhanced format
     */
    isEnhanced() {
        return this.isNewFormat && !this.config._legacy;
    }

    /**
     * Check if using legacy format
     */
    isLegacy() {
        return !this.isNewFormat || this.config._legacy;
    }

    /**
     * Get configuration source
     */
    getSource() {
        if (this.config._default) return 'default';
        if (this.config._legacy) return 'config.js (legacy)';
        return 'config.json (enhanced)';
    }

    /**
     * Save configuration (for enhanced format only)
     */
    async saveConfig(newConfig) {
        if (!this.isNewFormat) {
            throw new Error('Cannot save to legacy config.js format. Use enhanced config.json format.');
        }

        try {
            const fs = require('fs');
            const updatedConfig = {
                ...this.config,
                ...newConfig,
                timestamp: new Date().toISOString()
            };

            fs.writeFileSync(this.configPath, JSON.stringify(updatedConfig, null, 2));
            this.config = updatedConfig;
            console.log('eCLESS: Configuration saved successfully');
            return true;
        } catch (error) {
            console.error('eCLESS: Error saving configuration:', error);
            return false;
        }
    }

    /**
     * Get all configuration as object
     */
    getAll() {
        return { ...this.config };
    }
}

// Create global instance
window.configLoader = new ConfigLoader();

// Backward compatibility: create global config object
window.config = new Proxy({}, {
    get: function(target, property) {
        if (!window.configLoader.config) {
            console.warn('eCLESS: Config not loaded yet, use configLoader.loadConfig() first');
            return undefined;
        }
        
        // Handle special properties
        if (property === '_loader') {
            return window.configLoader;
        }
        
        return window.configLoader.get(property);
    },
    
    set: function(target, property, value) {
        console.warn('eCLESS: Direct config modification not recommended. Use configLoader.saveConfig() instead.');
        if (window.configLoader.config) {
            window.configLoader.config[property] = value;
        }
        return true;
    }
});

// Auto-load configuration when script loads
if (typeof window !== 'undefined') {
    window.configLoader.loadConfig().then(() => {
        console.log('eCLESS: Configuration loaded automatically');
        
        // Trigger custom event for other scripts
        const event = new CustomEvent('configLoaded', {
            detail: {
                config: window.configLoader.getAll(),
                source: window.configLoader.getSource(),
                isEnhanced: window.configLoader.isEnhanced()
            }
        });
        window.dispatchEvent(event);
    }).catch(error => {
        console.error('eCLESS: Auto-load configuration failed:', error);
    });
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigLoader;
}
