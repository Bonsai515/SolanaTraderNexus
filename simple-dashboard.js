/**
 * Hyperion Trading System - Simplified CLI Dashboard
 * 
 * A lightweight command-line dashboard to monitor system performance,
 * wallet balances, active strategies, and trading profits.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const { exec } = require('child_process');

// Configuration
const CONFIG = {
  apiEndpoint: 'http://localhost:5000',
  wsEndpoint: 'ws://localhost:5000/ws',
  refreshInterval: 10000, // 10 seconds
  logFile: './logs/simple-dashboard.log',
  systemWalletAddress: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
};

// Initialize state
const state = {
  agents: [],
  wallets: {
    system: { balance: 0, lastUpdated: null },
  },
  signals: [],
  transactions: [],
  priceFeed: {},
  apiStatus: {
    server: false,
    solana: false,
    wormhole: false,
  },
  stats: {
    totalExecutions: 0,
    successRate: 0,
    totalProfit: 0,
    failedTransactions: 0,
  },
  lastUpdate: new Date(),
  logs: [],
};

// Make sure log directory exists
const logDir = path.dirname(CONFIG.logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Helper function for logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  state.logs.unshift(logMessage);
  if (state.logs.length > 100) {
    state.logs.pop();
  }
  
  fs.appendFileSync(CONFIG.logFile, logMessage + '\n');
  console.log(logMessage);
}

// Helper function for making HTTP requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Failed to parse response from ${url}: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Request to ${url} failed: ${error.message}`));
    });
    
    req.end();
  });
}

// Connect to WebSocket for real-time updates
function connectWebSocket() {
  try {
    const ws = new WebSocket(CONFIG.wsEndpoint);
    
    ws.on('open', () => {
      log('WebSocket connected');
      ws.send(JSON.stringify({ type: 'subscribe', channels: ['system_health', 'alerts', 'signal_flow'] }));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleWebSocketMessage(message);
      } catch (error) {
        log(`Error parsing WebSocket message: ${error.message}`);
      }
    });
    
    ws.on('error', (error) => {
      log(`WebSocket error: ${error.message}`);
    });
    
    ws.on('close', () => {
      log('WebSocket disconnected. Reconnecting in 5 seconds...');
      setTimeout(connectWebSocket, 5000);
    });
    
    return ws;
  } catch (error) {
    log(`Failed to connect to WebSocket: ${error.message}`);
    return null;
  }
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(message) {
  if (!message || !message.type) return;
  
  switch (message.type) {
    case 'PRICE_UPDATE':
      if (message.data && message.data.pair) {
        state.priceFeed[message.data.pair] = message.data;
      }
      break;
      
    case 'agent_update':
      if (message.agent) {
        const agentIndex = state.agents.findIndex(a => a.id === message.agent.id);
        if (agentIndex >= 0) {
          state.agents[agentIndex] = message.agent;
        } else {
          state.agents.push(message.agent);
        }
      }
      break;
      
    case 'system_wallet_status':
      if (message.address === CONFIG.systemWalletAddress) {
        state.wallets.system = {
          balance: message.balance || 0,
          lastUpdated: new Date(),
        };
      }
      break;
      
    case 'SIGNALS':
      if (Array.isArray(message.data)) {
        state.signals = message.data;
      }
      break;
      
    case 'execution_result':
      if (message.success === true) {
        state.stats.totalExecutions++;
        state.stats.totalProfit += (message.profit || 0);
      } else {
        state.stats.failedTransactions++;
      }
      
      if (message.result) {
        state.transactions.unshift(message.result);
        if (state.transactions.length > 20) {
          state.transactions.pop();
        }
      }
      
      log(`Trade execution: ${message.success ? '✅ SUCCESS' : '❌ FAILED'} - Profit: ${message.profit || 0} USDC`);
      break;
  }
  
  // Update success rate
  if (state.stats.totalExecutions > 0) {
    state.stats.successRate = (state.stats.totalExecutions / (state.stats.totalExecutions + state.stats.failedTransactions)) * 100;
  }
  
  render();
}

// Fetch initial data
async function fetchData() {
  try {
    // Fetch API health
    log('Fetching API health status...');
    try {
      const healthData = await makeRequest(`${CONFIG.apiEndpoint}/api/health`);
      state.apiStatus.server = healthData.status === 'ok';
    } catch (error) {
      log(`⚠️ Could not fetch API health status: ${error.message}`);
      state.apiStatus.server = false;
    }
    
    // Fetch agents
    log('Fetching agent data...');
    try {
      const agentsData = await makeRequest(`${CONFIG.apiEndpoint}/api/agents`);
      if (agentsData && Array.isArray(agentsData)) {
        state.agents = agentsData;
      }
    } catch (error) {
      log(`⚠️ Could not fetch agents data: ${error.message}`);
    }
    
    // Fetch wallet balance
    log('Fetching system wallet balance...');
    try {
      const walletData = await makeRequest(`${CONFIG.apiEndpoint}/api/wallet/${CONFIG.systemWalletAddress}`);
      if (walletData) {
        state.wallets.system = {
          balance: walletData.balance || 0,
          lastUpdated: new Date(),
        };
      }
    } catch (error) {
      log(`⚠️ Could not fetch system wallet balance: ${error.message}`);
    }
    
    // Fetch price feed
    log('Fetching price feed data...');
    try {
      const priceData = await makeRequest(`${CONFIG.apiEndpoint}/api/price-feed/status`);
      if (priceData && priceData.pairs) {
        state.priceFeed = priceData.pairs;
      }
    } catch (error) {
      log(`⚠️ Could not fetch price feed: ${error.message}`);
    }
    
    // Update Solana connection status
    log('Checking Solana connection status...');
    try {
      const solanaStatusData = await makeRequest(`${CONFIG.apiEndpoint}/api/transaction-engine/status`);
      state.apiStatus.solana = solanaStatusData && solanaStatusData.initialized === true;
    } catch (error) {
      state.apiStatus.solana = false;
      log(`⚠️ Could not fetch Solana connection status: ${error.message}`);
    }
    
  } catch (error) {
    log(`Error fetching data: ${error.message}`);
  }
  
  state.lastUpdate = new Date();
  render();
}

// Render the dashboard
function render() {
  console.clear();
  
  // Title
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                      HYPERION TRADING SYSTEM DASHBOARD                     ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  
  // System Status
  console.log('┌─────────────────────────────── SYSTEM STATUS ─────────────────────────────┐');
  console.log(`│ Server API:     ${state.apiStatus.server ? '✅ ONLINE' : '❌ OFFLINE'}                                                │`);
  console.log(`│ Solana RPC:     ${state.apiStatus.solana ? '✅ CONNECTED' : '❌ DISCONNECTED'}                                            │`);
  console.log(`│ Wormhole:       ${state.apiStatus.wormhole ? '✅ CONNECTED' : '❌ DISCONNECTED'}                                            │`);
  console.log(`│ Last Update:    ${state.lastUpdate.toLocaleTimeString()}                                            │`);
  console.log('└──────────────────────────────────────────────────────────────────────────┘');
  
  // System Wallet
  console.log('┌─────────────────────────────── SYSTEM WALLET ─────────────────────────────┐');
  console.log(`│ Address: ${CONFIG.systemWalletAddress}                      │`);
  console.log(`│ Balance: ${state.wallets.system.balance.toFixed(4)} SOL                                              │`);
  console.log(`│ Updated: ${state.wallets.system.lastUpdated ? state.wallets.system.lastUpdated.toLocaleTimeString() : 'Never'}                                                   │`);
  console.log('└──────────────────────────────────────────────────────────────────────────┘');
  
  // Agent Status
  console.log('┌─────────────────────────────── ACTIVE AGENTS ──────────────────────────────┐');
  if (state.agents.length === 0) {
    console.log('│ No agents found                                                            │');
  } else {
    console.log('│ ID               | Name                    | Status    | Profits     | Execs │');
    console.log('│ ----------------- ------------------------- ----------- ------------- ------ │');
    state.agents.forEach(agent => {
      const id = agent.id.padEnd(16);
      const name = agent.name.padEnd(25);
      const status = agent.status.padEnd(10);
      const profit = ((agent.metrics && agent.metrics.totalProfit) || 0).toFixed(2).padStart(10);
      const execs = ((agent.metrics && agent.metrics.totalExecutions) || 0).toString().padStart(5);
      console.log(`│ ${id} | ${name} | ${status} | ${profit} $ | ${execs} │`);
    });
  }
  console.log('└──────────────────────────────────────────────────────────────────────────┘');
  
  // Trading Signals
  console.log('┌─────────────────────────────── ACTIVE SIGNALS ────────────────────────────┐');
  if (state.signals.length === 0) {
    console.log('│ No trading signals available                                               │');
  } else {
    console.log('│ Pair          | Type              | Strength  | Direction | Source         │');
    console.log('│ -------------- ------------------ ----------- ----------- --------------- │');
    state.signals.slice(0, 5).forEach(signal => {
      const pair = signal.pair.padEnd(13);
      const type = signal.type.padEnd(17);
      const strength = signal.strength.padEnd(10);
      const direction = (signal.direction || 'UNKNOWN').padEnd(10);
      const source = (signal.source || 'SYSTEM').padEnd(14);
      console.log(`│ ${pair} | ${type} | ${strength} | ${direction} | ${source} │`);
    });
  }
  console.log('└──────────────────────────────────────────────────────────────────────────┘');
  
  // Recent Transactions
  console.log('┌───────────────────────────── RECENT TRANSACTIONS ─────────────────────────┐');
  if (state.transactions.length === 0) {
    console.log('│ No recent transactions                                                     │');
  } else {
    console.log('│ Time     | Strategy            | Status  | Profit/Loss  | Signature       │');
    console.log('│ --------- --------------------- -------- -------------- --------------- │');
    state.transactions.slice(0, 5).forEach(tx => {
      const time = new Date(tx.timestamp).toLocaleTimeString().padEnd(8);
      const strategy = (tx.strategy || 'UNKNOWN').padEnd(20);
      const status = (tx.success ? 'SUCCESS' : 'FAILED').padEnd(7);
      const profit = (tx.profit || 0).toFixed(4).padStart(13);
      const sig = (tx.signature || 'N/A').substr(0, 14).padEnd(14);
      console.log(`│ ${time} | ${strategy} | ${status} | ${profit} $ | ${sig} │`);
    });
  }
  console.log('└──────────────────────────────────────────────────────────────────────────┘');
  
  // Performance Summary
  console.log('┌───────────────────────────── PERFORMANCE SUMMARY ──────────────────────────┐');
  console.log(`│ Total Executions:  ${state.stats.totalExecutions.toString().padStart(6)}                                                │`);
  console.log(`│ Success Rate:      ${state.stats.successRate.toFixed(2).padStart(6)}%                                                │`);
  console.log(`│ Failed Trades:     ${state.stats.failedTransactions.toString().padStart(6)}                                                │`);
  console.log(`│ Total Profit:      ${state.stats.totalProfit.toFixed(4).padStart(10)} USDC                                    │`);
  console.log('└──────────────────────────────────────────────────────────────────────────┘');
  
  // Recent Logs
  console.log('┌────────────────────────────────── LOGS ────────────────────────────────────┐');
  if (state.logs.length === 0) {
    console.log('│ No logs available                                                          │');
  } else {
    state.logs.slice(0, 5).forEach(log => {
      const logFormatted = log.length > 80 ? log.substring(0, 77) + '...' : log.padEnd(80);
      console.log(`│ ${logFormatted} │`);
    });
  }
  console.log('└──────────────────────────────────────────────────────────────────────────┘');
  console.log('\nPress Ctrl+C to exit');
}

// Start the dashboard application
function startDashboard() {
  log('Starting Hyperion Trading System Dashboard...');
  
  // Connect to WebSocket
  const ws = connectWebSocket();
  
  // Fetch initial data
  fetchData();
  
  // Set up refresh interval
  const intervalId = setInterval(() => {
    fetchData();
  }, CONFIG.refreshInterval);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down dashboard...');
    clearInterval(intervalId);
    if (ws) {
      ws.close();
    }
    process.exit(0);
  });
}

// Start the dashboard
startDashboard();