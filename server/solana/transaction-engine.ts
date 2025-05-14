/**
 * Direct Solana Transaction Engine
 * 
 * Provides a direct connection to the Solana blockchain network for executing
 * real transactions without any intermediary layers. Uses the best available
 * RPC connection for maximum performance and reliability.
 */

import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  sendAndConfirmTransaction,
  Commitment,
  TransactionInstruction,
  ComputeBudgetProgram,
  VersionedTransaction,
  TransactionMessage
} from '@solana/web3.js';
import logger from '../logger';
import { execSync } from 'child_process';

// System wallet address 
const SYSTEM_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

// RPC connection settings
const COMMITMENT_LEVEL: Commitment = 'confirmed';
const MAX_RETRIES = 5;
const CONNECTION_TIMEOUT_MS = 30000;

// Transaction priority settings
export enum TransactionPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  ULTRA = 'ultra'
}

// Transaction priority fee multipliers
const PRIORITY_FEE_MULTIPLIERS = {
  [TransactionPriority.LOW]: 10_000,     // 10K micro-lamports
  [TransactionPriority.MEDIUM]: 100_000, // 100K micro-lamports
  [TransactionPriority.HIGH]: 1_000_000, // 1M micro-lamports
  [TransactionPriority.ULTRA]: 5_000_000 // 5M micro-lamports
};

// Transaction request interface
export interface TransactionRequest {
  instructions: TransactionInstruction[];
  signers: Keypair[];
  priority: keyof typeof TransactionPriority;
  useVersionedTx?: boolean;
  additionalSigners?: Keypair[];
  feePayer?: Keypair;
  computeUnits?: number;
  type?: string;
}

// Transaction result interface
export interface TransactionResult {
  success: boolean;
  signature?: string;
  error?: string;
  blockTime?: number;
  slot?: number;
  fee?: number;
  confirmations?: number;
}

/**
 * Solana Direct Transaction Engine
 * Provides direct connection to Solana blockchain for executing transactions
 */
export class SolanaDirectEngine {
  // Primary RPC connection
  private connection: Connection | null = null;

  // WebSocket connection for account subscriptions
  private wsConnection: Connection | null = null;

  // Backup RPC connections
  private backupConnections: Connection[] = [];

  // Registered wallets for monitoring
  private wallets: Set<string> = new Set();

  // Initialization state
  private initialized: boolean = false;

  // Connection stats
  private successfulTransactions: number = 0;
  private failedTransactions: number = 0;
  private lastConnectionTime: number = 0;
  private reconnectAttempts: number = 0;

  /**
   * Initialize the direct connection to Solana
   */
  public initialize(): boolean {
    if (this.initialized) {
      logger.info('Transaction engine already initialized');
      return true;
    }

    try {
      // Get the best RPC URL based on environment variables
      const mainRpcUrl = this.getBestRpcUrl();

      // Log the RPC connection details
      logger.info(`Initializing direct Solana connection using: ${mainRpcUrl}`);

      // Create the primary connection
      this.connection = new Connection(mainRpcUrl, {
        commitment: COMMITMENT_LEVEL,
        confirmTransactionInitialTimeout: CONNECTION_TIMEOUT_MS
      });

      // Setup WebSocket connection if available
      const wsUrl = this.getWebSocketUrl(mainRpcUrl);
      if (wsUrl) {
        try {
          this.wsConnection = new Connection(wsUrl, {
            commitment: COMMITMENT_LEVEL,
            wsEndpoint: wsUrl
          });
          logger.info(`WebSocket connection established at ${wsUrl}`);
        } catch (wsError) {
          logger.warn('Failed to establish WebSocket connection:', wsError);
          this.wsConnection = this.connection;
        }
      } else {
        this.wsConnection = this.connection;
      }

      // Setup backup connections
      this.setupBackupConnections();

      // Register the system wallet
      this.registerWallet(SYSTEM_WALLET_ADDRESS);

      // Verify the connection works
      this.connection.getSlot().then(slot => {
        logger.info(`Connection verified! Current Solana slot: ${slot}`);
      }).catch(error => {
        logger.error('Error verifying connection:', error);
      });

      this.initialized = true;
      this.lastConnectionTime = Date.now();

      logger.info('✅ Direct Solana connection successfully established');
      return true;
    } catch (error) {
      logger.error('Failed to initialize direct Solana connection:', error);
      return false;
    }
  }

  /**
   * Get the best available RPC URL based on environment variables
   */
  private getBestRpcUrl(): string {
    // Try to use the user's InstantNodes RPC URL (best performance)
    if (process.env.INSTANT_NODES_RPC_URL) {
      return process.env.INSTANT_NODES_RPC_URL;
    }

    // Try to use Alchemy RPC with API key
    if (process.env.SOLANA_RPC_API_KEY) {
      return `https://solana-mainnet.g.alchemy.com/v2/${process.env.SOLANA_RPC_API_KEY}`;
    }

    // Fallback to public RPC
    return 'https://api.mainnet-beta.solana.com';
  }

