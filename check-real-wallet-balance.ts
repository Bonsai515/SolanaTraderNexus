/**
 * Check Real Wallet Balance
 * 
 * This script checks the balance of the trading wallet using Helius RPC.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './.env.trading' });

// Trading wallet public key
const WALLET_PUBLIC_KEY = process.env.TRADING_WALLET_PUBLIC_KEY || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Helius RPC URL
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`;

// Check wallet balance
async function checkWalletBalance() {
  console.log('Checking real wallet balance...');
  
  try {
    // Create connection to Helius
    const connection = new Connection(HELIUS_RPC_URL, 'confirmed');
    
    // Get wallet public key
    const walletPublicKey = new PublicKey(WALLET_PUBLIC_KEY);
    
    // Get wallet SOL balance
    const balance = await connection.getBalance(walletPublicKey);
    const balanceSOL = balance / 1_000_000_000; // Convert lamports to SOL
    
    console.log('');
    console.log('==== WALLET DETAILS ====');
    console.log(`Wallet Address: ${WALLET_PUBLIC_KEY}`);
    console.log(`SOL Balance: ${balanceSOL.toFixed(6)} SOL`);
    
    // Calculate USD value (approximate)
    const solPriceUSD = 150; // Approximate SOL price in USD
    const balanceUSD = balanceSOL * solPriceUSD;
    console.log(`Approximate USD Value: $${balanceUSD.toFixed(2)}`);
    
    // Check if balance is sufficient for trading
    const MINIMUM_RECOMMENDED_BALANCE = 0.05; // 0.05 SOL
    if (balanceSOL < MINIMUM_RECOMMENDED_BALANCE) {
      console.log('');
      console.log('⚠️ WARNING: Wallet balance is below the recommended minimum of 0.05 SOL');
      console.log('Consider adding more SOL to your wallet for trading and gas fees.');
    } else {
      console.log('');
      console.log('✅ Wallet balance is sufficient for trading');
    }
    
    // Get token balances (simplified version)
    console.log('');
    console.log('Retrieving token balances...');
    const tokenBalances = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    if (tokenBalances.value.length > 0) {
      console.log('');
      console.log('==== TOKEN BALANCES ====');
      tokenBalances.value.forEach((tokenAccount) => {
        const parsedInfo = tokenAccount.account.data.parsed.info;
        const tokenAddress = parsedInfo.mint;
        const tokenAmount = parsedInfo.tokenAmount.uiAmount;
        const tokenName = parsedInfo.tokenAmount.decimals === 6 ? 'USDC' : 
                          tokenAddress.substring(0, 4) + '...' + tokenAddress.substring(tokenAddress.length - 4);
        
        if (tokenAmount > 0) {
          console.log(`${tokenName}: ${tokenAmount}`);
        }
      });
    } else {
      console.log('No SPL tokens found in wallet');
    }
    
    return balanceSOL;
  } catch (error) {
    console.error('Error checking wallet balance:', error);
    console.log('');
    console.log('⚠️ Failed to connect to Helius RPC');
    console.log('Make sure your HELIUS_API_KEY is set correctly in .env.trading');
    return 0;
  }
}

// Main function
async function main() {
  await checkWalletBalance();
}

// Run main function
main().catch(console.error);