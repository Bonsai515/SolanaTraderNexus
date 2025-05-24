/**
 * Kamino Real Borrowing Execution
 * Direct connection to Kamino protocol for real borrowing
 */

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { KaminoMarket, KaminoAction } from '@hubbleprotocol/kamino-lending-sdk';
import bs58 from 'bs58';
import * as fs from 'fs';

class KaminoRealBorrowing {
  private connection: Connection;
  private walletKeypair: Keypair;
  private walletAddress: string;
  private currentBalance: number;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    
    // Load wallet from private key
    const privateKeyString = fs.readFileSync('./wallet-private-key.txt', 'utf8').trim();
    const secretKey = bs58.decode(privateKeyString);
    this.walletKeypair = Keypair.fromSecretKey(secretKey);
    this.walletAddress = this.walletKeypair.publicKey.toBase58();
    this.currentBalance = 0;

    console.log('[Kamino] 🚀 KAMINO REAL BORROWING EXECUTION');
    console.log(`[Kamino] 📍 Wallet: ${this.walletAddress}`);
  }

  public async executeKaminoBorrowing(): Promise<void> {
    console.log('[Kamino] === EXECUTING REAL KAMINO BORROWING ===');
    
    try {
      // Check current balance
      await this.checkBalance();
      
      // Execute real Kamino borrowing
      await this.borrowFromKamino();
      
    } catch (error) {
      console.error('[Kamino] Borrowing failed:', (error as Error).message);
      console.log('\n[Kamino] === ALTERNATIVE: MANUAL KAMINO BORROWING ===');
      console.log('🌐 Visit: https://app.kamino.finance');
      console.log(`🔗 Connect wallet: ${this.walletAddress}`);
      console.log('💰 Follow these steps:');
      console.log('1. Connect your wallet to Kamino');
      console.log('2. Navigate to "Lend" section');
      console.log('3. Find SOL lending pool');
      console.log(`4. Deposit ${(this.currentBalance * 0.2).toFixed(6)} SOL as collateral`);
      console.log(`5. Borrow ${(this.currentBalance * 0.2 * 0.68).toFixed(6)} SOL (68% LTV)`);
      console.log('6. Confirm transactions');
      console.log('\n✅ This will give you additional SOL for trading!');
    }
  }

  private async checkBalance(): Promise<void> {
    try {
      const balance = await this.connection.getBalance(this.walletKeypair.publicKey);
      this.currentBalance = balance / LAMPORTS_PER_SOL;
      
      console.log(`[Kamino] 💰 Current Balance: ${this.currentBalance.toFixed(6)} SOL`);
      
      if (this.currentBalance < 0.01) {
        console.log('[Kamino] ⚠️ Balance too low for meaningful borrowing');
        console.log('[Kamino] Consider adding more SOL to your wallet first');
      }
      
    } catch (error) {
      console.error('[Kamino] Balance check failed:', (error as Error).message);
    }
  }

  private async borrowFromKamino(): Promise<void> {
    try {
      console.log('[Kamino] 🔧 Initializing Kamino connection...');
      
      // Initialize Kamino Market
      const kaminoMarket = await KaminoMarket.load(
        this.connection,
        new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6KkF5PiGqocw"), // Main Kamino market
        1 // commitment level
      );
      
      console.log('[Kamino] ✅ Kamino market loaded');
      
      // Find SOL reserve
      const solReserve = kaminoMarket.getReserveBySymbol('SOL');
      if (!solReserve) {
        throw new Error('SOL reserve not found in Kamino');
      }
      
      console.log('[Kamino] ✅ SOL reserve found');
      
      // Calculate borrowing amounts
      const collateralAmount = this.currentBalance * 0.2; // Use 20% as collateral
      const borrowAmount = collateralAmount * 0.68; // 68% LTV (conservative)
      
      console.log(`[Kamino] 🔒 Collateral: ${collateralAmount.toFixed(6)} SOL`);
      console.log(`[Kamino] 💰 Borrowing: ${borrowAmount.toFixed(6)} SOL`);
      
      // Create deposit action
      console.log('[Kamino] 📝 Creating deposit transaction...');
      const depositAction = await KaminoAction.buildDepositTxns(
        kaminoMarket,
        collateralAmount.toString(),
        solReserve.stats.mintAddress,
        this.walletKeypair.publicKey,
        new PublicKey("11111111111111111111111111111111"), // SOL mint
        { commitment: 'confirmed' }
      );
      
      // Execute deposit
      if (depositAction.setupIxs.length > 0) {
        const setupTx = new Transaction().add(...depositAction.setupIxs);
        const setupSig = await sendAndConfirmTransaction(
          this.connection,
          setupTx,
          [this.walletKeypair],
          { commitment: 'confirmed' }
        );
        console.log(`[Kamino] ✅ Setup transaction: ${setupSig}`);
      }
      
      const depositTx = new Transaction().add(...depositAction.lendingIxs);
      const depositSig = await sendAndConfirmTransaction(
        this.connection,
        depositTx,
        [this.walletKeypair],
        { commitment: 'confirmed' }
      );
      
      console.log(`[Kamino] ✅ Collateral deposited: ${depositSig}`);
      console.log(`[Kamino] 🌐 View: https://solscan.io/tx/${depositSig}`);
      
      // Wait a bit for deposit to settle
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Create borrow action
      console.log('[Kamino] 📝 Creating borrow transaction...');
      const borrowAction = await KaminoAction.buildBorrowTxns(
        kaminoMarket,
        borrowAmount.toString(),
        solReserve.stats.mintAddress,
        this.walletKeypair.publicKey,
        { commitment: 'confirmed' }
      );
      
      // Execute borrow
      const borrowTx = new Transaction().add(...borrowAction.lendingIxs);
      const borrowSig = await sendAndConfirmTransaction(
        this.connection,
        borrowTx,
        [this.walletKeypair],
        { commitment: 'confirmed' }
      );
      
      console.log(`[Kamino] ✅ BORROWING SUCCESSFUL: ${borrowSig}`);
      console.log(`[Kamino] 🌐 View: https://solscan.io/tx/${borrowSig}`);
      
      // Show success results
      await this.showBorrowingResults(collateralAmount, borrowAmount, depositSig, borrowSig);
      
    } catch (error) {
      console.error('[Kamino] Real borrowing error:', (error as Error).message);
      throw error;
    }
  }

  private async showBorrowingResults(
    collateral: number, 
    borrowed: number, 
    depositTx: string, 
    borrowTx: string
  ): Promise<void> {
    // Check new balance
    const newBalance = await this.connection.getBalance(this.walletKeypair.publicKey);
    const newBalanceSOL = newBalance / LAMPORTS_PER_SOL;
    
    console.log('\n[Kamino] === KAMINO BORROWING SUCCESS! ===');
    console.log('🎉 REAL BORROWING COMPLETED! 🎉');
    console.log('==============================');
    
    console.log(`💰 Original Balance: ${this.currentBalance.toFixed(6)} SOL`);
    console.log(`🔒 Collateral Deposited: ${collateral.toFixed(6)} SOL`);
    console.log(`💸 Amount Borrowed: ${borrowed.toFixed(6)} SOL`);
    console.log(`📈 New Balance: ${newBalanceSOL.toFixed(6)} SOL`);
    console.log(`🚀 Capital Increase: +${((newBalanceSOL / this.currentBalance - 1) * 100).toFixed(1)}%`);
    
    console.log('\n🔗 TRANSACTION DETAILS:');
    console.log('======================');
    console.log(`Deposit Transaction: ${depositTx}`);
    console.log(`Solscan: https://solscan.io/tx/${depositTx}`);
    console.log(`Borrow Transaction: ${borrowTx}`);
    console.log(`Solscan: https://solscan.io/tx/${borrowTx}`);
    
    const dailyInterest = borrowed * (6.5 / 100 / 365);
    const monthlyInterest = dailyInterest * 30;
    
    console.log('\n💸 BORROWING COSTS:');
    console.log('==================');
    console.log(`Interest Rate: 6.5% APR`);
    console.log(`Daily Interest: ${dailyInterest.toFixed(6)} SOL`);
    console.log(`Monthly Interest: ${monthlyInterest.toFixed(6)} SOL`);
    
    console.log('\n🎯 NEXT STEPS FOR PROFIT:');
    console.log('========================');
    console.log('• Deploy your increased capital in yield strategies');
    console.log('• Target 15-25% APY to easily cover 6.5% borrowing cost');
    console.log('• Consider additional borrowing from other protocols');
    console.log('• Monitor your Kamino position regularly');
    console.log('• Scale successful trading strategies');
    
    console.log('\n✅ CONGRATULATIONS!');
    console.log('You successfully executed real borrowing from Kamino Protocol!');
    console.log('Your capital is now leveraged for maximum trading potential.');
  }
}

// Execute Kamino borrowing
async function main(): Promise<void> {
  const kamino = new KaminoRealBorrowing();
  await kamino.executeKaminoBorrowing();
}

main().catch(console.error);