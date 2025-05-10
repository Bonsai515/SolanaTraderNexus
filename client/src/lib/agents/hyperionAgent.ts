/**
 * Hyperion Flash Arbitrage Agent Client
 *
 * This module provides a client interface for the Hyperion flash arbitrage agent,
 * enabling monitoring and control of the agent from the front-end.
 */

import { apiRequest } from '../queryClient';
import { wsClient } from '../wsClient';

// Agent status
export enum AgentStatus {
  IDLE = 'idle',
  SCANNING = 'scanning',
  EXECUTING = 'executing',
  ERROR = 'error'
}

// Agent configuration
export interface HyperionConfiguration {
  active: boolean;
  tradingWallets: string[];
  maxSlippageBps: number;
  minProfitThresholdUsd: number;
  maxPositionSizeUsd: number;
  targetDexes: string[];
  tradingPairs: string[];
  executionSpeed: 'normal' | 'fast' | 'turbo';
  riskLevel: 'conservative' | 'balanced' | 'aggressive';
  parallelExecutions: number;
  useRouteOptimization: boolean;
  revertOnFailedExecution: boolean;
  useMEVProtection: boolean;
  liquiditySourcePriority: Record<string, number>;
  detectionAlgorithm: 'basic' | 'advanced' | 'quantum';
  webhookNotifications: boolean;
  webhookUrl?: string;
}

// Agent status response
export interface HyperionStatusResponse {
  id: string;
  status: AgentStatus;
  active: boolean;
  lastScan: string;
  lastExecution: string;
  successRate: number;
  totalExecutions: number;
  totalProfit: number;
  averageExecutionTimeMs: number;
  activeConnections: number;
  cpuUsage: number;
  memoryUsage: number;
  pendingTransactions: number;
  detectedOpportunities: number;
  missedOpportunities: number;
  currentVersion: string;
}

// Arbitrage opportunity
export interface ArbitrageOpportunity {
  id: string;
  timestamp: string;
  pair: string;
  sourceExchange: string;
  targetExchange: string;
  entryPrice: number;
  exitPrice: number;
  spread: number;
  spreadPercentage: number;
  estimatedProfitUsd: number;
  estimatedFeeUsd: number;
  estimatedNetProfitUsd: number;
  confidence: number;
  executionTimeMs: number;
  status: 'detected' | 'executing' | 'completed' | 'failed';
  routeHops: number;
  executionPath: string[];
  riskScore: number;
  volumeAvailable: number;
  slippageImpact: number;
  urgency: 'low' | 'medium' | 'high';
  successProbability: number;
  transactionSignature?: string;
}

// Performance metrics
export interface PerformanceMetrics {
  timeframe: string;
  totalOpportunities: number;
  executedOpportunities: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalProfit: number;
  totalFees: number;
  netProfit: number;
  averageProfitPerTrade: number;
  medianProfitPerTrade: number;
  largestProfit: number;
  smallestProfit: number;
  averageExecutionTimeMs: number;
  successRate: number;
  profitDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  volumeByPair: Record<string, number>;
  profitByPair: Record<string, number>;
  profitByExchangePair: Record<string, number>;
  timeOfDayDistribution: Record<string, number>;
  weekdayDistribution: Record<string, string>;
  missedProfit: number;
  missedOpportunities: number;
  detectionLatencyMs: {
    average: number;
    median: number;
    p95: number;
    min: number;
    max: number;
  };
}

// Detection pattern
export interface DetectionPattern {
  id: string;
  name: string;
  description: string;
  exchanges: string[];
  pairs: string[];
  profitability: 'low' | 'medium' | 'high';
  frequencyPerDay: number;
  avgProfitUsd: number;
  reliabilityScore: number;
  timeWindowMs: number;
  volumeRequirement: number;
  patternSignature: string;
  firstDetected: string;
  lastDetected: string;
  successRate: number;
  totalDetections: number;
  totalExecutions: number;
  totalProfitUsd: number;
  active: boolean;
}

