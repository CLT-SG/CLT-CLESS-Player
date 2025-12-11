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
import { Capacitor, CapacitorHttp } from '@capacitor/core';
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
            SplashScreen,
            CapacitorHttp
        };
        
        console.log(`eCLESS Mobile: Running on ${this.platform} (native: ${this.isNative})`);
    }

    /**
     * Get device information including unique identifiers
     */
    async getDeviceInfo() {
        try {
            const info = await Device.getInfo();
            const id = await Device.getId();
            const batteryInfo = await Device.getBatteryInfo();
            
            return {
                ...info,
                uuid: id.identifier || id.uuid,
                identifier: id.identifier || id.uuid,
                androidId: info.androidId || null,
                battery: batteryInfo,
                platform: this.platform,
                isNative: this.isNative
            };
        } catch (error) {
            console.error('Failed to get device info:', error);
            // Return fallback info
            return {
                uuid: null,
                identifier: null,
                androidId: null,
                platform: this.platform,
                model: 'Unknown',
                manufacturer: 'Unknown',
                isNative: this.isNative,
                battery: null
            };
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
    async readFile(path, directory = Directory.Data) {
        try {
            const targetDir = directory || Directory.Data;
            const result = await Filesystem.readFile({
                path,
                directory: targetDir,
                encoding: Encoding.UTF8
            });
            return result.data;
        } catch (error) {
            console.error(`Failed to read file ${path} from ${directory}:`, error);
            throw error;
        }
    }

    /**
     * Write file to device storage
     */
    async writeFile(path, data, directory = Directory.Data) {
        try {
            const targetDir = directory || Directory.Data;
            console.log(`Writing file to ${targetDir}: ${path}`);
            await Filesystem.writeFile({
                path,
                data,
                directory: targetDir,
                encoding: Encoding.UTF8,
                recursive: true
            });
            console.log(`Successfully wrote file to ${targetDir}: ${path}`);
            return true;
        } catch (error) {
            console.error(`Failed to write file ${path} to ${directory}:`, error);
            console.error('Error details:', error.message, error.code);
            throw error;
        }
    }

    /**
     * Check if file exists
     */
    async fileExists(path, directory = Directory.Data) {
        try {
            const targetDir = directory || Directory.Data;
            await Filesystem.stat({
                path,
                directory: targetDir
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Delete file
     */
    async deleteFile(path, directory = Directory.Data) {
        try {
            const targetDir = directory || Directory.Data;
            await Filesystem.deleteFile({
                path,
                directory: targetDir
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
    async createDirectory(path, directory = Directory.Data) {
        try {
            const targetDir = directory || Directory.Data;
            await Filesystem.mkdir({
                path,
                directory: targetDir,
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
    async readDirectory(path, directory = Directory.Data) {
        try {
            const targetDir = directory || Directory.Data;
            const result = await Filesystem.readdir({
                path,
                directory: targetDir
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
     * Kiosk mode and full-screen controls
     */
    async enableKioskMode() {
        console.log('CapacitorAPI: Enabling kiosk mode...');
        
        try {
            // Hide status bar
            await this.hideStatusBar();
            
            // Request fullscreen (HTML5 Fullscreen API)
            const element = document.documentElement;
            if (element.requestFullscreen) {
                await element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                await element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                await element.mozRequestFullScreen();
            }
            
            console.log('CapacitorAPI: Kiosk mode enabled');
            return true;
        } catch (error) {
            console.warn('CapacitorAPI: Failed to enable kiosk mode:', error);
            return false;
        }
    }
    
    async disableKioskMode() {
        console.log('CapacitorAPI: Disabling kiosk mode...');
        
        try {
            // Show status bar
            await this.showStatusBar();
            
            // Exit fullscreen
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                await document.mozCancelFullScreen();
            }
            
            console.log('CapacitorAPI: Kiosk mode disabled');
            return true;
        } catch (error) {
            console.warn('CapacitorAPI: Failed to disable kiosk mode:', error);
            return false;
        }
    }
    
    /**
     * Keep screen awake (prevent sleep)
     */
    async keepScreenAwake() {
        console.log('CapacitorAPI: Requesting screen wake lock...');
        
        try {
            if ('wakeLock' in navigator) {
                const wakeLock = await navigator.wakeLock.request('screen');
                console.log('CapacitorAPI: Screen wake lock acquired');
                return wakeLock;
            } else {
                console.warn('CapacitorAPI: Wake Lock API not supported');
                return null;
            }
        } catch (error) {
            console.warn('CapacitorAPI: Failed to acquire wake lock:', error);
            return null;
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

// Add Directory enum to capacitorAPI for easy access
capacitorAPI.Directory = Directory;

// Make it globally accessible
window.capacitor = Capacitor;
window.capacitorAPI = capacitorAPI;
window.CapacitorDirectory = Directory; // Also expose Directory enum globally

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
