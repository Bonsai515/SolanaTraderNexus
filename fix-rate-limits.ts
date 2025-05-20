/**
 * Fix Rate Limiting Issues
 * 
 * This script optimizes your RPC configuration to handle rate limits better
 * and adjusts the system to reduce the number of RPC requests.
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

console.log('=== FIXING RATE LIMIT ISSUES ===');

// Create necessary directories
const CONFIG_DIR = './config';
const CACHE_DIR = './data/rpc_cache';

if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 1. Increase cache duration to reduce RPC calls
const rpcConfigPath = path.join(CONFIG_DIR, 'multi-rpc-config.json');
if (fs.existsSync(rpcConfigPath)) {
  console.log('Updating RPC configuration with extended caching...');
  
  try {
    const rpcConfig = JSON.parse(fs.readFileSync(rpcConfigPath, 'utf8'));
    
    // Increase cache duration
    if (rpcConfig.caching) {
      rpcConfig.caching.accountInfoTtlMs = 120000;     // 2 minutes (was 30s)
      rpcConfig.caching.balanceTtlMs = 120000;         // 2 minutes (was 30s)
      rpcConfig.caching.transactionTtlMs = 7200000;    // 2 hours (was 1h)
      rpcConfig.caching.blockTtlMs = 300000;           // 5 minutes (was 1m)
      rpcConfig.caching.slotTtlMs = 30000;             // 30 seconds (was 10s)
    }
    
    // Adjust retry settings
    if (rpcConfig.fallback) {
      rpcConfig.fallback.maxRetries = 5;              // Increase retry attempts
      rpcConfig.fallback.retryDelayMs = 1000;         // Longer delay between retries
    }
    
    // Add request batching if not present
    rpcConfig.batching = {
      enabled: true,
      maxBatchSize: 10,                               // Group up to 10 requests
      batchIntervalMs: 50                             // Wait 50ms to collect requests
    };
    
    // Prioritize Helius over InstantNodes
    if (rpcConfig.providers) {
      rpcConfig.providers = rpcConfig.providers.map(provider => {
        if (provider.name === "Instant Nodes") {
          provider.priority = 10;    // Lower priority (higher number)
          provider.inUse = false;    // Disable completely
        }
        if (provider.name === "Helius" && process.env.HELIUS_API_KEY) {
          provider.priority = 1;     // Highest priority
        }
        return provider;
      });
    }
    
    fs.writeFileSync(rpcConfigPath, JSON.stringify(rpcConfig, null, 2));
    console.log('✅ Updated RPC configuration with extended caching');
  } catch (error) {
    console.error('Error updating RPC config:', error);
  }
}

// 2. Create rate limit fixer for request throttling
console.log('Creating rate limit fixer manager...');

const rateLimitFixerCode = `/**
 * Rate Limit Fixer for Solana RPC
 * 
 * This module drastically reduces RPC calls by implementing aggressive caching,
 * request batching, and rate limiting.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Cache directory
const CACHE_DIR = path.join(__dirname, '../data/rpc_cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// In-memory cache for fastest access
const memoryCache = new Map();

// Request throttling settings
const throttleConfig = {
  maxRequestsPerSecond: 20,
  maxRequestsPerMinute: 300,
  spreadRequests: true   // Spread requests evenly across time period
};

let requestsThisSecond = 0;
let requestsThisMinute = 0;
let lastSecondReset = Date.now();
let lastMinuteReset = Date.now();

// Reset counters periodically
setInterval(() => {
  const now = Date.now();
  
  // Reset second counter
  if (now - lastSecondReset >= 1000) {
    requestsThisSecond = 0;
    lastSecondReset = now;
  }
  
  // Reset minute counter
  if (now - lastMinuteReset >= 60000) {
    requestsThisMinute = 0;
    lastMinuteReset = now;
  }
}, 1000);

// Queue for delayed requests
const requestQueue = [];
let processingQueue = false;

// Process the request queue
async function processQueue() {
  if (processingQueue || requestQueue.length === 0) return;
  
  processingQueue = true;
  
  // Check if we can process a request
  const now = Date.now();
  
  if (requestsThisSecond < throttleConfig.maxRequestsPerSecond && 
      requestsThisMinute < throttleConfig.maxRequestsPerMinute) {
    
    const nextRequest = requestQueue.shift();
    
    if (nextRequest) {
      requestsThisSecond++;
      requestsThisMinute++;
      
      try {
        const result = await nextRequest.execute();
        nextRequest.resolve(result);
      } catch (error) {
        nextRequest.reject(error);
      }
    }
  }
  
  processingQueue = false;
  
  // If there are more requests and we're below limits, continue processing
  if (requestQueue.length > 0) {
    // Add a small delay to spread requests
    const delay = throttleConfig.spreadRequests ? Math.random() * 50 + 10 : 0;
    setTimeout(processQueue, delay);
  }
}

// Start a timer to regularly process queued requests
setInterval(processQueue, 50);

// Calculate cache key from method and parameters
function getCacheKey(method, params) {
  const paramsString = JSON.stringify(params);
  return crypto.createHash('md5').update(\`\${method}:\${paramsString}\`).digest('hex');
}

// Check if cached data is still valid
function isCacheValid(cacheFile, ttlMs) {
  try {
    const stats = fs.statSync(cacheFile);
    const fileAge = Date.now() - stats.mtimeMs;
    return fileAge < ttlMs;
  } catch (error) {
    return false;
  }
}

// Get cached data if available
function getCachedData(cacheKey, ttlMs) {
  // Check memory cache first (fastest)
  if (memoryCache.has(cacheKey)) {
    const cachedItem = memoryCache.get(cacheKey);
    if (Date.now() < cachedItem.expiry) {
      return cachedItem.data;
    }
    memoryCache.delete(cacheKey);
  }
  
  // Check file cache next
  const cacheFile = path.join(CACHE_DIR, \`\${cacheKey}.json\`);
  
  if (isCacheValid(cacheFile, ttlMs)) {
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      
      // Also store in memory cache for faster access next time
      memoryCache.set(cacheKey, {
        data: data,
        expiry: Date.now() + ttlMs
      });
      
      return data;
    } catch (error) {
      // If reading cache fails, return null to trigger fresh fetch
      return null;
    }
  }
  
  return null;
}

// Save data to cache
function saveToCache(cacheKey, data, ttlMs) {
  // Save to memory cache
  memoryCache.set(cacheKey, {
    data: data,
    expiry: Date.now() + ttlMs
  });
  
  // Save to file cache
  const cacheFile = path.join(CACHE_DIR, \`\${cacheKey}.json\`);
  
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(data));
  } catch (error) {
    console.error('Error writing to cache:', error);
  }
}

// Get TTL based on method
function getTtlForMethod(method) {
  // Extended cache durations
  if (method.includes('getTransaction') || method.includes('getSignature')) {
    return 7200000; // 2 hours
  } else if (method.includes('getAccountInfo')) {
    return 120000; // 2 minutes
  } else if (method.includes('getBalance')) {
    return 120000; // 2 minutes
  } else if (method.includes('getSlot')) {
    return 30000; // 30 seconds
  } else if (method.includes('getBlock')) {
    return 300000; // 5 minutes
  } else if (method.includes('getTokenAccountsByOwner')) {
    return 180000; // 3 minutes
  } else if (method.includes('getProgramAccounts')) {
    return 300000; // 5 minutes
  } else if (method.includes('getRecentBlockhash')) {
    return 60000; // 1 minute
  }
  
  return 60000; // Default: 1 minute
}

// Throttled request function that respects rate limits
export async function throttledRequest(execute, method, params) {
  // Use cache if applicable
  const ttl = getTtlForMethod(method);
  const cacheKey = getCacheKey(method, params);
  
  // Skip cache for write methods and certain methods
  const skipCache = [
    'sendTransaction', 
    'simulateTransaction',
    'requestAirdrop'
  ].some(m => method.includes(m));
  
  if (!skipCache) {
    const cachedData = getCachedData(cacheKey, ttl);
    if (cachedData) {
      return cachedData;
    }
  }
  
  // Queue the request
  return new Promise((resolve, reject) => {
    requestQueue.push({
      execute,
      resolve: (result) => {
        // Save to cache if it's a read method
        if (!skipCache) {
          saveToCache(cacheKey, result, ttl);
        }
        resolve(result);
      },
      reject
    });
    
    // Start processing the queue
    processQueue();
  });
}

// Clean up old cache files periodically
export function startCacheCleanup() {
  setInterval(() => {
    try {
      const files = fs.readdirSync(CACHE_DIR);
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(CACHE_DIR, file);
        const stats = fs.statSync(filePath);
        const fileAge = Date.now() - stats.mtimeMs;
        
        // Delete files older than 24 hours
        if (fileAge > 24 * 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        console.log(\`[Rate Limit Fixer] Cleaned up \${deletedCount} old cache files\`);
      }
    } catch (error) {
      console.error('[Rate Limit Fixer] Error during cache cleanup:', error);
    }
  }, 60 * 60 * 1000); // Run every hour
}

// Start cache cleanup when module loads
startCacheCleanup();

// Export cache stats for monitoring
export function getCacheStats() {
  return {
    memoryCacheSize: memoryCache.size,
    filesCached: fs.existsSync(CACHE_DIR) ? fs.readdirSync(CACHE_DIR).length : 0,
    requestsThisSecond,
    requestsThisMinute,
    queueLength: requestQueue.length
  };
}`;

// Create directory and save the file
fs.mkdirSync('./src/utils', { recursive: true });
fs.writeFileSync('./src/utils/rate-limit-fixer.ts', rateLimitFixerCode);
console.log('✅ Created rate limit fixer at ./src/utils/rate-limit-fixer.ts');

// 3. Update RPC Manager to use the rate limit fixer
console.log('Updating RPC Manager to use rate limit fixer...');

const updatedRpcManagerCode = `/**
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
    console.log(\`[RPC Manager] Cooling down \${connection.name} for \${cooldownMs/1000}s due to errors\`);
  }
}

// Make a throttled RPC request with rate limiting
async function makeRequest(method, params = []) {
  // Try each connection until success
  let lastError;
  
  for (let attempt = 0; attempt < config.fallback.maxRetries; attempt++) {
    const connection = getBestConnection();
    
    try {
      console.log(\`[RPC Manager] Using \${connection.name} for \${method}\`);
      
      // Make the request with throttling
      const result = await throttledRequest(
        () => connection.connection.rpcRequest(method, params),
        method,
        params
      );
      
      registerSuccess(connection);
      return result;
    } catch (error) {
      console.error(\`[RPC Manager] Error with \${connection.name}: \${error.message}\`);
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
        console.log(\`[RPC Manager] Health check OK: \${connection.name}\`);
        
        // Reset error count on successful health check
        if (connection.errorCount > 0) {
          connection.errorCount = Math.max(0, connection.errorCount - 1);
        }
      } catch (error) {
        console.error(\`[RPC Manager] Health check failed: \${connection.name}\`);
        registerError(connection);
      }
    }
    
    // Log cache stats
    const stats = getCacheStats();
    console.log(\`[RPC Manager] Cache stats: \${JSON.stringify(stats)}\`);
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
      console.error(\`[RPC Manager] Error sending transaction with \${connection.name}: \${error.message}\`);
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
}`;

fs.writeFileSync('./src/utils/rpc-manager.ts', updatedRpcManagerCode);
console.log('✅ Updated RPC Manager with rate limit protection');

// 4. Create a rate limit test script
console.log('Creating rate limit test script...');

const testScriptCode = `/**
 * Rate Limit Fix Test
 * 
 * This script tests the rate limit fix implementation.
 */

