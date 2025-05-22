/**
 * Optimize RPC Connections
 * 
 * This script disables Instant Nodes and reconfigures the RPC connections
 * to use premium endpoints, improving reliability and performance.
 */

const fs = require('fs');
const path = require('path');

// RPC Configuration path
const RPC_CONFIG_PATH = path.join('./data', 'rpc-config.json');

// QuickNode connection details
const QUICK_NODE_URL = 'https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8';
const QUICK_NODE_WS_URL = 'wss://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8';

// Fallback public endpoints
const PUBLIC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com'
];

// Optimize RPC connections
function optimizeRpcConnections() {
  console.log('Optimizing RPC connections...');
  
  try {
    // Read existing configuration
    const rpcConfig = JSON.parse(fs.readFileSync(RPC_CONFIG_PATH, 'utf8'));
    
    // Create new endpoints configuration
    const optimizedEndpoints = [
      {
        // QuickNode as primary endpoint
        url: QUICK_NODE_URL,
        weight: 10,
        priority: 1,
        maxRequestsPerSecond: 10,
        minuteLimit: 500 // QuickNode has higher limits
      },
      {
        // Backup public endpoint 1
        url: PUBLIC_ENDPOINTS[0],
        weight: 2,
        priority: 2,
        maxRequestsPerSecond: 2
      },
      {
        // Backup public endpoint 2
        url: PUBLIC_ENDPOINTS[1],
        weight: 1,
        priority: 3,
        maxRequestsPerSecond: 1
      }
    ];
    
    // Update configuration
    rpcConfig.endpoints = optimizedEndpoints;
    rpcConfig.poolSize = 3;
    rpcConfig.optimizedAt = new Date().toISOString();
    
    // Optimize rate limit handling for QuickNode
    rpcConfig.rateLimitHandling = {
      enabled: true,
      retryDelayMs: 3000,
      maxRetries: 10,
      exponentialBackoff: true,
      backoffMultiplier: 2,
      requestTracking: {
        enabled: true,
        windowMs: 60000,
        maxRequests: 500 // QuickNode limit
      }
    };
    
    // Save updated configuration
    fs.writeFileSync(RPC_CONFIG_PATH, JSON.stringify(rpcConfig, null, 2));
    console.log('✅ RPC connections optimized! Now using QuickNode as primary endpoint');
    
    return true;
  } catch (error) {
    console.error('Error optimizing RPC connections:', error.message);
    return false;
  }
}

