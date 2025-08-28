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
        // First try: Check for current display data from system monitoring
        if (window.currentDisplayData && window.currentDisplayData.displays) {
            const primaryDisplay = window.currentDisplayData.displays.find(d => d.main) || window.currentDisplayData.displays[0];
            if (primaryDisplay) {
                this.updateOrientationFromDisplay(primaryDisplay);
                console.log('Using current system display data for orientation');
                return;
            }
        }

        // Second try: Check for legacy displayInfo object
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
        this.remoteDisplayContainer.classList.remove('landscape', 'portrait', 'square');
        
        const ratio = width / height;
        
        if (Math.abs(ratio - 1) < 0.1) {
            // Square-ish (ratio close to 1:1)
            this.currentOrientation = 'square';
        } else if (ratio > 1.2) {
            // Landscape (width significantly larger than height)
            this.currentOrientation = 'landscape';
        } else if (ratio < 0.8) {
            // Portrait (height significantly larger than width)
            this.currentOrientation = 'portrait';
        } else {
            // Default to landscape for borderline cases
            this.currentOrientation = 'landscape';
        }
        
        // Apply the orientation class
        this.remoteDisplayContainer.classList.add(this.currentOrientation);
        
        // Update display info if available
        this.updateDisplayInfoText(width, height);
    }

    updateDisplayInfoText(width, height) {
        const displayDetails = document.getElementById('displayDetails');
        if (displayDetails) {
            const orientationText = this.currentOrientation.charAt(0).toUpperCase() + this.currentOrientation.slice(1);
            displayDetails.innerHTML = `
                <div class="status-indicator status-online">
                    <div class="status-dot"></div>
                    ${orientationText} Display (${width} × ${height})
                </div>
            `;
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
        console.log('Forcing display information refresh...');
        if (typeof loadDeviceInformation === 'function') {
            loadDeviceInformation();
            setTimeout(() => this.detectDisplayOrientation(), 1000);
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

    // Get current orientation info
    getOrientationInfo() {
        return {
            orientation: this.currentOrientation,
            container: this.remoteDisplayContainer,
            dimensions: {
                width: this.remoteDisplayContainer.offsetWidth,
                height: this.remoteDisplayContainer.offsetHeight
            },
            displayData: window.currentDisplayData
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
