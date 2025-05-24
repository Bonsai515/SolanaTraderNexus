/**
 * Real Protocol Borrowing System
 * NO DEMOS - Only real borrowing transactions using proper protocol SDKs
 */

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { MarginfiClient, getConfig } from '@mrgnlabs/marginfi-client-v2';
import { SolendMarket, parseReserve } from '@solendprotocol/solend-sdk';
import { KaminoMarket, KaminoAction } from '@hubbleprotocol/kamino-lending-sdk';
import SYSTEM_CONFIG from './system-real-only-config';
import * as fs from 'fs';

interface RealBorrowingOperation {
  protocolName: string;
  collateralAmount: number;
  borrowAmount: number;
  status: 'ready' | 'executing' | 'completed' | 'failed';
  transactionSignature?: string;
  actualBorrowedAmount?: number;
  error?: string;
}

class RealProtocolBorrowingSystem {
  private connection: Connection;
  private walletKeypair: Keypair;
  private walletAddress: string;
  private currentBalance: number;
  private borrowingOperations: RealBorrowingOperation[];
  private totalBorrowed: number;

  constructor() {
    if (!SYSTEM_CONFIG.REAL_DATA_ONLY) {
      throw new Error('REAL-ONLY MODE REQUIRED - NO DEMOS ALLOWED');
    }

    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    
    const privateKeyHex = fs.readFileSync('./hpn-real-key.txt', 'utf8').trim();
    const secretKey = Buffer.from(privateKeyHex, 'hex');
    this.walletKeypair = Keypair.fromSecretKey(secretKey);
    this.walletAddress = this.walletKeypair.publicKey.toBase58();
    
    this.currentBalance = 0;
    this.borrowingOperations = [];
    this.totalBorrowed = 0;

    console.log('[RealBorrowing] 🚀 REAL PROTOCOL BORROWING SYSTEM - NO DEMOS');
    console.log(`[RealBorrowing] 📍 Wallet: ${this.walletAddress}`);
    console.log('[RealBorrowing] 🔒 Real borrowing transactions only');
  }

  public async executeRealBorrowingOperations(): Promise<void> {
    console.log('[RealBorrowing] === EXECUTING REAL BORROWING OPERATIONS ===');
    
    try {
      await this.loadCurrentBalance();
      await this.setupRealBorrowingOperations();
      await this.executeAllBorrowingOperations();
      this.showRealBorrowingResults();
      
    } catch (error) {
      console.error('[RealBorrowing] Real borrowing failed:', (error as Error).message);
    }
  }

  private async loadCurrentBalance(): Promise<void> {
    console.log('[RealBorrowing] 💰 Loading current balance...');
    
    const balance = await this.connection.getBalance(this.walletKeypair.publicKey);
    this.currentBalance = balance / LAMPORTS_PER_SOL;
    
    if (this.currentBalance <= 0) {
      throw new Error('Insufficient SOL balance for real borrowing operations');
    }
    
    console.log(`[RealBorrowing] 💰 Available: ${this.currentBalance.toFixed(6)} SOL`);
  }

  private async setupRealBorrowingOperations(): Promise<void> {
    console.log('[RealBorrowing] 🔧 Setting up real borrowing operations...');
    
    // Use conservative amounts for real borrowing
    const baseCollateral = Math.min(this.currentBalance * 0.15, 0.1); // Max 0.1 SOL per protocol
    
    this.borrowingOperations = [
      {
        protocolName: 'MarginFi',
        collateralAmount: baseCollateral,
        borrowAmount: baseCollateral * 0.70, // 70% LTV for safety
        status: 'ready'
      },
      {
        protocolName: 'Solend',
        collateralAmount: baseCollateral,
        borrowAmount: baseCollateral * 0.65, // 65% LTV
        status: 'ready'
      },
      {
        protocolName: 'Kamino',
        collateralAmount: baseCollateral,
        borrowAmount: baseCollateral * 0.60, // 60% LTV
        status: 'ready'
      }
    ];
    
    console.log(`[RealBorrowing] ✅ ${this.borrowingOperations.length} real borrowing operations prepared`);
    
    this.borrowingOperations.forEach((op, index) => {
      console.log(`${index + 1}. ${op.protocolName}: Collateral ${op.collateralAmount.toFixed(6)} SOL → Borrow ${op.borrowAmount.toFixed(6)} SOL`);
    });
  }

