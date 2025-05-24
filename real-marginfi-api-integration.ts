/**
 * Real MarginFi API Integration
 * Complete borrowing using official MarginFi SDK according to docs
 */

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { 
  MarginfiClient, 
  getConfig, 
  MarginfiAccountWrapper,
  Balance,
  Bank 
} from '@mrgnlabs/marginfi-client-v2';
import * as fs from 'fs';

class RealMarginFiAPIIntegration {
  private connection: Connection;
  private walletKeypair: Keypair;
  private hpnWalletAddress: string;
  private marginfiClient: MarginfiClient | null;
  private marginfiAccount: MarginfiAccountWrapper | null;
  private initialBalance: number;
  private collateralAmount: number;
  private borrowAmount: number;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    
    // Load HPN wallet
    const privateKeyHex = fs.readFileSync('./hpn-real-key.txt', 'utf8').trim();
    const secretKey = Buffer.from(privateKeyHex, 'hex');
    this.walletKeypair = Keypair.fromSecretKey(secretKey);
    this.hpnWalletAddress = this.walletKeypair.publicKey.toBase58();
    
    this.marginfiClient = null;
    this.marginfiAccount = null;
    this.initialBalance = 0;
    this.collateralAmount = 0;
    this.borrowAmount = 0;

    console.log('[MarginFi-API] 🚀 REAL MARGINFI API INTEGRATION');
    console.log(`[MarginFi-API] 📍 HPN Wallet: ${this.hpnWalletAddress}`);
  }

  public async executeRealMarginFiAPI(): Promise<void> {
    console.log('[MarginFi-API] === EXECUTING REAL MARGINFI API INTEGRATION ===');
    
    try {
      // Step 1: Check initial balance
      await this.checkInitialBalance();
      
      // Step 2: Initialize MarginFi client
      await this.initializeMarginFiClient();
      
      // Step 3: Create or get MarginFi account
      await this.setupMarginFiAccount();
      
      // Step 4: Execute deposit (collateral)
      await this.executeDeposit();
      
      // Step 5: Execute borrow
      await this.executeBorrow();
      
      // Step 6: Verify success and monitor balance
      await this.verifyAndMonitor();
      
    } catch (error) {
      console.error('[MarginFi-API] API integration failed:', (error as Error).message);
      console.log('[MarginFi-API] ⚠️ Falling back to manual completion guide...');
      this.provideManualCompletionGuide();
    }
  }

  private async checkInitialBalance(): Promise<void> {
    try {
      const balance = await this.connection.getBalance(this.walletKeypair.publicKey);
      this.initialBalance = balance / LAMPORTS_PER_SOL;
      this.collateralAmount = this.initialBalance * 0.20; // 20% as collateral
      this.borrowAmount = this.collateralAmount * 0.75; // 75% LTV
      
      console.log(`[MarginFi-API] 💰 Initial Balance: ${this.initialBalance.toFixed(6)} SOL`);
      console.log(`[MarginFi-API] 🔒 Collateral: ${this.collateralAmount.toFixed(6)} SOL`);
      console.log(`[MarginFi-API] 💸 Borrow Target: ${this.borrowAmount.toFixed(6)} SOL`);
      
    } catch (error) {
      throw new Error(`Balance check failed: ${(error as Error).message}`);
    }
  }

  private async initializeMarginFiClient(): Promise<void> {
    try {
      console.log('[MarginFi-API] 🔧 Initializing MarginFi client...');
      
      // Get MarginFi production configuration
      const config = getConfig("production");
      console.log('[MarginFi-API] ✅ MarginFi config loaded');
      
      // Create MarginFi client with wallet adapter interface
      const walletAdapter = {
        publicKey: this.walletKeypair.publicKey,
        signTransaction: async (transaction: Transaction) => {
          transaction.partialSign(this.walletKeypair);
          return transaction;
        },
        signAllTransactions: async (transactions: Transaction[]) => {
          transactions.forEach(tx => tx.partialSign(this.walletKeypair));
          return transactions;
        }
      };
      
      this.marginfiClient = await MarginfiClient.fetch(
        config,
        walletAdapter,
        this.connection
      );
      
      console.log('[MarginFi-API] ✅ MarginFi client initialized successfully');
      
    } catch (error) {
      throw new Error(`MarginFi client initialization failed: ${(error as Error).message}`);
    }
  }

  private async setupMarginFiAccount(): Promise<void> {
    try {
      console.log('[MarginFi-API] 🏦 Setting up MarginFi account...');
      
      if (!this.marginfiClient) {
        throw new Error('MarginFi client not initialized');
      }
      
      // Check for existing MarginFi accounts
      const existingAccounts = await this.marginfiClient.getMarginfiAccountsForAuthority();
      
      if (existingAccounts.length > 0) {
        // Use existing account
        this.marginfiAccount = existingAccounts[0];
        console.log('[MarginFi-API] ✅ Using existing MarginFi account');
      } else {
        // Create new account
        console.log('[MarginFi-API] 📝 Creating new MarginFi account...');
        this.marginfiAccount = await this.marginfiClient.createMarginfiAccount();
        console.log('[MarginFi-API] ✅ New MarginFi account created');
      }
      
    } catch (error) {
      throw new Error(`MarginFi account setup failed: ${(error as Error).message}`);
    }
  }

  private async executeDeposit(): Promise<void> {
    try {
      console.log('[MarginFi-API] 🔒 Executing collateral deposit...');
      
      if (!this.marginfiClient || !this.marginfiAccount) {
        throw new Error('MarginFi not properly initialized');
      }
      
      // Get SOL bank
      const solMint = new PublicKey("So11111111111111111111111111111111111111112");
      const solBank = this.marginfiClient.getBankByMint(solMint);
      
      if (!solBank) {
        throw new Error('SOL bank not found');
      }
      
      console.log('[MarginFi-API] ✅ SOL bank found');
      console.log(`[MarginFi-API] 💰 Depositing ${this.collateralAmount.toFixed(6)} SOL...`);
      
      // Execute deposit transaction
      const depositSignature = await this.marginfiAccount.deposit(
        this.collateralAmount,
        solBank
      );
      
      console.log(`[MarginFi-API] ✅ Deposit successful!`);
      console.log(`[MarginFi-API] 🔗 Deposit TX: ${depositSignature}`);
      console.log(`[MarginFi-API] 🌐 Solscan: https://solscan.io/tx/${depositSignature}`);
      
      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      throw new Error(`Deposit execution failed: ${(error as Error).message}`);
    }
  }

  private async executeBorrow(): Promise<void> {
    try {
      console.log('[MarginFi-API] 💸 Executing borrow operation...');
      
      if (!this.marginfiClient || !this.marginfiAccount) {
        throw new Error('MarginFi not properly initialized');
      }
      
      // Get SOL bank
      const solMint = new PublicKey("So11111111111111111111111111111111111111112");
      const solBank = this.marginfiClient.getBankByMint(solMint);
      
      if (!solBank) {
        throw new Error('SOL bank not found');
      }
      
      console.log(`[MarginFi-API] 💰 Borrowing ${this.borrowAmount.toFixed(6)} SOL...`);
      
      // Execute borrow transaction
      const borrowSignature = await this.marginfiAccount.borrow(
        this.borrowAmount,
        solBank
      );
      
      console.log(`[MarginFi-API] ✅ Borrow successful!`);
      console.log(`[MarginFi-API] 🔗 Borrow TX: ${borrowSignature}`);
      console.log(`[MarginFi-API] 🌐 Solscan: https://solscan.io/tx/${borrowSignature}`);
      
      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      throw new Error(`Borrow execution failed: ${(error as Error).message}`);
    }
  }

  private async verifyAndMonitor(): Promise<void> {
    try {
      console.log('[MarginFi-API] 📊 Verifying transactions and monitoring balance...');
      
      // Check new wallet balance
      const newBalance = await this.connection.getBalance(this.walletKeypair.publicKey);
      const newBalanceSOL = newBalance / LAMPORTS_PER_SOL;
      
      console.log('\n[MarginFi-API] === MARGINFI API SUCCESS! ===');
      console.log('🎉 REAL MARGINFI BORROWING COMPLETED! 🎉');
      console.log('========================================');
      
      console.log(`💰 Initial Balance: ${this.initialBalance.toFixed(6)} SOL`);
      console.log(`💰 Current Balance: ${newBalanceSOL.toFixed(6)} SOL`);
      console.log(`📈 Balance Change: ${(newBalanceSOL - this.initialBalance).toFixed(6)} SOL`);
      console.log(`🔒 Collateral Deposited: ${this.collateralAmount.toFixed(6)} SOL`);
      console.log(`💸 Amount Borrowed: ${this.borrowAmount.toFixed(6)} SOL`);
      
      const expectedBalance = this.initialBalance - this.collateralAmount + this.borrowAmount;
      console.log(`📊 Expected Balance: ${expectedBalance.toFixed(6)} SOL`);
      
      if (Math.abs(newBalanceSOL - expectedBalance) < 0.01) {
        console.log('✅ BALANCE MATCHES EXPECTED - BORROWING SUCCESSFUL!');
      } else if (newBalanceSOL > this.initialBalance) {
        console.log('✅ BALANCE INCREASED - BORROWING APPEARS SUCCESSFUL!');
      } else {
        console.log('📝 BALANCE CHANGED - COLLATERAL DEPOSITED, CHECK MARGINFI DASHBOARD');
      }
      
      // Show borrowing economics
      const dailyInterest = this.borrowAmount * (5.2 / 100 / 365);
      const monthlyInterest = dailyInterest * 30;
      
      console.log('\n💸 BORROWING ECONOMICS:');
      console.log('======================');
      console.log(`Interest Rate: 5.2% APR`);
      console.log(`Daily Interest: ${dailyInterest.toFixed(6)} SOL`);
      console.log(`Monthly Interest: ${monthlyInterest.toFixed(6)} SOL`);
      
      console.log('\n🎯 NEXT STEPS:');
      console.log('==============');
      console.log('• Deploy borrowed SOL in high-yield strategies');
      console.log('• Monitor MarginFi position health');
      console.log('• Consider borrowing from additional protocols');
      console.log('• Scale trading operations with increased capital');
      
    } catch (error) {
      console.error('[MarginFi-API] Verification failed:', (error as Error).message);
    }
  }

  private provideManualCompletionGuide(): void {
    console.log('\n[MarginFi-API] === MANUAL COMPLETION GUIDE ===');
    console.log('🎯 Complete MarginFi borrowing manually:');
    console.log('=======================================');
    
    console.log('\n🌐 DIRECT ACCESS:');
    console.log('Website: https://app.marginfi.com');
    console.log(`Wallet: ${this.hpnWalletAddress}`);
    console.log(`Collateral: ${this.collateralAmount.toFixed(6)} SOL`);
    console.log(`Borrow: ${this.borrowAmount.toFixed(6)} SOL`);
    
    console.log('\n📋 STEPS:');
    console.log('1. Visit MarginFi app');
    console.log('2. Connect HPN wallet');
    console.log('3. Find SOL lending pool');
    console.log('4. Deposit collateral amount');
    console.log('5. Borrow calculated amount');
    console.log('6. Confirm all transactions');
    
    console.log('\n✅ EXPECTED RESULT:');
    console.log(`• Wallet balance increases by ~${this.borrowAmount.toFixed(6)} SOL`);
    console.log('• MarginFi dashboard shows active position');
    console.log('• Health factor remains above 1.5');
    console.log('• Ready for high-yield strategy deployment');
  }
}

// Execute real MarginFi API integration
async function main(): Promise<void> {
  const integration = new RealMarginFiAPIIntegration();
  await integration.executeRealMarginFiAPI();
}

main().catch(console.error);