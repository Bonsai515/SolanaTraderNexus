/**
 * Configuration module
 * 
 * Provides centralized configuration management for the trading system.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as logger from './logger';

// Default configuration
const DEFAULT_CONFIG = {
  useRealFunds: false,
  rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
  websocketUrl: process.env.WEBSOCKET_URL,
  systemWalletAddress: process.env.SYSTEM_WALLET_ADDRESS,
  backupRpcUrls: process.env.BACKUP_RPC_URLS ? process.env.BACKUP_RPC_URLS.split(',') : [],
  heliusApiKey: process.env.HELIUS_API_KEY,
  wormholeGuardianRpc: process.env.WORMHOLE_GUARDIAN_RPC
};

// Cache the configuration
let cachedConfig = null;

/**
 * Load memecortex target configuration
 */
export function loadMemecortexConfig() {
  try {
    const configPath = path.join(__dirname, 'config/memecortex-targets.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    }
    
    logger.warn('[Config] Memecortex targets configuration not found, using defaults');
    return {
      priority_tokens: ["SOL", "BONK", "WIF"],
      monitored_exchanges: ["Raydium", "Jupiter", "Openbook"],
      signal_thresholds: {
        minimum_confidence: 65,
        activation_threshold: 80
      }
    };
  } catch (error) {
    logger.error(`[Config] Error loading memecortex configuration: ${error.message}`);
    return {
      priority_tokens: ["SOL", "BONK", "WIF"],
      monitored_exchanges: ["Raydium", "Jupiter", "Openbook"],
      signal_thresholds: {
        minimum_confidence: 65,
        activation_threshold: 80
      }
    };
  }
}

/**
 * Get the system configuration
 */
export function getConfig() {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }
  
  try {
    // Load config from environment
    const config = { ...DEFAULT_CONFIG };
    
    // Convert boolean string to actual boolean
    if (process.env.USE_REAL_FUNDS) {
      config.useRealFunds = process.env.USE_REAL_FUNDS.toLowerCase() === 'true';
    }
    
    // Fallback for missing Wormhole RPC
    if (!config.wormholeGuardianRpc) {
      config.wormholeGuardianRpc = 'https://wormhole-v2-mainnet-api.certus.one';
    }
    
    // Cache the config
    cachedConfig = config;
    
    return config;
  } catch (error) {
    logger.error(`[Config] Error loading config: ${error.message}`);
    return DEFAULT_CONFIG;
  }
}

/**
 * Set the useRealFunds flag
 */
export function setUseRealFunds(useRealFunds: boolean) {
  try {
    // Update cached config if it exists
    if (cachedConfig) {
      cachedConfig.useRealFunds = useRealFunds;
    } else {
      // Otherwise, load the config and then update it
      cachedConfig = getConfig();
      cachedConfig.useRealFunds = useRealFunds;
    }
    
    logger.info(`[Config] UseRealFunds set to: ${useRealFunds}`);
    
    return true;
  } catch (error) {
    logger.error(`[Config] Error setting useRealFunds: ${error.message}`);
    return false;
  }
}