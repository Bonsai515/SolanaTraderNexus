/**
 * Enhanced RPC Management System
 * 
 * Manages multiple RPC connections for Solana blockchain with intelligent 
 * fallback, load balancing, and health monitoring features.
 */

import { Connection, ConnectionConfig } from '@solana/web3.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// RPC Provider interface
interface RpcProvider {
  name: string;
  url: string;
  priority: number;
  isHealthy: boolean;
  lastResponseTime: number;
  failCount: number;
  activeConnections: number;
  lastHealthCheck: number;
  maxConnections: number;
  features: string[];
  websocketUrl?: string;
}

interface RpcManagerConfig {
  providers: RpcProvider[];
  healthCheckIntervalMs: number;
  maxConsecutiveFailures: number;
  defaultConnectionConfig: ConnectionConfig;
  loadBalancingStrategy: 'priority' | 'response-time' | 'round-robin';
  logConnections: boolean;
  logHealthChecks: boolean;
  automaticFailover: boolean;
  proactiveConnectionTesting: boolean;
}

export class EnhancedRpcManager {
  private config: RpcManagerConfig;
  private connections: Map<string, Connection> = new Map();
  private activeConnection: Connection | null = null;
  private activeProviderName: string | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private logPath: string;

  constructor(configPath?: string) {
    // Default configuration
    this.config = {
      providers: [
        {
          name: 'Syndica',
          url: 'https://solana-api.syndica.io/access-token/TpbvgGcJAqDFevn54UJdGxEeY2LuJsB5RucHdnXxxFzQkGeP9f1XSxk',
          priority: 1, // Highest priority
          isHealthy: true,
          lastResponseTime: 0,
          failCount: 0,
          activeConnections: 0,
          lastHealthCheck: 0,
          maxConnections: 100,
          features: ['transactions', 'accounts', 'blocks', 'voting'],
          websocketUrl: 'wss://solana-api.syndica.io/access-token/rpc-websockets'
        },
        {
          name: 'Helius',
          url: 'https://mainnet.helius-rpc.com/?api-key=5d0d1d98-4695-4a7d-b8a0-d4f9836da17f',
          priority: 2,
          isHealthy: true,
          lastResponseTime: 0,
          failCount: 0,
          activeConnections: 0,
          lastHealthCheck: 0,
          maxConnections: 100,
          features: ['transactions', 'accounts', 'blocks', 'enhanced-logs'],
          websocketUrl: 'wss://mainnet.helius-rpc.com/?api-key=5d0d1d98-4695-4a7d-b8a0-d4f9836da17f'
        },
        {
          name: 'Alchemy',
          url: 'https://solana-mainnet.g.alchemy.com/v2/oXHrwSQrOlSxcPBMvEO9AXkJRlHES4u7',
          priority: 3,
          isHealthy: true,
          lastResponseTime: 0,
          failCount: 0,
          activeConnections: 0,
          lastHealthCheck: 0,
          maxConnections: 50,
          features: ['transactions', 'accounts', 'enhanced-logs', 'transformers'],
          websocketUrl: 'wss://solana-mainnet.g.alchemy.com/v2/oXHrwSQrOlSxcPBMvEO9AXkJRlHES4u7'
        }
      ],
      healthCheckIntervalMs: 60000, // 1 minute
      maxConsecutiveFailures: 3,
      defaultConnectionConfig: {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
        disableRetryOnRateLimit: false
      },
      loadBalancingStrategy: 'priority',
      logConnections: true,
      logHealthChecks: true,
      automaticFailover: true,
      proactiveConnectionTesting: true
    };

    // Override default config with file config if provided
    if (configPath && fs.existsSync(configPath)) {
      try {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        this.config = { ...this.config, ...fileConfig };
        console.log(`Loaded RPC configuration from ${configPath}`);
      } catch (error) {
        console.error(`Error loading RPC configuration from ${configPath}:`, error);
      }
    }

    // Create logs directory if it doesn't exist
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
    }
    this.logPath = path.join('logs', 'rpc-manager.log');