// Simulation result
export interface SimulationResult {
  success: boolean;
  estimatedProfit: number;
  estimatedFees: number;
  netProfit: number;
  executionPath: string[];
  executionTimeMs: number;
  slippageImpact: number;
  successProbability: number;
}

// Price anomaly
export interface PriceAnomaly {
  pair: string;
  timestamp: string;
  exchange: string;
  price: number;
  percentageDeviation: number;
  anomalyScore: number;
  durationMs: number;
  impactLevel: 'low' | 'medium' | 'high';
  profitOpportunity: boolean;
  explanation: string;
}

// Liquidity analysis
export interface LiquidityAnalysis {
  [pair: string]: {
    pair: string;
    timestamp: string;
    exchanges: {
      [exchange: string]: {
        exchange: string;
        buyDepth: number;
        sellDepth: number;
        bestBid: number;
        bestAsk: number;
        spread: number;
        slippageMap: Record<string, number>;
        volumeLast24h: number;
        liquidityScore: number;
      };
    };
    aggregatedLiquidityScore: number;
    recommendedMaxPositionSize: number;
    arbitrageOpportunityScore: number;
  };
}

// Algorithm settings
export interface AlgorithmSettings {
  algorithm: 'basic' | 'advanced' | 'quantum';
  parameters: {
    opportunityThreshold: number;
    minSpreadPercentage: number;
    maxExecutionTimeMs: number;
    riskFactorWeight: number;
    confidenceThreshold: number;
    anomalyDetectionSensitivity: number;
    volumeRequirementMultiplier: number;
    gasFeeOptimizationLevel: number;
  };
  sensitivityLevel: number;
  thresholdSettings: {
    minProfitUsd: number;
    maxSlippageBps: number;
    minReliabilityScore: number;
    maxRiskScore: number;
  };
  adaptiveParameters: boolean;
  adaptiveSettings: {
    enabled: boolean;
    learningRate: number;
    historyWindowSize: number;
    adjustmentFrequency: 'hourly' | 'daily' | 'weekly';
    maxAdjustmentPercentage: number;
  };
  customFilters: {
    excludeHighVolumeImpact: boolean;
    excludeLowLiquidityPairs: boolean;
    preferHigherSuccessProbability: boolean;
  };
  neuralModelVersion: string;
  processingMode: 'serial' | 'parallel';
  prioritizationRules: {
    profitAmount: number;
    executionSpeed: number;
    successProbability: number;
    volumeAvailability: number;
    historicalReliability: number;
  };
}

// Manual arbitrage result
export interface ManualArbitrageResult {
  success: boolean;
  transactionSignature: string;
  entryPrice: number;
  exitPrice: number;
  profit: number;
  fees: number;
  netProfit: number;
  executionTimeMs: number;
}

/**
 * Hyperion Agent Client
 */
class HyperionAgentClient {
  private static instance: HyperionAgentClient;
  private baseUrl: string = '/api/agent/hyperion';
  private opportunityCallbacks: ((opportunity: ArbitrageOpportunity) => void)[] = [];
  private statusCallbacks: ((status: HyperionStatusResponse) => void)[] = [];
  
