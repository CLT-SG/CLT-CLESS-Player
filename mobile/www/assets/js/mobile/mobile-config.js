/**
 * eCLESS Player Mobile - Configuration Loader
 * 
 * This module handles configuration loading for mobile devices using Capacitor Filesystem API.
 * It replaces the Electron-based config loading with a mobile-friendly implementation.
 * 
 * Configuration sources (in order of priority):
 * 1. config.json in app's Documents directory
 * 2. Default embedded configuration
 * 
 * @module mobile-config
 */

console.log('=== MOBILE CONFIG: Initializing configuration loader ===');

/**
 * Mobile Configuration Loader Class
 */
class MobileConfigLoader {
    constructor() {
        this.config = null;
        this.configPath = 'ecless/config.json';
        this.defaultConfig = this.getDefaultConfig();
        this.loadPromise = null;
    }

    /**
     * Default configuration for mobile devices
     */
    getDefaultConfig() {
        return {
            version: '2.6.5',
            hostserver: 'https://cless4.closed-loop.biz',
            id: '20',
            mode: 'online',
            corsproxy: 'N',
            syncSettings: {
                enabled: false,
                role: 'none',
                masterIp: '',
                syncInterval: 5000,
                syncPort: 9000
            },
            masterServerAddress: 'localhost',
            masterServerPort: 9000,
            licenseKey: '',
            displaySettings: {
                orientation: 'landscape',
                fullscreen: true,
                hideStatusBar: true
            },
            networkSettings: {
                timeout: 5000,
                retryAttempts: 3,
                offlineMode: true
            }
        };
    }

    /**
     * Wait for Capacitor to be ready before loading config
     */
    async waitForCapacitor() {
        console.log('MobileConfig: Waiting for Capacitor initialization...');
        
        // Check if already initialized
        if (window.capacitorAPI) {
            console.log('MobileConfig: Capacitor API already available');
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            // Set up event listener for capacitorReady
            const onCapacitorReady = () => {
                console.log('MobileConfig: Capacitor ready event received');
                resolve();
            };
            
            window.addEventListener('capacitorReady', onCapacitorReady, { once: true });

            // Timeout fallback with better error handling
            setTimeout(() => {
                if (!window.capacitorAPI) {
                    console.error('MobileConfig: Capacitor initialization timeout!');
                    console.error('MobileConfig: Proceeding with web-only mode (limited functionality)');
                    
                    // Create minimal stub for web-only operation
                    window.capacitorAPI = {
                        isNative: false,
                        platform: 'web',
                        fileExists: async () => false,
                        readFile: async () => { throw new Error('File system not available in web mode'); },
                        writeFile: async () => { throw new Error('File system not available in web mode'); }
                    };
                }
                resolve();
            }, 10000); // Increased timeout to 10 seconds
        });
    }

    /**
     * Load configuration from device storage or use defaults
     */
    async loadConfiguration() {
        console.log('MobileConfig: Loading configuration...');

        try {
            // Wait for Capacitor to be ready
            await this.waitForCapacitor();

            // Try to load from filesystem
            if (window.capacitorAPI && window.capacitorAPI.isNative) {
                const exists = await window.capacitorAPI.fileExists(this.configPath);
                
                if (exists) {
                    console.log('MobileConfig: Found existing config.json');
                    const configData = await window.capacitorAPI.readFile(this.configPath);
                    this.config = JSON.parse(configData);
                    console.log('MobileConfig: Loaded configuration from device storage');
                } else {
                    console.log('MobileConfig: No config.json found, using defaults');
                    this.config = { ...this.defaultConfig };
                    
                    // Save default config for future use
                    await this.saveConfiguration(this.config);
                }
            } else {
                // Web fallback - use localStorage
                console.log('MobileConfig: Running in web mode, using localStorage');
                const storedConfig = localStorage.getItem('ecless-config');
                
                if (storedConfig) {
                    this.config = JSON.parse(storedConfig);
                    console.log('MobileConfig: Loaded configuration from localStorage');
                } else {
                    this.config = { ...this.defaultConfig };
                    localStorage.setItem('ecless-config', JSON.stringify(this.config));
                    console.log('MobileConfig: Initialized default configuration');
                }
            }

            // Validate and merge with defaults
            this.config = this.validateAndMergeConfig(this.config);

            // Make config globally available
            window.config = this.config;
            window.configLoader = this;

            // Dispatch config loaded event
            window.dispatchEvent(new CustomEvent('configLoaded', {
                detail: {
                    source: 'mobile-storage',
                    config: this.config
                }
            }));

            console.log('MobileConfig: Configuration loaded successfully', this.config);
            return this.config;

        } catch (error) {
            console.error('MobileConfig: Error loading configuration:', error);
            
            // Fallback to default config
            this.config = { ...this.defaultConfig };
            window.config = this.config;
            
            window.dispatchEvent(new CustomEvent('configLoaded', {
                detail: {
                    source: 'default-fallback',
                    config: this.config,
                    error: error.message
                }
            }));

            return this.config;
        }
    }

    /**
     * Validate and merge config with defaults
     */
    validateAndMergeConfig(loadedConfig) {
        const merged = { ...this.defaultConfig };

        // Merge loaded config, preserving structure
        for (const key in loadedConfig) {
            if (typeof loadedConfig[key] === 'object' && !Array.isArray(loadedConfig[key])) {
                merged[key] = { ...merged[key], ...loadedConfig[key] };
            } else {
                merged[key] = loadedConfig[key];
            }
        }

        return merged;
    }

    /**
     * Save configuration to device storage
     */
    async saveConfiguration(config) {
        console.log('MobileConfig: Saving configuration...');

        try {
            this.config = config;

            if (window.capacitorAPI && window.capacitorAPI.isNative) {
                // Save to filesystem
                await window.capacitorAPI.writeFile(
                    this.configPath,
                    JSON.stringify(config, null, 2)
                );
                console.log('MobileConfig: Configuration saved to device storage');
            } else {
                // Web fallback - use localStorage
                localStorage.setItem('ecless-config', JSON.stringify(config));
                console.log('MobileConfig: Configuration saved to localStorage');
            }

            // Update global config
            window.config = config;

            // Dispatch config updated event
            window.dispatchEvent(new CustomEvent('configUpdated', {
                detail: { config }
            }));

            return true;

        } catch (error) {
            console.error('MobileConfig: Error saving configuration:', error);
            throw error;
        }
    }

    /**
     * Get specific config value
     */
    get(key, defaultValue = null) {
        if (!this.config) {
            console.warn('MobileConfig: Configuration not loaded yet');
            return defaultValue;
        }

        return this.config[key] !== undefined ? this.config[key] : defaultValue;
    }

    /**
     * Get all configuration values
     */
    getAll() {
        if (!this.config) {
            console.warn('MobileConfig: Configuration not loaded yet, returning defaults');
            return { ...this.defaultConfig };
        }
        
        return { ...this.config };
    }

    /**
     * Set specific config value
     */
    async set(key, value) {
        if (!this.config) {
            await this.loadConfiguration();
        }

        this.config[key] = value;
        await this.saveConfiguration(this.config);
    }

    /**
     * Reset to default configuration
     */
    async resetToDefaults() {
        console.log('MobileConfig: Resetting to default configuration');
        this.config = { ...this.defaultConfig };
        await this.saveConfiguration(this.config);
        return this.config;
    }
}

