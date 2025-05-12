/**
 * Test script for the Singularity agent deactivation API
 * 
 * This script makes a request to the deactivation endpoint to stop
 * the Singularity agent for cross-chain arbitrage trading.
 */

const fetch = require('node-fetch');

/**
 * Test the Singularity deactivation endpoint
 */
async function testSingularityDeactivation() {
  try {
    console.log('Testing Singularity agent deactivation...');
    
    // Define the API endpoint
    const apiUrl = 'http://localhost:5000/api/singularity/deactivate';
    
    // Make the API request
    console.log(`Sending POST request to ${apiUrl}...`);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Parse the response
    const responseData = await response.json();
    
    // Print the response
    console.log('\nServer response:');
    console.log(JSON.stringify(responseData, null, 2));
    
    // Check if the deactivation was successful
    if (response.status === 200 && responseData.status === 'success') {
      console.log('\n✅ Singularity agent deactivated successfully!');
      console.log(`Message: ${responseData.message}`);
      
      // Print instructions for checking status
      console.log('\nTo check agent status:');
      console.log('node test-singularity-status.js');
      
      // Print instructions for reactivating the agent
      console.log('\nTo reactivate the agent:');
      console.log('node test-singularity-activation.js [mode]');
    } else {
      console.log('\n❌ Failed to deactivate Singularity agent.');
      console.log(`Status: ${response.status}`);
      console.log(`Error: ${responseData.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('\n❌ Error deactivating Singularity agent:', error.message);
    
    // Provide troubleshooting suggestions
    console.log('\nTroubleshooting suggestions:');
    console.log('1. Make sure the server is running on port 5000');
    console.log('2. Check if the deactivation endpoint is configured correctly');
    console.log('3. Verify that the Singularity agent is properly initialized');
    console.log('4. Check server logs for more detailed error information');
  }
}

// Run the test
testSingularityDeactivation();