/**
 * Search Midnight Nova Files
 * 
 * Searches for Midnight Nova related files that might contain
 * the HX wallet private key
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  SystemProgram
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

class MidnightNovaSearcher {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private connection: Connection;
  private mainWalletKeypair: Keypair;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async searchMidnightNova(): Promise<void> {
    console.log('🌙 SEARCHING MIDNIGHT NOVA FILES');
    console.log(`🎯 Target: ${this.HX_WALLET_ADDRESS}`);
    console.log(`💰 Value: 1.534420 SOL`);
    console.log('='.repeat(55));

    await this.loadMainWallet();
    await this.searchMidnightNovaFiles();
    await this.searchNovaConfigs();
    await this.searchMidnightStrategies();
    await this.searchNightTimeFiles();
    await this.searchAdvancedPatterns();
  }

  private async loadMainWallet(): Promise<void> {
    console.log('\n🔑 LOADING MAIN WALLET');
    
    const privateKeyArray = [
      178, 244, 12, 25, 27, 202, 251, 10, 212, 90, 37, 116, 218, 42, 22, 165,
      134, 165, 151, 54, 225, 215, 194, 8, 177, 201, 105, 101, 212, 120, 249,
      74, 243, 118, 55, 187, 158, 35, 75, 138, 173, 148, 39, 171, 160, 27, 89,
      6, 105, 174, 233, 82, 187, 49, 42, 193, 182, 112, 195, 65, 56, 144, 83, 218
    ];
    
    this.mainWalletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    console.log(`✅ Main Wallet: ${this.mainWalletKeypair.publicKey.toBase58()}`);
  }

  private async searchMidnightNovaFiles(): Promise<void> {
    console.log('\n🌙 SEARCHING MIDNIGHT NOVA FILES');
    
    const midnightNovaPatterns = [
      'midnight',
      'nova',
      'midnight-nova',
      'midnightnova',
      'night',
      'nova-engine',
      'midnight-engine',
      'nova-wallet',
      'midnight-wallet'
    ];

    for (const pattern of midnightNovaPatterns) {
      console.log(`🔍 Searching for pattern: ${pattern}`);
      await this.searchByPattern(pattern);
    }
  }

  private async searchByPattern(pattern: string): Promise<void> {
    try {
      await this.searchInDirectory('.', pattern);
    } catch (error) {
      // Continue with other patterns
    }
  }

  private async searchInDirectory(dir: string, pattern: string): Promise<void> {
    try {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        if (file.includes('node_modules') || file.startsWith('.git')) continue;
        
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          if (file.toLowerCase().includes(pattern.toLowerCase())) {
            console.log(`📍 Found ${pattern} file: ${fullPath}`);
            await this.searchFile(fullPath);
          }
        } else if (stat.isDirectory() && fullPath.split('/').length < 4) {
          if (file.toLowerCase().includes(pattern.toLowerCase())) {
            console.log(`📂 Found ${pattern} directory: ${fullPath}`);
            await this.searchInDirectory(fullPath, '');
          } else {
            await this.searchInDirectory(fullPath, pattern);
          }
        }
      }
    } catch (error) {
      // Directory not accessible
    }
  }

  private async searchNovaConfigs(): Promise<void> {
    console.log('\n⭐ SEARCHING NOVA CONFIGURATION FILES');
    
    const novaConfigFiles = [
      'nova-config.json',
      'midnight-config.json',
      'nova-engine.json',
      'midnight-nova.json',
      'nova-wallet.json',
      'midnight-wallet.json',
      'nova-keys.json',
      'midnight-keys.json'
    ];

    for (const configFile of novaConfigFiles) {
      await this.searchForFile(configFile);
    }

    // Search in common config directories
    const configDirs = [
      'config',
      'server/config',
      'data',
      'data/nova',
      'data/midnight'
    ];

    for (const dir of configDirs) {
      if (fs.existsSync(dir)) {
        await this.searchNovaInDirectory(dir);
      }
    }
  }

  private async searchMidnightStrategies(): Promise<void> {
    console.log('\n🌃 SEARCHING MIDNIGHT STRATEGY FILES');
    
    const midnightFiles = [
      'midnight-strategy.ts',
      'nova-strategy.ts',
      'midnight-trading.ts',
      'nova-trading.ts',
      'midnight-execution.ts',
      'nova-execution.ts'
    ];

    for (const file of midnightFiles) {
      await this.searchForFile(file);
    }

    // Search in strategies directory
    if (fs.existsSync('strategies')) {
      await this.searchNovaInDirectory('strategies');
    }
  }

  private async searchNightTimeFiles(): Promise<void> {
    console.log('\n🌌 SEARCHING NIGHT-TIME RELATED FILES');
    
    const nightPatterns = [
      'night',
      'midnight', 
      'nova',
      'stellar',
      'cosmic',
      'lunar',
      'eclipse'
    ];

    for (const pattern of nightPatterns) {
      await this.searchTextInFiles(pattern);
    }
  }

  private async searchAdvancedPatterns(): Promise<void> {
    console.log('\n🔮 SEARCHING ADVANCED NOVA PATTERNS');
    
    // Look for files containing both "midnight" and "nova" together
    await this.searchCombinedPatterns();
    
    // Search for potential code names or aliases
    const codeNames = [
      'supernova',
      'nova-prime',
      'midnight-core',
      'nova-engine',
      'stellar-core',
      'cosmic-wallet',
      'lunar-engine'
    ];

    for (const codeName of codeNames) {
      await this.searchByPattern(codeName);
    }
  }

  private async searchCombinedPatterns(): Promise<void> {
    console.log('🔍 Searching for combined midnight + nova patterns');
    
    try {
      await this.searchAllFiles();
    } catch (error) {
      // Continue
    }
  }

  private async searchAllFiles(): Promise<void> {
    const searchDirs = ['.', 'server', 'data', 'config', 'strategies'];
    
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        await this.searchFilesInDir(dir);
      }
    }
  }

  private async searchFilesInDir(dirPath: string): Promise<void> {
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files.slice(0, 50)) { // Limit to prevent timeout
        if (file.includes('node_modules') || file.startsWith('.git')) continue;
        
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          const fileName = file.toLowerCase();
          if (fileName.includes('midnight') || fileName.includes('nova') ||
              fileName.includes('night') || fileName.includes('stellar')) {
            console.log(`📍 Found potential file: ${fullPath}`);
            await this.searchFile(fullPath);
          }
        } else if (stat.isDirectory() && fullPath.split('/').length < 3) {
          await this.searchFilesInDir(fullPath);
        }
      }
    } catch (error) {
      // Directory not accessible
    }
  }

  private async searchForFile(fileName: string): Promise<void> {
    const searchPaths = [
      `./${fileName}`,
      `./config/${fileName}`,
      `./server/config/${fileName}`,
      `./data/${fileName}`,
      `./data/nova/${fileName}`,
      `./data/midnight/${fileName}`,
      `./strategies/${fileName}`
    ];

    for (const filePath of searchPaths) {
      if (fs.existsSync(filePath)) {
        console.log(`📍 Found: ${filePath}`);
        await this.searchFile(filePath);
      }
    }
  }

  private async searchNovaInDirectory(dirPath: string): Promise<void> {
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          const fileName = file.toLowerCase();
          if (fileName.includes('nova') || fileName.includes('midnight') ||
              fileName.includes('night') || fileName.includes('stellar')) {
            console.log(`📍 Found nova file: ${fullPath}`);
            await this.searchFile(fullPath);
          }
        }
      }
    } catch (error) {
      // Directory not accessible
    }
  }

  private async searchTextInFiles(pattern: string): Promise<void> {
    const commonFiles = [
      'package.json',
      'README.md',
      '.env',
      'config.json'
    ];

    for (const file of commonFiles) {
      if (fs.existsSync(file)) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          if (content.toLowerCase().includes(pattern.toLowerCase())) {
            console.log(`📍 Found ${pattern} reference in: ${file}`);
            await this.searchFile(file);
          }
        } catch (error) {
          // File not readable
        }
      }
    }
  }

  private async searchFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes(this.HX_WALLET_ADDRESS)) {
        console.log(`🎯 Found HX address in: ${filePath}`);
        await this.searchForHXKey(content, filePath);
      }

      // Look for midnight/nova specific wallet references
      const novaPatterns = [
        /midnight.*wallet/gi,
        /nova.*wallet/gi,
        /midnight.*key/gi,
        /nova.*key/gi,
        /stellar.*wallet/gi,
        /cosmic.*wallet/gi
      ];

      for (const pattern of novaPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          console.log(`🌙 Found nova pattern in ${filePath}: ${matches[0]}`);
          await this.searchForHXKey(content, filePath);
          break;
        }
      }

      // Try parsing as JSON
      try {
        const data = JSON.parse(content);
        const keypair = await this.extractHXFromNovaData(data, filePath);
        if (keypair) {
          await this.foundHXWallet(keypair, filePath);
        }
      } catch (e) {
        // Not JSON, continue
      }
      
    } catch (error) {
      // File not readable as text, try binary
      try {
        const buffer = fs.readFileSync(filePath);
        await this.searchBinaryForHX(buffer, filePath);
      } catch (binError) {
        // Skip this file
      }
    }
  }

  private async searchForHXKey(content: string, filePath: string): Promise<void> {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(this.HX_WALLET_ADDRESS) || 
          lines[i].toLowerCase().includes('midnight') || 
          lines[i].toLowerCase().includes('nova')) {
        
        // Search surrounding lines for private key
        for (let j = Math.max(0, i - 10); j <= Math.min(lines.length - 1, i + 10); j++) {
          const line = lines[j];
          
          // Look for hex private keys
          const hexMatch = line.match(/[0-9a-f]{128}/gi);
          if (hexMatch) {
            for (const hex of hexMatch) {
              const keypair = await this.tryCreateKeypair(hex);
              if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
                await this.foundHXWallet(keypair, `${filePath}:${j + 1}`);
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
                  await this.foundHXWallet(keypair, `${filePath}:${j + 1}`);
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

  private async extractHXFromNovaData(data: any, source: string): Promise<Keypair | null> {
    const novaFields = [
      'midnight',
      'nova',
      'stellar',
      'cosmic',
      'nightWallet',
      'novaWallet',
      'midnightWallet',
      'stellarWallet'
    ];

    for (const field of novaFields) {
      if (data[field]) {
        const wallet = data[field];
        if (typeof wallet === 'object') {
          if (wallet.address === this.HX_WALLET_ADDRESS || 
              wallet.publicKey === this.HX_WALLET_ADDRESS) {
            const privateKey = wallet.privateKey || wallet.secretKey;
            if (privateKey) {
              return await this.tryCreateKeypair(privateKey);
            }
          }
        }
      }
    }

    return null;
  }

  private async searchBinaryForHX(buffer: Buffer, filePath: string): Promise<void> {
    const hex = buffer.toString('hex');
    
    // Look for potential private keys
    const keyPattern = /[0-9a-f]{128}/gi;
    const matches = hex.match(keyPattern);
    
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

  private async foundHXWallet(keypair: Keypair, source: string): Promise<void> {
    console.log('\n🎉 HX WALLET FOUND IN MIDNIGHT NOVA FILES!');
    console.log(`📍 Source: ${source}`);
    console.log(`🔑 Address: ${keypair.publicKey.toString()}`);
    
    const balance = await this.connection.getBalance(keypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`💰 Balance: ${solBalance.toFixed(6)} SOL`);
    
    if (solBalance > 0) {
      console.log('\n💸 EXECUTING TRANSFER');
      
      try {
        const transferAmount = balance - 5000;
        
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: this.mainWalletKeypair.publicKey,
            lamports: transferAmount
          })
        );

        const signature = await this.connection.sendTransaction(
          transaction,
          [keypair],
          { skipPreflight: false }
        );

        await this.connection.confirmTransaction(signature);

        console.log('\n🎉 MIDNIGHT NOVA SUCCESS!');
        console.log(`💰 Transferred: ${(transferAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
        console.log('🏆 1 SOL GOAL ACHIEVED!');
        
      } catch (error) {
        console.log('❌ Transfer failed:', error.message);
      }
    }
  }
}

async function main(): Promise<void> {
  const searcher = new MidnightNovaSearcher();
  await searcher.searchMidnightNova();
}

main().catch(console.error);