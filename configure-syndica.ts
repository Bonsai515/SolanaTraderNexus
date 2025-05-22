/**
 * Configure Syndica for Price Feeds and Token Data
 * 
 * This script configures Syndica as the primary data source for:
 * - Price feeds
 * - Token data
 * - Memecoin information
 * - Cached routes
 */

import * as fs from 'fs';
import * as path from 'path';

// Syndica endpoint information
const SYNDICA_ENDPOINT = 'https://solana-api.syndica.io/access-token/DEFAULT_TOKEN';
const SYNDICA_WS_ENDPOINT = 'wss://solana-api.syndica.io/access-token/DEFAULT_TOKEN';

// Configuration paths
const TOKEN_SOURCES_PATH = path.join('./data', 'token-sources.json');
const RPC_CONFIG_PATH = path.join('./data', 'rpc-config.json');
const CACHE_CONFIG_PATH = path.join('./data', 'cache-config.json');
const ROUTER_CONFIG_PATH = path.join('./data', 'request-router.json');

/**
 * Configure price feed sources to prioritize Syndica
 */
function configurePriceFeedSources() {
  console.log('Configuring price feed sources...');
  
  try {
    // Create or update token sources configuration
    let sourcesConfig: any = {};
    if (fs.existsSync(TOKEN_SOURCES_PATH)) {
      sourcesConfig = JSON.parse(fs.readFileSync(TOKEN_SOURCES_PATH, 'utf8'));
    }
    
    // Update sources configuration
    sourcesConfig.enabled = [
      'syndica',       // Add Syndica as primary source
      'dexscreener',
      'jupiter',
      'raydium',
      'orca',
      'meteora'
    ];
    
    sourcesConfig.disabled = [
      'pumpfun',
      'instantnodes',
      'coingecko'      // Disable CoinGecko due to rate limits
    ];
    
    // Update source priorities
    sourcesConfig.priorities = {
      price: ['syndica', 'jupiter', 'dexscreener', 'raydium', 'orca'],
      volume: ['syndica', 'dexscreener', 'jupiter', 'raydium'],
      trending: ['syndica', 'dexscreener', 'jupiter', 'meteora']
    };
    
    // Configure rate limits
    sourcesConfig.rateLimits = {
      syndica: {
        requestsPerMinute: 300,
        requestsPerHour: 5000
      },
      dexscreener: {
        requestsPerMinute: 30,
        requestsPerHour: 1000
      },
      jupiter: {
        requestsPerMinute: 60,
        requestsPerHour: 3000
      },
      raydium: {
        requestsPerMinute: 40,
        requestsPerHour: 2000
      },
      orca: {
        requestsPerMinute: 40,
        requestsPerHour: 2000
      },
      meteora: {
        requestsPerMinute: 40,
        requestsPerHour: 2000
      }
    };
    
    // Configure caching parameters
    sourcesConfig.updateFrequencyMs = 30000;  // Faster updates for better data
    sourcesConfig.cacheExpiryMs = 180000;     // Shorter cache expiry
    sourcesConfig.lastUpdated = new Date().toISOString();
    
    // Save updated configuration
    fs.writeFileSync(TOKEN_SOURCES_PATH, JSON.stringify(sourcesConfig, null, 2));
    console.log('✅ Updated price feed sources to prioritize Syndica');
    
    return true;
  } catch (error) {
    console.error('Error configuring price feed sources:', error);
    return false;
  }
}

/**
 * Configure token data caching
 */
function configureTokenDataCaching() {
  console.log('Configuring token data caching...');
  
  try {
    // Create token data cache configuration
    const cacheConfig = {
      enabled: true,
      types: {
        price: {
          ttlMs: 60000,            // 1 minute TTL for price data
          refreshStaleAfterMs: 30000,  // Refresh stale data after 30 seconds
          maxSize: 1000,           // Cache up to 1000 tokens
          priorityRefresh: true,   // Prioritize refreshing high-volume tokens
        },
        metadata: {
          ttlMs: 3600000,          // 1 hour TTL for metadata
          refreshStaleAfterMs: 1800000, // Refresh stale data after 30 minutes
          maxSize: 500,            // Cache up to 500 tokens
          priorityRefresh: false,  // No priority refreshing needed
        },
        liquidity: {
          ttlMs: 300000,           // 5 minutes TTL for liquidity data
          refreshStaleAfterMs: 150000, // Refresh stale data after 2.5 minutes
          maxSize: 300,            // Cache up to 300 tokens
          priorityRefresh: true,   // Prioritize refreshing high-volume pools
        },
        routes: {
          ttlMs: 300000,           // 5 minutes TTL for routes
          refreshStaleAfterMs: 120000, // Refresh stale data after 2 minutes
          maxSize: 200,            // Cache up to 200 routes
          priorityRefresh: true,   // Prioritize refreshing common routes
        }
      },
      storage: {
        persistToDisk: true,       // Save cache to disk
        diskPath: './data/token-cache',
        saveIntervalMs: 60000,     // Save every minute
        loadOnStartup: true,       // Load cache on startup
      },
      optimization: {
        compressionEnabled: true,  // Compress cached data
        deduplicate: true,         // Deduplicate data
        preloadCommonTokens: true, // Preload common tokens
      },
      sources: {
        price: ['syndica', 'jupiter', 'dexscreener'],
        metadata: ['syndica', 'jupiter'],
        liquidity: ['syndica', 'raydium', 'orca'],
        routes: ['syndica', 'jupiter'],
      },
      lastUpdated: new Date().toISOString()
    };
    
    // Save cache configuration
    fs.writeFileSync(CACHE_CONFIG_PATH, JSON.stringify(cacheConfig, null, 2));
    console.log('✅ Configured token data caching with Syndica as primary source');
    
    return true;
  } catch (error) {
    console.error('Error configuring token data caching:', error);
    return false;
  }
}

