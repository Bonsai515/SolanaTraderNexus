/**
 * Dynamic Allocation Monitor
 * 
 * This script monitors strategy performance and dynamically
 * adjusts capital allocation to maximize overall returns.
 */

const fs = require('fs');
const path = require('path');

// Configuration paths
const SYSTEM_STATE_PATH = path.join('./data', 'system-state-memory.json');
const ALLOCATION_CONFIG_PATH = path.join('./data', 'dynamic-allocation-config.json');
const PERFORMANCE_LOG_PATH = path.join('./data', 'strategy-performance.json');

// Temporal Block Arbitrage strategy path
const TEMPORAL_STRATEGY_PATH = path.join('./data', 'temporal-block-arbitrage.json');
// Flash Loan Singularity strategy path
const SINGULARITY_STRATEGY_PATH = path.join('./data', 'flash-loan-singularity.json');
// Quantum Arbitrage strategy path
const QUANTUM_ARBITRAGE_PATH = path.join('./data', 'quantum-arbitrage.json');

// Track strategy performance
function trackStrategyPerformance() {
  try {
    console.log('Tracking strategy performance...');
    
    // Read system state
    const systemState = JSON.parse(fs.readFileSync(SYSTEM_STATE_PATH, 'utf8'));
    
    // Read performance log if it exists
    let performanceLog = {};
    if (fs.existsSync(PERFORMANCE_LOG_PATH)) {
      performanceLog = JSON.parse(fs.readFileSync(PERFORMANCE_LOG_PATH, 'utf8'));
    }
    
    // Calculate performance metrics for each strategy
    const strategies = [
      { name: "Temporal Block Arbitrage", path: TEMPORAL_STRATEGY_PATH },
      { name: "Flash Loan Singularity", path: SINGULARITY_STRATEGY_PATH },
      { name: "Quantum Arbitrage", path: QUANTUM_ARBITRAGE_PATH }
    ];
    
    // Update performance log
    performanceLog.lastUpdated = new Date().toISOString();
    performanceLog.strategies = performanceLog.strategies || {};
    
    // Determine best performing strategy based on profit and success rate
    let bestStrategy = null;
    let highestScore = -1;
    
    // Track strategies and find the best performer
    strategies.forEach(strategy => {
      if (fs.existsSync(strategy.path)) {
        try {
          const strategyConfig = JSON.parse(fs.readFileSync(strategy.path, 'utf8'));
          const performance = systemState.strategyPerformance[strategy.name] || { profitLast24h: 0, successRate: 0, trades: 0 };
          
          // Update performance log
          performanceLog.strategies[strategy.name] = performanceLog.strategies[strategy.name] || {
            history: []
          };
          
          // Add performance entry to history
          performanceLog.strategies[strategy.name].history.push({
            timestamp: new Date().toISOString(),
            profit: performance.profitLast24h,
            successRate: performance.successRate,
            trades: performance.trades
          });
          
          // Limit history to last 30 entries
          if (performanceLog.strategies[strategy.name].history.length > 30) {
            performanceLog.strategies[strategy.name].history.shift();
          }
          
          // Calculate performance score (profit × success rate)
          const score = performance.profitLast24h * (performance.successRate / 100);
          performanceLog.strategies[strategy.name].currentScore = score;
          
          // Check if this is the best strategy
          if (score > highestScore) {
            highestScore = score;
            bestStrategy = strategy.name;
          }
        } catch (err) {
          console.error(`Error processing strategy ${strategy.name}:`, err);
        }
      }
    });
    
    // Record best strategy
    performanceLog.bestStrategy = bestStrategy;
    performanceLog.bestStrategyScore = highestScore;
    
    // Save updated performance log
    fs.writeFileSync(PERFORMANCE_LOG_PATH, JSON.stringify(performanceLog, null, 2));
    console.log(`✅ Updated performance tracking. Best strategy: ${bestStrategy || 'None'}`);
    
    return { bestStrategy, highestScore };
  } catch (error) {
    console.error('Error tracking strategy performance:', error);
    return { bestStrategy: null, highestScore: -1 };
  }
}

