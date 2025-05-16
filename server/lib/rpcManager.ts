/**
 * Advanced RPC Connection Manager
 * 
 * Provides optimized RPC connection handling with:
 * - Intelligent caching to reduce RPC calls
 * - Load balancing across multiple endpoints
 * - Automatic failover
 * - Performance monitoring
 * - gRPC support for high-performance access
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../logger';

// RPC endpoint configuration
export interface RpcEndpoint {
  url: string;
  weight: number;
  type: 'http' | 'ws' | 'grpc';
  priority: number;
  rateLimit?: {
    maxRequestsPerSecond: number;
    burstSize: number;
  };
}

// RPC endpoints
export const RPC_ENDPOINTS: RpcEndpoint[] = [
  {
    url: 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9',
    weight: 10,
    type: 'http',
    priority: 1,
    rateLimit: {
      maxRequestsPerSecond: 50,
      burstSize: 10
    }
  },
  {
    url: 'https://api.mainnet-beta.solana.com',
    weight: 5,
    type: 'http',
    priority: 2,
    rateLimit: {
      maxRequestsPerSecond: 10,
      burstSize: 5
    }
  },
  {
    url: 'https://solana-api.projectserum.com',
    weight: 3,
    type: 'http',
    priority: 3,
    rateLimit: {
      maxRequestsPerSecond: 5,
      burstSize: 3
    }
  }
];

// gRPC endpoint
export const GRPC_ENDPOINT = 'https://solana-grpc-geyser.instantnodes.io:443';

// Cache settings
const CACHE_TTL = {
  accountInfo: 2000,       // 2 seconds
  balance: 2000,           // 2 seconds
  blockHeight: 1000,       // 1 second
  tokenAccounts: 5000,     // 5 seconds
  transactions: 10000      // 10 seconds
};

// Cache storage
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expires: number;
}

// Caches
const accountInfoCache = new Map<string, CacheEntry<any>>();
const balanceCache = new Map<string, CacheEntry<number>>();
const tokenAccountsCache = new Map<string, CacheEntry<any[]>>();
const blockHeightCache = new Map<string, CacheEntry<number>>();
const transactionCache = new Map<string, CacheEntry<any>>();

// Connection pool
let connectionPool: Connection[] = [];
let currentConnectionIndex = 0;
let isInitialized = false;

// Connection performance metrics
const connectionMetrics = new Map<string, {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalLatency: number;
  lastFailure: number;
}>();

/**
 * Initialize the RPC connection pool
 */
export function initializeRpcManager(): void {
  if (isInitialized) {
    return;
  }
  
  logger.info('[RpcManager] Initializing RPC connection pool');
  
  // Create connections for each endpoint
  RPC_ENDPOINTS.forEach(endpoint => {
    try {
      // Create connection
      const connection = new Connection(endpoint.url, 'confirmed');
      
      // Add to pool with the specified weight
      for (let i = 0; i < endpoint.weight; i++) {
        connectionPool.push(connection);
      }
      
      // Initialize metrics
      connectionMetrics.set(endpoint.url, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalLatency: 0,
        lastFailure: 0
      });
      
      logger.info(`[RpcManager] Added RPC endpoint: ${endpoint.url} (weight: ${endpoint.weight})`);
    } catch (error) {
      logger.error(`[RpcManager] Failed to initialize RPC endpoint ${endpoint.url}: ${error.message}`);
    }
  });
  
  // Connection pool is now initialized
  isInitialized = true;
  logger.info(`[RpcManager] RPC connection pool initialized with ${connectionPool.length} connections`);
  
  // Start health checks
  startHealthChecks();
}

/**
 * Get a connection from the pool using round-robin selection
 * @returns Solana RPC connection
 */
