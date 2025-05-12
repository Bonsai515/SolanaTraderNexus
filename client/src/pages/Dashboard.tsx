import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import useWsStore, { useWsConnectionState, useSolanaConnectionInfo } from '../lib/wsClient';
import useSolanaStore from '../lib/solanaUtils';
import LiveTradingActivator from '../components/LiveTradingActivator';
import { ReloadIcon } from '@radix-ui/react-icons';

export default function Dashboard() {
  const [connectionStatus, setConnectionStatus] = useState({
    status: 'loading',
    customRpc: false,
    apiKey: false,
    network: '',
    timestamp: '',
    websocket: false,
    version: ''
  });
  
  // Get WebSocket store
  const { messages, registerHandler } = useWsStore();
  const wsConnectionState = useWsConnectionState();
  
  // Use the enhanced Solana connection info hook
  const { 
    connectionInfo, 
    loading: loadingConnectionInfo, 
    error: connectionInfoError, 
    refresh: refreshConnectionInfo 
  } = useSolanaConnectionInfo();
  
  // Get Solana connection status from HTTP API as fallback
  const { data: solanaStatus, isLoading } = useQuery({
    queryKey: ['/api/solana/status'],
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Listen for WebSocket connection status updates
  useEffect(() => {
    const unregister = registerHandler('Solana connection status:', (message) => {
      if (message.data) {
        setConnectionStatus(prev => ({
          ...prev,
          ...message.data
        }));
      }
    });
    
    return () => unregister();
  }, [registerHandler]);
  
  // Update connection status when we get detailed info
  useEffect(() => {
    if (connectionInfo) {
      setConnectionStatus(prev => ({
        ...prev,
        ...connectionInfo
      }));
    }
  }, [connectionInfo]);
  
  // Get strategies from API
  const { data: strategies, isLoading: loadingStrategies } = useQuery({
    queryKey: ['/api/strategies'],
    staleTime: 30 * 1000, // 30 seconds
  });
  
  // Get signals from API
  const { data: signals, isLoading: loadingSignals } = useQuery({
    queryKey: ['/api/signals'],
    staleTime: 30 * 1000, // 30 seconds
  });
  
  // Get wallets from API
  const { data: wallets, isLoading: loadingWallets } = useQuery({
    queryKey: ['/api/wallets'],
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Dashboard metrics
  const activeStrategies = strategies?.filter(s => s.active).length || 0;
  const totalStrategies = strategies?.length || 0;
  const recentSignals = signals?.slice(0, 5) || [];
  const totalBalance = wallets?.reduce((sum, wallet) => sum + wallet.balance, 0) || 0;
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${connectionStatus.status === 'operational' ? 'bg-success' : 'bg-warning'}`}></div>
            <span className="text-sm">
              {connectionStatus.status === 'operational' ? 'Connected' : 'Connecting...'}
            </span>
          </div>
          <LiveTradingActivator />
        </div>
      </div>
      
      {/* Status Card */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-lg shadow-md p-4 border border-border">
          <div className="flex justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Network</h3>
            {wsConnectionState.connected && (
              <button 
                onClick={refreshConnectionInfo} 
                className="text-primary hover:text-primary/80 transition-colors"
                title="Refresh connection info"
              >
                <ReloadIcon className={`h-4 w-4 ${loadingConnectionInfo ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
          <p className="text-2xl font-bold">{connectionStatus.network || solanaStatus?.network || 'Unknown'}</p>
          <div className="mt-1 flex items-center text-xs">
            <div className={`h-2 w-2 rounded-full mr-1.5 ${connectionStatus.websocket ? 'bg-success' : 'bg-orange-500'}`}></div>
            <span className="text-muted-foreground">
              {connectionStatus.websocket 
                ? 'Using WebSocket connection' 
                : 'Using HTTP connection'}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {connectionStatus.customRpc ? 'Using custom RPC endpoint' : 'Using public RPC'}
            {connectionStatus.version && ` · v${connectionStatus.version}`}
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow-md p-4 border border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Strategies</h3>
          <p className="text-2xl font-bold">{activeStrategies} / {totalStrategies}</p>
          <div className="mt-2 text-xs text-muted-foreground">
            Active / Total
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow-md p-4 border border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Signals (24h)</h3>
          <p className="text-2xl font-bold">{signals?.length || 0}</p>
          <div className="mt-2 text-xs text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow-md p-4 border border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Total Balance</h3>
          <p className="text-2xl font-bold">{totalBalance.toFixed(2)} SOL</p>
          <div className="mt-2 text-xs text-muted-foreground">
            Across {wallets?.length || 0} wallets
          </div>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/trading">
          <a className="bg-card rounded-lg shadow-md p-6 border border-border hover:bg-accent transition-colors">
            <h3 className="text-xl font-semibold mb-2">Trading</h3>
            <p className="text-muted-foreground">Execute trades and monitor market positions</p>
          </a>
        </Link>
        
        <Link href="/strategies">
          <a className="bg-card rounded-lg shadow-md p-6 border border-border hover:bg-accent transition-colors">
            <h3 className="text-xl font-semibold mb-2">Strategies</h3>
            <p className="text-muted-foreground">Configure and manage trading strategies</p>
          </a>
        </Link>
        
        <Link href="/ai-agents">
          <a className="bg-card rounded-lg shadow-md p-6 border border-border hover:bg-accent transition-colors">
            <h3 className="text-xl font-semibold mb-2">AI Agents</h3>
            <p className="text-muted-foreground">Manage quantum-inspired AI trading agents</p>
          </a>
        </Link>
      </div>
      
      {/* Connection Details */}
      <div className="bg-card rounded-lg shadow-md p-6 border border-border mb-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Connection Details</h2>
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${wsConnectionState.connected ? 'bg-success' : 'bg-destructive'}`}></div>
            <span className="text-sm text-muted-foreground">
              {wsConnectionState.connected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium mb-2">Solana Connection</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network:</span>
                <span>{connectionStatus.network || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">WebSocket Support:</span>
                <span>{connectionStatus.websocket ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custom RPC:</span>
                <span>{connectionStatus.customRpc ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">API Key:</span>
                <span>{connectionStatus.apiKey ? 'Present' : 'None'}</span>
              </div>
              {connectionStatus.version && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <span>{connectionStatus.version}</span>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2">WebSocket Connection</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span>{wsConnectionState.connected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Connection Attempts:</span>
                <span>{wsConnectionState.connectionAttempts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Message:</span>
                <span>
                  {wsConnectionState.lastMessageTime 
                    ? new Date(wsConnectionState.lastMessageTime).toLocaleTimeString() 
                    : 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Messages:</span>
                <span>{messages.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent Signals */}
      <div className="bg-card rounded-lg shadow-md p-6 border border-border">
        <h2 className="text-xl font-semibold mb-4">Recent Signals</h2>
        
        {loadingSignals ? (
          <div className="text-center py-4">Loading signals...</div>
        ) : recentSignals.length > 0 ? (
          <div className="space-y-4">
            {recentSignals.map(signal => (
              <div key={signal.id} className="flex justify-between items-center p-3 border border-border rounded-lg">
                <div>
                  <div className="font-medium">{signal.pair}</div>
                  <div className="text-sm text-muted-foreground">
                    Strategy: {signal.strategy_id}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className={`text-sm font-medium ${
                    signal.type === 'BUY' ? 'text-success' : 
                    signal.type === 'SELL' ? 'text-destructive' : 'text-muted-foreground'
                  }`}>
                    {signal.type}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(signal.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">No recent signals</div>
        )}
        
        {recentSignals.length > 0 && (
          <div className="mt-4 text-center">
            <Link href="/trading">
              <a className="text-sm text-primary hover:underline">View all signals</a>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}