/**
 * Transaction Verification System with Fallbacks
 * 
 * Provides robust transaction verification with multiple methods and fallbacks.
 * Supports direct RPC verification and external service (Solscan) verification.
 */

import { Connection, PublicKey, TransactionSignature } from '@solana/web3.js';
import * as logger from './logger';
import axios from 'axios';
import { verifyTransaction, verifyTransactions } from './lib/verification';
import { initializeRpcConnection } from './lib/ensureRpcConnection';

// Cache for transaction verification results
const verificationCache = new Map<string, { verified: boolean, timestamp: number }>();
const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// Solscan API base URL (for external verification)
const SOLSCAN_API_BASE = 'https://api.solscan.io';

// In-memory connection instance
let connection: Connection | null = null;

/**
 * Initialize transaction verifier with Solana connection
 */
export async function initializeTransactionVerifier(): Promise<void> {
  try {
    connection = await initializeRpcConnection();
    logger.info('Transaction verifier initialized with connection');
  } catch (error: any) {
    logger.error(`Failed to initialize transaction verifier: ${error.message || String(error)}`);
    throw error;
  }
}

/**
 * Get the Solana connection, initializing if necessary
 * @returns Solana connection
 */
export async function getConnection(): Promise<Connection> {
  if (!connection) {
    connection = await initializeRpcConnection();
  }
  return connection;
}

/**
 * Verify a transaction via Solana RPC
 * @param signature Transaction signature
 * @returns Whether the transaction is verified
 */
export async function verifyTransactionRPC(signature: string): Promise<boolean> {
  try {
    // Skip verification for simulated transactions
    if (signature.startsWith('sim-')) {
      return true;
    }
    
    // Get connection
    const conn = await getConnection();
    
    // Check status of transaction
    const status = await conn.getSignatureStatus(signature, {
      searchTransactionHistory: true
    });
    
    const isVerified = status?.value?.confirmationStatus === 'confirmed' || 
                       status?.value?.confirmationStatus === 'finalized';
    
    if (isVerified) {
      logger.info(`Transaction ${signature.substring(0, 10)}... verified via RPC`);
    } else {
      logger.warn(`Transaction ${signature.substring(0, 10)}... not verified via RPC`);
    }
    
    return isVerified;
  } catch (error: any) {
    logger.error(`RPC verification failed for ${signature.substring(0, 10)}...: ${error.message || String(error)}`);
    return false;
  }
}

/**
 * Verify a transaction via Solscan
 * @param signature Transaction signature
 * @returns Whether the transaction is verified
 */
export async function verifyTransactionSolscan(signature: string): Promise<boolean> {
  try {
    // Skip verification for simulated transactions
    if (signature.startsWith('sim-')) {
      return true;
    }
    
    // Check cache first
    const cached = verificationCache.get(signature);
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
      return cached.verified;
    }
    
    // Query Solscan API
    const response = await axios.get(`${SOLSCAN_API_BASE}/transaction`, {
      params: { tx: signature },
      timeout: 5000
    });
    
    const isVerified = response.status === 200 && 
                       response.data && 
                       response.data.status === 'Success';
    
    // Cache result
    verificationCache.set(signature, { verified: isVerified, timestamp: Date.now() });
    
    if (isVerified) {
      logger.info(`Transaction ${signature.substring(0, 10)}... verified via Solscan`);
    } else {
      logger.warn(`Transaction ${signature.substring(0, 10)}... not verified via Solscan`);
    }
    
    return isVerified;
  } catch (error: any) {
    logger.error(`Solscan verification failed for ${signature.substring(0, 10)}...: ${error.message || String(error)}`);
    return false;
  }
}

/**
 * Verify a transaction with fallback
 * @param signature Transaction signature
 * @returns Whether the transaction is verified
 */
export async function verifyTransactionWithFallback(signature: string): Promise<boolean> {
  // Skip verification for simulated transactions
  if (signature.startsWith('sim-')) {
    return true;
  }
  
  // Try RPC verification first
  try {
    const rpcVerified = await verifyTransactionRPC(signature);
    if (rpcVerified) {
      return true;
    }
  } catch (error: any) {
    logger.warn(`RPC verification failed, trying Solscan: ${error.message || String(error)}`);
  }
  
  // Fallback to Solscan verification
  try {
    return await verifyTransactionSolscan(signature);
  } catch (error: any) {
    logger.error(`All verification methods failed for ${signature.substring(0, 10)}...`);
    return false;
  }
}

/**
 * Verify a transaction from the library module (facade)
 * @param signature Transaction signature
 * @returns Whether the transaction is verified
 */
export async function verifyTransactionConfirmation(signature: string): Promise<boolean> {
  if (!connection) {
    throw new Error('Solana connection not initialized');
  }
  
  return verifyTransaction(signature, connection);
}

/**
 * Verify a batch of transactions
 * @param signatures Transaction signatures
 * @returns Map of signatures to verification results
 */
export async function verifyTransactionBatch(signatures: string[]): Promise<Map<string, boolean>> {
  if (!connection) {
    throw new Error('Solana connection not initialized');
  }
  
  return verifyTransactions(signatures, connection);
}

/**
 * Get transaction details
 * @param signature Transaction signature
 * @returns Transaction details
 */
export async function getTransactionDetails(signature: string): Promise<any> {
  try {
    // Skip for simulated transactions
    if (signature.startsWith('sim-')) {
      return {
        signature,
        status: 'simulated',
        timestamp: Date.now()
      };
    }
    
    // Try Solscan first for richer details
    try {
      const response = await axios.get(`${SOLSCAN_API_BASE}/transaction`, {
        params: { tx: signature },
        timeout: 5000
      });
      
      if (response.status === 200 && response.data) {
        return response.data;
      }
    } catch (error: any) {
      logger.warn(`Solscan details lookup failed, falling back to RPC: ${error.message || String(error)}`);
    }
    
    // Fallback to RPC
    const conn = await getConnection();
    const tx = await conn.getTransaction(signature);
    
    return tx;
  } catch (error: any) {
    logger.error(`Failed to get transaction details: ${error.message || String(error)}`);
    throw error;
  }
}

// Initialize verifier when module is imported
initializeTransactionVerifier().catch(err => {
  logger.error(`Failed to initialize transaction verifier: ${err.message || String(err)}`);
});

export default {
  verifyTransactionRPC,
  verifyTransactionSolscan,
  verifyTransactionWithFallback,
  verifyTransactionConfirmation,
  verifyTransactionBatch,
  getTransactionDetails,
  getConnection
};