/**
 * Configure Tiered RPC Setup
 * 
 * This script sets up a tiered RPC configuration with:
 * - Premium endpoints (Syndica/QuickNode) for transactions
 * - Secondary endpoint for lighter operations (price checks, etc.)
 */

const fs = require('fs');
const path = require('path');

// RPC Configuration path
const RPC_CONFIG_PATH = path.join('./data', 'rpc-config.json');

// QuickNode connection details from previous configuration
const QUICK_NODE_URL = 'https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8';
const QUICK_NODE_WS_URL = 'wss://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8';

// Public endpoints for lighter operations
const PUBLIC_ENDPOINT = 'https://api.mainnet-beta.solana.com';

// Configure tiered RPC setup
function configureTieredRpc() {
  console.log('Configuring tiered RPC setup...');
  
  try {
    // Read existing configuration if it exists
    let rpcConfig = {};
    if (fs.existsSync(RPC_CONFIG_PATH)) {
      rpcConfig = JSON.parse(fs.readFileSync(RPC_CONFIG_PATH, 'utf8'));
    }
    
    // Create new endpoints configuration with transaction/data tiers
    rpcConfig.endpoints = [
      {
        // QuickNode as primary transaction endpoint
        url: QUICK_NODE_URL,
        purpose: 'transactions',
        weight: 10,
        priority: 1,
        maxRequestsPerSecond: 10,
        minuteLimit: 500
      },
      {
        // Public endpoint for data operations
        url: PUBLIC_ENDPOINT,
        purpose: 'data',
        weight: 5,
        priority: 2,
        maxRequestsPerSecond: 5,
        minuteLimit: 150
      }
    ];
    
    // Set pool size and configuration
    rpcConfig.poolSize = 2;
    rpcConfig.maxBatchSize = 5;
    rpcConfig.useGrpc = false;
    rpcConfig.keepAlive = true;
    
    // Configure caching for different operations
    rpcConfig.cacheSettings = {
      accountInfo: 10000,
      tokenInfo: 30000,
      blockInfo: 5000,
      balance: 10000,
      transaction: 30000
    };
    
    // HTTP connection options
    rpcConfig.httpOptions = {
      maxSockets: 25,
      timeout: 60000,
      keepAlive: true
    };
    
    // Optimize rate limit handling
    rpcConfig.rateLimitHandling = {
      enabled: true,
      retryDelayMs: 3000,
      maxRetries: 10,
      exponentialBackoff: true,
      backoffMultiplier: 2,
      requestTracking: {
        enabled: true,
        windowMs: 60000,
        maxRequests: 500
      }
    };
    
    // Add transaction routing configuration
    rpcConfig.transactionRouting = {
      enabled: true,
      rules: [
        {
          type: 'trade',
          endpoint: 0, // Index of QuickNode in endpoints array
          priority: 'high'
        },
        {
          type: 'query',
          endpoint: 1, // Index of Public endpoint in endpoints array
          priority: 'medium'
        }
      ]
    };
    
    // Save updated configuration
    rpcConfig.optimizedAt = new Date().toISOString();
    fs.writeFileSync(RPC_CONFIG_PATH, JSON.stringify(rpcConfig, null, 2));
    console.log('✅ RPC connections configured with tiered setup');
    
    return true;
  } catch (error) {
    console.error('Error configuring tiered RPC setup:', error.message);
    return false;
  }
}

// Configure transaction endpoint for each strategy
function configureStrategyEndpoints() {
  console.log('Configuring transaction endpoints for strategies...');
  
  try {
    const strategies = [
      './data/quantum-omega-strategy.json',
      './data/minimal-flash-strategy.json', 
      './data/money-glitch-strategy.json',
      './data/hyperion-transformers-strategy.json'
    ];
    
    for (const strategyPath of strategies) {
      if (fs.existsSync(strategyPath)) {
        const strategy = JSON.parse(fs.readFileSync(strategyPath, 'utf8'));
        
        // Set transaction endpoint to QuickNode
        strategy.transactionEndpoint = QUICK_NODE_URL;
        strategy.useTransactionEndpointOnly = true;
        
        // Configure data/query endpoint separately
        strategy.dataEndpoint = PUBLIC_ENDPOINT;
        strategy.separateTransactionAndDataEndpoints = true;
        
        // Set endpoint priorities
        strategy.endpointPriorities = {
          transactions: ['quicknode', 'syndica'],
          queries: ['public', 'helius']
        };
        
        fs.writeFileSync(strategyPath, JSON.stringify(strategy, null, 2));
      }
    }
    
    console.log('✅ Updated strategy endpoints for optimized transactions');
    return true;
  } catch (error) {
    console.error('Error configuring strategy endpoints:', error.message);
    return false;
  }
}

// Create request router to handle endpoint selection
function createRequestRouter() {
  console.log('Creating request router...');
  
  try {
    const routerConfig = {
      enabled: true,
      routingRules: [
        {
          type: 'transaction',
          endpoint: 'quicknode',
          fallback: 'syndica'
        },
        {
          type: 'getBalance',
          endpoint: 'public',
          fallback: 'quicknode'
        },
        {
          type: 'getTokenAccountsByOwner',
          endpoint: 'public',
          fallback: 'quicknode'
        },
        {
          type: 'getProgramAccounts',
          endpoint: 'public',
          fallback: 'quicknode'
        },
        {
          type: 'getAccountInfo',
          endpoint: 'public',
          fallback: 'quicknode'
        }
      ],
      activeEndpoints: {
        quicknode: QUICK_NODE_URL,
        public: PUBLIC_ENDPOINT
      },
      useAdaptiveRouting: true,
      adaptiveRoutingConfig: {
        monitorLatency: true,
        monitorErrors: true,
        switchOnConsecutiveErrors: 3,
        latencyThresholdMs: 2000
      },
      createdAt: new Date().toISOString()
    };
    
    const routerPath = path.join('./data', 'request-router.json');
    fs.writeFileSync(routerPath, JSON.stringify(routerConfig, null, 2));
    console.log('✅ Created request router for intelligent endpoint selection');
    
    return true;
  } catch (error) {
    console.error('Error creating request router:', error.message);
    return false;
  }
}

// Main function
function main() {
  console.log('Starting tiered RPC configuration...');
  
  // Backup existing configuration
  if (fs.existsSync(RPC_CONFIG_PATH)) {
    const backupPath = path.join('./data', 'rpc-config.backup-tiered.json');
    fs.copyFileSync(RPC_CONFIG_PATH, backupPath);
    console.log(`Original configuration backed up to ${backupPath}`);
  }
  
  // Run configuration steps
  const tieredResult = configureTieredRpc();
  const strategyResult = configureStrategyEndpoints();
  const routerResult = createRequestRouter();
  
  if (tieredResult && strategyResult && routerResult) {
    console.log('\n=== TIERED RPC CONFIGURATION COMPLETED SUCCESSFULLY ===');
    console.log('✅ Configured QuickNode as primary transaction endpoint');
    console.log('✅ Reserved public endpoint for lighter data operations');
    console.log('✅ Updated all trading strategies to use the correct endpoints');
    console.log('✅ Created intelligent request router');
    console.log('\nThe system will now use QuickNode for all critical transactions');
    console.log('while using a separate endpoint for lighter data operations.\n');
    console.log('This configuration will ensure your transactions are processed');
    console.log('reliably while preventing rate limiting issues.\n');
  } else {
    console.error('\n⚠️ Tiered RPC configuration completed with some errors');
  }
}

// Run the main function
main();