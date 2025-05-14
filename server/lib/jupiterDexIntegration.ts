/**
 * Jupiter DEX Integration for Real Token Swaps
 * 
 * This module provides integration with Jupiter DEX for executing real token swaps
 * on the Solana blockchain. It fetches real-time quotes, generates swap instructions,
 * and allows execution of trades directly through Jupiter's API.
 */

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { logger } from '../logger';
import axios from 'axios';

// Jupiter API endpoints
const JUPITER_API_BASE = 'https://quote-api.jup.ag/v6';
const JUPITER_SWAP_API = `${JUPITER_API_BASE}/swap`;
const JUPITER_PRICE_API = `${JUPITER_API_BASE}/price`;
const JUPITER_QUOTE_API = `${JUPITER_API_BASE}/quote`;
const JUPITER_TOKENS_API = `${JUPITER_API_BASE}/tokens`;

interface JupiterToken {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
  tags?: string[];
}

interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  amount: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  platformFee?: {
    feeBps: number;
    feeAccount: string;
  };
  onlyDirectRoutes?: boolean;
}

interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: number;
  routePlan: any[];
  contextSlot: number;
}

interface JupiterSwapRequest {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  prioritizationFeeLamports?: string | number;
}

interface JupiterSwapResponse {
  swapTransaction: string;
}

/**
 * Jupiter DEX Integration Class
 */
export class JupiterDexIntegration {
  private connection: Connection;
  private initialized: boolean = false;
  private tokens: Record<string, JupiterToken> = {};
  
  /**
   * Constructor
   * @param rpcUrl Solana RPC URL
   */
  constructor(rpcUrl?: string) {
    // Use provided RPC URL or fallback to environment variable
    const url = rpcUrl || process.env.SOLANA_RPC_URL || process.env.HELIUS_API_KEY 
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : 'https://api.mainnet-beta.solana.com';
    
    this.connection = new Connection(url, 'confirmed');
  }
  
  /**
   * Initialize the Jupiter DEX integration
   */
  public async initialize(): Promise<boolean> {
    try {
      logger.info('Initializing Jupiter DEX integration');
      
      // Load tokens from Jupiter API
      await this.loadTokens();
      
      this.initialized = true;
      logger.info('Jupiter DEX integration initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Jupiter DEX integration:', error);
      return false;
    }
  }
  
  /**
   * Check if the integration is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Load tokens from Jupiter API
   */
  private async loadTokens(): Promise<void> {
    try {
      logger.info('Loading tokens from Jupiter API');
      
      const response = await axios.get(JUPITER_TOKENS_API);
      const tokenList: JupiterToken[] = response.data.tokens;
      
      // Store tokens by address for quick lookup
      for (const token of tokenList) {
        this.tokens[token.address] = token;
      }
      
      logger.info(`Loaded ${tokenList.length} tokens from Jupiter API`);
    } catch (error) {
      logger.error('Failed to load tokens from Jupiter API:', error);
      throw error;
    }
  }
  
  /**
   * Find token by symbol or address
   */
  public findToken(symbolOrAddress: string): JupiterToken | undefined {
    // Check if it's a direct address match
    if (this.tokens[symbolOrAddress]) {
      return this.tokens[symbolOrAddress];
    }
    
    // Search by symbol (case-insensitive)
    const upperSymbol = symbolOrAddress.toUpperCase();
    return Object.values(this.tokens).find(token => 
      token.symbol.toUpperCase() === upperSymbol
    );
  }
  
  /**
   * Get token price in USD
   */
  public async getTokenPrice(tokenMint: string): Promise<number> {
    try {
      // Ensure the token mint address is valid
      try {
        new PublicKey(tokenMint);
      } catch (error) {
        // If tokenMint is a symbol, try to find the actual address
        const token = this.findToken(tokenMint);
        if (!token) {
          throw new Error(`Token ${tokenMint} not found`);
        }
        tokenMint = token.address;
      }
      
      const url = `${JUPITER_PRICE_API}?ids=${tokenMint}`;
      const response = await axios.get(url);
      
      if (response.data.data && response.data.data[tokenMint]) {
        return response.data.data[tokenMint].price;
      }
      
      throw new Error(`Price for token ${tokenMint} not found`);
    } catch (error) {
      logger.error(`Failed to get price for token ${tokenMint}:`, error);
      return 0;
    }
  }
  
