/**
 * Meme Token API Connector
 * 
 * This module provides specialized connections to external meme token APIs
 * with proper rate limiting, correct endpoints, and real-time data streams
 * where available.
 */

import * as logger from '../logger';
import { makeExternalApiRequest } from './externalApiManager';
import { memecoinCache, TokenRelationship } from './memecoinGlobalCache';
import { MemeToken } from './memeTokenScanner';
import axios from 'axios';
import WebSocket from 'ws';

// Rate limit settings for each API
const API_LIMITS = {
  pumpFun: {
    requestsPerMinute: 20,
    requestsPerHour: 500,
    cooldownAfterFailures: 5,
    cooldownTimeMs: 5 * 60 * 1000, // 5 minutes
  },
  dexScreener: {
    requestsPerMinute: 30,
    requestsPerHour: 1000,
    cooldownAfterFailures: 3,
    cooldownTimeMs: 2 * 60 * 1000, // 2 minutes
  },
  birdeye: {
    requestsPerMinute: 40,
    requestsPerHour: 1200,
    cooldownAfterFailures: 3,
    cooldownTimeMs: 3 * 60 * 1000, // 3 minutes
  },
  gmgn: {
    requestsPerMinute: 30,
    requestsPerHour: 800,
    cooldownAfterFailures: 3,
    cooldownTimeMs: 2 * 60 * 1000, // 2 minutes
  }
};

// Connection state tracking
const API_STATE = {
  pumpFun: {
    requests: {
      lastMinute: 0,
      lastHour: 0,
      minuteStart: Date.now(),
      hourStart: Date.now()
    },
    failures: 0,
    inCooldown: false,
    cooldownUntil: 0,
    wsConnected: false
  },
  dexScreener: {
    requests: {
      lastMinute: 0,
      lastHour: 0,
      minuteStart: Date.now(),
      hourStart: Date.now()
    },
    failures: 0,
    inCooldown: false,
    cooldownUntil: 0,
    wsConnected: false
  },
  birdeye: {
    requests: {
      lastMinute: 0,
      lastHour: 0,
      minuteStart: Date.now(),
      hourStart: Date.now()
    },
    failures: 0,
    inCooldown: false,
    cooldownUntil: 0,
    wsConnected: false
  },
  gmgn: {
    requests: {
      lastMinute: 0,
      lastHour: 0,
      minuteStart: Date.now(),
      hourStart: Date.now()
    },
    failures: 0,
    inCooldown: false,
    cooldownUntil: 0,
    wsConnected: false
  }
};

// WebSocket connections
let pumpFunWs: WebSocket | null = null;
let dexScreenerWs: WebSocket | null = null;

/**
 * Check and update rate limits before making a request
 */
function checkRateLimits(api: 'pumpFun' | 'dexScreener' | 'birdeye' | 'gmgn'): boolean {
  const now = Date.now();
  const state = API_STATE[api];
  const limits = API_LIMITS[api];
  
  // Check if in cooldown
  if (state.inCooldown) {
    if (now < state.cooldownUntil) {
      logger.info(`${api} is in cooldown for ${Math.ceil((state.cooldownUntil - now) / 1000)} more seconds. Using cached data if available.`);
      return false;
    } else {
      // Reset cooldown
      state.inCooldown = false;
      state.failures = 0;
    }
  }
  
  // Reset counters if needed
  if (now - state.requests.minuteStart > 60000) {
    state.requests.lastMinute = 0;
    state.requests.minuteStart = now;
  }
  
  if (now - state.requests.hourStart > 3600000) {
    state.requests.lastHour = 0;
    state.requests.hourStart = now;
  }
  
  // Check limits
  if (state.requests.lastMinute >= limits.requestsPerMinute) {
    logger.info(`${api} rate limit reached for this minute. Using cached data.`);
    return false;
  }
  
  if (state.requests.lastHour >= limits.requestsPerHour) {
    logger.info(`${api} rate limit reached for this hour. Using cached data.`);
    return false;
  }
  
  // Increment counters
  state.requests.lastMinute++;
  state.requests.lastHour++;
  
  return true;
}

/**
 * Handle API failure and potentially trigger cooldown
 */
