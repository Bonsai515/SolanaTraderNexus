/**
 * Memecoin Global Cache System
 * 
 * Provides a centralized, system-wide cache for memecoin data from multiple sources
 * with data relationships and persistent storage
 */

import * as logger from '../logger';
import * as fs from 'fs';
import * as path from 'path';
import { MemeToken } from './memeTokenScanner';

// Define the complete token data structure with relationships
export interface TokenRelationship {
  address: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  priceChange1h?: number;
  volume24h: number;
  marketCap?: number;
  liquidity?: number;
  liquidityUSD?: number;
  liquiditySOL?: number;
  launchDate?: string;
  launchTimestamp?: number;
  isNew?: boolean;
  score?: number;
  holders?: number;
  totalSupply?: number;
  sources: {
    pumpFun?: boolean;
    dexScreener?: boolean;
    birdeye?: boolean;
    gmgn?: boolean;
    jupiter?: boolean;
  };
  socials?: {
    twitter?: string;
    website?: string;
    discord?: string;
    telegram?: string;
  };
  exchanges?: string[];
  pools?: {
    address: string;
    exchange: string;
    liquidity: number;
    volume24h: number;
    priceUsd: number;
  }[];
  lastUpdated: number;
}

class MemecoinGlobalCache {
  private tokens: Map<string, TokenRelationship> = new Map();
  private topTokens: TokenRelationship[] = [];
  private newTokens: TokenRelationship[] = [];
  private trendingTokens: TokenRelationship[] = [];
  private lastFullUpdate: number = 0;
  private cachePath: string = path.join(process.cwd(), 'data', 'memecoin-cache.json');
  
  constructor() {
    this.ensureDataDirectory();
    this.loadFromDisk();
    
    // Schedule regular cache cleanup
    setInterval(() => this.cleanupCache(), 12 * 60 * 60 * 1000); // 12 hours
  }
  
