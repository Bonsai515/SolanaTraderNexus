/**
 * Wallet Balance Monitor
 * 
 * This module monitors wallet balances and token holdings, 
 * with stop-loss protection for risk management.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as logger from './logger';
import { getManagedConnection } from './lib/rpcConnectionManager';
import * as fs from 'fs';
import * as path from 'path';

// Configuration paths
const CONFIG_DIR = './server/config';
const WALLETS_DIR = './data/wallets';
const BALANCE_HISTORY_PATH = path.join('./data', 'balance-history.json');
const STOP_LOSS_CONFIG_PATH = path.join(CONFIG_DIR, 'stop-loss.json');

// Balance monitor configuration
interface BalanceMonitorConfig {
  enabled: boolean;
  monitoringIntervalMs: number;
  alertThresholdPercentage: number;
  wallets: {
    address: string;
    name: string;
    initialBalance?: number;
    lowBalanceThreshold?: number;
  }[];
  tokens: {
    address: string;
    symbol: string;
    decimals: number;
    minRequired?: number;
  }[];
}

// Stop-loss configuration
interface StopLossConfig {
  enabled: boolean;
  globalStopLossPercentage: number; // Global stop-loss threshold (e.g., 3%)
  takeProfitPercentage: number;     // Take profit threshold (e.g., 5%)
  tokenSpecificRules: {
    [symbol: string]: {
      stopLossPercentage: number;
      takeProfitPercentage: number;
    };
  };
  maxDailyLossPercentage: number;   // Maximum daily loss allowed (e.g., 5%)
  pauseTradingOnStopLoss: boolean;  // Pause all trading when stop loss triggered
  pauseDurationMinutes: number;     // How long to pause trading
}

// Token balance
interface TokenBalance {
  address: string;
  symbol: string;
  amount: number;
  valueUSD?: number;
}

// Wallet data
interface WalletData {
  address: string;
  name: string;
  balanceSOL: number;
  previousBalanceSOL?: number;
  changePercentage?: number;
  tokens: TokenBalance[];
  lastUpdated: string;
}

// Balance history entry
interface BalanceHistoryEntry {
  timestamp: string;
  wallets: {
    address: string;
    name: string;
    balanceSOL: number;
  }[];
  totalBalanceSOL: number;
}

// Default configuration
const DEFAULT_CONFIG: BalanceMonitorConfig = {
  enabled: true,
  monitoringIntervalMs: 60000, // 1 minute
  alertThresholdPercentage: 5,
  wallets: [
    {
      address: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
      name: 'Trading Wallet',
      lowBalanceThreshold: 0.05
    },
    {
      address: '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e',
      name: 'Prophet Wallet'
    }
  ],
  tokens: [
    {
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      decimals: 6,
      minRequired: 10
    },
    {
      address: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      decimals: 9,
      minRequired: 0.05
    }
  ]
};

// Default stop-loss configuration
const DEFAULT_STOP_LOSS_CONFIG: StopLossConfig = {
  enabled: true,
  globalStopLossPercentage: 3,
  takeProfitPercentage: 5,
  tokenSpecificRules: {
    'BONK': {
      stopLossPercentage: 5,
      takeProfitPercentage: 7
    },
    'JUP': {
      stopLossPercentage: 4,
      takeProfitPercentage: 6
    }
  },
  maxDailyLossPercentage: 5,
  pauseTradingOnStopLoss: true,
  pauseDurationMinutes: 30
};

// Global instance
let instance: WalletBalanceMonitor | null = null;

/**
 * Wallet Balance Monitor
 */
export class WalletBalanceMonitor {
  private config: BalanceMonitorConfig;
  private stopLossConfig: StopLossConfig;
  private connection: Connection;
  private walletData: Map<string, WalletData> = new Map();
  private balanceHistory: BalanceHistoryEntry[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private tradingPaused: boolean = false;
  private pauseEndTime?: Date;
  private dailyLossStartBalance: number = 0;
  private dailyLossTrackingDate: string = '';

  /**
   * Constructor
   */
  private constructor() {
    // Load configuration
    this.loadConfig();
    this.loadStopLossConfig();
    
    // Get a managed connection
    this.connection = getManagedConnection({
      commitment: 'confirmed'
    });
    
    // Load balance history
    this.loadBalanceHistory();
    
    logger.info(`[WalletMonitor] Initialized with ${this.config.wallets.length} wallets and ${this.config.tokens.length} tokens`);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): WalletBalanceMonitor {
    if (!instance) {
      instance = new WalletBalanceMonitor();
    }
    return instance;
  }

  /**
   * Load configuration
   */
  private loadConfig(): void {
    try {
      const configPath = path.join(CONFIG_DIR, 'wallet-monitor.json');
      
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf8');
        this.config = JSON.parse(data);
      } else {
        this.config = DEFAULT_CONFIG;
        this.saveConfig();
      }
    } catch (error) {
      logger.error(`[WalletMonitor] Error loading configuration: ${error}`);
      this.config = DEFAULT_CONFIG;
      this.saveConfig();
    }
  }

