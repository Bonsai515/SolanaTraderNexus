/**
 * Accumulate SOL - Reverse Trade
 * Convert USDC/tokens back to SOL for accumulation
 */

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  VersionedTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as fs from 'fs';

async function accumulateSOLReverseTrade() {
  console.log('🚀 ACCUMULATING SOL WITH REVERSE TRADE...');
  
  // Setup connection and wallet
  const connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  const privateKeyHex = fs.readFileSync('./hpn-real-key.txt', 'utf8').trim();
  const secretKey = Buffer.from(privateKeyHex, 'hex');
  const walletKeypair = Keypair.fromSecretKey(secretKey);
  const walletAddress = walletKeypair.publicKey.toBase58();
  
  console.log(`📍 Wallet: ${walletAddress}`);
  
  // Get current SOL balance
  const solBalance = await connection.getBalance(walletKeypair.publicKey);
  const currentSOL = solBalance / LAMPORTS_PER_SOL;
  console.log(`💰 Current SOL: ${currentSOL.toFixed(6)} SOL`);
  
  try {
    // Check USDC balance
    console.log('📊 Checking USDC balance...');
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletKeypair.publicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    let usdcBalance = 0;
    let usdcAccount = null;
    
    for (const account of tokenAccounts.value) {
      const mint = account.account.data.parsed.info.mint;
      const balance = account.account.data.parsed.info.tokenAmount.uiAmount;
      
      if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' && balance > 0) {
        usdcBalance = balance;
        usdcAccount = account;
        break;
      }
    }
    
    console.log(`💎 USDC Balance: ${usdcBalance.toFixed(6)} USDC`);
    
    if (usdcBalance > 0.5) { // Only trade if we have meaningful USDC
      // Convert 50% of USDC back to SOL
      const tradeAmount = usdcBalance * 0.5;
      console.log(`🔄 Converting ${tradeAmount.toFixed(6)} USDC → SOL`);
      
      // Get Jupiter quote (USDC to SOL)
      console.log('📊 Getting Jupiter quote...');
      const params = new URLSearchParams({
        inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        outputMint: 'So11111111111111111111111111111111111111112', // SOL
        amount: Math.floor(tradeAmount * 1000000).toString(), // USDC has 6 decimals
        slippageBps: '100'
      });
      
      const quoteResponse = await fetch(`https://quote-api.jup.ag/v6/quote?${params}`);
      
      if (!quoteResponse.ok) {
        throw new Error(`Quote failed: ${quoteResponse.status}`);
      }
      
      const quote = await quoteResponse.json();
      const outputSOL = parseInt(quote.outAmount) / LAMPORTS_PER_SOL;
      console.log(`✅ Quote: ${tradeAmount.toFixed(6)} USDC → ${outputSOL.toFixed(6)} SOL`);
      
      // Get swap transaction
      console.log('🔄 Building swap transaction...');
      const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: walletAddress,
          wrapAndUnwrapSol: true,
          computeUnitPriceMicroLamports: 150000
        })
      });
      
      if (!swapResponse.ok) {
        throw new Error(`Swap failed: ${swapResponse.status}`);
      }
      
      const swapData = await swapResponse.json();
      console.log('✅ Swap transaction built');
      
      // Sign and send transaction
      console.log('✍️ Signing and sending transaction...');
      const transactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);
      
      transaction.sign([walletKeypair]);
      
      const signature = await connection.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3
      });
      
      console.log('🚀 SOL ACCUMULATION TRANSACTION SENT!');
      console.log(`🔗 Signature: ${signature}`);
      console.log(`📊 Solscan: https://solscan.io/tx/${signature}`);
      
      // Wait for confirmation
      console.log('⏳ Waiting for confirmation...');
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        console.log(`❌ Transaction failed: ${confirmation.value.err}`);
      } else {
        console.log('✅ SOL ACCUMULATION CONFIRMED!');
        
        // Check new SOL balance
        const newSolBalance = await connection.getBalance(walletKeypair.publicKey);
        const newSOL = newSolBalance / LAMPORTS_PER_SOL;
        const solGained = newSOL - currentSOL;
        
        console.log(`💰 Previous SOL: ${currentSOL.toFixed(6)} SOL`);
        console.log(`💰 New SOL Balance: ${newSOL.toFixed(6)} SOL`);
        console.log(`📈 SOL Gained: ${solGained.toFixed(6)} SOL`);
        console.log('🎉 SOL ACCUMULATION SUCCESSFUL!');
        
        if (solGained > 0) {
          console.log('💎 PROFIT REALIZED - SOL INCREASED!');
        }
      }
      
    } else {
      console.log('⚠️ Insufficient USDC balance for reverse trade');
      console.log('💡 Consider executing more SOL→USDC trades first');
    }
    
  } catch (error) {
    console.error(`❌ SOL accumulation failed: ${(error as Error).message}`);
  }
}

accumulateSOLReverseTrade().catch(console.error);