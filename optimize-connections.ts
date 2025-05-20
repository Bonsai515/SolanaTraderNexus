/**
 * Optimize Connection Rates
 * 
 * This script implements connection rate optimization to prevent 429 errors.
 */

// Patch global fetch for rate limiting
const originalFetch = global.fetch;
const fetchQueue = [];
let processingQueue = false;
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL_MS = 100; // At least 100ms between fetches

// Replace global fetch with rate-limited version
global.fetch = function rateLimitedFetch(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    fetchQueue.push({ url, options, resolve, reject });
    
    if (!processingQueue) {
      processFetchQueue();
    }
  });
};

// Process fetch queue with rate limiting
async function processFetchQueue() {
  if (fetchQueue.length === 0) {
    processingQueue = false;
    return;
  }
  
  processingQueue = true;
  
  const { url, options, resolve, reject } = fetchQueue.shift()!;
  
  try {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;
    
    if (timeSinceLastFetch < MIN_FETCH_INTERVAL_MS) {
      // Wait if we're fetching too quickly
      await new Promise(r => setTimeout(r, MIN_FETCH_INTERVAL_MS - timeSinceLastFetch));
    }
    
    lastFetchTime = Date.now();
    const response = await originalFetch(url, options);
    resolve(response);
  } catch (error) {
    reject(error);
  }
  
  // Process next item in queue with a small delay
  setTimeout(processFetchQueue, 10);
}

// Log that optimization is active
console.log('[Connection Optimizer] Active - Rate limiting connections to prevent 429 errors');

// Export empty object to make this a valid module
export {};
