/**
 * Force Transaction Execution Script
 * 
 * This script forces the execution of a transaction on the blockchain
 * to verify real fund trading is working.
 */

import { nexusEngine } from './server/nexus-transaction-engine';

// Main wallet address
const MAIN_WALLET_ADDRESS = "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb";

// Force a real transaction
async function forceTransaction() {
  console.log('Forcing real blockchain transaction execution...');
  
  try {
    // Make sure wallet is registered
    if (!nexusEngine) {
      throw new Error('Nexus engine not initialized');
    }
    
    nexusEngine.registerWallet(MAIN_WALLET_ADDRESS);
    console.log(`✅ Wallet ${MAIN_WALLET_ADDRESS} registered with Nexus engine`);
    
    // Force a real USDC->SOL swap
    const result = await nexusEngine.executeSwap({
      sourceToken: 'USDC',
      targetToken: 'SOL',
      amount: 10, // 10 USDC
      slippageBps: 100, // 1%
      walletAddress: MAIN_WALLET_ADDRESS,
      priority: 'HIGH',
      forceReal: true,
      skipSimulation: true,
      updateBalance: true,
      maxRetries: 5
    });
    
    if (result && result.signature) {
      console.log(`✅ Successfully executed REAL blockchain transaction: ${result.signature}`);
      console.log(`Transaction details: ${JSON.stringify(result)}`);
    } else {
      console.error('❌ Transaction failed:', result);
    }
  } catch (error) {
    console.error('❌ Error forcing transaction:', error instanceof Error ? error.message : String(error));
  }
}

// Execute force transaction
forceTransaction();
