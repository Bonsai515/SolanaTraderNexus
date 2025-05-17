/**
 * Execute Real Blockchain Trading with Quantum Flash Strategy
 * 
 * This script executes the Quantum Flash Strategy on the real blockchain,
 * using the system wallet with actual funds.
 */

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Import our strategy
const { QuantumFlashStrategy } = require('./server/strategies/quantum_flash_strategy');

// Configuration
const CONFIG = {
  mainWalletAddress: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
  rpcUrl: 'https://solana-mainnet.g.alchemy.com/v2/PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR',
  amount: 1.1, // SOL
  day: 1, // Strategy day (1-7, 1 is most conservative)
  realTrading: true // Set to true for actual blockchain transactions
};

/**
 * Load wallet private key from system
 */
function loadPrivateKey() {
  try {
    // Read wallet data
    const walletsPath = path.join(process.cwd(), 'data', 'wallets.json');
    const walletData = JSON.parse(fs.readFileSync(walletsPath, 'utf8'));
    
    if (Array.isArray(walletData)) {
      // Find a wallet with private key
      const wallet = walletData.find(w => w.privateKey && w.publicKey === CONFIG.mainWalletAddress);
      
      if (wallet) {
        return wallet.privateKey;
      }
      
      // If main wallet doesn't have private key, try any wallet with private key
      const anyWallet = walletData.find(w => w.privateKey);
      if (anyWallet) {
        console.log(`Using alternate wallet: ${anyWallet.publicKey}`);
        CONFIG.mainWalletAddress = anyWallet.publicKey;
        return anyWallet.privateKey;
      }
    }
    
    console.log('No private key found, running in read-only mode');
    return null;
  } catch (error) {
    console.error('Error loading private key:', error);
    return null;
  }
}

/**
 * Create a keypair from private key
 */
function createKeypair(privateKeyHex) {
  if (!privateKeyHex) return null;
  
  try {
    const privateKeyBytes = Buffer.from(privateKeyHex, 'hex');
    return Keypair.fromSecretKey(privateKeyBytes);
  } catch (error) {
    console.error('Error creating keypair:', error);
    return null;
  }
}

async function runRealTrading() {
  console.log('=== QUANTUM FLASH STRATEGY - REAL BLOCKCHAIN TRADING ===');
  console.log(`Using wallet: ${CONFIG.mainWalletAddress}`);
  console.log(`Amount: ${CONFIG.amount} SOL`);
  console.log(`Day ${CONFIG.day} (Conservative strategy)`);
  console.log(`RPC: Alchemy`);
  console.log(`Real trading: ${CONFIG.realTrading ? 'ENABLED ⚠️' : 'Disabled (Simulation)'}`);
  console.log('');
  
  // Get the private key
  const privateKey = loadPrivateKey();
  const keypair = createKeypair(privateKey);
  
  if (CONFIG.realTrading && !keypair) {
    console.log('⚠️ Cannot execute real trading without private key.');
    console.log('Switching to simulation mode.');
    CONFIG.realTrading = false;
  }
  
  try {
    // Create connection
    const connection = new Connection(CONFIG.rpcUrl);
    
    // Verify the connection
    const version = await connection.getVersion();
    console.log('Connected to Solana RPC:', version);
    
    // Check wallet balance
    const walletPubkey = new PublicKey(CONFIG.mainWalletAddress);
    const balance = await connection.getBalance(walletPubkey);
    const solBalance = balance / 1_000_000_000;
    
    console.log(`Wallet ${CONFIG.mainWalletAddress} balance: ${solBalance} SOL`);
    
    if (solBalance < CONFIG.amount) {
      console.log(`Warning: Wallet balance (${solBalance} SOL) is less than requested amount (${CONFIG.amount} SOL)`);
      console.log(`Adjusting trade amount to ${(solBalance - 0.05).toFixed(2)} SOL`);
      CONFIG.amount = parseFloat((solBalance - 0.05).toFixed(2));
    }
    
    // Create wallet object for the strategy
    const wallet = {
      publicKey: walletPubkey,
      address: CONFIG.mainWalletAddress,
      signTransaction: async (tx) => {
        if (CONFIG.realTrading && keypair) {
          console.log('Signing transaction with real private key');
          // In real mode, actually sign the transaction
          tx.sign(keypair);
          return tx;
        } else {
          console.log('Would sign transaction (simulation only)');
          return tx;
        }
      }
    };
    
    // Create strategy instance with real trading flag
    const strategy = new QuantumFlashStrategy(connection, wallet, { realTrading: CONFIG.realTrading });
    
    // Initialize the strategy
    console.log('\nInitializing Quantum Flash Strategy...');
    const initialized = await strategy.initialize();
    
    if (!initialized) {
      throw new Error('Failed to initialize Quantum Flash Strategy');
    }
    
    if (CONFIG.realTrading) {
      console.log('\n⚠️ EXECUTING REAL BLOCKCHAIN TRANSACTIONS ⚠️');
      console.log('Press Ctrl+C within 5 seconds to cancel...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log(`\nExecuting Day ${CONFIG.day} trading strategy with ${CONFIG.amount} SOL...`);
    const result = await strategy.executeDailyStrategy(CONFIG.amount * 1_000_000_000, CONFIG.day);
    
    console.log('\n=== STRATEGY EXECUTION RESULTS ===');
    console.log(`Starting amount: ${CONFIG.amount} SOL`);
    
    if (result) {
      console.log(`Ending amount: ${result.endingAmount / 1_000_000_000} SOL`);
      console.log(`Profit: ${result.profit / 1_000_000_000} SOL (${result.profitPercentage}%)`);
      console.log(`Success rate: ${result.successRate}%`);
      console.log(`Operations: ${result.operations}`);
      console.log(`Successful operations: ${result.successfulOperations}`);
    } else {
      console.log('Strategy returned no results');
    }
    
    // Save log to transactions directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logDir = path.join(process.cwd(), 'logs', 'transactions');
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logPath = path.join(logDir, `quantum-flash-${timestamp}.json`);
    const logData = {
      timestamp: timestamp,
      type: 'quantum-flash',
      day: CONFIG.day,
      startingAmount: CONFIG.amount,
      endingAmount: result ? result.endingAmount / 1_000_000_000 : CONFIG.amount,
      profit: result ? result.profit / 1_000_000_000 : 0,
      profitPercentage: result ? result.profitPercentage : 0,
      successRate: result ? result.successRate : 0,
      realTrading: CONFIG.realTrading,
      wallet: CONFIG.mainWalletAddress
    };
    
    fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
    console.log(`\nTransaction log saved to ${logPath}`);
    
    // Verify balance change if real trading
    if (CONFIG.realTrading) {
      console.log('\nVerifying wallet balance after trade...');
      const newBalance = await connection.getBalance(walletPubkey);
      const newSolBalance = newBalance / 1_000_000_000;
      console.log(`New balance: ${newSolBalance} SOL`);
      console.log(`Change: ${newSolBalance - solBalance} SOL`);
    }
    
  } catch (error) {
    console.error('Error executing real trading strategy:', error);
  }
}

// Run the trading
runRealTrading();