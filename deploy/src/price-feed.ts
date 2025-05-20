/**
 * Enhanced Price Feed Service
 * Based on the Rust implementation you provided, with extended functionality
 */

import axios from 'axios';
import NodeCache from 'node-cache';
import fs from 'fs';
import path from 'path';

// Token identifiers and addresses
interface TokenInfo {
  symbol: string;
  name: string;
  address: string;  // Solana token address
  pythId?: string;  // Pyth price feed ID if available
  isStablecoin?: boolean;
  decimals: number;
  category: 'major' | 'meme' | 'defi' | 'stablecoin';
}

// Token configuration
const TOKENS: Record<string, TokenInfo> = {
  'SOL': {
    symbol: 'SOL',
    name: 'Solana',
    address: 'So11111111111111111111111111111111111111112',
    pythId: '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
    decimals: 9,
    category: 'major'
  },
  'USDC': {
    symbol: 'USDC',
    name: 'USD Coin',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    pythId: 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    isStablecoin: true,
    decimals: 6,
    category: 'stablecoin'
  },
  'USDT': {
    symbol: 'USDT',
    name: 'Tether',
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    pythId: '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
    isStablecoin: true,
    decimals: 6,
    category: 'stablecoin'
  },
  'ETH': {
    symbol: 'ETH',
    name: 'Ethereum (Solana)',
    address: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    pythId: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    decimals: 8,
    category: 'major'
  },
  'BTC': {
    symbol: 'BTC',
    name: 'Bitcoin (Solana)',
    address: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
    pythId: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    decimals: 8,
    category: 'major'
  },
  'BONK': {
    symbol: 'BONK',
    name: 'Bonk',
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    decimals: 5,
    category: 'meme'
  },
  'WIF': {
    symbol: 'WIF',
    name: 'Dogwifhat',
    address: 'CJTfQ1tfQV1NuqYTjW9G9RM7hJydMYMnzFqrKVdxGoYs',
    decimals: 6,
    category: 'meme'
  },
  'JUP': {
    symbol: 'JUP',
    name: 'Jupiter',
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    decimals: 6,
    category: 'defi'
  },
  'MEME': {
    symbol: 'MEME',
    name: 'Memecoin',
    address: 'MeMeJU6RSCwVwsqHCp6MbdLPYM5cgKvWMFCsFF9JViL',
    decimals: 9,
    category: 'meme'
  },
  'CAT': {
    symbol: 'CAT',
    name: 'Cat Token',
    address: 'CATRgRNx43oatc6Gzr9Ee5Cau68BZuYyC7SyLpjQm8n',
    decimals: 9,
    category: 'meme'
  },
  'PNUT': {
    symbol: 'PNUT',
    name: 'Peanut',
    address: 'PNUTaswkAYcgwbBeGmzVWvkHhYKZRsQBj67MNFsxagf',
    decimals: 6,
    category: 'meme'
  }
};

// DEX pool configurations
interface DexPool {
  id: string;
  tokens: [string, string]; // e.g., ['SOL', 'USDC']
  exchange: 'Raydium' | 'Orca' | 'Jupiter' | 'Meteora';
  priority: number; // 1 is highest
}

