// eCLESS Player Dashboard JavaScript
// Display orientation detection and management
class DisplayOrientationManager {
    constructor() {
        this.remoteDisplayContainer = document.getElementById('remoteDisplayContainer');
        this.currentOrientation = 'landscape'; // default
        this.init();
    }

    init() {
        // Setup display info listener first
        this.setupDisplayInfoListener();
        
        // Initial orientation detection
        this.detectDisplayOrientation();
        
        // Listen for window resize to adjust responsive behavior
        window.addEventListener('resize', () => this.handleResponsiveResize());
        
        // Initial responsive setup
        this.handleResponsiveResize();
        
        // Trigger system monitoring load to get display data
        if (typeof loadDeviceInformation === 'function') {
            setTimeout(() => {
                loadDeviceInformation();
                // Re-detect orientation after data loads
                setTimeout(() => this.detectDisplayOrientation(), 1000);
            }, 500);
        }
    }

    detectDisplayOrientation() {
        // First try: Check for enhanced multi-display configuration via API
        this.fetchMultiDisplayConfiguration().then(config => {
            if (config && config.hasMultipleDisplays) {
                this.updateOrientationFromMultiDisplay(config);
                console.log('Using enhanced multi-display configuration for orientation');
                return;
            }
            
            // Continue with existing logic if multi-display not available
            this.detectDisplayOrientationLegacy();
        }).catch(error => {
            console.warn('Failed to fetch multi-display configuration:', error);
            this.detectDisplayOrientationLegacy();
        });
    }

    detectDisplayOrientationLegacy() {
        // Second try: Check for current display data from system monitoring
        if (window.currentDisplayData && window.currentDisplayData.displays) {
            const primaryDisplay = window.currentDisplayData.displays.find(d => d.main) || window.currentDisplayData.displays[0];
            if (primaryDisplay) {
                this.updateOrientationFromDisplay(primaryDisplay);
                console.log('Using current system display data for orientation');
                return;
            }
        }

        // Third try: Check for legacy displayInfo object
        if (typeof displayInfo !== 'undefined' && displayInfo && displayInfo.displays) {
            const primaryDisplay = displayInfo.displays.find(d => d.main) || displayInfo.displays[0];
            if (primaryDisplay) {
                this.updateOrientationFromDisplay(primaryDisplay);
                console.log('Using legacy displayInfo for orientation');
                return;
            }
        }

        // Fallback: use window dimensions
        console.log('Using window dimensions as fallback for orientation');
        this.updateOrientationFromWindow();
    }

    /**
     * Fetch multi-display configuration from the enhanced API
     */
    async fetchMultiDisplayConfiguration() {
        try {
            const response = await fetch('/api/system/display/remote-display-config');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.warn('Failed to fetch multi-display configuration:', error);
            return null;
        }
    }

    /**
     * Update orientation based on multi-display configuration
     */
    updateOrientationFromMultiDisplay(config) {
        const combinedWidth = config.combinedResolution.width;
        const combinedHeight = config.combinedResolution.height;
        
        // Use combined resolution for orientation calculation
        this.setOrientation(combinedWidth, combinedHeight);
        
        // Update display status with multi-display information
        this.updateMultiDisplayStatus(config);
        
        // Store multi-display configuration for future use
        this.multiDisplayConfig = config;
        
        console.log(`Multi-display orientation detected: ${this.currentOrientation} (Combined: ${combinedWidth}x${combinedHeight})`);
        console.log(`Display arrangement: ${config.arrangement}, Count: ${config.displayCount}`);
    }