// Initialize the configuration loader
const mobileConfigLoader = new MobileConfigLoader();

// Make it globally accessible
window.mobileConfigLoader = mobileConfigLoader;
window.configLoader = mobileConfigLoader; // Alias for compatibility

// Auto-load configuration with proper error handling
(async function initConfig() {
    console.log('=== MOBILE CONFIG: Auto-loading configuration ===');
    
    try {
        // Show loading indicator
        if (document.body) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'mobile-config-loading';
            loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px;border-radius:10px;z-index:999999;text-align:center;';
            loadingDiv.innerHTML = '<div style="font-size:18px;margin-bottom:10px;">⚙️ Initializing eCLESS Player</div><div style="font-size:14px;color:#aaa;">Loading configuration...</div>';
            document.body.appendChild(loadingDiv);
        }
        
        await mobileConfigLoader.loadConfiguration();
        
        console.log('=== MOBILE CONFIG: Configuration loaded successfully ===');
        
        // Dispatch loaded event for app initialization
        window.dispatchEvent(new CustomEvent('configLoaded', {
            detail: {
                config: mobileConfigLoader.config,
                source: mobileConfigLoader.config ? 'storage' : 'default'
            }
        }));
        
        // Remove loading indicator
        const loadingDiv = document.getElementById('mobile-config-loading');
        if (loadingDiv) {
            setTimeout(() => loadingDiv.remove(), 500);
        }
        
    } catch (error) {
        console.error('=== MOBILE CONFIG: Failed to auto-load configuration ===', error);
        
        // Show error message to user
        if (document.body) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#dc3545;color:white;padding:20px;border-radius:10px;z-index:999999;text-align:center;max-width:80%;';
            errorDiv.innerHTML = `
                <div style="font-size:18px;margin-bottom:10px;">⚠️ Configuration Error</div>
                <div style="font-size:14px;margin-bottom:15px;">${error.message || 'Failed to load configuration'}</div>
                <button onclick="location.href='configure.html'" style="background:white;color:#dc3545;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;font-weight:bold;">
                    Configure Now
                </button>
            `;
            
            // Remove loading indicator
            const loadingDiv = document.getElementById('mobile-config-loading');
            if (loadingDiv) loadingDiv.remove();
            
            document.body.appendChild(errorDiv);
            
            // Auto-hide after 10 seconds
            setTimeout(() => errorDiv.remove(), 10000);
        }
        
        // Still dispatch event with default config for graceful degradation
        window.dispatchEvent(new CustomEvent('configLoaded', {
            detail: {
                config: mobileConfigLoader.defaultConfig,
                source: 'default',
                error: error.message
            }
        }));
    }
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = mobileConfigLoader;
}
