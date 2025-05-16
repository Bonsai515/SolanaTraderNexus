/**
 * Verify Blockchain Connection 
 * 
 * This script verifies the connection to the Solana blockchain
 * and ensures the wallet is properly configured.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Main wallet address
const MAIN_WALLET_ADDRESS = "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb";

// Array of RPC endpoints to try
const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  process.env.INSTANT_NODES_RPC_URL,
  process.env.ALCHEMY_RPC_URL,
  process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : null
].filter(Boolean) as string[];

// Verify blockchain connection and wallet
async function verifyBlockchainConnection() {
  console.log('Verifying blockchain connection and wallet...');
  console.log(`Wallet address: ${MAIN_WALLET_ADDRESS}`);
  
  // Try each RPC endpoint until one works
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      console.log(`Trying RPC endpoint: ${endpoint}`);
      
      const connection = new Connection(endpoint, 'confirmed');
      
      // Get network version to verify connection
      const version = await connection.getVersion();
      console.log(`✅ Connected to Solana ${version["solana-core"]}`);
      
      // Check wallet existence and balance
      const pubkey = new PublicKey(MAIN_WALLET_ADDRESS);
      const balance = await connection.getBalance(pubkey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      console.log(`✅ Wallet exists and has balance: ${solBalance} SOL`);
      
      // Get recent blockhash to verify we can submit transactions
      const { blockhash } = await connection.getLatestBlockhash();
      console.log(`✅ Latest blockhash: ${blockhash}`);
      
      // Get recent transactions for this wallet
      const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 5 });
      console.log(`✅ Found ${signatures.length} recent transactions for this wallet`);
      
      if (signatures.length > 0) {
        console.log('Recent transaction signatures:');
        signatures.forEach((sig, i) => {
          console.log(`  ${i+1}. ${sig.signature} (${new Date(sig.blockTime! * 1000).toISOString()})`);
        });
      }
      
      // Successfully connected and verified
      console.log(`✅ Blockchain connection verified with endpoint: ${endpoint}`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Failed with endpoint ${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // All endpoints failed
  console.error('❌ Could not connect to any Solana RPC endpoint');
  return false;
}

// Execute verification
verifyBlockchainConnection();
