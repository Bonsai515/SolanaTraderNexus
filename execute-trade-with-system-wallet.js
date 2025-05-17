/**
 * Execute Real Trading with System Wallet
 * 
 * This script executes a real blockchain transaction using your system wallet
 * with Alchemy RPC for reliable connections.
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Your system wallet configuration - this is the wallet we're trading with
const WALLET_CONFIG = {
  publicKey: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
  
  // Private key as hex string provided earlier
  privateKeyHex: 'abbe6e9fb2734ace98c7047a3f2b5bd685f968681f7d1f637ac7bdd371fdbeb9f2aa0be1913871cf01070611b8417678e6f0aa5feb444e899f7cd85ee5cbc4bb'
};

// RPC Configuration - using Alchemy for reliable connections
const RPC_URL = 'https://solana-mainnet.g.alchemy.com/v2/PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR';

// Trading parameters
const TRADE_PARAMS = {
  amount: 1.1, // SOL to trade in flash loans
  testTransactionAmount: 0.000001, // Tiny test transaction (0.000001 SOL)
  slippageBps: 30 // 0.3% slippage
};

// Helper functions
const lamportsToSol = (lamports) => lamports / 1_000_000_000;
const solToLamports = (sol) => sol * 1_000_000_000;

/**
 * Create wallet from private key hex string
 */
function createWalletFromHex(hexString) {
  try {
    // Remove any whitespace or newlines
    const cleanHex = hexString.replace(/\s+/g, '');
    
    // Convert hex string to byte array
    const privateKeyBytes = new Uint8Array(Buffer.from(cleanHex, 'hex'));
    
    // Create keypair from private key bytes
    return Keypair.fromSecretKey(privateKeyBytes);
  } catch (error) {
    console.error('Error creating wallet from private key:', error);
    throw error;
  }
}

/**
 * Execute a real blockchain transaction
 */
async function executeRealTransaction(connection, wallet, amountSol) {
  try {
    console.log('\nExecuting real blockchain transaction...');
    
    // Record starting time for performance tracking
    const startTime = Date.now();
    
    // Amount in lamports for the test transaction
    const lamports = solToLamports(amountSol);
    
    // Create a simple transfer transaction to self
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey, // Send to self
        lamports // Convert SOL to lamports
      })
    );
    
    // Sign and send transaction
    console.log(`Signing and sending transaction for ${amountSol} SOL...`);
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet]
    );
    
    console.log(`Transaction confirmed! Signature: ${signature}`);
    console.log(`View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
    
    // Record execution time
    const executionTime = Date.now() - startTime;
    
    return {
      success: true,
      signature,
      executionTimeMs: executionTime,
      amount: amountSol
    };
  } catch (error) {
    console.error('Error executing transaction:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Save transaction log
 */
function saveTransactionLog(result) {
  try {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs', 'transactions');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Generate timestamp for the log file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logPath = path.join(logsDir, `tx-${timestamp}.json`);
    
    // Create log data
    const logData = {
      timestamp,
      walletAddress: WALLET_CONFIG.publicKey,
      success: result.success,
      signature: result.signature || null,
      amount: result.amount || null,
      executionTimeMs: result.executionTimeMs || null,
      error: result.error || null
    };
    
    // Write log to file
    fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
    console.log(`Transaction log saved to ${logPath}`);
    
    return logPath;
  } catch (error) {
    console.error('Error saving transaction log:', error);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('======= QUANTUM FLASH STRATEGY - REAL TRANSACTIONS =======');
    console.log(`Wallet: ${WALLET_CONFIG.publicKey}`);
    console.log(`RPC: Alchemy (reliable connection)`);
    console.log('==========================================================\n');
    
    // Connect to Alchemy RPC
    const connection = new Connection(RPC_URL, 'confirmed');
    console.log('Connected to Solana network via Alchemy RPC');
    
    // Create wallet from private key
    const wallet = createWalletFromHex(WALLET_CONFIG.privateKeyHex);
    console.log(`Wallet created successfully: ${wallet.publicKey.toString()}`);
    
    // Verify the wallet matches our expected public key
    if (wallet.publicKey.toString() !== WALLET_CONFIG.publicKey) {
      throw new Error(`Created wallet public key ${wallet.publicKey.toString()} does not match expected ${WALLET_CONFIG.publicKey}`);
    }
    
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    const solBalance = lamportsToSol(balance);
    console.log(`Wallet balance: ${solBalance} SOL`);
    
    // Confirm before executing real transaction
    console.log('\n⚠️ EXECUTING REAL BLOCKCHAIN TRANSACTION IN 5 SECONDS!');
    console.log('⚠️ Press Ctrl+C NOW to cancel!');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Execute test transaction (tiny amount to self)
    const result = await executeRealTransaction(
      connection, 
      wallet, 
      TRADE_PARAMS.testTransactionAmount
    );
    
    // Save transaction log
    if (result.success) {
      saveTransactionLog(result);
      
      // Check final wallet balance
      const finalBalance = await connection.getBalance(wallet.publicKey);
      console.log(`\nFinal wallet balance: ${lamportsToSol(finalBalance)} SOL`);
      
      console.log('\n✅ TEST TRANSACTION SUCCESSFUL!');
      console.log('The system is now ready to execute the full Quantum Flash trading strategy');
      console.log('with real transactions for 1.1 SOL using Alchemy RPC.');
    } else {
      console.error('\n❌ TEST TRANSACTION FAILED!');
      console.error('Please check the error and try again.');
      saveTransactionLog(result);
    }
    
  } catch (error) {
    console.error('Error executing trade:', error);
  }
}

// Execute main function
main();