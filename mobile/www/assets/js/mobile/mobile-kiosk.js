/**
 * eCLESS Player Mobile - Kiosk Mode Manager
 * 
 * This module enables full-screen kiosk mode for mobile devices,
 * providing a locked-down display experience similar to the Electron desktop version.
 * 
 * Features:
 * - Android immersive mode (hides status bar and navigation bar)
 * - Screen wake lock (prevents screen from sleeping)
 * - Fullscreen API integration
 * - Auto-hide navigation controls
 * - Orientation lock
 * 
 * @module mobile-kiosk
 */

console.log('=== MOBILE KIOSK MODE: Initializing ===');

class MobileKioskManager {
    constructor() {
        this.isKioskMode = false;
        this.wakeLock = null;
        this.immersiveModeInterval = null;
        this.isPlayerPage = false;
        
        // Detect if we're on the player page (index.html)
        this.isPlayerPage = window.location.pathname.includes('index.html') || 
                           window.location.pathname === '/' ||
                           window.location.pathname.endsWith('/www/');
        
        console.log('[MobileKiosk] Initialized - Player Page:', this.isPlayerPage);
    }
    
    /**
     * Enable kiosk mode with all features
     */
    async enableKioskMode() {
        console.log('[MobileKiosk] Enabling kiosk mode...');
        
        try {
            // Only enable kiosk mode on the player page
            if (!this.isPlayerPage) {
                console.log('[MobileKiosk] Not on player page, skipping kiosk mode');
                return false;
            }
            
            // 1. Enable Android immersive mode
            await this.enableImmersiveMode();
            
            // 2. Hide status bar
            await this.hideStatusBar();
            
            // 3. Request screen wake lock
            await this.requestWakeLock();
            
            // 4. Enter fullscreen
            await this.enterFullscreen();
            
            // 5. Lock orientation to landscape
            await this.lockOrientation('landscape');
            
            // 6. Hide navigation buttons on player page
            this.hideNavigationButtons();
            
            // 7. Apply kiosk CSS
            this.applyKioskCSS();
            
            // 8. Monitor and maintain immersive mode
            this.maintainImmersiveMode();
            
            this.isKioskMode = true;
            
            console.log('[MobileKiosk] Kiosk mode enabled successfully');
            
            // Emit event
            window.dispatchEvent(new CustomEvent('kiosk-mode-enabled'));
            
            return true;
        } catch (error) {
            console.error('[MobileKiosk] Failed to enable kiosk mode:', error);
            return false;
        }
    }
    
    /**
     * Disable kiosk mode and restore normal operation
     */
    async disableKioskMode() {
        console.log('[MobileKiosk] Disabling kiosk mode...');
        
        try {
            // 1. Exit fullscreen
            await this.exitFullscreen();
            
            // 2. Show status bar
            await this.showStatusBar();
            
            // 3. Release wake lock
            await this.releaseWakeLock();
            
            // 4. Unlock orientation
            await this.unlockOrientation();
            
            // 5. Show navigation buttons
            this.showNavigationButtons();
            
            // 6. Remove kiosk CSS
            this.removeKioskCSS();
            
            // 7. Stop monitoring immersive mode
            if (this.immersiveModeInterval) {
                clearInterval(this.immersiveModeInterval);
                this.immersiveModeInterval = null;
            }
            
            this.isKioskMode = false;
            
            console.log('[MobileKiosk] Kiosk mode disabled');
            
            // Emit event
            window.dispatchEvent(new CustomEvent('kiosk-mode-disabled'));
            
            return true;
        } catch (error) {
            console.error('[MobileKiosk] Failed to disable kiosk mode:', error);
            return false;
        }
    }
    
