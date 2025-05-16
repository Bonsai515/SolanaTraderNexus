/**
 * Helius API Integration for Solana Blockchain
 *
 * This module provides direct integration with Helius API for enhanced
 * Solana blockchain functionality including NFT data, token data,
 * and transaction history with DAS API support.
 */

import axios from 'axios';
import { logger } from '../logger';
import { Connection, PublicKey, Transaction, Keypair, SendOptions, Commitment } from '@solana/web3.js';
import { getSolanaConnection } from './ensureRpcConnection';

/**
 * Token balance interface
 */
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

/**
 * Transaction status interface
 */
export interface TransactionStatus {
  status: 'confirmed' | 'finalized' | 'processing' | 'processed' | 'failed' | 'not_found' | 'error';
  confirmations: number;
}

/**
 * Transaction execution options
 */
export interface TransactionExecutionOptions {
  skipPreflight?: boolean;
  preflightCommitment?: Commitment;
  maxRetries?: number;
  useOptimalFees?: boolean;
  feeMultiplier?: number;
}

/**
 * Helius API Integration Class
 */
export class HeliusApiIntegration {
  private baseUrl: string = 'https://api.helius.xyz/v0';
  private connection: Connection | null = null;
  private initialized: boolean = false;
  private apiKey: string | null;

  constructor() {
    this.apiKey = process.env.HELIUS_API_KEY || null;
  }

  /**
   * Initialize the Helius API integration
   * @param apiKey Optional API key, uses environment variable if not provided
   * @returns Boolean indicating if initialization was successful
   */
  public async initialize(apiKey?: string): Promise<boolean> {
    try {
      // Set API key if provided, otherwise use environment variable
      if (apiKey) {
        this.apiKey = apiKey;
      }

      if (!this.apiKey) {
        logger.warn("Helius API integration initialized without API key, some features will be limited");
      }

      // Initialize Solana connection
      this.connection = getSolanaConnection();

      // Test the API connection
      if (this.apiKey) {
        await this.getEnhancedAccountInfo("11111111111111111111111111111111");
      }

      this.initialized = true;
      logger.info("Helius API integration initialized successfully");
      return true;
    } catch (error) {
      logger.error("Failed to initialize Helius API integration:", error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if the integration is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
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
    if (!this.apiKey) {
      throw new Error('Helius API key is required for enhanced account info');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/addresses/${address}/balances?api-key=${this.apiKey}`
      );
      return response.data;
    } catch (error) {
      logger.error(`Error getting enhanced account info for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Get token balances for an account
   */
  public async getTokenBalances(address: string): Promise<TokenBalance[]> {
    try {
      if (this.apiKey) {
        // Use Helius API for comprehensive token data including prices
        const response = await axios.get(
          `${this.baseUrl}/addresses/${address}/balances?api-key=${this.apiKey}`
        );

        if (response.data && response.data.tokens) {
          return response.data.tokens.map((token: any) => ({
            mint: token.mint,
            address: token.address,
            symbol: token.symbol || 'UNKNOWN',
            name: token.name || 'Unknown Token',
            amount: token.amount,
            decimals: token.decimals,
            uiAmount: token.amount / Math.pow(10, token.decimals),
            usdValue: token.price ? token.amount * token.price / Math.pow(10, token.decimals) : undefined
          }));
        }
        return [];
      } else {
        // Fallback to regular connection for token accounts
        const pubkey = new PublicKey(address);
        if (!this.connection) throw new Error('Connection not initialized');
        
        const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
          pubkey,
          { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
        );

        return tokenAccounts.value.map(account => {
          const data = account.account.data.parsed.info;
          return {
            mint: data.mint,
            address: account.pubkey.toString(),
            symbol: '', // Not available without additional API calls
            name: '',   // Not available without additional API calls
            amount: parseInt(data.tokenAmount.amount),
            decimals: data.tokenAmount.decimals,
            uiAmount: parseFloat(data.tokenAmount.uiAmount),
            usdValue: undefined
          };
        });
      }
    } catch (error) {
      logger.error(`Error getting token balances for ${address}:`, error);
      return [];
    }
  }

  /**
   * Get enriched transaction history for an account
   */
  public async getEnrichedTransactions(address: string, limit: number = 10): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Helius API key is required for enriched transactions');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/addresses/${address}/transactions?api-key=${this.apiKey}`,
        {
          limit
        }
      );
      return response.data;
    } catch (error) {
      logger.error(`Error getting enriched transactions for ${address}:`, error);
      return [];
    }
  }

  /**
   * Get token metadata for a mint address
   */
  public async getTokenMetadata(mintAddress: string): Promise<any | null> {
    if (!this.apiKey) {
      throw new Error('Helius API key is required for token metadata');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/tokens/${mintAddress}?api-key=${this.apiKey}`
      );
      return response.data;
    } catch (error) {
      logger.error(`Error getting token metadata for ${mintAddress}:`, error);
      return null;
    }
  }

  /**
   * Check transaction status using Helius enhanced API
   */
  public async checkTransactionStatus(signature: string): Promise<TransactionStatus> {
    try {
      if (this.apiKey) {
        // Use Helius API for enhanced status information
        const response = await axios.get(
          `${this.baseUrl}/transactions/${signature}?api-key=${this.apiKey}`
        );

        if (response.data) {
          if (response.data.confirmationStatus === 'finalized') {
            return { status: 'finalized', confirmations: 32 }; // Max confirmations when finalized
          } else if (response.data.confirmationStatus === 'confirmed') {
            return { status: 'confirmed', confirmations: response.data.confirmations || 1 };
          } else if (response.data.confirmationStatus === 'processed') {
            return { status: 'processed', confirmations: 0 };
          }
        }
      }

      // Fallback to regular connection
      if (!this.connection) throw new Error('Connection not initialized');
      
      const status = await this.connection.getSignatureStatus(signature, {
        searchTransactionHistory: true
      });

      if (!status || !status.value) {
        return { status: 'not_found', confirmations: 0 };
      }

      if (status.value.err) {
        return { status: 'failed', confirmations: 0 };
      }

      if (status.value.confirmationStatus === 'finalized') {
        return { status: 'finalized', confirmations: 32 };
      }

      return {
        status: status.value.confirmationStatus || 'processing',
        confirmations: status.value.confirmations || 0
      };
    } catch (error) {
      logger.error(`Error checking transaction status for ${signature}:`, error);
      return { status: 'error', confirmations: 0 };
    }
  }

  /**
   * Execute a transaction with priority fee optimization
   */
  public async executeTransaction(
    transaction: Transaction, 
    signer: Keypair | Keypair[],
    options?: TransactionExecutionOptions
  ): Promise<string> {
    if (!this.connection) throw new Error('Connection not initialized');

    try {
      const signers = Array.isArray(signer) ? signer : [signer];
      
      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = signers[0].publicKey;

      // Sign transaction
      transaction.sign(...signers);

      // Determine send options
      const sendOptions: SendOptions = {
        skipPreflight: options?.skipPreflight || false,
        preflightCommitment: (options?.preflightCommitment as Commitment) || 'confirmed',
        maxRetries: options?.maxRetries || 3
      };

      // Send transaction
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(), 
        sendOptions
      );

      // Confirm transaction
      await this.connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature
      });

      return signature;
    } catch (error) {
      logger.error('Error executing transaction:', error);
      throw error;
    }
  }

  /**
   * Calculate optimal priority fee based on network congestion
   */
  private async calculateOptimalPriorityFee(): Promise<number> {
    try {
      // Use Helius API for network status if available
      if (this.apiKey) {
        const response = await axios.get(
          `${this.baseUrl}/network-status?api-key=${this.apiKey}`
        );
        
        if (response.data && response.data.priorityFee) {
          return response.data.priorityFee;
        }
      }

      // Fallback priority fee calculation
      if (!this.connection) throw new Error('Connection not initialized');
      
      const perfSamples = await this.connection.getRecentPerformanceSamples(5);
      if (perfSamples && perfSamples.length > 0) {
        // Calculate average TPS
        const avgTps = perfSamples.reduce((sum, sample) => 
          sum + sample.numTransactions / sample.samplePeriodSecs, 0) / perfSamples.length;
        
        // Scale fee based on TPS
        if (avgTps > 2500) return 1000000; // High congestion: 0.001 SOL per CU
        if (avgTps > 1500) return 500000;  // Medium-high: 0.0005 SOL per CU
        if (avgTps > 500) return 100000;   // Medium: 0.0001 SOL per CU
        return 10000;                      // Low: 0.00001 SOL per CU
      }
      
      return 50000; // Default priority fee
    } catch (error) {
      logger.error('Error calculating optimal priority fee:', error);
      return 50000; // Default priority fee on error
    }
  }

  /**
   * Get name service domains for an address
   */
  public async getDomainsForAddress(address: string): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('Helius API key is required for name service lookups');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/addresses/${address}/domains?api-key=${this.apiKey}`
      );
      
      if (response.data && Array.isArray(response.data)) {
        return response.data.map((domain: any) => domain.name);
      }
      return [];
    } catch (error) {
      logger.error(`Error getting domains for address ${address}:`, error);
      return [];
    }
  }

