/**
 * Hyperion Flash Arbitrage Connector
 * 
 * This connector integrates the Zero-Capital Flash Arbitrage Strategy with the
 * Hyperion Flash Arbitrage Overlord agent and the Quantum HitSquad Nexus transaction engine.
 */

import { Connection } from '@solana/web3.js';
import { Mutex } from 'async-mutex';
import logger from '../logger';
import { ZeroCapitalFlashArbitrageStrategy } from '../strategies/ZeroCapitalFlashArbitrageStrategy';

interface ArbitrageStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalProfitUSD: number;
  averageProfitUSD: number;
  highestProfitUSD: number;
  averageExecutionTimeMs: number;
  successRate: number;
}

interface HyperionConfig {
  enabled: boolean;
  maximumConcurrentTrades: number;
  minProfitThresholdUSD: number;
  confidenceThreshold: number;
  maxFlashLoanSizeUSD: number;
  priorityFeeLevel: 'high' | 'medium' | 'low';
  mevProtection: boolean;
  slippageTolerance: number;
  tradingPairs: string[];
  supportedDEXes: string[];
  preferredFlashLoanProvider: string;
}

/**
 * Hyperion Flash Arbitrage Connector
 * Integrates zero-capital flash arbitrage strategies with Hyperion agent
 */
