/**
 * RPC Connection Manager
 * 
 * This module provides optimized RPC connection management with rate limit handling,
 * load balancing, and automatic failover for Solana transactions.
 */

import { Connection, ConnectionConfig, PublicKey, Commitment } from '@solana/web3.js';
import * as logger from '../logger';
import * as rateLimiter from './rpcRateLimiter.js';

// Available RPC endpoints with priority order (most reliable first)
// Check both regular and VITE_ prefixed environment variables
// Handle special case where INSTANT_NODES_RPC_URL might just have the token part
let PRIMARY_ENDPOINT = process.env.VITE_INSTANT_NODES_RPC_URL;

// If VITE_ version isn't available, check the regular version
if (!PRIMARY_ENDPOINT) {
  const token = process.env.INSTANT_NODES_RPC_URL;
  if (token) {
    // Check if it's a full URL or just a token
    if (token.startsWith('http')) {
      PRIMARY_ENDPOINT = token;
    } else {
      // It's just the token part, construct the full URL
      PRIMARY_ENDPOINT = `https://solana-api.instantnodes.io/token-${token}`;
    }
  }
}

if (!PRIMARY_ENDPOINT) {
  logger.error('CRITICAL: Neither INSTANT_NODES_RPC_URL nor VITE_INSTANT_NODES_RPC_URL is set in environment');
} else {
  logger.info(`[RPC] Found Instant Nodes RPC URL in environment variables: ${PRIMARY_ENDPOINT.substring(0, 30)}...`);
}

// Define RPC endpoints with primary endpoint first for prioritization
// Check both regular and VITE_ prefixed environment variables
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || process.env.VITE_HELIUS_API_KEY;
const ALCHEMY_RPC_URL = process.env.ALCHEMY_RPC_URL || process.env.VITE_ALCHEMY_RPC_URL;

const RPC_ENDPOINTS = [
  PRIMARY_ENDPOINT || 'https://api.mainnet-beta.solana.com',
  HELIUS_API_KEY ? `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}` : null,
  ALCHEMY_RPC_URL || null
].filter(Boolean) as string[];

// Connection pool
const connectionPool: Connection[] = [];
let currentConnectionIndex = 0;
let isConnectionManagerInitialized = false;

// RPC endpoint health
interface EndpointHealth {
  url: string;
  healthy: boolean;
  latency: number;
  lastChecked: number;
  failCount: number;
  successRate: number;
}

const endpointHealth: Map<string, EndpointHealth> = new Map();

/**
 * Initialize the connection manager
 */
