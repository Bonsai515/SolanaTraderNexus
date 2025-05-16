/**
 * Trade Tracker
 * 
 * This module tracks executed trades on the blockchain and calculates profits
 * when converted to SOL or USDC.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { priceFeedCache } from '../lib/priceFeedCache';

interface TradeTransaction {
  signature: string;
  slot: number;
  blockTime: number;
  source: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  priceIn: number;
  priceOut: number;
  profitUSD: number;
  profitSOL: number;
  feesSOL: number;
  status: 'confirmed' | 'pending' | 'failed';
  executionTimeMs: number;
  route: string[];
  strategy: string;
  timestamp: string;
}

interface ProfitSummary {
  totalProfitUSD: number;
  totalProfitSOL: number;
  totalFeesSOL: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  profitByStrategy: Record<string, number>;
  profitByToken: Record<string, number>;
  profitByTimeframe: {
    last24h: number;
    last7d: number;
    last30d: number;
    allTime: number;
  };
  lastUpdated: string;
}

class TradeTracker extends EventEmitter {
  private static instance: TradeTracker;

  private dataDir: string = path.join('./data', 'trade-tracking');
  private tradesFilePath: string = path.join(this.dataDir, 'executed-trades.json');
  private profitSummaryFilePath: string = path.join(this.dataDir, 'profit-summary.json');

  private executedTrades: TradeTransaction[] = [];
  private profitSummary: ProfitSummary = {
    totalProfitUSD: 0,
    totalProfitSOL: 0,
    totalFeesSOL: 0,
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    profitByStrategy: {},
    profitByToken: {},
    profitByTimeframe: {
      last24h: 0,
      last7d: 0,
      last30d: 0,
      allTime: 0
    },
    lastUpdated: new Date().toISOString()
  };

  private tradingWallets: string[] = [
    'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb' // Main trading wallet
  ];
  private profitWallet: string = "31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e"; // Prophet wallet

  private connection: Connection | null = null;

  private updateInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  private constructor() {
    super();
    this.initialize();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TradeTracker {
    if (!TradeTracker.instance) {
      TradeTracker.instance = new TradeTracker();
    }
    return TradeTracker.instance;
  }

  /**
   * Initialize the trade tracker
   */
  private async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // Initialize Solana connection
      this.initializeConnection();
      
      // Load trades data from disk
      this.loadTradesData();
      
      // Start tracking interval
      this.startTrackingInterval();
      
      this.isInitialized = true;
      
      // Emit initialization event
      this.emit('initialized');
      
      console.log('Trade Tracker initialized successfully');
    } catch (error) {
      console.error('Error initializing trade tracker:', error);
    }
  }

  /**
   * Initialize Solana connection
   */
  private initializeConnection(): void {
    try {
      // Initialize Solana connection (use Helius or other high-performance RPC)
      const rpcUrl = process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      this.connection = new Connection(rpcUrl, 'confirmed');
      console.log('Solana connection initialized for Trade Tracker');
    } catch (error) {
      console.error('Error initializing Solana connection:', error);
    }
  }

  /**
   * Start tracking interval
   */
  private startTrackingInterval(): void {
    // Clear any existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Check for new transactions every 5 minutes
    this.updateInterval = setInterval(() => {
      this.trackWalletTransactions().catch(error => {
        console.error('Error tracking wallet transactions:', error);
      });
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Load trades data from disk
   */
  private loadTradesData(): void {
    try {
      // Load executed trades
      if (fs.existsSync(this.tradesFilePath)) {
        const tradesData = fs.readFileSync(this.tradesFilePath, 'utf8');
        this.executedTrades = JSON.parse(tradesData);
        console.log(`Loaded ${this.executedTrades.length} executed trades from disk`);
      }
      
      // Load profit summary
      if (fs.existsSync(this.profitSummaryFilePath)) {
        const summaryData = fs.readFileSync(this.profitSummaryFilePath, 'utf8');
        this.profitSummary = JSON.parse(summaryData);
        console.log('Loaded profit summary from disk');
      }
    } catch (error) {
      console.error('Error loading trades data:', error);
    }
  }

  /**
   * Save trades data to disk
   */
  private saveTradesData(): void {
    try {
      // Save executed trades
      fs.writeFileSync(this.tradesFilePath, JSON.stringify(this.executedTrades, null, 2), 'utf8');
      
      // Save profit summary
      fs.writeFileSync(this.profitSummaryFilePath, JSON.stringify(this.profitSummary, null, 2), 'utf8');
      
      console.log('Saved trades data to disk');
    } catch (error) {
      console.error('Error saving trades data:', error);
    }
  }

  /**
   * Track wallet transactions
   */
  private async trackWalletTransactions(): Promise<void> {
    if (!this.connection) {
      console.error('Cannot track transactions: Solana connection not initialized');
      return;
    }

    try {
      // Track transactions for each wallet
      for (const walletAddress of this.tradingWallets) {
        console.log(`Checking transactions for wallet: ${walletAddress}`);
        
        // Get recent transactions (last 20)
        const signatures = await this.connection.getSignaturesForAddress(new PublicKey(walletAddress), {
          limit: 20
        });
        
        // Process each transaction
        for (const sigInfo of signatures) {
          const signature = sigInfo.signature;
          
          // Skip already processed transactions
          if (this.executedTrades.some(tx => tx.signature === signature)) {
            continue;
          }
          
          await this.processTransaction(signature, walletAddress);
        }
      }
      
      // Update profit summary
      this.updateProfitSummary();
      
      // Save data
      this.saveTradesData();
    } catch (error) {
      console.error('Error tracking wallet transactions:', error);
    }
  }

  /**
   * Process a transaction and extract trade data
   */
  private async processTransaction(signature: string, walletAddress: string): Promise<void> {
    if (!this.connection) return;

    try {
      console.log(`Processing transaction: ${signature}`);
      
      // Get transaction details
      const tx = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0
      });
      
      if (!tx) {
        console.log(`Transaction not found: ${signature}`);
        return;
      }
      
      // Skip non-trade transactions
      if (!tx.meta || tx.meta.err) {
        console.log(`Transaction failed or has no metadata: ${signature}`);
        return;
      }
      
      // Parse the transaction to extract trade information
      const tradeInfo = await this.parseTradeTransaction(tx, walletAddress);
      
      if (!tradeInfo) {
        console.log(`Not a trade transaction: ${signature}`);
        return;
      }
      
      // Calculate profit
      const profitInfo = await this.calculateProfit(tradeInfo);
      
      // Create a trade transaction record
      const tradeTx: TradeTransaction = {
        signature,
        slot: tx.slot,
        blockTime: tx.blockTime || Math.floor(Date.now() / 1000),
        source: tradeInfo.source || 'unknown',
        tokenIn: tradeInfo.tokenIn,
        tokenOut: tradeInfo.tokenOut,
        amountIn: tradeInfo.amountIn,
        amountOut: tradeInfo.amountOut,
        priceIn: profitInfo.priceIn,
        priceOut: profitInfo.priceOut,
        profitUSD: profitInfo.profitUSD,
        profitSOL: profitInfo.profitSOL,
        feesSOL: tx.meta.fee / 1e9, // Convert lamports to SOL
        status: 'confirmed',
        executionTimeMs: tradeInfo.executionTimeMs || 0,
        route: tradeInfo.route || [],
        strategy: tradeInfo.strategy || 'unknown',
        timestamp: new Date(tx.blockTime ? tx.blockTime * 1000 : Date.now()).toISOString()
      };
      
      // Add to executed trades
      this.executedTrades.push(tradeTx);
      
      // Sort trades by blockTime (descending)
      this.executedTrades.sort((a, b) => b.blockTime - a.blockTime);
      
      console.log(`Added trade transaction: ${tradeTx.tokenIn} → ${tradeTx.tokenOut}, profit: $${tradeTx.profitUSD.toFixed(2)}`);
      
      // Emit event
      this.emit('trade', tradeTx);
    } catch (error) {
      console.error(`Error processing transaction ${signature}:`, error);
    }
  }

  /**
   * Parse a transaction to extract trade information
   */
  private async parseTradeTransaction(transaction: any, walletAddress: string): Promise<any | null> {
    // This is a simplified implementation
    // In a real system, this would parse the transaction logs and instructions
    // to accurately identify the tokens and amounts involved in the trade
    
    try {
      // Extract pre and post token balances
      const preBalances = transaction.meta.preTokenBalances || [];
      const postBalances = transaction.meta.postTokenBalances || [];
      
      // Filter to only include the trading wallet's token accounts
      const walletPreBalances = preBalances.filter(
        b => b.owner === walletAddress
      );
      const walletPostBalances = postBalances.filter(
        b => b.owner === walletAddress
      );
      
      // If no token balances changed, not a trade
      if (walletPreBalances.length === 0 || walletPostBalances.length === 0) {
        return null;
      }
      
      // Extract input and output tokens
      // This is a very simplified detection - in reality would need more sophisticated parsing
      let tokenIn = '';
      let tokenOut = '';
      let amountIn = 0;
      let amountOut = 0;
      
      // Find tokens that decreased (input tokens)
      for (const pre of walletPreBalances) {
        const post = walletPostBalances.find(
          p => p.mint === pre.mint
        );
        
        if (post) {
          const preAmount = Number(pre.uiTokenAmount.amount) || 0;
          const postAmount = Number(post.uiTokenAmount.amount) || 0;
          
          if (preAmount > postAmount) {
            // Token balance decreased - this is an input token
            tokenIn = pre.mint;
            amountIn = preAmount - postAmount;
          } else if (postAmount > preAmount) {
            // Token balance increased - this is an output token
            tokenOut = pre.mint;
            amountOut = postAmount - preAmount;
          }
        }
      }
      
      // For tokens that only appear in post balances (new acquisitions)
      for (const post of walletPostBalances) {
        if (!walletPreBalances.some(p => p.mint === post.mint)) {
          tokenOut = post.mint;
          amountOut = Number(post.uiTokenAmount.amount) || 0;
        }
      }
      
      // If we couldn't identify clear input/output, not a trade
      if (!tokenIn || !tokenOut) {
        return null;
      }
      
      // Try to extract strategy and source from transaction logs
      // This is simplified - would need more sophisticated parsing in reality
      let source = 'unknown';
      let strategy = 'unknown';
      let route: string[] = [];
      let executionTimeMs = 0;
      
      if (transaction.meta.logMessages) {
        const logs = transaction.meta.logMessages;
        
        // Look for specific patterns in logs to identify source
        if (logs.some(log => log.includes('Jupiter'))) {
          source = 'jupiter';
        } else if (logs.some(log => log.includes('Raydium'))) {
          source = 'raydium';
        } else if (logs.some(log => log.includes('Orca'))) {
          source = 'orca';
        } else if (logs.some(log => log.includes('Meteora'))) {
          source = 'meteora';
        }
        
        // Look for strategy patterns
        if (logs.some(log => log.includes('Flash Loan'))) {
          strategy = 'flash_arbitrage';
        } else if (logs.some(log => log.includes('Cross-chain'))) {
          strategy = 'cross_chain';
        } else if (logs.some(log => log.includes('MemeCortex'))) {
          strategy = 'meme_sniper';
        }
        
        // Extract route if available
        const routeLog = logs.find(log => log.includes('Route:'));
        if (routeLog) {
          const routeMatch = routeLog.match(/Route: (.*)/);
          if (routeMatch && routeMatch[1]) {
            route = routeMatch[1].split('->').map(t => t.trim());
          }
        }
        
        // Extract execution time if available
        const timeLog = logs.find(log => log.includes('Execution time:'));
        if (timeLog) {
          const timeMatch = timeLog.match(/Execution time: (\d+)ms/);
          if (timeMatch && timeMatch[1]) {
            executionTimeMs = parseInt(timeMatch[1]);
          }
        }
      }
      
      // Return extracted trade information
      return {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        source,
        strategy,
        route,
        executionTimeMs
      };
    } catch (error) {
      console.error('Error parsing trade transaction:', error);
      return null;
    }
  }

  /**
   * Calculate profit from a trade
   */
  private async calculateProfit(tradeInfo: any): Promise<any> {
    try {
      // Get token prices
      const priceIn = await this.getTokenPrice(tradeInfo.tokenIn);
      const priceOut = await this.getTokenPrice(tradeInfo.tokenOut);
      
      if (!priceIn || !priceOut) {
        console.warn(`Could not get prices for ${tradeInfo.tokenIn} or ${tradeInfo.tokenOut}`);
        return {
          priceIn: priceIn || 0,
          priceOut: priceOut || 0,
          profitUSD: 0,
          profitSOL: 0
        };
      }
      
      // Calculate USD values
      const valueIn = tradeInfo.amountIn * priceIn;
      const valueOut = tradeInfo.amountOut * priceOut;
      
      // Calculate profit
      const profitUSD = valueOut - valueIn;
      
      // Get SOL price for conversion
      const solPrice = await this.getTokenPrice('SOL');
      const profitSOL = solPrice ? profitUSD / solPrice : 0;
      
      return {
        priceIn,
        priceOut,
        profitUSD,
        profitSOL
      };
    } catch (error) {
      console.error('Error calculating profit:', error);
      return {
        priceIn: 0,
        priceOut: 0,
        profitUSD: 0,
        profitSOL: 0
      };
    }
  }

  /**
   * Update profit summary
   */
  private updateProfitSummary(): void {
    try {
      // Reset summary
      const summary: ProfitSummary = {
        totalProfitUSD: 0,
        totalProfitSOL: 0,
        totalFeesSOL: 0,
        totalTrades: this.executedTrades.length,
        successfulTrades: 0,
        failedTrades: 0,
        profitByStrategy: {},
        profitByToken: {},
        profitByTimeframe: {
          last24h: 0,
          last7d: 0,
          last30d: 0,
          allTime: 0
        },
        lastUpdated: new Date().toISOString()
      };
      
      // Current time
      const now = Date.now();
      
      // Process all trades
      for (const trade of this.executedTrades) {
        // Count successful/failed trades
        if (trade.status === 'confirmed') {
          summary.successfulTrades++;
        } else if (trade.status === 'failed') {
          summary.failedTrades++;
        }
        
        // Add profits
        summary.totalProfitUSD += trade.profitUSD;
        summary.totalProfitSOL += trade.profitSOL;
        summary.totalFeesSOL += trade.feesSOL;
        
        // Track profit by strategy
        if (!summary.profitByStrategy[trade.strategy]) {
          summary.profitByStrategy[trade.strategy] = 0;
        }
        summary.profitByStrategy[trade.strategy] += trade.profitUSD;
        
        // Track profit by token
        if (!summary.profitByToken[trade.tokenOut]) {
          summary.profitByToken[trade.tokenOut] = 0;
        }
        summary.profitByToken[trade.tokenOut] += trade.profitUSD;
        
        // Track profit by timeframe
        const tradeTime = new Date(trade.timestamp).getTime();
        
        // Last 24 hours
        if (now - tradeTime <= 24 * 60 * 60 * 1000) {
          summary.profitByTimeframe.last24h += trade.profitUSD;
        }
        
        // Last 7 days
        if (now - tradeTime <= 7 * 24 * 60 * 60 * 1000) {
          summary.profitByTimeframe.last7d += trade.profitUSD;
        }
        
        // Last 30 days
        if (now - tradeTime <= 30 * 24 * 60 * 60 * 1000) {
          summary.profitByTimeframe.last30d += trade.profitUSD;
        }
        
        // All time
        summary.profitByTimeframe.allTime += trade.profitUSD;
      }
      
      // Update summary
      this.profitSummary = summary;
    } catch (error) {
      console.error('Error updating profit summary:', error);
    }
  }

  /**
   * Register a new executed trade (for manual tracking)
   */
  public registerExecutedTrade(tradeInfo: any): void {
    try {
      if (!tradeInfo.tokenIn || !tradeInfo.tokenOut) {
        console.error('Invalid trade info, missing required fields');
        return;
      }
      
      // Calculate profit
      this.calculateProfit(tradeInfo).then(profitInfo => {
        // Create a trade transaction record
        const tradeTx: TradeTransaction = {
          signature: tradeInfo.signature || `manual-${Date.now()}`,
          slot: tradeInfo.slot || 0,
          blockTime: tradeInfo.blockTime || Math.floor(Date.now() / 1000),
          source: tradeInfo.source || 'manual',
          tokenIn: tradeInfo.tokenIn,
          tokenOut: tradeInfo.tokenOut,
          amountIn: tradeInfo.amountIn || 0,
          amountOut: tradeInfo.amountOut || 0,
          priceIn: profitInfo.priceIn,
          priceOut: profitInfo.priceOut,
          profitUSD: profitInfo.profitUSD,
          profitSOL: profitInfo.profitSOL,
          feesSOL: tradeInfo.feesSOL || 0,
          status: tradeInfo.status || 'confirmed',
          executionTimeMs: tradeInfo.executionTimeMs || 0,
          route: tradeInfo.route || [],
          strategy: tradeInfo.strategy || 'manual',
          timestamp: tradeInfo.timestamp || new Date().toISOString()
        };
        
        // Add to executed trades
        this.executedTrades.push(tradeTx);
        
        // Sort trades by blockTime (descending)
        this.executedTrades.sort((a, b) => b.blockTime - a.blockTime);
        
        // Update profit summary
        this.updateProfitSummary();
        
        // Save data
        this.saveTradesData();
        
        console.log(`Manually registered trade: ${tradeTx.tokenIn} → ${tradeTx.tokenOut}, profit: $${tradeTx.profitUSD.toFixed(2)}`);
        
        // Emit event
        this.emit('trade', tradeTx);
      });
    } catch (error) {
      console.error('Error registering executed trade:', error);
    }
  }

  /**
   * Get token price
   */
  private async getTokenPrice(token: string): Promise<number> {
    try {
      // First try to get price from price feed cache
      const price = priceFeedCache.getPrice(token);
      if (price) {
        return price;
      }
      
      // If not found and it's a memecoin, try to get estimated price
      if (this.isMemecoin(token)) {
        // This would integrate with advanced price discovery mechanisms
        // For simplicity, we'll return a placeholder
        return 0.00001;
      }
      
      // If it's a DEX token, try to get price from specific sources
      if (this.isDexToken(token)) {
        // This would integrate with DEX-specific price APIs
        // For simplicity, we'll return a placeholder
        return 1.0;
      }
      
      // Default fallback
      return 0;
    } catch (error) {
      console.error(`Error getting price for ${token}:`, error);
      return 0;
    }
  }

  /**
   * Get token symbol from mint address (simplified)
   */
  private getTokenSymbolFromMint(mint: string): string {
    const tokenMap: Record<string, string> = {
      'So11111111111111111111111111111111111111112': 'SOL',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
      '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU': 'RAY',
      'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': 'ORCA',
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP'
    };
    
    return tokenMap[mint] || mint.slice(0, 6);
  }

  /**
   * Check if a token is a memecoin (simplified)
   */
  private isMemecoin(token: string): boolean {
    const memecoins = [
      'BONK', 'WIF', 'MEME', 'BERN', 'TRUMP', 'DOG', 'CAT',
      // Add more memecoin identifiers
    ];
    
    return memecoins.includes(token);
  }

  /**
   * Check if a token is a DEX or governance token
   */
  private isDexToken(token: string): boolean {
    const dexTokens = [
      'RAY', 'ORCA', 'JUP', 'MEAN', 'MNGO', 'SRM', 'BON',
      // Add more DEX token identifiers
    ];
    
    return dexTokens.includes(token);
  }

  /**
   * Get all tracked trades
   */
  public getAllTrades(): TradeTransaction[] {
    return this.executedTrades;
  }

  /**
   * Get profit summary
   */
  public getProfitSummary(): ProfitSummary {
    return this.profitSummary;
  }

  /**
   * Get trades for a specific token
   */
  public getTradesByToken(token: string): TradeTransaction[] {
    return this.executedTrades.filter(
      trade => trade.tokenIn === token || trade.tokenOut === token
    );
  }

  /**
   * Get trades by strategy
   */
  public getTradesByStrategy(strategy: string): TradeTransaction[] {
    return this.executedTrades.filter(
      trade => trade.strategy === strategy
    );
  }

  /**
   * Get trades in a specific time range
   */
  public getTradesByTimeRange(startTime: string, endTime: string): TradeTransaction[] {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    
    return this.executedTrades.filter(trade => {
      const tradeTime = new Date(trade.timestamp).getTime();
      return tradeTime >= start && tradeTime <= end;
    });
  }

  /**
   * Check if the tracker is initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Force update trades
   */
  public async forceUpdate(): Promise<void> {
    return this.trackWalletTransactions();
  }

  /**
   * Stop tracking
   */
  public stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

// Export singleton instance
export const tradeTracker = TradeTracker.getInstance();

/**
 * Initialize the trade tracker
 */
export async function initTradeTracker(): Promise<boolean> {
  try {
    if (!tradeTracker.isReady()) {
      // Wait for initialization
      await new Promise<void>((resolve) => {
        tradeTracker.once('initialized', () => {
          resolve();
        });
        
        // Force refresh after initialization
        setTimeout(() => {
          tradeTracker.forceUpdate().catch(console.error);
        }, 1000);
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing trade tracker:', error);
    return false;
  }
}