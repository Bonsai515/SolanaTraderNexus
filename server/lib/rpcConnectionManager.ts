/**
 * RPC Connection Manager
 * 
 * This module provides optimized RPC connection management with rate limit handling,
 * load balancing, and automatic failover for Solana transactions.
 */

import { Connection, ConnectionConfig } from '@solana/web3.js';
import * as logger from '../logger';
import { withRateLimiting } from './rpcRateLimiter';

// Available RPC endpoints with priority order (most reliable first)
const PRIMARY_ENDPOINT = process.env.INSTANT_NODES_RPC_URL;

if (!PRIMARY_ENDPOINT) {
  logger.error('CRITICAL: INSTANT_NODES_RPC_URL is not set in environment');
}

// Define RPC endpoints with primary endpoint first for prioritization
const RPC_ENDPOINTS = [
  PRIMARY_ENDPOINT || 'https://api.mainnet-beta.solana.com',
  process.env.HELIUS_API_KEY ? `https://rpc.helius.xyz/?api-key=${process.env.HELIUS_API_KEY}` : null,
  process.env.ALCHEMY_RPC_URL || null
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
  
  // Create connections
  for (const url of RPC_ENDPOINTS) {
    try {
      const connection = new Connection(url, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000
      });
      
      connectionPool.push(connection);
      logger.info(`[RPC] Added connection: ${url}`);
    } catch (error) {
      logger.error(`[RPC] Failed to create connection for ${url}:`, error);
    }
  }
  
  if (connectionPool.length === 0) {
    logger.error('[RPC] No connections available. Using fallback connection.');
    const fallbackConnection = new Connection('https://api.mainnet-beta.solana.com', {
      commitment: 'confirmed'
    });
    connectionPool.push(fallbackConnection);
  }
  
  // Start health check
  startHealthCheck();
  
  isConnectionManagerInitialized = true;
  logger.info(`[RPC] Connection manager initialized with ${connectionPool.length} endpoints`);
}

/**
 * Start health check for all RPC endpoints
 */
function startHealthCheck() {
  // Run health check every 60 seconds
  setInterval(async () => {
    for (const connection of connectionPool) {
      const url = connection.rpcEndpoint;
      
      try {
        const startTime = Date.now();
        // Simple health check - just request the latest block height
        const result = await connection.getBlockHeight();
        const endTime = Date.now();
        const latency = endTime - startTime;
        const isHealthy = result > 0;
        
        const health = endpointHealth.get(url);
        if (health) {
          health.healthy = isHealthy ? true : false;
          health.latency = latency;
          health.lastChecked = Date.now();
          health.failCount = 0;
          health.successRate = 1.0;
          
          endpointHealth.set(url, health);
        }
        
        logger.debug(`[RPC] Health check for ${url}: ${result}, latency: ${latency}ms`);
      } catch (error) {
        const health = endpointHealth.get(url);
        if (health) {
          health.healthy = false;
          health.lastChecked = Date.now();
          health.failCount += 1;
          health.successRate = Math.max(0, health.successRate - 0.2);
          
          endpointHealth.set(url, health);
          logger.warn(`[RPC] Health check failed for ${url}: ${error}`);
        }
      }
    }
    
    // Log overall health
    logger.debug('[RPC] Endpoint health:', Array.from(endpointHealth.values()));
  }, 60000);
}

/**
 * Get a managed connection with optimized settings
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
  
  // Find the best connection
  let bestConnectionIndex = 0;
  let bestRating = -1;
  
  for (let i = 0; i < connectionPool.length; i++) {
    const connection = connectionPool[i];
    const health = endpointHealth.get(connection.rpcEndpoint);
    
    if (health && health.healthy) {
      // Simple rating based on latency and success rate
      const rating = health.successRate * (1000 / (health.latency + 10));
      
      if (rating > bestRating) {
        bestRating = rating;
        bestConnectionIndex = i;
      }
    }
  }
  
  // Update current index
  currentConnectionIndex = bestConnectionIndex;
  
  return connectionPool[currentConnectionIndex];
}

/**
 * Get the next connection in the pool
 */
function getNextConnection(): Connection {
  if (!isConnectionManagerInitialized) {
    initializeConnectionManager();
  }
  
  // Increment index
  currentConnectionIndex = (currentConnectionIndex + 1) % connectionPool.length;
  
  // Skip unhealthy connections
  let attempts = 0;
  while (attempts < connectionPool.length) {
    const connection = connectionPool[currentConnectionIndex];
    const health = endpointHealth.get(connection.rpcEndpoint);
    
    if (health && health.healthy) {
      return connection;
    }
    
    currentConnectionIndex = (currentConnectionIndex + 1) % connectionPool.length;
    attempts++;
  }
  
  // If all unhealthy, return the first connection
  return connectionPool[0];
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
    
    try {
      // Execute the function with rate limiting
      return await withRateLimiting(async () => {
        return await fn(connection);
      });
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
  const connection = getManagedConnection();
  return executeWithRpcLoadBalancing(async (conn) => {
    return await conn.getBalance(publicKey);
  });
}

/**
 * Get account info from on-chain program
 */
export async function getAccountInfo(publicKey: PublicKey, commitment?: string): Promise<any> {
  return executeWithRpcLoadBalancing(async (connection) => {
    return await connection.getAccountInfo(publicKey, commitment);
  });
}

/**
 * Get program accounts for on-chain program data
 */
export async function getProgramAccounts(programId: PublicKey, filters?: any): Promise<any[]> {
  return executeWithRpcLoadBalancing(async (connection) => {
    return await connection.getProgramAccounts(programId, filters);
  });
}

// Initialize on import
initializeConnectionManager();