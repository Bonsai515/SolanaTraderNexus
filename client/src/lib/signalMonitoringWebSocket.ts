/**
 * Signal Monitoring WebSocket Client
 * 
 * This module provides real-time updates of signal monitoring metrics,
 * validation results, and component health via WebSocket connection.
 * It integrates with the signal monitoring system to provide a continuous
 * stream of performance and quality metrics.
 */

import { SignalMetrics, ComponentHealth, ValidationStats } from './signalMonitoringClient';

// Type definitions for WebSocket messages
export interface SignalMonitoringMessage {
  type: 'metrics' | 'validation' | 'component-health' | 'system-health';
  data: any;
  timestamp: string;
}

export type SignalMonitoringCallback = (message: SignalMonitoringMessage) => void;

export interface SignalMonitoringSubscription {
  unsubscribe: () => void;
}

class SignalMonitoringWebSocketClient {
  private static instance: SignalMonitoringWebSocketClient;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelayMs = 2000;
  private callbacks: Map<string, Set<SignalMonitoringCallback>> = new Map();
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  private constructor() {}
  
  public static getInstance(): SignalMonitoringWebSocketClient {
    if (!SignalMonitoringWebSocketClient.instance) {
      SignalMonitoringWebSocketClient.instance = new SignalMonitoringWebSocketClient();
    }
    return SignalMonitoringWebSocketClient.instance;
  }
  
  /**
   * Connect to the signal monitoring WebSocket
   */
  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return; // Already connected or connecting
    }
    
    this.cleanupExistingConnection();
    
    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Disconnect from the WebSocket
   */
  public disconnect(): void {
    this.cleanupExistingConnection();
    this.callbacks.clear();
    this.reconnectAttempts = 0;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  /**
   * Subscribe to signal metrics updates
   * @param callback Callback function to receive metrics updates
   * @returns Subscription object with unsubscribe method
   */
  public subscribeToMetrics(callback: (metrics: SignalMetrics) => void): SignalMonitoringSubscription {
    return this.subscribe('metrics', (msg) => callback(msg.data as SignalMetrics));
  }
  
  /**
   * Subscribe to validation statistics updates
   * @param callback Callback function to receive validation updates
   * @returns Subscription object with unsubscribe method
   */
  public subscribeToValidation(callback: (validation: ValidationStats) => void): SignalMonitoringSubscription {
    return this.subscribe('validation', (msg) => callback(msg.data as ValidationStats));
  }
  
  /**
   * Subscribe to component health updates
   * @param callback Callback function to receive component health updates
   * @returns Subscription object with unsubscribe method
   */
  public subscribeToComponentHealth(callback: (components: ComponentHealth[]) => void): SignalMonitoringSubscription {
    return this.subscribe('component-health', (msg) => callback(msg.data as ComponentHealth[]));
  }
  
  /**
   * Subscribe to system health updates
   * @param callback Callback function to receive system health updates
   * @returns Subscription object with unsubscribe method
   */
  public subscribeToSystemHealth(callback: (health: any) => void): SignalMonitoringSubscription {
    return this.subscribe('system-health', (msg) => callback(msg.data));
  }
  
  /**
   * Determine if the WebSocket is connected
   * @returns True if connected
   */
  public isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * Send a subscription request to the server
   * @param subscriptionType Type of data to subscribe to
   */
  public sendSubscriptionRequest(subscriptionType: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    this.ws.send(JSON.stringify({
      type: 'subscribe',
      subscriptionType
    }));
  }
  
  // Private methods
  
  private handleOpen(event: Event): void {
    console.log('Signal monitoring WebSocket connected');
    this.connected = true;
    this.reconnectAttempts = 0;
    
    // Send subscription requests for each type we have callbacks for
    this.callbacks.forEach((_, type) => {
      this.sendSubscriptionRequest(type);
    });
  }
  
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as SignalMonitoringMessage;
      
      // Dispatch to callbacks
      if (message && message.type && this.callbacks.has(message.type)) {
        const callbacks = this.callbacks.get(message.type);
        callbacks?.forEach(callback => {
          try {
            callback(message);
          } catch (err) {
            console.error(`Error in ${message.type} callback:`, err);
          }
        });
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }
  
  private handleClose(event: CloseEvent): void {
    console.log(`Signal monitoring WebSocket closed: ${event.code} ${event.reason}`);
    this.connected = false;
    this.scheduleReconnect();
  }
  
  private handleError(event: Event): void {
    console.error('Signal monitoring WebSocket error:', event);
    this.connected = false;
  }
  
  private cleanupExistingConnection(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      
      this.ws = null;
    }
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Maximum reconnect attempts reached for signal monitoring WebSocket');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelayMs * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  private subscribe(type: string, callback: SignalMonitoringCallback): SignalMonitoringSubscription {
    // Create callback set if it doesn't exist
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, new Set());
      
      // If already connected, send subscription request immediately
      if (this.connected) {
        this.sendSubscriptionRequest(type);
      }
    }
    
    // Add the callback
    const callbackSet = this.callbacks.get(type)!;
    callbackSet.add(callback);
    
    // Connect if not already connected
    if (!this.connected) {
      this.connect();
    }
    
    // Return unsubscribe function
    return {
      unsubscribe: () => {
        callbackSet.delete(callback);
        
        // Remove type if no more callbacks
        if (callbackSet.size === 0) {
          this.callbacks.delete(type);
          
          // Send unsubscribe message
          if (this.connected) {
            this.ws?.send(JSON.stringify({
              type: 'unsubscribe',
              subscriptionType: type
            }));
          }
        }
      }
    };
  }
}

// Export the singleton instance
export const signalMonitoringWS = SignalMonitoringWebSocketClient.getInstance();