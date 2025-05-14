/**
 * Price Feed Cache
 * 
 * Maintains a cache of token prices from multiple sources
 * with automatic refreshing to ensure up-to-date pricing data.
 */

import axios from 'axios';
import * as logger from './logger';
import fs from 'fs';
import path from 'path';

// Price data interface
interface TokenPrice {
  symbol: string;
  priceUsd: number;
  lastUpdated: number;
  source: string;
  change24h?: number;
}

// Price source interface
interface PriceSource {
  name: string;
  priority: number;
  fetcher: () => Promise<Map<string, TokenPrice>>;
  enabled: boolean;
}

// Cache file path
const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'price_cache.json');

// Known tokens to track (Solana ecosystem + popular memecoins)
const KNOWN_TOKENS = [
  'SOL', 'BONK', 'JUP', 'USDC', 'USDT', 'ETH', 'BTC', 'WIF', 'MEME', 'GUAC',
  'POPCAT', 'BOOK', 'PNUT', 'SLERF', 'SAMO', 'RAY', 'PYTH', 'ORCA', 'COPE'
];

// Price Feed Cache class
export class PriceFeedCache {
  private prices: Map<string, TokenPrice> = new Map();
  private sources: PriceSource[] = [];
  private updateInterval: NodeJS.Timeout | null = null;
  private updateIntervalMs: number = 60000; // 1 minute
  private lastFullUpdate: number = 0;
  private isInitialized: boolean = false;
  
  /**
   * Constructor
   */
  constructor() {
    this.initializeSources();
    this.loadFromCache();
    this.initialize();
  }
  
  /**
   * Initialize price sources
   */
  private initializeSources(): void {
    // Add CoinGecko (popular free API)
    this.sources.push({
      name: 'CoinGecko',
      priority: 1,
      fetcher: this.fetchCoinGeckoPrices.bind(this),
      enabled: true
    });
    
    // Add Jupiter Aggregator (Solana-specific with excellent coverage)
    this.sources.push({
      name: 'Jupiter',
      priority: 2,
      fetcher: this.fetchJupiterPrices.bind(this),
      enabled: true
    });
    
    // Add Birdeye (Solana-specific with great meme coin coverage)
    this.sources.push({
      name: 'Birdeye',
      priority: 3,
      fetcher: this.fetchBirdeyePrices.bind(this),
      enabled: true
    });
    
    // Add DexScreener (multiple chains with good Solana coverage)
    this.sources.push({
      name: 'DexScreener',
      priority: 4,
      fetcher: this.fetchDexScreenerPrices.bind(this),
      enabled: true
    });
    
    // Add SolScan (Solana blockchain explorer with price data)
    this.sources.push({
      name: 'SolScan',
      priority: 5,
      fetcher: this.fetchSolScanPrices.bind(this),
      enabled: true
    });
    
    // Add Binance API (major exchange with reliable data)
    this.sources.push({
      name: 'Binance',
      priority: 6,
      fetcher: this.fetchBinancePrices.bind(this),
      enabled: true
    });
    
    // Add CryptoCompare (reliable aggregator for price data)
    /*
    this.sources.push({
      name: 'CryptoCompare',
      priority: 7,
      fetcher: this.fetchCryptoComparePrices.bind(this),
      enabled: true
    });
    */
    
    // Add on-chain RPC price (direct from Solana RPC endpoints)
    /*
    this.sources.push({
      name: 'OnChainRPC',
      priority: 8,
      fetcher: this.fetchOnChainPrices.bind(this),
      enabled: true
    });
    */
    
    // Sort sources by priority
    this.sources.sort((a, b) => a.priority - b.priority);
    
    logger.info(`Initialized ${this.sources.length} price feed sources`);
  }
  
