/**
 * Optimize RPC Requests
 * 
 * Specialized request handling to optimize RPC usage with:
 * - Request batching
 * - Priority-based scheduling
 * - Request categorization
 * - Caching optimizations
 * - Rate limit avoidance
 */

import { PublicKey } from '@solana/web3.js';
import { rpcManager } from './enhanced-rpc-manager';
import fs from 'fs';
import path from 'path';

// Request types
export enum RequestType {
  TRANSACTION = 'transaction',
  ACCOUNT = 'account',
  BLOCK = 'block',
  PROGRAM = 'program',
  MARKET = 'market',
  PRICE = 'price',
  METADATA = 'metadata'
}

// Priority levels
export enum RequestPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

// Cache configuration
interface CacheConfig {
  enabled: boolean;
  timeMs: {
    [RequestType.TRANSACTION]: number;
    [RequestType.ACCOUNT]: number;
    [RequestType.BLOCK]: number;
    [RequestType.PROGRAM]: number;
    [RequestType.MARKET]: number;
    [RequestType.PRICE]: number;
    [RequestType.METADATA]: number;
  };
  maxSize: {
    [RequestType.TRANSACTION]: number;
    [RequestType.ACCOUNT]: number;
    [RequestType.BLOCK]: number;
    [RequestType.PROGRAM]: number;
    [RequestType.MARKET]: number;
    [RequestType.PRICE]: number;
    [RequestType.METADATA]: number;
  };
}

// Request batch configuration
interface BatchConfig {
  enabled: boolean;
  maxSize: number;
  maxDelayMs: number;
  minSize: number;
  byType: {
    [RequestType.TRANSACTION]: boolean;
    [RequestType.ACCOUNT]: boolean;
    [RequestType.BLOCK]: boolean;
    [RequestType.PROGRAM]: boolean;
    [RequestType.MARKET]: boolean;
    [RequestType.PRICE]: boolean;
    [RequestType.METADATA]: boolean;
  };
}

// Rate limit configuration
interface RateLimitConfig {
  requestsPerSecondLimit: number;
  requestsPerMinuteLimit: number;
  requestsPerHourLimit: number;
  safetyFactor: number; // 0-1, percentage of limit to stay under
  adaptToProviderLimits: boolean;
}

// Cache entries
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  type: RequestType;
  key: string;
}

// RPC Request Optimizer
class RpcRequestOptimizer {
  private cacheConfig: CacheConfig;
  private batchConfig: BatchConfig;
  private rateLimitConfig: RateLimitConfig;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private requestCounts = {
    perSecond: 0,
    perMinute: 0,
    perHour: 0,
    lastReset: {
      second: Date.now(),
      minute: Date.now(),
      hour: Date.now()
    }
  };
  private pendingBatches: Map<RequestType, any[]> = new Map();
  private batchTimeouts: Map<RequestType, NodeJS.Timeout> = new Map();
  private stats = {
    requestsByType: {
      [RequestType.TRANSACTION]: 0,
      [RequestType.ACCOUNT]: 0,
      [RequestType.BLOCK]: 0,
      [RequestType.PROGRAM]: 0,
      [RequestType.MARKET]: 0,
      [RequestType.PRICE]: 0,
      [RequestType.METADATA]: 0
    },
    cacheHits: 0,
    cacheMisses: 0,
    batchedRequests: 0,
    individualRequests: 0,
    rateLimitDelays: 0,
    totalRequests: 0,
    startTime: Date.now()
  };

