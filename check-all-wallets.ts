/**
 * Check Balance of All Known Wallets
 * 
 * This script checks the balance of all the wallets we have access to
 * to find one with sufficient funds for trading.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Known wallet addresses and private keys
const WALLETS = [
  {
    name: "HX Wallet (Main)",
    address: "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb",
    hasPrivateKey: false
  },
  {
    name: "Prophet Wallet",
    address: "5KJhonWngrkP8qtzf69F7trirJubtqVM7swsR7Apr2fG",
    privateKey: "d28c249469fd4ba35a58800b64e38ccbe22db4df2e115647aa85ff75d5a94544401f38419785a5c053f82d85106a0a1c737619ab0dff383aa24ae8ec4ffde787",
    hasPrivateKey: true
  },
  {
    name: "Accessible Wallet",
    address: "4MyfJj413sqtbLaEub8kw6qPsazAE6T4EhjgaxHWcrdC",
    privateKey: "793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f",
    hasPrivateKey: true
  },
  {
    name: "Trading Wallet 1",
    address: "HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK",
    privateKey: "b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da",
    hasPrivateKey: true
  },
  {
    name: "Trading Wallet 2",
    address: "HH2hMVDuw4WT8QoGTBZX2H5BPWubDL9BFemH6UhhDPYR",
    privateKey: "69995cf93de5220f423e76cd73cbe2eea129d0b42ea00c0322d804745ec6c7bff1d6337eb1eefbc8e5d45d65e51bdcff596aeec7b957f34d2d910dd3da11f6d6",
    hasPrivateKey: true
  }
];

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
    return solBalance;
  } catch (error) {
    console.error(`Error checking balance for ${walletAddress}:`, error);
    return 0;
  }
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('CHECKING BALANCE OF ALL KNOWN WALLETS');
  console.log('=============================================');
  
  try {
    // Set up connection
    const connection = await setupConnection();
    
    console.log('\nWallet Balances:');
    console.log('---------------------------------------------');
    
    // Check balance for each wallet and store it
    const walletsWithBalances = [];
    
    for (const wallet of WALLETS) {
      const balance = await checkWalletBalance(connection, wallet.address);
      
      // Store wallet with its balance
      walletsWithBalances.push({
        ...wallet,
        balance
      });
      
      console.log(`${wallet.name} (${wallet.address})`);
      console.log(`Balance: ${balance.toFixed(6)} SOL`);
      console.log(`Private Key Available: ${wallet.hasPrivateKey ? 'Yes' : 'No'}`);
      console.log('---------------------------------------------');
    }
    
    console.log('\nSummary of Available Wallets for Trading:');
    
    const availableWallets = walletsWithBalances.filter(w => w.hasPrivateKey);
    const walletWithFunds = availableWallets.find(w => w.balance > 0.05);
    
    if (walletWithFunds) {
      console.log(`✅ Found wallet with sufficient funds: ${walletWithFunds.name}`);
      console.log(`Balance: ${walletWithFunds.balance.toFixed(6)} SOL`);
    } else {
      console.log('❌ No accessible wallets have sufficient funds for trading');
      console.log('Options:');
      console.log('1. Add funds to one of the accessible wallets');
      console.log('2. Find the private key for the HX wallet');
    }
    
  } catch (error) {
    console.error('Error checking wallet balances:', error);
  }
  
  console.log('\n=============================================');
}

// Set environment variables for RPC
process.env.ALCHEMY_API_KEY = "PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR";
process.env.HELIUS_API_KEY = "cf9047cb-d7ca-435f-a8cf-92a5b5557abb";

// Run the script
main();