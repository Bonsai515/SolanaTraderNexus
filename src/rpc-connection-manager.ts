/**
 * Enhanced RPC Connection Manager
 * 
 * This module provides an enhanced RPC connection manager with
 * load balancing, fallbacks, and rate limit handling.
 */

import { Connection, ConnectionConfig } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Types
interface RpcProvider {
  name: string;
  url: string;
  priority: number;
  rateLimit: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };
  healthCheckIntervalMs: number;
  timeoutMs: number;
  enabled: boolean;
}

interface RateLimitHandling {
  exponentialBackoff: boolean;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
  maxRetries: number;
  shuffleOnFailure: boolean;
}

interface LoadBalancing {
  enabled: boolean;
  method: string;
  weightByPriority: boolean;
  adaptiveWeighting: boolean;
  reserveCapacityPercent: number;
}

interface CircuitBreaker {
  enabled: boolean;
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenRequests: number;
}

interface RequestStrategy {
  batchingEnabled: boolean;
  maxBatchSize: number;
  cachingEnabled: boolean;
  cacheTTLMs: number;
  prioritizationEnabled: boolean;
  lowPriorityOperations: string[];
  highPriorityOperations: string[];
}

interface RpcConfig {
  version: string;
  mainProviders: RpcProvider[];
  fallbackProviders: RpcProvider[];
  rateLimitHandling: RateLimitHandling;
  loadBalancing: LoadBalancing;
  circuitBreaker: CircuitBreaker;
  requestStrategy: RequestStrategy;
}

interface ProviderStatus {
  name: string;
  url: string;
  priority: number;
  healthy: boolean;
  responseTimeMs: number;
  lastUsed: number;
  lastHealthCheck: number;
  failureCount: number;
  circuitOpen: boolean;
  requestCount: {
    total: number;
    lastSecond: number;
    lastMinute: number;
    success: number;
    failure: number;
  };
  enabled: boolean;
}

// RPC connection manager
class RpcConnectionManager {
  private config: RpcConfig;
  private providers: Map<string, ProviderStatus> = new Map();
  private connections: Map<string, Connection> = new Map();
  private lastRotation: number = Date.now();
  private rotationIntervalMs: number = 60000; // Rotate providers every minute
  private requestTimestamps: Map<string, number[]> = new Map();
  
  constructor() {
    this.config = this.loadConfig();
    this.initializeProviders();
    this.startHealthChecks();
  }
  
  /**
   * Load RPC configuration
   */
  private loadConfig(): RpcConfig {
    try {
      const configPath = path.join('./config/rpc', 'rpc-config.json');
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.error('Error loading RPC config:', error);
    }
    
    // Return default config if loading fails
    return {
      version: '1.0.0',
      mainProviders: [
        {
          name: 'Solana RPC',
          url: 'https://api.mainnet-beta.solana.com',
          priority: 1,
          rateLimit: {
            requestsPerSecond: 5,
            requestsPerMinute: 100
          },
          healthCheckIntervalMs: 60000,
          timeoutMs: 30000,
          enabled: true
        }
      ],
      fallbackProviders: [],
      rateLimitHandling: {
        exponentialBackoff: true,
        initialBackoffMs: 500,
        maxBackoffMs: 30000,
        backoffMultiplier: 2,
        maxRetries: 3,
        shuffleOnFailure: true
      },
      loadBalancing: {
        enabled: true,
        method: 'priority_based',
        weightByPriority: true,
        adaptiveWeighting: false,
        reserveCapacityPercent: 10
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 3,
        resetTimeoutMs: 60000,
        halfOpenRequests: 1
      },
      requestStrategy: {
        batchingEnabled: false,
        maxBatchSize: 5,
        cachingEnabled: false,
        cacheTTLMs: 1000,
        prioritizationEnabled: false,
        lowPriorityOperations: [],
        highPriorityOperations: []
      }
    };
  }
  
