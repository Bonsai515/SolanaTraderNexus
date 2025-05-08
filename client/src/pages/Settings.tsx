import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import useWsStore from '../lib/wsClient';
import useSolanaStore from '../lib/solanaUtils';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const wsStore = useWsStore();
  const solanaStore = useSolanaStore();
  
  // Get Solana connection status
  const { data: solanaStatus, isLoading } = useQuery({
    queryKey: ['/api/solana/status'],
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Get AI status
  const { data: aiStatus, isLoading: aiStatusLoading } = useQuery({
    queryKey: ['/api/ai/status'],
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Handler to reconnect WebSocket
  const handleReconnectWebSocket = () => {
    wsStore.disconnect();
    setTimeout(() => {
      wsStore.connect();
    }, 1000);
  };
  
  // Handler to reconnect Solana
  const handleReconnectSolana = async () => {
    solanaStore.disconnect();
    await solanaStore.connect();
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Tabs */}
        <div className="md:w-1/4">
          <div className="bg-card rounded-lg shadow-md p-4 border border-border">
            <div className="space-y-1">
              <button 
                className={`w-full text-left px-3 py-2 rounded-md ${activeTab === 'general' ? 'bg-accent' : 'hover:bg-accent/50'}`}
                onClick={() => setActiveTab('general')}
              >
                General
              </button>
              <button 
                className={`w-full text-left px-3 py-2 rounded-md ${activeTab === 'connection' ? 'bg-accent' : 'hover:bg-accent/50'}`}
                onClick={() => setActiveTab('connection')}
              >
                Connection
              </button>
              <button 
                className={`w-full text-left px-3 py-2 rounded-md ${activeTab === 'ai' ? 'bg-accent' : 'hover:bg-accent/50'}`}
                onClick={() => setActiveTab('ai')}
              >
                AI System
              </button>
              <button 
                className={`w-full text-left px-3 py-2 rounded-md ${activeTab === 'security' ? 'bg-accent' : 'hover:bg-accent/50'}`}
                onClick={() => setActiveTab('security')}
              >
                Security
              </button>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="md:w-3/4">
          <div className="bg-card rounded-lg shadow-md p-6 border border-border">
            {/* General Settings */}
            {activeTab === 'general' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">General Settings</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-md font-medium mb-3">Preferences</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Auto-refresh data</label>
                        <div className="flex items-center">
                          <select className="bg-background border border-input rounded-md text-sm p-1">
                            <option>10 seconds</option>
                            <option>30 seconds</option>
                            <option>1 minute</option>
                            <option>5 minutes</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Default page</label>
                        <div className="flex items-center">
                          <select className="bg-background border border-input rounded-md text-sm p-1">
                            <option>Dashboard</option>
                            <option>Trading</option>
                            <option>Strategies</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-md font-medium mb-3">Notification Settings</h3>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input 
                          type="checkbox" 
                          id="signalNotif" 
                          className="mr-2" 
                          defaultChecked
                        />
                        <label htmlFor="signalNotif" className="text-sm">
                          Signal notifications
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input 
                          type="checkbox" 
                          id="txNotif" 
                          className="mr-2" 
                          defaultChecked
                        />
                        <label htmlFor="txNotif" className="text-sm">
                          Transaction notifications
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input 
                          type="checkbox" 
                          id="errorNotif" 
                          className="mr-2" 
                          defaultChecked
                        />
                        <label htmlFor="errorNotif" className="text-sm">
                          Error notifications
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 flex justify-end">
                    <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Connection Settings */}
            {activeTab === 'connection' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Connection Settings</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-md font-medium mb-3">Solana Connection</h3>
                    <div className="bg-background p-4 rounded-md border border-input mb-3">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <span className={`text-sm ${solanaStatus?.status === 'operational' ? 'text-success' : 'text-warning'}`}>
                          {solanaStatus?.status === 'operational' ? 'Connected' : 'Connecting...'}
                        </span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Network:</span>
                        <span className="text-sm">
                          {solanaStatus?.network || 'mainnet-beta'}
                        </span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Custom RPC:</span>
                        <span className="text-sm">
                          {solanaStatus?.customRpc ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">API Key:</span>
                        <span className="text-sm">
                          {solanaStatus?.apiKey ? 'Configured' : 'Not configured'}
                        </span>
                      </div>
                    </div>
                    <button 
                      className="px-3 py-1 bg-accent text-sm rounded-md"
                      onClick={handleReconnectSolana}
                    >
                      Reconnect
                    </button>
                  </div>
                  
                  <div>
                    <h3 className="text-md font-medium mb-3">WebSocket Connection</h3>
                    <div className="bg-background p-4 rounded-md border border-input mb-3">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <span className={`text-sm ${wsStore.connectionState.connected ? 'text-success' : 'text-warning'}`}>
                          {wsStore.connectionState.connected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Attempts:</span>
                        <span className="text-sm">
                          {wsStore.connectionState.connectionAttempts}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Last Message:</span>
                        <span className="text-sm">
                          {wsStore.connectionState.lastMessageTime
                            ? new Date(wsStore.connectionState.lastMessageTime).toLocaleTimeString()
                            : 'Never'}
                        </span>
                      </div>
                    </div>
                    <button 
                      className="px-3 py-1 bg-accent text-sm rounded-md"
                      onClick={handleReconnectWebSocket}
                    >
                      Reconnect
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* AI System Settings */}
            {activeTab === 'ai' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">AI System Settings</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-md font-medium mb-3">Transformer Model</h3>
                    <div className="bg-background p-4 rounded-md border border-input mb-3">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <span className={`text-sm ${aiStatus?.status === 'operational' ? 'text-success' : 'text-warning'}`}>
                          {aiStatus?.status === 'operational' ? 'Operational' : 'Initializing...'}
                        </span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Model Version:</span>
                        <span className="text-sm">
                          Quantum Transformer v1.0
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Last Updated:</span>
                        <span className="text-sm">
                          {aiStatus?.timestamp 
                            ? new Date(aiStatus.timestamp).toLocaleString()
                            : new Date().toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-md font-medium mb-3">Model Parameters</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Number of heads</label>
                        <select className="bg-background border border-input rounded-md text-sm p-1">
                          <option>4</option>
                          <option selected>8</option>
                          <option>16</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Model dimension</label>
                        <select className="bg-background border border-input rounded-md text-sm p-1">
                          <option>256</option>
                          <option selected>512</option>
                          <option>1024</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Quantum states</label>
                        <select className="bg-background border border-input rounded-md text-sm p-1">
                          <option>4</option>
                          <option selected>8</option>
                          <option>16</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 flex justify-end">
                    <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Security Settings */}
            {activeTab === 'security' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Security Settings</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-md font-medium mb-3">API Keys</h3>
                    <div className="bg-background p-4 rounded-md border border-input mb-3">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Solana RPC API Key:</span>
                        <span className="text-sm">••••••••</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Instant Nodes RPC URL:</span>
                        <span className="text-sm">••••••••</span>
                      </div>
                    </div>
                    <button className="px-3 py-1 bg-accent text-sm rounded-md">
                      Update API Keys
                    </button>
                  </div>
                  
                  <div>
                    <h3 className="text-md font-medium mb-3">Trading Limits</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Max transaction size (SOL)</label>
                        <input 
                          type="number" 
                          className="bg-background border border-input rounded-md text-sm p-1 w-24 text-right"
                          defaultValue="10"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Daily transaction limit (SOL)</label>
                        <input 
                          type="number" 
                          className="bg-background border border-input rounded-md text-sm p-1 w-24 text-right"
                          defaultValue="100"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 flex justify-end">
                    <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}