    /**
     * Enable Android immersive mode (hide system UI)
     */
    async enableImmersiveMode() {
        console.log('[MobileKiosk] Enabling Android immersive mode...');
        
        try {
            if (window.capacitorAPI && window.capacitorAPI.plugins.StatusBar) {
                // Use Capacitor StatusBar plugin
                await window.capacitorAPI.hideStatusBar();
                console.log('[MobileKiosk] Status bar hidden via Capacitor');
            }
            
            // Android-specific: Use native immersive mode if available
            if (window.AndroidFullScreen) {
                await window.AndroidFullScreen.immersiveMode();
                console.log('[MobileKiosk] Android immersive mode enabled');
            } else if (window.cordova && window.cordova.plugins && window.cordova.plugins.fullscreen) {
                await window.cordova.plugins.fullscreen.immersiveMode();
                console.log('[MobileKiosk] Cordova fullscreen plugin enabled');
            }
            
            return true;
        } catch (error) {
            console.warn('[MobileKiosk] Could not enable immersive mode:', error);
            return false;
        }
    }
    
    /**
     * Hide status bar
     */
    async hideStatusBar() {
        try {
            if (window.capacitorAPI) {
                await window.capacitorAPI.hideStatusBar();
                console.log('[MobileKiosk] Status bar hidden');
            }
            return true;
        } catch (error) {
            console.warn('[MobileKiosk] Could not hide status bar:', error);
            return false;
        }
    }
    
    /**
     * Show status bar
     */
    async showStatusBar() {
        try {
            if (window.capacitorAPI) {
                await window.capacitorAPI.showStatusBar();
                console.log('[MobileKiosk] Status bar shown');
            }
            return true;
        } catch (error) {
            console.warn('[MobileKiosk] Could not show status bar:', error);
            return false;
        }
    }
    
