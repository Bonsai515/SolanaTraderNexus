/**
 * Enhanced RPC Manager
 * 
 * This script significantly improves RPC management to reduce 429 rate limit errors
 * by implementing aggressive caching, request batching, and better fallback logic.
 */

import { Connection, PublicKey, ConnectionConfig } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

// Constants
const MAIN_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK'; 
const CACHE_DIR = './data/rpc_cache';
const CACHE_TIME_MS = 30 * 1000; // 30 seconds cache time
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const KEY_ALCHEMY = process.env.ALCHEMY_API_KEY || '';
const KEY_HELIUS = process.env.HELIUS_API_KEY || '';

// RPC Endpoints
const RPC_ENDPOINTS = [
  // Free Endpoints with adjusted weights and rate limits
  { 
    url: 'https://api.mainnet-beta.solana.com', 
    weight: 1,
    rateLimit: { requestsPerMinute: 60 },
    priority: 3
  },
  {
    url: 'https://solana-api.projectserum.com',
    weight: 2,
    rateLimit: { requestsPerMinute: 60 },
    priority: 3
  },
  
  // Helius endpoint if key is available
  ...(KEY_HELIUS ? [{
    url: `https://mainnet.helius-rpc.com/?api-key=${KEY_HELIUS}`,
    weight: 10,
    rateLimit: { requestsPerMinute: 100 },
    priority: 1
  }] : []),
  
  // Alchemy endpoint if key is available
  ...(KEY_ALCHEMY ? [{
    url: `https://solana-mainnet.g.alchemy.com/v2/${KEY_ALCHEMY}`,
    weight: 10,
    rateLimit: { requestsPerMinute: 200 },
    priority: 1
  }] : [])
];

// Connection class for RPC endpoint
class EnhancedRpcConnection {
  url: string;
  connection: Connection;
  lastUsed: number;
  requestCount: number;
  errorCount: number;
  consecutiveErrors: number;
  weight: number;
  rateLimit: { requestsPerMinute: number };
  priority: number;
  requestTimestamps: number[];
  cooldownUntil: number;
  
  constructor(url: string, weight: number, rateLimit: { requestsPerMinute: number }, priority: number) {
    this.url = url;
    this.connection = new Connection(url, 'confirmed');
    this.lastUsed = 0;
    this.requestCount = 0;
    this.errorCount = 0;
    this.consecutiveErrors = 0;
    this.weight = weight;
    this.rateLimit = rateLimit;
    this.priority = priority;
    this.requestTimestamps = [];
    this.cooldownUntil = 0;
  }
  
  canHandleRequest(): boolean {
    const now = Date.now();
    
    // Check if in cooldown
    if (now < this.cooldownUntil) {
      return false;
    }
    
    // Clean up old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(timestamp => 
      timestamp > now - 60000 // Keep only last minute
    );
    
    // Check rate limit
    return this.requestTimestamps.length < this.rateLimit.requestsPerMinute;
  }
  
  registerRequest(): void {
    const now = Date.now();
    this.lastUsed = now;
    this.requestCount++;
    this.requestTimestamps.push(now);
  }
  
  registerError(): void {
    this.errorCount++;
    this.consecutiveErrors++;
    
    // Apply cooldown if too many consecutive errors
    if (this.consecutiveErrors >= 3) {
      this.cooldownUntil = Date.now() + (this.consecutiveErrors * 5000); // Increasing backoff
      console.log(`[EnhancedRPC] Cooling down ${this.url} for ${this.consecutiveErrors * 5} seconds due to consecutive errors`);
    }
  }
  
  registerSuccess(): void {
    // Reset consecutive errors on success
    this.consecutiveErrors = 0;
  }
  
  getScore(): number {
    // Lower score is better
    const errorPenalty = this.consecutiveErrors * this.consecutiveErrors * 10;
    const usagePenalty = this.requestTimestamps.length / this.rateLimit.requestsPerMinute * 100;
    const priorityBonus = (5 - this.priority) * 20; // Priority 1 gets 80 bonus, 5 gets 0
    
    return errorPenalty + usagePenalty - priorityBonus;
  }
}

