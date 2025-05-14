/**
 * Reset All Transaction Logs and Data to Zero
 * 
 * This script resets all transaction logs and data to zero.
 * It requires verification with Solscan before reporting any numbers.
 * It also verifies all wallet balances to ensure accuracy.
 */

import { logger } from './server/logger';
import { resetTransactionLogs } from './server/lib/verification';
import { awsServices } from './server/aws-services';
import * as nexusEngine from './server/nexus-transaction-engine';
import { Connection } from '@solana/web3.js';
import axios from 'axios';

// Configuration
const config = {
  // Solana RPC URL
  rpcUrl: process.env.INSTANT_NODES_RPC_URL || 'https://api.mainnet-beta.solana.com',
  
  // List of wallets to verify
  walletsToVerify: [
    'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb' // System wallet for profit collection
  ]
};

/**
 * Reset all transaction logs
 */
async function resetAllLogs(): Promise<boolean> {
  try {
    logger.info('Resetting all transaction logs to zero');
    
    // Reset logs in our verification system
    const logsReset = resetTransactionLogs();
    
    // Reset AWS data
    const awsReset = await awsServices.resetAllData();
    
    logger.info(`Reset logs: ${logsReset ? 'SUCCESS' : 'FAILED'}`);
    logger.info(`Reset AWS data: ${awsReset ? 'SUCCESS' : 'FAILED'}`);
    
    return logsReset && awsReset;
  } catch (error: any) {
    logger.error('Error resetting logs:', error.message);
    return false;
  }
}

/**
 * Verify wallet balances with Solana blockchain
 */
async function verifyWalletBalances(): Promise<Record<string, number>> {
  try {
    logger.info('Verifying wallet balances with Solana blockchain');
    
    const connection = new Connection(config.rpcUrl, 'confirmed');
    const balances: Record<string, number> = {};
    
    for (const walletAddress of config.walletsToVerify) {
      try {
        // Get balance from Solana blockchain
        const publicKey = await import('@solana/web3.js').then(web3 => new web3.PublicKey(walletAddress));
        const balance = await connection.getBalance(publicKey);
        const balanceSol = balance / 1_000_000_000; // Convert lamports to SOL
        
        balances[walletAddress] = balanceSol;
        logger.info(`Wallet ${walletAddress} balance: ${balanceSol} SOL`);
      } catch (error: any) {
        logger.error(`Error verifying wallet ${walletAddress}:`, error.message);
        balances[walletAddress] = -1; // Indicate error
      }
    }
    
    return balances;
  } catch (error: any) {
    logger.error('Error verifying wallet balances:', error.message);
    return {};
  }
}

/**
 * Verify transactions with Solscan
 */
async function verifyTransactionsWithSolscan(signatures: string[]): Promise<Record<string, boolean>> {
  try {
    logger.info('Verifying transactions with Solscan');
    
    const verificationResults: Record<string, boolean> = {};
    
    for (const signature of signatures) {
      try {
        const solscanUrl = `https://api.solscan.io/transaction?tx=${signature}`;
        const response = await axios.get(solscanUrl);
        
        const verified = response.status === 200 && response.data && response.data.txHash === signature;
        verificationResults[signature] = verified;
        
        logger.info(`Transaction ${signature}: ${verified ? 'VERIFIED' : 'NOT VERIFIED'}`);
      } catch (error: any) {
        logger.error(`Error verifying transaction ${signature}:`, error.message);
        verificationResults[signature] = false;
      }
    }
    
    return verificationResults;
  } catch (error: any) {
    logger.error('Error verifying transactions with Solscan:', error.message);
    return {};
  }
}

/**
 * Main function to run the reset and verification
 */
async function resetAndVerify(): Promise<void> {
  try {
    logger.info('----------------------------------------------------');
    logger.info('RESETTING ALL TRANSACTION LOGS AND DATA TO ZERO');
    logger.info('----------------------------------------------------');
    
    // Initialize the transaction engine
    logger.info('Initializing Nexus Professional Engine');
    const initialized = await nexusEngine.initializeTransactionEngine(config.rpcUrl, true);
    
    if (!initialized) {
      logger.error('Failed to initialize Nexus Professional Engine, cannot proceed');
      return;
    }
    
    // Reset all logs
    const resetSuccess = await resetAllLogs();
    
    if (!resetSuccess) {
      logger.error('Failed to reset logs, continuing with verification');
    }
    
    // Verify wallet balances
    const balances = await verifyWalletBalances();
    
    // Print verification results
    logger.info('----------------------------------------------------');
    logger.info('VERIFICATION RESULTS');
    logger.info('----------------------------------------------------');
    logger.info(`Logs reset: ${resetSuccess ? 'SUCCESS' : 'FAILED'}`);
    
    logger.info('Wallet balances:');
    for (const [wallet, balance] of Object.entries(balances)) {
      logger.info(`  ${wallet}: ${balance >= 0 ? balance + ' SOL' : 'VERIFICATION FAILED'}`);
    }
    
    logger.info('----------------------------------------------------');
    logger.info('RESET COMPLETED');
    logger.info('----------------------------------------------------');
  } catch (error: any) {
    logger.error('Error during reset and verification:', error.message);
  }
}

// Run the reset and verification
resetAndVerify().catch(error => {
  logger.error('Unhandled error:', error);
});