export function getConnection(): Connection {
  if (!isInitialized) {
    initializeRpcManager();
  }
  
  if (connectionPool.length === 0) {
    throw new Error('No RPC connections available');
  }
  
  // Get the next connection
  currentConnectionIndex = (currentConnectionIndex + 1) % connectionPool.length;
  return connectionPool[currentConnectionIndex];
}

/**
 * Get an account's SOL balance with caching
 * @param address Account address
 * @param forceFresh Whether to force a fresh request
 * @returns SOL balance
 */
export async function getCachedBalance(
  address: string | PublicKey,
  forceFresh: boolean = false
): Promise<number> {
  const addressStr = address.toString();
  const now = Date.now();
  
  // Check cache first if not forcing fresh data
  if (!forceFresh) {
    const cached = balanceCache.get(addressStr);
    if (cached && now < cached.expires) {
      return cached.value;
    }
  }
  
  // Get a connection
  const connection = getConnection();
  
  try {
    // Record start time for metrics
    const startTime = performance.now();
    
    // Get balance
    const publicKey = typeof address === 'string' ? new PublicKey(address) : address;
    const balance = await connection.getBalance(publicKey);
    
    // Record metrics
    const endTime = performance.now();
    const latency = endTime - startTime;
    
    const endpoint = connection['_rpcEndpoint'];
    const metrics = connectionMetrics.get(endpoint);
    if (metrics) {
      metrics.totalRequests++;
      metrics.successfulRequests++;
      metrics.totalLatency += latency;
    }
    
    // Cache the result
    balanceCache.set(addressStr, {
      value: balance,
      timestamp: now,
      expires: now + CACHE_TTL.balance
    });
    
    return balance;
  } catch (error) {
    // Record failure
    const endpoint = connection['_rpcEndpoint'];
    const metrics = connectionMetrics.get(endpoint);
    if (metrics) {
      metrics.totalRequests++;
      metrics.failedRequests++;
      metrics.lastFailure = now;
    }
    
    logger.error(`[RpcManager] Failed to get balance for ${addressStr}: ${error.message}`);
    
    // Try to get from cache even if it's expired
    const cached = balanceCache.get(addressStr);
    if (cached) {
      logger.info(`[RpcManager] Using expired cached balance for ${addressStr}`);
      return cached.value;
    }
    
    throw error;
  }
}

/**
 * Get account info with caching
 * @param address Account address
 * @param forceFresh Whether to force a fresh request
 * @returns Account info
 */
export async function getCachedAccountInfo(
  address: string | PublicKey,
  forceFresh: boolean = false
): Promise<any> {
  const addressStr = address.toString();
  const now = Date.now();
  
  // Check cache first if not forcing fresh data
  if (!forceFresh) {
    const cached = accountInfoCache.get(addressStr);
    if (cached && now < cached.expires) {
      return cached.value;
    }
  }
  
  // Get a connection
  const connection = getConnection();
  
  try {
    // Record start time for metrics
    const startTime = performance.now();
    
    // Get account info
    const publicKey = typeof address === 'string' ? new PublicKey(address) : address;
    const accountInfo = await connection.getAccountInfo(publicKey);
    
    // Record metrics
    const endTime = performance.now();
    const latency = endTime - startTime;
    
    const endpoint = connection['_rpcEndpoint'];
    const metrics = connectionMetrics.get(endpoint);
    if (metrics) {
      metrics.totalRequests++;
      metrics.successfulRequests++;
      metrics.totalLatency += latency;
    }
    
    // Cache the result
    accountInfoCache.set(addressStr, {
      value: accountInfo,
      timestamp: now,
      expires: now + CACHE_TTL.accountInfo
    });
    
    return accountInfo;
  } catch (error) {
    // Record failure
    const endpoint = connection['_rpcEndpoint'];
    const metrics = connectionMetrics.get(endpoint);
    if (metrics) {
      metrics.totalRequests++;
      metrics.failedRequests++;
      metrics.lastFailure = now;
    }
    
    logger.error(`[RpcManager] Failed to get account info for ${addressStr}: ${error.message}`);
    
    // Try to get from cache even if it's expired
    const cached = accountInfoCache.get(addressStr);
    if (cached) {
      logger.info(`[RpcManager] Using expired cached account info for ${addressStr}`);
      return cached.value;
    }
    
    throw error;
  }
}

