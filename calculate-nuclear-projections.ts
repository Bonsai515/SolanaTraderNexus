/**
 * Calculate Nuclear Strategy Profit Projections
 * 
 * This script calculates detailed profit projections for the
 * active nuclear trading strategies targeting 500% ROI.
 */

import * as fs from 'fs';
import * as path from 'path';

// Critical paths
const DATA_DIR = './data';
const CONFIG_DIR = './server/config';
const SYSTEM_MEMORY_PATH = path.join(DATA_DIR, 'system-memory.json');
const STRATEGIES_CONFIG_PATH = path.join(CONFIG_DIR, 'strategies.json');

// Wallet balance
const CURRENT_SOL_BALANCE = 1.53442; // SOL
const CURRENT_SOL_PRICE = 155.75; // USD per SOL

// Main function to calculate profit projections
function calculateProfitProjections(): void {
  console.log('=============================================');
  console.log('💰 NUCLEAR TRADING STRATEGY PROFIT PROJECTIONS');
  console.log('=============================================\n');
  
  try {
    // Load strategies
    let strategies = [];
    if (fs.existsSync(STRATEGIES_CONFIG_PATH)) {
      strategies = JSON.parse(fs.readFileSync(STRATEGIES_CONFIG_PATH, 'utf8'));
    } else {
      console.warn('⚠️ Strategies configuration not found, using default nuclear strategies');
      
      strategies = [
        {
          id: "nuclear-hyperion-flash-arb",
          name: "Hyperion Flash Arbitrage",
          type: "FLASH_ARBITRAGE",
          config: {
            profitTarget: {
              daily: 1.45, // 1.45% daily
              monthly: 50.0,
              yearly: 500.0
            }
          }
        },
        {
          id: "nuclear-quantum-meme-sniper",
          name: "Quantum Omega Meme Sniper",
          type: "MEME_SNIPER",
          config: {
            profitTarget: {
              daily: 1.4, // 1.4% daily
              monthly: 45.0,
              yearly: 500.0
            }
          }
        },
        {
          id: "nuclear-singularity-cross-chain",
          name: "Singularity Cross-Chain Arbitrage",
          type: "CROSS_CHAIN_ARB",
          config: {
            profitTarget: {
              daily: 1.35, // 1.35% daily
              monthly: 40.0,
              yearly: 500.0
            }
          }
        }
      ];
    }
    
    // Get wallet data and profit configuration
    let walletBalance = CURRENT_SOL_BALANCE;
    let solPrice = CURRENT_SOL_PRICE;
    let reinvestmentRate = 0.95; // Default: 95% reinvestment
    
    // Try to load from system memory
    if (fs.existsSync(SYSTEM_MEMORY_PATH)) {
      try {
        const systemMemory = JSON.parse(fs.readFileSync(SYSTEM_MEMORY_PATH, 'utf8'));
        
        // Get reinvestment rate if available
        if (systemMemory.config?.profitCollection?.reinvestmentRate) {
          reinvestmentRate = systemMemory.config.profitCollection.reinvestmentRate;
        }
      } catch (e) {
        console.warn('⚠️ Error reading system memory:', e instanceof Error ? e.message : String(e));
      }
    }
    
    // Calculate initial capital
    const initialCapitalUSD = walletBalance * solPrice;
    
    console.log(`Current Wallet Balance: ${walletBalance.toFixed(5)} SOL ($${initialCapitalUSD.toFixed(2)})`);
    console.log(`SOL Price: $${solPrice.toFixed(2)}`);
    console.log(`Profit Reinvestment Rate: ${(reinvestmentRate * 100).toFixed(0)}%`);
    console.log('');
    
    console.log('Active Nuclear Trading Strategies:');
    console.log('--------------------------------');
    
    // Calculate overall daily ROI as weighted average
    let totalWeight = 0;
    let weightedROI = 0;
    
    strategies.forEach(strategy => {
      const dailyROI = strategy.config?.profitTarget?.daily || 0;
      // Assume equal weight for each strategy if not specified
      const weight = 1 / strategies.length;
      
      totalWeight += weight;
      weightedROI += dailyROI * weight;
      
      console.log(`${strategy.name}:`);
      console.log(`  - Daily ROI Target: ${dailyROI.toFixed(2)}%`);
      console.log(`  - Monthly ROI Target: ~${(dailyROI * 30).toFixed(2)}%`);
      console.log(`  - Yearly ROI Target: ~${(dailyROI * 365).toFixed(2)}%`);
      console.log('');
    });
    
    // Adjust weightedROI if totalWeight isn't 1
    if (totalWeight > 0) {
      weightedROI = weightedROI / totalWeight;
    }
    
    console.log(`Combined Strategy ROI (Daily): ${weightedROI.toFixed(2)}%`);
    console.log('');
    
    // Calculate projections with compounding
    console.log('Profit Projections (with compounding):');
    console.log('----------------------------------');
    
    // Initial capital in USD
    let capital = initialCapitalUSD;
    
    // Daily projection for 30 days
    console.log('Daily Projections (next 30 days):');
    console.log('----------------------------');
    console.log('Day | Capital (USD) | Profit (USD) | SOL Balance');
    console.log('-------------------------------------------');
    
    for (let day = 1; day <= 30; day++) {
      // Calculate daily profit
      const dailyProfit = capital * (weightedROI / 100);
      
      // Apply reinvestment
      const reinvestedProfit = dailyProfit * reinvestmentRate;
      capital += reinvestedProfit;
      
      // Calculate SOL balance
      const solBalance = capital / solPrice;
      
      // Print every 5th day and the last day
      if (day % 5 === 0 || day === 1 || day === 30) {
        console.log(`${day.toString().padStart(2)} | $${capital.toFixed(2).padStart(11)} | $${dailyProfit.toFixed(2).padStart(11)} | ${solBalance.toFixed(5)} SOL`);
      }
    }
    
    // Reset capital for monthly calculation
    capital = initialCapitalUSD;
    
    console.log('');
    console.log('Monthly Projections (6 months):');
    console.log('---------------------------');
    console.log('Month | Capital (USD) | Monthly Profit | SOL Balance');
    console.log('------------------------------------------------');
    
    for (let month = 1; month <= 6; month++) {
      // Compound daily for the entire month
      const startCapital = capital;
      
      // Simulate daily compounding for each month
      for (let day = 1; day <= 30; day++) {
        const dailyProfit = capital * (weightedROI / 100);
        const reinvestedProfit = dailyProfit * reinvestmentRate;
        capital += reinvestedProfit;
      }
      
      // Calculate monthly profit
      const monthlyProfit = capital - startCapital;
      
      // Calculate SOL balance
      const solBalance = capital / solPrice;
      
      console.log(`${month.toString().padStart(2)} | $${capital.toFixed(2).padStart(11)} | $${monthlyProfit.toFixed(2).padStart(13)} | ${solBalance.toFixed(5)} SOL`);
    }
    
    // Reset capital for yearly calculation
    capital = initialCapitalUSD;
    
    console.log('');
    console.log('Annual Projection:');
    console.log('----------------');
    
    // Compound daily for the entire year
    for (let day = 1; day <= 365; day++) {
      const dailyProfit = capital * (weightedROI / 100);
      const reinvestedProfit = dailyProfit * reinvestmentRate;
      capital += reinvestedProfit;
    }
    
    // Calculate annual profit
    const annualProfit = capital - initialCapitalUSD;
    const annualROI = (annualProfit / initialCapitalUSD) * 100;
    
    // Calculate SOL balance
    const finalSolBalance = capital / solPrice;
    const solProfit = finalSolBalance - walletBalance;
    
    console.log(`Initial Capital: $${initialCapitalUSD.toFixed(2)} (${walletBalance.toFixed(5)} SOL)`);
    console.log(`Final Capital: $${capital.toFixed(2)} (${finalSolBalance.toFixed(5)} SOL)`);
    console.log(`Annual Profit: $${annualProfit.toFixed(2)} (${solProfit.toFixed(5)} SOL)`);
    console.log(`Annual ROI: ${annualROI.toFixed(2)}%`);
    
    console.log('\n=============================================');
    console.log(`✅ Your nuclear trading system is projected to grow your`);
    console.log(`   ${walletBalance.toFixed(5)} SOL to approximately ${finalSolBalance.toFixed(5)} SOL in one year`);
    console.log(`   (${annualROI.toFixed(0)}% annual ROI)`);
    console.log('=============================================');
    
  } catch (error) {
    console.error('Error calculating profit projections:', error instanceof Error ? error.message : String(error));
  }
}

// Run the calculation
calculateProfitProjections();