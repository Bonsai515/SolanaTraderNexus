/**
 * Position Tracker Module
 * 
 * This module tracks trading positions and updates balances after trades
 * for comprehensive portfolio monitoring.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as logger from './logger';
import { getManagedConnection } from './lib/rpcConnectionManager';
import { walletMonitor } from './wallet-balance-monitor';
import { profitCollector } from './profit/instant-collector';
import * as fs from 'fs';
import * as path from 'path';

// Configuration and data paths
const POSITIONS_PATH = path.join('./data', 'positions.json');
const TRADING_HISTORY_PATH = path.join('./data', 'trading-history.json');

// Token position interface
interface TokenPosition {
  symbol: string;
  address: string;
  amount: number;
  averageEntryPrice: number;
  currentPrice: number;
  valueUSD: number;
  unrealizedProfitLoss: number;
  unrealizedProfitLossPercent: number;
  lastUpdated: string;
}

// Portfolio interface
interface Portfolio {
  totalValueUSD: number;
  totalBalanceSOL: number;
  positions: TokenPosition[];
  lastUpdated: string;
}

// Trade entry interface
interface TradeEntry {
  id: string;
  timestamp: string;
  side: 'BUY' | 'SELL';
  symbol: string;
  amount: number;
  price: number;
  valueUSD: number;
  fee: number;
  walletAddress: string;
  transactionSignature?: string;
  profitLoss?: number;
  profitLossPercent?: number;
  solscanUrl?: string;
  verified: boolean;
}

// Global instance
let instance: PositionTracker | null = null;

/**
 * Position Tracker class
 */
export class PositionTracker {
  private connection: Connection;
  private portfolio: Portfolio;
  private tradeHistory: TradeEntry[] = [];
  private openOrders: Map<string, any> = new Map();

