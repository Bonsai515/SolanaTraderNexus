/**
 * Fix Transaction Verifier
 * 
 * This module fixes transaction verification issues by implementing
 * multiple verification methods and robust error handling.
 */

import { TransactionConfirmationStatus } from '@solana/web3.js';
import axios from 'axios';
import { solanaConnection } from './fix-solana-connection';
import { getLogger } from './logger';

const logger = getLogger('TransactionVerifier');

// Transaction verification result
interface VerificationResult {
  success: boolean;
  status?: TransactionConfirmationStatus;
  error?: string;
  source: string;
  timestamp: number;
}

// Verification cache entry
interface CacheEntry {
  result: VerificationResult;
  expiry: number;
}

// Transaction verifier class
export class TransactionVerifier {
  private static instance: TransactionVerifier;
  private verificationCache: Map<string, CacheEntry> = new Map();
  private cacheTTL: number = 60 * 60 * 1000; // 1 hour
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // ms
  
  private constructor() {
    // Periodically clean cache
    setInterval(() => this.cleanCache(), 15 * 60 * 1000); // 15 minutes
  }
  
  static getInstance(): TransactionVerifier {
    if (!TransactionVerifier.instance) {
      TransactionVerifier.instance = new TransactionVerifier();
    }
    return TransactionVerifier.instance;
  }
  
  // Clean expired cache entries
  private cleanCache(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [signature, entry] of this.verificationCache.entries()) {
      if (entry.expiry < now) {
        this.verificationCache.delete(signature);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logger.debug(`Cleaned ${expiredCount} expired cache entries`);
    }
  }
  
  // Verify transaction using on-chain method
  private async verifyOnChain(signature: string): Promise<VerificationResult> {
    try {
      const connection = solanaConnection.getConnection();
      if (!connection) {
        return {
          success: false,
          error: 'Solana connection not available',
          source: 'on-chain',
          timestamp: Date.now()
        };
      }
      
      // Get transaction status
      const { value } = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: true
      });
      
      if (!value) {
        return {
          success: false,
          error: 'Transaction not found on-chain',
          source: 'on-chain',
          timestamp: Date.now()
        };
      }
      
