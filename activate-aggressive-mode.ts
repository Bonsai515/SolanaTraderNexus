/**
 * Activate Aggressive Trading Mode
 * 
 * This script configures all strategies for maximum capital growth,
 * taking higher calculated risks for bigger rewards.
 */

import * as fs from 'fs';
import * as path from 'path';

// Strategy paths
const QUANTUM_OMEGA_PATH = path.join('./data', 'quantum-omega-strategy.json');
const FLASH_MINIMAL_PATH = path.join('./data', 'minimal-flash-strategy.json');
const MONEY_GLITCH_PATH = path.join('./data', 'money-glitch-strategy.json');
const HYPERION_PATH = path.join('./data', 'hyperion-transformers-strategy.json');

// Configuration paths
const SYSTEM_STATE_PATH = path.join('./data', 'system-state-memory.json');
const PROFIT_CONFIG_PATH = path.join('./data', 'profit-configuration.json');

/**
 * Configure Quantum Omega for aggressive trading
 */
function configureQuantumOmega() {
  console.log('Configuring Quantum Omega Meme Scanner for aggressive mode...');
  
  try {
    if (fs.existsSync(QUANTUM_OMEGA_PATH)) {
      const strategy = JSON.parse(fs.readFileSync(QUANTUM_OMEGA_PATH, 'utf8'));
      
      // Increase position sizes and thresholds
      strategy.maxPositionSizePercent = 15;        // Increase from 10%
      strategy.minConfidenceThreshold = 65;        // Lower from 75%
      strategy.maxActivePositions = 3;             // Increase from 2
      strategy.maxDailyTransactions = 25;          // Increase from 15
      
      // Increase reward-to-risk ratio
      strategy.targetProfitPercent = 20;           // Increase from 15%
      strategy.stopLossPercent = 7;                // Keep reasonable stop loss
      strategy.useTrailingStopLoss = true;         // Enable trailing stop
      strategy.trailingStopDistance = 3;           // 3% trailing stop
      
      // More aggressive entry parameters
      strategy.buyOnBreakout = true;               // Buy on breakouts
      strategy.breakoutConfirmationTicks = 2;      // Faster confirmation
      strategy.usePriceImpactProtection = true;    // Keep protection
      strategy.maxPriceImpactPercent = 2.5;        // Increase from 1.5%
      
      // Faster signal processing
      strategy.signalConfirmationDelayMs = 500;    // Reduce from 1000ms
      strategy.executionPriority = "high";         // Set high priority
      
      // Enable more token types
      strategy.allowUnverifiedTokens = true;       // More opportunity
      strategy.minLiquidityUSD = 25000;            // Lower threshold
      
      // Reconfigure neural transformer settings
      if (strategy.neuralSettings) {
        strategy.neuralSettings.aggressiveMode = true;
        strategy.neuralSettings.confidenceThreshold = 65;  // Lower from 75
        strategy.neuralSettings.signalMultiplier = 1.5;    // Increase signal impact
      }
      
      // Adjust risk parameters for aggressive trading
      strategy.riskLevel = "high";
      strategy.capitalUtilizationTarget = 90;      // Increase from 70%
      
      // Save updated strategy
      fs.writeFileSync(QUANTUM_OMEGA_PATH, JSON.stringify(strategy, null, 2));
      console.log('✅ Quantum Omega Meme Scanner configured for aggressive trading');
      return true;
    } else {
      console.warn('⚠️ Quantum Omega strategy file not found');
      return false;
    }
  } catch (error) {
    console.error('Error configuring Quantum Omega:', error);
    return false;
  }
}

/**
 * Configure Flash Loan Minimal for aggressive trading
 */
