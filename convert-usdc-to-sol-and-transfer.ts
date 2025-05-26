
<change_summary>Create script to convert USDC to SOL in HPN wallet and transfer to specified address</change_summary>
/**
 * Convert USDC to SOL in HPN Wallet and Transfer to Target Address
 * 
 * This script:
 * 1. Converts any USDC balance in HPN wallet to SOL using Jupiter DEX
 * 2. Transfers the resulting SOL to 2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH
 */

import { 
  Connection, 
  Keypair, 
  PublicKey,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import axios from 'axios';

class HPNUSDCToSOLConverter {
  private connection: Connection;
  private hpnWallet: Keypair;
  private walletAddress: string;
  private targetAddress: string;
  private usdcMint: PublicKey;
  private solMint: PublicKey;
  private currentSOL: number;
  private currentUSDC: number;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.targetAddress = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
    this.usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    this.solMint = new PublicKey('So11111111111111111111111111111111111111112');
    this.currentSOL = 0;
    this.currentUSDC = 0;
  }

  public async convertAndTransfer(): Promise<void> {
    console.log('💱 CONVERTING USDC TO SOL AND TRANSFERRING TO TARGET');
    console.log('🎯 Target Address:', this.targetAddress);
    console.log('='.repeat(60));

    await this.loadHPNWallet();
    await this.checkCurrentBalances();
    
    if (this.currentUSDC > 0) {
      console.log(`\n💰 Found ${this.currentUSDC.toFixed(6)} USDC - Converting to SOL...`);
      await this.convertUSDCToSOL();
      await this.checkCurrentBalances(); // Refresh balances after conversion
    } else {
      console.log('✅ No USDC found - proceeding with existing SOL balance');
    }
    
    if (this.currentSOL > 0.001) { // Leave some for fees
      await this.transferSOLToTarget();
    } else {
      console.log('❌ Insufficient SOL balance for transfer');
    }
    
    await this.showFinalResults();
  }

  private async loadHPNWallet(): Promise<void> {
    try {
      // HPN wallet private key from your codebase
      const privateKeyArray = [
        178, 244, 12, 25, 27, 202, 251, 10, 212, 90, 37, 116, 218, 42, 22, 165,
        134, 165, 151, 54, 225, 215, 194, 8, 177, 201, 105, 101, 212, 120, 249,
        74, 243, 118, 55, 187, 158, 35, 75, 138, 173, 148, 39, 171, 160, 27, 89,
        6, 105, 174, 233, 82, 187, 49, 42, 193, 182, 112, 195, 65, 56, 144, 83, 218
      ];
      
      this.hpnWallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
      this.walletAddress = this.hpnWallet.publicKey.toBase58();
      
      console.log('✅ HPN Wallet Connected:', this.walletAddress);
    } catch (error: any) {
      console.error('❌ Error loading HPN wallet:', error.message);
      throw error;
    }
  }

  private async checkCurrentBalances(): Promise<void> {
    try {
      // Check SOL balance
      const solBalance = await this.connection.getBalance(this.hpnWallet.publicKey);
      this.currentSOL = solBalance / LAMPORTS_PER_SOL;

      // Check USDC balance
      try {
        const usdcTokenAccount = await getAssociatedTokenAddress(
          this.usdcMint,
          this.hpnWallet.publicKey
        );
        
        const usdcAccountInfo = await this.connection.getTokenAccountBalance(usdcTokenAccount);
        this.currentUSDC = parseFloat(usdcAccountInfo.value.uiAmount?.toString() || '0');
      } catch (error) {
        this.currentUSDC = 0; // No USDC account or no balance
      }

      console.log(`💰 Current SOL Balance: ${this.currentSOL.toFixed(6)} SOL`);
      console.log(`💵 Current USDC Balance: ${this.currentUSDC.toFixed(6)} USDC`);
    } catch (error: any) {
      console.error('❌ Error checking balances:', error.message);
      throw error;
    }
  }

  private async convertUSDCToSOL(): Promise<void> {
    try {
      console.log('\n🔄 Converting USDC to SOL using Jupiter...');
      
      // Convert USDC amount to smallest units (6 decimals for USDC)
      const usdcAmount = Math.floor(this.currentUSDC * 1000000);
      
      if (usdcAmount < 1000) { // Less than 0.001 USDC
        console.log('⚠️ USDC amount too small for conversion');
        return;
      }

      // Get quote from Jupiter
      const quoteResponse = await this.getJupiterQuote(
        this.usdcMint.toString(),
        this.solMint.toString(),
        usdcAmount
      );

      if (!quoteResponse) {
        console.log('❌ Failed to get Jupiter quote');
        return;
      }

      console.log(`📊 Quote: ${this.currentUSDC.toFixed(6)} USDC → ${(parseInt(quoteResponse.outAmount) / LAMPORTS_PER_SOL).toFixed(6)} SOL`);

      // Get swap transaction
      const swapTransaction = await this.getJupiterSwapTransaction(quoteResponse);
      
      if (!swapTransaction) {
        console.log('❌ Failed to get swap transaction');
        return;
      }

      // Execute the swap
      const signature = await this.executeSwapTransaction(swapTransaction);
      
      if (signature) {
        console.log('✅ USDC to SOL conversion successful!');
        console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
        
        // Wait a moment for transaction to settle
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error: any) {
      console.error('❌ Error converting USDC to SOL:', error.message);
    }
  }

  private async getJupiterQuote(inputMint: string, outputMint: string, amount: number): Promise<any> {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: '300' // 3% slippage
      });

      const response = await axios.get(`https://quote-api.jup.ag/v6/quote?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error getting Jupiter quote:', error);
      return null;
    }
  }

  private async getJupiterSwapTransaction(quoteResponse: any): Promise<string | null> {
    try {
      const response = await axios.post('https://quote-api.jup.ag/v6/swap', {
        quoteResponse,
        userPublicKey: this.hpnWallet.publicKey.toString(),
        wrapAndUnwrapSol: true
      });

      return response.data.swapTransaction;
    } catch (error) {
      console.error('Error getting swap transaction:', error);
      return null;
    }
  }

  private async executeSwapTransaction(swapTransaction: string): Promise<string | null> {
    try {
      // Deserialize the transaction
      const transactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);
      
      // Sign the transaction
      transaction.sign([this.hpnWallet]);

      // Send the transaction
      const signature = await this.connection.sendTransaction(transaction);
      
      // Confirm the transaction
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      return signature;
    } catch (error) {
      console.error('Error executing swap transaction:', error);
      return null;
    }
  }

  private async transferSOLToTarget(): Promise<void> {
    try {
      console.log('\n💸 Transferring SOL to target address...');
      
      const targetPublicKey = new PublicKey(this.targetAddress);
      
      // Calculate transfer amount (leave 0.001 SOL for fees)
      const transferAmount = Math.floor((this.currentSOL - 0.001) * LAMPORTS_PER_SOL);
      
      if (transferAmount <= 0) {
        console.log('❌ Insufficient balance for transfer after fees');
        return;
      }

      const transferSOL = transferAmount / LAMPORTS_PER_SOL;
      console.log(`💰 Transferring ${transferSOL.toFixed(6)} SOL to ${this.targetAddress}`);

      // Create transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.hpnWallet.publicKey,
          toPubkey: targetPublicKey,
          lamports: transferAmount
        })
      );

      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.hpnWallet],
        { commitment: 'confirmed' }
      );

      console.log('✅ SOL transfer successful!');
      console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
      console.log(`📤 Sent ${transferSOL.toFixed(6)} SOL to ${this.targetAddress}`);

    } catch (error: any) {
      console.error('❌ Error transferring SOL:', error.message);
    }
  }

  private async showFinalResults(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('🏆 CONVERSION AND TRANSFER COMPLETE');
    console.log('='.repeat(60));
    
    await this.checkCurrentBalances();
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`• HPN Wallet: ${this.walletAddress}`);
    console.log(`• Target Address: ${this.targetAddress}`);
    console.log(`• Final SOL Balance: ${this.currentSOL.toFixed(6)} SOL`);
    console.log(`• Final USDC Balance: ${this.currentUSDC.toFixed(6)} USDC`);
    
    console.log('\n✅ Process completed successfully!');
    console.log('='.repeat(60));
  }
}

async function main(): Promise<void> {
  try {
    const converter = new HPNUSDCToSOLConverter();
    await converter.convertAndTransfer();
  } catch (error: any) {
    console.error('❌ Main execution error:', error.message);
  }
}

if (require.main === module) {
  main();
}

export { HPNUSDCToSOLConverter };
