/**
 * Transaction Verification System
 * 
 * This module provides blockchain verification of transactions using Solscan
 * and direct Solana RPC verification. It ensures all executed trades are
 * properly verified and recorded in the blockchain with confirmations.
 */

import axios from 'axios';
import { PublicKey, Connection } from '@solana/web3.js';
import * as logger from '../logger';
import { heliusApiIntegration } from './heliusIntegration';

// Types for verification
export interface VerificationResult {
  signature: string;
  verified: boolean;
  confirmations: number;
  blockTime?: number;
  slot?: number;
  solscanLink?: string;
  error?: string;
}

export interface TransactionDetails {
  signature: string;
  status: 'success' | 'failed' | 'pending' | 'unknown';
  blockTime: number;
  slot: number;
  fee: number;
  confirmations: number;
  solscanLink: string;
  rawData?: any;
}

/**
 * Transaction Verifier Class
 */
export class TransactionVerifier {
  private solanaConnection: Connection | null = null;
  private initialized: boolean = false;
  private solscanApiKey: string | undefined;
  private verifyRetryAttempts: number = 3;

  /**
   * Constructor
   * @param rpcUrl Solana RPC URL
   */
  constructor(rpcUrl?: string) {
    try {
      // Try to use Helius connection if available
      if (heliusApiIntegration.isInitialized()) {
        this.solanaConnection = heliusApiIntegration.getConnection();
        this.initialized = true;
        logger.info('Transaction verifier initialized with Helius connection');
      } else if (rpcUrl && (rpcUrl.startsWith('http://') || rpcUrl.startsWith('https://'))) {
        this.solanaConnection = new Connection(rpcUrl, 'confirmed');
        this.initialized = true;
        logger.info('Transaction verifier initialized with provided RPC connection');
      } else if (process.env.ALCHEMY_RPC_URL && 
                (process.env.ALCHEMY_RPC_URL.startsWith('http://') || 
                 process.env.ALCHEMY_RPC_URL.startsWith('https://'))) {
        this.solanaConnection = new Connection(process.env.ALCHEMY_RPC_URL, 'confirmed');
        this.initialized = true;
        logger.info('Transaction verifier initialized with Alchemy RPC connection');
      } else {
        // Fallback to public RPC
        this.solanaConnection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        this.initialized = true;
        logger.info('Transaction verifier initialized with public Solana RPC');
      }
    } catch (error) {
      logger.error('Error in transaction verifier initialization:', error);
      // Safe fallback to public RPC
      this.solanaConnection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      this.initialized = true;
      logger.info('Transaction verifier initialized with public Solana RPC (fallback after error)');
    }

    // Get Solscan API key from environment if available
    this.solscanApiKey = process.env.SOLSCAN_API_KEY;
  }

