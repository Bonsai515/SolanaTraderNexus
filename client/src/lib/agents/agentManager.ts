import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createHyperionAgent, HyperionAgent, AgentStatus as HyperionStatus, ExecutionResult as HyperionResult } from './hyperionAgent';
import { createQuantumOmegaAgent, QuantumOmegaAgent, AgentStatus as QuantumStatus, SnipeResult } from './quantumOmegaAgent';

/**
 * Agent Manager
 * Manages Hyperion and Quantum Omega agents
 */
export class AgentManager {
  private hyperionAgents: Map<string, HyperionAgent> = new Map();
  private quantumAgents: Map<string, QuantumOmegaAgent> = new Map();
  private executions: (HyperionResult | SnipeResult)[] = [];
  private wsClients: Set<WebSocket> = new Set();
  private isRunning: boolean = false;

  constructor() {
    // Initialize with default agents
    this.initializeAgentStates();
  }

  /**
   * Initialize default agent states
   */
  private initializeAgentStates() {
    // Create default Hyperion agent
    const hyperion = createHyperionAgent('Hyperion Prime');
    this.hyperionAgents.set(hyperion.getState().id, hyperion);

    // Create default Quantum Omega agent
    const quantumOmega = createQuantumOmegaAgent('Quantum Omega Prime');
    this.quantumAgents.set(quantumOmega.getState().id, quantumOmega);
  }

