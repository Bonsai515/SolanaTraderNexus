/**
 * Optimized Streaming Price Feed
 * 
 * This module implements a streaming price feed that utilizes WebSocket
 * connections to reduce API requests and improve real-time price data.
 */

import { Connection } from '@solana/web3.js';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const PRICE_CACHE_FILE = path.join(process.cwd(), 'cache', 'price-cache.json');
const LOGS_DIR = path.join(process.cwd(), 'logs');
const PRICE_LOG_FILE = path.join(LOGS_DIR, 'price-updates.json');
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;

// Ensure directories exist
if (!fs.existsSync(path.dirname(PRICE_CACHE_FILE))) {
  fs.mkdirSync(path.dirname(PRICE_CACHE_FILE), { recursive: true });
}

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Type definitions
interface TokenPrice {
  symbol: string;
  priceUsd: number;
  lastUpdated: number;
  source: string;
  confidence: number;
}

interface PriceCache {
  [symbol: string]: TokenPrice;
}

// Class for managing streaming price data
class StreamingPriceFeed {
  private priceCache: PriceCache = {};
  private jupiterWs: WebSocket | null = null;
  private binanceWs: WebSocket | null = null;
  private updateCallbacks: Array<(symbol: string, price: TokenPrice) => void> = [];
  private lastPollTime: number = 0;
  private pollIntervalMs: number = 60000; // Fallback poll every minute
  private priorityTokens: string[] = ['SOL', 'USDC', 'ETH', 'BTC', 'BONK', 'JUP', 'MEME', 'WIF'];
  
  constructor() {
    // Load cache from file if it exists
    this.loadCache();
    
    // Start streaming connections
    this.initializeStreams();
    
    // Setup fallback polling
    setInterval(() => this.pollFallbackPrices(), this.pollIntervalMs);
    
    console.log('✅ Streaming price feed initialized');
  }
  
  /**
   * Load price cache from file
   */
  private loadCache(): void {
    try {
      if (fs.existsSync(PRICE_CACHE_FILE)) {
        const cacheData = fs.readFileSync(PRICE_CACHE_FILE, 'utf8');
        this.priceCache = JSON.parse(cacheData);
        console.log(`Loaded ${Object.keys(this.priceCache).length} token prices from cache`);
      }
    } catch (error) {
      console.error('Error loading price cache:', error);
    }
  }
  
  /**
   * Save price cache to file
   */
  private saveCache(): void {
    try {
      fs.writeFileSync(PRICE_CACHE_FILE, JSON.stringify(this.priceCache, null, 2));
    } catch (error) {
      console.error('Error saving price cache:', error);
    }
  }
  
  /**
   * Log price updates
   */
  private logPriceUpdate(symbol: string, price: TokenPrice, isStream: boolean): void {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        symbol,
        priceUsd: price.priceUsd,
        source: price.source,
        confidence: price.confidence,
        isStream
      };
      
      let logs: any[] = [];
      if (fs.existsSync(PRICE_LOG_FILE)) {
        const logData = fs.readFileSync(PRICE_LOG_FILE, 'utf8');
        logs = JSON.parse(logData);
      }
      
      logs.unshift(logEntry); // Add to beginning
      
      // Keep log size manageable
      if (logs.length > 1000) {
        logs = logs.slice(0, 1000);
      }
      
