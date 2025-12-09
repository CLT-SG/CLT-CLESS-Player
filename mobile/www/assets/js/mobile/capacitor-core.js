/**
 * eCLESS Player Mobile - Capacitor Core Module
 * 
 * This module initializes and exposes Capacitor plugins as a unified API
 * for the mobile version of eCLESS Player. It replaces Electron's native APIs
 * with Capacitor equivalents for cross-platform mobile support.
 * 
 * @module capacitor-core
 */

// Import Capacitor Core and Plugins
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

console.log('=== CAPACITOR CORE: Initializing ===');

/**
 * Capacitor API Wrapper
 * Provides a unified interface for mobile-specific functionality
 */
class CapacitorAPI {
    constructor() {
        this.platform = Capacitor.getPlatform();
        this.isNative = Capacitor.isNativePlatform();
        this.plugins = {
            App,
            Device,
            Network,
            Filesystem,
            Preferences,
            StatusBar,
            SplashScreen
        };
        
        console.log(`eCLESS Mobile: Running on ${this.platform} (native: ${this.isNative})`);
    }

    /**
     * Get device information
     */
    async getDeviceInfo() {
        try {
            const info = await Device.getInfo();
            const batteryInfo = await Device.getBatteryInfo();
            return {
                ...info,
                battery: batteryInfo
            };
        } catch (error) {
            console.error('Failed to get device info:', error);
            return null;
        }
    }

    /**
     * Get network status
     */
    async getNetworkStatus() {
        try {
            return await Network.getStatus();
        } catch (error) {
            console.error('Failed to get network status:', error);
            return { connected: false, connectionType: 'unknown' };
        }
    }

    /**
     * Listen for network changes
     */
    addNetworkListener(callback) {
        return Network.addListener('networkStatusChange', callback);
    }

    /**
     * Read file from device storage
     */
    async readFile(path, directory = Directory.Documents) {
        try {
            const result = await Filesystem.readFile({
                path,
                directory,
                encoding: Encoding.UTF8
            });
            return result.data;
        } catch (error) {
            console.error(`Failed to read file ${path}:`, error);
            throw error;
        }
    }

    /**
     * Write file to device storage
     */
    async writeFile(path, data, directory = Directory.Documents) {
        try {
            await Filesystem.writeFile({
                path,
                data,
                directory,
                encoding: Encoding.UTF8,
                recursive: true
            });
            return true;
        } catch (error) {
            console.error(`Failed to write file ${path}:`, error);
            throw error;
        }
    }

