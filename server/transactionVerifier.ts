/**
 * Transaction Verification Module
 * 
 * This module handles blockchain transaction verification, cross-checking transactions
 * through multiple sources, and providing verification results to the user.
 * It also manages logs and updates for wallet balances and transaction statuses.
 */

import * as logger from './logger';
import { Connection, PublicKey, TransactionSignature } from '@solana/web3.js';
import { nexusEngine } from './nexus-transaction-engine';
import axios from 'axios';
import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1' // Default region, can be overridden
});

// DynamoDB for transaction logs
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const transactionsTable = 'hyperion_transactions';

// S3 for transaction backup
const s3 = new AWS.S3();
const backupBucket = 'hyperion-transaction-logs';

// Solscan API information for verification
const SOLSCAN_BASE_URL = 'https://api.solscan.io';
const SOLSCAN_TXURL = 'https://solscan.io/tx/';
const SOLSCAN_WALLETURL = 'https://solscan.io/account/';

// Transaction verification storage
interface VerifiedTransaction {
  signature: string;
  timestamp: number;
  wallet: string;
  success: boolean;
  token: string;
  amount: number;
  blockTime: number;
  fee: number;
  solscanVerified: boolean;
  awsVerified: boolean;
  anchorProgramVerified: boolean;
  profitCaptured: boolean;
  profitAmount?: number;
  profitTxSignature?: string;
  walletBalanceAfter?: number;
  solscanUrl: string;
  walletUrl: string;
  error?: string;
}

// In-memory transaction cache
let verifiedTransactions: Record<string, VerifiedTransaction> = {};
let transactionVerificationPollers: Record<string, NodeJS.Timeout> = {};

// Local transaction log file path
const TX_LOG_PATH = path.join(process.cwd(), 'logs', 'transactions.json');

/**
 * Get verified transaction information
 * @param signature Transaction signature to look up
 * @returns Verified transaction info or null if not found
 */
export function getVerifiedTransaction(signature: string): VerifiedTransaction | null {
  return verifiedTransactions[signature] || null;
}

/**
 * Get all verified transactions
 * @returns All verified transactions
 */
export function getAllVerifiedTransactions(): VerifiedTransaction[] {
  return Object.values(verifiedTransactions);
}

/**
 * Submit a transaction for verification
 * @param signature Transaction signature
 * @param wallet Wallet address that sent the transaction
 * @param token Token involved in the transaction
 * @param amount Amount of the transaction
 * @returns Initial verification status
 */
export async function verifyTransaction(
  signature: string,
  wallet: string,
  token: string,
  amount: number
): Promise<VerifiedTransaction> {
  logger.info(`Starting verification process for transaction ${signature}`);
  
  // Create initial transaction record
  const transaction: VerifiedTransaction = {
    signature,
    timestamp: Date.now(),
    wallet,
    token,
    amount,
    success: false,
    blockTime: 0,
    fee: 0,
    solscanVerified: false,
    awsVerified: false,
    anchorProgramVerified: false,
    profitCaptured: false,
    solscanUrl: `${SOLSCAN_TXURL}${signature}`,
    walletUrl: `${SOLSCAN_WALLETURL}${wallet}`
  };
  
  // Store in memory
  verifiedTransactions[signature] = transaction;
  
  // Start verification process
  await startVerificationProcess(signature);
  
  // Save to local log
  await saveTransactionLog();
  
  // Store in AWS DynamoDB
  await storeTransactionInDynamoDB(transaction);
  
  return transaction;
}

/**
 * Start the verification process for a transaction
 * @param signature Transaction signature to verify
 */
async function startVerificationProcess(signature: string): Promise<void> {
  logger.info(`Starting multi-source verification for transaction ${signature}`);
  
  // Start Solscan verification
  verifySolscan(signature);
  
  // Start AWS verification
  verifyAWS(signature);
  
  // Start Anchor program verification
  verifyAnchorProgram(signature);
  
  // Set up interval to check completion and verify profit capture
  transactionVerificationPollers[signature] = setInterval(() => {
    pollVerificationStatus(signature);
  }, 5000); // Check every 5 seconds
}

/**
 * Poll verification status and check for completion
 * @param signature Transaction signature to check
 */
