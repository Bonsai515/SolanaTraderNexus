/**
 * Trade Orchestrator
 * 
 * This module orchestrates trade execution with RPC optimization,
 * rate limiting protection, and backoff strategies.
 */

import { Connection, PublicKey, Transaction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Simple in-memory trade queue
const tradeQueue: TradeRequest[] = [];
let processingQueue = false;
const MIN_DELAY_BETWEEN_TRADES_MS = 2000; // 2 seconds minimum between trades
const MAX_CONCURRENT_TRADES = 2; // Maximum concurrent trades
let activeTrades = 0;

interface TradeRequest {
  id: string;
  strategy: string;
  tokenSymbol: string;
  action: 'BUY' | 'SELL';
  amount: number;
  timestamp: number;
  priority: number; // 1-10, lower is higher priority
  maxRetries: number;
  retryCount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  lastAttempt: number;
  error?: string;
}

interface TradeResult {
  success: boolean;
  transactionSignature?: string;
  error?: string;
}

/**
 * Initialize the trade orchestrator
 */
export function initializeOrchestrator(): void {
  console.log('Initializing Trade Orchestrator with RPC optimization...');
  
  // Start the queue processor
  startQueueProcessor();
  
  // Log initial status
  logStatus();
}

/**
 * Add a trade to the queue
 */
export function queueTrade(tradeRequest: Omit<TradeRequest, 'id' | 'timestamp' | 'retryCount' | 'status' | 'lastAttempt'>): string {
  const id = generateTradeId();
  const timestamp = Date.now();
  
  const fullRequest: TradeRequest = {
    ...tradeRequest,
    id,
    timestamp,
    retryCount: 0,
    status: 'PENDING',
    lastAttempt: 0
  };
  
  // Add to queue
  tradeQueue.push(fullRequest);
  
  // Sort queue by priority and then timestamp
  sortQueue();
  
  console.log(`Added trade to queue: ${fullRequest.strategy} ${fullRequest.action} ${fullRequest.tokenSymbol}`);
  
  return id;
}

/**
 * Generate a unique trade ID
 */
function generateTradeId(): string {
  return `trade-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * Sort the trade queue by priority and timestamp
 */
function sortQueue(): void {
  tradeQueue.sort((a, b) => {
    // First by status (processing first)
    if (a.status === 'PROCESSING' && b.status !== 'PROCESSING') return -1;
    if (a.status !== 'PROCESSING' && b.status === 'PROCESSING') return 1;
    
    // Then by priority
    if (a.priority !== b.priority) return a.priority - b.priority;
    
    // Then by timestamp (oldest first)
    return a.timestamp - b.timestamp;
  });
}

/**
 * Start processing the trade queue
 */
function startQueueProcessor(): void {
  if (processingQueue) return;
  
  processingQueue = true;
  
  // Process queue periodically
  setInterval(() => {
    processNextTrades();
  }, 1000); // Check queue every second
  
  console.log('Trade queue processor started');
}

/**
 * Process the next trades in queue
 */
async function processNextTrades(): Promise<void> {
  if (activeTrades >= MAX_CONCURRENT_TRADES) {
    return; // Max concurrent trades reached
  }
  
  // Find the next pending trade
  const pendingTrades = tradeQueue.filter(trade => trade.status === 'PENDING');
  
  if (pendingTrades.length === 0) {
    return; // No pending trades
  }
  
  // Process up to MAX_CONCURRENT_TRADES trades
  const tradesAvailable = MAX_CONCURRENT_TRADES - activeTrades;
  const tradesToProcess = pendingTrades.slice(0, tradesAvailable);
  
  for (const trade of tradesToProcess) {
    // Mark as processing
    trade.status = 'PROCESSING';
    trade.lastAttempt = Date.now();
    activeTrades++;
    
    // Process trade asynchronously
    processTradeAsync(trade)
      .finally(() => {
        activeTrades--;
      });
  }
}

/**
 * Process a single trade asynchronously
 */
async function processTradeAsync(trade: TradeRequest): Promise<void> {
  console.log(`Processing trade: ${trade.id} - ${trade.strategy} ${trade.action} ${trade.tokenSymbol}`);
  
  try {
    // Execute the trade
    const result = await executeTrade(trade);
    
    if (result.success) {
      trade.status = 'COMPLETED';
      console.log(`Trade completed successfully: ${trade.id} - Signature: ${result.transactionSignature}`);
      
      // Log successful trade
      logSuccessfulTrade(trade, result.transactionSignature!);
    } else {
      // Handle failure
      trade.retryCount++;
      trade.error = result.error;
      
      if (trade.retryCount >= trade.maxRetries) {
        trade.status = 'FAILED';
        console.error(`Trade failed after ${trade.retryCount} attempts: ${trade.id} - ${result.error}`);
        
        // Log failed trade
        logFailedTrade(trade);
      } else {
        // Back to pending for retry
        trade.status = 'PENDING';
        console.warn(`Trade failed, will retry (${trade.retryCount}/${trade.maxRetries}): ${trade.id} - ${result.error}`);
      }
    }
  } catch (error) {
    // Handle unexpected errors
    trade.retryCount++;
    trade.error = `Unexpected error: ${error}`;
    
    if (trade.retryCount >= trade.maxRetries) {
      trade.status = 'FAILED';
      console.error(`Trade failed after ${trade.retryCount} attempts: ${trade.id} - Unexpected error: ${error}`);
      
      // Log failed trade
      logFailedTrade(trade);
    } else {
      // Back to pending for retry
      trade.status = 'PENDING';
      console.warn(`Trade failed with unexpected error, will retry (${trade.retryCount}/${trade.maxRetries}): ${trade.id} - ${error}`);
    }
  }
  
  // Clean up completed/failed trades periodically
  cleanupOldTrades();
}

/**
 * Execute a trade using connection manager with fallbacks
 */
async function executeTrade(trade: TradeRequest): Promise<TradeResult> {
  // For now, since we haven't imported rpcManager yet,
  // let's use a direct connection with fallbacks
  
  try {
    const rpcUrls = [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://ssc-dao.genesysgo.net'
    ];
    
    let success = false;
    let signature = '';
    let lastError = '';
    
    // Try each RPC endpoint until success or all fail
    for (const rpcUrl of rpcUrls) {
      try {
        const connection = new Connection(rpcUrl, 'confirmed');
        
        // Simulate a trade execution (in production, this would interact with DEXes)
        console.log(`Executing ${trade.action} trade for ${trade.tokenSymbol} using ${trade.strategy} strategy (via ${rpcUrl})`);
        
        // Add a random delay to simulate transaction processing
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        
        // Calculate success probability based on retry count (higher retries = lower probability)
        const successProbability = Math.max(0.7, 0.9 - (trade.retryCount * 0.1));
        
        // Simulate success/failure
        if (Math.random() < successProbability) {
          // Simulate transaction signature
          signature = `${trade.id.substring(0, 8)}...${Date.now().toString().substring(8)}`;
          success = true;
          break; // Exit the loop on success
        } else {
          // Simulate a transaction error
          const errorTypes = [
            'Transaction simulation failed: Blockhash not found',
            'Transaction simulation failed: Transaction too large',
            '429 Too Many Requests',
            'Socket hang up',
            'Connection reset by peer'
          ];
          
          lastError = errorTypes[Math.floor(Math.random() * errorTypes.length)];
          
          // If this is a rate limit error, try the next URL
          if (lastError.includes('429') || lastError.includes('Socket hang up')) {
            console.warn(`Rate limit or connection error on ${rpcUrl}, trying next RPC endpoint...`);
            // Add delay before trying next endpoint
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          
          // For other errors, return the failure
          break;
        }
      } catch (error) {
        lastError = `Error executing trade via ${rpcUrl}: ${error}`;
        console.warn(lastError);
        // Add delay before trying next endpoint
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (success) {
      return {
        success: true,
        transactionSignature: signature
      };
    } else {
      return {
        success: false,
        error: lastError
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Error executing trade: ${error}`
    };
  }
}

