/**
 * Price Feed Cache
 * 
 * Caches token price data for quick access by various system components
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface PriceData {
  price: number;
  lastUpdated: number;
  source: string;
}

class PriceFeedCache {
  private static instance: PriceFeedCache;
  private prices: Record<string, PriceData> = {};
  private dataDir: string = path.join('./data', 'price-feeds');
  private cacheFilePath: string = path.join(this.dataDir, 'price-cache.json');
  private updateInterval: NodeJS.Timeout | null = null;
  private priorityTokens: string[] = [
    'SOL', 'USDC', 'USDT', 'BTC', 'ETH', 'JUP', 
    'BONK', 'WIF', 'MEME', 'RAY', 'ORCA', 'MEAN',
    'JTO', 'STRM'
  ];
  
  private constructor() {
    this.initializeCache();
  }
  
  public static getInstance(): PriceFeedCache {
    if (!PriceFeedCache.instance) {
      PriceFeedCache.instance = new PriceFeedCache();
    }
    return PriceFeedCache.instance;
  }
  
  private async initializeCache(): Promise<void> {
    try {
      // Ensure cache directory exists
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      
      // Load cached prices if available
      if (fs.existsSync(this.cacheFilePath)) {
        const cacheData = fs.readFileSync(this.cacheFilePath, 'utf8');
        this.prices = JSON.parse(cacheData);
        console.log(`Loaded ${Object.keys(this.prices).length} cached token prices`);
      }
      
      // Start periodic updates
      this.startUpdateInterval();
      
      // Perform initial update
      await this.updatePrices();
    } catch (error) {
      console.error('Error initializing price feed cache:', error);
    }
  }
  
  private startUpdateInterval(): void {
    // Clear existing interval if any
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Update prices every minute
    this.updateInterval = setInterval(() => {
      this.updatePrices().catch(error => {
        console.error('Error updating prices:', error);
      });
    }, 60000); // 1 minute
  }
  
  private async updatePrices(): Promise<void> {
    try {
      // Update priority tokens first
      for (const token of this.priorityTokens) {
        await this.updateTokenPrice(token);
      }
      
      // Save updated cache
      this.saveCache();
    } catch (error) {
      console.error('Error in updatePrices:', error);
    }
  }
  
  private async updateTokenPrice(token: string): Promise<void> {
    try {
      // Try multiple sources in order
      const price = await this.fetchPriceFromSources(token);
      
      if (price) {
        this.prices[token] = price;
      }
    } catch (error) {
      console.error(`Error updating price for ${token}:`, error);
    }
  }
  
  private async fetchPriceFromSources(token: string): Promise<PriceData | null> {
    // Try Jupiter first
    try {
      const jupiterPrice = await this.fetchPriceFromJupiter(token);
      if (jupiterPrice) {
        return {
          price: jupiterPrice,
          lastUpdated: Date.now(),
          source: 'jupiter'
        };
      }
    } catch (error) {
      console.warn(`Jupiter price fetch failed for ${token}:`, error);
    }
    
    // Try Birdeye next
    try {
      const birdeyePrice = await this.fetchPriceFromBirdeye(token);
      if (birdeyePrice) {
        return {
          price: birdeyePrice,
          lastUpdated: Date.now(),
          source: 'birdeye'
        };
      }
    } catch (error) {
      console.warn(`Birdeye price fetch failed for ${token}:`, error);
    }
    
    // Try Coingecko as fallback
    try {
      const coingeckoPrice = await this.fetchPriceFromCoingecko(token);
      if (coingeckoPrice) {
        return {
          price: coingeckoPrice,
          lastUpdated: Date.now(),
          source: 'coingecko'
        };
      }
    } catch (error) {
      console.warn(`Coingecko price fetch failed for ${token}:`, error);
    }
    
    return null;
  }
  
  private async fetchPriceFromJupiter(token: string): Promise<number | null> {
    try {
      // Jupiter doesn't have a direct price API, but we can use their quote API
      // This is a simplified version
      const baseToken = 'USDC';
      const response = await axios.get(`https://quote-api.jup.ag/v6/quote?inputMint=${baseToken}&outputMint=${token}&amount=1000000`);
      
      if (response.data && response.data.outAmount) {
        return Number(response.data.outAmount) / 1000000; // Convert from USDC micros
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
  
  private async fetchPriceFromBirdeye(token: string): Promise<number | null> {
    // Simplified implementation
    try {
      // Would need a proper Birdeye API key
      if (!process.env.BIRDEYE_API_KEY) {
        return null;
      }
      
      // This would be the actual Birdeye API call
      return null;
    } catch (error) {
      return null;
    }
  }
  
  private async fetchPriceFromCoingecko(token: string): Promise<number | null> {
    try {
      // Map token to Coingecko ID
      const coingeckoId = this.getCoingeckoId(token);
      if (!coingeckoId) return null;
      
      const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`);
      
      if (response.data && response.data[coingeckoId] && response.data[coingeckoId].usd) {
        return response.data[coingeckoId].usd;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
  
  private getCoingeckoId(token: string): string | null {
    // Map token symbols to Coingecko IDs
    const tokenMap: Record<string, string> = {
      'SOL': 'solana',
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'BONK': 'bonk',
      'JUP': 'jupiter',
      'RAY': 'raydium',
      'ORCA': 'orca',
      'JTO': 'jito-network',
      'WIF': 'dogwifhat'
    };
    
    return tokenMap[token] || null;
  }
  
  private saveCache(): void {
    try {
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(this.prices), 'utf8');
    } catch (error) {
      console.error('Error saving price cache:', error);
    }
  }
  
  public getPrice(token: string): number | null {
    const data = this.prices[token];
    
    if (!data) {
      return null;
    }
    
    // Check if price is stale (older than 15 minutes)
    const now = Date.now();
    if (now - data.lastUpdated > 15 * 60 * 1000) {
      // If stale, trigger an update but still return the stale price
      this.updateTokenPrice(token).catch(console.error);
    }
    
    return data.price;
  }
  
  public getAllPrices(): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const [token, data] of Object.entries(this.prices)) {
      result[token] = data.price;
    }
    
    return result;
  }
  
  public async refreshPrices(): Promise<void> {
    await this.updatePrices();
  }
  
  public addPriorityToken(token: string): void {
    if (!this.priorityTokens.includes(token)) {
      this.priorityTokens.push(token);
      this.updateTokenPrice(token).catch(console.error);
    }
  }
}

// Create singleton instance
export const priceFeedCache = PriceFeedCache.getInstance();

// Export for convenience
export default priceFeedCache;