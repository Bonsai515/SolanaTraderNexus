/**
 * Check Quantum Omega Meme Sniper Status
 * 
 * This script checks the status of the Quantum Omega meme token sniping strategy
 * and displays the current configuration.
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

// Check if Quantum Omega configuration exists
function checkConfiguration(): any {
  try {
    if (!fs.existsSync('./config/quantum-omega-wallet1-config.json')) {
      console.log('Quantum Omega configuration not found.');
      return null;
    }
    
    const configData = fs.readFileSync('./config/quantum-omega-wallet1-config.json', 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error reading configuration:', error);
    return null;
  }
}

// Check if agent configuration exists
function checkAgentConfiguration(): any {
  try {
    if (!fs.existsSync('./data/agents/quantum-omega-agent.json')) {
      console.log('Quantum Omega agent configuration not found.');
      return null;
    }
    
    const agentData = fs.readFileSync('./data/agents/quantum-omega-agent.json', 'utf-8');
    return JSON.parse(agentData);
  } catch (error) {
    console.error('Error reading agent configuration:', error);
    return null;
  }
}

// Check system memory for Quantum Omega integration
function checkSystemMemory(): any {
  try {
    if (!fs.existsSync('./data/system-memory.json')) {
      console.log('System memory not found.');
      return null;
    }
    
    const memoryData = fs.readFileSync('./data/system-memory.json', 'utf-8');
    return JSON.parse(memoryData);
  } catch (error) {
    console.error('Error reading system memory:', error);
    return null;
  }
}

// Main function to check the Quantum Omega status
async function checkQuantumOmegaStatus(): Promise<void> {
  console.log('\n========================================');
  console.log('🔍 CHECKING QUANTUM OMEGA MEME SNIPER STATUS');
  console.log('========================================');
  
  // Check the wallet balance
  const balance = await checkWalletBalance();
  console.log(`Wallet Address: ${TRADING_WALLET_ADDRESS}`);
  console.log(`Wallet Balance: ${balance.toFixed(6)} SOL`);
  
  // Check configuration
  const config = checkConfiguration();
  if (config) {
    console.log('\n📋 CONFIGURATION STATUS: ✅ Found');
    console.log(`Strategy Version: ${config.version}`);
    console.log(`Active: ${config.active ? 'Yes' : 'No'}`);
    console.log(`Last Updated: ${config.lastUpdated}`);
    
    console.log('\n📊 STRATEGY PARAMETERS:');
    console.log(`- Max Position Size: ${config.params.maxPositionSizePercent * 100}% (${(balance * config.params.maxPositionSizePercent).toFixed(6)} SOL)`);
    console.log(`- Take Profit: ${config.params.takeProfit * 100}%`);
    console.log(`- Stop Loss: ${config.params.stopLoss * 100}%`);
    console.log(`- Max Positions: ${config.params.maxActivePositions}`);
    console.log(`- Min Liquidity: ${config.params.minLiquiditySOL} SOL`);
    
    // Check DEX configurations
    console.log('\n🔄 DEX CONFIGURATIONS:');
    for (const dex of config.dexConfig) {
      if (dex.enabled) {
        console.log(`- ${dex.name} (Priority: ${dex.priorityLevel})`);
      }
    }
  } else {
    console.log('\n📋 CONFIGURATION STATUS: ❌ Not Found');
  }
  
  // Check agent configuration
  const agentConfig = checkAgentConfiguration();
  if (agentConfig) {
    console.log('\n🤖 AGENT STATUS: ✅ Configured');
    console.log(`Agent Name: ${agentConfig.name}`);
    console.log(`Type: ${agentConfig.type}`);
    console.log(`Active: ${agentConfig.active ? 'Yes' : 'No'}`);
  } else {
    console.log('\n🤖 AGENT STATUS: ❌ Not Configured');
  }
  
  // Check system memory
  const systemMemory = checkSystemMemory();
  if (systemMemory && systemMemory.features && systemMemory.features.quantumOmegaMemeSniper) {
    console.log('\n💾 SYSTEM MEMORY: ✅ Integrated');
    
    // Check if strategy is in the system memory
    if (systemMemory.strategies && systemMemory.strategies.QuantumOmegaMemeSniper) {
      const strategy = systemMemory.strategies.QuantumOmegaMemeSniper;
      console.log(`Strategy Active: ${strategy.active ? 'Yes' : 'No'}`);
      console.log(`Linked Wallets: ${strategy.wallets.join(', ')}`);
    }
  } else {
    console.log('\n💾 SYSTEM MEMORY: ❌ Not Integrated');
  }
  
  console.log('\n========================================');
  console.log('📱 READY TO TRADE STATUS');
  console.log('========================================');
  
  if (config && agentConfig && systemMemory?.features?.quantumOmegaMemeSniper) {
    console.log('✅ Quantum Omega Meme Sniper is ACTIVE and ready to trade');
    
    // Calculate available trading capital
    const minSOLRequired = 0.002125; // Minimum SOL required for operation
    const availableCapital = Math.max(0, balance - minSOLRequired);
    const maxPositionSize = availableCapital * config.params.maxPositionSizePercent;
    
    console.log(`Available Capital: ${availableCapital.toFixed(6)} SOL`);
    console.log(`Max Position Size: ${maxPositionSize.toFixed(6)} SOL`);
    console.log(`Potential Positions: ${Math.floor(availableCapital / maxPositionSize)}`);
  } else {
    console.log('❌ Quantum Omega Meme Sniper is NOT fully configured');
    console.log('Run the activation script to properly configure the strategy.');
  }
  
  console.log('========================================');
}

// Execute the check
checkQuantumOmegaStatus().catch(error => {
  console.error('Error checking Quantum Omega status:', error);
});