/**
 * Clean up old completed and failed trades
 */
function cleanupOldTrades(): void {
  const now = Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000;
  
  // Remove completed trades older than 1 hour
  const newQueue = tradeQueue.filter(trade => {
    if ((trade.status === 'COMPLETED' || trade.status === 'FAILED') && 
        (now - trade.lastAttempt > ONE_HOUR_MS)) {
      return false; // Remove this trade
    }
    return true; // Keep this trade
  });
  
  // Update the queue
  if (newQueue.length !== tradeQueue.length) {
    console.log(`Cleaned up ${tradeQueue.length - newQueue.length} old trades`);
    
    // Replace the queue
    tradeQueue.length = 0;
    tradeQueue.push(...newQueue);
  }
}

/**
 * Log a successful trade
 */
function logSuccessfulTrade(trade: TradeRequest, signature: string): void {
  try {
    const logDir = './logs/trades';
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      id: trade.id,
      timestamp,
      strategy: trade.strategy,
      action: trade.action,
      tokenSymbol: trade.tokenSymbol,
      amount: trade.amount,
      signature,
      status: 'SUCCESS',
      processingTimeMs: Date.now() - trade.timestamp
    };
    
    const logFilePath = path.join(logDir, `successful-trades-${new Date().toISOString().split('T')[0]}.json`);
    
    let logs: any[] = [];
    if (fs.existsSync(logFilePath)) {
      logs = JSON.parse(fs.readFileSync(logFilePath, 'utf-8'));
    }
    
    logs.push(logEntry);
    
    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error logging successful trade:', error);
  }
}

