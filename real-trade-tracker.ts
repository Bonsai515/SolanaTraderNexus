/**
 * Real Trade Tracker
 * 
 * This script tracks real blockchain trades and calculates actual profits.
 */

import * as fs from 'fs';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';

// Configuration
const LOG_PATH = './real-trade-tracker.log';
const PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const TRADE_HISTORY_PATH = './real-trade-history.json';
const DASHBOARD_PATH = './REAL_TRADING_DASHBOARD.md';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- REAL TRADE TRACKER LOG ---\n');
}

// Initialize trade history if it doesn't exist
if (!fs.existsSync(TRADE_HISTORY_PATH)) {
  fs.writeFileSync(TRADE_HISTORY_PATH, JSON.stringify({
    trades: [],
    lastCheckTimestamp: Date.now(),
    initialBalance: 1.004956,
    currentBalance: 1.004956
  }));
}

// Log function
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Get Solana connection
function getConnection(): Connection {
  return new Connection(RPC_URL, 'confirmed');
}

// Get current wallet balance
async function getWalletBalance(): Promise<number> {
  try {
    const connection = getConnection();
    const wallet = new PublicKey(PHANTOM_WALLET);
    const balance = await connection.getBalance(wallet);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    
    log(`Current wallet balance: ${balanceSOL.toFixed(6)} SOL`);
    return balanceSOL;
  } catch (error) {
    log(`Error fetching wallet balance: ${(error as Error).message}`);
    throw error;
  }
}

// Get recent transactions for the wallet
async function getRecentTransactions(): Promise<any[]> {
  try {
    const connection = getConnection();
    const wallet = new PublicKey(PHANTOM_WALLET);
    
    log('Fetching recent transactions...');
    const signatures = await connection.getSignaturesForAddress(wallet, { limit: 20 });
    
    const transactions = [];
    for (const sig of signatures) {
      try {
        const txDetails = await connection.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
        if (txDetails) {
          const blockTime = txDetails.blockTime ? new Date(txDetails.blockTime * 1000) : new Date();
          const fee = txDetails.meta?.fee ? txDetails.meta.fee / LAMPORTS_PER_SOL : 0;
          
          // Calculate balance change
          let preBalance = 0;
          let postBalance = 0;
          
          if (txDetails.meta?.preBalances && txDetails.meta?.postBalances) {
            preBalance = txDetails.meta.preBalances[0] / LAMPORTS_PER_SOL;
            postBalance = txDetails.meta.postBalances[0] / LAMPORTS_PER_SOL;
          }
          
          const balanceChange = postBalance - preBalance;
          
          // Check if this is a swap transaction
          const isJupiterSwap = txDetails.transaction.message.accountKeys.some(key => 
            key.pubkey.toString() === 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4' ||
            key.pubkey.toString() === 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB'
          );
          
          transactions.push({
            signature: sig.signature,
            blockTime,
            fee,
            preBalance,
            postBalance,
            balanceChange,
            isJupiterSwap,
            status: txDetails.meta?.err ? 'Failed' : 'Success'
          });
        }
      } catch (error) {
        log(`Error fetching transaction details for ${sig.signature}: ${(error as Error).message}`);
      }
    }
    
    return transactions;
  } catch (error) {
    log(`Error fetching recent transactions: ${(error as Error).message}`);
    return [];
  }
}

// Update trade history with new transactions
async function updateTradeHistory(): Promise<void> {
  try {
    // Load existing trade history
    const history = JSON.parse(fs.readFileSync(TRADE_HISTORY_PATH, 'utf8'));
    const lastCheckTimestamp = history.lastCheckTimestamp;
    
    // Get current wallet balance
    const currentBalance = await getWalletBalance();
    
    // Get recent transactions
    const transactions = await getRecentTransactions();
    
    // Filter for new transactions since last check
    const newTransactions = transactions.filter(tx => 
      tx.blockTime.getTime() > lastCheckTimestamp
    );
    
    if (newTransactions.length > 0) {
      log(`Found ${newTransactions.length} new transactions since last check`);
      
      // Add new transactions to history
      for (const tx of newTransactions) {
        if (tx.isJupiterSwap) {
          log(`✅ New Jupiter swap detected: ${tx.signature.substring(0, 8)}...`);
          log(`   Balance change: ${tx.balanceChange.toFixed(6)} SOL (fee: ${tx.fee.toFixed(6)} SOL)`);
          
          const profitAfterFee = tx.balanceChange + tx.fee;
          
          if (profitAfterFee > 0) {
            log(`   🔥 PROFIT DETECTED: +${profitAfterFee.toFixed(6)} SOL`);
          } else if (profitAfterFee < 0) {
            log(`   ⚠️ NO PROFIT: ${profitAfterFee.toFixed(6)} SOL`);
          }
          
          history.trades.push({
            signature: tx.signature,
            timestamp: tx.blockTime.getTime(),
            blockTime: tx.blockTime.toISOString(),
            balanceChange: tx.balanceChange,
            fee: tx.fee,
            profitAfterFee,
            isJupiterSwap: tx.isJupiterSwap,
            status: tx.status
          });
        } else {
          // Non-Jupiter transaction
          log(`Transaction detected: ${tx.signature.substring(0, 8)}...`);
          log(`   Balance change: ${tx.balanceChange.toFixed(6)} SOL (fee: ${tx.fee.toFixed(6)} SOL)`);
          
          history.trades.push({
            signature: tx.signature,
            timestamp: tx.blockTime.getTime(),
            blockTime: tx.blockTime.toISOString(),
            balanceChange: tx.balanceChange,
            fee: tx.fee,
            isJupiterSwap: tx.isJupiterSwap,
            status: tx.status
          });
        }
      }
    } else {
      log('No new transactions found since last check');
    }
    
    // Update history with current balance and timestamp
    history.currentBalance = currentBalance;
    history.lastCheckTimestamp = Date.now();
    
    // Calculate total profit
    const totalProfit = currentBalance - history.initialBalance;
    history.totalProfit = totalProfit;
    
    // Save updated history
    fs.writeFileSync(TRADE_HISTORY_PATH, JSON.stringify(history, null, 2));
    log(`✅ Trade history updated and saved to ${TRADE_HISTORY_PATH}`);
    
    // Create dashboard
    createRealTradingDashboard(history);
    
  } catch (error) {
    log(`Error updating trade history: ${(error as Error).message}`);
  }
}

