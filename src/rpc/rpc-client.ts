/**
 * RPC Client Wrapper
 * 
 * This module wraps Solana RPC calls with rate limiting, caching, and retries
 * to prevent 429 errors.
 */

import { Connection, Commitment, PublicKey } from '@solana/web3.js';
import { apiClient } from '../api/api-client';
import { rateLimiter } from '../rate-limiter/rate-limiter';

// RPC provider configuration
interface RpcProvider {
  name: string;
  url: string;
  priority: number;
}

// Define RPC providers in priority order
const rpcProviders: RpcProvider[] = [
  {
    name: 'syndica',
    url: process.env.SYNDICA_URL || `https://solana-mainnet.api.syndica.io/api-key/${process.env.SYNDICA_API_KEY}`,
    priority: 1
  },
  {
    name: 'helius',
    url: process.env.HELIUS_URL || `https://rpc.helius.xyz/?api-key=${process.env.HELIUS_API_KEY}`,
    priority: 2
  },
  {
    name: 'instantnodes',
    url: process.env.INSTANTNODES_URL || 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9',
    priority: 3
  },
  {
    name: 'chainstream',
    url: process.env.CHAINSTREAM_URL || 'https://ssc-dao.genesysgo.net/',
    priority: 4
  }
];

// RPC client with rate limiting and fallback
class RpcClient {
  private primaryConnection: Connection;
  private connections: Map<string, Connection> = new Map();
  private providerHealth: Map<string, boolean> = new Map();
  
  constructor() {
    // Initialize connections for all providers
    for (const provider of rpcProviders) {
      this.connections.set(provider.name, new Connection(provider.url));
      this.providerHealth.set(provider.name, true);
    }
    
    // Set primary connection
    this.primaryConnection = this.connections.get(rpcProviders[0].name)!;
    
    // Start health check interval
    this.startHealthChecks();
  }
  
  /**
   * Get the best available connection
   */
  getConnection(): Connection {
    // Find the highest priority healthy connection
    for (const provider of rpcProviders) {
      if (this.providerHealth.get(provider.name)) {
        return this.connections.get(provider.name)!;
      }
    }
    
    // Fallback to primary if all are unhealthy
    return this.primaryConnection;
  }
  
  /**
   * Start regular health checks
   */
  private startHealthChecks(): void {
    // Check health every 30 seconds
    setInterval(() => {
      for (const provider of rpcProviders) {
        this.checkHealth(provider);
      }
    }, 30000);
    
    // Run initial health checks
    for (const provider of rpcProviders) {
      this.checkHealth(provider);
    }
  }
  
  /**
   * Check health of an RPC provider
   */
  private async checkHealth(provider: RpcProvider): Promise<void> {
    try {
      // Check if rate limited
      if (rateLimiter.shouldRateLimit(provider.name, 'getHealth', {})) {
        return;
      }
      
      // Get connection
      const connection = this.connections.get(provider.name)!;
      
      // Check health with timeout
      const healthPromise = connection.getHealth();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${provider.name} timeout`)), 5000);
      });
      
      await Promise.race([healthPromise, timeoutPromise]);
      
      // Update health status
      this.providerHealth.set(provider.name, true);
      rateLimiter.handleSuccess(provider.name);
    } catch (error) {
      console.warn(`[RPC] Health check failed for ${provider.url}: ${error}`);
      this.providerHealth.set(provider.name, false);
      rateLimiter.handleFailure(provider.name, 0);
    }
  }
  
  /**
   * Make an RPC request with rate limiting and caching
   */
  async rpcRequest<T>(
    method: string,
    params: any[],
    provider: string = rpcProviders[0].name
  ): Promise<T> {
    // Use the API client to make the request
    return apiClient.post<T>(
      provider,
      this.connections.get(provider)!.rpcEndpoint,
      {
        jsonrpc: '2.0',
        id: Date.now().toString(),
        method,
        params
      }
    );
  }
  
  /**
   * Get a token's information with rate limiting and caching
   */
  async getTokenInfo(
    mint: string | PublicKey,
    commitment: Commitment = 'confirmed'
  ): Promise<any> {
    const mintAddress = typeof mint === 'string' ? mint : mint.toBase58();
    
    // Try each provider in order
    for (const provider of rpcProviders) {
      if (!this.providerHealth.get(provider.name)) continue;
      
      try {
        const response = await this.rpcRequest(
          'getTokenAccountsByOwner',
          [
            mintAddress,
            { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
            { encoding: 'jsonParsed', commitment }
          ],
          provider.name
        );
        
        rateLimiter.handleSuccess(provider.name);
        return response;
      } catch (error) {
        rateLimiter.handleFailure(provider.name, error.response?.status || 0);
        
        // If it's not a rate limit, try the next provider
        if (error.response?.status !== 429) {
          continue;
        }
        
        // If rate limited, wait and retry with same provider
        const delayMs = rateLimiter.calculateRetryDelay(provider.name, 1);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        try {
          const response = await this.rpcRequest(
            'getTokenAccountsByOwner',
            [
              mintAddress,
              { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
              { encoding: 'jsonParsed', commitment }
            ],
            provider.name
          );
          
          rateLimiter.handleSuccess(provider.name);
          return response;
        } catch (error) {
          rateLimiter.handleFailure(provider.name, error.response?.status || 0);
        }
      }
    }
    
    throw new Error('All RPC providers failed');
  }
}

// Export RPC client singleton
export const rpcClient = new RpcClient();