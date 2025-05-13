/**
 * DEX Information Module
 * 
 * Provides information about supported DEXes on Solana
 */

export enum DexType {
  Jupiter = 'jupiter',
  Openbook = 'openbook',
  Raydium = 'raydium',
  Orca = 'orca',
  Meteora = 'meteora',
  PumpFun = 'pump.fun',
  GMGN = 'gmgn',
  DexScreener = 'dexscreener',
  Moonshot = 'moonshot',
  Birdeye = 'birdeye'
}

export enum DexCategory {
  AMM = 'amm',
  OrderBook = 'orderbook',
  Aggregator = 'aggregator',
  Analytics = 'analytics',
  Launchpad = 'launchpad'
}

export enum LendingProtocolType {
  MarginFi = 'marginfi',
  Kamino = 'kamino',
  Mercurial = 'mercurial',
  Jet = 'jet',
  Bolt = 'bolt'
}

export interface DexInfo {
  id: string;
  name: string;
  url: string;
  active: boolean;
  features: string[];
  fees: {
    maker: number;
    taker: number;
  };
}

// List of supported DEXes
const dexes: DexInfo[] = [
  {
    id: 'jupiter',
    name: 'Jupiter',
    url: 'https://jup.ag',
    active: true,
    features: ['swap', 'aggregator', 'limit-orders'],
    fees: {
      maker: 0.0,
      taker: 0.0003
    }
  },
  {
    id: 'openbook',
    name: 'Openbook',
    url: 'https://openbookdex.com',
    active: true,
    features: ['orderbook', 'limit-orders'],
    fees: {
      maker: -0.0002,
      taker: 0.0004
    }
  },
  {
    id: 'raydium',
    name: 'Raydium',
    url: 'https://raydium.io',
    active: true,
    features: ['amm', 'pools', 'staking'],
    fees: {
      maker: 0.0,
      taker: 0.0005
    }
  },
  {
    id: 'orca',
    name: 'Orca',
    url: 'https://www.orca.so',
    active: true,
    features: ['amm', 'pools', 'concentrated-liquidity'],
    fees: {
      maker: 0.0,
      taker: 0.0003
    }
  },
  {
    id: 'meteora',
    name: 'Meteora',
    url: 'https://meteora.ag',
    active: true,
    features: ['amm', 'pools', 'concentrated-liquidity'],
    fees: {
      maker: 0.0,
      taker: 0.0004
    }
  },
  {
    id: 'pump.fun',
    name: 'pump.fun',
    url: 'https://pump.fun',
    active: true,
    features: ['memecoins', 'launchpad', 'swap'],
    fees: {
      maker: 0.0,
      taker: 0.0025
    }
  },
  {
    id: 'gmgn',
    name: 'GMGN',
    url: 'https://gmgn.ai',
    active: true,
    features: ['ai-powered', 'intelligent-swap', 'predictive-algo'],
    fees: {
      maker: 0.0,
      taker: 0.0005
    }
  },
  {
    id: 'dexscreener',
    name: 'DEX Screener',
    url: 'https://dexscreener.com',
    active: true,
    features: ['market-data', 'analytics', 'screening'],
    fees: {
      maker: 0.0,
      taker: 0.0
    }
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    url: 'https://moonshot.com',
    active: true,
    features: ['launchpad', 'token-generator', 'staking'],
    fees: {
      maker: 0.0,
      taker: 0.0020
    }
  },
  {
    id: 'birdeye',
    name: 'Birdeye',
    url: 'https://birdeye.so',
    active: true,
    features: ['analytics', 'real-time-data', 'portfolio-tracking'],
    fees: {
      maker: 0.0,
      taker: 0.0
    }
  }
];

/**
 * Get all supported DEXes
 */
export function getAllDexes(): DexInfo[] {
  return dexes;
}

/**
 * Get DEX by ID
 */
export function getDexById(id: string): DexInfo | undefined {
  return dexes.find(dex => dex.id === id);
}

/**
 * Get active DEXes
 */
export function getActiveDexes(): DexInfo[] {
  return dexes.filter(dex => dex.active);
}

/**
 * Get DEXes by feature
 */
export function getDexesByFeature(feature: string): DexInfo[] {
  return dexes.filter(dex => dex.features.includes(feature));
}