    /**
     * Request wake lock to keep screen on
     */
    async requestWakeLock() {
        console.log('[MobileKiosk] Requesting wake lock...');
        
        try {
            // Use modern Wake Lock API if available
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                
                this.wakeLock.addEventListener('release', () => {
                    console.log('[MobileKiosk] Wake lock released');
                });
                
                console.log('[MobileKiosk] Wake lock acquired');
                return true;
            }
            
            // Fallback: Use Capacitor KeepAwake plugin if available
            if (window.KeepAwake) {
                await window.KeepAwake.keepAwake();
                console.log('[MobileKiosk] Keep awake enabled (Capacitor plugin)');
                return true;
            }
            
            console.warn('[MobileKiosk] Wake Lock API not available');
            return false;
        } catch (error) {
            console.warn('[MobileKiosk] Could not request wake lock:', error);
            return false;
        }
    }
    
    /**
     * Release wake lock
     */
    async releaseWakeLock() {
        try {
            if (this.wakeLock) {
                await this.wakeLock.release();
                this.wakeLock = null;
                console.log('[MobileKiosk] Wake lock released');
            }
            
            if (window.KeepAwake) {
                await window.KeepAwake.allowSleep();
                console.log('[MobileKiosk] Keep awake disabled');
            }
            
            return true;
        } catch (error) {
            console.warn('[MobileKiosk] Could not release wake lock:', error);
            return false;
        }
    }
    
    /**
     * Enter fullscreen mode
     */
    async enterFullscreen() {
        console.log('[MobileKiosk] Entering fullscreen...');
        
        try {
            const element = document.documentElement;
            
            if (element.requestFullscreen) {
                await element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                await element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                await element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                await element.msRequestFullscreen();
            }
            
            console.log('[MobileKiosk] Fullscreen enabled');
            return true;
        } catch (error) {
            console.warn('[MobileKiosk] Could not enter fullscreen:', error);
            return false;
        }
    }
    
    /**
     * Exit fullscreen mode
     */
    async exitFullscreen() {
        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                await document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                await document.msExitFullscreen();
            }
            
            console.log('[MobileKiosk] Fullscreen exited');
            return true;
        } catch (error) {
            console.warn('[MobileKiosk] Could not exit fullscreen:', error);
            return false;
        }
    }
    
    /**
     * Lock device orientation
     */
    async lockOrientation(orientation = 'landscape') {
        console.log('[MobileKiosk] Locking orientation to:', orientation);
        
        try {
            // Modern Screen Orientation API
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock(orientation);
                console.log('[MobileKiosk] Orientation locked to:', orientation);
                return true;
            }
            
            // Fallback for older browsers
            if (screen.lockOrientation) {
                screen.lockOrientation(orientation);
                return true;
            } else if (screen.mozLockOrientation) {
                screen.mozLockOrientation(orientation);
                return true;
            } else if (screen.msLockOrientation) {
                screen.msLockOrientation(orientation);
                return true;
            }
            
            console.warn('[MobileKiosk] Orientation lock not supported');
            return false;
        } catch (error) {
            console.warn('[MobileKiosk] Could not lock orientation:', error);
            return false;
        }
    }
    
    /**
     * Unlock device orientation
     */
    async unlockOrientation() {
        try {
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            } else if (screen.unlockOrientation) {
                screen.unlockOrientation();
            } else if (screen.mozUnlockOrientation) {
                screen.mozUnlockOrientation();
            } else if (screen.msUnlockOrientation) {
                screen.msUnlockOrientation();
            }
            
            console.log('[MobileKiosk] Orientation unlocked');
            return true;
        } catch (error) {
            console.warn('[MobileKiosk] Could not unlock orientation:', error);
            return false;
        }
    }
    
    /**
     * Hide navigation buttons (for player page only)
     * Note: In kiosk mode, navigation is hidden by default via CSS
     * but can still be shown via the auto-hide system in index.html
     */
    hideNavigationButtons() {
        const nav = document.getElementById('mobile-nav');
        if (nav && this.isPlayerPage) {
            // Don't use display:none - use the same approach as auto-hide
            nav.style.opacity = '0';
            nav.style.transform = 'translateY(-20px)';
            nav.classList.remove('nav-visible');
            console.log('[MobileKiosk] Navigation buttons hidden (via opacity)');
        }
    }
    
    /**
     * Show navigation buttons
     */
    showNavigationButtons() {
        const nav = document.getElementById('mobile-nav');
        if (nav) {
            // Use the same approach as auto-hide
            nav.style.opacity = '1';
            nav.style.transform = 'translateY(0)';
            nav.classList.add('nav-visible');
            console.log('[MobileKiosk] Navigation buttons shown');
        }
    }
    
    /**
     * Apply CSS for kiosk mode
     */
    applyKioskCSS() {
        console.log('[MobileKiosk] Applying kiosk CSS...');
        
        // Create style element if it doesn't exist
        let styleEl = document.getElementById('mobile-kiosk-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'mobile-kiosk-styles';
            document.head.appendChild(styleEl);
        }
        
        // Comprehensive kiosk mode CSS
        styleEl.textContent = `
            /* Kiosk Mode Full-Screen Styles */
            html.kiosk-mode,
            html.kiosk-mode body {
                width: 100vw !important;
                height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
            }
            
            /* Prevent scrolling and zooming */
            html.kiosk-mode body {
                overscroll-behavior: none !important;
                touch-action: none !important;
                -webkit-overflow-scrolling: touch !important;
            }
            
            /* Hide scrollbars completely */
            html.kiosk-mode ::-webkit-scrollbar {
                display: none !important;
                width: 0 !important;
                height: 0 !important;
            }
            
            html.kiosk-mode * {
                scrollbar-width: none !important;
                -ms-overflow-style: none !important;
            }
            
            /* Main container full coverage */
            html.kiosk-mode #main {
                width: 100vw !important;
                height: 100vh !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                overflow: hidden !important;
                z-index: 1 !important;
            }
            
            /* Ensure player content fills screen */
            html.kiosk-mode #player-container,
            html.kiosk-mode .player-wrapper {
                width: 100% !important;
                height: 100% !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
            }
            
            /* Mobile navigation in kiosk mode - allow auto-hide behavior */
            html.kiosk-mode #mobile-nav {
                /* Don't use display:none - it breaks the auto-hide system */
                /* The auto-hide system in index.html uses opacity and transform */
                /* Start hidden but allow the auto-hide system to show it */
                opacity: 0 !important;
                transform: translateY(-20px) !important;
                pointer-events: auto !important;
                /* Ensure smooth transitions */
                transition: opacity 0.3s ease, transform 0.3s ease !important;
            }
            
            /* When navigation is shown by auto-hide system */
            html.kiosk-mode #mobile-nav.nav-visible {
                opacity: 1 !important;
                transform: translateY(0) !important;
            }
            
            /* Remove all user interface chrome */
            html.kiosk-mode {
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
                user-select: none !important;
                -webkit-tap-highlight-color: transparent !important;
                -webkit-touch-callout: none !important;
            }
            
            /* Prevent pull-to-refresh */
            html.kiosk-mode body {
                overscroll-behavior-y: contain !important;
            }
            
            /* Force hardware acceleration */
            html.kiosk-mode #main,
            html.kiosk-mode body {
                -webkit-transform: translateZ(0) !important;
                transform: translateZ(0) !important;
                will-change: transform !important;
            }
            
            /* Ensure video elements fill space */
            html.kiosk-mode video,
            html.kiosk-mode .video-js {
                object-fit: cover !important;
            }
        `;
        
        // Add kiosk-mode class to html element
        document.documentElement.classList.add('kiosk-mode');
        
        console.log('[MobileKiosk] Kiosk CSS applied');
    }
    
    /**
     * Remove kiosk CSS
     */
    removeKioskCSS() {
        const styleEl = document.getElementById('mobile-kiosk-styles');
        if (styleEl) {
            styleEl.remove();
        }
        
        document.documentElement.classList.remove('kiosk-mode');
        
        console.log('[MobileKiosk] Kiosk CSS removed');
    }
    
    /**
     * Maintain immersive mode by re-applying it periodically
     * (Some Android versions lose immersive mode on user interaction)
     */
    maintainImmersiveMode() {
        console.log('[MobileKiosk] Starting immersive mode maintenance...');
        
        // Re-apply immersive mode every 3 seconds
        this.immersiveModeInterval = setInterval(async () => {
            if (this.isKioskMode) {
                await this.enableImmersiveMode();
            }
        }, 3000);
        
        // Also re-apply on visibility change
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden && this.isKioskMode) {
                console.log('[MobileKiosk] Page visible, re-applying immersive mode');
                await this.enableImmersiveMode();
            }
        });
        
        // Re-apply on touch/click (Android sometimes exits immersive on interaction)
        ['touchstart', 'click'].forEach(eventType => {
            document.addEventListener(eventType, async () => {
                if (this.isKioskMode) {
                    // Debounce to avoid too frequent calls
                    clearTimeout(this._immersiveDebounce);
                    this._immersiveDebounce = setTimeout(async () => {
                        await this.enableImmersiveMode();
                    }, 500);
                }
            }, { passive: true });
        });
    }
    
    /**
     * Toggle kiosk mode
     */
    async toggleKioskMode() {
        if (this.isKioskMode) {
            return await this.disableKioskMode();
        } else {
            return await this.enableKioskMode();
        }
    }
    
    /**
     * Get current kiosk mode status
     */
    getStatus() {
        return {
            isKioskMode: this.isKioskMode,
            isPlayerPage: this.isPlayerPage,
            hasWakeLock: this.wakeLock !== null,
            isFullscreen: document.fullscreenElement !== null
        };
    }
}