// Adjust capital allocation based on performance
function adjustCapitalAllocation() {
  try {
    console.log('Adjusting capital allocation based on performance...');
    
    // Track performance and get best strategy
    const { bestStrategy, highestScore } = trackStrategyPerformance();
    if (!bestStrategy || highestScore < 0) {
      console.warn('No best strategy identified, keeping current allocation');
      return false;
    }
    
    // Read allocation config
    const allocationConfig = JSON.parse(fs.readFileSync(ALLOCATION_CONFIG_PATH, 'utf8'));
    if (!allocationConfig.enabled) {
      console.log('Dynamic allocation is disabled, skipping adjustment');
      return false;
    }
    
    // Read system state
    const systemState = JSON.parse(fs.readFileSync(SYSTEM_STATE_PATH, 'utf8'));
    const currentWeights = systemState.strategyWeights || {};
    
    // Get performance metrics for all strategies
    const strategyPerformance = systemState.strategyPerformance || {};
    
    // Calculate total performance score
    let totalScore = 0;
    const strategies = ["Temporal Block Arbitrage", "Flash Loan Singularity", "Quantum Arbitrage"];
    const scores = {};
    
    strategies.forEach(strategy => {
      const performance = strategyPerformance[strategy] || { profitLast24h: 0, successRate: 0 };
      // Calculate weighted score based on profit and success rate
      scores[strategy] = (performance.profitLast24h * allocationConfig.performanceMetrics.dailyProfitWeight) + 
                        (performance.successRate * allocationConfig.performanceMetrics.successRateWeight);
      
      // Add minimum score to ensure some allocation
      scores[strategy] = Math.max(scores[strategy], 0.1);
      totalScore += scores[strategy];
    });
    
    // Calculate new allocation percentages
    const newWeights = {};
    let remainingPercent = 100;
    let allocatedPercent = 0;
    
    // First, allocate to primary strategies
    strategies.forEach(strategy => {
      if (totalScore > 0) {
        // Calculate base allocation based on performance
        let allocation = Math.round((scores[strategy] / totalScore) * 85);
        
        // Apply strategy-specific limits
        const strategyPrefs = allocationConfig.strategyPreferences[strategy] || {};
        const minAllocation = strategyPrefs.minAllocationPercent || allocationConfig.limits.minAllocationPercent;
        let maxAllocation = strategyPrefs.maxAllocationPercent || allocationConfig.limits.maxAllocationPercent;
        
        // Boost allocation for best strategy
        if (strategy === bestStrategy && allocationConfig.capitalBoostSettings.enabled) {
          maxAllocation = allocationConfig.capitalBoostSettings.maxBoostAllocationPercent;
          allocation = Math.min(allocation * allocationConfig.capitalBoostSettings.boostMultiplier, maxAllocation);
        }
        
        // Ensure allocation is within limits
        allocation = Math.max(allocation, minAllocation);
        allocation = Math.min(allocation, maxAllocation);
        
        // Ensure we don't exceed 100% total
        allocation = Math.min(allocation, remainingPercent);
        
        newWeights[strategy] = allocation;
        allocatedPercent += allocation;
        remainingPercent -= allocation;
      } else {
        // If no performance data, use equal allocation
        newWeights[strategy] = Math.round(85 / strategies.length);
        allocatedPercent += newWeights[strategy];
        remainingPercent -= newWeights[strategy];
      }
    });
    
    // Allocate remaining percent to other strategies
    const otherStrategies = ["quantumOmega", "flashMinimal", "moneyGlitch", "hyperion"];
    otherStrategies.forEach(strategy => {
      if (remainingPercent > 0) {
        newWeights[strategy] = Math.round(remainingPercent / otherStrategies.length);
        allocatedPercent += newWeights[strategy];
        remainingPercent -= newWeights[strategy];
      } else {
        newWeights[strategy] = 0;
      }
    });
    
    // Ensure we allocate 100% by adjusting the best strategy
    if (allocatedPercent < 100 && bestStrategy) {
      newWeights[bestStrategy] += (100 - allocatedPercent);
    } else if (allocatedPercent < 100) {
      // If no best strategy, add to Temporal Block Arbitrage
      newWeights["Temporal Block Arbitrage"] += (100 - allocatedPercent);
    }
    
    // Update system state with new weights
    systemState.strategyWeights = newWeights;
    systemState.capitalAllocation.lastUpdated = new Date().toISOString();
    systemState.capitalAllocation.lastAdjustment = {
      bestStrategy,
      adjustmentReason: "Performance-based reallocation",
      timestamp: new Date().toISOString()
    };
    
    // Save updated system state
    fs.writeFileSync(SYSTEM_STATE_PATH, JSON.stringify(systemState, null, 2));
    
    console.log('✅ Updated capital allocation:');
    Object.keys(newWeights).forEach(strategy => {
      console.log(`   ${strategy}: ${newWeights[strategy]}%`);
    });
    console.log(`   Best performing strategy: ${bestStrategy} (boosted allocation)`);
    
    return true;
  } catch (error) {
    console.error('Error adjusting capital allocation:', error);
    return false;
  }
}

// Run the allocation adjustment
adjustCapitalAllocation();
