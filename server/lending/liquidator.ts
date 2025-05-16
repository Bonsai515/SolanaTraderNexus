/**
 * Solend Liquidator Core
 * 
 * This module provides the core functionality for monitoring and liquidating
 * undercollateralized positions on Solend protocol.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
  TransactionInstruction,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { 
  getAllObligations, 
  getAllReserves, 
  refreshReserve, 
  refreshObligation, 
  liquidateObligation,
  LiquidateObligationParams,
  parsePriceData,
  getTokenPrice,
  generateRefreshReserveAccounts,
  generateRefreshObligationAccounts,
  generateLiquidateObligationAccounts
} from './solendUtils';
import * as logger from '../logger';
import * as fs from 'fs';
import * as path from 'path';

// Types
interface ObligationInfo {
  id: PublicKey;
  owner: PublicKey;
  deposits: {
    mintAddress: PublicKey;
    symbol: string;
    amount: number;
    market: string;
    value: number;
  }[];
  borrows: {
    mintAddress: PublicKey;
    symbol: string;
    amount: number;
    market: string;
    value: number;
  }[];
  borrowLimit: number;
  borrowValue: number;
  utilizationRate: number;
  liquidationThreshold: number;
  healthFactor: number;
  market: string;
  lastUpdated: number;
}

interface ReserveInfo {
  id: PublicKey;
  mintAddress: PublicKey;
  symbol: string;
  market: string;
  liquiditySupply: number;
  availableLiquidity: number;
  utilizationRate: number;
  borrowedAmount: number;
  depositApy: number;
  borrowApy: number;
  price: number;
  totalSupplyValue: number;
  totalBorrowValue: number;
  liquidationBonus: number;
  optimalUtilization: number;
}

interface LiquidationOpportunity {
  obligation: ObligationInfo;
  liquidateAmount: number;
  repayMint: PublicKey;
  repaySymbol: string;
  repayValue: number;
  withdrawMint: PublicKey;
  withdrawSymbol: string;
  withdrawValue: number;
  profit: number;
  profitPercent: number;
  liquidationBonus: number;
  maxLtvPercent: number;
  timestamp: number;
}

// Constants
const CONFIG_DIR = '../config';
const SOLEND_CONFIG_PATH = path.join(CONFIG_DIR, 'solend.json');

/**
 * Load Solend configuration
 */
function loadSolendConfig() {
  try {
    if (fs.existsSync(SOLEND_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(SOLEND_CONFIG_PATH, 'utf8'));
    }
  } catch (error) {
    logger.error('Error loading Solend config:', error);
  }
  
  return { 
    enabled: true,
    monitoring: { 
      enabled: true, 
      pollIntervalMs: 10000
    },
    liquidation: {
      enabled: true,
      autoLiquidate: true
    }
  };
}

/**
 * Solend Liquidator class
 */
export class SolendLiquidator {
  private connection: Connection;
  private config: any;
  private wallet: Keypair | null = null;
  private obligations: ObligationInfo[] = [];
  private reserves: Map<string, ReserveInfo> = new Map();
  private opportunities: LiquidationOpportunity[] = [];
  private monitorInterval: NodeJS.Timeout | null = null;
  private lastMonitorTime: number = 0;
  private executedLiquidations: Map<string, any> = new Map();
  
  constructor(connection: Connection) {
    this.connection = connection;
    this.config = loadSolendConfig();
    
    logger.info('[SolendLiquidator] Initialized');
  }
  
  /**
   * Initialize with wallet
   */
  public initialize(wallet: Keypair): void {
    this.wallet = wallet;
    logger.info(`[SolendLiquidator] Initialized with wallet: ${wallet.publicKey.toString()}`);
  }
  
  /**
   * Start monitoring for liquidation opportunities
   */
  public startMonitoring(): void {
    if (this.monitorInterval) {
      logger.warn('[SolendLiquidator] Monitoring already started');
      return;
    }
    
    if (!this.config.monitoring.enabled) {
      logger.warn('[SolendLiquidator] Monitoring disabled in configuration');
      return;
    }
    
    logger.info('[SolendLiquidator] Starting liquidation opportunity monitoring');
    
    const pollInterval = this.config.monitoring.pollIntervalMs || 10000;
    
    // Immediately run monitoring once
    this.monitorLiquidationOpportunities().catch(err => {
      logger.error('[SolendLiquidator] Error in initial monitoring:', err);
    });
    
    // Start interval
    this.monitorInterval = setInterval(() => {
      this.monitorLiquidationOpportunities().catch(err => {
        logger.error('[SolendLiquidator] Error in monitoring interval:', err);
      });
    }, pollInterval);
    
    logger.info(`[SolendLiquidator] Monitoring started with ${pollInterval}ms interval`);
  }
  
  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (!this.monitorInterval) {
      logger.warn('[SolendLiquidator] Monitoring not started');
      return;
    }
    
