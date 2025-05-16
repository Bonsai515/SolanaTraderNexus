/**
 * Memecoin Strategy Tracker
 * 
 * Tracks statistics, performance, and success rates for memecoin sniping strategies
 * and momentum-based quick flip trades executed by the MemeCortex Remix AI.
 */

import * as logger from '../logger';
import * as fs from 'fs';
import * as path from 'path';

// Configuration paths
const DATA_DIR = path.join('./data');
const STATS_FILE = path.join(DATA_DIR, 'memecoin-stats.json');
const TRADES_FILE = path.join(DATA_DIR, 'memecoin-trades.json');

// Trade type enumeration
enum TradeType {
  LAUNCH_SNIPE = 'LAUNCH_SNIPE',
  MOMENTUM_FLIP = 'MOMENTUM_FLIP',
  TRENDING_ENTRY = 'TRENDING_ENTRY',
  OVERSOLD_BOUNCE = 'OVERSOLD_BOUNCE',
  VIRAL_MEME = 'VIRAL_MEME'
}

// Trade result interface
interface TradeResult {
  id: string;
  timestamp: string;
  symbol: string;
  type: TradeType;
  entryPrice: number;
  exitPrice: number;
  sizeUSD: number;
  profitUSD: number;
  profitPercentage: number;
  holdingPeriodSeconds: number;
  transactionSignature: string;
  solscanUrl: string;
  success: boolean;
  exitReason: string;
}

// Strategy stats interface
interface StrategyStats {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  profitableTrades: number;
  losingTrades: number;
  totalProfitUSD: number;
  winRate: number;
  avgProfitPercentage: number;
  avgHoldingPeriodSeconds: number;
  bestTrade: {
    symbol: string;
    profitPercentage: number;
    profitUSD: number;
  };
  worstTrade: {
    symbol: string;
    profitPercentage: number;
    profitUSD: number;
  };
  tradesByType: {
    [key in TradeType]: {
      count: number;
      successCount: number;
      totalProfitUSD: number;
      avgProfitPercentage: number;
    };
  };
  tokenPerformance: {
    [symbol: string]: {
      totalTrades: number;
      totalProfitUSD: number;
      avgProfitPercentage: number;
      bestProfitPercentage: number;
    };
  };
}

// Signal stats interface
interface SignalStats {
  totalSignals: number;
  actionedSignals: number;
  successfulSignals: number;
  signalsByToken: {
    [symbol: string]: number;
  };
  signalsByType: {
    [type: string]: number;
  };
}

// Overall stats interface
interface MemecoinStats {
  lastUpdated: string;
  tradeStats: StrategyStats;
  signalStats: SignalStats;
  quickFlips: {
    total: number;
    profitable: number;
    averageReturn: number;
    totalProfit: number;
    averageHoldingPeriodSeconds: number;
  };
}

// Singleton instance
let instance: MemecoinStrategyTracker | null = null;

/**
 * Memecoin Strategy Tracker class
 */
export class MemecoinStrategyTracker {
  private trades: TradeResult[] = [];
  private stats: MemecoinStats;
  
  /**
   * Private constructor
   */
  private constructor() {
    // Initialize stats
    this.stats = {
      lastUpdated: new Date().toISOString(),
      tradeStats: {
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        profitableTrades: 0,
        losingTrades: 0,
        totalProfitUSD: 0,
        winRate: 0,
        avgProfitPercentage: 0,
        avgHoldingPeriodSeconds: 0,
        bestTrade: {
          symbol: '',
          profitPercentage: 0,
          profitUSD: 0
        },
        worstTrade: {
          symbol: '',
          profitPercentage: 0,
          profitUSD: 0
        },
        tradesByType: {
          [TradeType.LAUNCH_SNIPE]: {
            count: 0,
            successCount: 0,
            totalProfitUSD: 0,
            avgProfitPercentage: 0
          },
          [TradeType.MOMENTUM_FLIP]: {
            count: 0,
            successCount: 0,
            totalProfitUSD: 0,
            avgProfitPercentage: 0
          },
          [TradeType.TRENDING_ENTRY]: {
            count: 0,
            successCount: 0,
            totalProfitUSD: 0,
            avgProfitPercentage: 0
          },
          [TradeType.OVERSOLD_BOUNCE]: {
            count: 0,
            successCount: 0,
            totalProfitUSD: 0,
            avgProfitPercentage: 0
          },
          [TradeType.VIRAL_MEME]: {
            count: 0,
            successCount: 0,
            totalProfitUSD: 0,
            avgProfitPercentage: 0
          }
        },
        tokenPerformance: {}
      },
      signalStats: {
        totalSignals: 0,
        actionedSignals: 0,
        successfulSignals: 0,
        signalsByToken: {},
        signalsByType: {}
      },
      quickFlips: {
        total: 0,
        profitable: 0,
        averageReturn: 0,
        totalProfit: 0,
        averageHoldingPeriodSeconds: 0
      }
    };
    
    // Load existing data
    this.loadData();
    
    logger.info('[MemeTracker] Initialized memecoin strategy tracker');
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): MemecoinStrategyTracker {
    if (!instance) {
      instance = new MemecoinStrategyTracker();
    }
    return instance;
  }
  
