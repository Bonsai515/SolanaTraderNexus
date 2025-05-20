/**
 * Trade Frequency Optimizer
 * 
 * This module optimizes trading frequency across all strategies
 * while respecting RPC rate limits and ensuring system stability.
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

// Strategy configuration files
const STRATEGY_CONFIGS = {
  'Ultimate Nuclear': 'config/ultimate-nuclear-config.json',
  'Quantum Flash': 'config/quantum-flash-config.json',
  'MEV Protection': 'config/mev-protection-flash-config.json',
  'Zero Capital': 'config/zero-capital-flash-config.json',
  'Multi-Flash': 'config/quantum-multi-flash-config.json',
  'Temporal Block': 'config/temporal-block-arbitrage-config.json',
  'Hyperion Cascade': 'config/hyperion-cascade-flash-config.json'
};

// RPC providers and their rate limits
interface RpcProvider {
  name: string;
  maxRequestsPerSecond: number;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  optimizedBatchSize: number;
  priority: number; // Lower is higher priority
  healthCheckIntervalMs: number;
  retryDelayMs: number;
  maxRetries: number;
}

const RPC_PROVIDERS: RpcProvider[] = [
  {
    name: 'Syndica',
    maxRequestsPerSecond: 50,
    maxRequestsPerMinute: 2400,
    maxRequestsPerHour: 100000,
    optimizedBatchSize: 20,
    priority: 1,
    healthCheckIntervalMs: 60000, // 1 minute
    retryDelayMs: 500,
    maxRetries: 3
  },
  {
    name: 'Helius',
    maxRequestsPerSecond: 40,
    maxRequestsPerMinute: 1800,
    maxRequestsPerHour: 80000,
    optimizedBatchSize: 15,
    priority: 2,
    healthCheckIntervalMs: 120000, // 2 minutes
    retryDelayMs: 500,
    maxRetries: 3
  },
  {
    name: 'Triton',
    maxRequestsPerSecond: 30,
    maxRequestsPerMinute: 1200,
    maxRequestsPerHour: 50000,
    optimizedBatchSize: 10,
    priority: 3,
    healthCheckIntervalMs: 180000, // 3 minutes
    retryDelayMs: 1000,
    maxRetries: 2
  }
];

// Strategy RPC usage profiles
interface StrategyRpcProfile {
  name: string;
  requestsPerTrade: number;
  requestsPerCheck: number;
  checkIntervalMs: number;
  minTimeBetweenTradesMs: number;
  currentTimeBetweenTradesMs: number;
  tradeSuccessRate: number;
  profitPerTrade: number;
  activeHoursPerDay: number;
  maxDailyTrades: number;
}

// Initial strategy profiles
const INITIAL_STRATEGY_PROFILES: StrategyRpcProfile[] = [
  {
    name: 'Ultimate Nuclear',
    requestsPerTrade: 25,
    requestsPerCheck: 8,
    checkIntervalMs: 5000,
    minTimeBetweenTradesMs: 350000, // 5.8 minutes
    currentTimeBetweenTradesMs: 350000,
    tradeSuccessRate: 0.85,
    profitPerTrade: 0.0162, // SOL
    activeHoursPerDay: 24,
    maxDailyTrades: 10
  },
  {
    name: 'Quantum Flash',
    requestsPerTrade: 18,
    requestsPerCheck: 6,
    checkIntervalMs: 5000,
    minTimeBetweenTradesMs: 300000, // 5 minutes
    currentTimeBetweenTradesMs: 300000,
    tradeSuccessRate: 0.90,
    profitPerTrade: 0.0085, // SOL
    activeHoursPerDay: 24,
    maxDailyTrades: 12
  },
  {
    name: 'MEV Protection',
    requestsPerTrade: 22,
    requestsPerCheck: 7,
    checkIntervalMs: 4000,
    minTimeBetweenTradesMs: 320000, // 5.3 minutes
    currentTimeBetweenTradesMs: 320000,
    tradeSuccessRate: 0.88,
    profitPerTrade: 0.0078, // SOL
    activeHoursPerDay: 24,
    maxDailyTrades: 28
  },
  {
    name: 'Zero Capital',
    requestsPerTrade: 15,
    requestsPerCheck: 5,
    checkIntervalMs: 6000,
    minTimeBetweenTradesMs: 340000, // 5.7 minutes
    currentTimeBetweenTradesMs: 340000,
    tradeSuccessRate: 0.92,
    profitPerTrade: 0.0045, // SOL
    activeHoursPerDay: 24,
    maxDailyTrades: 32
  },
  {
    name: 'Multi-Flash',
    requestsPerTrade: 30,
    requestsPerCheck: 10,
    checkIntervalMs: 5000,
    minTimeBetweenTradesMs: 280000, // 4.7 minutes
    currentTimeBetweenTradesMs: 280000,
    tradeSuccessRate: 0.85,
    profitPerTrade: 0.0113, // SOL
    activeHoursPerDay: 24,
    maxDailyTrades: 18
  },
  {
    name: 'Temporal Block',
    requestsPerTrade: 28,
    requestsPerCheck: 9,
    checkIntervalMs: 3800,
    minTimeBetweenTradesMs: 280000, // 4.7 minutes
    currentTimeBetweenTradesMs: 280000,
    tradeSuccessRate: 0.80,
    profitPerTrade: 0.0125, // SOL
    activeHoursPerDay: 24,
    maxDailyTrades: 24
  },
  {
    name: 'Hyperion Cascade',
    requestsPerTrade: 40,
    requestsPerCheck: 12,
    checkIntervalMs: 4800,
    minTimeBetweenTradesMs: 295000, // 4.9 minutes
    currentTimeBetweenTradesMs: 295000,
    tradeSuccessRate: 0.78,
    profitPerTrade: 0.0195, // SOL
    activeHoursPerDay: 24,
    maxDailyTrades: 24
  }
];

// System parameters
const SYSTEM_PARAMETERS = {
  safetyBuffer: 0.75, // Use only 75% of available RPC capacity
  minTradeInterval: 90000, // 1.5 minutes minimum between trades (regardless of strategy)
  maxTradeInterval: 900000, // 15 minutes maximum between trades (prevents stagnation)
  strategyPrioritization: 'profit', // 'profit', 'success', 'balanced'
  loadBalancingMode: 'adaptive', // 'static', 'adaptive', 'time-of-day'
  requestsReservedForBackgroundTasks: 500, // per hour
  preferredActiveHours: { // Hour ranges when we prefer to trade more
    start: 1, // 1 AM UTC
    end: 6 // 6 AM UTC
  },
  optimizationCheckIntervalMs: 3600000, // 1 hour
  applyChangesImmediately: true, // Apply changes immediately or wait for restart
  logChanges: true // Log configuration changes
};

// Strategy profiles (will be loaded from existing configs or defaults)
let strategyProfiles: StrategyRpcProfile[] = [];

/**
 * Initialize strategy profiles
 */
