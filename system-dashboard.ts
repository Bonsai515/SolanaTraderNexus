/**
 * Hyperion Trading System - CLI Dashboard
 * 
 * Command-line dashboard to monitor system performance, wallet balances, 
 * active strategies, execution success/failure, and profits.
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { WebSocket } from 'ws';
import { AgentType, AgentStatus } from './server/agents';
import { SignalType, SignalStrength } from './shared/signalTypes';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  apiEndpoint: 'http://localhost:5000',
  wsEndpoint: 'ws://localhost:5000/ws',
  refreshInterval: 10000, // 10 seconds
  logFile: './logs/trading-dashboard.log',
  systemWalletAddress: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
};

// Initialize state
const state = {
  agents: [],
  wallets: {
    system: { balance: 0, lastUpdated: null },
    trading: {},
    profit: {},
  },
  signals: [],
  transactions: [],
  priceFeed: {},
  apiStatus: {
    server: false,
    solana: false,
    wormhole: false,
    perplexity: false,
    deepseek: false,
  },
  stats: {
    totalExecutions: 0,
    successRate: 0,
    totalProfit: 0,
    failedTransactions: 0,
  },
  lastUpdate: new Date(),
  logs: [] as string[],
};

// Dashboard UI Components
class Dashboard {
  ws: WebSocket | null = null;
  intervalId: NodeJS.Timeout | null = null;
  
  constructor() {
    this.ensureLogDirectory();
  }
  
  private ensureLogDirectory() {
    const logDir = path.dirname(CONFIG.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }
  
  private log(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    state.logs.unshift(logMessage);
    if (state.logs.length > 100) {
      state.logs.pop();
    }
    
    fs.appendFileSync(CONFIG.logFile, logMessage + '\\n');
    console.log(logMessage);
  }
  
  async start() {
    this.log('Starting Hyperion Trading System Dashboard...');
    this.connectWebSocket();
    
    try {
      await this.fetchInitialData();
      this.log('✅ Initial data fetched successfully');
    } catch (error) {
      this.log(`❌ Error fetching initial data: ${error.message}`);
    }
    
    this.intervalId = setInterval(() => this.refresh(), CONFIG.refreshInterval);
    
    this.render();
  }
  
  private connectWebSocket() {
    try {
      this.ws = new WebSocket(CONFIG.wsEndpoint);
      
      this.ws.on('open', () => {
        this.log('WebSocket connected');
        this.ws.send(JSON.stringify({ type: 'subscribe', channels: ['system_health', 'alerts', 'signal_flow'] }));
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          this.log(`Error parsing WebSocket message: ${error.message}`);
        }
      });
      
      this.ws.on('error', (error) => {
        this.log(`WebSocket error: ${error.message}`);
      });
      
      this.ws.on('close', () => {
        this.log('WebSocket disconnected. Reconnecting in 5 seconds...');
        setTimeout(() => this.connectWebSocket(), 5000);
      });
    } catch (error) {
      this.log(`Failed to connect to WebSocket: ${error.message}`);
    }
  }
  
  private handleWebSocketMessage(message: any) {
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
        
        this.log(`Trade execution: ${message.success ? '✅ SUCCESS' : '❌ FAILED'} - Profit: ${message.profit || 0} USDC`);
        break;
    }
    
    // Update success rate
    if (state.stats.totalExecutions > 0) {
      state.stats.successRate = (state.stats.totalExecutions / (state.stats.totalExecutions + state.stats.failedTransactions)) * 100;
    }
    
    this.render();
  }
  
  async fetchInitialData() {
    try {
      // Fetch API health
      const healthResponse = await axios.get(`${CONFIG.apiEndpoint}/api/health`);
      state.apiStatus.server = healthResponse.data.status === 'ok';
      
      // Fetch agents
      const agentsResponse = await axios.get(`${CONFIG.apiEndpoint}/api/agents`);
      if (agentsResponse.data && Array.isArray(agentsResponse.data)) {
        state.agents = agentsResponse.data;
      }
      
      // Fetch wallet balances
      try {
        const walletResponse = await axios.get(`${CONFIG.apiEndpoint}/api/wallet/${CONFIG.systemWalletAddress}`);
        if (walletResponse.data) {
          state.wallets.system = {
            balance: walletResponse.data.balance || 0,
            lastUpdated: new Date(),
          };
        }
      } catch (error) {
        this.log(`⚠️ Could not fetch system wallet balance: ${error.message}`);
      }
      
      // Fetch price feed
      try {
        const priceResponse = await axios.get(`${CONFIG.apiEndpoint}/api/price-feed/status`);
        if (priceResponse.data && priceResponse.data.pairs) {
          state.priceFeed = priceResponse.data.pairs;
        }
      } catch (error) {
        this.log(`⚠️ Could not fetch price feed: ${error.message}`);
      }
      
      // Update Solana connection status
      try {
        const solanaStatusResponse = await axios.get(`${CONFIG.apiEndpoint}/api/transaction-engine/status`);
        state.apiStatus.solana = solanaStatusResponse.data && solanaStatusResponse.data.initialized === true;
      } catch (error) {
        state.apiStatus.solana = false;
      }
      
    } catch (error) {
      this.log(`Error fetching initial data: ${error.message}`);
      throw error;
    }
  }
  
  async refresh() {
    state.lastUpdate = new Date();
    
    try {
      await this.fetchInitialData();
    } catch (error) {
      this.log(`Error refreshing data: ${error.message}`);
    }
    
    this.render();
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    if (this.ws) {
      this.ws.close();
    }
    
    this.log('Dashboard stopped');
  }
  
  render() {
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
    console.log(`│ Perplexity API: ${state.apiStatus.perplexity ? '✅ CONNECTED' : '❌ DISCONNECTED'}                                            │`);
    console.log(`│ DeepSeek API:   ${state.apiStatus.deepseek ? '✅ CONNECTED' : '❌ DISCONNECTED'}                                            │`);
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
        const profit = (agent.metrics?.totalProfit || 0).toFixed(2).padStart(10);
        const execs = (agent.metrics?.totalExecutions || 0).toString().padStart(5);
        console.log(`│ ${id} | ${name} | ${status} | ${profit} $ | ${execs} │`);
      });
    }
    console.log('└──────────────────────────────────────────────────────────────────────────┘');
    
    // Price Feed
    console.log('┌─────────────────────────────── MARKET PRICES ─────────────────────────────┐');
    if (Object.keys(state.priceFeed).length === 0) {
      console.log('│ No price data available                                                    │');
    } else {
      console.log('│ Pair           | Price           | 24h Volume          | 24h Change        │');
      console.log('│ --------------- ----------------- --------------------- ------------------ │');
      Object.entries(state.priceFeed).slice(0, 5).forEach(([pair, data]: [string, any]) => {
        const pairStr = pair.padEnd(14);
        const price = (data.price || 0).toFixed(6).padEnd(16);
        const volume = (data.volume || 0).toFixed(0).padEnd(20);
        const change = (data.priceChange24h || 0).toFixed(2).padEnd(17);
        console.log(`│ ${pairStr} | ${price} | ${volume} | ${change}% │`);
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
}

// Start the dashboard when script is executed directly
if (require.main === module) {
  const dashboard = new Dashboard();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down dashboard...');
    dashboard.stop();
    process.exit(0);
  });
  
  dashboard.start();
}

// Export for potential programmatic usage
export default Dashboard;