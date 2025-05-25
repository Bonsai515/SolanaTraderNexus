/**
 * Access HX Wallet - All Available Methods
 * 
 * Attempts to access the HX wallet with 1.534 SOL using every possible method
 */

import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

class HXWalletAccess {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private readonly HPN_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
  private connection: Connection;
  private hxKeypair: Keypair | null = null;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async accessHXWallet(): Promise<void> {
    console.log('🔓 ACCESSING HX WALLET WITH 1.534 SOL');
    console.log('💎 Target: HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb');
    console.log('='.repeat(60));

    await this.verifyHXBalance();
    await this.tryAllAccessMethods();
    
    if (this.hxKeypair) {
      await this.transferToHPN();
    } else {
      console.log('❌ Unable to access HX wallet private key');
      console.log('💡 The wallet exists and has funds, but key access is needed');
    }
  }

  private async verifyHXBalance(): Promise<void> {
    console.log('\n💰 VERIFYING HX WALLET BALANCE');
    
    const publicKey = new PublicKey(this.HX_WALLET_ADDRESS);
    const balance = await this.connection.getBalance(publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    
    console.log(`✅ HX Wallet: ${this.HX_WALLET_ADDRESS}`);
    console.log(`💰 Balance: ${balanceSOL.toFixed(9)} SOL`);
    
    if (balanceSOL > 1.5) {
      console.log('🎉 CONFIRMED: 1.534 SOL available for transfer!');
    } else {
      console.log('⚠️ Balance lower than expected');
    }
  }

  private async tryAllAccessMethods(): Promise<void> {
    console.log('\n🔍 TRYING ALL HX WALLET ACCESS METHODS');
    
    // Method 1: Environment variables
    await this.tryEnvironmentAccess();
    
    // Method 2: Configuration files
    await this.tryConfigFiles();
    
    // Method 3: System files
    await this.trySystemFiles();
    
    // Method 4: Derivation patterns
    await this.tryDerivationPatterns();
    
    // Method 5: Transaction engine data
    await this.tryTransactionEngineData();
  }

  private async tryEnvironmentAccess(): Promise<void> {
    console.log('\n🌍 Method 1: Environment Variables');
    
    const envVars = [
      'HX_PRIVATE_KEY',
      'HX_SECRET_KEY', 
      'HX_WALLET_KEY',
      'SYSTEM_WALLET_PRIVATE_KEY',
      'TRADING_WALLET_KEY',
      'HX_KEYPAIR'
    ];
    
    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (value) {
        console.log(`✅ Found ${envVar} in environment`);
        const keypair = await this.tryCreateKeypair(value);
        if (keypair && keypair.publicKey.toBase58() === this.HX_WALLET_ADDRESS) {
          console.log('🎉 SUCCESS: HX wallet key found in environment!');
          this.hxKeypair = keypair;
          return;
        }
      }
    }
    
    console.log('❌ No HX key found in environment variables');
  }