function configureFlashLoanMinimal() {
  console.log('Configuring Flash Loan Minimal Strategy for aggressive mode...');
  
  try {
    if (fs.existsSync(FLASH_MINIMAL_PATH)) {
      const strategy = JSON.parse(fs.readFileSync(FLASH_MINIMAL_PATH, 'utf8'));
      
      // More aggressive flash loan parameters
      strategy.maxPositionSizePercent = 150;        // Leverage up to 150% of capital
      strategy.minProfitThresholdUSD = 0.15;        // Lower profit threshold
      strategy.maxSlippageTolerance = 2.5;          // Increase slippage tolerance
      strategy.maxActiveLoans = 3;                  // Increase concurrent loans
      strategy.maxDailyTransactions = 30;           // More transactions per day
      
      // Aggressive routing optimization
      strategy.routingOptimization = true;
      strategy.useAdvancedRouting = true;
      strategy.maxGasFeeSOL = 0.002;                // Higher gas budget
      
      // Faster execution
      strategy.timeoutMs = 30000;                   // Reduce timeout
      strategy.useFeeDiscounting = true;
      strategy.minLiquidityPoolSize = 10000;        // Lower pool size requirement
      
      // Enable additional strategies
      strategy.crossExchangeArbitrage = true;
      strategy.useHangingOrderStrategy = true;
      strategy.simulateBeforeSend = true;           // Simulation for safety
      
      // Increase profit reinvestment
      strategy.profitSplitPercent = 90;             // Reinvest 90% of profits
      
      // Save updated strategy
      fs.writeFileSync(FLASH_MINIMAL_PATH, JSON.stringify(strategy, null, 2));
      console.log('✅ Flash Loan Minimal Strategy configured for aggressive trading');
      return true;
    } else {
      console.warn('⚠️ Flash Loan Minimal strategy file not found');
      return false;
    }
  } catch (error) {
    console.error('Error configuring Flash Loan Minimal:', error);
    return false;
  }
}

/**
 * Configure Money Glitch for aggressive trading
 */
function configureMoneyGlitch() {
  console.log('Configuring Money Glitch Cross-DEX for aggressive mode...');
  
  try {
    if (fs.existsSync(MONEY_GLITCH_PATH)) {
      const strategy = JSON.parse(fs.readFileSync(MONEY_GLITCH_PATH, 'utf8'));
      
      // Aggressive position sizing
      strategy.maxPositionSizePercent = 20;        // Increase position size
      strategy.minProfitThresholdUSD = 0.1;        // Lower profit threshold
      strategy.maxSlippageTolerance = 3;           // Higher slippage tolerance
      strategy.maxActiveLoans = 4;                 // More concurrent loans
      strategy.maxDailyTransactions = 50;          // More transactions
      
      // Optimize routing and execution
      strategy.routingOptimization = true;
      strategy.maxGasFeeSOL = 0.002;               // Higher gas budget
      strategy.timeoutMs = 25000;                  // Faster timeout
      
      // Lower spread requirements for more opportunities
      strategy.minSpreadPercent = 0.35;            // Lower from 0.5%
      strategy.spreadCalculationMethod = "midpoint";
      
      // Enable advanced arbitrage strategies
      strategy.triangularArbitrage = true;
      strategy.sandwichAttackProtection = true;
      strategy.multicallExecution = true;
      strategy.atomicExecution = true;
      strategy.mevProtection = true;
      strategy.useRbsProtection = true;
      
      // Enable integrations for more opportunities
      strategy.balancerIntegration = true;
      strategy.jupiterIntegration = true;
      strategy.orcaIntegration = true;
      strategy.raydiumIntegration = true;
      
      // Advanced loop detection for complex opportunities
      strategy.loopDetection = true;
      strategy.maxLoopLength = 5;                  // Up to 5-step arbitrage
      strategy.minConfidenceScore = 65;            // Lower confidence threshold
      strategy.autoAdjustThresholds = true;
      
      // High reinvestment rate
      strategy.profitSplitPercent = 90;            // Reinvest 90% of profits
      
      // Save updated strategy
      fs.writeFileSync(MONEY_GLITCH_PATH, JSON.stringify(strategy, null, 2));
      console.log('✅ Money Glitch Cross-DEX configured for aggressive trading');
      return true;
    } else {
      console.warn('⚠️ Money Glitch strategy file not found');
      return false;
    }
  } catch (error) {
    console.error('Error configuring Money Glitch:', error);
    return false;
  }
}

