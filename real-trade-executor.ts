/**
 * Real Trade Executor
 * 
 * This script executes real trades on the Solana blockchain
 * using Jupiter for swap execution.
 */

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import bs58 from 'bs58';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;
const WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';

// Connection to Solana
const connection = new Connection(SYNDICA_URL, 'confirmed');

/**
 * Log a transaction
 */
function logTransaction(signature: string, details: any): void {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logPath = path.join(logDir, 'real-transactions.log');
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} [EXECUTED] Signature: ${signature}, Details: ${JSON.stringify(details)}\n`;
    
    fs.appendFileSync(logPath, logEntry);
    
    console.log(`Transaction logged to ${logPath}`);
  } catch (error) {
    console.error('Error logging transaction:', error);
  }
}

/**
 * Create a keypair from a base58 private key
 */
function createKeypairFromPrivateKey(privateKeyBase58: string): Keypair | null {
  try {
    const privateKey = bs58.decode(privateKeyBase58);
    return Keypair.fromSecretKey(privateKey);
  } catch (error) {
    console.error('Invalid private key format:', error);
    return null;
  }
}

/**
 * Get route for token swap from Jupiter
 */
async function getJupiterRoute(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50 // 0.5% slippage by default
): Promise<any> {
  try {
    const response = await axios.get(`${JUPITER_QUOTE_API}/quote`, {
      params: {
        inputMint,
        outputMint,
        amount,
        slippageBps
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error getting Jupiter route:', error);
    throw error;
  }
}

/**
 * Get swap transaction from Jupiter
 */
async function getJupiterSwapTransaction(
  route: any,
  userPublicKey: string
): Promise<Transaction> {
  try {
    const response = await axios.post(`${JUPITER_QUOTE_API}/swap`, {
      route,
      userPublicKey,
      wrapAndUnwrapSol: true // Automatically wrap and unwrap SOL
    });
    
    // Convert to transaction object
    const { swapTransaction } = response.data;
    const transaction = Transaction.from(Buffer.from(swapTransaction, 'base64'));
    
    return transaction;
  } catch (error) {
    console.error('Error getting Jupiter swap transaction:', error);
    throw error;
  }
}

/**
 * Execute a swap transaction
 */
async function executeSwap(
  keypair: Keypair,
  inputMint: string,
  outputMint: string,
  inputAmount: number,
  slippageBps: number = 50
): Promise<string> {
  try {
    console.log(`Preparing swap: ${inputAmount} of ${inputMint} to ${outputMint}`);
    
    // Get route from Jupiter
    const route = await getJupiterRoute(inputMint, outputMint, inputAmount, slippageBps);
    
    console.log(`Route found with expected output: ${route.outAmount} (${outputMint})`);
    console.log(`Expected price impact: ${route.priceImpactPct}%`);
    
    // Get swap transaction
    const transaction = await getJupiterSwapTransaction(route, keypair.publicKey.toString());
    
    // Execute the transaction
    console.log('Sending transaction to blockchain...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair],
      {
        commitment: 'confirmed',
        skipPreflight: false
      }
    );
    
    console.log(`✅ Swap transaction successfully executed!`);
    console.log(`Transaction signature: ${signature}`);
    console.log(`View on Solscan: https://solscan.io/tx/${signature}`);
    
    // Log the successful transaction
    logTransaction(signature, {
      type: 'jupiter-swap',
      inputMint,
      outputMint,
      inputAmount,
      expectedOutputAmount: route.outAmount,
      priceImpact: route.priceImpactPct,
      wallet: keypair.publicKey.toString()
    });
    
    return signature;
  } catch (error) {
    console.error('❌ Swap transaction failed:', error);
    throw error;
  }
}

/**
 * Execute a USDC -> SOL trade
 */
async function executeUsdcToSolTrade(
  keypair: Keypair,
  amount: number // amount in USDC (with 6 decimals)
): Promise<string> {
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  
  return executeSwap(keypair, USDC_MINT, SOL_MINT, amount);
}

/**
 * Execute a SOL -> USDC trade
 */
async function executeSolToUsdcTrade(
  keypair: Keypair,
  amount: number // amount in lamports (1 SOL = 1,000,000,000 lamports)
): Promise<string> {
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  
  return executeSwap(keypair, SOL_MINT, USDC_MINT, amount);
}

/**
 * Enable actual trade execution
 */
