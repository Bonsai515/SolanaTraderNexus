/**
 * Wallet Connector Module for Real Blockchain Trading
 * Handles secure wallet operations using the actual trading wallet
 */

import { Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Wallet address constants
export const WALLET_PUBLIC_KEY = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

/**
 * Gets a Keypair for the trading wallet
 * Note: For production, this would use the actual private key
 * For demonstration, we're using a public key only wallet for monitoring
 */
export function getTradeWallet(): { publicKey: PublicKey, secretKey?: Uint8Array } {
  console.log('Initializing wallet with address:', WALLET_PUBLIC_KEY);
  
  try {
    // Create a read-only wallet from the public key
    return {
      publicKey: new PublicKey(WALLET_PUBLIC_KEY)
    };
  } catch (error) {
    console.error('Error initializing wallet:', error);
    throw new Error('Failed to initialize wallet');
  }
}

/**
 * Checks if the wallet has sufficient balance for trading
 */
export function isSufficientBalance(balanceInLamports: number): boolean {
  // Convert lamports to SOL (1 SOL = 1,000,000,000 lamports)
  const balanceInSOL = balanceInLamports / 1_000_000_000;
  
  // Minimum required balance for trading (0.05 SOL)
  const minRequiredSOL = 0.05;
  
  return balanceInSOL >= minRequiredSOL;
}

/**
 * Calculates maximum position size based on balance
 */
export function calculateMaxPositionSize(balanceInLamports: number): number {
  // Convert lamports to SOL
  const balanceInSOL = balanceInLamports / 1_000_000_000;
  
  // Reserve 0.02 SOL for transaction fees
  const reserveForFees = 0.02;
  const availableForTrading = Math.max(0, balanceInSOL - reserveForFees);
  
  // Maximum position size is 90% of available balance
  return availableForTrading * 0.9;
}

/**
 * Format SOL balance with appropriate precision
 */
export function formatSOLBalance(balanceInLamports: number): string {
  const balanceInSOL = balanceInLamports / 1_000_000_000;
  return balanceInSOL.toFixed(6);
}

/**
 * Logs wallet status information
 */
export function logWalletStatus(balanceInLamports: number): void {
  const balanceInSOL = balanceInLamports / 1_000_000_000;
  const usdValue = balanceInSOL * 150; // Approximate SOL price in USD
  
  console.log('\n==== WALLET STATUS ====');
  console.log(`Address: ${WALLET_PUBLIC_KEY}`);
  console.log(`Balance: ${formatSOLBalance(balanceInLamports)} SOL ($${usdValue.toFixed(2)})`);
  console.log(`Available for trading: ${calculateMaxPositionSize(balanceInLamports).toFixed(6)} SOL`);
  console.log('=======================\n');
}