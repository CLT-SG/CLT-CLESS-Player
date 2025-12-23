/**
 * eCLESS Player Mobile - Layout Dimension Handler
 * 
 * This module handles layout dimensions and scaling for mobile devices.
 * It adapts desktop layout dimensions to mobile viewport constraints
 * while maintaining proper aspect ratios and visual quality.
 * 
 * @module mobile-layout-handler
 */

console.log('=== MOBILE LAYOUT HANDLER: Initializing ===');

/**
 * MobileLayoutHandler - Manages layout dimensions for mobile devices
 */
class MobileLayoutHandler {
    constructor() {
        this.layoutDimensions = null;
        this.scaleFactor = 1;
        this.isFullscreen = false;
        this.lastAppliedScale = null;
        this.lastViewportWidth = window.innerWidth;
        this.lastViewportHeight = window.innerHeight;
        this.isLayoutLocked = false; // Prevent resize handling after initial layout
        
        // Listen for orientation changes only (not resize)
        window.addEventListener('orientationchange', () => this.handleOrientationChange());
        
        console.log('[MobileLayoutHandler] Initialized - resize handling disabled to prevent viewport scale resets');
    }
    
    /**
     * Set layout bounds for mobile (adapted from desktop setBounds)
     * @param {Object} bounds - { x, y, width, height }
     * @param {boolean} autoscale - Whether to autoscale to fit viewport
     */
    setLayoutBounds(bounds, autoscale = false) {
        console.log('[MobileLayoutHandler] setLayoutBounds called:', JSON.stringify(bounds, null, 2), 'autoscale:', autoscale);
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (autoscale || !bounds.width || !bounds.height) {
            // Autoscale mode - use full viewport with default scale
            this.layoutDimensions = {
                width: viewportWidth,
                height: viewportHeight,
                x: 0,
                y: 0,
                original: bounds
            };
            this.scaleFactor = 1;
            this.isFullscreen = true;
            
            // Reset viewport to default for autoscale
            this.resetViewportScale();
            
            console.log('[MobileLayoutHandler] Using autoscale/fullscreen mode');
        } else {
            // Non-autoscale mode - calculate and apply viewport scale
            const optimalScale = this.calculateViewportScale(bounds.width, bounds.height);
            
            // Update viewport meta tag with calculated scale
            this.updateViewportScale(optimalScale);
            
            // Store layout dimensions
            this.layoutDimensions = {
                width: bounds.width,
                height: bounds.height,
                x: 0,
                y: 0,
                original: bounds
            };
            this.scaleFactor = optimalScale;
            this.isFullscreen = false;
            
            console.log('[MobileLayoutHandler] Fixed layout mode with viewport scale:', optimalScale);
            console.log('[MobileLayoutHandler] Layout dimensions:', JSON.stringify(this.layoutDimensions, null, 2));
        }
        
        // Apply dimensions to the main container
        this.applyDimensionsToContainer();
        
        // Lock layout to prevent touch-triggered viewport changes
        this.isLayoutLocked = true;
        
        // Store globally for backward compatibility
        window.layoutDimensions = this.layoutDimensions;
        
        // Emit event
        window.dispatchEvent(new CustomEvent('mobile-layout-bounds-set', {
            detail: this.layoutDimensions
        }));
        
        console.log('[MobileLayoutHandler] Layout locked - viewport scale will not change on touch');
        
        return this.layoutDimensions;
    }
    
    /**
     * Apply calculated dimensions to the main layout container
     */
    applyDimensionsToContainer() {
        const main = document.getElementById('main');
        if (!main) {
            console.warn('[MobileLayoutHandler] #main container not found');
            return;
        }
        
        if (this.isFullscreen) {
            // Fullscreen/autoscale mode - fill viewport
            main.classList.remove('fixed-layout');
            main.style.width = '100%';
            main.style.height = '100%';
            main.style.position = 'fixed';
            main.style.top = '0';
            main.style.left = '0';
            main.style.transform = 'none';
            main.style.transformOrigin = 'top left';
            
            console.log('[MobileLayoutHandler] Applied fullscreen mode to #main');
        } else {
            // Fixed layout mode - use layout dimensions with viewport scaling
            // The viewport meta tag handles the scaling, we just set the design dimensions
            main.classList.add('fixed-layout');
            main.style.width = this.layoutDimensions.width + 'px';
            main.style.height = this.layoutDimensions.height + 'px';
            main.style.position = 'fixed';
            main.style.top = '0';
            main.style.left = '0';
            main.style.transform = 'none';
            main.style.transformOrigin = 'top left';
            
            console.log('[MobileLayoutHandler] Applied fixed layout mode to #main:', 
                       this.layoutDimensions.width + 'x' + this.layoutDimensions.height);
        }
    }
    
