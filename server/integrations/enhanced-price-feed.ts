/**
 * Enhanced Price Feed Integration for Trading Strategies
 * Auto-generated - DO NOT MODIFY DIRECTLY
 */

import {
  getTokenPrice,
  getMultipleTokenPrices,
  getCachedSolPrice,
  getSupportedTokens
} from '../../src/price-feed';

/**
 * Get price for a token with strategy-specific options
 */
async function getTokenPriceForStrategy(token: string, strategy: string): Promise<number> {
  // Strategy-specific logic can be added here
  return getTokenPrice(token);
}

/**
 * Get multiple token prices for a strategy
 */
async function getTokenPricesForStrategy(tokens: string[], strategy: string): Promise<Record<string, number>> {
  // Strategy-specific logic can be added here
  return getMultipleTokenPrices(tokens);
}

/**
 * Interface for price feed service
 */
const enhancedPriceFeedService = {
  // Core price methods
  getTokenPrice,
  getMultipleTokenPrices,
  getCachedSolPrice,
  getSupportedTokens,
  
  // Strategy-specific methods
  getTokenPriceForStrategy,
  getTokenPricesForStrategy,
  
  // Convenience methods for strategies
  getSolPrice: getCachedSolPrice,
  
  // Strategy-specific convenience methods
  getQuantumFlashPrice: (token: string) => getTokenPriceForStrategy(token, 'quantum-flash'),
  getQuantumOmegaPrice: (token: string) => getTokenPriceForStrategy(token, 'quantum-omega'),
  getZeroCapitalPrice: (token: string) => getTokenPriceForStrategy(token, 'zero-capital'),
  getHyperionPrice: (token: string) => getTokenPriceForStrategy(token, 'hyperion')
};

export default enhancedPriceFeedService;
