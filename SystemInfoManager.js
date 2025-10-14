// ========================================
// OPTIMIZED SYSTEM INFORMATION MANAGER
// ========================================
// This module implements intelligent caching and lazy loading
// for system information to reduce CPU and memory usage

const si = require('systeminformation')
const EventEmitter = require('events')

class SystemInfoManager extends EventEmitter {
    constructor(options = {}) {
        super()
        
        // Configuration
        this.config = {
            cacheTTL: options.cacheTTL || 30000, // 30 seconds default
            updateInterval: options.updateInterval || 60000, // 1 minute default
            enableCaching: options.enableCaching !== false,
            maxCacheSize: options.maxCacheSize || 50,
            enableLazyLoading: options.enableLazyLoading !== false
        }
        
        // Cache storage
        this.cache = new Map()
        this.cacheTimestamps = new Map()
        this.updateTimers = new Map()
        
        // Performance tracking
        this.stats = {
            cacheHits: 0,
            cacheMisses: 0,
            systemCalls: 0,
            lastUpdate: null
        }
        
        // Flag to prevent multiple simultaneous updates
        this.updating = new Set()
        
        this.log = require('electron-log')
        
        // Bind methods
        this.cleanup = this.cleanup.bind(this)
        
        // Setup cleanup on process exit
        process.on('exit', this.cleanup)
        process.on('SIGINT', this.cleanup)
        process.on('SIGTERM', this.cleanup)
    }
    
    /**
     * Get system information with intelligent caching
     */
    async getSystemInfo(type, options = {}) {
        const forceRefresh = options.forceRefresh || false
        const useCache = this.config.enableCaching && !forceRefresh
        
        // Check cache first
        if (useCache && this.isCacheValid(type)) {
            this.stats.cacheHits++
            return this.cache.get(type)
        }
        
        // Prevent duplicate requests
        if (this.updating.has(type)) {
            this.log.debug(`SystemInfo: Request already in progress for ${type}, waiting...`)
            return new Promise((resolve) => {
                this.once(`${type}-updated`, resolve)
            })
        }
        
        this.updating.add(type)
        this.stats.cacheMisses++
        this.stats.systemCalls++
        
        try {
            const data = await this.fetchSystemData(type, options)
            
            // Cache the result
            if (useCache) {
                this.updateCache(type, data)
            }
            
            this.stats.lastUpdate = Date.now()
            this.emit(`${type}-updated`, data)
            
            return data
            
        } catch (error) {
            this.log.error(`SystemInfo: Error fetching ${type}:`, error.message)
            
            // Return cached data if available, even if expired
            if (this.cache.has(type)) {
                return this.cache.get(type)
            }
            
            throw error
        } finally {
            this.updating.delete(type)
        }
    }
    
    /**
     * Fetch actual system data based on type
     */
    async fetchSystemData(type, options = {}) {
        const startTime = Date.now()
        
        try {
            let data
            
            switch (type) {
                case 'cpu':
                    data = await si.cpu()
                    break
                    
                case 'memory':
                    data = await si.mem()
                    break
                    
                case 'disk':
                    data = await si.fsSize()
                    break
                    
                case 'network':
                    data = await si.networkInterfaces()
                    break
                    
                case 'networkStats':
                    data = await si.networkStats()
                    break
                    
                case 'display':
                    // Get enhanced multi-display system information
                    data = await this.getEnhancedDisplayInfo()
                    break
                    
                case 'system':
                    data = await si.system()
                    break
                    
                case 'currentLoad':
                    data = await si.currentLoad()
                    break
                    
                case 'processes':
                    // Limit process list to reduce memory usage
                    data = await si.processes()
                    if (data.list && data.list.length > 20) {
                        data.list = data.list.slice(0, 20) // Keep only top 20 processes
                    }
                    break
                    
                case 'temperature':
                    data = await si.cpuTemperature()
                    break
                    
                case 'battery':
                    data = await si.battery()
                    break
                    
                default:
                    throw new Error(`Unknown system info type: ${type}`)
            }
            
            const duration = Date.now() - startTime
            
            return data
            
        } catch (error) {
            const duration = Date.now() - startTime
            this.log.error(`SystemInfo: Failed to fetch ${type} after ${duration}ms:`, error.message)
            throw error
        }
    }
    
    /**
     * Check if cached data is still valid
     */
    isCacheValid(type) {
        if (!this.cache.has(type) || !this.cacheTimestamps.has(type)) {
            return false
        }
        
        const timestamp = this.cacheTimestamps.get(type)
        const age = Date.now() - timestamp
        
        return age < this.config.cacheTTL
    }
    
