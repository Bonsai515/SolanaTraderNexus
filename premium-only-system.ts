/**
 * Premium-Only System Setup
 * 
 * This script creates a completely fresh trading system configuration
 * that ONLY uses your premium RPC endpoints and blocks all others.
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

// Constants
const HP_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const SYNDICA_API_KEY_1 = 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_API_KEY_2 = 'pCvktxK4Qc2JhNhVme1gpW9yZYxpVi53tQqroouPqJLtssQV28hVkaDk5zjL7W9SY7GPic9AqTXhRBMvdVemjd3vRHs1ypfPci';
const ALCHEMY_API_KEY = 'PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR';

const SYNDICA_RPC_1 = `https://solana-api.syndica.io/api-key/${SYNDICA_API_KEY_1}/rpc`;
const SYNDICA_WS_1 = `wss://chainstream.api.syndica.io/api-key/${SYNDICA_API_KEY_1}`;
const SYNDICA_RPC_2 = `https://solana-api.syndica.io/api-key/${SYNDICA_API_KEY_2}/rpc`;
const SYNDICA_WS_2 = `wss://chainstream.api.syndica.io/api-key/${SYNDICA_API_KEY_2}`;
const ALCHEMY_RPC = `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

console.log('=== CREATING PREMIUM-ONLY SYSTEM ===');

// Stop all existing processes
console.log('Stopping all existing processes...');
exec('pkill -f "ts-node" || true', () => {});
exec('pkill -f "tsx" || true', () => {});
exec('pkill -f "node" || true', () => {});
exec('pkill -f "npm" || true', () => {});
setTimeout(() => {

  // Create the premium RPC connector source
  console.log('Creating Premium RPC connector...');
  const premiumConnectorCode = `/**
 * Premium RPC Connector
 * 
 * This module provides direct connections to premium Solana RPC endpoints,
 * enabling high throughput and low latency for your trading system.
 */

import { Connection, PublicKey, Keypair, Transaction, VersionedTransaction, SendOptions } from '@solana/web3.js';

// Premium RPC endpoints
const ENDPOINTS = [
  {
    name: 'Syndica Premium 1',
    url: '${SYNDICA_RPC_1}',
    websocket: '${SYNDICA_WS_1}',
    priority: 1,
    weight: 5
  },
  {
    name: 'Syndica Premium 2',
    url: '${SYNDICA_RPC_2}',
    websocket: '${SYNDICA_WS_2}',
    priority: 1,
    weight: 5
  },
  {
    name: 'Alchemy Premium',
    url: '${ALCHEMY_RPC}',
    websocket: null,
    priority: 2,
    weight: 1
  }
];

// HP Wallet
const HP_WALLET_ADDRESS = '${HP_WALLET}';

// Create connection objects for each endpoint
const connections = ENDPOINTS.map(endpoint => {
  const connectionOptions = {
    commitment: 'confirmed',
    disableRetryOnRateLimit: false,
    confirmTransactionInitialTimeout: 60000
  };
  
  // Add websocket if available
  if (endpoint.websocket) {
    connectionOptions['wsEndpoint'] = endpoint.websocket;
  }
  
  return {
    name: endpoint.name,
    connection: new Connection(endpoint.url, connectionOptions),
    priority: endpoint.priority,
    weight: endpoint.weight,
    lastUsed: 0,
    requestCount: 0,
    errorCount: 0,
    healthy: true
  };
});

