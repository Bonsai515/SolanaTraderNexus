import { 
  conversations, userRequests, walletStates, strategyPreferences, tradeExecutions,
  type Conversation, type UserRequest, type WalletState, type StrategyPreference, type TradeExecution,
  type InsertConversation, type InsertUserRequest, type InsertWalletState, type InsertStrategyPreference, type InsertTradeExecution
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Conversation memory
  getConversation(sessionId: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(sessionId: string, context: any): Promise<void>;
  
  // User requests tracking
  addUserRequest(request: InsertUserRequest): Promise<UserRequest>;
  getUserRequests(sessionId: string): Promise<UserRequest[]>;
  updateRequestStatus(requestId: number, status: string): Promise<void>;
  
  // Wallet state management
  updateWalletState(walletState: InsertWalletState): Promise<WalletState>;
  getWalletState(sessionId: string, walletAddress: string): Promise<WalletState | undefined>;
  
  // Strategy preferences
  saveStrategyPreference(strategy: InsertStrategyPreference): Promise<StrategyPreference>;
  getActiveStrategies(sessionId: string): Promise<StrategyPreference[]>;
  
  // Trade executions
  recordTradeExecution(trade: InsertTradeExecution): Promise<TradeExecution>;
  getTradeHistory(sessionId: string): Promise<TradeExecution[]>;
}

export class DatabaseStorage implements IStorage {
  async getConversation(sessionId: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.sessionId, sessionId));
    return conversation || undefined;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [created] = await db.insert(conversations).values(conversation).returning();
    return created;
  }

  async updateConversation(sessionId: string, context: any): Promise<void> {
    await db.update(conversations)
      .set({ context, updatedAt: new Date() })
      .where(eq(conversations.sessionId, sessionId));
  }

  async addUserRequest(request: InsertUserRequest): Promise<UserRequest> {
    const [created] = await db.insert(userRequests).values(request).returning();
    return created;
  }

  async getUserRequests(sessionId: string): Promise<UserRequest[]> {
    return await db.select().from(userRequests)
      .where(eq(userRequests.sessionId, sessionId))
      .orderBy(desc(userRequests.createdAt));
  }

  async updateRequestStatus(requestId: number, status: string): Promise<void> {
    await db.update(userRequests)
      .set({ status })
      .where(eq(userRequests.id, requestId));
  }

  async updateWalletState(walletState: InsertWalletState): Promise<WalletState> {
    const existing = await this.getWalletState(walletState.sessionId, walletState.walletAddress);
    
    if (existing) {
      const [updated] = await db.update(walletStates)
        .set({ ...walletState, lastUpdated: new Date() })
        .where(eq(walletStates.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(walletStates).values(walletState).returning();
      return created;
    }
  }

  async getWalletState(sessionId: string, walletAddress: string): Promise<WalletState | undefined> {
    const [wallet] = await db.select().from(walletStates)
      .where(eq(walletStates.sessionId, sessionId))
      .where(eq(walletStates.walletAddress, walletAddress))
      .orderBy(desc(walletStates.lastUpdated));
    return wallet || undefined;
  }

  async saveStrategyPreference(strategy: InsertStrategyPreference): Promise<StrategyPreference> {
    const [created] = await db.insert(strategyPreferences).values(strategy).returning();
    return created;
  }

  async getActiveStrategies(sessionId: string): Promise<StrategyPreference[]> {
    return await db.select().from(strategyPreferences)
      .where(eq(strategyPreferences.sessionId, sessionId))
      .where(eq(strategyPreferences.isActive, true))
      .orderBy(desc(strategyPreferences.createdAt));
  }

  async recordTradeExecution(trade: InsertTradeExecution): Promise<TradeExecution> {
    const [created] = await db.insert(tradeExecutions).values(trade).returning();
    return created;
  }

  async getTradeHistory(sessionId: string): Promise<TradeExecution[]> {
    return await db.select().from(tradeExecutions)
      .where(eq(tradeExecutions.sessionId, sessionId))
      .orderBy(desc(tradeExecutions.executedAt));
  }
}

export const storage = new DatabaseStorage();