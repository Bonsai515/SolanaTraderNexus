/**
 * Optimize Trading Parameters for Increased Capital
 * 
 * This script updates the position sizing and risk parameters for all
 * trading strategies to optimize for the increased capital (0.4 SOL added).
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, PublicKey } from '@solana/web3.js';

// Configuration Constants
const TRADING_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const CONFIG_DIR = './config';
const DATA_DIR = './data';

// Expected capital after adding 0.4 SOL
const EXPECTED_BALANCE = 0.497506; // 0.097506 + 0.4 SOL

/**
 * Check wallet balance
 */
async function checkWalletBalance(): Promise<number> {
  try {
    console.log(`Checking wallet balance for ${TRADING_WALLET_ADDRESS}...`);
    
    const connection = new Connection(RPC_URL, 'confirmed');
    const publicKey = new PublicKey(TRADING_WALLET_ADDRESS);
    const balance = await connection.getBalance(publicKey);
    
    const solBalance = balance / 1e9; // Convert lamports to SOL
    console.log(`Current wallet balance: ${solBalance.toFixed(6)} SOL`);
    
    return solBalance;
  } catch (error) {
    console.error('Error checking wallet balance:', error);
    return 0;
  }
}

/**
 * Update Quantum Omega (meme token) strategy parameters
 */
function updateQuantumOmegaParameters(currentBalance: number): boolean {
  try {
    console.log('Updating Quantum Omega strategy parameters...');
    
    // Read current configuration
    const configPath = path.join(CONFIG_DIR, 'quantum-omega-wallet1-config.json');
    if (!fs.existsSync(configPath)) {
      console.warn(`Configuration file not found: ${configPath}`);
      return false;
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // Update position sizing based on new balance
    // Increase position size percentage but ensure it's still conservative
    if (currentBalance >= 0.4) {
      // With higher balance, we can be slightly more aggressive
      config.positionSizing = {
        ...config.positionSizing,
        maxPositionSizePercent: 7.5, // Increase from 5% to 7.5%
        maxConcurrentPositions: 3,   // Allow more concurrent positions
        minPositionSizeSOL: 0.01,    // Increased minimum position
        maxPositionSizeSOL: 0.04     // Increased maximum position
      };
      
      // Adjust risk parameters
      config.riskManagement = {
        ...config.riskManagement,
        stopLossPercent: 12,      // Slightly tighter stop loss (was 15%)
        takeProfitPercent: 35,    // Maintain strong profit target
        trailingStopEnabled: true,
        trailingStopActivationPercent: 20, // Activate trailing stop after 20% gain
        trailingStopDistancePercent: 10    // 10% trailing distance
      };
      
      // Save updated configuration
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Updated Quantum Omega parameters for ${currentBalance.toFixed(6)} SOL balance`);
      return true;
    } else {
      console.log('Balance not yet increased, skipping Quantum Omega parameter update');
      return false;
    }
  } catch (error) {
    console.error('Error updating Quantum Omega parameters:', error);
    return false;
  }
}

/**
 * Update Quantum Flash strategy parameters
 */
function updateQuantumFlashParameters(currentBalance: number): boolean {
  try {
    console.log('Updating Quantum Flash strategy parameters...');
    
    // Read current configuration
    const configPath = path.join(CONFIG_DIR, 'quantum-flash-wallet1-config.json');
    if (!fs.existsSync(configPath)) {
      console.warn(`Configuration file not found: ${configPath}`);
      return false;
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // Update parameters based on new balance
    if (currentBalance >= 0.4) {
      // With higher balance, we can adjust flash loan parameters
      config.flashLoanParams = {
        ...config.flashLoanParams,
        maxPositionSizePercent: 90,      // Increase from 85% to 90%
        minProfitThresholdUSD: 0.0012,   // Slightly increase profit threshold
        maxActiveLoans: 2,               // Allow more concurrent loans
        routingOptimization: true,
        useFeeDiscounting: true,
        minLiquidityPoolSize: 10000,     // Target larger pools
        useHangingOrderStrategy: true,
        profitSplitPercent: 80           // Reinvest 80% of profits
      };
      
      // Save updated configuration
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Updated Quantum Flash parameters for ${currentBalance.toFixed(6)} SOL balance`);
      return true;
    } else {
      console.log('Balance not yet increased, skipping Quantum Flash parameter update');
      return false;
    }
  } catch (error) {
    console.error('Error updating Quantum Flash parameters:', error);
    return false;
  }
}

