/**
 * Access Real HX Wallet and Transfer to HPN
 * 
 * Using the correct HX private key to unlock 1.534 SOL
 */

import { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';

class RealHXWalletAccess {
  private connection: Connection;
  private hxWalletKeypair: Keypair;
  private hpnWalletKeypair: Keypair;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async accessAndTransferHX(): Promise<void> {
    console.log('🚀 ACCESSING REAL HX WALLET WITH CORRECT PRIVATE KEY');
    console.log('💎 Target: HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb');
    console.log('🎯 Goal: Transfer 1.534 SOL to HPN wallet for maximum trading power');
    console.log('='.repeat(70));

    await this.loadWallets();
    await this.verifyHXAccess();
    await this.executeTransfer();
  }

  private async loadWallets(): Promise<void> {
    console.log('\n💼 LOADING WALLETS WITH CORRECT KEYS');
    
    // Load HPN wallet
    const hpnPrivateKey = [
      178, 244, 12, 25, 27, 202, 251, 10, 212, 90, 37, 116, 218, 42, 22, 165,
      134, 165, 151, 54, 225, 215, 194, 8, 177, 201, 105, 101, 212, 120, 249,
      74, 243, 118, 55, 187, 158, 35, 75, 138, 173, 148, 39, 171, 160, 27, 89,
      6, 105, 174, 233, 82, 187, 49, 42, 193, 182, 112, 195, 65, 56, 144, 83, 218
    ];
    this.hpnWalletKeypair = Keypair.fromSecretKey(new Uint8Array(hpnPrivateKey));
    
    // Load HX wallet with the CORRECT private key
    const hxPrivateKey = [
      121, 61, 236, 154, 102, 159, 247, 23, 38,
      107, 37, 68, 196, 75, 179, 153,
      14, 34, 111, 44, 33, 198, 32, 183, 51,
      181, 60, 31, 54, 112, 248, 162,
      49, 242, 190, 61, 128, 144, 62, 119, 201,
      55, 0, 177, 65, 249, 241, 99,
      232, 221, 11, 165, 140, 21, 44, 188, 155,
      160, 71, 191, 162, 69, 73, 159
    ];
    this.hxWalletKeypair = Keypair.fromSecretKey(new Uint8Array(hxPrivateKey));
    
    console.log(`✅ HPN Wallet: ${this.hpnWalletKeypair.publicKey.toBase58()}`);
    console.log(`✅ HX Wallet: ${this.hxWalletKeypair.publicKey.toBase58()}`);
  }

  private async verifyHXAccess(): Promise<void> {
    console.log('\n🔍 VERIFYING HX WALLET ACCESS');
    
    const expectedAddress = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
    const actualAddress = this.hxWalletKeypair.publicKey.toBase58();
    
    console.log(`🎯 Expected: ${expectedAddress}`);
    console.log(`🔑 Actual:   ${actualAddress}`);
    
    if (actualAddress === expectedAddress) {
      console.log('🎉 HX WALLET ACCESS CONFIRMED!');
      
      const balance = await this.connection.getBalance(this.hxWalletKeypair.publicKey);
      const balanceSOL = balance / LAMPORTS_PER_SOL;
      
      console.log(`💰 HX Balance: ${balanceSOL.toFixed(9)} SOL`);
      console.log('🔓 Ready to transfer to HPN wallet!');
    } else {
      console.log('❌ Address still doesn\'t match - need to check private key format');
    }
  }

  private async executeTransfer(): Promise<void> {
    const expectedAddress = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
    const actualAddress = this.hxWalletKeypair.publicKey.toBase58();
    
    if (actualAddress !== expectedAddress) {
      console.log('\n❌ Cannot transfer - wallet address mismatch');
      return;
    }

    console.log('\n💎 EXECUTING HX TO HPN TRANSFER');
    
    const hxBalance = await this.connection.getBalance(this.hxWalletKeypair.publicKey);
    const hpnBalanceBefore = await this.connection.getBalance(this.hpnWalletKeypair.publicKey);
    
    const hxSOL = hxBalance / LAMPORTS_PER_SOL;
    const hpnSOLBefore = hpnBalanceBefore / LAMPORTS_PER_SOL;
    
    console.log(`📊 HX Balance: ${hxSOL.toFixed(9)} SOL`);
    console.log(`📊 HPN Balance (before): ${hpnSOLBefore.toFixed(9)} SOL`);
    
    if (hxSOL > 0.001) {
      console.log('\n🔄 Transferring HX funds to HPN...');
      
      const transferAmount = hxBalance - 5000; // Leave small amount for fees
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.hxWalletKeypair.publicKey,
          toPubkey: this.hpnWalletKeypair.publicKey,
          lamports: transferAmount
        })
      );

      try {
        const signature = await this.connection.sendTransaction(
          transaction,
          [this.hxWalletKeypair],
          { skipPreflight: false }
        );

        console.log(`✅ TRANSFER SUCCESSFUL!`);
        console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
        console.log(`💎 Transferred: ${(transferAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        
        // Wait for confirmation and show final balances
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const hpnBalanceAfter = await this.connection.getBalance(this.hpnWalletKeypair.publicKey);
        const hpnSOLAfter = hpnBalanceAfter / LAMPORTS_PER_SOL;
        const totalIncrease = hpnSOLAfter - hpnSOLBefore;
        
        console.log('\n🎯 FINAL RESULTS:');
        console.log(`💰 HPN Balance (after): ${hpnSOLAfter.toFixed(9)} SOL`);
        console.log(`📈 Capital Increase: +${totalIncrease.toFixed(6)} SOL`);
        console.log('🚀 Ready for maximum trading power with consolidated capital!');
        
      } catch (error) {
        console.log(`❌ Transfer failed: ${error.message}`);
      }
    } else {
      console.log('⚠️ HX wallet has insufficient balance for transfer');
    }
  }
}

async function main(): Promise<void> {
  const accessor = new RealHXWalletAccess();
  await accessor.accessAndTransferHX();
}

main().catch(console.error);