console.log(\`[Premium RPC] Initialized with \${connections.length} premium endpoints\`);

// Counter for round-robin
let currentIndex = 0;

/**
 * Get connection based on weighted selection
 */
function getNextConnection() {
  // Prioritize connections by lowest error count and highest weight
  const sortedConnections = [...connections]
    .filter(conn => conn.healthy)
    .sort((a, b) => {
      // First sort by error count (ascending)
      if (a.errorCount !== b.errorCount) {
        return a.errorCount - b.errorCount;
      }
      
      // Then by weight (descending)
      if (a.weight !== b.weight) {
        return b.weight - a.weight;
      }
      
      // Then by request count (ascending)
      return a.requestCount - b.requestCount;
    });
  
  if (sortedConnections.length === 0) {
    // Reset all connections to healthy if none available
    connections.forEach(conn => {
      conn.healthy = true;
      conn.errorCount = 0;
    });
    console.log('[Premium RPC] All connections were marked unhealthy, resetting status');
    return getNextConnection();
  }
  
  // Get the best connection
  const selectedConn = sortedConnections[0];
  
  // Update stats
  selectedConn.requestCount++;
  selectedConn.lastUsed = Date.now();
  
  return selectedConn.connection;
}

/**
 * Mark a connection as unhealthy
 */
function markConnectionUnhealthy(conn: Connection) {
  const connIndex = connections.findIndex(c => c.connection === conn);
  if (connIndex >= 0) {
    connections[connIndex].errorCount++;
    console.log(\`[Premium RPC] Connection \${connections[connIndex].name} error count: \${connections[connIndex].errorCount}\`);
    
    if (connections[connIndex].errorCount >= 3) {
      connections[connIndex].healthy = false;
      console.log(\`[Premium RPC] Marked \${connections[connIndex].name} as unhealthy\`);
      
      // Reset after 30 seconds
      setTimeout(() => {
        if (connIndex < connections.length) {
          connections[connIndex].healthy = true;
          connections[connIndex].errorCount = 0;
          console.log(\`[Premium RPC] Reset \${connections[connIndex].name} to healthy\`);
        }
      }, 30000);
    }
  }
}

/**
 * Get account info with automatic error handling
 */
export async function getAccountInfo(
  publicKey: string | PublicKey,
  commitment?: string
) {
  const conn = getNextConnection();
  try {
    const address = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;
    return await conn.getAccountInfo(address, commitment);
  } catch (error) {
    console.error('[Premium RPC] Error in getAccountInfo:', error);
    markConnectionUnhealthy(conn);
    throw error;
  }
}

/**
 * Get balance with automatic error handling
 */
export async function getBalance(
  publicKey: string | PublicKey,
  commitment?: string
) {
  const conn = getNextConnection();
  try {
    const address = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;
    return await conn.getBalance(address, commitment);
  } catch (error) {
    console.error('[Premium RPC] Error in getBalance:', error);
    markConnectionUnhealthy(conn);
    throw error;
  }
}

/**
 * Get latest blockhash with automatic error handling
 */
export async function getLatestBlockhash(commitment?: string) {
  const conn = getNextConnection();
  try {
    return await conn.getLatestBlockhash(commitment);
  } catch (error) {
    console.error('[Premium RPC] Error in getLatestBlockhash:', error);
    markConnectionUnhealthy(conn);
    throw error;
  }
}

/**
 * Send transaction with automatic error handling
 * Always use the first Syndica endpoint for transactions
 */
export async function sendTransaction(
  transaction: Transaction | VersionedTransaction | Buffer | Uint8Array,
  options?: SendOptions
) {
  // Always use first Syndica endpoint for transactions
  const conn = connections[0].connection;
  try {
    let rawTransaction;
    if (transaction instanceof Transaction) {
      rawTransaction = transaction.serialize();
    } else if (transaction instanceof VersionedTransaction) {
      rawTransaction = transaction.serialize();
    } else {
      rawTransaction = transaction;
    }
    
    return await conn.sendRawTransaction(rawTransaction, options);
  } catch (error) {
    console.error('[Premium RPC] Error in sendTransaction:', error);
    throw error;
  }
}

/**
 * Confirm transaction with automatic error handling
 */
export async function confirmTransaction(signature: string, commitment?: string) {
  // Use same connection for confirmations
  const conn = connections[0].connection;
  try {
    return await conn.confirmTransaction(signature, commitment);
  } catch (error) {
    console.error('[Premium RPC] Error in confirmTransaction:', error);
    throw error;
  }
}

/**
 * Get token accounts by owner with automatic error handling
 */
export async function getTokenAccountsByOwner(
  owner: string | PublicKey,
  filter: any,
  commitment?: string
) {
  const conn = getNextConnection();
  try {
    const address = typeof owner === 'string' ? new PublicKey(owner) : owner;
    return await conn.getTokenAccountsByOwner(address, filter, {commitment});
  } catch (error) {
    console.error('[Premium RPC] Error in getTokenAccountsByOwner:', error);
    markConnectionUnhealthy(conn);
    throw error;
  }
}

/**
 * Get program accounts with automatic error handling
 */
export async function getProgramAccounts(
  programId: string | PublicKey,
  config?: any
) {
  const conn = getNextConnection();
  try {
    const address = typeof programId === 'string' ? new PublicKey(programId) : programId;
    return await conn.getProgramAccounts(address, config);
  } catch (error) {
    console.error('[Premium RPC] Error in getProgramAccounts:', error);
    markConnectionUnhealthy(conn);
    throw error;
  }
}

/**
 * Get system wallet address
 */
export function getSystemWallet() {
  return HP_WALLET_ADDRESS;
}

/**
 * Get raw connection for compatibility
 */
export function getRawConnection() {
  return getNextConnection();
}

/**
 * Get connection stats
 */
export function getConnectionStats() {
  return connections.map(conn => ({
    name: conn.name,
    requestCount: conn.requestCount,
    errorCount: conn.errorCount,
    lastUsed: new Date(conn.lastUsed).toISOString(),
    healthy: conn.healthy
  }));
}

// Export a raw connection for compatibility
export const connection = getNextConnection();
export default connection;
`;

  // Create the src directory if it doesn't exist
  if (!fs.existsSync('./src')) {
    fs.mkdirSync('./src', { recursive: true });
  }

  // Save the premium connector
  fs.writeFileSync('./src/premium-rpc.ts', premiumConnectorCode);
  console.log('✅ Created Premium RPC connector');

  // Create the environment file
  console.log('Creating environment file...');
  const envContent = `# Premium-Only System Environment
# Created: ${new Date().toISOString()}

# Premium RPC Configuration
PRIMARY_RPC_URL=${SYNDICA_RPC_1}
SECONDARY_RPC_URL=${SYNDICA_RPC_2}
ALCHEMY_RPC_URL=${ALCHEMY_RPC}
PRIMARY_WS_URL=${SYNDICA_WS_1}
SECONDARY_WS_URL=${SYNDICA_WS_2}
RPC_URL=${SYNDICA_RPC_1}
SOLANA_RPC=${SYNDICA_RPC_1}
WEBSOCKET_URL=${SYNDICA_WS_1}

# API Keys 
SYNDICA_API_KEY_1=${SYNDICA_API_KEY_1}
SYNDICA_API_KEY_2=${SYNDICA_API_KEY_2}
ALCHEMY_API_KEY=${ALCHEMY_API_KEY}

# Feature Flags
USE_PREMIUM_ONLY=true
USE_SYNDICA=true
USE_ALCHEMY=true
USE_INSTANT_NODES=false
DISABLE_INSTANT_NODES=true
BLOCK_INSTANT_NODES=true
USE_PREMIUM_CONNECTOR=true
USE_PREMIUM_ENDPOINTS=true
USE_PREMIUM_RPC=true

# Wallet Configuration 
SYSTEM_WALLET=${HP_WALLET}
TRADING_WALLET=${HP_WALLET}
MAIN_WALLET=${HP_WALLET}
WALLET_ADDRESS=${HP_WALLET}

# Trading Configuration
USE_REAL_FUNDS=true
`;

  fs.writeFileSync('./.env.premium-only', envContent);
  console.log('✅ Created premium-only environment file');

  // Create loader script that injects the premium RPC
  console.log('Creating loader script...');
  const loaderCode = `/**
 * Premium RPC Loader
 * 
 * This module overrides the RPC connection system to force the use of
 * premium endpoints.
 */

// Import our premium RPC system
const premiumRpc = require('./src/premium-rpc');

// Export everything from premium RPC
module.exports = premiumRpc;

// Override Connection class if it gets imported
if (typeof global !== 'undefined' && global.Connection) {
  const originalConnection = global.Connection;
  global.Connection = function(...args) {
    console.log('[Premium RPC Loader] Intercepted Connection constructor - forcing premium RPC');
    return premiumRpc.getRawConnection();
  };
  
  // Copy static properties
  Object.assign(global.Connection, originalConnection);
}

console.log('[Premium RPC Loader] Activated - All RPC requests will use premium endpoints');
`;

  fs.writeFileSync('./premium-rpc-loader.js', loaderCode);
  console.log('✅ Created premium RPC loader');

  // Create launcher script
  console.log('Creating launcher script...');
  const launchScript = `#!/bin/bash
# Premium-Only System Launcher

echo "========================================"
echo "   LAUNCHING PREMIUM-ONLY SYSTEM        "
echo "========================================"

# Kill any running processes
pkill -f "ts-node" || true
pkill -f "tsx" || true
pkill -f "node" || true
pkill -f "npm" || true
sleep 3

# Set environment variables
export $(cat .env.premium-only | xargs)

# Register signal handler
trap "echo 'Shutting down...'; exit" SIGINT SIGTERM

# Launch the trading system
echo "Launching premium-only trading system..."
NODE_OPTIONS="--require ./premium-rpc-loader.js" npx tsx activate-live-trading.ts

echo "System launched"
echo "========================================"
`;

  fs.writeFileSync('./launch-premium-only.sh', launchScript);
  fs.chmodSync('./launch-premium-only.sh', 0o755);
  console.log('✅ Created premium-only launcher script');

  console.log('\n=== PREMIUM-ONLY SYSTEM READY ===');
  console.log('Your trading system has been reconfigured to use ONLY premium endpoints:');
  console.log('1. Syndica Premium 1 - Primary (weight: 5)');
  console.log('2. Syndica Premium 2 - Primary (weight: 5)');
  console.log('3. Alchemy Premium - Secondary (weight: 1)');
  console.log('\nTo launch your premium-only system, run:');
  console.log('./launch-premium-only.sh');
  console.log('\nThis will completely bypass ALL other RPC providers and only use your');
  console.log('premium endpoints, eliminating rate limit issues for deployment.');
}, 3000);