/**
 * Rate Limit Fixer for Solana RPC
 * 
 * This module drastically reduces RPC calls by implementing aggressive caching,
 * request batching, and rate limiting.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Cache directory
const CACHE_DIR = path.join(__dirname, '../data/rpc_cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// In-memory cache for fastest access
const memoryCache = new Map();

// Request throttling settings
const throttleConfig = {
  maxRequestsPerSecond: 20,
  maxRequestsPerMinute: 300,
  spreadRequests: true   // Spread requests evenly across time period
};

let requestsThisSecond = 0;
let requestsThisMinute = 0;
let lastSecondReset = Date.now();
let lastMinuteReset = Date.now();

// Reset counters periodically
setInterval(() => {
  const now = Date.now();
  
  // Reset second counter
  if (now - lastSecondReset >= 1000) {
    requestsThisSecond = 0;
    lastSecondReset = now;
  }
  
  // Reset minute counter
  if (now - lastMinuteReset >= 60000) {
    requestsThisMinute = 0;
    lastMinuteReset = now;
  }
}, 1000);

// Queue for delayed requests
const requestQueue = [];
let processingQueue = false;

// Process the request queue
async function processQueue() {
  if (processingQueue || requestQueue.length === 0) return;
  
  processingQueue = true;
  
  // Check if we can process a request
  const now = Date.now();
  
  if (requestsThisSecond < throttleConfig.maxRequestsPerSecond && 
      requestsThisMinute < throttleConfig.maxRequestsPerMinute) {
    
    const nextRequest = requestQueue.shift();
    
    if (nextRequest) {
      requestsThisSecond++;
      requestsThisMinute++;
      
      try {
        const result = await nextRequest.execute();
        nextRequest.resolve(result);
      } catch (error) {
        nextRequest.reject(error);
      }
    }
  }
  
  processingQueue = false;
  
  // If there are more requests and we're below limits, continue processing
  if (requestQueue.length > 0) {
    // Add a small delay to spread requests
    const delay = throttleConfig.spreadRequests ? Math.random() * 50 + 10 : 0;
    setTimeout(processQueue, delay);
  }
}

// Start a timer to regularly process queued requests
setInterval(processQueue, 50);

// Calculate cache key from method and parameters
function getCacheKey(method, params) {
  const paramsString = JSON.stringify(params);
  return crypto.createHash('md5').update(`${method}:${paramsString}`).digest('hex');
}

// Check if cached data is still valid
function isCacheValid(cacheFile, ttlMs) {
  try {
    const stats = fs.statSync(cacheFile);
    const fileAge = Date.now() - stats.mtimeMs;
    return fileAge < ttlMs;
  } catch (error) {
    return false;
  }
}

// Get cached data if available
function getCachedData(cacheKey, ttlMs) {
  // Check memory cache first (fastest)
  if (memoryCache.has(cacheKey)) {
    const cachedItem = memoryCache.get(cacheKey);
    if (Date.now() < cachedItem.expiry) {
      return cachedItem.data;
    }
    memoryCache.delete(cacheKey);
  }
  
  // Check file cache next
  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  if (isCacheValid(cacheFile, ttlMs)) {
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      
      // Also store in memory cache for faster access next time
      memoryCache.set(cacheKey, {
        data: data,
        expiry: Date.now() + ttlMs
      });
      
      return data;
    } catch (error) {
      // If reading cache fails, return null to trigger fresh fetch
      return null;
    }
  }
  
  return null;
}

// Save data to cache
function saveToCache(cacheKey, data, ttlMs) {
  // Save to memory cache
  memoryCache.set(cacheKey, {
    data: data,
    expiry: Date.now() + ttlMs
  });
  
  // Save to file cache
  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(data));
  } catch (error) {
    console.error('Error writing to cache:', error);
  }
}

// Get TTL based on method
function getTtlForMethod(method) {
  // Extended cache durations
  if (method.includes('getTransaction') || method.includes('getSignature')) {
    return 7200000; // 2 hours
  } else if (method.includes('getAccountInfo')) {
    return 120000; // 2 minutes
  } else if (method.includes('getBalance')) {
    return 120000; // 2 minutes
  } else if (method.includes('getSlot')) {
    return 30000; // 30 seconds
  } else if (method.includes('getBlock')) {
    return 300000; // 5 minutes
  } else if (method.includes('getTokenAccountsByOwner')) {
    return 180000; // 3 minutes
  } else if (method.includes('getProgramAccounts')) {
    return 300000; // 5 minutes
  } else if (method.includes('getRecentBlockhash')) {
    return 60000; // 1 minute
  }
  
  return 60000; // Default: 1 minute
}

// Throttled request function that respects rate limits
export async function throttledRequest(execute, method, params) {
  // Use cache if applicable
  const ttl = getTtlForMethod(method);
  const cacheKey = getCacheKey(method, params);
  
  // Skip cache for write methods and certain methods
  const skipCache = [
    'sendTransaction', 
    'simulateTransaction',
    'requestAirdrop'
  ].some(m => method.includes(m));
  
  if (!skipCache) {
    const cachedData = getCachedData(cacheKey, ttl);
    if (cachedData) {
      return cachedData;
    }
  }
  
  // Queue the request
  return new Promise((resolve, reject) => {
    requestQueue.push({
      execute,
      resolve: (result) => {
        // Save to cache if it's a read method
        if (!skipCache) {
          saveToCache(cacheKey, result, ttl);
        }
        resolve(result);
      },
      reject
    });
    
    // Start processing the queue
    processQueue();
  });
}

// Clean up old cache files periodically
export function startCacheCleanup() {
  setInterval(() => {
    try {
      const files = fs.readdirSync(CACHE_DIR);
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(CACHE_DIR, file);
        const stats = fs.statSync(filePath);
        const fileAge = Date.now() - stats.mtimeMs;
        
        // Delete files older than 24 hours
        if (fileAge > 24 * 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        console.log(`[Rate Limit Fixer] Cleaned up ${deletedCount} old cache files`);
      }
    } catch (error) {
      console.error('[Rate Limit Fixer] Error during cache cleanup:', error);
    }
  }, 60 * 60 * 1000); // Run every hour
}

// Start cache cleanup when module loads
startCacheCleanup();

// Export cache stats for monitoring
export function getCacheStats() {
  return {
    memoryCacheSize: memoryCache.size,
    filesCached: fs.existsSync(CACHE_DIR) ? fs.readdirSync(CACHE_DIR).length : 0,
    requestsThisSecond,
    requestsThisMinute,
    queueLength: requestQueue.length
  };
}