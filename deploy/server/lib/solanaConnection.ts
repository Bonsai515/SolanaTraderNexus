/**
 * Solana Connection Provider
 * 
 * This module provides a consistent way to access Solana RPC endpoints
 * with fallback capabilities for high reliability.
 */

import { Connection, clusterApiUrl, Commitment } from '@solana/web3.js';
import * as logger from '../logger';

// Connection configuration
interface ConnectionConfig {
  url: string;
  priority: number; // Lower means higher priority
  name: string;
  isActive: boolean;
}

// Main connection provider
export class SolanaConnectionProvider {
  private connections: ConnectionConfig[] = [];
  private activeConnection: Connection | null = null;
  private commitment: Commitment = 'confirmed';
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 5 * 60 * 1000; // 5 minutes
  
  constructor() {
    // Add default connections in priority order
    this.addConnectionConfig({
      name: 'Custom RPC',
      url: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      priority: 1,
      isActive: true
    });
    
    this.addConnectionConfig({
      name: 'Helius',
      url: process.env.HELIUS_API_KEY ? 
        `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : 
        'https://mainnet.helius-rpc.com',
      priority: 2,
      isActive: !!process.env.HELIUS_API_KEY
    });
    
    this.addConnectionConfig({
      name: 'Alchemy',
      url: process.env.ALCHEMY_RPC_URL || '',
      priority: 3,
      isActive: !!process.env.ALCHEMY_RPC_URL
    });
    
    this.addConnectionConfig({
      name: 'Instant Nodes',
      url: process.env.INSTANT_NODES_RPC_URL || '',
      priority: 4,
      isActive: !!process.env.INSTANT_NODES_RPC_URL
    });
    
    this.addConnectionConfig({
      name: 'QuickNode',
      url: process.env.QUICKNODE_RPC_URL || '',
      priority: 5,
      isActive: !!process.env.QUICKNODE_RPC_URL
    });
    
    this.addConnectionConfig({
      name: 'Public RPC',
      url: clusterApiUrl('mainnet-beta'),
      priority: 10, // Lowest priority
      isActive: true // Always active as fallback
    });
    
    // Initialize connection
    this.initializeConnection();
    
    // Set up health check interval
    setInterval(() => this.checkConnectionHealth(), this.healthCheckInterval);
    
    logger.info('Solana connection provider initialized');
  }
  
  /**
   * Add a connection configuration
   * @param config Connection configuration
   */
  private addConnectionConfig(config: ConnectionConfig): void {
    // Only add if URL is provided
    if (config.url) {
      this.connections.push(config);
      
      // Sort by priority
      this.connections.sort((a, b) => a.priority - b.priority);
      
      logger.debug(`Added Solana RPC connection: ${config.name}`);
    }
  }
  
  /**
   * Initialize connection using highest priority active connection
   */
  private initializeConnection(): void {
    // Find highest priority active connection
    const activeConfig = this.connections.find(c => c.isActive);
    
    if (activeConfig) {
      logger.info(`Initializing Solana connection using ${activeConfig.name}`);
      
      try {
        this.activeConnection = new Connection(activeConfig.url, {
          commitment: this.commitment,
          confirmTransactionInitialTimeout: 60000, // 60 seconds
          disableRetryOnRateLimit: false
        });
      } catch (error) {
        logger.error('Error initializing Solana connection:', error);
        this.fallbackToNextConnection();
      }
    } else {
      logger.error('No active Solana RPC connections available');
    }
  }
  
  /**
   * Check connection health
   */
  private async checkConnectionHealth(): Promise<void> {
    if (!this.activeConnection) {
      this.initializeConnection();
      return;
    }
    
    try {
      // Perform simple health check by getting recent blockhash
      const startTime = Date.now();
      const { blockhash } = await this.activeConnection.getLatestBlockhash();
      const endTime = Date.now();
      
      // Check response time
      const responseTime = endTime - startTime;
      
      if (responseTime > 5000) {
        // Response too slow, try next connection
        logger.warn(`Solana RPC response time too high: ${responseTime}ms, switching connections`);
        this.fallbackToNextConnection();
      } else {
        logger.debug(`Solana RPC health check successful. Response time: ${responseTime}ms`);
      }
      
      this.lastHealthCheck = Date.now();
    } catch (error) {
      logger.error('Solana RPC health check failed:', error);
      this.fallbackToNextConnection();
    }
  }
  
  /**
   * Fallback to next available connection
   */
  private fallbackToNextConnection(): void {
    // Find current connection in the list
    const currentConfig = this.connections.find(c => 
      c.isActive && this.activeConnection && c.url === this.activeConnection.rpcEndpoint
    );
    
    if (!currentConfig) {
      // Current connection not found, reinitialize
      this.initializeConnection();
      return;
    }
    
    // Find next active connection
    const nextConfig = this.connections.find(c => 
      c.isActive && c.priority > currentConfig.priority
    );
    
    if (nextConfig) {
      logger.info(`Switching Solana connection from ${currentConfig.name} to ${nextConfig.name}`);
      
      try {
        this.activeConnection = new Connection(nextConfig.url, {
          commitment: this.commitment,
          confirmTransactionInitialTimeout: 60000,
          disableRetryOnRateLimit: false
        });
      } catch (error) {
        logger.error(`Error initializing fallback connection ${nextConfig.name}:`, error);
        
        // Mark as inactive and try next
        nextConfig.isActive = false;
        this.fallbackToNextConnection();
      }
    } else {
      logger.error('No fallback Solana RPC connections available');
      
      // Reset all connections to active and try again from start
      this.connections.forEach(c => c.isActive = true);
      this.initializeConnection();
    }
  }
  
  /**
   * Get active connection
   * @returns Active Solana connection
   */
  public getConnection(): Connection {
    if (!this.activeConnection) {
      this.initializeConnection();
      
      if (!this.activeConnection) {
        // Still no connection, throw error
        throw new Error('Failed to initialize Solana connection');
      }
    }
    
    return this.activeConnection;
  }
  
  /**
   * Get active connection endpoint
   * @returns RPC endpoint URL
   */
  public getEndpoint(): string {
    if (!this.activeConnection) {
      this.initializeConnection();
      
      if (!this.activeConnection) {
        throw new Error('Failed to initialize Solana connection');
      }
    }
    
    return this.activeConnection.rpcEndpoint;
  }
  
  /**
   * Get active connection name
   * @returns Name of active connection
   */
  public getActiveName(): string {
    if (!this.activeConnection) {
      this.initializeConnection();
      
      if (!this.activeConnection) {
        throw new Error('Failed to initialize Solana connection');
      }
    }
    
    const config = this.connections.find(c => 
      c.isActive && this.activeConnection && c.url === this.activeConnection.rpcEndpoint
    );
    
    return config ? config.name : 'Unknown';
  }
  
  /**
   * Set commitment level
   * @param commitment New commitment level
   */
  public setCommitment(commitment: Commitment): void {
    this.commitment = commitment;
    
    if (this.activeConnection) {
      logger.info(`Updating Solana connection commitment level to ${commitment}`);
      
      // Reinitialize connection with new commitment
      this.initializeConnection();
    }
  }
}

// Singleton instance
const connectionProvider = new SolanaConnectionProvider();

/**
 * Get active Solana connection
 * @returns Solana connection
 */
export function getConnection(): Connection {
  return connectionProvider.getConnection();
}

/**
 * Get active connection endpoint
 * @returns RPC endpoint URL
 */
export function getEndpoint(): string {
  return connectionProvider.getEndpoint();
}

/**
 * Get active connection name
 * @returns Name of active connection
 */
export function getActiveName(): string {
  return connectionProvider.getActiveName();
}

/**
 * Set commitment level
 * @param commitment New commitment level
 */
export function setCommitment(commitment: Commitment): void {
  connectionProvider.setCommitment(commitment);
}