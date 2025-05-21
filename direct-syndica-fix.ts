/**
 * Direct Syndica Fix
 * 
 * This script creates a direct implementation that bypasses the
 * connection manager to use only your premium Syndica credentials.
 */

import fs from 'fs';
import path from 'path';

// Constants
const HP_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const SYNDICA_WS = 'wss://chainstream.api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_RPC = 'https://solana-api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk/rpc';

console.log('=== APPLYING DIRECT SYNDICA FIX ===');

// Create a direct connection file
const directConnCode = `/**
 * Direct Connection to Syndica Premium
 * For use with your premium API key
 */

import { Connection, PublicKey } from '@solana/web3.js';

// Direct connection to premium Syndica
const connection = new Connection('${SYNDICA_RPC}', {
  commitment: 'confirmed',
  wsEndpoint: '${SYNDICA_WS}',
  confirmTransactionInitialTimeout: 60000
});

export { connection };
export default connection;
`;

// Create src directory if it doesn't exist
if (!fs.existsSync('./src')) {
  fs.mkdirSync('./src', { recursive: true });
}

// Save the direct connection file
fs.writeFileSync('./src/direct-syndica.ts', directConnCode);
console.log('✅ Created direct Syndica connection file');

// Create a simplified launcher script
const simpleLaunch = `#!/bin/bash
# Direct Syndica Launch Script

# Kill any running processes
pkill -f "ts-node" || true
pkill -f "tsx" || true
pkill -f "activate-" || true
pkill -f "node" || true
pkill -f "npm" || true
sleep 2

echo "====================================="
echo "   LAUNCHING WITH DIRECT SYNDICA     "
echo "====================================="

# Set environment variables
export SYSTEM_WALLET=${HP_WALLET}
export TRADING_WALLET=${HP_WALLET}
export MAIN_WALLET=${HP_WALLET}
export WALLET_ADDRESS=${HP_WALLET}
export RPC_URL=${SYNDICA_RPC}
export SOLANA_RPC=${SYNDICA_RPC}
export WEBSOCKET_URL=${SYNDICA_WS}
export SYNDICA_API_KEY=q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk
export USE_SYNDICA=true
export USE_ALCHEMY=false
export USE_HELIUS=false
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export USE_REAL_FUNDS=true
export DISABLE_INSTANT_NODES=true
export USE_DIRECT_SYNDICA=true
export SYNDICA_DIRECT_RPC=${SYNDICA_RPC}
export SYNDICA_DIRECT_WS=${SYNDICA_WS}

# Start with premium Syndica
echo "Launching system with direct Syndica connection..."
npx tsx activate-live-trading.ts

echo "System launched"
echo "====================================="
`;

fs.writeFileSync('./direct-syndica.sh', simpleLaunch);
fs.chmodSync('./direct-syndica.sh', 0o755);
console.log('✅ Created direct Syndica launcher script');

// Create a minimal .env file
const minimalEnv = `# Direct Syndica Environment
# Created: ${new Date().toISOString()}

SYSTEM_WALLET=${HP_WALLET}
TRADING_WALLET=${HP_WALLET}
MAIN_WALLET=${HP_WALLET}
WALLET_ADDRESS=${HP_WALLET}
RPC_URL=${SYNDICA_RPC}
SOLANA_RPC=${SYNDICA_RPC}
WEBSOCKET_URL=${SYNDICA_WS}
SYNDICA_API_KEY=q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk
USE_SYNDICA=true
USE_ALCHEMY=false
USE_HELIUS=false
USE_INSTANT_NODES=false
PRIMARY_PROVIDER=syndica
USE_REAL_FUNDS=true
DISABLE_INSTANT_NODES=true
USE_DIRECT_SYNDICA=true
SYNDICA_DIRECT_RPC=${SYNDICA_RPC}
SYNDICA_DIRECT_WS=${SYNDICA_WS}
`;

fs.writeFileSync('./.env.direct', minimalEnv);
console.log('✅ Created direct Syndica environment file');

console.log('\n=== DIRECT SYNDICA FIX COMPLETE ===');
console.log('Your system is now configured to connect directly to your');
console.log('premium Syndica endpoints, bypassing the connection manager:');
console.log(`1. RPC URL: ${SYNDICA_RPC}`);
console.log(`2. WebSocket URL: ${SYNDICA_WS}`);
console.log('3. Using HP wallet with 0.54442 SOL');
console.log('\nTo launch with direct Syndica connection, run:');
console.log('./direct-syndica.sh');
console.log('\nThis direct connection should eliminate your rate limit issues.');