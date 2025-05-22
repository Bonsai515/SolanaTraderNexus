/**
 * Rate Limiting Configuration
 * 
 * This file controls the rate limiting settings for various API providers
 * to prevent 429 Too Many Requests errors.
 */

export const RATE_LIMIT_CONFIG = {
  // Default rate limit settings (for unknown providers)
  DEFAULT: {
    requestsPerMinute: 30,
    maxConcurrent: 3,
    backoffMultiplier: 1.5,
    initialBackoffMs: 1000,
    maxBackoffMs: 30000,
    cooldownAfterFailures: 5,
    cooldownTimeMs: 60000
  },
  
  // Provider-specific settings
  PROVIDERS: {
    // CoinGecko has strict free tier limits
    COINGECKO: {
      requestsPerMinute: 10,
      maxConcurrent: 1,
      backoffMultiplier: 2.0,
      initialBackoffMs: 2000,
      maxBackoffMs: 60000,
      cooldownAfterFailures: 3,
      cooldownTimeMs: 120000
    },
    
    // Jupiter API rate limiting
    JUPITER: {
      requestsPerMinute: 60,
      maxConcurrent: 4,
      backoffMultiplier: 1.5,
      initialBackoffMs: 1000,
      maxBackoffMs: 15000,
      cooldownAfterFailures: 5,
      cooldownTimeMs: 30000
    },
    
    // Solana RPC endpoints
    SOLANA_RPC: {
      requestsPerMinute: 40,
      maxConcurrent: 3,
      backoffMultiplier: 1.5,
      initialBackoffMs: 1000,
      maxBackoffMs: 20000,
      cooldownAfterFailures: 5,
      cooldownTimeMs: 30000
    },
    
    // DexScreener API
    DEX_SCREENER: {
      requestsPerMinute: 20,
      maxConcurrent: 2,
      backoffMultiplier: 1.5,
      initialBackoffMs: 1000,
      maxBackoffMs: 15000,
      cooldownAfterFailures: 4,
      cooldownTimeMs: 45000
    },
    
    // Birdeye API
    BIRDEYE: {
      requestsPerMinute: 15,
      maxConcurrent: 1,
      backoffMultiplier: 2.0,
      initialBackoffMs: 2000,
      maxBackoffMs: 30000,
      cooldownAfterFailures: 3,
      cooldownTimeMs: 90000
    }
  }
};

export default RATE_LIMIT_CONFIG;