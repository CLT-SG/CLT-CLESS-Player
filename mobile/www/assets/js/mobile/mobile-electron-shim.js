/**
 * eCLESS Player Mobile - Electron API Shim
 * 
 * This module provides Electron-compatible APIs for mobile devices.
 * It replaces Electron-specific modules with Capacitor-based or browser-based equivalents.
 * 
 * Provides shims for:
 * - electron-log → console logging
 * - xml-js → XML to JSON conversion
 * - date-and-time → Date formatting
 * - path → Path manipulation
 * - os → Operating system info
 * - fs → Limited file system (localStorage fallback)
 * - dns → Network reachability
 * - is-reachable → Server connectivity check
 * 
 * @module mobile-electron-shim
 */

console.log('=== MOBILE ELECTRON SHIM: Initializing API compatibility layer ===');

/**
 * Utility: Safe object stringification with circular reference handling
 * @param {*} obj - Object to stringify
 * @param {number} indent - Indentation level (default: 2)
 * @returns {string} - Stringified object
 */
window.safeStringify = function(obj, indent = 2) {
    const seen = new WeakSet();
    try {
        return JSON.stringify(obj, (key, value) => {
            // Handle circular references
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular Reference]';
                }
                seen.add(value);
            }
            // Handle functions
            if (typeof value === 'function') {
                return `[Function: ${value.name || 'anonymous'}]`;
            }
            // Handle undefined
            if (value === undefined) {
                return '[undefined]';
            }
            // Handle DOM elements
            if (value instanceof Element) {
                return `[Element: ${value.tagName}${value.id ? '#' + value.id : ''}]`;
            }
            return value;
        }, indent);
    } catch (error) {
        return `[Object: ${Object.prototype.toString.call(obj)}] - Error: ${error.message}`;
    }
};

/**
 * Electron-log compatible logging API
 * Uses console with proper formatting for mobile
 */
window.log = {
    info: (...args) => {
        console.log('[INFO]', ...args);
    },
    warn: (...args) => {
        console.warn('[WARN]', ...args);
    },
    error: (...args) => {
        console.error('[ERROR]', ...args);
    },
    debug: (...args) => {
        console.log('[DEBUG]', ...args);
    },
    verbose: (...args) => {
        console.log('[VERBOSE]', ...args);
    },
    silly: (...args) => {
        console.log('[SILLY]', ...args);
    },
    // Electron-log transports stub
    transports: {
        file: {
            file: '/tmp/ecless-mobile.log'
        },
        console: {
            level: 'info'
        }
    }
};

/**
 * XML to JSON converter (xml-js compatible)
 * Uses DOMParser for XML parsing
 */
window.xmljs = {
    xml2json: (xml, options) => {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xml, 'text/xml');
            
            // Convert XML DOM to JSON
            function xmlToJson(node) {
                const obj = {};
                
                // Handle attributes
                if (node.attributes && node.attributes.length > 0) {
                    obj.attributes = {};
                    for (let i = 0; i < node.attributes.length; i++) {
                        const attr = node.attributes[i];
                        obj.attributes[attr.nodeName] = attr.nodeValue;
                    }
                }
                
                // Handle node name
                obj.name = node.nodeName;
                
                // Handle text content
                if (node.childNodes.length === 1 && node.childNodes[0].nodeType === 3) {
                    obj.text = node.childNodes[0].nodeValue;
                }
                
                // Handle child elements
                if (node.childNodes.length > 0) {
                    obj.elements = [];
                    for (let i = 0; i < node.childNodes.length; i++) {
                        const child = node.childNodes[i];
                        if (child.nodeType === 1) { // Element node
                            obj.elements.push(xmlToJson(child));
                        }
                    }
                }
                
                return obj;
            }
            
            const result = { elements: [xmlToJson(xmlDoc.documentElement)] };
            return JSON.stringify(result, null, options.spaces || 0);
            
        } catch (error) {
            console.error('XML parsing error:', error);
            throw error;
        }
    },
    
    json2xml: (json, options) => {
        // Simplified json2xml for mobile
        console.warn('json2xml not fully implemented for mobile');
        return json;
    }
};

window.convert = window.xmljs; // Alias

