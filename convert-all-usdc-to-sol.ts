/**
 * Convert All USDC to SOL
 * 
 * Finds and converts any remaining USDC tokens to SOL
 * Maximizes SOL balance for optimal trading power
 */

import { 
  Connection, 
  Keypair, 
  PublicKey,
  LAMPORTS_PER_SOL,
  VersionedTransaction
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import axios from 'axios';

class ConvertAllUSDCToSOL {
  private connection: Connection;
  private walletKeypair: Keypair;
  private walletAddress: string;
  private currentSOLBalance: number;
  private usdcBalance: number;
  private conversionProfit: number;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.currentSOLBalance = 0;
    this.usdcBalance = 0;
    this.conversionProfit = 0;
  }

  public async convertAllUSDCToSOL(): Promise<void> {
    console.log('💱 CONVERTING ALL USDC TO SOL');
    console.log('🎯 Maximizing SOL balance for trading power');
    console.log('='.repeat(50));

    await this.loadWallet();
    await this.checkCurrentBalances();
    await this.findAndConvertUSDC();
    await this.showConversionResults();
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
    
    console.log('✅ Wallet Connected: ' + this.walletAddress);
  }

  private async checkCurrentBalances(): Promise<void> {
    console.log('\n💰 CHECKING ALL BALANCES');
    
    // Get SOL balance
    const solBalance = await this.connection.getBalance(this.walletKeypair.publicKey);
    this.currentSOLBalance = solBalance / LAMPORTS_PER_SOL;
    
    console.log(`💎 Current SOL: ${this.currentSOLBalance.toFixed(6)} SOL`);
    
    // Check for USDC tokens
    await this.checkUSDCBalance();
  }

  private async checkUSDCBalance(): Promise<void> {
    try {
      console.log('🔍 Scanning for USDC tokens...');
      
      // Get all token accounts
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(
        this.walletKeypair.publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );
      
      const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      
      for (const account of tokenAccounts.value) {
        const accountInfo = await this.connection.getAccountInfo(account.pubkey);
        
        if (accountInfo) {
          // Parse token account data
          const data = accountInfo.data;
          
          // Extract mint address (bytes 0-31)
          const mint = new PublicKey(data.slice(0, 32)).toBase58();
          
          if (mint === usdcMint) {
            // Extract amount (bytes 64-71, little endian)
            const amount = data.readBigUInt64LE(64);
            this.usdcBalance = Number(amount) / 1000000; // USDC has 6 decimals
            
            console.log(`💵 Found USDC: ${this.usdcBalance.toFixed(6)} USDC`);
            console.log(`📍 Token Account: ${account.pubkey.toBase58()}`);
            
            if (this.usdcBalance > 0.01) {
              console.log('🎯 USDC found! Ready for conversion');
            } else {
              console.log('💡 Minimal USDC balance');
            }
            
            return;
          }
        }
      }
      
      console.log('✅ No significant USDC tokens found');
      
    } catch (error) {
      console.log(`⚠️ Token scan error: ${error.message}`);
      console.log('💡 Checking if USDC conversion is needed...');
    }
  }

  private async findAndConvertUSDC(): Promise<void> {
    if (this.usdcBalance > 0.01) {
      console.log('\n💱 CONVERTING USDC TO SOL');
      console.log(`🔄 Converting ${this.usdcBalance.toFixed(6)} USDC to SOL`);
      
      const result = await this.executeUSDCToSOLConversion(this.usdcBalance);
      
      if (result.success) {
        this.conversionProfit = result.solReceived;
        console.log(`✅ Conversion successful!`);
        console.log(`💰 Received: ${result.solReceived.toFixed(6)} SOL`);
        console.log(`🔗 Transaction: ${result.signature}`);
        
        // Update SOL balance
        await this.updateSOLBalance();
      } else {
        console.log(`❌ Conversion failed: ${result.reason}`);
      }
    } else {
      console.log('\n💡 No USDC conversion needed');
      console.log('✅ All funds already optimized as SOL');
    }
  }

  private async executeUSDCToSOLConversion(usdcAmount: number): Promise<any> {
    try {
      console.log(`     🔄 Getting best USDC→SOL quote...`);
      
      const quote = await this.getJupiterQuote(usdcAmount, 'USDC', 'SOL');
      
      if (!quote) {
        return { success: false, reason: 'No quote available', solReceived: 0, signature: null };
      }
      
      const expectedSOL = quote.outAmount / LAMPORTS_PER_SOL;
      console.log(`     📊 Expected SOL: ${expectedSOL.toFixed(6)} SOL`);
      
      const swapTransaction = await this.getJupiterSwapTransaction(quote);
      
      if (!swapTransaction) {
        return { success: false, reason: 'Swap transaction failed', solReceived: 0, signature: null };
      }
      
      const signature = await this.submitTransaction(swapTransaction);
      
      if (signature) {
        return { 
          success: true, 
          solReceived: expectedSOL, 
          signature,
          reason: 'USDC conversion completed' 
        };
      }
      
      return { success: false, reason: 'Transaction submission failed', solReceived: 0, signature: null };
      
    } catch (error) {
      return { success: false, reason: error.message, solReceived: 0, signature: null };
    }
  }

  private async getJupiterQuote(amount: number, fromToken: string, toToken: string): Promise<any> {
    try {
      const tokenMints = {
        'SOL': 'So11111111111111111111111111111111111111112',
        'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      };

      const amountLamports = fromToken === 'SOL' ? 
        Math.floor(amount * LAMPORTS_PER_SOL) : 
        Math.floor(amount * 1000000);
      
      const response = await axios.get(`https://quote-api.jup.ag/v6/quote`, {
        params: {
          inputMint: tokenMints[fromToken],
          outputMint: tokenMints[toToken],
          amount: amountLamports,
          slippageBps: 100 // 1% slippage
        },
        timeout: 15000
      });

      return response.data;
      
    } catch (error) {
      return null;
    }
  }

  private async getJupiterSwapTransaction(quote: any): Promise<string | null> {
    try {
      const response = await axios.post('https://quote-api.jup.ag/v6/swap', {
        quoteResponse: quote,
        userPublicKey: this.walletAddress,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      }, {
        timeout: 15000
      });

      return response.data.swapTransaction;
      
    } catch (error) {
      return null;
    }
  }

  private async submitTransaction(transactionBase64: string): Promise<string | null> {
    try {
      const transactionBuf = Buffer.from(transactionBase64, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);
      
      transaction.sign([this.walletKeypair]);
      
      const signature = await this.connection.sendTransaction(transaction, {
        maxRetries: 3,
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });
      
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        return null;
      }
      
      return signature;
      
    } catch (error) {
      return null;
    }
  }

  private async updateSOLBalance(): Promise<void> {
    const balance = await this.connection.getBalance(this.walletKeypair.publicKey);
    this.currentSOLBalance = balance / LAMPORTS_PER_SOL;
  }

  private async showConversionResults(): Promise<void> {
    console.log('\n' + '='.repeat(50));
    console.log('💰 USDC CONVERSION RESULTS');
    console.log('='.repeat(50));
    
    console.log(`💎 Final SOL Balance: ${this.currentSOLBalance.toFixed(6)} SOL`);
    
    if (this.conversionProfit > 0) {
      console.log(`💱 USDC Converted: ${this.usdcBalance.toFixed(6)} USDC`);
      console.log(`📈 SOL Gained: ${this.conversionProfit.toFixed(6)} SOL`);
      console.log(`✅ All funds now optimized as SOL!`);
    } else {
      console.log(`✅ No USDC conversion needed`);
      console.log(`🎯 All funds already in optimal SOL format`);
    }
    
    const progressToTarget = (this.currentSOLBalance / 1.0) * 100;
    console.log(`\n🎯 Progress to 1 SOL: ${progressToTarget.toFixed(1)}%`);
    console.log(`📊 Remaining: ${(1.0 - this.currentSOLBalance).toFixed(6)} SOL`);
    
    const totalValue = this.currentSOLBalance * 95.50;
    console.log(`💵 Total Value: $${totalValue.toFixed(2)}`);
    
    console.log('\n🚀 READY FOR MAXIMUM TRADING POWER!');
    console.log('='.repeat(50));
  }
}

async function main(): Promise<void> {
  const converter = new ConvertAllUSDCToSOL();
  await converter.convertAllUSDCToSOL();
}

main().catch(console.error);