  /**
   * Get swap quote from Jupiter
   */
  public async getSwapQuote(
    inputToken: string,
    outputToken: string,
    amount: number,
    slippageBps: number = 50, // 0.5% default slippage
    isExactIn: boolean = true
  ): Promise<JupiterQuoteResponse> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Ensure token addresses are valid
      let inputMint = inputToken;
      let outputMint = outputToken;
      
      // Convert symbol to address if needed
      const inputTokenInfo = this.findToken(inputToken);
      if (inputTokenInfo) {
        inputMint = inputTokenInfo.address;
      }
      
      const outputTokenInfo = this.findToken(outputToken);
      if (outputTokenInfo) {
        outputMint = outputTokenInfo.address;
      }
      
      // Create quote request
      const quoteRequest: JupiterQuote = {
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps,
        swapMode: isExactIn ? 'ExactIn' : 'ExactOut',
        onlyDirectRoutes: false
      };
      
      // Get quote from Jupiter API
      const response = await axios.get(JUPITER_QUOTE_API, { params: quoteRequest });
      return response.data;
    } catch (error) {
      logger.error('Failed to get swap quote from Jupiter:', error);
      throw error;
    }
  }
  
  /**
   * Generate swap instructions for a transaction
   */
  public async generateSwapInstructions(
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string
  ): Promise<string> {
    try {
      // Create swap transaction request
      const swapRequest: JupiterSwapRequest = {
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        prioritizationFeeLamports: 1000000 // 0.001 SOL priority fee
      };
      
      // Get swap transaction from Jupiter API
      const response = await axios.post(JUPITER_SWAP_API, swapRequest);
      const swapResponse: JupiterSwapResponse = response.data;
      
      return swapResponse.swapTransaction;
    } catch (error) {
      logger.error('Failed to generate swap instructions from Jupiter:', error);
      throw error;
    }
  }
  
  /**
   * Decode a swap transaction
   */
  public decodeSwapTransaction(encodedTransaction: string): Transaction | VersionedTransaction {
    try {
      // First try to decode as a legacy transaction
      try {
        const buffer = Buffer.from(encodedTransaction, 'base64');
        return Transaction.from(buffer);
      } catch (error) {
        // If legacy transaction fails, try as a versioned transaction
        const buffer = Buffer.from(encodedTransaction, 'base64');
        return VersionedTransaction.deserialize(buffer);
      }
    } catch (error) {
      logger.error('Failed to decode swap transaction:', error);
      throw error;
    }
  }
  
  /**
   * Get real-time token swap instructions
   */
  public async getRealTokenSwapInstructions(
    walletPublicKey: string,
    fromToken: string,
    toToken: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<any> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      logger.info(`Getting real token swap instructions from ${fromToken} to ${toToken} for ${amount} with ${slippageBps} bps slippage`);
      
      // Get swap quote
      const quoteResponse = await this.getSwapQuote(fromToken, toToken, amount, slippageBps);
      
      logger.info(`Swap quote received: Input ${quoteResponse.inAmount} ${fromToken}, Output ${quoteResponse.outAmount} ${toToken}, Impact ${quoteResponse.priceImpactPct}%`);
      
      // Generate swap instructions
      const swapInstructions = await this.generateSwapInstructions(quoteResponse, walletPublicKey);
      
      // Return transaction information
      return {
        swapInstructions,
        inAmount: quoteResponse.inAmount,
        outAmount: quoteResponse.outAmount,
        priceImpact: quoteResponse.priceImpactPct,
        routes: quoteResponse.routePlan
      };
    } catch (error) {
      logger.error('Failed to get real token swap instructions:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const jupiterDexIntegration = new JupiterDexIntegration();