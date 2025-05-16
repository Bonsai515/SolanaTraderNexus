/**
 * Advanced Swap Utilities
 * 
 * Provides utilities for optimizing swap execution, including:
 * - Price impact calculation
 * - Order splitting for large trades
 * - Multi-DEX routing
 */

import { logger } from '../logger';

// Supported DEXes
export enum DexProvider {
  JUPITER = 'JUPITER',
  ORCA = 'ORCA',
  RAYDIUM = 'RAYDIUM',
  OPENBOOK = 'OPENBOOK'
}

// Price impact thresholds
export const PRICE_IMPACT_THRESHOLDS = {
  WARNING: 1.0,    // 1% price impact - display warning
  HIGH: 2.5,       // 2.5% price impact - consider splitting order
  EXTREME: 5.0     // 5% price impact - require confirmation
};

// Large order thresholds in USD
export const LARGE_ORDER_THRESHOLDS = {
  MEDIUM: 1000,    // $1,000 USD - consider splitting
  LARGE: 5000,     // $5,000 USD - definitely split
  VERY_LARGE: 10000 // $10,000 USD - maximum aggressive split
};

/**
 * Calculate price impact of a trade
 * @param fromToken Source token
 * @param toToken Target token
 * @param amountUsd Trade size in USD
 * @returns Estimated price impact percentage
 */
export function calculatePriceImpact(
  fromToken: string,
  toToken: string,
  amountUsd: number
): number {
  // Base impact based on size - this is a simplified model
  let baseImpact = 0;
  
  if (amountUsd > LARGE_ORDER_THRESHOLDS.VERY_LARGE) {
    baseImpact = 3.0;
  } else if (amountUsd > LARGE_ORDER_THRESHOLDS.LARGE) {
    baseImpact = 1.5;
  } else if (amountUsd > LARGE_ORDER_THRESHOLDS.MEDIUM) {
    baseImpact = 0.8;
  } else {
    baseImpact = 0.3;
  }
  
  // Token-specific adjustments
  const lowLiquidityTokens = ['BOME', 'POPCAT', 'GUAC', 'WIF'];
  const mediumLiquidityTokens = ['BONK', 'MEME'];
  const highLiquidityTokens = ['SOL', 'USDC', 'ETH', 'BTC', 'USDT'];
  
  let liquidityMultiplier = 1.0;
  
  // Adjust multiplier based on token liquidity
  if (lowLiquidityTokens.some(t => toToken.includes(t) || fromToken.includes(t))) {
    liquidityMultiplier = 3.0; // 3x impact for low liquidity tokens
  } else if (mediumLiquidityTokens.some(t => toToken.includes(t) || fromToken.includes(t))) {
    liquidityMultiplier = 1.5; // 1.5x impact for medium liquidity tokens
  } else if (highLiquidityTokens.some(t => toToken.includes(t) && fromToken.includes(t))) {
    liquidityMultiplier = 0.5; // 0.5x impact for high liquidity pairs
  }
  
  const estimatedImpact = baseImpact * liquidityMultiplier;
  
  return parseFloat(estimatedImpact.toFixed(2));
}

/**
 * Determine if a trade should be split based on size and impact
 * @param amountUsd Trade size in USD
 * @param priceImpact Calculated price impact
 * @returns Whether the trade should be split
 */
export function shouldSplitOrder(amountUsd: number, priceImpact: number): boolean {
  return (
    (amountUsd > LARGE_ORDER_THRESHOLDS.MEDIUM && priceImpact > PRICE_IMPACT_THRESHOLDS.WARNING) ||
    (amountUsd > LARGE_ORDER_THRESHOLDS.LARGE) ||
    (priceImpact > PRICE_IMPACT_THRESHOLDS.HIGH)
  );
}

/**
 * Calculate optimal splits for a large order
 * @param amountUsd Total trade size in USD
 * @param priceImpact Calculated price impact
 * @returns Array of split sizes in USD
 */
