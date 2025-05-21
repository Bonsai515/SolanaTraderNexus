/**
 * RPC Request Scheduler
 * 
 * This module ensures RPC requests are evenly distributed
 * to avoid hitting rate limits.
 */

class RequestScheduler {
  private queue: Array<{
    execute: () => Promise<any>;
    resolve: (result: any) => void;
    reject: (error: any) => void;
    priority: number;
  }> = [];
  
  private processing = false;
  private requestsThisSecond = 0;
  private requestsThisMinute = 0;
  private lastSecondReset = Date.now();
  private lastMinuteReset = Date.now();
  private maxRequestsPerSecond: number;
  
  constructor(maxRequestsPerSecond = 2) {
    this.maxRequestsPerSecond = maxRequestsPerSecond;
    
    // Reset counters periodically
    setInterval(() => {
      const now = Date.now();
      
      if (now - this.lastSecondReset >= 1000) {
        this.requestsThisSecond = 0;
        this.lastSecondReset = now;
      }
      
      if (now - this.lastMinuteReset >= 60000) {
        this.requestsThisMinute = 0;
        this.lastMinuteReset = now;
      }
      
      // Process queue if available
      if (this.queue.length > 0 && !this.processing) {
        this.processQueue();
      }
    }, 50); // Check frequently
  }
  
  /**
   * Schedule a request with the given priority
   */
  public schedule<T>(
    execute: () => Promise<T>,
    priority = 1
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute,
        resolve,
        reject,
        priority
      });
      
      // Start processing if not already
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Process the request queue
   */
  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    try {
      // Check if we can make a request
      if (this.requestsThisSecond < this.maxRequestsPerSecond) {
        // Sort by priority (higher number = higher priority)
        this.queue.sort((a, b) => b.priority - a.priority);
        
        const request = this.queue.shift();
        if (request) {
          this.requestsThisSecond++;
          this.requestsThisMinute++;
          
          try {
            const result = await request.execute();
            request.resolve(result);
          } catch (error) {
            request.reject(error);
          }
        }
      } else {
        // Need to wait for rate limit reset
        await new Promise(resolve => setTimeout(resolve, 
          1000 - (Date.now() - this.lastSecondReset) + 50));
      }
    } finally {
      this.processing = false;
      
      // If there are more items, continue processing
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 10);
      }
    }
  }
  
  /**
   * Get current scheduler stats
   */
  public getStats() {
    return {
      queueLength: this.queue.length,
      requestsThisSecond: this.requestsThisSecond,
      requestsThisMinute: this.requestsThisMinute,
      maxRequestsPerSecond: this.maxRequestsPerSecond
    };
  }
}

// Export singleton instance
export const scheduler = new RequestScheduler();
export default scheduler;