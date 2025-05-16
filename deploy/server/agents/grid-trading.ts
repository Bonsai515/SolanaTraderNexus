/**
 * Grid Trading Module
 * 
 * Implements an advanced grid trading strategy for high volatility tokens
 * with automatic grid rebalancing and profit taking.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../logger';
import * as nexusEngine from '../nexus-transaction-engine';
import { priceFeedCache } from '../priceFeedCache';
import { neuralPriceFeed } from '../lib/neuralPriceFeed';

// Grid configuration
export interface GridConfig {
  token: string;
  upperLimit: number;
  lowerLimit: number;
  gridLevels: number;
  investmentAmount: number;
  rebalanceThreshold: number;
  walletAddress: string;
  quoteCurrency?: string;
  autoAdjust?: boolean;
  takeProfitInterval?: number;
}

// Grid level
interface GridLevel {
  index: number;
  price: number;
  buyOrderPlaced: boolean;
  sellOrderPlaced: boolean;
  buyOrderSize: number;
  sellOrderSize: number;
  tokenHoldings: number;
  buyOrderId?: string;
  sellOrderId?: string;
  status: 'pending' | 'active' | 'filled' | 'cancelled';
  lastUpdated: number;
}

// Grid trading performance metrics
interface GridPerformance {
  token: string;
  totalTrades: number;
  successfulTrades: number;
  totalFees: number;
  totalProfit: number;
  profitPercent: number;
  startTime: number;
  runTimeHours: number;
  gridRebalances: number;
  averageProfitPerTrade: number;
}

class GridTradingBot {
  private connection: Connection;
  private isActive: boolean = false;
  private config: GridConfig | null = null;
  private gridLevels: GridLevel[] = [];
  private updateInterval: NodeJS.Timeout | null = null;
  private performance: GridPerformance = {
    token: '',
    totalTrades: 0,
    successfulTrades: 0,
    totalFees: 0,
    totalProfit: 0,
    profitPercent: 0,
    startTime: 0,
    runTimeHours: 0,
    gridRebalances: 0,
    averageProfitPerTrade: 0
  };
  private initialInvestment: number = 0;
  private lastRebalance: number = 0;
  private currentPrice: number = 0;
  
  constructor(connection: Connection) {
    this.connection = connection;
    logger.info('Initializing Grid Trading Bot');
  }
  
  /**
   * Start a new grid trading strategy
   */
  public async startGridTrading(config: GridConfig): Promise<boolean> {
    try {
      if (this.isActive) {
        logger.info('Grid trading is already active. Please stop the current grid first.');
        return false;
      }
      
      this.config = {
        ...config,
        quoteCurrency: config.quoteCurrency || 'USDC',
        autoAdjust: config.autoAdjust !== undefined ? config.autoAdjust : true,
        takeProfitInterval: config.takeProfitInterval || 24 // hours
      };
      
      // Validate config
      if (this.config.upperLimit <= this.config.lowerLimit) {
        throw new Error('Upper limit must be greater than lower limit');
      }
      
      if (this.config.gridLevels < 2) {
        throw new Error('Grid must have at least 2 levels');
      }
      
      logger.info(`Starting grid trading for ${this.config.token} with ${this.config.gridLevels} levels between ${this.config.lowerLimit} and ${this.config.upperLimit}`);
      
      // Initialize performance tracking
      this.performance = {
        token: this.config.token,
        totalTrades: 0,
        successfulTrades: 0,
        totalFees: 0,
        totalProfit: 0,
        profitPercent: 0,
        startTime: Date.now(),
        runTimeHours: 0,
        gridRebalances: 0,
        averageProfitPerTrade: 0
      };
      
      this.initialInvestment = this.config.investmentAmount;
      
      // Subscribe to price feed updates
      neuralPriceFeed.subscribe(this.config.token, this.handlePriceUpdate.bind(this));
      
      // Create grid levels
      await this.createGridLevels();
      
      // Start monitoring
      this.startMonitoring();
      
      this.isActive = true;
      
      return true;
    } catch (error) {
      logger.error('Failed to start grid trading:', error);
      return false;
    }
  }
  
  /**
   * Stop grid trading
   */
  public async stopGridTrading(): Promise<boolean> {
    try {
      if (!this.isActive) {
        logger.info('Grid trading is not active');
        return true;
      }
      
      logger.info(`Stopping grid trading for ${this.config?.token}`);
      
      // Cancel all active orders
      await this.cancelAllOrders();
      
      // Unsubscribe from price feed
      if (this.config) {
        neuralPriceFeed.unsubscribe(this.config.token, this.handlePriceUpdate.bind(this));
      }
      
      // Stop monitoring
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      
      this.isActive = false;
      
      // Calculate final performance
      this.updatePerformanceMetrics();
      
      logger.info(`Grid trading stopped for ${this.config?.token} with total profit: $${this.performance.totalProfit.toFixed(2)} (${this.performance.profitPercent.toFixed(2)}%)`);
      
      return true;
    } catch (error) {
      logger.error('Failed to stop grid trading:', error);
      return false;
    }
  }
  
  /**
   * Handle price update from neural price feed
   */
  private handlePriceUpdate(priceData: any): void {
    if (!this.isActive || !this.config) return;
    
    this.currentPrice = priceData.price;
    
    // Check if price is outside grid range and rebalancing is needed
    if (
      this.config.autoAdjust && 
      (this.currentPrice > this.config.upperLimit || this.currentPrice < this.config.lowerLimit)
    ) {
      const hoursSinceLastRebalance = (Date.now() - this.lastRebalance) / (1000 * 60 * 60);
      
      // Don't rebalance too frequently
      if (hoursSinceLastRebalance >= 1) {
        this.rebalanceGrid();
      }
    }
  }
  
  /**
   * Create grid levels
   */
  private async createGridLevels(): Promise<void> {
    if (!this.config) return;
    
    this.gridLevels = [];
    
    // Get current price
    const priceData = priceFeedCache.getPrice(this.config.token);
    if (!priceData) {
      throw new Error(`No price data available for ${this.config.token}`);
    }
    
    this.currentPrice = priceData.price;
    
    // Calculate grid step size
    const gridRange = this.config.upperLimit - this.config.lowerLimit;
    const gridStep = gridRange / (this.config.gridLevels - 1);
    
    // Calculate investment per level
    const investmentPerLevel = this.config.investmentAmount / this.config.gridLevels;
    
    // Create grid levels
    for (let i = 0; i < this.config.gridLevels; i++) {
      const price = this.config.lowerLimit + (i * gridStep);
      const buyOrderSize = investmentPerLevel / price;
      
      const gridLevel: GridLevel = {
        index: i,
        price,
        buyOrderPlaced: false,
        sellOrderPlaced: false,
        buyOrderSize,
        sellOrderSize: buyOrderSize, // Same as buy order size for simplicity
        tokenHoldings: 0,
        status: 'pending',
        lastUpdated: Date.now()
      };
      
      this.gridLevels.push(gridLevel);
    }
    
    logger.info(`Created ${this.gridLevels.length} grid levels for ${this.config.token}`);
    
    // Place initial orders
    await this.placeInitialOrders();
  }
  
  /**
   * Place initial orders
   */
  private async placeInitialOrders(): Promise<void> {
    if (!this.config || !this.isActive) return;
    
    logger.info(`Placing initial orders for ${this.config.token} grid`);
    
    // Iterate through grid levels
    for (const level of this.gridLevels) {
      try {
        // If current price is above this level, place buy order
        if (this.currentPrice > level.price && !level.buyOrderPlaced) {
          await this.placeBuyOrder(level);
        }
        // If current price is below this level, place sell order
        else if (this.currentPrice < level.price && !level.sellOrderPlaced) {
          await this.placeSellOrder(level);
        }
      } catch (error) {
        logger.error(`Failed to place initial order at level ${level.index}:`, error);
      }
    }
  }
  
  /**
   * Place a buy order for a grid level
   */
  private async placeBuyOrder(level: GridLevel): Promise<boolean> {
    if (!this.config || !this.isActive) return false;
    
    try {
      logger.info(`Placing buy order at level ${level.index} (${level.price}) for ${this.config.token}`);
      
      // In a real implementation, we would place a limit order
      // For now, we'll simulate by executing the order if price matches
      
      // Execute swap through Nexus engine
      const swapResult = await nexusEngine.executeSwap({
        fromToken: this.config.quoteCurrency as string,
        toToken: this.config.token,
        amount: level.buyOrderSize * level.price, // Convert to quote currency amount
        slippage: 1, // 1% slippage
        walletAddress: this.config.walletAddress
      });
      
      if (swapResult.success) {
        // Update level
        level.buyOrderPlaced = true;
        level.buyOrderId = swapResult.signature;
        level.tokenHoldings = swapResult.outputAmount || level.buyOrderSize;
        level.status = 'filled';
        level.lastUpdated = Date.now();
        
        // Update performance
        this.performance.totalTrades++;
        this.performance.successfulTrades++;
        this.performance.totalFees += swapResult.fee || 0;
        
        logger.info(`Buy order filled at level ${level.index} for ${this.config.token}`);
        
        // Place sell order for this level
        await this.placeSellOrder(level);
        
        return true;
      } else {
        logger.error(`Buy order failed at level ${level.index}: ${swapResult.error}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error placing buy order at level ${level.index}:`, error);
      return false;
    }
  }
  
  /**
   * Place a sell order for a grid level
   */
  private async placeSellOrder(level: GridLevel): Promise<boolean> {
    if (!this.config || !this.isActive || level.tokenHoldings <= 0) return false;
    
    try {
      logger.info(`Placing sell order at level ${level.index} (${level.price}) for ${this.config.token}`);
      
      // Similar to buy order, simulate selling
      const targetPrice = level.price * 1.02; // Target 2% higher price
      
      // Execute swap through Nexus engine
      const swapResult = await nexusEngine.executeSwap({
        fromToken: this.config.token,
        toToken: this.config.quoteCurrency as string,
        amount: level.tokenHoldings,
        slippage: 1, // 1% slippage
        walletAddress: this.config.walletAddress
      });
      
      if (swapResult.success) {
        // Calculate profit
        const sellAmount = swapResult.outputAmount || (level.tokenHoldings * targetPrice);
        const buyAmount = level.tokenHoldings * level.price;
        const profit = sellAmount - buyAmount;
        
        // Update level
        level.sellOrderPlaced = true;
        level.sellOrderId = swapResult.signature;
        level.tokenHoldings = 0;
        level.status = 'pending'; // Reset for next buy
        level.lastUpdated = Date.now();
        
        // Update performance
        this.performance.totalTrades++;
        this.performance.successfulTrades++;
        this.performance.totalFees += swapResult.fee || 0;
        this.performance.totalProfit += profit;
        
        logger.info(`Sell order filled at level ${level.index} for ${this.config.token} with profit $${profit.toFixed(2)}`);
        
        return true;
      } else {
        logger.error(`Sell order failed at level ${level.index}: ${swapResult.error}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error placing sell order at level ${level.index}:`, error);
      return false;
    }
  }
  
  /**
   * Cancel all active orders
   */
  private async cancelAllOrders(): Promise<void> {
    if (!this.config) return;
    
    logger.info(`Cancelling all orders for ${this.config.token} grid`);
    
    // In a real implementation, we would cancel all open orders
    // by their order ID
  }
  
  /**
   * Rebalance the grid when price moves outside the range
   */
  private async rebalanceGrid(): Promise<void> {
    if (!this.config || !this.isActive) return;
    
    logger.info(`Rebalancing grid for ${this.config.token}`);
    
    // Cancel all active orders
    await this.cancelAllOrders();
    
    // Calculate new grid ranges centered around current price
    const gridRange = this.config.upperLimit - this.config.lowerLimit;
    const newLowerLimit = Math.max(0, this.currentPrice - (gridRange / 2));
    const newUpperLimit = newLowerLimit + gridRange;
    
    // Update config
    this.config.lowerLimit = newLowerLimit;
    this.config.upperLimit = newUpperLimit;
    
    // Recreate grid levels
    await this.createGridLevels();
    
    // Update rebalance stats
    this.lastRebalance = Date.now();
    this.performance.gridRebalances++;
    
    logger.info(`Grid rebalanced for ${this.config.token} with new range: ${newLowerLimit} - ${newUpperLimit}`);
  }
  
  /**
   * Start monitoring grid and updating orders
   */
  private startMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => {
      this.monitorAndUpdateGrid();
    }, 15000); // Check every 15 seconds
    
    logger.info(`Grid monitoring started for ${this.config?.token}`);
  }
  
  /**
   * Monitor and update grid
   */
  private async monitorAndUpdateGrid(): Promise<void> {
    if (!this.config || !this.isActive) return;
    
    try {
      // Update performance metrics
      this.updatePerformanceMetrics();
      
      // Check for take profit interval
      const hoursSinceStart = (Date.now() - this.performance.startTime) / (1000 * 60 * 60);
      if (hoursSinceStart >= this.config.takeProfitInterval!) {
        await this.takeProfit();
      }
      
      // Process each grid level
      for (const level of this.gridLevels) {
        // If price crossed below this level and we don't have a buy order
        if (this.currentPrice <= level.price && !level.buyOrderPlaced && level.status !== 'filled') {
          await this.placeBuyOrder(level);
        }
        // If price crossed above this level and we have holdings to sell
        else if (this.currentPrice >= level.price && !level.sellOrderPlaced && level.tokenHoldings > 0) {
          await this.placeSellOrder(level);
        }
      }
    } catch (error) {
      logger.error('Error monitoring grid:', error);
    }
  }
  
  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    if (!this.performance.startTime) return;
    
    const now = Date.now();
    this.performance.runTimeHours = (now - this.performance.startTime) / (1000 * 60 * 60);
    
    if (this.performance.totalTrades > 0) {
      this.performance.averageProfitPerTrade = this.performance.totalProfit / this.performance.totalTrades;
    }
    
    if (this.initialInvestment > 0) {
      this.performance.profitPercent = (this.performance.totalProfit / this.initialInvestment) * 100;
    }
  }
  
  /**
   * Take profit from the grid trading
   */
  private async takeProfit(): Promise<void> {
    if (!this.config || !this.isActive || this.performance.totalProfit <= 0) return;
    
    try {
      logger.info(`Taking profit of $${this.performance.totalProfit.toFixed(2)} from ${this.config.token} grid trading`);
      
      // In a real implementation, we would transfer profits to a separate wallet
      // For now, we'll just reset the profit counter
      
      this.performance.totalProfit = 0;
      this.performance.startTime = Date.now(); // Reset timer for next interval
      
      logger.info(`Profit taking completed for ${this.config.token} grid`);
    } catch (error) {
      logger.error('Error taking profit:', error);
    }
  }
  
  /**
   * Get current grid status and performance
   */
  public getGridStatus(): any {
    if (!this.config) {
      return { active: false };
    }
    
    return {
      active: this.isActive,
      token: this.config.token,
      currentPrice: this.currentPrice,
      gridRange: {
        lower: this.config.lowerLimit,
        upper: this.config.upperLimit
      },
      levels: this.gridLevels.length,
      performance: this.performance
    };
  }
}

// Export a singleton instance
let gridTradingBot: GridTradingBot | null = null;

export function getGridTradingBot(connection?: Connection): GridTradingBot {
  if (!gridTradingBot && connection) {
    gridTradingBot = new GridTradingBot(connection);
  } else if (!gridTradingBot) {
    throw new Error('Grid trading bot not initialized');
  }
  
  return gridTradingBot;
}