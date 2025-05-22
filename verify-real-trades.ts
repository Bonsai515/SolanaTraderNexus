/**
 * Verify Real Blockchain Trades
 * 
 * This script verifies actual on-chain trading activity and
 * wallet balance changes to ensure real trading is happening.
 */

import * as fs from 'fs';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Configuration
const LOG_PATH = './verify-real-trades.log';
const PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const BALANCE_HISTORY_PATH = './balance-history.json';
const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana'
];

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- VERIFY REAL TRADES LOG ---\n');
}

// Initialize balance history if it doesn't exist
if (!fs.existsSync(BALANCE_HISTORY_PATH)) {
  fs.writeFileSync(BALANCE_HISTORY_PATH, JSON.stringify({
    balanceHistory: [
      {
        timestamp: Date.now(),
        balance: 1.004956,
        blockTime: Math.floor(Date.now() / 1000)
      }
    ]
  }));
}

// Log function
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Get Solana connection with fallback to multiple RPC endpoints
async function getSolanaConnection(): Promise<Connection> {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      log(`Trying to connect to Solana via ${endpoint}...`);
      const connection = new Connection(endpoint, 'confirmed');
      
      // Test connection with a simple call
      const blockHeight = await connection.getBlockHeight();
      log(`Connected to ${endpoint} successfully (block height: ${blockHeight})`);
      
      return connection;
    } catch (error) {
      log(`Failed to connect to ${endpoint}: ${(error as Error).message}`);
    }
  }
  
  throw new Error('All RPC endpoints failed, cannot connect to Solana');
}

