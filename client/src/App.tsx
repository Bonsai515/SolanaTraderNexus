import { Route, Link } from 'wouter';
import NotFound from './pages/not-found';
import { useEffect, useState } from 'react';

// Temporary component for testing
function WelcomePage() {
  const [marketData, setMarketData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCachedData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/price-feed/status');
      const data = await response.json();
      setMarketData(data);
    } catch (err) {
      setError('Failed to fetch market data');
      console.error('Error fetching market data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCachedData();
    // Set up polling interval
    const interval = setInterval(fetchCachedData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Solana Quantum Trading Platform</h2>
      <p className="text-lg text-gray-300">
        Welcome to the advanced quantum-inspired trading platform for Solana blockchain.
      </p>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="p-6 rounded-lg bg-gray-800 border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">Market Data Status</h3>
          {loading ? (
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

        <div className="p-6 rounded-lg bg-gray-800 border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">AI-Enhanced Analysis</h3>
          <p>
            Our platform leverages quantum-inspired algorithms and advanced AI to analyze trading patterns and execute strategies.
          </p>
          <button
            onClick={() => {
              fetch('/api/test/populate-price-feed', {
                method: 'POST'
              })
                .then(res => res.json())
                .then(data => {
                  alert('Price feed populated with test data: ' + data.pairs.join(', '));
                  fetchCachedData();
                })
                .catch(err => {
                  console.error('Error populating price feed:', err);
                  alert('Failed to populate price feed');
                });
            }}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Populate Test Data
          </button>
        </div>

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

      <div className="mt-8 p-6 rounded-lg bg-gray-800 border border-gray-700">
        <h3 className="text-xl font-semibold mb-4">AI Market Pattern Analysis</h3>
        <p className="mb-4">
          Request AI-powered analysis for any of the available trading pairs to get market insights.
        </p>
        
        <div className="flex gap-4 flex-wrap">
          {['SOL/USDC', 'BONK/USDC', 'JUP/USDC'].map(pair => (
            <button
              key={pair}
              onClick={() => {
                setLoading(true);
                fetch('/api/ai/market-pattern', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ pair })
                })
                  .then(res => res.json())
                  .then(data => {
                    alert(`Analysis for ${pair}:\n${data.insights?.summary || 'No insights available'}`);
                    setLoading(false);
                  })
                  .catch(err => {
                    console.error(`Error analyzing ${pair}:`, err);
                    alert(`Failed to analyze ${pair}`);
                    setLoading(false);
                  });
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
              disabled={loading}
            >
              Analyze {pair}
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
              <li><Link href="/" className="hover:text-blue-400 transition-colors">Home</Link></li>
              <li><Link href="/ai-insights" className="hover:text-blue-400 transition-colors">AI Insights</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Route path="/" component={WelcomePage} />
        <Route path="/ai-insights" component={WelcomePage} />
        <Route path="/:rest*" component={NotFound} />
      </main>
    </div>
  );
}

export default App;