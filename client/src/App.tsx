import { Route, Link } from 'wouter';
import NotFound from './pages/not-found';
import SystemDashboard from './pages/SystemDashboard';
import WebSocketTest from './pages/WebSocketTest';
import Trading from './pages/Trading';
import { useEffect, useState } from 'react';
import Toasts from './components/ui/Toasts';

// Simple Dashboard Component
function Dashboard() {
  const [marketData, setMarketData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch market data from the API
  const fetchMarketData = async () => {
    try {
      setLoading(true);
      // Get the base URL from the current location
      const baseUrl = window.location.origin;
      console.log('Fetching market data from:', `${baseUrl}/api/price-feed/status`);
      
      const response = await fetch(`${baseUrl}/api/price-feed/status`);
      if (!response.ok) {
        throw new Error(`Error fetching market data: ${response.status}`);
      }
      const data = await response.json();
      console.log('Market data received:', data);
      setMarketData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError('Failed to load market data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Populate test data
  const populateTestData = async () => {
    try {
      setLoading(true);
      const baseUrl = window.location.origin;
      console.log('Populating test data from:', `${baseUrl}/api/test/populate-price-feed`);
      
      const response = await fetch(`${baseUrl}/api/test/populate-price-feed`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Error populating test data: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Test data populated:', result);
      alert(`Price feed populated with test data: ${result.pairs.join(', ')}`);
      
      // Refresh the market data
      fetchMarketData();
    } catch (err) {
      console.error('Error populating test data:', err);
      setError('Failed to populate test data.');
    } finally {
      setLoading(false);
    }
  };

  // Analyze a trading pair
  const analyzeTradingPair = async (pair: string) => {
    try {
      setLoading(true);
      const baseUrl = window.location.origin;
      console.log('Analyzing trading pair from:', `${baseUrl}/api/ai/market-pattern`);
      
      const response = await fetch(`${baseUrl}/api/ai/market-pattern`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pair })
      });
      
      if (!response.ok) {
        throw new Error(`Error analyzing ${pair}: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Analysis result:', result);
      alert(`Analysis for ${pair}:\n${result.insights?.summary || 'No insights available'}`);
    } catch (err) {
      console.error(`Error analyzing ${pair}:`, err);
      alert(`Failed to analyze ${pair}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount and set up interval
  useEffect(() => {
    fetchMarketData();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchMarketData, 10000);
    
    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Solana Quantum Trading Platform</h2>
      <p className="text-lg text-gray-300">
        Welcome to the advanced quantum-inspired trading platform for Solana blockchain.
      </p>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Market Data Status Card */}
        <div className="p-6 rounded-lg bg-gray-800 border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">Market Data Status</h3>
          {loading && !marketData ? (
            <div className="animate-pulse">Loading market data...</div>
          ) : error ? (
            <div className="text-red-400">{error}</div>
          ) : marketData ? (
            <div>
              <p>Data Source: {marketData.data?.status?.activeDataSource || 'N/A'}</p>
              <p>Available Pairs: {marketData.data?.status?.availablePairs?.length || 0}</p>
              <ul className="mt-2 space-y-1">
                {marketData.data?.status?.availablePairs?.map((pair: string) => (
                  <li key={pair} className="text-blue-400">{pair}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div>No market data available</div>
          )}
        </div>

        {/* AI Analysis Card */}
        <div className="p-6 rounded-lg bg-gray-800 border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">AI-Enhanced Analysis</h3>
          <p>
            Our platform leverages quantum-inspired algorithms and advanced AI to analyze trading patterns and execute strategies.
          </p>
          <button
            onClick={populateTestData}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Populate Test Data'}
          </button>
        </div>

        {/* Trading Pairs Card */}
        <div className="p-6 rounded-lg bg-gray-800 border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">Supported Trading Pairs</h3>
          <ul className="space-y-1">
            <li className="flex items-center"><span className="w-3 h-3 bg-green-400 rounded-full mr-2"></span> SOL/USDC</li>
            <li className="flex items-center"><span className="w-3 h-3 bg-blue-400 rounded-full mr-2"></span> BONK/USDC</li>
            <li className="flex items-center"><span className="w-3 h-3 bg-purple-400 rounded-full mr-2"></span> JUP/USDC</li>
            <li className="flex items-center"><span className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></span> MEME/USDC</li>
          </ul>
        </div>
      </div>

      {/* AI Market Analysis Section */}
      <div className="mt-8 p-6 rounded-lg bg-gray-800 border border-gray-700">
        <h3 className="text-xl font-semibold mb-4">AI Market Pattern Analysis</h3>
        <p className="mb-4">
          Request AI-powered analysis for any of the available trading pairs to get market insights.
        </p>
        
        <div className="flex gap-4 flex-wrap">
          {['SOL/USDC', 'BONK/USDC', 'JUP/USDC'].map(pair => (
            <button
              key={pair}
              onClick={() => analyzeTradingPair(pair)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
              disabled={loading}
            >
              {loading ? 'Analyzing...' : `Analyze ${pair}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-800 py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-blue-400">Solana Quantum Trading</h1>
          </div>
          <nav>
            <ul className="flex space-x-6">
              <li><Link href="/" className="hover:text-blue-400 transition-colors">Dashboard</Link></li>
              <li><Link href="/trading" className="hover:text-blue-400 transition-colors">Trading</Link></li>
              <li><Link href="/insights" className="hover:text-blue-400 transition-colors">AI Insights</Link></li>
              <li><Link href="/system" className="hover:text-blue-400 transition-colors">System Dashboard</Link></li>
              <li><Link href="/ws-test" className="hover:text-blue-400 transition-colors">WebSocket Test</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Route path="/" component={Dashboard} />
        <Route path="/trading" component={Trading} />
        <Route path="/insights" component={Dashboard} />
        <Route path="/system" component={SystemDashboard} />
        <Route path="/ws-test" component={WebSocketTest} />
        <Route path="/:rest*" component={NotFound} />
      </main>
      
      {/* Global toast notifications */}
      <Toasts />
    </div>
  );
}

export default App;