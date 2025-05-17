/**
 * WebSocket Server Implementation
 * 
 * This module provides real-time updates for:
 * 1. Price feeds
 * 2. Account updates
 * 3. Trading signals
 */

import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { rpcManager } from './lib/enhancedRpcManager';
import { multiSourcePriceFeed } from './lib/multiSourcePriceFeed';
import { PublicKey } from '@solana/web3.js';

// Subscription types
enum SubscriptionType {
  PRICE_FEED = 'price_feed',
  ACCOUNT_UPDATES = 'account_updates',
  TRADING_SIGNALS = 'trading_signals',
  HEALTH_STATUS = 'health_status'
}

// Subscription interface
interface Subscription {
  id: string;
  type: SubscriptionType;
  client: WebSocket;
  params?: any;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private subscriptions: Map<string, Subscription> = new Map();
  private updateIntervals: Map<SubscriptionType, NodeJS.Timeout> = new Map();
  private httpServer: http.Server;

  constructor(server: http.Server) {
    this.httpServer = server;
    
    // Initialize WebSocket server
    this.wss = new WebSocketServer({ 
      server: this.httpServer,
      path: '/ws'
    });

    // Set up WebSocket event handlers
    this.setupEventHandlers();
    
    // Initialize update intervals
    this.setupUpdateIntervals();
    
    console.log('[WebSocket] Server initialized');
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[WebSocket] Client connected');
      
      // Generate client ID
      const clientId = this.generateId();
      
      // Handle messages
      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message, clientId);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });
      
      // Handle disconnection
      ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
        this.removeClientSubscriptions(clientId);
      });
      
      // Send welcome message
      this.sendMessage(ws, {
        type: 'welcome',
        message: 'Connected to Solana Trading Platform WebSocket',
        clientId
      });
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(ws: WebSocket, message: any, clientId: string): void {
    // Check message type
    if (!message.type) {
      return this.sendError(ws, 'Missing message type');
    }
    
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(ws, message, clientId);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(ws, message, clientId);
        break;
      case 'ping':
        this.sendMessage(ws, { type: 'pong', timestamp: Date.now() });
        break;
      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle subscription requests
   */
  private handleSubscribe(ws: WebSocket, message: any, clientId: string): void {
    // Check subscription type
    if (!message.subscription || !Object.values(SubscriptionType).includes(message.subscription)) {
      return this.sendError(ws, 'Invalid subscription type');
    }
    
    // Generate subscription ID
    const subscriptionId = `${clientId}:${this.generateId()}`;
    
    // Add subscription
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: message.subscription,
      client: ws,
      params: message.params || {}
    });
    
    // Send confirmation
    this.sendMessage(ws, {
      type: 'subscribed',
      subscription: message.subscription,
      id: subscriptionId
    });
    
    // Send initial data
    this.sendInitialData(ws, message.subscription, subscriptionId, message.params);
    
    console.log(`[WebSocket] Client subscribed to ${message.subscription}`);
  }

  /**
   * Handle unsubscribe requests
   */
  private handleUnsubscribe(ws: WebSocket, message: any, clientId: string): void {
    // Check subscription ID
    if (!message.id) {
      return this.sendError(ws, 'Missing subscription ID');
    }
    
    // Remove subscription
    if (this.subscriptions.has(message.id)) {
      const subscription = this.subscriptions.get(message.id);
      this.subscriptions.delete(message.id);
      
      // Send confirmation
      this.sendMessage(ws, {
        type: 'unsubscribed',
        subscription: subscription?.type,
        id: message.id
      });
      
      console.log(`[WebSocket] Client unsubscribed from ${subscription?.type}`);
    } else {
      this.sendError(ws, `Subscription not found: ${message.id}`);
    }
  }

  /**
   * Remove all subscriptions for a client
   */
  private removeClientSubscriptions(clientId: string): void {
    // Find all subscriptions for this client
    const clientSubscriptions = Array.from(this.subscriptions.entries())
      .filter(([id]) => id.startsWith(`${clientId}:`));
    
    // Remove them
    for (const [id] of clientSubscriptions) {
      this.subscriptions.delete(id);
    }
    
    console.log(`[WebSocket] Removed ${clientSubscriptions.length} subscriptions for client`);
  }

  /**
   * Send initial data for a subscription
   */
  private async sendInitialData(ws: WebSocket, subscriptionType: SubscriptionType, 
                               subscriptionId: string, params?: any): Promise<void> {
    switch (subscriptionType) {
      case SubscriptionType.PRICE_FEED: {
        // Send initial price data
        const symbols = params?.symbols || ['SOL', 'USDC', 'BONK', 'MEME', 'JUP', 'WIF', 'ETH', 'BTC'];
        const prices = await multiSourcePriceFeed.getPrices(symbols);
        
        this.sendMessage(ws, {
          type: 'update',
          subscription: subscriptionType,
          id: subscriptionId,
          data: {
            prices: Object.values(prices)
          }
        });
        break;
      }
      
      case SubscriptionType.ACCOUNT_UPDATES: {
        // Validate wallet address
        if (!params?.address) {
          return this.sendError(ws, 'Missing wallet address parameter');
        }
        
        try {
          // Validate the address
          const pubkey = new PublicKey(params.address);
          const connection = rpcManager.getConnection();
          
          // Get initial account info
          const accountInfo = await connection.getAccountInfo(pubkey);
          
          this.sendMessage(ws, {
            type: 'update',
            subscription: subscriptionType,
            id: subscriptionId,
            data: {
              address: params.address,
              exists: accountInfo !== null,
              lamports: accountInfo?.lamports || 0,
              executable: accountInfo?.executable || false
            }
          });
        } catch (error) {
          this.sendError(ws, `Invalid account address: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;
      }
      
      case SubscriptionType.TRADING_SIGNALS: {
        // Send sample trading signals
        const sampleSignals = [
          { symbol: 'SOL', sentiment: 'bullish', confidence: 0.75, timestamp: Date.now() },
          { symbol: 'BONK', sentiment: 'bullish', confidence: 0.82, timestamp: Date.now() },
          { symbol: 'MEME', sentiment: 'neutral', confidence: 0.68, timestamp: Date.now() },
          { symbol: 'JUP', sentiment: 'bullish', confidence: 0.71, timestamp: Date.now() }
        ];
        
        this.sendMessage(ws, {
          type: 'update',
          subscription: subscriptionType,
          id: subscriptionId,
          data: {
            signals: sampleSignals
          }
        });
        break;
      }
      
      case SubscriptionType.HEALTH_STATUS: {
        // Send current health status
        const rpcStatus = rpcManager.getStatus();
        const priceSourceStatus = multiSourcePriceFeed.getSourceStatus();
        
        this.sendMessage(ws, {
          type: 'update',
          subscription: subscriptionType,
          id: subscriptionId,
          data: {
            rpc: rpcStatus,
            priceSources: priceSourceStatus,
            timestamp: Date.now()
          }
        });
        break;
      }
    }
  }

  /**
   * Set up update intervals for different subscription types
   */
  private setupUpdateIntervals(): void {
    // Price feed updates (every 5 seconds)
    this.updateIntervals.set(SubscriptionType.PRICE_FEED, setInterval(() => {
      this.broadcastPriceUpdates();
    }, 5000));
    
    // Account updates (every 10 seconds)
    this.updateIntervals.set(SubscriptionType.ACCOUNT_UPDATES, setInterval(() => {
      this.broadcastAccountUpdates();
    }, 10000));
    
    // Trading signals (every 30 seconds)
    this.updateIntervals.set(SubscriptionType.TRADING_SIGNALS, setInterval(() => {
      this.broadcastTradingSignals();
    }, 30000));
    
    // Health status (every 15 seconds)
    this.updateIntervals.set(SubscriptionType.HEALTH_STATUS, setInterval(() => {
      this.broadcastHealthStatus();
    }, 15000));
  }

  /**
   * Broadcast price updates to subscribers
   */
  private async broadcastPriceUpdates(): Promise<void> {
    // Get all price feed subscriptions
    const priceFeedSubs = Array.from(this.subscriptions.values())
      .filter(sub => sub.type === SubscriptionType.PRICE_FEED);
    
    if (priceFeedSubs.length === 0) return;
    
    try {
      // Get unique symbol lists from all subscribers
      const allSymbols = new Set<string>();
      
      priceFeedSubs.forEach(sub => {
        const symbols = sub.params?.symbols || ['SOL', 'USDC', 'BONK', 'MEME', 'JUP', 'WIF', 'ETH', 'BTC'];
        symbols.forEach((s: string) => allSymbols.add(s));
      });
      
      // Fetch all prices at once
      const prices = await multiSourcePriceFeed.getPrices(Array.from(allSymbols));
      
      // Send to each subscriber
      for (const sub of priceFeedSubs) {
        // Filter to only requested symbols
        const symbols = sub.params?.symbols || ['SOL', 'USDC', 'BONK', 'MEME', 'JUP', 'WIF', 'ETH', 'BTC'];
        const filteredPrices = Object.entries(prices)
          .filter(([symbol]) => symbols.includes(symbol))
          .reduce((acc, [symbol, price]) => {
            acc[symbol] = price;
            return acc;
          }, {} as Record<string, any>);
        
        this.sendMessage(sub.client, {
          type: 'update',
          subscription: sub.type,
          id: sub.id,
          data: {
            prices: Object.values(filteredPrices)
          }
        });
      }
    } catch (error) {
      console.error('[WebSocket] Error broadcasting price updates:', error);
    }
  }

  /**
   * Broadcast account updates to subscribers
   */
  private async broadcastAccountUpdates(): Promise<void> {
    // Get all account update subscriptions
    const accountSubs = Array.from(this.subscriptions.values())
      .filter(sub => sub.type === SubscriptionType.ACCOUNT_UPDATES);
    
    if (accountSubs.length === 0) return;
    
    try {
      const connection = rpcManager.getConnection();
      
      // Process each subscription
      for (const sub of accountSubs) {
        if (!sub.params?.address) continue;
        
        try {
          const pubkey = new PublicKey(sub.params.address);
          const accountInfo = await connection.getAccountInfo(pubkey);
          
          this.sendMessage(sub.client, {
            type: 'update',
            subscription: sub.type,
            id: sub.id,
            data: {
              address: sub.params.address,
              exists: accountInfo !== null,
              lamports: accountInfo?.lamports || 0,
              executable: accountInfo?.executable || false,
              timestamp: Date.now()
            }
          });
        } catch (error) {
          console.error(`[WebSocket] Error getting account info for ${sub.params.address}:`, error);
        }
      }
    } catch (error) {
      console.error('[WebSocket] Error broadcasting account updates:', error);
    }
  }

  /**
   * Broadcast trading signals to subscribers
   */
  private broadcastTradingSignals(): void {
    // Get all trading signal subscriptions
    const signalSubs = Array.from(this.subscriptions.values())
      .filter(sub => sub.type === SubscriptionType.TRADING_SIGNALS);
    
    if (signalSubs.length === 0) return;
    
    try {
      // Generate some simulated trading signals
      const signals = [
        { symbol: 'SOL', sentiment: ['bullish', 'bearish', 'neutral'][Math.floor(Math.random() * 3)], 
          confidence: 0.5 + Math.random() * 0.5, timestamp: Date.now() },
        { symbol: 'BONK', sentiment: ['bullish', 'bearish', 'neutral'][Math.floor(Math.random() * 3)], 
          confidence: 0.5 + Math.random() * 0.5, timestamp: Date.now() },
        { symbol: 'MEME', sentiment: ['bullish', 'bearish', 'neutral'][Math.floor(Math.random() * 3)], 
          confidence: 0.5 + Math.random() * 0.5, timestamp: Date.now() },
        { symbol: 'JUP', sentiment: ['bullish', 'bearish', 'neutral'][Math.floor(Math.random() * 3)], 
          confidence: 0.5 + Math.random() * 0.5, timestamp: Date.now() }
      ];
      
      // Send to all subscribers
      for (const sub of signalSubs) {
        // Filter signals if needed
        let filteredSignals = signals;
        if (sub.params?.symbols) {
          filteredSignals = signals.filter(s => sub.params.symbols.includes(s.symbol));
        }
        
        this.sendMessage(sub.client, {
          type: 'update',
          subscription: sub.type,
          id: sub.id,
          data: {
            signals: filteredSignals
          }
        });
      }
    } catch (error) {
      console.error('[WebSocket] Error broadcasting trading signals:', error);
    }
  }

  /**
   * Broadcast health status to subscribers
   */
  private broadcastHealthStatus(): void {
    // Get all health status subscriptions
    const healthSubs = Array.from(this.subscriptions.values())
      .filter(sub => sub.type === SubscriptionType.HEALTH_STATUS);
    
    if (healthSubs.length === 0) return;
    
    try {
      // Get current health status
      const rpcStatus = rpcManager.getStatus();
      const priceSourceStatus = multiSourcePriceFeed.getSourceStatus();
      
      // Send to all subscribers
      for (const sub of healthSubs) {
        this.sendMessage(sub.client, {
          type: 'update',
          subscription: sub.type,
          id: sub.id,
          data: {
            rpc: rpcStatus,
            priceSources: priceSourceStatus,
            timestamp: Date.now()
          }
        });
      }
    } catch (error) {
      console.error('[WebSocket] Error broadcasting health status:', error);
    }
  }

  /**
   * Send a message to a WebSocket client
   */
  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send an error message to a WebSocket client
   */
  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      error
    });
  }

  /**
   * Generate a random ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Close WebSocket server
   */
  close(): void {
    // Clear all intervals
    for (const interval of this.updateIntervals.values()) {
      clearInterval(interval);
    }
    
    // Close all connections
    this.wss.close();
    console.log('[WebSocket] Server closed');
  }
}

export default WebSocketManager;