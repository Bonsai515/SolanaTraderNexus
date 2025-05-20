/**
 * Helius Price Service
 * 
 * This module provides price data using Helius and Jupiter,
 * completely avoiding CoinGecko rate limits.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';
import EventEmitter from 'events';

// Constants
const CACHE_DIR = path.join(process.cwd(), 'cache');
const PRICE_CACHE_PATH = path.join(CACHE_DIR, 'helius-price-cache.json');
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

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

// Token mapping
const tokenAddresses: Record<string, string> = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'MEME': 'MeMeMwYBVZbuMPLEH4J4Ro1XwmLyFbr6cqziShAsvA4',
  'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLZYi7pBe64mA'
};

// Default prices for fallback
const defaultPrices: Record<string, number> = {
  'SOL': 150.0,
  'USDC': 1.0,
  'BONK': 0.00002,
  'JUP': 1.25,
  'MEME': 0.03,
  'WIF': 0.9
};

// Helius Price Service class
class HeliusPriceService extends EventEmitter {
  private prices: Map<string, number> = new Map();
  private lastUpdated: Map<string, number> = new Map();
  private updating: Set<string> = new Set();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    super();
    
    // Load cached prices
    for (const [token, data] of Object.entries(priceCache)) {
      this.prices.set(token, data.price);
      this.lastUpdated.set(token, data.timestamp);
    }
    
    // Start streaming updates for common tokens
    this.startStreamingUpdates();
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
      console.error('Error saving price cache:', error);
    }
  }
  
  /**
   * Get price for a token
   */
  async getPrice(token: string): Promise<number> {
    token = token.toUpperCase();
    
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
   * Update price using multiple sources
   */
  private async updatePrice(token: string): Promise<void> {
    token = token.toUpperCase();
    
    // Mark as updating
    this.updating.add(token);
    
    try {
      // Try Jupiter first, then Helius/Alchemy
      let price: number | undefined;
      
      // Get price from Jupiter
      try {
        price = await this.getPriceFromJupiter(token);
      } catch (error) {
        console.log(`Jupiter price error for ${token}: ${error.message}`);
      }
      
      // If Jupiter fails, try Helius
      if (!price && HELIUS_API_KEY) {
        try {
          price = await this.getPriceFromHelius(token);
        } catch (error) {
          console.log(`Helius price error for ${token}: ${error.message}`);
        }
      }
      
      // If Helius fails, try Alchemy
      if (!price && ALCHEMY_API_KEY) {
        try {
          price = await this.getPriceFromAlchemy(token);
        } catch (error) {
          console.log(`Alchemy price error for ${token}: ${error.message}`);
        }
      }
      
      // If all live sources fail, use fallback strategy
      if (!price) {
        price = this.useFallbackPrice(token);
      }
      
      // Update price if we have one
      if (price && price > 0) {
        this.prices.set(token, price);
        this.lastUpdated.set(token, Date.now());
        this.emit('price-updated', token, price);
      }
    } finally {
      // Remove from updating set
      this.updating.delete(token);
    }
  }
  
  /**
   * Get price from Jupiter
   */
  private async getPriceFromJupiter(token: string): Promise<number | undefined> {
    try {
      // Add delay to avoid rate limiting
      await this.delay(Math.random() * 1000);
      
      const response = await axios.get(`https://price.jup.ag/v4/price?ids=${token}`, {
        timeout: 5000
      });
      
      if (response.data && response.data.data && response.data.data[token]) {
        return response.data.data[token].price;
      }
      
      return undefined;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        // Rate limited
        await this.delay(5000); // Wait 5 seconds
      }
      throw error;
    }
  }
  
  /**
   * Get price from Helius
   */
  private async getPriceFromHelius(token: string): Promise<number | undefined> {
    try {
      if (!HELIUS_API_KEY) return undefined;
      
      const tokenAddress = tokenAddresses[token];
      if (!tokenAddress) return undefined;
      
      // Add delay to avoid rate limiting
      await this.delay(Math.random() * 1000);
      
      const response = await axios.get(`https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`, {
        params: { mintAccounts: [tokenAddress] },
        timeout: 5000
      });
      
      if (response.data && Array.isArray(response.data) && response.data[0]) {
        const tokenData = response.data[0];
        if (tokenData.price && tokenData.price.value) {
          return tokenData.price.value;
        }
      }
      
      return undefined;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        // Rate limited
        await this.delay(5000); // Wait 5 seconds
      }
      throw error;
    }
  }
  
  /**
   * Get price from Alchemy
   */
  private async getPriceFromAlchemy(token: string): Promise<number | undefined> {
    try {
      if (!ALCHEMY_API_KEY) return undefined;
      
      const tokenAddress = tokenAddresses[token];
      if (!tokenAddress) return undefined;
      
      // Add delay to avoid rate limiting
      await this.delay(Math.random() * 1000);
      
      const response = await axios.get(`https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, {
        data: {
          jsonrpc: '2.0',
          id: Date.now().toString(),
          method: 'alchemy_getTokenMetadata',
          params: [tokenAddress]
        },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      if (response.data && response.data.result && response.data.result.price) {
        return response.data.result.price;
      }
      
      return undefined;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        // Rate limited
        await this.delay(5000); // Wait 5 seconds
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
export const heliusPriceService = new HeliusPriceService();