function initializeStrategyProfiles(): void {
  console.log('Initializing strategy profiles...');
  
  // Start with initial profiles
  strategyProfiles = JSON.parse(JSON.stringify(INITIAL_STRATEGY_PROFILES));
  
  // Try to load from existing configs
  for (const profile of strategyProfiles) {
    const configPath = STRATEGY_CONFIGS[profile.name];
    
    if (configPath && fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        // Update profile with values from config
        if (config.checkIntervalMs !== undefined) {
          profile.checkIntervalMs = config.checkIntervalMs;
        }
        
        if (config.minTimeBetweenTradesMs !== undefined) {
          profile.minTimeBetweenTradesMs = config.minTimeBetweenTradesMs;
          profile.currentTimeBetweenTradesMs = config.minTimeBetweenTradesMs;
        }
        
        if (config.maxDailyTransactions !== undefined) {
          profile.maxDailyTrades = config.maxDailyTransactions;
        }
        
        console.log(`Loaded profile for ${profile.name} from ${configPath}`);
      } catch (error) {
        console.error(`Error loading config for ${profile.name}: ${error}`);
      }
    }
  }
  
  console.log('Strategy profiles initialized');
}

/**
 * Calculate total RPC usage based on current settings
 */
function calculateTotalRpcUsage(): {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
} {
  let requestsPerMinute = 0;
  let requestsPerHour = 0;
  
  // Calculate requests from regular strategy checks
  for (const profile of strategyProfiles) {
    // How many checks per minute
    const checksPerMinute = 60000 / profile.checkIntervalMs;
    // Requests per minute from checks
    requestsPerMinute += checksPerMinute * profile.requestsPerCheck;
    
    // Calculate trades per hour based on currentTimeBetweenTradesMs
    const tradesPerHour = Math.min(
      (3600000 / profile.currentTimeBetweenTradesMs),
      profile.maxDailyTrades / 24 * profile.activeHoursPerDay
    );
    
    // Requests per hour from trades
    requestsPerHour += tradesPerHour * profile.requestsPerTrade;
  }
  
  // Add requests per hour from checks
  requestsPerHour += requestsPerMinute * 60;
  
  // Add reserved requests for background tasks
  requestsPerHour += SYSTEM_PARAMETERS.requestsReservedForBackgroundTasks;
  
  // Calculate requests per second (peak)
  const requestsPerSecond = requestsPerMinute / 60;
  
  return {
    requestsPerSecond,
    requestsPerMinute,
    requestsPerHour
  };
}

