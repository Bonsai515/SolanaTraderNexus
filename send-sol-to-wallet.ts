/**
 * Send SOL to Specified Wallet
 * 
 * Simple SOL transfer to your specified wallet address
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';

class SimpleSOLTransfer {
  private connection: Connection;
  private hpnWalletKeypair: Keypair;
  private destinationWallet: PublicKey;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.destinationWallet = new PublicKey('2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH');
    
    // Load HPN wallet from known private key
    const privateKeyHex = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';
    const privateKeyBytes = Buffer.from(privateKeyHex, 'hex');
    this.hpnWalletKeypair = Keypair.fromSecretKey(privateKeyBytes);
  }

  public async sendSOL(): Promise<void> {
    console.log('💸 SENDING SOL TO YOUR WALLET');
    console.log('=============================');
    console.log(`From: ${this.hpnWalletKeypair.publicKey.toString()}`);
    console.log(`To: ${this.destinationWallet.toString()}`);
    console.log('');
    
    try {
      await this.checkBalance();
      await this.executeTransfer();
      await this.verifyTransfer();
      
    } catch (error) {
      console.error('❌ SOL transfer failed:', (error as Error).message);
    }
  }

  private async checkBalance(): Promise<void> {
    console.log('💰 Checking current SOL balance...');
    
    const balance = await this.connection.getBalance(this.hpnWalletKeypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`💎 Current SOL Balance: ${solBalance.toFixed(6)} SOL`);
    console.log(`💵 USD Value: $${(solBalance * 200).toFixed(2)}`);
    
    if (solBalance < 0.01) {
      throw new Error('Insufficient SOL balance for transfer');
    }
  }

  private async executeTransfer(): Promise<void> {
    console.log('\n💸 Executing SOL transfer...');
    
    try {
      // Get current balance
      const balance = await this.connection.getBalance(this.hpnWalletKeypair.publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      // Calculate amount to send (leave some for fees)
      const amountToSend = Math.max(0, solBalance - 0.005); // Leave 0.005 SOL for fees
      
      if (amountToSend <= 0) {
        throw new Error('Insufficient SOL balance after fees');
      }
      
      console.log(`💸 Sending ${amountToSend.toFixed(6)} SOL...`);
      
      // Create transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: this.hpnWalletKeypair.publicKey,
        toPubkey: this.destinationWallet,
        lamports: Math.floor(amountToSend * LAMPORTS_PER_SOL),
      });

      // Create and send transaction
      const transaction = new Transaction().add(transferInstruction);
      
      console.log('📝 Sending transaction...');
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.hpnWalletKeypair],
        { commitment: 'confirmed' }
      );

      console.log('✅ SOL transfer completed!');
      console.log(`💰 Sent: ${amountToSend.toFixed(6)} SOL`);
      console.log(`💵 USD Value: $${(amountToSend * 200).toFixed(2)}`);
      console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
      console.log(`📱 Destination: ${this.destinationWallet.toString()}`);
      
    } catch (error) {
      console.log('❌ Transfer failed:', (error as Error).message);
      throw error;
    }
  }

  private async verifyTransfer(): Promise<void> {
    console.log('\n✅ Verifying transfer completion...');
    
    try {
      // Check destination wallet balance
      const destBalance = await this.connection.getBalance(this.destinationWallet);
      const destSOL = destBalance / LAMPORTS_PER_SOL;
      
      console.log(`💰 Destination Wallet Balance: ${destSOL.toFixed(6)} SOL`);
      console.log(`💵 USD Value: $${(destSOL * 200).toFixed(2)}`);
      
      if (destSOL > 0) {
        console.log('🎉 SUCCESS! SOL successfully transferred!');
        console.log('\n📱 NEXT STEPS:');
        console.log('1. Check your wallet for the SOL balance');
        console.log('2. The SOL is now ready for immediate use!');
      }
      
    } catch (error) {
      console.log('❌ Verification failed:', (error as Error).message);
    }
  }
}

async function main(): Promise<void> {
  const transfer = new SimpleSOLTransfer();
  await transfer.sendSOL();
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { SimpleSOLTransfer };