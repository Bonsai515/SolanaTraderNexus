/**
 * Extract HX Private Key - Direct Approach
 * 
 * This script attempts to find and extract the HX wallet private key
 * by checking all possible storage locations and generation methods
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as fs from 'fs';
import * as crypto from 'crypto';

class HXPrivateKeyExtractor {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async extractHXPrivateKey(): Promise<void> {
    console.log('🔑 EXTRACTING HX WALLET PRIVATE KEY');
    console.log(`🎯 Target: ${this.HX_WALLET_ADDRESS}`);
    console.log(`💰 Value: 1.534420 SOL`);
    console.log('='.repeat(50));

    await this.checkEnvironmentVariables();
    await this.checkHiddenFiles();
    await this.checkBackupFiles();
    await this.trySystemGeneration();
    await this.checkLegacyLocations();
  }

  private async checkEnvironmentVariables(): Promise<void> {
    console.log('\n🌍 CHECKING ENVIRONMENT VARIABLES');
    
    const envVars = [
      'HX_PRIVATE_KEY',
      'HX_WALLET_PRIVATE_KEY',
      'SYSTEM_WALLET_PRIVATE_KEY',
      'WALLET_PRIVATE_KEY',
      'PRIVATE_KEY',
      'SECRET_KEY',
      'HX_SECRET_KEY'
    ];

    for (const envVar of envVars) {
      if (process.env[envVar]) {
        console.log(`📍 Found environment variable: ${envVar}`);
        const privateKey = process.env[envVar];
        
        if (await this.testPrivateKey(privateKey, `env:${envVar}`)) {
          return;
        }
      }
    }
  }

  private async checkHiddenFiles(): Promise<void> {
    console.log('\n🕵️ CHECKING HIDDEN FILES');
    
    const hiddenFiles = [
      '.hx-wallet',
      '.system-wallet',
      '.wallet-keys',
      '.private-keys',
      '.solana-keys',
      '.hx-private-key',
      'data/.hx-wallet',
      'data/.system-wallet',
      'server/.hx-wallet',
      'server/.system-wallet'
    ];

    for (const file of hiddenFiles) {
      if (fs.existsSync(file)) {
        console.log(`📍 Found hidden file: ${file}`);
        await this.searchFileForKey(file);
      }
    }
  }

  private async checkBackupFiles(): Promise<void> {
    console.log('\n💾 CHECKING BACKUP FILES');
    
    // Check all backup directories
    try {
      const allItems = fs.readdirSync('.');
      
      for (const item of allItems) {
        if (item.startsWith('backup-') && fs.statSync(item).isDirectory()) {
          console.log(`📂 Checking backup directory: ${item}`);
          await this.searchBackupDirectory(item);
        }
      }
    } catch (error) {
      // Continue
    }
  }

  private async searchBackupDirectory(dirPath: string): Promise<void> {
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const fullPath = `${dirPath}/${file}`;
        
        if (file.includes('wallet') || 
            file.includes('key') || 
            file.includes('hx') ||
            file.includes('system')) {
          await this.searchFileForKey(fullPath);
        }
      }
    } catch (error) {
      // Continue
    }
  }

  private async trySystemGeneration(): Promise<void> {
    console.log('\n🎲 TRYING SYSTEM GENERATION METHODS');
    
    // Try various seed-based generation methods
    const seeds = [
      'system-wallet-hx',
      'hx-system-wallet',
      'trading-system-hx',
      'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
      'nexus-engine-hx',
      'hyperion-system-wallet'
    ];

    for (const seed of seeds) {
      console.log(`🔍 Trying seed: ${seed}`);
      
      try {
        const hash = crypto.createHash('sha256').update(seed).digest();
        const keypair = Keypair.fromSeed(hash);
        
        if (keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          const privateKeyHex = Buffer.from(keypair.secretKey).toString('hex');
          await this.foundHXPrivateKey(privateKeyHex, `seed:${seed}`);
          return;
        }
      } catch (error) {
        // Try next seed
      }
    }
  }

  private async checkLegacyLocations(): Promise<void> {
    console.log('\n📜 CHECKING LEGACY LOCATIONS');
    
    const legacyFiles = [
      'wallet.key',
      'hx.key',
      'system.key',
      'data/system-wallet.key',
      'data/hx-wallet.key',
      'server/wallet.key',
      'server/hx.key'
    ];

    for (const file of legacyFiles) {
      if (fs.existsSync(file)) {
        console.log(`📍 Found legacy file: ${file}`);
        await this.searchFileForKey(file);
      }
    }
  }

  private async searchFileForKey(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Look for hex private keys
      const hexKeys = content.match(/[0-9a-f]{128}/gi);
      if (hexKeys) {
        for (const hex of hexKeys) {
          if (await this.testPrivateKey(hex, filePath)) {
            return;
          }
        }
      }
      
      // Look for array format
      const arrayKeys = content.match(/\[[\d,\s]+\]/g);
      if (arrayKeys) {
        for (const arrayStr of arrayKeys) {
          try {
            const array = JSON.parse(arrayStr);
            if (Array.isArray(array) && array.length === 64) {
              const hexKey = Buffer.from(array).toString('hex');
              if (await this.testPrivateKey(hexKey, filePath)) {
                return;
              }
            }
          } catch (e) {
            // Invalid array
          }
        }
      }
      
    } catch (error) {
      // File not readable
    }
  }

  private async testPrivateKey(privateKeyStr: string, source: string): Promise<boolean> {
    try {
      let privateKeyBuffer: Buffer;
      
      // Try different formats
      if (privateKeyStr.length === 128) {
        // Hex format
        privateKeyBuffer = Buffer.from(privateKeyStr, 'hex');
      } else if (privateKeyStr.length === 88) {
        // Base58 format
        privateKeyBuffer = Buffer.from(privateKeyStr, 'base64');
      } else {
        return false;
      }
      
      if (privateKeyBuffer.length === 64) {
        const keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyBuffer));
        
        if (keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          const privateKeyHex = privateKeyBuffer.toString('hex');
          await this.foundHXPrivateKey(privateKeyHex, source);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  private async foundHXPrivateKey(privateKeyHex: string, source: string): Promise<void> {
    console.log('\n🎉 HX WALLET PRIVATE KEY FOUND!');
    console.log(`📍 Source: ${source}`);
    console.log(`🔑 Address: ${this.HX_WALLET_ADDRESS}`);
    
    const balance = await this.connection.getBalance(new Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(privateKeyHex, 'hex'))
    ).publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`💰 Balance: ${solBalance.toFixed(6)} SOL`);
    
    console.log('\n👻 PHANTOM WALLET IMPORT INSTRUCTIONS:');
    console.log('='.repeat(55));
    console.log('🎯 To import this wallet into Phantom:');
    console.log('');
    console.log('1. Open Phantom wallet extension');
    console.log('2. Click "Add/Connect Wallet"');
    console.log('3. Select "Import Private Key"');
    console.log('4. Enter this private key:');
    console.log('');
    console.log(`🔑 ${privateKeyHex}`);
    console.log('');
    console.log('5. Your wallet will be imported with 1.534420 SOL!');
    console.log('='.repeat(55));
    
    // Save the export data
    const exportData = {
      walletAddress: this.HX_WALLET_ADDRESS,
      privateKeyHex: privateKeyHex,
      balance: solBalance,
      source: source,
      exportedAt: new Date().toISOString(),
      phantomImportReady: true
    };
    
    fs.writeFileSync('./hx-private-key-found.json', JSON.stringify(exportData, null, 2));
    console.log('✅ Private key data saved to hx-private-key-found.json');
    
    console.log('\n🚀 SUCCESS! HX wallet private key ready for Phantom import!');
  }
}

async function main(): Promise<void> {
  const extractor = new HXPrivateKeyExtractor();
  await extractor.extractHXPrivateKey();
  
  console.log('\n💡 If the private key wasn\'t found, it might be:');
  console.log('• Stored in a secure hardware wallet');
  console.log('• Generated using a different method');
  console.log('• Encrypted in a file we haven\'t checked');
  console.log('• Stored in an external key management system');
}

main().catch(console.error);