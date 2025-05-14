/**
 * Simple Market Trade Executor for Solana
 * 
 * This script provides a direct way to execute market trades through the
 * Nexus Professional Engine without external dependencies on Jupiter API.
 */

import * as nexusTransactionEngine from './server/nexus-transaction-engine';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the transaction engine
async function initializeEngine() {
  console.log('Initializing Nexus Professional Engine...');
  
  try {
    if (!nexusTransactionEngine.isInitialized()) {
      await nexusTransactionEngine.initializeTransactionEngine(
        process.env.ALCHEMY_RPC_URL || process.env.INSTANT_NODES_RPC_URL || 'https://api.mainnet-beta.solana.com',
        true // Use real funds
      );
      console.log('Nexus Professional Engine initialized successfully.');
      return true;
    } else {
      console.log('Nexus Professional Engine already initialized.');
      return true;
    }
  } catch (error: any) {
    console.error('Failed to initialize Nexus Professional Engine:', error.message);
    return false;
  }
}

// Execute a market trade using the transaction engine
async function executeMarketTrade(
  fromToken: string,
  toToken: string,
  amount: number,
  slippageBps: number = 100
) {
  console.log(`\nExecuting trade: ${amount} ${fromToken} → ${toToken} (${slippageBps/100}% slippage)`);
  
  try {
    const result = await nexusTransactionEngine.executeMarketTrade({
      fromToken,
      toToken,
      amount,
      slippageBps,
      dex: 'jupiter', // Default to Jupiter
      walletPath: process.env.WALLET_PATH || './wallet.json'
    });
    
    if (result && result.success) {
      console.log('\n✅ Trade executed successfully!');
      console.log(`Transaction signature: ${result.signature || 'N/A'}`);
      console.log(`Executed amount: ${amount} ${fromToken}`);
      console.log(`Received: approx. ${result.amount || 'unknown'} ${toToken}`);
      return true;
    } else {
      console.error(`\n❌ Trade failed: ${result?.error || 'Unknown error'}`);
      return false;
    }
  } catch (error: any) {
    console.error('\n❌ Error executing trade:', error.message);
    return false;
  }
}

// Main function
async function main() {
  console.log('===== Solana Market Trade =====');
  
  // Initialize the engine
  const initialized = await initializeEngine();
  if (!initialized) {
    console.error('Failed to initialize. Exiting...');
    process.exit(1);
  }
  
  // Specify trade parameters - modify these for your specific trade
  const fromToken = 'SOL';
  const toToken = 'USDC';
  const amount = 0.01; // Very small amount for testing
  const slippageBps = 200; // 2% slippage allowed
  
  console.log('\nTrade Parameters:');
  console.log(`  From Token: ${fromToken}`);
  console.log(`  To Token: ${toToken}`);
  console.log(`  Amount: ${amount}`);
  console.log(`  Slippage: ${slippageBps/100}%`);
  
  // Execute the trade
  await executeMarketTrade(fromToken, toToken, amount, slippageBps);
  
  console.log('\n===== Operation Complete =====');
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});