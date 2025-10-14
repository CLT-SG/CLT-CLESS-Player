/**
 * Multi-Display Error Handler and Fallback System
 * Provides robust error handling and graceful degradation for display operations
 */

class MultiDisplayErrorHandler {
    constructor(logger = console) {
        this.logger = logger
        this.fallbackConfig = {
            singleDisplayMode: {
                width: 1920,
                height: 1080,
                resolution: '1920x1080',
                arrangement: 'single',
                displayCount: 1,
                hasMultipleDisplays: false,
                orientation: 'landscape'
            }
        }
        this.errorCounts = new Map()
        this.maxRetries = 3
        this.retryDelay = 1000 // 1 second
    }

    /**
     * Safe execution wrapper with fallback
     */
    async safeExecute(operation, operationName, fallbackValue = null) {
        try {
            const result = await operation()
            this.resetErrorCount(operationName)
            return result
        } catch (error) {
            return this.handleError(error, operationName, fallbackValue)
        }
    }

    /**
     * Handle errors with retry logic and fallbacks
     */
    async handleError(error, operationName, fallbackValue = null) {
        const errorCount = this.incrementErrorCount(operationName)
        
        this.logger.error(`MultiDisplayErrorHandler: Error in ${operationName} (attempt ${errorCount}):`, error.message)
        
        // Log detailed error information
        this.logDetailedError(error, operationName, errorCount)
        
        // If we haven't exceeded max retries, try again
        if (errorCount < this.maxRetries) {
            this.logger.warn(`MultiDisplayErrorHandler: Retrying ${operationName} in ${this.retryDelay}ms...`)
            
            await this.delay(this.retryDelay)
            
            // Don't recurse - let the caller handle retry
            throw new Error(`Retry needed for ${operationName}`)
        }
        
        // Max retries exceeded, use fallback
        const fallback = this.getFallbackValue(operationName, fallbackValue)
        
        this.logger.warn(`MultiDisplayErrorHandler: Using fallback for ${operationName}:`, fallback)
        
        return fallback
    }

    /**
     * Get appropriate fallback value for operation
     */
    getFallbackValue(operationName, providedFallback) {
        if (providedFallback !== null) {
            return providedFallback
        }

        switch (operationName) {
            case 'getDisplayConfiguration':
                return {
                    timestamp: new Date().toISOString(),
                    displays: [{
                        index: 0,
                        id: 'fallback-display',
                        model: 'Fallback Display',
                        currentResX: 1920,
                        currentResY: 1080,
                        positionX: 0,
                        positionY: 0,
                        isPrimary: true,
                        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                        workArea: { x: 0, y: 0, width: 1920, height: 1080 }
                    }],
                    primaryDisplay: {
                        model: 'Fallback Display',
                        currentResX: 1920,
                        currentResY: 1080,
                        isPrimary: true
                    },
                    combinedResolution: { width: 1920, height: 1080 },
                    arrangement: 'single',
                    totalWorkspace: { width: 1920, height: 1080, area: 2073600 },
                    displayCount: 1,
                    hasMultipleDisplays: false,
                    error: 'Using fallback configuration'
                }

            case 'getSystemInfo':
                return {
                    timestamp: new Date().toISOString(),
                    multiDisplaySupport: false,
                    displays: [{
                        index: 0,
                        resolution: { width: 1920, height: 1080, current: '1920x1080' },
                        position: { x: 0, y: 0, formatted: '0,0' },
                        properties: {
                            model: 'Fallback Display',
                            name: 'Primary Display',
                            main: true
                        }
                    }],
                    multiDisplaySummary: this.fallbackConfig.singleDisplayMode,
                    error: 'Using fallback system info'
                }

            case 'fetchMultiDisplayConfiguration':
                return {
                    combinedResolution: { width: 1920, height: 1080, formatted: '1920x1080' },
                    arrangement: 'single',
                    displayCount: 1,
                    hasMultipleDisplays: false,
                    orientation: 'landscape',
                    error: 'Using fallback multi-display config'
                }

            default:
                return this.fallbackConfig.singleDisplayMode
        }
    }

    /**
     * Safe display calculator wrapper
     */
    async safeDisplayCalculation(displayCalculator) {
        if (!displayCalculator) {
            this.logger.warn('MultiDisplayErrorHandler: DisplayCalculator not available, using fallback')
            return this.getFallbackValue('getDisplayConfiguration')
        }

        const operation = async () => {
            try {
                return await displayCalculator.getDisplayConfiguration()
            } catch (error) {
                // Try to clear cache and retry once
                if (displayCalculator.clearCache) {
                    displayCalculator.clearCache()
                }
                
                // Wait a moment and try again
                await this.delay(500)
                return await displayCalculator.getDisplayConfiguration()
            }
        }

        return await this.safeExecute(operation, 'getDisplayConfiguration')
    }

    /**
     * Safe system info wrapper
     */
    async safeSystemInfo(systemInfoManager, type = 'display') {
        if (!systemInfoManager) {
            this.logger.warn('MultiDisplayErrorHandler: SystemInfoManager not available, using fallback')
            return this.getFallbackValue('getSystemInfo')
        }

        const operation = async () => {
            return await systemInfoManager.getSystemInfo(type)
        }

        return await this.safeExecute(operation, 'getSystemInfo')
    }

