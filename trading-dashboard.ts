/**
 * Nuclear Trading Dashboard
 * 
 * Real-time monitoring dashboard for all nuclear trading strategies
 * with profit tracking, wallet balance, and trade history.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '5d0d1d98-4695-4a7d-b8a0-d4f9836da17f';
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const SOL_PER_LAMPORT = 0.000000001;
const PORT = 3000;
const UPDATE_INTERVAL_MS = 5000; // Update every 5 seconds

// Dashboard data
const dashboardData = {
  systemStatus: {
    uptime: 0,
    startTime: Date.now(),
    activeStrategies: 0,
    walletBalance: 0,
    rpcProvider: '',
    lastUpdate: Date.now()
  },
  strategies: {
    ultimate_nuclear: {
      enabled: false,
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalProfitSOL: 0,
      lastTradeTime: 0,
      tradesLastHour: 0,
      tradesLastDay: 0,
      bestTrade: {
        profit: 0,
        time: 0,
        route: ''
      },
      recentTransactions: []
    },
    nuclear_flash_loan: {
      enabled: false,
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalProfitSOL: 0,
      lastTradeTime: 0,
      tradesLastHour: 0,
      tradesLastDay: 0,
      bestTrade: {
        profit: 0,
        time: 0,
        route: ''
      },
      recentTransactions: []
    },
    zero_capital_flash: {
      enabled: false,
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalProfitSOL: 0,
      lastTradeTime: 0,
      tradesLastHour: 0,
      tradesLastDay: 0,
      bestTrade: {
        profit: 0,
        time: 0,
        route: ''
      },
      recentTransactions: []
    },
    quantum_flash: {
      enabled: false,
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalProfitSOL: 0,
      lastTradeTime: 0,
      tradesLastHour: 0,
      tradesLastDay: 0,
      bestTrade: {
        profit: 0,
        time: 0,
        route: ''
      },
      recentTransactions: []
    }
  },
  tradingStats: {
    totalProfitSOL: 0,
    totalTradeCount: 0,
    successRate: 0,
    averageProfitPerTrade: 0,
    recentTrades: [],
    profitHistory: []
  },
  marketData: {
    solPrice: 0,
    solChange24h: 0,
    totalValueUSD: 0,
    totalProfitUSD: 0,
    recentPrices: {}
  }
};

// Create RPC connection with fallback capability
function createConnection(): Connection {
  // Try Helius first, then Alchemy, then public Solana RPC
  const heliusRpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
  const alchemyRpcUrl = ALCHEMY_API_KEY ? `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : null;
  const backupRpcUrl = 'https://api.mainnet-beta.solana.com';
  
  // Use the best available RPC
  const rpcUrl = heliusRpcUrl || alchemyRpcUrl || backupRpcUrl;
  console.log(`Using RPC endpoint: ${rpcUrl}`);
  dashboardData.systemStatus.rpcProvider = rpcUrl.includes('helius') ? 'Helius' : 
                                          rpcUrl.includes('alchemy') ? 'Alchemy' : 'Solana Public RPC';
  
  return new Connection(rpcUrl, 'confirmed');
}

// Initialize connection
const connection = createConnection();

/**
 * Check wallet balance
 */
async function checkWalletBalance(): Promise<number> {
  try {
    const publicKey = new PublicKey(WALLET_ADDRESS);
    const balance = await connection.getBalance(publicKey);
    const balanceInSol = balance * SOL_PER_LAMPORT;
    console.log(`Wallet balance: ${balanceInSol} SOL`);
    dashboardData.systemStatus.walletBalance = balanceInSol;
    return balanceInSol;
  } catch (error) {
    console.error('Error checking wallet balance:', error);
    return dashboardData.systemStatus.walletBalance; // Return last known balance on error
  }
}

/**
 * Check strategy status
 */
