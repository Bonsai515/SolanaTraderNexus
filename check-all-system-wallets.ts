/**
 * Check All System Wallets
 * 
 * Scans for any other wallets configured in the system
 * and checks their balances to maximize available capital
 */

import { 
  Connection, 
  Keypair, 
  PublicKey,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

class SystemWalletScanner {
  private connection: Connection;
  private foundWallets: Array<{
    source: string;
    address: string;
    solBalance: number;
    keypair?: Keypair;
  }>;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.foundWallets = [];
  }

  public async scanAllSystemWallets(): Promise<void> {
    console.log('🔍 SCANNING ALL SYSTEM WALLETS');
    console.log('💰 Checking for additional balances to utilize');
    console.log('='.repeat(50));

    await this.checkKnownWallets();
    await this.scanFileSystem();
    await this.checkEnvironmentVariables();
    await this.showWalletSummary();
  }

  private async checkKnownWallets(): Promise<void> {
    console.log('\n🔑 CHECKING KNOWN WALLETS');
    
    // Main wallet
    const mainWalletKey = [
      178, 244, 12, 25, 27, 202, 251, 10, 212, 90, 37, 116, 218, 42, 22, 165,
      134, 165, 151, 54, 225, 215, 194, 8, 177, 201, 105, 101, 212, 120, 249,
      74, 243, 118, 55, 187, 158, 35, 75, 138, 173, 148, 39, 171, 160, 27, 89,
      6, 105, 174, 233, 82, 187, 49, 42, 193, 182, 112, 195, 65, 56, 144, 83, 218
    ];
    
    const mainKeypair = Keypair.fromSecretKey(new Uint8Array(mainWalletKey));
    const mainBalance = await this.checkWalletBalance(mainKeypair.publicKey);
    
    this.foundWallets.push({
      source: 'Main Trading Wallet',
      address: mainKeypair.publicKey.toBase58(),
      solBalance: mainBalance,
      keypair: mainKeypair
    });
    
    console.log(`✅ Main Wallet: ${mainKeypair.publicKey.toBase58()}`);
    console.log(`   Balance: ${mainBalance.toFixed(6)} SOL`);

    // MarginFi wallet (if different)
    const marginfiAddress = 'CQZhkVwnxvj6JwvsKsAWztdKfuRPPR8ChZyckP58dAia';
    if (marginfiAddress !== mainKeypair.publicKey.toBase58()) {
      const marginfiBalance = await this.checkWalletBalance(new PublicKey(marginfiAddress));
      
      this.foundWallets.push({
        source: 'MarginFi Operations Wallet',
        address: marginfiAddress,
        solBalance: marginfiBalance
      });
      
      console.log(`✅ MarginFi Wallet: ${marginfiAddress}`);
      console.log(`   Balance: ${marginfiBalance.toFixed(6)} SOL`);
    }

    // HX Wallet (mentioned in system)
    const hxWalletAddress = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
    if (hxWalletAddress !== mainKeypair.publicKey.toBase58()) {
      const hxBalance = await this.checkWalletBalance(new PublicKey(hxWalletAddress));
      
      this.foundWallets.push({
        source: 'HX System Wallet',
        address: hxWalletAddress,
        solBalance: hxBalance
      });
      
      console.log(`✅ HX Wallet: ${hxWalletAddress}`);
      console.log(`   Balance: ${hxBalance.toFixed(6)} SOL`);
    }
  }

  private async scanFileSystem(): Promise<void> {
    console.log('\n📁 SCANNING FILESYSTEM FOR WALLET KEYS');
    
    const searchPaths = [
      '.',
      './server',
      './config',
      './secure_credentials',
      './cache',
      './data'
    ];

    const walletFilePatterns = [
      /wallet.*\.key$/i,
      /keypair.*\.json$/i,
      /private.*key/i,
      /\.keypair$/i,
      /wallet.*\.json$/i
    ];

    for (const searchPath of searchPaths) {
      try {
        if (fs.existsSync(searchPath)) {
          const files = fs.readdirSync(searchPath);
          
          for (const file of files) {
            const filePath = path.join(searchPath, file);
            
            // Check if file matches wallet patterns
            const isWalletFile = walletFilePatterns.some(pattern => pattern.test(file));
            
            if (isWalletFile) {
              console.log(`🔍 Found potential wallet file: ${filePath}`);
              await this.tryLoadWalletFromFile(filePath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't access
        continue;
      }
    }
  }

  private async tryLoadWalletFromFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Try to parse as JSON array (standard format)
      try {
        const keyArray = JSON.parse(content);
        if (Array.isArray(keyArray) && keyArray.length === 64) {
          const keypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
          const balance = await this.checkWalletBalance(keypair.publicKey);
          
          // Only add if not already found
          const exists = this.foundWallets.find(w => w.address === keypair.publicKey.toBase58());
          if (!exists) {
            this.foundWallets.push({
              source: `File: ${filePath}`,
              address: keypair.publicKey.toBase58(),
              solBalance: balance,
              keypair: keypair
            });
            
            console.log(`✅ Loaded wallet from ${filePath}`);
            console.log(`   Address: ${keypair.publicKey.toBase58()}`);
            console.log(`   Balance: ${balance.toFixed(6)} SOL`);
          }
        }
      } catch (parseError) {
        // Not a valid JSON wallet file
      }
      
    } catch (error) {
      // Can't read file or invalid format
    }
  }

  private async checkEnvironmentVariables(): Promise<void> {
    console.log('\n🌍 CHECKING ENVIRONMENT VARIABLES');
    
    const envVars = [
      'WALLET_PRIVATE_KEY',
      'TRADING_WALLET_KEY',
      'MARGINFI_WALLET_KEY',
      'BACKUP_WALLET_KEY',
      'SYSTEM_WALLET_KEY',
      'HX_WALLET_KEY'
    ];

    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (value) {
        try {
          const keyArray = JSON.parse(value);
          if (Array.isArray(keyArray) && keyArray.length === 64) {
            const keypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
            const balance = await this.checkWalletBalance(keypair.publicKey);
            
            // Only add if not already found
            const exists = this.foundWallets.find(w => w.address === keypair.publicKey.toBase58());
            if (!exists) {
              this.foundWallets.push({
                source: `Environment: ${envVar}`,
                address: keypair.publicKey.toBase58(),
                solBalance: balance,
                keypair: keypair
              });
              
              console.log(`✅ Found wallet in ${envVar}`);
              console.log(`   Address: ${keypair.publicKey.toBase58()}`);
              console.log(`   Balance: ${balance.toFixed(6)} SOL`);
            }
          }
        } catch (error) {
          // Invalid environment variable format
        }
      }
    }
  }

  private async checkWalletBalance(publicKey: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      return 0;
    }
  }

  private async showWalletSummary(): Promise<void> {
    console.log('\n' + '='.repeat(50));
    console.log('💰 WALLET SUMMARY REPORT');
    console.log('='.repeat(50));
    
    let totalSOL = 0;
    let walletsWithBalance = 0;
    
    console.log('\n📊 ALL DISCOVERED WALLETS:');
    
    this.foundWallets.forEach((wallet, index) => {
      console.log(`\n${index + 1}. ${wallet.source}:`);
      console.log(`   Address: ${wallet.address}`);
      console.log(`   SOL Balance: ${wallet.solBalance.toFixed(6)} SOL`);
      console.log(`   Has Keypair: ${wallet.keypair ? 'Yes ✅' : 'No (View Only)'}`);
      
      totalSOL += wallet.solBalance;
      if (wallet.solBalance > 0) {
        walletsWithBalance++;
      }
    });
    
    console.log('\n📈 SUMMARY STATISTICS:');
    console.log(`💰 Total Wallets Found: ${this.foundWallets.length}`);
    console.log(`💎 Wallets with Balance: ${walletsWithBalance}`);
    console.log(`🏦 Total SOL Across All Wallets: ${totalSOL.toFixed(6)} SOL`);
    console.log(`🔑 Wallets with Access Keys: ${this.foundWallets.filter(w => w.keypair).length}`);
    
    // Find wallets with significant balances
    const significantWallets = this.foundWallets.filter(w => w.solBalance > 0.001);
    
    if (significantWallets.length > 1) {
      console.log('\n🎯 CONSOLIDATION OPPORTUNITIES:');
      significantWallets.forEach(wallet => {
        if (wallet.solBalance > 0.001 && wallet.keypair) {
          console.log(`💰 ${wallet.source}: ${wallet.solBalance.toFixed(6)} SOL (Can be consolidated)`);
        }
      });
    } else {
      console.log('\n✅ OPTIMAL SETUP:');
      console.log('💎 All funds already consolidated in main wallet');
      console.log('🚀 Perfect for trading strategy execution');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🔍 WALLET SCAN COMPLETE');
    console.log('='.repeat(50));
  }
}

async function main(): Promise<void> {
  const scanner = new SystemWalletScanner();
  await scanner.scanAllSystemWallets();
}

main().catch(console.error);