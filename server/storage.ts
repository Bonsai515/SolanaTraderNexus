import { 
  Strategy, Wallet, TradingSignal, Transaction, LearningInsight,
  InsertWallet, InsertStrategy, InsertTradingSignal, InsertTransaction,
  InsightResult, StrategyType, SignalType, SignalStrength, TransactionType, TransactionStatus, InsightType
} from '../shared/schema';
import { DatabaseStorage } from './database-storage';
import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory storage interface for the Solana Trading Platform
 */
export interface IStorage {
  // Wallet operations
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  getWallet(id: string): Promise<Wallet | null>;
  getWallets(): Promise<Wallet[]>;
  updateWalletBalance(id: string, balance: number): Promise<Wallet | null>;
  
  // Strategy operations
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
  getStrategy(id: string): Promise<Strategy | null>;
  getStrategies(): Promise<Strategy[]>;
  updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy | null>;
  deleteStrategy(id: string): Promise<boolean>;
  
  // Signal operations
  createSignal(signal: InsertTradingSignal): Promise<TradingSignal>;
  getSignal(id: string): Promise<TradingSignal | null>;
  getSignals(): Promise<TradingSignal[]>;
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransaction(id: string): Promise<Transaction | null>;
  getTransactions(): Promise<Transaction[]>;
  updateTransactionStatus(id: string, status: TransactionStatus): Promise<Transaction | null>;
  
  // Learning Insight operations
  createLearningInsight(insight: Omit<LearningInsight, 'id' | 'created_at' | 'applied'>): Promise<LearningInsight>;
  getLearningInsight(id: string): Promise<LearningInsight | null>;
  getLearningInsights(): Promise<LearningInsight[]>;
  getLearningInsightsByAgentType(agentType: string): Promise<LearningInsight[]>;
  applyLearningInsight(id: string, result: {
    success: boolean;
    performance_delta: number;
    notes: string;
  }): Promise<LearningInsight | null>;
}

/**
 * In-memory storage implementation
 */
class MemStorage implements IStorage {
  private wallets: Map<string, Wallet> = new Map();
  private strategies: Map<string, Strategy> = new Map();
  private signals: Map<string, TradingSignal> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private insights: Map<string, LearningInsight> = new Map();

  // Wallet operations
  async createWallet(wallet: InsertWallet): Promise<Wallet> {
    const newWallet: Wallet = {
      id: uuidv4(),
      name: wallet.name,
      address: wallet.address,
      balance: wallet.balance,
      created_at: new Date()
    };
    this.wallets.set(newWallet.id, newWallet);
    return newWallet;
  }

  async getWallet(id: string): Promise<Wallet | null> {
    return this.wallets.get(id) || null;
  }

  async getWallets(): Promise<Wallet[]> {
    return Array.from(this.wallets.values());
  }

  async updateWalletBalance(id: string, balance: number): Promise<Wallet | null> {
    const wallet = this.wallets.get(id);
    if (!wallet) return null;
    
    const updated = { ...wallet, balance };
    this.wallets.set(id, updated);
    return updated;
  }

  // Strategy operations
  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const newStrategy: Strategy = {
      id: uuidv4(),
      name: strategy.name,
      type: strategy.type,
      pair: strategy.pair,
      active: strategy.active,
      description: strategy.description,
      parameters: strategy.parameters,
      wallet_id: strategy.wallet_id,
      created_at: new Date(),
      updated_at: new Date()
    };
    this.strategies.set(newStrategy.id, newStrategy);
    return newStrategy;
  }

  async getStrategy(id: string): Promise<Strategy | null> {
    return this.strategies.get(id) || null;
  }

  async getStrategies(): Promise<Strategy[]> {
    return Array.from(this.strategies.values());
  }

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy | null> {
    const strategy = this.strategies.get(id);
    if (!strategy) return null;
    
    const updated = { 
      ...strategy, 
      ...updates,
      updated_at: new Date()
    };
    this.strategies.set(id, updated);
    return updated;
  }

  async deleteStrategy(id: string): Promise<boolean> {
    return this.strategies.delete(id);
  }

  // Signal operations
  async createSignal(signal: InsertTradingSignal): Promise<TradingSignal> {
    const newSignal: TradingSignal = {
      id: uuidv4(),
      type: signal.type,
      pair: signal.pair,
      strength: signal.strength,
      price: signal.price,
      strategy_id: signal.strategy_id,
      metadata: signal.metadata,
      expires_at: signal.expires_at,
      created_at: new Date()
    };
    this.signals.set(newSignal.id, newSignal);
    return newSignal;
  }

  async getSignal(id: string): Promise<TradingSignal | null> {
    return this.signals.get(id) || null;
  }

  async getSignals(): Promise<TradingSignal[]> {
    return Array.from(this.signals.values());
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const newTransaction: Transaction = {
      id: uuidv4(),
      type: transaction.type,
      status: transaction.status,
      pair: transaction.pair,
      wallet_id: transaction.wallet_id,
      amount: transaction.amount,
      price: transaction.price,
      strategy_id: transaction.strategy_id,
      metadata: transaction.metadata,
      transaction_hash: transaction.transaction_hash,
      fee: transaction.fee,
      signal_id: transaction.signal_id,
      created_at: new Date(),
      confirmed_at: undefined
    };
    this.transactions.set(newTransaction.id, newTransaction);
    return newTransaction;
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    return this.transactions.get(id) || null;
  }

  async getTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values());
  }

  async updateTransactionStatus(id: string, status: TransactionStatus): Promise<Transaction | null> {
    const transaction = this.transactions.get(id);
    if (!transaction) return null;
    
    const updated = { ...transaction, status };
    this.transactions.set(id, updated);
    return updated;
  }

  // Learning Insight operations
  async createLearningInsight(insight: Omit<LearningInsight, 'id' | 'created_at' | 'applied'>): Promise<LearningInsight> {
    const newInsight: LearningInsight = {
      id: uuidv4(),
      description: insight.description,
      strategy_id: insight.strategy_id,
      agent_type: insight.agent_type,
      insight_type: insight.insight_type,
      confidence: insight.confidence,
      recommendation: insight.recommendation,
      pair: insight.pair,
      result: insight.result,
      applied: false,
      created_at: new Date()
    };
    
    this.insights.set(newInsight.id, newInsight);
    return newInsight;
  }

  async getLearningInsight(id: string): Promise<LearningInsight | null> {
    return this.insights.get(id) || null;
  }

  async getLearningInsights(): Promise<LearningInsight[]> {
    return Array.from(this.insights.values());
  }

  async getLearningInsightsByAgentType(agentType: string): Promise<LearningInsight[]> {
    return Array.from(this.insights.values()).filter(
      insight => insight.agent_type === agentType
    );
  }

  async applyLearningInsight(id: string, result: {
    success: boolean;
    performance_delta: number;
    notes: string;
  }): Promise<LearningInsight | null> {
    const insight = this.insights.get(id);
    if (!insight) return null;
    
    const updated: LearningInsight = {
      ...insight,
      applied: true,
      result: result as InsightResult
    };
    
    this.insights.set(id, updated);
    return updated;
  }
}

// Implementation classes
export { MemStorage };
export { DatabaseStorage };

// Create and export storage instance
const storage = new DatabaseStorage();
export default storage;