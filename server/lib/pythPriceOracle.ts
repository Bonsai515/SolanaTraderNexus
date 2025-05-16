/**
 * Pyth Price Oracle Integration
 * 
 * This module provides integration with the Pyth price oracle network
 * for real-time pricing data with the highest reliability.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as logger from '../logger';
import { executeWithRpcLoadBalancing } from './rpcConnectionManager';

// Pyth program ID on Solana mainnet
const PYTH_PROGRAM_ID = new PublicKey('FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH');

// Common token price account mapping
const PRICE_ACCOUNT_MAPPING: Record<string, string> = {
  'SOL/USD': 'H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG',
  'BTC/USD': 'GVXRSBjFk6e6J3NbVPXohDJetcTjaeeuykUpbQF8UoMU',
  'ETH/USD': 'JBu1AL4obBcCMqKBBxhpWCNUt136ijcuMZLFvTP7iWdB',
  'USDC/USD': 'Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD',
  'USDT/USD': '3vxLXJqLqF3JG5TCbYycbKWRBbCJQLxQmBGCkyqEEefL',
  'BONK/USD': '4MpGByJVZV4SqAFTTNL7jHxMuNXBTk9FNqwFLUXwS2gj',
  'JUP/USD': '7QP1ASEgQD9pMNm9eBVzPJQF8cMX9TxZM5BghiPNNKRx',
  'MEME/USD': 'BsNH5iSKrYLCndkLjG8xF4EnBBaKy3pwBvJTchCJSHcz',
  'JTO/USD': 'CzPRBJSEBUUgXZ4V2myKAUCG6wsSZhsQP3KLe8V95KTK',
};

// Price data interface
export interface PythPriceData {
  price: number;
  confidence: number;
  status: string;
  timestamp: number;
  previousPrice: number;
  previousTimestamp: number;
}

// Cache for price data
const priceCache = new Map<string, PythPriceData>();
let lastCacheUpdate = 0;
const CACHE_DURATION_MS = 10 * 1000; // 10 seconds

/**
 * Get price data from Pyth price oracle
 * @param symbol The symbol to get price data for (e.g. 'SOL/USD')
 */
