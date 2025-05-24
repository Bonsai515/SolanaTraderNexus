/**
 * Convert USDC and BONK to SOL
 * Check balances and convert all tokens to SOL for maximum accumulation
 */

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  VersionedTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as fs from 'fs';

async function convertTokensToSOL() {
  console.log('🚀 CONVERTING USDC AND BONK TO SOL...');
  
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
    // Get all token accounts
    console.log('\n📊 Checking token balances...');
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletKeypair.publicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    let usdcBalance = 0;
    let bonkBalance = 0;
    let conversions = [];
    
    // Check each token account
    for (const account of tokenAccounts.value) {
      const mint = account.account.data.parsed.info.mint;
      const balance = account.account.data.parsed.info.tokenAmount.uiAmount;
      
      if (balance > 0) {
        console.log(`💎 Found token: ${mint} - Balance: ${balance}`);
        
        // USDC
        if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
          usdcBalance = balance;
          console.log(`💰 USDC Balance: ${usdcBalance.toFixed(6)} USDC`);
        }
        
        // BONK
        if (mint === 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263') {
          bonkBalance = balance;
          console.log(`🐕 BONK Balance: ${bonkBalance.toLocaleString()} BONK`);
        }
      }
    }
    
    // Convert USDC to SOL if balance > 0.5
    if (usdcBalance > 0.5) {
      console.log(`\n🔄 Converting ${usdcBalance.toFixed(6)} USDC to SOL...`);
      
      const usdcSignature = await convertTokenToSOL(
        connection,
        walletKeypair,
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
        Math.floor(usdcBalance * 1000000), // USDC has 6 decimals
        'USDC'
      );
      
      if (usdcSignature) {
        conversions.push({ token: 'USDC', amount: usdcBalance, signature: usdcSignature });
      }
    }
    
    // Convert BONK to SOL if balance > 1000
    if (bonkBalance > 1000) {
      console.log(`\n🔄 Converting ${bonkBalance.toLocaleString()} BONK to SOL...`);
      
      // Convert 50% of BONK (to avoid liquidity issues)
      const bonkToConvert = Math.floor(bonkBalance * 0.5);
      
      const bonkSignature = await convertTokenToSOL(
        connection,
        walletKeypair,
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK mint
        Math.floor(bonkToConvert * Math.pow(10, 5)), // BONK has 5 decimals
        'BONK'
      );
      
      if (bonkSignature) {
        conversions.push({ token: 'BONK', amount: bonkToConvert, signature: bonkSignature });
      }
    }
    
    // Check final SOL balance
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for transactions
    
    const finalSolBalance = await connection.getBalance(walletKeypair.publicKey);
    const finalSOL = finalSolBalance / LAMPORTS_PER_SOL;
    const solGained = finalSOL - currentSOL;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TOKEN TO SOL CONVERSION RESULTS');
    console.log('='.repeat(60));
    console.log(`📍 Wallet: ${walletAddress}`);
    console.log(`💰 Starting SOL: ${currentSOL.toFixed(6)} SOL`);
    console.log(`💰 Final SOL: ${finalSOL.toFixed(6)} SOL`);
    console.log(`📈 SOL Gained: ${solGained.toFixed(6)} SOL`);
    console.log(`💎 USDC Found: ${usdcBalance.toFixed(6)} USDC`);
    console.log(`🐕 BONK Found: ${bonkBalance.toLocaleString()} BONK`);
    
    if (conversions.length > 0) {
      console.log('\n🔗 CONVERSION TRANSACTIONS:');
      conversions.forEach((conversion, index) => {
        console.log(`${index + 1}. ${conversion.token} → SOL:`);
        console.log(`   Amount: ${conversion.amount.toLocaleString()}`);
        console.log(`   Signature: ${conversion.signature}`);
        console.log(`   Solscan: https://solscan.io/tx/${conversion.signature}`);
      });
    }
    
    console.log('\n✅ TOKEN CONVERSION COMPLETE!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error(`❌ Token conversion failed: ${(error as Error).message}`);
  }
}

async function convertTokenToSOL(
  connection: Connection,
  walletKeypair: Keypair,
  inputMint: string,
  amount: number,
  tokenName: string
): Promise<string | null> {
  
  try {
    console.log(`📊 Getting Jupiter quote for ${tokenName}...`);
    
    // Get Jupiter quote
    const params = new URLSearchParams({
      inputMint: inputMint,
      outputMint: 'So11111111111111111111111111111111111111112', // SOL
      amount: amount.toString(),
      slippageBps: '200' // 2% slippage for token conversions
    });
    
    const quoteResponse = await fetch(`https://quote-api.jup.ag/v6/quote?${params}`);
    
    if (!quoteResponse.ok) {
      console.log(`❌ ${tokenName} quote failed: ${quoteResponse.status}`);
      return null;
    }
    
    const quote = await quoteResponse.json();
    const outputSOL = parseInt(quote.outAmount) / LAMPORTS_PER_SOL;
    console.log(`✅ Quote: ${tokenName} → ${outputSOL.toFixed(6)} SOL`);
    
    // Get swap transaction
    console.log(`🔄 Building ${tokenName} swap transaction...`);
    const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: walletKeypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        computeUnitPriceMicroLamports: 200000
      })
    });
    
    if (!swapResponse.ok) {
      console.log(`❌ ${tokenName} swap failed: ${swapResponse.status}`);
      return null;
    }
    
    const swapData = await swapResponse.json();
    console.log(`✅ ${tokenName} swap transaction built`);
    
    // Sign and send transaction
    console.log(`✍️ Signing and sending ${tokenName} transaction...`);
    const transactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(transactionBuf);
    
    transaction.sign([walletKeypair]);
    
    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });
    
    console.log(`🚀 ${tokenName} CONVERSION SENT!`);
    console.log(`🔗 Signature: ${signature}`);
    
    // Wait for confirmation
    console.log(`⏳ Waiting for ${tokenName} confirmation...`);
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.log(`❌ ${tokenName} transaction failed: ${confirmation.value.err}`);
      return null;
    }
    
    console.log(`✅ ${tokenName} → SOL CONVERSION CONFIRMED!`);
    return signature;
    
  } catch (error) {
    console.log(`❌ ${tokenName} conversion error: ${(error as Error).message}`);
    return null;
  }
}

convertTokensToSOL().catch(console.error);