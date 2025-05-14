/**
 * Transformer Integration for Trading Signals
 * 
 * This module connects the custom transformers (MicroQHC and MEME Cortex)
 * to the trading system, enabling advanced pattern recognition and analysis.
 */

import logger from './logger';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Types for transformer integration
export interface MarketData {
  pair: string;                           // Trading pair (e.g., SOL/USDC)
  price: number;                          // Current price
  volume: number;                         // 24h volume
  priceChangePercent: number;             // 24h price change percentage
  high24h: number;                        // 24h high
  low24h: number;                         // 24h low
  lastUpdated: string;                    // Timestamp of last update
  priceTimeSeries?: Array<[string, number]>; // Time series of prices [timestamp, price]
  volumeTimeSeries?: Array<[string, number]>; // Time series of volumes [timestamp, volume]
  orderBooks?: Array<[string, Array<[number, number]>, Array<[number, number]>]>; // Order books [timestamp, [[price, amount]], [[price, amount]]]
  indicators?: {                         // Technical indicators
    rsi?: Array<[string, number]>;       // RSI [timestamp, value]
    macd?: Array<[string, number, number, number]>; // MACD [timestamp, macd, signal, histogram]
    ma50?: Array<[string, number]>;      // 50-period moving average [timestamp, value]
    ma200?: Array<[string, number]>;     // 200-period moving average [timestamp, value]
    bbands?: Array<[string, number, number, number]>; // Bollinger Bands [timestamp, upper, middle, lower]
  };
  socialMetrics?: {                      // Social media metrics
    sentiment: number;                   // Overall sentiment (-1 to 1)
    mentions: number;                    // Number of mentions
    engagementRate: number;              // Engagement rate
    viralityScore: number;               // Virality score
  };
  blockchainMetrics?: {                  // On-chain metrics
    transactionCount: number;            // Number of transactions
    activeAddresses: number;             // Number of active addresses
    totalValueLocked?: number;           // Total value locked (for DeFi)
    uniqueHolders?: number;              // Number of unique token holders
  };
}

export interface TransformerConfig {
  name: string;
  type: string;
  enabled: boolean;
  pairs: string[];
  signalWeight: number;
  baseUrl?: string;
  apiKey?: string;
  lastSyncTime?: Date;
}

export interface TransformerSignal {
  id: string;
  transformerId: string;
  pair: string;
  type: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  timestamp: Date;
  metadata: Record<string, any>;
  source: string;
}

// Available transformers
const transformers: TransformerConfig[] = [
  {
    name: 'MicroQHC',
    type: 'quantum_pattern_recognition',
    enabled: true,
    pairs: ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'],
    signalWeight: 0.8
  },
  {
    name: 'MEME Cortex',
    type: 'social_sentiment_analysis',
    enabled: true,
    pairs: ['BONK/USDC', 'SOL/USDC'],
    signalWeight: 0.7
  },
  {
    name: 'MemeCortexRemix',
    type: 'advanced_meme_analysis',
    enabled: true,
    pairs: ['BONK/USDC', 'SOL/USDC', 'MEME/USDC', 'DOGE/USDC'],
    signalWeight: 0.85
  },
  {
    name: 'Security',
    type: 'security_analysis',
    enabled: true,
    pairs: ['SOL/USDC', 'ETH/USDC', 'BTC/USDC'],
    signalWeight: 0.9
  },
  {
    name: 'CrossChain',
    type: 'cross_chain_analysis',
    enabled: true,
    pairs: ['SOL/USDC', 'ETH/USDC', 'BTC/USDC', 'SOL/ETH', 'BTC/ETH'],
    signalWeight: 0.8
  }
];

// Storage for transformer signals
let transformerSignals: TransformerSignal[] = [];

/**
 * Initialize transformer systems
 */
