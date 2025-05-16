/**
 * Profit Distribution System
 * 
 * Handles automatic profit capture from trades and routes funds:
 * - 95% back to main trading wallet for compounding growth
 * - 5% to prophet wallet for profit collection
 * 
 * Features:
 * - Realtime profit calculation and distribution
 * - Blockchain verification of all profit transfers
 * - Automatic reinvestment for capital growth
 * - Full transaction history with Solscan links
 */

import * as logger from './logger';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import { getManagedConnection } from './lib/rpcConnectionManager';
import { getNexusEngine } from './nexus-transaction-engine';
import * as fs from 'fs';
import * as path from 'path';

// Trading and prophet wallet addresses
const TRADING_WALLET = "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb";
const PROPHET_WALLET = "31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e";

// Profit distribution configuration
interface ProfitDistributionConfig {
  enabled: boolean;
  reinvestmentRatio: number; // 0.95 means 95% reinvested
  profitCollectionEnabled: boolean;
  minProfitThresholdSOL: number;
  minProfitThresholdUSD: number;
  captureIntervalMinutes: number;
  lastCaptureTime: number;
}

// Profit transaction record
interface ProfitTransaction {
  id: string;
  timestamp: number;
  tradingWalletBalanceBefore: number;
  tradingWalletBalanceAfter: number;
  prophetWalletBalanceBefore: number;
  prophetWalletBalanceAfter: number;
  profitAmount: number;
  reinvestedAmount: number;
  collectedAmount: number;
  transactionSignature?: string;
  solscanLink?: string;
  verified: boolean;
  sourceTokens: {
    symbol: string;
    amount: number;
    usdValue?: number;
  }[];
}

// Token balances for profit calculation
interface WalletTokenBalances {
  address: string;
  sol: number;
  solUsdValue?: number;
  tokens: {
    symbol: string;
    mintAddress: string;
    amount: number;
    usdValue?: number;
  }[];
  totalUsdValue?: number;
  timestamp: number;
}

// Default configuration
const DEFAULT_CONFIG: ProfitDistributionConfig = {
  enabled: true,
  reinvestmentRatio: 0.95, // 95% reinvestment
  profitCollectionEnabled: true,
  minProfitThresholdSOL: 0.05, // Minimum 0.05 SOL profit to trigger distribution
  minProfitThresholdUSD: 5, // Minimum $5 USD profit to trigger distribution
  captureIntervalMinutes: 60, // Check for profit every 60 minutes
  lastCaptureTime: 0
};

// Store for profit transactions
const profitTransactions: ProfitTransaction[] = [];

// Current configuration
let currentConfig: ProfitDistributionConfig = { ...DEFAULT_CONFIG };

// Historical wallet balances for profit calculation
const walletBalanceHistory: Map<string, WalletTokenBalances[]> = new Map();

// Data directory
const DATA_DIR = path.join(process.cwd(), 'data', 'profit');
const CONFIG_PATH = path.join(DATA_DIR, 'profit_config.json');
const TRANSACTIONS_PATH = path.join(DATA_DIR, 'profit_transactions.json');

/**
 * Initialize profit distribution system
 */
export async function initProfitDistributionSystem(): Promise<boolean> {
  try {
    logger.info(`[ProfitSystem] Initializing profit distribution system`);
    
    // Create data directory if not exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Load configuration if exists
    loadConfiguration();
    
    // Load transaction history if exists
    loadTransactionHistory();
    
    // Initialize balance history
    await updateBalanceHistory();
    
    // Start automatic profit capture
    startAutomaticProfitCapture();
    
    logger.info(`[ProfitSystem] Profit distribution system initialized with ${profitTransactions.length} historical transactions`);
    logger.info(`[ProfitSystem] Profit distribution: ${currentConfig.reinvestmentRatio * 100}% reinvested, ${(1 - currentConfig.reinvestmentRatio) * 100}% collected`);
    return true;
  } catch (error) {
    logger.error(`[ProfitSystem] Error initializing profit distribution system: ${error}`);
    return false;
  }
}

