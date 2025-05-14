/**
 * Transaction and Wallet Verification Module
 * 
 * Provides various methods to verify blockchain transactions and wallet balances
 * with fallback mechanisms for high reliability.
 */

import { Connection, TransactionSignature, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import * as logger from '../logger';
const SOLSCAN_API_BASE = 'https://api.solscan.io';

// Cache transaction verification results
const verificationCache = new Map<string, { result: boolean, timestamp: number }>();
const CACHE_EXPIRY = 1000 * 60 * 60; // 1 hour

// Verify a transaction via Solscan
export async function verifySolscanTransaction(signature: string): Promise<boolean> {
  try {
    // Check cache first
    const cached = verificationCache.get(signature);
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
      logger.debug(`Using cached verification for ${signature.substring(0, 10)}...`);
      return cached.result;
    }
    
    // Skip verification for simulated transactions
    if (signature.startsWith('sim-')) {
      verificationCache.set(signature, { result: true, timestamp: Date.now() });
      return true;
    }
    
    logger.info(`Verifying transaction ${signature.substring(0, 10)}... via Solscan`);
    
    // Query Solscan API
    const response = await axios.get(`${SOLSCAN_API_BASE}/transaction`, {
      params: { tx: signature },
      timeout: 5000
    });
    
    // Check if transaction exists and is confirmed
    const isConfirmed = response.status === 200 && 
                       response.data && 
                       response.data.txHash && 
                       response.data.status === 'Success';
    
    // Cache the result
    verificationCache.set(signature, { result: isConfirmed, timestamp: Date.now() });
    
    logger.info(`Transaction ${signature.substring(0, 10)}... verification result: ${isConfirmed ? 'confirmed' : 'failed'}`);
    return isConfirmed;
  } catch (error: any) {
    logger.error(`Solscan verification failed for ${signature.substring(0, 10)}...: ${error.message || String(error)}`);
    
    // In case of error, don't cache and return false
    return false;
  }
}

// Verify a transaction via direct RPC
export async function verifyRpcTransaction(signature: string, connection: Connection): Promise<boolean> {
  try {
    // Skip verification for simulated transactions
    if (signature.startsWith('sim-')) {
      return true;
    }
    
    logger.info(`Verifying transaction ${signature.substring(0, 10)}... via RPC`);
    
    const { value } = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true
    });
    
    const isConfirmed = !!value && value.confirmationStatus === 'confirmed';
    
    logger.info(`Transaction ${signature.substring(0, 10)}... RPC verification result: ${isConfirmed ? 'confirmed' : 'not confirmed'}`);
    return isConfirmed;
  } catch (error: any) {
    logger.error(`RPC verification failed for ${signature.substring(0, 10)}...: ${error.message || String(error)}`);
    return false;
  }
}

// Verify a transaction with fallback between RPC and Solscan
export async function verifyTransaction(signature: string, connection: Connection): Promise<boolean> {
  // For simulated transactions, always return true
  if (signature.startsWith('sim-')) {
    return true;
  }
  
  // Try RPC verification first
  try {
    const rpcVerified = await verifyRpcTransaction(signature, connection);
    if (rpcVerified) {
      return true;
    }
  } catch (error: any) {
    logger.warn(`RPC verification error: ${error.message || String(error)}`);
  }
  
  // Fallback to Solscan
  try {
    return await verifySolscanTransaction(signature);
  } catch (error: any) {
    logger.error(`All verification methods failed for ${signature.substring(0, 10)}...`);
    return false;
  }
}

// Verify wallet balance
export async function verifyWalletBalance(walletAddress: string, connection: Connection): Promise<number> {
  try {
    logger.info(`Checking balance for wallet ${walletAddress.substring(0, 10)}...`);
    
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    const solBalance = balance / 1e9; // Convert lamports to SOL
    
    logger.info(`Wallet ${walletAddress.substring(0, 10)}... has ${solBalance} SOL`);
    return solBalance;
  } catch (error: any) {
    logger.error(`Error checking wallet balance: ${error.message || String(error)}`);
    throw error;
  }
}

// Verify multiple transactions with parallel processing
export async function verifyTransactions(signatures: string[], connection: Connection): Promise<Map<string, boolean>> {
  logger.info(`Verifying ${signatures.length} transactions in parallel`);
  
  const results = new Map<string, boolean>();
  
  await Promise.all(signatures.map(async (signature) => {
    try {
      const verified = await verifyTransaction(signature, connection);
      results.set(signature, verified);
    } catch (error: any) {
      logger.error(`Error verifying transaction ${signature.substring(0, 10)}...: ${error.message || String(error)}`);
      results.set(signature, false);
    }
  }));
  
  return results;
}