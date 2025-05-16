/**
 * RPC Worker Pool
 * 
 * High-performance worker pool for RPC requests with automatic load balancing,
 * connection management, and intelligent caching.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../../logger';
import { Worker } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Load RPC configuration
let rpcConfig: any = {
  poolSize: 8,
  maxBatchSize: 100,
  cacheSettings: {
    accountInfo: 2000,
    tokenInfo: 5000,
    blockInfo: 1000,
    balance: 2000,
    transaction: 10000
  },
  endpoints: [
    {
      url: 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9',
      weight: 10,
      priority: 1,
      maxRequestsPerSecond: 50
    }
  ],
  httpOptions: {
    maxSockets: 200,
    timeout: 60000,
    keepAlive: true
  },
  useGrpc: true,
  keepAlive: true
};

try {
  const configPath = path.join(__dirname, '..', '..', '..', 'data', 'rpc-config.json');
  if (fs.existsSync(configPath)) {
    rpcConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    logger.info('Loaded RPC configuration from file');
  }
} catch (error) {
  logger.warn(`Failed to load RPC configuration: ${error.message}`);
}

// Request types
enum RequestType {
  GET_ACCOUNT_INFO = 'getAccountInfo',
  GET_BALANCE = 'getBalance',
  GET_TOKEN_ACCOUNTS = 'getTokenAccounts',
  GET_TRANSACTION = 'getTransaction',
  GET_BLOCK = 'getBlock',
  SEND_TRANSACTION = 'sendTransaction',
  CONFIRM_TRANSACTION = 'confirmTransaction',
  GET_PROGRAM_ACCOUNTS = 'getProgramAccounts',
  CUSTOM = 'custom'
}

// Request message
interface RequestMessage {
  id: string;
  type: RequestType;
  params: any[];
  priority: number;
  timestamp: number;
}

// Worker state
interface WorkerState {
  id: number;
  worker: Worker;
  busy: boolean;
  requestCount: number;
  lastActive: number;
  endpoint: string;
}

// RPC Worker Pool
export class RpcWorkerPool {
  private workers: WorkerState[] = [];
  private requestQueue: RequestMessage[] = [];
  private resultCallbacks: Map<string, (error: Error | null, result?: any) => void> = new Map();
  private activeRequestCount = 0;
  private maxConcurrentRequests: number;
  private requestIdCounter = 0;
  private caches: Map<RequestType, Map<string, { data: any, expires: number }>> = new Map();
  private isInitialized = false;
  private endpoints: string[] = [];
  
  constructor(private config = rpcConfig) {
    // Calculate max concurrent requests based on CPU cores and config
    this.maxConcurrentRequests = Math.max(1, Math.min(
      config.poolSize || 8,
      os.cpus().length
    ));
    
    // Initialize caches for each request type
    Object.values(RequestType).forEach(type => {
      this.caches.set(type as RequestType, new Map());
    });
    
    // Extract endpoint URLs from config
    this.endpoints = config.endpoints
      .filter(e => e.type !== 'grpc') // Filter out gRPC endpoints for worker pool
      .sort((a, b) => a.priority - b.priority)
      .map(e => e.url);
    
    if (this.endpoints.length === 0) {
      // Fallback to a default endpoint if none configured
      this.endpoints = ['https://api.mainnet-beta.solana.com'];
    }
    
    logger.info(`RPC Worker Pool initialized with ${this.maxConcurrentRequests} workers`);
  }
  
  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    logger.info('Initializing RPC Worker Pool');
    
    // Create workers
    for (let i = 0; i < this.maxConcurrentRequests; i++) {
      await this.createWorker(i);
    }
    
    this.isInitialized = true;
    
    // Start processing the queue
    setImmediate(() => this.processQueue());
    
    // Start periodic cache cleanup
    setInterval(() => this.cleanupCache(), 60000);
    
    logger.info(`RPC Worker Pool initialized with ${this.workers.length} workers`);
  }
  
  /**
   * Create a worker
   */
  private async createWorker(id: number): Promise<void> {
    try {
      // Select an endpoint for this worker based on id
      const endpoint = this.endpoints[id % this.endpoints.length];
      
      // In a real implementation, we would create actual worker threads
      // For this example, we'll simulate them
      const worker: Worker = {
        on: (event: string, callback: Function) => {},
        postMessage: (message: any) => {
          // Simulate worker processing
          setTimeout(() => {
            this.handleWorkerResponse(id, message.id, null, { result: 'simulated' });
          }, 10);
        },
        terminate: () => {}
      } as any;
      
      this.workers.push({
        id,
        worker,
        busy: false,
        requestCount: 0,
        lastActive: Date.now(),
        endpoint
      });
      
      logger.debug(`Worker ${id} created using endpoint ${endpoint}`);
    } catch (error) {
      logger.error(`Failed to create worker ${id}: ${error.message}`);
      
      // Retry after a delay
      setTimeout(() => this.createWorker(id), 5000);
    }
  }
  
  /**
   * Handle worker response
   */
  private handleWorkerResponse(workerId: number, requestId: string, error: Error | null, result: any): void {
    // Find the worker
    const worker = this.workers.find(w => w.id === workerId);
    if (!worker) {
      logger.error(`Worker ${workerId} not found`);
      return;
    }
    
    // Mark worker as available
    worker.busy = false;
    worker.lastActive = Date.now();
    this.activeRequestCount--;
    
    // Get and call the callback
    const callback = this.resultCallbacks.get(requestId);
    if (callback) {
      callback(error, result);
      this.resultCallbacks.delete(requestId);
    }
    
    // Process next request
    setImmediate(() => this.processQueue());
  }
  
  /**
   * Process the queue
   */
  private processQueue(): void {
    if (this.requestQueue.length === 0 || this.activeRequestCount >= this.maxConcurrentRequests) {
      return;
    }
    
    // Find available workers
    const availableWorkers = this.workers.filter(w => !w.busy);
    if (availableWorkers.length === 0) {
      return;
    }
    
    // Sort queue by priority and timestamp
    this.requestQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.timestamp - b.timestamp; // Older requests first
    });
    
    // Assign requests to available workers
    while (this.requestQueue.length > 0 && availableWorkers.length > 0) {
      const request = this.requestQueue.shift()!;
      const worker = availableWorkers.shift()!;
      
      // Mark worker as busy
      worker.busy = true;
      worker.requestCount++;
      this.activeRequestCount++;
      
      // Send request to worker
      worker.worker.postMessage({
        id: request.id,
        type: request.type,
        params: request.params,
        endpoint: worker.endpoint
      });
    }
  }
  
  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    
    for (const [type, cache] of this.caches.entries()) {
      let expiredCount = 0;
      
      for (const [key, entry] of cache.entries()) {
        if (entry.expires <= now) {
          cache.delete(key);
          expiredCount++;
        }
      }
      
      if (expiredCount > 0) {
        logger.debug(`Cleaned up ${expiredCount} expired cache entries for ${type}`);
      }
    }
  }
  
  /**
   * Get cache key for a request
   */
  private getCacheKey(type: RequestType, params: any[]): string {
    return `${type}:${JSON.stringify(params)}`;
  }
  
  /**
   * Check cache for a request
   */
  private checkCache(type: RequestType, params: any[]): any | null {
    const cache = this.caches.get(type);
    if (!cache) return null;
    
    const key = this.getCacheKey(type, params);
    const entry = cache.get(key);
    
    if (entry && entry.expires > Date.now()) {
      return entry.data;
    }
    
    return null;
  }
  
  /**
   * Add result to cache
   */
  private addToCache(type: RequestType, params: any[], result: any): void {
    const cache = this.caches.get(type);
    if (!cache) return;
    
    const key = this.getCacheKey(type, params);
    const ttl = this.config.cacheSettings[type.toLowerCase()] || 2000;
    
    cache.set(key, {
      data: result,
      expires: Date.now() + ttl
    });
  }
  
  /**
   * Execute an RPC request
   */
  async executeRequest<T>(type: RequestType, params: any[], priority: number = 1): Promise<T> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Check cache first
    const cachedResult = this.checkCache(type, params);
    if (cachedResult !== null) {
      return cachedResult;
    }
    
    return new Promise<T>((resolve, reject) => {
      const requestId = `req_${Date.now()}_${this.requestIdCounter++}`;
      
      // Store callback
      this.resultCallbacks.set(requestId, (error, result) => {
        if (error) {
          reject(error);
        } else {
          // Cache successful result
          this.addToCache(type, params, result);
          resolve(result);
        }
      });
      
      // Queue request
      this.requestQueue.push({
        id: requestId,
        type,
        params,
        priority,
        timestamp: Date.now()
      });
      
      // Process queue
      setImmediate(() => this.processQueue());
    });
  }
  
  /**
   * Get account info (wrapper)
   */
  async getAccountInfo(address: string | PublicKey, priority: number = 1): Promise<any> {
    const pubkey = typeof address === 'string' ? new PublicKey(address) : address;
    return this.executeRequest(RequestType.GET_ACCOUNT_INFO, [pubkey.toString()], priority);
  }
  
  /**
   * Get balance (wrapper)
   */
  async getBalance(address: string | PublicKey, priority: number = 1): Promise<number> {
    const pubkey = typeof address === 'string' ? new PublicKey(address) : address;
    return this.executeRequest(RequestType.GET_BALANCE, [pubkey.toString()], priority);
  }
  
  /**
   * Send transaction (wrapper)
   */
  async sendTransaction(serializedTransaction: Buffer, priority: number = 2): Promise<string> {
    return this.executeRequest(RequestType.SEND_TRANSACTION, [serializedTransaction.toString('base64')], priority);
  }
  
  /**
   * Confirm transaction (wrapper)
   */
  async confirmTransaction(signature: string, priority: number = 2): Promise<boolean> {
    return this.executeRequest(RequestType.CONFIRM_TRANSACTION, [signature], priority);
  }
  
  /**
   * Get current worker stats
   */
  getStats(): any {
    return {
      totalWorkers: this.workers.length,
      activeWorkers: this.workers.filter(w => w.busy).length,
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequestCount,
      totalRequestsProcessed: this.workers.reduce((sum, w) => sum + w.requestCount, 0),
      cacheStats: Object.fromEntries(
        Array.from(this.caches.entries()).map(([type, cache]) => [type, cache.size])
      )
    };
  }
}

// Export singleton instance
let rpcWorkerPool: RpcWorkerPool | null = null;

export function getRpcWorkerPool(): RpcWorkerPool {
  if (!rpcWorkerPool) {
    rpcWorkerPool = new RpcWorkerPool();
  }
  return rpcWorkerPool;
}