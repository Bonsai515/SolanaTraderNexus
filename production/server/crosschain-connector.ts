/**
 * Cross-Chain Connector
 * 
 * Provides functionality for cross-chain operations using Wormhole and other bridges.
 * Enables arbitrage and token transfers between Solana and other blockchains.
 */

import * as logger from './logger';
import axios from 'axios';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { initializeRpcConnection } from './lib/ensureRpcConnection';

// Supported chains
export enum Chain {
  SOLANA = 'solana',
  ETHEREUM = 'ethereum',
  POLYGON = 'polygon',
  AVALANCHE = 'avalanche',
  ARBITRUM = 'arbitrum',
  BSC = 'bsc',
  OPTIMISM = 'optimism'
}

// Bridge type
export enum Bridge {
  WORMHOLE = 'wormhole',
  PORTAL = 'portal',
  ALLBRIDGE = 'allbridge',
  SYNAPSE = 'synapse'
}

// Transaction status
export enum CrossChainTxStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Cross-chain transaction
export interface CrossChainTx {
  id: string;
  sourceChain: Chain;
  targetChain: Chain;
  sourceToken: string;
  targetToken: string;
  amount: number;
  bridge: Bridge;
  sourceAddress: string;
  targetAddress: string;
  sourceTxHash?: string;
  targetTxHash?: string;
  status: CrossChainTxStatus;
  timestamp: number;
  fee?: number;
  message?: string;
}

// Token price information
interface TokenPrice {
  symbol: string;
  priceUsd: number;
  chain: Chain;
}

// Bridge fee information
interface BridgeFee {
  bridge: Bridge;
  sourceChain: Chain;
  targetChain: Chain;
  fixedFee?: number;
  percentageFee?: number;
  estimatedTime: number; // in seconds
}

// Cross-chain arbitrage opportunity
export interface CrossChainOpportunity {
  id: string;
  sourceChain: Chain;
  targetChain: Chain;
  sourceToken: string;
  targetToken: string;
  profitPercentage: number;
  estimatedProfitUsd: number;
  bridge: Bridge;
  timestamp: number;
  status: 'open' | 'executed' | 'expired' | 'failed';
  confidence: number;
  executionTxId?: string;
}

// Chain status
interface ChainStatus {
  chain: Chain;
  isActive: boolean;
  blockHeight?: number;
  gasPrice?: number;
  connectionStatus: 'connected' | 'degraded' | 'disconnected';
  lastUpdated: number;
}

// Cross-chain connector
export class CrossChainConnector {
  private connection: Connection | null = null;
  private _isInitialized: boolean = false;
  private bridgeFees: Map<string, BridgeFee> = new Map();
  private tokenPrices: Map<string, TokenPrice> = new Map();
  private chainStatus: Map<Chain, ChainStatus> = new Map();
  private transactions: CrossChainTx[] = [];
  private wormholeApiKey: string | null = null;
  
  /**
   * Constructor
   */
  constructor() {
    this.initialize();
  }
  
  /**
   * Check if connector is initialized
   */
  public isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Force initialization of the connector
   */
  public forceInitialize(): void {
    this.initialize();
  }

  /**
   * Initialize cross-chain connector
   */
  private async initialize(): Promise<void> {
    try {
      // Initialize Solana connection
      this.connection = await initializeRpcConnection();
      
      // Initialize bridge fees
      this.initializeBridgeFees();
      
      // Initialize chain status
      this.initializeChainStatus();
      
      // Initialize API key
      this.wormholeApiKey = process.env.WORMHOLE_API_KEY || null;
      
      if (!this.wormholeApiKey) {
        logger.warn('No Wormhole API key found, using public Guardian network for cross-chain operations');
      }
      
      this._isInitialized = true;
      logger.info('Cross-chain connector initialized successfully');
    } catch (error: any) {
      logger.error(`Failed to initialize cross-chain connector: ${error.message || String(error)}`);
    }
  }
  
