/**
 * Signal Types for Trading System
 * 
 * Contains shared type definitions for trading signals
 */

// Arbitrage opportunity structure
export interface ArbitrageOpportunity {
  id: string;
  token: string;
  pair?: string;
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  dexA?: string;
  dexB?: string;
  priceA?: number;
  priceB?: number;
  profitPercent: number;
  timestamp: string;
  confidence: number;
  verified: boolean;
}

// Transaction types
export type TransactionType = 'swap' | 'arbitrage' | 'snipe' | 'crosschain';

// Signal types
export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  NEUTRAL = 'NEUTRAL',
  PATTERN_RECOGNITION = 'PATTERN_RECOGNITION',
  VOLATILITY_ALERT = 'VOLATILITY_ALERT',
  ARBITRAGE_OPPORTUNITY = 'ARBITRAGE_OPPORTUNITY',
  MARKET_SENTIMENT = 'MARKET_SENTIMENT',
  STRATEGY_RECOMMENDATION = 'STRATEGY_RECOMMENDATION',
  CUSTOM = 'CUSTOM'
}

// Signal strength
export enum SignalStrength {
  WEAK = 'WEAK',
  MEDIUM = 'MEDIUM',
  STRONG = 'STRONG'
}

// Signal direction (more granular than just buy/sell)
export enum SignalDirection {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL',
  SLIGHTLY_BULLISH = 'SLIGHTLY_BULLISH',
  SLIGHTLY_BEARISH = 'SLIGHTLY_BEARISH'
}

// Signal priority for processing order
export enum SignalPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Signal source
export enum SignalSource {
  MICRO_QHC = 'MicroQHC',
  MEME_CORTEX = 'MEME Cortex',
  MEME_CORTEX_REMIX = 'MemeCortexRemix',
  SECURITY = 'Security',
  CROSS_CHAIN = 'CrossChain',
  PERPLEXITY_AI = 'PerplexityAI',
  LOCAL_ANALYSIS = 'LocalAnalysis'
}

// Base signal interface
export interface BaseSignal {
  id: string;
  pair: string;
  type: SignalType;
  strength: SignalStrength;
  timestamp: string;
  source: SignalSource;
  confidence: number;
  direction: SignalDirection;
  priority: SignalPriority;
  description: string;
  metadata?: Record<string, any>;
  actionable: boolean;
  token_address?: string;
  analysis?: Record<string, any>;
  metrics?: Record<string, any>;
  relatedSignals?: string[];
}

// Trading signal with price target
export interface TradingSignal extends BaseSignal {
  price: number;
  targetPrice?: number;
  stopLoss?: number;
  timeframe?: string;
  metadata?: Record<string, any>;
}

// Security signal
export interface SecuritySignal extends BaseSignal {
  tokenAddress: string;
  securityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rugpullRisk: number;
  honeypotRisk: number;
  centralizationRisk: number;
  analysisTimestamp: number;
}

// CrossChain signal
export interface CrossChainSignal extends BaseSignal {
  sourceChain: string;
  targetChain: string;
  sourceToken: string;
  targetToken: string;
  estimatedProfitPct: number;
  bridgeFee: number;
  bridgeName: string;
}

// Meme token sentiment signal
export interface MemeSentimentSignal extends BaseSignal {
  viralityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VIRAL';
  sentimentScore: number;
  socialVolume: number;
  momentumScore: number;
  trendingHashtags: string[];
  sourcePlatforms: string[];
}