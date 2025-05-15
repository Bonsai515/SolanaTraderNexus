/**
 * Ensure RPC Connection to Solana
 *
 * This module ensures a stable and reliable connection to Solana RPC nodes,
 * with automatic fallback and connection verification.
 */

import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import * as logger from '../logger';

type EndpointKey = 'instantNodes' | 'alchemy' | 'helius' | 'fallback1' | 'fallback2' | 'fallback3';

// Validate URL formatting with enhanced error handling
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

// Set of backup RPC endpoints with validation and priority order
const RPC_ENDPOINTS: Record<EndpointKey, string> = {
  // Primary connection - Instant Nodes premium endpoint (4M daily limit)
  instantNodes: process.env.INSTANT_NODES_RPC_URL ? 
    // Use the correct URL format for Instant Nodes
    `https://solana-api.instantnodes.io/token-${process.env.INSTANT_NODES_RPC_URL}` : 
    'https://api.mainnet-beta.solana.com',
  // Secondary connection - Alchemy endpoint
  alchemy: validateRpcUrl(process.env.ALCHEMY_RPC_URL, 'https://api.mainnet-beta.solana.com'),
  // Tertiary connection - Helius (if API key available)
  helius: process.env.HELIUS_API_KEY ?
    validateRpcUrl(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`) :
    'https://api.mainnet-beta.solana.com',
  // Additional fallbacks in case all premium endpoints fail
  fallback1: 'https://solana-api.projectserum.com',
  fallback2: 'https://rpc.ankr.com/solana',
  fallback3: clusterApiUrl('mainnet-beta')
};

// Track connection status
let currentEndpoint: EndpointKey = 'instantNodes';
let connectionActive = false;
let lastConnectionCheck = 0;
let lastRateLimitHit = 0;
let rateLimitBackoffMs = 1000; // Start with 1 second, will increase exponentially
let connectionFailures: Record<EndpointKey, number> = {
  instantNodes: 0,
  alchemy: 0,
  helius: 0,
  fallback1: 0,
  fallback2: 0,
  fallback3: 0
};

// Track endpoints that have hit rate limits so we can avoid them temporarily
let rateLimitedEndpoints: Record<EndpointKey, number> = {
  instantNodes: 0,
  alchemy: 0,
  helius: 0,
  fallback1: 0,
  fallback2: 0,
  fallback3: 0
};

// Main connection instance
let solanaConnection: Connection | null = null;

/**
 * Initialize and verify Solana RPC connection
 */
export async function initializeRpcConnection(): Promise<Connection> {
  logger.info('Initializing Solana RPC connection with auto-fallback...');

  // We'll try each endpoint in sequence, prioritizing Instant Nodes (with WebSocket support)
  // followed by Helius which has been consistently working
  const endpointsToTry: EndpointKey[] = ['instantNodes', 'helius', 'fallback1', 'fallback2', 'fallback3', 'alchemy'];
  
  for (const endpoint of endpointsToTry) {
    try {
      logger.info(`Attempting to connect to ${endpoint} RPC endpoint...`);
      
      // Create connection with proper exponential backoff for rate limits
      const endpoint_url = RPC_ENDPOINTS[endpoint];
      const wsEndpoint = endpoint === 'instantNodes' 
        ? `wss://solana-api.instantnodes.io/token-${process.env.INSTANT_NODES_RPC_URL}`
        : undefined;
      
      solanaConnection = new Connection(endpoint_url, {
        commitment: 'confirmed',
        disableRetryOnRateLimit: false, // Enable automatic retry with exponential backoff
        confirmTransactionInitialTimeout: 60000,
        wsEndpoint: wsEndpoint, // Use WebSocket for Instant Nodes if available
        httpHeaders: endpoint === 'helius' ? {
          // Add headers to increase rate limit allowance and identify our service
          'x-client-name': 'Hyperion-Trading-System',
          'x-client-version': '1.0.0'
        } : undefined
      });

      // Test the connection
      const blockchainInfo = await solanaConnection.getVersion();
      logger.info(`✅ Connected to ${endpoint} RPC endpoint (Solana version ${blockchainInfo['solana-core']}))`);
      connectionActive = true;
      lastConnectionCheck = Date.now();
      currentEndpoint = endpoint;
      
      // Start connection monitoring
      startConnectionMonitoring();
      return solanaConnection;
    } catch (error: any) {
      logger.warn(`Failed to connect to ${endpoint} RPC: ${error.message || String(error)}`);
      connectionFailures[endpoint]++;
      // Continue to next endpoint
    }
  }
  
  // If we get here, all endpoints failed
  logger.error('Failed to connect to any RPC endpoint, falling back to public RPC');
  
  // Create a connection with the public endpoint as a last resort
  solanaConnection = new Connection(clusterApiUrl('mainnet-beta'), {
    commitment: 'confirmed',
    disableRetryOnRateLimit: true
  });
  
  currentEndpoint = 'fallback3';
  connectionActive = true;
  lastConnectionCheck = Date.now();
  
  // Start monitoring anyway
  startConnectionMonitoring();
  return solanaConnection;
}

