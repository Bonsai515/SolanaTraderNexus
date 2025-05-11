/**
 * WebSocket Client Service
 * 
 * Provides real-time communication with the server via WebSockets
 * with automatic reconnection and message handling.
 */

type MessageHandler = (data: string) => void;
type ConnectionHandler = (isConnected: boolean) => void;
type ErrorHandler = (error: Event) => void;

interface WebSocketOptions {
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  debug?: boolean;
}

// Custom hook to interact with WebSocket
export class WebSocketClient {
  private socket: WebSocket | null = null;
  private baseUrl: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private reconnectAttempts: number;
  private reconnectInterval: number;
  private heartbeatInterval: number;
  private isReconnecting: boolean = false;
  private reconnectCount: number = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private debug: boolean;
  private lastPingTime: number = 0;
  
  constructor(options: WebSocketOptions = {}) {
    // Get the base URL from the current page
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.baseUrl = `${protocol}//${host}`;
    
    // Set options with defaults
    this.reconnectAttempts = options.reconnectAttempts || 5;
    this.reconnectInterval = options.reconnectInterval || 1000;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.debug = options.debug || false;
    
    // Connect on initialization
    this.connect();
  }
  
  // Log messages if debug is enabled
  private log(...args: any[]): void {
    if (this.debug) {
      console.log(...args);
    }
  }
  
  // Connect to the WebSocket server
  private connect(): void {
    try {
      console.log(`Connecting to WebSocket at ${this.baseUrl}/ws (baseUrl: ${this.baseUrl})`);
      
      this.socket = new WebSocket(`${this.baseUrl}/ws`);
      
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.scheduleReconnect();
    }
  }
  
  // Handle WebSocket open event
  private handleOpen(): void {
    this.log('WebSocket connected');
    this.isReconnecting = false;
    this.reconnectCount = 0;
    
    // Notify all connection handlers
    this.connectionHandlers.forEach(handler => handler(true));
    
    // Start heartbeat
    this.startHeartbeat();
  }
  
  // Handle WebSocket message event
  private handleMessage(event: MessageEvent): void {
    try {
      const data = event.data;
      
      // Handle PONG messages internally
      if (typeof data === 'string' && data.includes('"type":"PONG"')) {
        const pong = JSON.parse(data);
        this.log('Received PONG from server');
        return;
      }
      
      // Log the received message for debugging
      console.log('WebSocket message received:', data);
      
      // Notify all message handlers
      this.messageHandlers.forEach(handler => handler(data));
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }
  
  // Handle WebSocket close event
  private handleClose(event: CloseEvent): void {
    console.log(`WebSocket disconnected: ${event.code} ${event.reason}`);
    
    // Notify all connection handlers
    this.connectionHandlers.forEach(handler => handler(false));
    
    // Stop heartbeat
    this.stopHeartbeat();
    
    // Attempt to reconnect if not closing intentionally
    if (!this.isReconnecting && event.code !== 1000) {
      this.scheduleReconnect();
    }
  }
  
  // Handle WebSocket error event
  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
    
    // Notify all error handlers
    this.errorHandlers.forEach(handler => handler(event));
  }
  
  // Schedule reconnection attempt
  private scheduleReconnect(): void {
    if (this.isReconnecting || this.reconnectCount >= this.reconnectAttempts) {
      if (this.reconnectCount >= this.reconnectAttempts) {
        console.error('Maximum reconnection attempts reached. Please refresh the page.');
      }
      return;
    }
    
    this.isReconnecting = true;
    this.reconnectCount++;
    
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectCount - 1);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectCount}/${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  // Start heartbeat mechanism
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();
        
        this.send({
          type: 'PING',
          timestamp: new Date().toISOString()
        });
      }
    }, this.heartbeatInterval);
  }
  
  // Stop heartbeat mechanism
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  // Send a message to the server
  public send(data: any): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected. Message not sent.');
      return false;
    }
    
    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.socket.send(message);
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }
  
  // Close the WebSocket connection
  public close(): void {
    this.isReconnecting = true; // Prevent auto-reconnect
    
    if (this.socket) {
      this.socket.close(1000, 'Client closed connection');
    }
    
    this.stopHeartbeat();
  }
  
  // Subscribe to connection status changes
  public onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    
    // Call handler immediately with current state
    if (this.socket) {
      handler(this.socket.readyState === WebSocket.OPEN);
    } else {
      handler(false);
    }
    
    // Return unsubscribe function
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }
  
  // Subscribe to messages
  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(handler);
    };
  }
  
  // Subscribe to errors
  public onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.errorHandlers.delete(handler);
    };
  }
  
  // Get current connection state
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  // Get connection latency based on heartbeat
  public getLatency(): number {
    if (this.lastPingTime === 0) return -1;
    return Date.now() - this.lastPingTime;
  }
  
  // Request market data for specific pairs
  public requestMarketData(pairs: string[] = ['SOL/USDC', 'BONK/USDC', 'JUP/USDC']): void {
    this.send({
      type: 'GET_MARKET_DATA',
      pairs,
      timestamp: new Date().toISOString()
    });
  }
  
  // Subscribe to real-time signals
  public subscribeToSignals(): void {
    this.send({
      type: 'GET_SIGNALS',
      timestamp: new Date().toISOString()
    });
  }
  
  // Process a trading signal
  public processSignal(signalId: string, action: 'execute' | 'ignore'): void {
    this.send({
      type: 'PROCESS_SIGNAL',
      signalId,
      action,
      timestamp: new Date().toISOString()
    });
  }
}

// Create singleton instance
export const wsClient = new WebSocketClient({ debug: true });

export default wsClient;