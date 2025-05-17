/**
 * Export Wallet Private Key
 * 
 * This script exports the private key for the wallet in various formats
 * so it can be used in other applications.
 */

import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';

// The private key in hex format
const WALLET_PRIVATE_KEY = '793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f';

function main() {
  console.log('=============================================');
  console.log('🔑 WALLET PRIVATE KEY EXPORT');
  console.log('=============================================\n');
  
  try {
    // Create keypair from the private key
    const privateKeyBuffer = Buffer.from(WALLET_PRIVATE_KEY, 'hex');
    const keypair = Keypair.fromSecretKey(privateKeyBuffer);
    
    // Verify the keypair
    const publicKey = keypair.publicKey.toString();
    console.log(`Public Key: ${publicKey}`);
    
    // Export in various formats
    console.log('\n----- Hex Format (for TypeScript/JavaScript) -----');
    console.log(WALLET_PRIVATE_KEY);
    
    // Export as uint8array format (common in Solana libraries)
    console.log('\n----- Uint8Array Format (for Solana JS libraries) -----');
    console.log(`[${Array.from(privateKeyBuffer).join(', ')}]`);
    
    // Export for use with solana-keygen
    console.log('\n----- Save to File for solana-keygen -----');
    const exportDir = './export';
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // Export as binary file for solana tools
    const keypairBin = new Uint8Array(64);
    privateKeyBuffer.copy(keypairBin, 0, 0, 64);
    const keypairPath = `${exportDir}/wallet-keypair.bin`;
    fs.writeFileSync(keypairPath, keypairBin);
    console.log(`Exported binary keypair file to: ${keypairPath}`);
    
    // Export for node.js
    console.log('\n----- For Node.js -----');
    console.log(`export PRIVATE_KEY="${WALLET_PRIVATE_KEY}"`);
    
    // Export for shell scripts
    console.log('\n----- For Shell Scripts -----');
    console.log(`PRIVATE_KEY="${WALLET_PRIVATE_KEY}"`);
    
    console.log('\n=============================================');
    console.log('✅ Wallet private key successfully exported');
    console.log('=============================================');
    
    return true;
  } catch (error) {
    console.error('Error exporting private key:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

main();