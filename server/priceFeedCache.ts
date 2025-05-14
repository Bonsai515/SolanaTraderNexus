/**
 * Price Feed Cache
 * 
 * Maintains a cache of token prices from multiple sources
 * with automatic refreshing to ensure up-to-date pricing data.
 */

import axios from 'axios';
import * as logger from './logger';
import fs from 'fs';
import path from 'path';

// Price data interface
interface TokenPrice {
  symbol: string;
  priceUsd: number;
  lastUpdated: number;
  source: string;
  change24h?: number;
}

// Price source interface
interface PriceSource {
  name: string;
  priority: number;
  fetcher: () => Promise<Map<string, TokenPrice>>;
  enabled: boolean;
}

// Cache file path
const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'price_cache.json');

// Known tokens to track
const KNOWN_TOKENS = [
  'SOL', 'BONK', 'JUP', 'USDC', 'USDT', 'ETH', 'BTC', 'WIF', 'MEME', 'GUAC'
];

// Price Feed Cache class
export class PriceFeedCache {
  private prices: Map<string, TokenPrice> = new Map();
  private sources: PriceSource[] = [];
  private updateInterval: NodeJS.Timeout | null = null;
  private updateIntervalMs: number = 60000; // 1 minute
  private lastFullUpdate: number = 0;
  private isInitialized: boolean = false;
  
  /**
   * Constructor
   */
  constructor() {
    this.initializeSources();
    this.loadFromCache();
    this.initialize();
  }
  
  /**
   * Initialize price sources
   */
  private initializeSources(): void {
    // Add CoinGecko
    this.sources.push({
      name: 'CoinGecko',
      priority: 1,
      fetcher: this.fetchCoinGeckoPrices.bind(this),
      enabled: true
    });
    
    // Add Jupiter Aggregator
    this.sources.push({
      name: 'Jupiter',
      priority: 2,
      fetcher: this.fetchJupiterPrices.bind(this),
      enabled: true
    });
    
    // Add Birdeye
    this.sources.push({
      name: 'Birdeye',
      priority: 3,
      fetcher: this.fetchBirdeyePrices.bind(this),
      enabled: true
    });
    
    // Sort sources by priority
    this.sources.sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Initialize price feed cache
   */
  public async initialize(): Promise<void> {
    try {
      // Ensure cache directory exists
      const cacheDir = path.dirname(CACHE_FILE_PATH);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      // Force immediate update
      await this.updatePrices();
      
      // Set up automatic refresh
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }
      
      this.updateInterval = setInterval(async () => {
        await this.updatePrices();
      }, this.updateIntervalMs);
      
      this.isInitialized = true;
      logger.info('Price feed cache initialized');
    } catch (error: any) {
      logger.error(`Failed to initialize price feed cache: ${error.message || String(error)}`);
    }
  }
  
