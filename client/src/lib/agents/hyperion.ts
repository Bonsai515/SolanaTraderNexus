/**
 * Hyperion Agent - Flash Arbitrage Overlord Implementation
 * 
 * Frontend interface to the Rust-based Hyperion agent for flash loan arbitrage.
 * This component communicates with the backend Rust implementation via API calls.
 */

import { apiRequestJson } from "../queryClient";
import { WebSocket, createWebSocket } from "../wsClient";

// Agent state types based on Rust implementation
export interface HyperionState {
  id: string;
  name: string;
  strategyVault: string;
  profitLedger: ProfitDB;
  chainMapper: WormholeMap;
  status: AgentStatus;
  active: boolean;
  metrics: {
    totalExecutions: number;
    successRate: number;
    totalProfit: number;
    lastExecution?: Date;
  };
  lastError?: string;
}

// Supporting types
export interface ProfitDB {
  totalProfit: number;
  transactions: ProfitTransaction[];
}

export interface ProfitTransaction {
  id: string;
  amount: number;
  timestamp: Date;
  dexPath: string[];
  chainRoute?: string[];
}

export interface WormholeMap {
  supportedChains: string[];
  liquidityPools: Record<string, WormholeLiquidityPool[]>;
}

export interface WormholeLiquidityPool {
  sourceChain: string;
  targetChain: string;
  token: string;
  liquidity: number;
  fee: number;
  lastUpdated: Date;
}

export enum AgentStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  SCANNING = 'scanning',
  EXECUTING = 'executing',
  COOLDOWN = 'cooldown',
  ERROR = 'error',
}

// Flash loan arbitrage types
export interface DexRoute {
  dex: string;
  pair: string;
  expectedSlippage: number;
}

export interface WormholePath {
  sourceChain: string;
  targetChain: string;
  token: string;
  amount: number;
}

export interface ArbitrageResult {
  success: boolean;
  profit: number;
  executionTime: number;
  dexPath: DexRoute[];
  chainRoute?: WormholePath;
  txSignature?: string;
  error?: string;
  metrics: Record<string, number>;
}

/**
 * Hyperion Agent Client
 * Connects to the Rust-based Hyperion agent for flash loan arbitrage.
 */
export class HyperionClient {
  private wsClient: WebSocket | null = null;
  private state: HyperionState | null = null;
  private callbacks: Record<string, (data: any) => void> = {};

  /**
   * Initialize the Hyperion agent client.
   */
  async initialize(): Promise<boolean> {
    try {
      // Get initial agent state
      this.state = await apiRequestJson<HyperionState>('GET', '/api/agents/hyperion');

      // Set up WebSocket connection for real-time updates
      this.setupWebSocket();

      return true;
    } catch (error) {
      console.error('Failed to initialize Hyperion agent:', error);
      return false;
    }
  }

  /**
   * Set up WebSocket connection for real-time updates.
   */
  private setupWebSocket(): void {
    this.wsClient = new WebSocket('/agents/hyperion');

    this.wsClient.onMessage((data) => {
      // Update state based on WebSocket messages
      if (data.type === 'state_update') {
        this.state = data.state;
      }

      // Call registered callbacks
      if (data.id && this.callbacks[data.id]) {
        this.callbacks[data.id](data);
        delete this.callbacks[data.id];
      }
    });
  }

  /**
   * Get the current agent state.
   */
  getState(): HyperionState | null {
    return this.state;
  }

  /**
   * Start the agent.
   */
  async start(): Promise<boolean> {
    try {
      const response = await apiRequest('POST', '/api/agents/hyperion/start');
      const result = await response.json();
      
      if (result.success) {
        this.state = result.state;
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to start Hyperion agent:', error);
      return false;
    }
  }

  /**
   * Stop the agent.
   */
  async stop(): Promise<boolean> {
    try {
      const response = await apiRequest('POST', '/api/agents/hyperion/stop');
      const result = await response.json();
      
      if (result.success) {
        this.state = result.state;
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to stop Hyperion agent:', error);
      return false;
    }
  }

  /**
   * Execute a zero-capital arbitrage operation.
   */
  async executeZeroCapitalArb(dexPath: DexRoute[], chainRoute?: WormholePath): Promise<ArbitrageResult> {
    try {
      const response = await apiRequest('POST', '/api/agents/hyperion/execute', {
        operation: 'zero_capital_arb',
        dexPath,
        chainRoute
      });

      return await response.json();
    } catch (error) {
      console.error('Failed to execute zero-capital arbitrage:', error);
      return {
        success: false,
        profit: 0,
        executionTime: 0,
        dexPath,
        chainRoute,
        error: error instanceof Error ? error.message : String(error),
        metrics: {}
      };
    }
  }

  /**
   * Get recent arbitrage results.
   */
  async getRecentResults(limit: number = 10): Promise<ArbitrageResult[]> {
    try {
      const response = await apiRequest('GET', `/api/agents/hyperion/results?limit=${limit}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to get recent results:', error);
      return [];
    }
  }

  /**
   * Get profit history.
   */
  async getProfitHistory(days: number = 30): Promise<{ date: string, profit: number }[]> {
    try {
      const response = await apiRequest('GET', `/api/agents/hyperion/profit-history?days=${days}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to get profit history:', error);
      return [];
    }
  }

  /**
   * Register a callback for a specific operation.
   */
  registerCallback(id: string, callback: (data: any) => void): void {
    this.callbacks[id] = callback;
  }

  /**
   * Clean up resources.
   */
  cleanup(): void {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
  }
}

// Export singleton instance
export const hyperionClient = new HyperionClient();