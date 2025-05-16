/**
 * Verify Main Wallet Private Key
 * 
 * This script verifies if the provided private key matches
 * the HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb wallet.
 */

import { Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Main wallet details
const MAIN_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
const PROVIDED_PRIVATE_KEY = '793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f';

// Create keypair from hex private key
function createKeypairFromHexPrivateKey(hexPrivateKey: string): Keypair {
  try {
    const privateKeyBuffer = Buffer.from(hexPrivateKey, 'hex');
    
    if (privateKeyBuffer.length !== 64) {
      throw new Error(`Invalid private key length: ${privateKeyBuffer.length}`);
    }
    
    return Keypair.fromSecretKey(privateKeyBuffer);
  } catch (error) {
    console.error('Failed to create keypair:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('🔍 VERIFYING MAIN WALLET PRIVATE KEY');
  console.log('=============================================\n');
  
  try {
    // Create keypair from provided private key
    console.log(`Creating keypair from provided private key...`);
    const keypair = createKeypairFromHexPrivateKey(PROVIDED_PRIVATE_KEY);
    
    // Get public key from keypair
    const publicKey = keypair.publicKey.toString();
    
    console.log(`Derived public key: ${publicKey}`);
    console.log(`Expected public key: ${MAIN_WALLET_ADDRESS}`);
    
    // Check if public keys match
    if (publicKey === MAIN_WALLET_ADDRESS) {
      console.log(`\n✅ SUCCESS! Private key matches the wallet with 9.9 SOL`);
      
      // Store the verified key in a secure file
      const nexusDir = path.join('./data', 'nexus');
      if (!fs.existsSync(nexusDir)) {
        fs.mkdirSync(nexusDir, { recursive: true });
      }
      
      const keyData = {
        wallets: [
          {
            address: MAIN_WALLET_ADDRESS,
            privateKey: PROVIDED_PRIVATE_KEY,
            type: 'trading',
            label: 'Main Trading Wallet (9.9 SOL)'
          }
        ],
        timestamp: new Date().toISOString()
      };
      
      const privateKeyPath = path.join(nexusDir, 'keys.json');
      fs.writeFileSync(privateKeyPath, JSON.stringify(keyData, null, 2));
      console.log(`Private key stored at ${privateKeyPath}`);
      
      return true;
    } else {
      console.log(`\n❌ MISMATCH! The provided private key does not match the wallet with 9.9 SOL`);
      return false;
    }
  } catch (error) {
    console.error('Error verifying private key:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run the script
main();