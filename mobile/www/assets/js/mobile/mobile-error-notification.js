/**
 * eCLESS Player Mobile - Error Notification System
 * 
 * Provides visual feedback for errors and important events
 * 
 * @module mobile-error-notification
 */

console.log('=== MOBILE ERROR NOTIFICATION: Initializing ===');

class ErrorNotificationSystem {
    constructor() {
        this.container = null;
        this.activeNotifications = [];
        this.init();
    }

    init() {
        // Create notification container
        this.container = document.createElement('div');
        this.container.id = 'error-notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            z-index: 99998;
            max-width: 400px;
            pointer-events: none;
        `;
        
        // Add to DOM when ready
        if (document.body) {
            document.body.appendChild(this.container);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.appendChild(this.container);
            });
        }
        
        console.log('ErrorNotification: Initialized');
    }

    /**
     * Show error notification
     * 
     * @param {string} title - Error title
     * @param {string} message - Error message
     * @param {string} type - Type: 'error', 'warning', 'info', 'success'
     * @param {number} duration - Auto-hide duration (0 = permanent)
     */
    show(title, message, type = 'error', duration = 5000) {
        const notification = document.createElement('div');
        const id = 'notif-' + Date.now() + '-' + Math.random();
        notification.id = id;
        
        const colors = {
            error: { bg: '#dc3545', icon: '❌' },
            warning: { bg: '#ffc107', icon: '⚠️' },
            info: { bg: '#17a2b8', icon: 'ℹ️' },
            success: { bg: '#28a745', icon: '✅' }
        };
        
        const style = colors[type] || colors.error;
        
        notification.style.cssText = `
            background: ${style.bg};
            color: white;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
            pointer-events: auto;
            cursor: pointer;
            position: relative;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: start; gap: 10px;">
                <div style="font-size: 24px; flex-shrink: 0;">${style.icon}</div>
                <div style="flex: 1;">
                    <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">${title}</div>
                    <div style="font-size: 14px; opacity: 0.9; line-height: 1.4;">${message}</div>
                </div>
                <button onclick="window.errorNotification.hide('${id}')" style="
                    background: transparent;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">×</button>
            </div>
        `;
        
        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => this.hide(id), duration);
        }
        
        // Add click to dismiss
        notification.addEventListener('click', (e) => {
            if (e.target === notification || e.target.tagName === 'DIV') {
                this.hide(id);
            }
        });
        
        this.container.appendChild(notification);
        this.activeNotifications.push(id);
        
        console.log('ErrorNotification: Shown -', title);
        
        return id;
    }

    /**
     * Hide notification
     */
    hide(id) {
        const notification = document.getElementById(id);
        if (notification) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                notification.remove();
                this.activeNotifications = this.activeNotifications.filter(n => n !== id);
            }, 300);
        }
    }

    /**
     * Show error
     */
    error(title, message, duration = 0) {
        return this.show(title, message, 'error', duration);
    }

    /**
     * Show warning
     */
    warning(title, message, duration = 5000) {
        return this.show(title, message, 'warning', duration);
    }

    /**
     * Show info
     */
    info(title, message, duration = 3000) {
        return this.show(title, message, 'info', duration);
    }

    /**
     * Show success
     */
    success(title, message, duration = 3000) {
        return this.show(title, message, 'success', duration);
    }

    /**
     * Clear all notifications
     */
    clearAll() {
        this.activeNotifications.forEach(id => this.hide(id));
    }

    /**
     * Show a persistent codec error overlay with actionable buttons
     * options: { title, message, details, actions: [{ label, type('primary'|'secondary'), callback }], timeout }
     */
    codecError(options) {
        try {
            const id = 'codec-' + Date.now() + '-' + Math.random();
            const overlay = document.createElement('div');
            overlay.id = id;
            overlay.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100000;
                background: rgba(0,0,0,0.6);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;

            const box = document.createElement('div');
            box.style.cssText = `
                background: #111;
                color: white;
                padding: 20px;
                width: min(720px, 92%);
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                text-align: left;
            `;

            const title = document.createElement('div');
            title.style.cssText = 'font-weight: 700; font-size: 18px; margin-bottom: 8px;';
            title.textContent = options.title || 'Playback Error';

            const msg = document.createElement('div');
            msg.style.cssText = 'font-size: 14px; opacity: 0.95; margin-bottom: 12px; white-space: pre-wrap;';
            msg.textContent = options.message || '';

            const detail = document.createElement('div');
            detail.style.cssText = 'font-size: 12px; opacity: 0.8; margin-bottom: 14px;';
            detail.textContent = options.details ? JSON.stringify(options.details) : '';

            const actionsDiv = document.createElement('div');
            actionsDiv.style.cssText = 'display:flex; gap:10px; justify-content:flex-end;';

            (options.actions || []).forEach((act, idx) => {
                const btn = document.createElement('button');
                btn.textContent = act.label || ('Action ' + (idx+1));
                btn.style.cssText = `
                    padding: 10px 14px;
                    border-radius: 8px;
                    font-size: 14px;
                    cursor: pointer;
                    border: none;
                `;
                if ((act.type || 'secondary') === 'primary') {
                    btn.style.background = '#28a745';
                    btn.style.color = 'white';
                } else {
                    btn.style.background = '#333';
                    btn.style.color = 'white';
                }

                btn.addEventListener('click', (e) => {
                    try {
                        if (typeof act.callback === 'function') {
                            act.callback();
                        }
                    } catch (cbErr) {
                        console.warn('ErrorNotification: codecError action callback threw:', cbErr);
                    }
                    // remove overlay when action clicked unless callback returns false
                    try {
                        overlay.remove();
                    } catch (e) {}
                });

                actionsDiv.appendChild(btn);
            });

            // Dismiss button
            const dismiss = document.createElement('button');
            dismiss.textContent = 'Dismiss';
            dismiss.style.cssText = `
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 13px;
                cursor: pointer;
                background: transparent;
                color: #ddd;
                border: 1px solid rgba(255,255,255,0.06);
            `;
            dismiss.addEventListener('click', () => overlay.remove());
            actionsDiv.appendChild(dismiss);

            box.appendChild(title);
            box.appendChild(msg);
            if (options.details) box.appendChild(detail);
            box.appendChild(actionsDiv);
            overlay.appendChild(box);

            document.body.appendChild(overlay);

            // Auto-dismiss after timeout (if set)
            if (options.timeout && options.timeout > 0) {
                setTimeout(() => {
                    try { overlay.remove(); } catch (e) {}
                }, options.timeout);
            }

            return id;
        } catch (error) {
            console.warn('ErrorNotification: codecError failed:', error);
            return null;
        }
    }
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(120%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(120%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Create singleton
const errorNotification = new ErrorNotificationSystem();
window.errorNotification = errorNotification;

console.log('=== MOBILE ERROR NOTIFICATION: Initialized successfully ===');

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = errorNotification;
}
