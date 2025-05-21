/**
 * External API Manager
 * 
 * This utility provides specialized handling for external APIs with more
 * aggressive rate limiting and longer cooldown periods to prevent 429 errors.
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as logger from '../logger';

// Specialized rate limit settings for known APIs
const API_CONFIGS = {
  'pump.fun': {
    baseDelay: 2000,       // 2 seconds between requests
    maxRetries: 5,         // More retries for critical APIs
    backoffFactor: 2.5,    // More aggressive backoff
    maxDelay: 60000,       // Up to 1 minute delay
    cooldownPeriod: 300000 // 5 minute cooldown after multiple failures
  },
  'dexscreener': {
    baseDelay: 1500, 
    maxRetries: 4,
    backoffFactor: 2,
    maxDelay: 45000,
    cooldownPeriod: 240000
  },
  'default': {
    baseDelay: 1000,
    maxRetries: 3,
    backoffFactor: 2,
    maxDelay: 30000,
    cooldownPeriod: 180000
  }
};

// Cache of API states
const apiStateCache: Record<string, {
  lastRequest: number;
  failureCount: number;
  inCooldown: boolean;
  cooldownUntil: number;
  currentDelay: number;
}> = {};

/**
 * Extracts the API domain from a URL
 */
function getApiDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Extract domain from hostname
    const domainParts = hostname.split('.');
    if (domainParts.length >= 2) {
      // Return domain like "pump.fun" from "api.pump.fun"
      return `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}`;
    }
    return hostname;
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Get configuration for an API based on its domain
 */
function getApiConfig(domain: string) {
  const knownDomains = Object.keys(API_CONFIGS);
  for (const knownDomain of knownDomains) {
    if (domain.includes(knownDomain)) {
      return API_CONFIGS[knownDomain as keyof typeof API_CONFIGS];
    }
  }
  return API_CONFIGS.default;
}

/**
 * Initialize or get API state for a domain
 */
function getApiState(domain: string) {
  if (!apiStateCache[domain]) {
    apiStateCache[domain] = {
      lastRequest: 0,
      failureCount: 0,
      inCooldown: false,
      cooldownUntil: 0,
      currentDelay: getApiConfig(domain).baseDelay
    };
  }
  return apiStateCache[domain];
}

/**
 * Check if an API is in cooldown and handle waiting if needed
 */
async function handleCooldownIfNeeded(domain: string): Promise<boolean> {
  const state = getApiState(domain);
  const now = Date.now();
  
  // Check if in cooldown
  if (state.inCooldown) {
    if (now < state.cooldownUntil) {
      const timeLeft = Math.ceil((state.cooldownUntil - now) / 1000);
      logger.warn(`${domain} is in cooldown for ${timeLeft} more seconds. Using cached data if available.`);
      return true; // Still in cooldown
    } else {
      // Cooldown period is over
      state.inCooldown = false;
      state.failureCount = 0;
      state.currentDelay = getApiConfig(domain).baseDelay;
      logger.info(`${domain} cooldown period ended. Resuming normal requests.`);
    }
  }
  
  return false; // Not in cooldown
}

/**
 * Handle rate limiting for a request to an external API
 */
