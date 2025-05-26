/**
 * Test Wallet Private Key from wallet-private-key.txt
 * 
 * Testing the Base58 private key found in your system files
 */

import { Connection, Keypair, Transaction, SystemProgram, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';

class WalletKeyTester {
  private connection: Connection;
  private readonly BASE58_KEY = '57m35R4EhtNDvFe7pUNYqCHjeZxeJ2coSE5UpmVYxXPL7JqkXsBXKEaXfcUs3BmVaxjFmNEKxC24SsQDM12ruNNy';
  private readonly HX_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private readonly HPN_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
  private readonly HPN_KEY = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';

  constructor() {
    this.connection = new Connection('https://mainnet.helius-rpc.com/?api-key=5d0d1d98-4695-4a7d-b8a0-d4f9836da17f');
  }

  public async testWalletKey(): Promise<void> {
    console.log('🔑 TESTING WALLET PRIVATE KEY FROM SYSTEM FILES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎯 Target HX wallet: ${this.HX_WALLET}`);
    console.log(`📥 Destination HPN wallet: ${this.HPN_WALLET}\n`);

    try {
      // Decode Base58 private key
      console.log('🔧 Decoding Base58 private key from wallet-private-key.txt...');
      const secretKey = bs58.decode(this.BASE58_KEY);
      const keypair = Keypair.fromSecretKey(secretKey);
      const walletAddress = keypair.publicKey.toString();
      
      console.log(`✅ Successfully created keypair`);
      console.log(`📍 Wallet address: ${walletAddress}`);
      
      // Check balance
      const balance = await this.connection.getBalance(keypair.publicKey);
      console.log(`💰 Balance: ${(balance / 1e9).toFixed(6)} SOL`);
      
      // Check if this is the HX wallet
      if (walletAddress === this.HX_WALLET) {
        console.log('🎉 PERFECT! This key controls the HX wallet with 1.534 SOL!');
        
        if (balance > 0.01 * 1e9) {
          await this.transferToHPN(keypair, balance);
        } else {
          console.log('⚠️  Balance too low for transfer');
        }
      } else {
        console.log(`📍 This key controls a different wallet: ${walletAddress}`);
        
        if (balance > 0.01 * 1e9) {
          console.log('💸 Transferring available funds...');
          await this.transferToHPN(keypair, balance);
        } else {
          console.log('⚠️  No significant balance to transfer');
        }
      }

    } catch (error) {
      console.error('❌ Error testing wallet key:', error.message);
    }
  }

  private async transferToHPN(fromKeypair: Keypair, balance: number): Promise<void> {
    try {
      const hpnKeypair = Keypair.fromSecretKey(Buffer.from(this.HPN_KEY, 'hex'));
      
      // Transfer 90% of balance (keep some for fees)
      const transferAmount = Math.floor(balance * 0.9);
      
      console.log(`💸 Transferring ${(transferAmount / 1e9).toFixed(6)} SOL to HPN wallet...`);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: hpnKeypair.publicKey,
          lamports: transferAmount
        })
      );

      transaction.feePayer = fromKeypair.publicKey;
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      const signature = await this.connection.sendTransaction(transaction, [fromKeypair]);
      
      console.log(`✅ Transfer successful!`);
      console.log(`📝 Transaction: ${signature}`);
      console.log(`🔗 View: https://solscan.io/tx/${signature}`);
      
    } catch (error) {
      console.error(`❌ Transfer failed: ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  const tester = new WalletKeyTester();
  await tester.testWalletKey();
}

if (require.main === module) {
  main().catch(console.error);
}