function initializeConnectionManager() {
  if (isConnectionManagerInitialized) {
    return;
  }

  // Clear existing connections
  connectionPool.length = 0;

  // Validate primary endpoint
  if (!PRIMARY_ENDPOINT) {
    logger.error('CRITICAL: INSTANT_NODES_RPC_URL is not set in environment. System will use fallbacks but performance will be degraded.');
  }

  // Initialize endpoint health
  for (const url of RPC_ENDPOINTS) {
    endpointHealth.set(url, {
      url,
      healthy: true,
      latency: 0,
      lastChecked: 0,
      failCount: 0,
      successRate: 1.0
    });
  }

  // Create specialized options for Instant Nodes
  const instantNodesOptions: ConnectionConfig = {
    commitment: 'confirmed' as Commitment,
    confirmTransactionInitialTimeout: 60000,
    disableRetryOnRateLimit: false
    // NOTE: Removed custom fetch handler as it's causing TypeScript errors
    // We'll rely on built-in retry mechanisms instead
  };

  const standardOptions: ConnectionConfig = {
    commitment: 'confirmed' as Commitment,
    confirmTransactionInitialTimeout: 60000
  };

  // Create connections with prioritization of Instant Nodes
  let instantNodesAdded = false;

  // Try to add Instant Nodes first
  if (PRIMARY_ENDPOINT) {
    try {
      logger.info(`[RPC] Attempting connection to Instant Nodes: ${PRIMARY_ENDPOINT.substring(0, 20)}...`);
      const connection = new Connection(PRIMARY_ENDPOINT, instantNodesOptions);

      // Test the connection with a simple request
      connection.getBlockHeight()
        .then(() => {
          logger.info(`[RPC] ✅ Successfully verified Instant Nodes connection`);

          // Mark as very healthy
          endpointHealth.set(PRIMARY_ENDPOINT, {
            url: PRIMARY_ENDPOINT,
            healthy: true,
            latency: 0,
            lastChecked: Date.now(),
            failCount: 0,
            successRate: 1.0
          });
        })
        .catch(error => {
          logger.warn(`[RPC] ⚠️ Instant Nodes connection test failed: ${error.message}`);

          // Mark as potentially unhealthy but don't fail yet
          if (endpointHealth.has(PRIMARY_ENDPOINT)) {
            const health = endpointHealth.get(PRIMARY_ENDPOINT)!;
            health.failCount += 1;
            health.successRate = 0.5; // Give it a 50% rating initially
            endpointHealth.set(PRIMARY_ENDPOINT, health);
          }
        });

      // Add to pool regardless of test outcome - we'll check again soon
      connectionPool.push(connection);
      instantNodesAdded = true;

      // Register with rate limiter
      try {
        rateLimiter.setEndpointInfo(PRIMARY_ENDPOINT);
      } catch (e) {
        logger.error(`[RPC] Error registering Instant Nodes with rate limiter: ${e.message}`);
      }

      logger.info(`[RPC] Added primary connection: Instant Nodes`);
    } catch (error) {
      logger.error(`[RPC] Failed to create connection for Instant Nodes:`, error);
    }
  }

  // Add other connections
  for (const url of RPC_ENDPOINTS) {
    // Skip if it's the primary endpoint (already added)
    if (url === PRIMARY_ENDPOINT && instantNodesAdded) {
      continue;
    }

    try {
      const connection = new Connection(url, standardOptions);

      connectionPool.push(connection);

      // Register with rate limiter
      try {
        rateLimiter.setEndpointInfo(url);
      } catch (e) {
        logger.warn(`[RPC] Error registering endpoint with rate limiter: ${e.message}`);
      }

      logger.info(`[RPC] Added connection: ${url.includes('helius') ? 'Helius' : 
                                           url.includes('alchemy') ? 'Alchemy' : url}`);
    } catch (error) {
      logger.error(`[RPC] Failed to create connection for ${url}:`, error);
    }
  }

  // Ensure we have at least one connection
  if (connectionPool.length === 0) {
    logger.error('[RPC] No connections available. Using fallback connection.');
    const fallbackConnection = new Connection('https://api.mainnet-beta.solana.com', standardOptions);
    connectionPool.push(fallbackConnection);

    // Register with rate limiter
    try {
      rateLimiter.setEndpointInfo('https://api.mainnet-beta.solana.com');
    } catch (e) {
      logger.warn(`[RPC] Error registering fallback endpoint with rate limiter: ${e.message}`);
    }
  }

  // Start health check with increased frequency initially
  startHealthCheck();

  isConnectionManagerInitialized = true;
  logger.info(`[RPC] Connection manager initialized with ${connectionPool.length} endpoints`);
}

/**
 * Start health check for all RPC endpoints
 * @param accelerated - If true, runs checks more frequently initially
 */
