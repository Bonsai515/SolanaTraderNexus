/**
 * Enhanced RPC Manager
 * 
 * Advanced connection management for Solana RPC providers with:
 * - Intelligent load balancing
 * - Rate limit avoidance
 * - Automatic failover
 * - Request prioritization
 * - Advanced caching
 * - Batched requests optimization
 */

import { Connection, ConnectionConfig, PublicKey } from '@solana/web3.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Load environment variables
config();

// RPC Provider structure
interface RpcProvider {
  name: string;
  url: string;
  websocketUrl: string;
  weight: number;
  priority: number;
  maxRequestsPerSecond: number;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  status: 'healthy' | 'degraded' | 'down';
  requestsThisSecond: number;
  requestsThisMinute: number;
  requestsThisHour: number;
  lastStatusCheck: number;
  lastStatusReset: {
    second: number;
    minute: number;
    hour: number;
  };
  consecutiveFailures: number;
  responseTimeHistory: number[];
  averageResponseTime: number;
  apiKey?: string;
}

// Connection pool structure
interface ConnectionPool {
  [key: string]: Connection;
}

// Configuration structure
interface RpcManagerConfig {
  providers: RpcProvider[];
  loadBalancingStrategy: 'priority' | 'round-robin' | 'weighted' | 'adaptive';
  failoverThreshold: number;
  healthCheckIntervalMs: number;
  maxConsecutiveFailures: number;
  retryDelayMs: number;
  maxRetries: number;
  cacheTimeMs: number;
  logActivity: boolean;
  logFile: string;
  dataPersistenceFile: string;
  defaultBatchSize: number;
  maxBatchSize: number;
  useBatchRequests: boolean;
  useBulkProcessing: boolean;
  prioritizeSubscriptions: boolean;
  requestTimeoutMs: number;
  performanceMonitoring: boolean;
  performanceLogIntervalMs: number;
}

// Request cache
interface RequestCache {
  [key: string]: {
    data: any;
    timestamp: number;
  };
}

// Request Queue Entry
interface RequestQueueEntry {
  id: string;
  priority: 'high' | 'medium' | 'low';
  method: string;
  params: any[];
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  retries: number;
  isProcessing: boolean;
}

