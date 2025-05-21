/**
 * Live Trading Activator
 * 
 * This module activates live trading with real funds by connecting
 * to premium RPC endpoints and setting up proper transaction handling.
 */

import * as logger from './logger';
import { getConnection } from './solana/connection-manager';
import { getTransactionHandler } from './quicknode-connector';
import { PublicKey, Transaction, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Trading configuration
interface TradingConfig {
  useRealFunds: boolean;
  walletAddress: string;
  systemWalletAddress: string;
  transactionMode: 'quicknode' | 'default';
  tradeMode: 'full' | 'restricted';
  maxTransactionValueSOL: number;
  maxDailyTransactions: number;
  dailyVolumeLimit: number;
  tokenBlacklist: string[];
  enabledStrategies: string[];
}

// Default config
const DEFAULT_CONFIG: TradingConfig = {
  useRealFunds: false,
  walletAddress: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
  systemWalletAddress: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
  transactionMode: 'default',
  tradeMode: 'restricted',
  maxTransactionValueSOL: 0.1,
  maxDailyTransactions: 10,
  dailyVolumeLimit: 1.0,
  tokenBlacklist: [],
  enabledStrategies: [
    'quantum-omega-sniper',
    'momentum-surfing',
    'flash-arbitrage'
  ]
};

// Current trading configuration
let currentConfig: TradingConfig = {...DEFAULT_CONFIG};

// Transaction statistics
const txStats = {
  dailyTransactionCount: 0,
  dailyVolume: 0,
  lastReset: Date.now(),
  transactions: [] as {
    signature: string;
    amount: number;
    timestamp: number;
    strategy: string;
  }[]
};

/**
 * Load trading configuration
 */
function loadTradingConfig(): TradingConfig {
  try {
    const configPath = path.join(__dirname, '..', 'config', 'trading-config.json');
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const loadedConfig = JSON.parse(configData);
      
      logger.info('[LiveTrading] Loaded trading configuration from file');
      
      // Merge with default config to ensure all fields exist
      return {...DEFAULT_CONFIG, ...loadedConfig};
    } else {
      logger.warn('[LiveTrading] No trading config file found, using defaults');
      return {...DEFAULT_CONFIG};
    }
  } catch (error) {
    logger.error(`[LiveTrading] Error loading trading config: ${error.message}`);
    return {...DEFAULT_CONFIG};
  }
}

/**
 * Save trading configuration
 */
function saveTradingConfig(config: TradingConfig): boolean {
  try {
    const configDir = path.join(__dirname, '..', 'config');
    const configPath = path.join(configDir, 'trading-config.json');
    
    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, {recursive: true});
    }
    
    // Save config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    logger.info('[LiveTrading] Trading configuration saved');
    return true;
  } catch (error) {
    logger.error(`[LiveTrading] Error saving trading config: ${error.message}`);
    return false;
  }
}

/**
 * Verify wallet balance
 */
async function verifyWalletBalance(walletAddress: string): Promise<number> {
  try {
    const connection = getConnection('confirmed', 'queries'); // Use queries endpoint for balance check
    const pubkey = new PublicKey(walletAddress);
    
    const balance = await connection.getBalance(pubkey);
    const balanceSOL = balance / 1_000_000_000; // Convert lamports to SOL
    
    logger.info(`[LiveTrading] Wallet ${walletAddress} has ${balanceSOL} SOL`);
    return balanceSOL;
  } catch (error) {
    logger.error(`[LiveTrading] Error verifying wallet balance: ${error.message}`);
    throw error;
  }
}

/**
 * Reset daily statistics if needed
 */
function checkAndResetDailyStats(): void {
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  
  if (now - txStats.lastReset > dayInMs) {
    // Reset stats
    txStats.dailyTransactionCount = 0;
    txStats.dailyVolume = 0;
    txStats.lastReset = now;
    
    // Clear old transactions (keep last 100 for history)
    if (txStats.transactions.length > 100) {
      txStats.transactions = txStats.transactions.slice(-100);
    }
    
    logger.info('[LiveTrading] Daily transaction statistics reset');
  }
}

/**
 * Check if a transaction is allowed based on limits
 */
function isTransactionAllowed(amount: number, strategy: string): boolean {
  checkAndResetDailyStats();
  
  // Check if strategy is enabled
  if (!currentConfig.enabledStrategies.includes(strategy)) {
    logger.warn(`[LiveTrading] Transaction rejected: Strategy ${strategy} is not enabled`);
    return false;
  }
  
  // Check transaction amount limit
  if (amount > currentConfig.maxTransactionValueSOL) {
    logger.warn(`[LiveTrading] Transaction rejected: Amount ${amount} SOL exceeds maximum ${currentConfig.maxTransactionValueSOL} SOL`);
    return false;
  }
  
  // Check daily transaction count
  if (txStats.dailyTransactionCount >= currentConfig.maxDailyTransactions) {
    logger.warn(`[LiveTrading] Transaction rejected: Daily transaction limit reached (${currentConfig.maxDailyTransactions})`);
    return false;
  }
  
  // Check daily volume
  if (txStats.dailyVolume + amount > currentConfig.dailyVolumeLimit) {
    logger.warn(`[LiveTrading] Transaction rejected: Daily volume limit would be exceeded`);
    return false;
  }
  
  // Check if trade mode allows
  if (currentConfig.tradeMode === 'restricted') {
    // In restricted mode, only allow smaller transactions
    const restrictedLimit = currentConfig.maxTransactionValueSOL * 0.5;
    if (amount > restrictedLimit) {
      logger.warn(`[LiveTrading] Transaction rejected: Amount ${amount} SOL exceeds restricted mode limit ${restrictedLimit} SOL`);
      return false;
    }
  }
  
  return true;
}

