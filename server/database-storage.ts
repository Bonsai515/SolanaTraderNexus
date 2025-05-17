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
  // Helper method to convert database results with numeric fields
  private convertDbNumericFields<T extends Record<string, any>>(item: any): T {
    if (!item) return null as any;
    
    const result = { ...item };
    
    // Convert all potential numeric fields
    if (result.balance !== undefined) result.balance = parseFloat(result.balance);
    if (result.price !== undefined) result.price = parseFloat(result.price);
    if (result.amount !== undefined) result.amount = parseFloat(result.amount);
    if (result.fee !== undefined) result.fee = parseFloat(result.fee);
    if (result.confidence !== undefined) result.confidence = parseFloat(result.confidence);
    
    // Convert enum types
    if (result.type !== undefined) {
      if (Object.values(StrategyType).includes(result.type)) {
        result.type = result.type as StrategyType;
      } else if (Object.values(SignalType).includes(result.type)) {
        result.type = result.type as SignalType;
      } else if (Object.values(TransactionType).includes(result.type)) {
        result.type = result.type as TransactionType;
      }
    }
    
    if (result.strength !== undefined) {
      result.strength = result.strength as SignalStrength;
    }
    
    if (result.status !== undefined) {
      result.status = result.status as TransactionStatus;
    }
    
    if (result.insight_type !== undefined) {
      result.insight_type = result.insight_type as InsightType;
    }
    
    return result as T;
  }
  
  // Helper method to convert database array results
  private convertDbArrayResults<T extends Record<string, any>>(results: any[]): T[] {
    return results.map(item => this.convertDbNumericFields<T>(item));
  }
  
  // Helper method to prepare data for database insert
  private prepareForDb<T extends Record<string, any>>(data: T): any {
    const result = { ...data };
    
    // Convert numeric fields to strings for PostgreSQL
    if (result.balance !== undefined) result.balance = result.balance.toString();
    if (result.price !== undefined) result.price = result.price.toString();
    if (result.amount !== undefined) result.amount = result.amount.toString();
    if (result.fee !== undefined) result.fee = result.fee.toString();
    if (result.confidence !== undefined) result.confidence = result.confidence.toString();
    
    return result;
  }
  
  // Wallet operations
  async createWallet(wallet: InsertWallet): Promise<Wallet> {
    // Convert numeric fields to strings for PostgreSQL
    const dbWallet = this.prepareForDb(wallet);
    
    const [result] = await db.insert(wallets).values(dbWallet).returning();
    
    // Convert back to proper types
    return this.convertDbNumericFields<Wallet>(result);
  }

  async getWallet(id: string): Promise<Wallet | null> {
    const [result] = await db.select().from(wallets).where(eq(wallets.id, id));
    return this.convertDbNumericFields<Wallet>(result);
  }

  async getWallets(): Promise<Wallet[]> {
    const results = await db.select().from(wallets);
    return this.convertDbArrayResults<Wallet>(results);
  }

  async updateWalletBalance(id: string, balance: number): Promise<Wallet | null> {
    const [result] = await db
      .update(wallets)
      .set({ balance: balance.toString() })
      .where(eq(wallets.id, id))
      .returning();
    return this.convertDbNumericFields<Wallet>(result);
  }

  // Strategy operations
  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const dbStrategy = this.prepareForDb(strategy);
    
    const [result] = await db.insert(strategies).values(dbStrategy).returning();
    return this.convertDbNumericFields<Strategy>(result);
  }

  async getStrategy(id: string): Promise<Strategy | null> {
    const [result] = await db.select().from(strategies).where(eq(strategies.id, id));
    return this.convertDbNumericFields<Strategy>(result);
  }

  async getStrategies(): Promise<Strategy[]> {
    const results = await db.select().from(strategies);
    return this.convertDbArrayResults<Strategy>(results);
  }

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy | null> {
    const dbUpdates = this.prepareForDb(updates);
    
    const [result] = await db
      .update(strategies)
      .set(dbUpdates)
      .where(eq(strategies.id, id))
      .returning();
    return this.convertDbNumericFields<Strategy>(result);
  }

  async deleteStrategy(id: string): Promise<boolean> {
    try {
      const result = await db.delete(strategies).where(eq(strategies.id, id));
      return true; // If we got here, deletion was successful
    } catch (error) {
      console.error(`Error deleting strategy ${id}:`, error);
      return false;
    }
  }

  // Signal operations
  async createSignal(signal: InsertTradingSignal): Promise<TradingSignal> {
    const dbSignal = this.prepareForDb(signal);
    
    const [result] = await db.insert(trading_signals).values(dbSignal).returning();
    return this.convertDbNumericFields<TradingSignal>(result);
  }

  async getSignal(id: string): Promise<TradingSignal | null> {
    const [result] = await db.select().from(trading_signals).where(eq(trading_signals.id, id));
    return this.convertDbNumericFields<TradingSignal>(result);
  }

  async getSignals(): Promise<TradingSignal[]> {
    const results = await db.select().from(trading_signals).orderBy(desc(trading_signals.created_at));
    return this.convertDbArrayResults<TradingSignal>(results);
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const dbTransaction = this.prepareForDb(transaction);
    
    const [result] = await db.insert(transactions).values(dbTransaction).returning();
    return this.convertDbNumericFields<Transaction>(result);
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    const [result] = await db.select().from(transactions).where(eq(transactions.id, id));
    return this.convertDbNumericFields<Transaction>(result);
  }

  async getTransactions(): Promise<Transaction[]> {
    const results = await db.select().from(transactions).orderBy(desc(transactions.created_at));
    return this.convertDbArrayResults<Transaction>(results);
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
    return this.convertDbNumericFields<Transaction>(result);
  }

  // Learning Insight operations
  async createLearningInsight(insight: Omit<LearningInsight, 'id' | 'created_at' | 'applied'>): Promise<LearningInsight> {
    const dbInsight = this.prepareForDb({
      ...insight,
      applied: false
    });
    
    const [result] = await db.insert(learning_insights).values(dbInsight).returning();
    return this.convertDbNumericFields<LearningInsight>(result);
  }

  async getLearningInsight(id: string): Promise<LearningInsight | null> {
    const [result] = await db.select().from(learning_insights).where(eq(learning_insights.id, id));
    return this.convertDbNumericFields<LearningInsight>(result);
  }

  async getLearningInsights(): Promise<LearningInsight[]> {
    const results = await db.select().from(learning_insights).orderBy(desc(learning_insights.created_at));
    return this.convertDbArrayResults<LearningInsight>(results);
  }

  async getLearningInsightsByAgentType(agentType: string): Promise<LearningInsight[]> {
    const results = await db.select().from(learning_insights)
      .where(eq(learning_insights.agent_type, agentType))
      .orderBy(desc(learning_insights.created_at));
    return this.convertDbArrayResults<LearningInsight>(results);
  }

  async applyLearningInsight(id: string, resultData: {
    success: boolean;
    performance_delta: number;
    notes: string;
  }): Promise<LearningInsight | null> {
    // Convert performance_delta to string for database storage
    const dbResult = {
      ...resultData,
      performance_delta: resultData.performance_delta.toString()
    };
    
    const [updated] = await db
      .update(learning_insights)
      .set({
        applied: true,
        result: dbResult
      })
      .where(eq(learning_insights.id, id))
      .returning();
    return this.convertDbNumericFields<LearningInsight>(updated);
  }
}

// Export a singleton instance
export const databaseStorage = new DatabaseStorage();