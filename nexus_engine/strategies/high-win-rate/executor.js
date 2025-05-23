/**
 * High Win Rate Strategy Executor
 * Manages and executes the highest performing strategies
 */

const QuantumFlashArbitrage = require('./quantum-flash');
const NeuralMemeSniper = require('./neural-meme');

class HighWinRateExecutor {
  constructor() {
    this.strategies = [
      new QuantumFlashArbitrage(),
      new NeuralMemeSniper()
    ];
    
    this.activeStrategies = this.strategies.filter(s => s.enabled);
    this.executionCount = 0;
    this.totalProfit = 0;
    this.winCount = 0;
    
    console.log(`[HighWinRate] Initialized ${this.activeStrategies.length} high win rate strategies`);
  }

  async scanOpportunities() {
    const opportunities = [];
    
    for (const strategy of this.activeStrategies) {
      try {
        let opportunity;
        
        if (strategy.name === 'QuantumFlashArbitrage') {
          const marketData = await this.getMarketData();
          opportunity = await strategy.analyzeOpportunity(marketData);
        } else if (strategy.name === 'NeuralMemeSniper') {
          const tokenData = await this.getTokenData();
          const socialMetrics = await this.getSocialMetrics();
          opportunity = await strategy.analyzeToken(tokenData, socialMetrics);
        }
        
        if (opportunity && opportunity.profitable && opportunity.confidence >= strategy.minConfidence) {
          opportunities.push({
            strategy: strategy.name,
            ...opportunity,
            maxPositionSize: strategy.maxPositionSize
          });
        }
      } catch (error) {
        console.error(`[HighWinRate] Error scanning ${strategy.name}:`, error.message);
      }
    }
    
    return opportunities.sort((a, b) => b.confidence - a.confidence);
  }

  async executeTopOpportunity(walletBalance) {
    const opportunities = await this.scanOpportunities();
    
    if (opportunities.length === 0) {
      return null;
    }
    
    const bestOpp = opportunities[0];
    const strategy = this.strategies.find(s => s.name === bestOpp.strategy);
    const tradeAmount = Math.min(walletBalance * bestOpp.maxPositionSize, 0.6);
    
    if (tradeAmount < 0.001) {
      console.log('[HighWinRate] Trade amount too small, skipping');
      return null;
    }
    
    console.log(`[HighWinRate] Executing ${bestOpp.strategy} with ${tradeAmount.toFixed(6)} SOL (confidence: ${bestOpp.confidence.toFixed(1)}%)`);
    
    const result = await strategy.execute(bestOpp, tradeAmount);
    
    if (result.success) {
      this.executionCount++;
      this.totalProfit += result.actualProfit;
      this.winCount++;
      
      const currentWinRate = (this.winCount / this.executionCount) * 100;
      
      console.log(`[HighWinRate] Trade successful! Profit: ${result.actualProfit.toFixed(6)} SOL`);
      console.log(`[HighWinRate] Current win rate: ${currentWinRate.toFixed(1)}% (${this.winCount}/${this.executionCount})`);
      console.log(`[HighWinRate] Total profit: ${this.totalProfit.toFixed(6)} SOL`);
    }
    
    return result;
  }

  async getMarketData() {
    // Simulated market data
    return {
      timestamp: Date.now(),
      prices: {
        'SOL/USDC': 23.45 + Math.random() * 0.1,
        'BONK/SOL': 0.000001 + Math.random() * 0.0000001
      }
    };
  }

  async getTokenData() {
    return {
      address: 'TokenAddr' + Math.random().toString(36).substr(2, 9),
      price: Math.random() * 0.01,
      volume24h: 1000 + Math.random() * 5000
    };
  }

  async getSocialMetrics() {
    return {
      sentiment: 0.6 + Math.random() * 0.4,
      mentions: 100 + Math.random() * 500,
      trend: Math.random() > 0.5 ? 'bullish' : 'neutral'
    };
  }

  getStats() {
    const winRate = this.executionCount > 0 ? (this.winCount / this.executionCount) * 100 : 0;
    
    return {
      totalTrades: this.executionCount,
      winRate: winRate,
      totalProfit: this.totalProfit,
      avgProfitPerTrade: this.executionCount > 0 ? this.totalProfit / this.executionCount : 0
    };
  }
}

module.exports = HighWinRateExecutor;
