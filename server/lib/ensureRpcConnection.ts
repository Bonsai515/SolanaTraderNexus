/**
 * Ensure RPC Connection to Solana
 *
 * This module ensures a stable and reliable connection to Solana RPC nodes,
 * with automatic fallback and connection verification.
 */

import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { logger } from '../logger';

// Type for connection endpoints
interface RpcEndpoints {
  [key: string]: string;
}

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
const RPC_ENDPOINTS: RpcEndpoints = {
  // Primary connection - Instant Nodes premium endpoint (4M daily limit)
  primary: validateRpcUrl(process.env.INSTANT_NODES_RPC_URL, 'https://api.mainnet-beta.solana.com'),
  
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
let currentEndpoint: string = 'primary';
let connectionActive: boolean = false;
let lastConnectionCheck: number = 0;
let connectionFailures: Record<string, number> = {
  primary: 0,
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
  logger.info('Initializing Solana RPC connection...');
  
  // Try primary first
  solanaConnection = new Connection(RPC_ENDPOINTS.primary, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: false,
    confirmTransactionInitialTimeout: 60000
  });
  
  try {
    const blockchainInfo = await solanaConnection.getVersion();
    logger.info(`Successfully connected to Solana RPC node. Version: ${blockchainInfo['solana-core']}`);
    
    // Check if we can reach the instant nodes API with 4M requests limit
    if (RPC_ENDPOINTS.primary.includes('instanton')) {
      logger.info('Using Instant Nodes RPC with 4 million daily request limit');
    }
    
    connectionActive = true;
    lastConnectionCheck = Date.now();
    
    // Start connection monitoring
    startConnectionMonitoring();
    
    return solanaConnection;
  } catch (error) {
    logger.error('Failed to connect to primary Solana RPC:', error);
    connectionFailures.primary++;
    
    // Try fallbacks
    return switchToFallbackRpc();
  }
}

/**
 * Switch to a fallback RPC if primary fails
 */
async function switchToFallbackRpc(): Promise<Connection> {
  const endpoints = Object.keys(RPC_ENDPOINTS);
  const sortedEndpoints = endpoints.sort((a, b) => {
    return (connectionFailures[a] || 0) - (connectionFailures[b] || 0);
  });
  
  const currentKey = currentEndpoint;
  const nextEndpoint = sortedEndpoints.find(ep => ep !== currentKey) || 'primary';
  
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
    await solanaConnection.getVersion();
    connectionActive = true;
    lastConnectionCheck = Date.now();
    
    logger.info(`Successfully switched to ${nextEndpoint} RPC endpoint`);
    return solanaConnection;
  } catch (error) {
    logger.error(`Failed to connect to ${nextEndpoint} RPC:`, error);
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
    } catch (error) {
      logger.warn(`RPC connection check failed for ${currentEndpoint}:`, error);
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
    
    logger.info(`Wallet ${walletAddress} exists: ${accountInfo !== null}, balance: ${balance / 1e9} SOL`);
    
    return accountInfo !== null && balance > 0;
  } catch (error) {
    logger.error(`Failed to verify wallet ${walletAddress}:`, error);
    return false;
  }
}

// Initialize on module load
initializeRpcConnection().catch(err => {
  logger.error('Failed to initialize any Solana RPC connection:', err);
});