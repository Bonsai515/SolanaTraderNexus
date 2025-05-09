import { z } from 'zod';

// Wallet Schema
export const walletSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  address: z.string(),
  balance: z.number().default(0),
  created_at: z.date()
});

export type Wallet = z.infer<typeof walletSchema>;
export const insertWalletSchema = walletSchema.omit({ id: true, created_at: true });
export type InsertWallet = z.infer<typeof insertWalletSchema>;

// Strategy Types
export enum StrategyType {
  MARKET_MAKING = 'MARKET_MAKING',
  ARBITRAGE = 'ARBITRAGE',
  MOMENTUM = 'MOMENTUM',
  RANGE_TRADING = 'RANGE_TRADING',
  LIQUIDITY_PROVIDING = 'LIQUIDITY_PROVIDING'
}

// Strategy Schema
export const strategySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.nativeEnum(StrategyType),
  pair: z.string(),
  active: z.boolean().default(false),
  parameters: z.record(z.string(), z.any()).optional(),
  wallet_id: z.string().uuid().optional(),
  created_at: z.date(),
  updated_at: z.date()
});

export type Strategy = z.infer<typeof strategySchema>;
export const insertStrategySchema = strategySchema.omit({ id: true, created_at: true, updated_at: true });
export type InsertStrategy = z.infer<typeof insertStrategySchema>;

// Signal Types
export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD'
}

export enum SignalStrength {
  WEAK = 'WEAK',
  MODERATE = 'MODERATE',
  STRONG = 'STRONG'
}

// Trading Signal Schema
export const tradingSignalSchema = z.object({
  id: z.string().uuid(),
  pair: z.string(),
  type: z.nativeEnum(SignalType),
  strength: z.nativeEnum(SignalStrength),
  price: z.number(),
  strategy_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  created_at: z.date(),
  expires_at: z.date().optional()
});

export type TradingSignal = z.infer<typeof tradingSignalSchema>;
export const insertTradingSignalSchema = tradingSignalSchema.omit({ id: true, created_at: true });
export type InsertTradingSignal = z.infer<typeof insertTradingSignalSchema>;

// Transaction Types
export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  SWAP = 'SWAP',
  PROVIDE_LIQUIDITY = 'PROVIDE_LIQUIDITY',
  REMOVE_LIQUIDITY = 'REMOVE_LIQUIDITY',
  STAKE = 'STAKE',
  UNSTAKE = 'UNSTAKE'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Transaction Schema
export const transactionSchema = z.object({
  id: z.string().uuid(),
  transaction_hash: z.string().optional(),
  type: z.nativeEnum(TransactionType),
  status: z.nativeEnum(TransactionStatus).default(TransactionStatus.PENDING),
  amount: z.number(),
  fee: z.number().optional(),
  wallet_id: z.string().uuid(),
  pair: z.string(),
  signal_id: z.string().uuid().optional(),
  strategy_id: z.string().uuid().optional(),
  price: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  created_at: z.date(),
  confirmed_at: z.date().optional()
});

export type Transaction = z.infer<typeof transactionSchema>;
export const insertTransactionSchema = transactionSchema.omit({ id: true, created_at: true, confirmed_at: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// Learning insight types - for agent self-awareness system
export enum InsightType {
  TIME_BASED_EXECUTION = 'TIME_BASED_EXECUTION',
  PAIR_PERFORMANCE = 'PAIR_PERFORMANCE',
  DEX_PREFERENCE = 'DEX_PREFERENCE',
  FAILURE_PATTERN = 'FAILURE_PATTERN',
  PROFIT_OPTIMIZATION = 'PROFIT_OPTIMIZATION',
  RISK_MANAGEMENT = 'RISK_MANAGEMENT'
}

export const insightResultSchema = z.object({
  applied_at: z.date(),
  success: z.boolean(),
  performance_delta: z.number(),
  notes: z.string()
});

export const learningInsightSchema = z.object({
  id: z.string(),
  agent_type: z.string(),
  strategy_id: z.string(),
  pair: z.string().optional(),
  insight_type: z.nativeEnum(InsightType),
  confidence: z.number(),
  description: z.string(),
  recommendation: z.string(),
  created_at: z.date(),
  applied: z.boolean(),
  result: insightResultSchema.optional()
});

export type LearningInsight = z.infer<typeof learningInsightSchema>;
export type InsightResult = z.infer<typeof insightResultSchema>;