function startHealthCheck(accelerated = false) {
  // For instant startup or recovery, check Instant Nodes immediately
  if (accelerated && PRIMARY_ENDPOINT) {
    setTimeout(async () => {
      await checkEndpointHealth(PRIMARY_ENDPOINT);
    }, 1000);
  }

  // Run health check every 30 seconds for primary endpoint and 60 seconds for others
  const healthCheckIntervals: NodeJS.Timeout[] = [];

  // Special more frequent check for PRIMARY_ENDPOINT (Instant Nodes)
  if (PRIMARY_ENDPOINT) {
    const primaryInterval = setInterval(async () => {
      await checkEndpointHealth(PRIMARY_ENDPOINT);
    }, 30000); // Every 30 seconds check primary

    healthCheckIntervals.push(primaryInterval);
  }

  // Check all endpoints on a regular interval
  const allEndpointsInterval = setInterval(async () => {
    for (const connection of connectionPool) {
      const url = connection.rpcEndpoint;
      await checkEndpointHealth(url);
    }

    // Log overall health stats periodically
    logEndpointHealth();
  }, 60000); // Every 60 seconds

  healthCheckIntervals.push(allEndpointsInterval);

  // If accelerated startup, do quick initial checks
  if (accelerated) {
    // Check all endpoints quickly at startup with slight delays
    connectionPool.forEach((connection, index) => {
      setTimeout(async () => {
        await checkEndpointHealth(connection.rpcEndpoint);

        // After checking last endpoint, log the health status
        if (index === connectionPool.length - 1) {
          logEndpointHealth();
        }
      }, index * 1000); // Stagger checks by 1 second
    });
  }
}

/**
 * Check health of a specific endpoint
 */
async function checkEndpointHealth(url: string): Promise<boolean> {
  // Find the connection for this URL
  const connection = connectionPool.find(conn => conn.rpcEndpoint === url);
  if (!connection) {
    logger.warn(`[RPC] Cannot check health for unknown endpoint: ${url}`);
    return false;
  }

  try {
    const startTime = Date.now();

    // If it's the primary endpoint (Instant Nodes), do more thorough checking
    let isHealthy = false;
    let result;
    let error = null;

    try {
      // For primary endpoint (Instant Nodes), try a more reliable test with timeout
      if (url === PRIMARY_ENDPOINT) {
        // Using Promise.race to implement a tighter timeout
        result = await Promise.race([
          connection.getBlockHeight(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Instant Nodes timeout')), 5000)
          )
        ]);
      } else {
        // Regular health check for other endpoints
        result = await connection.getBlockHeight();
      }

      isHealthy = result > 0;
    } catch (e) {
      error = e;
      isHealthy = false;
    }

    const endTime = Date.now();
    const latency = endTime - startTime;

    // Update endpoint health
    const health = endpointHealth.get(url);
    if (health) {
      if (isHealthy) {
        health.healthy = true;
        health.latency = latency;
        health.lastChecked = Date.now();

        // Reset fail count on success
        if (health.failCount > 0) {
          health.failCount = 0;
        }

        // Gradually improve success rate with each successful check
        health.successRate = Math.min(1.0, health.successRate + 0.05);

        // For the primary endpoint, boost the success rate more quickly when healthy
        if (url === PRIMARY_ENDPOINT) {
          health.successRate = Math.min(1.0, health.successRate + 0.1);
        }
      } else {
        health.healthy = false;
        health.lastChecked = Date.now();
        health.failCount += 1;

        // Reduce success rate more aggressively for non-primary endpoints
        if (url === PRIMARY_ENDPOINT) {
          health.successRate = Math.max(0.1, health.successRate - 0.1);
        } else {
          health.successRate = Math.max(0, health.successRate - 0.2);
        }

        logger.warn(`[RPC] Health check failed for ${url}: ${error}`);
      }

      endpointHealth.set(url, health);

      // When Instant Nodes becomes healthy again after being unhealthy, log it prominently
      if (url === PRIMARY_ENDPOINT && isHealthy && health.failCount > 0) {
        logger.info(`[RPC] ✅ Instant Nodes connection restored: ${latency}ms latency`);
      }

      // Success log only at debug level to reduce noise
      if (isHealthy) {
        const endpointName = url === PRIMARY_ENDPOINT ? 'Instant Nodes' : 
                             url.includes('helius') ? 'Helius' :
                             url.includes('alchemy') ? 'Alchemy' : 'Public RPC';
        logger.debug(`[RPC] Health check for ${endpointName}: ${result}, latency: ${latency}ms`);
      }
    }

    return isHealthy;
  } catch (error) {
    const health = endpointHealth.get(url);
    if (health) {
      health.healthy = false;
      health.lastChecked = Date.now();
      health.failCount += 1;

      // More severe penalty for unhandled errors
      health.successRate = Math.max(0, health.successRate - 0.3);

      endpointHealth.set(url, health);

      // Log error differently for primary endpoint
      if (url === PRIMARY_ENDPOINT) {
        logger.error(`[RPC] ❌ Instant Nodes health check failed (attempt ${health.failCount}): ${error}`);
      } else {
        logger.warn(`[RPC] Health check failed for ${url}: ${error}`);
      }
    }

    return false;
  }
}

