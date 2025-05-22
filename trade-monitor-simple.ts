/**
 * Simple Trade Monitor for Phantom Wallet
 * 
 * This script monitors trades executed by the Nexus Pro Engine
 * and tracks profits in your Phantom wallet.
 */

import * as fs from 'fs';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Parse command line arguments
const args = process.argv.slice(2);
const walletArg = args.find(arg => arg.startsWith('--wallet='));
const WALLET_ADDRESS = walletArg ? walletArg.split('=')[1] : '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';

// Configuration
const LOG_PATH = './trade-monitor.log';
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const UPDATE_INTERVAL_MS = 10000; // 10 seconds

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- TRADE MONITOR LOG ---\n');
}

// Trading stats
let initialBalance = 0;
let currentBalance = 0;
let highestBalance = 0;
let lowestBalance = Number.MAX_VALUE;
let totalTrades = 0;
let successfulTrades = 0;
let failedTrades = 0;
let startTime = Date.now();

// Log function
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
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

// Calculate profit
function calculateProfit(): number {
  return currentBalance - initialBalance;
}

// Calculate profit percentage
function calculateProfitPercentage(): number {
  return initialBalance > 0 ? (calculateProfit() / initialBalance) * 100 : 0;
}

// Display stats
function displayStats() {
  const profit = calculateProfit();
  const profitPercentage = calculateProfitPercentage();
  const runTime = formatTime(Date.now() - startTime);
  
  console.clear();
  console.log('=============================================');
  console.log('          PHANTOM WALLET TRADE MONITOR      ');
  console.log('=============================================');
  console.log(`Wallet: ${WALLET_ADDRESS}`);
  console.log(`Runtime: ${runTime}`);
  console.log('---------------------------------------------');
  console.log(`Initial Balance:  ${initialBalance.toFixed(6)} SOL`);
  console.log(`Current Balance:  ${currentBalance.toFixed(6)} SOL`);
  console.log(`Highest Balance:  ${highestBalance.toFixed(6)} SOL`);
  console.log(`Lowest Balance:   ${lowestBalance.toFixed(6)} SOL`);
  console.log('---------------------------------------------');
  console.log(`Profit/Loss:      ${profit.toFixed(6)} SOL (${profitPercentage.toFixed(2)}%)`);
  console.log('---------------------------------------------');
  console.log(`Total Trades:     ${totalTrades}`);
  console.log(`Successful:       ${successfulTrades}`);
  console.log(`Failed:           ${failedTrades}`);
  console.log('---------------------------------------------');
  console.log(`Success Rate:     ${totalTrades > 0 ? ((successfulTrades / totalTrades) * 100).toFixed(2) : 0}%`);
  console.log('=============================================');
  console.log('Press Ctrl+C to exit');
}

// Main monitor function
async function monitorTrades() {
  try {
    log(`Starting trade monitor for wallet: ${WALLET_ADDRESS}`);
    
    const connection = connectToSolana();
    
    // Get initial balance
    initialBalance = await getWalletBalance(connection);
    currentBalance = initialBalance;
    highestBalance = initialBalance;
    lowestBalance = initialBalance;
    
    log(`Initial wallet balance: ${initialBalance.toFixed(6)} SOL`);
    
    // Start monitoring
    setInterval(async () => {
      try {
        // Update current balance
        const newBalance = await getWalletBalance(connection);
        
        // Detect trades based on balance changes
        if (newBalance !== currentBalance) {
          const difference = newBalance - currentBalance;
          
          if (difference > 0) {
            successfulTrades++;
            log(`✅ Successful trade detected! Profit: +${difference.toFixed(6)} SOL`);
          } else {
            failedTrades++;
            log(`❌ Failed trade detected! Loss: ${difference.toFixed(6)} SOL`);
          }
          
          totalTrades++;
          
          // Update balance
          currentBalance = newBalance;
          
          // Update highest and lowest balances
          if (currentBalance > highestBalance) {
            highestBalance = currentBalance;
          }
          
          if (currentBalance < lowestBalance) {
            lowestBalance = currentBalance;
          }
        }
        
        // Display stats
        displayStats();
      } catch (error) {
        log(`Error in monitor loop: ${(error as Error).message}`);
      }
    }, UPDATE_INTERVAL_MS);
    
    // Display initial stats
    displayStats();
    
    log('Trade monitor running. Press Ctrl+C to exit.');
  } catch (error) {
    log(`Error starting monitor: ${(error as Error).message}`);
  }
}

// Start monitoring
monitorTrades().catch(error => {
  log(`Fatal error: ${error.message}`);
});
