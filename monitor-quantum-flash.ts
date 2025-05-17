/**
 * Monitor Quantum Flash Loan Trading
 * 
 * This script monitors the flash loan trading operations and displays
 * real-time information about trades and profit.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';

// Constants
const TRADING_WALLET1_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds
const LOG_FILE = './logs/quantum-flash-monitor.log';

// Create logs directory if it doesn't exist
const logDir = './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Initialize log file
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, '--- Quantum Flash Loan Monitor Log ---\n');
}

// Setup Solana connection
async function setupConnection(): Promise<Connection> {
  // Use multiple RPC URLs in case one fails
  const rpcUrls = [
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
    'https://solana.public-rpc.com'
  ];
  
  for (const url of rpcUrls) {
    try {
      console.log(`Trying RPC URL: ${url}`);
      const connection = new Connection(url, 'confirmed');
      // Test the connection
      await connection.getRecentBlockhash();
      console.log(`Successfully connected to ${url}`);
      return connection;
    } catch (err) {
      console.error(`Error connecting to ${url}: ${err}`);
    }
  }
  
  throw new Error('Failed to connect to any Solana RPC endpoint');
}

// Check wallet balance
async function checkWalletBalance(connection: Connection): Promise<number> {
  try {
    const publicKey = new PublicKey(TRADING_WALLET1_ADDRESS);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error(`Error checking wallet balance: ${error}`);
    return 0;
  }
}

// Log message to console and file
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Check for recent transactions
async function checkRecentTransactions(connection: Connection): Promise<void> {
  try {
    const publicKey = new PublicKey(TRADING_WALLET1_ADDRESS);
    const transactions = await connection.getSignaturesForAddress(publicKey, { limit: 5 });
    
    if (transactions.length > 0) {
      log(`Found ${transactions.length} recent transactions:`);
      
      for (const tx of transactions) {
        const signature = tx.signature;
        const status = tx.err ? 'FAILED' : 'SUCCESS';
        log(`- Transaction ${signature.substring(0, 12)}...${signature.substring(signature.length - 8)} [${status}]`);
        
        if (!tx.err) {
          try {
            const txDetails = await connection.getParsedTransaction(signature, 'confirmed');
            
            if (txDetails && txDetails.meta) {
              const preBalance = txDetails.meta.preBalances[0] / LAMPORTS_PER_SOL;
              const postBalance = txDetails.meta.postBalances[0] / LAMPORTS_PER_SOL;
              const balanceChange = postBalance - preBalance;
              
              if (balanceChange !== 0) {
                log(`  Balance change: ${balanceChange.toFixed(6)} SOL (${balanceChange > 0 ? 'PROFIT' : 'COST'})`);
              }
              
              // Look for SOL transfers
              if (txDetails.meta.postTokenBalances && txDetails.meta.postTokenBalances.length > 0) {
                log(`  Token balances changed in this transaction`);
              }
            }
          } catch (err) {
            log(`  Error fetching transaction details: ${err}`);
          }
        } else {
          log(`  Error: ${JSON.stringify(tx.err)}`);
        }
      }
    } else {
      log('No recent transactions found');
    }
  } catch (error) {
    log(`Error checking transactions: ${error}`);
  }
}

// Main monitoring function
async function monitorFlashLoans(): Promise<void> {
  let connection: Connection | null = null;
  let initialBalance = 0;
  let lastBalance = 0;
  let iterations = 0;
  
  console.log('=============================================');
  console.log('🔍 QUANTUM FLASH LOAN MONITOR STARTED');
  console.log('=============================================');
  console.log(`Monitoring wallet: ${TRADING_WALLET1_ADDRESS}`);
  console.log(`Check interval: ${CHECK_INTERVAL_MS / 1000} seconds`);
  console.log('Press Ctrl+C to stop monitoring');
  console.log('=============================================');
  
  try {
    // Setup connection
    connection = await setupConnection();
    
    // Get initial balance
    initialBalance = await checkWalletBalance(connection);
    lastBalance = initialBalance;
    
    log(`Initial wallet balance: ${initialBalance.toFixed(6)} SOL`);
    
    // Monitor loop
    while (true) {
      iterations++;
      log(`\n===== Monitoring iteration ${iterations} =====`);
      
      // Check current balance
      const currentBalance = await checkWalletBalance(connection);
      log(`Current wallet balance: ${currentBalance.toFixed(6)} SOL`);
      
      // Calculate profit/loss from initial and since last check
      const totalChange = currentBalance - initialBalance;
      const recentChange = currentBalance - lastBalance;
      
      log(`Total profit/loss: ${totalChange.toFixed(6)} SOL (${totalChange > 0 ? 'PROFIT' : 'LOSS'})`);
      
      if (recentChange !== 0) {
        log(`Change since last check: ${recentChange.toFixed(6)} SOL (${recentChange > 0 ? 'PROFIT' : 'LOSS'})`);
      }
      
      // Check for new transactions
      await checkRecentTransactions(connection);
      
      // Update last balance
      lastBalance = currentBalance;
      
      // Wait for next check
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
    }
  } catch (error) {
    console.error(`Monitoring error: ${error}`);
  }
}

// Run the monitoring
monitorFlashLoans();