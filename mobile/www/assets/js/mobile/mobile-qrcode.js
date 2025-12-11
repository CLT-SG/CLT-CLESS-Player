/**
 * Mobile QR Code Generator Module
 * Provides QR code generation functionality for mobile app using qrcode library
 * 
 * @module mobile-qrcode
 * @version 1.0.0
 * @author Closed-Loop Technology Pte Ltd
 */

(function(window) {
  'use strict';

  /**
   * Mobile QR Code Generator Class
   * Handles QR code generation for WhatsApp license requests
   */
  class MobileQRCodeGenerator {
    constructor(options = {}) {
      this.debug = options.debug || false;
      this.log = options.logger || window.log || console;
      this.options = {
        whatsappPhone: options.whatsappPhone || '6588995538',
        width: options.width || 150,
        margin: options.margin || 1,
        darkColor: options.darkColor || '#000000',
        lightColor: options.lightColor || '#FFFFFF'
      };

      this.QRCode = null;
      this.initialized = false;

      if (this.debug) {
        this.log.info('MobileQRCodeGenerator: Initialized with options', this.options);
      }
    }

    /**
     * Initialize QR code library
     * Attempts to load QRCode from CDN or bundled source
     */
    async initialize() {
      if (this.initialized && this.QRCode) {
        return true;
      }

      try {
        // Try to use bundled QRCode library if available
        if (window.QRCode) {
          this.QRCode = window.QRCode;
          this.initialized = true;
          if (this.debug) {
            this.log.info('MobileQRCodeGenerator: Using bundled QRCode library');
          }
          return true;
        }

        // Try to load from CDN dynamically
        await this.loadQRCodeLibrary();
        
        if (window.QRCode) {
          this.QRCode = window.QRCode;
          this.initialized = true;
          if (this.debug) {
            this.log.info('MobileQRCodeGenerator: QRCode library loaded from CDN');
          }
          return true;
        }

        throw new Error('QRCode library not available');

      } catch (error) {
        this.log.error('MobileQRCodeGenerator: Failed to initialize QRCode library', error);
        return false;
      }
    }

    /**
     * Dynamically load QR code library from CDN
     */
    loadQRCodeLibrary() {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.QRCode) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.0/build/qrcode.min.js';
        script.crossOrigin = 'anonymous';
        
        script.onload = () => {
          if (this.debug) {
            this.log.debug('MobileQRCodeGenerator: QRCode library loaded successfully');
          }
          resolve();
        };
        
        script.onerror = (error) => {
          this.log.warn('MobileQRCodeGenerator: Failed to load QRCode from CDN', error);
          reject(error);
        };
        
        document.head.appendChild(script);
      });
    }

    /**
     * Generate WhatsApp QR code for license request
     * 
     * @param {HTMLCanvasElement} canvas - Canvas element to draw QR code
     * @param {string} deviceUUID - Device UUID for license request
     * @param {Object} options - Additional options
     * @returns {Promise<boolean>} Success status
     */
    async generateWhatsAppQRCode(canvas, deviceUUID, options = {}) {
      if (!canvas) {
        throw new Error('Canvas element is required');
      }

      if (!deviceUUID || deviceUUID === 'Loading...') {
        if (this.debug) {
          this.log.warn('MobileQRCodeGenerator: Device UUID not available yet');
        }
        return false;
      }

      // Ensure library is initialized
      if (!this.initialized) {
        const success = await this.initialize();
        if (!success) {
          // Fall back to simple QR code
          this.generateSimpleQRCode(canvas, deviceUUID);
          return false;
        }
      }

      // Create WhatsApp message
      const message = this.createWhatsAppMessage(deviceUUID);
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${this.options.whatsappPhone}&text=${message}`;

      if (this.debug) {
        this.log.debug('MobileQRCodeGenerator: Generating QR code for URL:', whatsappUrl);
      }

      try {
        // Generate QR code using library
        await this.QRCode.toCanvas(canvas, whatsappUrl, {
          width: options.width || this.options.width,
          margin: options.margin || this.options.margin,
          color: {
            dark: options.darkColor || this.options.darkColor,
            light: options.lightColor || this.options.lightColor
          }
        });

        // Make canvas clickable
        this.makeCanvasClickable(canvas, whatsappUrl);

        if (this.debug) {
          this.log.info('MobileQRCodeGenerator: QR code generated successfully');
        }

        return true;

      } catch (error) {
        this.log.error('MobileQRCodeGenerator: QR code generation failed', error);
        
        // Fall back to simple QR code
        this.generateSimpleQRCode(canvas, deviceUUID);
        return false;
      }
    }

    /**
     * Create WhatsApp message with device UUID
     * 
     * @param {string} deviceUUID - Device UUID
     * @returns {string} URL-encoded WhatsApp message
     */
    createWhatsAppMessage(deviceUUID) {
      return `Hello, please generate my eCLESS Mobile Player license key.%0A%0ADevice UUID: ${deviceUUID}%0A%0AThanks.`;
    }

    /**
     * Make canvas clickable to open WhatsApp
     * 
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {string} url - WhatsApp URL
     */
    makeCanvasClickable(canvas, url) {
      canvas.style.cursor = 'pointer';
      canvas.title = 'Click to open WhatsApp';
      
      canvas.onclick = () => {
        try {
          // Open WhatsApp URL
          window.open(url, '_blank');
          
          if (this.debug) {
            this.log.debug('MobileQRCodeGenerator: Opening WhatsApp URL');
          }
        } catch (error) {
          this.log.error('MobileQRCodeGenerator: Failed to open WhatsApp', error);
        }
      };
    }

    /**
     * Fallback: Generate simple placeholder QR code
     * Used when qrcode library is not available
     * 
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {string} deviceUUID - Device UUID
     */
    generateSimpleQRCode(canvas, deviceUUID) {
      const ctx = canvas.getContext('2d');
      const width = canvas.width || 150;
      const height = canvas.height || 150;

      // Clear canvas
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Draw border
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, width - 16, height - 16);

      // Draw QR pattern (simplified)
      ctx.fillStyle = '#000000';
      
      // Corner squares (position detection patterns)
      const squareSize = Math.floor(width / 6);
      ctx.fillRect(15, 15, squareSize, squareSize);
      ctx.fillRect(width - 15 - squareSize, 15, squareSize, squareSize);
      ctx.fillRect(15, height - 15 - squareSize, squareSize, squareSize);

      // Center text
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('WhatsApp QR', width / 2, height / 2 - 15);
      ctx.font = '9px Arial';
      ctx.fillText('Scan to request', width / 2, height / 2 + 5);
      ctx.fillText('license key', width / 2, height / 2 + 20);
      
      // Warning text
      ctx.font = '7px Arial';
      ctx.fillStyle = '#666666';
      ctx.fillText('(Placeholder QR)', width / 2, height / 2 + 35);

      // Make canvas clickable
      const message = this.createWhatsAppMessage(deviceUUID);
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${this.options.whatsappPhone}&text=${message}`;
      this.makeCanvasClickable(canvas, whatsappUrl);

      if (this.debug) {
        this.log.warn('MobileQRCodeGenerator: Using fallback simple QR code (not scannable)');
      }
    }
  }

  // Export to window object for mobile use
  window.MobileQRCodeGenerator = MobileQRCodeGenerator;

  if (window.log && window.log.info) {
    window.log.info('mobile-qrcode.js: Module loaded successfully');
  }

})(window);
