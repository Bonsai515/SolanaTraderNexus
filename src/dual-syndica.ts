/**
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
    url: 'https://solana-api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk/rpc',
    websocket: 'wss://chainstream.api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk',
    priority: 1
  },
  {
    name: 'Syndica Premium 2',
    url: 'https://solana-api.syndica.io/api-key/pCvktxK4Qc2JhNhVme1gpW9yZYxpVi53tQqroouPqJLtssQV28hVkaDk5zjL7W9SY7GPic9AqTXhRBMvdVemjd3vRHs1ypfPci/rpc',
    websocket: 'wss://chainstream.api.syndica.io/api-key/pCvktxK4Qc2JhNhVme1gpW9yZYxpVi53tQqroouPqJLtssQV28hVkaDk5zjL7W9SY7GPic9AqTXhRBMvdVemjd3vRHs1ypfPci',
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
