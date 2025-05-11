import React, { useEffect, useState } from "react";
import { useStore } from "@/lib/wsStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/Toasts";
import { formatDate, cn } from "@/lib/utils";

const WebSocketTest: React.FC = () => {
  const wsStore = useStore();
  const { addToast } = useToast();
  const [selectedPair, setSelectedPair] = useState<string>("SOL/USDC");
  const supportedPairs = ["SOL/USDC", "BONK/USDC", "JUP/USDC"];
  
  // Get connection status
  const connectionStatus = wsStore.connectionStatus;
  const isConnected = wsStore.connected;
  const lastConnected = wsStore.lastConnected;
  
  // Get market data from the store
  const marketData = wsStore.marketData;
  const lastMessage = marketData.length > 0 ? marketData[marketData.length - 1] : null;
  
  useEffect(() => {
    // Show toast when connection status changes
    if (connectionStatus === 'connected') {
      addToast({
        title: "WebSocket Connected",
        description: "Successfully connected to the trading server.",
        variant: "success",
      });
    } else if (connectionStatus === 'error') {
      addToast({
        title: "Connection Error",
        description: "Failed to connect to the trading server. Reconnecting...",
        variant: "destructive",
      });
    } else if (connectionStatus === 'disconnected') {
      addToast({
        title: "WebSocket Disconnected",
        description: "Connection to the trading server was lost.",
        variant: "warning",
      });
    }
  }, [connectionStatus, addToast]);
  
  // Function to request market data for a pair
  const requestMarketData = (pair: string) => {
    wsStore.sendMessage({
      type: "GET_MARKET_DATA",
      pair,
      timestamp: new Date().toISOString(),
    });
    
    addToast({
      title: "Request Sent",
      description: `Requesting market data for ${pair}...`,
      variant: "info",
    });
  };
  
  // Function to ping the server
  const sendPing = () => {
    wsStore.sendMessage({
      type: "PING",
      timestamp: new Date().toISOString(),
    });
    
    addToast({
      title: "Ping Sent",
      description: "Sending ping to server...",
      variant: "default",
    });
  };
  
  // Function to reconnect WebSocket
  const reconnectWebSocket = () => {
    wsStore.reconnect();
    
    addToast({
      title: "Reconnecting",
      description: "Attempting to reconnect to the trading server...",
      variant: "info",
    });
  };

  // Find the most recent market data for the selected pair
  const pairMarketData = marketData
    .filter(msg => msg.data?.pair === selectedPair)
    .slice(-1)[0];
  
  // Get the current price for the selected pair
  const currentPrice = pairMarketData?.data?.price || "N/A";
  
  // Get the 24h volume for the selected pair
  const volume24h = pairMarketData?.data?.volume_24h || "N/A";
  
  // Get the timestamp of the last data update
  const lastUpdateTime = pairMarketData?.timestamp 
    ? formatDate(new Date(pairMarketData.timestamp))
    : "N/A";
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-white">WebSocket Test</h1>
      
      {/* Connection Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span>Status:</span>
              <div 
                className={cn(
                  "px-2 py-1 rounded-md text-xs font-medium",
                  connectionStatus === "connected"
                    ? "bg-green-900 text-green-100"
                    : connectionStatus === "connecting"
                    ? "bg-blue-900 text-blue-100"
                    : connectionStatus === "error"
                    ? "bg-red-900 text-red-100"
                    : "bg-gray-700 text-gray-100"
                )}
              >
                {connectionStatus.toUpperCase()}
              </div>
            </div>
            
            {lastConnected && (
              <div>
                <span>Last Connected: </span>
                <span className="text-gray-300">{formatDate(new Date(lastConnected))}</span>
              </div>
            )}
            
            <div className="flex items-center gap-3 mt-2">
              <Button
                variant="default"
                onClick={reconnectWebSocket}
                disabled={connectionStatus === "connecting"}
              >
                {connectionStatus === "connecting" ? "Connecting..." : "Reconnect"}
              </Button>
              
              <Button
                variant="outline"
                onClick={sendPing}
                disabled={!isConnected}
              >
                Ping Server
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Market Data Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Market Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Trading Pair Selection */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="mr-2">Select Pair:</span>
              {supportedPairs.map(pair => (
                <div
                  key={pair}
                  className={cn(
                    "inline-flex px-2 py-1 rounded-md text-xs font-medium cursor-pointer", 
                    pair === selectedPair 
                      ? "bg-blue-600 hover:bg-blue-700 text-white" 
                      : "bg-gray-700 hover:bg-gray-600 text-white"
                  )}
                  onClick={() => setSelectedPair(pair)}
                >
                  {pair}
                </div>
              ))}
            </div>
            
            {/* Market Data Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-700 rounded-md">
                <div className="text-sm text-gray-400">Current Price</div>
                <div className="text-xl font-bold">{currentPrice}</div>
              </div>
              
              <div className="p-4 bg-gray-700 rounded-md">
                <div className="text-sm text-gray-400">24h Volume</div>
                <div className="text-xl font-bold">{volume24h}</div>
              </div>
              
              <div className="p-4 bg-gray-700 rounded-md">
                <div className="text-sm text-gray-400">Last Update</div>
                <div className="text-xl font-bold">{lastUpdateTime}</div>
              </div>
            </div>
            
            {/* Request Data Button */}
            <Button
              className="mt-4"
              onClick={() => requestMarketData(selectedPair)}
              disabled={!isConnected}
            >
              Request {selectedPair} Data
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Message Log Card */}
      <Card>
        <CardHeader>
          <CardTitle>WebSocket Message Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-60 overflow-y-auto">
            {marketData.length === 0 ? (
              <div className="text-gray-400">No messages received yet.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {[...marketData].reverse().map((msg, index) => (
                  <div key={index} className="text-sm p-2 border border-gray-700 rounded">
                    <div className="flex justify-between">
                      <div className="bg-gray-700 px-2 py-0.5 rounded-md text-xs font-medium text-white">{msg.type}</div>
                      <span className="text-xs text-gray-400">
                        {msg.timestamp ? formatDate(new Date(msg.timestamp)) : 'No timestamp'}
                      </span>
                    </div>
                    <pre className="mt-2 overflow-x-auto text-xs p-2 bg-gray-900 rounded">
                      {JSON.stringify(msg.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-between">
            <Button
              variant="outline"
              onClick={() => wsStore.clearMessages()}
            >
              Clear Message Log
            </Button>
            <span className="text-gray-400">
              Total Messages: {wsStore.messageCount}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebSocketTest;