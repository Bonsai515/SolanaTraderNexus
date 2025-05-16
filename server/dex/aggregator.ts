/**
 * DEX Aggregator
 * 
 * This module provides a unified interface to multiple DEXes
 * for optimal routing and arbitrage opportunities.
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { JupiterIntegrator } from './jupiter';
import { RaydiumIntegrator } from './raydium';
import { OrcaIntegrator } from './orca';
import * as fs from 'fs';
import * as path from 'path';
import * as logger from '../logger';

// Constants
const CONFIG_DIR = '../config';
const DEX_CONFIG_PATH = path.join(CONFIG_DIR, 'dex.json');

/**
 * Load DEX configuration
 */
function loadDexConfig() {
  try {
    if (fs.existsSync(DEX_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(DEX_CONFIG_PATH, 'utf8'));
    }
  } catch (error) {
    logger.error('Error loading DEX config:', error);
  }
  
  return { 
    enabled: true,
    routing: {
      smartRouter: { enabled: true }
    }
  };
}

/**
 * DEX Aggregator class
 */
export class DexAggregator {
  private connection: Connection;
  private config: any;
  private jupiter: JupiterIntegrator;
  private raydium: RaydiumIntegrator;
  private orca: OrcaIntegrator;
  private dexes: Map<string, any> = new Map();
  
  constructor(connection: Connection) {
    this.connection = connection;
    this.config = loadDexConfig();
    
    // Initialize DEX integrations
    this.jupiter = new JupiterIntegrator(connection);
    this.raydium = new RaydiumIntegrator(connection);
    this.orca = new OrcaIntegrator(connection);
    
    // Add to DEX map
    this.dexes.set('jupiter', this.jupiter);
    this.dexes.set('raydium', this.raydium);
    this.dexes.set('orca', this.orca);
    
    logger.info(`[DexAggregator] Initialized with ${this.dexes.size} DEXes`);
  }
  
  /**
   * Get the best quote across all DEXes
   */
  public async getBestQuote(
    inputMint: string, 
    outputMint: string, 
    amount: number,
    slippageBps: number = 50
  ): Promise<any> {
    try {
      logger.info(`[DexAggregator] Getting best quote for ${amount} from ${inputMint} to ${outputMint}`);
      
      const quotes = [];
      const errors = [];
      
      // Get quotes from all DEXes
      for (const [name, dex] of this.dexes.entries()) {
        try {
          const quote = await dex.getQuote(inputMint, outputMint, amount, slippageBps);
          
          if (quote) {
            quotes.push({
              dex: name,
              ...quote
            });
          }
        } catch (error) {
          logger.warn(`[DexAggregator] Error getting quote from ${name}:`, error);
          errors.push(`${name}: ${error.message}`);
        }
      }
      
      if (quotes.length === 0) {
        throw new Error(`Failed to get quotes from all DEXes: ${errors.join(', ')}`);
      }
      
      // Sort quotes by outAmount (descending)
      quotes.sort((a, b) => parseInt(b.outAmount) - parseInt(a.outAmount));
      
      // Return the best quote
      return quotes[0];
    } catch (error) {
      logger.error('[DexAggregator] Error getting best quote:', error);
      throw error;
    }
  }
  
