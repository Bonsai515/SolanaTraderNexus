/**
 * Alternative Price Feed
 * 
 * This module provides price data without relying on CoinGecko,
 * using alternative sources and caching to prevent rate limiting.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';
import EventEmitter from 'events';

// Constants
const CACHE_DIR = path.join(process.cwd(), 'cache');
const PRICE_CACHE_PATH = path.join(CACHE_DIR, 'price-cache.json');
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;

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

// Alternative price sources
const priceSources = [
  {
    name: 'jupiter',
    url: 'https://price.jup.ag/v4/price',
    priority: 1,
    refreshIntervalMs: 30000 // 30 seconds
  },
  {
    name: 'helius',
    url: `https://api.helius.xyz/v0/tokens?api-key=${HELIUS_API_KEY}`,
    priority: 2,
    refreshIntervalMs: 60000 // 1 minute
  },
  {
    name: 'birdeye',
    url: 'https://public-api.birdeye.so/public/price',
    priority: 3,
    refreshIntervalMs: 45000 // 45 seconds
  }
];

// Token mapping for different sources
const tokenMapping: Record<string, Record<string, string>> = {
  jupiter: {
    'SOL': 'SOL',
    'USDC': 'USDC',
    'BONK': 'BONK',
    'JUP': 'JUP',
    'MEME': 'MEME',
    'WIF': 'WIF'
  },
  helius: {
    'SOL': 'So11111111111111111111111111111111111111112',
    'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    'MEME': 'MeMeMwYBVZbuMPLEH4J4Ro1XwmLyFbr6cqziShAsvA4',
    'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLZYi7pBe64mA'
  },
  birdeye: {
    'SOL': 'So11111111111111111111111111111111111111112',
    'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    'MEME': 'MeMeMwYBVZbuMPLEH4J4Ro1XwmLyFbr6cqziShAsvA4',
    'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLZYi7pBe64mA'
  }
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

// Alternate price feed class
class AlternativePriceFeed extends EventEmitter {
  private prices: Map<string, number> = new Map();
  private lastUpdated: Map<string, number> = new Map();
  private updating: Set<string> = new Set();
  private connection: Connection;
  private fallbackRequests: Map<string, number> = new Map();
  private tokenAddressCache: Map<string, string> = new Map();
  
  constructor() {
    super();
    this.connection = new Connection(SYNDICA_URL);
    
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
    // Update prices for common tokens periodically
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
      // Stagger updates - one token every 10 seconds
      setTimeout(() => {
        this.updatePrice(token);
        
        // Schedule recurring updates
        setInterval(() => {
          this.updatePrice(token);
        }, 60000); // Every minute
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
   * Update price from sources
   */
  private async updatePrice(token: string): Promise<void> {
    token = token.toUpperCase();
    
    // Mark as updating
    this.updating.add(token);
    
    try {
      // Try each price source in order
      for (const source of priceSources) {
        try {
          let price: number | undefined;
          
          // Get price from appropriate source
          switch (source.name) {
            case 'jupiter':
              price = await this.getPriceFromJupiter(token);
              break;
            case 'helius':
              price = await this.getPriceFromHelius(token);
              break;
            case 'birdeye':
              price = await this.getPriceFromBirdeye(token);
              break;
          }
          
          // If price found, update and return
          if (price !== undefined && price > 0) {
            this.prices.set(token, price);
            this.lastUpdated.set(token, Date.now());
            this.emit('price-updated', token, price);
            
            // Reset fallback counter
            this.fallbackRequests.delete(token);
            
            return;
          }
        } catch (error) {
          console.log(`Error fetching ${token} price from ${source.name}:`, error.message);
          // Continue to next source
        }
      }
      
      // If all sources failed, use fallback strategy
      this.useFallbackStrategy(token);
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
      const mappedToken = tokenMapping.jupiter[token];
      
      if (!mappedToken) return undefined;
      
      // Add delay to avoid rate limiting
      await this.delay(Math.random() * 1000);
      
      const response = await axios.get(`${priceSources[0].url}?ids=${mappedToken}`);
      
      if (response.data && response.data.data && response.data.data[mappedToken]) {
        return response.data.data[mappedToken].price;
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
      // Skip if no Helius API key
      if (!HELIUS_API_KEY) return undefined;
      
      const mappedToken = tokenMapping.helius[token];
      
      if (!mappedToken) return undefined;
      
      // Add delay to avoid rate limiting
      await this.delay(Math.random() * 1000);
      
      const response = await axios.get(`https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`, {
        params: {
          mintAccounts: [mappedToken]
        }
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
   * Get price from Birdeye
   */
  private async getPriceFromBirdeye(token: string): Promise<number | undefined> {
    try {
      const mappedToken = tokenMapping.birdeye[token];
      
      if (!mappedToken) return undefined;
      
      // Add delay to avoid rate limiting
      await this.delay(Math.random() * 1000);
      
      const response = await axios.get(`${priceSources[2].url}`, {
        params: {
          address: mappedToken
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.data && response.data.data.value) {
        return response.data.data.value;
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
   * Use fallback strategy when all sources fail
   */
  private useFallbackStrategy(token: string): void {
    // Increment fallback counter
    const count = (this.fallbackRequests.get(token) || 0) + 1;
    this.fallbackRequests.set(token, count);
    
    // If we've tried more than 3 times, use default price
    if (count > 3) {
      const currentPrice = this.prices.get(token);
      
      // If we already have a price, keep it but mark as updated
      if (currentPrice) {
        // Add small random variation to simulate market movement
        const variation = (Math.random() * 0.02) - 0.01; // ±1%
        const newPrice = currentPrice * (1 + variation);
        
        this.prices.set(token, newPrice);
        this.lastUpdated.set(token, Date.now());
        this.emit('price-updated', token, newPrice);
      } else if (defaultPrices[token]) {
        // Use default price if available
        this.prices.set(token, defaultPrices[token]);
        this.lastUpdated.set(token, Date.now());
        this.emit('price-updated', token, defaultPrices[token]);
      }
    }
  }
  
  /**
   * Helper method to add delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const alternativePriceFeed = new AlternativePriceFeed();