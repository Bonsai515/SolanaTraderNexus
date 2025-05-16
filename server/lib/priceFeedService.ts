/**
 * Enhanced Price Feed Integration Service
 * 
 * This service integrates multiple price data sources:
 * - GMGN.ai
 * - Pump.fun
 * - DexScreener
 * - Moonshot
 * - Proton
 * - Birdeye
 * - Geyser
 * 
 * It provides neural-weighted price aggregation and real-time 
 * updates for trading strategies.
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { EventEmitter } from 'events';
import geyserService from './geyserService';

// Load configuration
const CONFIG_DIR = './server/config';
const priceFeedConfig = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'price-feeds.json'), 'utf8'));

class PriceFeedService extends EventEmitter {
  private priceCache: Map<string, any> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private rateLimiters: Map<string, { lastRequest: number, queue: any[] }> = new Map();
  private isInitialized = false;
  
  constructor() {
    super();
    this.initialize();
  }
  
  /**
   * Initialize the price feed service
   */
  private async initialize(): Promise<void> {
    console.log('[PriceFeed] Initializing enhanced price feed service...');
    
    try {
      // Initialize rate limiters
      Object.entries(priceFeedConfig.rateLimits).forEach(([source, config]: [string, any]) => {
        this.rateLimiters.set(source, {
          lastRequest: 0,
          queue: []
        });
      });
      
      // Initialize with first data pull
      await this.updateAllPriceFeeds();
      
      // Set up recurring updates
      priceFeedConfig.enabledFeeds.forEach((feed: string) => {
        if (feed !== 'geyser') { // Geyser uses WebSocket, not polling
          const interval = setInterval(() => {
            this.updatePriceFeed(feed).catch(err => {
              console.error(`[PriceFeed] Error updating ${feed}:`, err);
            });
          }, priceFeedConfig.updateInterval);
          
          this.updateIntervals.set(feed, interval);
        }
      });
      
      // Connect to Geyser events if enabled
      if (priceFeedConfig.enabledFeeds.includes('geyser')) {
        geyserService.on('account_update', (data) => {
          this.handleGeyserUpdate(data);
        });
        
        geyserService.on('program_transaction', (data) => {
          this.handleGeyserTransaction(data);
        });
      }
      
      this.isInitialized = true;
      console.log('[PriceFeed] Enhanced price feed service initialized successfully');
      
      // Emit initialization event
      this.emit('initialized');
    } catch (error) {
      console.error('[PriceFeed] Initialization error:', error);
      throw error;
    }
  }
  
  /**
   * Update all price feeds at once
   */
  private async updateAllPriceFeeds(): Promise<void> {
    console.log('[PriceFeed] Updating all price feeds...');
    
    const updatePromises = priceFeedConfig.enabledFeeds
      .filter(feed => feed !== 'geyser') // Geyser uses WebSocket, not polling
      .map(feed => this.updatePriceFeed(feed));
    
    await Promise.allSettled(updatePromises);
    
    // Run aggregation after all feeds are updated
    this.aggregatePrices();
    
    console.log('[PriceFeed] All price feeds updated');
  }
  
  /**
   * Update a specific price feed
   */
  private async updatePriceFeed(feed: string): Promise<void> {
    try {
      // Get endpoint URL
      const endpoint = priceFeedConfig.endpoints[feed];
      if (!endpoint) {
        throw new Error(`No endpoint configured for feed: ${feed}`);
      }
      
      // Apply rate limiting
      await this.applyRateLimit(feed);
      
      // Make API request
      const response = await axios.get(endpoint, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Solana-Trading-Bot/1.0.0'
        }
      });
      
      // Process response based on feed type
      const processedData = this.processResponse(feed, response.data);
      
      // Update cache
      this.priceCache.set(feed, {
        data: processedData,
        timestamp: new Date().toISOString(),
        source: feed
      });
      
      // Emit update event
      this.emit('price_update', {
        source: feed,
        data: processedData
      });
      
    } catch (error) {
      console.error(`[PriceFeed] Error updating ${feed}:`, error);
      
      // Retry logic
      if (priceFeedConfig.retryAttempts > 0) {
        console.log(`[PriceFeed] Retrying ${feed} update in ${priceFeedConfig.retryDelay}ms`);
        
        setTimeout(() => {
          this.updatePriceFeed(feed);
        }, priceFeedConfig.retryDelay);
      }
    }
  }
  
  /**
   * Apply rate limiting for API requests
   */
  private applyRateLimit(feed: string): Promise<void> {
    return new Promise((resolve) => {
      const limiter = this.rateLimiters.get(feed);
      if (!limiter) {
        resolve();
        return;
      }
      
      const config = priceFeedConfig.rateLimits[feed];
      const requestsPerMinute = config.requestsPerMinute;
      const minInterval = 60000 / requestsPerMinute; // ms between requests
      
      const now = Date.now();
      const timeElapsed = now - limiter.lastRequest;
      
      if (timeElapsed >= minInterval) {
        // Can make request immediately
        limiter.lastRequest = now;
        resolve();
      } else {
        // Need to wait
        const delay = minInterval - timeElapsed;
        setTimeout(() => {
          limiter.lastRequest = Date.now();
          resolve();
        }, delay);
      }
    });
  }
  
  /**
   * Process API response based on feed type
   */
  private processResponse(feed: string, data: any): any {
    switch (feed) {
      case 'gmgn':
        return this.processGMGNResponse(data);
      case 'pumpfun':
        return this.processPumpFunResponse(data);
      case 'dexscreener':
        return this.processDexScreenerResponse(data);
      case 'moonshot':
        return this.processMoonshotResponse(data);
      case 'proton':
        return this.processProtonResponse(data);
      case 'birdeye':
        return this.processBirdeyeResponse(data);
      default:
        return data;
    }
  }
  
  /**
   * Process GMGN.ai API response
   */
  private processGMGNResponse(data: any): any {
    // Implementation specific to GMGN.ai response format
    // Extract relevant price, volume, and sentiment data
    try {
      const processed = {
        timestamp: new Date().toISOString(),
        tokens: {}
      };
      
      // Process token data
      if (data.tokens && Array.isArray(data.tokens)) {
        data.tokens.forEach(token => {
          processed.tokens[token.symbol] = {
            price: token.price,
            priceChange24h: token.priceChange24h,
            volume24h: token.volume24h,
            marketCap: token.marketCap,
            sentiment: token.sentiment,
            socialScore: token.socialScore
          };
        });
      }
      
      return processed;
    } catch (error) {
      console.error('[PriceFeed] Error processing GMGN response:', error);
      return data; // Return original data on error
    }
  }
  
  /**
   * Process Pump.fun API response
   */
  private processPumpFunResponse(data: any): any {
    // Implementation specific to Pump.fun response format
    try {
      const processed = {
        timestamp: new Date().toISOString(),
        tokens: {}
      };
      
      // Process meme token data
      if (data.memes && Array.isArray(data.memes)) {
        data.memes.forEach(meme => {
          processed.tokens[meme.symbol] = {
            price: meme.price,
            priceChange1h: meme.priceChange1h,
            priceChange24h: meme.priceChange24h,
            volume24h: meme.volume24h,
            liquidity: meme.liquidity,
            marketCap: meme.marketCap,
            trending: meme.trendingRank,
            holders: meme.holderCount
          };
        });
      }
      
      return processed;
    } catch (error) {
      console.error('[PriceFeed] Error processing Pump.fun response:', error);
      return data;
    }
  }
  
  /**
   * Process DexScreener API response
   */
  private processDexScreenerResponse(data: any): any {
    // Implementation specific to DexScreener response format
    try {
      const processed = {
        timestamp: new Date().toISOString(),
        tokens: {}
      };
      
      // Process pairs data
      if (data.pairs && Array.isArray(data.pairs)) {
        data.pairs.forEach(pair => {
          const baseToken = pair.baseToken.symbol;
          
          processed.tokens[baseToken] = {
            price: pair.priceUsd,
            priceChange24h: pair.priceChange.h24,
            volume24h: pair.volume.h24,
            liquidity: pair.liquidity.usd,
            fdv: pair.fdv
          };
        });
      }
      
      return processed;
    } catch (error) {
      console.error('[PriceFeed] Error processing DexScreener response:', error);
      return data;
    }
  }
  
  /**
   * Process Moonshot API response
   */
  private processMoonshotResponse(data: any): any {
    // Implementation specific to Moonshot response format
    try {
      const processed = {
        timestamp: new Date().toISOString(),
        tokens: {}
      };
      
      // Process trending tokens
      if (data.tokens && Array.isArray(data.tokens)) {
        data.tokens.forEach(token => {
          processed.tokens[token.symbol] = {
            price: token.price,
            priceChange1h: token.priceChange1h,
            priceChange24h: token.priceChange24h,
            volume24h: token.volume24h,
            trendingScore: token.trendingScore,
            socialVolume: token.socialVolume
          };
        });
      }
      
      return processed;
    } catch (error) {
      console.error('[PriceFeed] Error processing Moonshot response:', error);
      return data;
    }
  }
  
  /**
   * Process Proton API response
   */
  private processProtonResponse(data: any): any {
    // Implementation specific to Proton response format
    try {
      const processed = {
        timestamp: new Date().toISOString(),
        tokens: {}
      };
      
      // Process token data
      if (data.tokens && Array.isArray(data.tokens)) {
        data.tokens.forEach(token => {
          processed.tokens[token.symbol] = {
            price: token.price,
            priceChange24h: token.priceChange24h,
            volume24h: token.volume24h,
            marketCap: token.marketCap,
            liquidityUsd: token.liquidity
          };
        });
      }
      
      return processed;
    } catch (error) {
      console.error('[PriceFeed] Error processing Proton response:', error);
      return data;
    }
  }
  
  /**
   * Process Birdeye API response
   */
  private processBirdeyeResponse(data: any): any {
    // Implementation specific to Birdeye response format
    try {
      const processed = {
        timestamp: new Date().toISOString(),
        tokens: {}
      };
      
      // Process token list
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach(token => {
          processed.tokens[token.symbol] = {
            price: token.price,
            priceChange24h: token.priceChange24h,
            volume24h: token.volume24h,
            marketCap: token.marketCap,
            fdv: token.fdv,
            liquidityUsd: token.liquidity
          };
        });
      }
      
      return processed;
    } catch (error) {
      console.error('[PriceFeed] Error processing Birdeye response:', error);
      return data;
    }
  }
  
  /**
   * Handle real-time Geyser account updates
   */
  private handleGeyserUpdate(data: any): void {
    // Implementation for real-time account updates from Geyser
    // This provides microsecond-level price and liquidity updates
    
    // For now, emit the update for strategies to use
    this.emit('realtime_update', {
      source: 'geyser',
      type: 'account_update',
      data: data
    });
  }
  
  /**
   * Handle real-time Geyser transactions
   */
  private handleGeyserTransaction(data: any): void {
    // Implementation for real-time transaction data from Geyser
    // This provides information about trades happening on DEXes
    
    // For now, emit the transaction for strategies to use
    this.emit('realtime_update', {
      source: 'geyser',
      type: 'transaction',
      data: data
    });
  }
  
  /**
   * Aggregate prices from all sources using neural weighted algorithm
   */
  private aggregatePrices(): void {
    if (!priceFeedConfig.aggregation.enabled) {
      return;
    }
    
    console.log('[PriceFeed] Aggregating prices from all sources...');
    
    try {
      const aggregated = {
        timestamp: new Date().toISOString(),
        tokens: {}
      };
      
      // Get token list from config
      const tokens = [...priceFeedConfig.tokens.memeTokens.map(t => t.symbol), 
                      ...priceFeedConfig.tokens.tradingPairs.map(p => p.split('/')[0])];
      
      // Deduplicate tokens
      const uniqueTokens = [...new Set(tokens)];
      
      // Aggregate each token's price data
      uniqueTokens.forEach(token => {
        const tokenData = this.aggregateTokenData(token);
        if (tokenData) {
          aggregated.tokens[token] = tokenData;
        }
      });
      
      // Cache aggregated results
      this.priceCache.set('aggregated', aggregated);
      
      // Emit aggregation event
      this.emit('aggregated_update', aggregated);
      
      console.log(`[PriceFeed] Price aggregation complete for ${Object.keys(aggregated.tokens).length} tokens`);
    } catch (error) {
      console.error('[PriceFeed] Error during price aggregation:', error);
    }
  }
  
  /**
   * Aggregate data for a specific token
   */
  private aggregateTokenData(token: string): any {
    const sourceWeights = priceFeedConfig.aggregation.sources;
    const values: Array<{ source: string, value: number, weight: number }> = [];
    
    // Collect values from all sources
    priceFeedConfig.enabledFeeds.forEach(feed => {
      if (feed === 'geyser') return; // Geyser doesn't provide direct price data
      
      const sourceData = this.priceCache.get(feed);
      if (!sourceData || !sourceData.data || !sourceData.data.tokens) return;
      
      const tokenData = sourceData.data.tokens[token];
      if (!tokenData || tokenData.price === undefined) return;
      
      const weight = sourceWeights[feed]?.weight || 0.5;
      values.push({ source: feed, value: tokenData.price, weight });
    });
    
    // If no values found, return null
    if (values.length === 0) return null;
    
    // If only one source, use its value
    if (values.length === 1) {
      return {
        price: values[0].value,
        confidence: 1.0,
        sources: [values[0].source]
      };
    }
    
    // Apply neural weighting algorithm for multiple sources
    // Sort values to check for outliers
    values.sort((a, b) => a.value - b.value);
    
    // If outlier rejection is enabled, remove outliers
    if (priceFeedConfig.aggregation.outlierRejection && values.length > 2) {
      // Calculate median
      const median = values[Math.floor(values.length / 2)].value;
      
      // Filter out values that are too far from median
      const filteredValues = values.filter(({ value }) => {
        const percentDiff = Math.abs(value - median) / median;
        return percentDiff <= 0.2; // 20% threshold
      });
      
      // Use filtered values if we still have enough
      if (filteredValues.length >= 2) {
        values.length = 0; // Clear array
        values.push(...filteredValues);
      }
    }
    
    // Apply weighted average
    let weightSum = 0;
    let weightedSum = 0;
    
    values.forEach(({ value, weight }) => {
      weightedSum += value * weight;
      weightSum += weight;
    });
    
    const aggregatedPrice = weightSum > 0 ? weightedSum / weightSum : values[0].value;
    
    // Calculate confidence score based on variance
    let variance = 0;
    values.forEach(({ value }) => {
      variance += Math.pow(value - aggregatedPrice, 2);
    });
    variance /= values.length;
    
    // Convert variance to confidence score (higher variance = lower confidence)
    const confidenceScore = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / aggregatedPrice));
    
    return {
      price: aggregatedPrice,
      confidence: confidenceScore,
      sources: values.map(v => v.source),
      sourcesCount: values.length
    };
  }
  
  /**
   * Get price for a specific token
   */
  public getPrice(token: string): any {
    // Try aggregated price first
    const aggregated = this.priceCache.get('aggregated');
    if (aggregated && aggregated.tokens && aggregated.tokens[token]) {
      return {
        price: aggregated.tokens[token].price,
        source: 'aggregated',
        confidence: aggregated.tokens[token].confidence,
        timestamp: aggregated.timestamp
      };
    }
    
    // If no aggregated price, look for any source
    for (const feed of priceFeedConfig.enabledFeeds) {
      if (feed === 'geyser') continue; // Geyser doesn't provide direct price data
      
      const sourceData = this.priceCache.get(feed);
      if (!sourceData || !sourceData.data || !sourceData.data.tokens) continue;
      
      const tokenData = sourceData.data.tokens[token];
      if (!tokenData || tokenData.price === undefined) continue;
      
      return {
        price: tokenData.price,
        source: feed,
        confidence: 0.7, // Lower confidence for single source
        timestamp: sourceData.timestamp
      };
    }
    
    // No price found
    return null;
  }
  
  /**
   * Get all price data for a token from all sources
   */
  public getAllPriceData(token: string): any {
    const result = {
      token,
      sources: {},
      aggregated: null
    };
    
    // Get data from all individual sources
    priceFeedConfig.enabledFeeds.forEach(feed => {
      if (feed === 'geyser') return; // Geyser doesn't provide direct price data
      
      const sourceData = this.priceCache.get(feed);
      if (!sourceData || !sourceData.data || !sourceData.data.tokens) return;
      
      const tokenData = sourceData.data.tokens[token];
      if (!tokenData) return;
      
      result.sources[feed] = {
        ...tokenData,
        timestamp: sourceData.timestamp
      };
    });
    
    // Get aggregated data
    const aggregated = this.priceCache.get('aggregated');
    if (aggregated && aggregated.tokens && aggregated.tokens[token]) {
      result.aggregated = {
        ...aggregated.tokens[token],
        timestamp: aggregated.timestamp
      };
    }
    
    return result;
  }
  
  /**
   * Get all cached price data
   */
  public getAllPriceCache(): any {
    const result = {};
    
    this.priceCache.forEach((value, key) => {
      result[key] = value;
    });
    
    return result;
  }
  
  /**
   * Get initialized status
   */
  public isReady(): boolean {
    return this.isInitialized;
  }
  
  /**
   * Stop the price feed service
   */
  public stop(): void {
    // Clear all update intervals
    this.updateIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.updateIntervals.clear();
    
    // Clear cache
    this.priceCache.clear();
    
    this.isInitialized = false;
    
    console.log('[PriceFeed] Enhanced price feed service stopped');
  }
}

// Create singleton instance
const priceFeedService = new PriceFeedService();

// Export the service
export default priceFeedService;
