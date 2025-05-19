/**
 * Rate Limiting Optimization Exports
 * 
 * This module exports all rate limiting and optimization components.
 */

// Export rate limiting components
export { rateLimiter } from './rate-limiter/rate-limiter';
export { cacheStorage } from './caching/cache-storage';
export { apiClient } from './api/api-client';
export { rpcClient } from './rpc/rpc-client';
export { optimizedPriceFeed } from './price/optimized-price-feed';

/**
 * Initialize all rate limiting optimizations
 */
export function initializeRateLimitingOptimizations() {
  // All modules are initialized on import
  console.log('✅ Rate limiting optimizations initialized');
  
  return {
    rateLimiter,
    cacheStorage,
    apiClient,
    rpcClient,
    optimizedPriceFeed
  };
}