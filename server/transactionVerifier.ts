/**
 * Transaction Verification System
 * 
 * This module provides robust transaction verification for the trading system,
 * ensuring that all transactions are properly confirmed on the Solana blockchain.
 */

import { Connection, PublicKey, TransactionSignature } from '@solana/web3.js';
import axios from 'axios';
import { logger } from './logger';

// Default number of confirmation blocks to wait for
const DEFAULT_CONFIRMATIONS = 2;

// Default timeout for confirmations in milliseconds
const DEFAULT_CONFIRMATION_TIMEOUT = 60000; // 60 seconds

// Default timeout for API requests
const DEFAULT_REQUEST_TIMEOUT = 30000; // 30 seconds

// Maximum number of retry attempts for verification
const MAX_RETRY_ATTEMPTS = 3;

// Delay between retries in milliseconds
const RETRY_DELAY = 2000; // 2 seconds

// Interface for verification options
interface VerificationOptions {
  confirmations?: number;
  confirmationTimeout?: number;
  skipSimulations?: boolean;
}

// Interface for verification result
interface VerificationResult {
  success: boolean;
  signature: string;
  confirmations?: number;
  error?: string;
  slot?: number;
  fee?: number;
  blockTime?: number;
}

/**
 * Transaction Verifier class
 */
export class TransactionVerifier {
  private connection: Connection;
  private solscanApiKey?: string;
  private heliusApiKey?: string;
  
  /**
   * Constructor
   * @param connection Solana connection
   * @param solscanApiKey Optional Solscan API key for advanced verification
   * @param heliusApiKey Optional Helius API key for enhanced transaction information
   */
  constructor(
    connection: Connection,
    solscanApiKey?: string,
    heliusApiKey?: string
  ) {
    this.connection = connection;
    this.solscanApiKey = solscanApiKey;
    this.heliusApiKey = heliusApiKey;
  }
  
  /**
   * Set Solana connection
   * @param connection Solana connection
   */
  public setConnection(connection: Connection): void {
    this.connection = connection;
  }
  
  /**
   * Set Solscan API key
   * @param apiKey Solscan API key
   */
  public setSolscanApiKey(apiKey: string): void {
    this.solscanApiKey = apiKey;
  }
  
  /**
   * Set Helius API key
   * @param apiKey Helius API key
   */
  public setHeliusApiKey(apiKey: string): void {
    this.heliusApiKey = apiKey;
  }
  
  /**
   * Verify transaction using RPC node
   * @param signature Transaction signature
   * @param options Verification options
   */
  public async verifyTransactionWithRpc(
    signature: string,
    options: VerificationOptions = {}
  ): Promise<VerificationResult> {
    const confirmations = options.confirmations || DEFAULT_CONFIRMATIONS;
    const timeout = options.confirmationTimeout || DEFAULT_CONFIRMATION_TIMEOUT;
    
    try {
      // Skip signature verification for simulation signatures
      if (signature.startsWith('sim-')) {
        logger.info(`[TransactionVerifier] Skipping verification for simulation signature: ${signature}`);
        return {
          success: true,
          signature,
          confirmations: 0
        };
      }
      
      // Wait for transaction confirmation
      logger.info(`[TransactionVerifier] Waiting for ${confirmations} confirmations for signature: ${signature}`);
      
      const startTime = Date.now();
      let confirmed = false;
      let attempts = 0;
      let lastError = null;
      
      while (!confirmed && Date.now() - startTime < timeout && attempts < MAX_RETRY_ATTEMPTS) {
        try {
          const status = await this.connection.confirmTransaction(
            signature,
            confirmations
          );
          
          if (status.value.err) {
            lastError = status.value.err;
            logger.warn(`[TransactionVerifier] Transaction error: ${JSON.stringify(status.value.err)}`);
            attempts++;
            await this.delay(RETRY_DELAY);
          } else {
            confirmed = true;
          }
        } catch (error) {
          lastError = error;
          logger.warn(`[TransactionVerifier] Confirmation attempt ${attempts + 1} failed: ${error.message}`);
          attempts++;
          await this.delay(RETRY_DELAY);
        }
      }
      
      // If transaction still not confirmed, fail verification
      if (!confirmed) {
        logger.error(`[TransactionVerifier] Failed to confirm transaction: ${signature}`);
        return {
          success: false,
          signature,
          error: lastError ? lastError.toString() : 'Confirmation timed out'
        };
      }
      
      // Get transaction details
      const details = await this.connection.getTransaction(signature, {
        commitment: 'confirmed'
      });
      
      if (!details) {
        logger.warn(`[TransactionVerifier] Transaction confirmed but details not found: ${signature}`);
        return {
          success: true,
          signature,
          confirmations
        };
      }
      
      return {
        success: true,
        signature,
        confirmations,
        slot: details.slot,
        fee: details.meta?.fee,
        blockTime: details.blockTime || undefined
      };
    } catch (error) {
      logger.error(`[TransactionVerifier] Error verifying transaction: ${error.message}`);
      return {
        success: false,
        signature,
        error: error.message
      };
    }
  }
  