/**
 * Calculate the maximum RPC capacity based on available providers
 */
function calculateMaxRpcCapacity(): {
  maxRequestsPerSecond: number;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
} {
  // Sort providers by priority
  const sortedProviders = [...RPC_PROVIDERS].sort((a, b) => a.priority - b.priority);
  
  // Sum up the capacities
  let maxRequestsPerSecond = 0;
  let maxRequestsPerMinute = 0;
  let maxRequestsPerHour = 0;
  
  for (const provider of sortedProviders) {
    maxRequestsPerSecond += provider.maxRequestsPerSecond;
    maxRequestsPerMinute += provider.maxRequestsPerMinute;
    maxRequestsPerHour += provider.maxRequestsPerHour;
  }
  
  // Apply safety buffer
  maxRequestsPerSecond *= SYSTEM_PARAMETERS.safetyBuffer;
  maxRequestsPerMinute *= SYSTEM_PARAMETERS.safetyBuffer;
  maxRequestsPerHour *= SYSTEM_PARAMETERS.safetyBuffer;
  
  return {
    maxRequestsPerSecond,
    maxRequestsPerMinute,
    maxRequestsPerHour
  };
}

/**
 * Optimize strategy trade intervals based on RPC constraints
 */
function optimizeTradeIntervals(): void {
  console.log('Optimizing trade intervals...');
  
  // Calculate current usage
  const currentUsage = calculateTotalRpcUsage();
  
  // Calculate maximum capacity
  const maxCapacity = calculateMaxRpcCapacity();
  
  console.log('Current RPC usage:');
  console.log(`  Requests per second: ${currentUsage.requestsPerSecond.toFixed(2)}`);
  console.log(`  Requests per minute: ${currentUsage.requestsPerMinute.toFixed(2)}`);
  console.log(`  Requests per hour: ${currentUsage.requestsPerHour.toFixed(2)}`);
  
  console.log('Maximum RPC capacity (with safety buffer):');
  console.log(`  Requests per second: ${maxCapacity.maxRequestsPerSecond.toFixed(2)}`);
  console.log(`  Requests per minute: ${maxCapacity.maxRequestsPerMinute.toFixed(2)}`);
  console.log(`  Requests per hour: ${maxCapacity.maxRequestsPerHour.toFixed(2)}`);
  
  // Check if we're over capacity
  const isOverCapacity = 
    currentUsage.requestsPerSecond > maxCapacity.maxRequestsPerSecond ||
    currentUsage.requestsPerMinute > maxCapacity.maxRequestsPerMinute ||
    currentUsage.requestsPerHour > maxCapacity.maxRequestsPerHour;
  
  // Check if we have significant spare capacity (more than 20% available)
  const hourlyCapacityUsage = currentUsage.requestsPerHour / maxCapacity.maxRequestsPerHour;
  const hasSpareCapacity = hourlyCapacityUsage < 0.8;
  
  if (isOverCapacity) {
    console.log('System is over RPC capacity. Increasing trade intervals to reduce load...');
    increaseTradeIntervals(currentUsage, maxCapacity);
  } else if (hasSpareCapacity) {
    console.log('System has spare RPC capacity. Decreasing trade intervals to increase frequency...');
    decreaseTradeIntervals(currentUsage, maxCapacity);
  } else {
    console.log('System is operating at optimal RPC capacity. No changes needed.');
  }
  
  // Log the updated strategy profiles
  console.log('\nUpdated strategy trade intervals:');
  for (const profile of strategyProfiles) {
    const tradesPerDay = (24 * 3600000) / profile.currentTimeBetweenTradesMs;
    console.log(`  ${profile.name}: ${(profile.currentTimeBetweenTradesMs / 60000).toFixed(1)} minutes between trades (${Math.min(tradesPerDay, profile.maxDailyTrades).toFixed(1)} trades/day)`);
  }
}

