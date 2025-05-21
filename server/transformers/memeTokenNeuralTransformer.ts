/**
 * Meme Token Neural Transformer
 * 
 * This module processes memecoin data and generates neural signals
 * to be sent to the Quantum Omega system for execution decisions.
 */

import * as logger from '../logger';
import { TokenRelationship } from '../lib/memecoinGlobalCache';
import { sendSignal, SignalPriority, SignalType, SignalDirection, SignalStrength } from '../neural-communication-hub';
import { memecoinCache } from '../lib/memecoinGlobalCache';
import { getAllTokens, getSniperOpportunities } from '../lib/memeTokenConnector';

// Neural signal types
export enum MemeTokenSignalType {
  NEW_TOKEN_LAUNCH = 'NEW_TOKEN_LAUNCH',
  PRICE_SURGE = 'PRICE_SURGE',
  VOLUME_SPIKE = 'VOLUME_SPIKE',
  LIQUIDITY_INCREASE = 'LIQUIDITY_INCREASE',
  MOMENTUM_SHIFT = 'MOMENTUM_SHIFT',
  SNIPER_OPPORTUNITY = 'SNIPER_OPPORTUNITY',
  TREND_REVERSAL = 'TREND_REVERSAL'
}

// Neural confidence thresholds
const CONFIDENCE_THRESHOLDS = {
  LOW: 65,
  MEDIUM: 75,
  HIGH: 85,
  VERY_HIGH: 95
};

// Token metrics thresholds
const METRICS_THRESHOLDS = {
  NEW_TOKEN_MAX_AGE_HOURS: 12,
  PRICE_SURGE_PERCENT: 15,
  VOLUME_SPIKE_MULTIPLIER: 3,
  LIQUIDITY_MIN_SOL: 10,
  SNIPER_MIN_SCORE: 75
};

// Store the last processed timestamps to prevent duplicate signals
const lastProcessedTimestamps: Record<string, number> = {};

/**
 * Analyze a token and generate neural signals
 */
function analyzeTokenForSignals(token: TokenRelationship): any[] {
  const signals = [];
  const now = Date.now();
  
  // Skip if we've already processed this token recently (within 10 minutes)
  const tokenKey = `${token.symbol}-${token.address}`;
  if (lastProcessedTimestamps[tokenKey] && (now - lastProcessedTimestamps[tokenKey]) < 10 * 60 * 1000) {
    return [];
  }
  
  // Update the last processed timestamp
  lastProcessedTimestamps[tokenKey] = now;
  
  // Check for NEW_TOKEN_LAUNCH signal
  if (token.isNew || (token.launchTimestamp && (now - token.launchTimestamp) < METRICS_THRESHOLDS.NEW_TOKEN_MAX_AGE_HOURS * 60 * 60 * 1000)) {
    const ageHours = token.launchTimestamp ? (now - token.launchTimestamp) / (60 * 60 * 1000) : 0;
    const confidence = Math.max(65, Math.min(99, 100 - (ageHours / METRICS_THRESHOLDS.NEW_TOKEN_MAX_AGE_HOURS) * 35));
    
    signals.push({
      type: MemeTokenSignalType.NEW_TOKEN_LAUNCH,
      token: token.symbol,
      address: token.address,
      confidence,
      details: {
        launchTime: token.launchTimestamp ? new Date(token.launchTimestamp).toISOString() : 'Unknown',
        ageHours: ageHours.toFixed(2),
        price: token.price,
        liquidity: token.liquidity
      }
    });
  }
  
  // Check for PRICE_SURGE signal
  if (token.priceChange24h > METRICS_THRESHOLDS.PRICE_SURGE_PERCENT) {
    const confidence = Math.max(65, Math.min(99, 65 + (token.priceChange24h - METRICS_THRESHOLDS.PRICE_SURGE_PERCENT) * 1.5));
    
    signals.push({
      type: MemeTokenSignalType.PRICE_SURGE,
      token: token.symbol,
      address: token.address,
      confidence,
      details: {
        priceChange24h: token.priceChange24h.toFixed(2) + '%',
        currentPrice: token.price,
        volume24h: token.volume24h
      }
    });
  }
  
  // Check for VOLUME_SPIKE signal (if we have historical data)
  if (token.volume24h > 50000) { // Only significant volume spikes
    const confidence = Math.max(65, Math.min(99, 65 + Math.min(token.volume24h / 100000, 34)));
    
    signals.push({
      type: MemeTokenSignalType.VOLUME_SPIKE,
      token: token.symbol,
      address: token.address,
      confidence,
      details: {
        volume24h: token.volume24h,
        priceChange24h: token.priceChange24h.toFixed(2) + '%',
        currentPrice: token.price
      }
    });
  }
  
  // Check for SNIPER_OPPORTUNITY signal
  if (token.score && token.score > METRICS_THRESHOLDS.SNIPER_MIN_SCORE) {
    const confidence = Math.max(65, Math.min(99, token.score));
    
    signals.push({
      type: MemeTokenSignalType.SNIPER_OPPORTUNITY,
      token: token.symbol,
      address: token.address,
      confidence,
      details: {
        score: token.score.toFixed(2),
        liquidity: token.liquidity,
        volume24h: token.volume24h,
        priceChange24h: token.priceChange24h.toFixed(2) + '%'
      }
    });
  }
  
  return signals;
}