/**
 * Log endpoint health summary
 */
function logEndpointHealth() {
  const healthSummary = Array.from(endpointHealth.entries()).map(([url, health]) => {
    const endpointName = url === PRIMARY_ENDPOINT ? 'Instant Nodes' : 
                         url.includes('helius') ? 'Helius' :
                         url.includes('alchemy') ? 'Alchemy' : 'Public RPC';

    return {
      endpoint: endpointName,
      healthy: health.healthy,
      latency: health.latency,
      successRate: Math.round(health.successRate * 100) + '%'
    };
  });

  logger.debug('[RPC] Endpoint health summary:', healthSummary);
}

/**
 * Get a managed connection with optimized settings
 * Prioritizes Instant Nodes with clear fallback hierarchy
 */
export function getManagedConnection(config?: ConnectionConfig): Connection {
  if (!isConnectionManagerInitialized) {
    initializeConnectionManager();
  }

  const baseConfig = {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 30000,
    ...config
  };

  // Always prioritize Instant Nodes first if it's healthy
  for (let i = 0; i < connectionPool.length; i++) {
    const connection = connectionPool[i];
    // Check if this is the Instant Nodes connection
    if (connection.rpcEndpoint === PRIMARY_ENDPOINT) {
      const health = endpointHealth.get(connection.rpcEndpoint);

      // If Instant Nodes is healthy, use it exclusively
      if (health && health.healthy) {
        currentConnectionIndex = i;
        logger.debug(`[RPC] Using primary Instant Nodes RPC connection`);

        // Register endpoint with rate limiter
        if (typeof import('./rpcRateLimiter.js').setEndpointInfo === 'function') {
          import('./rpcRateLimiter.js').then(rateLimiter => {
            rateLimiter.setEndpointInfo(connection.rpcEndpoint);
          }).catch(err => {
            logger.error(`[RPC] Failed to set endpoint info for rate limiter: ${err.message}`);
          });
        }

        return connectionPool[i];
      }
    }
  }

  // If Instant Nodes is not healthy, use a prioritized fallback approach

  // First try Helius if available
  for (let i = 0; i < connectionPool.length; i++) {
    const connection = connectionPool[i];
    if (connection.rpcEndpoint.includes('helius')) {
      const health = endpointHealth.get(connection.rpcEndpoint);
      if (health && health.healthy) {
        currentConnectionIndex = i;
        logger.info(`[RPC] Instant Nodes unavailable, using Helius fallback`);

        // Register endpoint with rate limiter
        if (typeof import('./rpcRateLimiter.js').setEndpointInfo === 'function') {
          import('./rpcRateLimiter.js').then(rateLimiter => {
            rateLimiter.setEndpointInfo(connection.rpcEndpoint);
          }).catch(err => {
            logger.error(`[RPC] Failed to set endpoint info for rate limiter: ${err.message}`);
          });
        }

        return connectionPool[i];
      }
    }
  }

  // Next try Alchemy if available
  for (let i = 0; i < connectionPool.length; i++) {
    const connection = connectionPool[i];
    if (process.env.ALCHEMY_RPC_URL && connection.rpcEndpoint === process.env.ALCHEMY_RPC_URL) {
      const health = endpointHealth.get(connection.rpcEndpoint);
      if (health && health.healthy) {
        currentConnectionIndex = i;
        logger.info(`[RPC] Instant Nodes and Helius unavailable, using Alchemy fallback`);

        // Register endpoint with rate limiter
        if (typeof import('./rpcRateLimiter.js').setEndpointInfo === 'function') {
          import('./rpcRateLimiter.js').then(rateLimiter => {
            rateLimiter.setEndpointInfo(connection.rpcEndpoint);
          }).catch(err => {
            logger.error(`[RPC] Failed to set endpoint info for rate limiter: ${err.message}`);
          });
        }

        return connectionPool[i];
      }
    }
  }

  // Last resort - use any healthy connection
  for (let i = 0; i < connectionPool.length; i++) {
    const connection = connectionPool[i];
    const health = endpointHealth.get(connection.rpcEndpoint);
    if (health && health.healthy) {
      currentConnectionIndex = i;
      logger.warn(`[RPC] All premium RPCs unavailable, using ${connection.rpcEndpoint} as last resort`);

      // Register endpoint with rate limiter
      if (typeof import('./rpcRateLimiter.js').setEndpointInfo === 'function') {
        import('./rpcRateLimiter.js').then(rateLimiter => {
          rateLimiter.setEndpointInfo(connection.rpcEndpoint);
        }).catch(err => {
          logger.error(`[RPC] Failed to set endpoint info for rate limiter: ${err.message}`);
        });
      }

      return connectionPool[i];
    }
  }

  // If all connections are unhealthy, use the first connection as a last resort
  currentConnectionIndex = 0;
  logger.error(`[RPC] All connections unhealthy, using first connection as last resort`);

  // Register endpoint with rate limiter for first connection
  if (connectionPool.length > 0) {
    const connection = connectionPool[0];
    if (typeof import('./rpcRateLimiter.js').setEndpointInfo === 'function') {
      import('./rpcRateLimiter.js').then(rateLimiter => {
        rateLimiter.setEndpointInfo(connection.rpcEndpoint);
      }).catch(err => {
        logger.error(`[RPC] Failed to set endpoint info for rate limiter: ${err.message}`);
      });
    }
  }

  return connectionPool[0];
}

