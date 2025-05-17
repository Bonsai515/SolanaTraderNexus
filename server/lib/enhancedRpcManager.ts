/**
 * Enhanced RPC Management System
 * 
 * This system manages multiple RPC endpoints with automatic failover, load balancing,
 * circuit breaker patterns, and health monitoring.
 */

import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import WebSocket from 'ws';

// Circuit breaker states
enum CircuitState {
  CLOSED,   // Working normally
  OPEN,     // Failed, not trying
  HALF_OPEN // Failed, testing if working
}

// RPC Endpoint interface
interface RpcEndpoint {
  url: string;
  wsUrl?: string;
  priority: number;
  healthy: boolean;
  lastSuccess: number | 'never';
  lastFailure: number | 'never';
  failCount: number;
  latency: number;
  circuitState: CircuitState;
  failureWindow: number[];
  wsConnection?: WebSocket | null;
  wsConnectionState?: 'connecting' | 'open' | 'closed' | 'error';
  label?: string;
}

// Rate Limiting interface
interface RateLimiter {
  windowMs: number;
  maxRequests: number;
  requestLog: number[];
}

/**
 * Enhanced RPC Manager with fallback and load balancing
 */
export class EnhancedRpcManager {
  private endpoints: RpcEndpoint[] = [];
  private currentEndpointIndex: number = 0;
  private connection: Connection | null = null;
  private rateLimiter: RateLimiter;
  private failoverThreshold: number = 3;
  private backoffTime: number = 5000;
  private maxBackoffTime: number = 60000;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 30000; // 30 seconds

  constructor() {
    // Set up rate limiter
    this.rateLimiter = {
      windowMs: 60000, // 1 minute window
      maxRequests: 100, // 100 requests per minute
      requestLog: []
    };

    // Initialize default endpoints
    this.initializeEndpoints();

    // Start health checks
    this.startHealthChecks();
  }

  /**
   * Initialize RPC endpoints
   */
  private initializeEndpoints(): void {
    // Your primary endpoint
    if (process.env.SOLANA_RPC_URL) {
      this.addEndpoint(
        process.env.SOLANA_RPC_URL, 
        process.env.SOLANA_WS_URL || process.env.SOLANA_RPC_URL.replace('https://', 'wss://'),
        1,
        'Primary'
      );
    } else {
      console.warn('[RPC] No primary SOLANA_RPC_URL found in env');
    }

    // InstantNodes endpoint (if available)
    if (process.env.INSTANT_NODES_URL) {
      this.addEndpoint(
        process.env.INSTANT_NODES_URL,
        process.env.INSTANT_NODES_WS_URL || process.env.INSTANT_NODES_URL.replace('https://', 'wss://'),
        2,
        'InstantNodes'
      );
    }

    // Add Alchemy endpoint as primary backup (high priority, lower rate limits)
    if (process.env.ALCHEMY_RPC_URL) {
      this.addEndpoint(
        process.env.ALCHEMY_RPC_URL,
        process.env.ALCHEMY_WS_URL || process.env.ALCHEMY_RPC_URL.replace('https://', 'wss://'),
        2,
        'Alchemy'
      );
    }
    
    // Add Helius endpoint as a secondary backup (if available)
    if (process.env.HELIUS_RPC_URL) {
      this.addEndpoint(
        process.env.HELIUS_RPC_URL,
        process.env.HELIUS_WS_URL || process.env.HELIUS_RPC_URL.replace('https://', 'wss://'),
        3,
        'Helius'
      );
    }

    // Add QuickNode endpoint as a backup (if available)
    if (process.env.QUICKNODE_RPC_URL) {
      this.addEndpoint(
        process.env.QUICKNODE_RPC_URL,
        process.env.QUICKNODE_WS_URL || process.env.QUICKNODE_RPC_URL.replace('https://', 'wss://'),
        4,
        'QuickNode'
      );
    }

    // Add Ankr endpoint as a backup (if available)
    if (process.env.ANKR_RPC_URL) {
      this.addEndpoint(
        process.env.ANKR_RPC_URL,
        process.env.ANKR_WS_URL,
        5,
        'Ankr'
      );
    }

    // Fallback to public endpoints as last resort
    this.addEndpoint('https://api.mainnet-beta.solana.com', 'wss://api.mainnet-beta.solana.com', 999, 'Public RPC');

    // Sort by priority
    this.endpoints.sort((a, b) => a.priority - b.priority);

    // Log the endpoints
    console.log(`[RPC] Initialized ${this.endpoints.length} endpoints`);
  }

