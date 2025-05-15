/**
 * Advanced Priority Fee Calculator
 *
 * Optimizes transaction priority fees based on:
 * - Expected profit from the transaction
 * - Current network congestion
 * - Recent block history
 * - Historical success rates
 */

import { ComputeBudgetProgram, Connection, PublicKey, Transaction } from '@solana/web3.js';
import { logger } from '../logger';
import { getSolanaConnection } from './ensureRpcConnection';
import axios from 'axios';

// Types for priority fee calculation
export interface HistoricalFeeData {
  timestamp: number;
  priorityFee: number;
  success: boolean;
  congestionLevel: number;
  profit: number;
}

export interface CalculationParams {
  baseFeeMultiplier: number;
  congestionMultiplier: number;
  profitBasedScaling: boolean;
  maxMicroLamports: number;
  minMicroLamports: number;
  defaultMicroLamports: number;
  adaptiveAdjustment: boolean;
  congestionCheckInterval: number;
}

export interface BlockhashInfo {
  blockhash: string;
  lastValidBlockHeight: number;
  timestamp: number;
}

// Default calculation parameters
const DEFAULT_PARAMS: CalculationParams = {
  baseFeeMultiplier: 1.2,
  congestionMultiplier: 1.5,
  profitBasedScaling: true,
  maxMicroLamports: 1_000_000, // 1M micro-lamports = 0.001 SOL per CU
  minMicroLamports: 1_000,     // 1K micro-lamports = 0.000001 SOL per CU
  defaultMicroLamports: 5_000, // Default value when data is insufficient
  adaptiveAdjustment: true,
  congestionCheckInterval: 60_000 // 1 minute
};

export class PriorityFeeCalculator {
  private historicalData: HistoricalFeeData[] = [];
  private recentBlockhashInfo: BlockhashInfo | null = null;
  private lastCongestionCheck: number = 0;
  private currentCongestionLevel: number = 0; 
  private connection: Connection;
  private params: CalculationParams;

  constructor(params: Partial<CalculationParams> = {}) {
    this.connection = getSolanaConnection();
    this.params = { ...DEFAULT_PARAMS, ...params };
  }
  
  /**
   * Update calculator parameters
   * @param params Partial parameters to update
   */
  public updateParams(params: Partial<CalculationParams>): void {
    this.params = { ...this.params, ...params };
  }

  /**
   * Calculate optimal priority fee based on current conditions
   * @param expectedProfit Expected profit from transaction in SOL
   * @returns Optimal priority fee in micro-lamports
   */
  public async calculateOptimalFee(expectedProfit?: number): Promise<number> {
    try {
      // Check congestion if needed
      await this.updateCongestionIfNeeded();
      
      // Get baseline fee
      let baseFee = this.getBaselineFee();
      
      // Adjust for congestion
      let congestionAdjustedFee = this.adjustForCongestion(baseFee);
      
      // Adjust for profitability if provided
      let finalFee = expectedProfit !== undefined ? 
        this.adjustForProfit(congestionAdjustedFee, expectedProfit) : 
        congestionAdjustedFee;
        
      // Apply adaptive adjustment based on historical success rates
      if (this.params.adaptiveAdjustment && this.historicalData.length > 5) {
        finalFee = this.applyAdaptiveAdjustment(finalFee);
      }
      
      // Ensure within bounds
      return this.clampFeeWithinBounds(finalFee);
    } catch (error) {
      logger.error('Error calculating optimal priority fee:', error);
      return this.params.defaultMicroLamports; // Fallback to default
    }
  }

  /**
   * Add transaction data to historical records for future optimization
   * @param priorityFee The fee that was used
   * @param success Whether the transaction succeeded
   * @param profit The profit made (if applicable)
   */
  public recordTransactionData(priorityFee: number, success: boolean, profit?: number): void {
    this.historicalData.push({
      timestamp: Date.now(),
      priorityFee,
      success,
      congestionLevel: this.currentCongestionLevel,
      profit: profit || 0
    });
    
    // Keep only last 100 records
    if (this.historicalData.length > 100) {
      this.historicalData.shift();
    }
  }

