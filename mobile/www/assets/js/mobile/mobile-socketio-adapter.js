/**
 * eCLESS Player Mobile - Socket.IO Cpanel Adapter
 * 
 * This adapter bridges the existing socketio-cpanel.js with the mobile socket manager.
 * It ensures socketio-cpanel.js uses the properly managed socket connection instead
 * of creating its own connection.
 * 
 * Load this BEFORE socketio-cpanel.js to intercept socket initialization.
 * 
 * @module mobile-socketio-adapter
 */

console.log('=== MOBILE SOCKET.IO ADAPTER: Initializing ===');

(function() {
    'use strict';

    // Store reference to original socket initialization
    let originalSocketInit = null;
    let managedSocket = null;

    /**
     * Wait for mobile socket manager to be ready
     */
    async function waitForSocketManager() {
        // First wait for config to be loaded
        if (!window.config || !window.config.hostserver) {
            console.log('Mobile Socket Adapter: Waiting for config first...');
            await new Promise((resolve) => {
                if (window.config && window.config.hostserver) {
                    resolve();
                } else {
                    window.addEventListener('configLoaded', resolve, { once: true });
                    // Timeout fallback
                    setTimeout(resolve, 15000);
                }
            });
        }

        // Check if socket is not needed (no server configured)
        if (!window.config || !window.config.hostserver) {
            console.warn('Mobile Socket Adapter: No server configured, skipping socket connection');
            return null;
        }

        if (window.mobileSocketManager && window.mobileSocketManager.isConnected()) {
            return window.mobileSocketManager.getSocket();
        }

        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds total
            
            const checkInterval = setInterval(() => {
                attempts++;
                
                if (window.mobileSocketManager && window.mobileSocketManager.getSocket()) {
                    clearInterval(checkInterval);
                    console.log('Mobile Socket Adapter: Socket manager ready after', attempts * 100, 'ms');
                    resolve(window.mobileSocketManager.getSocket());
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.warn('Mobile Socket Adapter: Timeout waiting for socket manager (not critical)');
                    resolve(null);
                }
            }, 100);
        });
    }

    /**
     * Initialize adapter
     */
    async function initAdapter() {
        console.log('Mobile Socket Adapter: Waiting for socket manager...');
        
        // Wait for managed socket
        managedSocket = await waitForSocketManager();
        
        if (managedSocket) {
            console.log('✅ Mobile Socket Adapter: Using managed socket connection');
            
            // Make managed socket available globally for socketio-cpanel.js
            window.socket = managedSocket;
            
            // Override socket initialization function if it exists
            if (typeof window.initializeSocketConnection === 'function') {
                window.initializeSocketConnection = function() {
                    console.log('Mobile Socket Adapter: Intercepted socket initialization');
                    return managedSocket;
                };
            }
            
        } else {
            console.warn('⚠️ Mobile Socket Adapter: Managed socket not available, socketio-cpanel.js will create its own');
        }
    }

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAdapter);
    } else {
        initAdapter();
    }

    // Also listen for config loaded event
    window.addEventListener('configLoaded', () => {
        console.log('Mobile Socket Adapter: Config loaded, checking socket connection');
        if (!managedSocket && window.mobileSocketManager) {
            initAdapter();
        }
    });

    // Make adapter accessible
    window.mobileSocketAdapter = {
        getSocket: () => managedSocket,
        isReady: () => !!managedSocket
    };

})();

console.log('=== MOBILE SOCKET.IO ADAPTER: Loaded ===');
