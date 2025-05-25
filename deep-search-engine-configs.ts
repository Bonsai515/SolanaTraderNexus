/**
 * Deep Search Engine Configs
 * 
 * Comprehensive search through all engine config files,
 * server configs, and transaction engine data for HX wallet key
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

class DeepEngineConfigSearcher {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async deepSearchEngineConfigs(): Promise<void> {
    console.log('🔍 DEEP SEARCH ENGINE CONFIGURATIONS');
    console.log(`🎯 Target: ${this.HX_WALLET_ADDRESS}`);
    console.log(`💰 Value: 1.534420 SOL`);
    console.log('='.repeat(60));

    await this.searchAllServerConfigs();
    await this.searchEngineDirectories();
    await this.searchNexusFiles();
    await this.searchTransactionFiles();
    await this.searchStrategyConfigs();
    await this.searchAllJsonFiles();
  }

  private async searchAllServerConfigs(): Promise<void> {
    console.log('\n📂 SEARCHING ALL SERVER CONFIG FILES');
    
    const serverConfigs = [
      'server/config/agents.json',
      'server/config/jito.json', 
      'server/config/profit.json',
      'server/config/solend.json',
      'server/config/nexus-engine.json',
      'server/config/wallet-monitor.json',
      'server/config/engine.json',
      'server/config/transaction-engine.json',
      'server/config/system.json',
      'server/config/wallets.json'
    ];

    for (const configFile of serverConfigs) {
      await this.searchConfigFile(configFile);
    }
  }

  private async searchConfigFile(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) return;
    
    try {
      console.log(`🔍 Searching: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes(this.HX_WALLET_ADDRESS)) {
        console.log(`📍 Found HX address in: ${filePath}`);
        
        try {
          const data = JSON.parse(content);
          const keypair = await this.extractHXKeypairFromConfig(data, filePath);
          
          if (keypair) {
            await this.foundHXWallet(keypair, filePath);
            return;
          }
        } catch (jsonError) {
          // Search as text if not valid JSON
          await this.searchTextForKey(content, filePath);
        }
      }
      
    } catch (error) {
      // File not accessible
    }
  }

  private async searchEngineDirectories(): Promise<void> {
    console.log('\n⚡ SEARCHING ENGINE DIRECTORIES');
    
    const engineDirs = [
      'nexus_engine',
      'rust_engine', 
      'server/agents',
      'server/ai',
      'server/transformers',
      'server/quantum',
      'server/solana'
    ];

    for (const dir of engineDirs) {
      if (fs.existsSync(dir)) {
        console.log(`📂 Searching engine directory: ${dir}`);
        await this.searchDirectory(dir, 'Engine');
      }
    }
  }

  private async searchNexusFiles(): Promise<void> {
    console.log('\n🔗 SEARCHING NEXUS ENGINE FILES');
    
    const nexusFiles = [
      'data/nexus_engine_config.json',
      'data/nexus/config.json',
      'data/nexus/keys.json',
      'data/nexus/wallets.json',
      'server/nexus-transaction-engine.ts',
      'server/nexus-ai-optimizer.ts',
      'server/nexus-connector.ts',
      'server/nexus-integration.ts'
    ];

    for (const file of nexusFiles) {
      await this.searchConfigFile(file);
    }
  }

  private async searchTransactionFiles(): Promise<void> {
    console.log('\n💳 SEARCHING TRANSACTION ENGINE FILES');
    
    const transactionFiles = [
      'server/transaction-engine.ts',
      'server/transaction_engine.ts', 
      'server/nexus-transaction-engine.ts',
      'server/transaction-connector.ts',
      'server/transaction-queue.ts',
      'data/transaction-engine.json',
      'data/engine-config.json'
    ];

    for (const file of transactionFiles) {
      await this.searchEngineFile(file);
    }
  }

  private async searchEngineFile(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) return;
    
    try {
      console.log(`🔍 Searching engine file: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes(this.HX_WALLET_ADDRESS)) {
        console.log(`📍 Found HX address in: ${filePath}`);
        await this.searchTextForKey(content, filePath);
      }
      
      // Look for wallet creation or key storage patterns
      const keyPatterns = [
        /const.*wallet.*=.*Keypair\./gi,
        /wallet.*=.*fromSecretKey/gi,
        /privateKey.*=.*[0-9a-f]{64,128}/gi,
        /secretKey.*=.*\[.*\]/gi
      ];

      for (const pattern of keyPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          console.log(`🔑 Found key pattern in ${filePath}: ${matches.length} matches`);
          await this.extractKeyFromMatches(matches, content, filePath);
        }
      }
      
    } catch (error) {
      // File not accessible
    }
  }

  private async searchStrategyConfigs(): Promise<void> {
    console.log('\n📊 SEARCHING STRATEGY CONFIGURATIONS');
    
    const strategyDirs = [
      'strategies',
      'server/strategies',
      'config/strategies'
    ];

    for (const dir of strategyDirs) {
      if (fs.existsSync(dir)) {
        await this.searchDirectory(dir, 'Strategy');
      }
    }
  }

  private async searchAllJsonFiles(): Promise<void> {
    console.log('\n📄 SEARCHING ALL JSON FILES FOR HX REFERENCES');
    
    const jsonFiles = this.findAllJsonFiles('.');
    console.log(`📊 Found ${jsonFiles.length} JSON files to search`);
    
    for (const file of jsonFiles) {
      if (file.includes('node_modules') || file.includes('.git')) continue;
      await this.searchConfigFile(file);
    }
  }

  private findAllJsonFiles(dir: string): string[] {
    const jsonFiles: string[] = [];
    
    try {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile() && file.endsWith('.json')) {
          jsonFiles.push(fullPath);
        } else if (stat.isDirectory() && !file.startsWith('.') && 
                   file !== 'node_modules' && fullPath.split('/').length < 6) {
          jsonFiles.push(...this.findAllJsonFiles(fullPath));
        }
      }
    } catch (error) {
      // Skip directories we can't access
    }
    
    return jsonFiles;
  }

  private async searchDirectory(dirPath: string, dirType: string): Promise<void> {
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          if (file.endsWith('.json') || file.endsWith('.ts') || 
              file.includes('config') || file.includes('wallet') || 
              file.includes('key')) {
            await this.searchEngineFile(fullPath);
          }
        } else if (stat.isDirectory() && !file.startsWith('.') && 
                   fullPath.split('/').length < 5) {
          await this.searchDirectory(fullPath, dirType);
        }
      }
    } catch (error) {
      // Directory not accessible
    }
  }

  private async extractHXKeypairFromConfig(data: any, source: string): Promise<Keypair | null> {
    // Check all possible config structures
    const locations = [
      data.wallet,
      data.wallets,
      data.systemWallet,
      data.mainWallet,
      data.hxWallet,
      data.HX_WALLET,
      data.keys,
      data.privateKeys,
      data.engineWallet,
      data.transactionWallet,
      data
    ];

    for (const location of locations) {
      if (!location) continue;
      
      if (Array.isArray(location)) {
        for (const item of location) {
          if (item && (item.address === this.HX_WALLET_ADDRESS || 
                      item.publicKey === this.HX_WALLET_ADDRESS ||
                      item.walletAddress === this.HX_WALLET_ADDRESS)) {
            const privateKey = item.privateKey || item.secretKey || 
                             item.private_key || item.secret_key;
            if (privateKey) {
              return await this.tryCreateKeypair(privateKey);
            }
          }
        }
      } else if (typeof location === 'object') {
        // Check if HX address is a key in the object
        if (location[this.HX_WALLET_ADDRESS]) {
          const wallet = location[this.HX_WALLET_ADDRESS];
          const privateKey = wallet.privateKey || wallet.secretKey || wallet;
          if (privateKey) {
            return await this.tryCreateKeypair(privateKey);
          }
        }
        
        // Check if this object represents the HX wallet
        if (location.address === this.HX_WALLET_ADDRESS || 
            location.publicKey === this.HX_WALLET_ADDRESS ||
            location.walletAddress === this.HX_WALLET_ADDRESS) {
          const privateKey = location.privateKey || location.secretKey ||
                            location.private_key || location.secret_key;
          if (privateKey) {
            return await this.tryCreateKeypair(privateKey);
          }
        }
      }
    }

    return null;
  }

  private async searchTextForKey(content: string, filePath: string): Promise<void> {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(this.HX_WALLET_ADDRESS)) {
        console.log(`📍 Found HX address at line ${i + 1} in ${filePath}`);
        
        // Search surrounding lines for private key
        for (let j = Math.max(0, i - 15); j <= Math.min(lines.length - 1, i + 15); j++) {
          const line = lines[j];
          
          // Look for hex private keys
          const hexMatch = line.match(/[0-9a-f]{128}/gi);
          if (hexMatch) {
            for (const hex of hexMatch) {
              const keypair = await this.tryCreateKeypair(hex);
              if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
                await this.foundHXWallet(keypair, filePath);
                return;
              }
            }
          }
          
          // Look for shorter hex keys
          const shortHexMatch = line.match(/[0-9a-f]{64}/gi);
          if (shortHexMatch) {
            for (const hex of shortHexMatch) {
              const keypair = await this.tryCreateKeypair(hex);
              if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
                await this.foundHXWallet(keypair, filePath);
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

  private async extractKeyFromMatches(matches: string[], content: string, filePath: string): Promise<void> {
    for (const match of matches) {
      console.log(`🔍 Analyzing key pattern: ${match.substring(0, 50)}...`);
      
      // Extract potential keys from the match
      const hexMatches = match.match(/[0-9a-f]{64,128}/gi);
      if (hexMatches) {
        for (const hex of hexMatches) {
          const keypair = await this.tryCreateKeypair(hex);
          if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
            await this.foundHXWallet(keypair, filePath);
            return;
          }
        }
      }
      
      // Look for array patterns
      const arrayMatch = match.match(/\[[\d,\s]+\]/);
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
      
      fs.writeFileSync('./hx-wallet-found.json', JSON.stringify(keyData, null, 2));
      console.log('✅ HX wallet key saved - ready for transfer!');
    }
  }
}

async function main(): Promise<void> {
  const searcher = new DeepEngineConfigSearcher();
  await searcher.deepSearchEngineConfigs();
}

main().catch(console.error);