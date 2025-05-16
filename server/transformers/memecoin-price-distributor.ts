/**
 * Memecoin Price Feed Distributor
 * 
 * This module enhances the Communication Transformer by adding memecoin
 * price feed distribution capabilities, aggregating memecoin charts by
 * profitability and top gainers.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { priceFeedCache } from '../lib/priceFeedCache';

interface MemeTokenPrice {
  symbol: string;
  name: string;
  address: string;
  price: number;
  priceChange24h: number;
  priceChange1h?: number;
  volume24h: number;
  marketCap?: number;
  profitabilityScore: number;
  lastTradeProfit?: number;
  lastTradeProfitPercent?: number;
  timestamp: string;
  confidence: number;
  gainRank?: number;
  profitRank?: number;
}

interface MemecoinCache {
  lastUpdated: string;
  topGainers: MemeTokenPrice[];
  topProfitable: MemeTokenPrice[];
  all: Record<string, MemeTokenPrice>;
}

/**
 * Memecoin Price Distributor class
 */
class MemecoinPriceDistributor extends EventEmitter {
  private static instance: MemecoinPriceDistributor;
  private static MEMECOIN_CACHE_UPDATE_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

  private cacheDir: string = path.join('./data', 'memecoin-cache');
  private cacheFilePath: string = path.join(this.cacheDir, 'memecoin-price-cache.json');

  private memecoinCache: MemecoinCache = {
    lastUpdated: new Date().toISOString(),
    topGainers: [],
    topProfitable: [],
    all: {}
  };

  private memecoinUpdateInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  private constructor() {
    super();
    this.initialize();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MemecoinPriceDistributor {
    if (!MemecoinPriceDistributor.instance) {
      MemecoinPriceDistributor.instance = new MemecoinPriceDistributor();
    }
    return MemecoinPriceDistributor.instance;
  }

  /**
   * Initialize the memecoin price distributor
   */
  private async initialize(): Promise<void> {
    try {
      // Ensure cache directory exists
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }

      // Load cached data if available
      this.loadFromCache();

      // Start the update interval
      this.startUpdateInterval();

      // Perform an initial update
      await this.updateMemecoinData();

      this.isRunning = true;
      this.emit('initialized');
    } catch (error) {
      console.error('Error initializing memecoin price distributor:', error);
    }
  }

