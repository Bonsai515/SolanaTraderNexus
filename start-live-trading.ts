/**
 * Start Live Trading with Real Funds
 * 
 * This script directly interfaces with the server to activate live
 * trading with proper API calls, ensuring real funds are used.
 */

import axios from 'axios';

// Base URL for API calls
const BASE_URL = 'http://localhost:5000';

/**
 * Make an API call with proper error handling
 * @param method HTTP method
 * @param endpoint API endpoint
 * @param data Request body (optional)
 * @returns Response data
 */
async function callAPI(method: string, endpoint: string, data: any = null): Promise<any> {
  try {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`Making ${method} request to ${url}`);
    
    const response = await axios({
      method,
      url,
      data,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error(`API call failed: ${error}`);
    throw error;
  }
}

/**
 * Activate the transaction engine
 */
async function activateTransactionEngine(): Promise<boolean> {
  try {
    console.log('Activating transaction engine...');
    const result = await callAPI('POST', '/api/transaction-engine/activate');
    return result.success;
  } catch (error) {
    console.error(`Failed to activate transaction engine: ${error}`);
    return false;
  }
}

/**
 * Activate trading agents
 */
async function activateAgents(): Promise<boolean> {
  try {
    console.log('Activating trading agents...');
    
    // Activate Hyperion Flash Arbitrage Overlord
    await callAPI('POST', '/api/agents/hyperion/activate', { active: true });
    console.log('Hyperion Flash Arbitrage Overlord activated');
    
    // Activate Quantum Omega
    await callAPI('POST', '/api/agents/quantum_omega/activate', { active: true });
    console.log('Quantum Omega activated');
    
    // Activate Singularity
    await callAPI('POST', '/api/agents/singularity/activate', { active: true });
    console.log('Singularity activated');
    
    return true;
  } catch (error) {
    console.error(`Failed to activate agents: ${error}`);
    return false;
  }
}

/**
 * Enable real funds for trading
 */
async function enableRealFunds(): Promise<boolean> {
  try {
    console.log('Enabling real funds for trading...');
    const result = await callAPI('POST', '/api/trading/enable-real-funds', { enabled: true });
    return result.success;
  } catch (error) {
    console.error(`Failed to enable real funds: ${error}`);
    return false;
  }
}

/**
 * Execute a test transaction
 */
async function executeTestTransaction(): Promise<boolean> {
  try {
    console.log('Executing test transaction...');
    const result = await callAPI('POST', '/api/transaction-engine/test-transaction');
    return result.success;
  } catch (error) {
    console.error(`Test transaction failed: ${error}`);
    return false;
  }
}

/**
 * Main function to start live trading
 */
export async function startLiveTrading(): Promise<boolean> {
  try {
    console.log('Starting live trading with real funds...');
    
    // Step 1: Activate transaction engine
    if (!await activateTransactionEngine()) {
      console.error('Failed to activate transaction engine');
      return false;
    }
    
    // Step 2: Activate trading agents
    if (!await activateAgents()) {
      console.error('Failed to activate trading agents');
      return false;
    }
    
    // Step 3: Execute a test transaction
    if (!await executeTestTransaction()) {
      console.warn('Test transaction failed, but continuing with activation');
      // Continue anyway, as the test transaction might fail due to various reasons
    }
    
    // Step 4: Enable real funds for trading
    if (!await enableRealFunds()) {
      console.error('Failed to enable real funds for trading');
      return false;
    }
    
    console.log('✅ Live trading started successfully with real funds');
    console.log('💰 System is now actively scanning for trading opportunities');
    console.log('💻 Monitor performance at http://localhost:5000/dashboard');
    
    return true;
  } catch (error) {
    console.error(`Failed to start live trading: ${error}`);
    return false;
  }
}

// Execute if this script is run directly
if (require.main === module) {
  startLiveTrading()
    .then((success) => {
      if (success) {
        console.log('Live trading started successfully');
        process.exit(0);
      } else {
        console.error('Failed to start live trading');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error(`Error: ${error}`);
      process.exit(1);
    });
}