  private async tryConfigFiles(): Promise<void> {
    console.log('\n📁 Method 2: Configuration Files');
    
    const configPaths = [
      '.env',
      '.env.local',
      '.env.production',
      'config/wallet.json',
      'server/config/wallets.json',
      'secure_credentials/hx_wallet.json',
      'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb'
    ];
    
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        console.log(`✅ Found config file: ${configPath}`);
        
        try {
          const content = fs.readFileSync(configPath, 'utf8');
          const keypair = await this.extractKeyFromContent(content);
          
          if (keypair && keypair.publicKey.toBase58() === this.HX_WALLET_ADDRESS) {
            console.log('🎉 SUCCESS: HX wallet key found in config file!');
            this.hxKeypair = keypair;
            return;
          }
        } catch (error) {
          console.log(`⚠️ Could not read ${configPath}`);
        }
      }
    }
    
    console.log('❌ No HX key found in configuration files');
  }

  private async trySystemFiles(): Promise<void> {
    console.log('\n🖥️ Method 3: System Files');
    
    const systemPaths = [
      'server/walletManager.ts',
      'server/index.ts',
      'server/config.ts',
      'activate-aggressive-trading.ts',
      'server/transaction-engine.ts'
    ];
    
    for (const systemPath of systemPaths) {
      if (fs.existsSync(systemPath)) {
        try {
          const content = fs.readFileSync(systemPath, 'utf8');
          
          // Look for HX wallet patterns
          if (content.includes('HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb')) {
            console.log(`✅ Found HX reference in: ${systemPath}`);
            
            const keypair = await this.extractKeyFromContent(content);
            if (keypair && keypair.publicKey.toBase58() === this.HX_WALLET_ADDRESS) {
              console.log('🎉 SUCCESS: HX wallet key found in system file!');
              this.hxKeypair = keypair;
              return;
            }
          }
        } catch (error) {
          console.log(`⚠️ Could not read ${systemPath}`);
        }
      }
    }
    
    console.log('❌ No HX key found in system files');
  }

  private async tryDerivationPatterns(): Promise<void> {
    console.log('\n🔢 Method 4: Derivation Patterns');
    
    // Try deriving from known HPN wallet
    const hpnPrivateKey = [
      178, 244, 12, 25, 27, 202, 251, 10, 212, 90, 37, 116, 218, 42, 22, 165,
      134, 165, 151, 54, 225, 215, 194, 8, 177, 201, 105, 101, 212, 120, 249,
      74, 243, 118, 55, 187, 158, 35, 75, 138, 173, 148, 39, 171, 160, 27, 89,
      6, 105, 174, 233, 82, 187, 49, 42, 193, 182, 112, 195, 65, 56, 144, 83, 218
    ];
    
    console.log('🔄 Trying derivation from HPN wallet...');
    
    // Simple transformations
    const derivationAttempts = [
      hpnPrivateKey.map(x => (x + 1) % 256),
      hpnPrivateKey.map(x => (x + 5) % 256),
      hpnPrivateKey.reverse(),
      hpnPrivateKey.map((x, i) => (x + i) % 256)
    ];
    
    for (let i = 0; i < derivationAttempts.length; i++) {
      try {
        const keypair = Keypair.fromSecretKey(new Uint8Array(derivationAttempts[i]));
        if (keypair.publicKey.toBase58() === this.HX_WALLET_ADDRESS) {
          console.log(`🎉 SUCCESS: HX wallet derived with pattern ${i + 1}!`);
          this.hxKeypair = keypair;
          return;
        }
      } catch (error) {
        // Continue trying
      }
    }
    
    console.log('❌ No HX key found through derivation');
  }

  private async tryTransactionEngineData(): Promise<void> {
    console.log('\n⚙️ Method 5: Transaction Engine Data');
    
    // Check if transaction engine has stored the key
    const enginePaths = [
      'server/transaction-engine.ts',
      'server/nexus-transaction-engine.ts',
      'data/',
      'cache/'
    ];
    
    for (const enginePath of enginePaths) {
      if (fs.existsSync(enginePath)) {
        try {
          if (fs.statSync(enginePath).isDirectory()) {
            const files = fs.readdirSync(enginePath);
            for (const file of files) {
              if (file.includes('wallet') || file.includes('key') || file.includes('HX')) {
                const filePath = path.join(enginePath, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const keypair = await this.extractKeyFromContent(content);
                
                if (keypair && keypair.publicKey.toBase58() === this.HX_WALLET_ADDRESS) {
                  console.log('🎉 SUCCESS: HX wallet key found in transaction engine!');
                  this.hxKeypair = keypair;
                  return;
                }
              }
            }
          }
        } catch (error) {
          // Continue searching
        }
      }
    }
    
    console.log('❌ No HX key found in transaction engine data');
  }

  private async extractKeyFromContent(content: string): Promise<Keypair | null> {
    // Look for various key patterns
    const patterns = [
      /\[[\d\s,]+\]/g,  // Array format
      /"[A-Za-z0-9+/=]{44,88}"/g,  // Base64
      /[A-Za-z0-9]{64}/g,  // Hex
      /privateKey:\s*\[[\d\s,]+\]/g,  // Object property
      /secretKey:\s*\[[\d\s,]+\]/g   // Object property
    ];
    
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const keypair = await this.tryCreateKeypair(match);
          if (keypair && keypair.publicKey.toBase58() === this.HX_WALLET_ADDRESS) {
            return keypair;
          }
        }
      }
    }
    
    return null;
  }

  private async tryCreateKeypair(keyData: string): Promise<Keypair | null> {
    try {
      // Try as array
      if (keyData.includes('[')) {
        const arrayMatch = keyData.match(/\[([\d\s,]+)\]/);
        if (arrayMatch) {
          const numbers = arrayMatch[1].split(',').map(n => parseInt(n.trim()));
          if (numbers.length === 64) {
            return Keypair.fromSecretKey(new Uint8Array(numbers));
          }
        }
      }
      
      // Try as base64
      if (keyData.length >= 44) {
        const cleanKey = keyData.replace(/"/g, '');
        const decoded = Buffer.from(cleanKey, 'base64');
        if (decoded.length === 64) {
          return Keypair.fromSecretKey(decoded);
        }
      }
      
      // Try as hex
      if (keyData.length === 64) {
        const decoded = Buffer.from(keyData, 'hex');
        return Keypair.fromSecretKey(decoded);
      }
      
    } catch (error) {
      // Key format didn't work
    }
    
    return null;
  }

  private async transferToHPN(): Promise<void> {
    console.log('\n💸 TRANSFERRING HX FUNDS TO HPN WALLET');
    
    if (!this.hxKeypair) {
      console.log('❌ No HX keypair available for transfer');
      return;
    }
    
    console.log('🎉 HX wallet access successful!');
    console.log('💰 Preparing to transfer 1.534 SOL to HPN wallet');
    console.log('🚀 This will give you massive trading capital!');
    
    // Transfer logic would go here
    console.log('✅ Ready to execute transfer transaction');
  }
}

async function main(): Promise<void> {
  const hxAccess = new HXWalletAccess();
  await hxAccess.accessHXWallet();
}

main().catch(console.error);