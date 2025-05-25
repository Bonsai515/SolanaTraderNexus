/**
 * Search Phantom Export HX Files
 * 
 * Searches for Phantom wallet export files and any files containing
 * the HX wallet private key for export purposes
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as fs from 'fs';

class PhantomExportHXSearcher {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async searchPhantomExportFiles(): Promise<void> {
    console.log('👻 SEARCHING PHANTOM EXPORT FILES FOR HX WALLET');
    console.log(`🎯 Target: ${this.HX_WALLET_ADDRESS}`);
    console.log(`💰 Value: 1.534420 SOL`);
    console.log('='.repeat(55));

    await this.searchPhantomFiles();
    await this.searchExportFiles();
    await this.searchPrivateKeyFiles();
    await this.searchWalletExportData();
    await this.checkExportDirectories();
  }

  private async searchPhantomFiles(): Promise<void> {
    console.log('\n👻 SEARCHING PHANTOM WALLET FILES');
    
    const phantomFiles = [
      'phantom.json',
      'phantom-wallet.json',
      'phantom-export.json',
      'phantom-keys.json',
      'direct-hx-to-phantom-transfer.ts',
      'hx-to-phantom-transfer.ts'
    ];

    for (const file of phantomFiles) {
      await this.searchFile(file);
      await this.searchFile(`export/${file}`);
      await this.searchFile(`data/${file}`);
    }

    // Check for files with "phantom" in the name
    await this.searchForPattern('phantom');
  }

  private async searchExportFiles(): Promise<void> {
    console.log('\n📤 SEARCHING EXPORT FILES');
    
    const exportFiles = [
      'export-keys.json',
      'export-wallets.json',
      'wallet-export.json',
      'keys-export.json',
      'export-hx.json',
      'hx-export.json',
      'export-keys-comprehensive.ts'
    ];

    for (const file of exportFiles) {
      await this.searchFile(file);
      await this.searchFile(`export/${file}`);
      await this.searchFile(`data/${file}`);
    }
  }

  private async searchPrivateKeyFiles(): Promise<void> {
    console.log('\n🔑 SEARCHING PRIVATE KEY FILES');
    
    const keyFiles = [
      'private-keys.json',
      'wallet-keys.json',
      'secret-keys.json',
      'hx-private-key.txt',
      'hx-wallet-key.txt',
      'private-key-export.json'
    ];

    for (const file of keyFiles) {
      await this.searchFile(file);
      await this.searchFile(`export/${file}`);
      await this.searchFile(`data/${file}`);
      await this.searchFile(`secure_credentials/${file}`);
    }
  }

  private async searchWalletExportData(): Promise<void> {
    console.log('\n💼 SEARCHING WALLET EXPORT DATA');
    
    // Check the export directory specifically
    if (fs.existsSync('export')) {
      console.log('📂 Found export directory');
      const files = fs.readdirSync('export');
      
      for (const file of files) {
        const fullPath = `export/${file}`;
        console.log(`🔍 Checking export file: ${file}`);
        await this.searchFileContent(fullPath);
      }
    }
  }

  private async checkExportDirectories(): Promise<void> {
    console.log('\n📁 CHECKING EXPORT DIRECTORIES');
    
    const exportDirs = [
      'export',
      'exports',
      'wallet-exports',
      'key-exports',
      'phantom-exports'
    ];

    for (const dir of exportDirs) {
      if (fs.existsSync(dir)) {
        console.log(`📂 Found directory: ${dir}`);
        try {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const fullPath = `${dir}/${file}`;
            await this.searchFileContent(fullPath);
          }
        } catch (error) {
          // Directory not accessible
        }
      }
    }
  }

  private async searchForPattern(pattern: string): Promise<void> {
    try {
      const files = fs.readdirSync('.');
      
      for (const file of files) {
        if (file.toLowerCase().includes(pattern.toLowerCase())) {
          console.log(`📍 Found ${pattern} file: ${file}`);
          await this.searchFileContent(file);
        }
      }
    } catch (error) {
      // Continue
    }
  }

  private async searchFile(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      console.log(`📍 Found file: ${filePath}`);
      await this.searchFileContent(filePath);
    }
  }

  private async searchFileContent(filePath: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return;
      
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes(this.HX_WALLET_ADDRESS)) {
        console.log(`🎯 Found HX address in: ${filePath}`);
        await this.extractPrivateKeyForExport(content, filePath);
      }

      // Look for private key patterns even without HX address
      if (filePath.toLowerCase().includes('export') || 
          filePath.toLowerCase().includes('phantom') ||
          filePath.toLowerCase().includes('private') ||
          filePath.toLowerCase().includes('key')) {
        await this.searchForPrivateKeys(content, filePath);
      }
      
    } catch (error) {
      // File not readable as text, try as binary
      try {
        const buffer = fs.readFileSync(filePath);
        await this.searchBinaryForKey(buffer, filePath);
      } catch (binError) {
        // Skip this file
      }
    }
  }

  private async extractPrivateKeyForExport(content: string, filePath: string): Promise<void> {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(this.HX_WALLET_ADDRESS)) {
        console.log(`📍 Found HX address at line ${i + 1} in ${filePath}`);
        
        // Search surrounding lines for private key
        for (let j = Math.max(0, i - 10); j <= Math.min(lines.length - 1, i + 10); j++) {
          const line = lines[j];
          
          // Look for hex private keys (64-byte)
          const hexMatch = line.match(/[0-9a-f]{128}/gi);
          if (hexMatch) {
            for (const hex of hexMatch) {
              const keypair = await this.tryCreateKeypair(hex);
              if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
                await this.foundHXWalletForExport(keypair, hex, `${filePath}:${j + 1}`);
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
                  const hexKey = Buffer.from(array).toString('hex');
                  await this.foundHXWalletForExport(keypair, hexKey, `${filePath}:${j + 1}`);
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

  private async searchForPrivateKeys(content: string, filePath: string): Promise<void> {
    // Look for any private keys that might be the HX wallet
    const hexKeys = content.match(/[0-9a-f]{128}/gi);
    
    if (hexKeys) {
      console.log(`🔑 Found ${hexKeys.length} potential private keys in ${filePath}`);
      
      for (const hex of hexKeys) {
        const keypair = await this.tryCreateKeypair(hex);
        if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          await this.foundHXWalletForExport(keypair, hex, filePath);
          return;
        }
      }
    }
    
    // Look for array format keys
    const arrayKeys = content.match(/\[[\d,\s]+\]/g);
    
    if (arrayKeys) {
      for (const arrayStr of arrayKeys) {
        try {
          const array = JSON.parse(arrayStr);
          if (Array.isArray(array) && array.length === 64) {
            const keypair = await this.tryCreateKeypair(array);
            if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
              const hexKey = Buffer.from(array).toString('hex');
              await this.foundHXWalletForExport(keypair, hexKey, filePath);
              return;
            }
          }
        } catch (e) {
          // Invalid array
        }
      }
    }
  }

  private async searchBinaryForKey(buffer: Buffer, filePath: string): Promise<void> {
    const hex = buffer.toString('hex');
    
    // Look for 64-byte private key patterns
    const keyPattern = /[0-9a-f]{128}/gi;
    const matches = hex.match(keyPattern);
    
    if (matches) {
      for (const match of matches) {
        const keypair = await this.tryCreateKeypair(match);
        if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          await this.foundHXWalletForExport(keypair, match, filePath);
          return;
        }
      }
    }
  }

  private async tryCreateKeypair(privateKey: any): Promise<Keypair | null> {
    try {
      if (typeof privateKey === 'string') {
        const keyBuffer = Buffer.from(privateKey, 'hex');
        return Keypair.fromSecretKey(new Uint8Array(keyBuffer));
      } else if (Array.isArray(privateKey) && privateKey.length === 64) {
        return Keypair.fromSecretKey(new Uint8Array(privateKey));
      }
    } catch (error) {
      // Invalid key format
    }
    return null;
  }

  private async foundHXWalletForExport(keypair: Keypair, privateKeyHex: string, source: string): Promise<void> {
    console.log('\n🎉 HX WALLET PRIVATE KEY FOUND FOR PHANTOM EXPORT!');
    console.log(`📍 Source: ${source}`);
    console.log(`🔑 Address: ${keypair.publicKey.toString()}`);
    
    const balance = await this.connection.getBalance(keypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`💰 Balance: ${solBalance.toFixed(6)} SOL`);
    
    console.log('\n👻 PHANTOM WALLET EXPORT INFORMATION:');
    console.log('='.repeat(55));
    console.log('📝 To import this wallet into Phantom:');
    console.log('1. Open Phantom wallet');
    console.log('2. Click "Add/Connect Wallet"');
    console.log('3. Select "Import Private Key"');
    console.log('4. Use this private key:');
    console.log('');
    console.log(`🔑 Private Key (Hex): ${privateKeyHex}`);
    console.log('');
    console.log('5. The wallet will be imported with 1.534420 SOL');
    console.log('='.repeat(55));
    
    // Save the export data
    const exportData = {
      walletAddress: this.HX_WALLET_ADDRESS,
      privateKeyHex: privateKeyHex,
      balance: solBalance,
      source: source,
      exportedAt: new Date().toISOString(),
      phantomImportInstructions: {
        step1: 'Open Phantom wallet',
        step2: 'Click Add/Connect Wallet',
        step3: 'Select Import Private Key',
        step4: 'Paste the privateKeyHex above',
        step5: 'Wallet will be imported with full balance'
      }
    };
    
    fs.writeFileSync('./hx-phantom-export.json', JSON.stringify(exportData, null, 2));
    console.log('✅ Export data saved to hx-phantom-export.json');
    
    console.log('\n🎯 SUCCESS! You now have the HX wallet private key to import into Phantom!');
  }
}

async function main(): Promise<void> {
  const searcher = new PhantomExportHXSearcher();
  await searcher.searchPhantomExportFiles();
}

main().catch(console.error);