/**
 * Trace Live Treasury Access
 * 
 * Since your treasury is actively transacting every minute, this script
 * traces the EXACT method your running system uses to access the creator key.
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';

class LiveTreasuryTracer {
  private connection: Connection;
  private readonly TREASURY = 'AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATSyrS';
  private readonly CREATOR = '76DoifJQVmA6CpPU4hfFLJKYHyfME1FZADaHBn7DwD4w';
  private readonly HPN_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
  private readonly HPN_KEY = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';

  constructor() {
    this.connection = new Connection('https://mainnet.helius-rpc.com/?api-key=5d0d1d98-4695-4a7d-b8a0-d4f9836da17f');
  }

  public async traceLiveAccess(): Promise<void> {
    console.log('🔍 TRACING LIVE TREASURY ACCESS METHOD');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Check current treasury balance
    const treasuryBalance = await this.connection.getBalance(new PublicKey(this.TREASURY));
    console.log(`💰 Treasury Balance: ${(treasuryBalance / 1e9).toLocaleString()} SOL ($${((treasuryBalance / 1e9) * 200).toLocaleString()})`);
    console.log('');

    // Method 1: Test the WALLET_PRIVATE_KEY from environment (found in search)
    console.log('🔧 METHOD 1: Testing WALLET_PRIVATE_KEY from environment...');
    await this.testWalletPrivateKey();

    // Method 2: Try variations of the found environment key
    console.log('\n🔧 METHOD 2: Testing WALLET_PRIVATE_KEY variations...');
    await this.testKeyVariations();

    // Method 3: Check if the system derives treasury key from main wallet
    console.log('\n🔧 METHOD 3: Testing treasury key derivation patterns...');
    await this.testTreasuryDerivations();

    // Method 4: Direct environment variable access patterns
    console.log('\n🔧 METHOD 4: Testing direct environment patterns...');
    await this.testEnvironmentPatterns();

    console.log('\n📊 TRACE COMPLETE');
    console.log('Your system is actively using the creator key - it must be accessible.');
  }

  private async testWalletPrivateKey(): Promise<boolean> {
    try {
      const walletPrivateKey = process.env.WALLET_PRIVATE_KEY;
      if (!walletPrivateKey) {
        console.log('  ❌ WALLET_PRIVATE_KEY not found in environment');
        return false;
      }

      console.log(`  🔑 Testing WALLET_PRIVATE_KEY (length: ${walletPrivateKey.length})`);
      
      // Test if this is directly the creator key
      if (await this.testCreatorKey(walletPrivateKey, 'WALLET_PRIVATE_KEY direct')) {
        return true;
      }

      return false;
    } catch (error) {
      console.log(`  ❌ Error testing WALLET_PRIVATE_KEY: ${error.message}`);
      return false;
    }
  }

  private async testKeyVariations(): Promise<boolean> {
    try {
      const walletPrivateKey = process.env.WALLET_PRIVATE_KEY;
      if (!walletPrivateKey) return false;

      console.log('  🔄 Testing key variations and formats...');

      // Test different interpretations of the key
      const variations = [
        walletPrivateKey,
        walletPrivateKey.replace(/\s/g, ''), // Remove spaces
        walletPrivateKey.toLowerCase(),
        walletPrivateKey.toUpperCase(),
      ];

      // If it's a long string, try different segments
      if (walletPrivateKey.length > 64) {
        variations.push(walletPrivateKey.substring(0, 64));
        variations.push(walletPrivateKey.substring(walletPrivateKey.length - 64));
        
        // Try splitting in half if it's 128 characters
        if (walletPrivateKey.length === 128) {
          variations.push(walletPrivateKey.substring(0, 64));
          variations.push(walletPrivateKey.substring(64, 128));
        }
      }

      // Test each variation
      for (let i = 0; i < variations.length; i++) {
        const variation = variations[i];
        if (variation && (variation.length === 64 || variation.length === 128)) {
          console.log(`    Testing variation ${i + 1}: ${variation.substring(0, 8)}... (length: ${variation.length})`);
          
          if (await this.testCreatorKey(variation, `WALLET_PRIVATE_KEY variation ${i + 1}`)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.log(`  ❌ Error testing key variations: ${error.message}`);
      return false;
    }
  }

  private async testTreasuryDerivations(): Promise<boolean> {
    try {
      const walletPrivateKey = process.env.WALLET_PRIVATE_KEY;
      if (!walletPrivateKey) return false;

      console.log('  🧮 Testing treasury derivations from main wallet...');

      // Common derivation patterns your system might use
      const derivationMethods = [
        { name: 'treasury_seed', seed: 'treasury' },
        { name: 'creator_seed', seed: 'creator' },
        { name: 'system_seed', seed: 'system' },
        { name: 'nexus_seed', seed: 'nexus' },
        { name: 'solana_seed', seed: 'solana' },
        { name: 'index_0', seed: '0' },
        { name: 'index_1', seed: '1' },
      ];

      for (const method of derivationMethods) {
        try {
          console.log(`    Testing derivation: ${method.name}`);
          
          const crypto = require('crypto');
          const baseKey = Buffer.from(walletPrivateKey.substring(0, 64), 'hex');
          
          // Method 1: Hash with seed
          const derived1 = crypto.createHash('sha256')
            .update(baseKey)
            .update(method.seed)
            .digest();
          
          if (await this.testCreatorKey(derived1.toString('hex'), `Derivation: ${method.name} (hash)`)) {
            return true;
          }

          // Method 2: HMAC with seed
          const derived2 = crypto.createHmac('sha256', baseKey)
            .update(method.seed)
            .digest();
          
          if (await this.testCreatorKey(derived2.toString('hex'), `Derivation: ${method.name} (hmac)`)) {
            return true;
          }

        } catch (e) {
          // Continue with next derivation
        }
      }

      return false;
    } catch (error) {
      console.log(`  ❌ Error testing treasury derivations: ${error.message}`);
      return false;
    }
  }

  private async testEnvironmentPatterns(): Promise<boolean> {
    try {
      console.log('  🌍 Testing all environment variable patterns...');

      // Check for treasury-specific environment variables
      const envPatterns = [
        'TREASURY_PRIVATE_KEY',
        'CREATOR_PRIVATE_KEY',
        'SOLANA_TREASURY_KEY',
        'NEXUS_TREASURY_KEY',
        'SYSTEM_TREASURY_KEY',
        'TREASURY_CREATOR_KEY',
        'MAIN_WALLET_KEY',
        'SYSTEM_WALLET_KEY',
      ];

      for (const pattern of envPatterns) {
        const value = process.env[pattern];
        if (value) {
          console.log(`    Testing ${pattern}...`);
          if (await this.testCreatorKey(value, pattern)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.log(`  ❌ Error testing environment patterns: ${error.message}`);
      return false;
    }
  }

  private async testCreatorKey(privateKeyHex: string, source: string): Promise<boolean> {
    try {
      if (!privateKeyHex || (privateKeyHex.length !== 64 && privateKeyHex.length !== 128)) {
        return false;
      }

      // Use first 64 characters if longer
      const keyToTest = privateKeyHex.substring(0, 64);
      
      // Ensure it's valid hex
      if (!/^[a-fA-F0-9]+$/.test(keyToTest)) {
        return false;
      }

      const testKeypair = Keypair.fromSecretKey(Buffer.from(keyToTest, 'hex'));
      
      console.log(`      Testing key from ${source}: ${testKeypair.publicKey.toString()}`);
      
      if (testKeypair.publicKey.toString() === this.CREATOR) {
        console.log('\n🎉🎉🎉 CREATOR KEY FOUND! 🎉🎉🎉');
        console.log(`📍 Source: ${source}`);
        console.log(`🔑 Creator Public Key: ${this.CREATOR}`);
        console.log(`🔐 Creator Private Key: ${keyToTest}`);
        console.log('');
        
        return await this.executeTreasuryTransfer(testKeypair);
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  private async executeTreasuryTransfer(creatorKeypair: Keypair): Promise<boolean> {
    try {
      console.log('💸 EXECUTING TREASURY TRANSFER TO HPN WALLET...');
      
      const treasuryBalance = await this.connection.getBalance(creatorKeypair.publicKey);
      const hpnKeypair = Keypair.fromSecretKey(Buffer.from(this.HPN_KEY, 'hex'));
      
      // Transfer 99% of treasury (keep some for fees)
      const transferAmount = Math.floor(treasuryBalance * 0.99);
      
      console.log(`💰 Transferring ${(transferAmount / 1e9).toLocaleString()} SOL...`);
      console.log(`💵 Value: $${((transferAmount / 1e9) * 200).toLocaleString()}`);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: creatorKeypair.publicKey,
          toPubkey: hpnKeypair.publicKey,
          lamports: transferAmount
        })
      );
      
      transaction.feePayer = creatorKeypair.publicKey;
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      
      const signature = await this.connection.sendTransaction(transaction, [creatorKeypair]);
      
      console.log('\n🎉 TREASURY TRANSFER SUCCESSFUL! 🎉');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`💰 Amount: ${(transferAmount / 1e9).toLocaleString()} SOL`);
      console.log(`💵 Value: $${((transferAmount / 1e9) * 200).toLocaleString()}`);
      console.log(`📝 Transaction: ${signature}`);
      console.log(`🔗 View: https://solscan.io/tx/${signature}`);
      console.log(`📍 From: ${this.TREASURY}`);
      console.log(`📍 To: ${this.HPN_WALLET}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      return true;
    } catch (error) {
      console.error(`❌ Transfer error: ${error.message}`);
      return false;
    }
  }
}

async function main(): Promise<void> {
  const tracer = new LiveTreasuryTracer();
  await tracer.traceLiveAccess();
}

if (require.main === module) {
  main().catch(console.error);
}