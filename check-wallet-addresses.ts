/**
 * Display System Wallet Addresses
 * 
 * This script displays all wallet addresses used by the system for trading and profit collection.
 */

import fs from 'fs';
import path from 'path';

// Define wallet interface
interface WalletInfo {
  address: string;
  type: string;
  description: string;
  allocationPercentage: number;
}

// Define agent wallet interface
interface AgentWalletConfig {
  agent: string;
  wallets: WalletInfo[];
}

// Main wallet information
const MAIN_TRADING_WALLET: WalletInfo = {
  address: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
  type: 'Primary Trading Wallet',
  description: 'Used for all primary trading operations',
  allocationPercentage: 100
};

// Prophet wallet for profit collection
const PROPHET_WALLET: WalletInfo = {
  address: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
  type: 'Prophet Wallet',
  description: 'Used to collect 5% of all profits',
  allocationPercentage: 5
};

// Agent-specific wallets (these would be read from configuration in a real implementation)
const AGENT_WALLETS: AgentWalletConfig[] = [
  {
    agent: 'Hyperion Flash Arbitrage Overlord',
    wallets: [
      {
        address: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
        type: 'Trading Wallet',
        description: 'Primary wallet for flash arbitrage operations',
        allocationPercentage: 100
      }
    ]
  },
  {
    agent: 'Quantum Omega Sniper',
    wallets: [
      {
        address: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
        type: 'Trading Wallet',
        description: 'Primary wallet for meme token sniping operations',
        allocationPercentage: 100
      }
    ]
  },
  {
    agent: 'Singularity Cross-Chain Oracle',
    wallets: [
      {
        address: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
        type: 'Trading Wallet',
        description: 'Primary wallet for cross-chain operations',
        allocationPercentage: 100
      }
    ]
  }
];

// Display wallet information
function displayWalletInfo(): void {
  console.log('======================================================');
  console.log('📊 System Wallet Addresses');
  console.log('======================================================\n');
  
  console.log('🔑 Primary System Wallets:');
  console.log(`- Main Trading Wallet: ${MAIN_TRADING_WALLET.address}`);
  console.log(`  Type: ${MAIN_TRADING_WALLET.type}`);
  console.log(`  Description: ${MAIN_TRADING_WALLET.description}`);
  console.log(`  Allocation: ${MAIN_TRADING_WALLET.allocationPercentage}%`);
  console.log('');
  
  console.log(`- Prophet Wallet: ${PROPHET_WALLET.address}`);
  console.log(`  Type: ${PROPHET_WALLET.type}`);
  console.log(`  Description: ${PROPHET_WALLET.description}`);
  console.log(`  Profit Allocation: ${PROPHET_WALLET.allocationPercentage}%`);
  console.log('');
  
  console.log('🤖 Agent-Specific Wallets:');
  AGENT_WALLETS.forEach(agent => {
    console.log(`- ${agent.agent}:`);
    
    agent.wallets.forEach(wallet => {
      console.log(`  • ${wallet.type}: ${wallet.address}`);
      console.log(`    Description: ${wallet.description}`);
      console.log(`    Allocation: ${wallet.allocationPercentage}%`);
    });
    
    console.log('');
  });
  
  console.log('======================================================');
  console.log('⚠️ FUNDING INSTRUCTIONS:');
  console.log('======================================================');
  console.log(`1. Fund the main trading wallet with USDC, SOL, or other tokens:`);
  console.log(`   ${MAIN_TRADING_WALLET.address}`);
  console.log('');
  console.log(`2. The system will automatically allocate funds to all strategies`);
  console.log(`   based on the configuration.`);
  console.log('');
  console.log(`3. 95% of profits will be automatically reinvested, while 5%`);
  console.log(`   will be sent to the Prophet wallet.`);
  console.log('======================================================');
}

// Run the display function
displayWalletInfo();