/**
 * Generate a neural signal strength based on confidence
 */
function mapConfidenceToSignalStrength(confidence: number): SignalStrength {
  if (confidence >= CONFIDENCE_THRESHOLDS.VERY_HIGH) {
    return SignalStrength.VERY_STRONG;
  } else if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return SignalStrength.STRONG;
  } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return SignalStrength.MEDIUM;
  } else {
    return SignalStrength.WEAK;
  }
}

/**
 * Map a token signal type to neural signal type
 */
function mapToNeuralSignalType(tokenSignalType: MemeTokenSignalType): SignalType {
  switch (tokenSignalType) {
    case MemeTokenSignalType.NEW_TOKEN_LAUNCH:
      return SignalType.OPPORTUNITY;
    case MemeTokenSignalType.PRICE_SURGE:
      return SignalType.PRICE_MOVE;
    case MemeTokenSignalType.VOLUME_SPIKE:
      return SignalType.VOLUME_SPIKE;
    case MemeTokenSignalType.LIQUIDITY_INCREASE:
      return SignalType.LIQUIDITY_CHANGE;
    case MemeTokenSignalType.MOMENTUM_SHIFT:
      return SignalType.TREND_CHANGE;
    case MemeTokenSignalType.SNIPER_OPPORTUNITY:
      return SignalType.EXECUTION;
    case MemeTokenSignalType.TREND_REVERSAL:
      return SignalType.TREND_CHANGE;
    default:
      return SignalType.INFORMATION;
  }
}

/**
 * Determine signal direction based on token data
 */
function determineSignalDirection(signal: any, token: TokenRelationship): SignalDirection {
  // For price-related signals, use price change
  if (signal.type === MemeTokenSignalType.PRICE_SURGE || 
      signal.type === MemeTokenSignalType.MOMENTUM_SHIFT) {
    if (token.priceChange24h >= 0) {
      return SignalDirection.BULLISH;
    } else {
      return SignalDirection.BEARISH;
    }
  }
  
  // For opportunity signals, almost always bullish
  if (signal.type === MemeTokenSignalType.NEW_TOKEN_LAUNCH || 
      signal.type === MemeTokenSignalType.SNIPER_OPPORTUNITY) {
    return SignalDirection.BULLISH;
  }
  
  // Default direction is NEUTRAL
  return SignalDirection.NEUTRAL;
}

/**
 * Determine signal priority based on signal type and confidence
 */
function determineSignalPriority(signal: any): SignalPriority {
  // Sniper opportunities are highest priority
  if (signal.type === MemeTokenSignalType.SNIPER_OPPORTUNITY && signal.confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return SignalPriority.IMMEDIATE;
  }
  
  // New token launches are high priority
  if (signal.type === MemeTokenSignalType.NEW_TOKEN_LAUNCH && signal.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return SignalPriority.HIGH;
  }
  
  // Major price surges are high priority
  if (signal.type === MemeTokenSignalType.PRICE_SURGE && signal.confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return SignalPriority.HIGH;
  }
  
  // Default priority is NORMAL
  if (signal.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return SignalPriority.NORMAL;
  }
  
  return SignalPriority.LOW;
}

/**
 * Send neural signals to Quantum Omega for execution
 */
