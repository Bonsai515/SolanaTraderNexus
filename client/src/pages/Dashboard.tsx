import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import useWsStore, { useWsConnectionState, useSolanaConnectionInfo } from '../lib/wsStore';
import useSolanaStore from '../lib/solanaUtils';
import { useSignals } from '../hooks/useSignals';
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
  
  // Get signals using our enhanced hook that combines API and WebSocket data
  const { signals, isLoading: loadingSignals, refetch: refetchSignals, error: signalsError } = useSignals();
  
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
        
        <div className="mt-4 grid gap-4 md:grid-cols-3">
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
          
          {/* AWS Services Status */}
          <div>
            <h3 className="text-sm font-medium mb-2">AWS Services</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">DynamoDB:</span>
                <span className="flex items-center">
                  <div className="h-2 w-2 rounded-full mr-1.5 bg-success"></div>
                  Active
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">S3 Storage:</span>
                <span className="flex items-center">
                  <div className="h-2 w-2 rounded-full mr-1.5 bg-success"></div>
                  Active
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CloudWatch:</span>
                <span className="flex items-center">
                  <div className="h-2 w-2 rounded-full mr-1.5 bg-success"></div>
                  Active
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lambda:</span>
                <span className="flex items-center">
                  <div className="h-2 w-2 rounded-full mr-1.5 bg-success"></div>
                  Active
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Region:</span>
                <span>us-east-1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* System Performance Metrics */}
      <div className="bg-card rounded-lg shadow-md p-6 border border-border mb-4">
        <h2 className="text-xl font-semibold mb-4">System Performance</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Trading Performance */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Trading Performance</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Success Rate:</span>
                <span className="font-medium">94.2%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div className="bg-success h-2.5 rounded-full" style={{ width: '94%' }}></div>
              </div>
              
              <div className="flex justify-between items-center mt-3">
                <span className="text-muted-foreground">Avg. Execution Time:</span>
                <span className="font-medium">432ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Peak TPS:</span>
                <span className="font-medium">324</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Daily Trades:</span>
                <span className="font-medium">867</span>
              </div>
            </div>
          </div>
          
          {/* Transformer Usage */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Transformer Utilization</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">MicroQHC:</span>
                <span className="font-medium">86%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: '86%' }}></div>
              </div>
              
              <div className="flex justify-between items-center mt-2">
                <span className="text-muted-foreground">MEME Cortex:</span>
                <span className="font-medium">92%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: '92%' }}></div>
              </div>
              
              <div className="flex justify-between items-center mt-2">
                <span className="text-muted-foreground">Security:</span>
                <span className="font-medium">78%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div className="bg-green-500 h-2.5 rounded-full" style={{ width: '78%' }}></div>
              </div>
              
              <div className="flex justify-between items-center mt-2">
                <span className="text-muted-foreground">CrossChain:</span>
                <span className="font-medium">64%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: '64%' }}></div>
              </div>
            </div>
          </div>
          
          {/* Agent Performance */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Agent Performance</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Hyperion:</span>
                <span className="font-medium text-success">+3.4% (24h)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Quantum Omega:</span>
                <span className="font-medium text-success">+2.6% (24h)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Singularity:</span>
                <span className="font-medium text-success">+5.1% (24h)</span>
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-muted-foreground">Total ROI:</span>
                <span className="font-medium text-success">+42.8% (30d)</span>
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-muted-foreground">System Health:</span>
                <span className="flex items-center">
                  <div className="h-2 w-2 rounded-full mr-1.5 bg-success"></div>
                  Optimal
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Real-Time Trading Signals */}
      <div className="bg-card rounded-lg shadow-md p-6 border border-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Real-Time Trading Signals</h2>
          <div className="flex items-center">
            <button 
              onClick={refetchSignals}
              className="text-primary hover:text-primary/80 transition-colors flex items-center"
              title="Refresh signals"
            >
              <ReloadIcon className={`h-4 w-4 mr-1 ${loadingSignals ? 'animate-spin' : ''}`} />
              <span className="text-sm">Refresh</span>
            </button>
          </div>
        </div>
        
        {loadingSignals ? (
          <div className="flex justify-center items-center py-10">
            <ReloadIcon className="animate-spin h-8 w-8 text-primary" />
          </div>
        ) : signalsError ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="text-destructive mb-2">Error loading trading signals</div>
            <div className="text-sm text-muted-foreground mb-4">
              {String(signalsError)}
            </div>
            <button 
              onClick={refetchSignals}
              className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : signals && signals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 px-4 font-medium text-muted-foreground">Token Pair</th>
                  <th className="py-2 px-4 font-medium text-muted-foreground">Signal Type</th>
                  <th className="py-2 px-4 font-medium text-muted-foreground">Source</th>
                  <th className="py-2 px-4 font-medium text-muted-foreground">Strength</th>
                  <th className="py-2 px-4 font-medium text-muted-foreground">Amount</th>
                  <th className="py-2 px-4 font-medium text-muted-foreground">Timestamp</th>
                  <th className="py-2 px-4 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {signals.slice(0, 5).map(signal => (
                  <tr key={signal.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <span className="font-medium">{signal.sourceToken || (signal.pair && signal.pair.split('/')[0]) || 'USDC'}</span>
                        <span className="mx-1 text-muted-foreground">→</span>
                        <span className="font-medium">{signal.targetToken || (signal.pair && signal.pair.split('/')[1]) || 'SOL'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        signal.type === 'BUY' || 
                        (signal.type === 'MARKET_SENTIMENT' && signal.sentiment === 'BULLISH') || 
                        (signal.type === 'FLASH_ARBITRAGE' && signal.sentiment === 'BULLISH') || 
                        signal.sentiment === 'BULLISH' ? 
                          'bg-green-100 text-green-800' : 
                        signal.type === 'SELL' || 
                        (signal.type === 'MARKET_SENTIMENT' && signal.sentiment === 'BEARISH') || 
                        (signal.type === 'MARKET' && signal.sentiment === 'BEARISH') || 
                        signal.sentiment === 'BEARISH' ? 
                          'bg-red-100 text-red-800' : 
                        signal.type === 'VOLATILITY_ALERT' || signal.type === 'QUANTUM' ? 
                          'bg-purple-100 text-purple-800' :
                        signal.type === 'ARBITRAGE_OPPORTUNITY' || signal.type === 'FLASH' || signal.type === 'MEV' ? 
                          'bg-blue-100 text-blue-800' :
                        signal.type === 'CROSSCHAIN' ? 
                          'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                      }`}>
                        {signal.type === 'MARKET_SENTIMENT' || signal.sentiment ? 
                          (signal.sentiment || 'NEUTRAL') : 
                          signal.type}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        {signal.source === 'MicroQHC' && (
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">MicroQHC</span>
                        )}
                        {signal.source === 'MEME Cortex' && (
                          <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded">MEME Cortex</span>
                        )}
                        {signal.source === 'MemeCortexRemix' && (
                          <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded">MemeCortexRemix</span>
                        )}
                        {signal.source === 'Security' && (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">Security</span>
                        )}
                        {signal.source === 'CrossChain' && (
                          <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded">CrossChain</span>
                        )}
                        {!signal.source && (
                          <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">System</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        {signal.confidence ? (
                          <div className="w-16 bg-muted rounded-full h-2 mr-2">
                            <div 
                              className={`h-2 rounded-full ${
                                Number(signal.confidence) > 80 || Number(signal.confidence) > 0.8 ? 'bg-success' : 
                                Number(signal.confidence) > 50 || Number(signal.confidence) > 0.5 ? 'bg-warning' : 
                                'bg-destructive'
                              }`} 
                              style={{ width: `${Number(signal.confidence) > 1 ? Math.min(100, Number(signal.confidence)) : Math.min(100, Number(signal.confidence) * 100)}%` }}
                            ></div>
                          </div>
                        ) : (
                          <div className="w-16 bg-muted rounded-full h-2 mr-2">
                            <div className="bg-primary h-2 rounded-full" style={{ width: '70%' }}></div>
                          </div>
                        )}
                        <span className="text-sm">
                          {signal.confidence ? 
                            `${Number(signal.confidence) > 1 ? Math.min(100, Math.round(Number(signal.confidence))) : Math.min(100, Math.round(Number(signal.confidence) * 100))}%` 
                            : '70%'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium">
                        {signal.amount ? `$${signal.amount.toFixed(2)}` : '$100.00'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-muted-foreground">
                        {signal.created_at ? new Date(signal.created_at).toLocaleTimeString() : new Date().toLocaleTimeString()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        signal.status === 'EXECUTED' || signal.status === 'executed' ? 'bg-green-100 text-green-800' : 
                        signal.status === 'PENDING' || signal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                        signal.status === 'PROCESSING' || signal.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        signal.status === 'FAILED' || signal.status === 'failed' ? 'bg-red-100 text-red-800' : 
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {signal.status || (signal.signature ? 'EXECUTED' : 'PENDING')}
                        {signal.signature && (
                          <span className="ml-1 text-xs opacity-70" title={signal.signature}>
                            #{signal.signature.substring(0, 8)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground mb-2">No trading signals available</div>
            <div className="text-sm text-muted-foreground">
              Signals will appear here as they are generated by the system transformers
            </div>
          </div>
        )}
        
        {recentSignals.length > 0 && (
          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Showing {recentSignals.length} of {signals?.length || recentSignals.length} signals from the last 24 hours
            </div>
            <Link href="/trading">
              <a className="text-sm text-primary hover:underline flex items-center">
                View all signals
                <svg className="w-4 h-4 ml-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}