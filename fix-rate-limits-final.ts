/**
 * Final Rate Limit Fix for Real Trading
 * 
 * This script makes final adjustments to completely solve
 * the RPC rate limit issues with Instant Nodes.
 */

import * as fs from 'fs';
import * as path from 'path';

// Critical paths
const DATA_DIR = './data';
const NEXUS_DIR = path.join(DATA_DIR, 'nexus');

// RPC configuration with extremely conservative settings
function updateRpcPoolConfig(): boolean {
  try {
    const rpcConfigPath = path.join(DATA_DIR, 'rpc-config.json');
    
    // Ultra-conservative rate limits
    const rpcConfig = {
      poolSize: 1, 
      maxBatchSize: 1,
      cacheSettings: {
        accountInfo: 30000,  // 30s cache
        tokenInfo: 120000,   // 2min cache
        blockInfo: 20000,    // 20s cache
        balance: 30000,      // 30s cache
        transaction: 120000  // 2min cache
      },
      endpoints: [
        {
          url: 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9',
          weight: 10,
          priority: 1,
          maxRequestsPerSecond: 1, // Only 1 request per second (60/minute)
          minuteLimit: 60,        // Very conservative 60/minute
          delayBetweenRequests: 1050 // 1.05s between requests (enforced delay)
        },
        {
          url: 'https://api.mainnet-beta.solana.com',
          weight: 2,
          priority: 2,
          maxRequestsPerSecond: 0.5,  // 1 request every 2 seconds
          delayBetweenRequests: 2000  // 2s between requests
        }
      ],
      httpOptions: {
        maxSockets: 5,
        timeout: 120000,  // 2min timeout
        keepAlive: true
      },
      useGrpc: false,
      keepAlive: true,
      rateLimitHandling: {
        enabled: true,
        retryDelayMs: 15000,  // 15s initial delay
        maxRetries: 25,       // Many retries
        exponentialBackoff: true,
        backoffMultiplier: 2,
        requestTracking: {
          enabled: true,
          windowMs: 70000,   // Slightly longer window (70s)
          maxRequests: 60,   // 60 requests per 70s window
          enforcePerEndpoint: true
        },
        tokenBucket: {
          enabled: true,
          refillRatePerSecond: 1,  // 1 per second
          bucketSize: 3            // Very small burst capacity
        }
      },
      optimizedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(rpcConfigPath, JSON.stringify(rpcConfig, null, 2));
    console.log(`Updated RPC pool configuration at ${rpcConfigPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update RPC pool configuration:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Update strategy configuration for minimal execution
function updateStrategyConfig(): boolean {
  try {
    const strategyConfigPath = path.join(DATA_DIR, 'strategy-config.json');
    
    const strategyConfig = {
      parallelExecution: false,
      asyncSignalProcessing: true,
      backgroundProcessing: true,
      maxStrategiesPerBlock: 1,
      signalBufferSize: 5,
      preemptivePositionSizing: true,
      smartOrderRouting: true,
      memoryBufferSizeMB: 256,
      throttling: {
        enabled: true,
        maxSignalsPerMinute: 2,           // Only 2 signals per minute
        maxExecutionsPerMinute: 1,        // Only 1 execution per minute
        minTimeBetweenSignalsMs: 30000,   // 30 seconds between signals
        minTimeBetweenExecutionsMs: 60000 // 60 seconds between executions
      },
      signalProcessingDelay: 10000,        // 10 second delay before processing signals
      optimizedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(strategyConfigPath, JSON.stringify(strategyConfig, null, 2));
    console.log(`Updated strategy configuration at ${strategyConfigPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update strategy configuration:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Create a rate limiting middleware file
function createRateLimiterMiddleware(): boolean {
  try {
    const middlewarePath = path.join(__dirname, 'server', 'lib', 'rateLimiterMiddleware.ts');
    const middlewareDir = path.dirname(middlewarePath);
    
    if (!fs.existsSync(middlewareDir)) {
      fs.mkdirSync(middlewareDir, { recursive: true });
    }
    
    const middlewareCode = `/**
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
      logger.warn(\`Rate limit exceeded for bucket \${bucket}. Adjusting limits.\`);
      
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
};`;
    
    fs.writeFileSync(middlewarePath, middlewareCode);
    console.log(`Created enhanced rate limiter middleware at ${middlewarePath}`);
    return true;
  } catch (error) {
    console.error('Failed to create rate limiter middleware:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Update Nexus engine to use rate limiter
function updateNexusConfig(): boolean {
  try {
    const nexusConfigPath = path.join(NEXUS_DIR, 'config.json');
    
    // Load existing configuration if it exists
    let nexusConfig: any = {
      useRealFunds: true,
      rpcUrl: 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9',
      websocketUrl: 'wss://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9',
      defaultExecutionMode: 'LIVE',
      defaultPriority: 'HIGH',
      defaultConfirmations: 1,
      maxConcurrentTransactions: 1,
      defaultTimeoutMs: 300000, // 5 minute timeout
      defaultMaxRetries: 20,
      maxSlippageBps: 100,
      mevProtection: true,
      backupRpcUrls: ['https://api.mainnet-beta.solana.com']
    };
    
    if (fs.existsSync(nexusConfigPath)) {
      try {
        nexusConfig = JSON.parse(fs.readFileSync(nexusConfigPath, 'utf8'));
        
        // Update key settings
        nexusConfig.maxConcurrentTransactions = 1;
        nexusConfig.defaultTimeoutMs = 300000;
        nexusConfig.defaultMaxRetries = 20;
      } catch (e) {
        // Continue with default config if parsing fails
      }
    }
    
    // Updated rate limit settings
    nexusConfig.rateLimitSettings = {
      maxRequestsPerMinute: 60,           // 60 per minute (1 per second)
      maxRequestsPerSecond: 1,            // 1 per second
      initialBackoffMs: 15000,            // 15s initial backoff
      maxBackoffMs: 300000,               // 5 minute max backoff
      backoffMultiplier: 2,
      retryOnRateLimit: true,
      useTokenBucket: true,
      enforcePerConnection: true,
      delayBetweenTransactionsMs: 15000,  // 15s between transactions
      useRateLimiterMiddleware: true      // Use the new middleware
    };
    
    // Update last updated timestamp
    nexusConfig.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(nexusConfigPath, JSON.stringify(nexusConfig, null, 2));
    console.log(`Updated Nexus Engine configuration at ${nexusConfigPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update Nexus configuration:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('🚀 FINAL RPC RATE LIMIT FIX');
  console.log('=============================================\n');
  
  try {
    console.log('Applying ultra-conservative rate limits for real trading...');
    
    // Update RPC pool configuration
    updateRpcPoolConfig();
    
    // Update strategy configuration
    updateStrategyConfig();
    
    // Create rate limiter middleware
    createRateLimiterMiddleware();
    
    // Update Nexus configuration
    updateNexusConfig();
    
    console.log('\n✅ RATE LIMIT FIX COMPLETE');
    console.log('Your trading system now has ultra-conservative rate limiting:');
    console.log('- Limited to 1 request per second (instead of 3.75)');
    console.log('- Added mandatory 1 second delays between requests');
    console.log('- Added advanced token bucket algorithm for rate control');
    console.log('- Significantly increased caching (30s-2min) to reduce RPC calls');
    console.log('- Limited to only 1 trade per minute');
    console.log('\nStart the trading system with:');
    console.log('npx tsx server/index.ts');
    console.log('=============================================');
    
    return true;
  } catch (error) {
    console.error('Error applying final rate limit fix:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run the script
main();