  /**
   * Constructor
   */
  private constructor() {
    // Initialize connection
    this.connection = getManagedConnection({
      commitment: 'confirmed'
    });
    
    // Initialize portfolio
    this.portfolio = {
      totalValueUSD: 0,
      totalBalanceSOL: 0,
      positions: [],
      lastUpdated: new Date().toISOString()
    };
    
    // Load portfolio and trade history
    this.loadData();
    
    logger.info('[PositionTracker] Initialized portfolio tracking');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PositionTracker {
    if (!instance) {
      instance = new PositionTracker();
    }
    return instance;
  }

  /**
   * Load portfolio and trade history data
   */
  private loadData(): void {
    try {
      // Load portfolio
      if (fs.existsSync(POSITIONS_PATH)) {
        const data = fs.readFileSync(POSITIONS_PATH, 'utf8');
        this.portfolio = JSON.parse(data);
        logger.info(`[PositionTracker] Loaded portfolio with ${this.portfolio.positions.length} positions`);
      }
      
      // Load trade history
      if (fs.existsSync(TRADING_HISTORY_PATH)) {
        const data = fs.readFileSync(TRADING_HISTORY_PATH, 'utf8');
        this.tradeHistory = JSON.parse(data);
        logger.info(`[PositionTracker] Loaded ${this.tradeHistory.length} trade history entries`);
      }
    } catch (error) {
      logger.error(`[PositionTracker] Error loading data: ${error}`);
    }
  }

  /**
   * Save portfolio and trade history data
   */
  private saveData(): void {
    try {
      // Create data directory if it doesn't exist
      const dataDir = path.dirname(POSITIONS_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Save portfolio
      fs.writeFileSync(POSITIONS_PATH, JSON.stringify(this.portfolio, null, 2));
      
      // Save trade history (limited to last 1000 entries to keep file size reasonable)
      const limitedHistory = this.tradeHistory.slice(-1000);
      fs.writeFileSync(TRADING_HISTORY_PATH, JSON.stringify(limitedHistory, null, 2));
    } catch (error) {
      logger.error(`[PositionTracker] Error saving data: ${error}`);
    }
  }

  /**
   * Update portfolio after a trade
   */
  async updateAfterTrade(tradeResult: {
    success: boolean;
    signature?: string;
    from: string;
    to: string;
    fromAmount: number;
    toAmount: number;
    priceImpact?: number;
    fee?: number;
    valueUSD?: number;
    solscanUrl?: string;
  }): Promise<boolean> {
    if (!tradeResult.success) {
      return false;
    }
    
    try {
      // Create a trade entry
      const tradeEntry: TradeEntry = {
        id: `trade-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        timestamp: new Date().toISOString(),
        side: 'BUY', // Assuming buying the 'to' token
        symbol: tradeResult.to,
        amount: tradeResult.toAmount,
        price: tradeResult.fromAmount / tradeResult.toAmount, // Simple price calculation
        valueUSD: tradeResult.valueUSD || 0,
        fee: tradeResult.fee || 0,
        walletAddress: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb', // Main trading wallet
        transactionSignature: tradeResult.signature,
        solscanUrl: tradeResult.solscanUrl, 
        verified: !!tradeResult.solscanUrl // Mark as verified if solscanUrl is provided
      };
      
      // Add to trade history
      this.tradeHistory.push(tradeEntry);
      
      // Update portfolio position for the token acquired
      this.updateTokenPosition(tradeResult.to, tradeResult.toAmount, tradeEntry.price);
      
      // Update portfolio position for the token spent (decrease)
      this.updateTokenPosition(tradeResult.from, -tradeResult.fromAmount, 0);
      
      // Update wallet balances
      await walletMonitor.checkAllWalletBalances();
      
      // Update total portfolio values
      this.updatePortfolioTotals();
      
      // Save data
      this.saveData();
      
      // Calculate trade profit/loss if selling a token
      let profit = 0;
      if (tradeResult.from !== 'USDC' && tradeResult.from !== 'SOL') {
        const position = this.findPosition(tradeResult.from);
        if (position) {
          // Simple P&L calculation
          const costBasis = position.averageEntryPrice * tradeResult.fromAmount;
          const saleProceeds = tradeResult.toAmount; // Assuming toAmount is in a stable value like USDC
          profit = saleProceeds - costBasis;
          
          // Try to collect profit if positive
          if (profit > 0) {
            await profitCollector.collectProfit({
              success: true,
              signature: tradeResult.signature,
              token: tradeResult.from,
              amount: tradeResult.fromAmount,
              profit
            });
          }
        }
      }
      
      logger.info(`[PositionTracker] Portfolio updated after trade: ${tradeResult.fromAmount} ${tradeResult.from} → ${tradeResult.toAmount} ${tradeResult.to}`);
      return true;
    } catch (error) {
      logger.error(`[PositionTracker] Error updating portfolio after trade: ${error}`);
      return false;
    }
  }

  /**
   * Update a token position
   */
  private updateTokenPosition(symbol: string, amount: number, price: number): void {
    // Find existing position
    const existingPosition = this.findPosition(symbol);
    
    if (existingPosition) {
      // If reducing position
      if (amount < 0) {
        // If fully closing position
        if (Math.abs(amount) >= existingPosition.amount) {
          // Remove position
          this.portfolio.positions = this.portfolio.positions.filter(p => p.symbol !== symbol);
          logger.info(`[PositionTracker] Closed position for ${symbol}`);
        } else {
          // Reduce position
          existingPosition.amount += amount; // amount is negative
          existingPosition.lastUpdated = new Date().toISOString();
          logger.info(`[PositionTracker] Reduced position for ${symbol} to ${existingPosition.amount}`);
        }
      } else {
        // Increasing position - update average entry price
        const totalCostBefore = existingPosition.amount * existingPosition.averageEntryPrice;
        const newCost = amount * price;
        const totalAmount = existingPosition.amount + amount;
        
        existingPosition.averageEntryPrice = (totalCostBefore + newCost) / totalAmount;
        existingPosition.amount = totalAmount;
        existingPosition.currentPrice = price;
        existingPosition.valueUSD = totalAmount * price;
        existingPosition.lastUpdated = new Date().toISOString();
        
        logger.info(`[PositionTracker] Updated position for ${symbol}: ${totalAmount} tokens at avg. price ${existingPosition.averageEntryPrice}`);
      }
    } else if (amount > 0) {
      // Create new position
      const newPosition: TokenPosition = {
        symbol,
        address: '', // Would need to look up the actual token address
        amount,
        averageEntryPrice: price,
        currentPrice: price,
        valueUSD: amount * price,
        unrealizedProfitLoss: 0,
        unrealizedProfitLossPercent: 0,
        lastUpdated: new Date().toISOString()
      };
      
      this.portfolio.positions.push(newPosition);
      logger.info(`[PositionTracker] Opened new position for ${symbol}: ${amount} tokens at price ${price}`);
    }
  }

  /**
   * Find a position by symbol
   */
  private findPosition(symbol: string): TokenPosition | undefined {
    return this.portfolio.positions.find(p => p.symbol === symbol);
  }

  /**
   * Update portfolio totals
   */
  private updatePortfolioTotals(): void {
    let totalValueUSD = 0;
    
    // Sum up position values
    for (const position of this.portfolio.positions) {
      // Update unrealized P&L
      position.unrealizedProfitLoss = (position.currentPrice - position.averageEntryPrice) * position.amount;
      position.unrealizedProfitLossPercent = ((position.currentPrice / position.averageEntryPrice) - 1) * 100;
      
      // Add to total value
      totalValueUSD += position.valueUSD;
    }
    
    // Get SOL balance from wallet monitor
    let totalBalanceSOL = 0;
    const walletData = walletMonitor.getWalletData();
    
    for (const [_, wallet] of walletData) {
      totalBalanceSOL += wallet.balanceSOL;
    }
    
    // Update portfolio totals
    this.portfolio.totalValueUSD = totalValueUSD;
    this.portfolio.totalBalanceSOL = totalBalanceSOL;
    this.portfolio.lastUpdated = new Date().toISOString();
  }

  /**
   * Get current portfolio
   */
  getPortfolio(): Portfolio {
    return this.portfolio;
  }

  /**
   * Get trade history
   */
  getTradeHistory(limit: number = 50): TradeEntry[] {
    return this.tradeHistory.slice(-limit);
  }

  /**
   * Calculate portfolio performance metrics
   */
  getPerformanceMetrics(): {
    totalValueUSD: number;
    dailyProfitLoss: number;
    dailyProfitLossPercent: number;
    weeklyProfitLoss: number;
    weeklyProfitLossPercent: number;
    bestPerformer: { symbol: string; percent: number } | null;
    worstPerformer: { symbol: string; percent: number } | null;
  } {
    // Get current total value
    const currentValue = this.portfolio.totalValueUSD;
    
    // Calculate daily change
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    // Calculate weekly change
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Find trades from these time periods
    const oneDayAgoISO = oneDayAgo.toISOString();
    const oneWeekAgoISO = oneWeekAgo.toISOString();
    
    // Get portfolio values from these points (simplified approach)
    let dayStartValue = currentValue;
    let weekStartValue = currentValue;
    
    // Find best and worst performers
    let bestPerformer = null;
    let worstPerformer = null;
    let bestPerformance = -Infinity;
    let worstPerformance = Infinity;
    
    for (const position of this.portfolio.positions) {
      if (position.unrealizedProfitLossPercent > bestPerformance) {
        bestPerformance = position.unrealizedProfitLossPercent;
        bestPerformer = {
          symbol: position.symbol,
          percent: position.unrealizedProfitLossPercent
        };
      }
      
      if (position.unrealizedProfitLossPercent < worstPerformance) {
        worstPerformance = position.unrealizedProfitLossPercent;
        worstPerformer = {
          symbol: position.symbol,
          percent: position.unrealizedProfitLossPercent
        };
      }
    }
    
    return {
      totalValueUSD: currentValue,
      dailyProfitLoss: currentValue - dayStartValue,
      dailyProfitLossPercent: ((currentValue / dayStartValue) - 1) * 100,
      weeklyProfitLoss: currentValue - weekStartValue,
      weeklyProfitLossPercent: ((currentValue / weekStartValue) - 1) * 100,
      bestPerformer,
      worstPerformer
    };
  }

  /**
   * Check for stop loss and take profit conditions
   */
  checkPositionsForStopLossAndTakeProfit(): string[] {
    const actionablePositions: string[] = [];
    
    for (const position of this.portfolio.positions) {
      // Check for stop loss
      const stopLossTriggered = walletMonitor.checkStopLoss(
        position.symbol, 
        position.averageEntryPrice, 
        position.currentPrice
      );
      
      // Check for take profit
      const takeProfitTriggered = walletMonitor.checkTakeProfit(
        position.symbol, 
        position.averageEntryPrice, 
        position.currentPrice
      );
      
      if (stopLossTriggered || takeProfitTriggered) {
        actionablePositions.push(position.symbol);
      }
    }
    
    return actionablePositions;
  }

  /**
   * Update token prices
   */
  async updateTokenPrices(): Promise<void> {
    try {
      // In a real implementation, this would fetch current market prices
      // For each token in the portfolio from a price oracle or exchange API
      
      // For each position, update current price and recalculate
      for (const position of this.portfolio.positions) {
        // Fetch current price for token (simplified)
        // position.currentPrice = ...
        
        // Update value and P&L
        position.valueUSD = position.amount * position.currentPrice;
        position.unrealizedProfitLoss = (position.currentPrice - position.averageEntryPrice) * position.amount;
        position.unrealizedProfitLossPercent = ((position.currentPrice / position.averageEntryPrice) - 1) * 100;
      }
      
      // Update portfolio totals
      this.updatePortfolioTotals();
      
      // Save data
      this.saveData();
      
      logger.info('[PositionTracker] Updated token prices');
    } catch (error) {
      logger.error(`[PositionTracker] Error updating token prices: ${error}`);
    }
  }
}

// Export singleton instance
export const positionTracker = PositionTracker.getInstance();