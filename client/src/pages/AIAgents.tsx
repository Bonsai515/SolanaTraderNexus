import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  AgentState, 
  AgentType, 
  AgentStatus, 
  ExecutionResult,
  useAgentStore,
  useAgentWebSocketHandlers,
  formatProfit,
  formatSuccessRate,
  getAgentColor,
  getStatusLabel,
  getStatusColor
} from '../lib/agentClient';
import { useWsContext } from '../lib/wsClient';

interface AgentDetailsProps {
  agent: AgentState;
  onClose: () => void;
}

// Agent Detail Component
const AgentDetail: React.FC<AgentDetailsProps> = ({ agent, onClose }) => {
  const { startSystem, stopSystem } = useAgentStore();
  
  const handleAction = async () => {
    if (agent.active) {
      await stopSystem();
    } else {
      await startSystem();
    }
  };
  
  // Get pairs for this agent
  const pairs = agent.id in tradingPairs 
    ? tradingPairs[agent.id as keyof typeof tradingPairs] 
    : ['SOL/USDC'];
  
  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card w-full max-w-2xl rounded-lg shadow-lg border border-border p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold">{agent.name}</h2>
          <button 
            className="text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm text-muted-foreground mb-1">Status</h3>
              <div className={`inline-block px-2 py-1 rounded-full text-sm bg-${getStatusColor(agent.status)}/20 text-${getStatusColor(agent.status)}`}>
                {getStatusLabel(agent.status)}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm text-muted-foreground mb-1">Type</h3>
              <p className="capitalize">{agent.type}</p>
            </div>
            
            <div>
              <h3 className="text-sm text-muted-foreground mb-1">Success Rate</h3>
              <p>{formatSuccessRate(agent.metrics.successRate)}</p>
            </div>
            
            <div>
              <h3 className="text-sm text-muted-foreground mb-1">Total Profit</h3>
              <p className={agent.metrics.totalProfit > 0 ? 'text-success' : 'text-destructive'}>
                {formatProfit(agent.metrics.totalProfit)} USDC
              </p>
            </div>
            
            <div>
              <h3 className="text-sm text-muted-foreground mb-1">Total Executions</h3>
              <p>{agent.metrics.totalExecutions}</p>
            </div>
            
            {agent.metrics.lastExecution && (
              <div>
                <h3 className="text-sm text-muted-foreground mb-1">Last Execution</h3>
                <p>{new Date(agent.metrics.lastExecution).toLocaleString()}</p>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-sm text-muted-foreground mb-1">Token Pairs</h3>
            <div className="flex flex-wrap gap-2">
              {pairs.map(pair => (
                <span key={pair} className="bg-accent px-3 py-1 rounded-lg text-sm">
                  {pair}
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm text-muted-foreground mb-1">Wallets</h3>
            <div className="space-y-2 text-xs">
              {agent.wallets.trading && (
                <div>
                  <span className="text-muted-foreground">Trading Wallet:</span>
                  <span className="ml-2 font-mono">{agent.wallets.trading.slice(0, 8)}...{agent.wallets.trading.slice(-4)}</span>
                </div>
              )}
              
              {agent.wallets.profit && (
                <div>
                  <span className="text-muted-foreground">Profit Vault:</span>
                  <span className="ml-2 font-mono">{agent.wallets.profit.slice(0, 8)}...{agent.wallets.profit.slice(-4)}</span>
                </div>
              )}
              
              {agent.wallets.fee && (
                <div>
                  <span className="text-muted-foreground">Fee Wallet:</span>
                  <span className="ml-2 font-mono">{agent.wallets.fee.slice(0, 8)}...{agent.wallets.fee.slice(-4)}</span>
                </div>
              )}
              
              {agent.wallets.stealth && agent.wallets.stealth.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Stealth Wallets:</span>
                  <span className="ml-2 font-mono">{agent.wallets.stealth[0].slice(0, 8)}...{agent.wallets.stealth[0].slice(-4)}</span>
                  {agent.wallets.stealth.length > 1 && (
                    <span className="ml-1 text-muted-foreground">(+{agent.wallets.stealth.length - 1} more)</span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="pt-2">
            <h3 className="text-md font-medium mb-2">Model Parameters</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model Type:</span>
                <span>Quantum Transformer</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Heads:</span>
                <span>8</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dimension:</span>
                <span>512</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantum States:</span>
                <span>8</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 justify-end pt-4">
            <button 
              className={`px-4 py-2 rounded-md text-sm ${
                agent.active 
                  ? 'bg-destructive text-destructive-foreground' 
                  : 'bg-success text-success-foreground'
              }`}
              onClick={handleAction}
            >
              {agent.active ? 'Stop Agent' : 'Start Agent'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Trading pair information
const tradingPairs = {
  'hyperion-1': ['SOL/USDC', 'RAY/USDC', 'JUP/USDC', 'BONK/USDC'],
  'quantum-omega-1': ['SOL/USDC', 'JUP/USDC', 'BONK/USDC']
};

export default function AIAgents() {
  const [selectedAgent, setSelectedAgent] = useState<AgentState | null>(null);
  const { agents, systemRunning, transformerStatus, startSystem } = useAgentStore();
  
  // Get AI status
  const { data: aiStatus, isLoading: aiStatusLoading } = useQuery({
    queryKey: ['/api/ai/status'],
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Filter functions
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  const filteredAgents = agents.filter(agent => {
    if (statusFilter !== 'all' && (
      (statusFilter === 'active' && !agent.active) ||
      (statusFilter === 'idle' && agent.status !== AgentStatus.IDLE) ||
      (statusFilter === 'scanning' && agent.status !== AgentStatus.SCANNING) ||
      (statusFilter === 'executing' && agent.status !== AgentStatus.EXECUTING)
    )) return false;
    
    if (typeFilter !== 'all' && (
      (typeFilter === 'hyperion' && agent.type !== AgentType.HYPERION) ||
      (typeFilter === 'quantum' && agent.type !== AgentType.QUANTUM_OMEGA)
    )) return false;
    
    return true;
  });
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">AI Agents</h1>
        
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${
            (aiStatus && aiStatus.status === 'operational')
              ? 'bg-success/20 text-success' 
              : 'bg-warning/20 text-warning'
          }`}>
            <div className={`h-2 w-2 rounded-full ${
              (aiStatus && aiStatus.status === 'operational') ? 'bg-success' : 'bg-warning'
            }`}></div>
            <span>
              {(aiStatus && aiStatus.status === 'operational') ? 'AI System Online' : 'Initializing...'}
            </span>
          </div>
          
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
            New Agent
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-card rounded-lg shadow-md p-4 border border-border">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Status</label>
            <select 
              className="bg-background border border-input rounded px-3 py-1"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="training">Training</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Type</label>
            <select 
              className="bg-background border border-input rounded px-3 py-1"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="predictor">Predictor</option>
              <option value="executor">Executor</option>
              <option value="analyzer">Analyzer</option>
            </select>
          </div>
          
          <div className="ml-auto self-end">
            <button className="px-3 py-1 border border-input rounded text-sm">
              Reset Filters
            </button>
          </div>
        </div>
      </div>
      
      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgents.map((agent) => (
          <div 
            key={agent.id} 
            className="bg-card rounded-lg shadow-md p-5 border border-border hover:bg-accent/20 cursor-pointer transition-colors"
            onClick={() => setSelectedAgent(agent)}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold">{agent.name}</h3>
              <div className={`px-2 py-1 rounded-full text-xs bg-${getStatusColor(agent.status)}/20 text-${getStatusColor(agent.status)}`}>
                {getStatusLabel(agent.status)}
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{agent.type}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Success Rate:</span>
                <span className="font-medium">{formatSuccessRate(agent.metrics.successRate)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Profit:</span>
                <span className={`font-medium ${agent.metrics.totalProfit > 0 ? 'text-success' : 'text-destructive'}`}>
                  {agent.metrics.totalProfit > 0 ? '+' : ''}{formatProfit(agent.metrics.totalProfit)} USDC
                </span>
              </div>
              
              <div>
                <span className="text-muted-foreground">Token Pairs:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {tradingPairs[agent.id as keyof typeof tradingPairs]?.map((pair) => (
                    <span key={pair} className="bg-accent px-2 py-0.5 rounded-full text-xs">
                      {pair}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Selected Agent Details */}
      {selectedAgent && <AgentDetail agent={selectedAgent} onClose={() => setSelectedAgent(null)} />}
      
      {filteredAgents.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <p>No agents match your filters</p>
          <button 
            className="text-primary hover:underline mt-2"
            onClick={() => {
              setStatusFilter('all');
              setTypeFilter('all');
            }}
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}