/**
 * RPC Rate Limiter
 * Ensures that we don't exceed the daily limit of API calls to the Solana RPC
 */
export class RpcRateLimiter {
  private static instance: RpcRateLimiter;
  
  private dailyLimit: number;
  private requestCount: number;
  private resetTime: Date;
  private highPriorityQueue: Array<() => Promise<any>>;
  private lowPriorityQueue: Array<() => Promise<any>>;
  private processingInterval: NodeJS.Timeout | null;
  private isProcessing: boolean;
  private throttleDelay: number;
  
  private constructor(dailyLimit: number = 40000) {
    this.dailyLimit = dailyLimit;
    this.requestCount = 0;
    this.resetTime = this.calculateNextResetTime();
    this.highPriorityQueue = [];
    this.lowPriorityQueue = [];
    this.processingInterval = null;
    this.isProcessing = false;
    this.throttleDelay = 100; // 100ms between requests by default
    
    // Start the processing queue
    this.startProcessing();
    
    // Set up daily reset
    this.setupDailyReset();
  }
  
  /**
   * Get the RpcRateLimiter instance (singleton)
   */
  public static getInstance(): RpcRateLimiter {
    if (!RpcRateLimiter.instance) {
      RpcRateLimiter.instance = new RpcRateLimiter();
    }
    
    return RpcRateLimiter.instance;
  }
  
  /**
   * Calculate the next reset time (midnight UTC)
   */
  private calculateNextResetTime(): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  
  /**
   * Set up the daily reset of request count
   */
  private setupDailyReset(): void {
    const now = new Date();
    const timeUntilReset = this.resetTime.getTime() - now.getTime();
    
    setTimeout(() => {
      console.log('Resetting RPC request count');
      this.requestCount = 0;
      this.resetTime = this.calculateNextResetTime();
      this.setupDailyReset();
    }, timeUntilReset);
  }
  
  /**
   * Start processing the request queues
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      return;
    }
    
    this.processingInterval = setInterval(() => {
      this.processNextRequest();
    }, this.throttleDelay);
  }
  
  /**
   * Process the next request in the queue
   */
  private async processNextRequest(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    
    // Check if we've hit the daily limit
    if (this.requestCount >= this.dailyLimit) {
      console.warn('Daily RPC request limit reached. Requests will be queued until reset.');
      return;
    }
    
    // First try high priority queue, then low priority
    const nextRequest = this.highPriorityQueue.shift() || this.lowPriorityQueue.shift();
    
    if (!nextRequest) {
      return;
    }
    
    try {
      this.isProcessing = true;
      this.requestCount++;
      
      await nextRequest();
    } catch (error) {
      console.error('Error processing RPC request:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Queue a request with high priority
   * @param request The request function to execute
   * @returns A promise that resolves with the request result
   */
  public async queueHighPriority<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedRequest = async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      
      this.highPriorityQueue.push(wrappedRequest);
    });
  }
  
  /**
   * Queue a request with low priority
   * @param request The request function to execute
   * @returns A promise that resolves with the request result
   */
  public async queueLowPriority<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedRequest = async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      
      this.lowPriorityQueue.push(wrappedRequest);
    });
  }
  
  /**
   * Get the current status of the rate limiter
   */
  public getStatus(): RateLimiterStatus {
    return {
      requestCount: this.requestCount,
      dailyLimit: this.dailyLimit,
      remainingRequests: this.dailyLimit - this.requestCount,
      resetTime: this.resetTime,
      highPriorityQueueLength: this.highPriorityQueue.length,
      lowPriorityQueueLength: this.lowPriorityQueue.length,
      utilizationPercentage: (this.requestCount / this.dailyLimit) * 100
    };
  }
  
  /**
   * Stop the rate limiter
   */
  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}

/**
 * Rate limiter status interface
 */
export interface RateLimiterStatus {
  requestCount: number;
  dailyLimit: number;
  remainingRequests: number;
  resetTime: Date;
  highPriorityQueueLength: number;
  lowPriorityQueueLength: number;
  utilizationPercentage: number;
}

// Export a singleton instance
export default RpcRateLimiter.getInstance();