    /**
     * Update cache with new data
     */
    updateCache(type, data) {
        // Implement LRU cache eviction
        if (this.cache.size >= this.config.maxCacheSize) {
            const oldestKey = this.cache.keys().next().value
            this.cache.delete(oldestKey)
            this.cacheTimestamps.delete(oldestKey)
            this.log.debug(`SystemInfo: Evicted cache entry for ${oldestKey}`)
        }
        
        this.cache.set(type, data)
        this.cacheTimestamps.set(type, Date.now())
        
    }
    
    /**
     * Start automatic updates for specific system info types
     */
    startAutoUpdate(types, interval = null) {
        const updateInterval = interval || this.config.updateInterval
        
        if (!Array.isArray(types)) {
            types = [types]
        }
        
        types.forEach(type => {
            // Clear existing timer
            if (this.updateTimers.has(type)) {
                clearInterval(this.updateTimers.get(type))
            }
            
            // Start new timer
            const timer = setInterval(async () => {
                try {
                    await this.getSystemInfo(type)
                } catch (error) {
                    this.log.error(`SystemInfo: Auto-update failed for ${type}:`, error.message)
                }
            }, updateInterval)
            
            this.updateTimers.set(type, timer)
            this.log.info(`SystemInfo: Started auto-update for ${type} every ${updateInterval}ms`)
        })
    }
    
    /**
     * Stop automatic updates
     */
    stopAutoUpdate(types = null) {
        const typesToStop = types ? (Array.isArray(types) ? types : [types]) : Array.from(this.updateTimers.keys())
        
        typesToStop.forEach(type => {
            if (this.updateTimers.has(type)) {
                clearInterval(this.updateTimers.get(type))
                this.updateTimers.delete(type)
                this.log.info(`SystemInfo: Stopped auto-update for ${type}`)
            }
        })
    }
    
    /**
     * Get multiple system info types efficiently
     */
    async getMultipleSystemInfo(types, options = {}) {
        const results = {}
        const promises = types.map(async type => {
            try {
                results[type] = await this.getSystemInfo(type, options)
            } catch (error) {
                this.log.error(`SystemInfo: Failed to get ${type}:`, error.message)
                results[type] = null
            }
        })
        
        await Promise.all(promises)
        return results
    }
    
    /**
     * Clear cache for specific types or all
     */
    clearCache(types = null) {
        if (!types) {
            this.cache.clear()
            this.cacheTimestamps.clear()
            this.log.info('SystemInfo: Cleared all cache')
        } else {
            const typesToClear = Array.isArray(types) ? types : [types]
            typesToClear.forEach(type => {
                this.cache.delete(type)
                this.cacheTimestamps.delete(type)
                this.log.info(`SystemInfo: Cleared cache for ${type}`)
            })
        }
    }
    
    /**
     * Get performance statistics
     */
    getStats() {
        const hitRatio = this.stats.cacheHits + this.stats.cacheMisses > 0 
            ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(2)
            : 0
            
        return {
            ...this.stats,
            hitRatio: `${hitRatio}%`,
            cacheSize: this.cache.size,
            activeTimers: this.updateTimers.size,
            memoryUsage: process.memoryUsage()
        }
    }
    
    /**
     * Get enhanced display information with multi-display support
     * @returns {Promise<Object>} Enhanced display configuration
     */
    async getEnhancedDisplayInfo() {
        // Use error handler if available
        const errorHandler = global.multiDisplayErrorHandler
        
        if (errorHandler) {
            return await errorHandler.safeExecute(
                () => this._getEnhancedDisplayInfoUnsafe(),
                'getEnhancedDisplayInfo',
                errorHandler.getFallbackValue('getSystemInfo')
            )
        }
        
        // Fallback to unsafe version if no error handler
        return await this._getEnhancedDisplayInfoUnsafe()
    }

