/**
 * Balance Tracker Module
 * 
 * Provides real-time wallet balance tracking and notifications with
 * detailed information about balance changes (plus/minus).
 */

import * as logger from './logger';
import { Connection, PublicKey } from '@solana/web3.js';
import { getManagedConnection } from './lib/rpcConnectionManager';
import * as fs from 'fs';
import * as path from 'path';

// Trading and profit wallet addresses
const TRADING_WALLET = "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb";
const PROFIT_WALLET = "31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e";

// Token mapping
const TOKEN_MAP: Record<string, string> = {
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "BONK",
  "7LmGzEgnXfPTkNpGHCNpnxJA2PecbQS5aHHXumP2RdQA": "JUP",
  "METAmTMXwdb8gYzyCPfXXFmZZw4rUsXX58PNsDg7zjL": "MEME",
  "Lv5djULSugMxj9Zs1SN6KvAfjY5c9iN2JUxKxuYMFAk": "GUAC",
  "8wmKcoG4Hv3p9j6tQFs8VdgQzMLY78PwJ2R93bmA3YL": "WIF"
};

// Balance cache
interface WalletBalance {
  address: string;
  name: string;
  sol: number;
  tokens: Record<string, number>;
  lastUpdated: number;
}

interface BalanceChange {
  wallet: string;
  walletName: string;
  timestamp: string;
  changes: {
    token: string;
    previousAmount: number;
    newAmount: number;
    change: number;
    changePercent: number;
  }[];
  transactionSignature?: string;
}

// Store previous balances
const balanceCache = new Map<string, WalletBalance>();

// Log file path
const LOG_DIR = path.join(process.cwd(), 'logs');
const BALANCE_LOG_PATH = path.join(LOG_DIR, 'balance_changes.json');

/**
 * Initialize balance tracker
 */
export async function initBalanceTracker(): Promise<boolean> {
  try {
    logger.info('[BalanceTracker] Initializing balance tracker');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    
    // Initialize balance cache with current balances
    await updateBalanceCache();
    
    // Start balance monitoring interval
    setInterval(monitorBalances, 15000); // Check every 15 seconds
    
    logger.info('[BalanceTracker] Balance tracker initialized successfully');
    return true;
  } catch (error) {
    logger.error(`[BalanceTracker] Initialization failed: ${error}`);
    return false;
  }
}

/**
 * Update balance cache with current balances
 */
async function updateBalanceCache(): Promise<void> {
  try {
    const connection = getManagedConnection();
    
    // Wallets to monitor
    const wallets = [
      { address: TRADING_WALLET, name: 'Trading Wallet' },
      { address: PROFIT_WALLET, name: 'Prophet Wallet' }
    ];
    
    // Fetch balances for each wallet
    for (const wallet of wallets) {
      const balance = await getWalletBalance(connection, wallet.address);
      
      // Update cache
      balanceCache.set(wallet.address, {
        address: wallet.address,
        name: wallet.name,
        sol: balance.sol,
        tokens: balance.tokens,
        lastUpdated: Date.now()
      });
    }
    
    logger.info(`[BalanceTracker] Balance cache updated for ${wallets.length} wallets`);
  } catch (error) {
    logger.error(`[BalanceTracker] Error updating balance cache: ${error}`);
  }
}

/**
 * Get complete wallet balance including SOL and tokens
 */
async function getWalletBalance(connection: Connection, address: string): Promise<{
  sol: number;
  tokens: Record<string, number>;
}> {
  try {
    const pubkey = new PublicKey(address);
    
    // Get SOL balance
    const solBalance = await connection.getBalance(pubkey);
    const solAmount = solBalance / 1_000_000_000; // Convert lamports to SOL
    
    // Get token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubkey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    // Process token balances
    const tokens: Record<string, number> = {};
    
    for (const { account } of tokenAccounts.value) {
      const parsedInfo = account.data.parsed.info;
      const mintAddress = parsedInfo.mint;
      const tokenAmount = parsedInfo.tokenAmount.uiAmount;
      
      // Skip empty accounts
      if (tokenAmount === 0) continue;
      
      // Use token symbol if available, otherwise use mint address
      const tokenSymbol = TOKEN_MAP[mintAddress] || mintAddress.slice(0, 6);
      tokens[tokenSymbol] = tokenAmount;
    }
    
    return {
      sol: solAmount,
      tokens
    };
  } catch (error) {
    logger.error(`[BalanceTracker] Error getting wallet balance: ${error}`);
    return {
      sol: 0,
      tokens: {}
    };
  }
}

/**
 * Monitor balances for changes
 */
async function monitorBalances(): Promise<void> {
  try {
    const connection = getManagedConnection();
    
    // Wallets to monitor
    const wallets = [
      { address: TRADING_WALLET, name: 'Trading Wallet' },
      { address: PROFIT_WALLET, name: 'Prophet Wallet' }
    ];
    
    for (const wallet of wallets) {
      // Get current balance
      const currentBalance = await getWalletBalance(connection, wallet.address);
      
      // Get cached balance
      const cachedBalance = balanceCache.get(wallet.address);
      
      if (cachedBalance) {
        // Check for changes
        const changes = detectBalanceChanges(cachedBalance, currentBalance);
        
        if (changes.length > 0) {
          // Get recent transaction signature
          const signature = await getRecentTransactionSignature(connection, wallet.address);
          
          // Log balance change
          const balanceChange: BalanceChange = {
            wallet: wallet.address,
            walletName: wallet.name,
            timestamp: new Date().toISOString(),
            changes,
            transactionSignature: signature
          };
          
          // Log to console and file
          logBalanceChange(balanceChange);
        }
      }
      
      // Update cache with current balance
      balanceCache.set(wallet.address, {
        address: wallet.address,
        name: wallet.name,
        sol: currentBalance.sol,
        tokens: currentBalance.tokens,
        lastUpdated: Date.now()
      });
    }
  } catch (error) {
    logger.error(`[BalanceTracker] Error monitoring balances: ${error}`);
  }
}

