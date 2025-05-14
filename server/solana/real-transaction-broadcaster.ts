/**
 * Real Transaction Broadcaster for Solana Blockchain
 * 
 * This module handles creating and broadcasting real transactions to the Solana blockchain.
 * It only deals with real transactions - no simulations or test transactions.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  SendOptions,
  TransactionInstruction,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID, AccountLayout } from '@solana/spl-token';
import { logger } from '../logger';
import fs from 'fs';
import path from 'path';

// Default connection retry parameters
const DEFAULT_SEND_OPTIONS: SendOptions = {
  skipPreflight: false,
  preflightCommitment: 'finalized',
  maxRetries: 5
};

export class SolanaTransactionBroadcaster {
  private connection: Connection;
  private initialized: boolean = false;
  private lastSignature: string | null = null;
  
  constructor(rpcUrl?: string) {
    // Use provided RPC URL or fallback to environment variable
    const url = rpcUrl || process.env.SOLANA_RPC_URL || process.env.HELIUS_API_KEY 
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : 'https://api.mainnet-beta.solana.com';
    
    this.connection = new Connection(url, 'finalized');
  }
  
  /**
   * Initialize the broadcaster
   */
  public async initialize(): Promise<boolean> {
    try {
      logger.info('Initializing Solana transaction broadcaster');
      const version = await this.connection.getVersion();
      logger.info(`Connected to Solana node with version: ${version['solana-core']}`);
      
      this.initialized = true;
      return true;
    } catch (error) {
      logger.error('Failed to initialize Solana transaction broadcaster:', error);
      return false;
    }
  }
  
  /**
   * Load a wallet keypair from file
   */
  private loadWalletKeypair(walletPath: string): Keypair {
    try {
      const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
      return Keypair.fromSecretKey(new Uint8Array(keypairData));
    } catch (error) {
      logger.error(`Failed to load keypair from ${walletPath}:`, error);
      throw error;
    }
  }
  
  /**
   * Send SOL from one wallet to another
   */
  public async sendSol(
    fromWalletPath: string,
    toWallet: string,
    amountSol: number,
    options: SendOptions = DEFAULT_SEND_OPTIONS
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      logger.info(`Sending ${amountSol} SOL from wallet to ${toWallet}`);
      
      // Load sender keypair
      const fromKeypair = this.loadWalletKeypair(fromWalletPath);
      const toAddress = new PublicKey(toWallet);
      
      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: toAddress,
          lamports: amountSol * 1_000_000_000 // Convert SOL to lamports
        })
      );
      
      // Add priority fee if needed for faster processing
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1_000_000 // 0.001 SOL per compute unit
        })
      );
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKeypair.publicKey;
      
      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromKeypair],
        options
      );
      
      logger.info(`Transaction sent with signature: ${signature}`);
      this.lastSignature = signature;
      
      return signature;
    } catch (error) {
      logger.error('Failed to send SOL:', error);
      throw error;
    }
  }
  
  /**
   * Execute a token swap on Jupiter or Raydium
   */
  public async executeTokenSwap(
    walletPath: string,
    fromToken: string,
    toToken: string,
    amountIn: number,
    slippageBps: number = 50, // 0.5%
    swapInstructions: TransactionInstruction[] = []
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      logger.info(`Swapping ${amountIn} of ${fromToken} to ${toToken}`);
      
      // Load wallet keypair
      const walletKeypair = this.loadWalletKeypair(walletPath);
      
      // In a real implementation, this would get the actual swap instructions
      // from Jupiter or Raydium APIs based on the provided tokens and amount
      if (swapInstructions.length === 0) {
        throw new Error('Swap instructions must be provided');
      }
      
      // Create transaction
      const transaction = new Transaction();
      
      // Add priority fee for faster processing
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1_000_000 // 0.001 SOL per compute unit
        })
      );
      
      // Add all swap instructions
      for (const instruction of swapInstructions) {
        transaction.add(instruction);
      }
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletKeypair.publicKey;
      
      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [walletKeypair],
        DEFAULT_SEND_OPTIONS
      );
      
      logger.info(`Swap transaction sent with signature: ${signature}`);
      this.lastSignature = signature;
      
      return signature;
    } catch (error) {
      logger.error('Failed to execute token swap:', error);
      throw error;
    }
  }
  
  /**
   * Execute a cross-exchange arbitrage transaction
   */
  public async executeArbitrage(
    walletPath: string,
    route: {
      sourceExchange: string;
      targetExchange: string;
      tokenPath: string[];
      amountIn: number;
      expectedProfit: number;
    },
    arbitrageInstructions: TransactionInstruction[]
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const { sourceExchange, targetExchange, tokenPath, amountIn, expectedProfit } = route;
      logger.info(`Executing arbitrage from ${sourceExchange} to ${targetExchange} with expected profit of ${expectedProfit} SOL`);
      
      // Load wallet keypair
      const walletKeypair = this.loadWalletKeypair(walletPath);
      
      // In a real implementation, this would get the actual arbitrage instructions
      // from different DEXes based on the provided route
      if (arbitrageInstructions.length === 0) {
        throw new Error('Arbitrage instructions must be provided');
      }
      
      // Create transaction
      const transaction = new Transaction();
      
      // Add priority fee for faster processing
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1_200_000 // 0.0012 SOL per compute unit - higher for arbitrage
        })
      );
      
      // Add all arbitrage instructions
      for (const instruction of arbitrageInstructions) {
        transaction.add(instruction);
      }
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletKeypair.publicKey;
      
      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [walletKeypair],
        {
          ...DEFAULT_SEND_OPTIONS,
          skipPreflight: true // Skip preflight for arbitrage to avoid false failures
        }
      );
      
      logger.info(`Arbitrage transaction sent with signature: ${signature}`);
      this.lastSignature = signature;
      
      return signature;
    } catch (error) {
      logger.error('Failed to execute arbitrage:', error);
      throw error;
    }
  }
  
  /**
   * Check if a transaction was confirmed
   */
  public async checkTransactionConfirmation(signature: string): Promise<boolean> {
    try {
      const status = await this.connection.getSignatureStatus(signature);
      
      if (status && status.value) {
        const confirmed = status.value.confirmationStatus === 'confirmed' || 
                          status.value.confirmationStatus === 'finalized';
                          
        if (confirmed) {
          logger.info(`Transaction ${signature} confirmed`);
        } else {
          logger.info(`Transaction ${signature} not yet confirmed, status: ${status.value.confirmationStatus}`);
        }
        
        return confirmed;
      }
      
      logger.warn(`Transaction ${signature} not found`);
      return false;
    } catch (error) {
      logger.error(`Failed to check transaction status for ${signature}:`, error);
      return false;
    }
  }
  
  /**
   * Get the last transaction signature
   */
  public getLastSignature(): string | null {
    return this.lastSignature;
  }
}

// Export a singleton instance
export const solanaTransactionBroadcaster = new SolanaTransactionBroadcaster();