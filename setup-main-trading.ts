/**
 * Set Up System for Real Trading
 * 
 * This script configures the system to use the wallet with 9.9 SOL
 * and sets up all required components for real blockchain trading.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Critical paths
const DATA_DIR = './data';
const NEXUS_DIR = path.join(DATA_DIR, 'nexus');

// Main wallet details
const MAIN_WALLET = {
  publicKey: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
  label: 'Main Trading Wallet (9.9 SOL)'
};

// RPC configuration with rate limits
const RPC_URL = 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
const BACKUP_RPC = 'https://api.mainnet-beta.solana.com';

// Ensure directories exist
if (!fs.existsSync(NEXUS_DIR)) {
  fs.mkdirSync(NEXUS_DIR, { recursive: true });
  console.log(`Created directory: ${NEXUS_DIR}`);
}

// Check wallet balance
async function checkWalletBalance(pubkeyString: string): Promise<number> {
  try {
    console.log(`Checking balance for ${pubkeyString}...`);
    
    const pubkey = new PublicKey(pubkeyString);
    const connection = new Connection(RPC_URL, 'confirmed');
    const balance = await connection.getBalance(pubkey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`Wallet balance: ${solBalance} SOL`);
    return solBalance;
  } catch (error) {
    console.error('Failed to check wallet balance with primary RPC:', error instanceof Error ? error.message : String(error));
    
    // Try with backup RPC
    try {
      console.log(`Trying backup RPC for balance check...`);
      const pubkey = new PublicKey(pubkeyString);
      const connection = new Connection(BACKUP_RPC, 'confirmed');
      const balance = await connection.getBalance(pubkey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      console.log(`Wallet balance: ${solBalance} SOL`);
      return solBalance;
    } catch (backupError) {
      console.error('Failed backup balance check:', backupError instanceof Error ? backupError.message : String(backupError));
      return 0;
    }
  }
}

// Update Nexus engine configuration
function updateNexusConfig(): boolean {
  try {
    const nexusConfigPath = path.join(NEXUS_DIR, 'config.json');
    
    // Create nexus engine configuration
    const nexusConfig = {
      useRealFunds: true,
      rpcUrl: RPC_URL,
      websocketUrl: 'wss://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9',
      defaultExecutionMode: 'LIVE',
      defaultPriority: 'HIGH',
      defaultConfirmations: 1,
      maxConcurrentTransactions: 1, // Low concurrency for rate limits
      defaultTimeoutMs: 300000,
      defaultMaxRetries: 20,
      maxSlippageBps: 100,
      mevProtection: true,
      backupRpcUrls: [BACKUP_RPC],
      wallet: {
        address: MAIN_WALLET.publicKey,
        privateKeySet: false // Note: we don't have the private key for this wallet
      },
      rateLimitSettings: {
        maxRequestsPerMinute: 60,
        maxRequestsPerSecond: 1,
        initialBackoffMs: 15000,
        maxBackoffMs: 300000,
        backoffMultiplier: 2,
        retryOnRateLimit: true,
        useTokenBucket: true,
        enforcePerConnection: true,
        delayBetweenTransactionsMs: 15000,
        useRateLimiterMiddleware: true
      },
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(nexusConfigPath, JSON.stringify(nexusConfig, null, 2));
    console.log(`Updated Nexus Engine configuration at ${nexusConfigPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update Nexus configuration:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Update system memory configuration
function updateSystemMemory(): boolean {
  try {
    const systemMemoryPath = path.join(DATA_DIR, 'system-memory.json');
    
    // Default configuration if file doesn't exist
    let systemMemory: any = {
      features: {},
      config: {}
    };
    
    // Load existing configuration if it exists
    if (fs.existsSync(systemMemoryPath)) {
      try {
        systemMemory = JSON.parse(fs.readFileSync(systemMemoryPath, 'utf8'));
      } catch (e) {
        // Continue with default config if parsing fails
      }
    }
    
    // Update features
    systemMemory.features = {
      ...(systemMemory.features || {}),
      realFundsTrading: true,
      optimizedRpc: true,
      nuclearStrategies: true,
      profitCollection: true,
      transactionVerification: true,
      awsIntegration: true,
      solscanVerification: true
    };
    
    // Update wallet configuration
    if (!systemMemory.config) {
      systemMemory.config = {};
    }
    
    if (!systemMemory.config.walletManager) {
      systemMemory.config.walletManager = {};
    }
    
    systemMemory.config.walletManager.primaryWallet = MAIN_WALLET.publicKey;
    systemMemory.config.walletManager.prophetWallet = '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e';
    systemMemory.config.walletManager.hasPrivateKey = false;
    
    // Update transaction engine config
    if (!systemMemory.config.transactionEngine) {
      systemMemory.config.transactionEngine = {};
    }
    
    systemMemory.config.transactionEngine.useRealFunds = true;
    systemMemory.config.transactionEngine.mode = 'LIVE';
    systemMemory.config.transactionEngine.walletAddress = MAIN_WALLET.publicKey;
    
    // Rate limits
    if (!systemMemory.config.rateLimit) {
      systemMemory.config.rateLimit = {};
    }
    
    systemMemory.config.rateLimit.requestsPerMinute = 60;
    systemMemory.config.rateLimit.enabled = true;
    
    // Update profit collection config
    if (!systemMemory.config.profitCollection) {
      systemMemory.config.profitCollection = {};
    }
    
    systemMemory.config.profitCollection = {
      enabled: true,
      captureIntervalMinutes: 60,
      autoCapture: true,
      minProfitThreshold: 0.01,
      reinvestmentRate: 0.95,
      targetWallet: '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e'
    };
    
    // Update RPC config
    if (!systemMemory.config.rpcConfig) {
      systemMemory.config.rpcConfig = {};
    }
    
    systemMemory.config.rpcConfig = {
      primaryProvider: 'instantnodes',
      backupProviders: ['mainnet-beta'],
      connectionMode: 'multi-connection',
      webSocketEnabled: true,
      grpcEnabled: false,
      maxRequestsPerMinute: 60
    };
    
    // Update last updated timestamp
    systemMemory.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(systemMemoryPath, JSON.stringify(systemMemory, null, 2));
    console.log(`Updated system memory at ${systemMemoryPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update system memory:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Update wallets.json to ensure main wallet is active
function updateWalletsJson(): boolean {
  try {
    const walletsJsonPath = path.join(DATA_DIR, 'wallets.json');
    
    if (fs.existsSync(walletsJsonPath)) {
      const wallets = JSON.parse(fs.readFileSync(walletsJsonPath, 'utf8'));
      
      // Update wallet activation status
      wallets.forEach((wallet: any) => {
        if (wallet.publicKey === MAIN_WALLET.publicKey) {
          wallet.isActive = true;
        } else if (wallet.type === 'TRADING') {
          wallet.isActive = false;
        }
      });
      
      fs.writeFileSync(walletsJsonPath, JSON.stringify(wallets, null, 2));
      console.log(`Updated wallets.json at ${walletsJsonPath}`);
      return true;
    } else {
      console.warn(`wallets.json not found at ${walletsJsonPath}`);
      return false;
    }
  } catch (error) {
    console.error('Failed to update wallets.json:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Check if private key exists for main wallet in various locations
async function checkPrivateKeyExists(): Promise<boolean> {
  try {
    const walletsJsonPath = path.join(DATA_DIR, 'wallets.json');
    
    if (fs.existsSync(walletsJsonPath)) {
      const wallets = JSON.parse(fs.readFileSync(walletsJsonPath, 'utf8'));
      
      const mainWallet = wallets.find((w: any) => w.publicKey === MAIN_WALLET.publicKey);
      
      if (mainWallet && mainWallet.privateKey) {
        console.log(`Found private key for main wallet in wallets.json`);
        return true;
      }
    }
    
    console.log(`Could not find private key for main wallet in wallets.json`);
    return false;
  } catch (error) {
    console.error('Error checking for private key:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('🚀 SETTING UP SYSTEM FOR REAL TRADING');
  console.log('=============================================\n');
  
  try {
    // Check wallet balance
    const balance = await checkWalletBalance(MAIN_WALLET.publicKey);
    
    // Check if we have the private key
    const havePrivateKey = await checkPrivateKeyExists();
    
    // Update system with configuration for main wallet
    console.log('\n🔄 Updating system configuration for main wallet...');
    
    // Update Nexus configuration
    updateNexusConfig();
    
    // Update system memory
    updateSystemMemory();
    
    // Update wallets.json
    updateWalletsJson();
    
    console.log('\n✅ SYSTEM CONFIGURED FOR REAL TRADING');
    console.log(`Trading wallet: ${MAIN_WALLET.publicKey}`);
    console.log(`Wallet balance: ${balance} SOL`);
    console.log(`RPC endpoint: ${RPC_URL} (limited to 60 requests/minute)`);
    
    if (!havePrivateKey) {
      console.log(`\n⚠️ WARNING: Private key not found for the main wallet.`);
      console.log(`The system can view this wallet but cannot sign transactions.`);
      console.log(`To enable real trading, you need to either:`);
      console.log(`1. Provide the private key for this wallet`);
      console.log(`2. Or use a different wallet where you have the private key`);
    }
    
    console.log('\nStart the trading system with:');
    console.log('npx tsx server/index.ts');
    console.log('=============================================');
    
    return true;
  } catch (error) {
    console.error('Error setting up system for real trading:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run the script
main();