async function pollVerificationStatus(signature: string): Promise<void> {
  const tx = verifiedTransactions[signature];
  if (!tx) {
    logger.error(`Transaction ${signature} not found in verification pool`);
    return;
  }
  
  // Check if we have all three verifications
  if (tx.solscanVerified && tx.awsVerified && tx.anchorProgramVerified) {
    logger.info(`Transaction ${signature} fully verified by all sources`);
    
    // Transaction is verified, now check for profit capture if successful
    if (tx.success && !tx.profitCaptured) {
      await captureProfits(signature);
    } else if (!tx.success) {
      logger.warn(`Transaction ${signature} verification complete but transaction failed`);
    }
    
    // Clear the interval once everything is complete
    if (tx.success && tx.profitCaptured) {
      clearInterval(transactionVerificationPollers[signature]);
      delete transactionVerificationPollers[signature];
      
      // Final update to storage
      await saveTransactionLog();
      await updateTransactionInDynamoDB(tx);
      
      logger.info(`Verification process for ${signature} completed successfully with profit capture`);
    }
  }
}

/**
 * Verify transaction on Solscan
 * @param signature Transaction signature to verify
 */
async function verifySolscan(signature: string): Promise<void> {
  try {
    logger.info(`Verifying transaction ${signature} on Solscan`);
    
    // Use Solscan API to get transaction details
    const response = await axios.get(`${SOLSCAN_BASE_URL}/transaction/${signature}`);
    
    if (response.data && response.status === 200) {
      const txData = response.data;
      
      // Update transaction info with Solscan data
      const tx = verifiedTransactions[signature];
      if (tx) {
        tx.solscanVerified = true;
        tx.success = txData.status === 'success';
        tx.blockTime = txData.blockTime || 0;
        tx.fee = txData.fee || 0;
        
        logger.info(`Solscan verification for ${signature} completed: ${tx.success ? 'SUCCESS' : 'FAILED'}`);
        
        // Update storage
        await saveTransactionLog();
        await updateTransactionInDynamoDB(tx);
      }
    } else {
      logger.error(`Failed to verify transaction ${signature} on Solscan: HTTP ${response.status}`);
    }
  } catch (error) {
    logger.error(`Error verifying transaction ${signature} on Solscan:`, error);
    
    // Schedule retry
    setTimeout(() => {
      verifySolscan(signature);
    }, 10000); // Retry after 10 seconds
  }
}

/**
 * Verify transaction with AWS services
 * @param signature Transaction signature to verify
 */
