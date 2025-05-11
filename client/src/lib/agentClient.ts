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

// Create context with default value
export const AgentContext = createContext<AgentStoreState>({
  agents: {},
  isLoading: false,
  error: null,
  selectedAgent: null,
  refreshAgents: async () => {},
  selectAgent: () => {}
});

// Hook to use agent context
export const useAgentStore = () => useContext(AgentContext);

export const useAgentWebSocketHandlers = () => {
  const { connect } = useWsContext();

  useEffect(() => {
    const socket = connect('/agents');
    return () => {
      socket.close();
    };
  }, [connect]);

  return {};
};

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