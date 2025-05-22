/**
 * Syndica RPC Configuration
 * 
 * This module configures Syndica RPC connections for high-priority transactions
 * and critical operations, while using public endpoints for less critical tasks.
 */

import * as logger from '../logger';

// Syndica connection configuration
export interface SyndicaConfig {
  enabled: boolean;
  mainnetUrl: string;
  mainnetWsUrl: string;
  priority: 'high' | 'medium' | 'low';
  usageStrategy: 'transactions-only' | 'critical-only' | 'all';
  rateLimit: {
    maxRequestsPerMinute: number;
    maxConcurrent: number;
  };
  fallback: {
    enabled: boolean;
    urls: string[];
  };
}

// Default Syndica configuration
export const SYNDICA_CONFIG: SyndicaConfig = {
  enabled: true,
  mainnetUrl: 'https://solana-api.syndica.io/access-token/NUYAk4S7suP5U8DQn5TYm46VYYm7n2jEBdQdrBXj1ZWbTcyPRcJmdJ6c8zGSV9QR',
  mainnetWsUrl: 'wss://solana-api.syndica.io/access-token/NUYAk4S7suP5U8DQn5TYm46VYYm7n2jEBdQdrBXj1ZWbTcyPRcJmdJ6c8zGSV9QR',
  priority: 'high',
  usageStrategy: 'transactions-only', // Only use for actual transactions
  rateLimit: {
    maxRequestsPerMinute: 60,  // Conservative limit
    maxConcurrent: 5
  },
  fallback: {
    enabled: true,
    urls: [
      'https://api.mainnet-beta.solana.com',
      'https://solana-mainnet.g.alchemy.com/v2/xSEhjWBzRHfecUGVHLgaVyFGkpHWNTB7'
    ]
  }
};

// Trading wallet configuration
export const TRADING_WALLET_CONFIG = {
  address: 'HPN9rV3Ja5FCgT3WiNLK6PWrPkLZs3zXE1QWWwJGmvmF',
  balance: 0.5, // SOL
  minBalance: 0.05  // Minimum SOL balance to maintain
};

// Connection management functions
let syndicaAvailable = false;

/**
 * Check if Syndica is available
 */
export async function checkSyndicaAvailability(): Promise<boolean> {
  try {
    if (!SYNDICA_CONFIG.enabled) {
      return false;
    }
    
    // Perform a simple request to check availability
    const response = await fetch(SYNDICA_CONFIG.mainnetUrl, {
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
      syndicaAvailable = data.result === 'ok';
      logger.info(`Syndica availability check: ${syndicaAvailable ? 'Available' : 'Unavailable'}`);
      return syndicaAvailable;
    }
    
    logger.warn(`Syndica availability check failed with status: ${response.status}`);
    syndicaAvailable = false;
    return false;
  } catch (error) {
    logger.warn(`Error checking Syndica availability: ${error.message}`);
    syndicaAvailable = false;
    return false;
  }
}

/**
 * Get appropriate RPC URL based on operation type
 */
export function getRpcUrl(operationType: 'transaction' | 'query' | 'critical'): string {
  // If Syndica is not available, use fallback
  if (!syndicaAvailable || !SYNDICA_CONFIG.enabled) {
    return SYNDICA_CONFIG.fallback.urls[0];
  }
  
  // Use Syndica for transactions or critical operations based on strategy
  if (operationType === 'transaction') {
    return SYNDICA_CONFIG.mainnetUrl;
  } else if (operationType === 'critical' && 
            (SYNDICA_CONFIG.usageStrategy === 'critical-only' || 
             SYNDICA_CONFIG.usageStrategy === 'all')) {
    return SYNDICA_CONFIG.mainnetUrl;
  } else if (SYNDICA_CONFIG.usageStrategy === 'all') {
    return SYNDICA_CONFIG.mainnetUrl;
  }
  
  // Use fallback for non-critical operations
  return SYNDICA_CONFIG.fallback.urls[0];
}

// Initialize Syndica availability check
checkSyndicaAvailability()
  .then(available => {
    if (available) {
      logger.info('✅ Syndica RPC is available and will be used for transactions');
    } else {
      logger.warn('⚠️ Syndica RPC is unavailable, using fallback endpoints');
    }
  })
  .catch(error => {
    logger.error(`Error during Syndica initialization: ${error.message}`);
  });

export default {
  SYNDICA_CONFIG,
  TRADING_WALLET_CONFIG,
  checkSyndicaAvailability,
  getRpcUrl
};