  constructor() {
    // Default cache configuration
    this.cacheConfig = {
      enabled: true,
      timeMs: {
        [RequestType.TRANSACTION]: 10000,  // 10 seconds
        [RequestType.ACCOUNT]: 5000,       // 5 seconds
        [RequestType.BLOCK]: 30000,        // 30 seconds
        [RequestType.PROGRAM]: 60000,      // 1 minute
        [RequestType.MARKET]: 3000,        // 3 seconds
        [RequestType.PRICE]: 2000,         // 2 seconds
        [RequestType.METADATA]: 300000     // 5 minutes
      },
      maxSize: {
        [RequestType.TRANSACTION]: 1000,
        [RequestType.ACCOUNT]: 2000,
        [RequestType.BLOCK]: 100,
        [RequestType.PROGRAM]: 500,
        [RequestType.MARKET]: 200,
        [RequestType.PRICE]: 500,
        [RequestType.METADATA]: 1000
      }
    };

    // Default batch configuration
    this.batchConfig = {
      enabled: true,
      maxSize: 100,
      maxDelayMs: 50,
      minSize: 5,
      byType: {
        [RequestType.TRANSACTION]: false,  // Don't batch transactions
        [RequestType.ACCOUNT]: true,
        [RequestType.BLOCK]: false,
        [RequestType.PROGRAM]: true,
        [RequestType.MARKET]: true,
        [RequestType.PRICE]: true,
        [RequestType.METADATA]: true
      }
    };

    // Default rate limit configuration
    this.rateLimitConfig = {
      requestsPerSecondLimit: 50,
      requestsPerMinuteLimit: 2000,
      requestsPerHourLimit: 100000,
      safetyFactor: 0.8,
      adaptToProviderLimits: true
    };

    // Load custom configuration if available
    this.loadConfig();

    // Start rate limit counter reset intervals
    setInterval(() => this.resetRateLimitCounters(), 1000);

    // Create cache maintenance interval
    setInterval(() => this.maintainCache(), 60000);

    console.log('RPC Request Optimizer initialized');
  }

