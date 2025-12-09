/**
 * eCLESS Player Mobile - HTTP Module
 * 
 * This module provides HTTP request functionality that bypasses CORS
 * restrictions using Capacitor's native HTTP plugin.
 * Falls back to jQuery AJAX if Capacitor is not available (web mode).
 * 
 * @module mobile-http
 */

console.log('=== MOBILE HTTP: Initializing ===');

/**
 * Mobile HTTP Client
 * Handles HTTP requests with CORS bypass for native apps
 */
class MobileHTTP {
    constructor() {
        // Check multiple sources for native platform detection
        this.isNative = (window.capacitorAPI && window.capacitorAPI.isNative) || 
                       (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
        
        console.log('MobileHTTP: Running in', this.isNative ? 'native' : 'web', 'mode');
        console.log('MobileHTTP: capacitorAPI.isNative =', window.capacitorAPI?.isNative);
        console.log('MobileHTTP: Capacitor.isNativePlatform() =', window.Capacitor?.isNativePlatform?.());
    }

    /**
     * Perform GET request with CORS bypass
     * 
     * @param {string} url - The URL to fetch
     * @param {object} options - Options for the request
     * @returns {Promise} Promise resolving to response data
     */
    async get(url, options = {}) {
        const {
            timeout = 10000,
            headers = {},
            dataType = 'xml',
            useProxy = false,
            proxyUrl = 'https://corsproxy.io/?url='
        } = options;

        console.log('MobileHTTP: GET request to:', url);

        try {
            // If proxy is explicitly requested, use it
            if (useProxy) {
                url = proxyUrl + encodeURIComponent(url);
                console.log('MobileHTTP: Using proxy:', url);
            }

            // Native mode: Use Capacitor HTTP (bypasses CORS)
            if (this.isNative && window.Capacitor && window.Capacitor.Plugins) {
                console.log('MobileHTTP: Using native Capacitor HTTP');
                
                const { CapacitorHttp } = window.Capacitor.Plugins;
                
                if (CapacitorHttp) {
                    console.log('MobileHTTP: CapacitorHttp plugin found, making native request...');
                    
                    const response = await CapacitorHttp.request({
                        url: url,
                        method: 'GET',
                        headers: headers,
                        connectTimeout: timeout,
                        readTimeout: timeout
                    });

                    console.log('MobileHTTP: Native request successful, status:', response.status);
                    
                    // Parse XML if needed
                    if (dataType === 'xml' && response.data) {
                        const parser = new DOMParser();
                        // response.data is already a string for text responses
                        const xmlString = typeof response.data === 'string' ? response.data : response.data;
                        return parser.parseFromString(xmlString, 'text/xml');
                    }
                    
                    // Parse JSON if needed
                    if (dataType === 'json' && typeof response.data === 'string') {
                        return JSON.parse(response.data);
                    }
                    
                    return response.data;
                } else {
                    console.warn('MobileHTTP: CapacitorHttp plugin not found, falling back to fetch');
                }
            }

            // Fallback: Use fetch API with error handling
            console.log('MobileHTTP: Using fetch API');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: headers,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.text();
                
                // Parse XML if needed
                if (dataType === 'xml') {
                    const parser = new DOMParser();
                    return parser.parseFromString(data, 'text/xml');
                }
                
                if (dataType === 'json') {
                    return JSON.parse(data);
                }

                return data;

            } catch (fetchError) {
                clearTimeout(timeoutId);
                
                if (fetchError.name === 'AbortError') {
                    throw new Error('Request timeout');
                }
                
                throw fetchError;
            }

        } catch (error) {
            console.error('MobileHTTP: Request failed:', error);
            throw error;
        }
    }

    /**
     * jQuery-compatible AJAX wrapper
     * 
     * @param {object} options - jQuery AJAX-style options
     * @returns {Promise} Promise resolving when request completes
     */
    async ajax(options) {
        const {
            url,
            type = 'GET',
            dataType = 'xml',
            timeout = 10000,
            headers = {},
            success,
            error
        } = options;

        try {
            console.log('MobileHTTP: AJAX request:', type, url);
            
            const useProxy = window.config && window.config.corsproxy === 'Y';
            
            const data = await this.get(url, {
                timeout,
                headers,
                dataType,
                useProxy
            });

            console.log('MobileHTTP: AJAX request successful');
            
            if (success && typeof success === 'function') {
                success(data);
            }

            return data;

        } catch (err) {
            console.error('MobileHTTP: AJAX request failed:', err);
            
            if (error && typeof error === 'function') {
                error({
                    status: err.status || 0,
                    statusText: err.message || 'Unknown error',
                    responseText: err.toString(),
                    readyState: 4
                }, 'error', err.message || 'Request failed');
            }

            throw err;
        }
    }

    /**
     * Check if a URL is reachable
     * 
     * @param {string} url - The URL to check
     * @returns {Promise<boolean>} True if reachable
     */
    async isReachable(url) {
        try {
            console.log('MobileHTTP: Checking reachability of:', url);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'no-cors', // Allow cross-origin
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            
            console.log('MobileHTTP: URL is reachable');
            return true;

        } catch (error) {
            console.warn('MobileHTTP: URL not reachable:', error.message);
            return false;
        }
    }
}

// Create singleton instance
const mobileHTTP = new MobileHTTP();

// Make globally available
window.mobileHTTP = mobileHTTP;

// Override jQuery.ajax for mobile compatibility
if (window.$ && window.$.ajax) {
    const originalAjax = window.$.ajax;
    
    window.$.ajax = function(options) {
        // Check if we should use mobile HTTP
        if (window.capacitorAPI && window.capacitorAPI.isNative) {
            console.log('MobileHTTP: Intercepting jQuery.ajax call');
            return mobileHTTP.ajax(options);
        }
        
        // Fallback to original jQuery AJAX
        return originalAjax.call(this, options);
    };
    
    console.log('MobileHTTP: jQuery.ajax wrapper installed');
}

console.log('=== MOBILE HTTP: Initialized successfully ===');

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = mobileHTTP;
}
