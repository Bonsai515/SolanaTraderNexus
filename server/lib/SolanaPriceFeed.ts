/**
 * Solana Price Feed
 * 
 * This module provides real-time and historical price data for Solana tokens
 * with fallback mechanisms for resilience and reliability. It integrates with
 * multiple data sources to ensure continuity.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../logger';
import { getSolanaConnection } from './ensureRpcConnection';

/**
 * Price Difference interface for arbitrage detection
 */
interface PriceDifference {
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  buyDexFee: number;
  sellDexFee: number;
}

/**
 * Token Data interface
 */
interface TokenData {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  priceUsd?: number;
  volume24h?: number;
  liquidity?: number;
  marketCap?: number;
  priceChangePercent24h?: number;
}

/**
 * Solana Price Feed provides real-time and cached price data
 * from multiple sources with fallback mechanisms
 */
export class SolanaPriceFeed {
  private connection: Connection;
  private updateInterval: number; // milliseconds
  private cache: Map<string, TokenData>; // address -> data
  private priceUpdateTimers: Map<string, NodeJS.Timeout>;
  private fallbackSources: string[]; // Fallback API sources
  private lastSuccessfulSource: string | null = null;
  
  /**
   * Initialize SolanaPriceFeed
   * @param updateInterval Update interval in milliseconds
   */
  constructor(updateInterval: number = 1000) {
    this.connection = getSolanaConnection();
    this.updateInterval = updateInterval;
    this.cache = new Map<string, TokenData>();
    this.priceUpdateTimers = new Map<string, NodeJS.Timeout>();
    
    // Fallback sources
    this.fallbackSources = [
      'coingecko',
      'birdeye',
      'jupiter',
      'dexscreener',
      'openbook'
    ];
    
    // Start initialization
    this.initialize();
  }
  
  /**
   * Initialize price feed and load top tokens
   */
  private async initialize(): Promise<void> {
    try {
      logger.info('Initializing Solana price feed...');
      
      // Load top tokens
      await this.loadTopTokens();
      
      // Start automatic updates
      this.startAutomaticUpdates();
      
      logger.info('Solana price feed initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Solana price feed:', error);
    }
  }
  
  /**
   * Load top tokens by market cap and volume
   */
  private async loadTopTokens(): Promise<void> {
    try {
      // In a real implementation, load from CoinGecko, Jupiter, etc.
      const tokens = await this.fetchTokenListFromSource();
      
      // Add to cache
      for (const token of tokens) {
        this.cache.set(token.address, token);
      }
      
      logger.info(`Loaded ${tokens.length} tokens into price feed cache`);
    } catch (error) {
      logger.error('Failed to load top tokens:', error);
    }
  }
  
  /**
   * Start automatic price updates
   */
  private startAutomaticUpdates(): void {
    // Update prices for cached tokens
    for (const tokenAddress of this.cache.keys()) {
      this.startTokenPriceUpdates(tokenAddress);
    }
  }
  
  /**
   * Start price updates for a specific token
   */
  private startTokenPriceUpdates(tokenAddress: string): void {
    // Clear existing timer if any
    if (this.priceUpdateTimers.has(tokenAddress)) {
      clearInterval(this.priceUpdateTimers.get(tokenAddress)!);
    }
    
    // Set up new timer
    const timer = setInterval(async () => {
      try {
        await this.updateTokenPrice(tokenAddress);
      } catch (error) {
        logger.error(`Failed to update price for ${tokenAddress}:`, error);
      }
    }, this.updateInterval);
    
    this.priceUpdateTimers.set(tokenAddress, timer);
  }
  
  /**
   * Update price for a specific token
   */
  private async updateTokenPrice(tokenAddress: string): Promise<void> {
    try {
      // Try primary source first
      let price = await this.fetchPriceFromSource(tokenAddress, this.fallbackSources[0]);
      
      // If primary source fails, try fallbacks
      if (price === null) {
        for (const source of this.fallbackSources.slice(1)) {
          price = await this.fetchPriceFromSource(tokenAddress, source);
          if (price !== null) {
            this.lastSuccessfulSource = source;
            break;
          }
        }
      } else {
        this.lastSuccessfulSource = this.fallbackSources[0];
      }
      
      // Update cache if we got a price
      if (price !== null && this.cache.has(tokenAddress)) {
        const token = this.cache.get(tokenAddress)!;
        token.priceUsd = price;
        this.cache.set(tokenAddress, token);
      }
    } catch (error) {
      logger.error(`Failed to update price for ${tokenAddress}:`, error);
    }
  }
  
