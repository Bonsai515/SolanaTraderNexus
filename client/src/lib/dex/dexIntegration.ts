/**
 * Solana DEX Integration Module
 * 
 * This module provides comprehensive integration with all major Solana DEXs and protocols,
 * including liquidity pools, swap capabilities, and market data.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getRpcConnection } from '../solanaConnection';
import { wsClient } from '../wsClient';

// DEX and Protocol Types
export enum DexType {
  JUPITER = 'jupiter',
  RAYDIUM = 'raydium',
  OPENBOOK = 'openbook',
  ORCA = 'orca',
  METEORA = 'meteora',
  MANGO = 'mango',
  MARINA = 'marina',
  DRIFT = 'drift',
  JUPITER_PERPS = 'jupiter_perps',
  PUMP_FUN = 'pump_fun',
  GOOSE = 'goose'
}

export enum LendingProtocolType {
  MARGINFI = 'marginfi',
  KAMINO = 'kamino',
  MERCURIAL = 'mercurial',
  JET = 'jet',
  BOLT = 'bolt',
  SOLEND = 'solend'
}

export enum AnalyticsPlatformType {
  DEXSCREENER = 'dexscreener',
  BIRDEYE = 'birdeye'
}

export enum DexCategory {
  AMM = 'amm',
  ORDER_BOOK = 'order_book',
  AGGREGATOR = 'aggregator',
  PERPS = 'perpetuals',
  CONCENTRATED_LIQUIDITY = 'concentrated_liquidity',
  MEME_DEX = 'meme_dex',
  LENDING = 'lending',
  ANALYTICS = 'analytics'
}

// Interface Definitions
export interface DexInfo {
  id: DexType;
  name: string;
  url: string;
  categories: DexCategory[];
  description: string;
  active: boolean;
  supported_pairs: string[];
  icon?: string;
  liquidity_pools?: LiquidityPoolInfo[];
}

export interface LiquidityPoolInfo {
  address: string;
  dex: DexType;
  pair: string;
  tvl: number;
  volume_24h: number;
  apy?: number;
  created_at: Date;
}

export interface LendingProtocolInfo {
  id: LendingProtocolType;
  name: string;
  url: string;
  description: string;
  supported_tokens: string[];
  active: boolean;
}

// DEX Registry - Comprehensive list of all Solana DEXs and their details
const DEX_REGISTRY: DexInfo[] = [
  {
    id: DexType.JUPITER,
    name: 'Jupiter',
    url: 'https://jup.ag',
    categories: [DexCategory.AGGREGATOR],
    description: 'Leading Solana aggregator providing best swap routes across multiple DEXs',
    active: true,
    supported_pairs: ['SOL/USDC', 'BONK/USDC', 'JUP/USDC', 'RNDR/USDC', 'RAY/USDC', 'PYTH/USDC']
  },
  {
    id: DexType.RAYDIUM,
    name: 'Raydium',
    url: 'https://raydium.io',
    categories: [DexCategory.AMM, DexCategory.CONCENTRATED_LIQUIDITY],
    description: 'AMM and liquidity provider built on Solana, integrated with OpenBook',
    active: true,
    supported_pairs: ['SOL/USDC', 'RAY/USDC', 'RAY/SOL', 'RAY/USDT', 'BONK/USDC']
  },
  {
    id: DexType.OPENBOOK,
    name: 'OpenBook',
    url: 'https://www.openbook-solana.com',
    categories: [DexCategory.ORDER_BOOK],
    description: 'Community-led fork of Serum, providing central limit order book',
    active: true,
    supported_pairs: ['SOL/USDC', 'BONK/USDC', 'SOL/USDT', 'ETH/USDC', 'BTC/USDC']
  },
  {
    id: DexType.ORCA,
    name: 'Orca',
    url: 'https://www.orca.so',
    categories: [DexCategory.AMM, DexCategory.CONCENTRATED_LIQUIDITY],
    description: 'User-friendly DEX with concentrated liquidity and Whirlpools',
    active: true,
    supported_pairs: ['SOL/USDC', 'SOL/USDT', 'ORCA/USDC', 'ETH/USDC', 'BONK/USDC']
  },
  {
    id: DexType.METEORA,
    name: 'Meteora',
    url: 'https://meteora.ag',
    categories: [DexCategory.CONCENTRATED_LIQUIDITY],
    description: 'Concentrated liquidity DEX with dynamic fees and multi-pool structure',
    active: true,
    supported_pairs: ['SOL/USDC', 'BONK/USDC', 'JUP/USDC']
  },
  {
    id: DexType.MANGO,
    name: 'Mango Markets',
    url: 'https://mango.markets',
    categories: [DexCategory.ORDER_BOOK, DexCategory.PERPS],
    description: 'Decentralized trading platform with margin and perpetual futures',
    active: true,
    supported_pairs: ['SOL/USDC', 'BTC/USDC', 'ETH/USDC']
  },
  {
    id: DexType.MARINA,
    name: 'Marinade',
    url: 'https://marinade.finance',
    categories: [DexCategory.AMM],
    description: 'Liquid staking protocol offering mSOL with integrated DEX',
    active: true,
    supported_pairs: ['SOL/mSOL', 'mSOL/USDC']
  },
  {
    id: DexType.DRIFT,
    name: 'Drift Protocol',
    url: 'https://www.drift.trade',
    categories: [DexCategory.PERPS],
    description: 'Decentralized exchange for perpetual futures trading',
    active: true,
    supported_pairs: ['SOL-PERP', 'BTC-PERP', 'ETH-PERP']
  },
  {
    id: DexType.JUPITER_PERPS,
    name: 'Jupiter Perpetuals',
    url: 'https://perps.jup.ag',
    categories: [DexCategory.PERPS],
    description: 'Perpetual futures trading platform by Jupiter',
    active: true,
    supported_pairs: ['SOL-PERP', 'BONK-PERP', 'JUP-PERP']
  },
  {
    id: DexType.PUMP_FUN,
    name: 'Pump.fun',
    url: 'https://pump.fun',
    categories: [DexCategory.MEME_DEX],
    description: 'Meme-focused DEX for community token launches with unique mechanics',
    active: true,
    supported_pairs: ['PUMP/USDC', 'BONK/USDC', 'WIF/USDC']
  },
  {
    id: DexType.GOOSE,
    name: 'Goose DEX',
    url: 'https://www.goosefx.io',
    categories: [DexCategory.AMM, DexCategory.ORDER_BOOK],
    description: 'Multi-protocol DEX with both AMM and orderbook-based trading',
    active: true,
    supported_pairs: ['SOL/USDC', 'EGGS/USDC', 'GOOSE/USDC']
  }
];

// Lending Protocol Registry
const LENDING_PROTOCOL_REGISTRY: LendingProtocolInfo[] = [
  {
    id: LendingProtocolType.MARGINFI,
    name: 'MarginFi',
    url: 'https://marginfi.com',
    description: 'Unified lending and borrowing platform on Solana',
    supported_tokens: ['SOL', 'USDC', 'ETH', 'BTC', 'BONK', 'JUP'],
    active: true
  },
  {
    id: LendingProtocolType.KAMINO,
    name: 'Kamino Finance',
    url: 'https://kamino.finance',
    description: 'Automated liquidity management and yield strategies',
    supported_tokens: ['SOL', 'USDC', 'ETH', 'USDT', 'JUP'],
    active: true
  },
  {
    id: LendingProtocolType.MERCURIAL,
    name: 'Mercurial Finance',
    url: 'https://mercurial.finance',
    description: 'Dynamic vaults for stable asset trading and yield generation',
    supported_tokens: ['USDC', 'USDT', 'DAI', 'FRAX'],
    active: true
  },
  {
    id: LendingProtocolType.JET,
    name: 'Jet Protocol',
    url: 'https://jetprotocol.io',
    description: 'Borrowing and lending protocol focused on scalability',
    supported_tokens: ['SOL', 'USDC', 'ETH', 'BTC'],
    active: true
  },
  {
    id: LendingProtocolType.BOLT,
    name: 'Bolt Protocol',
    url: 'https://bolt.farm',
    description: 'Leveraged yield farming with built-in lending',
    supported_tokens: ['SOL', 'USDC', 'ETH', 'BOLT'],
    active: true
  },
  {
    id: LendingProtocolType.SOLEND,
    name: 'Solend',
    url: 'https://solend.fi',
    description: 'Algorithmic, decentralized protocol for lending and borrowing',
    supported_tokens: ['SOL', 'USDC', 'ETH', 'BTC', 'USDT', 'BONK', 'JUP', 'RAY'],
    active: true
  }
];

// Analytics Platforms Registry
const ANALYTICS_PLATFORMS_REGISTRY = [
  {
    id: AnalyticsPlatformType.DEXSCREENER,
    name: 'DEX Screener',
    url: 'https://dexscreener.com',
    description: 'Real-time trading data and analytics for DEXs across multiple chains'
  },
  {
    id: AnalyticsPlatformType.BIRDEYE,
    name: 'Birdeye',
    url: 'https://birdeye.so',
    description: 'Comprehensive analytics platform for Solana with real-time data'
  }
];

/**
 * Get all supported DEXs 
 */
