/**
 * Direct HPN to Phantom Wallet Transfer
 * 
 * This script directly transfers all SOL from the HPN wallet
 * to your Phantom wallet for trading through Nexus.
 */

import * as fs from 'fs';
import * as path from 'path';
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
const LOG_PATH = './direct-transfer.log';
const HPN_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const RPC_URL = 'https://empty-hidden-spring.solana-mainnet.quiknode.pro/ea24f1bb95ea3b2dc4cddbe74a4bce8e10eaa88e/';
const BACKUP_RPC_URL = 'https://api.mainnet-beta.solana.com';

// HPN PRIVATE KEY - This is the private key for the HPN wallet
// THIS KEY NEEDS TO BE CORRECT FOR THE TRANSFER TO WORK
const HPN_PRIVATE_KEY_HEX = "b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da";

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- DIRECT HPN TO PHANTOM TRANSFER LOG ---\n');
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
    log('Connecting to Solana via premium QuickNode RPC...');
    return new Connection(RPC_URL, 'confirmed');
  } catch (error) {
    log(`Failed to connect to premium RPC: ${(error as Error).message}`);
    log('Falling back to public RPC...');
    return new Connection(BACKUP_RPC_URL, 'confirmed');
  }
}

// Create keypair from private key
function createKeypairFromPrivateKey(): Keypair {
  try {
    // Convert hex string to Uint8Array
    const privateKeyBuffer = Buffer.from(HPN_PRIVATE_KEY_HEX, 'hex');
    const secretKey = new Uint8Array(privateKeyBuffer);
    
    // Create the keypair from the secret key
    const keypair = Keypair.fromSecretKey(secretKey);
    
    // Verify the keypair matches the expected public key
    if (keypair.publicKey.toString() !== HPN_WALLET) {
      throw new Error(`Keypair public key (${keypair.publicKey.toString()}) doesn't match expected HPN wallet (${HPN_WALLET})`);
    }
    
    log(`Successfully created keypair for HPN wallet`);
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

// Transfer all SOL from HPN to Phantom
async function transferAllFunds(
  connection: Connection,
  fromKeypair: Keypair,
  toAddress: string
): Promise<string | null> {
  try {
    // Get current balance
    const fromBalance = await connection.getBalance(fromKeypair.publicKey);
    
    if (fromBalance <= 0) {
      log(`No balance to transfer from ${fromKeypair.publicKey.toString()}`);
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
    const hpnBalance = await checkWalletBalance(connection, HPN_WALLET);
    const phantomBalance = await checkWalletBalance(connection, PHANTOM_WALLET);
    
    log(`After transfer: HPN wallet has ${hpnBalance / LAMPORTS_PER_SOL} SOL`);
    log(`After transfer: Phantom wallet has ${phantomBalance / LAMPORTS_PER_SOL} SOL`);
    
    return hpnBalance < 10000; // Less than 0.00001 SOL remaining (successful transfer)
  } catch (error) {
    log(`Error verifying transfer: ${(error as Error).message}`);
    return false;
  }
}

// Search for different key format in files
function searchForPrivateKey(): Uint8Array | null {
  const potentialFiles = [
    './data/wallet.json',
    './data/private_wallets.json',
    './data/keys.json',
    './data/real-wallets.json',
    './data/system-wallets.json',
    './wallet.json',
    './key.json',
    './data/system-memory.json'
  ];
  
  log('Searching for HPN wallet private key in files...');
  
  for (const file of potentialFiles) {
    if (fs.existsSync(file)) {
      try {
        log(`Checking ${file}...`);
        const content = fs.readFileSync(file, 'utf8');
        
        try {
          const data = JSON.parse(content);
          
          // Check for different formats
          if (data.trading === HPN_WALLET && data.secretKey) {
            log(`Found HPN wallet key in ${file}`);
            return new Uint8Array(data.secretKey);
          }
          
          if (data.wallets) {
            for (const wallet of data.wallets) {
              if ((wallet.address === HPN_WALLET || wallet.publicKey === HPN_WALLET) && wallet.secretKey) {
                log(`Found HPN wallet key in ${file}`);
                return new Uint8Array(wallet.secretKey);
              }
            }
          }
        } catch (e) {
          // Not JSON, continue
        }
      } catch (error) {
        log(`Error reading ${file}: ${(error as Error).message}`);
      }
    }
  }
  
  log('No HPN wallet private key found in files');
  return null;
}

// Main function
async function main() {
  try {
    log('Starting direct transfer from HPN wallet to Phantom wallet...');
    
    // Connect to Solana
    const connection = connectToSolana();
    
    // Check initial balances
    const initialHpnBalance = await checkWalletBalance(connection, HPN_WALLET);
    const initialPhantomBalance = await checkWalletBalance(connection, PHANTOM_WALLET);
    
    log(`Initial HPN wallet balance: ${initialHpnBalance / LAMPORTS_PER_SOL} SOL`);
    log(`Initial Phantom wallet balance: ${initialPhantomBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Create keypair from private key
    let keypair: Keypair;
    try {
      keypair = createKeypairFromPrivateKey();
    } catch (error) {
      log('Failed to create keypair from hardcoded private key');
      
      // Try to find private key in files
      const foundKey = searchForPrivateKey();
      if (foundKey) {
        log('Using private key found in files');
        keypair = Keypair.fromSecretKey(foundKey);
      } else {
        log('Unable to find or create valid keypair for HPN wallet');
        return;
      }
    }
    
    // Transfer funds
    const signature = await transferAllFunds(connection, keypair, PHANTOM_WALLET);
    
    if (signature) {
      // Verify transfer
      const transferVerified = await verifyTransfer(connection);
      
      if (transferVerified) {
        log('✅ Transfer verification complete. All funds transferred successfully!');
        
        // Calculate the expected final balance
        const expectedFinalBalance = (initialHpnBalance + initialPhantomBalance - 5000) / LAMPORTS_PER_SOL;
        log(`Expected final Phantom wallet balance: ~${expectedFinalBalance.toFixed(6)} SOL`);
        
        console.log('\n===== TRANSFER COMPLETED SUCCESSFULLY =====');
        console.log(`💰 All funds transferred from HPN wallet to Phantom wallet!`);
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