/**
 * Rate Limiter Implementation
 * 
 * This module implements advanced rate limiting strategies to prevent 429 errors.
 */

import fs from 'fs';
import path from 'path';
import { cacheStorage } from '../caching/cache-storage';

// Load configuration
const CONFIG_DIR = path.join(process.cwd(), 'config');
const rateLimiterConfigPath = path.join(CONFIG_DIR, 'rate-limiter-config.json');
const config = JSON.parse(fs.readFileSync(rateLimiterConfigPath, 'utf8'));

// Provider state tracking
const providerState: Record<string, {
  lastRequestTime: number;
  requestCount: number;
  consecutiveFailures: number;
  circuitOpen: boolean;
  currentLimit: number;
  successCount: number;
  tokens: number;
  lastRefillTime: number;
}> = {};

// Initialize provider state
for (const [provider, settings] of Object.entries(config.providers)) {
  providerState[provider] = {
    lastRequestTime: 0,
    requestCount: 0,
    consecutiveFailures: 0,
    circuitOpen: false,
    currentLimit: settings.maxRequestsPerMinute,
    successCount: 0,
    tokens: config.strategies[settings.strategy].initialTokens || 10,
    lastRefillTime: Date.now()
  };
}

/**
 * Check if a request should be rate limited
 */
function shouldRateLimit(provider: string, method: string, params: any): boolean {
  // If provider not configured, don't rate limit
  if (!config.providers[provider]) {
    return false;
  }
  
  const providerConfig = config.providers[provider];
  const state = providerState[provider];
  
  // Circuit breaker check
  if (config.circuitBreaker.enabled && state.circuitOpen) {
    console.log(`[Rate Limiter] Circuit open for ${provider}, blocking request`);
    return true;
  }
  
  // Check cache first if enabled
  if (providerConfig.useCaching) {
    const cacheKey = cacheStorage.generateCacheKey(provider, method, params);
    if (cacheStorage.cacheExists(cacheKey)) {
      // Cache hit, no need to make a request
      return false;
    }
  }
  
  // Apply rate limiting strategy
  const strategy = config.strategies[providerConfig.strategy];
  
  switch (strategy.type) {
    case 'token':
      return applyTokenBucketStrategy(provider, strategy);
    
    case 'adaptive':
      return applyAdaptiveStrategy(provider, strategy);
    
    case 'exponentialBackoff':
      return applyExponentialBackoffStrategy(provider, strategy);
    
    default:
      return applySimpleRateLimiting(provider, providerConfig);
  }
}

/**
 * Apply simple rate limiting
 */
function applySimpleRateLimiting(provider: string, providerConfig: any): boolean {
  const state = providerState[provider];
  const now = Date.now();
  
  // Check time between requests
  if (now - state.lastRequestTime < providerConfig.minTimeBetweenRequestsMs) {
    return true;
  }
  
  // Check requests per minute
  if (state.requestCount >= providerConfig.maxRequestsPerMinute) {
    return true;
  }
  
  // Update state
  state.lastRequestTime = now;
  state.requestCount++;
  
  // Reset request count every minute
  setTimeout(() => {
    state.requestCount--;
  }, 60000);
  
  return false;
}

/**
 * Apply token bucket strategy
 */
function applyTokenBucketStrategy(provider: string, strategy: any): boolean {
  const state = providerState[provider];
  const now = Date.now();
  
  // Refill tokens based on time elapsed
  const timeElapsed = now - state.lastRefillTime;
  const tokensToAdd = (timeElapsed / 1000) * strategy.refillRatePerSecond;
  
  state.tokens = Math.min(strategy.bucketSize, state.tokens + tokensToAdd);
  state.lastRefillTime = now;
  
  // Check if we have enough tokens
  if (state.tokens < 1) {
    return true;
  }
  
  // Consume a token
  state.tokens--;
  return false;
}

/**
 * Apply adaptive strategy
 */
function applyAdaptiveStrategy(provider: string, strategy: any): boolean {
  const state = providerState[provider];
  const now = Date.now();
  
  // Check if we're under the current limit
  if (state.requestCount >= state.currentLimit) {
    return true;
  }
  
  // Update state
  state.lastRequestTime = now;
  state.requestCount++;
  
  // Reset request count every minute
  setTimeout(() => {
    state.requestCount--;
  }, 60000);
  
  return false;
}

/**
 * Apply exponential backoff strategy
 */
