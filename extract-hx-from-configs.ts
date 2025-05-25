/**
 * Extract HX Wallet from System Configurations
 * 
 * Accesses the exact configuration files used by WalletMonitor
 */

import { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

class HXConfigExtractor {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private readonly HPN_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
  private connection: Connection;
  private hxKeypair: Keypair | null = null;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async extractHXFromConfigs(): Promise<void> {
    console.log('🔍 EXTRACTING HX WALLET FROM SYSTEM CONFIGURATIONS');
    console.log('💎 Found: WalletMonitor actively accesses HX wallet every 60 seconds');
    console.log('🎯 Target: Extract access method from configuration files');
    console.log('='.repeat(70));

    await this.checkSystemMemory();
    await this.checkWalletMonitorConfig();
    await this.checkWalletFiles();
    await this.checkNexusEngineConfig();

    if (this.hxKeypair) {
      await this.executeHXTransfer();
    } else {
      await this.analyzeWalletGeneration();
    }
  }

  private async checkSystemMemory(): Promise<void> {
    console.log('\n🧠 CHECKING SYSTEM MEMORY CONFIGURATION');
    
    const systemMemoryPaths = [
      'systemMemory.json',
      'server/systemMemory.json',
      'config/systemMemory.json',
      'data/systemMemory.json'
    ];

    for (const memoryPath of systemMemoryPaths) {
      if (fs.existsSync(memoryPath)) {
        console.log(`✅ Found system memory: ${memoryPath}`);
        try {
          const systemMemory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
          console.log('📊 System memory structure:', Object.keys(systemMemory));
          
          if (systemMemory.wallets) {
            console.log('💼 Wallets in system memory:', systemMemory.wallets);
            
            // Check for HX wallet key data
            const hxKey = await this.extractHXFromObject(systemMemory.wallets);
            if (hxKey) {
              this.hxKeypair = hxKey;
              console.log('🎉 HX wallet key found in system memory!');
              return;
            }
          }
        } catch (error) {
          console.log(`⚠️ Error reading ${memoryPath}:`, error.message);
        }
      } else {
        console.log(`❌ Not found: ${memoryPath}`);
      }
    }
  }

  private async checkWalletMonitorConfig(): Promise<void> {
    console.log('\n📊 CHECKING WALLET MONITOR CONFIGURATION');
    
    const configPaths = [
      'config/wallet-monitor.json',
      'server/config/wallet-monitor.json',
      'data/wallet-monitor.json',
      'wallet-monitor.json'
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        console.log(`✅ Found wallet monitor config: ${configPath}`);
        try {
          const walletMonitor = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          console.log('📊 Wallet monitor structure:', Object.keys(walletMonitor));
          
          // Check for wallet configurations
          if (walletMonitor.wallets) {
            console.log('💼 Monitored wallets:', walletMonitor.wallets);
            
            const hxKey = await this.extractHXFromObject(walletMonitor);
            if (hxKey) {
              this.hxKeypair = hxKey;
              console.log('🎉 HX wallet key found in wallet monitor config!');
              return;
            }
          }
        } catch (error) {
          console.log(`⚠️ Error reading ${configPath}:`, error.message);
        }
      } else {
        console.log(`❌ Not found: ${configPath}`);
      }
    }
  }

  private async checkWalletFiles(): Promise<void> {
    console.log('\n💼 CHECKING WALLET DATA FILES');
    
    const walletPaths = [
      'wallets.json',
      'server/wallets.json',
      'data/wallets.json',
      'config/wallets.json',
      'server/lib/wallets.json'
    ];

    for (const walletPath of walletPaths) {
      if (fs.existsSync(walletPath)) {
        console.log(`✅ Found wallet file: ${walletPath}`);
        try {
          const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
          console.log('📊 Wallet file structure:', Array.isArray(walletData) ? `Array[${walletData.length}]` : Object.keys(walletData));
          
          const hxKey = await this.extractHXFromObject(walletData);
          if (hxKey) {
            this.hxKeypair = hxKey;
            console.log('🎉 HX wallet key found in wallet file!');
            return;
          }
        } catch (error) {
          console.log(`⚠️ Error reading ${walletPath}:`, error.message);
        }
      } else {
        console.log(`❌ Not found: ${walletPath}`);
      }
    }
  }

  private async checkNexusEngineConfig(): Promise<void> {
    console.log('\n⚙️ CHECKING NEXUS ENGINE CONFIGURATION');
    
    const nexusPaths = [
      'server/config/nexus-engine.json',
      'config/nexus-engine.json',
      'nexus-engine.json',
      'data/nexus/config.json'
    ];

    for (const nexusPath of nexusPaths) {
      if (fs.existsSync(nexusPath)) {
        console.log(`✅ Found nexus config: ${nexusPath}`);
        try {
          const nexusConfig = JSON.parse(fs.readFileSync(nexusPath, 'utf8'));
          console.log('📊 Nexus config structure:', Object.keys(nexusConfig));
          
          if (nexusConfig.mainWalletAddress === this.HX_WALLET_ADDRESS) {
            console.log('🎯 HX wallet is registered as main wallet in Nexus engine!');
          }
          
          const hxKey = await this.extractHXFromObject(nexusConfig);
          if (hxKey) {
            this.hxKeypair = hxKey;
            console.log('🎉 HX wallet key found in nexus config!');
            return;
          }
        } catch (error) {
          console.log(`⚠️ Error reading ${nexusPath}:`, error.message);
        }
      } else {
        console.log(`❌ Not found: ${nexusPath}`);
      }
    }
  }

  private async extractHXFromObject(obj: any): Promise<Keypair | null> {
    if (!obj) return null;

    // Handle arrays
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item.publicKey === this.HX_WALLET_ADDRESS || item.address === this.HX_WALLET_ADDRESS) {
          const keyData = item.privateKey || item.secretKey || item.key || item.secret;
          if (keyData) {
            return await this.createKeypairFromData(keyData);
          }
        }
        
        // Recursively check nested objects
        const result = await this.extractHXFromObject(item);
        if (result) return result;
      }
    }

    // Handle objects
    if (typeof obj === 'object') {
      // Check if this object represents the HX wallet
      if (obj.publicKey === this.HX_WALLET_ADDRESS || obj.address === this.HX_WALLET_ADDRESS) {
        const keyData = obj.privateKey || obj.secretKey || obj.key || obj.secret;
        if (keyData) {
          return await this.createKeypairFromData(keyData);
        }
      }

      // Check for direct HX wallet key storage
      const hxKeyFields = [
        'HX_PRIVATE_KEY',
        'HX_SECRET_KEY', 
        'hxPrivateKey',
        'hxSecretKey',
        this.HX_WALLET_ADDRESS
      ];

      for (const field of hxKeyFields) {
        if (obj[field]) {
          const keypair = await this.createKeypairFromData(obj[field]);
          if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
            return keypair;
          }
        }
      }

      // Recursively check nested objects
      for (const key in obj) {
        const result = await this.extractHXFromObject(obj[key]);
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

  private async analyzeWalletGeneration(): Promise<void> {
    console.log('\n🎲 ANALYZING WALLET GENERATION PATTERNS');
    console.log('💡 System actively monitors HX wallet but key not in configs');
    console.log('🔍 This suggests HX wallet is generated dynamically');
    
    console.log('\n📊 Key Insights:');
    console.log('• WalletMonitor successfully gets HX balance every 60 seconds');
    console.log('• System treats HX as "trading wallet" and "Unknown Wallet"');
    console.log('• Address starts with HX - likely vanity address generation');
    console.log('• Nexus engine registers HX as main wallet');
    
    console.log('\n🎯 Next Investigation:');
    console.log('• Check how WalletMonitor.getBalance() works for HX');
    console.log('• Look for vanity address generation code');
    console.log('• Examine wallet registration in server/index.ts');
  }

  private async executeHXTransfer(): Promise<void> {
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
        
      } catch (error) {
        console.log(`❌ Transfer failed: ${error.message}`);
      }
    }
  }
}

async function main(): Promise<void> {
  const extractor = new HXConfigExtractor();
  await extractor.extractHXFromConfigs();
}

main().catch(console.error);