/**
 * Test script for verifying API endpoints
 * 
 * This script tests the API endpoints to ensure they're accessible and working properly.
 */

import axios from 'axios';
import { MarketData } from '../server/transformers';

// Base URL for API requests
const BASE_URL = 'http://localhost:5000';

async function testEndpoints() {
  console.log('🧪 Testing API endpoints...');
  
  try {
    // Test health endpoint
    console.log('\n🔍 Testing /health endpoint');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check successful:', healthResponse.data);
    
    // Test transformer status endpoint
    console.log('\n🔍 Testing /transformer/status endpoint');
    const transformerStatusResponse = await axios.get(`${BASE_URL}/transformer/status`);
    console.log('✅ Transformer status check successful:', transformerStatusResponse.data);
    
    // Test price feed status endpoint
    console.log('\n🔍 Testing /price-feed/status endpoint');
    const priceFeedStatusResponse = await axios.get(`${BASE_URL}/price-feed/status`);
    console.log('✅ Price feed status check successful:', priceFeedStatusResponse.data);
    
    // Test updating price feed with sample data
    console.log('\n🔍 Testing /price-feed/update endpoint');
    
    // Generate sample market data for SOL/USDC
    const sampleMarketData: MarketData = {
      pair: 'SOL/USDC',
      prices: generatePriceTimeSeries(100, 25, 35),
      volumes: generateVolumeTimeSeries(100),
      orderBooks: generateOrderBooks(5),
      indicators: {
        'rsi': generateIndicatorTimeSeries(100, 30, 70),
        'macd': generateIndicatorTimeSeries(100, -2, 2)
      },
      externalData: {
        'market_sentiment': generateIndicatorTimeSeries(100, -1, 1)
      }
    };
    
    const priceFeedUpdateResponse = await axios.post(`${BASE_URL}/price-feed/update`, {
      pair: 'SOL/USDC',
      marketData: sampleMarketData
    });
    
    console.log('✅ Price feed update successful:', priceFeedUpdateResponse.data);
    
    // Verify price feed now has data
    console.log('\n🔍 Verifying price feed now has data');
    const priceFeedStatusAfterUpdate = await axios.get(`${BASE_URL}/price-feed/status`);
    console.log('✅ Price feed status after update:', priceFeedStatusAfterUpdate.data);
    
    // Test prediction endpoint with the sample data
    console.log('\n🔍 Testing /transformer/predict endpoint');
    
    const predictionResponse = await axios.post(`${BASE_URL}/transformer/predict`, {
      pair: 'SOL/USDC',
      marketData: sampleMarketData,
      windowSeconds: 3600
    });
    
    console.log('✅ Prediction successful:', predictionResponse.data);
    
    // Test model update endpoint
    console.log('\n🔍 Testing /transformer/update endpoint');
    
    const updateModelResponse = await axios.post(`${BASE_URL}/transformer/update`, {
      pair: 'SOL/USDC',
      marketData: sampleMarketData
    });
    
    console.log('✅ Model update successful:', updateModelResponse.data);
    
    // Test Solana connection status
    console.log('\n🔍 Testing /solana/status endpoint');
    
    const solanaStatusResponse = await axios.get(`${BASE_URL}/solana/status`);
    console.log('✅ Solana connection status check successful:', solanaStatusResponse.data);
    
    console.log('\n🎉 All API endpoint tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during API endpoint testing:', error.response?.data || error.message);
  }
}

// Helper function to generate price time series data
function generatePriceTimeSeries(count: number, minPrice: number, maxPrice: number): Array<[string, number]> {
  const now = Date.now();
  const result: Array<[string, number]> = [];
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(now - (count - i) * 60000).toISOString();
    const price = minPrice + Math.random() * (maxPrice - minPrice);
    result.push([timestamp, parseFloat(price.toFixed(4))]);
  }
  
  return result;
}

// Helper function to generate volume time series data
function generateVolumeTimeSeries(count: number): Array<[string, number]> {
  const now = Date.now();
  const result: Array<[string, number]> = [];
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(now - (count - i) * 60000).toISOString();
    const volume = Math.random() * 10000000;
    result.push([timestamp, parseFloat(volume.toFixed(2))]);
  }
  
  return result;
}

// Helper function to generate order books
function generateOrderBooks(count: number): Array<[string, Array<[number, number]>, Array<[number, number]>]> {
  const now = Date.now();
  const result: Array<[string, Array<[number, number]>, Array<[number, number]>]> = [];
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(now - (count - i) * 60000).toISOString();
    const bids: Array<[number, number]> = [];
    const asks: Array<[number, number]> = [];
    
    // Generate some bids (lower than mid price)
    for (let j = 0; j < 5; j++) {
      const price = 30 - j * 0.1;
      const amount = Math.random() * 1000;
      bids.push([price, amount]);
    }
    
    // Generate some asks (higher than mid price)
    for (let j = 0; j < 5; j++) {
      const price = 30 + 0.1 + j * 0.1;
      const amount = Math.random() * 1000;
      asks.push([price, amount]);
    }
    
    result.push([timestamp, bids, asks]);
  }
  
  return result;
}

// Helper function to generate indicator time series
function generateIndicatorTimeSeries(count: number, min: number, max: number): Array<[string, number]> {
  const now = Date.now();
  const result: Array<[string, number]> = [];
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(now - (count - i) * 60000).toISOString();
    const value = min + Math.random() * (max - min);
    result.push([timestamp, parseFloat(value.toFixed(4))]);
  }
  
  return result;
}

// Run the tests
testEndpoints().catch(err => {
  console.error('❌ Unhandled error during test execution:', err);
  process.exit(1);
});