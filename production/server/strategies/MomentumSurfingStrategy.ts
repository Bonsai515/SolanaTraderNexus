/**
 * Momentum Surfing Strategy
 * 
 * Advanced implementation of the Quantum Momentum Surfing strategy,
 * specializing in riding memecoin price waves with AI signal-based timing.
 */

import { EventEmitter } from 'events';
import { logger } from '../logger';
import { Mutex } from 'async-mutex';
import { memeCortexEnhanced, SignalDirection, SignalType } from '../transformers/MemeCortexEnhanced';

// Momentum signal source
enum SignalSource {
  MEME_CORTEX = 'MEME_CORTEX',
  PERPLEXITY_AI = 'PERPLEXITY_AI',
  SENTIMENT_ANALYSIS = 'SENTIMENT_ANALYSIS',
  SOCIAL_VOLUME = 'SOCIAL_VOLUME',
  PRICE_ACTION = 'PRICE_ACTION',
  COMBINED = 'COMBINED'
}

// Momentum strength
enum MomentumStrength {
  VERY_WEAK = 'VERY_WEAK',
  WEAK = 'WEAK',
  MODERATE = 'MODERATE',
  STRONG = 'STRONG',
  VERY_STRONG = 'VERY_STRONG'
}

// Market phase
enum MarketPhase {
  ACCUMULATION = 'ACCUMULATION',
  MARKUP = 'MARKUP',
  DISTRIBUTION = 'DISTRIBUTION',
  MARKDOWN = 'MARKDOWN',
  CONSOLIDATION = 'CONSOLIDATION'
}

// Momentum signal
interface MomentumSignal {
  id: string;
  token: string;
  timestamp: number;
  direction: SignalDirection;
  strength: MomentumStrength;
  source: SignalSource;
  confidence: number;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  volumeChange24h: number;
  priceChange1h: number;
  priceChange24h: number;
  socialVolume24h: number;
  phase: MarketPhase;
  metadata?: Record<string, any>;
}

// Trade setup
interface TradeSetup {
  id: string;
  token: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  size: number;
  riskRewardRatio: number;
  confidence: number;
  timestamp: number;
  expirationTimestamp: number;
  signals: MomentumSignal[];
}

// Trade execution
interface TradeExecution {
  id: string;
  setupId: string;
  token: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  entryTimestamp: number;
  size: number;
  status: 'OPEN' | 'CLOSED' | 'STOPPED_OUT' | 'TARGET_REACHED' | 'EXPIRED';
  exitPrice?: number;
  exitTimestamp?: number;
  profit?: number;
  profitPercentage?: number;
  signature?: string;
}

// Strategy configuration
interface MomentumStrategyConfig {
  enabled: boolean;
  maxPositions: number;
  maxPositionSizeUsd: number;
  minConfidence: number;
  preferredTimeframes: string[];
  minRiskRewardRatio: number;
  maxDrawdownPercentage: number;
  takeProfitLevels: number[];
  stopLossPaddingPercentage: number;
  useTrailingStops: boolean;
  trailingStopActivationPercentage: number;
  trailingStopDistancePercentage: number;
  signalWeights: Record<SignalSource, number>;
  autoAdjustPositionSize: boolean;
  blacklistedTokens: string[];
  whitelistedTokens: string[];
  preferMemeCoins: boolean;
}

/**
 * Momentum Surfing Strategy class
 */
export class MomentumSurfingStrategy extends EventEmitter {
  private config: MomentumStrategyConfig;
  private memeCortex: typeof memeCortexEnhanced;
  private active: boolean = false;
  private executionMutex: Mutex;
  private signals: Map<string, MomentumSignal[]> = new Map();
  private tradeSetups: TradeSetup[] = [];
  private activeTradeExecutions: TradeExecution[] = [];
  private historicalTradeExecutions: TradeExecution[] = [];
  private lastSignalProcessingTime: number = 0;
  private totalProfitUsd: number = 0;
  private successfulTrades: number = 0;
  private totalTrades: number = 0;
  
