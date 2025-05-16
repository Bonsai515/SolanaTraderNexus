/**
 * Geyser Real-Time Blockchain Monitoring Service
 * 
 * This service connects to Solana's Geyser plugin via WebSocket to:
 * 1. Monitor real-time blockchain activity for MEV opportunities
 * 2. Track DEX transactions for flash arbitrage
 * 3. Detect meme token liquidity events for sniper strategy
 * 4. Provide microsecond-level price and liquidity updates
 */

import * as fs from 'fs';
import * as path from 'path';
import WebSocket from 'ws';
import { PublicKey } from '@solana/web3.js';
import { EventEmitter } from 'events';

// Load configuration
const CONFIG_DIR = './server/config';
const geyserConfigPath = path.join(CONFIG_DIR, 'geyser-config.json');
const geyserConfig = JSON.parse(fs.readFileSync(geyserConfigPath, 'utf8'));

class GeyserService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private subscriptionIds: Map<string, string> = new Map();
  private transactionBuffer: any[] = [];
  private accountUpdateBuffer: Map<string, any[]> = new Map();

  constructor() {
    super();
    this.initialize();
  }

  /**
   * Initialize the Geyser service
   */
  private initialize(): void {
    if (!geyserConfig.enabled) {
      console.log('[Geyser] Service disabled in configuration');
      return;
    }

    this.connect();
  }

  /**
   * Connect to the Geyser WebSocket endpoint
   */
  private connect(): void {
    try {
      console.log('[Geyser] Connecting to Solana Geyser...');
      
      this.ws = new WebSocket(geyserConfig.connectionSettings.url);
      
      this.ws.on('open', () => {
        console.log('[Geyser] Connected to Solana Geyser plugin');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Subscribe to program updates
        this.subscribeToPrograms();
        
        // Subscribe to account updates
        this.subscribeToAccounts();
        
        this.emit('connected');
      });
      
      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('[Geyser] Error parsing message:', error);
        }
      });
      
      this.ws.on('error', (error) => {
        console.error('[Geyser] WebSocket error:', error);
      });
      
      this.ws.on('close', () => {
        this.isConnected = false;
        console.log('[Geyser] Connection closed');
        this.scheduleReconnect();
      });
    } catch (error) {
      console.error('[Geyser] Connection error:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > geyserConfig.connectionSettings.maxRetries) {
      console.error('[Geyser] Maximum reconnection attempts reached');
      this.emit('max_reconnect_attempts');
      return;
    }
    
    const delay = geyserConfig.connectionSettings.reconnectInterval;
    console.log(`[Geyser] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Subscribe to program updates
   */
  private subscribeToPrograms(): void {
    if (!this.isConnected || !this.ws) return;
    
    geyserConfig.programSubscriptions.forEach((program) => {
      const subscribeMsg = {
        jsonrpc: '2.0',
        id: this.generateId(),
        method: 'programSubscribe',
        params: [
          program.programId,
          { commitment: 'confirmed' }
        ]
      };
      
      this.ws!.send(JSON.stringify(subscribeMsg));
      console.log(`[Geyser] Subscribed to program: ${program.name} (${program.programId})`);
    });
  }

  /**
   * Subscribe to account updates
   */
  private subscribeToAccounts(): void {
    if (!this.isConnected || !this.ws) return;
    
    geyserConfig.accountSubscriptions.forEach((account) => {
      const subscribeMsg = {
        jsonrpc: '2.0',
        id: this.generateId(),
        method: 'accountSubscribe',
        params: [
          account.address,
          { commitment: 'confirmed' }
        ]
      };
      
      this.ws!.send(JSON.stringify(subscribeMsg));
      console.log(`[Geyser] Subscribed to account: ${account.description} (${account.address})`);
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: any): void {
    // Handle subscription confirmations
    if (message.result !== undefined) {
      this.subscriptionIds.set(message.id, message.result);
      return;
    }
    
    // Handle notification messages
    if (message.method === 'programNotification') {
      this.handleProgramNotification(message.params);
    }
    else if (message.method === 'accountNotification') {
      this.handleAccountNotification(message.params);
    }
  }

  /**
   * Handle program notifications
   */
  private handleProgramNotification(params: any): void {
    const { result } = params;
    if (!result || !result.value) return;
    
    const { pubkey, account, value } = result.value;
    
    // Store transaction data in buffer
    this.transactionBuffer.push({
      timestamp: new Date().toISOString(),
      programId: pubkey,
      data: value,
      slot: result.context.slot
    });
    
    // Trim buffer if it gets too large
    if (this.transactionBuffer.length > geyserConfig.analytics.storageWindow * 60) {
      this.transactionBuffer.shift();
    }
    
    // Emit transaction event for real-time processing
    this.emit('program_transaction', {
      programId: pubkey,
      data: value,
      slot: result.context.slot
    });
    
    // Check for MEV opportunities
    if (geyserConfig.usageConfig.mevProtection.enabled) {
      this.analyzeMEVOpportunity(pubkey, value);
    }
    
    // Check for arbitrage opportunities
    if (geyserConfig.usageConfig.flashArbitrage.enabled) {
      this.analyzeArbitrageOpportunity(pubkey, value);
    }
  }

  /**
   * Handle account notifications
   */
  private handleAccountNotification(params: any): void {
    const { result } = params;
    if (!result || !result.value) return;
    
    const { pubkey, account, value } = result.value;
    
    // Initialize buffer for this account if it doesn't exist
    if (!this.accountUpdateBuffer.has(pubkey)) {
      this.accountUpdateBuffer.set(pubkey, []);
    }
    
    // Get buffer for this account
    const buffer = this.accountUpdateBuffer.get(pubkey)!;
    
    // Add update to buffer
    buffer.push({
      timestamp: new Date().toISOString(),
      data: value,
      slot: result.context.slot
    });
    
    // Trim buffer if it gets too large
    if (buffer.length > 100) {
      buffer.shift();
    }
    
    // Emit account update event for real-time processing
    this.emit('account_update', {
      pubkey,
      data: value,
      slot: result.context.slot
    });
    
    // Check for meme token sniper opportunities
    if (geyserConfig.usageConfig.memeSniper.enabled) {
      this.analyzeMemeTokenOpportunity(pubkey, value);
    }
  }

  /**
   * Analyze transaction for MEV opportunities
   */
  private analyzeMEVOpportunity(programId: string, data: any): void {
    // Implementation for MEV detection
    // This would analyze transactions to detect front-running opportunities
    // and emit events when found
    
    // For now, just emit generic event that strategies can use
    this.emit('mev_opportunity', {
      programId,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Analyze transaction for arbitrage opportunities
   */
  private analyzeArbitrageOpportunity(programId: string, data: any): void {
    // Implementation for arbitrage detection
    // This would analyze DEX transactions to find price discrepancies
    // and emit events when profitable opportunities are found
    
    // For now, just emit generic event that strategies can use
    this.emit('arbitrage_opportunity', {
      programId,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Analyze account update for meme token opportunities
   */
  private analyzeMemeTokenOpportunity(accountId: string, data: any): void {
    // Implementation for meme token opportunity detection
    // This would analyze liquidity pool updates to find new tokens
    // or significant price/liquidity changes
    
    // For now, just emit generic event that strategies can use
    this.emit('meme_token_opportunity', {
      accountId,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Generate a unique ID for RPC requests
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get the current connection status
   */
  public isConnectedToGeyser(): boolean {
    return this.isConnected;
  }

  /**
   * Get recent transactions from the buffer
   */
  public getRecentTransactions(count: number = 50): any[] {
    return this.transactionBuffer.slice(-count);
  }

  /**
   * Get recent account updates for a specific account
   */
  public getAccountUpdates(accountId: string, count: number = 50): any[] {
    const updates = this.accountUpdateBuffer.get(accountId);
    if (!updates) return [];
    return updates.slice(-count);
  }

  /**
   * Close the WebSocket connection
   */
  public close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.isConnected = false;
  }
}

// Create singleton instance
const geyserService = new GeyserService();

// Export the service
export default geyserService;
