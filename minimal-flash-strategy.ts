/**
 * Minimal Flash Loan Strategy
 * 
 * This script configures a minimal flash loan strategy that can work
 * with very limited starting capital (0.1 SOL or less).
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Constants
const MINIMAL_CAPITAL = true; // Enable settings for minimal capital
const MAX_FLASH_LOAN_SIZE = 0.5; // Maximum flash loan size in SOL
const TRANSACTION_FEE_BUFFER = 0.01; // Reserve for transaction fees
const ACCESSIBLE_WALLET_ADDRESS = '4MyfJj413sqtbLaEub8kw6qPsazAE6T4EhjgaxHWcrdC';
const ACCESSIBLE_WALLET_PRIVATE_KEY = '793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f';

// Create logs directory if it doesn't exist
const logDir = './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Set up logging
const logFile = `${logDir}/minimal-flash-${Date.now()}.log`;
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

// Update system configuration for minimal capital
function updateSystemConfig(): void {
  logger.info('Updating system configuration for minimal capital operations...');
  
  try {
    // Check if system memory config exists
    const systemMemoryPath = './data/system-memory.json';
    if (!fs.existsSync(systemMemoryPath)) {
      logger.error('System memory configuration not found!');
      return;
    }
    
    // Read existing config
    const systemMemory = JSON.parse(fs.readFileSync(systemMemoryPath, 'utf8'));
    
    // Update configuration for minimal capital
    systemMemory.trading = systemMemory.trading || {};
    systemMemory.trading.minimumCapital = 0.05;
    systemMemory.trading.preferredWallet = ACCESSIBLE_WALLET_ADDRESS;
    
    // Update flash loan settings
    systemMemory.flashLoans = systemMemory.flashLoans || {};
    systemMemory.flashLoans.enabled = true;
    systemMemory.flashLoans.maxLoanSize = MAX_FLASH_LOAN_SIZE;
    systemMemory.flashLoans.provider = 'solend';
    systemMemory.flashLoans.minProfitThreshold = 0.0001; // Very small profit threshold
    
    // Reduce safety thresholds
    systemMemory.safety = systemMemory.safety || {};
    systemMemory.safety.maxSlippageBps = 200; // 2% max slippage
    systemMemory.safety.minSuccessRate = 70; // 70% minimum success rate
    
    // Save updated config
    fs.writeFileSync(systemMemoryPath, JSON.stringify(systemMemory, null, 2));
    logger.info('System configuration updated successfully');
  } catch (error) {
    logger.error(`Error updating system config: ${error}`);
  }
}

// Update wallet configuration to use accessible wallet
function updateWalletConfig(): void {
  logger.info('Updating wallet configuration to use accessible wallet...');
  
  try {
    // Create wallet config
    const walletConfig = {
      version: '1.0.0',
      wallets: {
        main: {
          address: ACCESSIBLE_WALLET_ADDRESS,
          privateKey: ACCESSIBLE_WALLET_PRIVATE_KEY,
          type: 'main',
          active: true,
          description: 'Accessible wallet for minimal flash loan operations',
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
      
      // Find or add accessible wallet
      let accessibleWalletFound = false;
      for (let i = 0; i < wallets.length; i++) {
        if (wallets[i].publicKey === ACCESSIBLE_WALLET_ADDRESS) {
          wallets[i].isActive = true;
          accessibleWalletFound = true;
          break;
        }
      }
      
      if (!accessibleWalletFound) {
        wallets.push({
          type: 'TRADING',
          publicKey: ACCESSIBLE_WALLET_ADDRESS,
          privateKey: ACCESSIBLE_WALLET_PRIVATE_KEY,
          label: 'Accessible Wallet (Active)',
          isActive: true
        });
      }
      
      fs.writeFileSync(walletsPath, JSON.stringify(wallets, null, 2));
      logger.info('Updated wallets.json with accessible wallet');
    }
  } catch (error) {
    logger.error(`Error updating wallet config: ${error}`);
  }
}

// Configure minimal flash strategy
function configureMinimalFlashStrategy(): void {
  logger.info('Configuring minimal flash loan strategy...');
  
  try {
    // Create strategy configuration
    const strategyConfig = {
      id: 'minimal-flash-strategy',
      name: 'Minimal Capital Flash Loan Strategy',
      description: 'Optimized flash loan strategy for minimal starting capital',
      type: 'flash-loan',
      enabled: true,
      settings: {
        flashLoanProvider: 'solend',
        maxLoanSizeSOL: MAX_FLASH_LOAN_SIZE,
        minProfitThreshold: 0.0001,
        maxSlippageBps: 200,
        routeLength: 3, // Simplified route for faster execution
        preferredDEXs: ['jupiter', 'orca'], // Focus on high-liquidity DEXs
        backoffMultiplier: 1.5,
        maxExecutionsPerHour: 6,
        gasOptimized: true
      },
      routes: [
        {
          name: 'Basic SOL-USDC-SOL',
          steps: [
            { from: 'SOL', to: 'USDC', dex: 'jupiter' },
            { from: 'USDC', to: 'SOL', dex: 'orca' }
          ],
          enabled: true
        },
        {
          name: 'Basic USDC-ETH-USDC',
          steps: [
            { from: 'USDC', to: 'ETH', dex: 'jupiter' },
            { from: 'ETH', to: 'USDC', dex: 'orca' }
          ],
          enabled: true
        }
      ],
      safety: {
        maxPercentOfWalletBalance: 100, // Since we're using flash loans
        stopLossPercentage: 2,
        requireFlashLoan: true,
        onlyExecuteInProfit: true
      }
    };
    
    // Save strategy configuration
    const strategyPath = './data/minimal-flash-strategy.json';
    fs.writeFileSync(strategyPath, JSON.stringify(strategyConfig, null, 2));
    logger.info('Minimal flash strategy configuration created successfully');
    
    // Create strategy activation script
    const activationScript = `
#!/bin/bash

# Activate Minimal Flash Loan Strategy
# This script activates the minimal capital flash loan strategy

echo "Activating Minimal Flash Loan Strategy..."
npm run dev
    `;
    
    const activationPath = './activate-minimal-flash.sh';
    fs.writeFileSync(activationPath, activationScript);
    fs.chmodSync(activationPath, 0o755);
    logger.info('Created activation script at ./activate-minimal-flash.sh');
  } catch (error) {
    logger.error(`Error configuring minimal flash strategy: ${error}`);
  }
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('🚀 MINIMAL CAPITAL FLASH LOAN STRATEGY SETUP');
  console.log('=============================================');
  console.log('Setting up a strategy that can work with minimal capital (0.1 SOL)');
  
  try {
    // Create keypair from accessible wallet private key
    const walletKeypair = createKeypairFromPrivateKey(ACCESSIBLE_WALLET_PRIVATE_KEY);
    
    // Setup Solana connection
    const connection = await setupConnection();
    
    // Check wallet balance
    const balance = await checkWalletBalance(connection, ACCESSIBLE_WALLET_ADDRESS);
    
    if (balance < TRANSACTION_FEE_BUFFER) {
      console.log(`\n⚠️ WARNING: Wallet balance (${balance.toFixed(6)} SOL) is very low`);
      console.log(`At least ${TRANSACTION_FEE_BUFFER} SOL is recommended for transaction fees`);
      console.log('You may need to add more SOL to the wallet for transactions to succeed\n');
    }
    
    // Update system configuration
    updateSystemConfig();
    
    // Update wallet configuration
    updateWalletConfig();
    
    // Configure minimal flash strategy
    configureMinimalFlashStrategy();
    
    console.log('\n=============================================');
    console.log('✅ MINIMAL FLASH STRATEGY CONFIGURED SUCCESSFULLY');
    console.log('=============================================');
    console.log('Your accessible wallet has been configured for trading');
    console.log(`Wallet Address: ${ACCESSIBLE_WALLET_ADDRESS}`);
    console.log(`Current Balance: ${balance.toFixed(6)} SOL`);
    console.log('\nTo start trading with this strategy, run:');
    console.log('./activate-minimal-flash.sh');
    console.log('\nOr restart the application with:');
    console.log('npm run dev');
    console.log('=============================================');
    
  } catch (error) {
    console.error('\n=============================================');
    console.error('❌ ERROR SETTING UP MINIMAL FLASH STRATEGY');
    console.error('=============================================');
    console.error(error);
  }
}

// Run the script
main();