/**
 * Date and time formatting (date-and-time v4.x library)
 * 
 * The actual date-and-time library is loaded from datetime.bundle.js.
 * This shim expects window.DateTimeBundle to be available from that bundle.
 * 
 * Note: date-and-time v4.x has built-in support for most formats including:
 * - YYYY, MM, DD, HH, mm, ss (basic date/time)
 * - MMM, MMMM (month names)
 * - ddd, dddd (day names)  
 * - hh, A (12-hour format with AM/PM)
 * - And many more!
 */
if (typeof window.DateTimeBundle !== 'undefined') {
    // Use the real date-and-time library from the bundle
    window.datetime = window.DateTimeBundle;
    console.log('[Mobile Shim] ✓ Using date-and-time v4.x library from bundle');
    console.log('[Mobile Shim] Available datetime functions:', Object.keys(window.datetime));
} else {
    // Fallback: Basic implementation if bundle not loaded
    console.warn('[Mobile Shim] ⚠ datetime.bundle.js not loaded! Using basic fallback.');
    window.datetime = {
        format: (date, format) => {
            const d = new Date(date);
            const pad = (num) => String(num).padStart(2, '0');
            
            // Basic format tokens only (insufficient for production)
            return format
                .replace('YYYY', d.getFullYear())
                .replace('MM', pad(d.getMonth() + 1))
                .replace('DD', pad(d.getDate()))
                .replace('HH', pad(d.getHours()))
                .replace('mm', pad(d.getMinutes()))
                .replace('ss', pad(d.getSeconds()));
        },
        
        parse: (dateString, format) => {
            return new Date(dateString);
        }
    };
}

// Plugin stubs for backward compatibility (v4.x doesn't use plugin system)
window.meridiem = (datetime) => {
    // No-op: v4.x has built-in AM/PM support via 'A' token
};

window.ordinal = (datetime) => {
    // No-op: v4.x has built-in ordinal support
};

/**
 * Path manipulation (Node.js path compatible)
 */
window.path = {
    join: (...parts) => {
        return parts.join('/').replace(/\/+/g, '/');
    },
    
    normalize: (path) => {
        return path.replace(/\/+/g, '/').replace(/\/$/, '');
    },
    
    basename: (path, ext) => {
        const base = path.split('/').pop();
        if (ext && base.endsWith(ext)) {
            return base.slice(0, -ext.length);
        }
        return base;
    },
    
    dirname: (path) => {
        return path.split('/').slice(0, -1).join('/') || '/';
    },
    
    extname: (path) => {
        const base = path.split('/').pop();
        const dotIndex = base.lastIndexOf('.');
        return dotIndex > 0 ? base.slice(dotIndex) : '';
    }
};

/**
 * Operating system info (Node.js os compatible)
 */
window.os = {
    homedir: () => {
        // On mobile, return a virtual home directory
        return '/storage/emulated/0/eCLESS';
    },
    
    platform: () => {
        if (window.capacitorAPI && window.capacitorAPI.platform) {
            return window.capacitorAPI.platform;
        }
        return 'mobile';
    },
    
    type: () => {
        return window.os.platform();
    },
    
    hostname: () => {
        return 'ecless-mobile';
    },
    
    tmpdir: () => {
        return '/tmp';
    }
};

/**
 * File system operations (Capacitor Filesystem API wrapper)
 * Provides Node.js fs-like API using Capacitor under the hood
 */
