/**
 * Monte Carlo Strategy Simulator
 * Provides advanced backtesting and strategy optimization capabilities
 * with comprehensive statistical analysis and risk assessment.
 */

import { logger } from '../logger';

// Simulation parameters interface
export interface SimulationParameters {
  strategy: string;
  initialCapital: number;
  simulationRuns: number;
  timeHorizon: number; // in days
  tradingPair: string;
  maxDrawdown: number; // in percentage
  riskFreeRate: number; // in percentage
  confidenceInterval: number; // in percentage (e.g., 95%)
  useDynamicVolatility?: boolean;
  useMarketStress?: boolean;
  bootstrapData?: boolean;
  transactionCosts?: number; // in percentage per trade
  slippageModel?: 'fixed' | 'dynamic';
  slippageFixed?: number; // in percentage
  slippageFactors?: {
    volumeImpact: number;
    volatilityImpact: number;
  };
}

// Result of a single simulation run
export interface SimulationRun {
  finalCapital: number;
  returns: number; // in percentage
  maxDrawdown: number; // in percentage
  sharpeRatio: number;
  sortinoRatio: number;
  winRate: number; // in percentage
  numTrades: number;
  profitFactor: number;
  dailyReturns: number[];
}

// Aggregated simulation results
export interface SimulationResults {
  strategy: string;
  tradingPair: string;
  initialCapital: number;
  simulationRuns: number;
  meanFinalCapital: number;
  medianFinalCapital: number;
  stdDevFinalCapital: number;
  meanReturns: number; // in percentage
  medianReturns: number; // in percentage
  stdDevReturns: number; // in percentage
  minReturns: number; // in percentage
  maxReturns: number; // in percentage
  confidenceIntervalLower: number; // in dollar amount
  confidenceIntervalUpper: number; // in dollar amount
  meanMaxDrawdown: number; // in percentage
  medianMaxDrawdown: number; // in percentage
  meanSharpeRatio: number;
  medianSharpeRatio: number;
  meanSortinoRatio: number;
  medianSortinoRatio: number;
  meanWinRate: number; // in percentage
  medianWinRate: number; // in percentage
  meanProfitFactor: number;
  medianProfitFactor: number;
  valueatRisk95: number; // 95% Value at Risk in percentage
  valueatRisk99: number; // 99% Value at Risk in percentage
  expectedShortfall95: number; // 95% Expected Shortfall (CVaR) in percentage
  expectedShortfall99: number; // 99% Expected Shortfall (CVaR) in percentage
  successProbability: number; // Probability of positive returns
  worstCaseScenario: SimulationRun;
  bestCaseScenario: SimulationRun;
  riskReturnRatio: number;
  stressTestResults?: StressTestResults;
  allRuns: SimulationRun[];
}

// Stress test results
export interface StressTestResults {
  marketCrash: SimulationRun;
  highVolatility: SimulationRun;
  lowLiquidity: SimulationRun;
  correlation: SimulationRun;
  extremeEvents: SimulationRun;
}

// Strategy parameters
export interface StrategyParameters {
  [key: string]: any;
}

/**
 * Calculate the Sharpe ratio
 * @param returns Array of daily returns
 * @param riskFreeRate Annual risk-free rate (like treasury yield)
 */
function calculateSharpeRatio(returns: number[], riskFreeRate: number): number {
  const dailyRiskFreeRate = riskFreeRate / 252; // Convert annual to daily
  const excessReturns = returns.map(r => r - dailyRiskFreeRate);
  const meanExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
  const stdDev = Math.sqrt(
    excessReturns.reduce((sum, r) => sum + Math.pow(r - meanExcessReturn, 2), 0) / excessReturns.length
  );
  
  return stdDev === 0 ? 0 : (meanExcessReturn / stdDev) * Math.sqrt(252); // Annualized
}

/**
 * Calculate the Sortino ratio (similar to Sharpe but only considers downside risk)
 * @param returns Array of daily returns
 * @param riskFreeRate Annual risk-free rate
 */
function calculateSortinoRatio(returns: number[], riskFreeRate: number): number {
  const dailyRiskFreeRate = riskFreeRate / 252; // Convert annual to daily
  const excessReturns = returns.map(r => r - dailyRiskFreeRate);
  const meanExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
  
  // Only consider negative returns for downside deviation
  const negativeReturns = excessReturns.filter(r => r < 0);
  
  if (negativeReturns.length === 0) return 0; // No negative returns means no risk by this measure
  
  const downsideDeviation = Math.sqrt(
    negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
  );
  
  return downsideDeviation === 0 ? 0 : (meanExcessReturn / downsideDeviation) * Math.sqrt(252); // Annualized
}