      fs.writeFileSync(PRICE_LOG_FILE, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Error logging price update:', error);
    }
  }
  
  /**
   * Initialize WebSocket streams
   */
  private initializeStreams(): void {
    // Initialize Jupiter WebSocket
    this.initializeJupiterStream();
    
    // Initialize Binance WebSocket
    this.initializeBinanceStream();
  }
  
  /**
   * Initialize Jupiter WebSocket stream
   */
  private initializeJupiterStream(): void {
    try {
      // Jupiter API v4 WebSocket for price updates
      this.jupiterWs = new WebSocket('wss://price.jup.ag/price');
      
      this.jupiterWs.on('open', () => {
        console.log('✅ Connected to Jupiter price stream');
        
        // Subscribe to priority tokens
        this.priorityTokens.forEach(symbol => {
          this.jupiterWs?.send(JSON.stringify({
            type: 'subscribe',
            symbol
          }));
        });
      });
      
      this.jupiterWs.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'price') {
            const { symbol, price } = message;
            
            if (symbol && price) {
              const tokenPrice: TokenPrice = {
                symbol,
                priceUsd: parseFloat(price),
                lastUpdated: Date.now(),
                source: 'jupiter-stream',
                confidence: 0.95 // High confidence for streaming data
              };
              
              this.updatePrice(symbol, tokenPrice, true);
            }
          }
        } catch (error) {
          console.error('Error processing Jupiter message:', error);
        }
      });
      
      this.jupiterWs.on('error', (error) => {
        console.error('Jupiter WebSocket error:', error);
        
        // Attempt to reconnect after a delay
        setTimeout(() => this.initializeJupiterStream(), 10000);
      });
      
      this.jupiterWs.on('close', () => {
        console.log('Jupiter WebSocket connection closed. Reconnecting...');
        
        // Attempt to reconnect after a delay
        setTimeout(() => this.initializeJupiterStream(), 10000);
      });
    } catch (error) {
      console.error('Error initializing Jupiter stream:', error);
    }
  }
  
  /**
   * Initialize Binance WebSocket stream
   */
  private initializeBinanceStream(): void {
    try {
      // Binance WebSocket for major tokens
      const symbols = ['SOLUSDT', 'ETHUSDT', 'BTCUSDT'];
      const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
      
      this.binanceWs = new WebSocket(`wss://stream.binance.com:9443/ws/${streams}`);
      
      this.binanceWs.on('open', () => {
        console.log('✅ Connected to Binance price stream');
      });
      
      this.binanceWs.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.e === '24hrTicker') {
            const binanceSymbol = message.s;
            let symbol = '';
            
            // Map Binance symbols to our format
            if (binanceSymbol === 'SOLUSDT') symbol = 'SOL';
            else if (binanceSymbol === 'ETHUSDT') symbol = 'ETH';
            else if (binanceSymbol === 'BTCUSDT') symbol = 'BTC';
            else return;
            
            const tokenPrice: TokenPrice = {
              symbol,
              priceUsd: parseFloat(message.c), // Current price
              lastUpdated: Date.now(),
              source: 'binance-stream',
              confidence: 0.98 // Very high confidence for Binance
            };
            
            this.updatePrice(symbol, tokenPrice, true);
          }
        } catch (error) {
          console.error('Error processing Binance message:', error);
        }
      });
      
      this.binanceWs.on('error', (error) => {
        console.error('Binance WebSocket error:', error);
        
        // Attempt to reconnect after a delay
        setTimeout(() => this.initializeBinanceStream(), 15000);
      });
      
      this.binanceWs.on('close', () => {
        console.log('Binance WebSocket connection closed. Reconnecting...');
        
        // Attempt to reconnect after a delay
        setTimeout(() => this.initializeBinanceStream(), 15000);
      });
    } catch (error) {
      console.error('Error initializing Binance stream:', error);
    }
  }
  
  /**
   * Update price in cache and notify subscribers
   */
  private updatePrice(symbol: string, price: TokenPrice, isStream: boolean): void {
    // Update cache
    this.priceCache[symbol] = price;
    
    // Save cache periodically (every 10 updates)
    if (Object.keys(this.priceCache).length % 10 === 0) {
      this.saveCache();
    }
    
    // Log price update
    this.logPriceUpdate(symbol, price, isStream);
    
    // Notify subscribers
    this.updateCallbacks.forEach(callback => {
      try {
        callback(symbol, price);
      } catch (error) {
        console.error('Error in price update callback:', error);
      }
    });
  }
  
  /**
   * Poll fallback prices for tokens not covered by streams
   */
  private async pollFallbackPrices(): Promise<void> {
    const now = Date.now();
    
    // Don't poll too frequently
    if (now - this.lastPollTime < this.pollIntervalMs) {
      return;
    }
    
    this.lastPollTime = now;
    
    try {
      // Use CoinGecko for fallback prices
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price',
        {
          params: {
            ids: 'solana,ethereum,bitcoin,jupiter,bonk,memecoin',
            vs_currencies: 'usd',
            include_24hr_change: 'true'
          },
          timeout: 5000
        }
      );
      
      if (response.data) {
        const data = response.data;
        
        // Update prices from response
        if (data.solana) {
          this.updatePrice('SOL', {
            symbol: 'SOL',
            priceUsd: data.solana.usd,
            lastUpdated: now,
            source: 'coingecko-poll',
            confidence: 0.9
          }, false);
        }
        
        if (data.ethereum) {
          this.updatePrice('ETH', {
            symbol: 'ETH',
            priceUsd: data.ethereum.usd,
            lastUpdated: now,
            source: 'coingecko-poll',
            confidence: 0.9
          }, false);
        }
        
        if (data.bitcoin) {
          this.updatePrice('BTC', {
            symbol: 'BTC',
            priceUsd: data.bitcoin.usd,
            lastUpdated: now,
            source: 'coingecko-poll',
            confidence: 0.9
          }, false);
        }
        
        if (data.jupiter) {
          this.updatePrice('JUP', {
            symbol: 'JUP',
            priceUsd: data.jupiter.usd,
            lastUpdated: now,
            source: 'coingecko-poll',
            confidence: 0.85
          }, false);
        }
        
        if (data.bonk) {
          this.updatePrice('BONK', {
            symbol: 'BONK',
            priceUsd: data.bonk.usd,
            lastUpdated: now,
            source: 'coingecko-poll',
            confidence: 0.85
          }, false);
        }
        
        if (data.memecoin) {
          this.updatePrice('MEME', {
            symbol: 'MEME',
            priceUsd: data.memecoin.usd,
            lastUpdated: now,
            source: 'coingecko-poll',
            confidence: 0.85
          }, false);
        }
        
        console.log(`Updated ${Object.keys(data).length} token prices from fallback poll`);
      }
    } catch (error) {
      console.error('Error polling fallback prices:', error);
      
      // Try Jupiter API as a secondary fallback
      try {
        const jupiterResponse = await axios.get(
          'https://price.jup.ag/v4/price',
          {
            params: {
              ids: this.priorityTokens.join(',')
            },
            timeout: 5000
          }
        );
        
        if (jupiterResponse.data && jupiterResponse.data.data) {
          const data = jupiterResponse.data.data;
          
          for (const [symbol, priceData] of Object.entries(data)) {
            if (priceData.price) {
              this.updatePrice(symbol, {
                symbol,
                priceUsd: parseFloat(priceData.price),
                lastUpdated: now,
                source: 'jupiter-poll',
                confidence: 0.9
              }, false);
            }
          }
          
          console.log(`Updated ${Object.keys(data).length} token prices from Jupiter API`);
        }
      } catch (jupiterError) {
        console.error('Error polling Jupiter prices:', jupiterError);
      }
    }
  }
  
  /**
   * Subscribe to price updates
   */
  public subscribeToUpdates(callback: (symbol: string, price: TokenPrice) => void): void {
    this.updateCallbacks.push(callback);
  }
  
  /**
   * Get current price for a token
   */
  public getPrice(symbol: string): TokenPrice | null {
    return this.priceCache[symbol] || null;
  }
  
  /**
   * Get all current prices
   */
  public getAllPrices(): PriceCache {
    return { ...this.priceCache };
  }
  
  /**
   * Force an immediate update for a specific token
   */
  public async forceUpdate(symbol: string): Promise<TokenPrice | null> {
    try {
      // Try Jupiter API for quick price
      const response = await axios.get(
        `https://price.jup.ag/v4/price?ids=${symbol}`,
        { timeout: 3000 }
      );
      
      if (response.data && response.data.data && response.data.data[symbol]) {
        const price = parseFloat(response.data.data[symbol].price);
        
        const tokenPrice: TokenPrice = {
          symbol,
          priceUsd: price,
          lastUpdated: Date.now(),
          source: 'jupiter-forced',
          confidence: 0.9
        };
        
        this.updatePrice(symbol, tokenPrice, false);
        return tokenPrice;
      }
    } catch (error) {
      console.error(`Error forcing update for ${symbol}:`, error);
    }
    
    return null;
  }
  
  /**
   * Check if a price is stale
   */
  public isPriceStale(symbol: string, maxAgeMs: number = 60000): boolean {
    const price = this.priceCache[symbol];
    if (!price) return true;
    
    return Date.now() - price.lastUpdated > maxAgeMs;
  }
  
  /**
   * Get streaming status
   */
  public getStreamingStatus(): { jupiter: boolean, binance: boolean } {
    return {
      jupiter: this.jupiterWs?.readyState === WebSocket.OPEN,
      binance: this.binanceWs?.readyState === WebSocket.OPEN
    };
  }
}

// Create and export singleton instance
export const streamingPriceFeed = new StreamingPriceFeed();

// If this module is run directly, start and monitor the price feed
if (require.main === module) {
  const feed = streamingPriceFeed;
  
  feed.subscribeToUpdates((symbol, price) => {
    console.log(`${symbol}: $${price.priceUsd.toFixed(4)} (${price.source})`);
  });
  
  console.log('Streaming price feed running...');
  console.log('Press Ctrl+C to exit');
  
  // Keep process running
  setInterval(() => {
    const status = feed.getStreamingStatus();
    console.log(`Stream status - Jupiter: ${status.jupiter ? 'Connected' : 'Disconnected'}, Binance: ${status.binance ? 'Connected' : 'Disconnected'}`);
    
    const prices = feed.getAllPrices();
    console.log(`Tracking ${Object.keys(prices).length} tokens`);
  }, 30000);
}