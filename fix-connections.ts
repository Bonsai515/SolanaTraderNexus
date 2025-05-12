/**
 * Fix API Connections for Live Trading
 * 
 * This script will fix the connection issues preventing the system from executing
 * real transactions on the Solana blockchain.
 */

import fs from 'fs';
import { exec } from 'child_process';

// Configuration
const API_ENV_FILE = '.env';

// Required API keys
const REQUIRED_KEYS = {
  SOLANA_RPC_API_KEY: process.env.SOLANA_RPC_API_KEY || '',
  INSTANT_NODES_RPC_URL: process.env.INSTANT_NODES_RPC_URL || '',
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '',
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
  WORMHOLE_API_KEY: 'wh_guardian_rpc_2025' // Default value if not set
};

// Create or update the .env file
function updateEnvFile() {
  console.log('Updating environment configuration...');
  
  try {
    let envContent = '';
    
    // Read existing .env file if it exists
    if (fs.existsSync(API_ENV_FILE)) {
      envContent = fs.readFileSync(API_ENV_FILE, 'utf8');
    }
    
    // Update each key
    for (const [key, value] of Object.entries(REQUIRED_KEYS)) {
      // Skip empty values
      if (!value) continue;
      
      // Check if key exists in .env file
      const keyRegex = new RegExp(`^${key}=.*$`, 'm');
      
      if (keyRegex.test(envContent)) {
        // Update existing key
        envContent = envContent.replace(keyRegex, `${key}="${value}"`);
      } else {
        // Add new key
        envContent += `\n${key}="${value}"`;
      }
    }
    
    // Write updated content back to .env file
    fs.writeFileSync(API_ENV_FILE, envContent.trim() + '\n');
    
    console.log('Environment configuration updated successfully.');
    return true;
  } catch (error) {
    console.error('Error updating environment configuration:', error);
    return false;
  }
}

// Fix Solana connection
function fixSolanaConnection() {
  console.log('Fixing Solana connection...');
  
  // Update server/solanaConnection.ts with proper connection configuration
  const solanaConnectionPath = 'server/lib/solanaConnection.ts';
  
  if (fs.existsSync(solanaConnectionPath)) {
    try {
      let content = fs.readFileSync(solanaConnectionPath, 'utf8');
      
      // Replace RPC URL configuration
      const rpcUrlRegex = /const RPC_URL = .*$/m;
      const newRpcUrl = `const RPC_URL = process.env.INSTANT_NODES_RPC_URL || 'https://solana-api.projectserum.com';`;
      
      if (rpcUrlRegex.test(content)) {
        content = content.replace(rpcUrlRegex, newRpcUrl);
      } else {
        content = `${newRpcUrl}\n${content}`;
      }
      
      // Add fallback mechanism
      if (!content.includes('getFallbackConnection')) {
        content += `
/**
 * Get a fallback Solana connection if the primary one fails
 */
export function getFallbackConnection(): Connection {
  const fallbackUrls = [
    'https://solana-api.projectserum.com',
    'https://api.mainnet-beta.solana.com',
    'https://solana-mainnet.g.alchemy.com/v2/' + process.env.SOLANA_RPC_API_KEY
  ];
  
  for (const url of fallbackUrls) {
    try {
      return new Connection(url, 'confirmed');
    } catch (error) {
      console.error('Failed to connect to fallback RPC:', url);
    }
  }
  
  throw new Error('All Solana RPC connections failed');
}
`;
      }
      
      // Write updated content back to file
      fs.writeFileSync(solanaConnectionPath, content);
      
      console.log('Solana connection fixed successfully.');
      return true;
    } catch (error) {
      console.error('Error fixing Solana connection:', error);
      return false;
    }
  } else {
    console.error('Solana connection file not found:', solanaConnectionPath);
    return false;
  }
}

