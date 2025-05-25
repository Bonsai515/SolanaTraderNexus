/**
 * Search All Wallet Manager & Transaction Engine Files
 * 
 * Searches through all wallet manager files, transaction engines,
 * and Solana-related files for the HX wallet private key
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as fs from 'fs';

class AllWalletManagerSearcher {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async searchAllWalletManagers(): Promise<void> {
    console.log('💼 SEARCHING ALL WALLET MANAGERS & TRANSACTION ENGINES');
    console.log(`🎯 Target: ${this.HX_WALLET_ADDRESS}`);
    console.log(`💎 Value: 1.534420 SOL`);
    console.log('='.repeat(65));

    await this.searchWalletManagerFiles();
    await this.searchTransactionEngineFiles();
    await this.searchSolanaFiles();
    await this.searchWalletDirectories();
    await this.searchEngineDirectories();
  }

  private async searchWalletManagerFiles(): Promise<void> {
    console.log('\n💼 SEARCHING WALLET MANAGER FILES');
    
    const walletManagerFiles = [
      'server/walletManager.ts',
      'server/walletManager.js',
      'server/wallet-manager.ts',
      'server/wallet-manager.js',
      'walletManager.ts',
      'walletManager.js',
      'wallet-manager.ts',
      'wallet-manager.js',
      'server/lib/walletManager.ts',
      'server/lib/walletManager.js',
      'server/wallet/manager.ts',
      'server/wallet/manager.js',
      'server/wallet/walletManager.ts',
      'server/wallet/walletManager.js'
    ];

    for (const file of walletManagerFiles) {
      await this.searchFile(file);
    }
  }

  private async searchTransactionEngineFiles(): Promise<void> {
    console.log('\n⚡ SEARCHING TRANSACTION ENGINE FILES');
    
    const engineFiles = [
      'server/transaction-engine.ts',
      'server/transaction-engine.js',
      'server/transaction_engine.ts',
      'server/transaction_engine.js',
      'server/transactionEngine.ts',
      'server/transactionEngine.js',
      'server/nexus-transaction-engine.ts',
      'server/nexus-transaction-engine.js',
      'server/solana-transaction-engine.ts',
      'server/solana-transaction-engine.js',
      'transaction-engine.ts',
      'transaction-engine.js',
      'transaction_engine.ts',
      'transaction_engine.js',
      'nexus-transaction-engine.ts',
      'nexus-transaction-engine.js'
    ];

    for (const file of engineFiles) {
      await this.searchFile(file);
    }
  }

  private async searchSolanaFiles(): Promise<void> {
    console.log('\n⛓️ SEARCHING SOLANA-RELATED FILES');
    
    const solanaFiles = [
      'server/solana/transaction-broadcaster.ts',
      'server/solana/transaction-broadcaster.js',
      'server/solana/real-transaction-broadcaster.ts',
      'server/solana/real-transaction-broadcaster.js',
      'server/solana/wallet-connector.ts',
      'server/solana/wallet-connector.js',
      'server/solana/keypair-manager.ts',
      'server/solana/keypair-manager.js',
      'server/lib/mevTransactionExecutor.ts',
      'server/lib/mevTransactionExecutor.js',
      'server/lib/solanaTransactionEngine.ts',
      'server/lib/solanaTransactionEngine.js'
    ];

    for (const file of solanaFiles) {
      await this.searchFile(file);
    }
  }

  private async searchWalletDirectories(): Promise<void> {
    console.log('\n📁 SEARCHING WALLET DIRECTORIES');
    
    const walletDirs = [
      'data/wallets',
      'server/wallets',
      'wallets',
      'keys',
      'data/keys',
      'server/keys',
      'data',
      'server/config'
    ];

    for (const dir of walletDirs) {
      if (fs.existsSync(dir)) {
        console.log(`📂 Searching directory: ${dir}`);
        await this.searchDirectory(dir);
      }
    }
  }

  private async searchEngineDirectories(): Promise<void> {
    console.log('\n🔧 SEARCHING ENGINE DIRECTORIES');
    
    const engineDirs = [
      'server/lib',
      'server/solana',
      'server/agents',
      'server/ai',
      'nexus_engine',
      'rust_engine',
      'deploy/server',
      'production/server'
    ];

    for (const dir of engineDirs) {
      if (fs.existsSync(dir)) {
        console.log(`📂 Searching directory: ${dir}`);
        await this.searchDirectory(dir);
      }
    }
  }

  private async searchDirectory(dirPath: string): Promise<void> {
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items.slice(0, 15)) { // Limit to prevent timeout
        const fullPath = `${dirPath}/${item}`;
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          if (item.endsWith('.ts') || 
              item.endsWith('.js') || 
              item.endsWith('.json') ||
              item.includes('wallet') ||
              item.includes('key') ||
              item.includes('engine')) {
            await this.searchFileContent(fullPath);
          }
        } else if (stat.isDirectory() && !item.startsWith('.') && !item.includes('node_modules')) {
          // Recursively search subdirectories (limited depth)
          await this.searchDirectory(fullPath);
        }
      }
    } catch (error) {
      // Directory not accessible
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
      
      // Look for HX wallet address
      if (content.includes(this.HX_WALLET_ADDRESS)) {
        console.log(`🎯 Found HX address in: ${filePath}`);
        await this.extractHXKeyFromContent(content, filePath);
      }

      // Look for private key patterns in wallet/engine files
      if (filePath.includes('wallet') || 
          filePath.includes('engine') || 
          filePath.includes('solana') ||
          filePath.includes('key') ||
          filePath.includes('transaction')) {
        await this.searchForWalletKeys(content, filePath);
      }
      
    } catch (error) {
      // File not readable as text
    }
  }

  private async extractHXKeyFromContent(content: string, filePath: string): Promise<void> {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(this.HX_WALLET_ADDRESS)) {
        console.log(`📍 Found HX address at line ${i + 1} in ${filePath}`);
        
        // Search surrounding lines for private key
        for (let j = Math.max(0, i - 20); j <= Math.min(lines.length - 1, i + 20); j++) {
          const line = lines[j];
          
          // Look for various private key formats
          await this.checkLineForPrivateKey(line, `${filePath}:${j + 1}`);
        }
      }
    }
  }

  private async searchForWalletKeys(content: string, filePath: string): Promise<void> {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for wallet creation or key assignment patterns
      if (line.includes('HX') || 
          line.includes('Keypair.from') ||
          line.includes('private') ||
          line.includes('secret') ||
          line.includes('wallet') ||
          line.includes('key')) {
        
        await this.checkLineForPrivateKey(line, `${filePath}:${i + 1}`);
        
        // Also check surrounding lines
        for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
          if (j !== i) {
            await this.checkLineForPrivateKey(lines[j], `${filePath}:${j + 1}`);
          }
        }
      }
    }
  }

  private async checkLineForPrivateKey(line: string, location: string): Promise<void> {
    // Look for hex private keys (64-byte = 128 hex chars)
    const hexMatch = line.match(/[0-9a-f]{128}/gi);
    if (hexMatch) {
      for (const hex of hexMatch) {
        const keypair = await this.tryCreateKeypair(hex);
        if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          await this.foundHXWalletKey(keypair, hex, location);
          return;
        }
      }
    }
    
    // Look for array format keys [n1, n2, ..., n64]
    const arrayMatch = line.match(/\[[\d,\s]+\]/);
    if (arrayMatch) {
      try {
        const array = JSON.parse(arrayMatch[0]);
        if (Array.isArray(array) && array.length === 64) {
          const keypair = await this.tryCreateKeypair(array);
          if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
            const hexKey = Buffer.from(array).toString('hex');
            await this.foundHXWalletKey(keypair, hexKey, location);
            return;
          }
        }
      } catch (e) {
        // Invalid array
      }
    }
    
    // Look for base58 encoded keys
    const base58Match = line.match(/[A-HJ-NP-Za-km-z1-9]{87,88}/g);
    if (base58Match) {
      for (const b58 of base58Match) {
        try {
          const decoded = Buffer.from(b58, 'base64');
          if (decoded.length === 64) {
            const keypair = await this.tryCreateKeypair(Array.from(decoded));
            if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
              const hexKey = decoded.toString('hex');
              await this.foundHXWalletKey(keypair, hexKey, location);
              return;
            }
          }
        } catch (e) {
          // Invalid base58
        }
      }
    }
  }

  private async tryCreateKeypair(privateKey: any): Promise<Keypair | null> {
    try {
      if (typeof privateKey === 'string') {
        const keyBuffer = Buffer.from(privateKey, 'hex');
        if (keyBuffer.length === 64) {
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

  private async foundHXWalletKey(keypair: Keypair, privateKeyHex: string, source: string): Promise<void> {
    console.log('\n🎉 HX WALLET PRIVATE KEY FOUND IN WALLET MANAGER/ENGINE!');
    console.log(`📍 Source: ${source}`);
    console.log(`🔑 Address: ${keypair.publicKey.toString()}`);
    
    const balance = await this.connection.getBalance(keypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`💰 Balance: ${solBalance.toFixed(6)} SOL`);
    
    console.log('\n👻 PHANTOM WALLET IMPORT INSTRUCTIONS:');
    console.log('='.repeat(60));
    console.log('🎯 To import this wallet into Phantom:');
    console.log('');
    console.log('1. Open Phantom wallet extension or mobile app');
    console.log('2. Click "Add/Connect Wallet" or the "+" button');
    console.log('3. Select "Import Private Key"');
    console.log('4. Copy and paste this private key:');
    console.log('');
    console.log(`🔑 Private Key: ${privateKeyHex}`);
    console.log('');
    console.log('5. Click Import - your wallet will appear with 1.534420 SOL!');
    console.log('');
    console.log('🎊 SUCCESS! You now have access to the HX wallet in Phantom!');
    console.log('='.repeat(60));
    
    // Save the export data
    const exportData = {
      walletAddress: this.HX_WALLET_ADDRESS,
      privateKeyHex: privateKeyHex,
      balance: solBalance,
      foundInWalletManager: true,
      source: source,
      exportedAt: new Date().toISOString(),
      phantomImportComplete: 'Ready for import into Phantom wallet'
    };
    
    fs.writeFileSync('./hx-wallet-phantom-export.json', JSON.stringify(exportData, null, 2));
    console.log('✅ Export data saved to hx-wallet-phantom-export.json');
    
    console.log('\n🚀 MISSION ACCOMPLISHED! HX wallet ready for Phantom!');
  }
}

async function main(): Promise<void> {
  const searcher = new AllWalletManagerSearcher();
  await searcher.searchAllWalletManagers();
}

main().catch(console.error);