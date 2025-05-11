/**
 * Solana Quantum Trading Platform - Agent System Interface
 * 
 * This file provides the JavaScript interface to the Rust-based agent system,
 * allowing the web application to initialize, monitor, and control the agents.
 */
import express from 'express';
import { spawn } from 'child_process';
import { logger } from './logger';
import WebSocket from 'ws';

export enum AgentType {
  HYPERION = 'hyperion',
  QUANTUM_OMEGA = 'quantum_omega',
}

export enum AgentStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  SCANNING = 'scanning',
  EXECUTING = 'executing',
  COOLDOWN = 'cooldown',
  ERROR = 'error',
}

export interface AgentState {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
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
    lastExecution?: Date;
  };
  lastError?: string;
}

export interface ExecutionResult {
  id: string;
  agentId: string;
  success: boolean;
  profit: number;
  timestamp: Date;
  strategy: string;
  metrics: Record<string, number>;
  signature?: string;
  error?: string;
}

// A map of agent IDs to agent states
const agents = new Map<string, AgentState>();

// A list of recent execution results
const executions: ExecutionResult[] = [];

// A set of WebSocket clients
const wsClients = new Set<WebSocket>();

// Whether the agent system is running
let _isRunning = false;

// System wallet for profit collection - this is the main wallet you should fund
export const SYSTEM_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

// Initialize mock agent states
function initializeAgentStates() {
  const hyperion: AgentState = {
    id: 'hyperion-1',
    name: 'Hyperion Flash Arbitrage Overlord',
    type: AgentType.HYPERION,
    status: AgentStatus.IDLE,
    active: false,
    wallets: {
      trading: '8mFQbdXKNXEHDSxTgQnYJ7gJjwS7Z6TCQwP8HrbbNYQQ',
      profit: '5vxoRv2P12q2YvUqnRTrLuhHft8v71dPCnmTNsAATX6s',
      fee: '7YttRA5S3JrVR7btJyKtcdKzvYXtgP7NuXoM6tPmDx6w',
      stealth: ['3gUbdMs4Z5vxWw4twNYewdmYXqYNwZsWJXiyXK4JVnRa']
    },
    metrics: {
      totalExecutions: 0,
      successRate: 0,
      totalProfit: 0,
    }
  };

  const quantumOmega: AgentState = {
    id: 'quantum-omega-1',
    name: 'Quantum Omega Sniper',
    type: AgentType.QUANTUM_OMEGA,
    status: AgentStatus.IDLE,
    active: false,
    wallets: {
      trading: 'DAz8CQz4G63Wj1jCNe3HY2xQ4VSmaKmTBBVvfBpvizRf',
      profit: '2fZ1XPa3kuGWPgitv3DE1awpa1FEE4JFyVLpUYCZwzDJ',
      fee: 'Hs4sAwLN2QgvU6dW3JaRNNzWydQRfA9M3b59HgaEpxeQ',
      stealth: ['Ckx2B2PKVCyYEVnJa8DxCnoXxTvGbbw39jQAvoLhPLuM']
    },
    metrics: {
      totalExecutions: 0,
      successRate: 0,
      totalProfit: 0,
    }
  };
  
  // Reference the system wallet
  // The system wallet address is exported at the top level

  agents.set(hyperion.id, hyperion);
  agents.set(quantumOmega.id, quantumOmega);
}

// Initialize agent states
initializeAgentStates();

/**
 * Start the agent system
 * @returns Whether the agent system started successfully
 */
