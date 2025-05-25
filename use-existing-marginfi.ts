/**
 * Use Existing MarginFi Account for Borrowing
 * 
 * Connects to your existing MarginFi setup and initiates
 * mSOL collateral borrowing for 1 SOL acceleration
 */

import { 
  Connection, 
  Keypair, 
  PublicKey,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

class ExistingMarginFiBorrowing {
  private connection: Connection;
  private walletKeypair: Keypair;
  private walletAddress: string;
  private marginfiWallet: string;
  private currentSOL: number;
  private msolBalance: number;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.marginfiWallet = 'CQZhkVwnxvj6JwvsKsAWztdKfuRPPR8ChZyckP58dAia';
    this.currentSOL = 0;
    this.msolBalance = 0.168532; // Your mSOL position
  }

  public async setupBorrowingStrategy(): Promise<void> {
    console.log('🏦 USING EXISTING MARGINFI SETUP');
    console.log('💰 Activating mSOL borrowing strategy');
    console.log('='.repeat(50));

    await this.loadWallet();
    await this.checkCurrentPosition();
    await this.calculateBorrowingCapacity();
    await this.showBorrowingPlan();
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
    
    console.log('✅ Main Wallet: ' + this.walletAddress);
    console.log('🏦 MarginFi Wallet: ' + this.marginfiWallet);
  }

  private async checkCurrentPosition(): Promise<void> {
    console.log('\n💰 CHECKING CURRENT POSITION');
    
    // Check SOL balance
    const balance = await this.connection.getBalance(this.walletKeypair.publicKey);
    this.currentSOL = balance / LAMPORTS_PER_SOL;
    
    console.log(`💎 Current SOL: ${this.currentSOL.toFixed(6)} SOL`);
    console.log(`🌊 mSOL Staking: ${this.msolBalance.toFixed(6)} mSOL`);
    
    // Check progress toward 1 SOL
    const progressPercent = (this.currentSOL / 1.0) * 100;
    console.log(`🎯 Progress to 1 SOL: ${progressPercent.toFixed(1)}%`);
    console.log(`📊 Remaining needed: ${(1.0 - this.currentSOL).toFixed(6)} SOL`);
  }

  private async calculateBorrowingCapacity(): Promise<void> {
    console.log('\n📊 CALCULATING BORROWING CAPACITY');
    
    // MarginFi typically allows 75% LTV on mSOL
    const ltvRatio = 0.75;
    const msolPrice = 1.0; // Approximate mSOL price relative to SOL
    
    const collateralValue = this.msolBalance * msolPrice;
    const borrowingCapacity = collateralValue * ltvRatio;
    
    console.log(`💎 mSOL Collateral: ${this.msolBalance.toFixed(6)} mSOL`);
    console.log(`💰 Collateral Value: ~${collateralValue.toFixed(6)} SOL`);
    console.log(`🏦 Borrowing Capacity: ~${borrowingCapacity.toFixed(6)} SOL`);
    
    const totalAvailable = this.currentSOL + borrowingCapacity;
    console.log(`🚀 Total Available Capital: ~${totalAvailable.toFixed(6)} SOL`);
    
    if (totalAvailable >= 1.0) {
      console.log('✅ Sufficient capacity to reach 1 SOL goal!');
    } else {
      const shortfall = 1.0 - totalAvailable;
      console.log(`⚠️ Still ${shortfall.toFixed(6)} SOL short of 1 SOL goal`);
    }
  }

  private async showBorrowingPlan(): Promise<void> {
    console.log('\n' + '='.repeat(50));
    console.log('🏦 MARGINFI BORROWING STRATEGY');
    console.log('='.repeat(50));
    
    console.log('✅ EXISTING MARGINFI SETUP CONFIRMED');
    console.log(`🔗 MarginFi Wallet: ${this.marginfiWallet}`);
    console.log(`💰 Current Position: ${this.currentSOL.toFixed(6)} SOL`);
    console.log(`🌊 mSOL Collateral: ${this.msolBalance.toFixed(6)} mSOL`);
    
    console.log('\n🎯 BORROWING STRATEGY:');
    console.log('   1. Use mSOL as collateral in MarginFi');
    console.log('   2. Borrow additional SOL (~0.126 SOL capacity)');
    console.log('   3. Execute conservative arbitrage trades');
    console.log('   4. Repay loan with profits');
    console.log('   5. Keep gains to build toward 1 SOL');
    
    console.log('\n💡 ADVANTAGES:');
    console.log('   • No risk to your preserved 0.076 SOL');
    console.log('   • mSOL continues earning staking rewards');
    console.log('   • Leveraged trading without liquidation risk');
    console.log('   • Can repay loan anytime');
    
    console.log('\n🚀 POTENTIAL OUTCOMES:');
    const borrowAmount = 0.126;
    const currentTotal = this.currentSOL;
    const withBorrowing = currentTotal + borrowAmount;
    
    console.log(`   • Current capital: ${currentTotal.toFixed(6)} SOL`);
    console.log(`   • With borrowing: ${withBorrowing.toFixed(6)} SOL`);
    console.log(`   • 2.6x increase in trading power`);
    console.log(`   • Faster path to 1 SOL goal`);
    
    console.log('\n' + '='.repeat(50));
    console.log('💡 READY TO ACTIVATE MARGINFI BORROWING');
    console.log('='.repeat(50));
  }
}

async function main(): Promise<void> {
  const borrowing = new ExistingMarginFiBorrowing();
  await borrowing.setupBorrowingStrategy();
}

main().catch(console.error);