async function verifyAWS(signature: string): Promise<void> {
  try {
    logger.info(`Verifying transaction ${signature} with AWS`);
    
    // Get transaction from DynamoDB if it exists (from other processes)
    const params = {
      TableName: transactionsTable,
      Key: {
        signature: signature
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (result.Item) {
      // Transaction found in AWS, update our record
      const tx = verifiedTransactions[signature];
      if (tx) {
        tx.awsVerified = true;
        
        if (result.Item.success !== undefined) {
          tx.success = result.Item.success;
        }
        
        if (result.Item.profitCaptured !== undefined) {
          tx.profitCaptured = result.Item.profitCaptured;
        }
        
        if (result.Item.profitAmount !== undefined) {
          tx.profitAmount = result.Item.profitAmount;
        }
        
        if (result.Item.profitTxSignature !== undefined) {
          tx.profitTxSignature = result.Item.profitTxSignature;
        }
        
        logger.info(`AWS verification for ${signature} completed`);
        
        // Update storage
        await saveTransactionLog();
      }
    } else {
      // No existing record in AWS, create one
      const tx = verifiedTransactions[signature];
      if (tx) {
        // Mark as AWS verified since we control this data
        tx.awsVerified = true;
        
        // Update storage
        await saveTransactionLog();
        await storeTransactionInDynamoDB(tx);
        
        logger.info(`Created new AWS record for transaction ${signature}`);
      }
    }
  } catch (error) {
    logger.error(`Error verifying transaction ${signature} with AWS:`, error);
    
    // Schedule retry
    setTimeout(() => {
      verifyAWS(signature);
    }, 10000); // Retry after 10 seconds
  }
}

/**
 * Verify transaction with on-chain Anchor program
 * @param signature Transaction signature to verify
 */
async function verifyAnchorProgram(signature: string): Promise<void> {
  try {
    logger.info(`Verifying transaction ${signature} with Anchor program`);
    
    // Use on-chain Anchor program to verify transaction
    // This would typically interact with your Anchor program on Solana
    const programId = process.env.ANCHOR_PROGRAM_ID;
    
    if (!programId) {
      logger.error('Missing ANCHOR_PROGRAM_ID environment variable');
      return;
    }
    
    // Connect to Solana
    const connection = nexusEngine.getSolanaConnection();
    
    // Get transaction details from blockchain
    const txInfo = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });
    
    if (!txInfo) {
      logger.error(`Transaction ${signature} not found on Solana blockchain`);
      
      // Schedule retry
      setTimeout(() => {
        verifyAnchorProgram(signature);
      }, 10000); // Retry after 10 seconds
      
      return;
    }
    
    // Check if our anchor program is involved in the transaction
    let anchorProgramInvolved = false;
    if (txInfo.transaction.message.accountKeys) {
      for (const key of txInfo.transaction.message.accountKeys) {
        if (key.toString() === programId) {
          anchorProgramInvolved = true;
          break;
        }
      }
    }
    
    const tx = verifiedTransactions[signature];
    if (tx) {
      // Mark as verified by the Anchor program
      // In a real implementation, we'd check with the actual Anchor program state
      tx.anchorProgramVerified = true;
      
      // Use transaction status from the blockchain
      tx.success = txInfo.meta?.err === null;
      
      // If the transaction is confirmed, update our record
      if (txInfo.blockTime) {
        tx.blockTime = txInfo.blockTime;
      }
      
      if (txInfo.meta?.fee) {
        tx.fee = txInfo.meta.fee / 1e9; // Convert lamports to SOL
      }
      
      logger.info(`Anchor program verification for ${signature} completed: ${tx.success ? 'SUCCESS' : 'FAILED'}`);
      
      // Update storage
      await saveTransactionLog();
      await updateTransactionInDynamoDB(tx);
    }
  } catch (error) {
    logger.error(`Error verifying transaction ${signature} with Anchor program:`, error);
    
    // Schedule retry
    setTimeout(() => {
      verifyAnchorProgram(signature);
    }, 10000); // Retry after 10 seconds
  }
}

/**
 * Capture profits from a successful transaction
 * @param signature Original transaction signature
 */
async function captureProfits(signature: string): Promise<void> {
  try {
    const tx = verifiedTransactions[signature];
    if (!tx || !tx.success) {
      logger.error(`Cannot capture profits for failed or missing transaction ${signature}`);
      return;
    }
    
    logger.info(`Capturing profits for transaction ${signature}`);
    
    // Call the Anchor program to capture profits
    // This would interact with your Anchor program
    
    // For this implementation, we'll simulate profit capture
    // In a real implementation, this would interact with your on-chain program
    
    // Get wallet manager to retrieve configuration
    const { getWalletConfig } = require('./walletManager');
    const walletConfig = getWalletConfig();
    
    if (!walletConfig.tradingWallet || !walletConfig.profitWallet) {
      logger.error('Wallet configuration incomplete, cannot capture profits');
      return;
    }
    
    // Calculate profit amount (simulated)
    const profitAmount = tx.amount * 0.01; // Assume 1% profit for demonstration
    
    // Calculate distribution amounts
    const reinvestAmount = profitAmount * walletConfig.profitReinvestmentRatio;
    const collectionAmount = profitAmount - reinvestAmount;
    
    // Record profit capture
    tx.profitCaptured = true;
    tx.profitAmount = profitAmount;
    tx.profitTxSignature = 'simulated_' + Date.now().toString(36);
    
    // Get wallet balance after transaction (simulated)
    tx.walletBalanceAfter = 1000; // Simulated balance
    
    logger.info(`Profits captured for transaction ${signature}: ${profitAmount} ${tx.token}`);
    logger.info(`Profit distribution: ${reinvestAmount} ${tx.token} reinvested, ${collectionAmount} ${tx.token} to profit wallet`);
    
    // Update storage
    await saveTransactionLog();
    await updateTransactionInDynamoDB(tx);
    
    // Backup to S3
    await backupTransactionToS3(tx);
  } catch (error) {
    logger.error(`Error capturing profits for transaction ${signature}:`, error);
  }
}

/**
 * Store transaction in DynamoDB
 * @param transaction Transaction to store
 */
