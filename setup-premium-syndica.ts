/**
 * Premium Syndica Configuration
 * 
 * This script configures your trading system to use 
 * your premium Syndica RPC and WebSocket endpoints.
 */

import fs from 'fs';
import path from 'path';

// Constants
const HP_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const SYNDICA_WS = 'wss://chainstream.api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_RPC = 'https://solana-api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk/rpc';

console.log('=== SETTING UP PREMIUM SYNDICA CONFIGURATION ===');

// Create config directory if it doesn't exist
if (!fs.existsSync('./config')) {
  fs.mkdirSync('./config', { recursive: true });
}

// Save premium Syndica configuration
const premiumConfig = {
  version: "2.0.0",
  name: "Premium Syndica Configuration",
  wallet: {
    address: HP_WALLET,
    useRealFunds: true
  },
  rpc: {
    provider: "syndica",
    url: SYNDICA_RPC,
    websocketUrl: SYNDICA_WS,
    apiKey: "q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk"
  },
  rateLimit: {
    // Premium endpoints have much higher rate limits
    requestsPerSecond: 25,
    maxConcurrent: 10,
    retryEnabled: true
  },
  caching: {
    // We can use shorter cache times with premium endpoints
    enabled: true,
    accountTtlMs: 60000,     // 1 minute for account data
    balanceTtlMs: 30000,     // 30 seconds for balances
    transactionTtlMs: 3600000 // 1 hour for transactions
  },
  strategies: {
    enabled: [
      "hyperion", 
      "quantum-omega", 
      "singularity"
    ]
  }
};

fs.writeFileSync('./config/premium-syndica.json', JSON.stringify(premiumConfig, null, 2));
console.log('✅ Created premium Syndica configuration');

// Create premium environment file
const premiumEnv = `# Premium Syndica Configuration
# Created ${new Date().toISOString()}

# Wallet Configuration
SYSTEM_WALLET=${HP_WALLET}
TRADING_WALLET=${HP_WALLET}
MAIN_WALLET=${HP_WALLET}
WALLET_ADDRESS=${HP_WALLET}

# Premium Syndica Configuration
RPC_URL=${SYNDICA_RPC}
SOLANA_RPC=${SYNDICA_RPC}
WEBSOCKET_URL=${SYNDICA_WS}
SYNDICA_API_KEY=q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk
USE_SYNDICA=true
USE_PREMIUM_SYNDICA=true
USE_ALCHEMY=false
USE_HELIUS=false
USE_INSTANT_NODES=false
PRIMARY_PROVIDER=syndica
DISABLE_MULTI_PROVIDER=true
PREMIUM_CONFIG_PATH=./config/premium-syndica.json

# Feature Flags
USE_REAL_FUNDS=true
USE_WALLET_OVERRIDE=true
USE_PREMIUM_ENDPOINTS=true
`;

fs.writeFileSync('./.env.premium', premiumEnv);
console.log('✅ Created premium environment file');

// Create premium launcher script
const launcherScript = `#!/bin/bash
# Premium Syndica Launcher

echo "========================================"
echo "    LAUNCHING WITH PREMIUM SYNDICA      "
echo "========================================"

# Stop any running processes
pkill -f "ts-node" || true
pkill -f "tsx" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Load premium environment
export SYSTEM_WALLET=${HP_WALLET}
export TRADING_WALLET=${HP_WALLET}
export MAIN_WALLET=${HP_WALLET}
export WALLET_ADDRESS=${HP_WALLET}
export RPC_URL=${SYNDICA_RPC}
export SOLANA_RPC=${SYNDICA_RPC}
export WEBSOCKET_URL=${SYNDICA_WS}
export SYNDICA_API_KEY=q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk
export USE_SYNDICA=true
export USE_PREMIUM_SYNDICA=true
export USE_ALCHEMY=false
export USE_HELIUS=false
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export DISABLE_MULTI_PROVIDER=true
export PREMIUM_CONFIG_PATH=./config/premium-syndica.json
export USE_REAL_FUNDS=true
export USE_WALLET_OVERRIDE=true
export USE_PREMIUM_ENDPOINTS=true

# Launch the trading system with premium Syndica
echo "Launching trading system with premium Syndica..."
npx tsx activate-live-trading.ts

echo "System launched with premium Syndica"
echo "========================================"
`;

fs.writeFileSync('./launch-premium.sh', launcherScript);
fs.chmodSync('./launch-premium.sh', 0o755);
console.log('✅ Created premium launcher script');

console.log('\n=== PREMIUM SYNDICA CONFIGURATION COMPLETE ===');
console.log('Your system is now configured to use your premium Syndica endpoints:');
console.log(`1. RPC URL: ${SYNDICA_RPC}`);
console.log(`2. WebSocket URL: ${SYNDICA_WS}`);
console.log('3. Using HP wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK');
console.log('\nTo launch with premium Syndica, run:');
console.log('./launch-premium.sh');
console.log('\nWith these premium endpoints, you should no longer experience rate limit issues!');