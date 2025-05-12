/**
 * Solana RPC Connection Management
 * 
 * Production-ready implementation of Solana connection handling with
 * automatic fallback and intelligent retry logic.
 */

import { Connection, ConnectionConfig, Commitment } from '@solana/web3.js';
import { logger, retry } from './utils';

// Maximum attempts to retry a failed RPC request
const MAX_RPC_RETRIES = 3;

// Default connection config
const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = {
  commitment: 'confirmed' as Commitment,
  disableRetryOnRateLimit: false,
  confirmTransactionInitialTimeout: 60000
};

// Get RPC URLs from environment
const INSTANT_NODES_RPC_URL = import.meta.env.INSTANT_NODES_RPC_URL;
const SOLANA_RPC_API_KEY = import.meta.env.SOLANA_RPC_API_KEY;
const HELIUS_API_KEY = import.meta.env.HELIUS_API_KEY;
const BACKUP_RPC_URLS = [
  `https://solana-mainnet.g.alchemy.com/v2/${SOLANA_RPC_API_KEY || ''}`,
  `https://api.helius-rpc.com/?api-key=${HELIUS_API_KEY || ''}`,
  'https://api.mainnet-beta.solana.com'
];

// Primary RPC connection
let primaryConnection: Connection | null = null;

// Backup connections
const backupConnections: Connection[] = [];

// Connection health status
let rpcHealth = {
  primary: true,
  backupIndex: -1,
  lastHealthCheck: Date.now(),
  consecutiveFailures: 0
};

/**
 * Initialize Solana RPC connections
 */
export const initializeConnections = (): void => {
  try {
    // Initialize primary connection
    if (INSTANT_NODES_RPC_URL) {
      primaryConnection = new Connection(INSTANT_NODES_RPC_URL, DEFAULT_CONNECTION_CONFIG);
      logger.info('Solana connection initialized with InstantNodes RPC');
    } else if (SOLANA_RPC_API_KEY) {
      primaryConnection = new Connection(
        `https://solana-mainnet.g.alchemy.com/v2/${SOLANA_RPC_API_KEY}`,
        DEFAULT_CONNECTION_CONFIG
      );
      logger.info('Solana connection initialized with Alchemy RPC');
    } else {
      primaryConnection = new Connection(
        'https://api.mainnet-beta.solana.com',
        DEFAULT_CONNECTION_CONFIG
      );
      logger.info('Solana connection initialized with public RPC endpoint');
    }

    // Initialize backup connections
    backupConnections.length = 0;
    BACKUP_RPC_URLS.forEach(url => {
      if (url && (!INSTANT_NODES_RPC_URL || url !== INSTANT_NODES_RPC_URL)) {
        backupConnections.push(new Connection(url, DEFAULT_CONNECTION_CONFIG));
      }
    });

    logger.info(`Initialized ${backupConnections.length} backup Solana connections`);

    // Check connection health
    checkConnectionHealth();
  } catch (error) {
    logger.error('Failed to initialize Solana connections:', error);
  }
};

/**
 * Check health of the RPC connections
 */
export const checkConnectionHealth = async (): Promise<boolean> => {
  try {
    rpcHealth.lastHealthCheck = Date.now();

    // Try the primary connection first
    if (primaryConnection) {
      try {
        const version = await retry(
          () => primaryConnection!.getVersion(),
          2,
          500
        );
        
        if (version) {
          rpcHealth.primary = true;
          rpcHealth.backupIndex = -1;
          rpcHealth.consecutiveFailures = 0;
          return true;
        }
      } catch (error) {
        logger.warn('Primary Solana RPC connection failed health check');
        rpcHealth.primary = false;
        rpcHealth.consecutiveFailures++;
      }
    }

    // Try backup connections if primary failed
    if (!rpcHealth.primary && backupConnections.length > 0) {
      for (let i = 0; i < backupConnections.length; i++) {
        try {
          const version = await retry(
            () => backupConnections[i].getVersion(),
            2,
            500
          );
          
          if (version) {
            rpcHealth.backupIndex = i;
            logger.info(`Using backup Solana RPC connection #${i + 1}`);
            return true;
          }
        } catch (error) {
          logger.warn(`Backup Solana RPC connection #${i + 1} failed health check`);
        }
      }
    }

    // All connections failed
    logger.error('All Solana RPC connections failed');
    return false;
  } catch (error) {
    logger.error('Error checking Solana connection health:', error);
    return false;
  }
};

/**
 * Get the current Solana RPC connection
 */
export const getRpcConnection = (): Connection => {
  // Initialize connections if not already done
  if (!primaryConnection) {
    initializeConnections();
  }

  // If it's been over 5 minutes since last health check, check again
  const now = Date.now();
  if (now - rpcHealth.lastHealthCheck > 5 * 60 * 1000) {
    checkConnectionHealth().catch(error => {
      logger.error('Failed to check connection health:', error);
    });
  }

  // Return the appropriate connection
  if (rpcHealth.primary && primaryConnection) {
    return primaryConnection;
  } else if (rpcHealth.backupIndex >= 0 && rpcHealth.backupIndex < backupConnections.length) {
    return backupConnections[rpcHealth.backupIndex];
  } else if (primaryConnection) {
    // Fallback to primary even if it failed
    return primaryConnection;
  } else if (backupConnections.length > 0) {
    // Fallback to first backup if primary doesn't exist
    return backupConnections[0];
  } else {
    // Last resort: create a new connection to public endpoint
    logger.error('No Solana connections available, creating emergency connection');
    return new Connection('https://api.mainnet-beta.solana.com', DEFAULT_CONNECTION_CONFIG);
  }
};

/**
 * Get connection status for monitoring
 */
export const getConnectionStatus = (): any => {
  return {
    primary: rpcHealth.primary,
    usingBackup: rpcHealth.backupIndex >= 0,
    backupIndex: rpcHealth.backupIndex,
    lastHealthCheck: new Date(rpcHealth.lastHealthCheck).toISOString(),
    consecutiveFailures: rpcHealth.consecutiveFailures,
    hasCustomRpc: !!INSTANT_NODES_RPC_URL || !!SOLANA_RPC_API_KEY,
    backupCount: backupConnections.length
  };
};

// Initialize connections immediately
initializeConnections();

export default { getRpcConnection, checkConnectionHealth, getConnectionStatus };