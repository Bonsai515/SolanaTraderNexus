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
  instantNodes: validateRpcUrl(process.env.INSTANT_NODES_RPC_URL, 'https://api.mainnet-beta.solana.com'),
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
let connectionFailures: Record<EndpointKey, number> = {
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

  // We'll try each endpoint in sequence, starting with Helius which has been more reliable
  // in our logs than Instant Nodes (which is hitting rate limits)
  const endpointsToTry: EndpointKey[] = ['helius', 'instantNodes', 'alchemy', 'fallback1', 'fallback2', 'fallback3'];
  
  for (const endpoint of endpointsToTry) {
    try {
      logger.info(`Attempting to connect to ${endpoint} RPC endpoint...`);
      
      // Create connection with proper retry backoff
      solanaConnection = new Connection(RPC_ENDPOINTS[endpoint], {
        commitment: 'confirmed',
        disableRetryOnRateLimit: true, // Changed to true to enable automatic retry
        confirmTransactionInitialTimeout: 60000
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
async function switchToFallbackRpc(): Promise<Connection> {
  const endpoints = Object.keys(RPC_ENDPOINTS) as EndpointKey[];
  
  // Sort by failure count (prioritize least failed)
  const sortedEndpoints = endpoints.sort((a, b) => 
    (connectionFailures[a] || 0) - (connectionFailures[b] || 0)
  );
  
  const currentKey = currentEndpoint;
  const nextEndpoint = sortedEndpoints.find(ep => ep !== currentKey) || 'fallback3';
  
  logger.info(`Switching from ${currentEndpoint} to ${nextEndpoint} RPC endpoint`);
  currentEndpoint = nextEndpoint;
  
  const endpoint = RPC_ENDPOINTS[nextEndpoint];
  solanaConnection = new Connection(endpoint, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: false,
    confirmTransactionInitialTimeout: 60000
  });
  
  try {
    // Test connection
    const blockchainInfo = await solanaConnection.getVersion();
    connectionActive = true;
    lastConnectionCheck = Date.now();
    logger.info(`✅ Successfully switched to ${nextEndpoint} RPC endpoint (Solana version ${blockchainInfo['solana-core']})`);
    return solanaConnection;
  } catch (error: any) {
    logger.error(`Failed to connect to ${nextEndpoint} RPC: ${error.message || String(error)}`);
    connectionFailures[nextEndpoint]++;
    
    // Try another one recursively
    return switchToFallbackRpc();
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
    
    solanaConnection = new Connection(endpoint, {
      commitment: 'confirmed',
      disableRetryOnRateLimit: false
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