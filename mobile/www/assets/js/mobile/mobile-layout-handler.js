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
        console.log('[MobileLayoutHandler] setLayoutBounds called:', bounds, 'autoscale:', autoscale);
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (autoscale || !bounds.width || !bounds.height) {
            // Autoscale mode - use full viewport
            this.layoutDimensions = {
                width: viewportWidth,
                height: viewportHeight,
                x: 0,
                y: 0,
                original: bounds
            };
            this.scaleFactor = 1;
            this.isFullscreen = true;
            
            console.log('[MobileLayoutHandler] Using autoscale/fullscreen mode');
        } else {
            // Calculate scale factor to fit layout in viewport
            const scaleX = viewportWidth / bounds.width;
            const scaleY = viewportHeight / bounds.height;
            this.scaleFactor = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
            
            this.layoutDimensions = {
                width: bounds.width * this.scaleFactor,
                height: bounds.height * this.scaleFactor,
                x: (viewportWidth - (bounds.width * this.scaleFactor)) / 2,
                y: (viewportHeight - (bounds.height * this.scaleFactor)) / 2,
                original: bounds,
                scale: this.scaleFactor
            };
            this.isFullscreen = false;
            
            console.log('[MobileLayoutHandler] Layout scaled:', this.layoutDimensions);
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
            // Fullscreen mode
            main.style.width = '100%';
            main.style.height = '100%';
            main.style.position = 'fixed';
            main.style.top = '0';
            main.style.left = '0';
            main.style.transform = 'none';
        } else {
            // Scaled mode with centering
            main.style.width = this.layoutDimensions.width + 'px';
            main.style.height = this.layoutDimensions.height + 'px';
            main.style.position = 'fixed';
            main.style.top = this.layoutDimensions.y + 'px';
            main.style.left = this.layoutDimensions.x + 'px';
            main.style.transform = 'none';
        }
        
        console.log('[MobileLayoutHandler] Dimensions applied to #main');
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
