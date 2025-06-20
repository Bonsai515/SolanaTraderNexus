// Solana blockchain utilities for the client
import * as web3 from '@solana/web3.js';
import { create } from 'zustand';

// Environment configuration
const getClusterUrl = (useWebSocket: boolean = false): string => {
  // Use custom WebSocket URL if available and WebSocket is requested
  if (useWebSocket && import.meta.env.VITE_INSTANT_NODES_WS_URL) {
    let endpoint = String(import.meta.env.VITE_INSTANT_NODES_WS_URL);
    
    // Ensure URL starts with wss:// or ws://
    if (!endpoint.startsWith('wss://') && !endpoint.startsWith('ws://')) {
      endpoint = 'wss://' + endpoint;
    }
    
    return endpoint;
  }
  
  // Use custom RPC URL if available
  if (import.meta.env.VITE_INSTANT_NODES_RPC_URL) {
    let endpoint = String(import.meta.env.VITE_INSTANT_NODES_RPC_URL);
    
    // Ensure URL starts with http:// or https://
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = 'https://' + endpoint;
    }
    
    return endpoint;
  }
  
  // Use Helius with API key if available
  if (import.meta.env.VITE_SOLANA_RPC_API_KEY) {
    return `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_SOLANA_RPC_API_KEY}`;
  }
  
  // Fallback to public endpoint
  return web3.clusterApiUrl('mainnet-beta');
};

// Connection utility
const createConnection = (preferWebSocket: boolean = true): web3.Connection => {
  // For account and program subscriptions, prefer WebSocket if available
  const endpoint = preferWebSocket ? getClusterUrl(true) : getClusterUrl(false);
  
  // Configure connection options
  const commitmentLevel: web3.Commitment = 'confirmed';
  const connectionConfig: web3.ConnectionConfig = {
    commitment: commitmentLevel,
    confirmTransactionInitialTimeout: 60000, // 60 seconds
    disableRetryOnRateLimit: false,
    wsEndpoint: preferWebSocket ? endpoint : undefined
  };
  
  return new web3.Connection(
    preferWebSocket ? getClusterUrl(false) : endpoint, // Always use HTTP for the main endpoint
    connectionConfig
  );
};

// Solana store state
interface SolanaState {
  connection: web3.Connection | null;
  connected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  connectionError: string | null;
  customRpcEnabled: boolean;
  
  // Actions
  connect: () => Promise<boolean>;
  disconnect: () => void;
  getConnectionInfo: () => Promise<{
    status: string;
    customRpc: boolean;
    apiKey: boolean;
    network: string;
    timestamp: string;
  }>;
  getLatestBlockhash: () => Promise<web3.BlockhashWithExpiryBlockHeight>;
  sendTransaction: (transaction: web3.Transaction, signers: web3.Signer[]) => Promise<string>;
}

// Create Solana store
export const useSolanaStore = create<SolanaState>((set, get) => ({
  connection: null,
  connected: false,
  connectionStatus: 'disconnected',
  connectionError: null,
  customRpcEnabled: false,
  
  // Connect to Solana network
  connect: async () => {
    try {
      set({ connectionStatus: 'connecting' });
      
      // Try WebSocket connection first
      let connection: web3.Connection;
      let isWebSocketConnected = false;
      
      try {
        connection = createConnection(true); // Try with WebSocket
        await connection.getVersion();
        isWebSocketConnected = true;
        console.log("Connected to Solana via WebSocket endpoint");
      } catch (wsError) {
        console.warn("WebSocket connection failed, falling back to HTTP:", wsError);
        // Fallback to HTTP-only connection
        connection = createConnection(false);
        await connection.getVersion();
      }
      
      const endpoint = getClusterUrl();
      
      set({
        connection,
        connected: true,
        connectionStatus: 'connected',
        connectionError: null,
        customRpcEnabled: endpoint !== web3.clusterApiUrl('mainnet-beta'),
      });
      
      return true;
    } catch (error) {
      console.error('Failed to connect to Solana:', error);
      
      set({
        connection: null,
        connected: false,
        connectionStatus: 'error',
        connectionError: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return false;
    }
  },
  
  // Disconnect from Solana network
  disconnect: () => {
    set({
      connection: null,
      connected: false,
      connectionStatus: 'disconnected',
      connectionError: null,
    });
  },
  
  // Get connection information
  getConnectionInfo: async () => {
    const { connected, connection, customRpcEnabled } = get();
    
    if (!connected || !connection) {
      await get().connect();
    }
    
    // Check if we're currently using WebSocket
    const hasWebSocket = Boolean(
      connection && 
      // @ts-ignore - Access internal property to check WebSocket status
      connection._rpcWebSocket && 
      // @ts-ignore
      connection._rpcWebSocket._ws && 
      // @ts-ignore
      connection._rpcWebSocket._ws.readyState === 1 // 1 = OPEN in WebSocket standard
    );
    
    // Try to get cluster version for additional info
    let version = "unknown";
    try {
      if (connection) {
        const versionInfo = await connection.getVersion();
        version = versionInfo["solana-core"];
      }
    } catch (e) {
      console.warn("Failed to get Solana version:", e);
    }
    
    return {
      status: 'operational',
      customRpc: customRpcEnabled,
      apiKey: import.meta.env.VITE_SOLANA_RPC_API_KEY || import.meta.env.VITE_INSTANT_NODES_RPC_URL ? true : false,
      network: 'mainnet-beta',
      websocket: hasWebSocket,
      version,
      timestamp: new Date().toISOString(),
    };
  },
  
  // Get latest blockhash
  getLatestBlockhash: async () => {
    const { connected, connection } = get();
    
    if (!connected || !connection) {
      await get().connect();
    }
    
    const conn = get().connection;
    if (!conn) {
      throw new Error('Solana connection not available');
    }
    
    return await conn.getLatestBlockhash();
  },
  
  // Send transaction
  sendTransaction: async (transaction: web3.Transaction, signers: web3.Signer[]) => {
    const { connected, connection } = get();
    
    if (!connected || !connection) {
      await get().connect();
    }
    
    const conn = get().connection;
    if (!conn) {
      throw new Error('Solana connection not available');
    }
    
    // Get latest blockhash
    const { blockhash } = await conn.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign transaction
    transaction.sign(...signers);
    
    // Send transaction
    const signature = await conn.sendRawTransaction(transaction.serialize());
    
    // Wait for confirmation
    await conn.confirmTransaction(signature);
    
    return signature;
  },
}));

// Helper functions
export const getSolanaConnection = async (): Promise<web3.Connection> => {
  const { connected, connection, connect } = useSolanaStore.getState();
  
  if (!connected || !connection) {
    await connect();
  }
  
  const conn = useSolanaStore.getState().connection;
  if (!conn) {
    throw new Error('Solana connection not available');
  }
  
  return conn;
};

export default useSolanaStore;