  /**
   * Fetch token list from source
   */
  private async fetchTokenListFromSource(source: string = 'coingecko'): Promise<TokenData[]> {
    try {
      // In a real implementation, this would make API calls
      // This is a stub implementation for testing
      
      return [
        {
          address: 'So11111111111111111111111111111111111111112',
          symbol: 'SOL',
          name: 'Solana',
          decimals: 9,
          priceUsd: 164.53,
          volume24h: 1245000000,
          liquidity: 5670000000,
          marketCap: 84500000000,
          priceChangePercent24h: 2.34,
        },
        {
          address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          priceUsd: 1.00,
          volume24h: 892000000,
          liquidity: 3340000000,
          marketCap: 32600000000,
          priceChangePercent24h: 0.02,
        },
        {
          address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
          symbol: 'mSOL',
          name: 'Marinade Staked SOL',
          decimals: 9,
          priceUsd: 172.94,
          volume24h: 45600000,
          liquidity: 789000000,
          marketCap: 1340000000,
          priceChangePercent24h: 2.52,
        },
        {
          address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
          symbol: 'BONK',
          name: 'Bonk',
          decimals: 5,
          priceUsd: 0.000052,
          volume24h: 78900000,
          liquidity: 456000000,
          marketCap: 890000000,
          priceChangePercent24h: -3.45,
        },
        {
          address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZXDS1j9s',
          symbol: 'JUP',
          name: 'Jupiter',
          decimals: 6,
          priceUsd: 1.93,
          volume24h: 31800000,
          liquidity: 312000000,
          marketCap: 540000000,
          priceChangePercent24h: 7.24,
        },
      ];
    } catch (error) {
      logger.error(`Failed to fetch token list from ${source}:`, error);
      return [];
    }
  }
  
  /**
   * Fetch price from a specific source
   */
  private async fetchPriceFromSource(tokenAddress: string, source: string): Promise<number | null> {
    try {
      // In a real implementation, this would make API calls
      // This is a stub implementation for testing
      
      // Simulate occasional API failures
      if (Math.random() < 0.05) {
        logger.warn(`API failure detected for ${source} when fetching price for ${tokenAddress}`);
        return null;
      }
      
      const token = this.cache.get(tokenAddress);
      if (!token) return null;
      
      // Add slight price variation to simulate real-time changes
      const variation = (Math.random() - 0.5) * 0.01; // +/- 0.5%
      return token.priceUsd ? token.priceUsd * (1 + variation) : null;
    } catch (error) {
      logger.error(`Failed to fetch price from ${source} for ${tokenAddress}:`, error);
      return null;
    }
  }
  
  /**
   * Get current price of a token
   */
  public getPrice(tokenAddress: string): number | null {
    const token = this.cache.get(tokenAddress);
    return token?.priceUsd || null;
  }
  
  /**
   * Get top tokens by liquidity
   */
  public getTopTokensByLiquidity(limit: number): string[] {
    const tokens = Array.from(this.cache.values())
      .filter(token => token.liquidity !== undefined)
      .sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0))
      .slice(0, limit);
    
    return tokens.map(token => token.address);
  }
  
  /**
   * Get top tokens by volume
   */
  public getTopTokensByVolume(limit: number): string[] {
    const tokens = Array.from(this.cache.values())
      .filter(token => token.volume24h !== undefined)
      .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
      .slice(0, limit);
    
    return tokens.map(token => token.address);
  }
  
  /**
   * Get price differences across DEXes for a token
   */
  public getPriceDifferencesForToken(tokenAddress: string): PriceDifference[] {
    try {
      // In a real implementation, this would compare prices across multiple DEXes
      // This is a stub implementation for testing
      
      const basePrice = this.getPrice(tokenAddress);
      if (!basePrice) return [];
      
      // Simulate price differences on different DEXes
      const dexes = [
        { name: 'jupiter', fee: 0.0003 },
        { name: 'raydium', fee: 0.0005 },
        { name: 'orca', fee: 0.0003 },
        { name: 'openbook', fee: 0.0004 },
        { name: 'meteora', fee: 0.0004 }
      ];
      
      const differences: PriceDifference[] = [];
      
      // Generate some realistic DEX price variations
      for (let i = 0; i < dexes.length; i++) {
        for (let j = 0; j < dexes.length; j++) {
          if (i === j) continue;
          
          // Generate realistic price difference (0-0.8%)
          const priceDiff = Math.random() * 0.008;
          
          // Only include if potentially profitable
          if (priceDiff > (dexes[i].fee + dexes[j].fee)) {
            differences.push({
              buyDex: dexes[i].name,
              sellDex: dexes[j].name,
              buyPrice: basePrice,
              sellPrice: basePrice * (1 + priceDiff),
              buyDexFee: dexes[i].fee,
              sellDexFee: dexes[j].fee
            });
          }
        }
      }
      
      // Sort by potential profit
      differences.sort((a, b) => {
        const profitA = a.sellPrice * (1 - a.sellDexFee) - a.buyPrice * (1 + a.buyDexFee);
        const profitB = b.sellPrice * (1 - b.sellDexFee) - b.buyPrice * (1 + b.buyDexFee);
        return profitB - profitA;
      });
      
      return differences;
    } catch (error) {
      logger.error(`Failed to get price differences for ${tokenAddress}:`, error);
      return [];
    }
  }
  
  /**
   * Get historical prices for a token
   */
  public getHistoricalPrices(tokenAddress: string, timeframeHours: number): number[] {
    try {
      // In a real implementation, this would fetch historical data
      // This is a stub implementation for testing
      
      const currentPrice = this.getPrice(tokenAddress) || 1;
      const prices: number[] = [];
      
      // Generate realistic historical prices
      for (let i = 0; i < timeframeHours; i++) {
        // More volatility for longer timeframes
        const volatility = 0.001 * Math.sqrt(i + 1);
        const randomWalk = (Math.random() - 0.5) * volatility;
        prices.push(currentPrice * (1 - (i * 0.001) + randomWalk));
      }
      
      return prices.reverse(); // Most recent last
    } catch (error) {
      logger.error(`Failed to get historical prices for ${tokenAddress}:`, error);
      return [];
    }
  }
}