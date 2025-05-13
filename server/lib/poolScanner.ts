/**
 * Pool Scanner Module
 * 
 * Scans and monitors liquidity pools across multiple DEXs
 * Used by the Hyperion Flash Arbitrage Overlord for trading opportunities
 */

import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { logger } from '../logger';
import { getAllDexes, getDexById, EnhancedDexInfo, PoolInfo, DexCategory } from '../dexInfo';
import { getSolanaConnection } from './ensureRpcConnection';

// Pool scanner configuration
interface PoolScannerConfig {
  scanIntervalMs: number;        // How often to scan pools
  minLiquidityUsd: number;       // Minimum pool liquidity to track
  maxPoolsPerDex: number;        // Maximum pools to track per DEX
  includeNewPools: boolean;      // Whether to actively seek out new pools
  rateLimitPerSecond: number;    // Rate limiting for API calls
}

// Default configuration
const DEFAULT_CONFIG: PoolScannerConfig = {
  scanIntervalMs: 60000,        // Scan every 60 seconds
  minLiquidityUsd: 10000,       // At least $10K liquidity
  maxPoolsPerDex: 50,           // Up to 50 pools per DEX
  includeNewPools: true,        // Actively seek new pools
  rateLimitPerSecond: 5         // Max 5 requests per second
};

/**
 * Pool Scanner class for monitoring liquidity pools across DEXs
 */
export class PoolScanner {
  private connection: Connection;
  private config: PoolScannerConfig;
  private pools: Map<string, PoolInfo> = new Map();
  private scanInterval: NodeJS.Timeout | null = null;
  private lastScanTime: number = 0;
  private dexes: EnhancedDexInfo[] = [];
  private pendingRequests: number = 0;
  private rateLimitTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<PoolScannerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.connection = getSolanaConnection();
    this.dexes = getAllDexes() as EnhancedDexInfo[];
    
