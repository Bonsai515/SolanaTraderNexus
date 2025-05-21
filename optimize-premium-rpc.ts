/**
 * Optimize Premium RPC Usage
 * 
 * This script configures your system to most efficiently use your
 * premium Syndica RPC endpoint while minimizing rate limit issues.
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

console.log('=== OPTIMIZING PREMIUM RPC USAGE (SYNDICA) ===');

// Constants
const HP_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const CONFIG_DIR = './config';
const MAX_RPC_REQUESTS_PER_SECOND = 2; // Extremely conservative rate limit

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Create optimized RPC config with just Syndica
const rpcConfig = {
  providers: [
    {
      name: "Syndica",
      url: "https://solana-api.syndica.io/rpc",
      websocketUrl: "wss://solana-api.syndica.io/rpc",
      priority: 1,
      weight: 100,
      rateLimit: { requestsPerMinute: 300 },
      inUse: true
    }
  ],
  caching: {
    enabled: true,
    accountInfoTtlMs: 300000,     // 5 minutes
    balanceTtlMs: 300000,         // 5 minutes
    transactionTtlMs: 3600000,    // 1 hour
    blockTtlMs: 600000,           // 10 minutes
    slotTtlMs: 120000             // 2 minutes
  },
  fallback: {
    enabled: false,               // No fallback, just use Syndica
    maxRetries: 5,
    retryDelayMs: 1000
  },
  loadBalancing: {
    enabled: false,               // No load balancing with single provider
    strategy: "priority-only",
    healthCheckIntervalMs: 300000 // Reduced health check frequency (5 minutes)
  },
  streaming: {
    enabled: true,
    maxSubscriptions: 10,         // Reduced from 20
    reconnectOnError: true,
    reconnectIntervalMs: 5000     // Increased delay
  },
  rateLimit: {
    enabled: true,
    strategy: "fixed",
    maxRequestsPerSecond: MAX_RPC_REQUESTS_PER_SECOND,       // Very conservative
    maxRequestsPerMinute: 100,    // Very conservative
    maxRequestsPerHour: 2000      // Very conservative
  },
  mainWalletAddress: HP_WALLET
};

// Write optimized RPC config
const RPC_CONFIG_PATH = path.join(CONFIG_DIR, 'premium-rpc-config.json');
fs.writeFileSync(RPC_CONFIG_PATH, JSON.stringify(rpcConfig, null, 2));
console.log(`✅ Created optimized premium RPC config at ${RPC_CONFIG_PATH}`);

// Update environment variables
const envVars = `
# Premium RPC Optimization (Syndica only)
RPC_URL=https://solana-api.syndica.io/rpc
SOLANA_RPC=https://solana-api.syndica.io/rpc
WEBSOCKET_URL=wss://solana-api.syndica.io/rpc
USE_SYNDICA=true
USE_ALCHEMY=false
USE_HELIUS=false
USE_INSTANT_NODES=false
PRIMARY_PROVIDER=syndica
DISABLE_MULTI_PROVIDER=true
USE_PREMIUM_ONLY=true
MAX_RPC_REQUESTS_PER_SECOND=${MAX_RPC_REQUESTS_PER_SECOND}
USE_EXTREME_CACHING=true
DISABLE_BACKGROUND_TASKS=true
REDUCE_POLLING_FREQUENCY=true
`;

// Create premium RPC environment config
fs.writeFileSync('./.env.premium-rpc', envVars);
console.log('✅ Created premium RPC environment configuration');

// Create scheduler to space out RPC requests
const schedulerCode = `/**
 * RPC Request Scheduler
 * 
 * This module ensures RPC requests are evenly distributed
 * to avoid hitting rate limits.
 */

class RequestScheduler {
  private queue: Array<{
    execute: () => Promise<any>;
    resolve: (result: any) => void;
    reject: (error: any) => void;
    priority: number;
  }> = [];
  
  private processing = false;
  private requestsThisSecond = 0;
  private requestsThisMinute = 0;
  private lastSecondReset = Date.now();
  private lastMinuteReset = Date.now();
  private maxRequestsPerSecond: number;
  
  constructor(maxRequestsPerSecond = ${MAX_RPC_REQUESTS_PER_SECOND}) {
    this.maxRequestsPerSecond = maxRequestsPerSecond;
    
    // Reset counters periodically
    setInterval(() => {
      const now = Date.now();
      
      if (now - this.lastSecondReset >= 1000) {
        this.requestsThisSecond = 0;
        this.lastSecondReset = now;
      }
      
      if (now - this.lastMinuteReset >= 60000) {
        this.requestsThisMinute = 0;
        this.lastMinuteReset = now;
      }
      
      // Process queue if available
      if (this.queue.length > 0 && !this.processing) {
        this.processQueue();
      }
    }, 50); // Check frequently
  }
  
