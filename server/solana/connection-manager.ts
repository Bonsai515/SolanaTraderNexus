/**
 * Solana Connection Manager
 * 
 * This module manages Solana RPC connections with intelligent
 * fallback, load balancing, and error handling.
 */

import { Connection, Commitment, ConnectionConfig } from '@solana/web3.js';
import * as logger from '../logger';
import { getBestRPCEndpoint, getBestWSEndpoint, markEndpointUnhealthy } from '../config/rpc-config';

// Connection cache
const connectionCache: Map<string, Connection> = new Map();

// Default connection config
const defaultConnectionConfig: ConnectionConfig = {
  commitment: 'confirmed' as Commitment,
  confirmTransactionInitialTimeout: 60000, // 60 seconds
  disableRetryOnRateLimit: false
};

/**
 * Get a connection with specific commitment and usage type
 */
export function getConnection(
  commitment: Commitment = 'confirmed', 
  usageType: 'transactions' | 'queries' | 'all' = 'all'
): Connection {
  try {
    // Check if we have a cached connection
    const cacheKey = `connection-${commitment}-${usageType}`;
    if (connectionCache.has(cacheKey)) {
      return connectionCache.get(cacheKey)!;
    }
    
    // Get the best RPC endpoint for the given usage type
    const endpoint = getBestRPCEndpoint(usageType);
    
    // Create connection
    const config: ConnectionConfig = {
      ...defaultConnectionConfig,
      commitment
    };
    
    const connection = new Connection(endpoint.url, config);
    
    // Cache the connection
    connectionCache.set(cacheKey, connection);
    
    logger.info(`[ConnectionManager] Created new Solana connection with ${commitment} commitment using ${endpoint.name} for ${usageType}`);
    return connection;
  } catch (error) {
    logger.error(`[ConnectionManager] Error creating connection: ${error.message}`);
    
    // Fallback to public endpoint if all else fails
    const fallbackUrl = 'https://api.mainnet-beta.solana.com';
    logger.warn(`[ConnectionManager] Using fallback public endpoint: ${fallbackUrl}`);
    
    const fallbackConnection = new Connection(fallbackUrl, {
      ...defaultConnectionConfig,
      commitment
    });
    
    return fallbackConnection;
  }
}

/**
 * Get a WebSocket connection
 */
export function getWSConnection(): Connection | null {
  try {
    // Check if we have a cached connection
    const cacheKey = 'ws-connection';
    if (connectionCache.has(cacheKey)) {
      return connectionCache.get(cacheKey)!;
    }
    
    // Get the best WebSocket endpoint
    const endpoint = getBestWSEndpoint();
    if (!endpoint || !endpoint.wsUrl) {
      logger.warn('[ConnectionManager] No WebSocket endpoint available');
      return null;
    }
    
    // Create connection
    const connection = new Connection(endpoint.wsUrl, defaultConnectionConfig);
    
    // Cache the connection
    connectionCache.set(cacheKey, connection);
    
    logger.info(`[ConnectionManager] Created new WebSocket connection using ${endpoint.name}`);
    return connection;
  } catch (error) {
    logger.error(`[ConnectionManager] Error creating WebSocket connection: ${error.message}`);
    return null;
  }
}

/**
 * Execute a function with a Solana connection with error handling
 */
export async function withConnection<T>(
  func: (connection: Connection) => Promise<T>,
  commitment: Commitment = 'confirmed',
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      const connection = getConnection(commitment);
      return await func(connection);
    } catch (error) {
      lastError = error;
      retryCount++;
      
      // Check if it's a rate limit error or connection error
      if (
        error.message?.includes('429') ||
        error.message?.includes('Too many requests') ||
        error.message?.includes('rate limit') ||
        error.message?.includes('timeout')
      ) {
        // Get the endpoint URL from the error message if possible
        const urlMatch = error.message.match(/https?:\/\/[^\/\s]+/);
        const endpointUrl = urlMatch ? urlMatch[0] : null;
        
        if (endpointUrl) {
          markEndpointUnhealthy(endpointUrl, error.message);
        }
        
        // Clear the connection cache to force getting a new endpoint
        connectionCache.clear();
        
        logger.warn(`[ConnectionManager] RPC error (retry ${retryCount}/${maxRetries}): ${error.message}`);
        
        // Wait with exponential backoff
        const delayMs = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        // For other errors, just throw
        throw error;
      }
    }
  }
  
  // If we reach here, we've exhausted all retries
  if (lastError) {
    throw lastError;
  }
  
  // This should never happen
  throw new Error('[ConnectionManager] Unknown error in withConnection');
}

/**
 * Clear the connection cache
 */
export function clearConnectionCache(): void {
  connectionCache.clear();
  logger.info('[ConnectionManager] Connection cache cleared');
}

// Export getConnection as default for backward compatibility
export default getConnection;