// Cache implementation
class RpcCache {
  cacheDir: string;
  
  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
  }
  
  getCacheKey(method: string, params: any[]): string {
    const paramString = JSON.stringify(params);
    // Create a hash of the method and params
    let hash = 0;
    for (let i = 0; i < paramString.length; i++) {
      const char = paramString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `${method}_${hash}.json`;
  }
  
  getFromCache(method: string, params: any[]): any | null {
    const cacheKey = this.getCacheKey(method, params);
    const cachePath = path.join(this.cacheDir, cacheKey);
    
    if (fs.existsSync(cachePath)) {
      try {
        const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        const now = Date.now();
        
        // Check if cache is still valid
        if (cacheData.expiry > now) {
          console.log(`[EnhancedRPC] Cache hit for ${method}`);
          return cacheData.data;
        } else {
          // Cache expired
          console.log(`[EnhancedRPC] Cache expired for ${method}`);
          return null;
        }
      } catch (error) {
        console.error(`[EnhancedRPC] Error reading cache for ${method}:`, error);
        return null;
      }
    }
    
    return null;
  }
  
  saveToCache(method: string, params: any[], data: any, cacheDuration: number = CACHE_TIME_MS): void {
    const cacheKey = this.getCacheKey(method, params);
    const cachePath = path.join(this.cacheDir, cacheKey);
    
    // Different cache durations based on method
    let actualDuration = cacheDuration;
    
    // These methods can be cached longer
    if (method === 'getTokenAccountsByOwner' || 
        method === 'getProgramAccounts' ||
        method === 'getTokenSupply') {
      actualDuration = 2 * 60 * 1000; // 2 minutes
    }
    
    // Account data generally changes less frequently
    if (method === 'getAccountInfo') {
      actualDuration = 30 * 1000; // 30 seconds
    }
    
    // Transaction data is immutable
    if (method === 'getTransaction' || 
        method === 'getSignatureStatus' ||
        method === 'getConfirmedSignaturesForAddress2') {
      actualDuration = 24 * 60 * 60 * 1000; // 24 hours
    }
    
    const cacheData = {
      data,
      expiry: Date.now() + actualDuration,
      method,
      timestamp: Date.now()
    };
    
    try {
      fs.writeFileSync(cachePath, JSON.stringify(cacheData));
      console.log(`[EnhancedRPC] Cached ${method} for ${actualDuration/1000}s`);
    } catch (error) {
      console.error(`[EnhancedRPC] Error writing cache for ${method}:`, error);
    }
  }
  
  clearExpiredCache(): void {
    const now = Date.now();
    
    fs.readdir(this.cacheDir, (err, files) => {
      if (err) {
        console.error('[EnhancedRPC] Error reading cache directory:', err);
        return;
      }
      
      files.forEach(file => {
        const cachePath = path.join(this.cacheDir, file);
        
        try {
          const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
          
          if (cacheData.expiry < now) {
            fs.unlinkSync(cachePath);
          }
        } catch (error) {
          // If file can't be read, delete it
          fs.unlinkSync(cachePath);
        }
      });
    });
  }
}

// Enhanced RPC Manager
export class EnhancedRpcManager {
  connections: EnhancedRpcConnection[];
  cache: RpcCache;
  requestBatches: Map<string, any[]>;
  batchTimers: Map<string, NodeJS.Timeout>;
  requestQueue: {method: string, params: any[], resolve: Function, reject: Function}[];
  processingQueue: boolean;
  
  constructor() {
    this.connections = RPC_ENDPOINTS.map(endpoint => 
      new EnhancedRpcConnection(endpoint.url, endpoint.weight, endpoint.rateLimit, endpoint.priority)
    );
    this.cache = new RpcCache(CACHE_DIR);
    this.requestBatches = new Map();
    this.batchTimers = new Map();
    this.requestQueue = [];
    this.processingQueue = false;
    
    // Set up periodic cache cleaning
    setInterval(() => this.cache.clearExpiredCache(), 5 * 60 * 1000); // Every 5 minutes
    
    console.log(`[EnhancedRPC] Manager initialized with ${this.connections.length} endpoints`);
  }
  
  getBestConnection(): EnhancedRpcConnection | null {
    // Find connections that can handle requests
    const availableConnections = this.connections.filter(conn => conn.canHandleRequest());
    
    if (availableConnections.length === 0) {
      return null;
    }
    
    // Sort by score (lower is better)
    availableConnections.sort((a, b) => a.getScore() - b.getScore());
    
    return availableConnections[0];
  }
  
