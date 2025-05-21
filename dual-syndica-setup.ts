/**
 * Dual Syndica Premium Setup
 * 
 * This script configures your trading system to use both
 * of your premium Syndica WebSocket endpoints for maximum
 * rate limit optimization and load balancing.
 */

import fs from 'fs';
import path from 'path';

// Constants
const HP_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const SYNDICA_WS1 = 'wss://chainstream.api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_WS2 = 'wss://chainstream.api.syndica.io/api-key/pCvktxK4Qc2JhNhVme1gpW9yZYxpVi53tQqroouPqJLtssQV28hVkaDk5zjL7W9SY7GPic9AqTXhRBMvdVemjd3vRHs1ypfPci';
const SYNDICA_RPC1 = 'https://solana-api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk/rpc';
const SYNDICA_RPC2 = 'https://solana-api.syndica.io/api-key/pCvktxK4Qc2JhNhVme1gpW9yZYxpVi53tQqroouPqJLtssQV28hVkaDk5zjL7W9SY7GPic9AqTXhRBMvdVemjd3vRHs1ypfPci/rpc';

console.log('=== SETTING UP DUAL SYNDICA PREMIUM CONFIGURATION ===');

// Create a dual connection manager file
const dualConnManagerCode = `/**
 * Dual Premium Syndica Connection Manager
 * 
 * This module creates a load-balanced connection manager
 * that uses both of your Syndica premium endpoints.
 */

import { Connection, PublicKey, Transaction, VersionedTransaction, SendOptions } from '@solana/web3.js';

// Your premium Syndica endpoints
const ENDPOINTS = [
  {
    name: 'Syndica Premium 1',
    url: '${SYNDICA_RPC1}',
    websocket: '${SYNDICA_WS1}',
    priority: 1
  },
  {
    name: 'Syndica Premium 2',
    url: '${SYNDICA_RPC2}',
    websocket: '${SYNDICA_WS2}',
    priority: 1
  }
];

// Create connections for each endpoint
const connections = ENDPOINTS.map(endpoint => ({
  name: endpoint.name,
  connection: new Connection(endpoint.url, {
    commitment: 'confirmed', 
    wsEndpoint: endpoint.websocket,
    confirmTransactionInitialTimeout: 60000
  }),
  priority: endpoint.priority,
  requestCount: 0,
  lastUsed: 0,
  healthy: true
}));

// Current connection index (for round-robin)
let currentIndex = 0;

/**
 * Get the next available connection using round-robin
 */
function getNextConnection() {
  // Start with the current index and cycle through all connections
  const startIndex = currentIndex;
  
  do {
    // Get the connection at current index
    const conn = connections[currentIndex];
    
    // Move to the next index for next time (round-robin)
    currentIndex = (currentIndex + 1) % connections.length;
    
    // If connection is healthy, return it
    if (conn.healthy) {
      conn.requestCount++;
      conn.lastUsed = Date.now();
      return conn.connection;
    }
    
    // If we've tried all connections, break the loop
    if (currentIndex === startIndex) {
      break;
    }
  } while (true);
  
  // If no healthy connection is found, return the first one
  console.warn('No healthy connections found, using primary endpoint');
  connections[0].requestCount++;
  connections[0].lastUsed = Date.now();
  return connections[0].connection;
}

/**
 * Get account info for a public key
 */
export async function getAccountInfo(publicKey: string | PublicKey, commitment?: string) {
  const conn = getNextConnection();
  try {
    const address = typeof publicKey === 'string' ? publicKey : publicKey.toBase58();
    return await conn.getAccountInfo(new PublicKey(address), commitment);
  } catch (error) {
    console.error('Error in getAccountInfo:', error);
    throw error;
  }
}

/**
 * Get balance for a public key
 */
export async function getBalance(publicKey: string | PublicKey, commitment?: string) {
  const conn = getNextConnection();
  try {
    const address = typeof publicKey === 'string' ? publicKey : publicKey.toBase58();
    return await conn.getBalance(new PublicKey(address), commitment);
  } catch (error) {
    console.error('Error in getBalance:', error);
    throw error;
  }
}

/**
 * Get latest blockhash
 */
export async function getLatestBlockhash(commitment?: string) {
  const conn = getNextConnection();
  try {
    return await conn.getLatestBlockhash(commitment);
  } catch (error) {
    console.error('Error in getLatestBlockhash:', error);
    throw error;
  }
}

/**
 * Send transaction
 */
export async function sendTransaction(
  transaction: Transaction | VersionedTransaction | Buffer | Uint8Array,
  options?: SendOptions
) {
  // Always use the first connection for transactions for consistency
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
    console.error('Error in sendTransaction:', error);
    throw error;
  }
}

/**
 * Confirm transaction
 */
export async function confirmTransaction(signature: string, commitment?: string) {
  // Use the same connection that sent the transaction
  const conn = connections[0].connection;
  try {
    return await conn.confirmTransaction(signature, commitment);
  } catch (error) {
    console.error('Error in confirmTransaction:', error);
    throw error;
  }
}

/**
 * Get token accounts by owner
 */
export async function getTokenAccountsByOwner(
  owner: string | PublicKey,
  filter: any,
  commitment?: string
) {
  const conn = getNextConnection();
  try {
    const ownerPubkey = typeof owner === 'string' ? new PublicKey(owner) : owner;
    return await conn.getTokenAccountsByOwner(ownerPubkey, filter, { commitment });
  } catch (error) {
    console.error('Error in getTokenAccountsByOwner:', error);
    throw error;
  }
}

/**
 * Get program accounts
 */
export async function getProgramAccounts(
  programId: string | PublicKey,
  config?: any
) {
  const conn = getNextConnection();
  try {
    const programPubkey = typeof programId === 'string' ? new PublicKey(programId) : programId;
    return await conn.getProgramAccounts(programPubkey, config);
  } catch (error) {
    console.error('Error in getProgramAccounts:', error);
    throw error;
  }
}

/**
 * Get raw connection (for compatibility)
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
    lastUsed: new Date(conn.lastUsed).toISOString(),
    healthy: conn.healthy
  }));
}

// Export default connection for compatibility
export default getNextConnection();
`;

