/**
 * Comprehensive Solana Token Cache
 * 
 * This module manages token data from various Solana DEXes and price sources
 * with proper caching, rate limiting, and failover between sources.
 */

import * as logger from '../logger';
import { makeExternalApiRequest } from './externalApiManager';
import fs from 'fs';
import path from 'path';

// Token cache configuration
const CACHE_CONFIG = {
  cacheDir: './data/token-cache',
  mainCacheFile: './data/token-cache/token-cache.json',
  maxCacheAgeMs: 10 * 60 * 1000, // 10 minutes
  updateIntervalMs: 60 * 1000, // 1 minute
  priorityUpdateIntervalMs: 30 * 1000, // 30 seconds
  sources: {
    jupiter: {
      priority: 1, // Higher priority = try first
      enabled: true,
      baseUrl: 'https://price.jup.ag/v4/price',
      rateLimitMs: 1000,
      ttlMs: 5 * 60 * 1000,
    },
    meteora: {
      priority: 2,
      enabled: true,
      baseUrl: 'https://stats-api.meteora.ag/pools/all',
      rateLimitMs: 1500,
      ttlMs: 5 * 60 * 1000,
    },
    birdeye: {
      priority: 3,
      enabled: true,
      baseUrl: 'https://public-api.birdeye.so/public',
      rateLimitMs: 1200,
      ttlMs: 5 * 60 * 1000,
    },
    gmgn: {
      priority: 4,
      enabled: true,
      baseUrl: 'https://api.gmgn.ai/v1',
      rateLimitMs: 2000,
      ttlMs: 5 * 60 * 1000,
    },
    raydium: {
      priority: 5,
      enabled: true,
      baseUrl: 'https://api.raydium.io/v2',
      rateLimitMs: 1200,
      ttlMs: 5 * 60 * 1000,
    },
    dexscreener: {
      priority: 6,
      enabled: true,
      baseUrl: 'https://api.dexscreener.com/latest/dex',
      rateLimitMs: 1500,
      ttlMs: 5 * 60 * 1000,
    },
    orca: {
      priority: 7,
      enabled: true, 
      baseUrl: 'https://api.orca.so',
      rateLimitMs: 1000,
      ttlMs: 5 * 60 * 1000,
    },
    pumpfun: {
      priority: 8,
      enabled: true,
      baseUrl: 'https://api.pump.fun',
      rateLimitMs: 2000,
      ttlMs: 5 * 60 * 1000,
    }
  }
};

// Token data interface
export interface TokenData {
  symbol: string;
  name: string;
  address: string;
  decimals?: number;
  tags?: string[];
  logoURI?: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap?: number;
  lastUpdated: string; // ISO timestamp
  source: string;
  confidence: number; // 0-1 representing confidence in data
}

// Cache state
let tokenCache: Record<string, TokenData> = {};
let lastFullUpdateTime = 0;
let isUpdating = false;
let isInitialized = false;

/**
 * Initialize the token cache system
 */
export async function initializeTokenCache(): Promise<void> {
  if (isInitialized) {
    return;
  }
  
  logger.info('Initializing comprehensive token price cache...');
  
  // Ensure cache directory exists
  if (!fs.existsSync(CACHE_CONFIG.cacheDir)) {
    fs.mkdirSync(CACHE_CONFIG.cacheDir, { recursive: true });
  }
  
  // Try to load existing cache from disk
  try {
    loadCacheFromDisk();
  } catch (error) {
    logger.warn('Could not load token cache from disk, creating new cache');
    tokenCache = {};
  }
  
  // Start initial data update
  await updateTokenCache();
  
  // Set up periodic updates
  startPeriodicUpdates();
  
  isInitialized = true;
  logger.info(`Token price cache initialized with ${Object.keys(tokenCache).length} tokens`);
}

/**
 * Load the token cache from disk
 */
