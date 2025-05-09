/**
 * Solana Quantum Trading Platform - Agent System Interface
 * 
 * This file provides the JavaScript interface to the Rust-based agent system,
 * allowing the web application to initialize, monitor, and control the agents.
 */

import { Router } from 'express';
import WebSocket from 'ws';
import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

// Agent types
export enum AgentType {
  HYPERION = 'hyperion',
  QUANTUM_OMEGA = 'quantum_omega',
}

// Agent status
export enum AgentStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  SCANNING = 'scanning',
  EXECUTING = 'executing',
  COOLDOWN = 'cooldown',
  ERROR = 'error',
}

// Agent state interface
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

// Execution result interface
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

// Agent manager class
class AgentManager {
  private agentProcess?: any;
  private agents: Map<string, AgentState> = new Map();
  private executions: ExecutionResult[] = [];
  private wsClients: Set<WebSocket> = new Set();
  private transformerProcess?: any;
  private isRunning: boolean = false;
  
  constructor() {
    // Initialize agents
    this.initializeAgentStates();
  }
  
  // Initialize agent states
  private initializeAgentStates() {
    // Hyperion agent state
    const hyperion: AgentState = {
      id: 'hyperion-1',
      name: 'Hyperion Flash Arbitrage Overlord',
      type: AgentType.HYPERION,
      status: AgentStatus.IDLE,
      active: false,
      wallets: {},
      metrics: {
        totalExecutions: 0,
        successRate: 0,
        totalProfit: 0,
      },
    };
    
    // Quantum Omega agent state
    const quantumOmega: AgentState = {
      id: 'quantum-omega-1',
      name: 'Quantum Omega Sniper',
      type: AgentType.QUANTUM_OMEGA,
      status: AgentStatus.IDLE,
      active: false,
      wallets: {},
      metrics: {
        totalExecutions: 0,
        successRate: 0,
        totalProfit: 0,
      },
    };
    
    // Add agents to map
    this.agents.set(hyperion.id, hyperion);
    this.agents.set(quantumOmega.id, quantumOmega);
    
    logger.info('Agent states initialized');
  }
  
  // Start agent system
  async startAgentSystem(): Promise<boolean> {
    if (this.isRunning) {
      logger.info('Agent system already running');
      return true;
    }
    
    try {
      logger.info('Starting agent system...');
      
      // First start the transformers
      await this.startTransformers();
      
      // Then start the agent process
      await this.startAgentProcess();
      
      this.isRunning = true;
      
      // Update agent statuses
      for (const agent of this.agents.values()) {
        agent.status = AgentStatus.INITIALIZING;
        agent.active = true;
        this.broadcastAgentUpdate(agent);
      }
      
      logger.info('Agent system started successfully');
      return true;
    } catch (error) {
      logger.error('Failed to start agent system:', error);
      return false;
    }
  }
  
  // Start transformer models
  private async startTransformers(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info('Starting transformer models...');
      
      // Check if running in development mode (Replit)
      const isDev = process.env.REPL_ID || process.env.NODE_ENV === 'development';
      
      // In development, we'll simulate the transformer startup
      if (isDev) {
        logger.info('Development mode: Simulating transformer startup');
        
        // Update all clients
        this.broadcastMessage({
          type: 'transformer_status',
          status: 'starting',
          message: 'Initializing quantum transformer models...',
        });
        
        // Simulate initialization
        setTimeout(() => {
          this.broadcastMessage({
            type: 'transformer_status',
            status: 'running',
            message: 'Quantum transformer models initialized and running',
          });
          resolve();
        }, 3000);
        return;
      }
      
      // In production, we'd start the actual Rust transformer process
      try {
        const transformerBinaryPath = path.resolve(process.cwd(), 'target/release/transformer_engine');
        
        // Check if binary exists
        if (!fs.existsSync(transformerBinaryPath)) {
          logger.error(`Transformer binary not found at ${transformerBinaryPath}`);
          reject(new Error('Transformer binary not found'));
          return;
        }
        
        // Start the transformer process
        this.transformerProcess = spawn(transformerBinaryPath, ['--mode', 'service'], {
          stdio: 'pipe',
        });
        
        this.transformerProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString().trim();
          logger.info(`Transformer output: ${output}`);
          
          // Look for initialization complete message
          if (output.includes('Transformer initialization complete')) {
            this.broadcastMessage({
              type: 'transformer_status',
              status: 'running',
              message: 'Quantum transformer models initialized and running',
            });
            resolve();
          }
        });
        
