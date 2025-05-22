/**
 * Initialize System State Machine
 * 
 * This script initializes and bootstraps the system state machine
 * for token caching, API rate management, and wallet configuration.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as logger from './logger';
import systemMemory from './lib/system-state-memory';
import tokenCache from './lib/enhanced-token-cache';
import { TRADING_WALLET_CONFIG, checkSyndicaAvailability } from './config/syndica-config';

// Initial token data to bootstrap the system with
const INITIAL_TOKENS = [
  {
    symbol: 'SOL',
    name: 'Solana',
    address: 'So11111111111111111111111111111111111111112',
    price: 148.52,
    priceSOL: 1,
    priceChangePercent: 2.5,
    volume24h: 1250000000,
    marketCap: 65000000000,
    lastUpdated: Date.now(),
    source: 'local-cache',
    confidence: 100,
    trending: true,
    priority: 100,
    tags: ['layer1', 'major']
  },
  {
    symbol: 'BONK',
    name: 'Bonk',
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    price: 0.000032,
    priceSOL: 0.00000022,
    priceChangePercent: 5.2,
    volume24h: 75000000,
    marketCap: 1900000000,
    lastUpdated: Date.now(),
    source: 'local-cache',
    confidence: 90,
    trending: true,
    priority: 90,
    tags: ['memecoin', 'trending']
  },
  {
    symbol: 'JUP',
    name: 'Jupiter',
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    price: 1.24,
    priceSOL: 0.0084,
    priceChangePercent: -3.1,
    volume24h: 120000000,
    marketCap: 1675000000,
    lastUpdated: Date.now(),
    source: 'local-cache',
    confidence: 95,
    trending: true,
    priority: 85,
    tags: ['dex', 'defi']
  }
];

/**
 * Initialize system memory with HPN wallet
 */
async function initializeSystemMemory(): Promise<boolean> {
  try {
    logger.info('Initializing system state machine...');
    
    // Initialize system memory
    const memoryInitialized = await systemMemory.initialize();
    if (!memoryInitialized) {
      logger.error('Failed to initialize system memory');
      return false;
    }
    
    // Update wallet address to HPN
    systemMemory.updateWalletAddress('trading', TRADING_WALLET_CONFIG.address);
    logger.info(`Set trading wallet to: ${TRADING_WALLET_CONFIG.address}`);
    
    // Check Syndica availability
    const syndicaAvailable = await checkSyndicaAvailability();
    systemMemory.updateApiState('syndica', {
      available: syndicaAvailable,
      rateLimitRemaining: 100,
      cooldownUntil: 0,
      failureCount: 0
    });
    
    // Track status of other APIs
    systemMemory.updateApiState('coingecko', {
      available: false, // Disabled to prevent rate limiting
      rateLimitRemaining: 0,
      cooldownUntil: Date.now() + 24 * 60 * 60 * 1000, // 24 hour cooldown
      failureCount: 10
    });
    
    // Initialize token cache
    const cacheInitialized = await tokenCache.initialize();
    if (!cacheInitialized) {
      logger.warn('Failed to initialize token cache, using system memory only');
    }
    
    // Bootstrap with initial tokens
    for (const token of INITIAL_TOKENS) {
      systemMemory.updateToken(token);
      if (cacheInitialized) {
        tokenCache.updateToken(token);
      }
    }
    
    // Create local caches directory
    const cacheDir = path.join(process.cwd(), 'data', 'cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    logger.info(`System state machine initialized with ${INITIAL_TOKENS.length} tokens`);
    logger.info(`Trading wallet set to ${TRADING_WALLET_CONFIG.address}`);
    
    if (syndicaAvailable) {
      logger.info('✅ Syndica RPC is available and configured for trading transactions');
    } else {
      logger.warn('⚠️ Syndica RPC is unavailable, using fallback endpoints');
    }
    
    return true;
  } catch (error) {
    logger.error(`Failed to initialize system state machine: ${error.message}`);
    return false;
  }
}

/**
 * Clean up and save system state
 */
function cleanup(): void {
  try {
    logger.info('Saving system state...');
    systemMemory.saveState();
    logger.info('System state saved successfully');
  } catch (error) {
    logger.error(`Failed to save system state: ${error.message}`);
  }
}

// Handle process exit
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

// Main function
async function main() {
  const initialized = await initializeSystemMemory();
  
  if (initialized) {
    logger.info('✅ System state machine initialized successfully');
    logger.info(`Trading with wallet: ${systemMemory.getWalletAddress('trading')}`);
    logger.info(`Cache status: ${Object.keys(systemMemory.getState().tokens).length} tokens in memory`);
    
    // Create wallet.json file for direct access by other modules
    const walletInfo = {
      trading: systemMemory.getWalletAddress('trading'),
      profit: systemMemory.getWalletAddress('profit'),
      balance: 0.5 // Known SOL balance
    };
    
    const walletPath = path.join(process.cwd(), 'data', 'wallet.json');
    fs.writeFileSync(walletPath, JSON.stringify(walletInfo, null, 2));
    logger.info(`Wallet info saved to ${walletPath}`);
  } else {
    logger.error('❌ Failed to initialize system state machine');
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error(`Error in state machine initialization: ${error.message}`);
    process.exit(1);
  });
}

export default initializeSystemMemory;