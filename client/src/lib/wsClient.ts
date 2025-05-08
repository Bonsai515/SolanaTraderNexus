// WebSocket client for communicating with the trading engine

import { create } from "zustand";

// Types
export interface WsMessage {
  type: string;
  data?: any;
  message?: string;
  timestamp: string;
  requestId?: string;
}

// Message handler function type
type MessageHandler = (message: WsMessage) => void;

// WebSocket connection state
interface WsConnectionState {
  connected: boolean;
  connecting: boolean;
  connectionAttempts: number;
  lastMessageTime: Date | null;
}

// WebSocket store state
interface WsState {
  socket: WebSocket | null;
  connectionState: WsConnectionState;
  messages: WsMessage[];
  messageHandlers: Map<string, Set<MessageHandler>>;
  pendingRequests: Map<string, [(data: any) => void, (error: Error) => void]>;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  registerHandler: (messageType: string, handler: MessageHandler) => () => void;
  unregisterHandler: (messageType: string, handler: MessageHandler) => void;
  clearMessages: () => void;
  sendMessage: (message: Partial<WsMessage>) => void;
  sendRequest: <T = any>(message: Partial<WsMessage>) => Promise<T>;
}

// Create WebSocket store
export const useWsStore = create<WsState>((set, get) => ({
  socket: null,
  connectionState: {
    connected: false,
    connecting: false,
    connectionAttempts: 0,
    lastMessageTime: null,
  },
  messages: [],
  messageHandlers: new Map(),
  pendingRequests: new Map(),
  
  // Connect to WebSocket server
  connect: () => {
    const state = get();
    
    // Don't connect if already connected or connecting
    if (state.connectionState.connected || state.connectionState.connecting) {
      return;
    }
    
    set((state) => ({
      connectionState: {
        ...state.connectionState,
        connecting: true,
        connectionAttempts: state.connectionState.connectionAttempts + 1,
      },
    }));
    
    // Setup WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log("WebSocket connection established");
      set((state) => ({
        socket,
        connectionState: {
          ...state.connectionState,
          connected: true,
          connecting: false,
        },
      }));
    };
    
    socket.onclose = () => {
      console.log("WebSocket connection closed");
      
      // Check if we were previously connected
      const wasConnected = get().connectionState.connected;
      
      set((state) => ({
        socket: null,
        connectionState: {
          ...state.connectionState,
          connected: false,
          connecting: false,
        },
      }));
      
      // Attempt to reconnect after a delay
      if (wasConnected) {
        setTimeout(() => {
          get().connect();
        }, 3000);
      }
    };
    
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      set((state) => ({
        connectionState: {
          ...state.connectionState,
          connecting: false,
        },
      }));
    };
    
    socket.onmessage = (event) => {
      try {
        // Handle both JSON object messages and JSON array messages
        const rawData = JSON.parse(event.data);
        let wsMessage: WsMessage;
        
        // Handle different message formats
        if (Array.isArray(rawData)) {
          // If it's an array with a message, convert to object format
          // This handles the specific case of ['Solana connection status:', {...}]
          if (typeof rawData[0] === 'string' && typeof rawData[1] === 'object') {
            wsMessage = {
              type: rawData[0],
              data: rawData[1],
              timestamp: new Date().toISOString(),
            };
            console.log("Received message:", rawData);
          } else {
            // Just use as data for other array cases
            wsMessage = {
              type: 'ARRAY_DATA',
              data: rawData,
              timestamp: new Date().toISOString(),
            };
          }
        } else {
          // Regular object message
          wsMessage = rawData as WsMessage;
        }
        
        // Add timestamp if missing
        if (!wsMessage.timestamp) {
          wsMessage.timestamp = new Date().toISOString();
        }
        
        // Update state
        set((state) => ({
          messages: [...state.messages, wsMessage],
          connectionState: {
            ...state.connectionState,
            lastMessageTime: new Date(),
          },
        }));
        
        // Check for pending request
        if (wsMessage.requestId && get().pendingRequests.has(wsMessage.requestId)) {
          const [resolve, reject] = get().pendingRequests.get(wsMessage.requestId)!;
          
          if (wsMessage.type === 'ERROR') {
            reject(new Error(wsMessage.message || 'Unknown error'));
          } else {
            resolve(wsMessage.data);
          }
          
          // Remove from pending requests
          const pendingRequests = new Map(get().pendingRequests);
          pendingRequests.delete(wsMessage.requestId);
          set({ pendingRequests });
        }
        
        // Notify handlers
        const handlers = get().messageHandlers.get(wsMessage.type);
        if (handlers) {
          handlers.forEach((handler) => handler(wsMessage));
        }
        
        // Also notify ALL handlers (with '*' type)
        const allHandlers = get().messageHandlers.get('*');
        if (allHandlers) {
          allHandlers.forEach((handler) => handler(wsMessage));
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };
    
    set({ socket });
  },
  
  // Disconnect from WebSocket server
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
      set({ socket: null });
    }
  },
  
  // Register handler for message type
  registerHandler: (messageType: string, handler: MessageHandler) => {
    const { messageHandlers } = get();
    const handlers = messageHandlers.get(messageType) || new Set();
    handlers.add(handler);
    messageHandlers.set(messageType, handlers);
    set({ messageHandlers: new Map(messageHandlers) });
    
    // Return unregister function
    return () => get().unregisterHandler(messageType, handler);
  },
  
  // Unregister handler for message type
  unregisterHandler: (messageType: string, handler: MessageHandler) => {
    const { messageHandlers } = get();
    const handlers = messageHandlers.get(messageType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        messageHandlers.delete(messageType);
      }
      set({ messageHandlers: new Map(messageHandlers) });
    }
  },
  
  // Clear all messages
  clearMessages: () => {
    set({ messages: [] });
  },
  
  // Send message to WebSocket server
  sendMessage: (message: Partial<WsMessage>) => {
    const { socket, connectionState } = get();
    
    if (!socket || !connectionState.connected) {
      console.error("Cannot send message: WebSocket not connected");
      get().connect();
      return;
    }
    
    const fullMessage: WsMessage = {
      type: message.type || 'MESSAGE',
      timestamp: new Date().toISOString(),
      ...message,
    };
    
    socket.send(JSON.stringify(fullMessage));
  },
  
  // Send request and wait for response
  sendRequest: <T = any>(message: Partial<WsMessage>): Promise<T> => {
    return new Promise((resolve, reject) => {
      const { socket, connectionState, pendingRequests } = get();
      
      if (!socket || !connectionState.connected) {
        get().connect();
        reject(new Error("WebSocket not connected"));
        return;
      }
      
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      const fullMessage: WsMessage = {
        type: message.type || 'REQUEST',
        timestamp: new Date().toISOString(),
        requestId,
        ...message,
      };
      
      // Store promise handlers
      const newPendingRequests = new Map(pendingRequests);
      newPendingRequests.set(requestId, [resolve, reject]);
      set({ pendingRequests: newPendingRequests });
      
      // Set timeout to remove pending request
      setTimeout(() => {
        const currentPendingRequests = get().pendingRequests;
        if (currentPendingRequests.has(requestId)) {
          const [, reject] = currentPendingRequests.get(requestId)!;
          reject(new Error("Request timeout"));
          
          const updatedPendingRequests = new Map(currentPendingRequests);
          updatedPendingRequests.delete(requestId);
          set({ pendingRequests: updatedPendingRequests });
        }
      }, 30000); // 30 second timeout
      
      // Send message
      socket.send(JSON.stringify(fullMessage));
    });
  },
}));

// Singleton instance that can be imported directly
let wsInitialized = false;

export function initializeWebSocket() {
  if (!wsInitialized) {
    useWsStore.getState().connect();
    wsInitialized = true;
  }
}

export function getWebSocket() {
  if (!wsInitialized) {
    initializeWebSocket();
  }
  return useWsStore.getState().socket;
}

export default useWsStore;