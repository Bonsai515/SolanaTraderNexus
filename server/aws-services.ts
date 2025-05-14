/**
 * AWS Integration Services for Blockchain Verification
 * 
 * This module provides integration with AWS services for blockchain verification.
 * It ensures that all transactions reported by the system are actually executed
 * on the Solana blockchain, validated via Solscan API, and synchronized with wallet balances.
 */

import AWS from 'aws-sdk';
import axios from 'axios';
import * as logger from './logger';
import { WalletManager } from './lib/walletManager';
import * as fs from 'fs';
import * as path from 'path';

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1' // Default region
});

// Initialize AWS services
const lambda = new AWS.Lambda();
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Transaction verification log constants
const VERIFIED_TRANSACTIONS_LOG = path.join(process.cwd(), 'logs', 'verified_transactions.json');
const VERIFICATION_FAILURES_LOG = path.join(process.cwd(), 'logs', 'verification_failures.json');

// Initialize log files if they don't exist
function initLogFiles() {
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  if (!fs.existsSync(VERIFIED_TRANSACTIONS_LOG)) {
    fs.writeFileSync(VERIFIED_TRANSACTIONS_LOG, JSON.stringify([], null, 2));
  }
  
  if (!fs.existsSync(VERIFICATION_FAILURES_LOG)) {
    fs.writeFileSync(VERIFICATION_FAILURES_LOG, JSON.stringify([], null, 2));
  }
}

// Solscan URL constants
const SOLSCAN_BASE_URL = 'https://api.solscan.io';
const SOLSCAN_ACCOUNT_URL = `${SOLSCAN_BASE_URL}/account`;
const SOLSCAN_TRANSACTION_URL = `${SOLSCAN_BASE_URL}/transaction`;

/**
 * Transaction Verification Service
 * 
 * This class provides methods to verify transactions on the Solana blockchain
 * and synchronize wallet balances.
 */
export class TransactionVerificationService {
  private walletManager: WalletManager;
  private verifiedTransactions: Map<string, any> = new Map();
  private failedVerifications: Map<string, any> = new Map();
  
  constructor() {
    this.walletManager = new WalletManager();
    initLogFiles();
    this.loadTransactionLogs();
    
    logger.info('AWS Transaction Verification Service initialized');
  }
  
  /**
   * Load transaction logs from files
   */
  private loadTransactionLogs() {
    try {
      const verifiedData = JSON.parse(fs.readFileSync(VERIFIED_TRANSACTIONS_LOG, 'utf8'));
      verifiedData.forEach((tx: any) => {
        this.verifiedTransactions.set(tx.signature, tx);
      });
      
      const failedData = JSON.parse(fs.readFileSync(VERIFICATION_FAILURES_LOG, 'utf8'));
      failedData.forEach((tx: any) => {
        this.failedVerifications.set(tx.signature, tx);
      });
      
      logger.info(`Loaded ${this.verifiedTransactions.size} verified transactions and ${this.failedVerifications.size} failed verifications`);
    } catch (error) {
      logger.error('Error loading transaction logs:', error);
    }
  }
  
  /**
   * Save transaction logs to files
   */
  private saveTransactionLogs() {
    try {
      const verifiedData = Array.from(this.verifiedTransactions.values());
      fs.writeFileSync(VERIFIED_TRANSACTIONS_LOG, JSON.stringify(verifiedData, null, 2));
      
      const failedData = Array.from(this.failedVerifications.values());
      fs.writeFileSync(VERIFICATION_FAILURES_LOG, JSON.stringify(failedData, null, 2));
    } catch (error) {
      logger.error('Error saving transaction logs:', error);
    }
  }
  
  /**
   * Verify a transaction on the Solana blockchain via Solscan
   * @param signature Transaction signature
   * @returns Promise resolving to verification result
   */
  public async verifyTransaction(signature: string): Promise<any> {
    // Check if already verified
    if (this.verifiedTransactions.has(signature)) {
      return this.verifiedTransactions.get(signature);
    }
    
    try {
      // Query Solscan API for transaction details
      const response = await axios.get(`${SOLSCAN_TRANSACTION_URL}/${signature}`);
      
      if (response.data && response.data.status === 'Success') {
        const verificationResult = {
          signature,
          verified: true,
          timestamp: Date.now(),
          blockTime: response.data.blockTime,
          slot: response.data.slot,
          fee: response.data.fee,
          status: response.data.status,
          confirmations: response.data.confirmations,
          solscanUrl: `https://solscan.io/tx/${signature}`
        };
        
        // Store verification result
        this.verifiedTransactions.set(signature, verificationResult);
        this.saveTransactionLogs();
        
        logger.info(`Transaction ${signature} verified on blockchain ✓`);
        return verificationResult;
      } else {
        const failureResult = {
          signature,
          verified: false,
          timestamp: Date.now(),
          error: 'Transaction not found or failed',
          solscanResponse: response.data,
          solscanUrl: `https://solscan.io/tx/${signature}`
        };
        
        // Store failure result
        this.failedVerifications.set(signature, failureResult);
        this.saveTransactionLogs();
        
        logger.error(`Transaction ${signature} verification failed: not found or failed on blockchain`);
        return failureResult;
      }
    } catch (error) {
      const failureResult = {
        signature,
        verified: false,
        timestamp: Date.now(),
        error: error.message || 'Unknown error',
        solscanUrl: `https://solscan.io/tx/${signature}`
      };
      
      // Store failure result
      this.failedVerifications.set(signature, failureResult);
      this.saveTransactionLogs();
      
      logger.error(`Transaction ${signature} verification failed: ${error.message}`);
      return failureResult;
    }
  }
  
