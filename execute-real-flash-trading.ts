/**
 * Execute Real Blockchain Flash Trading
 * 
 * This script executes the Quantum Flash Strategy on the real Solana blockchain
 * using actual funds and recording all transactions.
 */

import { FlashStrategyIntegration } from './server/strategies/flash_strategy_integration';

// Initialize flash strategy integration
function getFlashStrategyIntegration(walletProvider: () => any): FlashStrategyIntegration {
  return new FlashStrategyIntegration(walletProvider);
}
import { rpcManager } from './server/lib/enhancedRpcManager';
import { multiSourcePriceFeed } from './server/lib/multiSourcePriceFeed';
import * as fs from 'fs';
import * as path from 'path';

// Path to log real transactions
const TRANSACTION_LOG_DIR = path.join(process.cwd(), 'logs', 'transactions');

/**
 * Get or create wallet for real trading
 */
function getWallet() {
  try {
    // Use the system trading wallet from the wallet.json file
    const walletData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'wallets.json'), 'utf8'));
    
    if (walletData.mainWallet) {
      console.log(`Using main wallet: ${walletData.mainWallet.publicKey}`);
      return walletData.mainWallet;
    }
    
    if (walletData.wallets && walletData.wallets.length > 0) {
      console.log(`Using primary wallet: ${walletData.wallets[0].publicKey}`);
      return walletData.wallets[0];
    }
    
    throw new Error('No wallet found in wallet data');
  } catch (error) {
    console.error('Error loading wallet:', error);
    throw error;
  }
}

/**
 * Initialize the flash trading system
 */
async function initializeFlashTrading() {
  // Ensure transaction log directory exists
  if (!fs.existsSync(TRANSACTION_LOG_DIR)) {
    fs.mkdirSync(TRANSACTION_LOG_DIR, { recursive: true });
  }
  
  console.log('Initializing Quantum Flash Strategy for REAL blockchain trading...');
  console.log('⚠️  WARNING: This will use REAL funds from your wallet ⚠️');
  console.log('');
  
  // Get wallet provider
  const wallet = getWallet();
  console.log(`Wallet ${wallet.publicKey} will be used for trading`);
  
  // Initialize price feed
  console.log('Checking price feed status...');
  const priceStatus = multiSourcePriceFeed.getSourceStatus();
  const healthySources = priceStatus.filter((s: any) => s.state === 'CLOSED').length;
  
  if (healthySources === 0) {
    throw new Error('No healthy price sources available. Cannot proceed with real trading.');
  }
  
  console.log(`${healthySources}/${priceStatus.length} price sources are healthy`);
  
  // Initialize flash strategy with wallet
  const walletProvider = () => wallet;
  const flashStrategy = getFlashStrategyIntegration(walletProvider);
  
  // Initialize strategy
  const success = await flashStrategy.initialize();
  
  if (!success) {
    throw new Error('Failed to initialize flash strategy for real trading');
  }
  
  console.log('Quantum Flash Strategy initialized successfully for REAL trading');
  console.log('');
  
  return flashStrategy;
}

/**
 * Execute real blockchain trading with the specified parameters
 */
async function executeRealBlockchainTrading(day: number, amount: number) {
  console.log(`Starting REAL blockchain trading with Day ${day} strategy and ${amount} SOL`);
  console.log('This will execute actual blockchain transactions!');
  console.log('');
  
  try {
    // Initialize flash trading
    const flashStrategy = await initializeFlashTrading();
    
    // Convert SOL to lamports
    const lamports = Math.floor(amount * 1_000_000_000);
    
    // Execute the strategy
    console.log(`Executing Day ${day} strategy with ${amount} SOL...`);
    const result = await flashStrategy.executeDailyStrategy(day, lamports);
    
    // Log results
    console.log('');
    console.log('=== REAL BLOCKCHAIN TRADING RESULTS ===');
    console.log(`Starting amount: ${result.startingAmount / 1_000_000_000} SOL`);
    console.log(`Ending amount: ${result.endingAmount / 1_000_000_000} SOL`);
    console.log(`Profit: ${result.profit / 1_000_000_000} SOL`);
    console.log(`Success rate: ${result.successfulOperations}/${result.operations} operations (${(result.successfulOperations / result.operations * 100).toFixed(2)}%)`);
    
    // Log to transaction log
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'quantum_flash',
      day,
      startingAmount: result.startingAmount / 1_000_000_000,
      endingAmount: result.endingAmount / 1_000_000_000,
      profit: result.profit / 1_000_000_000,
      operations: result.operations,
      successfulOperations: result.successfulOperations,
      wallet: getWallet().publicKey
    };
    
    // Write to log file
    const logFile = path.join(TRANSACTION_LOG_DIR, `flash-trades-${new Date().toISOString().split('T')[0]}.json`);
    
    let logs = [];
    if (fs.existsSync(logFile)) {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    }
    
    logs.push(logEntry);
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    
    return result;
  } catch (error) {
    console.error('Error executing real blockchain trading:', error);
    throw error;
  }
}

/**
 * Process command line arguments
 */
async function processArgs() {
  const args = process.argv.slice(2);
  
  if (args.length < 2 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: npx tsx execute-real-flash-trading.ts <day> <amount>');
    console.log('');
    console.log('  <day>    - Day number (1-7) of the strategy');
    console.log('  <amount> - Amount of SOL to trade with');
    console.log('');
    console.log('Example: npx tsx execute-real-flash-trading.ts 1 1.5');
    console.log('         (Executes Day 1 strategy with 1.5 SOL)');
    return;
  }
  
  const day = parseInt(args[0]);
  const amount = parseFloat(args[1]);
  
  if (isNaN(day) || day < 1 || day > 7) {
    console.error('Error: Day must be a number between 1 and 7');
    return;
  }
  
  if (isNaN(amount) || amount <= 0) {
    console.error('Error: Amount must be a positive number');
    return;
  }
  
  // Execute real blockchain trading
  await executeRealBlockchainTrading(day, amount);
}

// Main entry point
if (require.main === module) {
  processArgs()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { executeRealBlockchainTrading };