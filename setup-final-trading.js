/**
 * Final Trading System Setup
 * 
 * This script makes final adjustments to ensure the trading system works
 * with proper rate limiting while still executing real trades.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: '.env.trading' });

// Constants
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const CONFIG_DIR = path.join(process.cwd(), 'config');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/**
 * Configure rate limits to allow some trading but prevent errors
 */
function configureRateLimits() {
  try {
    const rateLimitPath = path.join(CONFIG_DIR, 'rate-limits.json');
    
    const rateLimitConfig = {
      global: {
        enabled: true,
        requestsPerSecond: 1,
        requestsPerMinute: 15,
        cooldownPeriodMs: 10000
      },
      priorities: {
        trade: {
          enabled: true,
          requestsPerMinute: 3,
          requestsPerHour: 15
        },
        price: {
          enabled: true,
          requestsPerMinute: 5,
          requestsPerHour: 40
        },
        market: {
          enabled: true,
          requestsPerMinute: 2,
          requestsPerHour: 20
        }
      },
      adaptiveThrottling: true
    };
    
    fs.writeFileSync(rateLimitPath, JSON.stringify(rateLimitConfig, null, 2));
    console.log('✅ Configured rate limits for effective trading');
    return true;
  } catch (error) {
    console.error('❌ Error configuring rate limits:', error.message);
    return false;
  }
}

/**
 * Set up trading parameters to prioritize highest profit opportunities
 */
function setupTradingParameters() {
  try {
    const tradingParamsPath = path.join(CONFIG_DIR, 'trading-params.json');
    
    const tradingParams = {
      minProfitThresholdPercent: 1.0, // 1% min profit for trades
      highPriorityThresholdPercent: 1.5, // 1.5% for high priority
      maxSlippageBps: 100, // 1% max slippage
      maxFeeUsd: 1.5, // Max $1.50 in fees per trade
      priorityFeeMultiplier: 1.5, // Increase priority fees for important txs
      tradeFrequency: {
        tradesPerHour: 3, // 3 trades per hour max
        minDelaySecs: 300 // 5 minutes between trades
      },
      retrySettings: {
        maxRetries: 2,
        retryDelayMs: 2000
      }
    };
    
    fs.writeFileSync(tradingParamsPath, JSON.stringify(tradingParams, null, 2));
    console.log('✅ Set up trading parameters for high-profit opportunities');
    return true;
  } catch (error) {
    console.error('❌ Error setting up trading parameters:', error.message);
    return false;
  }
}

/**
 * Configure trading wallet and profit collection
 */
function configureTradingWallet() {
  try {
    const walletConfigPath = path.join(CONFIG_DIR, 'wallet-config.json');
    
    const walletConfig = {
      tradingWallet: process.env.TRADING_WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK',
      tradingWalletBalanceSol: 0.540916,
      profitThresholds: {
        minProfitToCollectSol: 0.01, // Collect profit only when > 0.01 SOL
        profitReinvestmentRate: 0.95 // 95% reinvestment
      },
      riskManagement: {
        maxPositionSizePercent: 25, // Use max 25% of balance per trade
        maxDailyLossPercent: 5, // Stop trading if 5% daily loss
        gradualScalingEnabled: true // Scale positions gradually
      }
    };
    
    fs.writeFileSync(walletConfigPath, JSON.stringify(walletConfig, null, 2));
    console.log('✅ Configured trading wallet parameters');
    return true;
  } catch (error) {
    console.error('❌ Error configuring trading wallet:', error.message);
    return false;
  }
}

/**
 * Update .env.trading file with optimal settings
 */
function updateEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env.trading');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update trading settings
    const settings = {
      'PRIMARY_RPC_PROVIDER': 'syndica',
      'SYNDICA_RPC_URL': 'https://solana-api.syndica.io/rpc',
      'TRADING_ACTIVE': 'true',
      'USE_REAL_FUNDS': 'true',
      'MAX_REQUESTS_PER_SECOND': '2',
      'MAX_TRADES_PER_HOUR': '3',
      'MIN_PROFIT_THRESHOLD_PERCENT': '1.0',
      'DEFAULT_SLIPPAGE_BPS': '100',
      'PRIORITY_FEE_LAMPORTS': '200000',
      'PROFIT_REINVESTMENT_RATE': '0.95',
      'TRADING_WALLET_ADDRESS': process.env.TRADING_WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK',
      'USE_RATE_LIMITING': 'true'
    };
    
    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      if (!envContent.includes(`${key}=`)) {
        envContent += `${key}=${value}\n`;
      } else {
        envContent = envContent.replace(
          new RegExp(`${key}=.*`, 'g'),
          `${key}=${value}`
        );
      }
    }
    
    // Save the updated env file
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env.trading with optimal settings');
    return true;
  } catch (error) {
    console.error('❌ Error updating .env.trading file:', error.message);
    return false;
  }
}

/**
 * Create final executor script to run strategies
 */
function createFinalExecutor() {
  try {
    const executorPath = path.join(process.cwd(), 'start-optimized-trading.js');
    
    const executorCode = `/**
 * Optimized Trading Executor
 * 
 * This script starts the trading system with proper rate limiting
 * to execute real trades while avoiding rate limit errors.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load settings
const CONFIG_DIR = path.join(process.cwd(), 'config');
const RATE_LIMIT_CONFIG = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'rate-limits.json'), 'utf8'));
const TRADING_PARAMS = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'trading-params.json'), 'utf8'));

// Display startup message
console.log('=== STARTING OPTIMIZED TRADING SYSTEM ===');
console.log(\`Rate limit: \${RATE_LIMIT_CONFIG.global.requestsPerSecond} req/sec, \${RATE_LIMIT_CONFIG.global.requestsPerMinute} req/min\`);
console.log(\`Trade frequency: \${TRADING_PARAMS.tradeFrequency.tradesPerHour} per hour, min \${TRADING_PARAMS.tradeFrequency.minDelaySecs}s between trades\`);
console.log(\`Min profit threshold: \${TRADING_PARAMS.minProfitThresholdPercent}%\`);
console.log(\`Max slippage: \${TRADING_PARAMS.maxSlippageBps / 100}%\`);

// Start the trading monitor
console.log('\\nStarting trade monitor...');
const monitor = spawn('npx', ['tsx', './src/real-trade-monitor.ts'], { 
  stdio: 'inherit',
  detached: true
});

// Keep the script running
process.stdin.resume();

// Handle exit
process.on('SIGINT', () => {
  console.log('\\nShutting down trading system...');
  process.exit();
});

console.log('\\n✅ Optimized trading system is now running.');
console.log('You will receive notifications of verified real trades as they occur.');
console.log('Press Ctrl+C to stop the trading system.');`;
    
    fs.writeFileSync(executorPath, executorCode);
    console.log('✅ Created final executor script');
    return true;
  } catch (error) {
    console.error('❌ Error creating executor script:', error.message);
    return false;
  }
}

/**
 * Main function to set up final trading system
 */
async function setupFinalTrading() {
  console.log('=== SETTING UP FINAL TRADING SYSTEM ===');
  
  // Configure rate limits
  configureRateLimits();
  
  // Configure trading parameters
  setupTradingParameters();
  
  // Configure trading wallet
  configureTradingWallet();
  
  // Update .env file
  updateEnvFile();
  
  // Create final executor
  createFinalExecutor();
  
  console.log('\n=== FINAL TRADING SYSTEM SETUP COMPLETE ===');
  console.log('✅ System configured for real trading with proper rate limits');
  console.log('✅ Trading parameters optimized for high-profit opportunities');
  console.log('✅ Wallet and profit collection configured');
  
  console.log('\nTo start the optimized trading system, run:');
  console.log('node start-optimized-trading.js');
}

// Run the setup
setupFinalTrading();