  /**
   * Load data from disk
   */
  private loadData(): void {
    try {
      // Create data directory if it doesn't exist
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      
      // Load trades
      if (fs.existsSync(TRADES_FILE)) {
        const tradesData = fs.readFileSync(TRADES_FILE, 'utf8');
        this.trades = JSON.parse(tradesData);
        logger.info(`[MemeTracker] Loaded ${this.trades.length} memecoin trades`);
      }
      
      // Load stats
      if (fs.existsSync(STATS_FILE)) {
        const statsData = fs.readFileSync(STATS_FILE, 'utf8');
        this.stats = JSON.parse(statsData);
        logger.info('[MemeTracker] Loaded memecoin stats');
      }
    } catch (error) {
      logger.error(`[MemeTracker] Error loading data: ${error}`);
    }
  }
  
  /**
   * Save data to disk
   */
  private saveData(): void {
    try {
      // Update timestamp
      this.stats.lastUpdated = new Date().toISOString();
      
      // Save trades (limit to last 1000 to prevent file growth)
      const limitedTrades = this.trades.slice(-1000);
      fs.writeFileSync(TRADES_FILE, JSON.stringify(limitedTrades, null, 2));
      
      // Save stats
      fs.writeFileSync(STATS_FILE, JSON.stringify(this.stats, null, 2));
    } catch (error) {
      logger.error(`[MemeTracker] Error saving data: ${error}`);
    }
  }
  