  /**
   * Schedule a request with the given priority
   */
  public schedule<T>(
    execute: () => Promise<T>,
    priority = 1
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute,
        resolve,
        reject,
        priority
      });
      
      // Start processing if not already
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Process the request queue
   */
  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    try {
      // Check if we can make a request
      if (this.requestsThisSecond < this.maxRequestsPerSecond) {
        // Sort by priority (higher number = higher priority)
        this.queue.sort((a, b) => b.priority - a.priority);
        
        const request = this.queue.shift();
        if (request) {
          this.requestsThisSecond++;
          this.requestsThisMinute++;
          
          try {
            const result = await request.execute();
            request.resolve(result);
          } catch (error) {
            request.reject(error);
          }
        }
      } else {
        // Need to wait for rate limit reset
        await new Promise(resolve => setTimeout(resolve, 
          1000 - (Date.now() - this.lastSecondReset) + 50));
      }
    } finally {
      this.processing = false;
      
      // If there are more items, continue processing
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 10);
      }
    }
  }
  
  /**
   * Get current scheduler stats
   */
  public getStats() {
    return {
      queueLength: this.queue.length,
      requestsThisSecond: this.requestsThisSecond,
      requestsThisMinute: this.requestsThisMinute,
      maxRequestsPerSecond: this.maxRequestsPerSecond
    };
  }
}

// Export singleton instance
export const scheduler = new RequestScheduler();
export default scheduler;`;

const schedulerDir = './src/utils';
if (!fs.existsSync(schedulerDir)) {
  fs.mkdirSync(schedulerDir, { recursive: true });
}

fs.writeFileSync(path.join(schedulerDir, 'request-scheduler.ts'), schedulerCode);
console.log('✅ Created RPC request scheduler');

// Create RPC manager specifically for premium RPC
const rpcManagerCode = `/**
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
const MAX_REQUESTS_PER_SECOND = ${MAX_RPC_REQUESTS_PER_SECOND};

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

console.log(\`[Premium RPC] Initialized with Syndica: \${rpcUrl}\`);

// Cache helpers
function getCacheKey(method: string, params: any[]): string {
  const paramsString = JSON.stringify(params);
  return crypto.createHash('md5').update(\`\${method}:\${paramsString}\`).digest('hex');
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
  const cacheFile = path.join(CACHE_DIR, \`\${key}.json\`);
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
      const cacheFile = path.join(CACHE_DIR, \`\${key}.json\`);
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
      console.error(\`[Premium RPC] Error executing \${method}:\`, error);
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
    console.log(\`[Premium RPC] Cleaned up \${removedCount} expired cache entries\`);
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
}`;

fs.writeFileSync(path.join(schedulerDir, 'premium-rpc.ts'), rpcManagerCode);
console.log('✅ Created premium RPC manager');

// Create startup script
const startupScript = `#!/bin/bash
# Launch with Premium RPC Optimization

echo "========================================"
echo "  LAUNCHING WITH PREMIUM RPC (SYNDICA)  "
echo "========================================"

# Stop running processes
echo "Stopping current processes..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Set environment variables
export RPC_URL=https://solana-api.syndica.io/rpc
export SOLANA_RPC=https://solana-api.syndica.io/rpc
export WEBSOCKET_URL=wss://solana-api.syndica.io/rpc
export USE_SYNDICA=true
export USE_ALCHEMY=false
export USE_HELIUS=false
export USE_INSTANT_NODES=false
export PRIMARY_PROVIDER=syndica
export DISABLE_MULTI_PROVIDER=true
export USE_PREMIUM_ONLY=true
export MAX_RPC_REQUESTS_PER_SECOND=${MAX_RPC_REQUESTS_PER_SECOND}
export USE_EXTREME_CACHING=true
export DISABLE_BACKGROUND_TASKS=true
export REDUCE_POLLING_FREQUENCY=true
export SYSTEM_WALLET=${HP_WALLET}
export TRADING_WALLET=${HP_WALLET}
export MAIN_WALLET=${HP_WALLET}
export WALLET_ADDRESS=${HP_WALLET}

# Launch trading system
echo "Launching trading system with premium RPC optimization..."
npx tsx activate-live-trading.ts

echo "System launched with premium RPC optimization"
echo "========================================"
`;

fs.writeFileSync('./launch-premium-rpc.sh', startupScript);
fs.chmodSync('./launch-premium-rpc.sh', 0o755);
console.log('✅ Created launch script at ./launch-premium-rpc.sh');

console.log('\n=== PREMIUM RPC OPTIMIZATION COMPLETE ===');
console.log('Your system is now configured to efficiently use your premium Syndica RPC:');
console.log('1. Aggressive scheduling of only 2 requests per second maximum');
console.log('2. Multi-level caching (memory + disk) with extended durations');
console.log('3. Priority-based request execution (transactions get top priority)');
console.log('\nTo launch with this premium RPC optimization, run:');
console.log('./launch-premium-rpc.sh');
console.log('\nAfter tomorrow\'s upgrades, you can adjust the MAX_RPC_REQUESTS_PER_SECOND in the script');