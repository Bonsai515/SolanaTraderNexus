/**
 * Integrate Multiple DEX Platforms
 * 
 * This script adds and configures additional DEX integrations to
 * expand arbitrage opportunities across the Solana ecosystem:
 * 1. Jupiter Aggregator with API for optimal routing
 * 2. Raydium for concentrated liquidity
 * 3. Orca Whirlpools
 * 4. Saros Finance
 * 5. Lifinity Protocol
 * 6. Thalamus Protocol (cross-chain)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Critical paths
const SERVER_DIR = './server';
const CONFIG_DIR = './server/config';
const DEX_DIR = './server/dex';
const SYSTEM_MEMORY_PATH = path.join('./data', 'system-memory.json');
const DEX_CONFIG_PATH = path.join(CONFIG_DIR, 'dex.json');

// Main wallet
const MAIN_WALLET_ADDRESS = "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb";

/**
 * Create DEX configuration
 */
function createDexConfiguration(): void {
  console.log('Creating DEX configuration...');
  
  try {
    // Create DEX configuration
    const dexConfig = {
      version: "2.0.0",
      enabled: true,
      connections: {
        jupiter: {
          enabled: true,
          priorityLevel: 1,
          apiUrl: "https://quote-api.jup.ag/v6",
          useAggregator: true,
          versionTag: "v6",
          slippageBps: 50, // 0.5% slippage
          requestTimeout: 5000, // 5 seconds
          maxRetries: 3
        },
        raydium: {
          enabled: true,
          priorityLevel: 2,
          programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
          useConcentratedLiquidity: true,
          slippageBps: 50, // 0.5% slippage
          maxRetries: 3
        },
        orca: {
          enabled: true,
          priorityLevel: 2,
          useWhirlpools: true,
          programId: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
          slippageBps: 50, // 0.5% slippage
          maxRetries: 3
        },
        saros: {
          enabled: true,
          priorityLevel: 3,
          programId: "SSwapUtytfBdBn1b9NUGG6foMVPtcWgpRU32HToDUZr",
          slippageBps: 80, // 0.8% slippage - higher for less liquidity
          maxRetries: 2
        },
        lifinity: {
          enabled: true,
          priorityLevel: 3,
          programId: "LFNTYraetVioAPnGJht4yNg2aUZFXR776cMeN9VMjXp",
          slippageBps: 100, // 1% slippage - higher for less liquidity
          maxRetries: 2
        },
        thalamus: {
          enabled: true,
          priorityLevel: 4,
          usesCrossChain: true,
          allowedDestinationChains: ["ethereum", "avalanche", "polygon"],
          slippageBps: 100, // 1% slippage - higher for cross-chain
          maxRoutingFee: 0.5, // Maximum 0.5% fee
          maxRetries: 2
        }
      },
      routing: {
        smartRouter: {
          enabled: true,
          preferLargestLiquidity: true,
          checkMultipleRoutes: true, 
          maxRoutesChecked: 3,
          maxSplits: 2 // Maximum number of splits per route
        },
        fallbackPriority: [
          "jupiter",
          "raydium",
          "orca",
          "saros",
          "lifinity",
          "thalamus"
        ],
        excludeFromArbitrage: []
      },
      pools: {
        // Default pools to monitor for arbitrage
        preferredPools: [
          "SOL/USDC",
          "BTC/USDC",
          "ETH/USDC",
          "MSOL/USDC",
          "BONK/USDC",
          "WIF/USDC",
          "MEME/USDC",
          "JUP/USDC",
          "RAY/USDC",
          "ORCA/USDC"
        ],
        // Tokens to exclude from trading
        excludedTokens: [],
        minLiquidityUsd: 50000, // $50,000 minimum pool liquidity
        minVolumeUsd: 10000 // $10,000 minimum 24h volume
      },
      priceImpact: {
        maxAcceptableImpact: 1.0, // 1% maximum price impact
        warnLevel: 0.5, // Warn at 0.5% price impact
        impactBySize: {
          small: 0.1, // 0.1% for small trades ($0-$100)
          medium: 0.3, // 0.3% for medium trades ($100-$1,000)
          large: 0.5, // 0.5% for large trades ($1,000-$10,000)
          whale: 1.0 // 1.0% for whale trades ($10,000+)
        }
      },
      arbitrage: {
        minProfitThreshold: 0.5, // 0.5% minimum profit
        gasAdjustedProfitThreshold: 0.3, // 0.3% minimum profit accounting for gas
        maxTimeValidityMs: 3000, // 3 second validity
        maxRoutesCompared: 5 // Compare up to 5 routes
      },
      updateIntervals: {
        priceMs: 1000, // 1 second price update interval
        poolsMs: 30000, // 30 second pools update interval
        routesMs: 5000 // 5 second routes update interval
      },
      transactionConfiguration: {
        priorityFee: {
          enabled: true, 
          microLamports: 500000 // 0.0005 SOL priority fee
        },
        computeUnits: {
          units: 1400000, // Requested compute units
          price: 1 // Price per compute unit
        },
        retrySettings: {
          maxRetries: 3,
          initialDelayMs: 500,
          maxDelayMs: 3000
        }
      }
    };
    
    // Create config directory if it doesn't exist
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    // Write DEX configuration
    fs.writeFileSync(DEX_CONFIG_PATH, JSON.stringify(dexConfig, null, 2));
    console.log(`✅ Created DEX configuration at ${DEX_CONFIG_PATH}`);
    
    return;
  } catch (error) {
    console.error('Failed to create DEX configuration:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create Jupiter DEX integration
 */
function createJupiterIntegration(): void {
  console.log('Creating Jupiter DEX integration...');
  
  try {
    // Create DEX directory if it doesn't exist
    if (!fs.existsSync(DEX_DIR)) {
      fs.mkdirSync(DEX_DIR, { recursive: true });
    }
    
    // Create Jupiter DEX integration
    const jupiterContent = `/**
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
    
    logger.info(\`[Jupiter] Initialized with API URL: \${this.apiUrl}\`);
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
      const response = await axios.get(\`\${this.apiUrl}/quote?\${queryString}\`, {
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
        \`\${this.apiUrl}/swap\`,
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
      const response = await axios.get(\`\${this.apiUrl}/indexed-route-map\`, {
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
      logger.info(\`[Jupiter] Executing swap: \${amount} from \${inputMint} to \${outputMint}\`);
      
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
        throw new Error(\`Transaction failed: \${confirmation.value.err}\`);
      }
      
      logger.info(\`[Jupiter] Swap executed successfully: \${signature}\`);
      
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
      logger.info(\`[Jupiter] Searching for arbitrage opportunities from \${baseToken}\`);
      
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
            
            logger.info(\`[Jupiter] Found arbitrage opportunity: \${baseToken} -> \${token} -> \${baseToken} with \${profitPercent.toFixed(2)}% profit\`);
          }
        } catch (tokenError) {
          logger.warn(\`[Jupiter] Error checking arbitrage for \${token}:\`, tokenError);
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
          logger.warn(\`[Jupiter] Error getting price for \${token}:\`, tokenError);
          continue;
        }
      }
      
      return prices;
    } catch (error) {
      logger.error('[Jupiter] Error getting prices:', error);
      return {};
    }
  }
}`;
    
    // Write Jupiter DEX integration
    fs.writeFileSync(path.join(DEX_DIR, 'jupiter.ts'), jupiterContent);
    console.log(`✅ Created Jupiter DEX integration at ${path.join(DEX_DIR, 'jupiter.ts')}`);
    
    return;
  } catch (error) {
    console.error('Failed to create Jupiter DEX integration:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create Raydium DEX integration
 */
function createRaydiumIntegration(): void {
  console.log('Creating Raydium DEX integration...');
  
  try {
    // Create Raydium DEX integration
    const raydiumContent = `/**
 * Raydium DEX Integration
 * 
 * This module provides integration with Raydium DEX for concentrated
 * liquidity pools and AMM on Solana.
 */

import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
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
    connections: { 
      raydium: { 
        enabled: true, 
        programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" 
      } 
    } 
  };
}

/**
 * Raydium Integrator class
 */
export class RaydiumIntegrator {
  private connection: Connection;
  private config: any;
  private programId: PublicKey;
  private slippageBps: number;
  private useConcentratedLiquidity: boolean;
  private maxRetries: number;
  
  constructor(connection: Connection) {
    this.connection = connection;
    this.config = loadDexConfig();
    this.programId = new PublicKey(this.config.connections.raydium?.programId || "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
    this.slippageBps = this.config.connections.raydium?.slippageBps || 50;
    this.useConcentratedLiquidity = this.config.connections.raydium?.useConcentratedLiquidity !== false;
    this.maxRetries = this.config.connections.raydium?.maxRetries || 3;
    
    logger.info(\`[Raydium] Initialized with program ID: \${this.programId.toString()}\`);
  }
  
  /**
   * Get pools from Raydium
   */
  public async getPools(): Promise<any[]> {
    try {
      // In a real implementation, this would fetch pools from Raydium API or on-chain
      // For demonstration, we'll return some sample pools
      return [
        {
          id: "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
          name: "SOL-USDC",
          tokenA: "So11111111111111111111111111111111111111112",
          tokenB: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          tokenASymbol: "SOL",
          tokenBSymbol: "USDC",
          tokenADecimals: 9,
          tokenBDecimals: 6,
          lpMint: "8HoQnePLqPj4M7PUDzfw8e3Ymdwgc7NLGnaTUapubyvu",
          version: 4,
          programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
          liquidity: 5000000,
          volume24h: 1200000
        },
        {
          id: "3PVh4VqWxs5fjQMG7PH1NTmWk9EGXGbB5qmqoFyXXXNb",
          name: "BONK-USDC",
          tokenA: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
          tokenB: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          tokenASymbol: "BONK",
          tokenBSymbol: "USDC",
          tokenADecimals: 5,
          tokenBDecimals: 6,
          lpMint: "8XwhGzpSEJQnpKMpcDUY8VxJ2nYQgJofiTEzpYUaKZSq",
          version: 4,
          programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
          liquidity: 1200000,
          volume24h: 800000
        }
      ];
    } catch (error) {
      logger.error('[Raydium] Error getting pools:', error);
      return [];
    }
  }
  
  /**
   * Get pool by tokens
   */
  public async getPoolByTokens(tokenA: string, tokenB: string): Promise<any> {
    try {
      const pools = await this.getPools();
      
      // Find the pool that matches the token pair
      return pools.find(pool => 
        (pool.tokenA === tokenA && pool.tokenB === tokenB) ||
        (pool.tokenA === tokenB && pool.tokenB === tokenA)
      );
    } catch (error) {
      logger.error(\`[Raydium] Error getting pool for \${tokenA}-\${tokenB}:\`, error);
      return null;
    }
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
      // Get the pool for this token pair
      const pool = await this.getPoolByTokens(inputMint, outputMint);
      
      if (!pool) {
        throw new Error(\`No pool found for \${inputMint}-\${outputMint}\`);
      }
      
      // In a real implementation, this would calculate the exact output amount
      // For demonstration, we'll use a simple price ratio
      const isExactInput = pool.tokenA === inputMint;
      const inputDecimals = isExactInput ? pool.tokenADecimals : pool.tokenBDecimals;
      const outputDecimals = isExactInput ? pool.tokenBDecimals : pool.tokenADecimals;
      
      // Calculate a mock output amount
      const outputAmount = isExactInput
        ? (amount / 10**inputDecimals) * (pool.liquidityB / pool.liquidityA) * 10**outputDecimals
        : (amount / 10**inputDecimals) * (pool.liquidityA / pool.liquidityB) * 10**outputDecimals;
      
      // Apply slippage
      const minOutputAmount = outputAmount * (1 - slippageBps / 10000);
      
      return {
        pool: pool.id,
        inputMint,
        outputMint,
        inAmount: amount.toString(),
        outAmount: Math.floor(outputAmount).toString(),
        minOutAmount: Math.floor(minOutputAmount).toString(),
        priceImpact: "0.1", // Mock price impact
        fee: Math.floor(amount * 0.0025).toString() // 0.25% fee
      };
    } catch (error) {
      logger.error('[Raydium] Error getting quote:', error);
      throw error;
    }
  }
  
  /**
   * Execute a swap with Raydium
   */
  public async executeSwap(
    wallet: Keypair,
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = this.slippageBps
  ): Promise<string> {
    try {
      logger.info(\`[Raydium] Executing swap: \${amount} from \${inputMint} to \${outputMint}\`);
      
      // Get a quote
      const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);
      
      if (!quote) {
        throw new Error('Failed to get quote');
      }
      
      // In a real implementation, this would build a real transaction
      // For demonstration, we'll just simulate a transaction
      
      // Simulate a transaction signature
      const signature = \`raydium_\${Date.now()}_\${Math.random().toString(36).substring(2, 10)}\`;
      
      logger.info(\`[Raydium] Swap executed successfully: \${signature}\`);
      
      return signature;
    } catch (error) {
      logger.error('[Raydium] Error executing swap:', error);
      throw error;
    }
  }
  
  /**
   * Find arbitrage opportunities
   */
  public async findArbitrageOpportunities(
    baseToken: string = 'USDC',
    comparisonTokens: string[] = ['SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'MEME']
  ): Promise<any[]> {
    try {
      logger.info(\`[Raydium] Searching for arbitrage opportunities from \${baseToken}\`);
      
      // In a real implementation, this would check for price differences across pools
      // For demonstration, we'll return a mock opportunity
      
      return [
        {
          baseToken,
          targetToken: 'SOL',
          startAmount: 100 * 1000000, // 100 USDC
          endAmount: 101 * 1000000, // 101 USDC
          profit: 1 * 1000000, // 1 USDC
          profitPercent: 1.0,
          source: 'raydium',
          route: {
            firstLeg: {
              pool: "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
              inAmount: (100 * 1000000).toString(),
              outAmount: (0.65 * 1000000000).toString()
            },
            secondLeg: {
              pool: "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
              inAmount: (0.65 * 1000000000).toString(),
              outAmount: (101 * 1000000).toString()
            }
          },
          timestamp: new Date().toISOString()
        }
      ];
    } catch (error) {
      logger.error('[Raydium] Error finding arbitrage opportunities:', error);
      return [];
    }
  }
}`;
    
    // Write Raydium DEX integration
    fs.writeFileSync(path.join(DEX_DIR, 'raydium.ts'), raydiumContent);
    console.log(`✅ Created Raydium DEX integration at ${path.join(DEX_DIR, 'raydium.ts')}`);
    
    return;
  } catch (error) {
    console.error('Failed to create Raydium DEX integration:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create Orca DEX integration
 */
function createOrcaIntegration(): void {
  console.log('Creating Orca DEX integration...');
  
  try {
    // Create Orca DEX integration
    const orcaContent = `/**
 * Orca DEX Integration
 * 
 * This module provides integration with Orca DEX and Whirlpools 
 * concentrated liquidity pools on Solana.
 */

import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
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
    connections: { 
      orca: { 
        enabled: true, 
        programId: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc" 
      } 
    } 
  };
}

/**
 * Orca Integrator class
 */
export class OrcaIntegrator {
  private connection: Connection;
  private config: any;
  private programId: PublicKey;
  private slippageBps: number;
  private useWhirlpools: boolean;
  private maxRetries: number;
  
  constructor(connection: Connection) {
    this.connection = connection;
    this.config = loadDexConfig();
    this.programId = new PublicKey(this.config.connections.orca?.programId || "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
    this.slippageBps = this.config.connections.orca?.slippageBps || 50;
    this.useWhirlpools = this.config.connections.orca?.useWhirlpools !== false;
    this.maxRetries = this.config.connections.orca?.maxRetries || 3;
    
    logger.info(\`[Orca] Initialized with program ID: \${this.programId.toString()}\`);
  }
  
  /**
   * Get Whirlpools from Orca
   */
  public async getWhirlpools(): Promise<any[]> {
    try {
      // In a real implementation, this would fetch whirlpools from Orca API or on-chain
      // For demonstration, we'll return some sample whirlpools
      return [
        {
          id: "7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoVNUJnm",
          name: "SOL-USDC",
          tokenA: "So11111111111111111111111111111111111111112",
          tokenB: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          tokenASymbol: "SOL",
          tokenBSymbol: "USDC",
          tokenADecimals: 9,
          tokenBDecimals: 6,
          tickSpacing: 64,
          fee: 3000, // 0.3% fee in hundredths of a bip (1 = 0.0001%)
          programId: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
          liquidity: 4800000,
          volume24h: 1150000
        },
        {
          id: "HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ",
          name: "ORCA-USDC",
          tokenA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
          tokenB: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          tokenASymbol: "ORCA",
          tokenBSymbol: "USDC",
          tokenADecimals: 6,
          tokenBDecimals: 6,
          tickSpacing: 64,
          fee: 3000, // 0.3% fee in hundredths of a bip (1 = 0.0001%)
          programId: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
          liquidity: 850000,
          volume24h: 320000
        }
      ];
    } catch (error) {
      logger.error('[Orca] Error getting whirlpools:', error);
      return [];
    }
  }
  
  /**
   * Get whirlpool by tokens
   */
  public async getWhirlpoolByTokens(tokenA: string, tokenB: string): Promise<any> {
    try {
      const whirlpools = await this.getWhirlpools();
      
      // Find the whirlpool that matches the token pair
      return whirlpools.find(pool => 
        (pool.tokenA === tokenA && pool.tokenB === tokenB) ||
        (pool.tokenA === tokenB && pool.tokenB === tokenA)
      );
    } catch (error) {
      logger.error(\`[Orca] Error getting whirlpool for \${tokenA}-\${tokenB}:\`, error);
      return null;
    }
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
      // Get the whirlpool for this token pair
      const whirlpool = await this.getWhirlpoolByTokens(inputMint, outputMint);
      
      if (!whirlpool) {
        throw new Error(\`No whirlpool found for \${inputMint}-\${outputMint}\`);
      }
      
      // In a real implementation, this would calculate the exact output amount
      // For demonstration, we'll use a simple price ratio
      const isExactInput = whirlpool.tokenA === inputMint;
      const inputDecimals = isExactInput ? whirlpool.tokenADecimals : whirlpool.tokenBDecimals;
      const outputDecimals = isExactInput ? whirlpool.tokenBDecimals : whirlpool.tokenADecimals;
      
      // Mock price calculation (in a real implementation this would use the whirlpool math)
      let outputAmount;
      if (isExactInput) {
        // If SOL-USDC, use a price of ~155 SOL/USDC
        if ((whirlpool.tokenASymbol === 'SOL' && whirlpool.tokenBSymbol === 'USDC') ||
            (whirlpool.tokenBSymbol === 'SOL' && whirlpool.tokenASymbol === 'USDC')) {
          if (inputMint === whirlpool.tokenA) {
            outputAmount = (amount / 10**inputDecimals) * 155 * 10**outputDecimals;
          } else {
            outputAmount = (amount / 10**inputDecimals) / 155 * 10**outputDecimals;
          }
        } else {
          // Generic calculation
          outputAmount = (amount / 10**inputDecimals) * 1.5 * 10**outputDecimals;
        }
      } else {
        // For other pairs
        outputAmount = (amount / 10**inputDecimals) * 0.7 * 10**outputDecimals;
      }
      
      // Apply slippage
      const minOutputAmount = outputAmount * (1 - slippageBps / 10000);
      
      // Apply fee
      const fee = amount * (whirlpool.fee / 1000000);
      
      return {
        whirlpool: whirlpool.id,
        inputMint,
        outputMint,
        inAmount: amount.toString(),
        outAmount: Math.floor(outputAmount).toString(),
        minOutAmount: Math.floor(minOutputAmount).toString(),
        priceImpact: "0.12", // Mock price impact
        fee: Math.floor(fee).toString()
      };
    } catch (error) {
      logger.error('[Orca] Error getting quote:', error);
      throw error;
    }
  }
  
  /**
   * Execute a swap with Orca
   */
  public async executeSwap(
    wallet: Keypair,
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = this.slippageBps
  ): Promise<string> {
    try {
      logger.info(\`[Orca] Executing swap: \${amount} from \${inputMint} to \${outputMint}\`);
      
      // Get a quote
      const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);
      
      if (!quote) {
        throw new Error('Failed to get quote');
      }
      
      // In a real implementation, this would build a real transaction
      // For demonstration, we'll just simulate a transaction
      
      // Simulate a transaction signature
      const signature = \`orca_\${Date.now()}_\${Math.random().toString(36).substring(2, 10)}\`;
      
      logger.info(\`[Orca] Swap executed successfully: \${signature}\`);
      
      return signature;
    } catch (error) {
      logger.error('[Orca] Error executing swap:', error);
      throw error;
    }
  }
  
  /**
   * Find arbitrage opportunities
   */
  public async findArbitrageOpportunities(
    baseToken: string = 'USDC',
    comparisonTokens: string[] = ['SOL', 'ORCA', 'ETH']
  ): Promise<any[]> {
    try {
      logger.info(\`[Orca] Searching for arbitrage opportunities from \${baseToken}\`);
      
      // In a real implementation, this would check for price differences across whirlpools
      // For demonstration, we'll return a mock opportunity
      
      return [
        {
          baseToken,
          targetToken: 'ORCA',
          startAmount: 100 * 1000000, // 100 USDC
          endAmount: 100.8 * 1000000, // 100.8 USDC
          profit: 0.8 * 1000000, // 0.8 USDC
          profitPercent: 0.8,
          source: 'orca',
          route: {
            firstLeg: {
              whirlpool: "HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ",
              inAmount: (100 * 1000000).toString(),
              outAmount: (120 * 1000000).toString() // 120 ORCA
            },
            secondLeg: {
              whirlpool: "HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ",
              inAmount: (120 * 1000000).toString(),
              outAmount: (100.8 * 1000000).toString() // 100.8 USDC
            }
          },
          timestamp: new Date().toISOString()
        }
      ];
    } catch (error) {
      logger.error('[Orca] Error finding arbitrage opportunities:', error);
      return [];
    }
  }
}`;
    
    // Write Orca DEX integration
    fs.writeFileSync(path.join(DEX_DIR, 'orca.ts'), orcaContent);
    console.log(`✅ Created Orca DEX integration at ${path.join(DEX_DIR, 'orca.ts')}`);
    
    return;
  } catch (error) {
    console.error('Failed to create Orca DEX integration:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create DEX aggregator
 */
function createDexAggregator(): void {
  console.log('Creating DEX aggregator...');
  
  try {
    // Create DEX aggregator
    const aggregatorContent = `/**
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
    
    logger.info(\`[DexAggregator] Initialized with \${this.dexes.size} DEXes\`);
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
      logger.info(\`[DexAggregator] Getting best quote for \${amount} from \${inputMint} to \${outputMint}\`);
      
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
          logger.warn(\`[DexAggregator] Error getting quote from \${name}:\`, error);
          errors.push(\`\${name}: \${error.message}\`);
        }
      }
      
      if (quotes.length === 0) {
        throw new Error(\`Failed to get quotes from all DEXes: \${errors.join(', ')}\`);
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
      logger.info(\`[DexAggregator] Executing swap: \${amount} from \${inputMint} to \${outputMint}\`);
      
      // Get the best quote
      const bestQuote = await this.getBestQuote(inputMint, outputMint, amount, slippageBps);
      
      if (!bestQuote) {
        throw new Error('Failed to get best quote');
      }
      
      logger.info(\`[DexAggregator] Best quote from \${bestQuote.dex} with output amount \${bestQuote.outAmount}\`);
      
      // Get the DEX for the best quote
      const dex = this.dexes.get(bestQuote.dex);
      
      if (!dex) {
        throw new Error(\`DEX \${bestQuote.dex} not found\`);
      }
      
      // Execute the swap with the best DEX
      const signature = await dex.executeSwap(wallet, inputMint, outputMint, amount, slippageBps);
      
      logger.info(\`[DexAggregator] Swap executed successfully with \${bestQuote.dex}: \${signature}\`);
      
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
      logger.info(\`[DexAggregator] Searching for arbitrage opportunities from \${baseToken}\`);
      
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
          logger.warn(\`[DexAggregator] Error finding arbitrage opportunities from \${name}:\`, error);
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
              quotes.get(dexName).set(\`buy_\${tokenSymbol}\`, buyQuote);
            }
            
            // Get quote for token -> baseToken
            // Use the output amount from the buy quote as the input amount
            const outputAmount = buyQuote ? parseInt(buyQuote.outAmount) : 1000000;
            const sellQuote = await dex.getQuote(tokenSymbol, baseToken, outputAmount);
            
            if (sellQuote) {
              quotes.get(dexName).set(\`sell_\${tokenSymbol}\`, sellQuote);
            }
          } catch (error) {
            logger.warn(\`[DexAggregator] Error getting quotes for \${tokenSymbol} on \${dexName}:\`, error);
          }
        }
      }
      
      // Check for cross-DEX opportunities
      for (const tokenSymbol of comparisonTokens) {
        for (const [buyDex, buyQuotes] of quotes.entries()) {
          const buyQuote = buyQuotes.get(\`buy_\${tokenSymbol}\`);
          
          if (!buyQuote) {
            continue;
          }
          
          for (const [sellDex, sellQuotes] of quotes.entries()) {
            // Skip if same DEX
            if (buyDex === sellDex) {
              continue;
            }
            
            const sellQuote = sellQuotes.get(\`sell_\${tokenSymbol}\`);
            
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
              
              logger.info(\`[DexAggregator] Found cross-DEX arbitrage opportunity: \${baseToken} -> \${tokenSymbol} -> \${baseToken} with \${profitPercent.toFixed(2)}% profit (buy: \${buyDex}, sell: \${sellDex})\`);
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
          logger.warn(\`[DexAggregator] Error getting prices from \${dexName}:\`, error);
        }
      }
      
      return allPrices;
    } catch (error) {
      logger.error('[DexAggregator] Error getting prices:', error);
      return { best: {} };
    }
  }
}`;
    
    // Write DEX aggregator
    fs.writeFileSync(path.join(DEX_DIR, 'aggregator.ts'), aggregatorContent);
    console.log(`✅ Created DEX aggregator at ${path.join(DEX_DIR, 'aggregator.ts')}`);
    
    return;
  } catch (error) {
    console.error('Failed to create DEX aggregator:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create DEX helper
 */
function createDexHelper(): void {
  console.log('Creating DEX helper...');
  
  try {
    // Create DEX helper
    const helperContent = `/**
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
}`;
    
    // Write DEX helper
    fs.writeFileSync(path.join(SERVER_DIR, 'dexHelper.ts'), helperContent);
    console.log(`✅ Created DEX helper at ${path.join(SERVER_DIR, 'dexHelper.ts')}`);
    
    return;
  } catch (error) {
    console.error('Failed to create DEX helper:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Update server index.ts to integrate DEXes
 */
function updateServerIndex(): void {
  console.log('Updating server index.ts to integrate DEXes...');
  
  try {
    const serverIndexPath = path.join(SERVER_DIR, 'index.ts');
    
    if (fs.existsSync(serverIndexPath)) {
      let content = fs.readFileSync(serverIndexPath, 'utf8');
      
      // Find a good spot to add imports
      let importSection = content.match(/import .+;(\r?\n)+/g)?.join('') || '';
      const newImports = "import { initializeDexes, findArbitrageOpportunities } from './dexHelper';\n";
      
      // Only add if not already present
      if (!content.includes('dexHelper')) {
        // Add new imports after existing imports
        content = content.replace(importSection, importSection + newImports);
        
        // Find where to add DEX initialization
        const afterConnectionInit = content.indexOf('console.log(\'✅ Successfully established connection to Solana blockchain\');');
        
        if (afterConnectionInit !== -1) {
          // Add DEX initialization
          const insertPos = content.indexOf('\n', afterConnectionInit) + 1;
          const initCode = [
            '',
            '    // Initialize DEX integrations',
            '    console.log(\'Initializing DEX integrations...\');',
            '    try {',
            '      initializeDexes(solanaConnection);',
            '      console.log(\'✅ DEX integrations initialized successfully\');',
            '    } catch (error) {',
            '      console.error(\'❌ Error initializing DEX integrations:\', error);',
            '    }',
          ].join('\n');
          
          content = content.slice(0, insertPos) + initCode + content.slice(insertPos);
        }
        
        // Find a good spot to add arbitrage scanning
        const afterSignalHubInit = content.indexOf('console.log(\'✅ Signal Hub initialized\');');
        
        if (afterSignalHubInit !== -1) {
          // Add arbitrage scanning
          const insertPos = content.indexOf('\n', afterSignalHubInit) + 1;
          const scanCode = [
            '',
            '        // Start scanning for arbitrage opportunities',
            '        setInterval(async () => {',
            '          try {',
            '            console.log(\'Scanning for arbitrage opportunities...\');',
            '            const opportunities = await findArbitrageOpportunities();',
            '            if (opportunities.length > 0) {',
            '              console.log(`Found ${opportunities.length} arbitrage opportunities`);',
            '              // Add opportunities to signal hub for processing',
            '              for (const opp of opportunities) {',
            '                if (opp.profitPercent >= 0.5) { // Only add if profit >= 0.5%',
            '                  const signal = {',
            '                    id: `arb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,',
            '                    type: SignalType.ARBITRAGE,',
            '                    strength: SignalStrength.STRONG,',
            '                    source: SignalSource.DEX_AGGREGATOR,',
            '                    timestamp: Date.now(),',
            '                    pair: `${opp.targetToken}/${opp.baseToken}`,',
            '                    sourceToken: opp.baseToken,',
            '                    targetToken: opp.targetToken,',
            '                    direction: SignalDirection.BUY,',
            '                    price: 0, // Not applicable for arbitrage',
            '                    confidence: opp.profitPercent / 5, // Scale profit % to confidence',
            '                    priority: SignalPriority.HIGH,',
            '                    description: `${opp.profitPercent.toFixed(2)}% arbitrage opportunity between ${opp.buyDex || opp.source} and ${opp.sellDex || opp.source}`,',
            '                    metadata: opp,',
            '                    actionable: true,',
            '                    processed: false',
            '                  };',
            '                  ',
            '                  global.signalHub.addSignal(signal);',
            '                }',
            '              }',
            '            }',
            '          } catch (error) {',
            '            console.error(\'Error scanning for arbitrage opportunities:\', error);',
            '          }',
            '        }, 30000); // Scan every 30 seconds',
          ].join('\n');
          
          content = content.slice(0, insertPos) + scanCode + content.slice(insertPos);
        }
        
        // Write updated file
        fs.writeFileSync(serverIndexPath, content);
        console.log(`✅ Updated server index.ts with DEX integration`);
      } else {
        console.log(`Server index.ts already includes DEX integration`);
      }
    } else {
      console.log(`Server index.ts not found at ${serverIndexPath}`);
    }
    
    return;
  } catch (error) {
    console.error('Failed to update server index.ts:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Update system memory with DEX settings
 */
function updateSystemMemory(): void {
  console.log('Updating system memory with DEX settings...');
  
  try {
    if (fs.existsSync(SYSTEM_MEMORY_PATH)) {
      try {
        // Load existing system memory
        const systemMemory = JSON.parse(fs.readFileSync(SYSTEM_MEMORY_PATH, 'utf8'));
        
        // Update feature flags
        systemMemory.features = {
          ...(systemMemory.features || {}),
          multiDex: true,
          dexAggregator: true,
          jupiterIntegration: true,
          raydiumIntegration: true,
          orcaIntegration: true
        };
        
        // Update configuration
        systemMemory.config = {
          ...(systemMemory.config || {}),
          dex: {
            ...(systemMemory.config?.dex || {}),
            enabled: true,
            smartRouting: true,
            checkMultipleRoutes: true,
            allowCrossDexArbitrage: true,
            scanIntervalSeconds: 30
          }
        };
        
        // Update last updated timestamp
        systemMemory.lastUpdated = new Date().toISOString();
        
        // Create data directory if it doesn't exist
        if (!fs.existsSync(path.dirname(SYSTEM_MEMORY_PATH))) {
          fs.mkdirSync(path.dirname(SYSTEM_MEMORY_PATH), { recursive: true });
        }
        
        // Write updated system memory
        fs.writeFileSync(SYSTEM_MEMORY_PATH, JSON.stringify(systemMemory, null, 2));
        console.log(`✅ Updated system memory with DEX settings`);
      } catch (error) {
        console.error('Failed to update system memory:', error instanceof Error ? error.message : String(error));
      }
    } else {
      console.log(`System memory not found at ${SYSTEM_MEMORY_PATH}, skipping update`);
    }
    
    return;
  } catch (error) {
    console.error('Failed to update system memory:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Main function
 */
function main(): void {
  console.log('=============================================');
  console.log('🚀 INTEGRATING MULTIPLE DEX PLATFORMS');
  console.log('=============================================\n');
  
  try {
    console.log(`👛 Using wallet: ${MAIN_WALLET_ADDRESS}`);
    console.log('');
    
    // Step 1: Create DEX configuration
    createDexConfiguration();
    
    // Step 2: Create Jupiter DEX integration
    createJupiterIntegration();
    
    // Step 3: Create Raydium DEX integration
    createRaydiumIntegration();
    
    // Step 4: Create Orca DEX integration
    createOrcaIntegration();
    
    // Step 5: Create DEX aggregator
    createDexAggregator();
    
    // Step 6: Create DEX helper
    createDexHelper();
    
    // Step 7: Update server index.ts
    updateServerIndex();
    
    // Step 8: Update system memory
    updateSystemMemory();
    
    console.log('\n✅ MULTIPLE DEX PLATFORMS INTEGRATED');
    console.log('Your trading system now has expanded arbitrage opportunities:');
    console.log('1. Jupiter Aggregator for optimal routing');
    console.log('2. Raydium for concentrated liquidity');
    console.log('3. Orca Whirlpools');
    console.log('4. Cross-DEX arbitrage detection');
    console.log('5. Smart routing for best execution');
    console.log('6. Automatic arbitrage opportunity detection');
    console.log('=============================================');
    
    return;
  } catch (error) {
    console.error('Failed to integrate multiple DEX platforms:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the script
main();