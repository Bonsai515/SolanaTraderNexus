/**
 * Convert USDC to SOL Immediately
 * 
 * Checks your USDC balance and converts it to SOL to stop losses
 * Uses Jupiter DEX for best rates
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

class USDCToSOLConverter {
  private connection: Connection;
  private walletKeypair: Keypair;
  private walletAddress: string;
  private usdcMint: PublicKey;
  private usdcBalance: number;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mint
    this.usdcBalance = 0;
  }

  public async convertUSDCToSOL(): Promise<void> {
    console.log('💰 USDC TO SOL CONVERTER');
    console.log('🚀 Converting your USDC to SOL immediately');
    console.log('='.repeat(50));

    await this.loadWallet();
    await this.checkUSDCBalance();
    await this.executeUSDCConversion();
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

  private async checkUSDCBalance(): Promise<void> {
    console.log('\n💵 CHECKING YOUR USDC BALANCE');
    
    try {
      // Get all token accounts
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        this.walletKeypair.publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      console.log(`📊 Scanning ${tokenAccounts.value.length} token accounts...`);

      let usdcFound = false;
      let usdcAccount = '';

      // Look for USDC tokens
      for (const account of tokenAccounts.value) {
        const parsedInfo = account.account.data.parsed.info;
        const mint = parsedInfo.mint;
        const balance = parsedInfo.tokenAmount.uiAmount;

        if (mint === this.usdcMint.toBase58()) {
          usdcFound = true;
          this.usdcBalance = balance || 0;
          usdcAccount = account.pubkey.toBase58();
          
          console.log('\n💵 USDC FOUND!');
          console.log(`💰 USDC Balance: ${this.usdcBalance.toFixed(6)} USDC`);
          console.log(`🔗 Token Account: ${usdcAccount}`);
          console.log(`💲 USD Value: $${this.usdcBalance.toFixed(2)}`);
          
          break;
        }
      }

      if (!usdcFound || this.usdcBalance === 0) {
        console.log('\n❌ No USDC found in your wallet');
        console.log('💡 Checking other stable tokens...');
        
        // Check for other stablecoins
        await this.checkOtherStablecoins(tokenAccounts.value);
      } else {
        const solEquivalent = this.usdcBalance / 95.50; // Approximate SOL price
        console.log(`🎯 Converts to: ~${solEquivalent.toFixed(6)} SOL`);
      }

    } catch (error) {
      console.log(`❌ Error checking USDC balance: ${error.message}`);
    }
  }

  private async checkOtherStablecoins(tokenAccounts: any[]): Promise<void> {
    const stablecoins = [
      { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT' }, // Tether
      { mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', symbol: 'RAY' }, // Raydium
      { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL' } // Wrapped SOL
    ];

    console.log('\n🔍 CHECKING OTHER TOKENS:');
    
    for (const account of tokenAccounts) {
      const parsedInfo = account.account.data.parsed.info;
      const mint = parsedInfo.mint;
      const balance = parsedInfo.tokenAmount.uiAmount || 0;
      
      if (balance > 0) {
        const stablecoin = stablecoins.find(s => s.mint === mint);
        const symbol = stablecoin ? stablecoin.symbol : 'Unknown';
        
        console.log(`💰 ${symbol}: ${balance.toFixed(6)} (${mint.substring(0, 8)}...)`);
      }
    }
  }

  private async executeUSDCConversion(): Promise<void> {
    console.log('\n🚀 EXECUTING USDC TO SOL CONVERSION');
    
    if (this.usdcBalance <= 0) {
      console.log('❌ No USDC available for conversion');
      console.log('💡 Consider adding USDC to your wallet for conversion');
      return;
    }

    if (this.usdcBalance < 1) {
      console.log('⚠️ USDC balance is very small, conversion may not be cost-effective');
      console.log(`💰 Current USDC: ${this.usdcBalance.toFixed(6)} USDC`);
    }

    try {
      // Get Jupiter quote for USDC to SOL
      console.log('📊 Getting best rate from Jupiter DEX...');
      
      const quote = await this.getJupiterQuote();
      
      if (quote) {
        const expectedSOL = quote.outAmount / LAMPORTS_PER_SOL;
        console.log(`💱 Jupiter Quote:`);
        console.log(`   Input: ${this.usdcBalance.toFixed(6)} USDC`);
        console.log(`   Output: ${expectedSOL.toFixed(6)} SOL`);
        console.log(`   Rate: 1 USDC = ${(expectedSOL / this.usdcBalance).toFixed(6)} SOL`);
        
        // Get swap transaction
        const swapTransaction = await this.getJupiterSwap(quote);
        
        if (swapTransaction) {
          console.log('📝 Executing swap transaction...');
          const signature = await this.executeSwap(swapTransaction);
          
          if (signature) {
            console.log(`✅ CONVERSION SUCCESSFUL!`);
            console.log(`🔗 Transaction: ${signature}`);
            console.log(`🌐 Explorer: https://solscan.io/tx/${signature}`);
            console.log(`💰 You should now have ${expectedSOL.toFixed(6)} more SOL!`);
          }
        }
      }
      
    } catch (error) {
      console.log(`❌ Conversion error: ${error.message}`);
      console.log('💡 You may need to try again or check your USDC balance');
    }
  }

  private async getJupiterQuote(): Promise<any> {
    try {
      const usdcLamports = Math.floor(this.usdcBalance * 1000000); // USDC has 6 decimals
      
      const response = await axios.get(`https://quote-api.jup.ag/v6/quote`, {
        params: {
          inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          outputMint: 'So11111111111111111111111111111111111111112', // SOL
          amount: usdcLamports,
          slippageBps: 100 // 1% slippage
        },
        timeout: 10000
      });

      return response.data;
      
    } catch (error) {
      console.log(`⚠️ Jupiter quote error: ${error.message}`);
      return null;
    }
  }

  private async getJupiterSwap(quote: any): Promise<string | null> {
    try {
      const response = await axios.post('https://quote-api.jup.ag/v6/swap', {
        quoteResponse: quote,
        userPublicKey: this.walletAddress,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      }, {
        timeout: 10000
      });

      return response.data.swapTransaction;
      
    } catch (error) {
      console.log(`⚠️ Jupiter swap error: ${error.message}`);
      return null;
    }
  }

  private async executeSwap(transactionBase64: string): Promise<string | null> {
    try {
      // Deserialize and sign transaction
      const transactionBuf = Buffer.from(transactionBase64, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);
      
      transaction.sign([this.walletKeypair]);
      
      // Submit to blockchain
      const signature = await this.connection.sendTransaction(transaction, {
        maxRetries: 3,
        skipPreflight: false
      });
      
      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        console.log(`❌ Transaction failed: ${confirmation.value.err}`);
        return null;
      }
      
      return signature;
      
    } catch (error) {
      console.log(`❌ Transaction execution error: ${error.message}`);
      return null;
    }
  }
}

async function main(): Promise<void> {
  const converter = new USDCToSOLConverter();
  await converter.convertUSDCToSOL();
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ USDC CONVERSION COMPLETE');
  console.log('='.repeat(50));
}

main().catch(console.error);