  // Load configuration from file if available
  private loadConfig(): void {
    try {
      const configPath = 'config/rpc-optimizer-config.json';
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        // Merge with defaults
        if (config.cacheConfig) {
          this.cacheConfig = { ...this.cacheConfig, ...config.cacheConfig };
        }
        
        if (config.batchConfig) {
          this.batchConfig = { ...this.batchConfig, ...config.batchConfig };
        }
        
        if (config.rateLimitConfig) {
          this.rateLimitConfig = { ...this.rateLimitConfig, ...config.rateLimitConfig };
        }
        
        console.log('Loaded RPC optimizer configuration from file');
      }
    } catch (error) {
      console.error('Error loading RPC optimizer configuration:', error);
    }
  }

  // Save configuration to file
  private saveConfig(): void {
    try {
      const configDir = 'config';
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir);
      }
      
      const config = {
        cacheConfig: this.cacheConfig,
        batchConfig: this.batchConfig,
        rateLimitConfig: this.rateLimitConfig
      };
      
      fs.writeFileSync('config/rpc-optimizer-config.json', JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error saving RPC optimizer configuration:', error);
    }
  }

  // Reset rate limit counters
  private resetRateLimitCounters(): void {
    const now = Date.now();
    
    // Reset second counter
    if (now - this.requestCounts.lastReset.second >= 1000) {
      this.requestCounts.perSecond = 0;
      this.requestCounts.lastReset.second = now;
    }
    
    // Reset minute counter
    if (now - this.requestCounts.lastReset.minute >= 60000) {
      this.requestCounts.perMinute = 0;
      this.requestCounts.lastReset.minute = now;
    }
    
    // Reset hour counter
    if (now - this.requestCounts.lastReset.hour >= 3600000) {
      this.requestCounts.perHour = 0;
      this.requestCounts.lastReset.hour = now;
    }
  }

  // Maintain cache (remove expired entries and limit size)
  private maintainCache(): void {
    if (!this.cacheConfig.enabled) return;
    
    const now = Date.now();
    const entriesByType = new Map<RequestType, CacheEntry<any>[]>();
    
    // Group entries by type
    for (const [key, entry] of this.cache) {
      if (!entriesByType.has(entry.type)) {
        entriesByType.set(entry.type, []);
      }
      entriesByType.get(entry.type)!.push(entry);
    }
    
    // Process each type
    for (const type of Object.values(RequestType)) {
      const entries = entriesByType.get(type as RequestType) || [];
      
      // Remove expired entries
      const validEntries = entries.filter(
        entry => now - entry.timestamp <= this.cacheConfig.timeMs[entry.type]
      );
      
      // If still too many entries, keep the newest ones
      const maxSize = this.cacheConfig.maxSize[type as RequestType];
      if (validEntries.length > maxSize) {
        // Sort by timestamp (newest first)
        validEntries.sort((a, b) => b.timestamp - a.timestamp);
        
        // Remove oldest entries
        const entriesToRemove = validEntries.slice(maxSize);
        for (const entry of entriesToRemove) {
          this.cache.delete(entry.key);
        }
      }
    }
    
    console.log(`Cache maintenance complete, ${this.cache.size} entries remaining`);
  }

  // Generate cache key
  private generateCacheKey(method: string, params: any[]): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  // Check if we're approaching rate limits
  private isApproachingRateLimit(): boolean {
    const secondLimit = this.rateLimitConfig.requestsPerSecondLimit * this.rateLimitConfig.safetyFactor;
    const minuteLimit = this.rateLimitConfig.requestsPerMinuteLimit * this.rateLimitConfig.safetyFactor;
    const hourLimit = this.rateLimitConfig.requestsPerHourLimit * this.rateLimitConfig.safetyFactor;
    
    return (
      this.requestCounts.perSecond >= secondLimit ||
      this.requestCounts.perMinute >= minuteLimit ||
      this.requestCounts.perHour >= hourLimit
    );
  }

  // Update rate limit counters
  private updateRateLimitCounters(): void {
    this.resetRateLimitCounters();
    
    this.requestCounts.perSecond += 1;
    this.requestCounts.perMinute += 1;
    this.requestCounts.perHour += 1;
  }

  // Determine priority for a request type
  private getPriorityForRequestType(type: RequestType): RequestPriority {
    switch (type) {
      case RequestType.TRANSACTION:
        return RequestPriority.HIGH;
      case RequestType.PRICE:
      case RequestType.ACCOUNT:
        return RequestPriority.MEDIUM;
      default:
        return RequestPriority.LOW;
    }
  }

  // Main method to execute an RPC request
  public async executeRequest<T>(
    executeFunction: () => Promise<T>,
    type: RequestType,
    cacheKey?: string,
    priority?: RequestPriority
  ): Promise<T> {
    // Track request
    this.stats.totalRequests++;
    this.stats.requestsByType[type]++;
    
    // Generate cache key if not provided
    const actualCacheKey = cacheKey || `auto_${Date.now()}_${Math.random()}`;
    
    // Check cache if enabled
    if (this.cacheConfig.enabled && cacheKey) {
      const cachedEntry = this.cache.get(actualCacheKey);
      if (cachedEntry && (Date.now() - cachedEntry.timestamp <= this.cacheConfig.timeMs[type])) {
        this.stats.cacheHits++;
        return cachedEntry.data;
      } else {
        this.stats.cacheMisses++;
      }
    }
    
    // Determine priority if not provided
    const actualPriority = priority || this.getPriorityForRequestType(type);
    
    // Check if we're approaching rate limits
    if (this.isApproachingRateLimit()) {
      // For low priority requests, delay if approaching limits
      if (actualPriority === RequestPriority.LOW) {
        this.stats.rateLimitDelays++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Update rate limit counters
    this.updateRateLimitCounters();
    
    // Execute the request
    try {
      this.stats.individualRequests++;
      
      const result = await rpcManager.executeRequest(
        "custom", 
        [], 
        { priority: actualPriority }
      );
      
      // Cache the result if caching is enabled
      if (this.cacheConfig.enabled && cacheKey) {
        this.cache.set(actualCacheKey, {
          data: result,
          timestamp: Date.now(),
          type,
          key: actualCacheKey
        });
      }
      
      return result;
    } catch (error) {
      console.error(`Error executing ${type} request:`, error);
      throw error;
    }
  }

  // Log statistics
  public logStats(): void {
    const now = Date.now();
    const uptimeSeconds = (now - this.stats.startTime) / 1000;
    
    console.log('\n===== RPC REQUEST OPTIMIZER STATISTICS =====');
    console.log(`Uptime: ${(uptimeSeconds / 60).toFixed(2)} minutes`);
    console.log(`Total requests: ${this.stats.totalRequests}`);
    console.log(`Request rate: ${(this.stats.totalRequests / uptimeSeconds).toFixed(2)}/second`);
    console.log(`Cache hit ratio: ${(this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(2)}%`);
    console.log(`Individual requests: ${this.stats.individualRequests}`);
    console.log(`Batched requests: ${this.stats.batchedRequests}`);
    console.log(`Rate limit delays: ${this.stats.rateLimitDelays}`);
    
    console.log('\nRequests by type:');
    for (const type of Object.values(RequestType)) {
      console.log(`  ${type}: ${this.stats.requestsByType[type as RequestType]}`);
    }
    
    console.log('\nCurrent rate limits:');
    console.log(`  Per second: ${this.requestCounts.perSecond}/${this.rateLimitConfig.requestsPerSecondLimit}`);
    console.log(`  Per minute: ${this.requestCounts.perMinute}/${this.rateLimitConfig.requestsPerMinuteLimit}`);
    console.log(`  Per hour: ${this.requestCounts.perHour}/${this.rateLimitConfig.requestsPerHourLimit}`);
    
    console.log('============================================\n');
  }

  // Reset statistics
  public resetStats(): void {
    this.stats = {
      requestsByType: {
        [RequestType.TRANSACTION]: 0,
        [RequestType.ACCOUNT]: 0,
        [RequestType.BLOCK]: 0,
        [RequestType.PROGRAM]: 0,
        [RequestType.MARKET]: 0,
        [RequestType.PRICE]: 0,
        [RequestType.METADATA]: 0
      },
      cacheHits: 0,
      cacheMisses: 0,
      batchedRequests: 0,
      individualRequests: 0,
      rateLimitDelays: 0,
      totalRequests: 0,
      startTime: Date.now()
    };
    
    console.log('RPC request optimizer statistics reset');
  }

  // Update configurations
  public updateConfig(
    newCacheConfig?: Partial<CacheConfig>,
    newBatchConfig?: Partial<BatchConfig>,
    newRateLimitConfig?: Partial<RateLimitConfig>
  ): void {
    if (newCacheConfig) {
      this.cacheConfig = { ...this.cacheConfig, ...newCacheConfig };
    }
    
    if (newBatchConfig) {
      this.batchConfig = { ...this.batchConfig, ...newBatchConfig };
    }
    
    if (newRateLimitConfig) {
      this.rateLimitConfig = { ...this.rateLimitConfig, ...newRateLimitConfig };
    }
    
    // Save updated configuration
    this.saveConfig();
    
    console.log('RPC request optimizer configuration updated');
  }

  // Clear cache
  public clearCache(): void {
    this.cache.clear();
    console.log('RPC request optimizer cache cleared');
  }

  // Get cache stats
  public getCacheStats(): { size: number; byType: Record<RequestType, number> } {
    const byType: Record<RequestType, number> = {
      [RequestType.TRANSACTION]: 0,
      [RequestType.ACCOUNT]: 0,
      [RequestType.BLOCK]: 0,
      [RequestType.PROGRAM]: 0,
      [RequestType.MARKET]: 0,
      [RequestType.PRICE]: 0,
      [RequestType.METADATA]: 0
    };
    
    for (const entry of this.cache.values()) {
      byType[entry.type]++;
    }
    
    return {
      size: this.cache.size,
      byType
    };
  }
}

// Export singleton instance
export const rpcOptimizer = new RpcRequestOptimizer();

// Export default
export default rpcOptimizer;