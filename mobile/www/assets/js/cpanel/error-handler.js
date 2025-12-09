/**
 * eCLESS Player Dashboard - Fallback Error Handler
 * This script handles cases where require.js or other dependencies fail to load
 */

(function() {
    'use strict';

    // Check if main dependencies are available
    const hasJQuery = typeof $ !== 'undefined';
    const hasSocketIO = typeof io !== 'undefined';
    
    console.log('eCLESS Dashboard Dependencies Check:', {
        jQuery: hasJQuery,
        SocketIO: hasSocketIO,
        require: typeof require !== 'undefined'
    });

    // Fallback for missing dependencies
    if (!hasJQuery) {
        console.warn('jQuery not available, creating basic fallback');
        
        // Basic DOM ready function
        function domReady(fn) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', fn);
            } else {
                fn();
            }
        }

        // Basic element selector
        function $(selector) {
            return document.querySelector(selector);
        }

        domReady(function() {
            // Remove loading states
            const loadingElements = document.querySelectorAll('.loading');
            loadingElements.forEach(function(el) {
                el.classList.remove('loading');
                el.textContent = 'Service temporarily unavailable';
            });

            // Show error message
            const container = document.querySelector('.dashboard-container');
            if (container) {
                const errorBanner = document.createElement('div');
                errorBanner.className = 'alert-modern alert-danger';
                errorBanner.style.margin = '1rem 0';
                errorBanner.innerHTML = `
                    <i class="bi bi-exclamation-triangle"></i>
                    <strong>Service Notice:</strong> Some features may be limited due to missing dependencies. 
                    Please refresh the page or contact support if the issue persists.
                `;
                container.insertBefore(errorBanner, container.firstChild);
            }
        });
    }

    // Basic error handler for uncaught errors
    window.addEventListener('error', function(event) {
        console.error('eCLESS Dashboard Error:', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error
        });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.error('eCLESS Dashboard Unhandled Promise Rejection:', event.reason);
    });

})();
