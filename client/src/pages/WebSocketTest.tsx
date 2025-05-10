import { useEffect, useState, useRef } from 'react';
import { wsClient } from '../lib/wsClient';

export default function WebSocketTest() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const diagnosticsIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Subscribe to connection changes
    const unsubscribeConn = wsClient.onConnectionChange((isConnected) => {
      console.log('WebSocket connection status changed:', isConnected);
      setConnected(isConnected);
    });

    // Subscribe to incoming messages
    const unsubscribeMsg = wsClient.onMessage((message) => {
      console.log('Received WebSocket message:', message);
      try {
        // Try to parse JSON for pretty display
        const parsed = JSON.parse(message);
        setMessages(prev => [...prev, JSON.stringify(parsed, null, 2)]);
      } catch (e) {
        // If not JSON, display as-is
        setMessages(prev => [...prev, message]);
      }
    });
    
    // Set up diagnostics refreshing
    const updateDiagnostics = () => {
      if (wsClient.getDiagnostics) {
        setDiagnostics(wsClient.getDiagnostics());
      }
    };
    
    // Update immediately
    updateDiagnostics();
    
    // Set up interval
    diagnosticsIntervalRef.current = window.setInterval(updateDiagnostics, 1000) as unknown as number;

    // Cleanup subscriptions
    return () => {
      unsubscribeConn();
      unsubscribeMsg();
      if (diagnosticsIntervalRef.current) {
        clearInterval(diagnosticsIntervalRef.current);
        diagnosticsIntervalRef.current = null;
      }
    };
  }, []);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    try {
      // Try to send as JSON if it's a valid JSON string
      const parsed = JSON.parse(messageInput);
      wsClient.send(parsed);
    } catch (e) {
      // If not valid JSON, send as plain text
      wsClient.send(messageInput);
    }

    setMessageInput('');
  };

  const handleSubscribeToMetrics = () => {
    wsClient.send({
      type: 'subscribe',
      subscriptionType: 'metrics'
    });
  };

  const handleSubscribeToComponentHealth = () => {
    wsClient.send({
      type: 'subscribe',
      subscriptionType: 'component-health'
    });
  };
  
  const handleSubscribeToSystemHealth = () => {
    wsClient.send({
      type: 'subscribe',
      subscriptionType: 'system-health'
    });
  };

  const handleResetConnection = () => {
    wsClient.reset();
  };
  
  // Test WebSocket connection directly
  const testWebSocketConnection = () => {
    try {
      // Detect environment
      const isReplitEnv = window.location.hostname.includes('replit');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;
      
      setMessages(prev => [...prev, `🧪 Testing WebSocket connection to: ${wsUrl}`]);
      setMessages(prev => [...prev, `🌐 Environment: ${isReplitEnv ? 'Replit' : 'Local'}`]);
      console.log(`🧪 Testing direct WebSocket connection to: ${wsUrl}`);
      
      // Create a new WebSocket directly (not using our client)
      const testSocket = new WebSocket(wsUrl);
      
      // Set up listeners for this test connection
      testSocket.onopen = () => {
        console.log(`✅ Test socket connected successfully!`);
        setMessages(prev => [...prev, `✅ Test connection successful to ${wsUrl}`]);
        
        // Send a test message
        const testMessage = {
          type: 'TEST_CONNECTION',
          timestamp: new Date().toISOString(),
          message: 'This is a direct test connection from React'
        };
        
        try {
          testSocket.send(JSON.stringify(testMessage));
          setMessages(prev => [...prev, `📤 Sent test message: ${JSON.stringify(testMessage)}`]);
        } catch (sendError) {
          setMessages(prev => [...prev, `❌ Error sending message: ${sendError.message}`]);
        }
        
        // Also send a PING to test that mechanism
        setTimeout(() => {
          try {
            const pingMessage = {
              type: 'PING',
              timestamp: new Date().toISOString()
            };
            testSocket.send(JSON.stringify(pingMessage));
            setMessages(prev => [...prev, `📤 Sent PING message`]);
          } catch (pingError) {
            setMessages(prev => [...prev, `❌ Error sending PING: ${pingError.message}`]);
          }
        }, 1000);
        
        // Close after 5 seconds
        setTimeout(() => {
          try {
            testSocket.close(1000, 'Test completed');
            setMessages(prev => [...prev, `🔒 Test completed and connection closed`]);
          } catch (closeError) {
            setMessages(prev => [...prev, `❌ Error closing connection: ${closeError.message}`]);
          }
        }, 5000);
      };
      
      testSocket.onmessage = (event) => {
        console.log(`📨 Test socket received:`, event.data);
        try {
          // Try to parse and format JSON messages
          const parsedData = JSON.parse(event.data);
          setMessages(prev => [...prev, `📨 Received: ${parsedData.type || 'Unknown type'} - ${JSON.stringify(parsedData).substring(0, 100)}${JSON.stringify(parsedData).length > 100 ? '...' : ''}`]);
        } catch (e) {
          setMessages(prev => [...prev, `📨 Received non-JSON: ${event.data.toString().substring(0, 100)}${event.data.toString().length > 100 ? '...' : ''}`]);
        }
      };
      
      testSocket.onerror = (error) => {
        console.error(`❌ Test socket error:`, error);
        setMessages(prev => [...prev, `❌ Test connection error: ${error.toString()}`]);
      };
      
      testSocket.onclose = (event) => {
        console.log(`🔒 Test socket closed: ${event.code} ${event.reason}`);
        setMessages(prev => [...prev, `🔒 Test connection closed: ${event.code} ${event.reason || 'No reason provided'}`]);
      };
    } catch (error) {
      console.error(`❌ Error creating test WebSocket:`, error);
      setMessages(prev => [...prev, `❌ Error creating test WebSocket: ${error.message}`]);
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
              wsClient.send({
                type: 'PING',
                timestamp: new Date().toISOString()
              });
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

      {/* Messages */}
      <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
        <h3 className="text-xl font-semibold mb-2">Received Messages</h3>
        <div className="max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-gray-500">No messages received yet.</p>
          ) : (
            <ul className="space-y-2">
              {messages.map((msg, index) => (
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