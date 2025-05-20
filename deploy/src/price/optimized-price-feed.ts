/**
 * Optimized Price Feed
 * 
 * This module provides a rate-limited price feed with caching
 * and fallback to prevent 429 errors.
 */

import { apiClient } from '../api/api-client';
import { rateLimiter } from '../rate-limiter/rate-limiter';
import EventEmitter from 'events';

// Price source configuration
interface PriceSource {
  name: string;
  url: string;
  priority: number;
  refreshIntervalMs: number;
}

// Price sources in priority order
const priceSources: PriceSource[] = [
  {
    name: 'coingecko',
    url: 'https://api.coingecko.com/api/v3',
    priority: 1,
    refreshIntervalMs: 60000 // 1 minute
  },
  {
    name: 'pump',
    url: 'https://api.pump.fun/solana',
    priority: 2,
    refreshIntervalMs: 120000 // 2 minutes
  }
];

// Price feed service with rate limiting and caching
class OptimizedPriceFeed extends EventEmitter {
  private prices: Map<string, number> = new Map();
  private lastUpdated: Map<string, number> = new Map();
  private updating: Set<string> = new Set();
  private streamingEnabled: boolean = true;
  
  constructor() {
    super();
    
    // Start streaming updates if enabled
    if (this.streamingEnabled) {
      this.startStreamingUpdates();
    }
  }
  
  /**
   * Start streaming price updates
   */
  private startStreamingUpdates(): void {
    // Update prices for common tokens every minute
    const commonTokens = ['SOL', 'BTC', 'ETH', 'USDC', 'BONK', 'JUP', 'MEME', 'WIF'];
    
    setInterval(() => {
      for (const token of commonTokens) {
        this.updatePrice(token);
      }
    }, 60000);
  }
  
  /**
   * Get price with rate limiting and caching
   */
  async getPrice(token: string): Promise<number> {
    token = token.toUpperCase();
    
    // Check if price exists and is fresh
    const price = this.prices.get(token);
    const lastUpdated = this.lastUpdated.get(token) || 0;
    const now = Date.now();
    
    // Return cached price if fresh (less than 2 minutes old)
    if (price !== undefined && now - lastUpdated < 120000) {
      return price;
    }
    
    // If not updating already, update price
    if (!this.updating.has(token)) {
      await this.updatePrice(token);
    }
    
    // Return price (updated or not)
    return this.prices.get(token) || 0;
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
          if (source.name === 'coingecko') {
            price = await this.getPriceFromCoinGecko(token);
          } else if (source.name === 'pump') {
            price = await this.getPriceFromPump(token);
          }
          
          // If price found, update and return
          if (price !== undefined && price > 0) {
            this.prices.set(token, price);
            this.lastUpdated.set(token, Date.now());
            this.emit('price-updated', token, price);
            return;
          }
        } catch (error) {
          // If rate limited, try next source
          if (error.response?.status === 429) {
            continue;
          }
        }
      }
    } finally {
      // Remove from updating set
      this.updating.delete(token);
    }
  }
  
  /**
   * Get price from CoinGecko
   */
  private async getPriceFromCoinGecko(token: string): Promise<number | undefined> {
    // Map token to CoinGecko ID
    const tokenIdMap: Record<string, string> = {
      'SOL': 'solana',
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDC': 'usd-coin',
      'BONK': 'bonk',
      'JUP': 'jupiter',
      'MEME': 'memecoin',
      'WIF': 'dogwifhat'
    };
    
    const id = tokenIdMap[token];
    if (!id) return undefined;
    
    try {
      const response = await apiClient.get(
        'coingecko',
        `${priceSources[0].url}/simple/price`,
        {
          ids: id,
          vs_currencies: 'usd'
        }
      );
      
      return response[id]?.usd;
    } catch (error) {
      rateLimiter.handleFailure('coingecko', error.response?.status || 0);
      throw error;
    }
  }
  
  /**
   * Get price from Pump.fun
   */
  private async getPriceFromPump(token: string): Promise<number | undefined> {
    try {
      // For meme tokens, try to get from trending tokens
      const response = await apiClient.get(
        'pump',
        `${priceSources[1].url}/tokens/trending`,
        {
          limit: 50
        }
      );
      
      if (response.data && Array.isArray(response.data)) {
        const tokenData = response.data.find(t => 
          t.symbol?.toUpperCase() === token || 
          t.name?.toUpperCase() === token
        );
        
        if (tokenData && tokenData.price) {
          return parseFloat(tokenData.price);
        }
      }
      
      return undefined;
    } catch (error) {
      rateLimiter.handleFailure('pump', error.response?.status || 0);
      throw error;
    }
  }
}

// Export price feed singleton
export const optimizedPriceFeed = new OptimizedPriceFeed();