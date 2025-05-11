/**
 * DEX Information API
 * Provides information about available DEXs in the system
 */

import { logger } from './logger';

/**
 * Supported DEX types
 */
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
  GOOSE = 'goose',
  TENSOR = 'tensor',
  PHOENIX = 'phoenix',
  DEXLAB = 'dexlab',
  SANCTUM = 'sanctum',
  CYKURA = 'cykura'
}

/**
 * Supported analytics platforms
 */
export enum AnalyticsPlatformType {
  DEXSCREENER = 'dexscreener',
  BIRDEYE = 'birdeye',
  DEXSCREENER_MOONSHOT = 'dexscreener_moonshot',
  SOLSCAN = 'solscan',
  SOLANAFLOOR = 'solanafloor'
}

/**
 * Supported lending protocols
 */
export enum LendingProtocolType {
  MARGINFI = 'marginfi',
  KAMINO = 'kamino',
  MERCURIAL = 'mercurial',
  JET = 'jet',
  BOLT = 'bolt',
  SOLEND = 'solend'
}

/**
 * DEX category types
 */
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

/**
 * DEX information
 */
export interface DexInfo {
  id: DexType;
  name: string;
  url: string;
  categories: DexCategory[];
  description: string;
  active: boolean;
  supported_pairs: string[];
  icon?: string;
}

/**
 * DEX liquidity pool information
 */
export interface LiquidityPoolInfo {
  address: string;
  dex: DexType;
  pair: string;
  tvl: number;
  volume_24h: number;
  apy?: number;
  created_at: Date;
}

/**
 * Get all supported DEXs in the system
 */
export function getAllDexes(): DexInfo[] {
  return [
    {
      id: DexType.JUPITER,
      name: 'Jupiter',
      url: 'https://jup.ag',
      categories: [DexCategory.AGGREGATOR],
      description: 'Leading Solana aggregator providing best execution across multiple DEXs',
      active: true,
      supported_pairs: ['SOL/USDC', 'SOL/USDT', 'BTC/USDC', 'ETH/USDC', 'BONK/USDC', 'JUP/USDC']
    },
    {
      id: DexType.JUPITER_PERPS,
      name: 'Jupiter Perpetuals',
      url: 'https://perps.jup.ag',
      categories: [DexCategory.PERPS],
      description: 'Perpetual futures trading on Solana by Jupiter',
      active: true,
      supported_pairs: ['SOL-PERP', 'BTC-PERP', 'ETH-PERP', 'JUP-PERP']
    },
    {
      id: DexType.RAYDIUM,
      name: 'Raydium',
      url: 'https://raydium.io',
      categories: [DexCategory.AMM, DexCategory.CONCENTRATED_LIQUIDITY],
      description: 'AMM and liquidity provider built on Solana',
      active: true,
      supported_pairs: ['SOL/USDC', 'SOL/USDT', 'BTC/USDC', 'ETH/USDC', 'RAY/USDC', 'BONK/USDC']
    },
    {
      id: DexType.OPENBOOK,
      name: 'Openbook',
      url: 'https://www.openbook-solana.com',
      categories: [DexCategory.ORDER_BOOK],
      description: 'Order book-based decentralized exchange on Solana (formerly Serum)',
      active: true,
      supported_pairs: ['SOL/USDC', 'SOL/USDT', 'BTC/USDC', 'ETH/USDC']
    },
    {
      id: DexType.ORCA,
      name: 'Orca',
      url: 'https://www.orca.so',
      categories: [DexCategory.AMM, DexCategory.CONCENTRATED_LIQUIDITY],
      description: 'User-friendly AMM with concentrated liquidity Whirlpools',
      active: true,
      supported_pairs: ['SOL/USDC', 'SOL/USDT', 'BTC/USDC', 'ETH/USDC', 'ORCA/USDC']
    },
    {
      id: DexType.METEORA,
      name: 'Meteora',
      url: 'https://www.meteora.ag',
      categories: [DexCategory.AMM, DexCategory.CONCENTRATED_LIQUIDITY],
      description: 'Advanced AMM with innovative liquidity solutions',
      active: true,
      supported_pairs: ['SOL/USDC', 'SOL/USDT', 'BTC/USDC', 'ETH/USDC']
    },
    {
      id: DexType.MANGO,
      name: 'Mango Markets',
      url: 'https://mango.markets',
      categories: [DexCategory.ORDER_BOOK, DexCategory.PERPS],
      description: 'Decentralized trading platform for spot, perpetuals and lending',
      active: true,
      supported_pairs: ['SOL-PERP', 'BTC-PERP', 'ETH-PERP']
    },
    {
      id: DexType.MARINA,
      name: 'MarinaLabs',
      url: 'https://marinalabs.io',
      categories: [DexCategory.AMM, DexCategory.CONCENTRATED_LIQUIDITY],
      description: 'Next-gen DEX with advanced features and optimized liquidity',
      active: true,
      supported_pairs: ['SOL/USDC', 'SOL/USDT', 'BTC/USDC', 'ETH/USDC']
    },
    {
      id: DexType.DRIFT,
      name: 'Drift Protocol',
      url: 'https://app.drift.trade',
      categories: [DexCategory.PERPS],
      description: 'Advanced decentralized exchange for perpetual futures on Solana',
      active: true,
      supported_pairs: ['SOL-PERP', 'BTC-PERP', 'ETH-PERP', 'JTO-PERP', 'BONK-PERP']
    },
    {
      id: DexType.PUMP_FUN,
      name: 'Pump.fun',
      url: 'https://pump.fun',
      categories: [DexCategory.MEME_DEX],
      description: 'Platform for meme tokens on Solana, focuses on new token launches',
      active: true,
      supported_pairs: ['MEME/SOL', 'MEME/USDC', 'SOL/USDC']
    },
    {
      id: DexType.GOOSE,
      name: 'Goose DEX',
      url: 'https://www.goosedex.io',
      categories: [DexCategory.AMM, DexCategory.MEME_DEX],
      description: 'Emerging DEX on Solana focusing on new token launches and meme coins',
      active: true,
      supported_pairs: ['SOL/USDC', 'GOOSE/SOL', 'MEME/SOL']
    }
  ];
}