  /**
   * Verify wallet balance against blockchain
   * @param walletAddress Wallet address to verify
   * @returns Promise resolving to verification result
   */
  public async verifyWalletBalance(walletAddress: string): Promise<any> {
    try {
      // Query Solscan API for wallet details
      const response = await axios.get(`${SOLSCAN_ACCOUNT_URL}/${walletAddress}`);
      
      if (response.data && response.data.lamports !== undefined) {
        const balanceInLamports = response.data.lamports;
        const balanceInSOL = balanceInLamports / 1000000000; // Convert lamports to SOL
        
        // Update wallet balance in wallet manager
        const wallet = this.walletManager.getAllWallets().find(w => w.publicKey === walletAddress);
        if (wallet) {
          this.walletManager.updateWalletBalance(walletAddress, balanceInSOL);
        }
        
        return {
          walletAddress,
          verified: true,
          timestamp: Date.now(),
          balanceInLamports,
          balanceInSOL,
          solscanUrl: `https://solscan.io/account/${walletAddress}`
        };
      } else {
        logger.error(`Wallet ${walletAddress} verification failed: invalid Solscan response`);
        return {
          walletAddress,
          verified: false,
          timestamp: Date.now(),
          error: 'Invalid Solscan response',
          solscanUrl: `https://solscan.io/account/${walletAddress}`
        };
      }
    } catch (error) {
      logger.error(`Wallet ${walletAddress} verification failed: ${error.message}`);
      return {
        walletAddress,
        verified: false,
        timestamp: Date.now(),
        error: error.message || 'Unknown error',
        solscanUrl: `https://solscan.io/account/${walletAddress}`
      };
    }
  }
  
  /**
   * Store transaction verification data in AWS DynamoDB
   * @param verificationData Verification data to store
   * @returns Promise resolving to DynamoDB result
   */
  public async storeVerificationData(verificationData: any): Promise<any> {
    try {
      const params = {
        TableName: 'SolanaTransactionVerifications',
        Item: {
          ...verificationData,
          id: verificationData.signature || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
          timestamp: verificationData.timestamp || Date.now()
        }
      };
      
      // Put item in DynamoDB
      return await dynamoDB.put(params).promise();
    } catch (error) {
      logger.error('Error storing verification data in DynamoDB:', error);
      return { error: error.message || 'Unknown error' };
    }
  }
  
  /**
   * Verify multiple transactions and update system state
   * @param signatures Array of transaction signatures to verify
   * @returns Promise resolving to array of verification results
   */
  public async verifyMultipleTransactions(signatures: string[]): Promise<any[]> {
    const results = [];
    
    for (const signature of signatures) {
      const result = await this.verifyTransaction(signature);
      results.push(result);
      
      // Optionally store in DynamoDB if AWS credentials are set
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        await this.storeVerificationData(result);
      }
    }
    
    return results;
  }
  
  /**
   * Create a verification report for system wallets
   * @returns Verification report for all system wallets
   */
  public async createVerificationReport(): Promise<any> {
    const wallets = this.walletManager.getAllWallets();
    const report = {
      timestamp: Date.now(),
      wallets: [],
      verifiedTransactions: this.verifiedTransactions.size,
      failedVerifications: this.failedVerifications.size,
      latestVerifiedTransaction: Array.from(this.verifiedTransactions.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5)
    };
    
    // Verify each wallet
    for (const wallet of wallets) {
      const verification = await this.verifyWalletBalance(wallet.publicKey);
      report.wallets.push({
        label: wallet.label,
        type: wallet.type,
        publicKey: wallet.publicKey,
        balanceVerification: verification
      });
    }
    
    return report;
  }
  
  /**
   * Get all verified transactions
   * @returns Array of verified transactions
   */
  public getAllVerifiedTransactions(): any[] {
    return Array.from(this.verifiedTransactions.values());
  }
  
  /**
   * Get all failed verifications
   * @returns Array of failed verifications
   */
  public getAllFailedVerifications(): any[] {
    return Array.from(this.failedVerifications.values());
  }
}

// Create and export singleton instance
export const transactionVerifier = new TransactionVerificationService();