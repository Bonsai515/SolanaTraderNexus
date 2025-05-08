import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// Agent type
interface Agent {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'training';
  type: 'predictor' | 'executor' | 'analyzer';
  accuracy: number;
  pairs: string[];
  lastTraining: string;
  performance: number;
}

// Mock data for initial UI design (will be replaced with API data)
const sampleAgents: Agent[] = [
  {
    id: '1',
    name: 'SOL/USDC Predictor',
    status: 'active',
    type: 'predictor',
    accuracy: 0.78,
    pairs: ['SOL/USDC'],
    lastTraining: '2025-05-07T14:32:00Z',
    performance: 0.92,
  },
  {
    id: '2',
    name: 'Market Trend Analyzer',
    status: 'active',
    type: 'analyzer',
    accuracy: 0.83,
    pairs: ['SOL/USDC', 'BTC/USDC', 'ETH/USDC'],
    lastTraining: '2025-05-06T11:15:00Z',
    performance: 0.87,
  },
  {
    id: '3',
    name: 'Arbitrage Executor',
    status: 'inactive',
    type: 'executor',
    accuracy: 0.65,
    pairs: ['SOL/USDC', 'SOL/USDT'],
    lastTraining: '2025-05-02T09:45:00Z',
    performance: 0.71,
  },
  {
    id: '4',
    name: 'Multi-DEX Analyzer',
    status: 'training',
    type: 'analyzer',
    accuracy: 0.79,
    pairs: ['SOL/USDC', 'RAY/USDC', 'SRM/USDC'],
    lastTraining: '2025-05-08T10:30:00Z',
    performance: 0.81,
  },
];

export default function AIAgents() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  
  // Get AI status
  const { data: aiStatus, isLoading: aiStatusLoading } = useQuery({
    queryKey: ['/api/ai/status'],
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Filter functions
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  const filteredAgents = sampleAgents.filter(agent => {
    if (statusFilter !== 'all' && agent.status !== statusFilter) return false;
    if (typeFilter !== 'all' && agent.type !== typeFilter) return false;
    return true;
  });
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">AI Agents</h1>
        
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${
            aiStatus?.status === 'operational' 
              ? 'bg-success/20 text-success' 
              : 'bg-warning/20 text-warning'
          }`}>
            <div className={`h-2 w-2 rounded-full ${
              aiStatus?.status === 'operational' ? 'bg-success' : 'bg-warning'
            }`}></div>
            <span>
              {aiStatus?.status === 'operational' ? 'AI System Online' : 'Initializing...'}
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
              <div className={`px-2 py-1 rounded-full text-xs ${
                agent.status === 'active' ? 'bg-success/20 text-success' : 
                agent.status === 'training' ? 'bg-info/20 text-info' : 
                'bg-muted text-muted-foreground'
              }`}>
                {agent.status}
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{agent.type}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Accuracy:</span>
                <span className="font-medium">{(agent.accuracy * 100).toFixed(1)}%</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Performance:</span>
                <span className={`font-medium ${
                  agent.performance > 0.85 ? 'text-success' : 
                  agent.performance > 0.7 ? 'text-warning' : 
                  'text-destructive'
                }`}>
                  {(agent.performance * 100).toFixed(1)}%
                </span>
              </div>
              
              <div>
                <span className="text-muted-foreground">Token Pairs:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {agent.pairs.map(pair => (
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
      {selectedAgent && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-2xl rounded-lg shadow-lg border border-border p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedAgent.name}</h2>
              <button 
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedAgent(null)}
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm text-muted-foreground mb-1">Status</h3>
                  <div className={`inline-block px-2 py-1 rounded-full text-sm ${
                    selectedAgent.status === 'active' ? 'bg-success/20 text-success' : 
                    selectedAgent.status === 'training' ? 'bg-info/20 text-info' : 
                    'bg-muted text-muted-foreground'
                  }`}>
                    {selectedAgent.status}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm text-muted-foreground mb-1">Type</h3>
                  <p className="capitalize">{selectedAgent.type}</p>
                </div>
                
                <div>
                  <h3 className="text-sm text-muted-foreground mb-1">Accuracy</h3>
                  <p>{(selectedAgent.accuracy * 100).toFixed(1)}%</p>
                </div>
                
                <div>
                  <h3 className="text-sm text-muted-foreground mb-1">Performance</h3>
                  <p className={
                    selectedAgent.performance > 0.85 ? 'text-success' : 
                    selectedAgent.performance > 0.7 ? 'text-warning' : 
                    'text-destructive'
                  }>
                    {(selectedAgent.performance * 100).toFixed(1)}%
                  </p>
                </div>
                
                <div>
                  <h3 className="text-sm text-muted-foreground mb-1">Last Training</h3>
                  <p>{new Date(selectedAgent.lastTraining).toLocaleString()}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm text-muted-foreground mb-1">Token Pairs</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.pairs.map(pair => (
                    <span key={pair} className="bg-accent px-3 py-1 rounded-lg text-sm">
                      {pair}
                    </span>
                  ))}
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
                {selectedAgent.status !== 'training' && (
                  <button className="px-4 py-2 bg-info text-info-foreground rounded-md text-sm">
                    Start Training
                  </button>
                )}
                
                {selectedAgent.status === 'active' ? (
                  <button className="px-4 py-2 bg-muted text-muted-foreground rounded-md text-sm">
                    Deactivate
                  </button>
                ) : (
                  <button className="px-4 py-2 bg-success text-success-foreground rounded-md text-sm">
                    Activate
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
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