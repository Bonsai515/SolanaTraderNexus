import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useWsStore from '../lib/wsStore';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function Trading() {
  const [activeTab, setActiveTab] = useState('trade');
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
  
  // List of supported trading pairs
  const supportedPairs = ['SOL/USDC', 'BONK/USDC', 'JUP/USDC', 'RAY/USDC', 'MSOL/USDC'];
  
  // List of supported DEXs
  const supportedDexes = [
    {id: "jupiter", name: "Jupiter (Aggregator)"},
    {id: "raydium", name: "Raydium"},
    {id: "openbook", name: "OpenBook"},
    {id: "orca", name: "Orca"},
    {id: "meteora", name: "Meteora"},
    {id: "mango", name: "Mango Markets"},
    {id: "marina", name: "Marina"},
    {id: "drift", name: "Drift"},
    {id: "jupiter_perps", name: "Jupiter Perpetuals"},
    {id: "pump_fun", name: "PumpFun"}
  ];
  
  // State for trade form
  const [amount, setAmount] = useState<string>("");
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [price, setPrice] = useState<string>("");
  const [dex, setDex] = useState<string>("jupiter");
  const [slippage, setSlippage] = useState<string>("0.5");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  
  // Mutation for executing a trade
  const executeTradeMutation = useMutation({
    mutationFn: async (tradeData: {
      pair: string;
      amount: string;
      type: 'BUY' | 'SELL';
      walletAddress: string;
      price?: string;
      dex: string;
      slippage: string;
    }) => {
      const response = await apiRequest('POST', '/api/trade/execute', tradeData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute trade');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Trade executed successfully',
        description: `${tradeType} order for ${amount} ${selectedPair} submitted`,
        variant: 'success'
      });
      
      // Reset form fields
      setAmount("");
      setPrice("");
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Trade execution failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  // Mutation for connecting a wallet
  const connectWalletMutation = useMutation({
    mutationFn: async (walletData: { walletAddress: string; walletType?: string }) => {
      const response = await apiRequest('POST', '/api/trade/wallet/connect', walletData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to connect wallet');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setWalletConnected(true);
      toast({
        title: 'Wallet connected',
        description: `Wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} connected successfully`,
        variant: 'success'
      });
      
      // Refresh transactions for this wallet
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Wallet connection failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  // Submit a trade
  const handleTradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !walletAddress || !walletConnected) {
      toast({
        title: 'Validation error',
        description: !walletConnected ? 'Please connect your wallet first' : 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }
    
    executeTradeMutation.mutate({
      pair: selectedPair,
      amount,
      type: tradeType,
      walletAddress,
      price: price || undefined,
      dex,
      slippage
    });
  };
  
  // Connect wallet
  const handleConnectWallet = () => {
    if (!walletAddress) {
      toast({
        title: 'Validation error',
        description: 'Please enter a wallet address',
        variant: 'destructive'
      });
      return;
    }
    
    connectWalletMutation.mutate({
      walletAddress,
      walletType: 'phantom'
    });
  };
  
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
            className={`px-4 py-2 ${activeTab === 'trade' ? 'bg-accent' : ''}`}
            onClick={() => setActiveTab('trade')}
          >
            Trade
          </button>
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
      
      {/* Trade Tab */}
      {activeTab === 'trade' && (
        <div className="bg-card rounded-lg shadow-md p-6 border border-border">
          <h2 className="text-xl font-semibold mb-4">Live Trading</h2>
          
          <form onSubmit={handleTradeSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Pair Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Trading Pair</label>
                <select
                  className="w-full p-2 rounded-md border border-input bg-background"
                  value={selectedPair}
                  onChange={(e) => setSelectedPair(e.target.value)}
                  disabled={executeTradeMutation.isPending || !walletConnected}
                >
                  {supportedPairs.map(pair => (
                    <option key={pair} value={pair}>{pair}</option>
                  ))}
                </select>
              </div>
              
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium mb-2">Amount</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {selectedPair.split('/')[0]}
                  </div>
                  <input 
                    type="number" 
                    className="w-full p-2 pl-16 rounded-md border border-input bg-background"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={executeTradeMutation.isPending || !walletConnected}
                    min="0"
                    step="0.000001"
                  />
                  {walletConnected && (
                    <div className="mt-1 flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Balance: Loading...
                      </span>
                      <button 
                        type="button" 
                        className="text-xs text-primary hover:text-primary/80"
                        onClick={() => setAmount('0.5')} // Example max value
                        disabled={executeTradeMutation.isPending}
                      >
                        MAX
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Trade Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Trade Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`p-2 rounded-md ${tradeType === 'BUY' 
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    } font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                    onClick={() => setTradeType('BUY')}
                    disabled={executeTradeMutation.isPending || !walletConnected}
                  >
                    <span className="flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      Buy
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`p-2 rounded-md ${tradeType === 'SELL' 
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    } font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                    onClick={() => setTradeType('SELL')}
                    disabled={executeTradeMutation.isPending || !walletConnected}
                  >
                    <span className="flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Sell
                    </span>
                  </button>
                </div>
              </div>
              
              {/* Price */}
              <div>
                <label className="block text-sm font-medium mb-2">Price (Optional)</label>
                <input 
                  type="number" 
                  className="w-full p-2 rounded-md border border-input bg-background"
                  placeholder="Leave empty for market price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={executeTradeMutation.isPending || !walletConnected}
                  min="0"
                  step="0.000001"
                />
                {selectedPairData.price && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Current Price: ${parseFloat(selectedPairData.price).toFixed(4)}
                  </p>
                )}
              </div>
              
              {/* DEX Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">DEX</label>
                <select
                  className="w-full p-2 rounded-md border border-input bg-background"
                  value={dex}
                  onChange={(e) => setDex(e.target.value)}
                  disabled={executeTradeMutation.isPending || !walletConnected}
                >
                  {supportedDexes.map(dexOption => (
                    <option key={dexOption.id} value={dexOption.id}>{dexOption.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Slippage */}
              <div>
                <label className="block text-sm font-medium mb-2">Slippage (%)</label>
                <input 
                  type="number" 
                  className="w-full p-2 rounded-md border border-input bg-background"
                  placeholder="Maximum slippage"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  disabled={executeTradeMutation.isPending || !walletConnected}
                  min="0"
                  max="5"
                  step="0.1"
                />
              </div>
            </div>
            
            {/* Wallet Connection */}
            <div className="mb-6 p-4 rounded-md bg-muted">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">Wallet Address</label>
                  <input 
                    type="text" 
                    className="w-full p-2 rounded-md border border-input bg-background"
                    placeholder="Enter your Solana wallet address"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    disabled={connectWalletMutation.isPending || walletConnected}
                  />
                </div>
                <button
                  type="button"
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md ${
                    walletConnected 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  } text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  onClick={handleConnectWallet}
                  disabled={connectWalletMutation.isPending || walletConnected || !walletAddress}
                >
                  {walletConnected ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{`Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}</span>
                    </>
                  ) : connectWalletMutation.isPending ? (
                    <>
                      <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span>
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1.268a2 2 0 01-1.414-.586l-.793-.792A2 2 0 0011.536 2H8.464a2 2 0 00-1.414.586l-.793.792A2 2 0 015.268 4H4z" clipRule="evenodd" />
                      </svg>
                      <span>Connect Wallet</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Execute Button */}
            <button
              type="submit"
              className={`w-full p-3 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${
                tradeType === 'BUY' 
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              disabled={executeTradeMutation.isPending || !walletConnected || !amount}
            >
              {executeTradeMutation.isPending ? (
                <>
                  <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span>
                  <span>Executing Trade...</span>
                </>
              ) : (
                <>
                  {tradeType === 'BUY' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>{`Execute ${tradeType} for ${amount || '0'} ${selectedPair}`}</span>
                </>
              )}
            </button>
          </form>
          
          {/* Market Overview */}
          {selectedPairData && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Market Overview - {selectedPair}</h3>
                <div className="text-xs bg-muted px-2 py-1 rounded-md">
                  <span className="mr-1">•</span>
                  <span className="text-muted-foreground">
                    Last updated: {selectedPairData.lastUpdated ? new Date(selectedPairData.lastUpdated).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Price Card */}
                <div className="p-4 rounded-md bg-background border border-border shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-muted-foreground">Current Price</div>
                  </div>
                  <div className="text-2xl font-bold">
                    {selectedPairData.price ? `$${parseFloat(selectedPairData.price).toFixed(4)}` : 'N/A'}
                  </div>
                  {selectedPairData.highPrice24h && selectedPairData.lowPrice24h && (
                    <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                      <span>Low: ${parseFloat(selectedPairData.lowPrice24h).toFixed(4)}</span>
                      <span>High: ${parseFloat(selectedPairData.highPrice24h).toFixed(4)}</span>
                    </div>
                  )}
                </div>
                
                {/* 24h Change Card */}
                <div className="p-4 rounded-md bg-background border border-border shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    {selectedPairData.priceChange24h && parseFloat(selectedPairData.priceChange24h) >= 0 ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586l3.293-3.293A1 1 0 0112 7z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586l-4.293-4.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414l3.293 3.293A1 1 0 0012 13z" clipRule="evenodd" />
                      </svg>
                    )}
                    <div className="text-sm text-muted-foreground">24h Change</div>
                  </div>
                  <div className={`text-2xl font-bold ${
                    selectedPairData.priceChange24h && parseFloat(selectedPairData.priceChange24h) >= 0 
                      ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {selectedPairData.priceChange24h 
                      ? `${parseFloat(selectedPairData.priceChange24h) >= 0 ? '+' : ''}${parseFloat(selectedPairData.priceChange24h).toFixed(2)}%` 
                      : 'N/A'}
                  </div>
                  <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                    {selectedPairData.priceChange24h && (
                      <div 
                        className={`h-full ${parseFloat(selectedPairData.priceChange24h) >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(Math.abs(parseFloat(selectedPairData.priceChange24h) || 0), 100)}%` }}
                      />
                    )}
                  </div>
                </div>
                
                {/* 24h Volume Card */}
                <div className="p-4 rounded-md bg-background border border-border shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    <div className="text-sm text-muted-foreground">24h Volume</div>
                  </div>
                  <div className="text-2xl font-bold">
                    {selectedPairData.volume24h 
                      ? `$${Number(selectedPairData.volume24h).toLocaleString()}` 
                      : 'N/A'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {selectedPairData.volume24h && selectedPairData.price
                      ? `${Number(Number(selectedPairData.volume24h) / Number(selectedPairData.price)).toLocaleString()} ${selectedPair.split('/')[0]} traded`
                      : ''
                    }
                  </div>
                </div>
                
                {/* Liquidity Card */}
                <div className="p-4 rounded-md bg-background border border-border shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-teal-500" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <div className="text-sm text-muted-foreground">Liquidity</div>
                  </div>
                  <div className="text-2xl font-bold">
                    {selectedPairData.liquidity 
                      ? `$${Number(selectedPairData.liquidity).toLocaleString()}` 
                      : 'N/A'}
                  </div>
                  <div className="flex justify-between mt-1">
                    <div className="text-xs text-muted-foreground">
                      {selectedPair.split('/')[0]}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedPair.split('/')[1]}
                    </div>
                  </div>
                  <div className="h-1 w-full bg-muted rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal-500 to-blue-500" style={{ width: '50%' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
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