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
  
  // Message history
  messages: WsMessage[];
  
  // Filtered message collections
  signals: WsMessage[];
  transactions: WsMessage[];
  marketData: WsMessage[];
  insights: WsMessage[];
  
  // Action methods
  sendMessage: (message: WsMessage) => void;
  clearMessages: () => void;
  reconnect: () => void;
  
  // Internal methods used by the store
  _handleMessage: (message: string) => void;
  _handleConnectionChange: (connected: boolean) => void;
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
  connected: false,
  messages: [],
  signals: [],
  transactions: [],
  marketData: [],
  insights: [],
  
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
        }
        
        return {
          messages: newMessages,
          signals: newSignals,
          transactions: newTransactions,
          marketData: newMarketData,
          insights: newInsights
        };
      });
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  },
  
  // Handle connection state changes
  _handleConnectionChange: (connected: boolean) => {
    set({ connected });
    
    if (connected) {
      reconnectAttempts = 0;
      
      // Request initial data upon connection
      setTimeout(() => {
        const { sendMessage } = get();
        sendMessage({ type: 'GET_SIGNALS' });
        sendMessage({ type: 'GET_TRANSACTIONS' });
      }, 500);
    }
  }
}));

// Initialize the WebSocket connection
function initWebSocket() {
  // Close existing connection if any
  if (ws) {
    ws.close();
  }
  
  // Get the correct WebSocket URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  console.log(`Connecting to WebSocket at ${wsUrl}`);
  
  // Create new WebSocket
  ws = new WebSocket(wsUrl);
  
  // Configure WebSocket event handlers
  ws.onopen = () => {
    console.log('WebSocket connected');
    // Update store connection state
    const store = useWsStore.getState();
    store._handleConnectionChange(true);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    // Update store connection state
    const store = useWsStore.getState();
    store._handleConnectionChange(false);
    
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
  };
  
  ws.onmessage = (event) => {
    // Handle incoming message
    const store = useWsStore.getState();
    store._handleMessage(event.data);
  };
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
  }
});

export default useWsStore;