// DEX pools by token pair
const DEX_POOLS: Record<string, DexPool[]> = {
  'SOL-USDC': [
    { id: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2', tokens: ['SOL', 'USDC'], exchange: 'Raydium', priority: 1 },
    { id: 'APDFRM3HMr8CAGXwKHiu2f5ePSpaiEJhaURwhsRrUUt9', tokens: ['SOL', 'USDC'], exchange: 'Orca', priority: 2 }
  ],
  'ETH-USDC': [
    { id: 'FgZut2qVQEyPBibaTJbbX2PxaMZvT1vjDebiVaDp5BWP', tokens: ['ETH', 'USDC'], exchange: 'Raydium', priority: 1 }
  ],
  'BONK-USDC': [
    { id: '8JP6vE5DrTQyZrVJBxsWs5JajYozMHpG1VhbkH9LZ5Vd', tokens: ['BONK', 'USDC'], exchange: 'Raydium', priority: 1 }
  ],
  'WIF-USDC': [
    { id: 'B7Oc46WoLkDLu1McvG5Gzw4s7nYNeN1Pg9dvuukHBj5T', tokens: ['WIF', 'USDC'], exchange: 'Raydium', priority: 1 }
  ]
};

// Price source configuration
const PRICE_SOURCES = {
  jupiter: {
    baseUrl: 'https://price.jup.ag/v4/price',
    rateLimit: 120, // requests per minute
    timeout: 5000,   // 5 seconds
    weight: 0.4      // 40% weight in aggregation
  },
  birdeye: {
    baseUrl: 'https://public-api.birdeye.so/public/price',
    apiKey: 'Basic API Key', // Use environment variable in production
    rateLimit: 60,  // requests per minute
    timeout: 5000,  // 5 seconds
    weight: 0.3     // 30% weight in aggregation
  },
  pyth: {
    baseUrl: 'https://api.pyth.network/api/latest_price_feeds',
    rateLimit: 60,  // requests per minute
    timeout: 5000,  // 5 seconds
    weight: 0.3     // 30% weight in aggregation
  },
  helius: {
    baseUrl: 'https://rpc.helius.xyz',
    apiKey: '', // Use environment variable in production
    rateLimit: 10,  // requests per minute
    timeout: 10000, // 10 seconds
    weight: 0.2     // 20% weight for DEX prices
  }
};

// Cache configuration
const CACHE_TTL_SECONDS = 5; // Stay under limits for free tiers
const CACHE_STATS_INTERVAL_MS = 60000; // Log stats every minute
const PRICE_LOG_INTERVAL_MS = 300000; // Log prices every 5 minutes

// Setup caches
const priceCache = new NodeCache({
  stdTTL: CACHE_TTL_SECONDS,
  checkperiod: Math.floor(CACHE_TTL_SECONDS / 2)
});

// Set up metrics collection for monitoring
interface PriceMetrics {
  timestamp: string;
  token: string;
  price: number;
  sources: number;
  latencyMs: number;
}

interface PriceSourceMetrics {
  source: string;
  requests: number;
  failures: number;
  latencyMs: number[];
}

// In-memory metrics storage
const sourceMetrics: Record<string, PriceSourceMetrics> = {
  jupiter: { source: 'jupiter', requests: 0, failures: 0, latencyMs: [] },
  birdeye: { source: 'birdeye', requests: 0, failures: 0, latencyMs: [] },
  pyth: { source: 'pyth', requests: 0, failures: 0, latencyMs: [] },
  helius: { source: 'helius', requests: 0, failures: 0, latencyMs: [] }
};

const priceMetrics: PriceMetrics[] = [];
const MAX_METRICS_HISTORY = 1000; // Keep the last 1000 price points

// Ensure the logs directory exists
const LOGS_DIR = './logs';
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Logging function for price data
function logPriceData(metrics: PriceMetrics): void {
  // Add to in-memory metrics
  priceMetrics.push(metrics);
  
  // Trim if exceeded max history
  if (priceMetrics.length > MAX_METRICS_HISTORY) {
    priceMetrics.shift();
  }
  
  // Format metric details
  console.log(
    `[PRICE] ${metrics.token}: $${metrics.price.toFixed(6)} | ` +
    `Sources: ${metrics.sources} | Latency: ${metrics.latencyMs}ms`
  );
}

// Function to write metrics to disk periodically
function saveMetricsToDisk(): void {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const metricsFilePath = path.join(LOGS_DIR, `price-metrics-${timestamp}.json`);
    
    // Create metrics snapshot
    const metricsSnapshot = {
      timestamp,
      priceMetrics: priceMetrics.slice(-100), // Last 100 price metrics
      sourceMetrics: { ...sourceMetrics }
    };
    
    // Write to disk
    fs.writeFileSync(metricsFilePath, JSON.stringify(metricsSnapshot, null, 2));
    
    console.log(`Saved price metrics to ${metricsFilePath}`);
    
    // Reset source metrics after saving
    Object.keys(sourceMetrics).forEach(source => {
      sourceMetrics[source].latencyMs = [];
    });
  } catch (error) {
    console.error('Error saving metrics to disk:', error);
  }
}

/**
 * Get token price from Jupiter
 */
async function getJupiterPrice(token: string): Promise<number> {
  const startTime = Date.now();
  const source = 'jupiter';
  sourceMetrics[source].requests++;
  
  try {
    const response = await axios.get(
      `${PRICE_SOURCES.jupiter.baseUrl}?ids=${token}`,
      { timeout: PRICE_SOURCES.jupiter.timeout }
    );
    
    const endTime = Date.now();
    sourceMetrics[source].latencyMs.push(endTime - startTime);
    
    if (response.data?.data?.[token]?.price) {
      return response.data.data[token].price;
    }
    throw new Error(`Invalid Jupiter price response for ${token}`);
  } catch (error) {
    sourceMetrics[source].failures++;
    console.error(`Error fetching ${token} price from Jupiter:`, error);
    throw error;
  }
}

/**
 * Get token price from Birdeye
 */