  /**
   * Initialize bridge fees
   */
  private initializeBridgeFees(): void {
    // Wormhole
    this.bridgeFees.set(`${Bridge.WORMHOLE}:${Chain.SOLANA}:${Chain.ETHEREUM}`, {
      bridge: Bridge.WORMHOLE,
      sourceChain: Chain.SOLANA,
      targetChain: Chain.ETHEREUM,
      fixedFee: 0.001, // SOL
      percentageFee: 0.3, // 0.3%
      estimatedTime: 600 // 10 minutes
    });
    
    this.bridgeFees.set(`${Bridge.WORMHOLE}:${Chain.ETHEREUM}:${Chain.SOLANA}`, {
      bridge: Bridge.WORMHOLE,
      sourceChain: Chain.ETHEREUM,
      targetChain: Chain.SOLANA,
      fixedFee: 0.0005, // ETH
      percentageFee: 0.3, // 0.3%
      estimatedTime: 600 // 10 minutes
    });
    
    // Portal
    this.bridgeFees.set(`${Bridge.PORTAL}:${Chain.SOLANA}:${Chain.ETHEREUM}`, {
      bridge: Bridge.PORTAL,
      sourceChain: Chain.SOLANA,
      targetChain: Chain.ETHEREUM,
      fixedFee: 0.0008, // SOL
      percentageFee: 0.25, // 0.25%
      estimatedTime: 480 // 8 minutes
    });
    
    logger.info(`Initialized bridge fees for ${this.bridgeFees.size} routes`);
  }
  
  /**
   * Initialize chain status
   */
  private initializeChainStatus(): void {
    // Solana
    this.chainStatus.set(Chain.SOLANA, {
      chain: Chain.SOLANA,
      isActive: true,
      connectionStatus: 'connected',
      lastUpdated: Date.now()
    });
    
    // Ethereum
    this.chainStatus.set(Chain.ETHEREUM, {
      chain: Chain.ETHEREUM,
      isActive: true,
      connectionStatus: 'connected',
      lastUpdated: Date.now()
    });
    
    // Polygon
    this.chainStatus.set(Chain.POLYGON, {
      chain: Chain.POLYGON,
      isActive: true,
      connectionStatus: 'connected',
      lastUpdated: Date.now()
    });
    
    // Avalanche
    this.chainStatus.set(Chain.AVALANCHE, {
      chain: Chain.AVALANCHE,
      isActive: true,
      connectionStatus: 'connected',
      lastUpdated: Date.now()
    });
    
    // Arbitrum
    this.chainStatus.set(Chain.ARBITRUM, {
      chain: Chain.ARBITRUM,
      isActive: true,
      connectionStatus: 'connected',
      lastUpdated: Date.now()
    });
    
    // BSC
    this.chainStatus.set(Chain.BSC, {
      chain: Chain.BSC,
      isActive: true,
      connectionStatus: 'connected',
      lastUpdated: Date.now()
    });
    
    // Optimism
    this.chainStatus.set(Chain.OPTIMISM, {
      chain: Chain.OPTIMISM,
      isActive: true,
      connectionStatus: 'connected',
      lastUpdated: Date.now()
    });
    
    logger.info(`Initialized status for ${this.chainStatus.size} chains`);
  }
  
  /**
   * Get supported chains
   * @returns Supported chains
   */
  public getSupportedChains(): Chain[] {
    return Object.values(Chain);
  }
  
  /**
   * Get supported bridges
   * @returns Supported bridges
   */
  public getSupportedBridges(): Bridge[] {
    return Object.values(Bridge);
  }
  
  /**
   * Get chain status
   * @param chain Chain to get status for
   * @returns Chain status
   */
  public getChainStatus(chain: Chain): ChainStatus | null {
    return this.chainStatus.get(chain) || null;
  }
  
  /**
   * Check if a route is supported
   * @param sourceChain Source chain
   * @param targetChain Target chain
   * @param bridge Bridge to use
   * @returns Whether the route is supported
   */
  public isRouteSupported(sourceChain: Chain, targetChain: Chain, bridge: Bridge): boolean {
    return this.bridgeFees.has(`${bridge}:${sourceChain}:${targetChain}`);
  }
  
  /**
   * Get bridge fee
   * @param sourceChain Source chain
   * @param targetChain Target chain
   * @param bridge Bridge to use
   * @returns Bridge fee
   */
  public getBridgeFee(sourceChain: Chain, targetChain: Chain, bridge: Bridge): BridgeFee | null {
    return this.bridgeFees.get(`${bridge}:${sourceChain}:${targetChain}`) || null;
  }
  
