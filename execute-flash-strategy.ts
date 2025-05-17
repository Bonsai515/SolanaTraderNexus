/**
 * Execute Quantum Flash Strategy
 * 
 * This script executes the Quantum Flash Strategy with configurable parameters.
 * It can run either a single day's strategy or the full weekly strategy.
 */

import { getFlashStrategyIntegration } from './server/strategies/flash_strategy_integration';
import { rpcManager } from './server/lib/enhancedRpcManager';
import * as fs from 'fs';
import * as path from 'path';

// Default wallet path (override with command line args)
const DEFAULT_WALLET_PATH = path.join(process.cwd(), 'data', 'wallets.json');

/**
 * Get wallet for strategy execution
 */
function getWallet() {
  try {
    // Load wallet data from file
    const walletData = JSON.parse(fs.readFileSync(DEFAULT_WALLET_PATH, 'utf8'));
    
    // If the wallet data has a 'mainWallet' property, use it
    if (walletData.mainWallet) {
      console.log(`Using main wallet: ${walletData.mainWallet.publicKey}`);
      return walletData.mainWallet;
    }
    
    // Otherwise, use the first wallet in the wallets array
    if (walletData.wallets && walletData.wallets.length > 0) {
      console.log(`Using first wallet: ${walletData.wallets[0].publicKey}`);
      return walletData.wallets[0];
    }
    
    throw new Error('No wallet found in wallet data');
  } catch (error) {
    console.error('Error loading wallet:', error);
    throw error;
  }
}

/**
 * Initialize the strategy integration
 */
async function initializeStrategy() {
  // Make sure RPC manager is active
  console.log('Using RPC Manager for optimal connection')
  
  // Get wallet provider
  const walletProvider = () => getWallet();
  
  // Create strategy integration
  const flashStrategy = getFlashStrategyIntegration(walletProvider);
  
  // Initialize strategy
  const success = await flashStrategy.initialize();
  
  if (!success) {
    throw new Error('Failed to initialize strategy');
  }
  
  return flashStrategy;
}

/**
 * Execute daily strategy
 */
async function executeDailyStrategy(day: number = 1, amount: number = 1_000_000_000) {
  console.log(`Executing Day ${day} strategy with ${amount / 1_000_000_000} SOL`);
  
  try {
    // Initialize strategy
    const flashStrategy = await initializeStrategy();
    
    // Execute strategy
    const result = await flashStrategy.executeDailyStrategy(day, amount);
    
    // Display results
    console.log('Strategy execution complete!');
    console.log(`Starting amount: ${result.startingAmount / 1_000_000_000} SOL`);
    console.log(`Ending amount: ${result.endingAmount / 1_000_000_000} SOL`);
    console.log(`Profit: ${result.profit / 1_000_000_000} SOL`);
    console.log(`Success rate: ${result.successfulOperations}/${result.operations}`);
    
    return result;
  } catch (error) {
    console.error('Error executing strategy:', error);
    throw error;
  }
}

/**
 * Execute weekly strategy
 */
async function executeWeeklyStrategy(startingAmount: number = 2_000_000_000) {
  console.log(`Executing full weekly strategy with ${startingAmount / 1_000_000_000} SOL`);
  
  try {
    // Initialize strategy
    const flashStrategy = await initializeStrategy();
    
    // Execute strategy
    const result = await flashStrategy.executeWeeklyStrategy(startingAmount);
    
    // Display results
    console.log('Weekly strategy execution complete!');
    console.log(`Starting amount: ${result.startingAmount / 1_000_000_000} SOL`);
    console.log(`Final amount: ${result.finalAmount / 1_000_000_000} SOL`);
    console.log(`Total profit: ${result.totalProfit / 1_000_000_000} SOL`);
    console.log(`Growth: ${result.growthPercentage.toFixed(2)}%`);
    
    // Display daily breakdown
    console.log('\nDaily breakdown:');
    result.dailyResults.forEach((day) => {
      console.log(`Day ${day.day}: ${day.startingAmount / 1_000_000_000} SOL → ${day.endingAmount / 1_000_000_000} SOL (${day.profit / 1_000_000_000} SOL profit)`);
    });
    
    return result;
  } catch (error) {
    console.error('Error executing weekly strategy:', error);
    throw error;
  }
}

/**
 * Process command line arguments
 */
async function processArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage:');
    console.log('  npx tsx execute-flash-strategy.ts daily <day> <amount>');
    console.log('  npx tsx execute-flash-strategy.ts weekly <amount>');
    console.log('\nExamples:');
    console.log('  npx tsx execute-flash-strategy.ts daily 1 1.5');
    console.log('  npx tsx execute-flash-strategy.ts weekly 2');
    return;
  }
  
  const command = args[0];
  
  if (command === 'daily') {
    const day = parseInt(args[1]) || 1;
    const amount = parseFloat(args[2]) || 1;
    await executeDailyStrategy(day, amount * 1_000_000_000);
  } else if (command === 'weekly') {
    const amount = parseFloat(args[1]) || 2;
    await executeWeeklyStrategy(amount * 1_000_000_000);
  } else {
    console.log('Unknown command:', command);
    console.log('Try --help for usage information');
  }
}

// Main entry point
if (require.main === module) {
  processArgs()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { executeDailyStrategy, executeWeeklyStrategy };