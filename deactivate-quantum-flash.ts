/**
 * Deactivate Quantum Flash Loan Strategy
 * 
 * This script removes the Quantum Flash Loan strategy from the active
 * configuration while keeping other strategies intact.
 */

import * as fs from 'fs';

// Configuration Constants
const TRADING_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Deactivate the Quantum Flash Loan strategy
function deactivateQuantumFlash(): boolean {
  try {
    // Check if the configuration file exists
    if (fs.existsSync('./config/quantum-flash-wallet1-config.json')) {
      // Read the configuration
      const configData = fs.readFileSync('./config/quantum-flash-wallet1-config.json', 'utf-8');
      const config = JSON.parse(configData);
      
      // Set active to false
      config.active = false;
      config.lastUpdated = new Date().toISOString();
      
      // Write the updated configuration
      fs.writeFileSync(
        './config/quantum-flash-wallet1-config.json',
        JSON.stringify(config, null, 2)
      );
      
      console.log('Quantum Flash Loan configuration deactivated successfully');
    } else {
      console.log('Quantum Flash Loan configuration not found');
    }
    
    return true;
  } catch (error) {
    console.error('Error deactivating Quantum Flash Loan configuration:', error);
    return false;
  }
}

// Update system memory to remove Quantum Flash Loan
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
    if (systemMemory.features && systemMemory.features.quantumFlashLoan) {
      systemMemory.features.quantumFlashLoan = false;
    }
    
    // Update wallet strategies
    if (systemMemory.wallets && systemMemory.wallets.tradingWallet1 && 
        systemMemory.wallets.tradingWallet1.strategies) {
      // Remove QuantumFlashLoan from strategies array
      systemMemory.wallets.tradingWallet1.strategies = 
        systemMemory.wallets.tradingWallet1.strategies.filter(
          (strategy: string) => strategy !== 'QuantumFlashLoan'
        );
    }
    
    // Update strategies
    if (systemMemory.strategies && systemMemory.strategies.QuantumFlashLoan) {
      systemMemory.strategies.QuantumFlashLoan.active = false;
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

// Deactivate the Quantum Flash agent
function deactivateQuantumFlashAgent(): boolean {
  try {
    // Check if the agent file exists
    if (fs.existsSync('./data/agents/quantum-flash-agent.json')) {
      // Read the agent configuration
      const agentData = fs.readFileSync('./data/agents/quantum-flash-agent.json', 'utf-8');
      const agent = JSON.parse(agentData);
      
      // Set active to false
      agent.active = false;
      agent.lastUpdated = new Date().toISOString();
      
      // Write the updated agent configuration
      fs.writeFileSync(
        './data/agents/quantum-flash-agent.json',
        JSON.stringify(agent, null, 2)
      );
      
      console.log('Quantum Flash agent deactivated successfully');
    } else {
      console.log('Quantum Flash agent not found');
    }
    
    return true;
  } catch (error) {
    console.error('Error deactivating Quantum Flash agent:', error);
    return false;
  }
}

// Main function to deactivate the Quantum Flash Loan strategy
async function deactivateQuantumFlashStrategy(): Promise<void> {
  console.log('\n========================================');
  console.log('🚫 DEACTIVATING QUANTUM FLASH LOAN STRATEGY');
  console.log('========================================');
  
  // Deactivate the configuration
  const configDeactivated = deactivateQuantumFlash();
  if (!configDeactivated) {
    console.error('Failed to deactivate Quantum Flash Loan configuration');
  }
  
  // Update system memory
  const systemMemoryUpdated = updateSystemMemory();
  if (!systemMemoryUpdated) {
    console.error('Failed to update system memory');
  }
  
  // Deactivate the agent
  const agentDeactivated = deactivateQuantumFlashAgent();
  if (!agentDeactivated) {
    console.error('Failed to deactivate Quantum Flash agent');
  }
  
  console.log('\n========================================');
  console.log('✅ QUANTUM FLASH LOAN STRATEGY DEACTIVATED');
  console.log('========================================');
  console.log('The Quantum Flash Loan strategy has been removed from your active strategies.');
  console.log('Your active strategies now are:');
  console.log('1. Quantum Omega Meme Sniper');
  console.log('2. Zero Capital Flash Loan');
  console.log('3. Hyperion Flash Loan with Neural Transformers');
  console.log('========================================');
}

// Execute the deactivation
deactivateQuantumFlashStrategy().catch(error => {
  console.error('Error deactivating Quantum Flash Loan strategy:', error);
});