/**
 * Get token accounts with caching
 * @param owner Owner address
 * @param forceFresh Whether to force a fresh request
 * @returns Token accounts
 */
export async function getCachedTokenAccounts(
  owner: string | PublicKey,
  forceFresh: boolean = false
): Promise<any[]> {
  const ownerStr = owner.toString();
  const now = Date.now();
  
  // Check cache first if not forcing fresh data
  if (!forceFresh) {
    const cached = tokenAccountsCache.get(ownerStr);
    if (cached && now < cached.expires) {
      return cached.value;
    }
  }
  
  // Get a connection
  const connection = getConnection();
  
  try {
    // Record start time for metrics
    const startTime = performance.now();
    
    // Get token accounts
    const publicKey = typeof owner === 'string' ? new PublicKey(owner) : owner;
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    });
    
    // Record metrics
    const endTime = performance.now();
    const latency = endTime - startTime;
    
    const endpoint = connection['_rpcEndpoint'];
    const metrics = connectionMetrics.get(endpoint);
    if (metrics) {
      metrics.totalRequests++;
      metrics.successfulRequests++;
      metrics.totalLatency += latency;
    }
    
    // Cache the result
    tokenAccountsCache.set(ownerStr, {
      value: tokenAccounts.value,
      timestamp: now,
      expires: now + CACHE_TTL.tokenAccounts
    });
    
    return tokenAccounts.value;
  } catch (error) {
    // Record failure
    const endpoint = connection['_rpcEndpoint'];
    const metrics = connectionMetrics.get(endpoint);
    if (metrics) {
      metrics.totalRequests++;
      metrics.failedRequests++;
      metrics.lastFailure = now;
    }
    
    logger.error(`[RpcManager] Failed to get token accounts for ${ownerStr}: ${error.message}`);
    
    // Try to get from cache even if it's expired
    const cached = tokenAccountsCache.get(ownerStr);
    if (cached) {
      logger.info(`[RpcManager] Using expired cached token accounts for ${ownerStr}`);
      return cached.value;
    }
    
    throw error;
  }
}

/**
 * Start periodic health checks of RPC endpoints
 */
function startHealthChecks(): void {
  const HEALTH_CHECK_INTERVAL = 60000; // 1 minute
  
  setInterval(async () => {
    logger.debug('[RpcManager] Running RPC endpoint health checks');
    
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const connection = new Connection(endpoint.url, 'confirmed');
        const startTime = performance.now();
        
        // Simple health check - get the latest blockhash
        const blockhash = await connection.getLatestBlockhash();
        
        const endTime = performance.now();
        const latency = endTime - startTime;
        
        // Update metrics
        const metrics = connectionMetrics.get(endpoint.url);
        if (metrics) {
          metrics.totalRequests++;
          metrics.successfulRequests++;
          metrics.totalLatency += latency;
        }
        
        logger.debug(`[RpcManager] Health check passed for ${endpoint.url} (latency: ${latency.toFixed(2)}ms)`);
      } catch (error) {
        // Update metrics
        const metrics = connectionMetrics.get(endpoint.url);
        if (metrics) {
          metrics.totalRequests++;
          metrics.failedRequests++;
          metrics.lastFailure = Date.now();
        }
        
        logger.warn(`[RpcManager] Health check failed for ${endpoint.url}: ${error.message}`);
      }
    }
    
    // Rebuild connection pool based on health
    rebuildConnectionPool();
  }, HEALTH_CHECK_INTERVAL);
  
  logger.info('[RpcManager] RPC health checks scheduled');
}

/**
 * Rebuild the connection pool based on health status
 */
