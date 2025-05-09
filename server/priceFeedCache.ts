/**
 * Price Feed Cache Service
 * 
 * Provides a centralized caching mechanism for price data with:
 * - Real-time price data cache for all components
 * - Automatic backup functionality if main data sources fail
 * - Websocket broadcast of price updates to all connected clients
 * - Support for multiple data sources with failover
 */

import { MarketData } from './transformers';
import { logger } from './logger';
import { WebSocket } from 'ws';
import fs from 'fs/promises';
import path from 'path';

// Directory for storing cached price data backups
const CACHE_DIR = path.join(process.cwd(), 'data/price_cache');

// Refresh intervals
const CACHE_REFRESH_INTERVAL = 30 * 1000; // 30 seconds
const BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface PriceData {
  pair: string;
  price: number;
  volume: number;
  timestamp: Date;
  source: string;
}

interface CachedMarketData {
  pair: string;
  data: MarketData;
  lastUpdated: Date;
  backupTimestamp?: Date;
}

class PriceFeedCache {
  private priceCache: Map<string, PriceData> = new Map();
  private marketDataCache: Map<string, CachedMarketData> = new Map();
  private wsClients: Set<WebSocket> = new Set();
  private refreshInterval: NodeJS.Timeout | null = null;
  private backupInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;
  private primaryDataSources: string[] = ['helius', 'instant_nodes', 'jupiter_api']; 
  private backupDataSources: string[] = ['public_rpc', 'cached_backup'];
  private activeDataSource: string = 'instant_nodes'; // Default source

  constructor() {
    this.ensureCacheDir();
  }

  /**
   * Initialize the price feed cache service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing price feed cache service');
    
    try {
      // Create cache directory if it doesn't exist
      await this.ensureCacheDir();
      
      // Try to load any existing cache data from backup files
      await this.loadCachedBackups();
      
      // Start the refresh interval
      this.startRefreshInterval();
      
      // Start the backup interval
      this.startBackupInterval();
      
      this.initialized = true;
      logger.info('Price feed cache service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize price feed cache service:', error);
      throw new Error(`Failed to initialize price feed cache: ${error.message}`);
    }
  }

  /**
   * Add a WebSocket client to broadcast price updates to
   */
  public addClient(ws: WebSocket): void {
    this.wsClients.add(ws);
    
    // Send initial cache data to client
    this.sendCacheToClient(ws);
    
    // Remove client when connection closes
    ws.on('close', () => {
      this.wsClients.delete(ws);
    });
  }

  /**
   * Get the latest price data for a specific pair
   */
  public getPriceData(pair: string): PriceData | null {
    return this.priceCache.get(pair) || null;
  }

  /**
   * Get all cached price data
   */
  public getAllPriceData(): Map<string, PriceData> {
    return new Map(this.priceCache);
  }

  /**
   * Get all market data
   */
  public getAllMarketData(): Map<string, CachedMarketData> {
    return new Map(this.marketDataCache);
  }

  /**
   * Get the latest market data for a specific pair
   */
  public getMarketData(pair: string): MarketData | null {
    const cached = this.marketDataCache.get(pair);
    return cached ? cached.data : null;
  }

  /**
   * Update price data in the cache
   */
  public updatePriceData(data: PriceData): void {
    this.priceCache.set(data.pair, data);
    
    // Broadcast to all connected clients
    this.broadcastPriceUpdate(data);
  }

  /**
   * Update market data in the cache
   */
  public updateMarketData(pair: string, data: MarketData): void {
    const now = new Date();
    
    this.marketDataCache.set(pair, {
      pair,
      data,
      lastUpdated: now
    });
    
    // Extract and update latest price
    if (data.prices && data.prices.length > 0) {
      const latestPriceData = data.prices[data.prices.length - 1];
      
      this.updatePriceData({
        pair,
        price: latestPriceData[1],
        volume: data.volumes && data.volumes.length > 0 
          ? data.volumes[data.volumes.length - 1][1] 
          : 0,
        timestamp: now,
        source: this.activeDataSource
      });
    }
    
    // Broadcast to all connected clients
    this.broadcastMarketDataUpdate(pair);
  }

