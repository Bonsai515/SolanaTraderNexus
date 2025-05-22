/**
 * Configure Jupiter API Integration
 * 
 * This script configures the Jupiter API integration for
 * optimized price checks and execution routes.
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration paths
const API_CONFIG_PATH = path.join('./data', 'api-endpoints.json');
const JUPITER_CACHE_PATH = path.join('./data', 'jupiter-cache-config.json');
const SYSTEM_CONFIG_PATH = path.join('./data', 'system-state-memory.json');

// Jupiter API endpoint
const JUPITER_API_URL = 'https://public.jupiterapi.com';

/**
 * Configure Jupiter API endpoint
 */
function configureJupiterEndpoint() {
  console.log('Configuring Jupiter API endpoint...');
  
  try {
    // Create or read API endpoints configuration
    let apiConfig: any = {};
    if (fs.existsSync(API_CONFIG_PATH)) {
      apiConfig = JSON.parse(fs.readFileSync(API_CONFIG_PATH, 'utf8'));
    }
    
    // Update Jupiter API configuration
    apiConfig.jupiter = {
      baseUrl: JUPITER_API_URL,
      enabled: true,
      priority: 1,
      endpoints: {
        quote: `${JUPITER_API_URL}/quote`,
        swap: `${JUPITER_API_URL}/swap`,
        price: `${JUPITER_API_URL}/price`,
        tokenList: `${JUPITER_API_URL}/tokens`,
        indexedRouteMap: `${JUPITER_API_URL}/indexed-route-map`,
        markets: `${JUPITER_API_URL}/markets`
      },
      rateLimits: {
        requestsPerSecond: 10,
        requestsPerMinute: 300,
        requestsPerHour: 10000
      },
      caching: {
        enabled: true,
        tokenListTtlMs: 3600000, // 1 hour
        priceTtlMs: 15000, // 15 seconds
        routeTtlMs: 10000, // 10 seconds
        marketsTtlMs: 60000 // 1 minute
      },
      preferredOverDex: true,
      preferredForPriceData: true,
      backupEndpoints: [
        "https://price.jup.ag/v6",
        "https://token.jup.ag/all"
      ],
      lastUpdated: new Date().toISOString()
    };
    
    // Save API configuration
    fs.writeFileSync(API_CONFIG_PATH, JSON.stringify(apiConfig, null, 2));
    console.log('✅ Configured Jupiter API endpoint');
    
    return true;
  } catch (error) {
    console.error('Error configuring Jupiter API endpoint:', error);
    return false;
  }
}

/**
 * Configure Jupiter cache system
 */
function configureJupiterCache() {
  console.log('Configuring Jupiter cache system...');
  
  try {
    // Create Jupiter cache configuration
    const jupiterCache = {
      enabled: true,
      version: "1.0.0",
      storage: {
        persistToDisk: true,
        diskPath: "./data/jupiter-cache",
        loadOnStartup: true,
        saveIntervalMs: 60000 // 1 minute
      },
      cacheTypes: {
        tokenList: {
          enabled: true,
          ttlMs: 3600000, // 1 hour
          refreshStaleAfterMs: 1800000, // 30 minutes
          maxSize: 5000 // Max 5000 tokens
        },
        prices: {
          enabled: true,
          ttlMs: 15000, // 15 seconds
          refreshStaleAfterMs: 5000, // 5 seconds
          maxSize: 1000 // Max 1000 price entries
        },
        routes: {
          enabled: true,
          ttlMs: 10000, // 10 seconds
          refreshStaleAfterMs: 5000, // 5 seconds
          maxSize: 500 // Max 500 route entries
        },
        markets: {
          enabled: true,
          ttlMs: 60000, // 1 minute
          refreshStaleAfterMs: 30000, // 30 seconds
          maxSize: 200 // Max 200 market entries
        }
      },
      streamingUpdates: {
        enabled: true,
        connectOnStartup: true,
        reconnectIntervalMs: 5000, // 5 seconds
        websocketUrl: "wss://price.jup.ag/v6/ws"
      },
      optimization: {
        useCompression: true,
        useDeduplication: true,
        prioritizeHighVolumeTokens: true,
        preloadCommonTokenPairs: true
      },
      commonTokenPairs: [
        "SOL/USDC",
        "SOL/USDT",
        "USDC/USDT",
        "BTC/USDC",
        "ETH/USDC",
        "BONK/USDC",
        "JUP/USDC",
        "MNGO/USDC",
        "WIF/USDC"
      ],
      createdAt: new Date().toISOString()
    };
    
    // Save Jupiter cache configuration
    fs.writeFileSync(JUPITER_CACHE_PATH, JSON.stringify(jupiterCache, null, 2));
    console.log('✅ Configured Jupiter cache system');
    
    return true;
  } catch (error) {
    console.error('Error configuring Jupiter cache:', error);
    return false;
  }
}

