/**
 * WebSocket Client
 * 
 * This module provides a WebSocket client for real-time communication
 * with the server.
 */

/**
 * WebSocket Client
 */
class WebSocketClient {
  private static instance: WebSocketClient;
  private socket: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private messageCallbacks: ((message: string) => void)[] = [];
  private connectionCallbacks: ((connected: boolean) => void)[] = [];
  private messageQueue: any[] = [];
  private connecting: boolean = false;
  
  private constructor() {
    // Initialize WebSocket connection
    this.connect();
    
    // Add window event listeners for visibility change
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('focus', () => this.checkConnection());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkConnection();
        }
      });
    }
  }
  
  /**
   * Get singleton instance
   * @returns Singleton instance
   */
  public static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }
  
  /**
   * Connect to WebSocket server
   */
  private connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.connecting) {
      return;
    }
    
    this.connecting = true;
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Connecting to WebSocket server at ${wsUrl}`);
      
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.reconnectAttempts = 0;
        this.connecting = false;
        this.notifyConnectionCallbacks(true);
        
        // Send any queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          this.sendImmediately(message);
        }
      };
      
      this.socket.onmessage = (event) => {
        this.notifyMessageCallbacks(event.data);
      };
      
      this.socket.onclose = (event) => {
        this.connecting = false;
        this.notifyConnectionCallbacks(false);
        
        console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000) {
          this.attemptReconnect();
        }
      };
      
      this.socket.onerror = (error) => {
        this.connecting = false;
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      this.connecting = false;
      console.error('Error initializing WebSocket:', error);
      this.attemptReconnect();
    }
  }
  
  /**
   * Attempt to reconnect to the WebSocket server
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Maximum reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => this.connect(), delay);
  }
  
  /**
   * Handle the online event
   */
  private handleOnline(): void {
    console.log('Network connection restored. Checking WebSocket connection...');
    this.checkConnection();
  }
  
  /**
   * Check the WebSocket connection and reconnect if necessary
   */
  private checkConnection(): void {
    if (!this.socket || this.socket.readyState === WebSocket.CLOSED || this.socket.readyState === WebSocket.CLOSING) {
      console.log('WebSocket disconnected. Reconnecting...');
      this.reconnectAttempts = 0;
      this.connect();
    }
  }
  
  /**
   * Send a message through the WebSocket
   * @param message Message to send
   * @returns Success status
   */
  public send(message: any): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // Queue message for when connection is established
      this.messageQueue.push(message);
      this.connect();
      return false;
    }
    
    return this.sendImmediately(message);
  }
  
  /**
   * Send a message immediately without queueing
   * @param message Message to send
   * @returns Success status
   */
  private sendImmediately(message: any): boolean {
    try {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(typeof message === 'string' ? message : JSON.stringify(message));
        return true;
      }
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
    }
    
    return false;
  }
  
  /**
   * Register a callback for incoming messages
   * @param callback Function to call when a message is received
   * @returns Unregister function
   */
  public onMessage(callback: (message: string) => void): () => void {
    this.messageCallbacks.push(callback);
    
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Register a callback for connection state changes
   * @param callback Function to call when connection state changes
   * @returns Unregister function
   */
  public onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionCallbacks.push(callback);
    
    // Immediately notify with current state
    if (this.socket) {
      callback(this.socket.readyState === WebSocket.OPEN);
    } else {
      callback(false);
    }
    
    return () => {
      this.connectionCallbacks = this.connectionCallbacks.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Check if the WebSocket is connected
   * @returns True if connected
   */
  public isConnected(): boolean {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }
  
  /**
   * Notify all message callbacks
   * @param message Message received
   */
  private notifyMessageCallbacks(message: string): void {
    this.messageCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error in WebSocket message callback:', error);
      }
    });
  }
  
  /**
   * Notify all connection callbacks
   * @param connected Connection state
   */
  private notifyConnectionCallbacks(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('Error in WebSocket connection callback:', error);
      }
    });
  }
  
  /**
   * Close the WebSocket connection
   */
  public close(): void {
    if (this.socket) {
      this.socket.close(1000, 'Normal closure');
      this.socket = null;
    }
  }
  
  /**
   * Reset the WebSocket connection
   */
  public reset(): void {
    this.close();
    this.reconnectAttempts = 0;
    this.connect();
  }
}

// Export singleton instance
export const wsClient = WebSocketClient.getInstance();