/**
 * Optimized Strategy Executor
 * 
 * High-performance strategy executor with parallel execution,
 * background signal processing, and memory optimization.
 */

import { logger } from '../../logger';
import { getTransactionProcessor, TransactionPriority } from './optimizedTransactionProcessor';
import * as fs from 'fs';
import * as path from 'path';

// Load strategy configuration
let strategyConfig: any = {
  parallelExecution: true,
  asyncSignalProcessing: true,
  backgroundProcessing: true,
  maxStrategiesPerBlock: 5,
  signalBufferSize: 100,
  preemptivePositionSizing: true,
  smartOrderRouting: true,
  memoryBufferSizeMB: 512
};

try {
  const configPath = path.join(__dirname, '..', '..', '..', 'data', 'strategy-config.json');
  if (fs.existsSync(configPath)) {
    strategyConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    logger.info('Loaded strategy configuration from file');
  }
} catch (error) {
  logger.warn(`Failed to load strategy configuration: ${error.message}`);
}

// Signal types
export enum SignalType {
  MARKET_SENTIMENT = 'MARKET_SENTIMENT',
  FLASH_ARBITRAGE_OPPORTUNITY = 'FLASH_ARBITRAGE_OPPORTUNITY',
  CROSS_CHAIN_OPPORTUNITY = 'CROSS_CHAIN_OPPORTUNITY',
  TOKEN_LISTING = 'TOKEN_LISTING',
  VOLATILITY_ALERT = 'VOLATILITY_ALERT',
  PRICE_ANOMALY = 'PRICE_ANOMALY',
  PRE_LIQUIDITY_DETECTION = 'PRE_LIQUIDITY_DETECTION',
  NUCLEAR_OPPORTUNITY = 'NUCLEAR_OPPORTUNITY'
}

// Signal direction
export enum SignalDirection {
  BULLISH = 'BULLISH',
  SLIGHTLY_BULLISH = 'SLIGHTLY_BULLISH',
  NEUTRAL = 'NEUTRAL',
  SLIGHTLY_BEARISH = 'SLIGHTLY_BEARISH',
  BEARISH = 'BEARISH'
}

// Trading signal
export interface TradingSignal {
  id: string;
  timestamp: string;
  type: SignalType;
  sourceToken: string;
  targetToken: string;
  direction: SignalDirection;
  confidence: number;
  amount?: number;
  transformer: string;
  strategy: string;
  metadata?: Record<string, any>;
}

// Strategy definition
export interface Strategy {
  id: string;
  name: string;
  description?: string;
  dailyROI: number;
  allocation: number;
  risk: string;
  active: boolean;
  transformer?: string;
  signalTypes: SignalType[];
  confidenceThreshold: number;
  handler: (signal: TradingSignal) => Promise<boolean>;
}

// Signal processor stats
interface SignalProcessorStats {
  totalSignalsReceived: number;
  signalsProcessed: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageProcessingTimeMs: number;
  activeSignalCount: number;
}

// Strategy executor class
export class OptimizedStrategyExecutor {
  private strategies: Map<string, Strategy> = new Map();
  private signalQueue: TradingSignal[] = [];
  private processingSignals: Set<string> = new Set();
  private isProcessing = false;
  private stats: SignalProcessorStats = {
    totalSignalsReceived: 0,
    signalsProcessed: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageProcessingTimeMs: 0,
    activeSignalCount: 0
  };
  private txProcessor = getTransactionProcessor();
  private isInitialized = false;
  
  constructor(private config = strategyConfig) {}
  
  /**
   * Initialize the strategy executor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Initialize transaction processor
    await this.txProcessor.initialize();
    
    // Start signal processing
    this.startSignalProcessing();
    
    this.isInitialized = true;
    logger.info('Optimized Strategy Executor initialized');
  }
  
  /**
   * Register a strategy
   */
  registerStrategy(strategy: Strategy): void {
    this.strategies.set(strategy.id, strategy);
    logger.info(`Registered strategy: ${strategy.name} (ID: ${strategy.id})`);
  }
  
  /**
   * Process a trading signal
   */
  async processSignal(signal: TradingSignal): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Update stats
    this.stats.totalSignalsReceived++;
    
    // Add signal to queue
    this.signalQueue.push(signal);
    
    // If queue is getting too large, start processing immediately
    if (this.signalQueue.length >= this.config.signalBufferSize && !this.isProcessing) {
      this.processSignalQueue();
    }
    