  /**
   * Resolve a domain to an address
   */
  public async resolveDomainToAddress(domain: string): Promise<string | null> {
    if (!this.apiKey) {
      throw new Error('Helius API key is required for name service lookups');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/domains/${domain}/address?api-key=${this.apiKey}`
      );
      
      if (response.data && response.data.address) {
        return response.data.address;
      }
      return null;
    } catch (error) {
      logger.error(`Error resolving domain ${domain}:`, error);
      return null;
    }
  }

  /**
   * Get detailed information about an NFT
   */
  public async getNftDetails(mintAddress: string): Promise<any | null> {
    if (!this.apiKey) {
      throw new Error('Helius API key is required for NFT details');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/nfts/${mintAddress}?api-key=${this.apiKey}`
      );
      return response.data;
    } catch (error) {
      logger.error(`Error getting NFT details for ${mintAddress}:`, error);
      return null;
    }
  }

  /**
   * Get compressed NFTs for an account using DAS
   */
  public async getCompressedNfts(address: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Helius API key is required for compressed NFT lookups');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/addresses/${address}/compressed-nfts?api-key=${this.apiKey}`,
        {}
      );
      
      if (response.data && Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      logger.error(`Error getting compressed NFTs for ${address}:`, error);
      return [];
    }
  }

  /**
   * Get NFT events for a collection
   */
  public async getNftEventsForCollection(firstCreator: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Helius API key is required for NFT events');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/nft-events?api-key=${this.apiKey}`,
        {
          query: {
            firstVerifiedCreators: [firstCreator]
          },
          options: {
            limit: 100
          }
        }
      );
      
      if (response.data && Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      logger.error(`Error getting NFT events for collection ${firstCreator}:`, error);
      return [];
    }
  }

  /**
   * Get Mint List for a collection
   */
  public async getCollectionMints(firstCreator: string): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('Helius API key is required for collection mints');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/addresses/${firstCreator}/mints?api-key=${this.apiKey}`,
        {}
      );
      
      if (response.data && Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      logger.error(`Error getting collection mints for ${firstCreator}:`, error);
      return [];
    }
  }
}

// Export singleton instance
export const heliusApiIntegration = new HeliusApiIntegration();