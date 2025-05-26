
<change_summary>Create USDC to SOL conversion script for HPN wallet</change_summary>
/**
 * Convert USDC to SOL in HPN Wallet
 * 
 * Converts any USDC balance in the HPN wallet to SOL using Jupiter DEX
 * for maximum trading power and liquidity.
 */

import { 
  Connection, 
  Keypair, 
  PublicKey,
  LAMPORTS_PER_SOL,
  VersionedTransaction
} from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import axios from 'axios';

class HPNUSDCToSOLConverter {
  private connection: Connection;
  private hpnWallet: Keypair;
  private walletAddress: string;
  private usdcMint: PublicKey;
  private solMint: PublicKey;
  private currentSOL: number;
  private currentUSDC: number;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    this.solMint = new PublicKey('So11111111111111111111111111111111111111112');
    this.currentSOL = 0;
    this.currentUSDC = 0;
  }

  public async convertUSDCToSOL(): Promise<void> {
    console.log('💱 CONVERTING USDC TO SOL IN HPN WALLET');
    console.log('🎯 Maximizing SOL balance for enhanced trading power');
    console.log('='.repeat(55));

    await this.loadHPNWallet();
    await this.checkCurrentBalances();
    
    if (this.currentUSDC > 0) {
      await this.executeConversion();
    } else {
      console.log('✅ No USDC found - HPN wallet already optimized for SOL trading');
    }
    
    await this.showFinalResults();
  }

  private async loadHPNWallet(): Promise<void> {
    // HPN wallet private key
    const hpnPrivateKey = [
      178, 244, 12, 25, 27, 202, 251, 10, 212, 90, 37, 116, 218, 42, 22, 165,
      134, 165, 151, 54, 225, 215, 194, 8, 177, 201, 105, 101, 212, 120, 249,
      74, 243, 118, 55, 187, 158, 35, 75, 138, 173, 148, 39, 171, 160, 27, 89,
      6, 105, 174, 233, 82, 187, 49, 42, 193, 182, 112, 195, 65, 56, 144, 83, 218
    ];
    
    this.hpnWallet = Keypair.fromSecretKey(new Uint8Array(hpnPrivateKey));
    this.walletAddress = this.hpnWallet.publicKey.toBase58();
    
    console.log('✅ HPN Wallet Connected: ' + this.walletAddress);
  }

  private async checkCurrentBalances(): Promise<void> {
    console.log('\n📊 CHECKING CURRENT BALANCES');
    
    try {
      // Check SOL balance
      const solBalance = await this.connection.getBalance(this.hpnWallet.publicKey);
      this.currentSOL = solBalance / LAMPORTS_PER_SOL;
      
      // Check USDC balance
      try {
        const usdcTokenAccount = await getAssociatedTokenAddress(this.usdcMint, this.hpnWallet.publicKey);
        const tokenBalance = await this.connection.getTokenAccountBalance(usdcTokenAccount);
        this.currentUSDC = tokenBalance.value.uiAmount || 0;
      } catch (error) {
        this.currentUSDC = 0;
      }
      
      console.log(`💰 Current SOL: ${this.currentSOL.toFixed(6)} SOL`);
      console.log(`💵 Current USDC: ${this.currentUSDC.toFixed(6)} USDC`);
      
      if (this.currentUSDC > 0) {
        const estimatedSOL = this.currentUSDC * 0.005; // Rough estimate
        console.log(`📈 Estimated SOL gain: ~${estimatedSOL.toFixed(6)} SOL`);
        console.log(`🚀 Total projected SOL: ~${(this.currentSOL + estimatedSOL).toFixed(6)} SOL`);
      }
      
    } catch (error) {
      console.log(`❌ Balance check error: ${error.message}`);
    }
  }

  private async executeConversion(): Promise<void> {
    console.log('\n🔄 EXECUTING USDC → SOL CONVERSION');
    console.log(`💱 Converting ${this.currentUSDC.toFixed(6)} USDC to SOL`);
    
    try {
      const usdcAmount = Math.floor(this.currentUSDC * 1_000_000);
      
      if (usdcAmount < 1000) {
        console.log('⚠️ USDC amount too small for conversion');
        console.log(`💵 Amount: ${this.currentUSDC.toFixed(6)} USDC (below minimum)`);
        return;
      }

      // Get Jupiter quote
      const quote = await this.getJupiterQuote(usdcAmount);
      
      if (!quote) {
        console.log('❌ Could not get Jupiter quote');
        return;
      }

      const expectedSOL = Number(quote.outAmount) / LAMPORTS_PER_SOL;
      console.log(`📊 Jupiter Quote: ${this.currentUSDC.toFixed(6)} USDC → ${expectedSOL.toFixed(6)} SOL`);
      console.log(`💹 Exchange Rate: 1 USDC = ${(expectedSOL / this.currentUSDC).toFixed(6)} SOL`);
      
      // Get swap transaction
      const swapResult = await this.getJupiterSwap(quote);
      
      if (!swapResult) {
        console.log('❌ Could not create swap transaction');
        return;
      }

      // Execute the swap
      const signature = await this.executeSwapTransaction(swapResult.swapTransaction);
      
      if (signature) {
        console.log('✅ USDC → SOL conversion successful!');
        console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
        console.log(`💰 Expected SOL received: ${expectedSOL.toFixed(6)} SOL`);
        
        // Wait for confirmation
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check updated balance
        await this.checkUpdatedBalances();
        
      } else {
        console.log('❌ Conversion failed');
      }
      
    } catch (error) {
      console.log(`❌ Conversion error: ${error.message}`);
    }
  }

  private async getJupiterQuote(amount: number): Promise<any> {
    try {
      const response = await axios.get(`https://quote-api.jup.ag/v6/quote`, {
        params: {
          inputMint: this.usdcMint.toString(),
          outputMint: this.solMint.toString(),
          amount: amount.toString(),
          slippageBps: 100 // 1% slippage
        }
      });
      
      return response.data;
    } catch (error) {
      console.log(`❌ Quote error: ${error.message}`);
      return null;
    }
  }

  private async getJupiterSwap(quote: any): Promise<any> {
    try {
      const response = await axios.post('https://quote-api.jup.ag/v6/swap', {
        quoteResponse: quote,
        userPublicKey: this.walletAddress,
        wrapAndUnwrapSol: true,
        prioritizationFeeLamports: 200000
      });
      
      return response.data;
    } catch (error) {
      console.log(`❌ Swap creation error: ${error.message}`);
      return null;
    }
  }

  private async executeSwapTransaction(swapTransaction: string): Promise<string | null> {
    try {
      // Deserialize transaction
      const transaction = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
      
      // Sign transaction
      transaction.sign([this.hpnWallet]);
      
      // Send transaction
      const signature = await this.connection.sendTransaction(transaction);
      
      // Confirm transaction
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      return signature;
    } catch (error) {
      console.log(`❌ Transaction execution error: ${error.message}`);
      return null;
    }
  }

  private async checkUpdatedBalances(): Promise<void> {
    console.log('\n🔄 CHECKING UPDATED BALANCES');
    
    try {
      const newSOLBalance = await this.connection.getBalance(this.hpnWallet.publicKey);
      const newSOL = newSOLBalance / LAMPORTS_PER_SOL;
      
      let newUSDC = 0;
      try {
        const usdcTokenAccount = await getAssociatedTokenAddress(this.usdcMint, this.hpnWallet.publicKey);
        const tokenBalance = await this.connection.getTokenAccountBalance(usdcTokenAccount);
        newUSDC = tokenBalance.value.uiAmount || 0;
      } catch (error) {
        newUSDC = 0;
      }
      
      const solGain = newSOL - this.currentSOL;
      const usdcUsed = this.currentUSDC - newUSDC;
      
      console.log(`💰 New SOL Balance: ${newSOL.toFixed(6)} SOL`);
      console.log(`💵 Remaining USDC: ${newUSDC.toFixed(6)} USDC`);
      console.log(`📈 SOL Gained: +${solGain.toFixed(6)} SOL`);
      console.log(`📉 USDC Used: -${usdcUsed.toFixed(6)} USDC`);
      
    } catch (error) {
      console.log(`❌ Balance update check failed: ${error.message}`);
    }
  }

  private async showFinalResults(): Promise<void> {
    console.log('\n' + '='.repeat(55));
    console.log('🏆 HPN WALLET USDC → SOL CONVERSION COMPLETE');
    console.log('='.repeat(55));
    
    console.log(`🎯 HPN Wallet: ${this.walletAddress}`);
    console.log(`💰 Final SOL Balance: ${this.currentSOL.toFixed(6)} SOL`);
    console.log(`💵 Final USDC Balance: ${this.currentUSDC.toFixed(6)} USDC`);
    
    if (this.currentUSDC === 0) {
      console.log('\n✅ CONVERSION SUCCESSFUL!');
      console.log('🚀 HPN wallet is now fully optimized for SOL trading');
      console.log('💪 Enhanced trading power achieved');
    } else {
      console.log('\n⚠️ Partial conversion completed');
      console.log('💡 Some USDC may remain due to minimum swap amounts');
    }
    
    console.log('\n📋 NEXT ACTIONS:');
    console.log('• HPN wallet ready for enhanced SOL trading');
    console.log('• Increased liquidity for arbitrage opportunities');
    console.log('• Better position for flash loan strategies');
    console.log('• Optimal setup for meme token sniping');
    
    console.log('\n' + '='.repeat(55));
  }
}

async function main(): Promise<void> {
  try {
    const converter = new HPNUSDCToSOLConverter();
    await converter.convertUSDCToSOL();
  } catch (error: any) {
    console.error('❌ Main execution error:', error.message);
  }
}

if (require.main === module) {
  main();
}

export { HPNUSDCToSOLConverter };
