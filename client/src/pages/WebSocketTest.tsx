import { useEffect, useState, useRef } from 'react';
import useWsStore from '../lib/wsStore';

export default function WebSocketTest() {
  // Use the Zustand WebSocket store 
  const { 
    connected,
    messages: wsMessages,
    signals,
    transactions,
    marketData,
    insights,
    sendMessage,
    reconnect,
    clearMessages
  } = useWsStore();
  
  // Local state for the test page
  const [localMessages, setLocalMessages] = useState<string[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [diagnostics, setDiagnostics] = useState<Record<string, any> | null>(null);
  const diagnosticsIntervalRef = useRef<number | null>(null);
  
  // Previous message count to detect changes
  const prevMessageCountRef = useRef<number>(0);

  // Connection status effect
  useEffect(() => {
    setLocalMessages(prev => [
      ...prev, 
      `WebSocket ${connected ? 'connected' : 'disconnected'} at ${new Date().toLocaleTimeString()}`
    ]);
  }, [connected]);
  
  // WebSocket messages monitoring effect
  useEffect(() => {
    if (wsMessages.length > prevMessageCountRef.current) {
      // We have new messages
      for (let i = prevMessageCountRef.current; i < wsMessages.length; i++) {
        const message = wsMessages[i];
        setLocalMessages(prev => [
          ...prev, 
          `📨 ${message.type}: ${JSON.stringify(message.data || {}).substring(0, 100)}${JSON.stringify(message.data || {}).length > 100 ? '...' : ''}`
        ]);
      }
      // Update the counter reference
      prevMessageCountRef.current = wsMessages.length;
    }
  }, [wsMessages]);
  
  // Diagnostics effect
  useEffect(() => {
    // Set up diagnostics refreshing
    const updateDiagnostics = () => {
      // Create diagnostics info from our Zustand store data
      const diagnosticsInfo = {
        connected,
        socketState: connected ? 'OPEN' : 'CLOSED',
        reconnectAttempts: 0, // This would need to be exposed from the store
        maxReconnectAttempts: 5,
        messageCount: wsMessages.length,
        signalCount: signals.length,
        transactionCount: transactions.length,
        marketDataCount: marketData.length,
        insightCount: insights.length,
        lastMessageTime: wsMessages.length > 0 
          ? new Date(wsMessages[wsMessages.length - 1].timestamp || Date.now()).toLocaleTimeString() 
          : 'Never'
      };
      
      setDiagnostics(diagnosticsInfo);
    };
    
    // Update immediately
    updateDiagnostics();
    
    // Set up interval for updating diagnostics
    diagnosticsIntervalRef.current = window.setInterval(updateDiagnostics, 1000) as unknown as number;

    // Cleanup interval on component unmount
    return () => {
      if (diagnosticsIntervalRef.current) {
        clearInterval(diagnosticsIntervalRef.current);
        diagnosticsIntervalRef.current = null;
      }
    };
  }, [connected, wsMessages.length, signals.length, transactions.length, marketData.length, insights.length]);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    try {
      // Try to send as JSON if it's a valid JSON string
      const parsed = JSON.parse(messageInput);
      sendMessage(parsed);
      
      // Add to local message log
      setLocalMessages(prev => [...prev, `📤 Sent: ${JSON.stringify(parsed).substring(0, 100)}`]);
    } catch (e) {
      // If not valid JSON, wrap as a message object
      sendMessage({
        type: 'TEXT_MESSAGE',
        data: messageInput,
        timestamp: new Date().toISOString()
      });
      
      // Add to local message log
      setLocalMessages(prev => [...prev, `📤 Sent text: ${messageInput}`]);
    }

    setMessageInput('');
  };

  const handleSubscribeToMetrics = () => {
    sendMessage({
      type: 'GET_METRICS'
    });
    
    setLocalMessages(prev => [...prev, '📤 Requested metrics']);
  };

  const handleSubscribeToComponentHealth = () => {
    sendMessage({
      type: 'GET_COMPONENT_HEALTH'
    });
    
    setLocalMessages(prev => [...prev, '📤 Requested component health']);
  };
  
  const handleSubscribeToSystemHealth = () => {
    sendMessage({
      type: 'GET_SYSTEM_HEALTH'
    });
    
    setLocalMessages(prev => [...prev, '📤 Requested system health']);
  };

  const handleResetConnection = () => {
    reconnect();
    setLocalMessages(prev => [...prev, '🔄 Reconnecting WebSocket...']);
  };
  
  // Test WebSocket connection directly
  const testWebSocketConnection = () => {
    try {
      // Detect environment
      const isReplitEnv = window.location.hostname.includes('replit');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;
      
      setLocalMessages(prev => [...prev, `🧪 Testing WebSocket connection to: ${wsUrl}`]);
      setLocalMessages(prev => [...prev, `🌐 Environment: ${isReplitEnv ? 'Replit' : 'Local'}`]);
      console.log(`🧪 Testing direct WebSocket connection to: ${wsUrl}`);
      
      // Create a new WebSocket directly (not using our store)
      const testSocket = new WebSocket(wsUrl);
      
      // Set up listeners for this test connection
      testSocket.onopen = () => {
        console.log(`✅ Test socket connected successfully!`);
        setLocalMessages(prev => [...prev, `✅ Test connection successful to ${wsUrl}`]);
        
        // Send a test message
        const testMessage = {
          type: 'TEST_CONNECTION',
          timestamp: new Date().toISOString(),
          message: 'This is a direct test connection from React'
        };
        
        try {
          testSocket.send(JSON.stringify(testMessage));
          setLocalMessages(prev => [...prev, `📤 Sent test message: ${JSON.stringify(testMessage)}`]);
        } catch (sendError: any) {
          setLocalMessages(prev => [...prev, `❌ Error sending message: ${sendError.message}`]);
        }
        
        // Also send a ping signal request
        setTimeout(() => {
          try {
            const signalRequest = {
              type: 'GET_SIGNALS',
              timestamp: new Date().toISOString()
            };
            testSocket.send(JSON.stringify(signalRequest));
            setLocalMessages(prev => [...prev, `📤 Sent signal request`]);
          } catch (pingError: any) {
            setLocalMessages(prev => [...prev, `❌ Error sending signal request: ${pingError.message}`]);
          }
        }, 1000);
        
        // Close after 5 seconds
        setTimeout(() => {
          try {
            testSocket.close(1000, 'Test completed');
            setLocalMessages(prev => [...prev, `🔒 Test completed and connection closed`]);
          } catch (closeError: any) {
            setLocalMessages(prev => [...prev, `❌ Error closing connection: ${closeError.message}`]);
          }
        }, 5000);
      };
      
      testSocket.onmessage = (event) => {
        console.log(`📨 Test socket received:`, event.data);
        try {
          // Try to parse and format JSON messages
          const parsedData = JSON.parse(event.data);
          setLocalMessages(prev => [...prev, `📨 Received: ${parsedData.type || 'Unknown type'} - ${JSON.stringify(parsedData).substring(0, 100)}${JSON.stringify(parsedData).length > 100 ? '...' : ''}`]);
        } catch (e) {
          setLocalMessages(prev => [...prev, `📨 Received non-JSON: ${event.data.toString().substring(0, 100)}${event.data.toString().length > 100 ? '...' : ''}`]);
        }
      };
      
      testSocket.onerror = (event) => {
        console.error(`❌ Test socket error:`, event);
        setLocalMessages(prev => [...prev, `❌ Test connection error: WebSocket error event`]);
      };
      
      testSocket.onclose = (event) => {
        console.log(`🔒 Test socket closed: ${event.code} ${event.reason}`);
        setLocalMessages(prev => [...prev, `🔒 Test connection closed: ${event.code} ${event.reason || 'No reason provided'}`]);
      };
    } catch (error: any) {
      console.error(`❌ Error creating test WebSocket:`, error);
      setLocalMessages(prev => [...prev, `❌ Error creating test WebSocket: ${error.message}`]);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">WebSocket Test</h2>
      <p className="text-lg text-gray-300">
        Test the WebSocket connection with the server.
      </p>

      {/* Connection Status */}
      <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
        <h3 className="text-xl font-semibold mb-2">Connection Status</h3>
        <div className="flex items-center">
          <span className={`w-3 h-3 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        
        {/* Connection Basic Info */}
        <div className="mt-4 p-3 bg-gray-700 rounded text-xs font-mono">
          <p>URL: {window.location.href}</p>
          <p>WebSocket URL: {`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`}</p>
          <p>Protocol: {window.location.protocol}</p>
          <p>Host: {window.location.host}</p>
          <p>Hostname: {window.location.hostname}</p>
          <p>Origin: {window.location.origin}</p>
          <p>Pathname: {window.location.pathname}</p>
          <p>Replit Environment: {window.location.hostname.includes('replit') ? 'Yes' : 'No'}</p>
          <div className="mt-2 p-2 bg-gray-800 rounded">
            <p className="font-semibold text-amber-400">Connection Troubleshooting:</p>
            <ul className="pl-4 list-disc space-y-1 mt-1">
              <li>Check browser console for connection errors</li>
              <li>Ensure the server is running on port 5000</li>
              <li>Verify WebSocket endpoint is accessible at /ws</li>
              <li>Check if CORS is properly configured for WebSockets</li>
            </ul>
          </div>
        </div>
        
        {/* Detailed Diagnostics */}
        {diagnostics && (
          <div className="mt-4 p-3 bg-gray-700 rounded text-xs font-mono">
            <h4 className="font-semibold mb-2 text-sm">WebSocket Diagnostics</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <p>Connected:</p>
              <p className={diagnostics.connected ? 'text-green-400' : 'text-red-400'}>
                {String(diagnostics.connected)}
              </p>
              
              <p>Socket State:</p>
              <p className={
                diagnostics.socketState === 'OPEN' ? 'text-green-400' : 
                diagnostics.socketState === 'CONNECTING' ? 'text-yellow-400' : 'text-red-400'
              }>
                {diagnostics.socketState}
              </p>
              
              <p>Reconnect Attempts:</p>
              <p>{diagnostics.reconnectAttempts} / {diagnostics.maxReconnectAttempts}</p>
              
              <p>Last Ping:</p>
              <p>{diagnostics.lastPingTime || 'Never'}</p>
              
              <p>Last Pong:</p>
              <p>{diagnostics.lastPongTime || 'Never'}</p>
              
              <p>Ping Latency:</p>
              <p>{diagnostics.pingLatency}</p>
              
              <p>Queued Messages:</p>
              <p>{diagnostics.queuedMessages}</p>
            </div>
          </div>
        )}
        
        <div className="mt-4 flex flex-wrap gap-2">
          <button 
            onClick={handleResetConnection}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Reset Connection
          </button>
          
          <button 
            onClick={() => {
              sendMessage({
                type: 'PING',
                timestamp: new Date().toISOString()
              });
              setLocalMessages(prev => [...prev, "📤 Sent PING message"]);
            }}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-md transition-colors"
            disabled={!connected}
          >
            Send Ping
          </button>
          
          <button 
            onClick={testWebSocketConnection}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
          >
            Test Direct Connection
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
        <h3 className="text-xl font-semibold mb-2">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={handleSubscribeToMetrics}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
            disabled={!connected}
          >
            Subscribe to Metrics
          </button>
          <button 
            onClick={handleSubscribeToComponentHealth}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
            disabled={!connected}
          >
            Subscribe to Component Health
          </button>
          <button 
            onClick={handleSubscribeToSystemHealth}
            className="px-3 py-1 bg-teal-600 hover:bg-teal-700 rounded-md transition-colors"
            disabled={!connected}
          >
            Subscribe to System Health
          </button>
        </div>
      </div>

      {/* Custom Message */}
      <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
        <h3 className="text-xl font-semibold mb-2">Send Custom Message</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Enter message or JSON"
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!connected}
          />
          <button 
            onClick={handleSendMessage}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            disabled={!connected || !messageInput.trim()}
          >
            Send
          </button>
        </div>
      </div>

      {/* WebSocket Store Data */}
      <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
        <h3 className="text-xl font-semibold mb-2">WebSocket Store Data</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-blue-400 mb-1">Signals ({signals.length})</h4>
            <div className="max-h-40 overflow-y-auto bg-gray-900 p-2 rounded">
              {signals.length === 0 ? (
                <p className="text-gray-500 text-xs">No signals received yet.</p>
              ) : (
                <ul className="space-y-1">
                  {signals.map((signal, index) => (
                    <li key={index} className="text-xs">
                      <span className="text-green-400">{signal.data?.type || 'unknown'}</span>: {signal.data?.pair || 'n/a'} 
                      {signal.data?.price ? ` @ $${signal.data.price}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-purple-400 mb-1">Transactions ({transactions.length})</h4>
            <div className="max-h-40 overflow-y-auto bg-gray-900 p-2 rounded">
              {transactions.length === 0 ? (
                <p className="text-gray-500 text-xs">No transactions received yet.</p>
              ) : (
                <ul className="space-y-1">
                  {transactions.map((tx, index) => (
                    <li key={index} className="text-xs">
                      <span className={tx.data?.status === 'CONFIRMED' ? 'text-green-400' : 
                                       tx.data?.status === 'PENDING' ? 'text-yellow-400' : 'text-red-400'}>
                        {tx.data?.status || 'unknown'}
                      </span>: {tx.data?.pair || 'n/a'} 
                      {tx.data?.amount ? ` (${tx.data.amount})` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-amber-400 mb-1">Market Data ({marketData.length})</h4>
            <div className="max-h-40 overflow-y-auto bg-gray-900 p-2 rounded">
              {marketData.length === 0 ? (
                <p className="text-gray-500 text-xs">No market data received yet.</p>
              ) : (
                <ul className="space-y-1">
                  {marketData.map((data, index) => (
                    <li key={index} className="text-xs">
                      {data.type}: {Object.keys(data.data || {}).length} data points
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-indigo-400 mb-1">AI Insights ({insights.length})</h4>
            <div className="max-h-40 overflow-y-auto bg-gray-900 p-2 rounded">
              {insights.length === 0 ? (
                <p className="text-gray-500 text-xs">No insights received yet.</p>
              ) : (
                <ul className="space-y-1">
                  {insights.map((insight, index) => (
                    <li key={index} className="text-xs">
                      {insight.type}: {insight.data?.summary || 'No summary'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button 
            onClick={clearMessages}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            Clear All Data
          </button>
        </div>
      </div>
      
      {/* Messages Log */}
      <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
        <h3 className="text-xl font-semibold mb-2">Message Log</h3>
        <div className="max-h-96 overflow-y-auto">
          {localMessages.length === 0 ? (
            <p className="text-gray-500">No messages in log yet.</p>
          ) : (
            <ul className="space-y-2">
              {localMessages.map((msg, index) => (
                <li key={index} className="p-2 bg-gray-700 rounded">
                  <pre className="whitespace-pre-wrap text-xs">{msg}</pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}