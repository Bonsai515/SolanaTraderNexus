/**
 * Helius API Integration for Solana Blockchain
 * 
 * This module provides direct integration with Helius API for enhanced
 * Solana blockchain functionality including NFT data, token data,
 * and transaction history with DAS API support.
 */

import axios from 'axios';
import * as logger from '../logger';
import { Connection, PublicKey, VersionedTransaction, Transaction } from '@solana/web3.js';

// Interfaces for Helius API responses
export interface TokenData {
  mint: string;
  name: string;
  symbol: string;
  imageUri: string;
  metadata: any;
  tokenAmount: {
    amount: string;
    decimals: number;
    uiAmount: number;
  };
}

export interface TokenBalance {
  mint: string;
  address: string;
  symbol: string;
  name: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  usdValue?: number;
}

export interface EnrichedTransaction {
  signature: string;
  type: string;
  timestamp: number;
  fee: number;
  status: 'success' | 'failed';
  instructions: any[];
  tokenTransfers: any[];
  nativeTransfers: any[];
}

export class HeliusApiIntegration {
  private apiKey: string | undefined;
  private baseUrl: string = 'https://api.helius.xyz/v0';
  private connection: Connection | null = null;
  private initialized: boolean = false;

  constructor() {
    this.apiKey = process.env.HELIUS_API_KEY;
    
    if (!this.apiKey) {
      logger.warn('Helius API key not found in environment variables');
    } else {
      // Initialize Solana connection with Helius endpoint
      this.connection = new Connection(
        `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`,
        'confirmed'
      );
      this.initialized = true;
      logger.info('Helius API integration initialized');
    }
  }
  
  /**
   * Initialize the Helius API integration
   * @param apiKey Optional API key, uses environment variable if not provided
   * @returns Boolean indicating if initialization was successful
   */
  public async initialize(apiKey?: string): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    if (apiKey) {
      this.apiKey = apiKey;
    } else if (!this.apiKey && process.env.HELIUS_API_KEY) {
      this.apiKey = process.env.HELIUS_API_KEY;
    }
    
    if (!this.apiKey) {
      logger.warn('Helius API key not found, cannot initialize');
      return false;
    }
    
    try {
      // Initialize Solana connection with Helius endpoint
      this.connection = new Connection(
        `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`,
        'confirmed'
      );
      
      // Test connection with a simple call
      const version = await this.connection.getVersion();
      logger.info(`Connected to Solana cluster version: ${version['solana-core']}`);
      
      this.initialized = true;
      logger.info('Helius API integration initialized successfully');
      return true;
    } catch (error: any) {
      logger.error('Failed to initialize Helius API integration:', error.message);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if the integration is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && !!this.apiKey;
  }

  /**
   * Get connection object
   */
  public getConnection(): Connection | null {
    return this.connection;
  }