/**
 * Get all supported analytics platforms
 */
export function getAllAnalyticsPlatforms(): { id: AnalyticsPlatformType, name: string, url: string, description: string }[] {
  return [
    {
      id: AnalyticsPlatformType.DEXSCREENER,
      name: 'DEX Screener',
      url: 'https://dexscreener.com',
      description: 'Real-time charts, prices and trading data for decentralized exchanges'
    },
    {
      id: AnalyticsPlatformType.BIRDEYE,
      name: 'Birdeye',
      url: 'https://birdeye.so',
      description: 'Advanced analytics platform for Solana tokens and DEXs'
    }
  ];
}

/**
 * Get all supported lending protocols
 */
export function getAllLendingProtocols(): { id: LendingProtocolType, name: string, url: string, description: string, supported_tokens: string[] }[] {
  return [
    {
      id: LendingProtocolType.MARGINFI,
      name: 'MarginFi',
      url: 'https://app.marginfi.com',
      description: 'Lending and borrowing protocol on Solana with cross-margin features',
      supported_tokens: ['SOL', 'USDC', 'USDT', 'ETH', 'BTC']
    },
    {
      id: LendingProtocolType.KAMINO,
      name: 'Kamino Finance',
      url: 'https://kamino.finance',
      description: 'Automated liquidity management protocol for concentrated liquidity positions',
      supported_tokens: ['SOL', 'USDC', 'USDT', 'ETH', 'BTC', 'JUP']
    },
    {
      id: LendingProtocolType.MERCURIAL,
      name: 'Mercurial',
      url: 'https://mercurial.finance',
      description: 'Decentralized stablecoin exchange and yield-bearing vaults on Solana',
      supported_tokens: ['USDC', 'USDT', 'DAI']
    },
    {
      id: LendingProtocolType.JET,
      name: 'Jet Protocol',
      url: 'https://jetprotocol.io',
      description: 'Decentralized lending and borrowing platform on Solana',
      supported_tokens: ['SOL', 'USDC', 'ETH', 'BTC', 'JET']
    },
    {
      id: LendingProtocolType.BOLT,
      name: 'Bolt',
      url: 'https://bolt.io',
      description: 'Lending protocol with innovative features for undercollateralized loans',
      supported_tokens: ['SOL', 'USDC', 'ETH', 'BTC']
    },
    {
      id: LendingProtocolType.SOLEND,
      name: 'Solend',
      url: 'https://solend.fi',
      description: 'Algorithmic, decentralized protocol for lending and borrowing on Solana',
      supported_tokens: ['SOL', 'USDC', 'USDT', 'ETH', 'BTC', 'BONK', 'JUP']
    }
  ];
}