  /**
   * Switch to a different data source if the primary fails
   */
  public switchDataSource(reason: string): boolean {
    const currentIndex = this.primaryDataSources.indexOf(this.activeDataSource);
    
    // Try next primary source
    if (currentIndex < this.primaryDataSources.length - 1) {
      this.activeDataSource = this.primaryDataSources[currentIndex + 1];
      logger.info(`Switching price feed to ${this.activeDataSource} (${reason})`);
      return true;
    }
    
    // If all primary sources failed, try backup sources
    for (const backupSource of this.backupDataSources) {
      if (backupSource === 'cached_backup') {
        logger.warn('All live price feeds failed, using cached backups');
        // We're already using cached data at this point
        this.activeDataSource = backupSource;
        return true;
      } else {
        this.activeDataSource = backupSource;
        logger.info(`Switching price feed to backup source ${backupSource} (${reason})`);
        return true;
      }
    }
    
    logger.error('All price feed sources failed, no backup available');
    return false;
  }

  /**
   * Check if price data is stale (older than a given threshold)
   */
  public isPriceDataStale(pair: string, thresholdMs: number = 5 * 60 * 1000): boolean {
    const priceData = this.priceCache.get(pair);
    if (!priceData) return true;
    
    const now = new Date();
    const dataAge = now.getTime() - priceData.timestamp.getTime();
    
    return dataAge > thresholdMs;
  }

  /**
   * Check if market data is stale (older than a given threshold)
   */
  public isMarketDataStale(pair: string, thresholdMs: number = 5 * 60 * 1000): boolean {
    const marketData = this.marketDataCache.get(pair);
    if (!marketData) return true;
    
    const now = new Date();
    const dataAge = now.getTime() - marketData.lastUpdated.getTime();
    
    return dataAge > thresholdMs;
  }

  /**
   * Get the current active data source
   */
  public getActiveDataSource(): string {
    return this.activeDataSource;
  }

  /**
   * Check if we're currently using a backup data source
   */
  public isUsingBackupSource(): boolean {
    return this.backupDataSources.includes(this.activeDataSource);
  }

