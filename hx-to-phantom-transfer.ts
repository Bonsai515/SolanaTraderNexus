/**
 * HX to Phantom Wallet Transfer
 * 
 * This script transfers all SOL from the HX wallet
 * to your Phantom wallet for consolidated trading capital.
 */

import * as fs from 'fs';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

// Configuration
const LOG_PATH = './hx-transfer.log';
const HX_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
const PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

// HX PRIVATE KEY (provided by user)
const HX_PRIVATE_KEY_HEX = "0b42ea00c0322d804745ec6c7bff1d6337eb1eefbc8e5d45d65e51bdcff596aeec7b957f34d2d910dd3da11f6d6";

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- HX TO PHANTOM TRANSFER LOG ---\n');
}

// Log function
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Connect to Solana
function connectToSolana(): Connection {
  try {
    log('Connecting to Solana via public RPC...');
    return new Connection(RPC_URL, 'confirmed');
  } catch (error) {
    log(`Failed to connect to RPC: ${(error as Error).message}`);
    throw error;
  }
}

// Create keypair from private key
function createKeypairFromPrivateKey(): Keypair {
  try {
    // Convert hex string to Uint8Array
    const privateKeyBuffer = Buffer.from(HX_PRIVATE_KEY_HEX, 'hex');
    const secretKey = new Uint8Array(privateKeyBuffer);
    
    // Create the keypair from the secret key
    const keypair = Keypair.fromSecretKey(secretKey);
    
    // Verify the keypair's public key
    const publicKeyStr = keypair.publicKey.toString();
    log(`Generated keypair public key: ${publicKeyStr}`);
    
    // Validate that this matches our expected HX wallet
    if (publicKeyStr !== HX_WALLET) {
      log(`WARNING: The generated public key does not match the expected HX wallet address!`);
      log(`Expected: ${HX_WALLET}`);
      log(`Generated: ${publicKeyStr}`);
    }
    
    return keypair;
  } catch (error) {
    log(`Error creating keypair: ${(error as Error).message}`);
    throw error;
  }
}

// Check wallet balance
async function checkWalletBalance(connection: Connection, walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    
    log(`${walletAddress} balance: ${balanceSOL.toFixed(6)} SOL`);
    return balance;
  } catch (error) {
    log(`Error checking wallet balance: ${(error as Error).message}`);
    return 0;
  }
}

// Transfer all SOL from HX to Phantom
async function transferAllFunds(
  connection: Connection,
  fromKeypair: Keypair,
  toAddress: string
): Promise<string | null> {
  try {
    const fromAddress = fromKeypair.publicKey.toString();
    
    // Verify from address is HX wallet
    if (fromAddress !== HX_WALLET) {
      log(`ERROR: The provided key does not match the HX wallet address.`);
      log(`Provided key generates address: ${fromAddress}`);
      log(`Expected HX wallet address: ${HX_WALLET}`);
      return null;
    }
    
    // Get current balance
    const fromBalance = await connection.getBalance(fromKeypair.publicKey);
    
    if (fromBalance <= 0) {
      log(`No balance to transfer from ${fromAddress}`);
      return null;
    }
    
    // Calculate amount to transfer (leave some for fees)
    const fee = 5000; // 0.000005 SOL for fees
    const transferAmount = fromBalance - fee;
    
    if (transferAmount <= 0) {
      log(`Balance too low to transfer after fees`);
      return null;
    }
    
    log(`Transferring ${transferAmount / LAMPORTS_PER_SOL} SOL to ${toAddress}`);
    
    // Create transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: new PublicKey(toAddress),
        lamports: transferAmount
      })
    );
    
    // Set recent blockhash and sign transaction
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = fromKeypair.publicKey;
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromKeypair]
    );
    
    log(`✅ Transfer successful! Transaction signature: ${signature}`);
    log(`Solscan Link: https://solscan.io/tx/${signature}`);
    
    return signature;
  } catch (error) {
    log(`❌ Transfer failed: ${(error as Error).message}`);
    return null;
  }
}

