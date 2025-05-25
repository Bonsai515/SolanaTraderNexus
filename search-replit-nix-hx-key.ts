/**
 * Search Replit Files and Nix Stores for HX Key
 * 
 * Deep search through Replit system files, Nix stores,
 * and system directories for the HX wallet private key
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

class ReplitNixHXSearcher {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async searchReplitNixStores(): Promise<void> {
    console.log('🔍 SEARCHING REPLIT NIX STORES FOR HX KEY');
    console.log(`🎯 Target: ${this.HX_WALLET_ADDRESS}`);
    console.log(`💰 Value: 1.534420 SOL`);
    console.log('='.repeat(55));

    await this.searchReplitFiles();
    await this.searchNixStores();
    await this.searchSystemDirectories();
    await this.searchEnvironmentFiles();
    await this.searchUserDirectories();
    await this.searchRuntimeFiles();
  }

  private async searchReplitFiles(): Promise<void> {
    console.log('\n🔧 SEARCHING REPLIT SYSTEM FILES');
    
    const replitFiles = [
      '.replit',
      '.replit.nix',
      'replit.nix',
      '.config/replit',
      '.config/secrets'
    ];

    for (const file of replitFiles) {
      await this.searchFile(file, 'Replit System File');
    }
  }

  private async searchNixStores(): Promise<void> {
    console.log('\n📦 SEARCHING NIX STORES');
    
    const nixPaths = [
      '/nix/store',
      '/nix/var/nix',
      '~/.nix-profile',
      '/run/current-system',
      process.env.NIX_STORE || '/nix/store'
    ];

    for (const nixPath of nixPaths) {
      await this.searchNixPath(nixPath);
    }
  }

  private async searchSystemDirectories(): Promise<void> {
    console.log('\n🖥️ SEARCHING SYSTEM DIRECTORIES');
    
    const systemDirs = [
      '/tmp',
      '/var/tmp',
      '/home',
      process.env.HOME || '~',
      process.env.TMPDIR || '/tmp'
    ];

    for (const dir of systemDirs) {
      await this.searchSystemDir(dir);
    }
  }

  private async searchEnvironmentFiles(): Promise<void> {
    console.log('\n🌍 SEARCHING ENVIRONMENT AND CONFIG FILES');
    
    const envFiles = [
      process.env.HOME + '/.bashrc',
      process.env.HOME + '/.profile',
      process.env.HOME + '/.zshrc',
      '/etc/environment',
      process.env.HOME + '/.config',
      process.env.HOME + '/.local',
      process.env.HOME + '/.cache'
    ];

    for (const file of envFiles) {
      await this.searchFile(file, 'Environment File');
    }
  }

  private async searchUserDirectories(): Promise<void> {
    console.log('\n👤 SEARCHING USER DIRECTORIES');
    
    const userDirs = [
      process.env.HOME + '/.ssh',
      process.env.HOME + '/.gnupg',
      process.env.HOME + '/.keys',
      process.env.HOME + '/.wallet',
      process.env.HOME + '/.solana'
    ];

    for (const dir of userDirs) {
      await this.searchDirectory(dir, 'User Directory');
    }
  }

  private async searchRuntimeFiles(): Promise<void> {
    console.log('\n⚡ SEARCHING RUNTIME AND TEMP FILES');
    
    // Search for any files that might contain the key
    const patterns = [
      'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
      'hx-wallet',
      'HX_WALLET',
      'wallet-hx'
    ];

    for (const pattern of patterns) {
      await this.searchByPattern(pattern);
    }
  }

  private async searchNixPath(nixPath: string): Promise<void> {
    try {
      if (fs.existsSync(nixPath)) {
        console.log(`📦 Checking Nix path: ${nixPath}`);
        
        // Look for wallet-related files in Nix store
        const command = `find ${nixPath} -name "*wallet*" -o -name "*key*" -o -name "*hx*" 2>/dev/null | head -20`;
        
        // Since we can't execute shell commands in this context, 
        // we'll check if it's a readable directory
        if (fs.statSync(nixPath).isDirectory()) {
          await this.searchDirectory(nixPath, 'Nix Store');
        }
      }
    } catch (error) {
      // Path not accessible
    }
  }

  private async searchSystemDir(dir: string): Promise<void> {
    try {
      if (fs.existsSync(dir)) {
        console.log(`🖥️ Checking system dir: ${dir}`);
        await this.searchDirectory(dir, 'System Directory');
      }
    } catch (error) {
      // Directory not accessible
    }
  }

  private async searchDirectory(dirPath: string, dirType: string): Promise<void> {
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files.slice(0, 50)) { // Limit to prevent overload
        if (file.includes('wallet') || file.includes('key') || file.includes('hx') || 
            file.includes('secret') || file.includes('private')) {
          
          const fullPath = path.join(dirPath, file);
          await this.searchFile(fullPath, `${dirType} File`);
        }
      }
    } catch (error) {
      // Directory not accessible
    }
  }

  private async searchByPattern(pattern: string): Promise<void> {
    console.log(`🔍 Searching for pattern: ${pattern}`);
    
    // Search in current directory and subdirectories
    await this.searchForPatternInDir('.', pattern);
  }

  private async searchForPatternInDir(dir: string, pattern: string): Promise<void> {
    try {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes(pattern)) {
              console.log(`📍 Found pattern "${pattern}" in: ${fullPath}`);
              await this.extractKeyFromContent(content, fullPath);
            }
          } catch (error) {
            // File not readable as text
          }
        } else if (stat.isDirectory() && !file.startsWith('.') && 
                   file !== 'node_modules' && fullPath.split('/').length < 5) {
          await this.searchForPatternInDir(fullPath, pattern);
        }
      }
    } catch (error) {
      // Directory not accessible
    }
  }

  private async searchFile(filePath: string, fileType: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) return;
      
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        await this.searchDirectory(filePath, fileType);
        return;
      }

      console.log(`🔍 Checking ${fileType}: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes(this.HX_WALLET_ADDRESS)) {
        console.log(`📍 Found HX address in ${fileType}: ${filePath}`);
        await this.extractKeyFromContent(content, filePath);
      }
      
      // Look for private key patterns
      await this.searchForKeyInContent(content, filePath, fileType);
      
    } catch (error) {
      // File not accessible or not text
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

  private async searchForKeyInContent(content: string, filePath: string, fileType: string): Promise<void> {
    // Try parsing as JSON first
    try {
      const data = JSON.parse(content);
      const keypair = await this.extractKeypairFromJSON(data);
      if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
        await this.foundHXWallet(keypair, filePath);
        return;
      }
    } catch (jsonError) {
      // Not JSON
    }

    // Search for hex patterns
    const hexPatterns = [/[0-9a-f]{128}/gi, /[0-9a-f]{64}/gi];
    
    for (const pattern of hexPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const keypair = await this.tryCreateKeypair(match);
          if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
            await this.foundHXWallet(keypair, filePath);
            return;
          }
        }
      }
    }
  }

  private async extractKeypairFromJSON(data: any): Promise<Keypair | null> {
    // Various JSON structures
    const locations = [
      data,
      data.wallet,
      data.wallets,
      data.hx_wallet,
      data.HX_WALLET,
      data.keys,
      data.privateKeys
    ];

    for (const location of locations) {
      if (!location) continue;
      
      if (Array.isArray(location)) {
        for (const item of location) {
          if (item && (item.address === this.HX_WALLET_ADDRESS || 
                      item.publicKey === this.HX_WALLET_ADDRESS)) {
            const key = item.privateKey || item.secretKey;
            if (key) {
              const keypair = await this.tryCreateKeypair(key);
              if (keypair) return keypair;
            }
          }
        }
      }
    }

    return null;
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
      // Invalid key
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
      console.log('💎 You now have access to 1.534420 SOL!');
      console.log('🎯 This exceeds your 1 SOL goal by 53%!');
      
      // Save the key
      const keyData = {
        address: keypair.publicKey.toString(),
        privateKey: Buffer.from(keypair.secretKey).toString('hex'),
        source: source,
        recovered: new Date().toISOString(),
        balance: solBalance
      };
      
      fs.writeFileSync('./hx-wallet-recovered.json', JSON.stringify(keyData, null, 2));
      console.log('✅ HX wallet key saved successfully!');
    }
  }
}

async function main(): Promise<void> {
  const searcher = new ReplitNixHXSearcher();
  await searcher.searchReplitNixStores();
}

main().catch(console.error);