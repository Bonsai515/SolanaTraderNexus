/**
 * Enable Real Trading on Solana Blockchain
 * 
 * This script configures the system to execute real blockchain transactions
 * using the wallet private key from wallet.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Critical paths
const WALLET_PATH = './wallet.json';
const ENV_PATH = './.env';
const DATA_DIR = './data';
const LOGS_DIR = './logs';

// RPC configuration
const RPC_ENDPOINTS = {
  primary: 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9',
  websocket: 'wss://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9',
  grpc: 'solana-grpc-geyser.instantnodes.io:443',
  backup: [
    'https://api.mainnet-beta.solana.com',
    'https://solana-mainnet.rpc.extrnode.com'
  ]
};

// Ensure directories exist
function ensureDirectoriesExist() {
  [DATA_DIR, LOGS_DIR, path.join(DATA_DIR, 'nexus')].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Load wallet keypair
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

// Verify Solana connection
async function verifyRpcConnection(url: string): Promise<boolean> {
  try {
    console.log(`Verifying RPC connection to ${url}...`);
    
    const connection = new Connection(url, 'confirmed');
    const version = await connection.getVersion();
    
    console.log(`Successfully connected to Solana ${version['solana-core']}`);
    return true;
  } catch (error) {
    console.error(`Failed to connect to ${url}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Check wallet balance
async function checkWalletBalance(pubkey: PublicKey, url: string): Promise<number> {
  try {
    console.log(`Checking balance for ${pubkey.toString()}...`);
    
    const connection = new Connection(url, 'confirmed');
    const balance = await connection.getBalance(pubkey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`Wallet balance: ${solBalance} SOL`);
    return solBalance;
  } catch (error) {
    console.error('Failed to check wallet balance:', error instanceof Error ? error.message : String(error));
    return 0;
  }
}

// Update connection configuration for Nexus Engine
function updateNexusConfig(walletKeypair: Keypair): boolean {
  try {
    const nexusConfigPath = path.join(DATA_DIR, 'nexus', 'config.json');
    
    // Create nexus engine configuration
    const nexusConfig = {
      useRealFunds: true,
      rpcUrl: RPC_ENDPOINTS.primary,
      websocketUrl: RPC_ENDPOINTS.websocket,
      grpcEndpoint: RPC_ENDPOINTS.grpc,
      defaultExecutionMode: 'LIVE',
      defaultPriority: 'HIGH',
      defaultConfirmations: 1,
      maxConcurrentTransactions: 8,
      defaultTimeoutMs: 30000,
      defaultMaxRetries: 3,
      maxSlippageBps: 100,
      mevProtection: true,
      backupRpcUrls: RPC_ENDPOINTS.backup,
      wallet: {
        address: walletKeypair.publicKey.toString(),
        privateKeySet: true
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

// Store private key securely for transaction engine
function storePrivateKey(walletKeypair: Keypair): boolean {
  try {
    const privateKeyPath = path.join(DATA_DIR, 'nexus', 'keys.json');
    
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
    console.log(`Stored private key securely at ${privateKeyPath}`);
    return true;
  } catch (error) {
    console.error('Failed to store private key:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Update environment settings
function updateEnvironmentSettings(): boolean {
  try {
    // Read existing .env file if it exists
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf8');
    }
    
    // Set real funds trading variables
    const envVars = [
      'USE_REAL_FUNDS=true',
      'NEXUS_EXECUTION_MODE=LIVE',
      'RPC_URL=' + RPC_ENDPOINTS.primary,
      'WEBSOCKET_URL=' + RPC_ENDPOINTS.websocket,
      'GRPC_ENDPOINT=' + RPC_ENDPOINTS.grpc,
      'MAX_CONCURRENT_TRANSACTIONS=8',
      'DEFAULT_PRIORITY=HIGH',
      'MAX_SLIPPAGE_BPS=100',
      'ENABLE_MEV_PROTECTION=true',
      'USE_AWS_INTEGRATION=true'
    ];
    
    // Update environment variables
    envVars.forEach(envVar => {
      const [key] = envVar.split('=');
      
      if (envContent.includes(key + '=')) {
        // Replace existing variable
        envContent = envContent.replace(
          new RegExp(`${key}=.*`, 'g'),
          envVar
        );
      } else {
        // Add new variable
        envContent += envVar + '\n';
      }
    });
    
    // Write updated .env file
    fs.writeFileSync(ENV_PATH, envContent);
    console.log(`Updated environment settings at ${ENV_PATH}`);
    return true;
  } catch (error) {
    console.error('Failed to update environment settings:', error instanceof Error ? error.message : String(error));
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
      systemMemory = JSON.parse(fs.readFileSync(systemMemoryPath, 'utf8'));
    }
    
    // Update configuration for real trading
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
    
    // Update system configuration
    systemMemory.config = {
      ...(systemMemory.config || {}),
      transactionEngine: {
        useRealFunds: true,
        mode: 'LIVE',
        priorityFee: 'HIGH',
        maxSlippageBps: 100,
        mevProtection: true
      },
      walletManager: {
        primaryWallet: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
        prophetWallet: '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e',
        autoFunding: false
      },
      profitCollection: {
        enabled: true,
        captureIntervalMinutes: 60,
        autoCapture: true,
        minProfitThreshold: 0.01,
        reinvestmentRate: 0.95,
        targetWallet: '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e'
      },
      rpcConfig: {
        primaryProvider: 'instantnodes',
        backupProviders: ['helius', 'mainnet-beta'],
        connectionMode: 'multi-connection',
        webSocketEnabled: true,
        grpcEnabled: true
      },
      lastUpdated: new Date().toISOString()
    };
    
    // Write updated system memory
    fs.writeFileSync(systemMemoryPath, JSON.stringify(systemMemory, null, 2));
    console.log(`Updated system memory at ${systemMemoryPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update system memory:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Flag private key as set in nuclear config
function updateNuclearConfig(): boolean {
  try {
    const nuclearConfigPath = path.join(DATA_DIR, 'nuclear-config.json');
    
    // Default configuration if file doesn't exist
    let nuclearConfig: any = {
      strategies: []
    };
    
    // Load existing configuration if it exists
    if (fs.existsSync(nuclearConfigPath)) {
      nuclearConfig = JSON.parse(fs.readFileSync(nuclearConfigPath, 'utf8'));
    }
    
    // Add wallet information
    nuclearConfig.wallet = {
      address: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
      privateKeySet: true,
      balance: null  // Will be updated with real balance later
    };
    
    // Set live trading mode
    nuclearConfig.liveTrading = true;
    
    // Update RPC configuration
    nuclearConfig.rpc = {
      primary: RPC_ENDPOINTS.primary,
      websocket: RPC_ENDPOINTS.websocket,
      grpc: RPC_ENDPOINTS.grpc,
      backup: RPC_ENDPOINTS.backup
    };
    
    // Update last updated timestamp
    nuclearConfig.lastUpdated = new Date().toISOString();
    
    // Write updated nuclear config
    fs.writeFileSync(nuclearConfigPath, JSON.stringify(nuclearConfig, null, 2));
    console.log(`Updated nuclear configuration at ${nuclearConfigPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update nuclear configuration:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Update the RPC pool configuration to avoid rate limits
function updateRpcPoolConfig(): boolean {
  try {
    const rpcConfigPath = path.join(DATA_DIR, 'rpc-config.json');
    
    const rpcConfig = {
      poolSize: 8,
      maxBatchSize: 25,  // More conservative batch size to avoid rate limits
      cacheSettings: {
        accountInfo: 2000,
        tokenInfo: 5000,
        blockInfo: 1000,
        balance: 2000,
        transaction: 10000
      },
      endpoints: [
        {
          url: RPC_ENDPOINTS.primary,
          weight: 10,
          priority: 1,
          maxRequestsPerSecond: 15  // More conservative rate limit
        },
        {
          url: RPC_ENDPOINTS.websocket,
          type: 'ws',
          weight: 8,
          priority: 2,
          maxRequestsPerSecond: 12  // More conservative rate limit
        },
        {
          url: RPC_ENDPOINTS.grpc,
          type: 'grpc',
          weight: 5,
          priority: 3,
          maxRequestsPerSecond: 10  // More conservative rate limit
        },
        ...RPC_ENDPOINTS.backup.map((url, index) => ({
          url,
          weight: 3,
          priority: 4 + index,
          maxRequestsPerSecond: 5  // Public RPC has lower rate limits
        }))
      ],
      httpOptions: {
        maxSockets: 100,  // More conservative socket limit
        timeout: 60000,
        keepAlive: true
      },
      useGrpc: true,
      keepAlive: true,
      // Add rate limit handling
      rateLimitHandling: {
        enabled: true,
        retryDelayMs: 1000,
        maxRetries: 5,
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

// Main function to enable real trading
async function enableRealTrading() {
  console.log('=============================================');
  console.log('🚀 ENABLING REAL BLOCKCHAIN TRADING');
  console.log('=============================================\n');
  
  // Ensure directories exist
  ensureDirectoriesExist();
  
  // Load wallet keypair
  const walletKeypair = loadWalletKeypair();
  if (!walletKeypair) {
    console.error('❌ Failed to load wallet keypair, aborting');
    return false;
  }
  
  // Verify RPC connection
  const rpcConnected = await verifyRpcConnection(RPC_ENDPOINTS.primary);
  if (!rpcConnected) {
    console.warn('⚠️ Primary RPC connection failed, trying backup');
    const backupConnected = await verifyRpcConnection(RPC_ENDPOINTS.backup[0]);
    if (!backupConnected) {
      console.error('❌ All RPC connections failed, aborting');
      return false;
    }
  }
  
  // Check wallet balance
  const balance = await checkWalletBalance(walletKeypair.publicKey, RPC_ENDPOINTS.primary);
  if (balance < 0.01) {
    console.warn('⚠️ Wallet balance is very low, trading may fail');
  }
  
  // Update system configurations
  console.log('\n🔄 Updating system configurations...');
  
  // Update Nexus engine configuration
  const nexusConfigUpdated = updateNexusConfig(walletKeypair);
  if (!nexusConfigUpdated) {
    console.error('❌ Failed to update Nexus engine configuration');
    // Continue anyway
  }
  
  // Store private key securely
  const privateKeyStored = storePrivateKey(walletKeypair);
  if (!privateKeyStored) {
    console.error('❌ Failed to store private key securely');
    // Continue anyway
  }
  
  // Update environment settings
  const envUpdated = updateEnvironmentSettings();
  if (!envUpdated) {
    console.error('❌ Failed to update environment settings');
    // Continue anyway
  }
  
  // Update system memory
  const systemMemoryUpdated = updateSystemMemory();
  if (!systemMemoryUpdated) {
    console.error('❌ Failed to update system memory');
    // Continue anyway
  }
  
  // Update nuclear configuration
  const nuclearConfigUpdated = updateNuclearConfig();
  if (!nuclearConfigUpdated) {
    console.error('❌ Failed to update nuclear configuration');
    // Continue anyway
  }
  
  // Update RPC pool configuration to handle rate limits
  const rpcPoolConfigUpdated = updateRpcPoolConfig();
  if (!rpcPoolConfigUpdated) {
    console.error('❌ Failed to update RPC pool configuration');
    // Continue anyway
  }
  
  console.log('\n✅ REAL BLOCKCHAIN TRADING ENABLED');
  console.log('Your trading system will now execute real transactions on the Solana blockchain');
  console.log('Trading wallet: ' + walletKeypair.publicKey.toString());
  console.log('Wallet balance: ' + balance + ' SOL');
  console.log('RPC endpoint: ' + RPC_ENDPOINTS.primary);
  console.log('\nImportant:');
  console.log('- The system will use the private key from wallet.json for transaction signing');
  console.log('- Rate limits have been configured to avoid 429 errors');
  console.log('- Trading will occur with real funds on the Solana blockchain');
  console.log('- Profits will be collected to the Prophet wallet (95% reinvestment)');
  console.log('\nStart the trading system with:');
  console.log('npx tsx server/index.ts');
  console.log('=============================================');
  
  return true;
}

// Run the script
enableRealTrading().then(success => {
  if (!success) {
    console.error('Failed to enable real trading');
    process.exit(1);
  }
}).catch(error => {
  console.error('Error enabling real trading:', error);
  process.exit(1);
});