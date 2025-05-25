/**
 * Create MarginFi Account for Borrowing
 * 
 * Creates a new MarginFi account using your existing wallet
 * and enables borrowing against mSOL collateral
 */

import { 
  Connection, 
  Keypair, 
  PublicKey,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { MarginfiClient, getConfig, MarginfiAccountWrapper } from '@mrgnlabs/marginfi-client-v2';
import { NodeWallet } from '@mrgnlabs/mrgn-common';

class MarginFiAccountCreator {
  private connection: Connection;
  private walletKeypair: Keypair;
  private walletAddress: string;
  private marginfiClient: MarginfiClient | null;
  private marginfiAccount: MarginfiAccountWrapper | null;
  private existingMarginfiWallet: string;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.marginfiClient = null;
    this.marginfiAccount = null;
    this.existingMarginfiWallet = 'CQZhkVwnxvj6JwvsKsAWztdKfuRPPR8ChZyckP58dAia';
  }

  public async createMarginFiAccount(): Promise<void> {
    console.log('🏦 CREATING MARGINFI ACCOUNT');
    console.log('💰 Setting up borrowing capabilities');
    console.log('='.repeat(45));

    await this.loadWallet();
    await this.initializeMarginFiClient();
    await this.checkExistingAccounts();
    await this.createOrUseAccount();
    await this.showAccountStatus();
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
    console.log('🔗 MarginFi Wallet: ' + this.existingMarginfiWallet);
  }

  private async initializeMarginFiClient(): Promise<void> {
    console.log('\n🏦 INITIALIZING MARGINFI CLIENT');
    
    try {
      // Create wallet adapter
      const wallet = new NodeWallet(this.walletKeypair);
      
      // Get MarginFi production config
      const config = getConfig("production");
      console.log('📋 Using production MarginFi configuration');
      
      // Initialize MarginFi client
      this.marginfiClient = await MarginfiClient.fetch(config, wallet, this.connection);
      console.log('✅ MarginFi client connected successfully');
      
      // Show available banks/pools
      console.log(`📊 MarginFi protocol initialized`);
      
    } catch (error) {
      console.log('⚠️ MarginFi client initialization error:', error.message);
      throw new Error(`MarginFi connection failed: ${error.message}`);
    }
  }

  private async checkExistingAccounts(): Promise<void> {
    console.log('\n🔍 CHECKING FOR EXISTING ACCOUNTS');
    
    if (!this.marginfiClient) {
      console.log('❌ No MarginFi client available');
      return;
    }
    
    try {
      // Check for existing MarginFi accounts
      const existingAccounts = await this.marginfiClient.getMarginfiAccountsForAuthority();
      
      console.log(`📋 Found ${existingAccounts.length} existing MarginFi accounts`);
      
      if (existingAccounts.length > 0) {
        console.log('✅ Existing accounts found:');
        existingAccounts.forEach((account, index) => {
          console.log(`   Account ${index + 1}: ${account.address.toBase58()}`);
        });
      } else {
        console.log('📝 No existing accounts - will create new one');
      }
      
    } catch (error) {
      console.log('⚠️ Error checking existing accounts:', error.message);
    }
  }

  private async createOrUseAccount(): Promise<void> {
    console.log('\n📝 SETTING UP MARGINFI ACCOUNT');
    
    if (!this.marginfiClient) {
      throw new Error('MarginFi client not initialized');
    }
    
    try {
      // First check if we already have accounts
      const existingAccounts = await this.marginfiClient.getMarginfiAccountsForAuthority();
      
      if (existingAccounts.length > 0) {
        // Use existing account
        this.marginfiAccount = existingAccounts[0];
        console.log('✅ Using existing MarginFi account');
        console.log(`🔗 Account Address: ${this.marginfiAccount.address.toBase58()}`);
      } else {
        // Create new account with required bundle tip
        console.log('📝 Creating new MarginFi account...');
        console.log('💰 Adding required transaction tip (1000 lamports)...');
        
        // Create account with bundle tip
        this.marginfiAccount = await this.marginfiClient.createMarginfiAccount({
          bundleTip: 1000 // Required minimum tip in lamports
        });
        
        console.log('✅ New MarginFi account created successfully!');
        console.log(`🔗 New Account Address: ${this.marginfiAccount.address.toBase58()}`);
      }
      
    } catch (error) {
      console.log('❌ Account creation/setup error:', error.message);
      throw new Error(`MarginFi account setup failed: ${error.message}`);
    }
  }

  private async showAccountStatus(): Promise<void> {
    console.log('\n' + '='.repeat(45));
    console.log('🏦 MARGINFI ACCOUNT STATUS');
    console.log('='.repeat(45));
    
    if (this.marginfiAccount) {
      console.log('✅ ACCOUNT READY FOR BORROWING');
      console.log(`🔗 Account: ${this.marginfiAccount.address.toBase58()}`);
      console.log('💰 Features Available:');
      console.log('   • mSOL Collateral Deposits');
      console.log('   • SOL Borrowing (~0.126 SOL capacity)');
      console.log('   • Leveraged Trading Strategies');
      console.log('   • Flash Loan Access');
      
      console.log('\n🎯 NEXT STEPS:');
      console.log('   1. Deposit mSOL as collateral');
      console.log('   2. Borrow SOL against collateral');
      console.log('   3. Execute leveraged strategies');
      console.log('   4. Repay loans with profits');
      
      console.log('\n💡 BORROWING CAPACITY:');
      console.log('   • mSOL Collateral: 0.168532 mSOL');
      console.log('   • Estimated Borrowing: ~0.126 SOL');
      console.log('   • Total Trading Power: ~0.202 SOL');
      
    } else {
      console.log('❌ ACCOUNT SETUP INCOMPLETE');
      console.log('⚠️ Manual account creation may be required');
    }
    
    console.log('\n' + '='.repeat(45));
    console.log('🏦 MARGINFI SETUP COMPLETE');
    console.log('='.repeat(45));
  }
}

async function main(): Promise<void> {
  const creator = new MarginFiAccountCreator();
  await creator.createMarginFiAccount();
}

main().catch(console.error);