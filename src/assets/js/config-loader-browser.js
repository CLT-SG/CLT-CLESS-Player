/**
 * eCLESS Player Configuration Loader - Browser Compatible Version
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
     * Browser-compatible version that uses fetch API and IPC
     */
    async loadConfig() {
        try {
            // First try to get configuration from main process via IPC (preferred method in Electron)
            if (window.electronAPI && window.electronAPI.getConfiguration) {
                try {
                    console.log('eCLESS: Requesting configuration from main process via IPC...')
                    const config = await window.electronAPI.getConfiguration()
                    if (config) {
                        this.config = config
                        this.isNewFormat = true
                        console.log('eCLESS: Successfully loaded configuration from main process')
                        return this.config
                    }
                } catch (error) {
                    console.warn('eCLESS: Failed to get config from main process, falling back to HTTP:', error)
                }
            }

            // Fallback to HTTP API endpoints
            try {
                const response = await fetch('/api/config')
                if (response.ok) {
                    this.config = await response.json()
                    this.isNewFormat = true
                    console.log('eCLESS: Successfully loaded configuration from HTTP API')
                    return this.config
                }
            } catch (error) {
                console.warn('eCLESS: Failed to load config from HTTP API:', error)
            }

            // Default configuration if all else fails
            console.log('eCLESS: Using default configuration')
            this.config = this.getDefaultConfig()
            return this.config

        } catch (error) {
            console.error('eCLESS: Error loading configuration:', error)
            // Return default configuration as fallback
            this.config = this.getDefaultConfig()
            return this.config
        }
    }

    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            server: {
                port: 9000,
                host: 'localhost',
                ssl: false
            },
            display: {
                fullscreen: false,
                brightness: 50,
                timeout: 0
            },
            system: {
                autoStart: false,
                updateInterval: 30,
                logLevel: 'info'
            },
            layout: {
                current: null,
                slots: []
            },
            text: {
                slots: []
            },
            media: {
                slots: [],
                files: []
            }
        }
    }

    /**
     * Save configuration
     */
    async saveConfig(newConfig) {
        try {
            if (window.electronAPI && window.electronAPI.saveConfiguration) {
                await window.electronAPI.saveConfiguration(newConfig)
                this.config = newConfig
                console.log('eCLESS: Configuration saved successfully')
                return true
            }

            // Fallback to HTTP API
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newConfig)
            })

            if (response.ok) {
                this.config = newConfig
                console.log('eCLESS: Configuration saved successfully via HTTP API')
                return true
            }

            throw new Error('Failed to save configuration')
        } catch (error) {
            console.error('eCLESS: Error saving configuration:', error)
            return false
        }
    }

    /**
     * Get configuration value by path
     */
    get(path, defaultValue = null) {
        if (!this.config) return defaultValue
        
        const keys = path.split('.')
        let value = this.config
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key]
            } else {
                return defaultValue
            }
        }
        
        return value
    }

    /**
     * Set configuration value by path
     */
    set(path, value) {
        if (!this.config) this.config = {}
        
        const keys = path.split('.')
        let current = this.config
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i]
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {}
            }
            current = current[key]
        }
        
        current[keys[keys.length - 1]] = value
    }

    /**
     * Check if configuration is loaded
     */
    isLoaded() {
        return this.config !== null
    }

    /**
     * Get full configuration
     */
    getConfig() {
        return this.config
    }
}

// Create global instance
window.configLoader = new ConfigLoader()

// Auto-load configuration when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await window.configLoader.loadConfig()
            console.log('eCLESS: Configuration loaded on DOM ready')
        } catch (error) {
            console.error('eCLESS: Failed to auto-load configuration:', error)
        }
    })
} else {
    // DOM already loaded
    window.configLoader.loadConfig().then(() => {
        console.log('eCLESS: Configuration loaded immediately')
    }).catch(error => {
        console.error('eCLESS: Failed to load configuration:', error)
    })
}