  /**
   * Initialize provider statuses
   */
  private initializeProviders(): void {
    // Initialize all providers
    const allProviders = [
      ...this.config.mainProviders,
      ...this.config.fallbackProviders
    ];
    
    for (const provider of allProviders) {
      if (provider.enabled) {
        this.providers.set(provider.name, {
          name: provider.name,
          url: provider.url,
          priority: provider.priority,
          healthy: true,
          responseTimeMs: 0,
          lastUsed: 0,
          lastHealthCheck: 0,
          failureCount: 0,
          circuitOpen: false,
          requestCount: {
            total: 0,
            lastSecond: 0,
            lastMinute: 0,
            success: 0,
            failure: 0
          },
          enabled: true
        });
        
        // Initialize request timestamps array
        this.requestTimestamps.set(provider.name, []);
        
        // Create connection
        this.createConnection(provider);
      }
    }
    
    console.log(`Initialized ${this.providers.size} RPC providers`);
  }
  
  /**
   * Create a connection for a provider
   */
  private createConnection(provider: RpcProvider): void {
    const connectionConfig: ConnectionConfig = {
      commitment: 'confirmed',
      disableRetryOnRateLimit: true,
      confirmTransactionInitialTimeout: provider.timeoutMs
    };
    
    const connection = new Connection(provider.url, connectionConfig);
    this.connections.set(provider.name, connection);
  }
  
  /**
   * Start health check intervals for all providers
   */
  private startHealthChecks(): void {
    // Check all providers initially
    this.checkAllProviders();
    
    // Set interval for regular health checks
    setInterval(() => {
      this.checkAllProviders();
    }, 30000); // Check every 30 seconds
    
    // Set interval for request count reset
    setInterval(() => {
      this.resetRequestCountsPerSecond();
    }, 1000); // Reset per-second counts every second
    
    setInterval(() => {
      this.resetRequestCountsPerMinute();
    }, 60000); // Reset per-minute counts every minute
    
    // Log provider status periodically
    setInterval(() => {
      this.logProviderStatus();
    }, 300000); // Log every 5 minutes
  }
  
  /**
   * Check health of all providers
   */
  private async checkAllProviders(): Promise<void> {
    const now = Date.now();
    
    for (const [name, status] of this.providers.entries()) {
      // Only check if the interval has elapsed since last check
      const provider = [...this.config.mainProviders, ...this.config.fallbackProviders]
        .find(p => p.name === name);
      
      if (!provider) continue;
      
      if (now - status.lastHealthCheck >= provider.healthCheckIntervalMs) {
        this.checkProviderHealth(name);
      }
      
      // Reset circuit breaker if reset timeout has elapsed
      if (status.circuitOpen && now - status.lastHealthCheck >= this.config.circuitBreaker.resetTimeoutMs) {
        status.circuitOpen = false;
        status.failureCount = 0;
        console.log(`Reset circuit breaker for provider: ${name}`);
      }
    }
  }
  
  /**
   * Check health of a specific provider
   */
  private async checkProviderHealth(providerName: string): Promise<void> {
    const status = this.providers.get(providerName);
    if (!status) return;
    
    const connection = this.connections.get(providerName);
    if (!connection) return;
    
    status.lastHealthCheck = Date.now();
    
    try {
      // Simple health check - get slot
      const startTime = Date.now();
      await connection.getSlot();
      const endTime = Date.now();
      
      // Update status
      status.healthy = true;
      status.responseTimeMs = endTime - startTime;
      
      // Reset failure count on success
      if (status.failureCount > 0) {
        status.failureCount = Math.max(0, status.failureCount - 1);
      }
      
      // If circuit was open, try half-open state
      if (status.circuitOpen) {
        console.log(`Provider ${providerName} health check succeeded while in circuit open state`);
        
        // Try half-open state
        if (status.failureCount === 0) {
          status.circuitOpen = false;
          console.log(`Closed circuit breaker for provider: ${providerName}`);
        }
      }
    } catch (error) {
      console.warn(`Health check failed for provider ${providerName}: ${error}`);
      
      // Update status
      status.healthy = false;
      status.failureCount++;
      
      // Apply circuit breaker pattern
      if (this.config.circuitBreaker.enabled && 
          status.failureCount >= this.config.circuitBreaker.failureThreshold) {
        status.circuitOpen = true;
        console.warn(`Opened circuit breaker for provider: ${providerName}`);
      }
    }
    
    // Update the provider status
    this.providers.set(providerName, status);
  }
  
