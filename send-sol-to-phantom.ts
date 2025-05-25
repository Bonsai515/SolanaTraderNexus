/**
 * Send SOL to Phantom Wallet
 * 
 * Sends 0.2 SOL from trading wallet to Phantom wallet
 */

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import * as fs from 'fs';

class SendSOLToPhantom {
  private connection: Connection;
  private walletKeypair: Keypair;
  private walletAddress: string;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    
    const privateKeyHex = fs.readFileSync('./hpn-real-key.txt', 'utf8').trim();
    const secretKey = Buffer.from(privateKeyHex, 'hex');
    this.walletKeypair = Keypair.fromSecretKey(secretKey);
    this.walletAddress = this.walletKeypair.publicKey.toBase58();

    console.log('[SendSOL] 💸 SENDING SOL TO PHANTOM WALLET');
    console.log(`[SendSOL] 📍 From: ${this.walletAddress}`);
  }

  public async sendSOLToPhantom(): Promise<void> {
    console.log('[SendSOL] === SENDING 0.2 SOL TO PHANTOM WALLET ===');
    
    try {
      // Check current balance
      const balance = await this.connection.getBalance(this.walletKeypair.publicKey);
      const currentBalance = balance / LAMPORTS_PER_SOL;
      
      console.log(`[SendSOL] 💰 Current Balance: ${currentBalance.toFixed(6)} SOL`);
      
      const amountToSend = 0.2;
      
      if (currentBalance < amountToSend + 0.001) { // Include fee buffer
        console.log(`[SendSOL] ⚠️ Insufficient balance. Need ${amountToSend + 0.001} SOL, have ${currentBalance.toFixed(6)} SOL`);
        return;
      }
      
      // Your Phantom wallet address
      const phantomWalletAddress = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
      
      console.log(`[SendSOL] 📤 Sending ${amountToSend} SOL to Phantom wallet...`);
      console.log(`[SendSOL] 🎯 To: ${phantomWalletAddress}`);
      
      // Create transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: this.walletKeypair.publicKey,
        toPubkey: new PublicKey(phantomWalletAddress),
        lamports: amountToSend * LAMPORTS_PER_SOL
      });
      
      // Create transaction
      const transaction = new Transaction().add(transferInstruction);
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.walletKeypair.publicKey;
      
      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.walletKeypair],
        {
          commitment: 'confirmed',
          maxRetries: 3
        }
      );
      
      console.log(`[SendSOL] ✅ Transfer completed successfully!`);
      console.log(`[SendSOL] 🔗 Transaction Signature: ${signature}`);
      console.log(`[SendSOL] 🔗 Solscan: https://solscan.io/tx/${signature}`);
      console.log(`[SendSOL] 💸 Amount Sent: ${amountToSend} SOL`);
      
      // Check new balance
      const newBalance = await this.connection.getBalance(this.walletKeypair.publicKey);
      const newBalanceSOL = newBalance / LAMPORTS_PER_SOL;
      console.log(`[SendSOL] 💰 New Balance: ${newBalanceSOL.toFixed(6)} SOL`);
      
    } catch (error) {
      console.error('[SendSOL] Transfer failed:', (error as Error).message);
      
      if ((error as Error).message.includes('PHANTOM_WALLET_ADDRESS_HERE')) {
        console.log('\n[SendSOL] ℹ️ Please provide your Phantom wallet address');
        console.log('[SendSOL] 📋 You can find it in your Phantom wallet by:');
        console.log('[SendSOL] 1. Opening Phantom wallet');
        console.log('[SendSOL] 2. Clicking on your wallet name at the top');
        console.log('[SendSOL] 3. Copying the wallet address');
      }
    }
  }
}

async function main(): Promise<void> {
  console.log('💸 PREPARING TO SEND 0.2 SOL TO PHANTOM...');
  
  const sender = new SendSOLToPhantom();
  await sender.sendSOLToPhantom();
  
  console.log('✅ SOL TRANSFER PROCESS COMPLETE!');
}

main().catch(console.error);