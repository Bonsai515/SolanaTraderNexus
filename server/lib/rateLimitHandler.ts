/**
 * Rate Limit Handler with Exponential Backoff
 * This utility handles rate limiting and implements exponential backoff strategies
 * to prevent 429 Too Many Requests errors.
 */

import * as logger from '../logger';

interface RequestConfig {
  name: string;
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  delayFactor?: number;
}

// Cache to track last request time for each endpoint
const rateLimitCache: Record<string, {
  lastRequest: number;
  consecutiveFailures: number;
  currentDelay: number;
}> = {};

// Default settings
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY = 500; // 500ms
const DEFAULT_MAX_DELAY = 30000; // 30 seconds
const DEFAULT_DELAY_FACTOR = 2; // Each retry doubles the delay

/**
 * Execute a function with rate limiting and exponential backoff
 * @param config Request configuration
 * @param requestFn The function to execute
 * @returns The result of the function
 */
export async function executeWithRateLimit<T>(
  config: RequestConfig,
  requestFn: () => Promise<T>
): Promise<T> {
  const {
    name,
    maxRetries = DEFAULT_MAX_RETRIES,
    initialDelay = DEFAULT_INITIAL_DELAY,
    maxDelay = DEFAULT_MAX_DELAY,
    delayFactor = DEFAULT_DELAY_FACTOR
  } = config;
  
  // Initialize or get rate limit state for this endpoint
  if (!rateLimitCache[name]) {
    rateLimitCache[name] = {
      lastRequest: 0,
      consecutiveFailures: 0,
      currentDelay: initialDelay
    };
  }
  
  const endpointState = rateLimitCache[name];
  let retries = 0;
  
  // Calculate time since last request
  const now = Date.now();
  const timeSinceLastRequest = now - endpointState.lastRequest;
  
  // If we've had consecutive failures, apply backoff
  if (endpointState.consecutiveFailures > 0) {
    const requiredDelay = Math.min(
      endpointState.currentDelay,
      maxDelay
    );
    
    // If not enough time has passed since the last request
    if (timeSinceLastRequest < requiredDelay) {
      const waitTime = requiredDelay - timeSinceLastRequest;
      logger.info(`Rate limiting ${name}, waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // Loop until success or max retries
  while (true) {
    try {
      // Mark this request time
      endpointState.lastRequest = Date.now();
      
      // Execute the request
      const result = await requestFn();
      
      // Reset failures on success
      endpointState.consecutiveFailures = 0;
      endpointState.currentDelay = initialDelay;
      
      return result;
    } catch (error: any) {
      // Check for rate limit error
      const isRateLimited = 
        error.message?.includes('429') || 
        error.message?.includes('Too many requests') ||
        error.response?.status === 429;
      
      // Increment failures and calculate new delay
      endpointState.consecutiveFailures++;
      
      if (isRateLimited) {
        // Increase delay with exponential backoff
        endpointState.currentDelay = Math.min(
          endpointState.currentDelay * delayFactor,
          maxDelay
        );
        
        logger.warn(`Server responded with 429 Too Many Requests. Retrying after ${endpointState.currentDelay}ms delay...`);
      } else {
        // For other errors, use a smaller backoff
        endpointState.currentDelay = Math.min(
          initialDelay * Math.pow(1.5, endpointState.consecutiveFailures),
          maxDelay
        );
        
        logger.error(`Request to ${name} failed: ${error.message}`);
      }
      
      // Check if we've reached max retries
      if (retries >= maxRetries) {
        logger.error(`Maximum retries (${maxRetries}) reached for ${name}`);
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, endpointState.currentDelay));
      retries++;
    }
  }
}

/**
 * Clear the rate limit cache for a specific endpoint or all endpoints
 * @param name Optional endpoint name. If not provided, clears all cache entries
 */
export function clearRateLimitCache(name?: string): void {
  if (name) {
    if (rateLimitCache[name]) {
      rateLimitCache[name] = {
        lastRequest: 0,
        consecutiveFailures: 0,
        currentDelay: DEFAULT_INITIAL_DELAY
      };
      logger.info(`Rate limit cache cleared for ${name}`);
    }
  } else {
    // Clear all cache entries
    Object.keys(rateLimitCache).forEach(key => {
      rateLimitCache[key] = {
        lastRequest: 0,
        consecutiveFailures: 0,
        currentDelay: DEFAULT_INITIAL_DELAY
      };
    });
    logger.info('All rate limit cache entries cleared');
  }
}