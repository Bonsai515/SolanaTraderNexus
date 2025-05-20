/**
 * Update Main Wallet Configuration
 * 
 * This script updates the system to use the main wallet (that we have access to)
 * and optimizes the trading parameters for tomorrow's upgrades.
 */

import fs from 'fs';
import path from 'path';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { config } from 'dotenv';

// Load environment variables
config();

// Constants
const MAIN_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

// Create backup
function createBackup(): boolean {
  console.log('\nCreating backup of current configuration...');
  
  try {
    // Create backup directory
    const backupDir = './backup-' + Date.now();
    fs.mkdirSync(backupDir, { recursive: true });
    
    // Files to backup
    const filesToBackup = [
      'config/wallet-config.json',
      'config/trading-config.json',
      'config/system-config.json',
      'config/transaction-engine.json'
    ];
    
    // Copy files to backup directory
    for (const file of filesToBackup) {
      if (fs.existsSync(file)) {
        // Create directories if needed
        const targetDir = path.dirname(path.join(backupDir, file));
        fs.mkdirSync(targetDir, { recursive: true });
        
        // Copy file
        fs.copyFileSync(file, path.join(backupDir, file));
      }
    }
    
    console.log(`✅ Backup created at ${backupDir}`);
    return true;
  } catch (error) {
    console.error('Error creating backup:', error);
    return false;
  }
}

// Update config files to use main wallet
function updateWalletConfigs(): void {
  console.log('\nUpdating configuration to use main wallet...');
  
  const configFiles = [
    'config/wallet-config.json',
    'config/trading-config.json',
    'config/system-config.json',
    'config/transaction-engine.json'
  ];
  
  let updatedFiles = 0;
  
  for (const file of configFiles) {
    if (fs.existsSync(file)) {
      console.log(`Updating ${file}...`);
      
      try {
        const config = JSON.parse(fs.readFileSync(file, 'utf-8'));
        
        // Update wallet address fields
        if (config.walletAddress !== undefined) {
          config.walletAddress = MAIN_WALLET_ADDRESS;
          updatedFiles++;
        }
        
        if (config.tradingWalletAddress !== undefined) {
          config.tradingWalletAddress = MAIN_WALLET_ADDRESS;
          updatedFiles++;
        }
        
        if (config.activeWalletAddress !== undefined) {
          config.activeWalletAddress = MAIN_WALLET_ADDRESS;
          updatedFiles++;
        }
        
        if (config.systemWalletAddress !== undefined) {
          config.systemWalletAddress = MAIN_WALLET_ADDRESS;
          updatedFiles++;
        }
        
        // If wallets array exists, make sure main wallet is set as active
        if (Array.isArray(config.wallets)) {
          // Filter out main wallet if already exists
          config.wallets = config.wallets.filter(
            (wallet: any) => wallet.address !== MAIN_WALLET_ADDRESS && wallet.publicKey !== MAIN_WALLET_ADDRESS
          );
          
          // Add main wallet
          config.wallets.push({
            address: MAIN_WALLET_ADDRESS,
            label: 'Main Trading Wallet',
            active: true
          });
          
          updatedFiles++;
        }
        
        // Save updated config
        fs.writeFileSync(file, JSON.stringify(config, null, 2));
        console.log(`✅ Updated ${file}`);
      } catch (error) {
        console.error(`Error updating ${file}:`, error);
      }
    }
  }
  
  console.log(`Updated ${updatedFiles} configuration files`);
}

// Create smaller trade sizes based on wallet balance
async function updateTradeSizes(): Promise<void> {
  console.log('\nUpdating trade sizes based on wallet balance...');
  
  try {
    // Check main wallet balance
    const connection = new Connection(RPC_URL);
    const publicKey = new PublicKey(MAIN_WALLET_ADDRESS);
    const balance = await connection.getBalance(publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    
    console.log(`Main wallet balance: ${balanceSOL.toFixed(6)} SOL`);
    
    // Update strategy configs with appropriate trade sizes
    const strategyFiles = [
      'config/ultimate-nuclear-config.json',
      'config/quantum-flash-config.json',
      'config/zero-capital-flash-config.json',
      'config/mev-protection-flash-config.json',
      'config/temporal-block-strategy.json',
      'config/hyperion-cascade-flash-config.json'
    ];
    
    for (const file of strategyFiles) {
      if (fs.existsSync(file)) {
        try {
          const config = JSON.parse(fs.readFileSync(file, 'utf-8'));
          
          // Update max position size
          if (config.maxPositionSizePercent !== undefined) {
            // Set to 30% of wallet for safer trading with small balance
            config.maxPositionSizePercent = 30;
          }
          
          // Update min profit threshold based on balance
          if (config.minProfitThresholdUSD !== undefined) {
            // Lower the minimum profit threshold for smaller balance
            config.minProfitThresholdUSD = 0.25;
          }
          
          if (config.maxPositionSizeSOL !== undefined) {
            // Limit position size to 30% of wallet balance
            config.maxPositionSizeSOL = balanceSOL * 0.3;
          }
          
          // Save updated config
          fs.writeFileSync(file, JSON.stringify(config, null, 2));
          console.log(`✅ Updated ${file}`);
        } catch (error) {
          console.error(`Error updating ${file}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error updating trade sizes:', error);
  }
}

// Create restart script
function createRestartScript(): void {
  console.log('\nCreating restart script...');
  
  const scriptContent = `#!/bin/bash
# Restart trading system with main wallet

echo "========================================"
echo "    RESTARTING TRADING SYSTEM          "
echo "      WITH MAIN WALLET ONLY            "
echo "========================================"
echo

# Stop running processes
echo "Stopping current trading system..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "strategy.ts" || true
sleep 2

# Start with updated configuration
echo "Starting trading system with main wallet..."
./launch-enhanced-system.sh &

echo "System restarted with main wallet only"
echo "========================================"
`;
  
  fs.writeFileSync('restart-main-wallet.sh', scriptContent);
  fs.chmodSync('restart-main-wallet.sh', 0o755); // Make executable
  
  console.log('✅ Created restart script: restart-main-wallet.sh');
}

// Main function
async function main(): Promise<void> {
  console.log('=== UPDATE MAIN WALLET CONFIGURATION ===');
  
  // Create backup
  const backupCreated = createBackup();
  if (!backupCreated) {
    console.error('Failed to create backup. Aborting.');
    return;
  }
  
  // Update configuration to use main wallet
  updateWalletConfigs();
  
  // Update trade sizes based on wallet balance
  await updateTradeSizes();
  
  // Create restart script
  createRestartScript();
  
  console.log('\n=== CONFIGURATION UPDATE COMPLETE ===');
  console.log('System is now configured to use your main wallet only.');
  console.log('Tomorrow when you add more SOL and the premium RPC:');
  console.log('1. The system will automatically detect the increased balance');
  console.log('2. The premium RPC will allow higher frequency trading');
  
  console.log('\nTo restart the system with this configuration, run:');
  console.log('./restart-main-wallet.sh');
  
  // Auto-restart the system
  console.log('\nAutomatically restarting system in 5 seconds...');
  setTimeout(() => {
    try {
      const { exec } = require('child_process');
      exec('./restart-main-wallet.sh', (error: any, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error restarting system: ${error}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing restart script:', error);
    }
  }, 5000);
}

// Run the main function
main().catch(console.error);