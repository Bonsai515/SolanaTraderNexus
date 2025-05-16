/**
 * Configure System to Use Trading Wallet 1
 * 
 * This script sets up the trading system to use Trading Wallet 1
 * from data/wallets.json where we have a confirmed matching private key.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Critical paths
const ENV_PATH = './.env';
const DATA_DIR = './data';
const NEXUS_DIR = path.join(DATA_DIR, 'nexus');

// Trading wallet details
const TRADING_WALLET = {
  publicKey: '2qPJQ6fMWxNH4p8hjhqonJt1Fy4okf7ToDV4Z6nGLddm',
  privateKey: '9fb95840b9bbeea045044f859cf74639fce71e78c1c95e23411b261ab343f1611b40c7c97815e628bbea174eba13763f6d4c8b6d5659d81098b97b62dcd98dac',
  label: 'Trading Wallet 1 (95% reinvestment)'
};

// RPC configuration with rate limits
const RPC_URL = 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
const WS_URL = 'wss://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
const BACKUP_RPC = 'https://api.mainnet-beta.solana.com';

// Ensure directories exist
if (!fs.existsSync(NEXUS_DIR)) {
  fs.mkdirSync(NEXUS_DIR, { recursive: true });
  console.log(`Created directory: ${NEXUS_DIR}`);
}

// Create keypair from hex private key
function createKeypairFromHexPrivateKey(hexPrivateKey: string): Keypair {
  try {
    const privateKeyBuffer = Buffer.from(hexPrivateKey, 'hex');
    
    if (privateKeyBuffer.length !== 64) {
      throw new Error(`Invalid private key length: ${privateKeyBuffer.length}`);
    }
    
    return Keypair.fromSecretKey(privateKeyBuffer);
  } catch (error) {
    console.error('Failed to create keypair:', error instanceof Error ? error.message : String(error));
    throw error;
  }
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

// Store private key for transaction engine
function storePrivateKeyForNexusEngine(): boolean {
  try {
    const privateKeyPath = path.join(NEXUS_DIR, 'keys.json');
    
    // Create secure key storage file
    const keyData = {
      wallets: [
        {
          address: TRADING_WALLET.publicKey,
          privateKey: TRADING_WALLET.privateKey,
          type: 'trading',
          label: TRADING_WALLET.label
        }
      ],
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(privateKeyPath, JSON.stringify(keyData, null, 2));
    console.log(`Stored private key at ${privateKeyPath}`);
    return true;
  } catch (error) {
    console.error('Failed to store private key:', error instanceof Error ? error.message : String(error));
    return false;
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
      websocketUrl: WS_URL,
      defaultExecutionMode: 'LIVE',
      defaultPriority: 'HIGH',
      defaultConfirmations: 1,
      maxConcurrentTransactions: 2, // Low concurrency for rate limits
      defaultTimeoutMs: 60000,
      defaultMaxRetries: 3,
      maxSlippageBps: 100,
      mevProtection: true,
      backupRpcUrls: [BACKUP_RPC],
      wallet: {
        address: TRADING_WALLET.publicKey,
        privateKeySet: true
      },
      rateLimitSettings: {
        maxRequestsPerMinute: 225,
        maxRequestsPerSecond: Math.floor(225 / 60),
        initialBackoffMs: 5000,
        maxBackoffMs: 60000,
        backoffMultiplier: 2,
        retryOnRateLimit: true
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
    
    systemMemory.config.walletManager.primaryWallet = TRADING_WALLET.publicKey;
    systemMemory.config.walletManager.prophetWallet = '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e';
    systemMemory.config.walletManager.hasPrivateKey = true;
    
    // Update transaction engine config
    if (!systemMemory.config.transactionEngine) {
      systemMemory.config.transactionEngine = {};
    }
    
    systemMemory.config.transactionEngine.useRealFunds = true;
    systemMemory.config.transactionEngine.mode = 'LIVE';
    systemMemory.config.transactionEngine.walletAddress = TRADING_WALLET.publicKey;
    
    // Rate limits
    if (!systemMemory.config.rateLimit) {
      systemMemory.config.rateLimit = {};
    }
    
    systemMemory.config.rateLimit.requestsPerMinute = 225;
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
      maxRequestsPerMinute: 225
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

// Update RPC pool configuration with rate limit
function updateRpcPoolConfig(): boolean {
  try {
    const rpcConfigPath = path.join(DATA_DIR, 'rpc-config.json');
    
    // 225 requests per minute = 3.75 requests per second
    const rateLimit = Math.floor(225 / 60);
    
    const rpcConfig = {
      poolSize: 2,
      maxBatchSize: 5,
      cacheSettings: {
        accountInfo: 10000,  // 10s
        tokenInfo: 30000,    // 30s
        blockInfo: 5000,     // 5s
        balance: 10000,      // 10s
        transaction: 30000   // 30s
      },
      endpoints: [
        {
          url: RPC_URL,
          weight: 10,
          priority: 1,
          maxRequestsPerSecond: rateLimit,
          minuteLimit: 225
        },
        {
          url: BACKUP_RPC,
          weight: 2,
          priority: 2,
          maxRequestsPerSecond: 2
        }
      ],
      httpOptions: {
        maxSockets: 25,
        timeout: 60000,
        keepAlive: true
      },
      useGrpc: false,
      keepAlive: true,
      rateLimitHandling: {
        enabled: true,
        retryDelayMs: 5000,
        maxRetries: 15,
        exponentialBackoff: true,
        backoffMultiplier: 2,
        requestTracking: {
          enabled: true,
          windowMs: 60000,
          maxRequests: 225
        }
      },
      optimizedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(rpcConfigPath, JSON.stringify(rpcConfig, null, 2));
    console.log(`Updated RPC pool configuration at ${rpcConfigPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update RPC pool configuration:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Update transaction configuration
function updateTransactionConfig(): boolean {
  try {
    const txConfigPath = path.join(DATA_DIR, 'transaction-config.json');
    
    const txConfig = {
      parallelExecutionLimit: 2, // Low parallelism
      priorityFeeTiers: {
        LOW: 10000,      // 0.00001 SOL
        MEDIUM: 50000,   // 0.00005 SOL
        HIGH: 100000,    // 0.0001 SOL
        VERY_HIGH: 200000// 0.0002 SOL
      },
      dynamicPriorityFeeEnabled: true,
      precomputePriorityFee: true,
      useLookupTables: false,
      retryPolicy: {
        maxRetries: 10,         // More retries
        initialBackoffMs: 5000, // Start with 5 seconds
        maxBackoffMs: 60000,    // Up to 1 minute
        backoffMultiplier: 2    // Exponential backoff
      },
      rateLimit: {
        requestsPerMinute: 225,
        enabled: true,
        strictEnforcement: true,
        distributedEnforcement: true
      },
      optimizedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(txConfigPath, JSON.stringify(txConfig, null, 2));
    console.log(`Updated transaction configuration at ${txConfigPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update transaction configuration:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Update strategy configuration
function updateStrategyConfig(): boolean {
  try {
    const strategyConfigPath = path.join(DATA_DIR, 'strategy-config.json');
    
    const strategyConfig = {
      parallelExecution: false, // Disable parallel execution to respect rate limits
      asyncSignalProcessing: true,
      backgroundProcessing: true,
      maxStrategiesPerBlock: 1,  // Only 1 strategy per block
      signalBufferSize: 20,      // Small buffer size
      preemptivePositionSizing: true,
      smartOrderRouting: true,
      memoryBufferSizeMB: 256,   // Lower memory buffer
      throttling: {
        enabled: true,
        maxSignalsPerMinute: 10, // Limit signals to avoid RPC overload
        maxExecutionsPerMinute: 3, // Limit executions (225/60 = ~3.75)
        minTimeBetweenSignalsMs: 6000, // 6 seconds between signals
        minTimeBetweenExecutionsMs: 20000 // 20 seconds between executions
      },
      optimizedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(strategyConfigPath, JSON.stringify(strategyConfig, null, 2));
    console.log(`Updated strategy configuration at ${strategyConfigPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update strategy configuration:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Update wallets.json to ensure trading wallet is active
function updateWalletsJson(): boolean {
  try {
    const walletsJsonPath = path.join(DATA_DIR, 'wallets.json');
    
    if (fs.existsSync(walletsJsonPath)) {
      const wallets = JSON.parse(fs.readFileSync(walletsJsonPath, 'utf8'));
      
      // Update wallet activation status
      wallets.forEach((wallet: any) => {
        if (wallet.publicKey === TRADING_WALLET.publicKey) {
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

// Main function
async function main() {
  console.log('=============================================');
  console.log('🚀 CONFIGURING SYSTEM WITH TRADING WALLET 1');
  console.log('=============================================\n');
  
  try {
    // Create keypair from private key to verify
    console.log('Verifying private key...');
    const keypair = createKeypairFromHexPrivateKey(TRADING_WALLET.privateKey);
    
    if (keypair.publicKey.toString() !== TRADING_WALLET.publicKey) {
      console.error('ERROR: Public key mismatch!');
      console.error(`Derived: ${keypair.publicKey.toString()}`);
      console.error(`Expected: ${TRADING_WALLET.publicKey}`);
      return false;
    }
    
    console.log(`✅ Private key verified successfully for ${TRADING_WALLET.publicKey}`);
    
    // Check wallet balance
    const balance = await checkWalletBalance(TRADING_WALLET.publicKey);
    
    // Update system with configuration for trading wallet
    console.log('\n🔄 Updating system configuration for trading wallet...');
    
    // Store private key for transaction engine
    storePrivateKeyForNexusEngine();
    
    // Update Nexus configuration
    updateNexusConfig();
    
    // Update system memory
    updateSystemMemory();
    
    // Update RPC pool config
    updateRpcPoolConfig();
    
    // Update transaction config
    updateTransactionConfig();
    
    // Update strategy config
    updateStrategyConfig();
    
    // Update wallets.json
    updateWalletsJson();
    
    console.log('\n✅ SYSTEM CONFIGURED WITH TRADING WALLET 1');
    console.log(`Trading wallet: ${TRADING_WALLET.publicKey}`);
    console.log(`Wallet balance: ${balance} SOL`);
    console.log(`RPC endpoint: ${RPC_URL} (limited to 225 requests/minute)`);
    console.log('\nConfig changes made:');
    console.log('- Set up Trading Wallet 1 for real blockchain trading');
    console.log('- Configured rate limits to 225 requests/minute');
    console.log('- Reduced parallel operations to prevent rate limit errors');
    console.log('- Increased transaction caching to minimize RPC calls');
    console.log('- Configured 95% profit reinvestment with 5% to Prophet wallet');
    console.log('\nStart the trading system with:');
    console.log('npx tsx server/index.ts');
    console.log('=============================================');
    
    return true;
  } catch (error) {
    console.error('Error configuring system with trading wallet:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run the script
main();