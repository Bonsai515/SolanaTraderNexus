/**
 * Test Perplexity AI Integration
 * 
 * This script tests the Perplexity AI connector for market analysis and trading strategy recommendations.
 */

import { perplexityConnector } from './server/ai/perplexityConnector';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testPerplexityAI() {
  console.log('=============================================');
  console.log('TESTING PERPLEXITY AI INTEGRATION');
  console.log('=============================================');
  
  // Initialize connector
  const isInitialized = await perplexityConnector.initialize();
  
  if (!isInitialized) {
    console.error('❌ Failed to initialize Perplexity connector. Please check your API key.');
    console.log('API Key status:', process.env.PERPLEXITY_API_KEY ? 'Provided' : 'Missing');
    return;
  }
  
  console.log('✅ Perplexity connector initialized successfully');
  
  // Test market analysis
  console.log('\nTesting market analysis for SOL...');
  
  const marketAnalysis = await perplexityConnector.analyzeMarket({
    query: 'Analyze the current market conditions for Solana (SOL) and provide a short-term price prediction based on recent performance',
    marketData: {
      currentPrice: 181.11,
      volume24h: 2563000000,
      marketCap: 82500000000,
      priceChange24h: 3.24,
      priceChange7d: 11.87
    }
  });
  
  if (marketAnalysis) {
    console.log('✅ Market analysis received:');
    console.log('Analysis:', marketAnalysis.analysis.substring(0, 200) + '...');
    console.log('Trading recommendation:', marketAnalysis.tradingRecommendation);
    console.log('Risk level:', marketAnalysis.riskLevel);
    console.log('Confidence:', marketAnalysis.confidence);
  } else {
    console.log('❌ Failed to get market analysis');
  }
  
  // Test arbitrage opportunity analysis
  console.log('\nTesting arbitrage opportunity analysis...');
  
  const arbitrageAnalysis = await perplexityConnector.analyzeArbitrageOpportunity(
    'SOL',
    'USDC',
    'Jupiter',
    'Raydium',
    176.15,
    176.45,
    0.17
  );
  
  if (arbitrageAnalysis) {
    console.log('✅ Arbitrage analysis received:');
    console.log('Analysis:', arbitrageAnalysis.analysis.substring(0, 200) + '...');
    console.log('Trading recommendation:', arbitrageAnalysis.tradingRecommendation);
    console.log('Risk level:', arbitrageAnalysis.riskLevel);
    console.log('Confidence:', arbitrageAnalysis.confidence);
  } else {
    console.log('❌ Failed to get arbitrage analysis');
  }
  
  // Test strategy recommendations
  console.log('\nTesting strategy recommendations...');
  
  const strategyRecommendations = await perplexityConnector.getStrategyRecommendations(
    'SOL',
    'Bullish trend with increasing volume and positive sentiment',
    'medium'
  );
  
  if (strategyRecommendations) {
    console.log('✅ Strategy recommendations received:');
    console.log(strategyRecommendations.substring(0, 200) + '...');
  } else {
    console.log('❌ Failed to get strategy recommendations');
  }
  
  console.log('\n=============================================');
  console.log('PERPLEXITY AI INTEGRATION TEST COMPLETE');
  console.log('=============================================');
}

// Run the test
testPerplexityAI().catch(error => {
  console.error('Error running Perplexity AI test:', error);
});