  /**
   * Add a new RPC endpoint
   */
  addEndpoint(url: string, wsUrl?: string, priority: number = 999, label?: string): void {
    this.endpoints.push({
      url,
      wsUrl,
      priority,
      healthy: true,
      lastSuccess: 'never',
      lastFailure: 'never',
      failCount: 0,
      latency: 0,
      circuitState: CircuitState.CLOSED,
      failureWindow: [],
      label
    });

    console.log(`[RPC] Added endpoint: ${url} (priority: ${priority}${label ? ', label: ' + label : ''})`);
  }

  /**
   * Get a connection for RPC calls
   */
  getConnection(): Connection {
    if (!this.connection || !this.isCurrentEndpointHealthy()) {
      this.selectBestEndpoint();
      const endpoint = this.endpoints[this.currentEndpointIndex];
      this.connection = new Connection(endpoint.url, 'confirmed');
      console.log(`[RPC] Connected to ${endpoint.label || endpoint.url}`);
    }
    return this.connection;
  }

  /**
   * Initialize websocket for the current endpoint
   */
  initializeWebsocket(): WebSocket | null {
    const endpoint = this.endpoints[this.currentEndpointIndex];
    
    if (!endpoint.wsUrl) {
      console.warn(`[RPC] No WebSocket URL for endpoint ${endpoint.label || endpoint.url}`);
      return null;
    }

    try {
      // Close any existing connection
      if (endpoint.wsConnection && endpoint.wsConnection.readyState === WebSocket.OPEN) {
        endpoint.wsConnection.close();
      }

      // Create new connection
      const ws = new WebSocket(endpoint.wsUrl);
      endpoint.wsConnection = ws;
      endpoint.wsConnectionState = 'connecting';

      // Set up event handlers
      ws.on('open', () => {
        console.log(`[RPC] WebSocket connected to ${endpoint.label || endpoint.wsUrl}`);
        endpoint.wsConnectionState = 'open';
      });

      ws.on('error', (error) => {
        console.error(`[RPC] WebSocket error for ${endpoint.label || endpoint.wsUrl}:`, error);
        endpoint.wsConnectionState = 'error';
        this.updateEndpointHealth(endpoint, false);
      });

      ws.on('close', () => {
        console.log(`[RPC] WebSocket closed for ${endpoint.label || endpoint.wsUrl}`);
        endpoint.wsConnectionState = 'closed';
      });

      return ws;
    } catch (error) {
      console.error(`[RPC] Error initializing WebSocket for ${endpoint.label || endpoint.wsUrl}:`, error);
      endpoint.wsConnectionState = 'error';
      return null;
    }
  }

  /**
   * Get the websocket connection
   */
  getWebSocket(): WebSocket | null {
    const endpoint = this.endpoints[this.currentEndpointIndex];
    
    if (!endpoint.wsConnection || 
        (endpoint.wsConnection.readyState !== WebSocket.OPEN && 
         endpoint.wsConnection.readyState !== WebSocket.CONNECTING)) {
      return this.initializeWebsocket();
    }
    
    return endpoint.wsConnection;
  }

