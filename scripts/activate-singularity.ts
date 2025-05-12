/**
 * Activates the Singularity Cross-Chain Oracle strategy for live trading with real funds
 * 
 * This script uses the server API to activate Singularity specifically and
 * monitor its status using proper TypeScript interfaces.
 */

import fetch from 'node-fetch';
import WebSocket from 'ws';

interface WebSocketMessage {
  type: string;
  timestamp: string;
  [key: string]: any;
}

interface AgentStatus {
  id: string;
  name: string;
  type: string;
  status: string;
  active: boolean;
  wallets: {
    trading?: string;
    profit?: string;
    fee?: string;
    stealth?: string[];
  };
  metrics: {
    totalExecutions: number;
    successRate: number;
    totalProfit: number;
    lastExecution?: string;
  };
}

interface AgentUpdateMessage extends WebSocketMessage {
  type: 'agent_update';
  agent: AgentStatus;
}

/**
 * Activates the Singularity strategy for live trading with real funds
 */
async function activateSingularityStrategy(): Promise<void> {
  console.log('🚀 Activating Singularity strategy for live trading with real funds...');
  
  try {
    // Get local server URL
    const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
    
    // Check if server is running
    console.log('📡 Checking server status...');
    const statusResponse = await fetch(`${serverUrl}/api/system-status`);
    if (!statusResponse.ok) {
      throw new Error(`Server status check failed: ${statusResponse.statusText}`);
    }
    
    console.log('✅ Server is running');
    
    // Activate Singularity strategy
    console.log('🚀 Sending activation request to server...');
    const activationResponse = await fetch(`${serverUrl}/api/agents/singularity/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (!activationResponse.ok) {
      throw new Error(`Activation failed: ${activationResponse.statusText}`);
    }
    
    const activationResult = await activationResponse.json();
    console.log('✅ Activation successful:', activationResult.message);
    
    // Monitor Singularity status
    console.log('🔍 Monitoring Singularity status...');
    monitorSingularityStatus();
    
  } catch (error) {
    console.error('❌ Error activating Singularity strategy:', error);
    process.exit(1);
  }
}

/**
 * Monitor Singularity agent status using WebSocket
 */
function monitorSingularityStatus(): void {
  const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
  const wsUrl = serverUrl.replace('http:', 'ws:').replace('https:', 'wss:') + '/ws';
  
  console.log(`📡 Connecting to WebSocket at ${wsUrl}`);
  
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    // Request agent status updates
    ws.send(JSON.stringify({
      type: 'GET_AGENT_UPDATES',
      agentId: 'singularity-1'
    }));
  });
  
  ws.on('message', (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      
      if (message.type === 'agent_update') {
        const agentUpdate = message as AgentUpdateMessage;
        const agent = agentUpdate.agent;
        
        if (agent.type === 'singularity') {
          console.log(`📊 Singularity Status: ${agent.status.toUpperCase()}`);
          console.log(`🔑 Trading Wallet: ${agent.wallets.trading}`);
          console.log(`💸 Profit Wallet: ${agent.wallets.profit}`);
          console.log(`📊 Metrics:`);
          console.log(`  - Total Executions: ${agent.metrics.totalExecutions}`);
          console.log(`  - Success Rate: ${(agent.metrics.successRate * 100).toFixed(2)}%`);
          console.log(`  - Total Profit: ${agent.metrics.totalProfit.toFixed(6)} SOL`);
          
          if (agent.status === 'executing') {
            console.log('⚡ Singularity is currently executing a cross-chain arbitrage opportunity!');
          }
        }
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: ${code} ${reason}`);
    
    // Reconnect after a delay
    setTimeout(() => {
      console.log('Attempting to reconnect...');
      monitorSingularityStatus();
    }, 5000);
  });
  
  // Keep the process running
  process.stdin.resume();
  
  // Handle process exit
  process.on('SIGINT', () => {
    console.log('Stopping monitoring...');
    ws.close();
    process.exit(0);
  });
}

// Run the script
activateSingularityStrategy().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});