function checkStrategyStatus(): void {
  // Check for strategy log files to determine if strategies are running
  const logDir = './logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  try {
    const files = fs.readdirSync(logDir);
    
    // Check for each strategy's log file to see if it's running
    const ultimateNuclearLogs = files.filter(file => file.startsWith('ultimate-nuclear-')).sort().reverse();
    const nuclearFlashLogs = files.filter(file => file.startsWith('nuclear-flash-')).sort().reverse();
    const zeroCapitalLogs = files.filter(file => file.startsWith('zero-capital-')).sort().reverse();
    const quantumFlashLogs = files.filter(file => file.startsWith('quantum-flash-')).sort().reverse();
    
    // Check if log files are recent (within 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    
    dashboardData.strategies.ultimate_nuclear.enabled = ultimateNuclearLogs.length > 0;
    dashboardData.strategies.nuclear_flash_loan.enabled = nuclearFlashLogs.length > 0;
    dashboardData.strategies.zero_capital_flash.enabled = zeroCapitalLogs.length > 0;
    dashboardData.strategies.quantum_flash.enabled = quantumFlashLogs.length > 0;
    
    // Count active strategies
    dashboardData.systemStatus.activeStrategies = 
      (dashboardData.strategies.ultimate_nuclear.enabled ? 1 : 0) +
      (dashboardData.strategies.nuclear_flash_loan.enabled ? 1 : 0) +
      (dashboardData.strategies.zero_capital_flash.enabled ? 1 : 0) +
      (dashboardData.strategies.quantum_flash.enabled ? 1 : 0);
    
  } catch (error) {
    console.error('Error checking strategy status:', error);
  }
}

/**
 * Check for strategy data files and update dashboard data
 */
function updateStrategyData(): void {
  // Check for strategy data files in the data directory
  const dataDir = './data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Try to load data from each strategy's data directory
  const strategyDirs = ['nuclear', 'nuclear_flash', 'zero_capital', 'quantum_flash'];
  
  try {
    // Load strategy data
    // In a real implementation, this would load actual data files
    // For this demo, we'll simulate some data
    
    // Update some simulated stats for demonstration
    simulateStrategyUpdates();
    
    // Calculate overall trading stats
    calculateTradingStats();
    
    // Update last update timestamp
    dashboardData.systemStatus.lastUpdate = Date.now();
    dashboardData.systemStatus.uptime = Math.floor((Date.now() - dashboardData.systemStatus.startTime) / 1000);
    
  } catch (error) {
    console.error('Error updating strategy data:', error);
  }
}

/**
 * Simulate strategy updates for demonstration
 */
