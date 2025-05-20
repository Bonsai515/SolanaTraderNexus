/**
 * Multi-Provider RPC Manager
 * 
 * This module manages multiple RPC providers and handles failover,
 * load balancing, and caching.
 */

import { Connection, PublicKey, VersionedTransaction, SendOptions } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

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

// Cache implementation
const cache = new Map();

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
    const cooldownMs = Math.min(30000, Math.pow(2, connection.consecutiveErrors) * 1000);
    connection.cooldownUntil = Date.now() + cooldownMs;
    console.log(`[RPC Manager] Cooling down ${connection.name} for ${cooldownMs/1000}s due to errors`);
  }
}

// Make a cached RPC request
async function makeRequest(method, params = []) {
  // Generate cache key
  const cacheKey = `${method}:${JSON.stringify(params)}`;
  
  // Check cache first
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() < cached.expiry) {
      return cached.data;
    }
  }
  
  // Try each connection until success
  let lastError;
  
  for (let attempt = 0; attempt < config.fallback.maxRetries; attempt++) {
    const connection = getBestConnection();
    
    try {
      console.log(`[RPC Manager] Using ${connection.name} for ${method}`);
      
      // Make the request
      const response = await connection.connection.rpcRequest(method, params);
      registerSuccess(connection);
      
      // Determine cache TTL based on method
      let ttl = 30000; // Default: 30 seconds
      
      if (method.includes('getTransaction') || method.includes('getSignature')) {
        ttl = config.caching.transactionTtlMs;
      } else if (method.includes('getAccountInfo')) {
        ttl = config.caching.accountInfoTtlMs;
      } else if (method.includes('getBalance')) {
        ttl = config.caching.balanceTtlMs;
      } else if (method.includes('getSlot')) {
        ttl = config.caching.slotTtlMs;
      } else if (method.includes('getBlock')) {
        ttl = config.caching.blockTtlMs;
      }
      
      // Cache the result
      if (config.caching.enabled) {
        cache.set(cacheKey, {
          data: response.result,
          expiry: Date.now() + ttl
        });
      }
      
      return response.result;
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
        await connection.connection.getSlot();
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
  // Try sending on all providers until one succeeds
  let lastError;
  
  for (const connection of connections) {
    try {
      // Don't use higher level makeRequest to avoid caching and stay close to native API
      const signature = await connection.connection.sendRawTransaction(
        transaction instanceof VersionedTransaction ? transaction.serialize() : transaction,
        options
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
  // Don't cache confirmations
  const conn = getBestConnection();
  try {
    const result = await conn.connection.confirmTransaction(signature, commitment);
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
  return connections.map(conn => ({
    name: conn.name,
    priority: conn.priority,
    weight: conn.weight,
    requestCount: conn.requestCount,
    errorCount: conn.errorCount,
    cooldownUntil: conn.cooldownUntil > Date.now() ? new Date(conn.cooldownUntil).toISOString() : null,
    url: conn.url
  }));
}

// Periodically clean up cache
setInterval(() => {
  const now = Date.now();
  let removedCount = 0;
  
  for (const [key, value] of cache.entries()) {
    if (value.expiry < now) {
      cache.delete(key);
      removedCount++;
    }
  }
  
  if (removedCount > 0) {
    console.log(`[RPC Manager] Cleaned up ${removedCount} expired cache entries`);
  }
}, 60000); // Every minute

// Export a raw connection for cases where direct access is needed
export function getRawConnection() {
  return getBestConnection().connection;
}