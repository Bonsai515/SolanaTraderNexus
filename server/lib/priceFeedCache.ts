/**
 * Enhanced Price Feed Cache
 * 
 * This module provides a robust caching layer for token price data
 * with real-time updates and multi-source aggregation.
 */

import axios from 'axios';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

interface PriceData {
  price: number;
  source: string;
  timestamp: string;
  confidence: number;
  volume24h?: number;
  change24h?: number;
  marketCap?: number;
  liquidity?: number;
}

interface TokenPriceMap {
  [token: string]: PriceData;
}

interface PriceFeedSource {
  name: string;
  enabled: boolean;
  priority: number; // Lower number = higher priority
  endpoint: string;
  updateInterval: number; // ms
  lastUpdate: number;
  tokens: string[];
  apiKey?: string;
  headers?: Record<string, string>;
  parser: (data: any) => TokenPriceMap;
}

class PriceFeedCache extends EventEmitter {
  private static instance: PriceFeedCache;
  private priceCache: TokenPriceMap = {};
  private sources: PriceFeedSource[] = [];
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private cacheFilePath: string = path.join('./data', 'price-cache.json');
  private initialized: boolean = false;
  
  private constructor() {
    super();
    this.initialize();
  }
  
  public static getInstance(): PriceFeedCache {
    if (!PriceFeedCache.instance) {
      PriceFeedCache.instance = new PriceFeedCache();
    }
    return PriceFeedCache.instance;
  }
  
