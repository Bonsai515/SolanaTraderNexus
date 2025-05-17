/**
 * Check All Wallet Balances
 * 
 * This script checks the balances of all available wallets and the HX wallet
 * to confirm the current state of each.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Wallet addresses to check
const WALLET_ADDRESSES = [
  {
    name: "HX Wallet (Inaccessible System Wallet)",
    address: "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb"
  },
  {
    name: "Accessible Wallet",
    address: "4MyfJj413sqtbLaEub8kw6qPsazAE6T4EhjgaxHWcrdC",
    privateKeyAvailable: true
  },
  {
    name: "Prophet Wallet",
    address: "5KJhonWngrkP8qtzf69F7trirJubtqVM7swsR7Apr2fG",
    privateKeyAvailable: true
  },
  {
    name: "Trading Wallet 1",
    address: "HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK",
    privateKeyAvailable: true
  },
  {
    name: "Trading Wallet 2",
    address: "HH2hMVDuw4WT8QoGTBZX2H5BPWubDL9BFemH6UhhDPYR",
    privateKeyAvailable: true
  }
];

// Setup connection to Solana
async function setupConnection(): Promise<Connection> {
  // Try multiple RPC URLs in case one fails
  const rpcUrls = [
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com'
  ];
  
  let connection: Connection | null = null;
  let error: Error | null = null;
  
  for (const url of rpcUrls) {
    try {
      console.log(`Trying RPC URL: ${url}`);
      const tempConnection = new Connection(url, 'confirmed');
      // Test the connection
      await tempConnection.getRecentBlockhash();
      connection = tempConnection;
      console.log(`Successfully connected to ${url}`);
      break;
    } catch (err) {
      console.error(`Error connecting to ${url}:`, err);
      error = err as Error;
    }
  }
  
  if (!connection) {
    throw error || new Error('Failed to connect to any Solana RPC endpoint');
  }
  
  return connection;
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
    return -1; // Return -1 to indicate error
  }
}

// Format SOL amount
function formatSOL(amount: number): string {
  if (amount < 0) {
    return 'Error';
  }
  return `${amount.toFixed(6)} SOL ($${(amount * 160).toFixed(2)})`;
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('📊 WALLET BALANCE VERIFICATION');
  console.log('=============================================');
  console.log('Current SOL price: $160 (approximation)');
  console.log('=============================================\n');
  
  try {
    // Setup Solana connection
    const connection = await setupConnection();
    
    // Check each wallet balance
    console.log('Checking wallet balances...\n');
    
    let table: {name: string, address: string, balance: string, status: string}[] = [];
    
    for (const wallet of WALLET_ADDRESSES) {
      const balance = await checkWalletBalance(connection, wallet.address);
      
      // Determine wallet status
      let status = 'Unknown';
      if (balance < 0) {
        status = 'Error checking balance';
      } else if ('privateKeyAvailable' in wallet && wallet.privateKeyAvailable) {
        status = 'ACCESSIBLE (Private key available)';
      } else {
        status = 'INACCESSIBLE (No private key)';
      }
      
      table.push({
        name: wallet.name,
        address: wallet.address,
        balance: formatSOL(balance),
        status: status
      });
    }
    
    // Display results in table format
    console.log('Wallet Name'.padEnd(40) + 'Address'.padEnd(45) + 'Balance'.padEnd(25) + 'Status');
    console.log(''.padEnd(130, '='));
    
    for (const row of table) {
      console.log(
        row.name.padEnd(40) + 
        row.address.padEnd(45) + 
        row.balance.padEnd(25) + 
        row.status
      );
    }
    
    console.log('\n=============================================');
    console.log('Balance verification complete');
    console.log('=============================================');
    
  } catch (error) {
    console.error('\nError checking wallet balances:', error);
  }
}

// Run the script
main();