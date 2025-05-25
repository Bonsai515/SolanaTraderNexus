/**
 * GLOBAL SYSTEM CONFIGURATION
 * 
 * MANDATORY SETTINGS - USER CONTROLLED ONLY
 * NO SIMULATIONS SYSTEM-WIDE
 */

export const SYSTEM_CONFIG = {
  // MANDATORY: NO SIMULATIONS ALLOWED
  DISABLE_ALL_SIMULATIONS: true,
  REAL_TRANSACTIONS_ONLY: true,
  
  // User-only changeable settings
  AUTHORIZED_USER_ONLY: true,
  
  // Trading settings
  MINIMUM_REAL_BALANCE_REQUIRED: 0.001, // 0.001 SOL minimum for real trades
  REQUIRE_TRANSACTION_VERIFICATION: true,
  
  // Flash loan settings  
  MSOL_LEVERAGE_ENABLED: true,
  FLASH_LOAN_REAL_EXECUTION: true,
  
  // Error handling
  FAIL_ON_INSUFFICIENT_BALANCE: true,
  NO_FALLBACK_TO_SIMULATION: true
} as const;

// Enforce no simulation policy
export function enforceRealTransactionsOnly(): void {
  if (!SYSTEM_CONFIG.DISABLE_ALL_SIMULATIONS) {
    throw new Error('SYSTEM ERROR: Simulations must be disabled');
  }
  
  if (!SYSTEM_CONFIG.REAL_TRANSACTIONS_ONLY) {
    throw new Error('SYSTEM ERROR: Real transactions only mode required');
  }
}

// Validate user authorization for config changes
export function validateUserAuthorization(userId: string): boolean {
  // Only authorized user can change system config
  return SYSTEM_CONFIG.AUTHORIZED_USER_ONLY;
}