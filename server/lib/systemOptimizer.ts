/**
 * System Optimizer
 * Implements memory and resource optimization techniques for the trading platform
 */

import os from 'os';

// Memory usage thresholds
const HIGH_MEMORY_THRESHOLD = 0.8; // 80% of available memory
const HIGH_CPU_THRESHOLD = 0.8; // 80% of available CPU
const MEMORY_CHECK_INTERVAL = 60000; // 1 minute

// System resource monitoring
class SystemOptimizer {
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;
  private callbacks: Array<() => void> = [];
  
  /**
   * Start monitoring system resources
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('[SystemOptimizer] Starting system resource monitoring');
    
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, MEMORY_CHECK_INTERVAL);
    
    // Set up Node.js memory limits if needed
    this.setupMemoryLimits();
  }
  
  /**
   * Stop monitoring system resources
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    
    console.log('[SystemOptimizer] Stopped system resource monitoring');
  }
  
  /**
   * Check memory usage and take action if needed
   */
  private checkMemoryUsage(): void {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemoryRatio = (totalMemory - freeMemory) / totalMemory;
    
    // Log memory usage
    console.log(`[SystemOptimizer] Memory usage: ${Math.round(usedMemoryRatio * 100)}%`);
    
    // Take action if memory usage is high
    if (usedMemoryRatio > HIGH_MEMORY_THRESHOLD) {
      console.warn(`[SystemOptimizer] High memory usage detected: ${Math.round(usedMemoryRatio * 100)}%`);
      this.handleHighMemoryUsage();
    }
  }
  
  /**
   * Handle high memory usage
   */
  private handleHighMemoryUsage(): void {
    // Run garbage collection if available
    if (typeof global.gc === 'function') {
      console.log('[SystemOptimizer] Running garbage collection');
      global.gc();
    }
    
    // Execute registered callbacks
    for (const callback of this.callbacks) {
      try {
        callback();
      } catch (error) {
        console.error('[SystemOptimizer] Error in memory optimization callback:', error);
      }
    }
  }
  
  /**
   * Set up Node.js memory limits
   */
  private setupMemoryLimits(): void {
    // Ensure sufficient heap size for the application
    // This is set through NODE_OPTIONS environment variable
    const heapSizeInMB = Math.min(
      Math.floor(os.totalmem() / (1024 * 1024) * 0.75), // 75% of total memory
      8192 // Max 8GB
    );
    
    console.log(`[SystemOptimizer] Recommended NODE_OPTIONS: --max-old-space-size=${heapSizeInMB}`);
  }
  
  /**
   * Register a callback to be executed when memory usage is high
   */
  registerMemoryOptimizationCallback(callback: () => void): void {
    this.callbacks.push(callback);
  }
  
  /**
   * Clear cached data to reduce memory usage
   */
  clearCaches(): void {
    console.log('[SystemOptimizer] Clearing caches to reduce memory usage');
    // Implement cache clearing logic here
  }
  
  /**
   * Get system information
   */
  getSystemInfo(): {
    cpu: number;
    memory: number;
    uptime: number;
    platform: string;
  } {
    return {
      cpu: os.loadavg()[0] / os.cpus().length, // Normalized CPU load
      memory: (os.totalmem() - os.freemem()) / os.totalmem(),
      uptime: os.uptime(),
      platform: os.platform()
    };
  }
}

// Export singleton instance
export const systemOptimizer = new SystemOptimizer();
export default systemOptimizer;