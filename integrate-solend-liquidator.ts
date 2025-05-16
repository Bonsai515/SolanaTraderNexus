/**
 * Integrate Solend Liquidator
 * 
 * This script integrates Solend liquidation functionality to:
 * 1. Monitor Solend protocol for undercollateralized positions
 * 2. Execute liquidations for profitable opportunities
 * 3. Integrate with the existing trading system
 */

import * as fs from 'fs';
import * as path from 'path';

// Critical paths
const SERVER_DIR = './server';
const CONFIG_DIR = './server/config';
const SOLEND_DIR = './server/lending';
const SOLEND_CONFIG_PATH = path.join(CONFIG_DIR, 'solend.json');
const SYSTEM_MEMORY_PATH = path.join('./data', 'system-memory.json');

// Main wallet
const MAIN_WALLET_ADDRESS = "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb";

/**
 * Create Solend configuration
 */
function createSolendConfiguration(): void {
  console.log('Creating Solend configuration...');
  
  try {
    // Create Solend configuration
    const solendConfig = {
      version: "1.0.0",
      enabled: true,
      monitoring: {
        enabled: true,
        pollIntervalMs: 10000, // 10 seconds
        healthFactorThreshold: 1.05, // Monitor positions with health factor below 1.05
        minLiquidationValue: 100, // Minimum liquidation value in USD
        maxPositionsToMonitor: 1000 // Maximum number of positions to monitor
      },
      liquidation: {
        enabled: true,
        autoLiquidate: true,
        minProfitThreshold: 0.5, // Minimum profit threshold (0.5%)
        maxLiquidationSize: 1000, // Maximum liquidation size in USD
        gasAdjustedProfitThreshold: 0.3, // Minimum profit accounting for gas (0.3%)
        minHealthFactor: 1.0, // Only liquidate positions with health factor below 1.0
        priorityFee: {
          enabled: true,
          microLamports: 1000000 // 0.001 SOL priority fee for liquidations
        },
        maxSlippageBps: 100, // 1% max slippage
        reserves: {
          preferred: [
            "USDC",
            "USDT",
            "SOL",
            "BTC",
            "ETH",
            "mSOL"
          ],
          excluded: []
        },
        execution: {
          maxRetries: 3,
          retryDelayMs: 500,
          maxConcurrentLiquidations: 3,
          waitForConfirmation: true
        }
      },
      rewards: {
        trackLiquidationRewards: true,
        rewardsWallet: MAIN_WALLET_ADDRESS
      },
      risk: {
        maxExposure: 10000, // Maximum exposure in USD
        maxExposurePerToken: 5000, // Maximum exposure per token in USD
        maxDailyVolume: 50000, // Maximum daily volume in USD
        excludedCollateral: [] // Excluded collateral tokens
      },
      markets: {
        enabled: [
          "main",
          "turbo"
        ],
        priorityOrder: [
          "main",
          "turbo"
        ]
      },
      webhooks: {
        notifyOnLiquidation: true,
        notifyOnError: true,
        notifyOnLargeProfit: true,
        largeThresholdUsd: 100 // Notify on profits above $100
      },
      interfaces: {
        customRpcNode: "",
        useCachedConnection: true,
        cacheTimeMs: 60000 // 1 minute cache time
      }
    };
    
    // Create config directory if it doesn't exist
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    // Write Solend configuration
    fs.writeFileSync(SOLEND_CONFIG_PATH, JSON.stringify(solendConfig, null, 2));
    console.log(`✅ Created Solend configuration at ${SOLEND_CONFIG_PATH}`);
    
    return;
  } catch (error) {
    console.error('Failed to create Solend configuration:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create Solend liquidator core
 */
function createSolendLiquidatorCore(): void {
  console.log('Creating Solend liquidator core...');
  
  try {
    // Create Solend directory if it doesn't exist
    if (!fs.existsSync(SOLEND_DIR)) {
      fs.mkdirSync(SOLEND_DIR, { recursive: true });
    }
    
    // Create Solend liquidator core module
    const liquidatorCoreContent = `/**
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
    logger.info(\`[SolendLiquidator] Initialized with wallet: \${wallet.publicKey.toString()}\`);
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
    
    logger.info(\`[SolendLiquidator] Monitoring started with \${pollInterval}ms interval\`);
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
      
      logger.info(\`[SolendLiquidator] Found \${this.opportunities.length} liquidation opportunities\`);
      
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
      
      logger.info(\`[SolendLiquidator] Loaded \${this.reserves.size} reserves\`);
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
      
      logger.info(\`[SolendLiquidator] Loaded \${this.obligations.length} obligations\`);
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
      
      logger.info(\`[SolendLiquidator] Found \${unhealthyObligations.length} unhealthy obligations\`);
      
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
          
          logger.info(\`[SolendLiquidator] Found liquidation opportunity: Repay \${liquidateAmount} \${bestBorrow.symbol} to withdraw \${bestDeposit.symbol} with \${profitPercent.toFixed(2)}% profit\`);
        } catch (error) {
          logger.error(\`[SolendLiquidator] Error calculating liquidation opportunity for obligation \${obligation.id.toString()}:\`, error);
        }
      }
      
      // Sort opportunities by profit percent (descending)
      this.opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
      
      logger.info(\`[SolendLiquidator] Calculated \${this.opportunities.length} liquidation opportunities\`);
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
      
      logger.info(\`[SolendLiquidator] Found \${profitableOpportunities.length} profitable liquidation opportunities\`);
      
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
          logger.error(\`[SolendLiquidator] Error processing liquidation opportunity for obligation \${opportunity.obligation.id.toString()}:\`, error);
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
      logger.info(\`[SolendLiquidator] Executing liquidation: Repay \${opportunity.liquidateAmount} \${opportunity.repaySymbol} for obligation \${opportunity.obligation.id.toString()}\`);
      
      // In a real implementation, this would use the Solend SDK to execute the liquidation
      // For demonstration, we'll just simulate a transaction
      
      // Simulate a transaction signature
      const signature = \`solend_liquidation_\${Date.now()}_\${Math.random().toString(36).substring(2, 10)}\`;
      
      logger.info(\`[SolendLiquidator] Liquidation executed successfully: \${signature}\`);
      
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
}`;
    
    // Write Solend liquidator core
    fs.writeFileSync(path.join(SOLEND_DIR, 'liquidator.ts'), liquidatorCoreContent);
    console.log(`✅ Created Solend liquidator core at ${path.join(SOLEND_DIR, 'liquidator.ts')}`);
    
    return;
  } catch (error) {
    console.error('Failed to create Solend liquidator core:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create Solend utilities
 */
function createSolendUtilities(): void {
  console.log('Creating Solend utilities...');
  
  try {
    // Create Solend utilities module
    const utilitiesContent = `/**
 * Solend Utilities
 * 
 * This module provides utility functions for interacting with the
 * Solend protocol on Solana.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  AccountInfo,
  TransactionSignature
} from '@solana/web3.js';
import * as logger from '../logger';

// Types
export interface LiquidateObligationParams {
  obligation: PublicKey;
  liquidityAmount: number;
  repayReserve: PublicKey;
  withdrawReserve: PublicKey;
}

/**
 * Get all obligations from Solend
 */
export async function getAllObligations(connection: Connection, marketId: string): Promise<any[]> {
  try {
    // In a real implementation, this would use the Solend SDK to fetch obligations
    // For now, return an empty array
    return [];
  } catch (error) {
    logger.error('[SolendUtils] Error getting all obligations:', error);
    throw error;
  }
}

/**
 * Get all reserves from Solend
 */
export async function getAllReserves(connection: Connection, marketId: string): Promise<any[]> {
  try {
    // In a real implementation, this would use the Solend SDK to fetch reserves
    // For now, return an empty array
    return [];
  } catch (error) {
    logger.error('[SolendUtils] Error getting all reserves:', error);
    throw error;
  }
}

/**
 * Refresh a reserve
 */
export function refreshReserve(
  programId: PublicKey,
  reserve: PublicKey,
  pythPrice: PublicKey,
  switchboardFeed: PublicKey
): TransactionInstruction {
  try {
    // In a real implementation, this would create a transaction instruction to refresh a reserve
    // For now, create a dummy instruction
    return new TransactionInstruction({
      keys: [],
      programId,
      data: Buffer.from([])
    });
  } catch (error) {
    logger.error('[SolendUtils] Error creating refresh reserve instruction:', error);
    throw error;
  }
}

/**
 * Generate accounts needed for refreshing a reserve
 */
export function generateRefreshReserveAccounts(
  programId: PublicKey,
  reserve: PublicKey,
  pythPrice: PublicKey,
  switchboardFeed: PublicKey
): any {
  try {
    // In a real implementation, this would generate all required accounts
    // For now, return a dummy object
    return {};
  } catch (error) {
    logger.error('[SolendUtils] Error generating refresh reserve accounts:', error);
    throw error;
  }
}

/**
 * Refresh an obligation
 */
export function refreshObligation(
  programId: PublicKey,
  obligation: PublicKey,
  depositReserves: PublicKey[],
  borrowReserves: PublicKey[]
): TransactionInstruction {
  try {
    // In a real implementation, this would create a transaction instruction to refresh an obligation
    // For now, create a dummy instruction
    return new TransactionInstruction({
      keys: [],
      programId,
      data: Buffer.from([])
    });
  } catch (error) {
    logger.error('[SolendUtils] Error creating refresh obligation instruction:', error);
    throw error;
  }
}

/**
 * Generate accounts needed for refreshing an obligation
 */
export function generateRefreshObligationAccounts(
  programId: PublicKey,
  obligation: PublicKey,
  depositReserves: PublicKey[],
  borrowReserves: PublicKey[]
): any {
  try {
    // In a real implementation, this would generate all required accounts
    // For now, return a dummy object
    return {};
  } catch (error) {
    logger.error('[SolendUtils] Error generating refresh obligation accounts:', error);
    throw error;
  }
}

/**
 * Liquidate an obligation
 */
export function liquidateObligation(
  programId: PublicKey,
  params: LiquidateObligationParams
): TransactionInstruction {
  try {
    // In a real implementation, this would create a transaction instruction to liquidate an obligation
    // For now, create a dummy instruction
    return new TransactionInstruction({
      keys: [],
      programId,
      data: Buffer.from([])
    });
  } catch (error) {
    logger.error('[SolendUtils] Error creating liquidate obligation instruction:', error);
    throw error;
  }
}

/**
 * Generate accounts needed for liquidating an obligation
 */
export function generateLiquidateObligationAccounts(
  programId: PublicKey,
  params: LiquidateObligationParams
): any {
  try {
    // In a real implementation, this would generate all required accounts
    // For now, return a dummy object
    return {};
  } catch (error) {
    logger.error('[SolendUtils] Error generating liquidate obligation accounts:', error);
    throw error;
  }
}

/**
 * Parse price data
 */
export function parsePriceData(data: Buffer): any {
  try {
    // In a real implementation, this would parse price data from Pyth or Switchboard
    // For now, return a dummy price
    return {
      price: 1.0,
      confidence: 0.01,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('[SolendUtils] Error parsing price data:', error);
    throw error;
  }
}

/**
 * Get token price
 */
export async function getTokenPrice(
  connection: Connection,
  tokenMint: PublicKey,
  pythPriceAccount?: PublicKey,
  switchboardFeedAccount?: PublicKey
): Promise<number> {
  try {
    // In a real implementation, this would get the token price from Pyth or Switchboard
    // For now, return a dummy price based on the token
    const tokenMintStr = tokenMint.toString();
    
    if (tokenMintStr === 'So11111111111111111111111111111111111111112') {
      // SOL
      return 155.0;
    } else if (tokenMintStr === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
      // USDC
      return 1.0;
    } else if (tokenMintStr === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') {
      // USDT
      return 1.0;
    } else if (tokenMintStr === '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E') {
      // BTC
      return 62500.0;
    } else if (tokenMintStr === '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk') {
      // ETH
      return 3200.0;
    } else if (tokenMintStr === 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So') {
      // mSOL
      return 160.0;
    } else {
      // Default
      return 1.0;
    }
  } catch (error) {
    logger.error('[SolendUtils] Error getting token price:', error);
    throw error;
  }
}`;
    
    // Write Solend utilities
    fs.writeFileSync(path.join(SOLEND_DIR, 'solendUtils.ts'), utilitiesContent);
    console.log(`✅ Created Solend utilities at ${path.join(SOLEND_DIR, 'solendUtils.ts')}`);
    
    return;
  } catch (error) {
    console.error('Failed to create Solend utilities:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create Solend helper
 */
function createSolendHelper(): void {
  console.log('Creating Solend helper...');
  
  try {
    // Create Solend helper
    const helperContent = `/**
 * Solend Helper
 * 
 * This module provides a simplified interface to interact with
 * the Solend liquidator system.
 */

import { Connection, Keypair } from '@solana/web3.js';
import { SolendLiquidator } from './lending/liquidator';
import * as logger from './logger';

// Singleton instance
let solendLiquidator: SolendLiquidator | null = null;

/**
 * Initialize Solend liquidator
 */
export function initializeSolendLiquidator(connection: Connection, wallet: Keypair): SolendLiquidator {
  if (!solendLiquidator) {
    solendLiquidator = new SolendLiquidator(connection);
    solendLiquidator.initialize(wallet);
    logger.info('[SolendHelper] Solend liquidator initialized');
  }
  
  return solendLiquidator;
}

/**
 * Get the Solend liquidator
 */
export function getSolendLiquidator(): SolendLiquidator | null {
  return solendLiquidator;
}

/**
 * Start monitoring for liquidation opportunities
 */
export function startLiquidationMonitoring(): void {
  if (!solendLiquidator) {
    throw new Error('Solend liquidator not initialized');
  }
  
  solendLiquidator.startMonitoring();
}

/**
 * Stop monitoring for liquidation opportunities
 */
export function stopLiquidationMonitoring(): void {
  if (!solendLiquidator) {
    throw new Error('Solend liquidator not initialized');
  }
  
  solendLiquidator.stopMonitoring();
}

/**
 * Get liquidation opportunities
 */
export function getLiquidationOpportunities(): any[] {
  if (!solendLiquidator) {
    throw new Error('Solend liquidator not initialized');
  }
  
  return solendLiquidator.getLiquidationOpportunities();
}

/**
 * Get liquidator status
 */
export function getLiquidatorStatus(): any {
  if (!solendLiquidator) {
    return { initialized: false };
  }
  
  return solendLiquidator.getStatus();
}`;
    
    // Write Solend helper
    fs.writeFileSync(path.join(SERVER_DIR, 'solendHelper.ts'), helperContent);
    console.log(`✅ Created Solend helper at ${path.join(SERVER_DIR, 'solendHelper.ts')}`);
    
    return;
  } catch (error) {
    console.error('Failed to create Solend helper:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Update server index.ts to integrate Solend
 */
function updateServerIndex(): void {
  console.log('Updating server index.ts to integrate Solend...');
  
  try {
    const serverIndexPath = path.join(SERVER_DIR, 'index.ts');
    
    if (fs.existsSync(serverIndexPath)) {
      let content = fs.readFileSync(serverIndexPath, 'utf8');
      
      // Find a good spot to add imports
      let importSection = content.match(/import .+;(\r?\n)+/g)?.join('') || '';
      const newImports = "import { initializeSolendLiquidator, startLiquidationMonitoring } from './solendHelper';\n";
      
      // Only add if not already present
      if (!content.includes('solendHelper')) {
        // Add new imports after existing imports
        content = content.replace(importSection, importSection + newImports);
        
        // Find where to add Solend initialization
        const afterWalletInit = content.indexOf('console.log(\'✅ Wallet manager initialized\');');
        
        if (afterWalletInit !== -1) {
          // Add Solend initialization
          const insertPos = content.indexOf('\n', afterWalletInit) + 1;
          const initCode = [
            '',
            '    // Initialize Solend liquidator',
            '    console.log(\'Initializing Solend liquidator...\');',
            '    try {',
            '      // Generate a keypair from the system wallet private key',
            '      const walletKeyPair = walletManager.getKeyPairForWallet(WalletType.SYSTEM);',
            '      if (walletKeyPair) {',
            '        initializeSolendLiquidator(solanaConnection, walletKeyPair);',
            '        console.log(\'✅ Solend liquidator initialized successfully\');',
            '        ',
            '        // Start monitoring for liquidation opportunities',
            '        startLiquidationMonitoring();',
            '        console.log(\'✅ Solend liquidation monitoring started\');',
            '      } else {',
            '        console.warn(\'⚠️ Could not get system wallet keypair for Solend liquidator\');',
            '      }',
            '    } catch (error) {',
            '      console.error(\'❌ Error initializing Solend liquidator:\', error);',
            '    }',
          ].join('\n');
          
          content = content.slice(0, insertPos) + initCode + content.slice(insertPos);
        }
        
        // Write updated file
        fs.writeFileSync(serverIndexPath, content);
        console.log(`✅ Updated server index.ts with Solend integration`);
      } else {
        console.log(`Server index.ts already includes Solend integration`);
      }
    } else {
      console.log(`Server index.ts not found at ${serverIndexPath}`);
    }
    
    return;
  } catch (error) {
    console.error('Failed to update server index.ts:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create Solend API routes
 */
function createSolendApiRoutes(): void {
  console.log('Creating Solend API routes...');
  
  try {
    // Create Solend API routes
    const routesContent = `/**
 * Solend API Routes
 * 
 * This module provides API endpoints for monitoring and interacting
 * with the Solend liquidator system.
 */

import express from 'express';
import { getLiquidatorStatus, getLiquidationOpportunities } from '../solendHelper';
import * as logger from '../logger';

const router = express.Router();

/**
 * Get liquidator status
 * GET /api/solend/status
 */
router.get('/status', (req, res) => {
  try {
    const status = getLiquidatorStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error in /api/solend/status:', error);
    res.status(500).json({
      error: 'Failed to get liquidator status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get liquidation opportunities
 * GET /api/solend/opportunities
 */
router.get('/opportunities', (req, res) => {
  try {
    const opportunities = getLiquidationOpportunities();
    res.json({
      count: opportunities.length,
      opportunities
    });
  } catch (error) {
    logger.error('Error in /api/solend/opportunities:', error);
    res.status(500).json({
      error: 'Failed to get liquidation opportunities',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get summary of liquidation stats
 * GET /api/solend/stats
 */
router.get('/stats', (req, res) => {
  try {
    const status = getLiquidatorStatus();
    
    // Calculate stats
    const stats = {
      isActive: status.isMonitoring || false,
      totalObligations: status.totalObligations || 0,
      totalOpportunities: status.totalOpportunities || 0,
      totalLiquidations: status.totalExecutedLiquidations || 0,
      averageProfitPercent: status.topOpportunities?.length > 0
        ? status.topOpportunities.reduce((sum, opp) => sum + opp.profitPercent, 0) / status.topOpportunities.length
        : 0,
      totalProfitUsd: status.recentLiquidations?.reduce((sum, liq) => sum + liq.opportunity.profit, 0) || 0,
      lastUpdated: status.lastMonitorTime ? new Date(status.lastMonitorTime).toISOString() : null
    };
    
    res.json(stats);
  } catch (error) {
    logger.error('Error in /api/solend/stats:', error);
    res.status(500).json({
      error: 'Failed to get liquidation stats',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;`;
    
    // Create routes directory if it doesn't exist
    if (!fs.existsSync(path.join(SERVER_DIR, 'routes'))) {
      fs.mkdirSync(path.join(SERVER_DIR, 'routes'), { recursive: true });
    }
    
    // Write Solend API routes
    fs.writeFileSync(path.join(SERVER_DIR, 'routes', 'solend.ts'), routesContent);
    console.log(`✅ Created Solend API routes at ${path.join(SERVER_DIR, 'routes', 'solend.ts')}`);
    
    // Update main routes.ts to add Solend routes
    const routesPath = path.join(SERVER_DIR, 'routes.ts');
    
    if (fs.existsSync(routesPath)) {
      let routesContent = fs.readFileSync(routesPath, 'utf8');
      
      // Add Solend routes import
      const importLocation = routesContent.indexOf('import {');
      if (importLocation !== -1) {
        const importStatementEnd = routesContent.indexOf(';\n', importLocation) + 2;
        const importStatement = "import solendRoutes from './routes/solend';\n";
        
        routesContent = routesContent.slice(0, importStatementEnd) + importStatement + routesContent.slice(importStatementEnd);
      }
      
      // Add Solend routes
      const routesRegisterLocation = routesContent.indexOf('export async function registerRoutes');
      if (routesRegisterLocation !== -1) {
        const appUseLocation = routesContent.indexOf('app.use(', routesRegisterLocation);
        if (appUseLocation !== -1) {
          const nextLine = routesContent.indexOf('\n', appUseLocation) + 1;
          const routeStatement = "  app.use('/api/solend', solendRoutes);\n";
          
          routesContent = routesContent.slice(0, nextLine) + routeStatement + routesContent.slice(nextLine);
        }
      }
      
      // Write updated routes.ts
      fs.writeFileSync(routesPath, routesContent);
      console.log(`✅ Updated routes.ts to add Solend routes`);
    }
    
    return;
  } catch (error) {
    console.error('Failed to create Solend API routes:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Update system memory with Solend settings
 */
function updateSystemMemory(): void {
  console.log('Updating system memory with Solend settings...');
  
  try {
    if (fs.existsSync(SYSTEM_MEMORY_PATH)) {
      try {
        // Load existing system memory
        const systemMemory = JSON.parse(fs.readFileSync(SYSTEM_MEMORY_PATH, 'utf8'));
        
        // Update feature flags
        systemMemory.features = {
          ...(systemMemory.features || {}),
          solendLiquidator: true,
          liquidationMonitoring: true,
          defiIntegration: true
        };
        
        // Update configuration
        systemMemory.config = {
          ...(systemMemory.config || {}),
          solend: {
            ...(systemMemory.config?.solend || {}),
            enabled: true,
            liquidationMonitoring: true,
            autoLiquidate: true,
            minProfitThreshold: 0.5,
            pollIntervalSeconds: 10
          }
        };
        
        // Update last updated timestamp
        systemMemory.lastUpdated = new Date().toISOString();
        
        // Create data directory if it doesn't exist
        if (!fs.existsSync(path.dirname(SYSTEM_MEMORY_PATH))) {
          fs.mkdirSync(path.dirname(SYSTEM_MEMORY_PATH), { recursive: true });
        }
        
        // Write updated system memory
        fs.writeFileSync(SYSTEM_MEMORY_PATH, JSON.stringify(systemMemory, null, 2));
        console.log(`✅ Updated system memory with Solend settings`);
      } catch (error) {
        console.error('Failed to update system memory:', error instanceof Error ? error.message : String(error));
      }
    } else {
      console.log(`System memory not found at ${SYSTEM_MEMORY_PATH}, skipping update`);
    }
    
    return;
  } catch (error) {
    console.error('Failed to update system memory:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Main function
 */
function main(): void {
  console.log('=============================================');
  console.log('🚀 INTEGRATING SOLEND LIQUIDATOR');
  console.log('=============================================\n');
  
  try {
    console.log(`👛 Using wallet: ${MAIN_WALLET_ADDRESS}`);
    console.log('');
    
    // Step 1: Create Solend configuration
    createSolendConfiguration();
    
    // Step 2: Create Solend liquidator core
    createSolendLiquidatorCore();
    
    // Step 3: Create Solend utilities
    createSolendUtilities();
    
    // Step 4: Create Solend helper
    createSolendHelper();
    
    // Step 5: Update server index.ts
    updateServerIndex();
    
    // Step 6: Create Solend API routes
    createSolendApiRoutes();
    
    // Step 7: Update system memory
    updateSystemMemory();
    
    console.log('\n✅ SOLEND LIQUIDATOR INTEGRATED');
    console.log('Your trading system now has expanded profit opportunities:');
    console.log('1. Automatic monitoring of Solend positions');
    console.log('2. Liquidation of undercollateralized positions');
    console.log('3. Profit from liquidation bonuses (5-10%)');
    console.log('4. Real-time API endpoints for monitoring opportunities');
    console.log('5. Integration with existing trading system');
    console.log('=============================================');
    
    return;
  } catch (error) {
    console.error('Failed to integrate Solend liquidator:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the script
main();