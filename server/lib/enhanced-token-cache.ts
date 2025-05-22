/**
 * Enhanced Token Cache
 * 
 * This module implements a robust caching system for token data
 * to minimize API calls while keeping data relatively fresh.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as logger from '../logger';

// Token cache configuration 
interface CacheConfig {
  cachePath: string;
  maxAgeMinutes: number;
  refreshThresholdMinutes: number;
  fallbackRefreshMinutes: number;
  backgroundRefresh: boolean;
}

// Default configuration
const DEFAULT_CONFIG: CacheConfig = {
  cachePath: path.join(process.cwd(), 'data', 'token-cache'),
  maxAgeMinutes: 30,
  refreshThresholdMinutes: 15,
  fallbackRefreshMinutes: 60,
  backgroundRefresh: true
};

// Token data structure
export interface TokenData {
  symbol: string;
  name: string;
  address: string;
  price?: number;
  priceChangePercent24h?: number;
  volume24h?: number;
  marketCap?: number;
  lastUpdated: number;
  source: string;
  tags?: string[];
  trending?: boolean;
  confidence?: number;
}

class EnhancedTokenCache {
  private config: CacheConfig;
  private cache: Map<string, TokenData> = new Map();
  private lastFullRefresh: number = 0;
  private refreshInProgress: boolean = false;
  private initialized: boolean = false;
  private syndica: boolean = false;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...(config || {}) };
    
    // Create cache directory if it doesn't exist
    if (!fs.existsSync(this.config.cachePath)) {
      fs.mkdirSync(this.config.cachePath, { recursive: true });
    }
  }

  /**
   * Initialize the cache
   */
  async initialize(): Promise<boolean> {
    try {
      // Load cache from disk
      await this.loadFromDisk();
      
      // Start background refresh if enabled
      if (this.config.backgroundRefresh) {
        this.startBackgroundRefresh();
      }
      
      this.initialized = true;
      logger.info(`Enhanced token cache initialized with ${this.cache.size} tokens`);
      return true;
    } catch (error) {
      logger.error(`Failed to initialize token cache: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if Syndica is available for high-priority requests
   */
  setSyndicaAvailable(available: boolean): void {
    this.syndica = available;
    logger.info(`Syndica availability set to: ${available}`);
  }

  /**
   * Load token cache from disk
   */
  private async loadFromDisk(): Promise<void> {
    const cacheFilePath = path.join(this.config.cachePath, 'token-data.json');
    
    if (fs.existsSync(cacheFilePath)) {
      try {
        const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
        
        if (cacheData && typeof cacheData === 'object') {
          // Convert to Map
          Object.entries(cacheData).forEach(([symbol, data]) => {
            this.cache.set(symbol, data as TokenData);
          });
          
          logger.info(`Loaded ${this.cache.size} tokens from cache`);
        }
      } catch (error) {
        logger.warn(`Error loading token cache: ${error.message}`);
        // Start with an empty cache if there was an error
        this.cache.clear();
      }
    } else {
      logger.info('No existing token cache found, starting with empty cache');
    }
  }

  /**
   * Save token cache to disk
   */
  private async saveToDisk(): Promise<void> {
    const cacheFilePath = path.join(this.config.cachePath, 'token-data.json');
    
    try {
      // Convert Map to object for JSON serialization
      const cacheObject = Object.fromEntries(this.cache.entries());
      
      // Write to disk
      fs.writeFileSync(cacheFilePath, JSON.stringify(cacheObject, null, 2));
      logger.info(`Saved ${this.cache.size} tokens to cache`);
    } catch (error) {
      logger.error(`Error saving token cache: ${error.message}`);
    }
  }

  /**
   * Start background refresh for token data
   */
  private startBackgroundRefresh(): void {
    const refreshIntervalMs = this.config.refreshThresholdMinutes * 60 * 1000;
    
    setInterval(() => {
      this.refreshCacheIfNeeded();
    }, refreshIntervalMs);
    
    logger.info(`Started background refresh every ${this.config.refreshThresholdMinutes} minutes`);
  }

  /**
   * Refresh the cache if needed
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    if (this.refreshInProgress) {
      return;
    }
    
    const now = Date.now();
    const refreshThresholdMs = this.config.refreshThresholdMinutes * 60 * 1000;
    
    // Check if it's time to refresh
    if (now - this.lastFullRefresh > refreshThresholdMs) {
      this.refreshInProgress = true;
      
      try {
        // Here we would call token data sources, but we'll just log for now
        logger.info('Refreshing token cache in background...');
        
        // Update last refresh time
        this.lastFullRefresh = now;
        
        // Save updated cache to disk
        await this.saveToDisk();
      } catch (error) {
        logger.error(`Error refreshing token cache: ${error.message}`);
      } finally {
        this.refreshInProgress = false;
      }
    }
  }

  /**
   * Get token data from the cache
   */
  getToken(symbol: string): TokenData | null {
    const token = this.cache.get(symbol);
    
    if (!token) {
      return null;
    }
    
    // Check if data is still valid
    const now = Date.now();
    const maxAgeMs = this.config.maxAgeMinutes * 60 * 1000;
    
    if (now - token.lastUpdated > maxAgeMs) {
      logger.debug(`Token ${symbol} data is stale, returning with warning`);
      // Data is stale but return anyway with warning
      return {
        ...token,
        stale: true
      } as TokenData;
    }
    
    return token;
  }

  /**
   * Get all tokens
   */
  getAllTokens(): TokenData[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get trending tokens
   */
  getTrendingTokens(): TokenData[] {
    return this.getAllTokens().filter(token => token.trending);
  }

  /**
   * Add or update a token in the cache
   */
  updateToken(token: TokenData): void {
    // Ensure lastUpdated is set
    token.lastUpdated = token.lastUpdated || Date.now();
    
    // Update cache
    this.cache.set(token.symbol, token);
    
    // Save to disk periodically (not on every update)
    if (Math.random() < 0.1) { // 10% chance to save
      this.saveToDisk();
    }
  }

  /**
   * Bulk update tokens
   */
  updateTokens(tokens: TokenData[]): void {
    // Update each token
    tokens.forEach(token => this.updateToken(token));
    
    // Always save after bulk update
    this.saveToDisk();
  }
}

// Create singleton instance
export const tokenCache = new EnhancedTokenCache();

// Export default
export default tokenCache;