export class HyperionFlashArbitrageConnector {
  private readonly nexusEngine: any;
  private readonly connection: Connection;
  private readonly transactionEngine: any;
  private readonly zeroCapitalStrategy: ZeroCapitalFlashArbitrageStrategy;
  private readonly operationsMutex: Mutex;
  private isActive: boolean = false;
  private stats: ArbitrageStats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalProfitUSD: 0,
    averageProfitUSD: 0,
    highestProfitUSD: 0,
    averageExecutionTimeMs: 0,
    successRate: 0
  };
  
  // Configuration for the Hyperion agent
  private readonly config: HyperionConfig = {
    enabled: true,
    maximumConcurrentTrades: 3,
    minProfitThresholdUSD: 10,
    confidenceThreshold: 0.85,
    maxFlashLoanSizeUSD: 100000,
    priorityFeeLevel: 'high',
    mevProtection: true,
    slippageTolerance: 0.005, // 0.5%
    tradingPairs: [
      'SOL/USDC', 'ETH/USDC', 'BTC/USDC',
      'SOL/USDT', 'ETH/USDT', 'BTC/USDT',
      'JUP/USDC', 'BONK/USDC', 'RAY/USDC'
    ],
    supportedDEXes: [
      'Jupiter', 'Raydium', 'Orca', 'Meteora', 'Phoenix'
    ],
    preferredFlashLoanProvider: 'Solend'
  };
  
  // Heartbeat status for monitoring
  private lastHeartbeat: number = Date.now();
  private activeArbitrageCount: number = 0;
  
  constructor(
    nexusEngine: any,
    connection: Connection,
    transactionEngine: any
  ) {
    this.nexusEngine = nexusEngine;
    this.connection = connection;
    this.transactionEngine = transactionEngine;
    this.operationsMutex = new Mutex();
    
    // Initialize the zero-capital flash arbitrage strategy
    this.zeroCapitalStrategy = new ZeroCapitalFlashArbitrageStrategy(
      nexusEngine,
      connection,
      transactionEngine
    );
  }
  
  /**
   * Start the Hyperion Flash Arbitrage Connector
   */
  public async start(): Promise<boolean> {
    try {
      logger.info('Starting Hyperion Flash Arbitrage Connector with Zero-Capital strategy...');
      
      if (this.isActive) {
        logger.warn('Hyperion Flash Arbitrage Connector is already active');
        return true;
      }
      
      // Set active status
      this.isActive = true;
      
      // Start zero-capital strategy
      const strategyStarted = await this.zeroCapitalStrategy.activate();
      if (!strategyStarted) {
        logger.error('Failed to start Zero-Capital Flash Arbitrage Strategy');
        this.isActive = false;
        return false;
      }
      
      // Start monitoring system
      this.startMonitoringSystem();
      
      logger.info('✅ Hyperion Flash Arbitrage Connector started successfully');
      logger.info(`   Configuration:`);
      logger.info(`   - Min profit threshold: $${this.config.minProfitThresholdUSD}`);
      logger.info(`   - Confidence threshold: ${this.config.confidenceThreshold * 100}%`);
      logger.info(`   - Max flash loan size: $${this.config.maxFlashLoanSizeUSD}`);
      logger.info(`   - Priority fee level: ${this.config.priorityFeeLevel}`);
      logger.info(`   - MEV protection: ${this.config.mevProtection ? 'enabled' : 'disabled'}`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to start Hyperion Flash Arbitrage Connector: ${error.message}`);
      this.isActive = false;
      return false;
    }
  }
  
  /**
   * Stop the Hyperion Flash Arbitrage Connector
   */
  public stop(): void {
    if (!this.isActive) {
      logger.warn('Hyperion Flash Arbitrage Connector is already inactive');
      return;
    }
    
    // Deactivate zero-capital strategy
    this.zeroCapitalStrategy.deactivate();
    
    // Set inactive status
    this.isActive = false;
    
    logger.info('Hyperion Flash Arbitrage Connector stopped');
  }
  
  /**
   * Start the monitoring system
   */
  private startMonitoringSystem(): void {
    // Update heartbeat every 30 seconds
    setInterval(() => {
      this.lastHeartbeat = Date.now();
      this.reportStatus();
    }, 30000);
  }
  
  /**
   * Report current status
   */
  private reportStatus(): void {
    if (!this.isActive) return;
    
    logger.info('Hyperion Flash Arbitrage Status Report:');
    logger.info(`- Status: ${this.isActive ? 'ACTIVE' : 'INACTIVE'}`);
    logger.info(`- Active arbitrage operations: ${this.activeArbitrageCount}`);
    logger.info(`- Total executions: ${this.stats.totalExecutions}`);
    logger.info(`- Success rate: ${(this.stats.successRate * 100).toFixed(2)}%`);
    logger.info(`- Total profit: $${this.stats.totalProfitUSD.toFixed(2)}`);
    logger.info(`- Average profit per trade: $${this.stats.averageProfitUSD.toFixed(2)}`);
    logger.info(`- Highest profit: $${this.stats.highestProfitUSD.toFixed(2)}`);
  }
  
  /**
   * Update arbitrage stats with a new execution result
   */
  public updateStats(successful: boolean, profitUSD: number, executionTimeMs: number): void {
    const release = this.operationsMutex.acquire();
    
    try {
      // Update counts
      this.stats.totalExecutions++;
      if (successful) {
        this.stats.successfulExecutions++;
        this.stats.totalProfitUSD += profitUSD;
        
        // Update highest profit
        this.stats.highestProfitUSD = Math.max(this.stats.highestProfitUSD, profitUSD);
      } else {
        this.stats.failedExecutions++;
      }
      
      // Recalculate averages
      this.stats.successRate = this.stats.successfulExecutions / this.stats.totalExecutions;
      this.stats.averageProfitUSD = this.stats.totalProfitUSD / this.stats.successfulExecutions;
      
      // Update execution time as a rolling average
      const oldWeight = 0.7;
      this.stats.averageExecutionTimeMs = 
        (this.stats.averageExecutionTimeMs * oldWeight) + 
        (executionTimeMs * (1 - oldWeight));
    } finally {
      release;
    }
  }
  
  /**
   * Get current statistics
   */
  public getStats(): ArbitrageStats {
    return { ...this.stats };
  }
  
  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<HyperionConfig>): void {
    Object.assign(this.config, newConfig);
    logger.info('Hyperion Flash Arbitrage Connector configuration updated');
  }
  
  /**
   * Check if the system is healthy
   */
  public isHealthy(): boolean {
    // Check heartbeat within last minute
    const heartbeatOk = (Date.now() - this.lastHeartbeat) < 60000;
    
    // Check activity status
    const activityOk = this.isActive;
    
    // Check active operations not deadlocked
    const operationsOk = this.activeArbitrageCount <= this.config.maximumConcurrentTrades;
    
    return heartbeatOk && activityOk && operationsOk;
  }
}