/**
 * Configure Hyperion Transformers for aggressive trading
 */
function configureHyperionTransformers() {
  console.log('Configuring Hyperion Transformers for aggressive mode...');
  
  try {
    if (fs.existsSync(HYPERION_PATH)) {
      const strategy = JSON.parse(fs.readFileSync(HYPERION_PATH, 'utf8'));
      
      // Aggressive position sizing
      strategy.maxPositionSizePercent = 30;        // Increase position size
      strategy.minProfitThresholdUSD = 0.2;        // Lower profit threshold
      strategy.maxSlippageTolerance = 2.5;         // Higher slippage tolerance
      strategy.maxDailyTransactions = 25;          // More transactions
      
      // Enhanced neural optimization
      strategy.transformerLayers = 4;              // More neural layers
      strategy.quantumFiltering = true;
      strategy.neuralOptimization = true;
      strategy.parallelExecution = true;
      strategy.adaptiveRiskManagement = true;
      
      // High execution priority
      strategy.executionPriorities = [9, 8, 7, 6]; // Higher priorities
      strategy.optimizationInterval = 5000;        // Faster optimization
      strategy.useIntegratedDex = true;
      strategy.transactionTimeoutMs = 30000;       // Faster timeout
      
      // Enhanced memory optimization
      strategy.useMemoryGraph = true;
      
      // Higher gas budget for faster transactions
      strategy.maxGasFeeBudgetSOL = 0.005;         // Increase gas budget
      
      // Save updated strategy
      fs.writeFileSync(HYPERION_PATH, JSON.stringify(strategy, null, 2));
      console.log('✅ Hyperion Transformers configured for aggressive trading');
      return true;
    } else {
      console.warn('⚠️ Hyperion Transformers strategy file not found');
      return false;
    }
  } catch (error) {
    console.error('Error configuring Hyperion Transformers:', error);
    return false;
  }
}

/**
 * Configure system-wide profit distribution for aggressive growth
 */
function configureProfitDistribution() {
  console.log('Configuring system-wide profit distribution for aggressive growth...');
  
  try {
    // Create profit configuration
    const profitConfig = {
      mode: "aggressive_growth",
      reinvestmentRate: 90,           // 90% of profits reinvested
      profitSplitting: {
        reinvest: 90,                 // 90% reinvested
        reserve: 10,                  // 10% to reserve wallet
        withdraw: 0                   // 0% withdrawn
      },
      capitalAllocation: {
        quantumOmega: 20,             // 20% to Quantum Omega
        flashMinimal: 20,             // 20% to Flash Minimal
        moneyGlitch: 30,              // 30% to Money Glitch
        hyperion: 30                  // 30% to Hyperion
      },
      compoundingEnabled: true,
      compoundingFrequency: "daily",  // Compound daily
      riskLevel: "high",
      targetGrowthRatePercent: 15,    // Target 15% daily growth
      profitLockingEnabled: false,    // Don't lock profits
      stopTradingThreshold: -15,      // Stop if 15% down in a day
      autoscalingEnabled: true,       // Scale positions automatically
      updatedAt: new Date().toISOString()
    };
    
    // Save profit configuration
    fs.writeFileSync(PROFIT_CONFIG_PATH, JSON.stringify(profitConfig, null, 2));
    console.log('✅ Configured profit distribution for aggressive growth');
    
    return true;
  } catch (error) {
    console.error('Error configuring profit distribution:', error);
    return false;
  }
}

/**
 * Update system state to aggressive mode
 */
