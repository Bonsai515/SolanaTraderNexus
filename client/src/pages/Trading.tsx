import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useWsStore from '../lib/wsStore';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function Trading() {
  const [activeTab, setActiveTab] = useState('signals');
  const [selectedPair, setSelectedPair] = useState('SOL/USDC');
  const { 
    connected, 
    signals: wsSignals, 
    transactions: wsTransactions, 
    marketData: wsMarketData,
    sendMessage 
  } = useWsStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get signals from API (fallback if WebSocket isn't working)
  const { data: apiSignals, isLoading: loadingApiSignals } = useQuery({
    queryKey: ['/api/signals'],
    staleTime: 10 * 1000, // 10 seconds
    // Don't fetch if we already have WebSocket data
    enabled: wsSignals.length === 0,
  });
  
  // Get transactions from API (fallback if WebSocket isn't working)
  const { data: apiTransactions, isLoading: loadingApiTransactions } = useQuery({
    queryKey: ['/api/transactions'],
    staleTime: 10 * 1000, // 10 seconds
    // Don't fetch if we already have WebSocket data
    enabled: wsTransactions.length === 0,
  });
  
  // Get market data from API (fallback if WebSocket isn't working)
  const { data: apiMarketData, isLoading: loadingApiMarketData } = useQuery({
    queryKey: ['/api/price-feed/status'],
    staleTime: 10 * 1000, // 10 seconds
    // Don't fetch if we already have WebSocket data
    enabled: wsMarketData.length === 0,
  });

  // Combine WebSocket and API data
  const signals = wsSignals.length > 0 
    ? wsSignals.map(msg => msg.data) 
    : apiSignals || [];
    
  const transactions = wsTransactions.length > 0 
    ? wsTransactions.map(msg => msg.data) 
    : apiTransactions || [];
  
  // Extract market data for the selected pair
  const getPairMarketData = (pair: string) => {
    // First try to get data from WebSocket
    const wsData = wsMarketData.find(msg => 
      msg.data?.pair === pair || 
      (msg.data?.pairs && msg.data.pairs[pair])
    );
    
    if (wsData?.data) {
      return wsData.data.pairs ? wsData.data.pairs[pair] : wsData.data;
    }
    
    // Fall back to API data if available
    if (apiMarketData?.data?.pairData && apiMarketData.data.pairData[pair]) {
      return apiMarketData.data.pairData[pair];
    }
    
    // Return empty data structure if nothing is available
    return {
      price: null,
      volume24h: null,
      priceChange24h: null,
      highPrice24h: null,
      lowPrice24h: null,
      liquidity: null,
      lastUpdated: null,
      priceHistory: []
    };
  };
  
  // Get market data for selected pair
  const selectedPairData = getPairMarketData(selectedPair);
    
  const loadingSignals = wsSignals.length === 0 && loadingApiSignals;
  const loadingTransactions = wsTransactions.length === 0 && loadingApiTransactions;
  const loadingMarketData = wsMarketData.length === 0 && loadingApiMarketData;
  
  // Mutation for executing a trade based on a signal
  const executeSignalMutation = useMutation({
    mutationFn: async (signalId: string) => {
      const response = await apiRequest('POST', '/api/execute-signal', { 
        signalId 
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute trade');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Trade executed successfully',
        description: `Transaction ID: ${data.transaction.id.substring(0, 8)}...`,
        variant: 'success'
      });
      // Invalidate the relevant query keys to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/signals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to execute trade',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Function to execute a signal
  const executeSignal = (signalId: string) => {
    executeSignalMutation.mutate(signalId);
  };

  // Request real-time signals and transactions through WebSocket
  useEffect(() => {
    // Only request data if we're connected to the WebSocket server
    if (connected) {
      // Request initial data on mount or when connection is established
      sendMessage({ type: 'GET_SIGNALS' });
      sendMessage({ type: 'GET_TRANSACTIONS' });
      
      // Get market data for the UI
      sendMessage({ type: 'GET_MARKET_DATA', pairs: ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'] });
      
      // Request agent status information
      sendMessage({ type: 'GET_AGENT_STATUS' });
      
      // Set up interval to refresh market data every 10 seconds
      const intervalId = setInterval(() => {
        sendMessage({ type: 'GET_MARKET_DATA', pairs: ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'] });
      }, 10000);
      
      // Clear interval on unmount
      return () => clearInterval(intervalId);
    }
    
    // Connection status indicator
    const connectionStatus = connected ? 'connected' : 'disconnected';
    console.log(`WebSocket status: ${connectionStatus}`);
    
    // Show toast for connections and disconnections
    if (connected) {
      toast({
        title: 'WebSocket Connected',
        description: 'Real-time updates are now enabled.',
        variant: 'success'
      });
    } else {
      toast({
        title: 'WebSocket Disconnected',
        description: 'Real-time updates unavailable. Using API fallback.',
        variant: 'warning'
      });
    }
  }, [connected, sendMessage, toast]);
  
  // Effect to refresh data when the selected pair changes
  useEffect(() => {
    if (connected && selectedPair) {
      // Request specific market data for the selected pair
      sendMessage({ 
        type: 'GET_DETAILED_MARKET_DATA', 
        pair: selectedPair 
      });
    }
  }, [connected, selectedPair, sendMessage]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Trading</h1>
        <div className="bg-card rounded-lg overflow-hidden flex">
          <button 
            className={`px-4 py-2 ${activeTab === 'signals' ? 'bg-accent' : ''}`}
            onClick={() => setActiveTab('signals')}
          >
            Signals
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'transactions' ? 'bg-accent' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            Transactions
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'market' ? 'bg-accent' : ''}`}
            onClick={() => setActiveTab('market')}
          >
            Market
          </button>
        </div>
      </div>
      
      {/* Signals Tab */}
      {activeTab === 'signals' && (
        <div className="bg-card rounded-lg shadow-md p-6 border border-border">
          <h2 className="text-xl font-semibold mb-4">Trading Signals</h2>
          
          {loadingSignals ? (
            <div className="text-center py-4">Loading signals...</div>
          ) : signals?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-4">Pair</th>
                    <th className="text-left py-2 px-4">Type</th>
                    <th className="text-left py-2 px-4">Strength</th>
                    <th className="text-left py-2 px-4">Price</th>
                    <th className="text-left py-2 px-4">Time</th>
                    <th className="text-left py-2 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map(signal => (
                    <tr key={signal.id} className="border-b border-border hover:bg-accent/20">
                      <td className="py-3 px-4">{signal.pair}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                          signal.type === 'BUY' ? 'bg-success/20 text-success' : 
                          signal.type === 'SELL' ? 'bg-destructive/20 text-destructive' : 
                          'bg-muted text-muted-foreground'
                        }`}>
                          {signal.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">{signal.strength}</td>
                      <td className="py-3 px-4">{signal.price}</td>
                      <td className="py-3 px-4">
                        {new Date(signal.created_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          className="text-sm px-2 py-1 bg-primary text-primary-foreground rounded"
                          onClick={() => executeSignal(signal.id)}
                          disabled={signal.executed}
                        >
                          {signal.executed ? 'Executed' : 'Execute'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">No signals available</div>
          )}
        </div>
      )}
      
      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="bg-card rounded-lg shadow-md p-6 border border-border">
          <h2 className="text-xl font-semibold mb-4">Transactions</h2>
          
          {loadingTransactions ? (
            <div className="text-center py-4">Loading transactions...</div>
          ) : transactions?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-4">ID</th>
                    <th className="text-left py-2 px-4">Type</th>
                    <th className="text-left py-2 px-4">Pair</th>
                    <th className="text-left py-2 px-4">Amount</th>
                    <th className="text-left py-2 px-4">Status</th>
                    <th className="text-left py-2 px-4">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-border hover:bg-accent/20">
                      <td className="py-3 px-4 font-mono text-xs">{tx.id.substring(0, 8)}...</td>
                      <td className="py-3 px-4">{tx.type}</td>
                      <td className="py-3 px-4">{tx.pair}</td>
                      <td className="py-3 px-4">{tx.amount}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                          tx.status === 'CONFIRMED' ? 'bg-success/20 text-success' : 
                          tx.status === 'PENDING' ? 'bg-warning/20 text-warning' : 
                          tx.status === 'FAILED' ? 'bg-destructive/20 text-destructive' : 
                          'bg-muted text-muted-foreground'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {new Date(tx.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">No transactions available</div>
          )}
        </div>
      )}
      
      {/* Market Tab */}
      {activeTab === 'market' && (
        <div className="bg-card rounded-lg shadow-md p-6 border border-border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Market Data</h2>
            
            {/* Pair selector */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Pair:</span>
              <div className="relative">
                <select
                  value={selectedPair}
                  onChange={(e) => setSelectedPair(e.target.value)}
                  className="bg-background border border-input rounded-md px-3 py-1"
                >
                  <option value="SOL/USDC">SOL/USDC</option>
                  <option value="BONK/USDC">BONK/USDC</option>
                  <option value="JUP/USDC">JUP/USDC</option>
                </select>
              </div>
            </div>
          </div>
          
          {loadingMarketData ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>Loading market data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Price card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-background p-4 rounded-lg border border-border">
                  <div className="text-sm text-muted-foreground mb-1">Current Price</div>
                  <div className="text-2xl font-bold">
                    {selectedPairData.price 
                      ? `$${parseFloat(selectedPairData.price).toFixed(4)}` 
                      : 'N/A'}
                  </div>
                  {selectedPairData.priceChange24h && (
                    <div className={`text-sm mt-1 ${
                      parseFloat(selectedPairData.priceChange24h) >= 0 
                        ? 'text-success' 
                        : 'text-destructive'
                    }`}>
                      {parseFloat(selectedPairData.priceChange24h) >= 0 ? '+' : ''}
                      {parseFloat(selectedPairData.priceChange24h).toFixed(2)}%
                    </div>
                  )}
                </div>
                
                <div className="bg-background p-4 rounded-lg border border-border">
                  <div className="text-sm text-muted-foreground mb-1">24h Volume</div>
                  <div className="text-2xl font-bold">
                    {selectedPairData.volume24h 
                      ? `$${parseInt(selectedPairData.volume24h).toLocaleString()}` 
                      : 'N/A'}
                  </div>
                </div>
                
                <div className="bg-background p-4 rounded-lg border border-border">
                  <div className="text-sm text-muted-foreground mb-1">Liquidity</div>
                  <div className="text-2xl font-bold">
                    {selectedPairData.liquidity 
                      ? `$${parseInt(selectedPairData.liquidity).toLocaleString()}` 
                      : 'N/A'}
                  </div>
                </div>
              </div>
              
              {/* Price chart section */}
              <div className="bg-background p-4 rounded-lg border border-border">
                <h3 className="text-lg font-medium mb-4">Price Chart</h3>
                
                {selectedPairData.priceHistory && selectedPairData.priceHistory.length > 0 ? (
                  <div className="h-64 w-full relative">
                    {/* Placeholder for chart - in a real implementation we would use a library like recharts */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-muted-foreground text-sm">
                        Chart visualization will be rendered here with {selectedPairData.priceHistory.length} data points
                      </p>
                    </div>
                    
                    {/* Simple visual representation */}
                    <div className="absolute inset-0 flex items-end">
                      {selectedPairData.priceHistory.map((point: any, index: number) => {
                        const height = point && point.price ? `${Math.max(10, Math.min(90, point.price * 100))}%` : '10%';
                        return (
                          <div 
                            key={index}
                            className="bg-primary/40 flex-1 mx-[1px]"
                            style={{height}}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <p className="text-muted-foreground">No price history available</p>
                  </div>
                )}
              </div>
              
              {/* Order book & Depth chart */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-background p-4 rounded-lg border border-border">
                  <h3 className="text-lg font-medium mb-4">Order Book</h3>
                  
                  {selectedPairData.orderBook ? (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Bids */}
                      <div>
                        <div className="text-success mb-2 text-sm font-medium">Bids</div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {selectedPairData.orderBook.bids && selectedPairData.orderBook.bids.length > 0 ? (
                            selectedPairData.orderBook.bids.map((bid: [number, number], index: number) => (
                              <div key={index} className="grid grid-cols-2 text-xs">
                                <span className="text-success">${bid[0].toFixed(4)}</span>
                                <span>{bid[1].toFixed(2)}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">No bids available</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Asks */}
                      <div>
                        <div className="text-destructive mb-2 text-sm font-medium">Asks</div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {selectedPairData.orderBook.asks && selectedPairData.orderBook.asks.length > 0 ? (
                            selectedPairData.orderBook.asks.map((ask: [number, number], index: number) => (
                              <div key={index} className="grid grid-cols-2 text-xs">
                                <span className="text-destructive">${ask[0].toFixed(4)}</span>
                                <span>{ask[1].toFixed(2)}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">No asks available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center">
                      <p className="text-muted-foreground">No order book data available</p>
                    </div>
                  )}
                </div>
                
                <div className="bg-background p-4 rounded-lg border border-border">
                  <h3 className="text-lg font-medium mb-4">Recent Trades</h3>
                  
                  {selectedPairData.recentTrades && selectedPairData.recentTrades.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full">
                        <thead className="text-xs text-muted-foreground">
                          <tr>
                            <th className="text-left">Price</th>
                            <th className="text-left">Size</th>
                            <th className="text-left">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPairData.recentTrades.map((trade: any, index: number) => (
                            <tr key={index} className="text-xs">
                              <td className={trade.side === 'buy' ? 'text-success' : 'text-destructive'}>
                                ${trade.price.toFixed(4)}
                              </td>
                              <td>{trade.size.toFixed(2)}</td>
                              <td>{new Date(trade.time).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center">
                      <p className="text-muted-foreground">No recent trades available</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Last updated info */}
              <div className="text-xs text-right text-muted-foreground">
                Last updated: {selectedPairData.lastUpdated 
                  ? new Date(selectedPairData.lastUpdated).toLocaleTimeString() 
                  : 'Never'}
                {connected && (
                  <span className="ml-2 inline-flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                    Real-time updates enabled
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}