export function getAllDexes(): DexInfo[] {
  return DEX_REGISTRY;
}

/**
 * Get all supported lending protocols
 */
export function getAllLendingProtocols(): LendingProtocolInfo[] {
  return LENDING_PROTOCOL_REGISTRY;
}

/**
 * Get all analytics platforms
 */
export function getAllAnalyticsPlatforms() {
  return ANALYTICS_PLATFORMS_REGISTRY;
}

/**
 * Get DEXs by category
 */
export function getDexesByCategory(category: DexCategory): DexInfo[] {
  return DEX_REGISTRY.filter(dex => dex.categories.includes(category));
}

/**
 * Get information about a specific DEX
 */
export function getDexInfo(dexId: DexType): DexInfo | undefined {
  return DEX_REGISTRY.find(dex => dex.id === dexId);
}

/**
 * Get DEXs that support a specific trading pair
 */
export function getDexesForPair(pair: string): DexInfo[] {
  return DEX_REGISTRY.filter(dex => dex.supported_pairs.includes(pair));
}

/**
 * Get liquidity pools from a specific DEX
 * @param dexId Optional DEX ID to filter pools
 */
export async function fetchLiquidityPools(dexId?: DexType): Promise<LiquidityPoolInfo[]> {
  try {
    const response = await fetch('/api/liquidity-pools' + (dexId ? `?dex=${dexId}` : ''));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch liquidity pools: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.pools || [];
  } catch (error) {
    console.error('Error fetching liquidity pools:', error);
    return [];
  }
}

