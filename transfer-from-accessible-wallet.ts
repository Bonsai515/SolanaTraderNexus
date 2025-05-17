/**
 * Transfer Funds Tool
 * 
 * This script allows you to fund one of our accessible wallets with a small amount of SOL,
 * which can then be used to execute the Day 4 strategy with real transactions.
 */

import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  sendAndConfirmTransaction, 
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import * as fs from 'fs';

// Known wallet private keys
const WALLETS = [
  {
    name: "Accessible Wallet",
    privateKey: "793dec9a669ff717266b2544c44bb3990e226f2c21c620b733b53c1f3670f8a231f2be3d80903e77c93700b141f9f163e8dd0ba58c152cbc9ba047bfa245499f",
    address: "4MyfJj413sqtbLaEub8kw6qPsazAE6T4EhjgaxHWcrdC"
  },
  {
    name: "Prophet Wallet",
    privateKey: "d28c249469fd4ba35a58800b64e38ccbe22db4df2e115647aa85ff75d5a94544401f38419785a5c053f82d85106a0a1c737619ab0dff383aa24ae8ec4ffde787",
    address: "5KJhonWngrkP8qtzf69F7trirJubtqVM7swsR7Apr2fG"
  },
  {
    name: "Trading Wallet 1",
    privateKey: "b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da",
    address: "HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
  },
  {
    name: "Trading Wallet 2",
    privateKey: "69995cf93de5220f423e76cd73cbe2eea129d0b42ea00c0322d804745ec6c7bff1d6337eb1eefbc8e5d45d65e51bdcff596aeec7b957f34d2d910dd3da11f6d6",
    address: "HH2hMVDuw4WT8QoGTBZX2H5BPWubDL9BFemH6UhhDPYR"
  }
];

// HX wallet address
const HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

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

// Fund a wallet to execute the strategy
async function fundWalletToExecuteStrategy(
  connection: Connection,
  targetWalletAddress: string,
  amountSOL: number
): Promise<boolean> {
  console.log(`\n===== ATTEMPTING TO FUND WALLET FOR STRATEGY EXECUTION =====`);
  console.log(`Target wallet: ${targetWalletAddress}`);
  console.log(`Amount to fund: ${amountSOL} SOL`);
  
  // Check if any wallet has enough balance to fund the target wallet
  for (const wallet of WALLETS) {
    const balance = await checkWalletBalance(connection, wallet.address);
    
    if (balance >= amountSOL + 0.01) { // Add 0.01 SOL for transaction fee
      console.log(`\n${wallet.name} has enough balance to fund the strategy!`);
      
      try {
        // Create keypair from private key
        const privateKeyBuffer = Buffer.from(wallet.privateKey, 'hex');
        const fundingKeypair = Keypair.fromSecretKey(privateKeyBuffer);
        
        // Verify the keypair
        if (fundingKeypair.publicKey.toString() !== wallet.address) {
          console.error(`Keypair verification failed for ${wallet.name}`);
          continue;
        }
        
        // Create a transaction to send SOL
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: fundingKeypair.publicKey,
            toPubkey: new PublicKey(targetWalletAddress),
            lamports: Math.floor(amountSOL * LAMPORTS_PER_SOL)
          })
        );
        
        // Send transaction
        console.log(`Sending ${amountSOL} SOL from ${wallet.name} to ${targetWalletAddress}...`);
        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [fundingKeypair]
        );
        
        console.log(`✅ Transaction successful!`);
        console.log(`Transaction signature: ${signature}`);
        console.log(`Solscan URL: https://solscan.io/tx/${signature}`);
        
        // Check the new balance
        const newBalance = await checkWalletBalance(connection, targetWalletAddress);
        console.log(`New balance of ${targetWalletAddress}: ${newBalance.toFixed(6)} SOL`);
        
        return true;
      } catch (error) {
        console.error(`Error funding wallet from ${wallet.name}:`, error);
      }
    } else {
      console.log(`${wallet.name} does not have enough balance (${balance} SOL) to fund ${amountSOL} SOL`);
    }
  }
  
  console.log(`\n❌ No wallet with sufficient balance found to fund the strategy.`);
  return false;
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const amountToFund = parseFloat(args[0]) || 1.1; // Default to 1.1 SOL if not specified
  const targetWallet = args[1] || WALLETS[0].address; // Default to first wallet if not specified
  
  console.log('=============================================');
  console.log('💰 WALLET FUNDING TOOL FOR STRATEGY EXECUTION');
  console.log('=============================================');
  
  const connection = await setupConnection();
  
  // Check HX wallet balance
  console.log('\nChecking wallet balances:');
  await checkWalletBalance(connection, HX_WALLET_ADDRESS);
  
  // Check balances for all known wallets
  for (const wallet of WALLETS) {
    await checkWalletBalance(connection, wallet.address);
  }
  
  // Fund a wallet to execute the strategy
  await fundWalletToExecuteStrategy(connection, targetWallet, amountToFund);
  
  console.log('\n=============================================');
  console.log('Wallet funding operation complete');
  console.log('=============================================');
}

main()
  .catch(error => {
    console.error('Fatal error:', error);
  });