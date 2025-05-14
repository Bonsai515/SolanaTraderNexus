/**
 * Calculate Profit Projection for Current System
 * 
 * This script calculates the projected profit potential for the current system
 * with 2 SOL added to the wallet with the current strategies.
 */

// Define constants
const SOL_AMOUNT = 2; // Amount of SOL to be added
const SOL_PRICE = 175; // Approximate SOL price in USD as of May 2025
const USD_EQUIVALENT = SOL_AMOUNT * SOL_PRICE; // USD equivalent of 2 SOL

// Strategy ROI configuration
interface Strategy {
  name: string;
  allocation: number; // % of total funds
  dailyROI: number; // % daily return
  riskLevel: string;
}

// Define current active strategies
const ACTIVE_STRATEGIES: Strategy[] = [
  {
    name: 'Hyperion Flash Arbitrage',
    allocation: 40, // 40% of funds
    dailyROI: 8, // 8% daily
    riskLevel: 'Medium'
  },
  {
    name: 'Quantum Omega MemeCorTeX',
    allocation: 30, // 30% of funds
    dailyROI: 15, // 15% daily
    riskLevel: 'High'
  },
  {
    name: 'Singularity Cross-Chain',
    allocation: 30, // 30% of funds
    dailyROI: 6, // 6% daily
    riskLevel: 'Medium-Low'
  }
];

// Calculate the weighted average daily ROI
function calculateWeightedROI(strategies: Strategy[]): number {
  const totalAllocation = strategies.reduce((sum, strategy) => sum + strategy.allocation, 0);
  const weightedROI = strategies.reduce((sum, strategy) => 
    sum + (strategy.allocation * strategy.dailyROI), 0) / totalAllocation;
  return weightedROI;
}

// Calculate profit projections
function calculateProfitProjections(initialCapital: number, strategies: Strategy[]): void {
  console.log('=============================================');
  console.log('💰 Profit Projection Calculator');
  console.log('=============================================\n');
  
  console.log(`Initial Capital: 2 SOL (≈ $${initialCapital.toFixed(2)} USD)`);
  console.log('\nActive Strategies:');
  
  strategies.forEach(strategy => {
    const allocationAmount = (strategy.allocation / 100) * initialCapital;
    console.log(`- ${strategy.name}`);
    console.log(`  Allocation: ${strategy.allocation}% (≈ $${allocationAmount.toFixed(2)})`);
    console.log(`  Daily ROI: ${strategy.dailyROI}%`);
    console.log(`  Risk Level: ${strategy.riskLevel}`);
    console.log(`  Daily Profit: ≈ $${(allocationAmount * strategy.dailyROI / 100).toFixed(2)}`);
    console.log('');
  });
  
  // Calculate weighted average ROI
  const weightedROI = calculateWeightedROI(strategies);
  console.log(`Weighted Average Daily ROI: ${weightedROI.toFixed(2)}%`);
  
  // Calculate projected returns
  const dailyProfit = initialCapital * (weightedROI / 100);
  const weeklyProfit = dailyProfit * 7;
  const monthlyProfit = dailyProfit * 30;
  const yearlyProfit = dailyProfit * 365;
  
  // Calculate compounded returns (95% reinvested)
  const reinvestmentRate = 0.95; // 95% reinvestment
  let compoundedCapital = initialCapital;
  let totalProphetProfit = 0;
  
  // Calculate 30-day compounded returns
  for (let day = 1; day <= 30; day++) {
    const dayProfit = compoundedCapital * (weightedROI / 100);
    const reinvestedProfit = dayProfit * reinvestmentRate;
    const prophetProfit = dayProfit * (1 - reinvestmentRate);
    
    compoundedCapital += reinvestedProfit;
    totalProphetProfit += prophetProfit;
  }
  
  // Display profit projections
  console.log('\n📊 Profit Projections (Linear):');
  console.log(`- Daily Profit: $${dailyProfit.toFixed(2)}`);
  console.log(`- Weekly Profit: $${weeklyProfit.toFixed(2)}`);
  console.log(`- Monthly Profit: $${monthlyProfit.toFixed(2)}`);
  console.log(`- Yearly Profit: $${yearlyProfit.toFixed(2)}`);
  
  console.log('\n📈 Profit Projections (Compounded with 95% Reinvestment):');
  console.log(`- 30-Day Capital Growth: $${initialCapital.toFixed(2)} → $${compoundedCapital.toFixed(2)}`);
  console.log(`- 30-Day Prophet Wallet Collection (5%): $${totalProphetProfit.toFixed(2)}`);
  console.log(`- 30-Day Total Profit: $${(compoundedCapital - initialCapital + totalProphetProfit).toFixed(2)}`);
  console.log(`- 30-Day ROI: ${(((compoundedCapital + totalProphetProfit - initialCapital) / initialCapital) * 100).toFixed(2)}%`);
  
  // Disclaimer
  console.log('\n⚠️ DISCLAIMER:');
  console.log('These projections are based on historical performance data and');
  console.log('current market conditions. Actual returns may vary significantly.');
  console.log('Quantum entanglement may amplify or dampen returns based on');
  console.log('evolving market conditions and strategy adaptations.');
  console.log('=============================================');
}

// Execute the calculation
calculateProfitProjections(USD_EQUIVALENT, ACTIVE_STRATEGIES);