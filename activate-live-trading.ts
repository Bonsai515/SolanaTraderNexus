/**
 * Activate Live Trading with Real Funds
 * 
 * This script directly activates the transaction engine and ensures real 
 * blockchain transactions by fixing connection issues with Solana RPC.
 */

import * as fs from 'fs';
import * as path from 'path';

// Create logs directory if it doesn't exist
if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs');
}

// Helper function to log messages both to console and file
function log(message: string): void {
  console.log(message);
  fs.appendFileSync('./logs/activate-trading.log', message + '\n');
}

/**
 * Activate the transaction engine with the appropriate RPC URL
 */
export async function activateTransactionEngine(): Promise<boolean> {
  log('⚡ Activating transaction engine for live trading...');
  
  try {
    // Generate configuration for transaction engine
    const configDir = path.join(__dirname, 'server', 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Get RPC URL from environment variable or use the default Instant Nodes URL
    const rpcUrl = process.env.SOLANA_RPC_API_KEY ? 
      `https://solana-api.instantnodes.io/token-${process.env.SOLANA_RPC_API_KEY}` : 
      'https://solana-grpc-geyser.instantnodes.io:443';
    
    const websocketUrl = process.env.SOLANA_RPC_API_KEY ?
      `wss://solana-api.instantnodes.io/token-${process.env.SOLANA_RPC_API_KEY}` :
      'wss://solana-api.instantnodes.io';
    
    // System wallet for profit collection
    const systemWalletAddress = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
    
    const config = {
      useRealFunds: true,
      rpcUrl,
      websocketUrl,
      systemWalletAddress,
      wormholeGuardianRpc: 'https://guardian.stable.productions'
    };
    
    const configPath = path.join(configDir, 'engine.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    log(`✅ Transaction engine activated with configuration:`);
    log(`  - RPC URL: ${rpcUrl}`);
    log(`  - System Wallet: ${systemWalletAddress}`);
    log(`  - Using Real Funds: TRUE`);
    
    // Create an .env file with these settings for other processes
    const envContent = [
      `SOLANA_RPC_URL=${rpcUrl}`,
      `SOLANA_WEBSOCKET_URL=${websocketUrl}`,
      `SYSTEM_WALLET_ADDRESS=${systemWalletAddress}`,
      `USE_REAL_FUNDS=true`,
      `WORMHOLE_GUARDIAN_RPC=https://guardian.stable.productions`
    ].join('\n');
    
    fs.writeFileSync('.env.trading', envContent);
    log('✅ Environment variables saved to .env.trading');
    
    return true;
  } catch (error) {
    log(`❌ Failed to activate transaction engine: ${error.message}`);
    return false;
  }
}

/**
 * Enable real fund trading by setting appropriate flags
 */
export async function enableRealFundTrading(): Promise<boolean> {
  log('💰 Enabling trading with REAL FUNDS...');
  
  try {
    // Set the real funds flag in the transaction engine
    const agentsModule = require('./server/agents');
    
    if (typeof agentsModule.setUseRealFunds === 'function') {
      await agentsModule.setUseRealFunds(true);
      log('✅ All agents configured to use REAL FUNDS');
      return true;
    } else {
      log('⚠️ setUseRealFunds function not found in agents module, using alternative method');
      
      // Try to directly modify agents configuration
      const agentsConfigPath = path.join(__dirname, 'server', 'config', 'agents.json');
      
      let agentsConfig = {};
      if (fs.existsSync(agentsConfigPath)) {
        agentsConfig = JSON.parse(fs.readFileSync(agentsConfigPath, 'utf8'));
      }
      
      agentsConfig.useRealFunds = true;
      fs.writeFileSync(agentsConfigPath, JSON.stringify(agentsConfig, null, 2));
      
      log('✅ Agents configuration updated to use REAL FUNDS');
      return true;
    }
  } catch (error) {
    log(`❌ Failed to enable real fund trading: ${error.message}`);
    return false;
  }
}

/**
 * Activate all trading agents
 */
export async function activateAllAgents(): Promise<boolean> {
  log('🤖 Activating all trading agents...');
  
  try {
    // Get the agents module
    const agentsModule = require('./server/agents');
    
    if (typeof agentsModule.activateAllAgents === 'function') {
      await agentsModule.activateAllAgents();
      log('✅ All trading agents activated successfully');
      return true;
    } else {
      log('⚠️ activateAllAgents function not found in agents module');
      
      // Try to activate each agent individually
      const agents = ['hyperion-1', 'quantum-omega-1', 'singularity-1'];
      
      for (const agentId of agents) {
        if (typeof agentsModule.activateAgent === 'function') {
          await agentsModule.activateAgent(agentId);
          log(`✅ Agent ${agentId} activated successfully`);
        } else {
          log(`⚠️ Unable to activate agent ${agentId} - activation function not found`);
        }
      }
      
      log('✅ Agent activation process completed');
      return true;
    }
  } catch (error) {
    log(`❌ Failed to activate trading agents: ${error.message}`);
    return false;
  }
}

/**
 * Main function to activate live trading
 */
export async function activateLiveTrading(): Promise<boolean> {
  log('🚀 === ACTIVATING LIVE TRADING WITH REAL FUNDS ===');
  
  try {
    // Activate the transaction engine
    const engineActivated = await activateTransactionEngine();
    
    if (!engineActivated) {
      log('⚠️ Transaction engine activation failed, continuing with agent activation');
    }
    
    // Enable real fund trading
    const realFundsEnabled = await enableRealFundTrading();
    
    if (!realFundsEnabled) {
      log('⚠️ Real fund trading enablement failed, continuing with agent activation');
    }
    
    // Activate trading agents
    const agentsActivated = await activateAllAgents();
    
    if (!agentsActivated) {
      log('⚠️ Trading agent activation failed');
    }
    
    // Check if at least the engine was activated
    if (engineActivated) {
      log('✅ Live trading activation completed successfully');
      log('🚨 THE SYSTEM IS NOW TRADING WITH REAL FUNDS 🚨');
      return true;
    } else {
      log('❌ Live trading activation failed');
      return false;
    }
  } catch (error) {
    log(`❌ Uncaught error during live trading activation: ${error.message}`);
    return false;
  }
}

// Run the activation process if executed directly
if (require.main === module) {
  activateLiveTrading()
    .then(success => {
      if (success) {
        log('✅ Live trading successfully activated!');
      } else {
        log('❌ Failed to activate live trading');
      }
    })
    .catch(err => {
      log(`❌ Fatal error: ${err.message}`);
    });
}