  /**
   * Save configuration
   */
  private saveConfig(): void {
    try {
      const configPath = path.join(CONFIG_DIR, 'wallet-monitor.json');
      
      // Ensure directory exists
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      logger.error(`[WalletMonitor] Error saving configuration: ${error}`);
    }
  }

  /**
   * Load stop-loss configuration
   */
  private loadStopLossConfig(): void {
    try {
      if (fs.existsSync(STOP_LOSS_CONFIG_PATH)) {
        const data = fs.readFileSync(STOP_LOSS_CONFIG_PATH, 'utf8');
        this.stopLossConfig = JSON.parse(data);
      } else {
        this.stopLossConfig = DEFAULT_STOP_LOSS_CONFIG;
        this.saveStopLossConfig();
      }
    } catch (error) {
      logger.error(`[WalletMonitor] Error loading stop-loss configuration: ${error}`);
      this.stopLossConfig = DEFAULT_STOP_LOSS_CONFIG;
      this.saveStopLossConfig();
    }
  }

  /**
   * Save stop-loss configuration
   */
  private saveStopLossConfig(): void {
    try {
      // Ensure directory exists
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      
      fs.writeFileSync(STOP_LOSS_CONFIG_PATH, JSON.stringify(this.stopLossConfig, null, 2));
    } catch (error) {
      logger.error(`[WalletMonitor] Error saving stop-loss configuration: ${error}`);
    }
  }

  /**
   * Load balance history
   */
  private loadBalanceHistory(): void {
    try {
      if (fs.existsSync(BALANCE_HISTORY_PATH)) {
        const data = fs.readFileSync(BALANCE_HISTORY_PATH, 'utf8');
        this.balanceHistory = JSON.parse(data);
        
        logger.info(`[WalletMonitor] Loaded ${this.balanceHistory.length} balance history entries`);
      }
    } catch (error) {
      logger.error(`[WalletMonitor] Error loading balance history: ${error}`);
      this.balanceHistory = [];
    }
  }