    clearInterval(this.monitorInterval);
    this.monitorInterval = null;
    
    logger.info('[SolendLiquidator] Monitoring stopped');
  }
  
  /**
   * Get all liquidation opportunities
   */
  public getLiquidationOpportunities(): LiquidationOpportunity[] {
    return [...this.opportunities];
  }
  
  /**
   * Monitor for liquidation opportunities
   */
  private async monitorLiquidationOpportunities(): Promise<void> {
    try {
      this.lastMonitorTime = Date.now();
      
      // Load all reserves
      await this.loadReserves();
      
      // Load all obligations
      await this.loadObligations();
      
      // Calculate liquidation opportunities
      await this.calculateLiquidationOpportunities();
      
      logger.info(`[SolendLiquidator] Found ${this.opportunities.length} liquidation opportunities`);
      
      // Auto-liquidate if enabled
      if (this.config.liquidation.autoLiquidate && this.opportunities.length > 0) {
        await this.processLiquidationOpportunities();
      }
    } catch (error) {
      logger.error('[SolendLiquidator] Error monitoring liquidation opportunities:', error);
    }
  }
  
  /**
   * Load all reserves
   */
  private async loadReserves(): Promise<void> {
    try {
      // In a real implementation, this would use the Solend SDK to fetch reserves
      // For demonstration, we'll use mock data
      const mockReserves: ReserveInfo[] = [
        {
          id: new PublicKey("8PbodeaosQP19SjYFx855UMqWxH2HynZLdBXmsrbac36"),
          mintAddress: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
          symbol: "USDC",
          market: "main",
          liquiditySupply: 10000000,
          availableLiquidity: 5000000,
          utilizationRate: 0.7,
          borrowedAmount: 7000000,
          depositApy: 0.03,
          borrowApy: 0.05,
          price: 1.0,
          totalSupplyValue: 10000000,
          totalBorrowValue: 7000000,
          liquidationBonus: 0.05, // 5% bonus for liquidating this asset
          optimalUtilization: 0.8
        },
        {
          id: new PublicKey("8PbodeaosQP19SjYFx855UMqWxH2HynZLdBXmsrbac36"),
          mintAddress: new PublicKey("So11111111111111111111111111111111111111112"),
          symbol: "SOL",
          market: "main",
          liquiditySupply: 100000,
          availableLiquidity: 30000,
          utilizationRate: 0.6,
          borrowedAmount: 60000,
          depositApy: 0.02,
          borrowApy: 0.04,
          price: 155.0,
          totalSupplyValue: 15500000,
          totalBorrowValue: 9300000,
          liquidationBonus: 0.075, // 7.5% bonus for liquidating this asset
          optimalUtilization: 0.8
        }
      ];
      
      // Clear and update reserves
      this.reserves.clear();
      
      for (const reserve of mockReserves) {
        this.reserves.set(reserve.mintAddress.toString(), reserve);
      }
      
      logger.info(`[SolendLiquidator] Loaded ${this.reserves.size} reserves`);
    } catch (error) {
      logger.error('[SolendLiquidator] Error loading reserves:', error);
      throw error;
    }
  }
  
  /**
   * Load all obligations
   */
  private async loadObligations(): Promise<void> {
    try {
      // In a real implementation, this would use the Solend SDK to fetch obligations
      // For demonstration, we'll use mock data
      const mockObligations: ObligationInfo[] = [
        {
          id: new PublicKey("5WXMM3wqjbraEGQqbU2SxxpURjhVn3qDN7mNtL2Dpe8x"),
          owner: new PublicKey("8J6ZMCvzJJv1UfPKmvj5zSiJ9nXLkLaEVBC9yP73HFuF"),
          deposits: [
            {
              mintAddress: new PublicKey("So11111111111111111111111111111111111111112"),
              symbol: "SOL",
              amount: 10.0,
              market: "main",
              value: 1550.0 // 10 SOL * $155
            }
          ],
          borrows: [
            {
              mintAddress: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
              symbol: "USDC",
              amount: 1400.0,
              market: "main",
              value: 1400.0 // 1400 USDC * $1
            }
          ],
          borrowLimit: 1550.0 * 0.85, // 85% LTV
          borrowValue: 1400.0,
          utilizationRate: 1400.0 / (1550.0 * 0.85),
          liquidationThreshold: 0.9, // 90% liquidation threshold
          healthFactor: (1550.0 * 0.9) / 1400.0, // slightly unhealthy
          market: "main",
          lastUpdated: Date.now()
        },
        {
          id: new PublicKey("6gZyvJZVpkBuT1j8BwVXzwcHZ9FGZZ7VMxe5zxAGgKHT"),
          owner: new PublicKey("9J6ZMCvzJJv1UfPKmvj5zSiJ9nXLkLaEVBC9yP73KKLE"),
          deposits: [
            {
              mintAddress: new PublicKey("So11111111111111111111111111111111111111112"),
              symbol: "SOL",
              amount: 5.0,
              market: "main",
              value: 775.0 // 5 SOL * $155
            }
          ],
          borrows: [
            {
              mintAddress: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
              symbol: "USDC",
              amount: 700.0,
              market: "main",
              value: 700.0 // 700 USDC * $1
            }
          ],
          borrowLimit: 775.0 * 0.85, // 85% LTV
          borrowValue: 700.0,
          utilizationRate: 700.0 / (775.0 * 0.85),
          liquidationThreshold: 0.9, // 90% liquidation threshold
          healthFactor: (775.0 * 0.9) / 700.0, // even less healthy
          market: "main",
          lastUpdated: Date.now()
        }
      ];
      
      // Update obligations
      this.obligations = mockObligations;
      
      logger.info(`[SolendLiquidator] Loaded ${this.obligations.length} obligations`);
    } catch (error) {
      logger.error('[SolendLiquidator] Error loading obligations:', error);
      throw error;
    }
  }
  
  /**
   * Calculate liquidation opportunities
   */
  private async calculateLiquidationOpportunities(): Promise<void> {
    try {
      // Clear current opportunities
      this.opportunities = [];
      
      // Get health factor threshold
      const healthFactorThreshold = this.config.monitoring.healthFactorThreshold || 1.05;
      
      // Filter obligations by health factor
      const unhealthyObligations = this.obligations.filter(
        obligation => obligation.healthFactor < healthFactorThreshold
      );
      
      logger.info(`[SolendLiquidator] Found ${unhealthyObligations.length} unhealthy obligations`);
      
      // Calculate liquidation opportunities
      for (const obligation of unhealthyObligations) {
        try {
          // Find the best borrow to repay (highest value)
          const bestBorrow = obligation.borrows.reduce(
            (best, current) => current.value > best.value ? current : best,
            obligation.borrows[0]
          );
          
          if (!bestBorrow) {
            continue;
          }
          
          // Find the best deposit to withdraw (highest value)
          const bestDeposit = obligation.deposits.reduce(
            (best, current) => current.value > best.value ? current : best,
            obligation.deposits[0]
          );
          
          if (!bestDeposit) {
            continue;
          }
          
          // Get reserves info
          const repayReserve = this.reserves.get(bestBorrow.mintAddress.toString());
          const withdrawReserve = this.reserves.get(bestDeposit.mintAddress.toString());
          
          if (!repayReserve || !withdrawReserve) {
            continue;
          }
          
          // Calculate max LTV
          const maxLtvPercent = obligation.borrowLimit / obligation.deposits.reduce((sum, deposit) => sum + deposit.value, 0) * 100;
          
          // Calculate liquidation amount (50% of the borrow)
          const liquidateAmount = bestBorrow.amount * 0.5;
          
          // Calculate liquidation value
          const repayValue = liquidateAmount;
          
          // Calculate withdraw value with liquidation bonus
          const withdrawValue = repayValue * (1 + withdrawReserve.liquidationBonus);
          
          // Calculate profit
          const profit = withdrawValue - repayValue;
          const profitPercent = (profit / repayValue) * 100;
          
          // Create liquidation opportunity
          const opportunity: LiquidationOpportunity = {
            obligation,
            liquidateAmount,
            repayMint: bestBorrow.mintAddress,
            repaySymbol: bestBorrow.symbol,
            repayValue,
            withdrawMint: bestDeposit.mintAddress,
            withdrawSymbol: bestDeposit.symbol,
            withdrawValue,
            profit,
            profitPercent,
            liquidationBonus: withdrawReserve.liquidationBonus * 100,
            maxLtvPercent,
            timestamp: Date.now()
          };
          
          // Add to opportunities
          this.opportunities.push(opportunity);
          
          logger.info(`[SolendLiquidator] Found liquidation opportunity: Repay ${liquidateAmount} ${bestBorrow.symbol} to withdraw ${bestDeposit.symbol} with ${profitPercent.toFixed(2)}% profit`);
        } catch (error) {
          logger.error(`[SolendLiquidator] Error calculating liquidation opportunity for obligation ${obligation.id.toString()}:`, error);
        }
      }
      
      // Sort opportunities by profit percent (descending)
      this.opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
      
      logger.info(`[SolendLiquidator] Calculated ${this.opportunities.length} liquidation opportunities`);
    } catch (error) {
      logger.error('[SolendLiquidator] Error calculating liquidation opportunities:', error);
      throw error;
    }
  }
  
  /**
   * Process liquidation opportunities
   */
  private async processLiquidationOpportunities(): Promise<void> {
    try {
      // Skip if no wallet
      if (!this.wallet) {
        logger.warn('[SolendLiquidator] Cannot liquidate without wallet');
        return;
      }
      
      // Get min profit threshold
      const minProfitThreshold = this.config.liquidation.minProfitThreshold || 0.5;
      
      // Filter opportunities by profit threshold
      const profitableOpportunities = this.opportunities.filter(
        opp => opp.profitPercent >= minProfitThreshold
      );
      
      logger.info(`[SolendLiquidator] Found ${profitableOpportunities.length} profitable liquidation opportunities`);
      
      // Get max concurrent liquidations
      const maxConcurrent = this.config.liquidation.execution?.maxConcurrentLiquidations || 3;
      
      // Process the top opportunities
      const toProcess = profitableOpportunities.slice(0, maxConcurrent);
      
      // Process each opportunity
      for (const opportunity of toProcess) {
        try {
          // Skip if already processed this obligation recently
          if (this.executedLiquidations.has(opportunity.obligation.id.toString())) {
            continue;
          }
          
          // Execute liquidation
          const signature = await this.executeLiquidation(opportunity);
          
          if (signature) {
            // Record successful liquidation
            this.executedLiquidations.set(opportunity.obligation.id.toString(), {
              signature,
              opportunity,
              timestamp: Date.now()
            });
            
            // Limit cache size to 100 entries
            if (this.executedLiquidations.size > 100) {
              // Remove oldest entry
              const oldestKey = [...this.executedLiquidations.keys()][0];
              this.executedLiquidations.delete(oldestKey);
            }
          }
        } catch (error) {
          logger.error(`[SolendLiquidator] Error processing liquidation opportunity for obligation ${opportunity.obligation.id.toString()}:`, error);
        }
      }
    } catch (error) {
      logger.error('[SolendLiquidator] Error processing liquidation opportunities:', error);
    }
  }
  
  /**
   * Execute a liquidation
   */
  private async executeLiquidation(opportunity: LiquidationOpportunity): Promise<string | null> {
    try {
      logger.info(`[SolendLiquidator] Executing liquidation: Repay ${opportunity.liquidateAmount} ${opportunity.repaySymbol} for obligation ${opportunity.obligation.id.toString()}`);
      
      // In a real implementation, this would use the Solend SDK to execute the liquidation
      // For demonstration, we'll just simulate a transaction
      
      // Simulate a transaction signature
      const signature = `solend_liquidation_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      logger.info(`[SolendLiquidator] Liquidation executed successfully: ${signature}`);
      
      return signature;
    } catch (error) {
      logger.error('[SolendLiquidator] Error executing liquidation:', error);
      return null;
    }
  }
  
  /**
   * Get liquidator status
   */
  public getStatus(): any {
    return {
      isMonitoring: this.monitorInterval !== null,
      lastMonitorTime: this.lastMonitorTime,
      totalObligations: this.obligations.length,
      totalOpportunities: this.opportunities.length,
      totalExecutedLiquidations: this.executedLiquidations.size,
      topOpportunities: this.opportunities.slice(0, 5), // Top 5 opportunities
      recentLiquidations: [...this.executedLiquidations.values()].slice(-5) // Last 5 liquidations
    };
  }
}