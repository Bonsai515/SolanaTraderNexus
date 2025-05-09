import { IStorage } from './storage';
import { db } from './db';
import {
  type Wallet, type InsertWallet,
  type Strategy, type InsertStrategy,
  type TradingSignal, type InsertTradingSignal,
  type Transaction, type InsertTransaction,
  type LearningInsight,
  TransactionStatus, StrategyType, SignalType, SignalStrength, InsightType, TransactionType,
  wallets, strategies, trading_signals, transactions, learning_insights
} from '../shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

/**
 * PostgreSQL database storage implementation
 */
export class DatabaseStorage implements IStorage {
  // Wallet operations
  async createWallet(wallet: InsertWallet): Promise<Wallet> {
    const [result] = await db.insert(wallets).values(wallet).returning();
    return result;
  }

  async getWallet(id: string): Promise<Wallet | null> {
    const [result] = await db.select().from(wallets).where(eq(wallets.id, id));
    return result || null;
  }

  async getWallets(): Promise<Wallet[]> {
    return await db.select().from(wallets);
  }

  async updateWalletBalance(id: string, balance: number): Promise<Wallet | null> {
    const [result] = await db
      .update(wallets)
      .set({ balance })
      .where(eq(wallets.id, id))
      .returning();
    return result || null;
  }

  // Strategy operations
  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const [result] = await db.insert(strategies).values(strategy).returning();
    return result;
  }

  async getStrategy(id: string): Promise<Strategy | null> {
    const [result] = await db.select().from(strategies).where(eq(strategies.id, id));
    return result || null;
  }

  async getStrategies(): Promise<Strategy[]> {
    return await db.select().from(strategies);
  }

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy | null> {
    const [result] = await db
      .update(strategies)
      .set(updates)
      .where(eq(strategies.id, id))
      .returning();
    return result || null;
  }

  async deleteStrategy(id: string): Promise<boolean> {
    const result = await db.delete(strategies).where(eq(strategies.id, id));
    return result.count > 0;
  }

  // Signal operations
  async createSignal(signal: InsertTradingSignal): Promise<TradingSignal> {
    const [result] = await db.insert(trading_signals).values(signal).returning();
    return result;
  }

  async getSignal(id: string): Promise<TradingSignal | null> {
    const [result] = await db.select().from(trading_signals).where(eq(trading_signals.id, id));
    return result || null;
  }

  async getSignals(): Promise<TradingSignal[]> {
    return await db.select().from(trading_signals).orderBy(desc(trading_signals.created_at));
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [result] = await db.insert(transactions).values(transaction).returning();
    return result;
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    const [result] = await db.select().from(transactions).where(eq(transactions.id, id));
    return result || null;
  }

  async getTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions).orderBy(desc(transactions.created_at));
  }

  async updateTransactionStatus(id: string, status: TransactionStatus): Promise<Transaction | null> {
    const [result] = await db
      .update(transactions)
      .set({ 
        status,
        confirmed_at: status === TransactionStatus.CONFIRMED ? new Date() : undefined
      })
      .where(eq(transactions.id, id))
      .returning();
    return result || null;
  }

  // Learning Insight operations
  async createLearningInsight(insight: Omit<LearningInsight, 'id' | 'created_at' | 'applied'>): Promise<LearningInsight> {
    const [result] = await db.insert(learning_insights).values({
      ...insight,
      applied: false
    }).returning();
    return result;
  }

  async getLearningInsight(id: string): Promise<LearningInsight | null> {
    const [result] = await db.select().from(learning_insights).where(eq(learning_insights.id, id));
    return result || null;
  }

  async getLearningInsights(): Promise<LearningInsight[]> {
    return await db.select().from(learning_insights).orderBy(desc(learning_insights.created_at));
  }

  async getLearningInsightsByAgentType(agentType: string): Promise<LearningInsight[]> {
    return await db.select().from(learning_insights)
      .where(eq(learning_insights.agent_type, agentType))
      .orderBy(desc(learning_insights.created_at));
  }

  async applyLearningInsight(id: string, result: {
    success: boolean;
    performance_delta: number;
    notes: string;
  }): Promise<LearningInsight | null> {
    const [updated] = await db
      .update(learning_insights)
      .set({
        applied: true,
        result: result
      })
      .where(eq(learning_insights.id, id))
      .returning();
    return updated || null;
  }
}

// Export a singleton instance
export const databaseStorage = new DatabaseStorage();