/**
 * Switch to a fallback RPC if primary fails
 */
/**
 * Switch to fallback RPC endpoint if current is failing
 * @param isRateLimited Boolean indicating if the switch is due to rate limiting
 * @returns Connection to a fallback RPC
 */
async function switchToFallbackRpc(isRateLimited: boolean = false): Promise<Connection> {
  // Update rate limit tracking if applicable
  if (isRateLimited) {
    // Mark current endpoint as rate limited
    const now = Date.now();
    rateLimitedEndpoints[currentEndpoint] = now;
    lastRateLimitHit = now;
    
    // Increase backoff exponentially
    rateLimitBackoffMs = Math.min(rateLimitBackoffMs * 2, 30000); // Max 30 seconds
    logger.warn(`Rate limit hit for ${currentEndpoint}. Backoff increased to ${rateLimitBackoffMs}ms`);
  }

  const endpoints = Object.keys(RPC_ENDPOINTS) as EndpointKey[];
  const now = Date.now();
  
  // Filter out rate-limited endpoints
  const eligibleEndpoints = endpoints.filter(endpoint => {
    // Skip current endpoint
    if (endpoint === currentEndpoint) return false;
    
    // Skip endpoints that hit rate limits in the last minute
    const rateLimitTime = rateLimitedEndpoints[endpoint];
    if (rateLimitTime > 0 && now - rateLimitTime < 60000) return false;
    
    return true;
  });
  
  // Sort by failure count (prioritize least failed)
  const sortedEndpoints = eligibleEndpoints.length > 0 
    ? eligibleEndpoints.sort((a, b) => (connectionFailures[a] || 0) - (connectionFailures[b] || 0))
    : endpoints.sort((a, b) => (connectionFailures[a] || 0) - (connectionFailures[b] || 0));
  
  const currentKey = currentEndpoint;
  const nextEndpoint = sortedEndpoints.find(ep => ep !== currentKey) || 'fallback3';
  
  logger.info(`Switching from ${currentEndpoint} to ${nextEndpoint} RPC endpoint`);
  currentEndpoint = nextEndpoint;
  
  const endpoint = RPC_ENDPOINTS[nextEndpoint];
  const wsEndpoint = nextEndpoint === 'instantNodes' 
    ? `wss://solana-api.instantnodes.io/token-${process.env.INSTANT_NODES_RPC_URL}`
    : undefined;
  
  // Add randomized request ID to avoid cache issues
  const requestId = Math.random().toString(36).substring(2, 15);
  
  // Add custom headers to help with rate limits
  const httpHeaders: Record<string, string> = {
    'x-request-id': requestId,
    'x-client-name': 'Hyperion-Trading-System',
    'x-client-version': '1.0.0'
  };
  
  // Create connection with proper configuration
  solanaConnection = new Connection(endpoint, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: false,
    confirmTransactionInitialTimeout: 60000,
    wsEndpoint: wsEndpoint, // Use WebSocket for Instant Nodes if available
    httpHeaders
  });
  
  try {
    // Test connection with a lightweight call
    const blockchainInfo = await solanaConnection.getVersion();
    connectionActive = true;
    lastConnectionCheck = Date.now();
    
    // Reset rate limit status if previously rate limited
    if (rateLimitedEndpoints[nextEndpoint] > 0) {
      rateLimitedEndpoints[nextEndpoint] = 0;
    }
    
    logger.info(`✅ Successfully switched to ${nextEndpoint} RPC endpoint (Solana version ${blockchainInfo['solana-core']})`);
    return solanaConnection;
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    connectionFailures[nextEndpoint]++;
    
    // Check if it's a rate limit error
    if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
      logger.warn(`Rate limit hit when trying fallback ${nextEndpoint}. Marking as rate limited.`);
      rateLimitedEndpoints[nextEndpoint] = now;
      
      // Wait a bit before trying the next endpoint to avoid cascading failures
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try another one recursively with rate limit flag
      return switchToFallbackRpc(true);
    } else {
      logger.error(`Failed to connect to ${nextEndpoint} RPC: ${errorMessage}`);
      
      // Try another one recursively
      return switchToFallbackRpc(false);
    }
  }
}

