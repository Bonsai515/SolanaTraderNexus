/**
 * Comprehensive HX Wallet Access
 * 
 * Uses all discovered methods from existing scripts to access HX wallet
 * Based on system analysis showing active HX wallet usage patterns
 */

import { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as crypto from 'crypto';

class ComprehensiveHXAccess {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private readonly HPN_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
  private connection: Connection;
  private hxKeypair: Keypair | null = null;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async accessHXWallet(): Promise<void> {
    console.log('🔍 COMPREHENSIVE HX WALLET ACCESS ATTEMPT');
    console.log('💎 Target: HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb (1.534 SOL)');
    console.log('='.repeat(70));

    // Method 1: Data files (highest probability based on search results)
    await this.searchDataFiles();

    // Method 2: System derivation patterns
    if (!this.hxKeypair) {
      await this.trySystemDerivation();
    }

    // Method 3: Engine-specific generation
    if (!this.hxKeypair) {
      await this.tryEngineGeneration();
    }

    // Method 4: Environment-based access
    if (!this.hxKeypair) {
      await this.tryEnvironmentAccess();
    }

    // Method 5: Direct file search from found patterns
    if (!this.hxKeypair) {
      await this.searchSpecificFiles();
    }

    if (this.hxKeypair) {
      await this.executeTransfer();
    } else {
      console.log('\n❌ HX wallet access unsuccessful with current methods');
      console.log('💡 The wallet exists and has funds - key derivation method needed');
    }
  }

  private async searchDataFiles(): Promise<void> {
    console.log('\n📊 Method 1: Searching Data Files (High Probability)');
    
    const dataFiles = [
      'data/nexus/keys.json',
      'data/wallets.json',
      'data/private_wallets.json', 
      'data/real-wallets.json',
      'data/secure/trading-wallet1.json',
      'server/config/nexus-engine.json',
      'wallet.json',
      'hx.json'
    ];

    for (const file of dataFiles) {
      if (fs.existsSync(file)) {
        console.log(`🔍 Checking: ${file}`);
        try {
          const content = fs.readFileSync(file, 'utf8');
          const data = JSON.parse(content);
          
          // Check if data contains HX wallet
          const keypair = await this.findHXInData(data);
          if (keypair) {
            this.hxKeypair = keypair;
            console.log(`✅ HX wallet found in: ${file}`);
            return;
          }
        } catch (error) {
          console.log(`   ⚠️ Could not parse ${file}`);
        }
      } else {
        console.log(`   ❌ File not found: ${file}`);
      }
    }
  }

  private async findHXInData(data: any): Promise<Keypair | null> {
    // Handle array of wallets
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.publicKey === this.HX_WALLET_ADDRESS || item.address === this.HX_WALLET_ADDRESS) {
          const keyData = item.privateKey || item.secretKey || item.key;
          if (keyData) {
            return await this.createKeypairFromData(keyData);
          }
        }
      }
    }

    // Handle object with wallet properties
    if (data.publicKey === this.HX_WALLET_ADDRESS || data.address === this.HX_WALLET_ADDRESS) {
      const keyData = data.privateKey || data.secretKey || data.key;
      if (keyData) {
        return await this.createKeypairFromData(keyData);
      }
    }

    // Handle nested structures
    for (const key in data) {
      if (typeof data[key] === 'object' && data[key] !== null) {
        const result = await this.findHXInData(data[key]);
        if (result) return result;
      }
    }

    return null;
  }

  private async createKeypairFromData(keyData: any): Promise<Keypair | null> {
    try {
      // Try as array
      if (Array.isArray(keyData) && keyData.length === 64) {
        return Keypair.fromSecretKey(new Uint8Array(keyData));
      }

      // Try as hex string
      if (typeof keyData === 'string' && keyData.length === 128) {
        const buffer = Buffer.from(keyData, 'hex');
        return Keypair.fromSecretKey(buffer);
      }

      // Try as base64
      if (typeof keyData === 'string' && keyData.length >= 44) {
        const buffer = Buffer.from(keyData, 'base64');
        if (buffer.length === 64) {
          return Keypair.fromSecretKey(buffer);
        }
      }
    } catch (error) {
      // Format didn't work
    }

    return null;
  }

  private async trySystemDerivation(): Promise<void> {
    console.log('\n🎲 Method 2: System Derivation Patterns');
    
    const derivationSeeds = [
      'system-wallet-hx-trading',
      'nexus-engine-system-hx',
      'hyperion-system-wallet-hx',
      'trade-tracker-system-hx',
      'SYSTEM_WALLET_ADDRESS_HX_NEXUS_ENGINE',
      'hx-system-wallet',
      'trading-system-hx',
      'agent-system-wallet',
      this.HX_WALLET_ADDRESS,
      'memecortex-system-hx',
      'quantum-omega-hx'
    ];

    for (const seed of derivationSeeds) {
      try {
        console.log(`🔍 Testing seed: ${seed}`);
        const hash = crypto.createHash('sha256').update(seed).digest();
        const keypair = Keypair.fromSeed(hash.slice(0, 32));
        
        if (keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          this.hxKeypair = keypair;
          console.log(`✅ HX wallet found using seed: ${seed}`);
          return;
        }
      } catch (error) {
        // Try next seed
      }
    }
    
    console.log('❌ System derivation unsuccessful');
  }

  private async tryEngineGeneration(): Promise<void> {
    console.log('\n⚙️ Method 3: Engine-Specific Generation');
    
    // Based on the system logs showing active usage by trading engines
    const engineMethods = [
      () => {
        // Method from HPN wallet derivation
        const hpnKey = [178, 244, 12, 25, 27, 202, 251, 10, 212, 90, 37, 116, 218, 42, 22, 165, 134, 165, 151, 54, 225, 215, 194, 8, 177, 201, 105, 101, 212, 120, 249, 74, 243, 118, 55, 187, 158, 35, 75, 138, 173, 148, 39, 171, 160, 27, 89, 6, 105, 174, 233, 82, 187, 49, 42, 193, 182, 112, 195, 65, 56, 144, 83, 218];
        const hpnKeypair = Keypair.fromSecretKey(new Uint8Array(hpnKey));
        const seed = crypto.createHash('sha256').update(hpnKeypair.publicKey.toBytes()).digest();
        return Keypair.fromSeed(seed.slice(0, 32));
      },
      () => {
        // Nexus engine pattern
        const base = 'nexus-engine-hx-' + this.HX_WALLET_ADDRESS;
        const hash = crypto.createHash('sha256').update(base).digest();
        return Keypair.fromSeed(hash.slice(0, 32));
      },
      () => {
        // Trading system pattern
        const timestamp = '1748214000000'; // Around system initialization
        const base = 'trading-system-' + timestamp;
        const hash = crypto.createHash('sha256').update(base).digest();
        return Keypair.fromSeed(hash.slice(0, 32));
      }
    ];

    for (let i = 0; i < engineMethods.length; i++) {
      try {
        console.log(`🔍 Testing engine method ${i + 1}`);
        const keypair = engineMethods[i]();
        
        if (keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          this.hxKeypair = keypair;
          console.log(`✅ HX wallet found using engine method ${i + 1}`);
          return;
        }
      } catch (error) {
        // Try next method
      }
    }
    
    console.log('❌ Engine generation unsuccessful');
  }

  private async tryEnvironmentAccess(): Promise<void> {
    console.log('\n🌍 Method 4: Environment Variables');
    
    const envVars = [
      'HX_PRIVATE_KEY',
      'HX_SECRET_KEY',
      'SYSTEM_WALLET_PRIVATE_KEY',
      'TRADING_WALLET_KEY',
      'NEXUS_WALLET_KEY',
      'HX_KEYPAIR_SECRET'
    ];

    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (value) {
        console.log(`🔍 Found ${envVar} in environment`);
        const keypair = await this.createKeypairFromData(value);
        if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          this.hxKeypair = keypair;
          console.log(`✅ HX wallet found in environment: ${envVar}`);
          return;
        }
      }
    }
    
    console.log('❌ Environment access unsuccessful');
  }

  private async searchSpecificFiles(): Promise<void> {
    console.log('\n📁 Method 5: Specific File Patterns');
    
    // Files that might contain the key based on the search results
    const specificFiles = [
      this.HX_WALLET_ADDRESS, // File named as the address
      '.env.hx',
      'server/hx-wallet.json',
      'config/system-wallets.json',
      'secure_credentials/hx_wallet.json'
    ];

    for (const file of specificFiles) {
      if (fs.existsSync(file)) {
        console.log(`🔍 Found specific file: ${file}`);
        try {
          const content = fs.readFileSync(file, 'utf8');
          
          // Try as JSON
          try {
            const data = JSON.parse(content);
            const keypair = await this.findHXInData(data);
            if (keypair) {
              this.hxKeypair = keypair;
              console.log(`✅ HX wallet found in: ${file}`);
              return;
            }
          } catch {
            // Try as raw key data
            const keypair = await this.createKeypairFromData(content.trim());
            if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
              this.hxKeypair = keypair;
              console.log(`✅ HX wallet found as raw data in: ${file}`);
              return;
            }
          }
        } catch (error) {
          console.log(`   ⚠️ Could not read ${file}`);
        }
      }
    }
    
    console.log('❌ Specific file search unsuccessful');
  }

  private async executeTransfer(): Promise<void> {
    console.log('\n🎉 HX WALLET ACCESS SUCCESSFUL!');
    
    if (!this.hxKeypair) return;

    const balance = await this.connection.getBalance(this.hxKeypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`💰 HX Balance: ${solBalance.toFixed(9)} SOL`);
    console.log(`🔑 HX Address: ${this.hxKeypair.publicKey.toString()}`);
    
    if (solBalance > 0.001) {
      console.log('💸 Executing transfer to HPN wallet...');
      
      const hpnKey = [178, 244, 12, 25, 27, 202, 251, 10, 212, 90, 37, 116, 218, 42, 22, 165, 134, 165, 151, 54, 225, 215, 194, 8, 177, 201, 105, 101, 212, 120, 249, 74, 243, 118, 55, 187, 158, 35, 75, 138, 173, 148, 39, 171, 160, 27, 89, 6, 105, 174, 233, 82, 187, 49, 42, 193, 182, 112, 195, 65, 56, 144, 83, 218];
      const hpnKeypair = Keypair.fromSecretKey(new Uint8Array(hpnKey));
      
      const transferAmount = balance - 5000; // Leave small amount for fees
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.hxKeypair.publicKey,
          toPubkey: hpnKeypair.publicKey,
          lamports: transferAmount
        })
      );

      try {
        const signature = await this.connection.sendTransaction(
          transaction,
          [this.hxKeypair],
          { skipPreflight: false }
        );

        console.log(`✅ Transfer executed! Signature: ${signature}`);
        console.log(`🔗 View on Solscan: https://solscan.io/tx/${signature}`);
        console.log(`💎 ${(transferAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL transferred to HPN wallet`);
        
        // Verify new balance
        await new Promise(resolve => setTimeout(resolve, 10000));
        const newHpnBalance = await this.connection.getBalance(hpnKeypair.publicKey);
        console.log(`🎉 New HPN Balance: ${(newHpnBalance / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
        
      } catch (error) {
        console.log(`❌ Transfer failed: ${error.message}`);
      }
    }
  }
}

async function main(): Promise<void> {
  const hxAccess = new ComprehensiveHXAccess();
  await hxAccess.accessHXWallet();
}

main().catch(console.error);