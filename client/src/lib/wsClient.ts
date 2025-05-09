// WebSocket client for communicating with the trading engine

import { createContext, useContext, useCallback, useEffect, useState, ReactNode } from "react";

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

// WebSocket state interface
interface WsState {
  socket: WebSocket | null;
  connectionState: WsConnectionState;
  messages: WsMessage[];
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  registerHandler: (messageType: string, handler: MessageHandler) => () => void;
  unregisterHandler: (messageType: string, handler: MessageHandler) => void;
  clearMessages: () => void;
  sendMessage: (message: Partial<WsMessage>) => void;
  sendRequest: <T = any>(message: Partial<WsMessage>) => Promise<T>;
}

// Create the WebSocket context
const WebSocketContext = createContext<WsState | null>(null);

// WebSocket provider props
interface WebSocketProviderProps {
  children: ReactNode;
}

// WebSocket provider component
export const WebSocketProvider = ({ children }: WebSocketProviderProps) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<WsConnectionState>({
    connected: false,
    connecting: false,
    connectionAttempts: 0,
    lastMessageTime: null,
  });
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const messageHandlers = useState<Map<string, Set<MessageHandler>>>(
    () => new Map()
  )[0];
  const pendingRequests = useState<Map<string, [(data: any) => void, (error: Error) => void]>>(
    () => new Map()
  )[0];
  
  // Connect to WebSocket server
  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (connectionState.connected || connectionState.connecting) {
      return;
    }
    
    setConnectionState(prev => ({
      ...prev,
      connecting: true,
      connectionAttempts: prev.connectionAttempts + 1,
    }));
    
    // Setup WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const newSocket = new WebSocket(wsUrl);
    
    newSocket.onopen = () => {
      console.log("WebSocket connection established");
      setSocket(newSocket);
      setConnectionState(prev => ({
        ...prev,
        connected: true,
        connecting: false,
      }));
    };
    
    newSocket.onclose = () => {
      console.log("WebSocket connection closed");
      
      // Check if we were previously connected
      const wasConnected = connectionState.connected;
      
      setSocket(null);
      setConnectionState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
      }));
      
      // Attempt to reconnect after a delay
      if (wasConnected) {
        setTimeout(() => connect(), 3000);
      }
    };
    
    newSocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionState(prev => ({
        ...prev,
        connecting: false,
      }));
    };
    
    newSocket.onmessage = (event) => {
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
        setMessages(prev => [...prev, wsMessage]);
        setConnectionState(prev => ({
          ...prev,
          lastMessageTime: new Date(),
        }));
        
        // Check for pending request
        if (wsMessage.requestId && pendingRequests.has(wsMessage.requestId)) {
          const [resolve, reject] = pendingRequests.get(wsMessage.requestId)!;
          
          if (wsMessage.type === 'ERROR') {
            reject(new Error(wsMessage.message || 'Unknown error'));
          } else {
            resolve(wsMessage.data);
          }
          
          // Remove from pending requests
          pendingRequests.delete(wsMessage.requestId);
        }
        
        // Notify handlers
        const handlers = messageHandlers.get(wsMessage.type);
        if (handlers) {
          handlers.forEach((handler) => handler(wsMessage));
        }
        
        // Also notify ALL handlers (with '*' type)
        const allHandlers = messageHandlers.get('*');
        if (allHandlers) {
          allHandlers.forEach((handler) => handler(wsMessage));
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };
    
    setSocket(newSocket);
  }, [connectionState.connected, connectionState.connecting, messageHandlers, pendingRequests]);
  
  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    if (socket) {
      socket.close();
      setSocket(null);
    }
  }, [socket]);
  
  // Register handler for message type
  const registerHandler = useCallback((messageType: string, handler: MessageHandler) => {
    const handlers = messageHandlers.get(messageType) || new Set();
    handlers.add(handler);
    messageHandlers.set(messageType, handlers);
    
    // Return unregister function
    return () => {
      unregisterHandler(messageType, handler);
    };
  }, [messageHandlers]);
  
  // Unregister handler for message type
  const unregisterHandler = useCallback((messageType: string, handler: MessageHandler) => {
    const handlers = messageHandlers.get(messageType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        messageHandlers.delete(messageType);
      }
    }
  }, [messageHandlers]);
  
  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);
  
  // Send message to WebSocket server
  const sendMessage = useCallback((message: Partial<WsMessage>) => {
    if (!socket || !connectionState.connected) {
      console.error("Cannot send message: WebSocket not connected");
      connect();
      return;
    }
    
    const fullMessage: WsMessage = {
      type: message.type || 'MESSAGE',
      timestamp: new Date().toISOString(),
      ...message,
    };
    
    socket.send(JSON.stringify(fullMessage));
  }, [socket, connectionState.connected, connect]);
  
  // Send request and wait for response
  const sendRequest = useCallback(<T = any>(message: Partial<WsMessage>): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!socket || !connectionState.connected) {
        connect();
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
      pendingRequests.set(requestId, [resolve, reject]);
      
      // Set timeout to remove pending request
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          const [, reject] = pendingRequests.get(requestId)!;
          reject(new Error("Request timeout"));
          pendingRequests.delete(requestId);
        }
      }, 30000); // 30 second timeout
      
      // Send message
      socket.send(JSON.stringify(fullMessage));
    });
  }, [socket, connectionState.connected, connect, pendingRequests]);
  
  // Connect on mount
  useEffect(() => {
    connect();
    
    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [connect, socket]);
  
  // Provided state and actions
  const value: WsState = {
    socket,
    connectionState,
    messages,
    connect,
    disconnect,
    registerHandler,
    unregisterHandler,
    clearMessages,
    sendMessage,
    sendRequest,
  };
  
  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Hook to use WebSocket context
export const useWsContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWsContext must be used within a WebSocketProvider');
  }
  return context;
};

// Export handler registration hook for convenience
export const useWsHandler = (messageType: string, handler: MessageHandler) => {
  const { registerHandler } = useWsContext();
  
  useEffect(() => {
    const unregister = registerHandler(messageType, handler);
    return unregister;
  }, [registerHandler, messageType, handler]);
};

// Export simplified hook for connection state
export const useWsConnectionState = () => {
  const { connectionState, connect } = useWsContext();
  return { ...connectionState, connect };
};

// Export this as the default for backwards compatibility
export const useWsStore = useWsContext;