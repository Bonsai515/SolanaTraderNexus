#!/usr/bin/env ts-node

/**
 * Hyperion Trading System - Agent Control CLI
 * 
 * Command-line utility for activating, deactivating, and checking status of trading agents.
 * Provides fine-grained control over individual agents from the terminal.
 */

import * as http from 'http';
import * as readline from 'readline';

interface AgentMetrics {
  totalExecutions: number;
  successRate: number;
  totalProfit: number;
  lastExecution?: string;
}

interface AgentWallets {
  trading?: string;
  profit?: string;
  fee?: string;
  stealth?: string[];
}

interface AgentStatus {
  id: string;
  name: string;
  type: string;
  status: string;
  active: boolean;
  wallets?: AgentWallets;
  metrics?: AgentMetrics;
  lastError?: string;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  id?: string;
  signature?: string;
}

interface WalletStatus {
  address: string;
  status: string;
  balance: number;
  lastUpdated: string;
}

const CONFIG = {
  apiEndpoint: 'http://localhost:5000',
  agentIds: {
    hyperion: 'hyperion-1',
    quantumOmega: 'quantum-omega-1',
    singularity: 'singularity-1',
  },
  systemWalletAddress: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
};

// Color formatting for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
};

// Helper function for making API requests
function makeRequest(method: string, path: string, data: any = null): Promise<any> {
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
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Display the agent control menu
function displayMenu(): void {
  console.clear();
  console.log(`${colors.bold}${colors.cyan}HYPERION TRADING SYSTEM - AGENT CONTROL${colors.reset}\n`);
  console.log(`${colors.bold}COMMANDS:${colors.reset}`);
  console.log(`  ${colors.green}status${colors.reset}             Check status of all agents`);
  console.log(`  ${colors.green}activate [agent]${colors.reset}   Activate a specific agent: hyperion, quantum, singularity`);
  console.log(`  ${colors.green}activate-all${colors.reset}       Activate all trading agents`);
  console.log(`  ${colors.green}deactivate [agent]${colors.reset} Deactivate a specific agent`);
  console.log(`  ${colors.green}deactivate-all${colors.reset}     Deactivate all trading agents`);
  console.log(`  ${colors.green}real-funds [on/off]${colors.reset} Enable/disable trading with real funds`);
  console.log(`  ${colors.green}wallet${colors.reset}             Check system wallet status`);
  console.log(`  ${colors.green}test-tx${colors.reset}            Execute a test transaction`);
  console.log(`  ${colors.green}quit${colors.reset}               Exit the control panel\n`);
}

// Create a command-line interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `${colors.bold}${colors.cyan}hyperion>${colors.reset} `,
});

// Main function to check agent status
async function checkAgentStatus(): Promise<void> {
  try {
    const agentsData: AgentStatus[] = await makeRequest('GET', '/api/agents');
    
    console.log(`\n${colors.bold}AGENT STATUS:${colors.reset}`);
    console.log('--------------------------------------------------------------------------------');
    
    if (!agentsData || !Array.isArray(agentsData) || agentsData.length === 0) {
      console.log(`${colors.yellow}No agents found in the system${colors.reset}`);
      return;
    }
    
    agentsData.forEach(agent => {
      const statusColor = agent.active ? colors.green : colors.red;
      const statusText = agent.active ? 'ACTIVE' : 'INACTIVE';
      const statusSymbol = agent.active ? '✓' : '✗';
      
      console.log(`${colors.bold}${agent.name}${colors.reset}`);
      console.log(`  ID:       ${agent.id}`);
      console.log(`  Status:   ${statusColor}${statusSymbol} ${statusText}${colors.reset} (${agent.status})`);
      console.log(`  Type:     ${agent.type}`);
      
      if (agent.metrics) {
        console.log(`  Executions: ${agent.metrics.totalExecutions || 0}`);
        console.log(`  Success Rate: ${agent.metrics.successRate ? agent.metrics.successRate.toFixed(2) + '%' : 'N/A'}`);
        console.log(`  Total Profit: ${agent.metrics.totalProfit ? agent.metrics.totalProfit.toFixed(4) + ' USDC' : '0.0000 USDC'}`);
      }
      
      if (agent.wallets) {
        if (agent.wallets.trading) {
          console.log(`  Trading Wallet: ${agent.wallets.trading}`);
        }
        if (agent.wallets.profit) {
          console.log(`  Profit Wallet:  ${agent.wallets.profit}`);
        }
      }
      
      console.log('--------------------------------------------------------------------------------');
    });
  } catch (error: any) {
    console.log(`${colors.red}Error checking agent status: ${error.message}${colors.reset}`);
  }
}