function handleApiFailure(api: 'pumpFun' | 'dexScreener' | 'birdeye' | 'gmgn', error?: any): void {
  const state = API_STATE[api];
  const limits = API_LIMITS[api];
  
  state.failures++;
  
  if (state.failures >= limits.cooldownAfterFailures) {
    state.inCooldown = true;
    state.cooldownUntil = Date.now() + limits.cooldownTimeMs;
    logger.warn(`${api} entered cooldown for ${limits.cooldownTimeMs / 1000} seconds after ${state.failures} failures`);
  }
  
  if (error) {
    logger.error(`${api} API error: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Initialize WebSocket connections for real-time data
 */
export function initializeWebSockets(): void {
  try {
    // Initialize Pump.fun WebSocket if not already connected
    if (!API_STATE.pumpFun.wsConnected && process.env.USE_WEBSOCKETS === 'true') {
      logger.info('Initializing PumpFun WebSocket connection...');
      
      // Pump.fun doesn't have a public WebSocket API yet
      logger.info('PumpFun WebSocket not available, using polling instead');
    }
    
    // Initialize DexScreener WebSocket if not already connected
    if (!API_STATE.dexScreener.wsConnected && process.env.USE_WEBSOCKETS === 'true') {
      logger.info('Initializing DexScreener WebSocket connection...');
      
      // Connect to DexScreener WebSocket
      dexScreenerWs = new WebSocket('wss://io.dexscreener.com/dex/screener/pairs');
      
      dexScreenerWs.on('open', () => {
        logger.info('DexScreener WebSocket connected');
        API_STATE.dexScreener.wsConnected = true;
        
        // Subscribe to Solana pairs
        const subscribeMsg = {
          action: 'subscribe',
          channel: 'pairs',
          filters: {
            chain: 'solana'
          }
        };
        
        dexScreenerWs.send(JSON.stringify(subscribeMsg));
      });
      
      dexScreenerWs.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'pair' && message.data) {
            // Process pair data
            const pairData = message.data;
            
            // Convert to MemeToken format for cache
            const token: MemeToken = {
              symbol: pairData.baseToken.symbol,
              name: pairData.baseToken.name,
              address: pairData.baseToken.address,
              price: parseFloat(pairData.priceUsd) || 0,
              priceChange24h: parseFloat(pairData.priceChange.h24) || 0,
              priceChange1h: parseFloat(pairData.priceChange.h1) || 0,
              volume24h: parseFloat(pairData.volume.h24) || 0,
              liquidity: parseFloat(pairData.liquidity.usd) / 75, // Approximate SOL value
              source: 'dexscreener'
            };
            
            // Update global cache
            memecoinCache.updateFromSource([token], 'dexscreener');
          }
        } catch (error) {
          logger.error(`Error processing DexScreener WebSocket message: ${error.message}`);
        }
      });
      
      dexScreenerWs.on('error', (error) => {
        logger.error(`DexScreener WebSocket error: ${error.message}`);
        API_STATE.dexScreener.wsConnected = false;
      });
      
      dexScreenerWs.on('close', () => {
        logger.info('DexScreener WebSocket closed');
        API_STATE.dexScreener.wsConnected = false;
        
        // Try to reconnect after a delay
        setTimeout(() => {
          if (!API_STATE.dexScreener.wsConnected) {
            initializeWebSockets();
          }
        }, 30000);
      });
    }
  } catch (error) {
    logger.error(`Error initializing WebSockets: ${error.message}`);
  }
}

/**
 * Fetch tokens from Pump.fun
 * Latest API documentation indicates they've moved to a v2 endpoint structure
 */
export async function fetchPumpFunTokens(): Promise<MemeToken[]> {
  if (!checkRateLimits('pumpFun')) {
    const cachedTokens = memecoinCache.getAllTokens()
      .filter(token => token.sources.pumpFun)
      .map(token => convertToMemeToken(token, 'pumpFun'));
    
    return cachedTokens.length > 0 ? cachedTokens : [];
  }
  
  try {
    // First try the v2 API endpoints
    const endpoints = [
      'https://api.pump.fun/v2/solana/tokens/trending?limit=50',
      'https://pump.fun/api/v2/tokens/trending?limit=50',
      'https://api.stats.pump.fun/solana/tokens/trending?limit=50'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await makeExternalApiRequest<any>(endpoint, {}, true, true);
        
        if (response && Array.isArray(response.tokens || response.data)) {
          const tokens = (response.tokens || response.data).map((token: any) => ({
            symbol: token.symbol,
            name: token.name,
            address: token.mint || token.address,
            price: parseFloat(token.price) || 0,
            priceChange24h: token.price_change_24h || 0,
            volume24h: token.volume_24h || 0,
            marketCap: token.market_cap || 0,
            liquidity: token.liquidity_sol || 0,
            launchDate: token.launch_date,
            launchTimestamp: token.launch_timestamp,
            isNew: token.is_new || false,
            score: calculatePumpFunScore(token),
            source: 'pumpFun'
          }));
          
          // Update global cache
          memecoinCache.updateFromSource(tokens, 'pumpFun');
          
          logger.info(`Successfully fetched ${tokens.length} tokens from PumpFun`);
          return tokens;
        }
      } catch (error) {
        logger.warn(`Failed to fetch trending tokens from ${endpoint}: ${error.message}`);
        // Try next endpoint
      }
    }
    
    // If all endpoints fail, trigger failure handling
    handleApiFailure('pumpFun', new Error('All PumpFun endpoints failed'));
    
    // Return cached data if available
    const cachedTokens = memecoinCache.getAllTokens()
      .filter(token => token.sources.pumpFun)
      .map(token => convertToMemeToken(token, 'pumpFun'));
    
    logger.warn(`All trending token endpoints failed, using cached fallback data`);
    return cachedTokens.length > 0 ? cachedTokens : [];
  } catch (error) {
    handleApiFailure('pumpFun', error);
    
    // Return cached data if available
    const cachedTokens = memecoinCache.getAllTokens()
      .filter(token => token.sources.pumpFun)
      .map(token => convertToMemeToken(token, 'pumpFun'));
    
    return cachedTokens.length > 0 ? cachedTokens : [];
  }
}

/**
 * Fetch tokens from DexScreener
 * Using their latest API structure and endpoints from documentation
 */
export async function fetchDexScreenerTokens(): Promise<MemeToken[]> {
  if (!checkRateLimits('dexScreener')) {
    const cachedTokens = memecoinCache.getAllTokens()
      .filter(token => token.sources.dexScreener)
      .map(token => convertToMemeToken(token, 'dexScreener'));
    
    return cachedTokens.length > 0 ? cachedTokens : [];
  }
  
  try {
    // Pre-defined addresses of popular tokens to check
    const tokenAddresses = [
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
      'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
      'MoNExuUcKbGQ4yQ1WEJEaybQYdWEYKjP9UMeTVNnpQ2g', // MEME
      'H6QSvF5q8HA9jHmYnD7Z3Ah4gwZLN4YtNz3wAkNmzgj7', // POPCAT
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // BONES
      'DzNEFgDQxhYgHpZM9iQMg9zCpe5sLJLhFJGGv9Li1vBS', // SLERF
      'EpwxbiwsRCBVpyirWzxbzMEQNrT94Soy4YAZgYVGYHAK', // BODEN
      'DMGCCNydXCMMUFzH7CJYhmTAXKpJg6RQRwUgynJoxqwh'  // PONKE
    ];
    
    // Try different endpoints
    const endpoints = [
      'https://api.dexscreener.com/latest/dex/tokens/',
      'https://api.dexscreener.io/latest/dex/tokens/'
    ];
    
    // Make a single request with a comma-separated list of addresses
    const addressList = tokenAddresses.join(',');
    
    for (const baseEndpoint of endpoints) {
      try {
        const url = `${baseEndpoint}${addressList}`;
        const response = await makeExternalApiRequest<any>(url, {}, true, true);
        
        if (response && Array.isArray(response.pairs)) {
          const tokens: MemeToken[] = [];
          const tokenMap = new Map<string, MemeToken>();
          
          // Process pairs into tokens
          for (const pair of response.pairs) {
            // Skip non-Solana pairs
            if (pair.chainId !== 'solana') continue;
            
            // Create token object
            const token: MemeToken = {
              symbol: pair.baseToken.symbol,
              name: pair.baseToken.name,
              address: pair.baseToken.address,
              price: parseFloat(pair.priceUsd) || 0,
              priceChange24h: parseFloat(pair.priceChange.h24) || 0,
              priceChange1h: parseFloat(pair.priceChange.h1) || 0,
              volume24h: parseFloat(pair.volume.h24) || 0,
              liquidity: parseFloat(pair.liquidity.usd) / 75, // Approximate SOL value
              score: calculateDexScreenerScore(pair),
              source: 'dexScreener'
            };
            
            // Add to tokens list if better data than existing
            if (!tokenMap.has(token.address) || pair.liquidity?.usd > 10000) {
              tokenMap.set(token.address, token);
            }
          }
          
          // Convert map to array
          Array.from(tokenMap.values()).forEach(token => tokens.push(token));
          
          // Update global cache
          memecoinCache.updateFromSource(tokens, 'dexScreener');
          
          logger.info(`Successfully fetched ${tokens.length} tokens from DexScreener`);
          return tokens;
        }
      } catch (error) {
        logger.warn(`Failed to fetch from endpoint ${baseEndpoint}: ${error.message}`);
        // Continue to next endpoint
      }
    }
    
    // Now try the trending pairs endpoint for more tokens
    try {
      const trendingUrl = 'https://api.dexscreener.com/latest/dex/pairs/solana';
      const response = await makeExternalApiRequest<any>(trendingUrl, {}, true, true);
      
      if (response && Array.isArray(response.pairs)) {
        const tokens: MemeToken[] = [];
        const tokenMap = new Map<string, MemeToken>();
        
        // Process pairs into tokens
        for (const pair of response.pairs) {
          // Create token object
          const token: MemeToken = {
            symbol: pair.baseToken.symbol,
            name: pair.baseToken.name,
            address: pair.baseToken.address,
            price: parseFloat(pair.priceUsd) || 0,
            priceChange24h: parseFloat(pair.priceChange.h24) || 0,
            priceChange1h: parseFloat(pair.priceChange.h1) || 0,
            volume24h: parseFloat(pair.volume.h24) || 0,
            liquidity: parseFloat(pair.liquidity.usd) / 75, // Approximate SOL value
            score: calculateDexScreenerScore(pair),
            source: 'dexScreener'
          };
          
          // Add to tokens list if not duplicate
          if (!tokenMap.has(token.address)) {
            tokenMap.set(token.address, token);
          }
        }
        
        // Convert map to array
        Array.from(tokenMap.values()).forEach(token => tokens.push(token));
        
        // Update global cache
        memecoinCache.updateFromSource(tokens, 'dexScreener');
        
        logger.info(`Successfully fetched ${tokens.length} tokens from DexScreener trending pairs`);
        return tokens;
      }
    } catch (error) {
      logger.warn(`Failed to fetch trending pairs: ${error.message}`);
    }
    
    // If all endpoints fail, trigger failure handling
    handleApiFailure('dexScreener', new Error('All DexScreener endpoints failed'));
    
    // Return cached data if available
    const cachedTokens = memecoinCache.getAllTokens()
      .filter(token => token.sources.dexScreener)
      .map(token => convertToMemeToken(token, 'dexScreener'));
    
    return cachedTokens.length > 0 ? cachedTokens : [];
  } catch (error) {
    handleApiFailure('dexScreener', error);
    
    // Return cached data if available
    const cachedTokens = memecoinCache.getAllTokens()
      .filter(token => token.sources.dexScreener)
      .map(token => convertToMemeToken(token, 'dexScreener'));
    
    return cachedTokens.length > 0 ? cachedTokens : [];
  }
}

/**
 * Fetch tokens from Birdeye
 * Requires an API key for proper access
 */
export async function fetchBirdeyeTokens(): Promise<MemeToken[]> {
  // Check if API key is available 
  if (!process.env.BIRDEYE_API_KEY) {
    logger.warn('Birdeye API key not available, please add BIRDEYE_API_KEY to your environment variables');
    
    // Return cached data if available
    const cachedTokens = memecoinCache.getAllTokens()
      .filter(token => token.sources.birdeye)
      .map(token => convertToMemeToken(token, 'birdeye'));
    
    return cachedTokens.length > 0 ? cachedTokens : [];
  }
  
  if (!checkRateLimits('birdeye')) {
    const cachedTokens = memecoinCache.getAllTokens()
      .filter(token => token.sources.birdeye)
      .map(token => convertToMemeToken(token, 'birdeye'));
    
    return cachedTokens.length > 0 ? cachedTokens : [];
  }
  
  try {
    // Try both trending and top token endpoints
    const endpoints = [
      'https://public-api.birdeye.so/defi/trending_tokens?chain=solana',
      'https://public-api.birdeye.so/defi/top_tokens?chain=solana'
    ];
    
    const allTokens: MemeToken[] = [];
    const tokenMap = new Map<string, MemeToken>();
    
    for (const endpoint of endpoints) {
      try {
        const response = await makeExternalApiRequest<any>(
          endpoint,
          {
            headers: {
              'X-API-KEY': process.env.BIRDEYE_API_KEY
            }
          },
          true,
          true
        );
        
        if (response && Array.isArray(response.data)) {
          response.data.forEach((token: any) => {
            const memeToken: MemeToken = {
              symbol: token.symbol,
              name: token.name,
              address: token.address,
              price: token.price || 0,
              priceChange24h: token.priceChange24h || 0,
              volume24h: token.volume24h || 0,
              marketCap: token.marketCap || 0,
              liquidity: token.liquidity || 0,
              holders: token.holders,
              totalSupply: token.supply,
              score: calculateBirdeyeScore(token),
              source: 'birdeye'
            };
            
            // Add to token map if not exists or has better data
            if (!tokenMap.has(memeToken.address)) {
              tokenMap.set(memeToken.address, memeToken);
              allTokens.push(memeToken);
            }
          });
        }
      } catch (error) {
        logger.warn(`Failed to fetch from Birdeye endpoint ${endpoint}: ${error.message}`);
      }
    }
    
    if (allTokens.length > 0) {
      // Update global cache
      memecoinCache.updateFromSource(allTokens, 'birdeye');
      logger.info(`Successfully fetched ${allTokens.length} tokens from Birdeye`);
      return allTokens;
    }
    
    // If all endpoints fail, trigger failure handling
    handleApiFailure('birdeye', new Error('All Birdeye endpoints failed'));
    
    // Return cached data if available
    const cachedTokens = memecoinCache.getAllTokens()
      .filter(token => token.sources.birdeye)
      .map(token => convertToMemeToken(token, 'birdeye'));
    
    return cachedTokens.length > 0 ? cachedTokens : [];
  } catch (error) {
    handleApiFailure('birdeye', error);
    
    // Return cached data if available
    const cachedTokens = memecoinCache.getAllTokens()
      .filter(token => token.sources.birdeye)
      .map(token => convertToMemeToken(token, 'birdeye'));
    
    return cachedTokens.length > 0 ? cachedTokens : [];
  }
}

/**
 * Convert TokenRelationship to MemeToken
 */
function convertToMemeToken(token: TokenRelationship, source: string): MemeToken {
  return {
    symbol: token.symbol,
    name: token.name,
    address: token.address,
    price: token.price,
    priceChange24h: token.priceChange24h,
    priceChange1h: token.priceChange1h,
    volume24h: token.volume24h,
    marketCap: token.marketCap,
    liquidity: token.liquidity,
    launchDate: token.launchDate,
    launchTimestamp: token.launchTimestamp,
    isNew: token.isNew,
    score: token.score,
    source
  };
}

/**
 * Calculate score for Pump.fun tokens
 */
function calculatePumpFunScore(token: any): number {
  let score = 0;
  
  // Price change component
  const priceChangeScore = token.price_change_24h ? Math.min(token.price_change_24h * 0.4, 40) : 0;
  
  // Volume component (normalized)
  const volumeScore = token.volume_24h ? Math.min(token.volume_24h / 10000, 30) : 0;
  
  // Liquidity component
  const liquidityScore = token.liquidity_sol ? Math.min(token.liquidity_sol / 10, 20) : 0;
  
  // Newness bonus (if launched in the last 24 hours)
  const newnessBonus = token.is_new ? 10 : 0;
  
  // Sum all components
  score = priceChangeScore + volumeScore + liquidityScore + newnessBonus;
  
  return Math.max(0, Math.min(score, 100));
}

/**
 * Calculate score for DexScreener pairs
 */
function calculateDexScreenerScore(pair: any): number {
  let score = 0;
  
  // Price change component
  const priceChange = parseFloat(pair.priceChange?.h24) || 0;
  const priceChangeScore = Math.min(priceChange * 0.4, 40);
  
  // Volume component (normalized)
  const volume = parseFloat(pair.volume?.h24) || 0;
  const volumeScore = Math.min(volume / 10000, 30);
  
  // Liquidity component
  const liquidityUsd = parseFloat(pair.liquidity?.usd) || 0;
  const liquidityScore = Math.min(liquidityUsd / 25000, 20);
  
  // Age bonus (inverse, newer is better)
  const pairCreated = pair.pairCreatedAt ? new Date(pair.pairCreatedAt).getTime() : 0;
  const ageInHours = pairCreated ? (Date.now() - pairCreated) / (60 * 60 * 1000) : 0;
  const ageScore = ageInHours < 24 ? 10 : ageInHours < 48 ? 5 : 0;
  
  // Sum all components
  score = priceChangeScore + volumeScore + liquidityScore + ageScore;
  
  return Math.max(0, Math.min(score, 100));
}

/**
 * Calculate score for Birdeye tokens
 */
function calculateBirdeyeScore(token: any): number {
  let score = 0;
  
  // Price change component
  const priceChangeScore = token.priceChange24h ? Math.min(token.priceChange24h * 0.4, 40) : 0;
  
  // Volume component (normalized)
  const volumeScore = token.volume24h ? Math.min(token.volume24h / 10000, 30) : 0;
  
  // Liquidity and market cap component
  const liquidityScore = token.liquidity ? Math.min(token.liquidity / 10000, 15) : 0;
  const marketCapScore = token.marketCap ? Math.min(token.marketCap / 1000000, 15) : 0;
  
  // Sum all components
  score = priceChangeScore + volumeScore + liquidityScore + marketCapScore;
  
  return Math.max(0, Math.min(score, 100));
}

/**
 * Get all tokens from cache and latest API data
 */
export async function getAllTokens(): Promise<TokenRelationship[]> {
  try {
    // Fetch fresh data from all APIs in parallel
    await Promise.all([
      fetchPumpFunTokens(),
      fetchDexScreenerTokens(),
      fetchBirdeyeTokens()
    ]);
    
    // Update curated lists
    memecoinCache.updateTopTokens();
    memecoinCache.updateNewTokens();
    memecoinCache.updateTrendingTokens();
    
    // Return all tokens from the global cache
    return memecoinCache.getAllTokens();
  } catch (error) {
    logger.error(`Error fetching all tokens: ${error.message}`);
    return memecoinCache.getAllTokens();
  }
}

/**
 * Get sniper opportunities
 */
export async function getSniperOpportunities(): Promise<TokenRelationship[]> {
  try {
    // Make sure we have fresh data
    await getAllTokens();
    
    // Get sniper opportunities from cache
    return memecoinCache.getSniperOpportunities();
  } catch (error) {
    logger.error(`Error getting sniper opportunities: ${error.message}`);
    return memecoinCache.getSniperOpportunities();
  }
}

/**
 * Initialize the connector
 */
export async function initialize(): Promise<void> {
  try {
    logger.info('Initializing Meme Token Connector...');
    
    // Initialize WebSockets if enabled
    if (process.env.USE_WEBSOCKETS === 'true') {
      initializeWebSockets();
    }
    
    // Pre-fetch token data
    await getAllTokens();
    
    logger.info('Meme Token Connector initialized successfully');
  } catch (error) {
    logger.error(`Error initializing Meme Token Connector: ${error.message}`);
  }
}