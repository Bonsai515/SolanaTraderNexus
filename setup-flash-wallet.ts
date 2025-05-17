/**
 * Set Up Trading Wallet 1 For Flash Loans
 * 
 * This script configures Trading Wallet 1 for flash loan trading with 
 * minimal capital requirements.
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';

// Constants
const TRADING_WALLET1_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const TRADING_WALLET1_PRIVATE_KEY = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';
const TRANSACTION_FEE_BUFFER = 0.01; // Reserve for transaction fees

// Create logs directory if it doesn't exist
const logDir = './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Set up logging
const logFile = `${logDir}/flash-loan-setup-${Date.now()}.log`;
const logger = {
  info: (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [INFO] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(logFile, logMessage + '\n');
  },
  error: (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [ERROR] ${message}`;
    console.error(logMessage);
    fs.appendFileSync(logFile, logMessage + '\n');
  }
};

// Setup Solana connection
async function setupConnection(): Promise<Connection> {
  // Use multiple RPC URLs in case one fails
  const rpcUrls = [
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
    'https://solana.public-rpc.com'
  ];
  
  for (const url of rpcUrls) {
    try {
      logger.info(`Trying RPC URL: ${url}`);
      const connection = new Connection(url, 'confirmed');
      // Test the connection
      await connection.getRecentBlockhash();
      logger.info(`Successfully connected to ${url}`);
      return connection;
    } catch (err) {
      logger.error(`Error connecting to ${url}: ${err}`);
    }
  }
  
  throw new Error('Failed to connect to any Solana RPC endpoint');
}

// Check wallet balance
async function checkWalletBalance(connection: Connection, walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    logger.info(`Wallet balance: ${solBalance.toFixed(6)} SOL`);
    return solBalance;
  } catch (error) {
    logger.error(`Error checking wallet balance: ${error}`);
    throw error;
  }
}

// Create keypair from private key
function createKeypairFromPrivateKey(privateKeyHex: string): Keypair {
  try {
    const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
    return Keypair.fromSecretKey(privateKeyBuffer);
  } catch (error) {
    logger.error(`Error creating keypair: ${error}`);
    throw error;
  }
}

// Update system configuration for flash loans
function updateSystemConfig(): void {
  logger.info('Updating system configuration for flash loan operations...');
  
  try {
    // Check if system memory config exists
    const systemMemoryPath = './data/system-memory.json';
    if (!fs.existsSync(systemMemoryPath)) {
      // Create basic system memory if it doesn't exist
      const basicSystemMemory = {
        trading: {
          minimumCapital: 0.01,
          preferredWallet: TRADING_WALLET1_ADDRESS
        },
        flashLoans: {
          enabled: true,
          preferredProtocol: "solend",
          maxLoanAmount: 500,
          maxBorrowSizeUSD: 1000,
          minProfitThresholdUSD: 0.05
        },
        safety: {
          maxSlippageBps: 200, // 2% max slippage
          minSuccessRate: 70 // 70% minimum success rate
        }
      };
      
      fs.writeFileSync(systemMemoryPath, JSON.stringify(basicSystemMemory, null, 2));
      logger.info('Created new system memory configuration');
      return;
    }
    
    // Read existing config
    const systemMemory = JSON.parse(fs.readFileSync(systemMemoryPath, 'utf8'));
    
    // Update configuration for flash loans
    systemMemory.trading = systemMemory.trading || {};
    systemMemory.trading.minimumCapital = 0.01;
    systemMemory.trading.preferredWallet = TRADING_WALLET1_ADDRESS;
    
    // Update flash loan settings
    systemMemory.flashLoans = systemMemory.flashLoans || {};
    systemMemory.flashLoans.enabled = true;
    systemMemory.flashLoans.preferredProtocol = "solend";
    systemMemory.flashLoans.maxLoanAmount = 500;
    systemMemory.flashLoans.maxBorrowSizeUSD = 1000;
    systemMemory.flashLoans.minProfitThresholdUSD = 0.05;
    
    // Reduce safety thresholds
    systemMemory.safety = systemMemory.safety || {};
    systemMemory.safety.maxSlippageBps = 200; // 2% max slippage
    systemMemory.safety.minSuccessRate = 70; // 70% minimum success rate
    
    // Save updated config
    fs.writeFileSync(systemMemoryPath, JSON.stringify(systemMemory, null, 2));
    logger.info('System configuration updated successfully for flash loans');
  } catch (error) {
    logger.error(`Error updating system config: ${error}`);
  }
}

// Update wallet configuration to use Trading Wallet 1 for flash loans
function updateWalletConfig(): void {
  logger.info('Updating wallet configuration to use Trading Wallet 1 for flash loans...');
  
  try {
    // Create wallet config
    const walletConfig = {
      version: '1.0.0',
      wallets: {
        main: {
          address: TRADING_WALLET1_ADDRESS,
          privateKey: TRADING_WALLET1_PRIVATE_KEY,
          type: 'main',
          active: true,
          description: 'Trading Wallet 1 for flash loan operations',
          useForTrading: true
        }
      },
      config: {
        useRealWallet: true,
        updateBalanceAfterTrades: true,
        verifyTransactions: true,
        recordTransactions: true,
        transactionSigningMethod: 'local'
      }
    };
    
    // Save wallet configuration
    const walletConfigPath = './data/active-wallet.json';
    fs.writeFileSync(walletConfigPath, JSON.stringify(walletConfig, null, 2));
    logger.info('Wallet configuration updated successfully');
    
    // Update wallets.json if it exists
    const walletsPath = './data/wallets.json';
    if (fs.existsSync(walletsPath)) {
      const wallets = JSON.parse(fs.readFileSync(walletsPath, 'utf8'));
      
      // Find or add Trading Wallet 1
      let tradingWallet1Found = false;
      for (let i = 0; i < wallets.length; i++) {
        if (wallets[i].publicKey === TRADING_WALLET1_ADDRESS) {
          wallets[i].isActive = true;
          tradingWallet1Found = true;
          break;
        }
      }
      
      if (!tradingWallet1Found) {
        wallets.push({
          type: 'TRADING',
          publicKey: TRADING_WALLET1_ADDRESS,
          privateKey: TRADING_WALLET1_PRIVATE_KEY,
          label: 'Flash Loan Wallet (Active)',
          isActive: true
        });
      }
      
      fs.writeFileSync(walletsPath, JSON.stringify(wallets, null, 2));
      logger.info('Updated wallets.json with Trading Wallet 1 for flash loans');
    }
  } catch (error) {
    logger.error(`Error updating wallet config: ${error}`);
  }
}

// Configure flash loan strategy
function configureFlashLoanStrategy(): void {
  logger.info('Configuring flash loan strategy...');
  
  try {
    // Create strategy configuration for flash loans
    const strategyConfig = {
      id: 'quantum-flash-loan-strategy',
      name: 'Quantum Flash Loan Strategy',
      description: 'Optimized strategy for flash loan arbitrage with minimal capital requirements',
      type: 'flash-loan',
      enabled: true,
      settings: {
        maxFlashLoanAmountUSD: 1000,
        minProfitThresholdUSD: 0.05,
        maxSlippageBps: 100,
        preferredDEXs: ['jupiter', 'orca', 'raydium'], 
        backoffMultiplier: 1.5,
        maxExecutionsPerHour: 3,
        gasOptimized: true
      },
      protocols: [
        { name: 'solend', priority: 1, enabled: true },
        { name: 'mango', priority: 2, enabled: false }
      ],
      routes: [
        { path: ['SOL', 'USDC', 'SOL'], enabled: true, priority: 1 },
        { path: ['USDC', 'ETH', 'USDC'], enabled: true, priority: 2 },
        { path: ['SOL', 'BONK', 'SOL'], enabled: true, priority: 3 },
        { path: ['USDC', 'JUP', 'USDC'], enabled: true, priority: 4 }
      ],
      safety: {
        maxPercentOfWalletBalance: 90,
        stopExecOnError: true,
        maxConsecutiveErrors: 3,
        cooldownAfterErrorSec: 60
      }
    };
    
    // Save strategy configuration
    const strategyPath = './data/quantum-flash-loan-strategy.json';
    fs.writeFileSync(strategyPath, JSON.stringify(strategyConfig, null, 2));
    logger.info('Flash loan strategy configuration created successfully');
    
    // Create activation script
    const activationScript = `#!/bin/bash

# Activate Quantum Flash Loan Strategy
# This script activates flash loan trading with Trading Wallet 1

echo "========================================================"
echo "🚀 ACTIVATING QUANTUM FLASH LOAN STRATEGY"
echo "========================================================"
echo "Starting system with flash loan configuration..."
echo ""

# Execute the flash loan strategy
npm run dev`;
    
    const activationPath = './activate-quantum-flash.sh';
    fs.writeFileSync(activationPath, activationScript);
    fs.chmodSync(activationPath, 0o755);
    logger.info('Created activation script at ./activate-quantum-flash.sh');
  } catch (error) {
    logger.error(`Error configuring flash loan strategy: ${error}`);
  }
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('🚀 QUANTUM FLASH LOAN STRATEGY SETUP');
  console.log('=============================================');
  console.log('Setting up Trading Wallet 1 for flash loan trading');
  
  try {
    // Create keypair from Trading Wallet 1 private key
    const walletKeypair = createKeypairFromPrivateKey(TRADING_WALLET1_PRIVATE_KEY);
    
    // Setup Solana connection
    const connection = await setupConnection();
    
    // Check wallet balance
    const balance = await checkWalletBalance(connection, TRADING_WALLET1_ADDRESS);
    
    if (balance < TRANSACTION_FEE_BUFFER) {
      console.log(`\n⚠️ WARNING: Trading Wallet 1 balance (${balance.toFixed(6)} SOL) is very low`);
      console.log(`At least ${TRANSACTION_FEE_BUFFER} SOL is recommended for transaction fees`);
      console.log('You need to add more SOL to the wallet for the flash loan transactions to succeed\n');
    }
    
    // Update system configuration
    updateSystemConfig();
    
    // Update wallet configuration
    updateWalletConfig();
    
    // Configure flash loan strategy
    configureFlashLoanStrategy();
    
    console.log('\n=============================================');
    console.log('✅ FLASH LOAN STRATEGY CONFIGURED SUCCESSFULLY');
    console.log('=============================================');
    console.log('Trading Wallet 1 has been configured for flash loan trading');
    console.log(`Wallet Address: ${TRADING_WALLET1_ADDRESS}`);
    console.log(`Current Balance: ${balance.toFixed(6)} SOL`);
    console.log('\nTo start trading with this strategy, run:');
    console.log('./activate-quantum-flash.sh');
    console.log('\nImportant Note: You need to add at least 0.01 SOL to this wallet');
    console.log('for transaction fees before the flash loan strategy can execute');
    console.log('transactions on the Solana blockchain.');
    console.log('=============================================');
    
  } catch (error) {
    console.error('\n=============================================');
    console.error('❌ ERROR SETTING UP FLASH LOAN STRATEGY');
    console.error('=============================================');
    console.error(error);
  }
}

// Run the script
main();