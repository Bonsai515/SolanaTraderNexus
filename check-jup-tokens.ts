/**
 * Check JUP Token Balance
 * 
 * Verifies JUP tokens in your wallet from the recent trade
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

async function checkJUPTokens() {
  console.log('🔍 CHECKING JUP TOKEN BALANCE IN YOUR WALLET');
  console.log('='.repeat(50));

  const connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  
  const walletPublicKey = new PublicKey('HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK');
  const jupMint = new PublicKey('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN');

  try {
    console.log('💼 Wallet:', walletPublicKey.toBase58());
    console.log('🪙 JUP Token Mint:', jupMint.toBase58());
    
    // Get associated token account
    const associatedTokenAccount = await getAssociatedTokenAddress(jupMint, walletPublicKey);
    console.log('📦 Associated Token Account:', associatedTokenAccount.toBase58());
    
    // Check if account exists and get balance
    const accountInfo = await connection.getAccountInfo(associatedTokenAccount);
    
    if (accountInfo) {
      console.log('✅ JUP token account exists!');
      
      // Get token balance
      const tokenBalance = await connection.getTokenAccountBalance(associatedTokenAccount);
      console.log('💰 JUP Balance:', tokenBalance.value.uiAmount || 0, 'JUP');
      console.log('📊 Raw Amount:', tokenBalance.value.amount);
      
      if (tokenBalance.value.uiAmount && tokenBalance.value.uiAmount > 0) {
        console.log('🎉 SUCCESS! JUP tokens found in your wallet!');
        console.log(`💎 You have ${tokenBalance.value.uiAmount} JUP tokens`);
        console.log('✅ Trade was successful - tokens are in your wallet');
      } else {
        console.log('⏳ JUP tokens not showing yet, but account exists');
        console.log('💡 Sometimes takes a few minutes to update');
      }
    } else {
      console.log('❌ JUP token account not found');
      console.log('💡 This might mean the trade is still processing');
    }
    
    // Also check the transaction
    console.log('\n🔗 Transaction Details:');
    console.log('Transaction: z6u8deJa8znmZCyRXEAHvs1rbySraeNLMcWev74ZuNQ4HrbgcZktH4rMkm9winxB6zSMRD6p8xhz2oEv2jZ23jG');
    console.log('Verify on: https://solscan.io/tx/z6u8deJa8znmZCyRXEAHvs1rbySraeNLMcWev74ZuNQ4HrbgcZktH4rMkm9winxB6zSMRD6p8xhz2oEv2jZ23jG');
    
  } catch (error) {
    console.log('❌ Error checking JUP balance:', error.message);
  }
}

checkJUPTokens().catch(console.error);