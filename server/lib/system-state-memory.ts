/**
 * System State Memory for Token Data Caching
 * 
 * This module implements a persistent system memory for token data
 * that works as a state machine, controlling API requests and caching.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as logger from '../logger';
import { TRADING_WALLET_CONFIG } from '../config/syndica-config';

// Token data structure
export interface TokenData {
  symbol: string;          // Token symbol
  name: string;            // Token name
  address: string;         // Token address
  price?: number;          // Current price in USD
  priceSOL?: number;       // Current price in SOL
  priceChangePercent?: number; // 24h price change percentage
  volume24h?: number;      // 24h volume in USD
  marketCap?: number;      // Market cap in USD
  lastUpdated: number;     // Timestamp of last update
  source: string;          // Data source
  confidence: number;      // Data confidence score (0-100)
  trending?: boolean;      // If token is trending
  priority?: number;       // Priority for trading (1-100)
  tags?: string[];         // Tags like "memecoin", "defi", etc.
  metrics?: {              // Additional metrics
    socialScore?: number;  // Social media sentiment score
    momentum?: number;     // Price momentum score
    volatility?: number;   // Volatility score
  };
}

// System state interface
export interface SystemState {
  version: string;
  lastFullUpdate: number;
  wallets: {
    trading: string;
    profit: string;
  };
  apiState: {
    [key: string]: {
      available: boolean;
      lastCheck: number;
      rateLimitRemaining: number;
      cooldownUntil: number;
      failureCount: number;
    };
  };
  tokens: {
    [symbol: string]: TokenData;
  };
  trendingTokens: string[];
  newListings: string[];
  strategies: {
    [key: string]: {
      enabled: boolean;
      lastExecution: number;
      successCount: number;
      failureCount: number;
    };
  };
  cache: {
    lastPurge: number;
    hitCount: number;
    missCount: number;
  };
}

// Default system state
const DEFAULT_STATE: SystemState = {
  version: '1.0.0',
  lastFullUpdate: 0,
  wallets: {
    trading: TRADING_WALLET_CONFIG.address,
    profit: '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e'
  },
  apiState: {
    'jupiter': {
      available: true,
      lastCheck: 0,
      rateLimitRemaining: 100,
      cooldownUntil: 0,
      failureCount: 0
    },
    'dexscreener': {
      available: true,
      lastCheck: 0,
      rateLimitRemaining: 100,
      cooldownUntil: 0,
      failureCount: 0
    },
    'birdeye': {
      available: false,
      lastCheck: 0,
      rateLimitRemaining: 0,
      cooldownUntil: 0,
      failureCount: 0
    },
    'coingecko': {
      available: false,
      lastCheck: 0,
      rateLimitRemaining: 0,
      cooldownUntil: 0,
      failureCount: 0
    },
    'syndica': {
      available: true,
      lastCheck: 0,
      rateLimitRemaining: 100,
      cooldownUntil: 0,
      failureCount: 0
    }
  },
  tokens: {},
  trendingTokens: [],
  newListings: [],
  strategies: {
    'quantum-omega-sniper': {
      enabled: true,
      lastExecution: 0,
      successCount: 0,
      failureCount: 0
    },
    'memecortex-supernova': {
      enabled: true,
      lastExecution: 0,
      successCount: 0,
      failureCount: 0
    },
    'momentum-surfing': {
      enabled: true,
      lastExecution: 0,
      successCount: 0,
      failureCount: 0
    }
  },
  cache: {
    lastPurge: 0,
    hitCount: 0,
    missCount: 0
  }
};

class SystemStateMemory {
  private statePath: string;
  private state: SystemState;
  private saveInterval: NodeJS.Timeout | null = null;
  
  constructor(dataDir: string = './data') {
    this.statePath = path.join(dataDir, 'system-memory.json');
    this.state = { ...DEFAULT_STATE };
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }
  
  /**
   * Initialize system memory
   */
  async initialize(): Promise<boolean> {
    try {
      // Load state from disk if it exists
      if (fs.existsSync(this.statePath)) {
        const data = fs.readFileSync(this.statePath, 'utf8');
        this.state = JSON.parse(data);
        logger.info(`Loaded system memory with ${Object.keys(this.state.tokens).length} tokens`);
      } else {
        logger.info('No existing system memory found, using default state');
        // Initialize with the HPN wallet address
        this.state.wallets.trading = TRADING_WALLET_CONFIG.address;
        this.saveState();
      }
      
      // Set up periodic save
      this.saveInterval = setInterval(() => this.saveState(), 60000); // Save every minute
      
      return true;
    } catch (error) {
      logger.error(`Failed to initialize system memory: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Save state to disk
   */
  saveState(): void {
    try {
      fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      logger.error(`Failed to save system memory: ${error.message}`);
    }
  }
  
  /**
   * Get the full system state
   */
  getState(): SystemState {
    return this.state;
  }
  
  /**
   * Update API state
   */
  updateApiState(api: string, update: Partial<SystemState['apiState'][0]>): void {
    if (!this.state.apiState[api]) {
      this.state.apiState[api] = {
        available: true,
        lastCheck: Date.now(),
        rateLimitRemaining: 100,
        cooldownUntil: 0,
        failureCount: 0
      };
    }
    
    this.state.apiState[api] = {
      ...this.state.apiState[api],
      ...update,
      lastCheck: Date.now()
    };
    
    // Save changes immediately for API state
    if (Math.random() < 0.2) { // 20% chance to save to reduce disk writes
      this.saveState();
    }
  }
  
  /**
   * Check if an API is available and not rate limited
   */
  isApiAvailable(api: string): boolean {
    const apiState = this.state.apiState[api];
    if (!apiState) return false;
    
    const now = Date.now();
    return apiState.available && now > apiState.cooldownUntil;
  }
  
  /**
   * Record API failure
   */
  recordApiFailure(api: string, isRateLimit: boolean = false): void {
    if (!this.state.apiState[api]) {
      this.updateApiState(api, {
        available: false,
        failureCount: 1,
        cooldownUntil: isRateLimit ? Date.now() + 60000 : 0
      });
      return;
    }
    
    const apiState = this.state.apiState[api];
    const failureCount = apiState.failureCount + 1;
    
    // Exponential backoff for repeated failures
    let cooldownTime = 0;
    if (isRateLimit) {
      // Rate limit cooldown grows exponentially with failures
      cooldownTime = Math.min(5 * 60000, 1000 * Math.pow(2, Math.min(10, failureCount)));
    } else if (failureCount > 3) {
      // General failures also get a cooldown after 3 consecutive failures
      cooldownTime = Math.min(2 * 60000, 1000 * Math.pow(1.5, Math.min(8, failureCount - 3)));
    }
    
    this.updateApiState(api, {
      available: cooldownTime === 0,
      failureCount,
      cooldownUntil: Date.now() + cooldownTime
    });
    
    if (cooldownTime > 0) {
      logger.warn(`${api} entered cooldown for ${cooldownTime / 1000} seconds after ${failureCount} failures`);
    }
  }
  
  /**
   * Record API success
   */
  recordApiSuccess(api: string): void {
    if (!this.state.apiState[api]) {
      this.updateApiState(api, {
        available: true,
        failureCount: 0
      });
      return;
    }
    
    const apiState = this.state.apiState[api];
    
    // Reset failure count on success
    if (apiState.failureCount > 0) {
      this.updateApiState(api, {
        available: true,
        failureCount: 0,
        cooldownUntil: 0
      });
    } else {
      // Just update the last check time
      this.updateApiState(api, {
        lastCheck: Date.now()
      });
    }
  }
  
  /**
   * Update token data
   */
  updateToken(token: TokenData): void {
    // Ensure token has a lastUpdated timestamp
    token.lastUpdated = token.lastUpdated || Date.now();
    
    // Add or update token
    this.state.tokens[token.symbol] = {
      ...this.state.tokens[token.symbol],
      ...token
    };
    
    // Update trending tokens if applicable
    if (token.trending && !this.state.trendingTokens.includes(token.symbol)) {
      this.state.trendingTokens.push(token.symbol);
    }
    
    // Save changes occasionally to reduce disk writes
    if (Math.random() < 0.05) { // 5% chance to save
      this.saveState();
    }
  }
  
  /**
   * Get token data
   */
  getToken(symbol: string): TokenData | null {
    const token = this.state.tokens[symbol];
    if (!token) {
      this.state.cache.missCount++;
      return null;
    }
    
    this.state.cache.hitCount++;
    return token;
  }
  
  /**
   * Get all tokens
   */
  getAllTokens(): TokenData[] {
    return Object.values(this.state.tokens);
  }
  
  /**
   * Get trending tokens
   */
  getTrendingTokens(): TokenData[] {
    return this.state.trendingTokens
      .map(symbol => this.state.tokens[symbol])
      .filter(token => !!token);
  }
  
  /**
   * Get wallet address
   */
  getWalletAddress(type: 'trading' | 'profit'): string {
    return this.state.wallets[type];
  }
  
  /**
   * Update wallet address
   */
  updateWalletAddress(type: 'trading' | 'profit', address: string): void {
    this.state.wallets[type] = address;
    this.saveState(); // Always save wallet updates immediately
    logger.info(`Updated ${type} wallet address to ${address}`);
  }
  
  /**
   * Update strategy state
   */
  updateStrategy(strategy: string, update: Partial<SystemState['strategies'][0]>): void {
    if (!this.state.strategies[strategy]) {
      this.state.strategies[strategy] = {
        enabled: false,
        lastExecution: 0,
        successCount: 0,
        failureCount: 0
      };
    }
    
    this.state.strategies[strategy] = {
      ...this.state.strategies[strategy],
      ...update
    };
    
    // Save occasionally
    if (Math.random() < 0.1) { // 10% chance to save
      this.saveState();
    }
  }
  
  /**
   * Record strategy execution
   */
  recordStrategyExecution(strategy: string, success: boolean): void {
    if (!this.state.strategies[strategy]) {
      this.updateStrategy(strategy, {
        enabled: true,
        lastExecution: Date.now(),
        successCount: success ? 1 : 0,
        failureCount: success ? 0 : 1
      });
      return;
    }
    
    const strategyState = this.state.strategies[strategy];
    
    this.updateStrategy(strategy, {
      lastExecution: Date.now(),
      successCount: success ? strategyState.successCount + 1 : strategyState.successCount,
      failureCount: success ? strategyState.failureCount : strategyState.failureCount + 1
    });
  }
  
  /**
   * Check if a strategy is enabled
   */
  isStrategyEnabled(strategy: string): boolean {
    return this.state.strategies[strategy]?.enabled || false;
  }
  
  /**
   * Enable or disable a strategy
   */
  setStrategyEnabled(strategy: string, enabled: boolean): void {
    this.updateStrategy(strategy, { enabled });
    logger.info(`${enabled ? 'Enabled' : 'Disabled'} strategy: ${strategy}`);
  }
  
  /**
   * Clean up stale token data
   */
  cleanupTokens(maxAgeHours: number = 24): void {
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    let removedCount = 0;
    
    // Remove stale tokens
    for (const symbol in this.state.tokens) {
      const token = this.state.tokens[symbol];
      if (now - token.lastUpdated > maxAgeMs) {
        delete this.state.tokens[symbol];
        removedCount++;
      }
    }
    
    // Clean up trending tokens list
    this.state.trendingTokens = this.state.trendingTokens.filter(
      symbol => this.state.tokens[symbol]
    );
    
    // Update cache stats
    this.state.cache.lastPurge = now;
    
    if (removedCount > 0) {
      logger.info(`Removed ${removedCount} stale tokens from cache`);
      this.saveState();
    }
  }
  
  /**
   * Stop system memory and save state
   */
  stop(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    
    this.saveState();
    logger.info('System state memory saved and stopped');
  }
}

// Create singleton instance
export const systemMemory = new SystemStateMemory();

// Export default
export default systemMemory;