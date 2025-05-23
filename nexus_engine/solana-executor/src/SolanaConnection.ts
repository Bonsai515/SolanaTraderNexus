/**
 * Solana Connection Manager
 * Advanced connection handling with premium RPC integration
 */

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  VersionedTransaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  Commitment,
  ConnectionConfig
} from '@solana/web3.js';

export interface ConnectionConfig {
  endpoint: string;
  commitment: Commitment;
  wsEndpoint?: string;
  confirmTransactionInitialTimeout?: number;
  disableRetryOnRateLimit?: boolean;
  httpHeaders?: Record<string, string>;
}

export class SolanaConnectionManager {
  private connection: Connection;
  private wsConnection?: Connection;
  private endpoint: string;
  private commitment: Commitment;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: ConnectionConfig) {
    this.endpoint = config.endpoint;
    this.commitment = config.commitment || 'confirmed';
    
    const connectionConfig: ConnectionConfig = {
      commitment: this.commitment,
      confirmTransactionInitialTimeout: config.confirmTransactionInitialTimeout || 30000,
      disableRetryOnRateLimit: config.disableRetryOnRateLimit || false,
      httpHeaders: config.httpHeaders || {}
    };

    this.connection = new Connection(this.endpoint, connectionConfig);
    
    if (config.wsEndpoint) {
      this.wsConnection = new Connection(config.wsEndpoint, {
        ...connectionConfig,
        wsEndpoint: config.wsEndpoint
      });
    }

    console.log('[SolanaConnection] Connection manager initialized');
    console.log(`[SolanaConnection] Endpoint: ${this.endpoint}`);
    console.log(`[SolanaConnection] Commitment: ${this.commitment}`);
  }

  public getConnection(): Connection {
    return this.connection;
  }

  public getWebSocketConnection(): Connection | undefined {
    return this.wsConnection;
  }

  public async checkConnection(): Promise<boolean> {
    try {
      const slot = await this.connection.getSlot();
      const blockTime = await this.connection.getBlockTime(slot);
      
      console.log(`[SolanaConnection] Health check passed - Slot: ${slot}, Block time: ${blockTime}`);
      return true;
    } catch (error) {
      console.error('[SolanaConnection] Health check failed:', error);
      return false;
    }
  }

  public async getAccountBalance(publicKey: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error('[SolanaConnection] Balance check error:', error);
      throw error;
    }
  }

  public async getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    return await this.connection.getLatestBlockhash(this.commitment);
  }

  public async submitTransaction(
    transaction: Transaction | VersionedTransaction,
    signers?: Keypair[]
  ): Promise<string> {
    try {
      console.log('[SolanaConnection] Submitting transaction to blockchain...');
      
      let signature: string;
      
      if (transaction instanceof VersionedTransaction) {
        if (signers && signers.length > 0) {
          transaction.sign(signers);
        }
        signature = await this.connection.sendTransaction(transaction, {
          skipPreflight: false,
          preflightCommitment: this.commitment,
          maxRetries: 3
        });
      } else {
        if (signers && signers.length > 0) {
          signature = await sendAndConfirmTransaction(
            this.connection,
            transaction,
            signers,
            {
              commitment: this.commitment,
              skipPreflight: false,
              maxRetries: 3
            }
          );
        } else {
          signature = await this.connection.sendTransaction(transaction, {
            skipPreflight: false,
            preflightCommitment: this.commitment,
            maxRetries: 3
          });
        }
      }
      
      console.log(`[SolanaConnection] Transaction submitted: ${signature}`);
      return signature;
    } catch (error) {
      console.error('[SolanaConnection] Transaction submission error:', error);
      throw error;
    }
  }

  public async confirmTransaction(signature: string): Promise<boolean> {
    try {
      const confirmation = await this.connection.confirmTransaction(signature, this.commitment);
      
      if (confirmation.value.err) {
        console.error(`[SolanaConnection] Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        return false;
      }
      
      console.log(`[SolanaConnection] Transaction confirmed: ${signature}`);
      return true;
    } catch (error) {
      console.error('[SolanaConnection] Transaction confirmation error:', error);
      return false;
    }
  }

  public startHealthCheck(intervalMs: number = 60000): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkConnection();
    }, intervalMs);
  }

  public stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  public destroy(): void {
    this.stopHealthCheck();
    console.log('[SolanaConnection] Connection manager destroyed');
  }
}
