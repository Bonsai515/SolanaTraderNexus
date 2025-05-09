import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { 
  InsertWallet, Wallet,
  InsertStrategy, Strategy,
  InsertTradingSignal, TradingSignal,
  InsertTransaction, Transaction,
  LearningInsight, InsightResult,
  wallets, strategies, trading_signals, transactions, learning_insights,
  StrategyType, SignalType, SignalStrength, TransactionType, TransactionStatus, InsightType
} from '../shared/schema';
import { IStorage } from './storage';
import { v4 as uuidv4 } from 'uuid';
import { SQL } from 'drizzle-orm';

// Define helper types for database operations
type DbWallet = typeof wallets.$inferSelect;
type DbStrategy = typeof strategies.$inferSelect;
type DbTradingSignal = typeof trading_signals.$inferSelect;
type DbTransaction = typeof transactions.$inferSelect;
type DbLearningInsight = typeof learning_insights.$inferSelect;

/**
 * PostgreSQL database storage implementation
 */
export class DatabaseStorage implements IStorage {
  // Wallet operations
  async createWallet(wallet: InsertWallet): Promise<Wallet> {
    // Don't access wallet.id as it's not in InsertWallet
    const insertData = {
      ...wallet,
      id: uuidv4(),
      balance: wallet.balance.toString()
    };
    
    // Explicitly cast to the db schema expected type
    const [result] = await db.insert(wallets).values([insertData]).returning();
    return this.mapDbWalletToWallet(result);
  }
  
  // Helper method to convert DB result to our type
  private mapDbWalletToWallet(dbWallet: DbWallet): Wallet {
    return {
      id: dbWallet.id,
      name: dbWallet.name,
      address: dbWallet.address,
      created_at: dbWallet.created_at,
      balance: Number(dbWallet.balance)
    };
  }

  async getWallet(id: string): Promise<Wallet | null> {
    const result = await db.select().from(wallets).where(eq(wallets.id, id));
    if (result.length === 0) return null;
    
    return this.mapDbWalletToWallet(result[0]);
  }

  async getWallets(): Promise<Wallet[]> {
    const results = await db.select().from(wallets);
    return results.map(wallet => this.mapDbWalletToWallet(wallet));
  }

  async updateWalletBalance(id: string, balance: number): Promise<Wallet | null> {
    const [result] = await db
      .update(wallets)
      .set({ balance: balance.toString() })
      .where(eq(wallets.id, id))
      .returning();
      
    if (!result) return null;
    
    return this.mapDbWalletToWallet(result);
  }

  // Strategy operations
  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const insertData = {
      ...strategy,
      id: uuidv4()
    };
    
