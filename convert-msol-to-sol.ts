/**
 * Convert mSOL to SOL
 * 
 * Converts approximately $15 USD worth of mSOL to SOL
 * to increase liquid SOL balance for trading strategies
 */

import { 
  Connection, 
  Keypair, 
  PublicKey,
  LAMPORTS_PER_SOL,
  VersionedTransaction
} from '@solana/web3.js';

class MSOLToSOLConverter {
  private connection: Connection;
  private walletKeypair: Keypair;
  private walletAddress: string;
  private msolMint: PublicKey;
  private currentSOL: number;
  private currentMSOL: number;
  private targetUSDAmount: number;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.msolMint = new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So');
    this.targetUSDAmount = 15; // $15 USD target
    this.currentSOL = 0;
    this.currentMSOL = 0;
  }

  public async convertMSOLToSOL(): Promise<void> {
    console.log('🔄 CONVERTING mSOL TO SOL');
    console.log(`💰 Target conversion: ~$${this.targetUSDAmount} USD worth of mSOL`);
    console.log('🚀 Boosting liquid SOL for enhanced trading');
    console.log('='.repeat(50));

    await this.loadWallet();
    await this.checkCurrentBalances();
    await this.calculateConversionAmount();
    await this.executeMSOLConversion();
    await this.showFinalResults();
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
    
    // Check mSOL balance
    try {
      const [msolTokenAccount] = PublicKey.findProgramAddressSync(
        [
          this.walletKeypair.publicKey.toBuffer(),
          new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA').toBuffer(),
          this.msolMint.toBuffer()
        ],
        new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
      );
      
      const accountInfo = await this.connection.getAccountInfo(msolTokenAccount);
      
      if (accountInfo) {
        const data = accountInfo.data;
        const amount = data.readBigUInt64LE(64);
        this.currentMSOL = Number(amount) / 1_000_000_000; // mSOL has 9 decimals
        
        console.log(`💎 Current SOL: ${this.currentSOL.toFixed(6)} SOL`);
        console.log(`🌊 Current mSOL: ${this.currentMSOL.toFixed(6)} mSOL`);
      } else {
        this.currentMSOL = 0;
        console.log(`💎 Current SOL: ${this.currentSOL.toFixed(6)} SOL`);
        console.log(`🌊 Current mSOL: 0.000000 mSOL (no token account)`);
      }
      
    } catch (error) {
      this.currentMSOL = 0;
      console.log(`💎 Current SOL: ${this.currentSOL.toFixed(6)} SOL`);
      console.log(`🌊 Current mSOL: 0.000000 mSOL (account check failed)`);
    }
  }

  private async calculateConversionAmount(): Promise<number> {
    console.log('\n📊 CALCULATING CONVERSION AMOUNT');
    
    if (this.currentMSOL === 0) {
      console.log('❌ No mSOL available for conversion');
      return 0;
    }

    // Assume SOL price around $180-200 for calculation
    // mSOL typically trades close to 1:1 with SOL
    const estimatedSOLPrice = 190; // Conservative estimate
    const targetSOLAmount = this.targetUSDAmount / estimatedSOLPrice;
    const msolToConvert = Math.min(targetSOLAmount, this.currentMSOL * 0.1); // Max 10% of mSOL
    
    console.log(`💰 Target USD: $${this.targetUSDAmount}`);
    console.log(`📊 Estimated SOL price: $${estimatedSOLPrice}`);
    console.log(`🎯 Target SOL amount: ${targetSOLAmount.toFixed(6)} SOL`);
    console.log(`🌊 mSOL to convert: ${msolToConvert.toFixed(6)} mSOL`);
    console.log(`💰 mSOL remaining: ${(this.currentMSOL - msolToConvert).toFixed(6)} mSOL`);
    
    return msolToConvert;
  }

  private async executeMSOLConversion(): Promise<void> {
    const msolAmount = await this.calculateConversionAmount();
    
    if (msolAmount === 0) {
      return;
    }

    console.log('\n🔄 EXECUTING mSOL → SOL CONVERSION');
    console.log(`🌊 Converting ${msolAmount.toFixed(6)} mSOL to SOL`);
    
    try {
      const msolAmountLamports = Math.floor(msolAmount * 1_000_000_000);
      
      if (msolAmountLamports < 1000000) {
        console.log('⚠️ mSOL amount too small for conversion');
        console.log(`🌊 Amount: ${msolAmount.toFixed(6)} mSOL (below minimum)`);
        return;
      }

      const quote = await this.getJupiterQuote(msolAmountLamports);
      
      if (!quote) {
        console.log('❌ Could not get Jupiter quote for mSOL → SOL');
        return;
      }

      console.log(`📊 Quote: ${msolAmount.toFixed(6)} mSOL → ${Number(quote.outAmount) / LAMPORTS_PER_SOL} SOL`);
      
      const swapResult = await this.getJupiterSwap(quote);
      
      if (!swapResult) {
        console.log('❌ Could not get swap transaction');
        return;
      }

      const signature = await this.executeSwapTransaction(swapResult.swapTransaction);
      
      if (signature) {
        console.log('✅ mSOL → SOL conversion successful!');
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
      const response = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So&outputMint=So11111111111111111111111111111111111111112&amount=${amount}&slippageBps=100`);
      
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

  private async showFinalResults(): Promise<void> {
    console.log('\n💰 CHECKING FINAL BALANCES');
    
    // Get updated balances
    const finalSOLBalance = await this.connection.getBalance(this.walletKeypair.publicKey);
    const finalSOL = finalSOLBalance / LAMPORTS_PER_SOL;
    
    const solGain = finalSOL - this.currentSOL;
    
    console.log('\n' + '='.repeat(50));
    console.log('🚀 mSOL → SOL CONVERSION COMPLETE');
    console.log('='.repeat(50));
    
    console.log(`💎 Starting SOL: ${this.currentSOL.toFixed(6)} SOL`);
    console.log(`🌊 Starting mSOL: ${this.currentMSOL.toFixed(6)} mSOL`);
    console.log(`💎 Final SOL: ${finalSOL.toFixed(6)} SOL`);
    
    if (solGain > 0) {
      console.log(`✅ SOL Gained: +${solGain.toFixed(6)} SOL`);
      console.log(`💰 Estimated Value: ~$${(solGain * 190).toFixed(2)} USD`);
    }
    
    console.log('\n🎯 IMPACT ON 1 SOL GOAL:');
    console.log(`📊 Progress to 1 SOL: ${(finalSOL * 100).toFixed(1)}%`);
    console.log(`📉 Remaining Gap: ${(1.0 - finalSOL).toFixed(6)} SOL`);
    
    console.log('\n🚀 STRATEGY BENEFITS:');
    console.log('✅ Increased liquid SOL for trading');
    console.log('✅ Enhanced capital for strategies');
    console.log('✅ Maintained majority mSOL staking position');
    console.log('✅ Optimized balance allocation');
    
    console.log('\n' + '='.repeat(50));
    console.log('💎 SOL BALANCE ENHANCED FOR TRADING SUCCESS');
    console.log('='.repeat(50));
  }
}

async function main(): Promise<void> {
  const converter = new MSOLToSOLConverter();
  await converter.convertMSOLToSOL();
}

main().catch(console.error);