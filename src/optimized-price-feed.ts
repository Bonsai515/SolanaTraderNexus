/**
 * Optimized Price Feed
 * 
 * This module creates an optimized price feed system that uses multiple
 * data sources including Chainstream for maximum reliability.
 */

import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { getOptimalConnection, reportRateLimit, logRequestResult } from './enhanced-rpc-manager';

// Token price information
interface TokenPrice {
  symbol: string;
  address: string;
  price: number;
  volume24h?: number;
  marketCap?: number;
  lastUpdated: number;
  source: string;
  confidence: number;
}

// Price source interface
interface PriceSource {
  name: string;
  type: 'api' | 'dex' | 'rpc' | 'chainstream';
  priority: number;
  rateLimit: {
    maxRequests: number,
    perTimeMs: number,
    currentRequests: number,
    resetTime: number
  };
  cacheTtlMs: number;
  fetch: (symbols: string[]) => Promise<TokenPrice[]>;
}

// Cache for token prices
const priceCache: Map<string, TokenPrice> = new Map();

// Initialize API keys from environment
const CHAINSTREAM_API_KEY = process.env.CHAINSTREAM_API_KEY;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || 'your-api-key-here';

// Function to create Jupiter price source
function createJupiterPriceSource(): PriceSource {
  return {
    name: 'Jupiter',
    type: 'api',
    priority: 1,
    rateLimit: {
      maxRequests: 30,
      perTimeMs: 60000,
      currentRequests: 0,
      resetTime: Date.now() + 60000
    },
    cacheTtlMs: 20000,
    fetch: async (symbols: string[]) => {
      try {
        // Reset rate limit counter if needed
        if (Date.now() > Jupiter.rateLimit.resetTime) {
          Jupiter.rateLimit.currentRequests = 0;
          Jupiter.rateLimit.resetTime = Date.now() + Jupiter.rateLimit.perTimeMs;
        }
        
        // Check rate limit
        if (Jupiter.rateLimit.currentRequests >= Jupiter.rateLimit.maxRequests) {
          console.log('Jupiter API rate limit exceeded, skipping');
          return [];
        }
        
        // Increment counter
        Jupiter.rateLimit.currentRequests++;
        
        // Map symbols to Jupiter format if needed
        const jupiterSymbols = symbols.map(s => s.toUpperCase());
        
        // Fetch from Jupiter API
        const response = await axios.get('https://price.jup.ag/v4/price', {
          params: {
            ids: jupiterSymbols.join(',')
          },
          timeout: 5000
        });
        
        // Process response
        const data = response.data.data;
        const prices: TokenPrice[] = [];
        
        // Extract prices
        for (const symbol of jupiterSymbols) {
          if (data[symbol]) {
            prices.push({
              symbol: symbol,
              address: '', // Jupiter doesn't provide addresses directly
              price: data[symbol].price,
              lastUpdated: Date.now(),
              source: 'Jupiter',
              confidence: 0.95
            });
          }
        }
        
        logRequestResult('Jupiter', true);
        return prices;
      } catch (error) {
        console.error('Error fetching prices from Jupiter:', error);
        logRequestResult('Jupiter', false);
        return [];
      }
    }
  };
}

// Function to create CoinGecko price source
function createCoinGeckoSource(): PriceSource {
  return {
    name: 'CoinGecko',
    type: 'api',
    priority: 2,
    rateLimit: {
      maxRequests: COINGECKO_API_KEY ? 500 : 10,
      perTimeMs: 60000,
      currentRequests: 0,
      resetTime: Date.now() + 60000
    },
    cacheTtlMs: 60000, // Cache for 1 minute
    fetch: async (symbols: string[]) => {
      try {
        // Reset rate limit counter if needed
        if (Date.now() > CoinGecko.rateLimit.resetTime) {
          CoinGecko.rateLimit.currentRequests = 0;
          CoinGecko.rateLimit.resetTime = Date.now() + CoinGecko.rateLimit.perTimeMs;
        }
        
        // Check rate limit
        if (CoinGecko.rateLimit.currentRequests >= CoinGecko.rateLimit.maxRequests) {
          console.log('CoinGecko API rate limit exceeded, skipping');
          return [];
        }
        
        // Increment counter
        CoinGecko.rateLimit.currentRequests++;
        
        // Map symbols to CoinGecko IDs (simplified mapping)
        const geckoIds = symbols.map(s => {
          switch (s.toLowerCase()) {
            case 'sol': return 'solana';
            case 'bonk': return 'bonk';
            case 'wif': return 'dogwifhat';
            case 'jup': return 'jupiter';
            default: return s.toLowerCase();
          }
        });
        
        // Create API URL based on whether we have a pro key
        const apiUrl = COINGECKO_API_KEY 
          ? `https://pro-api.coingecko.com/api/v3/simple/price?ids=${geckoIds.join(',')}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&x_cg_pro_api_key=${COINGECKO_API_KEY}`
          : `https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds.join(',')}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true`;
        
        // Fetch from CoinGecko API
        const response = await axios.get(apiUrl, { timeout: 10000 });
        const data = response.data;
        
        // Process response
        const prices: TokenPrice[] = [];
        
        // Map back to original symbols
        for (let i = 0; i < symbols.length; i++) {
          const geckoId = geckoIds[i];
          const symbol = symbols[i];
          
          if (data[geckoId] && data[geckoId].usd) {
            prices.push({
              symbol: symbol,
              address: '', // CoinGecko doesn't provide addresses directly
              price: data[geckoId].usd,
              volume24h: data[geckoId].usd_24h_vol,
              marketCap: data[geckoId].usd_market_cap,
              lastUpdated: Date.now(),
              source: 'CoinGecko',
              confidence: 0.9
            });
          }
        }
        
        logRequestResult('CoinGecko', true);
        return prices;
      } catch (error) {
        console.error('Error fetching prices from CoinGecko:', error);
        logRequestResult('CoinGecko', false);
        return [];
      }
    }
  };
}

