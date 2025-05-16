/**
 * Batch Transaction Processor
 * 
 * Enables efficient processing of multiple similar transactions
 * by batching them together to reduce RPC load and improve throughput.
 */

import { logger } from '../logger';
import { getConnection } from './rpcManager';
import { Transaction, Connection, TransactionInstruction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';

// Types of operations that can be batched
export enum BatchOperationType {
  TOKEN_TRANSFER = 'TOKEN_TRANSFER',
  SOL_TRANSFER = 'SOL_TRANSFER',
  TOKEN_SWAP = 'TOKEN_SWAP',
  NFT_TRANSFER = 'NFT_TRANSFER'
}

// Instruction grouping definition
export interface InstructionGroup {
  type: BatchOperationType;
  maxInstructionsPerTransaction: number;
  validator: (instructions: TransactionInstruction[]) => boolean;
}

// Instruction group definitions
const INSTRUCTION_GROUPS: Record<BatchOperationType, InstructionGroup> = {
  [BatchOperationType.TOKEN_TRANSFER]: {
    type: BatchOperationType.TOKEN_TRANSFER,
    maxInstructionsPerTransaction: 10,
    validator: (instructions) => instructions.length <= 10
  },
  [BatchOperationType.SOL_TRANSFER]: {
    type: BatchOperationType.SOL_TRANSFER,
    maxInstructionsPerTransaction: 20,
    validator: (instructions) => instructions.length <= 20
  },
  [BatchOperationType.TOKEN_SWAP]: {
    type: BatchOperationType.TOKEN_SWAP,
    maxInstructionsPerTransaction: 5,
    validator: (instructions) => instructions.length <= 5
  },
  [BatchOperationType.NFT_TRANSFER]: {
    type: BatchOperationType.NFT_TRANSFER,
    maxInstructionsPerTransaction: 8,
    validator: (instructions) => instructions.length <= 8
  }
};

// Configuration for batch processing
export interface BatchProcessorConfig {
  maxBatchSize: number;
  processingIntervalMs: number;
  retryAttempts: number;
  retryDelayMs: number;
}

// Default configuration
const DEFAULT_CONFIG: BatchProcessorConfig = {
  maxBatchSize: 20,
  processingIntervalMs: 1000,
  retryAttempts: 3,
  retryDelayMs: 1000
};

// Batch instruction to be processed
export interface BatchInstruction {
  id: string;
  type: BatchOperationType;
  instruction: TransactionInstruction;
  signers: Keypair[];
  onSuccess?: (signature: string) => void;
  onError?: (error: Error) => void;
}

// Instruction batch
interface InstructionBatch {
  type: BatchOperationType;
  instructions: BatchInstruction[];
  processingStarted: boolean;
}

// Batch processor class
export class BatchProcessor {
  private config: BatchProcessorConfig;
  private batches: Map<BatchOperationType, InstructionBatch> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  private connection: Connection;
  
  constructor(config: Partial<BatchProcessorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.connection = getConnection();
    
    // Initialize empty batches for each operation type
    Object.values(BatchOperationType).forEach(type => {
      this.batches.set(type, {
        type,
        instructions: [],
        processingStarted: false
      });
    });
    
    logger.info(`[BatchProcessor] Initialized with max batch size: ${this.config.maxBatchSize}, interval: ${this.config.processingIntervalMs}ms`);
  }
  
  /**
   * Add an instruction to the batch
   * @param instruction Instruction to add
   * @returns Promise that resolves with the signature when processed
   */
  public addInstruction(instruction: BatchInstruction): Promise<string> {
    return new Promise((resolve, reject) => {
      // Add callbacks
      instruction.onSuccess = (signature) => resolve(signature);
      instruction.onError = (error) => reject(error);
      
      // Add to appropriate batch
      const batch = this.batches.get(instruction.type);
      if (batch) {
        batch.instructions.push(instruction);
        logger.debug(`[BatchProcessor] Added instruction to ${instruction.type} batch (id: ${instruction.id})`);
        
        // Start processing if not already started
        this.startProcessing();
      } else {
        reject(new Error(`Unknown batch operation type: ${instruction.type}`));
      }
    });
  }
  
  /**
   * Start the batch processing if not already started
   */
  private startProcessing(): void {
    if (this.processingInterval !== null) {
      return;
    }
    
    this.processingInterval = setInterval(() => this.processBatches(), this.config.processingIntervalMs);
    logger.info(`[BatchProcessor] Started processing at interval: ${this.config.processingIntervalMs}ms`);
  }
  
  /**
   * Stop the batch processing
   */
  public stopProcessing(): void {
    if (this.processingInterval !== null) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('[BatchProcessor] Stopped processing');
    }
  }
  
  /**
   * Process all pending batches
   */
  private async processBatches(): Promise<void> {
    for (const batch of this.batches.values()) {
      if (batch.instructions.length === 0 || batch.processingStarted) {
        continue;
      }
      
      // Mark batch as processing
      batch.processingStarted = true;
      
      try {
        await this.processBatch(batch);
      } catch (error) {
        logger.error(`[BatchProcessor] Error processing ${batch.type} batch: ${error.message}`);
      } finally {
        // Reset processing flag
        batch.processingStarted = false;
      }
    }
  }
  
  /**
   * Process a single batch
   * @param batch Batch to process
   */
  private async processBatch(batch: InstructionBatch): Promise<void> {
    // Get the instruction group definition
    const group = INSTRUCTION_GROUPS[batch.type];
    
    if (!group) {
      logger.error(`[BatchProcessor] Unknown batch type: ${batch.type}`);
      return;
    }
    
    // Take instructions up to the max batch size
    const instructionsToProcess = batch.instructions.splice(0, this.config.maxBatchSize);
    
    if (instructionsToProcess.length === 0) {
      return;
    }
    
    logger.info(`[BatchProcessor] Processing ${instructionsToProcess.length} instructions in ${batch.type} batch`);
    
    // Split instructions into transaction-sized groups
    const instructionGroups: BatchInstruction[][] = [];
    let currentGroup: BatchInstruction[] = [];
    
    for (const instruction of instructionsToProcess) {
      currentGroup.push(instruction);
      
      if (currentGroup.length >= group.maxInstructionsPerTransaction) {
        instructionGroups.push(currentGroup);
        currentGroup = [];
      }
    }
    
    // Add the last group if it has any instructions
    if (currentGroup.length > 0) {
      instructionGroups.push(currentGroup);
    }
    
    // Process each group as a transaction
    for (const group of instructionGroups) {
      try {
        // Create a new transaction
        const transaction = new Transaction();
        
        // Add the instructions
        for (const item of group) {
          transaction.add(item.instruction);
        }
        
        // Get all signers
        const allSigners = group.flatMap(item => item.signers);
        
        // Get recent blockhash
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        
        // Send and confirm transaction
        const signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          allSigners,
          {
            commitment: 'confirmed',
            skipPreflight: false
          }
        );
        
        logger.info(`[BatchProcessor] Successfully processed ${group.length} instructions in transaction: ${signature}`);
        
        // Notify success for each instruction
        for (const item of group) {
          item.onSuccess?.(signature);
        }
      } catch (error) {
        logger.error(`[BatchProcessor] Failed to process transaction group: ${error.message}`);
        
        // Notify error for each instruction
        for (const item of group) {
          item.onError?.(error);
        }
      }
    }
  }
  
  /**
   * Get the number of pending instructions for a specific type
   * @param type Batch operation type
   * @returns Number of pending instructions
   */
  public getPendingCount(type: BatchOperationType): number {
    const batch = this.batches.get(type);
    return batch ? batch.instructions.length : 0;
  }
  
  /**
   * Get the total number of pending instructions across all types
   * @returns Total number of pending instructions
   */
  public getTotalPendingCount(): number {
    let total = 0;
    for (const batch of this.batches.values()) {
      total += batch.instructions.length;
    }
    return total;
  }
}

// Singleton instance
let batchProcessorInstance: BatchProcessor | null = null;

/**
 * Get the batch processor instance
 * @param config Optional configuration
 * @returns Batch processor instance
 */
export function getBatchProcessor(config?: Partial<BatchProcessorConfig>): BatchProcessor {
  if (!batchProcessorInstance) {
    batchProcessorInstance = new BatchProcessor(config);
  }
  return batchProcessorInstance;
}