// Create real trading dashboard
function createRealTradingDashboard(history: any): void {
  try {
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    
    // Calculate metrics
    const initialBalance = history.initialBalance;
    const currentBalance = history.currentBalance;
    const totalProfit = history.totalProfit || (currentBalance - initialBalance);
    const profitPercent = (totalProfit / initialBalance) * 100;
    
    // Count Jupiter swaps
    const jupiterSwaps = history.trades.filter((trade: any) => trade.isJupiterSwap).length;
    
    // Calculate successful trades
    const successfulTrades = history.trades.filter((trade: any) => 
      trade.isJupiterSwap && (trade.profitAfterFee > 0)
    ).length;
    
    // Success rate
    const successRate = jupiterSwaps > 0 ? (successfulTrades / jupiterSwaps) * 100 : 0;
    
    // Create dashboard content
    let dashboardContent = `# Real Blockchain Trading Dashboard\n\n`;
    dashboardContent += `**Last Updated:** ${currentDate} ${currentTime}\n\n`;
    
    // Add wallet and balance info
    dashboardContent += `## Wallet Details\n`;
    dashboardContent += `- **Wallet Address:** ${PHANTOM_WALLET}\n`;
    dashboardContent += `- **Initial Balance:** ${initialBalance.toFixed(6)} SOL\n`;
    dashboardContent += `- **Current Balance:** ${currentBalance.toFixed(6)} SOL\n`;
    dashboardContent += `- **Total Profit:** ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(6)} SOL (${profitPercent.toFixed(2)}%)\n\n`;
    
    // Add trading metrics
    dashboardContent += `## Trading Metrics\n`;
    dashboardContent += `- **Total Jupiter Swaps:** ${jupiterSwaps}\n`;
    dashboardContent += `- **Successful Trades:** ${successfulTrades}\n`;
    dashboardContent += `- **Success Rate:** ${successRate.toFixed(2)}%\n\n`;
    
    // Add recent trades
    dashboardContent += `## Recent Trades\n\n`;
    
    if (history.trades.length === 0) {
      dashboardContent += `No trades executed yet. Use the links in TRADE_LINKS.md to execute trades.\n\n`;
    } else {
      dashboardContent += `| Time | Type | Change | Fee | Profit | Status |\n`;
      dashboardContent += `|------|------|--------|-----|--------|--------|\n`;
      
      // Sort trades by timestamp (newest first)
      const sortedTrades = [...history.trades].sort((a, b) => b.timestamp - a.timestamp);
      
      // Show at most 10 most recent trades
      const recentTrades = sortedTrades.slice(0, 10);
      
      for (const trade of recentTrades) {
        const tradeTime = new Date(trade.timestamp).toLocaleString();
        const tradeType = trade.isJupiterSwap ? 'Jupiter Swap' : 'Other';
        const balanceChange = trade.balanceChange.toFixed(6);
        const fee = trade.fee.toFixed(6);
        const profit = trade.profitAfterFee ? 
          (trade.profitAfterFee >= 0 ? '+' : '') + trade.profitAfterFee.toFixed(6) :
          'N/A';
        const status = trade.status || 'Unknown';
        
        dashboardContent += `| ${tradeTime} | ${tradeType} | ${balanceChange} | ${fee} | ${profit} | ${status} |\n`;
      }
    }
    
    // Add trade links section
    dashboardContent += `\n## Execute More Trades\n\n`;
    dashboardContent += `Use the trade links in [TRADE_LINKS.md](./TRADE_LINKS.md) to execute more trades with your Phantom wallet.\n\n`;
    
    // Add next steps
    dashboardContent += `## Next Steps\n\n`;
    dashboardContent += `1. Execute trades through your Phantom wallet using the links in TRADE_LINKS.md\n`;
    dashboardContent += `2. Run this tracker to update your dashboard: \`npx ts-node real-trade-tracker.ts\`\n`;
    dashboardContent += `3. Monitor your actual blockchain profits over time\n\n`;
    
    // Add security note
    dashboardContent += `## Security Note\n\n`;
    dashboardContent += `This dashboard shows real blockchain data from your wallet. Your private keys remain secure in your Phantom wallet.\n`;
    
    // Write dashboard to file
    fs.writeFileSync(DASHBOARD_PATH, dashboardContent);
    log(`✅ Real trading dashboard created at ${DASHBOARD_PATH}`);
    
  } catch (error) {
    log(`Error creating real trading dashboard: ${(error as Error).message}`);
  }
}

// Main function
async function main(): Promise<void> {
  try {
    log('Starting real trade tracker...');
    
    // Update trade history
    await updateTradeHistory();
    
    log('Real trade tracking completed');
    
    console.log('\n===== REAL TRADE TRACKING COMPLETE =====');
    console.log('✅ Your wallet has been checked for actual trades');
    console.log('✅ Real trading dashboard has been created');
    console.log('\nTo execute trades:');
    console.log('1. Open TRADE_LINKS.md');
    console.log('2. Click any trade link to open in Phantom');
    console.log('3. Run this tracker again after trading to update results');
    
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