/**
 * Get information about a specific DEX
 */
export function getDexInfo(dexId: DexType): DexInfo | null {
  const allDexes = getAllDexes();
  return allDexes.find(dex => dex.id === dexId) || null;
}

/**
 * Get DEXs by category
 */
export function getDexesByCategory(category: DexCategory): DexInfo[] {
  const allDexes = getAllDexes();
  return allDexes.filter(dex => dex.categories.includes(category));
}

/**
 * Mock function to get liquidity pools (in a real implementation this would query on-chain data)
 */
export function getLiquidityPools(dexId?: DexType): LiquidityPoolInfo[] {
  // This would be populated with real data in a production environment
  const pools: LiquidityPoolInfo[] = [
    {
      address: 'orca_sol_usdc_whirlpool_123',
      dex: DexType.ORCA,
      pair: 'SOL/USDC',
      tvl: 5200000,
      volume_24h: 1200000,
      apy: 4.2,
      created_at: new Date('2023-01-15')
    },
    {
      address: 'orca_eth_usdc_whirlpool_456',
      dex: DexType.ORCA,
      pair: 'ETH/USDC',
      tvl: 3800000,
      volume_24h: 950000,
      apy: 3.8,
      created_at: new Date('2023-02-10')
    },
    {
      address: 'raydium_sol_usdc_pool_789',
      dex: DexType.RAYDIUM,
      pair: 'SOL/USDC',
      tvl: 4900000,
      volume_24h: 1100000,
      apy: 4.5,
      created_at: new Date('2023-01-20')
    },
    {
      address: 'meteora_sol_usdc_pool_abc',
      dex: DexType.METEORA,
      pair: 'SOL/USDC',
      tvl: 2800000,
      volume_24h: 750000,
      apy: 5.1,
      created_at: new Date('2023-04-05')
    },
    {
      address: 'marina_sol_usdc_pool_def',
      dex: DexType.MARINA,
      pair: 'SOL/USDC',
      tvl: 1900000,
      volume_24h: 520000,
      apy: 5.5,
      created_at: new Date('2023-05-20')
    }
  ];
  
  if (dexId) {
    return pools.filter(pool => pool.dex === dexId);
  }
  
  return pools;
}

/**
 * Get the best liquidity pool for a given pair
 */
export function getBestLiquidityPool(pair: string): LiquidityPoolInfo | null {
  const pools = getLiquidityPools().filter(pool => pool.pair === pair);
  
  if (pools.length === 0) {
    return null;
  }
  
  // Find the pool with the highest TVL
  return pools.reduce((best, current) => {
    return current.tvl > best.tvl ? current : best;
  }, pools[0]);
}

/**
 * Get all supported trading pairs
 */
export function getAllSupportedPairs(): string[] {
  const allDexes = getAllDexes();
  const pairsSet = new Set<string>();
  
  allDexes.forEach(dex => {
    dex.supported_pairs.forEach(pair => pairsSet.add(pair));
  });
  
  return Array.from(pairsSet);
}

/**
 * Get DEXs that support a specific trading pair
 */
export function getDexesForPair(pair: string): DexInfo[] {
  const allDexes = getAllDexes();
  return allDexes.filter(dex => dex.supported_pairs.includes(pair));
}