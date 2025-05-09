const fetch = require('node-fetch');

async function testTransformer() {
  console.log('Testing Transformer API');
  
  // First check API status
  try {
    console.log('\nChecking Transformer API status:');
    const statusResponse = await fetch('http://localhost:5000/api/ai/status');
    const statusData = await statusResponse.json();
    console.log(JSON.stringify(statusData, null, 2));
  } catch (error) {
    console.error('Error checking API status:', error.message);
  }
  
  // Test SOL/USDC prediction
  console.log('\nTesting SOL/USDC prediction:');
  try {
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
    console.error('Error testing SOL/USDC:', error.message);
  }
  
  // Test BONK/USDC prediction
  console.log('\nTesting BONK/USDC prediction:');
  try {
    const bonkResponse = await fetch('http://localhost:5000/api/ai/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pair: 'BONK/USDC',
        windowSeconds: 3600,
        marketData: {
          pair: 'BONK/USDC',
          prices: [[new Date().toISOString(), 0.00000831]],
          volumes: [[new Date().toISOString(), 1000000000]],
          orderBooks: [],
          indicators: {},
          externalData: {}
        }
      })
    });
    
    const bonkData = await bonkResponse.json();
    console.log(JSON.stringify(bonkData, null, 2));
  } catch (error) {
    console.error('Error testing BONK/USDC:', error.message);
  }
}

testTransformer().catch(console.error);