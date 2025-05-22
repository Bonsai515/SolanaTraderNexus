/**
 * Jupiter Integration for Optimized Swaps
 * 
 * This module provides Jupiter integration for best-in-class
 * swap routing and execution on Solana.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionInstruction
} from '@solana/web3.js';
import { addComputeBudgetInstructions } from './onchain_utils';
import * as fs from 'fs';

// Jupiter API endpoint
const JUPITER_API_ENDPOINT = 'https://quote-api.jup.ag/v6';

// Log file path
const LOG_PATH = './jupiter_integration.log';

// Supported tokens and their addresses
const TOKEN_ADDRESSES = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  MEME: 'MKXVJh4Za4zkZRu4QyQVrLXc8Z8EL9fGsHqmLWkXpRU'
};

// Log function
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Initialize logs
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- JUPITER INTEGRATION LOG ---\n');
}

/**
 * Get quote for swapping tokens using Jupiter
 */
export async function getJupiterQuote(
  inputToken: string,
  outputToken: string,
  amount: number,
  slippageBps: number = 50,
  onlyDirectRoutes: boolean = false
): Promise<any> {
  try {
    // Get token addresses
    const inputMint = TOKEN_ADDRESSES[inputToken] || inputToken;
    const outputMint = TOKEN_ADDRESSES[outputToken] || outputToken;
    
    // Build API URL
    const quoteUrl = `${JUPITER_API_ENDPOINT}/quote?${new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: onlyDirectRoutes.toString(),
      platformFeeBps: '0'
    })}`;
    
    log(`Getting Jupiter quote for ${inputToken} → ${outputToken}, amount: ${amount}`);
    
    // Fetch quote
    const response = await fetch(quoteUrl);
    const data = await response.json();
    
    if (!data || data.error) {
      throw new Error(data.error || 'Invalid response from Jupiter API');
    }
    
    log(`Quote received: ${inputToken} → ${outputToken}, outAmount: ${data.outAmount}, price impact: ${data.priceImpactPct}%`);
    
    return data;
  } catch (error) {
    log(`Error getting Jupiter quote: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Get swap instructions from Jupiter
 */
export async function getJupiterSwapInstructions(
  quoteResponse: any,
  userPublicKey: string
): Promise<{ setupInstructions: TransactionInstruction[], swapInstruction: TransactionInstruction, cleanupInstruction: TransactionInstruction[] } | null> {
  try {
    if (!quoteResponse || !quoteResponse.quoteResponse) {
      throw new Error('Invalid quote response');
    }
    
    // Build API URL
    const swapUrl = `${JUPITER_API_ENDPOINT}/swap-instructions`;
    
    // Request body
    const requestBody = {
      quoteResponse,
      userPublicKey
    };
    
    // Fetch swap instructions
    const response = await fetch(swapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const data = await response.json();
    
    if (!data || data.error) {
      throw new Error(data.error || 'Invalid response from Jupiter API');
    }
    
    log(`Got swap instructions: setupInstructions: ${data.setupInstructions.length}, cleanupInstructions: ${data.cleanupInstructions.length}`);
    
    return {
      setupInstructions: data.setupInstructions,
      swapInstruction: data.swapInstruction,
      cleanupInstruction: data.cleanupInstructions
    };
  } catch (error) {
    log(`Error getting Jupiter swap instructions: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Create a transaction for a Jupiter swap
 */
export async function createJupiterSwapTransaction(
  connection: Connection,
  wallet: any,
  inputToken: string,
  outputToken: string,
  amount: number,
  slippageBps: number = 50,
  priorityFeeMicroLamports: number = 500000 // 0.0005 SOL
): Promise<Transaction | null> {
  try {
    // Get quote
    const quote = await getJupiterQuote(inputToken, outputToken, amount, slippageBps);
    
    if (!quote) {
      throw new Error('Failed to get Jupiter quote');
    }
    
    // Get swap instructions
    const swapInstructions = await getJupiterSwapInstructions(quote, wallet.publicKey.toString());
    
    if (!swapInstructions) {
      throw new Error('Failed to get Jupiter swap instructions');
    }
    
    // Create transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions for priority fee
    const allInstructions: TransactionInstruction[] = [];
    allInstructions.push(...addComputeBudgetInstructions([], priorityFeeMicroLamports));
    allInstructions.push(...swapInstructions.setupInstructions);
    allInstructions.push(swapInstructions.swapInstruction);
    allInstructions.push(...swapInstructions.cleanupInstruction);
    
    // Add all instructions to transaction
    transaction.add(...allInstructions);
    
    // Get the latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    log(`Created Jupiter swap transaction: ${inputToken} → ${outputToken}, amount: ${amount}`);
    
    return transaction;
  } catch (error) {
    log(`Error creating Jupiter swap transaction: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Initialize Jupiter integration
 */
export function initJupiterIntegration(): void {
  log('Initializing Jupiter integration...');
  log(`Jupiter API endpoint: ${JUPITER_API_ENDPOINT}`);
  log(`Supported tokens: ${Object.keys(TOKEN_ADDRESSES).join(', ')}`);
  log('Jupiter integration initialized successfully!');
}
