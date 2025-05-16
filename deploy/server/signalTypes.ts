/**
 * Signal Types for Trading System
 * 
 * Contains shared type definitions for trading signals
 */

// Arbitrage opportunity structure
export interface ArbitrageOpportunity {
  pair: string;
  dexA: string;
  dexB: string;
  priceA: number;
  priceB: number;
  profitPercent: number;
  timestamp: string;
}

// Transaction types
export type TransactionType = 'swap' | 'arbitrage' | 'snipe' | 'crosschain';

// Signal types
export type SignalType = 'BUY' | 'SELL' | 'NEUTRAL';

// Signal strength
export type SignalStrength = 'WEAK' | 'MEDIUM' | 'STRONG';

// Signal source
export type SignalSource = 'MicroQHC' | 'MEME Cortex' | 'MemeCortexRemix' | 'Security' | 'CrossChain';

// Base signal interface
export interface BaseSignal {
  id: string;
  pair: string;
  type: SignalType;
  strength: SignalStrength;
  timestamp: string;
  source: SignalSource;
  confidence: number;
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