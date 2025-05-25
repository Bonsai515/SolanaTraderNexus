/**
 * Search System Save Files and Autosaves
 * 
 * Deep search through system saves, JSON backups, and autosave files
 * for the HX wallet private key
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

class SystemSaveSearcher {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async searchSystemSaves(): Promise<void> {
    console.log('💾 SEARCHING SYSTEM SAVE FILES & AUTOSAVES');
    console.log(`🎯 Target: ${this.HX_WALLET_ADDRESS}`);
    console.log(`💰 Value: 1.534420 SOL`);
    console.log('='.repeat(60));

    await this.searchAllJSONFiles();
    await this.searchSystemSaveFiles();
    await this.searchAutosaveFiles();
    await this.searchBackupJSONFiles();
    await this.searchTempSaveFiles();
    await this.searchHiddenSaveFiles();
  }

  private async searchAllJSONFiles(): Promise<void> {
    console.log('\n📄 SEARCHING ALL JSON FILES');
    
    const jsonFiles = this.findFilesByExtension('.', '.json');
    console.log(`📊 Found ${jsonFiles.length} JSON files to search`);
    
    for (const file of jsonFiles) {
      await this.searchJSONFile(file);
    }
  }

  private async searchSystemSaveFiles(): Promise<void> {
    console.log('\n💾 SEARCHING SYSTEM SAVE FILES');
    
    const savePatterns = [
      '*save*',
      '*state*',
      '*backup*',
      '*snapshot*',
      '*archive*'
    ];

    for (const pattern of savePatterns) {
      const files = this.findFilesByPattern(pattern);
      for (const file of files) {
        await this.searchSaveFile(file);
      }
    }
  }

  private async searchAutosaveFiles(): Promise<void> {
    console.log('\n🔄 SEARCHING AUTOSAVE FILES');
    
    const autosavePaths = [
      './.autosave',
      './.tmp',
      './autosave',
      './tmp',
      './temp',
      './.backup',
      './backup'
    ];

    for (const dir of autosavePaths) {
      if (fs.existsSync(dir)) {
        console.log(`📂 Searching autosave directory: ${dir}`);
        await this.searchDirectory(dir, 'Autosave');
      }
    }

    // Search for autosave pattern files
    const autosaveFiles = [
      ...this.findFilesByPattern('*autosave*'),
      ...this.findFilesByPattern('*auto*save*'),
      ...this.findFilesByPattern('*.tmp'),
      ...this.findFilesByPattern('*.bak'),
      ...this.findFilesByPattern('*.backup')
    ];

    for (const file of autosaveFiles) {
      await this.searchSaveFile(file);
    }
  }

  private async searchBackupJSONFiles(): Promise<void> {
    console.log('\n📦 SEARCHING ALL BACKUP JSON FILES');
    
    // Get all backup directories we found earlier
    const backupDirs = ['backup-1747772582850', 'backup-1747772820533', 'backup-1747773393718'];
    
    for (const backupDir of backupDirs) {
      if (fs.existsSync(backupDir)) {
        console.log(`📂 Deep searching backup: ${backupDir}`);
        const jsonFiles = this.findFilesByExtension(backupDir, '.json');
        
        for (const file of jsonFiles) {
          await this.searchJSONFile(file);
        }
      }
    }
  }

  private async searchTempSaveFiles(): Promise<void> {
    console.log('\n📁 SEARCHING TEMPORARY SAVE FILES');
    
    const tempDirs = [
      './temp_repo',
      './temp',
      './tmp',
      process.env.TMPDIR || '/tmp',
      '/var/tmp'
    ];

    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) {
        await this.searchDirectory(dir, 'Temp Save');
      }
    }
  }

  private async searchHiddenSaveFiles(): Promise<void> {
    console.log('\n👁️ SEARCHING HIDDEN SAVE FILES');
    
    try {
      const files = fs.readdirSync('.');
      const hiddenFiles = files.filter(f => f.startsWith('.') && 
        (f.includes('save') || f.includes('backup') || f.includes('state')));
      
      for (const file of hiddenFiles) {
        await this.searchSaveFile(file);
      }
    } catch (error) {
      console.log('⚠️ Could not access some hidden files');
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
        } else if (stat.isDirectory() && !file.startsWith('.') && 
                   file !== 'node_modules' && fullPath.split('/').length < 6) {
          found.push(...this.findFilesByExtension(fullPath, extension));
        }
      }
    } catch (error) {
      // Skip directories we can't access
    }
    
    return found;
  }

  private findFilesByPattern(pattern: string): string[] {
    const found: string[] = [];
    const searchTerm = pattern.replace(/\*/g, '');
    
    try {
      const files = fs.readdirSync('.');
      
      for (const file of files) {
        if (file.toLowerCase().includes(searchTerm.toLowerCase())) {
          found.push(file);
        }
      }
    } catch (error) {
      // Skip if can't read directory
    }
    
    return found;
  }

  private async searchJSONFile(filePath: string): Promise<void> {
    try {
      console.log(`🔍 Searching JSON: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // First check if it contains HX wallet address
      if (content.includes(this.HX_WALLET_ADDRESS)) {
        console.log(`📍 Found HX address in: ${filePath}`);
      }
      
      try {
        const data = JSON.parse(content);
        const keypair = await this.extractHXKeypairFromJSON(data, filePath);
        
        if (keypair) {
          await this.foundHXWallet(keypair, filePath);
          return;
        }
      } catch (jsonError) {
        // Invalid JSON, search as text
        await this.searchTextContent(content, filePath);
      }
      
    } catch (error) {
      // Can't read file
    }
  }

  private async searchSaveFile(filePath: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) return;
      
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        await this.searchDirectory(filePath, 'Save Directory');
        return;
      }

      console.log(`💾 Searching save file: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes(this.HX_WALLET_ADDRESS)) {
        console.log(`📍 Found HX address in save file: ${filePath}`);
        await this.searchTextContent(content, filePath);
      }
      
      // Try parsing as JSON if it looks like JSON
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        try {
          const data = JSON.parse(content);
          const keypair = await this.extractHXKeypairFromJSON(data, filePath);
          
          if (keypair) {
            await this.foundHXWallet(keypair, filePath);
          }
        } catch (e) {
          // Not valid JSON
        }
      }
      
    } catch (error) {
      // Can't read file
    }
  }

  private async searchDirectory(dirPath: string, dirType: string): Promise<void> {
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          if (file.endsWith('.json') || file.includes('wallet') || 
              file.includes('key') || file.includes('save')) {
            await this.searchSaveFile(fullPath);
          }
        } else if (stat.isDirectory() && !file.startsWith('.') && 
                   fullPath.split('/').length < 6) {
          await this.searchDirectory(fullPath, dirType);
        }
      }
    } catch (error) {
      // Directory not accessible
    }
  }

  private async extractHXKeypairFromJSON(data: any, source: string): Promise<Keypair | null> {
    // Comprehensive JSON structure search for HX wallet
    
    // Direct wallet object check
    if (data.address === this.HX_WALLET_ADDRESS || data.publicKey === this.HX_WALLET_ADDRESS) {
      const privateKey = data.privateKey || data.secretKey || data.private_key || data.secret_key;
      if (privateKey) {
        return await this.tryCreateKeypair(privateKey);
      }
    }

    // Array of wallets
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && (item.address === this.HX_WALLET_ADDRESS || 
                     item.publicKey === this.HX_WALLET_ADDRESS)) {
          const privateKey = item.privateKey || item.secretKey || 
                            item.private_key || item.secret_key;
          if (privateKey) {
            return await this.tryCreateKeypair(privateKey);
          }
        }
      }
    }

    // Wallets object/array
    if (data.wallets) {
      if (Array.isArray(data.wallets)) {
        for (const wallet of data.wallets) {
          if (wallet && (wallet.address === this.HX_WALLET_ADDRESS || 
                        wallet.publicKey === this.HX_WALLET_ADDRESS)) {
            const privateKey = wallet.privateKey || wallet.secretKey ||
                              wallet.private_key || wallet.secret_key;
            if (privateKey) {
              return await this.tryCreateKeypair(privateKey);
            }
          }
        }
      } else if (typeof data.wallets === 'object') {
        // Check if HX address is a key
        if (data.wallets[this.HX_WALLET_ADDRESS]) {
          const wallet = data.wallets[this.HX_WALLET_ADDRESS];
          const privateKey = wallet.privateKey || wallet.secretKey ||
                            wallet.private_key || wallet.secret_key;
          if (privateKey) {
            return await this.tryCreateKeypair(privateKey);
          }
        }

        // Check all wallet objects
        for (const [address, wallet] of Object.entries(data.wallets)) {
          if (address === this.HX_WALLET_ADDRESS && wallet) {
            const privateKey = wallet.privateKey || wallet.secretKey ||
                              wallet.private_key || wallet.secret_key;
            if (privateKey) {
              return await this.tryCreateKeypair(privateKey);
            }
          }
        }
      }
    }

    // Keys object
    if (data.keys && typeof data.keys === 'object') {
      if (data.keys[this.HX_WALLET_ADDRESS]) {
        return await this.tryCreateKeypair(data.keys[this.HX_WALLET_ADDRESS]);
      }
    }

    // HX wallet specific fields
    const hxFields = ['hx_wallet', 'HX_WALLET', 'hxWallet', 'mainWallet', 'main_wallet'];
    for (const field of hxFields) {
      if (data[field]) {
        const wallet = data[field];
        if (wallet.address === this.HX_WALLET_ADDRESS || 
            wallet.publicKey === this.HX_WALLET_ADDRESS) {
          const privateKey = wallet.privateKey || wallet.secretKey ||
                            wallet.private_key || wallet.secret_key;
          if (privateKey) {
            return await this.tryCreateKeypair(privateKey);
          }
        }
      }
    }

    // State/save specific structures
    if (data.state && data.state.wallets) {
      return await this.extractHXKeypairFromJSON(data.state, source);
    }

    if (data.backup && data.backup.wallets) {
      return await this.extractHXKeypairFromJSON(data.backup, source);
    }

    return null;
  }

  private async searchTextContent(content: string, filePath: string): Promise<void> {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(this.HX_WALLET_ADDRESS)) {
        console.log(`📍 Found HX address at line ${i + 1} in ${filePath}`);
        
        // Search surrounding lines for private key
        for (let j = Math.max(0, i - 10); j <= Math.min(lines.length - 1, i + 10); j++) {
          const line = lines[j];
          
          // Look for hex patterns
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
          
          // Look for JSON arrays
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
      console.log('\n🚀 SUCCESS! HX WALLET ACCESS RECOVERED!');
      console.log('💎 You now have access to transfer 1.534420 SOL!');
      console.log('🎯 This exceeds your 1 SOL goal by 153%!');
      
      const keyData = {
        address: keypair.publicKey.toString(),
        privateKey: Buffer.from(keypair.secretKey).toString('hex'),
        source: source,
        recovered: new Date().toISOString(),
        balance: solBalance
      };
      
      fs.writeFileSync('./hx-wallet-recovered.json', JSON.stringify(keyData, null, 2));
      console.log('✅ HX wallet key saved - ready for transfer!');
    }
  }
}

async function main(): Promise<void> {
  const searcher = new SystemSaveSearcher();
  await searcher.searchSystemSaves();
}

main().catch(console.error);