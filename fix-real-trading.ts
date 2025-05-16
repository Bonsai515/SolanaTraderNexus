/**
 * Fix Real Trading Configuration for Wallet
 * 
 * This script uses the correct private key from data/wallets.json
 * for the HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb wallet.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Critical paths
const WALLETS_JSON_PATH = './data/wallets.json';
const ENV_PATH = './.env';
const DATA_DIR = './data';
const NEXUS_DIR = path.join(DATA_DIR, 'nexus');

// RPC configuration
const RPC_URL = 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
const WS_URL = 'wss://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
const BACKUP_RPC = 'https://api.mainnet-beta.solana.com';

// Ensure directories exist
if (!fs.existsSync(NEXUS_DIR)) {
  fs.mkdirSync(NEXUS_DIR, { recursive: true });
  console.log(`Created directory: ${NEXUS_DIR}`);
}

// Get the correct wallet
console.log('Loading wallet information from data/wallets.json...');
let walletData;
let tradingWallet;

try {
  walletData = JSON.parse(fs.readFileSync(WALLETS_JSON_PATH, 'utf8'));
  
  // Find the profit collection wallet with the target address
  tradingWallet = walletData.find(w => w.publicKey === 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb');
  
  if (!tradingWallet) {
    console.error('Trading wallet HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb not found in wallets.json');
    process.exit(1);
  }
  
  console.log(`Found trading wallet: ${tradingWallet.publicKey}`);
} catch (error) {
  console.error('Error loading wallet data:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

// Check that the private key exists
if (!tradingWallet.privateKey) {
  console.error('Private key not found for trading wallet');
  process.exit(1);
}

// Create keypair from hex private key
function createKeypairFromHexPrivateKey(hexPrivateKey) {
  const privateKeyBuffer = Buffer.from(hexPrivateKey, 'hex');
  
  if (privateKeyBuffer.length !== 64) {
    throw new Error(`Invalid private key length: ${privateKeyBuffer.length}`);
  }
  
  return Keypair.fromSecretKey(privateKeyBuffer);
}

// Check wallet balance
async function checkWalletBalance(pubkey) {
  try {
    console.log(`Checking balance for ${pubkey}...`);
    
    const connection = new Connection(RPC_URL, 'confirmed');
    const balance = await connection.getBalance(new PublicKey(pubkey));
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`Wallet balance: ${solBalance} SOL`);
    return solBalance;
  } catch (error) {
    console.error('Failed to check wallet balance:', error instanceof Error ? error.message : String(error));
    return 0;
  }
}

// Store private key for transaction engine
function storePrivateKeyForEngine() {
  try {
    const privateKeyPath = path.join(NEXUS_DIR, 'keys.json');
    
    // Create secure key storage file
    const keyData = {
      wallets: [
        {
          address: tradingWallet.publicKey,
          privateKey: tradingWallet.privateKey,
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

// Update Nexus engine configuration
function updateNexusConfig() {
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
      maxConcurrentTransactions: 4, // Lowered from 8 to reduce rate limits
      defaultTimeoutMs: 30000,
      defaultMaxRetries: 3,
      maxSlippageBps: 100,
      mevProtection: true,
      backupRpcUrls: [BACKUP_RPC],
      wallet: {
        address: tradingWallet.publicKey,
        privateKeySet: true
      },
      rateLimitSettings: {
        maxRequestsPerSecond: 12,
        initialBackoffMs: 500,
        maxBackoffMs: 10000,
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

// Update RPC pool configuration
function updateRpcPoolConfig() {
  try {
    const rpcConfigPath = path.join(DATA_DIR, 'rpc-config.json');
    
    const rpcConfig = {
      poolSize: 4, // Lower pool size to avoid rate limits
      maxBatchSize: 10, // Much smaller batch size
      cacheSettings: {
        accountInfo: 5000, // Increased cache times
        tokenInfo: 10000,
        blockInfo: 2000,
        balance: 5000,
        transaction: 15000
      },
      endpoints: [
        {
          url: RPC_URL,
          weight: 10,
          priority: 1,
          maxRequestsPerSecond: 8 // Lower max requests
        },
        {
          url: WS_URL,
          type: 'ws',
          weight: 8,
          priority: 2,
          maxRequestsPerSecond: 6
        },
        {
          url: BACKUP_RPC,
          weight: 3,
          priority: 3,
          maxRequestsPerSecond: 3
        }
      ],
      httpOptions: {
        maxSockets: 50, // Lower socket limit
        timeout: 60000,
        keepAlive: true
      },
      useGrpc: false, // Disable gRPC for now
      keepAlive: true,
      // Enhanced rate limit handling
      rateLimitHandling: {
        enabled: true,
        retryDelayMs: 2000, // Start with 2 second delay
        maxRetries: 10, // More retries
        exponentialBackoff: true,
        backoffMultiplier: 2
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

// Update transaction batch settings
function updateTransactionBatchSettings() {
  try {
    const batchConfigPath = path.join(DATA_DIR, 'transaction-config.json');
    
    const batchConfig = {
      parallelExecutionLimit: 2, // Lower parallel execution
      priorityFeeTiers: {
        LOW: 10000,      // 0.00001 SOL
        MEDIUM: 25000,   // 0.000025 SOL
        HIGH: 100000,    // 0.0001 SOL
        VERY_HIGH: 200000// 0.0002 SOL
      },
      dynamicPriorityFeeEnabled: true,
      precomputePriorityFee: true,
      useLookupTables: false, // Disable for now 
      retryPolicy: {
        maxRetries: 10,          // More retries
        initialBackoffMs: 2000,  // Longer initial backoff
        maxBackoffMs: 60000,     // Max 1 minute
        backoffMultiplier: 2     // Exponential backoff
      },
      blockchainSettings: {
        defaultConfirmationLevel: 'confirmed',
        skipPreflight: false,
        preflightCommitment: 'processed',
        maxSignatureTimeout: 60000,
      },
      optimizedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(batchConfigPath, JSON.stringify(batchConfig, null, 2));
    console.log(`Updated transaction batch settings at ${batchConfigPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update transaction batch settings:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('🚀 FIXING REAL TRADING WITH CORRECT WALLET');
  console.log('=============================================\n');
  
  try {
    // Create keypair from private key to verify
    const keypair = createKeypairFromHexPrivateKey(tradingWallet.privateKey);
    console.log(`Created keypair from private key: ${keypair.publicKey.toString()}`);
    
    if (keypair.publicKey.toString() !== tradingWallet.publicKey) {
      console.error('ERROR: Public key mismatch!');
      console.error(`Derived: ${keypair.publicKey.toString()}`);
      console.error(`Expected: ${tradingWallet.publicKey}`);
      process.exit(1);
    }
    
    // Check wallet balance
    const balance = await checkWalletBalance(tradingWallet.publicKey);
    
    // Store private key for engine
    storePrivateKeyForEngine();
    
    // Update Nexus configuration
    updateNexusConfig();
    
    // Update RPC pool config
    updateRpcPoolConfig();
    
    // Update transaction batch settings
    updateTransactionBatchSettings();
    
    console.log('\n✅ REAL TRADING FIXED WITH CORRECT WALLET');
    console.log(`Trading wallet: ${tradingWallet.publicKey}`);
    console.log(`Wallet balance: ${balance} SOL`);
    console.log(`RPC endpoint: ${RPC_URL}`);
    console.log('\nConfig changes made:');
    console.log('- Set up correct private key for real transactions');
    console.log('- Reduced concurrent operations to avoid rate limits');
    console.log('- Increased retry backoff times');
    console.log('- Enhanced caching to reduce RPC calls');
    console.log('- Configured higher priority fees for faster confirmation');
    console.log('\nStart the trading system with:');
    console.log('npx tsx server/index.ts');
    console.log('=============================================');
  } catch (error) {
    console.error('Error fixing real trading:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();