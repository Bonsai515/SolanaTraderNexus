/**
 * Quantum Flash Strategy Live Trading Dashboard
 * 
 * This dashboard displays real-time information about the flash trading strategy
 * including active trades, wallet balances, and performance metrics.
 */

import chalk from 'chalk';
import { Connection, PublicKey } from '@solana/web3.js';
import { rpcManager } from './server/lib/enhancedRpcManager';
import { multiSourcePriceFeed } from './server/lib/multiSourcePriceFeed';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const UPDATE_INTERVAL_MS = 2000;
const LOG_FILE = path.join(__dirname, 'logs', 'flash-strategy-log.json');
const WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb'; // Main trading wallet

// Dashboard state
let activeTrades: any[] = [];
let walletBalance = 0;
let profitLoss = 0;
let totalTrades = 0;
let successfulTrades = 0;
let lastTradeTime = '';
let strategyStatus = 'IDLE';
let rpcStatus = 'HEALTHY';
let priceFeedStatus = 'HEALTHY';

/**
 * Format currency values for display
 */
function formatCurrency(value: number): string {
  return value.toFixed(6);
}

/**
 * Format percentage values for display
 */
function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Load trading history from logs
 */
function loadTradingHistory(): any[] {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const logData = fs.readFileSync(LOG_FILE, 'utf8');
      return JSON.parse(logData);
    }
  } catch (error) {
    console.error('Error loading trading history:', error);
  }
  return [];
}

/**
 * Update wallet balance from Solana blockchain
 */
async function updateWalletBalance(): Promise<void> {
  try {
    const connection = rpcManager.getConnection();
    const publicKey = new PublicKey(WALLET_ADDRESS);
    const balance = await connection.getBalance(publicKey);
    walletBalance = balance / 1_000_000_000; // Convert lamports to SOL
  } catch (error) {
    console.error('Error updating wallet balance:', error);
    rpcStatus = 'ERROR';
  }
}

/**
 * Update price feed status
 */
async function updatePriceFeedStatus(): Promise<void> {
  try {
    const solPrice = await multiSourcePriceFeed.getPrice('SOL');
    if (solPrice && solPrice > 0) {
      priceFeedStatus = 'HEALTHY';
    } else {
      priceFeedStatus = 'ERROR';
    }
  } catch (error) {
    console.error('Error updating price feed status:', error);
    priceFeedStatus = 'ERROR';
  }
}

/**
 * Check for active trades and recent trade history
 */
function updateTradeStatus(): void {
  try {
    // Load trading history
    const tradeHistory = loadTradingHistory();
    
    if (tradeHistory.length > 0) {
      // Update dashboard with latest trade data
      totalTrades = tradeHistory.length;
      
      // Count successful trades
      successfulTrades = tradeHistory.filter(trade => 
        trade.profit > 0 || 
        (trade.endingAmount && trade.endingAmount > trade.startingAmount)
      ).length;
      
      // Get last trade time
      const lastTrade = tradeHistory[tradeHistory.length - 1];
      if (lastTrade && lastTrade.timestamp) {
        lastTradeTime = new Date(lastTrade.timestamp).toLocaleTimeString();
      }
      
      // Calculate profit/loss
      profitLoss = tradeHistory.reduce((total, trade) => {
        if (trade.profit) {
          return total + trade.profit;
        } else if (trade.endingAmount && trade.startingAmount) {
          return total + (trade.endingAmount - trade.startingAmount);
        }
        return total;
      }, 0);
      
      // Check for active trades (trades without endingAmount)
      activeTrades = tradeHistory.filter(trade => 
        !trade.endingAmount || 
        trade.status === 'active' ||
        trade.status === 'in_progress'
      );
      
      if (activeTrades.length > 0) {
        strategyStatus = 'ACTIVE';
      } else {
        strategyStatus = 'IDLE';
      }
    }
  } catch (error) {
    console.error('Error updating trade status:', error);
  }
}

/**
 * Render the dashboard header
 */
