/**
 * Optimize Rate Limits for Instant Nodes
 * 
 * This script enhances the rate limit handling to respect 
 * the 225 requests/minute limit for Instant Nodes more effectively.
 */

import * as fs from 'fs';
import * as path from 'path';

// Critical paths
const DATA_DIR = './data';
const NEXUS_DIR = path.join(DATA_DIR, 'nexus');
const ENV_PATH = './.env';

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Created directory: ${DATA_DIR}`);
}

if (!fs.existsSync(NEXUS_DIR)) {
  fs.mkdirSync(NEXUS_DIR, { recursive: true });
  console.log(`Created directory: ${NEXUS_DIR}`);
}

// Update RPC pool configuration with aggressive rate limiting
function updateRpcPoolConfig(): boolean {
  try {
    const rpcConfigPath = path.join(DATA_DIR, 'rpc-config.json');
    
    // More conservative rate limits:
    // 225 / 60 = 3.75 per second
    // Use 3 per second to leave room for margin
    const maxRps = 3;
    
    const rpcConfig = {
      poolSize: 1, // Use just 1 connection to better control rate limits
      maxBatchSize: 1, // Process one at a time
      cacheSettings: {
        accountInfo: 15000,  // 15s cache
        tokenInfo: 60000,    // 60s cache
        blockInfo: 10000,    // 10s cache
        balance: 15000,      // 15s cache
        transaction: 60000   // 60s cache
      },
      endpoints: [
        {
          url: 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9',
          weight: 10,
          priority: 1,
          maxRequestsPerSecond: maxRps,
          minuteLimit: 225,
          delayBetweenRequests: 350 // 350ms between requests (slower than theoretical max)
        },
        {
          url: 'https://api.mainnet-beta.solana.com',
          weight: 1,
          priority: 2,
          maxRequestsPerSecond: 1,
          delayBetweenRequests: 1000 // 1 second between requests
        }
      ],
      httpOptions: {
        maxSockets: 10, // Limit parallel connections
        timeout: 60000,
        keepAlive: true
      },
      useGrpc: false, // Disable gRPC
      keepAlive: true,
      rateLimitHandling: {
        enabled: true,
        retryDelayMs: 10000, // More aggressive initial delay (10s)
        maxRetries: 20,      // More retries
        exponentialBackoff: true,
        backoffMultiplier: 2,
        requestTracking: {
          enabled: true,
          windowMs: 60000,  // 1 minute window
          maxRequests: 225, // Strict enforcement of 225/minute
          enforcePerEndpoint: true
        },
        tokenBucket: {
          enabled: true,
          refillRatePerSecond: maxRps,
          bucketSize: 10     // Small burst capacity
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

// Update transaction configuration for better rate limit handling
function updateTransactionConfig(): boolean {
  try {
    const txConfigPath = path.join(DATA_DIR, 'transaction-config.json');
    
    const txConfig = {
      parallelExecutionLimit: 1, // Single execution at a time
      priorityFeeTiers: {
        LOW: 10000,       // 0.00001 SOL
        MEDIUM: 50000,    // 0.00005 SOL
        HIGH: 100000,     // 0.0001 SOL
        VERY_HIGH: 200000 // 0.0002 SOL
      },
      dynamicPriorityFeeEnabled: true,
      precomputePriorityFee: true,
      useLookupTables: false,
      retryPolicy: {
        maxRetries: 20,          // More retries
        initialBackoffMs: 10000, // Start with 10 seconds
        maxBackoffMs: 300000,    // Up to 5 minutes
        backoffMultiplier: 2     // Exponential backoff
      },
      rateLimit: {
        requestsPerMinute: 225,
        enabled: true,
        strictEnforcement: true,
        distributedEnforcement: true,
        minDelayBetweenTxMs: 1000, // 1 second minimum between transactions
        tokenBucket: {
          enabled: true,
          refillRatePerSecond: 3, // 3 per second
          bucketSize: 5          // Small burst capacity
        }
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

// Update Nexus engine configuration
function updateNexusConfig(): boolean {
  try {
    const nexusConfigPath = path.join(NEXUS_DIR, 'config.json');
    
    // Load existing configuration if it exists
    let nexusConfig: any = {
      useRealFunds: true,
      rpcUrl: 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9',
      websocketUrl: 'wss://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9',
      defaultExecutionMode: 'LIVE',
      defaultPriority: 'HIGH',
      defaultConfirmations: 1,
      maxConcurrentTransactions: 1,  // Single concurrent transaction
      defaultTimeoutMs: 180000,      // 3 minute timeout (longer)
      defaultMaxRetries: 10,
      maxSlippageBps: 100,
      mevProtection: true,
      backupRpcUrls: ['https://api.mainnet-beta.solana.com']
    };
    
    if (fs.existsSync(nexusConfigPath)) {
      try {
        nexusConfig = JSON.parse(fs.readFileSync(nexusConfigPath, 'utf8'));
        
        // Update key settings
        nexusConfig.maxConcurrentTransactions = 1;
        nexusConfig.defaultTimeoutMs = 180000;
        nexusConfig.defaultMaxRetries = 10;
      } catch (e) {
        // Continue with default config if parsing fails
      }
    }
    
    // Enhanced rate limit settings
    nexusConfig.rateLimitSettings = {
      maxRequestsPerMinute: 225,
      maxRequestsPerSecond: 3,
      initialBackoffMs: 10000,
      maxBackoffMs: 300000,
      backoffMultiplier: 2,
      retryOnRateLimit: true,
      useTokenBucket: true,
      enforcePerConnection: true,
      delayBetweenTransactionsMs: 1000
    };
    
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

// Update strategy configuration for slower processing
function updateStrategyConfig(): boolean {
  try {
    const strategyConfigPath = path.join(DATA_DIR, 'strategy-config.json');
    
    const strategyConfig = {
      parallelExecution: false, // No parallel execution
      asyncSignalProcessing: true,
      backgroundProcessing: true,
      maxStrategiesPerBlock: 1, // Process one strategy at a time
      signalBufferSize: 10,     // Small buffer size
      preemptivePositionSizing: true,
      smartOrderRouting: true,
      memoryBufferSizeMB: 256,
      throttling: {
        enabled: true,
        maxSignalsPerMinute: 5,           // Only 5 signals per minute
        maxExecutionsPerMinute: 2,        // Only 2 executions per minute
        minTimeBetweenSignalsMs: 12000,   // 12 seconds between signals
        minTimeBetweenExecutionsMs: 30000 // 30 seconds between executions
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

// Main function
async function main() {
  console.log('=============================================');
  console.log('🚀 OPTIMIZING RATE LIMITS FOR INSTANT NODES');
  console.log('=============================================\n');
  
  try {
    // Update RPC pool configuration
    updateRpcPoolConfig();
    
    // Update transaction configuration
    updateTransactionConfig();
    
    // Update Nexus configuration
    updateNexusConfig();
    
    // Update strategy configuration
    updateStrategyConfig();
    
    console.log('\n✅ RATE LIMIT OPTIMIZATION COMPLETE');
    console.log('Your trading system is now configured with aggressive rate limiting:');
    console.log('- Limited to 3 requests per second (instead of theoretical 3.75)');
    console.log('- Added mandatory delays between requests');
    console.log('- Increased retry backoff times (10s initial, exponential growth)');
    console.log('- Enhanced caching to reduce RPC calls (15-60s cache times)');
    console.log('- Added token bucket rate limiting with strict enforcement');
    console.log('- Reduced strategy execution to only 2 per minute');
    console.log('\nStart the trading system with:');
    console.log('npx tsx server/index.ts');
    console.log('=============================================');
    
    return true;
  } catch (error) {
    console.error('Error optimizing rate limits:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run the script
main();