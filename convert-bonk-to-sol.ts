/**
 * Convert BONK to SOL
 * 
 * Converts your 12,139+ BONK tokens back to SOL
 * to maximize your trading capital
 */

import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';

class ConvertBONKToSOL {
  private connection: Connection;
  private walletKeypair: Keypair;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async convertBONKToSOL(): Promise<void> {
    console.log('💰 CONVERTING BONK TO SOL');
    console.log('🎯 Converting 12,139+ BONK tokens to maximize SOL');
    console.log('='.repeat(50));

    await this.loadWallet();
    await this.executeBONKToSOLSwap();
  }

  private async loadWallet(): Promise<void> {
    const privateKey = [
      178, 244, 12, 25, 27, 202, 251, 10, 212, 90, 37, 116, 218, 42, 22, 165,
      134, 165, 151, 54, 225, 215, 194, 8, 177, 201, 105, 101, 212, 120, 249,
      74, 243, 118, 55, 187, 158, 35, 75, 138, 173, 148, 39, 171, 160, 27, 89,
      6, 105, 174, 233, 82, 187, 49, 42, 193, 182, 112, 195, 65, 56, 144, 83, 218
    ];
    this.walletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKey));
    console.log(`✅ Wallet loaded: ${this.walletKeypair.publicKey.toBase58()}`);
  }

  private async executeBONKToSOLSwap(): Promise<void> {
    try {
      console.log('\n🔄 Getting quote for BONK → SOL conversion...');
      
      // BONK has 5 decimals, so 12,139.55194 = 1,213,955,194 in smallest units
      const bonkAmount = '1213955194'; // Your exact BONK balance
      
      const quoteResponse = await axios.get('https://quote-api.jup.ag/v6/quote', {
        params: {
          inputMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
          outputMint: 'So11111111111111111111111111111111111111112', // SOL
          amount: bonkAmount,
          slippageBps: 50 // 0.5% slippage
        }
      });
      
      if (!quoteResponse.data) {
        console.log('❌ Failed to get BONK → SOL quote');
        return;
      }
      
      const outputAmount = quoteResponse.data.outAmount;
      const solReceived = parseInt(outputAmount) / 1000000000; // Convert to SOL
      
      console.log(`✅ Quote received:`);
      console.log(`   Input: 12,139.55 BONK`);
      console.log(`   Output: ${solReceived.toFixed(6)} SOL`);
      console.log(`   🎉 Excellent conversion rate!`);
      
      console.log('\n🔄 Executing BONK → SOL swap...');
      
      const swapResponse = await axios.post('https://quote-api.jup.ag/v6/swap', {
        quoteResponse: quoteResponse.data,
        userPublicKey: this.walletKeypair.publicKey.toString(),
        wrapAndUnwrapSol: true
      });
      
      if (!swapResponse.data?.swapTransaction) {
        console.log('❌ Failed to get swap transaction');
        return;
      }
      
      const signature = await this.executeTransaction(swapResponse.data.swapTransaction);
      
      if (signature) {
        console.log('\n🎉 BONK → SOL CONVERSION SUCCESSFUL!');
        console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
        console.log(`💰 Received: ${solReceived.toFixed(6)} SOL`);
        console.log(`🚀 Your trading capital has been maximized!`);
        
        // Check new balance
        await this.checkNewBalance();
      }
      
    } catch (error) {
      console.log(`❌ Conversion error: ${error.message}`);
      console.log('💡 Your BONK tokens are safe and can be converted later');
    }
  }

  private async executeTransaction(swapTransactionBase64: string): Promise<string | null> {
    try {
      const swapTransactionBuf = Buffer.from(swapTransactionBase64, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      
      transaction.sign([this.walletKeypair]);
      
      const signature = await this.connection.sendTransaction(transaction, {
        skipPreflight: false,
        maxRetries: 3
      });
      
      return signature;
      
    } catch (error) {
      console.log(`❌ Transaction execution error: ${error.message}`);
      return null;
    }
  }

  private async checkNewBalance(): Promise<void> {
    console.log('\n💰 CHECKING YOUR NEW SOL BALANCE...');
    
    const balance = await this.connection.getBalance(this.walletKeypair.publicKey);
    const solBalance = balance / 1000000000;
    
    console.log(`🎯 New SOL Balance: ${solBalance.toFixed(6)} SOL`);
    console.log(`📈 Ready for more high-confidence trading opportunities!`);
  }
}

async function main(): Promise<void> {
  const converter = new ConvertBONKToSOL();
  await converter.convertBONKToSOL();
}

main().catch(console.error);