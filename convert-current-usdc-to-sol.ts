/**
 * Convert Current USDC to SOL
 * 
 * Checks for any USDC in wallet and converts it to SOL
 * to maximize SOL holdings for the 1 SOL goal
 */

import { 
  Connection, 
  Keypair, 
  PublicKey,
  LAMPORTS_PER_SOL,
  VersionedTransaction
} from '@solana/web3.js';

class USDCToSOLConverter {
  private connection: Connection;
  private walletKeypair: Keypair;
  private walletAddress: string;
  private usdcMint: PublicKey;
  private currentSOL: number;
  private currentUSDC: number;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    this.currentSOL = 0;
    this.currentUSDC = 0;
  }

  public async convertAllUSDCToSOL(): Promise<void> {
    console.log('🔄 CONVERTING ALL USDC TO SOL');
    console.log('💰 Maximizing SOL balance for 1 SOL goal');
    console.log('='.repeat(45));

    await this.loadWallet();
    await this.checkCurrentBalances();
    
    if (this.currentUSDC > 0) {
      await this.executeUSDCConversion();
    } else {
      console.log('✅ No USDC found - all funds already in SOL');
    }
    
    await this.showFinalBalance();
  }

  private async loadWallet(): Promise<void> {
    const privateKeyArray = [
      178, 244, 12, 25, 27, 202, 251, 10, 212, 90, 37, 116, 218, 42, 22, 165,
      134, 165, 151, 54, 225, 215, 194, 8, 177, 201, 105, 101, 212, 120, 249,
      74, 243, 118, 55, 187, 158, 35, 75, 138, 173, 148, 39, 171, 160, 27, 89,
      6, 105, 174, 233, 82, 187, 49, 42, 193, 182, 112, 195, 65, 56, 144, 83, 218
    ];
    
    this.walletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    this.walletAddress = this.walletKeypair.publicKey.toBase58();
    
    console.log('✅ Wallet: ' + this.walletAddress);
  }

  private async checkCurrentBalances(): Promise<void> {
    console.log('\n💰 CHECKING CURRENT BALANCES');
    
    // Check SOL balance
    const solBalance = await this.connection.getBalance(this.walletKeypair.publicKey);
    this.currentSOL = solBalance / LAMPORTS_PER_SOL;
    
    // Check USDC balance
    try {
      // Get USDC token account address
      const [usdcTokenAccount] = PublicKey.findProgramAddressSync(
        [
          this.walletKeypair.publicKey.toBuffer(),
          new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA').toBuffer(),
          this.usdcMint.toBuffer()
        ],
        new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
      );
      
      const accountInfo = await this.connection.getAccountInfo(usdcTokenAccount);
      
      if (accountInfo) {
        // Parse token account data
        const data = accountInfo.data;
        const amount = data.readBigUInt64LE(64);
        this.currentUSDC = Number(amount) / 1_000_000; // USDC has 6 decimals
        
        console.log(`💎 Current SOL: ${this.currentSOL.toFixed(6)} SOL`);
        console.log(`💵 Current USDC: ${this.currentUSDC.toFixed(6)} USDC`);
      } else {
        this.currentUSDC = 0;
        console.log(`💎 Current SOL: ${this.currentSOL.toFixed(6)} SOL`);
        console.log(`💵 Current USDC: 0.000000 USDC (no token account)`);
      }
      
    } catch (error) {
      this.currentUSDC = 0;
      console.log(`💎 Current SOL: ${this.currentSOL.toFixed(6)} SOL`);
      console.log(`💵 Current USDC: 0.000000 USDC (account check failed)`);
    }
  }

  private async executeUSDCConversion(): Promise<void> {
    console.log('\n🔄 EXECUTING USDC → SOL CONVERSION');
    console.log(`💵 Converting ${this.currentUSDC.toFixed(6)} USDC to SOL`);
    
    try {
      const usdcAmount = Math.floor(this.currentUSDC * 1_000_000);
      
      if (usdcAmount < 1000) {
        console.log('⚠️ USDC amount too small for conversion');
        console.log(`💵 Amount: ${this.currentUSDC.toFixed(6)} USDC (below minimum)`);
        return;
      }

      const quote = await this.getJupiterQuote(usdcAmount);
      
      if (!quote) {
        console.log('❌ Could not get Jupiter quote');
        return;
      }

      console.log(`📊 Quote: ${usdcAmount / 1_000_000} USDC → ${Number(quote.outAmount) / LAMPORTS_PER_SOL} SOL`);
      
      const swapResult = await this.getJupiterSwap(quote);
      
      if (!swapResult) {
        console.log('❌ Could not get swap transaction');
        return;
      }

      const signature = await this.executeSwapTransaction(swapResult.swapTransaction);
      
      if (signature) {
        console.log('✅ USDC → SOL conversion successful!');
        console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } else {
        console.log('❌ Conversion failed');
      }
      
    } catch (error) {
      console.log('❌ Conversion error:', error.message);
    }
  }

  private async getJupiterQuote(amount: number): Promise<any> {
    try {
      const response = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=${amount}&slippageBps=100`);
      
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  private async getJupiterSwap(quote: any): Promise<any> {
    try {
      const response = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: this.walletAddress,
          wrapAndUnwrapSol: true,
        }),
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      return null;
    }
  }

  private async executeSwapTransaction(swapTransaction: string): Promise<string | null> {
    try {
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      
      transaction.sign([this.walletKeypair]);
      
      const signature = await this.connection.sendTransaction(transaction, {
        maxRetries: 3,
        skipPreflight: false,
      });
      
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      return signature;
    } catch (error) {
      console.log('Transaction error:', error.message);
      return null;
    }
  }

  private async showFinalBalance(): Promise<void> {
    console.log('\n💰 CHECKING FINAL BALANCE');
    
    const finalBalance = await this.connection.getBalance(this.walletKeypair.publicKey);
    const finalSOL = finalBalance / LAMPORTS_PER_SOL;
    
    const solGain = finalSOL - this.currentSOL;
    
    console.log('\n' + '='.repeat(45));
    console.log('🔄 USDC CONVERSION COMPLETE');
    console.log('='.repeat(45));
    
    console.log(`💎 Starting SOL: ${this.currentSOL.toFixed(6)} SOL`);
    console.log(`💵 Converted USDC: ${this.currentUSDC.toFixed(6)} USDC`);
    console.log(`💎 Final SOL: ${finalSOL.toFixed(6)} SOL`);
    
    if (solGain > 0) {
      console.log(`✅ SOL Gained: +${solGain.toFixed(6)} SOL`);
    }
    
    console.log('\n🎯 PROGRESS UPDATE:');
    console.log(`📊 Progress to 1 SOL: ${(finalSOL * 100).toFixed(1)}%`);
    console.log(`📉 Remaining Gap: ${(1.0 - finalSOL).toFixed(6)} SOL`);
    
    console.log('\n💰 All funds now optimized in SOL');
    console.log('🚀 Maximum efficiency for 1 SOL goal');
    
    console.log('\n' + '='.repeat(45));
    console.log('✅ CONVERSION COMPLETE - BALANCE MAXIMIZED');
    console.log('='.repeat(45));
  }
}

async function main(): Promise<void> {
  const converter = new USDCToSOLConverter();
  await converter.convertAllUSDCToSOL();
}

main().catch(console.error);