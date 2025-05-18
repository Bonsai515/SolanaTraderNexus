/**
 * Start Trade Alert System Workflow
 * 
 * This script initializes the trade alert system as a background process.
 * It will continuously monitor all strategies for executed trades and send alerts.
 */

import { startAlertSystem, displayTradeSummary } from './trade-alert-system';

// Display initial summary
console.log('\n=======================================================');
console.log('🚀 STARTING TRADE ALERT SYSTEM');
console.log('=======================================================');
console.log('\nInitializing alerts for:');
console.log('1. Quantum Omega Meme Sniper strategy');
console.log('2. Quantum Flash Loan strategy');
console.log('3. Zero Capital Flash Loan strategy');
console.log('4. Hyperion Neural Flash strategy');

// Display initial summary if available
try {
  displayTradeSummary();
} catch (error) {
  console.log('\nNo trade history available yet. Starting fresh tracking.');
}

// Start the alert system
console.log('\nStarting continuous trade monitoring...');
startAlertSystem();

// Keep the process running
console.log('\n✅ Alert system successfully started!');
console.log('This process will continue running in the background.');
console.log('You will receive notifications when trades are executed.');

// This will keep the process running indefinitely
setInterval(() => {
  // This empty interval keeps the script alive
}, 60000);