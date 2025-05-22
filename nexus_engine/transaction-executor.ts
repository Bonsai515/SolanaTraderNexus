/**
 * Transaction Executor
 * 
 * This module executes real blockchain transactions for the Nexus engine
 */

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  sendAndConfirmTransaction, 
  Keypair,
  SystemProgram,
  TransactionInstruction
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Trading wallet
const TRADING_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Load transaction settings
const CONFIG_DIR = './nexus_engine';
const settingsPath = path.join(CONFIG_DIR, 'trader-config.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

// Execute a transaction
export async function executeTransaction(
  instructions: TransactionInstruction[],
  signers: Keypair[],
  strategy: string
): Promise<string> {
  // Force real execution when forceTradingOn is enabled
  if (settings.tradingLogic.forceTradingOn) {
    try {
      // Connect to Solana
      const connection = new Connection(
        settings.rpc?.primaryEndpoint || 'https://api.mainnet-beta.solana.com',
        settings.transactionSettings.confirmationTarget
      );
      
      // Create transaction
      const transaction = new Transaction();
      
      // Add instructions
      transaction.add(...instructions);
      
      // Set recent blockhash
      transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
      
      // Sign transaction
      transaction.sign(...signers);
      
      // Send transaction
      const txid = await sendAndConfirmTransaction(
        connection,
        transaction,
        signers,
        {
          skipPreflight: settings.transactionSettings.skipPreflight,
          preflightCommitment: settings.transactionSettings.confirmationTarget,
          maxRetries: settings.transactionSettings.maxRetries
        }
      );
      
      console.log(`✅ Transaction executed successfully: ${txid}`);
      
      // Log transaction
      logTransaction({
        strategy,
        txid,
        status: 'success',
        timestamp: new Date().toISOString()
      });
      
      return txid;
    } catch (error: any) {
      console.error(`Error executing transaction: ${error.message}`);
      
      // Log failed transaction
      logTransaction({
        strategy,
        txid: 'failed',
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  } else {
    // Simulate if real trading is not forced
    console.log('Simulating transaction (real trading not forced)');
    return `simulated_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }
}

// Log transaction to file
function logTransaction(data: any): void {
  try {
    const logDir = './logs/transactions';
    
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Create log file path
    const today = new Date().toISOString().split('T')[0];
    const logPath = path.join(logDir, `transactions-${today}.json`);
    
    // Read existing logs or create new array
    let logs = [];
    if (fs.existsSync(logPath)) {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }
    
    // Add new log
    logs.push(data);
    
    // Write updated logs
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  } catch (error: any) {
    console.error(`Error logging transaction: ${error.message}`);
  }
}