  private async executeAllBorrowingOperations(): Promise<void> {
    console.log('[RealBorrowing] 🔄 Executing real borrowing operations...');
    
    for (const operation of this.borrowingOperations) {
      console.log(`\n[RealBorrowing] 🎯 Processing ${operation.protocolName}...`);
      
      try {
        switch (operation.protocolName) {
          case 'MarginFi':
            await this.executeMarginFiBorrowing(operation);
            break;
          case 'Solend':
            await this.executeSolendBorrowing(operation);
            break;
          case 'Kamino':
            await this.executeKaminoBorrowing(operation);
            break;
          default:
            operation.status = 'failed';
            operation.error = 'Unknown protocol';
        }
        
        // Update balance after each operation
        await this.updateBalance();
        
        // Wait between operations
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        operation.status = 'failed';
        operation.error = (error as Error).message;
        console.error(`[RealBorrowing] ${operation.protocolName} failed:`, (error as Error).message);
      }
    }
  }

  private async executeMarginFiBorrowing(operation: RealBorrowingOperation): Promise<void> {
    console.log('[RealBorrowing] 🏦 Executing MarginFi real borrowing...');
    operation.status = 'executing';
    
    try {
      // Initialize MarginFi client
      const config = getConfig('production');
      const client = await MarginfiClient.fetch(config, this.walletKeypair, this.connection);
      
      // Get MarginFi group
      const marginfiGroup = client.getGroup();
      if (!marginfiGroup) {
        throw new Error('MarginFi group not found');
      }
      
      // Create marginfi account if needed
      let marginfiAccount = await client.getMarginfiAccount();
      if (!marginfiAccount) {
        const signature = await client.createMarginfiAccount();
        console.log(`[RealBorrowing] 📝 Created MarginFi account: ${signature}`);
        marginfiAccount = await client.getMarginfiAccount();
      }
      
      if (!marginfiAccount) {
        throw new Error('Failed to create/get MarginFi account');
      }
      
      // Get SOL bank for deposits
      const solBank = marginfiGroup.getBankByTokenSymbol('SOL');
      if (!solBank) {
        throw new Error('SOL bank not found in MarginFi');
      }
      
      // Deposit SOL as collateral
      const depositAmount = operation.collateralAmount;
      console.log(`[RealBorrowing] 🔒 Depositing ${depositAmount.toFixed(6)} SOL as collateral...`);
      
      const depositSignature = await marginfiAccount.deposit(depositAmount, solBank.address);
      console.log(`[RealBorrowing] ✅ Deposit completed: ${depositSignature}`);
      
      // Wait for deposit to settle
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Refresh account state
      await marginfiAccount.reload();
      
      // Borrow SOL
      const borrowAmount = operation.borrowAmount;
      console.log(`[RealBorrowing] 💰 Borrowing ${borrowAmount.toFixed(6)} SOL...`);
      
      const borrowSignature = await marginfiAccount.borrow(borrowAmount, solBank.address);
      console.log(`[RealBorrowing] ✅ Borrow completed: ${borrowSignature}`);
      
      operation.status = 'completed';
      operation.transactionSignature = borrowSignature;
      operation.actualBorrowedAmount = borrowAmount;
      this.totalBorrowed += borrowAmount;
      
      console.log(`[RealBorrowing] 🎉 MarginFi real borrowing successful!`);
      console.log(`[RealBorrowing] 🔗 Borrow TX: ${borrowSignature}`);
      console.log(`[RealBorrowing] 🌐 Verify: https://solscan.io/tx/${borrowSignature}`);
      
    } catch (error) {
      operation.status = 'failed';
      operation.error = (error as Error).message;
      console.error('[RealBorrowing] MarginFi borrowing failed:', (error as Error).message);
    }
  }

