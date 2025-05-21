/**
 * Jupiter API Manager
 * 
 * Handles all interactions with Jupiter API with efficient caching
 * to respect rate limits while providing fresh data.
 */

import axios from 'axios';
import * as logger from '../logger';
import { getConnection } from '../solana/connection-manager';
import { PublicKey } from '@solana/web3.js';

// Configuration
const JUPITER_API_BASE_URL = 'https://quote-api.jup.ag/v6';
const CACHE_TTL_MS = {
  quotes: 10 * 1000,           // 10 seconds for quotes
  tokens: 5 * 60 * 1000,       // 5 minutes for token list
  routes: 20 * 1000,           // 20 seconds for routes
  markets: 5 * 60 * 1000,      // 5 minutes for markets
  prices: 30 * 1000            // 30 seconds for prices
};

// Caches
interface CachedItem<T> {
  data: T;
  timestamp: number;
}

const tokenCache: CachedItem<any> = { data: null, timestamp: 0 };
const priceCache: Map<string, CachedItem<number>> = new Map();
const quotesCache: Map<string, CachedItem<any>> = new Map();
const routesCache: Map<string, CachedItem<any>> = new Map();
const marketsCache: CachedItem<any> = { data: null, timestamp: 0 };

// Rate limiting
const rateLimiter = {
  lastRequestTime: 0,
  minIntervalMs: 100, // Minimum 100ms between requests
  requestCount: 0,
  maxRequestsPerMinute: 60,
  requestTimestamps: [] as number[]
};

/**
 * Async sleep function
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Apply rate limiting before making a request
 */
async function applyRateLimit(): Promise<void> {
  const now = Date.now();
  
  // Clean up old timestamps
  rateLimiter.requestTimestamps = rateLimiter.requestTimestamps.filter(
    timestamp => now - timestamp < 60000
  );
  
  // Check if we're over the rate limit
  if (rateLimiter.requestTimestamps.length >= rateLimiter.maxRequestsPerMinute) {
    // Wait until we're under the rate limit
    const oldestTimestamp = rateLimiter.requestTimestamps[0];
    const waitTime = Math.max(60000 - (now - oldestTimestamp) + 50, 500);
    
    logger.warn(`[Jupiter] Rate limit reached, waiting ${waitTime}ms`);
    await sleep(waitTime);
    
    // Recursive call after waiting to recheck
    return applyRateLimit();
  }
  
  // Ensure minimum interval between requests
  const timeSinceLastRequest = now - rateLimiter.lastRequestTime;
  if (timeSinceLastRequest < rateLimiter.minIntervalMs) {
    await sleep(rateLimiter.minIntervalMs - timeSinceLastRequest);
  }
  
  // Track the request
  rateLimiter.lastRequestTime = Date.now();
  rateLimiter.requestCount++;
  rateLimiter.requestTimestamps.push(Date.now());
}

/**
 * Make an API request with rate limiting and error handling
 */