// Function to activate an agent
async function activateAgent(agentName: string): Promise<void> {
  let agentId: string;
  
  switch (agentName.toLowerCase()) {
    case 'hyperion':
      agentId = CONFIG.agentIds.hyperion;
      break;
    case 'quantum':
    case 'omega':
    case 'quantum-omega':
      agentId = CONFIG.agentIds.quantumOmega;
      break;
    case 'singularity':
      agentId = CONFIG.agentIds.singularity;
      break;
    default:
      console.log(`${colors.red}Unknown agent: ${agentName}${colors.reset}`);
      console.log(`${colors.yellow}Available agents: hyperion, quantum, singularity${colors.reset}`);
      return;
  }
  
  try {
    const response: ApiResponse = await makeRequest('POST', `/api/agents/activate/${agentId}`);
    
    if (response && response.success) {
      console.log(`${colors.green}✓ Agent ${agentName} activated successfully${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Failed to activate agent ${agentName}${colors.reset}`);
      if (response && response.message) {
        console.log(`${colors.yellow}  ${response.message}${colors.reset}`);
      }
    }
  } catch (error: any) {
    console.log(`${colors.red}Error activating agent ${agentName}: ${error.message}${colors.reset}`);
  }
}

// Function to activate all agents
async function activateAllAgents(): Promise<void> {
  try {
    const response: ApiResponse = await makeRequest('POST', '/api/agents/activate-all');
    
    if (response && response.success) {
      console.log(`${colors.green}✓ All agents activated successfully${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Failed to activate all agents${colors.reset}`);
      if (response && response.message) {
        console.log(`${colors.yellow}  ${response.message}${colors.reset}`);
      }
    }
  } catch (error: any) {
    console.log(`${colors.red}Error activating agents: ${error.message}${colors.reset}`);
  }
}

// Function to deactivate an agent
async function deactivateAgent(agentName: string): Promise<void> {
  let agentId: string;
  
  switch (agentName.toLowerCase()) {
    case 'hyperion':
      agentId = CONFIG.agentIds.hyperion;
      break;
    case 'quantum':
    case 'omega':
    case 'quantum-omega':
      agentId = CONFIG.agentIds.quantumOmega;
      break;
    case 'singularity':
      agentId = CONFIG.agentIds.singularity;
      break;
    default:
      console.log(`${colors.red}Unknown agent: ${agentName}${colors.reset}`);
      console.log(`${colors.yellow}Available agents: hyperion, quantum, singularity${colors.reset}`);
      return;
  }
  
  try {
    const response: ApiResponse = await makeRequest('POST', `/api/agents/deactivate/${agentId}`);
    
    if (response && response.success) {
      console.log(`${colors.green}✓ Agent ${agentName} deactivated successfully${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Failed to deactivate agent ${agentName}${colors.reset}`);
      if (response && response.message) {
        console.log(`${colors.yellow}  ${response.message}${colors.reset}`);
      }
    }
  } catch (error: any) {
    console.log(`${colors.red}Error deactivating agent ${agentName}: ${error.message}${colors.reset}`);
  }
}

// Function to deactivate all agents
async function deactivateAllAgents(): Promise<void> {
  try {
    const response: ApiResponse = await makeRequest('POST', '/api/agents/deactivate-all');
    
    if (response && response.success) {
      console.log(`${colors.green}✓ All agents deactivated successfully${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Failed to deactivate all agents${colors.reset}`);
      if (response && response.message) {
        console.log(`${colors.yellow}  ${response.message}${colors.reset}`);
      }
    }
  } catch (error: any) {
    console.log(`${colors.red}Error deactivating agents: ${error.message}${colors.reset}`);
  }
}

// Function to check wallet status
async function checkWalletStatus(): Promise<void> {
  try {
    const walletData: WalletStatus = await makeRequest('GET', `/api/wallet/${CONFIG.systemWalletAddress}`);
    
    console.log(`\n${colors.bold}SYSTEM WALLET STATUS:${colors.reset}`);
    console.log('--------------------------------------------------------------------------------');
    
    if (!walletData) {
      console.log(`${colors.yellow}No wallet data available${colors.reset}`);
      return;
    }
    
    console.log(`${colors.bold}Address:${colors.reset} ${CONFIG.systemWalletAddress}`);
    console.log(`${colors.bold}Balance:${colors.reset} ${walletData.balance ? walletData.balance.toFixed(6) + ' SOL' : 'Unknown'}`);
    console.log(`${colors.bold}Status:${colors.reset} ${walletData.status || 'Unknown'}`);
    console.log(`${colors.bold}Last Updated:${colors.reset} ${walletData.lastUpdated || 'Unknown'}`);
    
    console.log('--------------------------------------------------------------------------------');
  } catch (error: any) {
    console.log(`${colors.red}Error checking wallet status: ${error.message}${colors.reset}`);
  }
}

