/**
 * Activate Live Trading with Real Funds
 * 
 * This script directly activates the transaction engine and ensures real 
 * blockchain transactions by fixing connection issues with Solana RPC.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection } from '@solana/web3.js';
import * as nexusIntegration from './nexus-integration';
import * as rpcConnectionManager from './lib/rpcConnectionManager';
import * as rpcRateLimiter from './lib/rpcRateLimiter';
import * as pythPriceOracle from './lib/pythPriceOracle';
import * as logger from './logger';

/**
 * Helper function to log messages both to console and file
 * @param message The message to log
 */
function log(message: string): void {
  logger.info(`[LiveTrading] ${message}`);
  console.log(`[LiveTrading] ${message}`);
  
  // Append to activation log
  const logDir = path.join('.', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logFile = path.join(logDir, 'activation.log');
  fs.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
}

/**
 * Activate the transaction engine with the appropriate RPC URL
 */
async function activateTransactionEngine(): Promise<boolean> {
  try {
    log('Activating transaction engine with Instant Nodes RPC');
    
    // Configure RPC rate limiter
    rpcRateLimiter.setNormalRateLimiting();
    
    // Get managed connection
    const connection = rpcConnectionManager.getManagedConnection({
      commitment: 'confirmed'
    });
    
    log('Connection established. Initializing transaction engine');
    
    // Initialize with real funds
    const engineInitialized = await nexusIntegration.initializeTransactionEngine();
    
    if (!engineInitialized) {
      throw new Error('Failed to initialize transaction engine');
    }
    
    log('Transaction engine initialized successfully with real funds');
    return true;
  } catch (error) {
    log(`Error activating transaction engine: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Enable real fund trading by setting appropriate flags
 */
async function enableRealFundTrading(): Promise<boolean> {
  try {
    log('Enabling real fund trading');
    
    // Integration will force useRealFunds to true
    const systemActivated = await nexusIntegration.activateFullSystem();
    
    if (!systemActivated) {
      throw new Error('Failed to activate full system');
    }
    
    log('Real fund trading enabled successfully');
    return true;
  } catch (error) {
    log(`Error enabling real fund trading: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Initialize price feeds
 */
async function initializePriceFeeds(): Promise<boolean> {
  try {
    log('Initializing price feeds');
    
    // Get all available symbols
    const symbols = pythPriceOracle.getAvailableSymbols();
    log(`Available price symbols: ${symbols.join(', ')}`);
    
    // Test fetching price data
    const prices = await pythPriceOracle.getMultiplePrices(symbols);
    
    // Log first few prices as test
    for (const symbol of symbols.slice(0, 3)) {
      const price = prices[symbol];
      if (price) {
        log(`Price for ${symbol}: $${price.price.toFixed(6)} (confidence: $${price.confidence.toFixed(6)})`);
      } else {
        log(`Failed to get price for ${symbol}`);
      }
    }
    
    log('Price feeds initialized successfully');
    return true;
  } catch (error) {
    log(`Error initializing price feeds: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Activate all trading agents
 */
async function activateAllAgents(): Promise<boolean> {
  try {
    log('Activating trading agents');
    
    // This will be handled by the activateFullSystem call
    log('Trading agents activated through system integration');
    return true;
  } catch (error) {
    log(`Error activating trading agents: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Setup data directories
 */
async function setupDataDirectories(): Promise<boolean> {
  try {
    log('Setting up data directories');
    
    // Create required directories
    const dirs = [
      path.join('.', 'data'),
      path.join('.', 'data', 'wallets'),
      path.join('.', 'logs'),
      path.join('.', 'server', 'config')
    ];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log(`Created directory: ${dir}`);
      }
    }
    
    log('Data directories setup successfully');
    return true;
  } catch (error) {
    log(`Error setting up data directories: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Main function to activate live trading
 */
export async function activateLiveTrading(): Promise<boolean> {
  log('Starting live trading activation process');
  
  try {
    // Setup data directories
    await setupDataDirectories();
    
    // Activate transaction engine
    const engineActivated = await activateTransactionEngine();
    if (!engineActivated) {
      throw new Error('Failed to activate transaction engine');
    }
    
    // Initialize price feeds
    const pricesFeedsInitialized = await initializePriceFeeds();
    if (!pricesFeedsInitialized) {
      log('Warning: Price feeds not fully initialized, continuing with activation');
    }
    
    // Enable real fund trading
    const realFundsEnabled = await enableRealFundTrading();
    if (!realFundsEnabled) {
      throw new Error('Failed to enable real fund trading');
    }
    
    // Activate all agents
    const agentsActivated = await activateAllAgents();
    if (!agentsActivated) {
      log('Warning: Some agents may not be fully activated, continuing with activation');
    }
    
    log('Live trading activation completed successfully!');
    
    // Load system status
    const rpcStats = rpcRateLimiter.getRateLimitStats();
    log(`RPC Rate Limiter: ${rpcStats.currentRequestRate}/${rpcStats.maxRequestsPerMinute} requests (${rpcStats.utilizationPercent}% utilization)`);
    
    return true;
  } catch (error) {
    log(`Error activating live trading: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// Run activation if executed directly
if (require.main === module) {
  activateLiveTrading()
    .then((success) => {
      if (success) {
        log('Live trading activation completed successfully. System is ready for trading.');
        process.exit(0);
      } else {
        log('Live trading activation failed. Please check logs for details.');
        process.exit(1);
      }
    })
    .catch((err: Error) => {
      log(`Unexpected error during activation: ${err.message}`);
      process.exit(1);
    });
}