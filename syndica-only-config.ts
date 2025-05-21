/**
 * Syndica-Only RPC Configuration
 * 
 * This script completely disables all other RPC providers and
 * configures the system to use only your premium Syndica RPC.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('=== CONFIGURING SYNDICA-ONLY MODE ===');

const HP_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const SYNDICA_URL = 'https://solana-api.syndica.io/rpc';
const SYNDICA_WS = 'wss://solana-api.syndica.io/rpc';

// Create data dir if it doesn't exist
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true });
}

// Create config dir if it doesn't exist
if (!fs.existsSync('./config')) {
  fs.mkdirSync('./config', { recursive: true });
}

// Kill any running processes that might be using RPCs
try {
  console.log('Stopping existing processes...');
  execSync('pkill -f "ts-node" || true');
  execSync('pkill -f "tsx" || true');
  execSync('pkill -f "npx tsx" || true');
  execSync('pkill -f "activate-" || true');
  console.log('Processes stopped.');
} catch (error) {
  console.log('No processes were running.');
}

// Force override RPC configuration
// 1. Create hard-coded RPC connector
const rpcConnectorCode = `// Direct Syndica Connection
import { Connection, PublicKey } from '@solana/web3.js';

// Create connection to Syndica
export const connection = new Connection('${SYNDICA_URL}', {
  commitment: 'confirmed',
  disableRetryOnRateLimit: false,
  confirmTransactionInitialTimeout: 60000,
});

// Always use the HP wallet
export const WALLET_ADDRESS = '${HP_WALLET}';

export const getConnection = () => connection;
export const getWallet = () => WALLET_ADDRESS;

// Force override all RPC functions to use this connection
export default connection;
`;

console.log('Writing forced Syndica-only RPC connector...');
fs.writeFileSync('./src/syndica-connector.ts', rpcConnectorCode);

// 2. Create .env.syndica
const envContent = `# Syndica-Only Mode
# Generated on ${new Date().toISOString()}

# Wallet Configuration
SYSTEM_WALLET=${HP_WALLET}
TRADING_WALLET=${HP_WALLET}
MAIN_WALLET=${HP_WALLET}
WALLET_ADDRESS=${HP_WALLET}

# RPC Configuration - SYNDICA ONLY
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
ISOLATE_SYNDICA=true

# Rate limiting
MAX_RPC_REQUESTS_PER_SECOND=2
DISABLE_BACKGROUND_TASKS=true
REDUCE_POLLING_FREQUENCY=true
`;

console.log('Writing Syndica-only environment file...');
fs.writeFileSync('./.env.syndica', envContent);

// 3. Create a syndica-override.ts file that patches all connection managers
const overrideCode = `// Patch all RPC connections to use Syndica only
import { Connection } from '@solana/web3.js';
import path from 'path';
import fs from 'fs';

// Enforce Syndica-only mode
const SYNDICA_URL = '${SYNDICA_URL}';
const HP_WALLET = '${HP_WALLET}';

console.log('🔄 PATCHING: Forcing Syndica-only mode...');

// Force override process.env with Syndica-only values
process.env.RPC_URL = SYNDICA_URL;
process.env.SOLANA_RPC = SYNDICA_URL;
process.env.WEBSOCKET_URL = '${SYNDICA_WS}';
process.env.USE_SYNDICA = 'true';
process.env.USE_ALCHEMY = 'false';
process.env.USE_HELIUS = 'false';
process.env.USE_INSTANT_NODES = 'false';
process.env.PRIMARY_PROVIDER = 'syndica';
process.env.DISABLE_INSTANT_NODES = 'true';
process.env.DISABLE_MULTI_PROVIDER = 'true';
process.env.FORCE_SYNDICA_ONLY = 'true';
process.env.SYSTEM_WALLET = HP_WALLET;
process.env.TRADING_WALLET = HP_WALLET;
process.env.MAIN_WALLET = HP_WALLET;
process.env.WALLET_ADDRESS = HP_WALLET;

// Create a singleton Syndica connection to be used everywhere
const syndicaConnection = new Connection(SYNDICA_URL, {
  commitment: 'confirmed',
  disableRetryOnRateLimit: false,
  confirmTransactionInitialTimeout: 60000,
});

// Export patched functions
export function getSyndicaConnection() {
  return syndicaConnection;
}

// Monkey-patch the global Connection constructor if loaded directly
try {
  const originalConnection = global.Connection || Connection;
  
  // Replace the Connection constructor globally
  global.Connection = function() {
    console.log('🔄 Connection constructor called - forcing Syndica connection');
    return syndicaConnection;
  };
  
  // Copy all properties from the original Connection
  Object.assign(global.Connection, originalConnection);
  
  console.log('✅ Successfully patched global Connection constructor');
} catch (error) {
  console.error('❌ Failed to patch global Connection:', error);
}

// Function to patch RPC Connection Manager if it exists
export function patchConnectionManager() {
  console.log('🔄 Attempting to patch RPC Connection Manager...');
  
  try {
    const managerPath = path.resolve('./server/lib/rpcConnectionManager.js');
    
    if (fs.existsSync(managerPath)) {
      // Create backup of the file
      fs.copyFileSync(managerPath, managerPath + '.backup');
      
      // Read the file
      let content = fs.readFileSync(managerPath, 'utf8');
      
      // Replace all connection creation with Syndica-only
      content = content.replace(
        /new Connection\([^)]+\)/g, 
        \`new Connection('\${SYNDICA_URL}', {
          commitment: 'confirmed',
          disableRetryOnRateLimit: false,
          confirmTransactionInitialTimeout: 60000,
        })\`
      );
      
      // Write the modified file
      fs.writeFileSync(managerPath, content);
      console.log('✅ Successfully patched RPC Connection Manager');
    } else {
      console.log('⚠️ RPC Connection Manager not found at expected path');
    }
  } catch (error) {
    console.error('❌ Failed to patch RPC Connection Manager:', error);
  }
}

// Call patch function
patchConnectionManager();

console.log('✅ Syndica-only mode fully configured');

// Export the patched connection
export default syndicaConnection;
`;

console.log('Writing Syndica override module...');
fs.writeFileSync('./src/syndica-override.ts', overrideCode);

// 4. Create launcher script for Syndica-only mode
const launcherScript = `#!/bin/bash
# Syndica-Only Mode Launcher

echo "========================================"
echo "     LAUNCHING SYNDICA-ONLY MODE        "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "tsx" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Override environment with Syndica-only mode
echo "Setting Syndica-only environment..."
export SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export MAIN_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export WALLET_ADDRESS=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
export RPC_URL=https://solana-api.syndica.io/rpc
export SOLANA_RPC=https://solana-api.syndica.io/rpc
export WEBSOCKET_URL=wss://solana-api.syndica.io/rpc
export USE_SYNDICA=true
export USE_ALCHEMY=false
export USE_HELIUS=false
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export DISABLE_INSTANT_NODES=true
export DISABLE_MULTI_PROVIDER=true
export FORCE_SYNDICA_ONLY=true
export USE_REAL_FUNDS=true
export USE_WALLET_OVERRIDE=true
export RATE_LIMIT_FIX=true
export USE_AGGRESSIVE_CACHING=true
export ISOLATE_SYNDICA=true
export MAX_RPC_REQUESTS_PER_SECOND=2
export DISABLE_BACKGROUND_TASKS=true
export REDUCE_POLLING_FREQUENCY=true

# First, run the override to ensure Syndica-only mode
echo "Enabling Syndica override..."
npx tsx ./src/syndica-override.ts

# Then start the system
echo "Launching system in Syndica-only mode..."
NODE_OPTIONS="--require ./src/syndica-override.ts" npx tsx activate-live-trading.ts

echo "Syndica-only mode launched"
echo "========================================"
`;

console.log('Creating Syndica-only launcher script...');
fs.writeFileSync('./launch-syndica-only.sh', launcherScript);
fs.chmodSync('./launch-syndica-only.sh', 0o755);

console.log('\n=== SYNDICA-ONLY CONFIGURATION COMPLETE ===');
console.log('Your system is now configured to exclusively use Syndica RPC:');
console.log('1. All other RPC providers have been disabled');
console.log('2. Direct patching of connection code to enforce Syndica usage');
console.log('3. Aggressive rate limiting with 2 requests per second maximum');
console.log('\nTo launch with Syndica-only mode, run:');
console.log('./launch-syndica-only.sh');
console.log('\nIMPORTANT: Tomorrow when you add your premium Syndica RPC credentials,');
console.log('update the SYNDICA_URL and SYNDICA_WS values in this script and run it again.');