/**
 * Token API Service
 * 
 * Provides token data with cached fallbacks to avoid rate limiting issues
 */

import axios from 'axios';

// Token metadata
interface TokenMetadata {
  symbol: string;
  name: string;
  logo?: string;
  mint?: string;
  decimals?: number;
}

// Token price data
interface TokenPrice {
  symbol: string;
  price: number;
  price_change_24h: number;
  last_updated: number;
}

// Token trending data
interface TrendingToken {
  symbol: string;
  price_change_24h: number;
  volume_change_24h?: number;
}

// Cache settings
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// In-memory caches
const priceCache: Map<string, TokenPrice> = new Map();
const metadataCache: Map<string, TokenMetadata> = new Map();
const trendingCache: TrendingToken[] = [];
let trendingLastUpdated = 0;

// Common Solana tokens
const KNOWN_TOKENS: TokenMetadata[] = [
  { symbol: "SOL", name: "Solana" },
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "BONK", name: "Bonk" },
  { symbol: "JUP", name: "Jupiter" },
  { symbol: "MEME", name: "Memecoin" },
  { symbol: "WIF", name: "Dog Wif Hat" },
  { symbol: "POPCAT", name: "Popcat" },
  { symbol: "GUAC", name: "Guacamole" },
  { symbol: "BOOK", name: "Book" },
  { symbol: "PNUT", name: "Peanut" },
  { symbol: "SLERF", name: "Slerf" },
  { symbol: "MOON", name: "Moon" }
];

// Fallback price data
const FALLBACK_PRICES: TokenPrice[] = [
  { symbol: "SOL", price: 118.45, price_change_24h: 2.3, last_updated: Date.now() },
  { symbol: "USDC", price: 1.00, price_change_24h: 0.01, last_updated: Date.now() },
  { symbol: "BONK", price: 0.00002341, price_change_24h: 5.2, last_updated: Date.now() },
  { symbol: "JUP", price: 1.34, price_change_24h: 3.7, last_updated: Date.now() },
  { symbol: "MEME", price: 0.03451, price_change_24h: 7.8, last_updated: Date.now() },
  { symbol: "WIF", price: 0.89, price_change_24h: -2.1, last_updated: Date.now() },
  { symbol: "POPCAT", price: 0.0132, price_change_24h: 12.3, last_updated: Date.now() },
  { symbol: "GUAC", price: 0.0042, price_change_24h: -4.1, last_updated: Date.now() },
  { symbol: "BOOK", price: 0.0008, price_change_24h: 0.8, last_updated: Date.now() },
  { symbol: "PNUT", price: 0.0065, price_change_24h: 2.6, last_updated: Date.now() },
  { symbol: "SLERF", price: 0.0019, price_change_24h: 18.2, last_updated: Date.now() },
  { symbol: "MOON", price: 0.0245, price_change_24h: 9.3, last_updated: Date.now() }
];

// Initialize caches
function initializeCaches(): void {
  // Initialize metadata cache
  for (const token of KNOWN_TOKENS) {
    metadataCache.set(token.symbol, token);
  }
  
  // Initialize price cache
  for (const price of FALLBACK_PRICES) {
    priceCache.set(price.symbol, price);
  }
  
  // Initialize trending cache with simulated data
  updateTrendingTokens();
}

// Update trending tokens (simulated data)
function updateTrendingTokens(): void {
  const now = Date.now();
  
  // Only update every 5 minutes
  if (now - trendingLastUpdated < CACHE_DURATION) {
    return;
  }
  
  // Clear existing trending data
  trendingCache.length = 0;
  
  // Add trending tokens with randomized data
  for (const price of FALLBACK_PRICES) {
    // Add some randomness to price changes for simulation
    const randomFactor = 1 + (Math.random() * 0.2 - 0.1); // -10% to +10%
    const adjustedChange = price.price_change_24h * randomFactor;
    
    trendingCache.push({
      symbol: price.symbol,
      price_change_24h: +adjustedChange.toFixed(2),
      volume_change_24h: +(Math.random() * 40 - 10).toFixed(2) // -10% to +30%
    });
  }
  
  // Sort by absolute price change to get trending tokens
  trendingCache.sort((a, b) => Math.abs(b.price_change_24h) - Math.abs(a.price_change_24h));
  
  trendingLastUpdated = now;
}

// Get trending tokens
export function getTrendingTokens(limit: number = 10): TrendingToken[] {
  updateTrendingTokens();
  return trendingCache.slice(0, limit);
}

// Get token price
export function getTokenPrice(symbol: string): TokenPrice | null {
  symbol = symbol.toUpperCase();
  const cached = priceCache.get(symbol);
  
  if (cached) {
    return cached;
  }
  
  // Try to find in fallback data
  const fallback = FALLBACK_PRICES.find(t => t.symbol === symbol);
  if (fallback) {
    priceCache.set(symbol, fallback);
    return fallback;
  }
  
  return null;
}

// Get all token prices
export function getAllTokenPrices(): TokenPrice[] {
  return Array.from(priceCache.values());
}

// Initialize on module load
initializeCaches();

export default {
  getTrendingTokens,
  getTokenPrice,
  getAllTokenPrices
};