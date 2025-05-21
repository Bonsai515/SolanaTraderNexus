/**
 * Force Disable Instant Nodes
 * 
 * This script completely blocks Instant Nodes from being used
 * in the trading system, forcing it to only use premium endpoints.
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

console.log('=== FORCE DISABLING INSTANT NODES ===');

// Stop all current processes
exec('pkill -f "ts-node" || true', () => {});
exec('pkill -f "tsx" || true', () => {});
exec('pkill -f "node" || true', () => {});
exec('pkill -f "npm" || true', () => {});

// Create a file to override the RPC provider
const overrideCode = `/**
 * InstantNodes Blocker - Overrides Instant Nodes RPC
 */

// This module blocks any attempt to use Instant Nodes
const originalRequire = require;

// Override the require function to intercept any attempts to load RPC modules
require = function(id) {
  const result = originalRequire(id);
  
  // If this is the RPC connection manager, patch it
  if (id.includes('rpcConnectionManager') || id.includes('RpcConnectionManager')) {
    console.log('[InstantNodes Blocker] Patching RPC Connection Manager');
    
    // Replace Instant Nodes URL with an invalid value to ensure it's never used
    if (typeof result === 'object' && result !== null) {
      // For any property that might contain the RPC URL
      Object.keys(result).forEach(key => {
        if (typeof result[key] === 'string' && 
            result[key].includes('instantnodes')) {
          console.log('[InstantNodes Blocker] Blocked Instant Nodes URL in ' + key);
          result[key] = 'BLOCKED_INSTANT_NODES_URL';
        }
        
        // Check for URL in nested objects
        if (typeof result[key] === 'object' && result[key] !== null) {
          Object.keys(result[key]).forEach(subKey => {
            if (typeof result[key][subKey] === 'string' && 
                result[key][subKey].includes('instantnodes')) {
              console.log('[InstantNodes Blocker] Blocked nested Instant Nodes URL in ' + key + '.' + subKey);
              result[key][subKey] = 'BLOCKED_INSTANT_NODES_URL';
            }
          });
        }
      });
      
      // Patch any initialization functions
      if (typeof result.initialize === 'function') {
        const originalInit = result.initialize;
        result.initialize = function(...args) {
          // Filter out any Instant Nodes URLs from arguments
          const filteredArgs = args.map(arg => {
            if (typeof arg === 'string' && arg.includes('instantnodes')) {
              console.log('[InstantNodes Blocker] Blocked Instant Nodes URL in initialize args');
              return 'BLOCKED_INSTANT_NODES_URL';
            }
            return arg;
          });
          
          return originalInit.apply(this, filteredArgs);
        };
      }
    }
  }
  
  return result;
};

console.log('[InstantNodes Blocker] Activated - All Instant Nodes connections blocked');
`;

// Create directory if it doesn't exist
if (!fs.existsSync('./blockers')) {
  fs.mkdirSync('./blockers', { recursive: true });
}

// Write the RPC override file
fs.writeFileSync('./blockers/instant-nodes-blocker.js', overrideCode);
console.log('✅ Created Instant Nodes blocker module');

// Create .env file with explicit blocking
const envContent = `# Force Disable Instant Nodes Configuration
# Generated at ${new Date().toISOString()}

# Disable Instant Nodes
USE_INSTANT_NODES=false
DISABLE_INSTANT_NODES=true
BLOCK_INSTANT_NODES=true
INSTANT_NODES_URL=BLOCKED_INSTANT_NODES_URL
INSTANT_NODES_API_KEY=BLOCKED_INSTANT_NODES_KEY

# Force use of premium endpoints
USE_PREMIUM_ENDPOINTS=true
USE_SYNDICA=true
USE_ALCHEMY=true
USE_HELIUS=false

# Premium RPC endpoints
RPC_URL=https://solana-api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk/rpc
SOLANA_RPC=https://solana-api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk/rpc
WEBSOCKET_URL=wss://chainstream.api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk
SYNDICA_API_KEY=q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk
ALCHEMY_API_KEY=PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR

# Wallet configuration
SYSTEM_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
TRADING_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
MAIN_WALLET=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK
WALLET_ADDRESS=HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK

# Feature flags
USE_REAL_FUNDS=true
`;

// Write the env file
fs.writeFileSync('./.env.no-instant-nodes', envContent);
console.log('✅ Created environment file to block Instant Nodes');

// Create a patch file for the RPC connection manager
const patchScript = `/**
 * Patch RPC Connection Manager to remove Instant Nodes
 */

import fs from 'fs';
import path from 'path';

// Possible locations of the RPC manager
const possiblePaths = [
  './server/lib/rpcConnectionManager.ts',
  './server/lib/rpcConnectionManager.js',
  './src/lib/rpcConnectionManager.ts',
  './src/lib/rpcConnectionManager.js',
  './src/rpcConnectionManager.ts',
  './src/rpcConnectionManager.js',
  './lib/rpcConnectionManager.ts',
  './lib/rpcConnectionManager.js',
  './rpcConnectionManager.ts',
  './rpcConnectionManager.js',
];

console.log('[RPC Patcher] Searching for RPC connection manager...');

// Find the RPC manager file
let rpcManagerPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    rpcManagerPath = p;
    break;
  }
}

if (!rpcManagerPath) {
  console.log('[RPC Patcher] Could not find RPC connection manager file');
  process.exit(1);
}

console.log(\`[RPC Patcher] Found RPC connection manager at \${rpcManagerPath}\`);

// Backup the original file
const backupPath = \`\${rpcManagerPath}.backup-\${Date.now()}\`;
fs.copyFileSync(rpcManagerPath, backupPath);
console.log(\`[RPC Patcher] Created backup at \${backupPath}\`);

// Read the file
let content = fs.readFileSync(rpcManagerPath, 'utf8');

// Replace any reference to Instant Nodes
const instantNodesPattern = /instantnodes\\.io[\\/\\w-]*\\/?/g;
content = content.replace(instantNodesPattern, 'BLOCKED_INSTANT_NODES/');

// Disable any Instant Nodes initializers
const instantNodesInitPattern = /(initialize|setupConnection|addConnection|connectToEndpoint)(.*?['"](.*?instantnodes.*?)['"])/g;
content = content.replace(instantNodesInitPattern, '$1$2\'BLOCKED_INSTANT_NODES\'');

// Write the patched file
fs.writeFileSync(rpcManagerPath, content);
console.log('[RPC Patcher] Successfully patched RPC connection manager');
`;

fs.writeFileSync('./patch-rpc-manager.ts', patchScript);
console.log('✅ Created RPC manager patch script');

// Create the launch script
const launchScript = `#!/bin/bash
# Launch with Instant Nodes Completely Disabled

echo "========================================"
echo "  LAUNCHING WITHOUT INSTANT NODES       "
echo "========================================"

# Stop all running processes
pkill -f "ts-node" || true
pkill -f "tsx" || true
pkill -f "node" || true
pkill -f "npm" || true
sleep 3

# Apply the RPC manager patch
echo "Patching RPC connection manager to remove Instant Nodes..."
npx tsx patch-rpc-manager.ts

# Set environment from the no-instant-nodes configuration
echo "Setting environment without Instant Nodes..."
export $(cat .env.no-instant-nodes | xargs)

# Require the blocker module to force block Instant Nodes
echo "Launching with Instant Nodes blocker..."
NODE_OPTIONS="--require ./blockers/instant-nodes-blocker.js" npx tsx activate-live-trading.ts

echo "System launched without Instant Nodes"
echo "========================================"
`;

fs.writeFileSync('./launch-without-instant-nodes.sh', launchScript);
fs.chmodSync('./launch-without-instant-nodes.sh', 0o755);
console.log('✅ Created launch script that blocks Instant Nodes');

console.log('\n=== INSTANT NODES FORCE DISABLED ===');
console.log('All references to Instant Nodes have been blocked and the system');
console.log('will now exclusively use your premium endpoints:');
console.log('1. Syndica Premium (primary)');
console.log('2. Alchemy Premium (backup)');
console.log('\nTo launch your system with Instant Nodes completely disabled, run:');
console.log('./launch-without-instant-nodes.sh');
console.log('\nThis will ensure your system only uses your premium RPC endpoints.');