async function getBirdeyePrice(token: string): Promise<number> {
  const startTime = Date.now();
  const source = 'birdeye';
  sourceMetrics[source].requests++;
  
  try {
    const tokenInfo = TOKENS[token];
    if (!tokenInfo) {
      throw new Error(`Unknown token: ${token}`);
    }
    
    const response = await axios.get(
      `${PRICE_SOURCES.birdeye.baseUrl}?address=${tokenInfo.address}`,
      { 
        headers: { 'X-API-KEY': PRICE_SOURCES.birdeye.apiKey },
        timeout: PRICE_SOURCES.birdeye.timeout
      }
    );
    
    const endTime = Date.now();
    sourceMetrics[source].latencyMs.push(endTime - startTime);
    
    if (response.data?.data?.value) {
      return response.data.data.value;
    }
    throw new Error(`Invalid Birdeye price response for ${token}`);
  } catch (error) {
    sourceMetrics[source].failures++;
    console.error(`Error fetching ${token} price from Birdeye:`, error);
    throw error;
  }
}

/**
 * Get token price from Pyth Network
 */
async function getPythPrice(token: string): Promise<number> {
  const startTime = Date.now();
  const source = 'pyth';
  sourceMetrics[source].requests++;
  
  try {
    const tokenInfo = TOKENS[token];
    if (!tokenInfo || !tokenInfo.pythId) {
      throw new Error(`No Pyth feed ID for token: ${token}`);
    }
    
    const response = await axios.get(
      `${PRICE_SOURCES.pyth.baseUrl}?ids[]=${tokenInfo.pythId}`,
      { timeout: PRICE_SOURCES.pyth.timeout }
    );
    
    const endTime = Date.now();
    sourceMetrics[source].latencyMs.push(endTime - startTime);
    
    const tokenFeed = response.data.find((feed: any) => feed.id === tokenInfo.pythId);
    
    if (tokenFeed?.price?.price) {
      return tokenFeed.price.price;
    }
    throw new Error(`Invalid Pyth price response for ${token}`);
  } catch (error) {
    sourceMetrics[source].failures++;
    console.error(`Error fetching ${token} price from Pyth:`, error);
    throw error;
  }
}

/**
 * Get token price from Helius DEX pools
 */
async function getHeliusDexPrice(token: string): Promise<number> {
  const startTime = Date.now();
  const source = 'helius';
  sourceMetrics[source].requests++;
  
  try {
    // We need a USDC pair to get a USD price
    const pairKey = `${token}-USDC`;
    
    if (!DEX_POOLS[pairKey] || DEX_POOLS[pairKey].length === 0) {
      throw new Error(`No DEX pools configured for ${pairKey}`);
    }
    
    // Sort pools by priority and pick the first one
    const pools = [...DEX_POOLS[pairKey]].sort((a, b) => a.priority - b.priority);
    const pool = pools[0];
    
    const rpcRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "getPoolReserves",
      params: [pool.id]
    };
    
    const response = await axios.post(
      PRICE_SOURCES.helius.baseUrl,
      rpcRequest,
      { timeout: PRICE_SOURCES.helius.timeout }
    );
    
    const endTime = Date.now();
    sourceMetrics[source].latencyMs.push(endTime - startTime);
    
    const reserveA = response.data?.result?.value?.reserveA;
    const reserveB = response.data?.result?.value?.reserveB;
    
    if (reserveA && reserveB) {
      // If token is the first in the pair, divide USDC by token
      // If token is second in the pair, return the reserveA/reserveB directly
      if (pool.tokens[0] === token) {
        return reserveB / reserveA; // Convert to $ price
      } else {
        return reserveA / reserveB;
      }
    }
    throw new Error(`Invalid Helius DEX response for ${token}`);
  } catch (error) {
    sourceMetrics[source].failures++;
    console.error(`Error fetching ${token} price from Helius DEX:`, error);
    throw error;
  }
}

/**
 * Get cached token price from multiple sources
 * This function aggregates prices and returns the median to filter outliers
 */
