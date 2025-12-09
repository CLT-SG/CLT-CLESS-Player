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
        if (window.mobileSocketManager && window.mobileSocketManager.isConnected()) {
            return window.mobileSocketManager.getSocket();
        }

        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (window.mobileSocketManager && window.mobileSocketManager.getSocket()) {
                    clearInterval(checkInterval);
                    resolve(window.mobileSocketManager.getSocket());
                }
            }, 100);

            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                console.error('Mobile Socket Manager timeout - using fallback socket');
                resolve(null);
            }, 10000);
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
