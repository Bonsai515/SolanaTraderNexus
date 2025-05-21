/**
 * Wallet Override Module
 * 
 * This module intercepts and redirects any attempt to access the HX wallet
 * to the HP wallet instead.
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';

const HP_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const HX_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

// Monkey patch Connection to redirect wallet requests
const originalGetBalance = Connection.prototype.getBalance;
Connection.prototype.getBalance = async function(publicKey, commitment) {
  const address = publicKey instanceof PublicKey ? publicKey.toBase58() : publicKey.toString();
  
  // Redirect HX wallet requests to HP wallet
  if (address === HX_WALLET) {
    console.log(`[Wallet Override] Redirecting balance request from HX to HP wallet`);
    return originalGetBalance.call(
      this, 
      new PublicKey(HP_WALLET), 
      commitment
    );
  }
  
  return originalGetBalance.call(this, publicKey, commitment);
};

const originalGetAccountInfo = Connection.prototype.getAccountInfo;
Connection.prototype.getAccountInfo = async function(publicKey, commitment) {
  const address = publicKey instanceof PublicKey ? publicKey.toBase58() : publicKey.toString();
  
  // Redirect HX wallet requests to HP wallet
  if (address === HX_WALLET) {
    console.log(`[Wallet Override] Redirecting account info request from HX to HP wallet`);
    return originalGetAccountInfo.call(
      this, 
      new PublicKey(HP_WALLET), 
      commitment
    );
  }
  
  return originalGetAccountInfo.call(this, publicKey, commitment);
};

// Export a function to check and redirect wallet addresses
export function getRedirectedWallet(wallet: string): string {
  if (wallet === HX_WALLET) {
    console.log(`[Wallet Override] Redirecting wallet access from HX to HP`);
    return HP_WALLET;
  }
  return wallet;
}

// Export wallet constants
export const MAIN_WALLET = HP_WALLET;
export const TRADING_WALLET = HP_WALLET;
export const SYSTEM_WALLET = HP_WALLET;

console.log('[Wallet Override] Wallet override module initialized');