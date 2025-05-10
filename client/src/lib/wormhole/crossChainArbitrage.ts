/**
 * Cross-Chain Arbitrage via Wormhole
 * 
 * This module provides functionality for cross-chain arbitrage opportunities
 * using Wormhole as the bridge between Solana and other blockchains.
 * It enables the detection and execution of price differentials across multiple chains.
 */

import { apiRequest } from '../queryClient';
import { wsClient } from '../wsClient';

// Supported chains for cross-chain arbitrage
export enum SupportedChain {
  SOLANA = 'solana',
  ETHEREUM = 'ethereum',
  POLYGON = 'polygon',
  ARBITRUM = 'arbitrum',
  OPTIMISM = 'optimism',
  BSC = 'bsc',
  AVALANCHE = 'avalanche',
  BASE = 'base',
  SUI = 'sui',
  APTOS = 'aptos'
}

// Chain ID mappings for Wormhole
export const ChainIds = {
  [SupportedChain.SOLANA]: 1,
  [SupportedChain.ETHEREUM]: 2,
  [SupportedChain.BSC]: 4,
  [SupportedChain.POLYGON]: 5,
  [SupportedChain.AVALANCHE]: 6,
  [SupportedChain.OPTIMISM]: 24,
  [SupportedChain.ARBITRUM]: 23,
  [SupportedChain.BASE]: 30,
  [SupportedChain.SUI]: 21,
  [SupportedChain.APTOS]: 22
};

// Cross-chain arbitrage opportunity
export interface CrossChainOpportunity {
  id: string;
  timestamp: string;
  sourceChain: SupportedChain;
  targetChain: SupportedChain;
  token: string;
  sourceToken: string;
  targetToken: string;
  sourceExchange: string;
  targetExchange: string;
  sourcePriceUsd: number;
  targetPriceUsd: number;
  priceSpreadPercentage: number;
  estimatedProfitUsd: number;
  estimatedCostUsd: {
    bridgeFees: number;
    gasFeesSource: number;
    gasFeesTarget: number;
    slippage: number;
    total: number;
  };
  estimatedNetProfitUsd: number;
  estimatedTimeToComplete: number; // in seconds
  confidence: number;
  executionComplexity: 'low' | 'medium' | 'high';
  liquidityScore: {
    source: number;
    target: number;
  };
  status: 'detected' | 'executing' | 'completed' | 'failed';
  transactionSignatures?: {
    source?: string;
    wormhole?: string;
    target?: string;
  };
  routeDetails: {
    sourceRoute: string[];
    bridgeRoute: string[];
    targetRoute: string[];
  };
  riskLevel: number;
  urgency: 'low' | 'medium' | 'high';
  requiredBalances: {
    [chain in SupportedChain]?: {
      token: string;
      amount: string;
    }[];
  };
}

// Configuration for cross-chain arbitrage
export interface CrossChainConfiguration {
  enabled: boolean;
  supportedChains: SupportedChain[];
  supportedTokens: string[];
  minProfitThresholdUsd: number;
  maxPositionSizeUsd: number;
  maxSlippageBps: number;
  executeAutomatically: boolean;
  minimumConfidence: number;
  maxTimeToCompleteSeconds: number;
  riskTolerance: 'low' | 'medium' | 'high';
  wallets: {
    [chain in SupportedChain]?: string;
  };
  exchangePriorities: {
    [chain in SupportedChain]?: {
      [exchange: string]: number;
    };
  };
  gasMultipliers: {
    [chain in SupportedChain]?: number;
  };
  relayers: {
    enabled: boolean;
    preferred: string[];
  };
  quotes: {
    validateQuotesBeforeExecution: boolean;
    requiredQuoteProviders: number;
  };
  webhookNotifications: boolean;
  webhookUrl?: string;
}

// Network statistics
export interface NetworkStatistics {
  chain: SupportedChain;
  blockHeight: number;
  averageBlockTime: number;
  currentGasPrice: {
    slow: number;
    average: number;
    fast: number;
  };
  lastUpdated: string;
  congestion: 'low' | 'medium' | 'high';
  finality: number; // seconds
  recommendedGasMultiplier: number;
}

// Bridging statistics
export interface BridgingStatistics {
  sourceChain: SupportedChain;
  targetChain: SupportedChain;
  averageTimeToComplete: number; // seconds
  medianTimeToComplete: number; // seconds
  reliabilityScore: number; // 0-1
  averageCostUsd: number;
  volume24hUsd: number;
  bridgeFinality: number; // seconds
  guardianSignatures: {
    required: number;
    average: number;
  };
  success24h: number;
  failed24h: number;
  successRate: number; // 0-1
}