    // Filter DEXs to only include those that actually have pools
    this.dexes = this.dexes.filter(dex => {
      const category = dex.category;
      return category === DexCategory.AMM || 
             category === DexCategory.CLMMs || 
             category === DexCategory.Perps;
    });
  }

  /**
   * Start scanning for pools
   */
  public start(): void {
    logger.info(`Starting pool scanner with ${this.dexes.length} DEXs`);
    
    // Perform initial scan
    this.scanAllPools();
    
    // Set up interval for regular scans
    this.scanInterval = setInterval(() => {
      this.scanAllPools();
    }, this.config.scanIntervalMs);
  }

  /**
   * Stop scanning pools
   */
  public stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    
    if (this.rateLimitTimer) {
      clearTimeout(this.rateLimitTimer);
      this.rateLimitTimer = null;
    }
    
    logger.info('Pool scanner stopped');
  }

  /**
   * Get all tracked pools
   */
  public getAllPools(): PoolInfo[] {
    return Array.from(this.pools.values());
  }

  /**
   * Get pools for a specific DEX
   */
  public getPoolsByDex(dexId: string): PoolInfo[] {
    return this.getAllPools().filter(pool => pool.dexId === dexId);
  }

  /**
   * Get pools with specific base token
   */
  public getPoolsByBaseToken(tokenAddress: string): PoolInfo[] {
    return this.getAllPools().filter(pool => pool.baseToken === tokenAddress);
  }

  /**
   * Scan all pools across supported DEXs
   */
  private async scanAllPools(): Promise<void> {
    this.lastScanTime = Date.now();
    logger.debug(`Scanning pools across ${this.dexes.length} DEXs`);
    
    const scanPromises = this.dexes.map(dex => this.scanDexPools(dex));
    
    try {
      await Promise.all(scanPromises);
      logger.info(`Pool scan complete. Tracking ${this.pools.size} pools across ${this.dexes.length} DEXs`);
    } catch (error) {
      logger.error(`Error scanning pools: ${error}`);
    }
  }

  /**
   * Scan pools for a specific DEX
   */
  private async scanDexPools(dex: EnhancedDexInfo): Promise<void> {
    try {
      switch(dex.id) {
        case 'jupiter':
          await this.scanJupiterPools(dex);
          break;
        case 'raydium':
          await this.scanRaydiumPools(dex);
          break;
        case 'orca':
          await this.scanOrcaPools(dex);
          break;
        case 'openbook':
          await this.scanOpenbookMarkets(dex);
          break;
        case 'drift':
          await this.scanDriftMarkets(dex);
          break;
        case 'meteora':
          await this.scanMeteoraPools(dex);
          break;
        default:
          // Use generic on-chain scanning for other DEXs
          await this.scanGenericPools(dex);
      }
    } catch (error) {
      logger.error(`Error scanning pools for ${dex.name}: ${error}`);
    }
  }

  /**
   * Scan Jupiter liquidity pools
   */
  private async scanJupiterPools(dex: EnhancedDexInfo): Promise<void> {
    await this.rateLimit();
    
    try {
      const response = await axios.get('https://quote-api.jup.ag/v6/tokens');
      const tokens = response.data;
      
      // Jupiter doesn't directly expose pools, but we can get top pairs
      // from the v4 indexer endpoint
      const indexerResponse = await axios.get('https://quote-api.jup.ag/v4/indexed-route-map?onlyDirectRoutes=true');
      const routeMap = indexerResponse.data.indexedRouteMap;
      
      // Process top pairs from the route map
      const newPools: PoolInfo[] = [];
      
      for (const [inputMint, outputs] of Object.entries(routeMap)) {
        if (!outputs) continue;
        
        for (const outputMint of Object.keys(outputs)) {
          const inputToken = tokens.find((t: any) => t.address === inputMint);
          const outputToken = tokens.find((t: any) => t.address === outputMint);
          
          if (!inputToken || !outputToken) continue;
          
          // Generate a unique pool ID
          const poolId = `jupiter-${inputMint}-${outputMint}`;
          
          const pool: PoolInfo = {
            id: poolId,
            address: poolId,
            dexId: dex.id,
            baseToken: inputMint,
            quoteToken: outputMint,
            baseTokenSymbol: inputToken.symbol,
            quoteTokenSymbol: outputToken.symbol,
            category: dex.category,
            tvl: 0,  // Jupiter doesn't provide TVL data in this API
            volume24h: 0
          };
          
          newPools.push(pool);
          
          // Limit number of pools based on config
          if (newPools.length >= this.config.maxPoolsPerDex) {
            break;
          }
        }
        
        // Break outer loop if we've reached the limit
        if (newPools.length >= this.config.maxPoolsPerDex) {
          break;
        }
      }
      
      // Update our tracked pools
      for (const pool of newPools) {
        this.pools.set(pool.id, pool);
      }
      
      logger.debug(`Scanned ${newPools.length} Jupiter pools`);
    } catch (error) {
      logger.error(`Error scanning Jupiter pools: ${error}`);
    }
  }

  /**
   * Scan Raydium liquidity pools
   */
  private async scanRaydiumPools(dex: EnhancedDexInfo): Promise<void> {
    await this.rateLimit();
    
    try {
      const response = await axios.get('https://api.raydium.io/v2/main/pools');
      const poolsData = response.data;
      
      const newPools: PoolInfo[] = [];
      
      for (const pool of poolsData) {
        if (!pool.id || !pool.baseMint || !pool.quoteMint) continue;
        
        // Filter out low liquidity pools
        if (pool.liquidity && pool.liquidity < this.config.minLiquidityUsd) continue;
        
        const poolInfo: PoolInfo = {
          id: pool.id,
          address: pool.id,
          dexId: dex.id,
          baseToken: pool.baseMint,
          quoteToken: pool.quoteMint,
          baseTokenSymbol: pool.name.split('-')[0],
          quoteTokenSymbol: pool.name.split('-')[1] || 'UNKNOWN',
          category: dex.category,
          tvl: pool.liquidity || 0,
          volume24h: pool.volume24h || 0,
          apr: pool.apy || 0
        };
        
        newPools.push(poolInfo);
        
        if (newPools.length >= this.config.maxPoolsPerDex) {
          break;
        }
      }
      
      // Update our tracked pools
      for (const pool of newPools) {
        this.pools.set(pool.id, pool);
      }
      
      logger.debug(`Scanned ${newPools.length} Raydium pools`);
    } catch (error) {
      logger.error(`Error scanning Raydium pools: ${error}`);
    }
  }

  /**
   * Scan Orca liquidity pools
   */
  private async scanOrcaPools(dex: EnhancedDexInfo): Promise<void> {
    await this.rateLimit();
    
    try {
      const response = await axios.get('https://api.orca.so/pools');
      const pools = response.data.pools;
      
      const newPools: PoolInfo[] = [];
      
      for (const [poolId, pool] of Object.entries(pools)) {
        if (!poolId) continue;
        
        // Check if it's a valid pool object 
        const typedPool = pool as any;
        if (!typedPool.tokenAMint || !typedPool.tokenBMint) continue;
        
        const tvl = parseFloat(typedPool.liquidity || '0');
        
        // Filter out low liquidity pools
        if (tvl < this.config.minLiquidityUsd) continue;
        
        const poolInfo: PoolInfo = {
          id: poolId,
          address: poolId,
          dexId: dex.id,
          baseToken: typedPool.tokenAMint,
          quoteToken: typedPool.tokenBMint,
          baseTokenSymbol: typedPool.tokenASymbol || 'UNKNOWN',
          quoteTokenSymbol: typedPool.tokenBSymbol || 'UNKNOWN',
          category: dex.category,
          tvl: tvl,
          volume24h: parseFloat(typedPool.volume24h || '0'),
          apr: parseFloat(typedPool.apy || '0') * 100 // Convert to percentage
        };
        
        newPools.push(poolInfo);
        
        if (newPools.length >= this.config.maxPoolsPerDex) {
          break;
        }
      }
      
      // Update our tracked pools
      for (const pool of newPools) {
        this.pools.set(pool.id, pool);
      }
      
      logger.debug(`Scanned ${newPools.length} Orca pools`);
    } catch (error) {
      logger.error(`Error scanning Orca pools: ${error}`);
    }
  }

  /**
   * Scan Openbook markets
   */
  private async scanOpenbookMarkets(dex: EnhancedDexInfo): Promise<void> {
    await this.rateLimit();
    
    try {
      // No direct API for Openbook markets, we need to fetch on-chain
      // This is a simplified implementation for the most active markets
      const programId = new PublicKey(dex.programId || 'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX');
      
      // Common quote tokens on Openbook
      const quoteTokens = [
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'So11111111111111111111111111111111111111112',  // SOL
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'  // USDT
      ];
      
      const newPools: PoolInfo[] = [];
      
      // For each quote token, get top markets
      for (const quoteToken of quoteTokens) {
        // This would normally involve complex on-chain data fetching
        // Just using placeholder data for now
        const mockMarkets = [
          {
            address: `openbook-market-${quoteToken}-1`,
            baseToken: 'So11111111111111111111111111111111111111112', // SOL
            baseTokenSymbol: 'SOL',
            quoteToken,
            quoteTokenSymbol: quoteToken === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? 'USDC' : 
                              quoteToken === 'So11111111111111111111111111111111111111112' ? 'SOL' : 'USDT',
            tvl: 1000000
          },
          {
            address: `openbook-market-${quoteToken}-2`,
            baseToken: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', // SAMO
            baseTokenSymbol: 'SAMO',
            quoteToken,
            quoteTokenSymbol: quoteToken === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? 'USDC' : 
                              quoteToken === 'So11111111111111111111111111111111111111112' ? 'SOL' : 'USDT',
            tvl: 500000
          }
        ];
        
        for (const market of mockMarkets) {
          const poolInfo: PoolInfo = {
            id: market.address,
            address: market.address,
            dexId: dex.id,
            baseToken: market.baseToken,
            quoteToken: market.quoteToken,
            baseTokenSymbol: market.baseTokenSymbol,
            quoteTokenSymbol: market.quoteTokenSymbol,
            category: dex.category,
            tvl: market.tvl
          };
          
          newPools.push(poolInfo);
        }
      }
      
      // Update our tracked pools
      for (const pool of newPools) {
        this.pools.set(pool.id, pool);
      }
      
      logger.debug(`Scanned ${newPools.length} Openbook markets`);
    } catch (error) {
      logger.error(`Error scanning Openbook markets: ${error}`);
    }
  }

  /**
   * Scan Drift markets
   */
  private async scanDriftMarkets(dex: EnhancedDexInfo): Promise<void> {
    await this.rateLimit();
    
    try {
      // Drift has a simple API for markets
      const response = await axios.get('https://api.drift.trade/markets');
      const markets = response.data.markets;
      
      const newPools: PoolInfo[] = [];
      
      for (const market of markets) {
        if (!market.marketIndex) continue;
        
        const poolInfo: PoolInfo = {
          id: `drift-${market.marketIndex}`,
          address: `drift-${market.marketIndex}`,
          dexId: dex.id,
          baseToken: market.marketSymbol,
          quoteToken: 'USDC', // Drift uses USDC as the quote currency
          baseTokenSymbol: market.marketSymbol,
          quoteTokenSymbol: 'USDC',
          category: dex.category,
          tvl: market.totalDepositsMaintenance / 1e6 || 0,
          volume24h: market.volume24H / 1e6 || 0
        };
        
        newPools.push(poolInfo);
      }
      
      // Update our tracked pools
      for (const pool of newPools) {
        this.pools.set(pool.id, pool);
      }
      
      logger.debug(`Scanned ${newPools.length} Drift markets`);
    } catch (error) {
      logger.error(`Error scanning Drift markets: ${error}`);
    }
  }

  /**
   * Scan Meteora pools
   */
  private async scanMeteoraPools(dex: EnhancedDexInfo): Promise<void> {
    await this.rateLimit();
    
    try {
      // Placeholder for Meteora API - would need actual endpoint
      const response = await axios.get('https://api.meteora.ag/pools');
      const pools = response.data.pools;
      
      const newPools: PoolInfo[] = [];
      
      for (const pool of pools) {
        if (!pool.address) continue;
        
        const poolInfo: PoolInfo = {
          id: pool.address,
          address: pool.address,
          dexId: dex.id,
          baseToken: pool.token0,
          quoteToken: pool.token1,
          baseTokenSymbol: pool.token0Symbol,
          quoteTokenSymbol: pool.token1Symbol,
          category: dex.category,
          tvl: pool.tvlUsd || 0,
          volume24h: pool.volumeUsd24h || 0,
          apr: pool.apr || 0
        };
        
        newPools.push(poolInfo);
        
        if (newPools.length >= this.config.maxPoolsPerDex) {
          break;
        }
      }
      
      // Update our tracked pools
      for (const pool of newPools) {
        this.pools.set(pool.id, pool);
      }
      
      logger.debug(`Scanned ${newPools.length} Meteora pools`);
    } catch (error) {
      logger.error(`Error scanning Meteora pools: ${error}`);
    }
  }

  /**
   * Generic on-chain pool scanning for DEXs without specific API implementations
   */
  private async scanGenericPools(dex: EnhancedDexInfo): Promise<void> {
    if (!dex.programId) {
      logger.debug(`Skipping generic scan for ${dex.name} - no program ID`);
      return;
    }
    
    // In a real implementation, this would scan on-chain program accounts
    // to find pools for this DEX. For now, just log a message.
    logger.debug(`Generic on-chain pool scanner for ${dex.name} not implemented`);
  }

  /**
   * Rate limiting helper to prevent API abuse
   */
  private async rateLimit(): Promise<void> {
    // Simple rate limiting
    this.pendingRequests++;
    
    if (this.pendingRequests > this.config.rateLimitPerSecond) {
      await new Promise<void>((resolve) => {
        this.rateLimitTimer = setTimeout(() => {
          resolve();
        }, 1000 / this.config.rateLimitPerSecond);
      });
    }
    
    this.pendingRequests--;
  }
}

// Create singleton instance
const poolScanner = new PoolScanner();

/**
 * Get the pool scanner instance
 */
export function getPoolScanner(): PoolScanner {
  return poolScanner;
}