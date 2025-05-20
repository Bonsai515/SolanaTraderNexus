/**
 * Enhanced RPC Manager
 * 
 * Intelligent RPC connection management with automatic fallback
 * between Syndica, Helius, and Alchemy.
 */

import { Connection, ConnectionConfig } from '@solana/web3.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// RPC URLs
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '5d0d1d98-4695-4a7d-b8a0-d4f9836da17f';
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// RPC configuration
const RPC_CONFIG = {
  syndica: {
    name: 'Syndica',
    url: SYNDICA_API_KEY ? `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}` : null,
    priority: 1,
    rateLimitPerSecond: 50,
    timeoutMs: 30000,
    maxRetries: 3,
    enabled: !!SYNDICA_API_KEY,
    errorCount: 0,
    lastErrorTime: 0,
    consecutiveErrors: 0,
    backoffDurationMs: 0,
    isRateLimited: false,
    rateLimitEndTime: 0
  },
  helius: {
    name: 'Helius',
    url: `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
    priority: 2,
    rateLimitPerSecond: 40,
    timeoutMs: 30000,
    maxRetries: 3,
    enabled: true,
    errorCount: 0,
    lastErrorTime: 0,
    consecutiveErrors: 0,
    backoffDurationMs: 0,
    isRateLimited: false,
    rateLimitEndTime: 0
  },
  alchemy: {
    name: 'Alchemy',
    url: ALCHEMY_API_KEY ? `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : null,
    priority: 3,
    rateLimitPerSecond: 30,
    timeoutMs: 30000,
    maxRetries: 3,
    enabled: !!ALCHEMY_API_KEY,
    errorCount: 0,
    lastErrorTime: 0,
    consecutiveErrors: 0,
    backoffDurationMs: 0,
    isRateLimited: false,
    rateLimitEndTime: 0
  },
  public: {
    name: 'Solana Public RPC',
    url: 'https://api.mainnet-beta.solana.com',
    priority: 4,
    rateLimitPerSecond: 10,
    timeoutMs: 60000,
    maxRetries: 2,
    enabled: true,
    errorCount: 0,
    lastErrorTime: 0,
    consecutiveErrors: 0,
    backoffDurationMs: 0,
    isRateLimited: false,
    rateLimitEndTime: 0
  }
};

// Cache configuration
const CACHE_CONFIG = {
  enabled: true,
  maxSize: 1000,
  ttlMs: 10000, // 10 seconds TTL
  pruneIntervalMs: 60000 // 1 minute
};

// RPC connection cache
interface CacheItem {
  connection: Connection;
  expiresAt: number;
}

// Class for Enhanced RPC Management
class EnhancedRpcManager {
  private connections: Map<string, CacheItem> = new Map();
  private defaultProvider: string = 'helius';
  private lastProviderSwitch: number = 0;
  private minProviderSwitchIntervalMs: number = 5000; // 5 seconds
  private useCache: boolean = CACHE_CONFIG.enabled;
  private cacheTtlMs: number = CACHE_CONFIG.ttlMs;
  private maxCacheSize: number = CACHE_CONFIG.maxSize;
  private logger: (message: string, level?: string) => void;
  
  constructor() {
    this.logger = this.createLogger();
    
    // Initialize connection cache
    this.pruneCache();
    
    // Set default provider based on available APIs
    if (RPC_CONFIG.syndica.enabled) {
      this.defaultProvider = 'syndica';
    } else if (RPC_CONFIG.helius.enabled) {
      this.defaultProvider = 'helius';
    } else if (RPC_CONFIG.alchemy.enabled) {
      this.defaultProvider = 'alchemy';
    } else {
      this.defaultProvider = 'public';
    }
    
    this.logger(`Enhanced RPC Manager initialized with default provider: ${this.defaultProvider}`);
  }
  
  /**
   * Create a logger function
   */
  private createLogger(): (message: string, level?: string) => void {
    return (message: string, level: string = 'INFO') => {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp} [${level}] [EnhancedRPC] ${message}`);
    };
  }
  
  /**
   * Get the best available RPC provider
   */
  private getBestProvider(): string {
    const now = Date.now();
    
    // Filter out rate limited or error providers
    const availableProviders = Object.entries(RPC_CONFIG)
      .filter(([_, config]) => config.enabled && 
                              config.url && 
                              (!config.isRateLimited || now > config.rateLimitEndTime) &&
                              config.consecutiveErrors < config.maxRetries)
      .sort(([_, a], [__, b]) => a.priority - b.priority);
    
    if (availableProviders.length === 0) {
      this.logger('No RPC providers available! Falling back to public RPC', 'WARN');
      return 'public';
    }
    
    return availableProviders[0][0];
  }
  
  /**
   * Mark a provider as rate limited
   */
  private markProviderRateLimited(provider: string, durationMs: number = 30000): void {
    const config = RPC_CONFIG[provider];
    if (!config) return;
    
    config.isRateLimited = true;
    config.rateLimitEndTime = Date.now() + durationMs;
    this.logger(`Provider ${provider} marked as rate limited for ${durationMs}ms`, 'WARN');
  }
  
  /**
   * Mark a provider error
   */
  private markProviderError(provider: string): void {
    const config = RPC_CONFIG[provider];
    if (!config) return;
    
    const now = Date.now();
    
    // If the last error was more than 10 minutes ago, reset consecutive errors
    if (now - config.lastErrorTime > 600000) {
      config.consecutiveErrors = 0;
    }
    
    config.errorCount++;
    config.consecutiveErrors++;
    config.lastErrorTime = now;
    
    // Apply exponential backoff for consecutive errors
    config.backoffDurationMs = Math.min(30000, Math.pow(2, config.consecutiveErrors) * 1000);
    
    this.logger(`Provider ${provider} error #${config.errorCount} (consecutive: ${config.consecutiveErrors})`, 'ERROR');
  }
  
