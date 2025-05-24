/**
 * System-Wide Real-Only Configuration
 * Disables ALL simulations across the entire platform
 */

export const SYSTEM_CONFIG = {
  // Core system settings
  REAL_DATA_ONLY: true,
  DISABLE_ALL_SIMULATIONS: true,
  DISABLE_DEMO_TRANSACTIONS: true,
  DISABLE_PLACEHOLDER_DATA: true,
  DISABLE_MOCK_RESPONSES: true,
  
  // Transaction settings
  REAL_TRANSACTIONS_ONLY: true,
  REAL_BLOCKCHAIN_EXECUTION: true,
  NO_DEMO_AMOUNTS: true,
  ACTUAL_FEES_ONLY: true,
  
  // Data sources
  REAL_PRICE_DATA_ONLY: true,
  REAL_WALLET_BALANCES_ONLY: true,
  REAL_MARKET_DATA_ONLY: true,
  AUTHENTIC_API_RESPONSES_ONLY: true,
  
  // Logging and output
  NO_SIMULATED_LOGS: true,
  REAL_RESULTS_ONLY: true,
  NO_ESTIMATED_OUTCOMES: true,
  ACTUAL_TRANSACTION_CONFIRMATIONS_ONLY: true,
  
  // Error handling
  FAIL_ON_MOCK_DATA: true,
  REQUIRE_REAL_CONNECTIONS: true,
  NO_FALLBACK_SIMULATIONS: true
};

export class RealOnlyValidator {
  static validateRealData(data: any, source: string): boolean {
    if (!SYSTEM_CONFIG.REAL_DATA_ONLY) return true;
    
    // Check for simulation indicators
    const simulationKeywords = [
      'demo', 'mock', 'fake', 'placeholder', 'test', 'simulation',
      'estimated', 'simulated', 'representative', 'sample'
    ];
    
    const dataString = JSON.stringify(data).toLowerCase();
    for (const keyword of simulationKeywords) {
      if (dataString.includes(keyword)) {
        throw new Error(`SIMULATION DETECTED in ${source}: Contains ${keyword}. Real data only allowed.`);
      }
    }
    
    return true;
  }
  
  static validateRealTransaction(signature: string): boolean {
    if (!signature || signature.length !== 87 && signature.length !== 88) {
      throw new Error('INVALID TRANSACTION: Must be real Solana transaction signature');
    }
    return true;
  }
  
  static validateRealAmount(amount: number, context: string): boolean {
    if (amount <= 0) {
      throw new Error(`INVALID AMOUNT in ${context}: Must be real positive value`);
    }
    return true;
  }
}

export default SYSTEM_CONFIG;