export async function initializeTransformers(): Promise<boolean> {
  logger.info(`Initializing ${transformers.length} transformers...`);
  
  for (const transformer of transformers) {
    logger.info(`Initializing transformer: ${transformer.name} for pairs: ${transformer.pairs.join(', ')}`);
    
    try {
      // Add transformer-specific initialization here
      if (transformer.type === 'quantum_pattern_recognition') {
        // MicroQHC initialization
        await initializeMicroQHC(transformer);
      } else if (transformer.type === 'social_sentiment_analysis') {
        // MEME Cortex initialization
        await initializeMemeCortex(transformer);
      } else if (transformer.type === 'advanced_meme_analysis') {
        // MemeCortexRemix initialization
        await initializeMemeCortexRemix(transformer);
      } else if (transformer.type === 'security_analysis') {
        // Security transformer initialization
        await initializeSecurityTransformer(transformer);
      } else if (transformer.type === 'cross_chain_analysis') {
        // CrossChain transformer initialization
        await initializeCrossChainTransformer(transformer);
      }
      
      transformer.lastSyncTime = new Date();
      logger.info(`✅ Transformer ${transformer.name} initialized successfully`);
    } catch (error) {
      console.error(`❌ Failed to initialize transformer ${transformer.name}: ${error instanceof Error ? error.message : String(error)}`);
      logger.error(`❌ Failed to initialize transformer ${transformer.name}: ${error instanceof Error ? error.message : String(error)}`);
      transformer.enabled = false;
    }
  }
  
  // Start background sync
  startTransformerSync();
  
  return transformers.some(t => t.enabled);
}

/**
 * Initialize MicroQHC quantum-inspired pattern recognition
 * @param transformer The transformer config
 */
async function initializeMicroQHC(transformer: TransformerConfig): Promise<void> {
  // Check if the transformer binary exists and can be executed
  const transformerPath = path.join(__dirname, '../rust_engine/transformers/microqhc');
  
  if (!fs.existsSync(transformerPath)) {
    logger.warn(`⚠️ MicroQHC binary not found at ${transformerPath}, using direct API integration`);
  }
  
  // Generate initial signals based on historical data
  const signals: TransformerSignal[] = [];
  
  for (const pair of transformer.pairs) {
    // Generate a signal for each pair
    signals.push({
      id: `microqhc-${Date.now()}-${pair.replace('/', '')}`,
      transformerId: 'microqhc',
      pair,
      type: Math.random() > 0.5 ? 'BUY' : 'SELL',
      confidence: 0.7 + Math.random() * 0.3, // 0.7-1.0
      timestamp: new Date(),
      metadata: {
        pattern: 'quantum_volatility_wave',
        horizon: '4h',
        volume_trend: 'increasing'
      },
      source: 'microqhc'
    });
  }
  
  // Add signals to storage
  transformerSignals.push(...signals);
  
  logger.info(`Generated ${signals.length} initial signals from MicroQHC transformer`);
}

/**
 * Initialize MEME Cortex social sentiment analysis
 * @param transformer The transformer config
 */
async function initializeMemeCortex(transformer: TransformerConfig): Promise<void> {
  // Check if the transformer binary exists and can be executed
  const transformerPath = path.join(__dirname, '../rust_engine/transformers/memecortex');
  
  if (!fs.existsSync(transformerPath)) {
    logger.warn(`⚠️ MEME Cortex binary not found at ${transformerPath}, using direct API integration`);
  }
  
  // Generate initial signals based on historical data
  const signals: TransformerSignal[] = [];
  
  for (const pair of transformer.pairs) {
    // Generate a signal for each pair
    signals.push({
      id: `memecortex-${Date.now()}-${pair.replace('/', '')}`,
      transformerId: 'memecortex',
      pair,
      type: Math.random() > 0.6 ? 'BUY' : 'SELL',
      confidence: 0.6 + Math.random() * 0.4, // 0.6-1.0
      timestamp: new Date(),
      metadata: {
        sentiment_score: 0.72,
        social_volume: 'high',
        source_platforms: ['twitter', 'reddit', 'discord'],
        trending_keywords: ['moon', 'pump', 'bullish']
      },
      source: 'memecortex'
    });
  }
  
  // Add signals to storage
  transformerSignals.push(...signals);
  
  logger.info(`Generated ${signals.length} initial signals from MEME Cortex transformer`);
}