      return {
        success: true,
        status: value.confirmationStatus || 'processed',
        source: 'on-chain',
        timestamp: Date.now()
      };
    } catch (error: any) {
      logger.error(`On-chain verification error for ${signature}: ${error.message || String(error)}`);
      return {
        success: false,
        error: `On-chain verification error: ${error.message || String(error)}`,
        source: 'on-chain',
        timestamp: Date.now()
      };
    }
  }
  
  // Verify transaction using Solscan API
  private async verifyWithSolscan(signature: string): Promise<VerificationResult> {
    try {
      const response = await axios.get(`https://api.solscan.io/transaction`, {
        params: { tx: signature },
        timeout: 5000
      });
      
      if (response.status !== 200 || !response.data) {
        return {
          success: false,
          error: `Solscan API returned status ${response.status}`,
          source: 'solscan',
          timestamp: Date.now()
        };
      }
      
      // If txHash exists in response, the transaction exists
      if (response.data.txHash) {
        let status: TransactionConfirmationStatus = 'processed';
        
        // Map Solscan status to Solana confirmation status
        if (response.data.status === 'Success') {
          status = 'confirmed';
        } else if (response.data.status === 'Fail') {
          status = 'processed';
        }
        
        return {
          success: true,
          status,
          source: 'solscan',
          timestamp: Date.now()
        };
      }
      
      return {
        success: false,
        error: 'Transaction not found on Solscan',
        source: 'solscan',
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Solscan verification error for ${signature}: ${error.message}`);
      return {
        success: false,
        error: `Solscan verification error: ${error.message}`,
        source: 'solscan',
        timestamp: Date.now()
      };
    }
  }
  
  // Verify transaction using local simulated state (for testing)
  private verifySimulated(signature: string): VerificationResult {
    // If it's a simulated transaction (starts with 'sim-')
    if (signature.startsWith('sim-')) {
      return {
        success: true,
        status: 'confirmed',
        source: 'simulation',
        timestamp: Date.now()
      };
    }
    
    return {
      success: false,
      error: 'Not a simulated transaction',
      source: 'simulation',
      timestamp: Date.now()
    };
  }
  
  // Verify transaction with retries
  private async verifyWithRetries(
    signature: string,
    method: 'on-chain' | 'solscan' | 'simulation',
    retries: number = 0
  ): Promise<VerificationResult> {
    try {
      let result: VerificationResult;
      
      // Choose verification method
      switch (method) {
        case 'on-chain':
          result = await this.verifyOnChain(signature);
          break;
        case 'solscan':
          result = await this.verifyWithSolscan(signature);
          break;
        case 'simulation':
          result = this.verifySimulated(signature);
          break;
        default:
          result = {
            success: false,
            error: `Unknown verification method: ${method}`,
            source: method,
            timestamp: Date.now()
          };
      }
      
      // If verification failed and we have retries left
      if (!result.success && retries < this.maxRetries) {
        logger.debug(`Verification attempt ${retries + 1} failed for ${signature} using ${method}. Retrying...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, retries)));
        
        // Retry with incremented retry count
        return this.verifyWithRetries(signature, method, retries + 1);
      }
      
      return result;
    } catch (error) {
      logger.error(`Verification error for ${signature} using ${method}: ${error.message}`);
      
      // If we have retries left
      if (retries < this.maxRetries) {
        logger.debug(`Verification attempt ${retries + 1} failed for ${signature} using ${method}. Retrying...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, retries)));
        
        // Retry with incremented retry count
        return this.verifyWithRetries(signature, method, retries + 1);
      }
      
      return {
        success: false,
        error: `Verification error after ${retries + 1} attempts: ${error.message}`,
        source: method,
        timestamp: Date.now()
      };
    }
  }
  
  // Verify transaction (public method)
  async verifyTransaction(signature: string): Promise<VerificationResult> {
    // Check cache first
    const cached = this.verificationCache.get(signature);
    if (cached && cached.expiry > Date.now()) {
      logger.debug(`Using cached verification for ${signature}`);
      return cached.result;
    }
    
    // For simulated transactions, use simulation verification
    if (signature.startsWith('sim-')) {
      const result = this.verifySimulated(signature);
      
      // Cache the result
      this.verificationCache.set(signature, {
        result,
        expiry: Date.now() + this.cacheTTL
      });
      
      return result;
    }
    
    // Try all verification methods in order
    const methods: Array<'on-chain' | 'solscan'> = ['on-chain', 'solscan'];
    let bestResult: VerificationResult | null = null;
    
    for (const method of methods) {
      const result = await this.verifyWithRetries(signature, method);
      
      // If verification succeeded, use this result
      if (result.success) {
        bestResult = result;
        break;
      }
      
      // Keep track of the best result we've seen
      if (!bestResult || (result.error && !bestResult.error)) {
        bestResult = result;
      }
    }
    
    if (!bestResult) {
      bestResult = {
        success: false,
        error: 'All verification methods failed',
        source: 'combined',
        timestamp: Date.now()
      };
    }
    
    // Cache the result
    this.verificationCache.set(signature, {
      result: bestResult,
      expiry: Date.now() + this.cacheTTL
    });
    
    return bestResult;
  }
  
  // Check if transaction is confirmed
  async isTransactionConfirmed(signature: string): Promise<boolean> {
    const result = await this.verifyTransaction(signature);
    return result.success && result.status === 'confirmed';
  }
  
  // Clear cache for a signature
  clearCache(signature: string): void {
    this.verificationCache.delete(signature);
  }
  
  // Get cache stats
  getCacheStats(): { size: number, hitRate: number } {
    return {
      size: this.verificationCache.size,
      hitRate: 0 // TODO: Implement hit rate tracking
    };
  }
}

// Export singleton instance
export const transactionVerifier = TransactionVerifier.getInstance();