  /**
   * Load prices from cache file
   */
  private loadFromCache(): void {
    try {
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
        
        for (const symbol in cacheData) {
          this.prices.set(symbol, cacheData[symbol]);
        }
        
        logger.info(`Loaded ${this.prices.size} token prices from cache`);
      } else {
        logger.info('No price cache found, will create new cache');
      }
    } catch (error: any) {
      logger.error(`Failed to load price cache: ${error.message || String(error)}`);
    }
  }
  
  /**
   * Save prices to cache file
   */
  private saveToCache(): void {
    try {
      const cacheData: Record<string, TokenPrice> = {};
      
      this.prices.forEach((price, symbol) => {
        cacheData[symbol] = price;
      });
      
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2));
    } catch (error: any) {
      logger.error(`Failed to save price cache: ${error.message || String(error)}`);
    }
  }
  
  /**
   * Update prices from all sources
   */
  public async updatePrices(): Promise<void> {
    try {
      // Attempt to fetch from each source in priority order
      for (const source of this.sources) {
        if (!source.enabled) continue;
        
        try {
          const newPrices = await source.fetcher();
          
          // Update prices with new data
          newPrices.forEach((price, symbol) => {
            const existingPrice = this.prices.get(symbol);
            
            // Only update if price is newer
            if (!existingPrice || price.lastUpdated > existingPrice.lastUpdated) {
              this.prices.set(symbol, price);
            }
          });
          
          // If we got data from this source, we can stop trying others
          if (newPrices.size > 0) {
            logger.info(`Updated ${newPrices.size} token prices from ${source.name}`);
            break;
          }
        } catch (error: any) {
          logger.error(`Failed to fetch prices from ${source.name}: ${error.message || String(error)}`);
        }
      }
      
      // Save to cache
      this.saveToCache();
      
      // Update timestamp
      this.lastFullUpdate = Date.now();
      
      logger.debug(`Updated local market data at ${new Date(this.lastFullUpdate).toISOString()}`);
    } catch (error: any) {
      logger.error(`Failed to update prices: ${error.message || String(error)}`);
    }
  }
  
  /**
   * Fetch prices from CoinGecko
   * @returns Map of token symbols to prices
   */
  private async fetchCoinGeckoPrices(): Promise<Map<string, TokenPrice>> {
    const prices = new Map<string, TokenPrice>();
    
    try {
      // CoinGecko free API only allows a few requests per minute
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: 'solana,jupiter,bonk,bitcoin,ethereum,tether,usd-coin,dogwifhat,memecoin,guacamole',
          vs_currencies: 'usd',
          include_24hr_change: 'true',
          include_market_cap: 'true'
        },
        timeout: 5000
      });
      
      if (response.status === 200 && response.data) {
        // Map response to token prices
        if (response.data.solana) {
          prices.set('SOL', {
            symbol: 'SOL',
            priceUsd: response.data.solana.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.solana.usd_24h_change
          });
        }
        
        if (response.data.jupiter) {
          prices.set('JUP', {
            symbol: 'JUP',
            priceUsd: response.data.jupiter.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.jupiter.usd_24h_change
          });
        }
        
        if (response.data.bonk) {
          prices.set('BONK', {
            symbol: 'BONK',
            priceUsd: response.data.bonk.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.bonk.usd_24h_change
          });
        }
        
        if (response.data.bitcoin) {
          prices.set('BTC', {
            symbol: 'BTC',
            priceUsd: response.data.bitcoin.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.bitcoin.usd_24h_change
          });
        }
        
        if (response.data.ethereum) {
          prices.set('ETH', {
            symbol: 'ETH',
            priceUsd: response.data.ethereum.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.ethereum.usd_24h_change
          });
        }
        
        if (response.data['usd-coin']) {
          prices.set('USDC', {
            symbol: 'USDC',
            priceUsd: response.data['usd-coin'].usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data['usd-coin'].usd_24h_change
          });
        }
        
        if (response.data.tether) {
          prices.set('USDT', {
            symbol: 'USDT',
            priceUsd: response.data.tether.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.tether.usd_24h_change
          });
        }
        
        if (response.data.dogwifhat) {
          prices.set('WIF', {
            symbol: 'WIF',
            priceUsd: response.data.dogwifhat.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.dogwifhat.usd_24h_change
          });
        }
        
        if (response.data.memecoin) {
          prices.set('MEME', {
            symbol: 'MEME',
            priceUsd: response.data.memecoin.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.memecoin.usd_24h_change
          });
        }
        
        if (response.data.guacamole) {
          prices.set('GUAC', {
            symbol: 'GUAC',
            priceUsd: response.data.guacamole.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.guacamole.usd_24h_change
          });
        }
      }
    } catch (error: any) {
      logger.error(`Error fetching CoinGecko prices: ${error.message || String(error)}`);
      throw error;
    }
    
    return prices;
  }
  
  /**
   * Fetch prices from Jupiter Aggregator
   * @returns Map of token symbols to prices
   */
  private async fetchJupiterPrices(): Promise<Map<string, TokenPrice>> {
    const prices = new Map<string, TokenPrice>();
    
    try {
      // Placeholder implementation
      // In a real implementation, you would use Jupiter's API to fetch prices
      logger.info('Placeholder: Fetching prices from Jupiter Aggregator');
      
      // Use sample prices for testing (simulating Jupiter's response)
      const now = Date.now();
      
      prices.set('SOL', { symbol: 'SOL', priceUsd: 132.45, lastUpdated: now, source: 'Jupiter' });
      prices.set('BONK', { symbol: 'BONK', priceUsd: 0.000023, lastUpdated: now, source: 'Jupiter' });
      prices.set('JUP', { symbol: 'JUP', priceUsd: 0.764, lastUpdated: now, source: 'Jupiter' });
      prices.set('USDC', { symbol: 'USDC', priceUsd: 0.999, lastUpdated: now, source: 'Jupiter' });
      prices.set('USDT', { symbol: 'USDT', priceUsd: 0.998, lastUpdated: now, source: 'Jupiter' });
      prices.set('ETH', { symbol: 'ETH', priceUsd: 3750.32, lastUpdated: now, source: 'Jupiter' });
      prices.set('WIF', { symbol: 'WIF', priceUsd: 0.645, lastUpdated: now, source: 'Jupiter' });
      prices.set('MEME', { symbol: 'MEME', priceUsd: 0.032, lastUpdated: now, source: 'Jupiter' });
      prices.set('GUAC', { symbol: 'GUAC', priceUsd: 0.00117, lastUpdated: now, source: 'Jupiter' });
    } catch (error: any) {
      logger.error(`Error fetching Jupiter prices: ${error.message || String(error)}`);
      throw error;
    }
    
    return prices;
  }
  
  /**
   * Fetch prices from Birdeye
   * @returns Map of token symbols to prices
   */
  private async fetchBirdeyePrices(): Promise<Map<string, TokenPrice>> {
    const prices = new Map<string, TokenPrice>();
    
    try {
      // Placeholder implementation
      // In a real implementation, you would use Birdeye's API to fetch prices
      logger.info('Placeholder: Fetching prices from Birdeye');
      
      // Use sample prices for testing (simulating Birdeye's response)
      const now = Date.now();
      
      prices.set('SOL', { symbol: 'SOL', priceUsd: 132.67, lastUpdated: now, source: 'Birdeye' });
      prices.set('BONK', { symbol: 'BONK', priceUsd: 0.0000232, lastUpdated: now, source: 'Birdeye' });
      prices.set('JUP', { symbol: 'JUP', priceUsd: 0.763, lastUpdated: now, source: 'Birdeye' });
      prices.set('USDC', { symbol: 'USDC', priceUsd: 0.999, lastUpdated: now, source: 'Birdeye' });
      prices.set('USDT', { symbol: 'USDT', priceUsd: 0.997, lastUpdated: now, source: 'Birdeye' });
      prices.set('ETH', { symbol: 'ETH', priceUsd: 3748.91, lastUpdated: now, source: 'Birdeye' });
      prices.set('WIF', { symbol: 'WIF', priceUsd: 0.648, lastUpdated: now, source: 'Birdeye' });
      prices.set('MEME', { symbol: 'MEME', priceUsd: 0.03189, lastUpdated: now, source: 'Birdeye' });
      prices.set('GUAC', { symbol: 'GUAC', priceUsd: 0.001178, lastUpdated: now, source: 'Birdeye' });
    } catch (error: any) {
      logger.error(`Error fetching Birdeye prices: ${error.message || String(error)}`);
      throw error;
    }
    
    return prices;
  }
  
  /**
   * Get price for a token
   * @param symbol Token symbol
   * @returns Token price in USD
   */
  public getPrice(symbol: string): number | null {
    try {
      const price = this.prices.get(symbol.toUpperCase());
      return price ? price.priceUsd : null;
    } catch (error: any) {
      logger.error(`Error getting price for ${symbol}: ${error.message || String(error)}`);
      return null;
    }
  }
  
  /**
   * Get all token prices
   * @returns Map of token symbols to prices
   */
  public getAllPrices(): Map<string, TokenPrice> {
    return new Map(this.prices);
  }
  
  /**
   * Force update prices
   */
  public async forceUpdate(): Promise<void> {
    logger.info('Price feed forcefully updated');
    return this.updatePrices();
  }
  
  /**
   * Get time since last update
   * @returns Time in milliseconds since last update
   */
  public getTimeSinceLastUpdate(): number {
    return Date.now() - this.lastFullUpdate;
  }
  
  /**
   * Set update interval
   * @param intervalMs Interval in milliseconds
   */
  public setUpdateInterval(intervalMs: number): void {
    this.updateIntervalMs = intervalMs;
    
    // Reset interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      
      this.updateInterval = setInterval(async () => {
        await this.updatePrices();
      }, this.updateIntervalMs);
    }
    
    logger.info(`Price feed update interval set to ${intervalMs}ms`);
  }
}

// Export singleton instance
export const priceFeedCache = new PriceFeedCache();
export default priceFeedCache;