    return true;
  }
  
  /**
   * Start signal processing
   */
  private startSignalProcessing(): void {
    // Process signals periodically
    setInterval(() => {
      if (this.signalQueue.length > 0 && !this.isProcessing) {
        this.processSignalQueue();
      }
    }, 100); // Check every 100ms
  }
  
  /**
   * Process the signal queue
   */
  private async processSignalQueue(): Promise<void> {
    if (this.isProcessing || this.signalQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Take a batch of signals from the queue
      const batchSize = Math.min(this.config.maxStrategiesPerBlock, this.signalQueue.length);
      const batch = this.signalQueue.splice(0, batchSize);
      
      // Update stats
      this.stats.activeSignalCount = batch.length;
      
      // Process each signal
      const promises = batch.map(signal => this.executeSignal(signal));
      
      if (this.config.parallelExecution) {
        // Process in parallel
        await Promise.all(promises);
      } else {
        // Process sequentially
        for (const promise of promises) {
          await promise;
        }
      }
    } catch (error) {
      logger.error(`Error processing signal queue: ${error.message}`);
    } finally {
      this.isProcessing = false;
      
      // If there are more signals, continue processing
      if (this.signalQueue.length > 0) {
        setImmediate(() => this.processSignalQueue());
      }
    }
  }
  
  /**
   * Execute a trading signal
   */
  private async executeSignal(signal: TradingSignal): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Mark signal as processing
      this.processingSignals.add(signal.id);
      
      // Find matching strategy
      const strategy = this.strategies.get(signal.strategy);
      
      if (!strategy) {
        logger.warn(`No strategy found for signal ${signal.id} (strategy: ${signal.strategy})`);
        return;
      }
      
      // Skip if strategy is not active
      if (!strategy.active) {
        logger.debug(`Skipping signal ${signal.id} for inactive strategy ${strategy.name}`);
        return;
      }
      
      // Skip if signal type is not supported by strategy
      if (!strategy.signalTypes.includes(signal.type)) {
        logger.debug(`Signal type ${signal.type} not supported by strategy ${strategy.name}`);
        return;
      }
      
      // Skip if confidence is below threshold
      if (signal.confidence < strategy.confidenceThreshold) {
        logger.debug(`Signal confidence ${signal.confidence} below threshold ${strategy.confidenceThreshold}`);
        return;
      }
      
      logger.info(`Executing signal ${signal.id} for strategy ${strategy.name}`);
      
      // Execute strategy handler
      const success = await strategy.handler(signal);
      
      // Update stats
      this.stats.signalsProcessed++;
      
      if (success) {
        this.stats.successfulExecutions++;
      } else {
        this.stats.failedExecutions++;
      }
      
      // Update processing time stats
      const processingTime = Date.now() - startTime;
      this.updateProcessingTimeStats(processingTime);
      
      logger.info(`Signal ${signal.id} executed in ${processingTime}ms with result: ${success ? 'success' : 'failure'}`);
    } catch (error) {
      logger.error(`Error executing signal ${signal.id}: ${error.message}`);
      this.stats.failedExecutions++;
    } finally {
      // Remove signal from processing set
      this.processingSignals.delete(signal.id);
    }
  }
  
  /**
   * Update processing time stats
   */
  private updateProcessingTimeStats(processingTime: number): void {
    const totalProcessed = this.stats.signalsProcessed;
    
    if (totalProcessed === 1) {
      this.stats.averageProcessingTimeMs = processingTime;
    } else {
      this.stats.averageProcessingTimeMs = (
        (this.stats.averageProcessingTimeMs * (totalProcessed - 1)) +
        processingTime
      ) / totalProcessed;
    }
  }
  
  /**
   * Get strategy executor stats
   */
  getStats(): SignalProcessorStats {
    return { ...this.stats };
  }
  
  /**
   * Get active signal count
   */
  getActiveSignalCount(): number {
    return this.processingSignals.size;
  }
  
  /**
   * Get queued signal count
   */
  getQueuedSignalCount(): number {
    return this.signalQueue.length;
  }
  
  /**
   * Get registered strategy count
   */
  getRegisteredStrategyCount(): number {
    return this.strategies.size;
  }
  
  /**
   * Get active strategy count
   */
  getActiveStrategyCount(): number {
    return Array.from(this.strategies.values()).filter(s => s.active).length;
  }
}

// Export singleton instance
let strategyExecutor: OptimizedStrategyExecutor | null = null;

export function getStrategyExecutor(): OptimizedStrategyExecutor {
  if (!strategyExecutor) {
    strategyExecutor = new OptimizedStrategyExecutor();
  }
  return strategyExecutor;
}