    /**
     * Internal unsafe version of enhanced display info
     */
    async _getEnhancedDisplayInfoUnsafe() {
        try {
            // Get base display information from systeminformation
            let baseDisplayInfo
            try {
                baseDisplayInfo = await si.graphics()
            } catch (siError) {
                this.log.warn('SystemInfo: systeminformation graphics() failed:', siError.message)
                baseDisplayInfo = { displays: [] }
            }
            
            // Try to get enhanced display data from the global DisplayCalculator
            let enhancedDisplayData = null
            if (global.displayCalculator) {
                try {
                    const errorHandler = global.multiDisplayErrorHandler
                    if (errorHandler) {
                        enhancedDisplayData = await errorHandler.safeDisplayCalculation(global.displayCalculator)
                    } else {
                        enhancedDisplayData = await global.displayCalculator.getDisplayConfiguration()
                    }
                } catch (error) {
                    this.log.debug('SystemInfo: DisplayCalculator failed, using base display info only:', error.message)
                }
            }
            
            // Create enhanced info structure
            const enhancedInfo = {
                ...baseDisplayInfo,
                timestamp: new Date().toISOString(),
                multiDisplaySupport: enhancedDisplayData !== null,
                displays: baseDisplayInfo.displays ? baseDisplayInfo.displays.map((display, index) => ({
                    ...display,
                    index: index,
                    displayId: `display_${index}`,
                    resolution: {
                        width: display.currentResX || display.resolutionx || display.sizex || 1920,
                        height: display.currentResY || display.resolutiony || display.sizey || 1080,
                        current: `${display.currentResX || display.resolutionx || 1920}x${display.currentResY || display.resolutiony || 1080}`
                    },
                    position: {
                        x: display.positionX || 0,
                        y: display.positionY || 0,
                        formatted: `${display.positionX || 0},${display.positionY || 0}`
                    },
                    properties: {
                        model: display.model || `Display ${index + 1}`,
                        vendor: display.vendor || 'Unknown',
                        name: display.name || `Display ${index + 1}`,
                        connection: display.connection || 'Unknown',
                        main: display.main || false,
                        builtin: display.builtin || false,
                        pixelDepth: display.pixelDepth || 24
                    }
                })) : [],
                multiDisplaySummary: {
                    totalDisplays: baseDisplayInfo.displays ? baseDisplayInfo.displays.length : 1,
                    hasMultipleDisplays: baseDisplayInfo.displays ? baseDisplayInfo.displays.length > 1 : false,
                    primaryDisplay: baseDisplayInfo.displays ? 
                        baseDisplayInfo.displays.find(d => d.main) || baseDisplayInfo.displays[0] : null
                }
            }
            
            // Add enhanced multi-display data if available
            if (enhancedDisplayData) {
                enhancedInfo.professionalDisplayData = {
                    combinedResolution: enhancedDisplayData.combinedResolution,
                    arrangement: enhancedDisplayData.arrangement,
                    totalWorkspace: enhancedDisplayData.totalWorkspace,
                    displayCount: enhancedDisplayData.displayCount,
                    hasMultipleDisplays: enhancedDisplayData.hasMultipleDisplays
                }
                
                enhancedInfo.multiDisplaySummary = {
                    ...enhancedInfo.multiDisplaySummary,
                    combinedWidth: enhancedDisplayData.combinedResolution.width,
                    combinedHeight: enhancedDisplayData.combinedResolution.height,
                    combinedResolution: `${enhancedDisplayData.combinedResolution.width}x${enhancedDisplayData.combinedResolution.height}`,
                    arrangement: enhancedDisplayData.arrangement,
                    totalWorkspaceArea: enhancedDisplayData.totalWorkspace.area
                }
            }
            
            this.log.debug('SystemInfo: Enhanced display information generated successfully')
            return enhancedInfo
            
        } catch (error) {
            this.log.error('SystemInfo: Failed to get enhanced display information:', error.message)
            
            // Return fallback display information
            return {
                timestamp: new Date().toISOString(),
                multiDisplaySupport: false,
                displays: [{
                    index: 0,
                    displayId: 'display_0',
                    resolution: { width: 1920, height: 1080, current: '1920x1080' },
                    position: { x: 0, y: 0, formatted: '0,0' },
                    properties: {
                        model: 'Unknown Display',
                        vendor: 'Unknown',
                        name: 'Primary Display',
                        connection: 'Unknown',
                        main: true,
                        builtin: false,
                        pixelDepth: 24
                    }
                }],
                multiDisplaySummary: {
                    totalDisplays: 1,
                    hasMultipleDisplays: false,
                    combinedWidth: 1920,
                    combinedHeight: 1080,
                    combinedResolution: '1920x1080',
                    arrangement: 'single'
                },
                error: error.message
            }
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.log.info('SystemInfo: Cleaning up resources...')
        
        // Stop all auto-update timers
        this.stopAutoUpdate()
        
        // Clear cache
        this.clearCache()
        
        // Clear updating set
        this.updating.clear()
        
        // Remove all listeners
        this.removeAllListeners()
        
        this.log.info('SystemInfo: Cleanup completed')
    }
}

module.exports = SystemInfoManager