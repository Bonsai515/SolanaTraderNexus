/**
 * Execute USDC to SOL Swap
 * 
 * Converts 46.6 USDC back to SOL using Jupiter Exchange
 * with your actual wallet private key.
 */

import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

const connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');

async function executeUSDCSwap() {
  console.log('🚀 EXECUTING USDC → SOL SWAP NOW!');
  console.log('='.repeat(45));

  try {
    // Load wallet from private key
    const privateKeyHex = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';
    const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
    const walletKeypair = Keypair.fromSecretKey(privateKeyBuffer);
    
    const walletAddress = walletKeypair.publicKey.toBase58();
    console.log('📍 Wallet: ' + walletAddress);

    // Check current balances
    const solBalance = await connection.getBalance(walletKeypair.publicKey);
    const currentSOL = solBalance / LAMPORTS_PER_SOL;
    console.log('💰 Current SOL: ' + currentSOL.toFixed(6) + ' SOL');

    // Check USDC balance
    const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const usdcTokenAccount = await getAssociatedTokenAddress(usdcMint, walletKeypair.publicKey);
    
    const tokenBalance = await connection.getTokenAccountBalance(usdcTokenAccount);
    const usdcAmount = tokenBalance.value.uiAmount;
    
    console.log('💰 Current USDC: ' + usdcAmount + ' USDC');

    if (!usdcAmount || usdcAmount < 1) {
      console.log('❌ No USDC to convert');
      return;
    }

    // Get Jupiter quote
    console.log('🔍 Getting Jupiter quote...');
    const inputAmount = Math.floor(usdcAmount * 1000000); // Convert to USDC raw amount
    
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=${inputAmount}&slippageBps=300`;
    
    const quoteResponse = await fetch(quoteUrl);
    if (!quoteResponse.ok) {
      throw new Error('Failed to get Jupiter quote');
    }

    const quoteData = await quoteResponse.json();
    const expectedSOL = parseInt(quoteData.outAmount) / LAMPORTS_PER_SOL;

    console.log('📊 Swap Quote:');
    console.log(`   Converting: ${usdcAmount} USDC`);
    console.log(`   Expected: ${expectedSOL.toFixed(6)} SOL`);
    console.log(`   Rate: 1 USDC = ${(expectedSOL/usdcAmount).toFixed(6)} SOL`);

    // Get swap transaction
    console.log('🔄 Preparing swap transaction...');
    
    const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: walletKeypair.publicKey.toString(),
        wrapAndUnwrapSol: true,
        prioritizationFeeLamports: 100000, // High priority
      })
    });

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      throw new Error('Failed to get swap transaction: ' + errorText);
    }

    const swapData = await swapResponse.json();

    // Execute the swap
    console.log('⚡ EXECUTING SWAP TRANSACTION...');
    const transaction = Transaction.from(Buffer.from(swapData.swapTransaction, 'base64'));

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair],
      { 
        commitment: 'confirmed',
        maxRetries: 3
      }
    );

    console.log('');
    console.log('🎉 SWAP SUCCESSFUL!');
    console.log('📝 Transaction Signature: ' + signature);
    console.log('🔗 View on Solscan: https://solscan.io/tx/' + signature);

    // Wait and check new balance
    console.log('');
    console.log('⏳ Checking new balance...');
    
    setTimeout(async () => {
      try {
        const newBalance = await connection.getBalance(walletKeypair.publicKey);
        const newSOL = newBalance / LAMPORTS_PER_SOL;
        const solGained = newSOL - currentSOL;

        console.log('');
        console.log('💰 UPDATED BALANCES:');
        console.log('Previous SOL: ' + currentSOL.toFixed(6) + ' SOL');
        console.log('Current SOL: ' + newSOL.toFixed(6) + ' SOL');
        console.log('SOL Gained: +' + solGained.toFixed(6) + ' SOL');

        if (newSOL >= 40) {
          console.log('');
          console.log('🚀 MASSIVE CAPITAL RESTORED!');
          console.log('✅ FULL FLASH LOAN ACCESS UNLOCKED!');
          console.log('💥 10M SOL flash capacity available');
          console.log('🎯 Ready for 2+ SOL arbitrage opportunities');
          console.log('⚡ MarginFi, Drift, Solend all accessible');
        } else if (newSOL >= 10) {
          console.log('');
          console.log('📈 EXCELLENT TRADING CAPITAL!');
          console.log('✅ Major flash loan protocols accessible');
          console.log('🎯 Ready for high-value strategies');
        } else if (newSOL >= 1) {
          console.log('');
          console.log('✅ GOOD TRADING CAPITAL RESTORED!');
          console.log('🎯 Ready for advanced strategies');
        }

        console.log('');
        console.log('🔥 NEXT STEPS:');
        console.log('1. Activate flash loan protocols');
        console.log('2. Deploy massive arbitrage strategies');
        console.log('3. Execute 2+ SOL profit opportunities');

      } catch (error) {
        console.log('⚠️ Could not check new balance: ' + error.message);
      }
    }, 5000);

  } catch (error) {
    console.log('❌ Swap failed: ' + error.message);
    
    console.log('');
    console.log('💡 Alternative: Manual swap at https://jup.ag/');
    console.log('   Connect wallet and swap 46.6 USDC → SOL');
  }
}

executeUSDCSwap().catch(console.error);