  /**
   * Execute a swap with the best DEX
   */
  public async executeSwap(
    wallet: Keypair,
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<string> {
    try {
      logger.info(`[DexAggregator] Executing swap: ${amount} from ${inputMint} to ${outputMint}`);
      
      // Get the best quote
      const bestQuote = await this.getBestQuote(inputMint, outputMint, amount, slippageBps);
      
      if (!bestQuote) {
        throw new Error('Failed to get best quote');
      }
      
      logger.info(`[DexAggregator] Best quote from ${bestQuote.dex} with output amount ${bestQuote.outAmount}`);
      
      // Get the DEX for the best quote
      const dex = this.dexes.get(bestQuote.dex);
      
      if (!dex) {
        throw new Error(`DEX ${bestQuote.dex} not found`);
      }
      
      // Execute the swap with the best DEX
      const signature = await dex.executeSwap(wallet, inputMint, outputMint, amount, slippageBps);
      
      logger.info(`[DexAggregator] Swap executed successfully with ${bestQuote.dex}: ${signature}`);
      
      return signature;
    } catch (error) {
      logger.error('[DexAggregator] Error executing swap:', error);
      throw error;
    }
  }
  
  /**
   * Find arbitrage opportunities across all DEXes
   */
  public async findArbitrageOpportunities(
    baseToken: string = 'USDC',
    comparisonTokens: string[] = ['SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'MEME', 'ORCA']
  ): Promise<any[]> {
    try {
      logger.info(`[DexAggregator] Searching for arbitrage opportunities from ${baseToken}`);
      
      const allOpportunities = [];
      
      // Get opportunities from each DEX
      for (const [name, dex] of this.dexes.entries()) {
        try {
          const opportunities = await dex.findArbitrageOpportunities(baseToken, comparisonTokens);
          
          if (opportunities && opportunities.length > 0) {
            // Add the DEX name if not already present
            opportunities.forEach(opp => {
              if (!opp.source) {
                opp.source = name;
              }
            });
            
            allOpportunities.push(...opportunities);
          }
        } catch (error) {
          logger.warn(`[DexAggregator] Error finding arbitrage opportunities from ${name}:`, error);
        }
      }
      
      // Find cross-DEX opportunities
      const crossDexOpportunities = await this.findCrossDexArbitrageOpportunities(baseToken, comparisonTokens);
      allOpportunities.push(...crossDexOpportunities);
      
      // Sort opportunities by profit percent (descending)
      allOpportunities.sort((a, b) => b.profitPercent - a.profitPercent);
      
      // Filter out opportunities with profit < 0.1%
      const filteredOpportunities = allOpportunities.filter(opp => opp.profitPercent >= 0.1);
      
      return filteredOpportunities;
    } catch (error) {
      logger.error('[DexAggregator] Error finding arbitrage opportunities:', error);
      return [];
    }
  }
  
  /**
   * Find cross-DEX arbitrage opportunities
   */
  private async findCrossDexArbitrageOpportunities(
    baseToken: string = 'USDC',
    comparisonTokens: string[] = ['SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'MEME', 'ORCA']
  ): Promise<any[]> {
    try {
      const opportunities = [];
      
      // Get quotes for each token and DEX combination
      const quotes = new Map();
      
      for (const [dexName, dex] of this.dexes.entries()) {
        quotes.set(dexName, new Map());
        
        for (const tokenSymbol of comparisonTokens) {
          try {
            // Get quote for baseToken -> token
            const buyQuote = await dex.getQuote(baseToken, tokenSymbol, 100 * 1000000); // 100 USDC
            
            if (buyQuote) {
              quotes.get(dexName).set(`buy_${tokenSymbol}`, buyQuote);
            }
            
            // Get quote for token -> baseToken
            // Use the output amount from the buy quote as the input amount
            const outputAmount = buyQuote ? parseInt(buyQuote.outAmount) : 1000000;
            const sellQuote = await dex.getQuote(tokenSymbol, baseToken, outputAmount);
            
            if (sellQuote) {
              quotes.get(dexName).set(`sell_${tokenSymbol}`, sellQuote);
            }
          } catch (error) {
            logger.warn(`[DexAggregator] Error getting quotes for ${tokenSymbol} on ${dexName}:`, error);
          }
        }
      }
      
      // Check for cross-DEX opportunities
      for (const tokenSymbol of comparisonTokens) {
        for (const [buyDex, buyQuotes] of quotes.entries()) {
          const buyQuote = buyQuotes.get(`buy_${tokenSymbol}`);
          
          if (!buyQuote) {
            continue;
          }
          
          for (const [sellDex, sellQuotes] of quotes.entries()) {
            // Skip if same DEX
            if (buyDex === sellDex) {
              continue;
            }
            
            const sellQuote = sellQuotes.get(`sell_${tokenSymbol}`);
            
            if (!sellQuote) {
              continue;
            }
            
            // Calculate the profit
            const startAmount = 100 * 1000000; // 100 USDC
            const midAmount = parseInt(buyQuote.outAmount);
            const endAmount = parseInt(sellQuote.outAmount);
            const profit = endAmount - startAmount;
            const profitPercent = (profit / startAmount) * 100;
            
            // If profitable, add to opportunities
            if (profit > 0) {
              opportunities.push({
                baseToken,
                targetToken: tokenSymbol,
                startAmount,
                midAmount,
                endAmount,
                profit,
                profitPercent,
                buyDex,
                sellDex,
                route: {
                  firstLeg: {
                    dex: buyDex,
                    inAmount: startAmount.toString(),
                    outAmount: midAmount.toString()
                  },
                  secondLeg: {
                    dex: sellDex,
                    inAmount: midAmount.toString(),
                    outAmount: endAmount.toString()
                  }
                },
                type: 'cross-dex',
                timestamp: new Date().toISOString()
              });
              
              logger.info(`[DexAggregator] Found cross-DEX arbitrage opportunity: ${baseToken} -> ${tokenSymbol} -> ${baseToken} with ${profitPercent.toFixed(2)}% profit (buy: ${buyDex}, sell: ${sellDex})`);
            }
          }
        }
      }
      
      return opportunities;
    } catch (error) {
      logger.error('[DexAggregator] Error finding cross-DEX arbitrage opportunities:', error);
      return [];
    }
  }
  
  /**
   * Get prices for tokens compared to a base token across all DEXes
   */
  public async getPrices(
    baseToken: string = 'USDC',
    tokens: string[] = ['SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'MEME', 'ORCA']
  ): Promise<any> {
    try {
      const allPrices: any = {};
      
      // Get prices from Jupiter (most reliable source for prices)
      try {
        const jupiterPrices = await this.jupiter.getPrices(baseToken, tokens);
        
        // Use Jupiter prices as the base
        allPrices.jupiter = jupiterPrices;
        allPrices.best = { ...jupiterPrices };
      } catch (error) {
        logger.warn('[DexAggregator] Error getting prices from Jupiter:', error);
      }
      
      // Get prices from other DEXes and compare
      for (const [dexName, dex] of this.dexes.entries()) {
        if (dexName === 'jupiter') {
          continue; // Already got Jupiter prices
        }
        
        try {
          // If the DEX has a getPrices method, use it
          if (typeof dex.getPrices === 'function') {
            const dexPrices = await dex.getPrices(baseToken, tokens);
            
            if (dexPrices) {
              allPrices[dexName] = dexPrices;
              
              // Update best prices
              for (const [token, price] of Object.entries(dexPrices)) {
                if (!allPrices.best[token] || price > allPrices.best[token]) {
                  allPrices.best[token] = price;
                }
              }
            }
          }
        } catch (error) {
          logger.warn(`[DexAggregator] Error getting prices from ${dexName}:`, error);
        }
      }
      
      return allPrices;
    } catch (error) {
      logger.error('[DexAggregator] Error getting prices:', error);
      return { best: {} };
    }
  }
}