/**
 * eCLESS Player Mobile - Socket.IO Connection Manager
 * 
 * This module manages Socket.IO connections for mobile devices.
 * It dynamically connects to the configured server address and handles
 * mobile-specific scenarios like network changes and app lifecycle events.
 * 
 * @module mobile-socketio-manager
 */

console.log('=== MOBILE SOCKET.IO MANAGER: Initializing ===');

/**
 * Socket.IO Connection Manager for Mobile
 */
class MobileSocketManager {
    constructor() {
        this.socket = null;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 2000;
        this.config = null;
        
        // Wait for config to load
        this.initPromise = this.initialize();
    }

    /**
     * Initialize the socket manager
     */
    async initialize() {
        console.log('MobileSocketManager: Waiting for configuration...');
        
        // Wait for config to be available with timeout
        if (!window.config || !window.config.hostserver) {
            console.log('MobileSocketManager: Config not available, waiting for configLoaded event...');
            try {
                await Promise.race([
                    new Promise((resolve) => {
                        window.addEventListener('configLoaded', resolve, { once: true });
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Config load timeout')), 15000)
                    )
                ]);
            } catch (error) {
                console.error('MobileSocketManager: Timeout waiting for configuration:', error);
                // Fallback to default config if available
                if (!window.config) {
                    console.warn('MobileSocketManager: No config available, Socket.IO will not connect');
                    return this;
                }
            }
        }
        
        this.config = window.config;
        console.log('MobileSocketManager: Configuration loaded', this.config);
        
        // Validate config has necessary properties
        if (!this.config.hostserver && !this.config.masterServerAddress) {
            console.warn('MobileSocketManager: No server address configured, Socket.IO will not auto-connect');
            return this;
        }
        
        // Setup app lifecycle listeners
        this.setupLifecycleListeners();
        
        // Setup network change listeners
        this.setupNetworkListeners();
        
        return this;
    }

    /**
     * Connect to Socket.IO server
     */
    async connect() {
        if (this.isConnecting || (this.socket && this.socket.connected)) {
            console.log('MobileSocketManager: Already connected or connecting');
            return this.socket;
        }

        try {
            this.isConnecting = true;
            
            // Ensure config is loaded
            if (!this.config) {
                await this.initPromise;
            }
            
            // Validate config before attempting connection
            if (!this.config || (!this.config.hostserver && !this.config.masterServerAddress)) {
                console.warn('MobileSocketManager: No server address available, skipping Socket.IO connection');
                this.isConnecting = false;
                return null;
            }

            // Determine server address
            const serverAddress = this.config.masterServerAddress || this.config.hostserver || 'localhost';
            const serverPort = this.config.masterServerPort || 9000;
            
            // Build Socket.IO URL
            let socketUrl;
            
            if (serverAddress.startsWith('http://') || serverAddress.startsWith('https://')) {
                // Full URL provided
                const url = new URL(serverAddress);
                url.port = serverPort;
                socketUrl = url.toString();
            } else {
                // Just hostname provided
                socketUrl = `https://${serverAddress}:${serverPort}`;
            }

            console.log('MobileSocketManager: Connecting to', socketUrl);

            // Create Socket.IO connection
            this.socket = io(socketUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: this.reconnectDelay,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: this.maxReconnectAttempts,
                timeout: 20000,
                autoConnect: true,
                // Mobile-specific options
                upgrade: true,
                rememberUpgrade: true,
                rejectUnauthorized: false // Allow self-signed certificates
            });

            // Setup event handlers
            this.setupSocketHandlers();

            return this.socket;

        } catch (error) {
            console.error('MobileSocketManager: Connection error', error);
            this.isConnecting = false;
            throw error;
        }
    }

