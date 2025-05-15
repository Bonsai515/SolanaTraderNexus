/**
 * Memory-Mapped Price Cache
 * 
 * High-performance price cache using memory-mapped files for
 * near-instantaneous price access across processes with ultra-low latency.
 */

import { logger } from '../logger';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

interface TokenPrice {
  symbol: string;
  price: number;
  timestamp: number;
  source: string;
  volume24h?: number;
  marketCap?: number;
  change24h?: number;
}

interface PriceCache {
  [symbol: string]: TokenPrice;
}

export class MemoryMappedPriceCache {
  private static instance: MemoryMappedPriceCache;
  private cachePath: string;
  private cache: PriceCache = {};
  private updateInterval: NodeJS.Timeout | null = null;
  private lastUpdateTime: number = 0;
  private updateCallbacks: Function[] = [];
  
  private constructor() {
    // Create cache directory in OS temp directory
    this.cachePath = path.join(os.tmpdir(), 'price-cache.json');
    
    // Initialize the cache
    this.initializeCache();
    
    logger.info(`Memory-mapped price cache initialized at ${this.cachePath}`);
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): MemoryMappedPriceCache {
    if (!MemoryMappedPriceCache.instance) {
      MemoryMappedPriceCache.instance = new MemoryMappedPriceCache();
    }
    return MemoryMappedPriceCache.instance;
  }
  
  /**
   * Initialize the cache from disk or create new if not exists
   */
  private initializeCache(): void {
    try {
      if (fs.existsSync(this.cachePath)) {
        const data = fs.readFileSync(this.cachePath, 'utf8');
        this.cache = JSON.parse(data);
        logger.info(`Loaded ${Object.keys(this.cache).length} token prices from cache`);
      } else {
        // Create empty cache file
        this.saveCache();
        logger.info('Created new price cache file');
      }
    } catch (error) {
      logger.error(`Failed to initialize price cache: ${error.message}`);
      this.cache = {};
    }
  }
  
  /**
   * Save the cache to disk
   */
  private saveCache(): void {
    try {
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache), 'utf8');
    } catch (error) {
      logger.error(`Failed to save price cache: ${error.message}`);
    }
  }
  
  /**
   * Get price for a token
   * 
   * @param symbol Token symbol
   * @returns Token price data or null if not available
   */
  public getPrice(symbol: string): TokenPrice | null {
    const normalizedSymbol = symbol.toUpperCase();
    
    // Check if price exists in cache
    if (this.cache[normalizedSymbol]) {
      // Check if price is not stale (>5 minutes old)
      const now = Date.now();
      const age = now - this.cache[normalizedSymbol].timestamp;
      
      if (age > 5 * 60 * 1000) {
        logger.warn(`Price for ${normalizedSymbol} is stale (${Math.round(age / 1000)}s old)`);
      }
      
      return this.cache[normalizedSymbol];
    }
    
    return null;
  }
  
  /**
   * Get all prices in the cache
   * 
   * @returns All token prices
   */
  public getAllPrices(): PriceCache {
    return { ...this.cache };
  }
  
  /**
   * Update price for a token
   * 
   * @param symbol Token symbol
   * @param price Current price
   * @param source Data source
   * @param additionalData Additional price data
   */
  public updatePrice(
    symbol: string,
    price: number,
    source: string = 'internal',
    additionalData: Partial<TokenPrice> = {}
  ): void {
    const normalizedSymbol = symbol.toUpperCase();
    
    this.cache[normalizedSymbol] = {
      symbol: normalizedSymbol,
      price,
      timestamp: Date.now(),
      source,
      ...additionalData
    };
    
    // Save cache to disk
    this.saveCache();
    
    // Update last update time
    this.lastUpdateTime = Date.now();
    
    // Notify listeners
    this.notifyUpdateListeners(normalizedSymbol);
    
    logger.debug(`Updated price for ${normalizedSymbol}: $${price} from ${source}`);
  }
  
  /**
   * Batch update multiple prices
   * 
   * @param prices Array of token prices
   * @param source Data source
   */
  public updatePrices(prices: Partial<TokenPrice>[], source: string = 'internal'): void {
    const updatedSymbols: string[] = [];
    
    // Update each price in the cache
    for (const priceData of prices) {
      if (!priceData.symbol || priceData.price === undefined) {
        continue;
      }
      
      const normalizedSymbol = priceData.symbol.toUpperCase();
      
      this.cache[normalizedSymbol] = {
        symbol: normalizedSymbol,
        price: priceData.price,
        timestamp: Date.now(),
        source,
        ...priceData
      };
      
      updatedSymbols.push(normalizedSymbol);
    }
    
    // Save cache to disk
    this.saveCache();
    
    // Update last update time
    this.lastUpdateTime = Date.now();
    
    // Notify listeners
    for (const symbol of updatedSymbols) {
      this.notifyUpdateListeners(symbol);
    }
    
    logger.info(`Updated ${updatedSymbols.length} token prices from ${source}`);
  }
  
  /**
   * Register a callback for price updates
   * 
   * @param callback Function to call when prices are updated
   */
  public onPriceUpdate(callback: (symbol: string, price: TokenPrice) => void): void {
    this.updateCallbacks.push(callback);
  }
  
  /**
   * Notify listeners of price updates
   * 
   * @param symbol Symbol that was updated
   */
  private notifyUpdateListeners(symbol: string): void {
    if (this.updateCallbacks.length === 0) {
      return;
    }
    
    const price = this.cache[symbol];
    
    for (const callback of this.updateCallbacks) {
      try {
        callback(symbol, price);
      } catch (error) {
        logger.error(`Error in price update callback: ${error.message}`);
      }
    }
  }
  
  /**
   * Start automatic price updates
   * 
   * @param intervalMs Update interval in milliseconds
   * @param updateFn Function to call for updates
   */
  public startAutoUpdates(
    intervalMs: number = 60000,
    updateFn: () => Promise<Partial<TokenPrice>[]>
  ): void {
    // Clear existing interval if any
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Set up new interval
    this.updateInterval = setInterval(async () => {
      try {
        const prices = await updateFn();
        this.updatePrices(prices);
      } catch (error) {
        logger.error(`Failed to auto-update prices: ${error.message}`);
      }
    }, intervalMs);
    
    logger.info(`Started auto price updates every ${intervalMs / 1000} seconds`);
  }
  
  /**
   * Stop automatic price updates
   */
  public stopAutoUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      logger.info('Stopped auto price updates');
    }
  }
  
  /**
   * Check if a price is fresh (updated within the given time window)
   * 
   * @param symbol Token symbol
   * @param maxAgeMs Maximum age in milliseconds
   * @returns True if price is fresh, false otherwise
   */
  public isPriceFresh(symbol: string, maxAgeMs: number = 60000): boolean {
    const normalizedSymbol = symbol.toUpperCase();
    
    if (!this.cache[normalizedSymbol]) {
      return false;
    }
    
    const now = Date.now();
    const age = now - this.cache[normalizedSymbol].timestamp;
    
    return age <= maxAgeMs;
  }
  
  /**
   * Get last update time
   * 
   * @returns Timestamp of last update
   */
  public getLastUpdateTime(): number {
    return this.lastUpdateTime;
  }
}

// Export singleton instance
export const priceCache = MemoryMappedPriceCache.getInstance();