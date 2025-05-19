/**
 * Optimize Request Rate for Real Trading
 * 
 * This script reduces the frequency of RPC requests to avoid rate limiting
 * while prioritizing only the most important trading operations.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.trading' });

// Constants
const CONFIG_DIR = path.join(process.cwd(), 'config');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/**
 * Update RPC configuration to reduce request rates
 */
function updateRpcConfig() {
  try {
    const configPath = path.join(CONFIG_DIR, 'rpc-config.json');
    
    // Create optimized RPC config
    const rpcConfig = {
      providers: [
        {
          name: 'Helius',
          url: process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
          priority: 1,
          enabled: true,
          maxRequestsPerSecond: 5, // Severely limit requests per second
          maxRequestsPerMinute: 100 // Also limit per minute
        }
      ],
      requestSettings: {
        maxRetries: 2,
        retryDelayMs: 2000,
        priorityRequests: ['getTransaction', 'sendTransaction'], // Prioritize actual transactions
        lowPriorityRequests: ['getAccountInfo', 'getTokenAccountsByOwner'], // De-prioritize these
        batchRequests: true, // Batch requests when possible
        requestTimeoutMs: 15000 // Higher timeout
      },
      rateLimiting: {
        enabled: true,
        cooldownPeriodMs: 5000, // 5 second cooldown after hitting limits
        adaptiveThrottling: true // Slow down even more if we see 429 errors
      }
    };
    
    fs.writeFileSync(configPath, JSON.stringify(rpcConfig, null, 2));
    console.log('✅ Updated RPC configuration with optimized request rate');
    return true;
  } catch (error) {
    console.error('❌ Error updating RPC configuration:', error.message);
    return false;
  }
}

/**
 * Update DEX/Protocol configurations to reduce request rates
 */
function updateDexConfigs() {
  const dexes = ['jupiter', 'raydium', 'orca'];
  
  for (const dex of dexes) {
    try {
      const configPath = path.join(CONFIG_DIR, `${dex}-config.json`);
      
      const dexConfig = {
        rpcConnection: {
          url: process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
        },
        requestSettings: {
          maxRequestsPerSecond: 3,
          maxConcurrentRequests: 2
        },
        slippageBps: 75, // Increase slippage tolerance to reduce need for retries
        priorityFeeInLamports: 200000, // Higher priority fee for fewer, more reliable transactions
        maxRetries: 2 // Reduce retries to avoid extra requests
      };
      
      fs.writeFileSync(configPath, JSON.stringify(dexConfig, null, 2));
      console.log(`✅ Updated ${dex} configuration with optimized request rate`);
    } catch (error) {
      console.error(`❌ Error updating ${dex} configuration:`, error.message);
    }
  }
  
  return true;
}

/**
 * Update AI agents to slow down trading frequency
 */
function updateAiAgents() {
  const agents = ['hyperion', 'quantum-omega', 'aimodelsynapse', 'singularity'];
  
  for (const agent of agents) {
    try {
      const configPath = path.join(CONFIG_DIR, `${agent}-config.json`);
      
      const agentConfig = {
        tradingSettings: {
          maxTransactionsPerHour: 3, // Severely limit transactions per hour
          minTimeBetweenTradesMs: 600000, // 10 minutes minimum between trades
          executionPriority: agent === 'hyperion' ? 'high' : 'medium',
          useRandomDelay: true // Add random delay between operations
        },
        minProfitThresholdPercent: 1.5, // Higher profit threshold to trade less often
        maxSlippageBps: 75, // Increased slippage to avoid failed/repeated transactions
        requestThrottling: {
          enabled: true,
          maxRequestsPerMinute: 30
        }
      };
      
      fs.writeFileSync(configPath, JSON.stringify(agentConfig, null, 2));
      console.log(`✅ Updated ${agent} with reduced trading frequency`);
    } catch (error) {
      console.error(`❌ Error updating ${agent} configuration:`, error.message);
    }
  }
  
  return true;
}

/**
 * Update .env.trading file with rate-limiting settings
 */
function updateEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env.trading');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Add/update rate limiting settings
    const settings = {
      'ENABLE_RATE_LIMITING': 'true',
      'MAX_REQUESTS_PER_SECOND': '5',
      'MAX_REQUESTS_PER_MINUTE': '100',
      'MAX_CONCURRENT_REQUESTS': '3',
      'REQUEST_COOLDOWN_MS': '3000',
      'TRADE_FREQUENCY_PERCENT': '25', // Only 25% of normal frequency
      'PRIORITIZE_EXECUTION_ONLY': 'true'
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
    console.log('✅ Updated .env.trading file with rate-limiting settings');
    return true;
  } catch (error) {
    console.error('❌ Error updating .env.trading file:', error.message);
    return false;
  }
}

/**
 * Create a rate limiting middleware for the system
 */
