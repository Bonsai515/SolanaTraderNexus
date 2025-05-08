import { Strategy, Wallet, TradingSignal, Transaction } from '../shared/schema';

/**
 * In-memory storage interface for the Solana Trading Platform
 */
export interface IStorage {
  // Wallet operations
  createWallet(wallet: Wallet): Promise<Wallet>;
  getWallet(id: string): Promise<Wallet | null>;
  getWallets(): Promise<Wallet[]>;
  updateWalletBalance(id: string, balance: number): Promise<Wallet | null>;
  
  // Strategy operations
  createStrategy(strategy: Strategy): Promise<Strategy>;
  getStrategy(id: string): Promise<Strategy | null>;
  getStrategies(): Promise<Strategy[]>;
  updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy | null>;
  deleteStrategy(id: string): Promise<boolean>;
  
  // Signal operations
  createSignal(signal: TradingSignal): Promise<TradingSignal>;
  getSignal(id: string): Promise<TradingSignal | null>;
  getSignals(): Promise<TradingSignal[]>;
  
  // Transaction operations
  createTransaction(transaction: Transaction): Promise<Transaction>;
  getTransaction(id: string): Promise<Transaction | null>;
  getTransactions(): Promise<Transaction[]>;
  updateTransactionStatus(id: string, status: string): Promise<Transaction | null>;
}

/**
 * In-memory storage implementation
 */
class MemStorage implements IStorage {
  private wallets: Map<string, Wallet> = new Map();
  private strategies: Map<string, Strategy> = new Map();
  private signals: Map<string, TradingSignal> = new Map();
  private transactions: Map<string, Transaction> = new Map();

  // Wallet operations
  async createWallet(wallet: Wallet): Promise<Wallet> {
    this.wallets.set(wallet.id, wallet);
    return wallet;
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
  async createStrategy(strategy: Strategy): Promise<Strategy> {
    this.strategies.set(strategy.id, strategy);
    return strategy;
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
    
    const updated = { ...strategy, ...updates };
    this.strategies.set(id, updated);
    return updated;
  }

  async deleteStrategy(id: string): Promise<boolean> {
    return this.strategies.delete(id);
  }

  // Signal operations
  async createSignal(signal: TradingSignal): Promise<TradingSignal> {
    this.signals.set(signal.id, signal);
    return signal;
  }

  async getSignal(id: string): Promise<TradingSignal | null> {
    return this.signals.get(id) || null;
  }

  async getSignals(): Promise<TradingSignal[]> {
    return Array.from(this.signals.values());
  }

  // Transaction operations
  async createTransaction(transaction: Transaction): Promise<Transaction> {
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    return this.transactions.get(id) || null;
  }

  async getTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values());
  }

  async updateTransactionStatus(id: string, status: string): Promise<Transaction | null> {
    const transaction = this.transactions.get(id);
    if (!transaction) return null;
    
    const updated = { ...transaction, status };
    this.transactions.set(id, updated);
    return updated;
  }
}

// Create and export storage instance
const storage = new MemStorage();
export default storage;