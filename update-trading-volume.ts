/**
 * Update Hyper-Aggressive Trading Volume
 * 
 * This script increases the daily trading volume to 3 SOL
 * and adjusts other parameters for maximum aggression.
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

// Update hyper-aggressive trading configuration
function updateTradingVolume(): boolean {
  try {
    // Check if config file exists
    if (!fs.existsSync(CONFIG_PATH)) {
      log(`❌ Config file not found at ${CONFIG_PATH}`);
      return false;
    }
    
    // Load existing configuration
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    
    // Update configuration
    log('Updating hyper-aggressive trading configuration...');
    
    // Update daily volume
    if (config.security) {
      config.security.maxDailyTradeVolume = 3.0; // Increase to 3 SOL
      log('✅ Updated maximum daily trade volume to 3.0 SOL');
    }
    
    // Update trading interval (make more aggressive)
    if (config.autonomousMode) {
      config.autonomousMode.tradingInterval = 20000; // Reduce to 20 seconds (was 30)
      log('✅ Reduced trading interval to 20 seconds');
    }
    
    // Update min profit thresholds (make more aggressive)
    Object.keys(config.strategies).forEach(strategy => {
      if (config.strategies[strategy].minProfitThresholdSOL > 0.0001) {
        config.strategies[strategy].minProfitThresholdSOL = 0.0001; // Lower the threshold
      }
    });
    log('✅ Lowered minimum profit thresholds to 0.0001 SOL');
    
    // Save updated configuration
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    log(`✅ Successfully updated hyper-aggressive configuration at ${CONFIG_PATH}`);
    
    // Also update the .env file
    const envPath = './.env.hyper-aggressive';
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Update MAX_DAILY_TRADE_VOLUME
      envContent = envContent.replace(/MAX_DAILY_TRADE_VOLUME=.*/, 'MAX_DAILY_TRADE_VOLUME=3.0');
      
      // Update TRADING_INTERVAL_MS
      envContent = envContent.replace(/TRADING_INTERVAL_MS=.*/, 'TRADING_INTERVAL_MS=20000');
      
      // Update MIN_PROFIT_THRESHOLD_SOL
      envContent = envContent.replace(/MIN_PROFIT_THRESHOLD_SOL=.*/, 'MIN_PROFIT_THRESHOLD_SOL=0.0001');
      
      fs.writeFileSync(envPath, envContent);
      log(`✅ Updated environment configuration at ${envPath}`);
    }
    
    return true;
  } catch (error) {
    log(`❌ Error updating hyper-aggressive trading volume: ${(error as Error).message}`);
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
    content = content.replace(volumePattern, '**Maximum Daily Volume:** Up to 3.0 SOL in trade volume per day');
    
    // Update trading frequency
    const frequencyPattern = /\*\*Ultra-High Frequency:\*\* Trading every [0-9]+ seconds/;
    content = content.replace(frequencyPattern, '**Ultra-High Frequency:** Trading every 20 seconds');
    
    // Update last updated
    const lastUpdatedPattern = /\*\*Last Updated:\*\* .+\n/;
    content = content.replace(lastUpdatedPattern, `**Last Updated:** ${new Date().toLocaleString()}\n`);
    
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
    content = content.replace(volumePattern, '**Maximum Daily Volume:** 3.0 SOL');
    
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

// Main function
async function main(): Promise<void> {
  try {
    log('Starting hyper-aggressive trading volume update...');
    
    // Update configuration
    const configUpdated = updateTradingVolume();
    if (!configUpdated) {
      log('Failed to update trading volume configuration');
      return;
    }
    
    // Update dashboards
    updateProfitDashboard();
    updateVerificationDashboard();
    
    log('Hyper-aggressive trading volume update completed successfully');
    
    // Display final message
    console.log('\n===== HYPER-AGGRESSIVE TRADING VOLUME UPDATED =====');
    console.log('✅ Maximum daily trading volume increased to 3.0 SOL');
    console.log('✅ Trading frequency increased to every 20 seconds');
    console.log('✅ Minimum profit thresholds lowered to 0.0001 SOL');
    console.log('\nYour hyper-aggressive trading is now even more extreme!');
    console.log('The system will use up to 3.0 SOL in daily volume for maximum returns.');
    
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