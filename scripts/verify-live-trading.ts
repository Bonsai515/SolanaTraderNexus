/**
 * Verifies that the Singularity strategy is active for live trading with real funds
 * 
 * This script uses the server API to check the status of the Singularity agent
 * and confirm that it's properly configured for live trading.
 */
import axios from 'axios';

// Types for API responses
interface AgentStatus {
  id: string;
  name: string;
  type: string;
  status: string;
  active: boolean;
  wallets: {
    trading?: string;
    profit?: string;
    fee?: string;
    stealth?: string[];
  };
  metrics: {
    totalExecutions: number;
    successRate: number;
    totalProfit: number;
    lastExecution?: string;
  };
  lastError?: string;
}

interface SystemWalletStatus {
  address: string;
  status: string;
  balance: number;
  lastUpdated: string;
}

// Server configuration
const SERVER_URL = 'https://de951edc-096f-4df8-b381-7801ae07d340-00-1iiaejxecaa3j.kirk.replit.dev:5000';

/**
 * Verifies that Singularity is configured for live trading with real funds
 */
async function verifySingularityTrading(): Promise<void> {
  try {
    console.log('🔍 Verifying Singularity configuration for live trading...');
    
    // Check if the agent system is running
    const systemResponse = await axios.get(`${SERVER_URL}/api/agents/system-status`);
    console.log(`\n📊 Agent System Status: ${systemResponse.data.status}`);
    console.log(`Message: ${systemResponse.data.message || 'No message'}`);
    
    // Get information specifically about the Singularity agent
    const singularityResponse = await axios.get(`${SERVER_URL}/api/agents/singularity-1`);
    const agent = singularityResponse.data as AgentStatus;
    
    console.log('\n🤖 Singularity Agent Status:');
    console.log(`  Name: ${agent.name}`);
    console.log(`  Status: ${agent.status}`);
    console.log(`  Active: ${agent.active}`);
    console.log(`  Trading Wallet: ${agent.wallets.trading}`);
    console.log(`  Profit Wallet: ${agent.wallets.profit}`);
    console.log(`  Fee Wallet: ${agent.wallets.fee}`);
    
    if (agent.metrics) {
      console.log('\n📈 Singularity Performance Metrics:');
      console.log(`  Total Executions: ${agent.metrics.totalExecutions}`);
      console.log(`  Success Rate: ${agent.metrics.successRate}%`);
      console.log(`  Total Profit: ${agent.metrics.totalProfit} SOL`);
      if (agent.metrics.lastExecution) {
        console.log(`  Last Execution: ${agent.metrics.lastExecution}`);
      }
    }
    
    // Check if system wallet is properly funded
    const walletResponse = await axios.get(`${SERVER_URL}/api/wallet/system-status`);
    const wallet = walletResponse.data as SystemWalletStatus;
    
    console.log('\n💰 System Wallet Status:');
    console.log(`  Address: ${wallet.address}`);
    console.log(`  Status: ${wallet.status}`);
    console.log(`  Balance: ${wallet.balance} SOL`);
    console.log(`  Last Updated: ${wallet.lastUpdated}`);
    
    // Verify the conditions for live trading
    console.log('\n🔄 Live Trading Requirements Check:');
    
    const isSystemRunning = systemResponse.data.status === 'running';
    console.log(`  ✓ Agent System Running: ${isSystemRunning}`);
    
    const isSingularityActive = agent.active && agent.status === 'scanning';
    console.log(`  ✓ Singularity Active and Scanning: ${isSingularityActive}`);
    
    const isWalletFunded = wallet.status === 'active' && wallet.balance > 0;
    console.log(`  ✓ System Wallet Funded: ${isWalletFunded}`);
    
    const usingSystemWallet = agent.wallets.trading === wallet.address;
    console.log(`  ✓ Using System Wallet for Trading: ${usingSystemWallet}`);
    
    const allConditionsMet = isSystemRunning && isSingularityActive && isWalletFunded && usingSystemWallet;
    
    console.log(`\n${allConditionsMet ? '✅ All conditions met' : '❌ Some conditions not met'} for Singularity live trading with real funds`);
    
    if (!allConditionsMet) {
      console.log('\n⚠️ Some conditions are not met for live trading. Please check the logs.');
    } else {
      console.log('\n🚀 Singularity is properly configured for live trading with real funds!');
    }
  } catch (error) {
    console.error('❌ Error verifying Singularity trading status:', error);
  }
}

// Execute the verification
verifySingularityTrading();