/**
 * Price Simulator for Solana Trading System
 * 
 * This module provides price simulation capabilities for testing
 * trading strategies and generating realistic market simulations.
 */

import { logger } from '../logger';

/**
 * Simulate a price trajectory using Monte Carlo methods
 * @param initialPrice Initial price
 * @param days Number of days to simulate
 * @param volatility Volatility (0-1)
 * @param drift Trend drift (-0.1 to 0.1)
 * @param paths Number of simulation paths
 * @returns Simulated price paths
 */
export function simulateTrajectory(
  initialPrice: number,
  days: number = 7,
  volatility: number = 0.2,
  drift: number = 0.001,
  paths: number = 100
): number[][] {
  try {
    // Validate inputs
    volatility = Math.max(0.01, Math.min(1, volatility));
    drift = Math.max(-0.1, Math.min(0.1, drift));
    paths = Math.max(1, Math.min(1000, paths));
    days = Math.max(1, Math.min(365, days));
    
    // Steps per day (hourly)
    const stepsPerDay = 24;
    const totalSteps = days * stepsPerDay;
    
    // Time step (in years, for volatility scaling)
    const dt = 1 / (365 * stepsPerDay);
    
    // Simulation results
    const results: number[][] = [];
    
    // Generate paths
    for (let path = 0; path < paths; path++) {
      const prices: number[] = [initialPrice];
      let currentPrice = initialPrice;
      
      for (let step = 1; step < totalSteps; step++) {
        // Random component (normal distribution approximation using Box-Muller transform)
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        
        // Price movement formula: S_t = S_{t-1} * exp((μ - σ²/2)dt + σ√dt * z)
        const movement = Math.exp(
          (drift - 0.5 * volatility * volatility) * dt + volatility * Math.sqrt(dt) * z
        );
        
        // Update price
        currentPrice *= movement;
        prices.push(currentPrice);
      }
      
      results.push(prices);
    }
    
    return results;
  } catch (error) {
    logger.error('Error simulating price trajectory:', error);
    return [[initialPrice]];
  }
}

/**
 * Generate a realistic price history for backtesting
 * @param symbol Token symbol
 * @param days Number of days of history
 * @param interval Interval in minutes (1, 5, 15, 60, 240, 1440)
 * @returns Price history as [timestamp, open, high, low, close, volume][]
 */
export function generatePriceHistory(
  symbol: string,
  days: number = 30,
  interval: number = 60
): [number, number, number, number, number, number][] {
  try {
    // Base price depends on the symbol
    let basePrice = 1.0;
    
    switch (symbol.toUpperCase()) {
      case 'SOL':
        basePrice = 170 + (Math.random() * 10 - 5);
        break;
      case 'BTC':
        basePrice = 60000 + (Math.random() * 2000 - 1000);
        break;
      case 'ETH':
        basePrice = 3000 + (Math.random() * 200 - 100);
        break;
      case 'BONK':
        basePrice = 0.00002 + (Math.random() * 0.000005 - 0.0000025);
        break;
      case 'JUP':
        basePrice = 0.75 + (Math.random() * 0.04 - 0.02);
        break;
      default:
        basePrice = 1.0 + (Math.random() * 0.2 - 0.1);
    }
    
    // Volatility based on the token
    let volatility = 0.2; // Default
    
    if (['BONK', 'MEME', 'WIF', 'GUAC'].includes(symbol.toUpperCase())) {
      volatility = 0.8; // High volatility for meme tokens
    } else if (['SOL', 'ETH', 'AVAX', 'BNB'].includes(symbol.toUpperCase())) {
      volatility = 0.3; // Medium volatility for L1s
    } else if (['BTC'].includes(symbol.toUpperCase())) {
      volatility = 0.2; // Lower volatility for BTC
    } else if (['USDC', 'USDT', 'DAI'].includes(symbol.toUpperCase())) {
      volatility = 0.01; // Very low volatility for stablecoins
    }
    
    // Convert interval to milliseconds
    const intervalMs = interval * 60 * 1000;
    const totalIntervals = Math.ceil((days * 24 * 60 * 60 * 1000) / intervalMs);
    
    // Current timestamp (now)
    const now = Date.now();
    
    // Generate price data
    const priceData: [number, number, number, number, number, number][] = [];
    
    let price = basePrice;
    
    for (let i = totalIntervals; i >= 0; i--) {
      const timestamp = now - (i * intervalMs);
      
      // Random price movement (more variation for longer intervals)
      const scaleFactor = Math.sqrt(interval / 60); // Scale by square root of time
      const dailyCycle = Math.sin((timestamp % (24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000) * Math.PI * 2) * 0.01;
      const movement = (Math.random() * 2 - 1) * volatility * scaleFactor + dailyCycle;
      
      // Update price with some mean reversion
      price = price * (1 + movement * 0.1);
      
      // Ensure price stays positive
      price = Math.max(price, 0.00000001);
      
      // Calculate OHLC values
      const open = price;
      const high = price * (1 + Math.random() * volatility * 0.2 * scaleFactor);
      const low = price * (1 - Math.random() * volatility * 0.2 * scaleFactor);
      const close = price * (1 + (Math.random() * 2 - 1) * volatility * 0.1 * scaleFactor);
      
      // Generate realistic volume
      const volume = basePrice * 1000 * (1 + Math.random() * 0.5) * 
                    (1 + Math.abs(movement) * 10); // Higher volume on higher volatility
      
      priceData.push([timestamp, open, high, low, close, volume]);
      
      // Update the current price for the next iteration
      price = close;
    }
    
    return priceData;
  } catch (error) {
    logger.error('Error generating price history:', error);
    return [[Date.now(), 1, 1, 1, 1, 0]];
  }
}