/**
 * Update Profit Thresholds for Trading System
 * 
 * This script adjusts the profit thresholds to capture
 * better opportunities with higher minimum profit requirements.
 */

import * as fs from 'fs';

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

// Update profit thresholds
function updateProfitThresholds(): boolean {
  try {
    // Check if config file exists
    if (!fs.existsSync(CONFIG_PATH)) {
      log(`❌ Config file not found at ${CONFIG_PATH}`);
      return false;
    }
    
    // Load existing configuration
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    
    // Update configuration
    log('Updating profit thresholds for trading strategies...');
    
    // Update profit thresholds - higher thresholds for better quality trades
    Object.keys(config.strategies).forEach(strategy => {
      // Top tier strategies get the lowest (but still improved) threshold 
      if (['nuclearFlashArbitrage', 'hyperionMoneyLoop'].includes(strategy)) {
        config.strategies[strategy].minProfitThresholdSOL = 0.0008; // Higher threshold
      } 
      // Mid tier strategies get medium threshold
      else if (['flashLoanSingularity', 'quantumArbitrage', 'hyperNetworkBlitz'].includes(strategy)) {
        config.strategies[strategy].minProfitThresholdSOL = 0.001; // Higher threshold
      }
      // Lower tier strategies get highest threshold
      else {
        config.strategies[strategy].minProfitThresholdSOL = 0.0012; // Highest threshold
      }
    });
    
    log('✅ Updated profit thresholds:');
    log('  - Nuclear/Hyperion strategies: 0.0008 SOL minimum');
    log('  - Flash Loan/Quantum/Hypernetwork strategies: 0.001 SOL minimum');
    log('  - Other strategies: 0.0012 SOL minimum');
    
    // Save updated configuration
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    log(`✅ Successfully updated trading configuration at ${CONFIG_PATH}`);
    
    // Also update the .env file
    const envPath = './.env.hyper-aggressive';
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Update MIN_PROFIT_THRESHOLD_SOL to the average value
      envContent = envContent.replace(/MIN_PROFIT_THRESHOLD_SOL=.*/, 'MIN_PROFIT_THRESHOLD_SOL=0.001');
      
      fs.writeFileSync(envPath, envContent);
      log(`✅ Updated environment configuration at ${envPath}`);
    }
    
    return true;
  } catch (error) {
    log(`❌ Error updating profit thresholds: ${(error as Error).message}`);
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
    
    // Update profit thresholds
    const thresholdPattern = /\*\*Ultra-Low Profit Thresholds:\*\* Takes trades with as little as [0-9.]+ SOL profit/;
    content = content.replace(thresholdPattern, '**Higher Profit Thresholds:** Takes trades with at least 0.0008-0.0012 SOL profit');
    
    // Update last updated
    const lastUpdatedPattern = /\*\*Last Updated:\*\* .+\n/;
    content = content.replace(lastUpdatedPattern, `**Last Updated:** ${new Date().toLocaleString()}\n`);
    
    // Update enabled strategies table
    const strategiesPattern = /\| Strategy \| Position Size \| Min Profit \| Priority \|\n\|----------|--------------|-----------|----------\|(\n\| .* \| [0-9]+% \| [0-9.]+ SOL \| [0-9]+ \|)+/;
    
    const newStrategiesTable = 
`| Strategy | Position Size | Min Profit | Priority |
|----------|--------------|-----------|----------|
| flashLoanSingularity | 85% | 0.001 SOL | 10 |
| quantumArbitrage | 85% | 0.001 SOL | 10 |
| jitoBundle | 85% | 0.0012 SOL | 10 |
| cascadeFlash | 85% | 0.0012 SOL | 10 |
| temporalBlockArbitrage | 85% | 0.0012 SOL | 10 |
| hyperNetworkBlitz | 85% | 0.001 SOL | 10 |
| ultraQuantumMEV | 85% | 0.0012 SOL | 10 |
| nuclearFlashArbitrage | 95% | 0.0008 SOL | 10 |
| hyperionMoneyLoop | 95% | 0.0008 SOL | 10 |`;
    
    content = content.replace(strategiesPattern, newStrategiesTable);
    
    // Save updated dashboard
    fs.writeFileSync(dashboardPath, content);
    log(`✅ Updated hyper-aggressive profit dashboard at ${dashboardPath}`);
    
    return true;
  } catch (error) {
    log(`❌ Error updating hyper-aggressive profit dashboard: ${(error as Error).message}`);
    return false;
  }
}

// Update verification dashboard
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
    
    // Update profit thresholds
    const thresholdPattern = /\*\*Higher Profit Thresholds:\*\* Minimum [0-9.]+ SOL profit per trade/;
    content = content.replace(thresholdPattern, '**Higher Profit Thresholds:** Minimum 0.0008-0.0012 SOL profit per trade');
    
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

// Create updated trade booster script
function createUpdatedBooster(): boolean {
  try {
    const boosterPath = './boost-trading-updated.sh';
    const boosterContent = `#!/bin/bash
echo "=== UPDATED TRADE BOOSTER ==="
echo "Higher profit thresholds for better quality trades"
echo ""

# Wait 3 seconds for cancellation
for i in {3..1}; do
  echo -ne "Starting updated trade booster in $i seconds...\\r"
  sleep 1
done

echo ""
echo "🔥 Boosting trade quality with higher profit thresholds..."

# Stop any running hyper-aggressive trader
pkill -f "hyper_aggressive_trader.ts"

# Export the environment variables
export TRADING_INTERVAL_MS=120000
export MAX_POSITION_SIZE_PERCENT=95
export MIN_PROFIT_THRESHOLD_SOL=0.001
export SLIPPAGE_TOLERANCE=1.5
export MAX_DAILY_TRADE_VOLUME=3.5

# Start the hyper-aggressive trader with higher profit thresholds
npx ts-node ./nexus_engine/hyper_aggressive_trader.ts
`;
    
    fs.writeFileSync(boosterPath, boosterContent);
    fs.chmodSync(boosterPath, '755'); // Make executable
    log(`✅ Created updated trade booster script at ${boosterPath}`);
    
    return true;
  } catch (error) {
    log(`❌ Error creating updated booster: ${(error as Error).message}`);
    return false;
  }
}

// Main function
async function main(): Promise<void> {
  try {
    log('Starting profit threshold update...');
    
    // Update configuration
    const configUpdated = updateProfitThresholds();
    if (!configUpdated) {
      log('Failed to update profit thresholds');
      return;
    }
    
    // Update dashboards
    updateProfitDashboard();
    updateVerificationDashboard();
    
    // Create updated trade booster script
    createUpdatedBooster();
    
    log('Profit threshold update completed successfully');
    
    // Display final message
    console.log('\n===== PROFIT THRESHOLDS UPDATED =====');
    console.log('✅ Nuclear/Hyperion strategies: 0.0008 SOL minimum profit');
    console.log('✅ Flash Loan/Quantum/Hypernetwork strategies: 0.001 SOL minimum profit');
    console.log('✅ Other strategies: 0.0012 SOL minimum profit');
    console.log('\nThis ensures each trade has higher quality with better profit potential.');
    console.log('\nTo restart trading with these settings, run:');
    console.log('./boost-trading-updated.sh');
    
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