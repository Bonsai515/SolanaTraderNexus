/**
 * WebSocket Signal Client
 * 
 * This module provides a WebSocket-based signal client for real-time
 * notifications of trading signals targeted for specific components.
 */

import { Signal } from './signalClient';
import { SignalType } from '../../../../shared/signalTypes';

export interface SignalSubscription {
  pairs?: string[];
  signalTypes?: SignalType[];
  sources?: string[];
}

export type SignalCallback = (signal: Signal) => void;

export class WebSocketSignalClient {
  private ws: WebSocket | null = null;
  private url: string;
  private callbacks: Map<string, SignalCallback[]> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000; // Start with 1 second
  private subscription: SignalSubscription = {};
  private componentTargets: string[] = [];
  
  /**
   * Create a new WebSocket signal client
   * @param componentNames Component names to filter signals for
   */
  constructor(componentNames: string[] = []) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}/signals`;
    this.componentTargets = componentNames;
    
    // Add all signal types handler
    this.callbacks.set('signal', []);
  }
  
  /**
   * Connect to the signal WebSocket server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }
      
      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          console.log('WebSocket connection established');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          // Subscribe with component names
          this.updateSubscription(this.subscription);
          
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'signal') {
              const signal = data.signal;
              
              // Check if signal is targeted for our components
              if (
                this.componentTargets.length === 0 || 
                !signal.targetComponents || 
                signal.targetComponents.length === 0 ||
                signal.targetComponents.some(target => this.componentTargets.includes(target))
              ) {
                // Convert timestamp string to Date object
                signal.timestamp = new Date(signal.timestamp);
                
                // Emit to all signal listeners
                this.emit('signal', signal);
                
                // Emit to signal type specific listeners
                this.emit(`signal:${signal.type}`, signal);
              }
            } else if (data.type === 'subscription_confirmed') {
              console.log('Signal subscription confirmed:', data);
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };
        
        this.ws.onclose = () => {
          this.isConnected = false;
          console.log('WebSocket connection closed');
          
          // Attempt to reconnect
          this.attemptReconnect();
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          
          if (!this.isConnected) {
            reject(error);
          }
        };
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Attempt to reconnect to the server
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Maximum reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    
    // Exponential backoff
    const delay = Math.min(30000, this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts));
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Failed to reconnect:', error);
      });
    }, delay);
  }
  
  /**
   * Update WebSocket subscription
   * @param subscription Subscription parameters
   */
  public updateSubscription(subscription: SignalSubscription): void {
    this.subscription = { ...this.subscription, ...subscription };
    
    if (!this.isConnected || !this.ws) {
      return;
    }
    
    this.ws.send(JSON.stringify({
      type: 'subscribe',
      ...this.subscription
    }));
  }
  
  /**
   * Subscribe to all signals
   * @param callback Function to call when signals are received
   */
  public onSignal(callback: SignalCallback): void {
    this.on('signal', callback);
  }
  
  /**
   * Subscribe to signals of a specific type
   * @param type Signal type to subscribe to
   * @param callback Function to call when signals are received
   */
  public onSignalType(type: SignalType, callback: SignalCallback): void {
    this.on(`signal:${type}`, callback);
    
    // Update server subscription
    const signalTypes = this.subscription.signalTypes || [];
    if (!signalTypes.includes(type)) {
      this.updateSubscription({
        signalTypes: [...signalTypes, type]
      });
    }
  }
  
  /**
   * Add listener for an event
   * @param event Event to listen for
   * @param callback Function to call when event occurs
   */
  private on(event: string, callback: SignalCallback): void {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    
    this.callbacks.get(event)?.push(callback);
  }
  
  /**
   * Remove listener for an event
   * @param event Event to remove listener from
   * @param callback Function to remove
   */
  private off(event: string, callback: SignalCallback): void {
    if (!this.callbacks.has(event)) {
      return;
    }
    
    const callbacks = this.callbacks.get(event) || [];
    const index = callbacks.indexOf(callback);
    
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }
  
  /**
   * Emit an event
   * @param event Event to emit
   * @param signal Signal data
   */
  private emit(event: string, signal: Signal): void {
    if (!this.callbacks.has(event)) {
      return;
    }
    
    const callbacks = this.callbacks.get(event) || [];
    
    for (const callback of callbacks) {
      try {
        callback(signal);
      } catch (error) {
        console.error(`Error in signal callback for ${event}:`, error);
      }
    }
  }
  
  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
}

// Create singleton instances for common components
const hyperionSignalClient = new WebSocketSignalClient(['HyperionAgent']);
const quantumOmegaSignalClient = new WebSocketSignalClient(['QuantumOmegaAgent']);
const transactionEngineSignalClient = new WebSocketSignalClient(['TransactionEngine']);

// Export for use in the application
export { hyperionSignalClient, quantumOmegaSignalClient, transactionEngineSignalClient };