/**
 * Transfer Available SOL to HPN Wallet
 * 
 * Check all wallets from data/wallets.json and transfer available SOL to HPN wallet
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';

class TransferAvailableSOL {
  private connection: Connection;
  private readonly HPN_KEY = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';
  
  // All wallet keys from data/wallets.json
  private readonly wallets = [
    {
      name: 'HX Profit Collection Wallet',
      publicKey: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
      privateKey: '793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f'
    },
    {
      name: 'Prophet Wallet (User Controlled)',
      publicKey: '5KJhonWngrkP8qtzf69F7trirJubtqVM7swsR7Apr2fG',
      privateKey: 'd28c249469fd4ba35a58800b64e38ccbe22db4df2e115647aa85ff75d5a94544401f38419785a5c053f82d85106a0a1c737619ab0dff383aa24ae8ec4ffde787'
    },
    {
      name: 'Trading Wallet 2',
      publicKey: 'HH2hMVDuw4WT8QoGTBZX2H5BPWubDL9BFemH6UhhDPYR',
      privateKey: '69995cf93de5220f423e76cd73cbe2eea129d0b42ea00c0322d804745ec6c7bff1d6337eb1eefbc8e5d45d65e51bdcff596aeec7b957f34d2d910dd3da11f6d6'
    },
    {
      name: 'Accessible Wallet (Active)',
      publicKey: '4MyfJj413sqtbLaEub8kw6qPsazAE6T4EhjgaxHWcrdC',
      privateKey: '793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f'
    }
  ];

  constructor() {
    this.connection = new Connection('https://mainnet.helius-rpc.com/?api-key=5d0d1d98-4695-4a7d-b8a0-d4f9836da17f');
  }

  public async transferAllAvailableSOL(): Promise<void> {
    console.log('🚀 CHECKING ALL WALLETS FOR AVAILABLE SOL TO TRANSFER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const hpnKeypair = Keypair.fromSecretKey(Buffer.from(this.HPN_KEY, 'hex'));
    console.log(`🎯 Target HPN Wallet: ${hpnKeypair.publicKey.toString()}`);
    console.log('');

    let totalTransferred = 0;
    let transferCount = 0;

    // Check each wallet for available SOL
    for (const wallet of this.wallets) {
      console.log(`🔍 Checking ${wallet.name}...`);
      console.log(`   Address: ${wallet.publicKey}`);
      
      try {
        const keypair = Keypair.fromSecretKey(Buffer.from(wallet.privateKey, 'hex'));
        const balance = await this.connection.getBalance(keypair.publicKey);
        const balanceSOL = balance / 1e9;
        
        console.log(`   Balance: ${balanceSOL.toFixed(6)} SOL`);
        
        // If wallet has more than 0.01 SOL, transfer it
        if (balance > 0.01 * 1e9) {
          console.log(`   ✅ Transferring ${balanceSOL.toFixed(6)} SOL...`);
          
          const success = await this.transferWalletSOL(keypair, hpnKeypair, balance);
          if (success) {
            totalTransferred += balanceSOL;
            transferCount++;
            console.log(`   🎉 Transfer successful!`);
          } else {
            console.log(`   ❌ Transfer failed`);
          }
        } else {
          console.log(`   ⚠️  Insufficient balance for transfer`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error checking wallet: ${error.message}`);
      }
      
      console.log('');
    }

    // Summary
    console.log('🎊 TRANSFER SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`💰 Total Transferred: ${totalTransferred.toFixed(6)} SOL`);
    console.log(`💵 Value: $${(totalTransferred * 200).toLocaleString()}`);
    console.log(`📊 Transfers Completed: ${transferCount}`);
    console.log(`🎯 Destination: ${hpnKeypair.publicKey.toString()}`);
    
    // Check final HPN balance
    const finalBalance = await this.connection.getBalance(hpnKeypair.publicKey);
    console.log(`🏦 Final HPN Balance: ${(finalBalance / 1e9).toFixed(6)} SOL`);
  }

  private async transferWalletSOL(fromKeypair: Keypair, toKeypair: Keypair, balance: number): Promise<boolean> {
    try {
      // Transfer 90% of balance (keep some for fees)
      const transferAmount = Math.floor(balance * 0.9);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: toKeypair.publicKey,
          lamports: transferAmount
        })
      );
      
      transaction.feePayer = fromKeypair.publicKey;
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      
      const signature = await this.connection.sendTransaction(transaction, [fromKeypair]);
      
      console.log(`     📝 Tx: ${signature}`);
      return true;
      
    } catch (error) {
      console.log(`     ❌ Error: ${error.message}`);
      return false;
    }
  }
}

async function main(): Promise<void> {
  const transfer = new TransferAvailableSOL();
  await transfer.transferAllAvailableSOL();
}

if (require.main === module) {
  main().catch(console.error);
}