/**
 * Detect balance changes between cached and current balance
 */
function detectBalanceChanges(
  cachedBalance: WalletBalance,
  currentBalance: { sol: number; tokens: Record<string, number> }
): Array<{
  token: string;
  previousAmount: number;
  newAmount: number;
  change: number;
  changePercent: number;
}> {
  const changes = [];
  
  // Check SOL balance
  const solChange = currentBalance.sol - cachedBalance.sol;
  if (Math.abs(solChange) > 0.00001) { // Threshold to ignore dust
    changes.push({
      token: 'SOL',
      previousAmount: cachedBalance.sol,
      newAmount: currentBalance.sol,
      change: solChange,
      changePercent: (solChange / cachedBalance.sol) * 100
    });
  }
  
  // Check token balances
  const allTokens = new Set([
    ...Object.keys(cachedBalance.tokens),
    ...Object.keys(currentBalance.tokens)
  ]);
  
  for (const token of allTokens) {
    const previousAmount = cachedBalance.tokens[token] || 0;
    const newAmount = currentBalance.tokens[token] || 0;
    const change = newAmount - previousAmount;
    
    if (Math.abs(change) > 0.00001) { // Threshold to ignore dust
      changes.push({
        token,
        previousAmount,
        newAmount,
        change,
        changePercent: previousAmount === 0 ? 100 : (change / previousAmount) * 100
      });
    }
  }
  
  return changes;
}

/**
 * Get the most recent transaction signature for a wallet
 */
async function getRecentTransactionSignature(connection: Connection, address: string): Promise<string | undefined> {
  try {
    const pubkey = new PublicKey(address);
    const transactions = await connection.getSignaturesForAddress(pubkey, { limit: 1 });
    
    if (transactions && transactions.length > 0) {
      return transactions[0].signature;
    }
    
    return undefined;
  } catch (error) {
    logger.error(`[BalanceTracker] Error getting recent transaction: ${error}`);
    return undefined;
  }
}

/**
 * Log balance change to console and file
 */
function logBalanceChange(balanceChange: BalanceChange): void {
  try {
    // Format for console output
    const formattedChanges = balanceChange.changes.map(change => {
      const sign = change.change > 0 ? '+' : '';
      return `${change.token}: ${sign}${change.change.toFixed(6)} (${sign}${change.changePercent.toFixed(2)}%)`;
    }).join(', ');
    
    // Console log
    logger.info(`💰 BALANCE UPDATE for ${balanceChange.walletName} (${balanceChange.wallet.substring(0, 4)}...${balanceChange.wallet.substring(balanceChange.wallet.length - 4)}):`);
    logger.info(`▶️ ${formattedChanges}`);
    
    if (balanceChange.transactionSignature) {
      logger.info(`🔗 Transaction: https://solscan.io/tx/${balanceChange.transactionSignature}`);
    }
    
    // Write to log file
    let logData: BalanceChange[] = [];
    
    if (fs.existsSync(BALANCE_LOG_PATH)) {
      try {
        const fileData = fs.readFileSync(BALANCE_LOG_PATH, 'utf8');
        logData = JSON.parse(fileData);
      } catch (error) {
        logger.error(`[BalanceTracker] Error reading balance log: ${error}`);
      }
    }
    
    // Add new entry
    logData.push(balanceChange);
    
    // Keep only the most recent 1000 entries
    if (logData.length > 1000) {
      logData = logData.slice(-1000);
    }
    
    // Write back to file
    fs.writeFileSync(BALANCE_LOG_PATH, JSON.stringify(logData, null, 2), 'utf8');
  } catch (error) {
    logger.error(`[BalanceTracker] Error logging balance change: ${error}`);
  }
}

/**
 * Get current wallet balances
 */
export async function getCurrentBalances(): Promise<Record<string, WalletBalance>> {
  const result: Record<string, WalletBalance> = {};
  
  for (const [address, balance] of balanceCache.entries()) {
    result[address] = { ...balance };
  }
  
  return result;
}

/**
 * Get recent balance changes
 */
export function getRecentBalanceChanges(limit: number = 10): BalanceChange[] {
  try {
    if (fs.existsSync(BALANCE_LOG_PATH)) {
      const fileData = fs.readFileSync(BALANCE_LOG_PATH, 'utf8');
      const logData: BalanceChange[] = JSON.parse(fileData);
      
      // Return most recent entries
      return logData.slice(-limit).reverse();
    }
  } catch (error) {
    logger.error(`[BalanceTracker] Error reading recent balance changes: ${error}`);
  }
  
  return [];
}

/**
 * Force an immediate balance check
 */
export async function checkBalancesNow(): Promise<void> {
  logger.info('[BalanceTracker] Performing immediate balance check');
  await monitorBalances();
}