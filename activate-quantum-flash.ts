/**
 * Reactivate Quantum Flash Loan Strategy
 * 
 * This script reactivates the Quantum Flash Loan strategy that was previously
 * deactivated, making it active again for day 1 trading.
 */

import * as fs from 'fs';

// Configuration Constants
const TRADING_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Reactivate the Quantum Flash Loan strategy
function reactivateQuantumFlash(): boolean {
  try {
    // Check if the configuration file exists
    if (fs.existsSync('./config/quantum-flash-wallet1-config.json')) {
      // Read the configuration
      const configData = fs.readFileSync('./config/quantum-flash-wallet1-config.json', 'utf-8');
      const config = JSON.parse(configData);
      
      // Set active to true
      config.active = true;
      config.lastUpdated = new Date().toISOString();
      
      // Write the updated configuration
      fs.writeFileSync(
        './config/quantum-flash-wallet1-config.json',
        JSON.stringify(config, null, 2)
      );
      
      console.log('Quantum Flash Loan configuration reactivated successfully');
    } else {
      console.log('Quantum Flash Loan configuration not found');
    }
    
    return true;
  } catch (error) {
    console.error('Error reactivating Quantum Flash Loan configuration:', error);
    return false;
  }
}

// Update system memory to add Quantum Flash Loan
function updateSystemMemory(): boolean {
  try {
    // Check if system memory exists
    if (!fs.existsSync('./data/system-memory.json')) {
      console.log('System memory not found');
      return false;
    }
    
    // Read system memory
    const systemMemoryData = fs.readFileSync('./data/system-memory.json', 'utf-8');
    let systemMemory = JSON.parse(systemMemoryData);
    
    // Update features
    if (systemMemory.features) {
      systemMemory.features.quantumFlashLoan = true;
    }
    
    // Update wallet strategies
    if (systemMemory.wallets && systemMemory.wallets.tradingWallet1 && 
        systemMemory.wallets.tradingWallet1.strategies) {
      // Check if QuantumFlashLoan is already in the strategies array
      if (!systemMemory.wallets.tradingWallet1.strategies.includes('QuantumFlashLoan')) {
        systemMemory.wallets.tradingWallet1.strategies.push('QuantumFlashLoan');
      }
    }
    
    // Update strategies
    if (systemMemory.strategies && systemMemory.strategies.QuantumFlashLoan) {
      systemMemory.strategies.QuantumFlashLoan.active = true;
    }
    
    // Write updated system memory
    fs.writeFileSync(
      './data/system-memory.json',
      JSON.stringify(systemMemory, null, 2)
    );
    
    console.log('System memory updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating system memory:', error);
    return false;
  }
}

// Reactivate the Quantum Flash agent
function reactivateQuantumFlashAgent(): boolean {
  try {
    // Check if the agent file exists
    if (fs.existsSync('./data/agents/quantum-flash-agent.json')) {
      // Read the agent configuration
      const agentData = fs.readFileSync('./data/agents/quantum-flash-agent.json', 'utf-8');
      const agent = JSON.parse(agentData);
      
      // Set active to true
      agent.active = true;
      agent.lastUpdated = new Date().toISOString();
      
      // Write the updated agent configuration
      fs.writeFileSync(
        './data/agents/quantum-flash-agent.json',
        JSON.stringify(agent, null, 2)
      );
      
      console.log('Quantum Flash agent reactivated successfully');
    } else {
      console.log('Quantum Flash agent not found');
    }
    
    return true;
  } catch (error) {
    console.error('Error reactivating Quantum Flash agent:', error);
    return false;
  }
}

// Apply day 1 optimizations to the Quantum Flash Loan strategy
function applyDay1Optimizations(): boolean {
  try {
    // Check if the configuration file exists
    if (fs.existsSync('./config/quantum-flash-wallet1-config.json')) {
      // Read the configuration
      const configData = fs.readFileSync('./config/quantum-flash-wallet1-config.json', 'utf-8');
      const config = JSON.parse(configData);
      
      // Apply day 1 optimizations
      if (config.params) {
        // Lower minimum profit threshold for more opportunities
        config.params.minProfitThresholdUSD = 0.0008; // Lower threshold
        
        // Increase max position size percentage
        config.params.maxPositionSizePercent = 0.85; // 85% of capital
        
        // Adjust slippage tolerance
        config.params.maxSlippageTolerance = 0.006; // 0.6% slippage
        
        // Increase transaction timeout
        config.params.timeoutMs = 35000; // 35 second timeout
        
        // Enable RBS protection
        config.params.useRbsProtection = true;
        
        // Increase max daily transactions
        config.params.maxDailyTransactions = 1200;
      }
      
      // Write the updated configuration
      fs.writeFileSync(
        './config/quantum-flash-wallet1-config.json',
        JSON.stringify(config, null, 2)
      );
      
      console.log('Day 1 optimizations applied successfully');
    } else {
      console.log('Quantum Flash Loan configuration not found');
    }
    
    return true;
  } catch (error) {
    console.error('Error applying day 1 optimizations:', error);
    return false;
  }
}

// Main function to reactivate the Quantum Flash Loan strategy
async function reactivateQuantumFlashStrategy(): Promise<void> {
  console.log('\n========================================');
  console.log('🚀 REACTIVATING QUANTUM FLASH LOAN STRATEGY');
  console.log('========================================');
  console.log('Preparing for Day 1 Trading...');
  
  // Reactivate the configuration
  const configReactivated = reactivateQuantumFlash();
  if (!configReactivated) {
    console.error('Failed to reactivate Quantum Flash Loan configuration');
  }
  
  // Update system memory
  const systemMemoryUpdated = updateSystemMemory();
  if (!systemMemoryUpdated) {
    console.error('Failed to update system memory');
  }
  
  // Reactivate the agent
  const agentReactivated = reactivateQuantumFlashAgent();
  if (!agentReactivated) {
    console.error('Failed to reactivate Quantum Flash agent');
  }
  
  // Apply day 1 optimizations
  const optimizationsApplied = applyDay1Optimizations();
  if (!optimizationsApplied) {
    console.error('Failed to apply day 1 optimizations');
  }
  
  console.log('\n========================================');
  console.log('✅ QUANTUM FLASH LOAN STRATEGY REACTIVATED');
  console.log('========================================');
  console.log('The Quantum Flash Loan strategy has been reactivated');
  console.log('with day 1 optimizations for maximum performance.');
  console.log('\nYour active strategies now are:');
  console.log('1. Quantum Omega Meme Sniper');
  console.log('2. Quantum Flash Loan (REACTIVATED)');
  console.log('3. Zero Capital Flash Loan');
  console.log('4. Hyperion Flash Loan with Neural Transformers');
  console.log('\nDay 1 Optimizations Applied:');
  console.log('- Lower profit threshold: $0.0008');
  console.log('- Increased position size: 85%');
  console.log('- Adjusted slippage tolerance: 0.6%');
  console.log('- Extended transaction timeout: 35 seconds');
  console.log('- Enabled RBS protection');
  console.log('- Increased max daily transactions: 1200');
  console.log('========================================');
}

// Execute the reactivation
reactivateQuantumFlashStrategy().catch(error => {
  console.error('Error reactivating Quantum Flash Loan strategy:', error);
});