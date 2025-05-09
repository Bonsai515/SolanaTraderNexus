/**
 * RPC Rate Limiter
 * Ensures we don't exceed our daily RPC rate limit of 40k requests
 */

class RateLimiter {
  private static instance: RateLimiter;
  
  // Daily request limit (40k)
  private dailyLimit: number = 40000;
  
  // Reserve 20% for high-priority requests
  private highPriorityReserve: number = 0.2 * this.dailyLimit;
  
  // Count of requests made today
  private requestCount: number = 0;
  
  // Last reset timestamp
  private lastResetTimestamp: Date = new Date();
  
  // Queue for pending requests
  private lowPriorityQueue: Array<{ task: () => Promise<any>, resolve: (value: any) => void, reject: (reason: any) => void }> = [];
  private highPriorityQueue: Array<{ task: () => Promise<any>, resolve: (value: any) => void, reject: (reason: any) => void }> = [];
  
  // Processing flag
  private isProcessing: boolean = false;
  
  private constructor() {
    this.resetCounterIfNewDay();
    
    // Reset counter at midnight
    setInterval(() => {
      this.resetCounterIfNewDay();
    }, 60000); // Check every minute
    
    // Process queue every second
    setInterval(() => {
      this.processQueue();
    }, 1000);
  }
  
  /**
   * Get the RateLimiter instance (singleton)
   */
  public static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    
    return RateLimiter.instance;
  }
  
  /**
   * Reset counter if it's a new day
   */
  private resetCounterIfNewDay(): void {
    const now = new Date();
    const lastDay = this.lastResetTimestamp.getDate();
    const currentDay = now.getDate();
    
    if (lastDay !== currentDay) {
      this.requestCount = 0;
      this.lastResetTimestamp = now;
      console.log('RPC rate limit counter reset for new day');
    }
  }
  
  /**
   * Get current usage statistics
   */
  public getUsageStats(): { requestCount: number, dailyLimit: number, remainingRequests: number, usagePercentage: number } {
    return {
      requestCount: this.requestCount,
      dailyLimit: this.dailyLimit,
      remainingRequests: this.dailyLimit - this.requestCount,
      usagePercentage: (this.requestCount / this.dailyLimit) * 100
    };
  }
  
  /**
   * Process the next item in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Always process high-priority queue first
      if (this.highPriorityQueue.length > 0) {
        const { task, resolve, reject } = this.highPriorityQueue.shift()!;
        
        try {
          const result = await task();
          this.requestCount++;
          resolve(result);
        } catch (error) {
          reject(error);
        }
      } 
      // Then process low-priority queue if we have capacity
      else if (this.lowPriorityQueue.length > 0 && this.requestCount < (this.dailyLimit - this.highPriorityReserve)) {
        const { task, resolve, reject } = this.lowPriorityQueue.shift()!;
        
        try {
          const result = await task();
          this.requestCount++;
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Queue a task with low priority
   * These will be processed when there's available capacity
   */
  public queueLowPriority<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Check if we've exceeded the limit
      if (this.requestCount >= this.dailyLimit) {
        reject(new Error('Daily RPC request limit reached. Please try again tomorrow.'));
        return;
      }
      
      // Add task to queue
      this.lowPriorityQueue.push({ task, resolve, reject });
    });
  }
  
  /**
   * Queue a task with high priority
   * These will be processed before low-priority tasks
   */
  public queueHighPriority<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Check if we've exceeded the limit
      if (this.requestCount >= this.dailyLimit) {
        reject(new Error('Daily RPC request limit reached. Please try again tomorrow.'));
        return;
      }
      
      // Add task to queue
      this.highPriorityQueue.push({ task, resolve, reject });
    });
  }
  
  /**
   * Execute a task immediately, bypassing the queue
   * Use sparingly for critical operations
   */
  public async executeImmediately<T>(task: () => Promise<T>): Promise<T> {
    // Check if we've exceeded the limit
    if (this.requestCount >= this.dailyLimit) {
      throw new Error('Daily RPC request limit reached. Please try again tomorrow.');
    }
    
    try {
      const result = await task();
      this.requestCount++;
      return result;
    } catch (error) {
      throw error;
    }
  }
}

// Create and export a singleton instance
const rateLimiter = RateLimiter.getInstance();
export default rateLimiter;