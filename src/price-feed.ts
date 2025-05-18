/**
 * Enhanced Price Feed Service
 * Based on the Rust implementation you provided
 */

import axios from 'axios';
import NodeCache from 'node-cache';

// Cache configuration
const CACHE_TTL_SECONDS = 5; // Stay under limits for free tiers
const priceCache = new NodeCache({
  stdTTL: CACHE_TTL_SECONDS,
  checkperiod: Math.floor(CACHE_TTL_SECONDS / 2)
});

// DEX pool IDs for Raydium and Orca
const DEX_POOLS = [
  // Raydium pools
  '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
  'EVxuobSN4MqGoyzvRzUJWPePNJYbbWJsHvA9StRR1Umb',
  // Orca pools
  'APDFRM3HMr8CAGXwKHiu2f5ePSpaiEJhaURwhsRrUUt9',
  '8sFf9TW3KzxLiBXcDcjAxqabEsRroo4EiRr3UG1xbJed'
];

/**
 * Get SOL price from Jupiter
 */
async function getJupiterPrice(): Promise<number> {
  try {
    const response = await axios.get('https://price.jup.ag/v4/price?ids=SOL');
    if (response.data?.data?.SOL?.price) {
      return response.data.data.SOL.price;
    }
    throw new Error('Invalid Jupiter price response');
  } catch (error) {
    console.error(`Error fetching Jupiter price: ${error}`);
    throw error;
  }
}

/**
 * Get SOL price from Pyth Network
 */
async function getPythPrice(): Promise<number> {
  try {
    const response = await axios.get('https://api.pyth.network/api/latest_price_feeds?ids[]=2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b');
    const solFeed = response.data.find((feed: any) => 
      feed.id === '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b'
    );
    
    if (solFeed?.price?.price) {
      return solFeed.price.price;
    }
    throw new Error('Invalid Pyth price response');
  } catch (error) {
    console.error(`Error fetching Pyth price: ${error}`);
    throw error;
  }
}

/**
 * Get SOL price from Helius DEX pools
 */
async function getHeliusDexPrice(): Promise<number> {
  try {
    // Rotate through available pools
    const poolIndex = Math.floor(Math.random() * DEX_POOLS.length);
    const poolId = DEX_POOLS[poolIndex];
    
    const rpcRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "getPoolReserves",
      params: [poolId]
    };
    
    const response = await axios.post(
      "https://rpc.helius.xyz", 
      rpcRequest
    );
    
    const reserveA = response.data?.result?.value?.reserveA;
    const reserveB = response.data?.result?.value?.reserveB;
    
    if (reserveA && reserveB) {
      return reserveA / reserveB;
    }
    throw new Error('Invalid Helius pool response');
  } catch (error) {
    console.error(`Error fetching Helius DEX price: ${error}`);
    throw error;
  }
}

/**
 * Get cached SOL price from multiple sources
 * This function aggregates prices and returns the median to filter outliers
 */
export async function getCachedSolPrice(): Promise<number> {
  const cacheKey = 'sol_price';
  
  // Check if price is already in cache
  const cachedPrice = priceCache.get<number>(cacheKey);
  if (cachedPrice !== undefined) {
    return cachedPrice;
  }
  
  // Fetch prices from all sources
  const pricePromises = [
    getPythPrice().catch(() => null),
    getHeliusDexPrice().catch(() => null),
    getJupiterPrice().catch(() => null)
  ];
  
  // Wait for all price sources to resolve
  const priceResults = await Promise.all(pricePromises);
  
  // Filter out failures and get valid prices
  const validPrices: number[] = priceResults
    .filter((price): price is number => price !== null)
    .sort((a, b) => a - b);
  
  if (validPrices.length === 0) {
    throw new Error('Failed to fetch price from any source');
  }
  
  // Get median price to filter outliers
  const medianPrice = validPrices[Math.floor(validPrices.length / 2)];
  
  // Store in cache
  priceCache.set(cacheKey, medianPrice);
  
  // Log for monitoring
  console.log(`SOL Price: $${medianPrice.toFixed(2)} (from ${validPrices.length} sources)`);
  
  return medianPrice;
}

/**
 * Price monitor module
 */
export function startPriceMonitor(): void {
  // Log cache stats every minute
  setInterval(() => {
    const stats = priceCache.getStats();
    console.log(`Cache stats: ${stats.hits} hits, ${stats.misses} misses, ${stats.keys} keys`);
  }, 60000);
}

// Export default module
export default {
  getCachedSolPrice,
  startPriceMonitor
};