  async makeRpcRequest(method: string, params: any[], forceFresh: boolean = false): Promise<any> {
    // Check cache first unless forced fresh
    if (!forceFresh) {
      const cachedResult = this.cache.getFromCache(method, params);
      if (cachedResult !== null) {
        return cachedResult;
      }
    }
    
    // Add to queue and process
    return new Promise((resolve, reject) => {
      this.requestQueue.push({method, params, resolve, reject});
      
      if (!this.processingQueue) {
        this.processQueue();
      }
    });
  }
  
  async processQueue(): Promise<void> {
    if (this.processingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.processingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      
      try {
        // Get the best connection
        const connection = this.getBestConnection();
        
        if (!connection) {
          // All connections are rate limited, wait and retry
          console.log('[EnhancedRPC] All connections rate limited, waiting 1s...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Push back to queue
          this.requestQueue.unshift(request);
          continue;
        }
        
        // Register the request
        connection.registerRequest();
        
        // Execute the request
        console.log(`[EnhancedRPC] Executing ${request.method} on ${connection.url}`);
        
        let result;
        try {
          // Use appropriate connection method based on request method
          switch (request.method) {
            case 'getBalance':
              result = await connection.connection.getBalance(
                request.params[0]
              );
              break;
            case 'getAccountInfo':
              result = await connection.connection.getAccountInfo(
                request.params[0]
              );
              break;
            case 'getTokenAccountsByOwner':
              result = await connection.connection.getTokenAccountsByOwner(
                request.params[0],
                request.params[1],
                request.params[2]
              );
              break;
            case 'getProgramAccounts':
              result = await connection.connection.getProgramAccounts(
                request.params[0],
                request.params[1]
              );
              break;
            case 'getSignaturesForAddress':
              result = await connection.connection.getSignaturesForAddress(
                request.params[0],
                request.params[1]
              );
              break;
            case 'getTransaction':
              result = await connection.connection.getTransaction(
                request.params[0],
                request.params[1]
              );
              break;
            case 'getTokenSupply':
              result = await connection.connection.getTokenSupply(
                request.params[0]
              );
              break;
            case 'getRecentBlockhash':
              result = await connection.connection.getRecentBlockhash(
                request.params[0]
              );
              break;
            case 'getLatestBlockhash':
              result = await connection.connection.getLatestBlockhash(
                request.params[0]
              );
              break;
            case 'sendTransaction':
              // Don't cache transactions
              result = await connection.connection.sendTransaction(
                request.params[0],
                request.params[1]
              );
              break;
            case 'confirmTransaction':
              result = await connection.connection.confirmTransaction(
                request.params[0],
                request.params[1]
              );
              break;
            default:
              // Generic call for other methods
              result = await (connection.connection as any)[request.method](...request.params);
          }
          
          // Register success
          connection.registerSuccess();
          
          // Cache the result (except for transaction sending methods)
          const nonCacheableMethods = ['sendTransaction', 'confirmTransaction'];
          if (!nonCacheableMethods.includes(request.method)) {
            this.cache.saveToCache(request.method, request.params, result);
          }
          
          // Resolve the request
          request.resolve(result);
        } catch (error) {
          console.error(`[EnhancedRPC] Error executing ${request.method} on ${connection.url}:`, error);
          
          // Register error
          connection.registerError();
          
          // If there are other connections available, retry with a different one
          const otherConnections = this.connections.filter(conn => 
            conn.url !== connection.url && conn.canHandleRequest()
          );
          
          if (otherConnections.length > 0) {
            // Put back in queue to retry
            this.requestQueue.unshift(request);
          } else {
            // No other connections available, reject
            request.reject(error);
          }
        }
      } catch (e) {
        console.error('[EnhancedRPC] Unexpected error processing queue:', e);
        request.reject(e);
      }
      
      // Small delay between requests to avoid hammering endpoints
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.processingQueue = false;
  }
  
  async getBalance(publicKey: PublicKey | string): Promise<number> {
    const pk = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;
    return this.makeRpcRequest('getBalance', [pk]);
  }
  
  async getAccountInfo(publicKey: PublicKey | string): Promise<any> {
    const pk = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;
    return this.makeRpcRequest('getAccountInfo', [pk]);
  }
  
  async getRecentBlockhash(): Promise<{ blockhash: string, lastValidBlockHeight: number }> {
    return this.makeRpcRequest('getLatestBlockhash', []);
  }
  
  async sendTransaction(transaction: any, signers: any[]): Promise<string> {
    // Always force fresh for transaction sending
    return this.makeRpcRequest('sendTransaction', [transaction, signers], true);
  }
  
  async confirmTransaction(signature: string): Promise<any> {
    // Always force fresh for confirmations
    return this.makeRpcRequest('confirmTransaction', [signature], true);
  }
  
  async getTokenAccountsByOwner(owner: PublicKey | string, filter: any): Promise<any> {
    const ownerPk = typeof owner === 'string' ? new PublicKey(owner) : owner;
    return this.makeRpcRequest('getTokenAccountsByOwner', [ownerPk, filter, {encoding: 'jsonParsed'}]);
  }
  
  async getSignaturesForAddress(address: PublicKey | string, options: any = {}): Promise<any[]> {
    const addressPk = typeof address === 'string' ? new PublicKey(address) : address;
    return this.makeRpcRequest('getSignaturesForAddress', [addressPk, options]);
  }
  
  // Get health status of all connections
  async getConnectionsHealth(): Promise<any[]> {
    return this.connections.map(conn => ({
      url: conn.url,
      requestCount: conn.requestCount,
      errorCount: conn.errorCount,
      consecutiveErrors: conn.consecutiveErrors,
      requestsLastMinute: conn.requestTimestamps.length,
      score: conn.getScore(),
      cooldownUntil: conn.cooldownUntil > Date.now() ? new Date(conn.cooldownUntil).toISOString() : null
    }));
  }
}

// Singleton instance
export const rpcManager = new EnhancedRpcManager();

// Add this manager to the global object so it can be accessed anywhere
(global as any).rpcManager = rpcManager;

// Function to check wallet balance
export async function checkWalletBalance(walletAddress: string): Promise<number> {
  try {
    const balance = await rpcManager.getBalance(walletAddress);
    return balance / 1_000_000_000; // Convert lamports to SOL
  } catch (error) {
    console.error(`Error checking balance for ${walletAddress}:`, error);
    return 0;
  }
}

// Initialize and run a test
async function main() {
  console.log('=== ENHANCED RPC MANAGER ===');
  
  // Check if manager is working by querying wallet balance
  try {
    console.log(`Checking main wallet (${MAIN_WALLET_ADDRESS}) balance...`);
    const balance = await checkWalletBalance(MAIN_WALLET_ADDRESS);
    console.log(`Main wallet balance: ${balance.toFixed(6)} SOL`);
    
    // Create a status monitoring endpoint
    if (!fs.existsSync('./data/rpc_status')) {
      fs.mkdirSync('./data/rpc_status', { recursive: true });
    }
    
    // Save initial stats
    const initialStats = {
      timestamp: Date.now(),
      connections: await rpcManager.getConnectionsHealth(),
      testBalance: balance
    };
    
    fs.writeFileSync(
      './data/rpc_status/initial.json', 
      JSON.stringify(initialStats, null, 2)
    );
    
    console.log('✅ RPC Manager initialized and working');
    
    // Set up a monitor process
    const monitorProcess = setInterval(async () => {
      try {
        const stats = {
          timestamp: Date.now(),
          connections: await rpcManager.getConnectionsHealth()
        };
        
        fs.writeFileSync(
          `./data/rpc_status/status_${Date.now()}.json`, 
          JSON.stringify(stats, null, 2)
        );
        
        // Clean up old status files (keep only latest 5)
        fs.readdir('./data/rpc_status', (err, files) => {
          if (err) return;
          
          // Sort files by creation time (oldest first)
          files.sort((a, b) => {
            return fs.statSync(`./data/rpc_status/${a}`).mtimeMs - 
                   fs.statSync(`./data/rpc_status/${b}`).mtimeMs;
          });
          
          // Keep 'initial.json' and latest 5 status files
          const filesToKeep = ['initial.json'];
          const statusFiles = files.filter(f => f !== 'initial.json');
          
          if (statusFiles.length > 5) {
            // Delete oldest files
            statusFiles.slice(0, statusFiles.length - 5).forEach(file => {
              fs.unlinkSync(`./data/rpc_status/${file}`);
            });
          }
        });
      } catch (error) {
        console.error('Error in RPC monitor:', error);
      }
    }, 60 * 1000); // Run every minute
    
    // Clean up after 1 hour
    setTimeout(() => {
      clearInterval(monitorProcess);
    }, 60 * 60 * 1000);
    
  } catch (error) {
    console.error('Error testing RPC Manager:', error);
  }
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default rpcManager;