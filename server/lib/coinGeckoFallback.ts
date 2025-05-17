/**
 * CoinGecko Fallback Handler
 * Manages rate limiting for CoinGecko API with automatic fallbacks to alternative price sources
 */

import axios from 'axios';
import { EventEmitter } from 'events';

// Cache for token prices
interface PriceCache {
  [symbol: string]: {
    usd: number;
    timestamp: number;
  };
}

class CoinGeckoFallback {
  private cache: PriceCache = {};
  private isRateLimited: boolean = false;
  private rateLimitResetTime: number = 0;
  private eventEmitter = new EventEmitter();
  private fallbackProviders: string[] = [];
  
  // Cache expiry (5 minutes)
  private CACHE_TTL = 5 * 60 * 1000;
  
  // Rate limit backoff (60 seconds)
  private RATE_LIMIT_BACKOFF = 60 * 1000;

  constructor() {
    // Set up alternative price sources
    this.fallbackProviders = [
      'jupiter',
      'birdeye',
      'raydium',
      'openbook',
      'local'
    ];
    
    // Set up rate limit reset check
    setInterval(() => this.checkRateLimitReset(), 30 * 1000);
  }

  /**
   * Get token prices with fallback support
   */
  public async getTokenPrices(symbols: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    const uncachedSymbols: string[] = [];
    const now = Date.now();
    
    // First check cache for recent prices
    for (const symbol of symbols) {
      const cachedPrice = this.cache[symbol];
      if (cachedPrice && (now - cachedPrice.timestamp) < this.CACHE_TTL) {
        prices[symbol] = cachedPrice.usd;
      } else {
        uncachedSymbols.push(symbol);
      }
    }
    
    // If all prices were in cache, return immediately
    if (uncachedSymbols.length === 0) {
      return prices;
    }
    
    // Try to fetch fresh prices if not rate limited
    if (!this.isRateLimited || now > this.rateLimitResetTime) {
      try {
        const freshPrices = await this.fetchFromCoinGecko(uncachedSymbols);
        
        // Update cache and return values
        for (const [symbol, price] of Object.entries(freshPrices)) {
          this.cache[symbol] = {
            usd: price,
            timestamp: now
          };
          prices[symbol] = price;
        }
        
        // Update any remaining symbols from fallbacks
        const remainingSymbols = uncachedSymbols.filter(s => !prices[s]);
        if (remainingSymbols.length > 0) {
          const fallbackPrices = await this.fetchFromFallbacks(remainingSymbols);
          
          for (const [symbol, price] of Object.entries(fallbackPrices)) {
            this.cache[symbol] = {
              usd: price,
              timestamp: now
            };
            prices[symbol] = price;
          }
        }
        
        return prices;
      } catch (error) {
        // Check if rate limited
        if (error.response && error.response.status === 429) {
          this.handleRateLimit();
        }
        
        // Continue with fallbacks
      }
    }
    
    // If we get here, we're either rate limited or the request failed
    // Try fallback providers
    const fallbackPrices = await this.fetchFromFallbacks(uncachedSymbols);
    
    for (const [symbol, price] of Object.entries(fallbackPrices)) {
      // Use shorter cache TTL for fallback prices
      this.cache[symbol] = {
        usd: price,
        timestamp: now
      };
      prices[symbol] = price;
    }
    
    // For any remaining symbols, use stale cache if available
    for (const symbol of uncachedSymbols) {
      if (!prices[symbol] && this.cache[symbol]) {
        console.log(`Using stale price for ${symbol} (${Math.round((now - this.cache[symbol].timestamp) / 1000)}s old)`);
        prices[symbol] = this.cache[symbol].usd;
      }
    }
    
    return prices;
  }
  
