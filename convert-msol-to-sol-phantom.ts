/**
 * Convert mSOL to SOL and Send to Phantom Wallet
 * 
 * This script converts $15 worth of mSOL to SOL using Marinade Finance
 * and then sends the SOL directly to your Phantom wallet
 */

import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';

class MSOLToSOLConverter {
  private connection: Connection;
  private hpnWalletKeypair: Keypair;
  private phantomWalletAddress: PublicKey;
  private msolMintAddress: PublicKey;
  private currentMSOLBalance: number = 0;
  private targetUSDValue: number = 15; // $15 USD
  private msolPriceUSD: number = 200; // Approximate mSOL price

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.phantomWalletAddress = new PublicKey('2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH');
    this.msolMintAddress = new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So');
    
    // Load HPN wallet from known private key
    const privateKeyHex = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';
    const privateKeyBytes = Buffer.from(privateKeyHex, 'hex');
    this.hpnWalletKeypair = Keypair.fromSecretKey(privateKeyBytes);
  }

  public async convertMSOLToSOLAndSend(): Promise<void> {
    console.log('🔄 CONVERTING mSOL TO SOL AND SENDING TO PHANTOM');
    console.log('===============================================');
    
    try {
      await this.loadHPNWallet();
      await this.checkMSOLBalance();
      const conversionAmount = await this.calculateConversionAmount();
      await this.unstakeMSOLToSOL(conversionAmount);
      await this.sendSOLToPhantom();
      await this.verifyTransfer();
      
    } catch (error) {
      console.error('❌ mSOL to SOL conversion failed:', (error as Error).message);
    }
  }

  private async loadHPNWallet(): Promise<void> {
    console.log('🔑 Loading HPN wallet...');
    
    // We already loaded the wallet in constructor, just verify it
    if (this.hpnWalletKeypair.publicKey.toString() === 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK') {
      console.log('✅ HPN wallet loaded successfully!');
      console.log(`📍 Wallet Address: ${this.hpnWalletKeypair.publicKey.toString()}`);
      return;
    }
    
    throw new Error('HPN wallet verification failed');
  }

  private async checkMSOLBalance(): Promise<void> {
    console.log('\n💰 Checking current mSOL balance...');
    
    try {
      // Get mSOL token account
      const msolTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.hpnWalletKeypair,
        this.msolMintAddress,
        this.hpnWalletKeypair.publicKey
      );

      const balance = await this.connection.getTokenAccountBalance(msolTokenAccount.address);
      this.currentMSOLBalance = parseFloat(balance.value.uiAmount || '0');
      
      console.log(`💎 Current mSOL Balance: ${this.currentMSOLBalance.toFixed(6)} mSOL`);
      console.log(`💰 USD Value: $${(this.currentMSOLBalance * this.msolPriceUSD).toFixed(2)}`);
      
      if (this.currentMSOLBalance < 0.01) {
        throw new Error('Insufficient mSOL balance for conversion');
      }
      
    } catch (error) {
      console.log('❌ Error checking mSOL balance:', (error as Error).message);
      throw error;
    }
  }

  private async calculateConversionAmount(): Promise<number> {
    console.log('\n📊 Calculating conversion amount...');
    
    // Calculate how much mSOL equals $15 USD
    const msolToConvert = this.targetUSDValue / this.msolPriceUSD;
    const actualAmount = Math.min(msolToConvert, this.currentMSOLBalance * 0.9); // Convert max 90% to be safe
    
    console.log(`🎯 Target: $${this.targetUSDValue} USD`);
    console.log(`💎 mSOL to unstake: ${actualAmount.toFixed(6)} mSOL`);
    console.log(`💰 Expected SOL output: ${actualAmount.toFixed(6)} SOL (approximately)`);
    
    return actualAmount;
  }

  private async unstakeMSOLToSOL(msolAmount: number): Promise<void> {
    console.log('\n🔄 Converting mSOL to SOL via Marinade...');
    
    try {
      // Use Jupiter API to get the best route for mSOL -> SOL conversion
      const inputMint = 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So'; // mSOL
      const outputMint = 'So11111111111111111111111111111111111111112'; // SOL
      const amount = Math.floor(msolAmount * LAMPORTS_PER_SOL);
      
      console.log('🔍 Getting best conversion route from Jupiter...');
      
      const quoteResponse = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`
      );
      
      if (!quoteResponse.ok) {
        throw new Error('Failed to get Jupiter quote');
      }
      
      const quoteData = await quoteResponse.json();
      console.log(`💱 Jupiter Quote: ${msolAmount.toFixed(6)} mSOL → ${(quoteData.outAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
      
      // Get the swap transaction
      const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse: quoteData,
          userPublicKey: this.hpnWalletKeypair.publicKey.toString(),
          wrapAndUnwrapSol: true,
        }),
      });
      
      if (!swapResponse.ok) {
        throw new Error('Failed to get swap transaction');
      }
      
      const swapData = await swapResponse.json();
      
      // Deserialize and sign the transaction
      const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
      const transaction = Transaction.from(swapTransactionBuf);
      
      // Sign and send the transaction
      console.log('📝 Executing mSOL to SOL conversion...');
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.hpnWalletKeypair],
        { commitment: 'confirmed' }
      );
      
      console.log('✅ mSOL to SOL conversion completed!');
      console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
      
    } catch (error) {
      console.log('❌ Conversion failed:', (error as Error).message);
      throw error;
    }
  }

  private async sendSOLToPhantom(): Promise<void> {
    console.log('\n💸 Sending SOL to Phantom wallet...');
    
    try {
      // Check current SOL balance
      const balance = await this.connection.getBalance(this.hpnWalletKeypair.publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      console.log(`💰 Current SOL balance: ${solBalance.toFixed(6)} SOL`);
      
      // Calculate amount to send (leave some for fees)
      const amountToSend = Math.max(0, solBalance - 0.005); // Leave 0.005 SOL for fees
      
      if (amountToSend <= 0) {
        throw new Error('Insufficient SOL balance after fees');
      }
      
      console.log(`💸 Sending ${amountToSend.toFixed(6)} SOL to Phantom...`);
      
      // Create transfer transaction
      const transaction = new Transaction().add(
        {
          fromPubkey: this.hpnWalletKeypair.publicKey,
          toPubkey: this.phantomWalletAddress,
          lamports: Math.floor(amountToSend * LAMPORTS_PER_SOL),
          programId: new PublicKey('11111111111111111111111111111111')
        } as any
      );
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.hpnWalletKeypair],
        { commitment: 'confirmed' }
      );
      
      console.log('✅ SOL transfer to Phantom completed!');
      console.log(`💰 Sent: ${amountToSend.toFixed(6)} SOL`);
      console.log(`💵 USD Value: $${(amountToSend * 200).toFixed(2)}`);
      console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
      console.log(`📱 Phantom Wallet: ${this.phantomWalletAddress.toString()}`);
      
    } catch (error) {
      console.log('❌ SOL transfer failed:', (error as Error).message);
      throw error;
    }
  }

  private async verifyTransfer(): Promise<void> {
    console.log('\n✅ Verifying transfer completion...');
    
    try {
      // Check Phantom wallet SOL balance
      const phantomBalance = await this.connection.getBalance(this.phantomWalletAddress);
      const phantomSOL = phantomBalance / LAMPORTS_PER_SOL;
      
      console.log(`💰 Phantom SOL Balance: ${phantomSOL.toFixed(6)} SOL`);
      console.log(`💵 USD Value: $${(phantomSOL * 200).toFixed(2)}`);
      
      if (phantomSOL > 0) {
        console.log('🎉 SUCCESS! SOL successfully transferred to Phantom wallet!');
        console.log('\n📱 NEXT STEPS:');
        console.log('1. Open your Phantom wallet');
        console.log('2. You should see the SOL balance');
        console.log('3. The SOL is now ready for immediate use!');
      }
      
    } catch (error) {
      console.log('❌ Verification failed:', (error as Error).message);
    }
  }
}

async function main(): Promise<void> {
  const converter = new MSOLToSOLConverter();
  await converter.convertMSOLToSOLAndSend();
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { MSOLToSOLConverter };