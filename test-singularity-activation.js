/**
 * Test script for the Singularity agent activation API
 * 
 * This script makes a request to the activation endpoint to start
 * the Singularity agent for cross-chain arbitrage trading.
 */

const fetch = require('node-fetch');

/**
 * Test the Singularity activation endpoint
 */
async function testSingularityActivation() {
  try {
    console.log('Testing Singularity agent activation...');
    
    // Define the API endpoint
    const apiUrl = 'http://localhost:5000/api/singularity/activate';
    
    // Define the activation parameters
    const activationParams = {
      mode: process.argv[2] || 'dry_run', // Default to dry_run if not specified
      useSystemWallet: true,
      minProfitPct: 0.5,
      maxInput: 100.0,
      tradingWallet: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
      profitWallet: '6bLfHsp6eCFWZqGKZQaRwpVVLZRwKqcLt6QCKwLoxTqF',
      feeWallet: '9aBt1zPRUZmxttZ6Mk9AAU6XGS1TLQMZkpbCNBLH2Y2z'
    };
    
    console.log(`Activation mode: ${activationParams.mode}`);
    console.log(`Using system wallet: ${activationParams.useSystemWallet}`);
    console.log(`Min profit percentage: ${activationParams.minProfitPct}%`);
    console.log(`Max input: ${activationParams.maxInput} USDC`);
    console.log(`Trading wallet: ${activationParams.tradingWallet}`);
    console.log(`Profit wallet: ${activationParams.profitWallet}`);
    console.log(`Fee wallet: ${activationParams.feeWallet}`);
    
    // Make the API request
    console.log(`Sending POST request to ${apiUrl}...`);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(activationParams)
    });
    
    // Parse the response
    const responseData = await response.json();
    
    // Print the response
    console.log('\nServer response:');
    console.log(JSON.stringify(responseData, null, 2));
    
    // Check if the activation was successful
    if (response.status === 200 && responseData.status === 'success') {
      console.log('\n✅ Singularity agent activated successfully!');
      
      if (responseData.agent && responseData.agent.useRealFunds) {
        console.log('\n⚠️ WARNING: Singularity is running in LIVE TRADING mode with REAL FUNDS!');
      } else {
        console.log('\nℹ️ Singularity is running in dry run mode (no real trades).');
      }
      
      // Print instructions for checking status and stopping the agent
      console.log('\nTo check agent status:');
      console.log('node test-singularity-status.js');
      
      console.log('\nTo stop the agent:');
      console.log('node test-singularity-stop.js');
    } else {
      console.log('\n❌ Failed to activate Singularity agent.');
      console.log(`Status: ${response.status}`);
      console.log(`Error: ${responseData.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('\n❌ Error testing Singularity activation:', error.message);
    
    // Provide troubleshooting suggestions
    console.log('\nTroubleshooting suggestions:');
    console.log('1. Make sure the server is running on port 5000');
    console.log('2. Check if the activation endpoint is configured correctly');
    console.log('3. Verify that the Singularity agent is properly initialized');
    console.log('4. Check server logs for more detailed error information');
  }
}

// Run the test
testSingularityActivation();

// Usage instructions
if (process.argv.length <= 2) {
  console.log('\nUsage:');
  console.log('node test-singularity-activation.js [mode]');
  console.log('  mode: scan_only, dry_run, or live_trading (default: dry_run)');
  console.log('\nExamples:');
  console.log('  node test-singularity-activation.js scan_only   # Scan only, no trades');
  console.log('  node test-singularity-activation.js dry_run     # Simulate trades, no real funds');
  console.log('  node test-singularity-activation.js live_trading  # REAL FUNDS TRADING');
}