  /**
   * Execute a request with rate limiting and retry
   */
  async executeRequest<T>(request: () => Promise<T>, endpointLabel?: string): Promise<T> {
    // If specific endpoint is requested, use that one
    if (endpointLabel) {
      const endpointIndex = this.endpoints.findIndex(e => e.label === endpointLabel);
      if (endpointIndex >= 0) {
        this.currentEndpointIndex = endpointIndex;
        this.connection = new Connection(this.endpoints[endpointIndex].url, 'confirmed');
      }
    }

    // Check if current endpoint is InstantNodes and approaching limit
    const endpoint = this.endpoints[this.currentEndpointIndex];
    const isInstantNodes = endpoint.label === 'InstantNodes';
    
    // If using InstantNodes and approaching monthly limit, prefer alternative endpoints
    if (isInstantNodes && this.rateLimiter.requestLog.length > 800) { // Approaching 1M monthly limit
      console.log('[RPC] Preserving InstantNodes quota, trying alternative endpoint first');
      
      // Find a non-InstantNodes endpoint
      const alternativeEndpoint = this.endpoints.find(e => 
        e.label !== 'InstantNodes' && 
        e.healthy && 
        e.circuitState !== CircuitState.OPEN
      );
      
      if (alternativeEndpoint) {
        const newIndex = this.endpoints.indexOf(alternativeEndpoint);
        this.currentEndpointIndex = newIndex;
        this.connection = new Connection(alternativeEndpoint.url, 'confirmed');
        console.log(`[RPC] Using ${alternativeEndpoint.label || alternativeEndpoint.url} to preserve InstantNodes quota`);
        return this.executeRequest(request);
      }
    }
    
    // Check if we can make the request (rate limiting)
    if (this.isRateLimited()) {
      console.warn(`[RPC] Rate limited, waiting for ${this.backoffTime}ms`);
      
      // If InstantNodes is rate limited, try another endpoint immediately
      if (isInstantNodes) {
        // Find any healthy alternative endpoint to try
        const alternativeEndpoint = this.endpoints.find(e => 
          e.label !== 'InstantNodes' && 
          e.healthy && 
          e.circuitState !== CircuitState.OPEN
        );
        
        if (alternativeEndpoint) {
          const newIndex = this.endpoints.indexOf(alternativeEndpoint);
          this.currentEndpointIndex = newIndex;
          this.connection = new Connection(alternativeEndpoint.url, 'confirmed');
          console.log(`[RPC] Switched to ${alternativeEndpoint.label || alternativeEndpoint.url} due to InstantNodes rate limit`);
          return this.executeRequest(request);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, this.backoffTime));
      // Double backoff time for next request if needed
      this.backoffTime = Math.min(this.backoffTime * 2, this.maxBackoffTime);
    } else {
      // Reset backoff time if we're not rate limited
      this.backoffTime = 5000;
    }

    // Track this request
    this.trackRequest();

    try {
      // Attempt to execute the request
      const startTime = Date.now();
      const result = await request();
      const endTime = Date.now();

      // Update endpoint health and latency
      const endpoint = this.endpoints[this.currentEndpointIndex];
      endpoint.latency = endTime - startTime;
      endpoint.lastSuccess = Date.now();
      endpoint.healthy = true;
      endpoint.failCount = 0;
      endpoint.circuitState = CircuitState.CLOSED;

      return result;
    } catch (error) {
      // Handle request failure
      const endpoint = this.endpoints[this.currentEndpointIndex];
      endpoint.lastFailure = Date.now();
      endpoint.failCount++;
      endpoint.failureWindow.push(Date.now());

      // Clean up failure window (keep last 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      endpoint.failureWindow = endpoint.failureWindow.filter(time => time > fiveMinutesAgo);

      // Check if we need to open the circuit breaker
      if (endpoint.failureWindow.length >= this.failoverThreshold) {
        endpoint.circuitState = CircuitState.OPEN;
        endpoint.healthy = false;
        console.warn(`[RPC] Execution failed on ${endpoint.url}: ${error}`);
      }

      // Try to failover to another endpoint if available
      if (this.endpoints.length > 1) {
        console.log(`[RPC] Switching to backup endpoint`);
        const oldEndpointIndex = this.currentEndpointIndex;
        this.selectBestEndpoint();

        // If we found a different endpoint, retry the request
        if (oldEndpointIndex !== this.currentEndpointIndex) {
          this.connection = new Connection(this.endpoints[this.currentEndpointIndex].url, 'confirmed');
          console.log(`[RPC] Switching to ${this.endpoints[this.currentEndpointIndex].label || this.endpoints[this.currentEndpointIndex].url}`);
          return this.executeRequest(request);
        }
      }

      // No other healthy connections available
      console.error('[RPC] No other healthy connections available, keeping current connection');
      throw error;
    }
  }