/**
 * Record a transaction
 */
function recordTransaction(signature: string, amount: number, strategy: string): void {
  checkAndResetDailyStats();
  
  // Update stats
  txStats.dailyTransactionCount++;
  txStats.dailyVolume += amount;
  
  // Record transaction
  txStats.transactions.push({
    signature,
    amount,
    timestamp: Date.now(),
    strategy
  });
  
  logger.info(`[LiveTrading] Transaction recorded: ${signature}, ${amount} SOL, strategy: ${strategy}`);
  logger.info(`[LiveTrading] Daily stats: ${txStats.dailyTransactionCount} transactions, ${txStats.dailyVolume.toFixed(4)} SOL volume`);
}

/**
 * Execute a transaction with live trading checks
 */
export async function executeTradingTransaction(
  transaction: Transaction,
  signers: Keypair[],
  amount: number,
  strategy: string
): Promise<{success: boolean, signature?: string, error?: string}> {
  try {
    // Check if real funds are enabled
    if (!currentConfig.useRealFunds) {
      logger.info(`[LiveTrading] SIMULATION: Would execute transaction for ${amount} SOL using strategy ${strategy}`);
      return {
        success: true,
        signature: `SIM_TX_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`
      };
    }
    
    // Check if transaction is allowed
    if (!isTransactionAllowed(amount, strategy)) {
      return {
        success: false,
        error: 'Transaction rejected due to trading limits'
      };
    }
    
    // Execute transaction using the appropriate mode
    let signature: string;
    
    if (currentConfig.transactionMode === 'quicknode') {
      // Use QuickNode for transaction
      const transactionHandler = getTransactionHandler();
      signature = await transactionHandler.sendTransaction(transaction, signers);
    } else {
      // Use default transaction handling
      const connection = getConnection('confirmed');
      signature = await connection.sendTransaction(transaction, signers);
    }
    
    // Record the transaction
    recordTransaction(signature, amount, strategy);
    
    return {
      success: true,
      signature
    };
  } catch (error) {
    logger.error(`[LiveTrading] Transaction execution error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Enable live trading with real funds
 */
export async function enableLiveTrading(
  useRealFunds: boolean = true,
  walletAddress?: string
): Promise<boolean> {
  try {
    // Load existing config
    currentConfig = loadTradingConfig();
    
    // Update config
    currentConfig.useRealFunds = useRealFunds;
    if (walletAddress) {
      currentConfig.walletAddress = walletAddress;
      currentConfig.systemWalletAddress = walletAddress;
    }
    
    // Set to use QuickNode for transactions
    currentConfig.transactionMode = 'quicknode';
    
    // Save updated config
    const saved = saveTradingConfig(currentConfig);
    if (!saved) {
      logger.warn('[LiveTrading] Failed to save updated configuration');
    }
    
    // Verify wallet balance
    if (useRealFunds) {
      try {
        const balance = await verifyWalletBalance(currentConfig.walletAddress);
        if (balance < 0.01) {
          logger.warn(`[LiveTrading] Warning: Wallet balance is low (${balance} SOL)`);
        }
        
        // Initialize transaction handler to ensure connection works
        getTransactionHandler();
        
        logger.info(`[LiveTrading] Live trading ENABLED with wallet ${currentConfig.walletAddress}`);
        logger.info(`[LiveTrading] Trading limits: max ${currentConfig.maxTransactionValueSOL} SOL per tx, ${currentConfig.maxDailyTransactions} txs per day, ${currentConfig.dailyVolumeLimit} SOL daily volume`);
        
        return true;
      } catch (error) {
        logger.error(`[LiveTrading] Failed to verify wallet: ${error.message}`);
        
        // Disable real funds if wallet verification fails
        currentConfig.useRealFunds = false;
        saveTradingConfig(currentConfig);
        
        return false;
      }
    } else {
      logger.info('[LiveTrading] Running in SIMULATION mode (no real funds will be used)');
      return true;
    }
  } catch (error) {
    logger.error(`[LiveTrading] Error enabling live trading: ${error.message}`);
    return false;
  }
}

/**
 * Check if live trading is enabled
 */
export function isLiveTradingEnabled(): boolean {
  return currentConfig.useRealFunds;
}

/**
 * Get trading configuration
 */
export function getTradingConfig(): TradingConfig {
  return {...currentConfig}; // Return copy to prevent modification
}

/**
 * Get transaction statistics
 */
export function getTransactionStats(): any {
  checkAndResetDailyStats();
  
  return {
    dailyTransactionCount: txStats.dailyTransactionCount,
    dailyVolume: txStats.dailyVolume,
    transactionHistory: txStats.transactions.slice(-20), // Return only the last 20 transactions
    remainingDailyTransactions: currentConfig.maxDailyTransactions - txStats.dailyTransactionCount,
    remainingDailyVolume: currentConfig.dailyVolumeLimit - txStats.dailyVolume
  };
}

// Initialize on load
currentConfig = loadTradingConfig();

// Export for access from other modules
export default {
  enableLiveTrading,
  executeTradingTransaction,
  isLiveTradingEnabled,
  getTradingConfig,
  getTransactionStats
};