  /**
   * Start the agent system
   */
  async startAgentSystem(): Promise<boolean> {
    try {
      this.isRunning = true;
      
      // Broadcast that the system is starting
      this.broadcastMessage({
        type: 'system_status',
        status: 'starting'
      });
      
      // Activate all agents
      for (const agent of this.hyperionAgents.values()) {
        agent.activate();
        this.broadcastAgentUpdate(agent.getState());
      }
      
      for (const agent of this.quantumAgents.values()) {
        agent.activate();
        this.broadcastAgentUpdate(agent.getState());
      }
      
      // Start opportunity scanning
      this.startOpportunityScanner();
      
      // Broadcast that the system is running
      this.broadcastMessage({
        type: 'system_status',
        status: 'running'
      });
      
      return true;
    } catch (error) {
      console.error('Failed to start agent system:', error);
      
      this.broadcastMessage({
        type: 'system_status',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      this.isRunning = false;
      return false;
    }
  }

  /**
   * Start the opportunity scanner
   */
  private startOpportunityScanner() {
    // In a real implementation, this would periodically scan for opportunities
    // and execute strategies when profitable opportunities are found
    const scanInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(scanInterval);
        return;
      }
      
      // Scan for arbitrage opportunities with Hyperion agents
      for (const agent of this.hyperionAgents.values()) {
        if (agent.getState().active && agent.getState().status === HyperionStatus.IDLE) {
          agent.scanForOpportunities().then(opportunities => {
            if (opportunities.length > 0) {
              // Broadcast opportunities
              this.broadcastMessage({
                type: 'arbitrage_opportunities',
                agentId: agent.getState().id,
                opportunities
              });
              
              // Execute strategy with first opportunity
              const strategies = agent.getStrategies();
              const activeStrategy = strategies.find(s => s.active);
              
              if (activeStrategy) {
                agent.executeStrategy(activeStrategy.id).then(result => {
                  // Record and broadcast the execution result
                  this.executions.unshift(result);
                  this.broadcastMessage({
                    type: 'execution_result',
                    result
                  });
                  
                  // Broadcast updated agent state
                  this.broadcastAgentUpdate(agent.getState());
                });
              }
            }
          });
        }
      }
      
      // Scan for token opportunities with Quantum Omega agents
      for (const agent of this.quantumAgents.values()) {
        if (agent.getState().active && agent.getState().status === QuantumStatus.IDLE) {
          agent.scanForOpportunities().then(opportunities => {
            if (opportunities.length > 0) {
              // Broadcast opportunities
              this.broadcastMessage({
                type: 'token_opportunities',
                agentId: agent.getState().id,
                opportunities
              });
              
              // Execute snipe with first opportunity
              const strategies = agent.getStrategies();
              const activeStrategy = strategies.find(s => s.active);
              
              if (activeStrategy) {
                const opportunity = opportunities[0];
                agent.executeSnipe(opportunity.tokenAddress, activeStrategy.id).then(result => {
                  // Record and broadcast the execution result
                  this.executions.unshift(result);
                  this.broadcastMessage({
                    type: 'snipe_result',
                    result
                  });
                  
                  // Broadcast updated agent state
                  this.broadcastAgentUpdate(agent.getState());
                });
              }
            }
          });
        }
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Stop the agent system
   */
  async stopAgentSystem(): Promise<boolean> {
    try {
      this.isRunning = false;
      
      // Broadcast that the system is stopping
      this.broadcastMessage({
        type: 'system_status',
        status: 'stopping'
      });
      
      // Deactivate all agents
      for (const agent of this.hyperionAgents.values()) {
        agent.deactivate();
        this.broadcastAgentUpdate(agent.getState());
      }
      
      for (const agent of this.quantumAgents.values()) {
        agent.deactivate();
        this.broadcastAgentUpdate(agent.getState());
      }
      
      // Broadcast that the system is stopped
      this.broadcastMessage({
        type: 'system_status',
        status: 'stopped'
      });
      
      return true;
    } catch (error) {
      console.error('Failed to stop agent system:', error);
      
      this.broadcastMessage({
        type: 'system_status',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return false;
    }
  }

  /**
   * Get all agents
   */
  getAgents(): AgentState[] {
    const agents: AgentState[] = [];
    
    for (const agent of this.hyperionAgents.values()) {
      agents.push(agent.getState());
    }
    
    for (const agent of this.quantumAgents.values()) {
      agents.push(agent.getState());
    }
    
    return agents;
  }

  /**
   * Get an agent by ID
   */
  getAgent(id: string): AgentState | undefined {
    const hyperionAgent = this.hyperionAgents.get(id);
    if (hyperionAgent) {
      return hyperionAgent.getState();
    }
    
    const quantumAgent = this.quantumAgents.get(id);
    if (quantumAgent) {
      return quantumAgent.getState();
    }
    
    return undefined;
  }

  /**
   * Get recent executions
   */
  getRecentExecutions(limit: number = 10): (HyperionResult | SnipeResult)[] {
    return this.executions.slice(0, limit);
  }

  /**
   * Add a WebSocket client
   */
  addWsClient(client: WebSocket): void {
    this.wsClients.add(client);
    
    // Send initial state
    client.send(JSON.stringify({
      type: 'init',
      agents: this.getAgents(),
      executions: this.getRecentExecutions(),
      systemRunning: this.isRunning
    }));
  }

  /**
   * Remove a WebSocket client
   */
  removeWsClient(client: WebSocket): void {
    this.wsClients.delete(client);
  }

  /**
   * Broadcast a message to all connected WebSocket clients
   */
  broadcastMessage(message: any): void {
    const messageStr = JSON.stringify(message);
    
    for (const client of this.wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }
  }

  /**
   * Broadcast an agent update
   */
  broadcastAgentUpdate(agent: AgentState): void {
    this.broadcastMessage({
      type: 'agent_update',
      agent
    });
  }
}

/**
 * Agent state interface
 */
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
    stealth: string[];
  };
  metrics: {
    totalExecutions: number;
    successRate: number;
    totalProfit: number;
    lastExecution?: Date;
  };
  lastError?: string;
}

/**
 * Agent status enum
 */
export enum AgentStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  SCANNING = 'scanning',
  EXECUTING = 'executing',
  COOLDOWN = 'cooldown',
  ERROR = 'error'
}

/**
 * Agent type enum
 */
export enum AgentType {
  HYPERION = 'hyperion',
  QUANTUM_OMEGA = 'quantum_omega'
}

// Export a function to handle WebSocket connections
export const handleAgentWebSocket = (ws: WebSocket): void => {
  // Get the agent manager instance
  const agentManager = AgentManagerInstance;
  
  // Add this client
  agentManager.addWsClient(ws);
  
  // Set up event handlers
  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      
      // Handle different message types
      switch (data.type) {
        case 'start_system':
          agentManager.startAgentSystem();
          break;
          
        case 'stop_system':
          agentManager.stopAgentSystem();
          break;
          
        // Add more message types as needed
          
        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });
  
  ws.on('close', () => {
    agentManager.removeWsClient(ws);
  });
};

// Create and export a singleton instance
const AgentManagerInstance = new AgentManager();
export default AgentManagerInstance;