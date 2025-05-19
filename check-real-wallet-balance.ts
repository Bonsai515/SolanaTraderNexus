/**
 * Check Real Wallet Balance
 * 
 * This script checks the balance of the trading wallet and verifies
 * it has sufficient funds for real blockchain trading.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Wallet address to check
const WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Minimum balance required for trading (0.05 SOL)
const MIN_BALANCE_SOL = 0.05;

// Current approximate SOL price in USD
const SOL_PRICE_USD = 150;

async function checkWalletBalance() {
  console.log('Checking real wallet balance...');
  
  try {
    // Establish connection to Solana blockchain
    const connection = new Connection(
      process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
    
    // Get wallet public key
    const walletPublicKey = new PublicKey(WALLET_ADDRESS);
    
    // Check SOL balance
    const balance = await connection.getBalance(walletPublicKey);
    const balanceInSOL = balance / LAMPORTS_PER_SOL;
    const usdValue = balanceInSOL * SOL_PRICE_USD;
    
    console.log('\n==== WALLET DETAILS ====');
    console.log(`Wallet Address: ${WALLET_ADDRESS}`);
    console.log(`SOL Balance: ${balanceInSOL.toFixed(6)} SOL`);
    console.log(`Approximate USD Value: $${usdValue.toFixed(2)}`);
    
    // Check if wallet has sufficient balance for trading
    if (balanceInSOL < MIN_BALANCE_SOL) {
      console.log(`\n⚠️  Insufficient balance for trading. Minimum required: ${MIN_BALANCE_SOL} SOL`);
      process.exit(1);
    } else {
      console.log('\n✅ Wallet balance is sufficient for trading');
    }
    
    // Get SPL token balances
    console.log('\nRetrieving token balances...');
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    if (tokenAccounts.value.length === 0) {
      console.log('No SPL tokens found in wallet');
    } else {
      console.log('\n==== TOKEN BALANCES ====');
      tokenAccounts.value.forEach((tokenAccount) => {
        const accountData = tokenAccount.account.data.parsed.info;
        const mintAddress = accountData.mint;
        const tokenBalance = accountData.tokenAmount.uiAmount;
        
        if (tokenBalance > 0) {
          console.log(`${mintAddress}: ${tokenBalance}`);
        }
      });
    }
  } catch (error) {
    console.error('Error checking wallet balance:', error);
    process.exit(1);
  }
}

// Run the balance check
checkWalletBalance();