  /**
   * Update the latest blockhash information
   */
  public async updateBlockhashInfo(): Promise<void> {
    try {
      const blockhashInfo = await this.connection.getLatestBlockhash();
      this.recentBlockhashInfo = {
        blockhash: blockhashInfo.blockhash,
        lastValidBlockHeight: blockhashInfo.lastValidBlockHeight,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Error updating blockhash info:', error);
    }
  }

  /**
   * Get latest blockhash info, fetching if necessary
   */
  public async getBlockhashInfo(): Promise<BlockhashInfo | null> {
    // If no blockhash or it's more than 60 seconds old, update it
    if (!this.recentBlockhashInfo || 
        Date.now() - this.recentBlockhashInfo.timestamp > 60000) {
      await this.updateBlockhashInfo();
    }
    return this.recentBlockhashInfo;
  }

  /**
   * Apply priority fee to transaction
   * @param transaction Transaction to apply fee to
   * @param priorityFee Priority fee in micro-lamports
   * @param computeUnits Optional compute units (default 200,000)
   */
  public applyPriorityFee(
    transaction: Transaction, 
    priorityFee: number, 
    computeUnits: number = 200_000
  ): void {
    // Add compute budget instruction
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFee
      })
    );
    
    // Also set compute unit limit if not default
    if (computeUnits !== 200_000) {
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: computeUnits
        })
      );
    }
  }

  /**
   * Update network congestion level
   */
  private async updateCongestionIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCongestionCheck > this.params.congestionCheckInterval) {
      await this.updateCongestionLevel();
      this.lastCongestionCheck = now;
    }
  }

  /**
   * Update the current congestion level
   */
  private async updateCongestionLevel(): Promise<void> {
    try {
      // Multiple methods to estimate congestion for reliability
      
      // Method 1: Check recent performance
      const perfSamples = await this.connection.getRecentPerformanceSamples(5);
      if (perfSamples && perfSamples.length > 0) {
        // Calculate average transactions per slot
        const avgTps = perfSamples.reduce((sum, sample) => 
          sum + sample.numTransactions / sample.samplePeriodSecs, 0) / perfSamples.length;
        
        // Check against known TPS limits
        // Solana mainnet can handle ~2000-4000 TPS theoretically
        // Higher TPS indicates higher congestion
        if (avgTps > 2500) {
          this.currentCongestionLevel = 0.9; // High congestion
        } else if (avgTps > 1500) {
          this.currentCongestionLevel = 0.7; // Medium-high congestion
        } else if (avgTps > 500) {
          this.currentCongestionLevel = 0.4; // Medium congestion
        } else {
          this.currentCongestionLevel = 0.2; // Low congestion
        }
        return;
      }
      
      // Method 2: Use Helius API if available
      if (process.env.HELIUS_API_KEY) {
        try {
          const response = await axios.get(`https://api.helius.xyz/v0/network-status?api-key=${process.env.HELIUS_API_KEY}`);
          if (response.data && response.data.congestionLevel) {
            // Map Helius congestion levels to our scale
            const heliusLevel = response.data.congestionLevel.toLowerCase();
            if (heliusLevel === 'high') {
              this.currentCongestionLevel = 0.9;
            } else if (heliusLevel === 'medium') {
              this.currentCongestionLevel = 0.5;
            } else {
              this.currentCongestionLevel = 0.2;
            }
            return;
          }
        } catch (error) {
          logger.warn('Failed to get congestion data from Helius:', error);
          // Continue to fallback methods
        }
      }
      
      // Method 3: Use recent blockhash information as fallback
      const blockhashInfo = await this.getBlockhashInfo();
      
      // Default to moderate congestion
      this.currentCongestionLevel = 0.5;
    } catch (error) {
      logger.error('Error updating congestion level:', error);
      // Default to moderate congestion on error
      this.currentCongestionLevel = 0.5;
    }
  }

  /**
   * Get baseline fee from historical data or default
   */
  private getBaselineFee(): number {
    if (this.historicalData.length === 0) {
      return this.params.defaultMicroLamports;
    }
    
    // Get successful transactions in the last hour
    const lastHour = Date.now() - 3600000;
    const recentSuccessful = this.historicalData.filter(
      data => data.success && data.timestamp > lastHour
    );
    
    if (recentSuccessful.length > 5) {
      // Use median of recent successful fees
      const sortedFees = recentSuccessful
        .map(data => data.priorityFee)
        .sort((a, b) => a - b);
      
      const medianFee = sortedFees[Math.floor(sortedFees.length / 2)];
      return medianFee * this.params.baseFeeMultiplier;
    }
    
    return this.params.defaultMicroLamports;
  }

  /**
   * Adjust fee based on network congestion
   */
  private adjustForCongestion(baseFee: number): number {
    // Exponential scaling based on congestion level
    const congestionFactor = Math.pow(
      this.params.congestionMultiplier, 
      this.currentCongestionLevel * 10
    );
    
    return baseFee * congestionFactor;
  }

  /**
   * Adjust fee based on expected profit
   */
  private adjustForProfit(fee: number, expectedProfit: number): number {
    if (!this.params.profitBasedScaling || expectedProfit <= 0) {
      return fee;
    }
    
    // Convert profit to lamports (1 SOL = 1e9 lamports)
    const profitLamports = expectedProfit * 1e9;
    
    // Scale fee to be proportional to profit, but no more than 1% of expected profit
    const maxFeeFromProfit = profitLamports * 0.01 / 200000; // Per compute unit
    
    // Use either the congestion-based fee or profit-based cap, whichever is lower
    return Math.min(fee, maxFeeFromProfit);
  }

  /**
   * Apply adaptive adjustment based on success rates
   */
  private applyAdaptiveAdjustment(fee: number): number {
    // Get recent transactions
    const recentTransactions = this.historicalData.slice(-20);
    
    if (recentTransactions.length < 5) {
      return fee;
    }
    
    // Calculate success rate
    const successRate = recentTransactions.filter(tx => tx.success).length / 
                       recentTransactions.length;
    
    if (successRate < 0.7) {
      // Low success rate, increase fee
      const adjustmentFactor = 1 + ((0.7 - successRate) * 2);
      return fee * adjustmentFactor;
    } else if (successRate > 0.95 && this.historicalData.length > 30) {
      // Very high success rate, can slightly decrease fee to optimize
      return fee * 0.95;
    }
    
    return fee;
  }

  /**
   * Ensure fee is within allowed bounds
   */
  private clampFeeWithinBounds(fee: number): number {
    return Math.min(
      Math.max(fee, this.params.minMicroLamports),
      this.params.maxMicroLamports
    );
  }
}

// Singleton instance
let priorityFeeCalculatorInstance: PriorityFeeCalculator | null = null;

/**
 * Get priority fee calculator instance
 */
export function getPriorityFeeCalculator(params?: Partial<CalculationParams>): PriorityFeeCalculator {
  if (!priorityFeeCalculatorInstance) {
    priorityFeeCalculatorInstance = new PriorityFeeCalculator(params);
  } else if (params) {
    // Update params if provided
    priorityFeeCalculatorInstance.updateParams(params);
  }
  
  return priorityFeeCalculatorInstance;
}

// Add missing updateParams method to the class
PriorityFeeCalculator.prototype.updateParams = function(params: Partial<CalculationParams>): void {
  this.params = { ...this.params, ...params };
};