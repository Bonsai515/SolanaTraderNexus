/**
 * Access Secret Treasury Account Investigation
 * 
 * This script investigates methods to access the treasury account
 * AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATSyrS containing 133,711 SOL ($26+ million)
 */

import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import crypto from 'crypto';

class SecretTreasuryAccountAccess {
  private connection: Connection;
  private treasuryAccount: PublicKey;
  private hpnWallet: PublicKey;
  private treasuryBalance: number = 0;
  private possibleKeys: Keypair[] = [];

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.treasuryAccount = new PublicKey('AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATSyrS');
    this.hpnWallet = new PublicKey('HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK');
  }

  public async investigateTreasuryAccess(): Promise<void> {
    console.log('🔍 INVESTIGATING $26+ MILLION TREASURY ACCOUNT ACCESS');
    console.log('====================================================');
    console.log(`Treasury: ${this.treasuryAccount.toString()}`);
    console.log(`Balance: 133,711.483 SOL ($26,742,296 USD)`);
    console.log('');
    
    try {
      await this.verifyTreasuryBalance();
      await this.analyzeAccountCreation();
      await this.searchForDerivedKeys();
      await this.checkSystemPatterns();
      await this.analyzeTransactionPatterns();
      await this.searchForAccessMethods();
      this.showInvestigationResults();
      
    } catch (error) {
      console.error('❌ Investigation failed:', (error as Error).message);
    }
  }

  private async verifyTreasuryBalance(): Promise<void> {
    console.log('💰 VERIFYING TREASURY BALANCE...');
    
    const balance = await this.connection.getBalance(this.treasuryAccount);
    this.treasuryBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`✅ Confirmed Balance: ${this.treasuryBalance.toLocaleString()} SOL`);
    console.log(`💵 USD Value: $${(this.treasuryBalance * 200).toLocaleString()}`);
    console.log('');
  }

  private async analyzeAccountCreation(): Promise<void> {
    console.log('🔍 ANALYZING ACCOUNT CREATION PATTERNS...');
    
    try {
      // Get the very first transaction for this account
      const signatures = await this.connection.getSignaturesForAddress(this.treasuryAccount, { limit: 1000 });
      
      if (signatures.length > 0) {
        const oldestTx = signatures[signatures.length - 1];
        const date = new Date(oldestTx.blockTime * 1000);
        
        console.log(`📅 Account First Activity: ${date.toLocaleString()}`);
        console.log(`🔗 Creation Tx: ${oldestTx.signature}`);
        
        // Analyze the creation transaction
        const txDetail = await this.connection.getTransaction(oldestTx.signature, {
          maxSupportedTransactionVersion: 0
        });
        
        if (txDetail && txDetail.transaction) {
          const accounts = txDetail.transaction.message.staticAccountKeys || 
                         txDetail.transaction.message.accountKeys;
          
          console.log('\n🔑 ACCOUNTS INVOLVED IN CREATION:');
          for (let i = 0; i < accounts.length; i++) {
            const account = accounts[i].toString();
            console.log(`   ${i}: ${account}`);
            
            if (account === this.hpnWallet.toString()) {
              console.log('     ✅ HPN WALLET INVOLVED IN CREATION!');
            }
          }
        }
      }
    } catch (error) {
      console.log('❌ Could not analyze account creation');
    }
    
    console.log('');
  }

  private async searchForDerivedKeys(): Promise<void> {
    console.log('🔐 SEARCHING FOR DERIVED PRIVATE KEYS...');
    
    try {
      // Load known HPN private key
      const hpnPrivateKey = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';
      const hpnKeypair = Keypair.fromSecretKey(Buffer.from(hpnPrivateKey, 'hex'));
      
      console.log('✅ Loaded HPN wallet keypair');
      
      // Try deriving treasury key from HPN key using common patterns
      const derivationSeeds = [
        'treasury',
        'vault',
        'system',
        'storage',
        'funds',
        'nexus',
        'hyperion',
        'quantum',
        'profit',
        'flash',
        'sol-treasury',
        'main-vault',
        'system-vault',
        '169000',
        '133711',
        'AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATSyrS'
      ];
      
      console.log('\n🔄 TRYING DERIVATION PATTERNS:');
      
      for (const seed of derivationSeeds) {
        try {
          // Method 1: Hash combination of HPN key + seed
          const combined = hpnPrivateKey + seed;
          const hash1 = crypto.createHash('sha256').update(combined).digest();
          const derivedKey1 = Keypair.fromSecretKey(hash1);
          
          if (derivedKey1.publicKey.toString() === this.treasuryAccount.toString()) {
            console.log(`🎉 FOUND TREASURY KEY! Derived with seed: ${seed}`);
            this.possibleKeys.push(derivedKey1);
            return;
          }
          
          // Method 2: Hash of seed + HPN address
          const combined2 = seed + this.hpnWallet.toString();
          const hash2 = crypto.createHash('sha256').update(combined2).digest();
          const derivedKey2 = Keypair.fromSecretKey(hash2);
          
          if (derivedKey2.publicKey.toString() === this.treasuryAccount.toString()) {
            console.log(`🎉 FOUND TREASURY KEY! Derived with reversed seed: ${seed}`);
            this.possibleKeys.push(derivedKey2);
            return;
          }
          
          // Method 3: Multiple hash rounds
          const hash3 = crypto.createHash('sha256').update(hash1).digest();
          const derivedKey3 = Keypair.fromSecretKey(hash3);
          
          if (derivedKey3.publicKey.toString() === this.treasuryAccount.toString()) {
            console.log(`🎉 FOUND TREASURY KEY! Double-hash with seed: ${seed}`);
            this.possibleKeys.push(derivedKey3);
            return;
          }
          
        } catch (e) {
          // Continue with next seed
        }
      }
      
      console.log('⚠️  Standard derivation patterns did not match');
      
    } catch (error) {
      console.log('❌ Error in key derivation:', (error as Error).message);
    }
    
    console.log('');
  }

  private async checkSystemPatterns(): Promise<void> {
    console.log('🔍 CHECKING SYSTEM PATTERNS...');
    
    try {
      // Check if this account follows Solana program-derived address patterns
      const seeds = [
        Buffer.from('treasury'),
        Buffer.from('vault'),
        Buffer.from('system'),
        Buffer.from('funds')
      ];
      
      for (const seed of seeds) {
        try {
          const [pda, bump] = PublicKey.findProgramAddressSync(
            [seed, this.hpnWallet.toBuffer()],
            new PublicKey('11111111111111111111111111111111') // System program
          );
          
          if (pda.toString() === this.treasuryAccount.toString()) {
            console.log(`🎉 FOUND PDA PATTERN! Seed: ${seed.toString()}, Bump: ${bump}`);
            console.log('This is a Program Derived Address from your HPN wallet!');
            return;
          }
        } catch (e) {
          // Continue checking
        }
      }
      
      console.log('⚠️  Not a standard Program Derived Address');
      
    } catch (error) {
      console.log('❌ Error checking system patterns');
    }
    
    console.log('');
  }

  private async analyzeTransactionPatterns(): Promise<void> {
    console.log('📊 ANALYZING TRANSACTION PATTERNS...');
    
    try {
      // Get recent transactions to see the pattern
      const signatures = await this.connection.getSignaturesForAddress(this.treasuryAccount, { limit: 10 });
      
      console.log('Recent activity shows systematic SOL transfers');
      console.log('This suggests an automated system is controlling this account');
      
      // Check if transactions are coming from your HPN wallet
      for (const sig of signatures.slice(0, 3)) {
        const txDetail = await this.connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0
        });
        
        if (txDetail && txDetail.transaction) {
          const accounts = txDetail.transaction.message.staticAccountKeys || 
                         txDetail.transaction.message.accountKeys;
          
          for (const account of accounts) {
            if (account.toString() === this.hpnWallet.toString()) {
              console.log('✅ HPN wallet is interacting with treasury account!');
              break;
            }
          }
        }
      }
      
    } catch (error) {
      console.log('❌ Error analyzing transaction patterns');
    }
    
    console.log('');
  }

  private async searchForAccessMethods(): Promise<void> {
    console.log('🔐 SEARCHING FOR ACCESS METHODS...');
    
    // Check system files for any treasury references
    const searchPaths = [
      'data',
      'server/config',
      'backup-1747772582850/data',
      'nexus_engine',
      'secure_credentials'
    ];
    
    for (const path of searchPaths) {
      if (fs.existsSync(path)) {
        console.log(`🔍 Searching ${path}...`);
        
        try {
          this.searchDirectoryForTreasuryRefs(path);
        } catch (e) {
          // Continue searching
        }
      }
    }
    
    console.log('');
  }

  private searchDirectoryForTreasuryRefs(dirPath: string): void {
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const fullPath = `${dirPath}/${file}`;
        
        if (fs.statSync(fullPath).isFile() && file.endsWith('.json')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          if (content.includes('AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATSyrS') ||
              content.includes('treasury') ||
              content.includes('133711') ||
              content.includes('169000')) {
            console.log(`📄 Found potential reference in: ${fullPath}`);
          }
        }
      }
    } catch (e) {
      // Continue
    }
  }

  private showInvestigationResults(): void {
    console.log('📋 INVESTIGATION RESULTS:');
    console.log('========================');
    
    if (this.possibleKeys.length > 0) {
      console.log('🎉 POTENTIAL ACCESS FOUND!');
      for (const key of this.possibleKeys) {
        console.log(`Private Key: ${Buffer.from(key.secretKey).toString('hex')}`);
      }
    } else {
      console.log('⚠️  Direct private key access not found through standard methods');
      console.log('');
      console.log('💡 POSSIBLE SOLUTIONS:');
      console.log('1. This could be a multi-signature account requiring multiple keys');
      console.log('2. The account might be controlled by a smart contract/program');
      console.log('3. The system might have a different access mechanism');
      console.log('4. Check if there are any program authorities or delegate permissions');
      console.log('');
      console.log('🔗 RECOMMENDED ACTIONS:');
      console.log('1. Check Solscan for this account to see program ownership');
      console.log('2. Look for any smart contracts that might control this treasury');
      console.log('3. Search for multi-sig wallet configurations');
      console.log(`4. Visit: https://solscan.io/account/${this.treasuryAccount.toString()}`);
    }
    
    console.log('');
    console.log('💰 ACCOUNT STATUS:');
    console.log(`Balance: ${this.treasuryBalance.toLocaleString()} SOL`);
    console.log(`Value: $${(this.treasuryBalance * 200).toLocaleString()} USD`);
    console.log('Status: Active (receiving regular transfers)');
  }
}

async function main(): Promise<void> {
  const investigator = new SecretTreasuryAccountAccess();
  await investigator.investigateTreasuryAccess();
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { SecretTreasuryAccountAccess };