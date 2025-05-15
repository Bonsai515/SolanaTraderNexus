/**
 * WebSocket Store using Zustand
 * 
 * Manages WebSocket messages and connection state in a central store.
 */

import { create } from 'zustand';
import { useEffect, useState } from 'react';
import wsClient from './wsClient';

// Define message shape
export interface WSMessage {
  id: string;
  timestamp: string;
  type: string;
  data?: any;
}

// Define Solana connection info shape
export interface SolanaConnectionInfo {
  status: string;
  customRpc: boolean;
  apiKey: boolean;
  network: string;
  timestamp: string;
  websocket: boolean;
  version: string;
}

// Define store shape
interface WSState {
  connected: boolean;
  connectionAttempts: number;
  lastMessageTime: string | null;
  messages: WSMessage[];
  addMessage: (message: WSMessage) => void;
  clearMessages: () => void;
  setConnected: (isConnected: boolean) => void;
  incrementConnectionAttempts: () => void;
  resetConnectionAttempts: () => void;
  registerHandler: (prefix: string, callback: (message: WSMessage) => void) => () => void;
}

// Create store
const useWsStore = create<WSState>((set, get) => ({
  connected: false,
  connectionAttempts: 0,
  lastMessageTime: null,
  messages: [],
  addMessage: (message) => set((state) => {
    const newMessages = [...state.messages, message];
    // Keep only the last 100 messages
    if (newMessages.length > 100) {
      newMessages.shift();
    }
    return { 
      messages: newMessages,
      lastMessageTime: message.timestamp
    };
  }),
  clearMessages: () => set({ messages: [] }),
  setConnected: (isConnected) => set({ 
    connected: isConnected,
    ...(isConnected ? { connectionAttempts: 0 } : {})
  }),
  incrementConnectionAttempts: () => set((state) => ({ 
    connectionAttempts: state.connectionAttempts + 1 
  })),
  resetConnectionAttempts: () => set({ connectionAttempts: 0 }),
  registerHandler: (prefix, callback) => {
    // Create a handler that filters messages by prefix
    const handler = (rawMessage: string) => {
      try {
        // Handle raw string messages
        if (typeof rawMessage === 'string') {
          if (rawMessage.includes(prefix)) {
            const parsed = JSON.parse(rawMessage);
            callback({
              id: parsed.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: parsed.timestamp || new Date().toISOString(),
              type: parsed.type || 'UNKNOWN',
              data: parsed.data || parsed
            });
          }
        } 
        // Handle direct message objects
        else if (rawMessage && rawMessage.type && rawMessage.type.includes(prefix)) {
          callback({
            id: rawMessage.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: rawMessage.timestamp || new Date().toISOString(),
            type: rawMessage.type,
            data: rawMessage.data || rawMessage
          });
        }
      } catch (error) {
        console.error(`Error in registerHandler for prefix "${prefix}":`, error);
      }
    };
    
    // Register with the WebSocket client
    const unsubscribe = wsClient.onMessage(handler);
    return unsubscribe;
  }
}));

// Handle message parsing and store updates
let messageHandlerRegistered = false;

function registerMessageHandler() {
  if (messageHandlerRegistered) return;
  
  wsClient.onMessage((rawMessage) => {
    try {
      // Parse raw message if it's a string
      const message = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
      
      // Create message object with ID if missing
      const wsMessage: WSMessage = {
        id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: message.timestamp || new Date().toISOString(),
        type: message.type || 'UNKNOWN',
        data: message.data || message
      };
      
      // Add message to store
      useWsStore.getState().addMessage(wsMessage);
    } catch (error) {
      console.error('Error processing WebSocket message in store:', error);
    }
  });
  
  wsClient.onConnectionChange((isConnected) => {
    useWsStore.getState().setConnected(isConnected);
  });
  
  messageHandlerRegistered = true;
}

// Register handlers on first import
registerMessageHandler();

// Custom hook to access WebSocket connection state
export function useWsConnectionState() {
  const [state, setState] = useState({
    connected: wsClient.isConnected(),
    connectionAttempts: useWsStore.getState().connectionAttempts,
    lastMessageTime: useWsStore.getState().lastMessageTime
  });
  
  useEffect(() => {
    // Update from store
    const unsubscribeStore = useWsStore.subscribe(
      (state) => ({
        connectionAttempts: state.connectionAttempts,
        lastMessageTime: state.lastMessageTime,
      }),
      (newState) => {
        setState((prev) => ({
          ...prev,
          connectionAttempts: newState.connectionAttempts,
          lastMessageTime: newState.lastMessageTime,
        }));
      }
    );
    
    // Update from client
    const unsubscribeClient = wsClient.onConnectionChange((connected) => {
      setState((prev) => ({ ...prev, connected }));
    });
    
    return () => {
      unsubscribeStore();
      unsubscribeClient();
    };
  }, []);
  
  return state;
}

// Custom hook to get Solana connection information
export function useSolanaConnectionInfo() {
  const [state, setState] = useState<{
    connectionInfo: SolanaConnectionInfo | null;
    loading: boolean;
    error: Error | null;
  }>({
    connectionInfo: null,
    loading: true,
    error: null,
  });
  
  // Function to refresh connection info
  const refresh = () => {
    setState((prev) => ({ ...prev, loading: true }));
    
    fetch('/api/solana/status')
      .then((res) => res.json())
      .then((data) => {
        setState({
          connectionInfo: {
            status: data.status || 'unknown',
            customRpc: !!data.customRpc,
            apiKey: !!data.apiKey,
            network: data.network || 'mainnet-beta',
            timestamp: data.timestamp || new Date().toISOString(),
            websocket: !!data.websocket,
            version: data.version || '',
          },
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        setState({
          connectionInfo: null,
          loading: false,
          error: error as Error,
        });
      });
  };
  
  // Load connection info on mount
  useEffect(() => {
    refresh();
    
    // Also listen for updates via WebSocket
    const unsubscribe = useWsStore.getState().registerHandler('CONNECTION_STATUS', (message) => {
      if (message.data) {
        setState({
          connectionInfo: message.data as SolanaConnectionInfo,
          loading: false,
          error: null,
        });
      }
    });
    
    return unsubscribe;
  }, []);
  
  return { ...state, refresh };
}

export default useWsStore;