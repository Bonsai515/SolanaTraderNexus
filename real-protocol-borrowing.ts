/**
 * Real Protocol Borrowing System
 * Actually connects to lending protocols for real borrowing
 */

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { MarginfiClient, getConfig } from '@mrgnlabs/marginfi-client-v2';
import { SolendMarket } from '@solendprotocol/solend-sdk';
import * as fs from 'fs';

interface RealBorrowingResult {
  protocol: string;
  collateralDeposited: number;
  actualBorrowed: number;
  transactionSignature: string;
  success: boolean;
  error?: string;
}

class RealProtocolBorrowing {
  private connection: Connection;
  private walletKeypair: Keypair | null;
  private walletAddress: string;
  private currentBalance: number;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.walletKeypair = null;
    this.walletAddress = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
    this.currentBalance = 0;

    console.log('[RealBorrow] 🚀 REAL PROTOCOL BORROWING SYSTEM');
    console.log('[RealBorrow] 💰 Connecting to actual lending protocols');
  }

  public async executeRealBorrowing(): Promise<void> {
    console.log('[RealBorrow] === EXECUTING REAL PROTOCOL BORROWING ===');
    
    try {
      // Load wallet and check balance
      await this.loadWallet();
      await this.checkBalance();
      
      if (!this.walletKeypair) {
        console.log('[RealBorrow] ❌ Need your wallet private key for real borrowing');
        console.log('[RealBorrow] To borrow from real protocols, I need access to your wallet');
        console.log('[RealBorrow] Please provide your wallet private key or use a browser wallet');
        return;
      }
      
      console.log(`[RealBorrow] 💰 Available balance: ${this.currentBalance.toFixed(6)} SOL`);
      
      // Execute real borrowing
      const results = await this.borrowFromRealProtocols();
      
      // Show results
      this.showRealBorrowingResults(results);
      
    } catch (error) {
      console.error('[RealBorrow] Real borrowing failed:', (error as Error).message);
    }
  }

  private async loadWallet(): Promise<void> {
    try {
      // Check for wallet private key
      if (fs.existsSync('./wallet-private-key.txt')) {
        const privateKeyData = fs.readFileSync('./wallet-private-key.txt', 'utf8').trim();
        
        if (privateKeyData) {
          try {
            const secretKey = JSON.parse(privateKeyData);
            this.walletKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
            console.log('[RealBorrow] ✅ Wallet loaded from private key file');
            return;
          } catch {
            // Try as hex string
            const secretKey = Buffer.from(privateKeyData, 'hex');
            this.walletKeypair = Keypair.fromSecretKey(secretKey);
            console.log('[RealBorrow] ✅ Wallet loaded from hex private key');
            return;
          }
        }
      }
      
      console.log('[RealBorrow] ⚠️ No wallet private key found');
      console.log('[RealBorrow] For real borrowing, you need to:');
      console.log('[RealBorrow] 1. Export your private key from Phantom/Solflare');
      console.log('[RealBorrow] 2. Save it to wallet-private-key.txt');
      console.log('[RealBorrow] 3. Or use the protocol websites directly');
      
    } catch (error) {
      console.error('[RealBorrow] Wallet loading error:', (error as Error).message);
    }
  }

  private async checkBalance(): Promise<void> {
    try {
      if (!this.walletKeypair) return;
      
      const balance = await this.connection.getBalance(this.walletKeypair.publicKey);
      this.currentBalance = balance / LAMPORTS_PER_SOL;
      
    } catch (error) {
      console.error('[RealBorrow] Balance check failed:', (error as Error).message);
    }
  }

  private async borrowFromRealProtocols(): Promise<RealBorrowingResult[]> {
    const results: RealBorrowingResult[] = [];
    
    console.log('[RealBorrow] 🏦 Attempting real protocol borrowing...');
    
    // Try MarginFi first
    try {
      console.log('\n[RealBorrow] === MARGINFI REAL BORROWING ===');
      const marginFiResult = await this.borrowFromMarginFi();
      results.push(marginFiResult);
    } catch (error) {
      console.error('[RealBorrow] MarginFi borrowing failed:', (error as Error).message);
      results.push({
        protocol: 'MarginFi',
        collateralDeposited: 0,
        actualBorrowed: 0,
        transactionSignature: '',
        success: false,
        error: (error as Error).message
      });
    }
    
    return results;
  }

  private async borrowFromMarginFi(): Promise<RealBorrowingResult> {
    try {
      console.log('[RealBorrow] 🔧 Connecting to MarginFi...');
      
      // Get MarginFi configuration
      const config = getConfig("production");
      console.log('[RealBorrow] ✅ MarginFi config loaded');
      
      // Initialize MarginFi client
      const marginfiClient = await MarginfiClient.fetch(
        config, 
        this.walletKeypair!, 
        this.connection
      );
      console.log('[RealBorrow] ✅ MarginFi client initialized');
      
      // Find SOL lending pool
      const solBank = marginfiClient.getBankByMint(new PublicKey("So11111111111111111111111111111111111111112"));
      if (!solBank) {
        throw new Error('SOL bank not found');
      }
      console.log('[RealBorrow] ✅ SOL lending pool found');
      
      // Create marginfi account
      const marginfiAccount = await marginfiClient.createMarginfiAccount();
      console.log('[RealBorrow] ✅ MarginFi account created');
      
      // Deposit collateral (use 20% of balance)
      const collateralAmount = this.currentBalance * 0.2;
      console.log(`[RealBorrow] 💰 Depositing ${collateralAmount.toFixed(6)} SOL as collateral`);
      
      const depositTx = await marginfiAccount.deposit(collateralAmount, solBank);
      console.log(`[RealBorrow] ✅ Collateral deposited: ${depositTx}`);
      
      // Borrow against collateral (80% LTV)
      const borrowAmount = collateralAmount * 0.75; // Conservative 75% of max
      console.log(`[RealBorrow] 💸 Borrowing ${borrowAmount.toFixed(6)} SOL`);
      
      const borrowTx = await marginfiAccount.borrow(borrowAmount, solBank);
      console.log(`[RealBorrow] ✅ Borrowed successfully: ${borrowTx}`);
      
      return {
        protocol: 'MarginFi',
        collateralDeposited: collateralAmount,
        actualBorrowed: borrowAmount,
        transactionSignature: borrowTx,
        success: true
      };
      
    } catch (error) {
      console.error('[RealBorrow] MarginFi error:', (error as Error).message);
      return {
        protocol: 'MarginFi',
        collateralDeposited: 0,
        actualBorrowed: 0,
        transactionSignature: '',
        success: false,
        error: (error as Error).message
      };
    }
  }

  private showRealBorrowingResults(results: RealBorrowingResult[]): void {
    console.log('\n[RealBorrow] === REAL BORROWING RESULTS ===');
    
    const successful = results.filter(r => r.success);
    const totalBorrowed = successful.reduce((sum, r) => sum + r.actualBorrowed, 0);
    
    if (successful.length > 0) {
      console.log('🎉 REAL BORROWING SUCCESSFUL! 🎉');
      console.log('==============================');
      
      successful.forEach((result, index) => {
        console.log(`${index + 1}. ${result.protocol.toUpperCase()}`);
        console.log(`   💰 Collateral: ${result.collateralDeposited.toFixed(6)} SOL`);
        console.log(`   💸 Borrowed: ${result.actualBorrowed.toFixed(6)} SOL`);
        console.log(`   🔗 Transaction: ${result.transactionSignature}`);
        console.log(`   🌐 Solscan: https://solscan.io/tx/${result.transactionSignature}`);
        console.log('');
      });
      
      console.log(`💰 Original Balance: ${this.currentBalance.toFixed(6)} SOL`);
      console.log(`💸 Total Borrowed: ${totalBorrowed.toFixed(6)} SOL`);
      console.log(`📈 New Total Capital: ${(this.currentBalance + totalBorrowed).toFixed(6)} SOL`);
      
    } else {
      console.log('❌ REAL BORROWING NOT COMPLETED');
      console.log('==============================');
      console.log('To execute real borrowing, you can:');
      console.log('');
      console.log('1. 🌐 VISIT PROTOCOL WEBSITES DIRECTLY:');
      console.log('   • MarginFi: https://app.marginfi.com');
      console.log('   • Solend: https://solend.fi/dashboard');
      console.log('   • Kamino: https://app.kamino.finance');
      console.log('   • Connect your Phantom/Solflare wallet');
      console.log('   • Deposit SOL as collateral');
      console.log('   • Borrow against your collateral');
      console.log('');
      console.log('2. 🔑 PROVIDE WALLET PRIVATE KEY:');
      console.log('   • Export from Phantom: Settings > Export Private Key');
      console.log('   • Save to: wallet-private-key.txt');
      console.log('   • Run this script again');
      console.log('');
      console.log('3. 💰 AVAILABLE BORROWING CAPACITY:');
      console.log(`   • Your ${this.currentBalance.toFixed(6)} SOL can collateralize:`);
      console.log(`   • MarginFi: ~${(this.currentBalance * 0.2 * 0.8).toFixed(4)} SOL`);
      console.log(`   • Solend: ~${(this.currentBalance * 0.2 * 0.75).toFixed(4)} SOL`);
      console.log(`   • Kamino: ~${(this.currentBalance * 0.2 * 0.72).toFixed(4)} SOL`);
    }
  }
}

// Execute real protocol borrowing
async function main(): Promise<void> {
  const borrowing = new RealProtocolBorrowing();
  await borrowing.executeRealBorrowing();
}

main().catch(console.error);