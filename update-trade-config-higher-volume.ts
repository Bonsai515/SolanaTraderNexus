/**
 * Update Trading Configuration for Higher Volume Per Trade
 * 
 * This script adjusts the trading parameters to focus on:
 * - Fewer trades (longer intervals between trades)
 * - Larger position sizes per trade (more volume per trade)
 */

import * as fs from 'fs';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Configuration
const LOG_PATH = './hyper-aggressive-trading.log';
const NEXUS_CONFIG_DIR = './nexus_engine/config';
const CONFIG_PATH = `${NEXUS_CONFIG_DIR}/hyper_aggressive_trading_config.json`;

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- HYPER-AGGRESSIVE TRADING LOG ---\n');
}

// Log function
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Update trading configuration for fewer trades with larger volume
function updateTradingConfiguration(): boolean {
  try {
    // Check if config file exists
    if (!fs.existsSync(CONFIG_PATH)) {
      log(`❌ Config file not found at ${CONFIG_PATH}`);
      return false;
    }
    
    // Load existing configuration
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    
    // Update configuration
    log('Updating trading configuration for fewer trades with higher volume...');
    
    // 1. Increase trading interval (fewer trades)
    if (config.autonomousMode) {
      config.autonomousMode.tradingInterval = 120000; // 2 minutes instead of 20 seconds
      log('✅ Increased trading interval to 2 minutes (fewer trades)');
    }
    
    // 2. Increase position sizes (higher volume per trade)
    Object.keys(config.strategies).forEach(strategy => {
      // Aggressive strategies get 95% position sizing
      if (['nuclearFlashArbitrage', 'hyperionMoneyLoop'].includes(strategy)) {
        config.strategies[strategy].maxPositionSizePercent = 95; // Increase to 95%
      } 
      // Other strategies get 85% position sizing
      else {
        config.strategies[strategy].maxPositionSizePercent = 85; // Increase to 85%
      }
      
      // Increase min profit threshold to ensure each trade is more profitable
      config.strategies[strategy].minProfitThresholdSOL = 0.0005; // Higher threshold
    });
    log('✅ Increased position sizes to 85-95% (higher volume per trade)');
    log('✅ Increased minimum profit threshold to 0.0005 SOL (more profitable trades)');
    
    // 3. Adjust slippage tolerance for larger trades
    if (config.realTrading) {
      config.realTrading.slippageTolerance = 1.5; // Increase to 1.5% for larger trades
      log('✅ Increased slippage tolerance to 1.5% for larger trades');
    }
    
    // 4. Adjust Jupiter DEX settings for larger trades
    if (config.jupiterDEX) {
      config.jupiterDEX.slippageBps = 150; // 1.5% slippage
      log('✅ Updated Jupiter DEX slippage to 1.5% for larger trades');
    }
    
    // 5. Configure for larger daily volume limit
    if (config.security) {
      config.security.maxDailyTradeVolume = 3.5; // Increase to 3.5 SOL
      log('✅ Increased maximum daily trade volume to 3.5 SOL');
    }
    
    // Save updated configuration
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    log(`✅ Successfully updated trading configuration at ${CONFIG_PATH}`);
    
    // Also update the .env file
    const envPath = './.env.hyper-aggressive';
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Update MAX_DAILY_TRADE_VOLUME
      envContent = envContent.replace(/MAX_DAILY_TRADE_VOLUME=.*/, 'MAX_DAILY_TRADE_VOLUME=3.5');
      
      // Update TRADING_INTERVAL_MS
      envContent = envContent.replace(/TRADING_INTERVAL_MS=.*/, 'TRADING_INTERVAL_MS=120000');
      
      // Update MAX_POSITION_SIZE_PERCENT
      envContent = envContent.replace(/MAX_POSITION_SIZE_PERCENT=.*/, 'MAX_POSITION_SIZE_PERCENT=95');
      
      // Update MIN_PROFIT_THRESHOLD_SOL
      envContent = envContent.replace(/MIN_PROFIT_THRESHOLD_SOL=.*/, 'MIN_PROFIT_THRESHOLD_SOL=0.0005');
      
      // Update SLIPPAGE_TOLERANCE
      envContent = envContent.replace(/SLIPPAGE_TOLERANCE=.*/, 'SLIPPAGE_TOLERANCE=1.5');
      
      fs.writeFileSync(envPath, envContent);
      log(`✅ Updated environment configuration at ${envPath}`);
    }
    
    return true;
  } catch (error) {
    log(`❌ Error updating trading configuration: ${(error as Error).message}`);
    return false;
  }
}