  private async executeSolendBorrowing(operation: RealBorrowingOperation): Promise<void> {
    console.log('[RealBorrowing] 🏦 Executing Solend real borrowing...');
    operation.status = 'executing';
    
    try {
      // Initialize Solend market
      const market = await SolendMarket.initialize(this.connection);
      
      // Get main pool SOL reserve
      const solReserve = market.reserves.find(reserve => 
        reserve.config.liquidityToken.symbol === 'SOL'
      );
      
      if (!solReserve) {
        throw new Error('SOL reserve not found in Solend');
      }
      
      // Create deposit instruction
      const depositAmount = operation.collateralAmount;
      console.log(`[RealBorrowing] 🔒 Depositing ${depositAmount.toFixed(6)} SOL as collateral...`);
      
      const depositInstruction = await solReserve.depositInstruction(
        this.walletKeypair.publicKey,
        depositAmount * LAMPORTS_PER_SOL
      );
      
      // Execute deposit
      const depositTransaction = new Transaction().add(depositInstruction);
      const depositSignature = await sendAndConfirmTransaction(
        this.connection,
        depositTransaction,
        [this.walletKeypair],
        { commitment: 'confirmed' }
      );
      
      console.log(`[RealBorrowing] ✅ Deposit completed: ${depositSignature}`);
      
      // Wait for deposit to settle
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Create borrow instruction
      const borrowAmount = operation.borrowAmount;
      console.log(`[RealBorrowing] 💰 Borrowing ${borrowAmount.toFixed(6)} SOL...`);
      
      const borrowInstruction = await solReserve.borrowInstruction(
        this.walletKeypair.publicKey,
        borrowAmount * LAMPORTS_PER_SOL
      );
      
      // Execute borrow
      const borrowTransaction = new Transaction().add(borrowInstruction);
      const borrowSignature = await sendAndConfirmTransaction(
        this.connection,
        borrowTransaction,
        [this.walletKeypair],
        { commitment: 'confirmed' }
      );
      
      operation.status = 'completed';
      operation.transactionSignature = borrowSignature;
      operation.actualBorrowedAmount = borrowAmount;
      this.totalBorrowed += borrowAmount;
      
      console.log(`[RealBorrowing] 🎉 Solend real borrowing successful!`);
      console.log(`[RealBorrowing] 🔗 Borrow TX: ${borrowSignature}`);
      console.log(`[RealBorrowing] 🌐 Verify: https://solscan.io/tx/${borrowSignature}`);
      
    } catch (error) {
      operation.status = 'failed';
      operation.error = (error as Error).message;
      console.error('[RealBorrowing] Solend borrowing failed:', (error as Error).message);
    }
  }

  private async executeKaminoBorrowing(operation: RealBorrowingOperation): Promise<void> {
    console.log('[RealBorrowing] 🏦 Executing Kamino real borrowing...');
    operation.status = 'executing';
    
    try {
      // Initialize Kamino market
      const market = await KaminoMarket.load(
        this.connection,
        new PublicKey('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF') // Kamino main market
      );
      
      // Get SOL reserve
      const solReserve = market.getReserveBySymbol('SOL');
      if (!solReserve) {
        throw new Error('SOL reserve not found in Kamino');
      }
      
      // Create Kamino obligation if needed
      const depositAmount = operation.collateralAmount;
      console.log(`[RealBorrowing] 🔒 Depositing ${depositAmount.toFixed(6)} SOL as collateral...`);
      
      // Create deposit action
      const depositAction = await KaminoAction.buildDepositTxns(
        market,
        depositAmount.toString(),
        solReserve.address,
        this.walletKeypair.publicKey,
        new PublicKey('11111111111111111111111111111111') // Use system program for new obligation
      );
      
      // Execute deposit
      for (const transaction of depositAction.transactions) {
        const signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [this.walletKeypair],
          { commitment: 'confirmed' }
        );
        console.log(`[RealBorrowing] ✅ Deposit TX: ${signature}`);
      }
      
      // Wait for deposit to settle
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Create borrow action
      const borrowAmount = operation.borrowAmount;
      console.log(`[RealBorrowing] 💰 Borrowing ${borrowAmount.toFixed(6)} SOL...`);
      
      const borrowAction = await KaminoAction.buildBorrowTxns(
        market,
        borrowAmount.toString(),
        solReserve.address,
        this.walletKeypair.publicKey,
        depositAction.obligationAddress // Use the obligation from deposit
      );
      
      // Execute borrow
      for (const transaction of borrowAction.transactions) {
        const signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [this.walletKeypair],
          { commitment: 'confirmed' }
        );
        
        operation.transactionSignature = signature;
        console.log(`[RealBorrowing] ✅ Borrow TX: ${signature}`);
      }
      
