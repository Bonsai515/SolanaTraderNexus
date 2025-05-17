/**
 * API Rate Limit Handler
 * Handles rate limiting errors for external APIs with exponential backoff
 * and automatic fallback to alternative data sources
 */

import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';

// Cache storage for API responses
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class ApiRateLimitHandler {
  private cache: Map<string, CacheEntry> = new Map();
  private rateLimitedEndpoints: Map<string, number> = new Map(); // endpoint -> timestamp when to retry
  private eventEmitter = new EventEmitter();
  
  // Default TTL for cached responses (5 minutes)
  private DEFAULT_TTL = 5 * 60 * 1000;
  
  // Maximum retries for rate limited requests
  private MAX_RETRIES = 3;
  
  // API sources priority (first is primary, others are fallbacks)
  private sourcePriority = {
    'price': ['coingecko', 'jupiter', 'birdeye', 'local'],
    'trending': ['pump', 'birdeye', 'jupiter', 'local']
  };

  constructor() {
    // Set higher max listeners to avoid memory leak warnings
    this.eventEmitter.setMaxListeners(100);
  }

  /**
   * Makes an API request with automatic fallback and caching
   */
  public async request<T>(
    category: 'price' | 'trending', 
    sourceUrls: Record<string, string>,
    config: AxiosRequestConfig = {}
  ): Promise<T> {
    const cacheKey = `${category}:${JSON.stringify(config)}`;
    
    // Check cache first
    const cachedData = this.getFromCache<T>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Try each source in priority order
    const sources = this.sourcePriority[category];
    let lastError: Error | null = null;
    
    for (const source of sources) {
      if (!sourceUrls[source]) continue;
      
      // Skip rate limited endpoints
      const rateLimitExpiry = this.rateLimitedEndpoints.get(source);
      if (rateLimitExpiry && Date.now() < rateLimitExpiry) {
        console.log(`Skipping rate limited source: ${source}`);
        continue;
      }
      
      try {
        const response = await this.makeRequest<T>(sourceUrls[source], config);
        
        // Cache successful response
        this.saveToCache(cacheKey, response, this.DEFAULT_TTL);
        
        // If this was not the primary source, emit event to log the fallback
        if (source !== sources[0]) {
          console.log(`Using fallback data source: ${source}`);
        }
        
        return response;
      } catch (error) {
        lastError = error as Error;
        const axiosError = error as AxiosError;
        
        // Handle rate limiting
        if (axiosError.response?.status === 429) {
          // Mark source as rate limited for exponential backoff
          const backoffMs = this.calculateBackoff(source);
          this.rateLimitedEndpoints.set(source, Date.now() + backoffMs);
          console.log(`Rate limited on ${source}, backing off for ${backoffMs}ms`);
        }
      }
    }
    
    // If we have cached data (even if expired), return it as last resort
    const expiredCache = this.getFromCache<T>(cacheKey, true);
    if (expiredCache) {
      console.log('Using expired cached data as fallback');
      return expiredCache;
    }
    
    // All sources failed
    throw lastError || new Error('All API sources failed');
  }
  
  /**
   * Make a single API request
   */
  private async makeRequest<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    try {
      const response = await axios.request<T>({
        ...config,
        url
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Calculate exponential backoff time
   */
  private calculateBackoff(source: string): number {
    const previousBackoffs = this.eventEmitter.listenerCount(`backoff:${source}`);
    const baseBackoff = 1000; // 1 second
    return baseBackoff * Math.pow(2, previousBackoffs);
  }
  
  /**
   * Get data from cache
   */
  private getFromCache<T>(key: string, allowExpired: boolean = false): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;
    
    if (!isExpired || allowExpired) {
      return entry.data as T;
    }
    
    return null;
  }
  
  /**
   * Save data to cache
   */
  private saveToCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  /**
   * Clear a specific category from cache
   */
  public clearCache(category?: string): void {
    if (category) {
      // Clear only keys that match the category
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${category}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }
}

// Export singleton instance
export const apiRateLimitHandler = new ApiRateLimitHandler();