/**
 * Trading Monitor Dashboard
 * 
 * This script creates a dashboard to monitor both the Quantum Omega Meme Sniper
 * and the Quantum Flash Loan strategies using Trading Wallet 1.
 */

import * as fs from 'fs';
import { Connection, PublicKey } from '@solana/web3.js';

// Configuration Constants
const TRADING_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

// Helper function to check wallet balance
async function checkWalletBalance(): Promise<number> {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const publicKey = new PublicKey(TRADING_WALLET_ADDRESS);
    const balance = await connection.getBalance(publicKey);
    
    return balance / 1e9; // Convert lamports to SOL
  } catch (error) {
    console.error('Error checking wallet balance:', error);
    return 0;
  }
}

// Helper function to get recent transactions
async function getRecentTransactions(): Promise<any[]> {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const publicKey = new PublicKey(TRADING_WALLET_ADDRESS);
    
    // Get recent transaction signatures
    const signatures = await connection.getSignaturesForAddress(
      publicKey,
      { limit: 10 } // Last 10 transactions
    );
    
    // Get transaction details
    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        try {
          const tx = await connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          });
          
          return {
            signature: sig.signature,
            timestamp: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : 'Unknown',
            status: tx?.meta?.err ? 'Failed' : 'Succeeded',
            fee: tx?.meta?.fee ? tx.meta.fee / 1e9 : 0,
            slot: sig.slot
          };
        } catch (error) {
          console.error(`Error fetching transaction ${sig.signature}:`, error);
          return {
            signature: sig.signature,
            timestamp: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : 'Unknown',
            status: 'Error',
            fee: 0,
            slot: sig.slot
          };
        }
      })
    );
    
    return transactions;
  } catch (error) {
    console.error('Error fetching recent transactions:', error);
    return [];
  }
}

// Check if Quantum Omega Meme Sniper is active
function checkQuantumOmegaStatus(): {active: boolean, config: any} {
  try {
    if (!fs.existsSync('./config/quantum-omega-wallet1-config.json')) {
      return { active: false, config: null };
    }
    
    const configData = fs.readFileSync('./config/quantum-omega-wallet1-config.json', 'utf-8');
    const config = JSON.parse(configData);
    
    return { active: config.active, config };
  } catch (error) {
    console.error('Error checking Quantum Omega status:', error);
    return { active: false, config: null };
  }
}

// Check if Quantum Flash Loan strategy is active
function checkFlashLoanStatus(): {active: boolean, config: any} {
  try {
    if (!fs.existsSync('./config/quantum-flash-wallet1-config.json')) {
      return { active: false, config: null };
    }
    
    const configData = fs.readFileSync('./config/quantum-flash-wallet1-config.json', 'utf-8');
    const config = JSON.parse(configData);
    
    return { active: config.active, config };
  } catch (error) {
    console.error('Error checking Flash Loan status:', error);
    return { active: false, config: null };
  }
}

// Get trade history from logs
function getTradeHistory(): any[] {
  try {
    // Check for Quantum Omega trade logs
    const omegaLogs = fs.readdirSync('./logs')
      .filter(file => file.startsWith('omega-memesniper-simulation-'))
      .sort()
      .reverse();
    
    if (omegaLogs.length === 0) {
      return [];
    }
    
    // Read the most recent log file
    const latestLog = omegaLogs[0];
    const logData = fs.readFileSync(`./logs/${latestLog}`, 'utf-8');
    const logJson = JSON.parse(logData);
    
    // Get trade history from the log
    return logJson.tradeHistory || [];
  } catch (error) {
    console.error('Error reading trade history:', error);
    return [];
  }
}

// Monitor token pairs for flash loan opportunities
function monitorFlashLoanOpportunities(): any[] {
  try {
    // Sample opportunity data - in a real system, this would be fetched from APIs
    const opportunities = [
      {
        pair: 'SOL/USDC',
        exchange1: 'Jupiter',
        price1: 160.25,
        exchange2: 'Raydium',
        price2: 160.35,
        spread: 0.06,
        profitPotential: 0.0001,
        timestamp: new Date().toISOString()
      },
      {
        pair: 'SOL/USDT',
        exchange1: 'Orca',
        price1: 160.15,
        exchange2: 'Jupiter',
        price2: 160.30,
        spread: 0.09,
        profitPotential: 0.0002,
        timestamp: new Date().toISOString()
      },
      {
        pair: 'ETH/USDC',
        exchange1: 'Jupiter',
        price1: 3525.75,
        exchange2: 'Raydium',
        price2: 3526.25,
        spread: 0.01,
        profitPotential: 0.00005,
        timestamp: new Date().toISOString()
      }
    ];
    
    return opportunities;
  } catch (error) {
    console.error('Error monitoring flash loan opportunities:', error);
    return [];
  }
}

// Monitor new meme token launches
function monitorMemeTokenLaunches(): any[] {
  try {
    // Sample meme token launch data - in a real system, this would be fetched from APIs
    const launches = [
      {
        token: 'WOOF',
        name: 'WoofCoin',
        launchTime: new Date(Date.now() - 15 * 60000).toISOString(), // 15 minutes ago
        initialPrice: 0.0000123,
        currentPrice: 0.0000145,
        priceChange: 17.89,
        lpLocked: true,
        lpSize: '234 SOL',
        website: true,
        twitter: true
      },
      {
        token: 'BARK',
        name: 'BarkMoon',
        launchTime: new Date(Date.now() - 45 * 60000).toISOString(), // 45 minutes ago
        initialPrice: 0.0000085,
        currentPrice: 0.0000075,
        priceChange: -11.76,
        lpLocked: true,
        lpSize: '120 SOL',
        website: true,
        twitter: true
      },
      {
        token: 'FLOKI',
        name: 'FlokiSol',
        launchTime: new Date(Date.now() - 120 * 60000).toISOString(), // 2 hours ago
        initialPrice: 0.0000220,
        currentPrice: 0.0000350,
        priceChange: 59.09,
        lpLocked: true,
        lpSize: '540 SOL',
        website: true,
        twitter: true
      }
    ];
    
    return launches;
  } catch (error) {
    console.error('Error monitoring meme token launches:', error);
    return [];
  }
}

