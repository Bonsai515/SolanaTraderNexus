/**
 * Check Flash Loan Trading Results
 * 
 * This script checks the results of flash loan trading operations
 * by monitoring wallet balance changes and transaction history.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';

// Constants
const TRADING_WALLET1_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const INITIAL_BALANCE = 0.097506; // SOL

// Create logs directory if it doesn't exist
const logDir = './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
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

// Check recent transactions
async function checkRecentTransactions(connection: Connection): Promise<void> {
  try {
    const publicKey = new PublicKey(TRADING_WALLET1_ADDRESS);
    const transactions = await connection.getSignaturesForAddress(publicKey, { limit: 10 });
    
    if (transactions.length > 0) {
      console.log(`\nFound ${transactions.length} recent transactions:`);
      
      for (const tx of transactions) {
        const signature = tx.signature;
        const status = tx.err ? 'FAILED' : 'SUCCESS';
        console.log(`- Transaction ${signature} [${status}]`);
      }
    } else {
      console.log('\nNo recent transactions found');
    }
  } catch (error) {
    console.error(`Error checking transactions: ${error}`);
  }
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('📊 FLASH LOAN TRADING RESULTS');
  console.log('=============================================');
  console.log(`Trading Wallet: ${TRADING_WALLET1_ADDRESS}`);
  console.log(`Initial Balance: ${INITIAL_BALANCE} SOL`);
  console.log('=============================================');
  
  try {
    // Setup connection
    const connection = await setupConnection();
    
    // Check current balance
    const currentBalance = await checkWalletBalance(connection);
    console.log(`Current Balance: ${currentBalance.toFixed(6)} SOL`);
    
    // Calculate profit/loss
    const profitLoss = currentBalance - INITIAL_BALANCE;
    console.log(`Profit/Loss: ${profitLoss.toFixed(6)} SOL (${profitLoss > 0 ? 'PROFIT' : 'LOSS'})`);
    
    // Check recent transactions
    await checkRecentTransactions(connection);
    
    console.log('\n=============================================');
    console.log('Flash loan trading results check complete');
    console.log('=============================================');
  } catch (error) {
    console.error(`Error checking flash loan trading results: ${error}`);
  }
}

// Run the script
main();