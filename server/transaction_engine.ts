/**
 * Solana Transaction Engine
 * 
 * This module provides a centralized transaction engine for executing and managing all Solana transactions.
 * It handles fee-aware routing, wallet management, and ensures capital efficiency.
 */

import { logger } from './logger';
import * as solanaWeb3 from '@solana/web3.js';
import { Connection, Keypair, Transaction, SystemProgram, PublicKey } from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Default system wallet for funding trading wallets
const SYSTEM_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
const MIN_SOL_BALANCE = 0.001; // Minimum SOL balance to maintain in wallets

// Priority fee levels (in microlamports)
const PRIORITY_FEE_LEVELS = {
  low: 5000,
  medium: 10000,
  high: 50000,
  max: 100000
};

// Track transaction history
type TransactionRecord = {
  id: string;
  signature: string;
  timestamp: Date;
  wallet: string;
  type: string;
  status: 'pending' | 'confirmed' | 'failed';
  amount?: number;
  fee?: number;
  priorityFee?: number;
  computeUnits?: number;
  error?: string;
};

// Global state
let connection: Connection | null = null;
const transactions: TransactionRecord[] = [];
const wallets: Map<string, {
  publicKey: PublicKey;
  balance: number;
  lastUpdated: Date;
  isBusy: boolean;
}> = new Map();
const auxiliaryWallets: PublicKey[] = [];

/**
 * Initialize the transaction engine
 */
export function initializeTransactionEngine(rpcUrl?: string) {
  try {
    // Use provided RPC URL or fallback to environment variable
    const solanaRpcUrl = rpcUrl || process.env.INSTANT_NODES_RPC_URL || 'https://api.mainnet-beta.solana.com';
    
    // Initialize Solana connection
    connection = new Connection(solanaRpcUrl, 'confirmed');
    
    // Register system wallet
    registerWallet(SYSTEM_WALLET_ADDRESS);
    
    logger.info('Transaction engine initialized successfully');
    logger.info(`Using RPC URL: ${solanaRpcUrl}`);
    
    // Start balance monitoring
    monitorWalletBalances();
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize transaction engine:', error);
    return false;
  }
}

/**
 * Register a wallet for tracking
 */
export function registerWallet(publicKeyStr: string) {
  try {
    const publicKey = new PublicKey(publicKeyStr);
    
    if (!wallets.has(publicKeyStr)) {
      wallets.set(publicKeyStr, {
        publicKey,
        balance: 0,
        lastUpdated: new Date(),
        isBusy: false
      });
      
      // Fetch initial balance
      updateWalletBalance(publicKeyStr);
      
      logger.info(`Wallet registered: ${publicKeyStr}`);
    }
    
    return true;
  } catch (error) {
    logger.error(`Failed to register wallet ${publicKeyStr}:`, error);
    return false;
  }
}

/**
 * Update a wallet's SOL balance
 */
async function updateWalletBalance(publicKeyStr: string) {
  if (!connection) {
    logger.error('Connection not initialized');
    return false;
  }
  
  try {
    const walletInfo = wallets.get(publicKeyStr);
    if (!walletInfo) {
      logger.warn(`Wallet not registered: ${publicKeyStr}`);
      return false;
    }
    
    const balance = await connection.getBalance(walletInfo.publicKey);
    const balanceInSol = balance / solanaWeb3.LAMPORTS_PER_SOL;
    
    // Update wallet info
    walletInfo.balance = balanceInSol;
    walletInfo.lastUpdated = new Date();
    
    // Check if wallet needs funding
    if (balanceInSol < MIN_SOL_BALANCE && publicKeyStr !== SYSTEM_WALLET_ADDRESS) {
      logger.warn(`Wallet ${publicKeyStr} balance (${balanceInSol} SOL) below minimum threshold`);
      // Auto-fund wallet if it's a trading wallet (implement based on your funding strategy)
      // fundWalletFromSystem(publicKeyStr, MIN_SOL_BALANCE - balanceInSol + 0.002);
    }
    
    return balanceInSol;
  } catch (error) {
    logger.error(`Failed to update wallet balance for ${publicKeyStr}:`, error);
    return false;
  }
}

