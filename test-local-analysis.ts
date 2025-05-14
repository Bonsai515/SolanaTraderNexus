/**
 * Test Local Market Analysis
 * 
 * This script tests the local market analysis functionality which serves
 * as a fallback when Perplexity AI is unavailable.
 */

import { localMarketAnalysis } from './server/lib/localMarketAnalysis';
import { logger } from './server/logger';

// Tokens to analyze
const TOKENS = ['SOL', 'BONK', 'JUP', 'MEME', 'WIF'];

async function main() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('Testing Local Market Analysis');
    console.log('='.repeat(80) + '\n');

    // Test token analysis
    console.log('Testing token analysis:');
    console.log('-'.repeat(40));
    
    for (const token of TOKENS) {
      console.log(`\nAnalyzing ${token}:`);
      const analysis = localMarketAnalysis.analyzeToken(token);
      console.log(analysis);
      
      console.log(`\nSentiment for ${token}:`);
      const sentiment = localMarketAnalysis.getMarketSentiment(token);
      console.log(sentiment);
      
      console.log('-'.repeat(40));
    }
    
    // Test arbitrage opportunities
    console.log('\nTesting arbitrage opportunity detection:');
    console.log('-'.repeat(40));
    const arbitrageOpportunities = localMarketAnalysis.findArbitrageOpportunities();
    console.log(arbitrageOpportunities);
    
    // Test trading strategies
    console.log('\nTesting trading strategy recommendations:');
    console.log('-'.repeat(40));
    const tradingStrategies = localMarketAnalysis.recommendTradingStrategies();
    console.log(tradingStrategies);
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
main().catch(console.error);