/**
 * Strategy Selector
 * 
 * This module selects the best strategies for live trading based on
 * yield and success rate metrics.
 */

import { logger } from './logger';

// Strategy type definition
export interface Strategy {
  id: string;
  name: string;
  description: string;
  agent: string;
  transformer: string;
  yield: number;  // Yield percentage
  successRate: number;  // Success rate percentage
  minInputAmount: number;
  maxInputAmount: number;
  minProfitPercentage: number;
  gasPriceMultiplier: number;
  pairs: string[];
  dexes: string[];
  active: boolean;
  lastExecuted?: Date;
  executionCount: number;
  totalProfit: number;
  avgExecutionTime: number;
  category: 'arbitrage' | 'flash_loan' | 'memecoin' | 'cross_chain' | 'lending';
}

// Sample strategies with realistic metrics
const strategies: Strategy[] = [
  {
    id: 'flash-arb-raydium-orca',
    name: 'Flash Arbitrage: Raydium-Orca',
    description: 'Flash loan arbitrage between Raydium and Orca DEXes',
    agent: 'hyperion',
    transformer: 'microqhc',
    yield: 12.5,
    successRate: 92.3,
    minInputAmount: 0.1,
    maxInputAmount: 10,
    minProfitPercentage: 0.25,
    gasPriceMultiplier: 1.2,
    pairs: ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'],
    dexes: ['Raydium', 'Orca'],
    active: true,
    executionCount: 128,
    totalProfit: 24.56,
    avgExecutionTime: 1240,
    category: 'flash_loan',
  },
  {
    id: 'flash-arb-jupiter-openbook',
    name: 'Flash Arbitrage: Jupiter-Openbook',
    description: 'Flash loan arbitrage between Jupiter and Openbook DEXes',
    agent: 'hyperion',
    transformer: 'microqhc',
    yield: 18.7,
    successRate: 87.1,
    minInputAmount: 0.2,
    maxInputAmount: 15,
    minProfitPercentage: 0.3,
    gasPriceMultiplier: 1.3,
    pairs: ['SOL/USDC', 'BONK/USDC', 'JUP/USDC', 'RAY/USDC'],
    dexes: ['Jupiter', 'Openbook'],
    active: true,
    executionCount: 96,
    totalProfit: 32.18,
    avgExecutionTime: 1150,
    category: 'flash_loan',
  },
  {
    id: 'memecoin-sniper-premium',
    name: 'Memecoin Sniper Premium',
    description: 'Advanced memecoin sniping with social sentiment correlation',
    agent: 'quantum_omega',
    transformer: 'meme_cortex',
    yield: 215.8,
    successRate: 42.7,
    minInputAmount: 0.05,
    maxInputAmount: 2,
    minProfitPercentage: 5.0,
    gasPriceMultiplier: 1.5,
    pairs: ['BONK/USDC', 'WIF/USDC', 'POPCAT/USDC', 'SLERF/USDC'],
    dexes: ['Raydium', 'Jupiter', 'Meteora'],
    active: true,
    executionCount: 64,
    totalProfit: 126.45,
    avgExecutionTime: 950,
    category: 'memecoin',
  },
  {
    id: 'memecoin-liquidity-drain',
    name: 'Memecoin Liquidity Drain',
    description: 'Memecoin liquidity pool monitoring and strategic extraction',
    agent: 'quantum_omega',
    transformer: 'meme_cortex',
    yield: 175.2,
    successRate: 38.4,
    minInputAmount: 0.1,
    maxInputAmount: 3,
    minProfitPercentage: 7.0,
    gasPriceMultiplier: 1.6,
    pairs: ['BONK/USDC', 'WIF/USDC', 'BOME/USDC', 'SLERF/USDC'],
    dexes: ['Raydium', 'Meteora', 'Dexlab'],
    active: true,
    executionCount: 52,
    totalProfit: 148.72,
    avgExecutionTime: 1050,
    category: 'memecoin',
  },
  {
    id: 'cross-chain-sol-eth',
    name: 'Cross-Chain Arbitrage: SOL-ETH',
    description: 'Cross-chain arbitrage between Solana and Ethereum',
    agent: 'singularity',
    transformer: 'microqhc',
    yield: 8.3,
    successRate: 96.5,
    minInputAmount: 0.5,
    maxInputAmount: 20,
    minProfitPercentage: 0.5,
    gasPriceMultiplier: 1.2,
    pairs: ['SOL/USDC', 'WETH/USDC'],
    dexes: ['Jupiter', 'Wormhole'],
    active: true,
    executionCount: 38,
    totalProfit: 16.42,
    avgExecutionTime: 15000,
    category: 'cross_chain',
  },
  {
    id: 'cross-chain-sol-bsc',
    name: 'Cross-Chain Arbitrage: SOL-BSC',
    description: 'Cross-chain arbitrage between Solana and Binance Smart Chain',
    agent: 'singularity',
    transformer: 'microqhc',
    yield: 12.8,
    successRate: 94.2,
    minInputAmount: 0.3,
    maxInputAmount: 15,
    minProfitPercentage: 0.6,
    gasPriceMultiplier: 1.3,
    pairs: ['SOL/USDC', 'WBNB/USDC'],
    dexes: ['Jupiter', 'Wormhole'],
    active: true,
    executionCount: 46,
    totalProfit: 22.15,
    avgExecutionTime: 18000,
    category: 'cross_chain',
  },
  {
    id: 'lending-protocol-arbitrage',
    name: 'Lending Protocol Arbitrage',
    description: 'Arbitrage between lending protocols like Solend, MarginFi, and Jet',
    agent: 'hyperion',
    transformer: 'microqhc',
    yield: 5.4,
    successRate: 98.7,
    minInputAmount: 1.0,
    maxInputAmount: 50,
    minProfitPercentage: 0.15,
    gasPriceMultiplier: 1.1,
    pairs: ['SOL/USDC', 'USDT/USDC'],
    dexes: ['Solend', 'MarginFi', 'Jet'],
    active: true,
    executionCount: 215,
    totalProfit: 28.34,
    avgExecutionTime: 2100,
    category: 'lending',
  },
];