export async function sendNeuralSignalsToQuantumOmega(signals: any[]): Promise<void> {
  try {
    for (const signal of signals) {
      // Map the token signal to neural signal parameters
      const neuralSignalType = mapToNeuralSignalType(signal.type);
      const signalStrength = mapConfidenceToSignalStrength(signal.confidence);
      const token = memecoinCache.getToken(signal.address);
      
      if (!token) continue;
      
      const signalDirection = determineSignalDirection(signal, token);
      const signalPriority = determineSignalPriority(signal);
      
      // Create the neural signal payload
      const payload = {
        tokenSymbol: signal.token,
        tokenAddress: signal.address,
        tokenPrice: token.price,
        signalType: signal.type,
        confidence: signal.confidence,
        details: signal.details,
        timestamp: Date.now()
      };
      
      // Log the signal being sent
      logger.info(`[MemeTokenTransformer] Sending ${signal.type} signal to Quantum Omega for ${signal.token} (confidence: ${signal.confidence.toFixed(1)}%)`);
      
      // Send the neural signal
      await sendSignal(
        'MemeTokenTransformer',
        'QuantumOmega',
        neuralSignalType,
        signalStrength,
        signalDirection,
        signalPriority,
        payload
      );
    }
    
    logger.info(`[MemeTokenTransformer] Successfully sent ${signals.length} signals to Quantum Omega`);
  } catch (error) {
    logger.error(`[MemeTokenTransformer] Error sending neural signals: ${error.message}`);
  }
}

/**
 * Process token data and generate neural signals
 */
export async function processTokenDataForSignals(): Promise<void> {
  try {
    logger.info('[MemeTokenTransformer] Processing token data for neural signals...');
    
    // Get the latest token data
    const tokenData = await getAllTokens();
    
    // Get specialized sniper opportunities
    const sniperOpportunities = await getSniperOpportunities();
    
    // Analyze each token for potential signals
    const allSignals: any[] = [];
    
    // Process top tokens
    const topTokens = memecoinCache.getTopTokens();
    for (const token of topTokens) {
      const signals = analyzeTokenForSignals(token);
      allSignals.push(...signals);
    }
    
    // Process new tokens (highest priority)
    const newTokens = memecoinCache.getNewTokens();
    for (const token of newTokens) {
      const signals = analyzeTokenForSignals(token);
      allSignals.push(...signals);
    }
    
    // Process sniper opportunities
    for (const token of sniperOpportunities) {
      const signals = analyzeTokenForSignals(token);
      allSignals.push(...signals);
    }
    
    // Send all signals to Quantum Omega
    if (allSignals.length > 0) {
      logger.info(`[MemeTokenTransformer] Generated ${allSignals.length} neural signals from token data`);
      await sendNeuralSignalsToQuantumOmega(allSignals);
    } else {
      logger.info('[MemeTokenTransformer] No neural signals generated from current token data');
    }
  } catch (error) {
    logger.error(`[MemeTokenTransformer] Error processing token data: ${error.message}`);
  }
}

// In-memory state for the transformer
let transformerState = {
  isInitialized: false,
  lastProcessTime: 0,
  processingInterval: 60 * 1000, // 1 minute
  scheduledProcessingTimer: null as NodeJS.Timeout | null
};

/**
 * Start scheduled processing of token data
 */
export function startScheduledProcessing(): void {
  if (transformerState.scheduledProcessingTimer) {
    clearInterval(transformerState.scheduledProcessingTimer);
  }
  
  transformerState.scheduledProcessingTimer = setInterval(async () => {
    transformerState.lastProcessTime = Date.now();
    await processTokenDataForSignals();
  }, transformerState.processingInterval);
  
  logger.info(`[MemeTokenTransformer] Started scheduled processing every ${transformerState.processingInterval / 1000} seconds`);
}

/**
 * Stop scheduled processing
 */
export function stopScheduledProcessing(): void {
  if (transformerState.scheduledProcessingTimer) {
    clearInterval(transformerState.scheduledProcessingTimer);
    transformerState.scheduledProcessingTimer = null;
    logger.info('[MemeTokenTransformer] Stopped scheduled processing');
  }
}

/**
 * Initialize the Meme Token Neural Transformer
 */
export async function initialize(): Promise<boolean> {
  try {
    if (transformerState.isInitialized) {
      logger.info('[MemeTokenTransformer] Already initialized');
      return true;
    }
    
    logger.info('[MemeTokenTransformer] Initializing Meme Token Neural Transformer...');
    
    // Initialize data processing
    await processTokenDataForSignals();
    
    // Start scheduled processing
    startScheduledProcessing();
    
    transformerState.isInitialized = true;
    logger.info('[MemeTokenTransformer] Successfully initialized Meme Token Neural Transformer');
    return true;
  } catch (error) {
    logger.error(`[MemeTokenTransformer] Failed to initialize: ${error.message}`);
    return false;
  }
}

/**
 * Initialize the neural transformer on module load
 */
if (require.main === module) {
  initialize().catch(error => {
    logger.error(`[MemeTokenTransformer] Error during initialization: ${error.message}`);
  });
}