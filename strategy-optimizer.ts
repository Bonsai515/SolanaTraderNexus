/**
 * Strategy Optimizer
 * 
 * This script applies optimized parameters to all running nuclear strategies
 * based on profit projection analysis and performance data.
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

// Strategy optimization parameters
interface StrategyOptimization {
  name: string;
  configFile: string;
  parameterUpdates: Record<string, any>;
  description: string;
}

// Define optimizations for each strategy
const optimizations: StrategyOptimization[] = [
  {
    name: "Ultimate Nuclear Money Glitch",
    configFile: "config/ultimate-nuclear-config.json",
    parameterUpdates: {
      maxPositionSizePercent: 40, // Increased from 35%
      timeoutMs: 35000, // Increased from 30000
      targetedTokens: ["SOL", "USDC", "USDT", "ETH", "BTC", "RAY", "BONK", "JUP"], // Optimized token list
      profitSplitPercent: 95, // Increased from 90%
      checkIntervalMs: 4500, // Reduced from 5000 for more frequent checks
      minTimeBetweenTradesMs: 330000 // Reduced from 350000 (5.5 min)
    },
    description: "Increased position size to 40% and optimized token selection for better profit potential. Increased profit reinvestment to 95% for better compounding."
  },
  {
    name: "Quantum Flash Loan",
    configFile: "config/quantum-flash-config.json",
    parameterUpdates: {
      maxSlippageTolerance: 0.45, // Reduced from 0.5%
      maxDailyTransactions: 14, // Increased from 12
      loanProtocols: ["Solend", "Tulip", "Larix", "Marinade"], // Added Marinade
      crossExchangeArbitrage: true, // Ensure this is enabled
      timeoutMs: 28000, // Reduced from 30000
      checkIntervalMs: 4000, // Reduced from 5000
      minTimeBetweenTradesMs: 280000, // Reduced from 300000 (4.7 min)
      profitSplitPercent: 95 // Increased from 10%
    },
    description: "Optimized for more frequent trades (14/day) with slightly lower slippage tolerance. Added Marinade as an additional loan protocol. Reduced time between trades to 4.7 minutes."
  },
  {
    name: "Zero Capital Flash",
    configFile: "config/zero-capital-flash-config.json",
    parameterUpdates: {
      minProfitThresholdUSD: 0.40, // Increased from 0.35 USD
      maxDailyTransactions: 32, // Increased from 30
      targetedTokens: ["SOL", "USDC", "USDT", "ETH", "BTC"], // Focus on high liquidity tokens
      checkIntervalMs: 6000, // Reduced from 7500
      minTimeBetweenTradesMs: 340000, // Reduced from 360000 (5.7 min)
      loanAmount: 120, // Increased from 100 USD
      simulateBeforeExecute: true // Ensure simulation is performed
    },
    description: "Focused on highest liquidity tokens for better execution. Increased loan amount to 120 USD for better profit potential. Increased minimum profit threshold to reduce risk."
  }
];

// RPC optimization configuration
interface RpcOptimization {
  primaryProvider: string;
  secondaryProvider: string;
  tertiaryProvider: string;
  healthCheckIntervalMs: number;
  maxConsecutiveFailures: number;
  loadBalancingStrategy: 'priority' | 'response-time' | 'round-robin';
}

const rpcOptimization: RpcOptimization = {
  primaryProvider: "Syndica",
  secondaryProvider: "Helius",
  tertiaryProvider: "Triton", // Added Triton as tertiary provider
  healthCheckIntervalMs: 45000, // Reduced from 60000
  maxConsecutiveFailures: 2, // Reduced from 3
  loadBalancingStrategy: 'priority' // Maintain priority-based strategy
};

// Apply optimizations
function applyOptimizations(): void {
  console.log("APPLYING STRATEGY OPTIMIZATIONS");
  console.log("===============================\n");
  
  // Create config directory if it doesn't exist
  if (!fs.existsSync('config')) {
    fs.mkdirSync('config');
  }
  
  // Apply strategy-specific optimizations
  for (const optimization of optimizations) {
    try {
      let config: Record<string, any> = {};
      
      // Try to load existing config if it exists
      if (fs.existsSync(optimization.configFile)) {
        const configData = fs.readFileSync(optimization.configFile, 'utf-8');
        config = JSON.parse(configData);
      }
      
      // Apply parameter updates
      config = { ...config, ...optimization.parameterUpdates };
      
      // Save updated config
      fs.writeFileSync(optimization.configFile, JSON.stringify(config, null, 2));
      
      console.log(`✅ Optimized ${optimization.name} strategy`);
      console.log(`   ${optimization.description}`);
      console.log(`   Config saved to ${optimization.configFile}\n`);
    } catch (error) {
      console.error(`❌ Error optimizing ${optimization.name} strategy:`, error);
    }
  }
  
  // Apply RPC optimization
  try {
    const rpcConfigPath = 'config/rpc-config.json';
    fs.writeFileSync(rpcConfigPath, JSON.stringify(rpcOptimization, null, 2));
    
    console.log("✅ Optimized RPC configuration");
    console.log(`   Primary: ${rpcOptimization.primaryProvider}`);
    console.log(`   Secondary: ${rpcOptimization.secondaryProvider}`);
    console.log(`   Tertiary: ${rpcOptimization.tertiaryProvider}`);
    console.log(`   Health check interval: ${rpcOptimization.healthCheckIntervalMs}ms`);
    console.log(`   Config saved to ${rpcConfigPath}\n`);
  } catch (error) {
    console.error("❌ Error optimizing RPC configuration:", error);
  }
  
  console.log("STRATEGY OPTIMIZATION COMPLETE");
  console.log("============================\n");
  console.log("Next steps:");
  console.log("1. Restart trading strategies to apply new configurations");
  console.log("2. Monitor performance for 24 hours");
  console.log("3. Analyze results and make further adjustments if needed");
}

// Create shell script to restart strategies with new configs
function createRestartScript(): void {
  const scriptContent = `#!/bin/bash
# Restart trading strategies with optimized configurations

echo "Stopping current trading strategies..."
# Find and kill current strategy processes
pkill -f "ultimate-nuclear-strategy.ts" || true
pkill -f "quantum-flash-strategy.ts" || true
pkill -f "zero-capital-flash-strategy.ts" || true

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

echo "All strategies restarted with optimized configurations."
echo "Monitor logs in the logs directory for performance."
`;

  const scriptPath = 'restart-optimized-strategies.sh';
  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(scriptPath, 0o755); // Make executable
  
  console.log(`✅ Created restart script: ${scriptPath}`);
  console.log("   Run this script to restart all strategies with optimized configurations");
}

// Main function
function main(): void {
  applyOptimizations();
  createRestartScript();
}

// Run the main function
main();