/**
 * DEX Information Module
 *
 * Provides information about supported DEXes on Solana
 */

export enum DexType {
  Jupiter = "jupiter",
  Openbook = "openbook",
  Raydium = "raydium",
  Orca = "orca",
  Meteora = "meteora",
  PumpFun = "pump.fun",
  GMGN = "gmgn",
  DexScreener = "dexscreener",
  Moonshot = "moonshot",
  Birdeye = "birdeye",
  // New DEXs
  Drift = "drift",
  Cykura = "cykura",
  Symmetry = "symmetry",
  GooseFX = "goosefx",
  Saros = "saros",
  Lifinity = "lifinity",
  Atrix = "atrix",
  Crema = "crema",
  Step = "step",
}

export enum DexCategory {
  AMM = "amm",
  OrderBook = "orderbook",
  Aggregator = "aggregator",
  Analytics = "analytics",
  Launchpad = "launchpad",
  Perps = "perpetuals",
  Options = "options",
  CLMMs = "concentrated-liquidity",
  Staking = "staking",
  Synthetics = "synthetics",
  Margin = "margin",
  Lending = "lending",
}

export enum LendingProtocolType {
  MarginFi = "marginfi",
  Kamino = "kamino",
  Mercurial = "mercurial",
  Jet = "jet",
  Bolt = "bolt",
}

/**
 * Interface for DEX information
 */
export interface DexInfo {
  id: string;
  name: string;
  url: string;
  active: boolean;
  category: DexCategory;
  features: string[];
  fees: {
    maker: number;
    taker: number;
  };
  apiEndpoint?: string;
  rateLimit?: number;
  programId?: string;
}

