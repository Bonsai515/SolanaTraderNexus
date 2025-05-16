/**
 * Activate Real Blockchain Trading
 * 
 * This script activates real blockchain trading with the following features:
 * 1. Live Solana blockchain transactions using Nexus Professional Engine
 * 2. RPC connection management with automatic failover and rate limiting
 * 3. Pyth price oracle integration for real-time pricing data
 * 4. Flash loan integration via Solend protocol
 * 5. Nuclear trading strategies optimized for real-time execution
 */

import { activateLiveTrading } from './server/activate-live-trading';

// Run the activation process
console.log('Starting real blockchain trading activation...');

activateLiveTrading()
  .then((success) => {
    if (success) {
      console.log('\n========================================================');
      console.log('✅ REAL BLOCKCHAIN TRADING ACTIVATED SUCCESSFULLY');
      console.log('========================================================');
      console.log('System is now using real funds and executing transactions on the Solana blockchain.');
      console.log('Trading strategies are active and monitoring for opportunities.');
      console.log('Profit collection is running every 4 minutes with 95% reinvestment.');
      console.log('========================================================\n');
    } else {
      console.error('\n========================================================');
      console.error('❌ REAL BLOCKCHAIN TRADING ACTIVATION FAILED');
      console.error('========================================================');
      console.error('Please check the logs for more details on the errors.');
      console.error('You can find logs in the ./logs directory.');
      console.error('========================================================\n');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error(`ERROR: ${error.message}`);
    console.error('Activation failed due to an unexpected error.');
    process.exit(1);
  });