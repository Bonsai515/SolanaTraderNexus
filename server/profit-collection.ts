/**
 * Profit Collection System
 * 
 * This module handles automated profit collection from trading operations:
 * 1. Periodic capture of profits from the trading wallet
 * 2. Distribution of profits between reinvestment and the prophet wallet
 * 3. Tracking of all profit events for reporting and analytics
 */

import { Connection, PublicKey, Transaction, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as logger from './logger';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const REINVESTMENT_RATE = 0.95; // 95% reinvestment, 5% to prophet wallet
const COLLECTION_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes
const PROPHET_WALLET_ADDRESS = '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e';
const MINIMUM_PROFIT_THRESHOLD = 0.01 * LAMPORTS_PER_SOL; // Minimum 0.01 SOL to collect

// State
let systemWallet: PublicKey;
let profitCollection: {
  isEnabled: boolean;
  lastCollectionTime: number;
  totalCollected: number;
  totalReinvested: number;
  totalToHoldWallet: number;
  collectionEvents: {
    timestamp: number;
    amount: number;
    reinvested: number;
    toHoldWallet: number;
    txSignature?: string;
  }[];
} = {
  isEnabled: false,
  lastCollectionTime: 0,
  totalCollected: 0,
  totalReinvested: 0,
  totalToHoldWallet: 0,
  collectionEvents: []
};

// Interval ID for cleanup
let collectionIntervalId: NodeJS.Timeout | null = null;

/**
 * Initialize the profit collection system
 * @param connection Solana connection
 * @param tradingWalletAddress Trading wallet public key
 * @returns True if initialized successfully
 */
export function initializeProfitCollection(
  connection: Connection,
  tradingWalletAddress: PublicKey | string
): boolean {
  try {
    // Convert string to PublicKey if needed
    systemWallet = typeof tradingWalletAddress === 'string' 
      ? new PublicKey(tradingWalletAddress)
      : tradingWalletAddress;
    
    logger.info(`[ProfitCollection] Initializing profit collection system for wallet ${systemWallet.toString()}`);
    
    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data', 'profit');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Load existing profit collection data if available
    const profitDataPath = path.join(dataDir, 'profit_collection.json');
    if (fs.existsSync(profitDataPath)) {
      try {
        const profitData = JSON.parse(fs.readFileSync(profitDataPath, 'utf8'));
        profitCollection = profitData;
        logger.info(`[ProfitCollection] Loaded existing profit collection data: ${profitCollection.totalCollected / LAMPORTS_PER_SOL} SOL collected total`);
      } catch (loadError) {
        logger.error(`[ProfitCollection] Error loading profit data: ${loadError}`);
        // Continue with default data
      }
    }
    
    // Enable profit collection
    profitCollection.isEnabled = true;
    
    // Start collection interval
    startProfitCollection(connection);
    
    logger.info(`[ProfitCollection] Profit collection system initialized successfully`);
    logger.info(`[ProfitCollection] Collection interval: ${COLLECTION_INTERVAL_MS / (60 * 1000)} minutes, reinvestment rate: ${REINVESTMENT_RATE * 100}%`);
    
    return true;
  } catch (error) {
    logger.error(`[ProfitCollection] Initialization error: ${error}`);
    return false;
  }
}

/**
 * Start automated profit collection
 */
function startProfitCollection(connection: Connection): void {
  if (collectionIntervalId) {
    clearInterval(collectionIntervalId);
  }
  
  collectionIntervalId = setInterval(async () => {
    if (!profitCollection.isEnabled) {
      return;
    }
    
    try {
      await collectProfit(connection);
    } catch (error) {
      logger.error(`[ProfitCollection] Error during profit collection: ${error}`);
    }
  }, COLLECTION_INTERVAL_MS);
  
  logger.info(`[ProfitCollection] Automated profit collection started with ${COLLECTION_INTERVAL_MS / (60 * 1000)} minute interval`);
}

/**
 * Collect profit from trading wallet
 */
async function collectProfit(connection: Connection): Promise<boolean> {
  try {
    // Get current balance
    const balance = await connection.getBalance(systemWallet);
    logger.info(`[ProfitCollection] Current balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    // Calculate profit (for now, assume any balance above threshold is profit)
    // In a real implementation, this would use a more sophisticated calculation
    // based on tracking starting balance and trading activities
    const profitAmount = Math.max(0, balance - MINIMUM_PROFIT_THRESHOLD);
    
    if (profitAmount < MINIMUM_PROFIT_THRESHOLD) {
      logger.info(`[ProfitCollection] No significant profit to collect (${profitAmount / LAMPORTS_PER_SOL} SOL)`);
      return false;
    }
    
    // Calculate distribution
    const amountToReinvest = Math.floor(profitAmount * REINVESTMENT_RATE);
    const amountToProphet = profitAmount - amountToReinvest;
    
    logger.info(`[ProfitCollection] Collecting profit: ${profitAmount / LAMPORTS_PER_SOL} SOL`);
    logger.info(`[ProfitCollection] - Reinvesting: ${amountToReinvest / LAMPORTS_PER_SOL} SOL (${REINVESTMENT_RATE * 100}%)`);
    logger.info(`[ProfitCollection] - To prophet wallet: ${amountToProphet / LAMPORTS_PER_SOL} SOL (${(1 - REINVESTMENT_RATE) * 100}%)`);
    
    // In a real implementation, this would execute the actual transaction
    // to transfer funds to the prophet wallet
    // For now, just log the intention
    
    // Record collection event
    const collectionEvent = {
      timestamp: Date.now(),
      amount: profitAmount,
      reinvested: amountToReinvest,
      toHoldWallet: amountToProphet,
      txSignature: 'simulation_only' // Would be actual signature in real implementation
    };
    
    profitCollection.collectionEvents.push(collectionEvent);
    profitCollection.lastCollectionTime = Date.now();
    profitCollection.totalCollected += profitAmount;
    profitCollection.totalReinvested += amountToReinvest;
    profitCollection.totalToHoldWallet += amountToProphet;
    
    // Save updated profit data
    saveCollectionData();
    
    return true;
  } catch (error) {
    logger.error(`[ProfitCollection] Error collecting profit: ${error}`);
    return false;
  }
}

/**
 * Save profit collection data to file
 */
function saveCollectionData(): void {
  try {
    const dataDir = path.join(process.cwd(), 'data', 'profit');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const profitDataPath = path.join(dataDir, 'profit_collection.json');
    fs.writeFileSync(profitDataPath, JSON.stringify(profitCollection, null, 2), 'utf8');
    
    logger.info(`[ProfitCollection] Saved profit collection data`);
  } catch (error) {
    logger.error(`[ProfitCollection] Error saving profit data: ${error}`);
  }
}

/**
 * Get profit collection status and statistics
 */
export function getProfitCollectionStatus(): any {
  return {
    isEnabled: profitCollection.isEnabled,
    lastCollectionTime: profitCollection.lastCollectionTime,
    totalCollectedSOL: profitCollection.totalCollected / LAMPORTS_PER_SOL,
    totalReinvestedSOL: profitCollection.totalReinvested / LAMPORTS_PER_SOL,
    totalToProphetSOL: profitCollection.totalToHoldWallet / LAMPORTS_PER_SOL,
    collectionEvents: profitCollection.collectionEvents.length,
    reinvestmentRate: REINVESTMENT_RATE,
    collectionIntervalMinutes: COLLECTION_INTERVAL_MS / (60 * 1000)
  };
}

/**
 * Get detailed profit collection history
 */
export function getProfitCollectionHistory(): any[] {
  return profitCollection.collectionEvents.map(event => ({
    timestamp: event.timestamp,
    date: new Date(event.timestamp).toLocaleString(),
    amountSOL: event.amount / LAMPORTS_PER_SOL,
    reinvestedSOL: event.reinvested / LAMPORTS_PER_SOL,
    toProphetSOL: event.toHoldWallet / LAMPORTS_PER_SOL,
    txSignature: event.txSignature
  }));
}

/**
 * Enable or disable profit collection
 */
export function setProfitCollectionEnabled(enabled: boolean): void {
  profitCollection.isEnabled = enabled;
  logger.info(`[ProfitCollection] Profit collection ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Clean up resources
 */
export function cleanupProfitCollection(): void {
  if (collectionIntervalId) {
    clearInterval(collectionIntervalId);
    collectionIntervalId = null;
  }
  logger.info(`[ProfitCollection] Resources cleaned up`);
}