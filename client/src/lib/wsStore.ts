/**
 * WebSocket Store
 * 
 * This module provides a global store for WebSocket communication
 * using Zustand for state management.
 */
import { create } from 'zustand';

export type WsMessage = {
  type: string;
  data?: any;
  timestamp?: string;
  requestId?: string;
  [key: string]: any;
};

interface WsState {
  // Connection state
  connected: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastConnected: string | null;
  reconnectAttempt: number;
  
  // Message history
  messages: WsMessage[];
  
  // Filtered message collections
  signals: WsMessage[];
  transactions: WsMessage[];
  marketData: WsMessage[];
  insights: WsMessage[];
  
  // Performance metrics
  messageCount: number;
  lastMessageTime: string | null;
  
  // Action methods
  sendMessage: (message: WsMessage) => void;
  clearMessages: () => void;
  reconnect: () => void;
  
  // Internal methods used by the store
  _handleMessage: (message: string) => void;
  _handleConnectionChange: (connected: boolean, status?: WsState['connectionStatus']) => void;
}

// WebSocket connection instance
let ws: WebSocket | null = null;
// Reconnection attempt count
let reconnectAttempts = 0;
// Maximum reconnection attempts
const MAX_RECONNECT_ATTEMPTS = 5;
// Reconnection delay (with exponential backoff)
const getReconnectDelay = () => Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);

// Create the Zustand store
const useWsStore = create<WsState>((set, get) => ({
  // Connection state
  connected: false,
  connectionStatus: 'disconnected',
  lastConnected: null,
  reconnectAttempt: 0,
  
  // Message collections
  messages: [],
  signals: [],
  transactions: [],
  marketData: [],
  insights: [],
  
  // Performance metrics
  messageCount: 0,
  lastMessageTime: null,
  
  // Send a message through the WebSocket
  sendMessage: (message: WsMessage) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected. Attempting to reconnect...');
      get().reconnect();
      // Queue the message to be sent after reconnection
      setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        } else {
          console.error('Failed to send message after reconnection attempt:', message);
        }
      }, 1000);
      return;
    }
    
    ws.send(JSON.stringify(message));
  },
  
  // Clear all messages in the store
  clearMessages: () => {
    set({
      messages: [],
      signals: [],
      transactions: [],
      marketData: [],
      insights: []
    });
  },
  
  // Reconnect the WebSocket
  reconnect: () => {
    initWebSocket();
  },
  
  // Handle incoming WebSocket messages
  _handleMessage: (messageStr: string) => {
    try {
      const message = JSON.parse(messageStr) as WsMessage;
      
      // Add timestamp if missing
      if (!message.timestamp) {
        message.timestamp = new Date().toISOString();
      }
      
      // Update the store with the new message
      set(state => {
        const newMessages = [...state.messages, message];
        const currentTime = new Date().toISOString();
        
        // Filter messages by type and maintain separate collections
        let newSignals = [...state.signals];
        let newTransactions = [...state.transactions];
        let newMarketData = [...state.marketData];
        let newInsights = [...state.insights];
        
        // Categorize the message
        switch (message.type) {
          case 'SIGNAL':
          case 'SIGNALS_LIST':
            // Handle signal messages
            if (message.data && Array.isArray(message.data)) {
              // If it's a list, replace all signals
              newSignals = message.data.map(signal => ({
                type: 'SIGNAL',
                data: signal,
                timestamp: message.timestamp
              }));
            } else {
              // Single signal update
              newSignals = [...newSignals, message];
            }
            break;
            
          case 'TRANSACTION':
          case 'TRANSACTIONS_LIST':
            // Handle transaction messages
            if (message.data && Array.isArray(message.data)) {
              // If it's a list, replace all transactions
              newTransactions = message.data.map(tx => ({
                type: 'TRANSACTION',
                data: tx,
                timestamp: message.timestamp
              }));
            } else {
              // Single transaction update
              newTransactions = [...newTransactions, message];
            }
            break;
            
          case 'MARKET_DATA':
          case 'DETAILED_MARKET_DATA':
            // Handle market data messages
            newMarketData = [...newMarketData, message];
            break;
            
          case 'INSIGHT':
          case 'INSIGHTS_LIST':
            // Handle insight messages
            if (message.data && Array.isArray(message.data)) {
              newInsights = message.data.map(insight => ({
                type: 'INSIGHT',
                data: insight,
                timestamp: message.timestamp
              }));
            } else {
              newInsights = [...newInsights, message];
            }
            break;
            
          case 'PONG':
            // Handle pong responses - no special handling needed for now
            console.log('Received PONG from server');
            break;
            
          case 'ERROR':
            // Log errors from server
            console.error('WebSocket server error:', message.data?.message || 'Unknown error');
            break;
        }
        
        // Update performance metrics
        return {
          messages: newMessages,
          signals: newSignals,
          transactions: newTransactions,
          marketData: newMarketData,
          insights: newInsights,
          messageCount: state.messageCount + 1,
          lastMessageTime: currentTime
        };
      });
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  },
  
  // Handle connection state changes
  _handleConnectionChange: (connected: boolean, status?: WsState['connectionStatus']) => {
    const connectionStatus = status || (connected ? 'connected' : 'disconnected');
    const currentTime = new Date().toISOString();
    
    set(state => ({ 
      connected,
      connectionStatus,
      lastConnected: connected ? currentTime : state.lastConnected,
      reconnectAttempt: connected ? 0 : state.reconnectAttempt + 1
    }));
    
    if (connected) {
      reconnectAttempts = 0;
      
      // Request initial data upon connection
      setTimeout(() => {
        const { sendMessage } = get();
        sendMessage({ type: 'GET_SIGNALS' });
        sendMessage({ type: 'GET_TRANSACTIONS' });
        sendMessage({ type: 'GET_MARKET_DATA', pairs: ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'] });
      }, 500);
    }
  }
}));

