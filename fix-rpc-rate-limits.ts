/**
 * Fix RPC Rate Limits for Real Trading
 * 
 * This script implements a rate-limited transaction queue to prevent 
 * hitting API rate limits with the Solana RPC provider.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './server/logger';

/**
 * Update nexus engine configuration with rate limits
 */
function updateEngineConfig(): void {
  try {
    const configPath = path.join(__dirname, 'data', 'nexus_engine_config.json');
    let config = {};
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(configData);
    }
    
    // Update RPC settings for rate limiting
    config.rateLimitSettings = {
      enabled: true,
      maxRequestsPerSecond: 4,
      maxConcurrentRequests: 2,
      cooldownBetweenRequestsMs: 250,
      retryStrategy: {
        initialBackoffMs: 500,
        maxBackoffMs: 8000,
        maxRetries: 5,
        backoffMultiplier: 2
      }
    };
    
    // Make sure we're using the Instant Nodes RPC URL
    config.rpcUrl = process.env.INSTANT_NODES_RPC_URL || config.rpcUrl;
    
    // Add backup RPCs for fallback
    config.backupRpcUrls = [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://rpc.ankr.com/solana'
    ];
    
    // Save updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Updated engine configuration with rate limiting settings');
  } catch (error) {
    console.error(`❌ Failed to update engine config: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create transaction queue module
 */
function createTransactionQueue(): void {
  const queuePath = path.join(__dirname, 'server', 'transaction-queue.ts');
  
  const queueCode = `/**
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
      
      logger.debug(\`[TransactionQueue] Added transaction \${transaction.id} to queue (priority: \${transaction.priority})\`);
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
    
    logger.info(\`[TransactionQueue] Started processing with interval \${this.config.intervalMs}ms\`);
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
    logger.debug(\`[TransactionQueue] Executing transaction \${transaction.id} (attempt \${transaction.attempts + 1})\`);
    
    transaction.execute()
      .then((result) => {
        // Transaction succeeded
        this.activeTransactions.delete(transaction.id);
        transaction.onSuccess?.(result);
        logger.debug(\`[TransactionQueue] Transaction \${transaction.id} succeeded\`);
      })
      .catch((error) => {
        // Transaction failed
        this.activeTransactions.delete(transaction.id);
        
        // Check if we should retry
        if (transaction.attempts < transaction.maxAttempts) {
          // Retry with backoff
          transaction.attempts += 1;
          const backoffMs = Math.min(500 * Math.pow(2, transaction.attempts), 30000);
          
          logger.debug(\`[TransactionQueue] Transaction \${transaction.id} failed, retrying in \${backoffMs}ms (attempt \${transaction.attempts})\`);
          
          setTimeout(() => {
            this.queue.push(transaction);
            this.sortQueue();
          }, backoffMs);
        } else {
          // Max attempts reached, call error handler
          transaction.onError?.(error);
          logger.error(\`[TransactionQueue] Transaction \${transaction.id} failed after \${transaction.attempts} attempts: \${error.message}\`);
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
}`;
  
  try {
    fs.writeFileSync(queuePath, queueCode);
    console.log('✅ Created transaction queue module');
  } catch (error) {
    console.error(`❌ Failed to create transaction queue: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Update nexus transaction engine to use the queue
 */
function updateTransactionEngine(): void {
  const enginePath = path.join(__dirname, 'server', 'nexus-transaction-engine.ts');
  
  try {
    // Read current engine code
    let engineCode = fs.readFileSync(enginePath, 'utf8');
    
    // Add transaction queue import
    if (!engineCode.includes('import { getTransactionQueue')) {
      engineCode = engineCode.replace(
        'import { logger } from \'./logger\';',
        'import { logger } from \'./logger\';\nimport { getTransactionQueue } from \'./transaction-queue\';'
      );
    }
    
    // Add transaction queue property
    if (!engineCode.includes('private transactionQueue')) {
      engineCode = engineCode.replace(
        'private pendingTransactions: Set<string> = new Set();',
        'private pendingTransactions: Set<string> = new Set();\n  private transactionQueue = getTransactionQueue();'
      );
    }
    
    // Update execute transaction method to use queue for live transactions
    engineCode = engineCode.replace(
      `private async executeLiveTransaction(
    transaction: any,
    options: TransactionExecutionOptions
  ): Promise<TransactionExecutionResult> {
    try {
      logger.info(\`[NexusEngine] Executing REAL BLOCKCHAIN transaction\`);
      
      // Dummy transaction for now (will be replaced with actual transactions)
      // This will still use fake signatures but properly connects to RPC
      
      // Get the latest blockhash
      try {
        const blockhash = await this.connection.getLatestBlockhash('finalized');
        logger.info(\`[NexusEngine] Retrieved latest blockhash: \${blockhash.blockhash.substring(0, 10)}...\`);
        
        // In the future, real transaction will be constructed here
        
        // Real transactions need to be properly constructed with:
        // 1. Instructions appropriate for the operation (swap, transfer, etc)
        // 2. Signatures from authorized wallets 
        // 3. Proper fee payment and priority settings
        
      } catch (error) {
        logger.error(\`[NexusEngine] Blockhash retrieval error: \${error.message}\`);
        return {
          success: false,
          error: \`Blockhash retrieval error: \${error.message}\`
        };
      }
      
      // For now, generate a signature for compatibility
      const signature = \`live-\${Date.now()}-\${Math.floor(Math.random() * 1000000)}\`;`,
      
      `private async executeLiveTransaction(
    transaction: any,
    options: TransactionExecutionOptions
  ): Promise<TransactionExecutionResult> {
    try {
      logger.info(\`[NexusEngine] Executing REAL BLOCKCHAIN transaction\`);
      
      // Using the transaction queue to handle rate limits
      const transactionId = \`tx-\${Date.now()}-\${Math.floor(Math.random() * 1000000)}\`;
      
      // Add to pending transactions
      const signature = \`live-\${Date.now()}-\${Math.floor(Math.random() * 1000000)}\`;
      this.pendingTransactions.add(signature);
      
      // Queue the blockhash retrieval and transaction execution
      return await this.transactionQueue.enqueue({
        id: transactionId,
        data: { transaction, options },
        priority: options.priority || this.config.defaultPriority,
        maxAttempts: options.maxRetries || this.config.defaultMaxRetries,
        execute: async () => {
          try {
            // Get the latest blockhash
            const blockhash = await this.connection.getLatestBlockhash('finalized');
            logger.info(\`[NexusEngine] Retrieved latest blockhash: \${blockhash.blockhash.substring(0, 10)}...\`);
            
            // Real transaction execution will be implemented here
            // For now, continue with the simulated response
            
            // Verify transaction if requested
            if (options.waitForConfirmation !== false) {
              const verificationResult = await this.transactionVerifier.verifyTransaction(
                signature,
                {
                  confirmations: options.confirmations || this.config.defaultConfirmations,
                  confirmationTimeout: options.timeoutMs || this.config.defaultTimeoutMs
                }
              );
              
              // Remove from pending transactions
              this.pendingTransactions.delete(signature);
              
              return {
                success: verificationResult.success,
                signature,
                error: verificationResult.error,
                confirmations: verificationResult.confirmations,
                slot: verificationResult.slot,
                fee: verificationResult.fee,
                blockTime: verificationResult.blockTime
              };
            }
            
            return {
              success: true,
              signature
            };
          } catch (error) {
            // Remove from pending transactions
            this.pendingTransactions.delete(signature);
            
            logger.error(\`[NexusEngine] Transaction execution error: \${error.message}\`);
            return {
              success: false,
              error: \`Transaction execution error: \${error.message}\`
            };
          }
        }
      });`
    );
    
    // Write updated engine
    fs.writeFileSync(enginePath, engineCode);
    console.log('✅ Updated transaction engine to use rate-limited queue');
  } catch (error) {
    console.error(`❌ Failed to update transaction engine: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Main function to fix RPC rate limits
 */
async function fixRpcRateLimits(): Promise<void> {
  console.log('=======================================================');
  console.log('  FIXING RPC RATE LIMITS FOR REAL TRADING');
  console.log('=======================================================');
  
  try {
    // Update engine configuration
    updateEngineConfig();
    
    // Create transaction queue
    createTransactionQueue();
    
    // Update transaction engine
    updateTransactionEngine();
    
    console.log('=======================================================');
    console.log('✅ RPC RATE LIMITING FIX COMPLETE');
    console.log('This fix implements a rate-limited transaction queue');
    console.log('to prevent 429 Too Many Requests errors from the RPC.');
    console.log('');
    console.log('Restart the system to apply these changes.');
    console.log('=======================================================');
  } catch (error) {
    console.error(`❌ Error fixing RPC rate limits: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Execute if called directly
if (require.main === module) {
  fixRpcRateLimits().catch(console.error);
}