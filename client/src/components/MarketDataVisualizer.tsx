import React, { useState, useEffect, useRef } from 'react';
import { wsClient } from '@/lib/wsClient';

// Market Data Types
type PricePoint = [string, number]; // [timestamp, price]
type VolumePoint = [string, number]; // [timestamp, volume]
type OrderBookPoint = [number, number]; // [price, amount]

interface MarketData {
  pair: string;
  prices: PricePoint[];
  volumes: VolumePoint[];
  orderBooks?: {
    asks: OrderBookPoint[];
    bids: OrderBookPoint[];
  }[];
  indicators?: Record<string, PricePoint[]>;
  currentPrice?: number;
  priceChange24h?: number;
  volume24h?: number;
  lastUpdated?: string;
}

interface TokenMetrics {
  price: number;
  change24h: number;
  volume24h: number;
  high24h?: number;
  low24h?: number;
  marketCap?: number;
  lastUpdated: string;
}

interface TokenData {
  [pair: string]: TokenMetrics;
}

// Helper to format numbers
const formatNumber = (num: number, decimals: number = 2): string => {
  if (num === null || num === undefined) return '--';
  
  // Handle very small numbers for tokens like BONK
  if (Math.abs(num) < 0.0001) {
    return num.toExponential(decimals);
  }
  
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Helper to format currency numbers
const formatCurrency = (num: number, decimals: number = 2): string => {
  if (num === null || num === undefined) return '$--';
  
  // Handle very small numbers for tokens like BONK
  if (Math.abs(num) < 0.0001) {
    return '$' + num.toExponential(decimals);
  }
  
  return '$' + num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Main component
const MarketDataVisualizer: React.FC = () => {
  const [tokenData, setTokenData] = useState<TokenData>({});
  const [selectedPair, setSelectedPair] = useState<string>('SOL/USDC');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('Never');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Effect to handle WebSocket connection and message processing
  useEffect(() => {
    // Subscribe to connection status changes
    const unsubConnection = wsClient.onConnectionChange(connected => {
      setIsConnected(connected);
      
      if (connected) {
        // Request market data once connected
        wsClient.send({
          type: 'GET_MARKET_DATA',
          pairs: ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'],
          timestamp: new Date().toISOString()
        });
        
        console.log('Requested market data via WebSocket');
      }
    });
    
    // Subscribe to message events
    const unsubMessages = wsClient.onMessage(messageStr => {
      try {
        const message = JSON.parse(messageStr);
        
        // Handle market data messages
        if (message.type === 'MARKET_DATA' && message.data) {
          handleMarketDataUpdate(message.data);
          setLastUpdateTime(new Date().toLocaleTimeString());
        }
        
        // Handle price update messages
        if (message.type === 'PRICE_UPDATE' && message.data) {
          handlePriceUpdate(message.data);
          setLastUpdateTime(new Date().toLocaleTimeString());
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    // Cleanup function
    return () => {
      unsubConnection();
      unsubMessages();
    };
  }, []);
  
  // Handle market data update
  const handleMarketDataUpdate = (data: any) => {
    if (data.pairs) {
      // Handle multiple pairs data
      const newTokenData = { ...tokenData };
      
      Object.entries(data.pairs).forEach(([pair, pairData]: [string, any]) => {
        if (!pairData) return;
        
        const lastPrice = pairData.prices?.length > 0 
          ? pairData.prices[pairData.prices.length - 1][1] 
          : pairData.currentPrice || 0;
          
        const lastVolume = pairData.volumes?.length > 0
          ? pairData.volumes[pairData.volumes.length - 1][1]
          : pairData.volume24h || 0;
          
        newTokenData[pair] = {
          price: lastPrice,
          change24h: pairData.priceChange24h || 0,
          volume24h: lastVolume,
          high24h: pairData.high24h,
          low24h: pairData.low24h,
          marketCap: pairData.marketCap,
          lastUpdated: new Date().toISOString()
        };
      });
      
      setTokenData(newTokenData);
    } else if (data.pair) {
      // Handle single pair data
      const pair = data.pair;
      const lastPrice = data.prices?.length > 0 
        ? data.prices[data.prices.length - 1][1] 
        : data.currentPrice || 0;
        
      const lastVolume = data.volumes?.length > 0
        ? data.volumes[data.volumes.length - 1][1]
        : data.volume24h || 0;
        
      setTokenData(prev => ({
        ...prev,
        [pair]: {
          price: lastPrice,
          change24h: data.priceChange24h || 0,
          volume24h: lastVolume,
          high24h: data.high24h,
          low24h: data.low24h,
          marketCap: data.marketCap,
          lastUpdated: new Date().toISOString()
        }
      }));
    }
  };
  
  // Handle price update
  const handlePriceUpdate = (data: any) => {
    if (!data.pair || data.price === undefined) return;
    
    setTokenData(prev => {
      const existing = prev[data.pair] || {
        price: 0,
        change24h: 0,
        volume24h: 0,
        lastUpdated: new Date().toISOString()
      };
      
      return {
        ...prev,
        [data.pair]: {
          ...existing,
          price: data.price,
          volume24h: data.volume || existing.volume24h,
          lastUpdated: new Date().toISOString()
        }
      };
    });
  };
  
  // Request current market data for a specific pair
  const requestPairData = (pair: string) => {
    if (isConnected) {
      wsClient.send({
        type: 'GET_MARKET_DATA',
        pair,
        timestamp: new Date().toISOString()
      });
      
      console.log(`Requested market data for ${pair}`);
    }
  };
  
  // Effect to request selected pair data when it changes
  useEffect(() => {
    if (selectedPair) {
      requestPairData(selectedPair);
    }
  }, [selectedPair]);
  
  // Determine change color
  const getChangeColor = (change: number): string => {
    if (change > 0) return 'text-green-500';
    if (change < 0) return 'text-red-500';
    return 'text-gray-500';
  };
  
  // Format change with arrow
  const formatChange = (change: number): string => {
    const prefix = change > 0 ? '↑ ' : change < 0 ? '↓ ' : '';
    return `${prefix}${Math.abs(change).toFixed(2)}%`;
  };
  
  return (
    <div className="bg-slate-900 rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Market Data Visualizer</h2>
        <div className="flex items-center space-x-2">
          <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="text-sm text-gray-300">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Object.entries(tokenData).map(([pair, data]) => (
          <div 
            key={pair}
            className={`bg-slate-800 p-4 rounded-lg cursor-pointer transition-all
              ${selectedPair === pair ? 'ring-2 ring-blue-500' : 'hover:bg-slate-700'}`}
            onClick={() => setSelectedPair(pair)}
          >
            <div className="flex justify-between items-center">
              <span className="font-medium text-white">{pair}</span>
              <span className={`text-xs px-2 py-1 rounded ${
                pair.includes('SOL') ? 'bg-purple-900 text-purple-200' :
                pair.includes('BONK') ? 'bg-yellow-900 text-yellow-200' :
                'bg-blue-900 text-blue-200'
              }`}>
                {pair.split('/')[0]}
              </span>
            </div>
            
            <div className="mt-2">
              <div className="text-2xl font-bold text-white">
                {pair.includes('BONK') 
                  ? formatCurrency(data.price, 8)
                  : formatCurrency(data.price, 2)
                }
              </div>
              <div className={`text-sm ${getChangeColor(data.change24h)}`}>
                {formatChange(data.change24h)}
              </div>
            </div>
            
            <div className="mt-2 text-xs text-gray-400">
              Volume: {formatCurrency(data.volume24h, 0)}
            </div>
          </div>
        ))}
      </div>
      
      {selectedPair && tokenData[selectedPair] && (
        <div className="bg-slate-800 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-white">{selectedPair} Details</h3>
            <button
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => requestPairData(selectedPair)}
            >
              Refresh
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-700 p-3 rounded">
              <div className="text-xs text-gray-400">Current Price</div>
              <div className="text-lg font-semibold text-white">
                {selectedPair.includes('BONK') 
                  ? formatCurrency(tokenData[selectedPair].price, 8)
                  : formatCurrency(tokenData[selectedPair].price, 4)
                }
              </div>
            </div>
            
            <div className="bg-slate-700 p-3 rounded">
              <div className="text-xs text-gray-400">24h Change</div>
              <div className={`text-lg font-semibold ${getChangeColor(tokenData[selectedPair].change24h)}`}>
                {formatChange(tokenData[selectedPair].change24h)}
              </div>
            </div>
            
            <div className="bg-slate-700 p-3 rounded">
              <div className="text-xs text-gray-400">24h Volume</div>
              <div className="text-lg font-semibold text-white">
                {formatCurrency(tokenData[selectedPair].volume24h, 0)}
              </div>
            </div>
            
            <div className="bg-slate-700 p-3 rounded">
              <div className="text-xs text-gray-400">Last Updated</div>
              <div className="text-sm font-semibold text-white">
                {new Date(tokenData[selectedPair].lastUpdated).toLocaleTimeString()}
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-slate-700 rounded-lg" style={{ height: '300px' }} ref={chartContainerRef}>
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-400">
                Advanced chart visualization will be implemented here
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="mt-4 text-xs text-gray-500 flex justify-between items-center">
        <span>Last data update: {lastUpdateTime}</span>
        <span>Data source: Instant Nodes RPC</span>
      </div>
    </div>
  );
};

export default MarketDataVisualizer;