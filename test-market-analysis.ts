/**
 * Test Market Analysis System
 * 
 * This script tests the complete market analysis system, including Perplexity AI
 * integration and local fallback capability. It demonstrates the system's resilience
 * when the external AI API is unavailable.
 */

require('dotenv').config();
import axios from 'axios';
import chalk from 'chalk';

// Constants
const PORT = process.env.PORT || 5000;
const SERVER_URL = `http://localhost:${PORT}`;
const TOKENS_TO_TEST = ['SOL', 'BONK', 'JUP'];

async function testMarketAnalysisSystem() {
  console.log(chalk.blue('=== Testing Complete Market Analysis System ===\n'));
  
  // Test Perplexity API status
  try {
    console.log(chalk.blue('Checking Perplexity API status...'));
    const statusResponse = await axios.get(`${SERVER_URL}/api/perplexity/status`);
    console.log(chalk.green('Perplexity API Status:'), statusResponse.data);
    
    // If Perplexity API is not initialized, let's make sure our fallback works
    if (!statusResponse.data.initialized) {
      console.log(chalk.yellow('\nPerplexity API is not initialized, testing fallback mechanisms...'));
    } else {
      console.log(chalk.green('\nPerplexity API is available, continuing with tests...\n'));
    }
  } catch (error) {
    console.error(chalk.red('Error checking Perplexity API status:'), error.message);
    console.log(chalk.yellow('Testing fallback mechanisms...'));
  }
  
  // Test token analysis for each token
  for (const token of TOKENS_TO_TEST) {
    console.log(chalk.blue(`\nTesting market analysis for ${token}...\n`));
    
    // Test primary analysis endpoint (with fallback)
    try {
      console.log(chalk.blue(`Testing combined analysis endpoint for ${token}...`));
      const analysisResponse = await axios.get(`${SERVER_URL}/api/market/analyze/${token}`);
      
      console.log(chalk.green('Source:'), analysisResponse.data.source || 'unknown');
      console.log(chalk.blue('Analysis:'));
      console.log(analysisResponse.data.token_info?.analysis || 'No analysis available');
      console.log();
    } catch (error) {
      console.error(chalk.red(`Error getting market analysis for ${token}:`), error.message);
    }
    
    // Test local analysis endpoint
    try {
      console.log(chalk.blue(`Testing local analysis endpoint for ${token}...`));
      const localAnalysisResponse = await axios.get(`${SERVER_URL}/api/market/local/analyze/${token}`);
      
      console.log(chalk.green('Source:'), localAnalysisResponse.data.source);
      console.log(chalk.blue('Analysis:'));
      console.log(localAnalysisResponse.data.analysis);
      console.log();
    } catch (error) {
      console.error(chalk.red(`Error getting local market analysis for ${token}:`), error.message);
    }
    
    // Test sentiment analysis
    try {
      console.log(chalk.blue(`Testing sentiment analysis for ${token}...`));
      const sentimentResponse = await axios.get(`${SERVER_URL}/api/market/local/sentiment/${token}`);
      
      console.log(chalk.green('Source:'), sentimentResponse.data.source);
      console.log(chalk.blue('Sentiment:'));
      console.log(sentimentResponse.data.sentiment);
      console.log();
    } catch (error) {
      console.error(chalk.red(`Error getting sentiment analysis for ${token}:`), error.message);
    }
  }
  
  // Test strategies
  try {
    console.log(chalk.blue('\nTesting trading strategies recommendations...\n'));
    const strategiesResponse = await axios.get(`${SERVER_URL}/api/market/local/strategies`);
    
    console.log(chalk.green('Source:'), strategiesResponse.data.source);
    console.log(chalk.blue('Recommended Strategies:'));
    console.log(strategiesResponse.data.strategies);
    console.log();
  } catch (error) {
    console.error(chalk.red('Error getting trading strategies:'), error.message);
  }
  
  // Test arbitrage opportunities
  try {
    console.log(chalk.blue('\nTesting arbitrage opportunities detection...\n'));
    const arbitrageResponse = await axios.get(`${SERVER_URL}/api/market/local/arbitrage`);
    
    console.log(chalk.green('Source:'), arbitrageResponse.data.source);
    console.log(chalk.blue('Arbitrage Opportunities:'));
    console.log(arbitrageResponse.data.opportunities);
    console.log();
  } catch (error) {
    console.error(chalk.red('Error getting arbitrage opportunities:'), error.message);
  }
  
  console.log(chalk.green('\n=== Market Analysis System Test Complete ==='));
}

// Execute the test
testMarketAnalysisSystem()
  .catch(error => {
    console.error(chalk.red('Unexpected error:'), error);
    process.exit(1);
  });