  /**
   * Save balance history
   */
  private saveBalanceHistory(): void {
    try {
      // Ensure directory exists
      const historyDir = path.dirname(BALANCE_HISTORY_PATH);
      if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
      }
      
      // Keep only the last 1000 entries to prevent file from growing too large
      const limitedHistory = this.balanceHistory.slice(-1000);
      fs.writeFileSync(BALANCE_HISTORY_PATH, JSON.stringify(limitedHistory, null, 2));
    } catch (error) {
      logger.error(`[WalletMonitor] Error saving balance history: ${error}`);
    }
  }

  /**
   * Start monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    // Start tracking daily loss from the current balance
    this.initializeDailyLossTracking();
    
    // Immediately check balances
    this.checkAllWalletBalances();
    
    // Set up regular monitoring
    this.monitoringInterval = setInterval(() => {
      this.checkAllWalletBalances();
    }, this.config.monitoringIntervalMs);
    
    logger.info(`[WalletMonitor] Started wallet balance monitoring at ${this.config.monitoringIntervalMs}ms intervals`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      logger.info('[WalletMonitor] Stopped wallet balance monitoring');
    }
  }

  /**
   * Check all wallet balances
   */
  async checkAllWalletBalances(): Promise<Map<string, WalletData>> {
    try {
      // Reset wallet data map
      this.walletData.clear();
      
      // Track total balance
      let totalBalanceSOL = 0;
      
      // Check wallet balances
      const walletPromises = this.config.wallets.map(async wallet => {
        const walletData = await this.checkWalletBalance(wallet.address);
        
        if (walletData) {
          walletData.name = wallet.name;
          this.walletData.set(wallet.address, walletData);
          totalBalanceSOL += walletData.balanceSOL;
          
          // Check for low balance
          if (wallet.lowBalanceThreshold && walletData.balanceSOL < wallet.lowBalanceThreshold) {
            logger.warn(`[WalletMonitor] Low balance alert: ${wallet.name} (${wallet.address}) has only ${walletData.balanceSOL} SOL`);
          }
        }
      });
      
      await Promise.all(walletPromises);
      
      // Record balance history
      const historyEntry: BalanceHistoryEntry = {
        timestamp: new Date().toISOString(),
        wallets: Array.from(this.walletData.values()).map(wallet => ({
          address: wallet.address,
          name: wallet.name,
          balanceSOL: wallet.balanceSOL
        })),
        totalBalanceSOL
      };
      
      this.balanceHistory.push(historyEntry);
      this.saveBalanceHistory();
      
      // Check for stop loss
      this.checkDailyLoss(totalBalanceSOL);
      
      return this.walletData;
    } catch (error) {
      logger.error(`[WalletMonitor] Error checking wallet balances: ${error}`);
      return new Map();
    }
  }

  /**
   * Check individual wallet balance
   */
  async checkWalletBalance(walletAddress: string): Promise<WalletData | null> {
    try {
      // Get previous data if exists
      const previousData = this.walletData.get(walletAddress);
      
      // Create wallet public key
      const publicKey = new PublicKey(walletAddress);
      
      // Get SOL balance
      const balance = await this.connection.getBalance(publicKey);
      const balanceSOL = balance / LAMPORTS_PER_SOL;
      
      // Calculate change percentage if previous data exists
      let changePercentage = undefined;
      
      if (previousData && previousData.balanceSOL > 0) {
        changePercentage = ((balanceSOL - previousData.balanceSOL) / previousData.balanceSOL) * 100;
        
        // Check for significant balance changes
        if (Math.abs(changePercentage) >= this.config.alertThresholdPercentage) {
          const changeType = changePercentage > 0 ? 'increased' : 'decreased';
          logger.info(`[WalletMonitor] Balance ${changeType} by ${Math.abs(changePercentage).toFixed(2)}% for ${walletAddress}`);
        }
      }
      
      // Create wallet data
      const walletData: WalletData = {
        address: walletAddress,
        name: previousData?.name || 'Unknown Wallet',
        balanceSOL,
        previousBalanceSOL: previousData?.balanceSOL,
        changePercentage,
        tokens: [],
        lastUpdated: new Date().toISOString()
      };
      
      // Get token balances
      const tokenPromises = this.config.tokens.map(async token => {
        try {
          // Get token balance
          // (This is a simplified version - in a real implementation, 
          // use the SPL Token program to get actual token balances)
          const tokenBalance: TokenBalance = {
            address: token.address,
            symbol: token.symbol,
            amount: 0
          };
          
          walletData.tokens.push(tokenBalance);
          
          // Check for minimum required
          if (token.minRequired && tokenBalance.amount < token.minRequired) {
            logger.warn(`[WalletMonitor] Low token balance alert: ${token.symbol} in wallet ${walletData.name} (${walletAddress}) below minimum threshold of ${token.minRequired}`);
          }
        } catch (tokenError) {
          logger.error(`[WalletMonitor] Error getting token balance for ${token.symbol}: ${tokenError}`);
        }
      });
      
      await Promise.all(tokenPromises);
      
      return walletData;
    } catch (error) {
      logger.error(`[WalletMonitor] Error checking wallet balance for ${walletAddress}: ${error}`);
      return null;
    }
  }

  /**
   * Initialize daily loss tracking
   */
  private initializeDailyLossTracking(): void {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // If we're on a new day or haven't started tracking yet
    if (this.dailyLossTrackingDate !== today) {
      // Get current total balance
      let totalBalance = 0;
      
      // Sum up balances from all wallets
      if (this.balanceHistory.length > 0) {
        totalBalance = this.balanceHistory[this.balanceHistory.length - 1].totalBalanceSOL;
      } else {
        // No history yet, need to fetch current balance
        this.config.wallets.forEach(wallet => {
          const walletData = this.walletData.get(wallet.address);
          if (walletData) {
            totalBalance += walletData.balanceSOL;
          }
        });
      }
      
      // Set start balance and date
      this.dailyLossStartBalance = totalBalance;
      this.dailyLossTrackingDate = today;
      
      logger.info(`[WalletMonitor] Started daily loss tracking with base balance: ${this.dailyLossStartBalance} SOL`);
    }
  }

  /**
   * Check daily loss against stop-loss configuration
   */
  private checkDailyLoss(currentTotalBalance: number): void {
    if (!this.stopLossConfig.enabled || this.dailyLossStartBalance <= 0) {
      return;
    }
    
    // Calculate current loss percentage
    const changePercentage = ((currentTotalBalance - this.dailyLossStartBalance) / this.dailyLossStartBalance) * 100;
    
    // Check if loss exceeds maximum daily loss percentage
    if (changePercentage < -this.stopLossConfig.maxDailyLossPercentage) {
      logger.warn(`[WalletMonitor] STOP LOSS TRIGGERED: Daily loss of ${Math.abs(changePercentage).toFixed(2)}% exceeds maximum allowed ${this.stopLossConfig.maxDailyLossPercentage}%`);
      
      // Pause trading if configured
      if (this.stopLossConfig.pauseTradingOnStopLoss) {
        this.pauseTrading();
      }
    }
  }

  /**
   * Pause trading
   */
  pauseTrading(): void {
    if (this.tradingPaused) {
      return;
    }
    
    this.tradingPaused = true;
    
    // Calculate pause end time
    const pauseEndTime = new Date();
    pauseEndTime.setMinutes(pauseEndTime.getMinutes() + this.stopLossConfig.pauseDurationMinutes);
    this.pauseEndTime = pauseEndTime;
    
    logger.warn(`[WalletMonitor] Trading paused until ${this.pauseEndTime.toISOString()}`);
  }

  /**
   * Resume trading
   */
  resumeTrading(): void {
    if (!this.tradingPaused) {
      return;
    }
    
    this.tradingPaused = false;
    this.pauseEndTime = undefined;
    
    logger.info('[WalletMonitor] Trading resumed');
  }

  /**
   * Check if trading is paused
   */
  isTradingPaused(): boolean {
    // If not paused, return false
    if (!this.tradingPaused) {
      return false;
    }
    
    // If pause end time has passed, automatically resume
    if (this.pauseEndTime && new Date() > this.pauseEndTime) {
      this.resumeTrading();
      return false;
    }
    
    return true;
  }

  /**
   * Get wallet data
   */
  getWalletData(): Map<string, WalletData> {
    return this.walletData;
  }

  /**
   * Get balance history
   */
  getBalanceHistory(): BalanceHistoryEntry[] {
    return this.balanceHistory;
  }

  /**
   * Update stop-loss configuration
   */
  updateStopLossConfig(newConfig: Partial<StopLossConfig>): void {
    this.stopLossConfig = { ...this.stopLossConfig, ...newConfig };
    this.saveStopLossConfig();
    logger.info(`[WalletMonitor] Stop-loss configuration updated`);
  }

  /**
   * Get time remaining on trading pause
   */
  getPauseTimeRemaining(): number {
    if (!this.tradingPaused || !this.pauseEndTime) {
      return 0;
    }
    
    const now = new Date();
    const remainingMs = this.pauseEndTime.getTime() - now.getTime();
    
    return Math.max(0, Math.floor(remainingMs / 1000));
  }

  /**
   * Check stop loss for a specific token
   */
  checkStopLoss(token: string, entryPrice: number, currentPrice: number): boolean {
    if (!this.stopLossConfig.enabled) {
      return false;
    }
    
    // Calculate percentage change
    const changePercentage = ((currentPrice - entryPrice) / entryPrice) * 100;
    
    // Get token-specific rules or use global default
    const stopLossPercentage = this.stopLossConfig.tokenSpecificRules[token]?.stopLossPercentage || 
                             this.stopLossConfig.globalStopLossPercentage;
    
    // Check if loss exceeds stop-loss threshold
    if (changePercentage < -stopLossPercentage) {
      logger.warn(`[WalletMonitor] STOP LOSS TRIGGERED for ${token}: Loss of ${Math.abs(changePercentage).toFixed(2)}% exceeds threshold ${stopLossPercentage}%`);
      return true;
    }
    
    return false;
  }

  /**
   * Check take profit for a specific token
   */
  checkTakeProfit(token: string, entryPrice: number, currentPrice: number): boolean {
    if (!this.stopLossConfig.enabled) {
      return false;
    }
    
    // Calculate percentage change
    const changePercentage = ((currentPrice - entryPrice) / entryPrice) * 100;
    
    // Get token-specific rules or use global default
    const takeProfitPercentage = this.stopLossConfig.tokenSpecificRules[token]?.takeProfitPercentage || 
                               this.stopLossConfig.takeProfitPercentage;
    
    // Check if profit exceeds take-profit threshold
    if (changePercentage > takeProfitPercentage) {
      logger.info(`[WalletMonitor] TAKE PROFIT TRIGGERED for ${token}: Profit of ${changePercentage.toFixed(2)}% exceeds threshold ${takeProfitPercentage}%`);
      return true;
    }
    
    return false;
  }
}

// Export singleton instance
export const walletMonitor = WalletBalanceMonitor.getInstance();

// Auto-start monitoring
walletMonitor.startMonitoring();