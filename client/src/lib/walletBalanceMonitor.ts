// Wallet Balance Monitor
// Provides real-time wallet balance tracking and change notifications

import { create } from 'zustand';

interface WalletBalance {
  address: string;
  balance: number;
  lastUpdate: string;
  changePercent?: number;
}

interface WalletBalanceStore {
  walletBalances: Record<string, WalletBalance>;
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  error: string | null;
  lastMessage: any;
  
  // Actions
  addWallet: (address: string) => void;
  removeWallet: (address: string) => void;
  updateWalletBalance: (address: string, balance: number, lastUpdate: string, changePercent?: number) => void;
  setConnectionStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'error', error?: string) => void;
  setLastMessage: (message: any) => void;
  connect: () => void;
  disconnect: () => void;
}

// WebSocket connection
let ws: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let monitoredWallets: Set<string> = new Set();

export const useWalletBalanceStore = create<WalletBalanceStore>((set, get) => ({
  walletBalances: {},
  isConnected: false,
  connectionStatus: 'disconnected',
  error: null,
  lastMessage: null,
  
  addWallet: (address: string) => {
    monitoredWallets.add(address);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'SUBSCRIBE',
        address
      }));
    }
  },
  
  removeWallet: (address: string) => {
    monitoredWallets.delete(address);
    set((state) => {
      const balances = { ...state.walletBalances };
      delete balances[address];
      return { walletBalances: balances };
    });
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'UNSUBSCRIBE',
        address
      }));
    }
  },
  
  updateWalletBalance: (address: string, balance: number, lastUpdate: string, changePercent?: number) => {
    set((state) => {
      const walletBalances = { ...state.walletBalances };
      walletBalances[address] = {
        address,
        balance,
        lastUpdate,
        changePercent
      };
      return { walletBalances };
    });
  },
  
  setConnectionStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'error', error?: string) => {
    set({ connectionStatus: status, isConnected: status === 'connected', error: error || null });
  },
  
  setLastMessage: (message: any) => {
    set({ lastMessage: message });
  },
  
  connect: () => {
    if (ws) {
      ws.close();
    }
    
    set({ connectionStatus: 'connecting' });
    
    // Determine WebSocket protocol (ws or wss)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/wallet-balance-monitor`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      set({ connectionStatus: 'connected', isConnected: true, error: null });
      
      // Subscribe to all monitored wallets
      monitoredWallets.forEach(address => {
        ws?.send(JSON.stringify({
          type: 'SUBSCRIBE',
          address
        }));
      });
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        set({ lastMessage: message });
        
        if (message.type === 'WALLET_BALANCE_INITIAL' || message.type === 'WALLET_BALANCE_UPDATE') {
          const { address, balance, timestamp, changePercent } = message;
          if (address && balance !== undefined) {
            get().updateWalletBalance(address, balance, timestamp, changePercent);
          }
        }
      } catch (error) {
        console.error('Error processing wallet balance message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      set({ connectionStatus: 'error', isConnected: false, error: 'Connection error' });
    };
    
    ws.onclose = () => {
      set({ connectionStatus: 'disconnected', isConnected: false });
      
      // Auto-reconnect after 5 seconds
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      reconnectTimeout = setTimeout(() => {
        if (get().connectionStatus !== 'connected') {
          get().connect();
        }
      }, 5000);
    };
  },
  
  disconnect: () => {
    if (ws) {
      ws.close();
    }
    
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    set({ connectionStatus: 'disconnected', isConnected: false });
  }
}));

// Auto-connect when the module is imported
setTimeout(() => {
  useWalletBalanceStore.getState().connect();
}, 1000);

// Helper function to format balance
export function formatBalance(balance: number): string {
  if (balance >= 1000000) {
    return `${(balance / 1000000).toFixed(2)}M`;
  } else if (balance >= 1000) {
    return `${(balance / 1000).toFixed(2)}K`;
  } else if (balance < 0.01) {
    return balance.toFixed(6);
  } else {
    return balance.toFixed(2);
  }
}

// Helper function to format change percent
export function formatChangePercent(changePercent: number | undefined): string {
  if (changePercent === undefined) return '0.00%';
  return `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
}

// Helper function to get change class (positive, negative, neutral)
export function getChangeClass(changePercent: number | undefined): string {
  if (changePercent === undefined) return 'text-muted';
  if (changePercent > 0) return 'text-success';
  if (changePercent < 0) return 'text-danger';
  return 'text-muted';
}