  /**
   * Constructor
   * @param memeCortex The MEME Cortex integration
   */
  constructor(memeCortex: typeof memeCortexEnhanced) {
    super();
    this.memeCortex = memeCortex;
    this.executionMutex = new Mutex();
    
    // Default configuration
    this.config = {
      enabled: true,
      maxPositions: 5,
      maxPositionSizeUsd: 1000, // $1,000 maximum position size
      minConfidence: 0.7, // 70% minimum confidence
      preferredTimeframes: ['5m', '15m', '1h'],
      minRiskRewardRatio: 2.0, // Minimum 2:1 reward-to-risk ratio
      maxDrawdownPercentage: 15, // 15% maximum drawdown
      takeProfitLevels: [0.25, 0.5, 0.25], // Take profit at 25%, 50%, and 100% of position
      stopLossPaddingPercentage: 2.5, // Add 2.5% padding to stop loss for volatility
      useTrailingStops: true,
      trailingStopActivationPercentage: 10, // Activate trailing stop after 10% profit
      trailingStopDistancePercentage: 5, // Trail by 5% of current price
      signalWeights: {
        [SignalSource.MEME_CORTEX]: 0.35,
        [SignalSource.PERPLEXITY_AI]: 0.25,
        [SignalSource.SENTIMENT_ANALYSIS]: 0.15,
        [SignalSource.SOCIAL_VOLUME]: 0.15,
        [SignalSource.PRICE_ACTION]: 0.1,
        [SignalSource.COMBINED]: 0.5
      },
      autoAdjustPositionSize: true,
      blacklistedTokens: [],
      whitelistedTokens: ['SOL', 'BONK', 'WIF', 'MEME', 'POPCAT', 'GUAC', 'JUP'],
      preferMemeCoins: true
    };
    
    logger.info('[MomentumStrategy] Initialized with default configuration');
    
    // Listen for MEME Cortex signals
    this.setupSignalListeners();
  }
  
  /**
   * Setup signal listeners
   */
  private setupSignalListeners(): void {
    if (this.memeCortex) {
      this.memeCortex.on('signal', (signal) => {
        this.processExternalSignal(signal);
      });
      
      logger.info('[MomentumStrategy] Connected to MEME Cortex signal source');
    } else {
      logger.warn('[MomentumStrategy] MEME Cortex not available, signals will be limited');
    }
  }
  
  /**
   * Process external trading signal from MEME Cortex
   * @param signal Trading signal from MEME Cortex
   */
  private processExternalSignal(signal: any): void {
    try {
      if (!this.active || !this.config.enabled) {
        return;
      }
      
      // Convert to our internal momentum signal format
      const momentumSignal: MomentumSignal = {
        id: signal.id,
        token: signal.targetToken,
        timestamp: signal.timestamp,
        direction: signal.direction,
        strength: this.convertSignalToStrength(signal.direction, signal.confidence),
        source: SignalSource.MEME_CORTEX,
        confidence: signal.confidence / 100, // Convert from percentage to decimal
        timeframe: this.determineTimeframeFromSignal(signal),
        volumeChange24h: signal.metadata?.volumeChange24h || 0,
        priceChange1h: signal.metadata?.priceChange1h || 0,
        priceChange24h: signal.metadata?.priceChange24h || 0,
        socialVolume24h: signal.metadata?.socialVolume24h || 0,
        phase: this.determineMarketPhase(signal),
        metadata: signal.metadata
      };
      
      // Store the signal
      this.addSignalToStorage(momentumSignal);
      
      // Try to generate a trade setup
      this.generateTradeSetups(momentumSignal.token);
      
      // Update last signal processing time
      this.lastSignalProcessingTime = Date.now();
      
      logger.debug(`[MomentumStrategy] Processed signal for ${momentumSignal.token} with direction ${momentumSignal.direction} and strength ${momentumSignal.strength}`);
    } catch (error) {
      logger.error(`[MomentumStrategy] Error processing external signal: ${error.message}`);
    }
  }
  
  /**
   * Convert signal direction and confidence to momentum strength
   * @param direction Signal direction
   * @param confidence Signal confidence (0-100)
   */
  private convertSignalToStrength(direction: SignalDirection, confidence: number): MomentumStrength {
    // Adjust strength based on confidence
    const confidenceLevel = confidence / 100; // Convert to decimal
    
    if (direction === SignalDirection.BULLISH || direction === SignalDirection.BEARISH) {
      if (confidenceLevel > 0.9) {
        return MomentumStrength.VERY_STRONG;
      } else if (confidenceLevel > 0.7) {
        return MomentumStrength.STRONG;
      } else {
        return MomentumStrength.MODERATE;
      }
    } else if (direction === SignalDirection.SLIGHTLY_BULLISH || direction === SignalDirection.SLIGHTLY_BEARISH) {
      if (confidenceLevel > 0.9) {
        return MomentumStrength.MODERATE;
      } else if (confidenceLevel > 0.7) {
        return MomentumStrength.WEAK;
      } else {
        return MomentumStrength.VERY_WEAK;
      }
    } else {
      return MomentumStrength.VERY_WEAK;
    }
  }
  