/**
 * Update system config to use Jupiter API
 */
function updateSystemConfig() {
  console.log('Updating system configuration for Jupiter API...');
  
  try {
    // Read system configuration
    let systemConfig: any = {};
    if (fs.existsSync(SYSTEM_CONFIG_PATH)) {
      systemConfig = JSON.parse(fs.readFileSync(SYSTEM_CONFIG_PATH, 'utf8'));
    }
    
    // Update API configuration
    systemConfig.apiConfiguration = systemConfig.apiConfiguration || {};
    systemConfig.apiConfiguration.jupiter = {
      enabled: true,
      useForPriceData: true,
      useForRouting: true,
      useForMarketData: true,
      useJupiterSwap: true,
      url: JUPITER_API_URL,
      priorityLevel: "highest"
    };
    
    // Update strategy configurations to use Jupiter
    systemConfig.strategyConfigurations = systemConfig.strategyConfigurations || {};
    
    // Ensure all strategies use Jupiter API
    if (systemConfig.activeStrategies) {
      systemConfig.activeStrategies.forEach((strategy: string) => {
        if (!systemConfig.strategyConfigurations[strategy]) {
          systemConfig.strategyConfigurations[strategy] = {};
        }
        
        systemConfig.strategyConfigurations[strategy].useJupiterApi = true;
        systemConfig.strategyConfigurations[strategy].jupiterPriority = "highest";
      });
    }
    
    // Update timestamp
    systemConfig.lastModified = new Date().toISOString();
    systemConfig.jupiterConfigured = new Date().toISOString();
    
    // Save updated system configuration
    fs.writeFileSync(SYSTEM_CONFIG_PATH, JSON.stringify(systemConfig, null, 2));
    console.log('✅ Updated system configuration for Jupiter API');
    
    return true;
  } catch (error) {
    console.error('Error updating system configuration:', error);
    return false;
  }
}

/**
 * Create Jupiter token caching script
 */