function applyExponentialBackoffStrategy(provider: string, strategy: any): boolean {
  const state = providerState[provider];
  const now = Date.now();
  
  // Calculate backoff time based on consecutive failures
  if (state.consecutiveFailures > 0) {
    const backoffTime = strategy.initialDelay * Math.pow(strategy.factor, state.consecutiveFailures - 1);
    const jitter = backoffTime * strategy.jitter * (Math.random() * 2 - 1);
    const totalBackoff = Math.min(strategy.maxDelay, backoffTime + jitter);
    
    // Check if we've waited long enough
    if (now - state.lastRequestTime < totalBackoff) {
      return true;
    }
  }
  
  // Update state
  state.lastRequestTime = now;
  
  return false;
}

/**
 * Handle successful request
 */
function handleSuccess(provider: string): void {
  if (!providerState[provider]) return;
  
  const state = providerState[provider];
  const providerConfig = config.providers[provider];
  const strategy = config.strategies[providerConfig.strategy];
  
  // Reset consecutive failures
  state.consecutiveFailures = 0;
  
  // Increment success count
  state.successCount++;
  
  // For adaptive strategy, increase limit if success threshold reached
  if (strategy.type === 'adaptive' && state.successCount >= strategy.successThreshold) {
    state.currentLimit = Math.min(
      strategy.maxLimit,
      state.currentLimit + state.currentLimit * strategy.increaseFactor
    );
    state.successCount = 0;
  }
  
  // Close circuit if open
  if (state.circuitOpen && config.circuitBreaker.halfOpenRequests <= 1) {
    state.circuitOpen = false;
  }
}

/**
 * Handle failed request
 */
function handleFailure(provider: string, statusCode: number): void {
  if (!providerState[provider]) return;
  
  const state = providerState[provider];
  const providerConfig = config.providers[provider];
  const strategy = config.strategies[providerConfig.strategy];
  
  // Increment consecutive failures
  state.consecutiveFailures++;
  
  // Reset success count
  state.successCount = 0;
  
  // For adaptive strategy, decrease limit
  if (strategy.type === 'adaptive') {
    state.currentLimit = Math.max(
      strategy.minLimit,
      state.currentLimit * strategy.decreaseFactor
    );
  }
  
  // Trip circuit breaker if threshold reached
  if (config.circuitBreaker.enabled && 
      state.consecutiveFailures >= config.circuitBreaker.failureThreshold) {
    state.circuitOpen = true;
    
    // Reset circuit after timeout
    setTimeout(() => {
      state.circuitOpen = false;
      state.consecutiveFailures = 0;
    }, config.circuitBreaker.resetTimeoutMs);
  }
  
  // Log rate limiting
  if (statusCode === 429 && config.globalSettings.logRateLimiting) {
    console.warn(`[Rate Limiter] Rate limit hit for ${provider}, backing off`);
  }
}

/**
 * Cache response data
 */
function cacheResponse(provider: string, method: string, params: any, data: any): void {
  if (!config.providers[provider] || !config.providers[provider].useCaching) {
    return;
  }
  
  const cacheKey = cacheStorage.generateCacheKey(provider, method, params);
  cacheStorage.saveToCache(cacheKey, data, config.providers[provider].cacheTimeMs);
}

/**
 * Get cached response
 */
function getCachedResponse<T>(provider: string, method: string, params: any): T | null {
  if (!config.providers[provider] || !config.providers[provider].useCaching) {
    return null;
  }
  
  const cacheKey = cacheStorage.generateCacheKey(provider, method, params);
  return cacheStorage.getFromCache<T>(cacheKey);
}

/**
 * Calculate retry delay
 */
function calculateRetryDelay(provider: string, attempt: number): number {
  if (!config.providers[provider]) {
    return 1000 * Math.pow(2, attempt - 1); // Default exponential backoff
  }
  
  const providerConfig = config.providers[provider];
  const strategy = config.strategies[providerConfig.strategy];
  
  if (strategy.type === 'exponentialBackoff') {
    return Math.min(
      strategy.maxDelay,
      strategy.initialDelay * Math.pow(strategy.factor, attempt - 1)
    );
  }
  
  // Default exponential backoff
  return 1000 * Math.pow(2, attempt - 1);
}

// Export the rate limiter
export const rateLimiter = {
  shouldRateLimit,
  handleSuccess,
  handleFailure,
  cacheResponse,
  getCachedResponse,
  calculateRetryDelay
};