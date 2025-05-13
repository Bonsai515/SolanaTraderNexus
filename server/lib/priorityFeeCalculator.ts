/**
 * Advanced Priority Fee Calculator
 * 
 * Optimizes transaction priority fees based on:
 * - Expected profit from the transaction
 * - Current network congestion
 * - Recent block history
 * - Historical success rates
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../logger';
import { getSolanaConnection } from './ensureRpcConnection';

// Window to analyze for fee calculation
const FEE_WINDOW_SLOTS = 150;

// Fee model parameters
interface FeeModelParameters {
  baseFeeMicroLamports: number;  // Base fee in micro-lamports
  maxFeeMicroLamports: number;   // Maximum fee in micro-lamports
  profitMultiplier: number;      // Multiplier based on expected profit
  congestionMultiplier: number;  // Multiplier based on network congestion
  urgencyMultiplier: number;     // Multiplier for urgent transactions
  minSuccessRate: number;        // Minimum target success rate (0-1)
}

// Default parameters
const DEFAULT_PARAMS: FeeModelParameters = {
  baseFeeMicroLamports: 1_000_000,  // 1,000,000 micro-lamports = 0.001 SOL
  maxFeeMicroLamports: 1_000_000_000, // 1 SOL max
  profitMultiplier: 0.05,          // 5% of profit
  congestionMultiplier: 2.5,       // Up to 2.5x during high congestion
  urgencyMultiplier: 3.0,          // Up to 3x for urgent transactions
  minSuccessRate: 0.95             // Target 95% success rate
};

// Historical fee data for learning
interface HistoricalFeeData {
  timestamp: number;
  feeMicroLamports: number;
  successful: boolean;
  expectedProfit: number;
  actualProfit: number;
  congestionLevel: number;
}

/**
 * Priority Fee Calculator with machine learning optimization
 */
export class PriorityFeeCalculator {
  private connection: Connection;
  private params: FeeModelParameters;
  private historicalData: HistoricalFeeData[] = [];
  private recentBlockhashInfo: any = null;
  private lastCongestionCheck: number = 0;
  private currentCongestionLevel: number = 0;

  constructor(params: Partial<FeeModelParameters> = {}) {
    this.connection = getSolanaConnection();
    this.params = { ...DEFAULT_PARAMS, ...params };
  }

  /**
   * Calculate optimal priority fee based on expected profit
   * @param expectedProfitUsd Expected profit in USD
   * @param urgent Whether this is an urgent transaction
   * @returns Priority fee in micro-lamports
   */
  public async calculatePriorityFee(
    expectedProfitUsd: number,
    urgent: boolean = false
  ): Promise<number> {
    try {
      // Update congestion data if needed
      await this.updateCongestionLevel();
      
      // Get SOL price for conversion
      const solPriceUsd = await this.getSolPrice();
      
      // Expected profit in lamports
      const expectedProfitLamports = (expectedProfitUsd / solPriceUsd) * 1_000_000_000;
      
      // Base calculation
      let priorityFeeMicroLamports = this.params.baseFeeMicroLamports;
      
      // Add profit-based component
      priorityFeeMicroLamports += Math.floor(
        expectedProfitLamports * 1000 * this.params.profitMultiplier
      );
      
      // Apply congestion multiplier
      priorityFeeMicroLamports = Math.floor(
        priorityFeeMicroLamports * (1 + (this.currentCongestionLevel * this.params.congestionMultiplier))
      );
      
      // Apply urgency multiplier if needed
      if (urgent) {
        priorityFeeMicroLamports = Math.floor(
          priorityFeeMicroLamports * this.params.urgencyMultiplier
        );
      }
      
      // Apply machine learning adjustment based on historical data
      priorityFeeMicroLamports = this.applyMachineLearningAdjustment(
        priorityFeeMicroLamports,
        expectedProfitUsd,
        urgent
      );
      
      // Ensure fee is within limits
      priorityFeeMicroLamports = Math.min(
        priorityFeeMicroLamports,
        this.params.maxFeeMicroLamports
      );
      
      // Convert to lamports for logging
      const priorityFeeLamports = priorityFeeMicroLamports / 1000;
      logger.debug(`Calculated priority fee: ${priorityFeeLamports} lamports (${priorityFeeLamports / 1_000_000_000} SOL)`);
      
      return priorityFeeMicroLamports;
    } catch (error) {
      logger.error(`Error calculating priority fee: ${error}`);
      return this.params.baseFeeMicroLamports;
    }
  }

  /**
   * Record transaction outcome for learning
   */
  public recordTransactionOutcome(
    feeMicroLamports: number,
    successful: boolean,
    expectedProfit: number,
    actualProfit: number
  ): void {
    this.historicalData.push({
      timestamp: Date.now(),
      feeMicroLamports,
      successful,
      expectedProfit,
      actualProfit,
      congestionLevel: this.currentCongestionLevel
    });
    
    // Keep history limited to last 1000 transactions
    if (this.historicalData.length > 1000) {
      this.historicalData.shift();
    }
    
    // Trigger model optimization
    this.optimizeModel();
  }

