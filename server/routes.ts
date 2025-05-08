import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
import { createSolanaConnection } from "./solana/connection";
import { setupTransactionRoutes } from "./solana/transactions";
import { setupWalletRoutes } from "./solana/wallet";
import { setupTradingAgentRoutes } from "./agents/tradingAgent";
import { setupStrategyRoutes } from "./agents/strategyManager";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Initialize Solana connection
  const solanaConnection = createSolanaConnection();

  // Set up routes with prefixes
  app.use('/api/transactions', setupTransactionRoutes(solanaConnection));
  app.use('/api/wallet', setupWalletRoutes(solanaConnection));
  app.use('/api/ai', setupTradingAgentRoutes());
  app.use('/api/strategies', setupStrategyRoutes());

  // System status endpoint
  app.get('/api/system/status', (req, res) => {
    res.json({
      blockchain: true,
      transactionEngine: true,
      aiAgents: true,
      lastUpdated: new Date().toISOString()
    });
  });

  // Transformers endpoint
  app.get('/api/transformers', (req, res) => {
    res.json({
      transformers: [
        {
          name: "Market Data Transformer",
          description: "Real-time price analysis",
          icon: "analytics",
          iconColor: "primary",
          status: "Active"
        },
        {
          name: "Signal Generator",
          description: "Trading opportunity detection",
          icon: "radar",
          iconColor: "info",
          status: "Active"
        },
        {
          name: "Strategy Optimizer",
          description: "Performance improvement",
          icon: "tune",
          iconColor: "success",
          status: "Active"
        },
        {
          name: "Risk Manager",
          description: "Trade safety controls",
          icon: "health_and_safety",
          iconColor: "warning",
          status: "Active"
        }
      ]
    });
  });

  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    // Send initial system status
    const initialStatus = JSON.stringify({
      type: 'status',
      components: {
        blockchain: true,
        transactionEngine: true,
        aiAgents: true
      }
    });
    ws.send(initialStatus);

    // Send simulated transaction update every 30 seconds
    const transactionInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'transaction',
          id: generateId(),
          timestamp: new Date().toISOString()
        }));
      }
    }, 30000);

    // Handle disconnection
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
      clearInterval(transactionInterval);
    });

    // Handle messages from client
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received message:', data);
        
        // Process message based on type
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });
  });

  // Broadcast function for sending messages to all connected clients
  const broadcast = (data: any) => {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Expose the broadcast function for other modules
  (app as any).wsBroadcast = broadcast;

  return httpServer;
}

// Helper function to generate random IDs
function generateId() {
  return Math.random().toString(36).substring(2, 15);
}
