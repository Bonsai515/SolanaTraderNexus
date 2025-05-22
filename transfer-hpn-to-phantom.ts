/**
 * Transfer funds from HPN wallet to Phantom wallet
 * 
 * This script transfers all funds from your HPN wallet to your Phantom wallet
 * for centralized trading through the Nexus Pro engine.
 */

import * as fs from 'fs';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';

// Configuration
const LOG_PATH = './transfer.log';
const HPN_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const RPC_URL = 'https://empty-hidden-spring.solana-mainnet.quiknode.pro/ea24f1bb95ea3b2dc4cddbe74a4bce8e10eaa88e/';
const BACKUP_RPC_URL = 'https://api.mainnet-beta.solana.com';

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- WALLET TRANSFER LOG ---\n');
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
    log('Connecting to Solana blockchain via premium QuickNode RPC...');
    return new Connection(RPC_URL, 'confirmed');
  } catch (error) {
    log(`Failed to connect to premium RPC: ${(error as Error).message}`);
    log('Falling back to public RPC...');
    return new Connection(BACKUP_RPC_URL, 'confirmed');
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

// Get wallet private key from config
function getWalletFromConfig(configPath: string): Keypair | null {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      if (config.secretKey) {
        const secretKey = Uint8Array.from(config.secretKey);
        return Keypair.fromSecretKey(secretKey);
      }
    }
    
    return null;
  } catch (error) {
    log(`Error loading wallet from config: ${(error as Error).message}`);
    return null;
  }
}

// Create a guide for manually transferring funds using wallet UI
function createManualTransferGuide() {
  log('Creating guide for manual wallet transfer...');
  
  console.log('\n===== MANUAL WALLET TRANSFER GUIDE =====');
  console.log(`\nTo transfer all funds from HPN wallet to Phantom wallet for trading:`);
  console.log('\n1. Open your Phantom wallet browser extension');
  console.log('2. Ensure you have access to the HPN wallet private key');
  console.log(`3. Send all SOL from: ${HPN_WALLET}`);
  console.log(`4. To your Phantom wallet: ${PHANTOM_WALLET}`);
  console.log('\n5. After transfer, go to https://solscan.io to verify the transaction');
  console.log(`6. Check that the ${PHANTOM_WALLET} balance has increased`);
  
  console.log('\n===== WHY TRANSFER FUNDS? =====');
  console.log('• Nexus Pro Engine will use your Phantom wallet for all trades');
  console.log('• Consolidating funds maximizes your trading capital');
  console.log('• Having funds in one wallet simplifies tracking profits');
  console.log('• Phantom wallet provides better security and usability');
  
  console.log('\n===== AFTER TRANSFER =====');
  console.log('Run "npx ts-node nexus-phantom-connector.ts" to verify your new balance');
  console.log('and ensure Nexus Pro Engine is properly connected to your Phantom wallet');
}

// Main function
async function main() {
  try {
    log('Starting transfer process from HPN wallet to Phantom wallet...');
    
    // Connect to Solana
    const connection = connectToSolana();
    
    // Check both wallet balances
    const hpnBalance = await checkWalletBalance(connection, HPN_WALLET);
    const phantomBalance = await checkWalletBalance(connection, PHANTOM_WALLET);
    
    log(`HPN wallet has ${hpnBalance / LAMPORTS_PER_SOL} SOL`);
    log(`Phantom wallet has ${phantomBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Attempt to load HPN wallet key from wallet.json
    const hpnKeypair = getWalletFromConfig('./hpn-wallet.json');
    
    if (hpnKeypair) {
      log('Found HPN wallet key configuration');
      
      // Verify it's the correct wallet
      if (hpnKeypair.publicKey.toString() !== HPN_WALLET) {
        log(`WARNING: Loaded wallet ${hpnKeypair.publicKey.toString()} does not match expected HPN wallet ${HPN_WALLET}`);
        createManualTransferGuide();
        return;
      }
      
      // Calculate the amount to transfer (leave some for fees)
      const fee = 5000; // 0.000005 SOL for fees
      const transferAmount = hpnBalance - fee;
      
      if (transferAmount <= 0) {
        log('HPN wallet balance too low to transfer');
        createManualTransferGuide();
        return;
      }
      
      // Create transfer transaction
      log(`Creating transfer transaction for ${transferAmount / LAMPORTS_PER_SOL} SOL`);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: hpnKeypair.publicKey,
          toPubkey: new PublicKey(PHANTOM_WALLET),
          lamports: transferAmount
        })
      );
      
      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = hpnKeypair.publicKey;
      
      // Sign transaction
      transaction.sign(hpnKeypair);
      
      // Send transaction
      log('Sending transaction to network...');
      const signature = await connection.sendRawTransaction(transaction.serialize());
      
      log(`Transaction sent with signature: ${signature}`);
      log(`View on Solscan: https://solscan.io/tx/${signature}`);
      
      // Wait for confirmation
      log('Waiting for transaction confirmation...');
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        log(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      } else {
        log('Transaction confirmed successfully!');
        
        // Check updated balances
        const newHpnBalance = await checkWalletBalance(connection, HPN_WALLET);
        const newPhantomBalance = await checkWalletBalance(connection, PHANTOM_WALLET);
        
        log(`Transfer complete. HPN wallet now has ${newHpnBalance / LAMPORTS_PER_SOL} SOL`);
        log(`Phantom wallet now has ${newPhantomBalance / LAMPORTS_PER_SOL} SOL`);
      }
    } else {
      log('HPN wallet key not found in configuration');
      createManualTransferGuide();
    }
  } catch (error) {
    log(`Error in transfer process: ${(error as Error).message}`);
    createManualTransferGuide();
  }
}

// Run main function
if (require.main === module) {
  main().catch(error => {
    log(`Unhandled error: ${error.message}`);
  });
}