/**
 * Calculate the maximum drawdown from a series of values
 * @param values Array of capital values over time
 */
function calculateMaxDrawdown(values: number[]): number {
  let maxDrawdown = 0;
  let peak = values[0];
  
  for (let i = 1; i < values.length; i++) {
    if (values[i] > peak) {
      peak = values[i];
    }
    
    const drawdown = (peak - values[i]) / peak;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }
  
  return maxDrawdown * 100; // Convert to percentage
}

/**
 * Calculate Value at Risk at a specific confidence level
 * @param returns Array of returns
 * @param confidenceLevel Confidence level (e.g., 0.95 for 95%)
 */
function calculateVaR(returns: number[], confidenceLevel: number): number {
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor(returns.length * (1 - confidenceLevel));
  return -sortedReturns[index] * 100; // Convert to percentage and negate for VaR convention
}

/**
 * Calculate Expected Shortfall (Conditional VaR) at a specific confidence level
 * @param returns Array of returns
 * @param confidenceLevel Confidence level (e.g., 0.95 for 95%)
 */
function calculateExpectedShortfall(returns: number[], confidenceLevel: number): number {
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const cutoffIndex = Math.floor(returns.length * (1 - confidenceLevel));
  const tailReturns = sortedReturns.slice(0, cutoffIndex);
  
  if (tailReturns.length === 0) return 0;
  
  const meanTailReturn = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
  return -meanTailReturn * 100; // Convert to percentage and negate for ES convention
}

/**
 * Get win rate from trade results
 * @param trades Array of trade results (profits/losses)
 */
function calculateWinRate(trades: number[]): number {
  const winners = trades.filter(t => t > 0).length;
  return (winners / trades.length) * 100; // Convert to percentage
}

/**
 * Calculate the profit factor (gross profit / gross loss)
 * @param trades Array of trade results (profits/losses)
 */
function calculateProfitFactor(trades: number[]): number {
  const profits = trades.filter(t => t > 0).reduce((sum, t) => sum + t, 0);
  const losses = Math.abs(trades.filter(t => t < 0).reduce((sum, t) => sum + t, 0));
  
  return losses === 0 ? (profits > 0 ? Infinity : 0) : profits / losses;
}

/**
 * Calculate the confidence interval for a set of values
 * @param values Array of values
 * @param confidenceLevel Confidence level (e.g., 0.95 for 95%)
 */
function calculateConfidenceInterval(values: number[], confidenceLevel: number): [number, number] {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  );
  
  // Z-score for the given confidence level (assuming normal distribution)
  const z = confidenceLevel === 0.95 ? 1.96 : (confidenceLevel === 0.99 ? 2.58 : 1.645);
  
  const margin = z * (stdDev / Math.sqrt(values.length));
  
  return [mean - margin, mean + margin];
}

/**
 * Run a single Monte Carlo simulation
 * @param data Historical price data or generated synthetic data
 * @param params Simulation parameters
 * @param strategyFn Strategy function that generates trading signals
 * @param strategyParams Specific parameters for the strategy
 */