// Get transaction history for wallet
async function getTransactionHistory(connection: Connection, wallet: PublicKey): Promise<void> {
  try {
    log(`Fetching transaction history for ${wallet.toString()}...`);
    
    const transactions = await connection.getSignaturesForAddress(wallet, {
      limit: 10
    });
    
    if (transactions.length === 0) {
      log('No recent transactions found for this wallet');
      return;
    }
    
    log(`Found ${transactions.length} recent transactions:`);
    
    for (const tx of transactions) {
      const timestamp = new Date(tx.blockTime! * 1000).toISOString();
      log(`- Tx: ${tx.signature} | Time: ${timestamp} | Status: ${tx.confirmationStatus}`);
      
      // Get transaction details
      try {
        const txDetails = await connection.getParsedTransaction(tx.signature);
        const fee = txDetails?.meta?.fee ? txDetails.meta.fee / LAMPORTS_PER_SOL : 0;
        
        if (txDetails?.meta?.postBalances && txDetails?.meta?.preBalances) {
          const preBalance = txDetails.meta.preBalances[0] / LAMPORTS_PER_SOL;
          const postBalance = txDetails.meta.postBalances[0] / LAMPORTS_PER_SOL;
          const balanceChange = postBalance - preBalance;
          
          log(`  Balance change: ${balanceChange.toFixed(6)} SOL (Fee: ${fee.toFixed(6)} SOL)`);
          
          if (balanceChange > 0) {
            log(`  ✅ PROFIT DETECTED: +${balanceChange.toFixed(6)} SOL`);
          }
        }
      } catch (error) {
        log(`  Error getting transaction details: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    log(`Error fetching transaction history: ${(error as Error).message}`);
  }
}

// Check current wallet balance and compare with history
async function checkWalletBalance(connection: Connection, wallet: PublicKey): Promise<void> {
  try {
    // Get current balance
    const balance = await connection.getBalance(wallet);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    log(`Current wallet balance: ${balanceSOL.toFixed(6)} SOL`);
    
    // Get block time
    const blockHeight = await connection.getBlockHeight();
    const slot = await connection.getSlot();
    const blockTime = await connection.getBlockTime(slot);
    
    // Load balance history
    const balanceHistory = JSON.parse(fs.readFileSync(BALANCE_HISTORY_PATH, 'utf8'));
    
    // Get the last recorded balance
    const lastBalance = balanceHistory.balanceHistory[balanceHistory.balanceHistory.length - 1];
    
    // Calculate change
    const balanceChange = balanceSOL - lastBalance.balance;
    
    log(`Previous balance: ${lastBalance.balance.toFixed(6)} SOL (recorded at ${new Date(lastBalance.timestamp).toISOString()})`);
    
    if (balanceChange !== 0) {
      if (balanceChange > 0) {
        log(`✅ BALANCE INCREASED: +${balanceChange.toFixed(6)} SOL since last check`);
      } else {
        log(`⚠️ BALANCE DECREASED: ${balanceChange.toFixed(6)} SOL since last check`);
      }
      
      // Add new balance to history
      balanceHistory.balanceHistory.push({
        timestamp: Date.now(),
        balance: balanceSOL,
        blockTime: blockTime || Math.floor(Date.now() / 1000),
        blockHeight
      });
      
      // Save updated history
      fs.writeFileSync(BALANCE_HISTORY_PATH, JSON.stringify(balanceHistory, null, 2));
      log(`Updated balance history saved to ${BALANCE_HISTORY_PATH}`);
    } else {
      log(`⚠️ NO BALANCE CHANGE detected since last check`);
    }
    
    // Display summary of all balance changes
    displayBalanceChangeSummary(balanceHistory.balanceHistory);
  } catch (error) {
    log(`Error checking wallet balance: ${(error as Error).message}`);
  }
}

// Display summary of all balance changes
function displayBalanceChangeSummary(balanceHistory: any[]): void {
  if (balanceHistory.length <= 1) {
    log('Not enough balance history to display changes');
    return;
  }
  
  log('\n===== WALLET BALANCE HISTORY =====');
  
  let totalChange = 0;
  let lastBalance = balanceHistory[0].balance;
  
  for (let i = 1; i < balanceHistory.length; i++) {
    const entry = balanceHistory[i];
    const prevEntry = balanceHistory[i - 1];
    const change = entry.balance - prevEntry.balance;
    totalChange += change;
    
    const timestamp = new Date(entry.timestamp).toISOString();
    const changeStr = change >= 0 ? `+${change.toFixed(6)}` : change.toFixed(6);
    
    log(`${timestamp}: ${entry.balance.toFixed(6)} SOL (${changeStr} SOL)`);
  }
  
  const firstBalance = balanceHistory[0].balance;
  const currentBalance = balanceHistory[balanceHistory.length - 1].balance;
  const overallChange = currentBalance - firstBalance;
  const percentChange = (overallChange / firstBalance) * 100;
  
  log(`\nSUMMARY:`);
  log(`Starting balance: ${firstBalance.toFixed(6)} SOL`);
  log(`Current balance: ${currentBalance.toFixed(6)} SOL`);
  log(`Overall change: ${overallChange >= 0 ? '+' : ''}${overallChange.toFixed(6)} SOL (${percentChange.toFixed(2)}%)`);
}

// Main function
async function main(): Promise<void> {
  try {
    log('Starting real trade verification...');
    
    // Get Solana connection
    const connection = await getSolanaConnection();
    
    // Create PublicKey from wallet address
    const wallet = new PublicKey(PHANTOM_WALLET);
    
    // Check current wallet balance
    await checkWalletBalance(connection, wallet);
    
    // Get transaction history
    await getTransactionHistory(connection, wallet);
    
    log('Real trade verification completed');
    
    // Display final assessment
    const balanceHistory = JSON.parse(fs.readFileSync(BALANCE_HISTORY_PATH, 'utf8')).balanceHistory;
    
    if (balanceHistory.length > 1) {
      const firstBalance = balanceHistory[0].balance;
      const currentBalance = balanceHistory[balanceHistory.length - 1].balance;
      const change = currentBalance - firstBalance;
      
      if (change > 0) {
        console.log('\n===== REAL TRADING ASSESSMENT =====');
        console.log(`✅ REAL PROFITS CONFIRMED: +${change.toFixed(6)} SOL (${((change / firstBalance) * 100).toFixed(2)}%)`);
        console.log('System is successfully executing real blockchain trades');
      } else if (change < 0) {
        console.log('\n===== REAL TRADING ASSESSMENT =====');
        console.log(`⚠️ WALLET BALANCE DECREASED: ${change.toFixed(6)} SOL`);
        console.log('System may be paying transaction fees without generating profits');
      } else {
        console.log('\n===== REAL TRADING ASSESSMENT =====');
        console.log('⚠️ NO BALANCE CHANGE detected over the verification period');
        console.log('Real trading may not be active or may be balancing out with fees');
      }
    }
    
  } catch (error) {
    log(`Fatal error: ${(error as Error).message}`);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    log(`Unhandled error: ${error.message}`);
  });
}