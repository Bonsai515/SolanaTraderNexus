/**
 * Price Feed Cache Loader
 * 
 * This module loads the price feed cache and ensures it's available globally.
 */

import { priceFeedCache } from './lib/priceFeedCache';
import { promisify } from 'util';

// Export the price feed cache
export { priceFeedCache };

// Function to wait for initialization
export const waitForPriceFeedInit = () => {
  return new Promise<void>((resolve) => {
    if (priceFeedCache.isInitialized()) {
      resolve();
      return;
    }
    
    priceFeedCache.once('initialized', () => {
      resolve();
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      console.warn('[PriceFeedLoader] Timed out waiting for price feed initialization');
      resolve();
    }, 10000);
  });
};

// Request a price update
export const updatePrices = async () => {
  return priceFeedCache.forceUpdate();
};

// Get price for a token
export const getTokenPrice = (token: string) => {
  return priceFeedCache.getPrice(token);
};

// Get price data for a token
export const getTokenPriceData = (token: string) => {
  return priceFeedCache.getPriceData(token);
};

// Get token to token price
export const getTokenToTokenPrice = (baseToken: string, quoteToken: string) => {
  return priceFeedCache.getTokenToTokenPrice(baseToken, quoteToken);
};

// Get all prices
export const getAllPrices = () => {
  return priceFeedCache.getAllPrices();
};

// Initialize on import
(async () => {
  console.log('[PriceFeedLoader] Waiting for price feed initialization...');
  await waitForPriceFeedInit();
  console.log('[PriceFeedLoader] Price feed initialized');
})();