// Format SOL amount with proper decimal places
function formatSOL(amount: number): string {
  return amount.toFixed(6) + ' SOL';
}

// Format percentage with + or - sign
function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

// Main function to create the trading monitor dashboard
async function createTradingMonitorDashboard(): Promise<void> {
  console.log('\n===============================================================');
  console.log('🖥️  QUANTUM TRADING MONITOR DASHBOARD');
  console.log('===============================================================');
  
  // Check wallet balance
  const balance = await checkWalletBalance();
  console.log(`\n📊 WALLET STATUS:`);
  console.log(`Address: ${TRADING_WALLET_ADDRESS}`);
  console.log(`Balance: ${formatSOL(balance)} ($${(balance * 160).toFixed(2)})`);
  
  // Check recent transactions
  const transactions = await getRecentTransactions();
  console.log(`\n📝 RECENT TRANSACTIONS (Last ${transactions.length}):`);
  if (transactions.length > 0) {
    transactions.forEach((tx, i) => {
      console.log(`${i+1}. ${tx.signature.slice(0, 8)}...${tx.signature.slice(-8)} | ${tx.timestamp} | ${tx.status} | Fee: ${formatSOL(tx.fee)}`);
    });
  } else {
    console.log('No recent transactions found.');
  }
  
  // Check strategy status
  const omegaStatus = checkQuantumOmegaStatus();
  const flashStatus = checkFlashLoanStatus();
  
  console.log('\n🤖 ACTIVE STRATEGIES:');
  console.log(`1. Quantum Omega Meme Sniper: ${omegaStatus.active ? '✅ ACTIVE' : '❌ INACTIVE'}`);
  if (omegaStatus.active && omegaStatus.config) {
    console.log(`   - Max Position Size: ${omegaStatus.config.params.maxPositionSizePercent * 100}% (${formatSOL(balance * omegaStatus.config.params.maxPositionSizePercent)})`);
    console.log(`   - Take Profit: ${omegaStatus.config.params.takeProfit * 100}%`);
    console.log(`   - Stop Loss: ${omegaStatus.config.params.stopLoss * 100}%`);
  }
  
  console.log(`2. Quantum Flash Loan: ${flashStatus.active ? '✅ ACTIVE' : '❌ INACTIVE'}`);
  if (flashStatus.active && flashStatus.config) {
    console.log(`   - Min Profit Threshold: $${flashStatus.config.params.minProfitThresholdUSD}`);
    console.log(`   - Max Slippage: ${flashStatus.config.params.maxSlippageTolerance * 100}%`);
  }
  
  // Display trade history
  const tradeHistory = getTradeHistory();
  console.log('\n📈 RECENT TRADES:');
  if (tradeHistory.length > 0) {
    tradeHistory.slice(0, 5).forEach((trade, i) => {
      if (trade.status === 'closed' && trade.profitLossSOL !== undefined) {
        const profitLoss = trade.profitLossSOL > 0 ? 
          `PROFIT: ${formatSOL(trade.profitLossSOL)} (${formatPercentage(trade.profitLossPercent)})` : 
          `LOSS: ${formatSOL(trade.profitLossSOL)} (${formatPercentage(trade.profitLossPercent)})`;
        
        console.log(`${i+1}. ${trade.token} | ${trade.action.toUpperCase()} | ${profitLoss}`);
      } else {
        console.log(`${i+1}. ${trade.token} | ${trade.action.toUpperCase()} | Status: ${trade.status}`);
      }
    });
  } else {
    console.log('No trade history found.');
  }
  
  // Monitor flash loan opportunities
  const flashOpportunities = monitorFlashLoanOpportunities();
  console.log('\n💸 FLASH LOAN OPPORTUNITIES:');
  if (flashOpportunities.length > 0) {
    flashOpportunities.forEach((opportunity, i) => {
      console.log(`${i+1}. ${opportunity.pair} | ${opportunity.exchange1}: $${opportunity.price1} | ${opportunity.exchange2}: $${opportunity.price2} | Spread: ${formatPercentage(opportunity.spread)}`);
    });
  } else {
    console.log('No flash loan opportunities found.');
  }
  
  // Monitor meme token launches
  const memeTokenLaunches = monitorMemeTokenLaunches();
  console.log('\n🚀 RECENT MEME TOKEN LAUNCHES:');
  if (memeTokenLaunches.length > 0) {
    memeTokenLaunches.forEach((launch, i) => {
      console.log(`${i+1}. ${launch.token} (${launch.name}) | Price: $${launch.currentPrice.toFixed(8)} | ${formatPercentage(launch.priceChange)} | LP: ${launch.lpSize}`);
    });
  } else {
    console.log('No recent meme token launches found.');
  }
  
  console.log('\n===============================================================');
  console.log('DASHBOARD GENERATED: ' + new Date().toISOString());
  console.log('Run this script anytime to get updated monitoring information');
  console.log('===============================================================');
}

// Execute the dashboard creation
createTradingMonitorDashboard().catch(error => {
  console.error('Error creating trading monitor dashboard:', error);
});