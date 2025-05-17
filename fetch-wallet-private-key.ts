/**
 * Fetch Wallet Private Key
 * 
 * This script locates and securely extracts the private key
 * for the system wallet from data/wallets.json
 */

import fs from 'fs';
import path from 'path';

// System wallet address
const SYSTEM_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

interface WalletData {
  wallets: {
    address: string;
    privateKey?: string;
    secretKey?: string;
  }[];
}

/**
 * Find wallet private key in data/wallets.json
 */
function findWalletPrivateKey(): string | null {
  try {
    // Check if wallets.json exists
    const walletsPath = path.join(process.cwd(), 'data', 'wallets.json');
    if (!fs.existsSync(walletsPath)) {
      console.log('wallets.json not found at', walletsPath);
      return null;
    }
    
    // Read wallet data
    const walletDataRaw = fs.readFileSync(walletsPath, 'utf-8');
    const walletData: WalletData = JSON.parse(walletDataRaw);
    
    // Find our system wallet
    const wallet = walletData.wallets.find(w => w.address === SYSTEM_WALLET_ADDRESS);
    if (!wallet) {
      console.log(`Wallet with address ${SYSTEM_WALLET_ADDRESS} not found`);
      return null;
    }
    
    // Return private key
    return wallet.privateKey || wallet.secretKey || null;
  } catch (error) {
    console.error('Error finding wallet private key:', error);
    return null;
  }
}

/**
 * Main function
 */
function main() {
  const privateKey = findWalletPrivateKey();
  if (privateKey) {
    console.log(`Private key found for wallet ${SYSTEM_WALLET_ADDRESS}`);
    
    // Set it in environment variable
    process.env.WALLET_PRIVATE_KEY = privateKey;
    
    // Export for use by other scripts
    console.log('export WALLET_PRIVATE_KEY=', privateKey);
    
    // Return success
    return true;
  } else {
    console.error(`No private key found for wallet ${SYSTEM_WALLET_ADDRESS}`);
    return false;
  }
}

main();