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
        
        // Listen for orientation changes
        window.addEventListener('orientationchange', () => this.handleOrientationChange());
        window.addEventListener('resize', () => this.handleResize());
        
        console.log('[MobileLayoutHandler] Initialized');
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
        
        // Store globally for backward compatibility
        window.layoutDimensions = this.layoutDimensions;
        
        // Emit event
        window.dispatchEvent(new CustomEvent('mobile-layout-bounds-set', {
            detail: this.layoutDimensions
        }));
        
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
     * Handle window resize
     */
    handleResize() {
        console.log('[MobileLayoutHandler] Window resized');
        
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
        
        console.log('[MobileLayoutHandler] Viewport updated:', viewportContent);
    }
    
    /**
     * Reset viewport to default (for autoscale mode)
     */
    resetViewportScale() {
        let viewportMeta = document.querySelector('meta[name="viewport"]');
        
        if (viewportMeta) {
            const viewportContent = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            viewportMeta.setAttribute('content', viewportContent);
            console.log('[MobileLayoutHandler] Viewport reset to default');
        }
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

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileLayoutHandler;
}
