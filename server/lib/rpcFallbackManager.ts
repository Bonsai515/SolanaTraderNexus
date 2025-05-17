/**
 * RPC Fallback Manager
 * Provides automatic fallback between multiple RPC endpoints
 * with health checking and intelligent routing
 */

import { Connection, ConnectionConfig } from '@solana/web3.js';
import { EventEmitter } from 'events';

interface RpcEndpoint {
  url: string;
  priority: number;
  name: string;
  isRateLimited: boolean;
  rateLimitUntil: number;
  isHealthy: boolean;
  lastHealthCheck: number;
}

class RpcFallbackManager {
  private endpoints: RpcEndpoint[] = [];
  private currentEndpoint: RpcEndpoint | null = null;
  private eventEmitter = new EventEmitter();
  private connections: Map<string, Connection> = new Map();
  
  // Health check interval (5 minutes)
  private HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;
  
  // Default rate limit duration (30 seconds)
  private DEFAULT_RATE_LIMIT_DURATION = 30 * 1000;

  constructor() {
    // Set up interval for periodic health checks
    setInterval(() => this.checkAllEndpointsHealth(), this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Add an RPC endpoint
   */
  public addEndpoint(url: string, name: string, priority: number = 1): void {
    this.endpoints.push({
      url,
      name,
      priority,
      isRateLimited: false,
      rateLimitUntil: 0,
      isHealthy: true,
      lastHealthCheck: 0
    });
    
    // Sort endpoints by priority
    this.endpoints.sort((a, b) => a.priority - b.priority);
    
    // If this is the first endpoint, set it as current
    if (!this.currentEndpoint) {
      this.currentEndpoint = this.endpoints[0];
    }
    
    // Create a connection for this endpoint
    const config: ConnectionConfig = {
      commitment: 'confirmed',
      disableRetryOnRateLimit: false,
      confirmTransactionInitialTimeout: 60000
    };
    this.connections.set(url, new Connection(url, config));
    
    console.log(`Added RPC endpoint: ${name} (${url})`);
  }

  /**
   * Get the best available connection
   */
  public getConnection(): Connection {
    // Find the best available endpoint
    const endpoint = this.getBestEndpoint();
    
    if (!endpoint) {
      throw new Error('No healthy RPC endpoints available');
    }
    
    // If we switched endpoints, log it
    if (!this.currentEndpoint || this.currentEndpoint.url !== endpoint.url) {
      console.log(`Switching to RPC endpoint: ${endpoint.name}`);
      this.currentEndpoint = endpoint;
    }
    
    return this.connections.get(endpoint.url)!;
  }

  /**
   * Mark an endpoint as rate limited
   */
  public markRateLimited(url: string, duration: number = this.DEFAULT_RATE_LIMIT_DURATION): void {
    const endpoint = this.endpoints.find(e => e.url === url);
    if (endpoint) {
      endpoint.isRateLimited = true;
      endpoint.rateLimitUntil = Date.now() + duration;
      console.log(`Marked RPC endpoint as rate limited: ${endpoint.name} for ${duration}ms`);
      
      // If this was the current endpoint, we need to switch
      if (this.currentEndpoint && this.currentEndpoint.url === url) {
        this.currentEndpoint = null;
        // This will trigger finding a new endpoint on next getConnection call
      }
    }
  }

  /**
   * Mark an endpoint as unhealthy
   */
  public markUnhealthy(url: string): void {
    const endpoint = this.endpoints.find(e => e.url === url);
    if (endpoint) {
      endpoint.isHealthy = false;
      console.log(`Marked RPC endpoint as unhealthy: ${endpoint.name}`);
      
      // If this was the current endpoint, we need to switch
      if (this.currentEndpoint && this.currentEndpoint.url === url) {
        this.currentEndpoint = null;
        // This will trigger finding a new endpoint on next getConnection call
      }
    }
  }

  /**
   * Get the best available endpoint
   */
  private getBestEndpoint(): RpcEndpoint | null {
    const now = Date.now();
    
    // First, check if current endpoint is still good
    if (this.currentEndpoint && 
        this.currentEndpoint.isHealthy && 
        (!this.currentEndpoint.isRateLimited || now > this.currentEndpoint.rateLimitUntil)) {
      return this.currentEndpoint;
    }
    
    // Find the highest priority endpoint that's healthy and not rate limited
    for (const endpoint of this.endpoints) {
      if (endpoint.isHealthy && (!endpoint.isRateLimited || now > endpoint.rateLimitUntil)) {
        return endpoint;
      }
    }
    
    // If all endpoints are rate limited or unhealthy, return the least recently rate limited one
    const availableEndpoints = this.endpoints.filter(e => e.isHealthy);
    if (availableEndpoints.length > 0) {
      return availableEndpoints.reduce((prev, current) => 
        (!prev.isRateLimited || prev.rateLimitUntil < current.rateLimitUntil) ? prev : current
      );
    }
    
    // As a last resort, return any endpoint
    return this.endpoints.length > 0 ? this.endpoints[0] : null;
  }

  /**
   * Check health of all endpoints
   */
  private async checkAllEndpointsHealth(): Promise<void> {
    for (const endpoint of this.endpoints) {
      this.checkEndpointHealth(endpoint);
    }
  }

  /**
   * Check health of a specific endpoint
   */
  private async checkEndpointHealth(endpoint: RpcEndpoint): Promise<boolean> {
    const connection = this.connections.get(endpoint.url);
    if (!connection) return false;
    
    try {
      // Simple health check - get recent blockhash
      await connection.getLatestBlockhash();
      
      // If we get here, the endpoint is healthy
      endpoint.isHealthy = true;
      endpoint.lastHealthCheck = Date.now();
      return true;
    } catch (error) {
      console.log(`Health check failed for endpoint ${endpoint.name}: ${error.message}`);
      endpoint.isHealthy = false;
      return false;
    }
  }
}

// Create a singleton instance
export const rpcManager = new RpcFallbackManager();

// Add public fallback RPC endpoints
rpcManager.addEndpoint('https://api.mainnet-beta.solana.com', 'Solana Mainnet', 1);
rpcManager.addEndpoint('https://solana-api.projectserum.com', 'Project Serum', 2);
rpcManager.addEndpoint('https://rpc.ankr.com/solana', 'Ankr', 3);

export default rpcManager;