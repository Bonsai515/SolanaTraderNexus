import { useCallback, useContext, createContext, useState, useEffect, ReactNode } from 'react';
import { useWsContext } from './wsClient';
import { apiRequest } from './queryClient';

// Agent types from server
export enum AgentType {
  HYPERION = 'hyperion',
  QUANTUM_OMEGA = 'quantum_omega',
}

// Agent status from server
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

// Agent store state interface
interface AgentStoreState {
  agents: AgentState[];
  executions: ExecutionResult[];
  systemRunning: boolean;
  systemStatus: string;
  transformerStatus: string;
  isInitialized: boolean;
  
  // Actions
  startSystem: () => Promise<boolean>;
  stopSystem: () => Promise<boolean>;
  fetchAgents: () => Promise<void>;
  fetchExecutions: (limit?: number) => Promise<void>;
  updateAgentState: (agent: AgentState) => void;
  addExecution: (execution: ExecutionResult) => void;
  setSystemStatus: (status: string) => void;
  setTransformerStatus: (status: string) => void;
  setSystemRunning: (running: boolean) => void;
}

// Create agent context
const AgentContext = createContext<AgentStoreState | null>(null);

// Provider props interface
interface AgentProviderProps {
  children: ReactNode;
}

// Agent Provider Component
export function AgentProvider({ children }: AgentProviderProps) {
  // State
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [executions, setExecutions] = useState<ExecutionResult[]>([]);
  const [systemRunning, setSystemRunning] = useState(false);
  const [systemStatus, setSystemStatus] = useState('stopped');
  const [transformerStatus, setTransformerStatus] = useState('stopped');
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Start the agent system
  const startSystem = async (): Promise<boolean> => {
    try {
      const response = await apiRequest<{ success: boolean }>('/api/agents/system/start', {
        method: 'POST'
      });
      
      if (response.success) {
        setSystemRunning(true);
        setSystemStatus('starting');
      }
      
      return response.success;
    } catch (error) {
      console.error('Failed to start agent system:', error);
      return false;
    }
  };
  
  // Stop the agent system
  const stopSystem = async (): Promise<boolean> => {
    try {
      const response = await apiRequest<{ success: boolean }>('/api/agents/system/stop', {
        method: 'POST'
      });
      
      if (response.success) {
        setSystemRunning(false);
        setSystemStatus('stopped');
      }
      
      return response.success;
    } catch (error) {
      console.error('Failed to stop agent system:', error);
      return false;
    }
  };
  
  // Fetch agents
  const fetchAgents = async (): Promise<void> => {
    try {
      const agentsData = await apiRequest<AgentState[]>('/api/agents');
      
      setAgents(agentsData);
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };
  
  // Fetch executions
  const fetchExecutions = async (limit = 10): Promise<void> => {
    try {
      const executionsData = await apiRequest<ExecutionResult[]>(`/api/executions?limit=${limit}`);
      
      setExecutions(executionsData);
    } catch (error) {
      console.error('Failed to fetch executions:', error);
    }
  };
  
  // Update agent state
  const updateAgentState = (agent: AgentState): void => {
    setAgents(currentAgents => 
      currentAgents.map(a => a.id === agent.id ? agent : a)
    );
  };
  
  // Add execution
  const addExecution = (execution: ExecutionResult): void => {
    setExecutions(currentExecutions => 
      [execution, ...currentExecutions].slice(0, 100)
    );
  };
  
  // Context value
  const value = {
    agents,
    executions,
    systemRunning,
    systemStatus,
    transformerStatus,
    isInitialized,
    startSystem,
    stopSystem,
    fetchAgents,
    fetchExecutions,
    updateAgentState,
    addExecution,
    setSystemStatus,
    setTransformerStatus,
    setSystemRunning
  };
  
  // Return the provider component
  return (
    // @ts-ignore - JSX syntax is properly handled by Vite
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
}

// Hook to use agent context
export function useAgentStore(): AgentStoreState {
  const context = useContext(AgentContext);
  
  if (!context) {
    throw new Error('useAgentStore must be used within an AgentProvider');
  }
  
  return context;
}

export interface WebSocketMessage {
  type: string;
  data: any;
}

export interface AgentConfiguration {
  active: boolean;
  tradingWallets: string[];
  maxSlippageBps: number;
  minProfitThresholdUsd: number;
}

// Hook to initialize WebSocket listeners
export function useAgentWebSocketHandlers() {
  const { registerHandler } = useWsContext();
  const {
    updateAgentState,
    addExecution,
    setSystemStatus,
    setTransformerStatus,
    setSystemRunning,
    fetchAgents,
    fetchExecutions
  } = useAgentStore();
  
  const initialize = useCallback(() => {
    // Initialize by fetching agent data
    fetchAgents();
    fetchExecutions();
    
    // Register handlers
    registerHandler('agents_list', (message: WebSocketMessage) => {
      if (message.data && message.data.agents && Array.isArray(message.data.agents)) {
        message.data.agents.forEach((agent: AgentState) => {
          updateAgentState(agent);
        });
      }
    });
    
    registerHandler('agent_update', (message: any) => {
      if (message.data && message.data.agent) {
        updateAgentState(message.data.agent);
      }
    });
    
    registerHandler('execution_result', (message: any) => {
      if (message.data && message.data.execution) {
        addExecution(message.data.execution);
      }
    });
    
    registerHandler('recent_executions', (message: any) => {
      if (message.data && message.data.executions && Array.isArray(message.data.executions)) {
        message.data.executions.forEach((execution: ExecutionResult) => {
          addExecution(execution);
        });
      }
    });
    
    registerHandler('agent_system_status', (message: any) => {
      if (message.data && typeof message.data.status === 'string') {
        setSystemStatus(message.data.status);
        setSystemRunning(message.data.status === 'running');
      }
    });
    
    registerHandler('transformer_status', (message: any) => {
      if (message.data && typeof message.data.status === 'string') {
        setTransformerStatus(message.data.status);
      }
    });
  }, [
    registerHandler,
    updateAgentState,
    addExecution,
    setSystemStatus,
    setTransformerStatus,
    setSystemRunning,
    fetchAgents,
    fetchExecutions
  ]);
  
  return { initialize };
}

// Utility function to format profit
export function formatProfit(profit: number): string {
  return profit.toFixed(4);
}

// Utility function to format success rate
export function formatSuccessRate(rate: number): string {
  return (rate * 100).toFixed(2) + '%';
}

// Utility function to get agent color by type
export function getAgentColor(type: AgentType): string {
  switch (type) {
    case AgentType.HYPERION:
      return 'blue';
    case AgentType.QUANTUM_OMEGA:
      return 'purple';
    default:
      return 'gray';
  }
}

// Utility function to get status label
export function getStatusLabel(status: AgentStatus): string {
  switch (status) {
    case AgentStatus.IDLE:
      return 'Idle';
    case AgentStatus.INITIALIZING:
      return 'Initializing';
    case AgentStatus.SCANNING:
      return 'Scanning';
    case AgentStatus.EXECUTING:
      return 'Executing';
    case AgentStatus.COOLDOWN:
      return 'Cooldown';
    case AgentStatus.ERROR:
      return 'Error';
    default:
      return 'Unknown';
  }
}

// Utility function to get status color
export function getStatusColor(status: AgentStatus): string {
  switch (status) {
    case AgentStatus.IDLE:
      return 'gray';
    case AgentStatus.INITIALIZING:
      return 'blue';
    case AgentStatus.SCANNING:
      return 'green';
    case AgentStatus.EXECUTING:
      return 'purple';
    case AgentStatus.COOLDOWN:
      return 'orange';
    case AgentStatus.ERROR:
      return 'red';
    default:
      return 'gray';
  }
}