// Update the hyper-aggressive profit dashboard
function updateProfitDashboard(): boolean {
  try {
    const dashboardPath = './HYPER_AGGRESSIVE_PROFIT_DASHBOARD.md';
    
    // Check if dashboard exists
    if (!fs.existsSync(dashboardPath)) {
      log(`❌ Hyper-aggressive dashboard not found at ${dashboardPath}`);
      return false;
    }
    
    // Load existing content
    let content = fs.readFileSync(dashboardPath, 'utf8');
    
    // Update configuration section
    const volumePattern = /\*\*Maximum Daily Volume:\*\* Up to [0-9.]+ SOL in trade volume per day/;
    content = content.replace(volumePattern, '**Maximum Daily Volume:** Up to 3.5 SOL in trade volume per day');
    
    // Update trading frequency
    const frequencyPattern = /\*\*Ultra-High Frequency:\*\* Trading every [0-9]+ seconds/;
    content = content.replace(frequencyPattern, '**Ultra-High Frequency:** Trading every 2 minutes');
    
    // Update position sizing
    const positionPattern = /\*\*Ultra Position Sizing:\*\* [0-9-]+ of available capital per trade/;
    content = content.replace(positionPattern, '**Ultra Position Sizing:** 85-95% of available capital per trade');
    
    // Update profit thresholds
    const thresholdPattern = /\*\*Ultra-Low Profit Thresholds:\*\* Takes trades with as little as [0-9.]+ SOL profit/;
    content = content.replace(thresholdPattern, '**Ultra-Low Profit Thresholds:** Takes trades with as little as 0.0005 SOL profit');
    
    // Update slippage
    const slippagePattern = /\*\*Aggressive Slippage:\*\* Accepts up to [0-9.]+ slippage/;
    content = content.replace(slippagePattern, '**Aggressive Slippage:** Accepts up to 1.5% slippage');
    
    // Update last updated
    const lastUpdatedPattern = /\*\*Last Updated:\*\* .+\n/;
    content = content.replace(lastUpdatedPattern, `**Last Updated:** ${new Date().toLocaleString()}\n`);
    
    // Update enabled strategies table
    const strategiesPattern = /\| Strategy \| Position Size \| Min Profit \| Priority \|\n\|----------|--------------|-----------|----------\|(\n\| .* \| [0-9]+% \| [0-9.]+ SOL \| [0-9]+ \|)+/;
    
    const newStrategiesTable = 
`| Strategy | Position Size | Min Profit | Priority |
|----------|--------------|-----------|----------|
| flashLoanSingularity | 85% | 0.0005 SOL | 10 |
| quantumArbitrage | 85% | 0.0005 SOL | 10 |
| jitoBundle | 85% | 0.0005 SOL | 10 |
| cascadeFlash | 85% | 0.0005 SOL | 10 |
| temporalBlockArbitrage | 85% | 0.0005 SOL | 10 |
| hyperNetworkBlitz | 85% | 0.0005 SOL | 10 |
| ultraQuantumMEV | 85% | 0.0005 SOL | 10 |
| nuclearFlashArbitrage | 95% | 0.0005 SOL | 10 |
| hyperionMoneyLoop | 95% | 0.0005 SOL | 10 |`;
    
    content = content.replace(strategiesPattern, newStrategiesTable);
    
    // Adjust projected returns based on new configuration
    // (less frequent trades but higher volume per trade)
    
    // Save updated dashboard
    fs.writeFileSync(dashboardPath, content);
    log(`✅ Updated hyper-aggressive profit dashboard at ${dashboardPath}`);
    
    return true;
  } catch (error) {
    log(`❌ Error updating hyper-aggressive profit dashboard: ${(error as Error).message}`);
    return false;
  }
}

