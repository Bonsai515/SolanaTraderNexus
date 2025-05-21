/**
 * QuickNode API Connector
 * 
 * This module provides optimized access to QuickNode API endpoints
 * for high-priority transaction processing.
 */

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import * as logger from './logger';
import { getConnection } from './solana/connection-manager';

// Base configuration for QuickNode
const QUICKNODE_URL = 'https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8';
const QUICKNODE_WS = 'wss://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8';

// Transaction handler
export class QuickNodeTransactionHandler {
  private connection: Connection;

  constructor() {
    // Get a connection specifically for transactions
    this.connection = getConnection('confirmed', 'transactions');
    logger.info('[QuickNode] Transaction handler initialized with transaction-optimized connection');
  }

  /**
   * Send a transaction using QuickNode premium endpoint
   */
  async sendTransaction(transaction: Transaction, signers: Keypair[]): Promise<string> {
    try {
      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        signers,
        {
          commitment: 'confirmed',
          skipPreflight: false
        }
      );

      logger.info(`[QuickNode] Transaction sent successfully: ${signature}`);
      return signature;
    } catch (error) {
      logger.error(`[QuickNode] Transaction error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send a transaction without waiting for confirmation
   */
  async sendTransactionNoWait(transaction: Transaction, signers: Keypair[]): Promise<string> {
    try {
      // Sign transaction
      transaction.sign(...signers);

      // Send without waiting for confirmation
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        }
      );

      logger.info(`[QuickNode] Transaction sent (no wait): ${signature}`);
      return signature;
    } catch (error) {
      logger.error(`[QuickNode] Transaction error (no wait): ${error.message}`);
      throw error;
    }
  }

  /**
   * Confirm a transaction that was previously sent
   */
  async confirmTransaction(signature: string): Promise<boolean> {
    try {
      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        logger.error(`[QuickNode] Transaction confirmation error: ${JSON.stringify(confirmation.value.err)}`);
        return false;
      }

      logger.info(`[QuickNode] Transaction confirmed: ${signature}`);
      return true;
    } catch (error) {
      logger.error(`[QuickNode] Confirmation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Get the status of a transaction
   */
  async getTransactionStatus(signature: string): Promise<any> {
    try {
      const status = await this.connection.getSignatureStatus(signature, {
        searchTransactionHistory: true
      });

      return status;
    } catch (error) {
      logger.error(`[QuickNode] Error getting transaction status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get account info using QuickNode
   */
  async getAccountInfo(pubkey: PublicKey): Promise<any> {
    try {
      return await this.connection.getAccountInfo(pubkey);
    } catch (error) {
      logger.error(`[QuickNode] Error getting account info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get SOL balance for a wallet
   */
  async getBalance(pubkey: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(pubkey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      logger.error(`[QuickNode] Error getting balance: ${error.message}`);
      throw error;
    }
  }
}

// Singleton instance
let transactionHandler: QuickNodeTransactionHandler | null = null;

/**
 * Get QuickNode transaction handler
 */
export function getTransactionHandler(): QuickNodeTransactionHandler {
  if (!transactionHandler) {
    transactionHandler = new QuickNodeTransactionHandler();
  }
  return transactionHandler;
}

/**
 * Sign and send a transaction with QuickNode transaction handler
 */
export async function signAndSendTransaction(
  transaction: Transaction,
  signers: Keypair[],
  waitForConfirmation: boolean = true
): Promise<string> {
  const handler = getTransactionHandler();
  
  if (waitForConfirmation) {
    return handler.sendTransaction(transaction, signers);
  } else {
    return handler.sendTransactionNoWait(transaction, signers);
  }
}

/**
 * Create a transaction builder for QuickNode
 */
export class TransactionBuilder {
  private transaction: Transaction;
  private instructionSet: TransactionInstruction[];
  private signerSet: Set<Keypair>;

  constructor() {
    this.transaction = new Transaction();
    this.instructionSet = [];
    this.signerSet = new Set();
  }

  /**
   * Add an instruction to the transaction
   */
  addInstruction(instruction: TransactionInstruction): TransactionBuilder {
    this.instructionSet.push(instruction);
    return this;
  }

  /**
   * Add multiple instructions to the transaction
   */
  addInstructions(instructions: TransactionInstruction[]): TransactionBuilder {
    this.instructionSet.push(...instructions);
    return this;
  }

  /**
   * Add a signer to the transaction
   */
  addSigner(signer: Keypair): TransactionBuilder {
    this.signerSet.add(signer);
    return this;
  }

  /**
   * Add multiple signers to the transaction
   */
  addSigners(signers: Keypair[]): TransactionBuilder {
    signers.forEach(signer => this.signerSet.add(signer));
    return this;
  }

  /**
   * Build the transaction
   */
  buildTransaction(): Transaction {
    // Add all instructions to the transaction
    this.transaction.add(...this.instructionSet);
    return this.transaction;
  }

  /**
   * Sign and send the transaction
   */
  async signAndSend(waitForConfirmation: boolean = true): Promise<string> {
    // Build the transaction
    const transaction = this.buildTransaction();
    
    // Convert the Set to an array
    const signers = Array.from(this.signerSet);
    
    // Sign and send
    return signAndSendTransaction(transaction, signers, waitForConfirmation);
  }
}

/**
 * Create a new transaction builder
 */
export function createTransactionBuilder(): TransactionBuilder {
  return new TransactionBuilder();
}

// Export convenience functions
export const quickNodeClient = {
  getTransactionHandler,
  signAndSendTransaction,
  createTransactionBuilder
};