function renderHeader(): void {
  console.clear();
  console.log(chalk.bold.yellow('╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.yellow('║       QUANTUM FLASH STRATEGY - REAL-TIME TRADING DASHBOARD     ║'));
  console.log(chalk.bold.yellow('╚════════════════════════════════════════════════════════════════╝'));
  console.log('');
}

/**
 * Render system status section
 */
function renderSystemStatus(): void {
  console.log(chalk.bold.blue('╔══ SYSTEM STATUS ═══════════════════════════════════════════════╗'));
  
  // RPC Status with color
  let rpcStatusColored;
  if (rpcStatus === 'HEALTHY') {
    rpcStatusColored = chalk.green(rpcStatus);
  } else {
    rpcStatusColored = chalk.red(rpcStatus);
  }
  
  // Price Feed Status with color
  let priceFeedStatusColored;
  if (priceFeedStatus === 'HEALTHY') {
    priceFeedStatusColored = chalk.green(priceFeedStatus);
  } else {
    priceFeedStatusColored = chalk.red(priceFeedStatus);
  }
  
  // Strategy Status with color
  let strategyStatusColored;
  if (strategyStatus === 'ACTIVE') {
    strategyStatusColored = chalk.green(strategyStatus);
  } else if (strategyStatus === 'ERROR') {
    strategyStatusColored = chalk.red(strategyStatus);
  } else {
    strategyStatusColored = chalk.yellow(strategyStatus);
  }
  
  console.log(`║ RPC Connection: ${rpcStatusColored.padEnd(30)} ║`);
  console.log(`║ Price Feed: ${priceFeedStatusColored.padEnd(33)} ║`);
  console.log(`║ Strategy Status: ${strategyStatusColored.padEnd(28)} ║`);
  console.log(chalk.bold.blue('╚════════════════════════════════════════════════════════════════╝'));
  console.log('');
}

/**
 * Render wallet section
 */
function renderWalletSection(): void {
  console.log(chalk.bold.green('╔══ WALLET ═════════════════════════════════════════════════════╗'));
  console.log(`║ Address: ${WALLET_ADDRESS.substring(0, 8)}...${WALLET_ADDRESS.substring(WALLET_ADDRESS.length - 8)} ║`);
  console.log(`║ Balance: ${formatCurrency(walletBalance)} SOL${' '.repeat(39 - formatCurrency(walletBalance).length)} ║`);
  
  // Display profit/loss with color
  const profitLossFormatted = formatCurrency(profitLoss);
  let profitLossColored;
  if (profitLoss > 0) {
    profitLossColored = chalk.green(`+${profitLossFormatted}`);
  } else if (profitLoss < 0) {
    profitLossColored = chalk.red(profitLossFormatted);
  } else {
    profitLossColored = profitLossFormatted;
  }
  
  console.log(`║ Profit/Loss: ${profitLossColored} SOL${' '.repeat(36 - profitLossFormatted.length)} ║`);
  console.log(chalk.bold.green('╚════════════════════════════════════════════════════════════════╝'));
  console.log('');
}

/**
 * Render trade statistics section
 */
function renderTradeStatistics(): void {
  console.log(chalk.bold.magenta('╔══ TRADE STATISTICS ═══════════════════════════════════════════╗'));
  console.log(`║ Total Trades: ${totalTrades.toString().padEnd(33)} ║`);
  console.log(`║ Successful Trades: ${successfulTrades.toString().padEnd(28)} ║`);
  
  // Calculate success rate
  const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) : 0;
  console.log(`║ Success Rate: ${formatPercentage(successRate).padEnd(32)} ║`);
  
  console.log(`║ Last Trade: ${lastTradeTime.padEnd(34)} ║`);
  console.log(chalk.bold.magenta('╚════════════════════════════════════════════════════════════════╝'));
  console.log('');
}

/**
 * Render active trades section
 */
function renderActiveTrades(): void {
  console.log(chalk.bold.cyan('╔══ ACTIVE TRADES ════════════════════════════════════════════════╗'));
  
  if (activeTrades.length === 0) {
    console.log('║ No active trades.                                                ║');
  } else {
    activeTrades.slice(0, 3).forEach((trade, index) => {
      const tradeInfo = `Trade #${index + 1}: ${formatCurrency(trade.startingAmount)} SOL`;
      console.log(`║ ${tradeInfo.padEnd(62)} ║`);
    });
    
    if (activeTrades.length > 3) {
      console.log(`║ ... and ${activeTrades.length - 3} more active trades.${' '.repeat(30)} ║`);
    }
  }
  
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════════╝'));
}

/**
 * Update all dashboard data
 */
async function updateDashboard(): Promise<void> {
  try {
    await updateWalletBalance();
    await updatePriceFeedStatus();
    updateTradeStatus();
    
    renderHeader();
    renderSystemStatus();
    renderWalletSection();
    renderTradeStatistics();
    renderActiveTrades();
    
    console.log('');
    console.log(`Last updated: ${new Date().toLocaleTimeString()}`);
    console.log(`Press Ctrl+C to exit the dashboard.`);
  } catch (error) {
    console.error('Error updating dashboard:', error);
  }
}

/**
 * Main function to start the dashboard
 */
async function startDashboard(): Promise<void> {
  console.log('Starting Quantum Flash Strategy Trading Dashboard...');
  
  // Create logs directory if it doesn't exist
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Initial update
  await updateDashboard();
  
  // Set interval for updates
  setInterval(updateDashboard, UPDATE_INTERVAL_MS);
}

// Start the dashboard
startDashboard().catch(console.error);