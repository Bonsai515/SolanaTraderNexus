/**
 * Check Activated Trading Strategies
 * 
 * This script provides a comprehensive overview of all activated
 * trading strategies and their configurations.
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

// Check all strategy configurations
function getAllStrategies(): any[] {
  try {
    const strategies = [];
    
    // Check for Quantum Omega Meme Sniper
    if (fs.existsSync('./config/quantum-omega-wallet1-config.json')) {
      const configData = fs.readFileSync('./config/quantum-omega-wallet1-config.json', 'utf-8');
      const config = JSON.parse(configData);
      strategies.push({
        name: 'Quantum Omega Meme Sniper',
        type: 'meme-token-sniper',
        active: config.active,
        params: config.params,
        lastUpdated: config.lastUpdated
      });
    }
    
    // Check for Quantum Flash Loan
    if (fs.existsSync('./config/quantum-flash-wallet1-config.json')) {
      const configData = fs.readFileSync('./config/quantum-flash-wallet1-config.json', 'utf-8');
      const config = JSON.parse(configData);
      strategies.push({
        name: 'Quantum Flash Loan',
        type: 'flash-loan',
        active: config.active,
        params: config.params,
        lastUpdated: config.lastUpdated
      });
    }
    
    // Check for Zero Capital Flash Loan
    if (fs.existsSync('./config/zero-capital-flash-config.json')) {
      const configData = fs.readFileSync('./config/zero-capital-flash-config.json', 'utf-8');
      const config = JSON.parse(configData);
      strategies.push({
        name: 'Zero Capital Flash Loan',
        type: 'zero-capital-flash',
        active: config.active,
        params: config.params,
        lastUpdated: config.lastUpdated
      });
    }
    
    // Check for Hyperion Flash Loan
    if (fs.existsSync('./config/hyperion-flash-config.json')) {
      const configData = fs.readFileSync('./config/hyperion-flash-config.json', 'utf-8');
      const config = JSON.parse(configData);
      strategies.push({
        name: 'Hyperion Flash Loan',
        type: 'hyperion-flash',
        active: config.active,
        params: config.params,
        transformers: config.transformers?.map(t => t.name) || [],
        lastUpdated: config.lastUpdated
      });
    }
    
    return strategies;
  } catch (error) {
    console.error('Error checking strategies:', error);
    return [];
  }
}

// Check transformer models
function getTransformerModels(): any[] {
  try {
    const transformers = [];
    
    // Check if transformers directory exists
    if (fs.existsSync('./transformers')) {
      // Check for transformer config files
      const transformerFiles = fs.readdirSync('./transformers')
        .filter(file => file.endsWith('-config.json'));
      
      for (const file of transformerFiles) {
        // Skip integration config file
        if (file === 'integration-config.json') continue;
        
        const configData = fs.readFileSync(`./transformers/${file}`, 'utf-8');
        const config = JSON.parse(configData);
        
        transformers.push({
          name: config.name,
          type: config.type,
          enabled: config.enabled,
          lastUpdated: config.lastUpdated
        });
      }
    }
    
    return transformers;
  } catch (error) {
    console.error('Error checking transformer models:', error);
    return [];
  }
}

// Check for agents
function getAgents(): any[] {
  try {
    const agents = [];
    
    // Check if agents directory exists
    if (fs.existsSync('./data/agents')) {
      // Check for agent config files
      const agentFiles = fs.readdirSync('./data/agents')
        .filter(file => file.endsWith('.json'));
      
      for (const file of agentFiles) {
        const configData = fs.readFileSync(`./data/agents/${file}`, 'utf-8');
        const config = JSON.parse(configData);
        
        agents.push({
          id: config.id,
          name: config.name,
          type: config.type,
          active: config.active,
          lastUpdated: config.lastUpdated
        });
      }
    }
    
    return agents;
  } catch (error) {
    console.error('Error checking agents:', error);
    return [];
  }
}

// Check system memory
function checkSystemMemory(): any {
  try {
    if (!fs.existsSync('./data/system-memory.json')) {
      return null;
    }
    
    const memoryData = fs.readFileSync('./data/system-memory.json', 'utf-8');
    return JSON.parse(memoryData);
  } catch (error) {
    console.error('Error checking system memory:', error);
    return null;
  }
}

// Format timestamp
function formatTimestamp(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch (error) {
    return timestamp;
  }
}

// Main function to check activated strategies
async function checkActivatedStrategies(): Promise<void> {
  console.log('\n========================================================');
  console.log('🔍 ACTIVATED TRADING STRATEGIES CHECK');
  console.log('========================================================');
  
  // Check wallet balance
  const balance = await checkWalletBalance();
  console.log(`\n📊 WALLET STATUS:`);
  console.log(`Address: ${TRADING_WALLET_ADDRESS}`);
  console.log(`Balance: ${balance.toFixed(6)} SOL ($${(balance * 160).toFixed(2)})`);
  
  // Get all strategies
  const strategies = getAllStrategies();
  console.log('\n🚀 ACTIVATED STRATEGIES:');
  if (strategies.length > 0) {
    strategies.forEach((strategy, index) => {
      console.log(`\n${index + 1}. ${strategy.name} (${strategy.type}):`);
      console.log(`   Status: ${strategy.active ? '✅ ACTIVE' : '❌ INACTIVE'}`);
      console.log(`   Last Updated: ${formatTimestamp(strategy.lastUpdated)}`);
      
      // Print key parameters
      if (strategy.type === 'meme-token-sniper') {
        console.log(`   Max Position Size: ${strategy.params.maxPositionSizePercent * 100}%`);
        console.log(`   Take Profit: ${strategy.params.takeProfit * 100}%`);
        console.log(`   Stop Loss: ${strategy.params.stopLoss * 100}%`);
      } 
      else if (strategy.type === 'flash-loan' || strategy.type === 'zero-capital-flash') {
        console.log(`   Min Profit Threshold: $${strategy.params.minProfitThresholdUSD}`);
        console.log(`   Max Slippage: ${strategy.params.maxSlippageTolerance * 100}%`);
        console.log(`   Target Tokens: ${strategy.params.targetedTokens.slice(0, 3).join(', ')}...`);
      }
      else if (strategy.type === 'hyperion-flash') {
        console.log(`   Min Profit Threshold: $${strategy.params.minProfitThresholdUSD}`);
        console.log(`   Neural Optimization: ${strategy.params.neuralOptimization ? 'Enabled' : 'Disabled'}`);
        console.log(`   Transformer Layers: ${strategy.params.transformerLayers}`);
        console.log(`   Parallel Execution: ${strategy.params.parallelExecution ? 'Enabled' : 'Disabled'}`);
        
        // Show transformers if available
        if (strategy.transformers && strategy.transformers.length > 0) {
          console.log(`   Transformer Models: ${strategy.transformers.join(', ')}`);
        }
      }
    });
  } else {
    console.log('No strategies activated yet.');
  }
  
  // Check transformers
  const transformers = getTransformerModels();
  console.log('\n⚡ TRANSFORMER MODELS:');
  if (transformers.length > 0) {
    transformers.forEach((transformer, index) => {
      console.log(`${index + 1}. ${transformer.name} (${transformer.type}): ${transformer.enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    });
  } else {
    console.log('No transformer models found.');
  }
  
  // Check agents
  const agents = getAgents();
  console.log('\n🤖 AGENT STATUS:');
  if (agents.length > 0) {
    agents.forEach((agent, index) => {
      console.log(`${index + 1}. ${agent.name} (${agent.type}): ${agent.active ? '✅ ACTIVE' : '❌ INACTIVE'}`);
    });
  } else {
    console.log('No agents configured.');
  }
  
  // Check system memory features
  const systemMemory = checkSystemMemory();
  console.log('\n💾 SYSTEM MEMORY FEATURES:');
  if (systemMemory && systemMemory.features) {
    const features = systemMemory.features;
    Object.keys(features).forEach(feature => {
      console.log(`- ${feature}: ${features[feature] ? '✅ ENABLED' : '❌ DISABLED'}`);
    });
  } else {
    console.log('System memory not found or features not configured.');
  }
  
  // Print wallet strategies
  if (systemMemory && systemMemory.wallets && systemMemory.wallets.tradingWallet1) {
    const walletStrategies = systemMemory.wallets.tradingWallet1.strategies || [];
    console.log('\n👛 TRADING WALLET 1 STRATEGIES:');
    if (walletStrategies.length > 0) {
      walletStrategies.forEach((strategy: string, index: number) => {
        console.log(`${index + 1}. ${strategy}`);
      });
    } else {
      console.log('No strategies assigned to Trading Wallet 1.');
    }
  }
  
  console.log('\n========================================================');
  console.log('SUMMARY: ' + strategies.length + ' strategies, ' + 
              transformers.length + ' transformers, ' + 
              agents.length + ' agents activated');
  console.log('REPORT GENERATED: ' + new Date().toLocaleString());
  console.log('========================================================');
}

// Execute the check
checkActivatedStrategies().catch(error => {
  console.error('Error checking activated strategies:', error);
});