  /**
   * Reset per-second request counts
   */
  private resetRequestCountsPerSecond(): void {
    for (const [name, status] of this.providers.entries()) {
      // Reset per-second count
      status.requestCount.lastSecond = 0;
      
      // Update the provider status
      this.providers.set(name, status);
      
      // Clean up old timestamps (older than 1 minute)
      const timestamps = this.requestTimestamps.get(name) || [];
      const now = Date.now();
      const newTimestamps = timestamps.filter(ts => now - ts < 60000);
      this.requestTimestamps.set(name, newTimestamps);
    }
  }
  
  /**
   * Reset per-minute request counts
   */
  private resetRequestCountsPerMinute(): void {
    for (const [name, status] of this.providers.entries()) {
      // Reset per-minute count
      status.requestCount.lastMinute = 0;
      
      // Update the provider status
      this.providers.set(name, status);
    }
  }
  
  /**
   * Update request count for a provider
   */
  private updateRequestCount(providerName: string, success: boolean): void {
    const status = this.providers.get(providerName);
    if (!status) return;
    
    // Update counts
    status.requestCount.total++;
    status.requestCount.lastSecond++;
    status.requestCount.lastMinute++;
    
    if (success) {
      status.requestCount.success++;
    } else {
      status.requestCount.failure++;
    }
    
    // Add timestamp to the array
    const timestamps = this.requestTimestamps.get(providerName) || [];
    timestamps.push(Date.now());
    this.requestTimestamps.set(providerName, timestamps);
    
    // Update the provider status
    this.providers.set(providerName, status);
  }
  
