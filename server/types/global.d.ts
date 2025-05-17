// Global type declarations
declare module "*.module.css";
declare module "@project-serum/serum";
declare module "@project-serum/anchor";

// Add specific types for untyped libraries
declare module "microqhc" {
  export interface MicroQHCConfig {
    version: string;
    endpoint: string;
    apiKey?: string;
    mode: 'simulation' | 'production';
  }
  
  export interface MicroQHCSignal {
    id: string;
    token: string;
    confidence: number;
    direction: 'bullish' | 'bearish' | 'neutral';
    timestamp: number;
  }
  
  export class MicroQHC {
    constructor(config: MicroQHCConfig);
    generateSignals(): Promise<MicroQHCSignal[]>;
    process(signal: MicroQHCSignal): Promise<boolean>;
  }
  
  export default MicroQHC;
}

declare module "memecortexremix" {
  export interface MemeCortexConfig {
    version: string;
    endpoint: string;
    apiKey?: string;
    mode: 'simulation' | 'production';
  }
  
  export interface MemeCortexSignal {
    id: string;
    token: string;
    confidence: number;
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: 'weak' | 'medium' | 'strong';
    timestamp: number;
  }
  
  export class MemeCortex {
    constructor(config: MemeCortexConfig);
    analyzeToken(token: string): Promise<MemeCortexSignal>;
    scanMarket(): Promise<MemeCortexSignal[]>;
  }
  
  export default MemeCortex;
}

declare module "security" {
  export interface SecurityConfig {
    version: string;
    endpoint: string;
    apiKey?: string;
  }
  
  export interface SecurityCheck {
    token: string;
    safe: boolean;
    score: number;
    issues?: string[];
  }
  
  export class Security {
    constructor(config: SecurityConfig);
    checkToken(token: string): Promise<SecurityCheck>;
  }
  
  export default Security;
}

declare module "crosschain" {
  export interface CrossChainConfig {
    version: string;
    endpoint: string;
    apiKey?: string;
  }
  
  export interface CrossChainOpportunity {
    id: string;
    sourceChain: string;
    targetChain: string;
    sourceToken: string;
    targetToken: string;
    profit: number;
    confidence: number;
    timestamp: number;
  }
  
  export class CrossChain {
    constructor(config: CrossChainConfig);
    scanOpportunities(): Promise<CrossChainOpportunity[]>;
  }
  
  export default CrossChain;
}

// Add missing globals
interface Window {
  solana?: any;
}

// Declare garbage collection for Node.js
declare namespace NodeJS {
  interface Global {
    gc?: () => void;
  }
}

// For Solana specific missing types
declare namespace Solana {
  interface Transaction {
    id: string;
    instructions: any[];
    recentBlockhash?: string;
    feePayer: any;
    signatures: any[];
  }
}