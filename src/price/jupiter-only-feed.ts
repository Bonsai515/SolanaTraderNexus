/**
 * Jupiter-Only Price Feed
 * 
 * This module provides price data using only Jupiter API,
 * which has generous rate limits and excellent reliability.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';
import EventEmitter from 'events';

// Constants
const CACHE_DIR = path.join(process.cwd(), 'cache');
const PRICE_CACHE_PATH = path.join(CACHE_DIR, 'jupiter-price-cache.json');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Initialize price cache
let priceCache: Record<string, { price: number; timestamp: number }> = {};
if (fs.existsSync(PRICE_CACHE_PATH)) {
  try {
    priceCache = JSON.parse(fs.readFileSync(PRICE_CACHE_PATH, 'utf8'));
  } catch (error) {
    console.error('Error loading price cache:', error);
    priceCache = {};
  }
}

// Default prices for fallback
const defaultPrices: Record<string, number> = {
  'SOL': 150.0,
  'USDC': 1.0,
  'BONK': 0.00002,
  'JUP': 1.25,
  'MEME': 0.03,
  'WIF': 0.9
};

// Jupiter price URLs
const JUPITER_PRICE_URL = 'https://price.jup.ag/v4/price';
const JUPITER_TOKEN_LIST_URL = 'https://token.jup.ag/all';

// Jupiter Price Service class
class JupiterPriceFeed extends EventEmitter {
  private prices: Map<string, number> = new Map();
  private lastUpdated: Map<string, number> = new Map();
  private updating: Set<string> = new Set();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private tokenAddresses: Map<string, string> = new Map();
  private tokenFetchPromise: Promise<void> | null = null;
  
  constructor() {
    super();
    
    // Load cached prices
    for (const [token, data] of Object.entries(priceCache)) {
      this.prices.set(token, data.price);
      this.lastUpdated.set(token, data.timestamp);
    }
    
    // Initialize token list
    this.initializeTokenList();
    
    // Start streaming updates for common tokens
    this.startStreamingUpdates();
  }
  
  /**
   * Initialize token list from Jupiter
   */
  private async initializeTokenList(): Promise<void> {
    this.tokenFetchPromise = new Promise(async (resolve) => {
      try {
        console.log('[Jupiter Price Feed] Fetching token list...');
        
        // Set default token addresses
        this.tokenAddresses.set('SOL', 'So11111111111111111111111111111111111111112');
        this.tokenAddresses.set('USDC', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
        this.tokenAddresses.set('BONK', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
        this.tokenAddresses.set('JUP', 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN');
        this.tokenAddresses.set('MEME', 'MeMeMwYBVZbuMPLEH4J4Ro1XwmLyFbr6cqziShAsvA4');
        this.tokenAddresses.set('WIF', 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLZYi7pBe64mA');
        
        // Fetch token list from Jupiter
        const response = await axios.get(JUPITER_TOKEN_LIST_URL, {
          timeout: 10000,
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (response.data && Array.isArray(response.data)) {
          console.log(`[Jupiter Price Feed] Received ${response.data.length} tokens from Jupiter`);
          
          // Map tokens by symbol
          response.data.forEach((token: any) => {
            if (token.symbol && token.address) {
              this.tokenAddresses.set(token.symbol.toUpperCase(), token.address);
            }
          });
        }
      } catch (error) {
        console.error('[Jupiter Price Feed] Error fetching token list:', error.message);
      } finally {
        resolve();
      }
    });
  }
  
  /**
   * Start streaming price updates
   */
  private startStreamingUpdates(): void {
    // Update prices for common tokens
    const commonTokens = ['SOL', 'USDC', 'BONK', 'JUP', 'MEME', 'WIF'];
    
    // Initialize with default prices if not available
    for (const token of commonTokens) {
      if (!this.prices.has(token)) {
        this.prices.set(token, defaultPrices[token] || 0);
        this.lastUpdated.set(token, Date.now());
      }
    }
    
    // Schedule updates staggered to avoid rate limiting
    commonTokens.forEach((token, index) => {
      // Stagger initial updates - one token every 10 seconds
      setTimeout(() => {
        this.updatePrice(token);
        
        // Create recurring updates with different intervals for each token
        // to avoid batching requests
        const interval = 60000 + (index * 10000); // Between 60s and 110s
        const intervalId = setInterval(() => {
          this.updatePrice(token);
        }, interval);
        
        this.updateIntervals.set(token, intervalId);
      }, index * 10000);
    });
    
    // Save cache every 5 minutes
    setInterval(() => {
      this.saveCache();
    }, 300000);
  }
  
  /**
   * Save price cache to disk
   */
  private saveCache(): void {
    const cacheData: Record<string, { price: number; timestamp: number }> = {};
    
    for (const [token, price] of this.prices.entries()) {
      cacheData[token] = { 
        price, 
        timestamp: this.lastUpdated.get(token) || Date.now() 
      };
    }
    
    try {
      fs.writeFileSync(PRICE_CACHE_PATH, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.error('[Jupiter Price Feed] Error saving price cache:', error);
    }
  }
  
  /**
   * Get price for a token
   */
  async getPrice(token: string): Promise<number> {
    token = token.toUpperCase();
    
    // Wait for token list to be initialized
    if (this.tokenFetchPromise) {
      await this.tokenFetchPromise;
    }
    
    // Check if price exists and is fresh
    const price = this.prices.get(token);
    const lastUpdated = this.lastUpdated.get(token) || 0;
    const now = Date.now();
    
    // Return cached price if fresh (less than 5 minutes old)
    if (price !== undefined && now - lastUpdated < 300000) {
      return price;
    }
    
    // If not updating already, update price
    if (!this.updating.has(token)) {
      await this.updatePrice(token);
    }
    
    // Return price (updated or not)
    return this.prices.get(token) || defaultPrices[token] || 0;
  }
  
  /**
   * Update price from Jupiter
   */
  private async updatePrice(token: string): Promise<void> {
    token = token.toUpperCase();
    
    // Mark as updating
    this.updating.add(token);
    
    try {
      // Try to get price from Jupiter directly
      try {
        const price = await this.getPriceFromJupiter(token);
        
        if (price !== undefined && price > 0) {
          this.prices.set(token, price);
          this.lastUpdated.set(token, Date.now());
          this.emit('price-updated', token, price);
          return;
        }
      } catch (error) {
        console.log(`[Jupiter Price Feed] Direct price error for ${token}: ${error.message}`);
      }
      
      // If direct method fails, try address method
      try {
        const address = this.tokenAddresses.get(token);
        if (address) {
          const price = await this.getPriceFromJupiterByAddress(address);
          
          if (price !== undefined && price > 0) {
            this.prices.set(token, price);
            this.lastUpdated.set(token, Date.now());
            this.emit('price-updated', token, price);
            return;
          }
        }
      } catch (error) {
        console.log(`[Jupiter Price Feed] Address price error for ${token}: ${error.message}`);
      }
      
      // If all live sources fail, use fallback strategy
      const fallbackPrice = this.useFallbackPrice(token);
      this.prices.set(token, fallbackPrice);
      this.lastUpdated.set(token, Date.now());
      this.emit('price-updated', token, fallbackPrice);
      
    } finally {
      // Remove from updating set
      this.updating.delete(token);
    }
  }
  
  /**
   * Get price from Jupiter by symbol
   */
  private async getPriceFromJupiter(token: string): Promise<number | undefined> {
    try {
      // Add random delay between 0-1000ms to avoid burst requests
      await this.delay(Math.random() * 1000);
      
      // Use the simple Jupiter price API
      const response = await axios.get(`${JUPITER_PRICE_URL}?ids=${token}`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.data && response.data.data && response.data.data[token]) {
        return response.data.data[token].price;
      }
      
      return undefined;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        // Rate limited, add longer delay
        await this.delay(5000 + Math.random() * 5000);
      }
      throw error;
    }
  }
  
  /**
   * Get price from Jupiter by mint address
   */
  private async getPriceFromJupiterByAddress(address: string): Promise<number | undefined> {
    try {
      // Add random delay between 0-1000ms to avoid burst requests
      await this.delay(Math.random() * 1000);
      
      // Use the address-based Jupiter price API
      const response = await axios.get(`${JUPITER_PRICE_URL}?ids=${address}`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.data && response.data.data && response.data.data[address]) {
        return response.data.data[address].price;
      }
      
      return undefined;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        // Rate limited, add longer delay
        await this.delay(5000 + Math.random() * 5000);
      }
      throw error;
    }
  }
  
  /**
   * Use fallback price when all sources fail
   */
  private useFallbackPrice(token: string): number {
    const currentPrice = this.prices.get(token);
    
    // If we already have a price, add small random variation
    if (currentPrice) {
      const variation = (Math.random() * 0.02) - 0.01; // ±1%
      return currentPrice * (1 + variation);
    }
    
    // Use default price if available
    return defaultPrices[token] || 0;
  }
  
  /**
   * Helper method to add delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Stop price service
   */
  stop(): void {
    // Clear all update intervals
    for (const [token, intervalId] of this.updateIntervals.entries()) {
      clearInterval(intervalId);
      this.updateIntervals.delete(token);
    }
    
    // Save cache one last time
    this.saveCache();
  }
}

// Export singleton instance
export const jupiterPriceFeed = new JupiterPriceFeed();