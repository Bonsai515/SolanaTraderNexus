/**
 * Jupiter DEX Integration
 * 
 * This module provides integration with Jupiter Aggregator for optimal swap routing
 * across multiple DEXes on Solana.
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as logger from '../logger';

// Constants
const CONFIG_DIR = '../config';
const DEX_CONFIG_PATH = path.join(CONFIG_DIR, 'dex.json');

// Types
interface SwapQuote {
  routePlan: any[];
  outAmount: string;
  inAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: any;
  priceImpactPct: string;
  contextSlot?: number;
  timeTaken?: number;
}

interface SwapTransactionParams {
  userPublicKey: string;
  quoteResponse: SwapQuote;
  wrapAndUnwrapSol?: boolean;
  feeAccount?: string;
}

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
    connections: { 
      jupiter: { 
        enabled: true, 
        apiUrl: "https://quote-api.jup.ag/v6" 
      } 
    } 
  };
}

/**
 * Jupiter Integrator class
 */
export class JupiterIntegrator {
  private connection: Connection;
  private config: any;
  private apiUrl: string;
  private versionTag: string;
  private slippageBps: number;
  private requestTimeout: number;
  private maxRetries: number;
  
  constructor(connection: Connection) {
    this.connection = connection;
    this.config = loadDexConfig();
    this.apiUrl = this.config.connections.jupiter?.apiUrl || "https://quote-api.jup.ag/v6";
    this.versionTag = this.config.connections.jupiter?.versionTag || "v6";
    this.slippageBps = this.config.connections.jupiter?.slippageBps || 50;
    this.requestTimeout = this.config.connections.jupiter?.requestTimeout || 5000;
    this.maxRetries = this.config.connections.jupiter?.maxRetries || 3;
    
    logger.info(`[Jupiter] Initialized with API URL: ${this.apiUrl}`);
  }
  
  /**
   * Get a quote for swapping tokens
   */
  public async getQuote(
    inputMint: string, 
    outputMint: string, 
    amount: number, 
    slippageBps: number = this.slippageBps
  ): Promise<any> {
    try {
      const inputAmountStr = Math.round(amount).toString();
      
      const params = {
        inputMint,
        outputMint,
        amount: inputAmountStr,
        slippageBps: slippageBps.toString(),
        onlyDirectRoutes: false,
        asLegacyTransaction: false
      };
      
      // Construct the query string
      const queryString = new URLSearchParams(params).toString();
      
      // Call the Jupiter Quote API
      const response = await axios.get(`${this.apiUrl}/quote?${queryString}`, {
        timeout: this.requestTimeout
      });
      
      return response.data;
    } catch (error) {
      logger.error('[Jupiter] Error getting quote:', error);
      throw error;
    }
  }
  
