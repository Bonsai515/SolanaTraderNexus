/**
 * Search Transaction Data for HX Wallet Key
 * 
 * Searches transaction logs, signatures, and blockchain data
 * for the HX wallet private key information
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL,
  PublicKey
} from '@solana/web3.js';
import * as fs from 'fs';

class TransactionDataHXSearcher {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async searchTransactionData(): Promise<void> {
    console.log('📋 SEARCHING TRANSACTION DATA FOR HX WALLET KEY');
    console.log(`🎯 Target: ${this.HX_WALLET_ADDRESS}`);
    console.log(`💰 Value: 1.534420 SOL`);
    console.log('='.repeat(55));

    await this.searchTransactionLogs();
    await this.searchSignatureFiles();
    await this.searchBlockchainData();
    await this.searchTradingHistory();
    await this.searchSystemMemory();
    await this.searchWalletHistory();
  }

  private async searchTransactionLogs(): Promise<void> {
    console.log('\n📋 SEARCHING TRANSACTION LOGS');
    
    const transactionFiles = [
      'transaction-history.json',
      'transaction-log.json',
      'trade-history.json',
      'signature-log.json',
      'blockchain-transactions.json',
      'wallet-transactions.json'
    ];

    for (const file of transactionFiles) {
      await this.searchFile(file);
      await this.searchFile(`logs/${file}`);
      await this.searchFile(`data/${file}`);
      await this.searchFile(`server/${file}`);
    }
  }

  private async searchSignatureFiles(): Promise<void> {
    console.log('\n✍️ SEARCHING SIGNATURE FILES');
    
    const signatureFiles = [
      'signatures.json',
      'transaction-signatures.json',
      'executed-transactions.json',
      'signed-transactions.json',
      'wallet-signatures.json'
    ];

    for (const file of signatureFiles) {
      await this.searchFile(file);
      await this.searchFile(`logs/${file}`);
      await this.searchFile(`data/${file}`);
    }
  }

  private async searchBlockchainData(): Promise<void> {
    console.log('\n⛓️ SEARCHING BLOCKCHAIN DATA FILES');
    
    // Search for any files that might contain blockchain/wallet data
    const blockchainFiles = [
      'wallet-data.json',
      'blockchain-state.json',
      'account-data.json',
      'keypair-data.json',
      'wallet-info.json',
      'system-wallets.json'
    ];

    for (const file of blockchainFiles) {
      await this.searchFile(file);
      await this.searchFile(`data/${file}`);
      await this.searchFile(`server/${file}`);
    }
  }

  private async searchTradingHistory(): Promise<void> {
    console.log('\n📈 SEARCHING TRADING HISTORY');
    
    const tradingFiles = [
      'trading-results.json',
      'executed-trades.json',
      'profit-history.json',
      'strategy-execution.json',
      'wallet-operations.json'
    ];

    for (const file of tradingFiles) {
      await this.searchFile(file);
      await this.searchFile(`logs/${file}`);
      await this.searchFile(`data/${file}`);
    }
  }

  private async searchSystemMemory(): Promise<void> {
    console.log('\n🧠 SEARCHING SYSTEM MEMORY FILES');
    
    // Check system memory and state files
    if (fs.existsSync('server/systemMemory.ts')) {
      console.log('📍 Found systemMemory.ts');
      await this.searchFileContent('server/systemMemory.ts');
    }

    const memoryFiles = [
      'system-state.json',
      'memory-state.json',
      'wallet-state.json',
      'trading-state.json'
    ];

    for (const file of memoryFiles) {
      await this.searchFile(file);
      await this.searchFile(`server/${file}`);
      await this.searchFile(`data/${file}`);
    }
  }

  private async searchWalletHistory(): Promise<void> {
    console.log('\n💼 SEARCHING WALLET HISTORY');
    
    // Search all files that might contain wallet creation/transaction history
    try {
      const allFiles = this.getAllFiles('.', 2);
      
      for (const file of allFiles.slice(0, 50)) { // Limit to prevent timeout
        if (file.includes('wallet') || 
            file.includes('transaction') || 
            file.includes('signature') ||
            file.includes('key')) {
          await this.searchFileContent(file);
        }
      }
    } catch (error) {
      console.log('⚠️ Error searching wallet history files');
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
        await this.extractTransactionData(content, filePath);
      }

      // Look for transaction signatures that might relate to HX wallet
      await this.searchForTransactionSignatures(content, filePath);
      
      // Look for private key patterns
      await this.searchForPrivateKeyPatterns(content, filePath);
      
    } catch (error) {
      // File not readable as text
    }
  }

  private async extractTransactionData(content: string, filePath: string): Promise<void> {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(this.HX_WALLET_ADDRESS)) {
        console.log(`📍 Found HX address at line ${i + 1} in ${filePath}`);
        
        // Look for transaction signatures around the HX address
        for (let j = Math.max(0, i - 15); j <= Math.min(lines.length - 1, i + 15); j++) {
          const line = lines[j];
          
          // Look for transaction signatures (base58 encoded, typically 87-88 characters)
          const signatureMatch = line.match(/[A-Za-z0-9]{87,88}/g);
          if (signatureMatch) {
            console.log(`📋 Found transaction signature: ${signatureMatch[0]}`);
            await this.analyzeTransactionSignature(signatureMatch[0]);
          }
          
          // Look for private keys in transaction data
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
          
          // Look for array format keys
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

  private async searchForTransactionSignatures(content: string, filePath: string): Promise<void> {
    // Look for transaction signatures that might be related to HX wallet creation
    const signatures = content.match(/[A-Za-z0-9]{87,88}/g);
    
    if (signatures && signatures.length > 0) {
      console.log(`📋 Found ${signatures.length} transaction signatures in ${filePath}`);
      
      // Check first few signatures
      for (const signature of signatures.slice(0, 3)) {
        await this.analyzeTransactionSignature(signature);
      }
    }
  }

  private async analyzeTransactionSignature(signature: string): Promise<void> {
    try {
      console.log(`🔍 Analyzing transaction: ${signature}`);
      
      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      
      if (transaction) {
        // Check if this transaction involves the HX wallet
        const accountKeys = transaction.transaction.message.staticAccountKeys || [];
        
        for (const key of accountKeys) {
          if (key.toString() === this.HX_WALLET_ADDRESS) {
            console.log('🎯 Found transaction involving HX wallet!');
            console.log(`📋 Transaction: ${signature}`);
            
            // This transaction might contain creation data
            const logs = transaction.meta?.logMessages || [];
            for (const log of logs) {
              console.log(`📝 Log: ${log}`);
            }
          }
        }
      }
    } catch (error) {
      // Transaction not found or error
    }
  }

  private async searchForPrivateKeyPatterns(content: string, filePath: string): Promise<void> {
    // Look for private key patterns that might be the HX wallet
    const hexKeys = content.match(/[0-9a-f]{128}/gi);
    
    if (hexKeys && hexKeys.length > 0) {
      for (const hex of hexKeys.slice(0, 5)) { // Limit to prevent timeout
        const keypair = await this.tryCreateKeypair(hex);
        if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          await this.foundHXWalletKey(keypair, hex, filePath);
          return;
        }
      }
    }
  }

  private getAllFiles(dir: string, maxDepth: number): string[] {
    const files: string[] = [];
    
    if (maxDepth <= 0) return files;
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        if (item.startsWith('.git') || item === 'node_modules') continue;
        
        const fullPath = `${dir}/${item}`;
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          files.push(fullPath);
        } else if (stat.isDirectory()) {
          files.push(...this.getAllFiles(fullPath, maxDepth - 1));
        }
      }
    } catch (error) {
      // Directory not accessible
    }
    
    return files;
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
    console.log('\n🎉 HX WALLET PRIVATE KEY FOUND IN TRANSACTION DATA!');
    console.log(`📍 Source: ${source}`);
    console.log(`🔑 Address: ${keypair.publicKey.toString()}`);
    
    const balance = await this.connection.getBalance(keypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`💰 Balance: ${solBalance.toFixed(6)} SOL`);
    
    console.log('\n👻 PHANTOM WALLET IMPORT INSTRUCTIONS:');
    console.log('='.repeat(55));
    console.log('📱 To import this wallet into Phantom:');
    console.log('1. Open Phantom wallet extension or app');
    console.log('2. Click "Add/Connect Wallet"');
    console.log('3. Select "Import Private Key"');
    console.log('4. Enter this private key:');
    console.log('');
    console.log(`🔑 Private Key: ${privateKeyHex}`);
    console.log('');
    console.log('5. Your wallet will be imported with 1.534420 SOL!');
    console.log('='.repeat(55));
    
    // Save export data for Phantom
    const exportData = {
      walletAddress: this.HX_WALLET_ADDRESS,
      privateKeyHex: privateKeyHex,
      balance: solBalance,
      foundInTransactionData: true,
      source: source,
      exportedAt: new Date().toISOString(),
      phantomImportSteps: [
        'Open Phantom wallet',
        'Click Add/Connect Wallet', 
        'Select Import Private Key',
        'Paste the private key above',
        'Wallet imported with full 1.534420 SOL balance'
      ]
    };
    
    fs.writeFileSync('./hx-phantom-import.json', JSON.stringify(exportData, null, 2));
    console.log('✅ Phantom import data saved to hx-phantom-import.json');
    
    console.log('\n🎯 SUCCESS! You can now import the HX wallet into Phantom!');
  }
}

async function main(): Promise<void> {
  const searcher = new TransactionDataHXSearcher();
  await searcher.searchTransactionData();
}

main().catch(console.error);