/**
 * Solana Price Feed System
 * 
 * TypeScript implementation of the Rust SolanaPriceFeed with additional
 * functionality for the trading system. This implements a multi-source
 * price aggregation system with fallback capabilities.
 */

import { logger } from '../logger';
import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';
import { getConnection } from './solanaConnection';

// Types of price sources
export enum PriceSourceType {
  ON_CHAIN = 'ON_CHAIN',
  ORACLE = 'ORACLE',
  CENTRALIZED_EXCHANGE = 'CENTRALIZED_EXCHANGE',
  API = 'API'
}

// Price source configuration
export interface PriceSource {
  type: PriceSourceType;
  names: string[];
  priority: number; // Lower number = higher priority
  enabled: boolean;
}

// Price data with metadata
export interface PriceData {
  price: number;
  timestamp: number;
  source: string;
  confidence: number; // 0-1 scale
}

// Cache entry type
type PriceCacheEntry = {
  price: number;
  timestamp: number;
  source: string;
  confidence: number;
};

/**
 * Implementation of SolanaPriceFeed
 * Aggregates price data from multiple sources with fallback
 */
export class SolanaPriceFeed {
  private priceCache: Map<string, PriceCacheEntry> = new Map();
  private readonly updateInterval: number; // in milliseconds
  private sources: PriceSource[] = [];
  private lastUpdate: number = 0;
  private connection: Connection;
  
  /**
   * Create a new SolanaPriceFeed instance
   * @param updateInterval Update interval in milliseconds
   */
  constructor(updateInterval: number = 60000) { // Default 1 minute
    this.updateInterval = updateInterval;
    
    try {
      // Get Solana connection
      this.connection = getConnection();
      
      // Add default sources
      this.addSource({
        type: PriceSourceType.ON_CHAIN,
        names: ['jupiter', 'raydium', 'orca'],
        priority: 1,
        enabled: true
      });
      
      this.addSource({
        type: PriceSourceType.ORACLE,
        names: ['pyth', 'switchboard'],
        priority: 2,
        enabled: true
      });
      
      this.addSource({
        type: PriceSourceType.CENTRALIZED_EXCHANGE,
        names: ['binance', 'coinbase'],
        priority: 3,
        enabled: true
      });
      
      this.addSource({
        type: PriceSourceType.API,
        names: ['coingecko', 'coinmarketcap'],
        priority: 4,
        enabled: true
      });
      
      logger.info(`SolanaPriceFeed initialized with ${this.sources.length} sources`);
      
    } catch (error) {
      logger.error('Error initializing SolanaPriceFeed:', error);
    }
  }
  
  /**
   * Add a price source
   * @param source Price source configuration
   */
  public addSource(source: PriceSource): void {
    this.sources.push(source);
    this.sources.sort((a, b) => a.priority - b.priority); // Sort by priority
    logger.debug(`Added price source: ${source.type} (${source.names.join(', ')})`);
  }
  
  /**
   * Enable or disable a source
   * @param sourceType Type of the source
   * @param enabled Whether the source should be enabled
   */
  public setSourceEnabled(sourceType: PriceSourceType, enabled: boolean): void {
    for (const source of this.sources) {
      if (source.type === sourceType) {
        source.enabled = enabled;
        logger.info(`${enabled ? 'Enabled' : 'Disabled'} price source: ${sourceType}`);
      }
    }
  }
  
  /**
   * Get price for a token
   * @param tokenAddress Token mint address or symbol
   * @returns The price or throws error if not available
   */
  public async getPrice(tokenAddress: string): Promise<number> {
    await this.updateIfNeeded();
    
    const cacheEntry = this.priceCache.get(tokenAddress);
    if (cacheEntry) {
      return cacheEntry.price;
    }
    
    throw new Error(`Price not available for token: ${tokenAddress}`);
  }
  
  /**
   * Get detailed price data
   * @param tokenAddress Token mint address or symbol
   * @returns Detailed price data
   */
  public async getPriceData(tokenAddress: string): Promise<PriceData> {
    await this.updateIfNeeded();
    
    const cacheEntry = this.priceCache.get(tokenAddress);
    if (cacheEntry) {
      return {
        price: cacheEntry.price,
        timestamp: cacheEntry.timestamp,
        source: cacheEntry.source,
        confidence: cacheEntry.confidence
      };
    }
    
    throw new Error(`Price data not available for token: ${tokenAddress}`);
  }
  
  /**
   * Get multiple prices at once
   * @param tokenAddresses Array of token addresses
   * @returns Map of token addresses to prices
   */
  public async getPrices(tokenAddresses: string[]): Promise<Map<string, number>> {
    await this.updateIfNeeded();
    
    const result = new Map<string, number>();
    for (const address of tokenAddresses) {
      const entry = this.priceCache.get(address);
      if (entry) {
        result.set(address, entry.price);
      }
    }
    
    return result;
  }
  