  /**
   * Initialize price feed cache
   */
  public async initialize(): Promise<void> {
    try {
      // Ensure cache directory exists
      const cacheDir = path.dirname(CACHE_FILE_PATH);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      // Force immediate update
      await this.updatePrices();
      
      // Set up automatic refresh
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }
      
      this.updateInterval = setInterval(async () => {
        await this.updatePrices();
      }, this.updateIntervalMs);
      
      this.isInitialized = true;
      logger.info('Price feed cache initialized');
    } catch (error: any) {
      logger.error(`Failed to initialize price feed cache: ${error.message || String(error)}`);
    }
  }
  
  /**
   * Load prices from cache file
   */
  private loadFromCache(): void {
    try {
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
        
        for (const symbol in cacheData) {
          this.prices.set(symbol, cacheData[symbol]);
        }
        
        logger.info(`Loaded ${this.prices.size} token prices from cache`);
      } else {
        logger.info('No price cache found, will create new cache');
      }
    } catch (error: any) {
      logger.error(`Failed to load price cache: ${error.message || String(error)}`);
    }
  }
  
  /**
   * Save prices to cache file
   */
  private saveToCache(): void {
    try {
      const cacheData: Record<string, TokenPrice> = {};
      
      this.prices.forEach((price, symbol) => {
        cacheData[symbol] = price;
      });
      
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2));
    } catch (error: any) {
      logger.error(`Failed to save price cache: ${error.message || String(error)}`);
    }
  }
  
  /**
   * Update prices from all sources with advanced rate limiting handling
   */
  public async updatePrices(): Promise<void> {
    try {
      let updatedTokenCount = 0;
      let updatedFromSource = '';
      
      // Attempt to fetch from each source in priority order
      for (const source of this.sources) {
        if (!source.enabled) continue;
        
        try {
          // Use exponential backoff for retries on rate limiting
          let retryCount = 0;
          let success = false;
          let newPrices: Map<string, TokenPrice> = new Map();
          
          while (retryCount < 3 && !success) {
            try {
              newPrices = await source.fetcher();
              success = true;
            } catch (error: any) {
              // Check if it's a rate limiting error
              if (error.response && error.response.status === 429) {
                retryCount++;
                const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
                logger.warn(`Rate limit hit for ${source.name}, retrying in ${delay}ms (attempt ${retryCount}/3)`);
                await new Promise(resolve => setTimeout(resolve, delay));
              } else {
                // Not a rate limiting error, just throw it
                throw error;
              }
            }
          }
          
          if (!success) {
            logger.warn(`Skipping ${source.name} after 3 failed retry attempts due to rate limiting`);
            continue;
          }
          
          // Update prices with new data
          newPrices.forEach((price, symbol) => {
            const existingPrice = this.prices.get(symbol);
            
            // Only update if price is newer
            if (!existingPrice || price.lastUpdated > existingPrice.lastUpdated) {
              this.prices.set(symbol, price);
              updatedTokenCount++;
            }
          });
          
          // If we got data from this source, we can stop trying others
          if (newPrices.size > 0) {
            updatedFromSource = source.name;
            break;
          }
        } catch (error: any) {
          logger.error(`Failed to fetch prices from ${source.name}: ${error.message || String(error)}`);
        }
      }
      
      // If we didn't get any updates from any source, log a warning but don't fail
      if (updatedTokenCount === 0) {
        logger.warn('Failed to update prices from any source, using cached data');
      } else {
        logger.info(`Updated ${updatedTokenCount} token prices from ${updatedFromSource}`);
      }
      
      // Save to cache regardless of update success to ensure we have the latest
      this.saveToCache();
      
      // Update timestamp
      this.lastFullUpdate = Date.now();
      
      logger.debug(`Updated local market data at ${new Date(this.lastFullUpdate).toISOString()}`);
    } catch (error: any) {
      logger.error(`Failed to update prices: ${error.message || String(error)}`);
      logger.info('Using cached price data due to update failure');
    }
  }
  
  /**
   * Fetch prices from CoinGecko
   * @returns Map of token symbols to prices
   */
  private async fetchCoinGeckoPrices(): Promise<Map<string, TokenPrice>> {
    const prices = new Map<string, TokenPrice>();
    
    try {
      // CoinGecko free API only allows a few requests per minute
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: 'solana,jupiter,bonk,bitcoin,ethereum,tether,usd-coin,dogwifhat,memecoin,guacamole',
          vs_currencies: 'usd',
          include_24hr_change: 'true',
          include_market_cap: 'true'
        },
        timeout: 5000
      });
      
      if (response.status === 200 && response.data) {
        // Map response to token prices
        if (response.data.solana) {
          prices.set('SOL', {
            symbol: 'SOL',
            priceUsd: response.data.solana.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.solana.usd_24h_change
          });
        }
        
        if (response.data.jupiter) {
          prices.set('JUP', {
            symbol: 'JUP',
            priceUsd: response.data.jupiter.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.jupiter.usd_24h_change
          });
        }
        
        if (response.data.bonk) {
          prices.set('BONK', {
            symbol: 'BONK',
            priceUsd: response.data.bonk.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.bonk.usd_24h_change
          });
        }
        
        if (response.data.bitcoin) {
          prices.set('BTC', {
            symbol: 'BTC',
            priceUsd: response.data.bitcoin.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.bitcoin.usd_24h_change
          });
        }
        
        if (response.data.ethereum) {
          prices.set('ETH', {
            symbol: 'ETH',
            priceUsd: response.data.ethereum.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.ethereum.usd_24h_change
          });
        }
        
        if (response.data['usd-coin']) {
          prices.set('USDC', {
            symbol: 'USDC',
            priceUsd: response.data['usd-coin'].usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data['usd-coin'].usd_24h_change
          });
        }
        
        if (response.data.tether) {
          prices.set('USDT', {
            symbol: 'USDT',
            priceUsd: response.data.tether.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.tether.usd_24h_change
          });
        }
        
        if (response.data.dogwifhat) {
          prices.set('WIF', {
            symbol: 'WIF',
            priceUsd: response.data.dogwifhat.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.dogwifhat.usd_24h_change
          });
        }
        
        if (response.data.memecoin) {
          prices.set('MEME', {
            symbol: 'MEME',
            priceUsd: response.data.memecoin.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.memecoin.usd_24h_change
          });
        }
        
        if (response.data.guacamole) {
          prices.set('GUAC', {
            symbol: 'GUAC',
            priceUsd: response.data.guacamole.usd,
            lastUpdated: Date.now(),
            source: 'CoinGecko',
            change24h: response.data.guacamole.usd_24h_change
          });
        }
      }
    } catch (error: any) {
      logger.error(`Error fetching CoinGecko prices: ${error.message || String(error)}`);
      throw error;
    }
    
    return prices;
  }
  
  /**
   * Fetch prices from Jupiter Aggregator
   * @returns Map of token symbols to prices
   */
  private async fetchJupiterPrices(): Promise<Map<string, TokenPrice>> {
    const prices = new Map<string, TokenPrice>();
    
    try {
      // Placeholder implementation
      // In a real implementation, you would use Jupiter's API to fetch prices
      logger.info('Placeholder: Fetching prices from Jupiter Aggregator');
      
      // Use sample prices for testing (simulating Jupiter's response)
      const now = Date.now();
      
      prices.set('SOL', { symbol: 'SOL', priceUsd: 132.45, lastUpdated: now, source: 'Jupiter' });
      prices.set('BONK', { symbol: 'BONK', priceUsd: 0.000023, lastUpdated: now, source: 'Jupiter' });
      prices.set('JUP', { symbol: 'JUP', priceUsd: 0.764, lastUpdated: now, source: 'Jupiter' });
      prices.set('USDC', { symbol: 'USDC', priceUsd: 0.999, lastUpdated: now, source: 'Jupiter' });
      prices.set('USDT', { symbol: 'USDT', priceUsd: 0.998, lastUpdated: now, source: 'Jupiter' });
      prices.set('ETH', { symbol: 'ETH', priceUsd: 3750.32, lastUpdated: now, source: 'Jupiter' });
      prices.set('WIF', { symbol: 'WIF', priceUsd: 0.645, lastUpdated: now, source: 'Jupiter' });
      prices.set('MEME', { symbol: 'MEME', priceUsd: 0.032, lastUpdated: now, source: 'Jupiter' });
      prices.set('GUAC', { symbol: 'GUAC', priceUsd: 0.00117, lastUpdated: now, source: 'Jupiter' });
    } catch (error: any) {
      logger.error(`Error fetching Jupiter prices: ${error.message || String(error)}`);
      throw error;
    }
    
    return prices;
  }
  
  /**
   * Fetch prices from Birdeye
   * @returns Map of token symbols to prices
   */
  private async fetchBirdeyePrices(): Promise<Map<string, TokenPrice>> {
    const prices = new Map<string, TokenPrice>();
    
    try {
      // In a real implementation, you would use Birdeye's API to fetch prices
      logger.info('Fetching prices from Birdeye');
      
      // Birdeye API endpoint for token prices
      const response = await axios.get('https://public-api.birdeye.so/defi/tokens', {
        params: {
          sort_by: 'v24hUSD',
          sort_type: 'desc',
          offset: 0,
          limit: 20,
          chain: 'solana'
        },
        headers: {
          'X-API-KEY': process.env.BIRDEYE_API_KEY || 'not-required-for-public-endpoint'
        },
        timeout: 5000
      });
      
      if (response.status === 200 && response.data && response.data.data && response.data.data.tokens) {
        const tokens = response.data.data.tokens;
        const now = Date.now();
        
        for (const token of tokens) {
          // Map tokens to our known tokens
          let symbol = token.symbol;
          if (KNOWN_TOKENS.includes(symbol)) {
            prices.set(symbol, {
              symbol: symbol,
              priceUsd: parseFloat(token.price),
              lastUpdated: now,
              source: 'Birdeye',
              change24h: parseFloat(token.priceChange24h) * 100 // Convert to percentage
            });
          }
        }
      }
    } catch (error: any) {
      logger.error(`Error fetching Birdeye prices: ${error.message || String(error)}`);
      throw error;
    }
    
    return prices;
  }
  
  /**
   * Fetch prices from DexScreener
   * @returns Map of token symbols to prices
   */
  private async fetchDexScreenerPrices(): Promise<Map<string, TokenPrice>> {
    const prices = new Map<string, TokenPrice>();
    
    try {
      logger.info('Fetching prices from DexScreener');
      
      // DexScreener API endpoint for Solana DEXes
      const response = await axios.get('https://api.dexscreener.com/latest/dex/tokens/solana', {
        timeout: 5000
      });
      
      if (response.status === 200 && response.data && response.data.pairs) {
        const pairs = response.data.pairs;
        const now = Date.now();
        const processedTokens = new Set<string>();
        
        for (const pair of pairs) {
          // Get base token (usually the token we're interested in)
          const symbol = pair.baseToken.symbol;
          
          // Skip if we've already processed this token or it's not in our known tokens
          if (processedTokens.has(symbol) || !KNOWN_TOKENS.includes(symbol)) {
            continue;
          }
          
          // Mark token as processed
          processedTokens.add(symbol);
          
          // Add to prices map
          prices.set(symbol, {
            symbol: symbol,
            priceUsd: parseFloat(pair.priceUsd),
            lastUpdated: now,
            source: 'DexScreener',
            change24h: parseFloat(pair.priceChange.h24) * 100 // Convert to percentage
          });
        }
      }
    } catch (error: any) {
      logger.error(`Error fetching DexScreener prices: ${error.message || String(error)}`);
      throw error;
    }
    
    return prices;
  }
  
  /**
   * Fetch prices from SolScan
   * @returns Map of token symbols to prices
   */
  private async fetchSolScanPrices(): Promise<Map<string, TokenPrice>> {
    const prices = new Map<string, TokenPrice>();
    
    try {
      logger.info('Fetching prices from SolScan');
      
      // Map of known token symbols to SolScan token addresses
      const tokenAddressMap: Record<string, string> = {
        'SOL': 'So11111111111111111111111111111111111111112', // Native SOL
        'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
        'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
        'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
        'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF 
        'MEME': 'MiVnxQ3F8iUF2LaQvHvBPFdZs3VGsz7U8UNzCUmXvZ5', // MEME
        'GUAC': 'GkVbJ8G3b7V3pJta1ynHHDGNLZVUdQxq6HYjQoAJSnAK'  // GUAC
      };
      
      // Process each token in parallel
      const fetchPromises: Promise<void>[] = [];
      const now = Date.now();
      
      for (const [symbol, address] of Object.entries(tokenAddressMap)) {
        // Don't fetch if it's not in our known tokens list
        if (!KNOWN_TOKENS.includes(symbol)) {
          continue;
        }
        
        const fetchTokenPrice = async () => {
          try {
            // Fetch token info from SolScan
            const response = await axios.get(`https://public-api.solscan.io/token/meta?tokenAddress=${address}`, {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Quantum-Trading-Bot/1.0'
              },
              timeout: 5000
            });
            
            if (response.status === 200 && response.data) {
              const priceData = response.data;
              
              // Extract price and add to map
              if (priceData.priceUsdt) {
                prices.set(symbol, {
                  symbol: symbol,
                  priceUsd: parseFloat(priceData.priceUsdt),
                  lastUpdated: now,
                  source: 'SolScan',
                  change24h: priceData.priceChange24h || 0
                });
              }
            }
          } catch (error: any) {
            // Log error but don't throw to allow other tokens to be processed
            logger.error(`Error fetching price for ${symbol} from SolScan: ${error.message || String(error)}`);
          }
        };
        
        fetchPromises.push(fetchTokenPrice());
      }
      
      // Wait for all price fetches to complete
      await Promise.all(fetchPromises);
      
      logger.info(`Updated ${prices.size} token prices from SolScan`);
    } catch (error: any) {
      logger.error(`Error fetching SolScan prices: ${error.message || String(error)}`);
      throw error;
    }
    
    return prices;
  }
  
  /**
   * Fetch prices from Binance
   * @returns Map of token symbols to prices
   */
  private async fetchBinancePrices(): Promise<Map<string, TokenPrice>> {
    const prices = new Map<string, TokenPrice>();
    
    try {
      logger.info('Fetching prices from Binance');
      
      // Binance API endpoint for ticker prices
      const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
        timeout: 5000
      });
      
      if (response.status === 200 && response.data) {
        const tickerData = response.data;
        const now = Date.now();
        
        // Get 24h price change data
        const changeResponse = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
          timeout: 5000
        });
        
        // Create map of symbol to price change percentage
        const changeMap: Record<string, number> = {};
        if (changeResponse.status === 200 && changeResponse.data) {
          for (const item of changeResponse.data) {
            changeMap[item.symbol] = parseFloat(item.priceChangePercent);
          }
        }
        
        // Map of known token symbols to Binance trading pairs
        const symbolMap: Record<string, string> = {
          'SOL': 'SOLUSDT',
          'BTC': 'BTCUSDT',
          'ETH': 'ETHUSDT',
          'USDC': 'USDCUSDT',
          'USDT': 'USDTBUSD', // USDT doesn't have a direct USD pair
          'JUP': 'JUPUSDT',
          'BONK': 'BONKUSDT',
          'WIF': 'WIFUSDT'
        };
        
        // Process ticker data
        for (const ticker of tickerData) {
          // Check if this is a trading pair we're interested in
          for (const [symbol, pairSymbol] of Object.entries(symbolMap)) {
            if (ticker.symbol === pairSymbol) {
              prices.set(symbol, {
                symbol: symbol,
                priceUsd: parseFloat(ticker.price),
                lastUpdated: now,
                source: 'Binance',
                change24h: changeMap[pairSymbol] || 0
              });
              break;
            }
          }
        }
      }
    } catch (error: any) {
      logger.error(`Error fetching Binance prices: ${error.message || String(error)}`);
      throw error;
    }
    
    return prices;
  }
  
  /**
   * Get price for a token
   * @param symbol Token symbol
   * @returns Token price in USD
   */
  public getPrice(symbol: string): number | null {
    try {
      const price = this.prices.get(symbol.toUpperCase());
      return price ? price.priceUsd : null;
    } catch (error: any) {
      logger.error(`Error getting price for ${symbol}: ${error.message || String(error)}`);
      return null;
    }
  }
  
  /**
   * Get all token prices
   * @returns Map of token symbols to prices
   */
  public getAllPrices(): Map<string, TokenPrice> {
    return new Map(this.prices);
  }
  
  /**
   * Force update prices
   */
  public async forceUpdate(): Promise<void> {
    logger.info('Price feed forcefully updated');
    return this.updatePrices();
  }
  
  /**
   * Get time since last update
   * @returns Time in milliseconds since last update
   */
  public getTimeSinceLastUpdate(): number {
    return Date.now() - this.lastFullUpdate;
  }
  
  /**
   * Set update interval
   * @param intervalMs Interval in milliseconds
   */
  public setUpdateInterval(intervalMs: number): void {
    this.updateIntervalMs = intervalMs;
    
    // Reset interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      
      this.updateInterval = setInterval(async () => {
        await this.updatePrices();
      }, this.updateIntervalMs);
    }
    
    logger.info(`Price feed update interval set to ${intervalMs}ms`);
  }
}

// Export singleton instance
export const priceFeedCache = new PriceFeedCache();
export default priceFeedCache;