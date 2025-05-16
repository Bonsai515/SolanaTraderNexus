/**
 * Real-Time Wallet Balance Notifier
 * 
 * This module monitors wallet balances in real-time and sends detailed 
 * notifications with balance changes (plus/minus), transaction details,
 * and blockchain verification links.
 */

import * as logger from './logger';
import * as walletManager from './walletManager';
import { getNexusEngine } from './nexus-transaction-engine';
import { PublicKey } from '@solana/web3.js';
import { getManagedConnection } from './lib/rpcConnectionManager';
import { EventEmitter } from 'events';

// Balance update event emitter
const balanceEvents = new EventEmitter();

// Previous balance cache
interface WalletBalanceCache {
  [address: string]: {
    sol: number;
    tokens: {
      [symbol: string]: number;
    };
    lastUpdated: number;
  };
}

const balanceCache: WalletBalanceCache = {};

// Balance change notification interface
export interface BalanceChangeNotification {
  walletAddress: string;
  walletType: 'Trading' | 'Profit' | 'Fee' | 'Unknown';
  timestamp: string;
  changes: {
    token: string;
    previousBalance: number;
    newBalance: number;
    change: number; // Positive for increase, negative for decrease
    changePercent: number;
  }[];
  relatedTransaction?: string;
  solscanLink?: string;
}

/**
 * Initialize the wallet balance notifier
 */
export async function initWalletBalanceNotifier(): Promise<boolean> {
  try {
    logger.info('[WalletBalanceNotifier] Initializing wallet balance notifier');
    
    // Get wallet configuration
    const walletConfig = walletManager.getWalletConfig();
    
    // Initialize balance cache with current balances
    await refreshBalanceCache();
    
    // Start balance monitoring interval
    startBalanceMonitoring();
    
    logger.info('[WalletBalanceNotifier] Wallet balance notifier initialized successfully');
    return true;
  } catch (error) {
    logger.error(`[WalletBalanceNotifier] Initialization failed: ${error}`);
    return false;
  }
}

/**
 * Start monitoring wallet balances for changes
 */
function startBalanceMonitoring(): void {
  logger.info('[WalletBalanceNotifier] Starting balance monitoring');
  
  // Check balances every 10 seconds
  setInterval(async () => {
    try {
      await checkForBalanceChanges();
    } catch (error) {
      logger.error(`[WalletBalanceNotifier] Error checking balances: ${error}`);
    }
  }, 10000);
}

/**
 * Check for balance changes across all monitored wallets
 */
async function checkForBalanceChanges(): Promise<void> {
  try {
    // Get current balances
    const currentBalances = await fetchCurrentBalances();
    
    // Compare with cached balances and generate notifications
    for (const [address, balanceData] of Object.entries(currentBalances)) {
      const cachedBalance = balanceCache[address];
      
      if (cachedBalance) {
        // Check for SOL balance changes
        const solChange = balanceData.sol - cachedBalance.sol;
        
        // Check for token balance changes
        const tokenChanges = [];
        for (const [token, balance] of Object.entries(balanceData.tokens)) {
          const previousBalance = cachedBalance.tokens[token] || 0;
          const change = balance - previousBalance;
          
          // If there's a change, add to notification
          if (Math.abs(change) > 0.000001) { // Threshold to avoid dust changes
            tokenChanges.push({
              token,
              previousBalance,
              newBalance: balance,
              change,
              changePercent: previousBalance > 0 ? (change / previousBalance) * 100 : 100
            });
          }
        }
        
        // If there are SOL or token changes, emit notification
        if (Math.abs(solChange) > 0.000001 || tokenChanges.length > 0) {
          // Add SOL change to notification if it changed
          if (Math.abs(solChange) > 0.000001) {
            tokenChanges.unshift({
              token: 'SOL',
              previousBalance: cachedBalance.sol,
              newBalance: balanceData.sol,
              change: solChange,
              changePercent: cachedBalance.sol > 0 ? (solChange / cachedBalance.sol) * 100 : 100
            });
          }
          
          // Determine wallet type
          const walletConfig = walletManager.getWalletConfig();
          let walletType: 'Trading' | 'Profit' | 'Fee' | 'Unknown' = 'Unknown';
          
          if (address === walletConfig.tradingWallet) {
            walletType = 'Trading';
          } else if (address === walletConfig.profitWallet) {
            walletType = 'Profit';
          } else if (address === walletConfig.feeWallet) {
            walletType = 'Fee';
          }
          
          // Create notification
          const notification: BalanceChangeNotification = {
            walletAddress: address,
            walletType,
            timestamp: new Date().toISOString(),
            changes: tokenChanges
          };
          
          // Try to find recent transaction for this wallet
          const recentTransaction = await findRecentTransaction(address);
          if (recentTransaction) {
            notification.relatedTransaction = recentTransaction;
            notification.solscanLink = `https://solscan.io/tx/${recentTransaction}`;
          }
          
          // Emit balance change event
          balanceEvents.emit('balanceChange', notification);
          
          // Log the notification
          logBalanceChangeNotification(notification);
        }
      }
    }
    
    // Update cache with current balances
    Object.assign(balanceCache, currentBalances);
  } catch (error) {
    logger.error(`[WalletBalanceNotifier] Error checking balance changes: ${error}`);
  }
}