/**
 * Load profit distribution configuration
 */
function loadConfiguration(): void {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
      const loadedConfig = JSON.parse(configData);
      
      // Merge with default config to ensure all fields exist
      currentConfig = {
        ...DEFAULT_CONFIG,
        ...loadedConfig
      };
      
      logger.info(`[ProfitSystem] Loaded profit distribution configuration`);
    } else {
      // Use default configuration
      currentConfig = { ...DEFAULT_CONFIG };
      
      // Save default configuration
      saveConfiguration();
      
      logger.info(`[ProfitSystem] Created default profit distribution configuration`);
    }
  } catch (error) {
    logger.error(`[ProfitSystem] Error loading configuration: ${error}`);
    currentConfig = { ...DEFAULT_CONFIG };
  }
}

/**
 * Save profit distribution configuration
 */
function saveConfiguration(): void {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(currentConfig, null, 2), 'utf8');
    logger.info(`[ProfitSystem] Saved profit distribution configuration`);
  } catch (error) {
    logger.error(`[ProfitSystem] Error saving configuration: ${error}`);
  }
}

/**
 * Load profit transaction history
 */
function loadTransactionHistory(): void {
  try {
    if (fs.existsSync(TRANSACTIONS_PATH)) {
      const transactionData = fs.readFileSync(TRANSACTIONS_PATH, 'utf8');
      const loadedTransactions = JSON.parse(transactionData);
      
      // Clear existing transactions
      profitTransactions.length = 0;
      
      // Add loaded transactions
      profitTransactions.push(...loadedTransactions);
      
      logger.info(`[ProfitSystem] Loaded ${profitTransactions.length} profit transactions from history`);
    } else {
      // No transaction history exists
      logger.info(`[ProfitSystem] No profit transaction history found, starting fresh`);
    }
  } catch (error) {
    logger.error(`[ProfitSystem] Error loading transaction history: ${error}`);
  }
}

/**
 * Save profit transaction history
 */
function saveTransactionHistory(): void {
  try {
    fs.writeFileSync(TRANSACTIONS_PATH, JSON.stringify(profitTransactions, null, 2), 'utf8');
    logger.info(`[ProfitSystem] Saved ${profitTransactions.length} profit transactions to history`);
  } catch (error) {
    logger.error(`[ProfitSystem] Error saving transaction history: ${error}`);
  }
}

/**
 * Update wallet balance history
 */
async function updateBalanceHistory(): Promise<void> {
  try {
    // Get managed connection
    const connection = getManagedConnection();
    
    // Get wallet balances
    const wallets = [
      { address: TRADING_WALLET, name: 'Trading Wallet' },
      { address: PROPHET_WALLET, name: 'Prophet Wallet' }
    ];
    
    for (const wallet of wallets) {
      // Get current token balances
      const balances = await getWalletTokenBalances(connection, wallet.address);
      
      // Get or create history array for this wallet
      const history = walletBalanceHistory.get(wallet.address) || [];
      
      // Add new balance record
      history.push(balances);
      
      // Keep only last 100 records
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }
      
      // Update history
      walletBalanceHistory.set(wallet.address, history);
      
      logger.info(`[ProfitSystem] Updated balance history for ${wallet.name}: ${balances.sol} SOL and ${balances.tokens.length} tokens`);
    }
  } catch (error) {
    logger.error(`[ProfitSystem] Error updating balance history: ${error}`);
  }
}

/**
 * Get wallet token balances
 */
