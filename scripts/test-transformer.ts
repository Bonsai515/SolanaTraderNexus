import { getTransformerAPI } from '../server/transformers';
import storage from '../server/storage';
import { MarketData } from '../server/transformers';

async function main() {
  try {
    console.log('Starting transformer API test...');
    
    // Verify strategy data
    console.log('Verifying strategy data...');
    const strategies = await storage.getStrategies();
    console.log(`Found ${strategies.length} strategies:`);
    strategies.forEach(strategy => {
      console.log(`- ${strategy.name} (${strategy.pair}) - Active: ${strategy.active}`);
    });
    
    // Initialize the transformer API
    console.log('\nInitializing transformer API...');
    const transformerAPI = getTransformerAPI(storage);
    await transformerAPI.initialize();
    console.log('Transformer API initialized successfully');
    
    // Create test market data for SOL/USDC
    console.log('\nGenerating market data for SOL/USDC...');
    const now = new Date();
    const timestamps = Array.from({ length: 20 }, (_, i) => {
      const date = new Date(now);
      date.setMinutes(date.getMinutes() - (19 - i));
      return date.toISOString();
    });
    
    // SOL price data (using real approximate values)
    const prices = [
      148.12, 148.25, 148.33, 148.45, 148.52, 148.61, 148.70, 148.85, 149.05, 149.20,
      149.35, 149.52, 149.68, 149.85, 150.05, 150.18, 150.25, 150.32, 150.40, 150.25
    ];
    
    // Create SOL/USDC market data object
    const solUsdcMarketData: MarketData = {
      pair: 'SOL/USDC',
      prices: timestamps.map((timestamp, i) => [timestamp, prices[i]]),
      volumes: timestamps.map((timestamp, i) => [timestamp, 50000 + Math.random() * 10000]),
      orderBooks: timestamps.map((timestamp, i) => [
        timestamp,
        // Bids: [price, quantity]
        Array.from({ length: 5 }, (_, j) => [prices[i] - (j + 1) * 0.05, 100 - j * 15]),
        // Asks: [price, quantity]
        Array.from({ length: 5 }, (_, j) => [prices[i] + (j + 1) * 0.05, 100 - j * 15])
      ]),
      indicators: {
        rsi: timestamps.map((timestamp, i) => [timestamp, 50 + (prices[i] - prices[0]) * 5]),
        macd: timestamps.map((timestamp, i) => [timestamp, (prices[i] - prices[Math.max(0, i - 5)]) * 2])
      },
      externalData: {
        market_sentiment: timestamps.map((timestamp, i) => [timestamp, 0.6 + (prices[i] - prices[0]) * 0.1])
      }
    };
    
    console.log(`Generated market data for ${solUsdcMarketData.pair} with ${solUsdcMarketData.prices.length} data points`);
    
    // Make a prediction using the Rust trading engine
    console.log(`\nMaking prediction for SOL/USDC...`);
    const prediction = await transformerAPI.predict('SOL/USDC', solUsdcMarketData, 3600);
    
    console.log('Prediction result:');
    console.log(JSON.stringify(prediction, null, 2));
    
    console.log(`\nChecking trading signals...`);
    const signals = await storage.getSignals();
    console.log(`Found ${signals.length} trading signals:`);
    if (signals.length > 0) {
      signals.forEach(signal => {
        console.log(`- Signal ID: ${signal.id}`);
        console.log(`  Type: ${signal.type}, Strength: ${signal.strength}, Pair: ${signal.pair}`);
        console.log(`  Price: ${signal.price}, Created: ${signal.created_at}`);
        console.log(`  Metadata: ${JSON.stringify(signal.metadata)}`);
        console.log('---');
      });
    }
    
  } catch (error) {
    console.error('Error testing transformer:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

main();