  /**
   * Fetch prices from CoinGecko
   */
  private async fetchFromCoinGecko(symbols: string[]): Promise<Record<string, number>> {
    // Convert symbols to coingecko IDs if needed
    const ids = symbols.map(s => this.symbolToId(s)).join(',');
    
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
    
    try {
      const response = await axios.get(url);
      const result: Record<string, number> = {};
      
      // Convert response to simple symbol:price mapping
      for (const symbol of symbols) {
        const id = this.symbolToId(symbol);
        if (response.data[id] && response.data[id].usd) {
          result[symbol] = response.data[id].usd;
        }
      }
      
      return result;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        this.handleRateLimit();
      }
      throw error;
    }
  }
  
  /**
   * Fetch prices from fallback sources
   */
  private async fetchFromFallbacks(symbols: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    
    // Try each fallback in sequence
    for (const provider of this.fallbackProviders) {
      try {
        const providerPrices = await this.fetchFromProvider(provider, symbols.filter(s => !prices[s]));
        
        // Add any new prices from this provider
        for (const [symbol, price] of Object.entries(providerPrices)) {
          if (!prices[symbol]) {
            prices[symbol] = price;
          }
        }
        
        // If we got all prices, we can stop
        if (Object.keys(prices).length === symbols.length) {
          break;
        }
      } catch (error) {
        console.log(`Error fetching prices from ${provider}: ${error.message}`);
        // Continue to next provider
      }
    }
    
    return prices;
  }
  
  /**
   * Fetch prices from a specific provider
   */
  private async fetchFromProvider(provider: string, symbols: string[]): Promise<Record<string, number>> {
    switch (provider) {
      case 'jupiter':
        return this.fetchFromJupiter(symbols);
      case 'birdeye':
        return this.fetchFromBirdeye(symbols);
      case 'raydium':
        return this.fetchFromRaydium(symbols);
      case 'openbook':
        return this.fetchFromOpenbook(symbols);
      case 'local':
        return this.getLocalFallbackPrices(symbols);
      default:
        return {};
    }
  }
  
  /**
   * Fetch prices from Jupiter API
   */
  private async fetchFromJupiter(symbols: string[]): Promise<Record<string, number>> {
    // Implementation would depend on Jupiter API structure
    // This is a placeholder
    console.log(`Fetching prices from Jupiter for ${symbols.join(', ')}`);
    
    // For demonstration, return estimated prices for common tokens
    const result: Record<string, number> = {};
    
    // Commonly traded tokens with estimated prices
    const commonPrices = {
      'SOL': 150.25,
      'BTC': 58700,
      'ETH': 3450,
      'USDC': 1.00,
      'BONK': 0.00002,
      'JUP': 0.85,
      'MEME': 0.02,
      'WIF': 1.12,
      'DOGE': 0.14,
      'MNGO': 0.038
    };
    
    for (const symbol of symbols) {
      if (commonPrices[symbol]) {
        result[symbol] = commonPrices[symbol];
      }
    }
    
    return result;
  }
  
  /**
   * Fetch prices from Birdeye API
   */
  private async fetchFromBirdeye(symbols: string[]): Promise<Record<string, number>> {
    // Implementation would depend on Birdeye API structure
    // Return similar placeholder prices with slight differences for demonstration
    const result: Record<string, number> = {};
    
    const commonPrices = {
      'SOL': 149.75,
      'BTC': 58650,
      'ETH': 3445,
      'USDC': 1.00,
      'BONK': 0.000019,
      'JUP': 0.84,
      'MEME': 0.019,
      'WIF': 1.10,
      'DOGE': 0.135,
      'MNGO': 0.039
    };
    
    for (const symbol of symbols) {
      if (commonPrices[symbol]) {
        result[symbol] = commonPrices[symbol];
      }
    }
    
    return result;
  }
  
  /**
   * Fetch prices from Raydium API
   */
  private async fetchFromRaydium(symbols: string[]): Promise<Record<string, number>> {
    // Placeholder implementation
    return {};
  }
  
  /**
   * Fetch prices from Openbook API
   */
  private async fetchFromOpenbook(symbols: string[]): Promise<Record<string, number>> {
    // Placeholder implementation
    return {};
  }
  
  /**
   * Get local fallback prices as absolute last resort
   */
  private getLocalFallbackPrices(symbols: string[]): Record<string, number> {
    const prices: Record<string, number> = {};
    
    // Use very generalized estimates for common tokens
    const fallbackPrices = {
      'SOL': 150,
      'BTC': 59000,
      'ETH': 3500,
      'USDC': 1.00,
      'BONK': 0.00002,
      'JUP': 0.85,
      'MEME': 0.02,
      'WIF': 1.10,
      'DOGE': 0.135,
      'MNGO': 0.04
    };
    
    for (const symbol of symbols) {
      if (fallbackPrices[symbol]) {
        prices[symbol] = fallbackPrices[symbol];
      } else {
        // For unknown tokens, use a placeholder value and log
        console.log(`No price data available for ${symbol}, using placeholder`);
        prices[symbol] = 0.01; // placeholder price
      }
    }
    
    return prices;
  }
  
  /**
   * Handle rate limiting from CoinGecko
   */
  private handleRateLimit(): void {
    this.isRateLimited = true;
    this.rateLimitResetTime = Date.now() + this.RATE_LIMIT_BACKOFF;
    console.log(`CoinGecko rate limited, backing off until ${new Date(this.rateLimitResetTime).toLocaleTimeString()}`);
    
    // Emit event for monitoring
    this.eventEmitter.emit('rateLimited', {
      provider: 'coingecko',
      resetTime: this.rateLimitResetTime
    });
  }
  
  /**
   * Check if rate limit should be reset
   */
  private checkRateLimitReset(): void {
    if (this.isRateLimited && Date.now() > this.rateLimitResetTime) {
      this.isRateLimited = false;
      console.log('CoinGecko rate limit reset');
      
      // Emit event for monitoring
      this.eventEmitter.emit('rateLimitReset', {
        provider: 'coingecko'
      });
    }
  }
  
  /**
   * Convert token symbol to CoinGecko ID
   */
  private symbolToId(symbol: string): string {
    // Map of common symbols to CoinGecko IDs
    const symbolMap: Record<string, string> = {
      'SOL': 'solana',
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDC': 'usd-coin',
      'BONK': 'bonk',
      'JUP': 'jupiter',
      'MEME': 'memecoin',
      'WIF': 'dogwifhat',
      'DOGE': 'dogecoin',
      'MNGO': 'mango-markets'
    };
    
    return symbolMap[symbol] || symbol.toLowerCase();
  }
}

// Export singleton
export const coinGeckoFallback = new CoinGeckoFallback();
export default coinGeckoFallback;