/**
 * Enhanced RPC Manager
 * Provides robust connection management for Solana RPC endpoints with
 * automatic fallback, circuit breaker, and exponential backoff
 */

import { Connection, ConnectionConfig } from '@solana/web3.js';

// Configure fallback RPC endpoints
const SOLANA_RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-api.projectserum.com", 
  "https://rpc.ankr.com/solana",
  "https://ssc-dao.genesysgo.net"
];

// Custom error for connection issues
class RpcConnectionError extends Error {
  constructor(message: string, public endpoint: string) {
    super(message);
    this.name = 'RpcConnectionError';
  }
}

// RPC connection status
interface RpcEndpointStatus {
  url: string;
  isHealthy: boolean;
  failCount: number;
  lastFailTime: number;
  lastSuccessTime: number;
  currentBackoff: number;
}

// Circuit breaker status
enum CircuitState {
  CLOSED, // Normal operation
  OPEN,   // Circuit is open - fail fast
  HALF_OPEN // Testing if service is back
}

/**
 * Enhanced RPC Manager with circuit breaker pattern
 */
export class EnhancedRpcManager {
  private endpoints: RpcEndpointStatus[] = [];
  private connections: Map<string, Connection> = new Map();
  private currentEndpointIndex: number = 0;
  private circuitState: CircuitState = CircuitState.CLOSED;
  private circuitOpenTime: number = 0;
  
  // Configuration
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute
  private readonly MAX_FAIL_COUNT = 5;
  private readonly BASE_BACKOFF = 1000; // 1 second
  private readonly MAX_BACKOFF = 60000; // 1 minute
  private readonly CIRCUIT_RESET_TIMEOUT = 30000; // 30 seconds
  
  constructor() {
    // Initialize endpoints
    this.setupEndpoints();
    
    // Set up health check interval
    setInterval(() => this.performHealthChecks(), this.HEALTH_CHECK_INTERVAL);
  }
  
  /**
   * Set up RPC endpoints
   */
  private setupEndpoints(): void {
    // Randomly shuffle endpoints for better load distribution
    const shuffledEndpoints = [...SOLANA_RPC_ENDPOINTS].sort(() => Math.random() - 0.5);
    
    // Initialize from environment if available and place at the beginning
    if (process.env.SOLANA_RPC_URL) {
      shuffledEndpoints.unshift(process.env.SOLANA_RPC_URL);
    } else {
      // If no environment URL provided, add a public endpoint at the beginning
      shuffledEndpoints.unshift("https://api.mainnet-beta.solana.com");
    }
    
    // Remove duplicates
    const uniqueEndpoints = Array.from(new Set(shuffledEndpoints));
    
    // Create connection status for each endpoint
    this.endpoints = uniqueEndpoints.map(url => ({
      url,
      isHealthy: true,
      failCount: 0,
      lastFailTime: 0,
      lastSuccessTime: Date.now(),
      currentBackoff: this.BASE_BACKOFF
    }));
    
    // Create connections for each endpoint
    for (const endpoint of this.endpoints) {
      this.createConnection(endpoint.url);
    }
    
    console.log(`Initialized ${this.endpoints.length} RPC endpoints`);
  }
  
  /**
   * Create a Solana connection
   */
  private createConnection(url: string): Connection {
    const connectionConfig: ConnectionConfig = {
      commitment: 'confirmed',
      disableRetryOnRateLimit: false,
      confirmTransactionInitialTimeout: 60000
    };
    
    const connection = new Connection(url, connectionConfig);
    this.connections.set(url, connection);
    return connection;
  }
  
  /**
   * Get the best available RPC connection
   */
  public getConnection(): Connection {
    // Fast path - if circuit is open, fail immediately
    if (this.circuitState === CircuitState.OPEN) {
      // Check if we should reset to half-open
      if (Date.now() - this.circuitOpenTime > this.CIRCUIT_RESET_TIMEOUT) {
        this.circuitState = CircuitState.HALF_OPEN;
        console.log('Circuit breaker reset to HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is open - all RPC endpoints are unavailable');
      }
    }
    
    // Find the first healthy endpoint
    const healthyEndpoints = this.endpoints.filter(e => e.isHealthy);
    
    if (healthyEndpoints.length === 0) {
      // All endpoints are unhealthy - open the circuit
      this.openCircuit();
      throw new Error('All RPC endpoints are unavailable');
    }
    
    // Use the current endpoint if it's healthy
    if (this.endpoints[this.currentEndpointIndex].isHealthy) {
      return this.connections.get(this.endpoints[this.currentEndpointIndex].url)!;
    }
    
    // Find the next healthy endpoint
    for (let i = 0; i < this.endpoints.length; i++) {
      const index = (this.currentEndpointIndex + i + 1) % this.endpoints.length;
      if (this.endpoints[index].isHealthy) {
        this.currentEndpointIndex = index;
        console.log(`Switched to RPC endpoint: ${this.endpoints[index].url}`);
        return this.connections.get(this.endpoints[index].url)!;
      }
    }
    
    // Should never get here - we already checked for healthyEndpoints.length above
    throw new Error('Failed to find a healthy RPC endpoint');
  }
  
