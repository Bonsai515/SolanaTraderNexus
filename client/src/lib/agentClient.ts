
import { useCallback, useContext, createContext, useState, useEffect, ReactNode } from 'react';
import { useWsContext } from './wsClient';
import { apiRequest } from './queryClient';

// Agent types and interfaces
export enum AgentType {
  HYPERION = 'hyperion',
  QUANTUM = 'quantum',
  ANALYZER = 'analyzer'
}

export enum AgentStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  SCANNING = 'scanning',
  EXECUTING = 'executing',
  COOLDOWN = 'cooldown',
  ERROR = 'error'
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

interface AgentStoreState {
  agents: Record<string, AgentState>;
  isLoading: boolean;
  error: string | null;
  selectedAgent: string | null;
  refreshAgents: () => Promise<void>;
  selectAgent: (id: string) => void;
}

interface AgentProviderProps {
  children: ReactNode;
}

// Create context
const AgentContext = createContext<AgentStoreState | null>(null);

// Provider component
export function AgentProvider({ children }: AgentProviderProps) {
  const [agents, setAgents] = useState<Record<string, AgentState>>({});
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsContext = useWsContext();

  const refreshAgents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest<AgentState[]>('/api/agents');
      const agentsMap = response.reduce((acc, agent) => {
        acc[agent.id] = agent;
        return acc;
      }, {} as Record<string, AgentState>);
      setAgents(agentsMap);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectAgent = useCallback((id: string) => {
    setSelectedAgent(id);
  }, []);

  useEffect(() => {
    if (wsContext?.connected) {
      refreshAgents();
    }
  }, [wsContext?.connected, refreshAgents]);

  const value: AgentStoreState = {
    agents,
    isLoading,
    error,
    selectedAgent,
    refreshAgents,
    selectAgent
  };

  return (
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

// Utility functions
export const formatProfit = (profit: number): string => {
  return `$${profit.toFixed(2)}`;
};

export const formatSuccessRate = (rate: number): string => {
  return `${(rate * 100).toFixed(1)}%`;
};

export const getAgentColor = (type: AgentType): string => {
  switch(type) {
    case AgentType.HYPERION: return 'text-blue-400';
    case AgentType.QUANTUM: return 'text-purple-400';
    case AgentType.ANALYZER: return 'text-green-400';
    default: return 'text-gray-400';
  }
};

export const getStatusLabel = (status: AgentStatus): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export const getStatusColor = (status: AgentStatus): string => {
  switch(status) {
    case AgentStatus.EXECUTING: return 'text-green-400';
    case AgentStatus.SCANNING: return 'text-blue-400';
    case AgentStatus.ERROR: return 'text-red-400';
    default: return 'text-gray-400';
  }
};