/**
 * Monitor wallet balances periodically
 */
function monitorWalletBalances() {
  const interval = setInterval(async () => {
    if (!connection) {
      logger.warn('Connection not initialized, skipping balance check');
      return;
    }
    
    for (const [address] of wallets) {
      await updateWalletBalance(address);
    }
    
    logger.debug(`Monitored ${wallets.size} wallets`);
  }, 60000); // Check every minute
  
  // Cleanup on process exit
  process.on('exit', () => {
    clearInterval(interval);
  });
}

/**
 * Execute a Solana transaction with fee awareness
 */
export async function executeTransaction(params: {
  type: string;
  instructions: solanaWeb3.TransactionInstruction[];
  signers: Keypair[];
  feePayer?: PublicKey;
  priorityLevel?: 'low' | 'medium' | 'high' | 'max';
  estimatedValue?: number;
}) {
  if (!connection) {
    throw new Error('Transaction engine not initialized');
  }
  
  try {
    const { type, instructions, signers, priorityLevel = 'medium', estimatedValue } = params;
    const feePayer = params.feePayer || (signers[0]?.publicKey);
    
    if (!feePayer) {
      throw new Error('No fee payer specified');
    }
    
    // Check if feePayer wallet is registered and has sufficient balance
    const feePayerStr = feePayer.toBase58();
    const walletInfo = wallets.get(feePayerStr);
    
    if (!walletInfo) {
      logger.warn(`Fee payer wallet ${feePayerStr} not registered, registering now`);
      registerWallet(feePayerStr);
    } else if (walletInfo.isBusy) {
      logger.warn(`Fee payer wallet ${feePayerStr} is busy, waiting for completion`);
      // In production, implement a proper queue mechanism here
    }
    
    // Mark wallet as busy
    if (walletInfo) {
      walletInfo.isBusy = true;
    }
    
    // Create transaction ID
    const txId = uuidv4();
    
    try {
      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      
      // Create transaction
      const transaction = new Transaction({
        feePayer,
        blockhash,
        lastValidBlockHeight
      });
      
      // Add all instructions
      transaction.add(...instructions);
      
      // Add compute budget instruction for priority fee
      const priorityFee = PRIORITY_FEE_LEVELS[priorityLevel];
      if (priorityFee > 0) {
        const priorityFeeInstruction = solanaWeb3.ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: priorityFee
        });
        transaction.add(priorityFeeInstruction);
        
        // Optionally increase compute units for complex transactions
        const computeUnitsInstruction = solanaWeb3.ComputeBudgetProgram.setComputeUnitLimit({
          units: 250000 // Adjust based on transaction complexity
        });
        transaction.add(computeUnitsInstruction);
      }
      
      // Sign transaction
      transaction.sign(...signers);
      
      // Record transaction in history
      const txRecord: TransactionRecord = {
        id: txId,
        signature: 'pending',
        timestamp: new Date(),
        wallet: feePayerStr,
        type,
        status: 'pending',
        priorityFee: priorityFee,
        amount: estimatedValue
      };
      transactions.unshift(txRecord);
      
      // Send transaction
      const signature = await connection.sendTransaction(transaction, signers);
      txRecord.signature = signature;
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature
      });
      
      if (confirmation.value.err) {
        txRecord.status = 'failed';
        txRecord.error = JSON.stringify(confirmation.value.err);
        logger.error(`Transaction ${txId} failed:`, confirmation.value.err);
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      // Get transaction fee
      try {
        const txInfo = await connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0
        });
        
        if (txInfo) {
          txRecord.fee = txInfo.meta?.fee ? txInfo.meta.fee / solanaWeb3.LAMPORTS_PER_SOL : undefined;
          txRecord.computeUnits = txInfo.meta?.computeUnitsConsumed;
        }
      } catch (feeError) {
        logger.warn(`Could not fetch fee info for transaction ${txId}:`, feeError);
      }
      
      // Update transaction status
      txRecord.status = 'confirmed';
      
      // Update wallet balance after transaction
      await updateWalletBalance(feePayerStr);
      
      logger.info(`Transaction ${txId} confirmed with signature ${signature}`);
      
      return {
        success: true,
        id: txId,
        signature,
        fee: txRecord.fee,
        computeUnits: txRecord.computeUnits
      };
    } catch (txError) {
      logger.error(`Transaction ${txId} execution error:`, txError);
      
      // Find and update transaction record
      const txRecord = transactions.find(tx => tx.id === txId);
      if (txRecord) {
        txRecord.status = 'failed';
        txRecord.error = txError.message;
      }
      
      throw txError;
    } finally {
      // Mark wallet as available
      if (walletInfo) {
        walletInfo.isBusy = false;
      }
    }
  } catch (error) {
    logger.error('Transaction execution error:', error);
    throw error;
  }
}