  /**
   * Get the best provider for a request
   */
  private getBestProvider(operationType: string = 'default'): string | null {
    // Check if it's time to rotate providers
    const now = Date.now();
    if (now - this.lastRotation >= this.rotationIntervalMs) {
      this.lastRotation = now;
    }
    
    // Get enabled, healthy, and not circuit-open providers
    const availableProviders: ProviderStatus[] = [];
    
    // First check main providers
    for (const mainProvider of this.config.mainProviders) {
      const status = this.providers.get(mainProvider.name);
      if (status && status.enabled && status.healthy && !status.circuitOpen) {
        availableProviders.push(status);
      }
    }
    
    // If no main providers are available, check fallback providers
    if (availableProviders.length === 0) {
      for (const fallbackProvider of this.config.fallbackProviders) {
        const status = this.providers.get(fallbackProvider.name);
        if (status && status.enabled && status.healthy && !status.circuitOpen) {
          availableProviders.push(status);
        }
      }
    }
    
    if (availableProviders.length === 0) {
      // No available providers
      console.warn('No available RPC providers found!');
      
      // Try to find any enabled provider even if unhealthy or circuit open
      for (const [name, status] of this.providers.entries()) {
        if (status.enabled) {
          console.warn(`Using potentially unhealthy provider: ${name}`);
          return name;
        }
      }
      
      return null;
    }
    
    // Choose provider based on load balancing method
    if (!this.config.loadBalancing.enabled) {
      // Just return the highest priority provider
      return availableProviders.sort((a, b) => a.priority - b.priority)[0].name;
    }
    
    // Check if this is a high priority operation
    const isHighPriority = this.config.requestStrategy.highPriorityOperations.includes(operationType);
    
    // Check if this is a low priority operation
    const isLowPriority = this.config.requestStrategy.lowPriorityOperations.includes(operationType);
    
    switch (this.config.loadBalancing.method) {
      case 'round_robin':
        // Find the provider that was used the longest time ago
        return availableProviders.sort((a, b) => a.lastUsed - b.lastUsed)[0].name;
      
      case 'weighted_round_robin':
        // Filter providers based on rate limits
        const filteredProviders = availableProviders.filter(provider => {
          // Find the full provider config
          const fullProvider = [...this.config.mainProviders, ...this.config.fallbackProviders]
            .find(p => p.name === provider.name);
          
          if (!fullProvider) return false;
          
          // Check if provider is approaching rate limits
          if (provider.requestCount.lastSecond >= fullProvider.rateLimit.requestsPerSecond) {
            return false; // Exclude if reached per-second limit
          }
          
          if (provider.requestCount.lastMinute >= fullProvider.rateLimit.requestsPerMinute) {
            return false; // Exclude if reached per-minute limit
          }
          
          // For high priority operations, only exclude if absolutely at the limit
          if (isHighPriority) {
            return true;
          }
          
          // For low priority operations, be more conservative
          if (isLowPriority) {
            const secondThreshold = fullProvider.rateLimit.requestsPerSecond * 0.5;
            const minuteThreshold = fullProvider.rateLimit.requestsPerMinute * 0.5;
            
            return provider.requestCount.lastSecond < secondThreshold && 
                   provider.requestCount.lastMinute < minuteThreshold;
          }
          
          // For normal operations, use the reserve capacity setting
          const reservePercent = this.config.loadBalancing.reserveCapacityPercent / 100;
          const secondThreshold = fullProvider.rateLimit.requestsPerSecond * (1 - reservePercent);
          const minuteThreshold = fullProvider.rateLimit.requestsPerMinute * (1 - reservePercent);
          
          return provider.requestCount.lastSecond < secondThreshold && 
                 provider.requestCount.lastMinute < minuteThreshold;
        });
        
        if (filteredProviders.length === 0) {
          // If no providers pass the filter, use any available provider for high priority
          if (isHighPriority) {
            console.warn('No providers within rate limits, using any available for high priority operation');
            return availableProviders[0].name;
          }
          
          console.warn('No providers within rate limits');
          return null;
        }
        
        // Sort by priority and response time
        return filteredProviders.sort((a, b) => {
          if (this.config.loadBalancing.weightByPriority) {
            // Lower priority number = higher priority
            if (a.priority !== b.priority) {
              return a.priority - b.priority;
            }
          }
          
          // If priorities are the same or not weighting by priority,
          // choose the faster one
          return a.responseTimeMs - b.responseTimeMs;
        })[0].name;
      
      case 'priority_based':
      default:
        // Return the highest priority available provider
        return availableProviders.sort((a, b) => a.priority - b.priority)[0].name;
    }
  }
  
  /**
   * Log current provider status
   */
  private logProviderStatus(): void {
    console.log('===== RPC PROVIDER STATUS =====');
    
    for (const [name, status] of this.providers.entries()) {
      console.log(`Provider: ${name}`);
      console.log(`  URL: ${status.url}`);
      console.log(`  Priority: ${status.priority}`);
      console.log(`  Healthy: ${status.healthy}`);
      console.log(`  Response Time: ${status.responseTimeMs}ms`);
      console.log(`  Last Used: ${new Date(status.lastUsed).toISOString()}`);
      console.log(`  Circuit Breaker: ${status.circuitOpen ? 'OPEN' : 'CLOSED'}`);
      console.log(`  Request Count: ${status.requestCount.total} total, ${status.requestCount.lastSecond}/s, ${status.requestCount.lastMinute}/min`);
      console.log(`  Success/Failure: ${status.requestCount.success} / ${status.requestCount.failure}`);
      console.log('----------------------------');
    }
    
    console.log('================================');
  }
  
  /**
   * Get a Solana Connection for a specific operation
   */
  public getConnection(operationType: string = 'default'): Connection {
    const providerName = this.getBestProvider(operationType);
    
    if (!providerName) {
      // Fallback to default connection if no provider is available
      console.warn('No provider available, using default Solana RPC');
      return new Connection('https://api.mainnet-beta.solana.com');
    }
    
    const connection = this.connections.get(providerName);
    if (!connection) {
      console.warn(`Connection not found for provider ${providerName}, using default Solana RPC`);
      return new Connection('https://api.mainnet-beta.solana.com');
    }
    
    // Update provider stats
    const status = this.providers.get(providerName);
    if (status) {
      status.lastUsed = Date.now();
      this.providers.set(providerName, status);
    }
    
    // Log the provider being used for this operation
    console.log(`Using RPC provider: ${providerName} for operation: ${operationType}`);
    
    return connection;
  }
  
