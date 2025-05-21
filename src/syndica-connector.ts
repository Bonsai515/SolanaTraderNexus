// Direct Syndica Connection
import { Connection, PublicKey } from '@solana/web3.js';

// Create connection to Syndica
export const connection = new Connection('https://solana-api.syndica.io/rpc', {
  commitment: 'confirmed',
  disableRetryOnRateLimit: false,
  confirmTransactionInitialTimeout: 60000,
});

// Always use the HP wallet
export const WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

export const getConnection = () => connection;
export const getWallet = () => WALLET_ADDRESS;

// Force override all RPC functions to use this connection
export default connection;