/**
 * Start monitoring the RPC connection
 */
function startConnectionMonitoring(): void {
  setInterval(async () => {
    const now = Date.now();
    if (now - lastConnectionCheck < 30000) return;
    
    lastConnectionCheck = now;
    
    try {
      if (solanaConnection) {
        await solanaConnection.getLatestBlockhash();
        connectionActive = true;
      } else {
        throw new Error('Connection object is null');
      }
    } catch (error: any) {
      logger.warn(`RPC connection check failed for ${currentEndpoint}: ${error.message || String(error)}`);
      connectionActive = false;
      connectionFailures[currentEndpoint]++;
      
      // Switch to fallback
      await switchToFallbackRpc();
    }
  }, 5000); // Check every 5 seconds
}

/**
 * Get current Solana connection
 */
export function getSolanaConnection(): Connection {
  if (!solanaConnection) {
    // Create on demand if not exists
    const endpointKey = currentEndpoint;
    const endpoint = RPC_ENDPOINTS[endpointKey] || 'https://api.mainnet-beta.solana.com';
    const wsEndpoint = endpointKey === 'instantNodes' 
      ? `wss://solana-api.instantnodes.io/token-${process.env.INSTANT_NODES_RPC_URL}`
      : undefined;
    
    solanaConnection = new Connection(endpoint, {
      commitment: 'confirmed',
      disableRetryOnRateLimit: false,
      wsEndpoint: wsEndpoint // Use WebSocket for Instant Nodes if available
    });
    
    // Start monitoring if not already
    if (!connectionActive) {
      startConnectionMonitoring();
    }
  }
  
  return solanaConnection;
}

/**
 * Check if wallet exists and has SOL
 */
export async function verifyWalletConnection(walletAddress: string): Promise<boolean> {
  try {
    const connection = getSolanaConnection();
    const pubkey = new PublicKey(walletAddress);
    
    const accountInfo = await connection.getAccountInfo(pubkey);
    const balance = await connection.getBalance(pubkey);
    
    logger.info(`Wallet ${walletAddress.substring(0, 10)}... has ${balance / 1e9} SOL`);
    return accountInfo !== null && balance > 0;
  } catch (error: any) {
    logger.error(`Failed to verify wallet ${walletAddress}: ${error.message || String(error)}`);
    return false;
  }
}

// Initialize on module load
initializeRpcConnection().catch(err => {
  logger.error(`Failed to initialize any Solana RPC connection: ${err}`);
});