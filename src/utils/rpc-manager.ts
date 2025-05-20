/**
 * Enhanced Multi-Provider RPC Manager with Rate Limit Protection
 * 
 * This module manages multiple RPC providers with aggressive rate limit protection.
 */

import { Connection, PublicKey, VersionedTransaction, SendOptions } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { throttledRequest, getCacheStats } from './rate-limit-fixer';

// Load config
const CONFIG_PATH = path.join(__dirname, '../config/multi-rpc-config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// Set up connections for each provider
const connections = config.providers
  .filter(provider => provider.inUse)
  .map(provider => ({
    name: provider.name,
    connection: new Connection(provider.url),
    url: provider.url,
    priority: provider.priority,
    weight: provider.weight,
    rateLimit: provider.rateLimit,
    lastUsed: 0,
    errorCount: 0,
    requestCount: 0,
    cooldownUntil: 0
  }));

// Get the best connection based on priority, errors, and load
function getBestConnection() {
  const now = Date.now();
  
  // Filter out connections on cooldown
  const availableConnections = connections.filter(conn => now > conn.cooldownUntil);
  
  if (availableConnections.length === 0) {
    // If all are on cooldown, use the one with shortest cooldown remaining
    connections.sort((a, b) => a.cooldownUntil - b.cooldownUntil);
    return connections[0];
  }
  
  // Sort by priority first, then by errors and request count
  availableConnections.sort((a, b) => {
    // Primary sort by priority (lower value = higher priority)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    
    // Secondary sort by error count
    if (a.errorCount !== b.errorCount) {
      return a.errorCount - b.errorCount;
    }
    
    // Tertiary sort by recent usage and weight
    const aLoad = a.requestCount / a.weight;
    const bLoad = b.requestCount / b.weight;
    return aLoad - bLoad;
  });
  
  return availableConnections[0];
}

// Register a successful request
function registerSuccess(connection) {
  connection.lastUsed = Date.now();
  connection.requestCount++;
  
  // Reset consecutive error counter on success
  connection.consecutiveErrors = 0;
}

// Register a failed request
function registerError(connection) {
  connection.errorCount++;
  connection.consecutiveErrors = (connection.consecutiveErrors || 0) + 1;
  
  // Apply exponential backoff for consecutive errors
  if (connection.consecutiveErrors >= 3) {
    const cooldownMs = Math.min(60000, Math.pow(2, connection.consecutiveErrors) * 1000);
    connection.cooldownUntil = Date.now() + cooldownMs;
    console.log(`[RPC Manager] Cooling down ${connection.name} for ${cooldownMs/1000}s due to errors`);
  }
}

// Make a throttled RPC request with rate limiting
async function makeRequest(method, params = []) {
  // Try each connection until success
  let lastError;
  
  for (let attempt = 0; attempt < config.fallback.maxRetries; attempt++) {
    const connection = getBestConnection();
    
    try {
      console.log(`[RPC Manager] Using ${connection.name} for ${method}`);
      
      // Make the request with throttling
      const result = await throttledRequest(
        () => connection.connection.rpcRequest(method, params),
        method,
        params
      );
      
      registerSuccess(connection);
      return result;
    } catch (error) {
      console.error(`[RPC Manager] Error with ${connection.name}: ${error.message}`);
      registerError(connection);
      lastError = error;
      
      // Wait before retry if needed
      if (attempt < config.fallback.maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, config.fallback.retryDelayMs));
      }
    }
  }
  
  // If we got here, all connections failed
  throw lastError || new Error('All RPC providers failed');
}

// Periodic connection health check
function startHealthCheck() {
  setInterval(async () => {
    for (const connection of connections) {
      try {
        // Use throttled request for health checks too
        await throttledRequest(
          () => connection.connection.getSlot(),
          'getSlot',
          []
        );
        console.log(`[RPC Manager] Health check OK: ${connection.name}`);
        
        // Reset error count on successful health check
        if (connection.errorCount > 0) {
          connection.errorCount = Math.max(0, connection.errorCount - 1);
        }
      } catch (error) {
        console.error(`[RPC Manager] Health check failed: ${connection.name}`);
        registerError(connection);
      }
    }
    
    // Log cache stats
    const stats = getCacheStats();
    console.log(`[RPC Manager] Cache stats: ${JSON.stringify(stats)}`);
  }, config.loadBalancing.healthCheckIntervalMs);
}

// Start health checks if enabled
if (config.loadBalancing.enabled) {
  startHealthCheck();
}

// Exported methods that mirror the Connection API
export async function getBalance(pubkey: string | PublicKey): Promise<number> {
  const address = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
  return makeRequest('getBalance', [address]);
}

export async function getAccountInfo(pubkey: string | PublicKey, commitment?: string): Promise<any> {
  const address = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
  return makeRequest('getAccountInfo', [address, {commitment, encoding: 'jsonParsed'}]);
}

export async function getRecentBlockhash(): Promise<string> {
  const result = await makeRequest('getLatestBlockhash');
  return result.blockhash;
}

export async function sendTransaction(
  transaction: VersionedTransaction | Buffer | Uint8Array | string,
  options?: SendOptions
): Promise<string> {
  // Try sending on all providers until one succeeds - but still throttled
  let lastError;
  
  for (const connection of connections) {
    try {
      // Use a throttled request that bypasses cache
      const signature = await throttledRequest(
        () => connection.connection.sendRawTransaction(
          transaction instanceof VersionedTransaction ? transaction.serialize() : transaction,
          options
        ),
        'sendTransaction', 
        []  // Don't include tx data in cache key
      );
      
      registerSuccess(connection);
      return signature;
    } catch (error) {
      console.error(`[RPC Manager] Error sending transaction with ${connection.name}: ${error.message}`);
      registerError(connection);
      lastError = error;
    }
  }
  
  throw lastError || new Error('Failed to send transaction on all providers');
}

export async function confirmTransaction(signature: string, commitment?: string): Promise<any> {
  // Don't cache confirmations, but still throttle
  const conn = getBestConnection();
  try {
    const result = await throttledRequest(
      () => conn.connection.confirmTransaction(signature, commitment),
      'confirmTransaction',
      [signature]
    );
    registerSuccess(conn);
    return result;
  } catch (error) {
    registerError(conn);
    throw error;
  }
}

export async function getTokenAccountsByOwner(
  owner: string | PublicKey,
  filter: any,
  commitment?: string
): Promise<any> {
  const ownerAddress = typeof owner === 'string' ? owner : owner.toBase58();
  return makeRequest('getTokenAccountsByOwner', [ownerAddress, filter, {commitment, encoding: 'jsonParsed'}]);
}

export async function getProgramAccounts(
  programId: string | PublicKey,
  config?: any
): Promise<any> {
  const programAddress = typeof programId === 'string' ? programId : programId.toBase58();
  return makeRequest('getProgramAccounts', [programAddress, config]);
}

// Get current connection health and stats
export function getConnectionStats() {
  const cacheStats = getCacheStats();
  
  return {
    connections: connections.map(conn => ({
      name: conn.name,
      priority: conn.priority,
      weight: conn.weight,
      requestCount: conn.requestCount,
      errorCount: conn.errorCount,
      cooldownUntil: conn.cooldownUntil > Date.now() ? new Date(conn.cooldownUntil).toISOString() : null,
      url: conn.url
    })),
    cacheStats
  };
}

// Export a raw connection for cases where direct access is needed
export function getRawConnection() {
  return getBestConnection().connection;
}