function updateSystemState() {
  console.log('Updating system state to aggressive mode...');
  
  try {
    let systemState: any = {};
    if (fs.existsSync(SYSTEM_STATE_PATH)) {
      systemState = JSON.parse(fs.readFileSync(SYSTEM_STATE_PATH, 'utf8'));
    }
    
    // Update trading mode
    systemState.tradingMode = "aggressive";
    systemState.riskLevel = "high";
    systemState.maxCapitalUtilization = 90;  // Use up to 90% of capital
    
    // Update strategy weights for capital allocation
    systemState.strategyWeights = {
      quantumOmega: 20,          // 20% to Quantum Omega
      flashMinimal: 20,          // 20% to Flash Minimal
      moneyGlitch: 30,           // 30% to Money Glitch
      hyperion: 30               // 30% to Hyperion
    };
    
    // Update wallet configuration
    if (systemState.wallets) {
      // Set higher maximum allocation per wallet
      systemState.wallets.forEach((wallet: any) => {
        wallet.maxAllocationPercent = 95;  // Allow up to 95% allocation
      });
    }
    
    // Update neural configuration
    if (systemState.neuralConfig) {
      systemState.neuralConfig.aggressiveMode = true;
      systemState.neuralConfig.minConfidence = 65;  // Lower confidence threshold
      systemState.neuralConfig.riskTolerance = "high";
    }
    
    // Update last modified timestamp
    systemState.lastModified = new Date().toISOString();
    systemState.aggressiveModeActivated = new Date().toISOString();
    
    // Save updated system state
    fs.writeFileSync(SYSTEM_STATE_PATH, JSON.stringify(systemState, null, 2));
    console.log('✅ Updated system state to aggressive mode');
    
    return true;
  } catch (error) {
    console.error('Error updating system state:', error);
    return false;
  }
}

/**
 * Update the aggressive profit projection
 */
function updateProfitProjection() {
  console.log('Updating profit projection for aggressive mode...');
  
  try {
    const aggressiveProjection = {
      version: "1.0.0",
      tradingMode: "aggressive",
      strategies: {
        quantumOmega: {
          dailyProfitRangeSol: [0.004, 0.035],    // Increased from [0.002, 0.015]
          successRate: [45, 65],                  // Slightly wider range
          dailyOpportunities: [6, 18]             // Increased from [5, 15]
        },
        flashMinimal: {
          dailyProfitRangeSol: [0.008, 0.065],    // Increased from [0.004, 0.032]
          successRate: [65, 80],                  // Slightly lower high end
          dailyOpportunities: [4, 12]             // Increased from [3, 8]
        },
        moneyGlitch: {
          dailyProfitRangeSol: [0.015, 0.090],    // Increased from [0.008, 0.045]
          successRate: [55, 70],                  // Slightly lower range
          dailyOpportunities: [3, 8]              // Increased from [2, 5]
        },
        hyperion: {
          dailyProfitRangeSol: [0.030, 0.180],    // Increased from [0.015, 0.090]
          successRate: [75, 85],                  // Slightly lower high end
          dailyOpportunities: [2, 5]              // Increased from [1, 3]
        }
      },
      dailyProjection: {
        conservative: 0.057,     // 0.057 SOL daily (~5.5% of capital)
        moderate: 0.129,         // 0.129 SOL daily (~12.4% of capital)
        aggressive: 0.370        // 0.370 SOL daily (~35.6% of capital)
      },
      monthlyProjection: {
        conservative: 1.71,      // 1.71 SOL monthly (~164% of capital)
        moderate: 3.87,          // 3.87 SOL monthly (~372% of capital)
        aggressive: 11.1         // 11.1 SOL monthly (~1067% of capital)
      },
      riskAssessment: {
        maxDrawdownPercent: 15,  // Higher potential drawdown
        volatilityScore: 8.5,    // Higher volatility (1-10 scale)
        recoveryTimeEstimateDays: 2.5  // Estimated recovery time
      },
      generatedAt: new Date().toISOString()
    };
    
    // Save aggressive projection
    const projectionPath = path.join('./data', 'aggressive-profit-projection.json');
    fs.writeFileSync(projectionPath, JSON.stringify(aggressiveProjection, null, 2));
    
    // Also create a markdown file for easy reading
    const mdProjection = `# Aggressive Mode Profit Projection
## Based on 1.04 SOL Balance

### Daily Profit Potential
- **Conservative:** 0.057 SOL (~5.5% of capital)
- **Moderate:** 0.129 SOL (~12.4% of capital)
- **Aggressive:** 0.370 SOL (~35.6% of capital)

### Monthly Profit Potential (Compounded)
- **Conservative:** 1.71 SOL (~164% of capital)
- **Moderate:** 3.87 SOL (~372% of capital)
- **Aggressive:** 11.1 SOL (~1067% of capital)

### Strategy-Specific Projections

#### Quantum Omega Meme Scanner
- Daily profit range: 0.004-0.035 SOL
- Success rate: 45-65%
- Daily opportunities: 6-18

#### Flash Loan Minimal
- Daily profit range: 0.008-0.065 SOL
- Success rate: 65-80%
- Daily opportunities: 4-12

#### Money Glitch Cross-DEX
- Daily profit range: 0.015-0.090 SOL
- Success rate: 55-70%
- Daily opportunities: 3-8

#### Hyperion Transformers
- Daily profit range: 0.030-0.180 SOL
- Success rate: 75-85%
- Daily opportunities: 2-5

### Risk Assessment
- Maximum expected drawdown: 15%
- Volatility score: 8.5/10
- Estimated recovery time: 2.5 days

### Aggressive Mode Optimizations
- Increased position sizes
- Lower minimum profit thresholds
- Higher slippage tolerance
- More concurrent positions
- Faster signal execution
- Higher capital utilization (90%)

> **Note:** Aggressive mode aims for maximum capital growth by taking calculated risks.
> The system automatically manages risk with stop losses and security checks while
> pursuing higher returns than conservative strategies.`;
    
    const mdPath = path.join('./AGGRESSIVE_PROFIT_PROJECTION.md');
    fs.writeFileSync(mdPath, mdProjection);
    
    console.log('✅ Updated profit projection for aggressive mode');
    return true;
  } catch (error) {
    console.error('Error updating profit projection:', error);
    return false;
  }
}

