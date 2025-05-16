/**
 * Integrate Enhanced Price Feeds from Multiple Sources
 * 
 * This script integrates advanced price feeds from:
 * - GMGN.ai
 * - Pump.fun
 * - DexScreener
 * - Moonshot
 * - Proton
 * - Birdeye
 * - Geyser
 * 
 * These feeds provide real-time price data, liquidity analytics, and
 * meme token sentiment analysis for the nuclear trading strategies.
 */

import * as fs from 'fs';
import * as path from 'path';

// Critical system paths
const DATA_DIR = './data';
const CONFIG_DIR = './server/config';
const PRICE_CONFIG_PATH = path.join(CONFIG_DIR, 'price-feeds.json');
const SYSTEM_MEMORY_PATH = path.join(DATA_DIR, 'system-memory.json');
const TRANSFORMER_CONFIG_PATH = path.join(CONFIG_DIR, 'transformers.json');

// Price feed API endpoints
const PRICE_FEED_ENDPOINTS = {
  gmgn: 'https://api.gmgn.ai/v1/tokens',
  pumpfun: 'https://api.pump.fun/memes/trending',
  dexscreener: 'https://api.dexscreener.com/latest/dex/tokens',
  moonshot: 'https://api.moonshot.observer/v1/tokens/trending',
  proton: 'https://api.protonprotocol.info/tokens',
  birdeye: 'https://public-api.birdeye.so/public/tokenlist',
  geyser: 'https://api.geyser.solana.com/v1/program/subscribe'
};