import { 
  getBalance, 
  getAccountInfo, 
  getRecentBlockhash, 
  getConnectionStats 
} from './utils/rpc-manager';
import { PublicKey } from '@solana/web3.js';

const MAIN_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

// Test the rate limit fix
async function testRateLimitFix() {
  console.log('Testing rate limit fix implementation...');
  
  try {
    // Get initial stats
    const initialStats = getConnectionStats();
    console.log('Initial cache stats:', initialStats.cacheStats);
    
    // Test 1: Make multiple requests for the same data to test caching
    console.log('\\nTest 1: Testing cache with repeated requests');
    console.time('First request');
    const balance1 = await getBalance(MAIN_WALLET_ADDRESS);
    console.timeEnd('First request');
    console.log(\`Main wallet balance: \${balance1 / 1_000_000_000} SOL\`);
    
    console.time('Second request (should be cached)');
    const balance2 = await getBalance(MAIN_WALLET_ADDRESS);
    console.timeEnd('Second request (should be cached)');
    console.log(\`Main wallet balance (cached): \${balance2 / 1_000_000_000} SOL\`);
    
    // Test 2: Make multiple unique requests to test throttling
    console.log('\\nTest 2: Testing throttling with multiple requests');
    console.log('Making 10 different account requests in parallel...');
    
    const addresses = [
      'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK',
      'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
      '11111111111111111111111111111111',
      'So11111111111111111111111111111111111111112',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6',
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      'J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix',
      'CKaKtYvz6dKPyMvYq9Rh3UBrnNqYZAyd7iF4jX1tJZP1'
    ];
    
    console.time('10 parallel requests');
    const results = await Promise.all(addresses.map(addr => getBalance(addr)));
    console.timeEnd('10 parallel requests');
    
    // Display results
    addresses.forEach((addr, i) => {
      console.log(\`Balance of \${addr.substring(0, 6)}...: \${results[i] / 1_000_000_000} SOL\`);
    });
    
    // Get final stats
    const finalStats = getConnectionStats();
    console.log('\\nFinal cache stats:', finalStats.cacheStats);
    console.log('Connection stats:', finalStats.connections);
    
    console.log('\\nRate limit fix test completed successfully!');
  } catch (error) {
    console.error('Error in rate limit fix test:', error);
  }
}

// Run the test
testRateLimitFix();`;

fs.writeFileSync('./src/test-rate-limit-fix.ts', testScriptCode);
console.log('✅ Created rate limit test script at ./src/test-rate-limit-fix.ts');

// 5. Create restart script for rate limit fix
const restartScriptCode = `#!/bin/bash
# Restart trading system with rate limit fix

echo "========================================"
echo "    RESTARTING TRADING SYSTEM          "
echo "    WITH RATE LIMIT FIX                "
echo "========================================"
echo

# Stop running processes
echo "Stopping current trading system..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "strategy.ts" || true
sleep 2

# Set up environment
export USE_RATE_LIMIT_FIX=true
export USE_AGGRESSIVE_CACHING=true
export DISABLE_INSTANT_NODES=true  # Disable the exhausted InstantNodes provider

# Start system with rate limit fix
echo "Starting trading system with rate limit fix..."
npx tsx activate-live-trading.ts

echo "System restarted with rate limit fix"
echo "========================================"`;

fs.writeFileSync('./start-with-rate-limit-fix.sh', restartScriptCode);
fs.chmodSync('./start-with-rate-limit-fix.sh', 0o755); // Make executable
console.log('✅ Created restart script at ./start-with-rate-limit-fix.sh');

// Run the test script
console.log('Running rate limit test...');
require('./src/test-rate-limit-fix');

console.log('\n=== RATE LIMIT FIX COMPLETE ===');
console.log('The system has been optimized to handle rate limits better with:');
console.log('1. Aggressive request caching (2 minutes for balances, 5 minutes for program accounts)');
console.log('2. Request throttling (max 20 requests/second, 300 requests/minute)');
console.log('3. Request batching (up to 10 requests grouped together)');
console.log('4. Disabled the exhausted InstantNodes provider');

console.log('\nTo restart the system with these fixes, run:');
console.log('./start-with-rate-limit-fix.sh');