/**
 * Update Zero Capital Flash strategy parameters
 */
function updateZeroCapitalParameters(currentBalance: number): boolean {
  try {
    console.log('Updating Zero Capital strategy parameters...');
    
    // Read current configuration
    const configPath = path.join(CONFIG_DIR, 'zero-capital-flash-config.json');
    if (!fs.existsSync(configPath)) {
      console.warn(`Configuration file not found: ${configPath}`);
      return false;
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // Update parameters based on new balance
    if (currentBalance >= 0.4) {
      // With higher balance, we can use it as better collateral
      config.zeroCapitalParams = {
        ...config.zeroCapitalParams,
        collateralUtilizationPercent: 70, // Use up to 70% of balance as collateral
        minProfitThresholdUSD: 0.06,     // Slightly higher profit threshold
        maxSlippageTolerance: 0.45,      // Slightly lower slippage tolerance
        maxDailyTransactions: 12,        // Increased daily transaction limit
        useAdvancedCollateralization: true,
        maxGasFeeSOL: 0.0012,            // Higher gas fee budget
        profitReinvestmentRate: 70       // Reinvest 70% of profits
      };
      
      // Save updated configuration
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Updated Zero Capital parameters for ${currentBalance.toFixed(6)} SOL balance`);
      return true;
    } else {
      console.log('Balance not yet increased, skipping Zero Capital parameter update');
      return false;
    }
  } catch (error) {
    console.error('Error updating Zero Capital parameters:', error);
    return false;
  }
}

/**
 * Update Hyperion Neural strategy parameters
 */
function updateHyperionParameters(currentBalance: number): boolean {
  try {
    console.log('Updating Hyperion Neural strategy parameters...');
    
    // Read current configuration
    const configPath = path.join(CONFIG_DIR, 'hyperion-flash-config.json');
    if (!fs.existsSync(configPath)) {
      console.warn(`Configuration file not found: ${configPath}`);
      return false;
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // Update parameters based on new balance
    if (currentBalance >= 0.4) {
      // With higher balance, we can optimize hyperion parameters
      config.hyperionParams = {
        ...config.hyperionParams,
        maxPositionSizePercent: 65,     // More conservative than flash loans
        minProfitThresholdUSD: 0.025,   // Slightly higher profit threshold
        maxSlippageTolerance: 0.55,     // Maintain slippage tolerance
        parallelExecution: true,        // Enable parallel execution
        adaptiveRiskManagement: true,   // Enable adaptive risk
        executionPriorities: [9, 8, 7, 5], // Prioritize safer strategies
        optimizationInterval: 750,      // Faster optimization
        transactionTimeoutMs: 40000     // Longer timeout for complex transactions
      };
      
      // Save updated configuration
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Updated Hyperion Neural parameters for ${currentBalance.toFixed(6)} SOL balance`);
      return true;
    } else {
      console.log('Balance not yet increased, skipping Hyperion Neural parameter update');
      return false;
    }
  } catch (error) {
    console.error('Error updating Hyperion Neural parameters:', error);
    return false;
  }
}

/**
 * Update system memory with new capital configuration
 */
