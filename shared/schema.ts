import { pgTable, text, serial, integer, boolean, timestamp, real, varchar, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Wallets table
export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  address: text("address").notNull().unique(),
  balance: real("balance").notNull().default(0),
  type: varchar("type", { length: 20 }).notNull().default("MAIN"),
});

export const insertWalletSchema = createInsertSchema(wallets).pick({
  userId: true,
  address: true,
  balance: true,
  type: true,
});

export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof wallets.$inferSelect;

// Transactions table
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull().references(() => wallets.id),
  strategyId: integer("strategy_id").references(() => strategies.id),
  type: varchar("type", { length: 20 }).notNull(), // BUY, SELL, DEPOSIT, WITHDRAW, TRANSFER
  amount: real("amount").notNull(),
  status: varchar("status", { length: 20 }).notNull(), // PENDING, PROCESSING, COMPLETED, FAILED
  profit: real("profit"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  walletId: true,
  strategyId: true,
  type: true,
  amount: true,
  status: true,
  profit: true,
  timestamp: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// Strategies table
export const strategies = pgTable("strategies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 20 }).notNull(), // ARBITRAGE, MOMENTUM, LIQUIDITY
  performance: real("performance").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStrategySchema = createInsertSchema(strategies).pick({
  userId: true,
  name: true,
  description: true,
  type: true,
  performance: true,
  isActive: true,
  createdAt: true,
});

export type InsertStrategy = z.infer<typeof insertStrategySchema>;
export type Strategy = typeof strategies.$inferSelect;