async function makeRequest<T>(url: string, method: 'GET' | 'POST' = 'GET', data: any = null): Promise<T> {
  try {
    await applyRateLimit();
    
    const options = {
      method,
      url,
      data: method === 'POST' ? data : undefined,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const response = await axios(options);
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    
    // Special handling for common errors
    if (status === 429) {
      logger.warn(`[Jupiter] Rate limit exceeded: ${message}`);
      
      // Wait and retry
      await sleep(2000);
      return makeRequest(url, method, data);
    } else if (status >= 500) {
      logger.error(`[Jupiter] Server error: ${message}`);
      throw new Error(`Jupiter server error: ${message}`);
    } else {
      logger.error(`[Jupiter] API error: ${message}`);
      throw error;
    }
  }
}

/**
 * Get Jupiter tokens
 */
export async function getJupiterTokens(): Promise<any> {
  try {
    const now = Date.now();
    
    // Check cache
    if (tokenCache.data && now - tokenCache.timestamp < CACHE_TTL_MS.tokens) {
      return tokenCache.data;
    }
    
    // Fetch fresh data
    const url = `${JUPITER_API_BASE_URL}/tokens`;
    const data = await makeRequest<any>(url);
    
    // Update cache
    tokenCache.data = data;
    tokenCache.timestamp = now;
    
    logger.info(`[Jupiter] Fetched ${Object.keys(data.tokens || {}).length} tokens`);
    return data;
  } catch (error) {
    logger.error(`[Jupiter] Error fetching tokens: ${error.message}`);
    
    // Return cached data if available, even if expired
    if (tokenCache.data) {
      logger.warn('[Jupiter] Returning cached token data due to API error');
      return tokenCache.data;
    }
    
    throw error;
  }
}

/**
 * Get token price from Jupiter
 */
export async function getTokenPrice(tokenMint: string): Promise<number | null> {
  try {
    const now = Date.now();
    const cacheKey = tokenMint;
    
    // Check cache
    const cached = priceCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS.prices) {
      return cached.data;
    }
    
    // Fetch fresh data - use Jupiter's quote API to get price against USDC
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC mint
    
    // Get a quote for 1 unit of the token to USDC
    const url = `${JUPITER_API_BASE_URL}/quote`;
    const params = {
      inputMint: tokenMint,
      outputMint: usdcMint,
      amount: 1_000_000, // 1 unit in lamports (adjusted in result)
      slippageBps: 50
    };
    
    const queryString = new URLSearchParams(params as any).toString();
    const data = await makeRequest<any>(`${url}?${queryString}`);
    
    // Calculate price based on the quote
    if (data && data.outAmount) {
      // Convert outAmount from lamports to USDC
      const price = parseInt(data.outAmount) / 1_000_000;
      
      // Update cache
      priceCache.set(cacheKey, { data: price, timestamp: now });
      
      logger.debug(`[Jupiter] Fetched price for ${tokenMint}: $${price}`);
      return price;
    }
    
    logger.warn(`[Jupiter] Invalid price data for ${tokenMint}`);
    return null;
  } catch (error) {
    logger.error(`[Jupiter] Error fetching price for ${tokenMint}: ${error.message}`);
    
    // Return cached price if available, even if expired
    const cached = priceCache.get(tokenMint);
    if (cached) {
      logger.warn(`[Jupiter] Returning cached price for ${tokenMint} due to API error`);
      return cached.data;
    }
    
    return null;
  }
}

/**
 * Get multiple token prices simultaneously
 */
export async function getMultipleTokenPrices(tokenMints: string[]): Promise<Record<string, number | null>> {
  try {
    const results: Record<string, number | null> = {};
    const now = Date.now();
    
    // Split into cached and non-cached tokens
    const tokensToFetch: string[] = [];
    
    tokenMints.forEach(mint => {
      const cached = priceCache.get(mint);
      if (cached && now - cached.timestamp < CACHE_TTL_MS.prices) {
        results[mint] = cached.data;
      } else {
        tokensToFetch.push(mint);
      }
    });
    
    // Fetch non-cached tokens
    if (tokensToFetch.length > 0) {
      // Fetch in batches of 5 to avoid rate limiting
      const batchSize = 5;
      const batches = [];
      
      for (let i = 0; i < tokensToFetch.length; i += batchSize) {
        batches.push(tokensToFetch.slice(i, i + batchSize));
      }
      
      for (const batch of batches) {
        await Promise.all(
          batch.map(async mint => {
            try {
              const price = await getTokenPrice(mint);
              results[mint] = price;
            } catch (error) {
              logger.error(`[Jupiter] Error fetching price for ${mint} in batch: ${error.message}`);
              results[mint] = null;
            }
          })
        );
        
        // Add a small delay between batches
        if (batches.indexOf(batch) < batches.length - 1) {
          await sleep(500);
        }
      }
    }
    
    return results;
  } catch (error) {
    logger.error(`[Jupiter] Error in multi-price fetch: ${error.message}`);
    
    // Return as many cached prices as possible
    const results: Record<string, number | null> = {};
    
    tokenMints.forEach(mint => {
      const cached = priceCache.get(mint);
      results[mint] = cached ? cached.data : null;
    });
    
    return results;
  }
}

/**
 * Get a swap quote
 */
