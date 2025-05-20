/**
 * Check Wallet Access
 * 
 * This script verifies access to trading wallets and checks
 * current trading performance.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

// RPC URL
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

// Wallet addresses to check
const WALLETS = [
  {
    name: 'Main Trading Wallet',
    address: 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK'
  },
  {
    name: 'HX Wallet',
    address: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb'
  },
  {
    name: 'Prophet Wallet',
    address: '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e'
  }
];

// Check wallet balance
async function checkWalletBalance(name: string, address: string): Promise<number> {
  console.log(`Checking ${name} (${address})...`);
  
  try {
    const connection = new Connection(RPC_URL);
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`  Balance: ${solBalance.toFixed(6)} SOL`);
    return solBalance;
  } catch (error) {
    console.error(`  Error checking balance: ${error}`);
    return 0;
  }
}

// Get transaction counts
async function getRecentTransactionCount(address: string): Promise<number> {
  try {
    const connection = new Connection(RPC_URL);
    const publicKey = new PublicKey(address);
    
    // Get signatures for last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const signatures = await connection.getSignaturesForAddress(publicKey, {
      limit: 100
    });
    
    return signatures.length;
  } catch (error) {
    console.error(`  Error checking transactions: ${error}`);
    return 0;
  }
}

// Load trading performance
function loadTradingPerformance(): any {
  try {
    // Check multiple possible locations for trading stats
    const possibleFiles = [
      'stats/trading-stats.json',
      'stats/profit-stats.json',
      'stats/performance-stats.json',
      'stats/hyperion-cascade-flash-stats.json',
      'stats/quantum-flash-stats.json',
      'stats/ultimate-nuclear-stats.json'
    ];
    
    for (const file of possibleFiles) {
      if (fs.existsSync(file)) {
        const stats = JSON.parse(fs.readFileSync(file, 'utf-8'));
        return stats;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error loading trading performance: ${error}`);
    return null;
  }
}

// Main function
async function main() {
  console.log('\n=== CHECKING WALLET ACCESS AND TRADING STATUS ===');
  
  // Check wallet balances
  console.log('\nWallet Balances:');
  let totalBalance = 0;
  
  for (const wallet of WALLETS) {
    const balance = await checkWalletBalance(wallet.name, wallet.address);
    totalBalance += balance;
    
    // Check recent transactions
    const txCount = await getRecentTransactionCount(wallet.address);
    console.log(`  Recent transactions: ${txCount}`);
  }
  
  console.log(`\nTotal balance across all wallets: ${totalBalance.toFixed(6)} SOL`);
  
  // Load trading performance
  console.log('\nTrading Performance:');
  const performance = loadTradingPerformance();
  
  if (performance) {
    if (performance.totalTrades !== undefined) {
      console.log(`  Total trades: ${performance.totalTrades}`);
    }
    
    if (performance.successfulTrades !== undefined) {
      console.log(`  Successful trades: ${performance.successfulTrades}`);
    }
    
    if (performance.failedTrades !== undefined) {
      console.log(`  Failed trades: ${performance.failedTrades}`);
    }
    
    if (performance.totalProfit !== undefined) {
      console.log(`  Total profit: ${performance.totalProfit.toFixed(6)} SOL`);
    }
    
    if (performance.lastTradeTime !== undefined) {
      const lastTradeDate = new Date(performance.lastTradeTime);
      console.log(`  Last trade: ${lastTradeDate.toLocaleString()}`);
    }
  } else {
    console.log('  No trading performance data found');
  }
  
  // Check currently active strategies
  console.log('\nActive Trading Strategies:');
  
  try {
    const strategyFiles = [
      'ultimate-nuclear-strategy.ts',
      'quantum-flash-strategy.ts',
      'zero-capital-flash-strategy.ts',
      'mev-protection-flash-strategy.ts',
      'quantum-multi-flash-strategy.ts',
      'temporal-block-arbitrage-strategy.ts',
      'hyperion-cascade-flash-strategy.ts'
    ];
    
    // Use ps to check for running strategies
    const { exec } = require('child_process');
    
    exec('ps aux | grep -E "strategy.ts" | grep -v grep', (error: any, stdout: string, stderr: string) => {
      if (error) {
        console.log('  No strategies currently running');
        return;
      }
      
      const lines = stdout.split('\n').filter(Boolean);
      console.log(`  ${lines.length} strategies currently running`);
      
      for (const line of lines) {
        // Extract strategy name
        for (const strategyFile of strategyFiles) {
          if (line.includes(strategyFile)) {
            console.log(`  - ${strategyFile.replace('.ts', '')}`);
            break;
          }
        }
      }
    });
  } catch (error) {
    console.error(`Error checking active strategies: ${error}`);
  }
  
  console.log('\n=== WALLET CHECK COMPLETE ===');
}

// Run the main function
main()
  .catch(console.error);