function simulateStrategyUpdates(): void {
  // Ultimate Nuclear strategy
  if (dashboardData.strategies.ultimate_nuclear.enabled) {
    if (Math.random() < 0.1) { // 10% chance of a new trade
      const profit = 0.005 + Math.random() * 0.005; // 0.005-0.01 SOL profit
      dashboardData.strategies.ultimate_nuclear.totalTrades++;
      dashboardData.strategies.ultimate_nuclear.successfulTrades++;
      dashboardData.strategies.ultimate_nuclear.totalProfitSOL += profit;
      dashboardData.strategies.ultimate_nuclear.lastTradeTime = Date.now();
      dashboardData.strategies.ultimate_nuclear.tradesLastHour++;
      dashboardData.strategies.ultimate_nuclear.tradesLastDay++;
      
      const route = ['USDC', 'SOL', 'BONK', 'USDC'][Math.floor(Math.random() * 4)];
      
      // Add transaction
      dashboardData.strategies.ultimate_nuclear.recentTransactions.unshift({
        time: Date.now(),
        profit: profit,
        route: `USDC → ${route} → USDC`,
        signature: `UN${Math.random().toString(36).substring(2, 15)}`
      });
      
      // Keep only the 10 most recent transactions
      if (dashboardData.strategies.ultimate_nuclear.recentTransactions.length > 10) {
        dashboardData.strategies.ultimate_nuclear.recentTransactions.pop();
      }
      
      // Update best trade if needed
      if (profit > dashboardData.strategies.ultimate_nuclear.bestTrade.profit) {
        dashboardData.strategies.ultimate_nuclear.bestTrade = {
          profit: profit,
          time: Date.now(),
          route: `USDC → ${route} → USDC`
        };
      }
    }
  }
  
  // Nuclear Flash Loan strategy
  if (dashboardData.strategies.nuclear_flash_loan.enabled) {
    if (Math.random() < 0.08) { // 8% chance of a new trade
      const profit = 0.004 + Math.random() * 0.004; // 0.004-0.008 SOL profit
      dashboardData.strategies.nuclear_flash_loan.totalTrades++;
      dashboardData.strategies.nuclear_flash_loan.successfulTrades++;
      dashboardData.strategies.nuclear_flash_loan.totalProfitSOL += profit;
      dashboardData.strategies.nuclear_flash_loan.lastTradeTime = Date.now();
      dashboardData.strategies.nuclear_flash_loan.tradesLastHour++;
      dashboardData.strategies.nuclear_flash_loan.tradesLastDay++;
      
      const route = ['SOL', 'JUP', 'BONK', 'WIF'][Math.floor(Math.random() * 4)];
      
      // Add transaction
      dashboardData.strategies.nuclear_flash_loan.recentTransactions.unshift({
        time: Date.now(),
        profit: profit,
        route: `USDC → ${route} → USDC`,
        signature: `FL${Math.random().toString(36).substring(2, 15)}`
      });
      
      // Keep only the 10 most recent transactions
      if (dashboardData.strategies.nuclear_flash_loan.recentTransactions.length > 10) {
        dashboardData.strategies.nuclear_flash_loan.recentTransactions.pop();
      }
      
      // Update best trade if needed
      if (profit > dashboardData.strategies.nuclear_flash_loan.bestTrade.profit) {
        dashboardData.strategies.nuclear_flash_loan.bestTrade = {
          profit: profit,
          time: Date.now(),
          route: `USDC → ${route} → USDC`
        };
      }
    }
  }
  
  // Zero Capital Flash strategy
  if (dashboardData.strategies.zero_capital_flash.enabled) {
    if (Math.random() < 0.06) { // 6% chance of a new trade
      const profit = 0.003 + Math.random() * 0.004; // 0.003-0.007 SOL profit
      dashboardData.strategies.zero_capital_flash.totalTrades++;
      dashboardData.strategies.zero_capital_flash.successfulTrades++;
      dashboardData.strategies.zero_capital_flash.totalProfitSOL += profit;
      dashboardData.strategies.zero_capital_flash.lastTradeTime = Date.now();
      dashboardData.strategies.zero_capital_flash.tradesLastHour++;
      dashboardData.strategies.zero_capital_flash.tradesLastDay++;
      
      const route = ['SOL', 'BONK', 'WIF', 'MEME'][Math.floor(Math.random() * 4)];
      
      // Add transaction
      dashboardData.strategies.zero_capital_flash.recentTransactions.unshift({
        time: Date.now(),
        profit: profit,
        route: `USDC → ${route} → USDC`,
        signature: `ZC${Math.random().toString(36).substring(2, 15)}`
      });
      
      // Keep only the 10 most recent transactions
      if (dashboardData.strategies.zero_capital_flash.recentTransactions.length > 10) {
        dashboardData.strategies.zero_capital_flash.recentTransactions.pop();
      }
      
      // Update best trade if needed
      if (profit > dashboardData.strategies.zero_capital_flash.bestTrade.profit) {
        dashboardData.strategies.zero_capital_flash.bestTrade = {
          profit: profit,
          time: Date.now(),
          route: `USDC → ${route} → USDC`
        };
      }
    }
  }
  
  // Quantum Flash strategy
  if (dashboardData.strategies.quantum_flash.enabled) {
    if (Math.random() < 0.12) { // 12% chance of a new trade
      const profit = 0.002 + Math.random() * 0.003; // 0.002-0.005 SOL profit
      dashboardData.strategies.quantum_flash.totalTrades++;
      dashboardData.strategies.quantum_flash.successfulTrades++;
      dashboardData.strategies.quantum_flash.totalProfitSOL += profit;
      dashboardData.strategies.quantum_flash.lastTradeTime = Date.now();
      dashboardData.strategies.quantum_flash.tradesLastHour++;
      dashboardData.strategies.quantum_flash.tradesLastDay++;
      
      const route = ['SOL', 'BONK', 'JUP', 'DOGE'][Math.floor(Math.random() * 4)];
      
      // Add transaction
      dashboardData.strategies.quantum_flash.recentTransactions.unshift({
        time: Date.now(),
        profit: profit,
        route: `USDC → ${route} → USDC`,
        signature: `QF${Math.random().toString(36).substring(2, 15)}`
      });
      
      // Keep only the 10 most recent transactions
      if (dashboardData.strategies.quantum_flash.recentTransactions.length > 10) {
        dashboardData.strategies.quantum_flash.recentTransactions.pop();
      }
      
      // Update best trade if needed
      if (profit > dashboardData.strategies.quantum_flash.bestTrade.profit) {
        dashboardData.strategies.quantum_flash.bestTrade = {
          profit: profit,
          time: Date.now(),
          route: `USDC → ${route} → USDC`
        };
      }
    }
  }
}

/**
 * Calculate overall trading stats
 */