  /**
   * Mark an endpoint as failed
   */
  public markEndpointFailed(url: string, error: Error): void {
    const endpoint = this.endpoints.find(e => e.url === url);
    if (!endpoint) return;
    
    endpoint.failCount++;
    endpoint.lastFailTime = Date.now();
    
    console.log(`RPC endpoint ${url} failed: ${error.message} (fail count: ${endpoint.failCount})`);
    
    // Apply exponential backoff
    if (endpoint.failCount >= this.MAX_FAIL_COUNT) {
      endpoint.isHealthy = false;
      endpoint.currentBackoff = Math.min(
        endpoint.currentBackoff * 2,
        this.MAX_BACKOFF
      );
      
      console.log(`RPC endpoint ${url} marked unhealthy, backoff: ${endpoint.currentBackoff}ms`);
    }
    
    // If this is the current endpoint, switch to another
    if (this.endpoints[this.currentEndpointIndex].url === url) {
      this.tryFindNextHealthyEndpoint();
    }
    
    // Check if all endpoints are unhealthy
    if (!this.endpoints.some(e => e.isHealthy)) {
      this.openCircuit();
    }
  }
  
  /**
   * Find next healthy endpoint
   */
  private tryFindNextHealthyEndpoint(): boolean {
    for (let i = 0; i < this.endpoints.length; i++) {
      const index = (this.currentEndpointIndex + i + 1) % this.endpoints.length;
      if (this.endpoints[index].isHealthy) {
        this.currentEndpointIndex = index;
        console.log(`Switched to RPC endpoint: ${this.endpoints[index].url}`);
        return true;
      }
    }
    return false;
  }
  
  /**
   * Open the circuit breaker
   */
  private openCircuit(): void {
    this.circuitState = CircuitState.OPEN;
    this.circuitOpenTime = Date.now();
    console.log('Circuit breaker opened - all RPC endpoints are unavailable');
  }
  
  /**
   * Perform health checks on all endpoints
   */
  private async performHealthChecks(): Promise<void> {
    console.log('Performing health checks on RPC endpoints...');
    
    for (const endpoint of this.endpoints) {
      // Skip health check if the backoff period hasn't elapsed
      if (!endpoint.isHealthy && 
          (Date.now() - endpoint.lastFailTime) < endpoint.currentBackoff) {
        continue;
      }
      
      try {
        const connection = this.connections.get(endpoint.url);
        if (!connection) {
          this.createConnection(endpoint.url);
          continue;
        }
        
        // Simple health check - get recent blockhash
        const result = await connection.getLatestBlockhash();
        
        // Mark as healthy
        endpoint.isHealthy = true;
        endpoint.failCount = 0;
        endpoint.lastSuccessTime = Date.now();
        endpoint.currentBackoff = this.BASE_BACKOFF;
        
        // If circuit is half-open, close it
        if (this.circuitState === CircuitState.HALF_OPEN) {
          this.circuitState = CircuitState.CLOSED;
          console.log('Circuit breaker closed - RPC endpoint is healthy');
        }
        
      } catch (error) {
        console.log(`Health check failed for ${endpoint.url}: ${error.message}`);
        this.markEndpointFailed(endpoint.url, error as Error);
      }
    }
  }
  
  /**
   * Execute an RPC request with automatic retry and fallback
   */
  public async executeRequest<T>(requestFn: (connection: Connection) => Promise<T>): Promise<T> {
    // Try each endpoint in sequence
    for (let attempt = 0; attempt < this.endpoints.length; attempt++) {
      try {
        const connection = this.getConnection();
        return await requestFn(connection);
      } catch (error) {
        const currentUrl = this.endpoints[this.currentEndpointIndex].url;
        this.markEndpointFailed(currentUrl, error as Error);
        
        // If we've tried all endpoints, throw the error
        if (attempt === this.endpoints.length - 1) {
          throw error;
        }
      }
    }
    
    // This should never be reached due to the throw above
    throw new Error('Failed to execute RPC request after trying all endpoints');
  }
}

// Export singleton instance
export const rpcManager = new EnhancedRpcManager();
export default rpcManager;