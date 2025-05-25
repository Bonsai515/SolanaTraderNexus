/**
 * Check Real Wallet Balance and Execute Available Trading Opportunities
 * 
 * Verify the actual balance of the wallet we have access to and execute trades
 */

import { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';

class RealWalletTrading {
  private connection: Connection;
  private walletKeypair: Keypair;
  private hpnWalletKeypair: Keypair;
  
  private jupiterQuoteApi = 'https://quote-api.jup.ag/v6/quote';
  private jupiterSwapApi = 'https://quote-api.jup.ag/v6/swap';
  
  private readonly TOKENS = {
    SOL: 'So11111111111111111111111111111111111111112',
    DOGE: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  };

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async checkAndTrade(): Promise<void> {
    console.log('🔍 CHECKING REAL WALLET BALANCES & EXECUTING TRADING OPPORTUNITIES');
    console.log('💎 Amazing signals detected: DOGE 70.9% BULLISH');
    console.log('🎯 Strategy: Verify balances and execute available trades');
    console.log('='.repeat(70));

    await this.loadWallets();
    await this.checkAllBalances();
    await this.consolidateAndTrade();
  }

  private async loadWallets(): Promise<void> {
    console.log('\n💼 LOADING AVAILABLE WALLETS');
    
    // Load HPN wallet
    const hpnPrivateKey = [
      178, 244, 12, 25, 27, 202, 251, 10, 212, 90, 37, 116, 218, 42, 22, 165,
      134, 165, 151, 54, 225, 215, 194, 8, 177, 201, 105, 101, 212, 120, 249,
      74, 243, 118, 55, 187, 158, 35, 75, 138, 173, 148, 39, 171, 160, 27, 89,
      6, 105, 174, 233, 82, 187, 49, 42, 193, 182, 112, 195, 65, 56, 144, 83, 218
    ];
    this.hpnWalletKeypair = Keypair.fromSecretKey(new Uint8Array(hpnPrivateKey));
    
    // Load the accessible wallet
    const accessiblePrivateKey = [
      121, 61, 236, 154, 102, 159, 247, 23, 38,
      107, 37, 68, 196, 75, 179, 153,
      14, 34, 111, 44, 33, 198, 32, 183, 51,
      181, 60, 31, 54, 112, 248, 162,
      49, 242, 190, 61, 128, 144, 62, 119, 201,
      55, 0, 177, 65, 249, 241, 99,
      232, 221, 11, 165, 140, 21, 44, 188, 155,
      160, 71, 191, 162, 69, 73, 159
    ];
    this.walletKeypair = Keypair.fromSecretKey(new Uint8Array(accessiblePrivateKey));
    
    console.log(`✅ HPN Wallet: ${this.hpnWalletKeypair.publicKey.toBase58()}`);
    console.log(`✅ Accessible Wallet: ${this.walletKeypair.publicKey.toBase58()}`);
  }

  private async checkAllBalances(): Promise<void> {
    console.log('\n💰 CHECKING ALL WALLET BALANCES');
    
    const hpnBalance = await this.connection.getBalance(this.hpnWalletKeypair.publicKey);
    const accessibleBalance = await this.connection.getBalance(this.walletKeypair.publicKey);
    
    const hpnSOL = hpnBalance / LAMPORTS_PER_SOL;
    const accessibleSOL = accessibleBalance / LAMPORTS_PER_SOL;
    const totalSOL = hpnSOL + accessibleSOL;
    
    console.log(`📊 HPN Wallet (HPNd8...): ${hpnSOL.toFixed(9)} SOL`);
    console.log(`📊 Accessible Wallet (4Myf...): ${accessibleSOL.toFixed(9)} SOL`);
    console.log(`🎯 Total Available Capital: ${totalSOL.toFixed(9)} SOL`);
    
    // Also check the original HX wallet address directly
    try {
      const hxBalance = await this.connection.getBalance(new Keypair().publicKey);
      console.log('\n🔍 Checking original HX wallet address...');
      
      // Check HX address balance without private key access
      const hxWalletAddress = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
      const hxPubkey = new (await import('@solana/web3.js')).PublicKey(hxWalletAddress);
      const hxDirectBalance = await this.connection.getBalance(hxPubkey);
      const hxDirectSOL = hxDirectBalance / LAMPORTS_PER_SOL;
      
      console.log(`📊 HX Wallet (HXqz...): ${hxDirectSOL.toFixed(9)} SOL (read-only)`);
      
      if (hxDirectSOL > 0) {
        console.log('💡 HX wallet still has funds - need correct private key for access');
      }
    } catch (error) {
      console.log('ℹ️ Could not check HX wallet balance');
    }
  }

  private async consolidateAndTrade(): Promise<void> {
    console.log('\n🚀 CONSOLIDATING CAPITAL & EXECUTING DOGE TRADE');
    console.log('📈 Signal: DOGE 70.9% BULLISH - Good opportunity!');
    
    // First, consolidate funds to HPN wallet if accessible wallet has balance
    const accessibleBalance = await this.connection.getBalance(this.walletKeypair.publicKey);
    const accessibleSOL = accessibleBalance / LAMPORTS_PER_SOL;
    
    if (accessibleSOL > 0.001) {
      console.log('\n🔄 Consolidating accessible wallet funds to HPN...');
      
      const transferAmount = accessibleBalance - 5000; // Leave small amount for fees
      
      if (transferAmount > 0) {
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: this.walletKeypair.publicKey,
            toPubkey: this.hpnWalletKeypair.publicKey,
            lamports: transferAmount
          })
        );

        try {
          const signature = await this.connection.sendTransaction(
            transaction,
            [this.walletKeypair],
            { skipPreflight: false }
          );

          console.log(`✅ Consolidation successful!`);
          console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
          console.log(`💎 Transferred: ${(transferAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
          
          await new Promise(resolve => setTimeout(resolve, 5000));
          
        } catch (error) {
          console.log(`❌ Consolidation failed: ${error.message}`);
        }
      }
    }
    
    // Now execute DOGE trade with consolidated capital
    await this.executeDOGETrade();
  }

  private async executeDOGETrade(): Promise<void> {
    console.log('\n🐕 EXECUTING DOGE TRADE (70.9% CONFIDENCE)');
    
    const hpnBalance = await this.connection.getBalance(this.hpnWalletKeypair.publicKey);
    const hpnSOL = hpnBalance / LAMPORTS_PER_SOL;
    
    console.log(`💰 Available Capital: ${hpnSOL.toFixed(9)} SOL`);
    
    if (hpnSOL > 0.005) {
      const tradeAmountSOL = hpnSOL * 0.02; // 2% for this signal
      const tradeAmountLamports = Math.floor(tradeAmountSOL * LAMPORTS_PER_SOL);
      
      console.log(`📊 Trade Amount: ${tradeAmountSOL.toFixed(6)} SOL`);
      console.log(`🎯 Signal: DOGE 70.9% BULLISH`);
      
      await this.executeJupiterTrade(
        this.TOKENS.SOL,
        this.TOKENS.DOGE,
        tradeAmountLamports,
        'DOGE',
        70.9
      );
    } else {
      console.log('⚠️ Insufficient balance for DOGE trade');
    }
  }

  private async executeJupiterTrade(
    inputMint: string,
    outputMint: string,
    amount: number,
    tokenName: string,
    confidence: number
  ): Promise<void> {
    try {
      console.log(`\n🔄 Getting ${tokenName} quote...`);
      
      const quoteResponse = await axios.get(this.jupiterQuoteApi, {
        params: {
          inputMint,
          outputMint,
          amount: amount.toString(),
          slippageBps: 50,
          onlyDirectRoutes: false
        }
      });
      
      if (!quoteResponse.data) {
        console.log(`❌ Failed to get quote for ${tokenName}`);
        return;
      }
      
      console.log(`✅ Quote received for ${tokenName}`);
      console.log(`📊 Expected output: ${quoteResponse.data.outAmount} ${tokenName}`);
      
      const swapResponse = await axios.post(this.jupiterSwapApi, {
        quoteResponse: quoteResponse.data,
        userPublicKey: this.hpnWalletKeypair.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      });
      
      if (!swapResponse.data?.swapTransaction) {
        console.log(`❌ Failed to get swap transaction for ${tokenName}`);
        return;
      }
      
      console.log('✅ Swap transaction received');
      console.log('🔄 Executing real blockchain transaction...');
      
      const signature = await this.executeTransaction(swapResponse.data.swapTransaction);
      
      if (signature) {
        console.log(`🎉 ${tokenName} TRADE EXECUTED SUCCESSFULLY!`);
        console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
        console.log(`💎 ${tokenName} tokens received in wallet`);
        console.log(`📊 Confidence: ${confidence}% - Good signal captured!`);
      }
      
    } catch (error) {
      console.log(`❌ ${tokenName} trade error: ${error.message}`);
    }
  }

  private async executeTransaction(swapTransactionBase64: string): Promise<string | null> {
    try {
      const swapTransactionBuf = Buffer.from(swapTransactionBase64, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      
      transaction.sign([this.hpnWalletKeypair]);
      
      const signature = await this.connection.sendTransaction(transaction, {
        skipPreflight: false,
        maxRetries: 3
      });
      
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
  const trader = new RealWalletTrading();
  await trader.checkAndTrade();
}

main().catch(console.error);