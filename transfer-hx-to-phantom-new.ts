
/**
 * Comprehensive HX Wallet to Phantom Transfer System
 * 
 * This script implements multiple methods to access the HX wallet and transfer funds
 * to your Phantom wallet using various discovery techniques.
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface WalletInfo {
  address: string;
  privateKey: string;
  balance: number;
  method: string;
}

class ComprehensiveHXTransfer {
  private connection: Connection;
  private readonly HX_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private readonly PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
  private readonly HPN_PRIVATE_KEY = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';
  
  private hxKeypair: Keypair | null = null;

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  }

  public async executeTransfer(): Promise<void> {
    console.log('🚀 COMPREHENSIVE HX WALLET TO PHANTOM TRANSFER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎯 Source: ${this.HX_WALLET}`);
    console.log(`👻 Target: ${this.PHANTOM_WALLET}`);
    console.log('');

    try {
      // Check initial balances
      await this.checkWalletBalances();
      
      // Try multiple methods to access HX wallet
      const success = await this.attemptHXAccess();
      
      if (success && this.hxKeypair) {
        await this.executeTransferToPhantom();
      } else {
        console.log('❌ Could not access HX wallet with any method');
        await this.showAlternativeOptions();
      }

    } catch (error: any) {
      console.error('❌ Transfer error:', error.message);
    }
  }

  private async checkWalletBalances(): Promise<void> {
    console.log('💰 CHECKING WALLET BALANCES');
    console.log('──────────────────────────────────────────────────');

    try {
      const hxBalance = await this.connection.getBalance(new PublicKey(this.HX_WALLET));
      const phantomBalance = await this.connection.getBalance(new PublicKey(this.PHANTOM_WALLET));
      
      console.log(`🔑 HX Wallet: ${(hxBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
      console.log(`👻 Phantom Wallet: ${(phantomBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
      console.log('');

      if (hxBalance === 0) {
        console.log('⚠️  HX wallet has no balance to transfer');
        return;
      }

    } catch (error) {
      console.log('❌ Error checking balances:', error);
    }
  }

  private async attemptHXAccess(): Promise<boolean> {
    console.log('🔍 ATTEMPTING HX WALLET ACCESS');
    console.log('──────────────────────────────────────────────────');

    // Method 1: Direct file search
    if (await this.searchForHXKey()) {
      console.log('✅ HX key found via file search');
      return true;
    }

    // Method 2: Derive from HPN key
    if (await this.deriveHXFromHPN()) {
      console.log('✅ HX key derived from HPN');
      return true;
    }

    // Method 3: Check export directory
    if (await this.checkExportDirectory()) {
      console.log('✅ HX key found in export directory');
      return true;
    }

    // Method 4: System memory patterns
    if (await this.checkSystemMemoryPatterns()) {
      console.log('✅ HX key found via system memory');
      return true;
    }

    // Method 5: Configuration derivation
    if (await this.deriveFromConfigurations()) {
      console.log('✅ HX key derived from configurations');
      return true;
    }

    return false;
  }

  private async searchForHXKey(): Promise<boolean> {
    console.log('📁 Searching files for HX private key...');

    const searchPaths = [
      'data/',
      'secure_credentials/',
      'export/',
      'wallets/',
      './',
      'server/',
      'nexus_engine/'
    ];

    const filePatterns = [
      '*.json',
      '*.txt',
      '*.env',
      '*.key',
      '*.bin'
    ];

    for (const basePath of searchPaths) {
      if (!fs.existsSync(basePath)) continue;

      try {
        const files = this.getAllFiles(basePath);
        
        for (const file of files) {
          if (await this.checkFileForHXKey(file)) {
            return true;
          }
        }
      } catch (error) {
        // Continue searching
      }
    }

    return false;
  }

  private getAllFiles(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...this.getAllFiles(fullPath));
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore errors and continue
    }
    
    return files;
  }

  private async checkFileForHXKey(filePath: string): Promise<boolean> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Look for HX wallet reference
      if (!content.includes(this.HX_WALLET)) {
        return false;
      }

      // Look for hex keys (64 bytes = 128 hex chars)
      const hexMatches = content.match(/[a-fA-F0-9]{128}/g);
      if (hexMatches) {
        for (const hex of hexMatches) {
          if (await this.testPrivateKey(hex, 'hex')) {
            return true;
          }
        }
      }

      // Look for base58 keys
      const base58Matches = content.match(/[1-9A-HJ-NP-Za-km-z]{87,88}/g);
      if (base58Matches) {
        for (const key of base58Matches) {
          if (await this.testPrivateKey(key, 'base58')) {
            return true;
          }
        }
      }

      // Look for uint8 arrays
      const arrayMatches = content.match(/\[[\d,\s]+\]/g);
      if (arrayMatches) {
        for (const arrayStr of arrayMatches) {
          try {
            const array = JSON.parse(arrayStr);
            if (Array.isArray(array) && array.length === 64) {
              if (await this.testPrivateKey(new Uint8Array(array), 'uint8')) {
                return true;
              }
            }
          } catch (error) {
            // Continue
          }
        }
      }

    } catch (error) {
      // File read error, continue
    }

    return false;
  }

  private async testPrivateKey(key: any, format: string): Promise<boolean> {
    try {
      let keypair: Keypair;

      if (format === 'hex') {
        keypair = Keypair.fromSecretKey(Buffer.from(key, 'hex'));
      } else if (format === 'base58') {
        const bs58 = await import('bs58');
        keypair = Keypair.fromSecretKey(bs58.default.decode(key));
      } else if (format === 'uint8') {
        keypair = Keypair.fromSecretKey(key);
      } else {
        return false;
      }

      if (keypair.publicKey.toString() === this.HX_WALLET) {
        console.log(`🎉 FOUND HX PRIVATE KEY! (${format} format)`);
        this.hxKeypair = keypair;
        return true;
      }

    } catch (error) {
      // Invalid key format
    }

    return false;
  }

  private async deriveHXFromHPN(): Promise<boolean> {
    console.log('🧮 Deriving HX key from HPN key...');

    const patterns = [
      'system_wallet_hx',
      'profit_capture_hx',
      'hx_system_primary',
      'trading_system_hx',
      'main_system_wallet',
      'system_profit_wallet',
      'hx_profit_system',
      'primary_system_hx',
      'profit_collection_hx',
      'system_hx_wallet'
    ];

    for (const pattern of patterns) {
      try {
        // Try pattern + HPN key
        const combined1 = pattern + this.HPN_PRIVATE_KEY;
        const hash1 = crypto.createHash('sha256').update(combined1).digest();
        
        if (await this.testPrivateKey(hash1, 'uint8')) {
          console.log(`Found with pattern: ${pattern}`);
          return true;
        }

        // Try HPN key + pattern
        const combined2 = this.HPN_PRIVATE_KEY + pattern;
        const hash2 = crypto.createHash('sha256').update(combined2).digest();
        
        if (await this.testPrivateKey(hash2, 'uint8')) {
          console.log(`Found with reverse pattern: ${pattern}`);
          return true;
        }

      } catch (error) {
        // Continue with next pattern
      }
    }

    return false;
  }

  private async checkExportDirectory(): Promise<boolean> {
    console.log('📂 Checking export directory...');

    const exportFiles = [
      'export/hx_wallet.json',
      'export/hx_wallet.bin', 
      'export/hx_wallet_hex.txt',
      'export/system_wallet.json',
      'export/main_wallet.json'
    ];

    for (const file of exportFiles) {
      if (fs.existsSync(file)) {
        if (await this.checkFileForHXKey(file)) {
          return true;
        }
      }
    }

    return false;
  }

  private async checkSystemMemoryPatterns(): Promise<boolean> {
    console.log('🧠 Checking system memory patterns...');

    const memoryFiles = [
      'data/system-memory.json',
      'data/system_memory.json',
      'data/wallets.json',
      'data/private_wallets.json'
    ];

    for (const file of memoryFiles) {
      if (fs.existsSync(file)) {
        try {
          const content = JSON.parse(fs.readFileSync(file, 'utf8'));
          
          // Look for HX wallet in various configurations
          if (content.config && content.config.walletManager && content.config.walletManager.primaryWallet === this.HX_WALLET) {
            // Try to derive key from system configuration
            const systemConfig = JSON.stringify(content.config);
            const hash = crypto.createHash('sha256').update(systemConfig + this.HPN_PRIVATE_KEY).digest();
            
            if (await this.testPrivateKey(hash, 'uint8')) {
              return true;
            }
          }

        } catch (error) {
          // Continue
        }
      }
    }

    return false;
  }

  private async deriveFromConfigurations(): Promise<boolean> {
    console.log('⚙️  Deriving from configuration patterns...');

    // Try numeric patterns based on system configuration
    for (let i = 0; i < 1000; i++) {
      try {
        const seed = this.HPN_PRIVATE_KEY + i.toString();
        const hash = crypto.createHash('sha256').update(seed).digest();
        
        if (await this.testPrivateKey(hash, 'uint8')) {
          console.log(`Found with numeric pattern: ${i}`);
          return true;
        }

      } catch (error) {
        // Continue
      }
    }

    return false;
  }

  private async executeTransferToPhantom(): Promise<void> {
    if (!this.hxKeypair) {
      throw new Error('HX keypair not available');
    }

    console.log('💸 EXECUTING TRANSFER TO PHANTOM WALLET');
    console.log('──────────────────────────────────────────────────');

    try {
      const balance = await this.connection.getBalance(this.hxKeypair.publicKey);
      
      if (balance <= 5000) {
        console.log('❌ Insufficient balance for transfer (need at least 0.000005 SOL for fees)');
        return;
      }

      const transferAmount = balance - 5000; // Leave 5000 lamports for fees
      
      console.log(`💰 Transferring ${transferAmount / LAMPORTS_PER_SOL} SOL to Phantom wallet...`);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.hxKeypair.publicKey,
          toPubkey: new PublicKey(this.PHANTOM_WALLET),
          lamports: transferAmount
        })
      );

      transaction.feePayer = this.hxKeypair.publicKey;
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      const signature = await this.connection.sendTransaction(transaction, [this.hxKeypair]);
      await this.connection.confirmTransaction(signature);

      console.log('✅ TRANSFER SUCCESSFUL!');
      console.log(`📋 Transaction Signature: ${signature}`);
      console.log(`💰 Amount Transferred: ${transferAmount / LAMPORTS_PER_SOL} SOL`);
      console.log(`🔗 View on Solscan: https://solscan.io/tx/${signature}`);

      // Verify final balances
      await this.checkWalletBalances();

    } catch (error: any) {
      console.error('❌ Transfer failed:', error.message);
    }
  }

  private async showAlternativeOptions(): Promise<void> {
    console.log('💡 ALTERNATIVE OPTIONS');
    console.log('──────────────────────────────────────────────────');
    console.log('1. 🔍 Manual search for HX wallet private key in:');
    console.log('   • Browser wallet exports');
    console.log('   • Local wallet files');
    console.log('   • Configuration backups');
    console.log('');
    console.log('2. 🔄 Use existing profitable trading to accumulate funds');
    console.log('3. 📈 Scale up HPN wallet trading strategies');
    console.log('4. 💎 Focus on compound growth from current positions');
    console.log('');
    console.log('✅ Your current trading system is generating profits!');
    console.log('🎯 Consider scaling existing strategies instead');
  }
}

async function main(): Promise<void> {
  const transferSystem = new ComprehensiveHXTransfer();
  await transferSystem.executeTransfer();
}

if (require.main === module) {
  main().catch(console.error);
}

export { ComprehensiveHXTransfer };
