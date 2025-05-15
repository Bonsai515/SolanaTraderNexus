/**
 * WebSocket Client
 * 
 * Manages WebSocket connection and provides subscription API
 */

class WebSocketClient {
  private socket: WebSocket | null = null;
  private messageHandlers: ((message: any) => void)[] = [];
  private connectionHandlers: ((connected: boolean) => void)[] = [];
  private backoffTime = 500;
  private maxBackoff = 10000;
  private connecting = false;
  private address: string;
  
  constructor() {
    this.address = this.getWebSocketAddress();
    this.connect();
    
    // Reconnect on window focus
    window.addEventListener('focus', () => {
      if (!this.isConnected()) {
        this.connect();
      }
    });
  }
  
  private getWebSocketAddress(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
  
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  connect(): void {
    if (this.connecting || this.isConnected()) return;
    
    this.connecting = true;
    try {
      this.socket = new WebSocket(this.address);
      
      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.backoffTime = 500;
        this.connecting = false;
        this.notifyConnectionChange(true);
        this.socket?.send(JSON.stringify({ type: 'CLIENT_CONNECTED' }));
      };
      
      this.socket.onclose = () => {
        console.log('WebSocket disconnected');
        this.connecting = false;
        this.notifyConnectionChange(false);
        
        // Reconnect with exponential backoff
        setTimeout(() => {
          this.connect();
        }, this.backoffTime);
        
        // Increase backoff time for next attempt (with max limit)
        this.backoffTime = Math.min(this.backoffTime * 1.5, this.maxBackoff);
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.socket?.close();
      };
      
      this.socket.onmessage = (event) => {
        this.notifyMessageHandlers(event.data);
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.connecting = false;
      
      // Retry with backoff
      setTimeout(() => {
        this.connect();
      }, this.backoffTime);
      
      // Increase backoff time for next attempt (with max limit)
      this.backoffTime = Math.min(this.backoffTime * 1.5, this.maxBackoff);
    }
  }
  
  onMessage(handler: (message: any) => void): () => void {
    this.messageHandlers.push(handler);
    
    // Return unsubscribe function
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }
  
  onConnectionChange(handler: (connected: boolean) => void): () => void {
    this.connectionHandlers.push(handler);
    
    // Notify immediately with current state
    handler(this.isConnected());
    
    // Return unsubscribe function
    return () => {
      this.connectionHandlers = this.connectionHandlers.filter(h => h !== handler);
    };
  }
  
  private notifyMessageHandlers(message: any): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    }
  }
  
  private notifyConnectionChange(connected: boolean): void {
    for (const handler of this.connectionHandlers) {
      try {
        handler(connected);
      } catch (error) {
        console.error('Error in connection handler:', error);
      }
    }
  }
  
  send(message: any): void {
    if (!this.isConnected()) {
      console.warn('Cannot send message, WebSocket not connected');
      return;
    }
    
    try {
      const messageString = typeof message === 'string' ? message : JSON.stringify(message);
      this.socket?.send(messageString);
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
    }
  }
}

// Singleton instance
const wsClient = new WebSocketClient();
export default wsClient;