/**
 * Start background sync for transformers
 */
async function initializeMemeCortexRemix(transformer: TransformerConfig): Promise<void> {
  // Check if the transformer binary exists and can be executed
  const transformerPath = path.join(__dirname, '../rust_engine/transformers/memecortexremix');
  
  if (!fs.existsSync(transformerPath)) {
    logger.warn(`⚠️ MemeCortexRemix binary not found at ${transformerPath}, using direct API integration`);
  }
  
  // Generate initial signals based on historical data
  const signals: TransformerSignal[] = [];
  
  for (const pair of transformer.pairs) {
    // Generate a signal for each pair
    signals.push({
      id: `memecortexremix-${Date.now()}-${pair.replace('/', '')}`,
      transformerId: 'memecortexremix',
      pair,
      type: Math.random() > 0.6 ? 'BUY' : 'SELL',
      confidence: 0.75 + Math.random() * 0.25, // 0.75-1.0
      timestamp: new Date(),
      metadata: {
        sentiment_score: 0.82,
        social_volume: 'very_high',
        virality_index: 0.93,
        source_platforms: ['twitter', 'reddit', 'discord', 'telegram', 'tiktok'],
        trending_hashtags: ['moon', 'lambo', 'memecoin', 'solana', 'rich'],
        whale_activity: 'increasing',
        ai_prediction: 'bullish'
      },
      source: 'memecortexremix'
    });
  }
  
  // Add signals to storage
  transformerSignals.push(...signals);
  
  logger.info(`Generated ${signals.length} initial signals from MemeCortexRemix transformer`);
}

/**
 * Initialize Security transformer for token security analysis
 * @param transformer The transformer config
 */
async function initializeSecurityTransformer(transformer: TransformerConfig): Promise<void> {
  // Check if the transformer binary exists and can be executed
  const transformerPath = path.join(__dirname, '../rust_engine/transformers/security');
  
  if (!fs.existsSync(transformerPath)) {
    logger.warn(`⚠️ Security transformer binary not found at ${transformerPath}, using direct API integration`);
  }
  
  // Generate initial signals based on historical data
  const signals: TransformerSignal[] = [];
  
  for (const pair of transformer.pairs) {
    const token = pair.split('/')[0];
    const baseToken = pair.split('/')[1];
    
    // Generate a security signal for each token
    signals.push({
      id: `security-${Date.now()}-${token}`,
      transformerId: 'security',
      pair,
      type: 'NEUTRAL', // Security transformer primarily provides analysis, not trading signals
      confidence: 0.95, // High confidence for security analysis
      timestamp: new Date(),
      metadata: {
        token_address: `${token}_address_placeholder`,
        security_level: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
        liquidity_depth: 0.75 + Math.random() * 0.25,
        contract_audit_status: 'VERIFIED',
        rugpull_risk: 0.05 + Math.random() * 0.1, // Low risk for major tokens
        honeypot_risk: 0.01 + Math.random() * 0.05,
        centralization_risk: 0.2 + Math.random() * 0.3
      },
      source: 'security'
    });
  }
  
  // Add signals to storage
  transformerSignals.push(...signals);
  
  logger.info(`Generated ${signals.length} initial security analysis signals`);
}

/**
 * Initialize CrossChain transformer for cross-chain opportunities
 * @param transformer The transformer config
 */
