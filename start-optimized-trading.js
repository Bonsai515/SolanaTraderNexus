/**
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
console.log(`Rate limit: ${RATE_LIMIT_CONFIG.global.requestsPerSecond} req/sec, ${RATE_LIMIT_CONFIG.global.requestsPerMinute} req/min`);
console.log(`Trade frequency: ${TRADING_PARAMS.tradeFrequency.tradesPerHour} per hour, min ${TRADING_PARAMS.tradeFrequency.minDelaySecs}s between trades`);
console.log(`Min profit threshold: ${TRADING_PARAMS.minProfitThresholdPercent}%`);
console.log(`Max slippage: ${TRADING_PARAMS.maxSlippageBps / 100}%`);

// Start the trading monitor
console.log('\nStarting trade monitor...');
const monitor = spawn('npx', ['tsx', './src/real-trade-monitor.ts'], { 
  stdio: 'inherit',
  detached: true
});

// Keep the script running
process.stdin.resume();

// Handle exit
process.on('SIGINT', () => {
  console.log('\nShutting down trading system...');
  process.exit();
});

console.log('\n✅ Optimized trading system is now running.');
console.log('You will receive notifications of verified real trades as they occur.');
console.log('Press Ctrl+C to stop the trading system.');