function runSingleSimulation(
  data: { timestamp: number; price: number; volume: number }[],
  params: SimulationParameters,
  strategyFn: (data: any[], params: StrategyParameters) => { signal: 'buy' | 'sell' | 'hold'; size: number }[],
  strategyParams: StrategyParameters
): SimulationRun {
  // Initial capital and position
  let capital = params.initialCapital;
  let position = 0;
  const capitalHistory: number[] = [capital];
  const dailyReturns: number[] = [];
  const trades: number[] = [];
  
  // Apply strategy to generate signals
  const signals = strategyFn(data, strategyParams);
  
  // Process each trading day
  for (let i = 1; i < signals.length; i++) {
    const signal = signals[i];
    const currentPrice = data[i].price;
    const prevPrice = data[i - 1].price;
    const dailyPriceReturn = (currentPrice - prevPrice) / prevPrice;
    
    // Apply slippage based on model
    let slippage = 0;
    if (params.slippageModel === 'fixed') {
      slippage = params.slippageFixed || 0;
    } else if (params.slippageModel === 'dynamic' && params.slippageFactors) {
      // Dynamic slippage based on volume and volatility
      const volumeRatio = data[i].volume / data.slice(Math.max(0, i - 10), i).reduce((sum, d) => sum + d.volume, 0) * 10;
      const volatility = Math.abs(dailyPriceReturn);
      
      slippage = 0.001 * (
        params.slippageFactors.volumeImpact * (1 / Math.max(0.1, volumeRatio)) +
        params.slippageFactors.volatilityImpact * volatility * 100
      );
    }
    
    // Execute trades based on signal
    if (signal.signal === 'buy' && capital > 0) {
      const tradeSize = Math.min(capital, signal.size);
      const slippageAmount = tradeSize * slippage;
      const transactionCost = tradeSize * (params.transactionCosts || 0);
      
      const effectivePrice = currentPrice * (1 + slippage);
      position += (tradeSize - transactionCost - slippageAmount) / effectivePrice;
      capital -= tradeSize;
      
      trades.push(-transactionCost - slippageAmount); // Record trading costs as a separate trade result
    } else if (signal.signal === 'sell' && position > 0) {
      const positionToSell = position * signal.size;
      const marketValue = positionToSell * currentPrice;
      const slippageAmount = marketValue * slippage;
      const transactionCost = marketValue * (params.transactionCosts || 0);
      
      const effectivePrice = currentPrice * (1 - slippage);
      const saleProceeds = positionToSell * effectivePrice - transactionCost;
      
      trades.push(saleProceeds - (positionToSell * prevPrice)); // Record profit/loss
      
      position -= positionToSell;
      capital += saleProceeds;
    }
    
    // Calculate daily return
    const portfolioValue = capital + (position * currentPrice);
    const prevPortfolioValue = capitalHistory[capitalHistory.length - 1];
    const dailyReturn = (portfolioValue - prevPortfolioValue) / prevPortfolioValue;
    
    dailyReturns.push(dailyReturn);
    capitalHistory.push(portfolioValue);
  }
  
  // Final portfolio value
  const finalCapital = capitalHistory[capitalHistory.length - 1];
  
  // Calculate metrics
  const totalReturn = ((finalCapital - params.initialCapital) / params.initialCapital) * 100;
  const maxDrawdown = calculateMaxDrawdown(capitalHistory);
  const sharpeRatio = calculateSharpeRatio(dailyReturns, params.riskFreeRate);
  const sortinoRatio = calculateSortinoRatio(dailyReturns, params.riskFreeRate);
  const winRate = calculateWinRate(trades);
  const profitFactor = calculateProfitFactor(trades);
  
  return {
    finalCapital,
    returns: totalReturn,
    maxDrawdown,
    sharpeRatio,
    sortinoRatio,
    winRate,
    numTrades: trades.length,
    profitFactor,
    dailyReturns
  };
}

/**
 * Generate a market crash scenario for stress testing
 * @param originalData The original price data
 */
function generateMarketCrashScenario(originalData: { timestamp: number; price: number; volume: number }[]): any[] {
  // Deep copy the original data
  const crashData = JSON.parse(JSON.stringify(originalData));
  
  // Find a random point to start the crash (in the second half of the data)
  const startIdx = Math.floor(crashData.length / 2) + Math.floor(Math.random() * (crashData.length / 3));
  
  // Generate a 20-30% crash over 5-10 days
  const crashDuration = 5 + Math.floor(Math.random() * 6);
  const crashPercentage = 0.20 + Math.random() * 0.10;
  const dailyCrashPerc = Math.pow(1 - crashPercentage, 1 / crashDuration) - 1;
  
  for (let i = 0; i < crashDuration; i++) {
    if (startIdx + i < crashData.length) {
      crashData[startIdx + i].price = crashData[startIdx + i - 1].price * (1 + dailyCrashPerc);
      // Increase volume during crash (2-5x normal)
      crashData[startIdx + i].volume = crashData[startIdx + i].volume * (2 + Math.random() * 3);
    }
  }
  
  // Slow recovery afterwards (if there's enough data left)
  const recoveryDays = Math.min(crashData.length - (startIdx + crashDuration), 30);
  const recoveryPerDay = Math.pow(1 / (1 - crashPercentage), 1 / (recoveryDays * 2)) - 1; // Recover over twice the crash duration
  
  for (let i = 0; i < recoveryDays; i++) {
    const idx = startIdx + crashDuration + i;
    if (idx < crashData.length) {
      crashData[idx].price = crashData[idx - 1].price * (1 + recoveryPerDay);
    }
  }
  
  return crashData;
}

