/**
 * Signal Monitoring WebSocket Client
 * 
 * This module provides real-time monitoring capabilities via WebSocket
 * for monitoring system health and component status.
 */

import { ComponentHealth, SystemHealthMetrics } from './signalMonitoringClient';

/**
 * Signal Monitoring WebSocket Client
 */
class SignalMonitoringWebSocketClient {
  private static instance: SignalMonitoringWebSocketClient;
  private systemHealthCallbacks: ((health: SystemHealthMetrics) => void)[] = [];
  private componentHealthCallbacks: ((components: ComponentHealth[]) => void)[] = [];
  private alertCallbacks: ((alert: any) => void)[] = [];
  private signalFlowCallbacks: ((flow: any) => void)[] = [];
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnected = false;

  private constructor() {
    this.setupWebSocketConnection();
  }

  /**
   * Get singleton instance
   * @returns Singleton instance
   */
  public static getInstance(): SignalMonitoringWebSocketClient {
    if (!SignalMonitoringWebSocketClient.instance) {
      SignalMonitoringWebSocketClient.instance = new SignalMonitoringWebSocketClient();
    }
    return SignalMonitoringWebSocketClient.instance;
  }

  /**
   * Set up WebSocket connection
   */
  private setupWebSocketConnection(): void {
    try {
      // Use a different path than the default /ws to avoid conflicts with Vite's HMR
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = () => {
        console.log('Signal monitoring WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Subscribe to monitoring channels
        this.sendMessage({
          type: 'subscribe',
          channels: ['system_health', 'component_health', 'alerts', 'signal_flow']
        });
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'system_health':
              this.notifySystemHealthCallbacks(data.data);
              break;
            case 'component_health':
              this.notifyComponentHealthCallbacks(data.data);
              break;
            case 'alert':
              this.notifyAlertCallbacks(data.data);
              break;
            case 'signal_flow':
              this.notifySignalFlowCallbacks(data.data);
              break;
            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.socket.onclose = (event) => {
        console.log('Signal monitoring WebSocket disconnected', event.code, event.reason);
        this.isConnected = false;
        this.attemptReconnect();
      };
      
      this.socket.onerror = (error) => {
        console.error('Signal monitoring WebSocket error:', error);
        // The onclose handler will be called after this, triggering reconnect
      };
    } catch (error) {
      console.error('Error setting up WebSocket connection:', error);
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  private attemptReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectAttempts++;
        this.setupWebSocketConnection();
      }, delay);
    } else {
      console.error('Maximum WebSocket reconnect attempts reached');
    }
  }

  /**
   * Send a message to the WebSocket server
   * @param message Message to send
   */
  private sendMessage(message: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent');
    }
  }

  /**
   * Subscribe to system health updates
   * @param callback Function to call with health updates
   * @returns Object with unsubscribe method
   */
  public subscribeToSystemHealth(callback: (health: SystemHealthMetrics) => void): { unsubscribe: () => void } {
    this.systemHealthCallbacks.push(callback);
    
    return {
      unsubscribe: () => {
        this.systemHealthCallbacks = this.systemHealthCallbacks.filter(cb => cb !== callback);
      }
    };
  }

  /**
   * Subscribe to component health updates
   * @param callback Function to call with component updates
   * @returns Object with unsubscribe method
   */
  public subscribeToComponentHealth(callback: (components: ComponentHealth[]) => void): { unsubscribe: () => void } {
    this.componentHealthCallbacks.push(callback);
    
    return {
      unsubscribe: () => {
        this.componentHealthCallbacks = this.componentHealthCallbacks.filter(cb => cb !== callback);
      }
    };
  }

  /**
   * Subscribe to system alerts
   * @param callback Function to call with alerts
   * @returns Object with unsubscribe method
   */
  public subscribeToAlerts(callback: (alert: any) => void): { unsubscribe: () => void } {
    this.alertCallbacks.push(callback);
    
    return {
      unsubscribe: () => {
        this.alertCallbacks = this.alertCallbacks.filter(cb => cb !== callback);
      }
    };
  }

  /**
   * Subscribe to signal flow updates
   * @param callback Function to call with flow updates
   * @returns Object with unsubscribe method
   */
  public subscribeToSignalFlow(callback: (flow: any) => void): { unsubscribe: () => void } {
    this.signalFlowCallbacks.push(callback);
    
    return {
      unsubscribe: () => {
        this.signalFlowCallbacks = this.signalFlowCallbacks.filter(cb => cb !== callback);
      }
    };
  }

  /**
   * Notify all system health subscribers
   * @param health Health data to send
   */
  private notifySystemHealthCallbacks(health: SystemHealthMetrics): void {
    this.systemHealthCallbacks.forEach(callback => {
      try {
        callback(health);
      } catch (error) {
        console.error('Error in system health callback:', error);
      }
    });
  }

  /**
   * Notify all component health subscribers
   * @param components Component health data to send
   */
  private notifyComponentHealthCallbacks(components: ComponentHealth[]): void {
    this.componentHealthCallbacks.forEach(callback => {
      try {
        callback(components);
      } catch (error) {
        console.error('Error in component health callback:', error);
      }
    });
  }

  /**
   * Notify all alert subscribers
   * @param alert Alert data to send
   */
  private notifyAlertCallbacks(alert: any): void {
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    });
  }

  /**
   * Notify all signal flow subscribers
   * @param flow Signal flow data to send
   */
  private notifySignalFlowCallbacks(flow: any): void {
    this.signalFlowCallbacks.forEach(callback => {
      try {
        callback(flow);
      } catch (error) {
        console.error('Error in signal flow callback:', error);
      }
    });
  }
}

export const signalMonitoringWS = SignalMonitoringWebSocketClient.getInstance();