// RPC Manager Class
class EnhancedRpcManager {
  private config: RpcManagerConfig;
  private providers: RpcProvider[];
  private connectionPool: ConnectionPool = {};
  private currentProviderIndex: number = 0;
  private cache: RequestCache = {};
  private requestQueue: RequestQueueEntry[] = [];
  private isProcessingQueue: boolean = false;
  private requestIdCounter: number = 0;
  private heliusKey: string;
  private syndicaKey: string;
  private tritonKey: string;
  private isInitialized: boolean = false;
  private performanceMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
    totalLatency: 0,
    maxBatchSize: 0,
    batchRequestsIssued: 0,
    totalBatchedRequests: 0,
    lastMetricsReset: Date.now()
  };

  constructor() {
    // Initialize with default config
    this.config = this.getDefaultConfig();
    this.providers = this.config.providers;
    
    // Load API keys from environment variables
    this.heliusKey = process.env.HELIUS_API_KEY || '';
    this.syndicaKey = process.env.SYNDICA_API_KEY || '';
    this.tritonKey = process.env.TRITON_API_KEY || '';
    
    // Update provider URLs with API keys
    this.updateProviderUrls();
    
    // Create log directory if it doesn't exist
    const logDir = path.dirname(this.config.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Load persisted state if available
    this.loadPersistedState();
    
    // Start health checks
    setInterval(() => this.checkProvidersHealth(), this.config.healthCheckIntervalMs);
    
    // Start performance monitoring
    if (this.config.performanceMonitoring) {
      setInterval(() => this.logPerformanceMetrics(), this.config.performanceLogIntervalMs);
    }
    
    // Start request queue processor
    setInterval(() => this.processRequestQueue(), 50);
    
    this.log('Enhanced RPC Manager initialized');
    this.isInitialized = true;
  }

  // Default configuration
  private getDefaultConfig(): RpcManagerConfig {
    return {
      providers: [
        {
          name: 'Syndica',
          url: 'https://solana-api.syndica.io/access-token/...',
          websocketUrl: 'wss://solana-api.syndica.io/access-token/...',
          weight: 10,
          priority: 1,
          maxRequestsPerSecond: 50,
          maxRequestsPerMinute: 2000,
          maxRequestsPerHour: 100000,
          status: 'healthy',
          requestsThisSecond: 0,
          requestsThisMinute: 0,
          requestsThisHour: 0,
          lastStatusCheck: Date.now(),
          lastStatusReset: {
            second: Date.now(),
            minute: Date.now(),
            hour: Date.now()
          },
          consecutiveFailures: 0,
          responseTimeHistory: [],
          averageResponseTime: 0
        },
        {
          name: 'Helius',
          url: 'https://mainnet.helius-rpc.com/?api-key=...',
          websocketUrl: 'wss://mainnet.helius-rpc.com/?api-key=...',
          weight: 8,
          priority: 2,
          maxRequestsPerSecond: 40,
          maxRequestsPerMinute: 1500,
          maxRequestsPerHour: 70000,
          status: 'healthy',
          requestsThisSecond: 0,
          requestsThisMinute: 0,
          requestsThisHour: 0,
          lastStatusCheck: Date.now(),
          lastStatusReset: {
            second: Date.now(),
            minute: Date.now(),
            hour: Date.now()
          },
          consecutiveFailures: 0,
          responseTimeHistory: [],
          averageResponseTime: 0
        },
        {
          name: 'Triton',
          url: 'https://rpc.triton.one/v1/solanav?apikey=...',
          websocketUrl: 'wss://rpc.triton.one/v1/solanav?apikey=...',
          weight: 6,
          priority: 3,
          maxRequestsPerSecond: 30,
          maxRequestsPerMinute: 1000,
          maxRequestsPerHour: 50000,
          status: 'healthy',
          requestsThisSecond: 0,
          requestsThisMinute: 0,
          requestsThisHour: 0,
          lastStatusCheck: Date.now(),
          lastStatusReset: {
            second: Date.now(),
            minute: Date.now(),
            hour: Date.now()
          },
          consecutiveFailures: 0,
          responseTimeHistory: [],
          averageResponseTime: 0
        }
      ],
      loadBalancingStrategy: 'adaptive',
      failoverThreshold: 3,
      healthCheckIntervalMs: 15000, // 15 seconds
      maxConsecutiveFailures: 3,
      retryDelayMs: 500,
      maxRetries: 3,
      cacheTimeMs: 5000, // 5 seconds
      logActivity: true,
      logFile: 'logs/rpc-manager.log',
      dataPersistenceFile: 'data/rpc-state.json',
      defaultBatchSize: 100,
      maxBatchSize: 100,
      useBatchRequests: true,
      useBulkProcessing: true,
      prioritizeSubscriptions: true,
      requestTimeoutMs: 30000, // 30 seconds
      performanceMonitoring: true,
      performanceLogIntervalMs: 300000 // 5 minutes
    };
  }

  // Update provider URLs with API keys
  private updateProviderUrls(): void {
    for (const provider of this.providers) {
      switch (provider.name) {
        case 'Syndica':
          if (this.syndicaKey) {
            provider.url = `https://solana-api.syndica.io/access-token/${this.syndicaKey}`;
            provider.websocketUrl = `wss://solana-api.syndica.io/access-token/${this.syndicaKey}`;
          }
          break;
        case 'Helius':
          if (this.heliusKey) {
            provider.url = `https://mainnet.helius-rpc.com/?api-key=${this.heliusKey}`;
            provider.websocketUrl = `wss://mainnet.helius-rpc.com/?api-key=${this.heliusKey}`;
          }
          break;
        case 'Triton':
          if (this.tritonKey) {
            provider.url = `https://rpc.triton.one/v1/solanav?apikey=${this.tritonKey}`;
            provider.websocketUrl = `wss://rpc.triton.one/v1/solanav?apikey=${this.tritonKey}`;
          }
          break;
      }
    }
  }

  // Load custom configuration
  public loadConfig(configPath: string): void {
    try {
      if (fs.existsSync(configPath)) {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        this.config = { ...this.config, ...fileConfig };
        this.providers = this.config.providers;
        this.updateProviderUrls();
        this.log(`Loaded configuration from ${configPath}`);
      }
    } catch (error) {
      this.log(`Error loading configuration: ${error}`, 'ERROR');
    }
  }

  // Load persisted state
  private loadPersistedState(): void {
    try {
      if (fs.existsSync(this.config.dataPersistenceFile)) {
        const data = JSON.parse(fs.readFileSync(this.config.dataPersistenceFile, 'utf-8'));
        
        // Restore provider stats
        if (data.providers) {
          for (let i = 0; i < this.providers.length; i++) {
            const savedProvider = data.providers.find((p: any) => p.name === this.providers[i].name);
            if (savedProvider) {
              this.providers[i].status = savedProvider.status;
              this.providers[i].consecutiveFailures = savedProvider.consecutiveFailures;
              this.providers[i].responseTimeHistory = savedProvider.responseTimeHistory || [];
              this.providers[i].averageResponseTime = savedProvider.averageResponseTime || 0;
            }
          }
        }
        
        // Restore performance metrics
        if (data.performanceMetrics) {
          this.performanceMetrics = { ...this.performanceMetrics, ...data.performanceMetrics };
        }
        
        this.log('Loaded persisted state');
      }
    } catch (error) {
      this.log(`Error loading persisted state: ${error}`, 'ERROR');
    }
  }

  // Save persisted state
  private savePersistedState(): void {
    try {
      // Create data directory if it doesn't exist
      const dataDir = path.dirname(this.config.dataPersistenceFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const data = {
        providers: this.providers.map(p => ({
          name: p.name,
          status: p.status,
          consecutiveFailures: p.consecutiveFailures,
          responseTimeHistory: p.responseTimeHistory,
          averageResponseTime: p.averageResponseTime
        })),
        performanceMetrics: this.performanceMetrics
      };
      
      fs.writeFileSync(this.config.dataPersistenceFile, JSON.stringify(data, null, 2));
    } catch (error) {
      this.log(`Error saving persisted state: ${error}`, 'ERROR');
    }
  }

  // Log messages
  private log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
    if (!this.config.logActivity) {
      return;
    }
    
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} [${level}] ${message}`;
    
    console.log(logMessage);
    
    try {
      fs.appendFileSync(this.config.logFile, logMessage + '\n');
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }

  // Check providers health
  private async checkProvidersHealth(): Promise<void> {
    for (const provider of this.providers) {
      // Reset counters if needed
      this.resetCountersIfNeeded(provider);
      
      // Skip check if we're already over rate limits
      if (
        provider.requestsThisSecond >= provider.maxRequestsPerSecond ||
        provider.requestsThisMinute >= provider.maxRequestsPerMinute ||
        provider.requestsThisHour >= provider.maxRequestsPerHour
      ) {
        continue;
      }
      
      try {
        const now = Date.now();
        const connection = this.getConnectionForProvider(provider);
        
        // Check slot
        const startTime = Date.now();
        const slot = await connection.getSlot();
        const responseTime = Date.now() - startTime;
        
        // Update response time history (keep last 10)
        provider.responseTimeHistory.push(responseTime);
        if (provider.responseTimeHistory.length > 10) {
          provider.responseTimeHistory.shift();
        }
        
        // Calculate average response time
        provider.averageResponseTime = provider.responseTimeHistory.reduce((a, b) => a + b, 0) / provider.responseTimeHistory.length;
        
        // Update rate limit counters
        provider.requestsThisSecond += 1;
        provider.requestsThisMinute += 1;
        provider.requestsThisHour += 1;
        
        // Check if response time indicates degradation
        if (responseTime > 1000) {
          provider.status = 'degraded';
          this.log(`Provider ${provider.name} is degraded (response time: ${responseTime}ms)`, 'WARN');
        } else {
          provider.status = 'healthy';
          provider.consecutiveFailures = 0;
        }
        
        provider.lastStatusCheck = now;
      } catch (error) {
        provider.consecutiveFailures += 1;
        
        if (provider.consecutiveFailures >= this.config.maxConsecutiveFailures) {
          provider.status = 'down';
          this.log(`Provider ${provider.name} is down after ${provider.consecutiveFailures} consecutive failures`, 'ERROR');
        } else {
          provider.status = 'degraded';
          this.log(`Provider ${provider.name} is degraded (consecutive failures: ${provider.consecutiveFailures})`, 'WARN');
        }
      }
    }
    
    // Save state after health check
    this.savePersistedState();
  }

  // Reset rate limit counters if needed
  private resetCountersIfNeeded(provider: RpcProvider): void {
    const now = Date.now();
    
    // Reset second counter
    if (now - provider.lastStatusReset.second >= 1000) {
      provider.requestsThisSecond = 0;
      provider.lastStatusReset.second = now;
    }
    
    // Reset minute counter
    if (now - provider.lastStatusReset.minute >= 60000) {
      provider.requestsThisMinute = 0;
      provider.lastStatusReset.minute = now;
    }
    
    // Reset hour counter
    if (now - provider.lastStatusReset.hour >= 3600000) {
      provider.requestsThisHour = 0;
      provider.lastStatusReset.hour = now;
    }
  }

  // Get a connection for a specific provider
  private getConnectionForProvider(provider: RpcProvider): Connection {
    if (!this.connectionPool[provider.name]) {
      const connectionConfig: ConnectionConfig = {
        httpHeaders: { "Solana-Client": "TypeScript SDK" }
      };
      
      this.connectionPool[provider.name] = new Connection(provider.url, {
        commitment: 'confirmed',
        wsEndpoint: provider.websocketUrl,
        ...connectionConfig
      });
    }
    
    return this.connectionPool[provider.name];
  }

  // Get best provider based on strategy
  private getBestProvider(): RpcProvider {
    // Filter out down providers
    const availableProviders = this.providers.filter(p => p.status !== 'down');
    
    // If no providers available, reactivate the least bad one
    if (availableProviders.length === 0) {
      const leastBadProvider = this.providers.sort((a, b) => a.consecutiveFailures - b.consecutiveFailures)[0];
      leastBadProvider.status = 'degraded';
      leastBadProvider.consecutiveFailures = Math.max(0, leastBadProvider.consecutiveFailures - 1);
      this.log(`All providers down. Reactivating ${leastBadProvider.name} as degraded`, 'WARN');
      return leastBadProvider;
    }
    
    // Filter providers that are not over rate limits
    const providersWithCapacity = availableProviders.filter(
      p => p.requestsThisSecond < p.maxRequestsPerSecond &&
           p.requestsThisMinute < p.maxRequestsPerMinute &&
           p.requestsThisHour < p.maxRequestsPerHour
    );
    
    // If all available providers are over rate limits, use the one closest to reset
    if (providersWithCapacity.length === 0) {
      // Find provider closest to resetting its second counter
      return availableProviders.sort((a, b) => 
        (a.lastStatusReset.second + 1000 - Date.now()) - 
        (b.lastStatusReset.second + 1000 - Date.now())
      )[0];
    }
    
    // Apply the selected load balancing strategy
    switch (this.config.loadBalancingStrategy) {
      case 'priority':
        // Sort by priority (lowest number = highest priority)
        return providersWithCapacity.sort((a, b) => a.priority - b.priority)[0];
      
      case 'round-robin':
        // Advance the index and wrap around
        this.currentProviderIndex = (this.currentProviderIndex + 1) % providersWithCapacity.length;
        return providersWithCapacity[this.currentProviderIndex];
      
      case 'weighted':
        // Weighted random selection
        const totalWeight = providersWithCapacity.reduce((sum, p) => sum + p.weight, 0);
        let randomWeight = Math.random() * totalWeight;
        
        for (const provider of providersWithCapacity) {
          randomWeight -= provider.weight;
          if (randomWeight <= 0) {
            return provider;
          }
        }
        
        return providersWithCapacity[0];
      
      case 'adaptive':
      default:
        // Adaptive strategy: consider health, response time, and capacity
        return providersWithCapacity.sort((a, b) => {
          // Create a score based on multiple factors (lower is better)
          const aScore = (a.status === 'healthy' ? 0 : 100) +
                         a.averageResponseTime / 10 +
                         (a.requestsThisSecond / a.maxRequestsPerSecond) * 50 +
                         (a.priority * 10);
          
          const bScore = (b.status === 'healthy' ? 0 : 100) +
                         b.averageResponseTime / 10 +
                         (b.requestsThisSecond / b.maxRequestsPerSecond) * 50 +
                         (b.priority * 10);
          
          return aScore - bScore;
        })[0];
    }
  }

  // Generate cache key for a request
  private generateCacheKey(method: string, params: any[]): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  // Update rate limit counters for a provider
  private updateRateLimitCounters(provider: RpcProvider): void {
    this.resetCountersIfNeeded(provider);
    
    provider.requestsThisSecond += 1;
    provider.requestsThisMinute += 1;
    provider.requestsThisHour += 1;
  }

  // Main method to execute a Solana RPC request
  public async executeRequest<T>(method: string, params: any[] = [], options: {
    priority?: 'high' | 'medium' | 'low';
    bypassCache?: boolean;
    cacheTimeMs?: number;
    retries?: number;
  } = {}): Promise<T> {
    if (!this.isInitialized) {
      this.log('RPC Manager not fully initialized yet', 'WARN');
    }
    
    const {
      priority = 'medium',
      bypassCache = false,
      cacheTimeMs = this.config.cacheTimeMs,
      retries = this.config.maxRetries
    } = options;
    
    // Check cache unless bypassed
    if (!bypassCache) {
      const cacheKey = this.generateCacheKey(method, params);
      const cachedData = this.cache[cacheKey];
      
      if (cachedData && (Date.now() - cachedData.timestamp <= cacheTimeMs)) {
        this.performanceMetrics.totalRequests++;
        this.performanceMetrics.cacheHits++;
        return cachedData.data;
      } else {
        this.performanceMetrics.cacheMisses++;
      }
    }
    
    // Add to request queue
    return new Promise<T>((resolve, reject) => {
      const requestId = `${Date.now()}-${this.requestIdCounter++}`;
      
      this.requestQueue.push({
        id: requestId,
        priority,
        method,
        params,
        resolve,
        reject,
        timestamp: Date.now(),
        retries: 0,
        isProcessing: false
      });
      
      this.performanceMetrics.totalRequests++;
      
      // Start processing the queue if it's not already being processed
      if (!this.isProcessingQueue) {
        this.processRequestQueue();
      }
    });
  }

  // Process the request queue
  private async processRequestQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      // Sort queue by priority and timestamp
      this.requestQueue.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];
        
        // First by priority, then by timestamp
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        return a.timestamp - b.timestamp;
      });
      
      // Get the best provider
      const provider = this.getBestProvider();
      
      // Check if we have capacity
      if (
        provider.requestsThisSecond >= provider.maxRequestsPerSecond ||
        provider.requestsThisMinute >= provider.maxRequestsPerMinute ||
        provider.requestsThisHour >= provider.maxRequestsPerHour
      ) {
        // Wait for rate limit reset
        this.isProcessingQueue = false;
        return;
      }
      
      // Process requests in batches if enabled
      if (this.config.useBatchRequests && this.requestQueue.length > 1) {
        await this.processBatchRequests(provider);
      } else {
        // Process single request
        const request = this.requestQueue.shift();
        if (request && !request.isProcessing) {
          request.isProcessing = true;
          await this.processSingleRequest(request, provider);
        }
      }
    } catch (error) {
      this.log(`Error processing request queue: ${error}`, 'ERROR');
    } finally {
      this.isProcessingQueue = false;
      
      // If there are more requests, continue processing
      if (this.requestQueue.length > 0) {
        setTimeout(() => this.processRequestQueue(), 10);
      }
    }
  }

  // Process a single request
  private async processSingleRequest(request: RequestQueueEntry, provider: RpcProvider): Promise<void> {
    try {
      // Update rate limit counters
      this.updateRateLimitCounters(provider);
      
      const connection = this.getConnectionForProvider(provider);
      const startTime = Date.now();
      
      // Execute the request based on the method
      let result;
      
      switch (request.method) {
        case 'getSlot':
          result = await connection.getSlot();
          break;
        case 'getBalance':
          result = await connection.getBalance(request.params[0] as PublicKey);
          break;
        case 'getAccountInfo':
          result = await connection.getAccountInfo(request.params[0] as PublicKey);
          break;
        case 'getRecentBlockhash':
          result = await connection.getRecentBlockhash();
          break;
        // Add more methods as needed
        default:
          // Use a generic approach for other methods
          // @ts-ignore
          result = await connection[request.method](...request.params);
      }
      
      const responseTime = Date.now() - startTime;
      
      // Update response time history
      provider.responseTimeHistory.push(responseTime);
      if (provider.responseTimeHistory.length > 10) {
        provider.responseTimeHistory.shift();
      }
      
      // Calculate average response time
      provider.averageResponseTime = provider.responseTimeHistory.reduce((a, b) => a + b, 0) / provider.responseTimeHistory.length;
      
      // Reset consecutive failures on success
      provider.consecutiveFailures = 0;
      
      // Cache the result
      const cacheKey = this.generateCacheKey(request.method, request.params);
      this.cache[cacheKey] = {
        data: result,
        timestamp: Date.now()
      };
      
      // Update metrics
      this.performanceMetrics.successfulRequests++;
      this.performanceMetrics.totalLatency += responseTime;
      this.performanceMetrics.averageLatency = this.performanceMetrics.totalLatency / this.performanceMetrics.successfulRequests;
      
      // Resolve the promise
      request.resolve(result);
    } catch (error) {
      // Update failure count
      provider.consecutiveFailures += 1;
      this.performanceMetrics.failedRequests++;
      
      if (provider.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        provider.status = 'down';
        this.log(`Provider ${provider.name} marked as down after ${provider.consecutiveFailures} consecutive failures`, 'ERROR');
      }
      
      // Check if we should retry
      if (request.retries < this.config.maxRetries) {
        request.retries++;
        request.isProcessing = false;
        
        // Calculate retry delay with exponential backoff
        const retryDelay = this.config.retryDelayMs * Math.pow(2, request.retries - 1);
        
        this.log(`Retrying request ${request.id} (attempt ${request.retries}/${this.config.maxRetries}) after ${retryDelay}ms`, 'WARN');
        
        // Add back to queue with delay
        setTimeout(() => {
          this.requestQueue.push(request);
          if (!this.isProcessingQueue) {
            this.processRequestQueue();
          }
        }, retryDelay);
      } else {
        // Max retries reached, reject the promise
        this.log(`Request ${request.id} failed after ${request.retries} retries: ${error}`, 'ERROR');
        request.reject(error);
      }
    }
  }

  // Process requests in a batch
  private async processBatchRequests(provider: RpcProvider): Promise<void> {
    // Determine batch size (limited by provider's remaining capacity)
    const maxBatchSize = Math.min(
      this.config.maxBatchSize,
      provider.maxRequestsPerSecond - provider.requestsThisSecond,
      provider.maxRequestsPerMinute - provider.requestsThisMinute,
      provider.maxRequestsPerHour - provider.requestsThisHour
    );
    
    if (maxBatchSize <= 0) {
      // No capacity for batch requests
      this.isProcessingQueue = false;
      return;
    }
    
    // Take a batch of requests
    const batchSize = Math.min(maxBatchSize, this.requestQueue.length);
    const batch = this.requestQueue.splice(0, batchSize).map(request => {
      request.isProcessing = true;
      return request;
    });
    
    // Update metrics
    this.performanceMetrics.batchRequestsIssued++;
    this.performanceMetrics.totalBatchedRequests += batch.length;
    if (batch.length > this.performanceMetrics.maxBatchSize) {
      this.performanceMetrics.maxBatchSize = batch.length;
    }
    
    // In a real implementation, we would use the JSON-RPC batch processing capabilities
    // For this implementation, we'll process them in parallel
    try {
      // Update rate limit counters (count as a single request for rate limiting)
      this.updateRateLimitCounters(provider);
      
      // Process all requests in parallel
      const results = await Promise.allSettled(
        batch.map(request => this.processSingleRequest(request, provider))
      );
      
      // Process results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'rejected') {
          this.log(`Batch request ${i} failed: ${result.reason}`, 'ERROR');
        }
      }
      
      this.log(`Processed batch of ${batch.length} requests`);
    } catch (error) {
      this.log(`Error processing batch requests: ${error}`, 'ERROR');
    }
  }

  // Log performance metrics
  private logPerformanceMetrics(): void {
    const now = Date.now();
    const timeSinceLastReset = (now - this.performanceMetrics.lastMetricsReset) / 1000; // seconds
    
    this.log('\n===== RPC MANAGER PERFORMANCE METRICS =====');
    this.log(`Time period: ${(timeSinceLastReset / 60).toFixed(1)} minutes`);
    this.log(`Total requests: ${this.performanceMetrics.totalRequests}`);
    this.log(`Requests per second: ${(this.performanceMetrics.totalRequests / timeSinceLastReset).toFixed(2)}`);
    this.log(`Cache hit ratio: ${(this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests * 100).toFixed(1)}%`);
    this.log(`Success rate: ${(this.performanceMetrics.successfulRequests / this.performanceMetrics.totalRequests * 100).toFixed(1)}%`);
    this.log(`Average latency: ${this.performanceMetrics.averageLatency.toFixed(1)}ms`);
    this.log(`Batch requests: ${this.performanceMetrics.batchRequestsIssued}`);
    this.log(`Average batch size: ${(this.performanceMetrics.totalBatchedRequests / Math.max(1, this.performanceMetrics.batchRequestsIssued)).toFixed(1)}`);
    this.log(`Max batch size: ${this.performanceMetrics.maxBatchSize}`);
    
    // Provider stats
    this.log('\nProvider Status:');
    for (const provider of this.providers) {
      this.log(`${provider.name}: ${provider.status}, Response time: ${provider.averageResponseTime.toFixed(1)}ms, Failures: ${provider.consecutiveFailures}`);
      this.log(`  Requests this second/minute/hour: ${provider.requestsThisSecond}/${provider.requestsThisMinute}/${provider.requestsThisHour}`);
      this.log(`  Limits: ${provider.maxRequestsPerSecond}/${provider.maxRequestsPerMinute}/${provider.maxRequestsPerHour}`);
    }
    
    this.log('===========================================\n');
    
    // Save metrics
    this.savePersistedState();
  }

  // Reset performance metrics
  public resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      totalLatency: 0,
      maxBatchSize: 0,
      batchRequestsIssued: 0,
      totalBatchedRequests: 0,
      lastMetricsReset: Date.now()
    };
    
    this.log('Performance metrics reset');
  }

  // Public methods
  
  // Get a connection to the best provider
  public getConnection(): Connection {
    const provider = this.getBestProvider();
    return this.getConnectionForProvider(provider);
  }
  
  // Get name of active provider
  public getActiveProviderName(): string {
    return this.getBestProvider().name;
  }
  
  // Check if a provider is healthy
  public isProviderHealthy(providerName: string): boolean {
    const provider = this.providers.find(p => p.name === providerName);
    return provider ? provider.status === 'healthy' : false;
  }
  
  // Clear cache
  public clearCache(): void {
    this.cache = {};
    this.log('Cache cleared');
  }
  
  // Get cache stats
  public getCacheStats(): { size: number, hitRatio: number } {
    return {
      size: Object.keys(this.cache).length,
      hitRatio: this.performanceMetrics.totalRequests > 0 
        ? this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests 
        : 0
    };
  }
  
  // Get provider status
  public getProviderStatus(): any[] {
    return this.providers.map(p => ({
      name: p.name,
      status: p.status,
      averageResponseTime: p.averageResponseTime,
      consecutiveFailures: p.consecutiveFailures,
      requestsThisSecond: p.requestsThisSecond,
      requestsThisMinute: p.requestsThisMinute,
      requestsThisHour: p.requestsThisHour
    }));
  }
}

// Export singleton instance
export const rpcManager = new EnhancedRpcManager();

// Export for use in optimize-rpc-requests.ts
export default rpcManager;