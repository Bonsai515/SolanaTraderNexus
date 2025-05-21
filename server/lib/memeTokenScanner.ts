/**
 * Meme Token Scanner
 * 
 * This module provides enhanced scanning capabilities for meme tokens
 * across multiple data sources, with optimized rate limiting and caching.
 * It supports pump.fun, dexscreener and other sources to find trading
 * opportunities.
 */

import * as logger from '../logger';
import axios from 'axios';
import { makeExternalApiRequest } from './externalApiManager';

// Interfaces for token data
export interface MemeToken {
  symbol: string;
  name: string;
  address: string;
  price: number;
  priceChange24h: number;
  priceChange1h?: number;
  volume24h: number;
  marketCap?: number;
  liquidity?: number;
  launchDate?: string;
  launchTimestamp?: number;
  isNew?: boolean;
  score?: number;
  source: string;
}

export interface ScanOptions {
  minPriceChangePercent?: number;
  maxAge?: number; // in hours
  minLiquidity?: number;
  minVolume?: number;
  limit?: number;
  onlyNew?: boolean;
  sortBy?: 'volume' | 'price' | 'marketCap' | 'priceChange' | 'liquidity' | 'launch' | 'score';
  sortDirection?: 'asc' | 'desc';
  excludeTokens?: string[];
}

/**
 * Delay function for rate limiting
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// In-memory cache for token data
const tokenCache: {
  pumpFun: MemeToken[];
  dexScreener: MemeToken[];
  birdeye: MemeToken[];
  lastUpdated: {
    pumpFun: number;
    dexScreener: number;
    birdeye: number;
  }
} = {
  pumpFun: [],
  dexScreener: [],
  birdeye: [],
  lastUpdated: {
    pumpFun: 0,
    dexScreener: 0,
    birdeye: 0
  }
};

// Cache expiry in milliseconds
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

/**
 * Scan pump.fun for trending tokens
 */
export async function scanPumpFun(): Promise<MemeToken[]> {
  // Check cache first
  const now = Date.now();
  if (tokenCache.pumpFun.length > 0 && (now - tokenCache.lastUpdated.pumpFun) < CACHE_EXPIRY) {
    logger.info(`Using cached data for pump.fun (${tokenCache.pumpFun.length} tokens)`);
    return tokenCache.pumpFun;
  }

  try {
    // List of possible endpoints to try - updated with the latest endpoints
    const endpoints = [
      'https://api.pump.fun/v2/solana/tokens/trending?limit=100',
      'https://api.pump.fun/api/v2/solana/tokens/trending?limit=100',
      'https://pump.fun/api/tokens/trending?limit=100',
      'https://api.stats.pump.fun/solana/tokens/trending?limit=100'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await makeExternalApiRequest<any>(endpoint, {}, true, true);
        
        if (response && Array.isArray(response.tokens)) {
          const tokens: MemeToken[] = response.tokens.map((token: any) => ({
            symbol: token.symbol,
            name: token.name,
            address: token.mint,
            price: parseFloat(token.price) || 0,
            priceChange24h: token.price_change_24h || 0,
            volume24h: token.volume_24h || 0,
            marketCap: token.market_cap || 0,
            liquidity: token.liquidity_sol || 0,
            launchDate: token.launch_date,
            launchTimestamp: token.launch_timestamp,
            isNew: token.is_new || false,
            score: calculateTokenScore(token),
            source: 'pump.fun'
          }));

          // Update cache
          tokenCache.pumpFun = tokens;
          tokenCache.lastUpdated.pumpFun = now;
          
          logger.info(`Successfully fetched ${tokens.length} tokens from pump.fun`);
          return tokens;
        }
      } catch (error) {
        logger.warn(`Failed to fetch from endpoint ${endpoint}: ${error.message}`);
        // Continue to next endpoint
      }
      
      // Wait a bit before trying next endpoint to avoid rate limits
      await delay(500);
    }
    
    // If all endpoints fail, use cached data if available
    if (tokenCache.pumpFun.length > 0) {
      logger.warn(`Using stale cached data for pump.fun (${tokenCache.pumpFun.length} tokens)`);
      return tokenCache.pumpFun;
    }
    
    // Otherwise return empty array
    return [];
  } catch (error) {
    logger.error(`Error scanning pump.fun: ${error.message}`);
    return tokenCache.pumpFun.length > 0 ? tokenCache.pumpFun : [];
  }
}