  /**
   * Track request for rate limiting
   */
  private trackRequest(): void {
    const now = Date.now();
    this.rateLimiter.requestLog.push(now);

    // Clean up old requests from the log
    this.rateLimiter.requestLog = this.rateLimiter.requestLog.filter(
      time => time > now - this.rateLimiter.windowMs
    );
  }

  /**
   * Check if we're rate limited
   */
  private isRateLimited(): boolean {
    const now = Date.now();
    
    // Clean up old requests
    this.rateLimiter.requestLog = this.rateLimiter.requestLog.filter(
      time => time > now - this.rateLimiter.windowMs
    );

    // Check if we've hit the limit
    return this.rateLimiter.requestLog.length >= this.rateLimiter.maxRequests;
  }

  /**
   * Check if the current endpoint is healthy
   */
  private isCurrentEndpointHealthy(): boolean {
    const endpoint = this.endpoints[this.currentEndpointIndex];
    return endpoint.healthy && endpoint.circuitState !== CircuitState.OPEN;
  }

  /**
   * Select the best endpoint based on health, priority, and latency
   */
  private selectBestEndpoint(): void {
    // Reset circuit breakers that have been open for more than 30 seconds
    this.resetOpenCircuits();

    // First, filter to only healthy endpoints
    const healthyEndpoints = this.endpoints.filter(
      e => e.healthy && e.circuitState !== CircuitState.OPEN
    );

    // If no healthy endpoints, try half-open ones
    if (healthyEndpoints.length === 0) {
      const halfOpenEndpoints = this.endpoints.filter(
        e => e.circuitState === CircuitState.HALF_OPEN
      );

      if (halfOpenEndpoints.length > 0) {
        // Sort by priority
        halfOpenEndpoints.sort((a, b) => a.priority - b.priority);
        this.currentEndpointIndex = this.endpoints.indexOf(halfOpenEndpoints[0]);
        console.log(`[RPC] Using half-open endpoint: ${halfOpenEndpoints[0].label || halfOpenEndpoints[0].url}`);
        return;
      }

      // If still no endpoints, reset all circuits and try again
      this.resetAllCircuits();
      return this.selectBestEndpoint();
    }

    // Sort by priority first, then by latency
    healthyEndpoints.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.latency - b.latency;
    });

    this.currentEndpointIndex = this.endpoints.indexOf(healthyEndpoints[0]);
    console.log(`[RPC] Selected endpoint: ${healthyEndpoints[0].label || healthyEndpoints[0].url}`);
  }

  /**
   * Reset circuit breakers that have been open too long
   */
  private resetOpenCircuits(): void {
    const now = Date.now();
    
    for (const endpoint of this.endpoints) {
      if (endpoint.circuitState === CircuitState.OPEN) {
        // If it's been at least 30 seconds since the last failure, try half-open
        if (endpoint.lastFailure !== 'never' && 
            typeof endpoint.lastFailure === 'number' && 
            now - endpoint.lastFailure > 30000) {
          endpoint.circuitState = CircuitState.HALF_OPEN;
          console.log(`[RPC] Circuit HALF_OPEN for ${endpoint.label || endpoint.url}`);
        }
      }
    }
  }

  /**
   * Reset all circuits for emergency recovery
   */
  private resetAllCircuits(): void {
    for (const endpoint of this.endpoints) {
      endpoint.circuitState = CircuitState.HALF_OPEN;
      endpoint.healthy = true;
    }
    console.log('[RPC] Emergency reset of all circuits');
  }

  /**
   * Start health check interval
   */
  startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.checkEndpointHealth();
    }, this.CHECK_INTERVAL);

    console.log(`[RPC] Started health checks at ${this.CHECK_INTERVAL}ms intervals`);
  }

  /**
   * Stop health check interval
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Check health of all endpoints
   */
  private async checkEndpointHealth(): Promise<void> {
    console.log('[RPC] Checking health of all endpoints');

    for (const endpoint of this.endpoints) {
      // Skip if we're already checking it or the circuit is open
      if (endpoint.circuitState === CircuitState.OPEN && 
          endpoint.lastFailure !== 'never' && 
          typeof endpoint.lastFailure === 'number' && 
          Date.now() - endpoint.lastFailure < 30000) {
        continue;
      }

      // Test the connection
      this.testConnection(endpoint);
    }
  }

  /**
   * Test a single endpoint connection
   */
  private async testConnection(endpoint: RpcEndpoint): Promise<void> {
    try {
      // Create a connection just for testing
      const connection = new Connection(endpoint.url, 'confirmed');
      
      // Simple test: get a recent block hash
      const startTime = Date.now();
      await connection.getLatestBlockhash();
      const endTime = Date.now();

      // Update metrics
      endpoint.latency = endTime - startTime;
      endpoint.lastSuccess = Date.now();
      endpoint.healthy = true;
      endpoint.circuitState = CircuitState.CLOSED;
      endpoint.failCount = 0;

      //console.log(`[RPC] Health check passed for ${endpoint.label || endpoint.url}`);
    } catch (error) {
      console.warn(`[RPC] Health check failed for ${endpoint.label || endpoint.url}: ${error}`);
      
      // Update metrics
      endpoint.lastFailure = Date.now();
      endpoint.failCount++;
      this.updateEndpointHealth(endpoint, false);
    }
  }

  /**
   * Update endpoint health status
   */
  private updateEndpointHealth(endpoint: RpcEndpoint, isHealthy: boolean): void {
    if (!isHealthy) {
      endpoint.failCount++;
      endpoint.failureWindow.push(Date.now());
      
      // Clean up failure window (keep last 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      endpoint.failureWindow = endpoint.failureWindow.filter(time => time > fiveMinutesAgo);
      
      // If too many failures, open the circuit
      if (endpoint.failureWindow.length >= this.failoverThreshold) {
        endpoint.circuitState = CircuitState.OPEN;
        endpoint.healthy = false;
      }
    } else {
      endpoint.healthy = true;
      endpoint.circuitState = CircuitState.CLOSED;
      endpoint.failCount = 0;
    }

    // If this was our current endpoint and it's now unhealthy, select a new one
    if (!endpoint.healthy && this.endpoints[this.currentEndpointIndex].url === endpoint.url) {
      this.selectBestEndpoint();
      // Update the connection object
      this.connection = new Connection(this.endpoints[this.currentEndpointIndex].url, 'confirmed');
    }
  }

  /**
   * Get the status of all endpoints
   */
  getEndpointStatus(): any[] {
    return this.endpoints.map(endpoint => ({
      url: endpoint.url,
      label: endpoint.label,
      wsUrl: endpoint.wsUrl,
      priority: endpoint.priority,
      healthy: endpoint.healthy,
      latency: endpoint.latency,
      circuitState: CircuitState[endpoint.circuitState],
      lastSuccess: endpoint.lastSuccess,
      lastFailure: endpoint.lastFailure,
      failCount: endpoint.failCount,
      wsState: endpoint.wsConnectionState
    }));
  }

  /**
   * Get overall RPC status
   */
  getStatus(): {
    healthy: boolean,
    activeEndpoint: string,
    endpointCount: number,
    healthyEndpoints: number
  } {
    const healthyEndpoints = this.endpoints.filter(e => e.healthy).length;
    
    return {
      healthy: healthyEndpoints > 0,
      activeEndpoint: this.endpoints[this.currentEndpointIndex].label || this.endpoints[this.currentEndpointIndex].url,
      endpointCount: this.endpoints.length,
      healthyEndpoints
    };
  }
}

// Create singleton instance
export const rpcManager = new EnhancedRpcManager();
export default rpcManager;