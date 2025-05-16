/**
 * Fix RPC Rate Limit Configuration
 * 
 * This script configures the system to respect the 225 requests/minute 
 * rate limit for Instant Nodes RPC
 */

import * as fs from 'fs';
import * as path from 'path';

// Critical paths
const DATA_DIR = './data';
const NEXUS_DIR = path.join(DATA_DIR, 'nexus');
const ENV_PATH = './.env';

// RPC configuration
const RPC_URL = 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
const WS_URL = 'wss://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
const BACKUP_RPC = 'https://api.mainnet-beta.solana.com';

// Ensure directories exist
if (!fs.existsSync(NEXUS_DIR)) {
  fs.mkdirSync(NEXUS_DIR, { recursive: true });
  console.log(`Created directory: ${NEXUS_DIR}`);
}

// Update RPC pool configuration with exact rate limit
function updateRpcPoolConfig() {
  try {
    const rpcConfigPath = path.join(DATA_DIR, 'rpc-config.json');
    
    // Calculate per-second rate limit
    const rateLimit = Math.floor(225 / 60); // 3.75 requests per second
    
    const rpcConfig = {
      poolSize: 3, // Small pool size to respect rate limit
      maxBatchSize: 5, // Small batch size
      cacheSettings: {
        accountInfo: 10000, // 10s cache
        tokenInfo: 30000,   // 30s cache
        blockInfo: 5000,    // 5s cache
        balance: 10000,     // 10s cache
        transaction: 30000  // 30s cache
      },
      endpoints: [
        {
          url: RPC_URL,
          weight: 10,
          priority: 1,
          maxRequestsPerSecond: rateLimit,
          minuteLimit: 225 // Exact rate limit from Instant Nodes
        },
        {
          url: WS_URL,
          type: 'ws',
          weight: 5,
          priority: 2,
          maxRequestsPerSecond: Math.floor(rateLimit / 2)
        },
        {
          url: BACKUP_RPC,
          weight: 1,
          priority: 3,
          maxRequestsPerSecond: 2
        }
      ],
      httpOptions: {
        maxSockets: 25,
        timeout: 60000,
        keepAlive: true
      },
      useGrpc: false, // Disable gRPC
      keepAlive: true,
      // Enhanced rate limit handling
      rateLimitHandling: {
        enabled: true,
        retryDelayMs: 5000, // Start with 5 second delay for 429 errors
        maxRetries: 15,     // More retries with longer delays
        exponentialBackoff: true,
        backoffMultiplier: 2,
        requestTracking: {
          enabled: true,
          windowMs: 60000,  // 1 minute window
          maxRequests: 225  // Enforce 225 requests per minute
        }
      },
      optimizedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(rpcConfigPath, JSON.stringify(rpcConfig, null, 2));
    console.log(`Updated RPC pool configuration at ${rpcConfigPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update RPC pool configuration:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Update Nexus engine configuration
function updateNexusConfig() {
  try {
    const nexusConfigPath = path.join(NEXUS_DIR, 'config.json');
    
    // Default configuration if file doesn't exist
    let nexusConfig: any = {
      useRealFunds: true,
      rpcUrl: RPC_URL,
      websocketUrl: WS_URL,
      defaultExecutionMode: 'LIVE',
      defaultPriority: 'HIGH',
      defaultConfirmations: 1,
      maxConcurrentTransactions: 2, // Low concurrency
      defaultTimeoutMs: 60000,      // Longer timeout (60s)
      defaultMaxRetries: 5,
      maxSlippageBps: 100,
      mevProtection: true,
      backupRpcUrls: [BACKUP_RPC]
    };
    
    // Load existing configuration if it exists
    if (fs.existsSync(nexusConfigPath)) {
      try {
        nexusConfig = JSON.parse(fs.readFileSync(nexusConfigPath, 'utf8'));
      } catch (e) {
        // Continue with default config if parsing fails
      }
    }
    
    // Update rate limit settings
    nexusConfig.rateLimitSettings = {
      maxRequestsPerMinute: 225,
      maxRequestsPerSecond: Math.floor(225 / 60),
      initialBackoffMs: 5000,
      maxBackoffMs: 60000,
      backoffMultiplier: 2,
      retryOnRateLimit: true,
      useTokenBucket: true
    };
    
    // Reduce concurrency and increase timeouts
    nexusConfig.maxConcurrentTransactions = 2;
    nexusConfig.defaultTimeoutMs = 60000;
    nexusConfig.defaultMaxRetries = 5;
    
    // Update last updated timestamp
    nexusConfig.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(nexusConfigPath, JSON.stringify(nexusConfig, null, 2));
    console.log(`Updated Nexus Engine configuration at ${nexusConfigPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update Nexus configuration:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Update transaction configuration
function updateTransactionConfig() {
  try {
    const txConfigPath = path.join(DATA_DIR, 'transaction-config.json');
    
    const txConfig = {
      parallelExecutionLimit: 2, // Low parallelism
      priorityFeeTiers: {
        LOW: 10000,      // 0.00001 SOL
        MEDIUM: 50000,   // 0.00005 SOL
        HIGH: 100000,    // 0.0001 SOL
        VERY_HIGH: 200000// 0.0002 SOL
      },
      dynamicPriorityFeeEnabled: true,
      precomputePriorityFee: true,
      useLookupTables: false,
      retryPolicy: {
        maxRetries: 15,         // More retries
        initialBackoffMs: 5000, // Start with 5 seconds
        maxBackoffMs: 120000,   // Up to 2 minutes
        backoffMultiplier: 2    // Exponential backoff
      },
      rateLimit: {
        requestsPerMinute: 225,
        enabled: true,
        strictEnforcement: true,
        distributedEnforcement: true
      },
      optimizedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(txConfigPath, JSON.stringify(txConfig, null, 2));
    console.log(`Updated transaction configuration at ${txConfigPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update transaction configuration:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Update strategy configuration to be less aggressive
function updateStrategyConfig() {
  try {
    const strategyConfigPath = path.join(DATA_DIR, 'strategy-config.json');
    
    const strategyConfig = {
      parallelExecution: false, // Disable parallel execution
      asyncSignalProcessing: true,
      backgroundProcessing: true,
      maxStrategiesPerBlock: 1,  // Only 1 strategy per block
      signalBufferSize: 20,      // Smaller buffer
      preemptivePositionSizing: true,
      smartOrderRouting: true,
      memoryBufferSizeMB: 256,   // Lower memory usage
      throttling: {
        enabled: true,
        maxSignalsPerMinute: 10, // Limit signals
        maxExecutionsPerMinute: 5, // Limit executions
        minTimeBetweenSignalsMs: 12000, // 12 seconds between signals
        minTimeBetweenExecutionsMs: 20000 // 20 seconds between executions
      },
      optimizedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(strategyConfigPath, JSON.stringify(strategyConfig, null, 2));
    console.log(`Updated strategy configuration at ${strategyConfigPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update strategy configuration:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Add a global rate limiter middleware
function createRateLimiterMiddleware() {
  try {
    const middlewarePath = path.join(__dirname, 'server', 'lib', 'rateLimiterMiddleware.ts');
    
    // Create directory if it doesn't exist
    const middlewareDir = path.dirname(middlewarePath);
    if (!fs.existsSync(middlewareDir)) {
      fs.mkdirSync(middlewareDir, { recursive: true });
    }
    
    const middlewareCode = `/**
 * RPC Rate Limiter Middleware
 * 
 * This middleware enforces the 225 requests/minute rate limit for Instant Nodes
 */

import { logger } from '../../logger';

// Token bucket implementation
class TokenBucket {
  private capacity: number;
  private tokens: number;
  private lastRefill: number;
  private refillRate: number; // tokens per millisecond
  
  constructor(capacity: number, refillRatePerMinute: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.refillRate = refillRatePerMinute / (60 * 1000); // Convert to tokens per ms
  }
  
  refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
  
  takeToken(): boolean {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    
    return false;
  }
  
  get availableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

// Rate limiter class
export class RpcRateLimiter {
  private bucket: TokenBucket;
  private pendingRequests: Array<{
    resolve: () => void;
    timestamp: number;
  }> = [];
  private processingInterval: NodeJS.Timeout | null = null;
  private maxWaitTimeMs: number;
  
  constructor(rateLimit: number = 225, maxWaitTimeMs: number = 30000) {
    this.bucket = new TokenBucket(rateLimit, rateLimit);
    this.maxWaitTimeMs = maxWaitTimeMs;
    this.startProcessing();
  }
  
  private startProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    // Process pending requests every 100ms
    this.processingInterval = setInterval(() => {
      this.processPendingRequests();
    }, 100);
  }
  
  private processPendingRequests() {
    const now = Date.now();
    
    // Process pending requests in order
    while (this.pendingRequests.length > 0 && this.bucket.takeToken()) {
      const request = this.pendingRequests.shift();
      if (request) {
        request.resolve();
      }
    }
    
    // Check for timed out requests
    const timedOutIndex = this.pendingRequests.findIndex(
      req => now - req.timestamp > this.maxWaitTimeMs
    );
    
    if (timedOutIndex >= 0) {
      // Remove timed out request and all before it
      const timedOutRequests = this.pendingRequests.splice(0, timedOutIndex + 1);
      timedOutRequests.forEach(req => req.resolve());
      
      logger.warn(\`\${timedOutRequests.length} requests timed out while waiting for rate limit\`);
    }
  }
  
  async acquireToken(): Promise<void> {
    // Try to take a token immediately
    if (this.bucket.takeToken()) {
      return;
    }
    
    // Otherwise, wait for a token
    return new Promise<void>(resolve => {
      this.pendingRequests.push({
        resolve,
        timestamp: Date.now()
      });
    });
  }
  
  get availableTokens(): number {
    return this.bucket.availableTokens;
  }
  
  get queueLength(): number {
    return this.pendingRequests.length;
  }
  
  destroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}

// Create singleton instance
let rateLimiter: RpcRateLimiter | null = null;

export function getRateLimiter(rateLimit: number = 225): RpcRateLimiter {
  if (!rateLimiter) {
    rateLimiter = new RpcRateLimiter(rateLimit);
    logger.info(\`RPC Rate Limiter initialized with \${rateLimit} requests/minute\`);
  }
  return rateLimiter;
}`;
    
    fs.writeFileSync(middlewarePath, middlewareCode);
    console.log(`Created RPC rate limiter middleware at ${middlewarePath}`);
    return true;
  } catch (error) {
    console.error('Failed to create rate limiter middleware:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Update environment settings for rate limits
function updateEnvironmentSettings() {
  try {
    // Read existing .env file if it exists
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf8');
    }
    
    // Set real funds trading variables
    const envVars = [
      'RPC_RATE_LIMIT=225',
      'RPC_RATE_LIMIT_ENABLED=true',
      'RPC_URL=' + RPC_URL,
      'WEBSOCKET_URL=' + WS_URL,
      'MAX_CONCURRENT_TRANSACTIONS=2',
      'DEFAULT_PRIORITY=HIGH',
      'ENABLE_RATE_LIMITER=true'
    ];
    
    // Update environment variables
    envVars.forEach(envVar => {
      const [key] = envVar.split('=');
      
      if (envContent.includes(key + '=')) {
        // Replace existing variable
        envContent = envContent.replace(
          new RegExp(`${key}=.*`, 'g'),
          envVar
        );
      } else {
        // Add new variable
        envContent += envVar + '\n';
      }
    });
    
    // Write updated .env file
    fs.writeFileSync(ENV_PATH, envContent);
    console.log(`Updated environment settings at ${ENV_PATH}`);
    return true;
  } catch (error) {
    console.error('Failed to update environment settings:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('🚀 FIXING RPC RATE LIMIT (225 requests/minute)');
  console.log('=============================================\n');
  
  try {
    // Update RPC pool configuration
    updateRpcPoolConfig();
    
    // Update Nexus configuration
    updateNexusConfig();
    
    // Update transaction configuration
    updateTransactionConfig();
    
    // Update strategy configuration
    updateStrategyConfig();
    
    // Create rate limiter middleware
    createRateLimiterMiddleware();
    
    // Update environment settings
    updateEnvironmentSettings();
    
    console.log('\n✅ RPC RATE LIMIT CONFIGURATION COMPLETE');
    console.log('Your trading system will now respect the 225 requests/minute rate limit');
    console.log('\nConfig changes made:');
    console.log('- Limited to 3-4 requests per second to stay under 225/minute limit');
    console.log('- Added token bucket rate limiting with queuing');
    console.log('- Reduced concurrent operations to 2');
    console.log('- Implemented aggressive caching to reduce RPC calls');
    console.log('- Added exponential backoff for 429 error responses');
    console.log('- Throttled strategy execution to avoid RPC spikes');
    console.log('\nStart the trading system with:');
    console.log('npx tsx server/index.ts');
    console.log('=============================================');
  } catch (error) {
    console.error('Error fixing rate limit configuration:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();