/**
 * Scan dexscreener for trending tokens
 */
export async function scanDexScreener(): Promise<MemeToken[]> {
  // Check cache first
  const now = Date.now();
  if (tokenCache.dexScreener.length > 0 && (now - tokenCache.lastUpdated.dexScreener) < CACHE_EXPIRY) {
    logger.info(`Using cached data for dexscreener (${tokenCache.dexScreener.length} tokens)`);
    return tokenCache.dexScreener;
  }

  try {
    // List of addresses to scan - high volume tokens and known meme tokens
    const tokenAddresses = [
      // Pre-defined list of addresses to check
      // BONK, WIF, MEME, others...
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      'MoNExuUcKbGQ4yQ1WEJEaybQYdWEYKjP9UMeTVNnpQ2g',
      'H6QSvF5q8HA9jHmYnD7Z3Ah4gwZLN4YtNz3wAkNmzgj7',
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'
    ];
    
    const tokens: MemeToken[] = [];
    
    // Try different endpoints
    const endpoints = [
      'https://api.dexscreener.com/latest/dex/tokens/',
      'https://api.dexscreener.io/latest/dex/tokens/',
      'https://api-mainnet.dexscreener.com/latest/dex/tokens/'
    ];
    
    // Make a single request with a comma-separated list of addresses
    const addressList = tokenAddresses.join(',');
    
    for (const baseEndpoint of endpoints) {
      try {
        const url = `${baseEndpoint}${addressList}`;
        const response = await makeExternalApiRequest<any>(url, {}, true, true);
        
        if (response && Array.isArray(response.pairs)) {
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
              score: calculatePairScore(pair),
              source: 'dexscreener'
            };
            
            // Add to tokens list if not duplicate
            if (!tokens.some(t => t.address === token.address)) {
              tokens.push(token);
            }
          }
          
          // Update cache
          tokenCache.dexScreener = tokens;
          tokenCache.lastUpdated.dexScreener = now;
          
          logger.info(`Successfully fetched ${tokens.length} tokens from dexscreener`);
          return tokens;
        }
      } catch (error) {
        logger.warn(`Failed to fetch from endpoint ${baseEndpoint}: ${error.message}`);
        // Continue to next endpoint
      }
      
      // Wait a bit before trying next endpoint to avoid rate limits
      await delay(500);
    }
    
    // If all endpoints fail, use cached data if available
    if (tokenCache.dexScreener.length > 0) {
      logger.warn(`Using stale cached data for dexscreener (${tokenCache.dexScreener.length} tokens)`);
      return tokenCache.dexScreener;
    }
    
    // Otherwise return empty array
    return [];
  } catch (error) {
    logger.error(`Error scanning dexscreener: ${error.message}`);
    return tokenCache.dexScreener.length > 0 ? tokenCache.dexScreener : [];
  }
}

/**
 * Scan birdeye for trending tokens
 */