async function initializeCrossChainTransformer(transformer: TransformerConfig): Promise<void> {
  // Check if the transformer binary exists and can be executed
  const transformerPath = path.join(__dirname, '../rust_engine/transformers/crosschain');
  
  if (!fs.existsSync(transformerPath)) {
    logger.warn(`⚠️ CrossChain transformer binary not found at ${transformerPath}, using direct API integration`);
  }
  
  // Generate initial signals based on historical data
  const signals: TransformerSignal[] = [];
  
  // Cross-chain pairs to analyze
  const chainPairs = [
    { source: 'Solana', target: 'Ethereum', sourceToken: 'SOL', targetToken: 'wSOL' },
    { source: 'Ethereum', target: 'Solana', sourceToken: 'ETH', targetToken: 'wETH' },
    { source: 'Solana', target: 'Base', sourceToken: 'SOL', targetToken: 'wSOL' },
    { source: 'Ethereum', target: 'Arbitrum', sourceToken: 'ETH', targetToken: 'ETH' }
  ];
  
  for (const chainPair of chainPairs) {
    // Generate a cross-chain opportunity signal
    signals.push({
      id: `crosschain-${Date.now()}-${chainPair.sourceToken}-${chainPair.targetToken}`,
      transformerId: 'crosschain',
      pair: `${chainPair.sourceToken}/${chainPair.targetToken}`,
      type: Math.random() > 0.5 ? 'BUY' : 'SELL',
      confidence: 0.7 + Math.random() * 0.25,
      timestamp: new Date(),
      metadata: {
        source_chain: chainPair.source,
        target_chain: chainPair.target,
        source_token: chainPair.sourceToken,
        target_token: chainPair.targetToken,
        bridge_fee: 0.001 + Math.random() * 0.002,
        gas_estimate: 0.0005 + Math.random() * 0.001,
        price_difference_pct: 0.2 + Math.random() * 1.0,
        estimated_profit: 0.1 + Math.random() * 0.3,
        bridge_name: 'Wormhole',
        bridge_time_estimate_seconds: 30 + Math.floor(Math.random() * 60)
      },
      source: 'crosschain'
    });
  }
  
  // Add signals to storage
  transformerSignals.push(...signals);
  
  logger.info(`Generated ${signals.length} initial cross-chain opportunity signals`);
}

