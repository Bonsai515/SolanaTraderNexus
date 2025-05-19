/**
 * Verify Real Trade Execution
 * 
 * This script verifies that real trades are being executed on the Solana blockchain
 * by checking transaction submissions and confirmations.
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const BACKUP_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

// Check wallet transactions
async function checkWalletTransactions(walletAddress: string): Promise<void> {
  try {
    console.log(`Checking recent transactions for wallet: ${walletAddress}`);

    // First try Helius API for transaction history if available
    if (HELIUS_API_KEY) {
      try {
        const response = await axios.get(
          `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions`,
          {
            params: {
              'api-key': HELIUS_API_KEY,
              limit: 10
            }
          }
        );

        if (response.data && Array.isArray(response.data)) {
          console.log(`Found ${response.data.length} recent transactions via Helius`);
          
          // Analyze transactions to find trades
          for (const tx of response.data) {
            console.log(`\nTransaction: ${tx.signature}`);
            console.log(`Time: ${new Date(tx.timestamp * 1000).toLocaleString()}`);
            console.log(`Status: ${tx.confirmationStatus}`);
            
            // Look for program invocations that suggest trades
            if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
              console.log('✅ TOKEN TRADE DETECTED!');
              console.log('Token transfers:');
              tx.tokenTransfers.forEach((transfer: any) => {
                console.log(`- ${transfer.fromUserAccount} sent ${transfer.tokenAmount} ${transfer.mint} to ${transfer.toUserAccount}`);
              });
            }
            
            // Check if Jupiter was involved (swap/trade)
            const jupiterInvolved = tx.accountData.some((acc: any) => 
              acc.account === 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB'
            );
            
            if (jupiterInvolved) {
              console.log('✅ JUPITER SWAP DETECTED - Confirmed on-chain trade!');
            }
          }
          
          return;
        }
      } catch (error) {
        console.error('Error using Helius API:', error.message);
        // Fall back to Syndica
      }
    }
    
    // Fallback to Syndica for transaction history
    const response = await axios.post(
      SYNDICA_URL,
      {
        jsonrpc: '2.0',
        id: '1',
        method: 'getSignaturesForAddress',
        params: [
          walletAddress,
          {
            limit: 10
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data && response.data.result) {
      const signatures = response.data.result;
      console.log(`Found ${signatures.length} recent transactions via Syndica`);
      
      // For each signature, get transaction details
      for (const sigInfo of signatures) {
        const txResponse = await axios.post(
          SYNDICA_URL,
          {
            jsonrpc: '2.0',
            id: '1',
            method: 'getTransaction',
            params: [
              sigInfo.signature,
              {
                encoding: 'jsonParsed',
                maxSupportedTransactionVersion: 0
              }
            ]
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (txResponse.data && txResponse.data.result) {
          const tx = txResponse.data.result;
          console.log(`\nTransaction: ${sigInfo.signature}`);
          console.log(`Block Time: ${new Date(tx.blockTime * 1000).toLocaleString()}`);
          console.log(`Status: ${tx.meta.err ? 'Failed' : 'Success'}`);
          
          // Check for token balances changes that would indicate trades
          if (tx.meta && tx.meta.postTokenBalances && tx.meta.postTokenBalances.length > 0) {
            console.log('✅ TOKEN BALANCE CHANGES DETECTED - Likely a trade!');
            
            // Compare pre and post token balances
            const preBalances = tx.meta.preTokenBalances || [];
            const postBalances = tx.meta.postTokenBalances || [];
            
            // Log token balance changes
            for (const postBalance of postBalances) {
              const preBalance = preBalances.find((b: any) => 
                b.accountIndex === postBalance.accountIndex && b.mint === postBalance.mint
              );
              
              if (preBalance) {
                const preAmount = parseInt(preBalance.uiTokenAmount.amount) / Math.pow(10, preBalance.uiTokenAmount.decimals);
                const postAmount = parseInt(postBalance.uiTokenAmount.amount) / Math.pow(10, postBalance.uiTokenAmount.decimals);
                const change = postAmount - preAmount;
                
                if (change !== 0) {
                  console.log(`- Token ${postBalance.mint}: ${change > 0 ? '+' : ''}${change} ${postBalance.uiTokenAmount.symbol || 'tokens'}`);
                }
              } else {
                const amount = parseInt(postBalance.uiTokenAmount.amount) / Math.pow(10, postBalance.uiTokenAmount.decimals);
                console.log(`- New token ${postBalance.mint}: ${amount} ${postBalance.uiTokenAmount.symbol || 'tokens'}`);
              }
            }
          }
          
          // Check for SOL balance changes
          if (tx.meta && tx.meta.postBalances && tx.meta.preBalances) {
            const preBalance = tx.meta.preBalances[0] / 1000000000; // Convert lamports to SOL
            const postBalance = tx.meta.postBalances[0] / 1000000000;
            const change = postBalance - preBalance;
            
            if (Math.abs(change) > 0.000001) { // Ignore dust
              console.log(`SOL balance change: ${change > 0 ? '+' : ''}${change.toFixed(9)} SOL`);
            }
          }
          
          // Check for program invocations
          if (tx.meta && tx.meta.logMessages) {
            // Check for Jupiter program (swap)
            const jupiterInvoked = tx.meta.logMessages.some((log: string) => 
              log.includes('Program JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB invoke')
            );
            
            if (jupiterInvoked) {
              console.log('✅ JUPITER PROGRAM INVOKED - Confirmed on-chain trade!');
            }
            
            // Check for token program (transfers)
            const tokenProgramInvoked = tx.meta.logMessages.some((log: string) => 
              log.includes('Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke')
            );
            
            if (tokenProgramInvoked) {
              console.log('✅ TOKEN PROGRAM INVOKED - Token transfers detected!');
            }
          }
        }
      }
    } else {
      console.log('No recent transactions found');
    }
  } catch (error) {
    console.error('Error checking wallet transactions:', error);
  }
}

// Check if trading is enabled
async function checkTradingEnabled(): Promise<boolean> {
  try {
    const envPath = '.env.trading';
    const fs = require('fs');
    if (!fs.existsSync(envPath)) {
      console.log('⚠️ Trading configuration file not found');
      return false;
    }
    
    const content = fs.readFileSync(envPath, 'utf8');
    
    // Check for use real funds setting
    const useRealFunds = content.includes('USE_REAL_FUNDS=true');
    
    // Check for other critical settings
    const syndica = content.includes('SYNDICA_API_KEY=');
    const helius = content.includes('HELIUS_API_KEY=');
    const minProfit = content.match(/MIN_PROFIT_THRESHOLD_PERCENT=([0-9.]+)/);
    
    console.log('\n=== TRADING CONFIGURATION ===');
    console.log(`Use real funds: ${useRealFunds ? '✅ YES' : '❌ NO'}`);
    console.log(`Syndica API key: ${syndica ? '✅ Present' : '❌ Missing'}`);
    console.log(`Helius API key: ${helius ? '✅ Present' : '❌ Missing'}`);
    console.log(`Min profit threshold: ${minProfit ? minProfit[1] + '%' : '❌ Not set'}`);
    
    return useRealFunds;
  } catch (error) {
    console.error('Error checking trading configuration:', error);
    return false;
  }
}

// Check transaction sending capabilities
async function checkTransactionCapabilities(): Promise<void> {
  try {
    // Check if necessary modules exist
    const fs = require('fs');
    
    console.log('\n=== TRANSACTION EXECUTION CAPABILITIES ===');
    
    // Check for transaction engine
    const hasNexusEngine = fs.existsSync('./src/nexus_engine') || fs.existsSync('./nexus_engine');
    console.log(`Nexus Transaction Engine: ${hasNexusEngine ? '✅ Present' : '❌ Missing'}`);
    
    // Check for recent transaction records
    const hasTransactionLogs = fs.existsSync('./logs/transactions.log');
    console.log(`Transaction logs: ${hasTransactionLogs ? '✅ Present' : '❌ Missing'}`);
    
    // Check for the real-trade-monitor
    const hasTradeMonitor = fs.existsSync('./src/real-trade-monitor.ts');
    console.log(`Real trade monitor: ${hasTradeMonitor ? '✅ Present' : '❌ Missing'}`);
    
    // Check if modules to create transactions exist
    const modules = [
      '@solana/web3.js',
      '@solana/spl-token'
    ];
    
    for (const module of modules) {
      try {
        require.resolve(module);
        console.log(`${module}: ✅ Installed`);
      } catch (e) {
        console.log(`${module}: ❌ Not installed`);
      }
    }
  } catch (error) {
    console.error('Error checking transaction capabilities:', error);
  }
}

// Main function
async function main(): Promise<void> {
  console.log('=== VERIFYING REAL TRADE EXECUTION ===');
  
  // Check if trading is enabled
  const tradingEnabled = await checkTradingEnabled();
  
  // Check transaction capabilities
  await checkTransactionCapabilities();
  
  // Check for wallet transactions
  console.log('\n=== CHECKING WALLET TRANSACTIONS ===');
  await checkWalletTransactions(WALLET_ADDRESS);
  
  // Check backup wallet if primary wallet has no transactions
  if (BACKUP_WALLET_ADDRESS && BACKUP_WALLET_ADDRESS !== WALLET_ADDRESS) {
    console.log('\n=== CHECKING BACKUP WALLET TRANSACTIONS ===');
    await checkWalletTransactions(BACKUP_WALLET_ADDRESS);
  }
  
  console.log('\n=== TRADE EXECUTION VERIFICATION SUMMARY ===');
  if (tradingEnabled) {
    console.log('✅ Trading is ENABLED - System is configured to submit real transactions');
  } else {
    console.log('❌ Trading is DISABLED - System is NOT submitting real transactions');
    console.log('To enable real transactions, set USE_REAL_FUNDS=true in .env.trading');
  }
  
  console.log('\n=== RECOMMENDATIONS ===');
  console.log('1. Use Solscan to monitor your wallet transactions: https://solscan.io/address/' + WALLET_ADDRESS);
  console.log('2. Check your wallet balance regularly for changes');
  console.log('3. Verify completed trades in the transaction logs');
}

// Run the script
main();