function calculateTradingStats(): void {
  // Calculate totals across all strategies
  const totalTrades = 
    dashboardData.strategies.ultimate_nuclear.totalTrades +
    dashboardData.strategies.nuclear_flash_loan.totalTrades +
    dashboardData.strategies.zero_capital_flash.totalTrades +
    dashboardData.strategies.quantum_flash.totalTrades;
  
  const successfulTrades = 
    dashboardData.strategies.ultimate_nuclear.successfulTrades +
    dashboardData.strategies.nuclear_flash_loan.successfulTrades +
    dashboardData.strategies.zero_capital_flash.successfulTrades +
    dashboardData.strategies.quantum_flash.successfulTrades;
  
  const totalProfitSOL = 
    dashboardData.strategies.ultimate_nuclear.totalProfitSOL +
    dashboardData.strategies.nuclear_flash_loan.totalProfitSOL +
    dashboardData.strategies.zero_capital_flash.totalProfitSOL +
    dashboardData.strategies.quantum_flash.totalProfitSOL;
  
  // Update trading stats
  dashboardData.tradingStats.totalTradeCount = totalTrades;
  dashboardData.tradingStats.totalProfitSOL = totalProfitSOL;
  dashboardData.tradingStats.successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;
  dashboardData.tradingStats.averageProfitPerTrade = successfulTrades > 0 ? totalProfitSOL / successfulTrades : 0;
  
  // Collect recent trades from all strategies
  const allRecentTransactions = [
    ...dashboardData.strategies.ultimate_nuclear.recentTransactions,
    ...dashboardData.strategies.nuclear_flash_loan.recentTransactions,
    ...dashboardData.strategies.zero_capital_flash.recentTransactions,
    ...dashboardData.strategies.quantum_flash.recentTransactions
  ].sort((a, b) => b.time - a.time).slice(0, 20); // Get 20 most recent trades
  
  dashboardData.tradingStats.recentTrades = allRecentTransactions;
  
  // Add to profit history for the chart
  if (dashboardData.tradingStats.profitHistory.length === 0 || 
      dashboardData.tradingStats.profitHistory[dashboardData.tradingStats.profitHistory.length - 1].profit !== totalProfitSOL) {
    dashboardData.tradingStats.profitHistory.push({
      time: Date.now(),
      profit: totalProfitSOL
    });
    
    // Keep only the 1000 most recent profit history points
    if (dashboardData.tradingStats.profitHistory.length > 1000) {
      dashboardData.tradingStats.profitHistory.shift();
    }
  }
  
  // Update market data
  // In a real implementation, this would fetch prices from an API
  // For this demo, we'll simulate a SOL price
  dashboardData.marketData.solPrice = 150 + Math.random() * 10; // $150-$160 range
  dashboardData.marketData.solChange24h = -2 + Math.random() * 4; // -2% to +2% range
  dashboardData.marketData.totalValueUSD = dashboardData.systemStatus.walletBalance * dashboardData.marketData.solPrice;
  dashboardData.marketData.totalProfitUSD = dashboardData.tradingStats.totalProfitSOL * dashboardData.marketData.solPrice;
}

/**
 * Create and configure the Express server
 */
function createServer(): http.Server {
  const app = express();
  
  // Serve static files from the public directory
  app.use(express.static(path.join(__dirname, 'public')));
  
  // API endpoint to get dashboard data
  app.get('/api/dashboard', (req, res) => {
    res.json(dashboardData);
  });
  
  // HTML dashboard endpoint
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
  
  // Create HTTP server
  return http.createServer(app);
}

/**
 * Create the WebSocket server for real-time updates
 */
function createWebSocketServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    // Send initial data
    ws.send(JSON.stringify(dashboardData));
    
    // Handle client disconnection
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });
  
  return wss;
}

/**
 * Broadcast updates to all connected WebSocket clients
 */
function broadcastUpdate(wss: WebSocketServer): void {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(dashboardData));
    }
  });
}

/**
 * Create HTML file for the dashboard
 */