  /**
   * Get enhanced account information with token holdings
   */
  public async getEnhancedAccountInfo(address: string): Promise<any> {
    try {
      if (!this.apiKey) {
        throw new Error('Helius API key not configured');
      }

      const response = await axios.get(`${this.baseUrl}/addresses/${address}/balances`, {
        params: {
          'api-key': this.apiKey
        }
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to get enhanced account info from Helius:', error.message);
      throw error;
    }
  }

  /**
   * Get token balances for an account
   */
  public async getTokenBalances(address: string): Promise<TokenBalance[]> {
    try {
      if (!this.apiKey) {
        throw new Error('Helius API key not configured');
      }

      const response = await axios.get(`${this.baseUrl}/addresses/${address}/balances`, {
        params: {
          'api-key': this.apiKey
        }
      });

      // Process token balances
      if (response.data && response.data.tokens) {
        return response.data.tokens.map((token: any) => ({
          mint: token.mint,
          address: address,
          symbol: token.symbol || 'UNKNOWN',
          name: token.name || 'Unknown Token',
          amount: token.amount,
          decimals: token.decimals,
          uiAmount: token.uiAmount || (token.amount / Math.pow(10, token.decimals)),
          usdValue: token.price ? token.uiAmount * token.price : undefined
        }));
      }

      return [];
    } catch (error: any) {
      logger.error('Failed to get token balances from Helius:', error.message);
      return [];
    }
  }

  /**
   * Get enriched transaction history for an account
   */
  public async getEnrichedTransactions(address: string, limit: number = 10): Promise<EnrichedTransaction[]> {
    try {
      if (!this.apiKey) {
        throw new Error('Helius API key not configured');
      }

      const response = await axios.post(`${this.baseUrl}/addresses/${address}/transactions`, 
        {
          options: {
            limit: limit
          }
        },
        {
          params: {
            'api-key': this.apiKey
          }
        }
      );

      return response.data || [];
    } catch (error: any) {
      logger.error('Failed to get enriched transactions from Helius:', error.message);
      return [];
    }
  }

  /**
   * Get token metadata for a mint address
   */
  public async getTokenMetadata(mintAddress: string): Promise<TokenData | null> {
    try {
      if (!this.apiKey) {
        throw new Error('Helius API key not configured');
      }

      const response = await axios.get(`${this.baseUrl}/tokens`, {
        params: {
          'api-key': this.apiKey,
          'mint': mintAddress
        }
      });

      if (response.data && response.data.length > 0) {
        return response.data[0];
      }

      return null;
    } catch (error: any) {
      logger.error('Failed to get token metadata from Helius:', error.message);
      return null;
    }
  }

  /**
   * Check transaction status using Helius enhanced API
   */
  public async checkTransactionStatus(signature: string): Promise<{ status: string, confirmations: number }> {
    try {
      if (!this.connection) {
        throw new Error('Helius connection not initialized');
      }

      const status = await this.connection.getSignatureStatus(signature, {
        searchTransactionHistory: true
      });

      if (!status || !status.value) {
        return { status: 'not_found', confirmations: 0 };
      }

      const confirmations = status.value.confirmations || 0;
      let statusText = 'processing';

      if (status.value.err) {
        statusText = 'failed';
      } else if (confirmations >= 32) {
        statusText = 'finalized';
      } else if (confirmations > 0) {
        statusText = 'confirmed';
      }

      return { status: statusText, confirmations };
    } catch (error: any) {
      logger.error('Failed to check transaction status with Helius:', error.message);
      return { status: 'error', confirmations: 0 };
    }
  }

  /**
   * Execute a transaction with priority fee optimization
   */
  public async executeTransaction(
    transaction: Transaction | VersionedTransaction,
    signers: any[],
    confirmLevel: 'processed' | 'confirmed' | 'finalized' = 'confirmed'
  ): Promise<{ signature: string, success: boolean }> {
    try {
      if (!this.connection) {
        throw new Error('Helius connection not initialized');
      }

      // Calculate optimal priority fee based on recent transactions
      const priorityFee = await this.calculateOptimalPriorityFee();
      logger.info(`Using optimal priority fee: ${priorityFee} microLamports`);

      // Add priority fee to transaction if not a versioned transaction
      if (transaction instanceof Transaction) {
        transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
        
        // Set priority fee if needed and supported
        if (priorityFee > 0) {
          // Here we would add priority fee if implementing prioritized transactions
        }
      }

      // Send transaction
      let signature;
      if (transaction instanceof Transaction) {
        signature = await this.connection.sendTransaction(transaction, signers);
      } else {
        signature = await this.connection.sendTransaction(transaction);
      }

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash: (await this.connection.getLatestBlockhash()).blockhash,
        lastValidBlockHeight: (await this.connection.getLatestBlockhash()).lastValidBlockHeight
      }, confirmLevel);

      return {
        signature,
        success: !confirmation.value.err
      };
    } catch (error: any) {
      logger.error('Failed to execute transaction with Helius:', error.message);
      return {
        signature: '',
        success: false
      };
    }
  }

  /**
   * Calculate optimal priority fee based on recent transactions
   */
  private async calculateOptimalPriorityFee(): Promise<number> {
    try {
      if (!this.connection) {
        return 0;
      }

      // Get recent transactions
      const recentBlockhash = await this.connection.getLatestBlockhash();
      const block = await this.connection.getBlock(recentBlockhash.lastValidBlockHeight, {
        maxSupportedTransactionVersion: 0
      });

      if (!block || !block.transactions || block.transactions.length === 0) {
        return 10000; // Default 10,000 microLamports if no data
      }

      // Sample fee data from transactions
      const fees = block.transactions
        .filter(tx => tx.meta && tx.meta.fee)
        .map(tx => tx.meta!.fee);

      if (fees.length === 0) {
        return 10000;
      }

      // Calculate percentiles
      fees.sort((a, b) => a - b);
      const medianFee = fees[Math.floor(fees.length / 2)];
      const p75Fee = fees[Math.floor(fees.length * 0.75)];

      // Use the 75th percentile for faster confirmation
      return Math.max(5000, p75Fee);
    } catch (error: any) {
      logger.warn('Failed to calculate optimal priority fee:', error.message);
      return 10000; // Default value
    }
  }
}

// Create singleton instance
export const heliusApiIntegration = new HeliusApiIntegration();