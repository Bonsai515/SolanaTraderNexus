/**
 * Set Up Trading Wallet 1 For Trading
 * 
 * This script configures Trading Wallet 1 for trading with 
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
const logFile = `${logDir}/trading-wallet1-setup-${Date.now()}.log`;
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

// Update system configuration for Trading Wallet 1
function updateSystemConfig(): void {
  logger.info('Updating system configuration for Trading Wallet 1...');
  
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
    systemMemory.trading.preferredWallet = TRADING_WALLET1_ADDRESS;
    
    // Update meme token strategy settings
    systemMemory.memeTokens = systemMemory.memeTokens || {};
    systemMemory.memeTokens.enabled = true;
    systemMemory.memeTokens.minInvestmentAmount = 0.01;
    systemMemory.memeTokens.maxLossPercentage = 10;
    
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

// Update wallet configuration to use Trading Wallet 1
function updateWalletConfig(): void {
  logger.info('Updating wallet configuration to use Trading Wallet 1...');
  
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
          description: 'Trading Wallet 1 for meme token operations',
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
          label: 'Trading Wallet 1 (Active)',
          isActive: true
        });
      }
      
      fs.writeFileSync(walletsPath, JSON.stringify(wallets, null, 2));
      logger.info('Updated wallets.json with Trading Wallet 1');
    }
  } catch (error) {
    logger.error(`Error updating wallet config: ${error}`);
  }
}

// Configure meme token strategy for Trading Wallet 1
function configureMemeTokenStrategy(): void {
  logger.info('Configuring meme token strategy with Trading Wallet 1...');
  
  try {
    // Create strategy configuration for meme tokens
    const strategyConfig = {
      id: 'meme-token-strategy',
      name: 'Meme Token Trading Strategy',
      description: 'Strategy focused on trading new and trending meme tokens with small capital',
      type: 'spot-trading',
      enabled: true,
      settings: {
        maxPositionSizeSOL: 0.05,
        minProfitThreshold: 3, // 3% minimum profit
        maxSlippageBps: 300, // 3% max slippage (higher for meme tokens)
        preferredDEXs: ['jupiter', 'raydium'], // DEXs with good meme token support
        backoffMultiplier: 1.5,
        maxExecutionsPerHour: 2,
        gasOptimized: true
      },
      tokens: [
        { symbol: 'BONK', minAmount: 10000, maxAmount: 1000000 },
        { symbol: 'WIF', minAmount: 1, maxAmount: 100 },
        { symbol: 'MEME', minAmount: 1, maxAmount: 100 },
        { symbol: 'POPCAT', minAmount: 100, maxAmount: 10000 }
      ],
      safety: {
        maxPercentOfWalletBalance: 90,
        stopLossPercentage: 15, // Higher stop loss for volatile meme tokens
        takeProfit: true,
        takeProfitThreshold: 20 // 20% take profit threshold
      }
    };
    
    // Save strategy configuration
    const strategyPath = './data/meme-token-strategy.json';
    fs.writeFileSync(strategyPath, JSON.stringify(strategyConfig, null, 2));
    logger.info('Meme token strategy configuration created successfully');
    
    // Create activation script
    const activationScript = `
#!/bin/bash

# Activate Meme Token Trading Strategy
# This script activates meme token trading with Trading Wallet 1

echo "Activating Meme Token Trading Strategy with Trading Wallet 1..."
npm run dev
    `;
    
    const activationPath = './activate-meme-token-strategy.sh';
    fs.writeFileSync(activationPath, activationScript);
    fs.chmodSync(activationPath, 0o755);
    logger.info('Created activation script at ./activate-meme-token-strategy.sh');
  } catch (error) {
    logger.error(`Error configuring meme token strategy: ${error}`);
  }
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('🚀 TRADING WALLET 1 SETUP FOR MEME TOKENS');
  console.log('=============================================');
  console.log('Setting up Trading Wallet 1 for meme token trading');
  
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
      console.log('You may need to add more SOL to the wallet for transactions to succeed\n');
    }
    
    // Update system configuration
    updateSystemConfig();
    
    // Update wallet configuration
    updateWalletConfig();
    
    // Configure meme token strategy
    configureMemeTokenStrategy();
    
    console.log('\n=============================================');
    console.log('✅ TRADING WALLET 1 CONFIGURED SUCCESSFULLY');
    console.log('=============================================');
    console.log('Trading Wallet 1 has been configured for meme token trading');
    console.log(`Wallet Address: ${TRADING_WALLET1_ADDRESS}`);
    console.log(`Current Balance: ${balance.toFixed(6)} SOL`);
    console.log('\nTo start trading with this wallet, run:');
    console.log('./activate-meme-token-strategy.sh');
    console.log('\nOr restart the application with:');
    console.log('npm run dev');
    console.log('=============================================');
    
  } catch (error) {
    console.error('\n=============================================');
    console.error('❌ ERROR SETTING UP TRADING WALLET 1');
    console.error('=============================================');
    console.error(error);
  }
}

// Run the script
main();