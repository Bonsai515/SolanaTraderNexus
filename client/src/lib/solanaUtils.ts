// Solana blockchain utilities for the client
import * as web3 from '@solana/web3.js';
import { create } from 'zustand';

// Environment configuration
const getClusterUrl = (): string => {
  // Use custom RPC URL if available
  if (import.meta.env.VITE_INSTANT_NODES_RPC_URL) {
    return import.meta.env.VITE_INSTANT_NODES_RPC_URL;
  }
  
  // Use Helius with API key if available
  if (import.meta.env.VITE_SOLANA_RPC_API_KEY) {
    return `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_SOLANA_RPC_API_KEY}`;
  }
  
  // Fallback to public endpoint
  return web3.clusterApiUrl('mainnet-beta');
};

// Connection utility
const createConnection = (): web3.Connection => {
  const endpoint = getClusterUrl();
  return new web3.Connection(endpoint, 'confirmed');
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
      
      const endpoint = getClusterUrl();
      const connection = createConnection();
      
      // Check if connection is working
      const version = await connection.getVersion();
      
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
    
    return {
      status: 'operational',
      customRpc: customRpcEnabled,
      apiKey: import.meta.env.VITE_SOLANA_RPC_API_KEY || import.meta.env.VITE_INSTANT_NODES_RPC_URL ? true : false,
      network: 'mainnet-beta',
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