    /**
     * Setup Socket.IO event handlers
     */
    setupSocketHandlers() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ Socket.IO connected');
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            
            // Emit connection event
            window.dispatchEvent(new CustomEvent('socketio-connected', {
                detail: { socketId: this.socket.id }
            }));
        });

        this.socket.on('disconnect', (reason) => {
            console.warn('❌ Socket.IO disconnected:', reason);
            this.isConnecting = false;
            
            window.dispatchEvent(new CustomEvent('socketio-disconnected', {
                detail: { reason }
            }));
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket.IO connection error:', error);
            this.reconnectAttempts++;
            this.isConnecting = false;
            
            window.dispatchEvent(new CustomEvent('socketio-error', {
                detail: { error, attempts: this.reconnectAttempts }
            }));
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('✅ Socket.IO reconnected after', attemptNumber, 'attempts');
            this.reconnectAttempts = 0;
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log('🔄 Socket.IO reconnect attempt', attemptNumber);
        });

        this.socket.on('reconnect_error', (error) => {
            console.error('Socket.IO reconnection error:', error);
        });

        this.socket.on('reconnect_failed', () => {
            console.error('❌ Socket.IO reconnection failed - max attempts reached');
            
            window.dispatchEvent(new CustomEvent('socketio-reconnect-failed'));
        });
    }

    /**
     * Setup app lifecycle listeners (foreground/background)
     */
    setupLifecycleListeners() {
        if (window.capacitorAPI) {
            // Handle app pause (background)
            window.addEventListener('pause', () => {
                console.log('MobileSocketManager: App paused - maintaining connection');
                // Keep connection alive but reduce activity
            });

            // Handle app resume (foreground)
            window.addEventListener('resume', () => {
                console.log('MobileSocketManager: App resumed - checking connection');
                
                if (this.socket && !this.socket.connected) {
                    console.log('MobileSocketManager: Reconnecting after resume');
                    this.socket.connect();
                }
            });
        }

        // Web visibility API fallback
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('MobileSocketManager: Page visible - checking connection');
                
                if (this.socket && !this.socket.connected) {
                    this.socket.connect();
                }
            }
        });
    }

    /**
     * Setup network change listeners
     */
    setupNetworkListeners() {
        if (window.capacitorAPI && window.capacitorAPI.onNetworkChange) {
            window.capacitorAPI.onNetworkChange((status) => {
                console.log('MobileSocketManager: Network status changed', status);
                
                if (status.connected && this.socket && !this.socket.connected) {
                    console.log('MobileSocketManager: Network restored - reconnecting');
                    setTimeout(() => {
                        this.socket.connect();
                    }, 1000);
                } else if (!status.connected) {
                    console.warn('MobileSocketManager: Network lost');
                }
            });
        }

        // Browser online/offline events fallback
        window.addEventListener('online', () => {
            console.log('MobileSocketManager: Browser online - reconnecting');
            
            if (this.socket && !this.socket.connected) {
                setTimeout(() => {
                    this.socket.connect();
                }, 1000);
            }
        });

        window.addEventListener('offline', () => {
            console.warn('MobileSocketManager: Browser offline');
        });
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.socket) {
            console.log('MobileSocketManager: Disconnecting');
            this.socket.disconnect();
        }
    }

    /**
     * Get current socket instance
     */
    getSocket() {
        return this.socket;
    }

    /**
     * Check connection status
     */
    isConnected() {
        return this.socket && this.socket.connected;
    }

    /**
     * Reconnect to server
     */
    reconnect() {
        if (this.socket) {
            console.log('MobileSocketManager: Manual reconnect');
            this.socket.disconnect();
            this.socket.connect();
        } else {
            this.connect();
        }
    }
}

// Create global socket manager instance
const mobileSocketManager = new MobileSocketManager();

// Make it globally accessible
window.mobileSocketManager = mobileSocketManager;

// Auto-connect when ready
(async function autoConnect() {
    console.log('=== MOBILE SOCKET.IO MANAGER: Auto-connecting ===');
    
    try {
        await mobileSocketManager.connect();
    } catch (error) {
        console.error('Failed to auto-connect:', error);
    }
})();

// Replace global io() calls with managed connection
const originalIo = window.io;
window.io = function(...args) {
    console.warn('io() called - using managed Socket.IO connection instead');
    
    // If already connected, return existing socket
    if (mobileSocketManager.isConnected()) {
        return mobileSocketManager.getSocket();
    }
    
    // Otherwise, use original io() but with our settings
    return originalIo(...args);
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = mobileSocketManager;
}

console.log('=== MOBILE SOCKET.IO MANAGER: Initialized successfully ===');