  /**
   * Initialize the price feed cache
   */
  private async initialize(): Promise<void> {
    console.log('[PriceCache] Initializing enhanced price feed cache...');
    
    try {
      // Configure price feed sources
      this.configureSources();
      
      // Load cached prices if available
      this.loadCachedPrices();
      
      // Start update intervals for each source
      this.startUpdateIntervals();
      
      // Do initial price update
      await this.updateAllPrices();
      
      this.initialized = true;
      console.log('[PriceCache] Price feed cache initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('[PriceCache] Initialization error:', error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Configure price feed sources
   */
  private configureSources(): void {
    // CoinGecko (reliable but rate-limited)
    this.sources.push({
      name: 'coingecko',
      enabled: true,
      priority: 1,
      endpoint: 'https://api.coingecko.com/api/v3/simple/price?ids=solana,bitcoin,ethereum,bonk,dogwifhat,meme-protocol,pepe,jup-token,orca,raydium&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true',
      updateInterval: 60000, // 1 minute (respect rate limits)
      lastUpdate: 0,
      tokens: ['SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'MEME', 'PEPE', 'JUP', 'ORCA', 'RAY'],
      parser: (data) => {
        const result: TokenPriceMap = {};
        if (data) {
          if (data.solana) {
            result['SOL'] = {
              price: data.solana.usd,
              source: 'coingecko',
              timestamp: new Date().toISOString(),
              confidence: 0.9,
              volume24h: data.solana.usd_24h_vol,
              change24h: data.solana.usd_24h_change,
              marketCap: data.solana.usd_market_cap
            };
          }
          if (data.bitcoin) {
            result['BTC'] = {
              price: data.bitcoin.usd,
              source: 'coingecko',
              timestamp: new Date().toISOString(),
              confidence: 0.9,
              volume24h: data.bitcoin.usd_24h_vol,
              change24h: data.bitcoin.usd_24h_change,
              marketCap: data.bitcoin.usd_market_cap
            };
          }
          if (data.ethereum) {
            result['ETH'] = {
              price: data.ethereum.usd,
              source: 'coingecko',
              timestamp: new Date().toISOString(),
              confidence: 0.9,
              volume24h: data.ethereum.usd_24h_vol,
              change24h: data.ethereum.usd_24h_change,
              marketCap: data.ethereum.usd_market_cap
            };
          }
          if (data.bonk) {
            result['BONK'] = {
              price: data.bonk.usd,
              source: 'coingecko',
              timestamp: new Date().toISOString(),
              confidence: 0.9,
              volume24h: data.bonk.usd_24h_vol,
              change24h: data.bonk.usd_24h_change,
              marketCap: data.bonk.usd_market_cap
            };
          }
          if (data.dogwifhat) {
            result['WIF'] = {
              price: data.dogwifhat.usd,
              source: 'coingecko',
              timestamp: new Date().toISOString(),
              confidence: 0.9,
              volume24h: data.dogwifhat.usd_24h_vol,
              change24h: data.dogwifhat.usd_24h_change,
              marketCap: data.dogwifhat.usd_market_cap
            };
          }
          if (data['meme-protocol']) {
            result['MEME'] = {
              price: data['meme-protocol'].usd,
              source: 'coingecko',
              timestamp: new Date().toISOString(),
              confidence: 0.9,
              volume24h: data['meme-protocol'].usd_24h_vol,
              change24h: data['meme-protocol'].usd_24h_change,
              marketCap: data['meme-protocol'].usd_market_cap
            };
          }
          if (data.pepe) {
            result['PEPE'] = {
              price: data.pepe.usd,
              source: 'coingecko',
              timestamp: new Date().toISOString(),
              confidence: 0.9,
              volume24h: data.pepe.usd_24h_vol,
              change24h: data.pepe.usd_24h_change,
              marketCap: data.pepe.usd_market_cap
            };
          }
          if (data['jup-token']) {
            result['JUP'] = {
              price: data['jup-token'].usd,
              source: 'coingecko',
              timestamp: new Date().toISOString(),
              confidence: 0.9,
              volume24h: data['jup-token'].usd_24h_vol,
              change24h: data['jup-token'].usd_24h_change,
              marketCap: data['jup-token'].usd_market_cap
            };
          }
          if (data.orca) {
            result['ORCA'] = {
              price: data.orca.usd,
              source: 'coingecko',
              timestamp: new Date().toISOString(),
              confidence: 0.9,
              volume24h: data.orca.usd_24h_vol,
              change24h: data.orca.usd_24h_change,
              marketCap: data.orca.usd_market_cap
            };
          }
          if (data.raydium) {
            result['RAY'] = {
              price: data.raydium.usd,
              source: 'coingecko',
              timestamp: new Date().toISOString(),
              confidence: 0.9,
              volume24h: data.raydium.usd_24h_vol,
              change24h: data.raydium.usd_24h_change,
              marketCap: data.raydium.usd_market_cap
            };
          }
        }
        return result;
      }
    });
    
    // Birdeye API (Solana-specific)
    if (process.env.BIRDEYE_API_KEY) {
      this.sources.push({
        name: 'birdeye',
        enabled: true,
        priority: 2,
        endpoint: 'https://public-api.birdeye.so/public/multi_price?list=SOL,BTC,ETH,BONK,WIF,MEME,JUP,ORCA,RAY',
        updateInterval: 30000, // 30 seconds
        lastUpdate: 0,
        tokens: ['SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'MEME', 'JUP', 'ORCA', 'RAY'],
        apiKey: process.env.BIRDEYE_API_KEY,
        headers: {
          'X-API-KEY': process.env.BIRDEYE_API_KEY
        },
        parser: (data) => {
          const result: TokenPriceMap = {};
          if (data && data.data) {
            Object.entries(data.data).forEach(([token, info]: [string, any]) => {
              if (info && info.value) {
                result[token] = {
                  price: info.value,
                  source: 'birdeye',
                  timestamp: new Date().toISOString(),
                  confidence: 0.95,
                  change24h: info.change24h,
                  volume24h: info.volume24h,
                  marketCap: info.marketCap
                };
              }
            });
          }
          return result;
        }
      });
    }
    
    // DexScreener (backup)
    this.sources.push({
      name: 'dexscreener',
      enabled: true,
      priority: 3,
      endpoint: 'https://api.dexscreener.com/latest/dex/tokens/solana.wormhole.bitcoin,solana.wormhole.ethereum,DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263,EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm,MwYRS9t9QgZstHi5gt6kNNKthmU9hjGHRXmRyHmf2bA,JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNMvGRpp',
      updateInterval: 45000, // 45 seconds
      lastUpdate: 0,
      tokens: ['SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'MEME', 'JUP'],
      parser: (data) => {
        const result: TokenPriceMap = {};
        if (data && data.pairs) {
          data.pairs.forEach((pair: any) => {
            if (pair.baseToken && pair.priceUsd) {
              const symbol = pair.baseToken.symbol;
              
              // Skip if we already have this token (from another pair)
              if (result[symbol]) return;
              
              result[symbol] = {
                price: parseFloat(pair.priceUsd),
                source: 'dexscreener',
                timestamp: new Date().toISOString(),
                confidence: 0.85,
                volume24h: parseFloat(pair.volume.h24),
                liquidity: parseFloat(pair.liquidity.usd)
              };
            }
          });
        }
        return result;
      }
    });
    
    // Local fallback for testing (always works even without API)
    this.sources.push({
      name: 'local',
      enabled: true,
      priority: 10, // Lowest priority
      endpoint: 'local',
      updateInterval: 60000, // 1 minute
      lastUpdate: 0,
      tokens: ['SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'MEME', 'PEPE', 'JUP', 'ORCA', 'RAY'],
      parser: (_) => {
        const now = new Date().toISOString();
        return {
          'SOL': { price: 155.75, source: 'local', timestamp: now, confidence: 0.5 },
          'BTC': { price: 66500, source: 'local', timestamp: now, confidence: 0.5 },
          'ETH': { price: 3450, source: 'local', timestamp: now, confidence: 0.5 },
          'BONK': { price: 0.00003, source: 'local', timestamp: now, confidence: 0.5 },
          'WIF': { price: 0.67, source: 'local', timestamp: now, confidence: 0.5 },
          'MEME': { price: 0.034, source: 'local', timestamp: now, confidence: 0.5 },
          'PEPE': { price: 0.0000095, source: 'local', timestamp: now, confidence: 0.5 },
          'JUP': { price: 0.82, source: 'local', timestamp: now, confidence: 0.5 },
          'ORCA': { price: 0.42, source: 'local', timestamp: now, confidence: 0.5 },
          'RAY': { price: 0.24, source: 'local', timestamp: now, confidence: 0.5 }
        };
      }
    });
  }
  
  /**
   * Load cached prices from disk
   */
  private loadCachedPrices(): void {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const cachedData = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8'));
        this.priceCache = cachedData;
        console.log(`[PriceCache] Loaded cached prices for ${Object.keys(this.priceCache).length} tokens`);
      } else {
        console.log('[PriceCache] No cached prices found');
      }
    } catch (error) {
      console.warn('[PriceCache] Error loading cached prices, starting fresh:', error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Start update intervals for each source
   */
  private startUpdateIntervals(): void {
    this.sources.forEach(source => {
      if (source.enabled) {
        const interval = setInterval(async () => {
          await this.updatePriceFromSource(source.name);
        }, source.updateInterval);
        
        this.updateIntervals.set(source.name, interval);
      }
    });
  }
  
  /**
   * Update all prices from all enabled sources
   */
  private async updateAllPrices(): Promise<void> {
    console.log('[PriceCache] Updating prices from all sources...');
    
    const updatePromises = this.sources
      .filter(source => source.enabled)
      .map(source => this.updatePriceFromSource(source.name));
    
    await Promise.allSettled(updatePromises);
    
    console.log(`[PriceCache] Updated ${Object.keys(this.priceCache).length} token prices`);
    
    // Save cache to disk
    this.saveCacheToDisk();
    
    // Emit update event
    this.emit('pricesUpdated', this.priceCache);
  }
  
  /**
   * Update prices from a specific source
   */
  private async updatePriceFromSource(sourceName: string): Promise<void> {
    const source = this.sources.find(s => s.name === sourceName);
    
    if (!source || !source.enabled) {
      return;
    }
    
    try {
      // Skip if we've updated recently to respect rate limits
      const now = Date.now();
      if (now - source.lastUpdate < source.updateInterval * 0.8) {
        return;
      }
      
      // Mark last update time
      source.lastUpdate = now;
      
      // Local source is handled specially
      if (source.name === 'local') {
        const prices = source.parser({});
        this.updatePriceCache(prices, source.name, source.priority);
        return;
      }
      
      // Make API request
      const headers = source.headers || {};
      const response = await axios.get(source.endpoint, {
        headers,
        timeout: 5000 // 5 second timeout
      });
      
      // Parse response
      const prices = source.parser(response.data);
      
      // Update cache
      this.updatePriceCache(prices, source.name, source.priority);
      
      console.log(`[PriceCache] Updated ${Object.keys(prices).length} prices from ${source.name}`);
    } catch (error) {
      console.warn(`[PriceCache] Error updating prices from ${source.name}:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Update price cache with new data
   */
  private updatePriceCache(newPrices: TokenPriceMap, source: string, priority: number): void {
    Object.entries(newPrices).forEach(([token, data]) => {
      // Skip if we already have a higher priority source for this token
      if (
        this.priceCache[token] && 
        this.priceCache[token].source !== source &&
        this.getSourcePriority(this.priceCache[token].source) < priority
      ) {
        return;
      }
      
      // Update price cache
      this.priceCache[token] = data;
      
      // Emit single token update event
      this.emit('priceUpdated', token, data);
    });
  }
  
  /**
   * Get the priority of a source (lower is better)
   */
  private getSourcePriority(sourceName: string): number {
    const source = this.sources.find(s => s.name === sourceName);
    return source ? source.priority : 100; // High number if source not found
  }
  
  /**
   * Save price cache to disk
   */
  private saveCacheToDisk(): void {
    try {
      // Create data directory if it doesn't exist
      const dataDir = path.dirname(this.cacheFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Write cache to file
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(this.priceCache, null, 2));
    } catch (error) {
      console.warn('[PriceCache] Error saving price cache to disk:', error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Get the price of a token
   */
  public getPrice(token: string): number | null {
    const tokenUpperCase = token.toUpperCase();
    return this.priceCache[tokenUpperCase]?.price || null;
  }
  
  /**
   * Get the full price data for a token
   */
  public getPriceData(token: string): PriceData | null {
    const tokenUpperCase = token.toUpperCase();
    return this.priceCache[tokenUpperCase] || null;
  }
  
  /**
   * Get all cached prices
   */
  public getAllPrices(): TokenPriceMap {
    return { ...this.priceCache };
  }
  
  /**
   * Force an update of all prices
   */
  public async forceUpdate(): Promise<void> {
    return this.updateAllPrices();
  }
  
  /**
   * Check if a token exists in the cache
   */
  public hasToken(token: string): boolean {
    const tokenUpperCase = token.toUpperCase();
    return !!this.priceCache[tokenUpperCase];
  }
  
  /**
   * Check if the cache is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Get token price in another token
   */
  public getTokenToTokenPrice(baseToken: string, quoteToken: string): number | null {
    const basePrice = this.getPrice(baseToken);
    const quotePrice = this.getPrice(quoteToken);
    
    if (basePrice === null || quotePrice === null || quotePrice === 0) {
      return null;
    }
    
    return basePrice / quotePrice;
  }
  
  /**
   * Stop all update intervals
   */
  public stop(): void {
    this.updateIntervals.forEach(interval => {
      clearInterval(interval);
    });
    this.updateIntervals.clear();
    
    console.log('[PriceCache] Price feed cache stopped');
  }
}

// Export singleton instance
export const priceFeedCache = PriceFeedCache.getInstance();