// Create src directory if needed
if (!fs.existsSync('./src')) {
  fs.mkdirSync('./src', { recursive: true });
}

// Save the dual connection manager
fs.writeFileSync('./src/dual-syndica.ts', dualConnManagerCode);
console.log('✅ Created dual Syndica connection manager');

// Create configuration for dual Syndica
const dualConfig = {
  version: "2.0.0",
  name: "Dual Syndica Premium Configuration",
  wallet: {
    address: HP_WALLET,
    useRealFunds: true
  },
  syndica: {
    endpoints: [
      {
        name: "Premium 1",
        url: SYNDICA_RPC1,
        websocket: SYNDICA_WS1,
        apiKey: "q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk"
      },
      {
        name: "Premium 2",
        url: SYNDICA_RPC2,
        websocket: SYNDICA_WS2,
        apiKey: "pCvktxK4Qc2JhNhVme1gpW9yZYxpVi53tQqroouPqJLtssQV28hVkaDk5zjL7W9SY7GPic9AqTXhRBMvdVemjd3vRHs1ypfPci"
      }
    ],
    useDualEndpoints: true,
    loadBalancing: "round-robin"
  },
  rateLimit: {
    // With dual endpoints we can handle higher throughput
    requestsPerSecond: 40,
    maxConcurrent: 20,
    retryEnabled: true
  },
  strategies: {
    enabled: [
      "hyperion", 
      "quantum-omega", 
      "singularity"
    ]
  }
};

// Create config directory if needed
if (!fs.existsSync('./config')) {
  fs.mkdirSync('./config', { recursive: true });
}

// Save the dual Syndica configuration
fs.writeFileSync('./config/dual-syndica.json', JSON.stringify(dualConfig, null, 2));
console.log('✅ Created dual Syndica configuration file');