  /**
   * Get WebSocket URL from RPC URL if possible
   */
  private getWebSocketUrl(rpcUrl: string): string | null {
    try {
      // Try to convert HTTP URL to WebSocket URL
      if (rpcUrl.startsWith('https://')) {
        return rpcUrl.replace('https://', 'wss://');
      }

      // InstantNodes specific WebSocket URL
      if (process.env.INSTANT_NODES_RPC_URL && rpcUrl === process.env.INSTANT_NODES_RPC_URL) {
        return 'wss://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
      }

      return null;
    } catch (error) {
      logger.error('Error creating WebSocket URL:', error);
      return null;
    }
  }

  /**
   * Set up backup RPC connections
   */
  private setupBackupConnections(): void {
    const backupUrls: string[] = [];

    // Add Alchemy if available and not already the main connection
    if (process.env.SOLANA_RPC_API_KEY && !this.connection.rpcEndpoint.includes('alchemy')) {
      backupUrls.push(`https://solana-mainnet.g.alchemy.com/v2/${process.env.SOLANA_RPC_API_KEY}`);
    }

    // Add InstantNodes if available and not already the main connection
    if (process.env.INSTANT_NODES_RPC_URL && !this.connection.rpcEndpoint.includes('instantnodes')) {
      backupUrls.push(process.env.INSTANT_NODES_RPC_URL);
    }

    // Add public RPC as last resort
    backupUrls.push('https://api.mainnet-beta.solana.com');

    // Create backup connections
    this.backupConnections = backupUrls.map(url => {
      logger.info(`Adding backup Solana RPC connection: ${url}`);
      return new Connection(url, COMMITMENT_LEVEL);
    });
  }

  /**
   * Register a wallet for monitoring
   */
  public registerWallet(address: string): boolean {
    try {
      // Validate the wallet address
      const publicKey = new PublicKey(address);

      // Add to registered wallets
      this.wallets.add(address);

      // Set up subscription if WebSocket connection is available
      if (this.wsConnection) {
        this.wsConnection.onAccountChange(
          publicKey,
          (accountInfo) => {
            const balanceSol = accountInfo.lamports / 1e9;
            logger.info(`💰 Wallet ${address} balance updated: ${balanceSol.toFixed(9)} SOL`);
          },
          COMMITMENT_LEVEL
        );
      }

      logger.info(`Wallet ${address} registered for direct blockchain monitoring`);
      return true;
    } catch (error) {
      logger.error(`Error registering wallet ${address}:`, error);
      return false;
    }
  }

  /**
   * Execute a transaction directly on the Solana blockchain
   */
  public async executeTransaction(request: TransactionRequest): Promise<TransactionResult> {
    if (!this.initialized || !this.connection) {
      return {
        success: false,
        error: 'Transaction engine not initialized'
      };
    }

    try {
      const startTime = Date.now();

      // Get the active connection
      const activeConnection = this.connection;

      // Get the latest blockhash
      const { blockhash, lastValidBlockHeight } = await activeConnection.getLatestBlockhash(COMMITMENT_LEVEL);

      // Add priority fee instruction if requested
      const priorityFee = PRIORITY_FEE_MULTIPLIERS[request.priority as TransactionPriority] || PRIORITY_FEE_MULTIPLIERS.MEDIUM;
      const computeUnits = request.computeUnits || 200_000; // Default compute units

      const allInstructions = [
        // Set compute unit limit
        ComputeBudgetProgram.setComputeUnitLimit({
          units: computeUnits
        }),
        // Set priority fee
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: priorityFee
        }),
        // Add user instructions
        ...request.instructions
      ];

      // Determine if we're using legacy or versioned transactions
      let signature: string;

      if (request.useVersionedTx) {
        // Use versioned transaction (more efficient)
        logger.info(`Executing versioned transaction with priority: ${request.priority} (${priorityFee} microlamports)`);

        // Get the fee payer
        const feePayer = request.feePayer?.publicKey || request.signers[0]?.publicKey;

        if (!feePayer) {
          return {
            success: false,
            error: 'No fee payer provided for transaction'
          };
        }

        // Create message
        const messageV0 = new TransactionMessage({
          payerKey: feePayer,
          recentBlockhash: blockhash,
          instructions: allInstructions
        }).compileToV0Message();

        // Create transaction
        const versionedTx = new VersionedTransaction(messageV0);

        // Sign transaction
        const allSigners = [
          ...(request.signers || []),
          ...(request.additionalSigners || []),
          ...(request.feePayer ? [request.feePayer] : [])
        ];

        if (allSigners.length === 0) {
          return {
            success: false,
            error: 'No signers provided for transaction'
          };
        }

        versionedTx.sign(allSigners.map(s => s));

        // Send transaction
        signature = await activeConnection.sendTransaction(versionedTx, {
          skipPreflight: false,
          preflightCommitment: COMMITMENT_LEVEL,
          maxRetries: MAX_RETRIES
        });
      } else {
        // Use legacy transaction
        logger.info(`Executing legacy transaction with priority: ${request.priority} (${priorityFee} microlamports)`);

        // Create transaction
        const transaction = new Transaction().add(...allInstructions);

        // Set blockhash and fee payer
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = request.feePayer?.publicKey || request.signers[0]?.publicKey;

        if (!transaction.feePayer) {
          return {
            success: false,
            error: 'No fee payer provided for transaction'
          };
        }

        // Combine all signers
        const allSigners = [
          ...(request.signers || []),
          ...(request.additionalSigners || []),
          ...(request.feePayer ? [request.feePayer] : [])
        ];

        if (allSigners.length === 0) {
          return {
            success: false,
            error: 'No signers provided for transaction'
          };
        }

        // Sign and send transaction
        signature = await sendAndConfirmTransaction(
          activeConnection,
          transaction,
          allSigners,
          {
            commitment: COMMITMENT_LEVEL,
            skipPreflight: false,
            preflightCommitment: 'processed',
            maxRetries: MAX_RETRIES
          }
        );
      }

