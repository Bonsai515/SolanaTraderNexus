/**
 * Fixed USDC to SOL Swap
 * 
 * Handles versioned transactions properly for Jupiter swaps
 */

import { Connection, Keypair, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

const connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');

async function executeFixedUSDCSwap() {
  console.log('🚀 EXECUTING FIXED USDC → SOL SWAP!');
  console.log('='.repeat(45));

  try {
    // Load wallet from private key
    const privateKeyHex = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';
    const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
    const walletKeypair = Keypair.fromSecretKey(privateKeyBuffer);
    
    console.log('✅ Wallet loaded: ' + walletKeypair.publicKey.toBase58());

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
    console.log('🔄 Preparing versioned transaction...');
    
    const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: walletKeypair.publicKey.toString(),
        wrapAndUnwrapSol: true,
        prioritizationFeeLamports: 200000, // Higher priority
      })
    });

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      throw new Error('Failed to get swap transaction: ' + errorText);
    }

    const swapData = await swapResponse.json();

    // Handle versioned transaction properly
    console.log('⚡ EXECUTING VERSIONED TRANSACTION...');
    
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    
    // Sign the transaction
    transaction.sign([walletKeypair]);

    // Send the transaction
    const rawTransaction = transaction.serialize();
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
      maxRetries: 3
    });

    console.log('📝 Transaction sent: ' + txid);
    console.log('⏳ Confirming transaction...');

    // Confirm the transaction
    const confirmation = await connection.confirmTransaction(txid, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
    }

    console.log('');
    console.log('🎉 SWAP SUCCESSFUL!');
    console.log('📝 Transaction Signature: ' + txid);
    console.log('🔗 View on Solscan: https://solscan.io/tx/' + txid);

    // Check new balance
    console.log('');
    console.log('⏳ Checking new balance...');
    
    setTimeout(async () => {
      try {
        const newBalance = await connection.getBalance(walletKeypair.publicKey);
        const newSOL = newBalance / LAMPORTS_PER_SOL;
        const solGained = newSOL - currentSOL;

        console.log('');
        console.log('💰 BALANCE UPDATE:');
        console.log('Previous SOL: ' + currentSOL.toFixed(6) + ' SOL');
        console.log('Current SOL: ' + newSOL.toFixed(6) + ' SOL');
        console.log('SOL Gained: +' + solGained.toFixed(6) + ' SOL');

        // Check remaining USDC
        const newTokenBalance = await connection.getTokenAccountBalance(usdcTokenAccount);
        const remainingUSDC = newTokenBalance.value.uiAmount || 0;
        console.log('Remaining USDC: ' + remainingUSDC + ' USDC');

        console.log('');
        console.log('🚀 TRADING CAPABILITIES:');
        if (newSOL >= 0.1) {
          console.log('✅ Flash loan protocols accessible!');
          console.log('🎯 Ready for advanced arbitrage strategies');
        } else {
          console.log('📈 Good for regular trading strategies');
        }

        console.log('');
        console.log('🔥 READY FOR NEXT PHASE!');
        console.log('Your SOL has been restored from USDC conversion');

      } catch (error) {
        console.log('⚠️ Could not check new balance: ' + error.message);
      }
    }, 5000);

  } catch (error) {
    console.log('❌ Swap failed: ' + error.message);
    
    console.log('');
    console.log('💡 Manual conversion available at:');
    console.log('🔗 https://jup.ag/ - Connect wallet and swap USDC → SOL');
  }
}

executeFixedUSDCSwap().catch(console.error);