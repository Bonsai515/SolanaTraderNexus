const fetch = require('node-fetch');
const WebSocket = require('ws');

/**
 * Test file for the full trading system with transformers and agents
 */
async function testTradingSystem() {
  console.log('Testing Full Trading System');
  
  // Step 1: Check system status
  try {
    console.log('\n1. Checking System Status:');
    const statusResponse = await fetch('http://localhost:5000/api/status');
    const statusData = await statusResponse.json();
    console.log(JSON.stringify(statusData, null, 2));
  } catch (error) {
    console.error('Error checking system status:', error.message);
  }
  
  // Step 2: Get transformer status
  try {
    console.log('\n2. Checking Transformer API status:');
    const aiStatusResponse = await fetch('http://localhost:5000/api/ai/status');
    const aiStatusData = await aiStatusResponse.json();
    console.log(JSON.stringify(aiStatusData, null, 2));
  } catch (error) {
    console.error('Error checking transformer status:', error.message);
  }
  
  // Step 3: Get agent status
  try {
    console.log('\n3. Checking Agent status:');
    const agentStatusResponse = await fetch('http://localhost:5000/api/agents/status');
    const agentStatusData = await agentStatusResponse.json();
    console.log(JSON.stringify(agentStatusData, null, 2));
  } catch (error) {
    console.error('Error checking agent status:', error.message);
  }
  
  // Step 4: Get all agents
  try {
    console.log('\n4. Getting all agents:');
    const agentsResponse = await fetch('http://localhost:5000/api/agents');
    const agentsData = await agentsResponse.json();
    console.log(JSON.stringify(agentsData, null, 2));
  } catch (error) {
    console.error('Error getting agents:', error.message);
  }

  // Step 5: Make SOL/USDC prediction
  try {
    console.log('\n5. Testing SOL/USDC prediction:');
    const solResponse = await fetch('http://localhost:5000/api/ai/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pair: 'SOL/USDC',
        windowSeconds: 3600,
        marketData: {
          pair: 'SOL/USDC',
          prices: [[new Date().toISOString(), 150.25]],
          volumes: [[new Date().toISOString(), 1000000]],
          orderBooks: [],
          indicators: {},
          externalData: {}
        }
      })
    });
    
    const solData = await solResponse.json();
    console.log(JSON.stringify(solData, null, 2));
  } catch (error) {
    console.error('Error testing SOL/USDC prediction:', error.message);
  }
  
  // Step 6: Start agent system (if not already running)
  try {
    console.log('\n6. Starting agent system:');
    const startResponse = await fetch('http://localhost:5000/api/agents/start', {
      method: 'POST'
    });
    
    const startData = await startResponse.json();
    console.log(JSON.stringify(startData, null, 2));
  } catch (error) {
    console.error('Error starting agent system:', error.message);
  }
  
  // Step 7: Connect to WebSocket for real-time updates (run for 10 seconds)
  console.log('\n7. Connecting to WebSocket for real-time updates (10 seconds):');
  const ws = new WebSocket('ws://localhost:5000/ws');
  
  ws.on('open', () => {
    console.log('WebSocket connection established');
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('Received message:', message);
    } catch (e) {
      console.log('Received message:', data.toString());
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
  
  // Wait for 10 seconds to observe WebSocket messages
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Close the WebSocket
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  
  // Step 8: Activate Hyperion agent
  try {
    console.log('\n8. Activating Hyperion agent:');
    const activateResponse = await fetch('http://localhost:5000/api/agents/hyperion-1/activate', {
      method: 'POST'
    });
    
    const activateData = await activateResponse.json();
    console.log(JSON.stringify(activateData, null, 2));
  } catch (error) {
    console.error('Error activating Hyperion agent:', error.message);
  }
  
  // Final step: Stop agent system
  try {
    console.log('\n9. Stopping agent system:');
    const stopResponse = await fetch('http://localhost:5000/api/agents/stop', {
      method: 'POST'
    });
    
    const stopData = await stopResponse.json();
    console.log(JSON.stringify(stopData, null, 2));
  } catch (error) {
    console.error('Error stopping agent system:', error.message);
  }
}

// Run the test
testTradingSystem().catch(console.error).finally(() => {
  console.log('\nTest complete');
  process.exit(0);
});