/**
 * Increase trade intervals to reduce RPC load
 */
function increaseTradeIntervals(
  currentUsage: { requestsPerSecond: number; requestsPerMinute: number; requestsPerHour: number; },
  maxCapacity: { maxRequestsPerSecond: number; maxRequestsPerMinute: number; maxRequestsPerHour: number; }
): void {
  // Calculate how much we need to reduce
  const hourlyReductionNeeded = Math.max(
    0,
    (currentUsage.requestsPerHour - maxCapacity.maxRequestsPerHour) / currentUsage.requestsPerHour
  );
  
  // Sort strategies by priority for adjustment (least important first)
  const profilesByPriority = getPrioritizedStrategies().reverse();
  
  // Track total reduction achieved
  let reductionAchieved = 0;
  const reductionTarget = hourlyReductionNeeded;
  
  // Adjust trade intervals starting with lowest priority strategies
  for (const profile of profilesByPriority) {
    if (reductionAchieved >= reductionTarget) {
      break; // We've achieved our target reduction
    }
    
    // Calculate trades per hour for this strategy
    const currentTradesPerHour = Math.min(
      3600000 / profile.currentTimeBetweenTradesMs,
      profile.maxDailyTrades / 24
    );
    
    // Calculate requests per hour from this strategy's trades
    const requestsPerHour = currentTradesPerHour * profile.requestsPerTrade;
    
    // Calculate what percentage of total requests this strategy represents
    const percentageOfTotal = requestsPerHour / currentUsage.requestsPerHour;
    
    // Calculate how much this strategy should reduce (proportional to its share)
    const strategyReductionTarget = Math.min(
      hourlyReductionNeeded * 1.2, // Allow for 20% more reduction if needed
      percentageOfTotal * 2 // But limit to 2x its share to avoid unfair burden
    );
    
    if (strategyReductionTarget > 0) {
      // Calculate new trade interval
      const currentInterval = profile.currentTimeBetweenTradesMs;
      const newInterval = Math.min(
        currentInterval * (1 + strategyReductionTarget),
        SYSTEM_PARAMETERS.maxTradeInterval
      );
      
      // Ensure we don't go below minimum trade interval
      const finalInterval = Math.max(newInterval, profile.minTimeBetweenTradesMs);
      
      // Calculate reduction achieved
      const oldTradesPerHour = 3600000 / currentInterval;
      const newTradesPerHour = 3600000 / finalInterval;
      const achievedReduction = (oldTradesPerHour - newTradesPerHour) * profile.requestsPerTrade / currentUsage.requestsPerHour;
      
      // Update the profile
      profile.currentTimeBetweenTradesMs = finalInterval;
      
      // Track reduction
      reductionAchieved += achievedReduction;
      
      if (SYSTEM_PARAMETERS.logChanges) {
        console.log(`  Increased ${profile.name} trade interval from ${(currentInterval / 60000).toFixed(1)} to ${(finalInterval / 60000).toFixed(1)} minutes`);
      }
    }
  }
  
  console.log(`  Achieved ${(reductionAchieved * 100).toFixed(1)}% reduction in RPC usage (target: ${(reductionTarget * 100).toFixed(1)}%)`);
}

/**
 * Decrease trade intervals to increase trading frequency
 */
