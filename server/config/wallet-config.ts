/**
 * Wallet Configuration
 * 
 * This file contains wallet addresses and configuration for the trading system.
 */

export const WALLET_CONFIG = {
  // Primary trading wallet
  TRADING_WALLET: 'HPN9rV3Ja5FCgT3WiNLK6PWrPkLZs3zXE1QWWwJGmvmF',
  
  // Prophet wallet for profit collection
  PROPHET_WALLET: 'HPN9rV3Ja5FCgT3WiNLK6PWrPkLZs3zXE1QWWwJGmvmF',
  
  // Default wallet allocation percentages
  DEFAULT_ALLOCATION: {
    TRADING: 95, // 95% for trading
    PROPHET: 5   // 5% for prophet
  },
  
  // Minimum balance thresholds (in SOL)
  MIN_BALANCE: {
    TRADING: 0.05,
    PROPHET: 0.01
  }
};

// Export default for easy importing
export default WALLET_CONFIG;