// Create WebSocket configuration
function createWsConfig() {
  console.log('Creating WebSocket configuration...');
  
  try {
    const wsConfigPath = path.join('./data', 'ws-config.json');
    
    const wsConfig = {
      endpoints: [
        {
          url: QUICK_NODE_WS_URL,
          weight: 10,
          priority: 1,
          maxConnections: 5
        }
      ],
      connectionSettings: {
        reconnectInterval: 2000,
        maxReconnectAttempts: 15,
        pingInterval: 20000,
        pongTimeout: 5000
      },
      optimizedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(wsConfigPath, JSON.stringify(wsConfig, null, 2));
    console.log('✅ WebSocket configuration created!');
    
    return true;
  } catch (error) {
    console.error('Error creating WebSocket configuration:', error.message);
    return false;
  }
}

// Create RPC statistics tracking
function createRpcStats() {
  console.log('Setting up RPC statistics tracking...');
  
  try {
    const statsDir = path.join('./data', 'rpc_stats');
    if (!fs.existsSync(statsDir)) {
      fs.mkdirSync(statsDir, { recursive: true });
    }
    
    const statsConfig = {
      enabled: true,
      trackingIntervalMs: 60000, // 1 minute
      historyLength: 24 * 60, // 24 hours worth of minutes
      alertThresholds: {
        errorRatePercent: 5,
        latencyMs: 2000,
        availabilityPercent: 95
      },
      metrics: [
        'requestCount',
        'errorCount',
        'timeoutCount',
        'latencyAvgMs',
        'availability'
      ],
      startedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(path.join(statsDir, 'stats-config.json'), JSON.stringify(statsConfig, null, 2));
    console.log('✅ RPC statistics tracking enabled!');
    
    return true;
  } catch (error) {
    console.error('Error setting up RPC statistics tracking:', error.message);
    return false;
  }
}

// Update trading strategy RPC providers
function updateTradingStrategyRpc() {
  console.log('Updating trading strategy RPC providers...');
  
  try {
    // Update Quantum Omega strategy
    const strategyPath = path.join('./data', 'quantum-omega-strategy.json');
    if (fs.existsSync(strategyPath)) {
      const strategy = JSON.parse(fs.readFileSync(strategyPath, 'utf8'));
      strategy.rpcProvider = 'QuickNode';
      strategy.useInstantNodes = false;
      strategy.usePremiumRpc = true;
      fs.writeFileSync(strategyPath, JSON.stringify(strategy, null, 2));
    }
    
    // Update Flash strategy
    const flashPath = path.join('./data', 'minimal-flash-strategy.json');
    if (fs.existsSync(flashPath)) {
      const strategy = JSON.parse(fs.readFileSync(flashPath, 'utf8'));
      strategy.rpcProvider = 'QuickNode';
      strategy.useInstantNodes = false;
      strategy.usePremiumRpc = true;
      fs.writeFileSync(flashPath, JSON.stringify(strategy, null, 2));
    }
    
    // Update Money Glitch strategy
    const glitchPath = path.join('./data', 'money-glitch-strategy.json');
    if (fs.existsSync(glitchPath)) {
      const strategy = JSON.parse(fs.readFileSync(glitchPath, 'utf8'));
      strategy.rpcProvider = 'QuickNode';
      strategy.useInstantNodes = false;
      strategy.usePremiumRpc = true;
      fs.writeFileSync(glitchPath, JSON.stringify(strategy, null, 2));
    }
    
    // Update Hyperion strategy
    const hyperionPath = path.join('./data', 'hyperion-transformers-strategy.json');
    if (fs.existsSync(hyperionPath)) {
      const strategy = JSON.parse(fs.readFileSync(hyperionPath, 'utf8'));
      strategy.rpcProvider = 'QuickNode';
      strategy.useInstantNodes = false;
      strategy.usePremiumRpc = true;
      fs.writeFileSync(hyperionPath, JSON.stringify(strategy, null, 2));
    }
    
    console.log('✅ Updated trading strategy RPC providers!');
    return true;
  } catch (error) {
    console.error('Error updating trading strategy RPC providers:', error.message);
    return false;
  }
}

// Main function
function main() {
  console.log('Starting RPC optimization process...');
  
  // Backup existing configuration
  const backupPath = path.join('./data', 'rpc-config.backup.json');
  fs.copyFileSync(RPC_CONFIG_PATH, backupPath);
  console.log(`Original configuration backed up to ${backupPath}`);
  
  // Run optimization steps
  const optimizeResult = optimizeRpcConnections();
  const wsResult = createWsConfig();
  const statsResult = createRpcStats();
  const strategyResult = updateTradingStrategyRpc();
  
  if (optimizeResult && wsResult && statsResult && strategyResult) {
    console.log('\n=== RPC OPTIMIZATION COMPLETED SUCCESSFULLY ===');
    console.log('✅ Disabled Instant Nodes');
    console.log('✅ Configured QuickNode as primary RPC provider');
    console.log('✅ Set up WebSocket connections');
    console.log('✅ Enabled RPC statistics tracking');
    console.log('✅ Updated trading strategies to use QuickNode');
    console.log('\nThe system will now use QuickNode for all critical trading operations.');
    console.log('This will improve reliability and reduce timeout errors.\n');
  } else {
    console.error('\n⚠️ RPC optimization completed with some errors');
  }
}

// Run the main function
main();