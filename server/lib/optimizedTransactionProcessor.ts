/**
 * Optimized Transaction Processor
 * 
 * High-performance transaction processor with parallel execution,
 * adaptive priority fees, and memory optimization.
 */

import { Transaction, TransactionSignature, Connection, PublicKey, Keypair } from '@solana/web3.js';
import { logger } from '../../logger';
import { getRpcWorkerPool } from './rpcWorkerPool';
import * as fs from 'fs';
import * as path from 'path';

// Load transaction configuration
let txConfig: any = {
  parallelExecutionLimit: 16,
  priorityFeeTiers: {
    LOW: 5000,
    MEDIUM: 10000,
    HIGH: 100000,
    VERY_HIGH: 500000
  },
  dynamicPriorityFeeEnabled: true,
  precomputePriorityFee: true,
  useLookupTables: true,
  retryPolicy: {
    maxRetries: 5,
    initialBackoffMs: 250,
    maxBackoffMs: 10000,
    backoffMultiplier: 1.5
  }
};

try {
  const configPath = path.join(__dirname, '..', '..', '..', 'data', 'transaction-config.json');
  if (fs.existsSync(configPath)) {
    txConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    logger.info('Loaded transaction configuration from file');
  }
} catch (error) {
  logger.warn(`Failed to load transaction configuration: ${error.message}`);
}

// Transaction priority
export enum TransactionPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH'
}

// Transaction stats
interface TransactionStats {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalRetries: number;
  averageConfirmationTime: number;
  averagePriorityFee: number;
}

// Transaction processor class
export class OptimizedTransactionProcessor {
  private rpcPool = getRpcWorkerPool();
  private stats: TransactionStats = {
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    totalRetries: 0,
    averageConfirmationTime: 0,
    averagePriorityFee: 0
  };
  private activeTransactions = new Map<string, {
    startTime: number;
    retries: number;
    priority: TransactionPriority;
    backoffMs: number;
  }>();
  private isInitialized = false;
  
  constructor(private config = txConfig) {}
  
  /**
   * Initialize the transaction processor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Initialize RPC pool
    await this.rpcPool.initialize();
    
    this.isInitialized = true;
    logger.info('Optimized Transaction Processor initialized');
  }
  
  /**
   * Calculate priority fee based on priority level and network conditions
   */
  calculatePriorityFee(priority: TransactionPriority): number {
    const baseFee = this.config.priorityFeeTiers[priority] || this.config.priorityFeeTiers.MEDIUM;
    
    // TODO: Implement dynamic fee adjustment based on network conditions
    // For now, just return the base fee
    return baseFee;
  }
  
  /**
   * Send a transaction with automatic retries and priority fee calculation
   */
  async sendTransaction(
    transaction: Transaction,
    signers: Keypair[],
    priority: TransactionPriority = TransactionPriority.MEDIUM,
    options: {
      skipPreflight?: boolean;
      maxRetries?: number;
      timeout?: number;
    } = {}
  ): Promise<{ signature: string; success: boolean; error?: string }> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Update stats
    this.stats.totalTransactions++;
    
    // Set default options
    const maxRetries = options.maxRetries || this.config.retryPolicy.maxRetries;
    const timeout = options.timeout || 60000; // 60 seconds
    
