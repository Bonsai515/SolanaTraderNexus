/**
 * RPC Connection Manager
 * 
 * Handles Solana RPC connections with intelligent fallback, rate limiting,
 * and automatic error recovery. This is a critical component for ensuring
 * reliable operation even during periods of high API load.
 */

import { Connection, Keypair, PublicKey, Transaction, SendOptions } from '@solana/web3.js';
import * as logger from '../logger';
import { executeWithRateLimit } from './rateLimitHandler';

// RPC endpoints configuration
type RpcEndpointKey = 'helius' | 'alchemy' | 'instantnodes' | 'public';

interface RpcEndpoint {
  url: string;
  priority: number;
  maxRequestsPerMinute: number;
  websocketSupport: boolean;
}

// Track connection status for each endpoint
const connectionStatus: Record<string, {
  lastUsed: number;
  failureCount: number;
  coolingDown: boolean;
  coolingUntil?: number;
}> = {};

// Get RPC URLs from environment variables
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SOLANA_RPC_API_KEY = process.env.SOLANA_RPC_API_KEY;
const INSTANT_NODES_RPC_URL = process.env.INSTANT_NODES_RPC_URL;
const ALCHEMY_RPC_URL = `https://solana-mainnet.g.alchemy.com/v2/${SOLANA_RPC_API_KEY || ''}`;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY || ''}`;

// Validate URL formatting
const validateRpcUrl = (url?: string, defaultUrl: string = 'https://api.mainnet-beta.solana.com'): string => {
  if (!url) return defaultUrl;
  
  try {
    // Ensure URL has proper prefix
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    } else {
      return `https://${url}`;
    }
  } catch (error) {
    logger.error(`Invalid RPC URL format: ${error}`);
    return defaultUrl;
  }
};

// Configure the RPC endpoints
const RPC_ENDPOINTS: Record<RpcEndpointKey, RpcEndpoint> = {
  helius: {
    url: HELIUS_API_KEY ? validateRpcUrl(HELIUS_RPC_URL) : validateRpcUrl(),
    priority: 1,
    maxRequestsPerMinute: 100,
    websocketSupport: false
  },
  instantnodes: {
    url: validateRpcUrl(INSTANT_NODES_RPC_URL),
    priority: 2,
    maxRequestsPerMinute: 120,
    websocketSupport: true
  },
  alchemy: {
    url: SOLANA_RPC_API_KEY ? validateRpcUrl(ALCHEMY_RPC_URL) : validateRpcUrl(),
    priority: 3,
    maxRequestsPerMinute: 100,
    websocketSupport: true
  },
  public: {
    url: 'https://api.mainnet-beta.solana.com',
    priority: 4,
    maxRequestsPerMinute: 10, // Very low limit for public endpoint
    websocketSupport: false
  }
};

// Current connection instances
let currentConnection: Connection | null = null;
let currentEndpointKey: RpcEndpointKey | null = null;
let backupConnections: Connection[] = [];

/**
 * Initialize all RPC connections
 */
export function initializeRpcConnections(): void {
  logger.info('Initializing RPC connections');
  
  // Clear existing connections
  currentConnection = null;
  backupConnections = [];
  
  // Find available endpoints
  const availableEndpoints: Array<[RpcEndpointKey, RpcEndpoint]> = Object.entries(RPC_ENDPOINTS)
    .filter(([_, endpoint]) => endpoint.url && endpoint.url.length > 10)
    .sort((a, b) => a[1].priority - b[1].priority) as Array<[RpcEndpointKey, RpcEndpoint]>;
  
  if (availableEndpoints.length === 0) {
    logger.error('No valid RPC endpoints found. Configure at least one RPC endpoint.');
    throw new Error('No valid RPC endpoints available');
  }
  
  // Set primary connection to the highest priority available endpoint
  const [primaryKey, primaryEndpoint] = availableEndpoints[0];
  currentEndpointKey = primaryKey;
  currentConnection = new Connection(primaryEndpoint.url, 'confirmed');
  
  // Initialize connection status
  connectionStatus[primaryKey] = {
    lastUsed: Date.now(),
    failureCount: 0,
    coolingDown: false
  };
  
  logger.info(`Primary RPC connection set to ${primaryKey}`);
  
  // Set up backup connections
  for (let i = 1; i < availableEndpoints.length; i++) {
    const [key, endpoint] = availableEndpoints[i];
    backupConnections.push(new Connection(endpoint.url, 'confirmed'));
    
    // Initialize connection status
    connectionStatus[key] = {
      lastUsed: 0, // Not used yet
      failureCount: 0,
      coolingDown: false
    };
    
    logger.info(`Backup RPC connection added: ${key}`);
  }
}