// Update safety measures in verification dashboard
function updateVerificationDashboard(): boolean {
  try {
    const dashboardPath = './REAL_TRADE_VERIFICATION.md';
    
    // Check if dashboard exists
    if (!fs.existsSync(dashboardPath)) {
      log(`❌ Verification dashboard not found at ${dashboardPath}`);
      return false;
    }
    
    // Load existing content
    let content = fs.readFileSync(dashboardPath, 'utf8');
    
    // Update maximum daily volume
    const volumePattern = /\*\*Maximum Daily Volume:\*\* [0-9.]+ SOL/;
    content = content.replace(volumePattern, '**Maximum Daily Volume:** 3.5 SOL');
    
    // Update position sizing
    const positionPattern = /\*\*Position Sizing:\*\* [0-9-]+ of available capital/;
    content = content.replace(positionPattern, '**Position Sizing:** 85-95% of available capital');
    
    // Update slippage protection
    const slippagePattern = /\*\*Slippage Protection:\*\* [0-9.]+ maximum/;
    content = content.replace(slippagePattern, '**Slippage Protection:** 1.5% maximum');
    
    // Update profit thresholds
    const thresholdPattern = /\*\*Higher Profit Thresholds:\*\* Minimum [0-9.]+ SOL profit per trade/;
    content = content.replace(thresholdPattern, '**Higher Profit Thresholds:** Minimum 0.0005 SOL profit per trade');
    
    // Update last updated
    const lastUpdatedPattern = /\*\*Last Updated:\*\* .+\n/;
    content = content.replace(lastUpdatedPattern, `**Last Updated:** ${new Date().toLocaleString()}\n`);
    
    // Save updated dashboard
    fs.writeFileSync(dashboardPath, content);
    log(`✅ Updated verification dashboard at ${dashboardPath}`);
    
    return true;
  } catch (error) {
    log(`❌ Error updating verification dashboard: ${(error as Error).message}`);
    return false;
  }
}

// Create trade size booster script
function createTradeSizeBooster(): boolean {
  try {
    const boosterPath = './boost-trade-size.sh';
    const boosterContent = `#!/bin/bash
echo "=== TRADE SIZE BOOSTER ==="
echo "This script creates larger, less frequent trades for maximum volume efficiency"
echo ""

# Wait 3 seconds for cancellation
for i in {3..1}; do
  echo -ne "Starting trade size boost in $i seconds...\\r"
  sleep 1
done

echo ""
echo "🔥 Boosting trade sizes and reducing frequency..."

# Stop any running hyper-aggressive trader
pkill -f "hyper_aggressive_trader.ts"

# Export the environment variables
export TRADING_INTERVAL_MS=120000
export MAX_POSITION_SIZE_PERCENT=95
export MIN_PROFIT_THRESHOLD_SOL=0.0005
export SLIPPAGE_TOLERANCE=1.5
export MAX_DAILY_TRADE_VOLUME=3.5

# Start the hyper-aggressive trader with larger trades
npx ts-node ./nexus_engine/hyper_aggressive_trader.ts
`;
    
    fs.writeFileSync(boosterPath, boosterContent);
    fs.chmodSync(boosterPath, '755'); // Make executable
    log(`✅ Created trade size booster script at ${boosterPath}`);
    
    return true;
  } catch (error) {
    log(`❌ Error creating trade size booster: ${(error as Error).message}`);
    return false;
  }
}

// Main function
async function main(): Promise<void> {
  try {
    log('Starting update for fewer, larger volume trades...');
    
    // Update configuration
    const configUpdated = updateTradingConfiguration();
    if (!configUpdated) {
      log('Failed to update trading configuration');
      return;
    }
    
    // Update dashboards
    updateProfitDashboard();
    updateVerificationDashboard();
    
    // Create trade size booster script
    createTradeSizeBooster();
    
    log('Trading configuration update completed successfully');
    
    // Display final message
    console.log('\n===== TRADING CONFIGURATION UPDATED =====');
    console.log('🔥 Fewer trades with HIGHER VOLUME per trade');
    console.log('✅ Trading interval increased to 2 minutes (less frequent)');
    console.log('✅ Position sizes increased to 85-95% (more volume per trade)');
    console.log('✅ Slippage tolerance increased to 1.5% for larger trades');
    console.log('✅ Daily volume limit increased to 3.5 SOL');
    console.log('\nTo restart trading with these settings, run:');
    console.log('./boost-trade-size.sh');
    
  } catch (error) {
    log(`Fatal error: ${(error as Error).message}`);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    log(`Unhandled error: ${error.message}`);
  });
}