    /**
     * Update display status indicator with multi-display information
     */
    updateMultiDisplayStatus(config) {
        let statusIndicator = document.getElementById('remoteDisplayStatus');
        if (!statusIndicator) {
            statusIndicator = document.createElement('div');
            statusIndicator.id = 'remoteDisplayStatus';
            statusIndicator.style.cssText = `
                position: absolute;
                top: 8px;
                left: 8px;
                background: linear-gradient(135deg, rgba(0, 123, 255, 0.9), rgba(0, 86, 179, 0.9));
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 0.75rem;
                font-weight: 500;
                z-index: 10;
                pointer-events: none;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.2);
            `;
            this.remoteDisplayContainer.appendChild(statusIndicator);
        }
        
        const orientationText = this.currentOrientation.charAt(0).toUpperCase() + this.currentOrientation.slice(1);
        
        if (config.hasMultipleDisplays) {
            statusIndicator.innerHTML = `
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="color: #90EE90;">●</span>
                    <span>Multi-Display: ${config.combinedResolution.formatted} (${orientationText})</span>
                </div>
                <div style="font-size: 0.65rem; opacity: 0.9; margin-top: 2px;">
                    ${config.displayCount} displays • ${config.arrangement}
                </div>
            `;
        } else {
            statusIndicator.innerHTML = `
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="color: #87CEEB;">●</span>
                    <span>Single Display: ${config.combinedResolution.formatted} (${orientationText})</span>
                </div>
            `;
        }
        
        // Auto-hide after 5 seconds, then show minimized version
        clearTimeout(this.statusTimeout);
        statusIndicator.style.opacity = '1';
        this.statusTimeout = setTimeout(() => {
            statusIndicator.style.opacity = '0.6';
            statusIndicator.style.transform = 'scale(0.9)';
            
            // Show minimized version after fade
            setTimeout(() => {
                if (config.hasMultipleDisplays) {
                    statusIndicator.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="color: #90EE90;">●</span>
                            <span>${config.displayCount}×${config.arrangement.split('-')[0]} ${config.combinedResolution.formatted}</span>
                        </div>
                    `;
                } else {
                    statusIndicator.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="color: #87CEEB;">●</span>
                            <span>${config.combinedResolution.formatted}</span>
                        </div>
                    `;
                }
            }, 300);
        }, 5000);
    }

    updateOrientationFromDisplay(display) {
        // Try multiple property names for resolution
        const width = display.currentResX || display.resolutionx || display.sizex || display.width || display.resolution?.width;
        const height = display.currentResY || display.resolutiony || display.sizey || display.height || display.resolution?.height;
        
        if (width && height) {
            this.setOrientation(width, height);
            console.log(`Display orientation detected from system: ${this.currentOrientation} (${width}x${height})`);
            
            // Update display status indicator
            this.updateDisplayStatus(display, width, height);
        } else {
            console.warn('Could not extract resolution from display data:', display);
            // Fallback to window dimensions
            this.updateOrientationFromWindow();
        }
    }

    updateOrientationFromWindow() {
        const width = window.screen.width || window.innerWidth;
        const height = window.screen.height || window.innerHeight;
        this.setOrientation(width, height);
        console.log(`Window orientation detected: ${this.currentOrientation} (${width}x${height})`);
    }

    setOrientation(width, height) {
        // Remove existing orientation classes
        this.remoteDisplayContainer.classList.remove('landscape', 'portrait', 'square', 'ultra-wide', 'multi-display');
        
        const ratio = width / height;
        
        // Enhanced orientation detection for multi-display scenarios
        if (Math.abs(ratio - 1) < 0.1) {
            // Square-ish (ratio close to 1:1)
            this.currentOrientation = 'square';
        } else if (ratio > 2.5) {
            // Ultra-wide (likely multi-display horizontal arrangement)
            this.currentOrientation = 'ultra-wide';
            this.remoteDisplayContainer.classList.add('multi-display');
        } else if (ratio > 1.6) {
            // Wide landscape (could be dual horizontal displays)
            this.currentOrientation = 'landscape';
            if (ratio > 2.0) {
                this.remoteDisplayContainer.classList.add('multi-display');
            }
        } else if (ratio > 1.2) {
            // Standard landscape
            this.currentOrientation = 'landscape';
        } else if (ratio < 0.4) {
            // Very tall portrait (likely multi-display vertical arrangement)
            this.currentOrientation = 'portrait';
            this.remoteDisplayContainer.classList.add('multi-display');
        } else if (ratio < 0.8) {
            // Portrait (height significantly larger than width)
            this.currentOrientation = 'portrait';
        } else {
            // Default to landscape for borderline cases
            this.currentOrientation = 'landscape';
        }
        
        // Apply the orientation class
        this.remoteDisplayContainer.classList.add(this.currentOrientation);
        
        // Add aspect ratio class for fine-tuned styling
        const aspectRatioClass = `aspect-${Math.round(ratio * 100)}`;
        this.remoteDisplayContainer.classList.add(aspectRatioClass);
        
        // Store current dimensions for reference
        this.currentDimensions = { width, height, ratio };
        
        // Update display info if available
        this.updateDisplayInfoText(width, height);
    }

