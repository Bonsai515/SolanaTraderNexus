/**
 * Search Receive Funds Files for HX Wallet Key
 * 
 * Searches specifically for files related to receiving funds,
 * Rust files, and wallet management that might contain the HX private key
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as fs from 'fs';

class ReceiveFundsHXSearcher {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async searchReceiveFundsFiles(): Promise<void> {
    console.log('💰 SEARCHING RECEIVE FUNDS & RUST FILES FOR HX WALLET KEY');
    console.log(`🎯 Target: ${this.HX_WALLET_ADDRESS}`);
    console.log(`💎 Value: 1.534420 SOL`);
    console.log('='.repeat(60));

    await this.searchReceiveFundsFiles();
    await this.searchRustFiles();
    await this.searchWalletGenerationFiles();
    await this.searchSystemConfigFiles();
    await this.searchBackupAndStateFiles();
  }

  private async searchReceiveFundsFiles(): Promise<void> {
    console.log('\n💰 SEARCHING RECEIVE FUNDS FILES');
    
    const receiveFundsFiles = [
      'receive-funds.rs',
      'receive-funds.ts',
      'fund-receiver.rs',
      'fund-receiver.ts',
      'wallet-receiver.rs',
      'wallet-receiver.ts',
      'receive-sol.rs',
      'receive-sol.ts',
      'receive-payments.rs',
      'receive-payments.ts',
      'deposit-handler.rs',
      'deposit-handler.ts',
      'incoming-funds.rs',
      'incoming-funds.ts'
    ];

    for (const file of receiveFundsFiles) {
      await this.searchFile(file);
      await this.searchFile(`rust_engine/${file}`);
      await this.searchFile(`server/${file}`);
      await this.searchFile(`transformers/${file}`);
    }
  }

  private async searchRustFiles(): Promise<void> {
    console.log('\n🦀 SEARCHING RUST FILES');
    
    // Search main Rust directories
    const rustDirs = ['rust_engine', 'transformers', 'src'];
    
    for (const dir of rustDirs) {
      if (fs.existsSync(dir)) {
        console.log(`📂 Searching Rust directory: ${dir}`);
        await this.searchRustDirectory(dir);
      }
    }

    // Search specific Rust files
    const rustFiles = [
      'main.rs',
      'lib.rs',
      'wallet.rs',
      'keypair.rs',
      'solana.rs',
      'transaction.rs',
      'engine.rs',
      'transformer.rs'
    ];

    for (const file of rustFiles) {
      await this.searchFile(file);
      await this.searchFile(`rust_engine/${file}`);
      await this.searchFile(`transformers/${file}`);
      await this.searchFile(`src/${file}`);
    }

    // Search Cargo files
    await this.searchFile('Cargo.toml');
    await this.searchFile('Cargo.lock');
  }

  private async searchRustDirectory(dirPath: string): Promise<void> {
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items.slice(0, 20)) { // Limit to prevent timeout
        const fullPath = `${dirPath}/${item}`;
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile() && (item.endsWith('.rs') || item.endsWith('.toml'))) {
          await this.searchFileContent(fullPath);
        } else if (stat.isDirectory() && !item.startsWith('.')) {
          // Recursively search subdirectories (limited depth)
          await this.searchRustDirectory(fullPath);
        }
      }
    } catch (error) {
      // Directory not accessible
    }
  }

  private async searchWalletGenerationFiles(): Promise<void> {
    console.log('\n🔑 SEARCHING WALLET GENERATION FILES');
    
    const walletGenFiles = [
      'generate-wallet.rs',
      'generate-wallet.ts',
      'create-wallet.rs', 
      'create-wallet.ts',
      'wallet-generator.rs',
      'wallet-generator.ts',
      'keypair-generator.rs',
      'keypair-generator.ts',
      'system-wallet.rs',
      'system-wallet.ts',
      'hx-wallet.rs',
      'hx-wallet.ts',
      'wallet-creation.rs',
      'wallet-creation.ts'
    ];

    for (const file of walletGenFiles) {
      await this.searchFile(file);
      await this.searchFile(`server/${file}`);
      await this.searchFile(`rust_engine/${file}`);
    }
  }

  private async searchSystemConfigFiles(): Promise<void> {
    console.log('\n⚙️ SEARCHING SYSTEM CONFIG FILES');
    
    const configFiles = [
      'config.toml',
      'system.toml', 
      'wallets.toml',
      'keys.toml',
      'solana.toml',
      'engine.toml',
      'transformer.toml'
    ];

    for (const file of configFiles) {
      await this.searchFile(file);
      await this.searchFile(`config/${file}`);
      await this.searchFile(`rust_engine/${file}`);
      await this.searchFile(`server/config/${file}`);
    }
  }

  private async searchBackupAndStateFiles(): Promise<void> {
    console.log('\n💾 SEARCHING BACKUP AND STATE FILES');
    
    // Search backup directories with different patterns
    const backupPatterns = ['backup-*', 'state-*', 'save-*'];
    
    try {
      const allItems = fs.readdirSync('.');
      
      for (const item of allItems) {
        if (item.startsWith('backup-') || 
            item.startsWith('state-') || 
            item.startsWith('save-') ||
            item.includes('wallet') ||
            item.includes('key')) {
          
          console.log(`📁 Checking: ${item}`);
          
          if (fs.statSync(item).isDirectory()) {
            await this.searchDirectory(item);
          } else {
            await this.searchFileContent(item);
          }
        }
      }
    } catch (error) {
      // Continue
    }
  }

  private async searchDirectory(dirPath: string): Promise<void> {
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files.slice(0, 10)) { // Limit files
        const fullPath = `${dirPath}/${file}`;
        
        if (fs.statSync(fullPath).isFile()) {
          await this.searchFileContent(fullPath);
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
        await this.extractHXKeyFromFile(content, filePath);
      }

      // Look for private key patterns in Rust/config files
      if (filePath.endsWith('.rs') || 
          filePath.endsWith('.toml') || 
          filePath.includes('wallet') ||
          filePath.includes('key') ||
          filePath.includes('receive') ||
          filePath.includes('fund')) {
        await this.searchForPrivateKeyPatterns(content, filePath);
      }
      
    } catch (error) {
      // File not readable as text
    }
  }

  private async extractHXKeyFromFile(content: string, filePath: string): Promise<void> {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(this.HX_WALLET_ADDRESS)) {
        console.log(`📍 Found HX address at line ${i + 1} in ${filePath}`);
        
        // Search surrounding lines for private key (Rust/TOML format)
        for (let j = Math.max(0, i - 15); j <= Math.min(lines.length - 1, i + 15); j++) {
          const line = lines[j];
          
          // Look for Rust-style private key definitions
          if (line.includes('private_key') || 
              line.includes('secret_key') ||
              line.includes('keypair') ||
              line.includes('wallet_key')) {
            
            // Extract hex keys (64-byte)
            const hexMatch = line.match(/[0-9a-f]{128}/gi);
            if (hexMatch) {
              for (const hex of hexMatch) {
                const keypair = await this.tryCreateKeypair(hex);
                if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
                  await this.foundHXWalletKey(keypair, hex, `${filePath}:${j + 1}`);
                  return;
                }
              }
            }
            
            // Extract array format keys
            const arrayMatch = line.match(/\[[\d,\s]+\]/);
            if (arrayMatch) {
              try {
                const array = JSON.parse(arrayMatch[0]);
                if (Array.isArray(array) && array.length === 64) {
                  const keypair = await this.tryCreateKeypair(array);
                  if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
                    const hexKey = Buffer.from(array).toString('hex');
                    await this.foundHXWalletKey(keypair, hexKey, `${filePath}:${j + 1}`);
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
  }

  private async searchForPrivateKeyPatterns(content: string, filePath: string): Promise<void> {
    // Look for any private keys that might be the HX wallet
    const hexKeys = content.match(/[0-9a-f]{128}/gi);
    
    if (hexKeys && hexKeys.length > 0) {
      console.log(`🔑 Found ${hexKeys.length} potential private keys in ${filePath}`);
      
      for (const hex of hexKeys.slice(0, 3)) { // Limit to prevent timeout
        const keypair = await this.tryCreateKeypair(hex);
        if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          await this.foundHXWalletKey(keypair, hex, filePath);
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

  private async foundHXWalletKey(keypair: Keypair, privateKeyHex: string, source: string): Promise<void> {
    console.log('\n🎉 HX WALLET PRIVATE KEY FOUND IN RECEIVE FUNDS/RUST FILES!');
    console.log(`📍 Source: ${source}`);
    console.log(`🔑 Address: ${keypair.publicKey.toString()}`);
    
    const balance = await this.connection.getBalance(keypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`💰 Balance: ${solBalance.toFixed(6)} SOL`);
    
    console.log('\n👻 PHANTOM WALLET IMPORT READY!');
    console.log('='.repeat(55));
    console.log('🎯 To import this wallet into Phantom:');
    console.log('1. Open Phantom wallet extension or app');
    console.log('2. Click "Add/Connect Wallet"');
    console.log('3. Select "Import Private Key"');
    console.log('4. Enter this private key:');
    console.log('');
    console.log(`🔑 Private Key: ${privateKeyHex}`);
    console.log('');
    console.log('5. Your wallet will be imported with 1.534420 SOL!');
    console.log('='.repeat(55));
    
    // Save the export data
    const exportData = {
      walletAddress: this.HX_WALLET_ADDRESS,
      privateKeyHex: privateKeyHex,
      balance: solBalance,
      foundInFile: source,
      exportedAt: new Date().toISOString(),
      phantomImportInstructions: [
        'Open Phantom wallet',
        'Click Add/Connect Wallet',
        'Select Import Private Key',
        'Paste the private key above',
        'Wallet imported with 1.534420 SOL balance'
      ]
    };
    
    fs.writeFileSync('./hx-phantom-ready.json', JSON.stringify(exportData, null, 2));
    console.log('✅ Phantom import data saved to hx-phantom-ready.json');
    
    console.log('\n🚀 SUCCESS! HX wallet private key ready for Phantom import!');
  }
}

async function main(): Promise<void> {
  const searcher = new ReceiveFundsHXSearcher();
  await searcher.searchReceiveFundsFiles();
}

main().catch(console.error);