/**
 * Create an auxiliary wallet for high volume periods
 */
export function createAuxiliaryWallet() {
  try {
    // Generate new keypair
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey;
    const publicKeyStr = publicKey.toBase58();
    
    // Store keypair securely (in production, use proper key management)
    const keypairData = {
      publicKey: publicKeyStr,
      secretKey: Array.from(keypair.secretKey)
    };
    
    // In production, use a secure key management solution
    // For this demo, we're just creating the keypair
    
    // Register wallet
    registerWallet(publicKeyStr);
    auxiliaryWallets.push(publicKey);
    
    logger.info(`Created auxiliary wallet: ${publicKeyStr}`);
    
    return {
      publicKey: publicKeyStr,
      keypairData
    };
  } catch (error) {
    logger.error('Failed to create auxiliary wallet:', error);
    throw error;
  }
}

/**
 * Get all registered wallets with their balances
 */
export function getRegisteredWallets() {
  const result = [];
  
  for (const [address, info] of wallets.entries()) {
    result.push({
      address,
      balance: info.balance,
      lastUpdated: info.lastUpdated.toISOString(),
      isSystemWallet: address === SYSTEM_WALLET_ADDRESS,
      isAuxiliary: auxiliaryWallets.some(pk => pk.toBase58() === address),
      isBusy: info.isBusy
    });
  }
  
  return result;
}

/**
 * Get transaction history
 */
export function getTransactionHistory(limit = 50) {
  return transactions.slice(0, limit);
}

/**
 * Fund a wallet from the system wallet
 */
export async function fundWalletFromSystem(destinationAddress: string, amountSol: number) {
  if (!connection) {
    throw new Error('Transaction engine not initialized');
  }
  
  try {
    // Validate destination address
    const destinationPubkey = new PublicKey(destinationAddress);
    
    // Get system wallet info (in real implementation, you'd securely access the private key)
    // For demo purposes, let's assume we don't have the system wallet private key
    
    logger.info(`Funding ${destinationAddress} with ${amountSol} SOL from system wallet`);
    
    // In a real implementation, you would:
    // 1. Create a transfer instruction
    // 2. Execute the transaction with the system wallet keypair
    
    // Since we don't have the private key here, just log the intention
    logger.warn(`Wallet funding request created (demo): ${amountSol} SOL to ${destinationAddress}`);
    
    return {
      success: true,
      message: `Funding requested for ${destinationAddress} (${amountSol} SOL)`
    };
  } catch (error) {
    logger.error(`Failed to fund wallet ${destinationAddress}:`, error);
    throw error;
  }
}

// Export additional methods
export const transactionEngine = {
  initializeTransactionEngine,
  registerWallet,
  executeTransaction,
  getRegisteredWallets,
  getTransactionHistory,
  createAuxiliaryWallet,
  fundWalletFromSystem
};

export default transactionEngine;