/**
 * Get the best liquidity pool for a given pair
 * @param pair Trading pair to find the best pool for
 */
export async function getBestLiquidityPool(pair: string): Promise<LiquidityPoolInfo | null> {
  try {
    const pools = await fetchLiquidityPools();
    const pairPools = pools.filter(pool => pool.pair === pair);
    
    if (pairPools.length === 0) {
      return null;
    }
    
    // Find the pool with the highest TVL
    return pairPools.reduce((best, current) => 
      current.tvl > best.tvl ? current : best, pairPools[0]);
  } catch (error) {
    console.error('Error finding best liquidity pool:', error);
    return null;
  }
}

/**
 * Fetch real-time DEX data for a specific pair
 * @param pair Trading pair to fetch data for
 * @param dexId Optional DEX ID to filter data
 */
export async function fetchDexMarketData(pair: string, dexId?: DexType): Promise<any> {
  try {
    // First try WebSocket for real-time data
    if (wsClient.isConnected()) {
      wsClient.send({
        type: 'GET_DEX_MARKET_DATA',
        pair,
        dex: dexId,
        timestamp: new Date().toISOString()
      });
      
      // The result will come through the WebSocket message handler
      return { status: 'requested', message: 'Request sent via WebSocket' };
    }
    
    // Fallback to HTTP API
    const url = `/api/dex-market-data?pair=${pair}${dexId ? `&dex=${dexId}` : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch DEX market data: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching DEX market data:', error);
    return { status: 'error', message: error.message };
  }
}

/**
 * Fetch lending protocol data
 * @param protocolId Optional protocol ID to filter data
 */
export async function fetchLendingProtocolData(protocolId?: LendingProtocolType): Promise<any> {
  try {
    const url = `/api/lending-protocol-data${protocolId ? `?protocol=${protocolId}` : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch lending protocol data: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching lending protocol data:', error);
    return { status: 'error', message: error.message };
  }
}

/**
 * Initialize DEX integrations and prefetch essential data
 */
export async function initializeDexIntegrations(): Promise<boolean> {
  try {
    // Register for WebSocket messages for DEX updates
    wsClient.onMessage(messageStr => {
      try {
        const message = JSON.parse(messageStr);
        
        // Process DEX-specific messages
        if (message.type === 'DEX_MARKET_DATA_UPDATE') {
          console.log('Received DEX market data update:', message.data);
          // Event can be dispatched to subscribers here
        }
        
        if (message.type === 'LIQUIDITY_POOL_UPDATE') {
          console.log('Received liquidity pool update:', message.data);
          // Event can be dispatched to subscribers here
        }
      } catch (error) {
        console.error('Error processing DEX WebSocket message:', error);
      }
    });
    
    // Pre-fetch DEX data for important pairs
    const importantPairs = ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'];
    await Promise.all(importantPairs.map(pair => fetchDexMarketData(pair)));
    
    console.log('DEX integrations initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing DEX integrations:', error);
    return false;
  }
}

export default {
  getAllDexes,
  getAllLendingProtocols,
  getAllAnalyticsPlatforms,
  getDexesByCategory,
  getDexInfo,
  getDexesForPair,
  fetchLiquidityPools,
  getBestLiquidityPool,
  fetchDexMarketData,
  fetchLendingProtocolData,
  initializeDexIntegrations
};