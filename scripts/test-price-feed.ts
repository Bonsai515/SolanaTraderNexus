/**
 * Test script for price feed cache
 * 
 * This script generates sample market data and sends it to the price feed cache
 * via API requests for testing purposes.
 */

import axios from 'axios';
import { MarketData } from '../server/transformers';

// Base URL for API requests
const BASE_URL = 'http://localhost:5000';

// Trading pairs to test
const PAIRS = ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'];

function generateMarketData(pair: string, dataPoints: number = 50) {
  const now = Date.now();
  
  // Generate different price ranges based on pair
  let minPrice = 30;
  let maxPrice = 35;
  let minVolume = 1000000;
  let maxVolume = 10000000;
  
  if (pair === 'BONK/USDC') {
    minPrice = 0.000015;
    maxPrice = 0.000025;
    minVolume = 5000000000;
    maxVolume = 15000000000;
  } else if (pair === 'JUP/USDC') {
    minPrice = 0.8;
    maxPrice = 1.2;
    minVolume = 2000000;
    maxVolume = 8000000;
  }
  
  // Generate price time series
  const prices: Array<[string, number]> = [];
  for (let i = 0; i < dataPoints; i++) {
    const timestamp = new Date(now - (dataPoints - i) * 60000).toISOString();
    const price = minPrice + Math.random() * (maxPrice - minPrice);
    prices.push([timestamp, parseFloat(price.toFixed(6))]);
  }
  
  // Generate volume time series
  const volumes: Array<[string, number]> = [];
  for (let i = 0; i < dataPoints; i++) {
    const timestamp = new Date(now - (dataPoints - i) * 60000).toISOString();
    const volume = minVolume + Math.random() * (maxVolume - minVolume);
    volumes.push([timestamp, parseFloat(volume.toFixed(2))]);
  }
  
  // Generate order books
  const orderBooks: Array<[string, Array<[number, number]>, Array<[number, number]>]> = [];
  for (let i = 0; i < 5; i++) {
    const timestamp = new Date(now - (5 - i) * 60000).toISOString();
    const midPrice = prices[prices.length - 1 - i][1];
    
    const bids: Array<[number, number]> = [];
    const asks: Array<[number, number]> = [];
    
    // Generate some bids (lower than mid price)
    for (let j = 0; j < 5; j++) {
      const price = midPrice * (1 - (j + 1) * 0.001);
      const amount = Math.random() * 1000;
      bids.push([price, amount]);
    }
    
    // Generate some asks (higher than mid price)
    for (let j = 0; j < 5; j++) {
      const price = midPrice * (1 + (j + 1) * 0.001);
      const amount = Math.random() * 1000;
      asks.push([price, amount]);
    }
    
    orderBooks.push([timestamp, bids, asks]);
  }
  
  // Generate indicator data
  const indicators: Record<string, Array<[string, number]>> = {
    'rsi': [],
    'macd': [],
    'bollinger_bands': []
  };
  
  // RSI (0-100)
  for (let i = 0; i < dataPoints; i++) {
    const timestamp = new Date(now - (dataPoints - i) * 60000).toISOString();
    indicators.rsi.push([timestamp, 30 + Math.random() * 40]);
  }
  
  // MACD (-2 to 2)
  for (let i = 0; i < dataPoints; i++) {
    const timestamp = new Date(now - (dataPoints - i) * 60000).toISOString();
    indicators.macd.push([timestamp, -2 + Math.random() * 4]);
  }
  
  // Bollinger Bands (0-2)
  for (let i = 0; i < dataPoints; i++) {
    const timestamp = new Date(now - (dataPoints - i) * 60000).toISOString();
    indicators.bollinger_bands.push([timestamp, Math.random() * 2]);
  }
  
  // External data
  const externalData: Record<string, Array<[string, number]>> = {
    'market_sentiment': [],
    'funding_rate': [],
    'social_volume': []
  };
  
  // Market sentiment (-1 to 1)
  for (let i = 0; i < dataPoints; i++) {
    const timestamp = new Date(now - (dataPoints - i) * 60000).toISOString();
    externalData.market_sentiment.push([timestamp, -1 + Math.random() * 2]);
  }
  
  // Funding rate (-0.01 to 0.01)
  for (let i = 0; i < dataPoints; i++) {
    const timestamp = new Date(now - (dataPoints - i) * 60000).toISOString();
    externalData.funding_rate.push([timestamp, -0.01 + Math.random() * 0.02]);
  }
  
  // Social volume (0-100)
  for (let i = 0; i < dataPoints; i++) {
    const timestamp = new Date(now - (dataPoints - i) * 60000).toISOString();
    externalData.social_volume.push([timestamp, Math.random() * 100]);
  }
  
  // Construct the complete market data
  const marketData: MarketData = {
    pair,
    prices,
    volumes,
    orderBooks,
    indicators,
    externalData
  };
  
  return marketData;
}

async function submitToPriceFeedCache(pair: string) {
  console.log(`🔄 Generating and submitting market data for ${pair}...`);
  
  try {
    const marketData = generateMarketData(pair);
    
    const response = await axios.post(`${BASE_URL}/price-feed/update`, {
      pair,
      marketData
    });
    
    console.log(`✅ Successfully updated price feed for ${pair}:`, response.data);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update price feed for ${pair}:`, error.response?.data || error.message);
    return false;
  }
}

async function getPriceFeedStatus() {
  try {
    const response = await axios.get(`${BASE_URL}/price-feed/status`);
    console.log('\n📊 Current price feed status:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get price feed status:', error.response?.data || error.message);
    return null;
  }
}

async function populatePriceFeedCache() {
  console.log('🧪 Testing price feed cache population...\n');
  
  // Get initial status
  await getPriceFeedStatus();
  
  // Submit market data for each pair
  const results = [];
  for (const pair of PAIRS) {
    const result = await submitToPriceFeedCache(pair);
    results.push({ pair, success: result });
  }
  
  // Get status after population
  await getPriceFeedStatus();
  
  // Print summary
  console.log('\n📝 Price feed cache population summary:');
  for (const result of results) {
    console.log(`${result.success ? '✅' : '❌'} ${result.pair}`);
  }
  
  console.log('\n🎉 Price feed cache test completed!');
}

// Run the tests
populatePriceFeedCache().catch(error => {
  console.error('❌ Unhandled error during test execution:', error);
});