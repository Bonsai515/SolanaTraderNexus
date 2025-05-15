#!/usr/bin/env node
/**
 * Execute Market Trade
 * 
 * This script executes a market trade using the Nexus Professional Engine.
 * It allows trading specified tokens on Solana DEXes.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface defining the trade options
 */
interface TradeOptions {
  fromToken: string;
  toToken: string;
  amount: number;
  slippageBps: number;
  dex?: string;
  walletPath?: string;
}

/**
 * Interface for transaction result
 */
interface TransactionResult {
  success: boolean;
  signature?: string;
  fromToken?: string;
  toToken?: string;
  fromAmount?: number;
  toAmount?: number;
  price?: number;
  error?: string;
  executionTime?: number;
  txId?: string;
}

/**
 * Execute a market trade with the provided options
 * @param options Trade options
 */
async function executeMarketTrade(options: TradeOptions): Promise<void> {
  console.log('🚀 Executing market trade with options:');
  console.log(`   From: ${options.fromToken}`);
  console.log(`   To: ${options.toToken}`);
  console.log(`   Amount: ${options.amount}`);
  console.log(`   Slippage: ${options.slippageBps} bps (${options.slippageBps / 100}%)`);
  console.log(`   DEX: ${options.dex || 'Jupiter (default)'}`);
  
  try {
    // Import the transaction engine with proper typing
    const { nexusEngine } = await import('./server/nexus-transaction-engine');
    
    if (!nexusEngine) {
      throw new Error('Failed to import Nexus Transaction Engine');
    }
    
    // Define the wallet address (using system wallet by default)
    const walletAddress = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
    
    // Execute the swap
    console.log(`⏳ Executing swap: ${options.amount} ${options.fromToken} → ${options.toToken}...`);
    
    const result = await nexusEngine.executeSwap({
      fromToken: options.fromToken,
      toToken: options.toToken,
      amount: options.amount,
      slippageBps: options.slippageBps,
      dex: options.dex,
      walletAddress,
      simulation: true // Set to false to execute real transaction
    });
    
    if (result.success) {
      console.log('✅ Swap executed successfully!');
      console.log(`   Transaction signature: ${result.signature}`);
      console.log(`   Input: ${result.fromAmount} ${result.fromToken}`);
      console.log(`   Output: ${result.actualToAmount || result.estimatedToAmount} ${result.toToken}`);
      console.log(`   Execution time: ${result.executionTimeMs}ms`);
      
      if (result.profit) {
        console.log(`   Profit: ${result.profit.toFixed(4)} (${result.profitPercentage?.toFixed(2)}%)`);
      }
    } else {
      console.error('❌ Swap failed:', result.error);
    }
  } catch (error: any) {
    console.error('❌ Error executing market trade:', error.message);
  }
}

/**
 * Check available trades and supported tokens
 */
async function checkAvailableTrades(): Promise<void> {
  try {
    // Import the transaction engine
    const { nexusEngine } = await import('./server/nexus-transaction-engine');
    
    if (!nexusEngine) {
      throw new Error('Failed to import Nexus Transaction Engine');
    }
    
    // Get available DEXes
    const dexes = nexusEngine.getAvailableDEXes();
    
    console.log('🔍 Available DEXes:');
    dexes.forEach(dex => {
      console.log(`   - ${dex.name} (${dex.id}) - ${dex.enabled ? 'Enabled' : 'Disabled'}`);
    });
    
    // Note: In a full implementation, we would fetch supported tokens here
    console.log('\n💱 Common Solana Tokens:');
    console.log('   - SOL (Native Solana)');
    console.log('   - USDC (USD Coin)');
    console.log('   - USDT (Tether)');
    console.log('   - JUP (Jupiter)');
    console.log('   - BONK (Bonk)');
    console.log('   - MEME (Memecoin)');
    console.log('   - WIF (Dogwifhat)');
    console.log('   - GUAC (Guacamole)');
  } catch (error: any) {
    console.error('❌ Error checking available trades:', error.message);
  }
}

/**
 * Main function to process command line arguments
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help') {
    console.log('Usage: node execute-market-trade.ts [command] [options]');
    console.log('');
    console.log('Commands:');
    console.log('  check            - Check available tokens and DEXes');
    console.log('  execute          - Execute a market trade');
    console.log('  help             - Show this help message');
    console.log('');
    console.log('Options for execute:');
    console.log('  --from=TOKEN     - Token to sell (required)');
    console.log('  --to=TOKEN       - Token to buy (required)');
    console.log('  --amount=NUM     - Amount to trade (required)');
    console.log('  --slippage=NUM   - Slippage in basis points (optional, default 50 = 0.5%)');
    console.log('  --dex=NAME       - DEX to use (optional, default Jupiter)');
    console.log('');
    console.log('Example:');
    console.log('  npx ts-node execute-market-trade.ts execute --from=SOL --to=USDC --amount=0.1');
    return;
  }
  
  const command = args[0];
  
  if (command === 'check') {
    await checkAvailableTrades();
    return;
  }
  
  if (command === 'execute') {
    const options = parseTradeOptions(args.slice(1));
    await executeMarketTrade(options);
    return;
  }
  
  console.error('Unknown command:', command);
  console.log('Use "help" to see available commands');
}

/**
 * Parse command line arguments into trade options
 * @param args Command line arguments
 * @returns Parsed trade options
 */
function parseTradeOptions(args: string[]): TradeOptions {
  const options: Partial<TradeOptions> = {
    slippageBps: 50
  };
  
  args.forEach(arg => {
    if (arg.startsWith('--from=')) {
      options.fromToken = arg.substring('--from='.length);
    } else if (arg.startsWith('--to=')) {
      options.toToken = arg.substring('--to='.length);
    } else if (arg.startsWith('--amount=')) {
      options.amount = parseFloat(arg.substring('--amount='.length));
    } else if (arg.startsWith('--slippage=')) {
      options.slippageBps = parseInt(arg.substring('--slippage='.length));
    } else if (arg.startsWith('--dex=')) {
      options.dex = arg.substring('--dex='.length);
    }
  });
  
  // Validate required options
  if (!options.fromToken) {
    throw new Error('Missing required option: --from=TOKEN');
  }
  if (!options.toToken) {
    throw new Error('Missing required option: --to=TOKEN');
  }
  if (!options.amount || isNaN(options.amount)) {
    throw new Error('Missing or invalid required option: --amount=NUM');
  }
  
  // Return the validated options with type assertion
  return options as TradeOptions;
}

// Run the main function
main().catch(error => {
  console.error('Error running market trade script:', error);
});

// Export functions for use in other modules
export {
  executeMarketTrade,
  checkAvailableTrades,
  TradeOptions,
  TransactionResult
};