/**
 * Get the next connection in the pool, following the same priority order
 * as getManagedConnection but skipping the current connection
 */
function getNextConnection(): Connection {
  if (!isConnectionManagerInitialized) {
    initializeConnectionManager();
  }

  // Skip the current connection
  const currentConnection = connectionPool[currentConnectionIndex];

  // Try to keep using Instant Nodes if possible
  if (currentConnection.rpcEndpoint === PRIMARY_ENDPOINT) {
    // If we're already using Instant Nodes, try Helius next
    for (let i = 0; i < connectionPool.length; i++) {
      const connection = connectionPool[i];
      if (connection.rpcEndpoint.includes('helius')) {
        const health = endpointHealth.get(connection.rpcEndpoint);
        if (health && health.healthy) {
          currentConnectionIndex = i;
          logger.info(`[RPC] Switching to Helius as backup`);
          return connection;
        }
      }
    }
  } else if (currentConnection.rpcEndpoint.includes('helius')) {
    // If we're using Helius, try Alchemy next
    for (let i = 0; i < connectionPool.length; i++) {
      const connection = connectionPool[i];
      if (process.env.ALCHEMY_RPC_URL && connection.rpcEndpoint === process.env.ALCHEMY_RPC_URL) {
        const health = endpointHealth.get(connection.rpcEndpoint);
        if (health && health.healthy) {
          currentConnectionIndex = i;
          logger.info(`[RPC] Switching to Alchemy as backup`);
          return connection;
        }
      }
    }
  }

  // If we've exhausted the primary options or they're not healthy, 
  // check if Instant Nodes is available as it should always be the first choice
  for (let i = 0; i < connectionPool.length; i++) {
    const connection = connectionPool[i];
    if (connection.rpcEndpoint === PRIMARY_ENDPOINT && connection.rpcEndpoint !== currentConnection.rpcEndpoint) {
      const health = endpointHealth.get(connection.rpcEndpoint);
      if (health && health.healthy) {
        currentConnectionIndex = i;
        logger.info(`[RPC] Returning to Instant Nodes as primary`);
        return connection;
      }
    }
  }

  // Last resort - find any healthy connection that isn't the current one
  for (let i = 0; i < connectionPool.length; i++) {
    if (i === currentConnectionIndex) continue; // Skip current

    const connection = connectionPool[i];
    const health = endpointHealth.get(connection.rpcEndpoint);
    if (health && health.healthy) {
      currentConnectionIndex = i;
      logger.warn(`[RPC] Switching to ${connection.rpcEndpoint} as fallback`);
      return connection;
    }
  }

  // If no other healthy connections, keep using the current one
  logger.error(`[RPC] No other healthy connections available, keeping current connection`);
  return connectionPool[currentConnectionIndex];
}

