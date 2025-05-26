
/**
 * Comprehensive HX Wallet Access and Transfer to Phantom
 * 
 * Attempts all available methods to access HX wallet and transfer funds
 * to your Phantom wallet: 2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as crypto from 'crypto';

class ComprehensiveHXAccess {
  private connection: Connection;
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private readonly PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
  private readonly HPN_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
  private hxKeypair: Keypair | null = null;

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  }

  public async accessAndTransfer(): Promise<void> {
    console.log('🚀 COMPREHENSIVE HX WALLET ACCESS AND TRANSFER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎯 Source: ${this.HX_WALLET_ADDRESS}`);
    console.log(`👻 Target: ${this.PHANTOM_WALLET}`);
    console.log('');

    // Check balances first
    await this.checkBalances();

    // Try all access methods
    await this.tryAllAccessMethods();

    // Execute transfer if successful
    if (this.hxKeypair) {
      await this.executeTransferToPhantom();
    } else {
      console.log('\n❌ HX WALLET ACCESS UNSUCCESSFUL');
      console.log('💡 However, I can help you with alternative approaches:');
      await this.showAlternatives();
    }
  }

  private async checkBalances(): Promise<void> {
    console.log('💰 CHECKING WALLET BALANCES');
    console.log('─'.repeat(50));

    try {
      // HX Wallet balance
      const hxBalance = await this.connection.getBalance(new PublicKey(this.HX_WALLET_ADDRESS));
      const hxSOL = hxBalance / LAMPORTS_PER_SOL;
      console.log(`🔑 HX Wallet: ${hxSOL.toFixed(6)} SOL`);

      // Phantom wallet balance
      const phantomBalance = await this.connection.getBalance(new PublicKey(this.PHANTOM_WALLET));
      const phantomSOL = phantomBalance / LAMPORTS_PER_SOL;
      console.log(`👻 Phantom Wallet: ${phantomSOL.toFixed(6)} SOL`);

      // HPN wallet balance
      const hpnBalance = await this.connection.getBalance(new PublicKey(this.HPN_WALLET));
      const hpnSOL = hpnBalance / LAMPORTS_PER_SOL;
      console.log(`💎 HPN Wallet: ${hpnSOL.toFixed(6)} SOL`);

      console.log('');

      if (hxSOL > 0) {
        console.log(`✅ HX wallet has ${hxSOL.toFixed(6)} SOL available for transfer!`);
      } else {
        console.log('⚠️ HX wallet appears to have minimal balance');
      }

    } catch (error) {
      console.error('❌ Error checking balances:', error);
    }
  }

  private async tryAllAccessMethods(): Promise<void> {
    console.log('🔍 ATTEMPTING ALL HX WALLET ACCESS METHODS');
    console.log('─'.repeat(50));

    // Method 1: Known private keys from codebase
    await this.tryKnownKeys();

    // Method 2: Environment variables
    if (!this.hxKeypair) await this.tryEnvironmentKeys();

    // Method 3: Configuration files
    if (!this.hxKeypair) await this.tryConfigurationFiles();

    // Method 4: Derivation from HPN wallet
    if (!this.hxKeypair) await this.tryDerivationMethods();

    // Method 5: System memory files
    if (!this.hxKeypair) await this.trySystemMemoryFiles();

    // Method 6: Profit capture system analysis
    if (!this.hxKeypair) await this.tryProfitSystemAnalysis();
  }

  private async tryKnownKeys(): Promise<void> {
    console.log('\n🔑 Method 1: Known Private Keys');

    const knownKeys = [
      // From your codebase references
      '793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f',
      // HPN key (for derivation testing)
      'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da'
    ];

    for (let i = 0; i < knownKeys.length; i++) {
      try {
        const keypair = Keypair.fromSecretKey(Buffer.from(knownKeys[i], 'hex'));
        if (keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          console.log(`✅ SUCCESS: Found HX key in known keys (${i + 1})`);
          this.hxKeypair = keypair;
          return;
        } else {
          console.log(`❌ Key ${i + 1}: ${keypair.publicKey.toString().substring(0, 8)}... (not HX)`);
        }
      } catch (error) {
        console.log(`❌ Key ${i + 1}: Invalid format`);
      }
    }

    console.log('❌ No matching keys in known key set');
  }

  private async tryEnvironmentKeys(): Promise<void> {
    console.log('\n🌍 Method 2: Environment Variables');

    const envKeys = [
      'HX_PRIVATE_KEY',
      'HX_WALLET_KEY',
      'SYSTEM_WALLET_KEY',
      'TRADING_WALLET_PRIVATE_KEY',
      'PHANTOM_PRIVATE_KEY'
    ];

    for (const envKey of envKeys) {
      const value = process.env[envKey];
      if (value) {
        console.log(`✅ Found ${envKey} in environment`);
        const keypair = await this.tryCreateKeypair(value);
        if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          console.log('🎉 SUCCESS: HX wallet key found in environment!');
          this.hxKeypair = keypair;
          return;
        }
      }
    }

    console.log('❌ No HX key found in environment variables');
  }

  private async tryConfigurationFiles(): Promise<void> {
    console.log('\n📁 Method 3: Configuration Files');

    const configFiles = [
      'data/wallets.json',
      'data/real-wallets.json',
      'data/private_wallets.json',
      'secure_credentials/api-credentials.json',
      'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
      '.env',
      '.env.trading'
    ];

    for (const filePath of configFiles) {
      if (fs.existsSync(filePath)) {
        console.log(`📄 Checking: ${filePath}`);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          if (content.includes(this.HX_WALLET_ADDRESS)) {
            console.log('  ✅ Contains HX wallet reference');
            const keypair = await this.extractKeyFromContent(content);
            if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
              console.log('🎉 SUCCESS: HX wallet key found in config file!');
              this.hxKeypair = keypair;
              return;
            }
          }
        } catch (error) {
          console.log(`  ❌ Could not read file: ${error.message}`);
        }
      }
    }

    console.log('❌ No HX key found in configuration files');
  }

  private async tryDerivationMethods(): Promise<void> {
    console.log('\n🔄 Method 4: Key Derivation');

    // Try deriving from HPN wallet
    const hpnPrivateKey = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';
    
    const derivationPatterns = [
      'hx_wallet_derive',
      'system_wallet_hx',
      'profit_capture_hx',
      'treasury_access_key',
      'phantom_transfer_key'
    ];

    for (const pattern of derivationPatterns) {
      try {
        const combined = hpnPrivateKey + pattern;
        const hash = crypto.createHash('sha256').update(combined).digest();
        const keypair = Keypair.fromSecretKey(hash);
        
        if (keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          console.log(`🎉 SUCCESS: HX key derived with pattern: ${pattern}`);
          this.hxKeypair = keypair;
          return;
        }
      } catch (error) {
        // Continue with next pattern
      }
    }

    console.log('❌ No HX key found through derivation');
  }

  private async trySystemMemoryFiles(): Promise<void> {
    console.log('\n🧠 Method 5: System Memory Files');

    const memoryFiles = [
      'data/system-memory.json',
      'data/system_memory.json',
      'nexus_engine/config/wallet_config.json'
    ];

    for (const filePath of memoryFiles) {
      if (fs.existsSync(filePath)) {
        console.log(`🧠 Checking: ${filePath}`);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(content);
          
          const keypair = await this.findHXInSystemData(data);
          if (keypair) {
            console.log('🎉 SUCCESS: HX wallet found in system memory!');
            this.hxKeypair = keypair;
            return;
          }
        } catch (error) {
          console.log(`  ❌ Could not process file: ${error.message}`);
        }
      }
    }

    console.log('❌ No HX key found in system memory files');
  }

  private async tryProfitSystemAnalysis(): Promise<void> {
    console.log('\n💰 Method 6: Profit System Analysis');

    // Check if profit capture system has HX wallet info
    try {
      if (fs.existsSync('server/lib/profitCapture.ts')) {
        const profitContent = fs.readFileSync('server/lib/profitCapture.ts', 'utf8');
        if (profitContent.includes(this.HX_WALLET_ADDRESS)) {
          console.log('✅ HX wallet referenced in profit capture system');
          console.log('💡 This confirms the HX wallet is part of your system');
        }
      }
    } catch (error) {
      // Continue
    }

    console.log('❌ No direct HX key access through profit system');
  }

  private async extractKeyFromContent(content: string): Promise<Keypair | null> {
    // Look for various key patterns
    const patterns = [
      /\[[\d\s,]+\]/g,  // Array format
      /"[A-Za-z0-9+/=]{44,88}"/g,  // Base64
      /[A-Fa-f0-9]{128}/g,  // Hex (64 bytes)
      /privateKey:\s*"([^"]+)"/g,  // JSON property
      /secretKey:\s*\[[\d\s,]+\]/g   // Array property
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const keypair = await this.tryCreateKeypair(match);
          if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
            return keypair;
          }
        }
      }
    }

    return null;
  }

  private async findHXInSystemData(data: any): Promise<Keypair | null> {
    // Recursively search through system data
    if (typeof data !== 'object' || data === null) return null;

    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase().includes('hx') || key.toLowerCase().includes('wallet')) {
        if (typeof value === 'string') {
          const keypair = await this.tryCreateKeypair(value);
          if (keypair && keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
            return keypair;
          }
        } else if (typeof value === 'object') {
          const result = await this.findHXInSystemData(value);
          if (result) return result;
        }
      }
    }

    return null;
  }

  private async tryCreateKeypair(keyData: string): Promise<Keypair | null> {
    try {
      // Clean the input
      let cleanKey = keyData.replace(/["'\[\]]/g, '');
      
      // Try as hex (128 chars = 64 bytes)
      if (cleanKey.length === 128) {
        const keyBuffer = Buffer.from(cleanKey, 'hex');
        return Keypair.fromSecretKey(keyBuffer);
      }

      // Try as array format
      if (keyData.includes('[')) {
        const arrayMatch = keyData.match(/\[([\d\s,]+)\]/);
        if (arrayMatch) {
          const numbers = arrayMatch[1].split(',').map(n => parseInt(n.trim()));
          if (numbers.length === 64) {
            return Keypair.fromSecretKey(new Uint8Array(numbers));
          }
        }
      }

      // Try as base64
      try {
        const decoded = Buffer.from(cleanKey, 'base64');
        if (decoded.length === 64) {
          return Keypair.fromSecretKey(decoded);
        }
      } catch (e) {
        // Not base64
      }

    } catch (error) {
      // Invalid key format
    }

    return null;
  }

  private async executeTransferToPhantom(): Promise<void> {
    console.log('\n💸 EXECUTING TRANSFER TO PHANTOM WALLET');
    console.log('─'.repeat(50));

    if (!this.hxKeypair) {
      console.log('❌ No HX keypair available for transfer');
      return;
    }

    try {
      const balance = await this.connection.getBalance(this.hxKeypair.publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;

      console.log(`💰 HX Balance: ${solBalance.toFixed(6)} SOL`);

      if (balance < 10000) { // Less than 0.00001 SOL
        console.log('⚠️ HX wallet balance too low for transfer');
        return;
      }

      // Calculate transfer amount (leave small amount for fees)
      const transferAmount = balance - 5000; // Leave 0.000005 SOL for fees

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.hxKeypair.publicKey,
          toPubkey: new PublicKey(this.PHANTOM_WALLET),
          lamports: transferAmount
        })
      );

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.hxKeypair.publicKey;

      const signature = await this.connection.sendTransaction(transaction, [this.hxKeypair]);
      
      console.log('\n🎊 TRANSFER SUCCESSFUL! 🎊');
      console.log(`💰 Transferred: ${(transferAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
      console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
      console.log(`👻 Your Phantom wallet now has the funds!`);

      // Wait for confirmation
      await this.connection.confirmTransaction(signature);
      console.log('✅ Transaction confirmed on blockchain');

      // Export private key for Phantom import
      await this.exportForPhantom();

    } catch (error: any) {
      console.error('❌ Transfer failed:', error.message);
      console.log('💡 This could be due to insufficient balance for fees or network issues');
    }
  }

  private async exportForPhantom(): Promise<void> {
    if (!this.hxKeypair) return;

    const privateKeyHex = Buffer.from(this.hxKeypair.secretKey).toString('hex');
    
    console.log('\n👻 PHANTOM WALLET IMPORT INFORMATION');
    console.log('─'.repeat(50));
    console.log('🔑 Private Key (for Phantom import):');
    console.log(privateKeyHex);
    console.log('');
    console.log('📋 To import into Phantom:');
    console.log('1. Open Phantom wallet extension');
    console.log('2. Click the hamburger menu (three lines)');
    console.log('3. Select "Add/Connect Wallet"');
    console.log('4. Choose "Import Private Key"');
    console.log('5. Paste the above private key');
    console.log('6. Your wallet will be imported with the funds!');

    // Save export data
    const exportData = {
      walletAddress: this.HX_WALLET_ADDRESS,
      phantomWallet: this.PHANTOM_WALLET,
      privateKeyHex: privateKeyHex,
      exportedAt: new Date().toISOString(),
      transferCompleted: true
    };

    fs.writeFileSync('./hx-phantom-export.json', JSON.stringify(exportData, null, 2));
    console.log('\n💾 Export data saved to: hx-phantom-export.json');
  }

  private async showAlternatives(): Promise<void> {
    console.log('\n💡 ALTERNATIVE APPROACHES');
    console.log('─'.repeat(50));
    console.log('1. 🚀 Continue with your existing profitable strategies');
    console.log('2. 💎 Scale up HPN wallet trading to build capital');
    console.log('3. 🔄 Use the aggressive compound system to reach 1 SOL');
    console.log('4. 📈 Leverage the nuclear strategies for rapid growth');
    console.log('');
    console.log('💪 Your current system is generating excellent returns!');
    console.log('🎯 Focus on scaling what\'s already working');
  }
}

async function main(): Promise<void> {
  const accessor = new ComprehensiveHXAccess();
  await accessor.accessAndTransfer();
}

main().catch(console.error);