    /**
     * Safe API request wrapper
     */
    async safeApiRequest(url, options = {}) {
        const operation = async () => {
            const response = await fetch(url, {
                timeout: 10000,
                ...options
            })
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
            
            return await response.json()
        }

        return await this.safeExecute(operation, `apiRequest-${url}`)
    }

    /**
     * Safe socket event handler
     */
    safeSocketHandler(handler, eventName) {
        return async (...args) => {
            try {
                await handler(...args)
                this.resetErrorCount(`socket-${eventName}`)
            } catch (error) {
                this.logger.error(`MultiDisplayErrorHandler: Socket event error (${eventName}):`, error.message)
                this.incrementErrorCount(`socket-${eventName}`)
                
                // Don't throw - socket errors shouldn't crash the app
                // Just log and continue
            }
        }
    }

    /**
     * Validate display configuration data
     */
    validateDisplayConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('Invalid display configuration: not an object')
        }

        // Required fields
        const requiredFields = ['displays', 'combinedResolution', 'arrangement', 'displayCount']
        for (const field of requiredFields) {
            if (!(field in config)) {
                throw new Error(`Invalid display configuration: missing ${field}`)
            }
        }

        // Validate displays array
        if (!Array.isArray(config.displays) || config.displays.length === 0) {
            throw new Error('Invalid display configuration: displays must be non-empty array')
        }

        // Validate each display
        config.displays.forEach((display, index) => {
            if (!display.currentResX || !display.currentResY) {
                throw new Error(`Invalid display ${index}: missing resolution`)
            }
            if (typeof display.positionX !== 'number' || typeof display.positionY !== 'number') {
                throw new Error(`Invalid display ${index}: missing position`)
            }
        })

        // Validate combined resolution
        if (!config.combinedResolution.width || !config.combinedResolution.height) {
            throw new Error('Invalid display configuration: invalid combined resolution')
        }

        return true
    }

    /**
     * Create safe display configuration with validation
     */
    createSafeDisplayConfig(rawConfig) {
        try {
            this.validateDisplayConfig(rawConfig)
            return rawConfig
        } catch (error) {
            this.logger.warn('MultiDisplayErrorHandler: Creating safe config due to validation error:', error.message)
            
            // Try to salvage what we can
            const safeConfig = this.getFallbackValue('getDisplayConfiguration')
            
            // Merge any valid data from raw config
            if (rawConfig && rawConfig.displays && Array.isArray(rawConfig.displays)) {
                try {
                    // Use first valid display if available
                    const firstDisplay = rawConfig.displays[0]
                    if (firstDisplay && firstDisplay.currentResX && firstDisplay.currentResY) {
                        safeConfig.displays[0].currentResX = firstDisplay.currentResX
                        safeConfig.displays[0].currentResY = firstDisplay.currentResY
                        safeConfig.combinedResolution.width = firstDisplay.currentResX
                        safeConfig.combinedResolution.height = firstDisplay.currentResY
                    }
                } catch (mergeError) {
                    this.logger.warn('MultiDisplayErrorHandler: Could not merge raw config data:', mergeError.message)
                }
            }
            
            safeConfig.error = `Fallback config created: ${error.message}`
            return safeConfig
        }
    }

    /**
     * Log detailed error information
     */
    logDetailedError(error, operationName, attemptCount) {
        const errorDetails = {
            operation: operationName,
            attempt: attemptCount,
            errorType: error.constructor.name,
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 3).join('\n'), // First 3 stack lines
            timestamp: new Date().toISOString(),
            platform: process.platform,
            nodeVersion: process.version
        }

        this.logger.debug('MultiDisplayErrorHandler: Detailed error:', JSON.stringify(errorDetails, null, 2))
    }

    /**
     * Increment error count for operation
     */
    incrementErrorCount(operationName) {
        const current = this.errorCounts.get(operationName) || 0
        const newCount = current + 1
        this.errorCounts.set(operationName, newCount)
        return newCount
    }

    /**
     * Reset error count for operation
     */
    resetErrorCount(operationName) {
        this.errorCounts.delete(operationName)
    }

    /**
     * Get error statistics
     */
    getErrorStats() {
        const stats = {}
        for (const [operation, count] of this.errorCounts.entries()) {
            stats[operation] = count
        }
        return stats
    }

    /**
     * Simple delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * Create a circuit breaker for critical operations
     */
    createCircuitBreaker(operation, operationName, threshold = 5, timeout = 30000) {
        let failures = 0
        let lastFailure = 0
        let state = 'CLOSED' // CLOSED, OPEN, HALF_OPEN

        return async (...args) => {
            const now = Date.now()

            // Reset if timeout has passed
            if (state === 'OPEN' && now - lastFailure > timeout) {
                state = 'HALF_OPEN'
                failures = 0
            }

            // If circuit is open, return fallback immediately
            if (state === 'OPEN') {
                this.logger.warn(`MultiDisplayErrorHandler: Circuit breaker OPEN for ${operationName}, using fallback`)
                return this.getFallbackValue(operationName)
            }

            try {
                const result = await operation(...args)
                
                // Success - reset if we were in half-open state
                if (state === 'HALF_OPEN') {
                    state = 'CLOSED'
                    failures = 0
                }
                
                return result
                
            } catch (error) {
                failures++
                lastFailure = now

                if (failures >= threshold) {
                    state = 'OPEN'
                    this.logger.error(`MultiDisplayErrorHandler: Circuit breaker OPENED for ${operationName} after ${failures} failures`)
                }

                throw error
            }
        }
    }
}

module.exports = MultiDisplayErrorHandler