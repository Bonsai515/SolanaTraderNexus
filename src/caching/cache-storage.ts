/**
 * Cache Storage Module
 * 
 * This module provides a caching mechanism for reducing API calls and rate limiting.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Cache directory
const CACHE_DIR = path.join(process.cwd(), 'cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Cache entry type
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
}

/**
 * Generate a cache key from a request
 */
function generateCacheKey(provider: string, method: string, params: any): string {
  const data = JSON.stringify({ provider, method, params });
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Save data to cache
 */
function saveToCache<T>(key: string, data: T, ttlMs: number): void {
  const cachePath = path.join(CACHE_DIR, `${key}.json`);
  
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    expires: Date.now() + ttlMs
  };
  
  fs.writeFileSync(cachePath, JSON.stringify(entry));
}

/**
 * Get data from cache
 */
function getFromCache<T>(key: string): T | null {
  const cachePath = path.join(CACHE_DIR, `${key}.json`);
  
  if (!fs.existsSync(cachePath)) {
    return null;
  }
  
  try {
    const entry: CacheEntry<T> = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    
    // Check if cache has expired
    if (Date.now() > entry.expires) {
      // Cache has expired, delete the file
      fs.unlinkSync(cachePath);
      return null;
    }
    
    return entry.data;
  } catch (error) {
    // Error reading cache, delete the file
    fs.unlinkSync(cachePath);
    return null;
  }
}

/**
 * Check if cache exists and is valid
 */
function cacheExists(key: string): boolean {
  const cachePath = path.join(CACHE_DIR, `${key}.json`);
  
  if (!fs.existsSync(cachePath)) {
    return false;
  }
  
  try {
    const entry = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    
    // Check if cache has expired
    if (Date.now() > entry.expires) {
      // Cache has expired, delete the file
      fs.unlinkSync(cachePath);
      return false;
    }
    
    return true;
  } catch (error) {
    // Error reading cache, delete the file
    fs.unlinkSync(cachePath);
    return false;
  }
}

/**
 * Clear expired cache entries
 */
function clearExpiredCache(): void {
  const files = fs.readdirSync(CACHE_DIR);
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    const cachePath = path.join(CACHE_DIR, file);
    
    try {
      const entry = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      
      // Check if cache has expired
      if (Date.now() > entry.expires) {
        // Cache has expired, delete the file
        fs.unlinkSync(cachePath);
      }
    } catch (error) {
      // Error reading cache, delete the file
      fs.unlinkSync(cachePath);
    }
  }
}

// Export the cache functions
export const cacheStorage = {
  generateCacheKey,
  saveToCache,
  getFromCache,
  cacheExists,
  clearExpiredCache
};