/**
 * Search Autosaves and Security Files
 * 
 * Deep search through autosave directories, security files,
 * and encrypted storage for the HX wallet private key
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

class AutosaveSecuritySearcher {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async searchAutosavesAndSecurity(): Promise<void> {
    console.log('🔒 SEARCHING AUTOSAVES AND SECURITY FILES');
    console.log(`🎯 Target: ${this.HX_WALLET_ADDRESS}`);
    console.log(`💰 Potential: 1.534420 SOL`);
    console.log('='.repeat(55));

    await this.searchSecureCredentials();
    await this.searchCacheDirectories();
    await this.searchLogs();
    await this.searchProduction();
    await this.searchActivation();
    await this.searchBackups();
    await this.searchTempFiles();
    await this.searchHiddenFiles();
    await this.searchEncryptedFiles();
  }

  private async searchSecureCredentials(): Promise<void> {
    console.log('\n🔐 SEARCHING SECURE CREDENTIALS');
    
    const secureDir = './secure_credentials';
    if (fs.existsSync(secureDir)) {
      await this.searchDirectory(secureDir, 'Secure Credentials');
    } else {
      console.log('📂 secure_credentials directory not found');
    }
  }

  private async searchCacheDirectories(): Promise<void> {
    console.log('\n💾 SEARCHING CACHE DIRECTORIES');
    
    const cacheDirs = ['./cache', './neural_cache'];
    
    for (const dir of cacheDirs) {
      if (fs.existsSync(dir)) {
        await this.searchDirectory(dir, 'Cache');
      }
    }
  }

  private async searchLogs(): Promise<void> {
    console.log('\n📋 SEARCHING LOG FILES');
    
    const logDirs = ['./logs', './server/logs'];
    
    for (const dir of logDirs) {
      if (fs.existsSync(dir)) {
        await this.searchDirectory(dir, 'Logs');
      }
    }
  }

  private async searchProduction(): Promise<void> {
    console.log('\n🏭 SEARCHING PRODUCTION FILES');
    
    const prodDir = './production';
    if (fs.existsSync(prodDir)) {
      await this.searchDirectory(prodDir, 'Production');
    }
  }

  private async searchActivation(): Promise<void> {
    console.log('\n⚡ SEARCHING ACTIVATION FILES');
    
    const activationDir = './activation';
    if (fs.existsSync(activationDir)) {
      await this.searchDirectory(activationDir, 'Activation');
    }
  }

  private async searchBackups(): Promise<void> {
    console.log('\n💾 SEARCHING ALL BACKUP DIRECTORIES');
    
    // Search all backup directories
    const files = fs.readdirSync('.');
    const backupDirs = files.filter(f => f.startsWith('backup-'));
    
    for (const dir of backupDirs) {
      if (fs.existsSync(dir)) {
        console.log(`🔍 Searching backup: ${dir}`);
        await this.searchDirectory(dir, 'Backup');
      }
    }
  }

  private async searchTempFiles(): Promise<void> {
    console.log('\n📁 SEARCHING TEMP REPOSITORIES');
    
    const tempDir = './temp_repo';
    if (fs.existsSync(tempDir)) {
      await this.searchDirectory(tempDir, 'Temp Repository');
    }
  }

  private async searchHiddenFiles(): Promise<void> {
    console.log('\n👁️ SEARCHING HIDDEN AND DOT FILES');
    
    try {
      const files = fs.readdirSync('.');
      const hiddenFiles = files.filter(f => f.startsWith('.') && f !== '.' && f !== '..');
      
      for (const file of hiddenFiles) {
        if (fs.statSync(file).isFile()) {
          await this.searchFile(file, 'Hidden File');
        }
      }
    } catch (error) {
      console.log('⚠️ Could not access hidden files');
    }
  }

  private async searchEncryptedFiles(): Promise<void> {
    console.log('\n🔐 SEARCHING FOR ENCRYPTED/ENCODED FILES');
    
    // Look for files that might contain encoded keys
    const encodedPatterns = [
      '*.key',
      '*.pem',
      '*.p12',
      '*.jks',
      '*.keystore',
      '*.enc',
      '*.gpg'
    ];

    await this.searchByPatterns(encodedPatterns, 'Encrypted');
  }

  private async searchDirectory(dirPath: string, dirType: string): Promise<void> {
    try {
      console.log(`📂 Scanning ${dirType}: ${dirPath}`);
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          await this.searchFile(fullPath, `${dirType} File`);
        } else if (stat.isDirectory() && !file.startsWith('.')) {
          // Recursively search subdirectories
          await this.searchDirectory(fullPath, dirType);
        }
      }
    } catch (error) {
      console.log(`⚠️ Could not access ${dirPath}: ${error.message}`);
    }
  }

  private async searchByPatterns(patterns: string[], type: string): Promise<void> {
    try {
      for (const pattern of patterns) {
        const extension = pattern.replace('*', '');
        const files = this.findFilesByExtension('.', extension);
        
        for (const file of files) {
          await this.searchFile(file, `${type} Pattern File`);
        }
      }
    } catch (error) {
      console.log(`⚠️ Error searching by patterns: ${error.message}`);
    }
  }

  private findFilesByExtension(dir: string, extension: string): string[] {
    const found: string[] = [];
    
    try {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile() && file.endsWith(extension)) {
          found.push(fullPath);
        } else if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          found.push(...this.findFilesByExtension(fullPath, extension));
        }
      }
    } catch (error) {
      // Skip directories we can't access
    }
    
    return found;
  }

  private async searchFile(filePath: string, fileType: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for HX wallet address reference
      if (content.includes(this.HX_WALLET_ADDRESS)) {
        console.log(`📍 Found HX reference in ${fileType}: ${filePath}`);
        
        // Look for private keys near the address
        await this.extractKeyFromContent(content, filePath);
      }
      
      // Search for potential private key patterns
      await this.searchForKeyPatterns(content, filePath, fileType);
      
      // Try parsing as JSON
      try {
        const data = JSON.parse(content);
        const keypair = await this.extractKeypairFromJSON(data);
        if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          await this.foundHXWallet(keypair, filePath);
        }
      } catch (jsonError) {
        // Not JSON, continue with other methods
      }
      
    } catch (error) {
      // Binary file or access denied - try alternative methods
      if (filePath.includes('wallet') || filePath.includes('key')) {
        try {
          // Try reading as binary for encoded wallets
          const buffer = fs.readFileSync(filePath);
          await this.searchBinaryContent(buffer, filePath, fileType);
        } catch (binaryError) {
          // Skip files we can't read
        }
      }
    }
  }

  private async searchBinaryContent(buffer: Buffer, filePath: string, fileType: string): Promise<void> {
    // Convert buffer to hex and search for patterns
    const hex = buffer.toString('hex');
    
    // Look for 64-byte private key patterns
    const keyPattern = /[0-9a-f]{128}/gi;
    const matches = hex.match(keyPattern);
    
    if (matches) {
      console.log(`🔍 Found potential keys in binary ${fileType}: ${filePath}`);
      
      for (const match of matches) {
        const keypair = await this.tryCreateKeypair(match);
        if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          await this.foundHXWallet(keypair, filePath);
        }
      }
    }
  }

  private async searchForKeyPatterns(content: string, filePath: string, fileType: string): Promise<void> {
    const keyPatterns = [
      /[0-9a-f]{128}/gi,  // 64-byte hex
      /[0-9a-f]{64}/gi,   // 32-byte hex
      /\[[\d,\s]+\]/g     // Array format
    ];

    for (const pattern of keyPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          let keypair = null;
          
          if (match.startsWith('[') && match.endsWith(']')) {
            // Array format
            try {
              const array = JSON.parse(match);
              if (Array.isArray(array) && array.length === 64) {
                keypair = await this.tryCreateKeypair(array);
              }
            } catch (e) {
              // Invalid array format
            }
          } else {
            // Hex format
            keypair = await this.tryCreateKeypair(match);
          }
          
          if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
            await this.foundHXWallet(keypair, filePath);
            return;
          }
        }
      }
    }
  }

  private async extractKeyFromContent(content: string, filePath: string): Promise<void> {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(this.HX_WALLET_ADDRESS)) {
        // Check surrounding lines for private key
        for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 5); j++) {
          const line = lines[j];
          
          // Look for hex keys
          const hexMatch = line.match(/[0-9a-f]{64,128}/gi);
          if (hexMatch) {
            for (const hex of hexMatch) {
              const keypair = await this.tryCreateKeypair(hex);
              if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
                await this.foundHXWallet(keypair, filePath);
                return;
              }
            }
          }
          
          // Look for array format
          const arrayMatch = line.match(/\[[\d,\s]+\]/);
          if (arrayMatch) {
            try {
              const array = JSON.parse(arrayMatch[0]);
              if (Array.isArray(array) && array.length === 64) {
                const keypair = await this.tryCreateKeypair(array);
                if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
                  await this.foundHXWallet(keypair, filePath);
                  return;
                }
              }
            } catch (e) {
              // Invalid array
            }
          }
        }
      }
    }
  }

  private async extractKeypairFromJSON(data: any): Promise<Keypair | null> {
    // Multiple JSON structures to check
    const checkLocations = [
      data,
      data.wallet,
      data.wallets,
      data.hx_wallet,
      data.HX_WALLET,
      data.privateKey,
      data.secretKey
    ];

    for (const location of checkLocations) {
      if (!location) continue;
      
      if (Array.isArray(location)) {
        // Check if it's a wallet array or key array
        if (location.length === 64 && location.every(n => typeof n === 'number')) {
          const keypair = await this.tryCreateKeypair(location);
          if (keypair) return keypair;
        }
        
        // Check wallet objects in array
        for (const item of location) {
          if (item && (item.address === this.HX_WALLET_ADDRESS || item.publicKey === this.HX_WALLET_ADDRESS)) {
            const key = item.privateKey || item.secretKey;
            if (key) {
              const keypair = await this.tryCreateKeypair(key);
              if (keypair) return keypair;
            }
          }
        }
      } else if (typeof location === 'object') {
        // Check if it's a direct wallet object
        if (location.address === this.HX_WALLET_ADDRESS || location.publicKey === this.HX_WALLET_ADDRESS) {
          const key = location.privateKey || location.secretKey;
          if (key) {
            const keypair = await this.tryCreateKeypair(key);
            if (keypair) return keypair;
          }
        }
      }
    }

    return null;
  }

  private async tryCreateKeypair(privateKey: any): Promise<Keypair | null> {
    try {
      if (typeof privateKey === 'string') {
        if (privateKey.length === 128 || privateKey.length === 64) {
          const keyBuffer = Buffer.from(privateKey, 'hex');
          return Keypair.fromSecretKey(new Uint8Array(keyBuffer));
        }
      } else if (Array.isArray(privateKey) && privateKey.length === 64) {
        return Keypair.fromSecretKey(new Uint8Array(privateKey));
      }
    } catch (error) {
      // Invalid key format
    }
    return null;
  }

  private async foundHXWallet(keypair: Keypair, source: string): Promise<void> {
    console.log('\n🎉 HX WALLET PRIVATE KEY FOUND!');
    console.log(`📍 Source: ${source}`);
    console.log(`🔑 Address: ${keypair.publicKey.toString()}`);
    
    const balance = await this.connection.getBalance(keypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`💰 Balance: ${solBalance.toFixed(6)} SOL`);
    
    if (solBalance > 0) {
      console.log('\n🚀 SUCCESS! HX wallet access recovered!');
      console.log('🎯 You now have access to transfer 1.534420 SOL!');
      console.log('💎 This instantly exceeds your 1 SOL goal!');
      
      // Save the recovered key
      const keyData = {
        address: keypair.publicKey.toString(),
        privateKey: Buffer.from(keypair.secretKey).toString('hex'),
        source: source,
        recovered: new Date().toISOString(),
        balance: solBalance
      };
      
      fs.writeFileSync('./hx-wallet-recovered.json', JSON.stringify(keyData, null, 2));
      console.log('✅ HX wallet key saved for transfer!');
    }
  }
}

async function main(): Promise<void> {
  const searcher = new AutosaveSecuritySearcher();
  await searcher.searchAutosavesAndSecurity();
}

main().catch(console.error);