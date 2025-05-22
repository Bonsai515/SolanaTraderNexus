/**
 * Transfer Funds from Phantom Wallet to HPN Wallet
 * 
 * This script transfers SOL from your Phantom wallet to the HPN wallet for trading.
 */

import * as fs from 'fs';
import { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Configuration
const PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const HPN_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const LOG_PATH = './transfer.log';

// Amount to transfer (in SOL)
const AMOUNT_TO_TRANSFER = 0.8; // Transfer 0.8 SOL for trading

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- WALLET TRANSFER LOG ---\n');
}

// Log function
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Get Solana connection
function getConnection(): Connection {
  return new Connection(RPC_URL, 'confirmed');
}

// Check wallet balances
async function checkWalletBalances(): Promise<{ phantomBalance: number, hpnBalance: number }> {
  try {
    const connection = getConnection();
    
    // Check Phantom wallet balance
    const phantomPubkey = new PublicKey(PHANTOM_WALLET);
    const phantomBalance = await connection.getBalance(phantomPubkey) / LAMPORTS_PER_SOL;
    log(`Phantom wallet balance: ${phantomBalance.toFixed(6)} SOL`);
    
    // Check HPN wallet balance
    const hpnPubkey = new PublicKey(HPN_WALLET);
    const hpnBalance = await connection.getBalance(hpnPubkey) / LAMPORTS_PER_SOL;
    log(`HPN wallet balance: ${hpnBalance.toFixed(6)} SOL`);
    
    return { phantomBalance, hpnBalance };
  } catch (error) {
    log(`Error checking wallet balances: ${(error as Error).message}`);
    return { phantomBalance: 0, hpnBalance: 0 };
  }
}

// Initialize keypair from private key - you'll need to enter this when running the script
function initializeKeypair(privateKeyBase58: string): Keypair {
  const privateKey = bs58.decode(privateKeyBase58);
  return Keypair.fromSecretKey(Buffer.from(privateKey));
}

// Transfer SOL from Phantom to HPN wallet
async function transferSolToHpnWallet(phantomPrivateKey: string): Promise<boolean> {
  try {
    const connection = getConnection();
    
    // Create keypair from private key
    const phantomKeypair = initializeKeypair(phantomPrivateKey);
    const phantomPublicKey = phantomKeypair.publicKey;
    
    // Verify the public key matches the expected Phantom wallet
    if (phantomPublicKey.toString() !== PHANTOM_WALLET) {
      log(`❌ Error: The provided private key does not match the Phantom wallet address ${PHANTOM_WALLET}`);
      return false;
    }
    
    // Get HPN wallet public key
    const hpnPublicKey = new PublicKey(HPN_WALLET);
    
    // Check Phantom wallet balance
    const { phantomBalance } = await checkWalletBalances();
    
    if (phantomBalance < AMOUNT_TO_TRANSFER + 0.001) {
      log(`❌ Error: Insufficient balance in Phantom wallet. Required: ${AMOUNT_TO_TRANSFER + 0.001} SOL, Available: ${phantomBalance} SOL`);
      return false;
    }
    
    // Create transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: phantomPublicKey,
        toPubkey: hpnPublicKey,
        lamports: AMOUNT_TO_TRANSFER * LAMPORTS_PER_SOL
      })
    );
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = phantomPublicKey;
    
    // Sign and send transaction
    log(`Sending ${AMOUNT_TO_TRANSFER} SOL from Phantom to HPN wallet...`);
    const signature = await sendAndConfirmTransaction(connection, transaction, [phantomKeypair]);
    
    log(`✅ Transfer successful! Transaction signature: ${signature}`);
    log(`✅ Transferred ${AMOUNT_TO_TRANSFER} SOL from Phantom wallet to HPN wallet`);
    
    // Check updated balances
    await checkWalletBalances();
    
    return true;
  } catch (error) {
    log(`❌ Error transferring funds: ${(error as Error).message}`);
    return false;
  }
}

// Create Jupiter direct transfer link
function createJupiterTransferLink(): string {
  const jupiterLink = `https://jup.ag/swap/SOL-SOL?inputMint=So11111111111111111111111111111111111111112&outputMint=So11111111111111111111111111111111111111112&amount=${AMOUNT_TO_TRANSFER}&fromAddress=${PHANTOM_WALLET}&toAddress=${HPN_WALLET}`;
  
  log(`Jupiter direct transfer link created: ${jupiterLink}`);
  return jupiterLink;
}

// Main function
async function main() {
  try {
    log('Starting wallet transfer process...');
    
    // Check current balances
    const { phantomBalance, hpnBalance } = await checkWalletBalances();
    
    if (phantomBalance < AMOUNT_TO_TRANSFER + 0.001) {
      log(`⚠️ Warning: Phantom wallet has insufficient balance (${phantomBalance.toFixed(6)} SOL) to transfer ${AMOUNT_TO_TRANSFER} SOL plus fees`);
      return;
    }
    
    // Create Jupiter transfer link for easy use
    const jupiterLink = createJupiterTransferLink();
    
    console.log('\n===== WALLET TRANSFER OPTIONS =====');
    console.log('Option 1: Use Jupiter direct transfer (Recommended)');
    console.log(`Open this link in your browser: ${jupiterLink}`);
    console.log('\nOption 2: For direct script transfer from Phantom wallet');
    console.log('Run the following command with your private key:');
    console.log('npx ts-node transfer-to-hpn-wallet.ts YOUR_PRIVATE_KEY');
    
  } catch (error) {
    log(`Fatal error: ${(error as Error).message}`);
  }
}

// Add bs58 for private key decoding
const base58alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const bs58 = {
  decode: function(str: string): Uint8Array {
    // Decode base58 string to array of numbers
    const result = [];
    
    for (let i = 0; i < str.length; i++) {
      let carry = base58alphabet.indexOf(str[i]);
      if (carry < 0) throw new Error('Invalid base58 character');
      
      for (let j = 0; j < result.length; j++) {
        carry += result[j] * 58;
        result[j] = carry & 0xff;
        carry >>= 8;
      }
      
      while (carry > 0) {
        result.push(carry & 0xff);
        carry >>= 8;
      }
    }
    
    // Add leading zeros
    for (let i = 0; i < str.length && str[i] === '1'; i++) {
      result.push(0);
    }
    
    return new Uint8Array(result.reverse());
  }
};

// Run main function if not imported
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // If private key is provided, run the transfer
    const privateKey = args[0];
    transferSolToHpnWallet(privateKey)
      .then(() => {
        log('Transfer process completed');
      })
      .catch(error => {
        log(`Unhandled error in transfer: ${error.message}`);
      });
  } else {
    // Otherwise just display the options
    main().catch(error => {
      log(`Unhandled error: ${error.message}`);
    });
  }
}