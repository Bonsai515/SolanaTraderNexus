/**
 * Ultimate RPC Connection Manager
 * 
 * This module creates a load-balanced connection manager
 * that uses all three of your premium RPC endpoints for
 * maximum performance and reliability.
 */

import { Connection, PublicKey, Transaction, VersionedTransaction, SendOptions } from '@solana/web3.js';

// Your premium RPC endpoints
const ENDPOINTS = [
  {
    name: 'Syndica Premium 1',
    url: 'https://solana-api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk/rpc',
    websocket: 'wss://chainstream.api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk',
    priority: 1,
    weight: 3
  },
  {
    name: 'Syndica Premium 2',
    url: 'https://solana-api.syndica.io/api-key/pCvktxK4Qc2JhNhVme1gpW9yZYxpVi53tQqroouPqJLtssQV28hVkaDk5zjL7W9SY7GPic9AqTXhRBMvdVemjd3vRHs1ypfPci/rpc',
    websocket: 'wss://chainstream.api.syndica.io/api-key/pCvktxK4Qc2JhNhVme1gpW9yZYxpVi53tQqroouPqJLtssQV28hVkaDk5zjL7W9SY7GPic9AqTXhRBMvdVemjd3vRHs1ypfPci',
    priority: 1,
    weight: 3
  },
  {
    name: 'Alchemy Premium',
    url: 'https://solana-mainnet.g.alchemy.com/v2/PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR',
    websocket: null,
    priority: 2,
    weight: 1
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
  weight: endpoint.weight || 1,
  requestCount: 0,
  lastUsed: 0,
  healthy: true,
  errorCount: 0
}));

// Current connection index (for weighted round-robin)
let currentRound = 0;

/**
 * Get the next available connection using weighted round-robin
 */
function getNextConnection() {
  // Calculate total weight of healthy connections
  const healthyConnections = connections.filter(conn => conn.healthy);
  if (healthyConnections.length === 0) {
    // If no connections are healthy, reset all to healthy and try again
    connections.forEach(conn => conn.healthy = true);
    console.warn('All connections were unhealthy, resetting health status');
  }
  
  // Use weighted selection
  currentRound++;
  const targetConn = connections.find(conn => conn.healthy && 
    currentRound % (conn.weight * 10) < conn.weight * 10 / 2);
  
  if (targetConn) {
    targetConn.requestCount++;
    targetConn.lastUsed = Date.now();
    return targetConn.connection;
  }
  
  // Fallback to first healthy connection
  const fallback = connections.find(conn => conn.healthy) || connections[0];
  fallback.requestCount++;
  fallback.lastUsed = Date.now();
  return fallback.connection;
}

/**
 * Get transaction-specific connection
 * Always use the primary Syndica connection for transactions
 */
function getTransactionConnection() {
  return connections[0].connection;
}

/**
 * Mark connection as unhealthy
 */
function markUnhealthy(connectionName: string) {
  const conn = connections.find(c => c.name === connectionName);
  if (conn) {
    conn.errorCount++;
    if (conn.errorCount > 3) {
      conn.healthy = false;
      console.warn(`Connection ${connectionName} marked as unhealthy after ${conn.errorCount} errors`);
      
      // Reset error count after 1 minute
      setTimeout(() => {
        conn.healthy = true;
        conn.errorCount = 0;
        console.log(`Connection ${connectionName} health reset`);
      }, 60000);
    }
  }
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
    // Mark the connection as potentially unhealthy
    const connIndex = connections.findIndex(c => c.connection === conn);
    if (connIndex >= 0) {
      markUnhealthy(connections[connIndex].name);
    }
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
    // Mark the connection as potentially unhealthy
    const connIndex = connections.findIndex(c => c.connection === conn);
    if (connIndex >= 0) {
      markUnhealthy(connections[connIndex].name);
    }
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
    // Mark the connection as potentially unhealthy
    const connIndex = connections.findIndex(c => c.connection === conn);
    if (connIndex >= 0) {
      markUnhealthy(connections[connIndex].name);
    }
    throw error;
  }
}

/**
 * Send transaction - always use primary Syndica endpoint for consistency
 */
export async function sendTransaction(
  transaction: Transaction | VersionedTransaction | Buffer | Uint8Array,
  options?: SendOptions
) {
  // Always use the first connection for transactions for consistency
  const conn = getTransactionConnection();
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
 * Confirm transaction - always use the same connection that sent it
 */
export async function confirmTransaction(signature: string, commitment?: string) {
  // Use the same connection that sent the transaction
  const conn = getTransactionConnection();
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
    // Mark the connection as potentially unhealthy
    const connIndex = connections.findIndex(c => c.connection === conn);
    if (connIndex >= 0) {
      markUnhealthy(connections[connIndex].name);
    }
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
    // Mark the connection as potentially unhealthy
    const connIndex = connections.findIndex(c => c.connection === conn);
    if (connIndex >= 0) {
      markUnhealthy(connections[connIndex].name);
    }
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
    healthy: conn.healthy,
    errorCount: conn.errorCount,
    weight: conn.weight
  }));
}

// Log connection setup
console.log('[Ultimate RPC Manager] Initialized with 3 premium endpoints');

// Export default connection for compatibility
export default getNextConnection();
