import { 
  users, 
  type User, 
  type InsertUser, 
  wallets, 
  type Wallet, 
  type InsertWallet, 
  transactions, 
  type Transaction, 
  type InsertTransaction,
  strategies,
  type Strategy,
  type InsertStrategy
} from "@shared/schema";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Wallet management
  getWallet(id: number): Promise<Wallet | undefined>;
  getWalletByAddress(address: string): Promise<Wallet | undefined>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  updateWalletBalance(id: number, newBalance: number): Promise<Wallet | undefined>;

  // Transaction management
  getTransaction(id: number): Promise<Transaction | undefined>;
  getTransactionsByWalletId(walletId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getRecentTransactions(limit: number): Promise<Transaction[]>;
  
  // Strategy management
  getStrategy(id: number): Promise<Strategy | undefined>;
  getActiveStrategies(): Promise<Strategy[]>;
  getStrategiesByUserId(userId: number): Promise<Strategy[]>;
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
  updateStrategyStatus(id: number, isActive: boolean): Promise<Strategy | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private wallets: Map<number, Wallet>;
  private transactionList: Map<number, Transaction>;
  private strategyList: Map<number, Strategy>;
  private currentUserId: number;
  private currentWalletId: number;
  private currentTransactionId: number;
  private currentStrategyId: number;

  constructor() {
    this.users = new Map();
    this.wallets = new Map();
    this.transactionList = new Map();
    this.strategyList = new Map();
    this.currentUserId = 1;
    this.currentWalletId = 1;
    this.currentTransactionId = 1;
    this.currentStrategyId = 1;

    // Initialize with some sample data
    this.initSampleData();
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getWallet(id: number): Promise<Wallet | undefined> {
    return this.wallets.get(id);
  }

  async getWalletByAddress(address: string): Promise<Wallet | undefined> {
    return Array.from(this.wallets.values()).find(
      (wallet) => wallet.address === address,
    );
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const id = this.currentWalletId++;
    const wallet: Wallet = { ...insertWallet, id };
    this.wallets.set(id, wallet);
    return wallet;
  }

  async updateWalletBalance(id: number, newBalance: number): Promise<Wallet | undefined> {
    const wallet = this.wallets.get(id);
    if (wallet) {
      const updatedWallet = { ...wallet, balance: newBalance };
      this.wallets.set(id, updatedWallet);
      return updatedWallet;
    }
    return undefined;
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    return this.transactionList.get(id);
  }

  async getTransactionsByWalletId(walletId: number): Promise<Transaction[]> {
    return Array.from(this.transactionList.values()).filter(
      (transaction) => transaction.walletId === walletId,
    );
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = this.currentTransactionId++;
    const transaction: Transaction = { ...insertTransaction, id };
    this.transactionList.set(id, transaction);
    return transaction;
  }

  async getRecentTransactions(limit: number): Promise<Transaction[]> {
    return Array.from(this.transactionList.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getStrategy(id: number): Promise<Strategy | undefined> {
    return this.strategyList.get(id);
  }

  async getActiveStrategies(): Promise<Strategy[]> {
    return Array.from(this.strategyList.values()).filter(
      (strategy) => strategy.isActive,
    );
  }

  async getStrategiesByUserId(userId: number): Promise<Strategy[]> {
    return Array.from(this.strategyList.values()).filter(
      (strategy) => strategy.userId === userId,
    );
  }

  async createStrategy(insertStrategy: InsertStrategy): Promise<Strategy> {
    const id = this.currentStrategyId++;
    const strategy: Strategy = { ...insertStrategy, id };
    this.strategyList.set(id, strategy);
    return strategy;
  }

  async updateStrategyStatus(id: number, isActive: boolean): Promise<Strategy | undefined> {
    const strategy = this.strategyList.get(id);
    if (strategy) {
      const updatedStrategy = { ...strategy, isActive };
      this.strategyList.set(id, updatedStrategy);
      return updatedStrategy;
    }
    return undefined;
  }

  private initSampleData() {
    // Create a user
    const user: User = {
      id: this.currentUserId++,
      username: 'trader1',
      password: 'password123'
    };
    this.users.set(user.id, user);

    // Create a wallet
    const wallet: Wallet = {
      id: this.currentWalletId++,
      userId: user.id,
      address: '3X4F9H29vQKjyKwARXd7yQyu53PJ8qiLQhH5D1yY8F6F9H2',
      balance: 354.72,
      type: 'MAIN'
    };
    this.wallets.set(wallet.id, wallet);

    // Create some transactions
    const transaction1: Transaction = {
      id: this.currentTransactionId++,
      walletId: wallet.id,
      strategyId: 1,
      type: 'BUY',
      amount: 1.24,
      status: 'COMPLETED',
      profit: 0.06,
      timestamp: new Date(Date.now() - 3600000).toISOString()
    };
    this.transactionList.set(transaction1.id, transaction1);

    const transaction2: Transaction = {
      id: this.currentTransactionId++,
      walletId: wallet.id,
      strategyId: 2,
      type: 'SELL',
      amount: 3.5,
      status: 'COMPLETED',
      profit: 0.12,
      timestamp: new Date(Date.now() - 7200000).toISOString()
    };
    this.transactionList.set(transaction2.id, transaction2);

    const transaction3: Transaction = {
      id: this.currentTransactionId++,
      walletId: wallet.id,
      strategyId: 3,
      type: 'BUY',
      amount: 0.75,
      status: 'PROCESSING',
      profit: null,
      timestamp: new Date(Date.now() - 1800000).toISOString()
    };
    this.transactionList.set(transaction3.id, transaction3);

    const transaction4: Transaction = {
      id: this.currentTransactionId++,
      walletId: wallet.id,
      strategyId: 1,
      type: 'SELL',
      amount: 2.1,
      status: 'COMPLETED',
      profit: -0.03,
      timestamp: new Date(Date.now() - 10800000).toISOString()
    };
    this.transactionList.set(transaction4.id, transaction4);

    // Create strategies
    const strategy1: Strategy = {
      id: this.currentStrategyId++,
      userId: user.id,
      name: 'Alpha-7 Arbitrage',
      description: 'Cross-DEX arbitrage opportunities',
      type: 'ARBITRAGE',
      performance: 3.2,
      isActive: true,
      createdAt: new Date(Date.now() - 864000000).toISOString()
    };
    this.strategyList.set(strategy1.id, strategy1);

    const strategy2: Strategy = {
      id: this.currentStrategyId++,
      userId: user.id,
      name: 'Beta-3 Liquidity',
      description: 'Automated liquidity provision',
      type: 'LIQUIDITY',
      performance: 2.1,
      isActive: true,
      createdAt: new Date(Date.now() - 691200000).toISOString()
    };
    this.strategyList.set(strategy2.id, strategy2);

    const strategy3: Strategy = {
      id: this.currentStrategyId++,
      userId: user.id,
      name: 'Gamma-1 Momentum',
      description: 'Short-term trend following',
      type: 'MOMENTUM',
      performance: -0.8,
      isActive: true,
      createdAt: new Date(Date.now() - 518400000).toISOString()
    };
    this.strategyList.set(strategy3.id, strategy3);
  }
}

export const storage = new MemStorage();
