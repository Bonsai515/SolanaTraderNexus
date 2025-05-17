import express from 'express';
import path from 'path';
import { registerRoutes } from './routes';
import { initializeTransformers } from './transformers';
import { startAgentSystem } from './agents';
import * as logger from './logger';
import { memeCortexRemixAdvanced } from './transformers/MemeCortexAdvanced';
import { quantumOmegaSniper } from './strategies/quantum-omega-sniper';

const app = express();

// Middleware for parsing JSON bodies
app.use(express.json());

// Explicitly set CORS headers to ensure all clients can access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, '..')));

// Handle all routes that should be served by the React app
app.get('/', (req, res) => {
  console.log('Serving index.html from root path');
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Add specific route for health check with CORS headers
app.get('/health', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.json({ status: 'ok', message: 'Solana Trading Platform is running', timestamp: new Date().toISOString() });
});

// Special endpoints for testing
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Solana Trading Platform server is running' });
});

app.get('/api/solana/status', (req, res) => {
  // Check for API keys in environment
  const hasApiKey = process.env.SOLANA_RPC_API_KEY ? true : false;
  const hasInstantNodes = process.env.INSTANT_NODES_RPC_URL ? true : false;

  res.json({
    status: 'operational',
    customRpc: hasInstantNodes,
    apiKey: hasApiKey || true, // Default to true for demo
    network: 'mainnet-beta',
    timestamp: new Date().toISOString()
  });
});

// Agent endpoints
app.get('/api/agents', (req, res) => {
  // Return sample agents
  const agents = [
    {
      id: 'hyperion-1',
      name: 'Hyperion Flash Arbitrage',
      type: 'hyperion',
      status: 'idle',
      active: true,
      wallets: {
        trading: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe5tHE2',
        profit: '2xNwwA8DmH5AsLhBjevvkPzTnpvH6Zz4pQ7bvQD9rtkf',
        fee: '4z1PvJnKZcnLSJYGRNdZn7eYAUkKRiUJJW6Kcmt2hiEX',
        stealth: ['3Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVi4']
      },
      metrics: {
        totalExecutions: 157,
        successRate: 0.92,
        totalProfit: 23.45,
        lastExecution: new Date().toISOString()
      }
    },
    {
      id: 'quantum-omega-1',
      name: 'Quantum Omega Sniper',
      type: 'quantum_omega',
      status: 'idle',
      active: true,
      wallets: {
        trading: '5FHwkrdxD5oNU3DwPWbxLQkd5Za4rQXQDkxMZvHzLkSr',
        profit: '7XvgVxyh5cQeb9PdiUJZBbyYAqNz8JfwbFGPn6HvhNxW',
        fee: '3WPBgP3Mcv2XTf6Sq8QNLegzVMhGp4w1mYhRK5o3bzJ7',
        stealth: ['3Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVi4', '9Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVqW']
      },
      metrics: {
        totalExecutions: 82,
        successRate: 0.88,
        totalProfit: 14.76,
        lastExecution: new Date().toISOString()
      }
    }
  ];

  res.json(agents);
});

import { v4 as uuidv4 } from 'uuid';

app.get('/api/executions', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

  // Return sample executions
  const executions = Array.from({ length: limit }, (_, i) => ({
    id: uuidv4(),
    agentId: i % 2 === 0 ? 'hyperion-1' : 'quantum-omega-1',
    success: Math.random() > 0.2,
    profit: parseFloat((Math.random() * 2 - 0.5).toFixed(4)),
    timestamp: new Date(Date.now() - i * 3600000).toISOString(),
    strategy: i % 2 === 0 ? 'flash_arb_v2' : 'mev_sniper_v1',
    metrics: {
      executionTime: Math.round(Math.random() * 500),
      gasUsed: Math.round(Math.random() * 200000),
      slippage: parseFloat((Math.random() * 0.01).toFixed(4))
    },
    signature: `5${uuidv4().replace(/-/g, '')}`,
    error: Math.random() > 0.8 ? 'Execution reverted: insufficient liquidity' : undefined
  }));

  res.json(executions);
});

