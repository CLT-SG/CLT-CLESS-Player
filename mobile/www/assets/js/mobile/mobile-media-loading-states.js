/**
 * eCLESS Player Mobile - Media Loading States
 * 
 * Provides smooth loading placeholders for media content to prevent
 * jarring transitions and improve perceived performance.
 * 
 * Features:
 * - Animated skeleton loaders for images
 * - Spinner loaders for videos
 * - Fade-in transitions when media loads
 * - Progressive loading support
 * 
 * @module mobile-media-loading-states
 */

console.log('=== MOBILE MEDIA LOADING STATES: Initializing ===');

/**
 * Media Loading States Manager
 */
class MediaLoadingStates {
    constructor() {
        this.loadingElements = new Map();
        this.initialized = false;
    }

    /**
     * Initialize loading states CSS
     */
    initialize() {
        if (this.initialized) return;

        // Inject CSS for loading states
        const style = document.createElement('style');
        style.id = 'media-loading-states-css';
        style.textContent = `
            /* Media Loading Container */
            .media-loading-wrapper {
                position: relative;
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: transparent;
            }

            /* Skeleton Loader for Images */
            .media-skeleton-loader {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    90deg,
                    #2a2a2a 25%,
                    #3a3a3a 50%,
                    #2a2a2a 75%
                );
                background-size: 200% 100%;
                animation: media-skeleton-shimmer 1.5s infinite;
            }

            @keyframes media-skeleton-shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }

            /* Spinner Loader for Videos */
            .media-spinner-loader {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
            }

            .media-spinner {
                width: 48px;
                height: 48px;
                border: 4px solid rgba(255, 255, 255, 0.1);
                border-top-color: #667eea;
                border-radius: 50%;
                animation: media-spinner-rotate 0.8s linear infinite;
            }

            @keyframes media-spinner-rotate {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .media-spinner-text {
                color: rgba(255, 255, 255, 0.7);
                font-size: 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-weight: 500;
                letter-spacing: 0.5px;
            }

            /* Loading Progress Bar */
            .media-loading-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                width: 0%;
                height: 3px;
                background: linear-gradient(90deg, #667eea, #764ba2);
                transition: width 0.3s ease;
            }

            /* Fade-in animation when media loads */
            .media-fade-in {
                animation: media-fade-in-animation 0.4s ease-in-out;
            }

            @keyframes media-fade-in-animation {
                from {
                    opacity: 0;
                    transform: scale(0.98);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            /* Error State */
            .media-error-state {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: rgba(255, 255, 255, 0.7);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .media-error-icon {
                font-size: 48px;
                margin-bottom: 12px;
                opacity: 0;
            }

            .media-error-text {
                opacity: 0;
                font-size: 14px;
                font-weight: 500;
            }

            /* Pulse animation for loading state */
            .media-pulse {
                animation: media-pulse-animation 2s ease-in-out infinite;
            }

            @keyframes media-pulse-animation {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        this.initialized = true;
        console.log('MediaLoadingStates: Initialized');
    }

    /**
     * Create skeleton loader for image
     * @param {HTMLElement} container - Container element
     * @param {string} loaderId - Unique loader ID
     * @returns {HTMLElement} Loader element
     */
    createImageLoader(container, loaderId) {
        const wrapper = document.createElement('div');
        wrapper.className = 'media-loading-wrapper';
        wrapper.id = `media-loader-${loaderId}`;

        const skeleton = document.createElement('div');
        skeleton.className = 'media-skeleton-loader';

        wrapper.appendChild(skeleton);
        this.loadingElements.set(loaderId, wrapper);

        return wrapper;
    }

    /**
     * Create spinner loader for video
     * @param {HTMLElement} container - Container element
     * @param {string} loaderId - Unique loader ID
     * @param {string} message - Loading message (optional)
     * @returns {HTMLElement} Loader element
     */
    createVideoLoader(container, loaderId, message = 'Loading video...') {
        const wrapper = document.createElement('div');
        wrapper.className = 'media-loading-wrapper';
        wrapper.id = `media-loader-${loaderId}`;

        const spinnerContainer = document.createElement('div');
        spinnerContainer.className = 'media-spinner-loader';

        const spinner = document.createElement('div');
        spinner.className = 'media-spinner';

        const text = document.createElement('div');
        text.className = 'media-spinner-text';
        text.textContent = message;

        spinnerContainer.appendChild(spinner);
        spinnerContainer.appendChild(text);
        wrapper.appendChild(spinnerContainer);

        // Add progress bar
        const progress = document.createElement('div');
        progress.className = 'media-loading-progress';
        progress.id = `media-progress-${loaderId}`;
        wrapper.appendChild(progress);

        this.loadingElements.set(loaderId, wrapper);

        return wrapper;
    }

    /**
     * Update loading progress
     * @param {string} loaderId - Loader ID
     * @param {number} percent - Progress percentage (0-100)
     */
    updateProgress(loaderId, percent) {
        const progressBar = document.getElementById(`media-progress-${loaderId}`);
        if (progressBar) {
            progressBar.style.width = `${Math.min(percent, 100)}%`;
        }
    }

    /**
     * Show error state
     * @param {string} loaderId - Loader ID
     * @param {string} errorMessage - Error message
     */
    showError(loaderId, errorMessage = 'Failed to load media') {
        const loader = this.loadingElements.get(loaderId);
        if (loader) {
            loader.innerHTML = `
                <div class="media-error-state">
                    <div class="media-error-icon">⚠</div>
                    <div class="media-error-text">${errorMessage}</div>
                </div>
            `;
        }
    }

    /**
     * Remove loader and show media with fade-in animation
     * @param {string} loaderId - Loader ID
     * @param {HTMLElement} mediaElement - The actual media element to show
     */
    removeLoader(loaderId, mediaElement = null) {
        const loader = this.loadingElements.get(loaderId);
        if (loader && loader.parentNode) {
            // Add fade-in animation to media element
            if (mediaElement) {
                mediaElement.classList.add('media-fade-in');
            }

            // Smoothly remove loader
            loader.style.opacity = '0';
            loader.style.transition = 'opacity 0.3s ease';

            setTimeout(() => {
                if (loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
                this.loadingElements.delete(loaderId);
            }, 300);
        }
    }

    /**
     * Helper: Wrap image with loading state
     * @param {HTMLElement} container - Container to append to
     * @param {string} src - Image source URL
     * @param {string} loaderId - Unique loader ID
     * @returns {Promise<HTMLImageElement>} Promise that resolves when image loads
     */
    async loadImageWithState(container, src, loaderId) {
        this.initialize();

        // Show skeleton loader
        const loader = this.createImageLoader(container, loaderId);
        container.appendChild(loader);

        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                // Remove loader and show image
                this.removeLoader(loaderId, img);
                resolve(img);
            };

            img.onerror = (error) => {
                // Show error state
                this.showError(loaderId, 'Image failed to load');
                setTimeout(() => this.removeLoader(loaderId), 3000);
                reject(error);
            };

            img.src = src;
        });
    }

    /**
     * Helper: Wrap video with loading state
     * @param {HTMLElement} container - Container to append to
     * @param {string} src - Video source URL
     * @param {string} loaderId - Unique loader ID
     * @returns {Promise<HTMLVideoElement>} Promise that resolves when video can play
     */
    async loadVideoWithState(container, src, loaderId) {
        this.initialize();

        // Show spinner loader
        const loader = this.createVideoLoader(container, loaderId);
        container.appendChild(loader);

        return new Promise((resolve, reject) => {
            const video = document.createElement('video');

            // Track loading progress
            video.addEventListener('progress', () => {
                if (video.buffered.length > 0) {
                    const percent = (video.buffered.end(0) / video.duration) * 100;
                    this.updateProgress(loaderId, percent);
                }
            });

            video.addEventListener('canplay', () => {
                // Remove loader and show video
                this.removeLoader(loaderId, video);
                resolve(video);
            });

            video.addEventListener('error', (error) => {
                // Show error state
                this.showError(loaderId, 'Video failed to load');
                setTimeout(() => this.removeLoader(loaderId), 3000);
                reject(error);
            });

            video.src = src;
            video.load();
        });
    }

    /**
     * Clear all loaders
     */
    clearAll() {
        this.loadingElements.forEach((loader, loaderId) => {
            this.removeLoader(loaderId);
        });
    }
}

// Create global instance
window.mediaLoadingStates = new MediaLoadingStates();

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.mediaLoadingStates.initialize();
    });
} else {
    window.mediaLoadingStates.initialize();
}

console.log('=== MOBILE MEDIA LOADING STATES: Module loaded ===');