  private constructor() {
    this.setupWebSocketHandlers();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): HyperionAgentClient {
    if (!HyperionAgentClient.instance) {
      HyperionAgentClient.instance = new HyperionAgentClient();
    }
    return HyperionAgentClient.instance;
  }
  
  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    wsClient.onMessage((message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'HYPERION_OPPORTUNITY') {
          this.notifyOpportunityCallbacks(data.data);
        } else if (data.type === 'HYPERION_STATUS_UPDATE') {
          this.notifyStatusCallbacks(data.data);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
  }
  
  /**
   * Subscribe to arbitrage opportunity updates
   * @param callback Function to call with opportunity updates
   * @returns Object with unsubscribe method
   */
  public subscribeToOpportunities(callback: (opportunity: ArbitrageOpportunity) => void): { unsubscribe: () => void } {
    // Subscribe if this is the first subscription
    if (this.opportunityCallbacks.length === 0) {
      wsClient.send({
        type: 'SUBSCRIBE',
        channel: 'HYPERION_OPPORTUNITIES'
      });
    }
    
    this.opportunityCallbacks.push(callback);
    
    return {
      unsubscribe: () => {
        this.opportunityCallbacks = this.opportunityCallbacks.filter(cb => cb !== callback);
        
        // Unsubscribe if this was the last subscription
        if (this.opportunityCallbacks.length === 0) {
          wsClient.send({
            type: 'UNSUBSCRIBE',
            channel: 'HYPERION_OPPORTUNITIES'
          });
        }
      }
    };
  }
  
  /**
   * Subscribe to agent status updates
   * @param callback Function to call with status updates
   * @returns Object with unsubscribe method
   */
  public subscribeToStatusUpdates(callback: (status: HyperionStatusResponse) => void): { unsubscribe: () => void } {
    // Subscribe if this is the first subscription
    if (this.statusCallbacks.length === 0) {
      wsClient.send({
        type: 'SUBSCRIBE',
        channel: 'HYPERION_STATUS'
      });
    }
    
    this.statusCallbacks.push(callback);
    
    return {
      unsubscribe: () => {
        this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
        
        // Unsubscribe if this was the last subscription
        if (this.statusCallbacks.length === 0) {
          wsClient.send({
            type: 'UNSUBSCRIBE',
            channel: 'HYPERION_STATUS'
          });
        }
      }
    };
  }
  
  /**
   * Notify all opportunity subscribers
   * @param opportunity Opportunity data
   */
  private notifyOpportunityCallbacks(opportunity: ArbitrageOpportunity): void {
    this.opportunityCallbacks.forEach(callback => {
      try {
        callback(opportunity);
      } catch (error) {
        console.error('Error in opportunity callback:', error);
      }
    });
  }
  
  /**
   * Notify all status subscribers
   * @param status Status data
   */
  private notifyStatusCallbacks(status: HyperionStatusResponse): void {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in status callback:', error);
      }
    });
  }
  
  /**
   * Get agent status
   * @returns Promise resolving to agent status
   */
  public async getStatus(): Promise<HyperionStatusResponse> {
    try {
      const response = await apiRequest('GET', `${this.baseUrl}/status`);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting agent status:', error);
      throw error;
    }
  }
  
  /**
   * Get agent configuration
   * @returns Promise resolving to agent configuration
   */
  public async getConfiguration(): Promise<HyperionConfiguration> {
    try {
      const response = await apiRequest('GET', `${this.baseUrl}/configuration`);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting agent configuration:', error);
      throw error;
    }
  }
  
  /**
   * Update agent configuration
   * @param config Configuration updates
   * @returns Promise resolving to updated configuration
   */
  public async updateConfiguration(config: Partial<HyperionConfiguration>): Promise<HyperionConfiguration> {
    try {
      const response = await apiRequest('POST', `${this.baseUrl}/configuration`, config);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error updating agent configuration:', error);
      throw error;
    }
  }
  
  /**
   * Start the agent
   * @returns Promise resolving to success status
   */
  public async start(): Promise<{ status: string; message: string }> {
    try {
      const response = await apiRequest('POST', `${this.baseUrl}/start`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error starting agent:', error);
      throw error;
    }
  }
  
  /**
   * Stop the agent
   * @returns Promise resolving to success status
   */
  public async stop(): Promise<{ status: string; message: string }> {
    try {
      const response = await apiRequest('POST', `${this.baseUrl}/stop`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error stopping agent:', error);
      throw error;
    }
  }
  
  /**
   * Get recent opportunities
   * @param limit Maximum number of opportunities to retrieve
   * @returns Promise resolving to array of opportunities
   */
  public async getRecentOpportunities(limit: number = 10): Promise<ArbitrageOpportunity[]> {
    try {
      const response = await apiRequest('GET', `${this.baseUrl}/opportunities?limit=${limit}`);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting recent opportunities:', error);
      throw error;
    }
  }
  
  /**
   * Get performance metrics
   * @param timeframe Timeframe for metrics (24h, 7d, 30d, all)
   * @returns Promise resolving to performance metrics
   */
  public async getPerformanceMetrics(timeframe: string = '24h'): Promise<PerformanceMetrics> {
    try {
      const response = await apiRequest('GET', `${this.baseUrl}/metrics?timeframe=${timeframe}`);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      throw error;
    }
  }
  
  /**
   * Get detection patterns
   * @param activeOnly Only return active patterns
   * @returns Promise resolving to array of detection patterns
   */
  public async getDetectionPatterns(activeOnly: boolean = true): Promise<DetectionPattern[]> {
    try {
      const response = await apiRequest('GET', `${this.baseUrl}/patterns?active=${activeOnly}`);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting detection patterns:', error);
      throw error;
    }
  }
  
  /**
   * Run arbitrage simulation
   * @param params Simulation parameters
   * @returns Promise resolving to simulation results
   */
  public async runSimulation(params: {
    pair: string;
    amount: number;
    sourceExchange: string;
    targetExchange: string;
    executionSpeed?: 'normal' | 'fast' | 'turbo';
  }): Promise<SimulationResult> {
    try {
      const response = await apiRequest('POST', `${this.baseUrl}/simulate`, params);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error running simulation:', error);
      throw error;
    }
  }
  
  /**
   * Get price anomalies
   * @param days Number of days to look back
   * @returns Promise resolving to array of price anomalies
   */
  public async getPriceAnomalies(days: number = 7): Promise<PriceAnomaly[]> {
    try {
      const response = await apiRequest('GET', `${this.baseUrl}/anomalies?days=${days}`);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting price anomalies:', error);
      throw error;
    }
  }
  
  /**
   * Get liquidity analysis
   * @param pairs Array of trading pairs to analyze
   * @returns Promise resolving to liquidity analysis
   */
  public async getLiquidityAnalysis(pairs: string[]): Promise<LiquidityAnalysis> {
    try {
      const response = await apiRequest('POST', `${this.baseUrl}/liquidity-analysis`, { pairs });
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting liquidity analysis:', error);
      throw error;
    }
  }
  
  /**
   * Get algorithm settings
   * @returns Promise resolving to algorithm settings
   */
  public async getAlgorithmSettings(): Promise<AlgorithmSettings> {
    try {
      const response = await apiRequest('GET', `${this.baseUrl}/algorithm-settings`);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting algorithm settings:', error);
      throw error;
    }
  }
  
  /**
   * Update algorithm settings
   * @param settings Settings to update
   * @returns Promise resolving to updated settings
   */
  public async updateAlgorithmSettings(settings: Partial<AlgorithmSettings>): Promise<{
    success: boolean;
    message: string;
    updatedSettings: AlgorithmSettings;
  }> {
    try {
      const response = await apiRequest('POST', `${this.baseUrl}/algorithm-settings`, settings);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error updating algorithm settings:', error);
      throw error;
    }
  }
  
  /**
   * Execute manual arbitrage
   * @param params Manual arbitrage parameters
   * @returns Promise resolving to execution result
   */
  public async executeManualArbitrage(params: {
    pair: string;
    amount: number;
    sourceExchange: string;
    targetExchange: string;
    maxSlippageBps?: number;
    executionSpeed?: 'normal' | 'fast' | 'turbo';
    wallet?: string;
  }): Promise<ManualArbitrageResult> {
    try {
      const response = await apiRequest('POST', `${this.baseUrl}/execute-manual`, params);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error executing manual arbitrage:', error);
      throw error;
    }
  }
}

export const hyperionAgent = HyperionAgentClient.getInstance();