/**
 * On-Chain Program Utilities
 * 
 * This module provides utility functions for interacting with
 * Solana on-chain programs to optimize trading performance.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionInstruction,
  TransactionMessage,
  AddressLookupTableAccount,
  ComputeBudgetProgram
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Program addresses
const JUPITER_PROGRAM_ID = new PublicKey('JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB');
const JITO_TIP_ACCOUNT = new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5');
const RAYDIUM_AMM_PROGRAM_ID = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
const OPENBOOK_DEX_PROGRAM_ID = new PublicKey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX');
const SOLEND_PROGRAM_ID = new PublicKey('So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo');
const MANGO_PROGRAM_ID = new PublicKey('4MangoMjqJ2firMokCjjGgoK8d4MXcrgL7XJaL3w6fVg');
const PYTH_PROGRAM_ID = new PublicKey('FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH');
const SWITCHBOARD_PROGRAM_ID = new PublicKey('SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f');
const DOLPHIN_PROGRAM_ID = new PublicKey('DLPv2fzXQX5pWqxUYqT8MDcwxwDPHYYGmCxKT6xuamQz');
const METEORA_PROGRAM_ID = new PublicKey('M3stEYgRMjSiMNGpXrZLjL3GLQ5qyn7No4kCUwQLzXYj');

// Log file path
const LOG_PATH = './onchain_utils.log';

// Log function
export function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Initialize logs
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- ON-CHAIN PROGRAM UTILITIES LOG ---\n');
}

/**
 * Add compute budget instruction to a transaction
 * This allows setting priority fees and increased compute units
 */
export function addComputeBudgetInstructions(
  instructions: TransactionInstruction[],
  priorityFeeMicroLamports: number = 50000,
  computeUnits: number = 1_400_000
): TransactionInstruction[] {
  // Add compute units instruction
  instructions.push(
    ComputeBudgetProgram.setComputeUnitLimit({
      units: computeUnits
    })
  );
  
  // Add priority fee instruction
  instructions.push(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFeeMicroLamports
    })
  );
  
  return instructions;
}

/**
 * Add Jito tip instruction to capture MEV opportunities
 */
export function addJitoTipInstruction(
  instructions: TransactionInstruction[],
  tipLamports: number = 100000 // 0.0001 SOL
): TransactionInstruction[] {
  const transferInstruction = SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: JITO_TIP_ACCOUNT,
    lamports: tipLamports
  });
  
  instructions.push(transferInstruction);
  return instructions;
}

/**
 * Create a versioned transaction for better performance
 */
export async function createVersionedTransaction(
  connection: Connection,
  wallet: any,
  instructions: TransactionInstruction[],
  lookupTableAddresses: string[] = []
): Promise<VersionedTransaction> {
  // Get the latest blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  
  // Resolve lookup tables if provided
  const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
  
  if (lookupTableAddresses.length > 0) {
    for (const tableAddress of lookupTableAddresses) {
      try {
        const lookupTableAccount = await connection.getAddressLookupTable(new PublicKey(tableAddress))
          .then(res => res.value);
          
        if (lookupTableAccount) {
          addressLookupTableAccounts.push(lookupTableAccount);
        }
      } catch (error) {
        log(`Error loading lookup table ${tableAddress}: ${(error as Error).message}`);
      }
    }
  }
  
  // Create a versioned transaction
  const messageV0 = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions
  }).compileToV0Message(addressLookupTableAccounts);
  
  // Create a versioned transaction
  const transaction = new VersionedTransaction(messageV0);
  
  return transaction;
}

/**
 * Jupiter swap route optimizer
 * Gets the best possible route for a token swap
 */
export async function getJupiterSwapRoute(
  inputToken: string,
  outputToken: string,
  inputAmount: number,
  slippageBps: number = 50
): Promise<any> {
  try {
    // Jupiter v6 API
    const jupiterApiUrl = `https://quote-api.jup.ag/v6/quote?${new URLSearchParams({
      inputMint: inputToken,
      outputMint: outputToken,
      amount: inputAmount.toString(),
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: 'false',
      platformFeeBps: '0'
    })}`;
    
    // Fetch the swap route
    const response = await fetch(jupiterApiUrl);
    const data = await response.json();
    
    if (!data || !data.data) {
      throw new Error('Invalid response from Jupiter API');
    }
    
    log(`Found Jupiter route: ${inputToken} → ${outputToken}, outAmount: ${data.data.outAmount}, price impact: ${data.data.priceImpactPct}%`);
    
    return data.data;
  } catch (error) {
    log(`Error getting Jupiter swap route: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Get flash loan from Mango Markets
 */
export async function getMangoFlashLoan(
  connection: Connection,
  wallet: any,
  tokenMint: string,
  amount: number
): Promise<TransactionInstruction[]> {
  try {
    log(`Creating Mango flash loan instruction for ${amount} of token ${tokenMint}`);
    
    // In a real implementation, this would include the actual Mango flash loan logic
    // For now, we'll just log the intent
    
    // Placeholder instructions
    return [];
  } catch (error) {
    log(`Error getting Mango flash loan: ${(error as Error).message}`);
    return [];
  }
}

/**
 * Get price data from Pyth Network
 */
export async function getPythPrice(
  connection: Connection,
  priceAccountKey: string
): Promise<number | null> {
  try {
    const priceAccount = new PublicKey(priceAccountKey);
    const accountInfo = await connection.getAccountInfo(priceAccount);
    
    if (!accountInfo || !accountInfo.data) {
      throw new Error('Invalid price account data');
    }
    
    // In a real implementation, this would parse the Pyth price data
    // For now, we'll just log the intent
    
    log(`Got Pyth price data for account ${priceAccountKey}`);
    return null;
  } catch (error) {
    log(`Error getting Pyth price: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Create a transaction with multiple swaps (batched execution)
 */
export async function createBatchedSwapTransaction(
  connection: Connection,
  wallet: any,
  swaps: Array<{
    inputToken: string;
    outputToken: string;
    amount: number;
    slippage: number;
  }>
): Promise<Transaction | null> {
  try {
    log(`Creating batched swap transaction with ${swaps.length} swaps`);
    
    // In a real implementation, this would batch multiple swaps into a single transaction
    // For now, we'll just log the intent
    
    return null;
  } catch (error) {
    log(`Error creating batched swap transaction: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Initialize on-chain utilities
 */
export function initOnchainUtils(): void {
  log('Initializing on-chain utilities...');
  log(`Jupiter Program ID: ${JUPITER_PROGRAM_ID.toString()}`);
  log(`Jito Tip Account: ${JITO_TIP_ACCOUNT.toString()}`);
  log(`Raydium AMM Program ID: ${RAYDIUM_AMM_PROGRAM_ID.toString()}`);
  log(`OpenBook DEX Program ID: ${OPENBOOK_DEX_PROGRAM_ID.toString()}`);
  log('On-chain utilities initialized successfully!');
}

// Export program IDs
export const ProgramIds = {
  JUPITER: JUPITER_PROGRAM_ID,
  JITO_TIP: JITO_TIP_ACCOUNT,
  RAYDIUM_AMM: RAYDIUM_AMM_PROGRAM_ID,
  OPENBOOK_DEX: OPENBOOK_DEX_PROGRAM_ID,
  SOLEND: SOLEND_PROGRAM_ID,
  MANGO: MANGO_PROGRAM_ID,
  PYTH: PYTH_PROGRAM_ID,
  SWITCHBOARD: SWITCHBOARD_PROGRAM_ID,
  DOLPHIN: DOLPHIN_PROGRAM_ID,
  METEORA: METEORA_PROGRAM_ID
};
