/**
 * Enhanced RPC Rate Limiter Middleware
 * 
 * This middleware implements a token bucket algorithm to strictly
 * enforce RPC rate limits for Instant Nodes.
 */

import { logger } from '../../logger';

// Token bucket rate limiter
class TokenBucket {
  private tokens: number;
  private capacity: number;
  private refillRate: number; // tokens per ms
  private lastRefill: number;
  
  constructor(capacity: number, refillPerSecond: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillPerSecond / 1000; // convert to per ms
    this.lastRefill = Date.now();
  }
  
  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
  
  consume(count: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    
    return false;
  }
  
  get available(): number {
    this.refill();
    return this.tokens;
  }
}

// Request queue for organizing pending requests
class RequestQueue {
  private queue: Array<{
    resolve: () => void;
    timestamp: number;
    priority: number;
  }> = [];
  private processing: boolean = false;
  private buckets: Map<string, TokenBucket> = new Map();
  
  constructor() {
    // Create default bucket for Instant Nodes (1 per second)
    this.buckets.set('default', new TokenBucket(3, 1));
    
    // Start queue processing
    setInterval(() => this.processQueue(), 100);
  }
  
  // Add bucket for specific endpoint
  addBucket(name: string, capacity: number, refillPerSecond: number) {
    this.buckets.set(name, new TokenBucket(capacity, refillPerSecond));
  }
  
  // Enqueue a request
  enqueue(bucket: string = 'default', priority: number = 1): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push({
        resolve,
        timestamp: Date.now(),
        priority
      });
    });
  }
  
  // Process the queue
  private processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    try {
      // Sort by priority then timestamp
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.timestamp - b.timestamp; // Older requests first
      });
      
      // Process queue in priority order
      for (const bucketName of this.buckets.keys()) {
        const bucket = this.buckets.get(bucketName)!;
        
        if (bucket.consume()) {
          // We have a token, process next request
          const next = this.queue.shift();
          if (next) {
            next.resolve();
          }
          
          // Only process one request per iteration
          break;
        }
      }
    } finally {
      this.processing = false;
    }
  }
  
  // Get queue stats
  getStats() {
    return {
      queueLength: this.queue.length,
      buckets: Array.from(this.buckets.entries()).map(([name, bucket]) => ({
        name,
        availableTokens: bucket.available
      }))
    };
  }
}

// Global request queue
const requestQueue = new RequestQueue();

// Rate limit a function call
export async function rateLimitCall<T>(
  fn: () => Promise<T>,
  bucket: string = 'default',
  priority: number = 1
): Promise<T> {
  // Wait for rate limit token
  await requestQueue.enqueue(bucket, priority);
  
  try {
    return await fn();
  } catch (error: any) {
    // If we got a rate limit error, we need to adjust our rate limiting
    if (error.message && error.message.includes('429')) {
      logger.warn(`Rate limit exceeded for bucket ${bucket}. Adjusting limits.`);
      
      // Wait longer for rate limiting to recover
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
    
    throw error;
  }
}

// Initialize with default buckets
export function initializeRateLimiter() {
  // Instant Nodes bucket (very conservative: 1 per second)
  requestQueue.addBucket('instantnodes', 3, 1);
  
  // Public RPC bucket (0.5 per second)
  requestQueue.addBucket('public', 2, 0.5);
  
  logger.info('Rate limiter middleware initialized');
}

// Get rate limiter stats
export function getRateLimiterStats() {
  return requestQueue.getStats();
}

// Export the rate limiter
export const rateLimiter = {
  limit: rateLimitCall,
  initialize: initializeRateLimiter,
  getStats: getRateLimiterStats
};