export async function startAgentSystem(): Promise<boolean> {
  if (_isRunning) {
    logger.info('Agent system already running');
    return true;
  }

  logger.info('Starting agent system');
  
  try {
    // Simulate starting the agent system
    // In a real implementation, this would start a Rust-based process
    _isRunning = true;
    
    // Update all agent statuses
    for (const agent of agents.values()) {
      agent.status = AgentStatus.SCANNING;
    }
    
    // Broadcast agent updates to all WebSocket clients
    broadcastMessage({
      type: 'agent_system_status',
      status: 'running',
      message: 'Agent system started successfully'
    });
    
    // Broadcast agent updates
    for (const agent of agents.values()) {
      broadcastAgentUpdate(agent);
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to start agent system:', error);
    _isRunning = false;
    return false;
  }
}

/**
 * Stop the agent system
 * @returns Whether the agent system stopped successfully
 */
export async function stopAgentSystem(): Promise<boolean> {
  if (!_isRunning) {
    logger.info('Agent system already stopped');
    return true;
  }

  logger.info('Stopping agent system');
  
  try {
    // Simulate stopping the agent system
    _isRunning = false;
    
    // Update all agent statuses
    for (const agent of agents.values()) {
      agent.status = AgentStatus.IDLE;
      agent.active = false;
    }
    
    // Broadcast agent updates to all WebSocket clients
    broadcastMessage({
      type: 'agent_system_status',
      status: 'stopped',
      message: 'Agent system is stopped'
    });
    
    // Broadcast agent updates
    for (const agent of agents.values()) {
      broadcastAgentUpdate(agent);
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to stop agent system:', error);
    return false;
  }
}

/**
 * Get all agents
 * @returns An array of agent states
 */
export function getAgents(): AgentState[] {
  return Array.from(agents.values());
}

/**
 * Get a specific agent by ID
 * @param id The agent ID
 * @returns The agent state, or undefined if not found
 */
export function getAgent(id: string): AgentState | undefined {
  return agents.get(id);
}

/**
 * Get recent execution results
 * @param limit The maximum number of results to return
 * @returns An array of execution results
 */
export function getRecentExecutions(limit: number = 10): ExecutionResult[] {
  return executions.slice(0, limit);
}

/**
 * Check if the agent system is running
 * @returns Whether the agent system is running
 */
export function isRunning(): boolean {
  return _isRunning;
}

/**
 * Add a WebSocket client
 * @param client The WebSocket client
 */
export function addWsClient(client: WebSocket): void {
  wsClients.add(client);
  
  // Send initial data
  client.send(JSON.stringify({
    type: 'agents_list',
    agents: getAgents()
  }));
  
  client.send(JSON.stringify({
    type: 'agent_system_status',
    status: _isRunning ? 'running' : 'stopped',
    message: _isRunning ? 'Agent system is running' : 'Agent system is stopped'
  }));
  
  client.send(JSON.stringify({
    type: 'recent_executions',
    executions: getRecentExecutions()
  }));
}

/**
 * Remove a WebSocket client
 * @param client The WebSocket client
 */
export function removeWsClient(client: WebSocket): void {
  wsClients.delete(client);
}

/**
 * Broadcast a message to all WebSocket clients
 * @param message The message to broadcast
 */
export function broadcastMessage(message: any): void {
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}

/**
 * Broadcast an agent update to all WebSocket clients
 * @param agent The agent state to broadcast
 */
export function broadcastAgentUpdate(agent: AgentState): void {
  broadcastMessage({
    type: 'agent_update',
    agent
  });
}

/**
 * Handle a WebSocket connection
 * @param ws The WebSocket connection
 */
export function handleAgentWebSocket(ws: WebSocket): void {
  addWsClient(ws);
  
  ws.on('close', () => {
    removeWsClient(ws);
  });
}

// Create router
const agentRouter = express.Router();

// Get all agents
agentRouter.get('/', (req, res) => {
  try {
    const agentsList = getAgents();
    res.json({
      agents: agentsList,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error in /api/agents:", error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Get agent system status
agentRouter.get('/status', (req, res) => {
  try {
    const running = isRunning();
    res.json({
      status: running ? 'running' : 'stopped',
      message: running ? 'Agent system is running' : 'Agent system is stopped',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error in /api/agents/status:", error);
    res.status(500).json({ error: 'Failed to get agent system status' });
  }
});

// Start agent system
agentRouter.post('/start', async (req, res) => {
  try {
    const success = await startAgentSystem();
    res.json({
      success,
      message: success ? 'Agent system started successfully' : 'Failed to start agent system',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error in /api/agents/start:", error);
    res.status(500).json({ error: 'Failed to start agent system' });
  }
});

// Stop agent system
agentRouter.post('/stop', async (req, res) => {
  try {
    const success = await stopAgentSystem();
    res.json({
      success,
      message: success ? 'Agent system stopped successfully' : 'Failed to stop agent system',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error in /api/agents/stop:", error);
    res.status(500).json({ error: 'Failed to stop agent system' });
  }
});

// Get specific agent
agentRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const agent = getAgent(id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json({
      agent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error in /api/agents/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// Activate agent
agentRouter.post('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const agent = getAgent(id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    if (agent.status !== 'idle') {
      return res.status(400).json({ error: `Agent is ${agent.status}, must be idle to activate` });
    }
    
    agent.active = true;
    agent.status = AgentStatus.SCANNING;
    
    broadcastAgentUpdate(agent);
    
    res.json({
      success: true,
      agent,
      message: `Agent ${id} activated successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error in /api/agents/${req.params.id}/activate:`, error);
    res.status(500).json({ error: 'Failed to activate agent' });
  }
});

// Deactivate agent
agentRouter.post('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const agent = getAgent(id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    agent.active = false;
    agent.status = AgentStatus.IDLE;
    
    broadcastAgentUpdate(agent);
    
    res.json({
      success: true,
      agent,
      message: `Agent ${id} deactivated successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error in /api/agents/${req.params.id}/deactivate:`, error);
    res.status(500).json({ error: 'Failed to deactivate agent' });
  }
});

export default agentRouter;