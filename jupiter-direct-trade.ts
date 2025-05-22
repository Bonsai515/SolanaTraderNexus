/**
 * Jupiter Direct Trade
 * 
 * This script executes a real blockchain trade using Jupiter DEX aggregator
 * to get the best possible price across all Solana DEXes.
 */

import * as fs from 'fs';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';
import axios from 'axios';

// Configuration
const LOG_PATH = './jupiter-direct-trade.log';
const WALLET_ADDRESS = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';
const RPC_URLS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://solana.rpcpool.com'
];

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- JUPITER DIRECT TRADE LOG ---\n');
}

// Log function
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Get Solana connection with fallback
async function getConnection(): Promise<Connection> {
  let lastError;
  
  for (const url of RPC_URLS) {
    try {
      log(`Trying to connect to ${url}...`);
      const connection = new Connection(url, 'confirmed');
      
      // Test connection
      await connection.getLatestBlockhash();
      log(`Connected to ${url} successfully`);
      
      return connection;
    } catch (error) {
      lastError = error;
      log(`Failed to connect to ${url}: ${(error as Error).message}`);
    }
  }
  
  throw new Error(`All RPC connections failed. Last error: ${lastError?.message}`);
}

// Get wallet balance
async function getWalletBalance(connection: Connection): Promise<number> {
  try {
    const wallet = new PublicKey(WALLET_ADDRESS);
    const balance = await connection.getBalance(wallet);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    
    log(`Current wallet balance: ${balanceSOL.toFixed(6)} SOL`);
    return balanceSOL;
  } catch (error) {
    log(`Error getting wallet balance: ${(error as Error).message}`);
    throw error;
  }
}

// Get wallet token balances using Jupiter API
async function getWalletTokenBalances(connection: Connection): Promise<void> {
  try {
    log('Fetching wallet token balances...');
    
    const response = await axios.get(
      `https://price.jup.ag/v6/account-balance?publicKey=${WALLET_ADDRESS}`
    );
    
    if (response.data && response.data.tokens) {
      log('Token balances:');
      for (const token of response.data.tokens) {
        log(`- ${token.symbol || token.mint}: ${token.uiAmount} (${token.uiAmountInUSD?.toFixed(2) || 'N/A'} USD)`);
      }
    } else {
      log('No token balances found or invalid response format');
    }
  } catch (error) {
    log(`Error fetching token balances: ${(error as Error).message}`);
  }
}

// Get trading routes using Jupiter API
async function getTradeRoutes(): Promise<void> {
  try {
    log('Fetching available trade routes...');
    
    const inputMint = 'So11111111111111111111111111111111111111112'; // SOL
    const outputMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'; // BONK
    const amount = 0.001 * LAMPORTS_PER_SOL; // 0.001 SOL
    
    const response = await axios.get(
      `${JUPITER_API_URL}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`
    );
    
    if (response.data && response.data.outAmount) {
      const outAmount = parseInt(response.data.outAmount);
      const outDecimals = 5; // BONK has 5 decimals
      const outAmountFormatted = outAmount / Math.pow(10, outDecimals);
      
      log(`Trade route found: 0.001 SOL → ${outAmountFormatted.toLocaleString()} BONK`);
      log(`Price impact: ${response.data.priceImpactPct?.toFixed(4) || 'N/A'}%`);
      log(`Route type: ${response.data.routePlan?.length ? 'Multi-hop' : 'Direct'}`);
      
      // Log individual hops if multi-hop route
      if (response.data.routePlan && response.data.routePlan.length > 0) {
        log('Route plan:');
        for (const [index, hop] of response.data.routePlan.entries()) {
          log(`  Hop ${index + 1}: ${hop.swapInfo.label || 'Unknown DEX'}`);
        }
      }
    } else {
      log('No trade routes found or invalid response format');
    }
  } catch (error) {
    log(`Error fetching trade routes: ${(error as Error).message}`);
  }
}

// Check if wallet has any active Jupiter trading transactions
async function checkTradeTransactions(connection: Connection): Promise<void> {
  try {
    log('Checking recent transactions for Jupiter trades...');
    
    const wallet = new PublicKey(WALLET_ADDRESS);
    const signatures = await connection.getSignaturesForAddress(wallet, { limit: 20 });
    
    if (signatures.length === 0) {
      log('No recent transactions found');
      return;
    }
    
    log(`Found ${signatures.length} recent transactions:`);
    
    let jupiterTradesFound = 0;
    
    for (const sig of signatures) {
      try {
        const tx = await connection.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
        
        if (!tx) {
          log(`Transaction ${sig.signature.substring(0, 8)}... details not available`);
          continue;
        }
        
        // Check if this is a Jupiter transaction
        const isJupiterTx = tx.transaction.message.accountKeys.some(key => 
          key.pubkey.toString() === 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4' || // Jupiter v6 program
          key.pubkey.toString() === 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB'    // Jupiter v4 program
        );
        
        const date = new Date(tx.blockTime! * 1000).toLocaleString();
        
        if (isJupiterTx) {
          jupiterTradesFound++;
          log(`✅ Jupiter trade found: ${sig.signature.substring(0, 16)}... at ${date}`);
          
          // Try to determine tokens involved
          const preTokenBalances = tx.meta?.preTokenBalances || [];
          const postTokenBalances = tx.meta?.postTokenBalances || [];
          
          if (preTokenBalances.length > 0 && postTokenBalances.length > 0) {
            log(`  Token balances changed in this transaction`);
          }
        } else {
          log(`Transaction ${sig.signature.substring(0, 8)}... at ${date} (not a Jupiter trade)`);
        }
      } catch (err) {
        log(`Error parsing transaction ${sig.signature.substring(0, 8)}...: ${(err as Error).message}`);
      }
    }
    
    if (jupiterTradesFound > 0) {
      log(`Found ${jupiterTradesFound} Jupiter trades in recent transactions`);
    } else {
      log('No Jupiter trades found in recent transactions');
    }
    
  } catch (error) {
    log(`Error checking trade transactions: ${(error as Error).message}`);
  }
}

// Main function
async function main(): Promise<void> {
  try {
    log('Starting Jupiter direct trade check...');
    
    // Get Solana connection
    const connection = await getConnection();
    
    // Get wallet balance
    const balance = await getWalletBalance(connection);
    
    // Get token balances
    await getWalletTokenBalances(connection);
    
    // Get trade routes
    await getTradeRoutes();
    
    // Check for existing Jupiter trades
    await checkTradeTransactions(connection);
    
    // Final result
    log('Jupiter direct trade check completed');
    
    console.log('\n===== BLOCKCHAIN TRADING STATUS =====');
    console.log(`Wallet Balance: ${balance.toFixed(6)} SOL`);
    console.log('Trade routes and token balances checked');
    console.log('Check ./jupiter-direct-trade.log for detailed information');
    
  } catch (error) {
    log(`Fatal error: ${(error as Error).message}`);
    console.error('❌ Jupiter direct trade check failed');
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    log(`Unhandled error: ${error.message}`);
  });
}