  /**
   * Load cached memecoin data
   */
  private loadFromCache(): void {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const cacheData = fs.readFileSync(this.cacheFilePath, 'utf8');
        this.memecoinCache = JSON.parse(cacheData);
        console.log(`Loaded ${Object.keys(this.memecoinCache.all).length} cached memecoin prices`);
      }
    } catch (error) {
      console.error('Error loading memecoin cache:', error);
    }
  }

  /**
   * Save memecoin data to cache
   */
  private saveToCache(): void {
    try {
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(this.memecoinCache, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving memecoin cache:', error);
    }
  }

  /**
   * Start the update interval
   */
  private startUpdateInterval(): void {
    // Clear existing interval if any
    if (this.memecoinUpdateInterval) {
      clearInterval(this.memecoinUpdateInterval);
    }

    // Update memecoin data periodically
    this.memecoinUpdateInterval = setInterval(() => {
      this.updateMemecoinData().catch(error => {
        console.error('Error updating memecoin data:', error);
      });
    }, MemecoinPriceDistributor.MEMECOIN_CACHE_UPDATE_INTERVAL_MS);
  }

  /**
   * Update memecoin data
   */
  private async updateMemecoinData(): Promise<void> {
    try {
      console.log('Updating memecoin data...');

      // Fetch memecoin prices initially from price feed cache
      const memecoinData = await this.fetchMemecoinPrices();

      // Enrich with additional data from multiple sources
      await Promise.all([
        this.fetchDexScreenerData(memecoinData),
        this.fetchPumpFunData(memecoinData),
        this.fetchRaydiumData(memecoinData),
        this.fetchBirdeyeData(memecoinData),
        this.fetchMeteoraData(memecoinData),
        this.fetchPhotonData(memecoinData),
        this.fetchGmgnData(memecoinData)
      ]);

      // Enrich with metadata
      await this.enrichMemecoinData(memecoinData);

      // Update profitability scores
      this.updateProfitabilityScores(memecoinData);

      // Sort and store top gainers
      const gainers = Object.values(memecoinData)
        .sort((a, b) => b.priceChange24h - a.priceChange24h)
        .slice(0, 50);

      // Sort and store top profitable
      const profitable = Object.values(memecoinData)
        .sort((a, b) => b.profitabilityScore - a.profitabilityScore)
        .slice(0, 50);

      // Add ranks
      gainers.forEach((token, index) => {
        token.gainRank = index + 1;
        memecoinData[token.symbol].gainRank = index + 1;
      });

      profitable.forEach((token, index) => {
        token.profitRank = index + 1;
        memecoinData[token.symbol].profitRank = index + 1;
      });

      // Update cache
      this.memecoinCache = {
        lastUpdated: new Date().toISOString(),
        topGainers: gainers,
        topProfitable: profitable,
        all: memecoinData
      };

      // Save to disk
      this.saveToCache();

      console.log(`Updated memecoin data: ${Object.keys(memecoinData).length} tokens`);
      this.emit('updated', this.memecoinCache);
    } catch (error) {
      console.error('Error updating memecoin data:', error);
    }
  }

  /**
   * Fetch memecoin prices from price feed cache
   */
  private async fetchMemecoinPrices(): Promise<Record<string, MemeTokenPrice>> {
    try {
      const memecoinData: Record<string, MemeTokenPrice> = {};
      
      // Known memecoins to track
      const knownMemecoins = [
        'BONK', 'WIF', 'MEME', 'BERN', 'TRUMP', 'CAT', 'DOG', 'POPCAT',
        'SLERF', 'DINO', 'APT', 'POPCAT', 'BREAD', 'COPE', 'NOPE', 'MYRO',
        'MOG', 'SNEK', 'TOAD', 'BLOB', 'MOON', 'PNUT', 'WOJAK', 'PEPE',
        'DUST', 'MOON', 'SILLY', 'MUCH', 'SAO'
      ];
      
      // Add known memecoins
      for (const symbol of knownMemecoins) {
        const price = priceFeedCache.getPrice(symbol);
        
        if (price) {
          memecoinData[symbol] = {
            symbol,
            name: symbol,
            address: "", // Will be enriched later
            price,
            priceChange24h: 0, // Will be updated from other sources
            volume24h: 0,
            profitabilityScore: 0,
            timestamp: new Date().toISOString(),
            confidence: 0.5
          };
        }
      }
      
      return memecoinData;
    } catch (error) {
      console.error('Error fetching memecoin prices:', error);
      return {};
    }
  }

  /**
   * Enrich memecoin data with additional information
   */
  /**
   * Fetch from DexScreener API
   */
  private async fetchDexScreenerData(memecoinData: Record<string, MemeTokenPrice>): Promise<void> {
    try {
      const response = await axios.get('https://api.dexscreener.com/latest/dex/tokens/H6QSvF5q8HA9jHmYnD7Z3Ah4gwZLN4YtNz3wAkNmzgj7,4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R,AU9jk7rMrJYQtgYRzJi6q7KQVrxBn3x1JkBznDxvJkpA,7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU,DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263,Ez3nzG9ofUoXZGRCMWMcZA21yR2nLhVaJUEcSc6rEzHn');
      
      if (response.data && response.data.pairs) {
        for (const pair of response.data.pairs) {
          // Extract token info
          const tokenSymbol = pair.baseToken.symbol;
          
          // Skip if not a memecoin or already in our data
          if (!this.isMemeToken(pair.baseToken) && !memecoinData[tokenSymbol]) {
            continue;
          }
          
          // Get existing data or create new entry
          const existingData = memecoinData[tokenSymbol] || {
            symbol: tokenSymbol,
            name: pair.baseToken.name,
            address: pair.baseToken.address,
            price: parseFloat(pair.priceUsd) || 0,
            priceChange24h: parseFloat(pair.priceChange.h24) || 0,
            priceChange1h: parseFloat(pair.priceChange.h1) || 0,
            volume24h: parseFloat(pair.volume.h24) || 0,
            profitabilityScore: 0,
            timestamp: new Date().toISOString(),
            confidence: 0.8 // DexScreener is relatively reliable
          };
          
          // Update existing entry or add new one
          memecoinData[tokenSymbol] = {
            ...existingData,
            // Only update if not already set
            price: existingData.price || parseFloat(pair.priceUsd) || 0,
            priceChange24h: existingData.priceChange24h || parseFloat(pair.priceChange.h24) || 0,
            volume24h: existingData.volume24h || parseFloat(pair.volume.h24) || 0
          };
        }
      }
    } catch (error) {
      console.warn('Error fetching DexScreener data:', error);
    }
  }

  /**
   * Fetch data from Pump.fun
   */
  private async fetchPumpFunData(memecoinData: Record<string, MemeTokenPrice>): Promise<void> {
    try {
      const response = await axios.get('https://api.pump.fun/solana/tokens/trending?limit=50');
      
      if (response.data && response.data.tokens) {
        for (const token of response.data.tokens) {
          const tokenSymbol = token.symbol;
          
          // Skip if not likely a memecoin
          if (!this.isMemeToken(token) && !memecoinData[tokenSymbol]) {
            continue;
          }
          
          // Get existing data or create new entry
          const existingData = memecoinData[tokenSymbol] || {
            symbol: tokenSymbol,
            name: token.name,
            address: token.mint,
            price: parseFloat(token.price) || 0,
            priceChange24h: token.price_change_24h || 0,
            volume24h: token.volume_24h || 0,
            marketCap: token.market_cap || 0,
            profitabilityScore: 0,
            timestamp: new Date().toISOString(),
            confidence: 0.75 // Pump.fun is focused on memecoins
          };
          
          // Update existing entry or add new one
          memecoinData[tokenSymbol] = {
            ...existingData,
            // Only update if not already set or has better data
            price: existingData.price || parseFloat(token.price) || 0,
            priceChange24h: existingData.priceChange24h || token.price_change_24h || 0,
            volume24h: existingData.volume24h || token.volume_24h || 0,
            marketCap: existingData.marketCap || token.market_cap || 0
          };
        }
      }
    } catch (error) {
      console.warn('Error fetching Pump.fun data:', error);
    }
  }

  /**
   * Fetch data from Raydium
   */
  private async fetchRaydiumData(memecoinData: Record<string, MemeTokenPrice>): Promise<void> {
    try {
      const response = await axios.get('https://api.raydium.io/v2/main/pairs');
      
      if (response.data && response.data.data) {
        for (const pair of response.data.data) {
          // Skip if not SOL or USDC pair
          if (!pair.name.endsWith('/USDC') && !pair.name.endsWith('/SOL')) {
            continue;
          }
          
          // Extract token symbol
          const tokenSymbol = pair.name.split('/')[0];
          
          // Skip if not likely a memecoin
          if (!this.isMemeToken({ symbol: tokenSymbol }) && !memecoinData[tokenSymbol]) {
            continue;
          }
          
          // Get existing data or create new entry
          const existingData = memecoinData[tokenSymbol] || {
            symbol: tokenSymbol,
            name: tokenSymbol,
            address: pair.mintA,
            price: pair.price || 0,
            priceChange24h: pair.priceChange24h || 0,
            volume24h: pair.volume24h || 0,
            profitabilityScore: 0,
            timestamp: new Date().toISOString(),
            confidence: 0.7 // Raydium data
          };
          
          // Update existing entry or add new one
          memecoinData[tokenSymbol] = {
            ...existingData,
            // Only update if not already set
            price: existingData.price || pair.price || 0,
            priceChange24h: existingData.priceChange24h || pair.priceChange24h || 0,
            volume24h: existingData.volume24h || pair.volume24h || 0
          };
        }
      }
    } catch (error) {
      console.warn('Error fetching Raydium data:', error);
    }
  }

  /**
   * Fetch data from Birdeye
   */
  private async fetchBirdeyeData(memecoinData: Record<string, MemeTokenPrice>): Promise<void> {
    try {
      // Skip if no Birdeye API key
      if (!process.env.BIRDEYE_API_KEY) {
        return;
      }
      
      const response = await axios.get('https://public-api.birdeye.so/defi/trending_tokens?chain=solana', {
        headers: {
          'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
      });
      
      if (response.data && response.data.data) {
        for (const token of response.data.data) {
          const tokenSymbol = token.symbol;
          
          // Skip if not likely a memecoin
          if (!this.isMemeToken(token) && !memecoinData[tokenSymbol]) {
            continue;
          }
          
          // Get existing data or create new entry
          const existingData = memecoinData[tokenSymbol] || {
            symbol: tokenSymbol,
            name: token.name,
            address: token.address,
            price: token.price || 0,
            priceChange24h: token.priceChange24h || 0,
            volume24h: token.volume24h || 0,
            marketCap: token.marketCap || 0,
            profitabilityScore: 0,
            timestamp: new Date().toISOString(),
            confidence: 0.85 // Birdeye is reliable
          };
          
          // Update existing entry or add new one
          memecoinData[tokenSymbol] = {
            ...existingData,
            // Birdeye data is generally high quality, so prefer it
            price: token.price || existingData.price || 0,
            priceChange24h: token.priceChange24h || existingData.priceChange24h || 0,
            volume24h: token.volume24h || existingData.volume24h || 0,
            marketCap: token.marketCap || existingData.marketCap || 0
          };
        }
      }
    } catch (error) {
      console.warn('Error fetching Birdeye data:', error);
    }
  }

  /**
   * Fetch data from Meteora
   */
  private async fetchMeteoraData(memecoinData: Record<string, MemeTokenPrice>): Promise<void> {
    try {
      const response = await axios.get('https://stats-api.meteora.ag/pools/all');
      
      if (response.data && response.data.data) {
        for (const pool of response.data.data) {
          // Extract token info
          const tokenA = pool.tokenASymbol;
          const tokenB = pool.tokenBSymbol;
          
          // Process both tokens
          for (const tokenSymbol of [tokenA, tokenB]) {
            // Skip if stablecoin or major token
            if (['USDC', 'USDT', 'SOL', 'ETH', 'BTC'].includes(tokenSymbol)) {
              continue;
            }
            
            // Skip if not likely a memecoin and not already in our data
            if (!this.isMemeToken({ symbol: tokenSymbol }) && !memecoinData[tokenSymbol]) {
              continue;
            }
            
            // Get token details
            const tokenDetails = tokenSymbol === tokenA ? 
              {
                address: pool.tokenAMint,
                price: pool.tokenAPrice
              } : 
              {
                address: pool.tokenBMint,
                price: pool.tokenBPrice
              };
            
            // Get existing data or create new entry
            const existingData = memecoinData[tokenSymbol] || {
              symbol: tokenSymbol,
              name: tokenSymbol,
              address: tokenDetails.address,
              price: tokenDetails.price || 0,
              priceChange24h: 0, // Meteora doesn't provide this
              volume24h: pool.volume24h || 0, // This is pool volume, not token volume
              profitabilityScore: 0,
              timestamp: new Date().toISOString(),
              confidence: 0.6 // Meteora data might be less specific
            };
            
            // Update existing entry or add new one
            memecoinData[tokenSymbol] = {
              ...existingData,
              // Only update if not already set
              price: existingData.price || tokenDetails.price || 0,
              volume24h: existingData.volume24h || (pool.volume24h / 2) || 0 // Half the pool volume as estimate
            };
          }
        }
      }
    } catch (error) {
      console.warn('Error fetching Meteora data:', error);
    }
  }

  /**
   * Fetch data from Photon (API details may vary)
   */
  private async fetchPhotonData(memecoinData: Record<string, MemeTokenPrice>): Promise<void> {
    try {
      // Photon API requires an API key, skip if not available
      if (!process.env.PHOTON_API_KEY) {
        return;
      }
      
      const response = await axios.get('https://api.photon.markets/tokens/trending', {
        headers: {
          'Authorization': `Bearer ${process.env.PHOTON_API_KEY}`
        }
      });
      
      if (response.data && response.data.tokens) {
        for (const token of response.data.tokens) {
          const tokenSymbol = token.symbol;
          
          // Skip if not likely a memecoin
          if (!this.isMemeToken(token) && !memecoinData[tokenSymbol]) {
            continue;
          }
          
          // Get existing data or create new entry
          const existingData = memecoinData[tokenSymbol] || {
            symbol: tokenSymbol,
            name: token.name,
            address: token.mint,
            price: token.price || 0,
            priceChange24h: token.priceChange24h || 0,
            volume24h: token.volume24h || 0,
            profitabilityScore: 0,
            timestamp: new Date().toISOString(),
            confidence: 0.75 // Photon data
          };
          
          // Update existing entry or add new one
          memecoinData[tokenSymbol] = {
            ...existingData,
            // Only update if not already set
            price: existingData.price || token.price || 0,
            priceChange24h: existingData.priceChange24h || token.priceChange24h || 0,
            volume24h: existingData.volume24h || token.volume24h || 0
          };
        }
      }
    } catch (error) {
      console.warn('Error fetching Photon data:', error);
    }
  }

  /**
   * Fetch data from GMGN.ai
   */
  private async fetchGmgnData(memecoinData: Record<string, MemeTokenPrice>): Promise<void> {
    try {
      const response = await axios.get('https://api.gmgn.ai/v1/trending-tokens');
      
      if (response.data && response.data.tokens) {
        for (const token of response.data.tokens) {
          const tokenSymbol = token.symbol;
          
          // Skip if not likely a memecoin
          if (!this.isMemeToken(token) && !memecoinData[tokenSymbol]) {
            continue;
          }
          
          // Get existing data or create new entry
          const existingData = memecoinData[tokenSymbol] || {
            symbol: tokenSymbol,
            name: token.name,
            address: token.mint,
            price: token.price || 0,
            priceChange24h: token.price_change_24h || 0,
            volume24h: token.volume_24h || 0,
            profitabilityScore: 0,
            timestamp: new Date().toISOString(),
            confidence: 0.7 // GMGN.ai data
          };
          
          // Update existing entry or add new one
          memecoinData[tokenSymbol] = {
            ...existingData,
            // Only update if not already set
            price: existingData.price || token.price || 0,
            priceChange24h: existingData.priceChange24h || token.price_change_24h || 0,
            volume24h: existingData.volume24h || token.volume_24h || 0
          };
        }
      }
    } catch (error) {
      console.warn('Error fetching GMGN.ai data:', error);
    }
  }

  /**
   * Helper method to find token by address
   */
  private findTokenByAddress(memecoinData: Record<string, MemeTokenPrice>, address: string): MemeTokenPrice | null {
    for (const tokenSymbol in memecoinData) {
      if (memecoinData[tokenSymbol].address === address) {
        return memecoinData[tokenSymbol];
      }
    }
    return null;
  }

  /**
   * Check if a token is likely a memecoin based on various signals
   */
  private isMemeToken(token: any): boolean {
    // Simple heuristic check
    const memeKeywords = [
      'dog', 'cat', 'doge', 'shib', 'inu', 'meme', 'pepe', 'wojak', 
      'cope', 'moon', 'safe', 'elon', 'mars', 'baby', 'poo', 'cum',
      'chad', 'based', 'bonk', 'wif', 'popcat', 'degen', 'frog', 'toad',
      'trump', 'biden', 'bern', 'president', 'election', 'snek', 'silly',
      'turbo', 'yeet', 'much', 'wow', 'very', 'bread', 'baguette', 'toast',
      'food'
    ];
    
    // Check name or symbol for meme keywords
    const nameMatch = token.name?.toLowerCase?.();
    const symbolMatch = token.symbol?.toLowerCase?.();
    
    return memeKeywords.some(keyword => 
      nameMatch?.includes(keyword) || symbolMatch?.includes(keyword)
    );
  }

  /**
   * Enrich with Helius metadata
   */
  private async enrichMemecoinData(memecoinData: Record<string, MemeTokenPrice>): Promise<void> {
    try {
      // Skip if no Helius API key
      if (!process.env.HELIUS_API_KEY) {
        return;
      }
      
      // Get batches of 100 tokens maximum
      const addresses = Object.values(memecoinData)
        .filter(token => token.address)
        .map(token => token.address);
      
      // Process in batches of 100
      for (let i = 0; i < addresses.length; i += 100) {
        const batch = addresses.slice(i, i + 100);
        
        const response = await axios.post(
          `https://api.helius.xyz/v0/token-metadata?api-key=${process.env.HELIUS_API_KEY}`,
          { mintAccounts: batch }
        );
        
        if (response.data) {
          for (const metadata of response.data) {
            // Find token by address
            const token = this.findTokenByAddress(memecoinData, metadata.account);
            
            if (token) {
              // Update with metadata info
              token.name = metadata.onChainMetadata?.metadata?.name || token.name;
              
              // Increase score for tokens with images and full metadata
              if (metadata.offChainMetadata?.image) {
                token.confidence = Math.min(1, token.confidence + 0.1);
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error enriching memecoin data with Helius:', error);
    }
  }

  /**
   * Update profitability scores based on price change and trade history
   */
  private updateProfitabilityScores(memecoinData: Record<string, MemeTokenPrice>): void {
    try {
      for (const symbol in memecoinData) {
        const token = memecoinData[symbol];
        
        // Base score on price change (0-100 scale)
        let score = 0;
        
        // Weight 24h price change (up to 40 points)
        score += Math.min(40, Math.max(0, token.priceChange24h * 4));
        
        // Weight volume as % of market cap (up to 30 points)
        if (token.marketCap && token.marketCap > 0 && token.volume24h) {
          const volumeToMarketCapRatio = token.volume24h / token.marketCap;
          score += Math.min(30, volumeToMarketCapRatio * 100);
        } else if (token.volume24h) {
          // Fallback if no market cap
          score += Math.min(15, Math.log(token.volume24h) * 2);
        }
        
        // Weight confidence (up to 20 points)
        score += token.confidence * 20;
        
        // Add bonus for recent profit (up to 10 points)
        if (token.lastTradeProfit && token.lastTradeProfit > 0) {
          score += Math.min(10, token.lastTradeProfit * 5);
        }
        
        // Normalize to 0-100
        token.profitabilityScore = Math.min(100, Math.max(0, score));
      }
    } catch (error) {
      console.error('Error updating profitability scores:', error);
    }
  }

  /**
   * Get the top profitable memecoins
   */
  public getTopProfitable(limit: number = 20): MemeTokenPrice[] {
    return this.memecoinCache.topProfitable.slice(0, limit);
  }

  /**
   * Get the top gaining memecoins
   */
  public getTopGainers(limit: number = 20): MemeTokenPrice[] {
    return this.memecoinCache.topGainers.slice(0, limit);
  }

  /**
   * Get all memecoin data
   */
  public getAllMemecoinData(): MemecoinCache {
    return this.memecoinCache;
  }

  /**
   * Get price data for a specific memecoin
   */
  public getMemecoinPrice(symbol: string): MemeTokenPrice | null {
    return this.memecoinCache.all[symbol] || null;
  }

  /**
   * Check if the distributor is running
   */
  public isInitialized(): boolean {
    return this.isRunning;
  }

  /**
   * Force update the memecoin data
   */
  public async forceUpdate(): Promise<void> {
    await this.updateMemecoinData();
  }

  /**
   * Stop the distributor
   */
  public stop(): void {
    if (this.memecoinUpdateInterval) {
      clearInterval(this.memecoinUpdateInterval);
      this.memecoinUpdateInterval = null;
    }
    this.isRunning = false;
  }
}

// Create singleton instance
export const memecoinPriceDistributor = MemecoinPriceDistributor.getInstance();

/**
 * Initialize the memecoin price distributor
 */
export async function initMemecoinPriceDistributor(): Promise<boolean> {
  try {
    if (!memecoinPriceDistributor.isInitialized()) {
      // Wait for initialization
      await new Promise<void>((resolve) => {
        memecoinPriceDistributor.once('initialized', () => {
          resolve();
        });
        
        // Force a timeout after 10 seconds
        setTimeout(() => {
          resolve();
        }, 10000);
      });
    }
    
    return memecoinPriceDistributor.isInitialized();
  } catch (error) {
    console.error('Error initializing memecoin price distributor:', error);
    return false;
  }
}