// Quote for cross-chain arbitrage
export interface CrossChainQuote {
  id: string;
  timestamp: string;
  sourceChain: SupportedChain;
  targetChain: SupportedChain;
  token: string;
  sourceAmount: string;
  targetAmount: string;
  sourcePriceUsd: number;
  targetPriceUsd: number;
  sourceLiquidity: number;
  targetLiquidity: number;
  estimatedProfitUsd: number;
  estimatedCostUsd: {
    bridgeFees: number;
    gasFeesSource: number;
    gasFeesTarget: number;
    slippage: number;
    total: number;
  };
  estimatedNetProfitUsd: number;
  bridgeProvider: string;
  sourceExchange: string;
  targetExchange: string;
  expiresAt: string;
  exchangeRate: number;
  minimumSrcAmount: string;
  maximumSrcAmount: string;
  provider: string;
}

// Cross-chain transaction
export interface CrossChainTransaction {
  id: string;
  opportunityId: string;
  status: 'initiated' | 'source_completed' | 'bridge_completed' | 'target_pending' | 'completed' | 'failed';
  sourceChain: SupportedChain;
  targetChain: SupportedChain;
  token: string;
  amount: string;
  startedAt: string;
  completedAt?: string;
  transactionSignatures: {
    source?: string;
    wormhole?: string;
    target?: string;
  };
  currentStep: string;
  steps: {
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    startedAt?: string;
    completedAt?: string;
    transactionSignature?: string;
    failureReason?: string;
  }[];
  profit?: {
    estimated: number;
    actual: number;
    difference: number;
  };
  costs: {
    estimated: number;
    actual: number;
    difference: number;
  };
  errors?: {
    code: string;
    message: string;
    step: string;
    timestamp: string;
    recoverable: boolean;
  }[];
}

class CrossChainArbitrageClient {
  private static instance: CrossChainArbitrageClient;
  private baseUrl: string = '/api/cross-chain';
  private wsSubscriptions: Set<string> = new Set();
  private opportunityCallbacks: ((opportunity: CrossChainOpportunity) => void)[] = [];
  private transactionCallbacks: ((transaction: CrossChainTransaction) => void)[] = [];
  
  private constructor() {
    this.setupWebSocket();
  }
  
  public static getInstance(): CrossChainArbitrageClient {
    if (!CrossChainArbitrageClient.instance) {
      CrossChainArbitrageClient.instance = new CrossChainArbitrageClient();
    }
    return CrossChainArbitrageClient.instance;
  }
  
