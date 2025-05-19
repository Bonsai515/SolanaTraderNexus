/**
 * Enhanced RPC Manager
 * 
 * This module manages connections to multiple RPC providers with optimal
 * fallback, load balancing, and performance monitoring.
 */

import { Connection, ConnectionConfig, Commitment } from '@solana/web3.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// RPC Provider Configuration
interface RpcProvider {
  name: string;
  url: string;
  apiKey?: string;
  priority: number;  // Lower number = higher priority
  headerAuth?: boolean;
  headerName?: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  reliability: number;
  usageCount: number;
  rateLimited: boolean;
  lastRateLimitTime: number;
  cooldownMs: number;
  connection?: Connection;
}

// Initialize providers from environment variables
const RPC_PROVIDERS: RpcProvider[] = [
  // Syndica (primary provider)
  {
    name: 'Syndica',
    url: 'https://solana-api.syndica.io/rpc',
    apiKey: process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk',
    priority: 1,
    headerAuth: true,
    headerName: 'X-API-Key',
    status: 'healthy',
    latency: 0,
    reliability: 0.99,
    usageCount: 0,
    rateLimited: false,
    lastRateLimitTime: 0,
    cooldownMs: 5000
  },
  
  // Chainstream (new)
  {
    name: 'Chainstream',
    url: process.env.CHAINSTREAM_RPC_URL || 'https://solana.chainstream.com/rpc',
    apiKey: process.env.CHAINSTREAM_API_KEY,
    priority: 2,
    headerAuth: true,
    headerName: 'X-API-Key',
    status: 'healthy',
    latency: 0,
    reliability: 0.98,
    usageCount: 0,
    rateLimited: false,
    lastRateLimitTime: 0,
    cooldownMs: 4000
  },
  
  // Helius (backup)
  {
    name: 'Helius',
    url: process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
    priority: 3,
    status: 'healthy',
    latency: 0,
    reliability: 0.97,
    usageCount: 0,
    rateLimited: false,
    lastRateLimitTime: 0,
    cooldownMs: 3000
  },
  
  // Alchemy (backup)
  {
    name: 'Alchemy',
    url: process.env.ALCHEMY_RPC_URL || `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    priority: 4,
    status: 'healthy',
    latency: 0,
    reliability: 0.96,
    usageCount: 0,
    rateLimited: false,
    lastRateLimitTime: 0,
    cooldownMs: 3000
  }
];

class EnhancedRpcManager {
  private providers: RpcProvider[];
  private currentProviderIndex: number = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private rateLimitCooldowns: Map<string, number> = new Map();
  private requestLog: Array<{timestamp: number, provider: string, success: boolean}> = [];
  
  constructor() {
    this.providers = [...RPC_PROVIDERS];
    // Sort by priority
    this.providers.sort((a, b) => a.priority - b.priority);
    this.initConnections();
  }
  
  /**
   * Initialize connections for all providers
   */
  private initConnections(): void {
    console.log('Initializing RPC connections...');
    
    this.providers.forEach(provider => {
      try {
        // Create connection config
        const config: ConnectionConfig = {
          commitment: 'confirmed',
          disableRetryOnRateLimit: false,
          confirmTransactionInitialTimeout: 60000,
        };
        
        // Add header auth if needed
        if (provider.headerAuth && provider.apiKey && provider.headerName) {
          config.httpHeaders = {
            [provider.headerName]: provider.apiKey
          };
        }
        
        // Create connection
        provider.connection = new Connection(provider.url, config);
        console.log(`✅ Initialized ${provider.name} RPC connection`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${provider.name} RPC connection:`, error);
        provider.status = 'down';
      }
    });
  }
  
  /**
   * Start health checks for all providers
   */
  public startHealthChecks(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(() => this.checkAllProviders(), intervalMs);
    console.log(`Started RPC provider health checks every ${intervalMs}ms`);
    
    // Run an immediate health check
    this.checkAllProviders();
  }
  
  /**
   * Check health of all providers
   */
  private async checkAllProviders(): Promise<void> {
    console.log('Running health check on all RPC providers...');
    
    for (const provider of this.providers) {
      try {
        const startTime = Date.now();
        const connection = provider.connection;
        
        if (!connection) {
          provider.status = 'down';
          continue;
        }
        
        // Get current block height as health check
        const blockHeight = await connection.getBlockHeight();
        
        // Calculate latency
        const endTime = Date.now();
        provider.latency = endTime - startTime;
        
        // Update status
        provider.status = provider.latency < 500 ? 'healthy' : 'degraded';
        
        console.log(`✅ ${provider.name} health check: ${provider.status} (${provider.latency}ms) - Block height: ${blockHeight}`);
      } catch (error) {
        console.error(`❌ ${provider.name} health check failed:`, error);
        provider.status = 'down';
      }
    }
    
    // Re-sort providers by status then priority
    this.providers.sort((a, b) => {
      if (a.status === 'healthy' && b.status !== 'healthy') return -1;
      if (a.status !== 'healthy' && b.status === 'healthy') return 1;
      return a.priority - b.priority;
    });
    
    // Reset current provider to the healthiest one
    this.currentProviderIndex = 0;
  }
  
  /**
   * Get the best available connection
   */
  public getBestConnection(): Connection {
    // Check if current provider is rate limited
    const currentProvider = this.providers[this.currentProviderIndex];
    
    if (currentProvider.rateLimited) {
      const now = Date.now();
      if (now - currentProvider.lastRateLimitTime > currentProvider.cooldownMs) {
        // Reset rate limit status after cooldown
        currentProvider.rateLimited = false;
      } else {
        // Find next non-rate-limited provider
        const nextProviderIndex = this.providers.findIndex(
          (provider, index) => !provider.rateLimited && provider.status !== 'down' && index !== this.currentProviderIndex
        );
        
        if (nextProviderIndex !== -1) {
          this.currentProviderIndex = nextProviderIndex;
          console.log(`Switched to ${this.providers[this.currentProviderIndex].name} due to rate limiting`);
        }
      }
    }
    
    // Increment usage count
    this.providers[this.currentProviderIndex].usageCount++;
    
    // Return the best connection
    return this.providers[this.currentProviderIndex].connection!;
  }
  
  /**
   * Report a rate limit for the current provider
   */
  public reportRateLimit(providerName: string): void {
    const providerIndex = this.providers.findIndex(p => p.name === providerName);
    
    if (providerIndex !== -1) {
      const provider = this.providers[providerIndex];
      provider.rateLimited = true;
      provider.lastRateLimitTime = Date.now();
      
      console.log(`⚠️ ${provider.name} is rate limited, cooling down for ${provider.cooldownMs}ms`);
      
      // Switch to next best provider
      this.switchToNextProvider();
    }
  }
  
  /**
   * Switch to the next best provider
   */
  private switchToNextProvider(): void {
    // Find the next healthy, non-rate-limited provider
    for (let i = 0; i < this.providers.length; i++) {
      const nextIndex = (this.currentProviderIndex + i + 1) % this.providers.length;
      const nextProvider = this.providers[nextIndex];
      
      if (nextProvider.status !== 'down' && !nextProvider.rateLimited) {
        this.currentProviderIndex = nextIndex;
        console.log(`Switched to ${nextProvider.name} as fallback RPC provider`);
        return;
      }
    }
    
    // If all providers are down or rate limited, use the one with highest reliability
    this.providers.sort((a, b) => b.reliability - a.reliability);
    this.currentProviderIndex = 0;
    console.log(`All providers are problematic, using ${this.providers[0].name} as best option`);
  }
  
  /**
   * Log RPC request results for analytics
   */
  public logRequest(providerName: string, success: boolean): void {
    this.requestLog.push({
      timestamp: Date.now(),
      provider: providerName,
      success
    });
    
    // Keep only the last 1000 requests
    if (this.requestLog.length > 1000) {
      this.requestLog.shift();
    }
    
    // Update reliability metrics
    const provider = this.providers.find(p => p.name === providerName);
    if (provider) {
      // Calculate reliability based on last 100 requests
      const providerLogs = this.requestLog.filter(log => log.provider === providerName);
      const lastHundred = providerLogs.slice(-100);
      
      if (lastHundred.length > 10) {
        const successCount = lastHundred.filter(log => log.success).length;
        provider.reliability = successCount / lastHundred.length;
      }
    }
  }
  
  /**
   * Get statistics and status of all providers
   */
  public getProviderStats(): any {
    return this.providers.map(provider => ({
      name: provider.name,
      status: provider.status,
      latency: provider.latency,
      reliability: provider.reliability,
      usageCount: provider.usageCount,
      rateLimited: provider.rateLimited,
      priority: provider.priority
    }));
  }
  
  /**
   * Save provider stats to a log file
   */
  public saveStatsToLog(): void {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const stats = {
        timestamp: new Date().toISOString(),
        providers: this.getProviderStats(),
        currentProvider: this.providers[this.currentProviderIndex].name
      };
      
      const logPath = path.join(logDir, 'rpc-stats.json');
      fs.writeFileSync(logPath, JSON.stringify(stats, null, 2));
    } catch (error) {
      console.error('Error saving RPC stats:', error);
    }
  }
}

// Create singleton instance
export const rpcManager = new EnhancedRpcManager();

// Start health checks
rpcManager.startHealthChecks(30000);

/**
 * Get the best available connection
 */
export function getOptimalConnection(): Connection {
  return rpcManager.getBestConnection();
}

/**
 * Report a rate limit
 */
export function reportRateLimit(providerName: string): void {
  rpcManager.reportRateLimit(providerName);
}

/**
 * Get current provider stats
 */
export function getProviderStats(): any {
  return rpcManager.getProviderStats();
}

/**
 * Log a request result
 */
export function logRequestResult(providerName: string, success: boolean): void {
  rpcManager.logRequest(providerName, success);
}