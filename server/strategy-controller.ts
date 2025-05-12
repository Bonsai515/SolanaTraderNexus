/**
 * Strategy Controller
 * 
 * This module manages the activation and execution of trading strategies,
 * with a focus on selecting top strategies by yield and success rate.
 */

import { logger } from './logger';
import { Strategy, selectTopStrategies, getStrategyById } from './strategy-selector';
import { wormholeClient } from './wormhole/client';

// Agent interface for strategy execution
interface Agent {
  id: string;
  name: string;
  executeStrategy: (strategy: Strategy) => Promise<any>;
  isAvailable: () => boolean;
  getSupportedStrategies: () => string[];
}

// Agent registry
const agents: Record<string, Agent> = {
  hyperion: {
    id: 'hyperion',
    name: 'Hyperion Flash Arbitrage Overlord',
    executeStrategy: async (strategy) => {
      logger.info(`Hyperion executing strategy: ${strategy.name}`);
      // Implementation would connect to the Rust agent
      return {
        status: 'success',
        strategy: strategy.id,
        agent: 'hyperion',
        timestamp: new Date().toISOString(),
      };
    },
    isAvailable: () => true,
    getSupportedStrategies: () => [
      'flash-arb-raydium-orca',
      'flash-arb-jupiter-openbook',
      'lending-protocol-arbitrage',
    ],
  },
  quantum_omega: {
    id: 'quantum_omega',
    name: 'Quantum Omega Sniper',
    executeStrategy: async (strategy) => {
      logger.info(`Quantum Omega executing strategy: ${strategy.name}`);
      // Implementation would connect to the Rust agent
      return {
        status: 'success',
        strategy: strategy.id,
        agent: 'quantum_omega',
        timestamp: new Date().toISOString(),
      };
    },
    isAvailable: () => true,
    getSupportedStrategies: () => [
      'memecoin-sniper-premium',
      'memecoin-liquidity-drain',
    ],
  },
  singularity: {
    id: 'singularity',
    name: 'Singularity Cross-Chain Oracle',
    executeStrategy: async (strategy) => {
      logger.info(`Singularity executing strategy: ${strategy.name}`);
      
      if (strategy.category === 'cross_chain') {
        // For cross-chain strategies, use the Wormhole client
        const opportunity = await wormholeClient.getBestArbitrageOpportunity();
        
        if (opportunity) {
          const result = await wormholeClient.executeArbitrage(
            opportunity,
            'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb' // System wallet
          );
          
          return {
            status: result.status === 'executed' ? 'success' : 'failed',
            strategy: strategy.id,
            agent: 'singularity',
            timestamp: new Date().toISOString(),
            opportunity,
            result,
          };
        } else {
          logger.info('No cross-chain arbitrage opportunities found');
          return {
            status: 'skipped',
            strategy: strategy.id,
            agent: 'singularity',
            timestamp: new Date().toISOString(),
            reason: 'No profitable opportunities found',
          };
        }
      }
      
      // For other strategies
      return {
        status: 'success',
        strategy: strategy.id,
        agent: 'singularity',
        timestamp: new Date().toISOString(),
      };
    },
    isAvailable: () => true,
    getSupportedStrategies: () => [
      'cross-chain-sol-eth',
      'cross-chain-sol-bsc',
    ],
  },
};

/**
 * The StrategyController class manages the activation and execution of trading strategies
 */
export class StrategyController {
  private activeStrategies: Strategy[] = [];
  private executionInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  
  constructor() {
    // Initialize with empty strategy set
  }
  
  /**
   * Initialize the controller with the top strategies
   */
  init(): void {
    this.selectAndActivateTopStrategies();
  }
  
  /**
   * Select and activate the top strategies
   * @param yieldCount - Number of strategies to select based on yield (default: 2)
   * @param successRateCount - Number of strategies to select based on success rate (default: 1)
   */
  selectAndActivateTopStrategies(
    yieldCount: number = 2,
    successRateCount: number = 1
  ): void {
    // Get environment variables if available (for testing purposes)
    const envYieldCount = process.env.YIELD_COUNT ? parseInt(process.env.YIELD_COUNT, 10) : yieldCount;
    const envSuccessRateCount = process.env.SUCCESS_RATE_COUNT ? parseInt(process.env.SUCCESS_RATE_COUNT, 10) : successRateCount;
    const envMinSuccessRate = process.env.MIN_SUCCESS_RATE ? parseInt(process.env.MIN_SUCCESS_RATE, 10) : 30;
    const envMinYield = process.env.MIN_YIELD ? parseInt(process.env.MIN_YIELD, 10) : 5;
    
    // Select top strategies
    this.activeStrategies = selectTopStrategies(
      envYieldCount,
      envSuccessRateCount,
      envMinSuccessRate,
      envMinYield
    );
    
    // Log the selected strategies
    logger.info(`Selected ${this.activeStrategies.length} top strategies for live trading`);
    
    for (const strategy of this.activeStrategies) {
      logger.info(`- ${strategy.name}`);
      logger.info(`  Agent: ${strategy.agent}, Yield: ${strategy.yield}%, Success Rate: ${strategy.successRate}%`);
      logger.info(`  Pairs: ${strategy.pairs.join(', ')}`);
      logger.info(`  DEXes: ${strategy.dexes.join(', ')}`);
    }
  }
  
