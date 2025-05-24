/**
 * Apply System-Wide Real-Only Configuration
 * Immediately activates real-only mode across entire platform
 */

import SystemWideRealOnlyEnforcement from './system-wide-real-only-enforcement';
import SYSTEM_CONFIG, { RealOnlyValidator } from './system-real-only-config';

console.log('🚀 ACTIVATING SYSTEM-WIDE REAL-ONLY CONFIGURATION');
console.log('================================================');

try {
  // Validate system configuration
  if (!SYSTEM_CONFIG.REAL_DATA_ONLY) {
    throw new Error('SYSTEM ERROR: Real-data-only mode must be enabled');
  }
  
  // Apply global real-only enforcement
  const enforcementStatus = SystemWideRealOnlyEnforcement.enforceGlobalRealOnly();
  
  // Validate enforcement was successful
  SystemWideRealOnlyEnforcement.validateSystemRealOnly();
  
  console.log('\n🎉 SYSTEM-WIDE REAL-ONLY CONFIGURATION ACTIVE! 🎉');
  console.log('=================================================');
  console.log('✅ ALL simulations disabled across entire platform');
  console.log('✅ ONLY real transactions permitted');
  console.log('✅ ONLY authentic data sources allowed');
  console.log('✅ NO mock, demo, or placeholder data');
  console.log('✅ ALL trading operations using real blockchain data');
  console.log('✅ ALL borrowing operations using real protocols');
  console.log('✅ ALL price feeds using authentic market data');
  console.log('✅ ALL wallet operations using real balances');
  console.log('✅ ALL arbitrage using real market opportunities');
  console.log('✅ ALL yield farming using real protocol rates');
  console.log('✅ ALL flash loans using real protocol integrations');
  console.log('✅ ALL neural networks using real market data');
  console.log('✅ ALL logging using authentic transaction data');
  
  console.log('\n📊 ENFORCEMENT STATUS:');
  console.log('=====================');
  Object.entries(enforcementStatus).forEach(([key, value]) => {
    const displayKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
    console.log(`✅ ${displayKey}: ${value}`);
  });
  
  console.log('\n⚠️ IMPORTANT: Your entire platform is now operating in REAL-ONLY mode');
  console.log('All components will ONLY use authentic data and real transactions');
  console.log('No simulations, demos, or mock data will be generated anywhere');
  
} catch (error) {
  console.error('❌ REAL-ONLY CONFIGURATION FAILED:', (error as Error).message);
  process.exit(1);
}

// Export for use in other modules
export { SystemWideRealOnlyEnforcement, SYSTEM_CONFIG, RealOnlyValidator };