window.fs = {
    /**
     * Synchronous existence check (returns false, use async version)
     * @deprecated Use fs.existsAsync() instead for proper mobile support
     */
    existsSync: (path) => {
        console.warn('fs.existsSync: Synchronous file operations not supported on mobile. Use fs.existsAsync() instead.');
        return false;
    },
    
    /**
     * Async existence check using Capacitor Filesystem API
     * @param {string} path - File path to check
     * @returns {Promise<boolean>} - True if file exists
     */
    existsAsync: async (path) => {
        try {
            if (!window.capacitorAPI || !window.capacitorAPI.fileExists) {
                console.warn('fs.existsAsync: Capacitor API not available');
                return false;
            }
            
            return await window.capacitorAPI.fileExists(path);
            
        } catch (error) {
            console.warn('fs.existsAsync: Error checking file existence:', error);
            return false;
        }
    },
    
    /**
     * Synchronous file read (not supported)
     * @deprecated Use fs.readFileAsync() instead
     */
    readFileSync: (path, encoding) => {
        console.warn('fs.readFileSync: Synchronous file operations not supported on mobile. Use fs.readFileAsync() instead.');
        return '';
    },
    
    /**
     * Async file read using Capacitor Filesystem API
     * @param {string} path - File path to read
     * @param {string} encoding - Encoding (default: 'utf8')
     * @returns {Promise<string>} - File contents
     */
    readFileAsync: async (path, encoding = 'utf8') => {
        try {
            if (!window.capacitorAPI || !window.capacitorAPI.readFile) {
                throw new Error('Capacitor API not available');
            }
            
            return await window.capacitorAPI.readFile(path);
            
        } catch (error) {
            console.error('fs.readFileAsync: Error reading file:', error);
            throw error;
        }
    },
    
    /**
     * Synchronous file write (not supported)
     * @deprecated Use fs.writeFileAsync() instead
     */
    writeFileSync: (path, data, encoding) => {
        console.warn('fs.writeFileSync: Synchronous file operations not supported on mobile. Use fs.writeFileAsync() instead.');
    },
    
    /**
     * Async file write using Capacitor Filesystem API
     * @param {string} path - File path to write
     * @param {string} data - Data to write
     * @param {string} encoding - Encoding (default: 'utf8')
     * @returns {Promise<boolean>} - True if successful
     */
    writeFileAsync: async (path, data, encoding = 'utf8') => {
        try {
            if (!window.capacitorAPI || !window.capacitorAPI.writeFile) {
                throw new Error('Capacitor API not available');
            }
            
            await window.capacitorAPI.writeFile(path, data);
            return true;
            
        } catch (error) {
            console.error('fs.writeFileAsync: Error writing file:', error);
            throw error;
        }
    },
    
    /**
     * Synchronous directory creation (not supported)
     * @deprecated Use fs.mkdirAsync() instead
     */
    mkdirSync: (path, options) => {
        console.warn('fs.mkdirSync: Synchronous file operations not supported on mobile. Use fs.mkdirAsync() instead.');
    },
    
    /**
     * Async directory creation using Capacitor Filesystem API
     * @param {string} path - Directory path to create
     * @param {object} options - Options (recursive, etc.)
     * @returns {Promise<boolean>} - True if successful
     */
    mkdirAsync: async (path, options = {}) => {
        try {
            if (!window.capacitorAPI || !window.capacitorAPI.createDirectory) {
                throw new Error('Capacitor API not available');
            }
            
            await window.capacitorAPI.createDirectory(path);
            return true;
            
        } catch (error) {
            console.error('fs.mkdirAsync: Error creating directory:', error);
            throw error;
        }
    },
    
    /**
     * Synchronous directory read (not supported)
     * @deprecated Use fs.readdirAsync() instead
     */
    readdirSync: (path) => {
        console.warn('fs.readdirSync: Synchronous file operations not supported on mobile. Use fs.readdirAsync() instead.');
        return [];
    },
    
    /**
     * Async directory read using Capacitor Filesystem API
     * @param {string} path - Directory path to read
     * @returns {Promise<Array>} - Array of file/directory names
     */
    readdirAsync: async (path) => {
        try {
            if (!window.capacitorAPI || !window.capacitorAPI.readDirectory) {
                throw new Error('Capacitor API not available');
            }
            
            const files = await window.capacitorAPI.readDirectory(path);
            return files.map(f => f.name || f);
            
        } catch (error) {
            console.error('fs.readdirAsync: Error reading directory:', error);
            throw error;
        }
    }
};

/**
 * DNS lookup (stub for mobile)
 */
window.dns = {
    lookup: (hostname, callback) => {
        console.warn('dns.lookup stub - returning mock data');
        if (callback) {
            callback(null, '127.0.0.1', 4);
        }
    }
};

/**
 * Network reachability check
 * Uses Capacitor Network plugin or fetch API
 */
window.isReachable = async (url) => {
    try {
        // Check network status first
        if (window.capacitorAPI && window.capacitorAPI.getNetworkStatus) {
            const status = await window.capacitorAPI.getNetworkStatus();
            if (!status.connected) {
                console.warn('isReachable: Device is offline');
                return false;
            }
        }
        
        // Try to fetch the URL with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        try {
            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            return true;
            
        } catch (fetchError) {
            clearTimeout(timeout);
            
            // If HEAD fails, it might be a CORS issue - server could still be reachable
            // Return true if it's a network error type that indicates the server responded
            if (fetchError.name === 'AbortError') {
                console.warn('isReachable: Request timeout');
                return false;
            }
            
            // For CORS or other errors, assume server is reachable but blocking requests
            console.log('isReachable: Fetch blocked (possibly CORS), assuming reachable');
            return true;
        }
        
    } catch (error) {
        console.error('isReachable: Error checking reachability', error);
        return false;
    }
};

