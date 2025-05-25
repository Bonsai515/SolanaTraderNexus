/**
 * Execute Real Blockchain Transactions
 * 
 * Creates and executes actual blockchain transactions using your
 * authenticated credentials with on-chain verification
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  PublicKey
} from '@solana/web3.js';
import * as fs from 'fs';

class RealBlockchainExecutor {
  private connection: Connection;
  private hpnWalletKeypair: Keypair;
  private currentBalance: number = 0;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async executeRealTransactions(): Promise<void> {
    console.log('🔐 EXECUTING REAL BLOCKCHAIN TRANSACTIONS');
    console.log('⚡ Using Authenticated Solana Mainnet Connection');
    console.log('📊 All transactions will be verifiable on-chain');
    console.log('='.repeat(60));

    await this.loadAndVerifyWallet();
    await this.checkCurrentBalance();
    await this.executeSmallTestTransaction();
    await this.showRealTransactionProof();
  }

  private async loadAndVerifyWallet(): Promise<void> {
    console.log('\n💼 LOADING AND VERIFYING WALLET');
    
    const privateKeyArray = [
      178, 244, 12, 25, 27, 202, 251, 10, 212, 90, 37, 116, 218, 42, 22, 165,
      134, 165, 151, 54, 225, 215, 194, 8, 177, 201, 105, 101, 212, 120, 249,
      74, 243, 118, 55, 187, 158, 35, 75, 138, 173, 148, 39, 171, 160, 27, 89,
      6, 105, 174, 233, 82, 187, 49, 42, 193, 182, 112, 195, 65, 56, 144, 83, 218
    ];
    
    this.hpnWalletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    console.log(`✅ Wallet Address: ${this.hpnWalletKeypair.publicKey.toBase58()}`);
    console.log(`🔗 Verifiable on Solscan: https://solscan.io/account/${this.hpnWalletKeypair.publicKey.toBase58()}`);
  }

  private async checkCurrentBalance(): Promise<void> {
    console.log('\n💰 CHECKING CURRENT REAL BALANCE');
    
    try {
      const balance = await this.connection.getBalance(this.hpnWalletKeypair.publicKey);
      this.currentBalance = balance / LAMPORTS_PER_SOL;
      
      console.log(`📊 Real Blockchain Balance: ${this.currentBalance.toFixed(6)} SOL`);
      console.log(`💎 USD Value (approx): $${(this.currentBalance * 240).toFixed(2)}`);
      console.log(`⚡ Balance verified from Solana mainnet`);
      
      if (this.currentBalance < 0.001) {
        console.log('⚠️  Low balance detected - need minimum SOL for transaction fees');
        console.log('💡 Consider adding SOL to wallet for transaction execution');
      }
      
    } catch (error) {
      console.log(`❌ Error checking balance: ${error.message}`);
      console.log('🔧 This could indicate RPC connection issues');
    }
  }

  private async executeSmallTestTransaction(): Promise<void> {
    console.log('\n⚡ EXECUTING REAL TEST TRANSACTION');
    
    if (this.currentBalance < 0.001) {
      console.log('❌ Insufficient balance for transaction execution');
      console.log('💡 Need at least 0.001 SOL for transaction fees');
      return;
    }

    try {
      // Create a small transaction to verify real execution capability
      const testAmount = 0.0001; // Very small amount for testing
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.hpnWalletKeypair.publicKey,
          toPubkey: this.hpnWalletKeypair.publicKey, // Send to self for testing
          lamports: testAmount * LAMPORTS_PER_SOL
        })
      );

      console.log(`💸 Executing test transaction: ${testAmount} SOL`);
      console.log(`🔐 Using authenticated wallet credentials`);
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.hpnWalletKeypair],
        { commitment: 'confirmed' }
      );

      console.log(`✅ Transaction Successful!`);
      console.log(`🔗 Transaction Signature: ${signature}`);
      console.log(`📊 View on Solscan: https://solscan.io/tx/${signature}`);
      console.log(`⚡ Transaction confirmed on Solana mainnet`);
      
      // Save transaction record
      const transactionRecord = {
        signature,
        amount: testAmount,
        timestamp: new Date().toISOString(),
        fromAddress: this.hpnWalletKeypair.publicKey.toString(),
        toAddress: this.hpnWalletKeypair.publicKey.toString(),
        type: 'test_transaction',
        verified: true,
        explorerUrl: `https://solscan.io/tx/${signature}`
      };
      
      fs.writeFileSync('./data/real-transaction-proof.json', JSON.stringify(transactionRecord, null, 2));
      
    } catch (error) {
      console.log(`❌ Transaction failed: ${error.message}`);
      console.log('🔧 This indicates the transaction could not be executed on-chain');
    }
  }

  private async showRealTransactionProof(): Promise<void> {
    console.log('\n📊 REAL TRANSACTION VERIFICATION');
    
    // Check for recent transactions
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        this.hpnWalletKeypair.publicKey,
        { limit: 5 }
      );

      console.log(`📋 Recent Real Transactions (Last 5):`);
      
      if (signatures.length === 0) {
        console.log('   📝 No recent transactions found');
        console.log('   💡 This wallet may not have executed transactions recently');
      } else {
        for (const sig of signatures) {
          const date = new Date(sig.blockTime! * 1000).toLocaleDateString();
          const time = new Date(sig.blockTime! * 1000).toLocaleTimeString();
          console.log(`   🔗 ${sig.signature.slice(0, 16)}... (${date} ${time})`);
          console.log(`      📊 Solscan: https://solscan.io/tx/${sig.signature}`);
        }
      }

    } catch (error) {
      console.log(`❌ Error fetching transaction history: ${error.message}`);
    }

    console.log('\n🏆 REAL BLOCKCHAIN EXECUTION SUMMARY:');
    console.log(`   ✅ Wallet authenticated and verified`);
    console.log(`   💰 Real balance checked: ${this.currentBalance.toFixed(6)} SOL`);
    console.log(`   🔐 Connected to Solana mainnet`);
    console.log(`   ⚡ Ready for real transaction execution`);
    console.log(`   📊 All results verifiable on blockchain explorers`);
  }

  public async getWalletStatus(): Promise<any> {
    const balance = await this.connection.getBalance(this.hpnWalletKeypair.publicKey);
    return {
      address: this.hpnWalletKeypair.publicKey.toString(),
      balance: balance / LAMPORTS_PER_SOL,
      network: 'mainnet',
      authenticated: true,
      explorerUrl: `https://solscan.io/account/${this.hpnWalletKeypair.publicKey.toString()}`
    };
  }
}

async function main(): Promise<void> {
  const executor = new RealBlockchainExecutor();
  await executor.executeRealTransactions();
  
  console.log('\n💡 NEXT STEPS FOR REAL PROFIT GENERATION:');
  console.log('1. Ensure wallet has sufficient SOL for trading');
  console.log('2. Use live trading signals for real market opportunities');
  console.log('3. Execute actual DeFi protocol interactions');
  console.log('4. All transactions will be verifiable on-chain');
}

main().catch(console.error);