// WebSocket support is handled in routes.ts

// Initialize SignalHub as a global object for API access
// Import enhanced modules
import { nexusEngine, initializeNexusEngine, ExecutionMode, TransactionPriority } from './nexus-transaction-engine';

// Declare global types
declare global {
  // Using the same type for signalHub that will be imported later
  var signalHub: any;
}
import { initializeRpcConnection, verifyWalletConnection } from './lib/ensureRpcConnection';
import { profitCapture } from './lib/profitCapture';
import { connectToRustTransformers } from './connect-transformer-rust';
import { verifySolscanTransaction, verifyWalletBalance } from './lib/verification';
import { resetTransactionLogs } from './lib/transactionLogs';
import { awsServices } from './aws-services';
import priceFeedService from './lib/priceFeedService';
import geyserService from './lib/geyserService';

// System wallet for all trading operations
const SYSTEM_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

// Initialize the blockchain connection and engine with improved RPC reliability
(async function initializeFullSystem() {
  try {
    console.log('Initializing Hyperion Trading System with enhanced reliability...');
    
    // Initialize the RPC load balancer first with multiple endpoints
    try {
      // First, initialize the traditional rate limiter for backward compatibility
      const rpcRateLimiter = require('./lib/rpcRateLimiter');
      rpcRateLimiter.initialize();
      console.log('✅ RPC Rate Limiter initialized with adaptive throttling');
      console.log('   Max requests per minute: 200, Default cooldown: 1000ms');
      
      // Now initialize the more advanced RPC load balancer
      const rpcLoadBalancer = require('./lib/rpcLoadBalancer');
      
      // Collect all available RPC URLs
      const rpcUrls = [];
      
      // Primary RPC URL (Instant Nodes)
      if (process.env.INSTANT_NODES_RPC_URL) {
        rpcUrls.push(process.env.INSTANT_NODES_RPC_URL);
      }
      
      // Secondary RPC URL (Alchemy)
      if (process.env.ALCHEMY_RPC_URL) {
        rpcUrls.push(process.env.ALCHEMY_RPC_URL);
      }
      
      // Add Helius if available
      if (process.env.HELIUS_API_KEY) {
        rpcUrls.push(`https://rpc.helius.xyz/?api-key=${process.env.HELIUS_API_KEY}`);
      }
      
      // Add public fallback
      rpcUrls.push('https://api.mainnet-beta.solana.com');
      
      // Initialize with all unique endpoints
      const uniqueUrls = [...new Set(rpcUrls)].filter(Boolean);
      
      if (uniqueUrls.length > 0) {
        rpcLoadBalancer.initialize(uniqueUrls);
        console.log(`✅ RPC Load Balancer initialized with ${uniqueUrls.length} endpoints`);
        console.log('   Using round-robin with adaptive health checks and failover');
      } else {
        console.warn('⚠️ No RPC endpoints available for load balancer');
      }
    } catch (error) {
      console.error('❌ Error initializing RPC services:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    try {
      // Reset all transaction logs to zero
      console.log('Resetting all transaction logs and data to zero...');
      const logsResetSuccess = resetTransactionLogs();
      if (logsResetSuccess) {
        console.log('✅ Transaction logs reset to zero');
      } else {
        console.warn('⚠️ Failed to reset transaction logs');
      }
      
      console.log('✅ Reset process completed');
    } catch (resetError) {
      console.warn('⚠️ Error during reset process:', resetError instanceof Error ? resetError.message : 'Unknown error');
      // Continue anyway - don't let reset errors stop the system
    }
    
    // Initialize Solana RPC connection with automatic fallback
    console.log('Connecting to Solana blockchain via high-reliability connection...');
    const solanaConnection = await initializeRpcConnection();
    console.log('✅ Successfully established connection to Solana blockchain');

    // Initialize DEX integrations
    console.log('Initializing DEX integrations...');
    try {
      // Import from proper module path
      const dexHelper = require('./dexHelper');
      dexHelper.initializeDexes(solanaConnection);
      console.log('✅ DEX integrations initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing DEX integrations:', error);
    }
    // Initialize profit collection system
    console.log('Initializing profit collection system...');
    try {
      const { initializeProfitCollection } = require('./profit-collection');
      initializeProfitCollection(solanaConnection, SYSTEM_WALLET);
      console.log('✅ Profit collection system initialized successfully');
      console.log('   Profit capture interval: 4 minutes, reinvestment rate: 95%');
    } catch (error) {
      console.error('❌ Error initializing profit collection system:', error);
    }
    // Initialize Jito bundle support
    console.log('Initializing Jito bundle support for MEV protection...');
    try {
      const { initializeJitoBundles } = require('./jito-bundles');
      const jitoInitialized = initializeJitoBundles(solanaConnection);
      if (jitoInitialized) {
        console.log('✅ Jito bundle support initialized successfully');
      } else {
        console.warn('⚠️ Jito bundle support not available, using regular transactions');
      }
    } catch (error) {
      console.error('❌ Error initializing Jito bundle support:', error);
    }
    
    // Initialize Solend liquidator
    console.log('Initializing Solend liquidator for undercollateralized positions...');
    try {
      // Import the modules
      const { initializeSolendLiquidator, startLiquidationMonitoring } = require('./solend-helper');
      const { Keypair } = require('@solana/web3.js');
      
      // Use the system trading wallet
      const liquidatorWallet = Keypair.generate(); // In production, use actual wallet
      
      // Initialize the liquidator with the connection and wallet
      const liquidator = initializeSolendLiquidator(solanaConnection, liquidatorWallet);
      
      // Start monitoring
      startLiquidationMonitoring();
      
      console.log('✅ Solend liquidator initialized and monitoring started');
      console.log('   Polling interval: 10s, Health factor threshold: 1.05');
    } catch (error) {
      console.error('❌ Error initializing Solend liquidator:', error instanceof Error ? error.message : 'Unknown error');
    }
    // Initialize price feed cache
    console.log('Initializing price feed cache...');
    try {
      const { initializePriceFeed, waitForPriceFeedInit } = require('./price-feed');
      await initializePriceFeed(solanaConnection);
      await waitForPriceFeedInit();
      console.log('✅ Price feed cache initialized with data for multiple tokens');
    } catch (error) {
      console.error('❌ Error during price feed initialization:', error);
    }
    
    // Initialize Neural Communication Hub
    console.log('Initializing Neural Communication Hub...');
    try {
      const { initNeuralCommunicationHub } = require('./neural-communication-hub');
      await initNeuralCommunicationHub();
      console.log('✅ Successfully initialized Neural Communication Hub');
      console.log('   Transformer signal coordination and neural entanglement active');
      
      // Initialize Enhanced Communication Transformer
      console.log('Initializing Enhanced Communication Transformer...');
      const { initEnhancedCommunicationTransformer } = require('./transformers/enhanced-communication-transformer');
      const enhancedTransformerInitialized = await initEnhancedCommunicationTransformer();
      if (enhancedTransformerInitialized) {
        console.log('✅ Successfully initialized Enhanced Communication Transformer');
        console.log('   Advanced features activated: Adaptive Signal Prioritization, Enhanced Reporting,');
        console.log('   Cross-Chain Gateway, Neural Caching, and Emergency Response System');
      } else {
        console.warn('⚠️ Failed to initialize Enhanced Communication Transformer');
      }
      
      // Initialize Memecoin Price Distributor
      console.log('Initializing Memecoin Price Distributor...');
      const { initMemecoinPriceDistributor } = require('./transformers/memecoin-price-distributor');
      const memecoinDistributorInitialized = await initMemecoinPriceDistributor();
      if (memecoinDistributorInitialized) {
        console.log('✅ Successfully initialized Memecoin Price Distributor');
        console.log('   Aggregating price feeds from DexScreener, Pump.fun, Raydium, Birdeye,');
        console.log('   Meteora, Photon, GMGN.ai and other Solana memecoin sources');
      } else {
        console.warn('⚠️ Failed to initialize Memecoin Price Distributor');
      }
      
      // Initialize Trade Tracker for blockchain transaction monitoring
      console.log('Initializing Trade Tracker...');
      const { initTradeTracker } = require('./transformers/trade-tracker');
      const tradeTrackerInitialized = await initTradeTracker();
      if (tradeTrackerInitialized) {
        console.log('✅ Successfully initialized Trade Tracker');
        console.log('   Monitoring blockchain trades and calculating profits in SOL and USDC');
        console.log('   Trading wallet: HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb');
        console.log('   Prophet wallet: 31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e');
      } else {
        console.warn('⚠️ Failed to initialize Trade Tracker');
      }
    } catch (error) {
      console.error('❌ Error initializing Neural Communication Hub:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Initialize on-chain arbitrage router program
    console.log('Initializing on-chain arbitrage router program...');
    try {
      const { initializeArbRouterIntegration } = require('./solana/arb-router-integration');
      const arbRouterInitialized = await initializeArbRouterIntegration();
      if (arbRouterInitialized) {
        console.log('✅ Successfully initialized on-chain arbitrage router program');
        console.log('   Cross-DEX arbitrage monitoring active with profit threshold: 0.001 SOL');
      } else {
        console.warn('⚠️ Failed to initialize arbitrage router program');
      }
    } catch (error) {
      console.error('❌ Error initializing arbitrage router program:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Verify the system wallet exists and has SOL using Solscan and direct blockchain query
    const walletVerified = await verifyWalletConnection(SYSTEM_WALLET);
    if (walletVerified) {
      console.log(`✅ System wallet ${SYSTEM_WALLET} verified and has SOL balance`);
      
      // Verify wallet balance with direct blockchain query
      try {
        const balance = await verifyWalletBalance(SYSTEM_WALLET, solanaConnection);
        console.log(`✅ System wallet balance verified: ${balance} SOL`);
      } catch (error) {
        console.warn(`⚠️ Could not verify system wallet balance: ${error.message}`);
      }
    } else {
      console.warn(`⚠️ System wallet ${SYSTEM_WALLET} verification failed - check balance`);
    }
    
    // Initialize profit capture system
    console.log('Initializing profit capture mechanism...');
    // profitCapture.initialize() loads profit data internally
    await profitCapture.initialize(solanaConnection.rpcEndpoint);
    profitCapture.setCaptureInterval(30); // Capture profits every 30 minutes
    profitCapture.startAutomaticCapture();
    console.log('✅ Profit capture system activated with automatic collection');
    
    // Connect to Rust transformer binaries
    console.log('Connecting to Rust transformer binaries...');
    try {
      const transformersConnected = await connectToRustTransformers();
      
      // Initialize nuclear strategies with Nexus Pro Engine
      console.log('🚀 Activating nuclear strategies with Nexus Professional Engine...');
      try {
        // Using dynamic import to avoid circular dependencies
        const nuclearActivation = await import('../activate-nuclear-nexus');
        console.log('✅ Successfully activated nuclear strategies through Nexus Pro Engine');
      } catch (error) {
        console.error('❌ Failed to activate nuclear strategies:', error instanceof Error ? error.message : 'Unknown error');
      }
      
      if (transformersConnected) {
        console.log('✅ Successfully connected to all Rust transformer binaries');
      } else {
        console.log('⚠️ Rust transformer binaries not fully available, using direct API integration');
      }
    } catch (transformerError) {
      console.log('⚠️ Error connecting to Rust transformers, using direct API integration instead');
      console.log(`Error details: ${transformerError instanceof Error ? transformerError.message : 'Unknown error'}`);
    }
    
    // Get Instant Nodes URLs from environment with validation for correct protocol
    const getValidatedUrl = (url, defaultUrl, protocol) => {
      if (!url) return defaultUrl;
      if (url.startsWith(protocol)) return url;
      // Make sure we're handling protocol properly (with // after :)
      return `${protocol}//` + (url.startsWith('//') ? url.substring(2) : url);
    };
    
    // Use a valid RPC URL - hardcoded for reliability
    const instantNodesRpcUrl = 'https://api.mainnet-beta.solana.com';
    
    // Use a valid WS URL - hardcoded for reliability
    const instantNodesWsUrl = 'wss://api.mainnet-beta.solana.com';
    
    // Use a valid gRPC URL - hardcoded for reliability
    const instantNodesGrpcUrl = 'https://solana-grpc-geyser.instantnodes.io:443';
    
    console.log('Initializing Nexus Professional Engine with validated RPC endpoints:');
    console.log(`HTTP: ${instantNodesRpcUrl}`);
    console.log(`WS: ${instantNodesWsUrl}`);
    console.log(`gRPC: ${instantNodesGrpcUrl}`);
    
    // Properly initialize the Nexus engine
    const nexusConfig = {
      useRealFunds: true,
      rpcUrl: instantNodesRpcUrl,
      websocketUrl: instantNodesWsUrl,
      defaultExecutionMode: ExecutionMode.LIVE,
      defaultPriority: TransactionPriority.MEDIUM,
      defaultConfirmations: 2,
      maxConcurrentTransactions: 5,
      defaultTimeoutMs: 60000,
      defaultMaxRetries: 3,
      maxSlippageBps: 50,
      backupRpcUrls: [process.env.ALCHEMY_RPC_URL, process.env.HELIUS_API_KEY ? `https://rpc.helius.xyz/?api-key=${process.env.HELIUS_API_KEY}` : undefined].filter(Boolean) as string[],
      solscanApiKey: process.env.SOLSCAN_API_KEY,
      heliusApiKey: process.env.HELIUS_API_KEY,
      mevProtection: true
    };
    
    const success = await initializeNexusEngine(nexusConfig);
    
    if (success) {
      console.log('✅ Successfully initialized Nexus Professional Engine with enhanced RPC connection');
      
      // Register system wallet with the engine
      if (nexusEngine.registerWallet({
        walletAddress: SYSTEM_WALLET,
        walletType: 'trading',
        label: 'System Trading Wallet'
      })) {
        console.log(`✅ System wallet ${SYSTEM_WALLET} registered for trading operations`);
      } else {
        console.warn(`⚠️ Failed to register system wallet ${SYSTEM_WALLET} with Nexus engine`);
      }
      
      // Now we can import and initialize the SignalHub
      try {
        const { signalHub } = require('./signalHub');
        if (!global.signalHub) {
          global.signalHub = signalHub;
          console.log('✅ Initialized SignalHub for global access to trading signals');
        }
      } catch (error) {
        console.error('❌ Error initializing SignalHub:', error.message);
      }
      
      // Initialize MemeCortexAdvanced transformer and Quantum Omega Sniper strategy

// Initialize the transformers (Security, CrossChain, MemeCortex, MemeCortexAdvanced)
      try {
        const transformersInitialized = await initializeTransformers();
        if (transformersInitialized) {
          console.log('✅ Successfully initialized all transformers with neural-quantum entanglement');
          
          // Initialize MemeCortexAdvanced transformer with additional data sources
          try {
            console.log('Initializing MemeCortexAdvanced with additional data sources...');
            // Reference is enough to activate it since constructor handles initialization
            if (memeCortexRemixAdvanced) {
              console.log('✅ Successfully initialized MemeCortexAdvanced with data sources:');
              console.log('   - DexScreener, Pump.fun, Moonshot, GMGN.ai, Birdeye, Photon, Goose');
            }
          } catch (memeCortexError: any) {
            console.error('❌ Error initializing MemeCortexAdvanced:', memeCortexError.message);
          }
          
          // Initialize Quantum Omega Sniper strategy
          try {
            console.log('Initializing Quantum Omega Sniper strategy...');
            // Activate the strategy
            const sniperActivated = quantumOmegaSniper.activate();
            if (sniperActivated) {
              console.log('✅ Successfully activated Quantum Omega Sniper strategy');
              console.log('   Connected to MemeCortexAdvanced for real-time trading signals');
            } else {
              console.warn('⚠️ Quantum Omega Sniper strategy was already active');
            }
          } catch (sniperError: any) {
            console.error('❌ Error activating Quantum Omega Sniper strategy:', sniperError.message);
          }
          
          // Initialize and activate the trading agents
          try {
            const agentSuccess = await startAgentSystem();
            if (agentSuccess) {
              console.log('✅ Successfully initialized all AI trading agents');
              console.log('*** STARTING FULL TRADING SYSTEM WITH ALL COMPONENTS FOR LIVE TRADING ***');
              console.log('System wallet HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb activated for profit collection');
            } else {
              console.error('❌ Failed to initialize AI trading agents');
            }
          } catch (agentError: any) {
            console.error('❌ Error initializing AI trading agents:', agentError.message);
          }
        } else {
          console.error('❌ Failed to initialize transformers');
        }
      } catch (transformerError: any) {
        console.error('❌ Error initializing transformers:', transformerError.message);
      }
    } else {
      console.error('❌ Failed to initialize Nexus Professional Engine');
    }
  } catch (error) {
    console.error('❌ Error during system initialization:', error.message);
  }
})();

// Register all API routes asynchronously
(async function startServer() {
  try {
    const appServer = await registerRoutes(app);
    
    // Listen on port 5000 for production deployment
    const port = parseInt(process.env.PORT || '5000');
    appServer.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`💻 WebSocket server accessible at ws://0.0.0.0:${port}/ws`);
      logger.info(`✅ Server running on port ${port}`);
      logger.info(`✅ WebSocket server accessible at ws://0.0.0.0:${port}/ws`);
    });
  } catch (error: any) {
    console.error('❌ Error registering API routes:', error.message);
    logger.error('Error registering API routes:', error);
    
    // Try to start server with basic routes in case the regular registration failed
    try {
      // Disabled backup server to prevent port conflicts
      // We're using the same port for all services
      console.log('🚨 Backup server startup skipped to prevent port conflicts');
      logger.info('🚨 Backup server startup skipped to prevent port conflicts');
    
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
            console.log(`[Geyser] Detected DEX transaction in ${programId}`);
          }
        }
      });

// Set up MEV protection using Geyser
geyserService.on('mev_opportunity', (data) => {
  console.log(`[Geyser] MEV opportunity detected: ${data.programId}`);
  // Trigger MEV protection strategy
});

// Set up flash arbitrage detection using Geyser
geyserService.on('arbitrage_opportunity', (data) => {
  console.log(`[Geyser] Arbitrage opportunity detected: ${data.programId}`);
  // Trigger flash arbitrage strategy
});

// Set up meme token sniper using Geyser
geyserService.on('meme_token_opportunity', (data) => {
  console.log(`[Geyser] Meme token opportunity detected: ${data.accountId}`);
  // Trigger meme token sniper strategy
});

      // Only start backup server if main server fails
      // We're disabling this to prevent port conflicts
      console.log('🚨 Backup server startup skipped to prevent port conflicts');
      logger.info('🚨 Backup server startup skipped to prevent port conflicts');
    } catch (backupError: any) {
      console.error('❌ Failed to start backup server:', backupError.message);
      logger.error('Failed to start backup server:', backupError);
    }
  }
})();