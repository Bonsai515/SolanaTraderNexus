import { Connection, PublicKey, Transaction, TransactionInstruction, Commitment } from '@solana/web3.js';
import rateLimiter from '../rpc/rateLimiter';

/**
 * Helius Service
 * Provides enhanced Solana RPC capabilities through Helius API
 */
export class HeliusService {
  private static instance: HeliusService;
  private apiKey: string;
  private rpcUrl: string;
  private connection: Connection | null = null;
  private webhookUrl: string | null = null;
  
  private constructor() {
    // Try to get the API key from multiple places
    this.apiKey = import.meta.env.VITE_HELIUS_API_KEY || process.env.HELIUS_API_KEY || '';
    
    // Only set RPC URL if we have a valid API key
    if (this.apiKey && this.apiKey.length > 10) {
      this.rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
      this.initializeConnection();
    } else {
      this.apiKey = '';
      this.rpcUrl = '';
      console.warn('Helius API key not found or invalid. Enhanced RPC capabilities will not be available.');
    }
  }
  
  /**
   * Get the HeliusService instance (singleton)
   */
  public static getInstance(): HeliusService {
    if (!HeliusService.instance) {
      HeliusService.instance = new HeliusService();
    }
    
    return HeliusService.instance;
  }
  
  /**
   * Initialize the Solana connection with Helius RPC
   */
  private initializeConnection(): void {
    if (!this.apiKey) {
      return;
    }
    
    try {
      this.connection = new Connection(this.rpcUrl, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000 // 60 seconds
      });
      
      console.log('Successfully initialized Helius RPC connection');
    } catch (error) {
      console.error('Failed to initialize Helius RPC connection:', error);
      this.connection = null;
    }
  }
  
  /**
   * Check if the service is available
   */
  public isAvailable(): boolean {
    return !!this.connection;
  }
  
  /**
   * Get the Solana connection
   */
  public getConnection(commitment: Commitment = 'confirmed'): Connection {
    if (!this.connection) {
      throw new Error('Helius RPC connection not available');
    }
    
    return this.connection;
  }
  
  /**
   * Get token balances for an address
   */
  public async getTokenBalances(address: string): Promise<TokenBalance[]> {
    if (!this.isAvailable()) {
      throw new Error('Helius service not available');
    }
    
    try {
      // Queue this request with rate limiting
      const response = await rateLimiter.queueHighPriority(async () => {
        const result = await fetch(`https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${this.apiKey}`);
        
        if (!result.ok) {
          throw new Error(`Helius API error: ${result.status} ${await result.text()}`);
        }
        
        return await result.json();
      });
      
      // Transform the response to our TokenBalance format
      const balances: TokenBalance[] = [];
      
      if (response.tokens) {
        for (const token of response.tokens) {
          balances.push({
            mint: token.mint,
            amount: token.amount,
            decimals: token.decimals,
            tokenName: token.tokenName || '',
            tokenSymbol: token.tokenSymbol || '',
            logoUrl: token.logoUrl || ''
          });
        }
      }
      
      return balances;
    } catch (error) {
      console.error('Error fetching token balances from Helius:', error);
      throw error;
    }
  }
  
  /**
   * Get transaction history for an address
   */
  public async getTransactionHistory(address: string, limit: number = 10): Promise<TransactionInfo[]> {
    if (!this.isAvailable()) {
      throw new Error('Helius service not available');
    }
    
    try {
      // Queue this request with rate limiting
      const response = await rateLimiter.queueHighPriority(async () => {
        const result = await fetch(`https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${this.apiKey}&limit=${limit}`);
        
        if (!result.ok) {
          throw new Error(`Helius API error: ${result.status} ${await result.text()}`);
        }
        
        return await result.json();
      });
      
      // Transform the response to our TransactionInfo format
      const transactions: TransactionInfo[] = [];
      
      for (const tx of response) {
        transactions.push({
          signature: tx.signature,
          timestamp: new Date(tx.timestamp * 1000),
          slot: tx.slot,
          fee: tx.fee,
          status: tx.err ? 'failed' : 'confirmed',
          type: this.determineTransactionType(tx),
          senders: tx.feePayer ? [tx.feePayer] : [],
          receivers: [],
          tokenTransfers: tx.tokenTransfers || []
        });
      }
      
      return transactions;
    } catch (error) {
      console.error('Error fetching transaction history from Helius:', error);
      throw error;
    }
  }
  
  /**
   * Get pending transactions for an address
   */
  public async getPendingTransactions(address: string): Promise<TransactionInfo[]> {
    if (!this.isAvailable()) {
      throw new Error('Helius service not available');
    }
    
    try {
      // Queue this request with rate limiting
      const response = await rateLimiter.queueHighPriority(async () => {
        // Use Helius mempool API
        const result = await fetch(`https://api.helius.xyz/v0/addresses/${address}/pending-transactions?api-key=${this.apiKey}`);
        
        if (!result.ok) {
          throw new Error(`Helius API error: ${result.status} ${await result.text()}`);
        }
        
        return await result.json();
      });
      
      // Transform the response to our TransactionInfo format
      const transactions: TransactionInfo[] = [];
      
      for (const tx of response) {
        transactions.push({
          signature: tx.signature,
          timestamp: new Date(),
          slot: 0,
          fee: tx.fee || 0,
          status: 'pending',
          type: 'unknown',
          senders: tx.feePayer ? [tx.feePayer] : [],
          receivers: [],
          tokenTransfers: []
        });
      }
      
      return transactions;
    } catch (error) {
      console.error('Error fetching pending transactions from Helius:', error);
      throw error;
    }
  }
  
  /**
   * Set up a webhook for real-time address monitoring
   */
  public async setupWebhook(
    webhookUrl: string,
    addresses: string[],
    webhookType: 'enhanced' | 'raw' = 'enhanced'
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Helius service not available');
    }
    
    try {
      const response = await rateLimiter.queueHighPriority(async () => {
        const result = await fetch('https://api.helius.xyz/v0/webhooks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            apiKey: this.apiKey,
            webhookURL: webhookUrl,
            addresses,
            transactionTypes: ['Any'],
            webhookType
          })
        });
        
        if (!result.ok) {
          throw new Error(`Helius API error: ${result.status} ${await result.text()}`);
        }
        
        return await result.json();
      });
      
      if (response.webhook && response.webhook.id) {
        this.webhookUrl = webhookUrl;
        console.log('Successfully set up Helius webhook:', response.webhook.id);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error setting up Helius webhook:', error);
      return false;
    }
  }
  
  /**
   * Get NFT metadata for a mint address
   */
  public async getNftMetadata(mintAddress: string): Promise<NftMetadata | null> {
    if (!this.isAvailable()) {
      throw new Error('Helius service not available');
    }
    
    try {
      const response = await rateLimiter.queueLowPriority(async () => {
        const result = await fetch('https://api.helius.xyz/v0/tokens/metadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            mintAccounts: [mintAddress],
            includeOffChain: true,
            disableCache: false
          })
        });
        
        if (!result.ok) {
          throw new Error(`Helius API error: ${result.status} ${await result.text()}`);
        }
        
        return await result.json();
      });
      
      if (response && response.length > 0) {
        const metadata = response[0];
        
        return {
          mint: metadata.mint,
          name: metadata.onChainMetadata?.metadata?.data?.name || '',
          symbol: metadata.onChainMetadata?.metadata?.data?.symbol || '',
          uri: metadata.onChainMetadata?.metadata?.data?.uri || '',
          image: metadata.offChainMetadata?.image || '',
          attributes: metadata.offChainMetadata?.attributes || [],
          collection: metadata.onChainMetadata?.metadata?.collection?.key || ''
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching NFT metadata from Helius:', error);
      return null;
    }
  }
  
  /**
   * Determine transaction type from Helius transaction data
   */
  private determineTransactionType(tx: any): string {
    if (!tx) return 'unknown';
    
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      return 'tokenTransfer';
    }
    
    if (tx.instructions) {
      // In a real implementation, we would look at the program IDs and instruction data
      // to determine the transaction type more accurately
      const programIds = tx.instructions.map((ix: any) => ix.programId);
      
      if (programIds.includes('namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX')) {
        return 'solanaNameService';
      }
      
      if (programIds.includes('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')) {
        return 'tokenProgram';
      }
      
      if (programIds.includes('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')) {
        return 'associatedTokenProgram';
      }
      
      if (programIds.includes('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin')) {
        return 'serum';
      }
    }
    
    return 'systemProgram';
  }
}

/**
 * Token balance interface
 */
export interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  tokenName: string;
  tokenSymbol: string;
  logoUrl: string;
}

/**
 * Transaction info interface
 */
export interface TransactionInfo {
  signature: string;
  timestamp: Date;
  slot: number;
  fee: number;
  status: 'pending' | 'confirmed' | 'failed';
  type: string;
  senders: string[];
  receivers: string[];
  tokenTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    fromTokenAccount: string;
    toTokenAccount: string;
    tokenAmount: number;
    mint: string;
    tokenStandard: string;
  }[];
}

/**
 * NFT metadata interface
 */
export interface NftMetadata {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  image: string;
  attributes: { trait_type: string; value: string }[];
  collection: string;
}

// Create and export a singleton instance
const heliusService = HeliusService.getInstance();
export default heliusService;