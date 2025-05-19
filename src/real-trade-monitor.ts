/**
 * Real Trade Monitor
 * 
 * This module tracks and reports verified on-chain trades and profits
 * using Solscan for verification and only shows real actual trades.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const WALLET_ADDRESS = process.env.TRADING_WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const LOGS_DIR = path.join(process.cwd(), 'logs');
const TRADES_LOG_FILE = path.join(LOGS_DIR, 'verified-trades.json');
const PROFIT_LOG_FILE = path.join(LOGS_DIR, 'verified-profits.json');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Interfaces
interface VerifiedTrade {
  timestamp: string;
  signature: string;
  solscanUrl: string;
  strategy: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  profitSOL: number;
  profitUSD: number;
  verified: boolean;
  blockTime: number;
  slot: number;
}

interface ProfitRecord {
  timestamp: string;
  strategy: string;
  periodType: 'trade' | 'hour' | 'day' | 'week' | 'total';
  profitSOL: number;
  profitUSD: number;
  walletBalanceSOL: number;
  walletBalanceUSD: number;
  reinvestedSOL: number;
  reinvestedUSD: number;
  tradeCount: number;
}

interface BalanceHistory {
  timestamp: string;
  balanceSOL: number;
  balanceUSD: number;
  netChangeSOL: number;
  netChangeUSD: number;
  verified: boolean;
}

/**
 * Get wallet transaction history from Helius
 */
