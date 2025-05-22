/**
 * Trade Monitor for Nexus Pro Engine
 * 
 * This script monitors trading activity and tracks profits in real-time.
 */

const fs = require('fs');
const path = require('path');
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

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
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Connect to Solana
function connectToSolana() {
  return new Connection(RPC_URL, 'confirmed');
}

// Get wallet balance
async function getWalletBalance(connection) {
  try {
    const publicKey = new PublicKey(WALLET_ADDRESS);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    log(`Error getting wallet balance: ${error.message}`);
    return 0;
  }
}

// Format time
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
}

// Calculate profit
function calculateProfit() {
  return currentBalance - initialBalance;
}

// Calculate profit percentage
function calculateProfitPercentage() {
  return initialBalance > 0 ? (calculateProfit() / initialBalance) * 100 : 0;
}

// Display stats
function displayStats() {
  const profit = calculateProfit();
  const profitPercentage = calculateProfitPercentage();
  const runTime = formatTime(Date.now() - startTime);
  
  console.clear();
  console.log('=============================================');
  console.log('          TRADING PERFORMANCE MONITOR       ');
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
    
    // Read Nexus engine logs to track trades
    const engineLogDir = './nexus_engine/logs';
    let lastProcessedTime = Date.now();
    
    // Start monitoring
    setInterval(async () => {
      try {
        // Update current balance
        const newBalance = await getWalletBalance(connection);
        
        // Detect trades based on balance changes
        if (Math.abs(newBalance - currentBalance) > 0.000001) {
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
          
          if (currentBalance < lowestBalance && currentBalance > 0) {
            lowestBalance = currentBalance;
          }
        } else {
          // If no balance change, check engine logs for trade records
          if (fs.existsSync(engineLogDir)) {
            const logFiles = fs.readdirSync(engineLogDir)
              .filter(file => file.startsWith('nexus-engine-') && file.endsWith('.log'))
              .sort((a, b) => {
                const timeA = parseInt(a.replace('nexus-engine-', '').replace('.log', '')) || 0;
                const timeB = parseInt(b.replace('nexus-engine-', '').replace('.log', '')) || 0;
                return timeB - timeA;  // Most recent first
              });
            
            if (logFiles.length > 0) {
              const latestLogFile = path.join(engineLogDir, logFiles[0]);
              const logContent = fs.readFileSync(latestLogFile, 'utf8');
              
              // Look for successful trades
              const successMatches = logContent.match(/TRADE SUCCESSFUL! Profit: \+([0-9.]+) SOL/g);
              // Look for failed trades
              const failMatches = logContent.match(/Trade failed. Loss: -([0-9.]+) SOL/g);
              
              if (successMatches) {
                for (const match of successMatches) {
                  const profitMatch = match.match(/\+([0-9.]+) SOL/);
                  if (profitMatch && profitMatch[1]) {
                    const profit = parseFloat(profitMatch[1]);
                    successfulTrades++;
                    totalTrades++;
                    log(`✅ Trade from logs - Profit: +${profit.toFixed(6)} SOL`);
                  }
                }
              }
              
              if (failMatches) {
                for (const match of failMatches) {
                  const lossMatch = match.match(/-([0-9.]+) SOL/);
                  if (lossMatch && lossMatch[1]) {
                    const loss = parseFloat(lossMatch[1]);
                    failedTrades++;
                    totalTrades++;
                    log(`❌ Trade from logs - Loss: -${loss.toFixed(6)} SOL`);
                  }
                }
              }
            }
          }
          
          // If no change in balance, keep current values
          currentBalance = newBalance;
        }
        
        // Display stats
        displayStats();
      } catch (error) {
        log(`Error in monitor loop: ${error.message}`);
      }
    }, UPDATE_INTERVAL_MS);
    
    // Display initial stats
    displayStats();
    
    log('Trade monitor running. Press Ctrl+C to exit.');
  } catch (error) {
    log(`Error starting monitor: ${error.message}`);
  }
}

// Start monitoring
monitorTrades().catch(error => {
  log(`Fatal error: ${error.message}`);
});