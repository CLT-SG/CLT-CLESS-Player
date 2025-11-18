/**
 * Custom Dialog Utility for eCLESS Player
 * 
 * Professional modal dialog system that works with alwaysOnTop windows
 * Replaces native alert() and confirm() calls with custom HTML/CSS dialogs
 * 
 * Features:
 * - Auto-dismiss timeout for informational alerts (5 seconds default)
 * - Keyboard support (Enter/Escape keys)
 * - Professional styling matching eCLESS design
 * - Works properly with Electron alwaysOnTop windows
 * 
 * @author Closed-Loop Technology Pte Ltd
 * @version 1.0.0
 */

(function(window) {
  'use strict';

  // Dialog manager class
  class CustomDialog {
    constructor() {
      this.activeDialog = null;
      this.defaultTimeout = 5000; // 5 seconds auto-dismiss for alerts
      this.timeoutId = null;
      this.keyboardHandler = null;
    }

    /**
     * Show alert dialog with auto-dismiss
     * @param {string} message - Message to display
     * @param {object} options - Configuration options
     * @returns {Promise} Resolves when dialog is dismissed
     */
    alert(message, options = {}) {
      return new Promise((resolve) => {
        const config = {
          title: options.title || 'eCLESS Player',
          timeout: options.timeout !== undefined ? options.timeout : this.defaultTimeout,
          type: options.type || 'info', // 'info', 'success', 'warning', 'error'
          buttonText: options.buttonText || 'OK'
        };

        this._createDialog({
          title: config.title,
          message: message,
          type: config.type,
          buttons: [
            {
              text: config.buttonText,
              class: 'btn-primary',
              callback: () => {
                this._closeDialog();
                resolve(true);
              }
            }
          ],
          timeout: config.timeout,
          onTimeout: () => {
            this._closeDialog();
            resolve(true);
          }
        });
      });
    }

    /**
     * Show confirm dialog (no auto-dismiss)
     * @param {string} message - Message to display
     * @param {object} options - Configuration options
     * @returns {Promise<boolean>} Resolves with true/false based on user choice
     */
    confirm(message, options = {}) {
      return new Promise((resolve) => {
        const config = {
          title: options.title || 'Confirm',
          confirmText: options.confirmText || 'OK',
          cancelText: options.cancelText || 'Cancel',
          type: options.type || 'question'
        };

        this._createDialog({
          title: config.title,
          message: message,
          type: config.type,
          buttons: [
            {
              text: config.cancelText,
              class: 'btn-secondary',
              callback: () => {
                this._closeDialog();
                resolve(false);
              }
            },
            {
              text: config.confirmText,
              class: 'btn-primary',
              callback: () => {
                this._closeDialog();
                resolve(true);
              }
            }
          ],
          timeout: null, // No timeout for confirm dialogs
          onCancel: () => {
            this._closeDialog();
            resolve(false);
          }
        });
      });
    }

    /**
     * Create and display dialog
     * @private
     */
    _createDialog(config) {
      // Remove any existing dialog
      if (this.activeDialog) {
        this._closeDialog();
      }

      // Create dialog overlay
      const overlay = document.createElement('div');
      overlay.className = 'custom-dialog-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        animation: fadeIn 0.2s ease-in-out;
      `;

      // Create dialog container
      const dialog = document.createElement('div');
      dialog.className = 'custom-dialog';
      dialog.style.cssText = `
        background: white;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        min-width: 400px;
        padding: 0;
        animation: slideIn 0.3s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      `;

      // Icon map
      const iconMap = {
        info: { icon: 'ℹ️', color: '#2196F3' },
        success: { icon: '✅', color: '#4CAF50' },
        warning: { icon: '⚠️', color: '#FF9800' },
        error: { icon: '❌', color: '#F44336' },
        question: { icon: '❓', color: '#9C27B0' }
      };

      const iconData = iconMap[config.type] || iconMap.info;

      // Create header
      const header = document.createElement('div');
      header.style.cssText = `
        padding: 20px 24px;
        border-bottom: 1px solid #e0e0e0;
        background: linear-gradient(135deg, ${iconData.color}15 0%, ${iconData.color}05 100%);
      `;

      const headerTitle = document.createElement('div');
      headerTitle.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 18px;
        font-weight: 600;
        color: #333;
      `;

      const iconSpan = document.createElement('span');
      iconSpan.style.cssText = `
        font-size: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      `;
      iconSpan.textContent = iconData.icon;

      const titleText = document.createElement('span');
      titleText.textContent = config.title;

      headerTitle.appendChild(iconSpan);
      headerTitle.appendChild(titleText);
      header.appendChild(headerTitle);

      // Create body
      const body = document.createElement('div');
      body.style.cssText = `
        padding: 24px;
        color: #555;
        font-size: 14px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-wrap: break-word;
        max-height: 400px;
        overflow-y: auto;
      `;
      body.textContent = config.message;

      // Create footer
      const footer = document.createElement('div');
      footer.style.cssText = `
        padding: 16px 24px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        background: #f9f9f9;
        border-radius: 0 0 8px 8px;
      `;

      // Create buttons
      config.buttons.forEach((buttonConfig, index) => {
        const button = document.createElement('button');
        button.textContent = buttonConfig.text;
        button.className = buttonConfig.class;
        
        const isPrimary = buttonConfig.class.includes('primary');
        button.style.cssText = `
          padding: 10px 24px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          ${isPrimary ? `
            background: linear-gradient(135deg, #0072ff 0%, #0062cc 100%);
            color: white;
          ` : `
            background: #e0e0e0;
            color: #666;
          `}
        `;

        // Hover effect
        button.addEventListener('mouseenter', () => {
          button.style.transform = 'translateY(-1px)';
          button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          if (isPrimary) {
            button.style.background = 'linear-gradient(135deg, #0062cc 0%, #0052b3 100%)';
          } else {
            button.style.background = '#d0d0d0';
          }
        });

        button.addEventListener('mouseleave', () => {
          button.style.transform = 'translateY(0)';
          button.style.boxShadow = 'none';
          if (isPrimary) {
            button.style.background = 'linear-gradient(135deg, #0072ff 0%, #0062cc 100%)';
          } else {
            button.style.background = '#e0e0e0';
          }
        });

        button.addEventListener('click', buttonConfig.callback);
        footer.appendChild(button);

        // Auto-focus first button (or last for primary)
        if ((isPrimary && index === config.buttons.length - 1) || 
            (!config.buttons.some(b => b.class.includes('primary')) && index === 0)) {
          setTimeout(() => button.focus(), 100);
        }
      });

      // Add timeout indicator if applicable
      if (config.timeout && config.timeout > 0) {
        const timeoutIndicator = document.createElement('div');
        timeoutIndicator.style.cssText = `
          padding: 8px 24px;
          text-align: center;
          font-size: 12px;
          color: #999;
          font-style: italic;
        `;
        timeoutIndicator.textContent = `This dialog will automatically close in ${Math.ceil(config.timeout / 1000)} seconds...`;
        footer.insertBefore(timeoutIndicator, footer.firstChild);

        // Start countdown
        let remaining = Math.ceil(config.timeout / 1000);
        const countdownInterval = setInterval(() => {
          remaining--;
          if (remaining > 0) {
            timeoutIndicator.textContent = `This dialog will automatically close in ${remaining} second${remaining !== 1 ? 's' : ''}...`;
          } else {
            clearInterval(countdownInterval);
          }
        }, 1000);

        // Set timeout
        this.timeoutId = setTimeout(() => {
          clearInterval(countdownInterval);
          if (config.onTimeout) {
            config.onTimeout();
          }
        }, config.timeout);
      }

      // Assemble dialog
      dialog.appendChild(header);
      dialog.appendChild(body);
      dialog.appendChild(footer);
      overlay.appendChild(dialog);

      // Keyboard handler
      this.keyboardHandler = (e) => {
        if (e.key === 'Escape' && config.onCancel) {
          e.preventDefault();
          config.onCancel();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          // Trigger primary button or first button
          const primaryButton = config.buttons.find(b => b.class.includes('primary'));
          if (primaryButton) {
            primaryButton.callback();
          } else if (config.buttons.length > 0) {
            config.buttons[0].callback();
          }
        }
      };

      document.addEventListener('keydown', this.keyboardHandler);

      // Add to document
      document.body.appendChild(overlay);
      this.activeDialog = overlay;

      // Add CSS animations if not already added
      if (!document.getElementById('custom-dialog-styles')) {
        const style = document.createElement('style');
        style.id = 'custom-dialog-styles';
        style.textContent = `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `;
        document.head.appendChild(style);
      }
    }

    /**
     * Close active dialog
     * @private
     */
    _closeDialog() {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      if (this.keyboardHandler) {
        document.removeEventListener('keydown', this.keyboardHandler);
        this.keyboardHandler = null;
      }

      if (this.activeDialog) {
        this.activeDialog.style.opacity = '0';
        this.activeDialog.style.transition = 'opacity 0.2s ease-in-out';
        
        setTimeout(() => {
          if (this.activeDialog && this.activeDialog.parentNode) {
            this.activeDialog.parentNode.removeChild(this.activeDialog);
          }
          this.activeDialog = null;
        }, 200);
      }
    }
  }

  // Create global instance
  const dialogManager = new CustomDialog();

  // Export to window object (override native functions)
  window.customDialog = dialogManager;

  // Create wrapper functions for easy replacement
  window.customAlert = function(message, options) {
    return dialogManager.alert(message, options);
  };

  window.customConfirm = function(message, options) {
    return dialogManager.confirm(message, options);
  };

  console.log('Custom Dialog System initialized');

})(window);