function rebuildConnectionPool(): void {
  // Clear the current pool
  connectionPool = [];
  
  // Sort endpoints by priority and health
  const sortedEndpoints = [...RPC_ENDPOINTS].sort((a, b) => {
    // First sort by priority
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    
    // Then by health
    const aMetrics = connectionMetrics.get(a.url);
    const bMetrics = connectionMetrics.get(b.url);
    
    if (!aMetrics || !bMetrics) {
      return 0;
    }
    
    // Calculate success rate
    const aSuccessRate = aMetrics.totalRequests > 0 ? aMetrics.successfulRequests / aMetrics.totalRequests : 0;
    const bSuccessRate = bMetrics.totalRequests > 0 ? bMetrics.successfulRequests / bMetrics.totalRequests : 0;
    
    // Sort by success rate (high to low)
    return bSuccessRate - aSuccessRate;
  });
  
  // Rebuild the pool
  for (const endpoint of sortedEndpoints) {
    try {
      const metrics = connectionMetrics.get(endpoint.url);
      
      // Skip endpoints with recent failures
      if (metrics && metrics.lastFailure > Date.now() - 30000 && metrics.failedRequests > 5) {
        logger.warn(`[RpcManager] Skipping recently failed endpoint: ${endpoint.url}`);
        continue;
      }
      
      // Create connection
      const connection = new Connection(endpoint.url, 'confirmed');
      
      // Adjust weight based on health
      let effectiveWeight = endpoint.weight;
      
      if (metrics && metrics.totalRequests > 10) {
        const successRate = metrics.successfulRequests / metrics.totalRequests;
        
        // Boost weight for high success rate
        if (successRate > 0.98) {
          effectiveWeight *= 1.5;
        } 
        // Reduce weight for low success rate
        else if (successRate < 0.9) {
          effectiveWeight *= 0.5;
        }
        
        // Cap weight
        effectiveWeight = Math.min(20, Math.max(1, effectiveWeight));
      }
      
      // Add to pool with the effective weight
      for (let i = 0; i < effectiveWeight; i++) {
        connectionPool.push(connection);
      }
      
      logger.debug(`[RpcManager] Added ${endpoint.url} to pool with weight ${effectiveWeight}`);
    } catch (error) {
      logger.error(`[RpcManager] Failed to add endpoint ${endpoint.url} to pool: ${error.message}`);
    }
  }
  
  logger.info(`[RpcManager] Rebuilt connection pool with ${connectionPool.length} connections`);
}

/**
 * Get performance metrics for all endpoints
 */
export function getPerformanceMetrics(): any {
  const result = {};
  
  for (const [url, metrics] of connectionMetrics.entries()) {
    const totalRequests = metrics.totalRequests;
    const successRate = totalRequests > 0 ? (metrics.successfulRequests / totalRequests) * 100 : 0;
    const avgLatency = metrics.successfulRequests > 0 ? metrics.totalLatency / metrics.successfulRequests : 0;
    
    result[url] = {
      totalRequests,
      successfulRequests: metrics.successfulRequests,
      failedRequests: metrics.failedRequests,
      successRate: successRate.toFixed(2) + '%',
      avgLatency: avgLatency.toFixed(2) + 'ms',
      lastFailure: metrics.lastFailure > 0 ? new Date(metrics.lastFailure).toISOString() : 'never'
    };
  }
  
  return result;
}

/**
 * Get the current cache stats
 */
export function getCacheStats(): any {
  return {
    accountInfo: {
      size: accountInfoCache.size,
      hitRate: '---'
    },
    balance: {
      size: balanceCache.size,
      hitRate: '---'
    },
    tokenAccounts: {
      size: tokenAccountsCache.size,
      hitRate: '---'
    },
    blockHeight: {
      size: blockHeightCache.size,
      hitRate: '---'
    },
    transaction: {
      size: transactionCache.size,
      hitRate: '---'
    }
  };
}