  /**
   * Broadcast a price update to all connected WebSocket clients
   */
  private broadcastPriceUpdate(data: PriceData): void {
    const message = JSON.stringify({
      type: 'PRICE_UPDATE',
      data,
      timestamp: new Date().toISOString()
    });
    
    for (const client of this.wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  /**
   * Broadcast a market data update to all connected WebSocket clients
   */
  private broadcastMarketDataUpdate(pair: string): void {
    const cached = this.marketDataCache.get(pair);
    if (!cached) return;
    
    // Don't send full market data over websocket as it can be large
    // Just send a notification that it's been updated
    const message = JSON.stringify({
      type: 'MARKET_DATA_UPDATED',
      pair,
      timestamp: new Date().toISOString()
    });
    
    for (const client of this.wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  /**
   * Send cached data to a specific client
   */
  private sendCacheToClient(ws: WebSocket): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    
    // Send all price data
    const allPrices = Array.from(this.priceCache.values());
    ws.send(JSON.stringify({
      type: 'PRICE_CACHE',
      data: allPrices,
      timestamp: new Date().toISOString()
    }));
    
    // Send list of available market data pairs
    const availablePairs = Array.from(this.marketDataCache.keys());
    ws.send(JSON.stringify({
      type: 'AVAILABLE_MARKET_DATA',
      pairs: availablePairs,
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Start the cache refresh interval
   */
  private startRefreshInterval(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    this.refreshInterval = setInterval(() => {
      this.refreshCache();
    }, CACHE_REFRESH_INTERVAL);
  }

  /**
   * Start the backup interval
   */
  private startBackupInterval(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
    
    this.backupInterval = setInterval(() => {
      this.backupCache();
    }, BACKUP_INTERVAL);
  }

  /**
   * Refresh the cache with latest data
   */
  private async refreshCache(): Promise<void> {
    // This would be called periodically to fetch fresh data
    // from the primary data source
    logger.debug('Refreshing price feed cache');
    
    // In a real implementation, this would fetch data from APIs
    // For now, we just check if there's any cached data to verify system is working
    if (this.priceCache.size === 0 && this.marketDataCache.size === 0) {
      logger.warn('Price feed cache is empty during refresh');
    }
  }

  /**
   * Backup the cache to disk
   */
  private async backupCache(): Promise<void> {
    try {
      logger.debug('Backing up price feed cache');
      
      // Ensure cache directory exists
      await this.ensureCacheDir();
      
      // Backup price data
      const priceData = Array.from(this.priceCache.values());
      await fs.writeFile(
        path.join(CACHE_DIR, 'price_cache.json'),
        JSON.stringify(priceData),
        'utf8'
      );
      
      // Backup market data
      for (const [pair, cacheData] of this.marketDataCache.entries()) {
        const safeFilename = pair.replace('/', '_') + '.json';
        
        await fs.writeFile(
          path.join(CACHE_DIR, safeFilename),
          JSON.stringify(cacheData.data),
          'utf8'
        );
        
        // Update backup timestamp
        const cached = this.marketDataCache.get(pair);
        if (cached) {
          cached.backupTimestamp = new Date();
          this.marketDataCache.set(pair, cached);
        }
      }
      
      logger.debug('Price feed cache backup completed');
    } catch (error) {
      logger.error('Failed to backup price feed cache:', error);
    }
  }

  /**
   * Load cached backups from disk
   */
  private async loadCachedBackups(): Promise<void> {
    try {
      // Ensure cache directory exists
      await this.ensureCacheDir();
      
      // Check if price cache file exists
      try {
        const priceCache = await fs.readFile(
          path.join(CACHE_DIR, 'price_cache.json'),
          'utf8'
        );
        
        const prices = JSON.parse(priceCache) as PriceData[];
        
        for (const price of prices) {
          // Convert string timestamp back to Date object
          if (typeof price.timestamp === 'string') {
            price.timestamp = new Date(price.timestamp);
          }
          
          this.priceCache.set(price.pair, price);
        }
        
        logger.info(`Loaded ${prices.length} price entries from backup cache`);
      } catch (e) {
        logger.debug('No price cache backup found or failed to load it');
      }
      
      // Load individual market data files
      try {
        const files = await fs.readdir(CACHE_DIR);
        const marketDataFiles = files.filter(f => 
          f !== 'price_cache.json' && f.endsWith('.json')
        );
        
        for (const file of marketDataFiles) {
          try {
            const data = await fs.readFile(path.join(CACHE_DIR, file), 'utf8');
            const marketData = JSON.parse(data) as MarketData;
            
            // Extract pair from filename
            const pair = file.replace('_', '/').replace('.json', '');
            
            this.marketDataCache.set(pair, {
              pair,
              data: marketData,
              lastUpdated: new Date(), // This will be marked as fresh since we just loaded it
              backupTimestamp: new Date()
            });
          } catch (err) {
            logger.error(`Failed to load market data from ${file}:`, err);
          }
        }
        
        logger.info(`Loaded ${this.marketDataCache.size} market data entries from backup cache`);
      } catch (e) {
        logger.debug('No market data cache backups found or failed to load them');
      }
    } catch (error) {
      logger.error('Failed to load cached backups:', error);
    }
  }

  /**
   * Ensure the cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create cache directory:', error);
      throw error;
    }
  }

  /**
   * Stop the cache service
   */
  public stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
    
    // Perform one final backup before stopping
    this.backupCache().catch(err => {
      logger.error('Failed to perform final cache backup:', err);
    });
    
    this.initialized = false;
    logger.info('Price feed cache service stopped');
  }
}

// Create singleton instance
export const priceFeedCache = new PriceFeedCache();

// Export types
export type { PriceData, CachedMarketData };