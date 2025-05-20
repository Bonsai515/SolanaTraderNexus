/**
 * RPC Request Optimization System
 * 
 * This script optimizes RPC request patterns to avoid rate limits
 * while ensuring optimal performance for trading strategies.
 */

import { Connection } from '@solana/web3.js';
import { rpcManager } from './enhanced-rpc-manager';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

// RPC request patterns enum
enum RequestPattern {
  SINGLE = 'single',
  BATCHED = 'batched',
  STAGGERED = 'staggered',
  ADAPTIVE = 'adaptive'
}

// Request type categories
enum RequestType {
  TRANSACTION = 'transaction',
  ACCOUNT = 'account',
  BLOCK = 'block',
  PROGRAM = 'program'
}

// Request priority levels
enum RequestPriority {
  CRITICAL = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4
}

interface RequestConfig {
  type: RequestType;
  priority: RequestPriority;
  pattern: RequestPattern;
  maxBatchSize?: number;
  staggerIntervalMs?: number;
  retryStrategy?: {
    maxRetries: number;
    baseDelayMs: number;
    exponentialFactor: number;
  };
}

interface RequestStats {
  successCount: number;
  failureCount: number;
  rateLimitCount: number;
  avgResponseTimeMs: number;
  lastResponseTimeMs: number;
}

// Request tracking
interface RequestTracker {
  [endpoint: string]: {
    requestsPerMinute: number;
    lastMinuteTimestamp: number;
    rateLimit: number;
    cooldownUntil: number;
    stats: {
      [type in RequestType]: RequestStats;
    };
  };
}

class RpcRequestOptimizer {
  private tracker: RequestTracker = {};
  private requestConfigs: Map<RequestType, RequestConfig> = new Map();
  private logPath: string;
  private connection: Connection | null = null;

  constructor() {
    // Create logs directory if it doesn't exist
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
    }
    this.logPath = path.join('logs', 'rpc-optimizer.log');

    // Set default request configurations
    this.setupDefaultConfigs();

    // Initialize connection
    this.refreshConnection();