/**
 * Generate high volatility scenario for stress testing
 * @param originalData The original price data
 */
function generateHighVolatilityScenario(originalData: { timestamp: number; price: number; volume: number }[]): any[] {
  const volatileData = JSON.parse(JSON.stringify(originalData));
  
  // Calculate original volatility (standard deviation of returns)
  const returns = [];
  for (let i = 1; i < volatileData.length; i++) {
    returns.push((volatileData[i].price - volatileData[i - 1].price) / volatileData[i - 1].price);
  }
  
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
  );
  
  // Multiply volatility by 3-5x
  const volatilityMultiplier = 3 + Math.random() * 2;
  
  // Start with the initial price
  let currentPrice = volatileData[0].price;
  
  // Generate new prices with higher volatility but similar trend
  for (let i = 1; i < volatileData.length; i++) {
    const originalReturn = (volatileData[i].price - volatileData[i - 1].price) / volatileData[i - 1].price;
    
    // Decompose return into trend and noise
    const noise = originalReturn - meanReturn;
    
    // Amplify the noise component
    const newNoise = noise * volatilityMultiplier;
    
    // Recombine with the trend
    const newReturn = meanReturn + newNoise;
    
    // Calculate new price
    currentPrice = currentPrice * (1 + newReturn);
    volatileData[i].price = currentPrice;
    
    // Increase volume during high volatility (1.5-3x)
    volatileData[i].volume = volatileData[i].volume * (1.5 + Math.random() * 1.5);
  }
  
  return volatileData;
}

/**
 * Generate low liquidity scenario for stress testing
 * @param originalData The original price data
 */
function generateLowLiquidityScenario(originalData: { timestamp: number; price: number; volume: number }[]): any[] {
  const lowLiquidityData = JSON.parse(JSON.stringify(originalData));
  
  // Reduce volume by 70-90%
  const volumeMultiplier = 0.1 + Math.random() * 0.2;
  
  // Increase price volatility due to low liquidity (2-3x)
  const volatilityMultiplier = 2 + Math.random();
  
  // Calculate original volatility (standard deviation of returns)
  const returns = [];
  for (let i = 1; i < lowLiquidityData.length; i++) {
    returns.push((lowLiquidityData[i].price - lowLiquidityData[i - 1].price) / lowLiquidityData[i - 1].price);
  }
  
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
  );
  
  // Start with the initial price
  let currentPrice = lowLiquidityData[0].price;
  
  // Generate new data
  for (let i = 1; i < lowLiquidityData.length; i++) {
    // Reduce volume
    lowLiquidityData[i].volume = lowLiquidityData[i].volume * volumeMultiplier;
    
    const originalReturn = (lowLiquidityData[i].price - lowLiquidityData[i - 1].price) / lowLiquidityData[i - 1].price;
    
    // Decompose return into trend and noise
    const noise = originalReturn - meanReturn;
    
    // Amplify the noise component to reflect low liquidity impact
    const newNoise = noise * volatilityMultiplier;
    
    // Recombine with the trend
    const newReturn = meanReturn + newNoise;
    
    // Calculate new price
    currentPrice = currentPrice * (1 + newReturn);
    lowLiquidityData[i].price = currentPrice;
  }
  
  return lowLiquidityData;
}

/**
 * Run Monte Carlo simulations
 * @param historicalData Historical market data
 * @param params Simulation parameters
 * @param strategyFn Strategy function that generates trading signals
 * @param strategyParams Specific parameters for the strategy
 */