/**
 * Log a failed trade
 */
function logFailedTrade(trade: TradeRequest): void {
  try {
    const logDir = './logs/trades';
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      id: trade.id,
      timestamp,
      strategy: trade.strategy,
      action: trade.action,
      tokenSymbol: trade.tokenSymbol,
      amount: trade.amount,
      status: 'FAILED',
      error: trade.error,
      retryCount: trade.retryCount,
      processingTimeMs: Date.now() - trade.timestamp
    };
    
    const logFilePath = path.join(logDir, `failed-trades-${new Date().toISOString().split('T')[0]}.json`);
    
    let logs: any[] = [];
    if (fs.existsSync(logFilePath)) {
      logs = JSON.parse(fs.readFileSync(logFilePath, 'utf-8'));
    }
    
    logs.push(logEntry);
    
    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error logging failed trade:', error);
  }
}

/**
 * Log current queue status
 */
export function logStatus(): void {
  const pending = tradeQueue.filter(t => t.status === 'PENDING').length;
  const processing = tradeQueue.filter(t => t.status === 'PROCESSING').length;
  const completed = tradeQueue.filter(t => t.status === 'COMPLETED').length;
  const failed = tradeQueue.filter(t => t.status === 'FAILED').length;
  
  console.log('===== TRADE QUEUE STATUS =====');
  console.log(`Pending: ${pending}`);
  console.log(`Processing: ${processing}`);
  console.log(`Completed: ${completed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Active Trades: ${activeTrades}/${MAX_CONCURRENT_TRADES}`);
  console.log('=============================');
}

/**
 * Get all trade requests with specified status
 */
export function getTrades(status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'): TradeRequest[] {
  if (status) {
    return tradeQueue.filter(t => t.status === status);
  }
  return [...tradeQueue];
}

/**
 * Example function to add a sample trade to the queue
 */
export function addSampleTrade(symbol: string, action: 'BUY' | 'SELL', amount: number): string {
  return queueTrade({
    strategy: 'Quantum Omega',
    tokenSymbol: symbol,
    action,
    amount,
    priority: 2,
    maxRetries: 3
  });
}