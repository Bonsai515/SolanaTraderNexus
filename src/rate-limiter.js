/**
 * Rate Limiting Middleware
 * 
 * This module provides a global rate limiter for all RPC requests
 * to prevent rate limiting from providers.
 */

const { performance } = require('perf_hooks');

// Request tracking
const requestCounts = {
  total: 0,
  perSecond: 0,
  perMinute: 0,
  lastSecondReset: performance.now(),
  lastMinuteReset: performance.now(),
  inFlight: 0
};

// Rate limits from .env or defaults
const MAX_REQUESTS_PER_SECOND = parseInt(process.env.MAX_REQUESTS_PER_SECOND || '5', 10);
const MAX_REQUESTS_PER_MINUTE = parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '100', 10);
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '3', 10);
const REQUEST_COOLDOWN_MS = parseInt(process.env.REQUEST_COOLDOWN_MS || '3000', 10);

// Priority queue for requests
const requestQueue = [];
let processingQueue = false;
let isThrottled = false;
let throttleEndTime = 0;

/**
 * Reset the per-second counter
 */
function resetSecondCounter() {
  const now = performance.now();
  if (now - requestCounts.lastSecondReset >= 1000) {
    requestCounts.perSecond = 0;
    requestCounts.lastSecondReset = now;
  }
}

/**
 * Reset the per-minute counter
 */
function resetMinuteCounter() {
  const now = performance.now();
  if (now - requestCounts.lastMinuteReset >= 60000) {
    requestCounts.perMinute = 0;
    requestCounts.lastMinuteReset = now;
  }
}

/**
 * Check if the system is currently throttled
 */
function isSystemThrottled() {
  if (isThrottled && performance.now() < throttleEndTime) {
    return true;
  }
  
  isThrottled = false;
  return false;
}

/**
 * Throttle the system for a period
 */
function throttleSystem(durationMs = REQUEST_COOLDOWN_MS) {
  isThrottled = true;
  throttleEndTime = performance.now() + durationMs;
  console.log(`[Rate Limiter] System throttled for ${durationMs}ms`);
}

/**
 * Process the request queue
 */
async function processQueue() {
  if (processingQueue || requestQueue.length === 0) return;
  
  processingQueue = true;
  
  while (requestQueue.length > 0) {
    resetSecondCounter();
    resetMinuteCounter();
    
    // Check if we're throttled
    if (isSystemThrottled()) {
      // Wait until throttling ends
      const waitTime = throttleEndTime - performance.now();
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      continue;
    }
    
    // Check rate limits
    if (
      requestCounts.perSecond >= MAX_REQUESTS_PER_SECOND ||
      requestCounts.perMinute >= MAX_REQUESTS_PER_MINUTE ||
      requestCounts.inFlight >= MAX_CONCURRENT_REQUESTS
    ) {
      // Wait before trying again
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }
    
    // Process next request
    const nextRequest = requestQueue.shift();
    
    // Track request counts
    requestCounts.total++;
    requestCounts.perSecond++;
    requestCounts.perMinute++;
    requestCounts.inFlight++;
    
    try {
      // Execute the request
      const result = await nextRequest.fn(...nextRequest.args);
      nextRequest.resolve(result);
    } catch (error) {
      // Check if it's a rate limit error
      if (error.message && error.message.includes('429')) {
        console.log('[Rate Limiter] Detected 429 response, throttling system');
        throttleSystem(REQUEST_COOLDOWN_MS * 2); // Double throttle time for 429s
      }
      
      nextRequest.reject(error);
    } finally {
      requestCounts.inFlight--;
    }
    
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  processingQueue = false;
}

/**
 * Rate-limited request function
 */
function limitedRequest(fn, priority = 'normal') {
  return function(...args) {
    return new Promise((resolve, reject) => {
      // Skip rate limiting for high priority requests
      if (priority === 'critical') {
        // Still count the request
        requestCounts.total++;
        requestCounts.perSecond++;
        requestCounts.perMinute++;
        requestCounts.inFlight++;
        
        // Execute immediately
        return fn(...args)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            requestCounts.inFlight--;
          });
      }
      
      // Add to queue based on priority
      const request = { fn, args, resolve, reject, priority };
      
      if (priority === 'high') {
        // High priority goes to the front
        requestQueue.unshift(request);
      } else {
        // Normal and low priority go to the end
        requestQueue.push(request);
      }
      
      // Start processing queue if not already
      processQueue();
    });
  };
}

module.exports = {
  limitedRequest,
  throttleSystem,
  getRequestCounts: () => ({ ...requestCounts })
};