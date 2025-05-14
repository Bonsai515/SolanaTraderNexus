/**
 * Test Perplexity AI Integration with Live API
 * 
 * This script tests that the Perplexity AI integration is working by making
 * a real API call to analyze the SOL token. It outputs the results to the console.
 */

require('dotenv').config();
import axios from 'axios';

// Constants
const PORT = process.env.PORT || 5000;
const SERVER_URL = `http://localhost:${PORT}`;
const TOKEN_TO_TEST = 'SOL';

async function testPerplexityIntegration() {
  console.log('Testing Perplexity AI integration...');
  
  try {
    // First check if Perplexity API is configured
    console.log('Checking Perplexity API status...');
    const statusResponse = await axios.get(`${SERVER_URL}/api/perplexity/status`);
    console.log('Status:', statusResponse.data);
    
    if (!statusResponse.data.initialized) {
      console.error('\n❌ Perplexity API is not initialized. Please set the PERPLEXITY_API_KEY environment variable.');
      return false;
    }
    
    console.log(`\n✅ Perplexity API is operational with model: ${statusResponse.data.model}`);
    
    // Test token analysis
    console.log(`\nAnalyzing ${TOKEN_TO_TEST} token...`);
    const analysisResponse = await axios.get(`${SERVER_URL}/api/perplexity/analyze/${TOKEN_TO_TEST}`);
    
    console.log('\n----- Token Analysis Results -----');
    console.log(analysisResponse.data.analysis);
    console.log('----------------------------------\n');
    
    // Test market sentiment
    console.log(`\nGetting market sentiment for ${TOKEN_TO_TEST}...`);
    const sentimentResponse = await axios.get(`${SERVER_URL}/api/perplexity/sentiment/${TOKEN_TO_TEST}`);
    
    console.log('\n----- Market Sentiment Results -----');
    console.log(sentimentResponse.data.sentiment);
    console.log('-----------------------------------\n');
    
    console.log('\n✅ Perplexity AI integration tests completed successfully.');
    return true;
  } catch (error) {
    console.error('\n❌ Error testing Perplexity AI integration:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Execute the test
testPerplexityIntegration()
  .then(success => {
    if (!success) {
      console.log('\nNOTE: If you need to set up the Perplexity API key, please add it to your .env file:');
      console.log('PERPLEXITY_API_KEY=your_api_key_here');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });