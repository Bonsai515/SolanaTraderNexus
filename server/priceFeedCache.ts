/**
 * Price Feed System with Rate-Limited Cache
 * 
 * This module provides a comprehensive price feed system for the entire application
 * with automatic caching to respect RPC and API rate limits.
 */

import axios from 'axios';
import { logger } from './logger';
import * as web3 from '@solana/web3.js';

// Price Source Types
type PriceSource = 'DEX' | 'CEX' | 'ORACLE' | 'CHAINLINK' | 'PYTH' | 'HELIUS' | 'WORMHOLE';

// Token Price Entry Interface
interface TokenPriceEntry {
  symbol: string;
  address: string;
  price: number;
  timestamp: number;
  source: PriceSource;
  confidence: number;
  volume24h?: number;
  change24h?: number;
}

// Cache Configuration
const CACHE_TTL_MS = {
  DEX: 30 * 1000,         // 30 seconds for DEX prices
  CEX: 15 * 1000,         // 15 seconds for CEX prices
  ORACLE: 60 * 1000,      // 1 minute for oracle prices
  CHAINLINK: 90 * 1000,   // 1.5 minutes for Chainlink
  PYTH: 15 * 1000,        // 15 seconds for Pyth
  HELIUS: 2 * 60 * 1000,  // 2 minutes for Helius API
  WORMHOLE: 2 * 60 * 1000 // 2 minutes for Wormhole
};

// Rate Limit Monitoring
interface RateLimit {
  dailyLimit: number;
  currentUsage: number;
  resetTime: number; // timestamp for reset
}

// Supported DEXs for pricing
interface DexSource {
  name: string;
  enabled: boolean;
  priority: number; // Lower is higher priority
  rateLimitPerMinute: number;
}

// The main price cache
class PriceFeedCache {
  private priceCache: Map<string, TokenPriceEntry> = new Map();
  private solanaConnection: web3.Connection | null = null;
  private heliusApiKey: string | undefined;
  private wormholeApiKey: string | undefined;
  
  private rateLimits: Record<string, RateLimit> = {
    'INSTANT_NODES': {
      dailyLimit: 40000,
      currentUsage: 0,
      resetTime: Date.now() + 24 * 60 * 60 * 1000
    },
    'HELIUS': {
      dailyLimit: 100000,
      currentUsage: 0,
      resetTime: Date.now() + 24 * 60 * 60 * 1000
    },
    'BLOCKCHAIN_API': {
      dailyLimit: 20000,
      currentUsage: 0,
      resetTime: Date.now() + 24 * 60 * 60 * 1000
    }
  };
  
  private dexSources: DexSource[] = [
    { name: 'Jupiter', enabled: true, priority: 1, rateLimitPerMinute: 600 },
    { name: 'Raydium', enabled: true, priority: 2, rateLimitPerMinute: 300 },
    { name: 'Orca', enabled: true, priority: 3, rateLimitPerMinute: 300 },
    { name: 'Openbook', enabled: true, priority: 4, rateLimitPerMinute: 200 }
  ];
  
  // Popular token addresses for quick lookup
  private readonly POPULAR_TOKENS: Record<string, string> = {
    'SOL': 'So11111111111111111111111111111111111111112',
    'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    'BONK': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    'WIF': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvkK',
    'PYTH': 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    'ETH': '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    'BTC': '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
    'JTO': 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
    'GUAC': 'GGThuHJMMgbivVpRTVwQRbqc9ixJJfNYSVZcWBFcERAQ',
    'MEME': 'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey',
    'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'
  };
  
  // Hardcoded backup prices for when all external sources fail
  // These will be used as a last resort to keep the system functioning
  public readonly BACKUP_PRICES: Record<string, number> = {
    'SOL': 173.13,
    'BTC': 61545.37,
    'ETH': 3028.34,
    'BONK': 0.000023786,
    'JUP': 0.7553,
    'USDC': 1.0065,
    'USDT': 1.0012,
    'RAY': 0.4142,
    'MNDE': 0.05059,
    'WIF': 1.8797,
    'GUAC': 0.00122,
    'JTO': 1.43,
    'PYTH': 0.3819,
    'MEME': 0.028
  };
  
  constructor() {
    logger.info('Initializing Price Feed Cache system');
    this.heliusApiKey = process.env.HELIUS_API_KEY;
    this.wormholeApiKey = process.env.WORMHOLE_API_KEY;
    
    // Connect to Solana with proper error handling for RPC URL
    try {
      const rpcUrl = process.env.INSTANT_NODES_RPC_URL;
      
      // Validate RPC URL format
      if (rpcUrl && (rpcUrl.startsWith('http://') || rpcUrl.startsWith('https://'))) {
        logger.info(`Using RPC URL from environment: ${rpcUrl.substring(0, 15)}...`);
        this.solanaConnection = new web3.Connection(rpcUrl, 'confirmed');
      } else {
        // Fallback to public endpoint
        logger.warn('Invalid or missing RPC URL, falling back to public Solana endpoint');
        this.solanaConnection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      }
    } catch (error: any) {
      logger.error(`Error initializing Solana connection: ${error.message}`);
      // Initialize with public endpoint as fallback
      this.solanaConnection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    }
    
    // Initialize a housekeeping interval to clean up expired cache entries
    setInterval(() => this.cleanExpiredEntries(), 5 * 60 * 1000); // Run every 5 minutes
    
    // Initialize rate limit reset timers
    Object.keys(this.rateLimits).forEach(api => {
      const resetTimeMs = this.rateLimits[api].resetTime - Date.now();
      if (resetTimeMs > 0) {
        setTimeout(() => this.resetRateLimitCounter(api), resetTimeMs);
      } else {
        this.resetRateLimitCounter(api);
      }
    });
  }
  
  /**
   * Connect to required services for price data
   */
  public async connect(): Promise<boolean> {
    try {
      logger.info('Connecting to price feed services...');
      
      // Re-verify and potentially reconnect to Solana
      if (!this.solanaConnection) {
        logger.warn('No Solana connection, initializing new connection');
        this.solanaConnection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      }
      
      // Verify Solana connection
      try {
        if (this.solanaConnection) {
          await this.solanaConnection.getLatestBlockhash();
          logger.info('Successfully connected to Solana RPC for price data');
        } else {
          throw new Error('Solana connection not initialized');
        }
      } catch (error: any) {
        logger.warn(`Error connecting to Solana RPC: ${error.message}`);
        
        // Try to reconnect with the public API
        try {
          logger.info('Attempting to reconnect using public Solana API');
          this.solanaConnection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
          await this.solanaConnection.getLatestBlockhash();
          logger.info('Successfully reconnected to Solana using public API');
        } catch (reconnectError: any) {
          logger.error(`Failed to reconnect to Solana: ${reconnectError.message}`);
          // Continue with limited functionality
        }
      }
      
      // Test Jupiter API connection
      try {
        const jupiterResponse = await axios.get('https://quote-api.jup.ag/v4/tokens');
        logger.info(`Successfully connected to Jupiter API. Found ${jupiterResponse.data.length} tokens.`);
      } catch (error: any) {
        logger.warn(`Error connecting to Jupiter API: ${error.message}`);
      }
      
      // Initialize price cache with major tokens
      try {
        await this.prefetchPopularTokens();
      } catch (error: any) {
        logger.warn(`Error prefetching token prices: ${error.message}`);
      }
      
      // Even with errors, return true to continue with best effort
      return true;
    } catch (error: any) {
      logger.error(`Failed to connect to price feed services: ${error.message}`);
      // Return true anyway to allow the system to function with limited price capabilities
      return true;
    }
  }
  
  /**
   * Reset rate limit counter for an API
   */
  private resetRateLimitCounter(api: string): void {
    if (this.rateLimits[api]) {
      this.rateLimits[api].currentUsage = 0;
      this.rateLimits[api].resetTime = Date.now() + 24 * 60 * 60 * 1000; // Reset after 24 hours
      
      // Schedule next reset
      setTimeout(() => this.resetRateLimitCounter(api), 24 * 60 * 60 * 1000);
      
      logger.info(`Rate limit counter reset for ${api}`);
    }
  }
  
  /**
   * Track API usage for rate limiting
   */
  private trackApiUsage(api: string): boolean {
    if (!this.rateLimits[api]) return true; // No limits if not tracked
    
    // Check if we need to reset
    if (Date.now() > this.rateLimits[api].resetTime) {
      this.resetRateLimitCounter(api);
    }
    
    // Check if we're over limit
    if (this.rateLimits[api].currentUsage >= this.rateLimits[api].dailyLimit) {
      logger.warn(`Rate limit exceeded for ${api}, ${this.rateLimits[api].currentUsage}/${this.rateLimits[api].dailyLimit}`);
      return false;
    }
    
    // Track usage
    this.rateLimits[api].currentUsage++;
    return true;
  }
  
  /**
   * Clean expired cache entries
   */
  private cleanExpiredEntries(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.priceCache.entries()) {
      const ttl = CACHE_TTL_MS[entry.source] || 60 * 1000; // Default 1 minute
      if (now - entry.timestamp > ttl) {
        this.priceCache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logger.debug(`Cleaned ${expiredCount} expired price entries from cache`);
    }
  }
  
  /**
   * Prefetch prices for popular tokens
   */
  private async prefetchPopularTokens(): Promise<void> {
    logger.info('Prefetching prices for popular tokens...');
    
    const symbols = Object.keys(this.POPULAR_TOKENS);
    
    // Track success rate for prefetching
    let successCount = 0;
    const results = await Promise.allSettled(
      symbols.map(symbol => this.getTokenPrice(this.POPULAR_TOKENS[symbol], symbol))
    );
    
    results.forEach((result, index) => {
      const symbol = symbols[index];
      if (result.status === 'fulfilled') {
        successCount++;
        logger.debug(`Prefetched price for ${symbol}: $${result.value}`);
      } else {
        logger.warn(`Failed to prefetch price for ${symbol}: ${result.reason}`);
      }
    });
    
    logger.info(`Completed prefetching prices for ${successCount}/${symbols.length} popular tokens`);
    
    // If less than 80% of tokens were successfully fetched, try alternative sources
    if (successCount < symbols.length * 0.8) {
      logger.warn(`Low success rate (${successCount}/${symbols.length}) for price fetching, trying backup sources`);
      await this.tryBackupPriceSources();
    }
  }
  
  /**
   * Try alternative price sources when primary sources fail
   */
  private async tryBackupPriceSources(): Promise<void> {
    try {
      // Try switching to a different RPC endpoint
      if (this.solanaConnection) {
        const currentEndpoint = this.solanaConnection.rpcEndpoint;
        
        // If currently using INSTANT_NODES, try Helius or public endpoint
        if (currentEndpoint.includes('instantnodes') && this.heliusApiKey) {
          logger.info('Switching to Helius RPC endpoint for price data');
          this.solanaConnection = new web3.Connection(`https://rpc.helius.xyz/?api-key=${this.heliusApiKey}`, 'confirmed');
        } 
        // If currently using Helius or other, try public endpoint
        else if (!currentEndpoint.includes('api.mainnet-beta.solana.com')) {
          logger.info('Switching to public Solana RPC endpoint for price data');
          this.solanaConnection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        }
        
        // Test the connection after switching
        await this.solanaConnection.getLatestBlockhash();
        logger.info('Successfully switched RPC endpoint');
      }
      
      // Try fetching critical tokens directly with Jupiter API
      const criticalTokens = ['SOL', 'USDC', 'BONK', 'JUP'];
      
      for (const symbol of criticalTokens) {
        try {
          const tokenAddress = this.POPULAR_TOKENS[symbol];
          const jupiterUrl = `https://price.jup.ag/v4/price?ids=${tokenAddress}`;
          const response = await axios.get(jupiterUrl, { timeout: 5000 });
          
          if (response.data?.data?.[tokenAddress]?.price) {
            const price = parseFloat(response.data.data[tokenAddress].price);
            this.updateCache(tokenAddress, symbol, price, 'DEX', 0.95);
            logger.info(`Retrieved ${symbol} price directly from Jupiter: $${price}`);
          }
        } catch (error: any) {
          logger.debug(`Jupiter direct API failed for ${symbol}: ${error.message}`);
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to use backup price sources: ${error.message}`);
    }
  }
  
  /**
   * Get the last time any price was updated
   */
  public getLastUpdateTime(): number {
    let lastUpdate = 0;
    for (const entry of this.priceCache.values()) {
      if (entry.timestamp > lastUpdate) {
        lastUpdate = entry.timestamp;
      }
    }
    return lastUpdate || Date.now();
  }
  
  /**
   * Get the cache key for a token
   */
  private getCacheKey(tokenAddress: string): string {
    return tokenAddress.toLowerCase();
  }
  
  /**
   * Get symbol from token address
   */
  private getSymbolFromAddress(tokenAddress: string): string | null {
    // Look up the token address in our POPULAR_TOKENS mapping
    for (const [symbol, address] of Object.entries(this.POPULAR_TOKENS)) {
      if (address.toLowerCase() === tokenAddress.toLowerCase()) {
        return symbol;
      }
    }
    
    // If we have a cached entry, we can get the symbol from there
    const cacheEntries = Array.from(this.priceCache.values());
    for (const entry of cacheEntries) {
      if (entry.address.toLowerCase() === tokenAddress.toLowerCase()) {
        return entry.symbol;
      }
    }
    
    return null;
  }
  
  /**
   * Get token price prioritizing cache
   */
  public async getTokenPrice(tokenAddress: string, tokenSymbol?: string): Promise<number> {
    const cacheKey = this.getCacheKey(tokenAddress);
    
    // Check cache first
    const cachedEntry = this.priceCache.get(cacheKey);
    if (cachedEntry) {
      const ttl = CACHE_TTL_MS[cachedEntry.source] || 60 * 1000; // Default 1 minute
      
      if (Date.now() - cachedEntry.timestamp < ttl) {
        return cachedEntry.price;
      }
    }
    
    // Find token symbol if not provided
    if (!tokenSymbol) {
      for (const [symbol, address] of Object.entries(this.POPULAR_TOKENS)) {
        if (address.toLowerCase() === tokenAddress.toLowerCase()) {
          tokenSymbol = symbol;
          break;
        }
      }
    }
    
    try {
      // Try Jupiter first (lowest latency)
      if (this.trackApiUsage('BLOCKCHAIN_API')) {
        try {
          const jupiterPrice = await this.fetchJupiterPrice(tokenAddress);
          if (jupiterPrice > 0) {
            this.updateCache(tokenAddress, tokenSymbol || 'UNKNOWN', jupiterPrice, 'DEX', 0.9);
            return jupiterPrice;
          }
        } catch (error) {
          // Ignore and try next source
        }
      }
      
      // Try Helius API next
      if (this.heliusApiKey && this.trackApiUsage('HELIUS')) {
        try {
          const heliusPrice = await this.fetchHeliusPrice(tokenAddress);
          if (heliusPrice > 0) {
            this.updateCache(tokenAddress, tokenSymbol || 'UNKNOWN', heliusPrice, 'HELIUS', 0.95);
            return heliusPrice;
          }
        } catch (error) {
          // Ignore and try next source
        }
      }
      
      // Fallback: use Raydium
      if (this.trackApiUsage('BLOCKCHAIN_API')) {
        try {
          const raydiumPrice = await this.fetchRaydiumPrice(tokenAddress);
          if (raydiumPrice > 0) {
            this.updateCache(tokenAddress, tokenSymbol || 'UNKNOWN', raydiumPrice, 'DEX', 0.85);
            return raydiumPrice;
          }
        } catch (error) {
          // Ignore error
        }
      }
      
      // Return cached value if all else fails
      if (cachedEntry) {
        logger.warn(`Using outdated price for ${tokenSymbol || tokenAddress} from cache`);
        return cachedEntry.price;
      }
      
      // Check for stablecoins first as a reliable fallback
      if (tokenAddress === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' || // USDC
          tokenAddress === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') { // USDT
        logger.debug(`Using default stablecoin price (1.0) for ${tokenSymbol || tokenAddress}`);
        return 1.0;
      }
      
      // As a last resort, check our backup price list
      const symbol = tokenSymbol || this.getSymbolFromAddress(tokenAddress);
      if (symbol && this.BACKUP_PRICES[symbol]) {
        const backupPrice = this.BACKUP_PRICES[symbol];
        logger.warn(`Using backup price data for ${symbol}: $${backupPrice}`);
        // Cache the backup price so it's available for future queries
        this.updateCache(tokenAddress, symbol, backupPrice, 'DEX', 0.7);
        return backupPrice;
      }
      
      throw new Error(`Failed to fetch price for token ${tokenSymbol || tokenAddress}`);
    } catch (error: any) {
      logger.error(`Error fetching token price: ${error.message}`);
      
      // Return cached value even if expired as a fallback
      if (cachedEntry) {
        logger.warn(`Using expired price for ${tokenSymbol || tokenAddress} from cache as fallback`);
        return cachedEntry.price;
      }
      
      // Final fallback - check backup prices
      const symbol = tokenSymbol || this.getSymbolFromAddress(tokenAddress);
      if (symbol && this.BACKUP_PRICES[symbol]) {
        const backupPrice = this.BACKUP_PRICES[symbol];
        logger.warn(`Using backup price data for ${symbol}: $${backupPrice}`);
        // Cache the backup price
        this.updateCache(tokenAddress, symbol, backupPrice, 'DEX', 0.7);
        return backupPrice;
      }
      
      throw new Error(`Failed to get price for ${tokenSymbol || tokenAddress}: ${error.message}`);
    }
  }
  
  /**
   * Update price cache with new data
   */
  private updateCache(
    tokenAddress: string,
    tokenSymbol: string,
    price: number,
    source: PriceSource,
    confidence: number,
    volume24h?: number,
    change24h?: number
  ): void {
    const cacheKey = this.getCacheKey(tokenAddress);
    
    this.priceCache.set(cacheKey, {
      symbol: tokenSymbol,
      address: tokenAddress,
      price,
      timestamp: Date.now(),
      source,
      confidence,
      volume24h,
      change24h
    });
  }
  
  /**
   * Fetch price from Jupiter API
   */
  private async fetchJupiterPrice(tokenAddress: string): Promise<number> {
    // For SOL (native token), use a special approach
    if (tokenAddress === 'So11111111111111111111111111111111111111112') {
      try {
        const response = await axios.get('https://price.jup.ag/v4/price?ids=SOL');
        if (response.data && response.data.data && response.data.data.SOL) {
          return response.data.data.SOL.price;
        }
      } catch (error) {
        // Fall through to regular approach
      }
    }
    
    // For other tokens
    try {
      const response = await axios.get(`https://price.jup.ag/v4/price?ids=${tokenAddress}`);
      if (response.data && response.data.data && response.data.data[tokenAddress]) {
        return response.data.data[tokenAddress].price;
      }
      throw new Error('Token not found in Jupiter API');
    } catch (error: any) {
      logger.debug(`Jupiter price fetch failed for ${tokenAddress}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Fetch price from Helius API
   */
  private async fetchHeliusPrice(tokenAddress: string): Promise<number> {
    if (!this.heliusApiKey) {
      throw new Error('Helius API key not configured');
    }
    
    try {
      const response = await axios.post(
        `https://api.helius.xyz/v0/tokens/price?api-key=${this.heliusApiKey}`,
        { mintAddresses: [tokenAddress] }
      );
      
      if (response.data && response.data.length > 0 && response.data[0].price) {
        return response.data[0].price;
      }
      throw new Error('Token not found in Helius API');
    } catch (error: any) {
      logger.debug(`Helius price fetch failed for ${tokenAddress}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Fetch price from Raydium API
   */
  private async fetchRaydiumPrice(tokenAddress: string): Promise<number> {
    try {
      const response = await axios.get(`https://api.raydium.io/v2/main/price?token=${tokenAddress}`);
      if (response.data && response.data.data && !isNaN(parseFloat(response.data.data))) {
        return parseFloat(response.data.data);
      }
      throw new Error('Token not found in Raydium API');
    } catch (error: any) {
      logger.debug(`Raydium price fetch failed for ${tokenAddress}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get all available token prices in cache
   */
  public getAllCachedPrices(): TokenPriceEntry[] {
    return Array.from(this.priceCache.values());
  }
  
  /**
   * Get current cache statistics
   */
  public getCacheStats(): {
    cacheSize: number;
    sources: Record<PriceSource, number>;
    avgAge: number;
    rateLimits: Record<string, {current: number, limit: number, resetIn: number}>;
  } {
    const entries = Array.from(this.priceCache.values());
    const now = Date.now();
    
    // Count by source
    const sources: Partial<Record<PriceSource, number>> = {};
    entries.forEach(entry => {
      sources[entry.source] = (sources[entry.source] || 0) + 1;
    });
    
    // Calculate average age
    const totalAge = entries.reduce((sum, entry) => sum + (now - entry.timestamp), 0);
    const avgAge = entries.length > 0 ? totalAge / entries.length : 0;
    
    // Format rate limits
    const rateLimits: Record<string, {current: number, limit: number, resetIn: number}> = {};
    Object.keys(this.rateLimits).forEach(api => {
      rateLimits[api] = {
        current: this.rateLimits[api].currentUsage,
        limit: this.rateLimits[api].dailyLimit,
        resetIn: Math.max(0, this.rateLimits[api].resetTime - now)
      };
    });
    
    return {
      cacheSize: entries.length,
      sources: sources as Record<PriceSource, number>,
      avgAge: avgAge,
      rateLimits
    };
  }
}

// Export singleton instance
export const priceFeedCache = new PriceFeedCache();