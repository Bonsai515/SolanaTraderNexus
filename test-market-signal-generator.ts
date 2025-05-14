/**
 * Test Market Analysis Signal Generator
 * 
 * This script tests the market analysis signal generator by explicitly starting it
 * and generating signals from market analysis, arbitrage opportunities, and trading strategies.
 */

import { marketAnalysisSignalGenerator } from './server/lib/marketAnalysisSignalGenerator';
import { logger } from './server/logger';

async function main() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('Testing Market Analysis Signal Generator');
    console.log('='.repeat(80) + '\n');

    // Initialize the signal generator
    console.log('Starting Market Analysis Signal Generator...');
    const success = await marketAnalysisSignalGenerator.start();
    
    if (success) {
      console.log('✅ Market Analysis Signal Generator started successfully!');
      
      // Set up listener for signals
      marketAnalysisSignalGenerator.on('signal', (signal) => {
        console.log(`📊 New signal received: ${signal.type} (${signal.direction}) for ${signal.pair} with confidence ${signal.confidence}%`);
      });
      
      // Wait a bit for initial token analysis to complete
      console.log('\nWaiting for initial token analysis to complete...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Test arbitrage signal generation
      console.log('\nTesting arbitrage signal generation...');
      await marketAnalysisSignalGenerator.generateArbitrageSignals();
      console.log('✅ Arbitrage signal generation tested');
      
      // Test strategy signal generation
      console.log('\nTesting strategy signal generation...');
      await marketAnalysisSignalGenerator.generateStrategySignals();
      console.log('✅ Strategy signal generation tested');
      
      // Inform about scheduled signals
      console.log('\nThe signal generator is scheduled to automatically generate:');
      console.log('- Arbitrage signals every 10 minutes');
      console.log('- Strategy signals every 15 minutes');
      
      console.log('\nTest completed successfully! Press Ctrl+C to exit.');
    } else {
      console.error('❌ Failed to start Market Analysis Signal Generator');
    }
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
main().catch(console.error);