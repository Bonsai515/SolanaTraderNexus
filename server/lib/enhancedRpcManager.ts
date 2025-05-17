/**
 * Enhanced RPC Manager
 * Provides robust connection management for Solana RPC endpoints with
 * automatic fallback, circuit breaker, and exponential backoff
 */

import { Connection, ConnectionConfig } from '@solana/web3.js';
import axios from 'axios';

// Configure fallback RPC endpoints
const SOLANA_RPC_ENDPOINTS = [
  "https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9",
  "https://api.mainnet-beta.solana.com",
  "https://solana-api.projectserum.com", 
  "https://rpc.ankr.com/solana"
];

// RPC endpoint interface
interface RpcEndpoint {
  url: string;
  isHealthy: boolean;
  failCount: number;
  lastFailTime: number;
  lastSuccessTime: number;
  currentBackoff: number;
  priority: number;
  rateLimit: {
    maxRequests: number;
    interval: number; // ms
    currentRequests: number[];
  };
}

// Circuit breaker states
enum CircuitState {
  CLOSED,   // Normal operation
  OPEN,     // Circuit is open - fail fast
  HALF_OPEN // Testing if service is back
}

// Circuit breaker interface
interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailure: number;
  lastSuccess: number;
  timeout: number;
}

/**
 * Enhanced RPC Manager with circuit breaker pattern and rate limiting
 */
export class EnhancedRpcManager {
  private endpoints: RpcEndpoint[] = [];
  private connections: Map<string, Connection> = new Map();
  private currentEndpointIndex: number = 0;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  
  // Configuration
  private readonly HEALTH_CHECK_INTERVAL = 30_000; // 30 seconds
  private readonly MAX_FAILURES = 3;
  private readonly BASE_BACKOFF = 1000; // 1 second
  private readonly MAX_BACKOFF = 60000; // 1 minute
  private readonly CIRCUIT_TIMEOUT = 60000; // 1 minute
  
  constructor() {
    // Initialize endpoints
    this.setupEndpoints();
    
    // Start health monitoring
    this.startHealthMonitoring();
  }
  