  /**
   * Set up WebSocket connection for real-time updates
   */
  private setupWebSocket(): void {
    wsClient.onMessage((message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'CROSS_CHAIN_OPPORTUNITY') {
          this.opportunityCallbacks.forEach(callback => {
            callback(data.data as CrossChainOpportunity);
          });
        } else if (data.type === 'CROSS_CHAIN_TRANSACTION_UPDATE') {
          this.transactionCallbacks.forEach(callback => {
            callback(data.data as CrossChainTransaction);
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message in Cross-Chain Arbitrage client:', error);
      }
    });
  }
  
  /**
   * Subscribe to real-time cross-chain arbitrage opportunities
   * @param callback Function to call when an opportunity is detected
   * @returns Unsubscribe function
   */
  public subscribeToOpportunities(callback: (opportunity: CrossChainOpportunity) => void): () => void {
    if (this.opportunityCallbacks.length === 0) {
      // First subscriber, send subscription message
      wsClient.send({
        type: 'SUBSCRIBE',
        channel: 'CROSS_CHAIN_OPPORTUNITIES'
      });
      this.wsSubscriptions.add('CROSS_CHAIN_OPPORTUNITIES');
    }
    
    this.opportunityCallbacks.push(callback);
    
    return () => {
      this.opportunityCallbacks = this.opportunityCallbacks.filter(cb => cb !== callback);
      
      if (this.opportunityCallbacks.length === 0) {
        // No more subscribers, unsubscribe
        wsClient.send({
          type: 'UNSUBSCRIBE',
          channel: 'CROSS_CHAIN_OPPORTUNITIES'
        });
        this.wsSubscriptions.delete('CROSS_CHAIN_OPPORTUNITIES');
      }
    };
  }
  
  /**
   * Subscribe to cross-chain transaction updates
   * @param callback Function to call on transaction update
   * @returns Unsubscribe function
   */
  public subscribeToTransactionUpdates(callback: (transaction: CrossChainTransaction) => void): () => void {
    if (this.transactionCallbacks.length === 0) {
      // First subscriber, send subscription message
      wsClient.send({
        type: 'SUBSCRIBE',
        channel: 'CROSS_CHAIN_TRANSACTION_UPDATES'
      });
      this.wsSubscriptions.add('CROSS_CHAIN_TRANSACTION_UPDATES');
    }
    
    this.transactionCallbacks.push(callback);
    
    return () => {
      this.transactionCallbacks = this.transactionCallbacks.filter(cb => cb !== callback);
      
      if (this.transactionCallbacks.length === 0) {
        // No more subscribers, unsubscribe
        wsClient.send({
          type: 'UNSUBSCRIBE',
          channel: 'CROSS_CHAIN_TRANSACTION_UPDATES'
        });
        this.wsSubscriptions.delete('CROSS_CHAIN_TRANSACTION_UPDATES');
      }
    };
  }
  
  /**
   * Get current configuration for cross-chain arbitrage
   * @returns Promise resolving to configuration
   */
  public async getConfiguration(): Promise<CrossChainConfiguration> {
    const response = await apiRequest('GET', `${this.baseUrl}/configuration`);
    const data = await response.json();
    return data.data;
  }
  
  /**
   * Update configuration for cross-chain arbitrage
   * @param config Configuration updates to apply
   * @returns Promise resolving to updated configuration
   */
  public async updateConfiguration(config: Partial<CrossChainConfiguration>): Promise<CrossChainConfiguration> {
    const response = await apiRequest('POST', `${this.baseUrl}/configuration`, config);
    const data = await response.json();
    return data.data;
  }
  
  /**
   * Get recent cross-chain arbitrage opportunities
   * @param limit Maximum number of opportunities to retrieve
   * @returns Promise resolving to array of opportunities
   */
  public async getRecentOpportunities(limit: number = 10): Promise<CrossChainOpportunity[]> {
    const response = await apiRequest('GET', `${this.baseUrl}/opportunities?limit=${limit}`);
    const data = await response.json();
    return data.data;
  }
  
  /**
   * Get cross-chain transaction by ID
   * @param id Transaction ID
   * @returns Promise resolving to transaction details
   */
  public async getTransaction(id: string): Promise<CrossChainTransaction> {
    const response = await apiRequest('GET', `${this.baseUrl}/transactions/${id}`);
    const data = await response.json();
    return data.data;
  }
  
  /**
   * Get recent cross-chain transactions
   * @param limit Maximum number of transactions to retrieve
   * @returns Promise resolving to array of transactions
   */
  public async getRecentTransactions(limit: number = 10): Promise<CrossChainTransaction[]> {
    const response = await apiRequest('GET', `${this.baseUrl}/transactions?limit=${limit}`);
    const data = await response.json();
    return data.data;
  }
  
  /**
   * Execute a cross-chain arbitrage opportunity
   * @param opportunityId ID of the opportunity to execute
   * @returns Promise resolving to transaction details
   */
  public async executeOpportunity(opportunityId: string): Promise<CrossChainTransaction> {
    const response = await apiRequest('POST', `${this.baseUrl}/execute`, { opportunityId });
    const data = await response.json();
    return data.data;
  }
  
  /**
   * Get network statistics for a specific chain
   * @param chain Chain to get statistics for
   * @returns Promise resolving to network statistics
   */
  public async getNetworkStatistics(chain: SupportedChain): Promise<NetworkStatistics> {
    const response = await apiRequest('GET', `${this.baseUrl}/network-stats/${chain}`);
    const data = await response.json();
    return data.data;
  }
  
  /**
   * Get bridging statistics between two chains
   * @param sourceChain Source chain
   * @param targetChain Target chain
   * @returns Promise resolving to bridging statistics
   */
  public async getBridgingStatistics(sourceChain: SupportedChain, targetChain: SupportedChain): Promise<BridgingStatistics> {
    const response = await apiRequest('GET', `${this.baseUrl}/bridge-stats/${sourceChain}/${targetChain}`);
    const data = await response.json();
    return data.data;
  }
  
  /**
   * Get quotes for cross-chain arbitrage between two chains for a specific token
   * @param sourceChain Source chain
   * @param targetChain Target chain
   * @param token Token to transfer
   * @param amount Amount to transfer (as string)
   * @returns Promise resolving to array of quotes
   */
  public async getQuotes(
    sourceChain: SupportedChain,
    targetChain: SupportedChain,
    token: string,
    amount: string
  ): Promise<CrossChainQuote[]> {
    const response = await apiRequest('POST', `${this.baseUrl}/quotes`, {
      sourceChain,
      targetChain,
      token,
      amount
    });
    const data = await response.json();
    return data.data;
  }
  
  /**
   * Simulate execution of a cross-chain arbitrage opportunity
   * @param opportunityId ID of the opportunity to simulate
   * @returns Promise resolving to simulation results
   */
  public async simulateExecution(opportunityId: string): Promise<{
    success: boolean;
    estimatedTime: number;
    estimatedProfit: number;
    estimatedCosts: {
      sourceTxFee: number;
      bridgeFee: number;
      targetTxFee: number;
      total: number;
    };
    estimatedNetProfit: number;
    estimatedGasUsage: {
      [chain in SupportedChain]?: number;
    };
    steps: {
      name: string;
      estimatedTime: number;
      estimatedCost: number;
      success: boolean;
      failureRisk: number;
      failureReason?: string;
    }[];
    warningMessages: string[];
    errorMessages: string[];
  }> {
    const response = await apiRequest('POST', `${this.baseUrl}/simulate`, { opportunityId });
    const data = await response.json();
    return data.data;
  }
  
  /**
   * Get supported tokens for cross-chain arbitrage
   * @returns Promise resolving to array of supported tokens
   */
  public async getSupportedTokens(): Promise<{
    [chain in SupportedChain]?: {
      symbol: string;
      name: string;
      decimals: number;
      address: string;
      wormholeAddress?: string;
    }[];
  }> {
    const response = await apiRequest('GET', `${this.baseUrl}/supported-tokens`);
    const data = await response.json();
    return data.data;
  }
  
  /**
   * Check wallet balances across chains
   * @returns Promise resolving to wallet balances
   */
  public async checkWalletBalances(): Promise<{
    [chain in SupportedChain]?: {
      address: string;
      balances: {
        token: string;
        symbol: string;
        amount: string;
        amountUsd: number;
      }[];
      totalBalanceUsd: number;
    };
  }> {
    const response = await apiRequest('GET', `${this.baseUrl}/wallet-balances`);
    const data = await response.json();
    return data.data;
  }
  
  /**
   * Get cross-chain performance metrics
   * @param timeframe Timeframe for metrics
   * @returns Promise resolving to performance metrics
   */
  public async getPerformanceMetrics(timeframe: '24h' | '7d' | '30d' | 'all' = '24h'): Promise<{
    timeframe: string;
    totalOpportunities: number;
    executedOpportunities: number;
    successfulExecutions: number;
    failedExecutions: number;
    totalProfitUsd: number;
    totalCostsUsd: number;
    netProfitUsd: number;
    averageProfitPerTradeUsd: number;
    medianProfitPerTradeUsd: number;
    largestProfitUsd: number;
    averageTimeToCompleteSeconds: number;
    successRate: number;
    profitByChainPair: Record<string, number>;
    profitByToken: Record<string, number>;
    opportunitiesByChainPair: Record<string, number>;
    missedOpportunities: number;
    missedProfitUsd: number;
    latency: {
      opportunityDetection: number;
      quoteRetrieval: number;
      bridgeInitiation: number;
      bridgeCompletion: number;
      totalExecution: number;
    };
  }> {
    const response = await apiRequest('GET', `${this.baseUrl}/metrics?timeframe=${timeframe}`);
    const data = await response.json();
    return data.data;
  }
  
  /**
   * Cancel a pending cross-chain transaction
   * @param transactionId ID of the transaction to cancel
   * @returns Promise resolving to success status
   */
  public async cancelTransaction(transactionId: string): Promise<{
    success: boolean;
    message: string;
    refundTransactionSignature?: string;
  }> {
    const response = await apiRequest('POST', `${this.baseUrl}/cancel-transaction`, { transactionId });
    const data = await response.json();
    return data.data;
  }
  
  /**
   * Get health status of cross-chain services
   * @returns Promise resolving to health status
   */
  public async getServiceHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    wormhole: {
      status: 'operational' | 'degraded' | 'down';
      lastChecked: string;
      guardianQuorum: boolean;
      averageMessageTime: number;
      reliability24h: number;
    };
    chains: {
      [chain in SupportedChain]?: {
        status: 'operational' | 'degraded' | 'down';
        blockHeight: number;
        lastBlockTime: string;
        avgBlockTime: number;
        rpcLatency: number;
      };
    };
    exchanges: {
      [exchange: string]: {
        status: 'operational' | 'degraded' | 'down';
        lastQuoteTime: string;
        avgQuoteLatency: number;
      };
    };
    messageQueue: {
      status: 'operational' | 'backlogged' | 'failed';
      pendingMessages: number;
      processingRate: number;
    };
    detectionEngine: {
      status: 'operational' | 'degraded' | 'down';
      lastScanTime: string;
      scanFrequency: number;
      detectionLatency: number;
    };
  }> {
    const response = await apiRequest('GET', `${this.baseUrl}/health`);
    const data = await response.json();
    return data.data;
  }
}

// Export singleton instance
export const crossChainArbitrage = CrossChainArbitrageClient.getInstance();