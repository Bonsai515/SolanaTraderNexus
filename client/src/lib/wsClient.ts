// Create a WebSocket connection that can be reused across the app
// and automatically reconnects on disconnection

class WSClient extends EventTarget {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second delay
  private url: string;
  
  constructor() {
    super();
    
    // Determine the correct WebSocket URL based on current protocol and host
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.url = `${protocol}//${window.location.host}/ws`;
    
    this.connect();
  }
  
  private connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    
    try {
      this.socket = new WebSocket(this.url);
      
      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.dispatchEvent(new Event('open'));
      };
      
      this.socket.onclose = () => {
        console.log('WebSocket disconnected');
        this.dispatchEvent(new Event('close'));
        this.attemptReconnect();
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.dispatchEvent(new Event('error'));
      };
      
      this.socket.onmessage = (event) => {
        this.dispatchEvent(new MessageEvent('message', { data: event.data }));
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.attemptReconnect();
    }
  }
  
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }
  
  send(data: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(typeof data === 'string' ? data : JSON.stringify(data));
    } else {
      console.error('Cannot send message, WebSocket is not connected');
    }
  }
  
  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

// Create a singleton instance
export const wsClient = new WSClient();