/**
 * Get the current RPC connection with fallback capability
 */
export function getRpcConnection(): Connection {
  if (!currentConnection) {
    initializeRpcConnections();
  }
  
  return currentConnection!;
}

/**
 * Get the WebSocket URL for the current connection if available
 */
export function getWebSocketUrl(): string | null {
  if (!currentEndpointKey) {
    return null;
  }
  
  const endpoint = RPC_ENDPOINTS[currentEndpointKey];
  
  if (!endpoint.websocketSupport) {
    return null;
  }
  
  // For instantnodes, use their special websocket URL
  if (currentEndpointKey === 'instantnodes' && INSTANT_NODES_RPC_URL) {
    return INSTANT_NODES_RPC_URL.replace('https://', 'wss://');
  }
  
  // For alchemy, convert the http URL to websocket
  if (currentEndpointKey === 'alchemy' && SOLANA_RPC_API_KEY) {
    return ALCHEMY_RPC_URL.replace('https://', 'wss://');
  }
  
  return null;
}

/**
 * Execute an RPC request with automatic retries and rate limiting
 */
export async function executeRpcRequest<T>(
  requestName: string,
  requestFn: (connection: Connection) => Promise<T>
): Promise<T> {
  // Handle the case where we haven't initialized yet
  if (!currentConnection) {
    initializeRpcConnections();
  }
  
  // Ensure we have a connection to work with
  if (!currentConnection || !currentEndpointKey) {
    throw new Error('RPC connection not initialized');
  }
  
  // Set up the RPC endpoint information for rate limiting
  const endpointKey = currentEndpointKey;
  const endpoint = RPC_ENDPOINTS[endpointKey];
  
  try {
    return await executeWithRateLimit(
      {
        name: `rpc:${endpointKey}:${requestName}`,
        maxRetries: 5,
        initialDelay: 500,
        maxDelay: 10000,
        delayFactor: 2
      },
      async () => {
        try {
          // Mark this endpoint as recently used
          connectionStatus[endpointKey].lastUsed = Date.now();
          
          // Execute the request
          return await requestFn(currentConnection!);
        } catch (error: any) {
          // Handle different error types
          if (error.message?.includes('429') || error.message?.includes('Too many requests')) {
            logger.warn(`Rate limit hit on ${endpointKey} RPC endpoint`);
            connectionStatus[endpointKey].failureCount++;
            
            // If we've had multiple failures, try switching endpoints
            if (connectionStatus[endpointKey].failureCount >= 3) {
              await switchToNextEndpoint();
            }
            
            throw error; // Rethrow to let the rate limiter handle it
          } else if (
            error.message?.includes('ECONNREFUSED') || 
            error.message?.includes('ETIMEDOUT') ||
            error.message?.includes('ENOTFOUND')
          ) {
            // Connection issues - try switching endpoints immediately
            logger.error(`Connection error with ${endpointKey} RPC endpoint: ${error.message}`);
            await switchToNextEndpoint();
            throw error;
          } else {
            // Other errors - might need to switch endpoints
            logger.error(`RPC error with ${endpointKey} endpoint: ${error.message}`);
            connectionStatus[endpointKey].failureCount++;
            
            if (connectionStatus[endpointKey].failureCount >= 3) {
              await switchToNextEndpoint();
            }
            
            throw error;
          }
        }
      }
    );
  } catch (error: any) {
    // If we've exhausted all retries, try with a backup connection
    logger.error(`Failed to execute ${requestName} after multiple retries: ${error.message}`);
    
    // If we have backup connections, try using one of them
    if (backupConnections.length > 0) {
      // Find an available backup that isn't cooling down
      const availableEndpoints = Object.entries(RPC_ENDPOINTS)
        .filter(([key, _]) => 
          key !== currentEndpointKey && 
          !connectionStatus[key]?.coolingDown &&
          RPC_ENDPOINTS[key as RpcEndpointKey].url
        )
        .sort((a, b) => a[1].priority - b[1].priority);
      
      if (availableEndpoints.length > 0) {
        const [backupKey, backupEndpoint] = availableEndpoints[0];
        logger.info(`Trying backup endpoint ${backupKey} for request ${requestName}`);
        
        const backupConnection = new Connection(backupEndpoint.url, 'confirmed');
        try {
          return await requestFn(backupConnection);
        } catch (backupError: any) {
          logger.error(`Backup request also failed: ${backupError.message}`);
          throw backupError;
        }
      }
    }
    
    // If we reach here, all options have failed
    throw new Error(`All RPC endpoints failed for request ${requestName}: ${error.message}`);
  }
}

