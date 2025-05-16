/**
 * Transaction Queue with Rate Limiting
 * 
 * This module manages a queue of transactions to prevent hitting RPC rate limits.
 */

import { logger } from './logger';

// Transaction queue item interface
export interface QueuedTransaction<T> {
  id: string;
  data: T;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  timestamp: number;
  attempts: number;
  maxAttempts: number;
  execute: () => Promise<any>;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

// Queue configuration
export interface QueueConfig {
  maxConcurrentTasks: number;
  intervalMs: number;
  maxQueueSize: number;
  priorityAgingMs: number;
}

/**
 * Rate-limited transaction queue
 */
export class TransactionQueue {
  private queue: QueuedTransaction<any>[] = [];
  private activeTransactions: Set<string> = new Set();
  private config: QueueConfig;
  private processingInterval: NodeJS.Timeout | null = null;
  private paused: boolean = false;
  
  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxConcurrentTasks: config.maxConcurrentTasks || 2,
      intervalMs: config.intervalMs || 250,
      maxQueueSize: config.maxQueueSize || 100,
      priorityAgingMs: config.priorityAgingMs || 10000 // 10 seconds
    };
    
    this.startProcessing();
  }
  
  /**
   * Add a transaction to the queue
   * @param transaction Transaction to add
   * @returns Promise that resolves when the transaction is executed
   */
  public enqueue<T>(transaction: Omit<QueuedTransaction<T>, 'timestamp' | 'attempts'>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= this.config.maxQueueSize) {
        // If queue is full, reject low priority transactions but accept high priority ones
        if (transaction.priority === 'LOW' || transaction.priority === 'MEDIUM') {
          reject(new Error('Transaction queue is full'));
          return;
        }
      }
      
      const fullTransaction: QueuedTransaction<T> = {
        ...transaction,
        timestamp: Date.now(),
        attempts: 0,
        onSuccess: (result) => {
          resolve(result);
          transaction.onSuccess?.(result);
        },
        onError: (error) => {
          reject(error);
          transaction.onError?.(error);
        }
      };
      
      this.queue.push(fullTransaction);
      this.sortQueue();
      
      logger.debug(`[TransactionQueue] Added transaction ${transaction.id} to queue (priority: ${transaction.priority})`);
    });
  }
  
  /**
   * Start processing transactions
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.processingInterval = setInterval(() => {
      if (this.paused) return;
      this.processNext();
    }, this.config.intervalMs);
    
    logger.info(`[TransactionQueue] Started processing with interval ${this.config.intervalMs}ms`);
  }
  
  /**
   * Process the next transaction in the queue
   */
  private processNext(): void {
    // If we're already at max concurrent tasks, wait
    if (this.activeTransactions.size >= this.config.maxConcurrentTasks) {
      return;
    }
    
    // Sort queue to ensure highest priority items are processed first
    this.sortQueue();
    
    // Get the next transaction
    const transaction = this.queue.shift();
    if (!transaction) {
      return;
    }
    
    // Mark transaction as active
    this.activeTransactions.add(transaction.id);
    
    // Execute the transaction
    logger.debug(`[TransactionQueue] Executing transaction ${transaction.id} (attempt ${transaction.attempts + 1})`);
    
    transaction.execute()
      .then((result) => {
        // Transaction succeeded
        this.activeTransactions.delete(transaction.id);
        transaction.onSuccess?.(result);
        logger.debug(`[TransactionQueue] Transaction ${transaction.id} succeeded`);
      })
      .catch((error) => {
        // Transaction failed
        this.activeTransactions.delete(transaction.id);
        
        // Check if we should retry
        if (transaction.attempts < transaction.maxAttempts) {
          // Retry with backoff
          transaction.attempts += 1;
          const backoffMs = Math.min(500 * Math.pow(2, transaction.attempts), 30000);
          
          logger.debug(`[TransactionQueue] Transaction ${transaction.id} failed, retrying in ${backoffMs}ms (attempt ${transaction.attempts})`);
          
          setTimeout(() => {
            this.queue.push(transaction);
            this.sortQueue();
          }, backoffMs);
        } else {
          // Max attempts reached, call error handler
          transaction.onError?.(error);
          logger.error(`[TransactionQueue] Transaction ${transaction.id} failed after ${transaction.attempts} attempts: ${error.message}`);
        }
      });
  }
  
  /**
   * Sort the queue by priority and timestamp
   */
  private sortQueue(): void {
    // Calculate effective priority including aging
    const now = Date.now();
    this.queue.sort((a, b) => {
      // Map priorities to numeric values
      const priorityMap = {
        'LOW': 0,
        'MEDIUM': 1,
        'HIGH': 2,
        'VERY_HIGH': 3
      };
      
      // Calculate age-based priority boost
      const aAge = now - a.timestamp;
      const bAge = now - b.timestamp;
      
      // Boost priority for older transactions
      const aBoost = Math.floor(aAge / this.config.priorityAgingMs);
      const bBoost = Math.floor(bAge / this.config.priorityAgingMs);
      
      // Calculate effective priorities
      const aPriority = priorityMap[a.priority] + aBoost;
      const bPriority = priorityMap[b.priority] + bBoost;
      
      // Sort by priority (higher first), then by timestamp (older first)
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return a.timestamp - b.timestamp;
    });
  }
  
  /**
   * Pause the queue processing
   */
  public pause(): void {
    this.paused = true;
    logger.info('[TransactionQueue] Paused');
  }
  
  /**
   * Resume the queue processing
   */
  public resume(): void {
    this.paused = false;
    logger.info('[TransactionQueue] Resumed');
  }
  
  /**
   * Stop the queue processing
   */
  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    logger.info('[TransactionQueue] Stopped');
  }
  
  /**
   * Get the current queue length
   */
  public getQueueLength(): number {
    return this.queue.length;
  }
  
  /**
   * Get the number of active transactions
   */
  public getActiveCount(): number {
    return this.activeTransactions.size;
  }
}

// Create a global singleton instance
let globalQueue: TransactionQueue | null = null;

/**
 * Get the global transaction queue instance
 * @param config Optional configuration
 */
export function getTransactionQueue(config?: Partial<QueueConfig>): TransactionQueue {
  if (!globalQueue) {
    globalQueue = new TransactionQueue(config);
  }
  
  return globalQueue;
}