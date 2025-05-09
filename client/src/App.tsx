import { Route } from 'wouter';
import Dashboard from './pages/Dashboard';
import Trading from './pages/Trading';
import Strategies from './pages/Strategies';
import AIAgents from './pages/AIAgents';
import Wallet from './pages/Wallet';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import NotFound from './pages/not-found';
import { useEffect, useState } from 'react';
import { useWsContext, WebSocketProvider } from './lib/wsClient';
import { useSolanaStore } from './lib/solanaUtils';
import { AgentProvider, useAgentWebSocketHandlers } from './lib/agentClient';

// AgentInitializer component for handling agent initialization
function AgentInitializer() {
  const { initialize } = useAgentWebSocketHandlers();
  
  useEffect(() => {
    // Initialize agent websocket handlers when component mounts
    if (initialize) {
      initialize();
    }
  }, [initialize]);
  
  return null;
}

function AppContent() {
  const [isConnected, setIsConnected] = useState(false);
  const { connectionState } = useWsContext();
  const solanaStore = useSolanaStore();
  
  // Initialize Solana connection
  useEffect(() => {
    solanaStore.connect();
  }, []);
  
  // Monitor WebSocket connection
  useEffect(() => {
    setIsConnected(connectionState.connected);
  }, [connectionState.connected]);
  
  return (
    <div className="app min-h-screen bg-gradient-subtle">
      <header className="border-b border-border py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold gradient-text">Solana Quantum Trading</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-success' : 'bg-destructive'}`}></div>
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Route path="/" component={Dashboard} />
        <Route path="/trading" component={Trading} />
        <Route path="/strategies" component={Strategies} />
        <Route path="/ai-agents" component={AIAgents} />
        <Route path="/wallet" component={Wallet} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/settings" component={Settings} />
        <Route path="/:rest*" component={NotFound} />
      </div>
    </div>
  );
}

function App() {
  return (
    <WebSocketProvider>
      <AgentProvider>
        <AgentInitializer />
        <AppContent />
      </AgentProvider>
    </WebSocketProvider>
  );
}

export default App;