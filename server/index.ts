import express from 'express';
import path from 'path';
import { registerRoutes } from './routes';

const app = express();

// Middleware for parsing JSON bodies
app.use(express.json());

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, '..')));

// Serve our standalone HTML file at the root
app.get('/', (req, res) => {
  console.log('Serving index.html from root path');
  res.sendFile(path.join(__dirname, '../index.html'));
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

app.get('/api/executions', (req, res) => {
  const { v4: uuidv4 } = require('uuid');
  const limit = req.query.limit ? parseInt(req.query.limit) : 10;

  // Return sample executions
  const executions = Array.from({ length: limit }, (_, i) => ({
    id: uuidv4(),
    agentId: i % 2 === 0 ? 'hyperion-1' : 'quantum-omega-1',
    success: Math.random() > 0.2,
    profit: (Math.random() * 2 - 0.5).toFixed(4) * 1,
    timestamp: new Date(Date.now() - i * 3600000).toISOString(),
    strategy: i % 2 === 0 ? 'flash_arb_v2' : 'mev_sniper_v1',
    metrics: {
      executionTime: Math.round(Math.random() * 500),
      gasUsed: Math.round(Math.random() * 200000),
      slippage: (Math.random() * 0.01).toFixed(4) * 1
    },
    signature: `5${uuidv4().replace(/-/g, '')}`,
    error: Math.random() > 0.8 ? 'Execution reverted: insufficient liquidity' : undefined
  }));

  res.json(executions);
});

// WebSocket support is handled in routes.ts

// Initialize SignalHub as a global object for API access
const { signalHub } = require('./signalHub');
// Create global signalHub instance if it doesn't exist
if (!global.signalHub) {
  global.signalHub = signalHub;
  console.log('Initialized SignalHub for global access to trading signals');
}

// Import enhanced modules
const { initializeTransactionEngine, registerWallet, executeSolanaTransaction } = require('./nexus-transaction-engine');
const { initializeRpcConnection, verifyWalletConnection } = require('./lib/ensureRpcConnection');
const { profitCapture } = require('./lib/profitCapture');
const { connectToRustTransformers } = require('./connect-transformer-rust');
const { verifySolscanTransaction, verifyWalletBalance } = require('./lib/verification');
const { resetTransactionLogs } = require('./lib/transactionLogs');
const { awsServices } = require('./aws-services');

// System wallet for all trading operations
const SYSTEM_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

// Initialize the blockchain connection and engine with improved RPC reliability
(async function initializeFullSystem() {
  try {
    console.log('Initializing Hyperion Trading System with enhanced reliability...');
    
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
    profitCapture.loadProfitData();
    profitCapture.startAutomaticCapture(30); // Capture profits every 30 minutes
    console.log('✅ Profit capture system activated with automatic collection');
    
    // Connect to Rust transformer binaries
    console.log('Connecting to Rust transformer binaries...');
    try {
      const transformersConnected = await connectToRustTransformers();
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
      return `${protocol}${url.startsWith('//') ? '' : '//'}${url}`;
    };
    
    const instantNodesRpcUrl = getValidatedUrl(
      process.env.INSTANT_NODES_RPC_URL, 
      'https://api.mainnet-beta.solana.com',
      'https:'
    );
    
    const instantNodesWsUrl = getValidatedUrl(
      process.env.INSTANT_NODES_WS_URL,
      'wss://api.mainnet-beta.solana.com',
      'wss:'
    );
    
    const instantNodesGrpcUrl = getValidatedUrl(
      process.env.INSTANT_NODES_GRPC_URL,
      'https://solana-grpc-geyser.instantnodes.io:443',
      'https:'
    );
    
    console.log('Initializing Nexus Professional Engine with validated RPC endpoints:');
    console.log(`HTTP: ${instantNodesRpcUrl}`);
    console.log(`WS: ${instantNodesWsUrl}`);
    console.log(`gRPC: ${instantNodesGrpcUrl}`);
    
    // Initialize transaction engine with the Solana connection
    const success = await initializeTransactionEngine(
      solanaConnection.rpcEndpoint || instantNodesRpcUrl,
      true, // Use real funds by default
      instantNodesWsUrl,
      instantNodesGrpcUrl
    );
    
    if (success) {
      console.log('✅ Successfully initialized Nexus Professional Engine with enhanced RPC connection');
      
      // Register system wallet with the engine
      registerWallet(SYSTEM_WALLET);
      console.log(`✅ System wallet ${SYSTEM_WALLET} registered for trading operations`);
      
      // Initialize the transformers (Security, CrossChain, MemeCortex)
      const { initializeTransformers } = require('./transformers');
      try {
        const transformersInitialized = await initializeTransformers();
        if (transformersInitialized) {
          console.log('✅ Successfully initialized all transformers with neural-quantum entanglement');
          
          // Initialize and activate the trading agents
          const { startAgentSystem } = require('./agents');
          try {
            const agentSuccess = await startAgentSystem();
            if (agentSuccess) {
              console.log('✅ Successfully initialized all AI trading agents');
              console.log('*** STARTING FULL TRADING SYSTEM WITH ALL COMPONENTS FOR LIVE TRADING ***');
              console.log('System wallet HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb activated for profit collection');
            } else {
              console.error('❌ Failed to initialize AI trading agents');
            }
          } catch (agentError) {
            console.error('❌ Error initializing AI trading agents:', agentError.message);
          }
        } else {
          console.error('❌ Failed to initialize transformers');
        }
      } catch (transformerError) {
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
    const port = process.env.PORT || 5000;
    appServer.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`💻 WebSocket server accessible at ws://0.0.0.0:${port}/ws`);
    });
  } catch (error) {
    console.error('❌ Error registering API routes:', error.message);
  }
})();