/**
 * Fetch current balances for all monitored wallets
 */
async function fetchCurrentBalances(): Promise<WalletBalanceCache> {
  try {
    const walletConfig = walletManager.getWalletConfig();
    const nexusEngine = getNexusEngine();
    
    // Addresses to check
    const addresses = [
      walletConfig.tradingWallet,
      walletConfig.profitWallet,
      ...(walletConfig.feeWallet ? [walletConfig.feeWallet] : [])
    ].filter(Boolean);
    
    // Get wallet balances
    const balances = await nexusEngine.getWalletBalances(addresses);
    
    // Format balances for cache
    const result: WalletBalanceCache = {};
    
    for (const [address, balanceData] of Object.entries(balances)) {
      result[address] = {
        sol: balanceData.sol || 0,
        tokens: {
          ...balanceData.tokens
        },
        lastUpdated: Date.now()
      };
    }
    
    return result;
  } catch (error) {
    logger.error(`[WalletBalanceNotifier] Error fetching current balances: ${error}`);
    return {};
  }
}

/**
 * Refresh the balance cache with current values
 */
async function refreshBalanceCache(): Promise<void> {
  try {
    logger.info('[WalletBalanceNotifier] Refreshing balance cache');
    
    const currentBalances = await fetchCurrentBalances();
    Object.assign(balanceCache, currentBalances);
    
    logger.info(`[WalletBalanceNotifier] Balance cache refreshed for ${Object.keys(currentBalances).length} wallets`);
  } catch (error) {
    logger.error(`[WalletBalanceNotifier] Error refreshing balance cache: ${error}`);
  }
}

/**
 * Find a recent transaction for a wallet
 */
async function findRecentTransaction(address: string): Promise<string | null> {
  try {
    const connection = getManagedConnection();
    const pubkey = new PublicKey(address);
    
    // Get recent transactions
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 1 });
    
    if (signatures && signatures.length > 0) {
      return signatures[0].signature;
    }
    
    return null;
  } catch (error) {
    logger.error(`[WalletBalanceNotifier] Error finding recent transaction: ${error}`);
    return null;
  }
}

/**
 * Log a balance change notification
 */
function logBalanceChangeNotification(notification: BalanceChangeNotification): void {
  const changesList = notification.changes.map(change => {
    const sign = change.change > 0 ? '+' : '';
    return `${change.token}: ${sign}${change.change.toFixed(6)} (${sign}${change.changePercent.toFixed(2)}%)`;
  }).join(', ');
  
  const walletDesc = `${notification.walletType} Wallet (${notification.walletAddress.substring(0, 4)}...${notification.walletAddress.substring(notification.walletAddress.length - 4)})`;
  
  logger.info(`💰 BALANCE UPDATE: ${walletDesc} -> ${changesList}`);
  
  if (notification.relatedTransaction) {
    logger.info(`📝 Related transaction: ${notification.relatedTransaction}`);
    logger.info(`🔗 Solscan: ${notification.solscanLink}`);
  }
}

/**
 * Subscribe to balance change events
 */
export function onBalanceChange(callback: (notification: BalanceChangeNotification) => void): () => void {
  balanceEvents.on('balanceChange', callback);
  
  // Return unsubscribe function
  return () => {
    balanceEvents.off('balanceChange', callback);
  };
}

/**
 * Force an immediate balance check
 */
export async function checkBalancesNow(): Promise<void> {
  logger.info('[WalletBalanceNotifier] Manually triggering balance check');
  await checkForBalanceChanges();
}

/**
 * Get the current balance cache
 */
export function getBalanceCache(): WalletBalanceCache {
  return { ...balanceCache };
}