/**
 * Quantum Omega Configuration
 * 
 * This file contains the configuration for the Quantum Omega memecoin sniping agent.
 * It integrates with MemeCorTeX transformer for advanced memecoin market analysis and trading.
 */

import { logger } from '../logger';
import { SYSTEM_WALLET_ADDRESS } from '../agents';

export interface QuantumOmegaConfig {
  active: boolean;
  mode: 'sniper' | 'scalper' | 'swing' | 'hybrid';
  wallets: {
    trading: string;
    profit: string;
    fee?: string;
    stealth?: string[];
    auxiliary?: string[];
  };
  // MemeCorTeX integration settings
  memecortex: {
    enabled: boolean;
    connectionId: string;
    sentimentThreshold: number;
    socialSignalWeight: number;
    technicalSignalWeight: number;
    fundamentalSignalWeight: number;
    useAdvancedSentiment: boolean;
  };
  // Trading parameters
  trading: {
    maxPositionSizeUsd: number;
    minPositionSizeUsd: number;
    maxSlippageBps: number;
    targetProfitPercentMin: number; // 7% minimum profit target
    targetProfitPercentMax: number; // Up to 1000%+ for moonshots
    stopLossPercent: number;
    trailingStopEnabled: boolean;
    trailingStopPercent: number;
    dynamicExitStrategy: boolean; // Adjust exit based on momentum
    timeoutMinutes: number;
    gasAdjustmentFactor: number;
    priorityFeeLevel: 'low' | 'medium' | 'high' | 'max';
  };
  // Screening parameters
  screening: {
    marketCapMaxUsd: number; // Maximum market cap to consider
    marketCapMinUsd: number; // Minimum market cap to screen
    minLiquidityUsd: number; // Minimum liquidity pool size
    maxTokensToTrack: number; // Maximum tokens to track at once
    whitelistedDexes: string[]; // DEXes to monitor for new tokens
    blacklistedTokens: string[]; // Tokens to avoid
    newPoolDetection: boolean; // Enable new pool detection
    darkPoolDiscovery: boolean; // Enable dark pool discovery
    mempoolWatching: boolean; // Enable mempool watching for early detection
    liquidityDrainDetection: boolean; // Detect liquidity drain events
  };
  // Risk management
  riskManagement: {
    maxActivePositions: number;
    maxDailyPositions: number;
    maxTotalExposureUsd: number;
    perTokenMaxExposureUsd: number;
    cooldownAfterLossMinutes: number;
    reducePositionAfterLosses: number;
    maxDrawdownPercent: number;
    requireTokenValidation: boolean; // Check token contract safety
  };
}

// Default configuration optimized for profitable memecoin trading with MemeCorTeX integration
export const getDefaultQuantumOmegaConfig = (): QuantumOmegaConfig => {
  return {
    active: true,
    mode: 'hybrid',
    wallets: {
      trading: SYSTEM_WALLET_ADDRESS, // Use system wallet until dedicated one is funded
      profit: '2fZ1XPa3kuGWPgitv3DE1awpa1FEE4JFyVLpUYCZwzDJ',
      fee: 'Hs4sAwLN2QgvU6dW3JaRNNzWydQRfA9M3b59HgaEpxeQ',
      stealth: ['Ckx2B2PKVCyYEVnJa8DxCnoXxTvGbbw39jQAvoLhPLuM'],
      auxiliary: [] // Additional wallets for high volume periods
    },
    memecortex: {
      enabled: true,
      connectionId: 'memecortex-neural-1',
      sentimentThreshold: 65, // Only trade tokens with >65% positive sentiment
      socialSignalWeight: 0.4, // 40% weight for social signals
      technicalSignalWeight: 0.3, // 30% weight for technical analysis
      fundamentalSignalWeight: 0.3, // 30% weight for fundamental analysis
      useAdvancedSentiment: true // Use advanced sentiment analysis
    },
    trading: {
      maxPositionSizeUsd: 500, // Max $500 per position
      minPositionSizeUsd: 20, // Min $20 per position
      maxSlippageBps: 300, // Allow up to 3% slippage for memecoins
      targetProfitPercentMin: 7, // Minimum 7% profit target
      targetProfitPercentMax: 1000, // Up to 1000% for moonshots
      stopLossPercent: 5, // 5% stop loss
      trailingStopEnabled: true,
      trailingStopPercent: 15, // Trail by 15%
      dynamicExitStrategy: true, // Adjust exit based on momentum
      timeoutMinutes: 240, // 4 hour max hold time
      gasAdjustmentFactor: 1.5, // Increase gas by 1.5x when needed
      priorityFeeLevel: 'high' // Use high priority fees for faster execution
    },
    screening: {
      marketCapMaxUsd: 50000000, // $50M max market cap
      marketCapMinUsd: 10000, // $10K min market cap
      minLiquidityUsd: 5000, // $5K min liquidity
      maxTokensToTrack: 100, // Track up to 100 tokens
      whitelistedDexes: [
        'jupiter', 'raydium', 'orca', 'bonkswap', 'pump_fun', 'goose', 
        'hellbenders', 'phoenix', 'tensor', 'sanctum', 'openbook'
      ],
      blacklistedTokens: [], // Dynamically updated
      newPoolDetection: true,
      darkPoolDiscovery: true,
      mempoolWatching: true,
      liquidityDrainDetection: true
    },
    riskManagement: {
      maxActivePositions: 10,
      maxDailyPositions: 30,
      maxTotalExposureUsd: 1000, // $1000 total exposure
      perTokenMaxExposureUsd: 250, // Max $250 per token
      cooldownAfterLossMinutes: 30, // 30 min cooldown after loss
      reducePositionAfterLosses: 3, // Reduce position size after 3 losses
      maxDrawdownPercent: 20, // 20% max drawdown before stopping
      requireTokenValidation: true // Validate token contracts
    }
  };
};

// Initialize Quantum Omega with default config
export const quantumOmegaConfig = getDefaultQuantumOmegaConfig();

export const updateQuantumOmegaConfig = (updatedConfig: Partial<QuantumOmegaConfig>): QuantumOmegaConfig => {
  try {
    // Deep merge the updated config with the current config
    const newConfig = {
      ...quantumOmegaConfig,
      ...updatedConfig,
      wallets: {
        ...quantumOmegaConfig.wallets,
        ...(updatedConfig.wallets || {})
      },
      memecortex: {
        ...quantumOmegaConfig.memecortex,
        ...(updatedConfig.memecortex || {})
      },
      trading: {
        ...quantumOmegaConfig.trading,
        ...(updatedConfig.trading || {})
      },
      screening: {
        ...quantumOmegaConfig.screening,
        ...(updatedConfig.screening || {})
      },
      riskManagement: {
        ...quantumOmegaConfig.riskManagement,
        ...(updatedConfig.riskManagement || {})
      }
    };

    // Apply the updated config
    Object.assign(quantumOmegaConfig, newConfig);
    
    logger.info(`Quantum Omega configuration updated`);
    logger.info(`Mode: ${quantumOmegaConfig.mode}, MemeCorTeX enabled: ${quantumOmegaConfig.memecortex.enabled}`);
    
    return quantumOmegaConfig;
  } catch (error) {
    logger.error('Error updating Quantum Omega configuration:', error);
    return quantumOmegaConfig;
  }
};

export default quantumOmegaConfig;