export function calculateOrderSplits(
  amountUsd: number,
  priceImpact: number
): number[] {
  const splits: number[] = [];
  let remainingAmount = amountUsd;
  
  // Determine base split size
  let splitSize = 500; // Default $500 split size
  
  if (amountUsd > LARGE_ORDER_THRESHOLDS.VERY_LARGE) {
    splitSize = 1000; // $1,000 splits for very large orders
  } else if (amountUsd > LARGE_ORDER_THRESHOLDS.LARGE) {
    splitSize = 750; // $750 splits for large orders
  }
  
  // Adjust split size based on price impact
  if (priceImpact > PRICE_IMPACT_THRESHOLDS.EXTREME) {
    splitSize = 250; // Smaller splits for high impact trades
  }
  
  // Create splits
  while (remainingAmount > 0) {
    // For the last split, use the remaining amount if it's less than the split size
    const currentSplit = Math.min(splitSize, remainingAmount);
    splits.push(currentSplit);
    remainingAmount -= currentSplit;
  }
  
  return splits;
}

/**
 * Get optimal DEX routing for a trade
 * @param fromToken Source token
 * @param toToken Target token
 * @returns Array of DEXes to try in order
 */
export function getOptimalDexRouting(
  fromToken: string,
  toToken: string
): DexProvider[] {
  // Base order of DEXes to try
  const defaultRouting: DexProvider[] = [
    DexProvider.JUPITER,
    DexProvider.ORCA,
    DexProvider.RAYDIUM
  ];
  
  // Special cases for specific pairs
  const solanaPairs = ['SOL-USDC', 'SOL-USDT', 'SOL-BONK', 'SOL-JUP'];
  const memeTokenPairs = ['BONK-USDC', 'WIF-USDC', 'MEME-USDC', 'BOME-USDC'];
  
  const pair = `${fromToken}-${toToken}`;
  
  if (solanaPairs.some(p => p === pair || p === pair.split('-').reverse().join('-'))) {
    // For Solana pairs, prefer Orca then Jupiter
    return [DexProvider.ORCA, DexProvider.JUPITER, DexProvider.RAYDIUM, DexProvider.OPENBOOK];
  }
  
  if (memeTokenPairs.some(p => p === pair || p === pair.split('-').reverse().join('-'))) {
    // For meme token pairs, prefer Jupiter then Raydium
    return [DexProvider.JUPITER, DexProvider.RAYDIUM, DexProvider.ORCA, DexProvider.OPENBOOK];
  }
  
  return defaultRouting;
}

/**
 * Optimize a swap for best execution
 * @param fromToken Source token
 * @param toToken Target token
 * @param amountUsd Trade size in USD
 * @returns Optimized swap parameters
 */
export function optimizeSwap(
  fromToken: string,
  toToken: string,
  amountUsd: number
): {
  shouldSplit: boolean;
  splits: number[];
  priceImpact: number;
  dexRouting: DexProvider[];
} {
  // Calculate price impact
  const priceImpact = calculatePriceImpact(fromToken, toToken, amountUsd);
  
  // Determine if we should split the order
  const shouldSplit = shouldSplitOrder(amountUsd, priceImpact);
  
  // Calculate splits if needed
  const splits = shouldSplit ? calculateOrderSplits(amountUsd, priceImpact) : [amountUsd];
  
  // Get optimal DEX routing
  const dexRouting = getOptimalDexRouting(fromToken, toToken);
  
  // Log the optimization details
  logger.info(`[SwapUtils] Optimizing swap: ${fromToken} → ${toToken} (${amountUsd} USD)`);
  logger.info(`[SwapUtils] Estimated price impact: ${priceImpact}%`);
  
  if (shouldSplit) {
    logger.info(`[SwapUtils] Splitting order into ${splits.length} parts: ${splits.join(', ')} USD`);
  }
  
  logger.info(`[SwapUtils] DEX routing: ${dexRouting.join(' → ')}`);
  
  return {
    shouldSplit,
    splits,
    priceImpact,
    dexRouting
  };
}