// Fix Wormhole API connection
function fixWormholeConnection() {
  console.log('Fixing Wormhole connection...');
  
  // Update server/wormhole/config.ts with proper configuration
  const wormholeConfigPath = 'server/wormhole/config.ts';
  
  if (fs.existsSync(wormholeConfigPath)) {
    try {
      let content = fs.readFileSync(wormholeConfigPath, 'utf8');
      
      // Replace API key configuration
      const apiKeyRegex = /const WORMHOLE_API_KEY = .*$/m;
      const newApiKey = `const WORMHOLE_API_KEY = process.env.WORMHOLE_API_KEY || 'wh_guardian_rpc_2025';`;
      
      if (apiKeyRegex.test(content)) {
        content = content.replace(apiKeyRegex, newApiKey);
      } else {
        content = `${newApiKey}\n${content}`;
      }
      
      // Write updated content back to file
      fs.writeFileSync(wormholeConfigPath, content);
      
      console.log('Wormhole connection fixed successfully.');
      return true;
    } catch (error) {
      console.error('Error fixing Wormhole connection:', error);
      return false;
    }
  } else {
    console.error('Wormhole config file not found:', wormholeConfigPath);
    return false;
  }
}

// Fix AI API connections
function fixAIConnections() {
  console.log('Fixing AI API connections (Perplexity & DeepSeek)...');
  
  // Update server/ai/config.ts with proper configuration
  const aiConfigPath = 'server/ai/config.ts';
  
  if (fs.existsSync(aiConfigPath)) {
    try {
      let content = fs.readFileSync(aiConfigPath, 'utf8');
      
      // Replace Perplexity API key configuration
      const perplexityKeyRegex = /const PERPLEXITY_API_KEY = .*$/m;
      const newPerplexityKey = `const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || '';`;
      
      if (perplexityKeyRegex.test(content)) {
        content = content.replace(perplexityKeyRegex, newPerplexityKey);
      } else {
        content = `${newPerplexityKey}\n${content}`;
      }
      
      // Replace DeepSeek API key configuration
      const deepseekKeyRegex = /const DEEPSEEK_API_KEY = .*$/m;
      const newDeepseekKey = `const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';`;
      
      if (deepseekKeyRegex.test(content)) {
        content = content.replace(deepseekKeyRegex, newDeepseekKey);
      } else {
        content = `${newDeepseekKey}\n${content}`;
      }
      
      // Write updated content back to file
      fs.writeFileSync(aiConfigPath, content);
      
      console.log('AI API connections fixed successfully.');
      return true;
    } catch (error) {
      console.error('Error fixing AI API connections:', error);
      return false;
    }
  } else {
    console.error('AI config file not found:', aiConfigPath);
    return false;
  }
}

// Execute fixes
async function main() {
  console.log('========================================');
  console.log('🔧 Fixing API Connections for Live Trading');
  console.log('========================================');
  console.log();
  
  // Step 1: Update environment configuration
  const envUpdated = updateEnvFile();
  
  // Step 2: Fix Solana connection
  const solanaFixed = fixSolanaConnection();
  
  // Step 3: Fix Wormhole connection
  const wormholeFixed = fixWormholeConnection();
  
  // Step 4: Fix AI API connections
  const aiFixed = fixAIConnections();
  
  // Summary
  console.log();
  console.log('========================================');
  console.log('📊 Connection Fixes Summary');
  console.log('========================================');
  console.log(`✅ Environment configuration: ${envUpdated ? 'Fixed' : 'Failed'}`);
  console.log(`✅ Solana connection: ${solanaFixed ? 'Fixed' : 'Failed'}`);
  console.log(`✅ Wormhole connection: ${wormholeFixed ? 'Fixed' : 'Failed'}`);
  console.log(`✅ AI API connections: ${aiFixed ? 'Fixed' : 'Failed'}`);
  console.log();
  
  if (envUpdated && solanaFixed && wormholeFixed && aiFixed) {
    console.log('All connections fixed successfully!');
    console.log('Restarting the server to apply changes...');
    
    // Restart the server by executing the restart command
    exec('npm run dev', (error, stdout, stderr) => {
      if (error) {
        console.error('Error restarting server:', error);
        return;
      }
      console.log('Server restarted successfully.');
    });
  } else {
    console.log('Some connections could not be fixed.');
    console.log('Please check the logs and try again.');
  }
}

// Execute the main function
main().catch(console.error);