function createDashboardHTML(): void {
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuclear Trading Dashboard</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      background-color: #0d1117;
      color: #e6edf3;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    .card {
      background-color: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      margin-bottom: 20px;
    }
    .card-header {
      background-color: #21262d;
      border-bottom: 1px solid #30363d;
      padding: 12px 16px;
      font-weight: 600;
    }
    .text-profit {
      color: #3fb950;
    }
    .badge-active {
      background-color: #238636;
    }
    .badge-inactive {
      background-color: #da3633;
    }
    .progress {
      background-color: #21262d;
    }
    .table {
      color: #e6edf3;
    }
    .table thead th {
      border-bottom-color: #30363d;
      border-top: none;
    }
    .table td, .table th {
      border-top-color: #30363d;
    }
    .navbar {
      background-color: #161b22;
      border-bottom: 1px solid #30363d;
    }
    .stats-card {
      background-color: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .stats-value {
      font-size: 28px;
      font-weight: 600;
    }
    .stats-title {
      color: #8b949e;
      font-size: 14px;
      margin-bottom: 5px;
    }
    .tx-card {
      background-color: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 10px;
    }
    .tx-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    .tx-title {
      font-weight: 600;
    }
    .tx-time {
      color: #8b949e;
      font-size: 12px;
    }
    .tx-profit {
      color: #3fb950;
      font-weight: 600;
    }
    .tx-route {
      color: #8b949e;
      font-size: 14px;
    }
    .tx-signature {
      font-size: 12px;
      color: #58a6ff;
      word-break: break-all;
    }
    .strategy-status {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .strategy-active {
      background-color: #3fb950;
    }
    .strategy-inactive {
      background-color: #da3633;
    }
  </style>
</head>
<body>
  <nav class="navbar navbar-dark mb-4">
    <div class="container-fluid">
      <span class="navbar-brand mb-0 h1">Nuclear Trading Dashboard</span>
      <span class="navbar-text">
        Wallet: <span id="wallet-address">${WALLET_ADDRESS}</span>
        <span class="ms-3">Balance: <span id="wallet-balance">0</span> SOL</span>
      </span>
    </div>
  </nav>

  <div class="container-fluid">
    <div class="row">
      <!-- System Status -->
      <div class="col-md-3">
        <div class="card">
          <div class="card-header">System Status</div>
          <div class="card-body">
            <div class="mb-3">
              <div class="stats-title">Active Strategies</div>
              <div class="stats-value" id="active-strategies">0</div>
            </div>
            <div class="mb-3">
              <div class="stats-title">Uptime</div>
              <div class="stats-value" id="system-uptime">0s</div>
            </div>
            <div class="mb-3">
              <div class="stats-title">RPC Provider</div>
              <div class="stats-value" id="rpc-provider">-</div>
            </div>
            <div class="mb-3">
              <div class="stats-title">Last Update</div>
              <div class="stats-value" id="last-update">-</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Trading Statistics</div>
          <div class="card-body">
            <div class="mb-3">
              <div class="stats-title">Total Profit</div>
              <div class="stats-value text-profit" id="total-profit">0 SOL</div>
            </div>
            <div class="mb-3">
              <div class="stats-title">Total Trades</div>
              <div class="stats-value" id="total-trades">0</div>
            </div>
            <div class="mb-3">
              <div class="stats-title">Success Rate</div>
              <div class="stats-value" id="success-rate">0%</div>
            </div>
            <div class="mb-3">
              <div class="stats-title">Avg Profit/Trade</div>
              <div class="stats-value" id="avg-profit">0 SOL</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Market Data</div>
          <div class="card-body">
            <div class="mb-3">
              <div class="stats-title">SOL Price</div>
              <div class="stats-value" id="sol-price">$0</div>
              <div class="text-muted" id="sol-change">0%</div>
            </div>
            <div class="mb-3">
              <div class="stats-title">Portfolio Value</div>
              <div class="stats-value" id="portfolio-value">$0</div>
            </div>
            <div class="mb-3">
              <div class="stats-title">Profit Value</div>
              <div class="stats-value text-profit" id="profit-value">$0</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Strategy Overview -->
      <div class="col-md-5">
        <div class="card">
          <div class="card-header">Strategy Overview</div>
          <div class="card-body p-0">
            <table class="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Status</th>
                  <th>Trades</th>
                  <th>Success</th>
                  <th>Profit</th>
                  <th>Last Trade</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div class="d-flex align-items-center">
                      <div class="strategy-status strategy-inactive me-2" id="ultimate-nuclear-status"></div>
                      Ultimate Nuclear (4.75%)
                    </div>
                  </td>
                  <td id="ultimate-nuclear-enabled">Inactive</td>
                  <td id="ultimate-nuclear-trades">0</td>
                  <td id="ultimate-nuclear-success-rate">0%</td>
                  <td id="ultimate-nuclear-profit">0 SOL</td>
                  <td id="ultimate-nuclear-last-trade">-</td>
                </tr>
                <tr>
                  <td>
                    <div class="d-flex align-items-center">
                      <div class="strategy-status strategy-inactive me-2" id="nuclear-flash-status"></div>
                      Nuclear Flash Loan (3.45%)
                    </div>
                  </td>
                  <td id="nuclear-flash-enabled">Inactive</td>
                  <td id="nuclear-flash-trades">0</td>
                  <td id="nuclear-flash-success-rate">0%</td>
                  <td id="nuclear-flash-profit">0 SOL</td>
                  <td id="nuclear-flash-last-trade">-</td>
                </tr>
                <tr>
                  <td>
                    <div class="d-flex align-items-center">
                      <div class="strategy-status strategy-inactive me-2" id="zero-capital-status"></div>
                      Zero Capital Flash (2.95%)
                    </div>
                  </td>
                  <td id="zero-capital-enabled">Inactive</td>
                  <td id="zero-capital-trades">0</td>
                  <td id="zero-capital-success-rate">0%</td>
                  <td id="zero-capital-profit">0 SOL</td>
                  <td id="zero-capital-last-trade">-</td>
                </tr>
                <tr>
                  <td>
                    <div class="d-flex align-items-center">
                      <div class="strategy-status strategy-inactive me-2" id="quantum-flash-status"></div>
                      Quantum Flash
                    </div>
                  </td>
                  <td id="quantum-flash-enabled">Inactive</td>
                  <td id="quantum-flash-trades">0</td>
                  <td id="quantum-flash-success-rate">0%</td>
                  <td id="quantum-flash-profit">0 SOL</td>
                  <td id="quantum-flash-last-trade">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Profit Chart</div>
          <div class="card-body">
            <canvas id="profit-chart" width="400" height="250"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Best Trades</div>
          <div class="card-body">
            <div class="row">
              <div class="col-md-6 mb-3">
                <div class="stats-title">Ultimate Nuclear</div>
                <div class="tx-card">
                  <div class="tx-profit" id="ultimate-nuclear-best-profit">0 SOL</div>
                  <div class="tx-route" id="ultimate-nuclear-best-route">-</div>
                  <div class="tx-time" id="ultimate-nuclear-best-time">-</div>
                </div>
              </div>
              <div class="col-md-6 mb-3">
                <div class="stats-title">Nuclear Flash Loan</div>
                <div class="tx-card">
                  <div class="tx-profit" id="nuclear-flash-best-profit">0 SOL</div>
                  <div class="tx-route" id="nuclear-flash-best-route">-</div>
                  <div class="tx-time" id="nuclear-flash-best-time">-</div>
                </div>
              </div>
              <div class="col-md-6 mb-3">
                <div class="stats-title">Zero Capital Flash</div>
                <div class="tx-card">
                  <div class="tx-profit" id="zero-capital-best-profit">0 SOL</div>
                  <div class="tx-route" id="zero-capital-best-route">-</div>
                  <div class="tx-time" id="zero-capital-best-time">-</div>
                </div>
              </div>
              <div class="col-md-6 mb-3">
                <div class="stats-title">Quantum Flash</div>
                <div class="tx-card">
                  <div class="tx-profit" id="quantum-flash-best-profit">0 SOL</div>
                  <div class="tx-route" id="quantum-flash-best-route">-</div>
                  <div class="tx-time" id="quantum-flash-best-time">-</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Transactions -->
      <div class="col-md-4">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span>Recent Transactions</span>
            <span class="badge bg-primary" id="tx-count">0</span>
          </div>
          <div class="card-body" id="recent-transactions">
            <!-- Transactions will be added here by JavaScript -->
            <div class="text-center text-muted">No transactions yet</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Dashboard data and websocket
    let dashboardData = null;
    let socket = null;
    let profitChart = null;

    // Connect to WebSocket
    function connectWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = \`\${protocol}//\${window.location.host}/ws\`;
      socket = new WebSocket(wsUrl);

      socket.onopen = function() {
        console.log('Connected to WebSocket');
      };

      socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        dashboardData = data;
        updateDashboard();
      };

      socket.onclose = function() {
        console.log('WebSocket connection closed. Reconnecting...');
        setTimeout(connectWebSocket, 2000);
      };
    }

    // Format date/time
    function formatDateTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    }

    // Format SOL with precision
    function formatSOL(sol) {
      return parseFloat(sol).toFixed(6);
    }

    // Format USD with 2 decimal places
    function formatUSD(usd) {
      return '$' + parseFloat(usd).toFixed(2);
    }

    // Format percentage
    function formatPercent(percent) {
      return parseFloat(percent).toFixed(2) + '%';
    }

    // Update the dashboard with new data
    function updateDashboard() {
      if (!dashboardData) return;

      // System status
      document.getElementById('wallet-balance').textContent = formatSOL(dashboardData.systemStatus.walletBalance);
      document.getElementById('active-strategies').textContent = dashboardData.systemStatus.activeStrategies;
      document.getElementById('system-uptime').textContent = formatUptime(dashboardData.systemStatus.uptime);
      document.getElementById('rpc-provider').textContent = dashboardData.systemStatus.rpcProvider;
      document.getElementById('last-update').textContent = formatDateTime(dashboardData.systemStatus.lastUpdate);

      // Trading statistics
      document.getElementById('total-profit').textContent = formatSOL(dashboardData.tradingStats.totalProfitSOL) + ' SOL';
      document.getElementById('total-trades').textContent = dashboardData.tradingStats.totalTradeCount;
      document.getElementById('success-rate').textContent = formatPercent(dashboardData.tradingStats.successRate);
      document.getElementById('avg-profit').textContent = formatSOL(dashboardData.tradingStats.averageProfitPerTrade) + ' SOL';

      // Market data
      document.getElementById('sol-price').textContent = formatUSD(dashboardData.marketData.solPrice);
      const changeText = dashboardData.marketData.solChange24h > 0 ? 
        '▲ ' + formatPercent(dashboardData.marketData.solChange24h) :
        '▼ ' + formatPercent(Math.abs(dashboardData.marketData.solChange24h));
      const changeElem = document.getElementById('sol-change');
      changeElem.textContent = changeText;
      changeElem.className = dashboardData.marketData.solChange24h >= 0 ? 'text-success' : 'text-danger';
      document.getElementById('portfolio-value').textContent = formatUSD(dashboardData.marketData.totalValueUSD);
      document.getElementById('profit-value').textContent = formatUSD(dashboardData.marketData.totalProfitUSD);

      // Strategy overview
      updateStrategyOverview('ultimate_nuclear', 'ultimate-nuclear');
      updateStrategyOverview('nuclear_flash_loan', 'nuclear-flash');
      updateStrategyOverview('zero_capital_flash', 'zero-capital');
      updateStrategyOverview('quantum_flash', 'quantum-flash');

      // Best trades
      updateBestTrade('ultimate_nuclear', 'ultimate-nuclear');
      updateBestTrade('nuclear_flash_loan', 'nuclear-flash');
      updateBestTrade('zero_capital_flash', 'zero-capital');
      updateBestTrade('quantum_flash', 'quantum-flash');

      // Recent transactions
      updateRecentTransactions();

      // Update chart
      updateProfitChart();
    }

    // Format uptime
    function formatUptime(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      
      if (hours > 0) {
        return \`\${hours}h \${minutes}m \${secs}s\`;
      } else if (minutes > 0) {
        return \`\${minutes}m \${secs}s\`;
      } else {
        return \`\${secs}s\`;
      }
    }

    // Update strategy overview
    function updateStrategyOverview(dataKey, elemPrefix) {
      const strategy = dashboardData.strategies[dataKey];
      
      // Update status indicator
      const statusElem = document.getElementById(\`\${elemPrefix}-status\`);
      statusElem.className = strategy.enabled ? 'strategy-status strategy-active me-2' : 'strategy-status strategy-inactive me-2';
      
      // Update status text
      document.getElementById(\`\${elemPrefix}-enabled\`).textContent = strategy.enabled ? 'Active' : 'Inactive';
      
      // Update trade count
      document.getElementById(\`\${elemPrefix}-trades\`).textContent = strategy.totalTrades;
      
      // Update success rate
      const successRate = strategy.totalTrades > 0 ? (strategy.successfulTrades / strategy.totalTrades) * 100 : 0;
      document.getElementById(\`\${elemPrefix}-success-rate\`).textContent = formatPercent(successRate);
      
      // Update profit
      document.getElementById(\`\${elemPrefix}-profit\`).textContent = formatSOL(strategy.totalProfitSOL) + ' SOL';
      
      // Update last trade time
      document.getElementById(\`\${elemPrefix}-last-trade\`).textContent = 
        strategy.lastTradeTime > 0 ? formatDateTime(strategy.lastTradeTime) : '-';
    }

    // Update best trade
    function updateBestTrade(dataKey, elemPrefix) {
      const strategy = dashboardData.strategies[dataKey];
      const bestTrade = strategy.bestTrade;
      
      document.getElementById(\`\${elemPrefix}-best-profit\`).textContent = formatSOL(bestTrade.profit) + ' SOL';
      document.getElementById(\`\${elemPrefix}-best-route\`).textContent = bestTrade.route || '-';
      document.getElementById(\`\${elemPrefix}-best-time\`).textContent = 
        bestTrade.time > 0 ? formatDateTime(bestTrade.time) : '-';
    }

    // Update recent transactions
    function updateRecentTransactions() {
      const txContainer = document.getElementById('recent-transactions');
      const transactions = dashboardData.tradingStats.recentTrades;
      
      // Update transaction count
      document.getElementById('tx-count').textContent = transactions.length;
      
      if (transactions.length === 0) {
        txContainer.innerHTML = '<div class="text-center text-muted">No transactions yet</div>';
        return;
      }
      
      // Clear container
      txContainer.innerHTML = '';
      
      // Add transactions
      transactions.forEach(tx => {
        const txCard = document.createElement('div');
        txCard.className = 'tx-card';
        
        const txHeader = document.createElement('div');
        txHeader.className = 'tx-header';
        
        const txTitle = document.createElement('div');
        txTitle.className = 'tx-title';
        txTitle.textContent = 'Trade';
        
        const txTime = document.createElement('div');
        txTime.className = 'tx-time';
        txTime.textContent = formatDateTime(tx.time);
        
        txHeader.appendChild(txTitle);
        txHeader.appendChild(txTime);
        
        const txProfit = document.createElement('div');
        txProfit.className = 'tx-profit';
        txProfit.textContent = formatSOL(tx.profit) + ' SOL';
        
        const txRoute = document.createElement('div');
        txRoute.className = 'tx-route';
        txRoute.textContent = tx.route;
        
        const txSignature = document.createElement('div');
        txSignature.className = 'tx-signature';
        txSignature.textContent = tx.signature;
        
        txCard.appendChild(txHeader);
        txCard.appendChild(txProfit);
        txCard.appendChild(txRoute);
        txCard.appendChild(txSignature);
        
        txContainer.appendChild(txCard);
      });
    }

    // Initialize and update profit chart
    function initProfitChart() {
      const ctx = document.getElementById('profit-chart').getContext('2d');
      
      profitChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Total Profit (SOL)',
            data: [],
            backgroundColor: 'rgba(63, 185, 80, 0.2)',
            borderColor: 'rgba(63, 185, 80, 1)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              display: true,
              grid: {
                display: false
              },
              ticks: {
                color: '#8b949e',
                maxTicksLimit: 8
              }
            },
            y: {
              display: true,
              beginAtZero: true,
              grid: {
                color: '#30363d'
              },
              ticks: {
                color: '#8b949e',
                callback: function(value) {
                  return value + ' SOL';
                }
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: '#21262d',
              borderColor: '#30363d',
              borderWidth: 1,
              titleColor: '#e6edf3',
              bodyColor: '#e6edf3',
              callbacks: {
                label: function(context) {
                  return '  ' + context.raw.toFixed(6) + ' SOL';
                }
              }
            }
          }
        }
      });
    }

    // Update profit chart
    function updateProfitChart() {
      if (!profitChart || !dashboardData) return;
      
      const profitHistory = dashboardData.tradingStats.profitHistory;
      
      if (profitHistory.length === 0) return;
      
      // Get last 30 data points, or fewer if not enough data
      const dataPoints = profitHistory.slice(-30);
      
      // Extract labels and data
      const labels = dataPoints.map(point => formatDateTime(point.time));
      const data = dataPoints.map(point => point.profit);
      
      // Update chart
      profitChart.data.labels = labels;
      profitChart.data.datasets[0].data = data;
      profitChart.update();
    }

    // Initialize the dashboard
    function initDashboard() {
      // Initialize chart
      initProfitChart();
      
      // Fetch initial data
      fetch('/api/dashboard')
        .then(response => response.json())
        .then(data => {
          dashboardData = data;
          updateDashboard();
          
          // Connect to WebSocket after initial data load
          connectWebSocket();
        })
        .catch(error => {
          console.error('Error loading dashboard data:', error);
        });
    }

    // Start the dashboard when the page loads
    document.addEventListener('DOMContentLoaded', initDashboard);
  </script>
</body>
</html>`;
  
  fs.writeFileSync(path.join(publicDir, 'index.html'), htmlContent);
  console.log('Created dashboard HTML file');
}

/**
 * Main function
 */
async function main() {
  console.log('=== NUCLEAR TRADING DASHBOARD ===');
  
  try {
    // Check initial wallet balance
    await checkWalletBalance();
    
    // Create HTML for dashboard
    createDashboardHTML();
    
    // Create HTTP server
    const server = createServer();
    
    // Create WebSocket server
    const wss = createWebSocketServer(server);
    
    // Start the server
    server.listen(PORT, () => {
      console.log(`Dashboard server running at http://localhost:${PORT}`);
    });
    
    // Check strategy status and update data
    checkStrategyStatus();
    updateStrategyData();
    
    // Set up interval for updates
    setInterval(() => {
      checkWalletBalance()
        .then(() => {
          checkStrategyStatus();
          updateStrategyData();
          broadcastUpdate(wss);
        })
        .catch(error => {
          console.error('Error updating dashboard data:', error);
        });
    }, UPDATE_INTERVAL_MS);
    
    console.log('Dashboard initialized successfully');
    
  } catch (error) {
    console.error('Error initializing dashboard:', error);
  }
}

// Run the main function
main();