    // Initialize the RPC manager
    this.initialize();
  }

  private initialize(): void {
    this.log('Initializing Enhanced RPC Manager');
    
    // Initialize connections for all providers
    for (const provider of this.config.providers) {
      this.connections.set(
        provider.name,
        new Connection(provider.url, this.config.defaultConnectionConfig)
      );
    }

    // Set the initial active connection to the highest priority provider
    const initialProvider = this.getProviderByPriority();
    if (initialProvider) {
      this.activeConnection = this.connections.get(initialProvider.name) || null;
      this.activeProviderName = initialProvider.name;
      this.log(`Initial active RPC provider: ${initialProvider.name}`);
    } else {
      this.log('ERROR: No RPC providers available');
    }

    // Start health checks
    this.startHealthChecks();
  }

  private getProviderByPriority(): RpcProvider | null {
    const healthyProviders = this.config.providers
      .filter(provider => provider.isHealthy)
      .sort((a, b) => a.priority - b.priority);
    
    return healthyProviders.length > 0 ? healthyProviders[0] : null;
  }

  private getProviderByResponseTime(): RpcProvider | null {
    const healthyProviders = this.config.providers
      .filter(provider => provider.isHealthy)
      .sort((a, b) => a.lastResponseTime - b.lastResponseTime);
    
    return healthyProviders.length > 0 ? healthyProviders[0] : null;
  }

  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(
      async () => this.checkAllProvidersHealth(),
      this.config.healthCheckIntervalMs
    );

    // Run an immediate health check
    this.checkAllProvidersHealth();
  }

  private async checkAllProvidersHealth(): Promise<void> {
    this.log('[RPC] Running periodic health check for all RPC endpoints', 'INFO');

    for (const provider of this.config.providers) {
      try {
        const startTime = Date.now();
        const connection = this.connections.get(provider.name);
        
        if (!connection) {
          this.log(`[RPC] No connection found for provider ${provider.name}`, 'WARN');
          continue;
        }

        // Check if the RPC is responsive
        const blockHeight = await connection.getBlockHeight();
        const responseTime = Date.now() - startTime;

        // Update provider health status
        provider.isHealthy = true;
        provider.lastResponseTime = responseTime;
        provider.failCount = 0;
        provider.lastHealthCheck = Date.now();

        this.log(`[RPC] Health check passed for ${provider.name}: blockHeight=${blockHeight}, responseTime=${responseTime}ms`, 'INFO');
      } catch (error) {
        provider.failCount += 1;
        
        if (provider.failCount >= this.config.maxConsecutiveFailures) {
          provider.isHealthy = false;
          this.log(`[RPC] Health check failed for ${provider.url}: ${error}`, 'WARN');
          
          // If the current active provider is unhealthy, switch to a backup
          if (this.activeProviderName === provider.name && this.config.automaticFailover) {
            this.switchToHealthyProvider();
          }
        }
      }
    }

    // After health checks, ensure we're using the optimal provider
    if (this.config.loadBalancingStrategy === 'response-time') {
      this.optimizeProviderByResponseTime();
    }
  }

  private switchToHealthyProvider(): void {
    let newProvider: RpcProvider | null = null;
    
    if (this.config.loadBalancingStrategy === 'priority') {
      newProvider = this.getProviderByPriority();
    } else if (this.config.loadBalancingStrategy === 'response-time') {
      newProvider = this.getProviderByResponseTime();
    } else {
      // Round-robin or other strategies could be implemented here
      newProvider = this.getProviderByPriority();
    }

    if (newProvider && newProvider.name !== this.activeProviderName) {
      const newConnection = this.connections.get(newProvider.name);
      if (newConnection) {
        this.activeConnection = newConnection;
        this.activeProviderName = newProvider.name;
        this.log(`[RPC] Switched to backup provider: ${newProvider.name}`, 'INFO');
      }
    }
  }

  private optimizeProviderByResponseTime(): void {
    const fastestProvider = this.getProviderByResponseTime();
    if (fastestProvider && 
        this.activeProviderName !== fastestProvider.name && 
        fastestProvider.isHealthy) {
      const newConnection = this.connections.get(fastestProvider.name);
      if (newConnection) {
        this.activeConnection = newConnection;
        this.activeProviderName = fastestProvider.name;
        this.log(`[RPC] Optimized provider selection to ${fastestProvider.name} based on response time: ${fastestProvider.lastResponseTime}ms`, 'INFO');
      }
    }
  }

  private log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} [${level}] ${message}`;
    
    console.log(logMessage);
    
    // Append to log file
    try {
      fs.appendFileSync(this.logPath, logMessage + '\n');
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }

  // Public methods
  public getConnection(): Connection {
    if (!this.activeConnection) {
      this.switchToHealthyProvider();
      if (!this.activeConnection) {
        throw new Error('No healthy RPC connection available');
      }
    }
    
    // Track active connection count for the current provider
    if (this.activeProviderName) {
      const provider = this.config.providers.find(p => p.name === this.activeProviderName);
      if (provider) {
        provider.activeConnections += 1;
      }
    }

    return this.activeConnection;
  }

  public getWebsocketUrl(): string | undefined {
    if (!this.activeProviderName) {
      this.switchToHealthyProvider();
      if (!this.activeProviderName) {
        throw new Error('No healthy RPC connection available');
      }
    }
    
    const provider = this.config.providers.find(p => p.name === this.activeProviderName);
    return provider?.websocketUrl;
  }

  public getActiveProviderName(): string | null {
    return this.activeProviderName;
  }

  public getProviderStatus(): { [key: string]: { isHealthy: boolean, lastResponseTime: number, activeConnections: number } } {
    const status: { [key: string]: { isHealthy: boolean, lastResponseTime: number, activeConnections: number } } = {};
    
    for (const provider of this.config.providers) {
      status[provider.name] = {
        isHealthy: provider.isHealthy,
        lastResponseTime: provider.lastResponseTime,
        activeConnections: provider.activeConnections
      };
    }
    
    return status;
  }

  public forceProviderSwitch(providerName: string): boolean {
    const provider = this.config.providers.find(p => p.name === providerName);
    if (provider && provider.isHealthy) {
      const newConnection = this.connections.get(providerName);
      if (newConnection) {
        this.activeConnection = newConnection;
        this.activeProviderName = providerName;
        this.log(`[RPC] Manually switched to provider: ${providerName}`, 'INFO');
        return true;
      }
    }
    return false;
  }

  public shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.log('Enhanced RPC Manager shutdown', 'INFO');
  }
}

// Export a singleton instance
export const rpcManager = new EnhancedRpcManager();