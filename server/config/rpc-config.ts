/**
 * RPC Configuration
 * 
 * This module provides centralized configuration for RPC endpoints
 * with proper fallback mechanisms and connection health monitoring.
 */

import * as logger from '../logger';

// RPC Configuration
export interface RPCEndpoint {
  url: string;
  wsUrl?: string;
  name: string;
  priority: number;
  rateLimit: {
    maxRequestsPerSecond: number;
    maxRequestsPerMinute: number;
    maxRequestsPerHour?: number;
  };
  health: {
    lastChecked: number;
    isHealthy: boolean;
    errorCount: number;
    lastError?: string;
  };
  usageType?: 'transactions' | 'queries' | 'all'; // Type of operations this endpoint should be used for
}

// Global RPC configuration
export const rpcConfig = {
  // Primary endpoints
  primaryEndpoints: [
    {
      url: 'https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8',
      wsUrl: 'wss://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8',
      name: 'QuickNode Primary',
      priority: 1,
      usageType: 'transactions' as 'transactions', // Use primarily for transactions
      rateLimit: {
        maxRequestsPerSecond: 50,
        maxRequestsPerMinute: 2000,
        maxRequestsPerHour: 100000
      },
      health: {
        lastChecked: 0,
        isHealthy: true,
        errorCount: 0
      }
    },
    // Add Helius for neural processing
    {
      url: 'https://rpc.helius.xyz/?api-key=5e032502-2ab7-4ebf-9b61-cfa1523b1f9e',
      wsUrl: 'wss://rpc.helius.xyz/?api-key=5e032502-2ab7-4ebf-9b61-cfa1523b1f9e',
      name: 'Helius Neural',
      priority: 2,
      usageType: 'queries' as 'queries', // Use primarily for data queries and neural processing
      rateLimit: {
        maxRequestsPerSecond: 30,
        maxRequestsPerMinute: 1000,
        maxRequestsPerHour: 30000
      },
      health: {
        lastChecked: 0,
        isHealthy: true,
        errorCount: 0
      }
    }
  ],
  
  // Backup endpoints
  backupEndpoints: [
    {
      url: 'https://api.mainnet-beta.solana.com',
      name: 'Solana Public RPC',
      priority: 10,
      usageType: 'queries' as 'queries', // Use for light operations like balance checks
      rateLimit: {
        maxRequestsPerSecond: 10,
        maxRequestsPerMinute: 100
      },
      health: {
        lastChecked: 0,
        isHealthy: true,
        errorCount: 0
      }
    },
    {
      url: 'https://solana-api.projectserum.com',
      name: 'Project Serum RPC',
      priority: 20,
      usageType: 'queries', // Use for light operations
      rateLimit: {
        maxRequestsPerSecond: 5,
        maxRequestsPerMinute: 50
      },
      health: {
        lastChecked: 0,
        isHealthy: true,
        errorCount: 0
      }
    },
    {
      url: 'https://rpc.ankr.com/solana',
      name: 'Ankr Public RPC',
      priority: 15,
      usageType: 'queries', // Use for light operations
      rateLimit: {
        maxRequestsPerSecond: 8,
        maxRequestsPerMinute: 80
      },
      health: {
        lastChecked: 0,
        isHealthy: true,
        errorCount: 0
      }
    }
  ],
  
  // Remove or mark Instant Nodes as lowest priority since it's hitting rate limits
  instantNodesEndpoint: {
    url: 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9',
    name: 'Instant Nodes',
    priority: 100, // Very low priority
    usageType: 'all', // Only use as last resort
    rateLimit: {
      maxRequestsPerSecond: 1,
      maxRequestsPerMinute: 10
    },
    health: {
      lastChecked: 0,
      isHealthy: false, // Mark as unhealthy by default
      errorCount: 10    // Start with high error count
    }
  },
  
  // General configuration
  config: {
    healthCheckIntervalMs: 60000, // Check health every minute
    retryDelayMs: 1000,           // Base retry delay
    maxRetries: 3,                // Maximum retries per request
    useExponentialBackoff: true,  // Use exponential backoff for retries
    maxBackoffMs: 10000,          // Maximum backoff time
    autoSwitchOnError: true,      // Automatically switch endpoints on error
    prioritizeHealthyEndpoints: true // Prioritize endpoints with good health
  }
};

// Current active RPC endpoint
let activeRPCEndpoint: RPCEndpoint | null = null;
let activeWSEndpoint: RPCEndpoint | null = null;

/**
 * Get the best available RPC endpoint
 */
export function getBestRPCEndpoint(usageType: 'transactions' | 'queries' | 'all' = 'all'): RPCEndpoint {
  // If we have an active endpoint that's healthy and matches the usage type, use it
  if (
    activeRPCEndpoint && 
    activeRPCEndpoint.health.isHealthy && 
    (activeRPCEndpoint.usageType === usageType || activeRPCEndpoint.usageType === 'all' || usageType === 'all')
  ) {
    return activeRPCEndpoint;
  }
  
  // Find the highest priority healthy endpoint that matches the usage type
  let allEndpoints = [
    ...rpcConfig.primaryEndpoints,
    ...rpcConfig.backupEndpoints
  ];
  
  // Only include Instant Nodes if needed as absolute last resort
  if (allEndpoints.length === 0) {
    allEndpoints.push(rpcConfig.instantNodesEndpoint);
  }
  
  // Sort endpoints by priority and health
  const sortedEndpoints = allEndpoints.sort((a, b) => {
    // If one is healthy and the other isn't, prioritize the healthy one
    if (a.health.isHealthy && !b.health.isHealthy) return -1;
    if (!a.health.isHealthy && b.health.isHealthy) return 1;
    
    // Both have the same health status, sort by priority
    return a.priority - b.priority;
  });
  
  // Use the best endpoint
  activeRPCEndpoint = sortedEndpoints[0];
  logger.info(`[RPC] Using endpoint: ${activeRPCEndpoint.name}`);
  
  return activeRPCEndpoint;
}

