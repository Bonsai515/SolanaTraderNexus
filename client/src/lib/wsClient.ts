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
  private pingInterval: number | null = null;
  private lastPingTime: number = 0;
  private lastPongTime: number = 0;
  private connectionCheckInterval: number | null = null;
  
  private constructor() {
    // Initialize WebSocket connection
    this.connect();
    
    // Add window event listeners for visibility change
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => {
        console.log('Network connection lost');
        this.notifyConnectionCallbacks(false);
      });
      window.addEventListener('focus', () => this.checkConnection());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkConnection();
        }
      });
      
      // Set up regular connection check interval
      this.connectionCheckInterval = window.setInterval(() => this.checkConnection(), 15000) as unknown as number;
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
      // Make sure we have the right protocol
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // Get the host from the current URL
      const host = window.location.host;
      
      // Construct the WebSocket URL
      const wsUrl = `${protocol}//${host}/ws`;
      
      console.log(`🔌 Attempting WebSocket connection to: ${wsUrl}`);
      console.log(`🌐 Current window location: ${window.location.href}`);
      console.log(`📝 Full environment details:`, {
        protocol: window.location.protocol,
        host: window.location.host,
        hostname: window.location.hostname, 
        pathname: window.location.pathname,
        search: window.location.search,
        origin: window.location.origin
      });
      
      // In Replit environment, ensure we're connecting properly
      try {
        // Check if we're in Replit environment
        const isReplitEnv = window.location.hostname.includes('replit');
        console.log(`Environment check: ${isReplitEnv ? 'Replit detected' : 'Not in Replit'}`);
        
        // Get Replit domain if available
        const replitDomain = isReplitEnv ? window.location.hostname : null;
        console.log(`Replit domain: ${replitDomain || 'N/A'}`);
        
        // Try a direct connection to the WebSocket
        this.socket = new WebSocket(wsUrl);
        console.log(`Socket created successfully`);
      } catch (err) {
        console.error(`⚠️ Error creating WebSocket:`, err);
        throw err;
      }
      
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
        
        // Set up ping interval
        this.setupPingInterval();
      };
      
      this.socket.onmessage = (event) => {
        // Try to parse message for PONG detection
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === 'PONG') {
            this.lastPongTime = Date.now();
            const latency = this.lastPongTime - this.lastPingTime;
            console.log(`Received PONG response, latency: ${latency}ms`);
          }
        } catch (e) {
          // Not JSON or not a PONG message, that's fine
        }
        
        // Forward to all callbacks
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
   * Set up ping interval for connection monitoring
   */
  private setupPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    this.pingInterval = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          this.lastPingTime = Date.now();
          const pingMessage = {
            type: 'PING',
            timestamp: new Date().toISOString()
          };
          this.sendImmediately(pingMessage);
          console.log('Sent PING to server');
        } catch (error) {
          console.error('Error sending ping:', error);
        }
      }
    }, 30000) as unknown as number; // Send ping every 30 seconds
  }
  
  /**
   * Check the WebSocket connection and reconnect if necessary
   */
  private checkConnection(): void {
    if (!this.socket || this.socket.readyState === WebSocket.CLOSED || this.socket.readyState === WebSocket.CLOSING) {
      console.log('WebSocket disconnected. Reconnecting...');
      this.reconnectAttempts = 0;
      this.connect();
      return;
    }
    
    // Check if connection is stale (last ping was sent but no pong received within 60 seconds)
    if (this.lastPingTime > 0 && 
        this.lastPongTime < this.lastPingTime && 
        Date.now() - this.lastPingTime > 60000) {
      console.log('WebSocket connection appears stale (no PONG response). Resetting connection...');
      this.reset();
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
    // Clear all intervals
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    
    // Close the socket
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
    this.lastPingTime = 0;
    this.lastPongTime = 0;
    
    // Recreate interval for connection checking
    if (!this.connectionCheckInterval && typeof window !== 'undefined') {
      this.connectionCheckInterval = window.setInterval(() => this.checkConnection(), 15000) as unknown as number;
    }
    
    this.connect();
  }
  
  /**
   * Get connection diagnostics info
   */
  public getDiagnostics(): any {
    return {
      connected: this.isConnected(),
      socketState: this.socket ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.socket.readyState] : 'NO_SOCKET',
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      lastPingTime: this.lastPingTime ? new Date(this.lastPingTime).toISOString() : null,
      lastPongTime: this.lastPongTime ? new Date(this.lastPongTime).toISOString() : null,
      pingLatency: this.lastPingTime && this.lastPongTime ? (this.lastPongTime - this.lastPingTime) + 'ms' : 'unknown',
      queuedMessages: this.messageQueue.length
    };
  }
}

// Export singleton instance
export const wsClient = WebSocketClient.getInstance();