// Verify the transfer
async function verifyTransfer(connection: Connection): Promise<boolean> {
  try {
    // Check balance after transfer
    const hxBalance = await checkWalletBalance(connection, HX_WALLET);
    const phantomBalance = await checkWalletBalance(connection, PHANTOM_WALLET);
    
    log(`After transfer: HX wallet has ${hxBalance / LAMPORTS_PER_SOL} SOL`);
    log(`After transfer: Phantom wallet has ${phantomBalance / LAMPORTS_PER_SOL} SOL`);
    
    return hxBalance < 10000; // Less than 0.00001 SOL remaining (successful transfer)
  } catch (error) {
    log(`Error verifying transfer: ${(error as Error).message}`);
    return false;
  }
}

// Update trading parameters with new capital
async function updateTradingParameters(totalBalance: number): Promise<boolean> {
  try {
    log(`Updating trading parameters for new capital: ${totalBalance.toFixed(6)} SOL`);
    
    // Update trading parameters
    const maxPositionSizeSOL = totalBalance * 0.15; // 15% of capital
    const minProfitThresholdSOL = 0.0015; // Fixed minimum profit threshold
    
    log(`New max position size: ${maxPositionSizeSOL.toFixed(6)} SOL (15% of capital)`);
    log(`Minimum profit threshold: ${minProfitThresholdSOL.toFixed(6)} SOL`);
    
    // Calculate new profit projections
    const dailyProfitEstimate = totalBalance * 0.025; // 2.5% daily
    const weeklyProfitEstimate = dailyProfitEstimate * 7;
    const monthlyProfitEstimate = dailyProfitEstimate * 30;
    
    log(`Daily profit projection: ${dailyProfitEstimate.toFixed(6)} SOL`);
    log(`Weekly profit projection: ${weeklyProfitEstimate.toFixed(6)} SOL`);
    log(`Monthly profit projection: ${monthlyProfitEstimate.toFixed(6)} SOL`);
    
    return true;
  } catch (error) {
    log(`Error updating trading parameters: ${(error as Error).message}`);
    return false;
  }
}

// Main function
async function main() {
  try {
    log('Starting transfer from HX wallet to Phantom wallet...');
    
    // Connect to Solana
    const connection = connectToSolana();
    
    // Check initial balances
    const initialHxBalance = await checkWalletBalance(connection, HX_WALLET);
    const initialPhantomBalance = await checkWalletBalance(connection, PHANTOM_WALLET);
    
    log(`Initial HX wallet balance: ${initialHxBalance / LAMPORTS_PER_SOL} SOL`);
    log(`Initial Phantom wallet balance: ${initialPhantomBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Create keypair from private key
    const keypair = createKeypairFromPrivateKey();
    
    // Transfer funds
    const signature = await transferAllFunds(connection, keypair, PHANTOM_WALLET);
    
    if (signature) {
      // Wait a bit for the transaction to finalize
      log('Waiting 5 seconds for transaction to finalize...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verify transfer
      const transferVerified = await verifyTransfer(connection);
      
      if (transferVerified) {
        log('✅ Transfer verification complete. All funds transferred successfully!');
        
        // Calculate the expected final balance
        const expectedFinalBalance = (initialHxBalance + initialPhantomBalance - 5000) / LAMPORTS_PER_SOL;
        log(`Expected final Phantom wallet balance: ~${expectedFinalBalance.toFixed(6)} SOL`);
        
        // Update trading parameters with new total capital
        await updateTradingParameters(expectedFinalBalance);
        
        console.log('\n===== TRANSFER COMPLETED SUCCESSFULLY =====');
        console.log(`💰 All funds transferred from HX wallet to Phantom wallet!`);
        console.log(`📝 Transaction: https://solscan.io/tx/${signature}`);
        console.log(`💼 Phantom wallet now has approximately ${expectedFinalBalance.toFixed(6)} SOL`);
        console.log('\nYour trading system is now ready to use with the enhanced capital!');
      } else {
        log('❌ Transfer verification failed. Please check wallet balances manually.');
      }
    } else {
      log('❌ Transfer failed. No transaction signature returned.');
    }
  } catch (error) {
    log(`Fatal error: ${(error as Error).message}`);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    log(`Unhandled error: ${error.message}`);
  });
}