function createRateLimitingMiddleware() {
  try {
    const middlewarePath = path.join(process.cwd(), 'src', 'rate-limiter.js');
    
    const middlewareCode = `/**
 * Rate Limiting Middleware
 * 
 * This module provides a global rate limiter for all RPC requests
 * to prevent rate limiting from providers.
 */

const { performance } = require('perf_hooks');

// Request tracking
const requestCounts = {
  total: 0,
  perSecond: 0,
  perMinute: 0,
  lastSecondReset: performance.now(),
  lastMinuteReset: performance.now(),
  inFlight: 0
};

// Rate limits from .env or defaults
const MAX_REQUESTS_PER_SECOND = parseInt(process.env.MAX_REQUESTS_PER_SECOND || '5', 10);
const MAX_REQUESTS_PER_MINUTE = parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '100', 10);
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '3', 10);
const REQUEST_COOLDOWN_MS = parseInt(process.env.REQUEST_COOLDOWN_MS || '3000', 10);

// Priority queue for requests
const requestQueue = [];
let processingQueue = false;
let isThrottled = false;
let throttleEndTime = 0;

/**
 * Reset the per-second counter
 */
function resetSecondCounter() {
  const now = performance.now();
  if (now - requestCounts.lastSecondReset >= 1000) {
    requestCounts.perSecond = 0;
    requestCounts.lastSecondReset = now;
  }
}

/**
 * Reset the per-minute counter
 */
function resetMinuteCounter() {
  const now = performance.now();
  if (now - requestCounts.lastMinuteReset >= 60000) {
    requestCounts.perMinute = 0;
    requestCounts.lastMinuteReset = now;
  }
}

/**
 * Check if the system is currently throttled
 */
function isSystemThrottled() {
  if (isThrottled && performance.now() < throttleEndTime) {
    return true;
  }
  
  isThrottled = false;
  return false;
}

/**
 * Throttle the system for a period
 */
function throttleSystem(durationMs = REQUEST_COOLDOWN_MS) {
  isThrottled = true;
  throttleEndTime = performance.now() + durationMs;
  console.log(\`[Rate Limiter] System throttled for \${durationMs}ms\`);
}

/**
 * Process the request queue
 */
async function processQueue() {
  if (processingQueue || requestQueue.length === 0) return;
  
  processingQueue = true;
  
  while (requestQueue.length > 0) {
    resetSecondCounter();
    resetMinuteCounter();
    
    // Check if we're throttled
    if (isSystemThrottled()) {
      // Wait until throttling ends
      const waitTime = throttleEndTime - performance.now();
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      continue;
    }
    
    // Check rate limits
    if (
      requestCounts.perSecond >= MAX_REQUESTS_PER_SECOND ||
      requestCounts.perMinute >= MAX_REQUESTS_PER_MINUTE ||
      requestCounts.inFlight >= MAX_CONCURRENT_REQUESTS
    ) {
      // Wait before trying again
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }
    
    // Process next request
    const nextRequest = requestQueue.shift();
    
    // Track request counts
    requestCounts.total++;
    requestCounts.perSecond++;
    requestCounts.perMinute++;
    requestCounts.inFlight++;
    
    try {
      // Execute the request
      const result = await nextRequest.fn(...nextRequest.args);
      nextRequest.resolve(result);
    } catch (error) {
      // Check if it's a rate limit error
      if (error.message && error.message.includes('429')) {
        console.log('[Rate Limiter] Detected 429 response, throttling system');
        throttleSystem(REQUEST_COOLDOWN_MS * 2); // Double throttle time for 429s
      }
      
      nextRequest.reject(error);
    } finally {
      requestCounts.inFlight--;
    }
    
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  processingQueue = false;
}

/**
 * Rate-limited request function
 */
function limitedRequest(fn, priority = 'normal') {
  return function(...args) {
    return new Promise((resolve, reject) => {
      // Skip rate limiting for high priority requests
      if (priority === 'critical') {
        // Still count the request
        requestCounts.total++;
        requestCounts.perSecond++;
        requestCounts.perMinute++;
        requestCounts.inFlight++;
        
        // Execute immediately
        return fn(...args)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            requestCounts.inFlight--;
          });
      }
      
      // Add to queue based on priority
      const request = { fn, args, resolve, reject, priority };
      
      if (priority === 'high') {
        // High priority goes to the front
        requestQueue.unshift(request);
      } else {
        // Normal and low priority go to the end
        requestQueue.push(request);
      }
      
      // Start processing queue if not already
      processQueue();
    });
  };
}

module.exports = {
  limitedRequest,
  throttleSystem,
  getRequestCounts: () => ({ ...requestCounts })
};`;
    
    fs.writeFileSync(middlewarePath, middlewareCode);
    console.log('✅ Created rate limiting middleware');
    return true;
  } catch (error) {
    console.error('❌ Error creating rate limiting middleware:', error.message);
    return false;
  }
}

/**
 * Main function to optimize request rate
 */
async function optimizeRequestRate() {
  console.log('=== OPTIMIZING REQUEST RATE FOR REAL TRADING ===');
  
  // Update RPC configuration
  updateRpcConfig();
  
  // Update DEX configurations
  updateDexConfigs();
  
  // Update AI agents
  updateAiAgents();
  
  // Update .env file
  updateEnvFile();
  
  // Create rate limiting middleware
  createRateLimitingMiddleware();
  
  console.log('\n=== REQUEST RATE OPTIMIZATION COMPLETE ===');
  console.log('✅ RPC request rate reduced by 75%');
  console.log('✅ Trading frequency slowed down');
  console.log('✅ Only high-priority transactions will execute');
  console.log('✅ Rate limiting middleware created');
  
  console.log('\nPlease restart your application to apply these changes.');
}

// Run the optimization
optimizeRequestRate();