  private ensureDataDirectory() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
        logger.info('Created data directory for memecoin cache');
      } catch (error) {
        logger.error(`Failed to create data directory: ${error.message}`);
      }
    }
  }
  
  private loadFromDisk() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const data = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
        
        // Load tokens
        if (data.tokens && Array.isArray(data.tokens)) {
          this.tokens = new Map();
          for (const token of data.tokens) {
            this.tokens.set(token.address, token);
          }
          logger.info(`Loaded ${this.tokens.size} tokens from memecoin cache`);
        }
        
        // Load special lists
        if (data.topTokens && Array.isArray(data.topTokens)) {
          this.topTokens = data.topTokens;
        }
        
        if (data.newTokens && Array.isArray(data.newTokens)) {
          this.newTokens = data.newTokens;
        }
        
        if (data.trendingTokens && Array.isArray(data.trendingTokens)) {
          this.trendingTokens = data.trendingTokens;
        }
        
        if (data.lastFullUpdate) {
          this.lastFullUpdate = data.lastFullUpdate;
        }
        
        logger.info('Successfully loaded memecoin cache from disk');
      }
    } catch (error) {
      logger.error(`Failed to load memecoin cache from disk: ${error.message}`);
    }
  }
  
  private async saveToDisk() {
    try {
      // Convert Map to array for serialization
      const tokensArray = Array.from(this.tokens.values());
      
      const data = {
        tokens: tokensArray,
        topTokens: this.topTokens,
        newTokens: this.newTokens,
        trendingTokens: this.trendingTokens,
        lastFullUpdate: this.lastFullUpdate
      };
      
      await fs.promises.writeFile(this.cachePath, JSON.stringify(data, null, 2), 'utf8');
      logger.info(`Saved memecoin cache to disk (${tokensArray.length} tokens)`);
    } catch (error) {
      logger.error(`Failed to save memecoin cache to disk: ${error.message}`);
    }
  }
  
  private cleanupCache() {
    const now = Date.now();
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    
    // Remove tokens that haven't been updated in a week and have low liquidity
    let removedCount = 0;
    this.tokens.forEach((token, address) => {
      const isOld = (now - token.lastUpdated) > ONE_WEEK;
      const hasLowLiquidity = (token.liquidity || 0) < 1; // Less than 1 SOL liquidity
      
      if (isOld && hasLowLiquidity) {
        this.tokens.delete(address);
        removedCount++;
      }
    });
    
    if (removedCount > 0) {
      logger.info(`Cleaned up ${removedCount} old tokens from cache`);
      this.saveToDisk().catch(() => {});
    }
  }
  
  /**
   * Update the cache with tokens from a specific source
   */
  public updateFromSource(tokens: MemeToken[], source: string) {
    const now = Date.now();
    let updatedCount = 0;
    let newCount = 0;
    
    tokens.forEach(token => {
      // Skip tokens without an address
      if (!token.address) return;
      
      let relationship: TokenRelationship;
      
      // If token already exists in cache, update it
      if (this.tokens.has(token.address)) {
        relationship = this.tokens.get(token.address)!;
        
        // Update basic fields
        relationship.price = token.price || relationship.price;
        relationship.priceChange24h = token.priceChange24h || relationship.priceChange24h;
        relationship.priceChange1h = token.priceChange1h || relationship.priceChange1h;
        relationship.volume24h = token.volume24h || relationship.volume24h;
        relationship.marketCap = token.marketCap || relationship.marketCap;
        
        // Update source-specific fields
        if (source === 'pumpFun') {
          relationship.liquidity = token.liquidity || relationship.liquidity;
          relationship.launchDate = token.launchDate || relationship.launchDate;
          relationship.launchTimestamp = token.launchTimestamp || relationship.launchTimestamp;
          relationship.isNew = token.isNew || relationship.isNew;
          relationship.sources.pumpFun = true;
        }
        else if (source === 'dexScreener') {
          relationship.liquidityUSD = token.liquidity ? token.liquidity * 75 : relationship.liquidityUSD;
          relationship.liquidity = token.liquidity || relationship.liquidity;
          relationship.sources.dexScreener = true;
        }
        else if (source === 'birdeye') {
          relationship.holders = token.holders || relationship.holders;
          relationship.totalSupply = token.totalSupply || relationship.totalSupply;
          relationship.sources.birdeye = true;
        }
        else if (source === 'gmgn') {
          relationship.socials = token.socials || relationship.socials;
          relationship.sources.gmgn = true;
        }
        
        // Always update score and timestamp
        relationship.score = token.score > relationship.score ? token.score : relationship.score;
        relationship.lastUpdated = now;
        
        updatedCount++;
      } 
      // If token is new, create a new relationship
      else {
        relationship = {
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          price: token.price || 0,
          priceChange24h: token.priceChange24h || 0,
          priceChange1h: token.priceChange1h,
          volume24h: token.volume24h || 0,
          marketCap: token.marketCap,
          liquidity: token.liquidity,
          launchDate: token.launchDate,
          launchTimestamp: token.launchTimestamp,
          isNew: token.isNew,
          score: token.score || 0,
          sources: {
            pumpFun: source === 'pumpFun',
            dexScreener: source === 'dexScreener',
            birdeye: source === 'birdeye',
            gmgn: source === 'gmgn',
            jupiter: source === 'jupiter'
          },
          lastUpdated: now
        };
        
        this.tokens.set(token.address, relationship);
        newCount++;
      }
    });
    
    logger.info(`Updated cache from ${source}: ${updatedCount} updated, ${newCount} new tokens`);
    
    // Save to disk occasionally to prevent data loss
    if (newCount > 0 || updatedCount > 10) {
      this.saveToDisk().catch(() => {});
    }
    
    return { updatedCount, newCount };
  }
  
  /**
   * Update the cache with liquidity pool information
   */
  public updatePools(pools: any[]) {
    pools.forEach(pool => {
      const tokenAddress = pool.baseToken?.address;
      if (!tokenAddress || !this.tokens.has(tokenAddress)) return;
      
      const token = this.tokens.get(tokenAddress)!;
      
      if (!token.pools) {
        token.pools = [];
      }
      
      // Check if pool already exists
      const existingPoolIndex = token.pools.findIndex(p => p.address === pool.address);
      
      if (existingPoolIndex >= 0) {
        // Update existing pool
        token.pools[existingPoolIndex] = {
          address: pool.address,
          exchange: pool.exchange || pool.dexId || 'unknown',
          liquidity: pool.liquidity || 0,
          volume24h: pool.volume24h || 0,
          priceUsd: pool.priceUsd || 0
        };
      } else {
        // Add new pool
        token.pools.push({
          address: pool.address,
          exchange: pool.exchange || pool.dexId || 'unknown',
          liquidity: pool.liquidity || 0,
          volume24h: pool.volume24h || 0,
          priceUsd: pool.priceUsd || 0
        });
      }
      
      // Update token exchanges list
      const exchange = pool.exchange || pool.dexId || 'unknown';
      if (!token.exchanges) {
        token.exchanges = [exchange];
      } else if (!token.exchanges.includes(exchange)) {
        token.exchanges.push(exchange);
      }
    });
    
    logger.info(`Updated pool information for tokens`);
  }
  
  /**
   * Update the top tokens list
   */
  public updateTopTokens() {
    // Convert map to array
    const tokensArray = Array.from(this.tokens.values());
    
    // Filter and sort by score
    this.topTokens = tokensArray
      .filter(token => {
        // Must have sufficient liquidity and volume
        return (token.liquidity || 0) >= 10 && 
               (token.volume24h || 0) >= 5000;
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 50); // Top 50
    
    logger.info(`Updated top tokens list with ${this.topTokens.length} tokens`);
    this.saveToDisk().catch(() => {});
  }
  
  /**
   * Update the new tokens list
   */
  public updateNewTokens() {
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    
    // Convert map to array
    const tokensArray = Array.from(this.tokens.values());
    
    // Filter and sort by launch time
    this.newTokens = tokensArray
      .filter(token => {
        // Must be new (less than 24 hours old)
        if (token.isNew) return true;
        
        if (token.launchTimestamp) {
          return (now - token.launchTimestamp) < ONE_DAY;
        }
        
        return false;
      })
      .filter(token => {
        // Must have some liquidity
        return (token.liquidity || 0) >= 1;
      })
      .sort((a, b) => {
        // Sort by launchTimestamp (newest first)
        const aTime = a.launchTimestamp || 0;
        const bTime = b.launchTimestamp || 0;
        return bTime - aTime;
      })
      .slice(0, 20); // Top 20
    
    logger.info(`Updated new tokens list with ${this.newTokens.length} tokens`);
    this.saveToDisk().catch(() => {});
  }
  
  /**
   * Update the trending tokens list
   */
  public updateTrendingTokens() {
    // Convert map to array
    const tokensArray = Array.from(this.tokens.values());
    
    // Filter and sort by a composite score of price change and volume
    this.trendingTokens = tokensArray
      .filter(token => {
        // Must have some liquidity and volume
        return (token.liquidity || 0) >= 5 && 
               (token.volume24h || 0) >= 1000;
      })
      .map(token => {
        // Calculate a trending score based on price change and volume
        const priceChangeScore = token.priceChange24h > 0 ? token.priceChange24h * 2 : 0;
        const volumeScore = Math.min(token.volume24h / 10000, 50);
        const trendingScore = priceChangeScore + volumeScore;
        
        return {
          ...token,
          trendingScore
        };
      })
      .sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0))
      .slice(0, 30); // Top 30
    
    logger.info(`Updated trending tokens list with ${this.trendingTokens.length} tokens`);
    this.saveToDisk().catch(() => {});
  }
  
  /**
   * Get a specific token by address
   */
  public getToken(address: string): TokenRelationship | null {
    return this.tokens.get(address) || null;
  }
  
  /**
   * Get a specific token by symbol
   */
  public getTokenBySymbol(symbol: string): TokenRelationship | null {
    const upperSymbol = symbol.toUpperCase();
    
    for (const [_, token] of this.tokens) {
      if (token.symbol.toUpperCase() === upperSymbol) {
        return token;
      }
    }
    
    return null;
  }
  
  /**
   * Get all tokens
   */
  public getAllTokens(): TokenRelationship[] {
    return Array.from(this.tokens.values());
  }
  
  /**
   * Get top tokens
   */
  public getTopTokens(): TokenRelationship[] {
    return this.topTokens;
  }
  
  /**
   * Get new tokens
   */
  public getNewTokens(): TokenRelationship[] {
    return this.newTokens;
  }
  
  /**
   * Get trending tokens
   */
  public getTrendingTokens(): TokenRelationship[] {
    return this.trendingTokens;
  }
  
  /**
   * Search for tokens by name or symbol
   */
  public searchTokens(query: string): TokenRelationship[] {
    const lowerQuery = query.toLowerCase();
    
    return Array.from(this.tokens.values())
      .filter(token => 
        token.name.toLowerCase().includes(lowerQuery) || 
        token.symbol.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 20);
  }
  
  /**
   * Get tokens for sniper opportunities
   */
  public getSniperOpportunities(): TokenRelationship[] {
    const now = Date.now();
    const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
    
    return Array.from(this.tokens.values())
      .filter(token => {
        // Must have positive price movement
        if (token.priceChange24h < 5) return false;
        
        // Must have enough liquidity
        if ((token.liquidity || 0) < 5) return false;
        
        // Must have enough volume
        if ((token.volume24h || 0) < 1000) return false;
        
        // Must be relatively new (less than 2 days)
        if (token.launchTimestamp && (now - token.launchTimestamp) > TWO_DAYS) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        // Calculate a sniper score
        const getScore = (token: TokenRelationship) => {
          const priceChangeScore = token.priceChange24h * 0.4;
          const volumeScore = Math.min(token.volume24h / 5000, 30);
          const liquidityScore = Math.min((token.liquidity || 0) / 10, 20);
          const newness = token.launchTimestamp ? 
            Math.max(0, 10 - (now - token.launchTimestamp) / (6 * 60 * 60 * 1000)) : 0;
          
          return priceChangeScore + volumeScore + liquidityScore + newness;
        };
        
        return getScore(b) - getScore(a);
      })
      .slice(0, 20);
  }
  
  /**
   * Get the full cache stats
   */
  public getStats() {
    return {
      totalTokens: this.tokens.size,
      topTokensCount: this.topTokens.length,
      newTokensCount: this.newTokens.length,
      trendingTokensCount: this.trendingTokens.length,
      lastFullUpdate: this.lastFullUpdate
    };
  }
}

// Create singleton instance
export const memecoinCache = new MemecoinGlobalCache();