    /**
     * Check if file exists
     */
    async fileExists(path, directory = Directory.Documents) {
        try {
            await Filesystem.stat({
                path,
                directory
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Delete file
     */
    async deleteFile(path, directory = Directory.Documents) {
        try {
            await Filesystem.deleteFile({
                path,
                directory
            });
            return true;
        } catch (error) {
            console.error(`Failed to delete file ${path}:`, error);
            throw error;
        }
    }

    /**
     * Create directory
     */
    async createDirectory(path, directory = Directory.Documents) {
        try {
            await Filesystem.mkdir({
                path,
                directory,
                recursive: true
            });
            return true;
        } catch (error) {
            console.error(`Failed to create directory ${path}:`, error);
            throw error;
        }
    }

    /**
     * List directory contents
     */
    async readDirectory(path, directory = Directory.Documents) {
        try {
            const result = await Filesystem.readdir({
                path,
                directory
            });
            return result.files;
        } catch (error) {
            console.error(`Failed to read directory ${path}:`, error);
            throw error;
        }
    }

    /**
     * Get/Set preferences (key-value storage)
     */
    async getPreference(key) {
        try {
            const { value } = await Preferences.get({ key });
            return value;
        } catch (error) {
            console.error(`Failed to get preference ${key}:`, error);
            return null;
        }
    }

    async setPreference(key, value) {
        try {
            await Preferences.set({ key, value });
            return true;
        } catch (error) {
            console.error(`Failed to set preference ${key}:`, error);
            return false;
        }
    }

    async removePreference(key) {
        try {
            await Preferences.remove({ key });
            return true;
        } catch (error) {
            console.error(`Failed to remove preference ${key}:`, error);
            return false;
        }
    }

    /**
     * App lifecycle methods
     */
    addAppStateListener(callback) {
        return App.addListener('appStateChange', callback);
    }

    addAppUrlListener(callback) {
        return App.addListener('appUrlOpen', callback);
    }

    addBackButtonListener(callback) {
        return App.addListener('backButton', callback);
    }

    async exitApp() {
        if (this.isNative) {
            await App.exitApp();
        }
    }

    /**
     * Screen orientation (using CSS approach for Capacitor 6)
     * For Capacitor 8+, install @capacitor/screen-orientation plugin
     */
    async lockOrientation(orientation = 'landscape') {
        try {
            // Use CSS orientation lock for Capacitor 6
            // Set in capacitor.config.json or AndroidManifest.xml/Info.plist
            console.log(`Screen orientation lock to ${orientation} should be configured in capacitor.config.json`);
            
            // Add CSS media query support
            const style = document.createElement('style');
            style.textContent = `
                @media screen and (orientation: portrait) {
                    html { transform: rotate(-90deg); transform-origin: left top; width: 100vh; height: 100vw; overflow-x: hidden; position: absolute; top: 100%; left: 0; }
                }
            `;
            document.head.appendChild(style);
        } catch (error) {
            console.warn('Failed to lock orientation:', error);
        }
    }

    async unlockOrientation() {
        console.log('Orientation unlock - remove any custom CSS transforms');
    }

    /**
     * Status bar control
     */
    async hideStatusBar() {
        try {
            await StatusBar.hide();
        } catch (error) {
            console.warn('Failed to hide status bar:', error);
        }
    }

    async showStatusBar() {
        try {
            await StatusBar.show();
        } catch (error) {
            console.warn('Failed to show status bar:', error);
        }
    }

    async setStatusBarStyle(style = Style.Dark) {
        try {
            await StatusBar.setStyle({ style });
        } catch (error) {
            console.warn('Failed to set status bar style:', error);
        }
    }

    /**
     * Splash screen
     */
    async hideSplashScreen() {
        try {
            await SplashScreen.hide();
        } catch (error) {
            console.warn('Failed to hide splash screen:', error);
        }
    }
}

// Initialize and expose global Capacitor API
const capacitorAPI = new CapacitorAPI();

// Make it globally accessible
window.capacitor = Capacitor;
window.capacitorAPI = capacitorAPI;

// Mobile-specific initialization
(async function initMobile() {
    console.log('=== CAPACITOR CORE: Mobile initialization started ===');

    try {
        // Get device info
        const deviceInfo = await capacitorAPI.getDeviceInfo();
        console.log('Device Info:', deviceInfo);

        // Get network status
        const networkStatus = await capacitorAPI.getNetworkStatus();
        console.log('Network Status:', networkStatus);

        // Set up network monitoring
        capacitorAPI.addNetworkListener((status) => {
            console.log('Network status changed:', status);
            
            // Dispatch custom event for app to handle
            window.dispatchEvent(new CustomEvent('networkStatusChange', {
                detail: status
            }));
        });

        // Hide splash screen after initialization
        await capacitorAPI.hideSplashScreen();

        // Set status bar style for dark theme
        await capacitorAPI.setStatusBarStyle(Style.Dark);

        // Handle back button for Android
        if (capacitorAPI.platform === 'android') {
            capacitorAPI.addBackButtonListener((event) => {
                console.log('Back button pressed');
                
                // Check if we can go back in history
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    // Exit app or show exit confirmation
                    const shouldExit = confirm('Exit eCLESS Player?');
                    if (shouldExit) {
                        capacitorAPI.exitApp();
                    }
                }
            });
        }

        console.log('=== CAPACITOR CORE: Initialization complete ===');

        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('capacitorReady', {
            detail: {
                platform: capacitorAPI.platform,
                isNative: capacitorAPI.isNative,
                deviceInfo,
                networkStatus
            }
        }));

    } catch (error) {
        console.error('Mobile initialization error:', error);
    }
})();

// Export for module systems
export { capacitorAPI, Capacitor };
export default capacitorAPI;
