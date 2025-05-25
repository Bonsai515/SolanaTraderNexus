/**
 * Comprehensive HX Wallet Search
 * 
 * Searches all system files, transaction logs, and store files
 * for the HX wallet private key to access 1.534420 SOL
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

class HXWalletSearcher {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async searchForHXWallet(): Promise<void> {
    console.log('🔍 COMPREHENSIVE HX WALLET PRIVATE KEY SEARCH');
    console.log(`🎯 Target: ${this.HX_WALLET_ADDRESS}`);
    console.log(`💰 Potential Balance: 1.534420 SOL`);
    console.log('='.repeat(60));

    await this.searchAllDataFiles();
    await this.searchConfigFiles();
    await this.searchTransactionFiles();
    await this.searchBackupFiles();
    await this.searchEnvironmentFiles();
    await this.searchRootFiles();
    await this.attemptKeyRecovery();
  }

  private async searchAllDataFiles(): Promise<void> {
    console.log('\n📁 SEARCHING DATA DIRECTORY');
    
    const dataFiles = [
      './data/private_wallets.json',
      './data/wallets.json',
      './data/real-wallets.json',
      './data/wallet-config.json',
      './data/wallet.json',
      './data/nexus/keys.json',
      './data/active-wallet.json'
    ];

    for (const file of dataFiles) {
      await this.searchFile(file, 'Data File');
    }
  }

  private async searchConfigFiles(): Promise<void> {
    console.log('\n⚙️ SEARCHING CONFIG DIRECTORY');
    
    const configFiles = [
      './config/wallet-config.json',
      './config/quantum-flash-wallet1-config.json',
      './config/quantum-omega-wallet1-config.json'
    ];

    for (const file of configFiles) {
      await this.searchFile(file, 'Config File');
    }
  }

  private async searchTransactionFiles(): Promise<void> {
    console.log('\n🔗 SEARCHING TRANSACTION FILES');
    
    // Search for transaction-related files
    const searchDirs = ['.', './server', './logs', './cache'];
    
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            if (file.includes('transaction') || file.includes('tx') || file.includes('hx')) {
              const filePath = path.join(dir, file);
              await this.searchFile(filePath, 'Transaction File');
            }
          }
        } catch (error) {
          // Skip directories we can't access
        }
      }
    }
  }

  private async searchBackupFiles(): Promise<void> {
    console.log('\n💾 SEARCHING BACKUP DIRECTORIES');
    
    const backupDirs = [
      './backup-1747772582850',
      './backup-1747772820533', 
      './backup-1747773393718'
    ];

    for (const dir of backupDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            if (file.includes('wallet') || file.includes('key') || file.includes('hx')) {
              const filePath = path.join(dir, file);
              await this.searchFile(filePath, 'Backup File');
            }
          }
        } catch (error) {
          // Skip files we can't access
        }
      }
    }
  }

  private async searchEnvironmentFiles(): Promise<void> {
    console.log('\n🌍 SEARCHING ENVIRONMENT FILES');
    
    const envFiles = [
      './.env',
      './.env.trading',
      './.env.real-trading',
      './.env.premium',
      './.env.nexus-pro'
    ];

    for (const file of envFiles) {
      await this.searchFile(file, 'Environment File');
    }
  }

  private async searchRootFiles(): Promise<void> {
    console.log('\n📄 SEARCHING ROOT FILES');
    
    const rootFiles = [
      './wallet.json',
      './hpn-wallet-private-key.txt',
      './wallet-private-key.txt'
    ];

    for (const file of rootFiles) {
      await this.searchFile(file, 'Root File');
    }
  }

  private async searchFile(filePath: string, fileType: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      return;
    }

    try {
      console.log(`🔍 Searching ${fileType}: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Try parsing as JSON first
      try {
        const data = JSON.parse(content);
        const keypair = await this.extractKeypairFromJSON(data, filePath);
        if (keypair) {
          await this.validateAndUseKeypair(keypair, filePath);
          return;
        }
      } catch (jsonError) {
        // Not JSON, search for hex patterns
      }

      // Search for potential private keys (hex patterns)
      const hexPatterns = [
        /[0-9a-f]{128}/gi,  // 64-byte hex key
        /[0-9a-f]{64}/gi,   // 32-byte hex key
      ];

      for (const pattern of hexPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          for (const match of matches) {
            const keypair = await this.tryCreateKeypair(match);
            if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
              await this.validateAndUseKeypair(keypair, filePath);
              return;
            }
          }
        }
      }

      // Search for direct references to HX wallet address
      if (content.includes(this.HX_WALLET_ADDRESS)) {
        console.log(`📍 Found HX wallet address reference in ${filePath}`);
        
        // Look for private key near the address
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(this.HX_WALLET_ADDRESS)) {
            // Check surrounding lines for private key
            for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
              const line = lines[j];
              const keyMatch = line.match(/[0-9a-f]{64,128}/gi);
              if (keyMatch) {
                for (const key of keyMatch) {
                  const keypair = await this.tryCreateKeypair(key);
                  if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
                    await this.validateAndUseKeypair(keypair, filePath);
                    return;
                  }
                }
              }
            }
          }
        }
      }

    } catch (error) {
      // Skip files we can't read
    }
  }

  private async extractKeypairFromJSON(data: any, source: string): Promise<Keypair | null> {
    // Handle various JSON structures
    
    // Array of wallets
    if (Array.isArray(data)) {
      for (const item of data) {
        if ((item.publicKey === this.HX_WALLET_ADDRESS || item.address === this.HX_WALLET_ADDRESS) &&
            (item.privateKey || item.secretKey)) {
          const privateKey = item.privateKey || item.secretKey;
          return await this.tryCreateKeypair(privateKey);
        }
      }
    }

    // Object with wallets property
    if (data.wallets) {
      if (Array.isArray(data.wallets)) {
        for (const wallet of data.wallets) {
          if ((wallet.publicKey === this.HX_WALLET_ADDRESS || wallet.address === this.HX_WALLET_ADDRESS) &&
              (wallet.privateKey || wallet.secretKey)) {
            const privateKey = wallet.privateKey || wallet.secretKey;
            return await this.tryCreateKeypair(privateKey);
          }
        }
      } else if (typeof data.wallets === 'object') {
        for (const [address, wallet] of Object.entries(data.wallets)) {
          if (address === this.HX_WALLET_ADDRESS && (wallet.privateKey || wallet.secretKey)) {
            const privateKey = wallet.privateKey || wallet.secretKey;
            return await this.tryCreateKeypair(privateKey);
          }
        }
      }
    }

    // Direct wallet object
    if ((data.publicKey === this.HX_WALLET_ADDRESS || data.address === this.HX_WALLET_ADDRESS) &&
        (data.privateKey || data.secretKey)) {
      const privateKey = data.privateKey || data.secretKey;
      return await this.tryCreateKeypair(privateKey);
    }

    // Standard Solana wallet format (array of numbers)
    if (Array.isArray(data) && data.length === 64 && data.every(n => typeof n === 'number')) {
      const keypair = await this.tryCreateKeypair(data);
      if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
        return keypair;
      }
    }

    return null;
  }

  private async tryCreateKeypair(privateKey: any): Promise<Keypair | null> {
    try {
      if (typeof privateKey === 'string') {
        if (privateKey.length === 128) {
          // Hex string
          const keyBuffer = Buffer.from(privateKey, 'hex');
          return Keypair.fromSecretKey(new Uint8Array(keyBuffer));
        } else if (privateKey.length === 64) {
          // Shorter hex string
          const keyBuffer = Buffer.from(privateKey, 'hex');
          return Keypair.fromSecretKey(new Uint8Array(keyBuffer));
        }
      } else if (Array.isArray(privateKey) && privateKey.length === 64) {
        // Array format
        return Keypair.fromSecretKey(new Uint8Array(privateKey));
      }
    } catch (error) {
      // Invalid key format
    }
    return null;
  }

  private async validateAndUseKeypair(keypair: Keypair, source: string): Promise<void> {
    console.log('\n🎉 HX WALLET PRIVATE KEY FOUND!');
    console.log(`📍 Source: ${source}`);
    console.log(`🔑 Address: ${keypair.publicKey.toString()}`);
    
    // Verify balance
    const balance = await this.connection.getBalance(keypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`💰 Confirmed Balance: ${solBalance.toFixed(6)} SOL`);
    
    if (solBalance > 0) {
      console.log('\n🚀 SUCCESS! HX wallet access recovered!');
      console.log(`💎 Available to transfer: ${solBalance.toFixed(6)} SOL`);
      console.log('🎯 This puts you instantly over your 1 SOL goal!');
      
      // Save the key for future use
      this.saveHXWalletKey(keypair);
    } else {
      console.log('⚠️ HX wallet found but has no balance');
    }
  }

  private saveHXWalletKey(keypair: Keypair): void {
    try {
      const keyData = {
        address: keypair.publicKey.toString(),
        privateKey: Buffer.from(keypair.secretKey).toString('hex'),
        recovered: new Date().toISOString()
      };
      
      fs.writeFileSync('./hx-wallet-recovered.json', JSON.stringify(keyData, null, 2));
      console.log('✅ HX wallet key saved to hx-wallet-recovered.json');
    } catch (error) {
      console.log('⚠️ Could not save HX wallet key');
    }
  }

  private async attemptKeyRecovery(): Promise<void> {
    console.log('\n🔧 ATTEMPTING ALTERNATIVE RECOVERY METHODS');
    
    // Look for any file that might contain the key
    const allFiles = this.getAllFiles('.');
    
    let filesSearched = 0;
    for (const file of allFiles) {
      if (filesSearched > 100) break; // Limit search to prevent overload
      
      if (file.includes('wallet') || file.includes('key') || file.includes('hx') || 
          file.includes('private') || file.includes('secret')) {
        await this.searchFile(file, 'Recovery File');
        filesSearched++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🔍 COMPREHENSIVE SEARCH COMPLETE');
    console.log('='.repeat(60));
    
    console.log('\n📊 SEARCH SUMMARY:');
    console.log(`🎯 Target wallet: ${this.HX_WALLET_ADDRESS}`);
    console.log(`💰 Potential value: 1.534420 SOL`);
    console.log(`🔍 Files searched: ${filesSearched + 20}+ locations`);
    
    console.log('\n💡 If key not found, it may be:');
    console.log('• Stored in external secure storage');
    console.log('• In encrypted format');
    console.log('• In a hardware wallet');
    console.log('• Backed up elsewhere');
  }

  private getAllFiles(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          files.push(...this.getAllFiles(fullPath));
        } else if (stat.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't access
    }
    
    return files;
  }
}

async function main(): Promise<void> {
  const searcher = new HXWalletSearcher();
  await searcher.searchForHXWallet();
}

main().catch(console.error);