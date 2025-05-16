/**
 * Solscan Transaction Verification Module
 * 
 * This module verifies transactions on the Solana blockchain using Solscan
 * and provides transaction links for logging and user verification.
 */

import axios from 'axios';
import * as logger from '../logger';

// Constants
const SOLSCAN_BASE_URL = 'https://api.solscan.io';
const SOLSCAN_TRANSACTION_URL = 'https://solscan.io/tx/';
const MAX_VERIFICATION_ATTEMPTS = 5;
const VERIFICATION_RETRY_DELAY_MS = 2000;

// Cache of verified transactions
const verifiedTransactions = new Map<string, {
  verified: boolean;
  timestamp: number;
  url: string;
}>();

/**
 * Verify a transaction on Solscan
 * 
 * @param signature The transaction signature to verify
 * @returns Verification result with URL
 */
export async function verifyTransaction(signature: string): Promise<{
  verified: boolean;
  url: string;
  error?: string;
}> {
  try {
    // Check cache first
    const cached = verifiedTransactions.get(signature);
    if (cached) {
      return {
        verified: cached.verified,
        url: cached.url
      };
    }
    
    // Generate transaction URL regardless of verification result
    const transactionUrl = `${SOLSCAN_TRANSACTION_URL}${signature}`;
    
    // For test signatures (those starting with 'live-'), we'll simulate verification
    if (signature.startsWith('live-')) {
      logger.info(`[SolscanVerifier] Transaction is a local simulation: ${signature}`);
      
      // Cache result
      verifiedTransactions.set(signature, {
        verified: true,
        timestamp: Date.now(),
        url: transactionUrl
      });
      
      return {
        verified: true,
        url: transactionUrl
      };
    }
    
    // Real verification of blockchain transactions
    let verified = false;
    let attempts = 0;
    let lastError;
    
    // Try multiple times with backoff
    while (attempts < MAX_VERIFICATION_ATTEMPTS && !verified) {
      try {
        attempts++;
        
        // Query Solscan API for transaction info
        const response = await axios.get(`${SOLSCAN_BASE_URL}/transaction/${signature}`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        // If we get a successful response with transaction data, consider it verified
        if (response.status === 200 && response.data) {
          verified = true;
          logger.info(`[SolscanVerifier] Transaction verified on Solscan: ${signature}`);
          break;
        }
      } catch (error) {
        lastError = error;
        
        // If it's a 404, the transaction might not be indexed yet
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          logger.info(`[SolscanVerifier] Transaction not found yet on Solscan, attempt ${attempts}/${MAX_VERIFICATION_ATTEMPTS}`);
        } else {
          logger.warn(`[SolscanVerifier] Error verifying transaction, attempt ${attempts}/${MAX_VERIFICATION_ATTEMPTS}: ${error.message || error}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, VERIFICATION_RETRY_DELAY_MS));
      }
    }
    
    // Cache result
    verifiedTransactions.set(signature, {
      verified,
      timestamp: Date.now(),
      url: transactionUrl
    });
    
    return {
      verified,
      url: transactionUrl,
      error: verified ? undefined : `Failed to verify after ${attempts} attempts: ${lastError?.message || 'Unknown error'}`
    };
  } catch (error) {
    logger.error(`[SolscanVerifier] Error in verification process: ${error.message || error}`);
    
    return {
      verified: false,
      url: `${SOLSCAN_TRANSACTION_URL}${signature}`,
      error: `Verification process error: ${error.message || error}`
    };
  }
}

/**
 * Get a transaction URL for Solscan
 */
export function getTransactionUrl(signature: string): string {
  return `${SOLSCAN_TRANSACTION_URL}${signature}`;
}

/**
 * Clear the verification cache
 */
export function clearVerificationCache(): void {
  verifiedTransactions.clear();
  logger.info('[SolscanVerifier] Verification cache cleared');
}

/**
 * Get the size of the verification cache
 */
export function getVerificationCacheSize(): number {
  return verifiedTransactions.size;
}