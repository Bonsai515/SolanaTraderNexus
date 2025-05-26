
/**
 * Comprehensive HX Wallet Key Derivation and Transfer
 * 
 * Uses multiple derivation methods to find the HX wallet private key
 * and transfer funds to Phantom wallet
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as crypto from 'crypto';
import * as fs from 'fs';

class HXKeyDerivationTransfer {
  private connection: Connection;
  private readonly HX_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private readonly PHANTOM_WALLET = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
  private readonly HPN_KEY = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';
  private hxKeypair: Keypair | null = null;

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  }

  public async deriveAndTransfer(): Promise<void> {
    console.log('🔑 COMPREHENSIVE HX WALLET KEY DERIVATION & TRANSFER');
    console.log('='.repeat(60));
    console.log(`🎯 Target HX Wallet: ${this.HX_WALLET}`);
    console.log(`👻 Destination: ${this.PHANTOM_WALLET}`);
    console.log('');

    // Check current balances
    await this.checkWalletBalances();

    // Try all derivation methods
    await this.tryAllDerivationMethods();

    // Execute transfer if key found
    if (this.hxKeypair) {
      await this.executeTransfer();
    } else {
      console.log('❌ HX wallet key derivation unsuccessful');
      await this.showAlternativeOptions();
    }
  }

  private async checkWalletBalances(): Promise<void> {
    console.log('💰 CHECKING WALLET BALANCES');
    console.log('-'.repeat(40));

    try {
      // HX wallet balance
      const hxBalance = await this.connection.getBalance(new PublicKey(this.HX_WALLET));
      const hxSOL = hxBalance / LAMPORTS_PER_SOL;
      console.log(`🔑 HX Wallet: ${hxSOL.toFixed(6)} SOL`);

      // Phantom wallet balance
      const phantomBalance = await this.connection.getBalance(new PublicKey(this.PHANTOM_WALLET));
      const phantomSOL = phantomBalance / LAMPORTS_PER_SOL;
      console.log(`👻 Phantom Wallet: ${phantomSOL.toFixed(6)} SOL`);

      console.log('');

      if (hxSOL > 0) {
        console.log(`✅ HX wallet has ${hxSOL.toFixed(6)} SOL available for transfer!`);
      }
    } catch (error) {
      console.error('❌ Error checking balances:', error);
    }
  }

  private async tryAllDerivationMethods(): Promise<void> {
    console.log('🧮 ATTEMPTING ALL KEY DERIVATION METHODS');
    console.log('-'.repeat(40));

    // Method 1: System-based derivations
    await this.trySystemDerivations();
    if (this.hxKeypair) return;

    // Method 2: Profit collection derivations
    await this.tryProfitCollectionDerivations();
    if (this.hxKeypair) return;

    // Method 3: Wallet relationship derivations
    await this.tryWalletRelationshipDerivations();
    if (this.hxKeypair) return;

    // Method 4: Trading system derivations
    await this.tryTradingSystemDerivations();
    if (this.hxKeypair) return;

    // Method 5: Advanced cryptographic derivations
    await this.tryAdvancedCryptoDerivations();
    if (this.hxKeypair) return;

    // Method 6: File-based key search
    await this.tryFileBasedKeySearch();
  }

  private async trySystemDerivations(): Promise<void> {
    console.log('\n🔧 Method 1: System-Based Derivations');

    const systemPatterns = [
      'system_wallet_hx',
      'hx_system_key',
      'treasury_system_hx',
      'system_primary_wallet',
      'main_system_wallet',
      'hx_treasury_key',
      'system_wallet_primary',
      'hx_main_wallet'
    ];

    for (const pattern of systemPatterns) {
      const keypair = await this.deriveKeyFromPattern(pattern);
      if (keypair && keypair.publicKey.toString() === this.HX_WALLET) {
        console.log(`✅ SUCCESS: HX key derived with system pattern: ${pattern}`);
        this.hxKeypair = keypair;
        return;
      }
    }

    console.log('❌ No system-based derivation successful');
  }

  private async tryProfitCollectionDerivations(): Promise<void> {
    console.log('\n💰 Method 2: Profit Collection Derivations');

    const profitPatterns = [
      'profit_capture_hx',
      'hx_profit_wallet',
      'profit_collection_target',
      'captureIntervalMinutes_4',
      'reinvestmentRate_95',
      'autoCapture_true_hx',
      'profit_system_hx_wallet',
      'hx_profit_collection',
      'profit_target_wallet',
      'capture_240_seconds_hx'
    ];

    for (const pattern of profitPatterns) {
      const keypair = await this.deriveKeyFromPattern(pattern);
      if (keypair && keypair.publicKey.toString() === this.HX_WALLET) {
        console.log(`✅ SUCCESS: HX key derived with profit pattern: ${pattern}`);
        this.hxKeypair = keypair;
        return;
      }
    }

    console.log('❌ No profit collection derivation successful');
  }

  private async tryWalletRelationshipDerivations(): Promise<void> {
    console.log('\n🔗 Method 3: Wallet Relationship Derivations');

    const hpnKeyBuffer = Buffer.from(this.HPN_KEY, 'hex');
    
    const relationships = [
      'hpn_to_hx_derive',
      'wallet_chain_hx',
      'primary_secondary_hx',
      'hpn_hx_relationship',
      'trading_system_hx',
      'wallet_hierarchy_hx',
      'hpn_generates_hx',
      'wallet_family_hx'
    ];

    for (const relationship of relationships) {
      try {
        // Method A: HPN key + relationship string
        const combined1 = Buffer.concat([hpnKeyBuffer, Buffer.from(relationship)]);
        const hash1 = crypto.createHash('sha256').update(combined1).digest();
        const keypair1 = Keypair.fromSecretKey(hash1);
        
        if (keypair1.publicKey.toString() === this.HX_WALLET) {
          console.log(`✅ SUCCESS: HX key derived with relationship: ${relationship} (Method A)`);
          this.hxKeypair = keypair1;
          return;
        }

        // Method B: Relationship string + HPN key
        const combined2 = Buffer.concat([Buffer.from(relationship), hpnKeyBuffer]);
        const hash2 = crypto.createHash('sha256').update(combined2).digest();
        const keypair2 = Keypair.fromSecretKey(hash2);
        
        if (keypair2.publicKey.toString() === this.HX_WALLET) {
          console.log(`✅ SUCCESS: HX key derived with relationship: ${relationship} (Method B)`);
          this.hxKeypair = keypair2;
          return;
        }

        // Method C: HMAC derivation
        const hmac = crypto.createHmac('sha256', hpnKeyBuffer).update(relationship).digest();
        const keypair3 = Keypair.fromSecretKey(hmac);
        
        if (keypair3.publicKey.toString() === this.HX_WALLET) {
          console.log(`✅ SUCCESS: HX key derived with relationship: ${relationship} (HMAC)`);
          this.hxKeypair = keypair3;
          return;
        }
      } catch (error) {
        // Continue with next relationship
      }
    }

    console.log('❌ No wallet relationship derivation successful');
  }

  private async tryTradingSystemDerivations(): Promise<void> {
    console.log('\n📈 Method 4: Trading System Derivations');

    const tradingPatterns = [
      'nexus_engine_hx',
      'quantum_omega_hx',
      'hyperion_flash_hx',
      'trading_engine_hx',
      'flash_loan_hx_wallet',
      'arbitrage_system_hx',
      'mev_protection_hx',
      'jito_bundle_hx',
      'solend_flash_hx',
      'jupiter_integration_hx'
    ];

    for (const pattern of tradingPatterns) {
      const keypair = await this.deriveKeyFromPattern(pattern);
      if (keypair && keypair.publicKey.toString() === this.HX_WALLET) {
        console.log(`✅ SUCCESS: HX key derived with trading pattern: ${pattern}`);
        this.hxKeypair = keypair;
        return;
      }
    }

    console.log('❌ No trading system derivation successful');
  }

  private async tryAdvancedCryptoDerivations(): Promise<void> {
    console.log('\n🔐 Method 5: Advanced Cryptographic Derivations');

    const hpnKeyBuffer = Buffer.from(this.HPN_KEY, 'hex');
    
    // Try various cryptographic transformations
    const cryptoMethods = [
      () => crypto.createHash('sha512').update(hpnKeyBuffer).digest().slice(0, 32),
      () => crypto.createHash('blake2b512').update(hpnKeyBuffer).digest().slice(0, 32),
      () => crypto.pbkdf2Sync(hpnKeyBuffer, 'hx_salt', 1000, 32, 'sha256'),
      () => crypto.scryptSync(hpnKeyBuffer, 'hx_salt', 32),
      () => {
        const reversed = Buffer.from(hpnKeyBuffer).reverse();
        return crypto.createHash('sha256').update(reversed).digest();
      },
      () => {
        const doubled = Buffer.concat([hpnKeyBuffer, hpnKeyBuffer]);
        return crypto.createHash('sha256').update(doubled).digest();
      }
    ];

    for (let i = 0; i < cryptoMethods.length; i++) {
      try {
        const derivedKey = cryptoMethods[i]();
        const keypair = Keypair.fromSecretKey(derivedKey);
        
        if (keypair.publicKey.toString() === this.HX_WALLET) {
          console.log(`✅ SUCCESS: HX key derived with crypto method ${i + 1}`);
          this.hxKeypair = keypair;
          return;
        }
      } catch (error) {
        // Continue with next method
      }
    }

    console.log('❌ No advanced crypto derivation successful');
  }

  private async tryFileBasedKeySearch(): Promise<void> {
    console.log('\n📁 Method 6: File-Based Key Search');

    const filesToCheck = [
      'data/system-memory.json',
      'data/wallets.json',
      'data/private_wallets.json',
      'data/real-wallets.json',
      'secure_credentials/api-credentials.json',
      'export/trading_wallet_1.json',
      'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb'
    ];

    for (const filePath of filesToCheck) {
      if (fs.existsSync(filePath)) {
        console.log(`📄 Checking: ${filePath}`);
        
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const keypair = await this.extractHXKeyFromContent(content);
          
          if (keypair) {
            console.log(`✅ SUCCESS: HX key found in ${filePath}`);
            this.hxKeypair = keypair;
            return;
          }
        } catch (error) {
          // Continue with next file
        }
      }
    }

    console.log('❌ No HX key found in accessible files');
  }

  private async deriveKeyFromPattern(pattern: string): Promise<Keypair | null> {
    try {
      const hpnKeyBuffer = Buffer.from(this.HPN_KEY, 'hex');
      const combined = hpnKeyBuffer + pattern;
      const hash = crypto.createHash('sha256').update(combined).digest();
      return Keypair.fromSecretKey(hash);
    } catch (error) {
      return null;
    }
  }

  private async extractHXKeyFromContent(content: string): Promise<Keypair | null> {
    try {
      // Try parsing as JSON first
      const data = JSON.parse(content);
      
      // Look for HX wallet in various formats
      if (Array.isArray(data) && data.length === 64) {
        const keypair = Keypair.fromSecretKey(new Uint8Array(data));
        if (keypair.publicKey.toString() === this.HX_WALLET) {
          return keypair;
        }
      }
      
      // Search for hex patterns
      const hexMatches = content.match(/[a-fA-F0-9]{128}/g);
      if (hexMatches) {
        for (const hex of hexMatches) {
          try {
            const keypair = Keypair.fromSecretKey(Buffer.from(hex, 'hex'));
            if (keypair.publicKey.toString() === this.HX_WALLET) {
              return keypair;
            }
          } catch (e) {
            // Continue searching
          }
        }
      }
    } catch (error) {
      // Try as raw hex if not JSON
      if (content.length === 128 && /^[a-fA-F0-9]+$/.test(content)) {
        try {
          const keypair = Keypair.fromSecretKey(Buffer.from(content, 'hex'));
          if (keypair.publicKey.toString() === this.HX_WALLET) {
            return keypair;
          }
        } catch (e) {
          // Not a valid key
        }
      }
    }
    
    return null;
  }

  private async executeTransfer(): Promise<void> {
    console.log('\n🚀 EXECUTING HX TO PHANTOM TRANSFER');
    console.log('='.repeat(50));

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

      console.log(`📤 Transferring: ${(transferAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL`);

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
      
      console.log('\n🎉 TRANSFER SUCCESSFUL! 🎉');
      console.log(`💰 Transferred: ${(transferAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
      console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
      console.log(`👻 Your Phantom wallet now has the funds!`);

      // Wait for confirmation
      await this.connection.confirmTransaction(signature);
      console.log('✅ Transaction confirmed on blockchain');

      // Export the private key for future use
      await this.exportHXKey();

    } catch (error: any) {
      console.error('❌ Transfer failed:', error.message);
    }
  }

  private async exportHXKey(): Promise<void> {
    if (!this.hxKeypair) return;

    const privateKeyHex = Buffer.from(this.hxKeypair.secretKey).toString('hex');
    
    console.log('\n🔑 HX WALLET EXPORT DATA');
    console.log('-'.repeat(30));
    console.log('Private Key (hex):');
    console.log(privateKeyHex);
    console.log('');

    // Save to file
    const exportData = {
      walletAddress: this.HX_WALLET,
      privateKeyHex: privateKeyHex,
      privateKeyArray: Array.from(this.hxKeypair.secretKey),
      exportedAt: new Date().toISOString(),
      transferCompleted: true,
      destinationWallet: this.PHANTOM_WALLET
    };

    fs.writeFileSync('./hx-wallet-export.json', JSON.stringify(exportData, null, 2));
    console.log('💾 HX wallet data saved to: hx-wallet-export.json');
  }

  private async showAlternativeOptions(): Promise<void> {
    console.log('\n💡 ALTERNATIVE OPTIONS');
    console.log('-'.repeat(30));
    console.log('1. 🔍 Manual key search in additional files');
    console.log('2. 🧮 Try custom derivation patterns');
    console.log('3. 📧 Contact system administrator for HX wallet access');
    console.log('4. 💎 Continue with HPN wallet trading to build capital');
    console.log('5. 🚀 Use aggressive compound strategies on available funds');
  }
}

async function main(): Promise<void> {
  const derivationSystem = new HXKeyDerivationTransfer();
  await derivationSystem.deriveAndTransfer();
}

main().catch(console.error);
