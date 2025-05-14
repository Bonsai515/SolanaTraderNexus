/**
 * Fix Solana Connection
 * 
 * This module fixes Solana connection issues by implementing a robust
 * connection pool with automatic failover and reconnection logic.
 */

import { Connection } from '@solana/web3.js';
import { getLogger } from './logger';

const logger = getLogger('SolanaConnectionManager');

// RPC endpoint configuration with fallbacks
interface RPCEndpoint {
  url: string;
  name: string;
  priority: number;
  isActive: boolean;
  lastFailure: number | null;
  timeoutMs: number;
}

// Connection pool manager
export class SolanaConnectionManager {
  private static instance: SolanaConnectionManager;
  private endpoints: RPCEndpoint[] = [];
  private currentEndpointIndex: number = 0;
  private connection: Connection | null = null;
  private connectionInitialized: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectBackoff: number = 500; // ms
  
  private constructor() {
    this.initializeEndpoints();
    this.initializeConnection();
    this.startHeartbeat();
  }
  
  static getInstance(): SolanaConnectionManager {
    if (!SolanaConnectionManager.instance) {
      SolanaConnectionManager.instance = new SolanaConnectionManager();
    }
    return SolanaConnectionManager.instance;
  }
  
  private initializeEndpoints() {
    // Add all available RPC endpoints in priority order
    this.endpoints = [
      {
        url: process.env.HELIUS_RPC_URL || 'https://api.helius.xyz/v0/rpc?api-key=' + process.env.HELIUS_API_KEY,
        name: 'Helius',
        priority: 1,
        isActive: true,
        lastFailure: null,
        timeoutMs: 30000
      },
      {
        url: process.env.ALCHEMY_RPC_URL || 'https://solana-mainnet.g.alchemy.com/v2/' + process.env.SOLANA_RPC_API_KEY,
        name: 'Alchemy',
        priority: 2,
        isActive: true,
        lastFailure: null,
        timeoutMs: 30000
      },
      {
        url: process.env.INSTANT_NODES_RPC_URL || 'https://solana-mainnet.rpc.instants.xyz?api-key=' + process.env.SOLANA_RPC_API_KEY,
        name: 'InstantNodes',
        priority: 3,
        isActive: true,
        lastFailure: null,
        timeoutMs: 30000
      },
      {
        url: 'https://api.mainnet-beta.solana.com',
        name: 'Solana Public',
        priority: 4,
        isActive: true,
        lastFailure: null,
        timeoutMs: 30000
      }
    ];
    
    // Sort endpoints by priority
    this.endpoints.sort((a, b) => a.priority - b.priority);
    
    // Log available endpoints
    logger.info(`Initialized ${this.endpoints.length} RPC endpoints`);
  }
  
  private async initializeConnection() {
    if (this.endpoints.length === 0) {
      logger.error('No RPC endpoints available');
      return;
    }
    
    // Try to connect to each endpoint in priority order
    for (let i = 0; i < this.endpoints.length; i++) {
      const endpoint = this.endpoints[i];
      if (!endpoint.isActive) continue;
      
      try {
        logger.info(`Connecting to ${endpoint.name} RPC endpoint: ${endpoint.url.substring(0, 30)}...`);
        
        // Create connection with improved options
        this.connection = new Connection(endpoint.url, {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: endpoint.timeoutMs,
          disableRetryOnRateLimit: false,
          httpHeaders: { 'Content-Type': 'application/json' }
        });
        
        // Test connection by fetching recent blockhash
        const blockhash = await this.connection.getLatestBlockhash();
        logger.info(`Successfully connected to ${endpoint.name} RPC endpoint`);
        
        this.currentEndpointIndex = i;
        this.connectionInitialized = true;
        this.reconnectAttempts = 0;
        return;
      } catch (error) {
        logger.error(`Failed to connect to ${endpoint.name} RPC endpoint: ${error.message}`);
        
        // Mark endpoint as failed
        this.endpoints[i].lastFailure = Date.now();
        
        // Try the next endpoint
        continue;
      }
    }
    
    // If we reach here, all endpoints failed
    logger.error('Failed to connect to any RPC endpoint');
    
    // Schedule reconnect with exponential backoff
    this.scheduleReconnect();
  }
  
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Exceeded maximum reconnect attempts (${this.maxReconnectAttempts})`);
      return;
    }
    
    const delay = this.reconnectBackoff * Math.pow(2, this.reconnectAttempts);
    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.initializeConnection();
    }, delay);
  }
  
  private startHeartbeat() {
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Start new heartbeat interval
    this.heartbeatInterval = setInterval(async () => {
      if (!this.connection || !this.connectionInitialized) {
        return;
      }
      
      try {
        // Test connection with a light operation
        await this.connection.getRecentPerformanceSamples(1);
      } catch (error) {
        logger.error(`Heartbeat failed: ${error.message}`);
        
        // Mark current endpoint as failed
        this.endpoints[this.currentEndpointIndex].lastFailure = Date.now();
        
        // Try to reconnect
        this.connectionInitialized = false;
        this.initializeConnection();
      }
    }, 30000); // 30 second interval
  }
  
  // Get the current connection
  getConnection(): Connection | null {
    if (!this.connection || !this.connectionInitialized) {
      logger.warn('Connection not initialized or unavailable');
      
      // Try to initialize connection
      if (!this.connectionInitialized) {
        this.initializeConnection();
      }
      
      return null;
    }
    
    return this.connection;
  }
  
  // Force reconnect to a different endpoint
  forceReconnect(): void {
    logger.info('Forcing reconnect to different endpoint');
    
    // Mark current endpoint as temporarily failed
    if (this.currentEndpointIndex < this.endpoints.length) {
      this.endpoints[this.currentEndpointIndex].lastFailure = Date.now();
    }
    
    // Reset connection
    this.connection = null;
    this.connectionInitialized = false;
    
    // Initialize new connection
    this.initializeConnection();
  }
  
  // Check if connection is available
  isConnected(): boolean {
    return this.connection !== null && this.connectionInitialized;
  }
  
  // Get current endpoint info
  getCurrentEndpointInfo(): { name: string, url: string } | null {
    if (this.currentEndpointIndex < this.endpoints.length) {
      const endpoint = this.endpoints[this.currentEndpointIndex];
      return {
        name: endpoint.name,
        url: endpoint.url
      };
    }
    
    return null;
  }
}

// Export singleton instance
export const solanaConnection = SolanaConnectionManager.getInstance();

// Initialize connection when module is imported
solanaConnection.getConnection();