    /**
     * Get current layout dimensions
     * @returns {Object} Current layout dimensions
     */
    getLayoutDimensions() {
        return this.layoutDimensions || {
            width: window.innerWidth,
            height: window.innerHeight,
            x: 0,
            y: 0
        };
    }
    
    /**
     * Get current scale factor
     * @returns {number} Current scale factor
     */
    getScaleFactor() {
        return this.scaleFactor;
    }
    
    /**
     * Handle orientation change
     */
    handleOrientationChange() {
        console.log('[MobileLayoutHandler] Orientation changed');
        
        // Temporarily unlock layout for orientation change
        this.isLayoutLocked = false;
        
        // Update viewport dimensions
        this.lastViewportWidth = window.innerWidth;
        this.lastViewportHeight = window.innerHeight;
        
        // Wait for resize to complete
        setTimeout(() => {
            if (this.layoutDimensions && this.layoutDimensions.original) {
                // Recalculate with new viewport dimensions
                const autoscale = this.isFullscreen;
                this.setLayoutBounds(this.layoutDimensions.original, autoscale);
            }
        }, 100);
    }
    
    /**
     * Handle window resize (disabled for mobile to prevent touch-triggered viewport resets)
     * Only processes resize if layout is unlocked (e.g., during orientation change)
     */
    handleResize() {
        // Ignore resize events if layout is locked
        if (this.isLayoutLocked) {
            console.log('[MobileLayoutHandler] Resize ignored - layout is locked to prevent viewport scale reset');
            return;
        }
        
        const currentWidth = window.innerWidth;
        const currentHeight = window.innerHeight;
        
        // Only process significant size changes (more than 100px difference)
        const widthDiff = Math.abs(currentWidth - this.lastViewportWidth);
        const heightDiff = Math.abs(currentHeight - this.lastViewportHeight);
        
        if (widthDiff < 100 && heightDiff < 100) {
            console.log('[MobileLayoutHandler] Resize ignored - change too small:', widthDiff, 'x', heightDiff);
            return;
        }
        
        console.log('[MobileLayoutHandler] Significant resize detected:', widthDiff, 'x', heightDiff);
        
        this.lastViewportWidth = currentWidth;
        this.lastViewportHeight = currentHeight;
        
        // Debounce resize handling
        clearTimeout(this._resizeTimeout);
        this._resizeTimeout = setTimeout(() => {
            if (this.layoutDimensions && this.layoutDimensions.original) {
                const autoscale = this.isFullscreen;
                this.setLayoutBounds(this.layoutDimensions.original, autoscale);
            }
        }, 250);
    }
    
    /**
     * Calculate optimal viewport scale for non-autoscale layouts
     * This ensures layout content fits properly on mobile devices
     * @param {number} layoutWidth - Layout design width
     * @param {number} layoutHeight - Layout design height
     * @returns {number} Optimal maximum-scale value
     */
    calculateViewportScale(layoutWidth, layoutHeight) {
        const deviceWidth = window.screen.width;
        const deviceHeight = window.screen.height;
        
        console.log('[MobileLayoutHandler] Calculating viewport scale:');
        console.log('  Layout dimensions:', layoutWidth, 'x', layoutHeight);
        console.log('  Device dimensions:', deviceWidth, 'x', deviceHeight);
        
        // Calculate scale factors for both dimensions
        const scaleX = deviceWidth / layoutWidth;
        const scaleY = deviceHeight / layoutHeight;
        
        // Use the smaller scale to ensure content fits
        const optimalScale = Math.min(scaleX, scaleY);
        
        // Round to 3 decimal places for precision
        const roundedScale = Math.round(optimalScale * 1000) / 1000;
        
        console.log('  Scale X:', scaleX.toFixed(3));
        console.log('  Scale Y:', scaleY.toFixed(3));
        console.log('  Optimal scale:', roundedScale);
        
        return roundedScale;
    }
    
    /**
     * Update viewport meta tag with calculated scale
     * @param {number} scale - The maximum-scale value to apply
     */
    updateViewportScale(scale) {
        // Don't reapply if scale hasn't changed
        if (this.lastAppliedScale === scale) {
            console.log('[MobileLayoutHandler] Viewport scale unchanged, skipping update:', scale);
            return;
        }
        
        let viewportMeta = document.querySelector('meta[name="viewport"]');
        
        if (!viewportMeta) {
            console.warn('[MobileLayoutHandler] Viewport meta tag not found, creating one');
            viewportMeta = document.createElement('meta');
            viewportMeta.name = 'viewport';
            document.head.appendChild(viewportMeta);
        }
        
        // Build new viewport content with calculated scale
        const viewportContent = `width=device-width, initial-scale=1.0, maximum-scale=${scale}, user-scalable=no`;
        viewportMeta.setAttribute('content', viewportContent);
        
        this.lastAppliedScale = scale;
        console.log('[MobileLayoutHandler] Viewport updated:', viewportContent);
    }
    