export function runMonteCarloSimulation(
  historicalData: { timestamp: number; price: number; volume: number }[],
  params: SimulationParameters,
  strategyFn: (data: any[], params: StrategyParameters) => { signal: 'buy' | 'sell' | 'hold'; size: number }[],
  strategyParams: StrategyParameters
): SimulationResults {
  logger.info(`Starting Monte Carlo simulation for ${params.strategy} on ${params.tradingPair}`);
  logger.info(`Running ${params.simulationRuns} simulations with ${params.timeHorizon} day horizon`);
  
  const simulationRuns: SimulationRun[] = [];
  
  // Run the specified number of simulations
  for (let i = 0; i < params.simulationRuns; i++) {
    // Prepare data for this simulation run
    let simulationData = [...historicalData];
    
    // If bootstrapping, resample the data (with replacement)
    if (params.bootstrapData) {
      simulationData = [];
      for (let j = 0; j < params.timeHorizon; j++) {
        const randomIndex = Math.floor(Math.random() * historicalData.length);
        simulationData.push(historicalData[randomIndex]);
      }
    }
    
    // Add dynamic volatility if enabled
    if (params.useDynamicVolatility) {
      // Randomly vary volatility throughout the simulation
      const volatilityMultiplier = 0.5 + Math.random() * 1.5; // 0.5x to 2x
      
      // Calculate original volatility
      const returns = [];
      for (let j = 1; j < simulationData.length; j++) {
        returns.push((simulationData[j].price - simulationData[j - 1].price) / simulationData[j - 1].price);
      }
      
      const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      
      // Start with the initial price
      let currentPrice = simulationData[0].price;
      
      // Apply dynamic volatility to the prices
      for (let j = 1; j < simulationData.length; j++) {
        const originalReturn = (simulationData[j].price - simulationData[j - 1].price) / simulationData[j - 1].price;
        const noise = originalReturn - meanReturn;
        const newNoise = noise * volatilityMultiplier;
        const newReturn = meanReturn + newNoise;
        
        currentPrice = currentPrice * (1 + newReturn);
        simulationData[j].price = currentPrice;
      }
    }
    
    // Run a single simulation with this data
    const result = runSingleSimulation(simulationData, params, strategyFn, strategyParams);
    simulationRuns.push(result);
    
    if (i % 10 === 0) {
      logger.debug(`Completed ${i}/${params.simulationRuns} simulations`);
    }
  }
  
  // Extract final capital values
  const finalCapitals = simulationRuns.map(run => run.finalCapital);
  const returns = simulationRuns.map(run => run.returns);
  const maxDrawdowns = simulationRuns.map(run => run.maxDrawdown);
  const sharpeRatios = simulationRuns.map(run => run.sharpeRatio);
  const sortinoRatios = simulationRuns.map(run => run.sortinoRatio);
  const winRates = simulationRuns.map(run => run.winRate);
  const profitFactors = simulationRuns.map(run => run.profitFactor);
  
  // Calculate aggregated statistics
  const meanFinalCapital = finalCapitals.reduce((sum, val) => sum + val, 0) / finalCapitals.length;
  const sortedCapitals = [...finalCapitals].sort((a, b) => a - b);
  const medianFinalCapital = sortedCapitals[Math.floor(sortedCapitals.length / 2)];
  
  const stdDevFinalCapital = Math.sqrt(
    finalCapitals.reduce((sum, val) => sum + Math.pow(val - meanFinalCapital, 2), 0) / finalCapitals.length
  );
  
  const meanReturns = returns.reduce((sum, val) => sum + val, 0) / returns.length;
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const medianReturns = sortedReturns[Math.floor(sortedReturns.length / 2)];
  
  const stdDevReturns = Math.sqrt(
    returns.reduce((sum, val) => sum + Math.pow(val - meanReturns, 2), 0) / returns.length
  );
  
  const minReturns = Math.min(...returns);
  const maxReturns = Math.max(...returns);
  
  // Calculate confidence intervals
  const [ciLower, ciUpper] = calculateConfidenceInterval(finalCapitals, params.confidenceInterval / 100);
  
  // Calculate mean and median for various metrics
  const meanMaxDrawdown = maxDrawdowns.reduce((sum, val) => sum + val, 0) / maxDrawdowns.length;
  const sortedDrawdowns = [...maxDrawdowns].sort((a, b) => a - b);
  const medianMaxDrawdown = sortedDrawdowns[Math.floor(sortedDrawdowns.length / 2)];
  
  const meanSharpeRatio = sharpeRatios.reduce((sum, val) => sum + val, 0) / sharpeRatios.length;
  const sortedSharpeRatios = [...sharpeRatios].sort((a, b) => a - b);
  const medianSharpeRatio = sortedSharpeRatios[Math.floor(sortedSharpeRatios.length / 2)];
  
  const meanSortinoRatio = sortinoRatios.reduce((sum, val) => sum + val, 0) / sortinoRatios.length;
  const sortedSortinoRatios = [...sortinoRatios].sort((a, b) => a - b);
  const medianSortinoRatio = sortedSortinoRatios[Math.floor(sortedSortinoRatios.length / 2)];
  
  const meanWinRate = winRates.reduce((sum, val) => sum + val, 0) / winRates.length;
  const sortedWinRates = [...winRates].sort((a, b) => a - b);
  const medianWinRate = sortedWinRates[Math.floor(sortedWinRates.length / 2)];
  
  const meanProfitFactor = profitFactors.reduce((sum, val) => sum + val, 0) / profitFactors.length;
  const sortedProfitFactors = [...profitFactors].sort((a, b) => a - b);
  const medianProfitFactor = sortedProfitFactors[Math.floor(sortedProfitFactors.length / 2)];
  
  // Extract all daily returns for risk calculations
  const allDailyReturns: number[] = [];
  simulationRuns.forEach(run => {
    allDailyReturns.push(...run.dailyReturns);
  });
  
  // Calculate Value at Risk and Expected Shortfall
  const valueatRisk95 = calculateVaR(allDailyReturns, 0.95);
  const valueatRisk99 = calculateVaR(allDailyReturns, 0.99);
  const expectedShortfall95 = calculateExpectedShortfall(allDailyReturns, 0.95);
  const expectedShortfall99 = calculateExpectedShortfall(allDailyReturns, 0.99);
  
  // Calculate success probability
  const successProbability = returns.filter(r => r > 0).length / returns.length;
  
  // Find worst and best case scenarios
  const worstRun = simulationRuns.reduce((worst, current) => 
    current.returns < worst.returns ? current : worst, simulationRuns[0]);
  
  const bestRun = simulationRuns.reduce((best, current) => 
    current.returns > best.returns ? current : best, simulationRuns[0]);
  
  // Calculate risk-return ratio (return per unit of risk)
  const riskReturnRatio = meanReturns / (stdDevReturns !== 0 ? stdDevReturns : 1);
  
  // Run stress tests if requested
  let stressTestResults: StressTestResults | undefined;
  
  if (params.useMarketStress) {
    // Generate stress scenario data
    const crashData = generateMarketCrashScenario(historicalData);
    const highVolData = generateHighVolatilityScenario(historicalData);
    const lowLiquidityData = generateLowLiquidityScenario(historicalData);
    
    // Run strategy on each scenario
    const crashRun = runSingleSimulation(crashData, params, strategyFn, strategyParams);
    const volatilityRun = runSingleSimulation(highVolData, params, strategyFn, strategyParams);
    const liquidityRun = runSingleSimulation(lowLiquidityData, params, strategyFn, strategyParams);
    
    // For correlation scenario, invert the return pattern
    const correlationData = JSON.parse(JSON.stringify(historicalData));
    for (let i = 1; i < correlationData.length; i++) {
      const returnPct = (correlationData[i].price - correlationData[i - 1].price) / correlationData[i - 1].price;
      correlationData[i].price = correlationData[i - 1].price * (1 - returnPct * 1.5); // Invert and amplify returns
    }
    const correlationRun = runSingleSimulation(correlationData, params, strategyFn, strategyParams);
    
    // For extreme events (flash crash), create a scenario with a huge one-day drop followed by recovery
    const extremeData = JSON.parse(JSON.stringify(historicalData));
    const crashDay = Math.floor(extremeData.length / 2);
    extremeData[crashDay].price = extremeData[crashDay - 1].price * 0.7; // 30% one-day crash
    extremeData[crashDay].volume = extremeData[crashDay].volume * 5; // 5x volume spike
    // Recovery over the next few days
    for (let i = 1; i <= 5; i++) {
      if (crashDay + i < extremeData.length) {
        const recoveryFactor = 1 + 0.08 * (6 - i); // Gradually decreasing recovery rate
        extremeData[crashDay + i].price = extremeData[crashDay + i - 1].price * recoveryFactor;
        extremeData[crashDay + i].volume = extremeData[crashDay + i].volume * (3 - (i * 0.4)); // Gradually decreasing volume
      }
    }
    const extremeRun = runSingleSimulation(extremeData, params, strategyFn, strategyParams);
    
    stressTestResults = {
      marketCrash: crashRun,
      highVolatility: volatilityRun,
      lowLiquidity: liquidityRun,
      correlation: correlationRun,
      extremeEvents: extremeRun
    };
  }
  
  logger.info(`Monte Carlo simulation completed for ${params.strategy}`);
  logger.info(`Mean return: ${meanReturns.toFixed(2)}%, Mean max drawdown: ${meanMaxDrawdown.toFixed(2)}%`);
  logger.info(`Success probability: ${(successProbability * 100).toFixed(2)}%`);
  
  return {
    strategy: params.strategy,
    tradingPair: params.tradingPair,
    initialCapital: params.initialCapital,
    simulationRuns: params.simulationRuns,
    meanFinalCapital,
    medianFinalCapital,
    stdDevFinalCapital,
    meanReturns,
    medianReturns,
    stdDevReturns,
    minReturns,
    maxReturns,
    confidenceIntervalLower: ciLower,
    confidenceIntervalUpper: ciUpper,
    meanMaxDrawdown,
    medianMaxDrawdown,
    meanSharpeRatio,
    medianSharpeRatio,
    meanSortinoRatio,
    medianSortinoRatio,
    meanWinRate,
    medianWinRate,
    meanProfitFactor,
    medianProfitFactor,
    valueatRisk95,
    valueatRisk99,
    expectedShortfall95,
    expectedShortfall99,
    successProbability,
    worstCaseScenario: worstRun,
    bestCaseScenario: bestRun,
    riskReturnRatio,
    stressTestResults,
    allRuns: simulationRuns
  };
}

