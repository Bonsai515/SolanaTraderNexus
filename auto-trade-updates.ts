/**
 * Automatic Trade Updates
 * 
 * This script monitors trading activity and sends real-time updates
 * on successful trades and profit.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Configuration
const WALLET_ADDRESS = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const UPDATE_INTERVAL_MS = 5000; // 5 seconds
const LOG_DIR = './nexus_engine/logs';
const UPDATES_LOG = './trade-updates.log';

// Trading stats
let initialBalance = 0;
let currentBalance = 0;
let totalTrades = 0;
let successfulTrades = 0;
let failedTrades = 0;
let totalProfit = 0;
let startTime = Date.now();
let processedLogEntries = new Set<string>();

// Initialize logs
if (!fs.existsSync(UPDATES_LOG)) {
  fs.writeFileSync(UPDATES_LOG, '--- AUTOMATIC TRADE UPDATES ---\n');
}

// Log function
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(UPDATES_LOG, logMessage + '\n');
}

// Connect to Solana
function connectToSolana(): Connection {
  return new Connection(RPC_URL, 'confirmed');
}

// Get wallet balance
async function getWalletBalance(connection: Connection): Promise<number> {
  try {
    const publicKey = new PublicKey(WALLET_ADDRESS);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    log(`Error getting wallet balance: ${(error as Error).message}`);
    return 0;
  }
}

// Format time
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
}

// Check for new trades in logs
function checkForNewTrades(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      return;
    }
    
    const logFiles = fs.readdirSync(LOG_DIR)
      .filter(file => file.startsWith('nexus-engine-') && file.endsWith('.log'))
      .sort((a, b) => {
        const timeA = parseInt(a.replace('nexus-engine-', '').replace('.log', '')) || 0;
        const timeB = parseInt(b.replace('nexus-engine-', '').replace('.log', '')) || 0;
        return timeB - timeA;  // Most recent first
      });
    
    if (logFiles.length === 0) {
      return;
    }
    
    const latestLogFile = path.join(LOG_DIR, logFiles[0]);
    const logContent = fs.readFileSync(latestLogFile, 'utf8');
    const logLines = logContent.split('\n');
    
    for (const line of logLines) {
      // Skip already processed lines
      if (processedLogEntries.has(line) || line.trim() === '') {
        continue;
      }
      
      // Mark line as processed
      processedLogEntries.add(line);
      
      // Check for successful trades
      if (line.includes('TRADE SUCCESSFUL')) {
        const profitMatch = line.match(/Profit: \+([0-9.]+) SOL/);
        if (profitMatch && profitMatch[1]) {
          const profit = parseFloat(profitMatch[1]);
          successfulTrades++;
          totalTrades++;
          totalProfit += profit;
          
          const strategyMatch = line.match(/from ([a-zA-Z]+)/);
          const strategy = strategyMatch ? strategyMatch[1] : 'Unknown';
          
          const update = `✅ SUCCESSFUL TRADE: +${profit.toFixed(6)} SOL from ${strategy} strategy`;
          log(update);
          printTradeUpdate(update);
        }
      }
      
      // Check for failed trades
      else if (line.includes('Trade failed')) {
        const lossMatch = line.match(/Loss: -([0-9.]+) SOL/);
        if (lossMatch && lossMatch[1]) {
          const loss = parseFloat(lossMatch[1]);
          failedTrades++;
          totalTrades++;
          totalProfit -= loss;
          
          const strategyMatch = line.match(/from ([a-zA-Z]+)/);
          const strategy = strategyMatch ? strategyMatch[1] : 'Unknown';
          
          const update = `❌ FAILED TRADE: -${loss.toFixed(6)} SOL from ${strategy} strategy`;
          log(update);
          printTradeUpdate(update);
        }
      }
      
      // Check for strategy opportunities being scanned
      else if (line.includes('Found potential opportunity for')) {
        const strategyMatch = line.match(/opportunity for ([a-zA-Z]+)!/);
        if (strategyMatch && strategyMatch[1]) {
          const strategy = strategyMatch[1];
          const update = `🔍 Analyzing opportunity for ${strategy} strategy...`;
          log(update);
          // Don't print scanning messages to avoid too many updates
        }
      }
    }
  } catch (error) {
    console.error(`Error checking for new trades: ${(error as Error).message}`);
  }
}

// Print trade update
function printTradeUpdate(update: string): void {
  const divider = '════════════════════════════════════════════════════════';
  console.log('\n' + divider);
  console.log('           🚀 AUTOMATIC TRADE UPDATE 🚀');
  console.log(divider);
  console.log(update);
  console.log(`💰 Total Profit: ${totalProfit.toFixed(6)} SOL`);
  console.log(`📊 Success Rate: ${successfulTrades}/${totalTrades} (${totalTrades > 0 ? ((successfulTrades / totalTrades) * 100).toFixed(1) : 0}%)`);
  console.log(`⏱️ Trading for: ${formatTime(Date.now() - startTime)}`);
  console.log(divider + '\n');
}

// Print summary
async function printSummary(connection: Connection): Promise<void> {
  try {
    // Get current balance
    currentBalance = await getWalletBalance(connection);
    const balanceChange = currentBalance - initialBalance;
    
    const divider = '════════════════════════════════════════════════════════';
    console.log('\n' + divider);
    console.log('           📈 TRADING PERFORMANCE SUMMARY 📈');
    console.log(divider);
    console.log(`Wallet: ${WALLET_ADDRESS}`);
    console.log(`Trading for: ${formatTime(Date.now() - startTime)}`);
    console.log('──────────────────────────────────────────────────────────');
    console.log(`Current Balance:  ${currentBalance.toFixed(6)} SOL`);
    console.log(`Initial Balance:  ${initialBalance.toFixed(6)} SOL`);
    console.log(`Balance Change:   ${balanceChange >= 0 ? '+' : ''}${balanceChange.toFixed(6)} SOL (${balanceChange >= 0 ? '+' : ''}${initialBalance > 0 ? ((balanceChange / initialBalance) * 100).toFixed(2) : 0}%)`);
    console.log('──────────────────────────────────────────────────────────');
    console.log(`Total Trades:     ${totalTrades}`);
    console.log(`Successful:       ${successfulTrades}`);
    console.log(`Failed:           ${failedTrades}`);
    console.log(`Success Rate:     ${totalTrades > 0 ? ((successfulTrades / totalTrades) * 100).toFixed(2) : 0}%`);
    console.log('──────────────────────────────────────────────────────────');
    console.log(`Reported Profit:  ${totalProfit.toFixed(6)} SOL`);
    console.log(divider);
    console.log('Auto-updates enabled. Press Ctrl+C to exit.\n');
  } catch (error) {
    console.error(`Error printing summary: ${(error as Error).message}`);
  }
}

// Main function
async function main(): Promise<void> {
  try {
    console.log('Starting automatic trade updates...');
    
    const connection = connectToSolana();
    
    // Get initial wallet balance
    initialBalance = await getWalletBalance(connection);
    currentBalance = initialBalance;
    
    log(`Initial wallet balance: ${initialBalance.toFixed(6)} SOL`);
    log('Watching for trades...');
    
    // Print initial summary
    await printSummary(connection);
    
    // Check for trades periodically
    setInterval(() => {
      checkForNewTrades();
    }, UPDATE_INTERVAL_MS);
    
    // Print summary periodically (every 30 seconds)
    setInterval(async () => {
      await printSummary(connection);
    }, 30000);
    
  } catch (error) {
    console.error(`Error in main: ${(error as Error).message}`);
  }
}

// Start the script
main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
});