export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50
): Promise<any> {
  try {
    const now = Date.now();
    const cacheKey = `${inputMint}-${outputMint}-${amount}-${slippageBps}`;
    
    // Check cache
    const cached = quotesCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS.quotes) {
      return cached.data;
    }
    
    // Fetch fresh data
    const url = `${JUPITER_API_BASE_URL}/quote`;
    const params = {
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps
    };
    
    const queryString = new URLSearchParams(params as any).toString();
    const data = await makeRequest<any>(`${url}?${queryString}`);
    
    // Update cache
    quotesCache.set(cacheKey, { data, timestamp: now });
    
    return data;
  } catch (error) {
    logger.error(`[Jupiter] Error getting swap quote: ${error.message}`);
    
    // Return cached quote if available, even if expired
    const cacheKey = `${inputMint}-${outputMint}-${amount}-${slippageBps}`;
    const cached = quotesCache.get(cacheKey);
    
    if (cached) {
      logger.warn('[Jupiter] Returning cached quote due to API error');
      return cached.data;
    }
    
    throw error;
  }
}

/**
 * Create a swap transaction
 */
export async function createSwapTransaction(
  quoteResponse: any,
  userPublicKey: string
): Promise<any> {
  try {
    const url = `${JUPITER_API_BASE_URL}/swap`;
    
    const data = {
      quoteResponse,
      userPublicKey
    };
    
    return await makeRequest<any>(url, 'POST', data);
  } catch (error) {
    logger.error(`[Jupiter] Error creating swap transaction: ${error.message}`);
    throw error;
  }
}

/**
 * Get swap routes
 */
export async function getSwapRoutes(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50
): Promise<any> {
  try {
    const now = Date.now();
    const cacheKey = `${inputMint}-${outputMint}-${amount}-${slippageBps}`;
    
    // Check cache
    const cached = routesCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS.routes) {
      return cached.data;
    }
    
    // Fetch fresh data
    const url = `${JUPITER_API_BASE_URL}/quote`;
    const params = {
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps,
      onlyDirectRoutes: false
    };
    
    const queryString = new URLSearchParams(params as any).toString();
    const data = await makeRequest<any>(`${url}?${queryString}`);
    
    // Update cache
    routesCache.set(cacheKey, { data, timestamp: now });
    
    return data;
  } catch (error) {
    logger.error(`[Jupiter] Error getting swap routes: ${error.message}`);
    
    // Return cached routes if available, even if expired
    const cacheKey = `${inputMint}-${outputMint}-${amount}-${slippageBps}`;
    const cached = routesCache.get(cacheKey);
    
    if (cached) {
      logger.warn('[Jupiter] Returning cached routes due to API error');
      return cached.data;
    }
    
    throw error;
  }
}

/**
 * Get Jupiter markets
 */
export async function getJupiterMarkets(): Promise<any> {
  try {
    const now = Date.now();
    
    // Check cache
    if (marketsCache.data && now - marketsCache.timestamp < CACHE_TTL_MS.markets) {
      return marketsCache.data;
    }
    
    // Fetch fresh data - this is not a real Jupiter API endpoint but a simulation
    // In a real implementation, you'd use the actual API
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC mint
    const solMint = 'So11111111111111111111111111111111111111112';   // SOL mint
    
    // Get tokens
    const tokensResponse = await getJupiterTokens();
    const tokens = tokensResponse.tokens || {};
    
    // Filter for tokens with USDC and SOL pairs
    const pairs: any[] = [];
    const processedTokens = new Set();
    
    // For simplicity, we'll simulate a few pairs
    const popularTokens = [
      solMint,                                      // SOL
      usdcMint,                                     // USDC
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj', // stSOL
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
      '7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx', // GMT
      '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', // SAMO
      'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey',  // MNDE
    ];
    
    for (const tokenMint of popularTokens) {
      if (!processedTokens.has(tokenMint)) {
        processedTokens.add(tokenMint);
        
        // Add USDC pair
        if (tokenMint !== usdcMint) {
          pairs.push({
            id: `${tokenMint}-${usdcMint}`,
            inputMint: tokenMint,
            outputMint: usdcMint,
            inputSymbol: tokens[tokenMint]?.symbol || 'UNKNOWN',
            outputSymbol: 'USDC',
            liquidity: Math.random() * 10000000, // Simulated liquidity
            volume24h: Math.random() * 1000000,  // Simulated volume
          });
        }
        
        // Add SOL pair
        if (tokenMint !== solMint) {
          pairs.push({
            id: `${tokenMint}-${solMint}`,
            inputMint: tokenMint,
            outputMint: solMint,
            inputSymbol: tokens[tokenMint]?.symbol || 'UNKNOWN',
            outputSymbol: 'SOL',
            liquidity: Math.random() * 10000000, // Simulated liquidity
            volume24h: Math.random() * 1000000,  // Simulated volume
          });
        }
      }
    }
    
    const markets = {
      pairs,
      count: pairs.length,
      timestamp: now
    };
    
    // Update cache
    marketsCache.data = markets;
    marketsCache.timestamp = now;
    
    logger.info(`[Jupiter] Generated ${pairs.length} market pairs`);
    return markets;
  } catch (error) {
    logger.error(`[Jupiter] Error getting markets: ${error.message}`);
    
    // Return cached markets if available, even if expired
    if (marketsCache.data) {
      logger.warn('[Jupiter] Returning cached markets due to error');
      return marketsCache.data;
    }
    
    throw error;
  }
}