  /**
   * Determine timeframe from signal
   * @param signal Trading signal
   */
  private determineTimeframeFromSignal(signal: any): '1m' | '5m' | '15m' | '1h' | '4h' | '1d' {
    // Default to 1h if not specified
    const defaultTimeframe = '1h';
    
    if (!signal.metadata || !signal.metadata.timeframe) {
      return defaultTimeframe;
    }
    
    const timeframe = signal.metadata.timeframe;
    
    if (typeof timeframe === 'string') {
      if (['1m', '5m', '15m', '1h', '4h', '1d'].includes(timeframe)) {
        return timeframe as any;
      }
    }
    
    return defaultTimeframe;
  }
  
  /**
   * Determine market phase from signal
   * @param signal Trading signal
   */
  private determineMarketPhase(signal: any): MarketPhase {
    if (!signal.metadata) {
      return MarketPhase.CONSOLIDATION;
    }
    
    // Use market phase if explicitly provided in metadata
    if (signal.metadata.marketPhase) {
      return signal.metadata.marketPhase;
    }
    
    // Try to infer from available data
    const priceChange24h = signal.metadata.priceChange24h || 0;
    const volumeChange24h = signal.metadata.volumeChange24h || 0;
    
    if (priceChange24h > 10 && volumeChange24h > 20) {
      return MarketPhase.MARKUP;
    } else if (priceChange24h < -10 && volumeChange24h > 20) {
      return MarketPhase.MARKDOWN;
    } else if (Math.abs(priceChange24h) < 5 && volumeChange24h > 30) {
      return MarketPhase.ACCUMULATION;
    } else if (Math.abs(priceChange24h) < 5 && volumeChange24h < 0) {
      return MarketPhase.CONSOLIDATION;
    } else if (priceChange24h > 5 && volumeChange24h < 0) {
      return MarketPhase.DISTRIBUTION;
    }
    
    return MarketPhase.CONSOLIDATION;
  }
  
  /**
   * Add signal to storage
   * @param signal Momentum signal
   */
  private addSignalToStorage(signal: MomentumSignal): void {
    if (!this.signals.has(signal.token)) {
      this.signals.set(signal.token, []);
    }
    
    const signals = this.signals.get(signal.token)!;
    signals.push(signal);
    
    // Sort by timestamp (newest first)
    signals.sort((a, b) => b.timestamp - a.timestamp);
    
    // Prune old signals (keep only last 24 hours)
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    const prunedSignals = signals.filter(s => s.timestamp >= cutoffTime);
    
    this.signals.set(signal.token, prunedSignals);
  }
  
