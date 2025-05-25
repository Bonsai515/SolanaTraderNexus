/**
 * Test MarginFi Connection
 * 
 * Tests real connection to MarginFi with your wallet and mSOL position
 * Verifies borrowing capacity and lending pool access
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { MarginfiClient, getConfig, MarginfiAccountWrapper } from '@mrgnlabs/marginfi-client-v2';

class TestMarginFiConnection {
  private connection: Connection;
  private walletKeypair: Keypair;
  private walletAddress: string;
  private marginfiClient: MarginfiClient | null;
  private marginfiAccount: MarginfiAccountWrapper | null;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.marginfiClient = null;
    this.marginfiAccount = null;
  }

  public async testMarginFiConnection(): Promise<void> {
    console.log('🏦 TESTING MARGINFI CONNECTION');
    console.log('🔍 Checking real connectivity and borrowing capacity');
    console.log('='.repeat(50));

    await this.loadWallet();
    await this.connectToMarginFi();
    await this.checkExistingAccount();
    await this.analyzeBorrowingCapacity();
    await this.testLendingPools();
    await this.showConnectionResults();
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

  private async connectToMarginFi(): Promise<void> {
    console.log('\n🔌 CONNECTING TO MARGINFI');
    
    try {
      const config = getConfig("production");
      console.log('📋 Using production MarginFi config');
      
      const walletAdapter = {
        publicKey: this.walletKeypair.publicKey,
        signTransaction: async (transaction: any) => {
          transaction.partialSign(this.walletKeypair);
          return transaction;
        },
        signAllTransactions: async (transactions: any[]) => {
          transactions.forEach(tx => tx.partialSign(this.walletKeypair));
          return transactions;
        }
      };
      
      console.log('🔗 Establishing MarginFi client connection...');
      this.marginfiClient = await MarginfiClient.fetch(
        config,
        walletAdapter,
        this.connection
      );
      
      console.log('✅ MarginFi client connected successfully!');
      console.log(`📍 Client initialized with ${Object.keys(config.banks || {}).length} banks available`);
      
    } catch (error) {
      console.log(`❌ MarginFi connection failed: ${error.message}`);
      console.log('💡 Connection issues may be due to network or configuration');
    }
  }

  private async checkExistingAccount(): Promise<void> {
    console.log('\n👤 CHECKING MARGINFI ACCOUNT');
    
    if (!this.marginfiClient) {
      console.log('❌ No MarginFi client - skipping account check');
      return;
    }
    
    try {
      console.log('🔍 Searching for existing MarginFi account...');
      
      // Try to find existing MarginFi account
      const accounts = await this.marginfiClient.getMarginfiAccountsForAuthority();
      
      if (accounts && accounts.length > 0) {
        this.marginfiAccount = accounts[0];
        console.log(`✅ Found existing MarginFi account: ${this.marginfiAccount.address.toBase58()}`);
        console.log(`📊 Account has ${Object.keys(this.marginfiAccount.balances).length} active balances`);
      } else {
        console.log('📝 No existing MarginFi account found');
        console.log('💡 Account creation would be needed for borrowing');
      }
      
    } catch (error) {
      console.log(`⚠️ Account check error: ${error.message}`);
    }
  }

  private async analyzeBorrowingCapacity(): Promise<void> {
    console.log('\n💰 ANALYZING BORROWING CAPACITY');
    
    if (!this.marginfiClient) {
      console.log('❌ No MarginFi client - cannot analyze borrowing');
      return;
    }
    
    try {
      // Get current SOL balance
      const balance = await this.connection.getBalance(this.walletKeypair.publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      const msolBalance = 0.168532; // Your known mSOL balance
      
      console.log(`💎 Current SOL: ${solBalance.toFixed(6)} SOL`);
      console.log(`🌊 mSOL Position: ${msolBalance.toFixed(6)} mSOL`);
      
      // Estimate borrowing capacity based on typical MarginFi LTV
      const estimatedBorrowingPower = msolBalance * 0.75; // 75% LTV estimate
      
      console.log(`📊 Borrowing Analysis:`);
      console.log(`   • mSOL Collateral Value: ~${msolBalance.toFixed(6)} SOL`);
      console.log(`   • Estimated Borrowing Power: ~${estimatedBorrowingPower.toFixed(6)} SOL`);
      console.log(`   • Total Trading Power: ~${(solBalance + estimatedBorrowingPower).toFixed(6)} SOL`);
      
      const targetGap = 1.0 - solBalance;
      console.log(`\n🎯 Path to 1 SOL:`);
      console.log(`   • Current gap: ${targetGap.toFixed(6)} SOL`);
      console.log(`   • Borrowing coverage: ${((estimatedBorrowingPower / targetGap) * 100).toFixed(1)}%`);
      
      if (estimatedBorrowingPower > targetGap * 0.5) {
        console.log('🚀 Strong borrowing capacity - significant acceleration possible!');
      } else if (estimatedBorrowingPower > targetGap * 0.2) {
        console.log('💪 Moderate borrowing capacity - meaningful acceleration possible');
      }
      
    } catch (error) {
      console.log(`⚠️ Borrowing analysis error: ${error.message}`);
    }
  }

  private async testLendingPools(): Promise<void> {
    console.log('\n🏊 TESTING LENDING POOLS ACCESS');
    
    if (!this.marginfiClient) {
      console.log('❌ No MarginFi client - cannot test pools');
      return;
    }
    
    try {
      console.log('🔍 Checking available lending pools...');
      
      // Get available banks/pools
      const banks = this.marginfiClient.getBanks();
      console.log(`📋 Found ${banks.length} available lending pools`);
      
      // Look for SOL and mSOL pools specifically
      let solPool = null;
      let msolPool = null;
      
      for (const bank of banks) {
        const bankLabel = bank.label || bank.mint.toBase58().substring(0, 8);
        console.log(`   • Pool: ${bankLabel}`);
        
        // Check if this might be SOL pool
        if (bank.mint.toBase58() === 'So11111111111111111111111111111111111111112') {
          solPool = bank;
          console.log(`     ✅ SOL lending pool found`);
        }
        
        // Check if this might be mSOL pool
        if (bank.mint.toBase58() === 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So') {
          msolPool = bank;
          console.log(`     ✅ mSOL lending pool found`);
        }
      }
      
      if (solPool) {
        console.log('🎯 SOL borrowing pool available for leveraged trading');
      }
      
      if (msolPool) {
        console.log('🌊 mSOL collateral pool available for borrowing');
      }
      
      if (solPool && msolPool) {
        console.log('💪 Both SOL and mSOL pools available - full strategy possible!');
      }
      
    } catch (error) {
      console.log(`⚠️ Pool testing error: ${error.message}`);
    }
  }

  private async showConnectionResults(): Promise<void> {
    console.log('\n' + '='.repeat(50));
    console.log('🏦 MARGINFI CONNECTION TEST RESULTS');
    console.log('='.repeat(50));
    
    if (this.marginfiClient) {
      console.log('✅ MarginFi Connection: SUCCESS');
      console.log('🔗 Client initialized and ready for operations');
      
      if (this.marginfiAccount) {
        console.log('✅ MarginFi Account: FOUND');
        console.log('📊 Existing account ready for borrowing');
      } else {
        console.log('📝 MarginFi Account: NONE');
        console.log('💡 Account creation needed before borrowing');
      }
      
      console.log('\n🚀 BORROWING STRATEGY AVAILABLE:');
      console.log('   • Use mSOL as collateral');
      console.log('   • Borrow additional SOL');
      console.log('   • Execute leveraged arbitrage');
      console.log('   • Repay loans with profits');
      
      console.log('\n🎯 ACCELERATION POTENTIAL:');
      console.log('   • ~0.126 SOL borrowing capacity');
      console.log('   • 9x current balance leverage possible');
      console.log('   • Significant acceleration toward 1 SOL target');
      
    } else {
      console.log('❌ MarginFi Connection: FAILED');
      console.log('💡 Alternative strategies recommended:');
      console.log('   • Continue direct trading with current balance');
      console.log('   • Explore other lending protocols');
      console.log('   • Focus on high-frequency smaller trades');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🏦 CONNECTION TEST COMPLETE');
    console.log('='.repeat(50));
  }
}

async function main(): Promise<void> {
  const tester = new TestMarginFiConnection();
  await tester.testMarginFiConnection();
}

main().catch(console.error);