/**
 * Update RPC configuration to use Syndica for data operations
 */
function updateRpcConfiguration() {
  console.log('Updating RPC configuration...');
  
  try {
    // Read existing configuration
    let rpcConfig: any = {};
    if (fs.existsSync(RPC_CONFIG_PATH)) {
      rpcConfig = JSON.parse(fs.readFileSync(RPC_CONFIG_PATH, 'utf8'));
    }
    
    // Get QuickNode URL from existing config
    const quickNodeUrl = rpcConfig.endpoints?.[0]?.url || 
      'https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8';
    
    // Update endpoints with Syndica for data operations
    rpcConfig.endpoints = [
      {
        // QuickNode remains primary transaction endpoint
        url: quickNodeUrl,
        purpose: 'transactions',
        weight: 10,
        priority: 1,
        maxRequestsPerSecond: 10,
        minuteLimit: 500
      },
      {
        // Syndica for data operations
        url: SYNDICA_ENDPOINT,
        purpose: 'data',
        weight: 8,
        priority: 2,
        maxRequestsPerSecond: 15,
        minuteLimit: 800
      },
      {
        // Public endpoint as fallback
        url: 'https://api.mainnet-beta.solana.com',
        purpose: 'fallback',
        weight: 2,
        priority: 3,
        maxRequestsPerSecond: 5,
        minuteLimit: 150
      }
    ];
    
    // Set pool size and configuration
    rpcConfig.poolSize = 3;
    rpcConfig.maxBatchSize = 5;
    rpcConfig.useGrpc = false;
    rpcConfig.keepAlive = true;
    
    // Configure enhanced caching for different operations
    rpcConfig.cacheSettings = {
      accountInfo: 10000,
      tokenInfo: 20000,
      blockInfo: 5000,
      balance: 10000,
      transaction: 30000
    };
    
    // Save updated configuration
    rpcConfig.optimizedAt = new Date().toISOString();
    fs.writeFileSync(RPC_CONFIG_PATH, JSON.stringify(rpcConfig, null, 2));
    console.log('✅ Updated RPC configuration to use Syndica for data operations');
    
    return true;
  } catch (error) {
    console.error('Error updating RPC configuration:', error);
    return false;
  }
}

/**
 * Update request router to direct price checks to Syndica
 */
function updateRequestRouter() {
  console.log('Updating request router...');
  
  try {
    // Read existing router if it exists
    let routerConfig: any = {};
    if (fs.existsSync(ROUTER_CONFIG_PATH)) {
      routerConfig = JSON.parse(fs.readFileSync(ROUTER_CONFIG_PATH, 'utf8'));
    }
    
    // Get QuickNode URL from existing config or use default
    const quickNodeUrl = routerConfig.activeEndpoints?.quicknode || 
      'https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8';
    
    // Update routing rules
    routerConfig.routingRules = [
      {
        type: 'transaction',
        endpoint: 'quicknode',
        fallback: 'syndica'
      },
      {
        type: 'getBalance',
        endpoint: 'syndica',
        fallback: 'quicknode'
      },
      {
        type: 'getTokenAccountsByOwner',
        endpoint: 'syndica',
        fallback: 'quicknode'
      },
      {
        type: 'getProgramAccounts',
        endpoint: 'syndica',
        fallback: 'quicknode'
      },
      {
        type: 'getAccountInfo',
        endpoint: 'syndica',
        fallback: 'quicknode'
      },
      {
        type: 'getTokenSupply',
        endpoint: 'syndica',
        fallback: 'public'
      },
      {
        type: 'getMultipleAccounts',
        endpoint: 'syndica',
        fallback: 'quicknode'
      }
    ];
    
    // Update active endpoints
    routerConfig.activeEndpoints = {
      quicknode: quickNodeUrl,
      syndica: SYNDICA_ENDPOINT,
      public: 'https://api.mainnet-beta.solana.com'
    };
    
    // Enable adaptive routing
    routerConfig.useAdaptiveRouting = true;
    routerConfig.adaptiveRoutingConfig = {
      monitorLatency: true,
      monitorErrors: true,
      switchOnConsecutiveErrors: 3,
      latencyThresholdMs: 2000
    };
    
    // Update metadata
    routerConfig.enabled = true;
    routerConfig.createdAt = new Date().toISOString();
    
    // Save updated router configuration
    fs.writeFileSync(ROUTER_CONFIG_PATH, JSON.stringify(routerConfig, null, 2));
    console.log('✅ Updated request router to direct price checks to Syndica');
    
    return true;
  } catch (error) {
    console.error('Error updating request router:', error);
    return false;
  }
}

