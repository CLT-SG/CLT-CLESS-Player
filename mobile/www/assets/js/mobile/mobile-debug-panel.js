/**
 * eCLESS Player Mobile - Debug Panel
 * 
 * Provides real-time debug logging and diagnostics accessible via mobile UI
 * 
 * @module mobile-debug-panel
 */

console.log('=== MOBILE DEBUG PANEL: Initializing ===');

class MobileDebugPanel {
    constructor() {
        this.logs = [];
        this.maxLogs = 500;
        this.isVisible = false;
        this.panel = null;
        
        // Intercept console methods
        this.interceptConsole();
        
        // Create panel UI
        this.createPanel();
        
        // Make globally accessible
        window.debugPanel = this;
    }

    /**
     * Intercept console methods to capture logs
     */
    interceptConsole() {
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        const originalInfo = console.info;
        
        const self = this;
        
        console.log = function(...args) {
            self.addLog('LOG', args);
            originalLog.apply(console, args);
        };
        
        console.warn = function(...args) {
            self.addLog('WARN', args);
            originalWarn.apply(console, args);
        };
        
        console.error = function(...args) {
            self.addLog('ERROR', args);
            originalError.apply(console, args);
        };
        
        console.info = function(...args) {
            self.addLog('INFO', args);
            originalInfo.apply(console, args);
        };
    }

    /**
     * Safely stringify objects with circular reference handling
     */
    safeStringify(obj, indent = 2) {
        const seen = new WeakSet();
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
            return value;
        }, indent);
    }

    /**
     * Add log entry
     */
    addLog(type, args) {
        const timestamp = new Date().toISOString();
        const message = args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                try {
                    // Use safe stringify with pretty printing for better readability
                    return this.safeStringify(arg, 2);
                } catch (e) {
                    // Fallback to string representation
                    return `[Object: ${Object.prototype.toString.call(arg)}]`;
                }
            }
            return String(arg);
        }).join(' ');

        this.logs.push({
            timestamp,
            type,
            message
        });

        // Limit log size
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Update panel if visible
        if (this.isVisible) {
            this.updatePanel();
        }
    }

    /**
     * Create debug panel UI
     */
    createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'mobile-debug-panel';
        this.panel.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            z-index: 999997;
            display: none;
            flex-direction: column;
            overflow: hidden;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 15px;
            background: #1a1a1a;
            border-bottom: 2px solid #00ff00;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <div>
                <div style="font-size: 16px; font-weight: bold;">🐛 Debug Console</div>
                <div style="font-size: 10px; color: #888; margin-top: 5px;">eCLESS Player Mobile Diagnostics</div>
            </div>
            <button id="debug-close-btn" style="
                background: #dc3545;
                color: white;
                border: none;
                padding: 8px 15px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 12px;
                font-weight: bold;
            ">✕ Close</button>
        `;

        // Controls
        const controls = document.createElement('div');
        controls.style.cssText = `
            padding: 10px 15px;
            background: #2a2a2a;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        `;
        controls.innerHTML = `
            <button id="debug-clear-btn" style="background:#ffc107;color:#000;border:none;padding:5px 10px;border-radius:3px;cursor:pointer;font-size:11px;">Clear</button>
            <button id="debug-filter-all" style="background:#28a745;color:#fff;border:none;padding:5px 10px;border-radius:3px;cursor:pointer;font-size:11px;">All</button>
            <button id="debug-filter-error" style="background:#dc3545;color:#fff;border:none;padding:5px 10px;border-radius:3px;cursor:pointer;font-size:11px;">Errors</button>
            <button id="debug-filter-warn" style="background:#ff9800;color:#fff;border:none;padding:5px 10px;border-radius:3px;cursor:pointer;font-size:11px;">Warnings</button>
            <button id="debug-export-btn" style="background:#17a2b8;color:#fff;border:none;padding:5px 10px;border-radius:3px;cursor:pointer;font-size:11px;">Export</button>
            <span style="color:#888;font-size:10px;line-height:26px;margin-left:auto;" id="debug-log-count">Logs: 0</span>
        `;

        // Log container
        const logContainer = document.createElement('div');
        logContainer.id = 'debug-log-container';
        logContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 10px 15px;
            white-space: pre-wrap;
            word-break: break-word;
        `;

        this.panel.appendChild(header);
        this.panel.appendChild(controls);
        this.panel.appendChild(logContainer);

        // Add to body when DOM is ready
        if (document.body) {
            document.body.appendChild(this.panel);
            this.attachEventListeners();
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.appendChild(this.panel);
                this.attachEventListeners();
            });
        }
    }

    /**
     * Attach event listeners to panel controls
     */
    attachEventListeners() {
        const self = this;

        document.getElementById('debug-close-btn')?.addEventListener('click', () => {
            self.hide();
        });

        document.getElementById('debug-clear-btn')?.addEventListener('click', () => {
            self.clear();
        });

        document.getElementById('debug-filter-all')?.addEventListener('click', () => {
            self.filterType = null;
            self.updatePanel();
        });

        document.getElementById('debug-filter-error')?.addEventListener('click', () => {
            self.filterType = 'ERROR';
            self.updatePanel();
        });

        document.getElementById('debug-filter-warn')?.addEventListener('click', () => {
            self.filterType = 'WARN';
            self.updatePanel();
        });

        document.getElementById('debug-export-btn')?.addEventListener('click', () => {
            self.exportLogs();
        });
    }

    /**
     * Update panel content
     */
    updatePanel() {
        const container = document.getElementById('debug-log-container');
        const countEl = document.getElementById('debug-log-count');
        
        if (!container) return;

        let filteredLogs = this.logs;
        if (this.filterType) {
            filteredLogs = this.logs.filter(log => log.type === this.filterType);
        }

        container.innerHTML = filteredLogs.map(log => {
            const color = {
                'ERROR': '#ff4444',
                'WARN': '#ffaa00',
                'INFO': '#00aaff',
                'LOG': '#00ff00'
            }[log.type] || '#00ff00';

            const time = new Date(log.timestamp).toLocaleTimeString();
            
            return `<div style="margin-bottom:8px;border-left:3px solid ${color};padding-left:8px;">
                <span style="color:#888;font-size:9px;">[${time}]</span>
                <span style="color:${color};font-weight:bold;margin:0 5px;">[${log.type}]</span>
                <span style="color:#ccc;">${this.escapeHtml(log.message)}</span>
            </div>`;
        }).join('');

        if (countEl) {
            countEl.textContent = `Logs: ${filteredLogs.length}/${this.logs.length}`;
        }

        // Auto-scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Show debug panel
     */
    show() {
        if (this.panel) {
            this.panel.style.display = 'flex';
            this.isVisible = true;
            this.updatePanel();
        }
    }

    /**
     * Hide debug panel
     */
    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
            this.isVisible = false;
        }
    }

    /**
     * Toggle panel visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Clear logs
     */
    clear() {
        this.logs = [];
        this.updatePanel();
    }

    /**
     * Export logs as text
     */
    exportLogs() {
        const logText = this.logs.map(log => 
            `[${log.timestamp}] [${log.type}] ${log.message}`
        ).join('\n');

        // Create download link
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ecless-debug-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        console.log('Debug logs exported successfully');
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize debug panel
const mobileDebugPanel = new MobileDebugPanel();

// Global access function
window.toggleDebugPanel = function() {
    mobileDebugPanel.toggle();
};

console.log('=== MOBILE DEBUG PANEL: Ready ===');
console.log('💡 Use window.toggleDebugPanel() to show/hide the debug console');
