
// This file provides access to the trading wallet
// The private key is stored in an environment variable for security
// and accessed only during execution of trades

import { Keypair } from '@solana/web3.js';

export function getTradingWallet(): Keypair {
  // Get key from environment or direct access
  const privateKeyString = process.env.TRADING_WALLET_PRIVATE_KEY;
  
  // We already have the private key - no need to input it again
  if (privateKeyString) {
    try {
      const privateKeyBytes = Buffer.from(privateKeyString, 'hex');
      return Keypair.fromSecretKey(privateKeyBytes);
    } catch (error) {
      console.error('Error creating keypair from private key:', error);
      throw new Error('Invalid private key format');
    }
  }
  
  throw new Error('Trading wallet private key not found');
}