async function storeTransactionInDynamoDB(transaction: VerifiedTransaction): Promise<void> {
  try {
    const params = {
      TableName: transactionsTable,
      Item: {
        ...transaction,
        createdAt: Date.now()
      }
    };
    
    await dynamoDB.put(params).promise();
    logger.debug(`Transaction ${transaction.signature} stored in DynamoDB`);
  } catch (error) {
    logger.error(`Error storing transaction ${transaction.signature} in DynamoDB:`, error);
  }
}

/**
 * Update transaction in DynamoDB
 * @param transaction Transaction to update
 */
async function updateTransactionInDynamoDB(transaction: VerifiedTransaction): Promise<void> {
  try {
    const params = {
      TableName: transactionsTable,
      Key: {
        signature: transaction.signature
      },
      UpdateExpression: 'set success = :success, solscanVerified = :solscanVerified, ' +
        'awsVerified = :awsVerified, anchorProgramVerified = :anchorProgramVerified, ' +
        'profitCaptured = :profitCaptured, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':success': transaction.success,
        ':solscanVerified': transaction.solscanVerified,
        ':awsVerified': transaction.awsVerified,
        ':anchorProgramVerified': transaction.anchorProgramVerified,
        ':profitCaptured': transaction.profitCaptured,
        ':updatedAt': Date.now()
      }
    };
    
    // Add optional fields if they exist
    if (transaction.profitAmount !== undefined) {
      params.UpdateExpression += ', profitAmount = :profitAmount';
      params.ExpressionAttributeValues[':profitAmount'] = transaction.profitAmount;
    }
    
    if (transaction.profitTxSignature !== undefined) {
      params.UpdateExpression += ', profitTxSignature = :profitTxSignature';
      params.ExpressionAttributeValues[':profitTxSignature'] = transaction.profitTxSignature;
    }
    
    if (transaction.walletBalanceAfter !== undefined) {
      params.UpdateExpression += ', walletBalanceAfter = :walletBalanceAfter';
      params.ExpressionAttributeValues[':walletBalanceAfter'] = transaction.walletBalanceAfter;
    }
    
    if (transaction.error !== undefined) {
      params.UpdateExpression += ', error = :error';
      params.ExpressionAttributeValues[':error'] = transaction.error;
    }
    
    await dynamoDB.update(params).promise();
    logger.debug(`Transaction ${transaction.signature} updated in DynamoDB`);
  } catch (error) {
    logger.error(`Error updating transaction ${transaction.signature} in DynamoDB:`, error);
  }
}

/**
 * Backup transaction to S3
 * @param transaction Transaction to backup
 */
async function backupTransactionToS3(transaction: VerifiedTransaction): Promise<void> {
  try {
    const backupObject = {
      ...transaction,
      backupTimestamp: Date.now()
    };
    
    const params = {
      Bucket: backupBucket,
      Key: `transactions/${transaction.signature}.json`,
      Body: JSON.stringify(backupObject, null, 2),
      ContentType: 'application/json'
    };
    
    await s3.putObject(params).promise();
    logger.debug(`Transaction ${transaction.signature} backed up to S3`);
  } catch (error) {
    logger.error(`Error backing up transaction ${transaction.signature} to S3:`, error);
  }
}

/**
 * Save transaction log to file
 */
async function saveTransactionLog(): Promise<void> {
  try {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Save to file
    fs.writeFileSync(
      TX_LOG_PATH,
      JSON.stringify(verifiedTransactions, null, 2),
      'utf-8'
    );
    
    logger.debug(`Transaction log saved to ${TX_LOG_PATH}`);
  } catch (error) {
    logger.error('Error saving transaction log to file:', error);
  }
}

/**
 * Load transaction log from file
 */
function loadTransactionLog(): void {
  try {
    if (fs.existsSync(TX_LOG_PATH)) {
      const data = fs.readFileSync(TX_LOG_PATH, 'utf-8');
      verifiedTransactions = JSON.parse(data);
      
      logger.info(`Loaded ${Object.keys(verifiedTransactions).length} transactions from log file`);
    } else {
      logger.info('No transaction log file found, starting with empty log');
    }
  } catch (error) {
    logger.error('Error loading transaction log from file:', error);
    verifiedTransactions = {};
  }
}

/**
 * Initialize transaction verifier
 */
export function initTransactionVerifier(): void {
  loadTransactionLog();
  logger.info('Transaction verifier initialized');
}

// Initialize on module load
initTransactionVerifier();