function updateSystemMemory(currentBalance: number): boolean {
  try {
    console.log('Updating system memory with new capital configuration...');
    
    // Create system memory directory if it doesn't exist
    const systemMemoryDir = path.join(DATA_DIR, 'system-memory');
    if (!fs.existsSync(systemMemoryDir)) {
      fs.mkdirSync(systemMemoryDir, { recursive: true });
    }
    
    // Read current system memory if it exists
    let systemMemory: any = {};
    const systemMemoryPath = path.join(systemMemoryDir, 'system-memory.json');
    
    if (fs.existsSync(systemMemoryPath)) {
      try {
        const systemMemoryData = fs.readFileSync(systemMemoryPath, 'utf-8');
        systemMemory = JSON.parse(systemMemoryData);
      } catch (error) {
        console.warn('Error reading system memory, creating new one:', error);
      }
    }
    
    if (currentBalance >= 0.4) {
      // Update capital configuration in system memory
      systemMemory.capital = {
        ...systemMemory.capital,
        initialBalance: 0.097506, // Original balance
        additionalCapital: currentBalance - 0.097506, // Added capital
        totalBalance: currentBalance,
        lastUpdated: new Date().toISOString(),
        currency: 'SOL'
      };
      
      // Update strategy allocations based on new capital
      systemMemory.allocation = {
        quantumOmega: 25, // 25% allocation
        quantumFlash: 35, // 35% allocation
        zeroCapital: 15,  // 15% allocation
        hyperion: 25      // 25% allocation
      };
      
      // Save updated system memory
      fs.writeFileSync(systemMemoryPath, JSON.stringify(systemMemory, null, 2));
      console.log(`✅ Updated system memory with new capital: ${currentBalance.toFixed(6)} SOL`);
      return true;
    } else {
      console.log('Balance not yet increased, skipping system memory update');
      return false;
    }
  } catch (error) {
    console.error('Error updating system memory:', error);
    return false;
  }
}

/**
 * Main function to optimize trading parameters
 */
async function optimizeTradingParameters(): Promise<void> {
  console.log('\n=======================================================');
  console.log('🚀 OPTIMIZING TRADING PARAMETERS FOR INCREASED CAPITAL');
  console.log('=======================================================');
  
  // Check current wallet balance
  const currentBalance = await checkWalletBalance();
  
  // Ensure config directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  if (currentBalance < EXPECTED_BALANCE * 0.9) {
    console.log(`\n⚠️ Current balance (${currentBalance.toFixed(6)} SOL) is less than expected (${EXPECTED_BALANCE.toFixed(6)} SOL).`);
    console.log('Please ensure you have added the additional 0.4 SOL to your trading wallet.');
    console.log('Will optimize based on current balance, but parameters may need adjustment when additional capital arrives.\n');
  }
  
  let updatedStrategies = 0;
  
  // Update parameters for each strategy based on current balance
  if (updateQuantumOmegaParameters(currentBalance)) updatedStrategies++;
  if (updateQuantumFlashParameters(currentBalance)) updatedStrategies++;
  if (updateZeroCapitalParameters(currentBalance)) updatedStrategies++;
  if (updateHyperionParameters(currentBalance)) updatedStrategies++;
  
  // Update system memory
  if (updateSystemMemory(currentBalance)) {
    console.log('\n✅ System memory updated with new capital configuration');
  }
  
  // Summary
  if (updatedStrategies > 0) {
    console.log('\n=======================================================');
    console.log(`✅ Successfully optimized ${updatedStrategies} trading strategies for ${currentBalance.toFixed(6)} SOL`);
    console.log('=======================================================');
    console.log('\nKey Improvements:');
    console.log('1. Increased position sizes for better profit potential');
    console.log('2. Adjusted risk parameters for proper capital protection');
    console.log('3. Enabled advanced features like trailing stops and parallel execution');
    console.log('4. Optimized reinvestment rates for compound growth');
    console.log('\nYour trading system is now configured to make the most of your increased capital!');
    console.log('=======================================================');
  } else {
    console.log('\n=======================================================');
    console.log('⚠️ No strategies were updated. Please check wallet balance and try again.');
    console.log('=======================================================');
  }
}

// Execute the optimization
optimizeTradingParameters().catch(error => {
  console.error('Error optimizing trading parameters:', error);
});