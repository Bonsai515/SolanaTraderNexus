/**
 * Wormhole Configuration
 * 
 * This file contains configuration settings for Wormhole integration,
 * enabling cross-chain capabilities for the Singularity agent.
 */

export const WORMHOLE_CONFIG = {
  // Mainnet Guardian RPC Endpoints
  MAINNET_GUARDIAN_RPC: [
    "https://api.wormholescan.io", // Explorer offers a guardian equivalent endpoint for fetching VAAs
    "https://wormhole-v2-mainnet-api.mcf.rocks",
    "https://wormhole-v2-mainnet-api.chainlayer.network",
    "https://wormhole-v2-mainnet-api.staking.fund",
  ],
  
  // Network Configuration
  NETWORKS: {
    SOLANA: {
      id: 1,
      name: "Solana",
      chainId: "1",
      nodeUrl: process.env.INSTANT_NODES_RPC_URL || "https://api.mainnet-beta.solana.com",
      tokenBridgeAddress: "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb",
      coreBridgeAddress: "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth",
      wormholeAddress: "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth",
    },
    ETHEREUM: {
      id: 2,
      name: "Ethereum",
      chainId: "1",
      nodeUrl: "https://eth-mainnet.g.alchemy.com/v2/demo",  // Replace with actual Ethereum RPC
      tokenBridgeAddress: "0x3ee18B2214AFF97000D974cf647E7C347E8fa585",
      coreBridgeAddress: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
      wormholeAddress: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
    },
    BSC: {
      id: 4, 
      name: "BinanceSmartChain",
      chainId: "56",
      nodeUrl: "https://bsc-dataseed.binance.org",
      tokenBridgeAddress: "0xB6F6D86a8f9879A9c87f643768d9efc38c1Da6E7",
      coreBridgeAddress: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
      wormholeAddress: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
    },
    POLYGON: {
      id: 5,
      name: "Polygon",
      chainId: "137",
      nodeUrl: "https://polygon-rpc.com",
      tokenBridgeAddress: "0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7",
      coreBridgeAddress: "0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7",
      wormholeAddress: "0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7",
    },
    AVALANCHE: {
      id: 6,
      name: "Avalanche",
      chainId: "43114",
      nodeUrl: "https://api.avax.network/ext/bc/C/rpc",
      tokenBridgeAddress: "0x0e082F06FF657D94310cB8cE8B0D9a04541d8052",
      coreBridgeAddress: "0x54a8e5f9c4CbA08F9943965859F6c34eAF03E26c",
      wormholeAddress: "0x54a8e5f9c4CbA08F9943965859F6c34eAF03E26c",
    },
  },
  
  // Default timeout for cross-chain operations (15 seconds)
  DEFAULT_TIMEOUT: 15000,
  
  // Maximum retry attempts for Guardian RPC calls
  MAX_RETRY_COUNT: 3,
  
  // Retry delay in milliseconds (starting value, will be increased exponentially)
  RETRY_DELAY: 1000,
  
  // Minimum profit percentage required for cross-chain arbitrage (0.5%)
  MIN_PROFIT_PERCENTAGE: 0.5,
  
  // Maximum amount to use in a single cross-chain arbitrage opportunity (in USD)
  MAX_TRANSACTION_AMOUNT_USD: 1000,
  
  // Gas price multiplier for Ethereum and EVM chains
  GAS_PRICE_MULTIPLIER: 1.2,
  
  // Priority fee for Ethereum (in gwei)
  ETH_PRIORITY_FEE: 2,
  
  // Timeout for VAA (Verified Action Approval) retrieval (30 seconds)
  VAA_RETRIEVAL_TIMEOUT: 30000,
  
  // Supported token pairs for cross-chain arbitrage
  SUPPORTED_TOKENS: {
    "USDC": {
      solana: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      bsc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      polygon: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      avalanche: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    },
    "USDT": {
      solana: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      bsc: "0x55d398326f99059fF775485246999027B3197955",
      polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      avalanche: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    },
    "WETH": {
      solana: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
      ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      bsc: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
      polygon: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
      avalanche: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
    },
    "WBTC": {
      solana: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
      ethereum: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      bsc: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
      polygon: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
      avalanche: "0x50b7545627a5162F82A992c33b87aDc75187B218",
    },
    "SOL": {
      solana: "So11111111111111111111111111111111111111112",
      ethereum: "0xD31a59c85aE9D8edEFeC411D448f90841571b89c",
      bsc: "0x570A5D26f7765Ecb712C0924E4De545B89fD43dF",
      polygon: "0xD93f7E271cB87c23AaA73edC008A79823D461031",
      avalanche: "0xFE6B19286885a4F7F55AdAD09C3Cd1f906D2478F",
    },
  },
  
  // Wormhole Explorer API base URL
  EXPLORER_API_URL: "https://api.wormholescan.io/api/v1",
  
  // Use testnet instead of mainnet (default: false)
  USE_TESTNET: false,
};

/**
 * Get the Wormhole Guardian RPC URL
 * This function randomly selects one of the Guardian RPC endpoints
 * to distribute load and provide failover capabilities
 */
export function getGuardianRpcUrl(): string {
  const endpoints = WORMHOLE_CONFIG.MAINNET_GUARDIAN_RPC;
  const randomIndex = Math.floor(Math.random() * endpoints.length);
  return endpoints[randomIndex];
}