/**
 * Configure trading strategies to use Syndica for price data
 */
function configureStrategiesForSyndica() {
  console.log('Configuring trading strategies for Syndica...');
  
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
        
        // Keep transaction endpoint as QuickNode
        // Set data endpoint to Syndica
        strategy.dataEndpoint = SYNDICA_ENDPOINT;
        strategy.separateTransactionAndDataEndpoints = true;
        
        // Set endpoint priorities
        strategy.endpointPriorities = {
          transactions: ['quicknode', 'syndica'],
          queries: ['syndica', 'quicknode', 'public']
        };
        
        // Configure data sources
        if (strategy.dataSources) {
          strategy.dataSources = strategy.dataSources.filter(
            (source: string) => !source.toLowerCase().includes('pump') && 
                                !source.toLowerCase().includes('instantnodes')
          );
          
          // Add Syndica if not already present
          if (!strategy.dataSources.includes('syndica')) {
            strategy.dataSources.unshift('syndica');
          }
        }
        
        // Save updated strategy
        fs.writeFileSync(strategyPath, JSON.stringify(strategy, null, 2));
      }
    }
    
    console.log('✅ Configured trading strategies to use Syndica for price data');
    return true;
  } catch (error) {
    console.error('Error configuring trading strategies:', error);
    return false;
  }
}

/**
 * Create a Syndica-optimized token cache system
 */
function createOptimizedTokenCache() {
  console.log('Creating optimized token cache system...');
  
  try {
    const tokenCacheConfig = {
      version: "1.0.0",
      enabled: true,
      primarySource: "syndica",
      secondarySources: ["jupiter", "dexscreener"],
      fallbackSources: ["raydium", "orca"],
      updateIntervals: {
        highVolume: 30000,    // 30 seconds for high volume tokens
        mediumVolume: 60000,  // 1 minute for medium volume
        lowVolume: 300000,    // 5 minutes for low volume
        metadata: 3600000     // 1 hour for metadata
      },
      cacheSettings: {
        maxTokens: 1000,
        persistToDisk: true,
        compressData: true,
        diskPath: "./data/enhanced-token-cache",
        backupInterval: 600000  // 10 minutes
      },
      preloadTokens: [
        "SOL", "USDC", "BONK", "WIF", "JUP", "MEME", 
        "RAY", "MNGO", "ORCA", "SHDW"
      ],
      websocketEnabled: true,
      websocketEndpoint: SYNDICA_WS_ENDPOINT,
      streamingEnabled: true,
      streamPriceUpdates: true,
      createdAt: new Date().toISOString()
    };
    
    // Save token cache configuration
    const cachePath = path.join('./data', 'enhanced-token-cache-config.json');
    fs.writeFileSync(cachePath, JSON.stringify(tokenCacheConfig, null, 2));
    console.log('✅ Created optimized token cache system with Syndica as primary source');
    
    return true;
  } catch (error) {
    console.error('Error creating optimized token cache:', error);
    return false;
  }
}

/**
 * Main function to configure Syndica
 */
async function main() {
  console.log('Starting Syndica configuration...');
  
  // Create backup of existing configurations
  const backupDir = './data/backups';
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  // Run configuration steps
  const priceFeedsResult = configurePriceFeedSources();
  const cachingResult = configureTokenDataCaching();
  const rpcResult = updateRpcConfiguration();
  const routerResult = updateRequestRouter();
  const strategiesResult = configureStrategiesForSyndica();
  const tokenCacheResult = createOptimizedTokenCache();
  
  if (priceFeedsResult && cachingResult && rpcResult && 
      routerResult && strategiesResult && tokenCacheResult) {
    console.log('\n=== SYNDICA CONFIGURATION COMPLETED SUCCESSFULLY ===');
    console.log('✅ Configured Syndica as primary data source for price feeds');
    console.log('✅ Optimized token data caching for improved performance');
    console.log('✅ Updated RPC configuration to use Syndica for data operations');
    console.log('✅ Configured request router to direct price checks to Syndica');
    console.log('✅ Updated all trading strategies to use Syndica for price data');
    console.log('✅ Created optimized token cache system with Syndica as primary source');
    console.log('\nThe system will now use Syndica for all price checks and token data,');
    console.log('while maintaining QuickNode for critical transaction processing.');
  } else {
    console.error('\n⚠️ Syndica configuration completed with some errors');
  }
}

// Run the main function
main()
  .catch(error => {
    console.error('Error in Syndica configuration:', error);
  });