/**
 * Switch to the next available RPC endpoint
 */
async function switchToNextEndpoint(): Promise<boolean> {
  if (!currentEndpointKey) {
    return false;
  }
  
  // Mark the current endpoint as cooling down
  connectionStatus[currentEndpointKey].coolingDown = true;
  connectionStatus[currentEndpointKey].coolingUntil = Date.now() + 60000; // 1 minute cooldown
  
  // Find the next best endpoint that isn't cooling down
  const availableEndpoints = Object.entries(RPC_ENDPOINTS)
    .filter(([key, endpoint]) => 
      endpoint.url && 
      endpoint.url.length > 10 && 
      key !== currentEndpointKey && 
      !connectionStatus[key]?.coolingDown
    )
    .sort((a, b) => a[1].priority - b[1].priority);
  
  if (availableEndpoints.length === 0) {
    logger.error('No available RPC endpoints to switch to, keeping current endpoint');
    // Reset the cooling status of the current endpoint
    connectionStatus[currentEndpointKey].coolingDown = false;
    return false;
  }
  
  // Get the best available endpoint
  const [newKey, newEndpoint] = availableEndpoints[0] as [RpcEndpointKey, RpcEndpoint];
  
  logger.info(`Switching RPC endpoint from ${currentEndpointKey} to ${newKey}`);
  
  // Create a new connection with the new endpoint
  try {
    const newConnection = new Connection(newEndpoint.url, 'confirmed');
    
    // Test the connection
    await newConnection.getVersion();
    
    // If successful, update the current connection
    currentConnection = newConnection;
    currentEndpointKey = newKey;
    
    // Reset the failure count for the new endpoint
    connectionStatus[newKey] = {
      lastUsed: Date.now(),
      failureCount: 0,
      coolingDown: false
    };
    
    logger.info(`Successfully switched to ${newKey} RPC endpoint`);
    
    // Schedule the current endpoint to be taken off cooldown after 1 minute
    setTimeout(() => {
      if (connectionStatus[currentEndpointKey!]) {
        connectionStatus[currentEndpointKey!].coolingDown = false;
        connectionStatus[currentEndpointKey!].failureCount = 0;
        logger.info(`${currentEndpointKey} RPC endpoint cooldown period ended`);
      }
    }, 60000);
    
    return true;
  } catch (error) {
    logger.error(`Failed to switch to ${newKey} RPC endpoint: ${error}`);
    return false;
  }
}

/**
 * Send a transaction with automatic retries and fallbacks
 */
export async function sendTransaction(
  transaction: Transaction,
  signers: Keypair[],
  options?: SendOptions
): Promise<string> {
  return await executeRpcRequest('sendTransaction', async (connection) => {
    return await connection.sendTransaction(transaction, signers, options);
  });
}

/**
 * Confirm a transaction with automatic retries and fallbacks
 */
export async function confirmTransaction(signature: string): Promise<boolean> {
  return await executeRpcRequest('confirmTransaction', async (connection) => {
    const result = await connection.confirmTransaction(signature);
    return result.value.err === null;
  });
}

/**
 * Get the balance of a public key with automatic retries and fallbacks
 */
export async function getBalance(publicKey: PublicKey): Promise<number> {
  return await executeRpcRequest('getBalance', async (connection) => {
    return await connection.getBalance(publicKey);
  });
}

// Initialize the connections when this module is imported
initializeRpcConnections();