    /**
     * Reset viewport to default (for autoscale mode)
     */
    resetViewportScale() {
        // Don't reapply if already at default scale
        if (this.lastAppliedScale === 1.0) {
            console.log('[MobileLayoutHandler] Viewport already at default scale, skipping reset');
            return;
        }
        
        let viewportMeta = document.querySelector('meta[name="viewport"]');
        
        if (viewportMeta) {
            const viewportContent = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            viewportMeta.setAttribute('content', viewportContent);
            this.lastAppliedScale = 1.0;
            console.log('[MobileLayoutHandler] Viewport reset to default');
        }
    }
    
    /**
     * Restore viewport scale to the last applied scale
     * This is useful when viewport gets accidentally reset by user interaction
     */
    restoreViewportScale() {
        console.log('[MobileLayoutHandler] Manual viewport restore requested');
        
        if (!this.layoutDimensions || this.isFullscreen) {
            console.log('[MobileLayoutHandler] Cannot restore - no fixed layout or in fullscreen mode');
            return;
        }
        
        // Force recalculation
        const optimalScale = this.calculateViewportScale(
            this.layoutDimensions.width, 
            this.layoutDimensions.height
        );
        
        // Clear last applied scale to force update
        this.lastAppliedScale = null;
        
        // Reapply viewport scale
        this.updateViewportScale(optimalScale);
        
        console.log('[MobileLayoutHandler] Viewport scale restored to:', optimalScale);
        
        // Show notification
        this.showNotification('Viewport scale restored to ' + optimalScale);
    }
    
    /**
     * Reload the entire webview/app
     * This is useful to reset all state and fix any display issues
     * Similar to restarting the electron app on desktop
     */
    reloadWebView() {
        console.log('[MobileLayoutHandler] Webview reload requested');
        
        try {
            // Show loading indicator
            this.showNotification('Reloading app...');
            
            // Small delay to show the notification before reload
            setTimeout(() => {
                // Use standard window.location.reload() which works for:
                // - Capacitor native apps
                // - Web browsers
                // - All mobile platforms
                window.location.reload();
            }, 300);
        } catch (error) {
            console.error('[MobileLayoutHandler] Failed to reload webview:', error);
            this.showNotification('Reload failed');
        }
    }
    
    /**
     * Show a temporary notification
     * @param {string} message - Message to display
     */
    showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 70px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 100000;
            pointer-events: none;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    /**
     * Start monitoring viewport changes (detects external modifications)
     */
    startViewportMonitoring() {
        // Check viewport every 2 seconds for unexpected changes
        setInterval(() => {
            const viewportMeta = document.querySelector('meta[name="viewport"]');
            if (viewportMeta) {
                const content = viewportMeta.getAttribute('content');
                const maxScaleMatch = content.match(/maximum-scale=([0-9.]+)/);
                
                if (maxScaleMatch) {
                    const currentMaxScale = parseFloat(maxScaleMatch[1]);
                    
                    // Check if viewport was reset unexpectedly
                    if (this.lastAppliedScale && currentMaxScale !== this.lastAppliedScale && !this.isFullscreen) {
                        console.warn('[MobileLayoutHandler] Viewport scale was externally modified!');
                        console.warn('  Expected:', this.lastAppliedScale);
                        console.warn('  Current:', currentMaxScale);
                        console.warn('  Viewport content:', content);
                        
                        // Show warning notification
                        this.showNotification('Viewport scale was reset! Tap "Fix Zoom" button to restore.');
                    }
                }
            }
        }, 2000);
        
        console.log('[MobileLayoutHandler] Viewport monitoring started');
    }
    
    /**
     * Check if running on mobile
     * @returns {boolean} True if mobile environment
     */
    static isMobile() {
        return window.mobileAPI && window.mobileAPI.isNative === true ||
               window.capacitorAPI && window.capacitorAPI.isNative === true ||
               /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
}

// Create global instance
window.mobileLayoutHandler = new MobileLayoutHandler();

console.log('[MobileLayoutHandler] Global instance created');
console.log('[MobileLayoutHandler] Is mobile device:', MobileLayoutHandler.isMobile());

// Start monitoring viewport for unexpected changes
window.mobileLayoutHandler.startViewportMonitoring();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileLayoutHandler;
}
