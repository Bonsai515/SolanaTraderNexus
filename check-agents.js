#!/usr/bin/env node

/**
 * Quick Agent Status Checker
 * 
 * A simple utility to check the status of all trading agents with a single command.
 * Use this for a quick status overview without using the full dashboard.
 */

const http = require('http');

// Color formatting for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Helper function for making API requests
function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

// Main function to check agent status
async function checkAgentStatus() {
  try {
    console.log(`${colors.bold}${colors.cyan}HYPERION TRADING SYSTEM - AGENT STATUS${colors.reset}\n`);
    
    // Check API health
    const healthCheck = await makeRequest('GET', '/api/health');
    if (healthCheck && healthCheck.status === 'ok') {
      console.log(`${colors.green}✓ System online${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ System health check failed${colors.reset}`);
    }
    
    // Get agent data
    const agentsData = await makeRequest('GET', '/api/agents');
    
    if (!agentsData || !Array.isArray(agentsData) || agentsData.length === 0) {
      console.log(`${colors.yellow}No agents found in the system${colors.reset}`);
      return;
    }
    
    console.log('\n');
    
    // Format and display agent status
    const tableData = agentsData.map(agent => {
      const statusSymbol = agent.active ? '✓' : '✗';
      const statusColor = agent.active ? colors.green : colors.red;
      const executions = agent.metrics?.totalExecutions || 0;
      const profit = agent.metrics?.totalProfit ? agent.metrics.totalProfit.toFixed(4) : '0.0000';
      
      return {
        id: agent.id,
        name: agent.name,
        status: `${statusColor}${statusSymbol}${colors.reset}`,
        state: agent.status,
        executions,
        profit
      };
    });
    
    // Print the results in a table-like format
    console.log(`${colors.bold}ID\t\t\tNAME\t\t\t\tSTATUS\tSTATE\t\tEXECS\tPROFIT${colors.reset}`);
    console.log('-'.repeat(100));
    
    tableData.forEach(agent => {
      // Pad and truncate fields to fit in columns
      const id = agent.id.padEnd(15).substring(0, 15);
      const name = agent.name.padEnd(30).substring(0, 30);
      const state = agent.state.padEnd(10).substring(0, 10);
      const executions = String(agent.executions).padEnd(5).substring(0, 5);
      const profit = String(agent.profit).padEnd(8).substring(0, 8);
      
      console.log(`${id}\t${name}\t${agent.status}\t${state}\t${executions}\t${profit} USDC`);
    });
    
    // Check wallet status
    const systemWallet = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
    const walletData = await makeRequest('GET', `/api/wallet/${systemWallet}`);
    
    console.log('\n');
    
    if (walletData) {
      const balance = walletData.balance ? walletData.balance.toFixed(6) : '0.000000';
      console.log(`${colors.bold}System Wallet:${colors.reset} ${systemWallet}`);
      console.log(`${colors.bold}Balance:${colors.reset} ${balance} SOL`);
    } else {
      console.log(`${colors.yellow}System wallet status unavailable${colors.reset}`);
    }
    
    console.log('\n');
    console.log(`For detailed information, run the dashboard with: ${colors.cyan}./launch-dashboard.sh${colors.reset}`);
    console.log(`For agent control options, use: ${colors.cyan}./agent-control.js${colors.reset}`);
    
  } catch (error) {
    console.log(`${colors.red}Error checking agent status: ${error.message}${colors.reset}`);
    console.log(`${colors.yellow}Make sure the trading server is running on port 5000${colors.reset}`);
  }
}

// Run the status check
checkAgentStatus();