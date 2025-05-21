/**
 * Instant Profit Collection Module
 * 
 * This module provides instant profit collection after successful trades,
 * with automatic reinvestment functionality.
 */

import { Connection, Keypair, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as logger from '../logger';
import * as fs from 'fs';
import * as path from 'path';
import { getManagedConnection } from '../lib/rpcConnectionManager';
import { getNexusEngine } from '../nexus-transaction-engine';

// Configuration
const PROFIT_CONFIG_PATH = path.join('./data', 'profit-config.json');
const PROFIT_LOG_PATH = path.join('./logs', 'profit-collection.log');

// Default configuration
const DEFAULT_CONFIG = {
  enabled: true,
  reinvestmentRate: 0.95, // 95% reinvestment
  targetWallet: '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e', // Prophet wallet
  minProfitThreshold: 0.001 // Minimum SOL to collect
};

// Profit collection configuration
interface ProfitConfig {
  enabled: boolean;
  reinvestmentRate: number; // 0.0 to 1.0
  targetWallet: string;
  minProfitThreshold: number;
}

// Profit collection entry
interface ProfitEntry {
  timestamp: string;
  amount: number;
  token: string;
  sourceWallet: string;
  destinationWallet: string;
  transactionSignature?: string;
  reinvestedAmount?: number;
}

// Global instance
let instance: InstantProfitCollector | null = null;

/**
 * Instant Profit Collector class
 */
export class InstantProfitCollector {
  private config: ProfitConfig;
  private connection: Connection;
  private profitEntries: ProfitEntry[] = [];
  private totalCollected: number = 0;
  private isCollecting: boolean = false;

  /**
   * Constructor
   */
  private constructor() {
    // Load configuration
    this.loadConfig();
    
    // Get a managed connection
    this.connection = getManagedConnection({
      commitment: 'confirmed'
    });
    
    // Load previous profit entries
    this.loadProfitEntries();
    
    logger.info(`[ProfitCollector] Initialized with reinvestment rate: ${this.config.reinvestmentRate * 100}%`);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): InstantProfitCollector {
    if (!instance) {
      instance = new InstantProfitCollector();
    }
    return instance;
  }

  /**
   * Load configuration
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(PROFIT_CONFIG_PATH)) {
        const data = fs.readFileSync(PROFIT_CONFIG_PATH, 'utf8');
        this.config = JSON.parse(data);
      } else {
        this.config = DEFAULT_CONFIG;
        this.saveConfig();
      }
    } catch (error) {
      logger.error(`[ProfitCollector] Error loading configuration: ${error}`);
      this.config = DEFAULT_CONFIG;
      this.saveConfig();
    }
  }

  /**
   * Save configuration
   */
  private saveConfig(): void {
    try {
      const configDir = path.dirname(PROFIT_CONFIG_PATH);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(PROFIT_CONFIG_PATH, JSON.stringify(this.config, null, 2));
    } catch (error) {
      logger.error(`[ProfitCollector] Error saving configuration: ${error}`);
    }
  }

  /**
   * Load profit entries
   */
  private loadProfitEntries(): void {
    try {
      if (fs.existsSync(PROFIT_LOG_PATH)) {
        const data = fs.readFileSync(PROFIT_LOG_PATH, 'utf8');
        const lines = data.split('\n').filter(line => line.trim() !== '');
        
        this.profitEntries = lines.map(line => JSON.parse(line));
        this.totalCollected = this.profitEntries.reduce((sum, entry) => sum + entry.amount, 0);
        
        logger.info(`[ProfitCollector] Loaded ${this.profitEntries.length} profit entries, total: ${this.totalCollected} SOL`);
      }
    } catch (error) {
      logger.error(`[ProfitCollector] Error loading profit entries: ${error}`);
      this.profitEntries = [];
      this.totalCollected = 0;
    }
  }

  /**
   * Save profit entry
   */
  private saveProfitEntry(entry: ProfitEntry): void {
    try {
      const logDir = path.dirname(PROFIT_LOG_PATH);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      fs.appendFileSync(PROFIT_LOG_PATH, JSON.stringify(entry) + '\n');
      this.profitEntries.push(entry);
      this.totalCollected += entry.amount;
      
      logger.info(`[ProfitCollector] Profit collected: ${entry.amount} ${entry.token}, total: ${this.totalCollected} SOL`);
    } catch (error) {
      logger.error(`[ProfitCollector] Error saving profit entry: ${error}`);
    }
  }

  /**
   * Collect profit after a successful trade
   */
  async collectProfit(tradeResult: {
    success: boolean;
    signature?: string;
    token: string;
    amount: number;
    profit?: number;
  }): Promise<boolean> {
    if (!this.config.enabled || !tradeResult.success || !tradeResult.profit || tradeResult.profit <= 0) {
      return false;
    }
    
    // Skip if already collecting
    if (this.isCollecting) {
      logger.warn('[ProfitCollector] Already collecting profit, skipping');
      return false;
    }
    
    try {
      // Set collecting flag
      this.isCollecting = true;
      
      // Get trade profit
      const profitAmount = tradeResult.profit;
      
      // Check minimum threshold
      if (profitAmount < this.config.minProfitThreshold) {
        logger.info(`[ProfitCollector] Profit ${profitAmount} below threshold ${this.config.minProfitThreshold}, skipping`);
        this.isCollecting = false;
        return false;
      }
      
      // Calculate reinvestment amount
      const reinvestAmount = profitAmount * this.config.reinvestmentRate;
      const transferAmount = profitAmount - reinvestAmount;
      
      logger.info(`[ProfitCollector] Processing profit: ${profitAmount} SOL (Transfer: ${transferAmount} SOL, Reinvest: ${reinvestAmount} SOL)`);
      
      // Get engine instance
      const engine = getNexusEngine();
      
      // Get wallet data
      const tradingWallet = engine.getMainWalletAddress();
      const walletKeypair = await engine.getWalletKeypair();
      
      if (!tradingWallet || !walletKeypair) {
        logger.error('[ProfitCollector] Could not get wallet information');
        this.isCollecting = false;
        return false;
      }
      
      // Check if target wallet exists
      try {
        const targetPublicKey = new PublicKey(this.config.targetWallet);
      } catch (error) {
        logger.error(`[ProfitCollector] Invalid target wallet address: ${this.config.targetWallet}`);
        this.isCollecting = false;
        return false;
      }
      
      // Check if transfer amount is too small
      if (transferAmount < 0.001) {
        logger.info(`[ProfitCollector] Transfer amount ${transferAmount} too small, skipping transfer`);
        
        // Record profit entry without transfer
        const profitEntry: ProfitEntry = {
          timestamp: new Date().toISOString(),
          amount: profitAmount,
          token: tradeResult.token,
          sourceWallet: tradingWallet,
          destinationWallet: tradingWallet, // Same as source (no transfer)
          transactionSignature: 'reinvested-all',
          reinvestedAmount: profitAmount
        };
        
        this.saveProfitEntry(profitEntry);
        this.isCollecting = false;
        return true;
      }
      
      // Transfer profit to target wallet
      const transferSignature = await this.transferProfit(
        walletKeypair,
        this.config.targetWallet,
        transferAmount
      );
      
      if (transferSignature) {
        // Record profit entry
        const profitEntry: ProfitEntry = {
          timestamp: new Date().toISOString(),
          amount: profitAmount,
          token: tradeResult.token,
          sourceWallet: tradingWallet,
          destinationWallet: this.config.targetWallet,
          transactionSignature: transferSignature,
          reinvestedAmount: reinvestAmount
        };
        
        this.saveProfitEntry(profitEntry);
        logger.info(`[ProfitCollector] Profit collection successful: ${transferAmount} SOL transferred, ${reinvestAmount} SOL reinvested`);
        this.isCollecting = false;
        return true;
      } else {
        logger.error('[ProfitCollector] Failed to transfer profit');
        this.isCollecting = false;
        return false;
      }
    } catch (error) {
      logger.error(`[ProfitCollector] Error collecting profit: ${error}`);
      this.isCollecting = false;
      return false;
    }
  }

  /**
   * Transfer profit to target wallet
   */
  private async transferProfit(
    sourceKeypair: Keypair,
    targetWalletAddress: string,
    amount: number
  ): Promise<string | null> {
    try {
      // Create a transaction
      const transaction = new Transaction();
      
      // Add transfer instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: sourceKeypair.publicKey,
          toPubkey: new PublicKey(targetWalletAddress),
          lamports: Math.floor(amount * LAMPORTS_PER_SOL)
        })
      );
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = sourceKeypair.publicKey;
      
      // Sign transaction
      transaction.sign(sourceKeypair);
      
      // Send transaction
      const signature = await this.connection.sendRawTransaction(transaction.serialize());
      
      // Confirm transaction
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      logger.info(`[ProfitCollector] Profit transfer successful, signature: ${signature}`);
      return signature;
    } catch (error) {
      logger.error(`[ProfitCollector] Error transferring profit: ${error}`);
      return null;
    }
  }

  /**
   * Get total collected profit
   */
  getTotalCollected(): number {
    return this.totalCollected;
  }

  /**
   * Get profit entries
   */
  getProfitEntries(): ProfitEntry[] {
    return this.profitEntries;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ProfitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
    logger.info(`[ProfitCollector] Configuration updated: ${JSON.stringify(this.config)}`);
  }
}

// Export default instance
export const profitCollector = InstantProfitCollector.getInstance();
export function initialize() {
  console.log('Initializing profit collector');
}

export function captureProfit(amount: number) {
  console.log('Capturing profit:', amount);
}

export function updateSettings(settings: any) {
  console.log('Updating profit collector settings:', settings);
}
