/**
 * Transfer HX Wallet SOL to HPN Wallet
 * 
 * Transfer the 1.534420 SOL from HX wallet to HPN wallet
 */

import { Connection, Keypair, Transaction, SystemProgram } from '@solana/web3.js';

class TransferHXToHPN {
  private connection: Connection;
  private readonly HX_KEY = '793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f';
  private readonly HPN_KEY = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';

  constructor() {
    this.connection = new Connection('https://mainnet.helius-rpc.com/?api-key=5d0d1d98-4695-4a7d-b8a0-d4f9836da17f');
  }

  public async transferHXToHPN(): Promise<void> {
    console.log('💸 TRANSFERRING HX WALLET SOL TO HPN WALLET');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Create keypairs
    const hxKeypair = Keypair.fromSecretKey(Buffer.from(this.HX_KEY, 'hex'));
    const hpnKeypair = Keypair.fromSecretKey(Buffer.from(this.HPN_KEY, 'hex'));

    console.log(`🔑 HX Wallet: ${hxKeypair.publicKey.toString()}`);
    console.log(`🎯 HPN Wallet: ${hpnKeypair.publicKey.toString()}`);

    // Check current balances
    const hxBalance = await this.connection.getBalance(hxKeypair.publicKey);
    const hpnBalanceBefore = await this.connection.getBalance(hpnKeypair.publicKey);

    console.log(`\n💰 HX Balance: ${(hxBalance / 1e9).toFixed(6)} SOL`);
    console.log(`💰 HPN Balance (before): ${(hpnBalanceBefore / 1e9).toFixed(6)} SOL`);

    if (hxBalance < 0.01 * 1e9) {
      console.log('❌ Insufficient balance for transfer');
      return;
    }

    // Transfer 90% of balance (keep some for fees)
    const transferAmount = Math.floor(hxBalance * 0.9);
    
    console.log(`\n💸 Transferring ${(transferAmount / 1e9).toFixed(6)} SOL...`);
    console.log(`💵 Value: $${((transferAmount / 1e9) * 200).toLocaleString()}`);

    try {
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

      console.log('\n🎉 TRANSFER SUCCESSFUL! 🎉');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`💰 Amount: ${(transferAmount / 1e9).toFixed(6)} SOL`);
      console.log(`💵 Value: $${((transferAmount / 1e9) * 200).toLocaleString()}`);
      console.log(`📝 Transaction: ${signature}`);
      console.log(`🔗 View: https://solscan.io/tx/${signature}`);

      // Wait for confirmation
      console.log('\n⏳ Waiting for confirmation...');
      await this.connection.confirmTransaction(signature);

      // Check final balances
      const hxBalanceAfter = await this.connection.getBalance(hxKeypair.publicKey);
      const hpnBalanceAfter = await this.connection.getBalance(hpnKeypair.publicKey);

      console.log('\n📊 FINAL BALANCES:');
      console.log(`🔑 HX Wallet: ${(hxBalanceAfter / 1e9).toFixed(6)} SOL`);
      console.log(`🎯 HPN Wallet: ${(hpnBalanceAfter / 1e9).toFixed(6)} SOL`);
      console.log(`📈 HPN Gain: +${((hpnBalanceAfter - hpnBalanceBefore) / 1e9).toFixed(6)} SOL`);

    } catch (error) {
      console.error(`❌ Transfer failed: ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  const transfer = new TransferHXToHPN();
  await transfer.transferHXToHPN();
}

if (require.main === module) {
  main().catch(console.error);
}