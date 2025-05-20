/**
 * Syndica WebSocket Connection
 * 
 * This module establishes a WebSocket connection to Syndica for real-time
 * data and to avoid rate limiting from HTTP requests.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Syndica API key
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_WS_URL = `wss://solana-mainnet.api.syndica.io/api-key/q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk`;

// Types
interface RpcRequest {
  id: string;
  jsonrpc: string;
  method: string;
  params: any[];
}

interface RpcResponse {
  id: string;
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timestamp: number;
  method: string;
}

// Syndica WebSocket Client
class SyndicaWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private subscriptions: Map<string, { id: string, callback: (data: any) => void }> = new Map();
  
  constructor() {
    super();
    this.connect();
  }
  
  /**
   * Connect to Syndica WebSocket
   */
  private connect(): void {
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    
    console.log('[Syndica WebSocket] Connecting to Syndica...');
    
    try {
      this.ws = new WebSocket(SYNDICA_WS_URL);
      
      this.ws.on('open', this.handleOpen.bind(this));
      this.ws.on('message', this.handleMessage.bind(this));
      this.ws.on('error', this.handleError.bind(this));
      this.ws.on('close', this.handleClose.bind(this));
    } catch (error) {
      console.error('[Syndica WebSocket] Connection error:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('[Syndica WebSocket] Connected to Syndica');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.emit('connected');
    
    // Start ping interval to keep connection alive
    this.startPingInterval();
    
    // Resubscribe to all subscriptions
    this.resubscribeAll();
  }
  
  /**
   * Handle WebSocket message event
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle subscription notifications
      if (message.method === 'subscription') {
        const subscriptionId = message.params?.subscription;
        if (subscriptionId) {
          const subscription = Array.from(this.subscriptions.values())
            .find(sub => sub.id === subscriptionId);
          
          if (subscription) {
            subscription.callback(message.params.result);
          }
        }
        return;
      }
      
      // Handle regular responses
      const { id, result, error } = message as RpcResponse;
      
      if (!id) return;
      
      const pendingRequest = this.pendingRequests.get(id);
      if (!pendingRequest) return;
      
      this.pendingRequests.delete(id);
      
      if (error) {
        pendingRequest.reject(new Error(`Syndica WebSocket error: ${error.code} - ${error.message}`));
      } else {
        pendingRequest.resolve(result);
      }
    } catch (error) {
      console.error('[Syndica WebSocket] Failed to parse message:', error);
    }
  }
  
  /**
   * Handle WebSocket error event
   */
  private handleError(error: Error): void {
    console.error('[Syndica WebSocket] Error:', error);
    this.emit('error', error);
  }
  
  /**
   * Handle WebSocket close event
   */
  private handleClose(code: number, reason: string): void {
    console.log(`[Syndica WebSocket] Disconnected: ${code} - ${reason}`);
    this.isConnected = false;
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Reject all pending requests
    this.pendingRequests.forEach((request) => {
      request.reject(new Error('WebSocket connection closed'));
    });
    
    this.pendingRequests.clear();
    this.emit('disconnected');
    
    // Attempt to reconnect
    this.scheduleReconnect();
  }
  
  /**
   * Schedule a reconnect attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Syndica WebSocket] Max reconnect attempts reached, giving up');
      this.emit('max_reconnect_attempts');
      return;
    }
    
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    console.log(`[Syndica WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send('ping', []);
      }
    }, 30000);
  }
  
  /**
   * Send a request to Syndica WebSocket
   */
  public async send(method: string, params: any[]): Promise<any> {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      
      const request: RpcRequest = {
        id,
        jsonrpc: '2.0',
        method,
        params
      };
      
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timestamp: Date.now(),
        method
      });
      
      this.ws!.send(JSON.stringify(request));
      
      // Add timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }
  
  /**
   * Subscribe to account updates
   */
  public async subscribeAccount(
    accountAddress: string, 
    callback: (data: any) => void
  ): Promise<string> {
    const subscriptionKey = `account:${accountAddress}`;
    
    // Check if already subscribed
    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }
    
    const result = await this.send('accountSubscribe', [
      accountAddress,
      {
        encoding: 'jsonParsed',
        commitment: 'confirmed'
      }
    ]);
    
    const subscriptionId = result;
    
    this.subscriptions.set(subscriptionKey, {
      id: subscriptionId,
      callback
    });
    
    return subscriptionId;
  }
  
  /**
   * Subscribe to program updates
   */
  public async subscribeProgram(
    programAddress: string,
    callback: (data: any) => void
  ): Promise<string> {
    const subscriptionKey = `program:${programAddress}`;
    
    // Check if already subscribed
    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }
    
    const result = await this.send('programSubscribe', [
      programAddress,
      {
        encoding: 'jsonParsed',
        commitment: 'confirmed'
      }
    ]);
    
    const subscriptionId = result;
    
    this.subscriptions.set(subscriptionKey, {
      id: subscriptionId,
      callback
    });
    
    return subscriptionId;
  }
  
  /**
   * Subscribe to signature updates
   */
  public async subscribeSignature(
    signature: string,
    callback: (data: any) => void
  ): Promise<string> {
    const result = await this.send('signatureSubscribe', [
      signature,
      {
        commitment: 'confirmed'
      }
    ]);
    
    const subscriptionId = result;
    
    const subscriptionKey = `signature:${signature}`;
    this.subscriptions.set(subscriptionKey, {
      id: subscriptionId,
      callback
    });
    
    return subscriptionId;
  }
  
  /**
   * Subscribe to slot updates
   */
  public async subscribeSlot(callback: (data: any) => void): Promise<string> {
    const subscriptionKey = 'slot';
    
    // Check if already subscribed
    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }
    
    const result = await this.send('slotSubscribe', []);
    
    const subscriptionId = result;
    
    this.subscriptions.set(subscriptionKey, {
      id: subscriptionId,
      callback
    });
    
    return subscriptionId;
  }
  
  /**
   * Subscribe to logs
   */
  public async subscribeLogs(
    filter: 'all' | { mentions: string[] } | string,
    callback: (data: any) => void
  ): Promise<string> {
    let subscriptionKey: string;
    
    if (filter === 'all') {
      subscriptionKey = 'logs:all';
    } else if (typeof filter === 'string') {
      subscriptionKey = `logs:program:${filter}`;
    } else {
      subscriptionKey = `logs:mentions:${filter.mentions.join(',')}`;
    }
    
    // Check if already subscribed
    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }
    
    const result = await this.send('logsSubscribe', [
      filter,
      {
        commitment: 'confirmed'
      }
    ]);
    
    const subscriptionId = result;
    
    this.subscriptions.set(subscriptionKey, {
      id: subscriptionId,
      callback
    });
    
    return subscriptionId;
  }
  
  /**
   * Unsubscribe from a subscription
   */
  public async unsubscribe(subscriptionId: string): Promise<boolean> {
    // Find subscription key
    const subscriptionKey = Array.from(this.subscriptions.entries())
      .find(([_, sub]) => sub.id === subscriptionId)?.[0];
    
    if (!subscriptionKey) {
      return false;
    }
    
    // Unsubscribe from Syndica
    const result = await this.send('unsubscribe', [subscriptionId]);
    
    if (result) {
      this.subscriptions.delete(subscriptionKey);
      return true;
    }
    
    return false;
  }
  
  /**
   * Resubscribe to all subscriptions
   */
  private async resubscribeAll(): Promise<void> {
    const subscriptions = [...this.subscriptions.entries()];
    this.subscriptions.clear();
    
    for (const [key, subscription] of subscriptions) {
      try {
        if (key.startsWith('account:')) {
          const accountAddress = key.split(':')[1];
          await this.subscribeAccount(accountAddress, subscription.callback);
        } else if (key.startsWith('program:')) {
          const programAddress = key.split(':')[1];
          await this.subscribeProgram(programAddress, subscription.callback);
        } else if (key === 'slot') {
          await this.subscribeSlot(subscription.callback);
        } else if (key.startsWith('logs:')) {
          if (key === 'logs:all') {
            await this.subscribeLogs('all', subscription.callback);
          } else if (key.startsWith('logs:program:')) {
            const programAddress = key.split(':')[2];
            await this.subscribeLogs(programAddress, subscription.callback);
          } else if (key.startsWith('logs:mentions:')) {
            const mentions = key.split(':')[2].split(',');
            await this.subscribeLogs({ mentions }, subscription.callback);
          }
        }
      } catch (error) {
        console.error(`[Syndica WebSocket] Failed to resubscribe to ${key}:`, error);
      }
    }
  }
  
  /**
   * Get token account balance using WebSocket
   */
  public async getTokenAccountBalance(
    tokenAccountAddress: string
  ): Promise<{
    amount: string;
    decimals: number;
    uiAmount: number;
    uiAmountString: string;
  }> {
    return this.send('getTokenAccountBalance', [tokenAccountAddress]);
  }
  
  /**
   * Get account info using WebSocket
   */
  public async getAccountInfo(
    accountAddress: string,
    commitment: 'confirmed' | 'finalized' = 'confirmed'
  ): Promise<{
    lamports: number;
    owner: string;
    data: string | any;
    executable: boolean;
    rentEpoch: number;
  }> {
    return this.send('getAccountInfo', [
      accountAddress,
      {
        encoding: 'jsonParsed',
        commitment
      }
    ]);
  }
  
  /**
   * Get balance using WebSocket
   */
  public async getBalance(
    accountAddress: string,
    commitment: 'confirmed' | 'finalized' = 'confirmed'
  ): Promise<number> {
    return this.send('getBalance', [
      accountAddress,
      {
        commitment
      }
    ]);
  }
  
  /**
   * Get transaction using WebSocket
   */
  public async getTransaction(
    signature: string,
    commitment: 'confirmed' | 'finalized' = 'confirmed'
  ): Promise<any> {
    return this.send('getTransaction', [
      signature,
      {
        encoding: 'jsonParsed',
        commitment
      }
    ]);
  }
  
  /**
   * Simulate transaction using WebSocket
   */
  public async simulateTransaction(
    transaction: string,
    config: any = {}
  ): Promise<any> {
    return this.send('simulateTransaction', [
      transaction,
      config
    ]);
  }
  
  /**
   * Get slot using WebSocket
   */
  public async getSlot(
    commitment: 'confirmed' | 'finalized' = 'confirmed'
  ): Promise<number> {
    return this.send('getSlot', [
      {
        commitment
      }
    ]);
  }
  
  /**
   * Get recent block hash using WebSocket
   */
  public async getRecentBlockhash(
    commitment: 'confirmed' | 'finalized' = 'confirmed'
  ): Promise<{
    blockhash: string;
    feeCalculator: {
      lamportsPerSignature: number;
    }
  }> {
    return this.send('getRecentBlockhash', [
      {
        commitment
      }
    ]);
  }
  
  /**
   * Send transaction using WebSocket
   */
  public async sendTransaction(
    transaction: string,
    options: any = {}
  ): Promise<string> {
    return this.send('sendTransaction', [
      transaction,
      options
    ]);
  }
  
  /**
   * Close WebSocket connection
   */
  public close(): void {
    console.log('[Syndica WebSocket] Closing connection');
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.pendingRequests.clear();
    this.subscriptions.clear();
  }
}

// Export Syndica WebSocket Client
export const syndicaWebSocket = new SyndicaWebSocketClient();