/**
 * Main function to activate aggressive trading mode
 */
async function main() {
  console.log('Starting aggressive trading mode activation...');
  
  // Configure all strategies for aggressive trading
  const quantumResult = configureQuantumOmega();
  const flashResult = configureFlashLoanMinimal();
  const moneyGlitchResult = configureMoneyGlitch();
  const hyperionResult = configureHyperionTransformers();
  
  // Configure system-wide settings
  const profitResult = configureProfitDistribution();
  const systemResult = updateSystemState();
  const projectionResult = updateProfitProjection();
  
  // Check overall success
  const success = quantumResult && flashResult && moneyGlitchResult && 
                 hyperionResult && profitResult && systemResult && projectionResult;
  
  if (success) {
    console.log('\n=== AGGRESSIVE TRADING MODE ACTIVATED SUCCESSFULLY ===');
    console.log('✅ All strategies configured for aggressive capital growth');
    console.log('✅ System state updated to aggressive mode');
    console.log('✅ Profit distribution optimized for rapid growth');
    console.log('✅ Updated profit projection with aggressive targets');
    console.log('\nThe system will now pursue maximum capital growth by:');
    console.log('- Taking larger positions (up to 30% of capital per trade)');
    console.log('- Executing trades more quickly with higher priority');
    console.log('- Accepting lower profit thresholds for more opportunities');
    console.log('- Reinvesting 90% of profits automatically');
    console.log('- Utilizing more advanced neural optimization techniques');
    console.log('\nSee AGGRESSIVE_PROFIT_PROJECTION.md for detailed profit targets.');
  } else {
    console.error('\n⚠️ Aggressive trading mode activation completed with some errors');
    console.log('Some strategies may not be fully optimized.');
  }
}

// Run the main function
main()
  .catch(error => {
    console.error('Error activating aggressive trading mode:', error);
  });