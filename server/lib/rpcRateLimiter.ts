/**
 * RPC Rate Limiter
 * 
 * This module provides rate limiting for Solana RPC requests 
 * to prevent hitting API rate limits.
 */

import * as logger from '../logger';

// Configuration
const DEFAULT_MAX_REQUESTS_PER_MINUTE = 225;
const MAX_QUEUE_SIZE = 1000;
const MINUTE_MS = 60 * 1000;

// Tracking
let requestQueue: Array<() => Promise<any>> = [];
let requestTimestamps: number[] = [];
let isProcessing = false;
let maxRequestsPerMinute = DEFAULT_MAX_REQUESTS_PER_MINUTE;

/**
 * Calculate the current request rate per minute
 */
function getCurrentRequestRate(): number {
  const now = Date.now();
  
  // Filter out requests older than 1 minute
  requestTimestamps = requestTimestamps.filter(timestamp => now - timestamp < MINUTE_MS);
  
  // Return current rate
  return requestTimestamps.length;
}

/**
 * Process the request queue
 */
async function processQueue() {
  if (isProcessing || requestQueue.length === 0) {
    return;
  }
  
  isProcessing = true;
  
  try {
    while (requestQueue.length > 0) {
      // Check current rate
      const currentRate = getCurrentRequestRate();
      
      // If we're at or above the limit, wait
      if (currentRate >= maxRequestsPerMinute) {
        const waitTime = Math.max(50, Math.min(1000, (currentRate - maxRequestsPerMinute + 5) * 10));
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // Get the next request
      const request = requestQueue.shift();
      if (!request) continue;
      
      // Add timestamp
      requestTimestamps.push(Date.now());
      
      // Execute the request (don't await it)
      request().catch(error => {
        logger.error('[RPC Rate Limiter] Error executing queued request:', error);
      });
      
      // Small delay between requests to avoid spikes
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  } catch (error) {
    logger.error('[RPC Rate Limiter] Error processing queue:', error);
  } finally {
    isProcessing = false;
    
    // If there are still requests, process them
    if (requestQueue.length > 0) {
      processQueue();
    }
  }
}

/**
 * Execute a function with rate limiting
 */
export async function withRateLimiting<T>(fn: () => Promise<T>): Promise<T> {
  // Check if queue is too large
  if (requestQueue.length > MAX_QUEUE_SIZE) {
    throw new Error('RPC request queue is full');
  }
  
  // Check current rate
  const currentRate = getCurrentRequestRate();
  
  // If we're below 75% of the limit, execute immediately
  if (currentRate < maxRequestsPerMinute * 0.75) {
    requestTimestamps.push(Date.now());
    return fn();
  }
  
  // Otherwise, queue the request
  return new Promise<T>((resolve, reject) => {
    const request = async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    requestQueue.push(request);
    processQueue();
  });
}

/**
 * Update the maximum requests per minute
 */
export function updateMaxRequestsPerMinute(newMax: number): void {
  // Ensure we don't set to something too low
  if (newMax >= 10) {
    maxRequestsPerMinute = newMax;
    logger.info(`[RPC Rate Limiter] Updated max requests per minute to ${maxRequestsPerMinute}`);
  }
}

/**
 * Get the current rate limit stats
 */
export function getRateLimitStats() {
  return {
    maxRequestsPerMinute,
    currentRequestRate: getCurrentRequestRate(),
    queueSize: requestQueue.length,
    utilizationPercent: Math.round((getCurrentRequestRate() / maxRequestsPerMinute) * 100)
  };
}

/**
 * Reset the rate limiter
 */
export function resetRateLimiter(): void {
  requestQueue = [];
  requestTimestamps = [];
  isProcessing = false;
  maxRequestsPerMinute = DEFAULT_MAX_REQUESTS_PER_MINUTE;
  
  logger.info('[RPC Rate Limiter] Rate limiter reset');
}

// Set a more aggressive rate limit for certain endpoints
export function setAggressiveRateLimiting(): void {
  updateMaxRequestsPerMinute(150);
  logger.info('[RPC Rate Limiter] Set aggressive rate limiting (150 requests/minute)');
}

// Set a normal rate limit
export function setNormalRateLimiting(): void {
  updateMaxRequestsPerMinute(DEFAULT_MAX_REQUESTS_PER_MINUTE);
  logger.info('[RPC Rate Limiter] Set normal rate limiting (225 requests/minute)');
}

// Initialize
logger.info(`[RPC Rate Limiter] Initialized with ${maxRequestsPerMinute} requests/minute limit`);