    const [result] = await db.insert(strategies).values([insertData]).returning();
    return this.mapDbStrategyToStrategy(result);
  }
  
  // Helper method to convert DB strategy result to our type
  private mapDbStrategyToStrategy(dbStrategy: DbStrategy): Strategy {
    return {
      id: dbStrategy.id,
      name: dbStrategy.name,
      type: dbStrategy.type as StrategyType,
      pair: dbStrategy.pair,
      active: dbStrategy.active,
      created_at: dbStrategy.created_at,
      updated_at: dbStrategy.updated_at,
      description: dbStrategy.description ?? undefined,
      parameters: dbStrategy.parameters ?? undefined,
      wallet_id: dbStrategy.wallet_id ?? undefined
    };
  }

  async getStrategy(id: string): Promise<Strategy | null> {
    const result = await db.select().from(strategies).where(eq(strategies.id, id));
    if (result.length === 0) return null;
    
    return this.mapDbStrategyToStrategy(result[0]);
  }

  async getStrategies(): Promise<Strategy[]> {
    const results = await db.select().from(strategies);
    return results.map(strategy => this.mapDbStrategyToStrategy(strategy));
  }

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy | null> {
    const [result] = await db
      .update(strategies)
      .set(updates)
      .where(eq(strategies.id, id))
      .returning();
      
    if (!result) return null;
    
    return this.mapDbStrategyToStrategy(result);
  }

  async deleteStrategy(id: string): Promise<boolean> {
    const result = await db
      .delete(strategies)
      .where(eq(strategies.id, id));
    
    return true; // In PostgreSQL with Drizzle, delete doesn't return the count
  }

  // Signal operations
  async createSignal(signal: InsertTradingSignal): Promise<TradingSignal> {
    const insertData = {
      ...signal,
      id: uuidv4(),
      price: signal.price.toString()
    };
    
    const [result] = await db.insert(trading_signals).values([insertData]).returning();
    return this.mapDbSignalToSignal(result);
  }
  
  // Helper method to convert DB signal result to our type
  private mapDbSignalToSignal(dbSignal: DbTradingSignal): TradingSignal {
    return {
      id: dbSignal.id,
      created_at: dbSignal.created_at,
      type: dbSignal.type as SignalType,
      pair: dbSignal.pair,
      strength: dbSignal.strength as SignalStrength,
      price: Number(dbSignal.price),
      strategy_id: dbSignal.strategy_id ?? undefined,
      metadata: dbSignal.metadata ?? undefined,
      expires_at: dbSignal.expires_at ?? undefined
    };
  }

  async getSignal(id: string): Promise<TradingSignal | null> {
    const result = await db.select().from(trading_signals).where(eq(trading_signals.id, id));
    if (result.length === 0) return null;
    
    return this.mapDbSignalToSignal(result[0]);
  }

  async getSignals(): Promise<TradingSignal[]> {
    const results = await db.select().from(trading_signals);
    return results.map(signal => this.mapDbSignalToSignal(signal));
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const insertData = {
      ...transaction,
      id: uuidv4(),
      amount: transaction.amount.toString(),
      price: transaction.price?.toString(),
      fee: transaction.fee?.toString()
    };
    
    const [result] = await db.insert(transactions).values([insertData]).returning();
    return this.mapDbTransactionToTransaction(result);
  }
  
  // Helper method to convert DB transaction result to our type
  private mapDbTransactionToTransaction(dbTransaction: DbTransaction): Transaction {
    return {
      id: dbTransaction.id,
      created_at: dbTransaction.created_at,
      type: dbTransaction.type as TransactionType,
      pair: dbTransaction.pair,
      wallet_id: dbTransaction.wallet_id,
      status: dbTransaction.status as TransactionStatus,
      amount: Number(dbTransaction.amount),
      price: dbTransaction.price ? Number(dbTransaction.price) : undefined,
      strategy_id: dbTransaction.strategy_id ?? undefined,
      metadata: dbTransaction.metadata ?? undefined,
      transaction_hash: dbTransaction.transaction_hash ?? undefined,
      fee: dbTransaction.fee ? Number(dbTransaction.fee) : undefined,
      signal_id: dbTransaction.signal_id ?? undefined,
      confirmed_at: dbTransaction.confirmed_at ?? undefined
    };
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    const result = await db.select().from(transactions).where(eq(transactions.id, id));
    if (result.length === 0) return null;
    
    return this.mapDbTransactionToTransaction(result[0]);
  }

  async getTransactions(): Promise<Transaction[]> {
    const results = await db.select().from(transactions);
    return results.map(tx => this.mapDbTransactionToTransaction(tx));
  }

  async updateTransactionStatus(id: string, status: TransactionStatus): Promise<Transaction | null> {
    const [result] = await db
      .update(transactions)
      .set({ status })
      .where(eq(transactions.id, id))
      .returning();
      
    if (!result) return null;
    
    return this.mapDbTransactionToTransaction(result);
  }

  // Learning Insight operations
  async createLearningInsight(insight: Omit<LearningInsight, 'id' | 'created_at' | 'applied'>): Promise<LearningInsight> {
    const insertData = {
      description: insight.description,
      strategy_id: insight.strategy_id,
      agent_type: insight.agent_type,
      insight_type: insight.insight_type,
      confidence: insight.confidence.toString(),
      recommendation: insight.recommendation,
      applied: false,
      pair: insight.pair ?? null,
      result: insight.result ?? null
    };
    
    const [result] = await db.insert(learning_insights).values(insertData).returning();
    return this.mapDbInsightToLearningInsight(result);
  }
  
  // Helper method to convert DB learning insight result to our type
  private mapDbInsightToLearningInsight(dbInsight: DbLearningInsight): LearningInsight {
    return {
      id: dbInsight.id,
      created_at: dbInsight.created_at,
      description: dbInsight.description,
      strategy_id: dbInsight.strategy_id,
      agent_type: dbInsight.agent_type,
      insight_type: dbInsight.insight_type as InsightType,
      confidence: Number(dbInsight.confidence),
      recommendation: dbInsight.recommendation,
      applied: dbInsight.applied,
      pair: dbInsight.pair ?? undefined,
      result: dbInsight.result as InsightResult
    };
  }

  async getLearningInsight(id: string): Promise<LearningInsight | null> {
    const result = await db.select().from(learning_insights).where(eq(learning_insights.id, id));
    if (result.length === 0) return null;
    
    return this.mapDbInsightToLearningInsight(result[0]);
  }

  async getLearningInsights(): Promise<LearningInsight[]> {
    const results = await db.select().from(learning_insights);
    return results.map(insight => this.mapDbInsightToLearningInsight(insight));
  }

  async getLearningInsightsByAgentType(agentType: string): Promise<LearningInsight[]> {
    const results = await db
      .select()
      .from(learning_insights)
      .where(eq(learning_insights.agent_type, agentType));
      
    return results.map(insight => this.mapDbInsightToLearningInsight(insight));
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
      
    if (!updated) return null;
    
    return this.mapDbInsightToLearningInsight(updated);
  }
}