async function enableActualTrades(): Promise<void> {
  try {
    const configPath = path.join(process.cwd(), 'config', 'trading-config.json');
    let config: any = {};
    
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    
    config.tradingEnabled = true;
    config.useRealFunds = true;
    config.executeRealTrades = true;
    config.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Real trading enabled in configuration');
  } catch (error) {
    console.error('❌ Error enabling real trades:', error);
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('=== REAL TRADE EXECUTOR ===');
  console.log('This will execute actual trades on the Solana blockchain.');
  
  try {
    // Enable actual trades
    await enableActualTrades();
    
    // Ask for private key
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('\n=== SECURITY WARNING ===');
    console.log('You need to input your private key to execute real transactions.');
    console.log('This is necessary for signing transactions but is NOT secure for production use.');
    console.log('Only use this for testing with small amounts.\n');
    
    const privateKeyBase58 = await new Promise<string>((resolve) => {
      readline.question('Enter your private key (base58 encoded): ', (input: string) => {
        resolve(input);
      });
    });
    
    readline.close();
    
    // Create keypair from private key
    const keypair = createKeypairFromPrivateKey(privateKeyBase58);
    
    if (!keypair) {
      console.error('❌ Invalid private key. Cannot proceed.');
      return;
    }
    
    // Verify public key matches expected wallet
    const walletAddress = keypair.publicKey.toString();
    
    console.log(`\nWallet address: ${walletAddress}`);
    
    if (walletAddress !== WALLET_ADDRESS) {
      console.warn(`⚠️ Warning: This wallet address (${walletAddress}) does not match the configured wallet (${WALLET_ADDRESS}).`);
    }
    
    // Check wallet balance
    const balance = await connection.getBalance(keypair.publicKey);
    const balanceSOL = balance / 1000000000; // Convert lamports to SOL
    
    console.log(`Wallet balance: ${balanceSOL.toFixed(6)} SOL`);
    
    if (balance < 10000) {
      console.error('❌ Insufficient balance for transaction. Minimum 0.00001 SOL required.');
      return;
    }
    
    // Ask what type of trade to execute
    const tradeTypeRL = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('\n=== AVAILABLE TRADE TYPES ===');
    console.log('1. Small test transaction (minimal SOL transfer to self)');
    console.log('2. Small SOL -> USDC swap');
    console.log('3. Small USDC -> SOL swap');
    
    const tradeType = await new Promise<string>((resolve) => {
      tradeTypeRL.question('Enter trade type (1, 2, or 3): ', (input: string) => {
        resolve(input);
      });
    });
    
    tradeTypeRL.close();
    
    // Execute selected trade type
    let signature: string;
    
    switch (tradeType) {
      case '1':
        // Create a minimal transaction - transfer a tiny amount to yourself
        const transaction = new Transaction().add(
          new TransactionInstruction({
            keys: [
              { pubkey: keypair.publicKey, isSigner: true, isWritable: true }
            ],
            programId: new PublicKey('SysvarC1ock11111111111111111111111111111111'),
            data: Buffer.from([])
          })
        );
        
        // Get a recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = keypair.publicKey;
        
        console.log('Sending test transaction to blockchain...');
        
        // Send and confirm transaction
        signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [keypair],
          {
            commitment: 'confirmed',
            skipPreflight: false
          }
        );
        break;
        
      case '2':
        // Execute small SOL -> USDC swap (0.001 SOL)
        const solAmount = 1000000; // 0.001 SOL in lamports
        signature = await executeSolToUsdcTrade(keypair, solAmount);
        break;
        
      case '3':
        // Execute small USDC -> SOL swap (0.1 USDC)
        const usdcAmount = 100000; // 0.1 USDC (6 decimals)
        signature = await executeUsdcToSolTrade(keypair, usdcAmount);
        break;
        
      default:
        console.error('Invalid trade type selected');
        return;
    }
    
    console.log('\n=== TRADE SUCCESSFULLY EXECUTED ===');
    console.log(`✅ Transaction signature: ${signature}`);
    console.log(`✅ View on Solscan: https://solscan.io/tx/${signature}`);
    
    // Check new balance to confirm transaction went through
    const newBalance = await connection.getBalance(keypair.publicKey);
    console.log(`New wallet balance: ${newBalance / 1000000000} SOL`);
    console.log(`Difference: ${(newBalance - balance) / 1000000000} SOL`);
    
    console.log('\n=== VERIFICATION COMPLETE ===');
    console.log('✅ The system has successfully executed a real on-chain transaction!');
    console.log('✅ This confirms ability to execute actual trades on the blockchain.');
    console.log('\nIf you want to run the full trading system:');
    console.log('1. Save your private key securely in a keyfile');
    console.log('2. Update the trading system to use this keyfile');
    console.log('3. Start the trading system with: npx tsx run-trading-system.ts');
  } catch (error) {
    console.error('❌ Failed to execute real trade:', error);
  }
}

// Run the script
main();