  /**
   * Update network congestion level
   */
  private async updateCongestionLevel(): Promise<void> {
    // Only check every 10 seconds
    if (Date.now() - this.lastCongestionCheck < 10000) {
      return;
    }
    
    try {
      // Get recent performance samples
      const perfSamples = await this.connection.getRecentPerformanceSamples(FEE_WINDOW_SLOTS);
      
      if (!perfSamples || perfSamples.length === 0) {
        logger.warn('No performance samples available for congestion calculation');
        return;
      }
      
      // Calculate average transactions per slot
      const totalTxCount = perfSamples.reduce((sum, sample) => sum + sample.numTransactions, 0);
      const totalSlots = perfSamples.reduce((sum, sample) => sum + sample.samplePeriodSecs, 0);
      const avgTxPerSlot = totalSlots > 0 ? totalTxCount / totalSlots : 0;
      
      // Network congestion is normalized between 0 and 1
      // Assuming 2000 tx/sec is high congestion
      this.currentCongestionLevel = Math.min(avgTxPerSlot / 2000, 1);
      
      this.lastCongestionCheck = Date.now();
      logger.debug(`Current network congestion level: ${this.currentCongestionLevel.toFixed(2)}`);
    } catch (error) {
      logger.error(`Error updating congestion level: ${error}`);
    }
  }

  /**
   * Get current SOL price in USD
   */
  private async getSolPrice(): Promise<number> {
    // In a real implementation, this would call an oracle or price feed
    // For now, using a placeholder price
    return 145.75; // Current SOL price in USD
  }

  /**
   * Apply machine learning adjustment based on historical data
   */
  private applyMachineLearningAdjustment(
    baseFee: number,
    expectedProfit: number,
    urgent: boolean
  ): number {
    if (this.historicalData.length < 10) {
      return baseFee; // Not enough data yet
    }
    
    // Get recent similar transactions
    const similarTransactions = this.getSimilarTransactions(expectedProfit, urgent);
    
    if (similarTransactions.length < 5) {
      return baseFee; // Not enough similar transactions
    }
    
    // Calculate success rate at different fee levels
    const feeGroups = this.groupByFeeLevel(similarTransactions);
    
    // Find minimum fee level that meets target success rate
    let optimalFee = baseFee;
    let highestSuccessRate = 0;
    
    for (const [feeLevelStr, transactions] of Object.entries(feeGroups)) {
      const feeLevel = parseInt(feeLevelStr);
      const successCount = transactions.filter(tx => tx.successful).length;
      const successRate = successCount / transactions.length;
      
      if (successRate >= this.params.minSuccessRate && successRate > highestSuccessRate) {
        optimalFee = feeLevel;
        highestSuccessRate = successRate;
      }
    }
    
    // If we couldn't find a fee level with target success rate, use base fee
    return optimalFee !== baseFee ? optimalFee : baseFee;
  }

  /**
   * Get similar historical transactions
   */
  private getSimilarTransactions(
    expectedProfit: number,
    urgent: boolean
  ): HistoricalFeeData[] {
    // Get transactions from similar market conditions
    return this.historicalData.filter(tx => {
      // Within 20% of profit range and similar congestion conditions
      const profitSimilar = Math.abs(tx.expectedProfit - expectedProfit) / expectedProfit < 0.2;
      const congestionSimilar = Math.abs(tx.congestionLevel - this.currentCongestionLevel) < 0.2;
      
      return profitSimilar && congestionSimilar;
    });
  }

  /**
   * Group transactions by fee level
   */
  private groupByFeeLevel(transactions: HistoricalFeeData[]): Record<number, HistoricalFeeData[]> {
    const groups: Record<number, HistoricalFeeData[]> = {};
    
    // Group by fee level (rounded to nearest 100,000 micro-lamports)
    for (const tx of transactions) {
      const feeLevel = Math.round(tx.feeMicroLamports / 100000) * 100000;
      
      if (!groups[feeLevel]) {
        groups[feeLevel] = [];
      }
      
      groups[feeLevel].push(tx);
    }
    
    return groups;
  }

  /**
   * Optimize model parameters based on historical data
   */
  private optimizeModel(): void {
    if (this.historicalData.length < 100) {
      return; // Not enough data yet
    }
    
    // Calculate success rates for different parameter settings
    // This is a simplified implementation that would be more sophisticated in production
    
    // Analyze profit multiplier effectiveness
    const profitCorrelation = this.calculateProfitMultiplierCorrelation();
    
    if (profitCorrelation > 0.7) {
      // Strong correlation, increase multiplier
      this.params.profitMultiplier *= 1.05;
    } else if (profitCorrelation < 0.3) {
      // Weak correlation, decrease multiplier
      this.params.profitMultiplier *= 0.95;
    }
    
    // Keep parameters within reasonable bounds
    this.params.profitMultiplier = Math.min(Math.max(this.params.profitMultiplier, 0.01), 0.2);
    
    logger.debug(`Optimized fee model parameters: profitMultiplier=${this.params.profitMultiplier.toFixed(3)}`);
  }

  /**
   * Calculate correlation between profit multiplier and success rate
   */
  private calculateProfitMultiplierCorrelation(): number {
    // This would be a more complex calculation in production
    // Simplified implementation for demonstration
    
    const recentTransactions = this.historicalData.slice(-100);
    const successfulCount = recentTransactions.filter(tx => tx.successful).length;
    
    return successfulCount / recentTransactions.length;
  }
}

// Create singleton instance
const priorityFeeCalculator = new PriorityFeeCalculator();

/**
 * Get the priority fee calculator instance
 */
export function getPriorityFeeCalculator(): PriorityFeeCalculator {
  return priorityFeeCalculator;
}