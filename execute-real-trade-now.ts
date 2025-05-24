/**
 * Execute Real Trade Now
 * Simple, direct real trade execution
 */

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  VersionedTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as fs from 'fs';

async function executeRealTradeNow() {
  console.log('🚀 EXECUTING REAL TRADE NOW...');
  
  // Setup connection and wallet
  const connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  const privateKeyHex = fs.readFileSync('./hpn-real-key.txt', 'utf8').trim();
  const secretKey = Buffer.from(privateKeyHex, 'hex');
  const walletKeypair = Keypair.fromSecretKey(secretKey);
  const walletAddress = walletKeypair.publicKey.toBase58();
  
  console.log(`📍 Wallet: ${walletAddress}`);
  
  // Get current balance
  const balance = await connection.getBalance(walletKeypair.publicKey);
  const solBalance = balance / LAMPORTS_PER_SOL;
  console.log(`💰 Current Balance: ${solBalance.toFixed(6)} SOL`);
  
  // Trade amount - use a small portion for real execution
  const tradeAmount = Math.min(solBalance * 0.05, 0.01); // 5% or max 0.01 SOL
  console.log(`💎 Trade Amount: ${tradeAmount.toFixed(6)} SOL`);
  
  try {
    // Get Jupiter quote
    console.log('📊 Getting Jupiter quote...');
    const params = new URLSearchParams({
      inputMint: 'So11111111111111111111111111111111111111112', // SOL
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      amount: Math.floor(tradeAmount * LAMPORTS_PER_SOL).toString(),
      slippageBps: '100'
    });
    
    const quoteResponse = await fetch(`https://quote-api.jup.ag/v6/quote?${params}`);
    
    if (!quoteResponse.ok) {
      throw new Error(`Quote failed: ${quoteResponse.status}`);
    }
    
    const quote = await quoteResponse.json();
    const outputAmount = parseInt(quote.outAmount) / 1000000; // Convert to USDC
    console.log(`✅ Quote: ${tradeAmount.toFixed(6)} SOL → ${outputAmount.toFixed(6)} USDC`);
    
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
    
    console.log('🚀 REAL TRANSACTION SENT!');
    console.log(`🔗 Signature: ${signature}`);
    console.log(`📊 Solscan: https://solscan.io/tx/${signature}`);
    
    // Wait for confirmation
    console.log('⏳ Waiting for confirmation...');
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.log(`❌ Transaction failed: ${confirmation.value.err}`);
    } else {
      console.log('✅ TRANSACTION CONFIRMED!');
      
      // Check new balance
      const newBalance = await connection.getBalance(walletKeypair.publicKey);
      const newSolBalance = newBalance / LAMPORTS_PER_SOL;
      const balanceChange = newSolBalance - solBalance;
      
      console.log(`💰 New Balance: ${newSolBalance.toFixed(6)} SOL`);
      console.log(`📈 Balance Change: ${balanceChange.toFixed(6)} SOL`);
      console.log('🎉 REAL TRADE EXECUTED SUCCESSFULLY!');
    }
    
  } catch (error) {
    console.error(`❌ Trade execution failed: ${(error as Error).message}`);
  }
}

executeRealTradeNow().catch(console.error);