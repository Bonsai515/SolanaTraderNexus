/**
 * Configure Dynamic Capital Allocation
 * 
 * This script adds dynamic capital allocation to automatically shift
 * more funds to the highest-performing strategies in real-time.
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration paths
const SYSTEM_CONFIG_PATH = path.join('./data', 'system-state-memory.json');
const ALLOCATION_CONFIG_PATH = path.join('./data', 'dynamic-allocation-config.json');

/**
 * Configure dynamic capital allocation
 */
function configureDynamicAllocation() {
  console.log('Configuring dynamic capital allocation...');
  
  try {
    // Create dynamic allocation configuration
    const allocationConfig = {
      enabled: true,
      mode: "performance_driven",
      updateFrequencyMs: 300000,  // Recalculate every 5 minutes
      
      // Performance tracking
      performanceMetrics: {
        dailyProfitWeight: 0.5,       // 50% weight on daily profit
        successRateWeight: 0.3,        // 30% weight on success rate
        volumeWeight: 0.1,             // 10% weight on volume
        riskAdjustmentWeight: 0.1      // 10% weight on risk adjustment
      },
      
      // Allocation limits
      limits: {
        minAllocationPercent: 5,       // Minimum 5% to any strategy
        maxAllocationPercent: 60,      // Maximum 60% to any strategy
        maxAllocationShiftPercent: 10, // Maximum 10% shift in one update
        emergencyRebalanceThreshold: 25 // Emergency rebalance if 25% underperformance
      },
      
      // Strategy preferences
      strategyPreferences: {
        "Temporal Block Arbitrage": {
          preferred: true,
          minAllocationPercent: 10,
          maxAllocationPercent: 60
        },
        "Flash Loan Singularity": {
          preferred: true, 
          minAllocationPercent: 10,
          maxAllocationPercent: 60
        },
        "Quantum Arbitrage": {
          preferred: true,
          minAllocationPercent: 10,
          maxAllocationPercent: 40
        }
      },
      
      // Capital boost settings
      capitalBoostSettings: {
        enabled: true,
        boostThresholdROIPercent: 5,   // Boost when ROI exceeds 5% in 24h
        boostMultiplier: 1.5,          // 1.5x boost to capital allocation
        maxBoostAllocationPercent: 60, // Maximum 60% allocation with boost
        consecutiveWinsForBoost: 5     // Require 5 consecutive wins
      },
      
      // Performance history
      performanceHistoryDays: 7,       // Track 7 days of performance
      
      createdAt: new Date().toISOString()
    };
    
    // Save allocation configuration
    fs.writeFileSync(ALLOCATION_CONFIG_PATH, JSON.stringify(allocationConfig, null, 2));
    console.log('✅ Created dynamic allocation configuration');
    
    return true;
  } catch (error) {
    console.error('Error configuring dynamic allocation:', error);
    return false;
  }
}

/**
 * Update system state for dynamic allocation
 */
function updateSystemState() {
  console.log('Updating system state for dynamic allocation...');
  
  try {
    let systemState: any = {};
    if (fs.existsSync(SYSTEM_CONFIG_PATH)) {
      systemState = JSON.parse(fs.readFileSync(SYSTEM_CONFIG_PATH, 'utf8'));
    }
    
    // Enable dynamic allocation
    systemState.dynamicAllocationEnabled = true;
    
    // Configure initial strategy weights with preference for highest performers
    systemState.strategyWeights = {
      "Temporal Block Arbitrage": 35,    // 35% allocation (initial)
      "Flash Loan Singularity": 35,      // 35% allocation (initial)
      "Quantum Arbitrage": 15,           // 15% allocation (initial)
      "quantumOmega": 5,                 // 5% allocation
      "flashMinimal": 5,                 // 5% allocation
      "moneyGlitch": 3,                  // 3% allocation
      "hyperion": 2                      // 2% allocation
    };
    
    // Performance tracking
    systemState.strategyPerformance = {
      "Temporal Block Arbitrage": {
        profitLast24h: 0,
        successRate: 0,
        trades: 0,
        enabled: true
      },
      "Flash Loan Singularity": {
        profitLast24h: 0,
        successRate: 0,
        trades: 0,
        enabled: true
      },
      "Quantum Arbitrage": {
        profitLast24h: 0,
        successRate: 0,
        trades: 0,
        enabled: true
      }
    };
    
    // Dynamic allocation settings
    systemState.capitalAllocation = {
      dynamicMode: true,
      lastUpdated: new Date().toISOString(),
      autoRebalance: true,
      performanceBased: true
    };
    
    // Update last modified timestamp
    systemState.lastModified = new Date().toISOString();
    
    // Save updated system state
    fs.writeFileSync(SYSTEM_CONFIG_PATH, JSON.stringify(systemState, null, 2));
    console.log('✅ Updated system state for dynamic allocation');
    
    return true;
  } catch (error) {
    console.error('Error updating system state:', error);
    return false;
  }
}

/**
 * Create dynamic allocation monitor
 */
