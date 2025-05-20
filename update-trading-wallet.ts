/**
 * Update Trading Wallet Configuration
 * 
 * This script updates the system to use the HP wallet as the primary trading wallet
 * instead of the HX wallet.
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

// Constants
const TRADING_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const CONFIG_DIR = './config';

console.log('=== UPDATING TRADING WALLET CONFIGURATION ===');
console.log(`Setting primary trading wallet to: ${TRADING_WALLET}`);

// Make sure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Update all relevant configuration files
const files = [
  '.env',
  '.env.trading',
  '.env.real-trading',
  '.env.force-real',
  '.env.jito',
  '.env.enhanced'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    console.log(`Updating ${file}...`);
    let content = fs.readFileSync(file, 'utf8');
    
    // Update wallet addresses
    content = content.replace(/SYSTEM_WALLET=.*$/gm, `SYSTEM_WALLET=${TRADING_WALLET}`);
    content = content.replace(/TRADING_WALLET=.*$/gm, `TRADING_WALLET=${TRADING_WALLET}`);
    content = content.replace(/MAIN_WALLET=.*$/gm, `MAIN_WALLET=${TRADING_WALLET}`);
    
    fs.writeFileSync(file, content);
  }
}

// Update RPC configuration
const RPC_CONFIG_PATH = path.join(CONFIG_DIR, 'multi-rpc-config.json');
if (fs.existsSync(RPC_CONFIG_PATH)) {
  console.log('Updating RPC configuration...');
  
  try {
    const rpcConfig = JSON.parse(fs.readFileSync(RPC_CONFIG_PATH, 'utf8'));
    
    // Update main wallet address
    rpcConfig.mainWalletAddress = TRADING_WALLET;
    
    // Save updated config
    fs.writeFileSync(RPC_CONFIG_PATH, JSON.stringify(rpcConfig, null, 2));
    console.log('✅ Updated RPC configuration');
  } catch (error) {
    console.error('Error updating RPC config:', error);
  }
}

// Update system memory configuration
const SYSTEM_MEMORY_PATH = path.join(CONFIG_DIR, 'system-memory.json');
if (fs.existsSync(SYSTEM_MEMORY_PATH)) {
  console.log('Updating system memory configuration...');
  
  try {
    const systemMemory = JSON.parse(fs.readFileSync(SYSTEM_MEMORY_PATH, 'utf8'));
    
    // Update wallet addresses in system memory
    if (systemMemory.wallets) {
      systemMemory.wallets.main = TRADING_WALLET;
      systemMemory.wallets.trading = TRADING_WALLET;
      systemMemory.wallets.active = TRADING_WALLET;
    }
    
    // Save updated config
    fs.writeFileSync(SYSTEM_MEMORY_PATH, JSON.stringify(systemMemory, null, 2));
    console.log('✅ Updated system memory configuration');
  } catch (error) {
    console.error('Error updating system memory:', error);
  }
}

// Update neural network configuration
const NEURAL_CONFIG_PATH = path.join(CONFIG_DIR, 'neural-network.json');
if (fs.existsSync(NEURAL_CONFIG_PATH)) {
  console.log('Updating neural network configuration...');
  
  try {
    const neuralConfig = JSON.parse(fs.readFileSync(NEURAL_CONFIG_PATH, 'utf8'));
    
    // Update wallet addresses in neural config
    if (neuralConfig.wallets) {
      neuralConfig.wallets.primary = TRADING_WALLET;
      neuralConfig.wallets.secondary = TRADING_WALLET;
    }
    
    // Save updated config
    fs.writeFileSync(NEURAL_CONFIG_PATH, JSON.stringify(neuralConfig, null, 2));
    console.log('✅ Updated neural network configuration');
  } catch (error) {
    console.error('Error updating neural network config:', error);
  }
}

// Create restart script
const restartScript = `#!/bin/bash
# Restart with Updated Trading Wallet

echo "========================================"
echo "    RESTARTING WITH UPDATED WALLET     "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Export environment variables
export SYSTEM_WALLET=${TRADING_WALLET}
export TRADING_WALLET=${TRADING_WALLET}
export MAIN_WALLET=${TRADING_WALLET}
export RATE_LIMIT_FIX=true
export USE_INSTANT_NODES=false
export MAX_REQUESTS_PER_SECOND=10
export USE_AGGRESSIVE_CACHING=true

# Start system
echo "Starting system with updated trading wallet..."
npx tsx activate-live-trading.ts

echo "System restarted with trading wallet: ${TRADING_WALLET}"
echo "========================================"
`;

fs.writeFileSync('./restart-with-updated-wallet.sh', restartScript);
fs.chmodSync('./restart-with-updated-wallet.sh', 0o755);
console.log('✅ Created restart script at ./restart-with-updated-wallet.sh');

console.log('\n=== TRADING WALLET UPDATE COMPLETE ===');
console.log(`Trading wallet set to: ${TRADING_WALLET}`);
console.log('To restart the system with the updated wallet, run:');
console.log('./restart-with-updated-wallet.sh');