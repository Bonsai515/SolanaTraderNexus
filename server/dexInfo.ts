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
  CYKURA = 'cykura',
  HELLBENDERS = 'hellbenders',
  ZETA = 'zeta',
  LIFINITY = 'lifinity',
  CREMA = 'crema',
  DL = 'dl',
  SYMMETRY = 'symmetry',
  BONKSWAP = 'bonkswap',
  SAROS = 'saros',
  STEPN = 'stepn',
  SABER = 'saber',
  INVARIANT = 'invariant'
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
      supported_pairs: ['SOL/USDC', 'SOL/USDT', 'BTC/USDC', 'ETH/USDC', 'BONK/USDC', 'JUP/USDC', 'WIF/USDC', 'BONK/SOL']
    },
    {
      id: DexType.JUPITER_PERPS,
      name: 'Jupiter Perpetuals',
      url: 'https://perps.jup.ag',
      categories: [DexCategory.PERPS],
      description: 'Perpetual futures trading on Solana by Jupiter',
      active: true,
      supported_pairs: ['SOL-PERP', 'BTC-PERP', 'ETH-PERP', 'JUP-PERP', 'BONK-PERP']
    },
    {
      id: DexType.RAYDIUM,
      name: 'Raydium',
      url: 'https://raydium.io',
      categories: [DexCategory.AMM, DexCategory.CONCENTRATED_LIQUIDITY],
      description: 'AMM and liquidity provider built on Solana',
      active: true,
      supported_pairs: ['SOL/USDC', 'SOL/USDT', 'BTC/USDC', 'ETH/USDC', 'RAY/USDC', 'BONK/USDC', 'WIF/USDC', 'JUP/USDC']
    },
    {
      id: DexType.OPENBOOK,
      name: 'Openbook',
      url: 'https://www.openbook-solana.com',
      categories: [DexCategory.ORDER_BOOK],
      description: 'Order book-based decentralized exchange on Solana (formerly Serum)',
      active: true,
      supported_pairs: ['SOL/USDC', 'SOL/USDT', 'BTC/USDC', 'ETH/USDC', 'BONK/USDC']
    },
    {
      id: DexType.ORCA,
      name: 'Orca',
      url: 'https://www.orca.so',
      categories: [DexCategory.AMM, DexCategory.CONCENTRATED_LIQUIDITY],
      description: 'User-friendly AMM with concentrated liquidity Whirlpools',
      active: true,
      supported_pairs: ['SOL/USDC', 'SOL/USDT', 'BTC/USDC', 'ETH/USDC', 'ORCA/USDC', 'BONK/USDC', 'WIF/USDC']
    },
    {
      id: DexType.METEORA,
      name: 'Meteora',
      url: 'https://www.meteora.ag',
      categories: [DexCategory.AMM, DexCategory.CONCENTRATED_LIQUIDITY],
      description: 'Advanced AMM with innovative liquidity solutions',
      active: true,
      supported_pairs: ['SOL/USDC', 'SOL/USDT', 'BTC/USDC', 'ETH/USDC', 'BONK/USDC']
    },
    {
      id: DexType.MANGO,
      name: 'Mango Markets',
      url: 'https://mango.markets',
      categories: [DexCategory.ORDER_BOOK, DexCategory.PERPS],
      description: 'Decentralized trading platform for spot, perpetuals and lending',
      active: true,
      supported_pairs: ['SOL-PERP', 'BTC-PERP', 'ETH-PERP', 'BONK-PERP']
    },
    {
      id: DexType.MARINA,
      name: 'MarinaLabs',
      url: 'https://marinalabs.io',
      categories: [DexCategory.AMM, DexCategory.CONCENTRATED_LIQUIDITY],
      description: 'Next-gen DEX with advanced features and optimized liquidity',
      active: true,
      supported_pairs: ['SOL/USDC', 'SOL/USDT', 'BTC/USDC', 'ETH/USDC', 'BONK/USDC']
    },
    {
      id: DexType.DRIFT,
      name: 'Drift Protocol',
      url: 'https://app.drift.trade',
      categories: [DexCategory.PERPS],
      description: 'Advanced decentralized exchange for perpetual futures on Solana',
      active: true,
      supported_pairs: ['SOL-PERP', 'BTC-PERP', 'ETH-PERP', 'JTO-PERP', 'BONK-PERP', 'JUP-PERP']
    },
    {
      id: DexType.PUMP_FUN,
      name: 'Pump.fun',
      url: 'https://pump.fun',
      categories: [DexCategory.MEME_DEX],
      description: 'Platform for meme tokens on Solana, focuses on new token launches',
      active: true,
      supported_pairs: ['MEME/SOL', 'MEME/USDC', 'SOL/USDC', 'BONK/SOL', 'WIF/SOL', 'BOME/SOL', 'GMGN/SOL']
    },
    {
      id: DexType.GOOSE,
      name: 'Goose DEX',
      url: 'https://www.goosedex.io',
      categories: [DexCategory.AMM, DexCategory.MEME_DEX],
      description: 'Emerging DEX on Solana focusing on new token launches and meme coins',
      active: true,
      supported_pairs: ['SOL/USDC', 'GOOSE/SOL', 'MEME/SOL', 'BONK/SOL', 'WIF/SOL']
    },
    {
      id: DexType.PHOENIX,
      name: 'Phoenix',
      url: 'https://phoenix.trade',
      categories: [DexCategory.ORDER_BOOK],
      description: 'High-performance on-chain orderbook with superior capital efficiency',
      active: true,
      supported_pairs: ['SOL/USDC', 'BTC/USDC', 'ETH/USDC', 'BONK/USDC']
    },
    {
      id: DexType.TENSOR,
      name: 'Tensor',
      url: 'https://tensor.trade',
      categories: [DexCategory.ORDER_BOOK],
      description: 'NFT and token trading platform with advanced features',
      active: true,
      supported_pairs: ['SOL/USDC', 'BONK/USDC', 'WIF/USDC', 'JUP/USDC', 'TENSOR/USDC']
    },
    {
      id: DexType.SANCTUM,
      name: 'Sanctum',
      url: 'https://sanctum.so',
      categories: [DexCategory.ORDER_BOOK, DexCategory.CONCENTRATED_LIQUIDITY],
      description: 'Advanced trading platform combining orderbook and concentrated liquidity',
      active: true,
      supported_pairs: ['SOL/USDC', 'BONK/USDC', 'ETH/USDC', 'BTC/USDC']
    },
    {
      id: DexType.CYKURA,
      name: 'Cykura',
      url: 'https://cykura.io',
      categories: [DexCategory.CONCENTRATED_LIQUIDITY],
      description: 'Concentrated liquidity market maker on Solana',
      active: true,
      supported_pairs: ['SOL/USDC', 'BTC/USDC', 'ETH/USDC', 'CYS/USDC']
    },
    {
      id: DexType.HELLBENDERS,
      name: 'Hellbenders',
      url: 'https://www.hellbenders.com',
      categories: [DexCategory.MEME_DEX],
      description: 'New meme coin platform focused on ecosystem growth',
      active: true,
      supported_pairs: ['HELL/SOL', 'HELL/USDC', 'SOL/USDC', 'MEME/SOL']
    },
    {
      id: DexType.ZETA,
      name: 'Zeta Markets',
      url: 'https://zeta.markets',
      categories: [DexCategory.PERPS, DexCategory.ORDER_BOOK],
      description: 'Derivatives exchange with options and futures trading',
      active: true,
      supported_pairs: ['SOL-PERP', 'BTC-PERP', 'ETH-PERP', 'BONK-PERP']
    },
    {
      id: DexType.LIFINITY,
      name: 'Lifinity',
      url: 'https://lifinity.io',
      categories: [DexCategory.AMM, DexCategory.CONCENTRATED_LIQUIDITY],
      description: 'Proactive market making protocol on Solana',
      active: true,
      supported_pairs: ['SOL/USDC', 'BTC/USDC', 'ETH/USDC', 'BONK/USDC', 'LIFE/USDC']
    },
    {
      id: DexType.CREMA,
      name: 'Crema Finance',
      url: 'https://crema.finance',
      categories: [DexCategory.CONCENTRATED_LIQUIDITY],
      description: 'Concentrated liquidity market maker for Solana',
      active: true,
      supported_pairs: ['SOL/USDC', 'BTC/USDC', 'ETH/USDC', 'CREAM/USDC']
    },
    {
      id: DexType.DL,
      name: 'DL',
      url: 'https://dl.market',
      categories: [DexCategory.AMM, DexCategory.MEME_DEX],
      description: 'Dynamic launchers for new token offerings on Solana',
      active: true,
      supported_pairs: ['SOL/USDC', 'MEME/SOL', 'BONK/SOL', 'WIF/SOL']
    },
    {
      id: DexType.SYMMETRY,
      name: 'Symmetry',
      url: 'https://symmetry.fi',
      categories: [DexCategory.AMM],
      description: 'Index protocol and asset management platform on Solana',
      active: true,
      supported_pairs: ['SOL/USDC', 'BTC/USDC', 'ETH/USDC', 'SYMM/USDC']
    },
    {
      id: DexType.BONKSWAP,
      name: 'BonkSwap',
      url: 'https://bonkswap.fi',
      categories: [DexCategory.AMM, DexCategory.MEME_DEX],
      description: 'BONK-focused swap platform for meme coins',
      active: true,
      supported_pairs: ['BONK/USDC', 'BONK/SOL', 'WIF/BONK', 'BOME/BONK']
    },
    {
      id: DexType.SAROS,
      name: 'Saros',
      url: 'https://saros.finance',
      categories: [DexCategory.AMM],
      description: 'AMM protocol with unique features for sustainable DeFi',
      active: true,
      supported_pairs: ['SOL/USDC', 'BTC/USDC', 'ETH/USDC', 'SAROS/USDC']
    },
    {
      id: DexType.STEPN,
      name: 'STEPN',
      url: 'https://stepn.com',
      categories: [DexCategory.AMM],
      description: 'DEX associated with the move-to-earn STEPN ecosystem',
      active: true,
      supported_pairs: ['GMT/USDC', 'GST/USDC', 'SOL/USDC']
    },
    {
      id: DexType.SABER,
      name: 'Saber',
      url: 'https://saber.so',
      categories: [DexCategory.AMM],
      description: 'StableSwap AMM on Solana for trading between stable pairs',
      active: true,
      supported_pairs: ['USDC/USDT', 'USDC/DAI', 'USDC/USDH']
    },
    {
      id: DexType.INVARIANT,
      name: 'Invariant',
      url: 'https://invariant.app',
      categories: [DexCategory.CONCENTRATED_LIQUIDITY],
      description: 'Concentrated liquidity protocol built on Solana',
      active: true,
      supported_pairs: ['SOL/USDC', 'BTC/USDC', 'ETH/USDC', 'INV/USDC']
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
 * Function to get liquidity pools with real-time data
 */
export function getLiquidityPools(dexId?: DexType): LiquidityPoolInfo[] {
  // This would be populated with real data from on-chain in production
  const pools: LiquidityPoolInfo[] = [
    // Orca Whirlpools
    {
      address: 'orca_sol_usdc_whirlpool_7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoVNUJnm',
      dex: DexType.ORCA,
      pair: 'SOL/USDC',
      tvl: 5200000,
      volume_24h: 1200000,
      apy: 4.2,
      created_at: new Date('2023-01-15')
    },
    {
      address: 'orca_eth_usdc_whirlpool_3kWvtyYKfmEfwbgBsJn7ay2hQnMcV3MvXVUPF5zmXFyx',
      dex: DexType.ORCA,
      pair: 'ETH/USDC',
      tvl: 3800000,
      volume_24h: 950000,
      apy: 3.8,
      created_at: new Date('2023-02-10')
    },
    {
      address: 'orca_bonk_usdc_whirlpool_9vqvMvnqJJrfGzwGgMQgJqCCZkhZdKH7D6wBzWzPoPZ6',
      dex: DexType.ORCA,
      pair: 'BONK/USDC',
      tvl: 2450000,
      volume_24h: 780000,
      apy: 5.7,
      created_at: new Date('2023-08-15')
    },
    {
      address: 'orca_wif_usdc_whirlpool_2LgGKsABQxEH3AXnQMGVtB2gb2nery9HVxZaFXX8qmXH',
      dex: DexType.ORCA,
      pair: 'WIF/USDC',
      tvl: 1850000,
      volume_24h: 650000,
      apy: 6.1,
      created_at: new Date('2023-11-12')
    },
    
    // Raydium Pools
    {
      address: 'raydium_sol_usdc_pool_58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
      dex: DexType.RAYDIUM,
      pair: 'SOL/USDC',
      tvl: 4900000,
      volume_24h: 1100000,
      apy: 4.5,
      created_at: new Date('2023-01-20')
    },
    {
      address: 'raydium_bonk_usdc_pool_8WTbMARDn5Lh14BHQdEWGCyPHfaskqYUmLLRQxuVRbVV',
      dex: DexType.RAYDIUM,
      pair: 'BONK/USDC',
      tvl: 3200000,
      volume_24h: 920000,
      apy: 5.3,
      created_at: new Date('2023-07-05')
    },
    {
      address: 'raydium_jup_usdc_pool_6qAYEbDGMTScp8uGMq1MQvMkK95H95HZcyP9HLrC8FJc',
      dex: DexType.RAYDIUM,
      pair: 'JUP/USDC',
      tvl: 2700000,
      volume_24h: 850000,
      apy: 4.7,
      created_at: new Date('2023-09-28')
    },
    {
      address: 'raydium_wif_usdc_pool_DvHVapj4g5EQ9qryqKDX2LRXGN7gZ5Ls9D2EXhiLVC6k',
      dex: DexType.RAYDIUM,
      pair: 'WIF/USDC',
      tvl: 2100000,
      volume_24h: 720000,
      apy: 5.8,
      created_at: new Date('2023-11-05')
    },
    
    // Meteora Pools
    {
      address: 'meteora_sol_usdc_pool_6Lm8RJpKqKTjDYkV3KbBYs4vYYQJc53PQhM4Lqd9F28m',
      dex: DexType.METEORA,
      pair: 'SOL/USDC',
      tvl: 2800000,
      volume_24h: 750000,
      apy: 5.1,
      created_at: new Date('2023-04-05')
    },
    {
      address: 'meteora_bonk_usdc_pool_3Rehk24LNMM6YH2c7dNoFR8jFvZKnM41rREx3snjDNFX',
      dex: DexType.METEORA,
      pair: 'BONK/USDC',
      tvl: 1850000,
      volume_24h: 620000,
      apy: 6.2,
      created_at: new Date('2023-06-12')
    },
    
    // Marina Pools
    {
      address: 'marina_sol_usdc_pool_LM8DBELbqUUwSJV8DjZ7Uy3XX86W8TsxeHDCvM1PHTm',
      dex: DexType.MARINA,
      pair: 'SOL/USDC',
      tvl: 1900000,
      volume_24h: 520000,
      apy: 5.5,
      created_at: new Date('2023-05-20')
    },
    {
      address: 'marina_bonk_usdc_pool_9H6SFqVwY8NbFqEGhZSgNVHdqTHC4K5QSJvAf6a6JmEA',
      dex: DexType.MARINA,
      pair: 'BONK/USDC',
      tvl: 1250000,
      volume_24h: 480000,
      apy: 6.8,
      created_at: new Date('2023-09-15')
    },
    
    // Phoenix Pools
    {
      address: 'phoenix_sol_usdc_pool_49Q8zSRYMJMrP4PfYNQ2un2UHnKZdZQKniRhDkAF1mS4',
      dex: DexType.PHOENIX,
      pair: 'SOL/USDC',
      tvl: 3200000,
      volume_24h: 850000,
      apy: 4.3,
      created_at: new Date('2023-03-10')
    },
    {
      address: 'phoenix_bonk_usdc_pool_33QZRDf1JwkBfYPcwGXebP2BgBQAGaXgY7BpZ8yRMaWh',
      dex: DexType.PHOENIX,
      pair: 'BONK/USDC',
      tvl: 1600000,
      volume_24h: 550000,
      apy: 5.9,
      created_at: new Date('2023-08-02')
    },
    
    // Tensor Pools
    {
      address: 'tensor_sol_usdc_pool_9nVwkPp3AJP9WJuKCFy2XhZTvYKP9J9YXzV5ZX7jNRbr',
      dex: DexType.TENSOR,
      pair: 'SOL/USDC',
      tvl: 2100000,
      volume_24h: 680000,
      apy: 4.8,
      created_at: new Date('2023-04-18')
    },
    {
      address: 'tensor_bonk_usdc_pool_6GxM1VUkTu1tXus7ApPSgJbMJNcFnFjPn7R9YBcQ3HPw',
      dex: DexType.TENSOR,
      pair: 'BONK/USDC',
      tvl: 1350000,
      volume_24h: 490000,
      apy: 6.3,
      created_at: new Date('2023-07-25')
    },
    
    // Sanctum Pools
    {
      address: 'sanctum_sol_usdc_pool_2JJQ5NAHCL8gRZKYaLnVXQwn5vNK7cTXv5cVry8e93yP',
      dex: DexType.SANCTUM,
      pair: 'SOL/USDC',
      tvl: 1850000,
      volume_24h: 610000,
      apy: 5.2,
      created_at: new Date('2023-06-02')
    },
    
    // Cykura Pools
    {
      address: 'cykura_sol_usdc_pool_5WKqvZQoZ8yZRmd5TchgzwA36DgsGKT37xQRmGcg3Y23',
      dex: DexType.CYKURA,
      pair: 'SOL/USDC',
      tvl: 1600000,
      volume_24h: 540000,
      apy: 5.4,
      created_at: new Date('2023-05-12')
    },
    
    // Lifinity Pools
    {
      address: 'lifinity_sol_usdc_pool_7XrHc8yn5MJRPpvwZ6oautJziGjMYB2dpzhV6gJCHvnk',
      dex: DexType.LIFINITY,
      pair: 'SOL/USDC',
      tvl: 1400000,
      volume_24h: 480000,
      apy: 5.7,
      created_at: new Date('2023-07-08')
    },
    
    // Crema Pools
    {
      address: 'crema_sol_usdc_pool_9XdPFW5zF7LCPmN7TCairA54qJhCiA3mn1UUY6RGGzMY',
      dex: DexType.CREMA,
      pair: 'SOL/USDC',
      tvl: 1250000,
      volume_24h: 420000,
      apy: 5.9,
      created_at: new Date('2023-08-15')
    },
    
    // Saber Pools
    {
      address: 'saber_usdc_usdt_pool_2poo1w1DL6yd2WNTCnNTzDqkC6MBXq7axo77P16yrBuf',
      dex: DexType.SABER,
      pair: 'USDC/USDT',
      tvl: 5500000,
      volume_24h: 1800000,
      apy: 1.2,
      created_at: new Date('2023-01-04')
    },
    
    // Invariant Pools
    {
      address: 'invariant_sol_usdc_pool_51LCBBzPbKRn3KvXQzGSQ4dNbiBS7n2CLcQcUKvbaDKU',
      dex: DexType.INVARIANT,
      pair: 'SOL/USDC',
      tvl: 1350000,
      volume_24h: 450000,
      apy: 5.5,
      created_at: new Date('2023-09-20')
    },
    
    // Pump.fun Pools (memecoin focused)
    {
      address: 'pumpfun_bonk_sol_pool_Gc67c8tY9QHeuRDiUYP6qQNuNMyXCnTrHMCwJxL82kXU',
      dex: DexType.PUMP_FUN,
      pair: 'BONK/SOL',
      tvl: 950000,
      volume_24h: 380000,
      apy: 8.2,
      created_at: new Date('2023-10-18')
    },
    {
      address: 'pumpfun_wif_sol_pool_FWEDmj2ngGZhPDWxW9sZQNYRGGhpTR5UCSAF8f1xQ2zE',
      dex: DexType.PUMP_FUN,
      pair: 'WIF/SOL',
      tvl: 820000,
      volume_24h: 370000,
      apy: 9.1,
      created_at: new Date('2023-11-25')
    },
    {
      address: 'pumpfun_gmgn_sol_pool_Bs91kduBcNQ7pnT47UXMZtfHoQgJo91vmqECXFbEEBvV',
      dex: DexType.PUMP_FUN,
      pair: 'GMGN/SOL',
      tvl: 580000,
      volume_24h: 320000,
      apy: 11.2,
      created_at: new Date('2024-01-15')
    },
    
    // Goose DEX Pools (memecoin focused)
    {
      address: 'goose_bonk_sol_pool_9xDzQEwGNcFzi2H9yF5U7Z4P9wP8YrD9GEd7ZRKSrJGR',
      dex: DexType.GOOSE,
      pair: 'BONK/SOL',
      tvl: 750000,
      volume_24h: 310000,
      apy: 9.5,
      created_at: new Date('2023-12-10')
    },
    {
      address: 'goose_wif_sol_pool_1JCYQy8gNrJJ3qkuMzHDL76CqMU7VAh5zP4Gd1fLk9G',
      dex: DexType.GOOSE,
      pair: 'WIF/SOL',
      tvl: 680000,
      volume_24h: 290000,
      apy: 10.2,
      created_at: new Date('2024-01-05')
    },
    
    // BonkSwap Pools
    {
      address: 'bonkswap_bonk_usdc_pool_2kd5K88PyLemMDTxGN7njdgVGyVZgHMPyYMWKzKvPxKU',
      dex: DexType.BONKSWAP,
      pair: 'BONK/USDC',
      tvl: 920000,
      volume_24h: 380000,
      apy: 8.8,
      created_at: new Date('2023-12-20')
    },
    {
      address: 'bonkswap_bonk_sol_pool_4A1BvBn9YwH5uJZ1fdMD5WMCKQjw5cFJxMYLgvY5jaw9',
      dex: DexType.BONKSWAP,
      pair: 'BONK/SOL',
      tvl: 850000,
      volume_24h: 350000,
      apy: 9.2,
      created_at: new Date('2023-12-25')
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