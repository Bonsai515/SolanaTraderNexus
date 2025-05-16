/**
 * Transaction Logs Management
 * 
 * This module provides functions for managing transaction logs,
 * including resetting all logs to zero and verifying transactions
 * with Solscan.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger';
import { verifySolscanTransaction } from './verification';
import { Connection, PublicKey } from '@solana/web3.js';

// Path to transaction logs directory
const LOGS_DIR = path.join(__dirname, '../../logs');
const TRANSACTION_LOGS_FILE = path.join(LOGS_DIR, 'transactions.json');
const PROFIT_LOGS_FILE = path.join(LOGS_DIR, 'profit.json');
const WALLET_LOGS_FILE = path.join(LOGS_DIR, 'wallets.json');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Transaction interface
interface Transaction {
  signature: string;
  type: string;
  timestamp: string;
  verified: boolean;
  wallet?: string;
  amount?: number;
  token?: string;
  fromToken?: string;
  toToken?: string;
  profit?: number;
}

// Wallet interface
interface Wallet {
  address: string;
  balance: number;
  lastUpdated: string;
}

// Profit interface
interface Profit {
  total: number;
  transactions: {
    signature: string;
    amount: number;
    timestamp: string;
  }[];
}

// Initialize empty transaction logs if they don't exist
if (!fs.existsSync(TRANSACTION_LOGS_FILE)) {
  fs.writeFileSync(TRANSACTION_LOGS_FILE, JSON.stringify([], null, 2));
}

// Initialize empty profit logs if they don't exist
if (!fs.existsSync(PROFIT_LOGS_FILE)) {
  fs.writeFileSync(PROFIT_LOGS_FILE, JSON.stringify({
    total: 0,
    transactions: []
  }, null, 2));
}

// Initialize empty wallet logs if they don't exist
if (!fs.existsSync(WALLET_LOGS_FILE)) {
  fs.writeFileSync(WALLET_LOGS_FILE, JSON.stringify([], null, 2));
}

/**
 * Get all transaction logs
 */
export function getTransactionLogs(): Transaction[] {
  try {
    const data = fs.readFileSync(TRANSACTION_LOGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error: any) {
    logger.error('Failed to read transaction logs:', error.message);
    return [];
  }
}

/**
 * Add transaction to logs
 */
export function addTransactionLog(transaction: Transaction): void {
  try {
    const logs = getTransactionLogs();
    logs.push(transaction);
    fs.writeFileSync(TRANSACTION_LOGS_FILE, JSON.stringify(logs, null, 2));
  } catch (error: any) {
    logger.error('Failed to add transaction log:', error.message);
  }
}

/**
 * Get profit logs
 */
export function getProfitLogs(): Profit {
  try {
    const data = fs.readFileSync(PROFIT_LOGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error: any) {
    logger.error('Failed to read profit logs:', error.message);
    return {
      total: 0,
      transactions: []
    };
  }
}

/**
 * Add profit to logs
 */
export function addProfitLog(signature: string, amount: number): void {
  try {
    const profit = getProfitLogs();
    profit.total += amount;
    profit.transactions.push({
      signature,
      amount,
      timestamp: new Date().toISOString()
    });
    fs.writeFileSync(PROFIT_LOGS_FILE, JSON.stringify(profit, null, 2));
  } catch (error: any) {
    logger.error('Failed to add profit log:', error.message);
  }
}

/**
 * Get wallet logs
 */
export function getWalletLogs(): Wallet[] {
  try {
    const data = fs.readFileSync(WALLET_LOGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error: any) {
    logger.error('Failed to read wallet logs:', error.message);
    return [];
  }
}

/**
 * Update wallet balance in logs
 */
export function updateWalletLog(address: string, balance: number): void {
  try {
    const wallets = getWalletLogs();
    const existingWallet = wallets.find(w => w.address === address);
    
    if (existingWallet) {
      existingWallet.balance = balance;
      existingWallet.lastUpdated = new Date().toISOString();
    } else {
      wallets.push({
        address,
        balance,
        lastUpdated: new Date().toISOString()
      });
    }
    
    fs.writeFileSync(WALLET_LOGS_FILE, JSON.stringify(wallets, null, 2));
  } catch (error: any) {
    logger.error('Failed to update wallet log:', error.message);
  }
}

/**
 * Reset all transaction logs to zero
 */
export function resetTransactionLogs(): boolean {
  try {
    logger.info('Resetting all transaction logs to zero');
    
    // Reset transaction logs
    fs.writeFileSync(TRANSACTION_LOGS_FILE, JSON.stringify([], null, 2));
    
    // Reset profit logs
    fs.writeFileSync(PROFIT_LOGS_FILE, JSON.stringify({
      total: 0,
      transactions: []
    }, null, 2));
    
    // Keep wallet logs but reset balances
    const wallets = getWalletLogs();
    const resetWallets = wallets.map(wallet => ({
      ...wallet,
      balance: 0,
      lastUpdated: new Date().toISOString()
    }));
    fs.writeFileSync(WALLET_LOGS_FILE, JSON.stringify(resetWallets, null, 2));
    
    logger.info('All transaction logs reset successfully');
    
    return true;
  } catch (error: any) {
    logger.error('Failed to reset transaction logs:', error.message);
    return false;
  }
}

/**
 * Verify transaction with Solscan
 */
export async function verifyTransaction(signature: string): Promise<boolean> {
  return await verifySolscanTransaction(signature);
}

/**
 * Verify wallet balance with Solana blockchain
 */
export async function verifyWalletBalance(
  address: string,
  connection: Connection
): Promise<number> {
  try {
    const pubkey = new PublicKey(address);
    const balance = await connection.getBalance(pubkey);
    const balanceSol = balance / 1e9; // Convert lamports to SOL
    
    // Update wallet log
    updateWalletLog(address, balanceSol);
    
    return balanceSol;
  } catch (error: any) {
    logger.error(`Failed to verify wallet balance for ${address}:`, error.message);
    throw error;
  }
}

/**
 * Verify all transactions in logs with Solscan
 */
export async function verifyAllTransactions(): Promise<{
  verified: number;
  total: number;
}> {
  try {
    const transactions = getTransactionLogs();
    let verified = 0;
    
    for (const transaction of transactions) {
      const isVerified = await verifyTransaction(transaction.signature);
      if (isVerified) {
        verified++;
        transaction.verified = true;
      }
    }
    
    // Update transaction logs with verification results
    fs.writeFileSync(TRANSACTION_LOGS_FILE, JSON.stringify(transactions, null, 2));
    
    return {
      verified,
      total: transactions.length
    };
  } catch (error: any) {
    logger.error('Failed to verify all transactions:', error.message);
    return {
      verified: 0,
      total: 0
    };
  }
}

/**
 * Get transaction statistics
 */
export function getTransactionStats(): {
  total: number;
  verified: number;
  profit: number;
  byType: Record<string, number>;
} {
  try {
    const transactions = getTransactionLogs();
    const profit = getProfitLogs();
    
    const byType: Record<string, number> = {};
    let verified = 0;
    
    for (const transaction of transactions) {
      if (transaction.verified) {
        verified++;
      }
      
      if (byType[transaction.type]) {
        byType[transaction.type]++;
      } else {
        byType[transaction.type] = 1;
      }
    }
    
    return {
      total: transactions.length,
      verified,
      profit: profit.total,
      byType
    };
  } catch (error: any) {
    logger.error('Failed to get transaction statistics:', error.message);
    return {
      total: 0,
      verified: 0,
      profit: 0,
      byType: {}
    };
  }
}