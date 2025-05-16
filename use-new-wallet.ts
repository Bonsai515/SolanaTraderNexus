/**
 * Configure System to Use New Wallet
 * 
 * This script sets up the trading system with the new wallet
 * address provided by the user for real blockchain trading.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Critical paths
const DATA_DIR = './data';
const NEXUS_DIR = path.join(DATA_DIR, 'nexus');

// New wallet details (provided by user)
const NEW_WALLET = {
  publicKey: 'D8UevDKnp9qk4nLwNGgnEm97NJ6yzFhYzuRr5wkv9HSL',
  label: 'User Provided Wallet'
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
    
    // Load existing configuration if it exists
    let nexusConfig: any = {
      useRealFunds: true,
      rpcUrl: RPC_URL,
      defaultExecutionMode: 'LIVE',
      defaultPriority: 'HIGH',
      defaultConfirmations: 1,
      maxConcurrentTransactions: 1,
      defaultTimeoutMs: 300000,
      defaultMaxRetries: 20,
      maxSlippageBps: 100,
      mevProtection: true,
      backupRpcUrls: [BACKUP_RPC]
    };
    
    if (fs.existsSync(nexusConfigPath)) {
      try {
        nexusConfig = JSON.parse(fs.readFileSync(nexusConfigPath, 'utf8'));
      } catch (e) {
        // Continue with default config if parsing fails
      }
    }
    
    // Update wallet information
    nexusConfig.wallet = {
      address: NEW_WALLET.publicKey,
      privateKeySet: false    // We only have the public key, not the private key
    };
    
    // Update last updated timestamp
    nexusConfig.lastUpdated = new Date().toISOString();
    
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
    
    // Update wallet configuration
    if (!systemMemory.config) {
      systemMemory.config = {};
    }
    
    if (!systemMemory.config.walletManager) {
      systemMemory.config.walletManager = {};
    }
    
    systemMemory.config.walletManager.primaryWallet = NEW_WALLET.publicKey;
    systemMemory.config.walletManager.prophetWallet = NEW_WALLET.publicKey;
    
    // Update transaction engine config
    if (!systemMemory.config.transactionEngine) {
      systemMemory.config.transactionEngine = {};
    }
    
    systemMemory.config.transactionEngine.walletAddress = NEW_WALLET.publicKey;
    
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

// Add wallet to wallets.json
function updateWalletsJson(): boolean {
  try {
    const walletsJsonPath = path.join(DATA_DIR, 'wallets.json');
    
    // Create new wallet object
    const newWallet = {
      type: "TRADING",
      publicKey: NEW_WALLET.publicKey,
      label: NEW_WALLET.label,
      isActive: true,
      profitShare: 100
    };
    
    // Load existing wallets or create new array
    let wallets = [];
    if (fs.existsSync(walletsJsonPath)) {
      try {
        wallets = JSON.parse(fs.readFileSync(walletsJsonPath, 'utf8'));
        
        // Deactivate other trading wallets
        wallets.forEach((wallet: any) => {
          if (wallet.type === 'TRADING') {
            wallet.isActive = false;
          }
        });
      } catch (e) {
        // Continue with empty array if parsing fails
      }
    }
    
    // Check if wallet already exists
    const existingIndex = wallets.findIndex((w: any) => w.publicKey === NEW_WALLET.publicKey);
    
    if (existingIndex >= 0) {
      // Update existing wallet
      wallets[existingIndex] = {
        ...wallets[existingIndex],
        isActive: true
      };
    } else {
      // Add new wallet
      wallets.push(newWallet);
    }
    
    fs.writeFileSync(walletsJsonPath, JSON.stringify(wallets, null, 2));
    console.log(`Updated wallets.json at ${walletsJsonPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update wallets.json:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('🚀 CONFIGURING SYSTEM WITH NEW WALLET');
  console.log('=============================================\n');
  
  try {
    // Check wallet balance
    const balance = await checkWalletBalance(NEW_WALLET.publicKey);
    
    // Update system with configuration for new wallet
    console.log('\n🔄 Updating system configuration for new wallet...');
    
    // Update Nexus configuration
    updateNexusConfig();
    
    // Update system memory
    updateSystemMemory();
    
    // Update wallets.json
    updateWalletsJson();
    
    console.log('\n✅ SYSTEM CONFIGURED WITH NEW WALLET');
    console.log(`Trading wallet: ${NEW_WALLET.publicKey}`);
    console.log(`Wallet balance: ${balance} SOL`);
    console.log(`RPC endpoint: ${RPC_URL} (limited to 60 requests/minute)`);
    console.log(`\n⚠️ NOTE: Only the public key was provided, not the private key.`);
    console.log(`The system can view this wallet but cannot sign transactions.`);
    console.log('\nStart the trading system with:');
    console.log('npx tsx server/index.ts');
    console.log('=============================================');
    
    return true;
  } catch (error) {
    console.error('Error configuring system with new wallet:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run the script
main();