function decreaseTradeIntervals(
  currentUsage: { requestsPerSecond: number; requestsPerMinute: number; requestsPerHour: number; },
  maxCapacity: { maxRequestsPerSecond: number; maxRequestsPerMinute: number; maxRequestsPerHour: number; }
): void {
  // Calculate how much we can increase
  const spareCapacity = maxCapacity.maxRequestsPerHour - currentUsage.requestsPerHour;
  const increasePercentage = spareCapacity / currentUsage.requestsPerHour;
  
  // Limit increase to 50% at a time for stability
  const cappedIncreasePercentage = Math.min(increasePercentage, 0.5);
  
  // Don't bother with tiny increases
  if (cappedIncreasePercentage < 0.05) {
    console.log('  Spare capacity too small for meaningful adjustment. No changes made.');
    return;
  }
  
  // Sort strategies by priority for adjustment (most important first)
  const profilesByPriority = getPrioritizedStrategies();
  
  // Track how much of the spare capacity we've allocated
  let capacityAllocated = 0;
  
  // Adjust trade intervals starting with highest priority strategies
  for (const profile of profilesByPriority) {
    if (capacityAllocated >= spareCapacity * 0.9) {
      break; // We've allocated most of the spare capacity
    }
    
    // Calculate current requests per hour from this strategy
    const currentTradesPerHour = Math.min(
      3600000 / profile.currentTimeBetweenTradesMs,
      profile.maxDailyTrades / 24
    );
    const currentRequestsPerHour = currentTradesPerHour * profile.requestsPerTrade;
    
    // Calculate how much this strategy can increase
    const maxPossibleTradesPerHour = profile.maxDailyTrades / 24;
    const currentLimitedByInterval = currentTradesPerHour < maxPossibleTradesPerHour;
    
    if (currentLimitedByInterval) {
      // Calculate how much to decrease the interval
      const decreaseFactor = 1 - Math.min(cappedIncreasePercentage, 0.3); // Max 30% decrease at once
      const newInterval = Math.max(
        profile.currentTimeBetweenTradesMs * decreaseFactor,
        SYSTEM_PARAMETERS.minTradeInterval,
        profile.minTimeBetweenTradesMs * 0.8 // Allow up to 20% below minimum for high-priority strategies
      );
      
      // Calculate the new trades per hour
      const newTradesPerHour = Math.min(3600000 / newInterval, maxPossibleTradesPerHour);
      const newRequestsPerHour = newTradesPerHour * profile.requestsPerTrade;
      
      // Calculate capacity being allocated
      const additionalRequests = newRequestsPerHour - currentRequestsPerHour;
      
      if (additionalRequests > 0 && capacityAllocated + additionalRequests <= spareCapacity) {
        // Update the profile
        profile.currentTimeBetweenTradesMs = newInterval;
        
        // Track allocation
        capacityAllocated += additionalRequests;
        
        if (SYSTEM_PARAMETERS.logChanges) {
          console.log(`  Decreased ${profile.name} trade interval from ${(profile.currentTimeBetweenTradesMs / 60000).toFixed(1)} to ${(newInterval / 60000).toFixed(1)} minutes`);
        }
      }
    }
  }
  
  console.log(`  Allocated ${capacityAllocated.toFixed(0)} requests per hour from spare capacity (${(capacityAllocated / spareCapacity * 100).toFixed(1)}%)`);
}

/**
 * Get strategies sorted by priority based on the prioritization mode
 */
function getPrioritizedStrategies(): StrategyRpcProfile[] {
  const mode = SYSTEM_PARAMETERS.strategyPrioritization;
  
  if (mode === 'profit') {
    // Sort by profit per trade (highest first)
    return [...strategyProfiles].sort((a, b) => 
      (b.profitPerTrade * b.tradeSuccessRate) - (a.profitPerTrade * a.tradeSuccessRate)
    );
  } else if (mode === 'success') {
    // Sort by success rate (highest first)
    return [...strategyProfiles].sort((a, b) => b.tradeSuccessRate - a.tradeSuccessRate);
  } else {
    // 'balanced' - sort by a combination of profit and success
    return [...strategyProfiles].sort((a, b) => 
      (b.profitPerTrade * Math.sqrt(b.tradeSuccessRate)) - 
      (a.profitPerTrade * Math.sqrt(a.tradeSuccessRate))
    );
  }
}