  /**
   * Record a new trade
   */
  recordTrade(trade: Omit<TradeResult, "id">): string {
    try {
      // Generate trade ID
      const id = `trade-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      
      // Create full trade object
      const fullTrade: TradeResult = {
        id,
        ...trade
      };
      
      // Add to trades array
      this.trades.push(fullTrade);
      
      // Calculate profit
      const profitUSD = trade.profitUSD;
      const isProfit = profitUSD > 0;
      
      // Update overall stats
      const stats = this.stats.tradeStats;
      stats.totalTrades += 1;
      stats.successfulTrades += trade.success ? 1 : 0;
      stats.failedTrades += trade.success ? 0 : 1;
      stats.profitableTrades += isProfit ? 1 : 0;
      stats.losingTrades += isProfit ? 0 : 1;
      stats.totalProfitUSD += profitUSD;
      
      // Update win rate
      stats.winRate = stats.profitableTrades / stats.totalTrades;
      
      // Update average profit percentage
      const totalProfitPercentage = this.trades.reduce((sum, t) => sum + t.profitPercentage, 0);
      stats.avgProfitPercentage = totalProfitPercentage / stats.totalTrades;
      
      // Update average holding period
      const totalHoldingPeriod = this.trades.reduce((sum, t) => sum + t.holdingPeriodSeconds, 0);
      stats.avgHoldingPeriodSeconds = totalHoldingPeriod / stats.totalTrades;
      
      // Update best/worst trade
      if (stats.bestTrade.profitPercentage < trade.profitPercentage) {
        stats.bestTrade = {
          symbol: trade.symbol,
          profitPercentage: trade.profitPercentage,
          profitUSD: trade.profitUSD
        };
      }
      
      if (stats.worstTrade.profitPercentage > trade.profitPercentage || stats.worstTrade.symbol === '') {
        stats.worstTrade = {
          symbol: trade.symbol,
          profitPercentage: trade.profitPercentage,
          profitUSD: trade.profitUSD
        };
      }
      
      // Update stats by trade type
      const typeStats = stats.tradesByType[trade.type];
      if (typeStats) {
        typeStats.count += 1;
        typeStats.successCount += trade.success ? 1 : 0;
        typeStats.totalProfitUSD += profitUSD;
        
        // Calculate average profit for this trade type
        const tradesOfType = this.trades.filter(t => t.type === trade.type);
        const typeProfitPercentage = tradesOfType.reduce((sum, t) => sum + t.profitPercentage, 0);
        typeStats.avgProfitPercentage = typeProfitPercentage / typeStats.count;
      }
      
      // Update token performance
      if (!stats.tokenPerformance[trade.symbol]) {
        stats.tokenPerformance[trade.symbol] = {
          totalTrades: 0,
          totalProfitUSD: 0,
          avgProfitPercentage: 0,
          bestProfitPercentage: 0
        };
      }
      
      const tokenStats = stats.tokenPerformance[trade.symbol];
      tokenStats.totalTrades += 1;
      tokenStats.totalProfitUSD += profitUSD;
      
      // Calculate average profit for this token
      const tradesOfToken = this.trades.filter(t => t.symbol === trade.symbol);
      const tokenProfitPercentage = tradesOfToken.reduce((sum, t) => sum + t.profitPercentage, 0);
      tokenStats.avgProfitPercentage = tokenProfitPercentage / tokenStats.totalTrades;
      
      // Update best profit percentage for this token
      if (tokenStats.bestProfitPercentage < trade.profitPercentage) {
        tokenStats.bestProfitPercentage = trade.profitPercentage;
      }
      
      // Update quick flips stats (trades held less than 5 minutes)
      if (trade.holdingPeriodSeconds < 300) {
        this.stats.quickFlips.total += 1;
        this.stats.quickFlips.profitable += isProfit ? 1 : 0;
        this.stats.quickFlips.totalProfit += profitUSD;
        
        // Calculate average return for quick flips
        this.stats.quickFlips.averageReturn = this.stats.quickFlips.totalProfit / this.stats.quickFlips.total;
        
        // Calculate average holding period for quick flips
        const quickFlips = this.trades.filter(t => t.holdingPeriodSeconds < 300);
        const totalQuickFlipHoldingPeriod = quickFlips.reduce((sum, t) => sum + t.holdingPeriodSeconds, 0);
        this.stats.quickFlips.averageHoldingPeriodSeconds = totalQuickFlipHoldingPeriod / quickFlips.length;
      }
      
      // Save data
      this.saveData();
      
      // Log trade
      if (isProfit) {
        logger.info(`[MemeTracker] 🚀 PROFIT: $${profitUSD.toFixed(2)} (${trade.profitPercentage.toFixed(2)}%) from ${trade.type} on ${trade.symbol} in ${(trade.holdingPeriodSeconds / 60).toFixed(1)} minutes`);
      } else {
        logger.info(`[MemeTracker] 📉 LOSS: $${profitUSD.toFixed(2)} (${trade.profitPercentage.toFixed(2)}%) from ${trade.type} on ${trade.symbol} in ${(trade.holdingPeriodSeconds / 60).toFixed(1)} minutes`);
      }
      
      return id;
    } catch (error) {
      logger.error(`[MemeTracker] Error recording trade: ${error}`);
      return '';
    }
  }
  
  /**
   * Record a new signal
   */
  recordSignal(signal: {
    token: string;
    type: string;
    actioned: boolean;
    successful?: boolean;
  }): void {
    try {
      // Update signal stats
      this.stats.signalStats.totalSignals += 1;
      this.stats.signalStats.actionedSignals += signal.actioned ? 1 : 0;
      
      if (signal.successful) {
        this.stats.signalStats.successfulSignals += 1;
      }
      
      // Update signals by token
      if (!this.stats.signalStats.signalsByToken[signal.token]) {
        this.stats.signalStats.signalsByToken[signal.token] = 0;
      }
      this.stats.signalStats.signalsByToken[signal.token] += 1;
      
      // Update signals by type
      if (!this.stats.signalStats.signalsByType[signal.type]) {
        this.stats.signalStats.signalsByType[signal.type] = 0;
      }
      this.stats.signalStats.signalsByType[signal.type] += 1;
      
      // Save data
      this.saveData();
    } catch (error) {
      logger.error(`[MemeTracker] Error recording signal: ${error}`);
    }
  }
  
  /**
   * Get full stats
   */
  getStats(): MemecoinStats {
    return this.stats;
  }
  
  /**
   * Get quick flip stats
   */
  getQuickFlipStats(): {
    total: number;
    profitable: number;
    averageReturn: number;
    totalProfit: number;
    averageHoldingPeriodSeconds: number;
    winRate: number;
  } {
    return {
      ...this.stats.quickFlips,
      winRate: this.stats.quickFlips.profitable / (this.stats.quickFlips.total || 1)
    };
  }
  
  /**
   * Get recent trades
   */
  getRecentTrades(limit: number = 10): TradeResult[] {
    return this.trades.slice(-limit);
  }
  
  /**
   * Get trade history for a specific token
   */
  getTokenTradeHistory(symbol: string): TradeResult[] {
    return this.trades.filter(trade => trade.symbol === symbol);
  }
  
  /**
   * Get performance summary for all tracked tokens
   */
  getTokenPerformanceSummary(): {
    symbol: string;
    totalTrades: number;
    totalProfitUSD: number;
    avgProfitPercentage: number;
    bestProfitPercentage: number;
  }[] {
    const { tokenPerformance } = this.stats.tradeStats;
    
    return Object.entries(tokenPerformance).map(([symbol, stats]) => ({
      symbol,
      ...stats
    })).sort((a, b) => b.totalProfitUSD - a.totalProfitUSD);
  }
  
  /**
   * Get summary of trade types performance
   */
  getTradeTypePerformance(): {
    type: string;
    count: number;
    successRate: number;
    totalProfitUSD: number;
    avgProfitPercentage: number;
  }[] {
    const { tradesByType } = this.stats.tradeStats;
    
    return Object.entries(tradesByType).map(([type, stats]) => ({
      type,
      count: stats.count,
      successRate: stats.count > 0 ? stats.successCount / stats.count : 0,
      totalProfitUSD: stats.totalProfitUSD,
      avgProfitPercentage: stats.avgProfitPercentage
    })).sort((a, b) => b.totalProfitUSD - a.totalProfitUSD);
  }
  
  /**
   * Get signal effectiveness stats
   */
  getSignalEffectiveness(): {
    actionRate: number;
    successRate: number;
    mostSignaledTokens: { symbol: string; count: number }[];
    mostSuccessfulTokens: { symbol: string; successRate: number }[];
  } {
    const { signalStats } = this.stats;
    
    // Get most signaled tokens
    const mostSignaledTokens = Object.entries(signalStats.signalsByToken)
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Calculate success rate per token
    const tokenSuccess: Record<string, { total: number; successful: number }> = {};
    
    for (const trade of this.trades) {
      if (!tokenSuccess[trade.symbol]) {
        tokenSuccess[trade.symbol] = { total: 0, successful: 0 };
      }
      
      tokenSuccess[trade.symbol].total += 1;
      if (trade.profitPercentage > 0) {
        tokenSuccess[trade.symbol].successful += 1;
      }
    }
    
    // Get most successful tokens
    const mostSuccessfulTokens = Object.entries(tokenSuccess)
      .map(([symbol, { total, successful }]) => ({
        symbol,
        successRate: total > 0 ? successful / total : 0
      }))
      .filter(item => item.successRate > 0)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);
    
    return {
      actionRate: signalStats.totalSignals > 0 ? signalStats.actionedSignals / signalStats.totalSignals : 0,
      successRate: signalStats.actionedSignals > 0 ? signalStats.successfulSignals / signalStats.actionedSignals : 0,
      mostSignaledTokens,
      mostSuccessfulTokens
    };
  }
  
  /**
   * Get overall performance summary
   */
  getPerformanceSummary(): {
    totalTrades: number;
    winRate: number;
    totalProfitUSD: number;
    avgProfitPercentage: number;
    avgHoldingPeriodMinutes: number;
    bestTrade: {
      symbol: string;
      profitPercentage: number;
      profitUSD: number;
    };
    quickFlipStats: {
      total: number;
      winRate: number;
      avgReturnPercentage: number;
      totalProfit: number;
    };
    topPerformingTokens: string[];
    topPerformingStrategies: string[];
  } {
    const { tradeStats, quickFlips } = this.stats;
    
    // Get top performing tokens
    const topTokens = this.getTokenPerformanceSummary()
      .filter(t => t.avgProfitPercentage > 0)
      .slice(0, 3)
      .map(t => t.symbol);
    
    // Get top performing strategies
    const topStrategies = this.getTradeTypePerformance()
      .filter(t => t.avgProfitPercentage > 0)
      .slice(0, 3)
      .map(t => t.type);
    
    return {
      totalTrades: tradeStats.totalTrades,
      winRate: tradeStats.winRate,
      totalProfitUSD: tradeStats.totalProfitUSD,
      avgProfitPercentage: tradeStats.avgProfitPercentage,
      avgHoldingPeriodMinutes: tradeStats.avgHoldingPeriodSeconds / 60,
      bestTrade: tradeStats.bestTrade,
      quickFlipStats: {
        total: quickFlips.total,
        winRate: quickFlips.total > 0 ? quickFlips.profitable / quickFlips.total : 0,
        avgReturnPercentage: quickFlips.averageReturn,
        totalProfit: quickFlips.totalProfit
      },
      topPerformingTokens: topTokens,
      topPerformingStrategies: topStrategies
    };
  }
}

// Export singleton instance
export const memecoinTracker = MemecoinStrategyTracker.getInstance();