export async function getTokenPrice(token: string): Promise<number> {
  const startTime = Date.now();
  const cacheKey = `price_${token}`;
  
  // Normalize token symbol to uppercase
  token = token.toUpperCase();
  
  // Check if token is supported
  if (!TOKENS[token]) {
    throw new Error(`Unsupported token: ${token}`);
  }
  
  // Check if price is already in cache
  const cachedPrice = priceCache.get<number>(cacheKey);
  if (cachedPrice !== undefined) {
    return cachedPrice;
  }
  
  // Determine which sources to use based on token category
  const tokenInfo = TOKENS[token];
  const sources: (() => Promise<number>)[] = [];
  
  // Jupiter is available for all tokens
  sources.push(() => getJupiterPrice(token));
  
  // Birdeye is available for all tokens
  sources.push(() => getBirdeyePrice(token));
  
  // Pyth is only available for major tokens
  if (tokenInfo.pythId) {
    sources.push(() => getPythPrice(token));
  }
  
  // Helius DEX is available if we have configured pools
  if (DEX_POOLS[`${token}-USDC`]) {
    sources.push(() => getHeliusDexPrice(token));
  }
  
  // Fetch prices from all available sources
  const pricePromises = sources.map(source => source().catch(() => null));
  
  // Wait for all price sources to resolve
  const priceResults = await Promise.all(pricePromises);
  
  // Filter out failures and get valid prices
  const validPrices: number[] = priceResults
    .filter((price): price is number => price !== null)
    .sort((a, b) => a - b);
  
  if (validPrices.length === 0) {
    throw new Error(`Failed to fetch ${token} price from any source`);
  }
  
  // Get median price to filter outliers
  const medianPrice = validPrices[Math.floor(validPrices.length / 2)];
  
  // Store in cache
  priceCache.set(cacheKey, medianPrice);
  
  // Calculate metrics
  const endTime = Date.now();
  const latencyMs = endTime - startTime;
  
  // Log metrics
  const metrics: PriceMetrics = {
    timestamp: new Date().toISOString(),
    token,
    price: medianPrice,
    sources: validPrices.length,
    latencyMs
  };
  
  logPriceData(metrics);
  
  return medianPrice;
}

/**
 * Get price for SOL (convenience method)
 */
export async function getCachedSolPrice(): Promise<number> {
  return getTokenPrice('SOL');
}

/**
 * Get multiple token prices at once
 */
export async function getMultipleTokenPrices(tokens: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  
  // Get all prices in parallel
  await Promise.all(
    tokens.map(async (token) => {
      try {
        prices[token] = await getTokenPrice(token);
      } catch (error) {
        console.error(`Error getting price for ${token}:`, error);
      }
    })
  );
  
  return prices;
}

/**
 * Get token price in terms of another token
 */
export async function getTokenPriceInToken(baseToken: string, quoteToken: string): Promise<number> {
  const basePrice = await getTokenPrice(baseToken);
  const quotePrice = await getTokenPrice(quoteToken);
  
  return basePrice / quotePrice;
}

/**
 * Get cached list of supported tokens
 */
export function getSupportedTokens(): string[] {
  return Object.keys(TOKENS);
}

/**
 * Clear cache for specific token or all tokens
 */
export function clearCache(token?: string): void {
  if (token) {
    priceCache.del(`price_${token.toUpperCase()}`);
  } else {
    priceCache.flushAll();
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): any {
  return priceCache.getStats();
}

/**
 * Get source metrics
 */
export function getSourceMetrics(): any {
  return sourceMetrics;
}

/**
 * Get price metrics
 */
export function getPriceMetrics(limit: number = 100): PriceMetrics[] {
  return priceMetrics.slice(-limit);
}

/**
 * Price monitor module
 */
export function startPriceMonitor(): void {
  console.log('Starting price feed monitor...');
  
  // Log cache stats every minute
  setInterval(() => {
    const stats = priceCache.getStats();
    console.log(`Cache stats: ${stats.hits} hits, ${stats.misses} misses, ${stats.keys} keys`);
    
    // Log source metrics
    Object.keys(sourceMetrics).forEach(source => {
      const metrics = sourceMetrics[source];
      const avgLatency = metrics.latencyMs.length > 0 ? 
        metrics.latencyMs.reduce((sum, val) => sum + val, 0) / metrics.latencyMs.length : 0;
      
      console.log(
        `[${source.toUpperCase()}] Requests: ${metrics.requests}, ` +
        `Failures: ${metrics.failures}, ` +
        `Success Rate: ${metrics.requests > 0 ? ((metrics.requests - metrics.failures) / metrics.requests * 100).toFixed(1) : 0}%, ` +
        `Avg Latency: ${avgLatency.toFixed(0)}ms`
      );
    });
  }, CACHE_STATS_INTERVAL_MS);
  
  // Save metrics to disk every 5 minutes
  setInterval(() => {
    saveMetricsToDisk();
  }, PRICE_LOG_INTERVAL_MS);
  
  // Periodically refresh key token prices to keep cache warm
  setInterval(async () => {
    const keyTokens = ['SOL', 'USDC', 'ETH', 'BTC', 'BONK', 'WIF'];
    try {
      await getMultipleTokenPrices(keyTokens);
      console.log('Refreshed key token prices');
    } catch (error) {
      console.error('Error refreshing token prices:', error);
    }
  }, CACHE_TTL_SECONDS * 1000 * 0.8); // Refresh slightly before cache expiry
}

// Export service
export default {
  getTokenPrice,
  getCachedSolPrice,
  getMultipleTokenPrices,
  getTokenPriceInToken,
  getSupportedTokens,
  clearCache,
  getCacheStats,
  getSourceMetrics,
  getPriceMetrics,
  startPriceMonitor
};