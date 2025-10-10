// ========================================
// PERFORMANCE MONITOR
// ========================================
// This module monitors application performance and provides
// metrics for optimization tracking

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            startup: {
                startTime: Date.now(),
                moduleLoadTime: 0,
                windowCreationTime: 0,
                totalStartupTime: 0
            },
            memory: {
                initial: process.memoryUsage(),
                peak: process.memoryUsage(),
                current: process.memoryUsage(),
                history: []
            },
            cpu: {
                loadHistory: [],
                maxLoad: 0,
                averageLoad: 0
            },
            timers: {
                active: 0,
                created: 0,
                cleared: 0
            },
            modules: {
                loaded: 0,
                loadTime: {},
                memoryImpact: {}
            },
            gc: {
                runs: 0,
                totalTime: 0,
                lastRun: null
            }
        }
        
        this.intervals = new Map()
        this.log = null
        
        // Start monitoring immediately
        this.startMonitoring()
    }
    
    /**
     * Initialize the performance monitor
     */
    async initialize() {
        try {
            this.log = require('electron-log')
            this.log.info('PerformanceMonitor: Initialized')
        } catch (error) {
            console.warn('PerformanceMonitor: Could not initialize logging')
        }
    }
    
    /**
     * Record startup milestone
     */
    recordStartupMilestone(milestone, duration) {
        this.metrics.startup[milestone] = duration
        if (this.log) {
            this.log.info(`PerformanceMonitor: ${milestone} took ${duration}ms`)
        }
    }
    
    /**
     * Record module loading
     */
    recordModuleLoad(moduleName, loadTime, memoryBefore, memoryAfter) {
        this.metrics.modules.loaded++
        this.metrics.modules.loadTime[moduleName] = loadTime
        this.metrics.modules.memoryImpact[moduleName] = memoryAfter.heapUsed - memoryBefore.heapUsed
        
        if (this.log) {
            this.log.debug(`PerformanceMonitor: Module ${moduleName} loaded in ${loadTime}ms, memory impact: ${(this.metrics.modules.memoryImpact[moduleName] / 1024 / 1024).toFixed(2)}MB`)
        }
    }
    
    /**
     * Update memory metrics
     */
    updateMemoryMetrics() {
        const current = process.memoryUsage()
        this.metrics.memory.current = current
        
        // Track peak memory usage
        if (current.heapUsed > this.metrics.memory.peak.heapUsed) {
            this.metrics.memory.peak = current
        }
        
        // Keep memory history (last 100 entries)
        this.metrics.memory.history.push({
            timestamp: Date.now(),
            ...current
        })
        
        if (this.metrics.memory.history.length > 100) {
            this.metrics.memory.history.shift()
        }
    }
    
    /**
     * Update CPU metrics
     */
    updateCpuMetrics(loadData) {
        if (loadData && typeof loadData.currentLoad === 'number') {
            this.metrics.cpu.loadHistory.push({
                timestamp: Date.now(),
                load: loadData.currentLoad
            })
            
            // Keep only last 100 entries
            if (this.metrics.cpu.loadHistory.length > 100) {
                this.metrics.cpu.loadHistory.shift()
            }
            
            // Update max load
            if (loadData.currentLoad > this.metrics.cpu.maxLoad) {
                this.metrics.cpu.maxLoad = loadData.currentLoad
            }
            
            // Calculate average load
            const totalLoad = this.metrics.cpu.loadHistory.reduce((sum, entry) => sum + entry.load, 0)
            this.metrics.cpu.averageLoad = totalLoad / this.metrics.cpu.loadHistory.length
        }
    }
    
    /**
     * Record timer activity
     */
    recordTimerActivity(action) {
        switch (action) {
            case 'created':
                this.metrics.timers.created++
                this.metrics.timers.active++
                break
            case 'cleared':
                this.metrics.timers.cleared++
                this.metrics.timers.active = Math.max(0, this.metrics.timers.active - 1)
                break
        }
    }
    
    /**
     * Record garbage collection
     */
    recordGarbageCollection(duration) {
        this.metrics.gc.runs++
        this.metrics.gc.totalTime += duration
        this.metrics.gc.lastRun = Date.now()
        
        if (this.log) {
            this.log.debug(`PerformanceMonitor: GC run took ${duration}ms`)
        }
    }
    
    /**
     * Get performance summary
     */
    getPerformanceSummary() {
        const uptime = Date.now() - this.metrics.startup.startTime
        const currentMemory = this.metrics.memory.current
        
        return {
            uptime: uptime,
            uptimeFormatted: this.formatDuration(uptime),
            memory: {
                current: `${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
                peak: `${(this.metrics.memory.peak.heapUsed / 1024 / 1024).toFixed(2)}MB`,
                total: `${(currentMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`,
                external: `${(currentMemory.external / 1024 / 1024).toFixed(2)}MB`
            },
            cpu: {
                averageLoad: `${this.metrics.cpu.averageLoad.toFixed(2)}%`,
                maxLoad: `${this.metrics.cpu.maxLoad.toFixed(2)}%`,
                dataPoints: this.metrics.cpu.loadHistory.length
            },
            timers: {
                active: this.metrics.timers.active,
                created: this.metrics.timers.created,
                cleared: this.metrics.timers.cleared
            },
            modules: {
                loaded: this.metrics.modules.loaded,
                totalLoadTime: Object.values(this.metrics.modules.loadTime).reduce((sum, time) => sum + time, 0),
                averageLoadTime: Object.values(this.metrics.modules.loadTime).reduce((sum, time) => sum + time, 0) / this.metrics.modules.loaded || 0
            },
            gc: {
                runs: this.metrics.gc.runs,
                totalTime: this.metrics.gc.totalTime,
                averageTime: this.metrics.gc.runs > 0 ? this.metrics.gc.totalTime / this.metrics.gc.runs : 0,
                lastRun: this.metrics.gc.lastRun ? new Date(this.metrics.gc.lastRun).toISOString() : null
            }
        }
    }
    
    /**
     * Get detailed metrics
     */
    getDetailedMetrics() {
        return {
            ...this.metrics,
            summary: this.getPerformanceSummary()
        }
    }
    
    /**
     * Start performance monitoring
     */
    startMonitoring() {
        // Monitor memory every 30 seconds
        this.intervals.set('memory', setInterval(() => {
            this.updateMemoryMetrics()
        }, 30000))
        
        // Force garbage collection monitoring if available
        if (global.gc) {
            const originalGc = global.gc
            global.gc = () => {
                const start = Date.now()
                originalGc()
                const duration = Date.now() - start
                this.recordGarbageCollection(duration)
            }
        }
    }
    
    /**
     * Stop performance monitoring
     */
    stopMonitoring() {
        this.intervals.forEach((interval, name) => {
            clearInterval(interval)
        })
        this.intervals.clear()
        
        if (this.log) {
            this.log.info('PerformanceMonitor: Monitoring stopped')
        }
    }
    
    /**
     * Format duration in human readable format
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000)
        const minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`
        } else {
            return `${seconds}s`
        }
    }
    
    /**
     * Log performance report
     */
    logPerformanceReport() {
        const summary = this.getPerformanceSummary()
        
        if (this.log) {
            this.log.info('=== PERFORMANCE REPORT ===')
            this.log.info(`Uptime: ${summary.uptimeFormatted}`)
            this.log.info(`Memory - Current: ${summary.memory.current}, Peak: ${summary.memory.peak}`)
            this.log.info(`CPU - Average: ${summary.cpu.averageLoad}, Max: ${summary.cpu.maxLoad}`)
            this.log.info(`Timers - Active: ${summary.timers.active}, Created: ${summary.timers.created}`)
            this.log.info(`Modules - Loaded: ${summary.modules.loaded}, Avg Load Time: ${summary.modules.averageLoadTime.toFixed(2)}ms`)
            this.log.info(`GC - Runs: ${summary.gc.runs}, Avg Time: ${summary.gc.averageTime.toFixed(2)}ms`)
            this.log.info('=== END PERFORMANCE REPORT ===')
        }
    }
    
    /**
     * Cleanup and generate final report
     */
    cleanup() {
        this.logPerformanceReport()
        this.stopMonitoring()
    }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor()

module.exports = performanceMonitor