function createJupiterCachingScript() {
  console.log('Creating Jupiter token caching script...');
  
  try {
    // Create the script content
    const scriptContent = `/**
 * Jupiter Token Cache Updater
 * 
 * This script periodically fetches and updates the Jupiter token cache
 * to ensure fresh price data and routes without rate limiting.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

// Configuration
const JUPITER_API_URL = 'https://public.jupiterapi.com';
const TOKEN_CACHE_DIR = path.join('./data', 'jupiter-cache');
const TOKEN_LIST_PATH = path.join(TOKEN_CACHE_DIR, 'token-list.json');
const PRICE_CACHE_PATH = path.join(TOKEN_CACHE_DIR, 'price-cache.json');
const CACHE_CONFIG_PATH = path.join('./data', 'jupiter-cache-config.json');

// Ensure cache directory exists
if (!fs.existsSync(TOKEN_CACHE_DIR)) {
  fs.mkdirSync(TOKEN_CACHE_DIR, { recursive: true });
  console.log(\`Created cache directory: \${TOKEN_CACHE_DIR}\`);
}

// Load configuration
let cacheConfig = {};
if (fs.existsSync(CACHE_CONFIG_PATH)) {
  try {
    cacheConfig = JSON.parse(fs.readFileSync(CACHE_CONFIG_PATH, 'utf8'));
  } catch (err) {
    console.error('Error loading cache configuration:', err);
  }
}

// Helper function to make HTTP requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(\`Status code: \${res.statusCode}, Response: \${data}\`));
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Fetch and cache token list
async function updateTokenList() {
  console.log('Updating Jupiter token list...');
  
  try {
    const tokenListUrl = \`\${JUPITER_API_URL}/tokens\`;
    const tokenList = await makeRequest(tokenListUrl);
    
    // Save to cache
    fs.writeFileSync(TOKEN_LIST_PATH, JSON.stringify(tokenList, null, 2));
    console.log(\`Updated token list cache with \${Object.keys(tokenList).length} tokens\`);
    
    return tokenList;
  } catch (err) {
    console.error('Error updating token list:', err);
    
    // Try to load from cache if available
    if (fs.existsSync(TOKEN_LIST_PATH)) {
      console.log('Using cached token list');
      return JSON.parse(fs.readFileSync(TOKEN_LIST_PATH, 'utf8'));
    }
    
    return {};
  }
}

// Fetch and cache token prices for common tokens
async function updateTokenPrices(tokenList) {
  console.log('Updating Jupiter token prices...');
  
  // Get common token pairs from config
  const commonTokens = (cacheConfig.commonTokenPairs || [])
    .map(pair => pair.split('/'))
    .flat()
    .filter((value, index, self) => self.indexOf(value) === index);
  
  // Add other popular tokens
  const popularTokens = ['SOL', 'USDC', 'USDT', 'BTC', 'ETH', 'BONK', 'JUP', 'WIF', 'MNGO', 'RAY'];
  const tokensToFetch = [...new Set([...commonTokens, ...popularTokens])];
  
  // Prepare price cache
  let priceCache = {};
  if (fs.existsSync(PRICE_CACHE_PATH)) {
    try {
      priceCache = JSON.parse(fs.readFileSync(PRICE_CACHE_PATH, 'utf8'));
    } catch (err) {
      console.error('Error loading price cache:', err);
    }
  }
  
  // Update timestamp for all entries
  const now = Date.now();
  Object.keys(priceCache).forEach(key => {
    priceCache[key].lastUpdated = now;
  });
  
  // Fetch prices for each token (with rate limiting)
  const fetchPromises = [];
  let successCount = 0;
  
  for (const tokenSymbol of tokensToFetch) {
    // Find token in token list
    const token = Object.values(tokenList).find(
      (t) => t.symbol === tokenSymbol
    );
    
    if (token && token.address) {
      // Add delay to prevent rate limiting
      const fetchWithDelay = (index) => new Promise((resolve) => {
        setTimeout(async () => {
          try {
            const priceUrl = \`\${JUPITER_API_URL}/price?ids=\${token.address}\`;
            const priceData = await makeRequest(priceUrl);
            
            if (priceData && priceData.data && priceData.data[token.address]) {
              priceCache[token.symbol] = {
                price: priceData.data[token.address].price,
                address: token.address,
                lastUpdated: Date.now()
              };
              successCount++;
            }
            resolve();
          } catch (err) {
            console.error(\`Error fetching price for \${tokenSymbol}:\`, err.message);
            resolve();
          }
        }, index * 300); // 300ms delay between requests
      });
      
      fetchPromises.push(fetchWithDelay(fetchPromises.length));
    }
  }
  
  // Wait for all price fetches to complete
  await Promise.all(fetchPromises);
  
  // Save updated price cache
  fs.writeFileSync(PRICE_CACHE_PATH, JSON.stringify(priceCache, null, 2));
  console.log(\`Updated price cache with \${successCount} tokens\`);
  
  return priceCache;
}

// Main function to update all caches
async function updateAllCaches() {
  try {
    console.log(\`[\${new Date().toISOString()}] Starting Jupiter cache update...\`);
    
    // Update token list
    const tokenList = await updateTokenList();
    
    // Update token prices
    await updateTokenPrices(tokenList);
    
    console.log(\`[\${new Date().toISOString()}] Jupiter cache update completed successfully\`);
  } catch (err) {
    console.error('Error in cache update process:', err);
  }
}

// Run once immediately
updateAllCaches();

// Schedule regular updates based on configuration
const tokenListInterval = cacheConfig.cacheTypes?.tokenList?.ttlMs || 3600000; // 1 hour default
const priceInterval = cacheConfig.cacheTypes?.prices?.ttlMs || 15000; // 15 seconds default

// Schedule token list updates
setInterval(() => {
  updateTokenList().catch(err => console.error('Error in scheduled token list update:', err));
}, tokenListInterval);

// Schedule price updates
setInterval(() => {
  // Load the latest token list
  let tokenList = {};
  if (fs.existsSync(TOKEN_LIST_PATH)) {
    try {
      tokenList = JSON.parse(fs.readFileSync(TOKEN_LIST_PATH, 'utf8'));
    } catch (err) {
      console.error('Error loading token list for price update:', err);
    }
  }
  
  updateTokenPrices(tokenList).catch(err => console.error('Error in scheduled price update:', err));
}, priceInterval);

console.log(\`Jupiter cache updater started. Token list will update every \${tokenListInterval/1000}s, prices every \${priceInterval/1000}s\`);
`;
    
    // Save the script
    const scriptPath = path.join('./data', 'jupiter-cache-updater.js');
    fs.writeFileSync(scriptPath, scriptContent);
    
    // Make executable
    try {
      fs.chmodSync(scriptPath, '755');
    } catch (err) {
      console.warn('Could not change file permissions:', err);
    }
    
    console.log('✅ Created Jupiter token caching script');
    return true;
  } catch (error) {
    console.error('Error creating Jupiter caching script:', error);
    return false;
  }
}