        this.transformerProcess.stderr.on('data', (data: Buffer) => {
          logger.error(`Transformer error: ${data.toString().trim()}`);
        });
        
        this.transformerProcess.on('error', (error: Error) => {
          logger.error('Failed to start transformer process:', error);
          reject(error);
        });
        
        this.transformerProcess.on('exit', (code: number) => {
          logger.info(`Transformer process exited with code ${code}`);
          this.transformerProcess = undefined;
        });
        
        // Initial status
        this.broadcastMessage({
          type: 'transformer_status',
          status: 'starting',
          message: 'Initializing quantum transformer models...',
        });
      } catch (error) {
        logger.error('Error starting transformer process:', error);
        reject(error);
      }
    });
  }
  
  // Start agent process
  private async startAgentProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info('Starting agent process...');
      
      // Check if running in development mode (Replit)
      const isDev = process.env.REPL_ID || process.env.NODE_ENV === 'development';
      
      // In development, we'll simulate the agent process
      if (isDev) {
        logger.info('Development mode: Simulating agent process startup');
        
        // Update all clients
        this.broadcastMessage({
          type: 'agent_system_status',
          status: 'starting',
          message: 'Initializing agent system...',
        });
        
        // Simulate agent initialization
        setTimeout(() => {
          // Update status for Hyperion
          const hyperion = this.agents.get('hyperion-1');
          if (hyperion) {
            hyperion.status = AgentStatus.SCANNING;
            hyperion.wallets = {
              trading: 'HyperionTrading123456789',
              profit: 'HyperionProfit123456789',
              fee: 'HyperionFee123456789',
            };
            this.broadcastAgentUpdate(hyperion);
          }
          
          // Update status for Quantum Omega
          const quantumOmega = this.agents.get('quantum-omega-1');
          if (quantumOmega) {
            quantumOmega.status = AgentStatus.SCANNING;
            quantumOmega.wallets = {
              trading: 'QuantumTrading123456789',
              profit: 'QuantumProfit123456789',
              fee: 'QuantumFee123456789',
              stealth: ['QuantumStealth123456789'],
            };
            this.broadcastAgentUpdate(quantumOmega);
          }
          
          // System running
          this.broadcastMessage({
            type: 'agent_system_status',
            status: 'running',
            message: 'Agent system initialized and running',
          });
          
          resolve();
        }, 5000);
        return;
      }
      
      // In production, we'd start the actual Rust agent process
      try {
        const agentBinaryPath = path.resolve(process.cwd(), 'target/release/solana_quantum_trading');
        
        // Check if binary exists
        if (!fs.existsSync(agentBinaryPath)) {
          logger.error(`Agent binary not found at ${agentBinaryPath}`);
          reject(new Error('Agent binary not found'));
          return;
        }
        
        // Start the agent process
        this.agentProcess = spawn(agentBinaryPath, [], {
          stdio: 'pipe',
          env: {
            ...process.env,
            RUST_LOG: 'info',
          },
        });
        
        this.agentProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString().trim();
          logger.info(`Agent output: ${output}`);
          
          // Process agent output
          this.processAgentOutput(output);
          
          // Look for initialization complete message
          if (output.includes('System initialized and agents active')) {
            this.broadcastMessage({
              type: 'agent_system_status',
              status: 'running',
              message: 'Agent system initialized and running',
            });
            resolve();
          }
        });
        
        this.agentProcess.stderr.on('data', (data: Buffer) => {
          logger.error(`Agent error: ${data.toString().trim()}`);
        });
        
        this.agentProcess.on('error', (error: Error) => {
          logger.error('Failed to start agent process:', error);
          reject(error);
        });
        
        this.agentProcess.on('exit', (code: number) => {
          logger.info(`Agent process exited with code ${code}`);
          this.agentProcess = undefined;
          this.isRunning = false;
        });
        
        // Initial status
        this.broadcastMessage({
          type: 'agent_system_status',
          status: 'starting',
          message: 'Initializing agent system...',
        });
      } catch (error) {
        logger.error('Error starting agent process:', error);
        reject(error);
      }
    });
  }
  
  // Process agent output
  private processAgentOutput(output: string): void {
    // Look for wallet creation messages
    const walletMatch = output.match(/Created (.*) wallet for agent (.*): (.*)/);
    if (walletMatch) {
      const walletType = walletMatch[1].toLowerCase();
      const agentId = walletMatch[2];
      const walletAddress = walletMatch[3];
      
      const agent = Array.from(this.agents.values()).find(a => a.name.includes(agentId));
      if (agent) {
        if (walletType.includes('trading')) {
          agent.wallets.trading = walletAddress;
        } else if (walletType.includes('profit')) {
          agent.wallets.profit = walletAddress;
        } else if (walletType.includes('fee')) {
          agent.wallets.fee = walletAddress;
        } else if (walletType.includes('stealth')) {
          if (!agent.wallets.stealth) {
            agent.wallets.stealth = [];
          }
          agent.wallets.stealth.push(walletAddress);
        }
        
        this.broadcastAgentUpdate(agent);
      }
    }
    
    // Look for agent status changes
    const statusMatch = output.match(/(Hyperion|Quantum Omega) agent .* (scanning|executing|idle|cooldown)/i);
    if (statusMatch) {
      const agentType = statusMatch[1];
      const statusStr = statusMatch[2].toLowerCase();
      
      const agent = Array.from(this.agents.values()).find(a => a.name.includes(agentType));
      if (agent) {
        switch (statusStr) {
          case 'scanning':
            agent.status = AgentStatus.SCANNING;
            break;
          case 'executing':
            agent.status = AgentStatus.EXECUTING;
            break;
          case 'idle':
            agent.status = AgentStatus.IDLE;
            break;
          case 'cooldown':
            agent.status = AgentStatus.COOLDOWN;
            break;
        }
        
        this.broadcastAgentUpdate(agent);
      }
    }
    
    // Look for execution results
    const executionMatch = output.match(/Agent (.*) executed strategy: success=(true|false), profit=(.*)/);
    if (executionMatch) {
      const agentId = executionMatch[1];
      const success = executionMatch[2] === 'true';
      const profit = parseFloat(executionMatch[3]);
      
      const agent = Array.from(this.agents.values()).find(a => a.name.includes(agentId) || a.id === agentId);
      if (agent) {
        // Update agent metrics
        agent.metrics.totalExecutions++;
        agent.metrics.totalProfit += profit;
        agent.metrics.successRate = 
          (agent.metrics.successRate * (agent.metrics.totalExecutions - 1) + (success ? 1 : 0)) / 
          agent.metrics.totalExecutions;
        agent.metrics.lastExecution = new Date();
        
        // Create execution result
        const execution: ExecutionResult = {
          id: `exec-${Date.now()}`,
          agentId: agent.id,
          success,
          profit,
          timestamp: new Date(),
          strategy: agent.type === AgentType.HYPERION ? 'flash_arbitrage' : 'token_snipe',
          metrics: {
            profitPercentage: profit * 100,
          },
        };
        
        // Add to executions
        this.executions.push(execution);
        
        // Broadcast updates
        this.broadcastAgentUpdate(agent);
        this.broadcastMessage({
          type: 'execution_result',
          execution,
        });
      }
    }
  }
  
  // Stop agent system
  async stopAgentSystem(): Promise<boolean> {
    if (!this.isRunning) {
      logger.info('Agent system not running');
      return true;
    }
    
    try {
      logger.info('Stopping agent system...');
      
      // Stop the agent process
      if (this.agentProcess) {
        this.agentProcess.kill();
        this.agentProcess = undefined;
      }
      
      // Stop the transformer process
      if (this.transformerProcess) {
        this.transformerProcess.kill();
        this.transformerProcess = undefined;
      }
      
      this.isRunning = false;
      
      // Update agent statuses
      for (const agent of this.agents.values()) {
        agent.status = AgentStatus.IDLE;
        agent.active = false;
        this.broadcastAgentUpdate(agent);
      }
      
      // Broadcast system status
      this.broadcastMessage({
        type: 'agent_system_status',
        status: 'stopped',
        message: 'Agent system stopped',
      });
      
      logger.info('Agent system stopped successfully');
      return true;
    } catch (error) {
      logger.error('Failed to stop agent system:', error);
      return false;
    }
  }
  
  // Get all agents
  getAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }
  
  // Get agent by ID
  getAgent(id: string): AgentState | undefined {
    return this.agents.get(id);
  }
  
  // Get recent executions
  getRecentExecutions(limit: number = 10): ExecutionResult[] {
    return this.executions.slice(-limit).reverse();
  }
  
  // Add WebSocket client
  addWsClient(client: WebSocket): void {
    this.wsClients.add(client);
    
    // Send initial state
    client.send(JSON.stringify({
      type: 'agents_list',
      agents: this.getAgents(),
    }));
    
    client.send(JSON.stringify({
      type: 'agent_system_status',
      status: this.isRunning ? 'running' : 'stopped',
      message: this.isRunning ? 'Agent system is running' : 'Agent system is stopped',
    }));
    
    client.send(JSON.stringify({
      type: 'recent_executions',
      executions: this.getRecentExecutions(),
    }));
  }
  
  // Remove WebSocket client
  removeWsClient(client: WebSocket): void {
    this.wsClients.delete(client);
  }
  
  // Broadcast message to all WebSocket clients
  broadcastMessage(message: any): void {
    const messageStr = JSON.stringify(message);
    for (const client of this.wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }
  }
  
  // Broadcast agent update
  broadcastAgentUpdate(agent: AgentState): void {
    this.broadcastMessage({
      type: 'agent_update',
      agent,
    });
  }
}

