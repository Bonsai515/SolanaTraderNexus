/**
 * Setup Nexus Pro Engine with HP Wallet and Syndica
 * 
 * This script configures the Nexus Pro Engine to specifically use:
 * 1. HP wallet (HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK) exclusively
 * 2. Syndica as the primary (and only) RPC provider
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

console.log('=== SETTING UP NEXUS PRO ENGINE ===');

// Constants
const HP_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const HX_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
const CONFIG_DIR = './config';
const NEXUS_CONFIG_DIR = path.join(CONFIG_DIR, 'nexus');

// Create config directories if needed
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

if (!fs.existsSync(NEXUS_CONFIG_DIR)) {
  fs.mkdirSync(NEXUS_CONFIG_DIR, { recursive: true });
}

// Create Nexus Pro Engine configuration
console.log('Creating Nexus Pro Engine configuration...');
const nexusConfig = {
  version: "2.0.0",
  name: "Nexus Pro Engine",
  wallet: {
    address: HP_WALLET,
    useRealFunds: true
  },
  rpc: {
    primary: "https://solana-api.syndica.io/rpc",
    backup: null,
    websocket: "wss://solana-api.syndica.io/rpc",
    useStreaming: true
  },
  performance: {
    maxConcurrentTransactions: 3,
    retryAttempts: 3,
    caching: {
      enabled: true,
      ttlSeconds: 300
    },
    batchProcessing: {
      enabled: true,
      maxBatchSize: 5
    }
  },
  logging: {
    level: "info",
    persistToDisk: true,
    showTimestamps: true
  },
  safety: {
    maxTransactionValueUSD: 10,
    emergencyShutdownOnFailures: true,
    simulateBeforeExecute: true
  },
  strategies: {
    enabled: [
      "hyperion",
      "quantum-omega",
      "singularity"
    ],
    priority: [
      "hyperion",
      "quantum-omega",
      "singularity"
    ]
  }
};

// Save Nexus configuration
const NEXUS_CONFIG_PATH = path.join(NEXUS_CONFIG_DIR, 'nexus-pro-config.json');
fs.writeFileSync(NEXUS_CONFIG_PATH, JSON.stringify(nexusConfig, null, 2));
console.log('✅ Created Nexus Pro Engine configuration');

// Configure clean .env file for Nexus Pro Engine
console.log('Creating clean environment configuration...');
const envConfig = `# Nexus Pro Engine Configuration
# Created at ${new Date().toISOString()}

# Wallet Configuration
SYSTEM_WALLET=${HP_WALLET}
TRADING_WALLET=${HP_WALLET}
MAIN_WALLET=${HP_WALLET}
WALLET_ADDRESS=${HP_WALLET}

# RPC Configuration
RPC_URL=https://solana-api.syndica.io/rpc
SOLANA_RPC=https://solana-api.syndica.io/rpc
WEBSOCKET_URL=wss://solana-api.syndica.io/rpc
USE_SYNDICA=true
USE_INSTANT_NODES=false
PRIMARY_PROVIDER=syndica
DISABLE_INSTANT_NODES=true

# Feature Flags
USE_REAL_FUNDS=true
USE_WALLET_OVERRIDE=true
RATE_LIMIT_FIX=true
USE_AGGRESSIVE_CACHING=true

# Nexus Pro Engine
USE_NEXUS_PRO=true
NEXUS_CONFIG_PATH=${NEXUS_CONFIG_PATH}
`;

fs.writeFileSync('./.env.nexus-pro', envConfig);
console.log('✅ Created clean environment configuration');

// Create launch script for Nexus Pro Engine
console.log('Creating Nexus Pro Engine launch script...');
const launchScript = `#!/bin/bash
# Launch Nexus Pro Engine

echo "========================================"
echo "    LAUNCHING NEXUS PRO ENGINE         "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Set environment variables
export SYSTEM_WALLET=${HP_WALLET}
export TRADING_WALLET=${HP_WALLET}
export MAIN_WALLET=${HP_WALLET}
export WALLET_ADDRESS=${HP_WALLET}
export RPC_URL=https://solana-api.syndica.io/rpc
export SOLANA_RPC=https://solana-api.syndica.io/rpc
export WEBSOCKET_URL=wss://solana-api.syndica.io/rpc
export USE_SYNDICA=true
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export DISABLE_INSTANT_NODES=true
export USE_REAL_FUNDS=true
export USE_WALLET_OVERRIDE=true
export RATE_LIMIT_FIX=true
export USE_AGGRESSIVE_CACHING=true
export USE_NEXUS_PRO=true
export NEXUS_CONFIG_PATH=${NEXUS_CONFIG_PATH}

# Launch Nexus Pro Engine
echo "Launching Nexus Pro Engine with HP wallet and Syndica RPC..."
npx tsx activate-live-trading.ts

echo "Nexus Pro Engine launched"
echo "========================================"
`;

fs.writeFileSync('./launch-nexus-pro.sh', launchScript);
fs.chmodSync('./launch-nexus-pro.sh', 0o755);
console.log('✅ Created Nexus Pro Engine launch script at ./launch-nexus-pro.sh');

console.log('\n=== NEXUS PRO ENGINE SETUP COMPLETE ===');
console.log(`Trading wallet set to HP wallet (${HP_WALLET})`);
console.log('RPC provider set to Syndica exclusively');
console.log('To launch the Nexus Pro Engine, run:');
console.log('./launch-nexus-pro.sh');