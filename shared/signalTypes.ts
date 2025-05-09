/**
 * Shared Signal Types
 * 
 * This file contains shared enum types used for signals throughout the application.
 * These types ensure consistency between the server and client code.
 */

// Signal type classification
export enum SignalType {
  PRICE_ACTION = 'price_action',
  VOLATILITY = 'volatility',
  LIQUIDITY_CHANGE = 'liquidity_change',
  SOCIAL_SENTIMENT = 'social_sentiment',
  WHALE_MOVEMENT = 'whale_movement',
  MEV_OPPORTUNITY = 'mev_opportunity',
  PATTERN_RECOGNITION = 'pattern_recognition',
  CROSS_CHAIN = 'cross_chain',
  FLASH_LOAN = 'flash_loan',
  SANDWICH_OPPORTUNITY = 'sandwich_opportunity',
  ARBITRAGE = 'arbitrage',
  SNIPE = 'snipe',
  CUSTOM = 'custom'
}

// Signal strength indicator
export enum SignalStrength {
  WEAK = 'weak',
  MODERATE = 'moderate',
  STRONG = 'strong',
  VERY_STRONG = 'very_strong'
}

// Signal market direction
export enum SignalDirection {
  BULLISH = 'bullish',
  BEARISH = 'bearish',
  NEUTRAL = 'neutral',
  MIXED = 'mixed'
}

// Signal source origin
export enum SignalSource {
  MICRO_QHC = 'micro_qhc',
  MEME_CORTEX = 'meme_cortex',
  HYPERION_AGENT = 'hyperion_agent',
  QUANTUM_OMEGA_AGENT = 'quantum_omega_agent',
  CROSS_CHAIN_ANALYZER = 'cross_chain_analyzer',
  AI_SYSTEM = 'ai_system',
  EXTERNAL = 'external',
  CUSTOM = 'custom'
}

// Signal priority level
export enum SignalPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

// Base signal interface
export interface BaseSignal {
  id: string;
  timestamp: Date;
  pair: string;
  type: SignalType;
  source: SignalSource;
  strength: SignalStrength;
  direction: SignalDirection;
  priority: SignalPriority;
  confidence: number; // 0-100
  description: string;
  metadata: Record<string, any>;
  ttl?: number; // Time to live in seconds
  relatedSignals?: string[]; // IDs of related signals
  actionable?: boolean; // Whether this signal can be acted upon directly
  token_address?: string; // Blockchain address of the token
  analysis?: Record<string, any>; // Detailed analysis data
  metrics?: Record<string, number>; // Numerical metrics related to the signal
  targetComponents?: string[]; // List of components that should receive this signal
}