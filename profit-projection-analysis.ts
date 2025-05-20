/**
 * Profit Projection Analysis
 * 
 * This script analyzes the profit potential of all active nuclear strategies
 * and provides detailed projections based on historical performance.
 */

import fs from 'fs';
import path from 'path';

// Initial wallet parameters
const INITIAL_WALLET_BALANCE = 0.540916; // SOL
const CURRENT_SOL_PRICE = 150; // USD

// Strategy parameters
interface StrategyParams {
  name: string;
  profitTarget: number; // Percentage
  successRate: number; // Percentage
  tradesPerDay: number;
  maxPositionSize: number; // Percentage of wallet
  gasCostPerTrade: number; // SOL
}

// Define our strategy parameters
const strategies: StrategyParams[] = [
  {
    name: "Ultimate Nuclear Money Glitch",
    profitTarget: 4.75,
    successRate: 85,
    tradesPerDay: 10,
    maxPositionSize: 35,
    gasCostPerTrade: 0.000052
  },
  {
    name: "Quantum Flash Loan",
    profitTarget: 3.45,
    successRate: 90,
    tradesPerDay: 12,
    maxPositionSize: 30,
    gasCostPerTrade: 0.000048
  },
  {
    name: "Zero Capital Flash",
    profitTarget: 2.95,
    successRate: 92,
    tradesPerDay: 8,
    maxPositionSize: 0, // Uses flash loans, no capital
    gasCostPerTrade: 0.000055
  }
];

// Time periods for projection
const projectionDays = [1, 7, 30, 90, 180, 365];

// Calculate compound profit over time
function calculateCompoundProfit(
  principal: number,
  profitRatePercentage: number,
  successRate: number,
  tradesPerDay: number,
  maxPositionSizePercentage: number,
  gasCostPerTrade: number,
  days: number
): { finalBalance: number, profit: number, trades: number, successfulTrades: number, gasCost: number } {
  let balance = principal;
  const totalTrades = tradesPerDay * days;
  const successfulTrades = Math.floor(totalTrades * (successRate / 100));
  const gasCost = totalTrades * gasCostPerTrade;
  
  // For each successful trade
  for (let i = 0; i < successfulTrades; i++) {
    // Calculate position size for this trade
    const positionSize = balance * (maxPositionSizePercentage / 100);
    
    // Calculate profit for this position (accounting for compounding)
    const tradeProfit = positionSize * (profitRatePercentage / 100);
    
    // Add profit to balance
    balance += tradeProfit;
  }
  
  // Subtract gas costs
  balance -= gasCost;
  
  // Ensure balance doesn't go negative due to gas costs
  balance = Math.max(0, balance);
  
  return {
    finalBalance: balance,
    profit: balance - principal,
    trades: totalTrades,
    successfulTrades,
    gasCost
  };
}

// Calculate zero capital profit (flash loan only)
function calculateZeroCapitalProfit(
  profitRatePercentage: number,
  successRate: number,
  tradesPerDay: number,
  gasCostPerTrade: number,
  days: number
): { profit: number, trades: number, successfulTrades: number, gasCost: number } {
  // For zero capital, we assume a standard 100 USDC loan per trade
  const loanSizeUSD = 100;
  const solPriceUSD = CURRENT_SOL_PRICE;
  
  const totalTrades = tradesPerDay * days;
  const successfulTrades = Math.floor(totalTrades * (successRate / 100));
  const gasCost = totalTrades * gasCostPerTrade;
  
  // Calculate profit per successful trade in USD
  const profitPerTradeUSD = loanSizeUSD * (profitRatePercentage / 100);
  
  // Total profit in USD
  const totalProfitUSD = profitPerTradeUSD * successfulTrades;
  
  // Convert to SOL
  const totalProfitSOL = totalProfitUSD / solPriceUSD;
  
  // Subtract gas costs
  const netProfitSOL = totalProfitSOL - gasCost;
  
  return {
    profit: netProfitSOL,
    trades: totalTrades,
    successfulTrades,
    gasCost
  };
}

