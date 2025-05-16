/**
 * DEX Helper
 * 
 * This module provides a simplified interface to interact with
 * multiple DEXes through the DEX aggregator.
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { DexAggregator } from './dex/aggregator';
import * as logger from './logger';

// Singleton instance
let dexAggregator: DexAggregator | null = null;

/**
 * Initialize DEX integrations
 */
export function initializeDexes(connection: Connection): DexAggregator {
  if (!dexAggregator) {
    dexAggregator = new DexAggregator(connection);
    logger.info('[DexHelper] DEX integrations initialized');
  }
  
  return dexAggregator;
}

/**
 * Get the DEX aggregator
 */
export function getDexAggregator(): DexAggregator | null {
  return dexAggregator;
}

/**
 * Get the best quote for a swap
 */
export async function getBestSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50
): Promise<any> {
  if (!dexAggregator) {
    throw new Error('DEX aggregator not initialized');
  }
  
  return dexAggregator.getBestQuote(inputMint, outputMint, amount, slippageBps);
}

/**
 * Execute a swap with the best DEX
 */
export async function executeSwap(
  wallet: Keypair,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50
): Promise<string> {
  if (!dexAggregator) {
    throw new Error('DEX aggregator not initialized');
  }
  
  return dexAggregator.executeSwap(wallet, inputMint, outputMint, amount, slippageBps);
}

/**
 * Find arbitrage opportunities
 */
export async function findArbitrageOpportunities(
  baseToken: string = 'USDC',
  comparisonTokens: string[] = ['SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'MEME', 'ORCA']
): Promise<any[]> {
  if (!dexAggregator) {
    throw new Error('DEX aggregator not initialized');
  }
  
  return dexAggregator.findArbitrageOpportunities(baseToken, comparisonTokens);
}

/**
 * Get token prices across all DEXes
 */
export async function getTokenPrices(
  baseToken: string = 'USDC',
  tokens: string[] = ['SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'MEME', 'ORCA']
): Promise<any> {
  if (!dexAggregator) {
    throw new Error('DEX aggregator not initialized');
  }
  
  return dexAggregator.getPrices(baseToken, tokens);
}