// Function to create Chainstream price source (NEW)
function createChainstreamSource(): PriceSource {
  return {
    name: 'Chainstream',
    type: 'chainstream',
    priority: 1, // Set to highest priority
    rateLimit: {
      maxRequests: 100,
      perTimeMs: 60000,
      currentRequests: 0,
      resetTime: Date.now() + 60000
    },
    cacheTtlMs: 10000, // Short cache time for up-to-date prices
    fetch: async (symbols: string[]) => {
      try {
        // Reset rate limit counter if needed
        if (Date.now() > Chainstream.rateLimit.resetTime) {
          Chainstream.rateLimit.currentRequests = 0;
          Chainstream.rateLimit.resetTime = Date.now() + Chainstream.rateLimit.perTimeMs;
        }
        
        // Check rate limit
        if (Chainstream.rateLimit.currentRequests >= Chainstream.rateLimit.maxRequests) {
          console.log('Chainstream API rate limit exceeded, skipping');
          return [];
        }
        
        // Check if API key is available
        if (!CHAINSTREAM_API_KEY) {
          console.log('Chainstream API key not available, skipping');
          return [];
        }
        
        // Increment counter
        Chainstream.rateLimit.currentRequests++;
        
        // Fetch token prices from Chainstream
        const response = await axios.get('https://api.chainstream.com/v1/tokens/prices', {
          headers: {
            'X-API-Key': CHAINSTREAM_API_KEY,
            'Content-Type': 'application/json'
          },
          params: {
            symbols: symbols.join(','),
            network: 'solana'
          },
          timeout: 5000
        });
        
        // Process response
        const data = response.data.data || [];
        const prices: TokenPrice[] = [];
        
        // Extract prices
        for (const item of data) {
          if (item.symbol && item.price) {
            prices.push({
              symbol: item.symbol,
              address: item.address || '',
              price: item.price,
              volume24h: item.volume_24h,
              marketCap: item.market_cap,
              lastUpdated: Date.now(),
              source: 'Chainstream',
              confidence: 0.98 // High confidence for Chainstream data
            });
          }
        }
        
        logRequestResult('Chainstream', true);
        return prices;
      } catch (error) {
        console.error('Error fetching prices from Chainstream:', error);
        logRequestResult('Chainstream', false);
        return [];
      }
    }
  };
}

// Function to create Birdeye price source
function createBirdeyeSource(): PriceSource {
  return {
    name: 'Birdeye',
    type: 'api',
    priority: 3,
    rateLimit: {
      maxRequests: 50,
      perTimeMs: 60000,
      currentRequests: 0,
      resetTime: Date.now() + 60000
    },
    cacheTtlMs: 30000, // 30 seconds cache
    fetch: async (symbols: string[]) => {
      try {
        // Reset rate limit counter if needed
        if (Date.now() > Birdeye.rateLimit.resetTime) {
          Birdeye.rateLimit.currentRequests = 0;
          Birdeye.rateLimit.resetTime = Date.now() + Birdeye.rateLimit.perTimeMs;
        }
        
        // Check rate limit
        if (Birdeye.rateLimit.currentRequests >= Birdeye.rateLimit.maxRequests) {
          console.log('Birdeye API rate limit exceeded, skipping');
          return [];
        }
        
        // Increment counter
        Birdeye.rateLimit.currentRequests++;
        
        // We need to fetch Birdeye price data one symbol at a time
        const prices: TokenPrice[] = [];
        
        for (const symbol of symbols) {
          try {
            // Convert symbol to mint address if needed (for common tokens)
            let address = '';
            
            switch (symbol.toLowerCase()) {
              case 'sol':
                address = 'So11111111111111111111111111111111111111112';
                break;
              case 'usdc':
                address = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
                break;
              // Add more mappings as needed
            }
            
            if (!address) {
              // Skip if we don't have a mapping
              continue;
            }
            
            // Fetch from Birdeye API
            const response = await axios.get(`https://public-api.birdeye.so/public/price?address=${address}`, {
              headers: { 
                'X-API-KEY': BIRDEYE_API_KEY,
                'Content-Type': 'application/json'
              },
              timeout: 5000
            });
            
            // Check if we got a valid response
            if (response.data && response.data.success && response.data.data && response.data.data.value) {
              prices.push({
                symbol: symbol,
                address: address,
                price: response.data.data.value,
                lastUpdated: Date.now(),
                source: 'Birdeye',
                confidence: 0.92
              });
            }
          } catch (symbolError) {
            console.error(`Error fetching ${symbol} price from Birdeye:`, symbolError);
          }
        }
        
        logRequestResult('Birdeye', prices.length > 0);
        return prices;
      } catch (error) {
        console.error('Error fetching prices from Birdeye:', error);
        logRequestResult('Birdeye', false);
        return [];
      }
    }
  };
}

