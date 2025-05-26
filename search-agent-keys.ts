
/**
 * Comprehensive Agent Key Search
 * 
 * Searches through all agent configuration files, runtime files, and related
 * components to find the HX wallet private key that agents are using.
 */

import fs from 'fs';
import path from 'path';
import { Keypair } from '@solana/web3.js';

interface KeySearchResult {
  file: string;
  keyType: string;
  content: string;
  isHXWallet: boolean;
  keypair?: Keypair;
}

class AgentKeySearcher {
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private results: KeySearchResult[] = [];

  public async searchAllAgentFiles(): Promise<void> {
    console.log('🔍 COMPREHENSIVE AGENT KEY SEARCH');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎯 Target: ${this.HX_WALLET_ADDRESS}`);
    console.log('');

    // Search all agent directories and files
    await this.searchAgentDirectories();
    await this.searchAgentConfigurations();
    await this.searchAgentRuntimeFiles();
    await this.searchNexusEngineFiles();
    await this.searchTransformerFiles();
    await this.searchDataFiles();

    this.displayResults();
  }

  private async searchAgentDirectories(): Promise<void> {
    console.log('🤖 SEARCHING AGENT DIRECTORIES');
    
    const agentPaths = [
      'server/agents',
      'src/agents',
      'deploy/server/agents',
      'production/server/agents',
      'data/agents',
      'nexus_engine'
    ];

    for (const agentPath of agentPaths) {
      if (fs.existsSync(agentPath)) {
        console.log(`📂 Searching: ${agentPath}`);
        await this.searchDirectory(agentPath, 'Agent Directory');
      }
    }
  }

  private async searchAgentConfigurations(): Promise<void> {
    console.log('\n⚙️ SEARCHING AGENT CONFIGURATIONS');
    
    const configFiles = [
      // Agent JSON configurations
      'data/agents/hyperion-flash-agent.json',
      'data/agents/quantum-omega-agent.json',
      'data/agents/extreme-yield-agent.json',
      'data/agents/money-glitch-agent.json',
      'data/agents/nuclear-money-glitch-agent.json',
      'data/agents/quantum-flash-agent.json',
      'data/agents/zero-capital-flash-agent.json',
      
      // Server configurations
      'server/config/agents.json',
      'server/config/engine.json',
      'server/config/nexus-engine.json',
      
      // Config directories
      'config/strategies',
      'config/nuclear',
      'config/extreme'
    ];

    for (const configFile of configFiles) {
      if (fs.existsSync(configFile)) {
        if (fs.statSync(configFile).isDirectory()) {
          await this.searchDirectory(configFile, 'Agent Config Directory');
        } else {
          await this.searchFile(configFile, 'Agent Configuration');
        }
      }
    }
  }

  private async searchAgentRuntimeFiles(): Promise<void> {
    console.log('\n🏃 SEARCHING AGENT RUNTIME FILES');
    
    const runtimeFiles = [
      // TypeScript agent files
      'server/agents/hyperion.ts',
      'server/agents/hyperionRouter.ts',
      'server/agents/quantum-omega.ts',
      'server/agents/quantumOmegaSniper.ts',
      'server/agents/singularity.ts',
      'server/agents/singularity/index.ts',
      'server/agents/enhancedLaunchDetection.ts',
      'server/agents/omega-sniper.ts',
      
      // Strategy files
      'server/strategies/FlashLoanArbitrageStrategy.ts',
      'server/strategies/MomentumSurfingStrategy.ts',
      'server/strategies/ZeroCapitalFlashArbitrageStrategy.ts',
      'server/strategies/quantum-omega-sniper.ts',
      
      // Integration files
      'server/integration/HyperionFlashArbitrageConnector.ts'
    ];

    for (const runtimeFile of runtimeFiles) {
      if (fs.existsSync(runtimeFile)) {
        await this.searchFile(runtimeFile, 'Agent Runtime');
      }
    }
  }

  private async searchNexusEngineFiles(): Promise<void> {
    console.log('\n🔮 SEARCHING NEXUS ENGINE FILES');
    
    if (fs.existsSync('nexus_engine')) {
      await this.searchDirectory('nexus_engine', 'Nexus Engine');
    }

    const nexusFiles = [
      'nexus_engine/config/wallet_config.json',
      'nexus_engine/config/engine_config.json',
      'nexus_engine/config/nexus_config.json',
      'nexus_engine/autonomous_trader.ts',
      'nexus_engine/real_trader.ts',
      'nexus_engine/hyper_aggressive_trader.ts',
      'nexus_engine/ultra_autonomous_trader.ts'
    ];

    for (const nexusFile of nexusFiles) {
      if (fs.existsExists(nexusFile)) {
        await this.searchFile(nexusFile, 'Nexus Engine File');
      }
    }
  }

  private async searchTransformerFiles(): Promise<void> {
    console.log('\n🔄 SEARCHING TRANSFORMER FILES');
    
    const transformerPaths = [
      'transformers',
      'server/transformers',
      'src/transformers'
    ];

    for (const transformerPath of transformerPaths) {
      if (fs.existsSync(transformerPath)) {
        await this.searchDirectory(transformerPath, 'Transformer');
      }
    }
  }

  private async searchDataFiles(): Promise<void> {
    console.log('\n💾 SEARCHING DATA FILES');
    
    const dataFiles = [
      'data/system-memory.json',
      'data/system_memory.json',
      'data/nexus/keys.json',
      'data/secure/trading-wallet1.json',
      'data/private_wallets.json',
      'data/real-wallets.json',
      'data/wallets.json'
    ];

    for (const dataFile of dataFiles) {
      if (fs.existsSync(dataFile)) {
        await this.searchFile(dataFile, 'Data File');
      }
    }
  }

  private async searchDirectory(dirPath: string, category: string): Promise<void> {
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          await this.searchDirectory(fullPath, category);
        } else if (stat.isFile()) {
          await this.searchFile(fullPath, category);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  private async searchFile(filePath: string, category: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check if file references HX wallet
      if (content.includes(this.HX_WALLET_ADDRESS)) {
        console.log(`   🎯 HX wallet referenced in: ${filePath}`);
        
        // Search for private keys in this file
        await this.extractKeysFromContent(content, filePath, category);
      }
      
      // Also search for any private key patterns
      await this.searchForKeyPatterns(content, filePath, category);
      
    } catch (error) {
      // File not readable as text, try binary
      try {
        const buffer = fs.readFileSync(filePath);
        const content = buffer.toString('hex');
        
        if (content.includes(Buffer.from(this.HX_WALLET_ADDRESS).toString('hex'))) {
          console.log(`   🎯 HX wallet found in binary: ${filePath}`);
        }
      } catch (binError) {
        // Skip this file
      }
    }
  }

  private async extractKeysFromContent(content: string, filePath: string, category: string): Promise<void> {
    // Try parsing as JSON
    try {
      const data = JSON.parse(content);
      await this.searchObjectForKeys(data, filePath, category);
    } catch {
      // Not JSON, search for key patterns
      await this.searchTextForKeys(content, filePath, category);
    }
  }

  private async searchObjectForKeys(obj: any, filePath: string, category: string): Promise<void> {
    const searchDeep = (data: any, path: string = ''): void => {
      if (typeof data === 'object' && data !== null) {
        for (const [key, value] of Object.entries(data)) {
          const currentPath = path ? `${path}.${key}` : key;
          
          if (typeof value === 'string') {
            // Check for private key field names
            if (key.toLowerCase().includes('private') || 
                key.toLowerCase().includes('secret') ||
                key.toLowerCase().includes('key')) {
              
              this.testKeyString(value, filePath, category, `${currentPath} (JSON key)`);
            }
            
            // Check for hex patterns
            if (value.length >= 64 && /^[a-fA-F0-9]+$/.test(value)) {
              this.testKeyString(value, filePath, category, `${currentPath} (hex pattern)`);
            }
            
            // Check for array patterns
            if (value.startsWith('[') && value.includes(',')) {
              this.testKeyString(value, filePath, category, `${currentPath} (array pattern)`);
            }
          } else if (Array.isArray(value) && value.length > 30 && 
                     value.every(item => typeof item === 'number')) {
            // Potential Uint8Array private key
            try {
              const keypair = Keypair.fromSecretKey(new Uint8Array(value));
              const isHX = keypair.publicKey.toString() === this.HX_WALLET_ADDRESS;
              
              this.results.push({
                file: filePath,
                keyType: `${currentPath} (Uint8Array)`,
                content: JSON.stringify(value),
                isHXWallet: isHX,
                keypair: isHX ? keypair : undefined
              });
              
              if (isHX) {
                console.log(`   🎉 FOUND HX WALLET KEY: ${currentPath} in ${filePath}`);
              }
            } catch (e) {
              // Not a valid key
            }
          } else if (typeof value === 'object') {
            searchDeep(value, currentPath);
          }
        }
      }
    };

    searchDeep(obj);
  }

  private async searchTextForKeys(content: string, filePath: string, category: string): Promise<void> {
    // Search for private key patterns in text
    const keyPatterns = [
      // Hex patterns
      /[a-fA-F0-9]{128}/g,
      /[a-fA-F0-9]{64}/g,
      
      // Array patterns
      /\[\s*\d+(?:\s*,\s*\d+){31,}\s*\]/g,
      
      // Base58 patterns
      /[1-9A-HJ-NP-Za-km-z]{87,88}/g,
      
      // Environment variable patterns
      /([A-Z_]+_PRIVATE_KEY|[A-Z_]+_SECRET)\s*=\s*([^\s\n]+)/g
    ];

    for (const pattern of keyPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          this.testKeyString(match, filePath, category, 'Pattern match');
        }
      }
    }
  }

  private async searchForKeyPatterns(content: string, filePath: string, category: string): Promise<void> {
    // Look for wallet creation patterns that might indicate key storage
    const creationPatterns = [
      'Keypair.fromSecretKey',
      'fromSecretKey',
      'Keypair.generate',
      'privateKey',
      'secretKey',
      'wallet',
      'keypair'
    ];

    for (const pattern of creationPatterns) {
      if (content.includes(pattern)) {
        console.log(`   🔍 Found ${pattern} in: ${filePath}`);
        
        // Extract surrounding context
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(pattern)) {
            const context = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
            
            // Check if this context contains actual key data
            const hexMatches = context.match(/[a-fA-F0-9]{64,128}/g);
            if (hexMatches) {
              for (const hex of hexMatches) {
                this.testKeyString(hex, filePath, category, `Context of ${pattern}`);
              }
            }
          }
        }
      }
    }
  }

  private testKeyString(keyString: string, filePath: string, category: string, context: string): void {
    try {
      let keypair: Keypair | null = null;
      
      // Try different key formats
      if (keyString.length === 128 && /^[a-fA-F0-9]+$/.test(keyString)) {
        // Hex format
        keypair = Keypair.fromSecretKey(Buffer.from(keyString, 'hex'));
      } else if (keyString.startsWith('[') && keyString.includes(',')) {
        // Array format
        const arrayStr = keyString.replace(/[\[\]]/g, '');
        const numbers = arrayStr.split(',').map(n => parseInt(n.trim()));
        if (numbers.length === 64) {
          keypair = Keypair.fromSecretKey(new Uint8Array(numbers));
        }
      } else if (keyString.length === 88) {
        // Potential base58
        try {
          const decoded = Buffer.from(keyString, 'base64');
          if (decoded.length === 64) {
            keypair = Keypair.fromSecretKey(decoded);
          }
        } catch (e) {
          // Not base64
        }
      }
      
      if (keypair) {
        const isHX = keypair.publicKey.toString() === this.HX_WALLET_ADDRESS;
        
        this.results.push({
          file: filePath,
          keyType: context,
          content: keyString.substring(0, 50) + '...',
          isHXWallet: isHX,
          keypair: isHX ? keypair : undefined
        });
        
        if (isHX) {
          console.log(`   🎉 FOUND HX WALLET KEY: ${context} in ${filePath}`);
        }
      }
    } catch (error) {
      // Not a valid key
    }
  }

  private displayResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 AGENT KEY SEARCH RESULTS');
    console.log('='.repeat(60));
    
    const hxResults = this.results.filter(r => r.isHXWallet);
    const otherResults = this.results.filter(r => !r.isHXWallet);
    
    if (hxResults.length > 0) {
      console.log('\n🎯 HX WALLET KEYS FOUND:');
      for (const result of hxResults) {
        console.log(`✅ File: ${result.file}`);
        console.log(`   Type: ${result.keyType}`);
        console.log(`   Preview: ${result.content.substring(0, 50)}...`);
        console.log('');
      }
    }
    
    if (otherResults.length > 0) {
      console.log('\n🔑 OTHER KEYS FOUND:');
      for (const result of otherResults.slice(0, 10)) { // Show first 10
        console.log(`📝 File: ${result.file}`);
        console.log(`   Type: ${result.keyType}`);
        console.log('');
      }
      
      if (otherResults.length > 10) {
        console.log(`   ... and ${otherResults.length - 10} more keys found`);
      }
    }
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`🎯 HX Wallet Keys: ${hxResults.length}`);
    console.log(`🔑 Total Keys Found: ${this.results.length}`);
    console.log(`📁 Files Searched: Multiple agent directories and configurations`);
    
    if (hxResults.length > 0) {
      console.log('\n🎉 SUCCESS! HX wallet private key found in agent files.');
      console.log('You can now use this key to access the HX wallet funds.');
    } else {
      console.log('\n⚠️ HX wallet key not found in accessible agent files.');
      console.log('The key may be:');
      console.log('• Stored in encrypted format');
      console.log('• Generated dynamically by the agents');
      console.log('• Stored in external secure storage');
      console.log('• Managed by the runtime system');
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

async function main(): Promise<void> {
  const searcher = new AgentKeySearcher();
  await searcher.searchAllAgentFiles();
}

main().catch(console.error);