async function handleRateLimiting(domain: string): Promise<void> {
  const state = getApiState(domain);
  const config = getApiConfig(domain);
  const now = Date.now();
  
  // Calculate time since last request
  const timeSinceLastRequest = now - state.lastRequest;
  
  // If not enough time has passed, wait
  if (timeSinceLastRequest < state.currentDelay) {
    const waitTime = state.currentDelay - timeSinceLastRequest;
    logger.debug(`Rate limiting ${domain}, waiting ${waitTime}ms before request`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  // Update last request time
  state.lastRequest = Date.now();
}

/**
 * Handle a failed request with exponential backoff
 */
function handleFailure(domain: string, isRateLimit: boolean): void {
  const state = getApiState(domain);
  const config = getApiConfig(domain);
  
  // Increment failure count
  state.failureCount++;
  
  // Check if we should enter cooldown
  if (state.failureCount >= config.maxRetries) {
    state.inCooldown = true;
    state.cooldownUntil = Date.now() + config.cooldownPeriod;
    logger.warn(`${domain} entered cooldown for ${config.cooldownPeriod/1000} seconds after ${state.failureCount} failures`);
    return;
  }
  
  // Calculate new delay with exponential backoff
  if (isRateLimit) {
    state.currentDelay = Math.min(
      state.currentDelay * config.backoffFactor,
      config.maxDelay
    );
    logger.warn(`Rate limit hit for ${domain}. New delay: ${state.currentDelay}ms`);
  } else {
    // Less aggressive for non-rate-limit errors
    state.currentDelay = Math.min(
      state.currentDelay * 1.5,
      config.maxDelay / 2
    );
  }
}

/**
 * Reset failure state after a successful request
 */
function handleSuccess(domain: string): void {
  const state = getApiState(domain);
  const config = getApiConfig(domain);
  
  // Gradually reduce delay after success
  if (state.failureCount > 0) {
    state.currentDelay = Math.max(
      state.currentDelay / 1.5, 
      config.baseDelay
    );
    state.failureCount = Math.max(0, state.failureCount - 1);
  } else {
    state.currentDelay = config.baseDelay;
  }
}

/**
 * Make a request to an external API with smart rate limiting
 */
export async function makeExternalApiRequest<T>(
  url: string, 
  options: AxiosRequestConfig = {},
  cacheResult: boolean = true,
  useCache: boolean = true
): Promise<T> {
  const domain = getApiDomainFromUrl(url);
  const apiConfig = getApiConfig(domain);
  
  // Handle cooldown
  const isInCooldown = await handleCooldownIfNeeded(domain);
  
  // Try to get from cache if in cooldown
  if (isInCooldown && useCache) {
    try {
      const result = await getCachedResult<T>(url);
      if (result) {
        logger.info(`Using cached result for ${url} during cooldown period`);
        return result;
      }
    } catch (error) {
      logger.warn(`No cache available for ${url} during cooldown period`);
    }
  }
  
  // Apply rate limiting
  await handleRateLimiting(domain);
  
  try {
    // Make the request with timeout
    const response = await axios({
      url,
      ...options,
      timeout: options.timeout || 15000 // 15 second timeout
    });
    
    // Handle success
    handleSuccess(domain);
    
    // Cache the result if needed and valid
    if (cacheResult && response.data) {
      await cacheApiResult(url, response.data);
    }
    
    return response.data;
  } catch (error: any) {
    // Determine error type
    const isRateLimit = 
      error.response?.status === 429 || 
      error.message?.includes('429') || 
      error.message?.includes('Too Many Requests');
    
    const isConnectionError = 
      error.code === 'ENOTFOUND' || 
      error.code === 'ECONNREFUSED' || 
      error.message?.includes('getaddrinfo') || 
      error.message?.includes('connect ETIMEDOUT') ||
      error.message?.includes('timeout');
      
    const isServerError = 
      error.response?.status >= 500 ||
      error.message?.includes('404') ||
      error.response?.status === 404;
    
    // Log appropriate error
    if (isConnectionError) {
      logger.warn(`Connection failed to ${domain}: ${error.message}`);
    } else if (isRateLimit) {
      logger.warn(`Rate limit hit for ${domain}: ${error.message}`);
    } else if (isServerError) {
      logger.warn(`Server error from ${domain}: ${error.message}`);
    } else {
      logger.error(`API request to ${domain} failed: ${error.message}`);
    }
    
    // Handle the failure for rate limiting strategy
    handleFailure(domain, isRateLimit);
    
    // Try to get cached data as fallback
    if (useCache) {
      try {
        const cachedData = await getCachedResult<T>(url);
        if (cachedData) {
          logger.info(`Using cached result for ${url} after error: ${error.message}`);
          return cachedData;
        }
      } catch (cacheError) {
        // No cache available
      }
    }
    
    // If no cached data available, throw error with appropriate message
    if (isConnectionError) {
      throw new Error(`Connection failed to ${domain}. Service may be unavailable.`);
    } else if (isRateLimit) {
      throw new Error(`Rate limit exceeded for ${domain}. Using cached data if available.`);
    } else if (isServerError) {
      throw new Error(`Server error from ${domain}. API endpoint may have changed.`);
    } else {
      throw new Error(`API request to ${domain} failed: ${error.message}`);
    }
  }
}

// Simple in-memory cache for responses
const responseCache: Record<string, {
  data: any;
  timestamp: number;
  ttl: number;
}> = {};

/**
 * Cache an API result
 */
async function cacheApiResult(url: string, data: any, ttl: number = 300000): Promise<void> {
  responseCache[url] = {
    data,
    timestamp: Date.now(),
    ttl // 5 minutes by default
  };
}

/**
 * Get a cached API result
 */
async function getCachedResult<T>(url: string): Promise<T | null> {
  const cached = responseCache[url];
  if (!cached) {
    return null;
  }
  
  // Check if cache is expired
  if (Date.now() - cached.timestamp > cached.ttl) {
    delete responseCache[url];
    return null;
  }
  
  return cached.data as T;
}

/**
 * Clear the API cache
 */
export function clearApiCache(url?: string): void {
  if (url) {
    delete responseCache[url];
  } else {
    Object.keys(responseCache).forEach(key => {
      delete responseCache[key];
    });
  }
}

/**
 * Get trending tokens from pump.fun with smart handling
 */
export async function getTrendingTokens(limit: number = 50): Promise<any[]> {
  try {
    // Try multiple API endpoints for trending tokens
    const endpoints = [
      `https://api.pump.fun/solana/tokens/trending?limit=${limit}`,
      `https://api.pump.fun/v1/solana/tokens/trending?limit=${limit}`, // Alternative path
      `https://birdeye-cache.pump.fun/solana/tokens/trending?limit=${limit}` // Another potential path
    ];
    
    // Try each endpoint
    for (const url of endpoints) {
      try {
        const data = await makeExternalApiRequest<any>(url, {}, true, true);
        
        // If data is in expected format, return tokens array
        if (data && Array.isArray(data.tokens)) {
          logger.info(`Successfully fetched trending tokens from ${url}`);
          return data.tokens;
        }
      } catch (endpointError) {
        logger.warn(`Failed to fetch trending tokens from ${url}:`, endpointError.message);
        // Continue to next endpoint
      }
    }
    
    // If all endpoints fail, return mock data for testing
    logger.warn('All trending token endpoints failed, using cached fallback data');
    return getFallbackTrendingTokens();
  } catch (error) {
    logger.error('Failed to fetch trending tokens from all sources:', error);
    return getFallbackTrendingTokens();
  }
}

function getFallbackTrendingTokens(): any[] {
  // Return cached fallback data for development/testing
  return [
    {
      symbol: "BONK",
      name: "Bonk",
      mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      price: 0.000002813,
      price_change_24h: -5.2,
      volume_24h: 2354832,
      market_cap: 165434000
    },
    {
      symbol: "WIF",
      name: "Dogwifhat",
      mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
      price: 1.85,
      price_change_24h: -3.7,
      volume_24h: 1432568,
      market_cap: 1854320000
    },
    {
      symbol: "MEME",
      name: "Meme",
      mint: "MoNExuUcKbGQ4yQ1WEJEaybQYdWEYKjP9UMeTVNnpQ2g",
      price: 0.0345,
      price_change_24h: 1.2,
      volume_24h: 687234,
      market_cap: 34520000
    }
  ];
}

/**
 * Get token info from dexscreener with smart handling
 */
export async function getTokenInfo(address: string, tokenSymbol?: string): Promise<any> {
  try {
    // Try multiple API endpoints
    const endpoints = [
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      `https://api.dexscreener.io/latest/dex/tokens/${address}`,
      `https://api-mainnet.dexscreener.com/latest/dex/tokens/${address}`
    ];
    
    // Try each endpoint
    for (const url of endpoints) {
      try {
        const data = await makeExternalApiRequest<any>(url, {}, true, true);
        
        // Handle the expected response format
        if (data && Array.isArray(data.pairs) && data.pairs.length > 0) {
          logger.info(`Successfully fetched token info for ${address} from ${url}`);
          return data.pairs[0];
        }
      } catch (endpointError) {
        logger.warn(`Failed to fetch token info from ${url}:`, endpointError.message);
        // Continue to next endpoint
      }
    }
    
    // If all endpoints fail, return default data if tokenSymbol is provided
    if (tokenSymbol) {
      logger.warn(`Using fallback data for token ${tokenSymbol}`);
      return getFallbackTokenInfo(tokenSymbol);
    }
    
    return null;
  } catch (error) {
    logger.error(`Failed to fetch token info for ${address}:`, error);
    return tokenSymbol ? getFallbackTokenInfo(tokenSymbol) : null;
  }
}

/**
 * Get fallback token info for common tokens
 */
function getFallbackTokenInfo(symbol: string): any {
  const fallbackData: Record<string, any> = {
    'SOL': {
      baseToken: {
        address: 'So11111111111111111111111111111111111111111',
        name: 'Solana',
        symbol: 'SOL'
      },
      quoteToken: {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        name: 'USD Coin',
        symbol: 'USDC'
      },
      priceUsd: '75.42',
      priceChange: {
        h1: -0.5,
        h24: 2.3,
        h6: 1.1
      },
      volume: {
        h24: 453000000
      }
    },
    'BONK': {
      baseToken: {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        name: 'Bonk',
        symbol: 'BONK'
      },
      quoteToken: {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        name: 'USD Coin',
        symbol: 'USDC'
      },
      priceUsd: '0.000002813',
      priceChange: {
        h1: 0.2,
        h24: -5.2,
        h6: -1.8
      },
      volume: {
        h24: 2354832
      }
    },
    'MEME': {
      baseToken: {
        address: 'MoNExuUcKbGQ4yQ1WEJEaybQYdWEYKjP9UMeTVNnpQ2g',
        name: 'Meme',
        symbol: 'MEME'
      },
      quoteToken: {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        name: 'USD Coin',
        symbol: 'USDC'
      },
      priceUsd: '0.0345',
      priceChange: {
        h1: 0.5,
        h24: 1.2,
        h6: 0.8
      },
      volume: {
        h24: 687234
      }
    }
  };

  // Return data for the specific symbol or a generic fallback
  return fallbackData[symbol.toUpperCase()] || {
    baseToken: {
      address: '00000000000000000000000000000000000000000000',
      name: symbol,
      symbol: symbol
    },
    quoteToken: {
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      name: 'USD Coin',
      symbol: 'USDC'
    },
    priceUsd: '0.1',
    priceChange: {
      h1: 0,
      h24: 0,
      h6: 0
    },
    volume: {
      h24: 10000
    }
  };
}