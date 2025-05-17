// Global type declarations for the Solana Trading Platform

// CSS modules declaration
declare module "*.module.css";

// Ensure any missing modules have type declarations
declare module "microqhc";
declare module "memecortexremix";
declare module "security";
declare module "crosschain";

// Add interfaces for neural network components
interface SignalType {
  id: string;
  transformer: string;
  type: string;
  token: string;
  confidence: number;
  timestamp: number;
}

interface NeuralConnection {
  from: string;
  to: string;
  status: 'active' | 'inactive';
}

interface TransactionType {
  id: string;
  sourceToken: string;
  targetToken: string; 
  amount: number;
  strategy: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: number;
}

// Declare module augmentations for missing/incomplete types
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT?: string;
    SOLANA_RPC_URL?: string;
    COINGECKO_API_KEY?: string;
    JUPITER_API_KEY?: string;
  }
}