/**
 * Select the top strategies based on yield and success rate
 * @param yieldCount - Number of strategies to select based on yield
 * @param successRateCount - Number of strategies to select based on success rate
 * @param minSuccessRate - Minimum success rate required for all strategies
 * @param minYield - Minimum yield required for all strategies
 * @returns Selected strategies
 */
export function selectTopStrategies(
  yieldCount: number = 2,
  successRateCount: number = 1,
  minSuccessRate: number = 30,
  minYield: number = 5
): Strategy[] {
  logger.info(`Selecting top ${yieldCount} strategies by yield and top ${successRateCount} by success rate`);
  
  // Filter strategies that meet minimum requirements
  const validStrategies = strategies.filter(
    s => s.active && s.successRate >= minSuccessRate && s.yield >= minYield
  );
  
  if (validStrategies.length === 0) {
    logger.warn('No strategies meet the minimum requirements');
    return [];
  }
  
  // Sort by yield (descending)
  const topYieldStrategies = [...validStrategies]
    .sort((a, b) => b.yield - a.yield)
    .slice(0, yieldCount);
  
  // Sort by success rate (descending)
  const topSuccessRateStrategies = [...validStrategies]
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, successRateCount);
  
  // Combine and deduplicate
  const selectedStrategies = [...topYieldStrategies];
  
  for (const strategy of topSuccessRateStrategies) {
    // Check if strategy is already included (by ID)
    if (!selectedStrategies.some(s => s.id === strategy.id)) {
      selectedStrategies.push(strategy);
    }
  }
  
  // Log selected strategies
  logger.info(`Selected ${selectedStrategies.length} strategies for live trading`);
  selectedStrategies.forEach(s => {
    logger.info(`- ${s.name} (yield: ${s.yield}%, success rate: ${s.successRate}%)`);
  });
  
  return selectedStrategies;
}

/**
 * Get all available strategies
 * @returns All strategies
 */
export function getAllStrategies(): Strategy[] {
  return strategies;
}

/**
 * Get a strategy by ID
 * @param id - Strategy ID
 * @returns Strategy or undefined if not found
 */
export function getStrategyById(id: string): Strategy | undefined {
  return strategies.find(s => s.id === id);
}

/**
 * Activate strategies
 * @param strategyIds - Array of strategy IDs to activate
 * @returns Activated strategies
 */
export function activateStrategies(strategyIds: string[]): Strategy[] {
  const activated: Strategy[] = [];
  
  for (const id of strategyIds) {
    const strategy = strategies.find(s => s.id === id);
    
    if (strategy) {
      strategy.active = true;
      activated.push(strategy);
      logger.info(`Activated strategy: ${strategy.name}`);
    }
  }
  
  return activated;
}

/**
 * Deactivate strategies
 * @param strategyIds - Array of strategy IDs to deactivate
 * @returns Deactivated strategies
 */
export function deactivateStrategies(strategyIds: string[]): Strategy[] {
  const deactivated: Strategy[] = [];
  
  for (const id of strategyIds) {
    const strategy = strategies.find(s => s.id === id);
    
    if (strategy) {
      strategy.active = false;
      deactivated.push(strategy);
      logger.info(`Deactivated strategy: ${strategy.name}`);
    }
  }
  
  return deactivated;
}

/**
 * Get strategies by agent
 * @param agentId - Agent ID
 * @returns Strategies for the specified agent
 */
export function getStrategiesByAgent(agentId: string): Strategy[] {
  return strategies.filter(s => s.agent === agentId);
}

/**
 * Get strategies by transformer
 * @param transformerId - Transformer ID
 * @returns Strategies for the specified transformer
 */
export function getStrategiesByTransformer(transformerId: string): Strategy[] {
  return strategies.filter(s => s.transformer === transformerId);
}

/**
 * Get active strategies
 * @returns Active strategies
 */
export function getActiveStrategies(): Strategy[] {
  return strategies.filter(s => s.active);
}