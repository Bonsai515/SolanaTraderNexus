/**
 * Configure System to Use Wallet with Available Private Key
 * 
 * This script sets up the trading system to use the wallet whose private key
 * we have in wallet.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Critical paths
const WALLET_PATH = './wallet.json';
const ENV_PATH = './.env';
const DATA_DIR = './data';
const NEXUS_DIR = path.join(DATA_DIR, 'nexus');

// RPC configuration with rate limits
const RPC_URL = 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
const WS_URL = 'wss://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
const BACKUP_RPC = 'https://api.mainnet-beta.solana.com';

// Ensure directories exist
if (!fs.existsSync(NEXUS_DIR)) {
  fs.mkdirSync(NEXUS_DIR, { recursive: true });
  console.log(`Created directory: ${NEXUS_DIR}`);
}

// Load the wallet keypair from wallet.json
function loadWalletKeypair(): Keypair | null {
  try {
    console.log(`Loading wallet from ${WALLET_PATH}...`);
    
    if (!fs.existsSync(WALLET_PATH)) {
      console.error(`Wallet file not found at ${WALLET_PATH}`);
      return null;
    }
    
    const secretKeyString = fs.readFileSync(WALLET_PATH, 'utf8');
    const secretKey = new Uint8Array(JSON.parse(secretKeyString));
    const keypair = Keypair.fromSecretKey(secretKey);
    
    console.log(`Successfully loaded wallet: ${keypair.publicKey.toString()}`);
    return keypair;
  } catch (error) {
    console.error('Failed to load wallet:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Check wallet balance
async function checkWalletBalance(pubkey: PublicKey): Promise<number> {
  try {
    console.log(`Checking balance for ${pubkey.toString()}...`);
    
    const connection = new Connection(RPC_URL, 'confirmed');
    const balance = await connection.getBalance(pubkey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`Wallet balance: ${solBalance} SOL`);
    return solBalance;
  } catch (error) {
    console.error('Failed to check wallet balance:', error instanceof Error ? error.message : String(error));
    
    // Try with backup RPC
    try {
      console.log(`Trying backup RPC for balance check...`);
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

// Update wallet configuration in system memory
function updateSystemWallet(walletKeypair: Keypair): boolean {
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
    
    // Update system configuration with new wallet
    if (!systemMemory.config) {
      systemMemory.config = {};
    }
    
    if (!systemMemory.config.walletManager) {
      systemMemory.config.walletManager = {};
    }
    
    systemMemory.config.walletManager.primaryWallet = walletKeypair.publicKey.toString();
    systemMemory.config.walletManager.prophetWallet = walletKeypair.publicKey.toString(); // Use same wallet for now
    systemMemory.config.walletManager.hasPrivateKey = true;
    
    // Update transaction engine config
    if (!systemMemory.config.transactionEngine) {
      systemMemory.config.transactionEngine = {};
    }
    
    systemMemory.config.transactionEngine.useRealFunds = true;
    systemMemory.config.transactionEngine.mode = 'LIVE';
    systemMemory.config.transactionEngine.walletAddress = walletKeypair.publicKey.toString();
    
    // Rate limits
    if (!systemMemory.config.rateLimit) {
      systemMemory.config.rateLimit = {};
    }
    
    systemMemory.config.rateLimit.requestsPerMinute = 225;
    systemMemory.config.rateLimit.enabled = true;
    
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

// Store private key for transaction engine
function storePrivateKeyForEngine(walletKeypair: Keypair): boolean {
  try {
    const privateKeyPath = path.join(NEXUS_DIR, 'keys.json');
    
    // Create secure key storage file
    const keyData = {
      wallets: [
        {
          address: walletKeypair.publicKey.toString(),
          privateKey: Buffer.from(walletKeypair.secretKey).toString('hex'),
          type: 'trading'
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

// Update wallet in data/wallets.json
function updateWalletsJson(walletKeypair: Keypair): boolean {
  try {
    const walletsJsonPath = path.join(DATA_DIR, 'wallets.json');
    
    // Default wallet array if file doesn't exist
    let wallets = [];
    
    // Load existing wallets if the file exists
    if (fs.existsSync(walletsJsonPath)) {
      try {
        wallets = JSON.parse(fs.readFileSync(walletsJsonPath, 'utf8'));
      } catch (e) {
        // Continue with empty array if parsing fails
      }
    }
    
    // Create new wallet entry
    const newWallet = {
      type: "TRADING",
      publicKey: walletKeypair.publicKey.toString(),
      privateKey: Buffer.from(walletKeypair.secretKey).toString('hex'),
      label: "Active Trading Wallet",
      isActive: true,
      profitShare: 100
    };
    
    // Check if wallet already exists
    const existingIndex = wallets.findIndex(w => w.publicKey === walletKeypair.publicKey.toString());
    
    if (existingIndex >= 0) {
      // Update existing wallet
      wallets[existingIndex] = {
        ...wallets[existingIndex],
        ...newWallet
      };
    } else {
      // Add new wallet
      wallets.push(newWallet);
    }
    
    // Write updated wallets
    fs.writeFileSync(walletsJsonPath, JSON.stringify(wallets, null, 2));
    console.log(`Updated wallets.json at ${walletsJsonPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update wallets.json:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Update Nexus engine configuration
function updateNexusConfig(walletKeypair: Keypair): boolean {
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
      defaultMaxRetries: 5,
      maxSlippageBps: 100,
      mevProtection: true,
      backupRpcUrls: [BACKUP_RPC],
      wallet: {
        address: walletKeypair.publicKey.toString(),
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
        accountInfo: 10000,
        tokenInfo: 30000,
        blockInfo: 5000,
        balance: 10000,
        transaction: 30000
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

// Main function
async function main() {
  console.log('=============================================');
  console.log('🚀 CONFIGURING SYSTEM WITH AVAILABLE WALLET');
  console.log('=============================================\n');
  
  try {
    // Load wallet keypair
    const walletKeypair = loadWalletKeypair();
    if (!walletKeypair) {
      console.error('❌ Failed to load wallet keypair, aborting');
      return false;
    }
    
    // Check wallet balance
    const balance = await checkWalletBalance(walletKeypair.publicKey);
    
    // Update system wallet
    updateSystemWallet(walletKeypair);
    
    // Store private key for engine
    storePrivateKeyForEngine(walletKeypair);
    
    // Update wallets.json
    updateWalletsJson(walletKeypair);
    
    // Update Nexus configuration
    updateNexusConfig(walletKeypair);
    
    // Update RPC pool config with rate limits
    updateRpcPoolConfig();
    
    console.log('\n✅ SYSTEM CONFIGURED WITH AVAILABLE WALLET');
    console.log(`Trading wallet: ${walletKeypair.publicKey.toString()}`);
    console.log(`Wallet balance: ${balance} SOL`);
    console.log(`RPC endpoint: ${RPC_URL} (limited to 225 requests/minute)`);
    console.log('\nConfig changes made:');
    console.log('- Set up wallet with available private key');
    console.log('- Configured rate limits to 225 requests/minute');
    console.log('- Reduced concurrent operations to prevent rate limit errors');
    console.log('- Enhanced caching to minimize RPC calls');
    console.log('\nStart the trading system with:');
    console.log('npx tsx server/index.ts');
    console.log('=============================================');
    
    return true;
  } catch (error) {
    console.error('Error configuring system:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run the script
main();