async function getWalletTransactions(limit: number = 50): Promise<any[]> {
  try {
    if (!HELIUS_API_KEY) {
      console.error('Helius API key not found');
      return [];
    }
    
    // Use Helius API to get real on-chain transactions
    const url = `https://api.helius.xyz/v0/addresses/${WALLET_ADDRESS}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`;
    const response = await axios.get(url);
    
    if (response.data && Array.isArray(response.data)) {
      console.log(`Retrieved ${response.data.length} transactions from Helius`);
      return response.data;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    return [];
  }
}

/**
 * Get transaction details from Solscan
 */
async function getTransactionFromSolscan(signature: string): Promise<any> {
  try {
    // Get transaction details from Solscan
    const url = `https://public-api.solscan.io/transaction/${signature}`;
    const response = await axios.get(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.data) {
      return response.data;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching transaction ${signature} from Solscan:`, error);
    return null;
  }
}

/**
 * Get current wallet balance from Solana
 */
async function getWalletBalance(): Promise<number> {
  try {
    const connection = new Connection(HELIUS_RPC_URL, 'confirmed');
    const publicKey = new PublicKey(WALLET_ADDRESS);
    return await connection.getBalance(publicKey);
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    return 0;
  }
}

/**
 * Parse transaction to identify trading activity
 */
async function parseTradingTransaction(transaction: any): Promise<VerifiedTrade | null> {
  try {
    // Skip if not a successful transaction
    if (!transaction || !transaction.signature || transaction.meta?.err) {
      return null;
    }
    
    // Check if it's a DEx-related transaction
    const logs = transaction.meta?.logMessages || [];
    const isTradeTransaction = logs.some((log: string) => 
      log.includes('swap') || 
      log.includes('trade') || 
      log.includes('exchange') || 
      log.includes('raydium') ||
      log.includes('jupiter') ||
      log.includes('orca')
    );
    
    if (!isTradeTransaction) {
      return null;
    }
    
    // Get Solscan info for additional verification
    const solscanInfo = await getTransactionFromSolscan(transaction.signature);
    
    // Skip if not verified on Solscan
    if (!solscanInfo || solscanInfo.status !== 'Success') {
      return null;
    }
    
    // Determine amounts and tokens
    // This is a simplified approach - in reality, you'd need to parse the specific tokens
    const preBalances = transaction.meta?.preBalances || [];
    const postBalances = transaction.meta?.postBalances || [];
    const walletIndex = transaction.meta?.preTokenBalances?.findIndex(
      (balance: any) => balance.owner === WALLET_ADDRESS
    ) || 0;
    
    const preBalance = preBalances[walletIndex] || 0;
    const postBalance = postBalances[walletIndex] || 0;
    const profitLamports = postBalance - preBalance;
    const profitSOL = profitLamports / LAMPORTS_PER_SOL;
    const profitUSD = profitSOL * 150; // Approximate SOL price
    
    // Try to determine strategy
    const strategyIndications = [
      { keyword: 'hyperion', strategy: 'Hyperion Flash Arbitrage' },
      { keyword: 'quantum', strategy: 'Quantum Omega' },
      { keyword: 'nuclear', strategy: 'Nuclear Strategy' },
      { keyword: 'database', strategy: 'Database Flash' },
      { keyword: 'temporal', strategy: 'Temporal Arbitrage' },
      { keyword: 'singular', strategy: 'Singularity' },
      { keyword: 'megalodon', strategy: 'Megalodon Prime' },
    ];
    
    let strategy = 'Unknown Strategy';
    for (const indication of strategyIndications) {
      if (logs.some(log => log.toLowerCase().includes(indication.keyword))) {
        strategy = indication.strategy;
        break;
      }
    }
    
    // Create a verified trade record
    const verifiedTrade: VerifiedTrade = {
      timestamp: new Date(transaction.blockTime * 1000).toISOString(),
      signature: transaction.signature,
      solscanUrl: `https://solscan.io/tx/${transaction.signature}`,
      strategy,
      tokenIn: 'SOL', // Simplified - would need more parsing for exact tokens
      tokenOut: 'Unknown', // Simplified - would need more parsing for exact tokens
      amountIn: preBalance / LAMPORTS_PER_SOL,
      amountOut: postBalance / LAMPORTS_PER_SOL,
      profitSOL,
      profitUSD,
      verified: true,
      blockTime: transaction.blockTime,
      slot: transaction.slot
    };
    
    return verifiedTrade;
  } catch (error) {
    console.error('Error parsing trading transaction:', error);
    return null;
  }
}

/**
 * Save verified trade to log file
 */
function saveVerifiedTrade(trade: VerifiedTrade): void {
  try {
    // Load existing trades
    let trades: VerifiedTrade[] = [];
    if (fs.existsSync(TRADES_LOG_FILE)) {
      const data = fs.readFileSync(TRADES_LOG_FILE, 'utf8');
      trades = JSON.parse(data);
    }
    
    // Check if trade already exists
    const exists = trades.some(t => t.signature === trade.signature);
    if (!exists) {
      trades.push(trade);
      
      // Sort by timestamp (newest first)
      trades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Save to file
      fs.writeFileSync(TRADES_LOG_FILE, JSON.stringify(trades, null, 2));
      console.log(`✅ Saved verified trade: ${trade.signature} (${trade.strategy})`);
      
      // Update profit records
      updateProfitRecords(trade);
    }
  } catch (error) {
    console.error('Error saving verified trade:', error);
  }
}

/**
 * Update profit records based on new trade
 */
function updateProfitRecords(trade: VerifiedTrade): void {
  try {
    // Load existing profit records
    let profits: ProfitRecord[] = [];
    if (fs.existsSync(PROFIT_LOG_FILE)) {
      const data = fs.readFileSync(PROFIT_LOG_FILE, 'utf8');
      profits = JSON.parse(data);
    }
    
    // Create new profit record for this trade
    const tradeProfitRecord: ProfitRecord = {
      timestamp: trade.timestamp,
      strategy: trade.strategy,
      periodType: 'trade',
      profitSOL: trade.profitSOL,
      profitUSD: trade.profitUSD,
      walletBalanceSOL: 0, // Will be updated
      walletBalanceUSD: 0, // Will be updated
      reinvestedSOL: trade.profitSOL * 0.95, // 95% reinvestment
      reinvestedUSD: trade.profitUSD * 0.95, // 95% reinvestment
      tradeCount: 1
    };
    
    // Update or create daily profit record
    const tradeDate = new Date(trade.timestamp).toISOString().split('T')[0];
    let dailyRecord = profits.find(p => 
      p.periodType === 'day' && 
      p.timestamp.startsWith(tradeDate)
    );
    
    if (dailyRecord) {
      // Update existing daily record
      dailyRecord.profitSOL += trade.profitSOL;
      dailyRecord.profitUSD += trade.profitUSD;
      dailyRecord.reinvestedSOL += trade.profitSOL * 0.95;
      dailyRecord.reinvestedUSD += trade.profitUSD * 0.95;
      dailyRecord.tradeCount += 1;
    } else {
      // Create new daily record
      dailyRecord = {
        timestamp: `${tradeDate}T00:00:00.000Z`,
        strategy: 'All Strategies',
        periodType: 'day',
        profitSOL: trade.profitSOL,
        profitUSD: trade.profitUSD,
        walletBalanceSOL: 0, // Will be updated
        walletBalanceUSD: 0, // Will be updated
        reinvestedSOL: trade.profitSOL * 0.95,
        reinvestedUSD: trade.profitUSD * 0.95,
        tradeCount: 1
      };
      profits.push(dailyRecord);
    }
    
    // Add trade record
    profits.push(tradeProfitRecord);
    
    // Sort by timestamp (newest first)
    profits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Save to file
    fs.writeFileSync(PROFIT_LOG_FILE, JSON.stringify(profits, null, 2));
  } catch (error) {
    console.error('Error updating profit records:', error);
  }
}

/**
 * Update wallet balance and create balance history record
 */
async function updateWalletBalanceHistory(): Promise<BalanceHistory | null> {
  try {
    const lamports = await getWalletBalance();
    const balanceSOL = lamports / LAMPORTS_PER_SOL;
    const balanceUSD = balanceSOL * 150; // Approximate SOL price
    
    // Load existing balance history
    const balanceHistoryFile = path.join(LOGS_DIR, 'balance-history.json');
    let history: BalanceHistory[] = [];
    
    if (fs.existsSync(balanceHistoryFile)) {
      const data = fs.readFileSync(balanceHistoryFile, 'utf8');
      history = JSON.parse(data);
    }
    
    // Calculate net change from last record
    const lastRecord = history.length > 0 ? history[0] : null;
    const netChangeSOL = lastRecord ? balanceSOL - lastRecord.balanceSOL : 0;
    const netChangeUSD = lastRecord ? balanceUSD - lastRecord.balanceUSD : 0;
    
    // Create new balance record
    const newRecord: BalanceHistory = {
      timestamp: new Date().toISOString(),
      balanceSOL,
      balanceUSD,
      netChangeSOL,
      netChangeUSD,
      verified: true
    };
    
    // Only add if balance has changed
    if (!lastRecord || Math.abs(netChangeSOL) > 0.000001) {
      history.unshift(newRecord); // Add to beginning
      
      // Update profit records with new balance
      updateProfitRecordsWithBalance(balanceSOL, balanceUSD);
      
      // Save to file
      fs.writeFileSync(balanceHistoryFile, JSON.stringify(history, null, 2));
      
      console.log(`✅ Updated wallet balance: ${balanceSOL.toFixed(6)} SOL ($${balanceUSD.toFixed(2)})`);
      console.log(`   Net change: ${netChangeSOL > 0 ? '+' : ''}${netChangeSOL.toFixed(6)} SOL ($${netChangeSOL > 0 ? '+' : ''}${netChangeUSD.toFixed(2)})`);
      
      return newRecord;
    }
    
    return null;
  } catch (error) {
    console.error('Error updating wallet balance history:', error);
    return null;
  }
}

/**
 * Update profit records with current wallet balance
 */
function updateProfitRecordsWithBalance(balanceSOL: number, balanceUSD: number): void {
  try {
    // Load existing profit records
    if (!fs.existsSync(PROFIT_LOG_FILE)) {
      return;
    }
    
    const data = fs.readFileSync(PROFIT_LOG_FILE, 'utf8');
    let profits: ProfitRecord[] = JSON.parse(data);
    
    // Update most recent records of each period type
    const periodTypes = ['trade', 'day', 'week', 'total'];
    
    for (const periodType of periodTypes) {
      const record = profits.find(p => p.periodType === periodType);
      if (record) {
        record.walletBalanceSOL = balanceSOL;
        record.walletBalanceUSD = balanceUSD;
      }
    }
    
    // Save updated records
    fs.writeFileSync(PROFIT_LOG_FILE, JSON.stringify(profits, null, 2));
  } catch (error) {
    console.error('Error updating profit records with balance:', error);
  }
}

/**
 * Print trade and profit summary
 */
function printTradingSummary(): void {
  try {
    // Load trades
    if (!fs.existsSync(TRADES_LOG_FILE)) {
      console.log('No verified trades found yet.');
      return;
    }
    
    const tradesData = fs.readFileSync(TRADES_LOG_FILE, 'utf8');
    const trades: VerifiedTrade[] = JSON.parse(tradesData);
    
    // Load profit records
    if (!fs.existsSync(PROFIT_LOG_FILE)) {
      console.log('No profit records found yet.');
      return;
    }
    
    const profitsData = fs.readFileSync(PROFIT_LOG_FILE, 'utf8');
    const profits: ProfitRecord[] = JSON.parse(profitsData);
    
    // Find daily and total records
    const dailyRecord = profits.find(p => p.periodType === 'day');
    const totalRecord = profits.find(p => p.periodType === 'total');
    
    // Load balance history
    const balanceHistoryFile = path.join(LOGS_DIR, 'balance-history.json');
    let currentBalance = 0;
    let initialBalance = 0;
    
    if (fs.existsSync(balanceHistoryFile)) {
      const historyData = fs.readFileSync(balanceHistoryFile, 'utf8');
      const history: BalanceHistory[] = JSON.parse(historyData);
      
      if (history.length > 0) {
        currentBalance = history[0].balanceSOL;
        initialBalance = history[history.length - 1].balanceSOL;
      }
    }
    
    // Calculate total profit
    const totalProfit = trades.reduce((sum, trade) => sum + trade.profitSOL, 0);
    const totalProfitUSD = totalProfit * 150;
    
    // Print summary
    console.log('\n========== VERIFIED TRADING SUMMARY ==========');
    console.log(`Wallet: ${WALLET_ADDRESS}`);
    console.log(`Current Balance: ${currentBalance.toFixed(6)} SOL ($${(currentBalance * 150).toFixed(2)})`);
    console.log(`Initial Balance: ${initialBalance.toFixed(6)} SOL ($${(initialBalance * 150).toFixed(2)})`);
    console.log(`Total Net Profit: ${totalProfit.toFixed(6)} SOL ($${totalProfitUSD.toFixed(2)})`);
    console.log(`Total ROI: ${initialBalance > 0 ? ((totalProfit / initialBalance) * 100).toFixed(2) : 'N/A'}%`);
    console.log(`Total Verified Trades: ${trades.length}`);
    
    // Print recent trades
    console.log('\n---------- RECENT VERIFIED TRADES ----------');
    const recentTrades = trades.slice(0, 5); // Last 5 trades
    
    recentTrades.forEach(trade => {
      console.log(`${new Date(trade.timestamp).toLocaleString()}`);
      console.log(`Strategy: ${trade.strategy}`);
      console.log(`Profit: ${trade.profitSOL.toFixed(6)} SOL ($${trade.profitUSD.toFixed(2)})`);
      console.log(`Verification: ${trade.solscanUrl}`);
      console.log('---------------------------------------------');
    });
    
    // Print strategy performance
    console.log('\n---------- STRATEGY PERFORMANCE ----------');
    const strategyPerformance: { [key: string]: { profit: number, trades: number } } = {};
    
    trades.forEach(trade => {
      if (!strategyPerformance[trade.strategy]) {
        strategyPerformance[trade.strategy] = { profit: 0, trades: 0 };
      }
      
      strategyPerformance[trade.strategy].profit += trade.profitSOL;
      strategyPerformance[trade.strategy].trades += 1;
    });
    
    // Sort strategies by profit
    const sortedStrategies = Object.entries(strategyPerformance)
      .sort(([, a], [, b]) => b.profit - a.profit);
    
    sortedStrategies.forEach(([strategy, data]) => {
      console.log(`${strategy}:`);
      console.log(`  Profit: ${data.profit.toFixed(6)} SOL ($${(data.profit * 150).toFixed(2)})`);
      console.log(`  Trades: ${data.trades}`);
      console.log(`  Avg Profit per Trade: ${(data.profit / data.trades).toFixed(6)} SOL`);
    });
    
    console.log('==============================================');
  } catch (error) {
    console.error('Error printing trading summary:', error);
  }
}

/**
 * Process latest transactions and update records
 */
async function processLatestTransactions(): Promise<void> {
  // Get transactions from Helius
  const transactions = await getWalletTransactions(20); // Get last 20 transactions
  
  if (transactions.length === 0) {
    console.log('No recent transactions found.');
    return;
  }
  
  // Process each transaction to find trades
  let newTradesFound = 0;
  
  for (const tx of transactions) {
    const trade = await parseTradingTransaction(tx);
    
    if (trade) {
      saveVerifiedTrade(trade);
      newTradesFound++;
    }
  }
  
  // Update wallet balance
  await updateWalletBalanceHistory();
  
  if (newTradesFound > 0) {
    console.log(`✅ Found ${newTradesFound} new verified trades`);
  } else {
    console.log('No new verified trades found in recent transactions.');
  }
  
  // Print summary
  printTradingSummary();
}

/**
 * Initialize and start monitoring
 */
async function startTradeMonitoring(intervalMinutes: number = 5): Promise<void> {
  console.log('Initializing real trade monitoring system...');
  console.log(`Will check for verified trades every ${intervalMinutes} minutes`);
  
  // Create logs directory if it doesn't exist
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  
  // Initial check
  await processLatestTransactions();
  
  // Set up periodic checking
  setInterval(async () => {
    console.log('\nChecking for new verified trades...');
    await processLatestTransactions();
  }, intervalMinutes * 60 * 1000);
  
  console.log('✅ Real trade monitoring system started');
}

// Export monitor functions
export const tradeMonitor = {
  startTradeMonitoring,
  processLatestTransactions,
  printTradingSummary,
  updateWalletBalanceHistory
};

// Run the monitor directly if this file is executed
if (require.main === module) {
  startTradeMonitoring();
}