/**
 * Generate optimal strategy parameters using a genetic algorithm approach
 * @param historicalData Historical market data
 * @param strategyFn Strategy function to optimize
 * @param baseParams Base simulation parameters
 * @param paramRanges Ranges for strategy parameters to optimize
 * @param fitnessMetric Metric to optimize (e.g., 'returns', 'sharpeRatio', 'sortinoRatio')
 * @param generations Number of generations for the genetic algorithm
 * @param populationSize Size of each generation
 */
export function optimizeStrategyParameters(
  historicalData: { timestamp: number; price: number; volume: number }[],
  strategyFn: (data: any[], params: StrategyParameters) => { signal: 'buy' | 'sell' | 'hold'; size: number }[],
  baseParams: SimulationParameters,
  paramRanges: { [key: string]: [number, number] },
  fitnessMetric: 'returns' | 'sharpeRatio' | 'sortinoRatio' | 'riskReturnRatio' = 'sharpeRatio',
  generations: number = 10,
  populationSize: number = 30
): { params: StrategyParameters; fitness: number; results: SimulationResults } {
  logger.info(`Starting strategy optimization for ${baseParams.strategy} using ${fitnessMetric} as fitness metric`);
  
  // Create initial population with random parameters within specified ranges
  let population: { params: StrategyParameters; fitness: number; results?: SimulationResults }[] = [];
  
  // Generate initial population
  for (let i = 0; i < populationSize; i++) {
    const params: StrategyParameters = {};
    
    // Generate random parameters within specified ranges
    for (const [param, [min, max]] of Object.entries(paramRanges)) {
      params[param] = min + Math.random() * (max - min);
    }
    
    population.push({ params, fitness: 0 });
  }
  
  // Run genetic algorithm for specified number of generations
  for (let gen = 0; gen < generations; gen++) {
    logger.info(`Generation ${gen + 1}/${generations}`);
    
    // Evaluate fitness for each individual in the population
    for (let i = 0; i < population.length; i++) {
      // We only need a small number of simulation runs for parameter optimization
      const simParams = { ...baseParams, simulationRuns: 10 };
      
      // Run simulation with these parameters
      const results = runMonteCarloSimulation(
        historicalData,
        simParams,
        strategyFn,
        population[i].params
      );
      
      // Assign fitness based on the chosen metric
      let fitness = 0;
      switch (fitnessMetric) {
        case 'returns':
          fitness = results.meanReturns;
          break;
        case 'sharpeRatio':
          fitness = results.meanSharpeRatio;
          break;
        case 'sortinoRatio':
          fitness = results.meanSortinoRatio;
          break;
        case 'riskReturnRatio':
          fitness = results.riskReturnRatio;
          break;
      }
      
      // Penalize extreme drawdowns
      if (results.meanMaxDrawdown > baseParams.maxDrawdown) {
        fitness *= (baseParams.maxDrawdown / results.meanMaxDrawdown);
      }
      
      population[i].fitness = fitness;
      population[i].results = results;
      
      logger.debug(`Individual ${i + 1}: Fitness = ${fitness.toFixed(4)}`);
    }
    
    // Sort population by fitness (descending)
    population.sort((a, b) => b.fitness - a.fitness);
    
    logger.info(`Best fitness in generation ${gen + 1}: ${population[0].fitness.toFixed(4)}`);
    
    // If this is the last generation, break here
    if (gen === generations - 1) break;
    
    // Create next generation
    const nextGen: { params: StrategyParameters; fitness: number }[] = [];
    
    // Elitism: Keep the best individuals
    const eliteCount = Math.max(1, Math.floor(populationSize * 0.1));
    for (let i = 0; i < eliteCount; i++) {
      nextGen.push({ ...population[i] });
    }
    
    // Generate rest of the new population
    while (nextGen.length < populationSize) {
      // Tournament selection
      const parent1 = tournamentSelect(population, 3);
      const parent2 = tournamentSelect(population, 3);
      
      // Crossover
      const child = crossover(parent1, parent2, paramRanges);
      
      // Mutation
      mutate(child, paramRanges, 0.2);
      
      nextGen.push(child);
    }
    
    // Replace old population
    population = nextGen;
  }
  
  // Return the best parameters found
  const best = population[0];
  
  logger.info(`Optimization complete. Best fitness: ${best.fitness.toFixed(4)}`);
  logger.info('Optimized parameters:');
  for (const [param, value] of Object.entries(best.params)) {
    logger.info(`  ${param}: ${value.toFixed(4)}`);
  }
  
  return {
    params: best.params,
    fitness: best.fitness,
    results: best.results!
  };
}

