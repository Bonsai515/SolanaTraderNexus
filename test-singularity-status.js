/**
 * Test script for the Singularity agent status API
 * 
 * This script makes a request to the status endpoint to check
 * the current status of the Singularity agent.
 */

const fetch = require('node-fetch');

/**
 * Test the Singularity status endpoint
 */
async function testSingularityStatus() {
  try {
    console.log('Checking Singularity agent status...');
    
    // Define the API endpoint
    const apiUrl = 'http://localhost:5000/api/singularity/status';
    
    // Make the API request
    console.log(`Sending GET request to ${apiUrl}...`);
    const response = await fetch(apiUrl);
    
    // Parse the response
    const responseData = await response.json();
    
    // Print the response
    console.log('\nServer response:');
    console.log(JSON.stringify(responseData, null, 2));
    
    // Check the status
    if (response.status === 200) {
      console.log('\n✅ Status request successful');
      
      if (responseData.status === 'running') {
        console.log('\n🚀 Singularity agent is running');
        
        if (responseData.data) {
          console.log('\nAgent details:');
          console.log(`PID: ${responseData.data.pid}`);
          console.log(`Uptime: ${responseData.data.uptime}`);
          
          if (responseData.data.agent) {
            console.log(`Agent ID: ${responseData.data.agent.id}`);
            console.log(`Agent name: ${responseData.data.agent.name}`);
            console.log(`Agent type: ${responseData.data.agent.type}`);
            console.log(`Agent status: ${responseData.data.agent.status}`);
          }
          
          if (responseData.data.resources) {
            console.log('\nResource usage:');
            console.log(`CPU: ${responseData.data.resources.cpu}`);
            console.log(`Memory: ${responseData.data.resources.memory}`);
          }
          
          if (responseData.data.metrics) {
            console.log('\nPerformance metrics:');
            console.log(`Opportunities: ${responseData.data.metrics.opportunities}`);
            console.log(`Scans: ${responseData.data.metrics.scans}`);
            console.log(`Executions: ${responseData.data.metrics.executions}`);
            console.log(`Profit: $${responseData.data.metrics.profit.toFixed(2)}`);
          }
        }
      } else if (responseData.status === 'stopped') {
        console.log('\n⚠️ Singularity agent is not running');
        console.log(`Message: ${responseData.message}`);
      } else {
        console.log(`\n❓ Singularity agent status: ${responseData.status}`);
        console.log(`Message: ${responseData.message}`);
      }
    } else {
      console.log('\n❌ Failed to retrieve Singularity agent status');
      console.log(`Status: ${response.status}`);
      console.log(`Error: ${responseData.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('\n❌ Error checking Singularity status:', error.message);
    
    // Provide troubleshooting suggestions
    console.log('\nTroubleshooting suggestions:');
    console.log('1. Make sure the server is running on port 5000');
    console.log('2. Check if the status endpoint is configured correctly');
    console.log('3. Verify that the Singularity agent is properly initialized');
    console.log('4. Check server logs for more detailed error information');
  }
}

// Run the test
testSingularityStatus();