/**
 * Execute a function with a connection, with automatic retry on different endpoints if needed
 */
export async function executeWithRpcLoadBalancing<T>(
  fn: (connection: Connection) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  if (!isConnectionManagerInitialized) {
    initializeConnectionManager();
  }

  let lastError: Error | null = null;
  let retries = 0;

  while (retries <= maxRetries) {
    const connection = retries === 0 ? getManagedConnection() : getNextConnection();
    const endpoint = connection.rpcEndpoint;

    try {
      // Use rate limiting wrapper from imported module
      let priority = 2; // NORMAL priority (default)

      // Adjust priority based on retry count
      if (retries > 0) {
        priority = 1; // HIGH priority for retries
      }

      // Execute with rate limiting
      return await rateLimiter.withRateLimiting(
        async () => await fn(connection),
        {
          endpoint,
          priority,
          maxRetries: 2 // Additional retries within the rate limiter itself
        }
      );
    } catch (error) {
      lastError = error as Error;

      // Check if it's a rate limit error
      const isRateLimit = error instanceof Error && 
                          (error.message.includes('429') || 
                           error.message.includes('rate limit') ||
                           error.message.toLowerCase().includes('too many requests'));

      // Update endpoint health for rate limit errors
      if (isRateLimit) {
        const health = endpointHealth.get(connection.rpcEndpoint);
        if (health) {
          health.successRate = Math.max(0, health.successRate - 0.1);
          endpointHealth.set(connection.rpcEndpoint, health);
        }
      }

      logger.warn(`[RPC] Execution failed on ${connection.rpcEndpoint}: ${error instanceof Error ? error.message : String(error)}`);

      // Only retry if we have retries left
      if (retries >= maxRetries) {
        break;
      }

      retries++;

      // Wait before retrying (with exponential backoff)
      const backoffMs = Math.min(100 * Math.pow(2, retries), 2000);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  // If we get here, all retries failed
  throw lastError || new Error('Failed to execute RPC request after multiple retries');
}

/**
 * Get health status of all endpoints
 */
export function getEndpointHealthStatus(): EndpointHealth[] {
  return Array.from(endpointHealth.values());
}

/**
 * Get balance of a public key using the managed connection
 */
export async function getBalance(publicKey: PublicKey): Promise<number> {
  return executeWithRpcLoadBalancing(async (conn) => {
    return await conn.getBalance(publicKey);
  });
}

/**
 * Get account info from on-chain program
 */
export async function getAccountInfo(publicKey: PublicKey, commitment?: Commitment): Promise<any> {
  return executeWithRpcLoadBalancing(async (connection) => {
    return await connection.getAccountInfo(publicKey, commitment as Commitment);
  });
}

/**
 * Get program accounts for on-chain program data with advanced error handling
 * 
 * Note: This function handles provider-specific limitations by:
 * 1. Adding default dataSlice filter for large programs (like token program)
 * 2. Adding appropriate fallbacks for provider-specific errors
 * 3. Handling response size limitations
 */
export async function getProgramAccounts(programId: PublicKey, filters?: any): Promise<Array<any>> {
  // Specific programs that need special handling
  const LARGE_PROGRAMS = [
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',  // Token Program
    '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'  // Serum DEX v3
  ];

  // Extra large programs that need even more restrictive handling
  const EXTRA_LARGE_PROGRAMS = [
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium Liquidity
  ];

  // Special handling for the Raydium Liquidity program which is extremely large
  if (EXTRA_LARGE_PROGRAMS.includes(programId.toString())) {
    // Raydium has too many accounts and requires complex filtering
    // For now, we'll return an empty array to prevent RPC errors
    // In a real system, we would implement pagination or more specific filters
    logger.info(`[RPC] Skipping account fetch for ${programId.toString()} - too many accounts`);

    // Return an empty array without making the RPC call
    // This prevents errors and allows the system to continue functioning
    return Promise.resolve([]);
  }

  // If no filters provided and this is a known large program, add dataSlice to limit response size
  if (!filters && LARGE_PROGRAMS.includes(programId.toString())) {
    filters = {
      dataSlice: { offset: 0, length: 100 } // Only get first 100 bytes of data
    };
  }

  // If it's the Serum DEX v3, we need to add a specific filter as required by Instant Nodes
  if (programId.toString() === '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin' && (!filters || !filters.filters)) {
    filters = filters || {};
    // Add a memcmp filter to get only market accounts
    filters.filters = [
      {
        memcmp: {
          offset: 5, // Offset for account type in Serum markets
          bytes: 'AAAAAAAAAAAAAAAA' // Example filter for open orders accounts
        }
      }
    ];
  }

  return executeWithRpcLoadBalancing(async (connection) => {
    try {
      const result = await connection.getProgramAccounts(programId, filters);

      // Handle different return types - might be array or RpcResponseAndContext
      if (Array.isArray(result)) {
        // It's already an array, just map it
        return result.map(item => ({
          pubkey: item.pubkey,
          account: item.account
        }));
      } else if (result && typeof result === 'object' && 'value' in result) {
        // It's an RpcResponseAndContext, map the value array
        return result.value.map(item => ({
          pubkey: item.pubkey,
          account: item.account
        }));
      } else {
        // Unexpected result format
        logger.warn(`[RPC] Unexpected getProgramAccounts result format: ${JSON.stringify(result)}`);
        return [];
      }
    } catch (error: any) {
      // Handle specific provider errors
      if (error.message && (
          error.message.includes('response too big') || 
          error.message.includes('requires filters'))) {

        // Try again with more restrictive filters
        logger.warn(`[RPC] Reducing data for ${programId.toString()} due to response size limits`);

        // Create more restrictive filters
        const restrictiveFilters = {
          ...filters,
          dataSlice: { offset: 0, length: 50 } // Even smaller slice
        };

        try {
          const result = await connection.getProgramAccounts(programId, restrictiveFilters);

          // Handle different return types - might be array or RpcResponseAndContext
          if (Array.isArray(result)) {
            // It's already an array, just map it
            return result.map(item => ({
              pubkey: item.pubkey,
              account: item.account
            }));
          } else if (result && typeof result === 'object' && 'value' in result) {
            // It's an RpcResponseAndContext, map the value array
            return result.value.map(item => ({
              pubkey: item.pubkey,
              account: item.account
            }));
          } else {
            // Unexpected result format
            logger.warn(`[RPC] Unexpected getProgramAccounts result format: ${JSON.stringify(result)}`);
            return [];
          }
        } catch (secondError) {
          // If even restrictive filters fail, return empty array instead of failing
          logger.error(`[RPC] Failed to fetch accounts even with restrictive filters: ${secondError.message}`);
          return [];
        }
      }

      // For other errors, just re-throw
      throw error;
    }
  });
}

/**
 * Schedule periodic health check for RPC endpoints
 * This helps detect issues early and maintain optimal RPC connection quality
 */
function schedulePeriodicHealthCheck(): void {
  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  setInterval(() => {
    logger.info('[RPC] Running periodic health check for all RPC endpoints');
    startHealthCheck(false);
  }, CHECK_INTERVAL_MS);

  // Additionally schedule stats logging
  const STATS_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
  setInterval(() => {
    logger.info('[RPC] Connection statistics summary:');
    logEndpointHealth();
  }, STATS_INTERVAL_MS);
}

// Initialize on import
initializeConnectionManager();
schedulePeriodicHealthCheck();