/**
 * Apply optimized settings to strategy configuration files
 */
function applyOptimizedSettings(): void {
  console.log('Applying optimized settings to strategy configuration files...');
  
  for (const profile of strategyProfiles) {
    const configPath = STRATEGY_CONFIGS[profile.name];
    
    if (configPath && fs.existsSync(configPath)) {
      try {
        // Read existing config
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        // Update trade interval
        config.minTimeBetweenTradesMs = profile.currentTimeBetweenTradesMs;
        
        // Update check interval to ensure enough checks between trades
        // (at least 5 checks between trades)
        const targetCheckInterval = profile.currentTimeBetweenTradesMs / 5;
        config.checkIntervalMs = Math.min(
          profile.checkIntervalMs, // Don't increase check interval
          targetCheckInterval // Set to target if current is higher
        );
        
        // Save updated config
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        console.log(`  Updated ${profile.name} configuration in ${configPath}`);
      } catch (error) {
        console.error(`  Error updating config for ${profile.name}: ${error}`);
      }
    } else {
      console.warn(`  Config file not found for ${profile.name}: ${configPath}`);
    }
  }
  
  console.log('Configuration updates complete');
}

/**
 * Calculate projected daily profits based on current settings
 */
function calculateProjectedProfits(): void {
  let totalDailyProfit = 0;
  
  console.log('\nProjected Daily Profits:');
  
  for (const profile of strategyProfiles) {
    // Calculate trades per day
    const rawTradesPerDay = (24 * 3600000) / profile.currentTimeBetweenTradesMs;
    const limitedTradesPerDay = Math.min(rawTradesPerDay, profile.maxDailyTrades);
    
    // Calculate successful trades
    const successfulTrades = limitedTradesPerDay * profile.tradeSuccessRate;
    
    // Calculate profit
    const dailyProfit = successfulTrades * profile.profitPerTrade;
    
    // Add to total
    totalDailyProfit += dailyProfit;
    
    // Log for this strategy
    console.log(`  ${profile.name}: ${successfulTrades.toFixed(1)} successful trades, ${dailyProfit.toFixed(6)} SOL profit`);
  }
  
  // Calculate USD value at current SOL price
  const solPriceUSD = 150; // Current SOL price estimate
  const dailyProfitUSD = totalDailyProfit * solPriceUSD;
  
  // Calculate monthly and yearly projections
  const monthlyProfit = totalDailyProfit * 30;
  const monthlyProfitUSD = dailyProfitUSD * 30;
  const yearlyProfit = totalDailyProfit * 365;
  const yearlyProfitUSD = dailyProfitUSD * 365;
  
  console.log('\nTotal Projected Profits:');
  console.log(`  Daily: ${totalDailyProfit.toFixed(6)} SOL ($${dailyProfitUSD.toFixed(2)})`);
  console.log(`  Monthly: ${monthlyProfit.toFixed(6)} SOL ($${monthlyProfitUSD.toFixed(2)})`);
  console.log(`  Yearly: ${yearlyProfit.toFixed(6)} SOL ($${yearlyProfitUSD.toFixed(2)})`);
}

/**
 * Create restart script for all strategies
 */