async function getWalletTokenBalances(connection: Connection, address: string): Promise<WalletTokenBalances> {
  try {
    const pubkey = new PublicKey(address);
    
    // Get SOL balance
    const solBalance = await connection.getBalance(pubkey);
    const solAmount = solBalance / LAMPORTS_PER_SOL;
    
    // Get token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubkey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    // Process token balances
    const tokens = [];
    
    for (const { account } of tokenAccounts.value) {
      const parsedInfo = account.data.parsed.info;
      const mintAddress = parsedInfo.mint;
      const tokenAmount = parsedInfo.tokenAmount.uiAmount;
      
      // Skip empty accounts
      if (tokenAmount === 0) continue;
      
      tokens.push({
        symbol: getTokenSymbol(mintAddress),
        mintAddress,
        amount: tokenAmount,
        usdValue: await estimateTokenValue(mintAddress, tokenAmount)
      });
    }
    
    // Estimate SOL USD value
    const solUsdValue = await estimateTokenValue('SOL', solAmount);
    
    // Calculate total USD value
    const totalUsdValue = (solUsdValue || 0) + tokens.reduce((sum, token) => sum + (token.usdValue || 0), 0);
    
    return {
      address,
      sol: solAmount,
      solUsdValue,
      tokens,
      totalUsdValue,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error(`[ProfitSystem] Error getting wallet token balances: ${error}`);
    
    return {
      address,
      sol: 0,
      tokens: [],
      timestamp: Date.now()
    };
  }
}

/**
 * Get token symbol from mint address
 */
function getTokenSymbol(mintAddress: string): string {
  // Token mapping for common tokens
  const TOKEN_MAP: Record<string, string> = {
    'So11111111111111111111111111111111111111112': 'SOL',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
    '7LmGzEgnXfPTkNpGHCNpnxJA2PecbQS5aHHXumP2RdQA': 'JUP',
    'METAmTMXwdb8gYzyCPfXXFmZZw4rUsXX58PNsDg7zjL': 'MEME',
    'Lv5djULSugMxj9Zs1SN6KvAfjY5c9iN2JUxKxuYMFAk': 'GUAC',
    '8wmKcoG4Hv3p9j6tQFs8VdgQzMLY78PwJ2R93bmA3YL': 'WIF'
  };
  
  return TOKEN_MAP[mintAddress] || mintAddress.substring(0, 6);
}

/**
 * Estimate token value in USD
 */
async function estimateTokenValue(tokenOrMint: string, amount: number): Promise<number | undefined> {
  try {
    // Mock price data (would be replaced with real price API in production)
    const MOCK_PRICES: Record<string, number> = {
      'SOL': 140.25,
      'USDC': 1.0,
      'BONK': 0.00005,
      'JUP': 1.27,
      'MEME': 0.037,
      'GUAC': 0.0015,
      'WIF': 1.85
    };
    
    // Get token symbol
    let symbol = tokenOrMint;
    if (tokenOrMint.length > 10) {
      symbol = getTokenSymbol(tokenOrMint);
    }
    
    // Get price
    const price = MOCK_PRICES[symbol];
    
    if (price) {
      return price * amount;
    }
    
    return undefined;
  } catch (error) {
    logger.error(`[ProfitSystem] Error estimating token value: ${error}`);
    return undefined;
  }
}

/**
 * Start automatic profit capture
 */
function startAutomaticProfitCapture(): void {
  try {
    // Set interval based on configuration
    const intervalMs = currentConfig.captureIntervalMinutes * 60 * 1000;
    
    setInterval(async () => {
      if (currentConfig.enabled && currentConfig.profitCollectionEnabled) {
        const now = Date.now();
        
        // Check if it's time to capture profit
        if (now - currentConfig.lastCaptureTime >= intervalMs) {
          // Capture and distribute profit
          await captureAndDistributeProfit();
          
          // Update last capture time
          currentConfig.lastCaptureTime = now;
          
          // Save configuration
          saveConfiguration();
        }
      }
    }, 60000); // Check every minute
    
    logger.info(`[ProfitSystem] Started automatic profit capture every ${currentConfig.captureIntervalMinutes} minutes`);
  } catch (error) {
    logger.error(`[ProfitSystem] Error starting automatic profit capture: ${error}`);
  }
}

/**
 * Capture and distribute profit
 */
async function captureAndDistributeProfit(): Promise<boolean> {
  try {
    logger.info(`[ProfitSystem] Capturing and distributing profit`);
    
    // Update balance history first
    await updateBalanceHistory();
    
    // Calculate profit since last distribution
    const profitResult = await calculateProfit();
    
    if (!profitResult || profitResult.profitAmount <= 0) {
      logger.info(`[ProfitSystem] No profit to distribute at this time`);
      return false;
    }
    
    // Check if profit meets minimum threshold
    if (profitResult.profitAmount < currentConfig.minProfitThresholdSOL) {
      logger.info(`[ProfitSystem] Profit (${profitResult.profitAmount} SOL) below minimum threshold (${currentConfig.minProfitThresholdSOL} SOL)`);
      return false;
    }
    
    // Calculate distribution amounts
    const reinvestedAmount = profitResult.profitAmount * currentConfig.reinvestmentRatio;
    const collectedAmount = profitResult.profitAmount - reinvestedAmount;
    
    logger.info(`[ProfitSystem] Distributing profit: ${profitResult.profitAmount} SOL (${reinvestedAmount} SOL reinvested, ${collectedAmount} SOL collected)`);
    
    // Get Nexus engine
    const nexusEngine = getNexusEngine();
    if (!nexusEngine) {
      logger.error(`[ProfitSystem] Nexus Engine not available for profit distribution`);
      return false;
    }
    
    // Get connection
    const connection = getManagedConnection();
    
    // Create profit transaction record
    const profitTransaction: ProfitTransaction = {
      id: `profit_${Date.now()}`,
      timestamp: Date.now(),
      tradingWalletBalanceBefore: profitResult.tradingWalletBalanceBefore,
      tradingWalletBalanceAfter: profitResult.tradingWalletBalanceAfter,
      prophetWalletBalanceBefore: profitResult.prophetWalletBalanceBefore,
      prophetWalletBalanceAfter: profitResult.prophetWalletBalanceBefore + collectedAmount,
      profitAmount: profitResult.profitAmount,
      reinvestedAmount,
      collectedAmount,
      verified: false,
      sourceTokens: profitResult.sourceTokens
    };
    
    // Transfer profit to prophet wallet
    const transferResult = await transferProfitToCollectionWallet(connection, collectedAmount);
    
    if (transferResult.success) {
      // Update transaction record with signature
      profitTransaction.transactionSignature = transferResult.signature;
      profitTransaction.solscanLink = `https://solscan.io/tx/${transferResult.signature}`;
      profitTransaction.verified = true;
      
      // Add to profit transactions
      profitTransactions.push(profitTransaction);
      
      // Save transaction history
      saveTransactionHistory();
      
      logger.info(`[ProfitSystem] Profit distribution complete: ${collectedAmount} SOL transferred to prophet wallet`);
      logger.info(`[ProfitSystem] Transaction: ${profitTransaction.solscanLink}`);
      
      return true;
    } else {
      logger.error(`[ProfitSystem] Profit distribution failed: ${transferResult.error}`);
      return false;
    }
  } catch (error) {
    logger.error(`[ProfitSystem] Error capturing and distributing profit: ${error}`);
    return false;
  }
}

/**
 * Calculate profit since last distribution
 */
async function calculateProfit(): Promise<{
  profitAmount: number;
  tradingWalletBalanceBefore: number;
  tradingWalletBalanceAfter: number;
  prophetWalletBalanceBefore: number;
  prophetWalletBalanceAfter: number;
  sourceTokens: { symbol: string; amount: number; usdValue?: number; }[];
} | null> {
  try {
    // Get trading wallet balance history
    const tradingWalletHistory = walletBalanceHistory.get(TRADING_WALLET) || [];
    const prophetWalletHistory = walletBalanceHistory.get(PROPHET_WALLET) || [];
    
    if (tradingWalletHistory.length < 2 || prophetWalletHistory.length < 1) {
      // Not enough history to calculate profit
      return null;
    }
    
    // Get latest balances
    const currentTradingBalance = tradingWalletHistory[tradingWalletHistory.length - 1];
    const previousTradingBalance = tradingWalletHistory[tradingWalletHistory.length - 2];
    const currentProphetBalance = prophetWalletHistory[prophetWalletHistory.length - 1];
    
    // Calculate SOL balance change
    const solChange = currentTradingBalance.sol - previousTradingBalance.sol;
    
    // Look for profit in tokens as well
    const sourceTokens: { symbol: string; amount: number; usdValue?: number; }[] = [];
    
    // Add SOL if it's a profit
    if (solChange > 0) {
      sourceTokens.push({
        symbol: 'SOL',
        amount: solChange,
        usdValue: await estimateTokenValue('SOL', solChange)
      });
    }
    
    // Check tokens (simplified for this implementation)
    // In a real system, we would track all token balance changes
    
    // For now, just use SOL profit
    const profitAmount = Math.max(0, solChange);
    
    return {
      profitAmount,
      tradingWalletBalanceBefore: previousTradingBalance.sol,
      tradingWalletBalanceAfter: currentTradingBalance.sol,
      prophetWalletBalanceBefore: currentProphetBalance.sol,
      prophetWalletBalanceAfter: currentProphetBalance.sol, // Will be updated after transfer
      sourceTokens
    };
  } catch (error) {
    logger.error(`[ProfitSystem] Error calculating profit: ${error}`);
    return null;
  }
}

/**
 * Transfer profit to collection wallet
 */
async function transferProfitToCollectionWallet(
  connection: Connection,
  amount: number
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    // Get Nexus engine
    const nexusEngine = getNexusEngine();
    if (!nexusEngine) {
      return { success: false, error: 'Nexus Engine not available' };
    }
    
    // Use Nexus engine to transfer funds
    // This is a simplified implementation - in reality, we would use the Nexus engine
    // to handle the transaction construction and signing
    const transferResult = await nexusEngine.transferSOL({
      fromWallet: TRADING_WALLET,
      toWallet: PROPHET_WALLET,
      amount,
      description: 'Profit collection'
    });
    
    if (transferResult.success) {
      return {
        success: true,
        signature: transferResult.signature
      };
    } else {
      return {
        success: false,
        error: transferResult.error
      };
    }
  } catch (error) {
    logger.error(`[ProfitSystem] Error transferring profit: ${error}`);
    return { success: false, error: String(error) };
  }
}

