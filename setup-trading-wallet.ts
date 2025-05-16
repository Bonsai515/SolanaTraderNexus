/**
 * Set up Trading Wallet Private Key
 * 
 * This script sets the trading wallet private key as an environment variable
 * for actual transaction signing.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './server/logger';

// Read data from wallet.json
try {
  const walletData = fs.readFileSync('./wallet.json', 'utf-8');
  const walletBytes = JSON.parse(walletData);
  
  console.log('Found wallet data in wallet.json');
  
  // Read wallet information from data/wallets.json
  const walletsData = fs.readFileSync('./data/wallets.json', 'utf-8');
  const wallets = JSON.parse(walletsData);
  
  // The first wallet is our main trading wallet
  const mainWallet = wallets.find(w => w.publicKey === 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb');
  
  if (!mainWallet) {
    throw new Error('Main wallet HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb not found in wallets.json');
  }
  
  // Add the private key to the main wallet
  mainWallet.privateKey = Buffer.from(walletBytes).toString('hex');
  
  // Save updated wallet information
  fs.writeFileSync('./data/wallets.json', JSON.stringify(wallets, null, 2));
  
  console.log('✅ Successfully set up trading wallet private key');
  console.log('Now you can restart the system to enable actual trading');
} catch (error) {
  console.error('❌ Error setting up trading wallet:', error instanceof Error ? error.message : String(error));
}