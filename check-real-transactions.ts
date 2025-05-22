/**
 * Check Real Blockchain Transactions
 * 
 * This script verifies trade transactions directly on the Solana blockchain
 * using the transaction IDs from the dashboard
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';

// RPC Endpoint
const RPC_URL = 'https://api.mainnet-beta.solana.com';

// The trading wallet
const TRADING_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// The profit collection wallet
const PROFIT_WALLET = '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e';

interface Transaction {
  time: string;
  strategy: string;
  transactionHash: string;
  amount: string;
  profit: string;
}

// Extract transactions from dashboard
function extractTransactionsFromDashboard(): Transaction[] {
  try {
    // Read the dashboard file
    const dashboardContent = fs.readFileSync('./HYPER_AGGRESSIVE_PROFIT_DASHBOARD.md', 'utf8');
    
    // Extract the transaction table
    const transactionTableRegex = /## TRADE HISTORY\s+\|\s+Time\s+\|\s+Strategy\s+\|\s+Amount\s+\|\s+Profit\s+\|\s+Blockchain TX\s+\|([\s\S]+?)(?:\s+##|$)/;
    const tableMatch = dashboardContent.match(transactionTableRegex);
    
    if (!tableMatch || !tableMatch[1]) {
      console.error('No transaction table found in the dashboard.');
      return [];
    }
    
    // Extract transaction rows
    const transactionRows = tableMatch[1].trim().split('\n');
    
    const transactions: Transaction[] = [];
    
    for (const row of transactionRows) {
      // Skip header or separator rows
      if (row.trim().startsWith('|---') || row.trim() === '') {
        continue;
      }
      
      // Parse the row
      const columns = row.split('|').map(col => col.trim());
      
      if (columns.length >= 6) {
        const time = columns[1];
        const strategy = columns[2];
        const amount = columns[3];
        const profit = columns[4];
        
        // Extract transaction hash from markdown link
        const txLinkMatch = columns[5].match(/\[([^\]]+)\]\((https:\/\/explorer\.solana\.com\/tx\/)([^)]+)\)/);
        const transactionHash = txLinkMatch ? txLinkMatch[3] : columns[5];
        
        transactions.push({
          time,
          strategy,
          transactionHash,
          amount,
          profit
        });
      }
    }
    
    return transactions;
  } catch (error) {
    console.error('Error extracting transactions from dashboard:', error);
    return [];
  }
}

// Check transactions on the blockchain
async function checkTransactionsOnBlockchain(transactions: Transaction[]): Promise<void> {
  const connection = new Connection(RPC_URL, 'confirmed');
  
  console.log('\n=== VERIFYING REAL BLOCKCHAIN TRANSACTIONS ===\n');
  
  console.log(`Checking ${transactions.length} transactions on Solana blockchain...`);
  console.log(`Trading Wallet: ${TRADING_WALLET}`);
  console.log(`Profit Wallet: ${PROFIT_WALLET}\n`);
  
  let confirmedCount = 0;
  let pendingCount = 0;
  let invalidCount = 0;
  
  for (const tx of transactions) {
    // Skip simulated transactions (they don't have real signatures)
    if (tx.transactionHash.startsWith('simulate_') || tx.transactionHash.startsWith('hyper_')) {
      console.log(`⚠️ ${tx.strategy} (${tx.amount}) - TX: ${tx.transactionHash}`);
      console.log(`   Status: SIMULATED (not a real blockchain transaction)`);
      console.log(`   Time: ${tx.time}`);
      console.log(`   Profit: ${tx.profit}\n`);
      invalidCount++;
      continue;
    }
    
    try {
      // Check if transaction exists on blockchain
      const transactionStatus = await connection.getSignatureStatus(tx.transactionHash);
      
      if (transactionStatus && transactionStatus.value) {
        const confirmations = transactionStatus.value.confirmations || 0;
        const status = transactionStatus.value.confirmationStatus || 'unknown';
        
        if (confirmations > 0 && status === 'confirmed') {
          console.log(`✅ ${tx.strategy} (${tx.amount}) - TX: ${tx.transactionHash}`);
          console.log(`   Status: CONFIRMED on blockchain (${confirmations} confirmations)`);
          console.log(`   Time: ${tx.time}`);
          console.log(`   Profit: ${tx.profit}\n`);
          confirmedCount++;
        } else {
          console.log(`⏳ ${tx.strategy} (${tx.amount}) - TX: ${tx.transactionHash}`);
          console.log(`   Status: PENDING (${confirmations} confirmations, status: ${status})`);
          console.log(`   Time: ${tx.time}`);
          console.log(`   Profit: ${tx.profit}\n`);
          pendingCount++;
        }
      } else {
        console.log(`❌ ${tx.strategy} (${tx.amount}) - TX: ${tx.transactionHash}`);
        console.log(`   Status: NOT FOUND on blockchain`);
        console.log(`   Time: ${tx.time}`);
        console.log(`   Profit: ${tx.profit}\n`);
        invalidCount++;
      }
    } catch (error) {
      console.log(`❌ ${tx.strategy} (${tx.amount}) - TX: ${tx.transactionHash}`);
      console.log(`   Status: ERROR - Invalid transaction signature`);
      console.log(`   Time: ${tx.time}`);
      console.log(`   Profit: ${tx.profit}\n`);
      invalidCount++;
    }
  }
  
  // Summary
  console.log('=== TRANSACTION VERIFICATION SUMMARY ===\n');
  console.log(`Total Transactions: ${transactions.length}`);
  console.log(`✅ Confirmed on Blockchain: ${confirmedCount}`);
  console.log(`⏳ Pending: ${pendingCount}`);
  console.log(`❌ Invalid/Simulated: ${invalidCount}`);
  
  if (confirmedCount === 0 && invalidCount > 0) {
    console.log('\n⚠️ WARNING: No real blockchain transactions were found! ⚠️');
    console.log('The system appears to be running in simulation mode.\n');
    
    // Update verification status
    updateVerificationStatus(false);
  } else if (confirmedCount > 0) {
    console.log('\n✅ VERIFIED: Real blockchain transactions confirmed! ✅');
    console.log('The system is executing real trades on the Solana blockchain.\n');
    
    // Update verification status
    updateVerificationStatus(true);
  }
}

// Update verification status
function updateVerificationStatus(verified: boolean): void {
  try {
    const statusFile = './TRADE_VERIFICATION_STATUS.md';
    
    const timestamp = new Date().toLocaleString();
    
    let content = `# TRADE VERIFICATION STATUS\n\n`;
    content += `**Last Verified:** ${timestamp}\n\n`;
    
    if (verified) {
      content += `## ✅ REAL BLOCKCHAIN TRADING VERIFIED\n\n`;
      content += `The system is executing **real blockchain transactions** with your funds. These transactions have been verified on the Solana blockchain.\n\n`;
      content += `### Trading Configuration\n\n`;
      content += `- **Trading Wallet:** ${TRADING_WALLET}\n`;
      content += `- **Profit Wallet:** ${PROFIT_WALLET}\n`;
      content += `- **Position Sizing:** 85-95% of available capital\n`;
      content += `- **Trading Frequency:** Every 2 minutes\n`;
      content += `- **Min Profit Threshold:** 0.0008-0.0012 SOL\n\n`;
      content += `### Verification Method\n\n`;
      content += `Transactions were verified by directly querying the Solana blockchain to confirm that the transaction signatures from the trading dashboard exist on-chain.\n`;
    } else {
      content += `## ⚠️ SIMULATION MODE DETECTED\n\n`;
      content += `The system appears to be running in **simulation mode**. No real blockchain transactions were found for the signatures listed in the dashboard.\n\n`;
      content += `### Possible Reasons\n\n`;
      content += `- The system is in testing/simulation mode\n`;
      content += `- Transaction signatures in the dashboard are placeholders\n`;
      content += `- Network or RPC issues prevented verification\n\n`;
      content += `### Next Steps\n\n`;
      content += `If you intend to run real trades:\n\n`;
      content += `1. Check that the trading wallet has sufficient funds\n`;
      content += `2. Verify that the system is configured for real blockchain transactions\n`;
      content += `3. Ensure RPC endpoints are working properly\n`;
    }
    
    fs.writeFileSync(statusFile, content);
    console.log(`Verification status updated at ${statusFile}`);
  } catch (error) {
    console.error('Error updating verification status:', error);
  }
}

// Main function
async function main(): Promise<void> {
  const transactions = extractTransactionsFromDashboard();
  
  if (transactions.length === 0) {
    console.log('No transactions found in the dashboard.');
    return;
  }
  
  await checkTransactionsOnBlockchain(transactions);
}

// Run the main function
main().catch(console.error);