  /**
   * Update prices if needed based on update interval
   */
  private async updateIfNeeded(): Promise<void> {
    const currentTime = Date.now();
    
    if (currentTime - this.lastUpdate >= this.updateInterval) {
      await this.updatePrices();
      this.lastUpdate = currentTime;
    }
  }
  
  /**
   * Update all prices from configured sources
   */
  private async updatePrices(): Promise<void> {
    logger.debug('Updating token prices from all sources');
    
    try {
      // Tokens to update - in production this would be a configurable list
      // or pulled from a registry
      const tokensToUpdate = [
        'SOL', // Solana
        'BTC', // Bitcoin (wrapped)
        'ETH', // Ethereum (wrapped)
        'BONK', // Bonk
        'JUP', // Jupiter
        'USDC', // USD Coin
        'RAY', // Raydium
        'MNDE', // Marinade
        'WIF', // Dogwifhat
        'GUAC' // Guacamole
      ];
      
      // Update each token from available sources
      for (const token of tokensToUpdate) {
        await this.updatePriceForToken(token);
      }
      
      logger.debug(`Updated prices for ${tokensToUpdate.length} tokens`);
    } catch (error) {
      logger.error('Error updating prices:', error);
    }
  }
  
  /**
   * Update price for a specific token
   * @param token Token to update (address or symbol)
   */
  private async updatePriceForToken(token: string): Promise<void> {
    // Array to collect price data from all sources
    const prices: PriceData[] = [];
    
    // Try each source in priority order
    for (const source of this.sources) {
      if (!source.enabled) continue;
      
      try {
        const priceData = await this.fetchPriceFromSource(token, source);
        if (priceData) {
          prices.push(priceData);
        }
      } catch (error) {
        logger.warn(`Error fetching price for ${token} from ${source.type}:`, error);
      }
    }
    
    // If we got prices, aggregate them
    if (prices.length > 0) {
      const aggregatedPrice = this.aggregatePrices(prices);
      
      // Update cache
      this.priceCache.set(token, {
        price: aggregatedPrice.price,
        timestamp: aggregatedPrice.timestamp,
        source: aggregatedPrice.source,
        confidence: aggregatedPrice.confidence
      });
      
      logger.debug(`Updated price for ${token}: $${aggregatedPrice.price} (source: ${aggregatedPrice.source})`);
    } else {
      logger.warn(`Failed to update price for ${token} - no valid sources`);
    }
  }
  
  /**
   * Fetch price from a specific source
   * @param token Token to fetch
   * @param source Source to use
   * @returns Price data if successful
   */
  private async fetchPriceFromSource(token: string, source: PriceSource): Promise<PriceData | null> {
    try {
      switch (source.type) {
        case PriceSourceType.ON_CHAIN:
          return await this.fetchOnChainPrice(token, source.names);
          
        case PriceSourceType.ORACLE:
          return await this.fetchOraclePrice(token, source.names);
          
        case PriceSourceType.CENTRALIZED_EXCHANGE:
          return await this.fetchCexPrice(token, source.names);
          
        case PriceSourceType.API:
          return await this.fetchApiPrice(token, source.names);
          
        default:
          logger.warn(`Unknown price source type: ${source.type}`);
          return null;
      }
    } catch (error) {
      logger.debug(`Error fetching price for ${token} from ${source.type}:`, error);
      return null;
    }
  }
  
  /**
   * Fetch price from on-chain sources (DEXes)
   */
  private async fetchOnChainPrice(token: string, dexes: string[]): Promise<PriceData | null> {
    // In production, this would make actual RPC calls to query DEX pools
    // For this prototype, we'll use static data for core tokens
    
    try {
      // This would be replaced with actual DEX API calls in production
      // Here we're simulating a price lookup based on token
      
      // Generate a realistic price based on token symbol
      let price = 0;
      let confidence = 0.95; // On-chain data is usually high confidence
      
      switch (token.toUpperCase()) {
        case 'SOL':
          price = 173.92 + (Math.random() * 4 - 2); // $172-176 range
          break;
        case 'BTC':
          price = 61500 + (Math.random() * 1000 - 500); // $61000-62000 range
          break;
        case 'ETH':
          price = 3050 + (Math.random() * 100 - 50); // $3000-3100 range
          break;
        case 'BONK':
          price = 0.00002332 + (Math.random() * 0.000002 - 0.000001); // Small price variation
          break;
        case 'JUP':
          price = 0.77 + (Math.random() * 0.04 - 0.02); // $0.75-0.79 range
          break;
        case 'USDC':
          price = 1.0 + (Math.random() * 0.001 - 0.0005); // Very stable near $1
          break;
        case 'RAY':
          price = 0.42 + (Math.random() * 0.02 - 0.01);
          break;
        case 'MNDE':
          price = 0.051 + (Math.random() * 0.005 - 0.0025);
          break;
        case 'WIF':
          price = 1.85 + (Math.random() * 0.1 - 0.05);
          break;
        case 'GUAC':
          price = 0.0012 + (Math.random() * 0.0001 - 0.00005);
          break;
        default:
          // Unknown token
          return null;
      }
      
      return {
        price,
        timestamp: Date.now(),
        source: `on-chain:${dexes[0]}`,
        confidence
      };
    } catch (error) {
      logger.warn(`Error fetching on-chain price for ${token}:`, error);
      return null;
    }
  }
  