  /**
   * Setup RPC endpoints
   */
  private setupEndpoints(): void {
    // Prioritize environment variable if available
    const priorityEndpoint = process.env.SOLANA_RPC_URL || SOLANA_RPC_ENDPOINTS[0];
    
    // Add all endpoints with assigned priorities
    this.endpoints = [
      // Primary endpoint
      {
        url: priorityEndpoint,
        isHealthy: true,
        failCount: 0,
        lastFailTime: 0,
        lastSuccessTime: Date.now(),
        currentBackoff: this.BASE_BACKOFF,
        priority: 1,
        rateLimit: {
          maxRequests: 30,
          interval: 1000,
          currentRequests: []
        }
      },
      // Other endpoints with lower priorities
      ...SOLANA_RPC_ENDPOINTS
        .filter(url => url !== priorityEndpoint)
        .map((url, index) => ({
          url,
          isHealthy: true,
          failCount: 0,
          lastFailTime: 0,
          lastSuccessTime: Date.now(),
          currentBackoff: this.BASE_BACKOFF,
          priority: index + 2, // Start at priority 2
          rateLimit: {
            maxRequests: 20,
            interval: 1000,
            currentRequests: []
          }
        }))
    ];
    
    // Initialize circuit breakers
    for (const endpoint of this.endpoints) {
      this.circuitBreakers.set(endpoint.url, {
        state: CircuitState.CLOSED,
        failures: 0,
        lastFailure: 0,
        lastSuccess: Date.now(),
        timeout: this.CIRCUIT_TIMEOUT
      });
      
      // Create Solana connection
      this.createConnection(endpoint.url);
    }
    
    console.log(`Initialized ${this.endpoints.length} RPC endpoints`);
  }
  
  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(() => this.checkEndpointHealth(), this.HEALTH_CHECK_INTERVAL);
  }
  
  /**
   * Check health of all endpoints
   */
  private async checkEndpointHealth(): Promise<void> {
    console.log('Checking health of RPC endpoints...');
    
    for (const endpoint of this.endpoints) {
      const circuitBreaker = this.circuitBreakers.get(endpoint.url);
      if (!circuitBreaker) continue;
      
      // Skip health check if circuit is OPEN and timeout not elapsed
      if (circuitBreaker.state === CircuitState.OPEN) {
        if (Date.now() - circuitBreaker.lastFailure < circuitBreaker.timeout) {
          continue;
        }
        // Transition to HALF_OPEN for testing
        circuitBreaker.state = CircuitState.HALF_OPEN;
        console.log(`Circuit for ${endpoint.url} moved to HALF_OPEN state`);
      }
      
      try {
        await this.checkSingleEndpointHealth(endpoint);
        
        // Mark as healthy
        endpoint.isHealthy = true;
        endpoint.failCount = 0;
        endpoint.lastSuccessTime = Date.now();
        
        // Update circuit breaker
        circuitBreaker.state = CircuitState.CLOSED;
        circuitBreaker.failures = 0;
        circuitBreaker.lastSuccess = Date.now();
        
        console.log(`Health check passed for ${endpoint.url}`);
      } catch (error) {
        console.log(`Health check failed for ${endpoint.url}: ${error instanceof Error ? error.message : String(error)}`);
        this.handleEndpointFailure(endpoint, error as Error);
      }
    }
  }
  
  /**
   * Check health of a single endpoint
   */
  private async checkSingleEndpointHealth(endpoint: RpcEndpoint): Promise<void> {
    try {
      // First try REST API health check
      const jsonRpcPayload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth',
        params: []
      };
      
      const response = await axios.post(endpoint.url, jsonRpcPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      
      if (response.status !== 200 || response.data.error) {
        throw new Error(`Health check failed with status ${response.status}: ${JSON.stringify(response.data.error || {})}`);
      }
      
      return;
    } catch (error) {
      // If REST check fails, try Solana Connection
      try {
        const connection = this.connections.get(endpoint.url);
        if (!connection) {
          throw new Error('Connection not initialized');
        }
        
        await connection.getLatestBlockhash();
        return;
      } catch (secondError) {
        throw new Error(`Health check failed via REST and Solana Connection: ${secondError instanceof Error ? secondError.message : String(secondError)}`);
      }
    }
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
   * Handle endpoint failure
   */
  private handleEndpointFailure(endpoint: RpcEndpoint, error: Error): void {
    endpoint.failCount++;
    endpoint.lastFailTime = Date.now();
    
    // Update circuit breaker
    const circuitBreaker = this.circuitBreakers.get(endpoint.url);
    if (circuitBreaker) {
      circuitBreaker.failures++;
      circuitBreaker.lastFailure = Date.now();
      
      // Open circuit if too many failures
      if (circuitBreaker.failures >= this.MAX_FAILURES) {
        circuitBreaker.state = CircuitState.OPEN;
        endpoint.isHealthy = false;
        console.log(`Circuit breaker OPENED for ${endpoint.url}`);
      }
    }
    
    // Apply exponential backoff
    endpoint.currentBackoff = Math.min(
      endpoint.currentBackoff * 2,
      this.MAX_BACKOFF
    );
    
    // Log failure
    console.log(`RPC endpoint ${endpoint.url} failed: ${error.message}`);
    console.log(`  Fail count: ${endpoint.failCount}, Backoff: ${endpoint.currentBackoff}ms`);
    
    // Switch endpoints if needed
    if (this.endpoints[this.currentEndpointIndex].url === endpoint.url) {
      this.findNextHealthyEndpoint();
    }
  }
  
  /**
   * Check if an endpoint is rate limited
   */
  private isRateLimited(endpoint: RpcEndpoint): boolean {
    const now = Date.now();
    
    // Clean up old requests outside the interval window
    endpoint.rateLimit.currentRequests = endpoint.rateLimit.currentRequests.filter(
      timestamp => now - timestamp < endpoint.rateLimit.interval
    );
    
    // Check if we've hit the rate limit
    return endpoint.rateLimit.currentRequests.length >= endpoint.rateLimit.maxRequests;
  }
  
  /**
   * Track request for rate limiting
   */
  private trackRequest(endpoint: RpcEndpoint): void {
    endpoint.rateLimit.currentRequests.push(Date.now());
  }
  
  /**
   * Find the next healthy endpoint
   */
  private findNextHealthyEndpoint(): Connection | null {
    // Sort endpoints by health and priority
    const availableEndpoints = this.endpoints
      .filter(e => e.isHealthy && !this.isRateLimited(e))
      .sort((a, b) => a.priority - b.priority);
    
    if (availableEndpoints.length === 0) {
      return null;
    }
    
    // Find endpoint by index in original array
    const bestEndpoint = availableEndpoints[0];
    this.currentEndpointIndex = this.endpoints.findIndex(e => e.url === bestEndpoint.url);
    
    console.log(`Switched to RPC endpoint: ${bestEndpoint.url} (priority: ${bestEndpoint.priority})`);
    return this.connections.get(bestEndpoint.url)!;
  }
  
  /**
   * Get the best available connection
   */
  public getConnection(): Connection {
    const endpoint = this.endpoints[this.currentEndpointIndex];
    const circuitBreaker = this.circuitBreakers.get(endpoint.url);
    
    // Check circuit breaker state
    if (circuitBreaker && circuitBreaker.state === CircuitState.OPEN) {
      // Check if enough time has passed to try again
      if (Date.now() - circuitBreaker.lastFailure >= circuitBreaker.timeout) {
        circuitBreaker.state = CircuitState.HALF_OPEN;
        console.log(`Circuit for ${endpoint.url} moved to HALF_OPEN state`);
      } else {
        // Find another endpoint
        const nextConnection = this.findNextHealthyEndpoint();
        if (nextConnection) {
          return nextConnection;
        }
        throw new Error('All RPC endpoints are unavailable');
      }
    }
    
    // Check rate limits
    if (this.isRateLimited(endpoint)) {
      console.log(`RPC endpoint ${endpoint.url} is rate limited, switching...`);
      
      // Find another endpoint
      const nextConnection = this.findNextHealthyEndpoint();
      if (nextConnection) {
        return nextConnection;
      }
      
      // If all are rate limited, use the current one but log a warning
      console.warn('All RPC endpoints are rate limited, proceeding with caution');
    }
    
    // Track the request
    this.trackRequest(endpoint);
    
    // Return the current connection
    return this.connections.get(endpoint.url)!;
  }
  
  /**
   * Execute an RPC request with circuit breaker and automatic retries
   */
  public async executeRequest<T>(requestFn: (connection: Connection) => Promise<T>): Promise<T> {
    // Try each endpoint in sequence until one succeeds
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.endpoints.length; attempt++) {
      try {
        const connection = this.getConnection();
        const endpoint = this.endpoints[this.currentEndpointIndex];
        const circuitBreaker = this.circuitBreakers.get(endpoint.url);
        
        // Execute the request
        const result = await requestFn(connection);
        
        // Update success metrics
        endpoint.lastSuccessTime = Date.now();
        if (circuitBreaker) {
          circuitBreaker.state = CircuitState.CLOSED;
          circuitBreaker.failures = 0;
          circuitBreaker.lastSuccess = Date.now();
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        const endpoint = this.endpoints[this.currentEndpointIndex];
        
        // Handle endpoint failure
        this.handleEndpointFailure(endpoint, lastError);
      }
    }
    
    // If we get here, all endpoints failed
    throw lastError || new Error('All RPC endpoints failed');
  }
  
  /**
   * Get status of all endpoints
   */
  public getEndpointStatus(): any[] {
    return this.endpoints.map(endpoint => {
      const circuitBreaker = this.circuitBreakers.get(endpoint.url);
      return {
        url: endpoint.url,
        healthy: endpoint.isHealthy,
        failCount: endpoint.failCount,
        priority: endpoint.priority,
        circuitState: circuitBreaker ? 
          CircuitState[circuitBreaker.state] : 'UNKNOWN',
        lastSuccess: endpoint.lastSuccessTime ? 
          new Date(endpoint.lastSuccessTime).toISOString() : 'never',
        backoff: endpoint.currentBackoff
      };
    });
  }
}

// Export singleton instance
export const rpcManager = new EnhancedRpcManager();
export default rpcManager;