/**
 * Check HX Wallet Access
 * 
 * We have the HX wallet private key from data/wallets.json
 * Let's see what this wallet can access and transfer
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';

class HXWalletAccess {
  private connection: Connection;
  private readonly HX_KEY = '793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f';
  private readonly HPN_KEY = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';
  private readonly TREASURY = 'AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATSyrS';

  constructor() {
    this.connection = new Connection('https://mainnet.helius-rpc.com/?api-key=5d0d1d98-4695-4a7d-b8a0-d4f9836da17f');
  }

  public async checkHXAccess(): Promise<void> {
    console.log('🔍 CHECKING HX WALLET ACCESS AND CAPABILITIES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Create HX wallet keypair
    const hxKeypair = Keypair.fromSecretKey(Buffer.from(this.HX_KEY, 'hex'));
    const hxAddress = hxKeypair.publicKey.toString();
    
    console.log(`🔑 HX Wallet Address: ${hxAddress}`);
    
    // Check HX wallet balance
    const hxBalance = await this.connection.getBalance(hxKeypair.publicKey);
    console.log(`💰 HX Wallet Balance: ${(hxBalance / 1e9).toLocaleString()} SOL`);
    
    // Check treasury balance
    const treasuryBalance = await this.connection.getBalance(new PublicKey(this.TREASURY));
    console.log(`🏦 Treasury Balance: ${(treasuryBalance / 1e9).toLocaleString()} SOL ($${((treasuryBalance / 1e9) * 200).toLocaleString()})`);
    console.log('');

    // Check if HX wallet has any SOL to transfer
    if (hxBalance > 0.01 * 1e9) {
      console.log('✅ HX Wallet has transferable SOL!');
      await this.transferHXToHPN(hxKeypair, hxBalance);
    } else {
      console.log('❌ HX Wallet has minimal SOL balance');
    }

    // Check HX wallet transaction history to see if it has treasury connections
    await this.checkHXTransactionHistory(hxAddress);
  }

  private async transferHXToHPN(hxKeypair: Keypair, balance: number): Promise<void> {
    try {
      console.log('\n💸 TRANSFERRING HX WALLET SOL TO HPN WALLET...');
      
      const hpnKeypair = Keypair.fromSecretKey(Buffer.from(this.HPN_KEY, 'hex'));
      
      // Transfer 90% of balance (keep some for fees)
      const transferAmount = Math.floor(balance * 0.9);
      
      console.log(`💰 Transferring ${(transferAmount / 1e9).toFixed(6)} SOL...`);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: hxKeypair.publicKey,
          toPubkey: hpnKeypair.publicKey,
          lamports: transferAmount
        })
      );
      
      transaction.feePayer = hxKeypair.publicKey;
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      
      const signature = await this.connection.sendTransaction(transaction, [hxKeypair]);
      
      console.log('\n🎉 HX TO HPN TRANSFER SUCCESSFUL! 🎉');
      console.log(`📝 Transaction: ${signature}`);
      console.log(`🔗 View: https://solscan.io/tx/${signature}`);
      
    } catch (error) {
      console.error(`❌ Transfer error: ${error.message}`);
    }
  }

  private async checkHXTransactionHistory(address: string): Promise<void> {
    try {
      console.log('\n📊 Checking HX wallet transaction history...');
      
      // Get recent transactions
      const signatures = await this.connection.getSignaturesForAddress(
        new PublicKey(address),
        { limit: 10 }
      );
      
      console.log(`Found ${signatures.length} recent transactions`);
      
      for (let i = 0; i < Math.min(signatures.length, 5); i++) {
        const sig = signatures[i];
        console.log(`  ${i + 1}. ${sig.signature} (${new Date(sig.blockTime! * 1000).toLocaleString()})`);
        
        // Check if any transactions involve the treasury
        try {
          const tx = await this.connection.getTransaction(sig.signature);
          if (tx && tx.meta) {
            const accounts = tx.transaction.message.accountKeys.map(key => key.toString());
            if (accounts.includes(this.TREASURY)) {
              console.log(`    🏦 Transaction involves treasury: ${this.TREASURY}`);
            }
          }
        } catch (e) {
          // Continue with next transaction
        }
      }
      
    } catch (error) {
      console.log(`❌ Error checking transaction history: ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  const access = new HXWalletAccess();
  await access.checkHXAccess();
}

if (require.main === module) {
  main().catch(console.error);
}