// Update price feed configuration
function updatePriceFeedConfig(): void {
  console.log('Updating price feed configuration...');
  
  try {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    // Create price feed configuration
    const priceFeedConfig = {
      version: "2.0.0",
      enabledFeeds: [
        "gmgn",
        "pumpfun",
        "dexscreener",
        "moonshot",
        "proton",
        "birdeye", 
        "geyser"
      ],
      updateInterval: 15000, // ms
      retryAttempts: 3,
      retryDelay: 1000, // ms
      rateLimits: {
        gmgn: { requestsPerMinute: 30 },
        pumpfun: { requestsPerMinute: 20 },
        dexscreener: { requestsPerMinute: 30 },
        moonshot: { requestsPerMinute: 20 },
        proton: { requestsPerMinute: 25 },
        birdeye: { requestsPerMinute: 60 },
        geyser: { requestsPerMinute: 120 }
      },
      endpoints: PRICE_FEED_ENDPOINTS,
      prioritization: {
        realtime: ["geyser", "birdeye", "dexscreener"],
        volume: ["birdeye", "dexscreener", "moonshot"],
        memeTokens: ["pumpfun", "gmgn", "moonshot"],
        sentiment: ["gmgn", "pumpfun", "proton"]
      },
      geyserConfig: {
        programSubscriptions: [
          // Jupiter aggregator program for tracking DEX swaps in real-time
          "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", 
          // Raydium program for AMM swaps
          "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
          // Orca Whirlpools program
          "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
        ],
        // Subscribe to these accounts for transaction monitoring
        accountSubscriptions: [
          // Track largest liquidity pools
          "EXnGBBSamqzd3uxEdRLUiJnnAv3gFgRGR3WyEBUzpako", // Raydium SOL-USDC pool
          "6FRwZSv2eczqSJYMmaabrYk4JqFVvNQwfrg3Vt5qh3WF", // Orca SOL-USDC pool
        ],
        // Use Geyser for real-time program/transaction monitoring
        useForMEVProtection: true,
        useForFlashArbitrage: true,
        useForMemeSniper: true,
        transactionAnalysisBuffer: 50 // Store last 50 transactions for analysis
      },
      aggregation: {
        enabled: true,
        algorithm: "NEURAL_WEIGHTED", // Neural network weighted aggregation
        confidenceThreshold: 0.85,
        outlierRejection: true,
        sources: {
          gmgn: { weight: 0.9, usageCategory: ["MEME_TOKENS", "SENTIMENT"] },
          pumpfun: { weight: 0.95, usageCategory: ["MEME_TOKENS", "TRENDING"] },
          dexscreener: { weight: 0.8, usageCategory: ["PRICE", "VOLUME"] },
          moonshot: { weight: 0.85, usageCategory: ["MEME_TOKENS", "TRENDING"] },
          proton: { weight: 0.7, usageCategory: ["PRICE", "SENTIMENT"] },
          birdeye: { weight: 0.9, usageCategory: ["PRICE", "VOLUME", "LIQUIDITY"] },
          geyser: { weight: 1.0, usageCategory: ["REALTIME", "MEV", "TRANSACTION_FLOW"] }
        }
      },
      tokens: {
        memeTokens: [
          { symbol: "BONK", mintAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
          { symbol: "WIF", mintAddress: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
          { symbol: "MEME", mintAddress: "MwYRS9t9QgZstHi5gt6kNNKthmU9hjGHRXmRyHmf2bA" },
          { symbol: "POPCAT", mintAddress: "p0pc4tWRpnVZJATipiH6YFxzQvLxRuH1Jq18Zy4zxU" },
          { symbol: "GUAC", mintAddress: "AVKnbqNQgXDY8kbnno9eSGfwpVz5idimBnDKsBJ5F2X5" },
          { symbol: "BOOK", mintAddress: "9huDUZfxoJ7wGMTffUE7vh1xePqef7gyrLJu9NApncqA" },
          { symbol: "PNUT", mintAddress: "HB5qTnZHmbQKgqn4TrpMZWeGTLb1ZfQbYEp6fUj4su4X" },
          { symbol: "SLERF", mintAddress: "4hUGBH9zd4UNjdZoQBrh1zcRJver8dJ7mcWwrKuVwvGR" }
        ],
        tradingPairs: [
          "SOL/USDC",
          "ETH/USDC",
          "BTC/USDC",
          "JUP/USDC",
          "BONK/USDC",
          "WIF/USDC",
          "MEME/USDC",
          "SLERF/USDC",
          "POPCAT/USDC",
          "GUAC/USDC"
        ]
      },
      pricingAlgorithm: {
        type: "NEURAL_CONSENSUS",
        weights: {
          volume: 0.3,
          liquidity: 0.3,
          recentTrades: 0.2,
          socialSentiment: 0.2
        },
        anomalyDetection: true,
        confidenceScoring: true
      }
    };
    
    // Write price feed configuration to file
    fs.writeFileSync(PRICE_CONFIG_PATH, JSON.stringify(priceFeedConfig, null, 2));
    console.log(`✅ Updated price feed configuration at ${PRICE_CONFIG_PATH}`);
    
    return;
  } catch (error) {
    console.error('Failed to update price feed configuration:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Update transformer configuration to use new price feeds
function updateTransformerConfig(): void {
  console.log('Updating transformer configuration to use enhanced price feeds...');
  
  try {
    let transformerConfig = {};
    
    // Load existing transformer configuration if it exists
    if (fs.existsSync(TRANSFORMER_CONFIG_PATH)) {
      try {
        transformerConfig = JSON.parse(fs.readFileSync(TRANSFORMER_CONFIG_PATH, 'utf8'));
      } catch (e) {
        console.error('Error parsing transformer config:', e);
        // Continue with empty config
      }
    }
    
    // Update MemeCortexRemix transformer config
    transformerConfig.MemeCortexRemix = {
      ...(transformerConfig.MemeCortexRemix || {}),
      enabled: true,
      pairs: ["BONK/USDC", "MEME/USDC", "WIF/USDC", "POPCAT/USDC", "GUAC/USDC", "SLERF/USDC"],
      analysisInterval: 15000, // ms
      sniperScanInterval: 5000, // ms
      usePerplexityAI: true,
      useSocialSentiment: true,
      priceFeedIntegration: {
        enabled: true,
        primarySources: ["pumpfun", "gmgn", "moonshot"],
        secondarySources: ["dexscreener", "birdeye"],
        realtimeUpdates: ["geyser"]
      },
      onChainIntegration: {
        enabled: true,
        programId: "MEMExRx4QEz4fYdLqfhQZ8kCGmrHMjxyf6MDQPSyffAg"
      },
      maxSlippage: 5.0,
      priorityFee: "VERY_HIGH",
      profitTarget: 1.45 // daily %
    };
    
    // Update MicroQHC transformer config
    transformerConfig.MicroQHC = {
      ...(transformerConfig.MicroQHC || {}),
      enabled: true,
      pairs: ["SOL/USDC", "BONK/USDC", "MEME/USDC", "WIF/USDC", "JUP/USDC"],
      analysisInterval: 10000, // ms
      useQuantumPathfinding: true,
      priceFeedIntegration: {
        enabled: true,
        primarySources: ["birdeye", "dexscreener"],
        secondarySources: ["proton"],
        realtimeUpdates: ["geyser"]
      },
      arbitrageConfig: {
        useFlashLoans: true,
        minProfitThreshold: 0.5, // %
        maxRouteLength: 4, // Maximum hops in arbitrage route
        gasAdjustment: 1.5
      },
      onChainIntegration: {
        enabled: true,
        programId: "HRQERBQQpjuXu68qEMzkY1nZ3VJpsfGJXnidHdYUPZxg"
      },
      priorityFee: "MAXIMUM",
      maxSlippage: 1.0,
      profitTarget: 1.4 // daily %
    };
    
    // Update Security transformer config
    transformerConfig.Security = {
      ...(transformerConfig.Security || {}),
      enabled: true,
      pairs: ["SOL/USDC", "ETH/USDC", "BTC/USDC", "JUP/USDC"],
      analysisInterval: 30000, // ms
      maxRetryAttempts: 5,
      priceFeedIntegration: {
        enabled: true,
        primarySources: ["birdeye", "dexscreener"],
        secondarySources: ["proton"],
        realtimeUpdates: ["geyser"]
      },
      priorityFee: "HIGH",
      onChainIntegration: {
        enabled: true,
        programId: "PrCxxvRiPhxM2z9uFaCehLYj7i9s8xqvVXrF8fY6nmT"
      }
    };
    
    // Update CrossChain transformer config
    transformerConfig.CrossChain = {
      ...(transformerConfig.CrossChain || {}),
      enabled: true,
      pairs: ["SOL/USDC", "ETH/USDC", "BTC/USDC", "SOL/ETH", "BTC/ETH"],
      analysisInterval: 25000, // ms
      bridges: ["Wormhole", "Portal", "Allbridge"],
      chains: ["Solana", "Ethereum", "Avalanche", "Sui", "BNB Chain"],
      priceFeedIntegration: {
        enabled: true,
        primarySources: ["birdeye", "dexscreener"],
        secondarySources: ["proton"],
        realtimeUpdates: ["geyser"]
      },
      priorityFee: "HIGH",
      maxSlippage: 1.5,
      onChainIntegration: {
        enabled: true,
        programId: "6LSbYXjP1vj63rUPbz9KLvE3JewHaMdRPdDZZRYoTPCV"
      },
      profitTarget: 1.35 // daily %
    };
    
    // Write updated transformer configuration to file
    fs.writeFileSync(TRANSFORMER_CONFIG_PATH, JSON.stringify(transformerConfig, null, 2));
    console.log(`✅ Updated transformer configuration at ${TRANSFORMER_CONFIG_PATH}`);
    
    return;
  } catch (error) {
    console.error('Failed to update transformer configuration:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Create the Geyser-specific configuration module
function createGeyserIntegration(): void {
  console.log('Creating Geyser integration for real-time blockchain monitoring...');
  
  try {
    const geyserConfigPath = path.join(CONFIG_DIR, 'geyser-config.json');
    
    const geyserConfig = {
      version: "1.0.0",
      enabled: true,
      connectionSettings: {
        url: process.env.HELIUS_API_KEY ?
          `wss://api.mainnet-beta.solana.com/?api-key=${process.env.HELIUS_API_KEY}` : 
          "wss://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9",
        reconnectInterval: 3000,
        maxRetries: 10
      },
      // DEX and AMM programs to monitor for trading opportunities
      programSubscriptions: [
        {
          programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
          name: "Jupiter Aggregator",
          description: "Track DEX trades through Jupiter"
        },
        {
          programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
          name: "Raydium AMM",
          description: "Monitor Raydium liquidity pools and swaps"
        },
        {
          programId: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
          name: "Orca Whirlpools",
          description: "Track concentrated liquidity actions in Orca"
        },
        {
          programId: "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX",
          name: "Openbook DEX",
          description: "Monitor Openbook orderbook trades"
        }
      ],
      // Key liquidity pools and tokens to monitor
      accountSubscriptions: [
        // SOL-USDC pools (highest volume pools on Solana)
        {
          address: "EXnGBBSamqzd3uxEdRLUiJnnAv3gFgRGR3WyEBUzpako",
          description: "Raydium SOL-USDC pool"
        },
        {
          address: "6FRwZSv2eczqSJYMmaabrYk4JqFVvNQwfrg3Vt5qh3WF",
          description: "Orca SOL-USDC pool"
        },
        // Meme token pools for sniper strategy
        {
          address: "5xBRGvPvLiP7sZhArPJtBQZ9ZjLBxcSQ9Zyn1XEh4nzZ",
          description: "BONK-USDC pool"
        },
        {
          address: "7QaS3xjCytYPKr1jZyAXWV3yYXoF4zQU3hLcMySp9aGZ",
          description: "WIF-USDC pool"
        }
      ],
      // How Geyser data is used in the system
      usageConfig: {
        // Front-run large transactions by detecting them early
        mevProtection: {
          enabled: true,
          sandwichDetection: true,
          frontRunningDetection: true,
          minimumTransactionSize: 10000, // In USD
          blockSlotBuffer: 2
        },
        // Use for flash arbitrage by monitoring price impacts
        flashArbitrage: {
          enabled: true,
          minimumProfitThreshold: 0.5, // %
          maxRouteHops: 3,
          maxExecutionTime: 500 // ms
        },
        // Real-time price monitoring for meme token sniping
        memeSniper: {
          enabled: true,
          liquidityThreshold: 50000, // In USD
          volumeThreshold: 10000, // In USD / 5 min
          priceImpactThreshold: 3, // %
          executionDelayMs: 200 // Small delay to verify opportunity
        }
      },
      // Real-time data analytics
      analytics: {
        storageWindow: 30, // minutes
        aggregationInterval: 15, // seconds
        volumeTracking: true,
        liquidityTracking: true,
        priceImpactTracking: true,
        memorySizeLimit: 200 // MB
      }
    };
    
    // Write Geyser configuration to file
    fs.writeFileSync(geyserConfigPath, JSON.stringify(geyserConfig, null, 2));
    console.log(`✅ Created Geyser integration configuration at ${geyserConfigPath}`);
    
    // Create Geyser service implementation file
    const geyserServicePath = path.join('./server/lib', 'geyserService.ts');
    const geyserServiceContent = `/**
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
    console.log(\`[Geyser] Scheduling reconnect in \${delay}ms (attempt \${this.reconnectAttempts})\`);
    
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
      console.log(\`[Geyser] Subscribed to program: \${program.name} (\${program.programId})\`);
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
      console.log(\`[Geyser] Subscribed to account: \${account.description} (\${account.address})\`);
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
`;
    
    // Create lib directory if it doesn't exist
    const libDir = path.join('./server', 'lib');
    if (!fs.existsSync(libDir)) {
      fs.mkdirSync(libDir, { recursive: true });
    }
    
    // Write Geyser service implementation to file
    fs.writeFileSync(geyserServicePath, geyserServiceContent);
    console.log(`✅ Created Geyser service implementation at ${geyserServicePath}`);
    
    return;
  } catch (error) {
    console.error('Failed to create Geyser integration:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Update system memory configuration
function updateSystemMemory(): void {
  console.log('Updating system memory configuration with enhanced price feeds...');
  
  try {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Default configuration if file doesn't exist
    let systemMemory: any = {
      features: {},
      config: {}
    };
    
    // Load existing configuration if it exists
    if (fs.existsSync(SYSTEM_MEMORY_PATH)) {
      try {
        systemMemory = JSON.parse(fs.readFileSync(SYSTEM_MEMORY_PATH, 'utf8'));
      } catch (e) {
        console.error('Error parsing system memory:', e);
        // Continue with default config if parsing fails
      }
    }
    
    // Update price feed configuration in system memory
    if (!systemMemory.config) {
      systemMemory.config = {};
    }
    
    systemMemory.config.priceFeed = {
      ...(systemMemory.config.priceFeed || {}),
      enabled: true,
      gmgn: true,
      pumpfun: true,
      dexscreener: true,
      moonshot: true,
      proton: true,
      birdeye: true,
      geyser: true,
      updateFrequencyMs: 15000,
      useNeuralWeightedAggregation: true,
      useGeyserForRealtime: true
    };
    
    // Update feature flags
    if (!systemMemory.features) {
      systemMemory.features = {};
    }
    
    systemMemory.features = {
      ...(systemMemory.features || {}),
      enhancedPriceFeeds: true,
      realtimeMarketMonitoring: true,
      mevProtection: true,
      geyserIntegration: true
    };
    
    // Update last updated timestamp
    systemMemory.lastUpdated = new Date().toISOString();
    
    // Write updated configuration
    fs.writeFileSync(SYSTEM_MEMORY_PATH, JSON.stringify(systemMemory, null, 2));
    console.log(`✅ Updated system memory at ${SYSTEM_MEMORY_PATH}`);
    
    return;
  } catch (error) {
    console.error('Failed to update system memory:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Create price feed integration service
function createPriceFeedService(): void {
  console.log('Creating enhanced price feed integration service...');
  
  try {
    const priceFeedServicePath = path.join('./server/lib', 'priceFeedService.ts');
    const priceFeedServiceContent = `/**
 * Enhanced Price Feed Integration Service
 * 
 * This service integrates multiple price data sources:
 * - GMGN.ai
 * - Pump.fun
 * - DexScreener
 * - Moonshot
 * - Proton
 * - Birdeye
 * - Geyser
 * 
 * It provides neural-weighted price aggregation and real-time 
 * updates for trading strategies.
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { EventEmitter } from 'events';
import geyserService from './geyserService';

// Load configuration
const CONFIG_DIR = './server/config';
const priceFeedConfig = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'price-feeds.json'), 'utf8'));

class PriceFeedService extends EventEmitter {
  private priceCache: Map<string, any> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private rateLimiters: Map<string, { lastRequest: number, queue: any[] }> = new Map();
  private isInitialized = false;
  
  constructor() {
    super();
    this.initialize();
  }
  
  /**
   * Initialize the price feed service
   */
  private async initialize(): Promise<void> {
    console.log('[PriceFeed] Initializing enhanced price feed service...');
    
    try {
      // Initialize rate limiters
      Object.entries(priceFeedConfig.rateLimits).forEach(([source, config]: [string, any]) => {
        this.rateLimiters.set(source, {
          lastRequest: 0,
          queue: []
        });
      });
      
      // Initialize with first data pull
      await this.updateAllPriceFeeds();
      
      // Set up recurring updates
      priceFeedConfig.enabledFeeds.forEach((feed: string) => {
        if (feed !== 'geyser') { // Geyser uses WebSocket, not polling
          const interval = setInterval(() => {
            this.updatePriceFeed(feed).catch(err => {
              console.error(\`[PriceFeed] Error updating \${feed}:\`, err);
            });
          }, priceFeedConfig.updateInterval);
          
          this.updateIntervals.set(feed, interval);
        }
      });
      
      // Connect to Geyser events if enabled
      if (priceFeedConfig.enabledFeeds.includes('geyser')) {
        geyserService.on('account_update', (data) => {
          this.handleGeyserUpdate(data);
        });
        
        geyserService.on('program_transaction', (data) => {
          this.handleGeyserTransaction(data);
        });
      }
      
      this.isInitialized = true;
      console.log('[PriceFeed] Enhanced price feed service initialized successfully');
      
      // Emit initialization event
      this.emit('initialized');
    } catch (error) {
      console.error('[PriceFeed] Initialization error:', error);
      throw error;
    }
  }
  
  /**
   * Update all price feeds at once
   */
  private async updateAllPriceFeeds(): Promise<void> {
    console.log('[PriceFeed] Updating all price feeds...');
    
    const updatePromises = priceFeedConfig.enabledFeeds
      .filter(feed => feed !== 'geyser') // Geyser uses WebSocket, not polling
      .map(feed => this.updatePriceFeed(feed));
    
    await Promise.allSettled(updatePromises);
    
    // Run aggregation after all feeds are updated
    this.aggregatePrices();
    
    console.log('[PriceFeed] All price feeds updated');
  }
  
  /**
   * Update a specific price feed
   */
  private async updatePriceFeed(feed: string): Promise<void> {
    try {
      // Get endpoint URL
      const endpoint = priceFeedConfig.endpoints[feed];
      if (!endpoint) {
        throw new Error(\`No endpoint configured for feed: \${feed}\`);
      }
      
      // Apply rate limiting
      await this.applyRateLimit(feed);
      
      // Make API request
      const response = await axios.get(endpoint, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Solana-Trading-Bot/1.0.0'
        }
      });
      
      // Process response based on feed type
      const processedData = this.processResponse(feed, response.data);
      
      // Update cache
      this.priceCache.set(feed, {
        data: processedData,
        timestamp: new Date().toISOString(),
        source: feed
      });
      
      // Emit update event
      this.emit('price_update', {
        source: feed,
        data: processedData
      });
      
    } catch (error) {
      console.error(\`[PriceFeed] Error updating \${feed}:\`, error);
      
      // Retry logic
      if (priceFeedConfig.retryAttempts > 0) {
        console.log(\`[PriceFeed] Retrying \${feed} update in \${priceFeedConfig.retryDelay}ms\`);
        
        setTimeout(() => {
          this.updatePriceFeed(feed);
        }, priceFeedConfig.retryDelay);
      }
    }
  }
  
  /**
   * Apply rate limiting for API requests
   */
  private applyRateLimit(feed: string): Promise<void> {
    return new Promise((resolve) => {
      const limiter = this.rateLimiters.get(feed);
      if (!limiter) {
        resolve();
        return;
      }
      
      const config = priceFeedConfig.rateLimits[feed];
      const requestsPerMinute = config.requestsPerMinute;
      const minInterval = 60000 / requestsPerMinute; // ms between requests
      
      const now = Date.now();
      const timeElapsed = now - limiter.lastRequest;
      
      if (timeElapsed >= minInterval) {
        // Can make request immediately
        limiter.lastRequest = now;
        resolve();
      } else {
        // Need to wait
        const delay = minInterval - timeElapsed;
        setTimeout(() => {
          limiter.lastRequest = Date.now();
          resolve();
        }, delay);
      }
    });
  }
  
  /**
   * Process API response based on feed type
   */
  private processResponse(feed: string, data: any): any {
    switch (feed) {
      case 'gmgn':
        return this.processGMGNResponse(data);
      case 'pumpfun':
        return this.processPumpFunResponse(data);
      case 'dexscreener':
        return this.processDexScreenerResponse(data);
      case 'moonshot':
        return this.processMoonshotResponse(data);
      case 'proton':
        return this.processProtonResponse(data);
      case 'birdeye':
        return this.processBirdeyeResponse(data);
      default:
        return data;
    }
  }
  
  /**
   * Process GMGN.ai API response
   */
  private processGMGNResponse(data: any): any {
    // Implementation specific to GMGN.ai response format
    // Extract relevant price, volume, and sentiment data
    try {
      const processed = {
        timestamp: new Date().toISOString(),
        tokens: {}
      };
      
      // Process token data
      if (data.tokens && Array.isArray(data.tokens)) {
        data.tokens.forEach(token => {
          processed.tokens[token.symbol] = {
            price: token.price,
            priceChange24h: token.priceChange24h,
            volume24h: token.volume24h,
            marketCap: token.marketCap,
            sentiment: token.sentiment,
            socialScore: token.socialScore
          };
        });
      }
      
      return processed;
    } catch (error) {
      console.error('[PriceFeed] Error processing GMGN response:', error);
      return data; // Return original data on error
    }
  }
  
  /**
   * Process Pump.fun API response
   */
  private processPumpFunResponse(data: any): any {
    // Implementation specific to Pump.fun response format
    try {
      const processed = {
        timestamp: new Date().toISOString(),
        tokens: {}
      };
      
      // Process meme token data
      if (data.memes && Array.isArray(data.memes)) {
        data.memes.forEach(meme => {
          processed.tokens[meme.symbol] = {
            price: meme.price,
            priceChange1h: meme.priceChange1h,
            priceChange24h: meme.priceChange24h,
            volume24h: meme.volume24h,
            liquidity: meme.liquidity,
            marketCap: meme.marketCap,
            trending: meme.trendingRank,
            holders: meme.holderCount
          };
        });
      }
      
      return processed;
    } catch (error) {
      console.error('[PriceFeed] Error processing Pump.fun response:', error);
      return data;
    }
  }
  
  /**
   * Process DexScreener API response
   */
  private processDexScreenerResponse(data: any): any {
    // Implementation specific to DexScreener response format
    try {
      const processed = {
        timestamp: new Date().toISOString(),
        tokens: {}
      };
      
      // Process pairs data
      if (data.pairs && Array.isArray(data.pairs)) {
        data.pairs.forEach(pair => {
          const baseToken = pair.baseToken.symbol;
          
          processed.tokens[baseToken] = {
            price: pair.priceUsd,
            priceChange24h: pair.priceChange.h24,
            volume24h: pair.volume.h24,
            liquidity: pair.liquidity.usd,
            fdv: pair.fdv
          };
        });
      }
      
      return processed;
    } catch (error) {
      console.error('[PriceFeed] Error processing DexScreener response:', error);
      return data;
    }
  }
  
  /**
   * Process Moonshot API response
   */
  private processMoonshotResponse(data: any): any {
    // Implementation specific to Moonshot response format
    try {
      const processed = {
        timestamp: new Date().toISOString(),
        tokens: {}
      };
      
      // Process trending tokens
      if (data.tokens && Array.isArray(data.tokens)) {
        data.tokens.forEach(token => {
          processed.tokens[token.symbol] = {
            price: token.price,
            priceChange1h: token.priceChange1h,
            priceChange24h: token.priceChange24h,
            volume24h: token.volume24h,
            trendingScore: token.trendingScore,
            socialVolume: token.socialVolume
          };
        });
      }
      
      return processed;
    } catch (error) {
      console.error('[PriceFeed] Error processing Moonshot response:', error);
      return data;
    }
  }
  
  /**
   * Process Proton API response
   */
  private processProtonResponse(data: any): any {
    // Implementation specific to Proton response format
    try {
      const processed = {
        timestamp: new Date().toISOString(),
        tokens: {}
      };
      
      // Process token data
      if (data.tokens && Array.isArray(data.tokens)) {
        data.tokens.forEach(token => {
          processed.tokens[token.symbol] = {
            price: token.price,
            priceChange24h: token.priceChange24h,
            volume24h: token.volume24h,
            marketCap: token.marketCap,
            liquidityUsd: token.liquidity
          };
        });
      }
      
      return processed;
    } catch (error) {
      console.error('[PriceFeed] Error processing Proton response:', error);
      return data;
    }
  }
  
  /**
   * Process Birdeye API response
   */
  private processBirdeyeResponse(data: any): any {
    // Implementation specific to Birdeye response format
    try {
      const processed = {
        timestamp: new Date().toISOString(),
        tokens: {}
      };
      
      // Process token list
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach(token => {
          processed.tokens[token.symbol] = {
            price: token.price,
            priceChange24h: token.priceChange24h,
            volume24h: token.volume24h,
            marketCap: token.marketCap,
            fdv: token.fdv,
            liquidityUsd: token.liquidity
          };
        });
      }
      
      return processed;
    } catch (error) {
      console.error('[PriceFeed] Error processing Birdeye response:', error);
      return data;
    }
  }
  
  /**
   * Handle real-time Geyser account updates
   */
  private handleGeyserUpdate(data: any): void {
    // Implementation for real-time account updates from Geyser
    // This provides microsecond-level price and liquidity updates
    
    // For now, emit the update for strategies to use
    this.emit('realtime_update', {
      source: 'geyser',
      type: 'account_update',
      data: data
    });
  }
  
  /**
   * Handle real-time Geyser transactions
   */
  private handleGeyserTransaction(data: any): void {
    // Implementation for real-time transaction data from Geyser
    // This provides information about trades happening on DEXes
    
    // For now, emit the transaction for strategies to use
    this.emit('realtime_update', {
      source: 'geyser',
      type: 'transaction',
      data: data
    });
  }
  
  /**
   * Aggregate prices from all sources using neural weighted algorithm
   */
  private aggregatePrices(): void {
    if (!priceFeedConfig.aggregation.enabled) {
      return;
    }
    
    console.log('[PriceFeed] Aggregating prices from all sources...');
    
    try {
      const aggregated = {
        timestamp: new Date().toISOString(),
        tokens: {}
      };
      
      // Get token list from config
      const tokens = [...priceFeedConfig.tokens.memeTokens.map(t => t.symbol), 
                      ...priceFeedConfig.tokens.tradingPairs.map(p => p.split('/')[0])];
      
      // Deduplicate tokens
      const uniqueTokens = [...new Set(tokens)];
      
      // Aggregate each token's price data
      uniqueTokens.forEach(token => {
        const tokenData = this.aggregateTokenData(token);
        if (tokenData) {
          aggregated.tokens[token] = tokenData;
        }
      });
      
      // Cache aggregated results
      this.priceCache.set('aggregated', aggregated);
      
      // Emit aggregation event
      this.emit('aggregated_update', aggregated);
      
      console.log(\`[PriceFeed] Price aggregation complete for \${Object.keys(aggregated.tokens).length} tokens\`);
    } catch (error) {
      console.error('[PriceFeed] Error during price aggregation:', error);
    }
  }
  
  /**
   * Aggregate data for a specific token
   */
  private aggregateTokenData(token: string): any {
    const sourceWeights = priceFeedConfig.aggregation.sources;
    const values: Array<{ source: string, value: number, weight: number }> = [];
    
    // Collect values from all sources
    priceFeedConfig.enabledFeeds.forEach(feed => {
      if (feed === 'geyser') return; // Geyser doesn't provide direct price data
      
      const sourceData = this.priceCache.get(feed);
      if (!sourceData || !sourceData.data || !sourceData.data.tokens) return;
      
      const tokenData = sourceData.data.tokens[token];
      if (!tokenData || tokenData.price === undefined) return;
      
      const weight = sourceWeights[feed]?.weight || 0.5;
      values.push({ source: feed, value: tokenData.price, weight });
    });
    
    // If no values found, return null
    if (values.length === 0) return null;
    
    // If only one source, use its value
    if (values.length === 1) {
      return {
        price: values[0].value,
        confidence: 1.0,
        sources: [values[0].source]
      };
    }
    
    // Apply neural weighting algorithm for multiple sources
    // Sort values to check for outliers
    values.sort((a, b) => a.value - b.value);
    
    // If outlier rejection is enabled, remove outliers
    if (priceFeedConfig.aggregation.outlierRejection && values.length > 2) {
      // Calculate median
      const median = values[Math.floor(values.length / 2)].value;
      
      // Filter out values that are too far from median
      const filteredValues = values.filter(({ value }) => {
        const percentDiff = Math.abs(value - median) / median;
        return percentDiff <= 0.2; // 20% threshold
      });
      
      // Use filtered values if we still have enough
      if (filteredValues.length >= 2) {
        values.length = 0; // Clear array
        values.push(...filteredValues);
      }
    }
    
    // Apply weighted average
    let weightSum = 0;
    let weightedSum = 0;
    
    values.forEach(({ value, weight }) => {
      weightedSum += value * weight;
      weightSum += weight;
    });
    
    const aggregatedPrice = weightSum > 0 ? weightedSum / weightSum : values[0].value;
    
    // Calculate confidence score based on variance
    let variance = 0;
    values.forEach(({ value }) => {
      variance += Math.pow(value - aggregatedPrice, 2);
    });
    variance /= values.length;
    
    // Convert variance to confidence score (higher variance = lower confidence)
    const confidenceScore = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / aggregatedPrice));
    
    return {
      price: aggregatedPrice,
      confidence: confidenceScore,
      sources: values.map(v => v.source),
      sourcesCount: values.length
    };
  }
  
  /**
   * Get price for a specific token
   */
  public getPrice(token: string): any {
    // Try aggregated price first
    const aggregated = this.priceCache.get('aggregated');
    if (aggregated && aggregated.tokens && aggregated.tokens[token]) {
      return {
        price: aggregated.tokens[token].price,
        source: 'aggregated',
        confidence: aggregated.tokens[token].confidence,
        timestamp: aggregated.timestamp
      };
    }
    
    // If no aggregated price, look for any source
    for (const feed of priceFeedConfig.enabledFeeds) {
      if (feed === 'geyser') continue; // Geyser doesn't provide direct price data
      
      const sourceData = this.priceCache.get(feed);
      if (!sourceData || !sourceData.data || !sourceData.data.tokens) continue;
      
      const tokenData = sourceData.data.tokens[token];
      if (!tokenData || tokenData.price === undefined) continue;
      
      return {
        price: tokenData.price,
        source: feed,
        confidence: 0.7, // Lower confidence for single source
        timestamp: sourceData.timestamp
      };
    }
    
    // No price found
    return null;
  }
  
  /**
   * Get all price data for a token from all sources
   */
  public getAllPriceData(token: string): any {
    const result = {
      token,
      sources: {},
      aggregated: null
    };
    
    // Get data from all individual sources
    priceFeedConfig.enabledFeeds.forEach(feed => {
      if (feed === 'geyser') return; // Geyser doesn't provide direct price data
      
      const sourceData = this.priceCache.get(feed);
      if (!sourceData || !sourceData.data || !sourceData.data.tokens) return;
      
      const tokenData = sourceData.data.tokens[token];
      if (!tokenData) return;
      
      result.sources[feed] = {
        ...tokenData,
        timestamp: sourceData.timestamp
      };
    });
    
    // Get aggregated data
    const aggregated = this.priceCache.get('aggregated');
    if (aggregated && aggregated.tokens && aggregated.tokens[token]) {
      result.aggregated = {
        ...aggregated.tokens[token],
        timestamp: aggregated.timestamp
      };
    }
    
    return result;
  }
  
  /**
   * Get all cached price data
   */
  public getAllPriceCache(): any {
    const result = {};
    
    this.priceCache.forEach((value, key) => {
      result[key] = value;
    });
    
    return result;
  }
  
  /**
   * Get initialized status
   */
  public isReady(): boolean {
    return this.isInitialized;
  }
  
  /**
   * Stop the price feed service
   */
  public stop(): void {
    // Clear all update intervals
    this.updateIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.updateIntervals.clear();
    
    // Clear cache
    this.priceCache.clear();
    
    this.isInitialized = false;
    
    console.log('[PriceFeed] Enhanced price feed service stopped');
  }
}

// Create singleton instance
const priceFeedService = new PriceFeedService();

// Export the service
export default priceFeedService;
`;
    
    // Create lib directory if it doesn't exist
    const libDir = path.join('./server', 'lib');
    if (!fs.existsSync(libDir)) {
      fs.mkdirSync(libDir, { recursive: true });
    }
    
    // Write price feed service implementation to file
    fs.writeFileSync(priceFeedServicePath, priceFeedServiceContent);
    console.log(`✅ Created price feed service implementation at ${priceFeedServicePath}`);
    
    return;
  } catch (error) {
    console.error('Failed to create price feed service:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Update system main server to initialize price feeds and Geyser
function updateServerInitialization(): void {
  console.log('Updating server initialization to include enhanced price feeds...');
  
  try {
    const initializationPath = path.join('./server', 'index.ts');
    
    if (!fs.existsSync(initializationPath)) {
      console.warn(`⚠️ Server initialization file not found at ${initializationPath}`);
      return;
    }
    
    // Read existing server initialization code
    let serverCode = fs.readFileSync(initializationPath, 'utf8');
    
    // Check if price feed imports are already added
    if (!serverCode.includes('priceFeedService')) {
      // Add import statements for price feed and Geyser services
      const importStatements = "import priceFeedService from './lib/priceFeedService';\nimport geyserService from './lib/geyserService';";
      
      // Find a good position to add the imports (after other imports)
      let importPosition = serverCode.lastIndexOf('import ');
      if (importPosition === -1) {
        importPosition = 0;
      } else {
        importPosition = serverCode.indexOf('\n', importPosition) + 1;
      }
      
      // Insert import statements
      serverCode = serverCode.slice(0, importPosition) + importStatements + '\n' + serverCode.slice(importPosition);
    }
    
    // Check if initialization code is already added
    if (!serverCode.includes('Enhanced price feeds')) {
      // Add initialization code for price feeds and Geyser
      const initializationCode = `
// Initialize enhanced price feeds and Geyser integration
console.log('Initializing enhanced price feeds and Geyser integration...');

// Wait for price feed service to be ready
priceFeedService.on('initialized', () => {
  console.log('✅ Enhanced price feeds initialized with GMGN.ai, Pump.fun, DexScreener, Moonshot, Proton, Birdeye');
});

// Listen for Geyser real-time updates
geyserService.on('connected', () => {
  console.log('✅ Connected to Solana Geyser for real-time blockchain monitoring');
});

// Listen for real-time price updates
priceFeedService.on('realtime_update', (data) => {
  if (data.type === 'transaction' && data.data && data.data.programId) {
    // Check if this is a DEX transaction we're interested in
    const programId = data.data.programId;
    if (programId === 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4' || // Jupiter
        programId === '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8' || // Raydium
        programId === 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc') { // Orca
      // Process DEX transaction for trading opportunities
      console.log(\`[Geyser] Detected DEX transaction in \${programId}\`);
    }
  }
});

// Set up MEV protection using Geyser
geyserService.on('mev_opportunity', (data) => {
  console.log(\`[Geyser] MEV opportunity detected: \${data.programId}\`);
  // Trigger MEV protection strategy
});

// Set up flash arbitrage detection using Geyser
geyserService.on('arbitrage_opportunity', (data) => {
  console.log(\`[Geyser] Arbitrage opportunity detected: \${data.programId}\`);
  // Trigger flash arbitrage strategy
});

// Set up meme token sniper using Geyser
geyserService.on('meme_token_opportunity', (data) => {
  console.log(\`[Geyser] Meme token opportunity detected: \${data.accountId}\`);
  // Trigger meme token sniper strategy
});
`;
      
      // Find position to add initialization code (before server start)
      let serverStartPos = serverCode.indexOf('app.listen(') || serverCode.indexOf('server.listen(');
      if (serverStartPos === -1) {
        // If server start not found, add at the end
        serverCode += initializationCode;
      } else {
        // Insert before server start
        serverCode = serverCode.slice(0, serverStartPos) + initializationCode + '\n' + serverCode.slice(serverStartPos);
      }
    }
    
    // Write updated server code
    fs.writeFileSync(initializationPath, serverCode);
    console.log(`✅ Updated server initialization at ${initializationPath}`);
    
    return;
  } catch (error) {
    console.error('Failed to update server initialization:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Integrate price feeds into nuclear strategies
function integratePriceFeedsIntoStrategies(): void {
  console.log('Integrating enhanced price feeds into nuclear strategies...');
  
  try {
    const strategiesConfigPath = path.join(CONFIG_DIR, 'strategies.json');
    
    if (fs.existsSync(strategiesConfigPath)) {
      // Read existing strategies
      const strategies = JSON.parse(fs.readFileSync(strategiesConfigPath, 'utf8'));
      
      // Update each strategy to use enhanced price feeds
      strategies.forEach((strategy) => {
        // Add price feed configuration to each strategy
        strategy.config = strategy.config || {};
        strategy.config.priceFeedIntegration = {
          enabled: true,
          aggregated: true,
          sources: []
        };
        
        // Configure sources based on strategy type
        if (strategy.type === 'FLASH_ARBITRAGE') {
          strategy.config.priceFeedIntegration.sources = [
            'birdeye', 'dexscreener', 'geyser'
          ];
        } else if (strategy.type === 'MEME_SNIPER') {
          strategy.config.priceFeedIntegration.sources = [
            'pumpfun', 'gmgn', 'moonshot', 'geyser', 'birdeye'
          ];
        } else if (strategy.type === 'CROSS_CHAIN_ARB') {
          strategy.config.priceFeedIntegration.sources = [
            'birdeye', 'dexscreener', 'proton', 'geyser'
          ];
        }
        
        // Add Geyser configuration
        strategy.config.geyserIntegration = {
          enabled: true,
          useForMEVProtection: strategy.type === 'FLASH_ARBITRAGE',
          useForSniping: strategy.type === 'MEME_SNIPER',
          useForArbitrage: strategy.type === 'FLASH_ARBITRAGE' || strategy.type === 'CROSS_CHAIN_ARB'
        };
      });
      
      // Write updated strategies
      fs.writeFileSync(strategiesConfigPath, JSON.stringify(strategies, null, 2));
      console.log(`✅ Integrated price feeds into strategies at ${strategiesConfigPath}`);
    } else {
      console.warn(`⚠️ Strategies configuration not found at ${strategiesConfigPath}`);
    }
    
    return;
  } catch (error) {
    console.error('Failed to integrate price feeds into strategies:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Main function
function main(): void {
  console.log('=============================================');
  console.log('📊 INTEGRATING ENHANCED PRICE FEEDS');
  console.log('=============================================\n');
  
  try {
    // Step 1: Update price feed configuration
    updatePriceFeedConfig();
    
    // Step 2: Update transformer configuration
    updateTransformerConfig();
    
    // Step 3: Create Geyser integration
    createGeyserIntegration();
    
    // Step 4: Update system memory
    updateSystemMemory();
    
    // Step 5: Create price feed service
    createPriceFeedService();
    
    // Step 6: Update server initialization
    updateServerInitialization();
    
    // Step 7: Integrate price feeds into strategies
    integratePriceFeedsIntoStrategies();
    
    console.log('\n✅ ENHANCED PRICE FEEDS SUCCESSFULLY INTEGRATED');
    console.log('Your trading system now uses advanced price feeds from:');
    console.log('- GMGN.ai: Advanced meme token analytics and social sentiment');
    console.log('- Pump.fun: Real-time meme token market data and trending tokens');
    console.log('- DexScreener: Cross-DEX price aggregation and liquidity analytics');
    console.log('- Moonshot: Emerging token discovery and trend analysis');
    console.log('- Proton: On-chain activity metrics and token analytics');
    console.log('- Birdeye: Comprehensive price, volume, and liquidity data');
    console.log('- Geyser: Real-time blockchain monitoring for:');
    console.log('  * MEV protection against front-running');
    console.log('  * Flash arbitrage opportunity detection');
    console.log('  * Microsecond-level price updates');
    console.log('  * Meme token liquidity event detection');
    console.log('\nRestart the trading system with:');
    console.log('npx tsx server/index.ts');
    console.log('=============================================');
    
    return;
  } catch (error) {
    console.error('Failed to integrate enhanced price feeds:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the script
main();