// Create agent manager instance
const agentManager = new AgentManager();

// Create agent router
const agentRouter = Router();

// GET /api/agents - List all agents
agentRouter.get('/agents', (req, res) => {
  res.json(agentManager.getAgents());
});

// GET /api/agents/:id - Get agent by ID
agentRouter.get('/agents/:id', (req, res) => {
  const agent = agentManager.getAgent(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json(agent);
});

// POST /api/agents/system/start - Start agent system
agentRouter.post('/agents/system/start', async (req, res) => {
  const success = await agentManager.startAgentSystem();
  res.json({ success });
});

// POST /api/agents/system/stop - Stop agent system
agentRouter.post('/agents/system/stop', async (req, res) => {
  const success = await agentManager.stopAgentSystem();
  res.json({ success });
});

// GET /api/executions - Get recent executions
agentRouter.get('/executions', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
  res.json(agentManager.getRecentExecutions(limit));
});

// WebSocket handler
export const handleAgentWebSocket = (ws: WebSocket): void => {
  agentManager.addWsClient(ws);
  
  ws.on('close', () => {
    agentManager.removeWsClient(ws);
  });
  
  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'start_agents') {
        agentManager.startAgentSystem();
      } else if (data.type === 'stop_agents') {
        agentManager.stopAgentSystem();
      }
    } catch (error) {
      logger.error('Error processing WebSocket message:', error);
    }
  });
};

export default agentRouter;