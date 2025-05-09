/**
 * WebSocket Client Utility
 * 
 * Provides a consistent interface for WebSocket connections with
 * support for reconnection and message handling.
 */

// WebSocket message handler type
type MessageHandler = (data: any) => void;

/**
 * WebSocket client class that provides a consistent interface
 * for WebSocket connections with automatic reconnection.
 */
export class WebSocket {
  private socket: globalThis.WebSocket | null = null;
  private url: string;
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000; // 1 second initial delay
  private messageHandlers: MessageHandler[] = [];

  /**
   * Create a new WebSocket client.
   * @param endpoint The WebSocket endpoint path (e.g., '/ws', '/agents/hyperion')
   */
  constructor(endpoint: string) {
    // Determine the WebSocket URL based on the current environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.url = `${protocol}//${host}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    // Connect to the WebSocket server
    this.connect();
  }

  /**
   * Connect to the WebSocket server.
   */
  private connect(): void {
    try {
      this.socket = new globalThis.WebSocket(this.url);
      
      // Set up event handlers
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket open event.
   */
  private handleOpen(): void {
    console.log(`WebSocket connected to ${this.url}`);
    this.isConnected = true;
    this.reconnectAttempts = 0;
  }

  /**
   * Handle WebSocket close event.
   */
  private handleClose(): void {
    console.log('WebSocket connection closed');
    this.isConnected = false;
    this.scheduleReconnect();
  }

  /**
   * Handle WebSocket error event.
   */
  private handleError(error: Event): void {
    console.error('WebSocket error:', error);
    this.isConnected = false;
  }

  /**
   * Handle WebSocket message event.
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Call all registered message handlers
      for (const handler of this.messageHandlers) {
        handler(data);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  /**
   * Schedule a reconnection attempt.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(30000, this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts));
      
      this.reconnectTimer = setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    } else {
      console.error('Maximum reconnection attempts reached. Please refresh the page.');
    }
  }

  /**
   * Send a message to the WebSocket server.
   * @param data The data to send
   */
  send(data: any): void {
    if (!this.isConnected || !this.socket) {
      console.warn('Cannot send message: WebSocket is not connected');
      return;
    }

    try {
      this.socket.send(typeof data === 'string' ? data : JSON.stringify(data));
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
    }
  }

  /**
   * Add a message handler.
   * @param handler The message handler function
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Remove a message handler.
   * @param handler The message handler function to remove
   */
  offMessage(handler: MessageHandler): void {
    const index = this.messageHandlers.indexOf(handler);
    if (index !== -1) {
      this.messageHandlers.splice(index, 1);
    }
  }

  /**
   * Close the WebSocket connection.
   */
  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.isConnected = false;
  }

  /**
   * Check if the WebSocket is connected.
   */
  isActive(): boolean {
    return this.isConnected;
  }
}

/**
 * Create a new WebSocket client.
 * @param endpoint The WebSocket endpoint path
 */
export function createWebSocket(endpoint: string): WebSocket {
  return new WebSocket(endpoint);
}