/**
 * Tournament selection for genetic algorithm
 * @param population Current population
 * @param tournamentSize Number of individuals in each tournament
 */
function tournamentSelect(
  population: { params: StrategyParameters; fitness: number }[],
  tournamentSize: number
): { params: StrategyParameters; fitness: number } {
  // Select random individuals for the tournament
  const tournament: { params: StrategyParameters; fitness: number }[] = [];
  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * population.length);
    tournament.push(population[idx]);
  }
  
  // Find the best individual in the tournament
  return tournament.reduce((best, current) => 
    current.fitness > best.fitness ? current : best, tournament[0]);
}

/**
 * Crossover operation for genetic algorithm
 * @param parent1 First parent
 * @param parent2 Second parent
 * @param paramRanges Parameter ranges (for validation)
 */
function crossover(
  parent1: { params: StrategyParameters; fitness: number },
  parent2: { params: StrategyParameters; fitness: number },
  paramRanges: { [key: string]: [number, number] }
): { params: StrategyParameters; fitness: number } {
  const childParams: StrategyParameters = {};
  
  // For each parameter, randomly choose from either parent or blend
  for (const param in paramRanges) {
    if (Math.random() < 0.5) {
      // Take from parent 1
      childParams[param] = parent1.params[param];
    } else if (Math.random() < 0.5) {
      // Take from parent 2
      childParams[param] = parent2.params[param];
    } else {
      // Blend the parameters
      const alpha = Math.random();
      childParams[param] = alpha * parent1.params[param] + (1 - alpha) * parent2.params[param];
    }
    
    // Ensure parameter is within range
    const [min, max] = paramRanges[param];
    childParams[param] = Math.max(min, Math.min(max, childParams[param]));
  }
  
  return { params: childParams, fitness: 0 };
}

/**
 * Mutation operation for genetic algorithm
 * @param individual Individual to mutate
 * @param paramRanges Parameter ranges
 * @param mutationRate Probability of mutating each parameter
 */
function mutate(
  individual: { params: StrategyParameters; fitness: number },
  paramRanges: { [key: string]: [number, number] },
  mutationRate: number
): void {
  for (const param in paramRanges) {
    if (Math.random() < mutationRate) {
      const [min, max] = paramRanges[param];
      const range = max - min;
      
      // Add a small random change, normally distributed around the current value
      const change = (Math.random() - 0.5) * range * 0.2; // 20% of the range
      individual.params[param] += change;
      
      // Ensure the parameter stays within range
      individual.params[param] = Math.max(min, Math.min(max, individual.params[param]));
    }
  }
}