  /**
   * Verify transaction using Solscan API
   * @param signature Transaction signature
   */
  public async verifyTransactionWithSolscan(signature: string): Promise<VerificationResult> {
    try {
      // Skip signature verification for simulation signatures
      if (signature.startsWith('sim-')) {
        logger.info(`[TransactionVerifier] Skipping Solscan verification for simulation signature: ${signature}`);
        return {
          success: true,
          signature,
          confirmations: 0
        };
      }
      
      const headers: Record<string, string> = {};
      if (this.solscanApiKey) {
        headers['x-api-key'] = this.solscanApiKey;
      }
      
      const response = await axios.get(
        `https://public-api.solscan.io/transaction/${signature}`,
        {
          headers,
          timeout: DEFAULT_REQUEST_TIMEOUT
        }
      );
      
      if (response.status !== 200) {
        logger.error(`[TransactionVerifier] Solscan API error: ${response.status} ${response.statusText}`);
        return {
          success: false,
          signature,
          error: `Solscan API error: ${response.status} ${response.statusText}`
        };
      }
      
      const data = response.data;
      
      if (data.status && data.status === 'Success') {
        return {
          success: true,
          signature,
          confirmations: DEFAULT_CONFIRMATIONS,
          slot: data.slot,
          fee: data.fee,
          blockTime: data.blockTime
        };
      } else {
        logger.warn(`[TransactionVerifier] Transaction failed according to Solscan: ${signature}`);
        return {
          success: false,
          signature,
          error: data.error || 'Transaction failed according to Solscan'
        };
      }
    } catch (error) {
      logger.error(`[TransactionVerifier] Error verifying transaction with Solscan: ${error.message}`);
      return {
        success: false,
        signature,
        error: error.message
      };
    }
  }
  
  /**
   * Verify transaction using Helius API
   * @param signature Transaction signature
   */
  public async verifyTransactionWithHelius(signature: string): Promise<VerificationResult> {
    try {
      // Skip signature verification for simulation signatures
      if (signature.startsWith('sim-')) {
        logger.info(`[TransactionVerifier] Skipping Helius verification for simulation signature: ${signature}`);
        return {
          success: true,
          signature,
          confirmations: 0
        };
      }
      
      if (!this.heliusApiKey) {
        logger.warn('[TransactionVerifier] Helius API key not set, falling back to RPC verification');
        return this.verifyTransactionWithRpc(signature);
      }
      
      const response = await axios.get(
        `https://api.helius.xyz/v0/transactions/${signature}?api-key=${this.heliusApiKey}`,
        {
          timeout: DEFAULT_REQUEST_TIMEOUT
        }
      );
      
      if (response.status !== 200) {
        logger.error(`[TransactionVerifier] Helius API error: ${response.status} ${response.statusText}`);
        return {
          success: false,
          signature,
          error: `Helius API error: ${response.status} ${response.statusText}`
        };
      }
      
      const data = response.data;
      
      return {
        success: true,
        signature,
        confirmations: DEFAULT_CONFIRMATIONS,
        slot: data.slot,
        fee: data.fee,
        blockTime: data.blockTime
      };
    } catch (error) {
      logger.error(`[TransactionVerifier] Error verifying transaction with Helius: ${error.message}`);
      return {
        success: false,
        signature,
        error: error.message
      };
    }
  }
  
  /**
   * Verify transaction on the blockchain
   * @param signature Transaction signature
   * @param options Verification options
   */
  public async verifyTransaction(
    signature: string,
    options: VerificationOptions = {}
  ): Promise<VerificationResult> {
    // Skip verification for simulation signatures
    if (signature.startsWith('sim-')) {
      logger.info(`[TransactionVerifier] Transaction verification skipped for ${signature}`);
      return {
        success: true,
        signature,
        confirmations: 0
      };
    }
    
    try {
      // Try with RPC first
      const rpcResult = await this.verifyTransactionWithRpc(signature, options);
      
      // If RPC verification fails, try Solscan if API key is available
      if (!rpcResult.success && this.solscanApiKey) {
        logger.warn(`[TransactionVerifier] RPC verification failed, trying Solscan for signature: ${signature}`);
        const solscanResult = await this.verifyTransactionWithSolscan(signature);
        
        // If Solscan also fails, try Helius if API key is available
        if (!solscanResult.success && this.heliusApiKey) {
          logger.warn(`[TransactionVerifier] Solscan verification failed, trying Helius for signature: ${signature}`);
          return await this.verifyTransactionWithHelius(signature);
        }
        
        return solscanResult;
      }
      
      return rpcResult;
    } catch (error) {
      logger.error(`[TransactionVerifier] Error during verification process: ${error.message}`);
      return {
        success: false,
        signature,
        error: error.message
      };
    }
  }
  
  /**
   * Utility method to delay execution
   * @param ms Milliseconds to delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export a factory function to create the verifier
export function createTransactionVerifier(
  connection: Connection,
  solscanApiKey?: string,
  heliusApiKey?: string
): TransactionVerifier {
  return new TransactionVerifier(connection, solscanApiKey, heliusApiKey);
}