      // Get transaction details
      const txDetails = await activeConnection.getTransaction(signature, {
        commitment: COMMITMENT_LEVEL,
        maxSupportedTransactionVersion: 0
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Update stats
      this.successfulTransactions++;

      // Log success
      logger.info(`✅ Transaction successfully executed on Solana blockchain!`);
      logger.info(`📝 Transaction signature: ${signature}`);
      logger.info(`⏱️ Execution time: ${executionTime}ms`);
      logger.info(`🔗 View on Solscan: https://solscan.io/tx/${signature}`);

      // Return transaction results
      return {
        success: true,
        signature,
        blockTime: txDetails?.blockTime,
        slot: txDetails?.slot,
        fee: txDetails?.meta?.fee,
        confirmations: txDetails?.meta?.confirmations ?? 1
      };
    } catch (error: unknown) {
      const err = error as Error;
      // Update stats
      this.failedTransactions++;

      logger.error(`❌ Transaction execution failed:`, err);

      // Check if this is a connection issue
      if (this.isConnectionError(err)) {
        if (await this.tryReconnect()) {
          logger.info('Reconnected successfully, retrying transaction...');
          return this.executeTransaction(request);
        }
      }

      return {
        success: false,
        error: err.message || 'Unknown error executing transaction'
      };
    }
  }

  /**
   * Check if the error is related to connection issues
   */
  private isConnectionError(error: any): boolean {
    if (!error || !error.message) return false;

    const connectionErrorKeywords = [
      'network error',
      'connection refused',
      'failed to fetch',
      'timeout',
      'econnrefused',
      'socket hang up',
      'etimedout',
      'too many requests',
      'rate limit',
      '429',
      '503',
      'server error'
    ];

    const errorMsg = error.message.toLowerCase();
    return connectionErrorKeywords.some(keyword => errorMsg.includes(keyword));
  }

  /**
   * Try to reconnect using backup connections
   */
  private async tryReconnect(): Promise<boolean> {
    if (this.reconnectAttempts >= MAX_RETRIES) {
      logger.error(`Failed to reconnect after ${MAX_RETRIES} attempts`);
      return false;
    }

    this.reconnectAttempts++;

    try {
      logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${MAX_RETRIES})...`);

      // Get a backup connection
      const backupIndex = this.reconnectAttempts % this.backupConnections.length;
      const backupConnection = this.backupConnections[backupIndex];

      // Test the connection
      try {
        await backupConnection.getSlot();

        // If successful, switch to this connection
        this.connection = backupConnection;
        this.lastConnectionTime = Date.now();

        logger.info(`Reconnected successfully using backup connection ${backupIndex + 1}`);
        return true;
      } catch (testError) {
        logger.warn(`Backup connection ${backupIndex + 1} failed:`, testError);

        // Try the next backup connection
        if (this.reconnectAttempts < MAX_RETRIES) {
          return this.tryReconnect();
        }

        return false;
      }
    } catch (error) {
      logger.error('Error during reconnection:', error);
      return false;
    }
  }

  /**
   * Get the current balance of a wallet
   */
  public async getWalletBalance(address: string): Promise<number> {
    if (!this.initialized || !this.connection) {
      throw new Error('Transaction engine not initialized');
    }

    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey, COMMITMENT_LEVEL);

      // Convert lamports to SOL
      return balance / 1e9;
    } catch (error) {
      logger.error(`Error fetching balance for wallet ${address}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction statistics
   */
  public getStats(): any {
    return {
      initialized: this.initialized,
      successfulTransactions: this.successfulTransactions,
      failedTransactions: this.failedTransactions,
      lastConnectionTime: this.lastConnectionTime,
      reconnectAttempts: this.reconnectAttempts,
      registeredWallets: Array.from(this.wallets),
      primaryRpcUrl: this.connection?.rpcEndpoint || 'Not initialized',
      backupConnectionsCount: this.backupConnections.length,
      websocketConnected: !!this.wsConnection
    };
  }
}

// Create and export a singleton instance for direct blockchain access
export const transactionEngine = new SolanaDirectEngine();
export default transactionEngine;