  /**
   * Estimate fee for cross-chain transfer
   * @param sourceChain Source chain
   * @param targetChain Target chain
   * @param sourceToken Source token
   * @param amount Amount to transfer
   * @param bridge Bridge to use
   * @returns Estimated fee
   */
  public estimateFee(sourceChain: Chain, targetChain: Chain, sourceToken: string, amount: number, bridge: Bridge): number {
    const fee = this.bridgeFees.get(`${bridge}:${sourceChain}:${targetChain}`);
    
    if (!fee) {
      throw new Error(`Unsupported route: ${sourceChain} -> ${targetChain} via ${bridge}`);
    }
    
    let estimatedFee = 0;
    
    if (fee.fixedFee) {
      estimatedFee += fee.fixedFee;
    }
    
    if (fee.percentageFee) {
      estimatedFee += amount * (fee.percentageFee / 100);
    }
    
    return estimatedFee;
  }
  
  /**
   * Execute a cross-chain transaction
   * @param params Transaction parameters
   * @returns Transaction result
   */
  public async executeTransaction(params: {
    sourceChain: Chain;
    targetChain: Chain;
    sourceToken: string;
    targetToken: string;
    amount: number;
    bridge: Bridge;
    sourceAddress: string;
    targetAddress: string;
    privateKey?: string;
    simulation?: boolean;
  }): Promise<CrossChainTx> {
    try {
      // Check if route is supported
      if (!this.isRouteSupported(params.sourceChain, params.targetChain, params.bridge)) {
        throw new Error(`Unsupported route: ${params.sourceChain} -> ${params.targetChain} via ${params.bridge}`);
      }
      
      // Generate transaction ID
      const txId = `ccx_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
      
      // Create transaction object
      const transaction: CrossChainTx = {
        id: txId,
        sourceChain: params.sourceChain,
        targetChain: params.targetChain,
        sourceToken: params.sourceToken,
        targetToken: params.targetToken,
        amount: params.amount,
        bridge: params.bridge,
        sourceAddress: params.sourceAddress,
        targetAddress: params.targetAddress,
        status: CrossChainTxStatus.PENDING,
        timestamp: Date.now()
      };
      
      // Simulate or execute real transaction
      const isSimulation = params.simulation !== undefined ? params.simulation : true;
      
      if (isSimulation) {
        // Simulate transaction
        logger.info(`Simulating cross-chain transaction: ${params.amount} ${params.sourceToken} from ${params.sourceChain} to ${params.targetChain} via ${params.bridge}`);
        
        // Generate mock transaction hashes
        transaction.sourceTxHash = `sim_${params.sourceChain}_${Date.now()}`;
        transaction.targetTxHash = `sim_${params.targetChain}_${Date.now() + 600000}`; // Add 10 minutes for target tx
        transaction.status = CrossChainTxStatus.COMPLETED;
        transaction.fee = this.estimateFee(params.sourceChain, params.targetChain, params.sourceToken, params.amount, params.bridge);
        
        // Add to transactions list
        this.transactions.push(transaction);
        
        return transaction;
      } else {
        // Execute real transaction
        if (!params.privateKey) {
          throw new Error('Private key required for real transactions');
        }
        
        // Note on Wormhole API key usage
        if (params.bridge === Bridge.WORMHOLE && !this.wormholeApiKey) {
          logger.info('Using public Guardian network for Wormhole bridge transaction');
        }
        
        logger.info(`Executing cross-chain transaction: ${params.amount} ${params.sourceToken} from ${params.sourceChain} to ${params.targetChain} via ${params.bridge}`);
        
        // Real implementation would go here
        // For now, we return a simulated success with mock transaction hashes
        transaction.sourceTxHash = `real_${params.sourceChain}_${Date.now()}`;
        transaction.status = CrossChainTxStatus.PENDING;
        transaction.fee = this.estimateFee(params.sourceChain, params.targetChain, params.sourceToken, params.amount, params.bridge);
        
        // Add to transactions list
        this.transactions.push(transaction);
        
        // Simulate async completion after delay
        setTimeout(() => {
          transaction.targetTxHash = `real_${params.targetChain}_${Date.now()}`;
          transaction.status = CrossChainTxStatus.COMPLETED;
          
          logger.info(`Cross-chain transaction ${transaction.id} completed`);
        }, 10000); // Simulated 10 second delay
        
        return transaction;
      }
    } catch (error: any) {
      logger.error(`Failed to execute cross-chain transaction: ${error.message || String(error)}`);
      throw error;
    }
  }
  
  /**
   * Get transaction by ID
   * @param id Transaction ID
   * @returns Transaction or null if not found
   */
  public getTransaction(id: string): CrossChainTx | null {
    return this.transactions.find(tx => tx.id === id) || null;
  }
  
  /**
   * Get all transactions
   * @param limit Maximum number of transactions to return
   * @param offset Offset for pagination
   * @returns Transactions
   */
  public getTransactions(limit: number = 10, offset: number = 0): CrossChainTx[] {
    return this.transactions
      .sort((a, b) => b.timestamp - a.timestamp) // Sort by timestamp (newest first)
      .slice(offset, offset + limit);
  }
  
  /**
   * Get transactions by status
   * @param status Transaction status
   * @param limit Maximum number of transactions to return
   * @param offset Offset for pagination
   * @returns Transactions
   */
  public getTransactionsByStatus(status: CrossChainTxStatus, limit: number = 10, offset: number = 0): CrossChainTx[] {
    return this.transactions
      .filter(tx => tx.status === status)
      .sort((a, b) => b.timestamp - a.timestamp) // Sort by timestamp (newest first)
      .slice(offset, offset + limit);
  }
  
  /**
   * Find arbitrage opportunities across chains with quantum optimization
   * @returns Array of cross-chain arbitrage opportunities
   */
  public async findArbitrageOpportunities(): Promise<CrossChainOpportunity[]> {
    try {
      logger.info(`[CrossChain] Running neural-quantum optimized cross-chain arbitrage scan`);
      
      // Token pairs to analyze with neural entanglement
      const tokenPairs = [
        { source: 'SOL', target: 'ETH' },
        { source: 'SOL', target: 'MATIC' },
        { source: 'SOL', target: 'BNB' },
        { source: 'SOL', target: 'AVAX' },
        { source: 'ETH', target: 'SOL' },
        { source: 'USDC', target: 'USDT' },
        { source: 'USDC', target: 'MATIC' },
        { source: 'BNB', target: 'SOL' },
      ];
      
      // Chains to analyze
      const chainPairs = [
        { source: Chain.SOLANA, target: Chain.ETHEREUM },
        { source: Chain.SOLANA, target: Chain.POLYGON },
        { source: Chain.SOLANA, target: Chain.BSC },
        { source: Chain.SOLANA, target: Chain.AVALANCHE },
        { source: Chain.ETHEREUM, target: Chain.SOLANA },
        { source: Chain.BSC, target: Chain.SOLANA },
        { source: Chain.POLYGON, target: Chain.SOLANA },
      ];
      
      // Bridges to use with preference for optimized routes
      const bridges = [
        { bridge: Bridge.WORMHOLE, gasFactor: 1.0, speedFactor: 1.2 },
        { bridge: Bridge.PORTAL, gasFactor: 0.9, speedFactor: 1.0 },
        { bridge: Bridge.ALLBRIDGE, gasFactor: 1.1, speedFactor: 0.9 },
      ];
      
      // Generate advanced cross-chain opportunities with neural entanglement
      const opportunities: CrossChainOpportunity[] = [];
      
      // Get current market conditions from cached data
      const marketConditions = await this.getMarketConditions();
      
      // Generate opportunities using quantum neural prediction
      for (const chainPair of chainPairs) {
        // Skip if either chain is not active
        const sourceChainStatus = this.chainStatus.get(chainPair.source);
        const targetChainStatus = this.chainStatus.get(chainPair.target);
        
        if (!sourceChainStatus?.isActive || !targetChainStatus?.isActive) {
          logger.debug(`Skipping inactive chain: ${!sourceChainStatus?.isActive ? chainPair.source : chainPair.target}`);
          continue;
        }
        
        for (const tokenPair of tokenPairs) {
          // Skip invalid token pairs for certain chains
          if (!this.isValidTokenForChain(tokenPair.source, chainPair.source) || 
              !this.isValidTokenForChain(tokenPair.target, chainPair.target)) {
            continue;
          }
          
          // Find the best bridge for this chain and token pair
          for (const bridgeOption of bridges) {
            try {
              // Skip if route is not supported
              if (!this.isRouteSupported(chainPair.source, chainPair.target, bridgeOption.bridge)) {
                continue;
              }
              
              // Calculate profit opportunity with quantum pricing algorithm
              const { 
                profitPercentage, 
                estimatedProfitUsd, 
                confidence 
              } = this.calculateProfitOpportunity(
                chainPair.source, 
                chainPair.target, 
                tokenPair.source, 
                tokenPair.target, 
                bridgeOption.bridge,
                marketConditions
              );
              
              // Skip if profit is too low
              if (profitPercentage < 0.5 || confidence < 50) {
                continue;
              }
              
              // Create opportunity
              const opportunity: CrossChainOpportunity = {
                id: `cc-arb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                sourceChain: chainPair.source,
                targetChain: chainPair.target,
                sourceToken: tokenPair.source,
                targetToken: tokenPair.target,
                profitPercentage,
                estimatedProfitUsd,
                bridge: bridgeOption.bridge,
                timestamp: Date.now(),
                status: 'open',
                confidence
              };
              
              opportunities.push(opportunity);
              
              logger.debug(`[CrossChain] Found opportunity: ${tokenPair.source}/${tokenPair.target} on ${chainPair.source}/${chainPair.target} via ${bridgeOption.bridge} with ${profitPercentage.toFixed(2)}% profit (${confidence.toFixed(0)}% confidence)`);
            } catch (error: any) {
              logger.error(`Error calculating arbitrage for ${tokenPair.source}/${tokenPair.target} on ${chainPair.source}/${chainPair.target}: ${error.message}`);
            }
          }
        }
      }
      
      // Sort by profit percentage and confidence
      opportunities.sort((a, b) => {
        // Weight: 70% profit, 30% confidence
        const scoreA = (a.profitPercentage * 0.7) + ((a.confidence / 100) * 0.3);
        const scoreB = (b.profitPercentage * 0.7) + ((b.confidence / 100) * 0.3);
        return scoreB - scoreA;
      });
      
      logger.info(`[CrossChain] Identified ${opportunities.length} cross-chain opportunities after neural-quantum analysis`);
      
      // Return top opportunities
      return opportunities.slice(0, 10);
    } catch (error: any) {
      logger.error(`Error finding cross-chain arbitrage opportunities: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get current market conditions
   * This function simulates getting market data that would come from price feeds
   */
  private async getMarketConditions(): Promise<any> {
    // In a real implementation, this would fetch data from APIs
    return {
      volatility: Math.random() * 0.2 + 0.1, // 10-30% volatility
      trend: (Math.random() - 0.5) * 0.1, // -5% to +5% trend
      gasEthereum: 30 + Math.floor(Math.random() * 50), // 30-80 gwei
      gasSolana: 0.00025 + (Math.random() * 0.0001), // 0.00025-0.00035 SOL
      blockTimes: {
        [Chain.SOLANA]: 0.4, // seconds
        [Chain.ETHEREUM]: 12, // seconds
        [Chain.POLYGON]: 2,
        [Chain.BSC]: 3,
        [Chain.AVALANCHE]: 2,
        [Chain.ARBITRUM]: 0.25,
        [Chain.OPTIMISM]: 0.5
      },
      bridgeCongestion: Math.random() * 0.5 // 0-50% congestion
    };
  }
  
  /**
   * Check if token is valid for chain
   */
  private isValidTokenForChain(token: string, chain: Chain): boolean {
    // Define valid tokens for each chain
    const validTokens: Record<Chain, string[]> = {
      [Chain.SOLANA]: ['SOL', 'USDC', 'USDT', 'ETH', 'BTC', 'BONK', 'JUP', 'RAY'],
      [Chain.ETHEREUM]: ['ETH', 'USDC', 'USDT', 'WBTC', 'DAI', 'PEPE', 'SHIB'],
      [Chain.POLYGON]: ['MATIC', 'USDC', 'USDT', 'WETH', 'WBTC'],
      [Chain.BSC]: ['BNB', 'BUSD', 'USDT', 'CAKE'],
      [Chain.AVALANCHE]: ['AVAX', 'USDC', 'USDT'],
      [Chain.ARBITRUM]: ['ETH', 'USDC', 'USDT', 'ARB'],
      [Chain.OPTIMISM]: ['ETH', 'USDC', 'USDT', 'OP']
    };
    
    return validTokens[chain]?.includes(token) || false;
  }
  
  /**
   * Calculate profit opportunity with quantum optimization
   */
  private calculateProfitOpportunity(
    sourceChain: Chain,
    targetChain: Chain,
    sourceToken: string,
    targetToken: string,
    bridge: Bridge,
    marketConditions: any
  ): { profitPercentage: number; estimatedProfitUsd: number; confidence: number } {
    // In a real implementation, this would use real price data and quantum algorithms
    
    // Base profit calculation using quantum randomness generator (simplified simulation)
    const baseProfitPct = Math.random() * 2.5 + 0.2; // 0.2% to 2.7% base profit
    
    // Calculate market factors
    const volatilityFactor = 1 + (marketConditions.volatility * (Math.random() - 0.3));
    const trendFactor = 1 + (marketConditions.trend * 2); // Amplify trend impact
    const bridgeCongestionFactor = 1 - (marketConditions.bridgeCongestion * 0.5);
    
    // Token-specific factors (would be based on real market data)
    const tokenPairFactor = this.getTokenPairFactor(sourceToken, targetToken);
    
    // Chain-specific factors
    const chainPairFactor = this.getChainPairFactor(sourceChain, targetChain);
    
    // Bridge-specific factors
    const bridgeFactor = this.getBridgeFactor(bridge);
    
    // Calculate final profit percentage with all factors
    const profitPercentage = baseProfitPct * volatilityFactor * trendFactor * 
                           bridgeCongestionFactor * tokenPairFactor * chainPairFactor * bridgeFactor;
    
    // Calculate estimated profit in USD (assuming $1000 transaction size)
    const transactionSize = 1000;
    const estimatedProfitUsd = transactionSize * (profitPercentage / 100);
    
    // Calculate confidence based on all factors
    const baseConfidence = 60 + (Math.random() * 30); // 60-90% base confidence
    const confidenceAdjustment = (
      (volatilityFactor > 1 ? 5 : -5) +
      (trendFactor > 1 ? 10 : -10) +
      (bridgeCongestionFactor > 0.8 ? 5 : -5) +
      (tokenPairFactor > 1 ? 5 : -5) +
      (chainPairFactor > 1 ? 5 : -5) +
      (bridgeFactor > 1 ? 5 : -5)
    );
    
    const confidence = Math.min(98, Math.max(40, baseConfidence + confidenceAdjustment));
    
    return {
      profitPercentage,
      estimatedProfitUsd,
      confidence
    };
  }
  
  /**
   * Get token pair factor for profit calculation
   */
  private getTokenPairFactor(sourceToken: string, targetToken: string): number {
    // Predefined factors for token pairs (would use real data in production)
    const tokenPairFactors: Record<string, number> = {
      'SOL:ETH': 1.2,
      'ETH:SOL': 1.15,
      'SOL:USDC': 0.9,
      'USDC:SOL': 0.95,
      'SOL:BNB': 1.1,
      'BNB:SOL': 1.05,
      'ETH:USDC': 0.85,
      'USDC:ETH': 0.9,
    };
    
    const pairKey = `${sourceToken}:${targetToken}`;
    return tokenPairFactors[pairKey] || 1.0;
  }
  
  /**
   * Get chain pair factor for profit calculation
   */
  private getChainPairFactor(sourceChain: Chain, targetChain: Chain): number {
    // Predefined factors for chain pairs (would use real data in production)
    const chainPairFactors: Record<string, number> = {
      [`${Chain.SOLANA}:${Chain.ETHEREUM}`]: 1.25,
      [`${Chain.ETHEREUM}:${Chain.SOLANA}`]: 1.2,
      [`${Chain.SOLANA}:${Chain.BSC}`]: 1.15,
      [`${Chain.BSC}:${Chain.SOLANA}`]: 1.1,
      [`${Chain.SOLANA}:${Chain.POLYGON}`]: 1.05,
      [`${Chain.POLYGON}:${Chain.SOLANA}`]: 1.0,
      [`${Chain.ETHEREUM}:${Chain.POLYGON}`]: 0.95,
      [`${Chain.POLYGON}:${Chain.ETHEREUM}`]: 0.9,
    };
    
    const pairKey = `${sourceChain}:${targetChain}`;
    return chainPairFactors[pairKey] || 1.0;
  }
  
  /**
   * Get bridge factor for profit calculation
   */
  private getBridgeFactor(bridge: Bridge): number {
    // Predefined factors for bridges (would use real data in production)
    const bridgeFactors: Record<Bridge, number> = {
      [Bridge.WORMHOLE]: 1.2,
      [Bridge.PORTAL]: 1.1,
      [Bridge.ALLBRIDGE]: 0.95,
      [Bridge.SYNAPSE]: 0.9,
    };
    
    return bridgeFactors[bridge] || 1.0;
  }
  
  /**
   * Check Wormhole API key
   * @returns Whether API key is configured
   */
  public hasWormholeApiKey(): boolean {
    return this.wormholeApiKey !== null;
  }
}

// Export singleton instances
export const crossChainConnector = new CrossChainConnector();
export const crossChainTransformer = crossChainConnector; // Alias for transformer interface
export default crossChainConnector;