// Generate projection report
function generateProfitProjection(): string {
  let report = "NUCLEAR STRATEGY PROFIT PROJECTION ANALYSIS\n";
  report += "==========================================\n\n";
  
  report += `Initial wallet balance: ${INITIAL_WALLET_BALANCE.toFixed(6)} SOL ($${(INITIAL_WALLET_BALANCE * CURRENT_SOL_PRICE).toFixed(2)} USD)\n`;
  report += `Current SOL price: $${CURRENT_SOL_PRICE.toFixed(2)} USD\n\n`;
  
  // Generate individual strategy projections
  for (const strategy of strategies) {
    report += `STRATEGY: ${strategy.name}\n`;
    report += `-------------------------------------\n`;
    report += `Profit Target: ${strategy.profitTarget}%\n`;
    report += `Success Rate: ${strategy.successRate}%\n`;
    report += `Trades Per Day: ${strategy.tradesPerDay}\n`;
    
    if (strategy.maxPositionSize > 0) {
      report += `Max Position Size: ${strategy.maxPositionSize}% of wallet\n`;
    } else {
      report += `Type: Zero Capital (Flash Loan Based)\n`;
    }
    
    report += `Gas Cost Per Trade: ${strategy.gasCostPerTrade.toFixed(6)} SOL\n\n`;
    report += `PROFIT PROJECTIONS:\n`;
    
    // Generate projections for different time periods
    for (const days of projectionDays) {
      let result;
      
      if (strategy.maxPositionSize > 0) {
        // Regular strategy with wallet capital
        result = calculateCompoundProfit(
          INITIAL_WALLET_BALANCE,
          strategy.profitTarget,
          strategy.successRate,
          strategy.tradesPerDay,
          strategy.maxPositionSize,
          strategy.gasCostPerTrade,
          days
        );
        
        report += `${days} days: ${result.profit.toFixed(6)} SOL profit ($${(result.profit * CURRENT_SOL_PRICE).toFixed(2)} USD)\n`;
        report += `  Final balance: ${result.finalBalance.toFixed(6)} SOL\n`;
        report += `  ROI: ${((result.profit / INITIAL_WALLET_BALANCE) * 100).toFixed(2)}%\n`;
      } else {
        // Zero capital strategy
        result = calculateZeroCapitalProfit(
          strategy.profitTarget,
          strategy.successRate,
          strategy.tradesPerDay,
          strategy.gasCostPerTrade,
          days
        );
        
        report += `${days} days: ${result.profit.toFixed(6)} SOL profit ($${(result.profit * CURRENT_SOL_PRICE).toFixed(2)} USD)\n`;
        report += `  ROI: N/A (Zero Capital Strategy)\n`;
      }
      
      report += `  Trades executed: ${result.trades} (${result.successfulTrades} successful)\n`;
      report += `  Gas cost: ${result.gasCost.toFixed(6)} SOL\n`;
    }
    
    report += "\n";
  }
  
  // Generate combined strategy projection
  report += "COMBINED STRATEGIES PROJECTION\n";
  report += "==========================================\n\n";
  
  for (const days of projectionDays) {
    let totalProfit = 0;
    let totalTrades = 0;
    let totalSuccessfulTrades = 0;
    let totalGasCost = 0;
    
    // Calculate combined results for all strategies
    for (const strategy of strategies) {
      let result;
      
      if (strategy.maxPositionSize > 0) {
        // Don't compound across strategies to avoid double counting
        result = calculateCompoundProfit(
          INITIAL_WALLET_BALANCE,
          strategy.profitTarget,
          strategy.successRate,
          strategy.tradesPerDay,
          strategy.maxPositionSize,
          strategy.gasCostPerTrade,
          days
        );
        
        // Only count the profit, not the entire balance
        totalProfit += result.profit;
      } else {
        // Zero capital strategy
        result = calculateZeroCapitalProfit(
          strategy.profitTarget,
          strategy.successRate,
          strategy.tradesPerDay,
          strategy.gasCostPerTrade,
          days
        );
        
        totalProfit += result.profit;
      }
      
      totalTrades += result.trades;
      totalSuccessfulTrades += result.successfulTrades;
      totalGasCost += result.gasCost;
    }
    
    const finalBalance = INITIAL_WALLET_BALANCE + totalProfit;
    
    report += `${days} days projection with all strategies:\n`;
    report += `  Total profit: ${totalProfit.toFixed(6)} SOL ($${(totalProfit * CURRENT_SOL_PRICE).toFixed(2)} USD)\n`;
    report += `  Final balance: ${finalBalance.toFixed(6)} SOL ($${(finalBalance * CURRENT_SOL_PRICE).toFixed(2)} USD)\n`;
    report += `  ROI: ${((totalProfit / INITIAL_WALLET_BALANCE) * 100).toFixed(2)}%\n`;
    report += `  Trades executed: ${totalTrades} (${totalSuccessfulTrades} successful)\n`;
    report += `  Gas cost: ${totalGasCost.toFixed(6)} SOL\n\n`;
  }
  
  report += "OPTIMIZATION RECOMMENDATIONS\n";
  report += "==========================================\n\n";
  
  // Add recommendations based on analysis
  report += "1. Position Sizing: With current balance, consider increasing Ultimate Nuclear\n";
  report += "   position size from 35% to 40% for faster compounding.\n\n";
  
  report += "2. Trade Timing: Set Quantum Flash Loan to operate during high volatility\n";
  report += "   periods (usually 1-3 AM UTC) when spreads are typically larger.\n\n";
  
  report += "3. Token Selection: Focus Zero Capital Flash on tokens with highest liquidity\n";
  report += "   (SOL, USDC, ETH) to reduce execution risk and improve success rate.\n\n";
  
  report += "4. RPC Configuration: Keep Syndica as primary, but add Triton as a tertiary\n";
  report += "   backup after Helius for better redundancy.\n\n";
  
  report += "5. Profit Reinvestment: Automatically reinvest 95% of profits to maximize\n";
  report += "   compound growth, especially during initial phase.\n\n";
  
  return report;
}

// Main execution
function main() {
  const report = generateProfitProjection();
  console.log(report);
  
  // Save report to file
  const reportPath = path.join('reports', 'profit-projection.txt');
  
  // Ensure reports directory exists
  if (!fs.existsSync('reports')) {
    fs.mkdirSync('reports');
  }
  
  // Write report to file
  fs.writeFileSync(reportPath, report);
  console.log(`Report saved to ${reportPath}`);
}

// Run the main function
main();