/**
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
  console.log(`Created cache directory: ${TOKEN_CACHE_DIR}`);
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
            reject(new Error(`Status code: ${res.statusCode}, Response: ${data}`));
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
    const tokenListUrl = `${JUPITER_API_URL}/tokens`;
    const tokenList = await makeRequest(tokenListUrl);
    
    // Save to cache
    fs.writeFileSync(TOKEN_LIST_PATH, JSON.stringify(tokenList, null, 2));
    console.log(`Updated token list cache with ${Object.keys(tokenList).length} tokens`);
    
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
            const priceUrl = `${JUPITER_API_URL}/price?ids=${token.address}`;
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
            console.error(`Error fetching price for ${tokenSymbol}:`, err.message);
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
  console.log(`Updated price cache with ${successCount} tokens`);
  
  return priceCache;
}

// Main function to update all caches
async function updateAllCaches() {
  try {
    console.log(`[${new Date().toISOString()}] Starting Jupiter cache update...`);
    
    // Update token list
    const tokenList = await updateTokenList();
    
    // Update token prices
    await updateTokenPrices(tokenList);
    
    console.log(`[${new Date().toISOString()}] Jupiter cache update completed successfully`);
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

console.log(`Jupiter cache updater started. Token list will update every ${tokenListInterval/1000}s, prices every ${priceInterval/1000}s`);