// List of supported DEXes
const dexes: DexInfo[] = [
  {
    id: 'jupiter',
    name: 'Jupiter',
    url: 'https://jup.ag',
    active: true,
    category: DexCategory.Aggregator,
    features: ['swap', 'aggregator', 'limit-orders'],
    fees: {
      maker: 0.0,
      taker: 0.0003
    },
    apiEndpoint: 'https://quote-api.jup.ag/v6',
    rateLimit: 1 // 1 request per second as per your specification
  },
  {
    id: 'openbook',
    name: 'Openbook',
    url: 'https://openbookdex.com',
    active: true,
    category: DexCategory.OrderBook,
    features: ['orderbook', 'limit-orders'],
    fees: {
      maker: -0.0002,
      taker: 0.0004
    },
    programId: 'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX'
  },
  {
    id: 'raydium',
    name: 'Raydium',
    url: 'https://raydium.io',
    active: true,
    category: DexCategory.AMM,
    features: ['amm', 'pools', 'staking'],
    fees: {
      maker: 0.0,
      taker: 0.0005
    },
    programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'
  },
  {
    id: 'orca',
    name: 'Orca',
    url: 'https://www.orca.so',
    active: true,
    category: DexCategory.CLMMs,
    features: ['amm', 'pools', 'concentrated-liquidity'],
    fees: {
      maker: 0.0,
      taker: 0.0003
    },
    programId: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP'
  },
  {
    id: 'meteora',
    name: 'Meteora',
    url: 'https://meteora.ag',
    active: true,
    category: DexCategory.CLMMs,
    features: ['amm', 'pools', 'concentrated-liquidity'],
    fees: {
      maker: 0.0,
      taker: 0.0004
    },
    programId: 'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K'
  },
  {
    id: 'pump.fun',
    name: 'pump.fun',
    url: 'https://pump.fun',
    active: true,
    category: DexCategory.Launchpad,
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
    category: DexCategory.AMM,
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
    category: DexCategory.Analytics,
    features: ['market-data', 'analytics', 'screening'],
    fees: {
      maker: 0.0,
      taker: 0.0
    },
    apiEndpoint: 'https://api.dexscreener.com/latest/dex'
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    url: 'https://moonshot.com',
    active: true,
    category: DexCategory.Launchpad,
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
    category: DexCategory.Analytics,
    features: ['analytics', 'real-time-data', 'portfolio-tracking'],
    fees: {
      maker: 0.0,
      taker: 0.0
    },
    apiEndpoint: 'https://public-api.birdeye.so'
  },
  // New DEXs
  {
    id: 'drift',
    name: 'Drift Protocol',
    url: 'https://www.drift.trade',
    active: true,
    category: DexCategory.Perps,
    features: ['perpetuals', 'futures', 'margin', 'cross-collateral'],
    fees: {
      maker: -0.0001,
      taker: 0.0008
    },
    programId: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH'
  },
  {
    id: 'cykura',
    name: 'Cykura',
    url: 'https://cykura.io',
    active: true,
    category: DexCategory.CLMMs,
    features: ['concentrated-liquidity', 'custom-fees', 'multi-fee-tiers'],
    fees: {
      maker: 0.0,
      taker: 0.0003
    },
    programId: 'cysPXAjehMpVKUapzbMCCnpFxUFFryEWEaLgnb9NrR8'
  },
  {
    id: 'symmetry',
    name: 'Symmetry',
    url: 'https://symmetry.fi',
    active: true,
    category: DexCategory.Synthetics,
    features: ['synthetics', 'derivatives', 'forex', 'commodities'],
    fees: {
      maker: 0.0,
      taker: 0.0010
    },
    programId: 'SymjyfGKPqzCUKUfrS5X4iAmoBG66qgHrpKspYNSiL3'
  },
  {
    id: 'goosefx',
    name: 'GooseFX',
    url: 'https://goosefx.io',
    active: true,
    category: DexCategory.AMM,
    features: ['multi-asset-pools', 'cross-margin', 'nft-trading'],
    fees: {
      maker: 0.0,
      taker: 0.0005
    },
    programId: 'GFXsSL5sSaDfNFQUYsHjNKvzSjU4jSxSHXtLZ6sRs7Z'
  },
  {
    id: 'saros',
    name: 'Saros',
    url: 'https://saros.finance',
    active: true,
    category: DexCategory.AMM,
    features: ['amm', 'pools', 'yield-farming'],
    fees: {
      maker: 0.0,
      taker: 0.0004
    },
    programId: 'SSwapUtytfBdBn1b9NUGG6foMVPtcWgpRU32HToDUZr'
  },
  {
    id: 'lifinity',
    name: 'Lifinity',
    url: 'https://lifinity.io',
    active: true,
    category: DexCategory.AMM,
    features: ['adaptive-fee', 'concentrated-liquidity'],
    fees: {
      maker: 0.0,
      taker: 0.0001
    },
    programId: 'LFNVvCyYFNRqZ51FvuEsZURkatbwwPYH7MCzYEjyd9X'
  },
  {
    id: 'atrix',
    name: 'Atrix',
    url: 'https://atrix.finance',
    active: true,
    category: DexCategory.AMM,
    features: ['amm', 'farms', 'fixed-rate-pools'],
    fees: {
      maker: 0.0,
      taker: 0.0005
    },
    programId: 'AtrWTtUtjYvQDZYMFU8kBT43xrUmGEpnuYm6Zbsjd1Rf'
  },
  {
    id: 'crema',
    name: 'Crema Finance',
    url: 'https://crema.finance',
    active: true,
    category: DexCategory.CLMMs,
    features: ['concentrated-liquidity', 'tick-liquidity'],
    fees: {
      maker: 0.0,
      taker: 0.0003
    },
    programId: 'CRMxK5CEXTxaMfyUteYWBrwJzqiZZxW4TMYJy9qCASA'
  },
  {
    id: 'step',
    name: 'Step Finance',
    url: 'https://step.finance',
    active: true,
    category: DexCategory.AMM,
    features: ['staking', 'yield-farming', 'portfolio-tracker'],
    fees: {
      maker: 0.0,
      taker: 0.0004
    },
    programId: 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT'
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