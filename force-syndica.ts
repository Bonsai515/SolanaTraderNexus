/**
 * Force Syndica RPC Configuration
 * 
 * This script creates a direct configuration for using only
 * the Syndica RPC provider with your HP wallet.
 */

import fs from 'fs';
import path from 'path';

// Constants
const HP_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const SYNDICA_URL = 'https://solana-api.syndica.io/rpc';
const SYNDICA_WS = 'wss://solana-api.syndica.io/rpc';

console.log('=== CREATING SYNDICA-ONLY CONFIGURATION ===');

// Create direct configuration file for Syndica
const syndicaConfig = {
  wallet: {
    address: HP_WALLET,
    useRealFunds: true
  },
  rpc: {
    provider: 'syndica',
    url: SYNDICA_URL,
    websocketUrl: SYNDICA_WS
  },
  caching: {
    enabled: true,
    ttlSeconds: 300 // 5 minute TTL for all cached items
  },
  rateLimit: {
    enabled: true,
    requestsPerSecond: 2, // Very conservative
    maxBurst: 5
  },
  trading: {
    enabled: true,
    strategies: [
      "hyperion", 
      "quantum-omega", 
      "singularity"
    ]
  }
};

// Ensure config directory exists
if (!fs.existsSync('./config')) {
  fs.mkdirSync('./config', { recursive: true });
}

// Write the Syndica-only configuration
fs.writeFileSync('./config/syndica-only.json', JSON.stringify(syndicaConfig, null, 2));
console.log('✅ Created Syndica-only configuration file');

// Create a Bash launcher script
const launchScript = `#!/bin/bash
# Force Syndica RPC Launcher

echo "========================================"
echo "    LAUNCHING WITH SYNDICA ONLY MODE    "
echo "========================================"

# Stop any running processes
pkill -f "ts-node" || true
pkill -f "tsx" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Set all necessary environment variables
export SYSTEM_WALLET=${HP_WALLET}
export TRADING_WALLET=${HP_WALLET}
export MAIN_WALLET=${HP_WALLET}
export WALLET_ADDRESS=${HP_WALLET}
export RPC_URL=${SYNDICA_URL}
export SOLANA_RPC=${SYNDICA_URL}
export WEBSOCKET_URL=${SYNDICA_WS}
export USE_SYNDICA=true
export USE_ALCHEMY=false
export USE_HELIUS=false
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export DISABLE_INSTANT_NODES=true
export DISABLE_MULTI_PROVIDER=true
export FORCE_SYNDICA_ONLY=true
export SYNDICA_CONFIG_PATH="./config/syndica-only.json"
export USE_REAL_FUNDS=true

# Launch trading with Syndica only
echo "Launching trading system with Syndica only..."
npx tsx activate-live-trading.ts

echo "System launched with Syndica only"
echo "========================================"
`;

fs.writeFileSync('./force-syndica.sh', launchScript);
fs.chmodSync('./force-syndica.sh', 0o755);
console.log('✅ Created Syndica-only launcher script');

// Create optimized environment file
const envConfig = `# Syndica-Only Environment Configuration
# Created at ${new Date().toISOString()}

# Wallet Configuration
SYSTEM_WALLET=${HP_WALLET}
TRADING_WALLET=${HP_WALLET}
MAIN_WALLET=${HP_WALLET}
WALLET_ADDRESS=${HP_WALLET}

# RPC Configuration
RPC_URL=${SYNDICA_URL}
SOLANA_RPC=${SYNDICA_URL}
WEBSOCKET_URL=${SYNDICA_WS}
USE_SYNDICA=true
USE_ALCHEMY=false
USE_HELIUS=false
USE_INSTANT_NODES=false
PRIMARY_PROVIDER=syndica
DISABLE_INSTANT_NODES=true
DISABLE_MULTI_PROVIDER=true
FORCE_SYNDICA_ONLY=true

# Feature Flags
USE_REAL_FUNDS=true
USE_WALLET_OVERRIDE=true
RATE_LIMIT_FIX=true
USE_AGGRESSIVE_CACHING=true
SYNDICA_CONFIG_PATH="./config/syndica-only.json"
`;

fs.writeFileSync('./.env.syndica-only', envConfig);
console.log('✅ Created Syndica-only environment file');

console.log('\n=== SYNDICA-ONLY CONFIGURATION COMPLETE ===');
console.log('Your system is now configured to use ONLY the Syndica RPC:');
console.log('1. Using HP wallet with 0.54442 SOL for trading');
console.log('2. Conservative rate limiting (2 requests/second)');
console.log('3. All trading strategies enabled');
console.log('\nTo launch with Syndica-only configuration, run:');
console.log('./force-syndica.sh');
console.log('\nReady for deployment with tomorrow\'s upgraded premium RPC!');