// ========================================
// TIMER AND EVENT MANAGER
// ========================================
// This module manages all timers and event listeners to prevent memory leaks
// and optimize resource usage

class TimerManager {
    constructor() {
        this.timers = new Map()
        this.intervals = new Map()
        this.listeners = new Map()
        this.log = require('electron-log')
        
        // Bind cleanup method
        this.cleanup = this.cleanup.bind(this)
        
        // Auto-cleanup on process exit
        process.on('exit', this.cleanup)
        process.on('SIGINT', this.cleanup)
        process.on('SIGTERM', this.cleanup)
    }
    
    /**
     * Create a managed timeout
     */
    setTimeout(name, callback, delay, ...args) {
        // Clear existing timer with same name
        this.clearTimeout(name)
        
        const timer = setTimeout(() => {
            try {
                callback(...args)
            } catch (error) {
                this.log.error(`Timer ${name} callback error:`, error.message)
            } finally {
                // Auto-remove completed timer
                this.timers.delete(name)
            }
        }, delay)
        
        this.timers.set(name, timer)
        this.log.debug(`Timer ${name} created with delay ${delay}ms`)
        
        return timer
    }
    
    /**
     * Create a managed interval
     */
    setInterval(name, callback, interval, ...args) {
        // Clear existing interval with same name
        this.clearInterval(name)
        
        const timer = setInterval(() => {
            try {
                callback(...args)
            } catch (error) {
                this.log.error(`Interval ${name} callback error:`, error.message)
            }
        }, interval)
        
        this.intervals.set(name, timer)
        this.log.debug(`Interval ${name} created with period ${interval}ms`)
        
        return timer
    }
    
    /**
     * Clear a managed timeout
     */
    clearTimeout(name) {
        if (this.timers.has(name)) {
            clearTimeout(this.timers.get(name))
            this.timers.delete(name)
            this.log.debug(`Timer ${name} cleared`)
            return true
        }
        return false
    }
    
    /**
     * Clear a managed interval
     */
    clearInterval(name) {
        if (this.intervals.has(name)) {
            clearInterval(this.intervals.get(name))
            this.intervals.delete(name)
            this.log.debug(`Interval ${name} cleared`)
            return true
        }
        return false
    }
    
    /**
     * Add an event listener with cleanup tracking
     */
    addEventListener(emitter, event, listener, name = null) {
        const listenerName = name || `${emitter.constructor.name}-${event}-${Date.now()}`
        
        // Store listener info for cleanup
        this.listeners.set(listenerName, {
            emitter,
            event,
            listener
        })
        
        emitter.on(event, listener)
        this.log.debug(`Event listener ${listenerName} added for ${event}`)
        
        return listenerName
    }
    
    /**
     * Remove an event listener
     */
    removeEventListener(name) {
        if (this.listeners.has(name)) {
            const { emitter, event, listener } = this.listeners.get(name)
            emitter.removeListener(event, listener)
            this.listeners.delete(name)
            this.log.debug(`Event listener ${name} removed`)
            return true
        }
        return false
    }
    
    /**
     * Get statistics about managed resources
     */
    getStats() {
        return {
            activeTimers: this.timers.size,
            activeIntervals: this.intervals.size,
            activeListeners: this.listeners.size,
            timerNames: Array.from(this.timers.keys()),
            intervalNames: Array.from(this.intervals.keys()),
            listenerNames: Array.from(this.listeners.keys())
        }
    }
    
    /**
     * Clear all timers of a specific type
     */
    clearAllTimers() {
        this.timers.forEach((timer, name) => {
            clearTimeout(timer)
        })
        this.timers.clear()
        this.log.info('All timers cleared')
    }
    
    /**
     * Clear all intervals
     */
    clearAllIntervals() {
        this.intervals.forEach((interval, name) => {
            clearInterval(interval)
        })
        this.intervals.clear()
        this.log.info('All intervals cleared')
    }
    
    /**
     * Remove all event listeners
     */
    removeAllListeners() {
        this.listeners.forEach(({ emitter, event, listener }, name) => {
            emitter.removeListener(event, listener)
        })
        this.listeners.clear()
        this.log.info('All event listeners removed')
    }
    
    /**
     * Comprehensive cleanup of all managed resources
     */
    cleanup() {
        this.log.info('TimerManager: Starting cleanup...')
        
        this.clearAllTimers()
        this.clearAllIntervals()
        this.removeAllListeners()
        
        this.log.info('TimerManager: Cleanup completed')
    }
}

// Create singleton instance
const timerManager = new TimerManager()

module.exports = timerManager