  /**
   * Generate trade setups for a token
   * @param token Token symbol
   */
  private generateTradeSetups(token: string): void {
    if (!this.signals.has(token)) {
      return;
    }
    
    // Get recent signals for this token
    const signals = this.signals.get(token)!;
    
    // Need at least 3 signals to generate a setup
    if (signals.length < 3) {
      logger.debug(`[MomentumStrategy] Not enough signals for ${token} (${signals.length})`);
      return;
    }
    
    // If this token is blacklisted, skip
    if (this.config.blacklistedTokens.includes(token)) {
      logger.debug(`[MomentumStrategy] Token ${token} is blacklisted, skipping`);
      return;
    }
    
    // If we have a whitelist and this token is not on it, skip
    if (this.config.whitelistedTokens.length > 0 && !this.config.whitelistedTokens.includes(token)) {
      logger.debug(`[MomentumStrategy] Token ${token} is not whitelisted, skipping`);
      return;
    }
    
    // Calculate average signal direction and confidence
    let bullishCount = 0;
    let bearishCount = 0;
    let totalConfidence = 0;
    
    // We'll only use signals from the last 2 hours
    const recentSignals = signals.filter(s => s.timestamp >= Date.now() - 2 * 60 * 60 * 1000);
    
    for (const signal of recentSignals) {
      if (signal.direction === SignalDirection.BULLISH || signal.direction === SignalDirection.SLIGHTLY_BULLISH) {
        bullishCount++;
      } else if (signal.direction === SignalDirection.BEARISH || signal.direction === SignalDirection.SLIGHTLY_BEARISH) {
        bearishCount++;
      }
      
      totalConfidence += signal.confidence;
    }
    
    const averageConfidence = totalConfidence / recentSignals.length;
    
    // If confidence is below threshold, skip
    if (averageConfidence < this.config.minConfidence) {
      logger.debug(`[MomentumStrategy] Confidence too low for ${token}: ${averageConfidence.toFixed(2)} < ${this.config.minConfidence}`);
      return;
    }
    
    // Determine trade direction
    let tradeDirection: 'BUY' | 'SELL' | null = null;
    
    if (bullishCount > bearishCount * 2) {
      tradeDirection = 'BUY';
    } else if (bearishCount > bullishCount * 2) {
      tradeDirection = 'SELL';
    }
    
    // If no clear direction, skip
    if (!tradeDirection) {
      logger.debug(`[MomentumStrategy] No clear direction for ${token}: ${bullishCount} bullish vs ${bearishCount} bearish`);
      return;
    }
    
    // Check if we already have an active setup for this token and direction
    const existingSetup = this.tradeSetups.find(s => 
      s.token === token && 
      s.direction === tradeDirection &&
      s.expirationTimestamp > Date.now()
    );
    
    if (existingSetup) {
      logger.debug(`[MomentumStrategy] Already have a ${tradeDirection} setup for ${token}`);
      return;
    }
    
    // Check if we already have an active trade for this token and direction
    const existingTrade = this.activeTradeExecutions.find(t => 
      t.token === token && 
      t.direction === tradeDirection &&
      t.status === 'OPEN'
    );
    
    if (existingTrade) {
      logger.debug(`[MomentumStrategy] Already have an active ${tradeDirection} trade for ${token}`);
      return;
    }
    
    // Simulate price data (in a real implementation, we would get this from the market)
    const currentPrice = 1.0; // Placeholder value
    
    // Calculate entry, target, and stop loss prices
    let entryPrice = currentPrice;
    let targetPrice, stopLossPrice;
    
    if (tradeDirection === 'BUY') {
      targetPrice = entryPrice * (1 + 0.15); // Target 15% profit
      stopLossPrice = entryPrice * (1 - 0.05); // Stop loss at 5% loss
    } else {
      targetPrice = entryPrice * (1 - 0.15); // Target 15% profit
      stopLossPrice = entryPrice * (1 + 0.05); // Stop loss at 5% loss
    }
    
    // Calculate position size
    const riskAmount = this.calculatePositionSize(token, averageConfidence);
    
    // Calculate risk-reward ratio
    const riskPercentage = Math.abs((stopLossPrice - entryPrice) / entryPrice);
    const rewardPercentage = Math.abs((targetPrice - entryPrice) / entryPrice);
    const riskRewardRatio = rewardPercentage / riskPercentage;
    
    // If risk-reward ratio is below threshold, skip
    if (riskRewardRatio < this.config.minRiskRewardRatio) {
      logger.debug(`[MomentumStrategy] Risk-reward ratio too low for ${token}: ${riskRewardRatio.toFixed(2)} < ${this.config.minRiskRewardRatio}`);
      return;
    }
    
    // Create trade setup
    const setup: TradeSetup = {
      id: `setup_${Date.now()}_${token}_${tradeDirection}`,
      token,
      direction: tradeDirection,
      entryPrice,
      targetPrice,
      stopLossPrice,
      size: riskAmount,
      riskRewardRatio,
      confidence: averageConfidence,
      timestamp: Date.now(),
      expirationTimestamp: Date.now() + 1 * 60 * 60 * 1000, // Expire in 1 hour
      signals: recentSignals
    };
    
    // Add to setups
    this.tradeSetups.push(setup);
    
    logger.info(`[MomentumStrategy] Generated ${tradeDirection} setup for ${token} with confidence ${averageConfidence.toFixed(2)} and risk-reward ratio ${riskRewardRatio.toFixed(2)}`);
    
    // Emit event
    this.emit('setupGenerated', setup);
    
    // Automatically execute the trade if criteria are met
    this.executeTrade(setup);
  }
  
  /**
   * Calculate position size for a trade
   * @param token Token symbol
   * @param confidence Signal confidence
   */
  private calculatePositionSize(token: string, confidence: number): number {
    // Base position size
    let positionSize = this.config.maxPositionSizeUsd;
    
    // If auto-adjust is enabled, scale by confidence
    if (this.config.autoAdjustPositionSize) {
      positionSize = positionSize * Math.min(1, confidence * 1.2);
    }
    
    // Make sure position size is not zero
    return Math.max(10, positionSize);
  }
  