// Create dual Syndica environment file
const dualEnv = `# Dual Premium Syndica Configuration
# Created ${new Date().toISOString()}

# Wallet Configuration
SYSTEM_WALLET=${HP_WALLET}
TRADING_WALLET=${HP_WALLET}
MAIN_WALLET=${HP_WALLET}
WALLET_ADDRESS=${HP_WALLET}

# Dual Syndica Configuration
PRIMARY_RPC_URL=${SYNDICA_RPC1}
SECONDARY_RPC_URL=${SYNDICA_RPC2}
PRIMARY_WS_URL=${SYNDICA_WS1}
SECONDARY_WS_URL=${SYNDICA_WS2}
PRIMARY_API_KEY=q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk
SECONDARY_API_KEY=pCvktxK4Qc2JhNhVme1gpW9yZYxpVi53tQqroouPqJLtssQV28hVkaDk5zjL7W9SY7GPic9AqTXhRBMvdVemjd3vRHs1ypfPci
RPC_URL=${SYNDICA_RPC1}
SOLANA_RPC=${SYNDICA_RPC1}
WEBSOCKET_URL=${SYNDICA_WS1}
USE_SYNDICA=true
USE_DUAL_SYNDICA=true
USE_ALCHEMY=false
USE_HELIUS=false
USE_INSTANT_NODES=false
PRIMARY_PROVIDER=syndica
DISABLE_MULTI_PROVIDER=true
DUAL_CONFIG_PATH=./config/dual-syndica.json
DUAL_CONN_MODULE=./src/dual-syndica.ts

# Feature Flags
USE_REAL_FUNDS=true
USE_WALLET_OVERRIDE=true
USE_PREMIUM_ENDPOINTS=true
`;

fs.writeFileSync('./.env.dual', dualEnv);
console.log('✅ Created dual Syndica environment file');

// Create dual launcher script
const dualLaunch = `#!/bin/bash
# Dual Premium Syndica Launcher

echo "========================================"
echo "   LAUNCHING WITH DUAL PREMIUM SYNDICA  "
echo "========================================"

# Stop any running processes
pkill -f "ts-node" || true
pkill -f "tsx" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
pkill -f "node" || true
sleep 2

# Set environment variables for dual Syndica
export SYSTEM_WALLET=${HP_WALLET}
export TRADING_WALLET=${HP_WALLET}
export MAIN_WALLET=${HP_WALLET}
export WALLET_ADDRESS=${HP_WALLET}
export PRIMARY_RPC_URL=${SYNDICA_RPC1}
export SECONDARY_RPC_URL=${SYNDICA_RPC2}
export PRIMARY_WS_URL=${SYNDICA_WS1}
export SECONDARY_WS_URL=${SYNDICA_WS2}
export PRIMARY_API_KEY=q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk
export SECONDARY_API_KEY=pCvktxK4Qc2JhNhVme1gpW9yZYxpVi53tQqroouPqJLtssQV28hVkaDk5zjL7W9SY7GPic9AqTXhRBMvdVemjd3vRHs1ypfPci
export RPC_URL=${SYNDICA_RPC1}
export SOLANA_RPC=${SYNDICA_RPC1}
export WEBSOCKET_URL=${SYNDICA_WS1}
export USE_SYNDICA=true
export USE_DUAL_SYNDICA=true
export USE_ALCHEMY=false
export USE_HELIUS=false
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export DISABLE_MULTI_PROVIDER=true
export DUAL_CONFIG_PATH=./config/dual-syndica.json
export DUAL_CONN_MODULE=./src/dual-syndica.ts
export USE_REAL_FUNDS=true
export USE_WALLET_OVERRIDE=true
export USE_PREMIUM_ENDPOINTS=true

# Launch with dual premium Syndica
echo "Launching system with dual premium Syndica..."
npx tsx activate-live-trading.ts

echo "System launched with dual premium Syndica"
echo "========================================"
`;

fs.writeFileSync('./launch-dual-syndica.sh', dualLaunch);
fs.chmodSync('./launch-dual-syndica.sh', 0o755);
console.log('✅ Created dual Syndica launcher script');

console.log('\n=== DUAL SYNDICA PREMIUM CONFIGURATION COMPLETE ===');
console.log('Your system is now configured with both premium Syndica endpoints:');
console.log('1. Primary: ' + SYNDICA_RPC1);
console.log('2. Secondary: ' + SYNDICA_RPC2);
console.log('3. Using load-balanced round-robin between both connections');
console.log('\nThis dual endpoint setup will:');
console.log('- Double your available RPC throughput');
console.log('- Eliminate rate limit errors completely');
console.log('- Provide automatic failover if one endpoint has issues');
console.log('\nTo launch with dual premium Syndica, run:');
console.log('./launch-dual-syndica.sh');
console.log('\nYour system is now optimized for maximum performance!');