  /**
   * Fetch price from Oracle sources (Pyth, Switchboard)
   */
  private async fetchOraclePrice(token: string, oracles: string[]): Promise<PriceData | null> {
    // In production, this would make oracle API calls
    // For this prototype, we'll derive values from our on-chain prices with slight variation
    
    try {
      // First get the on-chain price as baseline
      const onChainPrice = await this.fetchOnChainPrice(token, ['reference']);
      
      if (!onChainPrice) return null;
      
      // Add small variation to simulate price difference
      const variation = (Math.random() * 0.02 - 0.01); // ±1% variation
      const price = onChainPrice.price * (1 + variation);
      
      return {
        price,
        timestamp: Date.now(),
        source: `oracle:${oracles[0]}`,
        confidence: 0.98 // Oracles typically have highest confidence
      };
    } catch (error) {
      logger.warn(`Error fetching oracle price for ${token}:`, error);
      return null;
    }
  }
  
  /**
   * Fetch price from centralized exchanges
   */
  private async fetchCexPrice(token: string, exchanges: string[]): Promise<PriceData | null> {
    // In production, this would make API calls to CEX APIs
    // For this prototype, we'll derive values from our on-chain prices with variation
    
    try {
      // First get the on-chain price as baseline
      const onChainPrice = await this.fetchOnChainPrice(token, ['reference']);
      
      if (!onChainPrice) return null;
      
      // Add larger variation to simulate CEX price difference
      const variation = (Math.random() * 0.04 - 0.02); // ±2% variation
      const price = onChainPrice.price * (1 + variation);
      
      return {
        price,
        timestamp: Date.now(),
        source: `cex:${exchanges[0]}`,
        confidence: 0.92 // Slightly lower confidence than on-chain
      };
    } catch (error) {
      logger.warn(`Error fetching CEX price for ${token}:`, error);
      return null;
    }
  }
  
  /**
   * Fetch price from external APIs
   */
  private async fetchApiPrice(token: string, apis: string[]): Promise<PriceData | null> {
    // In production, this would make API calls to CoinGecko, CoinMarketCap, etc.
    // For this prototype, we'll derive values from our on-chain prices with larger variation
    
    try {
      // First get the on-chain price as baseline
      const onChainPrice = await this.fetchOnChainPrice(token, ['reference']);
      
      if (!onChainPrice) return null;
      
      // Add larger variation to simulate API price difference
      const variation = (Math.random() * 0.06 - 0.03); // ±3% variation
      const price = onChainPrice.price * (1 + variation);
      
      return {
        price,
        timestamp: Date.now(),
        source: `api:${apis[0]}`,
        confidence: 0.85 // Lower confidence for API data
      };
    } catch (error) {
      logger.warn(`Error fetching API price for ${token}:`, error);
      return null;
    }
  }
  
  /**
   * Aggregate prices from multiple sources
   * @param prices Array of price data from different sources
   * @returns Aggregated price data
   */
  private aggregatePrices(prices: PriceData[]): PriceData {
    // Sort by confidence
    prices.sort((a, b) => b.confidence - a.confidence);
    
    // If we only have one price, return it
    if (prices.length === 1) {
      return prices[0];
    }
    
    // For multiple prices, compute weighted average based on confidence
    let weightedSum = 0;
    let weightSum = 0;
    let highestConfidence = 0;
    let bestSource = '';
    
    for (const price of prices) {
      const weight = price.confidence;
      weightedSum += price.price * weight;
      weightSum += weight;
      
      if (price.confidence > highestConfidence) {
        highestConfidence = price.confidence;
        bestSource = price.source;
      }
    }
    
    // Calculate aggregated confidence (slightly lower than best source)
    const aggregatedConfidence = Math.min(0.99, highestConfidence * 1.05);
    
    return {
      price: weightedSum / weightSum,
      timestamp: Date.now(),
      source: `aggregated(${bestSource})`,
      confidence: aggregatedConfidence
    };
  }
  
  /**
   * Clear the price cache
   */
  public clearCache(): void {
    this.priceCache.clear();
    logger.debug('Price cache cleared');
  }
  
  /**
   * Force an immediate price update
   */
  public async forceUpdate(): Promise<void> {
    await this.updatePrices();
    this.lastUpdate = Date.now();
    logger.info('Price feed forcefully updated');
  }
  
  /**
   * Get the number of tokens in the cache
   */
  public getCacheSize(): number {
    return this.priceCache.size;
  }
  
  /**
   * Get all cached tokens and their prices
   */
  public getCachedPrices(): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const [token, data] of this.priceCache.entries()) {
      result[token] = data.price;
    }
    
    return result;
  }
}

// Export singleton instance
export const solanaPriceFeed = new SolanaPriceFeed();