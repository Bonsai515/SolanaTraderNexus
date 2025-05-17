/**
 * Comprehensive Key Export Utility
 * 
 * This script exports all wallet private keys in multiple formats and searches
 * for additional wallets in the system.
 */

import { Keypair, PublicKey, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Known wallet private keys
const WALLETS = [
  {
    name: "Accessible Wallet",
    privateKey: "793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f",
    expectedAddress: "4MyfJj413sqtbLaEub8kw6qPsazAE6T4EhjgaxHWcrdC"
  },
  {
    name: "Prophet Wallet",
    privateKey: "d28c249469fd4ba35a58800b64e38ccbe22db4df2e115647aa85ff75d5a94544401f38419785a5c053f82d85106a0a1c737619ab0dff383aa24ae8ec4ffde787",
    expectedAddress: "5KJhonWngrkP8qtzf69F7trirJubtqVM7swsR7Apr2fG"
  },
  {
    name: "Trading Wallet 1",
    privateKey: "b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da",
    expectedAddress: "HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
  },
  {
    name: "Trading Wallet 2",
    privateKey: "69995cf93de5220f423e76cd73cbe2eea129d0b42ea00c0322d804745ec6c7bff1d6337eb1eefbc8e5d45d65e51bdcff596aeec7b957f34d2d910dd3da11f6d6",
    expectedAddress: "HH2hMVDuw4WT8QoGTBZX2H5BPWubDL9BFemH6UhhDPYR"
  }
];

// HX wallet address
const HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

// Create export directory if it doesn't exist
const exportDir = './export';
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

// Setup RPC connection
async function setupConnection(): Promise<Connection> {
  // Use Alchemy RPC URL if available, otherwise fallback to Solana Mainnet
  const rpcUrl = process.env.ALCHEMY_API_KEY 
    ? `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : 'https://api.mainnet-beta.solana.com';
  
  console.log(`Using RPC URL: ${rpcUrl}`);
  return new Connection(rpcUrl, 'confirmed');
}

// Check wallet balance
async function checkWalletBalance(connection: Connection, walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    console.log(`Balance of ${walletAddress}: ${solBalance.toFixed(6)} SOL`);
    return solBalance;
  } catch (error) {
    console.error(`Error checking balance for ${walletAddress}:`, error);
    return 0;
  }
}

// Export private key in multiple formats
function exportPrivateKey(name: string, privateKeyHex: string, expectedAddress: string | null = null): boolean {
  console.log(`\n----- EXPORTING KEY FOR ${name} -----`);
  
  try {
    // Create keypair from private key
    const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
    const keypair = Keypair.fromSecretKey(privateKeyBuffer);
    
    // Verify the keypair
    const publicKey = keypair.publicKey.toString();
    console.log(`Public Key: ${publicKey}`);
    
    if (expectedAddress && publicKey !== expectedAddress) {
      console.log(`WARNING: Generated public key doesn't match expected address: ${expectedAddress}`);
    }
    
    // Create a filename based on the wallet name
    const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    // 1. Export in hex format
    console.log('\n# Hex Format (for TypeScript/JavaScript)');
    console.log(privateKeyHex);
    fs.writeFileSync(`${exportDir}/${safeName}_hex.txt`, privateKeyHex);
    
    // 2. Export as uint8array format (common in Solana libraries)
    console.log('\n# Uint8Array Format (for Solana JS libraries)');
    const uint8ArrayStr = `[${Array.from(privateKeyBuffer).join(', ')}]`;
    console.log(uint8ArrayStr);
    fs.writeFileSync(`${exportDir}/${safeName}_uint8array.txt`, uint8ArrayStr);
    
    // 3. Export for environment variables
    console.log('\n# For Environment Variables');
    console.log(`export ${safeName.toUpperCase()}_PRIVATE_KEY="${privateKeyHex}"`);
    fs.writeFileSync(`${exportDir}/${safeName}_env.sh`, `export ${safeName.toUpperCase()}_PRIVATE_KEY="${privateKeyHex}"`);
    
    // 4. Export as binary file for solana tools
    const keypairBin = new Uint8Array(64);
    privateKeyBuffer.copy(keypairBin, 0, 0, 64);
    const keypairPath = `${exportDir}/${safeName}.bin`;
    fs.writeFileSync(keypairPath, keypairBin);
    console.log(`\n# Binary keypair file saved to: ${keypairPath}`);
    
    // 5. Export JSON format for solana tools
    const jsonFormat = JSON.stringify([...keypairBin]);
    fs.writeFileSync(`${exportDir}/${safeName}.json`, jsonFormat);
    console.log(`# JSON keypair file saved to: ${exportDir}/${safeName}.json`);
    
    // 6. Create shell script to execute with this wallet
    const shellScript = `
#!/bin/bash

# Shell script for executing transactions with ${name}
# Public key: ${publicKey}

# Export private key
export PRIVATE_KEY="${privateKeyHex}"

# Execute the Day 4 strategy with this wallet
npx tsx execute-day4-strategy.ts $@
`;
    fs.writeFileSync(`${exportDir}/run_with_${safeName}.sh`, shellScript);
    fs.chmodSync(`${exportDir}/run_with_${safeName}.sh`, 0o755);
    console.log(`# Shell script created: ${exportDir}/run_with_${safeName}.sh`);
    
    return true;
  } catch (error) {
    console.error('Error exporting private key:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Continue searching for the HX wallet private key in additional locations
async function continueSearchForHXWallet(): Promise<void> {
  console.log('\n\n===== EXTENSIVE SEARCH FOR HX WALLET PRIVATE KEY =====');
  
  // Search pattern for private keys (hex format)
  const hexKeyPattern = /[0-9a-f]{128}/gi;
  
  // Additional locations to search
  const searchLocations = [
    './data', 
    './nexus_engine',
    './server',
    './src',
    './shared',
    './client'
  ];

  for (const location of searchLocations) {
    if (!fs.existsSync(location)) continue;
    
    console.log(`\nSearching in ${location}...`);
    
    try {
      // Get list of files with recursive search
      const getFilesRecursively = (dir: string): string[] => {
        let results: string[] = [];
        try {
          const list = fs.readdirSync(dir);
          
          for (const file of list) {
            const fullPath = path.join(dir, file);
            try {
              const stat = fs.statSync(fullPath);
              
              if (stat.isDirectory()) {
                if (!['.git', 'node_modules', 'target', '.cache'].includes(file)) {
                  results = results.concat(getFilesRecursively(fullPath));
                }
              } else if (
                fullPath.endsWith('.json') || 
                fullPath.endsWith('.ts') || 
                fullPath.endsWith('.js') || 
                fullPath.endsWith('.txt') || 
                fullPath.endsWith('.key')
              ) {
                results.push(fullPath);
              }
            } catch (err) {
              // Skip files we can't access
            }
          }
        } catch (err) {
          // Skip directories we can't access
        }
        return results;
      };
      
      const files = getFilesRecursively(location);
      
      console.log(`Found ${files.length} files to search through...`);
      
      // Process files in smaller batches to prevent memory issues
      const BATCH_SIZE = 20;
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        
        for (const file of batch) {
          try {
            const content = fs.readFileSync(file, 'utf8');
            
            // Look for hex private keys
            const matches = content.match(hexKeyPattern);
            if (matches && matches.length > 0) {
              console.log(`\nFound ${matches.length} potential private key(s) in ${file}`);
              
              for (const potentialKey of matches) {
                try {
                  // Skip already known keys
                  if (WALLETS.some(w => w.privateKey === potentialKey)) {
                    continue;
                  }
                  
                  // Create keypair from hex private key
                  const privateKeyBuffer = Buffer.from(potentialKey, 'hex');
                  const keypair = Keypair.fromSecretKey(privateKeyBuffer);
                  const generatedAddress = keypair.publicKey.toString();
                  
                  // Check if this is the HX wallet
                  if (generatedAddress === HX_WALLET_ADDRESS) {
                    console.log(`\n!!! FOUND HX WALLET PRIVATE KEY IN ${file} !!!`);
                    console.log(`Private key: ${potentialKey}`);
                    console.log(`Public key verified: ${generatedAddress}`);
                    
                    // Export the key immediately
                    exportPrivateKey("HX_WALLET", potentialKey, HX_WALLET_ADDRESS);
                    return; // Exit the function as we found what we wanted
                  }
                  
                  // Otherwise log the wallet it does generate
                  console.log(`Found key in ${file} for wallet: ${generatedAddress}`);
                } catch (keyError) {
                  // Not a valid key, continue looking
                }
              }
            }
          } catch (fileError) {
            // Skip files we can't read
          }
        }
      }
    } catch (error) {
      console.error(`Error searching in ${location}:`, error);
    }
  }
  
  console.log('\nExtensive search completed. HX wallet private key not found in searched locations.');
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('🔑 COMPREHENSIVE KEY EXPORT UTILITY');
  console.log('=============================================');
  
  const connection = await setupConnection();
  
  // Check HX wallet balance
  console.log('\nChecking wallet balances:');
  await checkWalletBalance(connection, HX_WALLET_ADDRESS);
  
  // Export all known wallet private keys
  console.log('\nExporting known wallet private keys:');
  for (const wallet of WALLETS) {
    exportPrivateKey(wallet.name, wallet.privateKey, wallet.expectedAddress);
    await checkWalletBalance(connection, wallet.expectedAddress);
  }
  
  // Try to find HX wallet
  await continueSearchForHXWallet();
  
  console.log('\n=============================================');
  console.log('✅ Key export completed. All keys saved to ./export directory');
  console.log('=============================================');
}

main()
  .catch(error => {
    console.error('Fatal error:', error);
  });