/**
 * Optimized Syndica RPC Client
 * 
 * A streamlined client for making efficient RPC calls to Syndica.
 */

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Load config
const CONFIG_PATH = path.join(__dirname, '../config/syndica-config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// Create connection
const connection = new Connection(config.primaryRpc);

// Cache for RPC responses
const responseCache = new Map();

// Make RPC request with caching
async function makeRpcRequest(method: string, params: any[] = []): Promise<any> {
  // Generate cache key
  const cacheKey = `${method}-${JSON.stringify(params)}`;
  
  // Check cache
  if (responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey);
    if (Date.now() < cached.expiresAt) {
      return cached.data;
    }
  }
  
  // Make request
  const response = await connection.rpcRequest(method, params);
  
  // Determine cache TTL based on method
  let ttl = 30000; // Default 30 seconds
  
  if (method.includes('getTransaction') || method.includes('getSignature')) {
    ttl = 86400000; // 24 hours for transaction data
  } else if (method.includes('getAccountInfo') || method.includes('getProgramAccounts')) {
    ttl = 30000; // 30 seconds for account data
  } else if (method.includes('getBlock') || method.includes('getSlot')) {
    ttl = 60000; // 60 seconds for block data
  }
  
  // Cache response
  responseCache.set(cacheKey, {
    data: response.result,
    expiresAt: Date.now() + ttl
  });
  
  // Clean up old cache entries periodically
  if (responseCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of responseCache.entries()) {
      if (value.expiresAt < now) {
        responseCache.delete(key);
      }
    }
  }
  
  return response.result;
}

// Common RPC methods
export async function getBalance(pubkey: string | PublicKey): Promise<number> {
  const address = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
  return makeRpcRequest('getBalance', [address]);
}

export async function getAccountInfo(pubkey: string | PublicKey): Promise<any> {
  const address = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
  return makeRpcRequest('getAccountInfo', [address, {encoding: 'jsonParsed'}]);
}

export async function getRecentBlockhash(): Promise<string> {
  const result = await makeRpcRequest('getLatestBlockhash');
  return result.blockhash;
}

export async function sendTransaction(transaction: VersionedTransaction): Promise<string> {
  // Don't cache transactions
  return connection.sendRawTransaction(transaction.serialize());
}

// Get multiple token balances in a single call
export async function getMultipleTokenBalances(walletAddress: string, tokenMints: string[]): Promise<{[mint: string]: number}> {
  const accounts = await makeRpcRequest('getTokenAccountsByOwner', [
    walletAddress,
    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { encoding: 'jsonParsed' }
  ]);
  
  const balances: {[mint: string]: number} = {};
  
  for (const account of accounts) {
    const mint = account.account.data.parsed.info.mint;
    const amount = account.account.data.parsed.info.tokenAmount.uiAmount;
    
    if (tokenMints.includes(mint)) {
      balances[mint] = amount;
    }
  }
  
  return balances;
}

// Export connection for direct use if needed
export { connection };