  /**
   * Report success for a provider
   */
  public reportSuccess(providerName: string): void {
    const status = this.providers.get(providerName);
    if (!status) return;
    
    this.updateRequestCount(providerName, true);
  }
  
  /**
   * Report failure for a provider
   */
  public reportFailure(providerName: string, error: any): void {
    const status = this.providers.get(providerName);
    if (!status) return;
    
    this.updateRequestCount(providerName, false);
    
    // Increment failure count
    status.failureCount++;
    
    // Apply circuit breaker pattern
    if (this.config.circuitBreaker.enabled && 
        status.failureCount >= this.config.circuitBreaker.failureThreshold) {
      status.circuitOpen = true;
      console.warn(`Opened circuit breaker for provider: ${providerName} due to failures`);
    }
    
    // Update the provider status
    this.providers.set(providerName, status);
    
    // Log the error
    console.error(`RPC provider ${providerName} error: ${error}`);
  }
  
  /**
   * Get the best connection with retries and fallbacks
   */
  public async getConnectionWithRetries(operationType: string = 'default'): Promise<Connection> {
    let retries = 0;
    const maxRetries = this.config.rateLimitHandling.maxRetries;
    let backoffMs = this.config.rateLimitHandling.initialBackoffMs;
    
    while (retries <= maxRetries) {
      const providerName = this.getBestProvider(operationType);
      
      if (!providerName) {
        // No provider available, wait and retry
        console.warn(`No provider available, retrying in ${backoffMs}ms (attempt ${retries + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        backoffMs = Math.min(backoffMs * this.config.rateLimitHandling.backoffMultiplier, 
                            this.config.rateLimitHandling.maxBackoffMs);
        retries++;
        continue;
      }
      
      const connection = this.connections.get(providerName);
      if (!connection) {
        // Connection not found, retry with next provider
        console.warn(`Connection not found for provider ${providerName}`);
        retries++;
        continue;
      }
      
      // Update provider stats
      const status = this.providers.get(providerName);
      if (status) {
        status.lastUsed = Date.now();
        this.providers.set(providerName, status);
      }
      
      return connection;
    }
    
    // If all retries fail, return default connection
    console.error('All retries failed, using default Solana RPC');
    return new Connection('https://api.mainnet-beta.solana.com');
  }
  
  /**
   * Get all active connections
   */
  public getAllConnections(): Record<string, Connection> {
    const result: Record<string, Connection> = {};
    
    for (const [name, connection] of this.connections.entries()) {
      const status = this.providers.get(name);
      if (status && status.enabled && status.healthy && !status.circuitOpen) {
        result[name] = connection;
      }
    }
    
    return result;
  }
  
  /**
   * Enable a specific provider
   */
  public enableProvider(providerName: string): boolean {
    const status = this.providers.get(providerName);
    if (!status) return false;
    
    status.enabled = true;
    this.providers.set(providerName, status);
    console.log(`Enabled provider: ${providerName}`);
    return true;
  }
  
  /**
   * Disable a specific provider
   */
  public disableProvider(providerName: string): boolean {
    const status = this.providers.get(providerName);
    if (!status) return false;
    
    status.enabled = false;
    this.providers.set(providerName, status);
    console.log(`Disabled provider: ${providerName}`);
    return true;
  }
}

// Export singleton instance
export const rpcManager = new RpcConnectionManager();

// Example usage:
// 
// import { rpcManager } from './rpc-connection-manager';
// 
// // Get a connection for default operations
// const connection = rpcManager.getConnection();
// 
// // Get a connection for a specific operation type
// const sendTxConnection = rpcManager.getConnection('sendTransaction');
// 
// // Get a connection with retries and fallbacks
// const reliableConnection = await rpcManager.getConnectionWithRetries('getBalance');
