/**
 * Premium RPC Manager (Syndica Only)
 * 
 * This module manages your premium Syndica RPC connection with
 * aggressive rate limiting and caching to avoid hitting limits.
 */

import { Connection, PublicKey, VersionedTransaction, SendOptions } from '@solana/web3.js';
import scheduler from './request-scheduler';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Constants
const CACHE_DIR = path.join(__dirname, '../../data/rpc_cache');
const CONFIG_PATH = path.join(__dirname, '../../config/premium-rpc-config.json');
const MAX_REQUESTS_PER_SECOND = 2;

// Create cache directory if it doesn't exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// In-memory cache
const memoryCache = new Map();

// Load config
let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (error) {
  console.error('[Premium RPC] Error loading config, using defaults:', error);
  config = {
    providers: [{
      name: "Syndica",
      url: "https://solana-api.syndica.io/rpc",
      websocketUrl: "wss://solana-api.syndica.io/rpc"
    }],
    caching: {
      enabled: true,
      accountInfoTtlMs: 300000,
      balanceTtlMs: 300000,
      transactionTtlMs: 3600000,
      blockTtlMs: 600000,
      slotTtlMs: 120000
    }
  };
}

// Create Syndica connection
const rpcUrl = config.providers[0].url;
const connection = new Connection(rpcUrl);

console.log(`[Premium RPC] Initialized with Syndica: ${rpcUrl}`);

// Cache helpers
function getCacheKey(method: string, params: any[]): string {
  const paramsString = JSON.stringify(params);
  return crypto.createHash('md5').update(`${method}:${paramsString}`).digest('hex');
}

function getCachedData(key: string, ttlMs: number): any {
  // Check memory cache first
  if (memoryCache.has(key)) {
    const cached = memoryCache.get(key);
    if (Date.now() < cached.expiry) {
      return cached.data;
    }
    memoryCache.delete(key);
  }
  
  // Then check disk cache
  const cacheFile = path.join(CACHE_DIR, `${key}.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      const stats = fs.statSync(cacheFile);
      const fileAge = Date.now() - stats.mtimeMs;
      
      if (fileAge < ttlMs) {
        const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        
        // Store in memory for faster access next time
        memoryCache.set(key, {
          data,
          expiry: Date.now() + ttlMs
        });
        
        return data;
      }
    } catch (error) {
      console.error('[Premium RPC] Cache read error:', error);
    }
  }
  
  return null;
}

function saveToCacheAsync(key: string, data: any, ttlMs: number): void {
  // Save to memory cache immediately
  memoryCache.set(key, {
    data,
    expiry: Date.now() + ttlMs
  });
  
  // Save to disk cache in the background
  setTimeout(() => {
    try {
      const cacheFile = path.join(CACHE_DIR, `${key}.json`);
      fs.writeFileSync(cacheFile, JSON.stringify(data));
    } catch (error) {
      console.error('[Premium RPC] Cache write error:', error);
    }
  }, 0);
}

// Get TTL based on method
function getTtlForMethod(method: string): number {
  switch (true) {
    case method.includes('getTransaction') || method.includes('getSignature'):
      return config.caching.transactionTtlMs;
    case method.includes('getAccountInfo'):
      return config.caching.accountInfoTtlMs;
    case method.includes('getBalance'):
      return config.caching.balanceTtlMs;
    case method.includes('getSlot'):
      return config.caching.slotTtlMs;
    case method.includes('getBlock'):
      return config.caching.blockTtlMs;
    case method.includes('getTokenAccountsByOwner'):
      return 180000; // 3 minutes
    case method.includes('getProgramAccounts'):
      return 300000; // 5 minutes
    case method.includes('getRecentBlockhash') || method.includes('getLatestBlockhash'):
      return 60000; // 1 minute
    default:
      return 60000; // Default: 1 minute
  }
}

// Make a request with caching and scheduling
async function makeRequest(method: string, params: any[] = [], priority = 1): Promise<any> {
  // Skip cache for certain methods
  const skipCache = [
    'sendTransaction',
    'simulateTransaction',
    'requestAirdrop'
  ].some(m => method.includes(m));
  
  // Get cache TTL
  const ttl = getTtlForMethod(method);
  
  // Use cache if available and applicable
  if (config.caching.enabled && !skipCache) {
    const cacheKey = getCacheKey(method, params);
    const cachedData = getCachedData(cacheKey, ttl);
    
    if (cachedData !== null) {
      return cachedData;
    }
  }
  
  // Schedule the request
  return scheduler.schedule(async () => {
    try {
      // Execute the request
      const response = await connection.rpcRequest(method, params);
      
      // Cache the result if enabled and applicable
      if (config.caching.enabled && !skipCache && response.result) {
        const cacheKey = getCacheKey(method, params);
        saveToCacheAsync(cacheKey, response.result, ttl);
      }
      
      return response.result;
    } catch (error) {
      console.error(`[Premium RPC] Error executing ${method}:`, error);
      throw error;
    }
  }, priority);
}

// Export API methods
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
  // Transactions get highest priority
  return scheduler.schedule(async () => {
    return connection.sendRawTransaction(
      transaction instanceof VersionedTransaction ? transaction.serialize() : transaction,
      options
    );
  }, 10); // High priority (10)
}

export async function confirmTransaction(signature: string, commitment?: string): Promise<any> {
  return scheduler.schedule(async () => {
    return connection.confirmTransaction(signature, commitment);
  }, 5); // Medium-high priority (5)
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

// Clean up cache periodically
setInterval(() => {
  const now = Date.now();
  let removedCount = 0;
  
  // Clean memory cache
  for (const [key, value] of memoryCache.entries()) {
    if (value.expiry < now) {
      memoryCache.delete(key);
      removedCount++;
    }
  }
  
  // Clean disk cache (once an hour)
  if (Math.random() < 0.01) { // 1% chance to run on each interval
    try {
      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        const filePath = path.join(CACHE_DIR, file);
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtimeMs;
        
        // Delete files older than 24 hours
        if (fileAge > 24 * 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error('[Premium RPC] Error cleaning disk cache:', error);
    }
  }
  
  if (removedCount > 0) {
    console.log(`[Premium RPC] Cleaned up ${removedCount} expired cache entries`);
  }
}, 10000); // Every 10 seconds

// Get the raw connection (for compatibility)
export function getRawConnection(): Connection {
  return connection;
}

// Get scheduler stats
export function getStats() {
  return {
    scheduler: scheduler.getStats(),
    cacheSize: memoryCache.size
  };
}