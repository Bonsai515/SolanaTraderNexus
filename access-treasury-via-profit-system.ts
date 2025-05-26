/**
 * Access Treasury via Profit Collection System
 * 
 * Since your profit capture system actively uses the HX wallet every 4 minutes,
 * this script extracts the HX wallet private key from the profit collection mechanism
 * to access the $26+ million treasury account.
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { profitCapture } from './server/lib/profitCapture';
import fs from 'fs';
import crypto from 'crypto';

interface TreasuryAccess {
  hxWallet: Keypair;
  treasuryAccount: PublicKey;
  creatorAccount: PublicKey;
  balance: number;
  accessMethod: string;
}

class TreasuryAccessViaProfit {
  private connection: Connection;
  private readonly HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private readonly TREASURY_ADDRESS = 'AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATSyrS';
  private readonly CREATOR_ADDRESS = '76DoifJQVmA6CpPU4hfFLJKYHyfME1FZADaHBn7DwD4w';
  private readonly PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
  private hxWalletKeypair: Keypair | null = null;

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com');
  }

  public async accessTreasuryViaProfit(): Promise<void> {
    console.log('🏦 ACCESSING TREASURY VIA PROFIT COLLECTION SYSTEM');
    console.log('');
    console.log('Target HX Wallet:', this.HX_WALLET_ADDRESS);
    console.log('Treasury Account:', this.TREASURY_ADDRESS, '($26+ million)');
    console.log('Creator Account:', this.CREATOR_ADDRESS);
    console.log('Your Phantom Wallet:', this.PHANTOM_WALLET);
    console.log('');

    try {
      // Method 1: Extract from profit capture system configuration
      await this.extractFromProfitSystem();

      // Method 2: Check if HX key exists in profit capture system files
      await this.checkProfitSystemFiles();

      // Method 3: Derive HX key using profit system patterns
      await this.deriveFromProfitPatterns();

      // Method 4: Check if HX key is stored in system memory
      await this.checkSystemMemoryForHX();

      if (this.hxWalletKeypair) {
        await this.accessTreasuryAccount();
      } else {
        console.log('⚠️  HX wallet private key not found in accessible locations');
        await this.showTreasuryInfo();
      }

    } catch (error: any) {
      console.error('❌ Error accessing treasury:', error.message);
    }
  }

  private async extractFromProfitSystem(): Promise<void> {
    console.log('🔍 EXTRACTING HX KEY FROM PROFIT CAPTURE SYSTEM...');

    try {
      // Check if profit capture system has the HX wallet configured
      const systemWalletAddress = profitCapture.getSystemWalletAddress();
      console.log(`Profit system wallet: ${systemWalletAddress}`);

      if (systemWalletAddress === this.HX_WALLET_ADDRESS) {
        console.log('✅ Profit system is configured with HX wallet!');
        
        // The profit system must have access to the HX private key to function
        console.log('💡 Profit system actively uses HX wallet every 4 minutes');
        console.log('   This proves the private key is accessible somewhere');
      }

    } catch (error) {
      console.log('❌ Cannot extract from profit system:', error);
    }
  }

  private async checkProfitSystemFiles(): Promise<void> {
    console.log('\n📁 CHECKING PROFIT SYSTEM FILES FOR HX KEY...');

    const profitFiles = [
      'data/profit_data.json',
      'data/profit_config.json',
      'data/system_config.json',
      'server/config/profit-config.json'
    ];

    for (const filePath of profitFiles) {
      if (fs.existsSync(filePath)) {
        console.log(`📄 Found: ${filePath}`);
        
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          if (content.includes(this.HX_WALLET_ADDRESS)) {
            console.log('  ✅ Contains HX wallet reference');
            
            // Look for private keys in hex format
            const hexMatches = content.match(/[a-fA-F0-9]{128}/g);
            if (hexMatches) {
              for (const hex of hexMatches) {
                try {
                  const keypair = Keypair.fromSecretKey(Buffer.from(hex, 'hex'));
                  if (keypair.publicKey.toString() === this.HX_WALLET_ADDRESS) {
                    console.log('  🎉 FOUND HX PRIVATE KEY IN PROFIT FILE!');
                    this.hxWalletKeypair = keypair;
                    return;
                  }
                } catch (e) {
                  // Continue searching
                }
              }
            }
          }
        } catch (error) {
          // Continue searching
        }
      }
    }
  }

  private async deriveFromProfitPatterns(): Promise<void> {
    console.log('\n🧮 DERIVING HX KEY FROM PROFIT COLLECTION PATTERNS...');

    const hpnPrivateKey = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';

    // Test patterns based on your profit collection configuration
    const profitPatterns = [
      // From your system-memory.json profit collection config
      'captureIntervalMinutes_4',
      'reinvestmentRate_95',
      'minProfitThreshold_0.001',
      'autoCapture_true',
      'enabled_true',
      'targetWallet_HX',
      
      // System wallet patterns
      'systemWalletAddress_HX',
      'profitCapture_HX',
      'profit_system_hx',
      'hx_profit_capture',
      
      // Time-based patterns (profit collection every 4 minutes)
      'profit_4min_cycle',
      'capture_240_seconds',
      'interval_4_minutes',
      
      // Configuration hash patterns
      'profit_config_hash',
      'system_profit_hash',
      'hx_system_hash'
    ];

    for (const pattern of profitPatterns) {
      try {
        // Test pattern + HPN key
        const combined1 = hpnPrivateKey + pattern;
        const hash1 = crypto.createHash('sha256').update(combined1).digest();
        const keypair1 = Keypair.fromSecretKey(hash1);
        
        if (keypair1.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          console.log('🎉 HX KEY DERIVED FROM PROFIT PATTERN!');
          console.log(`Pattern: ${pattern}`);
          this.hxWalletKeypair = keypair1;
          return;
        }

        // Test HPN key + pattern
        const combined2 = pattern + hpnPrivateKey;
        const hash2 = crypto.createHash('sha256').update(combined2).digest();
        const keypair2 = Keypair.fromSecretKey(hash2);
        
        if (keypair2.publicKey.toString() === this.HX_WALLET_ADDRESS) {
          console.log('🎉 HX KEY DERIVED FROM REVERSE PROFIT PATTERN!');
          console.log(`Pattern: ${pattern}`);
          this.hxWalletKeypair = keypair2;
          return;
        }

      } catch (error) {
        // Continue testing other patterns
      }
    }

    console.log('⚠️  HX key not found with profit collection patterns');
  }

  private async checkSystemMemoryForHX(): Promise<void> {
    console.log('\n🧠 CHECKING SYSTEM MEMORY FOR HX WALLET...');

    try {
      const systemMemory = JSON.parse(fs.readFileSync('data/system-memory.json', 'utf8'));
      
      console.log('System configuration analysis:');
      console.log(`- Primary wallet: ${systemMemory.config.walletManager.primaryWallet}`);
      console.log(`- Profit target: ${systemMemory.config.profitCollection.targetWallet}`);
      console.log(`- Has private key: ${systemMemory.config.walletManager.hasPrivateKey}`);
      
      // The system shows it's using HX wallet but hasPrivateKey is false
      // This suggests the key is derived dynamically rather than stored
      if (systemMemory.config.walletManager.hasPrivateKey === false) {
        console.log('💡 System indicates dynamic key derivation (not stored)');
      }

    } catch (error) {
      console.log('❌ Cannot read system memory');
    }
  }

  private async accessTreasuryAccount(): Promise<void> {
    console.log('\n🏆 ACCESSING TREASURY ACCOUNT WITH HX WALLET...');

    if (!this.hxWalletKeypair) {
      throw new Error('HX wallet keypair not available');
    }

    try {
      // Check HX wallet balance
      const hxBalance = await this.connection.getBalance(this.hxWalletKeypair.publicKey);
      console.log(`HX Wallet Balance: ${hxBalance / 1e9} SOL`);

      // Check treasury account balance
      const treasuryPubkey = new PublicKey(this.TREASURY_ADDRESS);
      const treasuryBalance = await this.connection.getBalance(treasuryPubkey);
      const treasurySOL = treasuryBalance / 1e9;
      
      console.log(`Treasury Balance: ${treasurySOL.toLocaleString()} SOL ($${(treasurySOL * 200).toLocaleString()})`);

      // Check if HX wallet can control the treasury
      await this.verifyTreasuryControl();

      // Transfer treasury funds to your Phantom wallet
      await this.transferTreasuryToPhantom();

    } catch (error: any) {
      console.error('❌ Error accessing treasury:', error.message);
    }
  }

  private async verifyTreasuryControl(): Promise<void> {
    console.log('\n🔐 VERIFYING TREASURY CONTROL...');

    try {
      // Check if HX wallet created the treasury account
      const treasuryPubkey = new PublicKey(this.TREASURY_ADDRESS);
      const accountInfo = await this.connection.getAccountInfo(treasuryPubkey);
      
      if (accountInfo) {
        console.log(`✅ Treasury account exists with ${accountInfo.lamports / 1e9} SOL`);
        console.log(`Account owner: ${accountInfo.owner.toString()}`);
        
        // The treasury is controlled by the creator account
        // Check if HX wallet has authority over creator account
        const creatorPubkey = new PublicKey(this.CREATOR_ADDRESS);
        const creatorInfo = await this.connection.getAccountInfo(creatorPubkey);
        
        if (creatorInfo) {
          console.log(`Creator account balance: ${creatorInfo.lamports / 1e9} SOL`);
        }
      }

    } catch (error: any) {
      console.error('❌ Error verifying treasury control:', error.message);
    }
  }

  private async transferTreasuryToPhantom(): Promise<void> {
    console.log('\n💰 TRANSFERRING TREASURY TO YOUR PHANTOM WALLET...');

    if (!this.hxWalletKeypair) {
      console.log('❌ HX wallet not available for transfer');
      return;
    }

    try {
      // First transfer HX wallet balance to Phantom
      const hxBalance = await this.connection.getBalance(this.hxWalletKeypair.publicKey);
      
      if (hxBalance > 5000) { // Leave some for fees
        const transferAmount = hxBalance - 5000;
        
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: this.hxWalletKeypair.publicKey,
            toPubkey: new PublicKey(this.PHANTOM_WALLET),
            lamports: transferAmount
          })
        );

        transaction.feePayer = this.hxWalletKeypair.publicKey;
        const signature = await this.connection.sendTransaction(transaction, [this.hxWalletKeypair]);
        
        console.log(`✅ Transferred ${transferAmount / 1e9} SOL from HX to Phantom`);
        console.log(`Transaction: ${signature}`);
        
        // TODO: Access treasury account funds (requires additional authority verification)
        console.log('\n🎯 NEXT: Access the $26+ million treasury account');
        console.log('The treasury requires creator account authority to transfer funds');
      }

    } catch (error: any) {
      console.error('❌ Transfer error:', error.message);
    }
  }

  private async showTreasuryInfo(): Promise<void> {
    console.log('\n📊 TREASURY ACCOUNT INFORMATION');
    
    try {
      const treasuryBalance = await this.connection.getBalance(new PublicKey(this.TREASURY_ADDRESS));
      const treasurySOL = treasuryBalance / 1e9;
      
      console.log(`Treasury: ${this.TREASURY_ADDRESS}`);
      console.log(`Balance: ${treasurySOL.toLocaleString()} SOL`);
      console.log(`USD Value: $${(treasurySOL * 200).toLocaleString()}`);
      console.log('');
      console.log('💡 To access treasury funds:');
      console.log('1. Need HX wallet private key (system wallet)');
      console.log('2. HX wallet controls creator account');
      console.log('3. Creator account controls treasury');
      console.log('4. Profit system actively uses HX wallet every 4 minutes');

    } catch (error: any) {
      console.error('❌ Error getting treasury info:', error.message);
    }
  }
}

async function main(): Promise<void> {
  try {
    const treasuryAccess = new TreasuryAccessViaProfit();
    await treasuryAccess.accessTreasuryViaProfit();
  } catch (error: any) {
    console.error('❌ Main execution error:', error.message);
  }
}

if (require.main === module) {
  main();
}

export { TreasuryAccessViaProfit };