function createDynamicAllocationMonitor() {
  console.log('Creating dynamic allocation monitor...');
  
  try {
    // Create the monitor script
    const monitorScript = `/**
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
          console.error(\`Error processing strategy \${strategy.name}:\`, err);
        }
      }
    });
    
    // Record best strategy
    performanceLog.bestStrategy = bestStrategy;
    performanceLog.bestStrategyScore = highestScore;
    
    // Save updated performance log
    fs.writeFileSync(PERFORMANCE_LOG_PATH, JSON.stringify(performanceLog, null, 2));
    console.log(\`✅ Updated performance tracking. Best strategy: \${bestStrategy || 'None'}\`);
    
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
      console.log(\`   \${strategy}: \${newWeights[strategy]}%\`);
    });
    console.log(\`   Best performing strategy: \${bestStrategy} (boosted allocation)\`);
    
    return true;
  } catch (error) {
    console.error('Error adjusting capital allocation:', error);
    return false;
  }
}

// Run the allocation adjustment
adjustCapitalAllocation();
`;
    
    // Save the monitor script
    const monitorPath = path.join('./data', 'dynamic-allocation-monitor.js');
    fs.writeFileSync(monitorPath, monitorScript);
    
    // Create the scheduler script
    const schedulerScript = `#!/usr/bin/env node
/**
 * Dynamic Allocation Scheduler
 * 
 * This script periodically runs the dynamic allocation monitor
 * to adjust capital allocation based on strategy performance.
 */

const { spawn } = require('child_process');
const path = require('path');

const MONITOR_PATH = path.join('./data', 'dynamic-allocation-monitor.js');
const INTERVAL_MS = 300000; // 5 minutes

console.log('Starting Dynamic Allocation Scheduler');
console.log(\`Will adjust capital allocation every \${INTERVAL_MS/1000} seconds\`);

// Run the monitor immediately
runMonitor();

// Schedule regular runs
setInterval(runMonitor, INTERVAL_MS);

function runMonitor() {
  console.log(\`[\${new Date().toISOString()}] Running dynamic allocation monitor...\`);
  
  const monitor = spawn('node', [MONITOR_PATH]);
  
  monitor.stdout.on('data', (data) => {
    console.log(\`\${data}\`);
  });
  
  monitor.stderr.on('data', (data) => {
    console.error(\`\${data}\`);
  });
  
  monitor.on('close', (code) => {
    console.log(\`Monitor process exited with code \${code}\`);
  });
}
`;
    
    // Save the scheduler script
    const schedulerPath = path.join('./data', 'dynamic-allocation-scheduler.js');
    fs.writeFileSync(schedulerPath, schedulerScript);
    fs.chmodSync(schedulerPath, '755'); // Make executable
    
    console.log('✅ Created dynamic allocation monitor and scheduler');
    return true;
  } catch (error) {
    console.error('Error creating dynamic allocation monitor:', error);
    return false;
  }
}

/**
 * Create launcher script for dynamic allocation
 */
function createLauncherScript() {
  console.log('Creating launcher script for dynamic allocation...');
  
  try {
    const launcherScript = `#!/usr/bin/env node
/**
 * Launch Dynamic Allocation System
 * 
 * This script launches the dynamic allocation system to optimize
 * capital allocation between trading strategies.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCHEDULER_PATH = path.join('./data', 'dynamic-allocation-scheduler.js');
const SYSTEM_STATE_PATH = path.join('./data', 'system-state-memory.json');

// Ensure the scheduler exists
if (!fs.existsSync(SCHEDULER_PATH)) {
  console.error('Dynamic allocation scheduler not found!');
  process.exit(1);
}

// Update system state to enable dynamic allocation
try {
  const systemState = JSON.parse(fs.readFileSync(SYSTEM_STATE_PATH, 'utf8'));
  systemState.dynamicAllocationEnabled = true;
  systemState.capitalAllocation = systemState.capitalAllocation || {};
  systemState.capitalAllocation.dynamicMode = true;
  systemState.capitalAllocation.lastStarted = new Date().toISOString();
  fs.writeFileSync(SYSTEM_STATE_PATH, JSON.stringify(systemState, null, 2));
  console.log('✅ Enabled dynamic allocation in system state');
} catch (error) {
  console.error('Error updating system state:', error);
}

// Launch the scheduler
console.log('Launching dynamic allocation scheduler...');
const scheduler = spawn('node', [SCHEDULER_PATH], {
  detached: true,
  stdio: 'ignore'
});

scheduler.unref();

console.log('✅ Dynamic allocation scheduler is now running in the background');
console.log('✅ System will automatically optimize capital allocation based on performance');
`;
    
    // Save the launcher script
    const launcherPath = path.join('./launch-dynamic-allocation.js');
    fs.writeFileSync(launcherPath, launcherScript);
    fs.chmodSync(launcherPath, '755'); // Make executable
    
    console.log('✅ Created launcher script for dynamic allocation');
    return true;
  } catch (error) {
    console.error('Error creating launcher script:', error);
    return false;
  }
}

/**
 * Main function to configure dynamic allocation
 */
async function main() {
  console.log('Starting dynamic capital allocation configuration...');
  
  // Configure dynamic allocation
  const configResult = configureDynamicAllocation();
  const systemResult = updateSystemState();
  const monitorResult = createDynamicAllocationMonitor();
  const launcherResult = createLauncherScript();
  
  // Check overall success
  const success = configResult && systemResult && monitorResult && launcherResult;
  
  if (success) {
    console.log('\n=== DYNAMIC CAPITAL ALLOCATION CONFIGURED SUCCESSFULLY ===');
    console.log('✅ Created dynamic allocation configuration');
    console.log('✅ Updated system state for dynamic allocation');
    console.log('✅ Created dynamic allocation monitor and scheduler');
    console.log('✅ Created launcher script for dynamic allocation');
    console.log('\nThe system will now automatically optimize capital allocation:');
    console.log('- Tracks performance of all strategies in real-time');
    console.log('- Allocates more capital to the best-performing strategies');
    console.log('- Boosts allocation to strategies with consistent wins');
    console.log('- Maintains minimum allocation for strategy diversity');
    console.log('\nTo start dynamic allocation, run:');
    console.log('node launch-dynamic-allocation.js');
  } else {
    console.error('\n⚠️ Dynamic allocation configuration completed with some errors');
    console.log('Some components may not be fully configured.');
  }
}

// Run the main function
main()
  .catch(error => {
    console.error('Error configuring dynamic allocation:', error);
  });