// Create price sources
const Jupiter = createJupiterPriceSource();
const CoinGecko = createCoinGeckoSource();
const Chainstream = createChainstreamSource();
const Birdeye = createBirdeyeSource();

// Collect all sources
const priceSources: PriceSource[] = [
  Chainstream, // Highest priority (if available)
  Jupiter,
  CoinGecko,
  Birdeye
];

/**
 * Get token prices from all sources and cache results
 */
export async function getTokenPrices(symbols: string[]): Promise<Map<string, TokenPrice>> {
  // Convert all symbols to uppercase
  const normalizedSymbols = symbols.map(s => s.toUpperCase());
  
  // Check if we have fresh cached prices
  const now = Date.now();
  const freshPrices = new Map<string, TokenPrice>();
  const symbolsToFetch = [];
  
  for (const symbol of normalizedSymbols) {
    const cachedPrice = priceCache.get(symbol);
    
    if (cachedPrice && (now - cachedPrice.lastUpdated < 60000)) {
      // Use cached price if less than 1 minute old
      freshPrices.set(symbol, cachedPrice);
    } else {
      // Otherwise, fetch fresh price
      symbolsToFetch.push(symbol);
    }
  }
  
  // If all prices are fresh, return cached values
  if (symbolsToFetch.length === 0) {
    return freshPrices;
  }
  
  // Sort sources by priority
  const sortedSources = [...priceSources].sort((a, b) => a.priority - b.priority);
  
  // Fetch prices from all sources in parallel
  const results = await Promise.all(
    sortedSources.map(source => source.fetch(symbolsToFetch))
  );
  
  // Combine results, prioritizing higher confidence sources
  const combinedPrices = new Map<string, TokenPrice>();
  
  // First, collect all prices from all sources
  for (const priceList of results) {
    for (const price of priceList) {
      const existing = combinedPrices.get(price.symbol);
      
      // If we don't have a price yet, or the new price has higher confidence
      if (!existing || price.confidence > existing.confidence) {
        combinedPrices.set(price.symbol, price);
      }
    }
  }
  
  // Update the cache with new prices
  for (const [symbol, price] of combinedPrices.entries()) {
    priceCache.set(symbol, price);
    freshPrices.set(symbol, price);
  }
  
  return freshPrices;
}

/**
 * Get specific token price
 */
export async function getTokenPrice(symbol: string): Promise<number | null> {
  const prices = await getTokenPrices([symbol]);
  const price = prices.get(symbol.toUpperCase());
  return price ? price.price : null;
}

/**
 * Initialize price feed and start periodic cache refresh
 */
export function initializePriceFeed(): void {
  console.log('Initializing optimized price feed with multiple sources...');
  
  // Initial tokens to track (can be expanded)
  const initialTokens = ['SOL', 'USDC', 'BONK', 'JUP', 'WIF', 'MEME'];
  
  // Initial fetch to warm up the cache
  getTokenPrices(initialTokens)
    .then(prices => {
      console.log(`✅ Initialized price feed with ${prices.size} token prices`);
      
      // Log the fetched prices
      for (const [symbol, price] of prices.entries()) {
        console.log(`  ${symbol}: $${price.price.toFixed(4)} (from ${price.source})`);
      }
    })
    .catch(error => {
      console.error('Error initializing price feed:', error);
    });
  
  // Set up periodic cache refresh (every 30 seconds)
  setInterval(async () => {
    try {
      await getTokenPrices(initialTokens);
    } catch (error) {
      console.error('Error refreshing price cache:', error);
    }
  }, 30000);
  
  console.log('✅ Price feed refresh scheduled every 30 seconds');
}

// Export a singleton instance
export const priceFeed = {
  getTokenPrices,
  getTokenPrice,
  initializePriceFeed
};