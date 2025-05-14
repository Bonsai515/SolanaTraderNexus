/**
 * Execute Market Trade
 * 
 * This script executes a market trade using the Nexus Professional Engine.
 * It allows trading specified tokens on Solana DEXes.
 */

import * as nexusTransactionEngine from './server/nexus-transaction-engine';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface TradeOptions {
  fromToken: string;
  toToken: string;
  amount: number;
  slippageBps: number;
  dex?: string;
  walletPath?: string;
}

// Default system wallet is configured in the Nexus engine

async function executeMarketTrade(options: TradeOptions) {
  console.log('=============================================');
  console.log('EXECUTING MARKET TRADE');
  console.log('=============================================');
  
  // Validate parameters
  if (!options.fromToken || !options.toToken || !options.amount) {
    console.error('Invalid trade parameters. Required: fromToken, toToken, amount');
    return;
  }
  
  if (options.amount <= 0) {
    console.error('Amount must be greater than 0');
    return;
  }
  
  const slippageBps = options.slippageBps || 50; // Default 0.5% slippage
  const dex = options.dex || 'Jupiter'; // Default to Jupiter
  
  console.log(`Trade parameters:`);
  console.log(`- From: ${options.fromToken}`);
  console.log(`- To: ${options.toToken}`);
  console.log(`- Amount: ${options.amount}`);
  console.log(`- Slippage: ${slippageBps / 100}%`);
  console.log(`- DEX: ${dex}`);
  
  try {
    // Initialize Nexus Professional Engine if not already initialized
    if (!nexusTransactionEngine.isInitialized()) {
      console.log('Initializing Nexus Professional Engine...');
      await nexusTransactionEngine.initializeTransactionEngine(
        process.env.ALCHEMY_RPC_URL || process.env.INSTANT_NODES_RPC_URL || 'https://api.mainnet-beta.solana.com',
        true // Use real funds
      );
    }
    
    // Execute the trade
    console.log('Executing market trade...');
    const result = await nexusTransactionEngine.executeMarketTrade({
      fromToken: options.fromToken,
      toToken: options.toToken,
      amount: options.amount,
      slippageBps,
      dex,
      walletPath: options.walletPath || './wallet.json'
    });
    
    if (result && result.success) {
      console.log('✅ Trade executed successfully!');
      console.log(`Transaction signature: ${result.signature || 'N/A'}`);
      console.log(`Received: ${result.amount || 'N/A'} ${options.toToken}`);
      return result;
    } else {
      console.error(`❌ Trade failed: ${result?.error || 'Unknown error'}`);
      return null;
    }
  } catch (error: any) {
    console.error('Error executing market trade:', error.message);
    return null;
  } finally {
    console.log('\n=============================================');
    console.log('MARKET TRADE OPERATION COMPLETE');
    console.log('=============================================');
  }
}

// Check available trading pairs
async function checkAvailableTrades() {
  console.log('\nRecommended markets:');
  console.log('- SOL/USDC (SOL to USDC)');
  console.log('- USDC/SOL (USDC to SOL)');
  console.log('- BONK/USDC (BONK to USDC)');
  console.log('- USDC/BONK (USDC to BONK)');
  console.log('- wSOL/USDC (Wrapped SOL to USDC)');
  console.log('- USDC/wSOL (USDC to Wrapped SOL)');
  console.log('- SAMO/USDC (SAMO to USDC)');
  console.log('- USDC/SAMO (USDC to SAMO)');
  
  // Show current token addresses for convenience
  console.log('\nToken addresses:');
  console.log('- SOL: So11111111111111111111111111111111111111112 (native)');
  console.log('- USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  console.log('- BONK: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
  console.log('- SAMO: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
}

// Parse command line arguments
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    console.log('Usage:');
    console.log('  npx ts-node execute-market-trade.ts check         - Check available tokens for trading');
    console.log('  npx ts-node execute-market-trade.ts execute <options>  - Execute a market trade');
    console.log('');
    console.log('Trade options:');
    console.log('  --from=TOKEN    - From token (symbol or mint address)');
    console.log('  --to=TOKEN      - To token (symbol or mint address)');
    console.log('  --amount=NUM    - Amount to trade');
    console.log('  --slippage=NUM  - Slippage in basis points (optional, default 50 = 0.5%)');
    console.log('  --dex=NAME      - DEX to use (optional, default Jupiter)');
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

function parseTradeOptions(args: string[]): TradeOptions {
  const options: any = {
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
  
  return options as TradeOptions;
}

// Run the main function
main().catch(error => {
  console.error('Error running market trade script:', error);
});