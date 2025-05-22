/**
 * Free BirdEye API Scanner
 * 
 * This module provides alternative methods to get BirdEye data
 * without requiring a paid API key, using public endpoints and caching.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Cache settings
const CACHE_DIR = path.join(__dirname, '../../data/cache');
const CACHE_FILE = path.join(CACHE_DIR, 'birdeye-free-cache.json');
const CACHE_EXPIRY = 15 * 60 * 1000; // 15 minutes

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Initialize cache
let tokenCache = {
  trending: [],
  top: [],
  lastUpdated: 0
};

// Load cache from disk if exists
try {
  if (fs.existsSync(CACHE_FILE)) {
    const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    tokenCache = cacheData;
    console.log(`Loaded ${tokenCache.trending.length} trending tokens and ${tokenCache.top.length} top tokens from cache`);
  }
} catch (error) {
  console.error(`Error loading cache: ${error.message}`);
}

/**
 * Save cache to disk
 */
function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(tokenCache), 'utf8');
    console.log('Saved BirdEye cache to disk');
  } catch (error) {
    console.error(`Error saving cache: ${error.message}`);
  }
}

/**
 * Use public endpoints to get trending tokens without API key
 */
async function getTrendingTokens() {
  // Check cache first
  const now = Date.now();
  if (tokenCache.trending.length > 0 && now - tokenCache.lastUpdated < CACHE_EXPIRY) {
    console.log(`Using cached trending tokens (${tokenCache.trending.length} tokens)`);
    return tokenCache.trending;
  }

  try {
    // Use website's public endpoints instead of API
    const response = await axios.get('https://api.birdeye.so/defi/trending_tokens?chain=solana', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    if (response.data && Array.isArray(response.data.data)) {
      // Process and transform the data
      const tokens = response.data.data.map(token => ({
        symbol: token.symbol,
        name: token.name || token.symbol,
        address: token.address,
        price: token.price || 0,
        priceChange24h: token.priceChange24h || 0,
        volume24h: token.volume24h || 0,
        marketCap: token.marketCap || 0,
        liquidity: token.liquidity || 0,
        holders: token.holders || 0,
        totalSupply: token.supply || 0,
        score: calculateScore(token),
        source: 'birdeye'
      }));

      // Update cache
      tokenCache.trending = tokens;
      tokenCache.lastUpdated = now;
      saveCache();

      console.log(`Successfully fetched ${tokens.length} trending tokens from BirdEye`);
      return tokens;
    }

    console.warn('No trending tokens found from BirdEye');
    return tokenCache.trending.length > 0 ? tokenCache.trending : [];
  } catch (error) {
    console.error(`Error fetching BirdEye trending tokens: ${error.message}`);
    return tokenCache.trending.length > 0 ? tokenCache.trending : [];
  }
}

/**
 * Use public endpoints to get top tokens without API key
 */
async function getTopTokens() {
  // Check cache first
  const now = Date.now();
  if (tokenCache.top.length > 0 && now - tokenCache.lastUpdated < CACHE_EXPIRY) {
    console.log(`Using cached top tokens (${tokenCache.top.length} tokens)`);
    return tokenCache.top;
  }

  try {
    // Use website's public endpoints instead of API
    const response = await axios.get('https://api.birdeye.so/defi/top_tokens?chain=solana', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    if (response.data && Array.isArray(response.data.data)) {
      // Process and transform the data
      const tokens = response.data.data.map(token => ({
        symbol: token.symbol,
        name: token.name || token.symbol,
        address: token.address,
        price: token.price || 0,
        priceChange24h: token.priceChange24h || 0,
        volume24h: token.volume24h || 0,
        marketCap: token.marketCap || 0,
        liquidity: token.liquidity || 0,
        holders: token.holders || 0,
        totalSupply: token.supply || 0,
        score: calculateScore(token),
        source: 'birdeye'
      }));

      // Update cache
      tokenCache.top = tokens;
      tokenCache.lastUpdated = now;
      saveCache();

      console.log(`Successfully fetched ${tokens.length} top tokens from BirdEye`);
      return tokens;
    }

    console.warn('No top tokens found from BirdEye');
    return tokenCache.top.length > 0 ? tokenCache.top : [];
  } catch (error) {
    console.error(`Error fetching BirdEye top tokens: ${error.message}`);
    return tokenCache.top.length > 0 ? tokenCache.top : [];
  }
}

/**
 * Get price data for a specific token
 */
async function getTokenPrice(address) {
  try {
    const response = await axios.get(`https://public-api.birdeye.so/public/price?address=${address}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      timeout: 5000
    });

    if (response.data && response.data.success && response.data.data && response.data.data.value) {
      return {
        price: response.data.data.value,
        lastUpdated: Date.now(),
        source: 'birdeye'
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching token price from BirdEye: ${error.message}`);
    return null;
  }
}

/**
 * Calculate a score for token ranking
 */
function calculateScore(token) {
  // Calculate a score based on price change, volume, and liquidity
  const priceChangeScore = (token.priceChange24h || 0) * 0.4;
  const volumeScore = ((token.volume24h || 0) / 1000000) * 0.35;
  const liquidityScore = ((token.liquidity || 0) / 1000000) * 0.25;
  
  return priceChangeScore + volumeScore + liquidityScore;
}

/**
 * Combine trending and top tokens with deduplication
 */
async function getAllTokens() {
  try {
    const trending = await getTrendingTokens();
    const top = await getTopTokens();
    
    // Combine and deduplicate
    const tokenMap = new Map();
    
    // Add trending tokens
    trending.forEach(token => {
      tokenMap.set(token.address, token);
    });
    
    // Add top tokens (will overwrite duplicates)
    top.forEach(token => {
      tokenMap.set(token.address, token);
    });
    
    // Convert back to array
    const allTokens = Array.from(tokenMap.values());
    
    console.log(`Combined ${trending.length} trending and ${top.length} top tokens into ${allTokens.length} unique tokens`);
    return allTokens;
  } catch (error) {
    console.error(`Error combining tokens: ${error.message}`);
    
    // Return whatever we have
    return [...tokenCache.trending, ...tokenCache.top];
  }
}

// Export functions
module.exports = {
  getTrendingTokens,
  getTopTokens,
  getTokenPrice,
  getAllTokens
};