function loadCacheFromDisk(): void {
  if (fs.existsSync(CACHE_CONFIG.mainCacheFile)) {
    const cacheData = fs.readFileSync(CACHE_CONFIG.mainCacheFile, 'utf-8');
    try {
      tokenCache = JSON.parse(cacheData);
      const tokenCount = Object.keys(tokenCache).length;
      logger.info(`Loaded token cache from disk with ${tokenCount} tokens`);
    } catch (error) {
      logger.error('Error parsing token cache file:', error);
      tokenCache = {};
    }
  } else {
    logger.info('No token cache file found, starting with empty cache');
    tokenCache = {};
  }
}

/**
 * Save the token cache to disk
 */
function saveCacheToDisk(): void {
  try {
    fs.writeFileSync(
      CACHE_CONFIG.mainCacheFile,
      JSON.stringify(tokenCache, null, 2)
    );
    logger.info(`Saved token cache to disk (${Object.keys(tokenCache).length} tokens)`);
  } catch (error) {
    logger.error('Error saving token cache to disk:', error);
  }
}

/**
 * Start periodic token cache updates
 */
function startPeriodicUpdates(): void {
  // Set up regular cache updates
  setInterval(async () => {
    await updateTokenCache();
  }, CACHE_CONFIG.updateIntervalMs);
  
  // Set up more frequent updates for priority tokens
  setInterval(async () => {
    await updatePriorityTokens();
  }, CACHE_CONFIG.priorityUpdateIntervalMs);
  
  logger.info('Started periodic token cache updates');
}

/**
 * Update high-priority tokens more frequently
 */
async function updatePriorityTokens(): Promise<void> {
  if (isUpdating) {
    return;
  }
  
  const priorityTokens = [
    'SOL', 'BONK', 'WIF', 'MEME', 'JUP', 'SAMO', 'RAY'
  ];
  
  let updatedCount = 0;
  
  try {
    for (const symbol of priorityTokens) {
      // Try to get the most accurate price for this priority token
      try {
        const tokenData = await fetchTokenData(symbol);
        if (tokenData) {
          tokenCache[symbol] = tokenData;
          updatedCount++;
        }
      } catch (error) {
        logger.debug(`Error updating priority token ${symbol}:`, error);
      }
    }
    
    if (updatedCount > 0) {
      logger.debug(`Updated ${updatedCount} priority tokens`);
    }
  } catch (error) {
    logger.error('Error updating priority tokens:', error);
  }
}

/**
 * Update the full token cache
 */
