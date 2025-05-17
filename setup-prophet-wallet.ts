/**
 * Set Up Prophet Wallet For Trading
 * 
 * This script configures the Prophet wallet for trading with 
 * minimal capital requirements.
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Constants
const PROPHET_WALLET_ADDRESS = '5KJhonWngrkP8qtzf69F7trirJubtqVM7swsR7Apr2fG';
const PROPHET_WALLET_PRIVATE_KEY = 'd28c249469fd4ba35a58800b64e38ccbe22db4df2e115647aa85ff75d5a94544401f38419785a5c053f82d85106a0a1c737619ab0dff383aa24ae8ec4ffde787';
const TRANSACTION_FEE_BUFFER = 0.01; // Reserve for transaction fees

// Create logs directory if it doesn't exist
const logDir = './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Set up logging
const logFile = `${logDir}/prophet-wallet-setup-${Date.now()}.log`;
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

// Update system configuration for the Prophet wallet
function updateSystemConfig(): void {
  logger.info('Updating system configuration for Prophet wallet...');
  
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
    systemMemory.trading.preferredWallet = PROPHET_WALLET_ADDRESS;
    
    // Update strategy settings
    systemMemory.strategies = systemMemory.strategies || {};
    systemMemory.strategies.minProfitThreshold = 0.0001; // Very small profit threshold
    systemMemory.strategies.maxSlippageBps = 200; // 2% max slippage
    
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

// Update wallet configuration to use Prophet wallet
function updateWalletConfig(): void {
  logger.info('Updating wallet configuration to use Prophet wallet...');
  
  try {
    // Create wallet config
    const walletConfig = {
      version: '1.0.0',
      wallets: {
        main: {
          address: PROPHET_WALLET_ADDRESS,
          privateKey: PROPHET_WALLET_PRIVATE_KEY,
          type: 'main',
          active: true,
          description: 'Prophet wallet for trading',
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
      
      // Find or add Prophet wallet
      let prophetWalletFound = false;
      for (let i = 0; i < wallets.length; i++) {
        if (wallets[i].publicKey === PROPHET_WALLET_ADDRESS) {
          wallets[i].isActive = true;
          prophetWalletFound = true;
          break;
        }
      }
      
      if (!prophetWalletFound) {
        wallets.push({
          type: 'TRADING',
          publicKey: PROPHET_WALLET_ADDRESS,
          privateKey: PROPHET_WALLET_PRIVATE_KEY,
          label: 'Prophet Wallet (Active)',
          isActive: true
        });
      }
      
      fs.writeFileSync(walletsPath, JSON.stringify(wallets, null, 2));
      logger.info('Updated wallets.json with Prophet wallet');
    }
  } catch (error) {
    logger.error(`Error updating wallet config: ${error}`);
  }
}

// Configure Prophet wallet strategy
function configureProphetStrategy(): void {
  logger.info('Configuring small capital trading strategy with Prophet wallet...');
  
  try {
    // Create strategy configuration for small capital
    const strategyConfig = {
      id: 'prophet-small-capital-strategy',
      name: 'Prophet Small Capital Trading',
      description: 'Optimized strategy for trading with small capital using Prophet wallet',
      type: 'spot-trading',
      enabled: true,
      settings: {
        maxPositionSizeSOL: 0.1,
        minProfitThreshold: 0.0005,
        maxSlippageBps: 100,
        preferredDEXs: ['jupiter', 'orca'], // Focus on high-liquidity DEXs
        backoffMultiplier: 1.5,
        maxExecutionsPerHour: 4,
        gasOptimized: true
      },
      tokens: [
        { symbol: 'SOL', minAmount: 0.01, maxAmount: 0.1 },
        { symbol: 'BONK', minAmount: 10000, maxAmount: 1000000 },
        { symbol: 'JUP', minAmount: 0.1, maxAmount: 10 },
        { symbol: 'USDC', minAmount: 0.1, maxAmount: 10 }
      ],
      safety: {
        maxPercentOfWalletBalance: 90,
        stopLossPercentage: 5,
        takeProfit: true,
        takeProfitThreshold: 3
      }
    };
    
    // Save strategy configuration
    const strategyPath = './data/prophet-small-capital-strategy.json';
    fs.writeFileSync(strategyPath, JSON.stringify(strategyConfig, null, 2));
    logger.info('Prophet small capital strategy configuration created successfully');
    
    // Create activation script
    const activationScript = `
#!/bin/bash

# Activate Prophet Small Capital Trading Strategy
# This script activates small capital trading with Prophet wallet

echo "Activating Prophet Small Capital Trading Strategy..."
npm run dev
    `;
    
    const activationPath = './activate-prophet-wallet.sh';
    fs.writeFileSync(activationPath, activationScript);
    fs.chmodSync(activationPath, 0o755);
    logger.info('Created activation script at ./activate-prophet-wallet.sh');
  } catch (error) {
    logger.error(`Error configuring Prophet strategy: ${error}`);
  }
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('🚀 PROPHET WALLET TRADING SETUP');
  console.log('=============================================');
  console.log('Setting up Prophet wallet for trading with small capital');
  
  try {
    // Create keypair from Prophet wallet private key
    const walletKeypair = createKeypairFromPrivateKey(PROPHET_WALLET_PRIVATE_KEY);
    
    // Setup Solana connection
    const connection = await setupConnection();
    
    // Check wallet balance
    const balance = await checkWalletBalance(connection, PROPHET_WALLET_ADDRESS);
    
    if (balance < TRANSACTION_FEE_BUFFER) {
      console.log(`\n⚠️ WARNING: Prophet wallet balance (${balance.toFixed(6)} SOL) is very low`);
      console.log(`At least ${TRANSACTION_FEE_BUFFER} SOL is recommended for transaction fees`);
      console.log('You may need to add more SOL to the wallet for transactions to succeed\n');
    }
    
    // Update system configuration
    updateSystemConfig();
    
    // Update wallet configuration
    updateWalletConfig();
    
    // Configure Prophet strategy
    configureProphetStrategy();
    
    console.log('\n=============================================');
    console.log('✅ PROPHET WALLET CONFIGURED SUCCESSFULLY');
    console.log('=============================================');
    console.log('Prophet wallet has been configured for trading');
    console.log(`Wallet Address: ${PROPHET_WALLET_ADDRESS}`);
    console.log(`Current Balance: ${balance.toFixed(6)} SOL`);
    console.log('\nTo start trading with this wallet, run:');
    console.log('./activate-prophet-wallet.sh');
    console.log('\nOr restart the application with:');
    console.log('npm run dev');
    console.log('=============================================');
    
  } catch (error) {
    console.error('\n=============================================');
    console.error('❌ ERROR SETTING UP PROPHET WALLET');
    console.error('=============================================');
    console.error(error);
  }
}

// Run the script
main();