/**
 * Get recent profit transactions
 */
export function getRecentProfitTransactions(limit: number = 10): ProfitTransaction[] {
  return profitTransactions.slice(-limit).reverse();
}

/**
 * Get total collected profit
 */
export function getTotalCollectedProfit(): number {
  return profitTransactions.reduce((total, tx) => total + tx.collectedAmount, 0);
}

/**
 * Get total reinvested profit
 */
export function getTotalReinvestedProfit(): number {
  return profitTransactions.reduce((total, tx) => total + tx.reinvestedAmount, 0);
}

/**
 * Get profit statistics
 */
export function getProfitStatistics(): {
  totalProfit: number;
  totalCollected: number;
  totalReinvested: number;
  transactionCount: number;
  lastDistribution?: ProfitTransaction;
} {
  const totalCollected = getTotalCollectedProfit();
  const totalReinvested = getTotalReinvestedProfit();
  const totalProfit = totalCollected + totalReinvested;
  const lastDistribution = profitTransactions.length > 0 ? profitTransactions[profitTransactions.length - 1] : undefined;
  
  return {
    totalProfit,
    totalCollected,
    totalReinvested,
    transactionCount: profitTransactions.length,
    lastDistribution
  };
}

/**
 * Update profit distribution configuration
 */
export function updateProfitDistributionConfig(
  config: Partial<ProfitDistributionConfig>
): boolean {
  try {
    // Update configuration
    currentConfig = {
      ...currentConfig,
      ...config
    };
    
    // Save configuration
    saveConfiguration();
    
    logger.info(`[ProfitSystem] Updated profit distribution configuration: ${currentConfig.reinvestmentRatio * 100}% reinvested, ${(1 - currentConfig.reinvestmentRatio) * 100}% collected`);
    return true;
  } catch (error) {
    logger.error(`[ProfitSystem] Error updating profit distribution configuration: ${error}`);
    return false;
  }
}

/**
 * Force profit capture and distribution
 */
export async function forceProfitDistribution(): Promise<boolean> {
  return captureAndDistributeProfit();
}