export async function updateTokenCache(): Promise<void> {
  if (isUpdating) {
    return;
  }
  
  isUpdating = true;
  
  try {
    // Update tokens from top-priority sources
    const sources = Object.entries(CACHE_CONFIG.sources)
      .filter(([_, config]) => config.enabled)
      .sort(([_, a], [__, b]) => a.priority - b.priority);
    
    for (const [sourceName, config] of sources) {
      try {
        const tokens = await fetchTokensFromSource(sourceName, config);
        updateCacheFromSource(tokens, sourceName);
      } catch (error) {
        logger.warn(`Error fetching tokens from ${sourceName}:`, error);
      }
      
      // Add slight delay between sources to avoid concurrent API hammering
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Update the last update time
    lastFullUpdateTime = Date.now();
    
    // Save the updated cache to disk
    saveCacheToDisk();
    
  } catch (error) {
    logger.error('Error updating token cache:', error);
  } finally {
    isUpdating = false;
  }
}

/**
 * Update the token cache with data from a specific source
 */
function updateCacheFromSource(tokens: TokenData[], source: string): void {
  if (!tokens || tokens.length === 0) {
    return;
  }
  
  let updatedCount = 0;
  let newCount = 0;
  
  for (const token of tokens) {
    const symbol = token.symbol.toUpperCase();
    
    // If token doesn't exist in cache, add it
    if (!tokenCache[symbol]) {
      tokenCache[symbol] = token;
      newCount++;
      continue;
    }
    
    // If token exists, update it if the new data is fresher or higher confidence
    const existing = tokenCache[symbol];
    const existingDate = new Date(existing.lastUpdated).getTime();
    const newDate = new Date(token.lastUpdated).getTime();
    
    if (newDate > existingDate || token.confidence > existing.confidence) {
      tokenCache[symbol] = token;
      updatedCount++;
    }
  }
  
  if (updatedCount > 0 || newCount > 0) {
    logger.info(`Updated cache from ${source}: ${updatedCount} updated, ${newCount} new tokens`);
  }
}

/**
 * Fetch token data for a specific symbol
 */
export async function fetchTokenData(symbol: string): Promise<TokenData | null> {
  const sources = Object.entries(CACHE_CONFIG.sources)
    .filter(([_, config]) => config.enabled)
    .sort(([_, a], [__, b]) => a.priority - b.priority);
  
  for (const [sourceName, config] of sources) {
    try {
      const token = await fetchTokenFromSource(symbol, sourceName, config);
      if (token) {
        return token;
      }
    } catch (error) {
      // Try next source
    }
  }
  
  // Fallback to cached data if available
  return tokenCache[symbol] || null;
}

/**
 * Fetch tokens from a specific source
 */
async function fetchTokensFromSource(source: string, config: any): Promise<TokenData[]> {
  switch (source) {
    case 'jupiter':
      return fetchTokensFromJupiter(config);
    case 'meteora':
      return fetchTokensFromMeteora(config);
    case 'birdeye':
      return fetchTokensFromBirdeye(config);
    case 'gmgn':
      return fetchTokensFromGmgn(config);
    case 'raydium':
      return fetchTokensFromRaydium(config);
    case 'dexscreener':
      return fetchTokensFromDexscreener(config);
    case 'orca':
      return fetchTokensFromOrca(config);
    case 'pumpfun':
      return fetchTokensFromPumpfun(config);
    default:
      return [];
  }
}

/**
 * Fetch a specific token from a source
 */
async function fetchTokenFromSource(
  symbol: string, 
  source: string, 
  config: any
): Promise<TokenData | null> {
  try {
    switch (source) {
      case 'jupiter':
        return fetchTokenFromJupiter(symbol, config);
      case 'meteora':
        return fetchTokenFromMeteora(symbol, config);
      case 'birdeye':
        return fetchTokenFromBirdeye(symbol, config);
      case 'gmgn':
        return fetchTokenFromGmgn(symbol, config);
      case 'raydium':
        return fetchTokenFromRaydium(symbol, config);
      case 'dexscreener':
        return fetchTokenFromDexscreener(symbol, config);
      case 'orca':
        return fetchTokenFromOrca(symbol, config);
      case 'pumpfun':
        return fetchTokenFromPumpfun(symbol, config);
      default:
        return null;
    }
  } catch (error) {
    return null;
  }
}

/**
 * Get token price and data
 */
export function getTokenPrice(symbol: string): number {
  const token = tokenCache[symbol.toUpperCase()];
  return token ? token.price : 0;
}

export function getTokenData(symbol: string): TokenData | null {
  return tokenCache[symbol.toUpperCase()] || null;
}

export function getAllTokens(): TokenData[] {
  return Object.values(tokenCache);
}

// Source-specific implementations

async function fetchTokensFromJupiter(config: any): Promise<TokenData[]> {
  try {
    // Get list of popular tokens
    const url = `${config.baseUrl}?ids=SOL,BONK,WIF,MEME,RAY,JUP,SAMO,MNGO,COPE`;
    const data = await makeExternalApiRequest<any>(url, {}, true, true);
    
    if (!data || !data.data) {
      return [];
    }
    
    const tokens: TokenData[] = [];
    
    for (const [symbol, details] of Object.entries(data.data)) {
      tokens.push({
        symbol: symbol,
        name: symbol, // Jupiter doesn't always provide name
        address: details.id || '',
        price: details.price || 0,
        priceChange24h: details.priceChange24h || 0,
        volume24h: details.volume24h || 0,
        lastUpdated: new Date().toISOString(),
        source: 'jupiter',
        confidence: 0.9 // Jupiter is reliable
      });
    }
    
    logger.info(`Successfully fetched ${tokens.length} tokens from Jupiter`);
    return tokens;
  } catch (error) {
    logger.error('Error fetching tokens from Jupiter:', error);
    return [];
  }
}

async function fetchTokenFromJupiter(symbol: string, config: any): Promise<TokenData | null> {
  try {
    const url = `${config.baseUrl}?ids=${symbol}`;
    const data = await makeExternalApiRequest<any>(url, {}, true, true);
    
    if (!data || !data.data || !data.data[symbol]) {
      return null;
    }
    
    const details = data.data[symbol];
    
    return {
      symbol: symbol,
      name: symbol,
      address: details.id || '',
      price: details.price || 0,
      priceChange24h: details.priceChange24h || 0,
      volume24h: details.volume24h || 0,
      lastUpdated: new Date().toISOString(),
      source: 'jupiter',
      confidence: 0.9
    };
  } catch (error) {
    return null;
  }
}

async function fetchTokensFromMeteora(config: any): Promise<TokenData[]> {
  try {
    const data = await makeExternalApiRequest<any>(config.baseUrl, {}, true, true);
    
    if (!data || !data.data) {
      return [];
    }
    
    const tokenMap: Record<string, TokenData> = {};
    
    for (const pool of data.data) {
      // Process token A
      if (pool.tokenASymbol && !['USDC', 'USDT'].includes(pool.tokenASymbol)) {
        const symbol = pool.tokenASymbol;
        const price = parseFloat(pool.tokenAPrice) || 0;
        
        // Update token data or create new entry
        if (!tokenMap[symbol] || price > 0) {
          tokenMap[symbol] = {
            symbol: symbol,
            name: pool.tokenAName || symbol,
            address: pool.tokenAMint || '',
            price: price,
            priceChange24h: 0, // Meteora doesn't provide this directly
            volume24h: pool.volume24h || 0,
            lastUpdated: new Date().toISOString(),
            source: 'meteora',
            confidence: 0.85
          };
        }
      }
      
      // Process token B
      if (pool.tokenBSymbol && !['USDC', 'USDT'].includes(pool.tokenBSymbol)) {
        const symbol = pool.tokenBSymbol;
        const price = parseFloat(pool.tokenBPrice) || 0;
        
        // Update token data or create new entry
        if (!tokenMap[symbol] || price > 0) {
          tokenMap[symbol] = {
            symbol: symbol,
            name: pool.tokenBName || symbol,
            address: pool.tokenBMint || '',
            price: price,
            priceChange24h: 0,
            volume24h: pool.volume24h || 0,
            lastUpdated: new Date().toISOString(),
            source: 'meteora',
            confidence: 0.85
          };
        }
      }
    }
    
    const tokens = Object.values(tokenMap);
    logger.info(`Successfully fetched ${tokens.length} tokens from Meteora`);
    return tokens;
  } catch (error) {
    logger.error('Error fetching tokens from Meteora:', error);
    return [];
  }
}

async function fetchTokenFromMeteora(symbol: string, config: any): Promise<TokenData | null> {
  try {
    const data = await makeExternalApiRequest<any>(config.baseUrl, {}, true, true);
    
    if (!data || !data.data) {
      return null;
    }
    
    // Look for the token in pool data
    for (const pool of data.data) {
      if (pool.tokenASymbol === symbol) {
        return {
          symbol: symbol,
          name: pool.tokenAName || symbol,
          address: pool.tokenAMint || '',
          price: parseFloat(pool.tokenAPrice) || 0,
          priceChange24h: 0,
          volume24h: pool.volume24h || 0,
          lastUpdated: new Date().toISOString(),
          source: 'meteora',
          confidence: 0.85
        };
      }
      
      if (pool.tokenBSymbol === symbol) {
        return {
          symbol: symbol,
          name: pool.tokenBName || symbol,
          address: pool.tokenBMint || '',
          price: parseFloat(pool.tokenBPrice) || 0,
          priceChange24h: 0,
          volume24h: pool.volume24h || 0,
          lastUpdated: new Date().toISOString(),
          source: 'meteora',
          confidence: 0.85
        };
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function fetchTokensFromGmgn(config: any): Promise<TokenData[]> {
  try {
    const url = `${config.baseUrl}/trending-tokens`;
    const data = await makeExternalApiRequest<any>(url, {}, true, true);
    
    if (!data || !data.tokens) {
      return [];
    }
    
    const tokens: TokenData[] = [];
    
    for (const token of data.tokens) {
      tokens.push({
        symbol: token.symbol,
        name: token.name || token.symbol,
        address: token.mint || '',
        price: token.price || 0,
        priceChange24h: token.price_change_24h || 0,
        volume24h: token.volume_24h || 0,
        marketCap: token.market_cap || 0,
        lastUpdated: new Date().toISOString(),
        source: 'gmgn',
        confidence: 0.8
      });
    }
    
    logger.info(`Successfully fetched ${tokens.length} tokens from GMGN`);
    return tokens;
  } catch (error) {
    logger.error('Error fetching tokens from GMGN:', error);
    return [];
  }
}

async function fetchTokenFromGmgn(symbol: string, config: any): Promise<TokenData | null> {
  try {
    const url = `${config.baseUrl}/trending-tokens`;
    const data = await makeExternalApiRequest<any>(url, {}, true, true);
    
    if (!data || !data.tokens) {
      return null;
    }
    
    const token = data.tokens.find((t: any) => t.symbol === symbol);
    
    if (!token) {
      return null;
    }
    
    return {
      symbol: token.symbol,
      name: token.name || token.symbol,
      address: token.mint || '',
      price: token.price || 0,
      priceChange24h: token.price_change_24h || 0,
      volume24h: token.volume_24h || 0,
      marketCap: token.market_cap || 0,
      lastUpdated: new Date().toISOString(),
      source: 'gmgn',
      confidence: 0.8
    };
  } catch (error) {
    return null;
  }
}

// Implementation for other sources follows the same pattern
// Implementation for Birdeye
async function fetchTokensFromBirdeye(config: any): Promise<TokenData[]> {
  try {
    // For now we'll return an empty array as Birdeye requires API key
    // This would need to be updated with proper API key handling
    logger.warn('Birdeye API key not available, please add BIRDEYE_API_KEY to your environment variables');
    return [];
  } catch (error) {
    logger.error('Error fetching tokens from Birdeye:', error);
    return [];
  }
}

async function fetchTokenFromBirdeye(symbol: string, config: any): Promise<TokenData | null> {
  // Would implement with proper API key
  return null;
}

// Implementation for Raydium
async function fetchTokensFromRaydium(config: any): Promise<TokenData[]> {
  try {
    const url = `${config.baseUrl}/pairs`;
    const data = await makeExternalApiRequest<any>(url, {}, true, true);
    
    if (!data || !data.data) {
      return [];
    }
    
    const tokenMap: Record<string, TokenData> = {};
    
    for (const pair of data.data) {
      // Process base token
      if (pair.baseSymbol && !['USDC', 'USDT'].includes(pair.baseSymbol)) {
        const symbol = pair.baseSymbol;
        
        tokenMap[symbol] = {
          symbol: symbol,
          name: pair.baseName || symbol,
          address: pair.baseMint || '',
          price: pair.basePrice || 0,
          priceChange24h: pair.priceChange24h || 0,
          volume24h: pair.volume24h || 0,
          lastUpdated: new Date().toISOString(),
          source: 'raydium',
          confidence: 0.85
        };
      }
      
      // Process quote token
      if (pair.quoteSymbol && !['USDC', 'USDT'].includes(pair.quoteSymbol)) {
        const symbol = pair.quoteSymbol;
        
        tokenMap[symbol] = {
          symbol: symbol,
          name: pair.quoteName || symbol,
          address: pair.quoteMint || '',
          price: pair.quotePrice || 0,
          priceChange24h: pair.priceChange24h || 0,
          volume24h: pair.volume24h || 0,
          lastUpdated: new Date().toISOString(),
          source: 'raydium',
          confidence: 0.85
        };
      }
    }
    
    const tokens = Object.values(tokenMap);
    logger.info(`Successfully fetched ${tokens.length} tokens from Raydium`);
    return tokens;
  } catch (error) {
    logger.error('Error fetching tokens from Raydium:', error);
    return [];
  }
}

async function fetchTokenFromRaydium(symbol: string, config: any): Promise<TokenData | null> {
  // Simplified implementation
  return null;
}

// DexScreener implementation
async function fetchTokensFromDexscreener(config: any): Promise<TokenData[]> {
  try {
    // Get top Solana pairs
    const url = `${config.baseUrl}/pairs/solana`;
    const data = await makeExternalApiRequest<any>(url, {}, true, true);
    
    if (!data || !data.pairs) {
      return [];
    }
    
    const tokenMap: Record<string, TokenData> = {};
    
    for (const pair of data.pairs) {
      // Process base token
      if (pair.baseToken && pair.baseToken.symbol) {
        const symbol = pair.baseToken.symbol;
        
        if (!['USDC', 'USDT'].includes(symbol)) {
          tokenMap[symbol] = {
            symbol: symbol,
            name: pair.baseToken.name || symbol,
            address: pair.baseToken.address || '',
            price: parseFloat(pair.priceUsd) || 0,
            priceChange24h: pair.priceChange?.h24 || 0,
            volume24h: pair.volume?.h24 || 0,
            lastUpdated: new Date().toISOString(),
            source: 'dexscreener',
            confidence: 0.85
          };
        }
      }
    }
    
    const tokens = Object.values(tokenMap);
    logger.info(`Successfully fetched ${tokens.length} tokens from DexScreener`);
    return tokens;
  } catch (error) {
    logger.error('Error fetching tokens from DexScreener:', error);
    return [];
  }
}

async function fetchTokenFromDexscreener(symbol: string, config: any): Promise<TokenData | null> {
  try {
    // Search for the token by symbol
    const url = `${config.baseUrl}/search?q=${symbol}`;
    const data = await makeExternalApiRequest<any>(url, {}, true, true);
    
    if (!data || !data.pairs || !data.pairs.length) {
      return null;
    }
    
    // Find the first Solana pair with matching symbol
    const pair = data.pairs.find((p: any) => 
      p.chainId === 'solana' && 
      (p.baseToken.symbol === symbol || p.quoteToken.symbol === symbol)
    );
    
    if (!pair) {
      return null;
    }
    
    // Determine if symbol is base or quote
    const isBase = pair.baseToken.symbol === symbol;
    const tokenInfo = isBase ? pair.baseToken : pair.quoteToken;
    
    return {
      symbol: symbol,
      name: tokenInfo.name || symbol,
      address: tokenInfo.address || '',
      price: isBase ? parseFloat(pair.priceUsd) : (1 / parseFloat(pair.priceUsd)),
      priceChange24h: pair.priceChange?.h24 || 0,
      volume24h: pair.volume?.h24 || 0,
      lastUpdated: new Date().toISOString(),
      source: 'dexscreener',
      confidence: 0.85
    };
  } catch (error) {
    return null;
  }
}

// Orca implementation
async function fetchTokensFromOrca(config: any): Promise<TokenData[]> {
  // Simplified implementation
  return [];
}

async function fetchTokenFromOrca(symbol: string, config: any): Promise<TokenData | null> {
  // Simplified implementation
  return null;
}

// Pump.fun implementation
async function fetchTokensFromPumpfun(config: any): Promise<TokenData[]> {
  try {
    const url = `${config.baseUrl}/solana/tokens/trending?limit=50`;
    const data = await makeExternalApiRequest<any>(url, {}, true, true);
    
    if (!data || !data.tokens) {
      return [];
    }
    
    const tokens: TokenData[] = [];
    
    for (const token of data.tokens) {
      tokens.push({
        symbol: token.symbol,
        name: token.name || token.symbol,
        address: token.mint || '',
        price: token.price || 0,
        priceChange24h: token.price_change_24h || 0,
        volume24h: token.volume_24h || 0,
        marketCap: token.market_cap || 0,
        lastUpdated: new Date().toISOString(),
        source: 'pumpfun',
        confidence: 0.8
      });
    }
    
    logger.info(`Successfully fetched ${tokens.length} tokens from Pump.fun`);
    return tokens;
  } catch (error) {
    logger.error('Error fetching tokens from Pump.fun:', error);
    return [];
  }
}

async function fetchTokenFromPumpfun(symbol: string, config: any): Promise<TokenData | null> {
  // Simplified implementation
  return null;
}

// Initialize the cache on module load
initializeTokenCache();