    try {
      // Calculate priority fee
      const priorityFee = this.calculatePriorityFee(priority);
      
      // Add priority fee instruction if enabled
      // TODO: Add actual priority fee instruction
      
      // Sign transaction
      transaction.sign(...signers);
      
      // Serialize transaction
      const serializedTransaction = transaction.serialize();
      
      // Track transaction
      const txId = Math.random().toString(36).substring(2, 15);
      this.activeTransactions.set(txId, {
        startTime: Date.now(),
        retries: 0,
        priority,
        backoffMs: this.config.retryPolicy.initialBackoffMs
      });
      
      // Send transaction
      const signature = await this.sendWithRetry(
        serializedTransaction,
        txId,
        maxRetries,
        timeout,
        priority
      );
      
      // Update stats
      this.stats.successfulTransactions++;
      this.activeTransactions.delete(txId);
      
      return { signature, success: true };
    } catch (error) {
      // Update stats
      this.stats.failedTransactions++;
      
      logger.error(`Failed to send transaction: ${error.message}`);
      return { signature: '', success: false, error: error.message };
    }
  }
  
  /**
   * Send transaction with retry logic
   */
  private async sendWithRetry(
    serializedTransaction: Buffer,
    txId: string,
    maxRetries: number,
    timeout: number,
    priority: TransactionPriority
  ): Promise<string> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    // Get transaction tracking info
    const txInfo = this.activeTransactions.get(txId);
    if (!txInfo) {
      throw new Error('Transaction not tracked');
    }
    
    while (txInfo.retries <= maxRetries && Date.now() - startTime < timeout) {
      try {
        // Send transaction with priority based on retry count
        const actualPriority = txInfo.retries > 0 
          ? Math.min(priority + txInfo.retries, TransactionPriority.VERY_HIGH) 
          : priority;
          
        const workerPriority = this.getPriorityValue(actualPriority);
        
        // Send transaction via worker pool
        const signature: string = await this.rpcPool.sendTransaction(serializedTransaction, workerPriority);
        
        // Confirm transaction
        const confirmed = await this.confirmTransaction(signature, actualPriority);
        
        if (confirmed) {
          // Update stats
          const confirmationTime = Date.now() - txInfo.startTime;
          this.updateConfirmationTimeStats(confirmationTime);
          
          return signature;
        }
        
        throw new Error('Transaction not confirmed');
      } catch (error) {
        lastError = error;
        txInfo.retries++;
        this.stats.totalRetries++;
        
        // Exponential backoff
        txInfo.backoffMs = Math.min(
          txInfo.backoffMs * this.config.retryPolicy.backoffMultiplier,
          this.config.retryPolicy.maxBackoffMs
        );
        
        logger.warn(`Transaction retry ${txInfo.retries}/${maxRetries}. Backing off for ${txInfo.backoffMs}ms. Error: ${error.message}`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, txInfo.backoffMs));
      }
    }
    
    throw lastError || new Error('Transaction failed after retries');
  }
  
  /**
   * Confirm a transaction
   */
  private async confirmTransaction(
    signature: string,
    priority: TransactionPriority
  ): Promise<boolean> {
    const workerPriority = this.getPriorityValue(priority);
    
    try {
      return await this.rpcPool.confirmTransaction(signature, workerPriority);
    } catch (error) {
      logger.error(`Failed to confirm transaction ${signature}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Convert priority enum to numeric value
   */
  private getPriorityValue(priority: TransactionPriority): number {
    switch (priority) {
      case TransactionPriority.VERY_HIGH:
        return 3;
      case TransactionPriority.HIGH:
        return 2;
      case TransactionPriority.MEDIUM:
        return 1;
      case TransactionPriority.LOW:
      default:
        return 0;
    }
  }
  
  /**
   * Update confirmation time stats
   */
  private updateConfirmationTimeStats(confirmationTime: number): void {
    const totalConfirmations = this.stats.successfulTransactions;
    
    if (totalConfirmations === 1) {
      this.stats.averageConfirmationTime = confirmationTime;
    } else {
      this.stats.averageConfirmationTime = (
        (this.stats.averageConfirmationTime * (totalConfirmations - 1)) +
        confirmationTime
      ) / totalConfirmations;
    }
  }
  
  /**
   * Get transaction processor stats
   */
  getStats(): TransactionStats {
    return { ...this.stats };
  }
  
  /**
   * Get active transaction count
   */
  getActiveTransactionCount(): number {
    return this.activeTransactions.size;
  }
}

// Export singleton instance
let transactionProcessor: OptimizedTransactionProcessor | null = null;

export function getTransactionProcessor(): OptimizedTransactionProcessor {
  if (!transactionProcessor) {
    transactionProcessor = new OptimizedTransactionProcessor();
  }
  return transactionProcessor;
}