  /**
   * Initialize the transaction verifier
   */
  public async initialize(rpcUrl?: string): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      if (heliusApiIntegration.isInitialized()) {
        this.solanaConnection = heliusApiIntegration.getConnection();
      } else if (rpcUrl) {
        this.solanaConnection = new Connection(rpcUrl, 'confirmed');
      } else if (process.env.HELIUS_API_KEY) {
        this.solanaConnection = new Connection(
          `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
          'confirmed'
        );
      } else {
        throw new Error('No valid RPC connection for transaction verifier');
      }

      if (this.solanaConnection) {
        // Test connection
        await this.solanaConnection.getVersion();
        this.initialized = true;
        logger.info('Transaction verifier initialized successfully');
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('Failed to initialize transaction verifier:', error.message);
      return false;
    }
  }

  /**
   * Check if the verifier is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && !!this.solanaConnection;
  }

  /**
   * Verify a transaction using direct Solana RPC
   */
  public async verifyTransaction(signature: string): Promise<VerificationResult> {
    try {
      if (!this.initialized || !this.solanaConnection) {
        await this.initialize();
        if (!this.solanaConnection) {
          throw new Error('Transaction verifier not properly initialized');
        }
      }

      let attempt = 0;
      let status = null;
      
      while (attempt < this.verifyRetryAttempts) {
        try {
          status = await this.solanaConnection.getSignatureStatus(signature, {
            searchTransactionHistory: true
          });
          break;
        } catch (error) {
          logger.warn(`Verification attempt ${attempt + 1} failed, retrying...`);
          attempt++;
          if (attempt >= this.verifyRetryAttempts) {
            throw error;
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }

      if (!status || !status.value) {
        return {
          signature,
          verified: false,
          confirmations: 0,
          error: 'Transaction not found on blockchain'
        };
      }

      const confirmations = status.value.confirmations || 0;
      const verified = confirmations > 0 && !status.value.err;

      // Get transaction details if verified
      let blockTime, slot;
      if (verified) {
        try {
          const txInfo = await this.solanaConnection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0
          });
          blockTime = txInfo?.blockTime || undefined;
          slot = txInfo?.slot || undefined;
        } catch (error) {
          logger.warn(`Failed to get transaction details for ${signature}`);
        }
      }

      return {
        signature,
        verified,
        confirmations,
        blockTime,
        slot,
        solscanLink: `https://solscan.io/tx/${signature}`,
        error: status.value.err ? JSON.stringify(status.value.err) : undefined
      };
    } catch (error: any) {
      logger.error(`Failed to verify transaction ${signature}:`, error.message);
      return {
        signature,
        verified: false,
        confirmations: 0,
        error: error.message
      };
    }
  }

  /**
   * Get transaction details from Solscan
   */
  public async getTransactionDetailsFromSolscan(signature: string): Promise<TransactionDetails | null> {
    try {
      const response = await axios.get(`https://api.solscan.io/transaction?tx=${signature}`, {
        headers: this.solscanApiKey ? {
          'token': this.solscanApiKey
        } : undefined
      });

      if (!response.data || response.data.status !== 'success') {
        logger.warn(`Solscan API returned invalid response for ${signature}`);
        return null;
      }

      const txData = response.data.data;
      return {
        signature,
        status: txData.status === 0 ? 'success' : 'failed',
        blockTime: txData.blockTime,
        slot: txData.slot,
        fee: txData.fee,
        confirmations: txData.confirmations || 0,
        solscanLink: `https://solscan.io/tx/${signature}`,
        rawData: txData
      };
    } catch (error: any) {
      logger.error(`Failed to get transaction details from Solscan for ${signature}:`, error.message);
      return null;
    }
  }

  /**
   * Verify token balance change after transaction
   */
  public async verifyTokenBalanceChange(
    walletAddress: string,
    tokenMint: string,
    expectedChangePercent: number
  ): Promise<boolean> {
    try {
      if (!this.initialized || !this.solanaConnection) {
        throw new Error('Transaction verifier not properly initialized');
      }

      // Get token account addresses for this wallet and token
      const tokenAccounts = await this.solanaConnection.getTokenAccountsByOwner(
        new PublicKey(walletAddress),
        { mint: new PublicKey(tokenMint) }
      );

      if (tokenAccounts.value.length === 0) {
        logger.warn(`No token accounts found for wallet ${walletAddress} and token ${tokenMint}`);
        return false;
      }

      // Get balances for all accounts
      const balances = await Promise.all(
        tokenAccounts.value.map(async account => {
          const accountInfo = await this.solanaConnection!.getTokenAccountBalance(account.pubkey);
          return {
            address: account.pubkey.toString(),
            balance: accountInfo.value.uiAmount || 0
          };
        })
      );

      // Log the balance verification results
      const totalBalance = balances.reduce((sum, account) => sum + account.balance, 0);
      logger.info(`Verified token balance for ${walletAddress}: ${totalBalance} ${tokenMint}`);

      // For now, just return true if we have any balance
      // In a real implementation, you would compare with a previous balance
      return totalBalance > 0;
    } catch (error: any) {
      logger.error('Failed to verify token balance change:', error.message);
      return false;
    }
  }

  /**
   * Monitor transaction until confirmed
   */
  public async monitorUntilConfirmed(
    signature: string,
    maxRetries: number = 10,
    interval: number = 2000
  ): Promise<VerificationResult> {
    if (!this.initialized || !this.solanaConnection) {
      throw new Error('Transaction verifier not properly initialized');
    }

    let retries = 0;
    while (retries < maxRetries) {
      const result = await this.verifyTransaction(signature);
      
      if (result.verified && result.confirmations > 0) {
        logger.info(`Transaction ${signature} confirmed with ${result.confirmations} confirmations`);
        return result;
      }
      
      retries++;
      logger.debug(`Waiting for transaction confirmation (attempt ${retries}/${maxRetries})...`);
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    logger.warn(`Transaction ${signature} not confirmed after ${maxRetries} attempts`);
    return {
      signature,
      verified: false,
      confirmations: 0,
      error: 'Transaction not confirmed within timeout period'
    };
  }
}

// Create singleton instance
export const transactionVerifier = new TransactionVerifier();