  /**
   * Get a swap transaction
   */
  public async getSwapTransaction(params: SwapTransactionParams): Promise<any> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/swap`,
        {
          quoteResponse: params.quoteResponse,
          userPublicKey: params.userPublicKey,
          wrapAndUnwrapSol: params.wrapAndUnwrapSol === undefined ? true : params.wrapAndUnwrapSol,
          feeAccount: params.feeAccount
        },
        {
          timeout: this.requestTimeout
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error('[Jupiter] Error getting swap transaction:', error);
      throw error;
    }
  }
  
  /**
   * Get indexed route map (for finding token addresses)
   */
  public async getIndexedRouteMap(): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/indexed-route-map`, {
        timeout: this.requestTimeout
      });
      
      return response.data;
    } catch (error) {
      logger.error('[Jupiter] Error getting indexed route map:', error);
      throw error;
    }
  }
  
  /**
   * Execute a swap with Jupiter
   */
  public async executeSwap(
    wallet: Keypair,
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = this.slippageBps
  ): Promise<string> {
    try {
      logger.info(`[Jupiter] Executing swap: ${amount} from ${inputMint} to ${outputMint}`);
      
      // Get a quote
      const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);
      
      if (!quote) {
        throw new Error('Failed to get quote');
      }
      
      // Get swap transaction
      const swapResponse = await this.getSwapTransaction({
        userPublicKey: wallet.publicKey.toString(),
        quoteResponse: quote
      });
      
      if (!swapResponse || !swapResponse.swapTransaction) {
        throw new Error('Failed to get swap transaction');
      }
      
      // Deserialize the transaction
      const serializedTransaction = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = Transaction.from(serializedTransaction);
      
      // Sign and send the transaction
      transaction.partialSign(wallet);
      
      // Send the transaction
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        }
      );
      
      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
      
      logger.info(`[Jupiter] Swap executed successfully: ${signature}`);
      
      return signature;
    } catch (error) {
      logger.error('[Jupiter] Error executing swap:', error);
      throw error;
    }
  }
  
  /**
   * Find arbitrage opportunities across all DEXes
   */
  public async findArbitrageOpportunities(
    baseToken: string = 'USDC',
    comparisonTokens: string[] = ['SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'MEME']
  ): Promise<any[]> {
    try {
      logger.info(`[Jupiter] Searching for arbitrage opportunities from ${baseToken}`);
      
      const opportunities = [];
      const routeMap = await this.getIndexedRouteMap();
      
      // For each token, check if there's a profitable round trip
      for (const token of comparisonTokens) {
        try {
          // Get a quote for baseToken -> token
          const firstLegQuote = await this.getQuote(baseToken, token, 100 * 1000000); // 100 USDC
          
          // Get a quote for token -> baseToken
          const secondLegQuote = await this.getQuote(
            token, 
            baseToken, 
            parseInt(firstLegQuote.outAmount)
          );
          
          // Calculate the profit
          const startAmount = 100 * 1000000; // 100 USDC in smallest units
          const endAmount = parseInt(secondLegQuote.outAmount);
          const profit = endAmount - startAmount;
          const profitPercent = (profit / startAmount) * 100;
          
          // If profitable, add to opportunities
          if (profit > 0) {
            opportunities.push({
              baseToken,
              targetToken: token,
              startAmount,
              endAmount,
              profit,
              profitPercent,
              firstLeg: {
                routes: firstLegQuote.routePlan,
                inAmount: firstLegQuote.inAmount,
                outAmount: firstLegQuote.outAmount,
                priceImpact: firstLegQuote.priceImpactPct
              },
              secondLeg: {
                routes: secondLegQuote.routePlan,
                inAmount: secondLegQuote.inAmount,
                outAmount: secondLegQuote.outAmount,
                priceImpact: secondLegQuote.priceImpactPct
              },
              timestamp: new Date().toISOString()
            });
            
            logger.info(`[Jupiter] Found arbitrage opportunity: ${baseToken} -> ${token} -> ${baseToken} with ${profitPercent.toFixed(2)}% profit`);
          }
        } catch (tokenError) {
          logger.warn(`[Jupiter] Error checking arbitrage for ${token}:`, tokenError);
          continue;
        }
      }
      
      // Sort by profit percent (descending)
      opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
      
      return opportunities;
    } catch (error) {
      logger.error('[Jupiter] Error finding arbitrage opportunities:', error);
      return [];
    }
  }
  
  /**
   * Get prices for tokens compared to a base token
   */
  public async getPrices(
    baseToken: string = 'USDC',
    tokens: string[] = ['SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'MEME']
  ): Promise<Record<string, number>> {
    try {
      const prices: Record<string, number> = {};
      
      for (const token of tokens) {
        try {
          // Skip if token is the same as base token
          if (token === baseToken) {
            prices[token] = 1;
            continue;
          }
          
          // Get a quote for 1 unit of the token to the base token
          const quote = await this.getQuote(token, baseToken, 1000000); // 1 unit in smallest units
          
          // Calculate the price
          const price = parseInt(quote.outAmount) / 1000000;
          
          prices[token] = price;
        } catch (tokenError) {
          logger.warn(`[Jupiter] Error getting price for ${token}:`, tokenError);
          continue;
        }
      }
      
      return prices;
    } catch (error) {
      logger.error('[Jupiter] Error getting prices:', error);
      return {};
    }
  }
}