/**
 * Fix API Connections for Live Trading
 * 
 * This script ensures all necessary API connections are properly configured
 * for live trading with real funds.
 */

import * as http from 'http';

// Color formatting for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

console.log(`${colors.bold}${colors.cyan}HYPERION TRADING SYSTEM - CONNECTION FIX${colors.reset}\n`);
console.log(`${colors.yellow}Attempting to fix API connections for live trading...${colors.reset}\n`);

// Helper function for making API requests
function makeRequest(method: string, path: string, data: any = null): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Fix Solana RPC connection issues
 * @returns true if connection is successful
 */
async function fixSolanaConnection(): Promise<boolean> {
  console.log(`${colors.blue}Fixing Solana RPC connection...${colors.reset}`);
  
  try {
    // Use the provided InstantNodes RPC URL
    const response = await makeRequest('POST', '/api/fix-solana-connection');
    
    if (response && response.success) {
      console.log(`${colors.green}✓ Solana RPC connection fixed successfully${colors.reset}`);
      console.log(`  ${colors.bold}Provider:${colors.reset} ${response.provider || 'InstantNodes'}`);
      console.log(`  ${colors.bold}Network:${colors.reset} ${response.network || 'Mainnet'}`);
      return true;
    } else {
      console.log(`${colors.red}✗ Failed to fix Solana RPC connection${colors.reset}`);
      if (response && response.message) {
        console.log(`  ${colors.yellow}${response.message}${colors.reset}`);
      }
      return false;
    }
  } catch (error: any) {
    console.log(`${colors.red}✗ Error fixing Solana RPC connection: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Fix Wormhole connection for cross-chain operations
 * @returns true if connection is successful
 */
async function fixWormholeConnection(): Promise<boolean> {
  console.log(`${colors.blue}Fixing Wormhole connection...${colors.reset}`);
  
  try {
    const response = await makeRequest('POST', '/api/fix-wormhole-connection');
    
    if (response && response.success) {
      console.log(`${colors.green}✓ Wormhole connection fixed successfully${colors.reset}`);
      console.log(`  ${colors.bold}Mode:${colors.reset} ${response.mode || 'Guardian RPCs (no API key)'}`);
      return true;
    } else {
      console.log(`${colors.red}✗ Failed to fix Wormhole connection${colors.reset}`);
      if (response && response.message) {
        console.log(`  ${colors.yellow}${response.message}${colors.reset}`);
      }
      return false;
    }
  } catch (error: any) {
    console.log(`${colors.red}✗ Error fixing Wormhole connection: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Fix AI connections (Perplexity and DeepSeek)
 * @returns true if at least one connection is successful
 */
async function fixAIConnections(): Promise<boolean> {
  console.log(`${colors.blue}Fixing AI API connections...${colors.reset}`);
  
  try {
    const response = await makeRequest('POST', '/api/fix-ai-connections');
    
    if (response && response.success) {
      console.log(`${colors.green}✓ AI connections fixed successfully${colors.reset}`);
      
      if (response.perplexity) {
        console.log(`  ${colors.bold}Perplexity API:${colors.reset} Connected`);
      } else {
        console.log(`  ${colors.yellow}Perplexity API:${colors.reset} Not available`);
      }
      
      if (response.deepseek) {
        console.log(`  ${colors.bold}DeepSeek API:${colors.reset} Connected`);
      } else {
        console.log(`  ${colors.yellow}DeepSeek API:${colors.reset} Not available`);
      }
      
      return true;
    } else {
      console.log(`${colors.red}✗ Failed to fix AI connections${colors.reset}`);
      if (response && response.message) {
        console.log(`  ${colors.yellow}${response.message}${colors.reset}`);
      }
      console.log(`  ${colors.yellow}Note: AI connections are recommended but not required for trading${colors.reset}`);
      return false;
    }
  } catch (error: any) {
    console.log(`${colors.red}✗ Error fixing AI connections: ${error.message}${colors.reset}`);
    console.log(`  ${colors.yellow}Note: AI connections are recommended but not required for trading${colors.reset}`);
    return false;
  }
}

/**
 * Main function to fix all connections
 */
export async function tryConnectAPI(): Promise<void> {
  try {
    console.log(`${colors.cyan}Checking API health...${colors.reset}`);
    
    const healthCheck = await makeRequest('GET', '/api/health');
    
    if (healthCheck && healthCheck.status === 'ok') {
      console.log(`${colors.green}✓ API is healthy${colors.reset}`);
      
      // Fix Solana connection
      const solanaFixed = await fixSolanaConnection();
      
      // Fix Wormhole connection
      const wormholeFixed = await fixWormholeConnection();
      
      // Fix AI connections (optional)
      const aiFixed = await fixAIConnections();
      
      console.log(`\n${colors.bold}Connection Fix Summary:${colors.reset}`);
      console.log(`  ${solanaFixed ? colors.green + '✓' : colors.red + '✗'} Solana RPC: ${solanaFixed ? 'Fixed' : 'Failed'}${colors.reset}`);
      console.log(`  ${wormholeFixed ? colors.green + '✓' : colors.red + '✗'} Wormhole: ${wormholeFixed ? 'Fixed' : 'Failed'}${colors.reset}`);
      console.log(`  ${aiFixed ? colors.green + '✓' : colors.yellow + '⚠️'} AI APIs: ${aiFixed ? 'Fixed' : 'Not available (optional)'}${colors.reset}`);
      
      const overallSuccess = solanaFixed && wormholeFixed;
      
      if (overallSuccess) {
        console.log(`\n${colors.green}${colors.bold}All critical connections fixed successfully!${colors.reset}`);
        console.log(`${colors.green}The system is ready for live trading.${colors.reset}`);
      } else {
        console.log(`\n${colors.yellow}${colors.bold}Some connections could not be fixed.${colors.reset}`);
        console.log(`${colors.yellow}Live trading may be limited or unavailable.${colors.reset}`);
      }
    } else {
      console.log(`${colors.red}✗ API health check failed${colors.reset}`);
      console.log(`${colors.yellow}Please ensure the server is running.${colors.reset}`);
    }
  } catch (error: any) {
    console.log(`${colors.red}✗ Error connecting to API: ${error.message}${colors.reset}`);
    console.log(`${colors.yellow}Please ensure the server is running on http://localhost:5000${colors.reset}`);
  }
}

// Run the script if it's called directly
if (require.main === module) {
  tryConnectAPI();
}