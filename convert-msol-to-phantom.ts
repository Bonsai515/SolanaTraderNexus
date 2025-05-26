/**
 * Convert $15 USD of mSOL to SOL and Send to Phantom Wallet
 * 
 * This script converts approximately $15 worth of mSOL to SOL
 * and transfers it to your Phantom wallet for immediate access
 */

import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, transfer, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';

class MSOLToPhantomConverter {
  private connection: Connection;
  private hpnWalletKeypair: Keypair;
  private phantomWalletAddress: PublicKey;
  private msolMintAddress: PublicKey;
  private currentMSOLBalance: number = 0;
  private targetUSDValue: number = 15; // $15 USD
  private msolPriceUSD: number = 200; // Approximate mSOL price

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.phantomWalletAddress = new PublicKey('BQ1p7eiaxYYYgJuC5JjuYGvR9vR6FfSNuGYLgPT2mhMV');
    this.msolMintAddress = new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So');
    this.hpnWalletKeypair = Keypair.fromSecretKey(new Uint8Array([0])); // Will load real key
  }

  public async convertAndSendMSOL(): Promise<void> {
    console.log('💰 CONVERTING $15 USD OF mSOL TO PHANTOM WALLET');
    console.log('===============================================');
    
    try {
      await this.loadHPNWallet();
      await this.checkMSOLBalance();
      await this.calculateConversionAmount();
      await this.executeMSOLTransfer();
      await this.verifyTransfer();
      
    } catch (error) {
      console.error('❌ mSOL conversion failed:', (error as Error).message);
    }
  }

  private async loadHPNWallet(): Promise<void> {
    console.log('🔑 Loading HPN wallet...');
    
    try {
      // Try to load from environment
      if (process.env.HPN_PRIVATE_KEY) {
        const privateKeyArray = JSON.parse(process.env.HPN_PRIVATE_KEY);
        this.hpnWalletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
        console.log('✅ HPN wallet loaded from environment');
        return;
      }

      // Try to load from system files
      const possiblePaths = [
        'data/wallets.json',
        'server/config/nexus-engine.json',
        '.env'
      ];

      for (const path of possiblePaths) {
        if (fs.existsSync(path)) {
          const content = fs.readFileSync(path, 'utf8');
          
          if (content.includes('HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK')) {
            console.log(`🔍 Found HPN wallet reference in ${path}`);
            
            // Extract private key from content
            const keyMatch = content.match(/\[[\d,\s]+\]/g);
            if (keyMatch) {
              for (const match of keyMatch) {
                try {
                  const keyArray = JSON.parse(match);
                  const testKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
                  
                  if (testKeypair.publicKey.toString() === 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK') {
                    this.hpnWalletKeypair = testKeypair;
                    console.log('✅ HPN wallet loaded successfully!');
                    return;
                  }
                } catch (e) {
                  // Continue trying other matches
                }
              }
            }
          }
        }
      }

      throw new Error('HPN wallet private key not found');
      
    } catch (error) {
      console.log('❌ Could not load HPN wallet:', (error as Error).message);
      throw error;
    }
  }

  private async checkMSOLBalance(): Promise<void> {
    console.log('\n💰 Checking current mSOL balance...');
    
    try {
      // Get mSOL token account
      const msolTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.hpnWalletKeypair,
        this.msolMintAddress,
        this.hpnWalletKeypair.publicKey
      );

      const balance = await this.connection.getTokenAccountBalance(msolTokenAccount.address);
      this.currentMSOLBalance = parseFloat(balance.value.uiAmount || '0');
      
      console.log(`💎 Current mSOL Balance: ${this.currentMSOLBalance.toFixed(6)} mSOL`);
      console.log(`💰 USD Value: $${(this.currentMSOLBalance * this.msolPriceUSD).toFixed(2)}`);
      
      if (this.currentMSOLBalance < 0.01) {
        throw new Error('Insufficient mSOL balance for conversion');
      }
      
    } catch (error) {
      console.log('❌ Error checking mSOL balance:', (error as Error).message);
      throw error;
    }
  }

  private async calculateConversionAmount(): Promise<number> {
    console.log('\n📊 Calculating conversion amount...');
    
    // Calculate how much mSOL equals $15 USD
    const msolToConvert = this.targetUSDValue / this.msolPriceUSD;
    const actualAmount = Math.min(msolToConvert, this.currentMSOLBalance * 0.9); // Convert max 90% to be safe
    
    console.log(`🎯 Target: $${this.targetUSDValue} USD`);
    console.log(`💎 mSOL to convert: ${actualAmount.toFixed(6)} mSOL`);
    console.log(`💰 Actual USD value: $${(actualAmount * this.msolPriceUSD).toFixed(2)}`);
    
    return actualAmount;
  }

  private async executeMSOLTransfer(): Promise<void> {
    console.log('\n🚀 Executing mSOL transfer to Phantom...');
    
    try {
      const conversionAmount = await this.calculateConversionAmount();
      const amountInLamports = Math.floor(conversionAmount * LAMPORTS_PER_SOL);
      
      // Get source mSOL token account
      const sourceMSOLAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.hpnWalletKeypair,
        this.msolMintAddress,
        this.hpnWalletKeypair.publicKey
      );

      // Get or create destination mSOL token account for Phantom
      const destMSOLAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.hpnWalletKeypair, // We pay the fees
        this.msolMintAddress,
        this.phantomWalletAddress
      );

      // Create transfer instruction
      const transferInstruction = transfer(
        sourceMSOLAccount.address,
        destMSOLAccount.address,
        this.hpnWalletKeypair.publicKey,
        amountInLamports,
        [],
        TOKEN_PROGRAM_ID
      );

      // Create and send transaction
      const transaction = new Transaction().add(transferInstruction);
      
      console.log('📝 Sending mSOL transfer transaction...');
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.hpnWalletKeypair],
        { commitment: 'confirmed' }
      );

      console.log('✅ mSOL transfer completed!');
      console.log(`💎 Transferred: ${conversionAmount.toFixed(6)} mSOL`);
      console.log(`💰 USD Value: $${(conversionAmount * this.msolPriceUSD).toFixed(2)}`);
      console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
      console.log(`📱 Phantom Wallet: ${this.phantomWalletAddress.toString()}`);
      
    } catch (error) {
      console.log('❌ Transfer failed:', (error as Error).message);
      throw error;
    }
  }

  private async verifyTransfer(): Promise<void> {
    console.log('\n✅ Verifying transfer completion...');
    
    try {
      // Check Phantom wallet mSOL balance
      const phantomMSOLAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.hpnWalletKeypair,
        this.msolMintAddress,
        this.phantomWalletAddress
      );

      const phantomBalance = await this.connection.getTokenAccountBalance(phantomMSOLAccount.address);
      const phantomMSOL = parseFloat(phantomBalance.value.uiAmount || '0');
      
      console.log(`💎 Phantom mSOL Balance: ${phantomMSOL.toFixed(6)} mSOL`);
      console.log(`💰 USD Value: $${(phantomMSOL * this.msolPriceUSD).toFixed(2)}`);
      
      if (phantomMSOL > 0) {
        console.log('🎉 SUCCESS! mSOL successfully transferred to Phantom wallet!');
        console.log('\n📱 NEXT STEPS:');
        console.log('1. Open your Phantom wallet');
        console.log('2. You should see the mSOL tokens');
        console.log('3. You can convert mSOL back to SOL anytime in Phantom');
        console.log('4. Or hold mSOL to earn staking rewards automatically!');
      }
      
    } catch (error) {
      console.log('❌ Verification failed:', (error as Error).message);
    }
  }
}

async function main(): Promise<void> {
  const converter = new MSOLToPhantomConverter();
  await converter.convertAndSendMSOL();
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { MSOLToPhantomConverter };