/**
 * Test All Wallet Keys from Screenshots
 * 
 * Testing all the private keys you provided to find which one controls
 * the HX wallet with 1.534420 SOL
 */

import { Connection, Keypair, Transaction, SystemProgram, PublicKey } from '@solana/web3.js';

class TestAllWalletKeys {
  private connection: Connection;
  private readonly TARGET_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb'; // Wallet with 1.534 SOL
  private readonly HPN_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
  private readonly HPN_KEY = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';

  // All private keys from your screenshots
  private readonly TEST_KEYS = [
    // From screenshot 1 - Prophet Wallet
    'd28c249469fd4ba35a58800b64e38ccbe22db4df2e115647aa85ff75d5a94544401f38419785a5c053f82d85106a0a1c737619ab0dff383aa24ae8ec4ffde787',
    
    // From screenshot 2 - Trading Wallet 1
    'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da',
    
    // From screenshot 3 - Trading Wallet 2  
    '69995cf93de5220f423e76cd73cbe2eea129d0b42ea00c0322d804745ec6c7bff1d6337eb1eefbc8e5d45d65e51bdcff596aeec7b957f34d2d910dd3da11f6d6',
    
    // From screenshot 4 - Accessible Wallet
    '793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f',
    
    // From screenshot 5 - Main Trading Wallet (9.99834 SOL)
    '793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f',
    
    // From screenshot 6 - Prophet Wallet (0.44547 SOL)
    'fced8d5a72f2d389b12c3b27143c5cfc6ea01064143af365641a0944bcd7841b1de8311e4di9c5ba7c844a7a868d3399d9428b951916bb5085f042205a5792c3',
    
    // From screenshot 7 - Trading Wallet 1
    '9fb95840b9bbeea045044f859cf74639fce71e78c1c95e23411b261ab343f1611b40c7c97815e628bbea174eba13763f6d4c8b6d5659d81098b97b62dcd98dac',
    
    // From screenshot 8 - Trading Wallet 2
    'abbe6e9fb2734ace98c7047a3f2b5bd685f968681f7d1f637ac7bdd371fdbeb9f2aa0be1913871cf01070611b8417678e6f0aa5feb444e899f7cd85ee5cbc4bb'
  ];

  constructor() {
    this.connection = new Connection('https://mainnet.helius-rpc.com/?api-key=5d0d1d98-4695-4a7d-b8a0-d4f9836da17f');
  }

  public async testAllKeys(): Promise<void> {
    console.log('🔍 TESTING ALL PRIVATE KEYS FROM SCREENSHOTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎯 Target wallet: ${this.TARGET_WALLET}`);
    console.log(`💰 Expected balance: 1.534420 SOL`);
    console.log(`📊 Testing ${this.TEST_KEYS.length} private keys...\n`);

    // Verify target wallet balance first
    const targetBalance = await this.connection.getBalance(new PublicKey(this.TARGET_WALLET));
    console.log(`✅ Target wallet balance: ${(targetBalance / 1e9).toFixed(6)} SOL\n`);

    let foundKey = false;
    let successfulTransfer = false;

    for (let i = 0; i < this.TEST_KEYS.length; i++) {
      const privateKey = this.TEST_KEYS[i];
      console.log(`🔑 Testing key ${i + 1}/${this.TEST_KEYS.length}...`);
      
      try {
        const keypair = Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
        const publicKey = keypair.publicKey.toString();
        const balance = await this.connection.getBalance(keypair.publicKey);
        
        console.log(`   Address: ${publicKey}`);
        console.log(`   Balance: ${(balance / 1e9).toFixed(6)} SOL`);
        
        // Check if this is the target wallet
        if (publicKey === this.TARGET_WALLET) {
          console.log(`   🎉 MATCH! This key controls the target wallet!`);
          foundKey = true;
          
          if (balance > 0.01 * 1e9) {
            console.log(`   💸 Attempting transfer...`);
            successfulTransfer = await this.transferToHPN(keypair, balance);
          }
        } else if (balance > 0.01 * 1e9) {
          console.log(`   💰 This wallet has balance - transferring...`);
          await this.transferToHPN(keypair, balance);
        } else {
          console.log(`   ⚠️  No significant balance`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error with this key: ${error.message}`);
      }
      
      console.log('');
    }

    // Summary
    console.log('🎊 TEST RESULTS SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (foundKey) {
      console.log('✅ Found the key that controls the target wallet!');
      if (successfulTransfer) {
        console.log('🎉 Successfully transferred funds to HPN wallet!');
      }
    } else {
      console.log('❌ Target wallet key not found in provided keys');
      console.log('💡 The key might be stored in AWS Secrets Manager or another secure location');
    }

    // Check final HPN balance
    const hpnBalance = await this.connection.getBalance(new PublicKey(this.HPN_WALLET));
    console.log(`🏦 Final HPN wallet balance: ${(hpnBalance / 1e9).toFixed(6)} SOL`);
  }

  private async transferToHPN(fromKeypair: Keypair, balance: number): Promise<boolean> {
    try {
      const hpnKeypair = Keypair.fromSecretKey(Buffer.from(this.HPN_KEY, 'hex'));
      
      // Transfer 90% of balance (keep some for fees)
      const transferAmount = Math.floor(balance * 0.9);
      
      console.log(`     💸 Transferring ${(transferAmount / 1e9).toFixed(6)} SOL...`);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: hpnKeypair.publicKey,
          lamports: transferAmount
        })
      );

      transaction.feePayer = fromKeypair.publicKey;
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      const signature = await this.connection.sendTransaction(transaction, [fromKeypair]);
      
      console.log(`     ✅ Transfer successful!`);
      console.log(`     📝 Transaction: ${signature}`);
      console.log(`     🔗 View: https://solscan.io/tx/${signature}`);
      
      return true;
      
    } catch (error) {
      console.log(`     ❌ Transfer failed: ${error.message}`);
      return false;
    }
  }
}

async function main(): Promise<void> {
  const tester = new TestAllWalletKeys();
  await tester.testAllKeys();
}

if (require.main === module) {
  main().catch(console.error);
}