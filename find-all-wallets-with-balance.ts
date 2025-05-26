/**
 * Find All Wallets With Balance
 * 
 * Search through all wallet files and check balances
 * Including backup files, secure directories, and system-generated wallets
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

class FindAllWalletsWithBalance {
  private connection: Connection;
  private walletsFound: Array<{
    source: string;
    address: string;
    balance: number;
    privateKey?: string;
  }> = [];

  constructor() {
    this.connection = new Connection('https://mainnet.helius-rpc.com/?api-key=5d0d1d98-4695-4a7d-b8a0-d4f9836da17f');
  }

  public async findAllWallets(): Promise<void> {
    console.log('🔍 SCANNING ALL WALLET SOURCES FOR SOL BALANCES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Check main wallet configuration
    await this.checkMainWalletConfig();
    
    // Check backup directories
    await this.checkBackupDirectories();
    
    // Check secure wallet files
    await this.checkSecureWallets();
    
    // Check nexus engine wallets
    await this.checkNexusWallets();
    
    // Check database wallets
    await this.checkDatabaseWallets();
    
    // Check environment wallet keys
    await this.checkEnvironmentWallets();
    
    // Show results
    this.showResults();
  }

  private async checkMainWalletConfig(): Promise<void> {
    console.log('\n📁 Checking main wallet configuration (data/wallets.json)...');
    
    try {
      const walletsPath = 'data/wallets.json';
      if (fs.existsSync(walletsPath)) {
        const wallets = JSON.parse(fs.readFileSync(walletsPath, 'utf8'));
        
        for (const wallet of wallets) {
          await this.checkWalletBalance(wallet.publicKey, wallet.privateKey, `Main Config - ${wallet.label}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error reading main config: ${error.message}`);
    }
  }

  private async checkBackupDirectories(): Promise<void> {
    console.log('\n📁 Checking backup directories...');
    
    const backupDirs = [
      'backup-1747772582850',
      'backup-1747772820533', 
      'backup-1747773393718'
    ];
    
    for (const backupDir of backupDirs) {
      if (fs.existsSync(backupDir)) {
        await this.scanDirectoryForWallets(backupDir, `Backup - ${backupDir}`);
      }
    }
  }

  private async checkSecureWallets(): Promise<void> {
    console.log('\n🔒 Checking secure wallet files...');
    
    const secureFiles = [
      'data/secure/trading-wallet1.json',
      'data/secure/trading-wallet2.json',
      'data/secure/master-wallet.json'
    ];
    
    for (const file of secureFiles) {
      if (fs.existsSync(file)) {
        try {
          const data = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (data.privateKey && data.publicKey) {
            await this.checkWalletBalance(data.publicKey, data.privateKey, `Secure - ${path.basename(file)}`);
          }
        } catch (error) {
          console.log(`   ❌ Error reading ${file}: ${error.message}`);
        }
      }
    }
  }

  private async checkNexusWallets(): Promise<void> {
    console.log('\n🔗 Checking nexus engine wallets...');
    
    const nexusFiles = [
      'data/nexus/keys.json',
      'data/nexus/wallets.json',
      'nexus_engine/wallets.json'
    ];
    
    for (const file of nexusFiles) {
      if (fs.existsSync(file)) {
        try {
          const data = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (Array.isArray(data)) {
            for (const wallet of data) {
              if (wallet.privateKey && wallet.publicKey) {
                await this.checkWalletBalance(wallet.publicKey, wallet.privateKey, `Nexus - ${path.basename(file)}`);
              }
            }
          } else if (data.privateKey && data.publicKey) {
            await this.checkWalletBalance(data.publicKey, data.privateKey, `Nexus - ${path.basename(file)}`);
          }
        } catch (error) {
          console.log(`   ❌ Error reading ${file}: ${error.message}`);
        }
      }
    }
  }

  private async checkDatabaseWallets(): Promise<void> {
    console.log('\n🗄️ Checking database-stored wallets...');
    
    // Check if there are wallet private keys in database
    const dbWallets = [
      'D8UevDKnp9qk4nLwNGgnEm97NJ6yzFhYzuRr5wkv9HSL', // From database query
    ];
    
    for (const address of dbWallets) {
      await this.checkWalletBalance(address, null, 'Database Wallet');
    }
  }

  private async checkEnvironmentWallets(): Promise<void> {
    console.log('\n🌍 Checking environment variable wallets...');
    
    // Check environment variables for wallet keys
    const envKeys = [
      process.env.WALLET_PRIVATE_KEY,
      process.env.MAIN_WALLET_KEY,
      process.env.TRADING_WALLET_KEY,
      process.env.HX_WALLET_KEY,
      process.env.TREASURY_KEY
    ];
    
    for (let i = 0; i < envKeys.length; i++) {
      const key = envKeys[i];
      if (key && key.length > 50) {
        try {
          const keypair = Keypair.fromSecretKey(Buffer.from(key, 'hex'));
          await this.checkWalletBalance(keypair.publicKey.toString(), key, `Environment Var ${i + 1}`);
        } catch (error) {
          // Try base58 decoding
          try {
            const keypair = Keypair.fromSecretKey(Buffer.from(key, 'base64'));
            await this.checkWalletBalance(keypair.publicKey.toString(), key, `Environment Var ${i + 1} (base64)`);
          } catch (e) {
            // Continue with next key
          }
        }
      }
    }
  }

  private async scanDirectoryForWallets(dirPath: string, source: string): Promise<void> {
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        
        if (file.endsWith('.json') && fs.statSync(filePath).isFile()) {
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (data.privateKey && data.publicKey) {
              await this.checkWalletBalance(data.publicKey, data.privateKey, `${source} - ${file}`);
            } else if (Array.isArray(data)) {
              for (const wallet of data) {
                if (wallet.privateKey && wallet.publicKey) {
                  await this.checkWalletBalance(wallet.publicKey, wallet.privateKey, `${source} - ${file}`);
                }
              }
            }
          } catch (error) {
            // Continue with next file
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Error scanning ${dirPath}: ${error.message}`);
    }
  }

  private async checkWalletBalance(address: string, privateKey: string | null, source: string): Promise<void> {
    try {
      const balance = await this.connection.getBalance(new PublicKey(address));
      const balanceSOL = balance / 1e9;
      
      console.log(`   🔍 ${source}: ${address}`);
      console.log(`       Balance: ${balanceSOL.toFixed(6)} SOL`);
      
      this.walletsFound.push({
        source,
        address,
        balance: balanceSOL,
        privateKey: privateKey || undefined
      });
      
      if (balanceSOL > 0.001) {
        console.log(`       ✅ HAS BALANCE!`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error checking ${address}: ${error.message}`);
    }
  }

  private showResults(): void {
    console.log('\n🎊 WALLET SCAN RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const walletsWithBalance = this.walletsFound.filter(w => w.balance > 0.001);
    
    if (walletsWithBalance.length > 0) {
      console.log(`🎉 Found ${walletsWithBalance.length} wallets with SOL balance:`);
      
      let totalBalance = 0;
      for (const wallet of walletsWithBalance) {
        console.log(`\n💰 ${wallet.source}`);
        console.log(`   Address: ${wallet.address}`);
        console.log(`   Balance: ${wallet.balance.toFixed(6)} SOL ($${(wallet.balance * 200).toLocaleString()})`);
        console.log(`   Has Private Key: ${wallet.privateKey ? '✅ Yes' : '❌ No'}`);
        totalBalance += wallet.balance;
      }
      
      console.log(`\n🏦 Total Available Balance: ${totalBalance.toFixed(6)} SOL`);
      console.log(`💵 Total Value: $${(totalBalance * 200).toLocaleString()}`);
      
    } else {
      console.log('❌ No wallets found with significant SOL balance');
      console.log(`📊 Total wallets checked: ${this.walletsFound.length}`);
    }
  }
}

async function main(): Promise<void> {
  const scanner = new FindAllWalletsWithBalance();
  await scanner.findAllWallets();
}

if (require.main === module) {
  main().catch(console.error);
}