/**
 * IPC Renderer stub (Electron inter-process communication)
 * For mobile, this can emit events locally
 */
window.ipcRenderer = {
    send: (channel, ...args) => {
        console.log('IPC send:', channel, args);
        
        // Emit as custom event
        window.dispatchEvent(new CustomEvent('ipc-' + channel, {
            detail: args
        }));
    },
    
    on: (channel, callback) => {
        console.log('IPC on:', channel);
        
        window.addEventListener('ipc-' + channel, (event) => {
            callback(event, ...(event.detail || []));
        });
    },
    
    once: (channel, callback) => {
        console.log('IPC once:', channel);
        
        window.addEventListener('ipc-' + channel, (event) => {
            callback(event, ...(event.detail || []));
        }, { once: true });
    },
    
    removeListener: (channel, callback) => {
        window.removeEventListener('ipc-' + channel, callback);
    },
    
    removeAllListeners: (channel) => {
        console.log('IPC removeAllListeners:', channel);
    }
};

/**
 * Remote module stub (Electron remote)
 */
window.remote = {
    getCurrentWindow: () => {
        return {
            reload: () => {
                window.location.reload();
            },
            close: () => {
                if (window.capacitorAPI && window.capacitorAPI.exitApp) {
                    window.capacitorAPI.exitApp();
                }
            },
            focus: () => {
                window.focus();
            },
            setFullScreen: (flag) => {
                console.log('setFullScreen:', flag);
            },
            /**
             * setBounds - Mobile-compatible implementation
             * On mobile, we cannot resize windows like Electron desktop.
             * Instead, we ensure the viewport is properly configured and
             * store the intended dimensions for layout scaling purposes.
             * 
             * @param {Object} bounds - { x, y, width, height }
             */
            setBounds: (bounds) => {
                console.log('[Mobile] setBounds called with:', bounds);
                
                // On mobile, we work with viewport dimensions
                // Store the intended layout dimensions for scaling calculations
                if (typeof bounds === 'object' && bounds !== null) {
                    window.layoutDimensions = {
                        width: bounds.width || window.innerWidth,
                        height: bounds.height || window.innerHeight,
                        x: bounds.x || 0,
                        y: bounds.y || 0
                    };
                    
                    console.log('[Mobile] Layout dimensions stored:', window.layoutDimensions);
                    
                    // Emit event for any listeners that need to know about dimension changes
                    window.dispatchEvent(new CustomEvent('layout-dimensions-changed', {
                        detail: window.layoutDimensions
                    }));
                    
                    // On mobile, always use fullscreen viewport
                    // Ensure body and html are properly sized
                    document.documentElement.style.width = '100%';
                    document.documentElement.style.height = '100%';
                    document.body.style.width = '100%';
                    document.body.style.height = '100%';
                    document.body.style.margin = '0';
                    document.body.style.padding = '0';
                    document.body.style.overflow = 'hidden';
                }
            },
            /**
             * getBounds - Return current viewport bounds
             * @returns {Object} { x, y, width, height }
             */
            getBounds: () => {
                return window.layoutDimensions || {
                    x: 0,
                    y: 0,
                    width: window.innerWidth,
                    height: window.innerHeight
                };
            },
            /**
             * center - Center window (no-op on mobile)
             * On mobile, the viewport is always fullscreen, so centering doesn't apply
             */
            center: () => {
                console.log('[Mobile] center() called - no-op on mobile (always fullscreen)');
            }
        };
    },
    
    app: {
        relaunch: () => {
            window.location.reload();
        },
        quit: () => {
            if (window.capacitorAPI && window.capacitorAPI.exitApp) {
                window.capacitorAPI.exitApp();
            }
        }
    }
};

/**
 * Log directory for compatibility (not used on mobile)
 */
window.logdir = '/storage/emulated/0/eCLESS/logs/';

/**
 * Mobile API wrapper for better organization
 */
window.mobileAPI = {
    ipc: window.ipcRenderer,
    remote: window.remote,
    log: window.log,
    isNative: window.capacitorAPI && window.capacitorAPI.isNative || false
};

console.log('=== MOBILE ELECTRON SHIM: Initialized successfully ===');
console.log('Available APIs: log, xmljs, datetime, path, os, fs, dns, isReachable, ipcRenderer, remote, logdir');