// Create global instance
window.mobileKiosk = new MobileKioskManager();

// Auto-enable kiosk mode when on player page and app is ready
window.addEventListener('appReady', async () => {
    console.log('[MobileKiosk] App ready event received');
    
    // Small delay to ensure everything is loaded
    setTimeout(async () => {
        if (window.mobileKiosk.isPlayerPage) {
            console.log('[MobileKiosk] Auto-enabling kiosk mode on player page');
            await window.mobileKiosk.enableKioskMode();
        }
    }, 1000);
});

// Also try to enable when page loads (fallback)
if (document.readyState === 'complete') {
    setTimeout(async () => {
        if (window.mobileKiosk.isPlayerPage && !window.mobileKiosk.isKioskMode) {
            console.log('[MobileKiosk] Auto-enabling kiosk mode (fallback trigger)');
            await window.mobileKiosk.enableKioskMode();
        }
    }, 2000);
} else {
    window.addEventListener('load', () => {
        setTimeout(async () => {
            if (window.mobileKiosk.isPlayerPage && !window.mobileKiosk.isKioskMode) {
                console.log('[MobileKiosk] Auto-enabling kiosk mode on page load');
                await window.mobileKiosk.enableKioskMode();
            }
        }, 2000);
    });
}

console.log('[MobileKiosk] Module loaded - Kiosk manager available as window.mobileKiosk');