// Function to toggle real funds usage
async function toggleRealFunds(setting: string): Promise<void> {
  if (setting !== 'on' && setting !== 'off') {
    console.log(`${colors.red}Invalid setting. Use 'on' or 'off'.${colors.reset}`);
    return;
  }
  
  const useRealFunds = setting === 'on';
  
  try {
    const response: ApiResponse = await makeRequest('POST', '/api/real-funds', { useRealFunds });
    
    if (response && response.success) {
      if (useRealFunds) {
        console.log(`${colors.green}✓ Trading with REAL FUNDS ENABLED${colors.reset}`);
        console.log(`${colors.yellow}⚠️ Warning: System will now trade with real funds!${colors.reset}`);
      } else {
        console.log(`${colors.green}✓ Trading with real funds DISABLED${colors.reset}`);
      }
    } else {
      console.log(`${colors.red}✗ Failed to update real funds setting${colors.reset}`);
      if (response && response.message) {
        console.log(`${colors.yellow}  ${response.message}${colors.reset}`);
      }
    }
  } catch (error: any) {
    console.log(`${colors.red}Error updating real funds setting: ${error.message}${colors.reset}`);
  }
}

// Function to execute a test transaction
async function executeTestTransaction(): Promise<void> {
  try {
    console.log(`${colors.yellow}Executing test transaction...${colors.reset}`);
    
    const response: ApiResponse = await makeRequest('POST', '/api/test-transaction');
    
    if (response && response.success) {
      console.log(`${colors.green}✓ Test transaction executed successfully${colors.reset}`);
      console.log(`${colors.bold}Transaction ID:${colors.reset} ${response.id || 'Unknown'}`);
      console.log(`${colors.bold}Signature:${colors.reset} ${response.signature || 'Unknown'}`);
    } else {
      console.log(`${colors.red}✗ Failed to execute test transaction${colors.reset}`);
      if (response && response.message) {
        console.log(`${colors.yellow}  ${response.message}${colors.reset}`);
      }
    }
  } catch (error: any) {
    console.log(`${colors.red}Error executing test transaction: ${error.message}${colors.reset}`);
  }
}

// Process commands
async function processCommand(input: string): Promise<void> {
  const [command, ...args] = input.trim().split(' ');
  
  switch (command) {
    case 'status':
      await checkAgentStatus();
      break;
      
    case 'activate':
      if (args.length === 0) {
        console.log(`${colors.red}Please specify an agent to activate${colors.reset}`);
        console.log(`${colors.yellow}Usage: activate [hyperion|quantum|singularity]${colors.reset}`);
      } else {
        await activateAgent(args[0]);
      }
      break;
      
    case 'activate-all':
      await activateAllAgents();
      break;
      
    case 'deactivate':
      if (args.length === 0) {
        console.log(`${colors.red}Please specify an agent to deactivate${colors.reset}`);
        console.log(`${colors.yellow}Usage: deactivate [hyperion|quantum|singularity]${colors.reset}`);
      } else {
        await deactivateAgent(args[0]);
      }
      break;
      
    case 'deactivate-all':
      await deactivateAllAgents();
      break;
      
    case 'real-funds':
      if (args.length === 0 || (args[0] !== 'on' && args[0] !== 'off')) {
        console.log(`${colors.red}Please specify 'on' or 'off'${colors.reset}`);
        console.log(`${colors.yellow}Usage: real-funds [on|off]${colors.reset}`);
      } else {
        await toggleRealFunds(args[0]);
      }
      break;
      
    case 'wallet':
      await checkWalletStatus();
      break;
      
    case 'test-tx':
      await executeTestTransaction();
      break;
      
    case 'quit':
    case 'exit':
      console.log(`${colors.cyan}Exiting agent control panel${colors.reset}`);
      rl.close();
      process.exit(0);
      break;
      
    case 'help':
      displayMenu();
      break;
      
    case '':
      // Just re-display the prompt
      break;
      
    default:
      console.log(`${colors.red}Unknown command: ${command}${colors.reset}`);
      console.log(`${colors.yellow}Type 'help' to see available commands${colors.reset}`);
  }
}

// Start the CLI
async function startCLI(): Promise<void> {
  displayMenu();
  
  try {
    // Initial check of API connectivity
    console.log(`${colors.cyan}Checking system connection...${colors.reset}`);
    const healthCheck = await makeRequest('GET', '/api/health');
    
    if (healthCheck && healthCheck.status === 'ok') {
      console.log(`${colors.green}✓ Successfully connected to Hyperion Trading System${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️ Warning: System status check returned unexpected result${colors.reset}`);
    }
  } catch (error: any) {
    console.log(`${colors.red}✗ Failed to connect to Hyperion Trading System: ${error.message}${colors.reset}`);
    console.log(`${colors.yellow}⚠️ Make sure the server is running and accessible at http://localhost:5000${colors.reset}`);
  }
  
  rl.prompt();
  
  rl.on('line', async (line) => {
    await processCommand(line);
    rl.prompt();
  }).on('close', () => {
    console.log(`${colors.cyan}Exiting agent control panel${colors.reset}`);
    process.exit(0);
  });
}

// Start the CLI if this is run directly
if (require.main === module) {
  startCLI();
}

export {
  checkAgentStatus,
  activateAgent,
  deactivateAgent,
  activateAllAgents,
  deactivateAllAgents,
  checkWalletStatus,
  toggleRealFunds,
  executeTestTransaction
};