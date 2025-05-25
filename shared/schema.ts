import { pgTable, text, integer, timestamp, decimal, jsonb, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// Conversation memory for tracking user requests and context
export const conversations = pgTable('conversations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sessionId: text('session_id').notNull().unique(),
  userId: text('user_id').notNull(),
  context: jsonb('context').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Track user requests and preferences
export const userRequests = pgTable('user_requests', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sessionId: text('session_id').notNull(),
  requestType: text('request_type').notNull(), // 'flash_loan', 'arbitrage', 'yield_strategy', etc.
  requestData: jsonb('request_data').notNull(),
  status: text('status').notNull().default('pending'), // 'pending', 'completed', 'failed'
  priority: integer('priority').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Wallet states and balances
export const walletStates = pgTable('wallet_states', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sessionId: text('session_id').notNull(),
  walletAddress: text('wallet_address').notNull(),
  solBalance: decimal('sol_balance', { precision: 18, scale: 9 }),
  msolBalance: decimal('msol_balance', { precision: 18, scale: 9 }),
  totalValue: decimal('total_value', { precision: 18, scale: 9 }),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

// Strategy preferences and history
export const strategyPreferences = pgTable('strategy_preferences', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sessionId: text('session_id').notNull(),
  strategyType: text('strategy_type').notNull(),
  targetProfit: decimal('target_profit', { precision: 18, scale: 9 }),
  riskLevel: text('risk_level').notNull(), // 'LOW', 'MEDIUM', 'HIGH'
  protocols: jsonb('protocols').notNull(), // ['MarginFi', 'Solend', 'Marinade']
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Executed trades and results
export const tradeExecutions = pgTable('trade_executions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sessionId: text('session_id').notNull(),
  tradeType: text('trade_type').notNull(),
  inputAmount: decimal('input_amount', { precision: 18, scale: 9 }),
  outputAmount: decimal('output_amount', { precision: 18, scale: 9 }),
  profit: decimal('profit', { precision: 18, scale: 9 }),
  signature: text('signature'),
  status: text('status').notNull(), // 'pending', 'confirmed', 'failed'
  executedAt: timestamp('executed_at').defaultNow().notNull(),
});

// Relations
export const conversationRelations = relations(conversations, ({ many }) => ({
  requests: many(userRequests),
  walletStates: many(walletStates),
  strategies: many(strategyPreferences),
  trades: many(tradeExecutions),
}));

export const userRequestRelations = relations(userRequests, ({ one }) => ({
  conversation: one(conversations, {
    fields: [userRequests.sessionId],
    references: [conversations.sessionId],
  }),
}));

export const walletStateRelations = relations(walletStates, ({ one }) => ({
  conversation: one(conversations, {
    fields: [walletStates.sessionId],
    references: [conversations.sessionId],
  }),
}));

export const strategyPreferenceRelations = relations(strategyPreferences, ({ one }) => ({
  conversation: one(conversations, {
    fields: [strategyPreferences.sessionId],
    references: [conversations.sessionId],
  }),
}));

export const tradeExecutionRelations = relations(tradeExecutions, ({ one }) => ({
  conversation: one(conversations, {
    fields: [tradeExecutions.sessionId],
    references: [conversations.sessionId],
  }),
}));

// Zod schemas for validation
export const insertConversationSchema = createInsertSchema(conversations);
export const insertUserRequestSchema = createInsertSchema(userRequests);
export const insertWalletStateSchema = createInsertSchema(walletStates);
export const insertStrategyPreferenceSchema = createInsertSchema(strategyPreferences);
export const insertTradeExecutionSchema = createInsertSchema(tradeExecutions);

// Types
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type UserRequest = typeof userRequests.$inferSelect;
export type InsertUserRequest = z.infer<typeof insertUserRequestSchema>;
export type WalletState = typeof walletStates.$inferSelect;
export type InsertWalletState = z.infer<typeof insertWalletStateSchema>;
export type StrategyPreference = typeof strategyPreferences.$inferSelect;
export type InsertStrategyPreference = z.infer<typeof insertStrategyPreferenceSchema>;
export type TradeExecution = typeof tradeExecutions.$inferSelect;
export type InsertTradeExecution = z.infer<typeof insertTradeExecutionSchema>;