/**
 * Get the best available WebSocket endpoint
 */
export function getBestWSEndpoint(): RPCEndpoint | null {
  // If we have an active endpoint that's healthy, use it
  if (activeWSEndpoint && activeWSEndpoint.health.isHealthy) {
    return activeWSEndpoint;
  }
  
  // Find endpoints with WebSocket URLs
  const wsEndpoints = [
    ...rpcConfig.primaryEndpoints,
    ...rpcConfig.backupEndpoints
  ].filter(endpoint => endpoint.wsUrl);
  
  if (wsEndpoints.length === 0) {
    logger.warn('[RPC] No WebSocket endpoints available');
    return null;
  }
  
  // Sort endpoints by priority and health
  const sortedEndpoints = wsEndpoints.sort((a, b) => {
    // If one is healthy and the other isn't, prioritize the healthy one
    if (a.health.isHealthy && !b.health.isHealthy) return -1;
    if (!a.health.isHealthy && b.health.isHealthy) return 1;
    
    // Both have the same health status, sort by priority
    return a.priority - b.priority;
  });
  
  // Use the best endpoint
  activeWSEndpoint = sortedEndpoints[0];
  logger.info(`[RPC] Using WebSocket endpoint: ${activeWSEndpoint.name}`);
  
  return activeWSEndpoint;
}

/**
 * Mark an endpoint as unhealthy
 */
export function markEndpointUnhealthy(url: string, error: string): void {
  const updateEndpoint = (endpoint: RPCEndpoint) => {
    if (endpoint.url === url) {
      endpoint.health.isHealthy = false;
      endpoint.health.lastChecked = Date.now();
      endpoint.health.errorCount++;
      endpoint.health.lastError = error;
      
      logger.warn(`[RPC] Marked endpoint ${endpoint.name} as unhealthy: ${error}`);
      
      // If this was the active endpoint, clear it so we get a new one next time
      if (activeRPCEndpoint && activeRPCEndpoint.url === url) {
        activeRPCEndpoint = null;
      }
      if (activeWSEndpoint && activeWSEndpoint.url === url) {
        activeWSEndpoint = null;
      }
      
      return true;
    }
    return false;
  };
  
  // Check all endpoint collections
  let found = false;
  for (const endpoint of rpcConfig.primaryEndpoints) {
    if (updateEndpoint(endpoint)) {
      found = true;
      break;
    }
  }
  
  if (!found) {
    for (const endpoint of rpcConfig.backupEndpoints) {
      if (updateEndpoint(endpoint)) {
        found = true;
        break;
      }
    }
  }
  
  if (!found && rpcConfig.instantNodesEndpoint.url === url) {
    updateEndpoint(rpcConfig.instantNodesEndpoint);
  }
}

/**
 * Check the health of all endpoints
 */
export async function checkEndpointHealth(): Promise<void> {
  const checkEndpoint = async (endpoint: RPCEndpoint) => {
    try {
      // Simple health check request
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth',
          params: []
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.result === 'ok') {
          endpoint.health.isHealthy = true;
          endpoint.health.lastChecked = Date.now();
          endpoint.health.errorCount = 0;
          logger.info(`[RPC] Endpoint ${endpoint.name} is healthy`);
          return true;
        }
      }
      
      // If we got here, the endpoint is not healthy
      endpoint.health.isHealthy = false;
      endpoint.health.lastChecked = Date.now();
      endpoint.health.errorCount++;
      endpoint.health.lastError = `Health check failed: ${response.status} ${response.statusText}`;
      logger.warn(`[RPC] Endpoint ${endpoint.name} is unhealthy: ${endpoint.health.lastError}`);
      return false;
    } catch (error) {
      endpoint.health.isHealthy = false;
      endpoint.health.lastChecked = Date.now();
      endpoint.health.errorCount++;
      endpoint.health.lastError = `Health check error: ${error.message}`;
      logger.warn(`[RPC] Endpoint ${endpoint.name} health check error: ${error.message}`);
      return false;
    }
  };
  
  // Check all endpoints
  for (const endpoint of rpcConfig.primaryEndpoints) {
    await checkEndpoint(endpoint);
  }
  
  for (const endpoint of rpcConfig.backupEndpoints) {
    await checkEndpoint(endpoint);
  }
  
  // Only check Instant Nodes if we're desperate
  if (rpcConfig.primaryEndpoints.every(e => !e.health.isHealthy) && 
      rpcConfig.backupEndpoints.every(e => !e.health.isHealthy)) {
    await checkEndpoint(rpcConfig.instantNodesEndpoint);
  }
  
  logger.info('[RPC] Completed health check of all endpoints');
}

// Set up periodic health checks
let healthCheckInterval: NodeJS.Timeout | null = null;

/**
 * Start health check interval
 */
export function startHealthChecks(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  healthCheckInterval = setInterval(() => {
    checkEndpointHealth().catch(error => {
      logger.error(`[RPC] Error during health checks: ${error.message}`);
    });
  }, rpcConfig.config.healthCheckIntervalMs);
  
  logger.info(`[RPC] Started health checks at ${rpcConfig.config.healthCheckIntervalMs}ms intervals`);
}

/**
 * Stop health check interval
 */
export function stopHealthChecks(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    logger.info('[RPC] Stopped health checks');
  }
}

// Initialize by running a health check
checkEndpointHealth().then(() => {
  startHealthChecks();
}).catch(error => {
  logger.error(`[RPC] Error during initial health check: ${error.message}`);
  // Start health checks anyway
  startHealthChecks();
});