  /**
   * Manually activate specific strategies by ID
   * @param strategyIds - Array of strategy IDs to activate
   */
  activateStrategies(strategyIds: string[]): void {
    for (const id of strategyIds) {
      const strategy = getStrategyById(id);
      
      if (strategy) {
        // Check if strategy is already active
        if (!this.activeStrategies.some(s => s.id === id)) {
          this.activeStrategies.push(strategy);
          logger.info(`Manually activated strategy: ${strategy.name}`);
        }
      } else {
        logger.warn(`Strategy not found: ${id}`);
      }
    }
  }
  
  /**
   * Deactivate specific strategies by ID
   * @param strategyIds - Array of strategy IDs to deactivate
   */
  deactivateStrategies(strategyIds: string[]): void {
    this.activeStrategies = this.activeStrategies.filter(strategy => {
      const shouldDeactivate = strategyIds.includes(strategy.id);
      
      if (shouldDeactivate) {
        logger.info(`Deactivated strategy: ${strategy.name}`);
      }
      
      return !shouldDeactivate;
    });
  }
  
  /**
   * Start strategy execution
   * @param intervalMs - Interval in milliseconds between strategy execution cycles
   */
  start(intervalMs: number = 60000): void {
    if (this.isRunning) {
      logger.info('Strategy controller is already running');
      return;
    }
    
    logger.info(`Starting strategy controller with ${this.activeStrategies.length} active strategies`);
    logger.info(`Execution interval: ${intervalMs}ms`);
    
    this.isRunning = true;
    
    // Execute strategies immediately once
    this.executeStrategies();
    
    // Set up interval for continuous execution
    this.executionInterval = setInterval(() => {
      this.executeStrategies();
    }, intervalMs);
  }
  
  /**
   * Stop strategy execution
   */
  stop(): void {
    if (!this.isRunning) {
      logger.info('Strategy controller is not running');
      return;
    }
    
    logger.info('Stopping strategy controller');
    
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }
    
    this.isRunning = false;
  }
  
  /**
   * Execute active strategies
   */
  private async executeStrategies(): Promise<void> {
    logger.info(`Executing ${this.activeStrategies.length} active strategies`);
    
    for (const strategy of this.activeStrategies) {
      const agent = agents[strategy.agent];
      
      if (agent && agent.isAvailable()) {
        try {
          logger.info(`Executing strategy: ${strategy.name} with agent: ${agent.name}`);
          
          // Execute the strategy
          const result = await agent.executeStrategy(strategy);
          
          // Log the result
          if (result.status === 'success') {
            logger.info(`Successfully executed strategy: ${strategy.name}`);
          } else if (result.status === 'failed') {
            logger.warn(`Failed to execute strategy: ${strategy.name}`);
            logger.warn(`Reason: ${result.reason || 'Unknown error'}`);
          } else if (result.status === 'skipped') {
            logger.info(`Skipped strategy execution: ${strategy.name}`);
            logger.info(`Reason: ${result.reason || 'Unknown reason'}`);
          }
        } catch (error) {
          logger.error(`Error executing strategy ${strategy.name}: ${error.message}`);
        }
      } else {
        logger.warn(`Agent ${strategy.agent} is not available for strategy: ${strategy.name}`);
      }
    }
  }
  
  /**
   * Get the current active strategies
   * @returns Array of active strategies
   */
  getActiveStrategies(): Strategy[] {
    return this.activeStrategies;
  }
  
  /**
   * Check if the controller is running
   * @returns Whether the controller is running
   */
  getStatus(): { running: boolean; strategiesCount: number } {
    return {
      running: this.isRunning,
      strategiesCount: this.activeStrategies.length,
    };
  }
}

// Create a singleton instance
export const strategyController = new StrategyController();