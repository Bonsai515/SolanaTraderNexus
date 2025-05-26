/**
 * Transfer from the Correct HX Wallet with Balance
 * 
 * Transfer the 1.534420 SOL from the actual HX wallet that has balance:
 * HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb
 */

import { Connection, Keypair, Transaction, SystemProgram } from '@solana/web3.js';

class TransferCorrectHXWallet {
  private connection: Connection;
  private readonly HX_WALLET_WITH_BALANCE = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  private readonly HX_KEY = '793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f';
  private readonly HPN_KEY = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';

  constructor() {
    this.connection = new Connection('https://mainnet.helius-rpc.com/?api-key=5d0d1d98-4695-4a7d-b8a0-d4f9836da17f');
  }

  public async transferCorrectHXWallet(): Promise<void> {
    console.log('💸 TRANSFERRING FROM CORRECT HX WALLET WITH BALANCE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Create keypairs
    const hxKeypair = Keypair.fromSecretKey(Buffer.from(this.HX_KEY, 'hex'));
    const hpnKeypair = Keypair.fromSecretKey(Buffer.from(this.HPN_KEY, 'hex'));

    console.log(`🔍 Key generates address: ${hxKeypair.publicKey.toString()}`);
    console.log(`🎯 Target wallet with balance: ${this.HX_WALLET_WITH_BALANCE}`);
    console.log(`🏦 Destination HPN: ${hpnKeypair.publicKey.toString()}`);

    // Check if the key matches the wallet with balance
    if (hxKeypair.publicKey.toString() === this.HX_WALLET_WITH_BALANCE) {
      console.log('✅ Private key matches wallet with balance!');
    } else {
      console.log('❌ Private key does not match wallet with balance');
      console.log('The private key generates a different address');
    }

    // Check balances of both addresses
    const keyGeneratedBalance = await this.connection.getBalance(hxKeypair.publicKey);
    const targetWalletBalance = await this.connection.getBalance(new PublicKey(this.HX_WALLET_WITH_BALANCE));
    const hpnBalanceBefore = await this.connection.getBalance(hpnKeypair.publicKey);

    console.log(`\n💰 Key-generated wallet balance: ${(keyGeneratedBalance / 1e9).toFixed(6)} SOL`);
    console.log(`💰 Target wallet balance: ${(targetWalletBalance / 1e9).toFixed(6)} SOL`);
    console.log(`💰 HPN Balance (before): ${(hpnBalanceBefore / 1e9).toFixed(6)} SOL`);

    // If the key-generated wallet has balance, transfer it
    if (keyGeneratedBalance > 0.01 * 1e9) {
      console.log('\n🚀 Transferring from key-generated wallet...');
      await this.executeTransfer(hxKeypair, hpnKeypair, keyGeneratedBalance);
    } else {
      console.log('\n❌ Key-generated wallet has no transferable balance');
      console.log('⚠️  The private key we have does not control the wallet with 1.534 SOL');
      console.log('💡 We need to find the correct private key for HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb');
    }
  }

  private async executeTransfer(fromKeypair: Keypair, toKeypair: Keypair, balance: number): Promise<void> {
    try {
      // Transfer 90% of balance (keep some for fees)
      const transferAmount = Math.floor(balance * 0.9);
      
      console.log(`💸 Transferring ${(transferAmount / 1e9).toFixed(6)} SOL...`);
      console.log(`💵 Value: $${((transferAmount / 1e9) * 200).toLocaleString()}`);

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

      console.log('\n🎉 TRANSFER SUCCESSFUL! 🎉');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`💰 Amount: ${(transferAmount / 1e9).toFixed(6)} SOL`);
      console.log(`💵 Value: $${((transferAmount / 1e9) * 200).toLocaleString()}`);
      console.log(`📝 Transaction: ${signature}`);
      console.log(`🔗 View: https://solscan.io/tx/${signature}`);

    } catch (error) {
      console.error(`❌ Transfer failed: ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  const transfer = new TransferCorrectHXWallet();
  await transfer.transferCorrectHXWallet();
}

if (require.main === module) {
  main().catch(console.error);
}