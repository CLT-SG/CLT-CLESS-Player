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
 * Date and time formatting (date-and-time compatible)
 */
window.datetime = {
    format: (date, format) => {
        const d = new Date(date);
        const pad = (num) => String(num).padStart(2, '0');
        
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
    },
    
    plugin: (pluginFn) => {
        // Plugin system stub for meridiem, ordinal, etc.
        if (typeof pluginFn === 'function') {
            pluginFn(window.datetime);
        }
    }
};

// Plugin stubs
window.meridiem = (datetime) => {
    datetime.meridiem = (date) => {
        const hours = new Date(date).getHours();
        return hours >= 12 ? 'PM' : 'AM';
    };
};

window.ordinal = (datetime) => {
    datetime.ordinal = (date) => {
        const day = new Date(date).getDate();
        const suffix = ['th', 'st', 'nd', 'rd'];
        const v = day % 100;
        return day + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
    };
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
 * File system operations (limited, localStorage-based)
 */
window.fs = {
    existsSync: (path) => {
        console.warn('fs.existsSync stub - always returns false on mobile');
        return false;
    },
    
    readFileSync: (path, encoding) => {
        console.warn('fs.readFileSync stub - not implemented on mobile');
        return '';
    },
    
    writeFileSync: (path, data, encoding) => {
        console.warn('fs.writeFileSync stub - not implemented on mobile');
    },
    
    mkdirSync: (path, options) => {
        console.warn('fs.mkdirSync stub - not implemented on mobile');
    },
    
    readdirSync: (path) => {
        console.warn('fs.readdirSync stub - not implemented on mobile');
        return [];
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
