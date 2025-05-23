/**
 * Zero Capital Strategy Executor
 * Manages flash loans, MEV, and temporal strategies
 */

const SolendFlashStrategy = require('./solend-flash');
const JitoMEVInterceptor = require('./jito-mev');
const TemporalBlockSingularity = require('./temporal-block');

class ZeroCapitalExecutor {
  constructor() {
    this.strategies = {
      solendFlash: new SolendFlashStrategy(),
      jitoMEV: new JitoMEVInterceptor(),
      temporalBlock: new TemporalBlockSingularity()
    };
    
    this.executionCount = 0;
    this.totalProfit = 0;
    this.flashLoanCount = 0;
    this.mevExtractions = 0;
    
    console.log('[ZeroCapital] Initialized zero capital strategies');
  }

  async scanAllOpportunities() {
    console.log('[ZeroCapital] Scanning for zero capital opportunities...');
    
    const opportunities = [];
    
    try {
      // Scan flash loan arbitrage
      const flashOpp = await this.strategies.solendFlash.analyzeArbitrageOpportunity();
      if (flashOpp.profitable) {
        opportunities.push({
          type: 'flash_arbitrage',
          strategy: 'solendFlash',
          ...flashOpp
        });
      }
      
      // Scan MEV opportunities
      const mevOpps = await this.strategies.jitoMEV.scanMEVOpportunities();
      mevOpps.forEach(opp => {
        opportunities.push({
          type: 'mev_extraction',
          strategy: 'jitoMEV',
          opportunity: opp
        });
      });
      
      // Check temporal opportunities
      const temporalResult = await this.strategies.temporalBlock.executeTemporalArbitrage();
      if (temporalResult.success) {
        opportunities.push({
          type: 'temporal_arbitrage',
          strategy: 'temporalBlock',
          result: temporalResult
        });
      }
      
    } catch (error) {
      console.error('[ZeroCapital] Scan error:', error.message);
    }
    
    return opportunities;
  }

  async executeZeroCapitalStrategy() {
    const opportunities = await this.scanAllOpportunities();
    
    if (opportunities.length === 0) {
      console.log('[ZeroCapital] No profitable opportunities found');
      return null;
    }
    
    // Execute best opportunity
    const bestOpp = opportunities[0];
    console.log(`[ZeroCapital] Executing ${bestOpp.type} strategy`);
    
    let result;
    
    switch (bestOpp.strategy) {
      case 'solendFlash':
        result = await this.strategies.solendFlash.executeFlashLoan(bestOpp);
        this.flashLoanCount++;
        break;
        
      case 'jitoMEV':
        result = await this.strategies.jitoMEV.executeJitoBundle(bestOpp.opportunity);
        this.mevExtractions++;
        break;
        
      case 'temporalBlock':
        result = bestOpp.result;
        break;
        
      default:
        console.log('[ZeroCapital] Unknown strategy type');
        return null;
    }
    
    if (result && result.success) {
      this.executionCount++;
      this.totalProfit += result.actualProfit;
      
      console.log(`[ZeroCapital] Strategy executed successfully!`);
      console.log(`[ZeroCapital] Profit: ${result.actualProfit.toFixed(6)} SOL (zero capital used)`);
      console.log(`[ZeroCapital] Total profit: ${this.totalProfit.toFixed(6)} SOL`);
      console.log(`[ZeroCapital] Flash loans: ${this.flashLoanCount}, MEV extractions: ${this.mevExtractions}`);
    }
    
    return result;
  }

  getStats() {
    return {
      totalExecutions: this.executionCount,
      totalProfit: this.totalProfit,
      flashLoanExecutions: this.flashLoanCount,
      mevExtractions: this.mevExtractions,
      avgProfitPerExecution: this.executionCount > 0 ? this.totalProfit / this.executionCount : 0
    };
  }
}

module.exports = ZeroCapitalExecutor;