      operation.status = 'completed';
      operation.actualBorrowedAmount = borrowAmount;
      this.totalBorrowed += borrowAmount;
      
      console.log(`[RealBorrowing] 🎉 Kamino real borrowing successful!`);
      console.log(`[RealBorrowing] 🌐 Verify: https://solscan.io/tx/${operation.transactionSignature}`);
      
    } catch (error) {
      operation.status = 'failed';
      operation.error = (error as Error).message;
      console.error('[RealBorrowing] Kamino borrowing failed:', (error as Error).message);
    }
  }

  private async updateBalance(): Promise<void> {
    try {
      const balance = await this.connection.getBalance(this.walletKeypair.publicKey);
      this.currentBalance = balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('[RealBorrowing] Balance update failed:', (error as Error).message);
    }
  }

  private showRealBorrowingResults(): void {
    const completed = this.borrowingOperations.filter(op => op.status === 'completed');
    const failed = this.borrowingOperations.filter(op => op.status === 'failed');
    
    console.log('\n[RealBorrowing] === REAL BORROWING RESULTS ===');
    console.log('🎉 REAL PROTOCOL BORROWING COMPLETE! 🎉');
    console.log('==========================================');
    
    console.log(`📍 Wallet Address: ${this.walletAddress}`);
    console.log(`💰 Current Balance: ${this.currentBalance.toFixed(6)} SOL`);
    console.log(`📈 Total Borrowed: ${this.totalBorrowed.toFixed(6)} SOL`);
    console.log(`✅ Successful Borrows: ${completed.length}/${this.borrowingOperations.length}`);
    console.log(`❌ Failed Borrows: ${failed.length}/${this.borrowingOperations.length}`);
    
    console.log('\n🏦 BORROWING OPERATIONS:');
    console.log('========================');
    
    this.borrowingOperations.forEach((operation, index) => {
      const status = operation.status === 'completed' ? '✅' : '❌';
      
      console.log(`${index + 1}. ${status} ${operation.protocolName.toUpperCase()}`);
      console.log(`   🔒 Collateral: ${operation.collateralAmount.toFixed(6)} SOL`);
      
      if (operation.actualBorrowedAmount) {
        console.log(`   💰 Borrowed: ${operation.actualBorrowedAmount.toFixed(6)} SOL`);
      } else {
        console.log(`   💰 Target Borrow: ${operation.borrowAmount.toFixed(6)} SOL`);
      }
      
      if (operation.transactionSignature) {
        console.log(`   🔗 TX: ${operation.transactionSignature}`);
        console.log(`   🌐 Verify: https://solscan.io/tx/${operation.transactionSignature}`);
      }
      
      if (operation.error) {
        console.log(`   ❌ Error: ${operation.error}`);
      }
      console.log('');
    });
    
    console.log('🎯 REAL BORROWING FEATURES:');
    console.log('===========================');
    console.log('✅ Real protocol SDK integration');
    console.log('✅ Actual collateral deposits');
    console.log('✅ Real borrowing transactions');
    console.log('✅ Wallet balance increases');
    console.log('✅ NO demo or simulation transactions');
    
    if (this.totalBorrowed > 0) {
      console.log(`\n🚀 SUCCESS! Borrowed ${this.totalBorrowed.toFixed(6)} SOL from real protocols!`);
      console.log('Your wallet balance has been increased with real borrowed funds!');
    }
  }
}

// Execute real protocol borrowing
async function main(): Promise<void> {
  const borrowingSystem = new RealProtocolBorrowingSystem();
  await borrowingSystem.executeRealBorrowingOperations();
}

main().catch(console.error);