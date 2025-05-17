/**
 * Run Flash Strategy Example
 * 
 * This script demonstrates how to execute the Quantum Flash Strategy
 * directly from your application code.
 */
import { executeSingleDayStrategy, executeFullWeekStrategy } from './flash_strategy_integration';

/**
 * Run a single day of the strategy
 */
async function runSingleDay() {
  try {
    console.log('Starting Day 1 Strategy with 1.5 SOL');
    
    // Execute Day 1 with 1.5 SOL
    const result = await executeSingleDayStrategy(1, 1.5);
    
    // Display results
    console.log('Day 1 Strategy complete!');
    console.log(`Starting amount: ${result.startingSol} SOL`);
    console.log(`Ending amount: ${result.endingSol} SOL`);
    console.log(`Profit: ${result.profitSol} SOL (${result.successRate.toFixed(2)}% success rate)`);
    
    return result;
  } catch (error) {
    console.error('Error running single day strategy:', error);
  }
}

/**
 * Run the full 7-day strategy
 */
async function runFullWeek() {
  try {
    console.log('Starting 7-day Strategy with 2 SOL');
    
    // Execute full 7-day strategy with 2 SOL
    const result = await executeFullWeekStrategy(2);
    
    // Display results
    console.log('7-day Strategy complete!');
    console.log(`Starting amount: ${result.startingSol} SOL`);
    console.log(`Final amount: ${result.finalSol} SOL`);
    console.log(`Total profit: ${result.profitSol} SOL`);
    console.log(`Growth: ${result.growthPercentage.toFixed(2)}%`);
    
    // Display daily breakdown
    console.log('\nDaily breakdown:');
    result.dailyResults.forEach((day) => {
      console.log(`Day ${day.day}: ${day.startingSol} SOL → ${day.endingSol} SOL (${day.profitSol} SOL profit)`);
    });
    
    return result;
  } catch (error) {
    console.error('Error running weekly strategy:', error);
  }
}

// Choose which strategy to run
const STRATEGY_MODE = process.argv[2] || 'daily';

if (STRATEGY_MODE === 'weekly') {
  runFullWeek();
} else {
  runSingleDay();
}

// Export functions for use elsewhere
export { runSingleDay, runFullWeek };