    this.log('RPC Request Optimizer initialized');
  }

  private refreshConnection(): void {
    try {
      this.connection = rpcManager.getConnection();
      const providerName = rpcManager.getActiveProviderName();
      this.log(`Using RPC provider: ${providerName}`);

      // Initialize tracker for this endpoint if not exists
      if (providerName && !this.tracker[providerName]) {
        this.tracker[providerName] = {
          requestsPerMinute: 0,
          lastMinuteTimestamp: Date.now(),
          rateLimit: this.getRateLimitForProvider(providerName),
          cooldownUntil: 0,
          stats: {
            [RequestType.TRANSACTION]: this.createEmptyStats(),
            [RequestType.ACCOUNT]: this.createEmptyStats(),
            [RequestType.BLOCK]: this.createEmptyStats(),
            [RequestType.PROGRAM]: this.createEmptyStats(),
          }
        };
      }
    } catch (error) {
      this.log(`Error refreshing connection: ${error}`, 'ERROR');
    }
  }

  private createEmptyStats(): RequestStats {
    return {
      successCount: 0,
      failureCount: 0,
      rateLimitCount: 0,
      avgResponseTimeMs: 0,
      lastResponseTimeMs: 0
    };
  }

  private getRateLimitForProvider(providerName: string): number {
    // Default rate limits per minute for different providers
    const rateLimits: { [key: string]: number } = {
      'Syndica': 1000,
      'Helius': 500,
      'Alchemy': 800,
      'Instantnodes': 300,
      'default': 250
    };

    return rateLimits[providerName] || rateLimits['default'];
  }

  private setupDefaultConfigs(): void {
    // Transaction request config (high priority, adaptive pattern)
    this.requestConfigs.set(RequestType.TRANSACTION, {
      type: RequestType.TRANSACTION,
      priority: RequestPriority.CRITICAL,
      pattern: RequestPattern.ADAPTIVE,
      retryStrategy: {
        maxRetries: 5,
        baseDelayMs: 500,
        exponentialFactor: 1.5
      }
    });

    // Account request config (high priority, batched pattern)
    this.requestConfigs.set(RequestType.ACCOUNT, {
      type: RequestType.ACCOUNT,
      priority: RequestPriority.HIGH,
      pattern: RequestPattern.BATCHED,
      maxBatchSize: 100,
      retryStrategy: {
        maxRetries: 3,
        baseDelayMs: 250,
        exponentialFactor: 1.3
      }
    });

    // Block request config (medium priority, staggered pattern)
    this.requestConfigs.set(RequestType.BLOCK, {
      type: RequestType.BLOCK,
      priority: RequestPriority.MEDIUM,
      pattern: RequestPattern.STAGGERED,
      staggerIntervalMs: 50,
      retryStrategy: {
        maxRetries: 2,
        baseDelayMs: 200,
        exponentialFactor: 1.2
      }
    });

    // Program request config (medium priority, batched pattern)
    this.requestConfigs.set(RequestType.PROGRAM, {
      type: RequestType.PROGRAM,
      priority: RequestPriority.MEDIUM,
      pattern: RequestPattern.BATCHED,
      maxBatchSize: 50,
      retryStrategy: {
        maxRetries: 3,
        baseDelayMs: 300,
        exponentialFactor: 1.3
      }
    });
  }

  private log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} [${level}] [RPC Optimizer] ${message}`;
    
    console.log(logMessage);
    
    // Append to log file
    try {
      fs.appendFileSync(this.logPath, logMessage + '\n');
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }

  private updateRequestStats(providerName: string, type: RequestType, responseTimeMs: number, success: boolean, rateLimited: boolean): void {
    if (!this.tracker[providerName]) {
      return;
    }

    const stats = this.tracker[providerName].stats[type];
    
    // Update request counts
    if (success) {
      stats.successCount += 1;
    } else {
      stats.failureCount += 1;
    }
    
    if (rateLimited) {
      stats.rateLimitCount += 1;
    }
    
    // Update response times
    const totalRequests = stats.successCount + stats.failureCount;
    stats.lastResponseTimeMs = responseTimeMs;
    stats.avgResponseTimeMs = (stats.avgResponseTimeMs * (totalRequests - 1) + responseTimeMs) / totalRequests;
  }

  private shouldThrottle(providerName: string): boolean {
    if (!this.tracker[providerName]) {
      return false;
    }
    
    const now = Date.now();
    const tracker = this.tracker[providerName];
    
    // Check if in cooldown period
    if (tracker.cooldownUntil > now) {
      return true;
    }
    
    // Reset counter if last minute has passed
    if (now - tracker.lastMinuteTimestamp > 60000) {
      tracker.requestsPerMinute = 0;
      tracker.lastMinuteTimestamp = now;
    }
    
    // Check if approaching rate limit (use 85% as threshold)
    return tracker.requestsPerMinute > tracker.rateLimit * 0.85;
  }

  private trackRequest(providerName: string): void {
    if (!this.tracker[providerName]) {
      return;
    }
    
    this.tracker[providerName].requestsPerMinute += 1;
  }

  private enforceRateLimit(providerName: string, seconds: number): void {
    if (!this.tracker[providerName]) {
      return;
    }
    
    const now = Date.now();
    this.tracker[providerName].cooldownUntil = now + (seconds * 1000);
    this.log(`Rate limiting ${providerName} for ${seconds} seconds`, 'WARN');
  }

  private calculateRetryDelay(retryAttempt: number, config: RequestConfig): number {
    if (!config.retryStrategy) {
      return 1000; // Default 1 second
    }
    
    const { baseDelayMs, exponentialFactor } = config.retryStrategy;
    return baseDelayMs * Math.pow(exponentialFactor, retryAttempt);
  }

  // Public methods
  public async executeRequest<T>(
    requestFn: () => Promise<T>,
    type: RequestType = RequestType.TRANSACTION
  ): Promise<T> {
    // Ensure we have the latest connection
    this.refreshConnection();
    
    if (!this.connection) {
      throw new Error('No RPC connection available');
    }
    
    const providerName = rpcManager.getActiveProviderName();
    if (!providerName) {
      throw new Error('No active RPC provider');
    }
    
    const config = this.requestConfigs.get(type) || this.requestConfigs.get(RequestType.TRANSACTION)!;
    let retryAttempt = 0;
    const maxRetries = config.retryStrategy?.maxRetries || 3;
    
    // Check if we should throttle requests
    if (this.shouldThrottle(providerName)) {
      this.log(`Throttling ${type} request to ${providerName} due to approaching rate limit`, 'WARN');
      await new Promise(resolve => setTimeout(resolve, 500)); // Short delay
    }
    
    // Track this request
    this.trackRequest(providerName);
    
    while (true) {
      const startTime = Date.now();
      try {
        const result = await requestFn();
        
        // Update stats with success
        const responseTime = Date.now() - startTime;
        this.updateRequestStats(providerName, type, responseTime, true, false);
        
        return result;
      } catch (error: any) {
        const responseTime = Date.now() - startTime;
        
        // Check if this is a rate limit error
        const isRateLimit = this.isRateLimitError(error);
        
        if (isRateLimit) {
          this.updateRequestStats(providerName, type, responseTime, false, true);
          
          // Apply rate limiting cooldown
          this.enforceRateLimit(providerName, 5); // 5 second cooldown
          
          retryAttempt++;
          if (retryAttempt <= maxRetries) {
            const delay = this.calculateRetryDelay(retryAttempt, config);
            this.log(`Server responded with 429 Too Many Requests. Retrying after ${delay}ms delay...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Try to switch providers if we've hit a rate limit
            this.refreshConnection();
            continue;
          }
        } else {
          // Not a rate limit error
          this.updateRequestStats(providerName, type, responseTime, false, false);
        }
        
        // If we've exhausted retries or it's not a rate limit error
        throw error;
      }
    }
  }

  private isRateLimitError(error: any): boolean {
    // Check various error patterns that indicate rate limiting
    if (!error) return false;
    
    // Check for common rate limit status codes
    if (error.status === 429 || error.statusCode === 429) return true;
    
    // Check error message content
    const errorMessage = error.message || error.toString();
    if (
      errorMessage.includes('429') ||
      errorMessage.includes('Too Many Requests') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('exceeded') ||
      errorMessage.includes('throttled')
    ) {
      return true;
    }
    
    // Check error code if it exists
    if (
      error.code === 429 || 
      (error.error && error.error.code === 429) ||
      (error.data && error.data.code === 429)
    ) {
      return true;
    }
    
    return false;
  }

  public getStats(): any {
    return {
      requestStats: this.tracker,
      activeProvider: rpcManager.getActiveProviderName(),
      providerStatus: rpcManager.getProviderStatus()
    };
  }

  // Method to batch process account info requests
  public async batchGetMultipleAccounts<T>(
    accountFn: (accounts: string[]) => Promise<T>,
    accounts: string[]
  ): Promise<T> {
    const config = this.requestConfigs.get(RequestType.ACCOUNT)!;
    const batchSize = config.maxBatchSize || 100;
    
    // If under batch size, process directly
    if (accounts.length <= batchSize) {
      return this.executeRequest(() => accountFn(accounts), RequestType.ACCOUNT);
    }
    
    this.log(`Batching large account request: ${accounts.length} accounts in chunks of ${batchSize}`);
    
    // Process in batches
    const results: any[] = [];
    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize);
      const batchResult = await this.executeRequest(() => accountFn(batch), RequestType.ACCOUNT);
      results.push(batchResult);
      
      // Small delay between batches
      if (i + batchSize < accounts.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // Combine results (this is a simplification, actual implementation would depend on the structure of T)
    return results as unknown as T;
  }

  // Method to optimize the request pattern based on current conditions
  public optimizeRequestPattern(type: RequestType): void {
    const config = this.requestConfigs.get(type);
    if (!config) return;
    
    const providerName = rpcManager.getActiveProviderName();
    if (!providerName || !this.tracker[providerName]) return;
    
    const stats = this.tracker[providerName].stats[type];
    const rateLimitRatio = stats.rateLimitCount / (stats.successCount + stats.failureCount + 1);
    
    // If experiencing high rate limits, adapt the pattern
    if (rateLimitRatio > 0.1) {
      // More than 10% requests getting rate limited
      if (config.pattern === RequestPattern.SINGLE) {
        config.pattern = RequestPattern.STAGGERED;
        config.staggerIntervalMs = 100;
      } else if (config.pattern === RequestPattern.BATCHED) {
        // Reduce batch size
        if (config.maxBatchSize && config.maxBatchSize > 10) {
          config.maxBatchSize = Math.floor(config.maxBatchSize * 0.7);
        }
      } else if (config.pattern === RequestPattern.STAGGERED) {
        // Increase stagger interval
        if (config.staggerIntervalMs) {
          config.staggerIntervalMs = config.staggerIntervalMs * 1.5;
        }
      }
      
      this.log(`Optimized request pattern for ${type}: ${config.pattern}`, 'INFO');
    }
  }

  // Method to force switch to a specific provider
  public forceSwitchProvider(providerName: string): boolean {
    const result = rpcManager.forceProviderSwitch(providerName);
    if (result) {
      this.refreshConnection();
      this.log(`Forced switch to RPC provider: ${providerName}`);
    }
    return result;
  }
}

// Export singleton instance
export const rpcOptimizer = new RpcRequestOptimizer();