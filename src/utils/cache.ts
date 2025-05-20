/**
 * Setup Enhanced Disk Cache
 */

import * as fs from 'fs';
import * as path from 'path';

const CACHE_DIR = './data/rpc_cache';

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Create .cache file to indicate cache is active
fs.writeFileSync(path.join(CACHE_DIR, '.cache'), 'ACTIVE');

// Simple in-memory cache
const memoryCache = new Map();

// Export cache functions
export function getCachedData(key, defaultTtlMs = 300000) {
  // Check memory cache first
  if (memoryCache.has(key)) {
    const item = memoryCache.get(key);
    if (Date.now() < item.expiry) {
      return item.data;
    }
    memoryCache.delete(key);
  }
  
  // Then check disk cache
  const cacheFile = path.join(CACHE_DIR, `${key}.json`);
  
  if (fs.existsSync(cacheFile)) {
    try {
      const stats = fs.statSync(cacheFile);
      const fileAge = Date.now() - stats.mtimeMs;
      
      if (fileAge < defaultTtlMs) {
        const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        
        // Also store in memory for faster access next time
        memoryCache.set(key, {
          data,
          expiry: Date.now() + defaultTtlMs
        });
        
        return data;
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
  }
  
  return null;
}

export function setCachedData(key, data, ttlMs = 300000) {
  // Set in memory cache
  memoryCache.set(key, {
    data,
    expiry: Date.now() + ttlMs
  });
  
  // Also set in disk cache
  const cacheFile = path.join(CACHE_DIR, `${key}.json`);
  
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(data));
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

console.log('Enhanced disk cache system initialized');
