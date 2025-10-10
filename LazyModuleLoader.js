// ========================================
// LAZY MODULE LOADER
// ========================================
// This module implements lazy loading for heavy dependencies
// to reduce initial memory footprint and startup time

class LazyModuleLoader {
    constructor() {
        this.loadedModules = new Map()
        this.loadingPromises = new Map()
        this.log = require('electron-log')
        
        // Track module loading stats
        this.stats = {
            totalLoaded: 0,
            loadTime: {},
            memoryBeforeLoad: 0,
            memoryAfterLoad: 0
        }
    }
    
    /**
     * Lazy load a module
     */
    async loadModule(moduleName, options = {}) {
        // Return cached module if already loaded
        if (this.loadedModules.has(moduleName)) {
            this.log.debug(`LazyLoader: Module ${moduleName} already loaded`)
            return this.loadedModules.get(moduleName)
        }
        
        // Return existing loading promise if module is currently being loaded
        if (this.loadingPromises.has(moduleName)) {
            this.log.debug(`LazyLoader: Module ${moduleName} is currently loading, waiting...`)
            return this.loadingPromises.get(moduleName)
        }
        
        // Create loading promise
        const loadingPromise = this.performModuleLoad(moduleName, options)
        this.loadingPromises.set(moduleName, loadingPromise)
        
        try {
            const module = await loadingPromise
            this.loadedModules.set(moduleName, module)
            return module
        } finally {
            this.loadingPromises.delete(moduleName)
        }
    }
    
    /**
     * Perform the actual module loading
     */
    async performModuleLoad(moduleName, options = {}) {
        const startTime = Date.now()
        const memBefore = process.memoryUsage()
        
        this.log.info(`LazyLoader: Loading module ${moduleName}...`)
        
        try {
            let module
            
            switch (moduleName) {
                case 'systeminformation':
                    module = require('systeminformation')
                    break
                    
                case 'win-audio':
                    if (process.platform === 'win32') {
                        try {
                            module = require('win-audio')
                        } catch (error) {
                            this.log.warn('LazyLoader: win-audio not available:', error.message)
                            module = null
                        }
                    } else {
                        module = null
                    }
                    break
                    
                case 'socket.io':
                    module = require('socket.io')
                    break
                    
                case 'express':
                    module = require('express')
                    break
                    
                case 'https':
                    module = require('https')
                    break
                    
                case 'cors':
                    module = require('cors')
                    break
                    
                case 'body-parser':
                    module = require('body-parser')
                    break
                    
                case 'express-csp-header':
                    module = require('express-csp-header')
                    break
                    
                case 'node-websockify':
                    module = require('node-websockify')
                    break
                    
                case 'electron-shutdown-command':
                    module = require('electron-shutdown-command')
                    break
                    
                case 'ping':
                    module = require('ping')
                    break
                    
                case 'macaddress':
                    module = require('macaddress')
                    break
                    
                case 'auto-launch':
                    module = require('auto-launch')
                    break
                    
                case 'axios':
                    module = require('axios').default
                    break
                    
                case 'date-and-time':
                    module = require('date-and-time')
                    break
                    
                default:
                    // Generic module loading
                    module = require(moduleName)
                    break
            }
            
            const loadTime = Date.now() - startTime
            const memAfter = process.memoryUsage()
            
            // Update stats
            this.stats.totalLoaded++
            this.stats.loadTime[moduleName] = loadTime
            this.stats.memoryBeforeLoad = memBefore.heapUsed
            this.stats.memoryAfterLoad = memAfter.heapUsed
            
            const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed
            
            this.log.info(`LazyLoader: Module ${moduleName} loaded in ${loadTime}ms, memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
            
            return module
            
        } catch (error) {
            const loadTime = Date.now() - startTime
            this.log.error(`LazyLoader: Failed to load module ${moduleName} after ${loadTime}ms:`, error.message)
            throw error
        }
    }
    
    /**
     * Unload a module (remove from cache)
     */
    unloadModule(moduleName) {
        if (this.loadedModules.has(moduleName)) {
            this.loadedModules.delete(moduleName)
            
            // Also clear from Node.js require cache if possible
            try {
                const resolvedPath = require.resolve(moduleName)
                delete require.cache[resolvedPath]
                this.log.info(`LazyLoader: Unloaded module ${moduleName}`)
            } catch (error) {
                this.log.warn(`LazyLoader: Could not clear require cache for ${moduleName}:`, error.message)
            }
        }
    }
    
    /**
     * Load multiple modules in parallel
     */
    async loadModules(moduleNames, options = {}) {
        const results = {}
        
        const promises = moduleNames.map(async (moduleName) => {
            try {
                results[moduleName] = await this.loadModule(moduleName, options)
            } catch (error) {
                this.log.error(`LazyLoader: Failed to load ${moduleName}:`, error.message)
                results[moduleName] = null
            }
        })
        
        await Promise.all(promises)
        return results
    }
    
    /**
     * Check if a module is loaded
     */
    isLoaded(moduleName) {
        return this.loadedModules.has(moduleName)
    }
    
    /**
     * Get list of loaded modules
     */
    getLoadedModules() {
        return Array.from(this.loadedModules.keys())
    }
    
    /**
     * Get loading statistics
     */
    getStats() {
        const totalMemoryUsed = Object.keys(this.stats.loadTime).reduce((total, moduleName) => {
            return total + (this.stats.memoryAfterLoad - this.stats.memoryBeforeLoad)
        }, 0)
        
        return {
            ...this.stats,
            loadedModules: this.loadedModules.size,
            totalMemoryUsed: `${(totalMemoryUsed / 1024 / 1024).toFixed(2)}MB`,
            averageLoadTime: Object.values(this.stats.loadTime).reduce((sum, time) => sum + time, 0) / Object.keys(this.stats.loadTime).length || 0
        }
    }
    
    /**
     * Clear all loaded modules
     */
    clearAll() {
        this.log.info('LazyLoader: Clearing all loaded modules...')
        
        const moduleNames = Array.from(this.loadedModules.keys())
        moduleNames.forEach(moduleName => this.unloadModule(moduleName))
        
        this.loadedModules.clear()
        this.loadingPromises.clear()
        
        this.log.info('LazyLoader: All modules cleared')
    }
}

// Create singleton instance
const lazyLoader = new LazyModuleLoader()

module.exports = lazyLoader