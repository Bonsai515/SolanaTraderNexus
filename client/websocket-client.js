/**
 * WebSocket Client for Real-Time Data
 * 
 * This module provides a client-side implementation for the WebSocket server.
 * It handles connections, subscriptions, and data processing for real-time updates.
 */

class WebSocketClient {
  constructor(options = {}) {
    this.autoReconnect = options.autoReconnect !== false;
    this.reconnectInterval = options.reconnectInterval || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.subscriptions = new Map();
    this.reconnectAttempts = 0;
    this.socket = null;
    this.connected = false;
    this.listeners = {
      open: [],
      close: [],
      error: [],
      message: [],
      reconnect: [],
      reconnectFailed: []
    };
  }

  /**
   * Connect to the WebSocket server
   */
  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws`;

    console.log(`Connecting to WebSocket server at ${url}`);
    this.socket = new WebSocket(url);

    // Set up event handlers
    this.socket.onopen = (event) => {
      console.log('WebSocket connection established');
      this.connected = true;
      this.reconnectAttempts = 0;
      this._triggerEvent('open', event);
      
      // Restore subscriptions
      this._restoreSubscriptions();
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket connection closed');
      this.connected = false;
      this._triggerEvent('close', event);
      
      // Attempt to reconnect
      if (this.autoReconnect) {
        this._attemptReconnect();
      }
    };

    this.socket.onerror = (event) => {
      console.error('WebSocket error:', event);
      this._triggerEvent('error', event);
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._handleMessage(data);
        this._triggerEvent('message', data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
  }

  /**
   * Subscribe to a data stream
   */
  subscribe(type, params = {}) {
    if (!this.connected) {
      console.warn('WebSocket not connected, queuing subscription');
      this.subscriptions.set(`${type}:${JSON.stringify(params)}`, { type, params });
      return null;
    }

    const message = {
      type: 'subscribe',
      subscription: type,
      params
    };

    this.socket.send(JSON.stringify(message));
    return message;
  }

  /**
   * Unsubscribe from a data stream
   */
  unsubscribe(subscriptionId) {
    if (!this.connected) {
      console.warn('WebSocket not connected, cannot unsubscribe');
      return;
    }

    const message = {
      type: 'unsubscribe',
      id: subscriptionId
    };

    this.socket.send(JSON.stringify(message));
  }

  /**
   * Add an event listener
   */
  addEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * Remove an event listener
   */
  removeEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  _attemptReconnect() {
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error(`Failed to reconnect after ${this.maxReconnectAttempts} attempts`);
      this._triggerEvent('reconnectFailed');
      return;
    }
    
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    this._triggerEvent('reconnect', this.reconnectAttempts);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  /**
   * Restore previous subscriptions after reconnecting
   */
  _restoreSubscriptions() {
    console.log(`Restoring ${this.subscriptions.size} subscriptions`);
    
    for (const [key, subscription] of this.subscriptions.entries()) {
      console.log(`Resubscribing to ${subscription.type}`);
      this.subscribe(subscription.type, subscription.params);
    }
  }

  /**
   * Handle incoming message
   */
  _handleMessage(message) {
    // Handle subscription confirmations
    if (message.type === 'subscribed') {
      console.log(`Subscription confirmed: ${message.subscription} (ID: ${message.id})`);
      this.subscriptions.set(`${message.subscription}:${message.id}`, {
        type: message.subscription,
        id: message.id
      });
    }
    
    // Handle unsubscribe confirmations
    else if (message.type === 'unsubscribed') {
      console.log(`Unsubscribed from ${message.subscription} (ID: ${message.id})`);
      this.subscriptions.delete(`${message.subscription}:${message.id}`);
    }
    
    // Handle errors
    else if (message.type === 'error') {
      console.error(`WebSocket error: ${message.error}`);
    }
  }

  /**
   * Trigger an event
   */
  _triggerEvent(event, data) {
    if (this.listeners[event]) {
      for (const callback of this.listeners[event]) {
        callback(data);
      }
    }
  }
}

// Export the WebSocket client
export default WebSocketClient;