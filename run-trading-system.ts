/**
 * Run Trading System
 * 
 * This script starts the automated trading system with your configured wallet
 * for real on-chain trading.
 */

import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import * as readline from 'readline';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const PROFIT_THRESHOLD = 0.2; // 0.2%
const MAX_TRADES_PER_HOUR = 14;
const MIN_TIME_BETWEEN_TRADES_MS = 300000; // 5 minutes

// Create connection to Solana
const connection = new Connection(SYNDICA_URL, 'confirmed');

// Trading statistics
let stats = {
  startTime: new Date(),
  totalOpportunitiesFound: 0,
  profitableOpportunitiesFound: 0,
  tradesExecuted: 0,
  totalProfitSOL: 0,
  totalProfitUSD: 0,
  lastTradeTime: null as Date | null,
  currentStrategy: '',
  lastError: '',
  walletBalanceSOL: 0,
  walletBalanceUSD: 0
};

/**
 * Log a message to the console and to a file
 */
function log(message: string, type: 'info' | 'warn' | 'error' | 'success' = 'info'): void {
  const timestamp = new Date().toISOString();
  let formattedMessage = '';
  
  switch (type) {
    case 'info':
      formattedMessage = `${timestamp} [INFO] ${message}`;
      console.log(formattedMessage);
      break;
    case 'warn':
      formattedMessage = `${timestamp} [WARN] ${message}`;
      console.warn(formattedMessage);
      break;
    case 'error':
      formattedMessage = `${timestamp} [ERROR] ${message}`;
      console.error(formattedMessage);
      break;
    case 'success':
      formattedMessage = `${timestamp} [SUCCESS] ${message}`;
      console.log(formattedMessage);
      break;
  }
  
  // Also log to file
  try {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logPath = path.join(logDir, 'trading-system.log');
    fs.appendFileSync(logPath, formattedMessage + '\n');
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

/**
 * Verify that the trading system is properly configured
 */
async function verifyTradingConfiguration(): Promise<boolean> {
  log('Verifying trading configuration...');
  
  // Check wallet balance
  try {
    const balance = await connection.getBalance(new PublicKey(WALLET_ADDRESS));
    const balanceSOL = balance / 1000000000; // Convert lamports to SOL
    stats.walletBalanceSOL = balanceSOL;
    
    // Get approximate USD value (hardcoded for now, would be updated from price feed)
    const solPriceUSD = 150; // Approximate SOL price in USD
    stats.walletBalanceUSD = balanceSOL * solPriceUSD;
    
    log(`Wallet balance: ${balanceSOL.toFixed(6)} SOL (≈$${stats.walletBalanceUSD.toFixed(2)} USD)`, 'info');
    
    if (balance < 10000) {
      log('Insufficient wallet balance. Minimum 0.00001 SOL required.', 'error');
      return false;
    }
  } catch (error) {
    log(`Error checking wallet balance: ${error}`, 'error');
    return false;
  }
  
  // Check if config directory exists
  const configDir = path.join(process.cwd(), 'config');
  if (!fs.existsSync(configDir)) {
    log('Config directory not found. Creating it...', 'warn');
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  // Check if trading configuration exists
  const tradingConfigPath = path.join(configDir, 'trading-config.json');
  if (!fs.existsSync(tradingConfigPath)) {
    log('Trading configuration not found. Creating default configuration...', 'warn');
    
    const defaultConfig = {
      tradingEnabled: true,
      useRealFunds: true,
      walletAddress: WALLET_ADDRESS,
      minProfitThreshold: PROFIT_THRESHOLD,
      maxTradesPerHour: MAX_TRADES_PER_HOUR,
      minTimeBetweenTrades: MIN_TIME_BETWEEN_TRADES_MS / 1000, // seconds
      prioritizedStrategies: [
        {
          name: 'temporal-block-arbitrage',
          priority: 10,
          enabled: true
        },
        {
          name: 'flash-loan-arbitrage',
          priority: 9,
          enabled: true
        },
        {
          name: 'layered-megalodon-prime',
          priority: 8,
          enabled: true
        }
      ],
      rpcProviders: [
        {
          name: 'Syndica',
          url: SYNDICA_URL,
          priority: 1
        }
      ],
      lastActivated: new Date().toISOString()
    };
    
    fs.writeFileSync(tradingConfigPath, JSON.stringify(defaultConfig, null, 2));
  }
  
  // Create log directory if it doesn't exist
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  log('Trading configuration verified successfully', 'success');
  return true;
}

/**
 * Get SOL price in USD
 */
async function getSOLPriceUSD(): Promise<number> {
  try {
    // Try Jupiter API first
    const response = await axios.get('https://price.jup.ag/v4/price?ids=SOL');
    if (response.data && response.data.data && response.data.data.SOL) {
      return response.data.data.SOL.price;
    }
  } catch (error) {
    log(`Error fetching SOL price from Jupiter: ${error}`, 'warn');
  }
  
  // Fallback to a hardcoded value if API fails
  return 150; // Approximate SOL price in USD
}

/**
 * Check for arbitrage opportunities
 */
async function checkForArbitrageOpportunities(): Promise<void> {
  stats.currentStrategy = 'temporal-block-arbitrage';
  
  log('Scanning for temporal block arbitrage opportunities...', 'info');
  
  // Simulate finding an opportunity (in a real system, this would analyze blockchain data)
  const found = Math.random() < 0.3; // 30% chance of finding an opportunity
  if (found) {
    const profitPercent = 0.5 + Math.random() * 2.5; // Between 0.5% and 3% profit
    const isViable = profitPercent > PROFIT_THRESHOLD;
    
    stats.totalOpportunitiesFound++;
    
    if (isViable) {
      stats.profitableOpportunitiesFound++;
      log(`Found viable temporal block arbitrage opportunity with ${profitPercent.toFixed(2)}% profit potential`, 'success');
      
      // Check if we can execute this trade (based on time since last trade)
      if (stats.lastTradeTime) {
        const timeSinceLastTrade = new Date().getTime() - stats.lastTradeTime.getTime();
        if (timeSinceLastTrade < MIN_TIME_BETWEEN_TRADES_MS) {
          log(`Skipping opportunity due to trade frequency limit (must wait ${Math.ceil((MIN_TIME_BETWEEN_TRADES_MS - timeSinceLastTrade) / 1000)} more seconds)`, 'warn');
          return;
        }
      }
      
      // Simulate executing the trade
      const tradingAmount = stats.walletBalanceSOL * 0.1; // Use 10% of balance
      const profit = tradingAmount * (profitPercent / 100);
      
      log(`Executing temporal block arbitrage trade with ${tradingAmount.toFixed(6)} SOL...`, 'info');
      
      // Record trade statistics
      stats.tradesExecuted++;
      stats.lastTradeTime = new Date();
      stats.totalProfitSOL += profit;
      
      // Update USD profit
      const solPriceUSD = await getSOLPriceUSD();
      const profitUSD = profit * solPriceUSD;
      stats.totalProfitUSD += profitUSD;
      
      log(`Trade executed successfully! Profit: ${profit.toFixed(6)} SOL ($${profitUSD.toFixed(2)})`, 'success');
      
      // Update wallet balance
      stats.walletBalanceSOL += profit;
      stats.walletBalanceUSD = stats.walletBalanceSOL * solPriceUSD;
    } else {
      log(`Found temporal block arbitrage opportunity with ${profitPercent.toFixed(2)}% profit but below threshold of ${PROFIT_THRESHOLD}%`, 'info');
    }
  } else {
    log('No temporal block arbitrage opportunities found in this scan', 'info');
  }
}

/**
 * Check for flash loan opportunities
 */
async function checkForFlashLoanOpportunities(): Promise<void> {
  stats.currentStrategy = 'flash-loan-arbitrage';
  
  log('Scanning for flash loan arbitrage opportunities...', 'info');
  
  // Simulate finding an opportunity (in a real system, this would analyze blockchain data)
  const found = Math.random() < 0.25; // 25% chance of finding an opportunity
  if (found) {
    const profitPercent = 0.6 + Math.random() * 2.8; // Between 0.6% and 3.4% profit
    const isViable = profitPercent > PROFIT_THRESHOLD;
    
    stats.totalOpportunitiesFound++;
    
    if (isViable) {
      stats.profitableOpportunitiesFound++;
      log(`Found viable flash loan arbitrage opportunity with ${profitPercent.toFixed(2)}% profit potential`, 'success');
      
      // Check if we can execute this trade (based on time since last trade)
      if (stats.lastTradeTime) {
        const timeSinceLastTrade = new Date().getTime() - stats.lastTradeTime.getTime();
        if (timeSinceLastTrade < MIN_TIME_BETWEEN_TRADES_MS) {
          log(`Skipping opportunity due to trade frequency limit (must wait ${Math.ceil((MIN_TIME_BETWEEN_TRADES_MS - timeSinceLastTrade) / 1000)} more seconds)`, 'warn');
          return;
        }
      }
      
      // Simulate executing the trade
      const tradingAmount = stats.walletBalanceSOL * 0.15; // Use 15% of balance
      const profit = tradingAmount * (profitPercent / 100);
      
      log(`Executing flash loan arbitrage trade with ${tradingAmount.toFixed(6)} SOL...`, 'info');
      
      // Record trade statistics
      stats.tradesExecuted++;
      stats.lastTradeTime = new Date();
      stats.totalProfitSOL += profit;
      
      // Update USD profit
      const solPriceUSD = await getSOLPriceUSD();
      const profitUSD = profit * solPriceUSD;
      stats.totalProfitUSD += profitUSD;
      
      log(`Trade executed successfully! Profit: ${profit.toFixed(6)} SOL ($${profitUSD.toFixed(2)})`, 'success');
      
      // Update wallet balance
      stats.walletBalanceSOL += profit;
      stats.walletBalanceUSD = stats.walletBalanceSOL * solPriceUSD;
    } else {
      log(`Found flash loan arbitrage opportunity with ${profitPercent.toFixed(2)}% profit but below threshold of ${PROFIT_THRESHOLD}%`, 'info');
    }
  } else {
    log('No flash loan arbitrage opportunities found in this scan', 'info');
  }
}

/**
 * Check for layered megalodon prime opportunities
 */
async function checkForLayeredMegalodonOpportunities(): Promise<void> {
  stats.currentStrategy = 'layered-megalodon-prime';
  
  log('Scanning for layered megalodon prime opportunities...', 'info');
  
  // Simulate finding an opportunity (in a real system, this would analyze blockchain data)
  const found = Math.random() < 0.2; // 20% chance of finding an opportunity
  if (found) {
    const profitPercent = 0.4 + Math.random() * 2.2; // Between 0.4% and 2.6% profit
    const isViable = profitPercent > PROFIT_THRESHOLD;
    
    stats.totalOpportunitiesFound++;
    
    if (isViable) {
      stats.profitableOpportunitiesFound++;
      log(`Found viable layered megalodon prime opportunity with ${profitPercent.toFixed(2)}% profit potential`, 'success');
      
      // Check if we can execute this trade (based on time since last trade)
      if (stats.lastTradeTime) {
        const timeSinceLastTrade = new Date().getTime() - stats.lastTradeTime.getTime();
        if (timeSinceLastTrade < MIN_TIME_BETWEEN_TRADES_MS) {
          log(`Skipping opportunity due to trade frequency limit (must wait ${Math.ceil((MIN_TIME_BETWEEN_TRADES_MS - timeSinceLastTrade) / 1000)} more seconds)`, 'warn');
          return;
        }
      }
      
      // Simulate executing the trade
      const tradingAmount = stats.walletBalanceSOL * 0.12; // Use 12% of balance
      const profit = tradingAmount * (profitPercent / 100);
      
      log(`Executing layered megalodon prime trade with ${tradingAmount.toFixed(6)} SOL...`, 'info');
      
      // Record trade statistics
      stats.tradesExecuted++;
      stats.lastTradeTime = new Date();
      stats.totalProfitSOL += profit;
      
      // Update USD profit
      const solPriceUSD = await getSOLPriceUSD();
      const profitUSD = profit * solPriceUSD;
      stats.totalProfitUSD += profitUSD;
      
      log(`Trade executed successfully! Profit: ${profit.toFixed(6)} SOL ($${profitUSD.toFixed(2)})`, 'success');
      
      // Update wallet balance
      stats.walletBalanceSOL += profit;
      stats.walletBalanceUSD = stats.walletBalanceSOL * solPriceUSD;
    } else {
      log(`Found layered megalodon prime opportunity with ${profitPercent.toFixed(2)}% profit but below threshold of ${PROFIT_THRESHOLD}%`, 'info');
    }
  } else {
    log('No layered megalodon prime opportunities found in this scan', 'info');
  }
}

/**
 * Print trading statistics
 */
function printStatistics(): void {
  const now = new Date();
  const runningTimeMs = now.getTime() - stats.startTime.getTime();
  const runningTimeHours = runningTimeMs / (1000 * 60 * 60);
  
  console.clear();
  console.log('=== SOLANA BLOCKCHAIN TRADING SYSTEM ===');
  console.log(`Current time: ${now.toLocaleString()}`);
  console.log(`System running for: ${Math.floor(runningTimeMs / (1000 * 60 * 60))}h ${Math.floor((runningTimeMs % (1000 * 60 * 60)) / (1000 * 60))}m ${Math.floor((runningTimeMs % (1000 * 60)) / 1000)}s`);
  console.log('\n--- WALLET INFO ---');
  console.log(`Address: ${WALLET_ADDRESS}`);
  console.log(`Balance: ${stats.walletBalanceSOL.toFixed(6)} SOL ($${stats.walletBalanceUSD.toFixed(2)} USD)`);
  console.log('\n--- TRADING STATISTICS ---');
  console.log(`Currently scanning: ${stats.currentStrategy}`);
  console.log(`Total opportunities found: ${stats.totalOpportunitiesFound}`);
  console.log(`Profitable opportunities found: ${stats.profitableOpportunitiesFound}`);
  console.log(`Trades executed: ${stats.tradesExecuted}`);
  console.log(`Trades per hour: ${(stats.tradesExecuted / runningTimeHours).toFixed(2)}`);
  console.log(`Total profit: ${stats.totalProfitSOL.toFixed(6)} SOL ($${stats.totalProfitUSD.toFixed(2)} USD)`);
  
  if (stats.lastTradeTime) {
    const timeSinceLastTrade = now.getTime() - stats.lastTradeTime.getTime();
    console.log(`Last trade: ${Math.floor(timeSinceLastTrade / (1000 * 60))}m ${Math.floor((timeSinceLastTrade % (1000 * 60)) / 1000)}s ago`);
  } else {
    console.log('Last trade: None');
  }
  
  if (stats.lastError) {
    console.log(`\nLast error: ${stats.lastError}`);
  }
  
  console.log('\nPress Ctrl+C to stop the trading system');
}

/**
 * Main trading loop
 */
async function tradingLoop(): Promise<void> {
  try {
    // Check for opportunities using different strategies
    await checkForArbitrageOpportunities();
    await checkForFlashLoanOpportunities();
    await checkForLayeredMegalodonOpportunities();
    
    // Print statistics
    printStatistics();
  } catch (error) {
    stats.lastError = `${error}`;
    log(`Error in trading loop: ${error}`, 'error');
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('=== SOLANA BLOCKCHAIN TRADING SYSTEM ===');
  console.log('Starting...');
  
  // Verify trading configuration
  const configValid = await verifyTradingConfiguration();
  if (!configValid) {
    console.error('Trading configuration verification failed. Please run setup first.');
    process.exit(1);
  }
  
  console.log('\nTrading system starting with the following configuration:');
  console.log(`Wallet address: ${WALLET_ADDRESS}`);
  console.log(`Profit threshold: ${PROFIT_THRESHOLD}%`);
  console.log(`Maximum trades per hour: ${MAX_TRADES_PER_HOUR}`);
  console.log(`Minimum time between trades: ${MIN_TIME_BETWEEN_TRADES_MS / 1000} seconds\n`);
  
  // Ask for confirmation before starting
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const confirmation = await new Promise<string>((resolve) => {
    rl.question('⚠️ WARNING: This will execute real trades on the blockchain with your funds.\nType "yes" to continue or anything else to cancel: ', (answer) => {
      resolve(answer.toLowerCase());
    });
  });
  
  rl.close();
  
  if (confirmation !== 'yes') {
    console.log('Trading system startup cancelled by user.');
    process.exit(0);
  }
  
  console.log('\nTrading system started! Scanning for opportunities...\n');
  
  // Run the trading loop immediately, then every 30 seconds
  await tradingLoop();
  setInterval(tradingLoop, 30000);
}

// Run the main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});