  /**
   * Execute a trade from a setup
   * @param setup Trade setup
   */
  private async executeTrade(setup: TradeSetup): Promise<void> {
    if (!this.active || !this.config.enabled) {
      logger.debug(`[MomentumStrategy] Strategy not active, skipping trade execution`);
      return;
    }
    
    // Check if we've reached the maximum number of positions
    if (this.activeTradeExecutions.length >= this.config.maxPositions) {
      logger.debug(`[MomentumStrategy] Maximum positions reached (${this.config.maxPositions}), skipping trade execution`);
      return;
    }
    
    // Acquire execution lock
    const release = await this.executionMutex.acquire();
    
    try {
      logger.info(`[MomentumStrategy] Executing ${setup.direction} trade for ${setup.token} with size $${setup.size.toFixed(2)}`);
      
      // In a real implementation, this would use the transaction engine to execute the trade
      
      // For now, we'll simulate it
      const execution: TradeExecution = {
        id: `trade_${Date.now()}_${setup.token}_${setup.direction}`,
        setupId: setup.id,
        token: setup.token,
        direction: setup.direction,
        entryPrice: setup.entryPrice,
        entryTimestamp: Date.now(),
        size: setup.size,
        status: 'OPEN',
        signature: `sim-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
      };
      
      // Add to active executions
      this.activeTradeExecutions.push(execution);
      
      // Update metrics
      this.totalTrades++;
      
      logger.info(`[MomentumStrategy] Executed ${setup.direction} trade for ${setup.token} with size $${setup.size.toFixed(2)}`);
      
      // Emit event
      this.emit('tradeExecuted', execution);
      
      // Schedule trade management (stop loss, take profit, etc.)
      this.scheduleTradeManagement(execution);
    } finally {
      // Release execution lock
      release();
    }
  }
  
  /**
   * Schedule trade management (simulated)
   * @param execution Trade execution
   */
  private scheduleTradeManagement(execution: TradeExecution): void {
    // In a real implementation, this would set up monitoring for stop loss, take profit, etc.
    
    // For now, we'll just log it
    logger.info(`[MomentumStrategy] Scheduled management for ${execution.direction} trade of ${execution.token}`);
  }
  
  /**
   * Update strategy configuration
   * @param config New configuration
   */
  public updateConfig(config: Partial<MomentumStrategyConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('[MomentumStrategy] Configuration updated');
  }
  
  /**
   * Activate the strategy
   */
  public activate(): boolean {
    if (this.active) {
      logger.warn('[MomentumStrategy] Strategy already active');
      return true;
    }
    
    if (!this.memeCortex) {
      logger.warn('[MomentumStrategy] MEME Cortex not available, activation may have limited functionality');
    }
    
    this.active = true;
    logger.info('[MomentumStrategy] Strategy activated');
    return true;
  }
  
  /**
   * Deactivate the strategy
   */
  public deactivate(): boolean {
    if (!this.active) {
      logger.warn('[MomentumStrategy] Strategy already inactive');
      return true;
    }
    
    this.active = false;
    logger.info('[MomentumStrategy] Strategy deactivated');
    return true;
  }
  
  /**
   * Check if the strategy is active
   */
  public isActive(): boolean {
    return this.active;
  }
  
  /**
   * Get strategy metrics
   */
  public getMetrics(): {
    totalTrades: number;
    successfulTrades: number;
    winRate: number;
    totalProfitUsd: number;
    activePositions: number;
    active: boolean;
  } {
    const winRate = this.totalTrades > 0 ? this.successfulTrades / this.totalTrades : 0;
    
    return {
      totalTrades: this.totalTrades,
      successfulTrades: this.successfulTrades,
      winRate,
      totalProfitUsd: this.totalProfitUsd,
      activePositions: this.activeTradeExecutions.length,
      active: this.active
    };
  }
  
  /**
   * Get active trade executions
   */
  public getActiveTradeExecutions(): TradeExecution[] {
    return [...this.activeTradeExecutions];
  }
  
  /**
   * Get historical trade executions
   */
  public getHistoricalTradeExecutions(): TradeExecution[] {
    return [...this.historicalTradeExecutions];
  }
  
  /**
   * Get current trade setups
   */
  public getCurrentTradeSetups(): TradeSetup[] {
    return this.tradeSetups.filter(s => s.expirationTimestamp > Date.now());
  }
}