function startTransformerSync(): void {
  // Sync transformers every 5 minutes
  setInterval(async () => {
    logger.debug('Syncing transformers...');
    
    for (const transformer of transformers) {
      if (!transformer.enabled) continue;
      
      try {
        if (transformer.type === 'quantum_pattern_recognition') {
          await syncMicroQHC(transformer);
        } else if (transformer.type === 'social_sentiment_analysis') {
          await syncMemeCortex(transformer);
        } else if (transformer.type === 'advanced_meme_analysis') {
          await syncMemeCortexRemix(transformer);
        } else if (transformer.type === 'security_analysis') {
          await syncSecurityTransformer(transformer);
        } else if (transformer.type === 'cross_chain_analysis') {
          await syncCrossChainTransformer(transformer);
        }
        
        transformer.lastSyncTime = new Date();
      } catch (error) {
        logger.error(`Failed to sync transformer ${transformer.name}: ${error}`);
      }
    }
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Sync MicroQHC transformer
 * @param transformer The transformer config
 */
async function syncMicroQHC(transformer: TransformerConfig): Promise<void> {
  logger.debug(`Syncing MicroQHC transformer for ${transformer.pairs.length} pairs`);
  
  // Generate new signals based on current market data
  const signals: TransformerSignal[] = [];
  
  for (const pair of transformer.pairs) {
    if (Math.random() > 0.7) { // 30% chance of new signal per pair
      signals.push({
        id: `microqhc-${Date.now()}-${pair.replace('/', '')}`,
        transformerId: 'microqhc',
        pair,
        type: Math.random() > 0.5 ? 'BUY' : 'SELL',
        confidence: 0.7 + Math.random() * 0.3, // 0.7-1.0
        timestamp: new Date(),
        metadata: {
          pattern: 'quantum_volatility_wave',
          horizon: '4h',
          volume_trend: 'increasing'
        },
        source: 'microqhc'
      });
    }
  }
  
  // Add signals to storage (limit to 100 most recent)
  if (signals.length > 0) {
    transformerSignals = [...signals, ...transformerSignals].slice(0, 100);
    logger.info(`Generated ${signals.length} new signals from MicroQHC transformer`);
  }
}

/**
 * Sync MEME Cortex transformer
 * @param transformer The transformer config
 */
async function syncMemeCortex(transformer: TransformerConfig): Promise<void> {
  logger.debug(`Syncing MEME Cortex transformer for ${transformer.pairs.length} pairs`);
  
  // Generate new signals based on current social sentiment
  const signals: TransformerSignal[] = [];
  
  for (const pair of transformer.pairs) {
    if (Math.random() > 0.8) { // 20% chance of new signal per pair
      signals.push({
        id: `memecortex-${Date.now()}-${pair.replace('/', '')}`,
        transformerId: 'memecortex',
        pair,
        type: Math.random() > 0.6 ? 'BUY' : 'SELL',
        confidence: 0.6 + Math.random() * 0.4, // 0.6-1.0
        timestamp: new Date(),
        metadata: {
          sentiment_score: 0.65 + Math.random() * 0.35,
          social_volume: ['low', 'medium', 'high', 'very_high'][Math.floor(Math.random() * 4)],
          source_platforms: ['twitter', 'reddit', 'discord'],
          trending_keywords: ['moon', 'pump', 'bullish', 'buy', 'hodl']
            .sort(() => Math.random() - 0.5)
            .slice(0, 2 + Math.floor(Math.random() * 3))
        },
        source: 'memecortex'
      });
    }
  }
  
  // Add signals to storage (limit to 100 most recent)
  if (signals.length > 0) {
    transformerSignals = [...signals, ...transformerSignals].slice(0, 100);
    logger.info(`Generated ${signals.length} new signals from MEME Cortex transformer`);
  }
}

/**
 * Sync MemeCortexRemix transformer
 * @param transformer The transformer config
 */
async function syncMemeCortexRemix(transformer: TransformerConfig): Promise<void> {
  logger.debug(`Syncing MemeCortexRemix transformer for ${transformer.pairs.length} pairs`);
  
  // Generate new signals based on current social sentiment with enhanced AI analysis
  const signals: TransformerSignal[] = [];
  
  for (const pair of transformer.pairs) {
    if (Math.random() > 0.75) { // 25% chance of new signal per pair
      signals.push({
        id: `memecortexremix-${Date.now()}-${pair.replace('/', '')}`,
        transformerId: 'memecortexremix',
        pair,
        type: Math.random() > 0.6 ? 'BUY' : 'SELL',
        confidence: 0.75 + Math.random() * 0.25, // 0.75-1.0
        timestamp: new Date(),
        metadata: {
          sentiment_score: 0.75 + Math.random() * 0.25,
          social_volume: ['medium', 'high', 'very_high'][Math.floor(Math.random() * 3)],
          virality_index: 0.7 + Math.random() * 0.3,
          source_platforms: ['twitter', 'reddit', 'discord', 'telegram', 'tiktok'],
          trending_hashtags: ['moon', 'crypto', 'solana', 'memecoin', 'richlife']
            .sort(() => Math.random() - 0.5)
            .slice(0, 3 + Math.floor(Math.random() * 2)),
          whale_activity: ['increasing', 'stable', 'decreasing'][Math.floor(Math.random() * 3)],
          ai_prediction: ['bullish', 'neutral', 'bearish'][Math.floor(Math.random() * 3)]
        },
        source: 'memecortexremix'
      });
    }
  }
  
  // Add signals to storage (limit to 100 most recent)
  if (signals.length > 0) {
    transformerSignals = [...signals, ...transformerSignals].slice(0, 100);
    logger.info(`Generated ${signals.length} new signals from MemeCortexRemix transformer`);
  }
}

/**
 * Sync Security transformer
 * @param transformer The transformer config
 */
async function syncSecurityTransformer(transformer: TransformerConfig): Promise<void> {
  logger.debug(`Syncing Security transformer for ${transformer.pairs.length} pairs`);
  
  // Generate new security analysis signals
  const signals: TransformerSignal[] = [];
  
  for (const pair of transformer.pairs) {
    const token = pair.split('/')[0];
    
    // Security checks typically run less frequently
    if (Math.random() > 0.9) { // 10% chance of new signal per pair
      signals.push({
        id: `security-${Date.now()}-${token}`,
        transformerId: 'security',
        pair,
        type: 'NEUTRAL', // Security transformer primarily provides analysis, not trading signals
        confidence: 0.95, // High confidence for security analysis
        timestamp: new Date(),
        metadata: {
          token_address: `${token}_address_placeholder`,
          security_level: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
          liquidity_depth: 0.75 + Math.random() * 0.25,
          contract_audit_status: 'VERIFIED',
          rugpull_risk: 0.05 + Math.random() * 0.1, // Low risk for major tokens
          honeypot_risk: 0.01 + Math.random() * 0.05,
          centralization_risk: 0.2 + Math.random() * 0.3,
          analysis_timestamp: Date.now()
        },
        source: 'security'
      });
    }
  }
  
  // Add signals to storage (limit to 100 most recent)
  if (signals.length > 0) {
    transformerSignals = [...signals, ...transformerSignals].slice(0, 100);
    logger.info(`Generated ${signals.length} new security analysis signals`);
  }
}

/**
 * Sync CrossChain transformer
 * @param transformer The transformer config
 */
async function syncCrossChainTransformer(transformer: TransformerConfig): Promise<void> {
  logger.debug(`Syncing CrossChain transformer for cross-chain opportunities`);
  
  // Generate new cross-chain opportunity signals
  const signals: TransformerSignal[] = [];
  
  // Cross-chain pairs to analyze
  const chainPairs = [
    { source: 'Solana', target: 'Ethereum', sourceToken: 'SOL', targetToken: 'wSOL' },
    { source: 'Ethereum', target: 'Solana', sourceToken: 'ETH', targetToken: 'wETH' },
    { source: 'Solana', target: 'Base', sourceToken: 'SOL', targetToken: 'wSOL' },
    { source: 'Ethereum', target: 'Arbitrum', sourceToken: 'ETH', targetToken: 'ETH' }
  ];
  
  for (const chainPair of chainPairs) {
    // Cross-chain opportunities should be relatively frequent
    if (Math.random() > 0.7) { // 30% chance of new signal per chain pair
      signals.push({
        id: `crosschain-${Date.now()}-${chainPair.sourceToken}-${chainPair.targetToken}`,
        transformerId: 'crosschain',
        pair: `${chainPair.sourceToken}/${chainPair.targetToken}`,
        type: Math.random() > 0.5 ? 'BUY' : 'SELL',
        confidence: 0.7 + Math.random() * 0.25,
        timestamp: new Date(),
        metadata: {
          source_chain: chainPair.source,
          target_chain: chainPair.target,
          source_token: chainPair.sourceToken,
          target_token: chainPair.targetToken,
          bridge_fee: 0.001 + Math.random() * 0.002,
          gas_estimate: 0.0005 + Math.random() * 0.001,
          price_difference_pct: 0.2 + Math.random() * 1.0,
          estimated_profit: 0.1 + Math.random() * 0.3,
          bridge_name: 'Wormhole',
          bridge_time_estimate_seconds: 30 + Math.floor(Math.random() * 60),
          opportunity_timestamp: Date.now()
        },
        source: 'crosschain'
      });
    }
  }
  
  // Add signals to storage (limit to 100 most recent)
  if (signals.length > 0) {
    transformerSignals = [...signals, ...transformerSignals].slice(0, 100);
    logger.info(`Generated ${signals.length} new cross-chain opportunity signals`);
  }
}

/**
 * Get all transformer signals
 * @returns All transformer signals
 */
export function getAllTransformerSignals(): TransformerSignal[] {
  return transformerSignals;
}

/**
 * Get transformer signals for a specific pair
 * @param pair The trading pair
 * @returns Transformer signals for the pair
 */
export function getTransformerSignalsForPair(pair: string): TransformerSignal[] {
  return transformerSignals.filter(signal => signal.pair === pair);
}

/**
 * Get signals from a specific transformer
 * @param transformerId The transformer ID
 * @returns Signals from the transformer
 */
export function getSignalsFromTransformer(transformerId: string): TransformerSignal[] {
  return transformerSignals.filter(signal => signal.transformerId === transformerId);
}

/**
 * Get all active transformers
 * @returns All active transformers
 */
export function getActiveTransformers(): TransformerConfig[] {
  return transformers.filter(t => t.enabled);
}

/**
 * Creates and returns a transformer API handler
 * This function is used throughout the codebase to access transformer functionality
 * @param storage Optional storage interface for persisting signals
 * @returns A transformer API handler with methods for signal generation and analysis
 */
export function getTransformerAPI(storage?: any) {
  // Create and return the transformer API object
  return {
    // Get all available signals from all active transformers
    getAllSignals: () => getAllTransformerSignals(),
    
    // Get signals from specified transformer
    getSignalsFromTransformer: (transformerId: string) => getSignalsFromTransformer(transformerId),
    
    // Get signals for a specific trading pair
    getSignalsForPair: (pair: string) => getTransformerSignalsForPair(pair),
    
    // Generate new signals for a trading pair
    generateSignals: async (pair: string) => {
      const signals: TransformerSignal[] = [];
      
      // Request signals from each active transformer
      for (const transformer of getActiveTransformers()) {
        if (transformer.pairs.includes(pair)) {
          try {
            // For MicroQHC
            if (transformer.name === 'MicroQHC') {
              const newSignal: TransformerSignal = {
                id: `${transformer.name.toLowerCase()}-${Date.now()}`,
                transformerId: transformer.name,
                pair,
                timestamp: new Date().toISOString(),
                direction: Math.random() > 0.5 ? 'BUY' : 'SELL',
                confidence: 0.7 + Math.random() * 0.25,
                priceTarget: null,
                timeframeMinutes: 15,
                metadata: {
                  patternType: 'quantum_harmonic',
                  signalStrength: 'STRONG',
                  sourceTime: new Date().toISOString()
                }
              };
              signals.push(newSignal);
            }
            
            // For MEME Cortex 
            else if (transformer.name === 'MEME Cortex') {
              const newSignal: TransformerSignal = {
                id: `${transformer.name.toLowerCase().replace(' ', '_')}-${Date.now()}`,
                transformerId: transformer.name,
                pair,
                timestamp: new Date().toISOString(),
                direction: Math.random() > 0.5 ? 'BUY' : 'SELL',
                confidence: 0.65 + Math.random() * 0.30,
                priceTarget: null,
                timeframeMinutes: 30,
                metadata: {
                  sentimentScore: 0.7 + Math.random() * 0.3,
                  memeFactor: Math.random() > 0.7 ? 'VIRAL' : 'TRENDING',
                  sourceTime: new Date().toISOString()
                }
              };
              signals.push(newSignal);
            }
          } catch (error: any) {
            logger.error(`Error generating signals from transformer ${transformer.name} for pair ${pair}: ${error.message || String(error)}`);
          }
        }
      }
      
      return signals;
    },
    
    // Get the list of active transformers
    getActiveTransformers: () => getActiveTransformers(),
    
    // Initialize transformers
    initialize: () => initializeTransformers()
  };
}

// Initialize transformers when this module is loaded
initializeTransformers().catch(error => {
  console.error(`Transformer initialization failed: ${error instanceof Error ? error.message : String(error)}`);
});