export async function getPythPrice(symbol: string): Promise<PythPriceData | null> {
  try {
    // Check if we have cached data
    const now = Date.now();
    if (priceCache.has(symbol) && now - lastCacheUpdate < CACHE_DURATION_MS) {
      return priceCache.get(symbol) || null;
    }
    
    // Get price account for symbol
    const priceAccountKey = PRICE_ACCOUNT_MAPPING[symbol];
    if (!priceAccountKey) {
      logger.warn(`[Pyth] No price account found for symbol: ${symbol}`);
      return null;
    }
    
    const priceAccount = new PublicKey(priceAccountKey);
    
    // Fetch price data with RPC load balancing
    const priceData = await executeWithRpcLoadBalancing(async (connection) => {
      const accountInfo = await connection.getAccountInfo(priceAccount);
      if (!accountInfo) {
        throw new Error(`No account info found for price account: ${priceAccount.toBase58()}`);
      }
      
      return parsePriceData(accountInfo.data);
    });
    
    // Cache the data
    if (priceData) {
      priceCache.set(symbol, priceData);
      lastCacheUpdate = now;
    }
    
    return priceData;
  } catch (error) {
    logger.error(`[Pyth] Error getting price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Parse raw price data from Pyth
 */
function parsePriceData(data: Buffer): PythPriceData | null {
  try {
    // Credit to Pyth network for this parsing logic
    // Based on the Rust code provided in the example
    
    // Check for minimum data length
    if (data.length < 100) {
      return null;
    }
    
    // Magic number at offset 0, should be 0x50
    const magic = data.readUInt32LE(0);
    if (magic !== 0x50) {
      return null;
    }
    
    // Check version at offset 4
    const version = data.readUInt32LE(4);
    if (version !== 2) {
      return null;
    }
    
    // Account type at offset 8, should be 'price' (1)
    const accountType = data.readUInt32LE(8);
    if (accountType !== 1) {
      return null;
    }
    
    // Price status at offset 48
    const status = data.readUInt32LE(48);
    let statusText = 'unknown';
    switch (status) {
      case 1: statusText = 'trading'; break;
      case 2: statusText = 'halted'; break;
      case 3: statusText = 'auction'; break;
      default: statusText = 'unknown';
    }
    
    // Price value is i64, read as two i32s at offset 64
    const priceLow = data.readInt32LE(64);
    const priceHigh = data.readInt32LE(68);
    const price = priceLow + (priceHigh * 2**32);
    
    // Confidence value at offset 80
    const confidenceLow = data.readInt32LE(80);
    const confidenceHigh = data.readInt32LE(84);
    const confidence = confidenceLow + (confidenceHigh * 2**32);
    
    // Exponent at offset 96
    const expo = data.readInt32LE(96);
    
    // Calculate actual floating point price
    const actualPrice = price * Math.pow(10, expo);
    const actualConfidence = confidence * Math.pow(10, expo);
    
    // Timestamps
    const publishTime = Number(data.readBigUInt64LE(24));
    const prevPublishTime = Number(data.readBigUInt64LE(32));
    
    // Previous price
    const prevPriceLow = data.readInt32LE(104);
    const prevPriceHigh = data.readInt32LE(108);
    const prevPrice = (prevPriceLow + (prevPriceHigh * 2**32)) * Math.pow(10, expo);
    
    return {
      price: actualPrice,
      confidence: actualConfidence,
      status: statusText,
      timestamp: publishTime,
      previousPrice: prevPrice,
      previousTimestamp: prevPublishTime
    };
  } catch (error) {
    logger.error('[Pyth] Error parsing price data:', error);
    return null;
  }
}

/**
 * Get multiple price feeds at once
 */
export async function getMultiplePrices(symbols: string[]): Promise<Record<string, PythPriceData | null>> {
  const result: Record<string, PythPriceData | null> = {};
  
  const now = Date.now();
  const cacheMissSymbols: string[] = [];
  
  // Check cache first
  for (const symbol of symbols) {
    if (priceCache.has(symbol) && now - lastCacheUpdate < CACHE_DURATION_MS) {
      result[symbol] = priceCache.get(symbol) || null;
    } else {
      cacheMissSymbols.push(symbol);
      result[symbol] = null;
    }
  }
  
  // If we have any cache misses, fetch them
  if (cacheMissSymbols.length > 0) {
    // Get account keys for symbols
    const accountKeys = cacheMissSymbols
      .map(symbol => PRICE_ACCOUNT_MAPPING[symbol])
      .filter(key => !!key)
      .map(key => new PublicKey(key));
    
    if (accountKeys.length > 0) {
      try {
        // Fetch all accounts at once with RPC load balancing
        const accountInfos = await executeWithRpcLoadBalancing(async (connection) => {
          return await connection.getMultipleAccountsInfo(accountKeys);
        });
        
        // Parse and cache results
        for (let i = 0; i < accountInfos.length; i++) {
          const accountInfo = accountInfos[i];
          const symbol = cacheMissSymbols[i];
          
          if (accountInfo && symbol) {
            const priceData = parsePriceData(accountInfo.data);
            
            if (priceData) {
              priceCache.set(symbol, priceData);
              result[symbol] = priceData;
            }
          }
        }
        
        lastCacheUpdate = now;
      } catch (error) {
        logger.error('[Pyth] Error fetching multiple prices:', error);
      }
    }
  }
  
  return result;
}

/**
 * Clear the price cache
 */
export function clearPriceCache(): void {
  priceCache.clear();
  lastCacheUpdate = 0;
  logger.info('[Pyth] Price cache cleared');
}

/**
 * Get available symbols
 */
export function getAvailableSymbols(): string[] {
  return Object.keys(PRICE_ACCOUNT_MAPPING);
}

/**
 * Calculate price movement percentage
 */
export function calculatePriceMovement(priceData: PythPriceData): number {
  if (!priceData.previousPrice || priceData.previousPrice === 0) {
    return 0;
  }
  
  return ((priceData.price - priceData.previousPrice) / priceData.previousPrice) * 100;
}

/**
 * Check if price feed is healthy
 */
export function isPriceFeedHealthy(priceData: PythPriceData): boolean {
  // A price feed is considered healthy if:
  // 1. Status is 'trading'
  // 2. Confidence is reasonable (< 1% of price)
  // 3. Timestamp is recent (< 5 minutes old)
  
  const now = Date.now();
  const ageMs = now - priceData.timestamp;
  const confidencePct = (priceData.confidence / priceData.price) * 100;
  
  return (
    priceData.status === 'trading' &&
    confidencePct < 1.0 &&
    ageMs < 5 * 60 * 1000 // 5 minutes
  );
}