  /**
   * Reset provider errors
   */
  private resetProviderErrors(provider: string): void {
    const config = RPC_CONFIG[provider];
    if (!config) return;
    
    config.consecutiveErrors = 0;
    config.backoffDurationMs = 0;
  }
  
  /**
   * Prune expired items from the connection cache
   */
  private pruneCache(): void {
    const now = Date.now();
    
    // Remove expired items
    for (const [key, item] of this.connections.entries()) {
      if (now > item.expiresAt) {
        this.connections.delete(key);
      }
    }
    
    // Schedule next pruning
    setTimeout(() => this.pruneCache(), CACHE_CONFIG.pruneIntervalMs);
  }
  
  /**
   * Get a connection to the Solana blockchain
   */
  public getConnection(commitment: string = 'confirmed', forceProvider?: string): Connection {
    // Determine which provider to use
    const provider = forceProvider || this.getBestProvider();
    const cacheKey = `${provider}-${commitment}`;
    
    // Check if we have a cached connection
    if (this.useCache && this.connections.has(cacheKey)) {
      const cachedItem = this.connections.get(cacheKey);
      if (cachedItem && cachedItem.expiresAt > Date.now()) {
        return cachedItem.connection;
      }
    }
    
    // Get provider config
    const config = RPC_CONFIG[provider];
    if (!config || !config.url) {
      this.logger(`Provider ${provider} not configured, falling back to public RPC`, 'WARN');
      return this.getConnection(commitment, 'public');
    }
    
    // Create connection configuration
    const connectionConfig: ConnectionConfig = {
      commitment: commitment as any,
      confirmTransactionInitialTimeout: config.timeoutMs,
      disableRetryOnRateLimit: false
    };
    
    // Create connection
    const connection = new Connection(config.url, connectionConfig);
    
    // Cache the connection
    if (this.useCache) {
      // Ensure cache doesn't grow too large
      if (this.connections.size >= this.maxCacheSize) {
        // Remove oldest item
        const oldestKey = this.connections.keys().next().value;
        this.connections.delete(oldestKey);
      }
      
      this.connections.set(cacheKey, {
        connection,
        expiresAt: Date.now() + this.cacheTtlMs
      });
    }
    
    this.logger(`Created new connection to ${config.name}`);
    return connection;
  }
  
  /**
   * Get a connection with fallback capability
   */
  public getFallbackConnection(commitment: string = 'confirmed'): Connection {
    return this.getConnection(commitment);
  }
  
  /**
   * Handle RPC request error
   */
  public handleRequestError(error: any, provider: string): void {
    // Check for rate limiting errors
    if (error.message && (
        error.message.includes('429') || 
        error.message.includes('Too Many Requests') ||
        error.message.includes('exceeded') ||
        error.message.includes('rate limit')
      )) {
      this.markProviderRateLimited(provider);
    } else {
      this.markProviderError(provider);
    }
  }
  
  /**
   * Execute a request with automatic fallback
   */
  public async executeWithFallback<T>(
    requestFn: (connection: Connection) => Promise<T>,
    commitment: string = 'confirmed'
  ): Promise<T> {
    // Get the list of providers in priority order
    const providers = Object.keys(RPC_CONFIG)
      .filter(key => RPC_CONFIG[key].enabled && RPC_CONFIG[key].url)
      .sort((a, b) => RPC_CONFIG[a].priority - RPC_CONFIG[b].priority);
    
    // Try each provider in sequence
    for (const provider of providers) {
      try {
        const connection = this.getConnection(commitment, provider);
        const result = await requestFn(connection);
        
        // Reset errors on success
        this.resetProviderErrors(provider);
        
        return result;
      } catch (error) {
        this.handleRequestError(error, provider);
        this.logger(`Request failed on ${provider}, trying next provider...`, 'WARN');
        
        // If this is the last provider, rethrow the error
        if (provider === providers[providers.length - 1]) {
          throw error;
        }
      }
    }
    
    throw new Error('All RPC providers failed');
  }
  
  /**
   * Test all RPC connections
   */
  public async testConnections(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [provider, config] of Object.entries(RPC_CONFIG)) {
      if (!config.enabled || !config.url) {
        results[provider] = false;
        continue;
      }
      
      try {
        const connection = this.getConnection('confirmed', provider);
        const slot = await connection.getSlot();
        results[provider] = true;
        this.logger(`Successfully tested ${config.name}: current slot ${slot}`);
      } catch (error) {
        results[provider] = false;
        this.logger(`Failed to test ${config.name}: ${error.message}`, 'ERROR');
      }
    }
    
    return results;
  }
  
  /**
   * Get RPC status
   */
  public getStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [provider, config] of Object.entries(RPC_CONFIG)) {
      status[provider] = {
        name: config.name,
        enabled: config.enabled,
        priority: config.priority,
        errorCount: config.errorCount,
        consecutiveErrors: config.consecutiveErrors,
        isRateLimited: config.isRateLimited,
        rateLimitEndTime: config.rateLimitEndTime
      };
    }
    
    return status;
  }
}

// Singleton instance
const rpcManager = new EnhancedRpcManager();

export default rpcManager;