/**
 * Execute a swap transaction (simulation)
 */
export async function executeSwap(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50,
  walletPublicKey: string
): Promise<any> {
  try {
    // 1. Get a quote
    const quote = await getSwapQuote(inputMint, outputMint, amount, slippageBps);
    
    // 2. Create the transaction
    const swapTx = await createSwapTransaction(quote, walletPublicKey);
    
    // 3. In a real implementation, the transaction would be signed and sent
    // For this simulation, we'll return the prepared transaction
    
    return {
      success: true,
      txid: `SIM_SWAP_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`,
      inputAmount: amount,
      outputAmount: quote.outAmount,
      inputMint,
      outputMint,
      executedAt: new Date().toISOString(),
      route: quote.routePlan || [],
      transaction: swapTx,
      // The following would be the actual execution results in a real implementation
      simulation: {
        success: true,
        estimatedFee: Math.random() * 0.001, // Simulated fee in SOL
        estimatedTime: Math.random() * 500,  // Simulated execution time in ms
      }
    };
  } catch (error) {
    logger.error(`[Jupiter] Error executing swap: ${error.message}`);
    throw error;
  }
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  tokenCache.data = null;
  tokenCache.timestamp = 0;
  
  priceCache.clear();
  quotesCache.clear();
  routesCache.clear();
  
  marketsCache.data = null;
  marketsCache.timestamp = 0;
  
  logger.info('[Jupiter] All caches cleared');
}

// Export service information
export const jupiterServiceInfo = {
  name: 'Jupiter API Manager',
  description: 'Manages Jupiter API interactions with efficient caching',
  status: 'active',
  cacheStatus: {
    getTokenCacheStatus: () => ({
      isCached: !!tokenCache.data,
      lastUpdated: tokenCache.timestamp ? new Date(tokenCache.timestamp).toISOString() : null,
      itemCount: tokenCache.data ? Object.keys(tokenCache.data.tokens || {}).length : 0,
      ttlMs: CACHE_TTL_MS.tokens
    }),
    getPriceCacheStatus: () => ({
      isCached: priceCache.size > 0,
      lastUpdated: priceCache.size > 0 ? new Date(Math.max(...Array.from(priceCache.values()).map(item => item.timestamp))).toISOString() : null,
      itemCount: priceCache.size,
      ttlMs: CACHE_TTL_MS.prices
    }),
    clearCaches: clearAllCaches
  },
  rateLimit: {
    getStatus: () => ({
      requestCount: rateLimiter.requestCount,
      requestsLastMinute: rateLimiter.requestTimestamps.filter(ts => Date.now() - ts < 60000).length,
      maxRequestsPerMinute: rateLimiter.maxRequestsPerMinute
    }),
    resetStats: () => {
      rateLimiter.requestCount = 0;
      rateLimiter.requestTimestamps = [];
    }
  }
};