function createRestartScript(): void {
  console.log('Creating restart script for all strategies...');
  
  const scriptContent = `#!/bin/bash
# Restart all trading strategies with optimized configurations

echo "Stopping current trading strategies..."
# Find and kill current strategy processes
pkill -f "ultimate-nuclear-strategy.ts" || true
pkill -f "quantum-flash-strategy.ts" || true
pkill -f "zero-capital-flash-strategy.ts" || true
pkill -f "mev-protection-flash-strategy.ts" || true
pkill -f "quantum-multi-flash-strategy.ts" || true
pkill -f "temporal-block-arbitrage-strategy.ts" || true
pkill -f "hyperion-cascade-flash-strategy.ts" || true

echo "Waiting for processes to terminate..."
sleep 5

echo "Starting strategies with optimized configurations..."
npx tsx ultimate-nuclear-strategy.ts > logs/ultimate-nuclear-\$(date +%Y%m%d%H%M%S).log 2>&1 &
echo "Ultimate Nuclear strategy started with PID: $!"

sleep 3

npx tsx quantum-flash-strategy.ts > logs/quantum-flash-\$(date +%Y%m%d%H%M%S).log 2>&1 &
echo "Quantum Flash strategy started with PID: $!"

sleep 3

npx tsx zero-capital-flash-strategy.ts > logs/zero-capital-\$(date +%Y%m%d%H%M%S).log 2>&1 &
echo "Zero Capital Flash strategy started with PID: $!"

sleep 3

npx tsx mev-protection-flash-strategy.ts > logs/mev-protection-\$(date +%Y%m%d%H%M%S).log 2>&1 &
echo "MEV Protection Flash strategy started with PID: $!"

sleep 3

npx tsx quantum-multi-flash-strategy.ts > logs/multi-flash-\$(date +%Y%m%d%H%M%S).log 2>&1 &
echo "Quantum Multi-Flash strategy started with PID: $!"

sleep 3

npx tsx temporal-block-arbitrage-strategy.ts > logs/temporal-block-\$(date +%Y%m%d%H%M%S).log 2>&1 &
echo "Temporal Block Arbitrage strategy started with PID: $!"

sleep 3

npx tsx hyperion-cascade-flash-strategy.ts > logs/hyperion-cascade-\$(date +%Y%m%d%H%M%S).log 2>&1 &
echo "Hyperion Cascade Flash strategy started with PID: $!"

echo "All strategies restarted with optimized configurations."
echo "Monitor logs in the logs directory for performance."
`;

  const scriptPath = 'restart-optimized-strategies.sh';
  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(scriptPath, 0o755); // Make executable
  
  console.log(`Created restart script: ${scriptPath}`);
}

/**
 * Create configuration for enhanced RPC management
 */
function updateRpcConfiguration(): void {
  console.log('Updating RPC configuration...');
  
  const rpcConfig = {
    primaryProvider: RPC_PROVIDERS[0].name,
    secondaryProvider: RPC_PROVIDERS[1].name,
    tertiaryProvider: RPC_PROVIDERS[2].name,
    healthCheckIntervalMs: Math.min(...RPC_PROVIDERS.map(p => p.healthCheckIntervalMs)),
    maxConsecutiveFailures: 2,
    loadBalancingStrategy: 'priority',
    maxRequestsPerSecond: RPC_PROVIDERS.reduce((sum, p) => sum + p.maxRequestsPerSecond, 0),
    retryDelayMs: RPC_PROVIDERS[0].retryDelayMs,
    maxRetries: RPC_PROVIDERS[0].maxRetries,
    optimizedBatchSize: RPC_PROVIDERS[0].optimizedBatchSize,
    useBatchRequests: true,
    cacheTimeMs: 5000, // 5 seconds
    requestTimeout: 30000 // 30 seconds
  };
  
  // Save RPC configuration
  const configPath = 'config/rpc-config.json';
  fs.writeFileSync(configPath, JSON.stringify(rpcConfig, null, 2));
  
  console.log(`Updated RPC configuration in ${configPath}`);
}

/**
 * Main function
 */
function main(): void {
  console.log('===== TRADE FREQUENCY OPTIMIZER =====');
  
  // Create config directory if needed
  if (!fs.existsSync('config')) {
    fs.mkdirSync('config');
  }
  
  // Initialize strategy profiles
  initializeStrategyProfiles();
  
  // Optimize trade intervals
  optimizeTradeIntervals();
  
  // Calculate projected profits
  calculateProjectedProfits();
  
  // Apply optimized settings
  if (SYSTEM_PARAMETERS.applyChangesImmediately) {
    applyOptimizedSettings();
    updateRpcConfiguration();
    createRestartScript();
    
    console.log('\nOptimizations complete!');
    console.log('To apply the new settings, run: ./restart-optimized-strategies.sh');
  } else {
    console.log('\nOptimizations calculated but not applied. Add --apply to apply changes.');
  }
}

// Run the main function
main();