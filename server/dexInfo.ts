/**
 * DEX Information Module
 * 
 * Provides information about supported DEXes on Solana
 */

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