/**
 * Create launcher script for Jupiter caching
 */
function createLauncherScript() {
  console.log('Creating launcher script for Jupiter caching...');
  
  try {
    // Create the launcher script content
    const launcherContent = `#!/usr/bin/env node
/**
 * Launch Jupiter Cache System
 * 
 * This script launches the Jupiter cache system to ensure
 * fresh price data and routes without rate limiting.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const UPDATER_PATH = path.join('./data', 'jupiter-cache-updater.js');

// Ensure the updater exists
if (!fs.existsSync(UPDATER_PATH)) {
  console.error('Jupiter cache updater not found!');
  process.exit(1);
}

// Launch the updater
console.log('Launching Jupiter cache updater...');
const updater = spawn('node', [UPDATER_PATH], {
  detached: true,
  stdio: 'ignore'
});

updater.unref();

console.log('✅ Jupiter cache updater is now running in the background');
console.log('✅ System will automatically cache token prices and routes');
`;
    
    // Save the launcher script
    const launcherPath = path.join('./launch-jupiter-cache.js');
    fs.writeFileSync(launcherPath, launcherContent);
    
    // Make executable
    try {
      fs.chmodSync(launcherPath, '755');
    } catch (err) {
      console.warn('Could not change file permissions:', err);
    }
    
    console.log('✅ Created launcher script for Jupiter caching');
    return true;
  } catch (error) {
    console.error('Error creating launcher script:', error);
    return false;
  }
}

/**
 * Main function to configure Jupiter API
 */
async function main() {
  console.log('Starting Jupiter API configuration...');
  
  // Configure Jupiter API and cache
  const endpointResult = configureJupiterEndpoint();
  const cacheResult = configureJupiterCache();
  const systemResult = updateSystemConfig();
  const scriptResult = createJupiterCachingScript();
  const launcherResult = createLauncherScript();
  
  // Check overall success
  const success = endpointResult && cacheResult && 
                 systemResult && scriptResult && launcherResult;
  
  if (success) {
    console.log('\n=== JUPITER API CONFIGURATION COMPLETED SUCCESSFULLY ===');
    console.log('✅ Configured Jupiter API endpoint');
    console.log('✅ Set up Jupiter cache system');
    console.log('✅ Updated system configuration for Jupiter API');
    console.log('✅ Created Jupiter token caching script');
    console.log('✅ Created launcher script for Jupiter caching');
    console.log('\nThe system will now use Jupiter API for:');
    console.log('- Token price checks and tracking');
    console.log('- Swap route optimization');
    console.log('- Market data and liquidity information');
    console.log('\nTo start the Jupiter cache system, run:');
    console.log('node launch-jupiter-cache.js');
  } else {
    console.error('\n⚠️ Jupiter API configuration completed with some errors');
    console.log('Some components may not be fully configured.');
  }
}

// Run the main function
main()
  .catch(error => {
    console.error('Error configuring Jupiter API:', error);
  });