export async function scanBirdeye(): Promise<MemeToken[]> {
  // Check if API key is available 
  if (!process.env.BIRDEYE_API_KEY) {
    logger.warn('Birdeye API key not available');
    return tokenCache.birdeye.length > 0 ? tokenCache.birdeye : [];
  }
  
  // Check cache first
  const now = Date.now();
  if (tokenCache.birdeye.length > 0 && (now - tokenCache.lastUpdated.birdeye) < CACHE_EXPIRY) {
    logger.info(`Using cached data for birdeye (${tokenCache.birdeye.length} tokens)`);
    return tokenCache.birdeye;
  }

  try {
    const url = 'https://public-api.birdeye.so/defi/trending_tokens?chain=solana';
    const response = await makeExternalApiRequest<any>(
      url,
      {
        headers: {
          'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
      },
      true,
      true
    );
    
    if (response && Array.isArray(response.data)) {
      const tokens: MemeToken[] = response.data.map((token: any) => ({
        symbol: token.symbol,
        name: token.name,
        address: token.address,
        price: token.price || 0,
        priceChange24h: token.priceChange24h || 0,
        volume24h: token.volume24h || 0,
        marketCap: token.marketCap || 0,
        liquidity: token.liquidity || 0,
        score: (token.priceChange24h * 0.4) + (token.volume24h * 0.0001),
        source: 'birdeye'
      }));
      
      // Update cache
      tokenCache.birdeye = tokens;
      tokenCache.lastUpdated.birdeye = now;
      
      logger.info(`Successfully fetched ${tokens.length} tokens from birdeye`);
      return tokens;
    }
    
    // If request fails, use cached data if available
    if (tokenCache.birdeye.length > 0) {
      logger.warn(`Using stale cached data for birdeye (${tokenCache.birdeye.length} tokens)`);
      return tokenCache.birdeye;
    }
    
    return [];
  } catch (error) {
    logger.error(`Error scanning birdeye: ${error.message}`);
    return tokenCache.birdeye.length > 0 ? tokenCache.birdeye : [];
  }
}

/**
 * Aggregate data from multiple sources
 */
export async function scanForTokens(options: ScanOptions = {}): Promise<MemeToken[]> {
  try {
    // Set default options
    const opts: Required<ScanOptions> = {
      minPriceChangePercent: options.minPriceChangePercent || 0,
      maxAge: options.maxAge || 24 * 7, // 1 week by default
      minLiquidity: options.minLiquidity || 0,
      minVolume: options.minVolume || 0,
      limit: options.limit || 100,
      onlyNew: options.onlyNew || false,
      sortBy: options.sortBy || 'score',
      sortDirection: options.sortDirection || 'desc',
      excludeTokens: options.excludeTokens || []
    };
    
    // Get data from multiple sources
    logger.info('Scanning for tokens across multiple sources...');
    const [pumpFunTokens, dexScreenerTokens, birdeyeTokens] = await Promise.all([
      scanPumpFun(),
      scanDexScreener(),
      scanBirdeye()
    ]);
    
    // Combine all tokens
    let allTokens: MemeToken[] = [
      ...pumpFunTokens,
      ...dexScreenerTokens,
      ...birdeyeTokens
    ];
    
    // Deduplicate by address (prefer pump.fun data for duplicates)
    const tokenMap = new Map<string, MemeToken>();
    allTokens.forEach(token => {
      if (!tokenMap.has(token.address) || token.source === 'pump.fun') {
        tokenMap.set(token.address, token);
      }
    });
    
    // Convert back to array and apply filters
    allTokens = Array.from(tokenMap.values());
    
    // Apply filters
    const filteredTokens = allTokens.filter(token => {
      // Skip excluded tokens
      if (opts.excludeTokens.includes(token.symbol)) {
        return false;
      }
      
      // Check minimum price change
      if (token.priceChange24h < opts.minPriceChangePercent) {
        return false;
      }
      
      // Check minimum liquidity
      if (token.liquidity && token.liquidity < opts.minLiquidity) {
        return false;
      }
      
      // Check minimum volume
      if (token.volume24h < opts.minVolume) {
        return false;
      }
      
      // Check if only new tokens
      if (opts.onlyNew && token.isNew === false) {
        return false;
      }
      
      // Check age if launch timestamp available
      if (token.launchTimestamp) {
        const now = Date.now();
        const ageHours = (now - token.launchTimestamp) / (60 * 60 * 1000);
        if (ageHours > opts.maxAge) {
          return false;
        }
      }
      
      return true;
    });
    
    // Sort tokens
    const sortedTokens = filteredTokens.sort((a, b) => {
      let aValue: number, bValue: number;
      
      switch (opts.sortBy) {
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'volume':
          aValue = a.volume24h;
          bValue = b.volume24h;
          break;
        case 'priceChange':
          aValue = a.priceChange24h;
          bValue = b.priceChange24h;
          break;
        case 'marketCap':
          aValue = a.marketCap || 0;
          bValue = b.marketCap || 0;
          break;
        case 'liquidity':
          aValue = a.liquidity || 0;
          bValue = b.liquidity || 0;
          break;
        case 'launch':
          aValue = a.launchTimestamp || 0;
          bValue = b.launchTimestamp || 0;
          break;
        case 'score':
        default:
          aValue = a.score || 0;
          bValue = b.score || 0;
          break;
      }
      
      const direction = opts.sortDirection === 'asc' ? 1 : -1;
      return (aValue - bValue) * direction;
    });
    
    // Limit results
    const limitedTokens = sortedTokens.slice(0, opts.limit);
    
    logger.info(`Found ${limitedTokens.length} tokens matching criteria`);
    return limitedTokens;
  } catch (error) {
    logger.error(`Error scanning for tokens: ${error.message}`);
    return [];
  }
}

/**
 * Calculate score for a token based on various factors
 */
function calculateTokenScore(token: any): number {
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
 * Calculate score for a dexscreener pair
 */
function calculatePairScore(pair: any): number {
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
 * Find potential sniper opportunities based on specific criteria
 */
export async function findSniperOpportunities(): Promise<MemeToken[]> {
  // Specialized options for sniper opportunities
  const sniperOptions: ScanOptions = {
    minPriceChangePercent: 5,  // At least 5% price change
    maxAge: 48,               // Max 48 hours old
    minLiquidity: 5,          // At least 5 SOL liquidity
    minVolume: 1000,          // At least $1000 volume
    limit: 20,                // Top 20 results
    sortBy: 'score',          // Sort by calculated score
    sortDirection: 'desc',    // Highest first
    // Exclude stable coins and major tokens
    excludeTokens: ['USDC', 'USDT', 'BTC', 'ETH', 'SOL']  
  };
  
  return scanForTokens(sniperOptions);
}

/**
 * Find new token launches (potential sniper targets)
 */
export async function findNewTokenLaunches(): Promise<MemeToken[]> {
  // Specialized options for new token launches
  const newTokenOptions: ScanOptions = {
    maxAge: 24,               // Max 24 hours old
    onlyNew: true,            // Only tokens marked as new
    limit: 10,                // Top 10 results
    sortBy: 'launch',         // Sort by launch time
    sortDirection: 'desc',    // Newest first
    // Exclude stable coins and major tokens
    excludeTokens: ['USDC', 'USDT', 'BTC', 'ETH', 'SOL']  
  };
  
  return scanForTokens(newTokenOptions);
}

/**
 * Find high liquidity tokens (safer targets)
 */
export async function findHighLiquidityTokens(): Promise<MemeToken[]> {
  // Specialized options for high liquidity tokens
  const highLiquidityOptions: ScanOptions = {
    minLiquidity: 50,         // At least 50 SOL liquidity
    minVolume: 10000,         // At least $10,000 volume
    limit: 10,                // Top 10 results
    sortBy: 'liquidity',      // Sort by liquidity
    sortDirection: 'desc',    // Highest first
    // Exclude stable coins and major tokens
    excludeTokens: ['USDC', 'USDT', 'BTC', 'ETH', 'SOL']  
  };
  
  return scanForTokens(highLiquidityOptions);
}

/**
 * Find tokens with recent price surges (momentum targets)
 */
export async function findMomentumTokens(): Promise<MemeToken[]> {
  // Specialized options for momentum tokens
  const momentumOptions: ScanOptions = {
    minPriceChangePercent: 10, // At least 10% price change
    limit: 10,                // Top 10 results
    sortBy: 'priceChange',    // Sort by price change
    sortDirection: 'desc',    // Highest first
    // Exclude stable coins and major tokens
    excludeTokens: ['USDC', 'USDT', 'BTC', 'ETH', 'SOL']  
  };
  
  return scanForTokens(momentumOptions);
}