// Initialize the WebSocket connection
function initWebSocket() {
  const store = useWsStore.getState();
  
  // Close existing connection if any
  if (ws) {
    try {
      ws.close();
    } catch (e) {
      console.error('Error closing existing WebSocket connection:', e);
    }
  }
  
  // Update state to connecting
  store._handleConnectionChange(false, 'connecting');
  
  // Get the correct WebSocket URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  console.log(`Connecting to WebSocket at ${wsUrl}`);
  
  try {
    // Create new WebSocket
    ws = new WebSocket(wsUrl);
    
    // Configure WebSocket event handlers
    ws.onopen = () => {
      console.log('WebSocket connected');
      // Update store connection state
      store._handleConnectionChange(true, 'connected');
      
      // Start periodic heartbeat
      startHeartbeat();
    };
    
    ws.onclose = (event) => {
      console.log(`WebSocket disconnected: ${event.code} ${event.reason || 'No reason provided'}`);
      // Update store connection state
      store._handleConnectionChange(false, 'disconnected');
      
      // Attempt reconnection
      reconnectAttempts++;
      if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        const delay = getReconnectDelay();
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(initWebSocket, delay);
      } else {
        console.error(`Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Please refresh the page.`);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      store._handleConnectionChange(false, 'error');
    };
    
    ws.onmessage = (event) => {
      // Handle incoming message
      store._handleMessage(event.data);
    };
  } catch (error) {
    console.error('Failed to create WebSocket connection:', error);
    store._handleConnectionChange(false, 'error');
    
    // Attempt reconnection after delay
    reconnectAttempts++;
    if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
      const delay = getReconnectDelay();
      console.log(`Connection failed. Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      setTimeout(initWebSocket, delay);
    }
  }
}

// Heartbeat interval to keep connection alive
let heartbeatInterval: number | null = null;

// Start a heartbeat to keep the connection alive
function startHeartbeat() {
  // Clear any existing heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  // Send a ping every 30 seconds
  heartbeatInterval = window.setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        const store = useWsStore.getState();
        store.sendMessage({ 
          type: 'PING', 
          timestamp: new Date().toISOString() 
        });
      } catch (e) {
        console.error('Error sending heartbeat:', e);
      }
    }
  }, 30000) as unknown as number;
}

// Stop the heartbeat
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Initialize WebSocket on module load
initWebSocket();

// Reconnect on browser visibility change
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const store = useWsStore.getState();
    if (!store.connected) {
      console.log('Page became visible. Reconnecting WebSocket...');
      store.reconnect();
    }
  } else {
    // Page is hidden, stop heartbeat to save resources
    stopHeartbeat();
  }
});

// Cleanup function to properly close WebSocket connection when the page is unloaded
window.addEventListener('beforeunload', () => {
  if (ws) {
    console.log('Page unloading, closing WebSocket connection...');
    
    // Stop heartbeats
    stopHeartbeat();
    
    // Close WebSocket
    try {
      // Use 1000 (Normal Closure) code
      ws.close(1000, 'Page unloaded');
    } catch (e) {
      console.error('Error during WebSocket cleanup:', e);
    }
  }
});

export default useWsStore;