    updateDisplayInfoText(width, height) {
        const displayDetails = document.getElementById('displayDetails');
        if (displayDetails) {
            const orientationText = this.currentOrientation.charAt(0).toUpperCase() + this.currentOrientation.slice(1);
            const ratio = (width / height).toFixed(2);
            
            // Check if we have multi-display configuration
            const isMultiDisplay = this.multiDisplayConfig?.hasMultipleDisplays || false;
            
            if (isMultiDisplay) {
                const arrangement = this.multiDisplayConfig.arrangement || 'unknown';
                const displayCount = this.multiDisplayConfig.displayCount || 1;
                
                displayDetails.innerHTML = `
                    <div class="status-indicator status-online multi-display-indicator">
                        <div class="status-dot multi-display-dot"></div>
                        <div class="display-info">
                            <div class="main-info">${orientationText} Multi-Display (${width} × ${height})</div>
                            <div class="sub-info">${displayCount} displays • ${arrangement} • Ratio: ${ratio}</div>
                        </div>
                    </div>
                `;
            } else {
                displayDetails.innerHTML = `
                    <div class="status-indicator status-online">
                        <div class="status-dot"></div>
                        <div class="display-info">
                            <div class="main-info">${orientationText} Display (${width} × ${height})</div>
                            <div class="sub-info">Single display • Ratio: ${ratio}</div>
                        </div>
                    </div>
                `;
            }
        }
    }

    updateDisplayStatus(display, width, height) {
        // Create or update a status indicator in the remote display area
        let statusIndicator = document.getElementById('remoteDisplayStatus');
        if (!statusIndicator) {
            statusIndicator = document.createElement('div');
            statusIndicator.id = 'remoteDisplayStatus';
            statusIndicator.style.cssText = `
                position: absolute;
                top: 8px;
                left: 8px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.75rem;
                z-index: 2;
                pointer-events: none;
            `;
            this.remoteDisplayContainer.appendChild(statusIndicator);
        }
        
        const displayName = display.model || display.name || 'Primary Display';
        const orientationText = this.currentOrientation.charAt(0).toUpperCase() + this.currentOrientation.slice(1);
        statusIndicator.textContent = `${displayName}: ${width}×${height} (${orientationText})`;
        
        // Hide after 3 seconds
        clearTimeout(this.statusTimeout);
        statusIndicator.style.opacity = '1';
        this.statusTimeout = setTimeout(() => {
            statusIndicator.style.opacity = '0.3';
        }, 3000);
    }

    setupDisplayInfoListener() {
        // Store reference to this for use in callbacks
        const self = this;
        
        // Hook into the displayDisplayInfo function to capture display data
        const originalDisplayDisplayInfo = window.displayDisplayInfo;
        window.displayDisplayInfo = function(displayData) {
            // Call original function if it exists
            if (originalDisplayDisplayInfo) {
                originalDisplayDisplayInfo(displayData);
            }
            
            // Store display data globally for orientation detection
            window.currentDisplayData = displayData;
            
            // Update orientation based on new display data
            if (displayData && displayData.displays && displayData.displays.length > 0) {
                const primaryDisplay = displayData.displays.find(d => d.main) || displayData.displays[0];
                self.updateOrientationFromDisplay(primaryDisplay);
                console.log('Display orientation updated from system display info:', primaryDisplay);
            }
        };

        // Listen for refresh button clicks to update orientation
        $('#refreshMonitoring').on('click', () => {
            setTimeout(() => {
                if (window.currentDisplayData && window.currentDisplayData.displays) {
                    const primaryDisplay = window.currentDisplayData.displays.find(d => d.main) || window.currentDisplayData.displays[0];
                    if (primaryDisplay) {
                        self.updateOrientationFromDisplay(primaryDisplay);
                        console.log('Display orientation refreshed from stored data:', primaryDisplay);
                    }
                } else {
                    // Trigger a fresh load if no data is available
                    if (typeof loadDeviceInformation === 'function') {
                        loadDeviceInformation();
                        setTimeout(() => self.detectDisplayOrientation(), 1000);
                    }
                }
            }, 500); // Small delay to ensure data is loaded
        });
    }

    handleResponsiveResize() {
        // Adjust behavior based on screen size
        const screenWidth = window.innerWidth;
        
        if (screenWidth <= 480) {
            // Mobile: prioritize space efficiency
            this.remoteDisplayContainer.style.minHeight = '150px';
        } else if (screenWidth <= 768) {
            // Tablet: balanced approach
            this.remoteDisplayContainer.style.minHeight = '200px';
        } else {
            // Desktop: full experience
            this.remoteDisplayContainer.style.minHeight = '280px';
        }
        
        // Re-detect orientation on significant resize
        if (Math.abs(screenWidth - (this.lastScreenWidth || screenWidth)) > 100) {
            setTimeout(() => this.detectDisplayOrientation(), 100);
        }
        
        this.lastScreenWidth = screenWidth;
    }

    // Public method to manually update orientation
    updateOrientation() {
        this.detectDisplayOrientation();
    }

    // Method to force refresh display information from system
    refreshDisplayInfo() {
        console.log('Forcing display information refresh with multi-display support...');
        
        // First try the enhanced multi-display API
        this.fetchMultiDisplayConfiguration().then(config => {
            if (config) {
                console.log('Successfully refreshed multi-display configuration');
                this.updateOrientationFromMultiDisplay(config);
                return;
            }
            
            // Fallback to legacy refresh methods
            this.refreshDisplayInfoLegacy();
        }).catch(error => {
            console.warn('Multi-display refresh failed, using legacy method:', error);
            this.refreshDisplayInfoLegacy();
        });
    }

    // Legacy refresh method for backward compatibility
    refreshDisplayInfoLegacy() {
        if (typeof loadDeviceInformation === 'function') {
            loadDeviceInformation();
            setTimeout(() => this.detectDisplayOrientationLegacy(), 1000);
        } else {
            // Try direct AJAX call as fallback
            $.ajax({
                type: 'GET',
                url: '/api/deviceinfo',
                timeout: 10000,
                success: (data) => {
                    if (data.display) {
                        window.currentDisplayData = data.display;
                        if (data.display.displays && data.display.displays.length > 0) {
                            const primaryDisplay = data.display.displays.find(d => d.main) || data.display.displays[0];
                            this.updateOrientationFromDisplay(primaryDisplay);
                        }
                    }
                },
                error: (xhr, status, error) => {
                    console.log('Error fetching device info:', error);
                    this.updateOrientationFromWindow();
                }
            });
        }
    }

    // Get current orientation info with multi-display support
    getOrientationInfo() {
        return {
            orientation: this.currentOrientation,
            container: this.remoteDisplayContainer,
            dimensions: this.currentDimensions || {
                width: this.remoteDisplayContainer.offsetWidth,
                height: this.remoteDisplayContainer.offsetHeight,
                ratio: this.remoteDisplayContainer.offsetWidth / this.remoteDisplayContainer.offsetHeight
            },
            multiDisplayConfig: this.multiDisplayConfig || null,
            hasMultipleDisplays: this.multiDisplayConfig?.hasMultipleDisplays || false,
            displayData: window.currentDisplayData,
            
            // Enhanced information
            arrangementType: this.multiDisplayConfig?.arrangement || 'single',
            displayCount: this.multiDisplayConfig?.displayCount || 1,
            combinedResolution: this.multiDisplayConfig?.combinedResolution || null,
            isUltraWide: this.currentOrientation === 'ultra-wide',
            aspectRatio: this.currentDimensions?.ratio || 1.78
        };
    }
}

// Initialize display orientation manager when DOM is ready
$(document).ready(function() {
    window.displayOrientationManager = new DisplayOrientationManager();
    
    // Add refresh button handler for display orientation
    $('#refreshMonitoring').on('click', function() {
        setTimeout(() => {
            window.displayOrientationManager.refreshDisplayInfo();
        }, 100);
    });
    
    // Update orientation when display information is loaded
    setTimeout(() => {
        window.displayOrientationManager.detectDisplayOrientation();
    }, 2000); // Increased delay to ensure system data loads
    
    // Periodic refresh every 30 seconds to keep orientation updated
    setInterval(() => {
        if (window.currentDisplayData && window.currentDisplayData.displays) {
            const primaryDisplay = window.currentDisplayData.displays.find(d => d.main) || window.currentDisplayData.displays[0];
            if (primaryDisplay) {
                window.displayOrientationManager.updateOrientationFromDisplay(primaryDisplay);
            }
        }
    }, 30000);
});

// Expose globally for other scripts to use
window.updateRemoteDisplayOrientation = function(width, height) {
    if (window.displayOrientationManager) {
        window.displayOrientationManager.setOrientation(width, height);
    }
};

// Expose method to refresh display information
window.refreshDisplayOrientation = function() {
    if (window.displayOrientationManager) {
        window.displayOrientationManager.refreshDisplayInfo();
    }
};
